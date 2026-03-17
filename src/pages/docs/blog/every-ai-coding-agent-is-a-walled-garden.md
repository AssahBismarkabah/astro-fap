---
layout: ../../../layouts/BlogPostLayout.astro
title: AI coding agents and the cloud provider auth problem
date: 2026-03-15
description: Desktop AI coding agents don't work with cloud provider auth. A local proxy fixes all of them at once.
category: technical
tags: ["ai", "tooling", "litellm", "developer-experience"]
---

The current generation of AI coding agents ships with a shared assumption: you have an API key from Anthropic, OpenAI, or Google, and you paste it into a settings field. That works if you pay for a direct subscription. It does not work if your organization routes model access through a cloud provider like AWS Bedrock, Google Vertex AI, or Azure OpenAI.

I spent a day installing and configuring every major desktop coding agent, trying to connect them to Claude models through a cloud provider. None of them worked. The failures were different in each tool but the root cause was the same: desktop apps speak one authentication protocol, and cloud providers speak another.

## the protocol mismatch

Cloud providers do not use API keys the way desktop apps expect. AWS Bedrock authenticates with SigV4 request signing. Google Vertex AI uses OAuth 2.0 service account tokens. Azure OpenAI uses AD bearer tokens. These are enterprise auth mechanisms designed for SDK access, not for Electron apps with a text field.

Desktop coding agents implement one auth flow: API key + base URL. You paste a key, set an endpoint, and the app sends requests in OpenAI or Anthropic message format.

But the gap goes beyond authentication. AWS Bedrock does not accept requests in Anthropic Messages API format. It uses its own Converse API. So even if you solve auth, the request body is wrong. The endpoint receives something it does not understand and fails silently.

Two layers of incompatibility. The auth mechanism is wrong, and the wire format is wrong. Both need to be solved at the same time.

## how desktop agents fail

The failures fall into two patterns.

The first is auth blocking. Apps strip cloud provider environment variables before they reach the underlying SDK, or lock the desktop version to a single auth flow while the CLI supports custom providers. On macOS, GUI apps cannot see environment variables from your shell profile at all. Electron and Tauri apps ignore `.zshrc` exports, and `launchctl setenv` is unreliable on newer macOS versions. Even if the SDK supports cloud auth, the desktop shell blocks it.

The second is format mismatch. Some apps have custom endpoint fields where you can paste a cloud provider URL and key. But they send requests in Anthropic or OpenAI format. The cloud endpoint does not understand that format. The request goes out, the provider cannot parse it, nothing comes back.

The only tools that work natively are CLI tools that bundle the cloud SDK and desktop apps that read credentials from config files. Both require the vendor to implement cloud provider support explicitly. Everything else is stuck.

## a local translation layer

Waiting for every tool to add native support for every cloud provider is not a strategy. The alternative is a translation layer, a local proxy that accepts requests in the format the app speaks and forwards them in the format the provider expects.

This is an old pattern. Nginx translates between HTTP and upstream protocols. API gateways translate between public and internal service formats. When two systems speak different protocols, you put a translator in the middle.

[LiteLLM](https://github.com/BerriAI/litellm) does this for LLM APIs. It accepts OpenAI-compatible requests on a local port and forwards them to over 100 provider backends, handling auth, format conversion, and response normalization. Open source, zero cost beyond the provider's token pricing.

## setting it up

LiteLLM runs as a persistent local proxy:

```
Desktop App  -->  LiteLLM (localhost:4000)  -->  Cloud Provider  -->  Model
              OpenAI format / API key        SigV4, OAuth, AD tokens
```

Install in an isolated virtual environment:

```bash
python3.12 -m venv ~/.config/litellm/venv
~/.config/litellm/venv/bin/pip install 'litellm[proxy]'
```

The config maps friendly model names to provider identifiers:

```yaml
model_list:
  - model_name: claude-sonnet
    litellm_params:
      model: bedrock/us.anthropic.claude-sonnet-4-6
      aws_region_name: us-west-2

  - model_name: claude-haiku
    litellm_params:
      model: bedrock/us.anthropic.claude-haiku-4-5-20251001-v1:0
      aws_region_name: us-west-2

litellm_settings:
  drop_params: true

general_settings:
  master_key: sk-your-local-key-here
```

`drop_params: true` strips parameters the provider does not support, so tools that send extra fields do not cause rejections. The `master_key` is local-only auth for the proxy itself. No cloud credentials go in this file. The proxy reads them from `~/.aws/credentials` via the SDK's default credential chain.

On macOS, a Launch Agent starts the proxy on login and restarts it if it crashes. Single Python process, negligible resource usage. Set it up once and forget about it.

## using it

Every desktop app gets the same three values: base URL `http://localhost:4000`, the master key, and a model name like `claude-sonnet`. Find the custom endpoint section in the app's settings, paste those values, and it works. The app thinks it is talking to OpenAI. The proxy handles everything else.

All agentic features work through it. Streaming, tool calling, file editing, bash execution, MCP servers, sessions. The proxy only touches the model API call. It is invisible to the orchestration layer above it.

## not just one provider

Switch the model prefix from `bedrock/` to `vertex_ai/` or `azure/` and the same proxy serves the same tools. The pattern applies anywhere enterprise auth and desktop app auth do not match.

The AI coding agent ecosystem is fragmenting fast. New tools ship monthly with their own auth assumptions. Cloud providers add another layer of incompatibility. You can wait for convergence, or you can add a translation layer that works today and becomes unnecessary if native support arrives later.

When two systems speak different protocols, put a translator in the middle.
