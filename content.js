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
    'button[aria-label*="终止"]',
    'button[aria-label*="終止"]',
    'button[aria-label*="中止"]',
    'button[aria-label*="Stop generating" i]',
    'button[aria-label*="Stop response" i]',
    '[data-test-id*="stop-button"]',
    '[data-test-id*="stop_button"]',
    'button.stop-button',
    'button.stop',
    '.send-button.stop',
    '[role="button"][aria-label*="Stop" i]',
    '[role="button"][aria-label*="停止"]'
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
    '.tool-execution',
    '.mcp-status',
    '.mcp-tool-call',
    '.connecting',
    '.loading-text',
    '.thinking-indicator',
    'tool-call',
    'mcp-tool-call',
    'mat-expansion-panel-header',
    '[data-test-id*="tool"]',
    '[data-test-id*="mcp"]',
    '[data-test-id*="connect"]',
    '[data-test-id*="progress"]',
    '[data-test-id*="loading"]'
  ];

  const CONNECTING_KEYWORDS = [
    'connecting',
    'connecting to',
    'reconnecting',
    'calling tool',
    'running tool',
    'executing tool',
    'waiting for tool',
    'waiting for mcp',
    'loading mcp',
    '正在连接',
    '正在连接到',
    '重新连接',
    '连接中',
    '連接中',
    '正在連接',
    '正在連線',
    '連線中',
    '正在调用',
    '正在調用',
    '正在运行工具',
    '正在执行工具',
    '等待响应',
    '等待工具',
    '接続中',
    '接続しています',
    'ツールを実行',
    'ツールを呼び出し',
    '応答を待っています'
  ];

  const PROMPT_INPUT_SELECTORS = [
    '.ql-editor[contenteditable="true"]',
    '[contenteditable="true"][role="textbox"]',
    '[contenteditable="true"][aria-label*="prompt" i]',
    '[contenteditable="true"][aria-label*="Gemini" i]',
    '[contenteditable="true"][aria-label*="输入"]',
    '[contenteditable="true"][aria-label*="輸入"]',
    '[contenteditable="true"][aria-label*="入力"]',
    '[contenteditable="true"][aria-label*="消息"]',
    '[contenteditable="true"][aria-label*="訊息"]',
    'textarea[aria-label*="prompt" i]',
    'textarea[aria-label*="Gemini" i]',
    'textarea[aria-label*="输入"]',
    'textarea[aria-label*="輸入"]',
    'textarea[aria-label*="入力"]',
    'textarea.prompt-textarea',
    'textarea'
  ];

  const SEND_BUTTON_SELECTORS = [
    'button.send-button',
    'button[aria-label="Send message" i]',
    'button[aria-label="Send prompt" i]',
    'button[aria-label="Send" i]',
    'button[aria-label*="Send message" i]',
    'button[aria-label*="Send prompt" i]',
    'button[aria-label="Submit" i]',
    'button[aria-label="提交"]',
    'button[aria-label="发送"]',
    'button[aria-label="发送消息"]',
    'button[aria-label="发送提示"]',
    'button[aria-label*="发送"]',
    'button[aria-label="傳送"]',
    'button[aria-label="傳送訊息"]',
    'button[aria-label*="傳送"]',
    'button[aria-label="送信"]',
    'button[aria-label*="送信"]',
    'button[data-test-id*="send-button"]',
    'button[data-test-id*="send_button"]',
    '[role="button"][aria-label*="Send" i]',
    '[role="button"][aria-label*="发送"]',
    '[role="button"][aria-label*="傳送"]',
    '[role="button"][aria-label*="送信"]',
    '.send-button'
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
  const TOOL_OR_THINKING_SELECTORS = [
    '.tool-call',
    '.tool-execution',
    '.mcp-status',
    '.mcp-tool-call',
    'tool-call',
    'mcp-tool-call',
    '.thinking-indicator',
    '[data-test-id*="tool-call"]',
    '[data-test-id*="tool_call"]',
    '[data-test-id*="thinking"]'
  ];
  const TOOL_OR_THINKING_COMBINED_SELECTOR = TOOL_OR_THINKING_SELECTORS.join(',');

  function hasActiveToolOrThinking(doc, win, searchRoots) {
    if (!doc) return false;
    const roots = Array.isArray(searchRoots) ? searchRoots : collectSearchRoots(doc.body || doc, []);
    const nodes = queryAllFromRoots(roots, TOOL_OR_THINKING_COMBINED_SELECTOR, []);
    for (const n of nodes) {
      if (!n || isIgnoredAncestor(n)) continue;
      if (isElementVisible(n, win, doc, { relaxHiddenLayout: true })) return true;
    }
    return false;
  }

  function formatTime(date) {
    const d = date instanceof Date ? date : new Date();
    return [d.getHours(), d.getMinutes(), d.getSeconds()]
      .map((n) => String(n).padStart(2, '0'))
      .join(':');
  }

  function isIgnoredAncestor(el) {
    let cur = el;
    let depth = 0;
    const visited = new Set();
    if (cur && cur.nodeType !== 1) {
      try {
        cur = cur.parentElement || cur.parentNode || null;
        if (cur && cur.nodeType === 11 && cur.host) cur = cur.host;
      } catch (_) {
        cur = null;
      }
    }
    while (cur && cur.nodeType === 1 && depth++ < 64) {
      if (visited.has(cur)) break;
      visited.add(cur);
      try {
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
      } catch (_) {}
      try {
        cur = cur.parentElement || (cur.getRootNode && cur.getRootNode().host) || null;
      } catch (_) {
        cur = null;
      }
    }
    return false;
  }

  function hasAncestorRoleOrTag(el, roles, tags) {
    let cur = el;
    let depth = 0;
    const visited = new Set();
    while (cur && cur.nodeType === 1 && depth++ < 64) {
      if (visited.has(cur)) break;
      visited.add(cur);
      try {
        const tag = (cur.tagName || '').toUpperCase();
        if (tags && tags.indexOf(tag) >= 0) return true;
        if (cur.getAttribute) {
          const role = (cur.getAttribute('role') || '').toLowerCase();
          if (roles && roles.indexOf(role) >= 0) return true;
        }
      } catch (_) {}
      try {
        cur = cur.parentElement || (cur.getRootNode && cur.getRootNode().host) || null;
      } catch (_) {
        cur = null;
      }
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
    try {
      if (el.disabled === true || el.hidden === true) return false;
      if (el.getAttribute) {
        if (el.getAttribute('aria-disabled') === 'true') return false;
        if (el.getAttribute('aria-hidden') === 'true') return false;
      }
    } catch (_) {}

    const w = win || (typeof window !== 'undefined' ? window : null);
    const d = doc || (el.ownerDocument || (typeof document !== 'undefined' ? document : null));

    const isPageHidden = Boolean(d && d.hidden === true);
    const isBgOrUnfocused = Boolean(d && isBackgroundOrUnfocused(d));
    let isWindowMinimized = false;
    try {
      isWindowMinimized = Boolean(
        isPageHidden &&
        (
          !w ||
          (w.innerWidth === 0 && w.innerHeight === 0) ||
          (w.outerWidth === 0 && w.outerHeight === 0) ||
          (typeof w.screenX === 'number' && w.screenX <= -32000) ||
          (typeof w.screenY === 'number' && w.screenY <= -32000) ||
          (typeof w.screenLeft === 'number' && w.screenLeft <= -32000) ||
          (typeof w.screenTop === 'number' && w.screenTop <= -32000) ||
          w.minimized === true ||
          w.isMinimized === true ||
          w.windowState === 'minimized' ||
          (d && (d.minimized === true || d.isMinimized === true || d.windowState === 'minimized'))
        )
      );
    } catch (_) {}
    const relaxHiddenLayout = Boolean(opts && opts.relaxHiddenLayout && isBgOrUnfocused);

    let selfDisplay = '';
    let explicitPointerEvents = null;
    let cur = el;
    let depth = 0;
    const visited = new Set();
    while (cur && cur.nodeType === 1 && depth++ < 64) {
      if (visited.has(cur)) break;
      visited.add(cur);
      try {
        if (cur.hidden === true) return false;
        if (cur.getAttribute && cur.getAttribute('aria-hidden') === 'true') return false;
        const curCls =
          typeof cur.className === 'string'
            ? cur.className
            : (cur.getAttribute && cur.getAttribute('class')) || '';
        if (/\b(ng-hide|cdk-visually-hidden|visually-hidden|display-none|d-none|invisible)\b/i.test(curCls)) {
          return false;
        }
        if (w && typeof w.getComputedStyle === 'function') {
          const style = w.getComputedStyle(cur);
          if (style) {
            if (cur === el) {
              selfDisplay = style.display || '';
              if (style.pointerEvents) explicitPointerEvents = style.pointerEvents;
            }
            if (style.display === 'none' || style.visibility === 'hidden') return false;
            const op = parseFloat(style.opacity);
            if (!relaxHiddenLayout && style.opacity !== '' && Number.isFinite(op) && op === 0) return false;
            if (cur === el) {
              if (
                (!relaxHiddenLayout && style.width === '0px' && style.height === '0px') ||
                (typeof style.transform === 'string' && /scale\(\s*0(?:\s*,\s*0)?\s*\)/i.test(style.transform))
              ) {
                return false;
              }
            }
            if (style.pointerEvents === 'none' && explicitPointerEvents !== 'auto') return false;
          }
        }
      } catch (_) {
        // Ignore computed style errors in exotic nodes
      }
      try {
        cur = cur.parentElement || (cur.getRootNode && cur.getRootNode().host) || null;
      } catch (_) {
        cur = null;
      }
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

  function extractVisibleLabelText(node, isRoot, depth, seen) {
    if (!node) return '';
    const d = typeof depth === 'number' ? depth : 0;
    if (d > 32) return '';
    const visited = seen || new Set();
    if (visited.has(node)) return '';
    visited.add(node);

    try {
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
              slotOut = appendLabelChunk(slotOut, extractVisibleLabelText(item, false, d + 1, visited));
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
            out = appendLabelChunk(out, extractVisibleLabelText(child, false, d + 1, visited));
          }
        }
        const cleaned = out.replace(/\s+/g, ' ').trim();
        if (cleaned) return cleaned;
        return node.shadowRoot ? extractVisibleLabelText(node.shadowRoot, false, d + 1, visited) : '';
      }

      if (node.children && node.children.length > 0) {
        let out = typeof node._ownText === 'string' ? node._ownText : '';
        for (let i = 0; i < node.children.length; i++) {
          const child = node.children[i];
          if (!child || isIconOrDecorativeNode(child)) continue;
          out = appendLabelChunk(out, extractVisibleLabelText(child, false, d + 1, visited));
        }
        const cleaned = out.replace(/\s+/g, ' ').trim();
        if (cleaned) return cleaned;
        return node.shadowRoot ? extractVisibleLabelText(node.shadowRoot, false, d + 1, visited) : '';
      }

      const direct = (node.innerText || node.textContent || '').replace(/\s+/g, ' ').trim();
      if (direct) return direct;

      if (node.shadowRoot) {
        return extractVisibleLabelText(node.shadowRoot, false, d + 1, visited);
      }
    } catch (_) {}
    return '';
  }

  function getElementLabel(el) {
    if (!el) return '';
    try {
      const text = extractVisibleLabelText(el, true);
      if (text) return text;
      if (el.getAttribute) {
        return (el.getAttribute('aria-label') || el.getAttribute('title') || '').trim();
      }
    } catch (_) {}
    return '';
  }

  /**
   * Collects the root node plus all nested open ShadowRoots once per scan pass.
   */
  function collectSearchRoots(rootNode, out, depth, seen) {
    const roots = out || [];
    if (!rootNode) return roots;
    const visited = seen || new Set();
    if (visited.has(rootNode)) return roots;
    visited.add(rootNode);
    roots.push(rootNode);

    const d = typeof depth === 'number' ? depth : 0;
    if (d >= 32 || roots.length >= 256) return roots;

    if (typeof rootNode.querySelectorAll === 'function') {
      try {
        const allNodes = rootNode.querySelectorAll('*');
        for (let i = 0; i < allNodes.length; i++) {
          const node = allNodes[i];
          if (node && node.shadowRoot && !visited.has(node.shadowRoot)) {
            collectSearchRoots(node.shadowRoot, roots, d + 1, visited);
          }
        }
      } catch (_) {}
    }
    return roots;
  }

  function queryAllFromRoots(roots, selector, out) {
    const results = out || [];
    if (!Array.isArray(roots)) return results;
    for (let r = 0; r < roots.length; r++) {
      const rootNode = roots[r];
      if (!rootNode || typeof rootNode.querySelectorAll !== 'function') continue;
      try {
        const matched = rootNode.querySelectorAll(selector);
        for (let i = 0; i < matched.length; i++) {
          results.push(matched[i]);
        }
      } catch (_) {}
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
      let p = null;
      try {
        p = item.el.parentElement || (item.el.getRootNode && item.el.getRootNode().host) || null;
      } catch (_) {}
      let depth = 0;
      const visited = new Set();
      while (p && depth++ < 64) {
        if (visited.has(p)) break;
        visited.add(p);
        const parentItem = byEl.get(p);
        if (parentItem && D.normalizeText(parentItem.label) === normLabel) {
          if (isNativeButton(item.el) && !isNativeButton(parentItem.el)) {
            dropSet.add(parentItem.el);
          } else {
            dropSet.add(item.el);
          }
          break;
        }
        try {
          p = p.parentElement || (p.getRootNode && p.getRootNode().host) || null;
        } catch (_) {
          p = null;
        }
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
    let container = null;
    try {
      container =
        el.parentElement ||
        el.parentNode ||
        (el.getRootNode && el.getRootNode() !== el ? el.getRootNode() : null);
    } catch (_) {}
    const visited = new Set();
    for (let depth = 0; depth < 5 && container; depth++) {
      if (visited.has(container)) break;
      visited.add(container);
      try {
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
      } catch (_) {}
      try {
        container =
          container.parentElement ||
          (container.nodeType === 11 ? container.host : container.parentNode) ||
          null;
      } catch (_) {
        container = null;
      }
    }
    return false;
  }

  function hasSiblingApprovalContext(el, settings) {
    const denyAndAlways = []
      .concat(settings.denyBlacklistKeywords || [])
      .concat(APPROVAL_EXTRA_SIBLING_KEYWORDS)
      .concat(settings.alwaysAllowKeywords || [])
      .concat(settings.customAlwaysAllowKeywords || []);

    let container = null;
    try {
      container =
        el.parentElement ||
        el.parentNode ||
        (el.getRootNode && el.getRootNode() !== el ? el.getRootNode() : null);
    } catch (_) {}
    const visited = new Set();
    for (let depth = 0; depth < 5 && container; depth++) {
      if (visited.has(container)) break;
      visited.add(container);
      try {
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
      } catch (_) {}
      try {
        container =
          container.parentElement ||
          (container.nodeType === 11 ? container.host : container.parentNode) ||
          null;
      } catch (_) {
        container = null;
      }
    }
    return false;
  }

  function isFollowUpChipElement(el, rawLabel) {
    if (typeof rawLabel === 'string' && /^\s*[↪↳↵↩]/.test(rawLabel)) {
      return true;
    }
    let cur = el;
    let depth = 0;
    const visited = new Set();
    while (cur && cur.nodeType === 1 && depth++ < 4) {
      if (visited.has(cur)) break;
      visited.add(cur);
      try {
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
      } catch (_) {}
      try {
        cur = cur.parentElement || (cur.getRootNode && cur.getRootNode().host) || null;
      } catch (_) {
        cur = null;
      }
    }
    return false;
  }

  function hasNegativeSiblingInGroup(el) {
    let container = null;
    try {
      container =
        el.parentElement ||
        el.parentNode ||
        (el.getRootNode && el.getRootNode() !== el ? el.getRootNode() : null);
    } catch (_) {}
    const visited = new Set();
    for (let depth = 0; depth < 2 && container; depth++) {
      if (visited.has(container)) break;
      visited.add(container);
      try {
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
      } catch (_) {}
      try {
        container =
          container.parentElement ||
          (container.nodeType === 11 ? container.host : container.parentNode) ||
          null;
      } catch (_) {
        container = null;
      }
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
    try {
      if (typeof ancestor.contains === 'function' && ancestor.contains(node)) {
        return true;
      }
    } catch (_) {}
    let cur = node;
    let depth = 0;
    const visited = new Set();
    while (cur && depth++ < 64) {
      if (cur === ancestor) return true;
      if (visited.has(cur)) break;
      visited.add(cur);
      try {
        cur = cur.parentNode || (cur.nodeType === 11 ? cur.host : null) || null;
      } catch (_) {
        break;
      }
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
  const BG_LATE_RETRY_DELAY_MS = 12000;
  const MAX_BG_CLICK_ATTEMPTS = 2;
  const MAX_BG_HIDDEN_ATTEMPTS = 4;

  function isBackgroundOrUnfocused(doc, win) {
    if (!doc) return false;
    try {
      if (doc.hidden === true || doc.visibilityState === 'hidden' || doc.visibilityState === 'prerender') {
        return true;
      }
      if (doc.minimized === true || doc.isMinimized === true || doc.windowState === 'minimized') {
        return true;
      }
    } catch (_) {}
    const w = win || (doc.defaultView) || (typeof window !== 'undefined' ? window : null);
    if (w) {
      try {
        if (
          w.minimized === true ||
          w.isMinimized === true ||
          w.windowState === 'minimized' ||
          (w.innerWidth === 0 && w.innerHeight === 0) ||
          (w.outerWidth === 0 && w.outerHeight === 0) ||
          (typeof w.screenX === 'number' && w.screenX <= -32000) ||
          (typeof w.screenY === 'number' && w.screenY <= -32000) ||
          (typeof w.screenLeft === 'number' && w.screenLeft <= -32000) ||
          (typeof w.screenTop === 'number' && w.screenTop <= -32000)
        ) {
          return true;
        }
      } catch (_) {}
    }
    if (typeof doc.hasFocus === 'function') {
      try {
        return !doc.hasFocus();
      } catch (_) {}
    }
    return false;
  }

  function isNoisyMutationTarget(node) {
    let cur = node;
    let depth = 0;
    const visited = new Set();
    if (cur && cur.nodeType !== 1) {
      try {
        cur = cur.parentElement || cur.parentNode || null;
        if (cur && cur.nodeType === 11 && cur.host) cur = cur.host;
      } catch (_) {
        cur = null;
      }
    }
    while (cur && cur.nodeType === 1 && depth++ < 4) {
      if (visited.has(cur)) break;
      visited.add(cur);
      try {
        if (isIconOrDecorativeNode(cur)) return true;
        const tag = (cur.tagName || '').toUpperCase();
        if (tag === 'MAT-PROGRESS-SPINNER' || tag === 'MAT-PROGRESS-BAR') return true;
        const role = cur.getAttribute ? (cur.getAttribute('role') || '').toLowerCase() : '';
        if (role === 'tooltip' || role === 'progressbar' || role === 'status') return true;
        const cls =
          typeof cur.className === 'string'
            ? cur.className
            : (cur.getAttribute && cur.getAttribute('class')) || '';
        if (
          /\b(mat-ripple|mat-mdc-ripple-element|mat-ripple-element|cdk-overlay-backdrop|mdc-tooltip|mat-mdc-tooltip|streaming-indicator|loading-text)\b/i.test(
            cls
          )
        ) {
          return true;
        }
      } catch (_) {}
      try {
        cur = cur.parentElement || (cur.getRootNode && cur.getRootNode().host) || null;
      } catch (_) {
        cur = null;
      }
    }
    return false;
  }

  function resolveClickTarget(el, attempt) {
    const tryNum = typeof attempt === 'number' ? attempt : 2;
    if (!el || tryNum < 2) return el;
    try {
      // On retry, pierce custom Material Web Components (<md-filled-button>, etc.) or Shadow DOM
      if (el.shadowRoot && typeof el.shadowRoot.querySelector === 'function') {
        const inner = el.shadowRoot.querySelector('button, [role="button"]');
        if (inner && !inner.disabled) return inner;
      }
      // Also pierce Angular Material chips (<mat-chip>, <mat-chip-option>, <suggestion-chip>, etc.)
      // whose inner native <button> handles the actual click event
      const tag = (el.tagName || '').toUpperCase();
      const cls =
        typeof el.className === 'string'
          ? el.className
          : (el.getAttribute && el.getAttribute('class')) || '';
      const isChip =
        tag === 'MAT-CHIP' ||
        tag === 'MAT-CHIP-OPTION' ||
        tag === 'MAT-ACTION-CHIP' ||
        tag === 'SUGGESTION-CHIP' ||
        /\b(suggestion-chip|follow-up-chip|mat-mdc-chip|mdc-evolution-chip)\b/i.test(cls);

      if (isChip && typeof el.querySelector === 'function') {
        const inner = el.querySelector('button, [role="button"]');
        if (inner && !inner.disabled) {
          if (inner.shadowRoot && typeof inner.shadowRoot.querySelector === 'function') {
            const deep = inner.shadowRoot.querySelector('button, [role="button"]');
            if (deep && !deep.disabled) return deep;
          }
          return inner;
        }
      }
    } catch (_) {}
    return el;
  }

  function defaultClickElement(el, win, attempt, randomFn) {
    const w = win || (typeof window !== 'undefined' ? window : null);
    const tryNum = attempt || 1;
    const target = resolveClickTarget(el, tryNum);
    let coords = {};
    if (typeof target.getBoundingClientRect === 'function') {
      try {
        const rect = target.getBoundingClientRect();
        if (rect && Number.isFinite(rect.width) && Number.isFinite(rect.height) && rect.width > 0 && rect.height > 0) {
          // On initial click with human pacing randomFn, add slight natural variation within inner safe box (±22%);
          // on retry attempts (attempt >= 2), aim dead-center for maximum hit reliability.
          let offsetX = 0;
          let offsetY = 0;
          if (tryNum < 2 && typeof randomFn === 'function') {
            const r1 = Math.max(0, Math.min(1, Number(randomFn()) || 0));
            const r2 = Math.max(0, Math.min(1, Number(randomFn()) || 0));
            offsetX = (r1 - 0.5) * 0.44;
            offsetY = (r2 - 0.5) * 0.44;
          }
          const left = Number.isFinite(rect.left) ? rect.left : 0;
          const top = Number.isFinite(rect.top) ? rect.top : 0;
          coords = {
            clientX: Math.round(left + rect.width * (0.5 + offsetX)),
            clientY: Math.round(top + rect.height * (0.5 + offsetY))
          };
        }
      } catch (_) {}
    }

    const baseOpts = Object.assign(
      { bubbles: true, cancelable: true, composed: true, button: 0 },
      w && typeof w.addEventListener === 'function' ? { view: w } : {},
      coords
    );
    const enterOpts = Object.assign(
      { bubbles: false, cancelable: false, composed: true, buttons: 0, detail: 0 },
      w && typeof w.addEventListener === 'function' ? { view: w } : {},
      coords
    );
    const hoverOpts = Object.assign({ buttons: 0, detail: 0 }, baseOpts);
    const downOpts = Object.assign({ buttons: 1, detail: 1 }, baseOpts);
    const upOpts = Object.assign({ buttons: 0, detail: 1 }, baseOpts);

    // Safe non-scrolling focus on retry attempts helps background Angular/MWC components register interaction
    if (tryNum >= 2 && typeof target.focus === 'function') {
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
        target.dispatchEvent(new w.PointerEvent('pointerenter', Object.assign({ pointerId: 1, isPrimary: true }, enterOpts)));
        target.dispatchEvent(new w.PointerEvent('pointerover', Object.assign({ pointerId: 1, isPrimary: true }, hoverOpts)));
        target.dispatchEvent(new w.PointerEvent('pointermove', Object.assign({ pointerId: 1, isPrimary: true }, hoverOpts)));
      }
      if (w && typeof w.MouseEvent === 'function') {
        target.dispatchEvent(new w.MouseEvent('mouseenter', enterOpts));
        target.dispatchEvent(new w.MouseEvent('mouseover', hoverOpts));
      }
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
    // On late background thaw retries (attempt >= 3), also send Enter activation for focused Material buttons
    if (tryNum >= 3 && typeof target.dispatchEvent === 'function') {
      dispatchEnterKey(target, w);
    }
  }

  const STALL_STOP_SETTLE_MS = 800;
  const STALL_STOP_RETRY_MS = 2500;
  const STALL_STOP_GIVEUP_MS = 6000;
  const STALL_SEND_SETTLE_MS = 400;
  const STALL_SEND_FALLBACK_MS = 2000;

  function isInsideHudOrNonComposer(el) {
    let cur = el;
    let depth = 0;
    const visited = new Set();
    while (cur && cur.nodeType === 1 && depth++ < 64) {
      if (visited.has(cur)) break;
      visited.add(cur);
      try {
        if (cur.id === 'gmah-hud') return true;
        if (cur.getAttribute && cur.getAttribute('data-gmah-ignore') === 'true') return true;
        const tag = (cur.tagName || '').toUpperCase();
        if (
          tag === 'NAV' ||
          tag === 'ASIDE' ||
          tag === 'HEADER' ||
          tag === 'PRE' ||
          tag === 'CODE' ||
          tag === 'SCRIPT' ||
          tag === 'STYLE' ||
          tag === 'DIALOG' ||
          tag === 'MAT-DIALOG-CONTAINER'
        ) {
          return true;
        }
        if (cur.getAttribute) {
          const role = (cur.getAttribute('role') || '').toLowerCase();
          if (role === 'navigation' || role === 'menubar' || role === 'dialog' || role === 'alertdialog') {
            return true;
          }
          const testId = (cur.getAttribute('data-test-id') || '').toLowerCase();
          if (
            testId.includes('conversation-list') ||
            testId.includes('sidebar') ||
            testId.includes('sidenav') ||
            testId.includes('feedback') ||
            testId.includes('survey') ||
            testId.includes('search')
          ) {
            return true;
          }
        }
      } catch (_) {}
      try {
        cur = cur.parentElement || (cur.getRootNode && cur.getRootNode().host) || null;
      } catch (_) {
        cur = null;
      }
    }
    return false;
  }

  const STOP_ICON_SELECTOR =
    'mat-icon[fonticon="stop"],mat-icon[fonticon="stop_circle"],mat-icon[data-mat-icon-name="stop"],mat-icon[data-mat-icon-name="stop_circle"],.stop-icon';

  function isStopButtonElement(el) {
    if (!el || el.nodeType !== 1) return false;
    try {
      const cls =
        typeof el.className === 'string'
          ? el.className
          : (el.getAttribute && el.getAttribute('class')) || '';
      if (/\bstop(?:-button)?\b/i.test(cls)) return true;
      const testId = (el.getAttribute && el.getAttribute('data-test-id') || '').toLowerCase();
      if (testId.includes('stop')) return true;
      if (typeof el.querySelector === 'function') {
        try {
          if (el.querySelector(STOP_ICON_SELECTOR)) return true;
        } catch (_) {}
      }
      const aria = D.normalizeText((el.getAttribute && el.getAttribute('aria-label')) || '');
      const lbl = D.normalizeText(getElementLabel(el));
      const combined = `${aria} ${lbl}`;
      return (
        /\bstop\b/i.test(combined) ||
        combined.includes('停止') ||
        combined.includes('取消生成') ||
        combined.includes('终止') ||
        combined.includes('終止') ||
        combined.includes('中止')
      );
    } catch (_) {
      return false;
    }
  }

  function findClosestButtonAncestor(node) {
    let cur = node;
    let depth = 0;
    const visited = new Set();
    while (cur && cur.nodeType === 1 && depth++ < 64) {
      if (visited.has(cur)) break;
      visited.add(cur);
      try {
        const tag = (cur.tagName || '').toUpperCase();
        const role = cur.getAttribute ? (cur.getAttribute('role') || '').toLowerCase() : '';
        if (tag === 'BUTTON' || role === 'button') return cur;
      } catch (_) {}
      try {
        cur = cur.parentElement || (cur.getRootNode && cur.getRootNode().host) || null;
      } catch (_) {
        cur = null;
      }
    }
    return null;
  }

  function findStopButton(doc, win, searchRoots, strictOnly) {
    if (!doc) return null;
    const roots = Array.isArray(searchRoots) ? searchRoots : collectSearchRoots(doc.body || doc, []);
    const nodes = queryAllFromRoots(roots, STOP_BUTTON_COMBINED_SELECTOR, []);
    for (const n of nodes) {
      if (!n || isIgnoredAncestor(n)) continue;
      if (isElementVisible(n, win, doc)) return n;
    }
    const iconNodes = queryAllFromRoots(roots, STOP_ICON_SELECTOR, []);
    for (const icon of iconNodes) {
      if (!icon || isIgnoredAncestor(icon)) continue;
      const btn = findClosestButtonAncestor(icon);
      if (btn && !isIgnoredAncestor(btn) && isElementVisible(btn, win, doc)) return btn;
    }
    if (!strictOnly && isBackgroundOrUnfocused(doc)) {
      for (const n of nodes) {
        if (!n || isIgnoredAncestor(n)) continue;
        if (isElementVisible(n, win, doc, { relaxHiddenLayout: true })) return n;
      }
      for (const icon of iconNodes) {
        if (!icon || isIgnoredAncestor(icon)) continue;
        const btn = findClosestButtonAncestor(icon);
        if (btn && !isIgnoredAncestor(btn) && isElementVisible(btn, win, doc, { relaxHiddenLayout: true })) {
          return btn;
        }
      }
    }
    return null;
  }

  function isInsideRichTextareaOrInputArea(el) {
    let cur = el;
    let depth = 0;
    const visited = new Set();
    while (cur && cur.nodeType === 1 && depth++ < 16) {
      if (visited.has(cur)) break;
      visited.add(cur);
      try {
        const tag = (cur.tagName || '').toUpperCase();
        if (tag === 'RICH-TEXTAREA') return true;
        const cls =
          typeof cur.className === 'string'
            ? cur.className
            : (cur.getAttribute && cur.getAttribute('class')) || '';
        if (/\b(input-area|text-input-field|prompt-input|composer)\b/i.test(cls)) return true;
      } catch (_) {}
      try {
        cur = cur.parentElement || (cur.getRootNode && cur.getRootNode().host) || null;
      } catch (_) {
        cur = null;
      }
    }
    return false;
  }

  function findPromptInput(doc, win, searchRoots) {
    if (!doc) return null;
    const roots = Array.isArray(searchRoots) ? searchRoots : collectSearchRoots(doc.body || doc, []);
    let fallback = null;
    for (const sel of PROMPT_INPUT_SELECTORS) {
      const nodes = queryAllFromRoots(roots, sel, []);
      for (const n of nodes) {
        if (!n || isInsideHudOrNonComposer(n)) continue;
        if (n.readOnly === true) continue;
        if (n.getAttribute) {
          if (n.getAttribute('readonly') !== null) continue;
          if (n.getAttribute('aria-readonly') === 'true') continue;
        }
        if (!isElementVisible(n, win, doc, { relaxHiddenLayout: true })) continue;
        if (isInsideRichTextareaOrInputArea(n)) return n;
        if (!fallback) fallback = n;
      }
      if (fallback) return fallback;
    }
    return fallback;
  }

  const SEND_ICON_SELECTOR =
    'mat-icon[fonticon="send"],mat-icon[data-mat-icon-name="send"],.send-icon';

  function findSendButton(doc, win, searchRoots) {
    if (!doc) return null;
    const roots = Array.isArray(searchRoots) ? searchRoots : collectSearchRoots(doc.body || doc, []);
    for (const sel of SEND_BUTTON_SELECTORS) {
      const nodes = queryAllFromRoots(roots, sel, []);
      for (const n of nodes) {
        if (!n || isIgnoredAncestor(n)) continue;
        if (isStopButtonElement(n)) continue;
        if (!isElementVisible(n, win, doc, { relaxHiddenLayout: true })) continue;
        return n;
      }
    }
    const iconNodes = queryAllFromRoots(roots, SEND_ICON_SELECTOR, []);
    for (const icon of iconNodes) {
      if (!icon || isIgnoredAncestor(icon)) continue;
      const btn = findClosestButtonAncestor(icon);
      if (btn && !isIgnoredAncestor(btn) && !isStopButtonElement(btn) && isElementVisible(btn, win, doc, { relaxHiddenLayout: true })) {
        return btn;
      }
    }
    return null;
  }

  function readPromptInputText(el) {
    if (!el) return '';
    const tag = (el.tagName || '').toUpperCase();
    const raw =
      tag === 'TEXTAREA' || tag === 'INPUT'
        ? String(el.value || '')
        : String(el.innerText || el.textContent || '');
    return raw.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
  }

  function dispatchSyntheticEvent(el, type, win, extra) {
    if (!el || typeof el.dispatchEvent !== 'function') return;
    const w = win || (typeof window !== 'undefined' ? window : null);
    const opts = Object.assign({ bubbles: true, cancelable: true, composed: true }, extra || {});
    try {
      if ((type === 'input' || type === 'beforeinput') && w && typeof w.InputEvent === 'function') {
        el.dispatchEvent(new w.InputEvent(type, opts));
        return;
      }
      if (w && typeof w.Event === 'function') {
        el.dispatchEvent(new w.Event(type, opts));
        return;
      }
    } catch (_) {
      // Fall through to plain object dispatch for lightweight mock DOMs
    }
    try {
      el.dispatchEvent(Object.assign({ type, target: el }, opts));
    } catch (_) {}
  }

  function defaultFillPromptInput(el, text, doc, win) {
    if (!el || typeof text !== 'string') return false;
    const w = win || (typeof window !== 'undefined' ? window : null);
    const d = doc || el.ownerDocument || (typeof document !== 'undefined' ? document : null);
    const cleanText = text.trim();
    if (!cleanText) return false;

    if (typeof el.focus === 'function') {
      try {
        el.focus({ preventScroll: true });
      } catch (_) {
        try {
          el.focus();
        } catch (_) {}
      }
    }

    const tag = (el.tagName || '').toUpperCase();
    if (tag === 'TEXTAREA' || tag === 'INPUT') {
      try {
        const proto =
          tag === 'TEXTAREA'
            ? w && w.HTMLTextAreaElement && w.HTMLTextAreaElement.prototype
            : w && w.HTMLInputElement && w.HTMLInputElement.prototype;
        const desc = proto ? Object.getOwnPropertyDescriptor(proto, 'value') : null;
        if (desc && typeof desc.set === 'function') {
          desc.set.call(el, cleanText);
        } else {
          el.value = cleanText;
        }
      } catch (_) {
        el.value = cleanText;
      }
      dispatchSyntheticEvent(el, 'input', w, { inputType: 'insertText', data: cleanText });
      dispatchSyntheticEvent(el, 'change', w);
      return readPromptInputText(el) === cleanText;
    }

    // Contenteditable (e.g. Gemini's Quill .ql-editor inside <rich-textarea>)
    let insertedByCommand = false;
    if (d && typeof d.execCommand === 'function') {
      try {
        if (w && typeof w.getSelection === 'function' && typeof d.createRange === 'function') {
          const range = d.createRange();
          range.selectNodeContents(el);
          const sel = w.getSelection();
          if (sel) {
            sel.removeAllRanges();
            sel.addRange(range);
          }
        }
        insertedByCommand = Boolean(d.execCommand('insertText', false, cleanText));
      } catch (_) {
        insertedByCommand = false;
      }
    }

    if (!insertedByCommand || readPromptInputText(el) !== cleanText) {
      if (el.classList && typeof el.classList.remove === 'function') {
        try {
          el.classList.remove('ql-blank');
        } catch (_) {}
      }
      const cls =
        typeof el.className === 'string'
          ? el.className
          : (el.getAttribute && el.getAttribute('class')) || '';
      if (/\bql-editor\b/i.test(cls) && d && typeof d.createElement === 'function') {
        try {
          el.textContent = '';
          const p = d.createElement('p');
          p.textContent = cleanText;
          el.appendChild(p);
        } catch (_) {
          el.textContent = cleanText;
        }
      } else {
        el.textContent = cleanText;
      }
      dispatchSyntheticEvent(el, 'beforeinput', w, { inputType: 'insertText', data: cleanText });
      dispatchSyntheticEvent(el, 'input', w, { inputType: 'insertText', data: cleanText });
      dispatchSyntheticEvent(el, 'change', w);
    }

    return readPromptInputText(el) === cleanText;
  }

  function dispatchEnterKey(el, win) {
    if (!el || typeof el.dispatchEvent !== 'function') return;
    const w = win || (typeof window !== 'undefined' ? window : null);
    const keyOpts = {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true,
      composed: true
    };
    for (const type of ['keydown', 'keypress', 'keyup']) {
      try {
        if (w && typeof w.KeyboardEvent === 'function') {
          el.dispatchEvent(new w.KeyboardEvent(type, keyOpts));
        } else {
          el.dispatchEvent(Object.assign({ type, target: el }, keyOpts));
        }
      } catch (_) {}
    }
  }

  class GmahEngine {
    constructor(options) {
      const opts = options || {};
      this.doc = opts.doc || (typeof document !== 'undefined' ? document : null);
      this.win = opts.win || (typeof window !== 'undefined' ? window : null);
      this.now = typeof opts.now === 'function' ? opts.now : () => Date.now();
      this.randomFn = typeof opts.randomFn === 'function' ? opts.randomFn : Math.random;
      this.clickFn = typeof opts.clickFn === 'function' ? opts.clickFn : defaultClickElement;
      this.fillInputFn = typeof opts.fillInputFn === 'function' ? opts.fillInputFn : defaultFillPromptInput;
      this.onStateChange = typeof opts.onStateChange === 'function' ? opts.onStateChange : null;
      this.onStatsSave = typeof opts.onStatsSave === 'function' ? opts.onStatsSave : null;
      this.onSettingsSave = typeof opts.onSettingsSave === 'function' ? opts.onSettingsSave : null;
      this.onChatOverridesSave = typeof opts.onChatOverridesSave === 'function' ? opts.onChatOverridesSave : null;
      this.onMainWorldClick = typeof opts.onMainWorldClick === 'function' ? opts.onMainWorldClick : null;
      this.onStallAlert = typeof opts.onStallAlert === 'function' ? opts.onStallAlert : null;
      this.onStallResolved = typeof opts.onStallResolved === 'function' ? opts.onStallResolved : null;
      this.onBreakerTrip = typeof opts.onBreakerTrip === 'function' ? opts.onBreakerTrip : null;
      this.onBreakerClear = typeof opts.onBreakerClear === 'function' ? opts.onBreakerClear : null;

      this.lastUrl = this.win && this.win.location ? this.win.location.href : '';
      this.conversationKey =
        typeof D.extractConversationKey === 'function' ? D.extractConversationKey(this.lastUrl) : null;
      this.globalSettings = D.mergeSettings(opts.settings);
      this.chatOverrides =
        typeof D.sanitizeChatOverridesMap === 'function'
          ? D.sanitizeChatOverridesMap(opts.chatOverrides)
          : {};
      this.settings =
        typeof D.resolveEffectiveSettings === 'function'
          ? D.resolveEffectiveSettings(this.globalSettings, this.getCurrentChatOverride())
          : D.mergeSettings(opts.settings);
      this.stats = D.normalizeStats(opts.stats, D.getTodayKey(new Date(this.safeNow())));
      this.mainWorldClickSeq = 0;

      this.clickedElements = new Set();
      this.clickAttempts = new Map(); // el -> { kind, count, lastAttemptAt, label, tier }
      this.taskContinueCount = 0;
      this.stagnantCount = 0;
      this.bgNoStopSinceAt = 0;
      this.bgNoStopTurnFp = null;
      this.lastContinueFingerprint = null;
      this.lastContinueContentFingerprint = null;
      this.lastAllowClickAt = 0;
      this.lastContinueClickAt = 0;
      this.nextAllowCooldownMs = 0;
      this.nextContinueCooldownMs = 0;
      this.recentActionTimestamps = [];
      this.lastMutationAt = 0;
      this.statusKey = 'hudStatusMonitoring';
      this.statusVars = null;
      this.lastStatusText = this.tr('hudStatusMonitoring');
      this.isGenerating = false;
      this.isNonChatPage = isNonChatGeminiUrl(this.lastUrl);
      this.ignoreStaleInitialContinue = Boolean(opts.ignoreStaleInitialContinue);
      this.suppressInitialContinueUntil = this.ignoreStaleInitialContinue ? this.safeNow() + 2000 : 0;

      // Connection / waiting stall timer & auto-recovery state
      this.stallStartAt = 0;
      this.stallElapsedMs = 0;
      this.stallConnectingLabel = '';
      this.stallFingerprint = null;
      this.stallAlertActive = false;
      this.stallRecovery = null;
      this.stallRecoveryCount = 0;
      this.stallRecoveryBlockedFp = null;
      this.stallRecoveryBaselineFp = null;

      this.circuitBreaker = {
        tripped: false,
        reasonCode: null,
        reasonKey: null,
        reasonVars: null,
        reason: ''
      };

      this.logs = [];
      this.maxLogs = 40;

      const initOverride = this.getCurrentChatOverride();
      if (initOverride && initOverride.emergencyStopped === true) {
        const reason = this.tr('breakerReasonEmergency');
        this.circuitBreaker = {
          tripped: true,
          reasonCode: 'emergency_stop',
          reasonKey: 'breakerReasonEmergency',
          reasonVars: null,
          reason
        };
        this.statusKey = null;
        this.statusVars = null;
        this.lastStatusText = this.tr('hudStatusBreaker', { reason });
      }
    }

    safeNow() {
      try {
        const val = typeof this.now === 'function' ? Number(this.now()) : Date.now();
        if (Number.isFinite(val)) return val;
      } catch (_) {}
      return Date.now();
    }

    sanitizeTimestamps(now) {
      if (!Number.isFinite(now)) return;
      if (!Number.isFinite(this.lastMutationAt) || this.lastMutationAt > now) {
        this.lastMutationAt = now;
      }
      if (!Number.isFinite(this.lastAllowClickAt) || this.lastAllowClickAt > now) {
        this.lastAllowClickAt = 0;
      }
      if (!Number.isFinite(this.lastContinueClickAt) || this.lastContinueClickAt > now) {
        this.lastContinueClickAt = 0;
      }
      if (!Number.isFinite(this.bgNoStopSinceAt) || this.bgNoStopSinceAt > now) {
        this.bgNoStopSinceAt = now;
      }
      if (!Number.isFinite(this.stallStartAt) || this.stallStartAt > now) {
        this.stallStartAt = now;
      }
      if (!Number.isFinite(this.suppressInitialContinueUntil) || this.suppressInitialContinueUntil > now + 30000) {
        this.suppressInitialContinueUntil = 0;
      }
      if (Array.isArray(this.recentActionTimestamps)) {
        this.recentActionTimestamps = this.recentActionTimestamps.filter(
          (ts) => Number.isFinite(ts) && ts <= now && ts >= now - 60000
        );
      } else {
        this.recentActionTimestamps = [];
      }
      if (this.stallRecovery) {
        if (!Number.isFinite(this.stallRecovery.startedAt) || this.stallRecovery.startedAt > now) {
          this.stallRecovery.startedAt = now;
        }
        if (!Number.isFinite(this.stallRecovery.phaseAt) || this.stallRecovery.phaseAt > now) {
          this.stallRecovery.phaseAt = now;
        }
      }
      if (this.clickAttempts && this.clickAttempts.size > 0) {
        for (const entry of this.clickAttempts.values()) {
          if (entry && (!Number.isFinite(entry.lastAttemptAt) || entry.lastAttemptAt > now)) {
            entry.lastAttemptAt = now;
          }
        }
      }
    }

    boundTrackingSets(maxCapacity) {
      const cap = typeof maxCapacity === 'number' && maxCapacity > 0 ? maxCapacity : 500;
      if (this.clickedElements && this.clickedElements.size > cap) {
        const excess = this.clickedElements.size - cap;
        let count = 0;
        for (const item of this.clickedElements) {
          this.clickedElements.delete(item);
          if (++count >= excess) break;
        }
      }
      if (this.clickAttempts && this.clickAttempts.size > cap) {
        const excess = this.clickAttempts.size - cap;
        let count = 0;
        for (const key of this.clickAttempts.keys()) {
          this.clickAttempts.delete(key);
          if (++count >= excess) break;
        }
      }
    }

    pruneDisconnectedTrackedNodes() {
      if (this.clickedElements && this.clickedElements.size > 0) {
        for (const el of Array.from(this.clickedElements)) {
          if (!el || el.nodeType !== 1 || el.isConnected === false) {
            this.clickedElements.delete(el);
          }
        }
      }
      if (this.clickAttempts && this.clickAttempts.size > 0) {
        for (const el of Array.from(this.clickAttempts.keys())) {
          if (!el || el.nodeType !== 1 || el.isConnected === false) {
            this.clickAttempts.delete(el);
          }
        }
      }
    }

    trackClicked(el) {
      if (!el) return;
      this.clickedElements.add(el);
      this.boundTrackingSets(500);
    }

    trackClickAttempt(el, data) {
      if (!el) return;
      this.clickAttempts.set(el, data);
      this.boundTrackingSets(500);
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

    clearLogs() {
      this.logs = [];
      this.emitState();
    }

    getCurrentChatOverride() {
      if (!this.conversationKey || !this.chatOverrides) return {};
      const entry = this.chatOverrides[this.conversationKey];
      return entry && typeof entry === 'object' ? entry : {};
    }

    hasChatOverride() {
      const entry = this.getCurrentChatOverride();
      return typeof D.hasChatOverrideChanges === 'function' ? D.hasChatOverrideChanges(entry) : false;
    }

    recomputeEffectiveSettings() {
      this.settings =
        typeof D.resolveEffectiveSettings === 'function'
          ? D.resolveEffectiveSettings(this.globalSettings, this.getCurrentChatOverride())
          : D.mergeSettings(this.globalSettings);
    }

    persistChatOverrides(removedKey) {
      if (!this.onChatOverridesSave) return;
      const sanitized =
        typeof D.sanitizeChatOverridesMap === 'function'
          ? D.sanitizeChatOverridesMap(this.chatOverrides)
          : Object.assign({}, this.chatOverrides);
      this.chatOverrides = sanitized;
      this.onChatOverridesSave(sanitized, {
        conversationKey: this.conversationKey,
        override: this.conversationKey ? this.chatOverrides[this.conversationKey] || null : null,
        removedKey: removedKey || null
      });
    }

    getState() {
      const chatOverride = Object.assign({}, this.getCurrentChatOverride());
      return {
        settings: this.settings,
        globalSettings: this.globalSettings,
        conversationKey: this.conversationKey,
        chatOverride,
        hasChatOverride: this.hasChatOverride(),
        chatEmergencyStopped: Boolean(
          chatOverride.emergencyStopped === true ||
            (this.circuitBreaker.tripped && this.circuitBreaker.reasonCode === 'emergency_stop')
        ),
        stats: this.stats,
        taskContinueCount: this.taskContinueCount,
        isGenerating: this.isGenerating,
        isNonChatPage: this.isNonChatPage,
        stallAlertActive: this.stallAlertActive,
        stallElapsedMs: this.stallElapsedMs,
        stallConnectingLabel: this.stallConnectingLabel,
        stallRecoveryActive: Boolean(this.stallRecovery),
        stallRecoveryCount: this.stallRecoveryCount,
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
      this.stallElapsedMs = 0;
      this.stallConnectingLabel = '';
      this.stallFingerprint = null;
      this.stallAlertActive = false;
      this.stallRecovery = null;
      this.stallRecoveryBlockedFp = null;
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

    applyEffectiveSettingsSideEffects(prevStallAlert) {
      this.refreshLocalizedTexts();
      if (!this.settings.enabled) {
        if (!this.stallRecovery || !this.stallRecovery.manual) {
          this.resetStallMonitor(true);
        }
      } else {
        if (!this.settings.stallAutoRecoverEnabled && this.stallRecovery && !this.stallRecovery.manual) {
          this.stallRecovery = null;
          this.stallRecoveryBlockedFp = null;
        }
        if (!this.settings.stallAlertEnabled && this.stallAlertActive) {
          this.stallAlertActive = false;
          if (this.statusKey === 'hudStatusStallMinutes') {
            this.setStatus('hudStatusMonitoring');
          }
          if (this.onStallResolved) {
            this.onStallResolved();
          }
        }
      }
      if (prevStallAlert && !this.settings.stallAlertEnabled) {
        if (this.onStallResolved) {
          this.onStallResolved();
        }
      }
    }

    updateSettings(partial, persist) {
      const prevStallAlert = this.settings ? this.settings.stallAlertEnabled : true;
      this.globalSettings = D.mergeSettings(Object.assign({}, this.globalSettings, partial));
      this.recomputeEffectiveSettings();
      this.applyEffectiveSettingsSideEffects(prevStallAlert);
      if (persist && this.onSettingsSave) {
        this.onSettingsSave(this.globalSettings);
      }
      if (!this.reconcileBreakerWithSettings()) {
        this.emitState();
      }
    }

    updateChatOverride(partial, persist) {
      if (!this.conversationKey || !partial || typeof partial !== 'object') {
        return this.updateSettings(partial, persist);
      }
      const prevStallAlert = this.settings ? this.settings.stallAlertEnabled : true;
      const current = Object.assign({}, this.getCurrentChatOverride());
      const allowedKeys = Array.isArray(D.CHAT_OVERRIDE_KEYS) ? D.CHAT_OVERRIDE_KEYS : [];
      let changed = false;

      for (const key of allowedKeys) {
        if (!Object.prototype.hasOwnProperty.call(partial, key)) continue;
        const val = partial[key];
        if (val === null || val === undefined) {
          if (Object.prototype.hasOwnProperty.call(current, key)) {
            delete current[key];
            changed = true;
          }
        } else if (typeof val === 'boolean') {
          if (val === this.globalSettings[key]) {
            if (Object.prototype.hasOwnProperty.call(current, key)) {
              delete current[key];
              changed = true;
            }
          } else if (current[key] !== val) {
            current[key] = val;
            changed = true;
          }
        }
      }

      if (Object.prototype.hasOwnProperty.call(partial, 'emergencyStopped')) {
        if (partial.emergencyStopped === true) {
          if (current.emergencyStopped !== true) {
            current.emergencyStopped = true;
            changed = true;
          }
        } else if (current.emergencyStopped) {
          delete current.emergencyStopped;
          changed = true;
        }
      }

      if (typeof D.hasChatOverrideChanges === 'function' && D.hasChatOverrideChanges(current)) {
        current.updatedAt = this.safeNow();
        this.chatOverrides[this.conversationKey] = D.sanitizeChatOverride(current);
      } else {
        delete this.chatOverrides[this.conversationKey];
      }

      this.recomputeEffectiveSettings();
      this.applyEffectiveSettingsSideEffects(prevStallAlert);

      if (current.emergencyStopped === true) {
        this.tripBreaker('emergency_stop', null, 'breakerReasonEmergency');
      } else if (
        Object.prototype.hasOwnProperty.call(partial, 'emergencyStopped') &&
        !partial.emergencyStopped &&
        this.circuitBreaker.tripped &&
        this.circuitBreaker.reasonCode === 'emergency_stop'
      ) {
        this.clearBreaker();
      }

      if (persist && changed) {
        this.persistChatOverrides();
      }
      if (!this.reconcileBreakerWithSettings()) {
        this.emitState();
      }
      return this.getCurrentChatOverride();
    }

    clearChatOverride(persist) {
      if (!this.conversationKey) return false;
      const prevStallAlert = this.settings ? this.settings.stallAlertEnabled : true;
      const hadOverride = this.hasChatOverride();
      const wasEmergency = this.circuitBreaker.tripped && this.circuitBreaker.reasonCode === 'emergency_stop';
      delete this.chatOverrides[this.conversationKey];
      this.recomputeEffectiveSettings();
      this.applyEffectiveSettingsSideEffects(prevStallAlert);
      if (persist && hadOverride) {
        this.persistChatOverrides();
      }
      if (wasEmergency) {
        this.clearBreaker(this.tr('logChatOverrideCleared'));
      } else {
        if (hadOverride) this.addLog(this.tr('logChatOverrideCleared'));
        if (!this.reconcileBreakerWithSettings()) {
          this.emitState();
        }
      }
      return hadOverride;
    }

    setChatOverridesMap(rawMap) {
      const prevStallAlert = this.settings ? this.settings.stallAlertEnabled : true;
      this.chatOverrides =
        typeof D.sanitizeChatOverridesMap === 'function'
          ? D.sanitizeChatOverridesMap(rawMap)
          : {};
      this.recomputeEffectiveSettings();
      this.applyEffectiveSettingsSideEffects(prevStallAlert);

      const curOverride = this.getCurrentChatOverride();
      if (curOverride.emergencyStopped === true) {
        if (!this.circuitBreaker.tripped || this.circuitBreaker.reasonCode !== 'emergency_stop') {
          this.tripBreaker('emergency_stop', null, 'breakerReasonEmergency');
          return;
        }
      } else if (this.circuitBreaker.tripped && this.circuitBreaker.reasonCode === 'emergency_stop') {
        this.clearBreaker();
        return;
      }

      if (!this.reconcileBreakerWithSettings()) {
        this.emitState();
      }
    }

    triggerMainWorldClick(el, attempt, kind, label) {
      if (!el || !this.onMainWorldClick) return false;
      const target = resolveClickTarget(el, attempt);
      if (!target || typeof target.setAttribute !== 'function') return false;
      this.mainWorldClickSeq += 1;
      const token = `gmah_${this.safeNow()}_${this.mainWorldClickSeq}`;
      try {
        target.setAttribute('data-gmah-click-target', token);
      } catch (_) {
        return false;
      }
      try {
        this.onMainWorldClick({ token, attempt: Number(attempt) || 2, kind: kind || 'click', label: label || '' });
        return true;
      } catch (_) {
        try {
          if (typeof target.removeAttribute === 'function') target.removeAttribute('data-gmah-click-target');
        } catch (_) {}
        return false;
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

    nextRandom() {
      try {
        const v = Number(this.randomFn());
        if (Number.isFinite(v)) return Math.max(0, Math.min(1, v));
      } catch (_) {}
      return 0.5;
    }

    pickRandomDelay(minMs, maxMs) {
      const lo = Math.max(0, Math.round(Number(minMs) || 0));
      const hi = Math.max(lo, Math.round(Number(maxMs) || lo));
      if (hi === lo) return lo;
      return lo + Math.round(this.nextRandom() * (hi - lo));
    }

    recordAutomatedAction(now) {
      this.recentActionTimestamps.push(now);
      const cutoff = now - 60000;
      while (this.recentActionTimestamps.length > 0 && this.recentActionTimestamps[0] < cutoff) {
        this.recentActionTimestamps.shift();
      }
    }

    getBurstExtraDelayMs(now) {
      if (!this.settings.humanPacingEnabled) return 0;
      const cutoff60 = now - 60000;
      const cutoff20 = now - 20000;
      while (this.recentActionTimestamps.length > 0 && this.recentActionTimestamps[0] < cutoff60) {
        this.recentActionTimestamps.shift();
      }
      const in60s = this.recentActionTimestamps.length;
      let in20s = 0;
      for (let i = in60s - 1; i >= 0; i--) {
        if (this.recentActionTimestamps[i] >= cutoff20) in20s += 1;
        else break;
      }
      if (in60s >= 8) {
        return this.pickRandomDelay(3000, 5500);
      }
      if (in20s >= 4) {
        return this.pickRandomDelay(1800, 3600);
      }
      return 0;
    }

    computeEffectiveAllowCooldownMs(now) {
      const base = this.settings.allowCooldownMs;
      if (!this.settings.humanPacingEnabled) return base;
      const jitter = Math.round(this.nextRandom() * Math.min(250, base * 0.35));
      return base + jitter + this.getBurstExtraDelayMs(now);
    }

    computeEffectiveContinueCooldownMs(now) {
      const base = this.settings.continueCooldownMs;
      if (!this.settings.humanPacingEnabled) return base;
      const in20s = this.recentActionTimestamps.filter((ts) => ts >= now - 20000).length;
      const maxJitter = in20s >= 2 ? Math.min(900, base * 0.25) : Math.min(180, base * 0.05);
      const jitter = Math.round(this.nextRandom() * maxJitter);
      return base + jitter + this.getBurstExtraDelayMs(now);
    }

    computeRecoveryStopSettleMs(isManual) {
      if (!this.settings.humanPacingEnabled) return STALL_STOP_SETTLE_MS;
      return isManual ? this.pickRandomDelay(1500, 2400) : this.pickRandomDelay(2000, 3400);
    }

    computeRecoverySendSettleMs(isManual) {
      if (!this.settings.humanPacingEnabled) return STALL_SEND_SETTLE_MS;
      return isManual ? this.pickRandomDelay(900, 1700) : this.pickRandomDelay(1100, 2200);
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
      if (this.onBreakerTrip) {
        this.onBreakerTrip({
          reasonCode,
          reason: resolvedReason,
          notify: reasonCode !== 'emergency_stop' && Boolean(this.settings.stallAlertEnabled)
        });
      }
      this.emitState();
    }

    emergencyStop(opts) {
      const persist = !opts || opts.persist !== false;
      if (this.conversationKey && !this.isNonChatPage) {
        const cur = Object.assign({}, this.getCurrentChatOverride(), {
          emergencyStopped: true,
          updatedAt: this.safeNow()
        });
        this.chatOverrides[this.conversationKey] =
          typeof D.sanitizeChatOverride === 'function' ? D.sanitizeChatOverride(cur) : cur;
        if (persist) {
          this.persistChatOverrides();
        }
      }
      this.tripBreaker('emergency_stop', null, 'breakerReasonEmergency');
    }

    clearBreaker(logMsg, opts) {
      const prevCode = this.circuitBreaker.reasonCode;
      const persist = !opts || opts.persist !== false;
      if (
        prevCode === 'emergency_stop' &&
        this.conversationKey &&
        this.chatOverrides &&
        this.chatOverrides[this.conversationKey] &&
        this.chatOverrides[this.conversationKey].emergencyStopped
      ) {
        const nextEntry = Object.assign({}, this.chatOverrides[this.conversationKey]);
        delete nextEntry.emergencyStopped;
        if (typeof D.hasChatOverrideChanges === 'function' && D.hasChatOverrideChanges(nextEntry)) {
          nextEntry.updatedAt = this.safeNow();
          this.chatOverrides[this.conversationKey] = D.sanitizeChatOverride(nextEntry);
        } else {
          delete this.chatOverrides[this.conversationKey];
        }
        if (persist) {
          this.persistChatOverrides();
        }
      }
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
      this.stallRecoveryCount = 0;
      this.stallRecoveryBaselineFp = null;
      this.setStatus('hudStatusMonitoring');
      this.addLog(logMsg || '✅ 已解除熔断并重置本次任务计数');
      if (this.onBreakerClear) {
        this.onBreakerClear();
      }
      this.emitState();
    }

    onUserManualPrompt() {
      this.resetStallMonitor(true);
      this.stallRecoveryCount = 0;
      this.stallRecoveryBaselineFp = null;
      this.suppressInitialContinueUntil = 0;
      this.taskContinueCount = 0;
      this.stagnantCount = 0;
      this.bgNoStopSinceAt = 0;
      this.bgNoStopTurnFp = null;
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
      const prevKey = this.conversationKey;
      const prevStallAlert = this.settings ? this.settings.stallAlertEnabled : true;
      this.resetStallMonitor(true);
      this.stallRecoveryCount = 0;
      this.stallRecoveryBaselineFp = null;
      this.lastUrl = newUrl;
      this.isNonChatPage = isNonChatGeminiUrl(newUrl);
      const nextKey =
        typeof D.extractConversationKey === 'function' ? D.extractConversationKey(newUrl) : null;
      // Do NOT suppress continue when transitioning from fresh /app landing page into a brand-new /app/<id> chat
      const isFreshChatCreation = isFreshChatLandingUrl(prevUrl) && !this.isNonChatPage && !isFreshChatLandingUrl(newUrl);
      if (
        isFreshChatCreation &&
        prevKey === 'landing' &&
        nextKey &&
        nextKey !== 'landing' &&
        this.chatOverrides &&
        this.chatOverrides.landing
      ) {
        const inherited = Object.assign({}, this.chatOverrides.landing, { updatedAt: this.safeNow() });
        this.chatOverrides[nextKey] =
          typeof D.sanitizeChatOverride === 'function' ? D.sanitizeChatOverride(inherited) : inherited;
        delete this.chatOverrides.landing;
        this.conversationKey = nextKey;
        this.persistChatOverrides('landing');
      } else {
        this.conversationKey = nextKey;
      }

      this.recomputeEffectiveSettings();
      this.applyEffectiveSettingsSideEffects(prevStallAlert);

      this.suppressInitialContinueUntil =
        this.ignoreStaleInitialContinue && !isFreshChatCreation ? this.now() + 2000 : 0;
      this.taskContinueCount = 0;
      this.stagnantCount = 0;
      this.bgNoStopSinceAt = 0;
      this.bgNoStopTurnFp = null;
      this.lastContinueFingerprint = null;
      this.lastContinueContentFingerprint = null;
      this.clickAttempts.clear();

      const nextOverride = this.getCurrentChatOverride();
      if (nextOverride && nextOverride.emergencyStopped === true) {
        if (!this.circuitBreaker.tripped || this.circuitBreaker.reasonCode !== 'emergency_stop') {
          this.tripBreaker('emergency_stop', null, 'breakerReasonEmergency');
          this.addLog(this.tr('logChatEmergencyRestored'));
          this.emitState();
        } else {
          this.emitState();
        }
        return;
      }

      if (
        this.circuitBreaker.tripped &&
        this.circuitBreaker.reasonCode !== 'daily_limit'
      ) {
        this.clearBreaker(this.tr('logChatChangedClearBreaker'), { persist: false });
      } else {
        this.emitState();
      }
    }

    detectLoadingIndicator(searchRoots) {
      if (!this.doc) return false;
      const roots = Array.isArray(searchRoots)
        ? searchRoots
        : collectSearchRoots(this.doc.body || this.doc, []);
      const loadingNodes = queryAllFromRoots(roots, LOADING_COMBINED_SELECTOR, []);
      for (const n of loadingNodes) {
        if (!isIgnoredAncestor(n) && isElementVisible(n, this.win, this.doc)) {
          return true;
        }
      }
      return false;
    }

    detectGenerating(searchRoots, turns, now) {
      if (!this.doc) return false;
      const roots = Array.isArray(searchRoots)
        ? searchRoots
        : collectSearchRoots(this.doc.body || this.doc, []);
      if (findStopButton(this.doc, this.win, roots, false)) {
        this.bgNoStopSinceAt = 0;
        this.bgNoStopTurnFp = null;
        return true;
      }
      if (!this.detectLoadingIndicator(roots)) {
        this.bgNoStopSinceAt = 0;
        this.bgNoStopTurnFp = null;
        return false;
      }
      // In background tabs or unfocused/occluded windows, Chrome pauses CSS/Angular leave animations,
      // which can leave a finished response's spinner/streaming-indicator stuck in DOM with opacity:1
      // after the Stop button is already gone. Once no Stop button and no new text arrive for >= 2.2s,
      // treat the lingering spinner as frozen UI rather than active generation so Auto-Continue runs in BG!
      // Ensure the grace timer NEVER expires if MCP connectingText, tool calls, or thinking indicators are active!
      if (isBackgroundOrUnfocused(this.doc, this.win) && typeof now === 'number') {
        const hasConnecting = Boolean(this.detectConnectingStatus(roots, turns));
        const hasToolOrThinking = hasActiveToolOrThinking(this.doc, this.win, roots);
        if (hasConnecting || hasToolOrThinking) {
          this.bgNoStopSinceAt = now;
          return true;
        }

        const turnFp = computeResponseFingerprint(turns) || '';
        if (this.bgNoStopSinceAt === 0 || turnFp !== this.bgNoStopTurnFp) {
          this.bgNoStopSinceAt = now;
          this.bgNoStopTurnFp = turnFp;
          return true;
        }
        const graceMs = Math.max(2200, this.settings.idleSettleMs);
        if (now - this.bgNoStopSinceAt >= graceMs) {
          return false;
        }
      }
      return true;
    }

    detectConnectingStatus(searchRoots, turns) {
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
      // Fallback: when Gemini is actively generating/waiting, scan short visible labels inside the latest turn
      // so MCP tool connection cards (e.g. "正在连接 Desktop Commander...") are caught even without role="status"
      if (this.isGenerating && Array.isArray(turns) && turns.length > 0) {
        const latestTurn = turns[turns.length - 1];
        if (latestTurn && typeof latestTurn.querySelectorAll === 'function') {
          const turnRoots = collectSearchRoots(latestTurn, []);
          const candidates = queryAllFromRoots(turnRoots, 'span,div,button,mat-expansion-panel-header', []);
          let best = null;
          for (const el of candidates) {
            if (!el || isIgnoredAncestor(el) || !isElementVisible(el, this.win, this.doc)) continue;
            const txt = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
            if (!txt || txt.length > 100) continue;
            if (D.containsKeyword(txt, CONNECTING_KEYWORDS)) {
              if (!best || txt.length < best.length) {
                best = txt;
              }
            }
          }
          if (best) return best;
        }
      }
      return null;
    }

    cleanConnectingDisplayLabel(connectingText) {
      if (typeof connectingText !== 'string' || !connectingText.trim()) return '';
      const cleaned = connectingText
        .replace(/\(\s*\d+\s*[s秒]?\s*\)/gi, '')
        .replace(/[.。…]+$/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (!cleaned) return '';
      return cleaned.length > 34 ? `${cleaned.slice(0, 33)}…` : cleaned;
    }

    computeStallProgressFingerprint(turns, connectingText) {
      let turnFp = '';
      if (turns && turns.length > 0) {
        const latest = turns[turns.length - 1];
        let text = D.normalizeText(latest.innerText || latest.textContent || '');
        if (connectingText) {
          const normConn = D.normalizeText(connectingText);
          if (normConn && text.includes(normConn)) {
            text = text.split(normConn).join('');
          }
        }
        text = text.replace(/\s+/g, ' ').trim();
        turnFp = text ? `${turns.length}|${text.length}|${text.slice(-300)}` : `${turns.length}|0|`;
      }
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
      if (!this.settings.enabled) {
        this.resetStallMonitor(true);
        return { stalled: false, elapsedMs: 0, fp: null };
      }

      // While a multi-step stall auto-recovery (stop -> fill -> send) is in progress,
      // let stepStallRecovery own the transition instead of resetting mid-flight.
      if (this.stallRecovery) {
        return { stalled: false, elapsedMs: this.stallElapsedMs, fp: this.stallFingerprint, recovering: true };
      }

      const curTurnFp = computeResponseFingerprint(turns);
      if (this.stallRecoveryBaselineFp && curTurnFp && curTurnFp !== this.stallRecoveryBaselineFp) {
        this.stallRecoveryCount = 0;
        this.stallRecoveryBaselineFp = null;
      }

      if (!isWaiting) {
        this.resetStallMonitor(true, this.tr('logStallRecovered'));
        return { stalled: false, elapsedMs: 0, fp: null };
      }

      this.stallConnectingLabel = this.cleanConnectingDisplayLabel(connectingText);
      const fp = this.computeStallProgressFingerprint(turns, connectingText);
      if (this.stallStartAt === 0 || fp !== this.stallFingerprint) {
        this.stallStartAt = now;
        this.stallElapsedMs = 0;
        this.stallFingerprint = fp;
        this.stallRecoveryBlockedFp = null;
        if (this.stallAlertActive) {
          this.stallAlertActive = false;
          if (this.statusKey === 'hudStatusStallMinutes' || (this.lastStatusText && this.lastStatusText.startsWith('⚠️'))) {
            this.setStatus('hudStatusMonitoring');
          }
          this.addLog(this.tr('logStallProgress'));
          if (this.onStallResolved) this.onStallResolved();
        }
        return { stalled: false, elapsedMs: 0, fp };
      }

      const elapsedMs = Math.max(0, now - this.stallStartAt);
      this.stallElapsedMs = elapsedMs;
      return { stalled: true, elapsedMs, fp };
    }

    maybeTriggerStallAlert(now, stallInfo) {
      if (!this.settings.enabled || !this.settings.stallAlertEnabled) return false;
      if (!stallInfo || !stallInfo.stalled) return false;
      const thresholdMs = Math.max(1, this.settings.stallAlertMinutes) * 60 * 1000;
      if (!this.stallAlertActive && stallInfo.elapsedMs >= thresholdMs) {
        this.stallAlertActive = true;
        const mins = Math.max(1, Math.floor(stallInfo.elapsedMs / 60000));
        this.setStatus('hudStatusStallMinutes', { mins });
        this.addLog(this.tr('logStallTriggered', { mins }));
        if (this.onStallAlert) {
          this.onStallAlert({
            minutes: mins,
            elapsedMs: stallInfo.elapsedMs,
            url: this.lastUrl
          });
        }
        this.emitState();
        return true;
      }
      return false;
    }

    stepStallRecovery(now, turns, searchRoots, stallInfo) {
      const isManualActive = Boolean(this.stallRecovery && this.stallRecovery.manual);
      if (this.circuitBreaker.tripped && this.circuitBreaker.reasonCode === 'emergency_stop') {
        this.stallRecovery = null;
        return null;
      }
      if (!isManualActive && (!this.settings.enabled || !this.settings.stallAutoRecoverEnabled || this.circuitBreaker.tripped)) {
        this.stallRecovery = null;
        return null;
      }

      const abortRecovery = (logKey, logVars) => {
        const failedFp = (this.stallRecovery && this.stallRecovery.stallFp) || (stallInfo && stallInfo.fp) || null;
        this.stallRecovery = null;
        this.stallRecoveryBlockedFp = failedFp;
        if (logKey) {
          this.addLog(this.tr(logKey, logVars));
        }
        this.emitState();
        return null;
      };

      const executeFillPhase = (sr) => {
        const inputEl = findPromptInput(this.doc, this.win, searchRoots);
        if (!inputEl) {
          if (now - sr.phaseAt < 4000) {
            this.emitState();
            return { action: 'wait', reason: 'stall_recover_awaiting_input', retryInMs: 600 };
          }
          return abortRecovery('logStallRecoverFailed');
        }

        const existingText = readPromptInputText(inputEl);
        const normPrompt = D.normalizeText(sr.promptText);
        const normExisting = D.normalizeText(existingText);
        const isOurPartialOrFull =
          !normExisting || normExisting === normPrompt || normPrompt.startsWith(normExisting);
        if (!isOurPartialOrFull) {
          return abortRecovery('logStallRecoverDraftSkip', { prompt: sr.promptText });
        }

        sr.inputEl = inputEl;

        // Human-paced natural character-by-character typing (avoids instant 0ms clipboard dump)
        if (this.settings.humanPacingEnabled && sr.promptText.length > 1 && normExisting !== normPrompt) {
          const curLen = typeof sr.typedChars === 'number' && sr.typedChars > 0 ? sr.typedChars : 0;
          const stepSize = sr.promptText.length <= 8 ? 1 : Math.ceil(sr.promptText.length / 6);
          const nextCount = Math.min(sr.promptText.length, curLen + stepSize);
          const partialText = sr.promptText.slice(0, nextCount);
          this.fillInputFn(inputEl, partialText, this.doc, this.win);
          sr.typedChars = nextCount;
          sr.phaseAt = now;

          if (nextCount < sr.promptText.length) {
            sr.phase = 'typing';
            sr.nextCharDelayMs = this.pickRandomDelay(140, 280);
            this.setStatus('hudStatusStallTyping', { prompt: sr.promptText });
            this.emitState();
            return {
              action: 'stall_recover_type',
              typed: partialText,
              prompt: sr.promptText,
              element: inputEl,
              retryInMs: sr.nextCharDelayMs
            };
          }
        } else if (normExisting !== normPrompt) {
          this.fillInputFn(inputEl, sr.promptText, this.doc, this.win);
          sr.typedChars = sr.promptText.length;
        }

        const sendSettleMs = this.computeRecoverySendSettleMs(Boolean(sr.manual));
        sr.phase = 'sending';
        sr.phaseAt = now;
        sr.sendSettleMs = sendSettleMs;
        sr.fillAttempts += 1;
        this.setStatus(
          this.settings.humanPacingEnabled ? 'hudStatusStallPacing' : 'hudStatusStallSending',
          { prompt: sr.promptText }
        );
        this.emitState();
        return {
          action: 'stall_recover_fill',
          prompt: sr.promptText,
          element: inputEl,
          retryInMs: sendSettleMs + 100
        };
      };

      // 1. Continue an in-progress recovery state machine
      if (this.stallRecovery) {
        const sr = this.stallRecovery;

        if (sr.phase === 'stopping') {
          const stopBtn = findStopButton(this.doc, this.win, searchRoots);
          if (stopBtn) {
            const elapsed = now - sr.phaseAt;
            if (elapsed < STALL_STOP_RETRY_MS) {
              this.emitState();
              return {
                action: 'wait',
                reason: 'stall_recover_stopping',
                retryInMs: Math.max(250, Math.min(1000, STALL_STOP_RETRY_MS - elapsed))
              };
            }
            if (sr.stopAttempts < 2) {
              sr.stopAttempts += 1;
              sr.phaseAt = now;
              this.clickFn(stopBtn, this.win, sr.stopAttempts, this.randomFn);
              if (isBackgroundOrUnfocused(this.doc, this.win)) {
                this.triggerMainWorldClick(stopBtn, sr.stopAttempts, 'stop', 'Stop');
              }
              this.emitState();
              return {
                action: 'stall_recover_stop_retry',
                attempt: sr.stopAttempts,
                element: stopBtn,
                retryInMs: 1200
              };
            }
            if (now - sr.startedAt < STALL_STOP_GIVEUP_MS) {
              this.emitState();
              return { action: 'wait', reason: 'stall_recover_stopping', retryInMs: 800 };
            }
            return abortRecovery('logStallRecoverFailed');
          }

          // Stop button is gone; wait a natural randomized cooldown so backend aborts cleanly before typing
          const targetStopSettleMs =
            typeof sr.stopSettleMs === 'number' && sr.stopSettleMs > 0
              ? sr.stopSettleMs
              : this.computeRecoveryStopSettleMs(Boolean(sr.manual));
          sr.stopSettleMs = targetStopSettleMs;
          const sinceStop = now - sr.phaseAt;
          if (sinceStop < targetStopSettleMs) {
            this.emitState();
            return {
              action: 'wait',
              reason: 'stall_recover_settling',
              retryInMs: Math.max(200, targetStopSettleMs - sinceStop)
            };
          }

          sr.phase = 'filling';
          sr.phaseAt = now;
          return executeFillPhase(sr);
        }

        if (sr.phase === 'filling') {
          return executeFillPhase(sr);
        }

        if (sr.phase === 'typing') {
          const waitCharMs = typeof sr.nextCharDelayMs === 'number' ? sr.nextCharDelayMs : 180;
          const sinceChar = now - sr.phaseAt;
          if (sinceChar < waitCharMs) {
            this.emitState();
            return {
              action: 'wait',
              reason: 'stall_recover_typing',
              retryInMs: Math.max(100, waitCharMs - sinceChar)
            };
          }
          return executeFillPhase(sr);
        }

        if (sr.phase === 'sending') {
          const targetSendSettleMs =
            typeof sr.sendSettleMs === 'number' && sr.sendSettleMs > 0
              ? sr.sendSettleMs
              : this.computeRecoverySendSettleMs(Boolean(sr.manual));
          const sinceFill = now - sr.phaseAt;
          if (sinceFill < targetSendSettleMs) {
            this.emitState();
            return {
              action: 'wait',
              reason: 'stall_recover_send_settle',
              retryInMs: Math.max(150, targetSendSettleMs - sinceFill)
            };
          }

          const inputEl =
            sr.inputEl && sr.inputEl.isConnected
              ? sr.inputEl
              : findPromptInput(this.doc, this.win, searchRoots);

          if (inputEl) {
            const curText = readPromptInputText(inputEl);
            if (!curText && sr.fillAttempts < 2) {
              sr.fillAttempts += 1;
              sr.phaseAt = now;
              this.fillInputFn(inputEl, sr.promptText, this.doc, this.win);
              this.emitState();
              return {
                action: 'stall_recover_fill',
                prompt: sr.promptText,
                element: inputEl,
                retryInMs: targetSendSettleMs + 100
              };
            }
          }

          const sendBtn = findSendButton(this.doc, this.win, searchRoots);
          let method = null;
          let targetEl = null;
          const fallbackDeadlineMs = targetSendSettleMs + STALL_SEND_FALLBACK_MS;

          if (sendBtn) {
            this.clickFn(sendBtn, this.win, 1, this.randomFn);
            if (isBackgroundOrUnfocused(this.doc, this.win) && (!inputEl || readPromptInputText(inputEl).length > 0)) {
              this.triggerMainWorldClick(sendBtn, 2, 'send', 'Send');
            }
            method = 'button';
            targetEl = sendBtn;
          } else if (sinceFill < fallbackDeadlineMs) {
            this.emitState();
            return {
              action: 'wait',
              reason: 'stall_recover_awaiting_send',
              retryInMs: Math.max(200, Math.min(500, fallbackDeadlineMs - sinceFill))
            };
          } else if (inputEl) {
            dispatchEnterKey(inputEl, this.win);
            method = 'enter';
            targetEl = inputEl;
          } else {
            return abortRecovery('logStallRecoverFailed');
          }

          const promptText = sr.promptText;
          const baselineFp = sr.baselineFp;
          const hadStopButton = sr.hadStopButton;
          const wasManual = Boolean(sr.manual);
          if (!wasManual) {
            this.stallRecoveryCount += 1;
            this.stallRecoveryBaselineFp = baselineFp;
          }
          this.recordAutomatedAction(now);
          this.stallRecovery = null;
          this.stallStartAt = 0;
          this.stallElapsedMs = 0;
          this.stallConnectingLabel = '';
          this.stallFingerprint = null;
          this.stallRecoveryBlockedFp = null;
          this.lastMutationAt = now;

          if (this.stallAlertActive) {
            this.stallAlertActive = false;
            if (this.onStallResolved) this.onStallResolved();
          }

          if (wasManual) {
            this.setStatus('logForceRecoverSent', { prompt: promptText });
            this.addLog(this.tr('logForceRecoverSent', { prompt: promptText }));
          } else {
            this.setStatus('hudStatusStallRecovered', {
              prompt: promptText,
              count: this.stallRecoveryCount,
              max: this.settings.maxStallRecoveriesPerTask
            });
            this.addLog(
              this.tr('logStallRecoverSent', {
                prompt: promptText,
                count: this.stallRecoveryCount,
                max: this.settings.maxStallRecoveriesPerTask
              })
            );
          }
          this.emitState();
          return {
            action: 'stall_recover_sent',
            manual: wasManual,
            prompt: promptText,
            method,
            hadStopButton,
            element: targetEl,
            recoveryCount: this.stallRecoveryCount,
            maxRecoveries: this.settings.maxStallRecoveriesPerTask
          };
        }

        this.stallRecovery = null;
        return null;
      }

      // 2. Check if a new stall auto-recovery should start
      if (!stallInfo || !stallInfo.stalled) return null;
      if (this.stallRecoveryBlockedFp && this.stallRecoveryBlockedFp === stallInfo.fp) return null;

      const recoverThresholdMs = Math.max(1, this.settings.stallAutoRecoverMinutes) * 60 * 1000;
      if (stallInfo.elapsedMs < recoverThresholdMs) return null;

      // Safety check: never auto-recover into a quota/rate-limit error
      const quotaHit = this.detectQuotaOrError(turns, searchRoots);
      if (quotaHit) {
        this.tripBreaker('quota_error', null, 'breakerReasonQuotaError', { kw: quotaHit });
        return { action: 'tripped', reason: 'quota_error', keyword: quotaHit };
      }

      // Safety cap: stop looping after maxStallRecoveriesPerTask consecutive recoveries without progress
      if (this.stallRecoveryCount >= this.settings.maxStallRecoveriesPerTask) {
        this.stallRecoveryBlockedFp = stallInfo.fp;
        this.addLog(
          this.tr('logStallRecoverLimit', {
            count: this.stallRecoveryCount,
            max: this.settings.maxStallRecoveriesPerTask
          })
        );
        this.emitState();
        return null;
      }

      const stopBtn = findStopButton(this.doc, this.win, searchRoots);
      const inputEl = findPromptInput(this.doc, this.win, searchRoots);
      if (!stopBtn && !inputEl) {
        // Page lacks both Stop button and prompt input; fall back cleanly to desktop alert if enabled
        return null;
      }

      const promptText = this.settings.stallAutoRecoverPrompt || D.DEFAULT_SETTINGS.stallAutoRecoverPrompt;
      const mins = Math.max(1, Math.floor(stallInfo.elapsedMs / 60000));
      const baselineFp = computeResponseFingerprint(turns);

      if (stopBtn) {
        const stopSettleMs = this.computeRecoveryStopSettleMs(false);
        this.clickFn(stopBtn, this.win, 1, this.randomFn);
        this.stallRecovery = {
          phase: 'stopping',
          startedAt: now,
          phaseAt: now,
          stopSettleMs,
          stopAttempts: 1,
          fillAttempts: 0,
          sendAttempts: 0,
          typedChars: 0,
          minutes: mins,
          promptText,
          baselineFp,
          hadStopButton: true,
          stallFp: stallInfo.fp,
          inputEl: null
        };
        this.setStatus('hudStatusStallStopping', { mins });
        this.addLog(this.tr('logStallRecoverStop', { mins, prompt: promptText }));
        this.emitState();
        return {
          action: 'stall_recover_stop',
          minutes: mins,
          prompt: promptText,
          element: stopBtn,
          retryInMs: Math.min(1200, stopSettleMs)
        };
      }

      // No stop button present (e.g. stuck connecting indicator with unlocked input) -> fill & send directly
      this.stallRecovery = {
        phase: 'filling',
        startedAt: now,
        phaseAt: now,
        stopAttempts: 0,
        fillAttempts: 0,
        sendAttempts: 0,
        typedChars: 0,
        minutes: mins,
        promptText,
        baselineFp,
        hadStopButton: false,
        stallFp: stallInfo.fp,
        inputEl: null
      };
      this.addLog(this.tr('logStallRecoverDirect', { mins, prompt: promptText }));
      return executeFillPhase(this.stallRecovery);
    }

    /**
     * User-triggered immediate cancel & send continue (bypasses the 5-min wait threshold).
     */
    forceStallRecovery() {
      if (!this.doc) return { action: 'noop', reason: 'no_doc' };
      const currentHref = this.win && this.win.location ? this.win.location.href : this.lastUrl;
      if (isNonChatGeminiUrl(currentHref || this.lastUrl)) {
        return { action: 'noop', reason: 'non_chat_page' };
      }
      if (this.circuitBreaker.tripped && this.circuitBreaker.reasonCode === 'emergency_stop') {
        return { action: 'blocked', reason: 'emergency_stop' };
      }

      const now = this.now();
      const searchRoots = collectSearchRoots(this.doc.body || this.doc, []);
      const turns = getAssistantTurns(this.doc, searchRoots);

      // If a recovery is already mid-flight, promote to manual and advance immediately
      if (this.stallRecovery) {
        this.stallRecovery.manual = true;
        return this.stepStallRecovery(now, turns, searchRoots, { stalled: false, elapsedMs: this.stallElapsedMs, fp: this.stallFingerprint });
      }

      const stopBtn = findStopButton(this.doc, this.win, searchRoots);
      const inputEl = findPromptInput(this.doc, this.win, searchRoots);
      if (!stopBtn && !inputEl) {
        this.addLog(this.tr('logForceRecoverNoTarget'));
        this.emitState();
        return { action: 'noop', reason: 'force_recover_no_target' };
      }

      const promptText = this.settings.stallAutoRecoverPrompt || D.DEFAULT_SETTINGS.stallAutoRecoverPrompt;
      const baselineFp = computeResponseFingerprint(turns);
      this.stallRecoveryBlockedFp = null;

      if (stopBtn) {
        const stopSettleMs = this.computeRecoveryStopSettleMs(true);
        this.clickFn(stopBtn, this.win, 1, this.randomFn);
        this.stallRecovery = {
          phase: 'stopping',
          manual: true,
          startedAt: now,
          phaseAt: now,
          stopSettleMs,
          stopAttempts: 1,
          fillAttempts: 0,
          sendAttempts: 0,
          typedChars: 0,
          minutes: Math.floor((this.stallElapsedMs || 0) / 60000),
          promptText,
          baselineFp,
          hadStopButton: true,
          stallFp: this.stallFingerprint,
          inputEl: null
        };
        this.setStatus('hudStatusForceStopping', { prompt: promptText });
        this.addLog(this.tr('logForceRecoverStop', { prompt: promptText }));
        this.emitState();
        return {
          action: 'stall_recover_stop',
          manual: true,
          prompt: promptText,
          element: stopBtn,
          retryInMs: Math.min(1200, stopSettleMs)
        };
      }

      this.stallRecovery = {
        phase: 'filling',
        manual: true,
        startedAt: now,
        phaseAt: now,
        stopAttempts: 0,
        fillAttempts: 0,
        sendAttempts: 0,
        typedChars: 0,
        minutes: Math.floor((this.stallElapsedMs || 0) / 60000),
        promptText,
        baselineFp,
        hadStopButton: false,
        stallFp: this.stallFingerprint,
        inputEl: null
      };
      this.addLog(this.tr('logForceRecoverDirect', { prompt: promptText }));
      return this.stepStallRecovery(now, turns, searchRoots, { stalled: false, elapsedMs: this.stallElapsedMs, fp: this.stallFingerprint });
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

    getBgRetryPolicy(kind, currentCount) {
      const maxAttempts = this.doc && this.doc.hidden === true ? MAX_BG_HIDDEN_ATTEMPTS : MAX_BG_CLICK_ATTEMPTS;
      if (currentCount >= maxAttempts) return null;
      const baseDelay = kind === 'allow' ? BG_ALLOW_RETRY_DELAY_MS : BG_CONTINUE_RETRY_DELAY_MS;
      // Fast retry on attempt 2 (2.5s / 3.5s); late background-thaw retries on attempts 3-4 (12s / 15s)
      const delay = currentCount >= MAX_BG_CLICK_ATTEMPTS ? BG_LATE_RETRY_DELAY_MS + (currentCount - MAX_BG_CLICK_ATTEMPTS) * 3000 : baseDelay;
      return { delay, maxAttempts };
    }

    findBgRetryCandidate(kind, visibleSet, now) {
      if (!isBackgroundOrUnfocused(this.doc, this.win) || this.clickAttempts.size === 0) return null;
      for (const [el, entry] of this.clickAttempts.entries()) {
        if (!entry || entry.kind !== kind) continue;
        const policy = this.getBgRetryPolicy(kind, entry.count);
        if (!policy) continue;
        if (!visibleSet.has(el)) continue;
        if (now - entry.lastAttemptAt >= policy.delay) {
          return { el, entry, maxAttempts: policy.maxAttempts };
        }
      }
      return null;
    }

    getNextBgRetryDelayMs(visibleSet, now) {
      if (!isBackgroundOrUnfocused(this.doc, this.win) || this.clickAttempts.size === 0) return 0;
      let minRemaining = 0;
      for (const [el, entry] of this.clickAttempts.entries()) {
        if (!entry) continue;
        const policy = this.getBgRetryPolicy(entry.kind, entry.count);
        if (!policy) continue;
        if (!visibleSet.has(el)) continue;
        const rem = Math.max(100, policy.delay - (now - entry.lastAttemptAt));
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
      const turns = getAssistantTurns(this.doc, searchRoots);
      const now = typeof this.now === 'function' ? this.now() : Date.now();
      if (this.detectGenerating(searchRoots, turns, now)) return 0;
      const clickables = collectClickableElements(this.doc, this.win, searchRoots);
      let count = 0;
      let guard = 0;
      while (guard < 20) {
        guard += 1;
        const hit = this.findContinueCandidate(clickables, turns);
        if (!hit) break;
        this.trackClicked(hit.item.el);
        count += 1;
      }
      return count;
    }

    /**
     * Single scan tick. Returns an action descriptor for deterministic testing & debugging.
     */
    scanOnce() {
      if (!this.doc) return { action: 'noop', reason: 'no_doc' };

      const now = this.safeNow();
      this.sanitizeTimestamps(now);
      this.pruneDisconnectedTrackedNodes();
      this.boundTrackingSets(500);

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
      const turns = getAssistantTurns(this.doc, searchRoots);
      this.isGenerating = this.detectGenerating(searchRoots, turns, now);
      if (this.isGenerating) {
        this.suppressInitialContinueUntil = 0;
      }

      // Emergency stop blocks EVERYTHING (both Allow & Continue & Recovery)
      if (this.circuitBreaker.tripped && this.circuitBreaker.reasonCode === 'emergency_stop') {
        this.resetStallMonitor(true);
        this.emitState();
        return { action: 'blocked', reason: 'emergency_stop' };
      }

      // Allow an explicit user-triggered "Resume Now" (manual force-recovery) to finish even if auto-monitoring is paused
      if (this.stallRecovery && this.stallRecovery.manual) {
        const manualRes = this.stepStallRecovery(now, turns, searchRoots, {
          stalled: false,
          elapsedMs: this.stallElapsedMs,
          fp: this.stallFingerprint,
          recovering: true
        });
        if (manualRes) return manualRes;
      }

      if (!this.settings.enabled) {
        this.resetStallMonitor(true);
        this.emitState();
        return { action: 'noop', reason: 'disabled' };
      }

      const clickables = collectClickableElements(this.doc, this.win, searchRoots);
      const visibleSet = new Set(clickables.map((c) => c.el));
      const connectingText = this.detectConnectingStatus(searchRoots, turns);
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
        const effectiveAllowCooldown =
          this.lastAllowClickAt > 0
            ? Math.max(this.settings.allowCooldownMs, this.nextAllowCooldownMs || this.settings.allowCooldownMs)
            : 0;
        if (allowElapsed >= effectiveAllowCooldown) {
          const allowHit = this.findAllowCandidate(clickables);
          if (allowHit) {
            this.trackClicked(allowHit.item.el);
            this.trackClickAttempt(allowHit.item.el, {
              kind: 'allow',
              count: 1,
              lastAttemptAt: now,
              label: allowHit.item.label,
              tier: allowHit.tier
            });
            this.lastAllowClickAt = now;
            this.recordAutomatedAction(now);
            this.nextAllowCooldownMs = this.computeEffectiveAllowCooldownMs(now);
            this.stats.allowCount += 1;
            this.resetStallMonitor(true);
            if (this.onStatsSave) this.onStatsSave(this.stats, { allow: 1 });
            this.clickFn(allowHit.item.el, this.win, 1, this.randomFn);
            const isBgNow = isBackgroundOrUnfocused(this.doc, this.win);
            if (isBgNow) {
              this.triggerMainWorldClick(allowHit.item.el, 1, 'allow', allowHit.item.label);
            }
            const tag = allowHit.tier === 'always' ? '始终允许' : '允许';
            const bgTag = isBgNow ? ' [后台]' : '';
            this.setStatus('hudStatusClickedAllow', { label: allowHit.item.label });
            this.addLog(`✅ 自动点击[${tag}]${bgTag}：「${allowHit.item.label}」`);
            this.emitState();
            return {
              action: 'clicked_allow',
              tier: allowHit.tier,
              label: allowHit.item.label,
              element: allowHit.item.el,
              pendingRetryInMs: isBgNow ? BG_ALLOW_RETRY_DELAY_MS : 0
            };
          }

          // Background click safety retry: if a previously clicked permission button failed to dismiss while hidden
          const allowRetry = this.findBgRetryCandidate('allow', visibleSet, now);
          if (allowRetry) {
            allowRetry.entry.count += 1;
            allowRetry.entry.lastAttemptAt = now;
            this.lastAllowClickAt = now;
            this.recordAutomatedAction(now);
            this.nextAllowCooldownMs = this.computeEffectiveAllowCooldownMs(now);
            this.resetStallMonitor(true);
            this.clickFn(allowRetry.el, this.win, allowRetry.entry.count, this.randomFn);
            const mainWorldEscalated = this.triggerMainWorldClick(
              allowRetry.el,
              allowRetry.entry.count,
              'allow',
              allowRetry.entry.label
            );
            const maxRetry = allowRetry.maxAttempts || MAX_BG_CLICK_ATTEMPTS;
            this.setStatus('hudStatusRetryClick', {
              label: allowRetry.entry.label,
              attempt: allowRetry.entry.count,
              max: maxRetry
            });
            this.addLog(
              mainWorldEscalated
                ? this.tr('logMainWorldRetry', {
                    label: allowRetry.entry.label,
                    attempt: allowRetry.entry.count,
                    max: maxRetry
                  })
                : `🔁 后台重试点击允许：「${allowRetry.entry.label}」 (${allowRetry.entry.count}/${maxRetry})`
            );
            this.emitState();
            return {
              action: 'retried_allow',
              tier: allowRetry.entry.tier,
              label: allowRetry.entry.label,
              attempt: allowRetry.entry.count,
              mainWorldEscalated,
              element: allowRetry.el,
              pendingRetryInMs: this.getNextBgRetryDelayMs(visibleSet, now)
            };
          }
        } else {
          const pendingAllow = this.findAllowCandidate(clickables);
          if (pendingAllow) {
            this.emitState();
            const rawWait = effectiveAllowCooldown - allowElapsed;
            const safeRetry = Number.isFinite(rawWait) ? Math.max(100, Math.min(60000, Math.round(rawWait))) : 500;
            return {
              action: 'wait',
              reason: 'allow_cooldown',
              retryInMs: safeRetry
            };
          }
        }
      }

      // Track connection / generation stall timeout (auto-recovers via stop + "继续", or fires desktop alert)
      const stallInfo = this.updateStallMonitor(now, turns, isWaiting, connectingText);
      const recoverResult = this.stepStallRecovery(now, turns, searchRoots, stallInfo);
      if (recoverResult) {
        return recoverResult;
      }
      this.maybeTriggerStallAlert(now, stallInfo);

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
      if (this.isGenerating || connectingText) {
        let retryInMs = 0;
        if (this.doc && isBackgroundOrUnfocused(this.doc, this.win) && this.bgNoStopSinceAt > 0) {
          const graceMs = Math.max(2200, this.settings.idleSettleMs);
          const rawGrace = graceMs - (now - this.bgNoStopSinceAt);
          retryInMs = Number.isFinite(rawGrace) ? Math.max(250, Math.min(30000, Math.round(rawGrace))) : 500;
        }
        this.emitState();
        return {
          action: 'wait',
          reason: this.isGenerating ? 'generating' : 'connecting',
          connectingText: connectingText || undefined,
          retryInMs,
          pendingRetryInMs: this.getNextBgRetryDelayMs(visibleSet, now)
        };
      }
      if (this.lastMutationAt > 0 && now - this.lastMutationAt < this.settings.idleSettleMs) {
        this.emitState();
        const rawSettle = this.settings.idleSettleMs - (now - this.lastMutationAt);
        const safeRetry = Number.isFinite(rawSettle) ? Math.max(150, Math.min(30000, Math.round(rawSettle))) : 300;
        return {
          action: 'wait',
          reason: 'settling',
          retryInMs: safeRetry
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
        this.clickFn(contRetry.el, this.win, contRetry.entry.count, this.randomFn);
        const mainWorldEscalated = this.triggerMainWorldClick(
          contRetry.el,
          contRetry.entry.count,
          'continue',
          contRetry.entry.label
        );
        const maxRetry = contRetry.maxAttempts || MAX_BG_CLICK_ATTEMPTS;
        this.setStatus('hudStatusRetryClick', {
          label: contRetry.entry.label,
          attempt: contRetry.entry.count,
          max: maxRetry
        });
        this.addLog(
          mainWorldEscalated
            ? this.tr('logMainWorldRetry', {
                label: contRetry.entry.label,
                attempt: contRetry.entry.count,
                max: maxRetry
              })
            : `🔁 后台重试点击继续：「${contRetry.entry.label}」 (${contRetry.entry.count}/${maxRetry})`
        );
        this.emitState();
        return {
          action: 'retried_continue',
          label: contRetry.entry.label,
          attempt: contRetry.entry.count,
          mainWorldEscalated,
          element: contRetry.el,
          pendingRetryInMs: this.getNextBgRetryDelayMs(visibleSet, now)
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
        this.trackClicked(contHit.item.el);
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

      // Layer E: Cooldown (with randomized human-like pacing jitter & anti-burst protection)
      const effectiveContinueCooldown =
        this.lastContinueClickAt > 0
          ? Math.max(this.settings.continueCooldownMs, this.nextContinueCooldownMs || this.settings.continueCooldownMs)
          : 0;
      if (this.lastContinueClickAt > 0 && now - this.lastContinueClickAt < effectiveContinueCooldown) {
        this.emitState();
        const rawCooldown = effectiveContinueCooldown - (now - this.lastContinueClickAt);
        const safeRetry = Number.isFinite(rawCooldown) ? Math.max(150, Math.min(60000, Math.round(rawCooldown))) : 1000;
        return {
          action: 'wait',
          reason: 'cooldown',
          retryInMs: safeRetry
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
            this.trackClicked(contHit.item.el);
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
      this.trackClicked(contHit.item.el);
      this.trackClickAttempt(contHit.item.el, {
        kind: 'continue',
        count: 1,
        lastAttemptAt: now,
        label: contHit.item.label,
        fingerprint: fp
      });
      this.lastContinueClickAt = now;
      this.recordAutomatedAction(now);
      this.nextContinueCooldownMs = this.computeEffectiveContinueCooldownMs(now);
      this.lastContinueFingerprint = fp;
      this.lastContinueContentFingerprint = contentFp;
      this.taskContinueCount += 1;
      this.stats.continueCount += 1;
      this.resetStallMonitor(true);
      if (this.onStatsSave) this.onStatsSave(this.stats, { continue: 1 });

      this.clickFn(contHit.item.el, this.win, 1, this.randomFn);
      const isBgNow = isBackgroundOrUnfocused(this.doc, this.win);
      if (isBgNow) {
        this.triggerMainWorldClick(contHit.item.el, 1, 'continue', contHit.item.label);
      }
      const bgTag = isBgNow ? ' [后台]' : '';
      this.setStatus('hudStatusClickedContinue', {
        task: this.taskContinueCount,
        max: this.settings.maxContinuesPerTask
      });
      this.addLog(
        `▶️ 自动点击继续${bgTag}：「${contHit.item.label}」 (${this.taskContinueCount}/${this.settings.maxContinuesPerTask})`
      );
      this.emitState();

      return {
        action: 'clicked_continue',
        label: contHit.item.label,
        element: contHit.item.el,
        taskContinueCount: this.taskContinueCount,
        dailyContinueCount: this.stats.continueCount,
        pendingRetryInMs: isBgNow ? BG_CONTINUE_RETRY_DELAY_MS : 0
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
    defaultClickElement,
    hasActiveToolOrThinking,
    findStopButton,
    findPromptInput,
    findSendButton,
    readPromptInputText,
    defaultFillPromptInput
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
    let bgKeepaliveLockRelease = null;
    let bgKeepaliveLockPending = false;
    let bgLockGeneration = 0;
    const bgLockName = `gmah_bg_keepalive_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
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

    function performStatsDeltaRMW(batch, done) {
      try {
        chrome.storage.local.get([D.STATS_KEY], (res) => {
          if (!isContextAlive()) {
            done();
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
              done();
            });
          } catch (_) {
            done();
            teardownStaleContext();
          }
        });
      } catch (_) {
        done();
        teardownStaleContext();
      }
    }

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

      const finish = () => {
        statsFlushInFlight = false;
        if (pendingStatsDelta.allow > 0 || pendingStatsDelta.continue > 0) {
          flushPendingStatsDelta();
        }
      };

      if (typeof navigator !== 'undefined' && navigator.locks && typeof navigator.locks.request === 'function') {
        try {
          navigator.locks.request('gmah_stats_write_lock', () => {
            return new Promise((resolve) => {
              performStatsDeltaRMW(batch, () => {
                resolve();
                finish();
              });
            });
          }).catch(() => {
            performStatsDeltaRMW(batch, finish);
          });
        } catch (_) {
          performStatsDeltaRMW(batch, finish);
        }
      } else {
        performStatsDeltaRMW(batch, finish);
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

    const saveChatOverrides = (overridesMap, meta) => {
      if (!isContextAlive() || !hasChromeStorage) return;
      const keyName = D.CHAT_OVERRIDES_KEY || 'gmah_chat_overrides_v1';
      try {
        if (meta && meta.conversationKey && typeof chrome.storage.local.get === 'function') {
          chrome.storage.local.get([keyName], (res) => {
            if (!isContextAlive()) return;
            const currentMap =
              typeof D.sanitizeChatOverridesMap === 'function'
                ? D.sanitizeChatOverridesMap(res && res[keyName])
                : {};
            if (meta.removedKey && meta.removedKey !== meta.conversationKey) {
              delete currentMap[meta.removedKey];
            }
            if (meta.override && typeof D.hasChatOverrideChanges === 'function' && D.hasChatOverrideChanges(meta.override)) {
              currentMap[meta.conversationKey] = D.sanitizeChatOverride(meta.override);
            } else {
              delete currentMap[meta.conversationKey];
            }
            const finalMap =
              typeof D.sanitizeChatOverridesMap === 'function'
                ? D.sanitizeChatOverridesMap(currentMap)
                : currentMap;
            engine.chatOverrides = finalMap;
            try {
              chrome.storage.local.set({ [keyName]: finalMap });
            } catch (_) {
              teardownStaleContext();
            }
          });
          return;
        }
        const cleaned =
          typeof D.sanitizeChatOverridesMap === 'function'
            ? D.sanitizeChatOverridesMap(overridesMap)
            : Object.assign({}, overridesMap || {});
        chrome.storage.local.set({ [keyName]: cleaned });
      } catch (_) {
        teardownStaleContext();
      }
    };

    const engine = new GmahEngine({
      doc: document,
      win: window,
      ignoreStaleInitialContinue: true,
      onSettingsSave: saveSettings,
      onChatOverridesSave: saveChatOverrides,
      onStatsSave: saveStats,
      onMainWorldClick: (payload) => {
        sendToBackground(Object.assign({ type: 'GMAH_MAIN_WORLD_CLICK' }, payload || {}));
      },
      onStallAlert: (payload) => {
        sendToBackground(Object.assign({ type: 'GMAH_STALL_ALERT' }, payload || {}));
      },
      onStallResolved: () => {
        sendToBackground({ type: 'GMAH_STALL_CLEAR' });
      },
      onBreakerTrip: (payload) => {
        sendToBackground(Object.assign({ type: 'GMAH_BREAKER_ALERT' }, payload || {}));
      },
      onBreakerClear: () => {
        sendToBackground({ type: 'GMAH_BREAKER_CLEAR' });
      },
      onStateChange: (state) => {
        if (hud && !contextInvalidated) hud.update(state);
      }
    });

    function canRunScanInCurrentVisibility() {
      if (!settingsReady) return false;
      if (engine.settings.backgroundMode) return true;
      if (isBackgroundOrUnfocused(document, window)) return false;
      return true;
    }

    function toggleScopedSetting(key, scope, labelKey) {
      if (!isContextAlive()) return;
      const useChatScope = scope !== 'global' && Boolean(engine.conversationKey) && !engine.isNonChatPage;
      if (useChatScope) {
        const nextVal = !engine.settings[key];
        engine.updateChatOverride({ [key]: nextVal }, true);
        if (key === 'enabled' || key === 'backgroundMode') {
          syncBackgroundKeepaliveLock();
        }
        if (key === 'stallAlertEnabled' && !nextVal) {
          sendToBackground({ type: 'GMAH_STALL_CLEAR' });
        }
        engine.addLog(
          engine.tr('logChatOverrideSet', {
            key: engine.tr(labelKey),
            val: engine.tr(nextVal ? 'stateOn' : 'stateOff')
          })
        );
        engine.emitState();
        return;
      }
      const nextVal = !engine.globalSettings[key];
      engine.updateSettings({ [key]: nextVal }, true);
      if (key === 'enabled' || key === 'backgroundMode') {
        syncBackgroundKeepaliveLock();
      }
      if (key === 'stallAlertEnabled' && !nextVal) {
        sendToBackground({ type: 'GMAH_STALL_CLEAR' });
        sendToBackground({ type: 'GMAH_CLEAR_ALL_STALL_NOTIFICATIONS' });
      }
      if (key === 'enabled') {
        engine.addLog(nextVal ? '▶️ 插件已开启' : '⏸️ 插件已暂停');
      } else if (key === 'backgroundMode') {
        engine.addLog(nextVal ? '🌙 后台静默运行已开启' : '🌙 后台静默运行已关闭');
      } else if (key === 'stallAlertEnabled') {
        engine.addLog(nextVal ? '🔔 桌面通知提醒已开启' : '🔕 桌面通知提醒已关闭');
      } else if (key === 'stallAutoRecoverEnabled') {
        engine.addLog(engine.tr(nextVal ? 'logStallRecoverOn' : 'logStallRecoverOff'));
      }
      engine.emitState();
    }

    if (hudApi && typeof hudApi.createHud === 'function') {
      hud = hudApi.createHud({
        onToggleMinimize: () => {
          if (!isContextAlive()) return;
          engine.updateSettings({ hudMinimized: !engine.globalSettings.hudMinimized }, true);
        },
        onToggleTheme: () => {
          if (!isContextAlive()) return;
          const nextTheme = engine.globalSettings.theme === 'light' ? 'dark' : 'light';
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
          const cur = D.resolveLanguage(engine.globalSettings.language);
          const nextLang = order[(order.indexOf(cur) + 1) % order.length];
          engine.updateSettings({ language: nextLang }, true);
          engine.addLog(`🌐 ${D.t(nextLang, 'toastLangChanged')} (${D.t(nextLang, 'langLabel')})`);
          engine.emitState();
        },
        onToggleEnabled: (scope) => toggleScopedSetting('enabled', scope, 'hudRowMaster'),
        onToggleAllow: (scope) => toggleScopedSetting('autoAllow', scope, 'hudRowAllow'),
        onToggleContinue: (scope) => toggleScopedSetting('autoContinue', scope, 'hudRowContinue'),
        onToggleBackground: (scope) => toggleScopedSetting('backgroundMode', scope, 'hudRowBackground'),
        onToggleNotification: (scope) => toggleScopedSetting('stallAlertEnabled', scope, 'hudRowNotif'),
        onToggleStallRecover: (scope) => toggleScopedSetting('stallAutoRecoverEnabled', scope, 'hudRowStallRecover'),
        onResetChatOverride: () => {
          if (!isContextAlive()) return;
          engine.clearChatOverride(true);
          syncBackgroundKeepaliveLock();
        },
        onForceStallRecover: () => {
          if (!isContextAlive()) return;
          const res = engine.forceStallRecovery();
          scheduleFollowupForResult(res);
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
        },
        onClearLogs: () => {
          if (!isContextAlive()) return;
          engine.clearLogs();
        }
      });
      hud.mount();
    }

    // Load initial persisted settings, per-chat overrides & stats
    if (hasChromeStorage) {
      let settingsInitTimer = setTimeout(() => {
        if (!settingsReady && isContextAlive()) {
          settingsReady = true;
          syncBackgroundKeepaliveLock();
          if (canRunScanInCurrentVisibility()) {
            runScanAndSchedule();
          }
        }
      }, 1500);
      try {
        const chatOverridesKey = D.CHAT_OVERRIDES_KEY || 'gmah_chat_overrides_v1';
        chrome.storage.local.get([D.STORAGE_KEY, D.STATS_KEY, chatOverridesKey], (res) => {
          if (settingsInitTimer) {
            clearTimeout(settingsInitTimer);
            settingsInitTimer = null;
          }
          if (!isContextAlive()) return;
          const migratedRes = D.migrateStoredSettings(res && res[D.STORAGE_KEY]);
          engine.globalSettings = migratedRes.settings;
          engine.chatOverrides =
            typeof D.sanitizeChatOverridesMap === 'function'
              ? D.sanitizeChatOverridesMap(res && res[chatOverridesKey])
              : {};
          engine.recomputeEffectiveSettings();
          engine.refreshLocalizedTexts();
          if (migratedRes.migrated) {
            saveSettings(engine.globalSettings);
          }
          if (res && res[D.STATS_KEY]) {
            engine.stats = D.normalizeStats(res[D.STATS_KEY]);
          }
          const curChatOverride = engine.getCurrentChatOverride();
          if (curChatOverride && curChatOverride.emergencyStopped === true) {
            engine.tripBreaker('emergency_stop', null, 'breakerReasonEmergency');
            engine.addLog(engine.tr('logChatEmergencyRestored'));
          }
          settingsReady = true;
          syncBackgroundKeepaliveLock();
          engine.markExistingContinueCandidatesSeen();
          engine.addLog(engine.tr('logReady'));
          engine.emitState();
        });

        chrome.storage.onChanged.addListener((changes, area) => {
          if (!isContextAlive() || area !== 'local') return;
          if (changes[D.STORAGE_KEY] && changes[D.STORAGE_KEY].newValue) {
            const oldAlert = engine.settings ? engine.settings.stallAlertEnabled : true;
            engine.globalSettings = D.mergeSettings(changes[D.STORAGE_KEY].newValue);
            engine.recomputeEffectiveSettings();
            engine.applyEffectiveSettingsSideEffects(oldAlert);
            if (!engine.settings.enabled || (oldAlert && !engine.settings.stallAlertEnabled)) {
              sendToBackground({ type: 'GMAH_CLEAR_ALL_STALL_NOTIFICATIONS' });
            }
            syncBackgroundKeepaliveLock();
          }
          if (changes[chatOverridesKey]) {
            engine.setChatOverridesMap(changes[chatOverridesKey].newValue || {});
            syncBackgroundKeepaliveLock();
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

    function scheduleFollowupForResult(res) {
      if (!res || !isContextAlive()) return;
      const nextDelay =
        typeof res.retryInMs === 'number' && res.retryInMs > 0
          ? res.retryInMs + 100
          : typeof res.pendingRetryInMs === 'number' && res.pendingRetryInMs > 0
            ? res.pendingRetryInMs + 120
            : 0;
      if (nextDelay <= 0) return;
      if (engine.settings.backgroundMode && isBackgroundOrUnfocused(document, window)) {
        sendToBackground({
          type: 'GMAH_SCHEDULE_TICK',
          delayMs: nextDelay,
          reason: res.reason || res.action || 'bg_followup'
        });
      } else {
        const isRecoverStep =
          (typeof res.action === 'string' && res.action.startsWith('stall_recover_')) ||
          (typeof res.reason === 'string' && res.reason.startsWith('stall_recover_'));
        if (isRecoverStep) {
          scheduleScan(nextDelay);
        }
      }
    }

    function runScanAndSchedule() {
      if (!isContextAlive() || !canRunScanInCurrentVisibility()) return null;
      const res = engine.scanOnce();
      scheduleFollowupForResult(res);
      return res;
    }

    function handleVisibilityChange() {
      if (!isContextAlive()) return;
      if (!bgPort) {
        connectBackgroundPort();
      }
      if (!document.hidden && engine.settings.backgroundMode) {
        // Returning from hidden / screen-off / sleep: re-acquire keepalive lock, refresh port & scan immediately
        syncBackgroundKeepaliveLock();
        forceReconnectBackgroundPort();
        sendToBackground({ type: 'GMAH_TAB_KEEPALIVE' });
      } else if (document.hidden && engine.settings.backgroundMode) {
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
      if (engine.settings.backgroundMode) {
        syncBackgroundKeepaliveLock();
        forceReconnectBackgroundPort();
        sendToBackground({ type: 'GMAH_TAB_KEEPALIVE' });
      } else if (!bgPort) {
        connectBackgroundPort();
      }
      if (canRunScanInCurrentVisibility()) {
        runScanAndSchedule();
      }
    }

    // Chromium Background Tab Freezing Shield: holding a unique per-tab shared Web Lock
    // signals Chrome's PageScheduler not to freeze this Gemini tab while backgroundMode is ON.
    function releaseBackgroundKeepaliveLock() {
      bgLockGeneration += 1;
      bgKeepaliveLockPending = false;
      if (bgKeepaliveLockRelease) {
        const fn = bgKeepaliveLockRelease;
        bgKeepaliveLockRelease = null;
        try { fn(); } catch (_) {}
      }
    }

    function syncBackgroundKeepaliveLock() {
      const shouldHold = Boolean(
        isContextAlive() &&
          engine.settings.enabled &&
          engine.settings.backgroundMode
      );
      if (!shouldHold) {
        releaseBackgroundKeepaliveLock();
        return;
      }
      if (bgKeepaliveLockRelease || bgKeepaliveLockPending) return;
      const nav = typeof navigator !== 'undefined' ? navigator : (window && window.navigator);
      if (!nav || !nav.locks || typeof nav.locks.request !== 'function') return;
      bgKeepaliveLockPending = true;
      const gen = bgLockGeneration;
      try {
        const lockPromise = nav.locks.request(bgLockName, { mode: 'shared' }, () => {
          return new Promise((resolve) => {
            bgKeepaliveLockPending = false;
            if (
              gen !== bgLockGeneration ||
              !isContextAlive() ||
              !engine.settings.enabled ||
              !engine.settings.backgroundMode
            ) {
              resolve();
              return;
            }
            bgKeepaliveLockRelease = resolve;
          });
        });
        if (lockPromise && typeof lockPromise.catch === 'function') {
          lockPromise.catch(() => {
            if (gen === bgLockGeneration) bgKeepaliveLockPending = false;
          });
        }
      } catch (_) {
        if (gen === bgLockGeneration) bgKeepaliveLockPending = false;
      }
    }

    function handlePageFreeze() {
      releaseBackgroundKeepaliveLock();
    }

    function handlePageResume() {
      if (!isContextAlive()) return;
      syncBackgroundKeepaliveLock();
      forceReconnectBackgroundPort();
      if (canRunScanInCurrentVisibility()) {
        runScanAndSchedule();
      }
    }

    function teardownStaleContext() {
      if (contextInvalidated) return;
      contextInvalidated = true;
      releaseBackgroundKeepaliveLock();
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
        document.removeEventListener('freeze', handlePageFreeze);
        document.removeEventListener('resume', handlePageResume);
        window.removeEventListener('blur', handleWindowBlur);
        window.removeEventListener('focus', handleWindowFocus);
        window.removeEventListener('pagehide', handlePageFreeze);
        window.removeEventListener('beforeunload', handlePageFreeze);
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
            characterData: true,
            attributes: true,
            attributeFilter: ['disabled', 'hidden', 'aria-hidden', 'aria-disabled']
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
      if (isBackgroundOrUnfocused(document, window) && engine.settings.backgroundMode) {
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
        let relevantContent = false;
        let relevantAttr = false;
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
            if (m.type === 'attributes') {
              relevantAttr = true;
            } else {
              relevantContent = true;
            }
          }
        }
        if (relevantContent) {
          engine.recordMutation();
          scheduleScan(300);
        } else if (relevantAttr) {
          scheduleScan(200);
        }
      });
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: ['disabled', 'hidden', 'aria-hidden', 'aria-disabled']
      });
      observeShadowTree(document.body);
    }

    // Background Service Worker Port (keeps scanning alive at 1.5s intervals + seamless 4-min rotation)
    let quickReconnectCount = 0;
    let lastQuickReconnectWindowAt = 0;
    let rotatingPort = false;

    function forceReconnectBackgroundPort() {
      if (!isContextAlive()) return;
      if (bgPort) {
        rotatingPort = true;
        const old = bgPort;
        bgPort = null;
        try { old.disconnect(); } catch (_) {}
        rotatingPort = false;
      }
      connectBackgroundPort();
    }

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
            port.__gmahRotating = true;
            if (bgPort === port) {
              bgPort = null;
            }
            try { port.disconnect(); } catch (_) {}
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
          if (port.__gmahRotating || !isContextAlive()) return;
          if (!chrome.runtime || !chrome.runtime.id) {
            teardownStaleContext();
            return;
          }
          const reconnectNow = Date.now();
          if (reconnectNow - lastQuickReconnectWindowAt >= 15000) {
            quickReconnectCount = 0;
            lastQuickReconnectWindowAt = reconnectNow;
          }
          if (isBackgroundOrUnfocused(document, window) && engine.settings.backgroundMode && quickReconnectCount < 3) {
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
          stallAlertActive: Boolean(engine.stallAlertActive),
          breakerTripped: Boolean(engine.circuitBreaker && engine.circuitBreaker.tripped)
        });
      } catch (_) {
        bgPort = null;
        isContextAlive();
      }
    }

    connectBackgroundPort();
    syncBackgroundKeepaliveLock();
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('freeze', handlePageFreeze);
    document.addEventListener('resume', handlePageResume);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('pagehide', handlePageFreeze);
    window.addEventListener('beforeunload', handlePageFreeze);

    // Periodic foreground heartbeat (Service Worker Port + Alarms take over when tab is hidden)
    heartbeatInterval = setInterval(() => {
      if (!isContextAlive()) return;
      syncBackgroundKeepaliveLock();
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
          if (
            !bgPort ||
            msg.source === 'pong_recovery' ||
            msg.source === 'alarm' ||
            msg.source === 'resync' ||
            msg.source === 'keepalive_sync'
          ) {
            forceReconnectBackgroundPort();
          }
          if (canRunScanInCurrentVisibility()) {
            const res = runScanAndSchedule();
            sendResponse({ ok: true, result: res });
          } else {
            sendResponse({ ok: true, skipped: 'background_disabled' });
          }
        } else if (msg.type === 'GMAH_APPLY_SETTINGS' && msg.settings) {
          engine.updateSettings(msg.settings, false);
          syncBackgroundKeepaliveLock();
          if (engine.settings.enabled && engine.settings.backgroundMode && !bgPort) {
            connectBackgroundPort();
          }
          sendResponse({ ok: true, state: engine.getState() });
        } else if (msg.type === 'GMAH_UPDATE_CHAT_OVERRIDE' && msg.override) {
          engine.updateChatOverride(msg.override, true);
          syncBackgroundKeepaliveLock();
          if (engine.settings.enabled && engine.settings.backgroundMode && !bgPort) {
            connectBackgroundPort();
          }
          sendResponse({ ok: true, state: engine.getState() });
        } else if (msg.type === 'GMAH_RESET_CHAT_OVERRIDE') {
          engine.clearChatOverride(true);
          syncBackgroundKeepaliveLock();
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
        } else if (msg.type === 'GMAH_FORCE_STALL_RECOVER') {
          const res = engine.forceStallRecovery();
          scheduleFollowupForResult(res);
          sendResponse({ ok: true, result: res, state: engine.getState() });
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
