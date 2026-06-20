---
layout: ../../../layouts/BlogPostLayout.astro
title: Making Snif Fast Enough to Run on Every PR
date: 2026-06-17
description: How we removed redundant LLM calls, eliminated hard caps, added code embeddings, and built evidence verification into the review pipeline.
category: technical
tags: ["ai", "code-review", "rust", "tooling", "developer-experience"]
---

A repository with 5,000 symbols. One line changes. [Snif](https://github.com/AssahBismarkabah/Snif) re-summarized all 5,000 symbols, re-embedded all 5,000 summaries, then ran retrieval on the full set. Roughly 1,000 LLM calls and 5,000 embedding calls to review a single-line diff.

99% of those symbols hadn't changed since the last index. Their content was identical. Their summaries were already stored. But Snif had no way to know that, so it regenerated everything.

## how summarization worked before

When `snif index --full-index` runs, it parses the repository with tree-sitter, builds the structural graph (imports, symbols, references), runs co-change analysis on git history, then calls the LLM to summarize every function and file. The summaries get embedded as vectors for semantic search. When a PR comes in, Snif retrieves related code using structural graph traversal, semantic vector search, and keyword matching, then feeds the assembled context to the review model.

Each step in this pipeline had a bottleneck. The summarization step had no way to skip unchanged symbols. The retrieval step had a hard cap at 10,000 symbols. The summarization call pattern was one symbol per LLM request. Files that hadn't been summarized yet had no vector signal at all. And the final review output was posted without checking whether the evidence in findings actually existed in the source code.

The changes are in [PR #30](https://github.com/AssahBismarkabah/Snif/pull/30). What follows is what each change does, why the old approach didn't scale, and what replaced it.

## content-hash tracking

Every symbol now gets a SHA-256 hash of its source body stored alongside its summary. When `snif index --full-index` runs, it computes the hash for each symbol and compares it to the stored hash. Match means skip. No LLM call, no embedding call. Mismatch means only that symbol's summary is regenerated.

```rust
let hash = content_hash(&body);

if let Some((_, _existing_summary, existing_hash)) = store.get_summary_for_symbol(sym.id)? {
    match existing_hash {
        Some(stored_hash) if stored_hash == hash => {
            symbols_skipped_unchanged += 1;
            continue;
        }
        Some(_) => {
            // Hash mismatch - content changed, delete only this symbol's summary
            store.delete_summary_for_symbol(sym.id)?;
        }
        // ...
    }
}
```

On a repository with 5,000 symbols where one file changed, the old pipeline made 1,000 LLM calls. The new pipeline makes between 1 and 5, depending on how many symbols in that file changed. The hash check is a single SQL query per symbol. The savings come from the calls that don't happen.

File-level summaries use the same mechanism. The file hash is computed from the concatenation of child symbol names and summaries. When a child's content changes, its summary is regenerated, the file hash changes, and only the file-level summary is regenerated. The unchanged sibling summaries stay in place.

The initial implementation had a bug here. When a symbol's hash changed, the code called `delete_summaries_for_files`, which deleted every summary for that file, including the ones that hadn't changed. The file-level summary could be regenerated from in-memory child data, but the symbol summaries were permanently lost from the database until the next full re-index. The fix was `delete_summary_for_symbol`, which removes only the single stale summary and its embedding:

```rust
pub fn delete_summary_for_symbol(&self, symbol_id: i64) -> Result<()> {
    let summary_id: Option<i64> = self.conn.query_row(
        "SELECT id FROM summaries WHERE symbol_id = ?1",
        [symbol_id],
        |row| row.get(0),
    ).ok();

    if let Some(sid) = summary_id {
        self.conn.execute(
            "DELETE FROM summary_embeddings WHERE summary_id = ?1",
            [sid],
        )?;
        self.conn.execute(
            "DELETE FROM summaries WHERE id = ?1",
            [sid],
        )?;
    }
    Ok(())
}
```

## lazy on-demand indexing

Even with hash tracking, running `--full-index` on every commit means paying for an LLM API call on every symbol in the repository. For a team that reviews a few PRs a week, the cost adds up. Not every team wants to pre-build summaries for their entire codebase.

The `snif index` command now runs structural parsing, co-change analysis, code chunking, and code chunk embeddings without any LLM calls. These steps use a local ONNX embedding model (all-MiniLM-L6-v2, 384 dimensions) that runs on CPU and doesn't need an API key. LLM summarization and summary embeddings only run with `--full-index`.

When `snif review` runs and encounters files that don't have summaries, it checks whether an API key is configured. If one is available, it generates summaries on demand for just those files, using the same `summarize_symbols_async` function that the full index uses. The on-demand path also generates file-level summaries, not just symbol-level summaries. File-level summaries aggregate their child symbol summaries and provide context the LLM uses to understand what a file does as a whole.

## batch summarization

The previous approach called the LLM once per symbol. 500 functions meant 500 HTTP roundtrips. At one to three seconds per call, summarization alone took 8 to 25 minutes.

The new approach groups symbols by file and batches up to five into a single prompt. The system prompt instructs the model to return a JSON array with one object per symbol. A `batch_parser` handles partial failures: if the model returns four valid summaries and one malformed fragment, the four are kept and the one is retried individually.

Concurrent dispatch uses a tokio semaphore controlling how many batch requests are in flight. A provider pressure tracker monitors rate-limit responses (HTTP 429) and sustained partial-batch failures. Two consecutive batches with majority failures, or a total error count past a threshold, and summarization stops early instead of burning through the remaining symbols at a loss.

The throughput improvement is the combination, not the batch ratio alone. Content-hash dedup skips unchanged symbols entirely. Batch grouping reduces the number of LLM calls for symbols that do need summarization. The semaphore and pressure tracker prevent cascading failures from wasting API budget.

## removing the hard caps

The constants were `MAX_SYMBOLS_FETCH` at 10,000 and `MAX_SUMMARIES_FETCH` at 50,000. Any repository larger than those limits had its context silently truncated. The LLM never saw the symbols beyond 10,000, and the developer never knew what was missing.

The fix was paginated retrieval. Private methods `query_symbols_page(offset, limit)` and `query_summaries_page(offset, limit)` loop through the full result set internally. The public APIs return the same types as before. Callers don't know pagination is happening. The constants were renamed to `SYMBOLS_PAGE_SIZE` and `SUMMARIES_PAGE_SIZE`. These are page sizes, not ceilings.

## code embedding fallback

Summary-based semantic retrieval only works for symbols that have been summarized. Files added in a recent commit, or files that haven't gone through `--full-index`, have no summaries. The LLM has no vector signal for them.

Code embeddings fill that gap. The `snif-chunks` crate splits every source file into 50-line chunks with 10-line overlap. Each chunk is embedded with the same local ONNX model that powers summary embeddings. The chunks and their embeddings go into two new SQLite tables: `code_chunks` and `code_embeddings`.

When a review runs, the retrieval pipeline concatenates the chunks from changed files, embeds the concatenation as a single query vector, and searches the `code_embeddings` table for the k-nearest neighbors. The retrieval weight for code-semantic results is 0.4, below summary-semantic at 0.7 because raw code is a noisier signal than curated summaries, and above keyword at 0.3 because vector similarity captures conceptual relatedness that exact matches miss. The scores are additive. A file found by both structural and code-semantic retrieval gets 1.0 + 0.4 = 1.4.

This runs entirely on the local model. No API key needed. A basic `snif index` that provides structural, keyword, and code-semantic retrieval takes seconds and costs nothing beyond CPU time.

Chunk dedup uses content hashing. Each chunk gets a SHA-256 hash. On re-index, the new chunk hashes are compared against the existing hashes for that file as sorted vectors, not hash sets. The original implementation used a HashSet, which collapses duplicate hashes. Two chunks with identical content would produce the same hash, making the set size smaller than the actual chunk count. A file with rearranged or duplicated code blocks could produce the same hash set despite different content. Sorted vector comparison preserves duplicates and ordering.

The schema moved from v4 to v5. The `code_chunks` and `code_embeddings` tables are created automatically on the next `snif index` run.

## evidence verification

After shipping these changes, we ran Snif on its own PR. It posted a finding at 95% confidence claiming that `get_embedded_chunk_id` was a naming mismatch with `get_embedded_chunk_ids`. The singular form doesn't exist in the codebase. The LLM had seen `chunk_id` in a SQL column and pattern-completed the method name from that column.

The existing pipeline had three validation steps: confidence threshold filtering, self-dismissal pattern detection, and deduplication. None of these check whether a finding's evidence matches reality. A finding that cites a method name that doesn't exist will pass all three if its confidence is above threshold, its language is assertive, and it's the only finding at that location.

We added a fourth step. After filtering and before fingerprinting, `verify_findings` reads each finding's referenced source file and searches for code identifiers extracted from the evidence:

```rust
fn verify_finding(finding: Finding, repo_root: &Path) -> Finding {
    let file_path = repo_root.join(&finding.location.file);
    let file_content = std::fs::read_to_string(&file_path)
        .unwrap_or_default();

    if is_evidence_found(&finding.evidence, &file_content) {
        finding  // Evidence verified, pass through unchanged
    } else {
        Finding {
            confidence: (finding.confidence - EVIDENCE_MISMATCH_PENALTY).max(0.0),
            ..finding
        }
    }
}
```

The identifier extraction pulls backtick-quoted snippets and snake_case or camelCase identifiers from the evidence text. If any extracted identifier appears in the source file, the evidence is considered verified. One match is enough. The LLM might describe surrounding context inaccurately, but if the core identifier exists in the code, the finding is probably grounded.

If no identifiers can be extracted, which happens with vague evidence like "this code has a logic error," the finding passes through unchanged. The penalty only applies when the pipeline can extract specific code references and those references don't appear in the file. A finding at 0.95 that cites `get_embedded_chunk_id` in a file that only contains `get_embedded_chunk_ids` drops to 0.65, which falls below the 0.7 minimum threshold and gets filtered out.