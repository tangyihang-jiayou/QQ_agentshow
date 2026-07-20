# Notices

QQ_agentshow is an unofficial macOS customization project. It is not affiliated with, endorsed by, or sponsored by OpenAI, Tencent, or QQ.

## Upstream

This project is derived from the macOS engine in [Fei-Away/Codex-Dream-Skin at commit `e776fa6d5361a2bdd5c1614674397681e7b00874`](https://github.com/Fei-Away/Codex-Dream-Skin/tree/e776fa6d5361a2bdd5c1614674397681e7b00874), distributed under the MIT License. The repository license retains both Janice zhang's project notice and the upstream contributor notice; the original upstream license is also preserved in `macos/LICENSE`.

## Software license

The MIT License applies to the software source code, scripts, CSS, injectors, tests, and project documentation. It does not grant rights to OpenAI, Codex, Tencent, QQ, or other third-party trademarks, product names, logos, application binaries, or trade dress.

## Historical nostalgia artwork and audio

The default penguin, female QQ Show, male QQ Show, and two notification cues are maintainer-supplied historical QQ-era nostalgia materials. They are included because this project intentionally recreates the visual and audible character of desktop QQ 2006/2007. They are not represented as project-original artwork, public-domain material, or officially licensed Tencent assets.

Tencent, QQ, their characters, sounds, logos, and related rights remain the property of their respective owners. The repository's MIT License does **not** grant permission to redistribute or commercially use those third-party materials. This is an unofficial, non-commercial nostalgia project with no affiliation, endorsement, or sponsorship. Downstream distributors are responsible for obtaining any permission their use requires. Every historical default can be replaced locally through the documented customization options.

The bitmap sprite `macos/assets/qq2007-icons.png` is generated from project-original pixel primitives by `macos/scripts/generate-qq2007-icons.mjs`.

The notification source files are retained locally in `macos/assets/sounds/sources/` so the shipped cues can be rebuilt without a network request or system codec. `macos/scripts/generate-notification-sounds.mjs` preserves their historical timing and recognizable timbre while applying only DC removal, gentle filtering, conservative gain, and click-free fades. Both shipped cues are mono 44.1 kHz PCM WAV files. This processing does not create or imply new rights in the underlying recordings.

`docs/images/qq-agentshow-cover.png` is AI-generated project artwork created for the public repository. `docs/images/qq-agentshow-preview.png` is a sanitized runtime preview included for repository documentation only; it contains application UI and must not be imported or redistributed as a theme background.

## Runtime

The project does not redistribute Codex Desktop or Node.js. It validates and uses the Node.js runtime signed and bundled inside the user's official Codex application. Theme injection uses a loopback-only Chromium DevTools Protocol endpoint and does not modify the official application bundle or code signature.
