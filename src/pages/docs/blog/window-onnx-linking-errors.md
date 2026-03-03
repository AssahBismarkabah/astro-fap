---
layout: ../../../layouts/BlogPostLayout.astro
title: Windows ONNX Runtime Linking Errors
date: 2026-01-30
description: Solving LNK2019 errors when building Rust projects with ONNX Runtime on Windows CI.
category: technical
tags: ["rust", "ci", "windows", "debugging"]
---

# Windows ONNX Runtime Linking Errors: A CI Debugging Story

I was setting up a [GitHub Actions](https://github.com/features/actions) pipeline for a Rust project that uses [`fastembed`](https://github.com/Anush008/fastembed-rs) for embedding generation. Linux and macOS built fine. Windows? Not so much.

What should have been a straightforward cross-platform build turned into a deep dive into how Windows handles C runtime linking—something most developers never think about until it breaks.

## The Error Wall

The pipeline started failing with a cascade of linker errors:

```
error LNK2019: unresolved external symbol __imp_tolower
error LNK2019: unresolved external symbol __imp_ldexp
error LNK2019: unresolved external symbol __imp__wsopen_s
error LNK2019: unresolved external symbol __imp__fstat64i32
error LNK2019: unresolved external symbol __imp__sopen_s
```

That `__imp_` prefix is the critical clue I initially missed. In Windows parlance, `__imp_` means the linker is looking for [DLL import symbols](https://learn.microsoft.com/en-us/cpp/build/importing-into-an-application-using-declspec-dllimport)—it expects to dynamically link against these functions. But something in the build was providing static CRT libraries instead.

When you mix dynamic and static linking for the C runtime on Windows, the linker can't reconcile the different symbol conventions. Hence the wall of `LNK2019` errors.

## Understanding the CRT Mismatch

The [C Runtime Library (CRT)](https://learn.microsoft.com/en-us/cpp/c-runtime-library/crt-library-features) on Windows can be linked in two ways:

- **Dynamic linking (`/MD` flag)**: Your binary links against `msvcrt.dll` at runtime. Smaller binaries, shared runtime across all DLLs in a process.
- **Static linking (`/MT` flag)**: The CRT is embedded directly into your binary. Larger binaries, but no runtime DLL dependencies.

The problem emerges when different components disagree on which mode to use:

1. The [pre-built ONNX Runtime binaries](https://github.com/pykeio/ort) from pyke are compiled with **dynamic CRT** (`/MD`)
2. [cargo-dist](https://opensource.axo.dev/cargo-dist/) defaults to **static CRT** (`msvc-crt-static = true`) for maximum portability
3. When you link them together, the linker sees incompatible symbol tables and fails

There's also a secondary issue lurking. Newer ONNX Runtime builds use C++ standard library features that require [Visual Studio 2022 17.13+](https://devblogs.microsoft.com/cppblog/). Specifically, some `__std_*` symbols in the C++ standard library implementation aren't present in older toolchains. The default Windows runner image might not have a recent enough version.

## The Fix

If you're using [cargo-dist](https://opensource.axo.dev/cargo-dist/) for distribution, add this to your `dist-workspace.toml`:

```toml
[dist]
msvc-crt-static = false
```

And specify the latest Windows runner to ensure you have a recent Visual Studio installation:

```toml
[dist.github-custom-runners]
x86_64-pc-windows-msvc = "windows-latest"
```

For manual CI configurations, you can set `RUSTFLAGS` in your workflow:

```yaml
env:
  RUSTFLAGS: "-C target-feature=-crt-static"
```

Or configure it permanently in `.cargo/config.toml`:

```toml
[target.x86_64-pc-windows-msvc]
rustflags = ["-C", "target-feature=-crt-static"]
```

## Why This Works

The `-crt-static` target feature (note the minus sign—it's disabling static CRT) tells the Rust compiler to use dynamic CRT linking (`/MD`). This makes your Rust code's linking mode match the pre-built ONNX Runtime binaries.

When both components agree on dynamic linking:
- All symbols use the `__imp_` prefix convention
- The linker finds what it expects
- Everything links successfully

The tradeoff is that your binary now depends on the Visual C++ runtime DLLs being present on the target system. For most Windows machines this isn't an issue—[the redistributable](https://learn.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist) is widely installed. But for truly standalone distribution, you may need to bundle it or use an installer.

## The Broader Lesson

When your Rust project pulls in pre-built C/C++ libraries (through `-sys` crates or binary downloads), you're inheriting their build configuration choices. Most pre-built libraries use dynamic CRT linking because:
- It's the MSVC default
- It produces smaller binaries
- It avoids certain redistribution licensing complexities

If your Rust build defaults to static CRT, you'll hit exactly this linking wall. The fix is always the same: make sure both sides agree on the CRT linking mode.

Before assuming it's a code problem, check the CRT configuration. It's one of those Windows-specific details that rarely matters until it's the only thing that matters.
