# 独立 macOS Release 安装

1. 从 GitHub Release 下载 ZIP，并对照同一 Release 的 `SHA256SUMS.txt` 校验。
2. 完整解压，先打开 Codex 一次，再完全退出。
3. 在解压后的 `QQ_agentshow-macos` 根目录运行只读预检：

```bash
./scripts/install-dream-skin-macos.sh --check
```

4. 预检通过后安装。更新会保留活动主题与已有个性化：

```bash
./scripts/install-dream-skin-macos.sh --no-launch
./scripts/start-dream-skin-macos.sh --prompt-restart
```

如果不需要桌面快捷入口，在预检和安装命令中都追加 `--no-launchers`。

验证：

```bash
~/.codex/codex-dream-skin-studio/scripts/verify-dream-skin-macos.sh
```

完整恢复：

```bash
~/.codex/codex-dream-skin-studio/scripts/restore-dream-skin-macos.sh \
  --restore-base-theme --restart-codex
```

运行时调试端口仅绑定数值回环地址，但没有独立认证；同一 macOS 用户权限下的本地进程仍可能访问 renderer。不要与不可信本地软件同时使用，不使用时请恢复或完全退出。
