# 安装 QQ_agentshow

## 要求

- macOS，Apple Silicon 或 Intel。
- 从官方渠道安装的 ChatGPT / Codex Desktop。
- 至少正常启动并退出过一次 Codex，使 `~/.codex/config.toml` 存在。
- 安装时完全退出 Codex；脚本不会强行覆盖应用正在保存的配置。

安装前先完全退出 Codex，再做只读预检：

```bash
./install.sh --check
```

预检会验证官方应用签名、内置 Node.js、CPU 架构、Codex 配置、现有主题和退出状态；不会部署文件或改写配置。

## 一键安装

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/tangyihang-jiayou/QQ_agentshow/v2.1.1/install.sh)"
```

安装器会下载公开仓库的当前正式版本，验证平台、Skill 和运行文件，将引擎安装到 `~/.codex/codex-dream-skin-studio`，备份 Codex 基础主题配置，首次安装时选择 QQ2007 预设，再启动 Codex。

## 先审阅再安装

```bash
git clone --branch v2.1.1 --depth 1 https://github.com/tangyihang-jiayou/QQ_agentshow.git
cd QQ_agentshow
./install.sh --check
./install.sh --no-launch
```

之后手动启动：

```bash
~/.codex/codex-dream-skin-studio/scripts/start-dream-skin-macos.sh --prompt-restart
```

## 安装器会改变什么

- 写入 `~/.codex/codex-dream-skin-studio` 和 `~/Library/Application Support/CodexDreamSkinStudio`。
- 在 `~/.codex/config.toml` 中保存所需外观配置，并创建可恢复备份。
- 可选地在桌面创建启动、定制、验证和恢复入口。
- 用数值回环地址上的临时调试端口启动 Codex，并把样式注入当前 renderer。回环阻止局域网访问，但调试端口本身没有独立认证；皮肤运行时，同一 macOS 用户权限下的本地进程仍可能访问 renderer。不要与不可信本地软件同时运行，不使用时请恢复或完全退出。

安装器不会修改官方应用、`app.asar`、代码签名、会话数据、API Key、Base URL 或模型供应商设置。

## 更新

重新执行一键安装即可。更新不会重选默认主题，也不会覆盖已个性化的 Codex 2007 主题、企鹅或 QQ 秀；更新前仍建议自行备份不可替代的原图。发行说明见 [`macos/CHANGELOG.md`](../macos/CHANGELOG.md)。

## 完整恢复

一键安装用户运行：

```bash
~/.codex/codex-dream-skin-studio/scripts/restore-dream-skin-macos.sh \
  --restore-base-theme --restart-codex
```

从 Git 仓库安装的用户也可以运行 `./restore.sh`。

它会停止已验证的注入器、恢复 Codex 基础主题，并正常重启官方应用。安装目录会保留，方便再次启用；如需删除，可在恢复后手动移入废纸篓。
