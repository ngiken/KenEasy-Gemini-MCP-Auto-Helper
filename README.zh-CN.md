<div align="center">
  <img src="assets/hero-banner.png" alt="KenEasy Gemini MCP Auto Helper" width="100%">

  <h1>KenEasy Gemini MCP Auto Helper</h1>

  <p>
    专为 <b>Google Gemini</b> 网页端打造的 MCP 工具自动化放行与连续对话扩展（<b>v1.0.0 正式版</b>）：自动点击「始终允许」权限与「继续 / Yes」追问芯片，配备<b>连接卡死实时计时、超时自动终止并自定义续接（默认「继续，刚才mcp连接断开了」）、一键立即续接、拟人防降速节流</b>及<b>MV3 永不断线后台保活引擎与智能点击重试</b>，支持<b>简体中文 / 繁體中文 / English / 日本語</b>四语言实时切换、<b>黑白深浅双模式</b>、零飞角按住拖拽悬浮窗、超时桌面通知及 6 层防刷额度熔断保护。
  </p>

  <p>
    简体中文 · <a href="README.md">English</a>
    ·
    <a href="CHANGELOG.md">更新记录</a>
    ·
    <a href="https://github.com/ngiken/KenEasy-Gemini-MCP-Auto-Helper/issues">问题反馈</a>
  </p>

  <p>
    <img alt="Version" src="https://img.shields.io/badge/version-v1.0.0-16a34a?logo=googlechrome&logoColor=white">
    <img alt="Chrome Web Store" src="https://img.shields.io/badge/Chrome_Web_Store-Pending_Review-4285F4?logo=googlechrome&logoColor=white">
    <img alt="Manifest" src="https://img.shields.io/badge/manifest-v3-00aeec">
    <img alt="License" src="https://img.shields.io/badge/license-MIT-27c499">
  </p>
</div>

> [!NOTE]
> ### ✅ v1.0.0 正式发布版
> **KenEasy Gemini MCP Auto Helper v1.0.0** 现已正式发布！
> 核心自动化引擎、连接卡死实时计时、超时自动终止并自定义续接（默认「继续，刚才mcp连接断开了」）、一键立即续接、拟人防降速节流、MV3 永不断线后台保活、6 层防刷熔断器、按住拖拽 HUD、4 语言黑白双模式及桌面通知均已通过全部自动化与端到端沙盒测试验证。
> - 如遇到 Gemini 页面新弹窗或想补充自定义续接话术，可直接在设置面板中自定义，或前往 [GitHub Issues](https://github.com/ngiken/KenEasy-Gemini-MCP-Auto-Helper/issues) 反馈。
> - 欢迎各位开发者 Star 🌟 与提交 PR，共同完善 Gemini 网页端自动化生态！

---

## 🚀 安装方式

### 方式一：Chrome 官方应用商店安装（审核中）

已提交至 Chrome Web Store 官方应用商店进行安全审查，上架后支持一键点击安装与全自动静默升级：

👉 **[前往 Chrome Web Store 官方商店安装 KenEasy Gemini MCP Auto Helper（审核中敬请期待）](https://chromewebstore.google.com/)**

### 方式二：本地开发者模式手动安装（推荐 · 一键直接下载）

直接点击下方任意一个下载链接即可**一键自动下载 `.zip` 安装包**：

- 📦 **[点击直接下载：手动安装完整包 (`KenEasy-Gemini-MCP-Auto-Helper-v1.0.0-manual-install.zip`)](https://github.com/ngiken/KenEasy-Gemini-MCP-Auto-Helper/releases/download/v1.0.0/KenEasy-Gemini-MCP-Auto-Helper-v1.0.0-manual-install.zip)**（推荐，解压后含 `KenEasy-Gemini-MCP-Auto-Helper` 文件夹及说明文档）
- 🏪 **[点击直接下载：纯净扩展包 (`KenEasy-Gemini-MCP-Auto-Helper-v1.0.0-store.zip`)](https://github.com/ngiken/KenEasy-Gemini-MCP-Auto-Helper/releases/download/v1.0.0/KenEasy-Gemini-MCP-Auto-Helper-v1.0.0-store.zip)**（解压即根目录 `manifest.json`）

安装步骤：
1. 点击上方链接下载 `.zip` 压缩包并解压到本地目录（例如 `E:\code\KenEasy-Gemini-MCP-Auto-Helper`）。
3. 打开 Chrome 或 Edge 浏览器，在地址栏输入：
   - **Chrome 浏览器**：`chrome://extensions/`
   - **Edge 浏览器**：`edge://extensions/`
4. 开启页面右上角的 **「开发者模式」（Developer mode）** 开关。
5. 点击页面左上方出现的 **「加载已解压的扩展程序」（Load unpacked）** 按钮。
6. 在弹出的本地文件选择器中，选中包含 `manifest.json` 的项目根目录文件夹。
7. 打开或刷新 [Google Gemini 网页端](https://gemini.google.com/)，即可在页面中看到全新的悬浮控制窗，点击浏览器右上角扩展图标可打开完整设置面板。

---

## 🎬 核心功能实操演示（v1.0.0 重点升级）

### 0. 连接卡死实时计时、超时自动续接、一键立即续接 & 拟人防降速节流 🆕
> 悬浮窗与弹窗实时显示 MCP（如 Desktop Commander）或 Gemini 连接/等待耗时；一旦超过设定阈值（默认 5 分钟），自动终止卡死回合、保护用户未发送草稿，并自动填入发送自定义续接话术（默认「继续，刚才mcp连接断开了」）。同时提供**一键「立即续接」**按钮，以及**拟人防降速节流**（自然随机停顿、分段输入、安全偏移点击与 60 秒防突发节流）。

### 1. 按住拖拽悬浮窗 · 修复悬停粘连与折叠响应
> 严格左键按住标题栏才启动拖动——鼠标仅仅悬停或经过标题栏时绝不粘连跟随！超过 4px 拖动阈值后才触发指针捕获，标题栏的折叠/主题/语言按钮独立响应无干扰，离开窗口释放自动落位，并在 Popup 面板支持一键「复位悬浮窗」。

<div align="center">
  <img src="assets/hud-drag-demo.png" alt="按住自由拖拽悬浮窗演示" width="100%">
</div>

### 2. 一键启停桌面提醒通知 · 超时卡死主动预警
> 当 MCP 外部工具执行异常挂起或 Gemini 生成中途陷入停滞超过设定阈值（默认 5 分钟）时，系统自动弹出对应语言版本的 Windows/Chrome 原生桌面通知，并于扩展图标显示红色 `!` 报警角标。支持在 HUD 与 Popup 一键静音/开启，点击通知即刻唤醒并置顶对应的 Gemini 标签页。

<div align="center">
  <img src="assets/notification-toggle-demo.png" alt="一键启停桌面提醒通知演示" width="100%">
</div>

### 3. 黑白深浅双模式 + 四语言全功能设定中心 🆕
> 支持在 **深色夜间模式 (`🌙`)** 与 **浅色白昼模式 (`☀️`)** 之间秒速切换，同时原生内置 **简体中文 / 繁體中文 / English / 日本語** 界面与多语种关键词适配；支持 6 层防刷熔断调优、测试通知、悬浮窗一键复位与紧急停止。

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
| **按住拖拽悬浮窗** 🆕 | 悬停零粘连修复 | 仅在左键按住标题栏时拖拽（悬停靠近绝不跟随），4px 后延迟捕获指针，点击标题/折叠/主题/语言键即时响应，支持一键复位。 |
| **多语言 & 黑白模式** 🆕 | 4 语言 + 深浅主题 | 原生支持 简体中文 / 繁體中文 / English / 日本語（含日语、粤语常用确认词）与深色夜间 / 浅色白昼双主题实时联动。 |
| **多浏览器防误触** 🆕 | 非对话页与旧芯片保护 | 自动跳过 `/gems`、`/extensions`、`/settings` 等非对话路由与 0 回复页，并在第 2 浏览器恢复旧会话时忽略陈旧追问芯片。 |
| **桌面停滞通知** | 一键启闭与多语言报警 | 检测到 MCP 连接或生成超过阈值（1–60 分钟）无新输出时主动桌面报警；悬浮窗与 Popup 均支持一键秒切静音。 |
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

## ❓ 常见问题与排查指南

<details>
<summary><b>Q1: 为什么打开 Gemini 后看不到悬浮窗？</b></summary>

1. 确认当前访问的地址是否位于 `gemini.google.com`；
2. 点击右上角扩展图标打开设置弹窗，确认总开关与「在 Gemini 页面显示悬浮窗」均处于开启状态；
3. 若之前曾将悬浮窗拖至边缘或屏幕外，可点击设置弹窗中的 **「复位悬浮窗」** 按钮，将其立即归位到右下角默认位置。
</details>

<details>
<summary><b>Q2: 自由拖拽悬浮窗刷新或最小化后位置会保留吗？</b></summary>

会。悬浮窗落位后会自动将当前 `(left, top)` 坐标同步保存到 `chrome.storage.local` 与 `localStorage` 中，无论刷新页面、切换对话、最小化还原还是重启浏览器，悬浮窗都会准确保持在您上次安放的位置。
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

## 📝 更新记录

### v1.0.0 正式版 - 2026-11-23
- **连接卡死自动终止与自定义续接**：超过设定阈值（默认 5 分钟）自动终止卡死的 MCP/Gemini 回合，保护用户草稿并发送可自定义续接话术（默认「继续，刚才mcp连接断开了」），支持单任务最大恢复次数上限。
- **实时等待计时与一键「立即续接」**：HUD 与弹窗实时显示当前连接/等待耗时，并新增一键「立即续接」按钮，无需干等超时即可立即恢复对话。
- **拟人防降速节流**：内置随机停顿缓冲、分段打字输入、悬停偏移点击与 60 秒滚动防突发节流，避免高频触发风控降速。
- **熔断桌面通知接线与后台防冻结加固**：完整接通安全熔断角标与桌面通知（点击直达对应标签页）、新增 Web Lock 防冻结护盾与 8 秒僵尸端口快恢复，自动化测试扩展至 **76/76 全通过**。

### [v0.3.0 (v0.3 Beta)](https://github.com/ngiken/KenEasy-Gemini-MCP-Auto-Helper/releases/tag/v0.3.0) - 2026-11-22
- **MV3 永不断线后台引擎**：新增 ~19.5 秒 Service Worker 保活、4 分钟无感 Port 轮换、不受后台定时器限速的 SW 延迟停稳/冷却回拨（`GMAH_SCHEDULE_TICK`），以及切分页/切应用即时唤醒，彻底解决切去后台或其他应用后停止自动点击的问题。
- **后台智能重试与 Shadow DOM 监听**：后台点击未生效时自动安全重试并穿透 `@material/web` 内部原生 `<button>`；支持递归监听动态 Shadow DOM 并过滤波纹/Tooltip 杂讯；修复最小化窗口隐藏 Spinner 导致 `isGenerating` 永久锁死的问题。
- **HUD、Popup 与安全全面加固**：修复 Windows 最小化（`0×0` 视窗）导致悬浮窗飞去左上角 `(0, 0)`；展开面板自动贴边防出框；修复 `/app` → `/app/<id>` 新建对话误拦截首次继续；全语种拦截 Cookie/通知/摄像头/定位按钮；4 语言动态状态栏与熔断文案 100% 对齐；Popup 数值与关键词自动保存并即时解除熔断。
- **64/64 全量、端到端与 30 分钟压力测试**：覆盖 30 分钟后台冻结定时器马拉松（7+ 次 Port 轮换 + SW 崩溃恢复）、20+ 危险按钮零误触矩阵与双标签并发统计合并。

### [v0.2.0 (v0.2 Beta)](https://github.com/ngiken/KenEasy-Gemini-MCP-Auto-Helper/releases/tag/v0.2.0) - 2026-11-22
- **修复悬浮窗拖拽粘连与折叠响应**：引入左键按压门控（`isPointerDown`），鼠标悬停靠近绝不粘连跟随；4px 阈值后延迟捕获指针，标题栏折叠、主题、语言按钮独立秒响应；新增离窗释放保持原位与弹窗「复位悬浮窗」按钮。
- **多浏览器与非对话页防误触守卫**：自动跳过 `/gems`、`/extensions`、`/settings` 等非对话路由与 0 回复首页；移除易误触的 `'开始'`/`'開始'` 默认词；第 2 浏览器或恢复旧会话标签页时自动忽略陈旧历史芯片。
- **4 语言实时切换**：全面支持 `简体中文`、`繁體中文`、`English`、`日本語` 界面、系统通知与多语种关键词识别。
- **黑白深浅双模式**：悬浮窗（`☀`/`☾`）与 Popup 弹窗（`🌙`/`☀️`）支持深色夜间 / 浅色白昼主题实时同步。
- **重制全套 2x 高清宣传图**：以 2x Retina 高清重绘全部 README 演示图与 Chrome 商店截图。

### [v0.1.0 (v0.1 Beta)](https://github.com/ngiken/KenEasy-Gemini-MCP-Auto-Helper/releases/tag/v0.1.0) - 2026-11-21
- 首个公开测试 Beta 版本：支持 MCP「始终允许」自动放行、`↪ Yes` 追问芯片点击、自由拖拽悬浮窗、一键超时桌面通知、后台防休眠保活及 6 层防刷额度熔断。

完整变更历史请查看 [CHANGELOG.md](CHANGELOG.md)。

---

## 友情链接

- [LINUX DO](https://linux.do) - 真诚、友善、团结、专业，共建开源交流圈

---

## 开源协议

本项目基于 [MIT License](LICENSE) 开源。欢迎自由使用、修改与分享。
