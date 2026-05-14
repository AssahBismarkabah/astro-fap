---
layout: ../../../layouts/BlogPostLayout.astro
title: Not Every Architecture Question Needs a Spike
date: 2026-05-14
description: Some Snif decisions needed measurements. One needed a clear phase constraint.
category: technical
tags: ["architecture", "ai", "snif"]
---

Not every architecture question needs a spike.

[Snif](https://github.com/AssahBismarkabah/Snif) had two architecture questions before the main implementation: where repository context should live, and how the reviewer should run.

Snif is an AI code review tool. It analyzes a pull request, retrieves the relevant context from the repository, and runs a structured review. The first question was storage.

Snif needs a structural relationship graph and vector embeddings in the same place. I could use [SQLite](https://www.sqlite.org/index.html) for the graph and run a dedicated vector database beside it, or I could keep everything inside one local SQLite database with [sqlite-vec](https://github.com/asg017/sqlite-vec).

The second question was the reviewer itself. Single agent call or multi-agent pipeline.

Every AI tool conversation turns into multi-agent now. Specialist subagents, orchestration layers, parallel reviewers. None of that decides whether the architecture fits.

Both were architecture questions. Only one needed a spike.

## the storage bet

The storage decision was a technical bet. There was a specific claim underneath it: [rusqlite](https://github.com/rusqlite/rusqlite) and [sqlite-vec](https://github.com/asg017/sqlite-vec) can hold the relationship graph and the embeddings in one local database, and KNN queries will still be fast enough inside Snif's 120-second review budget.

That's either true at real numbers or it isn't.

So I ran a spike. Not a prototype. A spike answers one question and then gets out of the way.

I tested 5k, 25k, and 50k embeddings. All 384-dimensional float32 vectors. At 50k in debug mode, KNN queries averaged 103ms with a p95 of 132ms. The database was 87MB. In release mode, that should land in the 10-25ms range based on normal Rust debug-to-release differences.

The review budget is 120 seconds. A 132ms p95 query doesn't threaten that budget.

So that decision got easy. No external vector database. No extra service to run in CI. No network hop just to review a pull request. One SQLite database file ships with the binary.

The spike didn't just confirm the choice. It made the design smaller.

## the agent constraint

The agent decision needed a product constraint first.

You can always build a multi-agent version and measure something. But without knowing what the first version has to prove, the measurement can validate the wrong choice.

Phase 1 of Snif has one job: prove that a single reviewer with deep repository context can be trusted. The point isn't to make an impressive demo. It's to produce stable findings a team can filter, reproduce, fingerprint, and wire into CI without learning to ignore the tool.

Once that was clear, multi-agent became the wrong first architecture.

More agents means more variance. More variance makes the output harder to filter, harder to deduplicate, harder to fingerprint, and harder to evaluate across runs. That works against the one thing Phase 1 has to prove.

Earlier research pointed the same way. A [paper from Google Research, DeepMind, and MIT](https://arxiv.org/abs/2512.08296) tested single-agent and multi-agent systems across major model families and agentic benchmarks.

The part that mattered for Snif was sequential work. When each step depends on the previous step, every multi-agent variant made things worse. Degradation ranged from -39% to -70%. No exceptions.

Code review is sequential in that sense. You retrieve context, build a picture of the diff, reason across the change, and produce findings. Each step depends on the one before it.

If you hand pieces of that review to parallel subagents, each one loses part of the picture. The review may get wider, but it gets less coherent. And coherence is what makes the finding useful.

So the answer was one context package, one prompt pair, one LLM call, one pass through the filter.

Specialist passes can come later. Security, logic, conventions, each could become its own dimension. But they have to earn their place with measurements. They don't get added because multi-agent carries the modern label.

## the wrong proof

That doesn't make SQLite the answer or multi-agent the mistake. Both claims are too narrow.

Architecture uncertainty comes in different forms.

Some uncertainty is a technical bet. You write down the claim, create the smallest test that can answer it, and measure. Reasoning about sqlite-vec performance without numbers would have been guessing.

Some uncertainty is a strategic question. You ask what this phase has to prove. Once the constraint is clear, a lot of options eliminate themselves.

Most architecture mistakes come from mixing those up. You reason through something that needed a test. Or you run a spike on something that was already ruled out by the phase you're in.

In both cases, you can do serious work and still answer the wrong question.

Before you commit to a design, name the uncertainty. If it's a technical bet, test it. If it's a strategic question, clarify what the phase has to prove.

Use the proof that matches the question.
