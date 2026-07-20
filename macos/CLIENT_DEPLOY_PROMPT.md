# QQ_agentshow 客户部署提示词

把完整的 `QQ_agentshow 安装包.zip` 与下面提示词一起交给客户自己的 macOS Codex。不要只发送图片或 CSS；隐藏引擎目录是完整产品。

```text
你是我这台 Mac 上的 QQ_agentshow 部署工程师。请直接完成安装、自检和实机验收，不要只给教程，也不要在没有验证证据时声称完成。

目标：
- 给官方 ChatGPT / Codex Desktop 安装 QQ2007 风格 Agent Show；
- 保留原生项目、任务、消息、代码、Diff、审批、附件和输入功能；
- 右栏只使用当前本机 Codex 的真实对话与环境数据，不得生成假好友、假聊天或假统计；
- 使用透明企鹅宠物、可替换 QQ 秀和可配置模板；
- 不修改官方 app、app.asar、签名、会话、API Key 或模型配置；
- CDP 只绑定 127.0.0.1，且只处理身份核验通过的官方 Codex 和注入器进程。

请按顺序执行：

1. 找到并完整解压“QQ_agentshow 安装包.zip”。包含空格或中文的路径必须正确引用。
2. 阅读隐藏引擎中的 README.md、SKILL.md、CHANGELOG.md 和 NOTICE.md。
3. 确认官方 Codex 至少启动过一次，然后完全退出 Codex。
4. 运行隐藏引擎的 scripts/install-dream-skin-macos.sh --check；不通过时停止并报告原因。
5. 预检通过后运行 scripts/install-dream-skin-macos.sh --no-launch。首次安装会选择 preset-codex-1907-deep；更新时保留用户当前主题，不得强制切换。
6. 用 scripts/start-dream-skin-macos.sh --prompt-restart 启动。
7. 默认保留 classic-chat、calm、real 和 completion-sound on。公开演示时必须把 conversation-preview 改为 masked 或 off。
8. 如有自定义企鹅，只接受同时含透明像素和可见像素的 PNG；方形底图必须拒绝。QQ 秀可以用普通 PNG/JPEG/WebP。
9. 运行 doctor-macos.sh --require-live 和 verify-dream-skin-macos.sh。verify 必须真实返回 pass: true。
10. 检查顶部导航、左侧项目/任务、中央原生对话与输入、右侧 Agent Show、原版换肤返回、企鹅随机动作和完整恢复入口。

最终汇报版本、实际模板与隐私模式、tests/doctor/verify 结果、安装目录、恢复命令，并明确说明官方 app 和 app.asar 未修改。若尚未 pass: true，请继续修复，不要提前结束。
```
