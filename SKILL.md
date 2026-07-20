---
name: QQ_agentshow
description: Install, configure, verify, update, or safely remove the QQ2007-style Agent Show for the official Codex desktop app on macOS. Use for a real-data right rail, configurable QQ Show, transparent animated penguin pet, task-completion and human-confirmation sounds, privacy modes, or restoring the native Codex appearance.
compatibility: macOS; official ChatGPT or Codex desktop app; signed bundled Node.js 20+
---

# QQ_agentshow

Use this Skill when the user wants a QQ2007-style Codex workspace or needs help operating an existing QQ_agentshow installation.

## Workflow

1. Resolve every relative path against the directory containing this `SKILL.md`, change the working directory to that repository/Skill root, then read the [release requirements](docs/RELEASE-REQUIREMENTS.md) and [installation guide](docs/INSTALLATION.md).
2. Confirm the user has opened Codex once, then ask them to quit Codex completely and run `./install.sh --check`.
3. Only after the readiness check passes, run `./install.sh`.
4. Use [configuration](docs/CONFIGURATION.md) to choose layout, conversation privacy, pet motion, sound, profile, and local images.
5. Run the installed verification command and confirm that its final result passes.
6. For failures or an app update, follow [troubleshooting](docs/TROUBLESHOOTING.md).
7. If the user asks to stop or remove the skin, run `~/.codex/codex-dream-skin-studio/scripts/restore-dream-skin-macos.sh --restore-base-theme --restart-codex` (`./restore.sh` is also available in a repository checkout); never edit the official app bundle.

## Product rules

- Keep native Codex project, task, message, Diff, approval, attachment, and composer nodes intact.
- Show only current local Codex data. Never invent friends, conversations, task counts, outputs, or sources.
- Use `masked` or `off` for screenshots, demos, streams, or any public environment.
- Require a transparent PNG for a custom pet; reject square-background images instead of presenting them as a cutout.
- Respect reduced-motion preferences and allow pet motion and both local notification sounds to be disabled independently.
- Keep CDP loopback-only and verify the official bundle, signer, runtime, port owner, and renderer target.
- Never modify `ChatGPT.app`, `Codex.app`, `app.asar`, signatures, API keys, provider settings, or user conversations.
- Do not publish local screenshots or configuration until `(cd macos && npm run privacy)` passes; visually inspect every public screenshot separately because the scanner cannot read pixels.

## Quick commands

```bash
./install.sh --check
./install.sh
~/.codex/codex-dream-skin-studio/scripts/verify-dream-skin-macos.sh
~/.codex/codex-dream-skin-studio/scripts/restore-dream-skin-macos.sh --restore-base-theme --restart-codex
```

The current release, compatibility boundary, attribution, and security model are documented in [README](README.md), [privacy](docs/PRIVACY.md), and [NOTICE](NOTICE.md).
