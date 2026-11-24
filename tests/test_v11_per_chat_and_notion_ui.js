'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '..');
const GEMINI_ORIGIN = 'https://' + 'gemini.google.com';
const D = require('../defaults.js');
const { GmahEngine, isBackgroundOrUnfocused } = require('../content.js');
const { createBackgroundController, mainWorldClickByToken } = require('../background.js');
const { createHud } = require('../hud.js');
const { createPopupController } = require('../popup.js');

// ---------------------------------------------------------------------------
// Lightweight DOM mock tailored for per-chat, MAIN-world, HUD & Popup tests
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
    this.style = Object.assign(
      { display: '', visibility: '', opacity: '', pointerEvents: '', width: '', height: '', transform: '' },
      opts.style || {}
    );
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
  removeAttribute(k) { this.attrs.delete(String(k)); }

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

  contains(node) {
    let cur = node;
    while (cur) {
      if (cur === this) return true;
      cur = cur.parentNode;
    }
    return false;
  }

  getRootNode() {
    let cur = this;
    while (cur.parentNode) cur = cur.parentNode;
    return cur;
  }

  attachShadow() {
    const sr = new MockNode('#shadow-root', this.ownerDocument, { nodeType: 11, host: this });
    this.shadowRoot = sr;
    return sr;
  }

  getBoundingClientRect() { return Object.assign({}, this.rect); }

  querySelectorAll(sel) {
    const out = [];
    const walk = (node) => {
      for (const child of node.children) {
        if (matchesSelectorList(child, sel)) out.push(child);
        walk(child);
      }
    };
    walk(this);
    return out;
  }

  querySelector(sel) {
    return this.querySelectorAll(sel)[0] || null;
  }

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
    const event = ev || { type: '' };
    this.dispatchedEvents.push(event);
    const list = this._listeners.get(event.type) || [];
    for (const fn of list.slice()) fn(event);
    return true;
  }

  focus() {
    this.focusCount += 1;
  }

  click() {
    if (this.disabled) return;
    this.clickCount += 1;
    this.dispatchEvent({ type: 'click', target: this, stopPropagation() {}, preventDefault() {} });
  }
}

function createEnv(url, opts) {
  const options = opts || {};
  const doc = {
    hidden: Boolean(options.hidden),
    visibilityState: options.hidden ? 'hidden' : 'visible',
    hasFocus: () => (typeof options.hasFocus === 'boolean' ? options.hasFocus : !options.hidden),
    _listeners: new Map(),
    createElement(tag, nodeOpts) {
      return new MockNode(tag, doc, nodeOpts);
    },
    getElementById(id) {
      return doc.body.querySelector(`#${id}`);
    },
    querySelectorAll(sel) {
      return doc.body.querySelectorAll(sel);
    },
    querySelector(sel) {
      return doc.body.querySelector(sel);
    },
    addEventListener(type, fn) {
      if (!doc._listeners.has(type)) doc._listeners.set(type, []);
      doc._listeners.get(type).push(fn);
    },
    removeEventListener(type, fn) {
      const list = doc._listeners.get(type) || [];
      const idx = list.indexOf(fn);
      if (idx >= 0) list.splice(idx, 1);
    }
  };
  doc.documentElement = new MockNode('html', doc);
  doc.body = new MockNode('body', doc);
  doc.documentElement.appendChild(doc.body);

  class FakeEvent {
    constructor(type, init) {
      Object.assign(this, init || {}, { type });
    }
  }

  const win = {
    location: { href: url || `${GEMINI_ORIGIN}/app/alpha` },
    innerWidth: 1280,
    innerHeight: 800,
    Event: FakeEvent,
    InputEvent: FakeEvent,
    MouseEvent: FakeEvent,
    PointerEvent: FakeEvent,
    KeyboardEvent: FakeEvent,
    getComputedStyle(node) {
      return Object.assign(
        { display: 'block', visibility: 'visible', opacity: '1', pointerEvents: 'auto', width: '120px', height: '36px', transform: 'none' },
        node.style || {}
      );
    },
    addEventListener() {},
    removeEventListener() {}
  };

  return { doc, win };
}

function runTests(test) {
  // 1. Conversation key extraction, sanitization, and effective settings layering
  test('defaults: extractConversationKey, sanitizeChatOverridesMap, and resolveEffectiveSettings work cleanly', () => {
    assert.strictEqual(D.extractConversationKey(`${GEMINI_ORIGIN}/app`), 'landing');
    assert.strictEqual(D.extractConversationKey(`${GEMINI_ORIGIN}/app/abc123`), 'chat:abc123');
    assert.strictEqual(D.extractConversationKey(`${GEMINI_ORIGIN}/u/2/app/xyz789?hl=zh`), 'chat:xyz789');
    assert.strictEqual(D.extractConversationKey(`${GEMINI_ORIGIN}/gem/coder/chat42`), 'gem:coder:chat42');
    assert.strictEqual(D.extractConversationKey(`${GEMINI_ORIGIN}/gems`), null);
    assert.strictEqual(D.extractConversationKey(`${GEMINI_ORIGIN}/settings`), null);
    assert.strictEqual(D.extractConversationKey(`${GEMINI_ORIGIN}/app/__proto__`), null);

    const sanitized = D.sanitizeChatOverridesMap({
      'chat:a': { autoContinue: false, unknownKey: 123, updatedAt: 100 },
      'chat:empty': { enabled: 'not-a-bool' },
      __proto__: { enabled: false },
      'chat:stop': { emergencyStopped: true, updatedAt: 200 }
    });
    assert.deepStrictEqual(Object.keys(sanitized).sort(), ['chat:a', 'chat:stop']);
    assert.strictEqual(sanitized['chat:a'].autoContinue, false);
    assert.strictEqual(sanitized['chat:a'].unknownKey, undefined);
    assert.strictEqual(sanitized['chat:stop'].emergencyStopped, true);

    const globalCfg = D.mergeSettings({ enabled: true, autoAllow: true, autoContinue: true });
    const eff = D.resolveEffectiveSettings(globalCfg, sanitized['chat:a']);
    assert.strictEqual(eff.autoContinue, false);
    assert.strictEqual(eff.autoAllow, true);
    assert.strictEqual(globalCfg.autoContinue, true, 'Global settings must remain unmutated');
  });

  // 2. Per-chat independent toggles & isolated emergency stop across SPA navigation
  test('engine: per-chat overrides & emergency stop stay isolated per conversation and restore on return', () => {
    const { doc, win } = createEnv(`${GEMINI_ORIGIN}/app/chatA`);
    let now = 50000;
    const savedSnapshots = [];

    const engine = new GmahEngine({
      doc,
      win,
      now: () => now,
      settings: { enabled: true, autoAllow: true, autoContinue: true, idleSettleMs: 500 },
      onChatOverridesSave: (map) => savedSnapshots.push(JSON.parse(JSON.stringify(map)))
    });

    // Customize Chat A: disable autoContinue, then trigger emergency stop
    engine.updateChatOverride({ autoContinue: false }, true);
    assert.strictEqual(engine.settings.autoContinue, false);
    assert.strictEqual(engine.globalSettings.autoContinue, true);
    assert.strictEqual(engine.hasChatOverride(), true);

    engine.emergencyStop();
    assert.strictEqual(engine.circuitBreaker.tripped, true);
    assert.strictEqual(engine.circuitBreaker.reasonCode, 'emergency_stop');
    assert.strictEqual(engine.chatOverrides['chat:chatA'].emergencyStopped, true);

    // Add Always Allow button in Chat A -> must be blocked by Chat A's emergency stop
    const allowA = doc.createElement('button', { text: '始终允许' });
    doc.body.appendChild(allowA);
    assert.strictEqual(engine.scanOnce().action, 'blocked');
    assert.strictEqual(allowA.clickCount, 0);

    // Switch to Chat B -> Chat B must NOT be emergency stopped and must keep autoContinue = true
    win.location.href = `${GEMINI_ORIGIN}/app/chatB`;
    engine.onConversationChange(win.location.href);
    assert.strictEqual(engine.conversationKey, 'chat:chatB');
    assert.strictEqual(engine.circuitBreaker.tripped, false);
    assert.strictEqual(engine.settings.autoContinue, true);
    assert.strictEqual(engine.hasChatOverride(), false);

    // Chat B should click Always Allow normally
    const allowB = doc.createElement('button', { text: '始终允许' });
    allowA.remove();
    doc.body.appendChild(allowB);
    const resB = engine.scanOnce();
    assert.strictEqual(resB.action, 'clicked_allow');
    assert.strictEqual(allowB.clickCount, 1);

    // Return to Chat A -> must automatically restore Chat A's emergency stop & autoContinue: false
    win.location.href = `${GEMINI_ORIGIN}/app/chatA`;
    engine.onConversationChange(win.location.href);
    assert.strictEqual(engine.conversationKey, 'chat:chatA');
    assert.strictEqual(engine.circuitBreaker.tripped, true);
    assert.strictEqual(engine.circuitBreaker.reasonCode, 'emergency_stop');
    assert.strictEqual(engine.settings.autoContinue, false);

    // Reset Chat A back to global defaults -> clears override & emergency stop
    assert.strictEqual(engine.clearChatOverride(true), true);
    assert.strictEqual(engine.hasChatOverride(), false);
    assert.strictEqual(engine.circuitBreaker.tripped, false);
    assert.strictEqual(engine.settings.autoContinue, true);
    assert.ok(savedSnapshots.length >= 2);
  });

  // 3. Landing page override migrates automatically to newly created chat ID
  test('engine: landing /app per-chat override migrates to /app/<newId> on new chat creation', () => {
    const { doc, win } = createEnv(`${GEMINI_ORIGIN}/app`);
    let lastSaveMeta = null;
    const engine = new GmahEngine({
      doc,
      win,
      settings: { enabled: true, autoContinue: true },
      onChatOverridesSave: (_map, meta) => { lastSaveMeta = meta; }
    });

    assert.strictEqual(engine.conversationKey, 'landing');
    engine.updateChatOverride({ autoContinue: false }, true);
    assert.strictEqual(engine.chatOverrides.landing.autoContinue, false);

    win.location.href = `${GEMINI_ORIGIN}/app/fresh999`;
    engine.onConversationChange(win.location.href);
    assert.strictEqual(engine.conversationKey, 'chat:fresh999');
    assert.strictEqual(engine.chatOverrides.landing, undefined);
    assert.strictEqual(engine.chatOverrides['chat:fresh999'].autoContinue, false);
    assert.strictEqual(engine.settings.autoContinue, false);
    assert.strictEqual(lastSaveMeta.removedKey, 'landing');
  });

  // 4. Background controller per-chat override heartbeat, discard protection & minimized follow-up
  test('background: per-chat override activates heartbeat & discard protection without leaking to other tabs', () => {
    const timers = [];
    const intervals = [];
    const tabUpdates = [];
    const tabMessages = [];
    let now = 100000;

    const storageData = {
      [D.STORAGE_KEY]: { enabled: false, backgroundMode: false, preventTabDiscard: true },
      [D.CHAT_OVERRIDES_KEY]: {
        'chat:bgOn': { enabled: true, backgroundMode: true, updatedAt: 1000 },
        'chat:stopped': { enabled: true, backgroundMode: true, emergencyStopped: true, updatedAt: 1001 }
      }
    };

    const mockChrome = {
      runtime: { lastError: null, getPlatformInfo(cb) { if (cb) cb({}); } },
      storage: {
        local: {
          get(_keys, cb) { cb(Object.assign({}, storageData)); }
        }
      },
      alarms: { create() {}, clear() {} },
      tabs: {
        query(_q, cb) {
          cb([
            { id: 11, url: `${GEMINI_ORIGIN}/app/bgOn`, discarded: false },
            { id: 12, url: `${GEMINI_ORIGIN}/app/defaultOff`, discarded: false },
            { id: 13, url: `${GEMINI_ORIGIN}/app/stopped`, discarded: false }
          ]);
        },
        update(tabId, props, cb) {
          tabUpdates.push({ tabId, props });
          if (cb) cb();
        },
        sendMessage(tabId, msg, cb) {
          tabMessages.push({ tabId, msg });
          if (cb) cb({ ok: true });
        }
      }
    };

    const bg = createBackgroundController(
      mockChrome,
      {
        setInterval(fn, ms) {
          const id = intervals.length + 1;
          intervals.push({ id, fn, ms, cleared: false });
          return id;
        },
        clearInterval(id) {
          const hit = intervals.find((x) => x.id === id);
          if (hit) hit.cleared = true;
        },
        setTimeout(fn, ms) {
          const id = timers.length + 1;
          timers.push({ id, fn, ms, cleared: false });
          return id;
        },
        clearTimeout(id) {
          const hit = timers.find((x) => x.id === id);
          if (hit) hit.cleared = true;
        }
      },
      () => now
    );

    bg.init();
    assert.strictEqual(bg.isAnyBackgroundActive(), true);
    assert.strictEqual(bg.isTabBackgroundActive(`${GEMINI_ORIGIN}/app/bgOn`), true);
    assert.strictEqual(bg.isTabBackgroundActive(`${GEMINI_ORIGIN}/app/defaultOff`), false);
    assert.strictEqual(bg.isTabBackgroundActive(`${GEMINI_ORIGIN}/app/stopped`), false);

    // Discard protection must be ON (autoDiscardable: false) ONLY for chat:bgOn
    const u11 = tabUpdates.filter((u) => u.tabId === 11).pop();
    const u12 = tabUpdates.filter((u) => u.tabId === 12).pop();
    const u13 = tabUpdates.filter((u) => u.tabId === 13).pop();
    assert.strictEqual(u11.props.autoDiscardable, false);
    assert.strictEqual(u12.props.autoDiscardable, true);
    assert.strictEqual(u13.props.autoDiscardable, true);

    // Connect two ports (tab 11 bgOn, tab 12 defaultOff)
    const mkPort = (tabId, url) => ({
      name: 'gmah-tab',
      sender: { tab: { id: tabId, url } },
      posted: [],
      onMessage: { addListener() {} },
      onDisconnect: { addListener() {} },
      postMessage(m) { this.posted.push(m); }
    });
    const p11 = mkPort(11, `${GEMINI_ORIGIN}/app/bgOn`);
    const p12 = mkPort(12, `${GEMINI_ORIGIN}/app/defaultOff`);
    bg.handleConnect(p11);
    bg.handleConnect(p12);
    assert.strictEqual(bg.isHeartbeatRunning(), true);

    // Simulate Chrome window minimize / unfocus (WINDOW_ID_NONE === -1)
    bg.handleWindowFocusChanged(-1);
    assert.deepStrictEqual(bg.getScheduledTickTabIds(), [11], 'Only bg-active tab 11 should get minimized follow-up tick');

    // Removing chat:bgOn override via storage change stops heartbeat cleanly
    bg.handleStorageChanged(
      { [D.CHAT_OVERRIDES_KEY]: { newValue: {} } },
      'local'
    );
    assert.strictEqual(bg.isAnyBackgroundActive(), false);
    assert.strictEqual(bg.isHeartbeatRunning(), false);
  });

  // 5. MAIN-world click executor & hidden-tab escalation for Allow and Stall Recovery Send
  test('background & engine: mainWorldClickByToken pierces Shadow DOM/chips and engine escalates hidden clicks', () => {
    const { doc, win } = createEnv(`${GEMINI_ORIGIN}/app/bgClick`, { hidden: true, hasFocus: false });
    const prevDoc = global.document;
    const prevWin = global.window;
    global.document = doc;
    global.window = win;

    try {
      // A. Direct test of mainWorldClickByToken inside Shadow DOM + mat-chip
      const host = doc.createElement('div');
      const sr = host.attachShadow();
      const chip = doc.createElement('mat-chip');
      const innerBtn = doc.createElement('button', { text: '继续' });
      chip.appendChild(innerBtn);
      sr.appendChild(chip);
      doc.body.appendChild(host);

      chip.setAttribute('data-gmah-click-target', 'tok_123');
      const mwRes = mainWorldClickByToken('tok_123', 3);
      assert.strictEqual(mwRes.clicked, true);
      assert.strictEqual(chip.getAttribute('data-gmah-click-target'), null, 'Token attribute must be cleaned up');
      assert.strictEqual(innerBtn.clickCount, 1);
      assert.ok(innerBtn.dispatchedEvents.some((e) => e.type === 'pointerdown'));
      assert.ok(innerBtn.dispatchedEvents.some((e) => e.type === 'keydown' && e.key === 'Enter'));
    } finally {
      global.document = prevDoc;
      global.window = prevWin;
    }

    // B. Engine escalates stuck Allow retry AND Stall-Recovery Send to onMainWorldClick when hidden
    let now = 80000;
    const mwPayloads = [];
    const engine = new GmahEngine({
      doc,
      win,
      now: () => now,
      settings: { enabled: true, autoAllow: true, backgroundMode: true, humanPacingEnabled: false },
      clickFn: () => {
        // Simulate isolated-world click being ignored by hidden Angular renderer (button stays, input stays non-empty)
      },
      onMainWorldClick: (payload) => mwPayloads.push(payload)
    });

    const allowBtn = doc.createElement('button', { text: '始终允许' });
    doc.body.appendChild(allowBtn);
    const r1 = engine.scanOnce();
    assert.strictEqual(r1.action, 'clicked_allow');
    assert.strictEqual(mwPayloads.length, 1);
    assert.strictEqual(mwPayloads[0].kind, 'allow');

    // Advance past BG_ALLOW_RETRY_DELAY_MS (2500ms) -> attempt 2 must escalate to MAIN world again
    now += 2600;
    const r2 = engine.scanOnce();
    assert.strictEqual(r2.action, 'retried_allow');
    assert.strictEqual(r2.mainWorldEscalated, true);
    assert.strictEqual(mwPayloads.length, 2);
    assert.strictEqual(mwPayloads[1].kind, 'allow');
    assert.ok(allowBtn.getAttribute('data-gmah-click-target'));

    // Now test Stall Recovery Send MAIN-world fallback while hidden
    allowBtn.remove();
    const input = doc.createElement('textarea', { attrs: { 'aria-label': 'Enter a prompt for Gemini' } });
    const sendBtn = doc.createElement('button', { className: 'send-button', attrs: { 'aria-label': 'Send message' } });
    doc.body.appendChild(input);
    doc.body.appendChild(sendBtn);

    const f1 = engine.forceStallRecovery();
    assert.strictEqual(f1.action, 'stall_recover_fill');
    now += 600;
    const f2 = engine.scanOnce();
    assert.strictEqual(f2.action, 'stall_recover_sent');
    assert.strictEqual(mwPayloads.length, 3);
    assert.strictEqual(mwPayloads[2].kind, 'send');
    assert.strictEqual(mwPayloads[1].attempt, 2);
  });

  // 6. Notion-style HUD scope switching, override indicators, clearLogs & CSS tokens
  test('hud & css: Notion scope bar switches chat/global, highlights custom overrides, and clears logs safely', () => {
    const { doc, win } = createEnv(`${GEMINI_ORIGIN}/app/notion42`);
    const prevDoc = global.document;
    global.document = doc;

    try {
      const toggled = [];
      let resetOverrideCalls = 0;
      let clearLogsCalls = 0;

      const engine = new GmahEngine({
        doc,
        win,
        settings: { enabled: true, autoAllow: true, autoContinue: true, theme: 'light' }
      });
      engine.addLog('测试日志条目');

      const hud = createHud({
        onToggleContinue: (scope) => {
          toggled.push({ key: 'autoContinue', scope });
          if (scope === 'chat') {
            engine.updateChatOverride({ autoContinue: !engine.settings.autoContinue }, false);
          } else {
            engine.updateSettings({ autoContinue: !engine.globalSettings.autoContinue }, false);
          }
          hud.update(engine.getState());
        },
        onResetChatOverride: () => {
          resetOverrideCalls += 1;
          engine.clearChatOverride(false);
          hud.update(engine.getState());
        },
        onClearLogs: () => {
          clearLogsCalls += 1;
          engine.clearLogs();
          hud.update(engine.getState());
        }
      });

      const rootEl = hud.mount();
      hud.update(engine.getState());

      assert.strictEqual(hud.getScope(), 'chat');
      const scopeTabs = rootEl.querySelectorAll('.gmah-scope-tab');
      assert.strictEqual(scopeTabs.length, 2);
      assert.ok(scopeTabs[0].className.includes('active'));

      const resetBtn = rootEl.querySelector('.gmah-scope-reset');
      assert.strictEqual(resetBtn.style.display, 'none');

      // Click Auto Continue (3rd row) under 'chat' scope -> marks row custom & reveals reset button
      const rows = rootEl.querySelectorAll('.gmah-row');
      assert.strictEqual(rows.length, 6);
      rows[2].querySelector('.gmah-pill').click();
      assert.deepStrictEqual(toggled[0], { key: 'autoContinue', scope: 'chat' });
      assert.ok(rows[2].className.includes('gmah-row-custom'));
      assert.strictEqual(rows[2].querySelector('.gmah-override-dot').style.display, 'inline-block');
      assert.strictEqual(resetBtn.style.display, 'inline-flex');
      assert.strictEqual(rows[2].querySelector('.gmah-pill').textContent, '已关闭');

      // Switch to 'global' scope -> pill displays global value ('已开启') while chat stays false
      scopeTabs[1].click();
      assert.strictEqual(hud.getScope(), 'global');
      assert.ok(scopeTabs[1].className.includes('active'));
      assert.strictEqual(rows[2].querySelector('.gmah-pill').textContent, '已开启');

      // Click reset -> clears chat override and hides reset button
      resetBtn.click();
      assert.strictEqual(resetOverrideCalls, 1);
      assert.strictEqual(resetBtn.style.display, 'none');

      // Open logs panel and click Clear button
      hud.setActivePanel('logs');
      const clearBtn = rootEl.querySelector('.gmah-panel-mini-btn');
      assert.ok(clearBtn);
      clearBtn.click();
      assert.strictEqual(clearLogsCalls, 1);
      assert.strictEqual(engine.logs.length, 0);

      hud.unmount();
    } finally {
      global.document = prevDoc;
    }

    // Verify Notion palette tokens exist in both stylesheets
    const hudCss = fs.readFileSync(path.join(ROOT, 'hud.css'), 'utf8');
    const popupCss = fs.readFileSync(path.join(ROOT, 'popup.css'), 'utf8');
    assert.ok(hudCss.includes('#1f1f1f') && hudCss.includes('#f7f6f3') && hudCss.includes('#37352f'));
    assert.ok(hudCss.includes('.gmah-scope-bar') && hudCss.includes('.gmah-override-dot'));
    assert.ok(popupCss.includes('#191919') && popupCss.includes('#f7f6f3') && popupCss.includes('#2383e2'));
    assert.ok(popupCss.includes('.chat-control-card') && popupCss.includes('.chat-toggle-grid'));
  });

  // 7. Popup per-chat control card & single-chat vs all-tabs emergency stop isolation
  test('popup: per-chat toggles and btnEmergency target active tab only, while btnEmergencyAll broadcasts to all tabs', () => {
    const { doc } = createEnv('chrome-extension://test/popup.html');
    const ids = [
      'enabled', 'autoAllow', 'preferAlwaysAllow', 'fallbackSingleAllow',
      'autoContinue', 'backgroundMode', 'preventTabDiscard', 'showHud',
      'maxContinuesPerTask', 'dailyContinueLimit', 'continueCooldownSec', 'idleSettleSec',
      'stopOnCompletionCues', 'stopOnStagnantOutput', 'stopOnQuotaOrError',
      'humanPacingEnabled', 'stallAlertEnabled', 'stallAlertMinutes',
      'stallAutoRecoverEnabled', 'stallAutoRecoverMinutes', 'maxStallRecoveriesPerTask',
      'stallAutoRecoverPrompt', 'btnForceRecover', 'btnToggleNotif', 'btnTestNotif',
      'language', 'btnToggleTheme', 'btnResetHudPos',
      'customAlwaysAllowKeywords', 'customContinueKeywords',
      'statAllow', 'statContinue', 'statLive',
      'chatControlCard', 'chatLabel', 'chatOverrideBadge', 'btnResetChatOverride',
      'btnChatEmergency', 'btnEmergency', 'btnEmergencyAll',
      'btnResetBreaker', 'btnResetStats', 'btnDefaults', 'btnSave', 'toast'
    ];
    for (const id of ids) {
      doc.body.appendChild(doc.createElement('input', { id }));
    }
    const chatToggleIds = [
      'chatEnabled', 'chatAutoAllow', 'chatAutoContinue',
      'chatBackgroundMode', 'chatStallAlertEnabled', 'chatStallAutoRecoverEnabled'
    ];
    for (const id of chatToggleIds) {
      const wrap = doc.createElement('label', { className: 'chat-toggle-item' });
      const inp = doc.createElement('input', { id });
      wrap.appendChild(inp);
      doc.body.appendChild(wrap);
    }

    const storageState = {
      [D.STORAGE_KEY]: D.mergeSettings({ enabled: true, autoAllow: true, autoContinue: true }),
      [D.STATS_KEY]: { date: D.getTodayKey(), allowCount: 2, continueCount: 1 }
    };

    const tabStates = {
      10: {
        conversationKey: 'chat:inactive1',
        settings: D.mergeSettings(storageState[D.STORAGE_KEY]),
        globalSettings: D.mergeSettings(storageState[D.STORAGE_KEY]),
        chatOverride: {},
        hasChatOverride: false,
        isNonChatPage: false,
        circuitBreaker: { tripped: false }
      },
      20: {
        conversationKey: 'chat:active2',
        settings: D.mergeSettings(storageState[D.STORAGE_KEY]),
        globalSettings: D.mergeSettings(storageState[D.STORAGE_KEY]),
        chatOverride: {},
        hasChatOverride: false,
        isNonChatPage: false,
        circuitBreaker: { tripped: false }
      }
    };
    const sentLog = [];

    const mockChrome = {
      runtime: { lastError: null },
      windows: { getLastFocused(cb) { cb({ id: 99 }); } },
      storage: {
        local: {
          get(_keys, cb) { cb(Object.assign({}, storageState)); },
          set(obj, cb) { Object.assign(storageState, obj); if (cb) cb(); }
        }
      },
      tabs: {
        query(_q, cb) {
          cb([
            { id: 10, windowId: 99, active: false, highlighted: false },
            { id: 20, windowId: 99, active: true, highlighted: true }
          ]);
        },
        sendMessage(tabId, msg, cb) {
          sentLog.push({ tabId, msg });
          const st = tabStates[tabId];
          if (msg.type === 'GMAH_UPDATE_CHAT_OVERRIDE') {
            st.chatOverride = Object.assign({}, st.chatOverride, msg.override);
            st.settings = D.resolveEffectiveSettings(st.globalSettings, st.chatOverride);
            st.hasChatOverride = true;
          } else if (msg.type === 'GMAH_RESET_CHAT_OVERRIDE') {
            st.chatOverride = {};
            st.settings = D.mergeSettings(st.globalSettings);
            st.hasChatOverride = false;
            st.circuitBreaker = { tripped: false };
          } else if (msg.type === 'GMAH_EMERGENCY_STOP') {
            st.circuitBreaker = { tripped: true, reasonCode: 'emergency_stop' };
            st.chatOverride = Object.assign({}, st.chatOverride, { emergencyStopped: true });
            st.hasChatOverride = true;
          } else if (msg.type === 'GMAH_RESET_BREAKER') {
            st.circuitBreaker = { tripped: false };
          }
          cb({ ok: true, state: st });
        }
      }
    };

    const popup = createPopupController(doc, mockChrome);
    popup.init();

    assert.strictEqual(doc.getElementById('chatControlCard').style.display, 'flex');
    assert.ok(doc.getElementById('chatLabel').textContent.includes('active2'));
    assert.strictEqual(doc.getElementById('chatAutoContinue').checked, true);

    // 1. Toggle chatAutoContinue OFF -> only tab 20 receives GMAH_UPDATE_CHAT_OVERRIDE
    sentLog.length = 0;
    const chatContEl = doc.getElementById('chatAutoContinue');
    chatContEl.checked = false;
    chatContEl.dispatchEvent({ type: 'change' });
    assert.strictEqual(sentLog.length, 1);
    assert.strictEqual(sentLog[0].tabId, 20);
    assert.strictEqual(sentLog[0].msg.type, 'GMAH_UPDATE_CHAT_OVERRIDE');
    assert.strictEqual(tabStates[20].settings.autoContinue, false);
    assert.strictEqual(tabStates[10].settings.autoContinue, true);
    assert.ok(chatContEl.parentNode.className.includes('overridden'));
    assert.strictEqual(doc.getElementById('btnResetChatOverride').style.display, 'inline-block');

    // 2. Click btnEmergency -> ONLY active tab 20 is emergency stopped, tab 10 stays running
    sentLog.length = 0;
    doc.getElementById('btnEmergency').click();
    assert.strictEqual(sentLog.length, 1);
    assert.strictEqual(sentLog[0].tabId, 20);
    assert.strictEqual(tabStates[20].circuitBreaker.tripped, true);
    assert.strictEqual(tabStates[10].circuitBreaker.tripped, false);
    assert.strictEqual(doc.getElementById('btnChatEmergency').textContent, '解除本对话');

    // 3. Click btnChatEmergency while tripped -> resumes ONLY tab 20
    sentLog.length = 0;
    doc.getElementById('btnChatEmergency').click();
    assert.strictEqual(sentLog.length, 1);
    assert.strictEqual(sentLog[0].tabId, 20);
    assert.strictEqual(sentLog[0].msg.type, 'GMAH_RESET_BREAKER');
    assert.strictEqual(tabStates[20].circuitBreaker.tripped, false);

    // 4. Click btnEmergencyAll -> broadcasts GMAH_EMERGENCY_STOP to BOTH tabs (10 & 20)
    sentLog.length = 0;
    doc.getElementById('btnEmergencyAll').click();
    assert.strictEqual(sentLog.length, 2);
    assert.strictEqual(tabStates[10].circuitBreaker.tripped, true);
    assert.strictEqual(tabStates[20].circuitBreaker.tripped, true);

    // 5. Click btnResetChatOverride -> resets active tab 20 back to global defaults
    sentLog.length = 0;
    doc.getElementById('btnResetChatOverride').click();
    assert.strictEqual(sentLog.length, 1);
    assert.strictEqual(sentLog[0].tabId, 20);
    assert.strictEqual(sentLog[0].msg.type, 'GMAH_RESET_CHAT_OVERRIDE');
    assert.strictEqual(doc.getElementById('chatOverrideBadge').textContent, '跟随全局');
    assert.strictEqual(doc.getElementById('btnResetChatOverride').style.display, 'none');
  });

  test('v2.0 background, minimized & screen-off/sleep wakeup escalates MAIN-world clicks and continues reliably', () => {
    const mainWorldCalls = [];
    const bg = createBackgroundController(
      {
        runtime: { lastError: null },
        scripting: {
          executeScript(opts, cb) {
            mainWorldCalls.push(opts);
            if (typeof cb === 'function') cb([{ result: { clicked: true } }]);
          }
        },
        tabs: {
          query(_q, cb) {
            cb([{ id: 77, url: `${GEMINI_ORIGIN}/app/sleep_test_1`, discarded: false }]);
          },
          update(_tabId, _props, cb) {
            if (typeof cb === 'function') cb();
          },
          sendMessage(_tabId, _msg, cb) {
            if (typeof cb === 'function') cb({ ok: true });
          }
        }
      },
      null,
      () => 10000
    );

    const lockedWin = {
      innerWidth: 0,
      innerHeight: 0,
      outerWidth: 0,
      outerHeight: 0,
      screenX: -32000,
      screenY: -32000,
      hasFocus: () => false
    };
    const { doc: hiddenDoc } = createEnv(`${GEMINI_ORIGIN}/app/sleep_test_1`);
    hiddenDoc.hidden = true;
    hiddenDoc.visibilityState = 'hidden';
    hiddenDoc.hasFocus = () => false;

    const turnDiv = hiddenDoc.createElement('div');
    turnDiv.className = 'model-response';
    turnDiv.textContent = 'First part of response.';
    hiddenDoc.body.appendChild(turnDiv);

    const contBtn = hiddenDoc.createElement('button', { text: 'Continue' });
    hiddenDoc.body.appendChild(contBtn);

    let mainWorldPayload = null;
    const engine = new GmahEngine({
      doc: hiddenDoc,
      win: lockedWin,
      now: () => 50000,
      onMainWorldClick: (payload) => {
        mainWorldPayload = payload;
        const tok = payload.token;
        const target = contBtn.getAttribute('data-gmah-click-target') === tok ? contBtn : null;
        if (target) {
          target.removeAttribute('data-gmah-click-target');
          const res = mainWorldClickByToken(tok, payload.attempt, payload.kind);
          assert.strictEqual(res.clicked, false);
          assert.strictEqual(res.reason, 'not_found');
        }
      }
    });

    assert.strictEqual(isBackgroundOrUnfocused(hiddenDoc, lockedWin), true);
    const res = engine.scanOnce();
    assert.strictEqual(res.action, 'clicked_continue');
    assert.strictEqual(contBtn.clickCount, 1);
    assert.ok(mainWorldPayload && mainWorldPayload.kind === 'continue');
    assert.ok(typeof mainWorldPayload.token === 'string' && mainWorldPayload.token.startsWith('gmah_'));
    assert.ok(mainWorldCalls.length === 0);

    const connectedPort = {
      name: 'gmah-tab',
      sender: { tab: { id: 77, url: `${GEMINI_ORIGIN}/app/sleep_test_1` } },
      onMessage: { addListener() {} },
      onDisconnect: { addListener() {} },
      postMessage() {}
    };
    bg.handleConnect(connectedPort);
    bg.handleWindowFocusChanged(-1);
    assert.ok(bg.getScheduledTickTabIds().includes(77));
  });
}

module.exports = { runTests };
