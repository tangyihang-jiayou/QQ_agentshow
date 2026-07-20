# QQ_agentshow · macOS 引擎

这里是 QQ_agentshow 的 macOS 安装、注入、验证和恢复引擎。独立安装步骤见 [安装指南](docs/INSTALLATION.md)，QQ2007 个性化说明见 [QQ2007 指南](../docs/CODEX-1907.md)。打包脚本会改写仓库外层文档链接。

## 常用命令

```bash
# 安装前只读检查（先完全退出 Codex）
./scripts/install-dream-skin-macos.sh --check

# 安装但暂不启动
./scripts/install-dream-skin-macos.sh --no-launch

# 仅在你主动想换回默认预设时选择；更新不会自动切换主题
~/.codex/codex-dream-skin-studio/scripts/switch-theme-macos.sh \
  --id preset-codex-1907-deep --no-apply

# 启动或重启应用皮肤
~/.codex/codex-dream-skin-studio/scripts/start-dream-skin-macos.sh \
  --restart-existing

# 验证
./scripts/verify-dream-skin-macos.sh

# 恢复官方外观
./scripts/restore-dream-skin-macos.sh \
  --restore-base-theme --restart-codex
```

## 开发检查

```bash
npm test
node scripts/injector.mjs --check-payload \
  --theme-dir presets/preset-codex-1907-deep
```

运行时只使用官方 Codex.app 内签名的 Node.js，通过回环 CDP 注入 CSS 与非交互装饰节点，不修改应用包、`app.asar` 或代码签名。

独立安装会携带两段经过处理的历史 QQ 提示音及其触发逻辑：主 Agent 从运行转为成功完成时播放完成声，首次出现原生人工确认操作时播放确认声；底部状态栏可分别试听。
