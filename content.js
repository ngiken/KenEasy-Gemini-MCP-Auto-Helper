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
    '[role="menuitem"]',
    'a[role="button"]',
    'mat-chip',
    'mat-chip-option',
    'mat-action-chip',
    '.mat-mdc-chip',
    '.mdc-evolution-chip',
    'md-filled-button',
    'md-outlined-button',
    'md-text-button',
    'md-tonal-button',
    'md-elevated-button',
    'mwc-button',
    '[data-test-id*="button"]',
    '[data-test-id*="chip"]',
    '[data-test-id*="continue"]',
    '[data-test-id*="allow"]',
    '[data-test-id*="approve"]',
    '.suggestion-chip',
    '.follow-up-chip'
  ].join(',');

  const APPROVAL_EXTRA_SIBLING_KEYWORDS = [
    'no',
    'not now',
    'skip',
    'block',
    'never',
    '否',
    '暂不',
    '跳过',
    '阻止'
  ];

  const GENERIC_AFFIRMATIVE_CONTINUE_SET = new Set([
    'yes',
    'confirm',
    '是',
    '是的',
    '好',
    '好的',
    '确认',
    '確認',
    '确定',
    '確定',
    'はい'
  ]);

  const GENERIC_SINGLE_ALLOW_SET = new Set([
    '允许',
    '允許',
    '容許',
    '批准',
    '同意',
    'allow',
    'approve',
    'accept',
    'permit',
    '許可',
    '承認'
  ]);

  const EXPLICIT_TRUNCATION_CONTINUE_SET = new Set([
    '继续生成',
    '繼續生成',
    '点击继续',
    '點擊繼續',
    'continue generating',
    'continue generation',
    'click to continue',
    '生成を続ける',
    'クリックして続行'
  ]);

  const NON_CHAT_PATH_RE = /^\/(?:u\/\d+\/)?(?:gems|extensions|saved-info|plugins|updates|sharing|settings|faq|advanced|pricing|about)(?:\/|$)/i;
  const FRESH_CHAT_LANDING_PATH_RE = /^\/(?:u\/\d+\/)?(?:app\/?)?$/i;

  function isNonChatGeminiUrl(url) {
    if (typeof url !== 'string' || !url) return false;
    try {
      const parsed = new URL(url, 'https://gemini.google.com');
      return NON_CHAT_PATH_RE.test(parsed.pathname || '');
    } catch (_) {
      return /gemini\.google\.com\/(?:u\/\d+\/)?(?:gems|extensions|saved-info|plugins|updates|sharing|settings|faq|advanced|pricing|about)(?:\/|$|\?|#)/i.test(
        url
      );
    }
  }

  function isFreshChatLandingUrl(url) {
    if (typeof url !== 'string' || !url) return false;
    try {
      const parsed = new URL(url, 'https://gemini.google.com');
      return FRESH_CHAT_LANDING_PATH_RE.test(parsed.pathname || '');
    } catch (_) {
      return /gemini\.google\.com\/(?:u\/\d+\/)?(?:app\/?)?(?:\?|#|$)/i.test(url);
    }
  }

  const DIALOG_OR_SURVEY_NEGATIVE_SIBLINGS = [
    'no',
    'cancel',
    'delete',
    'remove',
    'deny',
    'reject',
    'dismiss',
    'close',
    'not now',
    '否',
    '不是',
    '取消',
    '删除',
    '刪除',
    '拒绝',
    '拒絕',
    '关闭',
    '關閉',
    '不需要'
  ];

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

  const CONNECTING_STATUS_SELECTORS = [
    '[role="status"]',
    '[role="progressbar"]',
    '.tool-call',
    '.mcp-status',
    '.connecting',
    '.loading-text',
    '[data-test-id*="tool"]',
    '[data-test-id*="mcp"]',
    '[data-test-id*="connect"]',
    '[data-test-id*="progress"]',
    '[data-test-id*="loading"]'
  ];

  const CONNECTING_KEYWORDS = [
    'connecting',
    'reconnecting',
    'calling tool',
    'running tool',
    'executing tool',
    'waiting for tool',
    'waiting for mcp',
    'loading mcp',
    '正在连接',
    '重新连接',
    '连接中',
    '連接中',
    '正在連接',
    '正在调用',
    '正在調用',
    '正在运行工具',
    '正在执行工具',
    '等待响应',
    '等待工具'
  ];

  const STRONG_FOLLOWUP_PROMPT_CUES = [
    '点下方',
    '点击下方',
    '點下方',
    '點擊下方',
    '是否继续',
    '要我继续',
    '要不要',
    '继续下一步',
    '下一步',
    '需要我',
    '确认没问题',
    '確認沒問題',
    'would you like',
    'shall i',
    'should i',
    'want me to',
    'ready to',
    'proceed',
    'confirm'
  ];

  const FOLLOWUP_PROMPT_OVERRIDE_CUES = ['?', '？'].concat(STRONG_FOLLOWUP_PROMPT_CUES);

  const STOP_BUTTON_COMBINED_SELECTOR = STOP_BUTTON_SELECTORS.join(',');
  const LOADING_COMBINED_SELECTOR = LOADING_SELECTORS.join(',');
  const ALERT_COMBINED_SELECTOR = ALERT_SELECTORS.join(',');
  const CONNECTING_STATUS_COMBINED_SELECTOR = CONNECTING_STATUS_SELECTORS.join(',');

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
        if (role === 'navigation' || role === 'menubar') return true;
        if (cur.getAttribute('contenteditable') === 'true') return true;
        const testId = (cur.getAttribute('data-test-id') || '').toLowerCase();
        if (
          testId.includes('conversation-list') ||
          testId.includes('sidebar') ||
          testId.includes('sidenav') ||
          testId.includes('feedback') ||
          testId.includes('survey')
        ) {
          return true;
        }
      }
      cur = cur.parentElement || (cur.getRootNode && cur.getRootNode().host) || null;
    }
    return false;
  }

  function hasAncestorRoleOrTag(el, roles, tags) {
    let cur = el;
    while (cur && cur.nodeType === 1) {
      const tag = (cur.tagName || '').toUpperCase();
      if (tags && tags.indexOf(tag) >= 0) return true;
      if (cur.getAttribute) {
        const role = (cur.getAttribute('role') || '').toLowerCase();
        if (roles && roles.indexOf(role) >= 0) return true;
      }
      cur = cur.parentElement || (cur.getRootNode && cur.getRootNode().host) || null;
    }
    return false;
  }

  function isInsideMenu(el) {
    return hasAncestorRoleOrTag(el, ['menu'], ['MAT-MENU']);
  }

  function isInsideModalDialog(el) {
    return hasAncestorRoleOrTag(el, ['dialog', 'alertdialog'], ['DIALOG', 'MAT-DIALOG-CONTAINER']);
  }

  function isElementVisible(el, win, doc, opts) {
    if (!el || el.nodeType !== 1) return false;
    if (el.disabled === true || el.hidden === true) return false;
    if (el.getAttribute) {
      if (el.getAttribute('aria-disabled') === 'true') return false;
      if (el.getAttribute('aria-hidden') === 'true') return false;
    }

    const w = win || (typeof window !== 'undefined' ? window : null);
    const d = doc || (el.ownerDocument || (typeof document !== 'undefined' ? document : null));

    // In background tabs or minimized windows (document.hidden === true), Chrome suspends CSS
    // fade-in transitions (leaving newly mounted buttons at opacity:0) and defers layout (0x0 rect)
    // until the tab regains focus. Only relax these for interactive clickables (relaxHiddenLayout:true);
    // keep strict opacity/rect checks for generating/loading indicators unless window is minimized,
    // so faded-out spinners in background tabs never falsely block Auto-Continue.
    const isPageHidden = Boolean(d && d.hidden === true);
    const isWindowMinimized = Boolean(isPageHidden && w && w.innerWidth === 0 && w.innerHeight === 0);
    const relaxHiddenLayout = Boolean(opts && opts.relaxHiddenLayout && isPageHidden);

    let selfDisplay = '';
    let cur = el;
    while (cur && cur.nodeType === 1) {
      if (cur.hidden === true) return false;
      if (cur.getAttribute && cur.getAttribute('aria-hidden') === 'true') return false;
      if (!relaxHiddenLayout) {
        const curCls =
          typeof cur.className === 'string'
            ? cur.className
            : (cur.getAttribute && cur.getAttribute('class')) || '';
        if (/\b(ng-hide|cdk-visually-hidden|visually-hidden|display-none|d-none|invisible)\b/i.test(curCls)) {
          return false;
        }
      }
      if (w && typeof w.getComputedStyle === 'function') {
        try {
          const style = w.getComputedStyle(cur);
          if (style) {
            if (cur === el) selfDisplay = style.display || '';
            if (style.display === 'none' || style.visibility === 'hidden') return false;
            if (!relaxHiddenLayout && style.opacity !== '' && parseFloat(style.opacity) === 0) return false;
            if (!relaxHiddenLayout && cur === el) {
              if (
                (style.width === '0px' && style.height === '0px') ||
                (typeof style.transform === 'string' && /scale\(\s*0(?:\s*,\s*0)?\s*\)/i.test(style.transform))
              ) {
                return false;
              }
            }
            if (cur === el && style.pointerEvents === 'none') return false;
          }
        } catch (_) {
          // Ignore computed style errors in exotic nodes
        }
      }
      cur = cur.parentElement || (cur.getRootNode && cur.getRootNode().host) || null;
    }

    if (!relaxHiddenLayout && !isWindowMinimized && selfDisplay !== 'contents' && typeof el.getBoundingClientRect === 'function') {
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

  function appendLabelChunk(acc, part) {
    const cleanPart = typeof part === 'string' ? part.replace(/[\u200B-\u200D\uFEFF]/g, '') : '';
    if (!cleanPart) return acc;
    if (!acc) return cleanPart;
    // Insert a single space when adjacent inline tags split ASCII words (e.g. <span>Always</span><span>allow</span>)
    // without inserting artificial spaces between CJK characters (e.g. <span>始终</span><span>允许</span>).
    if (/[a-z0-9]$/i.test(acc) && /^[a-z0-9]/i.test(cleanPart)) {
      return acc + ' ' + cleanPart;
    }
    return acc + cleanPart;
  }

  function extractVisibleLabelText(node, isRoot) {
    if (!node) return '';
    if (!isRoot && isIconOrDecorativeNode(node)) return '';

    // Support Material Web Components (<md-filled-button> etc.) that project labels via <slot>
    if (
      node.nodeType === 1 &&
      (node.tagName || '').toUpperCase() === 'SLOT' &&
      typeof node.assignedNodes === 'function'
    ) {
      let assigned = [];
      try {
        assigned = node.assignedNodes({ flatten: true }) || [];
      } catch (_) {
        assigned = [];
      }
      if (assigned.length > 0) {
        let slotOut = '';
        for (let i = 0; i < assigned.length; i++) {
          const item = assigned[i];
          if (!item) continue;
          if (item.nodeType === 3) {
            slotOut = appendLabelChunk(slotOut, item.nodeValue || item.textContent || '');
          } else if (item.nodeType === 1 && !isIconOrDecorativeNode(item)) {
            slotOut = appendLabelChunk(slotOut, extractVisibleLabelText(item, false));
          }
        }
        return slotOut.replace(/\s+/g, ' ').trim();
      }
    }

    if (node.childNodes && typeof node.childNodes.length === 'number' && node.childNodes.length > 0) {
      let out = '';
      for (let i = 0; i < node.childNodes.length; i++) {
        const child = node.childNodes[i];
        if (!child) continue;
        if (child.nodeType === 3) {
          out = appendLabelChunk(out, child.nodeValue || child.textContent || '');
        } else if (child.nodeType === 1) {
          if (isIconOrDecorativeNode(child)) continue;
          out = appendLabelChunk(out, extractVisibleLabelText(child, false));
        }
      }
      const cleaned = out.replace(/\s+/g, ' ').trim();
      if (cleaned) return cleaned;
      return node.shadowRoot ? extractVisibleLabelText(node.shadowRoot, false) : '';
    }

    if (node.children && node.children.length > 0) {
      let out = typeof node._ownText === 'string' ? node._ownText : '';
      for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i];
        if (!child || isIconOrDecorativeNode(child)) continue;
        out = appendLabelChunk(out, extractVisibleLabelText(child, false));
      }
      const cleaned = out.replace(/\s+/g, ' ').trim();
      if (cleaned) return cleaned;
      return node.shadowRoot ? extractVisibleLabelText(node.shadowRoot, false) : '';
    }

    const direct = (node.innerText || node.textContent || '').replace(/\s+/g, ' ').trim();
    if (direct) return direct;

    if (node.shadowRoot) {
      return extractVisibleLabelText(node.shadowRoot, false);
    }
    return '';
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
   * Collects the root node plus all nested open ShadowRoots once per scan pass.
   */
  function collectSearchRoots(rootNode, out) {
    const roots = out || [];
    if (!rootNode) return roots;
    roots.push(rootNode);
    if (typeof rootNode.querySelectorAll === 'function') {
      const allNodes = rootNode.querySelectorAll('*');
      for (let i = 0; i < allNodes.length; i++) {
        const node = allNodes[i];
        if (node && node.shadowRoot) {
          collectSearchRoots(node.shadowRoot, roots);
        }
      }
    }
    return roots;
  }

  function queryAllFromRoots(roots, selector, out) {
    const results = out || [];
    if (!Array.isArray(roots)) return results;
    for (let r = 0; r < roots.length; r++) {
      const rootNode = roots[r];
      if (!rootNode || typeof rootNode.querySelectorAll !== 'function') continue;
      const matched = rootNode.querySelectorAll(selector);
      for (let i = 0; i < matched.length; i++) {
        results.push(matched[i]);
      }
    }
    return results;
  }

  /**
   * Collects all elements matching a selector across light DOM and open shadow roots.
   */
  function queryAllDeep(rootNode, selector, out) {
    return queryAllFromRoots(collectSearchRoots(rootNode, []), selector, out);
  }

  function collectClickableElements(doc, win, searchRoots) {
    const roots = Array.isArray(searchRoots) ? searchRoots : collectSearchRoots(doc.body || doc, []);
    const raw = queryAllFromRoots(roots, INTERACTIVE_SELECTOR, []);
    const seen = new Set();
    const valid = [];

    for (const el of raw) {
      if (!el || seen.has(el)) continue;
      seen.add(el);
      if (isIgnoredAncestor(el)) continue;
      if (!isElementVisible(el, win, doc, { relaxHiddenLayout: true })) continue;
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

  const SIBLING_BUTTON_SELECTOR =
    'button, [role="button"], md-filled-button, md-outlined-button, md-text-button, md-tonal-button, md-elevated-button, mwc-button';

  function hasClickedSiblingButton(el, clickedElements, clickAttempts) {
    const hasTracked =
      (clickedElements && clickedElements.size > 0) ||
      (clickAttempts && clickAttempts.size > 0);
    if (!hasTracked) return false;
    let container =
      el.parentElement ||
      el.parentNode ||
      (el.getRootNode && el.getRootNode() !== el ? el.getRootNode() : null);
    for (let depth = 0; depth < 5 && container; depth++) {
      const tag = (container.tagName || '').toUpperCase();
      if (tag === 'BODY' || tag === 'HTML' || tag === 'MAIN') break;
      if (typeof container.querySelectorAll === 'function') {
        const siblings = container.querySelectorAll(SIBLING_BUTTON_SELECTOR);
        if (siblings.length > 8) break;
        let otherCount = 0;
        for (let i = 0; i < siblings.length; i++) {
          const sib = siblings[i];
          if (sib === el || containsDeep(sib, el) || containsDeep(el, sib)) continue;
          otherCount += 1;
          if (
            (clickedElements && clickedElements.has(sib)) ||
            (clickAttempts && clickAttempts.has(sib))
          ) {
            return true;
          }
        }
        // Stop at the innermost multi-button group so separate stacked cards stay independent
        if (otherCount > 0) break;
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
      .concat(APPROVAL_EXTRA_SIBLING_KEYWORDS)
      .concat(settings.alwaysAllowKeywords || [])
      .concat(settings.customAlwaysAllowKeywords || []);

    let container =
      el.parentElement ||
      el.parentNode ||
      (el.getRootNode && el.getRootNode() !== el ? el.getRootNode() : null);
    for (let depth = 0; depth < 5 && container; depth++) {
      const tag = (container.tagName || '').toUpperCase();
      if (tag === 'BODY' || tag === 'HTML' || tag === 'MAIN') break;
      if (typeof container.querySelectorAll === 'function') {
        const siblings = container.querySelectorAll(SIBLING_BUTTON_SELECTOR);
        if (siblings.length > 8) break;
        for (let i = 0; i < siblings.length; i++) {
          const sib = siblings[i];
          if (sib === el || containsDeep(sib, el) || containsDeep(el, sib)) continue;
          const sibLabel = getElementLabel(sib);
          if (sibLabel && sibLabel.length <= 64 && D.containsKeyword(sibLabel, denyAndAlways)) {
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

  function isFollowUpChipElement(el, rawLabel) {
    if (typeof rawLabel === 'string' && /^\s*[↪↳↵↩]/.test(rawLabel)) {
      return true;
    }
    let cur = el;
    for (let depth = 0; depth < 3 && cur && cur.nodeType === 1; depth++) {
      const tag = (cur.tagName || '').toUpperCase();
      if (tag === 'MAT-CHIP' || tag === 'MAT-ACTION-CHIP' || tag === 'MAT-CHIP-OPTION') {
        return true;
      }
      const cls =
        typeof cur.className === 'string'
          ? cur.className
          : (cur.getAttribute && cur.getAttribute('class')) || '';
      if (/\b(follow-up-chip|suggestion-chip|mat-mdc-chip|mdc-evolution-chip)\b/i.test(cls)) {
        return true;
      }
      const testId = (cur.getAttribute && cur.getAttribute('data-test-id') || '').toLowerCase();
      if (testId.includes('chip') || testId.includes('follow-up') || testId.includes('suggestion')) {
        return true;
      }
      cur = cur.parentElement || (cur.getRootNode && cur.getRootNode().host) || null;
    }
    return false;
  }

  function hasNegativeSiblingInGroup(el) {
    let container =
      el.parentElement ||
      el.parentNode ||
      (el.getRootNode && el.getRootNode() !== el ? el.getRootNode() : null);
    // Check only immediate button group (depth < 2) so a solo "Yes" follow-up chip never climbs
    // into <model-response> and hits unrelated message action bar buttons.
    for (let depth = 0; depth < 2 && container; depth++) {
      const tag = (container.tagName || '').toUpperCase();
      if (tag === 'BODY' || tag === 'HTML' || tag === 'MAIN' || tag === 'MODEL-RESPONSE') break;
      if (typeof container.querySelectorAll === 'function') {
        const siblings = container.querySelectorAll(SIBLING_BUTTON_SELECTOR);
        if (siblings.length > 6) break;
        let otherCount = 0;
        for (let i = 0; i < siblings.length; i++) {
          const sib = siblings[i];
          if (sib === el || containsDeep(sib, el) || containsDeep(el, sib)) continue;
          otherCount += 1;
          const sibLabel = getElementLabel(sib);
          if (
            sibLabel &&
            D.matchButtonLabel(sibLabel, DIALOG_OR_SURVEY_NEGATIVE_SIBLINGS, {
              maxLen: 20,
              mode: 'exact'
            })
          ) {
            return true;
          }
        }
        if (otherCount > 0) break;
      }
      container =
        container.parentElement ||
        (container.nodeType === 11 ? container.host : container.parentNode) ||
        null;
    }
    return false;
  }

  function getAssistantTurns(doc, searchRoots) {
    if (!doc) return [];
    const roots = Array.isArray(searchRoots) ? searchRoots : collectSearchRoots(doc.body || doc, []);
    for (const sel of TURN_SELECTORS) {
      const nodes = queryAllFromRoots(roots, sel, []);
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

  const BG_ALLOW_RETRY_DELAY_MS = 2500;
  const BG_CONTINUE_RETRY_DELAY_MS = 3500;
  const MAX_BG_CLICK_ATTEMPTS = 2;

  function isBackgroundOrUnfocused(doc) {
    if (!doc) return false;
    if (doc.hidden === true) return true;
    if (typeof doc.hasFocus === 'function') {
      try {
        return !doc.hasFocus();
      } catch (_) {}
    }
    return false;
  }

  function isNoisyMutationTarget(node) {
    let cur = node;
    if (cur && cur.nodeType !== 1) {
      cur = cur.parentElement || cur.parentNode || null;
      if (cur && cur.nodeType === 11 && cur.host) cur = cur.host;
    }
    for (let depth = 0; depth < 3 && cur && cur.nodeType === 1; depth++) {
      if (isIconOrDecorativeNode(cur)) return true;
      const role = cur.getAttribute ? (cur.getAttribute('role') || '').toLowerCase() : '';
      if (role === 'tooltip') return true;
      const cls =
        typeof cur.className === 'string'
          ? cur.className
          : (cur.getAttribute && cur.getAttribute('class')) || '';
      if (
        /\b(mat-ripple|mat-mdc-ripple-element|mat-ripple-element|cdk-overlay-backdrop|mdc-tooltip|mat-mdc-tooltip)\b/i.test(
          cls
        )
      ) {
        return true;
      }
      cur = cur.parentElement || (cur.getRootNode && cur.getRootNode().host) || null;
    }
    return false;
  }

  function resolveClickTarget(el, attempt) {
    if (!el || attempt < 2) return el;
    // On retry, pierce custom Material Web Components (<md-filled-button>, etc.) to click the inner native <button>
    if (el.shadowRoot && typeof el.shadowRoot.querySelector === 'function') {
      const inner = el.shadowRoot.querySelector('button, [role="button"]');
      if (inner && !inner.disabled) return inner;
    }
    return el;
  }

  function defaultClickElement(el, win, attempt) {
    const w = win || (typeof window !== 'undefined' ? window : null);
    const target = resolveClickTarget(el, attempt || 1);
    let coords = {};
    if (typeof target.getBoundingClientRect === 'function') {
      try {
        const rect = target.getBoundingClientRect();
        if (rect && rect.width > 0 && rect.height > 0) {
          coords = {
            clientX: Math.round((rect.left || 0) + rect.width / 2),
            clientY: Math.round((rect.top || 0) + rect.height / 2)
          };
        }
      } catch (_) {}
    }

    const baseOpts = Object.assign(
      { bubbles: true, cancelable: true, composed: true, button: 0 },
      coords
    );
    const downOpts = Object.assign({ buttons: 1 }, baseOpts);
    const upOpts = Object.assign({ buttons: 0 }, baseOpts);

    // Safe non-scrolling focus on retry attempts helps background Angular/MWC components register interaction
    if ((attempt || 1) >= 2 && typeof target.focus === 'function') {
      try {
        target.focus({ preventScroll: true });
      } catch (_) {
        try {
          target.focus();
        } catch (_) {}
      }
    }

    try {
      if (w && typeof w.PointerEvent === 'function') {
        target.dispatchEvent(new w.PointerEvent('pointerdown', Object.assign({ pointerId: 1, isPrimary: true }, downOpts)));
      }
      if (w && typeof w.MouseEvent === 'function') {
        target.dispatchEvent(new w.MouseEvent('mousedown', downOpts));
      }
      if (w && typeof w.PointerEvent === 'function') {
        target.dispatchEvent(new w.PointerEvent('pointerup', Object.assign({ pointerId: 1, isPrimary: true }, upOpts)));
      }
      if (w && typeof w.MouseEvent === 'function') {
        target.dispatchEvent(new w.MouseEvent('mouseup', upOpts));
      }
    } catch (_) {
      // Fallback to plain click
    }
    if (typeof target.click === 'function') {
      target.click();
    } else if (w && typeof w.MouseEvent === 'function') {
      target.dispatchEvent(new w.MouseEvent('click', upOpts));
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
      this.onStallAlert = typeof opts.onStallAlert === 'function' ? opts.onStallAlert : null;
      this.onStallResolved = typeof opts.onStallResolved === 'function' ? opts.onStallResolved : null;

      this.settings = D.mergeSettings(opts.settings);
      this.stats = D.normalizeStats(opts.stats, D.getTodayKey(new Date(this.now())));

      this.clickedElements = new Set();
      this.clickAttempts = new Map(); // el -> { kind, count, lastAttemptAt, label, tier }
      this.taskContinueCount = 0;
      this.stagnantCount = 0;
      this.lastContinueFingerprint = null;
      this.lastContinueContentFingerprint = null;
      this.lastAllowClickAt = 0;
      this.lastContinueClickAt = 0;
      this.lastMutationAt = 0;
      this.lastUrl = this.win && this.win.location ? this.win.location.href : '';
      this.statusKey = 'hudStatusMonitoring';
      this.statusVars = null;
      this.lastStatusText = this.tr('hudStatusMonitoring');
      this.isGenerating = false;
      this.isNonChatPage = isNonChatGeminiUrl(this.lastUrl);
      this.ignoreStaleInitialContinue = Boolean(opts.ignoreStaleInitialContinue);
      this.suppressInitialContinueUntil = this.ignoreStaleInitialContinue ? this.now() + 2000 : 0;

      // Connection / waiting stall timer state
      this.stallStartAt = 0;
      this.stallFingerprint = null;
      this.stallAlertActive = false;

      this.circuitBreaker = {
        tripped: false,
        reasonCode: null,
        reasonKey: null,
        reasonVars: null,
        reason: ''
      };

      this.logs = [];
      this.maxLogs = 40;
    }

    tr(key, vars) {
      const lang = this.settings && this.settings.language;
      return D.t(lang, key, vars);
    }

    setStatus(key, vars) {
      this.statusKey = key;
      this.statusVars = vars || null;
      this.lastStatusText = this.tr(key, vars);
    }

    refreshLocalizedTexts() {
      if (this.circuitBreaker.tripped && this.circuitBreaker.reasonKey) {
        this.circuitBreaker.reason = this.tr(
          this.circuitBreaker.reasonKey,
          this.circuitBreaker.reasonVars
        );
        this.lastStatusText = this.tr('hudStatusBreaker', { reason: this.circuitBreaker.reason });
      } else if (this.statusKey) {
        this.lastStatusText = this.tr(this.statusKey, this.statusVars);
      }
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
        isNonChatPage: this.isNonChatPage,
        stallAlertActive: this.stallAlertActive,
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

    resetStallMonitor(notifyIfActive, resolvedLog) {
      const wasActive = this.stallAlertActive;
      this.stallStartAt = 0;
      this.stallFingerprint = null;
      this.stallAlertActive = false;
      if (wasActive) {
        if (this.statusKey === 'hudStatusStallMinutes' || (this.lastStatusText && this.lastStatusText.startsWith('⚠️'))) {
          this.setStatus('hudStatusMonitoring');
        }
        if (resolvedLog) {
          this.addLog(resolvedLog);
        }
        if (notifyIfActive && this.onStallResolved) {
          this.onStallResolved();
        }
      }
    }

    reconcileBreakerWithSettings() {
      if (!this.circuitBreaker.tripped) return false;
      if (
        this.circuitBreaker.reasonCode === 'daily_limit' &&
        (this.settings.dailyContinueLimit === 0 ||
          this.stats.continueCount < this.settings.dailyContinueLimit)
      ) {
        this.clearBreaker('今日计数已清零或上限已放开，自动解除每日熔断');
        return true;
      }
      if (
        this.circuitBreaker.reasonCode === 'task_limit' &&
        this.taskContinueCount < this.settings.maxContinuesPerTask
      ) {
        this.clearBreaker('单次任务上限已提高，自动解除任务熔断');
        return true;
      }
      return false;
    }

    updateSettings(partial, persist) {
      const prevStallAlert = this.settings ? this.settings.stallAlertEnabled : true;
      this.settings = D.mergeSettings(Object.assign({}, this.settings, partial));
      this.refreshLocalizedTexts();
      if (!this.settings.enabled || !this.settings.stallAlertEnabled) {
        this.resetStallMonitor(true);
      }
      if (prevStallAlert && !this.settings.stallAlertEnabled) {
        if (this.onStallResolved) {
          this.onStallResolved();
        }
      }
      if (persist && this.onSettingsSave) {
        this.onSettingsSave(this.settings);
      }
      if (!this.reconcileBreakerWithSettings()) {
        this.emitState();
      }
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

    tripBreaker(reasonCode, reason, reasonKey, reasonVars) {
      if (this.circuitBreaker.tripped && this.circuitBreaker.reasonCode === reasonCode) {
        return;
      }
      this.resetStallMonitor(true);
      const resolvedReason = reasonKey ? this.tr(reasonKey, reasonVars) : reason;
      this.circuitBreaker = {
        tripped: true,
        reasonCode,
        reasonKey: reasonKey || null,
        reasonVars: reasonVars || null,
        reason: resolvedReason
      };
      this.statusKey = null;
      this.statusVars = null;
      this.lastStatusText = this.tr('hudStatusBreaker', { reason: resolvedReason });
      this.addLog(`🛑 熔断触发: ${resolvedReason}`);
      this.emitState();
    }

    emergencyStop() {
      this.tripBreaker('emergency_stop', null, 'breakerReasonEmergency');
    }

    clearBreaker(logMsg) {
      const prevCode = this.circuitBreaker.reasonCode;
      this.resetStallMonitor(true);
      this.circuitBreaker = {
        tripped: false,
        reasonCode: null,
        reasonKey: null,
        reasonVars: null,
        reason: ''
      };
      if (prevCode === 'task_limit' || prevCode === 'stagnant_output' || prevCode === 'emergency_stop') {
        this.taskContinueCount = 0;
        this.stagnantCount = 0;
        this.lastContinueFingerprint = null;
        this.lastContinueContentFingerprint = null;
      }
      this.setStatus('hudStatusMonitoring');
      this.addLog(logMsg || '✅ 已解除熔断并重置本次任务计数');
      this.emitState();
    }

    onUserManualPrompt() {
      this.resetStallMonitor(true);
      this.suppressInitialContinueUntil = 0;
      this.taskContinueCount = 0;
      this.stagnantCount = 0;
      this.lastContinueFingerprint = null;
      this.lastContinueContentFingerprint = null;
      this.clickAttempts.clear();
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
      const prevUrl = this.lastUrl;
      this.resetStallMonitor(true);
      this.lastUrl = newUrl;
      this.isNonChatPage = isNonChatGeminiUrl(newUrl);
      // Do NOT suppress continue when transitioning from fresh /app landing page into a brand-new /app/<id> chat
      const isFreshChatCreation = isFreshChatLandingUrl(prevUrl) && !this.isNonChatPage && !isFreshChatLandingUrl(newUrl);
      this.suppressInitialContinueUntil =
        this.ignoreStaleInitialContinue && !isFreshChatCreation ? this.now() + 2000 : 0;
      this.taskContinueCount = 0;
      this.stagnantCount = 0;
      this.lastContinueFingerprint = null;
      this.lastContinueContentFingerprint = null;
      this.clickAttempts.clear();
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

    detectGenerating(searchRoots) {
      if (!this.doc) return false;
      const roots = Array.isArray(searchRoots)
        ? searchRoots
        : collectSearchRoots(this.doc.body || this.doc, []);
      const stopNodes = queryAllFromRoots(roots, STOP_BUTTON_COMBINED_SELECTOR, []);
      for (const n of stopNodes) {
        if (!isIgnoredAncestor(n) && isElementVisible(n, this.win, this.doc)) {
          return true;
        }
      }
      const loadingNodes = queryAllFromRoots(roots, LOADING_COMBINED_SELECTOR, []);
      for (const n of loadingNodes) {
        if (!isIgnoredAncestor(n) && isElementVisible(n, this.win, this.doc)) {
          return true;
        }
      }
      return false;
    }

    detectConnectingStatus(searchRoots) {
      if (!this.doc) return null;
      const roots = Array.isArray(searchRoots)
        ? searchRoots
        : collectSearchRoots(this.doc.body || this.doc, []);
      const nodes = queryAllFromRoots(roots, CONNECTING_STATUS_COMBINED_SELECTOR, []);
      for (const n of nodes) {
        if (isIgnoredAncestor(n) || !isElementVisible(n, this.win, this.doc)) continue;
        const txt = (n.innerText || n.textContent || '').replace(/\s+/g, ' ').trim();
        if (!txt || txt.length > 140) continue;
        if (D.containsKeyword(txt, CONNECTING_KEYWORDS)) {
          return txt;
        }
      }
      return null;
    }

    computeStallProgressFingerprint(turns, connectingText) {
      const turnFp = computeResponseFingerprint(turns) || '';
      // Strip volatile digits / animated ellipsis from status indicators (e.g. "Connecting (12s)...")
      const stableStatus = connectingText
        ? D.normalizeText(connectingText)
            .replace(/\d+/g, '#')
            .replace(/[.。…]+/g, '')
            .trim()
            .slice(0, 100)
        : '';
      return `${turnFp}|a:${this.stats.allowCount}|c:${this.stats.continueCount}|s:${stableStatus}`;
    }

    updateStallMonitor(now, turns, isWaiting, connectingText) {
      if (!this.settings.enabled || !this.settings.stallAlertEnabled) {
        this.resetStallMonitor(true);
        return false;
      }

      if (!isWaiting) {
        this.resetStallMonitor(true, '✅ 连接/生成已恢复正常，已清除超时提醒');
        return false;
      }

      const fp = this.computeStallProgressFingerprint(turns, connectingText);
      if (this.stallStartAt === 0 || fp !== this.stallFingerprint) {
        this.stallStartAt = now;
        this.stallFingerprint = fp;
        if (this.stallAlertActive) {
          this.stallAlertActive = false;
          if (this.statusKey === 'hudStatusStallMinutes' || (this.lastStatusText && this.lastStatusText.startsWith('⚠️'))) {
            this.setStatus('hudStatusMonitoring');
          }
          this.addLog('✅ 检测到新输出进展，已清除连接超时提醒');
          if (this.onStallResolved) this.onStallResolved();
        }
        return false;
      }

      const thresholdMs = Math.max(1, this.settings.stallAlertMinutes) * 60 * 1000;
      const elapsedMs = now - this.stallStartAt;
      if (!this.stallAlertActive && elapsedMs >= thresholdMs) {
        this.stallAlertActive = true;
        const mins = Math.max(1, Math.floor(elapsedMs / 60000));
        this.setStatus('hudStatusStallMinutes', { mins });
        this.addLog(`🔔 检测到连接/等待连续超过 ${mins} 分钟无新进展，已发送桌面通知`);
        if (this.onStallAlert) {
          this.onStallAlert({
            minutes: mins,
            elapsedMs,
            url: this.lastUrl
          });
        }
        this.emitState();
        return true;
      }
      return false;
    }

    detectQuotaOrError(turns, searchRoots) {
      if (!this.settings.stopOnQuotaOrError) return null;

      // 1. Check visible alert/toast banners
      const roots = Array.isArray(searchRoots)
        ? searchRoots
        : collectSearchRoots(this.doc.body || this.doc, []);
      const alertNodes = queryAllFromRoots(roots, ALERT_COMBINED_SELECTOR, []);
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
        if (hasClickedSiblingButton(item.el, this.clickedElements, this.clickAttempts)) continue;
        if (D.containsKeyword(item.label, denyKws)) continue;

        const lower = D.normalizeText(item.label);
        if (
          lower.includes('cookie') ||
          lower.includes('クッキー') ||
          lower.includes('notification') ||
          lower.includes('通知') ||
          lower.includes('microphone') ||
          lower.includes('マイク') ||
          lower.includes('camera') ||
          lower.includes('カメラ') ||
          lower.includes('location') ||
          lower.includes('位置') ||
          lower.includes('麦克风') ||
          lower.includes('麥克風') ||
          lower.includes('摄像头') ||
          lower.includes('攝影機')
        ) {
          continue;
        }

        const mAlways =
          D.matchButtonLabel(item.label, defaultAlways, {
            maxLen: 72,
            mode: 'exact_or_contains'
          }) ||
          D.matchButtonLabel(item.label, customAlways, {
            maxLen: 80,
            mode: 'exact_or_contains'
          });

        if (mAlways) {
          alwaysMatches.push({ item, match: mAlways, tier: 'always' });
          continue;
        }

        // Only explicit "Always allow" items may be clicked inside role="menu" dropdowns
        if (isInsideMenu(item.el)) continue;

        const mSingle = D.matchButtonLabel(item.label, singleKws, {
          maxLen: 56,
          mode: 'exact_or_prefix'
        });

        if (mSingle) {
          // Non-exact or generic single-word allow (e.g. "Allow", "同意", "允许", "Allow Desktop Commander")
          // requires sibling approval context (e.g. Deny / Cancel / Always Allow nearby)
          const singleKey = D.stripEdgePunctuation(mSingle.keyword);
          const needsSiblingContext = !mSingle.exact || GENERIC_SINGLE_ALLOW_SET.has(singleKey);
          if (!needsSiblingContext || hasSiblingApprovalContext(item.el, this.settings)) {
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

    findBgRetryCandidate(kind, visibleSet, now) {
      if (!isBackgroundOrUnfocused(this.doc) || this.clickAttempts.size === 0) return null;
      const delay = kind === 'allow' ? BG_ALLOW_RETRY_DELAY_MS : BG_CONTINUE_RETRY_DELAY_MS;
      for (const [el, entry] of this.clickAttempts.entries()) {
        if (!entry || entry.kind !== kind) continue;
        if (entry.count >= MAX_BG_CLICK_ATTEMPTS) continue;
        if (!visibleSet.has(el)) continue;
        if (now - entry.lastAttemptAt >= delay) {
          return { el, entry };
        }
      }
      return null;
    }

    getNextBgRetryDelayMs(visibleSet, now) {
      if (!isBackgroundOrUnfocused(this.doc) || this.clickAttempts.size === 0) return 0;
      let minRemaining = 0;
      for (const [el, entry] of this.clickAttempts.entries()) {
        if (!entry || entry.count >= MAX_BG_CLICK_ATTEMPTS) continue;
        if (!visibleSet.has(el)) continue;
        const delay = entry.kind === 'allow' ? BG_ALLOW_RETRY_DELAY_MS : BG_CONTINUE_RETRY_DELAY_MS;
        const rem = Math.max(100, delay - (now - entry.lastAttemptAt));
        if (minRemaining === 0 || rem < minRemaining) {
          minRemaining = rem;
        }
      }
      return minRemaining;
    }

    findContinueCandidate(clickables, turns) {
      // Never auto-click Continue / Yes on pages without at least one assistant turn
      if (!Array.isArray(turns) || turns.length === 0) return null;

      const defaultCont = this.settings.continueKeywords || [];
      const customCont = this.settings.customContinueKeywords || [];
      const denyKws = this.settings.denyBlacklistKeywords || [];
      const latestTurn = turns[turns.length - 1];
      const matches = [];

      for (const item of clickables) {
        if (this.clickedElements.has(item.el)) continue;
        if (isInsideMenu(item.el) || isInsideModalDialog(item.el)) continue;
        if (D.containsKeyword(item.label, denyKws)) continue;
        if (isInsideOlderTurn(item.el, turns)) continue;

        // Strict exact match for built-in continue keywords so normal follow-up chips
        // (e.g. "继续优化性能" / "Continue exploring options") are NEVER mis-clicked.
        const mDefault = D.matchButtonLabel(item.label, defaultCont, {
          maxLen: 36,
          mode: 'exact'
        });
        if (mDefault) {
          const matchedKey = D.stripEdgePunctuation(mDefault.keyword);
          // Protect generic affirmative words ("Yes", "确认", "好的") from clicking unrelated page controls,
          // surveys, or dialogs: must be an explicit Gemini follow-up chip or inside the latest assistant turn
          // AND must not have a negative sibling.
          if (GENERIC_AFFIRMATIVE_CONTINUE_SET.has(matchedKey)) {
            const isChipOrInLatestTurn =
              isFollowUpChipElement(item.el, item.label) ||
              Boolean(latestTurn && containsDeep(latestTurn, item.el));
            if (!isChipOrInLatestTurn || hasNegativeSiblingInGroup(item.el)) {
              continue;
            }
          }
          matches.push({ item, match: mDefault });
          continue;
        }

        const mCustom = D.matchButtonLabel(item.label, customCont, {
          maxLen: 80,
          mode: 'exact_or_contains'
        });

        if (mCustom) {
          matches.push({ item, match: mCustom });
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
      // Traverse bottom-to-top so newest chat buttons (approval cards, Yes/继续 chips) appear first
      for (let i = clickables.length - 1; i >= 0; i--) {
        const item = clickables[i];
        const txt = item.label.replace(/\s+/g, ' ').trim();
        if (!txt || txt.length > 72) continue;
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
     * Marks any currently visible continue candidates as already seen so restored/navigated
     * chats in background or secondary browser windows do not auto-click stale history chips.
     */
    markExistingContinueCandidatesSeen() {
      if (!this.doc) return 0;
      const searchRoots = collectSearchRoots(this.doc.body || this.doc, []);
      if (this.detectGenerating(searchRoots)) return 0;
      const clickables = collectClickableElements(this.doc, this.win, searchRoots);
      const turns = getAssistantTurns(this.doc, searchRoots);
      let count = 0;
      let guard = 0;
      while (guard < 20) {
        guard += 1;
        const hit = this.findContinueCandidate(clickables, turns);
        if (!hit) break;
        this.clickedElements.add(hit.item.el);
        count += 1;
      }
      return count;
    }

    /**
     * Single scan tick. Returns an action descriptor for deterministic testing & debugging.
     */
    scanOnce() {
      if (!this.doc) return { action: 'noop', reason: 'no_doc' };

      // SPA URL change check
      const currentHref = this.win && this.win.location ? this.win.location.href : this.lastUrl;
      if (currentHref && currentHref !== this.lastUrl) {
        this.onConversationChange(currentHref);
      }

      this.isNonChatPage = isNonChatGeminiUrl(currentHref || this.lastUrl);
      if (this.isNonChatPage) {
        this.isGenerating = false;
        this.resetStallMonitor(true);
        this.emitState();
        return { action: 'noop', reason: 'non_chat_page' };
      }

      this.ensureTodayStats();
      const searchRoots = collectSearchRoots(this.doc.body || this.doc, []);
      this.isGenerating = this.detectGenerating(searchRoots);
      if (this.isGenerating) {
        this.suppressInitialContinueUntil = 0;
      }

      if (!this.settings.enabled) {
        this.resetStallMonitor(true);
        this.emitState();
        return { action: 'noop', reason: 'disabled' };
      }

      // Emergency stop blocks EVERYTHING (both Allow & Continue)
      if (this.circuitBreaker.tripped && this.circuitBreaker.reasonCode === 'emergency_stop') {
        this.resetStallMonitor(true);
        this.emitState();
        return { action: 'blocked', reason: 'emergency_stop' };
      }

      const now = this.now();
      const clickables = collectClickableElements(this.doc, this.win, searchRoots);
      const visibleSet = new Set(clickables.map((c) => c.el));
      const turns = getAssistantTurns(this.doc, searchRoots);
      const connectingText = this.detectConnectingStatus(searchRoots);
      const isWaiting = Boolean(this.isGenerating || connectingText);

      // Prune clicked elements that are no longer visible/mounted so Angular-recycled
      // DOM buttons can be clicked again in subsequent prompts without double-clicking live ones.
      if (this.clickedElements.size > 0) {
        for (const prevEl of Array.from(this.clickedElements)) {
          if (!visibleSet.has(prevEl)) {
            this.clickedElements.delete(prevEl);
          }
        }
      }
      if (this.clickAttempts.size > 0) {
        for (const prevEl of Array.from(this.clickAttempts.keys())) {
          if (!visibleSet.has(prevEl)) {
            this.clickAttempts.delete(prevEl);
          }
        }
      }

      // 1. Check MCP Permission Allow first (works even while Gemini turn is paused mid-generation!)
      if (this.settings.autoAllow) {
        const allowElapsed = now - this.lastAllowClickAt;
        if (allowElapsed >= this.settings.allowCooldownMs) {
          const allowHit = this.findAllowCandidate(clickables);
          if (allowHit) {
            this.clickedElements.add(allowHit.item.el);
            this.clickAttempts.set(allowHit.item.el, {
              kind: 'allow',
              count: 1,
              lastAttemptAt: now,
              label: allowHit.item.label,
              tier: allowHit.tier
            });
            this.lastAllowClickAt = now;
            this.stats.allowCount += 1;
            this.resetStallMonitor(true);
            if (this.onStatsSave) this.onStatsSave(this.stats, { allow: 1 });
            this.clickFn(allowHit.item.el, this.win, 1);
            const tag = allowHit.tier === 'always' ? '始终允许' : '允许';
            this.setStatus('hudStatusClickedAllow', { label: allowHit.item.label });
            this.addLog(`✅ 自动点击[${tag}]：「${allowHit.item.label}」`);
            this.emitState();
            return {
              action: 'clicked_allow',
              tier: allowHit.tier,
              label: allowHit.item.label,
              element: allowHit.item.el,
              pendingRetryInMs: isBackgroundOrUnfocused(this.doc) ? BG_ALLOW_RETRY_DELAY_MS : 0
            };
          }

          // Background click safety retry: if a previously clicked permission button failed to dismiss while hidden
          const allowRetry = this.findBgRetryCandidate('allow', visibleSet, now);
          if (allowRetry) {
            allowRetry.entry.count += 1;
            allowRetry.entry.lastAttemptAt = now;
            this.lastAllowClickAt = now;
            this.resetStallMonitor(true);
            this.clickFn(allowRetry.el, this.win, allowRetry.entry.count);
            this.setStatus('hudStatusRetryClick', {
              label: allowRetry.entry.label,
              attempt: allowRetry.entry.count,
              max: MAX_BG_CLICK_ATTEMPTS
            });
            this.addLog(
              `🔁 后台重试点击允许：「${allowRetry.entry.label}」 (${allowRetry.entry.count}/${MAX_BG_CLICK_ATTEMPTS})`
            );
            this.emitState();
            return {
              action: 'retried_allow',
              tier: allowRetry.entry.tier,
              label: allowRetry.entry.label,
              attempt: allowRetry.entry.count,
              element: allowRetry.el
            };
          }
        } else {
          const pendingAllow = this.findAllowCandidate(clickables);
          if (pendingAllow) {
            this.emitState();
            return {
              action: 'wait',
              reason: 'allow_cooldown',
              retryInMs: Math.max(100, this.settings.allowCooldownMs - allowElapsed)
            };
          }
        }
      }

      // Track connection / generation stall timeout (triggers desktop notification if stuck >= N mins)
      this.updateStallMonitor(now, turns, isWaiting, connectingText);

      // 2. Check Auto-Continue (strictly guarded by 6-layer anti-quota-burn circuit breaker)
      if (!this.settings.autoContinue) {
        this.emitState();
        return {
          action: 'noop',
          reason: 'auto_continue_off',
          pendingRetryInMs: this.getNextBgRetryDelayMs(visibleSet, now)
        };
      }

      if (this.circuitBreaker.tripped) {
        this.emitState();
        return { action: 'blocked', reason: this.circuitBreaker.reasonCode };
      }

      // Layer A: Quota / Rate-limit / Error Detection
      const quotaHit = this.detectQuotaOrError(turns, searchRoots);
      if (quotaHit) {
        this.tripBreaker('quota_error', null, 'breakerReasonQuotaError', { kw: quotaHit });
        return { action: 'tripped', reason: 'quota_error', keyword: quotaHit };
      }

      // Layer B: Wait for streaming to finish + DOM settle
      if (this.isGenerating) {
        this.emitState();
        return {
          action: 'wait',
          reason: 'generating',
          pendingRetryInMs: this.getNextBgRetryDelayMs(visibleSet, now)
        };
      }
      if (this.lastMutationAt > 0 && now - this.lastMutationAt < this.settings.idleSettleMs) {
        this.emitState();
        return {
          action: 'wait',
          reason: 'settling',
          retryInMs: Math.max(150, this.settings.idleSettleMs - (now - this.lastMutationAt))
        };
      }

      // Background click safety retry for Continue button that failed to dismiss while tab was hidden
      const currentFp = computeResponseFingerprint(turns);
      for (const [prevEl, entry] of Array.from(this.clickAttempts.entries())) {
        if (entry && entry.kind === 'continue' && entry.fingerprint && currentFp && currentFp !== entry.fingerprint) {
          // Previous continue click produced new output; clear retry record (and recycled DOM node marker)
          this.clickAttempts.delete(prevEl);
          this.clickedElements.delete(prevEl);
        }
      }
      const contRetry = this.findBgRetryCandidate('continue', visibleSet, now);
      if (contRetry) {
        contRetry.entry.count += 1;
        contRetry.entry.lastAttemptAt = now;
        this.lastContinueClickAt = now;
        this.resetStallMonitor(true);
        this.clickFn(contRetry.el, this.win, contRetry.entry.count);
        this.setStatus('hudStatusRetryClick', {
          label: contRetry.entry.label,
          attempt: contRetry.entry.count,
          max: MAX_BG_CLICK_ATTEMPTS
        });
        this.addLog(
          `🔁 后台重试点击继续：「${contRetry.entry.label}」 (${contRetry.entry.count}/${MAX_BG_CLICK_ATTEMPTS})`
        );
        this.emitState();
        return {
          action: 'retried_continue',
          label: contRetry.entry.label,
          attempt: contRetry.entry.count,
          element: contRetry.el
        };
      }

      // Find candidate first so we don't prematurely trip limits when there is no continue button!
      const contHit = this.findContinueCandidate(clickables, turns);
      if (!contHit) {
        this.emitState();
        return {
          action: 'noop',
          reason: 'no_continue_candidate',
          pendingRetryInMs: this.getNextBgRetryDelayMs(visibleSet, now)
        };
      }

      if (this.suppressInitialContinueUntil > 0 && now < this.suppressInitialContinueUntil) {
        this.clickedElements.add(contHit.item.el);
        this.emitState();
        return { action: 'noop', reason: 'initial_stale_continue_ignored' };
      }

      // Layer C: Per-task cap
      if (this.taskContinueCount >= this.settings.maxContinuesPerTask) {
        this.tripBreaker('task_limit', null, 'breakerReasonTaskLimit', {
          task: this.taskContinueCount,
          max: this.settings.maxContinuesPerTask
        });
        return { action: 'tripped', reason: 'task_limit' };
      }

      // Layer D: Daily cap (0 = unlimited, user can set a positive cap at any time)
      if (this.settings.dailyContinueLimit > 0 && this.stats.continueCount >= this.settings.dailyContinueLimit) {
        this.tripBreaker('daily_limit', null, 'breakerReasonDailyLimit', {
          daily: this.stats.continueCount,
          cap: this.settings.dailyContinueLimit
        });
        return { action: 'tripped', reason: 'daily_limit' };
      }

      // Layer E: Cooldown
      if (this.lastContinueClickAt > 0 && now - this.lastContinueClickAt < this.settings.continueCooldownMs) {
        this.emitState();
        return {
          action: 'wait',
          reason: 'cooldown',
          retryInMs: Math.max(150, this.settings.continueCooldownMs - (now - this.lastContinueClickAt))
        };
      }

      // Layer F: Completion cue guard (overridden by truncation cues, explicit continue-generating button, or follow-up prompt cues)
      if (this.settings.stopOnCompletionCues) {
        const latestText = getLatestResponseText(turns);
        if (latestText) {
          const tail = latestText.slice(-500);
          const doneCue = D.containsKeyword(tail, this.settings.completionCueKeywords);
          const truncCue = D.containsKeyword(tail, this.settings.truncationCueKeywords);
          const isExplicitTruncBtn = EXPLICIT_TRUNCATION_CONTINUE_SET.has(
            D.stripEdgePunctuation(contHit.item.label)
          );
          const isFollowUpChip = isFollowUpChipElement(contHit.item.el, contHit.item.label);
          const hasFollowupOverride = Boolean(
            isExplicitTruncBtn ||
              D.containsKeyword(tail, STRONG_FOLLOWUP_PROMPT_CUES) ||
              (isFollowUpChip && D.containsKeyword(tail, FOLLOWUP_PROMPT_OVERRIDE_CUES))
          );
          if (doneCue && !truncCue && !hasFollowupOverride) {
            this.clickedElements.add(contHit.item.el);
            this.setStatus('hudStatusSkippedCompletion', { cue: doneCue });
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
        this.tripBreaker('stagnant_output', null, 'breakerReasonStagnant');
        return { action: 'tripped', reason: 'stagnant_output' };
      }

      // Safe to click continue!
      this.clickedElements.add(contHit.item.el);
      this.clickAttempts.set(contHit.item.el, {
        kind: 'continue',
        count: 1,
        lastAttemptAt: now,
        label: contHit.item.label,
        fingerprint: fp
      });
      this.lastContinueClickAt = now;
      this.lastContinueFingerprint = fp;
      this.lastContinueContentFingerprint = contentFp;
      this.taskContinueCount += 1;
      this.stats.continueCount += 1;
      this.resetStallMonitor(true);
      if (this.onStatsSave) this.onStatsSave(this.stats, { continue: 1 });

      this.clickFn(contHit.item.el, this.win, 1);
      this.setStatus('hudStatusClickedContinue', {
        task: this.taskContinueCount,
        max: this.settings.maxContinuesPerTask
      });
      this.addLog(
        `▶️ 自动点击继续：「${contHit.item.label}」 (${this.taskContinueCount}/${this.settings.maxContinuesPerTask})`
      );
      this.emitState();

      return {
        action: 'clicked_continue',
        label: contHit.item.label,
        element: contHit.item.el,
        taskContinueCount: this.taskContinueCount,
        dailyContinueCount: this.stats.continueCount,
        pendingRetryInMs: isBackgroundOrUnfocused(this.doc) ? BG_CONTINUE_RETRY_DELAY_MS : 0
      };
    }
  }

  // Export for unit / integration tests
  root.GMAH_ENGINE = {
    GmahEngine,
    collectClickableElements,
    getAssistantTurns,
    isIgnoredAncestor,
    isNoisyMutationTarget,
    isBackgroundOrUnfocused,
    isElementVisible,
    isFollowUpChipElement,
    isNonChatGeminiUrl,
    isFreshChatLandingUrl,
    getElementLabel,
    computeResponseFingerprint,
    computeContentFingerprint,
    resolveClickTarget,
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
    let settingsReady = !hasChromeStorage;
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
    let statsFlushInFlight = false;
    let pendingStatsDelta = { allow: 0, continue: 0, date: null };

    function flushPendingStatsDelta() {
      if (statsFlushInFlight || !isContextAlive() || !hasChromeStorage) return;
      if (pendingStatsDelta.allow === 0 && pendingStatsDelta.continue === 0) return;
      const batch = {
        allow: pendingStatsDelta.allow,
        continue: pendingStatsDelta.continue,
        date: pendingStatsDelta.date || D.getTodayKey()
      };
      pendingStatsDelta.allow = 0;
      pendingStatsDelta.continue = 0;
      statsFlushInFlight = true;
      try {
        chrome.storage.local.get([D.STATS_KEY], (res) => {
          if (!isContextAlive()) {
            statsFlushInFlight = false;
            return;
          }
          const stored = D.normalizeStats(res && res[D.STATS_KEY], batch.date);
          const merged = {
            date: batch.date,
            allowCount: stored.allowCount + batch.allow,
            continueCount: stored.continueCount + batch.continue
          };
          engine.stats = Object.assign({}, merged);
          engine.emitState();
          try {
            chrome.storage.local.set({ [D.STATS_KEY]: Object.assign({}, merged) }, () => {
              statsFlushInFlight = false;
              if (pendingStatsDelta.allow > 0 || pendingStatsDelta.continue > 0) {
                flushPendingStatsDelta();
              }
            });
          } catch (_) {
            statsFlushInFlight = false;
            teardownStaleContext();
          }
        });
      } catch (_) {
        statsFlushInFlight = false;
        teardownStaleContext();
      }
    }

    const saveStats = (stats, delta) => {
      if (!isContextAlive() || !hasChromeStorage) return;
      try {
        if (delta && typeof chrome.storage.local.get === 'function') {
          pendingStatsDelta.date = stats.date;
          pendingStatsDelta.allow += delta.allow || 0;
          pendingStatsDelta.continue += delta.continue || 0;
          flushPendingStatsDelta();
          return;
        }
        chrome.storage.local.set({ [D.STATS_KEY]: Object.assign({}, stats) });
      } catch (_) {
        teardownStaleContext();
      }
    };

    function sendToBackground(msg) {
      if (!isContextAlive()) return;
      if (bgPort) {
        try {
          bgPort.postMessage(msg);
          return;
        } catch (_) {
          bgPort = null;
        }
      }
      if (typeof chrome !== 'undefined' && chrome.runtime && typeof chrome.runtime.sendMessage === 'function') {
        try {
          const res = chrome.runtime.sendMessage(msg, () => {
            void (chrome.runtime && chrome.runtime.lastError);
          });
          if (res && typeof res.catch === 'function') res.catch(() => {});
        } catch (_) {
          isContextAlive();
        }
      }
    }

    const engine = new GmahEngine({
      doc: document,
      win: window,
      ignoreStaleInitialContinue: true,
      onSettingsSave: saveSettings,
      onStatsSave: saveStats,
      onStallAlert: (payload) => {
        sendToBackground(Object.assign({ type: 'GMAH_STALL_ALERT' }, payload || {}));
      },
      onStallResolved: () => {
        sendToBackground({ type: 'GMAH_STALL_CLEAR' });
        sendToBackground({ type: 'GMAH_CLEAR_ALL_STALL_NOTIFICATIONS' });
      },
      onStateChange: (state) => {
        if (hud && !contextInvalidated) hud.update(state);
      }
    });

    function canRunScanInCurrentVisibility() {
      if (!settingsReady) return false;
      if (engine.settings.backgroundMode) return true;
      if (document.hidden) return false;
      if (typeof document.hasFocus === 'function' && !document.hasFocus()) return false;
      return true;
    }

    if (hudApi && typeof hudApi.createHud === 'function') {
      hud = hudApi.createHud({
        onToggleMinimize: () => {
          if (!isContextAlive()) return;
          engine.updateSettings({ hudMinimized: !engine.settings.hudMinimized }, true);
        },
        onToggleTheme: () => {
          if (!isContextAlive()) return;
          const nextTheme = engine.settings.theme === 'light' ? 'dark' : 'light';
          engine.updateSettings({ theme: nextTheme }, true);
          engine.addLog(
            nextTheme === 'light'
              ? `☀️ ${D.t(engine.settings.language, 'toastThemeLight')}`
              : `🌙 ${D.t(engine.settings.language, 'toastThemeDark')}`
          );
          engine.emitState();
        },
        onCycleLanguage: () => {
          if (!isContextAlive()) return;
          const order = D.SUPPORTED_LANGUAGES || ['zh-CN', 'zh-TW', 'en', 'ja'];
          const cur = D.resolveLanguage(engine.settings.language);
          const nextLang = order[(order.indexOf(cur) + 1) % order.length];
          engine.updateSettings({ language: nextLang }, true);
          engine.addLog(`🌐 ${D.t(nextLang, 'toastLangChanged')} (${D.t(nextLang, 'langLabel')})`);
          engine.emitState();
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
        onToggleNotification: () => {
          if (!isContextAlive()) return;
          const nextVal = !engine.settings.stallAlertEnabled;
          engine.updateSettings({ stallAlertEnabled: nextVal }, true);
          if (!nextVal) {
            sendToBackground({ type: 'GMAH_STALL_CLEAR' });
            sendToBackground({ type: 'GMAH_CLEAR_ALL_STALL_NOTIFICATIONS' });
          }
          engine.addLog(nextVal ? '🔔 桌面通知提醒已开启' : '🔕 桌面通知提醒已关闭');
          engine.emitState();
        },
        onPositionChange: (pos) => {
          if (!isContextAlive()) return;
          try {
            if (hasChromeStorage) {
              chrome.storage.local.set({ gmah_hud_position: pos });
            }
          } catch (_) {}
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
          const migratedRes = D.migrateStoredSettings(res && res[D.STORAGE_KEY]);
          engine.settings = migratedRes.settings;
          engine.refreshLocalizedTexts();
          if (migratedRes.migrated) {
            saveSettings(engine.settings);
          }
          if (res && res[D.STATS_KEY]) {
            engine.stats = D.normalizeStats(res[D.STATS_KEY]);
          }
          settingsReady = true;
          engine.markExistingContinueCandidatesSeen();
          engine.addLog('🚀 Gemini MCP Auto Helper v0.3 已就绪');
          engine.emitState();
        });

        chrome.storage.onChanged.addListener((changes, area) => {
          if (!isContextAlive() || area !== 'local') return;
          if (changes[D.STORAGE_KEY] && changes[D.STORAGE_KEY].newValue) {
            const oldAlert = engine.settings ? engine.settings.stallAlertEnabled : true;
            engine.settings = D.mergeSettings(changes[D.STORAGE_KEY].newValue);
            engine.refreshLocalizedTexts();
            if (!engine.settings.enabled || !engine.settings.stallAlertEnabled) {
              engine.resetStallMonitor(true);
              if (oldAlert && !engine.settings.stallAlertEnabled) {
                sendToBackground({ type: 'GMAH_CLEAR_ALL_STALL_NOTIFICATIONS' });
              }
            }
          }
          if (changes.gmah_hud_position && hud) {
            if (changes.gmah_hud_position.newValue && typeof hud.setPosition === 'function') {
              hud.setPosition(changes.gmah_hud_position.newValue);
            } else if (!changes.gmah_hud_position.newValue && typeof hud.resetPosition === 'function') {
              const curPos = hud.getPosition ? hud.getPosition() : null;
              if (curPos && (curPos.left !== null || curPos.top !== null)) {
                hud.resetPosition();
              }
            }
          }
          if (changes[D.STATS_KEY] && changes[D.STATS_KEY].newValue) {
            engine.stats = D.normalizeStats(changes[D.STATS_KEY].newValue);
          }
          if (engine.reconcileBreakerWithSettings()) {
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
        const path = typeof ev.composedPath === 'function' ? ev.composedPath() : null;
        const t = (path && path.length > 0 ? path[0] : null) || ev.target;
        if (
          t &&
          t.nodeType === 1 &&
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
      let btn = null;
      if (typeof ev.composedPath === 'function') {
        const path = ev.composedPath();
        for (let i = 0; i < path.length; i++) {
          const node = path[i];
          if (!node || node.nodeType !== 1) continue;
          const tag = (node.tagName || '').toUpperCase();
          const role = (node.getAttribute && node.getAttribute('role') || '').toLowerCase();
          if (tag === 'BUTTON' || role === 'button') {
            btn = node;
            break;
          }
        }
      }
      if (!btn) {
        btn = ev.target && ev.target.closest ? ev.target.closest('button, [role="button"]') : null;
      }
      if (!btn || isIgnoredAncestor(btn)) return;
      const lbl = D.normalizeText(getElementLabel(btn));
      const testId = (btn.getAttribute && btn.getAttribute('data-test-id') || '').toLowerCase();
      const cls = typeof btn.className === 'string' ? btn.className : '';
      // Never mistake the "Stop generating" toggle (e.g. `.send-button.stop`) for sending a new prompt
      if (
        /\bstop\b/i.test(cls) ||
        testId.includes('stop') ||
        lbl.includes('stop') ||
        lbl.includes('停止') ||
        lbl.includes('取消生成')
      ) {
        return;
      }
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
        lbl === '送信' ||
        lbl === 'メッセージを送信' ||
        testId.includes('send') ||
        /\bsend-button\b/i.test(cls)
      ) {
        engine.onUserManualPrompt();
      }
    }

    function runScanAndSchedule() {
      if (!isContextAlive() || !canRunScanInCurrentVisibility()) return null;
      const res = engine.scanOnce();
      if (res && engine.settings.backgroundMode && isBackgroundOrUnfocused(document)) {
        const nextDelay =
          typeof res.retryInMs === 'number' && res.retryInMs > 0
            ? res.retryInMs + 100
            : typeof res.pendingRetryInMs === 'number' && res.pendingRetryInMs > 0
              ? res.pendingRetryInMs + 120
              : 0;
        if (nextDelay > 0) {
          sendToBackground({
            type: 'GMAH_SCHEDULE_TICK',
            delayMs: nextDelay,
            reason: res.reason || res.action || 'bg_followup'
          });
        }
      }
      return res;
    }

    function handleVisibilityChange() {
      if (!isContextAlive()) return;
      if (!bgPort) {
        connectBackgroundPort();
      }
      if (document.hidden && engine.settings.backgroundMode) {
        sendToBackground({ type: 'GMAH_TAB_KEEPALIVE' });
        sendToBackground({
          type: 'GMAH_SCHEDULE_TICK',
          delayMs: 500,
          reason: 'visibility_hidden'
        });
      }
      if (canRunScanInCurrentVisibility()) {
        runScanAndSchedule();
      }
    }

    function handleWindowBlur() {
      if (!isContextAlive()) return;
      if (engine.settings.backgroundMode) {
        if (!bgPort) connectBackgroundPort();
        sendToBackground({ type: 'GMAH_TAB_KEEPALIVE' });
        sendToBackground({
          type: 'GMAH_SCHEDULE_TICK',
          delayMs: 600,
          reason: 'window_blur'
        });
      }
    }

    function handleWindowFocus() {
      if (!isContextAlive()) return;
      if (!bgPort) connectBackgroundPort();
      if (canRunScanInCurrentVisibility()) {
        runScanAndSchedule();
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
        window.removeEventListener('blur', handleWindowBlur);
        window.removeEventListener('focus', handleWindowFocus);
      } catch (_) {}
      try {
        delete window.__GMAH_BOOTSTRAPPED__;
      } catch (_) {
        window.__GMAH_BOOTSTRAPPED__ = false;
      }
    }

    document.addEventListener('keydown', handleKeydown, true);
    document.addEventListener('click', handleClick, true);

    // Observe DOM mutations outside HUD (including open ShadowRoots of Material Web Components).
    // When tab is hidden/minimized or unfocused and backgroundMode is on, use microtask scheduling
    // PLUS Service Worker delayed ticks so Chrome's background timer throttling can never stall clicks!
    let lastMicrotaskScanAt = 0;
    let microtaskQueued = false;
    const observedShadowRoots = typeof WeakSet === 'function' ? new WeakSet() : null;

    function observeShadowTree(rootNode) {
      if (!observer || !rootNode) return;
      const attach = (sr) => {
        if (!sr || (observedShadowRoots && observedShadowRoots.has(sr))) return;
        if (observedShadowRoots) observedShadowRoots.add(sr);
        try {
          observer.observe(sr, {
            childList: true,
            subtree: true,
            characterData: true
          });
        } catch (_) {}
      };
      if (rootNode.shadowRoot) {
        attach(rootNode.shadowRoot);
        observeShadowTree(rootNode.shadowRoot);
      }
      if (typeof rootNode.querySelectorAll === 'function') {
        const descendants = rootNode.querySelectorAll('*');
        for (let i = 0; i < descendants.length; i++) {
          const d = descendants[i];
          if (d && d.shadowRoot && !isIgnoredAncestor(d)) {
            attach(d.shadowRoot);
            observeShadowTree(d.shadowRoot);
          }
        }
      }
    }

    function scheduleScan(delay) {
      if (!isContextAlive() || !settingsReady) return;
      if (isBackgroundOrUnfocused(document) && engine.settings.backgroundMode) {
        if (!microtaskQueued) {
          microtaskQueued = true;
          Promise.resolve().then(() => {
            microtaskQueued = false;
            if (!isContextAlive() || !canRunScanInCurrentVisibility()) return;
            const now = Date.now();
            if (now - lastMicrotaskScanAt >= 200) {
              lastMicrotaskScanAt = now;
              runScanAndSchedule();
            } else {
              // Fast 250ms SW follow-up so rapid MCP Allow dialogs aren't delayed while Continue still settles cleanly
              sendToBackground({
                type: 'GMAH_SCHEDULE_TICK',
                delayMs: 250,
                reason: 'bg_mutation_burst'
              });
            }
          });
        }
        return;
      }
      if (scanTimer) return;
      scanTimer = setTimeout(() => {
        scanTimer = null;
        if (!isContextAlive() || !canRunScanInCurrentVisibility()) return;
        runScanAndSchedule();
      }, delay);
    }

    if (typeof MutationObserver === 'function' && document.body) {
      observer = new MutationObserver((mutations) => {
        if (!isContextAlive()) return;
        let relevant = false;
        for (const m of mutations) {
          if (m.addedNodes && m.addedNodes.length > 0) {
            for (let i = 0; i < m.addedNodes.length; i++) {
              const added = m.addedNodes[i];
              if (added && added.nodeType === 1 && !isIgnoredAncestor(added)) {
                observeShadowTree(added);
              }
            }
          }
          if (m.target && !isIgnoredAncestor(m.target) && !isNoisyMutationTarget(m.target)) {
            relevant = true;
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
      observeShadowTree(document.body);
    }

    // Background Service Worker Port (keeps scanning alive at 1.5s intervals + seamless 4-min rotation)
    let quickReconnectCount = 0;
    let rotatingPort = false;

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
        const port = chrome.runtime.connect({ name: 'gmah-tab' });
        bgPort = port;
        port.onMessage.addListener((msg) => {
          if (!isContextAlive()) return;
          quickReconnectCount = 0;
          if (!msg || typeof msg !== 'object') return;
          if (msg.type === 'GMAH_ROTATE_PORT') {
            // Proactively replace the long-lived port before Chrome's 5-min MV3 forced disconnect
            rotatingPort = true;
            bgPort = null;
            try { port.disconnect(); } catch (_) {}
            rotatingPort = false;
            connectBackgroundPort();
            return;
          }
          if (msg.type === 'GMAH_BG_TICK') {
            if (canRunScanInCurrentVisibility()) {
              runScanAndSchedule();
            }
            try {
              if (bgPort === port) port.postMessage({ type: 'GMAH_TAB_PONG', ts: Date.now() });
            } catch (_) {
              // Ignore transient port close
            }
          }
        });
        port.onDisconnect.addListener(() => {
          if (bgPort === port) {
            bgPort = null;
          }
          if (rotatingPort || !isContextAlive()) return;
          if (!chrome.runtime || !chrome.runtime.id) {
            teardownStaleContext();
            return;
          }
          if (isBackgroundOrUnfocused(document) && engine.settings.backgroundMode && quickReconnectCount < 2) {
            quickReconnectCount += 1;
            // Wake Service Worker via sendMessage before reconnecting Port so restarts don't burn retries
            if (typeof chrome.runtime.sendMessage === 'function') {
              try {
                chrome.runtime.sendMessage({ type: 'GMAH_TAB_KEEPALIVE' }, () => {
                  void (chrome.runtime && chrome.runtime.lastError);
                  if (isContextAlive() && !bgPort) connectBackgroundPort();
                });
                return;
              } catch (_) {}
            }
            Promise.resolve().then(() => connectBackgroundPort());
            return;
          }
          if (!reconnectTimer) {
            reconnectTimer = setTimeout(() => {
              reconnectTimer = null;
              connectBackgroundPort();
            }, 2500);
          }
        });
        port.postMessage({
          type: 'GMAH_TAB_HELLO',
          url: window.location.href,
          stallAlertActive: Boolean(engine.stallAlertActive)
        });
      } catch (_) {
        bgPort = null;
        isContextAlive();
      }
    }

    connectBackgroundPort();
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);

    // Periodic foreground heartbeat (Service Worker Port + Alarms take over when tab is hidden)
    heartbeatInterval = setInterval(() => {
      if (!isContextAlive()) return;
      if (!bgPort && engine.settings.enabled && engine.settings.backgroundMode) {
        connectBackgroundPort();
      }
      if (hud && engine.settings.showHud && !document.getElementById('gmah-hud')) {
        hud.mount();
      }
      if (canRunScanInCurrentVisibility()) {
        runScanAndSchedule();
      }
    }, 900);

    // Runtime message listener for popup quick actions & background alarm wakes
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
        if (!isContextAlive() || !msg || typeof msg !== 'object') return;
        if (msg.type === 'GMAH_BG_TICK') {
          if (!bgPort) connectBackgroundPort();
          if (canRunScanInCurrentVisibility()) {
            const res = runScanAndSchedule();
            sendResponse({ ok: true, result: res });
          } else {
            sendResponse({ ok: true, skipped: 'background_disabled' });
          }
        } else if (msg.type === 'GMAH_APPLY_SETTINGS' && msg.settings) {
          engine.updateSettings(msg.settings, false);
          if (engine.settings.enabled && engine.settings.backgroundMode && !bgPort) {
            connectBackgroundPort();
          }
          sendResponse({ ok: true, state: engine.getState() });
        } else if (msg.type === 'GMAH_GET_STATE') {
          if (engine.settings.enabled && engine.settings.backgroundMode && !bgPort) {
            connectBackgroundPort();
          }
          sendResponse({ ok: true, state: engine.getState() });
        } else if (msg.type === 'GMAH_RESET_BREAKER') {
          engine.clearBreaker();
          sendResponse({ ok: true, state: engine.getState() });
        } else if (msg.type === 'GMAH_EMERGENCY_STOP') {
          engine.emergencyStop();
          sendResponse({ ok: true, state: engine.getState() });
        } else if (msg.type === 'GMAH_RESET_HUD_POS') {
          if (hud && typeof hud.resetPosition === 'function') {
            hud.resetPosition();
          }
          sendResponse({ ok: true, state: engine.getState() });
        }
      });
    }
  }

  bootstrapBrowser();
})(typeof globalThis !== 'undefined' ? globalThis : window);
