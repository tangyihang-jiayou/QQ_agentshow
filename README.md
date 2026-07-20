<p align="center">
  <img src="docs/images/qq-agentshow-cover.png" alt="QQ_agentshow：把 Codex 变成 QQ2007 Agent 工作台" width="100%">
</p>

<h1 align="center">QQ_agentshow</h1>

<p align="center">
  把 macOS Codex Desktop 变成一台会动、会提醒、能真实工作的 QQ2007 Agent 工作台。
</p>

<p align="center">
  <a href="https://github.com/tangyihang-jiayou/QQ_agentshow/releases/latest"><img alt="Release" src="https://img.shields.io/github/v/release/tangyihang-jiayou/QQ_agentshow?style=flat-square&color=2878d0"></a>
  <a href="LICENSE"><img alt="MIT License" src="https://img.shields.io/badge/license-MIT-3a8dd8?style=flat-square"></a>
  <img alt="macOS" src="https://img.shields.io/badge/platform-macOS-173b61?style=flat-square">
  <img alt="local first" src="https://img.shields.io/badge/data-local--first-48ac31?style=flat-square">
</p>

> 非 OpenAI、Tencent 或 QQ 官方项目。QQ_agentshow 不修改 `ChatGPT.app` / `Codex.app`、`app.asar` 或代码签名。

![QQ_agentshow 脱敏实机界面](docs/images/qq-agentshow-preview.png)

## 30 秒安装

先正常打开一次 Codex，然后完全退出，复制运行：

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/tangyihang-jiayou/QQ_agentshow/v2.1.1/install.sh)"
```

安装完成后重新打开 Codex。顶部「换肤」可随时切回官方界面；完整恢复只需运行：

```bash
~/.codex/codex-dream-skin-studio/scripts/restore-dream-skin-macos.sh \
  --restore-base-theme --restart-codex
```

想先看清安装内容，可使用[审阅后安装](docs/INSTALLATION.md)。

## 它不只是换颜色

- **真实 Agent 信息**：右栏读取当前任务、运行状态、产物、来源和当前会话，不伪造好友、回复或数量。
- **QQ2006 / 2007 交互**：玻璃蓝标题栏、像素工具栏、凹凸面板、QQ 等级、经典签名和经典男女 QQ 秀；公开界面不携带维护者个人入口。
- **会动的小企鹅**：透明企鹅会呼吸、点头、挥手、探头、踱步、跳跃；工作中会敲击，完成后会庆祝。
- **两种本地提醒**：主 Agent 完成任务时播放完成声；需要你允许、确认或继续时播放确认声。同一请求只响一次，后台窗口不会乱响。
- **多图可用**：上传前每张图独立显示并可删除，发送后保持原比例进入响应式画廊，不再缩成乱码小图。
- **首页保持顺手**：保留 Codex 原生的“输入框 → 项目与 Plugins → 快捷建议”顺序，把整组上移并收紧间距，小窗口也不留断层。
- **随时收起**：右栏支持展开、收起和关闭；三套布局适配聊天、工作台和小屏幕。

## 右栏三套模板

| 模板 | 信息重点 | 推荐场景 |
| --- | --- | --- |
| `classic-chat` | 企鹅 → 最近对话 → 环境信息 → QQ 秀 | 默认，最像经典 QQ |
| `workbench` | 压缩对话，为环境与产物让出空间 | 编程和长任务 |
| `minimal` | 隐藏最近对话，保留环境与 QQ 秀 | 小屏或专注模式 |

最近对话可选 `real`、`masked` 或 `off`。公开演示建议用 `masked`。

```bash
~/.codex/codex-dream-skin-studio/scripts/personalize-codex-2007-macos.sh \
  --agent-layout workbench \
  --pet-motion playful \
  --conversation-preview masked \
  --completion-sound on
```

更多昵称、签名、企鹅、QQ 秀和布局选项见[配置手册](docs/CONFIGURATION.md)。

## 提醒是怎么触发的

| 场景 | 行为 |
| --- | --- |
| 主 Agent 从运行转为完成 | 播放「完成声」，企鹅跳一下 |
| 页面出现原生允许 / 拒绝 / 确认 / 继续 / 运行 / 提交操作 | 播放「确认声」 |
| 同一确认卡继续重绘 | 不重复播放 |
| Codex 在后台或窗口未聚焦 | 不播放 |

底部「完成声」「确认声」可分别试听。默认使用维护者最终选择的两段历史 QQ 时代提示音：主 Agent 完成任务播放完成声，第一次出现原生人工确认操作时播放确认声。安装包会同时携带声音、触发逻辑和试听入口；处理脚本保留原始时长与辨识度，只做可复现的下混、重采样、去直流、电话频段滤波、软噪声门、瞬态限幅与无爆点淡化。两段发布 WAV 均为 44.1kHz 单声道 PCM、首尾归零并保留播放余量。历史素材不属于 MIT 授权范围，权利边界见 [NOTICE](NOTICE.md) 与 [素材溯源](macos/references/asset-provenance.md)。

## 本地、可恢复、可审阅

- 对话预览和环境信息只从当前本地 Codex 界面读取，不上传、不写回仓库。
- CDP 只绑定数值回环地址，并验证监听进程与目标属于官方 Codex 应用。回环可阻止局域网访问，但 Chromium 调试端口没有独立认证；启用皮肤时，同一 macOS 用户权限下的其他本地进程仍可能访问 renderer 内容或执行调试操作。不要与不可信本地软件同时使用，结束后可恢复官方外观以关闭端口。
- 安装器使用官方应用自带且签名有效的 Node.js，不下载额外运行时。
- `npm run privacy` 会拦截用户目录、邮箱、常见令牌和私钥形态；截图还必须逐张人工检查像素内容与再分发权。
- 更新后若暂时不兼容，可点「换肤」或运行恢复脚本，不需要修补应用包。

详见[隐私说明](docs/PRIVACY.md)、[故障排查](docs/TROUBLESHOOTING.md)和[平台说明](docs/platforms.md)。

项目的完整产品边界、安装契约和发布门槛统一维护在[发布需求与验收标准](docs/RELEASE-REQUIREMENTS.md)中；它是实现、审查和发布结论的唯一事实真相。

## 作为 Codex Skill 使用

仓库根目录的 [SKILL.md](SKILL.md) 是正式的 `QQ_agentshow` Skill 入口，包含安装、配置、验证、排错和恢复流程。它只引用本仓库内可审阅的脚本，不依赖隐藏服务。

## 开发与发布检查

```bash
cd macos
npm test
npm run privacy
npm run skill:check
```

## 来源与许可

本项目从 [Fei-Away/Codex-Dream-Skin](https://github.com/Fei-Away/Codex-Dream-Skin) 的 macOS 运行引擎继续开发，软件代码沿用 MIT License。默认企鹅、QQ 秀和提示音是维护者选择的历史 QQ 时代怀旧素材，并非项目原创或腾讯官方授权；它们不属于 MIT 授权范围。`Codex`、`OpenAI`、`QQ`、`Tencent` 及相关标识归各自权利人所有。详见 [NOTICE](NOTICE.md) 与[素材来源记录](macos/references/asset-provenance.md)。
