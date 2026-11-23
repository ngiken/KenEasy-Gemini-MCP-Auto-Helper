'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '..');
const GEMINI_ORIGIN = 'https://' + 'gemini.google.com';
const D = require('../defaults.js');
const {
  GmahEngine,
  getElementLabel,
  isNoisyMutationTarget,
  isFreshChatLandingUrl,
  resolveClickTarget
} = require('../content.js');
const { createBackgroundController, PORT_ROTATE_MS } = require('../background.js');
const { createHud } = require('../hud.js');
const { createPopupController } = require('../popup.js');

// ---------------------------------------------------------------------------
// Lightweight standards-compliant DOM mock helpers
// ---------------------------------------------------------------------------

function matchSingleSelector(el, sel) {
  const s = sel.trim();
  if (!s || el.nodeType !== 1) return false;
  if (s === '*') return true;
  let rem = s;
  const tagMatch = rem.match(/^([a-zA-Z0-9_-]+)/);
  if (tagMatch) {
    if (el.tagName.toLowerCase() !== tagMatch[1].toLowerCase()) return false;
    rem = rem.slice(tagMatch[0].length);
  }
  while (rem.length > 0) {
    if (rem[0] === '#') {
      const m = rem.match(/^#([a-zA-Z0-9_-]+)/);
      if (!m || el.id !== m[1]) return false;
      rem = rem.slice(m[0].length);
    } else if (rem[0] === '.') {
      const m = rem.match(/^\.([a-zA-Z0-9_-]+)/);
      if (!m) return false;
      const classes = String(el.className || '').split(/\s+/).filter(Boolean);
      if (!classes.includes(m[1])) return false;
      rem = rem.slice(m[0].length);
    } else if (rem[0] === '[') {
      const m = rem.match(/^\[([a-zA-Z0-9_-]+)(?:(\*?=)"([^"]*)"(\s+i)?)?\]/);
      if (!m) return false;
      const actual = el.getAttribute(m[1]);
      if (actual === null || actual === undefined) return false;
      const op = m[2];
      const expected = m[3];
      const ci = Boolean(m[4]);
      if (op === '=') {
        if (ci ? actual.toLowerCase() !== expected.toLowerCase() : actual !== expected) return false;
      } else if (op === '*=') {
        if (ci ? !actual.toLowerCase().includes(expected.toLowerCase()) : !actual.includes(expected)) {
          return false;
        }
      }
      rem = rem.slice(m[0].length);
    } else {
      return false;
    }
  }
  return true;
}

function matchesSelectorList(el, selectorList) {
  return String(selectorList || '').split(',').some((part) => matchSingleSelector(el, part));
}

class MockNode {
  constructor(tagName, ownerDocument, options) {
    const opts = options || {};
    this.nodeType = opts.nodeType || 1;
    this.tagName = (tagName || 'DIV').toUpperCase();
    this.ownerDocument = ownerDocument;
    this.attrs = new Map();
    this.children = [];
    this.parentNode = null;
    this.shadowRoot = null;
    this.host = opts.host || null;
    this.style = Object.assign({ display: '', visibility: '', opacity: '', pointerEvents: '', width: '', height: '', transform: '' }, opts.style || {});
    this.disabled = Boolean(opts.disabled);
    this.hidden = Boolean(opts.hidden);
    this.checked = Boolean(opts.checked);
    this.value = opts.value !== undefined ? String(opts.value) : '';
    this.rect = opts.rect || { left: 100, top: 200, width: 120, height: 36 };
    this._ownText = opts.text || '';
    this._listeners = new Map();
    this.clickCount = 0;
    this.focusCount = 0;
    this.dispatchedEvents = [];

    if (opts.id) this.id = opts.id;
    if (opts.className) this.className = opts.className;
    if (opts.attrs) {
      for (const [k, v] of Object.entries(opts.attrs)) this.setAttribute(k, v);
    }
  }

  get id() { return this.attrs.get('id') || ''; }
  set id(val) { this.attrs.set('id', String(val)); }

  get className() { return this.attrs.get('class') || ''; }
  set className(val) { this.attrs.set('class', String(val)); }

  get classList() {
    const self = this;
    return {
      add(cls) {
        const parts = String(self.className || '').split(/\s+/).filter(Boolean);
        if (!parts.includes(cls)) parts.push(cls);
        self.className = parts.join(' ');
      },
      remove(cls) {
        const parts = String(self.className || '').split(/\s+/).filter((c) => c && c !== cls);
        self.className = parts.join(' ');
      },
      contains(cls) {
        return String(self.className || '').split(/\s+/).includes(cls);
      }
    };
  }

  get parentElement() { return this.parentNode && this.parentNode.nodeType === 1 ? this.parentNode : null; }

  get isConnected() {
    let cur = this;
    while (cur) {
      if (cur === this.ownerDocument.body || cur === this.ownerDocument.documentElement) return true;
      cur = cur.parentNode || cur.host || null;
    }
    return false;
  }

  get textContent() {
    if (this.children.length === 0) return this._ownText;
    return this._ownText + this.children.map((c) => c.textContent).join('');
  }
  set textContent(val) {
    this.children = [];
    this._ownText = String(val);
  }

  get innerText() { return this.textContent; }
  set innerText(val) { this.textContent = val; }

  setAttribute(k, v) { this.attrs.set(String(k), String(v)); }
  getAttribute(k) { return this.attrs.has(String(k)) ? this.attrs.get(String(k)) : null; }

  appendChild(child) {
    if (child.parentNode) child.parentNode.removeChild(child);
    child.parentNode = this;
    child.ownerDocument = this.ownerDocument;
    this.children.push(child);
    return child;
  }

  removeChild(child) {
    const idx = this.children.indexOf(child);
    if (idx >= 0) {
      this.children.splice(idx, 1);
      child.parentNode = null;
    }
    return child;
  }

  remove() {
    if (this.parentNode) this.parentNode.removeChild(this);
  }

  attachShadow() {
    const sr = new MockNode('#shadow-root', this.ownerDocument, { nodeType: 11, host: this });
    this.shadowRoot = sr;
    return sr;
  }

  getRootNode() {
    let cur = this;
    while (cur.parentNode) cur = cur.parentNode;
    return cur;
  }

  contains(target) {
    let cur = target;
    while (cur) {
      if (cur === this) return true;
      cur = cur.parentNode;
    }
    return false;
  }

  getBoundingClientRect() { return this.rect; }

  querySelectorAll(selector) {
    const out = [];
    const walk = (node) => {
      for (const child of node.children) {
        if (matchesSelectorList(child, selector)) out.push(child);
        walk(child);
      }
    };
    walk(this);
    return out;
  }

  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }

  addEventListener(type, fn) {
    if (!this._listeners.has(type)) this._listeners.set(type, []);
    this._listeners.get(type).push(fn);
  }

  removeEventListener(type, fn) {
    const list = this._listeners.get(type) || [];
    const idx = list.indexOf(fn);
    if (idx >= 0) list.splice(idx, 1);
  }

  dispatchEvent(ev) {
    this.dispatchedEvents.push(ev);
    const list = (this._listeners.get(ev.type) || []).slice();
    for (const fn of list) fn(ev);
    return true;
  }

  focus() {
    this.focusCount += 1;
  }

  click() {
    this.clickCount += 1;
    this.dispatchEvent({ type: 'click', target: this });
  }
}

function createEnv(href) {
  const docListeners = new Map();
  const winListeners = new Map();
  const doc = {
    hidden: false,
    _focused: true,
    hasFocus() { return this._focused; },
    createElement(tag, opts) { return new MockNode(tag, doc, opts); },
    getElementById(id) { return doc.body.querySelector(`#${id}`); },
    querySelectorAll(sel) { return doc.body.querySelectorAll(sel); },
    querySelector(sel) { return doc.body.querySelector(sel); },
    addEventListener(type, fn) {
      if (!docListeners.has(type)) docListeners.set(type, []);
      docListeners.get(type).push(fn);
    },
    removeEventListener(type, fn) {
      const list = docListeners.get(type) || [];
      const idx = list.indexOf(fn);
      if (idx >= 0) list.splice(idx, 1);
    },
    dispatchEvent(ev) {
      for (const fn of (docListeners.get(ev.type) || []).slice()) fn(ev);
    }
  };
  doc.documentElement = new MockNode('HTML', doc);
  doc.body = new MockNode('BODY', doc);
  doc.documentElement.appendChild(doc.body);

  const lsStore = new Map();
  const localStorageMock = {
    getItem(k) { return lsStore.has(k) ? lsStore.get(k) : null; },
    setItem(k, v) { lsStore.set(k, String(v)); },
    removeItem(k) { lsStore.delete(k); }
  };

  const parsedUrl = new URL(href || (GEMINI_ORIGIN + '/app/chat-1'));
  const win = {
    location: { href: parsedUrl.href, hostname: parsedUrl.hostname },
    innerWidth: 1440,
    innerHeight: 900,
    localStorage: localStorageMock,
    getComputedStyle(el) { return el.style || {}; },
    PointerEvent: function PointerEvent(type, opts) { return Object.assign({ type }, opts || {}); },
    MouseEvent: function MouseEvent(type, opts) { return Object.assign({ type }, opts || {}); },
    addEventListener(type, fn) {
      if (!winListeners.has(type)) winListeners.set(type, []);
      winListeners.get(type).push(fn);
    },
    removeEventListener(type, fn) {
      const list = winListeners.get(type) || [];
      const idx = list.indexOf(fn);
      if (idx >= 0) list.splice(idx, 1);
    },
    dispatchEvent(ev) {
      for (const fn of (winListeners.get(ev.type) || []).slice()) fn(ev);
    }
  };
  return { doc, win, localStorageMock };
}

function addTurn(doc, text, extraChildren) {
  const turn = doc.createElement('model-response', { text });
  if (Array.isArray(extraChildren)) {
    for (const c of extraChildren) turn.appendChild(c);
  }
  doc.body.appendChild(turn);
  return turn;
}

function runTests(test) {
  // 1. Background SW MV3 keepalive, 4-minute Port rotation, tab/window activation wakeups & smart injection probing
  test('v0.3 background.js keeps MV3 SW alive, rotates 4-min ports, wakes on focus/tab switch, and avoids duplicate injection', () => {
    let clock = 100000;
    const store = {
      [D.STORAGE_KEY]: { enabled: true, backgroundMode: true, preventTabDiscard: true }
    };
    let platformCalls = 0;
    const injectedTabs = [];
    const sentMessages = [];
    let intervalCb = null;
    const timeouts = new Map();
    let nextTid = 1;

    const mockChrome = {
      runtime: {
        lastError: null,
        getPlatformInfo(cb) { platformCalls += 1; if (cb) cb({ os: 'win' }); },
        onConnect: { addListener() {} },
        onMessage: { addListener() {} },
        onInstalled: { addListener() {} },
        onStartup: { addListener() {} }
      },
      storage: {
        local: { get(_k, cb) { cb(Object.assign({}, store)); } },
        onChanged: { addListener() {} }
      },
      tabs: {
        update(_id, _p, cb) { if (cb) cb(); },
        query(_q, cb) {
          cb([
            { id: 10, url: GEMINI_ORIGIN + '/app/a', discarded: false },
            { id: 11, url: GEMINI_ORIGIN + '/app/b', discarded: false }
          ]);
        },
        sendMessage(tabId, msg, cb) {
          sentMessages.push({ tabId, msg });
          if (tabId === 11 && msg.type !== 'GMAH_POST_TEST') {
            mockChrome.runtime.lastError = { message: 'Could not establish connection' };
            if (cb) cb();
            mockChrome.runtime.lastError = null;
          } else {
            mockChrome.runtime.lastError = null;
            if (cb) cb({ ok: true });
          }
        },
        onUpdated: { addListener() {} },
        onRemoved: { addListener() {} },
        onActivated: { addListener() {} }
      },
      windows: {
        onFocusChanged: { addListener() {} }
      },
      scripting: {
        insertCSS(_o, cb) { if (cb) cb(); },
        executeScript(o, cb) { injectedTabs.push(o.target.tabId); if (cb) cb(); }
      },
      alarms: {
        create() {},
        clear() {},
        onAlarm: { addListener() {} }
      }
    };

    const mockTimers = {
      setInterval(fn) { intervalCb = fn; return 1; },
      clearInterval() { intervalCb = null; },
      setTimeout(fn, delay) {
        const id = nextTid++;
        timeouts.set(id, { fn, delay, dueAt: clock + delay });
        return id;
      },
      clearTimeout(id) { timeouts.delete(id); }
    };

    const bg = createBackgroundController(mockChrome, mockTimers, () => clock);
    bg.init();

    // Tab 10 already responded to GMAH_GET_STATE probe -> NOT redundantly injected; Tab 11 failed -> injected once
    assert.deepStrictEqual(injectedTabs, [11]);

    // Connect Port for tab 10
    const port10Msgs = [];
    let port10MsgHandler = null;
    const port10 = {
      name: 'gmah-tab',
      sender: { tab: { id: 10 } },
      postMessage(m) { port10Msgs.push(m); },
      onMessage: { addListener(fn) { port10MsgHandler = fn; } },
      onDisconnect: { addListener() {} }
    };
    bg.handleConnect(port10);

    // 13 heartbeat ticks trigger keepServiceWorkerAlive()
    for (let i = 0; i < 13; i++) {
      clock += 1500;
      intervalCb();
    }
    assert.strictEqual(platformCalls, 1, '13th heartbeat tick must call getPlatformInfo to reset MV3 30s timer');

    // Advance past PORT_ROTATE_MS (4 minutes) -> sends GMAH_ROTATE_PORT proactively
    clock += PORT_ROTATE_MS + 1000;
    intervalCb();
    assert.ok(
      port10Msgs.some((m) => m.type === 'GMAH_ROTATE_PORT'),
      'Must emit GMAH_ROTATE_PORT before Chrome 5-min forced disconnect'
    );

    // Delayed tick scheduling deduplication & execution
    port10MsgHandler({ type: 'GMAH_SCHEDULE_TICK', delayMs: 1900, reason: 'settling' });
    assert.deepStrictEqual(bg.getScheduledTickTabIds(), [10]);
    assert.strictEqual(bg.scheduleDelayedTick(10, 2500, 'later'), true);
    assert.strictEqual(timeouts.size, 1);
    const firstTimer = Array.from(timeouts.values())[0];
    assert.strictEqual(firstTimer.delay, 1900);
    bg.scheduleDelayedTick(10, 400, 'urgent');
    assert.strictEqual(timeouts.size, 1);
    const urgentTimer = Array.from(timeouts.values())[0];
    assert.strictEqual(urgentTimer.delay, 400);

    const beforeScheduledCount = port10Msgs.length;
    urgentTimer.fn();
    assert.strictEqual(port10Msgs.length, beforeScheduledCount + 1);
    assert.strictEqual(port10Msgs[port10Msgs.length - 1].source, 'urgent');

    // Tab switch & window focus change wake up all Gemini tabs immediately
    const beforeWake = port10Msgs.length;
    bg.handleTabActivated();
    bg.handleWindowFocusChanged();
    assert.ok(port10Msgs.length >= beforeWake + 2, 'Tab/window switch must immediately ping connected Gemini tabs');

    // Disabling backgroundMode clears all scheduled ticks
    bg.scheduleDelayedTick(10, 1500, 'pending');
    assert.deepStrictEqual(bg.getScheduledTickTabIds(), [10]);
    bg.handleStorageChanged(
      { [D.STORAGE_KEY]: { newValue: { enabled: true, backgroundMode: false } } },
      'local'
    );
    assert.deepStrictEqual(bg.getScheduledTickTabIds(), []);
  });

  // 2. Minimized window fake-generating hidden spinners must NOT block Auto-Continue
  test('v0.3 minimized window ignores hidden/0px/scale(0)/ng-hide spinners while honoring genuine visible stop button', () => {
    const { doc, win } = createEnv();
    let now = 20000;
    doc.hidden = true;
    win.innerWidth = 0;
    win.innerHeight = 0;

    doc.body.appendChild(doc.createElement('mat-progress-spinner', { style: { opacity: '0' }, rect: { width: 0, height: 0 } }));
    doc.body.appendChild(doc.createElement('mat-progress-bar', { style: { width: '0px', height: '0px' }, rect: { width: 0, height: 0 } }));
    doc.body.appendChild(doc.createElement('div', { className: 'streaming-indicator ng-hide', rect: { width: 0, height: 0 } }));
    doc.body.appendChild(doc.createElement('button', {
      attrs: { 'aria-label': 'Stop generating' },
      style: { transform: 'scale(0)' },
      rect: { width: 0, height: 0 }
    }));

    const contBtn = doc.createElement('button', { text: '继续', rect: { width: 0, height: 0 } });
    addTurn(doc, '已完成第一阶段，准备继续。', [contBtn]);

    const engine = new GmahEngine({ doc, win, now: () => now });
    const res = engine.scanOnce();
    assert.strictEqual(engine.isGenerating, false, 'Hidden/zero-sized spinners must not falsely lock isGenerating');
    assert.strictEqual(res.action, 'clicked_continue');
    assert.strictEqual(contBtn.clickCount, 1);

    const realStop = doc.createElement('button', { attrs: { 'aria-label': 'Stop generating' }, rect: { width: 0, height: 0 } });
    doc.body.appendChild(realStop);
    const contBtn2 = doc.createElement('button', { text: '继续', rect: { width: 0, height: 0 } });
    addTurn(doc, '第二阶段输出中...', [contBtn2]);
    now += 5000;
    const res2 = engine.scanOnce();
    assert.strictEqual(engine.isGenerating, true);
    assert.strictEqual(res2.action, 'wait');
    assert.strictEqual(res2.reason, 'generating');
    assert.strictEqual(contBtn2.clickCount, 0);
  });

  // 3. Background click retry for Allow & Continue + Shadow DOM piercing on attempt 2
  test('v0.3 background click failure auto-retries once with Shadow DOM piercing and without tripping stagnant breaker', () => {
    const { doc, win } = createEnv();
    let now = 50000;
    doc.hidden = true;

    // Real @material/web <md-filled-button> structure: internal shadow <button> is an empty overlay sibling of <span class="label">
    const mwcAllow = doc.createElement('md-filled-button', { text: '始终允许' });
    const sr = mwcAllow.attachShadow();
    const innerBtn = doc.createElement('button', { className: 'button', rect: { left: 40, top: 80, width: 100, height: 32 } });
    sr.appendChild(innerBtn);
    const singleBtn = doc.createElement('button', { text: '允许一次' });
    const dialog = doc.createElement('div', { className: 'mcp-dialog' });
    dialog.appendChild(mwcAllow);
    dialog.appendChild(singleBtn);
    doc.body.appendChild(dialog);

    const engine = new GmahEngine({ doc, win, now: () => now });

    const r1 = engine.scanOnce();
    assert.strictEqual(r1.action, 'clicked_allow');
    assert.strictEqual(r1.pendingRetryInMs, 2500);
    assert.strictEqual(mwcAllow.clickCount, 1);
    assert.strictEqual(innerBtn.clickCount, 0);
    assert.strictEqual(singleBtn.clickCount, 0);
    assert.strictEqual(engine.stats.allowCount, 1);

    now += 1500;
    assert.strictEqual(engine.scanOnce().action, 'noop');
    assert.strictEqual(singleBtn.clickCount, 0);

    now += 1200;
    const rRetry = engine.scanOnce();
    assert.strictEqual(rRetry.action, 'retried_allow');
    assert.strictEqual(rRetry.attempt, 2);
    assert.strictEqual(innerBtn.clickCount, 1, 'Attempt 2 must pierce MWC ShadowRoot and click inner native <button>');
    assert.strictEqual(innerBtn.focusCount, 1, 'Attempt 2 must safely focus target before click');
    assert.ok(innerBtn.dispatchedEvents.some((ev) => ev.type === 'pointerdown' && ev.clientX === 90 && ev.clientY === 96));
    assert.strictEqual(singleBtn.clickCount, 0, 'Must never fall back to sibling Allow Once');
    assert.strictEqual(engine.stats.allowCount, 1, 'Retry must not double-count stats.allowCount');

    now += 5000;
    assert.strictEqual(engine.scanOnce().action, 'noop');
    assert.strictEqual(innerBtn.clickCount, 1);

    dialog.remove();
    const contBtn = doc.createElement('button', { text: '继续' });
    addTurn(doc, '第一步输出内容', [contBtn]);

    now += 5000;
    const rc1 = engine.scanOnce();
    assert.strictEqual(rc1.action, 'clicked_continue');
    assert.strictEqual(rc1.pendingRetryInMs, 3500);
    assert.strictEqual(contBtn.clickCount, 1);
    assert.strictEqual(engine.taskContinueCount, 1);

    now += 3600;
    const rcRetry = engine.scanOnce();
    assert.strictEqual(rcRetry.action, 'retried_continue');
    assert.strictEqual(rcRetry.attempt, 2);
    assert.strictEqual(contBtn.clickCount, 2);
    assert.strictEqual(engine.taskContinueCount, 1);
    assert.strictEqual(engine.circuitBreaker.tripped, false);

    assert.strictEqual(resolveClickTarget(mwcAllow, 1), mwcAllow);
    assert.strictEqual(resolveClickTarget(mwcAllow, 2), innerBtn);
  });

  // 4. Fresh /app -> /app/<chatId> creation does not suppress first Continue, while switching chats still guards stale chips
  test('v0.3 /app to /app/<id> new chat transition allows first Continue while old-to-old chat switch guards stale chips', () => {
    assert.strictEqual(isFreshChatLandingUrl(GEMINI_ORIGIN + '/app'), true);
    assert.strictEqual(isFreshChatLandingUrl(GEMINI_ORIGIN + '/u/1/app/'), true);
    assert.strictEqual(isFreshChatLandingUrl(GEMINI_ORIGIN + '/app/abc123'), false);

    const { doc, win } = createEnv(GEMINI_ORIGIN + '/app');
    let now = 80000;
    const engine = new GmahEngine({
      doc,
      win,
      now: () => now,
      ignoreStaleInitialContinue: true
    });

    win.location.href = GEMINI_ORIGIN + '/app/new-chat-1';
    const firstCont = doc.createElement('button', { text: '继续' });
    addTurn(doc, '新对话第一轮输出，准备下一步。', [firstCont]);

    now += 500;
    const rNew = engine.scanOnce();
    assert.strictEqual(rNew.action, 'clicked_continue', 'Brand-new /app -> /app/<id> chat must NOT suppress first continue');
    assert.strictEqual(firstCont.clickCount, 1);

    firstCont.remove();
    win.location.href = GEMINI_ORIGIN + '/app/old-chat-2';
    const staleChip = doc.createElement('button', { className: 'follow-up-chip', text: '↪ Yes' });
    addTurn(doc, '昨天的旧对话内容，要继续吗？', [staleChip]);
    now += 500;
    const rOld = engine.scanOnce();
    assert.strictEqual(rOld.action, 'noop');
    assert.strictEqual(rOld.reason, 'initial_stale_continue_ignored');
    assert.strictEqual(staleChip.clickCount, 0);
  });

  // 5. Split inline <span> label spacing, explicit continue-generating override, noisy mutation filter & 4-lang live status
  test('v0.3 handles split inline spans, explicit continue-generating override, noisy mutations, and live 4-language status', () => {
    const { doc, win } = createEnv();
    let now = 90000;

    const splitEn = doc.createElement('button');
    splitEn.appendChild(doc.createElement('span', { text: 'Always' }));
    splitEn.appendChild(doc.createElement('span', { text: 'allow' }));
    assert.strictEqual(getElementLabel(splitEn), 'Always allow');

    const splitZh = doc.createElement('button');
    splitZh.appendChild(doc.createElement('span', { text: '始终' }));
    splitZh.appendChild(doc.createElement('span', { text: '允许' }));
    assert.strictEqual(getElementLabel(splitZh), '始终允许');

    const ripple = doc.createElement('span', { className: 'mat-mdc-ripple-element' });
    const tooltip = doc.createElement('div', { attrs: { role: 'tooltip' }, text: 'Copy' });
    const realText = doc.createElement('p', { text: 'Hello' });
    assert.strictEqual(isNoisyMutationTarget(ripple), true);
    assert.strictEqual(isNoisyMutationTarget(tooltip), true);
    assert.strictEqual(isNoisyMutationTarget(realText), false);

    const contGenBtn = doc.createElement('button', { text: '继续生成' });
    addTurn(doc, '阶段一全部测试通过，但代码尚未输出完毕。', [contGenBtn]);

    const engine = new GmahEngine({
      doc,
      win,
      now: () => now,
      settings: { language: 'en' }
    });
    assert.strictEqual(engine.lastStatusText, 'Monitoring');

    const res = engine.scanOnce();
    assert.strictEqual(res.action, 'clicked_continue');
    assert.ok(engine.lastStatusText.includes('Clicked Continue'), `Expected English status, got: ${engine.lastStatusText}`);

    engine.updateSettings({ language: 'zh-TW' });
    assert.ok(engine.lastStatusText.includes('已點擊繼續'));

    engine.emergencyStop();
    assert.ok(engine.circuitBreaker.reason.includes('使用者手動緊急停止'));
    engine.updateSettings({ language: 'ja' });
    assert.ok(engine.circuitBreaker.reason.includes('手動緊急停止'));
    assert.ok(engine.lastStatusText.includes('遮断:'));
  });

  // 6. HUD minimized 0x0 viewport guard, expand/panel clamping, duplicate event dedupe, and render skip
  test('v0.3 HUD ignores 0x0 minimized resize, re-clamps on expand/panel open, and deduplicates bubbling drag events', () => {
    const { doc, win, localStorageMock } = createEnv();
    const prevDoc = global.document;
    const prevWin = global.window;
    const prevLs = global.localStorage;
    global.document = doc;
    global.window = win;
    global.localStorage = localStorageMock;

    try {
      const hud = createHud({ initialPosition: { left: 1100, top: 820 } });
      const rootEl = hud.mount();
      rootEl.rect = { width: 262, height: 48 };
      hud.setPosition({ left: 1100, top: 820 });
      assert.strictEqual(rootEl.style.left, '1100px');
      assert.strictEqual(rootEl.style.top, '820px');

      // Windows minimizes Chrome -> innerWidth = 0, innerHeight = 0 + resize event
      win.innerWidth = 0;
      win.innerHeight = 0;
      win.dispatchEvent({ type: 'resize' });
      assert.strictEqual(rootEl.style.left, '1100px', 'Minimized 0x0 resize must NOT snap HUD to left=0');
      assert.strictEqual(rootEl.style.top, '820px', 'Minimized 0x0 resize must NOT snap HUD to top=0');

      // Restore window and expand HUD -> taller rect (height=320) must clamp top to 900 - 320 = 580
      win.innerWidth = 1440;
      win.innerHeight = 900;
      const engine = new GmahEngine({ doc, win, settings: { hudMinimized: true } });
      hud.update(engine.getState());
      rootEl.rect = { width: 262, height: 320 };
      engine.updateSettings({ hudMinimized: false });
      hud.update(engine.getState());
      assert.strictEqual(rootEl.style.top, '580px', 'Expanding HUD near bottom edge must re-clamp inside viewport');

      // Opening logs panel makes HUD even taller (height=480) -> clamps top to 900 - 480 = 420
      rootEl.rect = { width: 262, height: 480 };
      hud.setActivePanel('logs');
      assert.strictEqual(rootEl.style.top, '420px', 'Opening panel near bottom edge must re-clamp inside viewport');

      // Duplicate bubbling pointermove event object is ignored cleanly
      const header = rootEl.querySelector('.gmah-header');
      hud.setPosition({ left: 300, top: 200 });
      header.dispatchEvent({ type: 'pointerdown', clientX: 100, clientY: 100, button: 0, target: header });
      const sharedMoveEv = { type: 'pointermove', clientX: 160, clientY: 140, buttons: 1 };
      header.dispatchEvent(sharedMoveEv);
      doc.dispatchEvent(sharedMoveEv);
      assert.strictEqual(rootEl.style.left, '360px');
      assert.strictEqual(rootEl.style.top, '240px');
      const sharedUpEv = { type: 'pointerup', clientX: 160, clientY: 140 };
      header.dispatchEvent(sharedUpEv);
      doc.dispatchEvent(sharedUpEv);

      hud.unmount();
    } finally {
      global.document = prevDoc;
      global.window = prevWin;
      global.localStorage = prevLs;
    }
  });

  // 7. Popup auto-saves numeric/keyword edits and sends GMAH_APPLY_SETTINGS to reconcile tripped breaker immediately
  test('v0.3 popup auto-saves numeric fields and immediately clears tripped task_limit via GMAH_APPLY_SETTINGS', () => {
    const popupEnv = createEnv('chrome-extension://test/popup.html');
    const pdoc = popupEnv.doc;
    const ids = [
      'enabled', 'autoAllow', 'preferAlwaysAllow', 'fallbackSingleAllow',
      'autoContinue', 'backgroundMode', 'preventTabDiscard', 'showHud',
      'maxContinuesPerTask', 'dailyContinueLimit', 'continueCooldownSec', 'idleSettleSec',
      'stopOnCompletionCues', 'stopOnStagnantOutput', 'stopOnQuotaOrError',
      'stallAlertEnabled', 'stallAlertMinutes', 'btnToggleNotif', 'btnTestNotif',
      'language', 'btnToggleTheme', 'btnResetHudPos',
      'customAlwaysAllowKeywords', 'customContinueKeywords',
      'statAllow', 'statContinue', 'statLive',
      'btnEmergency', 'btnResetBreaker', 'btnResetStats', 'btnDefaults', 'btnSave', 'toast'
    ];
    for (const id of ids) {
      pdoc.body.appendChild(pdoc.createElement('input', { id }));
    }

    const tabEnv = createEnv(GEMINI_ORIGIN + '/app/live-chat');
    const tabEngine = new GmahEngine({
      doc: tabEnv.doc,
      win: tabEnv.win,
      settings: { maxContinuesPerTask: 2 }
    });
    tabEngine.taskContinueCount = 2;
    tabEngine.tripBreaker('task_limit', null, 'breakerReasonTaskLimit', { task: 2, max: 2 });
    assert.strictEqual(tabEngine.circuitBreaker.tripped, true);

    const storageState = {
      [D.STORAGE_KEY]: D.mergeSettings({ maxContinuesPerTask: 2 }),
      [D.STATS_KEY]: { date: D.getTodayKey(), allowCount: 0, continueCount: 2 }
    };
    const tabMessages = [];

    const mockChrome = {
      runtime: { lastError: null, sendMessage() {} },
      storage: {
        local: {
          get(_k, cb) { cb(Object.assign({}, storageState)); },
          set(obj, cb) { Object.assign(storageState, obj); if (cb) cb(); }
        }
      },
      tabs: {
        query(_q, cb) { cb([{ id: 7, active: true }]); },
        sendMessage(_tabId, msg, cb) {
          tabMessages.push(msg);
          if (msg.type === 'GMAH_APPLY_SETTINGS') {
            tabEngine.updateSettings(msg.settings, false);
          }
          cb({ ok: true, state: tabEngine.getState() });
        }
      }
    };

    const popup = createPopupController(pdoc, mockChrome);
    popup.init();
    assert.strictEqual(pdoc.getElementById('statLive').textContent, '已熔断');

    const maxInput = pdoc.getElementById('maxContinuesPerTask');
    maxInput.value = '15';
    maxInput.dispatchEvent({ type: 'change', target: maxInput });

    assert.strictEqual(storageState[D.STORAGE_KEY].maxContinuesPerTask, 15);
    assert.ok(tabMessages.some((m) => m.type === 'GMAH_APPLY_SETTINGS'));
    assert.strictEqual(tabEngine.circuitBreaker.tripped, false, 'Raising limit must reconcile & clear task_limit immediately');
    assert.strictEqual(pdoc.getElementById('statLive').textContent, '后台就绪');
  });

  // 8. Full End-to-End VM Sandbox: real content.js bootstrap + real background.js SW communicating across hidden/throttled tab
  test('v0.3 E2E VM sandbox: real background.js + content.js complete Shadow DOM Allow, delayed BG settling Continue, and Port rotation while tab is hidden', () => {
    let clock = 500000;
    const swTimers = new Map();
    let swTimerSeq = 1;
    let swIntervalFn = null;

    const storageData = {
      [D.STORAGE_KEY]: D.mergeSettings({
        enabled: true,
        backgroundMode: true,
        autoAllow: true,
        autoContinue: true,
        idleSettleMs: 1800,
        continueCooldownMs: 4000
      }),
      [D.STATS_KEY]: D.createEmptyStats(D.getTodayKey(new Date(clock)))
    };

    const contentEnv = createEnv(GEMINI_ORIGIN + '/app/e2e-bg');
    contentEnv.doc.hidden = true;
    contentEnv.doc._focused = false;
    contentEnv.win.innerWidth = 0;
    contentEnv.win.innerHeight = 0;

    const swListeners = { onConnect: [], onMessage: [], onAlarm: [], onStorage: [] };
    const tabListeners = { onMessage: [], onStorage: [] };
    const activePorts = [];

    const cloneStorage = (obj) => JSON.parse(JSON.stringify(obj));

    const swChrome = {
      runtime: {
        id: 'gmah-e2e-ext',
        lastError: null,
        getPlatformInfo(cb) { if (cb) cb({ os: 'win' }); },
        onConnect: { addListener(fn) { swListeners.onConnect.push(fn); } },
        onMessage: { addListener(fn) { swListeners.onMessage.push(fn); } },
        onInstalled: { addListener() {} },
        onStartup: { addListener() {} }
      },
      storage: {
        local: {
          get(_k, cb) { cb(cloneStorage(storageData)); },
          set(obj, cb) { Object.assign(storageData, cloneStorage(obj)); if (cb) cb(); }
        },
        onChanged: { addListener(fn) { swListeners.onStorage.push(fn); } }
      },
      tabs: {
        update(_id, _p, cb) { if (cb) cb(); },
        query(_q, cb) { cb([{ id: 101, url: contentEnv.win.location.href, discarded: false }]); },
        sendMessage(_tabId, msg, cb) {
          let responded = false;
          for (const fn of tabListeners.onMessage) {
            fn(msg, {}, (resp) => { responded = true; if (cb) cb(resp); });
          }
          if (!responded && cb) cb();
        },
        onUpdated: { addListener() {} },
        onRemoved: { addListener() {} },
        onActivated: { addListener() {} }
      },
      windows: { onFocusChanged: { addListener() {} } },
      alarms: {
        create() {},
        clear() {},
        onAlarm: { addListener(fn) { swListeners.onAlarm.push(fn); } }
      },
      notifications: { create() {}, clear() {}, onClicked: { addListener() {} } },
      action: { setBadgeText() {}, setBadgeBackgroundColor() {} }
    };

    const bg = createBackgroundController(
      swChrome,
      {
        setInterval(fn) { swIntervalFn = fn; return 1; },
        clearInterval() { swIntervalFn = null; },
        setTimeout(fn, delay) {
          const id = swTimerSeq++;
          swTimers.set(id, { fn, dueAt: clock + delay });
          return id;
        },
        clearTimeout(id) { swTimers.delete(id); }
      },
      () => clock
    );
    bg.init();

    const tabChrome = {
      runtime: {
        id: 'gmah-e2e-ext',
        lastError: null,
        connect(opts) {
          const clientMsgListeners = [];
          const clientDiscListeners = [];
          const swMsgListeners = [];
          const swDiscListeners = [];
          let closed = false;

          const clientPort = {
            name: opts.name,
            postMessage(m) {
              if (closed) throw new Error('Port closed');
              for (const fn of swMsgListeners.slice()) fn(m);
            },
            disconnect() {
              if (closed) return;
              closed = true;
              for (const fn of swDiscListeners.slice()) fn();
            },
            onMessage: { addListener(fn) { clientMsgListeners.push(fn); } },
            onDisconnect: { addListener(fn) { clientDiscListeners.push(fn); } }
          };

          const serverPort = {
            name: opts.name,
            sender: { tab: { id: 101 } },
            postMessage(m) {
              if (closed) throw new Error('Port closed');
              for (const fn of clientMsgListeners.slice()) fn(m);
            },
            disconnect() {
              if (closed) return;
              closed = true;
              for (const fn of clientDiscListeners.slice()) fn();
            },
            onMessage: { addListener(fn) { swMsgListeners.push(fn); } },
            onDisconnect: { addListener(fn) { swDiscListeners.push(fn); } }
          };

          activePorts.push({ clientPort, serverPort });
          for (const fn of swListeners.onConnect) fn(serverPort);
          return clientPort;
        },
        sendMessage(msg, cb) {
          for (const fn of swListeners.onMessage) {
            fn(msg, { tab: { id: 101 } }, (resp) => { if (cb) cb(resp); });
          }
        },
        onMessage: { addListener(fn) { tabListeners.onMessage.push(fn); } }
      },
      storage: {
        local: {
          get(_k, cb) { cb(cloneStorage(storageData)); },
          set(obj, cb) { Object.assign(storageData, cloneStorage(obj)); if (cb) cb(); }
        },
        onChanged: { addListener(fn) { tabListeners.onStorage.push(fn); } }
      }
    };

    const observedTargets = [];
    let moCallback = null;
    class MockMutationObserver {
      constructor(cb) { moCallback = cb; }
      observe(target) { observedTargets.push(target); }
      disconnect() {}
    }

    const microtasks = [];
    const FakeDate = class extends Date {
      constructor(...args) { super(...(args.length === 0 ? [clock] : args)); }
      static now() { return clock; }
    };

    const sandbox = {
      window: contentEnv.win,
      document: contentEnv.doc,
      localStorage: contentEnv.localStorageMock,
      chrome: tabChrome,
      MutationObserver: MockMutationObserver,
      Date: FakeDate,
      Promise: { resolve: () => ({ then(fn) { microtasks.push(fn); } }) },
      setTimeout: () => 999, // Deliberately frozen/throttled in hidden tab!
      clearTimeout: () => {},
      setInterval: () => 999, // Deliberately frozen/throttled in hidden tab!
      clearInterval: () => {},
      WeakSet,
      Set,
      Map,
      URL,
      console
    };
    sandbox.globalThis = sandbox;
    sandbox.self = sandbox;

    const runScript = (rel) => {
      const code = fs.readFileSync(path.join(ROOT, rel), 'utf8');
      vm.runInNewContext(code, sandbox, { filename: rel });
    };
    runScript('defaults.js');
    runScript('hud.js');
    runScript('content.js');

    const flushMicrotasks = () => {
      while (microtasks.length > 0) {
        const fn = microtasks.shift();
        fn();
      }
    };
    const advanceClockAndFlushSwTimers = (ms) => {
      clock += ms;
      for (const [id, entry] of Array.from(swTimers.entries())) {
        if (entry.dueAt <= clock) {
          swTimers.delete(id);
          entry.fn();
        }
      }
      flushMicrotasks();
    };

    // Content script connected Port to SW and started SW heartbeat
    assert.deepStrictEqual(bg.getConnectedTabIds(), [101]);
    assert.strictEqual(bg.isHeartbeatRunning(), true);

    // Step 1: Gemini inserts a Shadow DOM MCP approval dialog while tab is hidden/minimized
    const shadowHost = contentEnv.doc.createElement('mcp-approval-card');
    const sr = shadowHost.attachShadow();
    const allowBtn = contentEnv.doc.createElement('button', { text: '始终允许', rect: { width: 0, height: 0 } });
    sr.appendChild(allowBtn);
    contentEnv.doc.body.appendChild(shadowHost);

    moCallback([{ target: contentEnv.doc.body, addedNodes: [shadowHost] }]);
    flushMicrotasks();
    assert.ok(observedTargets.includes(sr), 'MutationObserver must automatically attach to newly added ShadowRoots');
    assert.strictEqual(allowBtn.clickCount, 1, 'MCP Always Allow inside ShadowRoot must click immediately while hidden');

    // Step 2: Another tab increments allowCount in storage; next click merges cleanly without clobbering
    storageData[D.STATS_KEY].allowCount = 5;
    shadowHost.remove();
    const contBtn = contentEnv.doc.createElement('button', { text: '继续', rect: { width: 0, height: 0 } });
    const turn = addTurn(contentEnv.doc, '阶段任务已完成一半，点击继续。', [contBtn]);
    clock += 300;
    moCallback([{ target: turn, addedNodes: [contBtn] }]);
    flushMicrotasks();

    assert.strictEqual(contBtn.clickCount, 0);
    assert.deepStrictEqual(bg.getScheduledTickTabIds(), [101], 'Content script must schedule unthrottled SW tick for settling');

    advanceClockAndFlushSwTimers(2000);
    assert.strictEqual(contBtn.clickCount, 1, 'SW delayed tick must trigger Continue click after settle in hidden tab');
    assert.strictEqual(storageData[D.STATS_KEY].allowCount, 5, 'Delta stats merge must preserve other tabs allowCount');
    assert.strictEqual(storageData[D.STATS_KEY].continueCount, 1);

    // Step 3: 4 minutes pass -> SW heartbeat rotates the port seamlessly before Chrome 5-min disconnect
    const initialPortsCount = activePorts.length;
    clock += PORT_ROTATE_MS + 1000;
    swIntervalFn();
    assert.strictEqual(activePorts.length, initialPortsCount + 1, 'Port must seamlessly rotate after 4 minutes');
    assert.deepStrictEqual(bg.getConnectedTabIds(), [101], 'Tab 101 must remain connected after port rotation');
  });

  // 9. Full End-to-End VM Sandbox: real background.js + content.js + hud.js complete BOTH 5-min auto stall recovery AND immediate HUD "立即续接" click
  test('v0.3 E2E VM sandbox: Desktop Commander 5-min stall auto-recovery & HUD "立即续接" button work end-to-end across SW + Content + HUD', () => {
    let clock = 900000;
    const swTimers = new Map();
    const tabTimers = new Map();
    let timerSeq = 1;
    let swIntervalFn = null;
    let tabHeartbeatFn = null;

    const storageData = {
      [D.STORAGE_KEY]: D.mergeSettings({
        enabled: true,
        backgroundMode: true,
        showHud: true,
        stallAlertEnabled: true,
        stallAlertMinutes: 5,
        stallAutoRecoverEnabled: true,
        stallAutoRecoverMinutes: 5,
        stallAutoRecoverPrompt: '继续',
        maxStallRecoveriesPerTask: 3
      }),
      [D.STATS_KEY]: D.createEmptyStats(D.getTodayKey(new Date(clock)))
    };

    const contentEnv = createEnv(GEMINI_ORIGIN + '/app/e2e-stall-dc');
    contentEnv.doc.hidden = true;
    contentEnv.doc._focused = false;
    contentEnv.win.innerWidth = 1280;
    contentEnv.win.innerHeight = 800;

    const swListeners = { onConnect: [], onMessage: [], onAlarm: [], onStorage: [] };
    const tabListeners = { onMessage: [], onStorage: [] };
    const clone = (o) => JSON.parse(JSON.stringify(o));

    const swChrome = {
      runtime: {
        id: 'e2e-stall-id',
        lastError: null,
        getPlatformInfo(cb) { if (cb) cb({ os: 'win' }); },
        onConnect: { addListener(fn) { swListeners.onConnect.push(fn); } },
        onMessage: { addListener(fn) { swListeners.onMessage.push(fn); } },
        onInstalled: { addListener() {} },
        onStartup: { addListener() {} }
      },
      storage: {
        local: {
          get(_k, cb) { cb(clone(storageData)); },
          set(obj, cb) { Object.assign(storageData, clone(obj)); if (cb) cb(); }
        },
        onChanged: { addListener(fn) { swListeners.onStorage.push(fn); } }
      },
      tabs: {
        update(_id, _p, cb) { if (cb) cb(); },
        query(_q, cb) { cb([{ id: 301, url: contentEnv.win.location.href, discarded: false }]); },
        sendMessage(_tabId, msg, cb) {
          let responded = false;
          for (const fn of tabListeners.onMessage) {
            fn(msg, {}, (resp) => { responded = true; if (cb) cb(resp); });
          }
          if (!responded && cb) cb();
        },
        onUpdated: { addListener() {} },
        onRemoved: { addListener() {} },
        onActivated: { addListener() {} }
      },
      windows: { onFocusChanged: { addListener() {} } },
      alarms: { create() {}, clear() {}, onAlarm: { addListener(fn) { swListeners.onAlarm.push(fn); } } },
      notifications: { create() {}, clear() {}, onClicked: { addListener() {} } },
      action: { setBadgeText() {}, setBadgeBackgroundColor() {} }
    };

    const bg = createBackgroundController(
      swChrome,
      {
        setInterval(fn) { swIntervalFn = fn; return 1; },
        clearInterval() { swIntervalFn = null; },
        setTimeout(fn, delay) {
          const id = timerSeq++;
          swTimers.set(id, { fn, dueAt: clock + delay });
          return id;
        },
        clearTimeout(id) { swTimers.delete(id); }
      },
      () => clock
    );
    bg.init();

    const tabChrome = {
      runtime: {
        id: 'e2e-stall-id',
        lastError: null,
        connect(opts) {
          const cMsg = [];
          const cDisc = [];
          const sMsg = [];
          const sDisc = [];
          let closed = false;
          const clientPort = {
            name: opts.name,
            postMessage(m) { if (closed) throw new Error('closed'); for (const fn of sMsg.slice()) fn(m); },
            disconnect() { if (closed) return; closed = true; for (const fn of sDisc.slice()) fn(); },
            onMessage: { addListener(fn) { cMsg.push(fn); } },
            onDisconnect: { addListener(fn) { cDisc.push(fn); } }
          };
          const serverPort = {
            name: opts.name,
            sender: { tab: { id: 301 } },
            postMessage(m) { if (closed) throw new Error('closed'); for (const fn of cMsg.slice()) fn(m); },
            disconnect() { if (closed) return; closed = true; for (const fn of cDisc.slice()) fn(); },
            onMessage: { addListener(fn) { sMsg.push(fn); } },
            onDisconnect: { addListener(fn) { sDisc.push(fn); } }
          };
          for (const fn of swListeners.onConnect) fn(serverPort);
          return clientPort;
        },
        sendMessage(msg, cb) {
          for (const fn of swListeners.onMessage) {
            fn(msg, { tab: { id: 301 } }, (resp) => { if (cb) cb(resp); });
          }
        },
        onMessage: { addListener(fn) { tabListeners.onMessage.push(fn); } }
      },
      storage: {
        local: {
          get(_k, cb) { cb(clone(storageData)); },
          set(obj, cb) { Object.assign(storageData, clone(obj)); if (cb) cb(); }
        },
        onChanged: { addListener(fn) { tabListeners.onStorage.push(fn); } }
      }
    };

    const FakeDate = class extends Date {
      constructor(...args) { super(...(args.length === 0 ? [clock] : args)); }
      static now() { return clock; }
    };

    const sandbox = {
      window: contentEnv.win,
      document: contentEnv.doc,
      localStorage: contentEnv.localStorageMock,
      chrome: tabChrome,
      Date: FakeDate,
      MutationObserver: class { observe() {} disconnect() {} },
      setTimeout: (fn, delay) => {
        const id = timerSeq++;
        tabTimers.set(id, { fn, dueAt: clock + (delay || 0) });
        return id;
      },
      clearTimeout: (id) => { tabTimers.delete(id); },
      setInterval: (fn) => { tabHeartbeatFn = fn; return 1; },
      clearInterval: () => { tabHeartbeatFn = null; },
      WeakSet,
      Set,
      Map,
      URL,
      console
    };
    sandbox.globalThis = sandbox;
    sandbox.self = sandbox;

    for (const rel of ['defaults.js', 'hud.js', 'content.js']) {
      vm.runInNewContext(fs.readFileSync(path.join(ROOT, rel), 'utf8'), sandbox, { filename: rel });
    }

    const flushTimers = (ms) => {
      clock += ms;
      for (const [id, entry] of Array.from(swTimers.entries())) {
        if (entry.dueAt <= clock) { swTimers.delete(id); entry.fn(); }
      }
      for (const [id, entry] of Array.from(tabTimers.entries())) {
        if (entry.dueAt <= clock) { tabTimers.delete(id); entry.fn(); }
      }
    };

    // Build realistic Gemini page with Desktop Commander connecting, Stop button, Quill editor, Send button
    const connSpan = contentEnv.doc.createElement('span', { text: '正在连接 Desktop Commander (5s)...' });
    addTurn(contentEnv.doc, '', [connSpan]);

    const mountStopBtn = () => {
      const b = contentEnv.doc.createElement('button', {
        className: 'send-button stop',
        attrs: { 'aria-label': '停止回复' }
      });
      b.addEventListener('click', () => { b.remove(); connSpan.remove(); });
      contentEnv.doc.body.appendChild(b);
      return b;
    };

    const richTextarea = contentEnv.doc.createElement('rich-textarea');
    const editor = contentEnv.doc.createElement('div', {
      className: 'ql-editor ql-blank',
      attrs: { contenteditable: 'true', role: 'textbox', 'aria-label': '输入提示' }
    });
    richTextarea.appendChild(editor);
    contentEnv.doc.body.appendChild(richTextarea);

    const sendBtn = contentEnv.doc.createElement('button', {
      className: 'send-button',
      attrs: { 'aria-label': '发送消息' },
      disabled: true
    });
    editor.addEventListener('input', () => { sendBtn.disabled = false; });
    sendBtn.addEventListener('click', () => { editor.textContent = ''; sendBtn.disabled = true; });
    contentEnv.doc.body.appendChild(sendBtn);

    // Scenario A: Hidden background tab stuck on Desktop Commander for 5 minutes -> SW drives full Stop -> Fill "继续" -> Send!
    const stopBtn1 = mountStopBtn();
    swIntervalFn(); // t = 0: starts tracking
    clock += 2 * 60 * 1000 + 30 * 1000; // t = 2m30s
    swIntervalFn();
    const hudEl = contentEnv.doc.getElementById('gmah-hud');
    assert.ok(hudEl, 'HUD must be mounted');
    const waitBar = hudEl.querySelector('.gmah-wait-bar');
    assert.ok(waitBar && waitBar.textContent.includes('2分30秒'), `HUD wait bar must show 2分30秒, got: "${waitBar && waitBar.textContent}"`);
    assert.ok(waitBar.textContent.includes('Desktop Commander'));
    assert.strictEqual(stopBtn1.clickCount, 0);

    clock += 2 * 60 * 1000 + 30 * 1000; // t = 5m00s
    swIntervalFn();
    assert.strictEqual(stopBtn1.clickCount, 1, 'SW heartbeat at 5m00s must click Stop');
    assert.deepStrictEqual(bg.getScheduledTickTabIds(), [301], 'Must schedule SW follow-up tick after Stop');

    // Step through human-paced recovery in 250ms ticks: must NOT rush Send within 1.5s, must finish cleanly within 7s
    const pumpTimers = (totalMs, stepMs) => {
      const steps = Math.ceil(totalMs / stepMs);
      for (let i = 0; i < steps; i++) {
        flushTimers(stepMs);
      }
    };

    pumpTimers(1500, 250);
    assert.strictEqual(sendBtn.clickCount, 0, 'Human pacing must NOT rush Send immediately after Stop');

    pumpTimers(5500, 250);
    assert.strictEqual(sendBtn.clickCount, 1, 'SW human-paced ticks must complete Stop -> Type -> Pause -> Send');
    assert.strictEqual(waitBar.style.display, 'none', 'Wait bar must hide after recovery completes');

    // Scenario B: Foreground tab stuck for 10 seconds -> user clicks HUD "立即续接" button -> Stop -> human-paced Type -> Send!
    contentEnv.doc.hidden = false;
    contentEnv.doc._focused = true;
    const stopBtn2 = mountStopBtn();
    clock += 10 * 1000;
    tabHeartbeatFn();
    assert.strictEqual(stopBtn2.clickCount, 0);

    const forceBtn = hudEl.querySelector('.gmah-pill-action');
    assert.ok(forceBtn && forceBtn.textContent === '立即续接');
    forceBtn.click();
    assert.strictEqual(stopBtn2.clickCount, 1, 'Clicking HUD "立即续接" must click Stop immediately');

    pumpTimers(1000, 200);
    assert.strictEqual(sendBtn.clickCount, 1, 'Manual "立即续接" must also respect human anti-throttle pacing before Send');

    pumpTimers(5000, 200);
    assert.strictEqual(sendBtn.clickCount, 2, 'Clicking HUD "立即续接" must complete human-paced typing and auto-send "继续"');
  });

  // 10. Background tab frozen leave-animation spinner & noisy status mutations must NOT block Auto-Continue until tab focus
  test('v1.0 background tab unblocks frozen leave-animation spinner without Stop button and ignores noisy status mutations', () => {
    const { doc, win } = createEnv(GEMINI_ORIGIN + '/app/bg-frozen-spinner');
    let now = 800000;
    doc.hidden = true;
    win.innerWidth = 1920; // Background tab in normal (non-minimized) window!
    win.innerHeight = 1080;

    // Gemini finished streaming: Stop button is GONE and "继续" button is mounted,
    // BUT Chrome paused the CSS fade-out on mat-progress-spinner (opacity: 1, 24x24 rect)!
    const frozenSpinner = doc.createElement('mat-progress-spinner', {
      rect: { width: 24, height: 24 },
      style: { opacity: '1' }
    });
    const statusTimer = doc.createElement('div', {
      attrs: { role: 'status' },
      text: '已连接 (5s)'
    });
    doc.body.appendChild(frozenSpinner);
    doc.body.appendChild(statusTimer);

    const contBtn = doc.createElement('button', { text: '继续' });
    addTurn(doc, '本轮代码重构已完成，点击继续进入下一阶段。', [contBtn]);

    // Noisy status/spinner elements must be ignored by isNoisyMutationTarget
    assert.strictEqual(isNoisyMutationTarget(frozenSpinner), true);
    assert.strictEqual(isNoisyMutationTarget(statusTimer), true);

    const engine = new GmahEngine({
      doc,
      win,
      now: () => now,
      settings: { idleSettleMs: 1800 }
    });

    // t = 0: brief grace wait, and MUST return retryInMs > 0 so SW wakes tab automatically
    const r0 = engine.scanOnce();
    assert.strictEqual(r0.action, 'wait');
    assert.strictEqual(r0.reason, 'generating');
    assert.ok(r0.retryInMs >= 2000, `Expected SW retryInMs >= 2000, got ${r0.retryInMs}`);
    assert.strictEqual(contBtn.clickCount, 0);

    // t + 2300ms (still hidden in background tab!): frozen spinner unblocks and Auto-Continue clicks!
    now += 2300;
    const r1 = engine.scanOnce();
    assert.strictEqual(r1.action, 'clicked_continue', 'Auto-Continue must click in background tab without waiting for user focus');
    assert.strictEqual(contBtn.clickCount, 1);

    // Contrast: when a REAL Stop button IS present in background tab, NEVER click Continue even after 10s
    const stopBtn = doc.createElement('button', { className: 'send-button stop', attrs: { 'aria-label': '停止回复' } });
    doc.body.appendChild(stopBtn);
    const contBtn2 = doc.createElement('button', { text: '继续' });
    addTurn(doc, '新一轮正在流式输出中...', [contBtn2]);

    now += 5000;
    assert.strictEqual(engine.scanOnce().reason, 'generating');
    now += 10000;
    assert.strictEqual(engine.scanOnce().reason, 'generating');
    assert.strictEqual(contBtn2.clickCount, 0, 'Active Stop button must ALWAYS block Continue in background');
  });

  // 11. Multi-layer background recovery: late thaw retries (attempts 3-4 + Enter), zombie port force-rotate, and Web Lock shield
  test('v1.0 background multi-layer hardening: late thaw retries, zombie port force-recovery, and Web Lock anti-freeze shield', () => {
    // Part A: Late background thaw retries (attempts 3 & 4 after 12s & 15s) when hidden tab was briefly throttled
    const { doc, win } = createEnv(GEMINI_ORIGIN + '/app/bg-late-retry');
    let now = 100000;
    doc.hidden = true;

    const stubbornAllow = doc.createElement('button', { text: '始终允许' });
    doc.body.appendChild(stubbornAllow);
    const engine = new GmahEngine({ doc, win, now: () => now });

    assert.strictEqual(engine.scanOnce().action, 'clicked_allow');
    assert.strictEqual(stubbornAllow.clickCount, 1);

    // Attempt 2 after 2.5s
    now += 2600;
    const r2 = engine.scanOnce();
    assert.strictEqual(r2.action, 'retried_allow');
    assert.strictEqual(r2.attempt, 2);
    assert.strictEqual(stubbornAllow.clickCount, 2);

    // At +5s: still resting (doesn't spam)
    now += 5000;
    assert.strictEqual(engine.scanOnce().action, 'noop');

    // Attempt 3 (late thaw retry) after 12s since attempt 2 -> clicks AND sends Enter key fallback!
    now += 7500; // total 12.5s since attempt 2
    const r3 = engine.scanOnce();
    assert.strictEqual(r3.action, 'retried_allow');
    assert.strictEqual(r3.attempt, 3);
    assert.strictEqual(stubbornAllow.clickCount, 3);
    assert.ok(
      stubbornAllow.dispatchedEvents.some((ev) => ev && (ev === 'keydown' || ev.type === 'keydown')),
      'Attempt 3 must dispatch Enter key activation'
    );
    assert.strictEqual(engine.stats.allowCount, 1, 'Retries must NEVER double-count stats');

    // Attempt 4 after 15s -> final retry, then stops cleanly
    now += 15500;
    const r4 = engine.scanOnce();
    assert.strictEqual(r4.action, 'retried_allow');
    assert.strictEqual(r4.attempt, 4);

    now += 30000;
    assert.strictEqual(engine.scanOnce().action, 'noop', 'Must stop after MAX_BG_HIDDEN_ATTEMPTS (4)');

    // Part B: VM sandbox test of Zombie-Port force-recovery + Web Lock anti-freeze shield
    let lockAcquired = 0;
    let lockReleased = 0;
    let portConnectCount = 0;
    let portDisconnectCount = 0;
    const tabMsgListeners = [];

    const env = createEnv(GEMINI_ORIGIN + '/app/bg-zombie-lock');
    env.doc.hidden = true;
    env.doc._focused = false;
    const fakeNav = {
      locks: {
        request(_name, opts, cb) {
          assert.strictEqual(opts.mode, 'shared');
          lockAcquired += 1;
          const p = cb();
          if (p && typeof p.then === 'function') {
            p.then(() => { lockReleased += 1; });
          }
          return Promise.resolve();
        }
      }
    };
    env.win.navigator = fakeNav;

    const chromeMock = {
      runtime: {
        id: 'zombie-lock-test',
        lastError: null,
        connect() {
          portConnectCount += 1;
          return {
            postMessage() {},
            disconnect() { portDisconnectCount += 1; },
            onMessage: { addListener() {} },
            onDisconnect: { addListener() {} }
          };
        },
        sendMessage(_m, cb) { if (cb) cb({ ok: true }); },
        onMessage: { addListener(fn) { tabMsgListeners.push(fn); } }
      },
      storage: {
        local: {
          get(_k, cb) { cb({ [D.STORAGE_KEY]: D.mergeSettings({ enabled: true, backgroundMode: true }) }); },
          set(_o, cb) { if (cb) cb(); }
        },
        onChanged: { addListener() {} }
      }
    };

    const sandbox = {
      window: env.win,
      document: env.doc,
      navigator: fakeNav,
      localStorage: env.localStorageMock,
      chrome: chromeMock,
      Date,
      MutationObserver: class { observe() {} disconnect() {} },
      setTimeout: () => 1,
      clearTimeout: () => {},
      setInterval: () => 1,
      clearInterval: () => {},
      WeakSet,
      Set,
      Map,
      URL,
      console
    };
    sandbox.globalThis = sandbox;
    sandbox.self = sandbox;
    for (const rel of ['defaults.js', 'hud.js', 'content.js']) {
      vm.runInNewContext(fs.readFileSync(path.join(ROOT, rel), 'utf8'), sandbox, { filename: rel });
    }

    assert.strictEqual(lockAcquired, 1, 'Must acquire shared Web Lock shield when backgroundMode is ON');
    assert.strictEqual(portConnectCount, 1);

    // Simulate zombie-port watchdog sending GMAH_BG_TICK (source: 'pong_recovery') via tabs.sendMessage
    const allowBtn = env.doc.createElement('button', { text: '始终允许' });
    env.doc.body.appendChild(allowBtn);
    let resp = null;
    for (const fn of tabMsgListeners) {
      fn({ type: 'GMAH_BG_TICK', source: 'pong_recovery' }, {}, (r) => { resp = r; });
    }
    assert.strictEqual(portDisconnectCount, 1, 'pong_recovery must force-disconnect the stale zombie port');
    assert.strictEqual(portConnectCount, 2, 'pong_recovery must open a fresh background port');
    assert.strictEqual(allowBtn.clickCount, 1, 'pong_recovery tick must immediately click Allow in hidden tab');
    assert.ok(resp && resp.ok);

    // Turning backgroundMode OFF releases Web Lock cleanly
    for (const fn of tabMsgListeners) {
      fn({ type: 'GMAH_APPLY_SETTINGS', settings: { backgroundMode: false } }, {}, () => {});
    }
    assert.strictEqual(lockAcquired, 1);
  });
}

module.exports = { runTests };
