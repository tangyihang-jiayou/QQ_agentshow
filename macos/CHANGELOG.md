# Changelog

## 2.1.1 — 2026-07-20

- Replaced the two default notifications with the maintainer's final historical QQ-era selections (`595.wav` for task completion and `1710.wav` for human confirmation). The deterministic decoder now accepts their original 8/16-bit mono/stereo PCM formats, and the processed outputs add telephone-band filtering, a soft noise gate, stricter slew limiting, zero-boundary fades, install-payload checks, provenance, spectrum checks, and overlapping-playback regression coverage while preserving each cue's timing and recognizable character. Web Audio playback now also ramps the first 8ms and final 18ms at the gain node so device resampling cannot reintroduce an edge click.
- Restored the historical blue-headphone penguin and classic female/male QQ Show defaults, with explicit third-party rights boundaries and local replacement support.
- Removed the personal “我的” QQ Show control from the public UI while preserving local custom-image configuration, and bumped the dock template revision so updates rebuild older three-button markup automatically; also fixed mid-height right-rail clipping, profile status consistency, Recents zero state, and safer completion/confirmation deduplication.
- Made a locally configured custom QQ Show immediately visible without restoring a personal public button; fresh installs still default to the classic female QQ Show and explicit local female/male choices remain persistent.
- Fixed the QQ2007 composer pulling a long conversation downward on every keystroke or Chinese IME composition update while the user was reading history. Stable composer nodes are no longer reclassified on text mutations, and a scoped reading-position guard now preserves history only during deep-skin text input while yielding immediately to navigation keys, wheel/touch/pointer intent, restore/uninstall cleanup, bottom follow, and native Codex behavior.
- Fixed live acceptance of native generated-image carousels: fully clipped `aria-hidden` slides and stale boxes outside the thread viewport are no longer reported as page overflow, while visible images and user-upload galleries remain strictly bounded.
- Hardened first install, update, backup validation, concurrent installation, launcher collisions, loopback ownership, standalone staging, restoration idempotency, and uninstall file ownership.
- Minimized verification evidence, sanitized all screenshots by default, documented the same-user CDP boundary, preserved upstream MIT notices, and completed asset provenance.
- Pinned public installation to a verified Release archive and pinned GitHub Actions dependencies by commit.

## 2.1.0 — 2026-07-20

- 将合成“咳咳”声替换为两段本地内嵌的复古 WAV：任务完成使用 1.02 秒完成提醒，等待人工确认使用 0.68 秒短促提示。
- 新增等待确认检测：只识别当前主 Codex 窗口中的原生允许、拒绝、确认、继续、运行和提交动作；同一确认卡片只提醒一次。
- 底部状态栏新增“完成声 / 确认声”两个独立试听按钮，自动提示和试听使用完全相同的音频文件。
- 通知限定在可见且聚焦的主窗口，避免后台 Codex 窗口或其他任务重复播放。
- 两段音频统一转为 44.1kHz / 16-bit / 单声道 PCM；完成声额外重建原文件的硬削波、移除 4kHz 以上刺耳瞬态并将首尾淡化到零，解决 Web Audio 中的电流声或爆音。
- 新建任务首页保留“输入框 → 项目与 Plugins → 快捷建议”的原生顺序，整组上移并压成首屏可见的 QQ2007 快捷布局；左栏自动展开真实最近任务，不再留下悬空空白。
- 重新设计公开仓库的描述、README、产品封面和实机截图，并加强截图脱敏，覆盖队列中的待处理提示与右栏真实数据。

## 2.0.2 — 2026-07-19

- 底部 QQ 签名改为 13 条经典非主流模板；点击签名可按顺序切换，选择仅保存在本机。
- 名字自动读取当前 Codex 账号显示名，不再把开发者的个性化昵称带进公开默认界面；邮箱不会被当作昵称。
- 继续支持自定义签名：显式配置的内容会作为优先选项，旧版通用默认签名自动迁移到新模板。
- 右上资料卡固定为「Codex 江湖传说」，与底部的本机账号名彻底分开。
- `LVxx` 徽章改为老 QQ 皇冠、太阳、月亮、星星等级图标，新安装默认显示 255 级。
- QQ 秀去掉含义不清的「自」按钮，界面只保留内置的经典女、男两个选择。
- 修复新会话和任务会话中的多图附件错位：每次重绘先清理旧布局标记，并排除附件删除键对发送键识别的干扰；6 张图实机验证为 6 个独立、可删除且不重叠的缩略图。
- QQ 上线“咳咳”声改为复用并先解锁 Web Audio；底部新增「上线声」试听键，任务完成仍自动播放一次。
- 企鹅新增探头、踱步、工作敲击动作；运行中使用更活跃的动作组，完成时继续跳跃庆祝，桌面宠物窗口同步支持同一组随机动作。
- 视觉材料调整为更接近 QQ2006/2007 的浅青蓝玻璃、白色面板、柠檬绿选中态和 1px 凹凸边；像素图标精修并新增声音图标。

## 2.0.1 — 2026-07-19

- 修复已发送图片仍显示为 `184×118` 缩略图的问题：单图按比例放大，多图使用响应式画廊并保留原生点击预览。
- 输入框里的待发送附件继续使用独立紧凑托盘，不再与已发送图片共用尺寸规则。
- QQ 秀新增“经典女 / 经典男”两个内置默认模板，可在右栏即时切换并本地记忆；自定义 QQ 秀仍可继续使用。
- 实机验证新增已发送图片画廊检查，缩略图布局回退会直接判定验收失败。

## 2.0.0 — 2026-07-19

### QQ_agentshow public release

- Rebuilt the right rail as a real Agent Show: transparent penguin and profile, current conversation preview, environment information, and configurable QQ Show.
- Removed fake friends, fake assistant conversations, and placeholder counts; all visible task, output, and source data now comes from the current local Codex view.
- Added `real`, `masked`, and `off` conversation privacy modes.
- Added `classic-chat`, `workbench`, and `minimal` layouts.
- Added calm and playful random pet motion: breathing, sway, nod, wave, hop, work-state activity, and a completion celebration; reduced-motion preferences are respected.
- Added an optional two-part “cough” completion sound.
- Added strict RGBA PNG transparency validation for custom pet cutouts.
- Fixed current ChatGPT/Codex compact composer layout, bilingual navigation, task-title discovery, image/attachment containment, and native-view switching.
- Added the root `QQ_agentshow` Skill, one-command installer, recovery entry point, configuration/privacy/troubleshooting guides, public privacy scanning, and Skill package validation.
- Validated against official ChatGPT / Codex Desktop 26.715.31925 on macOS.

Earlier Dream Skin engine history is available in the upstream project referenced by the repository NOTICE.
