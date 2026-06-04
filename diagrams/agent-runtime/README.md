# Agent Runtime Diagram

Working directory for the agent-runtime diagram used by the article and LinkedIn post.

## Core claim

> A sandbox gives the agent a machine. A runtime gives the work a lifecycle.

## Structure

- `src/agent-runtime-control-plane.svg` is the editable vector source.
- `dist/agent-runtime-control-plane.png` is the exported PNG.
- `notes/concept.md` captures the diagram story and accuracy rules.

## Export

From the `astro-fap` root:

```bash
npm run diagram:agent-runtime
```

Or from this directory:

```bash
./export.sh
```

## Preview

Run the Astro dev server and open:

```text
http://localhost:4321/diagrams/agent-runtime
```

