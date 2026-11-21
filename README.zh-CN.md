<div align="center">
  <img src="assets/hero-banner.png" alt="KenEasy Gemini MCP Auto Helper" width="100%">

  <h1>KenEasy Gemini MCP Auto Helper</h1>

  <p>
    专为 <b>Google Gemini</b> 网页端打造的 MCP 工具自动化辅助与智能连续交互扩展：自动点击「始终允许」权限、智能点击「继续 / Yes」追问芯片、全域自由拖拽悬浮窗、一键启停超时桌面提醒，支持切屏后台无休眠运行与 6 层防刷额度熔断保护。
  </p>

  <p>
    简体中文 · <a href="README.md">English</a>
    ·
    <a href="#-更新记录">更新记录</a>
    ·
    <a href="https://github.com/ngiken/KenEasy-Gemini-MCP-Auto-Helper/issues">问题反馈</a>
  </p>

  <p>
    <img alt="Version" src="https://img.shields.io/badge/version-v0.1_Beta-f59e0b?logo=googlechrome&logoColor=white">
    <img alt="Chrome Web Store" src="https://img.shields.io/badge/Chrome_Web_Store-Pending_Review-4285F4?logo=googlechrome&logoColor=white">
    <img alt="Manifest" src="https://img.shields.io/badge/manifest-v3-00aeec">
    <img alt="License" src="https://img.shields.io/badge/license-MIT-27c499">
  </p>
</div>

> [!WARNING]
> ### ⚠️ Beta 版本说明 (v0.1 Beta Preview)
> 本扩展目前处于 **公开测试 Beta 阶段（v0.1 Beta）**。
> 虽然核心自动化引擎、6 层防刷熔断器、自由拖拽 HUD 与桌面通知已通过完整自动化测试套件验证，但由于 Google Gemini 网页端（`gemini.google.com`）界面与 Material Web Components 样式组件会不定期更新，可能存在偶发交互变动或边缘情况：
> - 若在使用中遇到未识别的新型确认弹窗、或误触发跳过，欢迎随时在设置面板的「自定义匹配词」中补充关键词，并前往 [GitHub Issues](https://github.com/ngiken/KenEasy-Gemini-MCP-Auto-Helper/issues) 提交反馈与截图。
> - 欢迎各位开发者 Star 🌟 与提交 PR，共同完善 Gemini 网页端自动化生态！

---

## 🚀 安装方式

### 方式一：Chrome 官方应用商店安装（审核中）

已提交至 Chrome Web Store 官方应用商店进行安全审查，上架后支持一键点击安装与全自动静默升级：

👉 **[前往 Chrome Web Store 官方商店安装 KenEasy Gemini MCP Auto Helper（审核中敬请期待）](https://chromewebstore.google.com/)**

### 方式二：本地开发者模式手动安装（推荐）

在商店上架审核期间，或需要随时体验最新 GitHub 开发版功能，可按以下标准步骤手动加载：

1. 到 [GitHub Releases](https://github.com/ngiken/KenEasy-Gemini-MCP-Auto-Helper/releases) 页面下载最新的源码包（或直接通过 `git clone` 下载仓库）。
2. 解压压缩包到本地指定目录（例如 `E:\code\gemini-mcp-auto-helper`）。
3. 打开 Chrome 或 Edge 浏览器，在地址栏输入：
   - **Chrome 浏览器**：`chrome://extensions/`
   - **Edge 浏览器**：`edge://extensions/`
4. 开启页面右上角的 **「开发者模式」（Developer mode）** 开关。
5. 点击页面左上方出现的 **「加载已解压的扩展程序」（Load unpacked）** 按钮。
6. 在弹出的本地文件选择器中，选中包含 `manifest.json` 的项目根目录文件夹。
7. 打开或刷新 [Google Gemini 网页端](https://gemini.google.com/)，即可在页面中看到全新的悬浮控制窗，点击浏览器右上角扩展图标可打开完整设置面板。

---

## 🎬 核心功能实操演示（v0.1 重点更新）

### 1. 网页全域自由拖拽悬浮窗 (Draggable Floating HUD) 🆕
> 不再局限于死板的右下角固定位置！鼠标按住顶部标题栏即可在整个网页视口内任意拖曳。内置智能视口边界防溢出算法与 4px 拖动消抖判定，拖拽落位瞬间自动记录坐标至 LocalStorage，跨页面与跨刷新丝滑复位。

<div align="center">
  <img src="assets/hud-drag-demo.png" alt="自由拖拽悬浮窗演示" width="100%">
</div>

### 2. 一键启停桌面提醒通知 · 超时卡死主动预警 (Anti-Stall Desktop Notification) 🆕
> 当 MCP 外部工具执行异常挂起或 Gemini 生成中途陷入停滞超过设定阈值（默认 5 分钟）时，系统自动弹出 Windows/Chrome 原生桌面通知，并于扩展图标显示红色 `!` 报警角标。支持在页面 HUD 悬浮窗或 Popup 面板上一键静音/启闭，点击通知即刻唤醒并置顶对应的 Gemini 会话标签页。

<div align="center">
  <img src="assets/notification-toggle-demo.png" alt="一键启停桌面提醒通知演示" width="100%">
</div>

### 3. 全功能设置面板全景图 (Extension Popup Overview)
> 模块化、分层解耦的配置中枢：实时监控今日自动化调用统计、定制「始终允许」优先与回退策略、调整 6 层安全熔断阈值，内置「测试通知」与「紧急停止」开关，掌控自动化每一步。

<div align="center">
  <img src="assets/popup-demo.png" alt="完整设置面板全景图" width="100%">
</div>

---

## ⚡ 核心能力矩阵

| 能力分类 | 核心特性 | 详细技术说明 |
| :--- | :--- | :--- |
| **MCP 权限穿透** | 优先「始终允许」 | 优先寻找并点击 `始终允许 / Always allow`，支持通过 Material Web Components `<slot>` 投影穿透与 `role="menu"` / `role="menuitem"` 下拉菜单定位。 |
| **单次允许回退** | 安全单次放行 | 可选开启「无始终允许时回退点击允许一次」，严格校验父子上下文与黑名单（绝不误点删除、拒绝、取消等破坏性按钮）。 |
| **智能继续交互** | 追问芯片点击 | 识别并点击确认类的 `↪ Yes` 追问建议芯片与「继续 / Continue」按钮，严格排除长文本问答芯片、满意度调查与侧边栏历史。 |
| **自由拖拽悬浮窗** 🆕 | 全域拖曳与记忆 | 页面卡片支持任意位置拖拽（Pointer Events 原生捕获），内置边界碰撞限制算法与 4px 消抖，坐标跨会话持久化保留。 |
| **桌面停滞通知** 🆕 | 一键启闭与报警 | 检测到 MCP 连接或生成超过阈值（1–60 分钟）无新输出时主动桌面报警；悬浮窗与 Popup 均支持一键秒切静音。 |
| **后台静默运行** | 最小化/切屏不中断 | MV3 Service Worker 长连接 Port + `chrome.alarms` 心跳保活，配合微任务调度突破 Chrome 后台定时器限速。 |
| **标签丢弃保护** | 防止内存清理器休眠 | 自动对 Gemini 标签页标记 `autoDiscardable: false`，防止 Chrome 内存节省程序休眠或丢弃活跃后台会话。 |
| **6 层防刷熔断** | 全方位额度护航 | 包含单次上限、每日限额、流式停稳等待、操作冷却、完工信号识别、空转指纹与报错断路保护。 |
| **自定义关键词** | 灵活规则扩展 | 支持在弹窗中以换行或逗号补充专属的「始终允许」与「继续」关键词，精准适配各类中英文提示词变体。 |
| **应急刹车控制** | 一秒全局锁死 | 悬浮窗与弹窗均提供「紧急停止」按钮，点击立即切断所有自动化派发；支持一键「解除熔断」与「清零计数」。 |

---

## 🛡️ 6 层防刷额度安全熔断体系

为了彻底避免自动化脚本因无限循环点击而耗尽 API 额度或模型用量，扩展设计了严密的 6 层防护熔断机制：

```text
               ┌────────────────────────────────────────────────────────┐
               │              Gemini 输出与 DOM 变化监听器              │
               └──────────────────────────┬─────────────────────────────┘
                                          │
                  ▼ 层级 A: 额度与报错熔断（检测到限流/报错立即封锁）
         [ 检测到 Reached limit / 额度已用完 / 稍后再试 ] ──► 🚨 全局熔断报警
                                          │
                  ▼ 层级 B: 输出停稳等待（确保内容彻底流式传输结束）
                [ 持续观察输出 DOM，必须保持静止 1.8 秒以上 ]
                                          │
                  ▼ 层级 C: 操作冷却防抖（避免高频并发连击）
                [ 每次点击「继续」后强制冷却 3.0 秒冷却缓冲 ]
                                          │
                  ▼ 层级 D: 单次任务继续上限（单次提问防死循环）
                 [ 达到单次上限（默认 10 次）] ──► 🛑 任务熔断（发新提问自动复位）
                                          │
                  ▼ 层级 E: 每日继续总上限（全天总额度兜底安全阀）
                 [ 达到每日限额（默认 0=无上限）] ──► 🛑 当日熔断（次日自动归零）
                                          │
                  ▼ 层级 F: 完工信号与智能放行（避免画蛇添足）
         [ 识别到「全部完成」等完工文案且无 ↪ Yes 追问芯片 ] ──► ⏹️ 智能跳过
                                          │
                  ▼ 层级 G: 空转指纹与重复输出检测（防卡死复读机）
          [ 连续输出无实质新进展，或连续多轮回复文本哈希完全一致 ] ──► ⚠️ 空转熔断
```

1. **层级 A · 额度/限流/报错断路**：一旦识别到 Gemini 返回诸如 `reached your limit`、`额度已用完`、`请稍后再试` 或系统故障提示，立即切断点击引擎并提示用户。
2. **层级 B · 输出停稳等待（默认 1.8s）**：严格等候流式输出停止，光标消失且内容保持稳定 1.8 秒后才触发判别，绝不抢跑。
3. **层级 C · 继续冷却缓冲（默认 3.0s）**：每次触发「继续」后施加冷却间隔，防止网络抖动导致的短时间重复请求。
4. **层级 D · 单次任务继续上限（默认 10 次）**：单个任务内继续次数超过设定阈值即触发熔断；用户一旦输入新消息提问，计数器自动清零。
5. **层级 E · 每日总上限（默认 0 = 无限制）**：支持用户为全天累计点击设定安全总额度，跨天（次日 00:00）自动按日历重置。
6. **层级 F · 完工信号与智能放行**：识别到回答末尾明确包含「已全部完成」、「所有任务已处理完毕」等完工信号时自动跳过；若 Gemini 虽提及完成但在末尾询问下一步并展示明确的 `↪ Yes` 追问芯片，则智能放行继续。
7. **层级 G · 空转指纹熔断**：若连续点击后页面未产生有效新字符，或多轮回答完全重复，系统判定模型陷入死循环并主动熔断。

---

## 🏗️ 架构与模块解耦

扩展采用清晰的单一职责分层架构，规则与数据双向驱动：

```text
manifest.json
  MV3 声明文件，声明最小化权限（storage, tabs, alarms, scripting, notifications）与页面匹配规则。

defaults.js
  统一配置中枢：定义全量默认参数、中英文正反向关键词库、配置版本平滑迁移与安全边界清洗函数。

hud.js & hud.css
  网页端专属悬浮窗组件：实现 Pointer Events 自由拖拽算法、视口碰撞约束、微动效状态药丸与一键通知开关。

content.js
  运行于 Gemini 页面隔离环境（Isolated World）：负责 DOM 变化侦听、穿透定位算法、6 层熔断执行器与微任务派发。

background.js
  后台常驻 Service Worker：负责长连接端口维护、心跳唤醒广播、标签丢弃保护与系统桌面通知管理。

popup.js, popup.html, popup.css
  扩展专属设置面板：负责实时数据统计呈现、参数可视化配置、关键词自定义、测试通知与紧急应急控制。
```

---

## ❓ 常见问题与排查指南 (FAQ)

<details>
<summary><b>Q1: 为什么打开 Gemini 后看不到悬浮窗？</b></summary>

1. 确认当前访问的 URL 是否以 `https://gemini.google.com/` 开头；
2. 点击右上角扩展图标打开 Popup 面板，确认总开关与「在 Gemini 页面显示右下角悬浮窗」均处于开启状态；
3. 若之前曾将悬浮窗拖出屏幕边缘，可点击 Popup 中的「保存设置」或刷新页面，悬浮窗将自适应复位到视口内。
</details>

<details>
<summary><b>Q2: 自由拖拽悬浮窗刷新后位置会保留吗？</b></summary>

会。悬浮窗落位后会自动将当前 `(left, top)` 坐标持久化保存到浏览器的本地存储中，无论刷新页面、切换对话还是重启浏览器，悬浮窗都会准确出现在您上次安放的位置。
</details>

<details>
<summary><b>Q3: 为什么收不到超时桌面通知？</b></summary>

1. 请先在 Popup 面板点击 **「测试通知」** 按钮，验证操作系统是否允许 Chrome / Edge 发送系统通知；
2. 检查操作系统本身的「专注模式」（Focus Assist）或「免打扰模式」是否开启；
3. 检查悬浮窗或 Popup 上的「桌面通知」是否误触置于关闭/静音状态。
</details>

<details>
<summary><b>Q4: 自动点击会不会误点「删除会话」或「拒绝」按钮？</b></summary>

绝不会。自动化引擎内置了严格的反向否定黑名单（过滤包含删除、清空、拒绝、取消、稍后、问卷等文本），并结合父子 DOM 结构与同级上下文严格校验，确保只对合规的 MCP 授权与继续按钮生效。
</details>

<details>
<summary><b>Q5: 如何一键恢复初始推荐配置？</b></summary>

打开 Popup 设置面板，点击底部的 **「恢复默认」** 按钮，即可将所有配置项与熔断阈值一键复位至官方推荐的安全默认值。
</details>

---

## 友情链接

- [LINUX DO](https://linux.do) - 真诚、友善、团结、专业，共建开源交流圈

---

## 开源协议

本项目基于 [MIT License](LICENSE) 开源。欢迎自由使用、修改与分享。
