# 平台与运行模型

QQ_agentshow 2.1.1 仅支持 macOS 上的官方 ChatGPT / Codex Desktop。

```text
本机 QQ_agentshow
    │  校验官方签名与本地端口
    ▼
官方 Codex Desktop（不修改 app / asar / 签名）
    │  回环 CDP 注入 CSS 与辅助 DOM
    ▼
原生项目 / 任务 / 对话 / 输入 + QQ2007 外观
```

| 用途 | 路径 |
| --- | --- |
| 安装后引擎 | `~/.codex/codex-dream-skin-studio` |
| 主题与状态 | `~/Library/Application Support/CodexDreamSkinStudio` |
| Codex 配置 | `~/.codex/config.toml`（只管理可恢复的外观项） |
| 默认 CDP | `127.0.0.1:9341`，冲突时选择其他本地端口 |

支持 Apple Silicon 与 Intel。运行时不打包 Node.js，而是校验并使用官方应用内签名、同架构且版本不低于 20 的 Node.js。

Windows 和 Linux 当前不在支持范围；安装器会在改变任何文件前明确退出。
