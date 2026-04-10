---
layout: ../../../layouts/BlogPostLayout.astro
title: Using Claude Code with any model
date: 2026-03-26
description: Claude Code's toolset works with non-Anthropic models through a local proxy. Here's the setup, the bug, and the tradeoffs.
category: technical
tags: ["ai", "tooling", "litellm", "claude-code", "developer-experience"]
---

Claude Code has the best agentic coding toolset available right now. File editing with diffs, bash execution, grep, glob, MCP server integration, subagents, plan mode. It runs in your terminal, reads your entire codebase, and orchestrates multi-step changes autonomously.

It only speaks Anthropic Messages API. Every request goes to Anthropic's endpoint in Anthropic's format. Point it at anything else and it breaks.

But the toolset isn't model-dependent. The orchestration layer, the part that decides which files to read, which tools to call, how to structure edits, doesn't care what model generates the text. It cares that the API response arrives in the right format. Which means if you put a translation layer between Claude Code and a different model provider, the entire toolset works with that provider's models.

## the setup

[LiteLLM](https://github.com/BerriAI/litellm) runs as a local proxy that accepts Anthropic Messages API requests and translates them to OpenAI Chat Completions format. Claude Code talks to localhost, LiteLLM talks to whatever provider you configure.

```
Claude Code  -->  LiteLLM (localhost:4000)  -->  Any OpenAI-compatible endpoint
Anthropic Messages API    translates format       OpenAI Chat Completions API
```

Two environment variables redirect Claude Code to the proxy:

- `ANTHROPIC_BASE_URL` points to `http://localhost:4000`
- `ANTHROPIC_AUTH_TOKEN` provides the proxy's local master key

The LiteLLM config maps model names to provider endpoints. Here's an example with models from an OpenAI-compatible provider:

```yaml
model_list:
  - model_name: kimi-k2.5
    litellm_params:
      model: openai/kimi-k2.5
      api_base: https://api.example.com/v1
      api_key: your-api-key

  - model_name: deepseek-v3p2
    litellm_params:
      model: openai/deepseek-v3p2
      api_base: https://api.example.com/v1
      api_key: your-api-key

  - model_name: gemini-3.1-pro
    litellm_params:
      model: openai/gemini-3.1-pro
      api_base: https://api.example.com/v1
      api_key: your-api-key

litellm_settings:
  drop_params: true

general_settings:
  master_key: sk-your-local-key
```

The `openai/` prefix tells LiteLLM the target speaks OpenAI format. `drop_params: true` strips parameters the target doesn't support, which matters a lot for this use case.

A shell function makes switching between models painless:

```bash
_claude_via_litellm() {
  env -u ANTHROPIC_API_KEY \
  ANTHROPIC_BASE_URL=http://localhost:4000 \
  ANTHROPIC_AUTH_TOKEN=sk-your-local-key \
  ANTHROPIC_MODEL="$1" \
  ANTHROPIC_DEFAULT_HAIKU_MODEL="$1" \
  CLAUDE_CODE_SUBAGENT_MODEL="$1" \
  claude "${@:2}"
}

alias claude-kimi='_claude_via_litellm kimi-k2.5'
alias claude-gemini='_claude_via_litellm gemini-3.1-pro'
alias claude-deepseek='_claude_via_litellm deepseek-v3p2'
```

A few things to note in the function. `env -u ANTHROPIC_API_KEY` unsets any existing API key to avoid an auth conflict where Claude Code sees both a token and a key and refuses to start. `ANTHROPIC_DEFAULT_HAIKU_MODEL` and `CLAUDE_CODE_SUBAGENT_MODEL` force Claude Code's background tasks and subagents to use the same proxy model. If you don't set these, Claude Code silently tries to call `claude-haiku-4-5-20251001` for background work like file indexing, which doesn't exist on the proxy, and you get 400 errors in the logs with no obvious cause.

With this in place, `claude` runs Claude models directly and `claude-kimi` runs Kimi K2.5 through the proxy. Same toolset, different brain.

## the responses api routing bug

If you follow the steps above and try a prompt, Claude Code will likely hang. The spinner runs for three to four minutes, and either nothing comes back or a truncated response eventually appears. The proxy logs show 200 OK, so the request looks like it succeeds, but the latency is impossibly high.

This is a routing issue inside LiteLLM. When it receives an Anthropic Messages API request, it decides how to forward it based on the provider prefix. For anything with the `openai/` prefix, it checks a hardcoded set:

```python
_RESPONSES_API_PROVIDERS = frozenset({"openai"})
```

Since the provider matches, LiteLLM routes the request to OpenAI's Responses API (`/v1/responses`) instead of Chat Completions (`/v1/chat/completions`). That works fine if your target is actual OpenAI. But if you're pointing at any other OpenAI-compatible endpoint, like a self-hosted model, a third-party provider, or an aggregator, that endpoint almost certainly doesn't implement the Responses API. The request goes to a path that doesn't exist. Some endpoints return a 404, others hang indefinitely.

If you're seeing multi-minute response times or silent failures after setting everything up correctly, this is probably why. The fix requires two things.

First, the environment variable:

```
LITELLM_USE_CHAT_COMPLETIONS_URL_FOR_ANTHROPIC_MESSAGES=True
```

Set this in the LiteLLM process environment before starting the proxy. On macOS with a Launch Agent, add it to the `EnvironmentVariables` dict in the plist file.

Second, you need LiteLLM 1.83.4 or newer. Earlier versions don't respect this variable consistently when Claude Code sends `?beta=true` in the request URL, which routes through the experimental pass-through handler and hits the Responses API regardless of your settings. The March 2026 security patches also brought routing fixes that make this path work properly for non-OpenAI endpoints. If you're on anything older than 1.83.4, upgrade and restart your proxy.

The [LiteLLM documentation for Claude Code](https://docs.litellm.ai/docs/tutorials/claude_non_anthropic_models) doesn't mention any of this because it assumes the target is actual OpenAI or a major cloud provider that implements the Responses API.

## the march 2026 supply chain attack

In March 2026, LiteLLM was hit by a supply chain attack. An attacker called TeamPCP compromised the Trivy CI/CD pipeline, stole the maintainer's PyPI credentials, and published two poisoned versions: 1.82.7 and 1.82.8. Those versions harvested credentials from developer machines. .env files, shell profiles, cached tokens, IDE settings, agent memory stores.

If you ever ran `pip install litellm` between March 19 and March 24, check your version. 1.82.7 and 1.82.8 are the only compromised releases. Both were yanked. 1.82.6 and below are clean. 1.83.0 and above are clean and verified by the LiteLLM team.

The attack matters for this setup because those poisoned versions are exactly when the routing fixes landed in 1.83.x. If you're on 1.82.6 to avoid the attack, you miss the `?beta=true` routing fix. If you upgrade past 1.82.8, you get the routing fix. The gap was narrow.

Verify your version:

```bash
~/.config/litellm/venv/bin/pip show litellm | grep Version
```

If you were on a compromised version, rotate every API key, auth token, and credential that passed through that machine during the window. The poisoned packages exfiltrated to `models.litellm.cloud` and `checkmarx.zone`.

## the max_tokens error

Fixing the routing gets you another wall. Claude Code is greedy with tokens. It injects `max_tokens: 8192` into every request payload, which is the Anthropic maximum. Many OpenAI-compatible backends reject anything above 4096 unless streaming is perfectly formatted. You'll get a 400 Bad Request saying requests with `max_tokens > 4096` must have `stream: true`.

Setting `max_tokens: 4096` in your LiteLLM config won't help. Claude Code's payload is a deeply nested Anthropic JSON structure, and LiteLLM's standard config parameters get overridden or ignored during translation. The proxy passes Claude's 8192 request straight through to the backend, and the backend rejects it.

Same with `drop_params: true`. It handles the `thinking` parameter fine on the Chat Completions path. But if you're pointing at a strict backend like Fireworks AI, `drop_params` alone doesn't cap the token budget or force streaming. You need to intercept the raw dictionary before translation happens.

## the pre-call hook

The reliable fix is a native Python hook inside LiteLLM. It mutates the request payload before any translation or routing decisions are made.

Create `proxy_server.py` in your LiteLLM config directory:

```python
from litellm.proxy.proxy_server import ProxyConfig

class CustomProxyConfig(ProxyConfig):
    async def pre_call_hook(self, user_api_key_dict, data, call_type, **kwargs):
        # Cap tokens under typical gateway limits
        data["max_tokens"] = 4096

        # Force streaming for models that require it
        model_name = data.get("model", "")
        if "deepseek" in model_name or "qwen" in model_name:
            data["stream"] = True

        # Drop Anthropic-specific params that confuse OpenAI backends
        for key in ["top_k", "top_p"]:
            data.pop(key, None)

        return data

proxy_config = CustomProxyConfig()
```

Wire it into your `config.yaml`:

```yaml
litellm_settings:
  proxy_config: 'proxy_server.proxy_config'
  drop_params: true
```

Start LiteLLM with the config directory on the Python path so it can find the module:

```bash
export PYTHONPATH=$PYTHONPATH:~/.config/litellm
nohup ~/.config/litellm/venv/bin/litellm --config ~/.config/litellm/config.yaml --port 4000 > /tmp/litellm.log 2>&1 &
```

The hook handles both problems at once. It caps `max_tokens` below the gateway limit, and forces `stream: True` for models like DeepSeek and Qwen that reject large non-streaming requests. You still want `LITELLM_USE_CHAT_COMPLETIONS_URL_FOR_ANTHROPIC_MESSAGES=True` in your environment. The hook works on either path, but the Chat Completions path is cleaner for proxying Claude Code.

## the thinking parameter

There's a second issue that compounds the first. Claude Code sends a `thinking` parameter when extended thinking is enabled:

```json
{
  "thinking": {
    "type": "enabled",
    "budget_tokens": 10000
  }
}
```

This is Anthropic-specific. Non-Claude models don't understand it, and how LiteLLM handles it depends entirely on which routing path the request takes.

In the Chat Completions path (the one you want), `drop_params: true` strips the parameter before forwarding. The request goes through cleanly and the model never sees it.

In the Responses API path (the default for `openai/` models), LiteLLM translates `thinking` into an OpenAI `reasoning` parameter and forwards it. If the target endpoint doesn't support reasoning, the request either hangs or fails silently. So even with `drop_params: true` enabled, the parameter still reaches the endpoint because it gets translated rather than dropped.

This means the routing fix from the previous section solves two problems at once: it sends requests to the right API path, and it ensures unsupported parameters actually get stripped instead of translated into something equally unsupported.

## the undefined object crash

Even with the routing fix and pre-call hook, some models still crash the Claude Code UI with `undefined is not an object (evaluating '_.input_tokens')`. This is a different problem. It's in the response, not the request.

Claude Code expects the streaming response to end with a clean JSON block of usage statistics: input tokens, output tokens, total tokens. LiteLLM passes whatever the backend returns. If the backend sends malformed usage data or skips it entirely, LiteLLM passes `null` back for the token counts. Claude Code tries to read a property on `null` and crashes.

Models that claim to be OpenAI-compatible but haven't implemented the usage stats format correctly will trip this. GLM-5 is one example. The fix is either to avoid those models with Claude Code, or add response normalization in your LiteLLM hook to inject fake-but-valid usage stats when the backend omits them.

## the 500 error on model groups

Another error you'll see is a 500 Internal Server Error from LiteLLM itself, usually with a message like `Received Model Group=qwen3p6-plus, Available Model Group Fallbacks=None`. This means LiteLLM can't find a matching backend for the model name you sent. The most common cause is a typo in `model_name` in your config, or the proxy loading with an outdated config while your shell alias points to a model that no longer exists in the list. Restart the proxy after any config change and double-check the model name matches exactly what's in `model_list`.

If the model exists but the upstream provider returns a 500, LiteLLM passes it through as-is. That's a provider-side issue. The upstream gateway is overloaded, misconfigured for that model, or rejecting the modified payload from your hook. Check `/tmp/litellm.log` for the actual upstream error.

## what works and what doesn't

| Feature | Status |
|---|---|
| File editing, bash, grep, glob | Works |
| MCP tools | Works |
| Subagents | Works |
| Plan mode | Works |
| Extended thinking | Dropped, Anthropic-specific |
| Prompt caching | Lost, Anthropic-specific |
| Tool use reliability | Depends on model |
| Usage stats | Breaks with non-standard models |

The toolset is fully functional. Every tool Claude Code exposes, file read, file edit, bash, search, MCP, all of it works through the proxy. The tool layer operates on the response content, not on the API format. So if the model says "edit this file at line 42," Claude Code applies that edit the same way regardless of which model generated it.

What changes is the quality of tool use. Claude Code's system prompt includes detailed instructions for when and how to use each tool. Models with strong function calling ability, for example GPT-5.3 Codex, Kimi K2.5, or Gemini 3.1 Pro, follow these instructions well. They pick the right tool, format the arguments correctly, and chain multi-step operations. Weaker models hallucinate tool arguments, pick the wrong tool for the task, or fail to chain operations properly. If you're seeing a model repeatedly call the wrong tool or produce malformed edit instructions, that's a model quality issue, not a proxy issue.

Expect the first request in any session to be slow regardless of model quality. Claude Code sends a massive initial payload: the full system prompt, all tool definitions, MCP tool schemas, and the user message. On a budget endpoint, processing that payload can take 30 seconds to two minutes. Subsequent messages in the same session are faster because the context is already established.

Prompt caching is gone entirely. Anthropic caches the system prompt across requests so repeated messages don't re-process thousands of tokens. Through LiteLLM, every request pays full price for the entire context. If you're on a per-token endpoint, this adds both latency and cost. On flat-rate or free endpoints, it only adds latency.

## the tiered setup

The practical way to use this is both paths at once. Keep direct cloud provider access for Claude models when the task is complex. Use the proxy for cheaper or faster models when the task is simple.

For complex multi-file refactors, architectural changes, or debugging sessions with deep context, use Claude through your cloud provider. The model is specifically trained for Claude Code's tool format and follows instructions precisely. This is where you want maximum reliability.

For quick edits, code explanations, generating boilerplate, or writing tests for existing functions, route through the proxy to whatever model is cheapest or fastest. These tasks don't require perfect tool use reliability. Good enough is good enough.

```bash
# Heavy lifting: Claude via Bedrock (direct)
claude

# Light work: any model via LiteLLM
claude-kimi
claude-gemini
claude-deepseek
```

Claude Code becomes model-agnostic in practice. The same terminal interface, the same tools, the same workflows. Just a different model underneath, chosen based on what the task actually needs.
