# 故障排查

## 先看状态

```bash
~/.codex/codex-dream-skin-studio/scripts/status-dream-skin-macos.sh --json --deep
~/.codex/codex-dream-skin-studio/scripts/verify-dream-skin-macos.sh
```

正常状态应包含活动会话、可用的本地调试端口和通过的界面验证。

## Codex 更新后皮肤消失

先完全退出 Codex，再重新执行 README 中固定版本的一键安装命令。Git 仓库用户也可以在对应正式 tag 的检出目录运行 `./install.sh`。安装器会使用新版官方应用中签名的 Node.js，并重新验证 renderer。若验证仍失败，先点顶部「换肤」返回原版，不要修改应用包。

## 右栏太占空间

点击右栏右上角的收起或关闭按钮；状态会保存在本机。也可以选择极简模板：

```bash
~/.codex/codex-dream-skin-studio/scripts/personalize-codex-2007-macos.sh \
  --agent-layout minimal --conversation-preview off
```

## 企鹅仍有方形背景

内置企鹅是透明 PNG。自定义图必须同时含透明像素和可见像素；重新导出为 RGBA PNG 后再使用 `--assistant`。安装器会拒绝没有透明通道、全透明或无法解码的 PNG。

## 图片上传后变形或乱码

主题只改变容器，不改写原生附件节点。发送前，每张图应是独立缩略图并保留右上角删除键；超出宽度时可横向滚动。发送后按原比例进入响应式画廊。若看见输入区突然被撑高、图片消失或多图只剩一张，请更新到当前最新版；主题会在每次原生输入框变化后重新计算布局，不复用旧标记。请勿把 README 效果截图当作主题背景导入。

## 没有最近对话

确认不是 `minimal` 布局，并检查 `conversationPreview` 是否为 `off`。`real` 只读取当前已渲染的本地会话；新任务或空任务会显示明确的空状态，不会生成虚假内容。

## 没听到完成或确认提示

将 `--completion-sound on` 打开，并确认系统未静音。分别点击底部状态栏的「完成声」和「确认声」；显示“已试听”代表两段本地音频都已解锁。完成声只在主 Agent 从运行转为完成时播放；确认声只在原生确认操作首次出现时播放。窗口在后台、未聚焦或同一确认卡重复重绘时不会再次响。

## 声音有电流声或爆音

先更新到 2.1.1 或更高版本。当前两段提示保留历史 QQ 时代素材的时长与辨识度，只由项目脚本做去直流、柔和滤波、保守降增益与淡化。两者均为 44.1kHz、16-bit、单声道 PCM，首尾精确归零并保留余量。重新运行固定版本的一键安装覆盖 `assets/sounds`，再分别点击两个试听键确认。更新会按版本、脚本哈希与进程身份重启旧监听器，避免继续播放旧的内嵌音频；快速重复试听也会先停止上一段，避免叠音。不要直接用系统播放器的音量标准判断 Codex 内音量；主题还会为两种提示分别设置较低播放增益。历史素材的权利边界见仓库 `NOTICE.md`。

## 安全恢复

```bash
~/.codex/codex-dream-skin-studio/scripts/restore-dream-skin-macos.sh \
  --restore-base-theme --restart-codex
```

Git 仓库用户也可以运行 `./restore.sh`。恢复脚本只会停止 PID、路径、参数、启动时间都与状态记录匹配的注入器；身份不匹配时会拒绝发送信号并保留证据。
