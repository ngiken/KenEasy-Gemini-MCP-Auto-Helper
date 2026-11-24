(function (root) {
  'use strict';

  const STORAGE_KEY = 'gmah_settings_v1';
  const STATS_KEY = 'gmah_stats_v1';
  const CHAT_OVERRIDES_KEY = 'gmah_chat_overrides_v1';
  const SETTINGS_VERSION = 5;
  const MAX_CHAT_OVERRIDES = 100;

  const CHAT_OVERRIDE_KEYS = [
    'enabled',
    'autoAllow',
    'autoContinue',
    'backgroundMode',
    'stallAlertEnabled',
    'stallAutoRecoverEnabled'
  ];

  const SUPPORTED_LANGUAGES = ['zh-CN', 'zh-TW', 'en', 'ja'];
  const SUPPORTED_THEMES = ['dark', 'light'];

  const DEFAULT_SETTINGS = {
    settingsVersion: SETTINGS_VERSION,
    language: 'zh-CN',
    theme: 'dark',
    enabled: true,
    autoAllow: true,
    preferAlwaysAllow: true,
    fallbackSingleAllow: true,
    autoContinue: true,
    backgroundMode: true,
    preventTabDiscard: true,
    showHud: true,
    hudMinimized: false,

    // 6-layer anti-quota-burn circuit breaker defaults
    maxContinuesPerTask: 10,
    dailyContinueLimit: 0, // 0 = unlimited (theoretically no daily cap, user can still set a positive cap)
    continueCooldownMs: 4000,
    allowCooldownMs: 600,
    idleSettleMs: 1800,
    stopOnCompletionCues: true,
    stopOnStagnantOutput: true,
    stopOnQuotaOrError: true,

    // Connection / stall timeout desktop notification defaults
    stallAlertEnabled: true,
    stallAlertMinutes: 5,

    // Connection / stall auto-recovery defaults (auto stop + send reconnect prompt)
    stallAutoRecoverEnabled: true,
    stallAutoRecoverMinutes: 5,
    stallAutoRecoverPrompt: '继续，刚才mcp连接断开了',
    maxStallRecoveriesPerTask: 3,

    // Human-like pacing / anti-throttling protection (randomized delays + natural typing + burst governor)
    humanPacingEnabled: true,

    // Keyword lists
    alwaysAllowKeywords: [
      '始终允许',
      '一律允许',
      '总是允许',
      '永远允许',
      '始終允許',
      '一律允許',
      '總是允許',
      '永遠允許',
      '在此对话中始终允许',
      '在此對話中始終允許',
      '在此对话中总是允许',
      '在此對話中總是允許',
      '在此对话中一律允许',
      '在此對話中一律允許',
      '在此对话中允许',
      '在此對話中允許',
      '在此会话中始终允许',
      '本次会话始终允许',
      '本次对话始终允许',
      '本次對話始終允許',
      '始终允许此工具',
      '始終允許此工具',
      '始终允许此操作',
      '始終允許此操作',
      '始终允许此服务器',
      '始終允許此伺服器',
      '始终允许该工具',
      '始终允许此 mcp',
      '始终允许所有',
      '始終允許所有',
      '允许所有',
      '允許所有',
      '始终运行',
      '始終執行',
      '始终批准',
      '始終批准',
      '始终同意',
      '始終同意',
      '总是同意',
      '總是同意',
      'always allow',
      'always allow this tool',
      'always allow this action',
      'always allow this server',
      'always allow for this chat',
      'always allow in this chat',
      'always allow for this conversation',
      'always allow in this conversation',
      'always allow for this session',
      'always allow in this session',
      'always allow for this workspace',
      'always allow all',
      'always allow from',
      'always allow mcp',
      'always allow this mcp',
      'allow always',
      'allow always for this chat',
      'allow for all tools',
      'allow for this chat',
      'allow in this chat',
      'allow for this conversation',
      'allow in this conversation',
      'allow for this session',
      'allow in this session',
      'allow all in this chat',
      'allow all for this chat',
      'allow all for this conversation',
      'allow all tools',
      'allow all',
      'always run',
      'always approve',
      'always permit',
      'always accept',
      'yes, always allow',
      'yes, allow all',
      '永久允許',
      '長久允許',
      '常に許可',
      'このチャットで常に許可',
      'この会話で常に許可',
      'このセッションで常に許可',
      'このツールを常に許可',
      'すべて許可',
      '全て許可',
      '常に承認',
      '常に同意'
    ],
    singleAllowKeywords: [
      '允许',
      '允许一次',
      '仅允许一次',
      '本次允许',
      '仅本次允许',
      '此次允许',
      '允许本次',
      '允许运行',
      '允许执行',
      '允许此工具',
      '确认允许',
      '允許',
      '允許一次',
      '僅允許一次',
      '本次允許',
      '僅本次允許',
      '此次允許',
      '允許本次',
      '允許執行',
      '允許此工具',
      '確認允許',
      '今次允許',
      '只允許今次',
      '允許這一次',
      '容許',
      '批准',
      '同意',
      'allow',
      'allow once',
      'allow this time',
      'allow just once',
      'allow for this turn',
      'allow this tool',
      'allow this action',
      'approve',
      'approve once',
      'accept',
      'accept once',
      'permit',
      'allow tool',
      'run tool',
      'run this tool',
      'run once',
      '許可',
      '1回のみ許可',
      '今回のみ許可',
      '今回だけ許可',
      'この操作を許可',
      'ツールを実行',
      '承認'
    ],
    continueKeywords: [
      '继续',
      '继续生成',
      '继续执行',
      '继续完成',
      '继续输出',
      '继续处理',
      '继续运行',
      '继续操作',
      '继续回复',
      '继续回答',
      '继续写',
      '继续下去',
      '继续吧',
      '继续下一步',
      '点击继续',
      '请继续',
      '好，继续',
      '好的，继续',
      '是',
      '是的',
      '好',
      '好的',
      '确认',
      '确定',
      '开始执行',
      '立即执行',
      '马上执行',
      '繼續',
      '繼續生成',
      '繼續執行',
      '繼續完成',
      '繼續輸出',
      '繼續處理',
      '繼續運行',
      '繼續操作',
      '繼續回覆',
      '繼續回答',
      '繼續寫',
      '繼續下去',
      '繼續吧',
      '繼續下一步',
      '點擊繼續',
      '請繼續',
      '接續',
      '接續生成',
      '接續執行',
      '接續輸出',
      '接續回答',
      '接續處理',
      '接著',
      '接著寫',
      '接著說',
      '接着',
      '接着写',
      '接着说',
      '好，繼續',
      '好的，繼續',
      '確認',
      '確定',
      '開始執行',
      '立即執行',
      '馬上執行',
      '係',
      '係呀',
      '好呀',
      '唔該繼續',
      'yes',
      'yes, please',
      'yes, continue',
      'yes, proceed',
      'yes, go ahead',
      'confirm',
      'proceed',
      'go ahead',
      'continue',
      'continue please',
      'continue generating',
      'continue generation',
      'continue response',
      'continue writing',
      'continue output',
      'continue working',
      'continue task',
      'click to continue',
      'keep going',
      'keep writing',
      'keep responding',
      'continue answering',
      'continue reply',
      'resume',
      '続ける',
      '続けて',
      '続行',
      '続行する',
      '生成を続ける',
      '回答を続ける',
      '処理を続行',
      'はい',
      'はい、お願いします',
      'はい、続けて',
      'いいよ',
      'クリックして続行'
    ],
    customAlwaysAllowKeywords: [],
    customContinueKeywords: [],

    // Safety exclusion keywords (never click elements containing these)
    denyBlacklistKeywords: [
      '拒绝',
      '拒絕',
      '不允许',
      '不允許',
      '不要',
      '取消',
      '停止',
      '终止',
      '終止',
      '删除',
      '刪除',
      '移除',
      '清空',
      '退出',
      '登出',
      '关闭',
      '關閉',
      '重置',
      'deny',
      'disallow',
      "don't allow",
      'never allow',
      'reject',
      'cancel',
      'stop',
      'delete',
      'remove',
      'decline',
      'dismiss',
      'close',
      'sign out',
      'log out',
      'report',
      '拒否',
      '許可しない',
      '不許可',
      'キャンセル',
      '中止',
      '削除',
      '閉じる',
      'ログアウト',
      'リセット',
      '報告'
    ],

    // Completion cues: if latest reply signals task finished without truncation, pause auto-continue
    completionCueKeywords: [
      '全部完成',
      '已完成所有',
      '所有步骤已完成',
      '任务已完成',
      '全部测试通过',
      '所有测试均已通过',
      '已全部完成',
      'everything is complete',
      'all tasks completed',
      'all steps completed',
      'all tests passed',
      'task completed',
      'work is complete',
      'すべて完了',
      'すべてのタスクが完了',
      'すべてのステップが完了',
      '作業が完了',
      'テストがすべて合格'
    ],

    // Truncation cues: overrides completion cue if the reply explicitly says it was cut off
    truncationCueKeywords: [
      '点击继续',
      '點擊繼續',
      '输入继续',
      '已达单次',
      '输出上限',
      '輸出上限',
      '未完待续',
      '继续生成',
      'continue generating',
      'click continue',
      'hit the limit',
      'output limit',
      '続行をクリック',
      '出力上限',
      '文字数制限',
      '生成を続ける'
    ],

    // Quota / rate-limit / error cues: immediately trip circuit breaker
    quotaErrorKeywords: [
      'reached your limit',
      'usage limit',
      'usage cap',
      'limit reached',
      'rate limit',
      'quota exceeded',
      'too many requests',
      'try again later',
      'something went wrong',
      '额度已用完',
      '額度已用完',
      '已达上限',
      '已達上限',
      '达到使用上限',
      '配额已用完',
      '配額已用完',
      '超出配额',
      '超出配額',
      '配额不足',
      '配額不足',
      '请求过于频繁',
      '請求過於頻繁',
      '稍后再试',
      '稍後再試',
      '出了点问题',
      '出了點問題',
      '上限に達しました',
      '利用制限',
      'リクエストが多すぎます',
      'しばらくしてから',
      '問題が発生しました',
      'エラーが発生しました'
    ]
  };

  const UI_I18N = {
    'zh-CN': {
      langLabel: '简体',
      hudTitle: 'MCP 助手',
      betaBadge: 'v1.0.0',
      betaBadgeTitle: '正式发布版 (v1.0.0)',
      hudTitleTip: '按住左键拖拽 · 点击标题折叠展开 · v1.0.0',
      minBtnTitle: '最小化 / 展开',
      themeToggleToLight: '切换浅色模式',
      themeToggleToDark: '切换深色模式',
      langCycleTip: '切换语言 (简/繁/EN/日)',
      hudRowMaster: '插件状态',
      hudRowAllow: '自动始终允许',
      hudRowContinue: '自动点击继续',
      hudRowBackground: '后台切屏运行',
      hudRowNotif: '桌面通知',
      hudRowStallRecover: '超时自动续接',
      stateRunning: '运行中',
      statePaused: '已暂停',
      stateOn: '已开启',
      stateOff: '已关闭',
      stateForeground: '仅前台',
      notifPillEnableTip: '点击开启连接超时桌面通知',
      notifPillDisableTip: '点击关闭连接超时桌面通知',
      stallRecoverPillEnableTip: '点击开启：连接超时自动终止并发送「继续」',
      stallRecoverPillDisableTip: '点击关闭：连接超时自动终止并发送「继续」',
      btnForceRecover: '立即续接',
      btnForceRecoverTip: '立即终止当前对话并自动发送「{prompt}」',
      popupBtnForceRecover: '⚡ 立即终止并发送续接文字',
      toastForceRecoverSent: '⚡ 已触发立即终止并发送续接指令',
      toastForceRecoverNoTarget: '当前页面未检测到可操作的停止按钮或输入框',
      hudWaitElapsed: '⏳ 已等待 {elapsed} / 阈值 {limit}分钟',
      hudWaitConnecting: '⏳ {label} · 已等 {elapsed} / {limit}分钟',
      hudWaitElapsedNoLimit: '⏳ 等待响应中 · 已等待 {elapsed}',
      hudWaitConnectingNoLimit: '⏳ {label} · 已等 {elapsed}',
      hudStatusForceStopping: '⚡ 手动触发：正在终止对话并准备发送「{prompt}」...',
      logForceRecoverStop: '⚡ 用户手动触发：已终止当前对话，准备自动发送「{prompt}」',
      logForceRecoverDirect: '⚡ 用户手动触发：未检测到停止按钮，直接自动发送「{prompt}」',
      logForceRecoverSent: '⚡ 手动续接完成：已自动发送「{prompt}」',
      logForceRecoverNoTarget: '⚠️ 未检测到停止按钮或输入框，无法立即终止并发送',
      liveWaiting: '等待 {elapsed}',
      btnEmergency: '紧急停止',
      btnResetBreaker: '解除熔断',
      btnInspect: '探测按钮',
      btnLogs: '日志',
      hudInit: '初始化中...',
      hudCounts: '允许 {allow} · 本次继续 {task}/{max} · 今日 {daily}/{cap}',
      hudStatusBreaker: '熔断: {reason}',
      hudStatusPaused: '已暂停监控',
      hudStatusStallFallback: '⚠️ 连接超时无进展',
      hudStatusGenerating: 'Gemini 输出中（等待完成后检测继续）',
      hudStatusMonitoring: '监控中',
      hudStatusNonChat: '当前非对话页（待机保护中）',
      hudStatusClickedAllow: '已自动点击「{label}」',
      hudStatusClickedContinue: '已点击继续 ({task}/{max})',
      hudStatusRetryClick: '后台重试点击「{label}」({attempt}/{max})',
      hudStatusSkippedCompletion: '检测到完工信号「{cue}」，已跳过继续',
      hudStatusStallMinutes: '⚠️ 连接/等待已超过 {mins} 分钟无进展',
      hudStatusStallStopping: '🔄 连接超时 {mins} 分钟，正在终止对话...',
      hudStatusStallTyping: '✍️ 正在拟人输入「{prompt}」...',
      hudStatusStallPacing: '⏳ 拟人防降速停顿中，即将发送「{prompt}」...',
      hudStatusStallSending: '🔄 正在自动发送「{prompt}」恢复对话...',
      hudStatusStallRecovered: '🔄 已自动终止并发送「{prompt}」 ({count}/{max})',
      breakerReasonEmergency: '用户手动紧急停止',
      breakerReasonTaskLimit: '已达单次任务继续上限 ({task}/{max})',
      breakerReasonDailyLimit: '已达今日继续总上限 ({daily}/{cap})',
      breakerReasonQuotaError: '检测到额度/错误提示（「{kw}」）',
      breakerReasonStagnant: '连续输出无新进展，疑似死循环',
      logsEmpty: '暂无操作记录',
      logsClearBtn: '清空',
      inspectRefreshBtn: '刷新',
      inspectFound: '发现 {count} 个可见按钮（点击添加到规则）：',
      inspectNone: '当前页面未发现可点击按钮',
      inspectAddAllow: '+允许词',
      inspectAddedAllow: '已加允许 ✓',
      inspectAddCont: '+继续词',
      inspectAddedCont: '已加继续 ✓',
      logReady: '🚀 Gemini MCP Auto Helper v1.0.0 已就绪',
      logClickedAllow: '✅ 自动点击[{tag}]：「{label}」',
      logRetriedAllow: '🔁 后台重试点击允许：「{label}」 ({attempt}/{max})',
      logClickedContinue: '▶️ 自动点击继续：「{label}」 ({task}/{max})',
      logRetriedContinue: '🔁 后台重试点击继续：「{label}」 ({attempt}/{max})',
      logSkippedCompletion: '🛡️ 检测到完工信号「{cue}」，跳过点击「{label}」',
      logBreakerTripped: '🛑 熔断触发: {reason}',
      logBreakerCleared: '✅ 已解除熔断并重置本次任务计数',
      logPromptReset: '💬 检测到用户发送新指令，本次继续计数已归零',
      logPromptClearBreaker: '检测到新消息，自动重置单次任务继续计数',
      logChatChangedClearBreaker: '已切换对话，自动重置熔断状态',
      logDailyReset: '新的一天已自动重置每日额度计数',
      logLimitClearDaily: '今日计数已清零或上限已放开，自动解除每日熔断',
      logLimitClearTask: '单次任务上限已提高，自动解除任务熔断',
      logStallTriggered: '🔔 检测到连接/等待连续超过 {mins} 分钟无新进展，已发送桌面通知',
      logStallRecovered: '✅ 连接/生成已恢复正常，已清除超时提醒',
      logStallProgress: '✅ 检测到新输出进展，已清除连接超时提醒',
      logStallRecoverStop: '🔄 连接/等待已超时 {mins} 分钟，自动终止当前对话并准备发送「{prompt}」',
      logStallRecoverDirect: '🔄 连接/等待已超时 {mins} 分钟，未检测到停止按钮，直接自动发送「{prompt}」',
      logStallRecoverSent: '🔄 超时自动恢复完成：已发送「{prompt}」 ({count}/{max})',
      logStallRecoverDraftSkip: '⚠️ 输入框已有未发送内容，已跳过超时自动发送「{prompt}」',
      logStallRecoverFailed: '⚠️ 超时自动恢复未能完成（未找到输入框或停止未生效），请手动检查',
      logStallRecoverLimit: '⚠️ 已达单次任务超时自动恢复上限 ({count}/{max})，停止自动重试',
      logStallRecoverOn: '🔄 连接超时自动终止并继续已开启',
      logStallRecoverOff: '🔄 连接超时自动终止并继续已关闭',
      logAddedAllowKw: '➕ 已添加自定义允许词：「{text}」',
      logAddedContKw: '➕ 已添加自定义继续词：「{text}」',
      tagAlwaysAllow: '始终允许',
      tagSingleAllow: '允许',
      popupTitle: 'Gemini MCP 助手',
      popupSubtitle: '自动允许 · 多语言黑白模式 · 防误触熔断',
      popupBetaNotice: '✅ 正式发布版 (v1.0.0)',
      popupMasterTitle: '总开关',
      popupThemeLight: '☀️ 浅色模式',
      popupThemeDark: '🌙 深色模式',
      popupStatAllow: '今日允许',
      popupStatContinue: '今日继续',
      popupStatLive: '当前状态',
      livePending: '待检测',
      liveNeedsReload: '请刷新 Gemini',
      liveNoTab: '未打开 Gemini',
      liveTripped: '已熔断',
      livePaused: '已暂停',
      liveStall: '连接超时',
      liveStandby: '非对话待机',
      liveBgReady: '后台就绪',
      liveMonitoring: '监控中',
      secCore: '核心自动化',
      lblAutoAllow: '自动点击 MCP「始终允许」',
      lblPreferAlways: '优先选择「始终允许」（推荐）',
      lblFallbackSingle: '无始终允许时回退点「允许一次」',
      lblAutoContinue: '自动点击下方「继续」按钮',
      lblBgMode: '后台静默运行（切屏 / 最小化不中断）',
      lblPreventDiscard: '防止 Chrome 休眠丢弃 Gemini 标签页',
      lblShowHud: '在 Gemini 页面显示悬浮窗',
      secBreaker: '防刷额度熔断保护',
      lblMaxTask: '单次任务继续上限',
      lblDailyCap: '每日继续总上限 (0=无上限)',
      lblCooldown: '继续冷却 (秒)',
      lblSettle: '输出停稳等待 (秒)',
      lblStopCompletion: '检测到「全部完成」等完工信号时跳过继续',
      lblStopStagnant: '输出无新进展 / 重复时自动熔断',
      lblStopQuota: '检测到限流 / 额度 / 报错提示时立刻熔断',
      lblHumanPacing: '拟人防降速节流（随机延迟 + 逐字输入，降低限流风险）',
      secNotif: '桌面通知提醒 (连接超时 / 卡死)',
      btnNotifOn: '桌面通知：开启',
      btnNotifOff: '桌面通知：关闭',
      lblStallEnable: '连接 / 卡死超时发送电脑桌面通知',
      lblStallMinutes: '连接超时提醒阈值 (分钟)',
      lblStallRecoverEnable: '超时卡住时自动终止对话并发送续接文字',
      lblStallRecoverMinutes: '自动终止续接阈值 (分钟)',
      lblStallRecoverMax: '单次任务最多自动恢复次数',
      lblStallRecoverPrompt: '自定义续接发送文字',
      phStallRecoverPrompt: '默认：继续，刚才mcp连接断开了',
      btnTestNotif: '测试通知',
      secCustom: '自定义匹配词（可选，换行或逗号分隔）',
      lblCustomAllow: '额外「始终允许」关键词',
      phCustomAllow: '例如：始终同意、允许此工具',
      lblCustomCont: '额外「继续」关键词',
      phCustomCont: '例如：继续下一步、接着写',
      btnResetStats: '清零计数',
      btnResetHudPos: '复位悬浮窗',
      btnDefaults: '恢复默认',
      btnSave: '保存设置',
      toastSaved: '设置已保存并同步到 Gemini 页面',
      toastSavedBtn: '已保存设置',
      toastEnabledOn: '已开启自动助手',
      toastEnabledOff: '已暂停自动助手',
      toastSynced: '开关已实时同步到 Gemini 页面',
      toastNotifOn: '已开启桌面通知提醒',
      toastNotifOff: '已关闭桌面通知提醒',
      toastThemeLight: '已切换为浅色（白昼）模式',
      toastThemeDark: '已切换为深色（夜间）模式',
      toastLangChanged: '界面语言已切换',
      toastHudPosReset: '已将悬浮窗重置回右下角默认位置',
      toastTestNotifUnsupported: '当前环境不支持发送桌面通知',
      toastTestNotifFailed: '通知发送失败，请检查系统与 Chrome 通知权限',
      toastTestNotifSent: '已发送测试桌面通知，请查看屏幕右下角',
      toastDefaultsRestored: '已恢复默认安全设置',
      toastEmergencySent: '已向 Gemini 标签页发送紧急停止指令',
      toastNeedsReload: '检测到 Gemini 页面，请先按 F5 刷新页面后重试',
      toastNoGeminiTab: '当前未检测到已打开的 Gemini 标签页',
      toastBreakerReset: '已解除熔断并重置本次任务计数',
      toastStatsReset: '今日统计计数已清零',
      bgNotifStallTitle: 'Gemini 连接已超过 {mins} 分钟',
      bgNotifStallMsg: '检测到该对话连续连接/等待超过 {mins} 分钟仍无新进展，点击此处立即切回对应标签页检查。',
      bgNotifTestTitle: 'KenEasy Gemini MCP 助手 · 桌面通知正常',
      bgNotifTestMsg: '当 Gemini 连接或等待超时无进展时，系统将弹出此类提醒，点击即可切回对应标签页。',
      bgNotifBreakerTitle: 'Gemini 自动助手已触发安全熔断',
      bgNotifBreakerMsg: '{reason}。点击此处切回对应 Gemini 标签页查看。',
      scopeChat: '本对话',
      scopeGlobal: '全局默认',
      scopeChatCustom: '本对话独立配置',
      scopeFollowGlobal: '跟随全局',
      scopeResetBtn: '恢复全局',
      scopeResetTip: '清除本对话独立开关并恢复跟随全局设置',
      scopeChatTip: '当前仅修改此对话的独立开关（不影响其他对话）',
      scopeGlobalTip: '当前修改全局默认开关（对未单独配置的对话生效）',
      chatLabelNew: '新对话',
      chatLabelId: '对话 #{id}',
      chatLabelGem: 'Gem · {id}',
      secCurrentChat: '当前对话独立控制',
      secGlobalSettings: '全局默认设置',
      chatEmergencyBtn: '仅停本对话',
      chatResumeBtn: '解除本对话',
      btnEmergencyAll: '停止全部对话',
      toastChatUpdated: '已更新当前对话的独立设置',
      toastChatReset: '当前对话已恢复跟随全局默认',
      toastEmergencyChatSent: '已单独紧急停止当前对话（其他对话不受影响）',
      toastEmergencyAllSent: '已向全部 Gemini 标签页发送紧急停止指令',
      logChatOverrideSet: '🎛️ 本对话独立设置：{key} -> {val}',
      logChatOverrideCleared: '↩️ 本对话已恢复跟随全局默认设置',
      logChatEmergencyRestored: '🛑 已恢复此对话的独立紧急停止状态',
      logMainWorldRetry: '⚡ 后台主世界点击升级：「{label}」 ({attempt}/{max})',
      chatNoActiveTab: '未检测到活动对话页',
      chatOverrideTag: '独立',
      chatEmergencyHint: '仅停止当前对话，不影响其他标签页或对话',
      lblChatEnabled: '本对话总开关',
      lblChatAllow: '自动始终允许',
      lblChatContinue: '自动点击继续',
      lblChatBackground: '后台 / 最小化运行',
      lblChatNotif: '桌面超时通知',
      lblChatRecover: '超时自动续接'
    },
    'zh-TW': {
      langLabel: '繁體',
      hudTitle: 'MCP 助手',
      betaBadge: 'v1.0.0',
      betaBadgeTitle: '正式發布版 (v1.0.0)',
      hudTitleTip: '按住左鍵拖曳 · 點擊標題折疊展開 · v1.0.0',
      minBtnTitle: '最小化 / 展開',
      themeToggleToLight: '切換淺色模式',
      themeToggleToDark: '切換深色模式',
      langCycleTip: '切換語言 (簡/繁/EN/日)',
      hudRowMaster: '外掛狀態',
      hudRowAllow: '自動始終允許',
      hudRowContinue: '自動點擊繼續',
      hudRowBackground: '背景切屏運行',
      hudRowNotif: '桌面通知',
      hudRowStallRecover: '逾時自動續接',
      stateRunning: '運行中',
      statePaused: '已暫停',
      stateOn: '已開啟',
      stateOff: '已關閉',
      stateForeground: '僅前景',
      notifPillEnableTip: '點擊開啟連線逾時桌面通知',
      notifPillDisableTip: '點擊關閉連線逾時桌面通知',
      stallRecoverPillEnableTip: '點擊開啟：連線逾時自動終止並發送「繼續」',
      stallRecoverPillDisableTip: '點擊關閉：連線逾時自動終止並發送「繼續」',
      btnForceRecover: '立即續接',
      btnForceRecoverTip: '立即終止目前對話並自動發送「{prompt}」',
      popupBtnForceRecover: '⚡ 立即終止並發送續接文字',
      toastForceRecoverSent: '⚡ 已觸發立即終止並發送續接指令',
      toastForceRecoverNoTarget: '目前頁面未偵測到可操作的停止按鈕或輸入框',
      hudWaitElapsed: '⏳ 已等待 {elapsed} / 閾值 {limit}分鐘',
      hudWaitConnecting: '⏳ {label} · 已等 {elapsed} / {limit}分鐘',
      hudWaitElapsedNoLimit: '⏳ 等待回應中 · 已等待 {elapsed}',
      hudWaitConnectingNoLimit: '⏳ {label} · 已等 {elapsed}',
      hudStatusForceStopping: '⚡ 手動觸發：正在終止對話並準備發送「{prompt}」...',
      logForceRecoverStop: '⚡ 使用者手動觸發：已終止目前對話，準備自動發送「{prompt}」',
      logForceRecoverDirect: '⚡ 使用者手動觸發：未偵測到停止按鈕，直接自動發送「{prompt}」',
      logForceRecoverSent: '⚡ 手動續接完成：已自動發送「{prompt}」',
      logForceRecoverNoTarget: '⚠️ 未偵測到停止按鈕或輸入框，無法立即終止並發送',
      liveWaiting: '等待 {elapsed}',
      btnEmergency: '緊急停止',
      btnResetBreaker: '解除熔斷',
      btnInspect: '探測按鈕',
      btnLogs: '日誌',
      hudInit: '初始化中...',
      hudCounts: '允許 {allow} · 本次繼續 {task}/{max} · 今日 {daily}/{cap}',
      hudStatusBreaker: '熔斷: {reason}',
      hudStatusPaused: '已暫停監控',
      hudStatusStallFallback: '⚠️ 連線逾時無進展',
      hudStatusGenerating: 'Gemini 輸出中（等待完成後偵測繼續）',
      hudStatusMonitoring: '監控中',
      hudStatusNonChat: '目前非對話頁面（待機保護中）',
      hudStatusClickedAllow: '已自動點擊「{label}」',
      hudStatusClickedContinue: '已點擊繼續 ({task}/{max})',
      hudStatusRetryClick: '背景重試點擊「{label}」({attempt}/{max})',
      hudStatusSkippedCompletion: '偵測到完工訊號「{cue}」，已跳過繼續',
      hudStatusStallMinutes: '⚠️ 連線/等待已超過 {mins} 分鐘無進展',
      hudStatusStallStopping: '🔄 連線逾時 {mins} 分鐘，正在終止對話...',
      hudStatusStallTyping: '✍️ 正在擬人輸入「{prompt}」...',
      hudStatusStallPacing: '⏳ 擬人防降速停頓中，即將發送「{prompt}」...',
      hudStatusStallSending: '🔄 正在自動發送「{prompt}」恢復對話...',
      hudStatusStallRecovered: '🔄 已自動終止並發送「{prompt}」 ({count}/{max})',
      breakerReasonEmergency: '使用者手動緊急停止',
      breakerReasonTaskLimit: '已達單次任務繼續上限 ({task}/{max})',
      breakerReasonDailyLimit: '已達今日繼續總上限 ({daily}/{cap})',
      breakerReasonQuotaError: '偵測到額度/報錯提示（「{kw}」）',
      breakerReasonStagnant: '連續輸出無新進展，疑似死循環',
      logsEmpty: '暫無操作紀錄',
      logsClearBtn: '清空',
      inspectRefreshBtn: '重新整理',
      inspectFound: '發現 {count} 個可見按鈕（點擊新增至規則）：',
      inspectNone: '目前頁面未發現可點擊按鈕',
      inspectAddAllow: '+允許詞',
      inspectAddedAllow: '已加允許 ✓',
      inspectAddCont: '+繼續詞',
      inspectAddedCont: '已加繼續 ✓',
      logReady: '🚀 Gemini MCP Auto Helper v1.0.0 已就緒',
      logClickedAllow: '✅ 自動點擊[{tag}]：「{label}」',
      logRetriedAllow: '🔁 背景重試點擊允許：「{label}」 ({attempt}/{max})',
      logClickedContinue: '▶️ 自動點擊繼續：「{label}」 ({task}/{max})',
      logRetriedContinue: '🔁 背景重試點擊繼續：「{label}」 ({attempt}/{max})',
      logSkippedCompletion: '🛡️ 偵測到完工訊號「{cue}」，跳過點擊「{label}」',
      logBreakerTripped: '🛑 熔斷觸發: {reason}',
      logBreakerCleared: '✅ 已解除熔斷並重設本次任務計數',
      logPromptReset: '💬 偵測到使用者發送新指令，本次繼續計數已歸零',
      logPromptClearBreaker: '偵測到新訊息，自動重設單次任務繼續計數',
      logChatChangedClearBreaker: '已切換對話，自動重設熔斷狀態',
      logDailyReset: '新的一天已自動重設每日額度計數',
      logLimitClearDaily: '今日計數已清零或上限已放寬，自動解除每日熔斷',
      logLimitClearTask: '單次任務上限已提高，自動解除任務熔斷',
      logStallTriggered: '🔔 偵測到連線/等待連續超過 {mins} 分鐘無新進展，已發送桌面通知',
      logStallRecovered: '✅ 連線/生成已恢復正常，已清除逾時提醒',
      logStallProgress: '✅ 偵測到新輸出進展，已清除連線逾時提醒',
      logStallRecoverStop: '🔄 連線/等待已逾時 {mins} 分鐘，自動終止目前對話並準備發送「{prompt}」',
      logStallRecoverDirect: '🔄 連線/等待已逾時 {mins} 分鐘，未偵測到停止按鈕，直接自動發送「{prompt}」',
      logStallRecoverSent: '🔄 逾時自動恢復完成：已發送「{prompt}」 ({count}/{max})',
      logStallRecoverDraftSkip: '⚠️ 輸入框已有未發送內容，已跳過逾時自動發送「{prompt}」',
      logStallRecoverFailed: '⚠️ 逾時自動恢復未能完成（未找到輸入框或停止未生效），請手動檢查',
      logStallRecoverLimit: '⚠️ 已達單次任務逾時自動恢復上限 ({count}/{max})，停止自動重試',
      logStallRecoverOn: '🔄 連線逾時自動終止並繼續已開啟',
      logStallRecoverOff: '🔄 連線逾時自動終止並繼續已關閉',
      logAddedAllowKw: '➕ 已新增自訂允許詞：「{text}」',
      logAddedContKw: '➕ 已新增自訂繼續詞：「{text}」',
      tagAlwaysAllow: '始終允許',
      tagSingleAllow: '允許',
      popupTitle: 'Gemini MCP 助手',
      popupSubtitle: '自動允許 · 多語言黑白模式 · 防誤觸熔斷',
      popupBetaNotice: '✅ 正式發布版 (v1.0.0)',
      popupMasterTitle: '總開關',
      popupThemeLight: '☀️ 淺色模式',
      popupThemeDark: '🌙 深色模式',
      popupStatAllow: '今日允許',
      popupStatContinue: '今日繼續',
      popupStatLive: '目前狀態',
      livePending: '待偵測',
      liveNeedsReload: '請重新整理 Gemini',
      liveNoTab: '未開啟 Gemini',
      liveTripped: '已熔斷',
      livePaused: '已暫停',
      liveStall: '連線逾時',
      liveStandby: '非對話待機',
      liveBgReady: '背景就緒',
      liveMonitoring: '監控中',
      secCore: '核心自動化',
      lblAutoAllow: '自動點擊 MCP「始終允許」',
      lblPreferAlways: '優先選擇「始終允許」（推薦）',
      lblFallbackSingle: '無始終允許時回退點「允許一次」',
      lblAutoContinue: '自動點擊下方「繼續」按鈕',
      lblBgMode: '背景靜默運行（切屏 / 最小化不中斷）',
      lblPreventDiscard: '防止 Chrome 休眠丟棄 Gemini 分頁',
      lblShowHud: '在 Gemini 頁面顯示懸浮窗',
      secBreaker: '防刷額度熔斷保護',
      lblMaxTask: '單次任務繼續上限',
      lblDailyCap: '每日繼續總上限 (0=無上限)',
      lblCooldown: '繼續冷卻 (秒)',
      lblSettle: '輸出停穩等待 (秒)',
      lblStopCompletion: '偵測到「全部完成」等完工訊號時跳過繼續',
      lblStopStagnant: '輸出無新進展 / 重複時自動熔斷',
      lblStopQuota: '偵測到限流 / 額度 / 報錯提示時立刻熔斷',
      lblHumanPacing: '擬人防降速節流（隨機延遲 + 逐字輸入，降低限流風險）',
      secNotif: '桌面通知提醒 (連線逾時 / 卡死)',
      btnNotifOn: '桌面通知：開啟',
      btnNotifOff: '桌面通知：關閉',
      lblStallEnable: '連線 / 卡死逾時發送電腦桌面通知',
      lblStallMinutes: '連線逾時提醒閾值 (分鐘)',
      lblStallRecoverEnable: '逾時卡住時自動終止對話並發送續接文字',
      lblStallRecoverMinutes: '自動終止續接閾值 (分鐘)',
      lblStallRecoverMax: '單次任務最多自動恢復次數',
      lblStallRecoverPrompt: '自訂續接發送文字',
      phStallRecoverPrompt: '預設：继续，刚才mcp连接断开了',
      btnTestNotif: '測試通知',
      secCustom: '自訂匹配詞（可選，換行或逗號分隔）',
      lblCustomAllow: '額外「始終允許」關鍵詞',
      phCustomAllow: '例如：始終同意、允許此工具',
      lblCustomCont: '額外「繼續」關鍵詞',
      phCustomCont: '例如：繼續下一步、接著寫',
      btnResetStats: '清零計數',
      btnResetHudPos: '復位懸浮窗',
      btnDefaults: '恢復預設',
      btnSave: '儲存設定',
      toastSaved: '設定已儲存並同步至 Gemini 頁面',
      toastSavedBtn: '已儲存設定',
      toastEnabledOn: '已開啟自動助手',
      toastEnabledOff: '已暫停自動助手',
      toastSynced: '開關已即時同步至 Gemini 頁面',
      toastNotifOn: '已開啟桌面通知提醒',
      toastNotifOff: '已關閉桌面通知提醒',
      toastThemeLight: '已切換為淺色（白晝）模式',
      toastThemeDark: '已切換為深色（夜間）模式',
      toastLangChanged: '介面語言已切換',
      toastHudPosReset: '已將懸浮窗重設回右下角預設位置',
      toastTestNotifUnsupported: '目前環境不支援發送桌面通知',
      toastTestNotifFailed: '通知發送失敗，請檢查系統與 Chrome 通知權限',
      toastTestNotifSent: '已發送測試桌面通知，請查看螢幕右下角',
      toastDefaultsRestored: '已恢復預設安全設定',
      toastEmergencySent: '已向 Gemini 分頁發送緊急停止指令',
      toastNeedsReload: '偵測到 Gemini 頁面，請先按 F5 重新整理後重試',
      toastNoGeminiTab: '目前未偵測到已開啟的 Gemini 分頁',
      toastBreakerReset: '已解除熔斷並重設本次任務計數',
      toastStatsReset: '今日統計計數已清零',
      bgNotifStallTitle: 'Gemini 連線已超過 {mins} 分鐘',
      bgNotifStallMsg: '偵測到該對話連續連線/等待超過 {mins} 分鐘仍無新進展，點擊此處立即切回對應分頁檢查。',
      bgNotifTestTitle: 'KenEasy Gemini MCP 助手 · 桌面通知正常',
      bgNotifTestMsg: '當 Gemini 連線或等待逾時無進展時，系統將彈出此類提醒，點擊即可切回對應分頁。',
      bgNotifBreakerTitle: 'Gemini 自動助手已觸發安全熔斷',
      bgNotifBreakerMsg: '{reason}。點擊此處切回對應 Gemini 分頁查看。',
      scopeChat: '本對話',
      scopeGlobal: '全域預設',
      scopeChatCustom: '本對話獨立設定',
      scopeFollowGlobal: '跟隨全域',
      scopeResetBtn: '恢復全域',
      scopeResetTip: '清除本對話獨立開關並恢復跟隨全域設定',
      scopeChatTip: '目前僅修改此對話的獨立開關（不影響其他對話）',
      scopeGlobalTip: '目前修改全域預設開關（對未單獨設定的對話生效）',
      chatLabelNew: '新對話',
      chatLabelId: '對話 #{id}',
      chatLabelGem: 'Gem · {id}',
      secCurrentChat: '目前對話獨立控制',
      secGlobalSettings: '全域預設設定',
      chatEmergencyBtn: '僅停本對話',
      chatResumeBtn: '解除本對話',
      btnEmergencyAll: '停止全部對話',
      toastChatUpdated: '已更新目前對話的獨立設定',
      toastChatReset: '目前對話已恢復跟隨全域預設',
      toastEmergencyChatSent: '已單獨緊急停止目前對話（其他對話不受影響）',
      toastEmergencyAllSent: '已向全部 Gemini 分頁發送緊急停止指令',
      logChatOverrideSet: '🎛️ 本對話獨立設定：{key} -> {val}',
      logChatOverrideCleared: '↩️ 本對話已恢復跟隨全域預設設定',
      logChatEmergencyRestored: '🛑 已恢復此對話的獨立緊急停止狀態',
      logMainWorldRetry: '⚡ 背景主世界點擊升級：「{label}」 ({attempt}/{max})',
      chatNoActiveTab: '未偵測到活動對話頁',
      chatOverrideTag: '獨立',
      chatEmergencyHint: '僅停止目前對話，不影響其他分頁或對話',
      lblChatEnabled: '本對話總開關',
      lblChatAllow: '自動始終允許',
      lblChatContinue: '自動點擊繼續',
      lblChatBackground: '背景 / 最小化運行',
      lblChatNotif: '桌面逾時通知',
      lblChatRecover: '逾時自動續接'
    },
    en: {
      langLabel: 'EN',
      hudTitle: 'MCP Helper',
      betaBadge: 'v1.0.0',
      betaBadgeTitle: 'Stable Release (v1.0.0)',
      hudTitleTip: 'Hold & drag to move · Click title to collapse · v1.0.0',
      minBtnTitle: 'Minimize / Expand',
      themeToggleToLight: 'Switch to Light Mode',
      themeToggleToDark: 'Switch to Dark Mode',
      langCycleTip: 'Switch Language (简/繁/EN/日)',
      hudRowMaster: 'Extension',
      hudRowAllow: 'Auto Always Allow',
      hudRowContinue: 'Auto Continue',
      hudRowBackground: 'Background Run',
      hudRowNotif: 'Desktop Alert',
      hudRowStallRecover: 'Stall Auto-Resume',
      stateRunning: 'Active',
      statePaused: 'Paused',
      stateOn: 'On',
      stateOff: 'Off',
      stateForeground: 'FG Only',
      notifPillEnableTip: 'Enable stall timeout desktop notification',
      notifPillDisableTip: 'Disable stall timeout desktop notification',
      stallRecoverPillEnableTip: 'Enable auto-stop & send continue on stall timeout',
      stallRecoverPillDisableTip: 'Disable auto-stop & send continue on stall timeout',
      btnForceRecover: 'Resume Now',
      btnForceRecoverTip: 'Immediately stop current turn and send "{prompt}"',
      popupBtnForceRecover: '⚡ Stop & Send Continue Now',
      toastForceRecoverSent: '⚡ Triggered immediate stop & resume',
      toastForceRecoverNoTarget: 'No stop button or prompt input found on page',
      hudWaitElapsed: '⏳ Waiting {elapsed} / {limit}m limit',
      hudWaitConnecting: '⏳ {label} · {elapsed} / {limit}m',
      hudWaitElapsedNoLimit: '⏳ Waiting · {elapsed}',
      hudWaitConnectingNoLimit: '⏳ {label} · {elapsed}',
      hudStatusForceStopping: '⚡ Manual trigger: stopping turn to send "{prompt}"...',
      logForceRecoverStop: '⚡ Manual trigger: stopped current turn, preparing to send "{prompt}"',
      logForceRecoverDirect: '⚡ Manual trigger: no stop button found, sending "{prompt}" directly',
      logForceRecoverSent: '⚡ Manual resume complete: sent "{prompt}"',
      logForceRecoverNoTarget: '⚠️ No stop button or input box found; cannot force resume',
      liveWaiting: 'Wait {elapsed}',
      btnEmergency: 'E-Stop',
      btnResetBreaker: 'Reset Trip',
      btnInspect: 'Inspect',
      btnLogs: 'Logs',
      hudInit: 'Initializing...',
      hudCounts: 'Allow {allow} · Task {task}/{max} · Today {daily}/{cap}',
      hudStatusBreaker: 'Tripped: {reason}',
      hudStatusPaused: 'Monitoring paused',
      hudStatusStallFallback: '⚠️ Connection stalled',
      hudStatusGenerating: 'Gemini streaming (waiting to settle)',
      hudStatusMonitoring: 'Monitoring',
      hudStatusNonChat: 'Non-chat page (idle guard active)',
      hudStatusClickedAllow: 'Auto-clicked "{label}"',
      hudStatusClickedContinue: 'Clicked Continue ({task}/{max})',
      hudStatusRetryClick: 'Retrying "{label}" ({attempt}/{max})',
      hudStatusSkippedCompletion: 'Completion cue "{cue}" detected, skipped',
      hudStatusStallMinutes: '⚠️ Stalled for {mins}+ min with no progress',
      hudStatusStallStopping: '🔄 Stalled {mins}m, stopping turn...',
      hudStatusStallTyping: '✍️ Naturally typing "{prompt}"...',
      hudStatusStallPacing: '⏳ Natural pause before sending "{prompt}"...',
      hudStatusStallSending: '🔄 Sending "{prompt}" to resume...',
      hudStatusStallRecovered: '🔄 Auto-stopped & sent "{prompt}" ({count}/{max})',
      breakerReasonEmergency: 'Manual emergency stop',
      breakerReasonTaskLimit: 'Per-task continue limit reached ({task}/{max})',
      breakerReasonDailyLimit: 'Daily continue cap reached ({daily}/{cap})',
      breakerReasonQuotaError: 'Quota/error detected ("{kw}")',
      breakerReasonStagnant: 'No new output progress (loop guard)',
      logsEmpty: 'No actions logged yet',
      logsClearBtn: 'Clear',
      inspectRefreshBtn: 'Refresh',
      inspectFound: 'Found {count} visible buttons (click to add rule):',
      inspectNone: 'No clickable buttons detected',
      inspectAddAllow: '+Allow',
      inspectAddedAllow: 'Added ✓',
      inspectAddCont: '+Continue',
      inspectAddedCont: 'Added ✓',
      logReady: '🚀 Gemini MCP Auto Helper v1.0.0 ready',
      logClickedAllow: '✅ Auto-clicked [{tag}]: "{label}"',
      logRetriedAllow: '🔁 Background retry Allow: "{label}" ({attempt}/{max})',
      logClickedContinue: '▶️ Auto-clicked Continue: "{label}" ({task}/{max})',
      logRetriedContinue: '🔁 Background retry Continue: "{label}" ({attempt}/{max})',
      logSkippedCompletion: '🛡️ Completion cue "{cue}" detected, skipped "{label}"',
      logBreakerTripped: '🛑 Circuit breaker tripped: {reason}',
      logBreakerCleared: '✅ Circuit breaker cleared and task counter reset',
      logPromptReset: '💬 New user prompt detected, task continue counter reset',
      logPromptClearBreaker: 'New user message detected, auto-reset task continue counter',
      logChatChangedClearBreaker: 'Switched conversation, auto-reset circuit breaker',
      logDailyReset: 'New calendar day, daily counter auto-reset',
      logLimitClearDaily: 'Daily count cleared or cap raised, daily breaker auto-cleared',
      logLimitClearTask: 'Per-task limit raised, task breaker auto-cleared',
      logStallTriggered: '🔔 Stalled for {mins}+ min with no progress, desktop alert sent',
      logStallRecovered: '✅ Connection/generation recovered, stall alert cleared',
      logStallProgress: '✅ New output progress detected, stall alert cleared',
      logStallRecoverStop: '🔄 Stalled for {mins}+ min, auto-stopping turn to send "{prompt}"',
      logStallRecoverDirect: '🔄 Stalled for {mins}+ min (no stop button), sending "{prompt}" directly',
      logStallRecoverSent: '🔄 Stall auto-recovery sent "{prompt}" ({count}/{max})',
      logStallRecoverDraftSkip: '⚠️ Unsent draft in input box, skipped auto-sending "{prompt}"',
      logStallRecoverFailed: '⚠️ Stall auto-recovery could not complete (input unavailable or stop failed)',
      logStallRecoverLimit: '⚠️ Reached max stall auto-recoveries ({count}/{max}) for this task',
      logStallRecoverOn: '🔄 Stall auto-stop & resume enabled',
      logStallRecoverOff: '🔄 Stall auto-stop & resume disabled',
      logAddedAllowKw: '➕ Added custom Allow keyword: "{text}"',
      logAddedContKw: '➕ Added custom Continue keyword: "{text}"',
      tagAlwaysAllow: 'Always Allow',
      tagSingleAllow: 'Allow',
      popupTitle: 'Gemini MCP Helper',
      popupSubtitle: 'Auto-Allow · Multi-Lang & Theme · Safe Guard',
      popupBetaNotice: '✅ Stable Release (v1.0.0)',
      popupMasterTitle: 'Master Switch',
      popupThemeLight: '☀️ Light',
      popupThemeDark: '🌙 Dark',
      popupStatAllow: 'Allowed',
      popupStatContinue: 'Continued',
      popupStatLive: 'Status',
      livePending: 'Checking',
      liveNeedsReload: 'Reload Gemini',
      liveNoTab: 'No Gemini Tab',
      liveTripped: 'Tripped',
      livePaused: 'Paused',
      liveStall: 'Stalled',
      liveStandby: 'Standby',
      liveBgReady: 'BG Ready',
      liveMonitoring: 'Active',
      secCore: 'Core Automation',
      lblAutoAllow: 'Auto-click MCP "Always allow"',
      lblPreferAlways: 'Prefer "Always allow" (Recommended)',
      lblFallbackSingle: 'Fallback to "Allow once" if unavailable',
      lblAutoContinue: 'Auto-click "Continue / Yes" action',
      lblBgMode: 'Run silently in background / minimized',
      lblPreventDiscard: 'Prevent Chrome from discarding Gemini tabs',
      lblShowHud: 'Show floating HUD on Gemini pages',
      secBreaker: '6-Layer Quota Circuit Breaker',
      lblMaxTask: 'Max continues per task',
      lblDailyCap: 'Daily continue cap (0=∞)',
      lblCooldown: 'Continue cooldown (s)',
      lblSettle: 'Output settle wait (s)',
      lblStopCompletion: 'Skip continue when completion cue detected',
      lblStopStagnant: 'Trip breaker on stagnant / repeated output',
      lblStopQuota: 'Trip breaker immediately on rate/quota errors',
      lblHumanPacing: 'Human-like pacing (random delays + natural typing to avoid throttling)',
      secNotif: 'Desktop Stall Notifications',
      btnNotifOn: 'Alerts: ON',
      btnNotifOff: 'Alerts: OFF',
      lblStallEnable: 'Send OS notification on connection stall',
      lblStallMinutes: 'Stall alert threshold (mins)',
      lblStallRecoverEnable: 'Auto-stop & send continue prompt when stalled',
      lblStallRecoverMinutes: 'Auto-recover threshold (mins)',
      lblStallRecoverMax: 'Max auto-recoveries / task',
      lblStallRecoverPrompt: 'Custom reconnect prompt text',
      phStallRecoverPrompt: 'Default: 继续，刚才mcp连接断开了',
      btnTestNotif: 'Test Alert',
      secCustom: 'Custom Keywords (comma or newline separated)',
      lblCustomAllow: 'Extra "Always allow" keywords',
      phCustomAllow: 'e.g. Always permit, Allow this tool',
      lblCustomCont: 'Extra "Continue" keywords',
      phCustomCont: 'e.g. Keep going, Proceed next',
      btnResetStats: 'Reset Stats',
      btnResetHudPos: 'Reset HUD',
      btnDefaults: 'Defaults',
      btnSave: 'Save Settings',
      toastSaved: 'Settings saved and synced to Gemini tabs',
      toastSavedBtn: 'Settings saved',
      toastEnabledOn: 'Automation enabled',
      toastEnabledOff: 'Automation paused',
      toastSynced: 'Changes synced live to Gemini tabs',
      toastNotifOn: 'Desktop notifications enabled',
      toastNotifOff: 'Desktop notifications muted',
      toastThemeLight: 'Switched to Light Mode',
      toastThemeDark: 'Switched to Dark Mode',
      toastLangChanged: 'Language updated',
      toastHudPosReset: 'Floating HUD position reset to bottom-right',
      toastTestNotifUnsupported: 'Desktop notifications unavailable here',
      toastTestNotifFailed: 'Notification failed; check OS & Chrome permissions',
      toastTestNotifSent: 'Test notification sent (check bottom-right)',
      toastDefaultsRestored: 'Safe defaults restored',
      toastEmergencySent: 'Emergency stop sent to Gemini tabs',
      toastNeedsReload: 'Gemini tab found; press F5 to reload and retry',
      toastNoGeminiTab: 'No open Gemini tabs detected',
      toastBreakerReset: 'Breaker reset and task counter cleared',
      toastStatsReset: 'Daily statistics cleared',
      bgNotifStallTitle: 'Gemini stalled for {mins}+ min',
      bgNotifStallMsg: 'No new progress for over {mins} minutes. Click here to jump straight to the Gemini tab.',
      bgNotifTestTitle: 'KenEasy Gemini MCP Helper · Alert Ready',
      bgNotifTestMsg: 'You will receive alerts like this when a Gemini tool call or reply stalls. Click to focus tab.',
      bgNotifBreakerTitle: 'Gemini MCP Helper Circuit Breaker Tripped',
      bgNotifBreakerMsg: '{reason}. Click here to jump back to the Gemini tab.',
      scopeChat: 'This chat',
      scopeGlobal: 'Global',
      scopeChatCustom: 'Custom for this chat',
      scopeFollowGlobal: 'Following global',
      scopeResetBtn: 'Reset',
      scopeResetTip: 'Clear per-chat overrides and follow global defaults',
      scopeChatTip: 'Changes apply only to this conversation',
      scopeGlobalTip: 'Changes apply globally to all conversations without overrides',
      chatLabelNew: 'New chat',
      chatLabelId: 'Chat #{id}',
      chatLabelGem: 'Gem · {id}',
      secCurrentChat: 'This Conversation',
      secGlobalSettings: 'Global Defaults',
      chatEmergencyBtn: 'Stop this chat',
      chatResumeBtn: 'Resume chat',
      btnEmergencyAll: 'Stop All Chats',
      toastChatUpdated: 'Updated settings for this conversation only',
      toastChatReset: 'Conversation reset to global defaults',
      toastEmergencyChatSent: 'Emergency stopped this conversation only',
      toastEmergencyAllSent: 'Emergency stop sent to all Gemini tabs',
      logChatOverrideSet: '🎛️ Chat override: {key} -> {val}',
      logChatOverrideCleared: '↩️ Conversation reset to global defaults',
      logChatEmergencyRestored: '🛑 Restored emergency stop state for this chat',
      logMainWorldRetry: '⚡ Background main-world click escalation: "{label}" ({attempt}/{max})',
      chatNoActiveTab: 'No active chat tab',
      chatOverrideTag: 'Custom',
      chatEmergencyHint: 'Stops only this chat; other chats keep running',
      lblChatEnabled: 'Enable in this chat',
      lblChatAllow: 'Auto Always allow',
      lblChatContinue: 'Auto Continue',
      lblChatBackground: 'Run in background',
      lblChatNotif: 'Stall desktop alerts',
      lblChatRecover: 'Stall auto-resume'
    },
    ja: {
      langLabel: '日本語',
      hudTitle: 'MCP ヘルパー',
      betaBadge: 'v1.0.0',
      betaBadgeTitle: '正式リリース版 (v1.0.0)',
      hudTitleTip: '左押下ドラッグで移動 · クリックで開閉 · v1.0.0',
      minBtnTitle: '最小化 / 展開',
      themeToggleToLight: 'ライトモードへ切替',
      themeToggleToDark: 'ダークモードへ切替',
      langCycleTip: '言語切替 (简/繁/EN/日)',
      hudRowMaster: '状態',
      hudRowAllow: '常に許可',
      hudRowContinue: '自動続行',
      hudRowBackground: 'バックグラウンド',
      hudRowNotif: 'デスクトップ通知',
      hudRowStallRecover: '停滞自動再開',
      stateRunning: '稼働中',
      statePaused: '停止中',
      stateOn: 'オン',
      stateOff: 'オフ',
      stateForeground: '前面のみ',
      notifPillEnableTip: 'タイムアウト通知を有効にする',
      notifPillDisableTip: 'タイムアウト通知を無効にする',
      stallRecoverPillEnableTip: '停滞タイムアウト時の自動停止＆続行送信を有効にする',
      stallRecoverPillDisableTip: '停滞タイムアウト時の自動停止＆続行送信を無効にする',
      btnForceRecover: '今すぐ再開',
      btnForceRecoverTip: '現在の応答を即座に停止し「{prompt}」を送信',
      popupBtnForceRecover: '⚡ 今すぐ停止して続行送信',
      toastForceRecoverSent: '⚡ 即時停止＆再開を実行しました',
      toastForceRecoverNoTarget: '停止ボタンまたは入力欄が見つかりません',
      hudWaitElapsed: '⏳ 待機中 {elapsed} / 閾値 {limit}分',
      hudWaitConnecting: '⏳ {label} · {elapsed} / {limit}分',
      hudWaitElapsedNoLimit: '⏳ 応答待機中 · {elapsed}',
      hudWaitConnectingNoLimit: '⏳ {label} · {elapsed}',
      hudStatusForceStopping: '⚡ 手動実行：応答を停止して「{prompt}」を送信準備中...',
      logForceRecoverStop: '⚡ 手動実行：応答を停止し「{prompt}」を送信準備中',
      logForceRecoverDirect: '⚡ 手動実行：停止ボタンなし、「{prompt}」を直接送信',
      logForceRecoverSent: '⚡ 手動再開完了：「{prompt}」を送信しました',
      logForceRecoverNoTarget: '⚠️ 停止ボタンや入力欄が見つからないため再開できません',
      liveWaiting: '待機 {elapsed}',
      btnEmergency: '緊急停止',
      btnResetBreaker: '解除',
      btnInspect: '検出',
      btnLogs: 'ログ',
      hudInit: '初期化中...',
      hudCounts: '許可 {allow} · 今回 {task}/{max} · 本日 {daily}/{cap}',
      hudStatusBreaker: '遮断: {reason}',
      hudStatusPaused: '監視一時停止中',
      hudStatusStallFallback: '⚠️ 接続タイムアウト',
      hudStatusGenerating: 'Gemini 生成中（完了後に判定）',
      hudStatusMonitoring: '監視中',
      hudStatusNonChat: 'チャット外ページ（待機中）',
      hudStatusClickedAllow: '自動クリック済: 「{label}」',
      hudStatusClickedContinue: '続行クリック ({task}/{max})',
      hudStatusRetryClick: '再試行クリック「{label}」({attempt}/{max})',
      hudStatusSkippedCompletion: '完了フレーズ「{cue}」を検出、スキップ',
      hudStatusStallMinutes: '⚠️ {mins}分以上進展なし（応答停滞）',
      hudStatusStallStopping: '🔄 {mins}分停滞を検出、応答を停止中...',
      hudStatusStallTyping: '✍️ 「{prompt}」を自然入力中...',
      hudStatusStallPacing: '⏳ 制限回避の自然待機後、「{prompt}」を送信します...',
      hudStatusStallSending: '🔄 「{prompt}」を自動送信して再開中...',
      hudStatusStallRecovered: '🔄 自動停止して「{prompt}」を送信 ({count}/{max})',
      breakerReasonEmergency: '手動緊急停止',
      breakerReasonTaskLimit: '1タスクあたりの続行上限 ({task}/{max})',
      breakerReasonDailyLimit: '1日の続行総上限 ({daily}/{cap})',
      breakerReasonQuotaError: '制限・エラーを検出（「{kw}」）',
      breakerReasonStagnant: '出力進展なし（ループ防止）',
      logsEmpty: '操作ログはありません',
      logsClearBtn: '消去',
      inspectRefreshBtn: '更新',
      inspectFound: '{count} 個のボタンを検出（クリックで追加）：',
      inspectNone: '操作可能なボタンが見つかりません',
      inspectAddAllow: '+許可語',
      inspectAddedAllow: '追加済 ✓',
      inspectAddCont: '+続行語',
      inspectAddedCont: '追加済 ✓',
      logReady: '🚀 Gemini MCP Auto Helper v1.0.0 準備完了',
      logClickedAllow: '✅ 自動クリック[{tag}]: 「{label}」',
      logRetriedAllow: '🔁 バックグラウンド再試行(許可): 「{label}」 ({attempt}/{max})',
      logClickedContinue: '▶️ 自動続行クリック: 「{label}」 ({task}/{max})',
      logRetriedContinue: '🔁 バックグラウンド再試行(続行): 「{label}」 ({attempt}/{max})',
      logSkippedCompletion: '🛡️ 完了フレーズ「{cue}」を検出、「{label}」をスキップ',
      logBreakerTripped: '🛑 回路遮断: {reason}',
      logBreakerCleared: '✅ 遮断を解除しタスクカウントをリセットしました',
      logPromptReset: '💬 新しいプロンプトを検出、今回カウントをリセット',
      logPromptClearBreaker: '新しいメッセージを検出、タスク続行上限をリセット',
      logChatChangedClearBreaker: '会話を切り替え、遮断状態を自動リセット',
      logDailyReset: '日付変更により本日のカウントを自動リセット',
      logLimitClearDaily: '本日カウント消去または上限引き上げにより遮断解除',
      logLimitClearTask: 'タスク上限引き上げにより遮断解除',
      logStallTriggered: '🔔 {mins}分以上進展なしのためデスクトップ通知を送信',
      logStallRecovered: '✅ 接続・生成が回復、停滞アラートを解除',
      logStallProgress: '✅ 新しい出力を検出、停滞アラートを解除',
      logStallRecoverStop: '🔄 {mins}分以上停滞のため応答を自動停止し「{prompt}」を送信準備中',
      logStallRecoverDirect: '🔄 {mins}分以上停滞（停止ボタンなし）、「{prompt}」を直接送信',
      logStallRecoverSent: '🔄 停滞自動再開完了：「{prompt}」を送信しました ({count}/{max})',
      logStallRecoverDraftSkip: '⚠️ 入力欄に未送信テキストがあるため「{prompt}」の自動送信をスキップ',
      logStallRecoverFailed: '⚠️ 停滞自動再開を完了できませんでした（入力欄未検出または停止失敗）',
      logStallRecoverLimit: '⚠️ 1タスクあたりの停滞自動再開上限 ({count}/{max}) に達しました',
      logStallRecoverOn: '🔄 停滞時の自動停止＆再開を有効にしました',
      logStallRecoverOff: '🔄 停滞時の自動停止＆再開を無効にしました',
      logAddedAllowKw: '➕ カスタム許可語を追加: 「{text}」',
      logAddedContKw: '➕ カスタム続行語を追加: 「{text}」',
      tagAlwaysAllow: '常に許可',
      tagSingleAllow: '許可',
      popupTitle: 'Gemini MCP ヘルパー',
      popupSubtitle: '自動許可 · 多言語 & 白黒テーマ · 誤爆防止',
      popupBetaNotice: '✅ 正式リリース版 (v1.0.0)',
      popupMasterTitle: 'マスタースイッチ',
      popupThemeLight: '☀️ ライト',
      popupThemeDark: '🌙 ダーク',
      popupStatAllow: '本日の許可',
      popupStatContinue: '本日の続行',
      popupStatLive: '現在状態',
      livePending: '確認中',
      liveNeedsReload: 'Geminiを更新',
      liveNoTab: 'Gemini未起動',
      liveTripped: '遮断中',
      livePaused: '一時停止',
      liveStall: '応答停滞',
      liveStandby: '待機中',
      liveBgReady: 'BG待機中',
      liveMonitoring: '監視中',
      secCore: 'コア自動化',
      lblAutoAllow: 'MCP「常に許可」を自動クリック',
      lblPreferAlways: '「常に許可」を優先（推奨）',
      lblFallbackSingle: '常に許可がない場合「1回許可」を実行',
      lblAutoContinue: '下部の「続行 / Yes」を自動クリック',
      lblBgMode: 'バックグラウンド/最小化時も継続実行',
      lblPreventDiscard: 'Chromeのタブ休止（破棄）を防止',
      lblShowHud: 'GeminiページにフローティングHUDを表示',
      secBreaker: '6層クォータ保護サーキットブレーカー',
      lblMaxTask: '1タスクあたりの続行上限',
      lblDailyCap: '1日の続行総上限 (0=無制限)',
      lblCooldown: '続行クールダウン (秒)',
      lblSettle: '出力安定待機 (秒)',
      lblStopCompletion: '完了フレーズ検出時は続行をスキップ',
      lblStopStagnant: '出力停滞・重複時に自動遮断',
      lblStopQuota: '制限・エラー表示時に即時遮断',
      lblHumanPacing: '人間らしい操作ペース（ランダム遅延＋逐次入力で制限リスク低減）',
      secNotif: 'デスクトップ停滞アラート通知',
      btnNotifOn: '通知：オン',
      btnNotifOff: '通知：オフ',
      lblStallEnable: '接続・生成タイムアウト時にデスクトップ通知',
      lblStallMinutes: '停滞アラート閾値 (分)',
      lblStallRecoverEnable: '停滞タイムアウト時に自動停止して続行メッセージを送信',
      lblStallRecoverMinutes: '自動再開の待機閾値 (分)',
      lblStallRecoverMax: '1タスク最大自動再開回数',
      lblStallRecoverPrompt: '再接続時のカスタム送信文言',
      phStallRecoverPrompt: '既定：继续，刚才mcp连接断开了',
      btnTestNotif: '通知テスト',
      secCustom: 'カスタムキーワード（改行・カンマ区切り）',
      lblCustomAllow: '追加の「常に許可」キーワード',
      phCustomAllow: '例：常に同意、ツールを許可',
      lblCustomCont: '追加の「続行」キーワード',
      phCustomCont: '例：次へ進む、続けて',
      btnResetStats: 'カウントリセット',
      btnResetHudPos: 'HUD位置リセット',
      btnDefaults: '初期設定に戻す',
      btnSave: '設定を保存',
      toastSaved: '設定を保存しGeminiタブへ同期しました',
      toastSavedBtn: '設定を保存しました',
      toastEnabledOn: '自動アシスタントを有効にしました',
      toastEnabledOff: '自動アシスタントを一時停止しました',
      toastSynced: '設定をリアルタイム同期しました',
      toastNotifOn: 'デスクトップ通知を有効にしました',
      toastNotifOff: 'デスクトップ通知をオフにしました',
      toastThemeLight: 'ライトモードに切り替えました',
      toastThemeDark: 'ダークモードに切り替えました',
      toastLangChanged: '表示言語を切り替えました',
      toastHudPosReset: 'HUDの位置をデフォルトに戻しました',
      toastTestNotifUnsupported: 'この環境では通知を利用できません',
      toastTestNotifFailed: '通知送信に失敗しました。権限をご確認ください',
      toastTestNotifSent: 'テスト通知を送信しました',
      toastDefaultsRestored: '安全な初期設定に戻しました',
      toastEmergencySent: 'Geminiタブへ緊急停止を送信しました',
      toastNeedsReload: 'GeminiタブをF5で再読み込みしてください',
      toastNoGeminiTab: '開いているGeminiタブが見つかりません',
      toastBreakerReset: '遮断を解除しタスクカウントをリセットしました',
      toastStatsReset: '本日の統計をリセットしました',
      bgNotifStallTitle: 'Geminiの接続が{mins}分以上停滞しています',
      bgNotifStallMsg: '{mins}分以上新しい出力がありません。クリックして該当のGeminiタブへ移動します。',
      bgNotifTestTitle: 'KenEasy Gemini MCP ヘルパー · 通知テスト',
      bgNotifTestMsg: '応答がタイムアウトした際にこのような通知が表示されます。クリックでタブへ移動します。',
      bgNotifBreakerTitle: 'Gemini MCP ヘルパーが安全遮断しました',
      bgNotifBreakerMsg: '{reason}。クリックして該当のGeminiタブを確認します。',
      scopeChat: 'この会話',
      scopeGlobal: '全体設定',
      scopeChatCustom: 'この会話の個別設定',
      scopeFollowGlobal: '全体設定を継承',
      scopeResetBtn: '全体に戻す',
      scopeResetTip: 'この会話の個別設定を解除して全体設定に戻す',
      scopeChatTip: 'この会話のみに独立して設定を適用します',
      scopeGlobalTip: '個別設定のない全会話に共通の既定値を変更します',
      chatLabelNew: '新しい会話',
      chatLabelId: '会話 #{id}',
      chatLabelGem: 'Gem · {id}',
      secCurrentChat: '現在の会話を個別制御',
      secGlobalSettings: '全体の既定設定',
      chatEmergencyBtn: 'この会話を停止',
      chatResumeBtn: 'この会話を再開',
      btnEmergencyAll: '全会話を停止',
      toastChatUpdated: 'この会話の個別設定を更新しました',
      toastChatReset: 'この会話を全体の既定設定に戻しました',
      toastEmergencyChatSent: 'この会話のみ緊急停止しました（他の会話は継続）',
      toastEmergencyAllSent: '全Geminiタブに緊急停止を送信しました',
      logChatOverrideSet: '🎛️ 会話個別設定：{key} -> {val}',
      logChatOverrideCleared: '↩️ この会話を全体設定に戻しました',
      logChatEmergencyRestored: '🛑 この会話の緊急停止状態を復元しました',
      logMainWorldRetry: '⚡ バックグラウンドMain Worldクリック昇格：「{label}」 ({attempt}/{max})',
      chatNoActiveTab: 'アクティブな会話なし',
      chatOverrideTag: '個別',
      chatEmergencyHint: 'この会話のみ停止（他の会話は継続）',
      lblChatEnabled: 'この会話で有効',
      lblChatAllow: '常に許可',
      lblChatContinue: '自動続行',
      lblChatBackground: 'バックグラウンド',
      lblChatNotif: '停滞通知',
      lblChatRecover: '停滞自動再開'
    }
  };

  function resolveLanguage(lang) {
    return SUPPORTED_LANGUAGES.indexOf(lang) >= 0 ? lang : DEFAULT_SETTINGS.language;
  }

  function resolveTheme(theme) {
    return SUPPORTED_THEMES.indexOf(theme) >= 0 ? theme : DEFAULT_SETTINGS.theme;
  }

  function t(lang, key, vars) {
    const code = resolveLanguage(lang);
    const dict = UI_I18N[code] || UI_I18N['zh-CN'];
    let text = Object.prototype.hasOwnProperty.call(dict, key)
      ? dict[key]
      : (UI_I18N['zh-CN'][key] || key);
    if (vars && typeof vars === 'object') {
      for (const k of Object.keys(vars)) {
        text = text.split(`{${k}}`).join(String(vars[k]));
      }
    }
    return text;
  }

  function formatWaitDuration(ms, lang) {
    const num = Number(ms);
    const validMs = Number.isFinite(num) && num > 0 ? num : 0;
    const totalSec = Math.max(0, Math.floor(validMs / 1000));
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    const code = resolveLanguage(lang);
    if (code === 'en') {
      return mins > 0 ? `${mins}m ${String(secs).padStart(2, '0')}s` : `${secs}s`;
    }
    return mins > 0 ? `${mins}分${String(secs).padStart(2, '0')}秒` : `${secs}秒`;
  }

  function getTodayKey(date) {
    const d = date instanceof Date ? date : new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function clampNumber(val, fallback, min, max) {
    const n = Number(val);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, Math.round(n)));
  }

  function sanitizePromptText(val, fallback) {
    if (typeof val !== 'string') return fallback;
    const cleaned = val.replace(/[\r\n]+/g, ' ').trim();
    if (!cleaned) return fallback;
    return cleaned.slice(0, 200);
  }

  const DANGEROUS_OBJECT_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

  function sanitizeKeywordArray(val, fallback) {
    if (!Array.isArray(val)) return Array.isArray(fallback) ? fallback.slice() : [];
    const seen = new Set();
    const out = [];
    for (const item of val) {
      if (typeof item !== 'string') continue;
      const cleaned = item.trim();
      if (!cleaned || DANGEROUS_OBJECT_KEYS.has(cleaned.toLowerCase())) continue;
      const key = cleaned.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        out.push(cleaned);
      }
    }
    return out;
  }

  function parseKeywordInput(text) {
    if (typeof text !== 'string') return [];
    return sanitizeKeywordArray(
      text.split(/[\n,，;；]+/g).map((s) => s.trim()).filter(Boolean),
      []
    );
  }

  function mergeKeywordArrays(baseDefaults, stored) {
    const merged = Array.isArray(baseDefaults) ? baseDefaults.slice() : [];
    if (Array.isArray(stored)) {
      for (const item of stored) merged.push(item);
    }
    return sanitizeKeywordArray(merged, baseDefaults || []);
  }

  function mergeSettings(raw) {
    const src = raw && typeof raw === 'object' ? raw : {};
    return {
      settingsVersion:
        typeof src.settingsVersion === 'number' && Number.isFinite(src.settingsVersion)
          ? src.settingsVersion
          : SETTINGS_VERSION,
      language: resolveLanguage(src.language),
      theme: resolveTheme(src.theme),
      enabled: typeof src.enabled === 'boolean' ? src.enabled : DEFAULT_SETTINGS.enabled,
      autoAllow: typeof src.autoAllow === 'boolean' ? src.autoAllow : DEFAULT_SETTINGS.autoAllow,
      preferAlwaysAllow:
        typeof src.preferAlwaysAllow === 'boolean'
          ? src.preferAlwaysAllow
          : DEFAULT_SETTINGS.preferAlwaysAllow,
      fallbackSingleAllow:
        typeof src.fallbackSingleAllow === 'boolean'
          ? src.fallbackSingleAllow
          : DEFAULT_SETTINGS.fallbackSingleAllow,
      autoContinue:
        typeof src.autoContinue === 'boolean' ? src.autoContinue : DEFAULT_SETTINGS.autoContinue,
      backgroundMode:
        typeof src.backgroundMode === 'boolean'
          ? src.backgroundMode
          : DEFAULT_SETTINGS.backgroundMode,
      preventTabDiscard:
        typeof src.preventTabDiscard === 'boolean'
          ? src.preventTabDiscard
          : DEFAULT_SETTINGS.preventTabDiscard,
      showHud: typeof src.showHud === 'boolean' ? src.showHud : DEFAULT_SETTINGS.showHud,
      hudMinimized:
        typeof src.hudMinimized === 'boolean' ? src.hudMinimized : DEFAULT_SETTINGS.hudMinimized,

      maxContinuesPerTask: clampNumber(
        src.maxContinuesPerTask,
        DEFAULT_SETTINGS.maxContinuesPerTask,
        1,
        100
      ),
      dailyContinueLimit: clampNumber(
        src.dailyContinueLimit,
        DEFAULT_SETTINGS.dailyContinueLimit,
        0,
        10000
      ),
      continueCooldownMs: clampNumber(
        src.continueCooldownMs,
        DEFAULT_SETTINGS.continueCooldownMs,
        1000,
        120000
      ),
      allowCooldownMs: clampNumber(
        src.allowCooldownMs,
        DEFAULT_SETTINGS.allowCooldownMs,
        200,
        30000
      ),
      idleSettleMs: clampNumber(
        src.idleSettleMs,
        DEFAULT_SETTINGS.idleSettleMs,
        400,
        30000
      ),
      stopOnCompletionCues:
        typeof src.stopOnCompletionCues === 'boolean'
          ? src.stopOnCompletionCues
          : DEFAULT_SETTINGS.stopOnCompletionCues,
      stopOnStagnantOutput:
        typeof src.stopOnStagnantOutput === 'boolean'
          ? src.stopOnStagnantOutput
          : DEFAULT_SETTINGS.stopOnStagnantOutput,
      stopOnQuotaOrError:
        typeof src.stopOnQuotaOrError === 'boolean'
          ? src.stopOnQuotaOrError
          : DEFAULT_SETTINGS.stopOnQuotaOrError,

      stallAlertEnabled:
        typeof src.stallAlertEnabled === 'boolean'
          ? src.stallAlertEnabled
          : DEFAULT_SETTINGS.stallAlertEnabled,
      stallAlertMinutes: clampNumber(
        src.stallAlertMinutes,
        DEFAULT_SETTINGS.stallAlertMinutes,
        1,
        60
      ),
      stallAutoRecoverEnabled:
        typeof src.stallAutoRecoverEnabled === 'boolean'
          ? src.stallAutoRecoverEnabled
          : DEFAULT_SETTINGS.stallAutoRecoverEnabled,
      stallAutoRecoverMinutes: clampNumber(
        src.stallAutoRecoverMinutes,
        DEFAULT_SETTINGS.stallAutoRecoverMinutes,
        1,
        60
      ),
      stallAutoRecoverPrompt: sanitizePromptText(
        src.stallAutoRecoverPrompt,
        DEFAULT_SETTINGS.stallAutoRecoverPrompt
      ),
      maxStallRecoveriesPerTask: clampNumber(
        src.maxStallRecoveriesPerTask,
        DEFAULT_SETTINGS.maxStallRecoveriesPerTask,
        1,
        20
      ),
      humanPacingEnabled:
        typeof src.humanPacingEnabled === 'boolean'
          ? src.humanPacingEnabled
          : DEFAULT_SETTINGS.humanPacingEnabled,

      alwaysAllowKeywords: mergeKeywordArrays(
        DEFAULT_SETTINGS.alwaysAllowKeywords,
        src.alwaysAllowKeywords
      ),
      singleAllowKeywords: mergeKeywordArrays(
        DEFAULT_SETTINGS.singleAllowKeywords,
        src.singleAllowKeywords
      ),
      continueKeywords: mergeKeywordArrays(
        DEFAULT_SETTINGS.continueKeywords,
        src.continueKeywords
      ),
      customAlwaysAllowKeywords: sanitizeKeywordArray(
        src.customAlwaysAllowKeywords,
        DEFAULT_SETTINGS.customAlwaysAllowKeywords
      ),
      customContinueKeywords: sanitizeKeywordArray(
        src.customContinueKeywords,
        DEFAULT_SETTINGS.customContinueKeywords
      ),
      denyBlacklistKeywords: mergeKeywordArrays(
        DEFAULT_SETTINGS.denyBlacklistKeywords,
        src.denyBlacklistKeywords
      ),
      completionCueKeywords: mergeKeywordArrays(
        DEFAULT_SETTINGS.completionCueKeywords,
        src.completionCueKeywords
      ),
      truncationCueKeywords: mergeKeywordArrays(
        DEFAULT_SETTINGS.truncationCueKeywords,
        src.truncationCueKeywords
      ),
      quotaErrorKeywords: mergeKeywordArrays(
        DEFAULT_SETTINGS.quotaErrorKeywords,
        src.quotaErrorKeywords
      )
    };
  }

  /**
   * Migrates persisted chrome.storage settings across schema versions once:
   * - v1 -> v3: Updates defaults to 10 continues per task and 0 (unlimited) daily cap
   * - v2 -> v3: Preserves user limits while removing overly broad '开始'/'開始' defaults and adding new i18n keywords
   */
  function migrateStoredSettings(raw) {
    if (!raw || typeof raw !== 'object') {
      return { settings: mergeSettings(null), migrated: false };
    }
    const ver = typeof raw.settingsVersion === 'number' ? raw.settingsVersion : 1;
    if (ver < SETTINGS_VERSION) {
      const cleanedContinue = Array.isArray(raw.continueKeywords)
        ? raw.continueKeywords.filter((k) => k !== '开始' && k !== '開始')
        : raw.continueKeywords;
      const patch = {
        settingsVersion: SETTINGS_VERSION,
        continueKeywords: cleanedContinue
      };
      if (ver < 2) {
        patch.maxContinuesPerTask = DEFAULT_SETTINGS.maxContinuesPerTask;
        patch.dailyContinueLimit = DEFAULT_SETTINGS.dailyContinueLimit;
      }
      if (ver < 5 && (!raw.stallAutoRecoverPrompt || raw.stallAutoRecoverPrompt === '继续')) {
        patch.stallAutoRecoverPrompt = DEFAULT_SETTINGS.stallAutoRecoverPrompt;
      }
      const upgraded = mergeSettings(Object.assign({}, raw, patch));
      return { settings: upgraded, migrated: true };
    }
    return { settings: mergeSettings(raw), migrated: false };
  }

  function normalizeText(str) {
    if (typeof str !== 'string') return '';
    return str
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function stripEdgePunctuation(str) {
    return normalizeText(str)
      .replace(/^[\s•·\-–—>»›↪↳↵↩→➔➜▶▸►✓✔✨\[\]()（）「」『』"'`.,!?！？:：]+|[\s•·\-–—>»›↪↳↵↩→➔➜▶▸►✓✔✨\[\]()（）「」『』"'`.,!?！？:：]+$/g, '')
      .trim();
  }

  function isAsciiWord(str) {
    return /^[a-z0-9\s_-]+$/i.test(str);
  }

  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Checks if normalized text contains a keyword with proper word-boundary protection for ASCII.
   */
  function containsKeyword(rawText, keywords) {
    const norm = normalizeText(rawText);
    if (!norm || !Array.isArray(keywords)) return null;
    for (const kw of keywords) {
      if (typeof kw !== 'string' || !kw) continue;
      // Guard against huge strings that could cause ReDoS or Regexp too large
      if (kw.length > 256) {
        const nkw = normalizeText(kw);
        if (nkw && norm.includes(nkw)) return kw;
        continue;
      }
      const nkw = normalizeText(kw);
      if (!nkw) continue;
      if (isAsciiWord(nkw)) {
        try {
          const re = new RegExp(`(?:^|[^a-z0-9_])${escapeRegex(nkw)}(?:$|[^a-z0-9_])`, 'i');
          if (re.test(norm)) return kw;
        } catch (_) {
          if (norm.includes(nkw)) return kw;
        }
      } else if (norm.includes(nkw)) {
        return kw;
      }
    }
    return null;
  }

  /**
   * Strict button label matcher to avoid clicking long prose or unrelated controls.
   * mode:
   *  - 'exact_or_prefix': exact match OR starts with keyword (for short labels <= maxLen)
   *  - 'exact_or_contains': exact match OR word-boundary contains (for user custom keywords <= maxLen)
   */
  function matchButtonLabel(rawText, keywords, options) {
    const opts = options || {};
    const maxLen = typeof opts.maxLen === 'number' ? opts.maxLen : 42;
    const mode = opts.mode || 'exact_or_prefix';
    const stripped = stripEdgePunctuation(rawText);
    if (!stripped || stripped.length > maxLen) return null;
    if (!Array.isArray(keywords) || keywords.length === 0) return null;

    let partialMatch = null;
    for (const kw of keywords) {
      if (typeof kw !== 'string' || !kw) continue;
      // Keywords longer than maxLen can never match a stripped button label <= maxLen
      if (kw.length > maxLen) continue;
      const nkw = stripEdgePunctuation(kw);
      if (!nkw || nkw.length > maxLen) continue;

      if (stripped === nkw) {
        return { keyword: kw, exact: true };
      }

      if (!partialMatch) {
        if (mode === 'exact_or_prefix') {
          if (isAsciiWord(nkw)) {
            try {
              const re = new RegExp(`^${escapeRegex(nkw)}(?:$|[^a-z0-9_])`, 'i');
              if (re.test(stripped)) {
                partialMatch = { keyword: kw, exact: false };
              }
            } catch (_) {
              if (stripped.startsWith(nkw)) {
                partialMatch = { keyword: kw, exact: false };
              }
            }
          } else if (stripped.startsWith(nkw)) {
            partialMatch = { keyword: kw, exact: false };
          }
        } else if (mode === 'exact_or_contains') {
          if (isAsciiWord(nkw)) {
            try {
              const re = new RegExp(`(?:^|[^a-z0-9_])${escapeRegex(nkw)}(?:$|[^a-z0-9_])`, 'i');
              if (re.test(stripped)) {
                partialMatch = { keyword: kw, exact: false };
              }
            } catch (_) {
              if (stripped.includes(nkw)) {
                partialMatch = { keyword: kw, exact: false };
              }
            }
          } else if (stripped.includes(nkw)) {
            partialMatch = { keyword: kw, exact: false };
          }
        }
      }
    }
    return partialMatch;
  }

  function createEmptyStats(dateKey) {
    return {
      date: dateKey || getTodayKey(),
      allowCount: 0,
      continueCount: 0
    };
  }

  function normalizeStats(raw, dateKey) {
    const today = dateKey || getTodayKey();
    if (!raw || typeof raw !== 'object' || raw.date !== today) {
      return createEmptyStats(today);
    }
    return {
      date: today,
      allowCount: clampNumber(raw.allowCount, 0, 0, 100000),
      continueCount: clampNumber(raw.continueCount, 0, 0, 100000)
    };
  }

  const NON_CHAT_SEGMENT_RE = /^(?:gems|extensions|saved-info|plugins|updates|sharing|settings|faq|advanced|pricing|about)$/i;

  function extractConversationKey(url) {
    if (typeof url !== 'string' || !url.trim()) return null;
    let pathname = '';
    try {
      const parsed = new URL(url, 'https://gemini.google.com');
      pathname = parsed.pathname || '';
    } catch (_) {
      const m = url.match(/^https?:\/\/[^/]+([^?#]*)/i);
      pathname = m ? m[1] : url;
    }
    const stripped = pathname.replace(/^\/u\/\d+(?=\/|$)/i, '').replace(/\/+$/, '');
    if (!stripped || stripped === '/app') return 'landing';

    const parts = stripped.split('/').filter(Boolean);
    if (parts.length === 0) return 'landing';
    if (NON_CHAT_SEGMENT_RE.test(parts[0])) return null;

    if (parts[0].toLowerCase() === 'app' && parts[1]) {
      const id = parts[1].trim();
      if (!id || DANGEROUS_OBJECT_KEYS.has(id.toLowerCase())) return null;
      return `chat:${id.slice(0, 128)}`;
    }
    if (parts[0].toLowerCase() === 'gem' && parts[1]) {
      const gemId = parts[1].trim();
      if (!gemId || DANGEROUS_OBJECT_KEYS.has(gemId.toLowerCase())) return null;
      if (parts[2]) {
        const chatId = parts[2].trim();
        if (!chatId || DANGEROUS_OBJECT_KEYS.has(chatId.toLowerCase())) return null;
        return `gem:${gemId.slice(0, 64)}:${chatId.slice(0, 128)}`;
      }
      return `gem:${gemId.slice(0, 64)}`;
    }
    const fallbackKey = parts.join(':').slice(0, 128);
    if (!fallbackKey || DANGEROUS_OBJECT_KEYS.has(fallbackKey.toLowerCase())) return null;
    return `page:${fallbackKey}`;
  }

  function sanitizeChatOverride(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    const out = {};
    for (const key of CHAT_OVERRIDE_KEYS) {
      if (Object.prototype.hasOwnProperty.call(raw, key) && typeof raw[key] === 'boolean') {
        out[key] = raw[key];
      }
    }
    if (raw.emergencyStopped === true) {
      out.emergencyStopped = true;
    }
    if (typeof raw.updatedAt === 'number' && Number.isFinite(raw.updatedAt) && raw.updatedAt > 0) {
      out.updatedAt = Math.round(raw.updatedAt);
    }
    return out;
  }

  function hasChatOverrideChanges(override) {
    if (!override || typeof override !== 'object') return false;
    if (override.emergencyStopped === true) return true;
    for (const key of CHAT_OVERRIDE_KEYS) {
      if (typeof override[key] === 'boolean') return true;
    }
    return false;
  }

  function sanitizeChatOverridesMap(raw, maxEntries) {
    const cap = typeof maxEntries === 'number' && maxEntries > 0 ? Math.round(maxEntries) : MAX_CHAT_OVERRIDES;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    const entries = [];
    for (const key of Object.keys(raw)) {
      if (!key || key.length > 160 || DANGEROUS_OBJECT_KEYS.has(key.toLowerCase())) continue;
      const cleaned = sanitizeChatOverride(raw[key]);
      if (!hasChatOverrideChanges(cleaned)) continue;
      entries.push([key, cleaned]);
    }
    if (entries.length > cap) {
      entries.sort((a, b) => (b[1].updatedAt || 0) - (a[1].updatedAt || 0));
      entries.length = cap;
    }
    const out = {};
    for (const [key, val] of entries) {
      out[key] = val;
    }
    return out;
  }

  function resolveEffectiveSettings(globalSettings, chatOverride) {
    const base = mergeSettings(globalSettings);
    if (!chatOverride || typeof chatOverride !== 'object') return base;
    const effective = Object.assign({}, base);
    for (const key of CHAT_OVERRIDE_KEYS) {
      if (typeof chatOverride[key] === 'boolean') {
        effective[key] = chatOverride[key];
      }
    }
    return effective;
  }

  function formatConversationLabel(chatKey, lang) {
    if (!chatKey || chatKey === 'landing') {
      return t(lang, 'chatLabelNew');
    }
    if (chatKey.startsWith('chat:')) {
      const id = chatKey.slice(5);
      return t(lang, 'chatLabelId', { id: id.length > 8 ? id.slice(0, 8) : id });
    }
    if (chatKey.startsWith('gem:')) {
      const rest = chatKey.slice(4);
      const id = rest.length > 10 ? rest.slice(0, 10) : rest;
      return t(lang, 'chatLabelGem', { id });
    }
    const shortKey = chatKey.length > 12 ? chatKey.slice(0, 12) : chatKey;
    return t(lang, 'chatLabelId', { id: shortKey });
  }

  const api = {
    STORAGE_KEY,
    STATS_KEY,
    CHAT_OVERRIDES_KEY,
    CHAT_OVERRIDE_KEYS,
    MAX_CHAT_OVERRIDES,
    SETTINGS_VERSION,
    SUPPORTED_LANGUAGES,
    SUPPORTED_THEMES,
    DEFAULT_SETTINGS,
    UI_I18N,
    resolveLanguage,
    resolveTheme,
    t,
    formatWaitDuration,
    getTodayKey,
    mergeSettings,
    migrateStoredSettings,
    parseKeywordInput,
    normalizeText,
    stripEdgePunctuation,
    containsKeyword,
    matchButtonLabel,
    createEmptyStats,
    normalizeStats,
    extractConversationKey,
    sanitizeChatOverride,
    hasChatOverrideChanges,
    sanitizeChatOverridesMap,
    resolveEffectiveSettings,
    formatConversationLabel
  };

  root.GMAH_DEFAULTS = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : window);
