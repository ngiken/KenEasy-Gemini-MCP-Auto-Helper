'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '..');
const GEMINI_ORIGIN = 'https://' + 'gemini.google.com';
const D = require('../defaults.js');
const { GmahEngine, isNoisyMutationTarget } = require('../content.js');
const { createBackgroundController, ALARM_NAME, PORT_ROTATE_MS } = require('../background.js');
const { createPopupController } = require('../popup.js');

// ---------------------------------------------------------------------------
// Minimal DOM mock shared by stress & adversarial tests
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

class StressNode {
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
    const sr = new StressNode('#shadow-root', this.ownerDocument, { nodeType: 11, host: this });
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
    createElement(tag, opts) { return new StressNode(tag, doc, opts); },
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
  doc.documentElement = new StressNode('HTML', doc);
  doc.body = new StressNode('BODY', doc);
  doc.documentElement.appendChild(doc.body);

  const lsStore = new Map();
  const localStorageMock = {
    getItem(k) { return lsStore.has(k) ? lsStore.get(k) : null; },
    setItem(k, v) { lsStore.set(k, String(v)); },
    removeItem(k) { lsStore.delete(k); }
  };

  const parsedUrl = new URL(href || (GEMINI_ORIGIN + '/app/stress-chat'));
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
  // 1. 30-Minute Background Marathon + Unexpected SW Crash Recovery + Multi-Port Rotation
  test('stress: 30-minute hidden background marathon with 7 port rotations, SW crash recovery, 8 allows & 6 continues', () => {
    let clock = 1000000;
    const swTimers = new Map();
    let swTimerSeq = 1;
    let swIntervalFn = null;
    let platformKeepaliveCount = 0;

    const storageData = {
      [D.STORAGE_KEY]: D.mergeSettings({
        enabled: true,
        backgroundMode: true,
        autoAllow: true,
        autoContinue: true,
        idleSettleMs: 1800,
        continueCooldownMs: 4000,
        maxContinuesPerTask: 10
      }),
      [D.STATS_KEY]: D.createEmptyStats(D.getTodayKey(new Date(clock)))
    };
    const clone = (o) => JSON.parse(JSON.stringify(o));

    const contentEnv = createEnv(GEMINI_ORIGIN + '/app/marathon-30m');
    contentEnv.doc.hidden = true;
    contentEnv.doc._focused = false;
    contentEnv.win.innerWidth = 0;
    contentEnv.win.innerHeight = 0;

    const swListeners = { onConnect: [], onMessage: [], onAlarm: [], onStorage: [] };
    const tabListeners = { onMessage: [], onStorage: [] };
    const portPairs = [];

    const swChrome = {
      runtime: {
        id: 'gmah-marathon',
        lastError: null,
        getPlatformInfo(cb) { platformKeepaliveCount += 1; if (cb) cb({ os: 'win' }); },
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
        query(_q, cb) { cb([{ id: 201, url: contentEnv.win.location.href, discarded: false }]); },
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
        id: 'gmah-marathon',
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
            sender: { tab: { id: 201 } },
            postMessage(m) { if (closed) throw new Error('closed'); for (const fn of cMsg.slice()) fn(m); },
            disconnect() { if (closed) return; closed = true; for (const fn of cDisc.slice()) fn(); },
            onMessage: { addListener(fn) { sMsg.push(fn); } },
            onDisconnect: { addListener(fn) { sDisc.push(fn); } }
          };
          portPairs.push({ clientPort, serverPort });
          for (const fn of swListeners.onConnect) fn(serverPort);
          return clientPort;
        },
        sendMessage(msg, cb) {
          for (const fn of swListeners.onMessage) {
            fn(msg, { tab: { id: 201 } }, (resp) => { if (cb) cb(resp); });
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

    let moCb = null;
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
      MutationObserver: class { constructor(cb) { moCb = cb; } observe() {} disconnect() {} },
      Date: FakeDate,
      Promise: { resolve: () => ({ then(fn) { microtasks.push(fn); } }) },
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

    const flush = () => {
      while (microtasks.length > 0) microtasks.shift()();
      for (const [id, entry] of Array.from(swTimers.entries())) {
        if (entry.dueAt <= clock) {
          swTimers.delete(id);
          entry.fn();
          while (microtasks.length > 0) microtasks.shift()();
        }
      }
    };

    let allowsClicked = 0;
    let continuesClicked = 0;

    // Simulate 30 minutes (1200 x 1.5s heartbeat intervals = 1800s)
    const allowTicks = new Set([10, 120, 260, 410, 590, 770, 950, 1120]);
    const continueTicks = new Set([60, 220, 460, 680, 900, 1150]);
    const crashTicks = new Set([300, 820]);

    let activeAllow = null;
    let activeContinue = null;

    for (let tick = 1; tick <= 1200; tick++) {
      clock += 1500;

      // Simulate unexpected Service Worker disconnect / crash recovery
      if (crashTicks.has(tick)) {
        const latestPair = portPairs[portPairs.length - 1];
        latestPair.serverPort.disconnect();
        flush();
        // Verify auto-recovery reconnected immediately via GMAH_TAB_KEEPALIVE
        assert.deepStrictEqual(bg.getConnectedTabIds(), [201], `Must recover immediately after SW disconnect at tick ${tick}`);
      }

      if (allowTicks.has(tick)) {
        if (activeAllow) activeAllow.remove();
        activeAllow = contentEnv.doc.createElement('button', { text: 'Always allow', rect: { width: 0, height: 0 } });
        contentEnv.doc.body.appendChild(activeAllow);
        moCb([{ target: contentEnv.doc.body, addedNodes: [activeAllow] }]);
        flush();
        assert.strictEqual(activeAllow.clickCount, 1, `Allow at tick ${tick} must click`);
        allowsClicked += 1;
        activeAllow.remove();
        activeAllow = null;
      }

      if (continueTicks.has(tick)) {
        if (activeContinue) activeContinue.remove();
        activeContinue = contentEnv.doc.createElement('button', { text: '继续', rect: { width: 0, height: 0 } });
        const turn = addTurn(contentEnv.doc, `第 ${tick} 阶段分析输出完成，准备下一步...`, [activeContinue]);
        moCb([{ target: turn, addedNodes: [activeContinue] }]);
        flush();
        // Still settling right after mutation
        assert.strictEqual(activeContinue.clickCount, 0);
      }

      if (swIntervalFn) swIntervalFn();
      flush();

      if (activeContinue && activeContinue.clickCount === 1) {
        continuesClicked += 1;
        activeContinue.remove();
        activeContinue = null;
      }

      // Periodic alarm every 20 ticks (30 seconds)
      if (tick % 20 === 0) {
        bg.handleAlarm({ name: ALARM_NAME });
        flush();
      }
    }

    assert.strictEqual(allowsClicked, 8);
    assert.strictEqual(continuesClicked, 6);
    assert.strictEqual(storageData[D.STATS_KEY].allowCount, 8);
    assert.strictEqual(storageData[D.STATS_KEY].continueCount, 6);
    assert.ok(portPairs.length >= 9, `Expected >= 9 port connections (1 initial + 7 rotations + 2 crashes), got ${portPairs.length}`);
    assert.ok(platformKeepaliveCount >= 80, `Expected >= 80 MV3 keepalives over 30m, got ${platformKeepaliveCount}`);
    assert.deepStrictEqual(bg.getConnectedTabIds(), [201]);
  });

  // 2. Recycled Continue button DOM node: when fingerprint changes after click, it is NOT falsely retried
  test('stress: recycled Continue DOM node whose click succeeded clears retry entry and proceeds cleanly on next turn', () => {
    const { doc, win } = createEnv();
    let now = 20000;
    doc.hidden = true;

    const persistentBtn = doc.createElement('button', { text: '继续' });
    doc.body.appendChild(persistentBtn);
    addTurn(doc, '第一轮回答内容，尚未结束。');

    const engine = new GmahEngine({
      doc,
      win,
      now: () => now,
      settings: { continueCooldownMs: 4000, idleSettleMs: 1000 }
    });

    const r1 = engine.scanOnce();
    assert.strictEqual(r1.action, 'clicked_continue');
    assert.strictEqual(persistentBtn.clickCount, 1);
    assert.strictEqual(engine.taskContinueCount, 1);

    // Attempt 1 succeeded! Gemini appends a NEW turn while keeping the SAME persistentBtn DOM node mounted
    addTurn(doc, '第二轮回答内容，有了全新进展！');
    now += 3600; // Past retry delay (3500ms), still inside 4000ms continue cooldown
    const rWait = engine.scanOnce();
    assert.strictEqual(rWait.action, 'wait', 'Changed fingerprint proves attempt 1 succeeded; must respect cooldown instead of false retry');
    assert.strictEqual(rWait.reason, 'cooldown');
    assert.strictEqual(persistentBtn.clickCount, 1);

    // Once cooldown elapses, the recycled button clicks cleanly as Turn 2
    now += 600;
    const r2 = engine.scanOnce();
    assert.strictEqual(r2.action, 'clicked_continue');
    assert.strictEqual(persistentBtn.clickCount, 2);
    assert.strictEqual(engine.taskContinueCount, 2);
  });

  // 3. Adversarial 3-level nested Shadow DOM + 500 noisy mutations storm
  test('stress: 3-level nested Shadow DOM with split spans & zero-width chars, plus 500 noisy mutations never block settle', () => {
    const { doc, win } = createEnv();
    let now = 60000;

    // 3-level nested Shadow DOM
    const h1 = doc.createElement('outer-shell');
    const sr1 = h1.attachShadow();
    const h2 = doc.createElement('dialog-card');
    const sr2 = h2.attachShadow();
    const h3 = doc.createElement('action-bar');
    const sr3 = h3.attachShadow();
    const deepBtn = doc.createElement('button');
    deepBtn.appendChild(doc.createElement('span', { text: 'Always\u200B' }));
    deepBtn.appendChild(doc.createElement('span', { text: 'allow' }));
    sr3.appendChild(deepBtn);
    sr2.appendChild(h3);
    sr1.appendChild(h2);
    doc.body.appendChild(h1);

    const engine = new GmahEngine({ doc, win, now: () => now, settings: { idleSettleMs: 1800 } });
    const rAllow = engine.scanOnce();
    assert.strictEqual(rAllow.action, 'clicked_allow');
    assert.strictEqual(deepBtn.clickCount, 1);

    // Remove dialog, add turn + Continue, then simulate 500 noisy ripple/tooltip mutations
    h1.remove();
    const contBtn = doc.createElement('button', { text: '继续' });
    addTurn(doc, '第 1 部分代码输出完毕', [contBtn]);
    engine.recordMutation();

    for (let i = 0; i < 500; i++) {
      now += 10;
      const noisyNode =
        i % 3 === 0
          ? doc.createElement('span', { className: 'mat-mdc-ripple-element' })
          : i % 3 === 1
            ? doc.createElement('div', { attrs: { role: 'tooltip' }, text: 'Copy' })
            : doc.createElement('mat-icon', { text: 'content_copy' });
      assert.strictEqual(isNoisyMutationTarget(noisyNode), true);
      // Only non-noisy mutations call recordMutation()
      if (!isNoisyMutationTarget(noisyNode)) {
        engine.recordMutation();
      }
    }

    // 500 * 10ms = 5000ms > 1800ms settle -> clicks Continue cleanly despite 500 UI ripple/tooltip events
    const rCont = engine.scanOnce();
    assert.strictEqual(rCont.action, 'clicked_continue');
    assert.strictEqual(contBtn.clickCount, 1);
  });

  // 4. Adversarial False-Positive Matrix across all 4 languages (ZERO unsafe clicks allowed)
  test('adversarial: 20+ dangerous, unrelated, survey, dialog, nav, and code buttons across 4 languages are NEVER clicked', () => {
    const { doc, win } = createEnv();
    let now = 90000;
    addTurn(doc, '这是一段普通回复内容。');

    const dangerousButtons = [];
    const addDanger = (parent, tag, opts) => {
      const b = doc.createElement(tag, opts);
      parent.appendChild(b);
      dangerousButtons.push(b);
      return b;
    };

    const rawLabels = [
      'Deny', 'Cancel', 'Delete', "Don't allow", 'Never allow', 'Reject', 'Remove', 'Sign out',
      '拒绝', '取消', '删除', '不允许', '不要', '停止', '关闭',
      '許可しない', '拒否', 'キャンセル', '削除',
      'Allow notifications', 'Accept cookies', 'Allow camera', 'Allow microphone', '允许访问位置',
      '继续优化代码性能', 'Continue exploring alternatives', 'Continue to billing', 'Allow all cookies',
      'Allow', '同意', '允许', 'Yes', '确认', 'はい'
    ];
    for (const label of rawLabels) {
      addDanger(doc.body, 'button', { text: label });
    }

    // Survey [Yes][No]
    const survey = doc.createElement('div', { className: 'survey' });
    addDanger(survey, 'button', { className: 'follow-up-chip', text: '↪ Yes' });
    addDanger(survey, 'button', { text: 'No' });
    doc.body.appendChild(survey);

    // Modal dialog [Cancel][确认]
    const modal = doc.createElement('div', { attrs: { role: 'dialog' } });
    addDanger(modal, 'button', { text: 'Cancel' });
    addDanger(modal, 'button', { text: '确认' });
    doc.body.appendChild(modal);

    // Nav & Code blocks containing "始终允许" / "继续"
    const nav = doc.createElement('nav');
    addDanger(nav, 'button', { text: '始终允许' });
    addDanger(nav, 'button', { text: '继续' });
    doc.body.appendChild(nav);

    const pre = doc.createElement('pre');
    addDanger(pre, 'button', { text: 'Always allow' });
    addDanger(pre, 'button', { text: 'Continue' });
    doc.body.appendChild(pre);

    const engine = new GmahEngine({ doc, win, now: () => now });
    for (let i = 0; i < 5; i++) {
      now += 5000;
      const res = engine.scanOnce();
      assert.strictEqual(res.action, 'noop', `Unexpected action ${res.action} (${res.label || res.reason})`);
    }
    for (const btn of dangerousButtons) {
      assert.strictEqual(btn.clickCount, 0, `Dangerous/unrelated button was clicked: "${btn.textContent}"`);
    }
  });

  // 5. All-4-Language i18n Key Parity & popup.html attribute audit
  test('i18n audit: all 4 locales have 100% key parity, matching placeholders, and cover every popup.html data-i18n key', () => {
    const baseDict = D.UI_I18N['zh-CN'];
    const baseKeys = Object.keys(baseDict);
    const extractVars = (str) => (String(str).match(/\{[a-zA-Z0-9_]+\}/g) || []).sort();

    for (const lang of D.SUPPORTED_LANGUAGES) {
      const dict = D.UI_I18N[lang];
      assert.ok(dict, `Missing UI_I18N dictionary for ${lang}`);
      for (const key of baseKeys) {
        assert.ok(
          Object.prototype.hasOwnProperty.call(dict, key) && typeof dict[key] === 'string' && dict[key].length > 0,
          `Locale ${lang} missing or empty i18n key: ${key}`
        );
        assert.deepStrictEqual(
          extractVars(dict[key]),
          extractVars(baseDict[key]),
          `Placeholder mismatch for ${lang}.${key}: "${dict[key]}" vs "${baseDict[key]}"`
        );
      }
    }

    // Verify every data-i18n / data-i18n-placeholder / data-i18n-title in popup.html exists in zh-CN
    const popupHtml = fs.readFileSync(path.join(ROOT, 'popup.html'), 'utf8');
    const attrRegex = /data-i18n(?:-(?:placeholder|title))?="([^"]+)"/g;
    let m;
    let checked = 0;
    while ((m = attrRegex.exec(popupHtml)) !== null) {
      checked += 1;
      assert.ok(
        Object.prototype.hasOwnProperty.call(baseDict, m[1]),
        `popup.html references unknown i18n key: ${m[1]}`
      );
    }
    assert.ok(checked >= 35, `Expected >= 35 i18n attributes in popup.html, found ${checked}`);
  });

  // 6. Multi-Tab Concurrent Stats Delta Merge (no lost updates across 2 live tabs)
  test('stress: 2 concurrent Gemini tabs sharing chrome.storage.local never clobber each others allow/continue stats', () => {
    let clock = 2000000;
    const today = D.getTodayKey(new Date(clock));
    const sharedStorage = {
      [D.STORAGE_KEY]: D.mergeSettings({ enabled: true, autoAllow: true, autoContinue: true, idleSettleMs: 400, continueCooldownMs: 1000 }),
      [D.STATS_KEY]: D.createEmptyStats(today)
    };
    const clone = (o) => JSON.parse(JSON.stringify(o));
    const storageListeners = [];
    const FakeDate = class extends Date {
      constructor(...args) { super(...(args.length === 0 ? [clock] : args)); }
      static now() { return clock; }
    };

    const createTabSandbox = (tabId) => {
      const env = createEnv(GEMINI_ORIGIN + `/app/tab-${tabId}`);
      const chromeMock = {
        runtime: {
          id: 'gmah-multi',
          lastError: null,
          connect() {
            return {
              postMessage() {},
              disconnect() {},
              onMessage: { addListener() {} },
              onDisconnect: { addListener() {} }
            };
          },
          sendMessage(_m, cb) { if (cb) cb({ ok: true }); },
          onMessage: { addListener() {} }
        },
        storage: {
          local: {
            get(_k, cb) { cb(clone(sharedStorage)); },
            set(obj, cb) {
              const prev = clone(sharedStorage);
              Object.assign(sharedStorage, clone(obj));
              const changes = {};
              for (const k of Object.keys(obj)) {
                changes[k] = { oldValue: prev[k], newValue: clone(sharedStorage[k]) };
              }
              for (const fn of storageListeners.slice()) fn(changes, 'local');
              if (cb) cb();
            }
          },
          onChanged: { addListener(fn) { storageListeners.push(fn); } }
        }
      };

      let heartbeatFn = null;
      const sandbox = {
        window: env.win,
        document: env.doc,
        localStorage: env.localStorageMock,
        chrome: chromeMock,
        Date: FakeDate,
        MutationObserver: class { observe() {} disconnect() {} },
        setTimeout: () => 1,
        clearTimeout: () => {},
        setInterval: (fn) => { heartbeatFn = fn; return 1; },
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
      return { env, tick: () => heartbeatFn && heartbeatFn() };
    };

    const tabA = createTabSandbox(1);
    const tabB = createTabSandbox(2);

    // Move past initial 2000ms stale-continue suppression window
    clock += 3000;

    // Tab A clicks 2 Allows (spaced past allowCooldownMs)
    for (let i = 0; i < 2; i++) {
      const b = tabA.env.doc.createElement('button', { text: '始终允许' });
      tabA.env.doc.body.appendChild(b);
      tabA.tick();
      assert.strictEqual(b.clickCount, 1);
      b.remove();
      clock += 1000;
    }

    // Tab B clicks 1 Allow + 2 Continues
    const bB = tabB.env.doc.createElement('button', { text: '始终允许' });
    tabB.env.doc.body.appendChild(bB);
    tabB.tick();
    assert.strictEqual(bB.clickCount, 1);
    bB.remove();

    for (let i = 1; i <= 2; i++) {
      clock += 1500;
      const cB = tabB.env.doc.createElement('button', { text: '继续' });
      addTurn(tabB.env.doc, `Tab B 输出第 ${i} 阶段`, [cB]);
      tabB.tick();
      assert.strictEqual(cB.clickCount, 1);
      cB.remove();
    }

    assert.strictEqual(sharedStorage[D.STATS_KEY].allowCount, 3, 'Tab A (2) + Tab B (1) allow clicks must sum to 3');
    assert.strictEqual(sharedStorage[D.STATS_KEY].continueCount, 2, 'Tab B (2) continue clicks must be preserved');
  });

  // 7. Popup input clamping & debounced auto-save stress
  test('adversarial: popup clamps extreme numeric inputs and saves custom keywords on change without throwing', () => {
    const env = createEnv('chrome-extension://test/popup.html');
    const pdoc = env.doc;
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
    for (const id of ids) pdoc.body.appendChild(pdoc.createElement('input', { id }));

    const store = {
      [D.STORAGE_KEY]: D.mergeSettings({}),
      [D.STATS_KEY]: D.createEmptyStats()
    };
    const mockChrome = {
      runtime: { lastError: null, sendMessage() {} },
      storage: {
        local: {
          get(_k, cb) { cb(JSON.parse(JSON.stringify(store))); },
          set(obj, cb) { Object.assign(store, JSON.parse(JSON.stringify(obj))); if (cb) cb(); }
        }
      },
      tabs: {
        query(_q, cb) { cb([]); }
      }
    };

    const popup = createPopupController(pdoc, mockChrome);
    popup.init();

    // Feed extreme out-of-range values
    pdoc.getElementById('maxContinuesPerTask').value = '999999';
    pdoc.getElementById('dailyContinueLimit').value = '-50';
    pdoc.getElementById('stallAlertMinutes').value = '0';
    pdoc.getElementById('customAlwaysAllowKeywords').value = '同意执行, Always Permit\n同意执行';
    pdoc.getElementById('customAlwaysAllowKeywords').dispatchEvent({ type: 'change' });

    assert.strictEqual(store[D.STORAGE_KEY].maxContinuesPerTask, 100);
    assert.strictEqual(store[D.STORAGE_KEY].dailyContinueLimit, 0);
    assert.strictEqual(store[D.STORAGE_KEY].stallAlertMinutes, 1);
    assert.deepStrictEqual(store[D.STORAGE_KEY].customAlwaysAllowKeywords, ['同意执行', 'Always Permit']);
  });
}

module.exports = { runTests };
