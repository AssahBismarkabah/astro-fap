---
layout: ../../../layouts/BlogPostLayout.astro
title: Context Is What Makes Code Review Work
date: 2026-04-01
description: AI code review is a systems problem, not a prompt problem. Here is how we built Snif to stay useful.
category: technical
tags: ["ai", "code-review", "rust", "tooling", "developer-experience"]
---

I spent a month researching every AI code review tool I could find. CodeRabbit, Greptile, the GitHub Copilot reviewer, half a dozen smaller ones. The pattern was the same everywhere: teams install the tool, get excited for a week, then disable it.

The comments are generic. The tool flags things that don't matter. It misses things that do. Every push creates new comments even when nothing changed. Developers learn to ignore it, and once trust is gone, the tool is dead.

This is the same pattern across the entire category. It does not matter which model powers the tool. GPT-5.3, Claude Opus, Gemini,they can all find real bugs when given the right context. The problem is everything around the model. What context goes in. What comes out. How it gets filtered. How it gets published. Whether it learns.

The model is the least interesting part.

## the systems problem

Think of it like this. A senior engineer reviewing a PR does not just read the diff. They know the codebase. They know that this module has a pattern for error handling and the new code does not follow it. They know that the function being changed is called from a critical path. They know that the last time someone touched this file, it broke production for two hours.

An AI reviewer that reads only the diff is doing the equivalent of asking a contractor to review your code on their first day. They can spot syntax issues and obvious bugs, but they cannot tell you if the change breaks something three modules away.

The fix is not a better model. The fix is a better system around the model. Context assembly, output filtering, annotation lifecycle, evaluation. That is the stack that actually matters.

## what greptile got right

Greptile understood the context problem early. They build a graph of the entire repository,every function, class, and dependency,then generate AI summaries that get embedded as vectors for semantic search. When a PR comes in, they query the graph and the vectors to find related code, then send all of that as context to the model.

Their approach works. The model sees the blast radius of a change. It sees similar patterns elsewhere in the codebase. It sees the conventions the team follows.

The limitation is the architecture. Greptile is a hosted service. Your code goes to their servers. They maintain the vector database, the graph infrastructure, the webhook listeners. For enterprise teams with data sovereignty requirements, that is a non-starter.

We studied their approach and built the same capability into a single binary.

## snif

[Snif](https://github.com/AssahBismarkabah/Snif) is an open source code review agent that ships as a single Rust binary. No hosted service. No external vector database. No code leaving your network.

It indexes the repository once per commit into a local SQLite database. Tree-sitter parses every source file and extracts the structural graph,imports, symbols, references. An LLM generates natural language summaries of every function and file, which get embedded as vectors for semantic search. Git history analysis reveals co-change patterns the import graph misses.

When a PR arrives, Snif retrieves related code using three methods in parallel: structural graph traversal for blast radius, semantic vector search for pattern matching, keyword search for exact references. The results are merged, ranked by configurable weights, and fit within a token budget.

Then it calls the model once, parses the structured output, filters aggressively, and posts findings.

## precision over volume

This is where the philosophy matters. Most tools default to showing more results because it looks like the tool is working harder. In practice, noise erodes trust faster than silence.

Every finding Snif produces must cite specific evidence from the provided code. Every finding must explain the user-relevant impact. Speculative findings are rejected. Style-only findings are suppressed unless the team explicitly configures them as enforced. Duplicate findings at the same location keep only the highest confidence.

We validated this against 25 benchmark fixtures,10 with known bugs, 10 clean changes, 5 style noise. 81.8% precision, 90% recall, 0% noise on clean changes. Quality gates block releases if precision drops below 70%.

The evaluation harness runs the same pipeline as production. Changes to prompts, models, or retrieval must pass the benchmark before shipping. This is not manual testing. This is automated quality gating on every change to the review system itself.

## comment churn kills trust

This is the part most tools get completely wrong. You push a change. The reviewer runs. Posts five comments. You fix two of them and push again. The reviewer runs again. Posts five new comments,three of which are the same issues, reworded.

That is how you train developers to ignore the tool.

Snif computes a stable fingerprint for every finding. SHA-256 of file path, line range, and category. The fingerprint does not include confidence or explanation text, so the same issue produces the same identity across reruns even if the model phrases it differently.

On each run, Snif fetches prior findings from the PR, matches current findings against them, and resolves stale ones. Fix the issue and the comment resolves automatically. Push again without fixing and no duplicate appears.

## snif reviewing its own code

The most convincing test of any tool is whether it works on itself.

During development, we pushed a GitLab adapter implementation. Snif reviewed the PR and caught a real bug: the adapter factory for GitLab read the API base URL only from an environment variable and ignored the config file. Self-hosted GitLab users who configured their instance URL in `.snif.json` would have been silently ignored.

The finding showed up in GitHub's code scanning tab via SARIF:

![Snif finding a logic bug in its own code via GitHub code scanning](ai-code-review/Github-code-logic.png)

Later, we deployed Snif on a GitLab enterprise instance. On its first real review,a 33-line diff fixing a picomatch ReDoS vulnerability,Snif correctly identified the change as clean and reported no issues:

![Snif reviewing a GitLab merge request and finding no issues on a clean change](ai-code-review/picomatch-ReDoS-vulnerability-gitlab.png)

Silence on a clean change is a success, not a miss.

In another review, Snif flagged its own installation docs as a supply chain risk,the CI pipeline downloaded and executed a shell script from GitHub without integrity verification. That finding led us to add Sigstore cosign keyless signing to every release. Each checksum file is now signed with GitHub Actions' OIDC identity and recorded in Sigstore's transparency log.

A tool that catches bugs in its own codebase and improves its own security posture is a tool worth keeping.

## what we learned

**validate before building.** We ran three technical spikes before writing any product code. SQLite with sqlite-vec for unified storage,benchmarked KNN queries at 100ms for 50k vectors, 87MB database. Tree-sitter for structural parsing,150 lines of adapter code per language, accurate extraction across Rust, TypeScript, and Python. Fastembed for local embeddings,20 summaries embedded in 1.5 seconds, meaningful similarity results. We committed to the architecture only after proving every piece works with real numbers.

You cannot design a retrieval system by reading about retrieval systems. You have to build it, measure it, and see where the numbers actually land. The spikes were not optional. They were the only way to make informed architecture decisions.

**fixtures catch fixture bugs, not model bugs.** Our first evaluation run showed 25% precision. The natural assumption was that the model was wrong. It was not. Our "clean" test fixtures had real bugs the model correctly caught. A function that sliced a UTF-8 string by byte index,panics on multi-byte characters. A log statement using `warn!` level for routine request parsing. The model caught issues the fixture author missed.

This is a lesson about confidence in your own assumptions. When the test says you are wrong, check the test before changing the code. Once we fixed the fixtures, precision jumped to 100%.

**lock files break everything.** A 33-line diff touching `pnpm-lock.yaml` produced a 287k token prompt because Snif loaded the entire lock file as context. The pipeline log told us exactly what happened:

```
Context assembled changed=3 related=0 omitted=0 remaining_tokens=0
WARN Prompt still exceeds budget after removing all related files
  tokens=204815 budget=128000
```

Zero related files. All 204k tokens came from the three changed files alone. The lock file,hundreds of thousands of lines with no reviewable logic,consumed the entire budget. The fix was to detect non-reviewable files and skip their full content. The diff hunks are enough. Every major code review tool does this. We should have done it from the start.

**the model is not the product.** We spent zero time on prompt engineering before the architecture worked end-to-end. The system prompt is 40 lines. The output schema is a JSON array with eight fields. That is the entire prompt layer. The quality comes from what goes into the prompt, what comes out of it, and what happens after. Retrieval, filtering, lifecycle. The model is a replaceable execution layer.

This is the same insight that applies to every AI product right now. The model is a commodity. The system around it is the product. If your entire value proposition depends on which model you use, you have no moat. The moat is in the data pipeline, the evaluation framework, the deployment infrastructure, and the feedback loops.

## try it

Snif is open source under the MIT license. It supports GitHub and GitLab, reviews in Rust, TypeScript, Python, and Java, and works with any OpenAI-compatible LLM provider.

```
curl --proto '=https' --tlsv1.2 -LsSf \
  https://github.com/AssahBismarkabah/Snif/releases/latest/download/snif-installer.sh | sh
```

The [GitHub repo](https://github.com/AssahBismarkabah/Snif) has the full documentation, CI integration guides for GitHub Actions and GitLab CI, benchmark fixtures, and the architecture docs behind every decision.

Releases are signed with Sigstore cosign. Every checksum file has a `.sig` and `.pem` for verification against the GitHub Actions OIDC identity.
