# QQ2007 深度主题

`preset-codex-1907-deep` 是 QQ_agentshow 的主预设。ID 中保留 `1907` 仅用于兼容早期安装；视觉目标是 XP Luna、QQ2007 与 Office 2003 风格。

资料名优先读取当前 Codex 账号显示名，读取不到时才使用通用昵称「Codex 小企鹅」。底栏默认签名为「不要迷恋哥，哥只是个传说」，点击可在 13 条经典签名中切换。右栏从上到下为企鹅与资料、真实最近对话、环境信息和 QQ 秀；不会创建“我的好友”“智能伙伴”或虚假的联系人列表。

普通回复保持 Codex 原生结构，不附加伪造头像、时间和气泡。真实代码块使用复古蓝灰边框，并保留语言、复制与语法高亮。多图上传继续使用原生附件节点：发送前逐张显示和删除，发送后保持原比例画廊。左侧项目、任务、置顶、折叠和账号区域继续使用原生节点与行为。

## 视图切换

深度版顶部「换肤」进入原版 Codex；原版左上角的小型「换肤」按钮返回深度版。选择保存在本机。完整恢复：

```bash
~/.codex/codex-dream-skin-studio/scripts/restore-dream-skin-macos.sh \
  --restore-base-theme --restart-codex
```

## 个性化

```bash
~/.codex/codex-dream-skin-studio/scripts/personalize-codex-2007-macos.sh \
  --nickname "Codex 小企鹅" \
  --signature "这是我的自定义签名" \
  --level "255" \
  --status busy \
  --agent-layout workbench \
  --pet-motion playful \
  --conversation-preview masked \
  --completion-sound off \
  --assistant "/path/to/transparent-pet.png" \
  --qq-show "/path/to/qq-show.png"
```

参数可单独使用。自定义企鹅必须是透明 PNG，QQ 秀支持常见静态图片。完整说明见 [配置手册](CONFIGURATION.md)。

## 兼容边界

深度版依赖当前 Codex DOM。应用升级后可能需要更新选择器；验证失败时可立即切回原版。主题不会修改 `.app`、`app.asar`、代码签名、会话或模型配置。
