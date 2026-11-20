(function (root) {
  'use strict';

  const D =
    root.GMAH_DEFAULTS ||
    (typeof require === 'function' ? require('./defaults.js') : null);

  if (!D) {
    throw new Error('GMAH_DEFAULTS must be loaded before content.js');
  }

  const INTERACTIVE_SELECTOR = [
    'button',
    '[role="button"]',
    'a[role="button"]',
    'mat-chip',
    'mat-chip-option',
    '.mat-mdc-chip',
    '[data-test-id*="button"]',
    '[data-test-id*="chip"]',
    '[data-test-id*="continue"]',
    '[data-test-id*="allow"]',
    '[data-test-id*="approve"]',
    '.suggestion-chip',
    '.follow-up-chip'
  ].join(',');

  const STOP_BUTTON_SELECTORS = [
    'button[aria-label*="Stop" i]',
    'button[aria-label*="停止"]',
    'button[aria-label*="取消生成"]',
    'button[aria-label*="Stop generating" i]',
    '[data-test-id*="stop-button"]',
    '[data-test-id*="stop_button"]',
    'button.stop-button',
    '.send-button.stop'
  ];

  const LOADING_SELECTORS = [
    '[aria-busy="true"]',
    '.response-streaming',
    '.streaming-indicator',
    'mat-progress-spinner',
    'mat-progress-bar',
    '.pending-response'
  ];

  const TURN_SELECTORS = [
    'model-response',
    '.model-response',
    '[data-message-author-role="model"]',
    '.response-container',
    'message-content'
  ];

  const ALERT_SELECTORS = [
    '[role="alert"]',
    '.error-message',
    '.quota-warning',
    '.rate-limit-banner',
    'mat-snack-bar-container'
  ];

  const STOP_BUTTON_COMBINED_SELECTOR = STOP_BUTTON_SELECTORS.join(',');
  const LOADING_COMBINED_SELECTOR = LOADING_SELECTORS.join(',');
  const ALERT_COMBINED_SELECTOR = ALERT_SELECTORS.join(',');

  function formatTime(date) {
    const d = date instanceof Date ? date : new Date();
    return [d.getHours(), d.getMinutes(), d.getSeconds()]
      .map((n) => String(n).padStart(2, '0'))
      .join(':');
  }

  function isIgnoredAncestor(el) {
    let cur = el;
    if (cur && cur.nodeType !== 1) {
      cur = cur.parentElement || cur.parentNode || null;
      if (cur && cur.nodeType === 11 && cur.host) cur = cur.host;
    }
    while (cur && cur.nodeType === 1) {
      if (cur.id === 'gmah-hud') return true;
      if (cur.getAttribute && cur.getAttribute('data-gmah-ignore') === 'true') return true;
      const tag = (cur.tagName || '').toUpperCase();
      if (
        tag === 'NAV' ||
        tag === 'ASIDE' ||
        tag === 'HEADER' ||
        tag === 'PRE' ||
        tag === 'CODE' ||
        tag === 'TEXTAREA' ||
        tag === 'INPUT' ||
        tag === 'SCRIPT' ||
        tag === 'STYLE'
      ) {
        return true;
      }
      if (cur.getAttribute) {
        const role = (cur.getAttribute('role') || '').toLowerCase();
        if (role === 'navigation' || role === 'menubar' || role === 'menu') return true;
        if (cur.getAttribute('contenteditable') === 'true') return true;
        const testId = (cur.getAttribute('data-test-id') || '').toLowerCase();
        if (testId.includes('conversation-list') || testId.includes('sidebar') || testId.includes('sidenav')) {
          return true;
        }
      }
      cur = cur.parentElement || (cur.getRootNode && cur.getRootNode().host) || null;
    }
    return false;
  }

  function isElementVisible(el, win, doc) {
    if (!el || el.nodeType !== 1) return false;
    if (el.disabled === true || el.hidden === true) return false;
    if (el.getAttribute) {
      if (el.getAttribute('aria-disabled') === 'true') return false;
      if (el.getAttribute('aria-hidden') === 'true') return false;
    }

    const w = win || (typeof window !== 'undefined' ? window : null);
    const d = doc || (el.ownerDocument || (typeof document !== 'undefined' ? document : null));

    // Walk element & ancestors so hidden parents (display:none / visibility:hidden / hidden) are always caught,
    // including when the browser window is minimized or in a background tab.
    let cur = el;
    while (cur && cur.nodeType === 1) {
      if (cur.hidden === true) return false;
      if (cur.getAttribute && cur.getAttribute('aria-hidden') === 'true') return false;
      if (w && typeof w.getComputedStyle === 'function') {
        try {
          const style = w.getComputedStyle(cur);
          if (style) {
            if (style.display === 'none' || style.visibility === 'hidden') return false;
            if (style.opacity !== '' && parseFloat(style.opacity) === 0) return false;
            if (cur === el && style.pointerEvents === 'none') return false;
          }
        } catch (_) {
          // Ignore computed style errors in exotic nodes
        }
      }
      cur = cur.parentElement || (cur.getRootNode && cur.getRootNode().host) || null;
    }

    // When the window is minimized on some OSes, innerWidth/innerHeight can report 0 and
    // getBoundingClientRect() may return 0x0 even for genuinely interactive elements.
    const isWindowMinimized = Boolean(
      d && d.hidden === true && w && w.innerWidth === 0 && w.innerHeight === 0
    );

    if (!isWindowMinimized && typeof el.getBoundingClientRect === 'function') {
      try {
        const rect = el.getBoundingClientRect();
        if (rect && rect.width === 0 && rect.height === 0) return false;
      } catch (_) {
        // Ignore
      }
    }
    return true;
  }

  function isIconOrDecorativeNode(node) {
    if (!node || node.nodeType !== 1) return false;
    const tag = (node.tagName || '').toUpperCase();
    if (
      tag === 'MAT-ICON' ||
      tag === 'SVG' ||
      tag === 'IMG' ||
      tag === 'SCRIPT' ||
      tag === 'STYLE'
    ) {
      return true;
    }
    if (node.hidden === true) return true;
    if (node.style && (node.style.display === 'none' || node.style.visibility === 'hidden')) {
      return true;
    }
    if (node.getAttribute && node.getAttribute('aria-hidden') === 'true') {
      return true;
    }
    const cls =
      typeof node.className === 'string'
        ? node.className
        : (node.getAttribute && node.getAttribute('class')) || '';
    if (
      /\b(mat-icon|material-icons|material-symbols(?:-outlined|-rounded|-sharp)?|google-symbols|mat-mdc-button-touch-target|mat-ripple|cdk-visually-hidden)\b/i.test(
        cls
      )
    ) {
      return true;
    }
    return false;
  }

  function extractVisibleLabelText(node, isRoot) {
    if (!node) return '';
    if (!isRoot && isIconOrDecorativeNode(node)) return '';

    if (node.childNodes && typeof node.childNodes.length === 'number' && node.childNodes.length > 0) {
      let out = '';
      for (let i = 0; i < node.childNodes.length; i++) {
        const child = node.childNodes[i];
        if (!child) continue;
        if (child.nodeType === 3) {
          out += child.nodeValue || child.textContent || '';
        } else if (child.nodeType === 1) {
          if (isIconOrDecorativeNode(child)) continue;
          out += extractVisibleLabelText(child, false);
        }
      }
      return out.replace(/\s+/g, ' ').trim();
    }

    if (node.children && node.children.length > 0) {
      let out = typeof node._ownText === 'string' ? node._ownText : '';
      for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i];
        if (!child || isIconOrDecorativeNode(child)) continue;
        out += extractVisibleLabelText(child, false);
      }
      return out.replace(/\s+/g, ' ').trim();
    }

    return (node.innerText || node.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function getElementLabel(el) {
    if (!el) return '';
    const text = extractVisibleLabelText(el, true);
    if (text) return text;
    if (el.getAttribute) {
      return (el.getAttribute('aria-label') || el.getAttribute('title') || '').trim();
    }
    return '';
  }

  /**
   * Collects all elements matching a selector across light DOM and open shadow roots.
   */
  function queryAllDeep(rootNode, selector, out) {
    const results = out || [];
    if (!rootNode) return results;

    if (typeof rootNode.querySelectorAll === 'function') {
      const matched = rootNode.querySelectorAll(selector);
      for (let i = 0; i < matched.length; i++) {
        results.push(matched[i]);
      }
      // Traverse open shadow roots
      const allNodes = rootNode.querySelectorAll('*');
      for (let i = 0; i < allNodes.length; i++) {
        const node = allNodes[i];
        if (node && node.shadowRoot) {
          queryAllDeep(node.shadowRoot, selector, results);
        }
      }
    }
    return results;
  }

  function collectClickableElements(doc, win) {
    const raw = queryAllDeep(doc.body || doc, INTERACTIVE_SELECTOR, []);
    const seen = new Set();
    const valid = [];

    for (const el of raw) {
      if (!el || seen.has(el)) continue;
      seen.add(el);
      if (isIgnoredAncestor(el)) continue;
      if (!isElementVisible(el, win, doc)) continue;
      const label = getElementLabel(el);
      if (!label) continue;
      valid.push({ el, label });
    }

    // Deduplicate nested clickables that share the exact same label.
    // Prefer native <button> over wrapper containers (e.g. <mat-chip><button>继续</button></mat-chip>),
    // since Angular Material attaches click listeners on the inner <button> and events bubble upward.
    const byEl = new Map();
    for (const item of valid) {
      byEl.set(item.el, item);
    }

    const isNativeButton = (node) => (node.tagName || '').toUpperCase() === 'BUTTON';

    const dropSet = new Set();
    for (const item of valid) {
      const normLabel = D.normalizeText(item.label);
      let p = item.el.parentElement || (item.el.getRootNode && item.el.getRootNode().host) || null;
      while (p) {
        const parentItem = byEl.get(p);
        if (parentItem && D.normalizeText(parentItem.label) === normLabel) {
          if (isNativeButton(item.el) && !isNativeButton(parentItem.el)) {
            dropSet.add(parentItem.el);
          } else {
            dropSet.add(item.el);
          }
          break;
        }
        p = p.parentElement || (p.getRootNode && p.getRootNode().host) || null;
      }
    }

    return valid.filter((item) => !dropSet.has(item.el));
  }

  function hasClickedSiblingButton(el, clickedElements) {
    if (!clickedElements || clickedElements.size === 0) return false;
    let container =
      el.parentElement ||
      el.parentNode ||
      (el.getRootNode && el.getRootNode() !== el ? el.getRootNode() : null);
    for (let depth = 0; depth < 3 && container; depth++) {
      const tag = (container.tagName || '').toUpperCase();
      if (tag === 'BODY' || tag === 'HTML' || tag === 'MAIN') break;
      if (typeof container.querySelectorAll === 'function') {
        const siblings = container.querySelectorAll('button, [role="button"]');
        if (siblings.length > 8) break;
        if (siblings.length > 1) {
          for (let i = 0; i < siblings.length; i++) {
            const sib = siblings[i];
            if (sib !== el && clickedElements.has(sib)) {
              return true;
            }
          }
          // Stop at the innermost multi-button group so separate stacked cards stay independent
          break;
        }
      }
      container =
        container.parentElement ||
        (container.nodeType === 11 ? container.host : container.parentNode) ||
        null;
    }
    return false;
  }

  function hasSiblingApprovalContext(el, settings) {
    const denyAndAlways = []
      .concat(settings.denyBlacklistKeywords || [])
      .concat(settings.alwaysAllowKeywords || [])
      .concat(settings.customAlwaysAllowKeywords || []);

    let container =
      el.parentElement ||
      el.parentNode ||
      (el.getRootNode && el.getRootNode() !== el ? el.getRootNode() : null);
    for (let depth = 0; depth < 3 && container; depth++) {
      const tag = (container.tagName || '').toUpperCase();
      if (tag === 'BODY' || tag === 'HTML' || tag === 'MAIN') break;
      if (typeof container.querySelectorAll === 'function') {
        const siblings = container.querySelectorAll('button, [role="button"]');
        if (siblings.length > 8) break;
        for (let i = 0; i < siblings.length; i++) {
          const sib = siblings[i];
          if (sib === el) continue;
          const sibLabel = getElementLabel(sib);
          if (sibLabel && sibLabel.length <= 40 && D.containsKeyword(sibLabel, denyAndAlways)) {
            return true;
          }
        }
      }
      container =
        container.parentElement ||
        (container.nodeType === 11 ? container.host : container.parentNode) ||
        null;
    }
    return false;
  }

  function getAssistantTurns(doc) {
    if (!doc) return [];
    for (const sel of TURN_SELECTORS) {
      const nodes = queryAllDeep(doc.body || doc, sel, []);
      if (nodes.length === 0) continue;
      const seen = new Set();
      const filtered = [];
      for (const n of nodes) {
        if (!n || seen.has(n)) continue;
        seen.add(n);
        if (isIgnoredAncestor(n)) continue;
        if (n.hidden === true) continue;
        if (n.getAttribute && n.getAttribute('aria-hidden') === 'true') continue;
        filtered.push(n);
      }
      if (filtered.length > 0) {
        // Keep only top-level turn containers so nested matches (e.g. nested .response-container)
        // never trick isInsideOlderTurn into rejecting a sibling continue button in the latest turn.
        const topLevel = filtered.filter(
          (n) => !filtered.some((other) => other !== n && containsDeep(other, n))
        );
        if (topLevel.length > 0) return topLevel;
      }
    }
    return [];
  }

  function containsDeep(ancestor, node) {
    if (!ancestor || !node) return false;
    if (typeof ancestor.contains === 'function' && ancestor.contains(node)) {
      return true;
    }
    let cur = node;
    while (cur) {
      if (cur === ancestor) return true;
      cur = cur.parentNode || (cur.nodeType === 11 ? cur.host : null) || null;
    }
    return false;
  }

  function isInsideOlderTurn(el, turns) {
    if (!turns || turns.length <= 1) return false;
    const latestTurn = turns[turns.length - 1];
    if (latestTurn && containsDeep(latestTurn, el)) {
      return false;
    }
    for (let i = 0; i < turns.length - 1; i++) {
      const oldTurn = turns[i];
      if (oldTurn && containsDeep(oldTurn, el)) {
        return true;
      }
    }
    return false;
  }

  function computeResponseFingerprint(turns) {
    if (!turns || turns.length === 0) return null;
    const latest = turns[turns.length - 1];
    const text = D.normalizeText(latest.innerText || latest.textContent || '');
    if (!text) return null;
    const tail = text.slice(-300);
    return `${turns.length}|${text.length}|${tail}`;
  }

  function computeContentFingerprint(turns) {
    if (!turns || turns.length === 0) return null;
    const latest = turns[turns.length - 1];
    const text = D.normalizeText(latest.innerText || latest.textContent || '');
    if (!text) return null;
    const tail = text.slice(-300);
    return `${text.length}|${tail}`;
  }

  function getLatestResponseText(turns) {
    if (!turns || turns.length === 0) return '';
    const latest = turns[turns.length - 1];
    return (latest.innerText || latest.textContent || '').trim();
  }

  function defaultClickElement(el, win) {
    const w = win || (typeof window !== 'undefined' ? window : null);
    const eventOpts = { bubbles: true, cancelable: true, composed: true };
    try {
      if (w && typeof w.PointerEvent === 'function') {
        el.dispatchEvent(new w.PointerEvent('pointerdown', Object.assign({ pointerId: 1, isPrimary: true }, eventOpts)));
      }
      if (w && typeof w.MouseEvent === 'function') {
        el.dispatchEvent(new w.MouseEvent('mousedown', eventOpts));
      }
      if (w && typeof w.PointerEvent === 'function') {
        el.dispatchEvent(new w.PointerEvent('pointerup', Object.assign({ pointerId: 1, isPrimary: true }, eventOpts)));
      }
      if (w && typeof w.MouseEvent === 'function') {
        el.dispatchEvent(new w.MouseEvent('mouseup', eventOpts));
      }
    } catch (_) {
      // Fallback to plain click
    }
    if (typeof el.click === 'function') {
      el.click();
    } else if (w && typeof w.MouseEvent === 'function') {
      el.dispatchEvent(new w.MouseEvent('click', eventOpts));
    }
  }

  class GmahEngine {
    constructor(options) {
      const opts = options || {};
      this.doc = opts.doc || (typeof document !== 'undefined' ? document : null);
      this.win = opts.win || (typeof window !== 'undefined' ? window : null);
      this.now = typeof opts.now === 'function' ? opts.now : () => Date.now();
      this.clickFn = typeof opts.clickFn === 'function' ? opts.clickFn : defaultClickElement;
      this.onStateChange = typeof opts.onStateChange === 'function' ? opts.onStateChange : null;
      this.onStatsSave = typeof opts.onStatsSave === 'function' ? opts.onStatsSave : null;
      this.onSettingsSave = typeof opts.onSettingsSave === 'function' ? opts.onSettingsSave : null;

      this.settings = D.mergeSettings(opts.settings);
      this.stats = D.normalizeStats(opts.stats, D.getTodayKey(new Date(this.now())));

      this.clickedElements = new Set();
      this.taskContinueCount = 0;
      this.stagnantCount = 0;
      this.lastContinueFingerprint = null;
      this.lastContinueContentFingerprint = null;
      this.lastAllowClickAt = 0;
      this.lastContinueClickAt = 0;
      this.lastMutationAt = 0;
      this.lastUrl = this.win && this.win.location ? this.win.location.href : '';
      this.lastStatusText = '监控中';
      this.isGenerating = false;

      this.circuitBreaker = {
        tripped: false,
        reasonCode: null,
        reason: ''
      };

      this.logs = [];
      this.maxLogs = 40;
    }

    addLog(message) {
      const entry = {
        time: formatTime(new Date(this.now())),
        message
      };
      this.logs.unshift(entry);
      if (this.logs.length > this.maxLogs) {
        this.logs.length = this.maxLogs;
      }
      return entry;
    }

    getState() {
      return {
        settings: this.settings,
        stats: this.stats,
        taskContinueCount: this.taskContinueCount,
        isGenerating: this.isGenerating,
        lastStatusText: this.lastStatusText,
        circuitBreaker: Object.assign({}, this.circuitBreaker),
        logs: this.logs.slice()
      };
    }

    emitState() {
      if (this.onStateChange) {
        this.onStateChange(this.getState());
      }
    }

    updateSettings(partial, persist) {
      this.settings = D.mergeSettings(Object.assign({}, this.settings, partial));
      if (persist && this.onSettingsSave) {
        this.onSettingsSave(this.settings);
      }
      this.emitState();
    }

    ensureTodayStats() {
      const today = D.getTodayKey(new Date(this.now()));
      if (this.stats.date !== today) {
        this.stats = D.createEmptyStats(today);
        if (this.circuitBreaker.tripped && this.circuitBreaker.reasonCode === 'daily_limit') {
          this.clearBreaker('新的一天已自动重置每日额度计数');
        }
        if (this.onStatsSave) this.onStatsSave(this.stats);
      }
    }

    recordMutation() {
      this.lastMutationAt = this.now();
    }

    tripBreaker(reasonCode, reason) {
      if (this.circuitBreaker.tripped && this.circuitBreaker.reasonCode === reasonCode) {
        return;
      }
      this.circuitBreaker = {
        tripped: true,
        reasonCode,
        reason
      };
      this.lastStatusText = `熔断: ${reason}`;
      this.addLog(`🛑 熔断触发: ${reason}`);
      this.emitState();
    }

    emergencyStop() {
      this.tripBreaker('emergency_stop', '用户手动紧急停止');
    }

    clearBreaker(logMsg) {
      const prevCode = this.circuitBreaker.reasonCode;
      this.circuitBreaker = {
        tripped: false,
        reasonCode: null,
        reason: ''
      };
      if (prevCode === 'task_limit' || prevCode === 'stagnant_output' || prevCode === 'emergency_stop') {
        this.taskContinueCount = 0;
        this.stagnantCount = 0;
        this.lastContinueFingerprint = null;
        this.lastContinueContentFingerprint = null;
      }
      this.lastStatusText = '监控中';
      this.addLog(logMsg || '✅ 已解除熔断并重置本次任务计数');
      this.emitState();
    }

    onUserManualPrompt() {
      this.taskContinueCount = 0;
      this.stagnantCount = 0;
      this.lastContinueFingerprint = null;
      this.lastContinueContentFingerprint = null;
      this.lastMutationAt = this.now();

      if (
        this.circuitBreaker.tripped &&
        (this.circuitBreaker.reasonCode === 'task_limit' ||
          this.circuitBreaker.reasonCode === 'stagnant_output')
      ) {
        this.clearBreaker('检测到新消息，自动重置单次任务继续计数');
      } else {
        this.addLog('💬 检测到用户发送新指令，本次继续计数已归零');
        this.emitState();
      }
    }

    onConversationChange(newUrl) {
      this.lastUrl = newUrl;
      this.taskContinueCount = 0;
      this.stagnantCount = 0;
      this.lastContinueFingerprint = null;
      this.lastContinueContentFingerprint = null;
      if (
        this.circuitBreaker.tripped &&
        this.circuitBreaker.reasonCode !== 'emergency_stop' &&
        this.circuitBreaker.reasonCode !== 'daily_limit'
      ) {
        this.clearBreaker('已切换对话，自动重置熔断状态');
      } else {
        this.emitState();
      }
    }

    detectGenerating() {
      if (!this.doc) return false;
      const rootNode = this.doc.body || this.doc;
      const stopNodes = queryAllDeep(rootNode, STOP_BUTTON_COMBINED_SELECTOR, []);
      for (const n of stopNodes) {
        if (!isIgnoredAncestor(n) && isElementVisible(n, this.win, this.doc)) {
          return true;
        }
      }
      const loadingNodes = queryAllDeep(rootNode, LOADING_COMBINED_SELECTOR, []);
      for (const n of loadingNodes) {
        if (!isIgnoredAncestor(n) && isElementVisible(n, this.win, this.doc)) {
          return true;
        }
      }
      return false;
    }

    detectQuotaOrError(turns) {
      if (!this.settings.stopOnQuotaOrError) return null;

      // 1. Check visible alert/toast banners
      const alertNodes = queryAllDeep(this.doc.body || this.doc, ALERT_COMBINED_SELECTOR, []);
      for (const n of alertNodes) {
        if (isIgnoredAncestor(n) || !isElementVisible(n, this.win, this.doc)) continue;
        const txt = (n.innerText || n.textContent || '').trim();
        const hit = D.containsKeyword(txt, this.settings.quotaErrorKeywords);
        if (hit) return hit;
      }

      // 2. Check latest assistant response only when short/error-like (avoids false positives in long coding/doc replies)
      const latestText = getLatestResponseText(turns);
      if (latestText && latestText.length <= 320) {
        const hit = D.containsKeyword(latestText, this.settings.quotaErrorKeywords);
        if (hit) return hit;
      }
      return null;
    }

    findAllowCandidate(clickables) {
      const alwaysMatches = [];
      const singleMatches = [];

      const defaultAlways = this.settings.alwaysAllowKeywords || [];
      const customAlways = this.settings.customAlwaysAllowKeywords || [];
      const singleKws = this.settings.singleAllowKeywords || [];
      const denyKws = this.settings.denyBlacklistKeywords || [];

      for (const item of clickables) {
        if (this.clickedElements.has(item.el)) continue;
        if (hasClickedSiblingButton(item.el, this.clickedElements)) continue;
        if (D.containsKeyword(item.label, denyKws)) continue;

        const mAlways =
          D.matchButtonLabel(item.label, defaultAlways, {
            maxLen: 48,
            mode: 'exact_or_prefix'
          }) ||
          D.matchButtonLabel(item.label, customAlways, {
            maxLen: 64,
            mode: 'exact_or_contains'
          });

        if (mAlways) {
          alwaysMatches.push({ item, match: mAlways, tier: 'always' });
          continue;
        }

        const mSingle = D.matchButtonLabel(item.label, singleKws, {
          maxLen: 28,
          mode: 'exact_or_prefix'
        });

        if (mSingle) {
          const lower = D.normalizeText(item.label);
          if (lower.includes('cookie') || lower.includes('notification') || lower.includes('通知')) {
            continue;
          }
          // Non-exact single allow (e.g. "Allow Desktop Commander") requires sibling approval context
          if (mSingle.exact || hasSiblingApprovalContext(item.el, this.settings)) {
            singleMatches.push({ item, match: mSingle, tier: 'single' });
          }
        }
      }

      if (this.settings.preferAlwaysAllow && alwaysMatches.length > 0) {
        return alwaysMatches[alwaysMatches.length - 1];
      }
      if (!this.settings.preferAlwaysAllow && singleMatches.length > 0) {
        return singleMatches[singleMatches.length - 1];
      }
      if (alwaysMatches.length > 0) {
        return alwaysMatches[alwaysMatches.length - 1];
      }
      if (this.settings.fallbackSingleAllow && singleMatches.length > 0) {
        return singleMatches[singleMatches.length - 1];
      }
      return null;
    }

    findContinueCandidate(clickables, turns) {
      const defaultCont = this.settings.continueKeywords || [];
      const customCont = this.settings.customContinueKeywords || [];
      const denyKws = this.settings.denyBlacklistKeywords || [];
      const matches = [];

      for (const item of clickables) {
        if (this.clickedElements.has(item.el)) continue;
        if (D.containsKeyword(item.label, denyKws)) continue;
        if (isInsideOlderTurn(item.el, turns)) continue;

        // Strict exact match for built-in continue keywords so normal follow-up chips
        // (e.g. "继续优化性能" / "Continue exploring options") are NEVER mis-clicked.
        const mDefault = D.matchButtonLabel(item.label, defaultCont, {
          maxLen: 36,
          mode: 'exact'
        });
        const mCustom =
          !mDefault &&
          D.matchButtonLabel(item.label, customCont, {
            maxLen: 80,
            mode: 'exact_or_contains'
          });

        if (mDefault || mCustom) {
          matches.push({ item, match: mDefault || mCustom });
        }
      }

      if (matches.length === 0) return null;
      return matches[matches.length - 1];
    }

    inspectVisibleButtons() {
      if (!this.doc) return [];
      const clickables = collectClickableElements(this.doc, this.win);
      const seenLabels = new Set();
      const out = [];
      for (const item of clickables) {
        const txt = item.label.replace(/\s+/g, ' ').trim();
        if (!txt || txt.length > 60) continue;
        const key = txt.toLowerCase();
        if (seenLabels.has(key)) continue;
        seenLabels.add(key);
        out.push({ text: txt, el: item.el });
        if (out.length >= 25) break;
      }
      return out;
    }

    addCustomKeyword(kind, text) {
      const cleaned = (text || '').trim();
      if (!cleaned) return false;
      if (kind === 'allow') {
        const next = D.parseKeywordInput(
          this.settings.customAlwaysAllowKeywords.concat([cleaned]).join('\n')
        );
        this.updateSettings({ customAlwaysAllowKeywords: next }, true);
        this.addLog(`➕ 已添加自定义允许词：「${cleaned}」`);
      } else {
        const next = D.parseKeywordInput(
          this.settings.customContinueKeywords.concat([cleaned]).join('\n')
        );
        this.updateSettings({ customContinueKeywords: next }, true);
        this.addLog(`➕ 已添加自定义继续词：「${cleaned}」`);
      }
      this.emitState();
      return true;
    }

    /**
     * Single scan tick. Returns an action descriptor for deterministic testing & debugging.
     */
    scanOnce() {
      if (!this.doc) return { action: 'noop', reason: 'no_doc' };

      // SPA URL change check
      if (this.win && this.win.location && this.win.location.href !== this.lastUrl) {
        this.onConversationChange(this.win.location.href);
      }

      this.ensureTodayStats();
      this.isGenerating = this.detectGenerating();

      if (!this.settings.enabled) {
        this.emitState();
        return { action: 'noop', reason: 'disabled' };
      }

      // Emergency stop blocks EVERYTHING (both Allow & Continue)
      if (this.circuitBreaker.tripped && this.circuitBreaker.reasonCode === 'emergency_stop') {
        this.emitState();
        return { action: 'blocked', reason: 'emergency_stop' };
      }

      const now = this.now();
      const clickables = collectClickableElements(this.doc, this.win);
      const turns = getAssistantTurns(this.doc);

      // Prune clicked elements that are no longer visible/mounted so Angular-recycled
      // DOM buttons can be clicked again in subsequent prompts without double-clicking live ones.
      if (this.clickedElements.size > 0) {
        const visibleSet = new Set(clickables.map((c) => c.el));
        for (const prevEl of Array.from(this.clickedElements)) {
          if (!visibleSet.has(prevEl)) {
            this.clickedElements.delete(prevEl);
          }
        }
      }

      // 1. Check MCP Permission Allow first (works even while Gemini turn is paused mid-generation!)
      if (this.settings.autoAllow) {
        if (now - this.lastAllowClickAt >= this.settings.allowCooldownMs) {
          const allowHit = this.findAllowCandidate(clickables);
          if (allowHit) {
            this.clickedElements.add(allowHit.item.el);
            this.lastAllowClickAt = now;
            this.stats.allowCount += 1;
            if (this.onStatsSave) this.onStatsSave(this.stats);
            this.clickFn(allowHit.item.el, this.win);
            const tag = allowHit.tier === 'always' ? '始终允许' : '允许';
            this.lastStatusText = `已自动点击「${allowHit.item.label}」`;
            this.addLog(`✅ 自动点击[${tag}]：「${allowHit.item.label}」`);
            this.emitState();
            return {
              action: 'clicked_allow',
              tier: allowHit.tier,
              label: allowHit.item.label,
              element: allowHit.item.el
            };
          }
        }
      }

      // 2. Check Auto-Continue (strictly guarded by 6-layer anti-quota-burn circuit breaker)
      if (!this.settings.autoContinue) {
        this.emitState();
        return { action: 'noop', reason: 'auto_continue_off' };
      }

      if (this.circuitBreaker.tripped) {
        this.emitState();
        return { action: 'blocked', reason: this.circuitBreaker.reasonCode };
      }

      // Layer A: Quota / Rate-limit / Error Detection
      const quotaHit = this.detectQuotaOrError(turns);
      if (quotaHit) {
        this.tripBreaker('quota_error', `检测到额度/错误提示（「${quotaHit}」）`);
        return { action: 'tripped', reason: 'quota_error', keyword: quotaHit };
      }

      // Layer B: Wait for streaming to finish + DOM settle
      if (this.isGenerating) {
        this.emitState();
        return { action: 'wait', reason: 'generating' };
      }
      if (this.lastMutationAt > 0 && now - this.lastMutationAt < this.settings.idleSettleMs) {
        this.emitState();
        return { action: 'wait', reason: 'settling' };
      }

      // Find candidate first so we don't prematurely trip limits when there is no continue button!
      const contHit = this.findContinueCandidate(clickables, turns);
      if (!contHit) {
        this.emitState();
        return { action: 'noop', reason: 'no_continue_candidate' };
      }

      // Layer C: Per-task cap
      if (this.taskContinueCount >= this.settings.maxContinuesPerTask) {
        this.tripBreaker(
          'task_limit',
          `已达单次任务继续上限 (${this.taskContinueCount}/${this.settings.maxContinuesPerTask})`
        );
        return { action: 'tripped', reason: 'task_limit' };
      }

      // Layer D: Daily cap
      if (this.stats.continueCount >= this.settings.dailyContinueLimit) {
        this.tripBreaker(
          'daily_limit',
          `已达今日继续总上限 (${this.stats.continueCount}/${this.settings.dailyContinueLimit})`
        );
        return { action: 'tripped', reason: 'daily_limit' };
      }

      // Layer E: Cooldown
      if (this.lastContinueClickAt > 0 && now - this.lastContinueClickAt < this.settings.continueCooldownMs) {
        this.emitState();
        return { action: 'wait', reason: 'cooldown' };
      }

      // Layer F: Completion cue guard
      if (this.settings.stopOnCompletionCues) {
        const latestText = getLatestResponseText(turns);
        if (latestText) {
          const tail = latestText.slice(-500);
          const doneCue = D.containsKeyword(tail, this.settings.completionCueKeywords);
          const truncCue = D.containsKeyword(tail, this.settings.truncationCueKeywords);
          if (doneCue && !truncCue) {
            this.clickedElements.add(contHit.item.el);
            this.lastStatusText = `检测到完工信号「${doneCue}」，已跳过继续`;
            this.addLog(`🛡️ 检测到完工信号「${doneCue}」，跳过点击「${contHit.item.label}」`);
            this.emitState();
            return { action: 'skipped', reason: 'completion_cue', keyword: doneCue };
          }
        }
      }

      // Layer G: Stagnant / repeated output guard (catches both unchanged DOM and identical repeated replies across turns)
      const fp = computeResponseFingerprint(turns);
      const contentFp = computeContentFingerprint(turns);
      const isDomUnchanged = Boolean(this.lastContinueFingerprint && fp === this.lastContinueFingerprint);
      const isRepeatedReply = Boolean(
        this.lastContinueContentFingerprint && contentFp === this.lastContinueContentFingerprint
      );
      if (this.settings.stopOnStagnantOutput && (isDomUnchanged || isRepeatedReply)) {
        this.stagnantCount += 1;
        this.tripBreaker('stagnant_output', '连续输出无新进展，疑似死循环');
        return { action: 'tripped', reason: 'stagnant_output' };
      }

      // Safe to click continue!
      this.clickedElements.add(contHit.item.el);
      this.lastContinueClickAt = now;
      this.lastContinueFingerprint = fp;
      this.lastContinueContentFingerprint = contentFp;
      this.taskContinueCount += 1;
      this.stats.continueCount += 1;
      if (this.onStatsSave) this.onStatsSave(this.stats);

      this.clickFn(contHit.item.el, this.win);
      this.lastStatusText = `已点击继续 (${this.taskContinueCount}/${this.settings.maxContinuesPerTask})`;
      this.addLog(
        `▶️ 自动点击继续：「${contHit.item.label}」 (${this.taskContinueCount}/${this.settings.maxContinuesPerTask})`
      );
      this.emitState();

      return {
        action: 'clicked_continue',
        label: contHit.item.label,
        element: contHit.item.el,
        taskContinueCount: this.taskContinueCount,
        dailyContinueCount: this.stats.continueCount
      };
    }
  }

  // Export for unit / integration tests
  root.GMAH_ENGINE = {
    GmahEngine,
    collectClickableElements,
    getAssistantTurns,
    isIgnoredAncestor,
    isElementVisible,
    getElementLabel,
    computeResponseFingerprint,
    computeContentFingerprint,
    defaultClickElement
  };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = root.GMAH_ENGINE;
  }

  // Browser bootstrap (only on gemini.google.com when chrome.storage is present)
  function bootstrapBrowser() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    if (window.__GMAH_BOOTSTRAPPED__) return;
    const isGeminiHost =
      window.location &&
      typeof window.location.hostname === 'string' &&
      window.location.hostname === 'gemini.google.com';
    if (!isGeminiHost) return;

    window.__GMAH_BOOTSTRAPPED__ = true;

    const hadRuntimeId =
      typeof chrome !== 'undefined' && Boolean(chrome.runtime && chrome.runtime.id);
    const hasChromeStorage =
      typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;

    let contextInvalidated = false;
    let observer = null;
    let heartbeatInterval = null;
    let scanTimer = null;
    let reconnectTimer = null;
    let bgPort = null;
    const hudApi = root.GMAH_HUD;
    let hud = null;

    function isContextAlive() {
      if (contextInvalidated) return false;
      if (hadRuntimeId) {
        try {
          if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.id) {
            teardownStaleContext();
            return false;
          }
        } catch (_) {
          teardownStaleContext();
          return false;
        }
      }
      return true;
    }

    const saveSettings = (settings) => {
      if (!isContextAlive() || !hasChromeStorage) return;
      try {
        chrome.storage.local.set({ [D.STORAGE_KEY]: settings });
      } catch (_) {
        teardownStaleContext();
      }
    };
    const saveStats = (stats) => {
      if (!isContextAlive() || !hasChromeStorage) return;
      try {
        chrome.storage.local.set({ [D.STATS_KEY]: stats });
      } catch (_) {
        teardownStaleContext();
      }
    };

    const engine = new GmahEngine({
      doc: document,
      win: window,
      onSettingsSave: saveSettings,
      onStatsSave: saveStats,
      onStateChange: (state) => {
        if (hud && !contextInvalidated) hud.update(state);
      }
    });

    if (hudApi && typeof hudApi.createHud === 'function') {
      hud = hudApi.createHud({
        onToggleMinimize: () => {
          if (!isContextAlive()) return;
          engine.updateSettings({ hudMinimized: !engine.settings.hudMinimized }, true);
        },
        onToggleEnabled: () => {
          if (!isContextAlive()) return;
          engine.updateSettings({ enabled: !engine.settings.enabled }, true);
          engine.addLog(engine.settings.enabled ? '▶️ 插件已开启' : '⏸️ 插件已暂停');
          engine.emitState();
        },
        onToggleAllow: () => {
          if (!isContextAlive()) return;
          engine.updateSettings({ autoAllow: !engine.settings.autoAllow }, true);
        },
        onToggleContinue: () => {
          if (!isContextAlive()) return;
          engine.updateSettings({ autoContinue: !engine.settings.autoContinue }, true);
        },
        onToggleBackground: () => {
          if (!isContextAlive()) return;
          engine.updateSettings({ backgroundMode: !engine.settings.backgroundMode }, true);
          engine.addLog(
            engine.settings.backgroundMode ? '🌙 后台静默运行已开启' : '🌙 后台静默运行已关闭'
          );
          engine.emitState();
        },
        onEmergencyStop: () => {
          if (!isContextAlive()) return;
          engine.emergencyStop();
        },
        onResetBreaker: () => {
          if (!isContextAlive()) return;
          engine.clearBreaker();
        },
        onInspectButtons: () => (isContextAlive() ? engine.inspectVisibleButtons() : []),
        onAddKeyword: (kind, text) => {
          if (!isContextAlive()) return;
          engine.addCustomKeyword(kind, text);
        }
      });
      hud.mount();
    }

    // Load initial persisted settings & stats
    if (hasChromeStorage) {
      try {
        chrome.storage.local.get([D.STORAGE_KEY, D.STATS_KEY], (res) => {
          if (!isContextAlive()) return;
          if (res && res[D.STORAGE_KEY]) {
            engine.settings = D.mergeSettings(res[D.STORAGE_KEY]);
          }
          if (res && res[D.STATS_KEY]) {
            engine.stats = D.normalizeStats(res[D.STATS_KEY]);
          }
          engine.addLog('🚀 Gemini MCP Auto Helper 已就绪');
          engine.emitState();
        });

        chrome.storage.onChanged.addListener((changes, area) => {
          if (!isContextAlive() || area !== 'local') return;
          if (changes[D.STORAGE_KEY] && changes[D.STORAGE_KEY].newValue) {
            engine.settings = D.mergeSettings(changes[D.STORAGE_KEY].newValue);
          }
          if (changes[D.STATS_KEY] && changes[D.STATS_KEY].newValue) {
            engine.stats = D.normalizeStats(changes[D.STATS_KEY].newValue);
          }
          if (
            engine.circuitBreaker.tripped &&
            engine.circuitBreaker.reasonCode === 'daily_limit' &&
            engine.stats.continueCount < engine.settings.dailyContinueLimit
          ) {
            engine.clearBreaker('今日计数已清零或上限已提高，自动解除每日熔断');
            return;
          }
          if (
            engine.circuitBreaker.tripped &&
            engine.circuitBreaker.reasonCode === 'task_limit' &&
            engine.taskContinueCount < engine.settings.maxContinuesPerTask
          ) {
            engine.clearBreaker('单次任务上限已提高，自动解除任务熔断');
            return;
          }
          engine.emitState();
        });
      } catch (_) {
        teardownStaleContext();
        return;
      }
    } else {
      engine.emitState();
    }

    // Listen to manual user send to reset per-task continue cap
    function handleKeydown(ev) {
      if (!isContextAlive() || !ev.isTrusted) return;
      if (ev.key === 'Enter' && !ev.shiftKey && !ev.isComposing) {
        const t = ev.target;
        if (
          t &&
          (t.tagName === 'TEXTAREA' ||
            (t.getAttribute && t.getAttribute('contenteditable') === 'true') ||
            (t.closest && t.closest('[contenteditable="true"]')))
        ) {
          engine.onUserManualPrompt();
        }
      }
    }

    function handleClick(ev) {
      if (!isContextAlive() || !ev.isTrusted) return;
      const btn = ev.target && ev.target.closest ? ev.target.closest('button, [role="button"]') : null;
      if (!btn || isIgnoredAncestor(btn)) return;
      const lbl = D.normalizeText(getElementLabel(btn));
      const testId = (btn.getAttribute && btn.getAttribute('data-test-id') || '').toLowerCase();
      if (
        lbl === 'send' ||
        lbl === 'send message' ||
        lbl === 'send prompt' ||
        lbl === 'submit' ||
        lbl === '发送' ||
        lbl === '发送消息' ||
        lbl === '发送提示' ||
        lbl === '傳送' ||
        lbl === '傳送訊息' ||
        lbl === '提交' ||
        testId.includes('send') ||
        (btn.className && String(btn.className).includes('send-button'))
      ) {
        engine.onUserManualPrompt();
      }
    }

    function handleVisibilityChange() {
      if (!isContextAlive()) return;
      if (!document.hidden && !bgPort) {
        connectBackgroundPort();
      }
      if (engine.settings.backgroundMode || !document.hidden) {
        engine.scanOnce();
      }
    }

    function teardownStaleContext() {
      if (contextInvalidated) return;
      contextInvalidated = true;
      if (observer) {
        try { observer.disconnect(); } catch (_) {}
        observer = null;
      }
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
      }
      if (scanTimer) {
        clearTimeout(scanTimer);
        scanTimer = null;
      }
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      if (bgPort) {
        try { bgPort.disconnect(); } catch (_) {}
        bgPort = null;
      }
      if (hud) {
        try { hud.unmount(); } catch (_) {}
      }
      try {
        document.removeEventListener('keydown', handleKeydown, true);
        document.removeEventListener('click', handleClick, true);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      } catch (_) {}
      try {
        delete window.__GMAH_BOOTSTRAPPED__;
      } catch (_) {
        window.__GMAH_BOOTSTRAPPED__ = false;
      }
    }

    document.addEventListener('keydown', handleKeydown, true);
    document.addEventListener('click', handleClick, true);

    // Observe DOM mutations outside HUD.
    // When tab is hidden/minimized and backgroundMode is on, use microtask scheduling
    // so Chrome's background timer throttling cannot delay permission clicks!
    let lastMicrotaskScanAt = 0;
    let microtaskQueued = false;

    function scheduleScan(delay) {
      if (!isContextAlive()) return;
      if (document.hidden && engine.settings.backgroundMode) {
        if (!microtaskQueued) {
          microtaskQueued = true;
          Promise.resolve().then(() => {
            microtaskQueued = false;
            if (!isContextAlive()) return;
            const now = Date.now();
            if (now - lastMicrotaskScanAt >= 200) {
              lastMicrotaskScanAt = now;
              engine.scanOnce();
            }
          });
        }
        return;
      }
      if (scanTimer) return;
      scanTimer = setTimeout(() => {
        scanTimer = null;
        if (!isContextAlive()) return;
        engine.scanOnce();
      }, delay);
    }

    if (typeof MutationObserver === 'function' && document.body) {
      observer = new MutationObserver((mutations) => {
        if (!isContextAlive()) return;
        let relevant = false;
        for (const m of mutations) {
          if (m.target && !isIgnoredAncestor(m.target)) {
            relevant = true;
            break;
          }
        }
        if (relevant) {
          engine.recordMutation();
          scheduleScan(300);
        }
      });
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true
      });
    }

    // Background Service Worker Port (keeps scanning alive at 1.5s intervals even when tab is hidden/minimized)
    let quickReconnectCount = 0;

    function connectBackgroundPort() {
      if (!isContextAlive()) return;
      if (
        typeof chrome === 'undefined' ||
        !chrome.runtime ||
        !chrome.runtime.id ||
        typeof chrome.runtime.connect !== 'function'
      ) {
        return;
      }
      if (bgPort) return;
      try {
        bgPort = chrome.runtime.connect({ name: 'gmah-tab' });
        bgPort.onMessage.addListener((msg) => {
          if (!isContextAlive()) return;
          quickReconnectCount = 0;
          if (msg && msg.type === 'GMAH_BG_TICK') {
            if (engine.settings.backgroundMode || !document.hidden) {
              engine.scanOnce();
            }
            try {
              if (bgPort) bgPort.postMessage({ type: 'GMAH_TAB_PONG', ts: Date.now() });
            } catch (_) {
              // Ignore transient port close
            }
          }
        });
        bgPort.onDisconnect.addListener(() => {
          bgPort = null;
          if (!isContextAlive()) return;
          if (!chrome.runtime || !chrome.runtime.id) {
            teardownStaleContext();
            return;
          }
          if (document.hidden && engine.settings.backgroundMode && quickReconnectCount < 3) {
            quickReconnectCount += 1;
            Promise.resolve().then(() => connectBackgroundPort());
            return;
          }
          if (!reconnectTimer) {
            reconnectTimer = setTimeout(() => {
              reconnectTimer = null;
              connectBackgroundPort();
            }, 3000);
          }
        });
        bgPort.postMessage({ type: 'GMAH_TAB_HELLO', url: window.location.href });
      } catch (_) {
        bgPort = null;
        isContextAlive();
      }
    }

    connectBackgroundPort();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Periodic foreground heartbeat (Service Worker Port + Alarms take over when tab is hidden)
    heartbeatInterval = setInterval(() => {
      if (!isContextAlive()) return;
      if (hud && engine.settings.showHud && !document.getElementById('gmah-hud')) {
        hud.mount();
      }
      if (!document.hidden || engine.settings.backgroundMode) {
        engine.scanOnce();
      }
    }, 900);

    // Runtime message listener for popup quick actions & background alarm wakes
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
        if (!isContextAlive() || !msg || typeof msg !== 'object') return;
        if (msg.type === 'GMAH_BG_TICK') {
          if (!bgPort) connectBackgroundPort();
          if (engine.settings.backgroundMode || !document.hidden) {
            const res = engine.scanOnce();
            sendResponse({ ok: true, result: res });
          } else {
            sendResponse({ ok: true, skipped: 'background_disabled' });
          }
        } else if (msg.type === 'GMAH_GET_STATE') {
          sendResponse({ ok: true, state: engine.getState() });
        } else if (msg.type === 'GMAH_RESET_BREAKER') {
          engine.clearBreaker();
          sendResponse({ ok: true, state: engine.getState() });
        } else if (msg.type === 'GMAH_EMERGENCY_STOP') {
          engine.emergencyStop();
          sendResponse({ ok: true, state: engine.getState() });
        }
      });
    }
  }

  bootstrapBrowser();
})(typeof globalThis !== 'undefined' ? globalThis : window);
