---
layout: ../../../layouts/BlogPostLayout.astro
title: The Codebase Is the Prompt
date: 2026-11-16
description: The constraints in your repository decide what agents write, long before any prompt does.
category: technical
tags: ["agents", "software-engineering", "code-quality", "verification"]
---

Most of what shapes an agent's output is already written down before anyone types a prompt. It's in the repository.

An agent writing code is doing pattern completion against the largest corpus you have, and that corpus is your codebase. Whatever is already in there counts as an example. A repository that calls the same payment API through two different client libraries will get a third. One where every type error is silenced with an ignore comment will get more ignore comments. Nothing in the repository says these are mistakes, so the model treats them as the standard.

That means the correction loop matters more than any single fix. When an agent does something wrong, the useful question isn't how to repair that instance. It's what in the codebase made the wrong thing the easy thing, and whether that can be removed.

## where a constraint can go

There are three places to put one, and they don't carry the same weight.

The first is the code itself: types, APIs, module boundaries, lint rules, the dependency graph, the test suite. The second is verification, which means running the software and checking properties of it. The third is prose, meaning rules files, skills and [AGENTS.md](https://agents.md).

Prose is where most teams start, and it's the weakest layer. A rules file is a request. The model reads it, then reads a thousand files that outvote it. A type checker doesn't argue. It also has the advantage of running every time, on every change, without anyone remembering to invoke it.

Some constraints aren't corrections at all. They remove a choice that needs judgment to make well. A hook, a flag, a helper that an expert uses correctly will be used badly at volume, because the agent has no expert hands. The strongest version says the thing isn't available in this directory, and the argument about how to use it correctly never happens.

So the rule I work by is simple. Every correction that can become a deterministic check should become one, and prose is what's left over when the check isn't possible yet.

## the escape hatch

Take a Python service with [mypy](https://mypy-lang.org) in CI. An agent hits a type error it doesn't understand, adds `# type: ignore`, and CI goes green. The change is local and it looks harmless. It also teaches the next agent that this repository silences type errors, and after a while there are forty of them, and the type checker is decoration.

The same thing happens with comments, which is why I've become suspicious of them in code that agents touch. A comment is an escape hatch with no enforcement. It goes stale, nobody reads it, and it gives the agent a place to write down why the cheap fix was justified. Those justifications are worse than the fix, because they look like knowledge. If something needs to be said, it belongs in a rule, a type, or the name of the thing.

The fix for the ignore comment is to ban it outside a small allowlist, and to make the error message say what to do instead. An agent will take the shortest path to green CI. If the shortest path is a disable comment, that's what you get. If the shortest path is fixing the type, that's what you get.

A rule only stops new occurrences, and the old ones are still examples. The same change has to clean up what's already in the repository, otherwise it says both things at once and the model picks the cheaper one.

## what the architecture teaches

The harder case is architecture, because the fix is deleting something rather than adding a rule.

Suppose a codebase has two ways to call the same downstream service, an old client and a new one, because a migration stalled. An agent editing a file will use whichever client is already imported in that file. It has no reason to prefer the new one, and nothing in the file says one is deprecated. Now the migration has a third path to clean up, and it was created by the tool you hired to reduce work.

Or take retries. An agent adds a retry around a network call because the call failed once in a test. That's reasonable in isolation. Then it adds retries at four other call sites, and one of those call sites is already wrapped by a client that retries, and the timeout budget multiplies. A two second timeout with three retries is eight seconds before the caller sees an error, and when the client underneath it retries too, the budget compounds. No single diff looks wrong.

Both cases have the same root cause. The repository made the wrong choice available and didn't make the right one obvious. Deleting the deprecated client, or putting the retry in one place and banning it everywhere else, does more than any instruction.

Structure can carry this. If the frontend and the backend are separate top level directories, with imports between them forbidden by the dependency graph and enforced in lint, nobody has to explain the boundary in a prompt, and nobody has to catch a violation in review. The boundary is enforced where it's cheapest to enforce it, which is at the import.

## review the evidence

Verification changes what review is for. It stops being a reading of the diff and becomes a reading of the evidence: a recording of the flow, a screenshot, a state chart, a proof.

The floor is runtime verification, which just means the agent can run the app and drive it with the tools people already use, the [Chrome DevTools Protocol](https://chromedevtools.github.io/devtools-protocol/) being the obvious one. An agent that can open the page, click through the flow and read the console finds its own mistakes. An agent that can't is guessing about the result of its own change.

Two things make runtime verification reliable in practice. The first is a feature map, a sitemap of the product from the user's point of view. It gives the agent and the reviewer a shared vocabulary, so "the thingy in the left sidebar" resolves to a page and a flow instead of a guess. The second is wrapping the drivers in a CLI, so the agent calls one tested command instead of re-deriving the approach each time. That cuts the tokens spent on navigation and gives you a tool you can test like any other.

Then there is the formal work, which is further along than I expected. A payment flow where a retry can double charge has a property you care about, that no interleaving charges twice, and a model checker like [TLA+](https://lamport.azurewebsites.net/tla/tla.html) can verify it. You don't have to become a verification engineer to use that. You have to name the property and let the agent write the check. [Property-based testing](https://en.wikipedia.org/wiki/Property_testing) works the same way: an encode and decode pair has a round trip invariant, and generated inputs find the cases you didn't think of.

None of this is a silver bullet. It's another layer, and the layers below it still do most of the work. But it catches the failures that survive tests, because the tests encode the same assumptions as the code.

The reason this is happening now isn't that the techniques are new. They were always correct and always too expensive. A specification that a person has to write and keep in sync by hand rots faster than the code it describes, so nobody wrote one outside a few critical systems. When the model can write the spec and keep it in sync, and a person can still read it, the math changes. That's the shift, and it's why verification is where the tokens should go.

## tests that cannot fail

One more case, because it's the one that gives people false confidence. An agent writes a test that mocks the database, mocks the HTTP client, and asserts that the function calls them in a particular order. The test passes. It would also pass if the function did nothing useful, because it's testing the mocks against the implementation rather than the behavior against the world.

A rule helps here: a test has to fail when the behavior it covers is broken. [Mutation testing](https://en.wikipedia.org/wiki/Mutation_testing) enforces that mechanically by changing the code and checking that something goes red. If nothing goes red, the test is documentation, not verification.

## what this changes

When the codebase makes the wrong shape hard to write, most pull requests come out correct by default. That's the only thing that makes a higher volume of change safe, and the only thing that makes automation safe. Review doesn't get better. There's less to catch, and at the far end most changes merge on the evidence alone, with a person looking at the ones the evidence can't settle.

The job moves toward the codebase. Less time writing the change, more time on the conditions the change is written under. Migrations that would have taken a team months can be run by one person with a fleet of agents, as long as the codebase is in a state where a weak agent can still produce a good change. It also changes who can contribute. If the wrong shape is hard to write, a designer or a product manager can land a change without an engineer standing over it.

If your inner loop produces slop, automating it produces more slop, and then you spend tokens filtering it out. A factory built on a bad codebase is a faster way to make bad code. The factory isn't the hard part. The foundations are, which is why the teams that get this working spend months on lint rules and refactors before they automate anything.

Once the foundations exist, agents start coordinating agents. A bot with a role, its own computer, its own signed-in tools, and a routine that watches the bug queue and leaves a pull request for a person in the morning. A coordinator that dispatches to specialists, which start cloud agents, which come back with a diff, a recording and a screenshot. A release that spins up a project to fuzz the build, opens a fix for every bug it finds, and merges them without a person in the loop.

None of that is safe because the agents got better. It works because the repository is opinionated enough that most changes are boring.

## the procedure

If I were setting this up on a team, I'd do it in this order.

Start with the corrections. Keep a list of what you had to fix by hand in the last month, and turn the top of it into checks. One rule per correction, plus a cleanup change for the cases already in the repository.

Then decide what evidence a change needs before it merges. A UI change needs a recording of the flow. A schema change needs the migration run in both directions. A change to a concurrent path needs a state chart. Write that down as a policy, so the agent knows what to produce and the reviewer knows what to look at.

Then write down what an agent may do. Which tools and connections it can use, which actions wait for a person, and what a task may spend. That has to live with the task, not in a chat thread, or the answer disappears with the person who gave it.

And keep the record. Which agent was given the task, which version of it, what it was allowed to touch, what it produced and who approved it. Without that, you can't tell a good week from a lucky one, and you can't give an agent more autonomy because it has earned it.

## where this lives

A repository can hold the constraints and the evidence for code changes. It can't hold the rest of what an organization needs when agents run across teams: the definitions of the agents, the areas they work in, the connections each one may use, the budget it works within, and the record of what it did. That's a separate layer, and building it per team is how you end up with one incompatible version per team.

I wrote about that layer [separately](/docs/blog/every-company-will-run-its-own-team-of-agents), and it's what we're building with [dac-plane](https://github.com/dac-plane/dac-plane). People hand work to a named agent from the tools they already use, the agent runs on a runtime you choose, and the task, the permissions, the budget and the evidence all live in one record. The repository decides what an agent writes. The control plane decides what it can reach, what it can spend, and what it leaves behind.
