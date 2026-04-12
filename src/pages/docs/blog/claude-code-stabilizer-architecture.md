---
layout: ../../../layouts/BlogPostLayout.astro
title: Stabilize Claude Code for Open-Weight Models
date: 2026-04-12
description: A three-layer proxy stack to keep Claude Code stable when routing through LiteLLM to open-weight models.
category: technical
tags: ["ai", "tooling", "litellm", "architecture", "claude-code"]
---

Running Claude Code with open-weight models like DeepSeek or Qwen through a LiteLLM proxy works. Until it doesn't. The port changes every time LiteLLM restarts because it picks a random dynamic port. The request payload grows until backends reject it with 400 errors. Usage stats come back null and the UI crashes. You can fix each one individually, but the next restart or a long conversation session brings it back.

The right approach is treating it as a proper service stack, not a list of config patches. A Flask proxy pins the port on 4000, a Python hook trims the payload before it hits the backend, and string-level response patching fixes null usage stats on the wire.

## Directory structure

```
~/.config/litellm/
├── config.yaml          # LiteLLM Model Config
├── venv/                # Python Virtual Environment
└── service/
    ├── app.py           # LiteLLM Programmatic Entry
    ├── hook.py          # Payload intercept
    ├── stabilizer.py    # Port pinning and response patching
    └── start.sh         # Launch script
```

## The core config

The `config.yaml` maps model names to provider endpoints. The `drop_params: true` setting strips Anthropic-specific parameters like `thinking` and `top_k` that confuse OpenAI-compatible backends.

```yaml
# ~/.config/litellm/config.yaml
general_settings:
  master_key: sk-litellm-local-master-key
litellm_settings:
  proxy_config: 'hook.proxy_config'
  drop_params: true
model_list:
  - model_name: qwen3p6-plus
    litellm_params:
      model: openai/qwen3p6-plus
      api_base: https://your-gateway.com/v1
      api_key: your-api-key
  - model_name: deepseek-v3p2
    litellm_params:
      model: openai/deepseek-v3p2
      api_base: https://your-gateway.com/v1
      api_key: your-api-key
```

The `openai/` prefix tells LiteLLM to use OpenAI Chat Completions format when forwarding.

## The port anchor

LiteLLM picks random dynamic ports on startup. Claude Code needs a stable endpoint. The fix is a Flask proxy on a fixed port that discovers LiteLLM's actual port at runtime and forwards everything through.

```python
# ~/.config/litellm/service/stabilizer.py
import subprocess, re, threading, requests, json, os
from flask import Flask, request, Response

app = Flask(__name__)
TARGET_PORT = None

@app.route('/', defaults={'path': ''}, methods=['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD'])
@app.route('/<path:path>', methods=['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD'])
def proxy(path):
    global TARGET_PORT
    if not TARGET_PORT: return "Initializing...", 503
    
    url = f"http://127.0.0.1:{TARGET_PORT}/{path}"
    headers = {k: v for k, v in request.headers if k.lower() != 'host'}
    
    try:
        resp = requests.request(
            method=request.method, url=url, headers=headers, data=request.get_data(),
            stream=True, timeout=300
        )
        
        def generate():
            for chunk in resp.iter_content(chunk_size=None):
                if not chunk: continue
                # HEAL: String-level replacement to prevent UI crashes
                chunk = chunk.replace(b'"usage": null', b'"usage": {"input_tokens": 1, "output_tokens": 1}')
                chunk = chunk.replace(b'"input_tokens": null', b'"input_tokens": 1}')
                yield chunk

        return Response(generate(), resp.status_code, content_type=resp.headers.get('content-type'))
    except Exception as e:
        return f"Proxy Error: {str(e)}", 502

def run_litellm():
    global TARGET_PORT
    cmd = ["/Users/YOUR_USER/.config/litellm/venv/bin/python3", "app.py"]
    env = os.environ.copy()
    env["PYTHONPATH"] = "/Users/YOUR_USER/.config/litellm/service"
    process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, env=env)
    for line in iter(process.stdout.readline, ''):
        if "Uvicorn running on" in line:
            TARGET_PORT = re.search(r":(\d+)", line).group(1)

if __name__ == "__main__":
    threading.Thread(target=run_litellm, daemon=True).start()
    app.run(host='127.0.0.1', port=4000, threaded=True)
```

Claude Code always hits port 4000. The stabilizer figures out where LiteLLM is actually running and bridges the gap. No more updating environment variables when the port changes.

## Trimming the payload

Claude Code injects its full system prompt, tool definitions, and conversation history into every request. Backends reject payloads with token counts above their limits or histories that have grown too long. A pre-call hook inside LiteLLM intercepts and mutates requests before translation.

```python
# ~/.config/litellm/service/hook.py
from litellm.proxy.proxy_server import ProxyConfig

class CustomProxyConfig(ProxyConfig):
    async def pre_call_hook(self, user_api_key_dict, data, call_type, **kwargs):
        if "max_tokens" in data: data["max_tokens"] = 4096
        data["stream"] = True
        
        if "messages" in data:
            if len(data["messages"]) > 100:
                data["messages"] = data["messages"][:10] + data["messages"][-90:]
            for msg in data["messages"]:
                if isinstance(msg, dict):
                    msg.pop("cache_control", None)
                    msg.pop("metadata", None)
        
        for key in ["top_k", "top_p", "output_config", "thinking", "betas"]:
            data.pop(key, None)
        return data

proxy_config = CustomProxyConfig()
```

The hook caps tokens under 4096 and forces streaming. It keeps the first 10 messages and the most recent 90, trimming the middle of long conversations. Anthropic-specific parameters like `thinking`, `cache_control`, and `betas` get stripped since OpenAI-compatible backends don't understand them.

The `drop_params: true` in the config is a belt-and-suspenders measure. The hook strips parameters before routing, and `drop_params` strips whatever the hook misses after routing.

## Fixing response crashes

Some backends send `null` for usage stats or omit them entirely. Claude Code reads those stats and crashes when it gets `undefined is not an object (evaluating '_.input_tokens')`. The fix lives inside the stabilizer's `generate()` function as string-level replacement on the raw response bytes.

```python
chunk = chunk.replace(b'"usage": null', b'"usage": {"input_tokens": 1, "output_tokens": 1}')
chunk = chunk.replace(b'"input_tokens": null', b'"input_tokens": 1}')
```

Fake-but-valid usage stats keep the UI from crashing. The exact numbers don't matter. It just needs the properties to exist so the JavaScript doesn't throw on null access. This lives in the stabilizer rather than the LiteLLM hook because the hook operates on the request side. The response comes back as raw SSE chunks from the backend, bypassing LiteLLM's normalizers.

## Keeping it running

A shell script wraps the startup:

```bash
#!/bin/bash
# ~/.config/litellm/service/start.sh
export PYTHONPATH="/Users/YOUR_USER/.config/litellm/service"
/Users/YOUR_USER/.config/litellm/venv/bin/python3 /Users/YOUR_USER/.config/litellm/service/stabilizer.py
```

On macOS, a LaunchAgent keeps it alive across reboots:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key><string>com.user.litellm</string>
    <key>ProgramArguments</key>
    <array><string>/Users/YOUR_USER/.config/litellm/service/start.sh</string></array>
    <key>RunAtLoad</key><true/>
    <key>KeepAlive</key><true/>
    <key>StandardOutPath</key><string>/tmp/litellm.log</string>
</dict>
</plist>
```

`KeepAlive` means if the stabilizer or LiteLLM crashes, macOS restarts it automatically. The whole stack runs as long as the machine is on.

## Shell aliases

With the stabilizer running on port 4000, shell aliases route specific models through:

```bash
_claude_via_litellm() {
  local model_id="$1"
  shift
  env -u ANTHROPIC_API_KEY \
  ANTHROPIC_BASE_URL=http://localhost:4000 \
  ANTHROPIC_AUTH_TOKEN=sk-litellm-local-master-key \
  ANTHROPIC_MODEL="$model_id" \
  ANTHROPIC_DEFAULT_HAIKU_MODEL="$model_id" \
  CLAUDE_CODE_SUBAGENT_MODEL="$model_id" \
  claude "$@"
}
alias claude-qwen='_claude_via_litellm qwen3p6-plus'
alias claude-deepseek='_claude_via_litellm deepseek-v3p2'
```

`env -u ANTHROPIC_API_KEY` unsets any existing API key so Claude Code doesn't try to use both the proxy auth and a direct key simultaneously. `ANTHROPIC_DEFAULT_HAIKU_MODEL` and `CLAUDE_CODE_SUBAGENT_MODEL` force background tasks and subagents to use the same proxy model instead of silently failing when they try to call Anthropic-specific models that don't exist on the proxy.

The config maps model names to provider endpoints. The hook mutates request payloads. The stabilizer pins the port and patches responses. Port drift and response-format bugs hit the stabilizer. Token-limit and parameter-incompatibility bugs hit the hook. Open-weight models don't match the Anthropic spec cleanly enough for a single fix to close the gap. The stabilizer and hook run together on every request.
