(function (root) {
  'use strict';

  const STORAGE_KEY = 'gmah_settings_v1';
  const STATS_KEY = 'gmah_stats_v1';

  const DEFAULT_SETTINGS = {
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
    maxContinuesPerTask: 5,
    dailyContinueLimit: 30,
    continueCooldownMs: 4000,
    allowCooldownMs: 600,
    idleSettleMs: 1800,
    stopOnCompletionCues: true,
    stopOnStagnantOutput: true,
    stopOnQuotaOrError: true,

    // Keyword lists
    alwaysAllowKeywords: [
      '始终允许',
      '一律允许',
      '总是允许',
      '始終允許',
      '一律允許',
      '總是允許',
      '在此对话中始终允许',
      '在此對話中總是允許',
      '在此对话中允许',
      '在此對話中允許',
      '在此会话中始终允许',
      '本次会话始终允许',
      '本次对话始终允许',
      '始终允许此工具',
      '始終允許此工具',
      'always allow',
      'always allow this tool',
      'allow always',
      'allow for this chat',
      'allow in this chat',
      'allow for this session',
      'allow all in this chat',
      'allow all'
    ],
    singleAllowKeywords: [
      '允许',
      '允许一次',
      '仅允许一次',
      '允許',
      '允許一次',
      '僅允許一次',
      '批准',
      'allow',
      'allow once',
      'approve'
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
      '继续下一步',
      '点击继续',
      '请继续',
      '繼續',
      '繼續生成',
      '繼續執行',
      '繼續完成',
      '繼續輸出',
      '繼續處理',
      '繼續運行',
      '繼續操作',
      '繼續回覆',
      '繼續下一步',
      '點擊繼續',
      '請繼續',
      'continue',
      'continue generating',
      'continue response',
      'continue working',
      'continue task',
      'click to continue',
      'keep going',
      'resume'
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
      'report'
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
      'all tests passed'
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
      'output limit'
    ],

    // Quota / rate-limit / error cues: immediately trip circuit breaker
    quotaErrorKeywords: [
      'reached your limit',
      'usage limit',
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
      '出了點問題'
    ]
  };

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

  function sanitizeKeywordArray(val, fallback) {
    if (!Array.isArray(val)) return fallback.slice();
    const seen = new Set();
    const out = [];
    for (const item of val) {
      if (typeof item !== 'string') continue;
      const cleaned = item.trim();
      if (!cleaned) continue;
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

  function mergeSettings(raw) {
    const src = raw && typeof raw === 'object' ? raw : {};
    return {
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
        1,
        500
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

      alwaysAllowKeywords: sanitizeKeywordArray(
        src.alwaysAllowKeywords,
        DEFAULT_SETTINGS.alwaysAllowKeywords
      ),
      singleAllowKeywords: sanitizeKeywordArray(
        src.singleAllowKeywords,
        DEFAULT_SETTINGS.singleAllowKeywords
      ),
      continueKeywords: sanitizeKeywordArray(
        src.continueKeywords,
        DEFAULT_SETTINGS.continueKeywords
      ),
      customAlwaysAllowKeywords: sanitizeKeywordArray(
        src.customAlwaysAllowKeywords,
        DEFAULT_SETTINGS.customAlwaysAllowKeywords
      ),
      customContinueKeywords: sanitizeKeywordArray(
        src.customContinueKeywords,
        DEFAULT_SETTINGS.customContinueKeywords
      ),
      denyBlacklistKeywords: sanitizeKeywordArray(
        src.denyBlacklistKeywords,
        DEFAULT_SETTINGS.denyBlacklistKeywords
      ),
      completionCueKeywords: sanitizeKeywordArray(
        src.completionCueKeywords,
        DEFAULT_SETTINGS.completionCueKeywords
      ),
      truncationCueKeywords: sanitizeKeywordArray(
        src.truncationCueKeywords,
        DEFAULT_SETTINGS.truncationCueKeywords
      ),
      quotaErrorKeywords: sanitizeKeywordArray(
        src.quotaErrorKeywords,
        DEFAULT_SETTINGS.quotaErrorKeywords
      )
    };
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
      .replace(/^[\s•·\-–—>»›\[\]()（）「」『』"'`.,!?！？:：]+|[\s•·\-–—>»›\[\]()（）「」『』"'`.,!?！？:：]+$/g, '')
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
      const nkw = normalizeText(kw);
      if (!nkw) continue;
      if (isAsciiWord(nkw)) {
        const re = new RegExp(`(?:^|[^a-z0-9_])${escapeRegex(nkw)}(?:$|[^a-z0-9_])`, 'i');
        if (re.test(norm)) return kw;
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
      const nkw = stripEdgePunctuation(kw);
      if (!nkw) continue;

      if (stripped === nkw) {
        return { keyword: kw, exact: true };
      }

      if (!partialMatch) {
        if (mode === 'exact_or_prefix') {
          if (isAsciiWord(nkw)) {
            const re = new RegExp(`^${escapeRegex(nkw)}(?:$|[^a-z0-9_])`, 'i');
            if (re.test(stripped)) {
              partialMatch = { keyword: kw, exact: false };
            }
          } else if (stripped.startsWith(nkw)) {
            partialMatch = { keyword: kw, exact: false };
          }
        } else if (mode === 'exact_or_contains') {
          if (isAsciiWord(nkw)) {
            const re = new RegExp(`(?:^|[^a-z0-9_])${escapeRegex(nkw)}(?:$|[^a-z0-9_])`, 'i');
            if (re.test(stripped)) {
              partialMatch = { keyword: kw, exact: false };
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

  const api = {
    STORAGE_KEY,
    STATS_KEY,
    DEFAULT_SETTINGS,
    getTodayKey,
    mergeSettings,
    parseKeywordInput,
    normalizeText,
    stripEdgePunctuation,
    containsKeyword,
    matchButtonLabel,
    createEmptyStats,
    normalizeStats
  };

  root.GMAH_DEFAULTS = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : window);
