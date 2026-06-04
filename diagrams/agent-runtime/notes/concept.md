# Concept

## Reader takeaway

Coding agents are moving from local assistants into cloud work environments. A sandbox is necessary, but it is not enough. The missing layer is the runtime/control plane that owns the lifecycle of the work.

## Diagram story

Left side: sandbox-only setup.

The agent receives a task, runs in a sandbox, and may produce a branch or PR. The missing pieces are state, approvals, scoped identity, audit, and recovery.

Right side: agent runtime control plane.

The control plane accepts task sources, creates and supervises the selected agent, gives it a complete sandbox work environment, mediates privileged actions, records state, and emits a PR plus run evidence.

## Accuracy rules

- The runtime orchestrates the agent. It does not necessarily call the model directly.
- The selected coding agent may own its own model loop.
- The sandbox is the execution substrate, not the source of truth.
- The control plane owns lifecycle state and recovery.
- Arrows must distinguish command/control from observation/checkpoint paths.

