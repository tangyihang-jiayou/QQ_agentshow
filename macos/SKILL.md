---
name: QQ_agentshow
description: Operate the macOS runtime bundled with the QQ_agentshow Skill, including installation, personalization, live verification, repair, and safe restoration of the official Codex appearance.
compatibility: macOS; official ChatGPT or Codex desktop app; signed bundled Node.js 20+
---

# QQ_agentshow macOS runtime

Use this self-contained entry when the installed runtime or standalone macOS release is opened independently. The full repository also provides a product-level Skill with public installation, privacy, and configuration guides.

## Runtime workflow

1. Resolve every relative path against the directory containing this `SKILL.md`, change the working directory to that standalone engine root, ask the user to open Codex once, then quit it completely.
2. Run `scripts/install-dream-skin-macos.sh --check`. Stop if readiness fails.
3. Run `scripts/install-dream-skin-macos.sh --no-launch`. An update preserves the active theme and existing Codex 2007 personalization.
4. On a fresh install only, the installer selects `preset-codex-1907-deep`; do not switch an updating user back to it.
5. Start with `scripts/start-dream-skin-macos.sh --prompt-restart`.
6. Configure with `scripts/personalize-codex-2007-macos.sh` and verify with `scripts/verify-dream-skin-macos.sh`; the default sound setting enables both task-completion and first human-confirmation cues from the installed local payload.
7. Restore with `scripts/restore-dream-skin-macos.sh --restore-base-theme --restart-codex`.

Never modify the official app bundle, move native Codex content nodes, invent right-rail data, bind CDP beyond loopback, or signal a process whose recorded identity does not match.
