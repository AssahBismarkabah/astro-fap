# Design Audit

## What v1 gets right

The concept is right: it separates sandbox-only execution from an agent runtime control plane. It also keeps the agent separate from the runtime, which is important.

## What v1 gets wrong visually

The current figure is closer to a SaaS explainer slide than a research-paper systems diagram.

Specific issues:

- Too many rounded cards and soft shadows.
- Too many words inside the figure.
- Color is doing decoration work instead of encoding meaning.
- The title and tagline take too much figure space.
- The left/right comparison is understandable, but the right side reads like a dashboard wireframe.
- Arrows are visually heavy and some flows feel narrative instead of architectural.
- There is no strict notation for control flow, data/action flow, and observation flow.
- Component boundaries are not disciplined enough.

## What strong paper figures do

From the diagrams checked:

- AIOS uses strict layers: application, kernel, hardware.
- Crab uses user space vs kernel space boundaries, labeled runtime components, and separate workflow figures.
- YoloFS uses a compact before/after comparison with only the important relationships.
- AWS and Anthropic examples are clean but more tutorial/enterprise style than paper style.

The strongest pattern for this topic is Crab + AIOS:

- one architecture diagram
- clear ownership boundaries
- numbered or labeled flows
- restrained palette
- no decorative shadowing
- system layers as first-class structure

## Direction for v2

Create a paper-style architecture figure with four horizontal layers:

1. Work lifecycle control plane
2. Agent adapter / selected coding agent
3. Sandbox execution substrate
4. External systems and outputs

Use an inset on the left for the baseline:

`Task -> Agent -> Sandbox -> PR`

with a small note:

`No durable lifecycle owner`

Use numbered flows:

1. assign task
2. provision sandbox
3. start selected agent
4. execute tools
5. observe effects
6. checkpoint / recover
7. approval / policy decision
8. publish PR + run evidence

Use line styles:

- solid blue: control flow
- solid dark: execution / action flow
- dashed dark: observation and checkpoint feedback
- red/orange: approval boundary

No shadows. No oversized title. Caption can live outside the image or be small at the bottom.

