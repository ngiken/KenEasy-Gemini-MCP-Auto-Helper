# Gemini MCP Auto Helper

Chrome / Edge Manifest V3 扩展，专为 **Google Gemini (`https://gemini.google.com/*`)** 搭配 MCP 工具使用设计：

1. **自动点击 MCP 权限确认**：优先点击「始终允许 / Always allow」，可选在没有该按钮时回退点击「允许 / Allow」，严格排除「拒绝 / 取消 / 删除」等黑名单按钮。
2. **自动点击「继续」按钮（内置 6 层防刷额度熔断）**：
   - 只匹配明确的「继续 / Continue」类按钮，绝不乱点普通追问建议芯片，也忽略旧历史消息、代码块和侧边栏；
   - 必须等 Gemini 流式输出彻底结束并稳定（默认 1.8 秒）后才触发；
   - **单次任务继续上限**（默认 5 次，发新消息自动归零）；
   - **每日总上限**（默认 30 次/天，跨刷新持久化，次日自动重置）；
   - **完工信号 + 空转指纹检测**：识别「全部完成」等完工文案或连续输出无新进展时自动跳过/熔断；
   - **额度/限流/报错熔断**：检测到 `reached your limit`、`额度已用完`、`稍后再试` 等提示立即全局停止。
3. **后台静默运行（无需开着屏幕盯着）**：
   - MV3 Service Worker（`background.js`）通过长连接 Port + `chrome.alarms` 定时心跳，持续唤醒处于后台标签页或最小化窗口中的 Gemini 页面；
   - 自动对 Gemini 标签页设置 `autoDiscardable: false`，防止 Chrome 内存节省程序休眠/丢弃标签页；
   - 后台标签页收到 DOM 变化时改用不受 Chrome 后台定时器限速的微任务调度，并兼容最小化窗口下的可见性判定与 `PointerEvent + MouseEvent + click()` 派发。

## 安装步骤（Chrome / Edge）

1. 打开浏览器地址栏输入 `chrome://extensions/`（Edge 输入 `edge://extensions/`）。
2. 打开右上角的 **开发者模式（Developer mode）**。
3. 点击左上角 **加载已解压的扩展程序（Load unpacked）**。
4. 选择目录：`E:\code\gemini-mcp-auto-helper`。
5. 打开或刷新 `https://gemini.google.com/`，页面右下角会出现 **MCP 助手** 悬浮窗，浏览器右上角图标可打开完整设置面板。

## 运行自动化测试

```bash
node tests/run_all.js
```
