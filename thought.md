# How I Know If an Architecture Works Before I Build It

*Two decisions in Snif. Two different ways to resolve the uncertainty.*

---

Here is a question I sat with for a while when I started building Snif: how do you know if an architecture is right before you are stuck with it?

Snif is an AI code review tool. It analyzes a pull request, retrieves relevant context from the repository, and runs a structured review. Before I wrote any of the main implementation, I had two architectural decisions sitting in front of me that I could not just think through and pick.

The first was storage. Snif needs to hold a structural relationship graph and vector embeddings in the same place. Do I use a dedicated vector database alongside SQLite, or do I bet on sqlite-vec and keep everything in one local database?

The second was the review step itself. Single agent call or multi-agent pipeline? In 2026 every AI tool conversation defaults to multi-agent. Specialist subagents, orchestration layers, parallel reviewers. I had to decide if that was actually the right shape for Snif.

Both felt uncertain. But when I looked at them closely, they were uncertain in completely different ways. That difference turned out to matter a lot.

---

## The storage question: I could not reason my way to an answer

The storage question was a technical bet. And the thing about technical bets is that reasoning about them only gets you so far. At some point you have to test the specific claim.

My claim was this: rusqlite and sqlite-vec can handle both the relational graph and vector embeddings in one local database, with KNN query performance that is acceptable inside Snif's 120-second review time budget.

That is either true at real numbers or it is not. I needed to know which.

So I ran a spike. A spike is not a prototype. It is the minimum thing that answers one specific question. You write down the hypothesis, set up the conditions, and measure.

I ran it at three scales. 5k embeddings, 25k, and 50k. All 384-dimensional float32 vectors. At 50k in debug mode, KNN queries averaged 103ms with a p95 of 132ms. The database was 87MB. In release mode that latency drops to the 10-25ms range based on typical Rust debug-to-release ratios.

The budget is 120 seconds. The math was not even close.

Decision: no external vector database. SQLite with sqlite-vec handles both. Architecture proceeds.

What I liked about this was not just the confirmation. It was how much the spike cleaned up the design. No external infrastructure. No network call. No separate service to run in CI. One database file that ships with the binary. The spike did not just validate the bet, it eliminated an entire layer of the system.

---

## The agent question: the numbers alone were not the issue

The agent question felt different from the start. Multi-agent pipelines are technically viable. The question was not whether they work. It was whether they were right for what Snif is actually trying to do in Phase 1.

That is a different kind of uncertainty. And measuring your way out of it only gets you so far if you are not clear about what you are measuring against.

Phase 1 of Snif has one job: prove that a single reviewer with deep repository context can be trusted. Not that it is impressive. That it is trustworthy. Stable output across reruns. Filterable findings. Reproducible results. Something a team can wire into CI and rely on.

Once I was clear about that, multi-agent started to look like the wrong tool regardless of capability. More agents means more variance. More variance means harder to filter, harder to deduplicate, harder to fingerprint, harder to evaluate across runs. Multi-agent would make Snif harder to trust, which is the one thing Phase 1 cannot afford.

Research I had done earlier landed in the same place from a different angle. A paper from Google Research, DeepMind, and MIT tested 180 agent configurations across three model families and four benchmarks. The average performance delta from multi-agent was -3.5%. On sequential tasks specifically, where each step depends on the previous one, every multi-agent variant made things worse. Degradation from -39% to -70%. No exceptions.

Code review is sequential. You retrieve context, build a coherent picture of the diff, reason across the whole thing, produce findings. You cannot hand that off to parallel subagents without losing the coherent view that makes the review useful. Each step feeds into the next.

So the product constraint and the research pointed at the same answer. Single call. One context package, one prompt pair, one LLM call, one pass through the filter.

The door is open to specialist passes later, security, logic, conventions as separate dimensions. But only if measurements justify the added complexity. Right now they do not.

---

## What I actually learned

Before I built anything I had two questions sitting in front of me. Both felt like uncertainty. But they were not the same kind.

The storage question was a technical bet. The only honest answer was to test it at real numbers. Reasoning about sqlite-vec's performance without measuring it would have been guessing.

The agent question was a strategic question. What is this phase trying to prove? Once that was clear, the complexity was not hard to rule out. And having research that pointed the same direction gave me one more reason to trust the call.

I think most architecture mistakes come from not separating these two. You reason through something that needs a test. Or you run a spike on something that was already ruled out by a clearer product constraint. Both waste time and give you false confidence.

Before you commit to a design, figure out what kind of uncertainty you are actually holding.

If it is a technical bet, test it. Write down the specific claim, set up the minimum conditions, measure. If the numbers do not clear, you find out early. If they do, you move forward knowing it works, not hoping it does.

If it is a strategic question, get clear on what you are trying to prove in this phase. Most options eliminate themselves once you are honest about that. Then check the evidence and see if it agrees.

Either way, you know before you build. That is the whole point.