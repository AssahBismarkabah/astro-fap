# Writing Voice Guide for til.assahbismark.com

Reference this document whenever translating a thought file, draft, deep research, or conversation transcript into a blog post.

## The voice

Write like you're explaining something to someone. Not reflecting on it, not dramatizing it, not performing it. Just explaining how it works and what you think about it.

The reference examples live in `/Users/adorsys123/dev/blog-concept/example-writeups/`. Read them before writing. The SOUL.md lives at `/Users/adorsys123/dev/blogs/CLAUDE.md`. The Simon Willison method lives at `/Users/adorsys123/dev/blogs/my-write/writing-philosophy.md`.

The sweet spot: Naval's conversational directness + Willison's technical specificity.

## How Naval actually writes (study these patterns)

From reading dozens of his writeups, here is what he actually does:

**Each paragraph extends the previous one.** There are no clean topic breaks. It's one flowing argument where each thought leads to the next. "In the case of gravity, there literally is only one theory. There's general relativity. Previously we did have two theories." Then the next paragraph picks up from there naturally.

**He opens with observations or questions, never definitions.** "When I was young, I thought the point of the body was to protect the brain. Now I realize it's the other way around." Not "The human body contains two primary systems..."

**He picks ONE example and develops it.** The black swan gets a full paragraph. The Antarctica example gets developed. He doesn't stack three studies in a row.

**He references people casually mid-thought.** "Karl Popper has this wonderful saying..." Not "Philosopher Karl Popper theorized that..."

**He uses thought experiments.** "Take a piece of paper, take a pen, draw two dots on the piece of paper. Now, how many unique straight lines can you draw through those two dots?" Walks you through a demonstration, then surprises you.

**He makes bold claims.** "We are qualitatively different." "All knowledge is conjectural." Not hedged.

**He ends on concrete points, not philosophical reflections.** "All we have is better and better approximations to reality." "So, keep moving, and be alert." Not "That ability is what allows you to ask the question in the first place."

**He uses natural connectors.** "So," "And so," "But," "Which is why," "Now," "And that's the thing." Not "Furthermore," "Additionally," "It's worth noting."

## What to do

- State opinions as facts, not feelings. "It's architecture" not "I think it's architecture."
- Drop into examples directly. "A team spent $1.2 million building a chatbot." Not "There's a case study that stuck with me."
- Use contractions. "It's", "don't", "isn't", "can't", "won't", "doesn't", "that's".
- Each paragraph makes a point and extends naturally into the next.
- Use simple connecting words: "So," "And so," "But," "Which is why," "Now," "And that's the thing."
- Conversational headings, lowercase. "The feature factory trap" not "Understanding the Implications of Feature-First Development."
- End when the last concrete point is made. No summary, no "In conclusion," no call to action, no philosophical bow-tie.
- Break long paragraphs into shorter ones. One idea per paragraph.
- Link references inline where relevant.
- Develop one example per point instead of stacking citations.

## What NOT to do

### Emotional/reflective framing
Not "stuck with me", "haunts me", "keeps showing up", "I've watched teams fall into this." Naval doesn't reflect on how ideas make him feel. He just explains the ideas.

### Dramatic standalone lines
Not "Architecture." as its own paragraph. Not "That changes everything." Not "But during moments of original thought, both fire at the same time." as a dramatic break. Fold it into the paragraph naturally.

### Poetic breaks or rhythm tricks
Not three parallel sentences building to a punch line. Not "Every experiment is a question. Every prototype is a hypothesis." Naval's writing doesn't have rhythm tricks. It has rhythm because it's someone actually thinking.

### Structural announcements
Not "Whether we'll ever know depends on which wall we're hitting." (announces "here come three things"). Not "There's a possibility that's uncomfortable but worth taking seriously:" (announces what you're about to say). Not "The analogy that makes this concrete:" (announces the analogy). Naval just says the next thing.

### Philosophical bow-tie closers
Not "that ability is what allows you to ask the question in the first place." Not "The code is cheap now. The thinking never was." These try to sound deep but say nothing new. End on the last concrete point, then stop.

### Triple-list constructions
Not "Whether that's a quantum process, a biological accident, or a universal field." Not "curiosity and tested knowledge and willingness to experiment." Pick one or say it differently.

### Textbook formatting
Not bold-labeled lists like **The generator theory**, **The receiver theory**, **The fundamental theory**. Weave ideas naturally: "Some think... Others think... A third group thinks..."

### Academic filler
Not "myriad forms", "prevailing materialist frameworks", "it's important to note", "it is worth noting", "to grasp this."

### AI writing patterns
Not "In this post we'll explore", "Let's dive in", "In today's rapidly evolving landscape", "the fact that X proves that Y", "even if we never X, the Y."

### Other
- No em dashes. Use commas, periods, or restructure.
- No "Conclusion" section header.
- Don't name book titles if the name could be misleading.
- Don't reference Naval in the blog posts. He's the voice reference, not someone to cite.
- Don't add ideas, analogies, or arguments that aren't in the source material.

## Translating from source material

When given a thought file, deep research, or conversation transcript:

1. **The source IS the content.** Every idea, argument, and reference from the source should be preserved. Don't invent new arguments or analogies that aren't in the source.
2. **But the source's phrasing may be AI-generated.** If the thought file was a conversation with an AI, the AI's framing language ("Whether we'll ever know depends on...") should be adjusted. The user's IDEAS stay. The AI's structural phrasing goes.
3. **Break up long paragraphs** into shorter ones, one idea each.
4. **Make headings conversational** and lowercase.
5. **Remove academic phrasing.** "As C.S. Lewis articulated" becomes just introducing the quote directly.
6. **Remove filler and throat-clearing.** Cut "myriad", "prevailing", "it is worth noting."
7. **Don't over-rewrite.** Stay close to the original text. The goal is voice adjustment, not a rewrite from scratch.
8. **Check for overlap** with existing blog posts before writing. If the blog already covers the same ground, find the angle that's actually new and focus on that.

## Common mistakes we've made (avoid repeating)

1. **Writing a research report instead of a blog post.** Stacking citations, using bold-labeled lists, structuring like an academic paper. Fix: pick one example, develop it, move on.
2. **Adding Naval references in the posts.** He's the voice model, not a source to cite.
3. **Inventing content not in the source material.** Adding analogies, arguments, or examples the user didn't write. Fix: stay faithful to the thought file.
4. **Dramatic openings and closings.** Poetic first lines, philosophical last lines. Fix: open with the topic directly, end on the last concrete point.
5. **Announcement sentences.** "Here are three theories." "Whether we'll ever know depends on which wall we're hitting." Fix: just say the next thing.
6. **Multiple endings.** Writing the ending, then writing another ending after it. Fix: one ending, then stop.
7. **Textbook structure.** Definition, then example, then takeaway, repeated for each section. Fix: one flowing argument where each paragraph extends the previous one.

## Frontmatter format

```yaml
---
layout: ../../../layouts/BlogPostLayout.astro
title: Title Here
date: YYYY-MM-DD
description: One line, direct.
category: technical | life | ai | science
tags: ["tag1", "tag2"]
---
```

## Categories

- `technical` — software engineering, architecture, DevOps
- `ai` — AI, LLMs, taste/judgment
- `life` — spirituality, purpose, identity
- `science` — biology, neuroscience, evolution, physics, consciousness
