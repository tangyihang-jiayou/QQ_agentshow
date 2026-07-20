# QQ_agentshow 配置手册

所有配置只保存在本机主题目录。命令可以单独使用，也可以组合。

```bash
~/.codex/codex-dream-skin-studio/scripts/personalize-codex-2007-macos.sh [参数]
```

## 右栏模板

| 参数 | 结构 | 推荐用途 |
| --- | --- | --- |
| `--agent-layout classic-chat` | 企鹅、最近对话、环境信息、QQ 秀 | 日常聊天，默认 |
| `--agent-layout workbench` | 环境与产物获得更多空间 | 编程与长任务 |
| `--agent-layout minimal` | 隐藏最近对话，保留环境与 QQ 秀 | 小屏幕或专注模式 |

## 对话隐私

| 参数 | 行为 |
| --- | --- |
| `--conversation-preview real` | 读取当前页面中已显示的真实用户/Agent 文本，不保存、不上传 |
| `--conversation-preview masked` | 只显示双方角色和“内容已隐藏” |
| `--conversation-preview off` | 完全隐藏最近对话模块 |

公开演示、直播和截图请使用 `masked` 或 `off`。

## 企鹅动作与提示音

- `--pet-motion calm`：缓慢呼吸，偶尔点头、摇摆、探头或挥手。
- `--pet-motion playful`：随机动作更频繁，会增加跳跃、踱步和敲击动作；工作中自动使用活跃动作组。
- `--pet-motion off`：不执行随机动作。
- `--completion-sound on|off`：是否启用本地 Agent 提示音；开启后同时覆盖“任务完成”和“等待人工确认”。

系统开启“减少动态效果”时，随机动作会自动停用。底部状态栏有两个独立试听键：

- 「完成声」：主 Agent 从运行转为完成时播放，同时触发企鹅完成跳跃。
- 「确认声」：页面出现 Codex 原生的允许、拒绝、确认、继续、运行或提交操作时播放。

两种提醒都只在当前可见且聚焦的主窗口播放；同一确认请求只提醒一次。试听与自动触发使用相同的内嵌 WAV，不访问网络。任务完成的视觉反馈不依赖声音。

## 个人资料与图片

右栏和底栏名字优先读取当前 Codex 账号显示名；不会读取邮箱。底栏签名默认提供 13 条经典模板，直接点击签名即可切换并保存在本机。`--nickname` 仍作为账号名读取失败时的兜底，也用于最近对话中的 Agent 标签；`--signature` 可加入一条自定义签名。

```bash
~/.codex/codex-dream-skin-studio/scripts/personalize-codex-2007-macos.sh \
  --nickname "Codex 小企鹅" \
  --signature "这是我的自定义签名" \
  --level "255" \
  --status online \
  --assistant "/absolute/path/penguin.png" \
  --qq-show "/absolute/path/qq-show.png"
```

状态支持 `online`、`busy`、`offline`。自定义宠物必须是有可见像素和透明像素的 PNG；带纯色方形背景的图片会被拒绝。QQ 秀支持 PNG/JPEG/WebP，安装时会转换并限制在 16 MB。

## 推荐模板

经典 QQ：

```bash
personalize="$HOME/.codex/codex-dream-skin-studio/scripts/personalize-codex-2007-macos.sh"
"$personalize" --agent-layout classic-chat --pet-motion calm \
  --conversation-preview real --completion-sound on
```

公开展示：

```bash
personalize="$HOME/.codex/codex-dream-skin-studio/scripts/personalize-codex-2007-macos.sh"
"$personalize" --agent-layout workbench --pet-motion playful \
  --conversation-preview masked --completion-sound off
```
