---
layout: ../../../layouts/BlogPostLayout.astro
title: AI Shipped Faster Than Anyone Can Verify
date: 2026-03-19
description: AI systems ship at exponential speed. The governance and security infrastructure around them is still moving at human speed. That mismatch is the actual problem.
category: ai
tags: ["ai", "governance", "security", "agents"]
---

I've been tracking what's actually happening in the AI space day to day. Not product launches or funding rounds. The pain. What's breaking, what's failing, what practitioners are complaining about.

The same five problems keep showing up. Agent overload. AI-generated code debt. OSS maintainer burnout. Missing governance for agent permissions. Verification fatigue from hallucinations. They look like separate problems. They aren't. They're all the same thing.

AI systems are shipping at exponential speed. Everything that's supposed to make them safe, trustworthy, and verifiable is still running at human speed. And every new AI capability makes the gap wider.

## What keeps showing up

Companies are deploying agents faster than anyone can oversee them. There's no scalable way to supervise agents at runtime, no standard for what an agent is allowed to do or whether it followed policy. A knowledge worker can't meaningfully supervise more than about three autonomous agents. Most companies are already past that and have no idea what their agents are doing.

AI-generated code is being written 10-100x faster than it can be reviewed or secured. Critical security findings in AI-assisted codebases are up 4x. 96% of developers say they don't trust AI-generated code, but they ship it anyway because the velocity pressure is real.

OSS maintainers are drowning. The Linux Foundation put $12.5 million toward maintainer support. Django and Linux kernel maintainers are publicly complaining about floods of low-quality AI-generated PRs and bug reports. AI creates noise at machine scale. Maintainers still triage at human scale.

There's no identity model for agents. We have Okta for humans. Nothing equivalent for agents. They act autonomously but have no enterprise-grade identity, no least-privilege model, no audit trail. Nobody even knows what permissions their agents have.

And every AI output still needs manual verification. A water company wasted $200,000 on decisions based on hallucinated data. Anthropic measured a 17% skill atrophy rate among developers who over-rely on AI. People are rubber-stamping outputs because reviewing everything at machine speed isn't possible.

## This happened before

The cloud boom in the early 2010s created the exact same structural gap. Companies adopted AWS and Azure faster than security tooling could keep up. There was no standard for cloud security posture management. No cloud-native identity. No cost governance.

That gap created entire product categories. CSPM became a multi-billion dollar market. FinOps emerged to manage cloud spending. Cloud IAM became critical infrastructure. Those categories exist because cloud adoption outran the governance capacity of existing tools.

The AI gap is the same pattern. The difference is speed and autonomy. Cloud adoption played out over 5-7 years. AI is compressing the same curve into 2-3 years. And agents add something cloud never had: autonomous action. A misconfigured S3 bucket sits there until someone finds it. A misconfigured agent actively does things.

## Why existing tools don't close it

Traditional AppSec tools were built for static code written by humans at human speed. They scan repositories on a schedule. They flag known vulnerability patterns. They assume code changes in discrete commits that humans review.

AI-generated code doesn't work that way. It arrives in bulk. It changes constantly. It contains patterns that signature-based scanners miss. And the volume overwhelms any triage process designed for human-speed output.

IAM systems were built for human identities. An agent that dynamically decides which APIs to call, which files to modify, which services to talk to doesn't fit the role-based model that every IAM system assumes.

CI/CD pipelines assume human review as a gate. When half your PRs are AI-generated (Spotify is already there), the review step either slows everything down or becomes a rubber stamp. Neither works.

## What would actually work

Whatever fills this gap has to operate at AI speed. Not human speed with AI bolted on.

Continuous governance for agents, not periodic audits. Real-time enforcement of what agents can and can't do, with least-privilege defaults. Every tool call, every file write logged and evaluated as it happens.

Real-time verification for AI-generated output. Not human review of every line, but automated confidence scoring and anomaly detection that flags what actually needs human attention. Spotify's LLM-as-judge for evaluating diffs is an early version of this.

Human attention is the scarce resource. The solution isn't more reviewers. It's a layer that manages human attention, surfaces what requires judgment, and handles the rest automatically.

And a real identity model for agents. Not API keys. Something that tracks what an agent is, what it's allowed to do, and what it actually did.

## The incentive problem

Part of why the gap exists is incentives. OpenAI, Anthropic, Google, every AI tooling company is racing to ship faster agents and more capable coding tools. That's where the revenue is. The trust layer is left as an exercise for the customer.

AWS did the same thing. Shipped services faster than security teams could evaluate them. The security tooling came later, built by third parties. The governance layer will be built by someone other than the model providers, because model providers have no economic reason to slow down their own adoption.

## Where this goes

This isn't a temporary problem that better models will solve. Better models make it worse. Every capability improvement widens the gap between what AI can do and what governance infrastructure can verify.

Someone will build the AI-native trust and governance platform the same way someone built Datadog for observability and HashiCorp for infrastructure. The pattern is too clear and the pain is too consistent for it not to happen.
