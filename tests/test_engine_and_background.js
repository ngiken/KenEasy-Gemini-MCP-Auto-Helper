'use strict';

const assert = require('assert');
const D = require('../defaults.js');
const { GmahEngine, getAssistantTurns, getElementLabel, defaultClickElement, isNonChatGeminiUrl } = require('../content.js');
const { createBackgroundController, isGeminiUrl, ALARM_NAME } = require('../background.js');
const { createHud } = require('../hud.js');
const { createPopupController } = require('../popup.js');

// ---------------------------------------------------------------------------
// Minimal standards-compliant DOM & Chrome API mocks for deterministic testing
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
  return String(selectorList || '')
    .split(',')
    .some((part) => matchSingleSelector(el, part));
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
    this.style = Object.assign({ display: '', visibility: '', opacity: '', pointerEvents: '' }, opts.style || {});
    this.disabled = Boolean(opts.disabled);
    this.hidden = Boolean(opts.hidden);
    this.checked = Boolean(opts.checked);
    this.value = opts.value !== undefined ? String(opts.value) : '';
    this.rect = opts.rect || { width: 100, height: 32 };
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

  set innerHTML(val) {
    this.children = [];
    this._ownText = String(val);
  }

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
    this.dispatchedEvents.push(ev.type);
    const list = (this._listeners.get(ev.type) || []).slice();
    for (const fn of list) fn(ev);
    return true;
  }

  closest(selector) {
    let cur = this;
    while (cur && cur.nodeType === 1) {
      if (matchesSelectorList(cur, selector)) return cur;
      cur = cur.parentNode;
    }
    return null;
  }

  get classList() {
    const self = this;
    return {
      contains(cls) {
        return String(self.className || '').split(/\s+/).includes(cls);
      },
      add(cls) {
        const parts = String(self.className || '').split(/\s+/).filter(Boolean);
        if (!parts.includes(cls)) {
          parts.push(cls);
          self.className = parts.join(' ');
        }
      },
      remove(cls) {
        const parts = String(self.className || '').split(/\s+/).filter((c) => c && c !== cls);
        self.className = parts.join(' ');
      }
    };
  }

  click() {
    this.clickCount += 1;
    this.dispatchEvent({ type: 'click', target: this });
  }
}

function createMockEnv(url) {
  const docListeners = new Map();
  const doc = {
    hidden: false,
    body: null,
    documentElement: null,
    createElement(tag, opts) { return new MockNode(tag, doc, opts); },
    getElementById(id) { return doc.body ? doc.body.querySelector(`#${id}`) : null; },
    querySelectorAll(sel) { return doc.body ? doc.body.querySelectorAll(sel) : []; },
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
      const list = (docListeners.get(ev.type) || []).slice();
      for (const fn of list) fn(ev);
      return true;
    }
  };
  doc.documentElement = new MockNode('html', doc);
  doc.body = new MockNode('body', doc);
  doc.documentElement.appendChild(doc.body);

  class MockEvent {
    constructor(type, init) {
      this.type = type;
      Object.assign(this, init || {});
    }
  }

  const mockStorage = new Map();
  const localStorageMock = {
    getItem(k) { return mockStorage.has(String(k)) ? mockStorage.get(String(k)) : null; },
    setItem(k, v) { mockStorage.set(String(k), String(v)); },
    removeItem(k) { mockStorage.delete(String(k)); },
    clear() { mockStorage.clear(); }
  };

  const win = {
    innerWidth: 1440,
    innerHeight: 900,
    location: { href: url || 'https://gemini.google.com/app/chat-1' },
    PointerEvent: MockEvent,
    MouseEvent: MockEvent,
    localStorage: localStorageMock,
    getComputedStyle(el) {
      return el.style || { display: '', visibility: '', opacity: '', pointerEvents: '' };
    }
  };

  return { doc, win, localStorageMock };
}

function addTurn(doc, text, extraChildren) {
  const turn = doc.createElement('model-response', { text });
  if (Array.isArray(extraChildren)) {
    for (const child of extraChildren) turn.appendChild(child);
  }
  doc.body.appendChild(turn);
  return turn;
}

function runTests(test) {
  // 1. Auto-Allow: prefer Always Allow, ignore blacklist, works mid-generation & inside Shadow DOM
  test('auto-allow prefers Always Allow over Single Allow, ignores Deny, and works mid-stream + Shadow DOM', () => {
    const { doc, win } = createMockEnv();
    let now = 10000;

    doc.body.appendChild(doc.createElement('button', { attrs: { 'aria-label': 'Stop generating' }, text: '' }));

    const host = doc.createElement('mcp-permission-dialog');
    const sr = host.attachShadow();
    const denyBtn = doc.createElement('button', { text: '拒绝' });
    const allowOnceBtn = doc.createElement('button', { text: '允许一次' });
    const alwaysAllowBtn = doc.createElement('button', { text: '在此对话中始终允许' });
    sr.appendChild(denyBtn);
    sr.appendChild(allowOnceBtn);
    sr.appendChild(alwaysAllowBtn);
    doc.body.appendChild(host);

    const engine = new GmahEngine({ doc, win, now: () => now });
    const res = engine.scanOnce();

    assert.strictEqual(res.action, 'clicked_allow');
    assert.strictEqual(res.tier, 'always');
    assert.strictEqual(alwaysAllowBtn.clickCount, 1);
    assert.strictEqual(allowOnceBtn.clickCount, 0);
    assert.strictEqual(denyBtn.clickCount, 0);
    assert.strictEqual(engine.stats.allowCount, 1);

    assert.ok(alwaysAllowBtn.dispatchedEvents.includes('pointerdown'));
    assert.ok(alwaysAllowBtn.dispatchedEvents.includes('mousedown'));
    assert.ok(alwaysAllowBtn.dispatchedEvents.includes('pointerup'));
    assert.ok(alwaysAllowBtn.dispatchedEvents.includes('mouseup'));
    assert.ok(alwaysAllowBtn.dispatchedEvents.includes('click'));

    // Re-scanning while same button still mounted must NOT double-click it
    now += 2000;
    const res2 = engine.scanOnce();
    assert.strictEqual(alwaysAllowBtn.clickCount, 1);
    assert.notStrictEqual(res2.action, 'clicked_allow');
  });

  // 2. Auto-Allow fallback + sibling context guard + cookie/notification exclusion + blacklist safety
  test('auto-allow single fallback requires sibling context for prefixed labels and skips cookies/blacklist', () => {
    const { doc, win } = createMockEnv();
    let now = 20000;

    const cookieBtn = doc.createElement('button', { text: 'Allow cookies' });
    const neverBtn = doc.createElement('button', { text: 'Never allow' });
    const dontBtn = doc.createElement('button', { text: "Don't allow" });
    const isolatedPrefixed = doc.createElement('button', { text: 'Allow Desktop Commander' });
    doc.body.appendChild(cookieBtn);
    doc.body.appendChild(neverBtn);
    doc.body.appendChild(dontBtn);
    doc.body.appendChild(isolatedPrefixed);

    const engine = new GmahEngine({ doc, win, now: () => now });
    assert.strictEqual(engine.scanOnce().action, 'noop');
    assert.strictEqual(cookieBtn.clickCount, 0);
    assert.strictEqual(neverBtn.clickCount, 0);
    assert.strictEqual(dontBtn.clickCount, 0);
    assert.strictEqual(isolatedPrefixed.clickCount, 0);

    const card = doc.createElement('div', { className: 'mcp-card' });
    const deny = doc.createElement('button', { text: 'Deny' });
    const allowTool = doc.createElement('button', { text: 'Allow Desktop Commander' });
    card.appendChild(deny);
    card.appendChild(allowTool);
    doc.body.appendChild(card);

    now += 1000;
    const r1 = engine.scanOnce();
    assert.strictEqual(r1.action, 'clicked_allow');
    assert.strictEqual(r1.tier, 'single');
    assert.strictEqual(allowTool.clickCount, 1);
    assert.strictEqual(deny.clickCount, 0);

    card.remove();
    const card2 = doc.createElement('div');
    const allowOnce = doc.createElement('button', { text: '允许一次' });
    card2.appendChild(allowOnce);
    doc.body.appendChild(card2);

    engine.updateSettings({ fallbackSingleAllow: false });
    now += 1000;
    assert.strictEqual(engine.scanOnce().action, 'noop');
    assert.strictEqual(allowOnce.clickCount, 0);
  });

  // 3. getAssistantTurns fallback & nested turn deduplication
  test('getAssistantTurns falls back when earlier selector only matches ignored/hidden nodes and flattens nested turns', () => {
    const { doc, win } = createMockEnv();
    let now = 25000;

    // Ignored <model-response> inside <nav> and a hidden template <model-response hidden>
    const nav = doc.createElement('nav');
    nav.appendChild(doc.createElement('model-response', { text: 'sidebar preview' }));
    doc.body.appendChild(nav);
    doc.body.appendChild(doc.createElement('model-response', { text: 'hidden template', hidden: true }));

    // Real turns use fallback selector ".response-container" with a nested ".response-container" inside
    const turn1 = doc.createElement('div', { className: 'response-container', text: '旧回复' });
    const oldBtn = doc.createElement('button', { text: '继续' });
    turn1.appendChild(oldBtn);

    const turn2Outer = doc.createElement('div', { className: 'response-container', text: '新回复外层 ' });
    const turn2Inner = doc.createElement('div', { className: 'response-container', text: '新回复内层' });
    const liveContBtn = doc.createElement('button', { text: '继续' });
    turn2Outer.appendChild(turn2Inner);
    turn2Outer.appendChild(liveContBtn);

    doc.body.appendChild(turn1);
    doc.body.appendChild(turn2Outer);

    const turns = getAssistantTurns(doc);
    assert.strictEqual(turns.length, 2);
    assert.strictEqual(turns[0], turn1);
    assert.strictEqual(turns[1], turn2Outer);

    // Engine must ignore oldBtn in turn1 and click liveContBtn in turn2Outer
    const engine = new GmahEngine({ doc, win, now: () => now });
    const res = engine.scanOnce();
    assert.strictEqual(res.action, 'clicked_continue');
    assert.strictEqual(liveContBtn.clickCount, 1);
    assert.strictEqual(oldBtn.clickCount, 0);
  });

  // 4. Auto-Continue strict matching: ignores follow-up chips, old turns, code blocks, nav; deduplicates nested mat-chip
  test('auto-continue ignores follow-up chips, old turns, code blocks, nav and deduplicates nested mat-chip', () => {
    const { doc, win } = createMockEnv();
    let now = 30000;

    const oldContBtn = doc.createElement('button', { text: '继续' });
    addTurn(doc, '第一轮输出内容', [oldContBtn]);

    const pre = doc.createElement('pre');
    const codeBtn = doc.createElement('button', { text: 'Continue' });
    pre.appendChild(codeBtn);
    doc.body.appendChild(pre);

    const nav = doc.createElement('nav');
    const navBtn = doc.createElement('button', { text: '继续' });
    nav.appendChild(navBtn);
    doc.body.appendChild(nav);

    const followUp1 = doc.createElement('button', { className: 'follow-up-chip', text: '继续优化这段代码的性能' });
    const followUp2 = doc.createElement('button', { className: 'suggestion-chip', text: 'Continue exploring architecture' });
    const latestTurn = addTurn(doc, '已完成第一阶段分析，还需要继续处理剩余文件。', [followUp1, followUp2]);

    const engine = new GmahEngine({ doc, win, now: () => now });
    assert.strictEqual(engine.scanOnce().action, 'noop');
    assert.strictEqual(oldContBtn.clickCount, 0);
    assert.strictEqual(codeBtn.clickCount, 0);
    assert.strictEqual(navBtn.clickCount, 0);
    assert.strictEqual(followUp1.clickCount, 0);
    assert.strictEqual(followUp2.clickCount, 0);

    const chip = doc.createElement('mat-chip', { className: 'mat-mdc-chip' });
    const innerBtn = doc.createElement('button', { text: '继续' });
    chip.appendChild(innerBtn);
    latestTurn.appendChild(chip);

    now += 3000;
    const r1 = engine.scanOnce();
    assert.strictEqual(r1.action, 'clicked_continue');
    assert.strictEqual(innerBtn.clickCount, 1);
    assert.strictEqual(chip.clickCount, 0);
  });

  // 5. Layer B (generating + settle + cooldown) & Layer C (per-task limit + reset on manual prompt / SPA nav)
  test('layer B & C: waits for streaming/settle/cooldown, trips per-task limit, resets on prompt or URL change', () => {
    const { doc, win } = createMockEnv('https://gemini.google.com/app/chat-1');
    let now = 50000;

    const stopBtn = doc.createElement('button', { attrs: { 'aria-label': '停止' } });
    doc.body.appendChild(stopBtn);

    const contBtn = doc.createElement('button', { text: '继续生成' });
    addTurn(doc, '阶段1输出内容', [contBtn]);

    const engine = new GmahEngine({
      doc,
      win,
      now: () => now,
      settings: { maxContinuesPerTask: 2, continueCooldownMs: 4000, idleSettleMs: 1800 }
    });

    assert.strictEqual(engine.scanOnce().reason, 'generating');
    assert.strictEqual(contBtn.clickCount, 0);

    stopBtn.remove();
    engine.recordMutation();
    now += 1000;
    assert.strictEqual(engine.scanOnce().reason, 'settling');

    now += 1000;
    const c1 = engine.scanOnce();
    assert.strictEqual(c1.action, 'clicked_continue');
    assert.strictEqual(c1.taskContinueCount, 1);

    contBtn.remove();
    const contBtn2 = doc.createElement('button', { text: '继续生成' });
    addTurn(doc, '阶段2输出了全新的进展内容', [contBtn2]);
    now += 2500;
    assert.strictEqual(engine.scanOnce().reason, 'cooldown');

    now += 2000;
    const c2 = engine.scanOnce();
    assert.strictEqual(c2.action, 'clicked_continue');
    assert.strictEqual(c2.taskContinueCount, 2);

    contBtn2.remove();
    const contBtn3 = doc.createElement('button', { text: '继续生成' });
    addTurn(doc, '阶段3又输出了新内容', [contBtn3]);
    now += 5000;
    const c3 = engine.scanOnce();
    assert.strictEqual(c3.action, 'tripped');
    assert.strictEqual(c3.reason, 'task_limit');
    assert.strictEqual(contBtn3.clickCount, 0);

    engine.onUserManualPrompt();
    assert.strictEqual(engine.circuitBreaker.tripped, false);
    assert.strictEqual(engine.taskContinueCount, 0);

    now += 2500;
    const c4 = engine.scanOnce();
    assert.strictEqual(c4.action, 'clicked_continue');
    assert.strictEqual(c4.taskContinueCount, 1);

    win.location.href = 'https://gemini.google.com/app/chat-2';
    now += 5000;
    engine.scanOnce();
    assert.strictEqual(engine.taskContinueCount, 0);
  });

  // 6. Layer D (daily limit + next-day auto-reset)
  test('layer D: trips daily continue limit and auto-resets when date rolls to next day', () => {
    const { doc, win } = createMockEnv();
    let now = new Date('2026-11-20T23:55:00').getTime();

    const contBtn = doc.createElement('button', { text: 'Continue' });
    addTurn(doc, 'Partial response part 1', [contBtn]);

    const engine = new GmahEngine({
      doc,
      win,
      now: () => now,
      settings: { maxContinuesPerTask: 10, dailyContinueLimit: 2, continueCooldownMs: 1000, idleSettleMs: 400 },
      stats: { date: '2026-11-20', allowCount: 3, continueCount: 2 }
    });

    const r1 = engine.scanOnce();
    assert.strictEqual(r1.action, 'tripped');
    assert.strictEqual(r1.reason, 'daily_limit');
    assert.strictEqual(contBtn.clickCount, 0);

    now = new Date('2026-11-21T00:05:00').getTime();
    const r2 = engine.scanOnce();
    assert.strictEqual(r2.action, 'clicked_continue');
    assert.strictEqual(engine.stats.date, '2026-11-21');
    assert.strictEqual(engine.stats.continueCount, 1);
    assert.strictEqual(contBtn.clickCount, 1);
  });

  // 7. Layer F (completion cue guard vs truncation cue override)
  test('layer F: skips continue on completion cues unless explicit truncation cue is present', () => {
    const { doc, win } = createMockEnv();
    let now = 80000;

    const contBtn1 = doc.createElement('button', { text: '继续' });
    addTurn(doc, '所有步骤已完成，全部测试通过！你可以直接使用了。', [contBtn1]);

    const engine = new GmahEngine({ doc, win, now: () => now });
    const r1 = engine.scanOnce();
    assert.strictEqual(r1.action, 'skipped');
    assert.strictEqual(r1.reason, 'completion_cue');
    assert.strictEqual(contBtn1.clickCount, 0);

    contBtn1.remove();
    const contBtn2 = doc.createElement('button', { text: '继续' });
    addTurn(doc, '前半部分全部完成，但已达单次输出上限，请点击继续生成剩余代码。', [contBtn2]);

    now += 5000;
    const r2 = engine.scanOnce();
    assert.strictEqual(r2.action, 'clicked_continue');
    assert.strictEqual(contBtn2.clickCount, 1);
  });

  // 8. Layer G (stagnant output: both unchanged DOM and identical repeated text in a new turn)
  test('layer G: trips stagnant_output breaker on unchanged DOM and on repeated identical replies across turns', () => {
    const { doc, win } = createMockEnv();
    let now = 100000;

    const btn1 = doc.createElement('button', { text: '继续' });
    addTurn(doc, '正在分析文件 A，请稍候...', [btn1]);

    const engine = new GmahEngine({
      doc,
      win,
      now: () => now,
      settings: { continueCooldownMs: 1000, idleSettleMs: 400 }
    });

    assert.strictEqual(engine.scanOnce().action, 'clicked_continue');

    // New turn appended, but Gemini repeats the EXACT same output text
    btn1.remove();
    const btn2 = doc.createElement('button', { text: '继续' });
    addTurn(doc, '正在分析文件 A，请稍候...', [btn2]);

    now += 3000;
    const r2 = engine.scanOnce();
    assert.strictEqual(r2.action, 'tripped');
    assert.strictEqual(r2.reason, 'stagnant_output');
    assert.strictEqual(btn2.clickCount, 0);
  });

  // 9. Layer A (quota/error alert) + Emergency Stop blocks BOTH allow and continue
  test('layer A & emergency stop: quota alert trips immediately; emergency stop blocks both allow and continue', () => {
    const { doc, win } = createMockEnv();
    let now = 120000;

    const alertBanner = doc.createElement('div', {
      attrs: { role: 'alert' },
      text: 'You have reached your limit. Please try again later.'
    });
    const contBtn = doc.createElement('button', { text: '继续' });
    doc.body.appendChild(alertBanner);
    addTurn(doc, '部分回答', [contBtn]);

    const engine = new GmahEngine({ doc, win, now: () => now });
    const r1 = engine.scanOnce();
    assert.strictEqual(r1.action, 'tripped');
    assert.strictEqual(r1.reason, 'quota_error');
    assert.strictEqual(contBtn.clickCount, 0);

    alertBanner.remove();
    engine.clearBreaker();
    engine.emergencyStop();

    const alwaysBtn = doc.createElement('button', { text: '始终允许' });
    doc.body.appendChild(alwaysBtn);

    now += 2000;
    const r2 = engine.scanOnce();
    assert.strictEqual(r2.action, 'blocked');
    assert.strictEqual(r2.reason, 'emergency_stop');
    assert.strictEqual(alwaysBtn.clickCount, 0);

    engine.clearBreaker();
    now += 2000;
    const r3 = engine.scanOnce();
    assert.strictEqual(r3.action, 'clicked_allow');
    assert.strictEqual(alwaysBtn.clickCount, 1);
  });

  // 10. Minimized window visibility, pointer-events:none filtering, and Angular recycled button pruning
  test('minimized window allows 0x0 live buttons while rejecting hidden/pointer-events:none; prunes unmounted buttons', () => {
    const { doc, win } = createMockEnv();
    let now = 150000;

    doc.hidden = true;
    win.innerWidth = 0;
    win.innerHeight = 0;

    const hiddenParent = doc.createElement('div', { style: { display: 'none' } });
    const ghostBtn = doc.createElement('button', { text: '始终允许', rect: { width: 0, height: 0 } });
    hiddenParent.appendChild(ghostBtn);
    doc.body.appendChild(hiddenParent);

    const noPointerBtn = doc.createElement('button', {
      text: '始终允许',
      rect: { width: 0, height: 0 },
      style: { pointerEvents: 'none' }
    });
    doc.body.appendChild(noPointerBtn);

    const liveBtn = doc.createElement('button', { text: '始终允许', rect: { width: 0, height: 0 } });
    doc.body.appendChild(liveBtn);

    const engine = new GmahEngine({ doc, win, now: () => now });
    const r1 = engine.scanOnce();
    assert.strictEqual(r1.action, 'clicked_allow');
    assert.strictEqual(r1.element, liveBtn);
    assert.strictEqual(ghostBtn.clickCount, 0);
    assert.strictEqual(noPointerBtn.clickCount, 0);
    assert.strictEqual(liveBtn.clickCount, 1);

    // Angular recycles the same button node: removed, pruned, then re-mounted
    liveBtn.remove();
    now += 1000;
    engine.scanOnce();

    doc.body.appendChild(liveBtn);
    now += 1000;
    const r2 = engine.scanOnce();
    assert.strictEqual(r2.action, 'clicked_allow');
    assert.strictEqual(liveBtn.clickCount, 2);
  });

  // 11. Custom keywords + inspectVisibleButtons
  test('inspectVisibleButtons lists clickable labels and addCustomKeyword enables matching custom phrases', () => {
    const { doc, win } = createMockEnv();
    let now = 180000;

    const customBtn = doc.createElement('button', { text: '接着干完它' });
    addTurn(doc, '任务正在进行中...', [customBtn]);

    const engine = new GmahEngine({ doc, win, now: () => now });
    assert.strictEqual(engine.scanOnce().action, 'noop');

    const inspected = engine.inspectVisibleButtons();
    assert.ok(inspected.some((b) => b.text === '接着干完它'));

    engine.addCustomKeyword('continue', '接着干完它');
    now += 2000;
    const res = engine.scanOnce();
    assert.strictEqual(res.action, 'clicked_continue');
    assert.strictEqual(customBtn.clickCount, 1);
  });

  // 12. Background Service Worker controller: port heartbeat, PONG, autoDiscardable protection, alarms & storage toggle
  test('background.js manages ports, heartbeats, PONG ack, tab discard protection, alarms, and storage changes', () => {
    assert.strictEqual(isGeminiUrl('https://gemini.google.com/app'), true);
    assert.strictEqual(isGeminiUrl('https://gemini.google.com/'), true);
    assert.strictEqual(isGeminiUrl('https://google.com/'), false);

    const store = {
      [D.STORAGE_KEY]: { enabled: true, backgroundMode: true, preventTabDiscard: true }
    };
    const updatedTabs = [];
    const sentMessages = [];
    const createdAlarms = [];
    const clearedAlarms = [];
    let intervalCb = null;
    let intervalId = 0;

    const mockChrome = {
      runtime: {
        lastError: null,
        onConnect: { addListener() {} },
        onInstalled: { addListener() {} },
        onStartup: { addListener() {} }
      },
      storage: {
        local: {
          get(_keys, cb) { cb(Object.assign({}, store)); }
        },
        onChanged: { addListener() {} }
      },
      tabs: {
        update(tabId, props, cb) {
          updatedTabs.push({ tabId, props });
          if (cb) cb();
        },
        query(_q, cb) { cb([{ id: 42, url: 'https://gemini.google.com/app/1' }]); },
        sendMessage(tabId, msg, cb) {
          sentMessages.push({ tabId, msg });
          if (cb) cb({ ok: true });
        }
      },
      alarms: {
        create(name, opts) { createdAlarms.push({ name, opts }); },
        clear(name) { clearedAlarms.push(name); },
        onAlarm: { addListener() {} }
      }
    };

    const mockTimers = {
      setInterval(fn) { intervalCb = fn; intervalId += 1; return intervalId; },
      clearInterval() { intervalCb = null; }
    };

    const bg = createBackgroundController(mockChrome, mockTimers);
    bg.init();
    assert.ok(createdAlarms.some((a) => a.name === ALARM_NAME));
    assert.ok(updatedTabs.some((u) => u.tabId === 42 && u.props.autoDiscardable === false));

    const portMsgs = [];
    let portMsgHandler = null;
    let portDisconnectHandler = null;
    const mockPort = {
      name: 'gmah-tab',
      sender: { tab: { id: 42 } },
      postMessage(m) { portMsgs.push(m); },
      onMessage: { addListener(fn) { portMsgHandler = fn; } },
      onDisconnect: { addListener(fn) { portDisconnectHandler = fn; } }
    };

    bg.handleConnect(mockPort);
    assert.deepStrictEqual(bg.getConnectedTabIds(), [42]);
    assert.strictEqual(bg.isHeartbeatRunning(), true);

    portMsgHandler({ type: 'GMAH_TAB_HELLO' });
    assert.strictEqual(portMsgs.length, 1);
    assert.strictEqual(portMsgs[0].type, 'GMAH_BG_TICK');

    intervalCb();
    assert.strictEqual(portMsgs.length, 2);
    assert.doesNotThrow(() => portMsgHandler({ type: 'GMAH_TAB_PONG', ts: Date.now() }));

    bg.handleAlarm({ name: ALARM_NAME });
    assert.strictEqual(portMsgs.length, 3);

    bg.handleStorageChanged(
      { [D.STORAGE_KEY]: { newValue: { enabled: true, backgroundMode: false, preventTabDiscard: true } } },
      'local'
    );
    assert.strictEqual(bg.isHeartbeatRunning(), false);
    assert.ok(clearedAlarms.includes(ALARM_NAME));
    assert.ok(updatedTabs.some((u) => u.tabId === 42 && u.props.autoDiscardable === true));

    portDisconnectHandler();
    assert.deepStrictEqual(bg.getConnectedTabIds(), []);

    store[D.STORAGE_KEY] = { enabled: true, backgroundMode: true, preventTabDiscard: true };
    bg.handleAlarm({ name: ALARM_NAME });
    assert.ok(sentMessages.some((m) => m.tabId === 42 && m.msg.type === 'GMAH_BG_TICK'));
  });

  // 13. HUD mount/update/interactions & Popup load/save preserving non-form settings
  test('hud.js and popup.js render state accurately and popup preserves hudMinimized on save', () => {
    const { doc, win } = createMockEnv();
    const prevDoc = global.document;
    global.document = doc;

    try {
      let emergencyCalls = 0;
      let resetCalls = 0;
      let addedKw = null;

      const hud = createHud({
        onEmergencyStop: () => { emergencyCalls += 1; },
        onResetBreaker: () => { resetCalls += 1; },
        onInspectButtons: () => [{ text: '继续执行', el: null }],
        onAddKeyword: (kind, text) => { addedKw = { kind, text }; }
      });
      const rootEl = hud.mount();
      assert.ok(rootEl && doc.getElementById('gmah-hud'));

      const engine = new GmahEngine({ doc, win });
      hud.update(engine.getState());
      assert.ok(rootEl.textContent.includes('运行中'));

      hud.setActivePanel('inspect');
      const inspectBtns = rootEl.querySelectorAll('.gmah-inspect-btn');
      assert.strictEqual(inspectBtns.length, 2);
      inspectBtns[1].click();
      assert.deepStrictEqual(addedKw, { kind: 'continue', text: '继续执行' });

      engine.emergencyStop();
      hud.update(engine.getState());
      assert.ok(rootEl.textContent.includes('解除熔断'));

      const actionsWrap = rootEl.querySelector('.gmah-actions');
      assert.ok(actionsWrap);
      const actionBtns = actionsWrap.querySelectorAll('button');
      actionBtns[0].click();
      assert.strictEqual(resetCalls, 1);
      assert.strictEqual(emergencyCalls, 0);

      hud.unmount();
      assert.strictEqual(doc.getElementById('gmah-hud'), null);
    } finally {
      global.document = prevDoc;
    }

    const popupEnv = createMockEnv('chrome-extension://test/popup.html');
    const pdoc = popupEnv.doc;
    const ids = [
      'enabled', 'autoAllow', 'preferAlwaysAllow', 'fallbackSingleAllow',
      'autoContinue', 'backgroundMode', 'preventTabDiscard', 'showHud',
      'maxContinuesPerTask', 'dailyContinueLimit', 'continueCooldownSec', 'idleSettleSec',
      'stopOnCompletionCues', 'stopOnStagnantOutput', 'stopOnQuotaOrError',
      'customAlwaysAllowKeywords', 'customContinueKeywords',
      'statAllow', 'statContinue', 'statLive',
      'btnEmergency', 'btnResetBreaker', 'btnResetStats', 'btnDefaults', 'btnSave', 'toast'
    ];
    for (const id of ids) {
      pdoc.body.appendChild(pdoc.createElement('input', { id }));
    }

    const storageState = {
      [D.STORAGE_KEY]: D.mergeSettings({ hudMinimized: true, maxContinuesPerTask: 8 }),
      [D.STATS_KEY]: { date: D.getTodayKey(), allowCount: 12, continueCount: 3 }
    };
    let lastTabMsg = null;

    const mockPopupChrome = {
      runtime: { lastError: null },
      storage: {
        local: {
          get(_keys, cb) { cb(Object.assign({}, storageState)); },
          set(obj, cb) { Object.assign(storageState, obj); if (cb) cb(); }
        }
      },
      tabs: {
        query(_q, cb) { cb([{ id: 7 }]); },
        sendMessage(_tabId, msg, cb) {
          lastTabMsg = msg;
          cb({
            ok: true,
            state: {
              settings: storageState[D.STORAGE_KEY],
              circuitBreaker: { tripped: msg.type === 'GMAH_EMERGENCY_STOP' }
            }
          });
        }
      }
    };

    const popup = createPopupController(pdoc, mockPopupChrome);
    popup.init();

    assert.strictEqual(pdoc.getElementById('maxContinuesPerTask').value, '8');
    assert.strictEqual(pdoc.getElementById('statAllow').textContent, '12');
    assert.strictEqual(pdoc.getElementById('statContinue').textContent, '3 / ∞');
    assert.strictEqual(pdoc.getElementById('statLive').textContent, '后台就绪');

    pdoc.getElementById('dailyContinueLimit').value = '45';
    pdoc.getElementById('customContinueKeywords').value = '继续下一步, 接着写';
    pdoc.getElementById('btnSave').click();

    assert.strictEqual(storageState[D.STORAGE_KEY].dailyContinueLimit, 45);
    assert.strictEqual(storageState[D.STORAGE_KEY].hudMinimized, true);
    assert.deepStrictEqual(storageState[D.STORAGE_KEY].customContinueKeywords, ['继续下一步', '接着写']);

    pdoc.getElementById('btnEmergency').click();
    assert.strictEqual(lastTabMsg.type, 'GMAH_EMERGENCY_STOP');
    assert.strictEqual(pdoc.getElementById('statLive').textContent, '已熔断');

    pdoc.getElementById('btnResetStats').click();
    assert.strictEqual(storageState[D.STATS_KEY].continueCount, 0);
    assert.strictEqual(pdoc.getElementById('statContinue').textContent, '0 / 45');
  });

  // 14. defaultClickElement sanity check
  test('defaultClickElement works cleanly even when PointerEvent is unavailable', () => {
    const { doc } = createMockEnv();
    const btn = doc.createElement('button', { text: '继续' });
    defaultClickElement(btn, {});
    assert.strictEqual(btn.clickCount, 1);
  });

  // 15. Trusted Types CSP regression: hud.js must never assign innerHTML
  test('hud.js complies with Trusted Types CSP and never assigns innerHTML when toggling logs/inspect panels', () => {
    const { doc, win } = createMockEnv();
    const origCreate = doc.createElement.bind(doc);
    doc.createElement = (tag, opts) => {
      const node = origCreate(tag, opts);
      Object.defineProperty(node, 'innerHTML', {
        configurable: true,
        set() {
          throw new TypeError("Failed to set the 'innerHTML' property: This document requires 'TrustedHTML' assignment.");
        }
      });
      return node;
    };

    const prevDoc = global.document;
    global.document = doc;
    try {
      const hud = createHud({
        onInspectButtons: () => [{ text: '继续', el: null }]
      });
      hud.mount();
      const engine = new GmahEngine({ doc, win });
      engine.addLog('测试日志');
      hud.update(engine.getState());

      assert.doesNotThrow(() => {
        hud.setActivePanel('logs');
        hud.setActivePanel('inspect');
        hud.setActivePanel(null);
      });
      hud.unmount();
    } finally {
      global.document = prevDoc;
    }
  });

  // 16. Angular Material icon ligatures & decorative nodes must not pollute button labels
  test('getElementLabel ignores mat-icon, material-symbols, svg, and falls back to aria-label on icon-only buttons', () => {
    const { doc, win } = createMockEnv();
    let now = 210000;

    // 1) Continue button with <mat-icon>play_arrow</mat-icon><span>继续</span>
    const contBtn = doc.createElement('button');
    contBtn.appendChild(doc.createElement('mat-icon', { className: 'mat-icon', text: 'play_arrow' }));
    contBtn.appendChild(doc.createElement('span', { text: '继续' }));
    assert.strictEqual(getElementLabel(contBtn), '继续');

    // 2) Always allow button with material-symbols-outlined ligature
    const allowBtn = doc.createElement('button');
    allowBtn.appendChild(doc.createElement('span', { className: 'material-symbols-outlined', text: 'check_circle' }));
    allowBtn.appendChild(doc.createElement('span', { text: '始终允许' }));
    assert.strictEqual(getElementLabel(allowBtn), '始终允许');

    // 3) Icon-only button with aria-label="继续" and aria-hidden icon text
    const iconOnlyBtn = doc.createElement('button', { attrs: { 'aria-label': '继续' } });
    iconOnlyBtn.appendChild(doc.createElement('span', { className: 'google-symbols', attrs: { 'aria-hidden': 'true' }, text: 'fast_forward' }));
    assert.strictEqual(getElementLabel(iconOnlyBtn), '继续');

    // End-to-end engine check: clicks allowBtn first, then contBtn after allowBtn is removed
    doc.body.appendChild(allowBtn);
    addTurn(doc, '阶段输出未完待续...', [contBtn]);

    const engine = new GmahEngine({ doc, win, now: () => now });
    const r1 = engine.scanOnce();
    assert.strictEqual(r1.action, 'clicked_allow');
    assert.strictEqual(r1.element, allowBtn);

    allowBtn.remove();
    now += 2500;
    const r2 = engine.scanOnce();
    assert.strictEqual(r2.action, 'clicked_continue');
    assert.strictEqual(r2.element, contBtn);
  });

  // 17. Shadow DOM direct-child sibling approval context regression
  test('hasSiblingApprovalContext detects sibling Deny button directly under a ShadowRoot', () => {
    const { doc, win } = createMockEnv();
    let now = 230000;

    const host = doc.createElement('mcp-confirm-host');
    const sr = host.attachShadow();
    const denyBtn = doc.createElement('button', { text: 'Deny' });
    const allowToolBtn = doc.createElement('button', { text: 'Allow Desktop Commander' });
    sr.appendChild(denyBtn);
    sr.appendChild(allowToolBtn);
    doc.body.appendChild(host);

    // Direct child of ShadowRoot has parentElement === null
    assert.strictEqual(allowToolBtn.parentElement, null);

    const engine = new GmahEngine({ doc, win, now: () => now });
    const res = engine.scanOnce();
    assert.strictEqual(res.action, 'clicked_allow');
    assert.strictEqual(res.tier, 'single');
    assert.strictEqual(allowToolBtn.clickCount, 1);
    assert.strictEqual(denyBtn.clickCount, 0);
  });

  // 18. Background SW cold-start async storage gating & tabs.onUpdated noise filtering
  test('background.js waits for async settings on cold start before starting heartbeat and filters tabs.onUpdated noise', () => {
    let deferredStorageCb = null;
    const updatedTabs = [];
    const clearedAlarms = [];
    let intervalRunning = false;

    const mockChrome = {
      runtime: {
        lastError: null,
        onConnect: { addListener() {} },
        onInstalled: { addListener() {} },
        onStartup: { addListener() {} }
      },
      storage: {
        local: {
          get(_keys, cb) {
            deferredStorageCb = cb;
          }
        },
        onChanged: { addListener() {} }
      },
      tabs: {
        update(tabId, props, cb) {
          updatedTabs.push({ tabId, props });
          if (cb) cb();
        },
        query(_q, cb) { cb([{ id: 99, url: 'https://gemini.google.com/app/x' }]); },
        sendMessage(_tabId, _msg, cb) { if (cb) cb({ ok: true }); }
      },
      alarms: {
        create() {},
        clear(name) { clearedAlarms.push(name); },
        onAlarm: { addListener() {} }
      }
    };

    const mockTimers = {
      setInterval() { intervalRunning = true; return 1; },
      clearInterval() { intervalRunning = false; }
    };

    const bg = createBackgroundController(mockChrome, mockTimers);
    const mockPort = {
      name: 'gmah-tab',
      sender: { tab: { id: 99 } },
      postMessage() {},
      onMessage: { addListener() {} },
      onDisconnect: { addListener() {} }
    };

    // Port connects while storage.local.get is still in-flight (cold start)
    bg.handleConnect(mockPort);
    assert.strictEqual(bg.isHeartbeatRunning(), false);
    assert.strictEqual(intervalRunning, false);
    assert.strictEqual(updatedTabs.length, 0);

    // Storage resolves with backgroundMode: false
    deferredStorageCb({
      [D.STORAGE_KEY]: { enabled: true, backgroundMode: false, preventTabDiscard: true }
    });
    assert.strictEqual(bg.isHeartbeatRunning(), false);
    assert.ok(clearedAlarms.includes(ALARM_NAME));
    assert.strictEqual(updatedTabs.length, 1);
    assert.strictEqual(updatedTabs[0].props.autoDiscardable, true);

    // Noisy title-only tab update must be ignored; status: 'complete' must trigger update
    bg.handleTabUpdated(99, { title: 'Gemini - Thinking...' }, { url: 'https://gemini.google.com/app/x' });
    assert.strictEqual(updatedTabs.length, 1);

    bg.handleTabUpdated(99, { status: 'complete' }, { url: 'https://gemini.google.com/app/x' });
    assert.strictEqual(updatedTabs.length, 2);
  });

  // 19. Popup prefers active Gemini tab status and refreshes statLive after saving settings
  test('popup.js prefers active Gemini tab when multiple tabs exist and updates statLive on save', () => {
    const popupEnv = createMockEnv('chrome-extension://test/popup.html');
    const pdoc = popupEnv.doc;
    const ids = [
      'enabled', 'autoAllow', 'preferAlwaysAllow', 'fallbackSingleAllow',
      'autoContinue', 'backgroundMode', 'preventTabDiscard', 'showHud',
      'maxContinuesPerTask', 'dailyContinueLimit', 'continueCooldownSec', 'idleSettleSec',
      'stopOnCompletionCues', 'stopOnStagnantOutput', 'stopOnQuotaOrError',
      'customAlwaysAllowKeywords', 'customContinueKeywords',
      'statAllow', 'statContinue', 'statLive',
      'btnEmergency', 'btnResetBreaker', 'btnResetStats', 'btnDefaults', 'btnSave', 'toast'
    ];
    for (const id of ids) {
      pdoc.body.appendChild(pdoc.createElement('input', { id }));
    }

    const storageState = {
      [D.STORAGE_KEY]: D.mergeSettings({ enabled: true, backgroundMode: true }),
      [D.STATS_KEY]: { date: D.getTodayKey(), allowCount: 1, continueCount: 0 }
    };

    const mockPopupChrome = {
      runtime: { lastError: null },
      storage: {
        local: {
          get(_keys, cb) { cb(Object.assign({}, storageState)); },
          set(obj, cb) { Object.assign(storageState, obj); if (cb) cb(); }
        }
      },
      tabs: {
        query(_q, cb) {
          cb([
            { id: 1, active: false, highlighted: false },
            { id: 2, active: true, highlighted: true }
          ]);
        },
        sendMessage(tabId, _msg, cb) {
          if (tabId === 1) {
            cb({ ok: true, state: { settings: storageState[D.STORAGE_KEY], circuitBreaker: { tripped: true } } });
          } else {
            cb({ ok: true, state: { settings: storageState[D.STORAGE_KEY], circuitBreaker: { tripped: false } } });
          }
        }
      }
    };

    const popup = createPopupController(pdoc, mockPopupChrome);
    popup.init();

    // Must show active tab #2's state ("后台就绪"), NOT inactive tab #1's ("已熔断")
    assert.strictEqual(pdoc.getElementById('statLive').textContent, '后台就绪');

    // Pausing via master switch updates live status immediately to "已暂停"
    pdoc.getElementById('enabled').checked = false;
    pdoc.getElementById('btnSave').click();
    assert.strictEqual(pdoc.getElementById('statLive').textContent, '已暂停');
  });

  // 20. Slow-dismissing approval dialog must never fallback-click sibling "允许一次", while separate cards stay clickable
  test('auto-allow never clicks sibling Allow Once in the same slow-dismissing dialog, but still clicks a separate card', () => {
    const { doc, win } = createMockEnv();
    let now = 260000;

    const listWrap = doc.createElement('div', { className: 'mcp-cards-list' });

    const card1 = doc.createElement('div', { className: 'mcp-card' });
    const c1Deny = doc.createElement('button', { text: '拒绝' });
    const c1Once = doc.createElement('button', { text: '允许一次' });
    const c1Always = doc.createElement('button', { text: '始终允许' });
    card1.appendChild(c1Deny);
    card1.appendChild(c1Once);
    card1.appendChild(c1Always);

    const card2 = doc.createElement('div', { className: 'mcp-card' });
    const c2Deny = doc.createElement('button', { text: '拒绝' });
    const c2Always = doc.createElement('button', { text: '始终允许' });
    card2.appendChild(c2Deny);
    card2.appendChild(c2Always);

    listWrap.appendChild(card1);
    listWrap.appendChild(card2);
    doc.body.appendChild(listWrap);

    const engine = new GmahEngine({ doc, win, now: () => now });

    // Scan 1 clicks card2's 始终允许 (last match)
    const r1 = engine.scanOnce();
    assert.strictEqual(r1.action, 'clicked_allow');
    assert.strictEqual(r1.element, c2Always);

    // Scan 2 clicks card1's 始终允许 (separate card still eligible)
    now += 1500;
    const r2 = engine.scanOnce();
    assert.strictEqual(r2.action, 'clicked_allow');
    assert.strictEqual(r2.element, c1Always);

    // Scan 3 while both dialogs are still animating out: MUST NOT fallback-click card1's 允许一次!
    now += 1500;
    const r3 = engine.scanOnce();
    assert.strictEqual(r3.action, 'noop');
    assert.strictEqual(c1Once.clickCount, 0);
    assert.strictEqual(c1Deny.clickCount, 0);
    assert.strictEqual(c2Deny.clickCount, 0);
  });

  // 21. Auto-injection into already-open Gemini tabs (popup & background) + needs_reload distinction
  test('popup.js auto-injects into already-open Gemini tabs and shows 请刷新 Gemini instead of 未打开 Gemini if unreachable', () => {
    const popupEnv = createMockEnv('chrome-extension://test/popup.html');
    const pdoc = popupEnv.doc;
    const ids = [
      'enabled', 'autoAllow', 'preferAlwaysAllow', 'fallbackSingleAllow',
      'autoContinue', 'backgroundMode', 'preventTabDiscard', 'showHud',
      'maxContinuesPerTask', 'dailyContinueLimit', 'continueCooldownSec', 'idleSettleSec',
      'stopOnCompletionCues', 'stopOnStagnantOutput', 'stopOnQuotaOrError',
      'customAlwaysAllowKeywords', 'customContinueKeywords',
      'statAllow', 'statContinue', 'statLive',
      'btnEmergency', 'btnResetBreaker', 'btnResetStats', 'btnDefaults', 'btnSave', 'toast'
    ];
    for (const id of ids) {
      pdoc.body.appendChild(pdoc.createElement('input', { id }));
    }

    const storageState = {
      [D.STORAGE_KEY]: D.mergeSettings({ enabled: true, backgroundMode: true }),
      [D.STATS_KEY]: { date: D.getTodayKey(), allowCount: 0, continueCount: 0 }
    };

    let injected = false;
    let cssInjected = false;
    const mockChromeWithScripting = {
      runtime: { lastError: null },
      storage: {
        local: {
          get(_keys, cb) { cb(Object.assign({}, storageState)); },
          set(obj, cb) { Object.assign(storageState, obj); if (cb) cb(); }
        }
      },
      tabs: {
        query(_q, cb) { cb([{ id: 10, active: true, discarded: false }]); },
        sendMessage(_tabId, _msg, cb) {
          if (!injected) {
            mockChromeWithScripting.runtime.lastError = { message: 'Could not establish connection.' };
            cb(undefined);
            mockChromeWithScripting.runtime.lastError = null;
          } else {
            cb({ ok: true, state: { settings: storageState[D.STORAGE_KEY], circuitBreaker: { tripped: false } } });
          }
        }
      },
      scripting: {
        insertCSS(_opts, cb) {
          cssInjected = true;
          mockChromeWithScripting.runtime.lastError = null;
          if (cb) cb();
        },
        executeScript(_opts, cb) {
          injected = true;
          mockChromeWithScripting.runtime.lastError = null;
          if (cb) cb();
        }
      }
    };

    const popup = createPopupController(pdoc, mockChromeWithScripting);
    popup.init();
    assert.strictEqual(cssInjected, true);
    assert.strictEqual(injected, true);
    assert.strictEqual(pdoc.getElementById('statLive').textContent, '后台就绪');

    // If scripting is unavailable and tab does not answer, must show "请刷新 Gemini" (not "未打开 Gemini")
    const mockChromeNoScripting = {
      runtime: { lastError: { message: 'Receiving end does not exist' } },
      storage: mockChromeWithScripting.storage,
      tabs: {
        query(_q, cb) { cb([{ id: 11, active: true, discarded: false }]); },
        sendMessage(_tabId, _msg, cb) { cb(undefined); }
      }
    };
    const popup2 = createPopupController(pdoc, mockChromeNoScripting);
    popup2.init();
    assert.strictEqual(pdoc.getElementById('statLive').textContent, '请刷新 Gemini');
    assert.strictEqual(pdoc.getElementById('statLive').className, 'badge-warn');

    // Background syncAllGeminiTabs(false, true) auto-injects into open tabs with no port
    const bgInjectedTabs = [];
    const bgMockChrome = {
      runtime: { lastError: null },
      storage: { local: { get(_k, cb) { cb({}); } } },
      tabs: {
        update(_id, _p, cb) { if (cb) cb(); },
        query(_q, cb) { cb([{ id: 55, url: 'https://gemini.google.com/app', discarded: false }]); }
      },
      scripting: {
        insertCSS(_o, cb) { if (cb) cb(); },
        executeScript(opts, cb) { bgInjectedTabs.push(opts.target.tabId); if (cb) cb(); }
      }
    };
    const bg = createBackgroundController(bgMockChrome);
    bg.syncAllGeminiTabs(false, true);
    assert.deepStrictEqual(bgInjectedTabs, [55]);
  });

  // 22. Follow-up "↪ Yes" confirmation chip clicks safely, while survey [Yes][No] & modal [Cancel][确认] are blocked
  test('auto-continue clicks "↪ Yes" follow-up chip but ignores [Yes][No] survey and modal [Cancel][确认] dialogs', () => {
    const { doc, win } = createMockEnv();
    let now = 300000;

    // 1) Feedback survey pair [Yes] [No] must NOT be clicked
    const survey = doc.createElement('div', { className: 'feedback-row' });
    const surveyYes = doc.createElement('button', { text: 'Yes' });
    const surveyNo = doc.createElement('button', { text: 'No' });
    survey.appendChild(surveyYes);
    survey.appendChild(surveyNo);
    doc.body.appendChild(survey);

    // 2) Modal confirmation dialog [Cancel] [确认] must NOT be clicked
    const modal = doc.createElement('div', { attrs: { role: 'dialog' } });
    const cancelBtn = doc.createElement('button', { text: 'Cancel' });
    const confirmDelete = doc.createElement('button', { text: '确认' });
    modal.appendChild(cancelBtn);
    modal.appendChild(confirmDelete);
    doc.body.appendChild(modal);

    addTurn(doc, '确认没问题，请点下方按钮开始写入代码。');

    const engine = new GmahEngine({ doc, win, now: () => now });
    assert.strictEqual(engine.scanOnce().action, 'noop');
    assert.strictEqual(surveyYes.clickCount, 0);
    assert.strictEqual(confirmDelete.clickCount, 0);

    // 3) Actual Gemini follow-up chip "↪ Yes" at bottom of conversation MUST be clicked
    const yesChip = doc.createElement('button', { className: 'follow-up-chip', text: '↪ Yes' });
    doc.body.appendChild(yesChip);

    now += 2500;
    const res = engine.scanOnce();
    assert.strictEqual(res.action, 'clicked_continue');
    assert.strictEqual(res.element, yesChip);
    assert.strictEqual(yesChip.clickCount, 1);
    assert.strictEqual(surveyYes.clickCount, 0);
    assert.strictEqual(confirmDelete.clickCount, 0);
  });

  // 23. Material Web Component <md-filled-button> with ShadowRoot + <slot> assignedNodes & role="menu" Always Allow
  test('auto-allow reads <slot> projected labels in Material Web Components and handles Always Allow in role="menu"', () => {
    const { doc, win } = createMockEnv();
    let now = 320000;

    // Card with <md-outlined-button>Not now</md-outlined-button> and <md-filled-button>Always allow Desktop Commander for this conversation</md-filled-button>
    const card = doc.createElement('div', { className: 'mcp-approval' });

    const notNowHost = doc.createElement('md-outlined-button', { text: 'Not now' });
    const allowHost = doc.createElement('md-filled-button');
    const lightTextNode = { nodeType: 3, nodeValue: 'Always allow Desktop Commander for this conversation' };
    const sr = allowHost.attachShadow();
    const innerBtn = doc.createElement('button');
    const slot = doc.createElement('slot');
    slot.assignedNodes = () => [lightTextNode];
    innerBtn.appendChild(slot);
    sr.appendChild(innerBtn);

    card.appendChild(notNowHost);
    card.appendChild(allowHost);
    doc.body.appendChild(card);

    assert.strictEqual(getElementLabel(innerBtn), 'Always allow Desktop Commander for this conversation');

    const engine = new GmahEngine({ doc, win, now: () => now });
    const r1 = engine.scanOnce();
    assert.strictEqual(r1.action, 'clicked_allow');
    assert.strictEqual(r1.tier, 'always');
    assert.strictEqual(r1.element, innerBtn);
    assert.strictEqual(innerBtn.clickCount, 1);

    // Role="menu" dropdown: Always allow item IS allowed, while Continue/Yes inside menu is blocked
    card.remove();
    const menu = doc.createElement('div', { attrs: { role: 'menu' } });
    const menuContinue = doc.createElement('button', { text: 'Yes' });
    const menuAllowOnce = doc.createElement('button', { text: 'Allow once' });
    const menuAlways = doc.createElement('button', { text: 'Always allow for this chat' });
    menu.appendChild(menuContinue);
    menu.appendChild(menuAllowOnce);
    menu.appendChild(menuAlways);
    doc.body.appendChild(menu);

    now += 1500;
    const r2 = engine.scanOnce();
    assert.strictEqual(r2.action, 'clicked_allow');
    assert.strictEqual(r2.element, menuAlways);
    assert.strictEqual(menuAlways.clickCount, 1);
    assert.strictEqual(menuAllowOnce.clickCount, 0);
    assert.strictEqual(menuContinue.clickCount, 0);

    // Once menuAlways is removed, menuAllowOnce & menuContinue in role="menu" must NOT be clicked
    menuAlways.remove();
    now += 2500;
    assert.strictEqual(engine.scanOnce().action, 'noop');
    assert.strictEqual(menuAllowOnce.clickCount, 0);
    assert.strictEqual(menuContinue.clickCount, 0);
  });

  // 24. Unlimited daily cap (0) never trips daily_limit, and inspectVisibleButtons lists bottom-most buttons first
  test('dailyContinueLimit=0 allows unlimited daily continues while HUD shows ∞ and inspectVisibleButtons prioritizes newest buttons', () => {
    const { doc, win } = createMockEnv();
    let now = 350000;

    const topBtn = doc.createElement('button', { text: '顶部旧按钮' });
    doc.body.appendChild(topBtn);

    const contBtn = doc.createElement('button', { text: '继续' });
    addTurn(doc, '第 101 次长任务输出...', [contBtn]);

    const engine = new GmahEngine({
      doc,
      win,
      now: () => now,
      settings: { maxContinuesPerTask: 10, dailyContinueLimit: 0, continueCooldownMs: 1000, idleSettleMs: 400 },
      stats: { date: D.getTodayKey(new Date(now)), allowCount: 5, continueCount: 150 }
    });

    // Bottom-most button ("继续") must appear before top-most ("顶部旧按钮")
    const inspected = engine.inspectVisibleButtons();
    assert.strictEqual(inspected[0].text, '继续');
    assert.strictEqual(inspected[1].text, '顶部旧按钮');

    // Even at 150 daily continues, dailyContinueLimit=0 does NOT trip daily_limit
    const res = engine.scanOnce();
    assert.strictEqual(res.action, 'clicked_continue');
    assert.strictEqual(engine.stats.continueCount, 151);

    // HUD displays ∞ when dailyContinueLimit === 0
    const prevDoc = global.document;
    global.document = doc;
    try {
      const hud = createHud();
      const rootEl = hud.mount();
      hud.update(engine.getState());
      assert.ok(rootEl.textContent.includes('今日 151/∞'));
      hud.unmount();
    } finally {
      global.document = prevDoc;
    }
  });

  // 25. Connection / generation stall timeout fires alert after threshold and auto-clears on recovery
  test('stall timeout fires onStallAlert after threshold, ignores animated timer digits, and clears on progress or recovery', () => {
    const { doc, win } = createMockEnv();
    let now = 1000000;
    const alerts = [];
    let resolvedCount = 0;

    const statusNode = doc.createElement('div', {
      attrs: { role: 'status' },
      text: '正在连接 Desktop Commander (1s)...'
    });
    doc.body.appendChild(statusNode);

    const engine = new GmahEngine({
      doc,
      win,
      now: () => now,
      settings: { stallAlertEnabled: true, stallAlertMinutes: 5 },
      onStallAlert: (payload) => alerts.push(payload),
      onStallResolved: () => { resolvedCount += 1; }
    });

    // t = 0: starts stall timer
    engine.scanOnce();
    assert.strictEqual(engine.stallAlertActive, false);
    assert.strictEqual(alerts.length, 0);

    // t = 3 min: status text digits & ellipsis animate -> must NOT reset stall timer
    now += 3 * 60 * 1000;
    statusNode.textContent = '正在连接 Desktop Commander (180s)......';
    engine.scanOnce();
    assert.strictEqual(engine.stallAlertActive, false);
    assert.strictEqual(alerts.length, 0);

    // t = 5 min: threshold reached -> fires exactly once
    now += 2 * 60 * 1000;
    engine.scanOnce();
    assert.strictEqual(engine.stallAlertActive, true);
    assert.strictEqual(engine.getState().stallAlertActive, true);
    assert.strictEqual(alerts.length, 1);
    assert.strictEqual(alerts[0].minutes, 5);

    // Subsequent scan while still stuck must NOT spam duplicate notifications
    now += 60 * 1000;
    engine.scanOnce();
    assert.strictEqual(alerts.length, 1);

    // New output arrives -> clears stall alert automatically
    addTurn(doc, '工具返回结果，继续生成中...');
    now += 5000;
    engine.scanOnce();
    assert.strictEqual(engine.stallAlertActive, false);
    assert.strictEqual(resolvedCount, 1);

    // Stuck again for 5 minutes -> alerts again, then status node disappears -> clears
    now += 5 * 60 * 1000;
    engine.scanOnce();
    assert.strictEqual(engine.stallAlertActive, true);
    assert.strictEqual(alerts.length, 2);

    statusNode.remove();
    now += 2000;
    engine.scanOnce();
    assert.strictEqual(engine.stallAlertActive, false);
    assert.strictEqual(resolvedCount, 2);
  });

  // 26. Layer F completion cue is overridden by explicit follow-up prompt + ↪ Yes chip, and role="menuitem" Always Allow works
  test('layer F allows ↪ Yes follow-up chip when reply asks to proceed despite completion cue, and clicks role="menuitem" Always Allow', () => {
    const { doc, win } = createMockEnv();
    let now = 500000;

    // 1) Completion cue + follow-up confirmation prompt with ↪ Yes chip -> MUST click
    const yesChip = doc.createElement('button', { className: 'follow-up-chip', text: '↪ Yes' });
    addTurn(doc, '所有测试均已通过！全部完成。需要我继续下一步把改动推送到远程仓库吗？', [yesChip]);

    const engine = new GmahEngine({ doc, win, now: () => now });
    const r1 = engine.scanOnce();
    assert.strictEqual(r1.action, 'clicked_continue');
    assert.strictEqual(r1.element, yesChip);
    assert.strictEqual(yesChip.clickCount, 1);

    // 2) role="menuitem" inside role="menu" for Always Allow -> MUST click
    const menu = doc.createElement('div', { attrs: { role: 'menu' } });
    const menuItem = doc.createElement('div', { attrs: { role: 'menuitem' }, text: '始终允许此工具' });
    menu.appendChild(menuItem);
    doc.body.appendChild(menu);

    now += 2000;
    const r2 = engine.scanOnce();
    assert.strictEqual(r2.action, 'clicked_allow');
    assert.strictEqual(r2.tier, 'always');
    assert.strictEqual(r2.element, menuItem);
    assert.strictEqual(menuItem.clickCount, 1);
  });

  // 27. Background stall notifications, badge, minimized window restore, test notification, and storage disable cleanup
  test('background.js creates stall notifications, restores minimized window on click, handles test notif and cleanup', () => {
    const createdNotifs = [];
    const clearedNotifs = [];
    const badgeUpdates = [];
    const windowUpdates = [];
    const tabUpdates = [];

    const mockChrome = {
      runtime: {
        lastError: null,
        getURL: (p) => `chrome-extension://id/${p}`,
        onConnect: { addListener() {} },
        onMessage: { addListener() {} },
        onInstalled: { addListener() {} },
        onStartup: { addListener() {} }
      },
      storage: {
        local: { get(_k, cb) { cb({}); } },
        onChanged: { addListener() {} }
      },
      action: {
        setBadgeText(opts, cb) { badgeUpdates.push(opts); if (cb) cb(); },
        setBadgeBackgroundColor(_opts, cb) { if (cb) cb(); }
      },
      notifications: {
        create(id, opts, cb) { createdNotifs.push({ id, opts }); if (cb) cb(id); },
        clear(id, cb) { clearedNotifs.push(id); if (cb) cb(true); },
        onClicked: { addListener() {} }
      },
      windows: {
        get(winId, cb) { cb({ id: winId, state: 'minimized' }); },
        update(winId, props, cb) { windowUpdates.push({ winId, props }); if (cb) cb(); }
      },
      tabs: {
        get(tabId, cb) { cb({ id: tabId, windowId: 77 }); },
        update(tabId, props, cb) { tabUpdates.push({ tabId, props }); if (cb) cb(); },
        query(_q, cb) { cb([]); },
        onUpdated: { addListener() {} },
        onRemoved: { addListener() {} }
      },
      alarms: {
        create() {},
        clear() {},
        onAlarm: { addListener() {} }
      }
    };

    const bg = createBackgroundController(mockChrome);
    bg.init();

    // Runtime stall alert creates notification + sets "!" badge
    let alertResp = null;
    bg.handleRuntimeMessage({ type: 'GMAH_STALL_ALERT', minutes: 6 }, { tab: { id: 88 } }, (r) => { alertResp = r; });
    assert.deepStrictEqual(alertResp, { ok: true });
    assert.strictEqual(createdNotifs.length, 1);
    assert.strictEqual(createdNotifs[0].id, `${bg.STALL_NOTIF_PREFIX}88`);
    assert.ok(createdNotifs[0].opts.title.includes('6 分钟'));
    assert.ok(badgeUpdates.some((b) => b.tabId === 88 && b.text === '!'));

    // Clicking notification clears notification/badge, restores minimized window, and activates tab
    bg.handleNotificationClicked(`${bg.STALL_NOTIF_PREFIX}88`);
    assert.ok(clearedNotifs.includes(`${bg.STALL_NOTIF_PREFIX}88`));
    assert.ok(badgeUpdates.some((b) => b.tabId === 88 && b.text === ''));
    assert.deepStrictEqual(windowUpdates[0], { winId: 77, props: { focused: true, state: 'normal' } });
    assert.ok(tabUpdates.some((u) => u.tabId === 88 && u.props.active === true));

    // Disabling stallAlertEnabled in storage clears active alerts
    bg.handleRuntimeMessage({ type: 'GMAH_STALL_ALERT', minutes: 5 }, { tab: { id: 89 } });
    bg.handleStorageChanged(
      { [D.STORAGE_KEY]: { newValue: { enabled: true, backgroundMode: true, preventTabDiscard: true, stallAlertEnabled: false } } },
      'local'
    );
    assert.ok(clearedNotifs.includes(`${bg.STALL_NOTIF_PREFIX}89`));

    // Test notification button handler
    let testNotifResp = null;
    bg.handleRuntimeMessage({ type: 'GMAH_TEST_NOTIFICATION' }, {}, (r) => { testNotifResp = r; });
    assert.deepStrictEqual(testNotifResp, { ok: true });
    assert.ok(createdNotifs.some((n) => n.id.startsWith('gmah_test_')));
  });

  // 28. Popup live toggle auto-sync, stallAlertActive rendering, and test notification button
  test('popup.js auto-syncs checkboxes, displays stallAlertActive status, and triggers test notification', () => {
    const popupEnv = createMockEnv('chrome-extension://test/popup.html');
    const pdoc = popupEnv.doc;
    const ids = [
      'enabled', 'autoAllow', 'preferAlwaysAllow', 'fallbackSingleAllow',
      'autoContinue', 'backgroundMode', 'preventTabDiscard', 'showHud',
      'maxContinuesPerTask', 'dailyContinueLimit', 'continueCooldownSec', 'idleSettleSec',
      'stopOnCompletionCues', 'stopOnStagnantOutput', 'stopOnQuotaOrError',
      'stallAlertEnabled', 'stallAlertMinutes', 'btnTestNotif',
      'customAlwaysAllowKeywords', 'customContinueKeywords',
      'statAllow', 'statContinue', 'statLive',
      'btnEmergency', 'btnResetBreaker', 'btnResetStats', 'btnDefaults', 'btnSave', 'toast'
    ];
    for (const id of ids) {
      pdoc.body.appendChild(pdoc.createElement('input', { id }));
    }

    const storageState = {
      [D.STORAGE_KEY]: D.mergeSettings({ enabled: true, stallAlertEnabled: true, stallAlertMinutes: 5 }),
      [D.STATS_KEY]: { date: D.getTodayKey(), allowCount: 0, continueCount: 0 }
    };
    const runtimeMsgs = [];

    const mockPopupChrome = {
      runtime: {
        lastError: null,
        sendMessage(msg, cb) {
          runtimeMsgs.push(msg);
          if (cb) cb({ ok: true });
        }
      },
      storage: {
        local: {
          get(_keys, cb) { cb(Object.assign({}, storageState)); },
          set(obj, cb) { Object.assign(storageState, obj); if (cb) cb(); }
        }
      },
      tabs: {
        query(_q, cb) { cb([{ id: 3, active: true }]); },
        sendMessage(_tabId, _msg, cb) {
          cb({
            ok: true,
            state: {
              settings: storageState[D.STORAGE_KEY],
              stallAlertActive: true,
              circuitBreaker: { tripped: false }
            }
          });
        }
      }
    };

    const popup = createPopupController(pdoc, mockPopupChrome);
    popup.init();

    assert.strictEqual(pdoc.getElementById('statLive').textContent, '连接超时');
    assert.strictEqual(pdoc.getElementById('stallAlertMinutes').value, '5');

    // Toggling a checkbox immediately persists to storage without clicking btnSave
    const stallCheck = pdoc.getElementById('stallAlertEnabled');
    stallCheck.checked = false;
    stallCheck.dispatchEvent({ type: 'change', target: stallCheck });
    assert.strictEqual(storageState[D.STORAGE_KEY].stallAlertEnabled, false);

    // Clicking btnTestNotif sends GMAH_TEST_NOTIFICATION to background
    pdoc.getElementById('btnTestNotif').click();
    assert.ok(runtimeMsgs.some((m) => m.type === 'GMAH_TEST_NOTIFICATION'));
    assert.ok(pdoc.getElementById('toast').textContent.includes('测试桌面通知'));
  });

  // 29. HUD one-click desktop notification toggle updates state and invokes clearAllStallNotifications on background
  test('HUD one-click notification toggle in HUD updates stallAlertEnabled and clears background stall notifications when disabled', () => {
    const { doc, win } = createMockEnv();
    const prevDoc = global.document;
    const prevWin = global.window;
    global.document = doc;
    global.window = win;

    try {
      // Setup background with active notifications
      const clearedNotifs = [];
      const badgeUpdates = [];
      const mockBgChrome = {
        runtime: {
          lastError: null,
          getURL: (p) => `chrome-extension://id/${p}`,
          onConnect: { addListener() {} },
          onMessage: { addListener() {} }
        },
        storage: {
          local: { get(_k, cb) { cb({}); } },
          onChanged: { addListener() {} }
        },
        action: {
          setBadgeText(opts, cb) { badgeUpdates.push(opts); if (cb) cb(); },
          setBadgeBackgroundColor(_opts, cb) { if (cb) cb(); }
        },
        notifications: {
          create(_id, _opts, cb) { if (cb) cb(); },
          clear(id, cb) { clearedNotifs.push(id); if (cb) cb(true); }
        },
        windows: { get(_id, cb) { cb({}); }, update(_id, _p, cb) { if (cb) cb(); } },
        tabs: {
          get(_id, cb) { cb({}); },
          update(_id, _p, cb) { if (cb) cb(); },
          query(_q, cb) { cb([]); }
        },
        alarms: { create() {}, clear() {} }
      };

      const bg = createBackgroundController(mockBgChrome);
      bg.init();

      // Trigger a stall notification on tab 101
      bg.handleRuntimeMessage({ type: 'GMAH_STALL_ALERT', minutes: 5 }, { tab: { id: 101 } });
      assert.ok(badgeUpdates.some((b) => b.tabId === 101 && b.text === '!'));

      let toggleNotifCalls = 0;
      let engineSettings = D.mergeSettings({ stallAlertEnabled: true });

      const engine = new GmahEngine({
        doc,
        win,
        settings: engineSettings
      });

      const hud = createHud({
        onToggleNotification: () => {
          toggleNotifCalls += 1;
          const nextVal = !engine.settings.stallAlertEnabled;
          engine.updateSettings({ stallAlertEnabled: nextVal }, false);
          if (!nextVal) {
            bg.handleRuntimeMessage({ type: 'GMAH_STALL_CLEAR' }, { tab: { id: 101 } });
            bg.handleRuntimeMessage({ type: 'GMAH_CLEAR_ALL_STALL_NOTIFICATIONS' });
          }
          hud.update(engine.getState());
        }
      });

      const rootEl = hud.mount();
      assert.ok(rootEl && doc.getElementById('gmah-hud'));

      // Check the 5th row (桌面通知) and 6th row (超时自动续接)
      const rows = rootEl.querySelectorAll('.gmah-row');
      assert.strictEqual(rows.length, 6, 'HUD must have 6 control rows including desktop notifications and stall auto-recovery');
      const notifRow = rows[4];
      assert.ok(notifRow.textContent.includes('桌面通知'));
      const notifPill = notifRow.querySelector('.gmah-pill');
      assert.ok(notifPill);
      assert.ok(rows[5].textContent.includes('超时自动续接'));

      hud.update(engine.getState());
      assert.strictEqual(notifPill.textContent, '已开启');
      assert.ok(notifPill.className.includes('on'));

      // Click the pill to toggle off
      notifPill.click();
      assert.strictEqual(toggleNotifCalls, 1);
      assert.strictEqual(engine.settings.stallAlertEnabled, false);
      assert.strictEqual(notifPill.textContent, '已关闭');
      assert.ok(!notifPill.className.includes('on'));

      // Background notifications must be cleared immediately
      assert.ok(clearedNotifs.includes(`${bg.STALL_NOTIF_PREFIX}101`));
      assert.ok(badgeUpdates.some((b) => b.tabId === 101 && b.text === ''));

      // Click again to re-enable
      notifPill.click();
      assert.strictEqual(toggleNotifCalls, 2);
      assert.strictEqual(engine.settings.stallAlertEnabled, true);
      assert.strictEqual(notifPill.textContent, '已开启');
      assert.ok(notifPill.className.includes('on'));

      hud.unmount();
    } finally {
      global.document = prevDoc;
      global.window = prevWin;
    }
  });

  // 30. Popup one-click notification toggle button (btnToggleNotif) toggles stallAlertEnabled and clears notifications
  test('Popup one-click notification toggle button toggles stallAlertEnabled, updates UI, and clears background stall notifications', () => {
    const popupEnv = createMockEnv('chrome-extension://test/popup.html');
    const pdoc = popupEnv.doc;
    const ids = [
      'enabled', 'autoAllow', 'preferAlwaysAllow', 'fallbackSingleAllow',
      'autoContinue', 'backgroundMode', 'preventTabDiscard', 'showHud',
      'maxContinuesPerTask', 'dailyContinueLimit', 'continueCooldownSec', 'idleSettleSec',
      'stopOnCompletionCues', 'stopOnStagnantOutput', 'stopOnQuotaOrError',
      'stallAlertEnabled', 'stallAlertMinutes', 'btnToggleNotif', 'btnTestNotif',
      'customAlwaysAllowKeywords', 'customContinueKeywords',
      'statAllow', 'statContinue', 'statLive',
      'btnEmergency', 'btnResetBreaker', 'btnResetStats', 'btnDefaults', 'btnSave', 'toast'
    ];
    for (const id of ids) {
      pdoc.body.appendChild(pdoc.createElement('input', { id }));
    }

    const storageState = {
      [D.STORAGE_KEY]: D.mergeSettings({ enabled: true, stallAlertEnabled: true, stallAlertMinutes: 5 }),
      [D.STATS_KEY]: { date: D.getTodayKey(), allowCount: 0, continueCount: 0 }
    };
    const runtimeMsgs = [];

    const mockPopupChrome = {
      runtime: {
        lastError: null,
        sendMessage(msg, cb) {
          runtimeMsgs.push(msg);
          if (cb) cb({ ok: true });
        }
      },
      storage: {
        local: {
          get(_keys, cb) { cb(Object.assign({}, storageState)); },
          set(obj, cb) { Object.assign(storageState, obj); if (cb) cb(); }
        }
      },
      tabs: {
        query(_q, cb) { cb([{ id: 10, active: true }]); },
        sendMessage(_tabId, _msg, cb) {
          cb({
            ok: true,
            state: {
              settings: storageState[D.STORAGE_KEY],
              stallAlertActive: false,
              circuitBreaker: { tripped: false }
            }
          });
        }
      }
    };

    const popup = createPopupController(pdoc, mockPopupChrome);
    popup.init();

    const btnToggleNotif = pdoc.getElementById('btnToggleNotif');
    const checkStall = pdoc.getElementById('stallAlertEnabled');
    assert.strictEqual(btnToggleNotif.textContent, '桌面通知：开启');
    assert.ok(btnToggleNotif.className.includes('primary'));
    assert.strictEqual(checkStall.checked, true);

    // Click btnToggleNotif to turn off notifications
    btnToggleNotif.click();
    assert.strictEqual(storageState[D.STORAGE_KEY].stallAlertEnabled, false);
    assert.strictEqual(checkStall.checked, false);
    assert.strictEqual(btnToggleNotif.textContent, '桌面通知：关闭');
    assert.ok(btnToggleNotif.className.includes('secondary'));
    // GMAH_CLEAR_ALL_STALL_NOTIFICATIONS message must be sent to background
    assert.ok(runtimeMsgs.some((m) => m.type === 'GMAH_CLEAR_ALL_STALL_NOTIFICATIONS'));

    // Click btnToggleNotif again to re-enable notifications
    btnToggleNotif.click();
    assert.strictEqual(storageState[D.STORAGE_KEY].stallAlertEnabled, true);
    assert.strictEqual(checkStall.checked, true);
    assert.strictEqual(btnToggleNotif.textContent, '桌面通知：开启');
    assert.ok(btnToggleNotif.className.includes('primary'));
  });

  // 31. Draggable floating HUD initialization, boundary clamping, threshold vs click, and position persistence
  test('Draggable HUD: initialization, position clamping, drag vs click threshold, and storage save/restore', () => {
    const { doc, win, localStorageMock } = createMockEnv();
    const prevDoc = global.document;
    const prevWin = global.window;
    const prevLs = global.localStorage;
    global.document = doc;
    global.window = win;
    global.localStorage = localStorageMock;

    try {
      let minimizeToggled = 0;
      let posChanged = null;

      const hud = createHud({
        initialPosition: { left: 200, top: 150 },
        onToggleMinimize: () => { minimizeToggled += 1; },
        onPositionChange: (pos) => { posChanged = pos; }
      });

      const rootEl = hud.mount();
      rootEl.rect = { width: 248, height: 280 };

      // Version badge check
      const betaBadge = rootEl.querySelector('.gmah-badge-beta');
      assert.ok(betaBadge, 'HUD must contain .gmah-badge-beta element');
      assert.strictEqual(betaBadge.textContent, '2.0');

      // Restored initial position
      assert.strictEqual(rootEl.style.left, '200px');
      assert.strictEqual(rootEl.style.top, '150px');
      assert.deepStrictEqual(hud.getPosition(), { left: 200, top: 150 });

      // Viewport bounds clamping:
      // Viewport is 1440 x 900. With 248 x 280, maxLeft = 1440 - 248 = 1192, maxTop = 900 - 280 = 620
      const clampedNegative = hud.setPosition({ left: -80, top: -40 });
      assert.strictEqual(clampedNegative.left, 0);
      assert.strictEqual(clampedNegative.top, 0);
      assert.strictEqual(rootEl.style.left, '0px');
      assert.strictEqual(rootEl.style.top, '0px');

      const clampedOverflow = hud.setPosition({ left: 3000, top: 2000 });
      assert.strictEqual(clampedOverflow.left, 1192);
      assert.strictEqual(clampedOverflow.top, 620);
      assert.strictEqual(rootEl.style.left, '1192px');
      assert.strictEqual(rootEl.style.top, '620px');

      // Valid position inside bounds
      hud.setPosition({ left: 320, top: 180 });
      assert.strictEqual(rootEl.style.left, '320px');
      assert.strictEqual(rootEl.style.top, '180px');

      // Test drag handle and distinction between dragging and clicking:
      const header = rootEl.querySelector('.gmah-header');
      const title = rootEl.querySelector('.gmah-title');
      assert.ok(header);
      assert.ok(title);

      // Sub-threshold movement (<= 4px): does NOT drag, triggers click
      header.dispatchEvent({ type: 'pointerdown', clientX: 100, clientY: 100, button: 0, target: header });
      header.dispatchEvent({ type: 'pointermove', clientX: 102, clientY: 101 });
      header.dispatchEvent({ type: 'pointerup', clientX: 102, clientY: 101 });
      title.dispatchEvent({ type: 'click', target: title });
      assert.strictEqual(minimizeToggled, 1, 'Sub-threshold click should trigger minimize');

      // Reset position to (300, 200) for drag test
      hud.setPosition({ left: 300, top: 200 });

      // Above-threshold movement (> 4px): drags HUD, suppresses click
      header.dispatchEvent({ type: 'pointerdown', clientX: 100, clientY: 100, button: 0, target: header });
      header.dispatchEvent({ type: 'pointermove', clientX: 150, clientY: 140 }); // moved dx=50, dy=40
      assert.strictEqual(rootEl.style.left, '350px');
      assert.strictEqual(rootEl.style.top, '240px');

      // Subsequent movement dispatched on doc while dragging is active
      doc.dispatchEvent({ type: 'pointermove', clientX: 160, clientY: 150 });
      assert.strictEqual(rootEl.style.left, '360px');
      assert.strictEqual(rootEl.style.top, '250px');

      doc.dispatchEvent({ type: 'pointerup', clientX: 160, clientY: 150 });
      // Synthesize click event immediately following drag
      title.dispatchEvent({ type: 'click', target: title });
      assert.strictEqual(minimizeToggled, 1, 'Drag must intercept and suppress title click');
      assert.deepStrictEqual(posChanged, { left: 360, top: 250 });

      // Verify position was saved to localStorage
      const savedRaw = localStorageMock.getItem('gmah_hud_position');
      assert.ok(savedRaw);
      assert.deepStrictEqual(JSON.parse(savedRaw), { left: 360, top: 250 });

      // Reset position restores defaults and clears style coordinates
      hud.resetPosition();
      assert.strictEqual(rootEl.style.left, '');
      assert.strictEqual(rootEl.style.top, '');
      assert.strictEqual(rootEl.style.right, '18px');
      assert.strictEqual(rootEl.style.bottom, '84px');

      // Next HUD mount restores saved position from localStorage
      localStorageMock.setItem('gmah_hud_position', JSON.stringify({ left: 450, top: 280 }));
      hud.unmount();

      const hud2 = createHud();
      const root2 = hud2.mount();
      root2.rect = { width: 248, height: 280 };
      assert.strictEqual(root2.style.left, '450px');
      assert.strictEqual(root2.style.top, '280px');

      hud2.unmount();
    } finally {
      global.document = prevDoc;
      global.window = prevWin;
      global.localStorage = prevLs;
    }
  });

  // 32. HUD drag regression: hover without mouse-down must NEVER drag, interactive header buttons stay clickable, and buttons=0 auto-releases
  test('HUD hover never sticks to cursor without pointerdown, header buttons stay clickable, and buttons=0 auto-releases drag', () => {
    const { doc, win, localStorageMock } = createMockEnv();
    const prevDoc = global.document;
    const prevWin = global.window;
    const prevLs = global.localStorage;
    global.document = doc;
    global.window = win;
    global.localStorage = localStorageMock;

    try {
      let minimizeToggled = 0;
      let themeToggled = 0;
      let langCycled = 0;
      let posChanged = 0;

      const hud = createHud({
        initialPosition: { left: 400, top: 300 },
        onToggleMinimize: () => { minimizeToggled += 1; },
        onToggleTheme: () => { themeToggled += 1; },
        onCycleLanguage: () => { langCycled += 1; },
        onPositionChange: () => { posChanged += 1; }
      });

      const rootEl = hud.mount();
      rootEl.rect = { width: 262, height: 290 };
      const header = rootEl.querySelector('.gmah-header');
      const title = rootEl.querySelector('.gmah-title');
      const themeBtn = rootEl.querySelector('.gmah-theme-btn');
      const langBtn = rootEl.querySelector('.gmah-lang-btn');

      // 1) Hover mouse across header and document WITHOUT pointerdown/mousedown
      header.dispatchEvent({ type: 'pointermove', clientX: 800, clientY: 600 });
      header.dispatchEvent({ type: 'mousemove', clientX: 850, clientY: 650 });
      doc.dispatchEvent({ type: 'pointermove', clientX: 900, clientY: 700 });
      doc.dispatchEvent({ type: 'mousemove', clientX: 920, clientY: 720 });

      assert.strictEqual(rootEl.style.left, '400px');
      assert.strictEqual(rootEl.style.top, '300px');
      assert.strictEqual(rootEl.classList.contains('gmah-dragging'), false);
      assert.strictEqual(posChanged, 0);

      // 2) Left click on title immediately after hovering MUST toggle minimize (not just release!)
      header.dispatchEvent({ type: 'pointerdown', clientX: 420, clientY: 315, button: 0, target: title });
      header.dispatchEvent({ type: 'pointerup', clientX: 420, clientY: 315, button: 0, target: title });
      title.dispatchEvent({ type: 'click', target: title });
      assert.strictEqual(minimizeToggled, 1);

      // 3) Clicking theme or language button in header must NOT drag even if mouse slips while pressed
      header.dispatchEvent({ type: 'pointerdown', clientX: 500, clientY: 315, button: 0, target: themeBtn });
      header.dispatchEvent({ type: 'pointermove', clientX: 600, clientY: 415 });
      header.dispatchEvent({ type: 'pointerup', clientX: 600, clientY: 415 });
      themeBtn.click();
      langBtn.click();
      assert.strictEqual(themeToggled, 1);
      assert.strictEqual(langCycled, 1);
      assert.strictEqual(rootEl.style.left, '400px');
      assert.strictEqual(rootEl.style.top, '300px');

      // 4) Active drag auto-releases when pointermove reports buttons: 0 (e.g. released outside browser window)
      header.dispatchEvent({ type: 'pointerdown', clientX: 100, clientY: 100, button: 0, target: header });
      header.dispatchEvent({ type: 'pointermove', clientX: 140, clientY: 130, buttons: 1 });
      assert.strictEqual(rootEl.style.left, '440px');
      assert.strictEqual(rootEl.style.top, '330px');
      assert.strictEqual(rootEl.classList.contains('gmah-dragging'), true);

      doc.dispatchEvent({ type: 'pointermove', clientX: 220, clientY: 220, buttons: 0 });
      assert.strictEqual(rootEl.classList.contains('gmah-dragging'), false);
      assert.strictEqual(rootEl.style.left, '440px');
      assert.strictEqual(rootEl.style.top, '330px');

      // Subsequent hover after release must NOT move HUD
      doc.dispatchEvent({ type: 'pointermove', clientX: 500, clientY: 500 });
      assert.strictEqual(rootEl.style.left, '440px');
      assert.strictEqual(rootEl.style.top, '330px');

      hud.unmount();
    } finally {
      global.document = prevDoc;
      global.window = prevWin;
      global.localStorage = prevLs;
    }
  });

  // 33. Non-chat routes, 0-turn pages, standalone generic buttons, and restored-tab stale chip protection
  test('guards prevent unintended clicks on non-chat pages, 0-turn home screens, standalone generic buttons, and restored tabs', () => {
    assert.strictEqual(isNonChatGeminiUrl('https://gemini.google.com/gems'), true);
    assert.strictEqual(isNonChatGeminiUrl('https://gemini.google.com/u/1/extensions'), true);
    assert.strictEqual(isNonChatGeminiUrl('https://gemini.google.com/settings'), true);
    assert.strictEqual(isNonChatGeminiUrl('https://gemini.google.com/app'), false);
    assert.strictEqual(isNonChatGeminiUrl('https://gemini.google.com/app/chat-123'), false);
    assert.strictEqual(isNonChatGeminiUrl('https://gemini.google.com/gem/coding-partner'), false);

    // 1) Non-chat route (/gems) must never click even if matching buttons exist
    const nonChatEnv = createMockEnv('https://gemini.google.com/gems');
    const gemStartBtn = nonChatEnv.doc.createElement('button', { text: '继续' });
    const gemAllowBtn = nonChatEnv.doc.createElement('button', { text: '始终允许' });
    nonChatEnv.doc.body.appendChild(gemStartBtn);
    nonChatEnv.doc.body.appendChild(gemAllowBtn);
    addTurn(nonChatEnv.doc, '示例');

    const nonChatEngine = new GmahEngine({ doc: nonChatEnv.doc, win: nonChatEnv.win });
    const rNonChat = nonChatEngine.scanOnce();
    assert.strictEqual(rNonChat.action, 'noop');
    assert.strictEqual(rNonChat.reason, 'non_chat_page');
    assert.strictEqual(gemStartBtn.clickCount, 0);
    assert.strictEqual(gemAllowBtn.clickCount, 0);

    // 2) Home / empty chat page (0 assistant turns) must NOT click '开始', '继续', 'Yes', or standalone '同意'/'Allow'
    const homeEnv = createMockEnv('https://gemini.google.com/app');
    let now = 50000;
    const startBtn = homeEnv.doc.createElement('button', { text: '开始' });
    const contBtn = homeEnv.doc.createElement('button', { text: '继续' });
    const agreeBtn = homeEnv.doc.createElement('button', { text: '同意' });
    const standaloneYes = homeEnv.doc.createElement('button', { className: 'follow-up-chip', text: '↪ Yes' });
    homeEnv.doc.body.appendChild(startBtn);
    homeEnv.doc.body.appendChild(contBtn);
    homeEnv.doc.body.appendChild(agreeBtn);
    homeEnv.doc.body.appendChild(standaloneYes);

    const homeEngine = new GmahEngine({ doc: homeEnv.doc, win: homeEnv.win, now: () => now });
    assert.strictEqual(homeEngine.scanOnce().action, 'noop');
    assert.strictEqual(startBtn.clickCount, 0);
    assert.strictEqual(contBtn.clickCount, 0);
    assert.strictEqual(agreeBtn.clickCount, 0);
    assert.strictEqual(standaloneYes.clickCount, 0);

    // Even when a turn exists, standalone '开始' and standalone 'Yes' outside turn/chip are ignored
    contBtn.remove();
    addTurn(homeEnv.doc, '准备好了吗？');
    standaloneYes.remove();
    const randomPageYes = homeEnv.doc.createElement('button', { text: 'Yes' });
    homeEnv.doc.body.appendChild(randomPageYes);
    now += 3000;
    assert.strictEqual(homeEngine.scanOnce().action, 'noop');
    assert.strictEqual(startBtn.clickCount, 0);
    assert.strictEqual(randomPageYes.clickCount, 0);

    // 3) Restored-tab / 2nd-browser protection: ignoreStaleInitialContinue ignores pre-existing chips until user prompts
    const restoredEnv = createMockEnv('https://gemini.google.com/app/restored-chat');
    let t = 100000;
    const oldChip = restoredEnv.doc.createElement('button', { className: 'follow-up-chip', text: '↪ Yes' });
    addTurn(restoredEnv.doc, '昨天的对话内容，要继续吗？', [oldChip]);

    const restoredEngine = new GmahEngine({
      doc: restoredEnv.doc,
      win: restoredEnv.win,
      now: () => t,
      ignoreStaleInitialContinue: true
    });

    // First scan during initial restore window suppresses clicking stale chip
    const rInit = restoredEngine.scanOnce();
    assert.strictEqual(rInit.action, 'noop');
    assert.strictEqual(rInit.reason, 'initial_stale_continue_ignored');
    assert.strictEqual(oldChip.clickCount, 0);

    // Even after 5 seconds, the same pre-existing chip remains ignored
    t += 5000;
    assert.strictEqual(restoredEngine.scanOnce().action, 'noop');
    assert.strictEqual(oldChip.clickCount, 0);

    // After user sends a new prompt and a new chip renders, it clicks normally
    oldChip.remove();
    restoredEngine.onUserManualPrompt();
    const newChip = restoredEnv.doc.createElement('button', { className: 'follow-up-chip', text: '↪ Yes' });
    addTurn(restoredEnv.doc, '新的任务阶段完成，是否继续下一步？', [newChip]);
    t += 2500;
    const rActive = restoredEngine.scanOnce();
    assert.strictEqual(rActive.action, 'clicked_continue');
    assert.strictEqual(newChip.clickCount, 1);
  });

  // 34. Multi-language UI (zh-CN, zh-TW, en, ja) and Light/Dark theme mode in HUD & Popup
  test('HUD and Popup render multi-language labels and toggle dark/light theme cleanly', () => {
    const { doc, win } = createMockEnv();
    const prevDoc = global.document;
    global.document = doc;

    try {
      const hud = createHud();
      const rootEl = hud.mount();
      const engine = new GmahEngine({
        doc,
        win,
        settings: { language: 'en', theme: 'light' }
      });

      hud.update(engine.getState());
      assert.strictEqual(rootEl.classList.contains('gmah-theme-light'), true);
      assert.ok(rootEl.textContent.includes('MCP Helper'));
      assert.ok(rootEl.textContent.includes('Active'));
      assert.ok(rootEl.textContent.includes('E-Stop'));

      engine.updateSettings({ language: 'ja', theme: 'dark' });
      hud.update(engine.getState());
      assert.strictEqual(rootEl.classList.contains('gmah-theme-light'), false);
      assert.ok(rootEl.textContent.includes('MCP ヘルパー'));
      assert.ok(rootEl.textContent.includes('緊急停止'));

      hud.unmount();
    } finally {
      global.document = prevDoc;
    }

    const popupEnv = createMockEnv('chrome-extension://test/popup.html');
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

    const storageState = {
      [D.STORAGE_KEY]: D.mergeSettings({ language: 'zh-CN', theme: 'dark' }),
      [D.STATS_KEY]: { date: D.getTodayKey(), allowCount: 0, continueCount: 0 }
    };
    let removedKeys = [];

    const mockPopupChrome = {
      runtime: { lastError: null },
      storage: {
        local: {
          get(_keys, cb) { cb(Object.assign({}, storageState)); },
          set(obj, cb) { Object.assign(storageState, obj); if (cb) cb(); },
          remove(keys) { removedKeys = removedKeys.concat(keys); }
        }
      },
      tabs: {
        query(_q, cb) { cb([{ id: 1, active: true }]); },
        sendMessage(_tabId, _msg, cb) {
          cb({ ok: true, state: { settings: storageState[D.STORAGE_KEY], circuitBreaker: { tripped: false } } });
        }
      }
    };

    const popup = createPopupController(pdoc, mockPopupChrome);
    popup.init();

    assert.strictEqual(pdoc.body.classList.contains('theme-light'), false);
    pdoc.getElementById('btnToggleTheme').click();
    assert.strictEqual(storageState[D.STORAGE_KEY].theme, 'light');
    assert.strictEqual(pdoc.body.classList.contains('theme-light'), true);

    pdoc.getElementById('language').value = 'en';
    pdoc.getElementById('language').dispatchEvent({ type: 'change', target: pdoc.getElementById('language') });
    assert.strictEqual(storageState[D.STORAGE_KEY].language, 'en');
    assert.strictEqual(pdoc.getElementById('statLive').textContent, 'BG Ready');

    pdoc.getElementById('btnResetHudPos').click();
    assert.ok(removedKeys.includes('gmah_hud_position'));
  });

  // 34. Stall auto-recovery: auto-stop + fill "继续" + send after default 5 min & custom threshold (even with desktop alerts off and hidden tab)
  test('stall auto-recovery stops stuck connecting turn after threshold, writes "继续", and sends automatically', () => {
    const { doc, win } = createMockEnv('https://gemini.google.com/app/stall-recover-1');
    doc.hidden = true; // Verify works in background/hidden tab
    let now = 2000000;
    const alerts = [];
    let resolvedCount = 0;

    addTurn(doc, '正在调用 MCP 工具处理请求...');
    const statusNode = doc.createElement('div', {
      attrs: { role: 'status' },
      text: '正在连接 Desktop Commander (5s)...'
    });
    doc.body.appendChild(statusNode);

    const stopBtn = doc.createElement('button', {
      className: 'send-button stop',
      attrs: { 'aria-label': '停止生成' },
      rect: { width: 36, height: 36 }
    });
    doc.body.appendChild(stopBtn);

    const richTextarea = doc.createElement('rich-textarea');
    const editor = doc.createElement('div', {
      className: 'ql-editor ql-blank',
      attrs: { contenteditable: 'true', role: 'textbox', 'aria-label': '输入提示' },
      rect: { width: 0, height: 0 } // Simulate deferred layout in hidden tab
    });
    richTextarea.appendChild(editor);
    doc.body.appendChild(richTextarea);

    const sendBtn = doc.createElement('button', {
      className: 'send-button',
      attrs: { 'aria-label': '发送消息' },
      disabled: true,
      rect: { width: 0, height: 0 }
    });
    doc.body.appendChild(sendBtn);

    // Simulate real Gemini behavior: clicking Stop removes stopBtn & statusNode; input enables sendBtn
    stopBtn.addEventListener('click', () => {
      stopBtn.remove();
      statusNode.remove();
    });
    editor.addEventListener('input', () => {
      sendBtn.disabled = false;
    });

    const engine = new GmahEngine({
      doc,
      win,
      now: () => now,
      randomFn: () => 0.5, // Deterministic mid-range human pacing: stopSettle=2700ms, charDelay=210ms, sendSettle=1650ms
      settings: {
        stallAlertEnabled: false, // Auto-recovery must still work even if desktop alerts are disabled!
        stallAutoRecoverEnabled: true,
        stallAutoRecoverMinutes: 5,
        stallAutoRecoverPrompt: '继续',
        humanPacingEnabled: true
      },
      onStallAlert: (p) => alerts.push(p),
      onStallResolved: () => { resolvedCount += 1; }
    });

    // t = 0: start stall tracking
    const r0 = engine.scanOnce();
    assert.strictEqual(r0.action, 'wait');
    assert.strictEqual(stopBtn.clickCount, 0);

    // t = 4m 59s: animated status text must NOT reset timer and must NOT trigger early
    now += 4 * 60 * 1000 + 59 * 1000;
    statusNode.textContent = '正在连接 Desktop Commander (299s)...';
    const rEarly = engine.scanOnce();
    assert.strictEqual(rEarly.action, 'wait');
    assert.strictEqual(stopBtn.clickCount, 0);

    // t = 5m 00s: threshold hit -> clicks Stop button!
    now += 1000;
    const rStop = engine.scanOnce();
    assert.strictEqual(rStop.action, 'stall_recover_stop');
    assert.strictEqual(rStop.minutes, 5);
    assert.strictEqual(rStop.prompt, '继续');
    assert.strictEqual(stopBtn.clickCount, 1);
    assert.strictEqual(engine.getState().stallRecoveryActive, true);

    // t + 1000ms: still in natural post-stop pacing cooldown (must NOT rush to type right after Stop!)
    now += 1000;
    const rSettle = engine.scanOnce();
    assert.strictEqual(rSettle.action, 'wait');
    assert.strictEqual(rSettle.reason, 'stall_recover_settling');

    // t + 1800ms (total 2800ms >= 2700ms): begins natural char-by-char typing ('继')
    now += 1800;
    const rType1 = engine.scanOnce();
    assert.strictEqual(rType1.action, 'stall_recover_type');
    assert.strictEqual(rType1.typed, '继');
    assert.strictEqual(editor.textContent.trim(), '继');

    // t + 250ms: types second char ('继续') and enters pre-send human pause
    now += 250;
    const rFill = engine.scanOnce();
    assert.strictEqual(rFill.action, 'stall_recover_fill');
    assert.strictEqual(rFill.prompt, '继续');
    assert.strictEqual(editor.textContent.trim(), '继续');
    assert.strictEqual(editor.classList.contains('ql-blank'), false);
    assert.strictEqual(sendBtn.disabled, false);

    // t + 500ms: still in natural pre-send pause (must NOT fire Send immediately after typing!)
    now += 500;
    const rPause = engine.scanOnce();
    assert.strictEqual(rPause.action, 'wait');
    assert.strictEqual(rPause.reason, 'stall_recover_send_settle');
    assert.strictEqual(sendBtn.clickCount, 0);

    // t + 1300ms (total 1800ms >= 1650ms): clicks Send button and completes recovery
    now += 1300;
    const rSend = engine.scanOnce();
    assert.strictEqual(rSend.action, 'stall_recover_sent');
    assert.strictEqual(rSend.method, 'button');
    assert.strictEqual(rSend.prompt, '继续');
    assert.strictEqual(rSend.recoveryCount, 1);
    assert.strictEqual(sendBtn.clickCount, 1);
    assert.strictEqual(engine.getState().stallRecoveryActive, false);
    assert.strictEqual(engine.getState().stallRecoveryCount, 1);
    assert.strictEqual(alerts.length, 0);
    void resolvedCount;
  });

  // 35. Stall auto-recovery safety guards: user draft protection, max retries cap + progress reset, quota guard, and Enter fallback
  test('stall auto-recovery protects user draft, enforces max recoveries cap, resets on progress, and supports Enter fallback', () => {
    const { doc, win } = createMockEnv('https://gemini.google.com/app/stall-guards');
    let now = 3000000;
    const alerts = [];

    const turn = addTurn(doc, '工具执行中...');
    const statusNode = doc.createElement('div', {
      attrs: { role: 'status' },
      text: 'Connecting to MCP server...'
    });
    doc.body.appendChild(statusNode);

    const textarea = doc.createElement('textarea', {
      attrs: { 'aria-label': 'Enter a prompt here' },
      value: '用户正在手动输入的问题'
    });
    doc.body.appendChild(textarea);

    const engine = new GmahEngine({
      doc,
      win,
      now: () => now,
      settings: {
        stallAlertEnabled: true,
        stallAlertMinutes: 2,
        stallAutoRecoverEnabled: true,
        stallAutoRecoverMinutes: 2,
        stallAutoRecoverPrompt: '继续',
        maxStallRecoveriesPerTask: 2,
        humanPacingEnabled: false // Also exercises fast non-paced mode cleanly
      },
      onStallAlert: (p) => alerts.push(p)
    });

    // 1) User has unsent draft in textarea -> MUST NOT overwrite draft; falls back to desktop alert
    engine.scanOnce();
    now += 2 * 60 * 1000;
    engine.scanOnce();
    assert.strictEqual(textarea.value, '用户正在手动输入的问题', 'User draft must never be overwritten');
    assert.strictEqual(engine.stallRecoveryCount, 0);
    assert.strictEqual(alerts.length, 1, 'Desktop alert should fire when draft blocks auto-recovery');

    // 2) Clear draft and produce a new turn -> direct fill + Enter fallback (no Stop button & no Send button)
    textarea.value = '';
    turn.textContent = '新的响应阶段，继续连接...';
    now += 5000;
    engine.scanOnce(); // progress resets timer & blocked fingerprint

    now += 2 * 60 * 1000;
    const rFill = engine.scanOnce();
    assert.strictEqual(rFill.action, 'stall_recover_fill');
    assert.strictEqual(textarea.value, '继续');

    // Wait past targetSendSettleMs + STALL_SEND_FALLBACK_MS with no Send button -> dispatches Enter key on textarea!
    now += 2500;
    const rEnter = engine.scanOnce();
    assert.strictEqual(rEnter.action, 'stall_recover_sent');
    assert.strictEqual(rEnter.method, 'enter');
    assert.strictEqual(rEnter.recoveryCount, 1);
    assert.ok(textarea.dispatchedEvents.includes('keydown'));

    // 3) Second recovery hits maxStallRecoveriesPerTask (2/2), third stall must NOT auto-recover and must alert
    textarea.value = '';
    now += 1000;
    engine.scanOnce(); // starts new stall timer
    now += 2 * 60 * 1000;
    const rFill2 = engine.scanOnce();
    assert.strictEqual(rFill2.action, 'stall_recover_fill');
    now += 2500;
    const rEnter2 = engine.scanOnce();
    assert.strictEqual(rEnter2.action, 'stall_recover_sent');
    assert.strictEqual(rEnter2.recoveryCount, 2);

    textarea.value = '';
    now += 1000;
    engine.scanOnce(); // starts 3rd stall timer
    const alertsBeforeCap = alerts.length;
    now += 2 * 60 * 1000;
    const rCapped = engine.scanOnce();
    assert.notStrictEqual(rCapped.action, 'stall_recover_fill');
    assert.strictEqual(textarea.value, '', 'Must not fill prompt once maxStallRecoveriesPerTask is reached');
    assert.strictEqual(alerts.length, alertsBeforeCap + 1, 'Desktop alert should notify user when recovery cap reached');

    // 4) Once Gemini produces genuine new progress, stallRecoveryCount resets back to 0!
    turn.textContent = '工具恢复成功，已经产出全新的回复内容！';
    now += 5000;
    engine.scanOnce();
    assert.strictEqual(engine.stallRecoveryCount, 0);

    // 5) Quota error banner while stalled trips quota_error breaker instead of sending "继续"
    const alertBanner = doc.createElement('div', {
      attrs: { role: 'alert' },
      text: 'You have reached your usage limit. Please try again later.'
    });
    doc.body.appendChild(alertBanner);
    now += 2 * 60 * 1000;
    const rQuota = engine.scanOnce();
    assert.strictEqual(rQuota.action, 'tripped');
    assert.strictEqual(rQuota.reason, 'quota_error');
    assert.strictEqual(textarea.value, '');
  });

  // 36. Popup renders, clamps, and persists stall auto-recovery settings
  test('popup.js renders, clamps, and saves stallAutoRecover settings cleanly', () => {
    const popupEnv = createMockEnv('chrome-extension://test/popup.html');
    const pdoc = popupEnv.doc;
    const ids = [
      'enabled', 'autoAllow', 'preferAlwaysAllow', 'fallbackSingleAllow',
      'autoContinue', 'backgroundMode', 'preventTabDiscard', 'showHud',
      'maxContinuesPerTask', 'dailyContinueLimit', 'continueCooldownSec', 'idleSettleSec',
      'stopOnCompletionCues', 'stopOnStagnantOutput', 'stopOnQuotaOrError',
      'stallAlertEnabled', 'stallAlertMinutes', 'btnToggleNotif', 'btnTestNotif',
      'stallAutoRecoverEnabled', 'stallAutoRecoverMinutes', 'maxStallRecoveriesPerTask', 'stallAutoRecoverPrompt',
      'language', 'btnToggleTheme', 'btnResetHudPos',
      'customAlwaysAllowKeywords', 'customContinueKeywords',
      'statAllow', 'statContinue', 'statLive',
      'btnEmergency', 'btnResetBreaker', 'btnResetStats', 'btnDefaults', 'btnSave', 'toast'
    ];
    for (const id of ids) pdoc.body.appendChild(pdoc.createElement('input', { id }));

    const storageState = {
      [D.STORAGE_KEY]: D.mergeSettings({
        stallAutoRecoverEnabled: true,
        stallAutoRecoverMinutes: 5,
        maxStallRecoveriesPerTask: 3,
        stallAutoRecoverPrompt: '继续'
      }),
      [D.STATS_KEY]: D.createEmptyStats()
    };

    const mockChrome = {
      runtime: { lastError: null, sendMessage() {} },
      storage: {
        local: {
          get(_k, cb) { cb(JSON.parse(JSON.stringify(storageState))); },
          set(obj, cb) { Object.assign(storageState, JSON.parse(JSON.stringify(obj))); if (cb) cb(); }
        }
      },
      tabs: { query(_q, cb) { cb([]); } }
    };

    const popup = createPopupController(pdoc, mockChrome);
    popup.init();

    assert.strictEqual(pdoc.getElementById('stallAutoRecoverEnabled').checked, true);
    assert.strictEqual(pdoc.getElementById('stallAutoRecoverMinutes').value, '5');
    assert.strictEqual(pdoc.getElementById('maxStallRecoveriesPerTask').value, '3');
    assert.strictEqual(pdoc.getElementById('stallAutoRecoverPrompt').value, '继续');

    // Update threshold to 3 minutes and custom prompt
    pdoc.getElementById('stallAutoRecoverMinutes').value = '3';
    pdoc.getElementById('maxStallRecoveriesPerTask').value = '6';
    pdoc.getElementById('stallAutoRecoverPrompt').value = '请继续';
    pdoc.getElementById('stallAutoRecoverMinutes').dispatchEvent({ type: 'change' });

    assert.strictEqual(storageState[D.STORAGE_KEY].stallAutoRecoverMinutes, 3);
    assert.strictEqual(storageState[D.STORAGE_KEY].maxStallRecoveriesPerTask, 6);
    assert.strictEqual(storageState[D.STORAGE_KEY].stallAutoRecoverPrompt, '请继续');
  });

  // 37. Live Desktop Commander connecting timer in HUD & Popup
  test('live connecting wait timer tracks Desktop Commander elapsed time in HUD and Popup and resets on progress', () => {
    const { doc, win } = createMockEnv('https://gemini.google.com/app/dc-timer');
    let now = 4000000;

    // Unclassed <span> inside <model-response> (realistic Gemini Desktop Commander connecting card)
    const connSpan = doc.createElement('span', { text: '正在连接 Desktop Commander (12s)...' });
    const turn = addTurn(doc, '', [connSpan]);
    const stopBtn = doc.createElement('button', {
      className: 'send-button stop',
      attrs: { 'aria-label': '停止回复' }
    });
    doc.body.appendChild(stopBtn);

    const engine = new GmahEngine({
      doc,
      win,
      now: () => now,
      settings: {
        stallAutoRecoverEnabled: true,
        stallAutoRecoverMinutes: 5
      }
    });

    const prevDoc = global.document;
    const prevWin = global.window;
    global.document = doc;
    global.window = win;
    try {
      const hud = createHud({});
      const rootEl = hud.mount();

      // t = 0: detects connecting label inside latest turn
      engine.scanOnce();
      hud.update(engine.getState());
      assert.strictEqual(engine.stallConnectingLabel, '正在连接 Desktop Commander');
      const waitBar = rootEl.querySelector('.gmah-wait-bar');
      assert.ok(waitBar);
      assert.strictEqual(waitBar.style.display, 'block');
      assert.ok(waitBar.textContent.includes('正在连接 Desktop Commander'));

      // t = 2m 15s: wait bar updates with exact elapsed duration
      now += 135 * 1000;
      connSpan.textContent = '正在连接 Desktop Commander (147s)...';
      engine.scanOnce();
      const state2m = engine.getState();
      assert.strictEqual(state2m.stallElapsedMs, 135000);
      hud.update(state2m);
      assert.ok(waitBar.textContent.includes('2分15秒'), `Expected 2分15秒 in "${waitBar.textContent}"`);
      assert.ok(waitBar.textContent.includes('5分钟'));
      assert.ok(!waitBar.className.includes('warn'));

      // t = 3m 30s (>= 60% of 5m threshold): turns amber warn
      now += 75 * 1000;
      engine.scanOnce();
      hud.update(engine.getState());
      assert.ok(waitBar.textContent.includes('3分30秒'));
      assert.ok(waitBar.className.includes('warn'));

      // Popup statLive also displays live waiting duration
      const popupEnv = createMockEnv('chrome-extension://test/popup.html');
      const liveEl = popupEnv.doc.createElement('strong', { id: 'statLive' });
      popupEnv.doc.body.appendChild(liveEl);
      const popup = createPopupController(popupEnv.doc, null);
      popup.renderLiveStatus(engine.getState(), { reason: 'ok' });
      assert.strictEqual(liveEl.textContent, '等待 3分30秒');

      // Output arrives & stop button removed -> timer hides cleanly
      stopBtn.remove();
      connSpan.remove();
      turn.textContent = 'Desktop Commander 返回了目录列表结果！';
      now += 2000;
      engine.scanOnce();
      hud.update(engine.getState());
      assert.strictEqual(engine.getState().stallElapsedMs, 0);
      assert.strictEqual(waitBar.style.display, 'none');

      hud.unmount();
    } finally {
      global.document = prevDoc;
      global.window = prevWin;
    }
  });

  // 38. Immediate "立即续接" button next to "超时自动续接" in HUD & Popup forces stop + send "继续" right away
  test('immediate "立即续接" button in HUD and Popup cancels stuck turn and sends "继续" without waiting 5 minutes', () => {
    const { doc, win } = createMockEnv('https://gemini.google.com/app/force-recover');
    let now = 5000000;

    addTurn(doc, '正在等待 Desktop Commander 响应...');

    // Icon-only Stop button (<mat-icon fonticon="stop">) to test broadened Stop detection
    const stopBtn = doc.createElement('button', { className: 'send-button' });
    const stopIcon = doc.createElement('mat-icon', { attrs: { fonticon: 'stop' } });
    stopBtn.appendChild(stopIcon);
    doc.body.appendChild(stopBtn);

    const editor = doc.createElement('div', {
      className: 'ql-editor ql-blank',
      attrs: { contenteditable: 'true', role: 'textbox' }
    });
    doc.body.appendChild(editor);

    const sendBtn = doc.createElement('button', {
      className: 'send-button',
      attrs: { 'aria-label': '发送消息' },
      disabled: true
    });
    doc.body.appendChild(sendBtn);

    stopBtn.addEventListener('click', () => { stopBtn.remove(); });
    editor.addEventListener('input', () => { sendBtn.disabled = false; });

    // Even with auto-recover OFF and master switch paused, manual user click MUST still execute (with safe human pacing)!
    const engine = new GmahEngine({
      doc,
      win,
      now: () => now,
      randomFn: () => 0.5, // manual stopSettle=1950ms, charDelay=210ms, sendSettle=1300ms
      settings: {
        enabled: false,
        stallAutoRecoverEnabled: false,
        stallAutoRecoverMinutes: 5,
        stallAutoRecoverPrompt: '继续',
        humanPacingEnabled: true
      }
    });

    const prevDoc = global.document;
    const prevWin = global.window;
    global.document = doc;
    global.window = win;
    try {
      let forceClicks = 0;
      const hud = createHud({
        onForceStallRecover: () => {
          forceClicks += 1;
          engine.forceStallRecovery();
        }
      });
      const rootEl = hud.mount();
      hud.update(engine.getState());

      const rows = rootEl.querySelectorAll('.gmah-row');
      const recoverRow = rows[5];
      const forceBtn = recoverRow.querySelector('.gmah-pill-action');
      assert.ok(forceBtn, 'HUD stall recover row must have immediate "立即续接" button');
      assert.strictEqual(forceBtn.textContent, '立即续接');

      // Click "立即续接" immediately at t = 0 (no 5 min wait!)
      forceBtn.click();
      assert.strictEqual(forceClicks, 1);
      assert.strictEqual(stopBtn.clickCount, 1, 'Icon-based Stop button must be clicked immediately');
      assert.strictEqual(engine.getState().stallRecoveryActive, true);

      // Next scans complete natural settle -> char-by-char type -> natural pre-send pause -> click Send even while enabled=false!
      now += 2000;
      const rType = engine.scanOnce();
      assert.strictEqual(rType.action, 'stall_recover_type');
      assert.strictEqual(editor.textContent.trim(), '继');

      now += 250;
      const rFill = engine.scanOnce();
      assert.strictEqual(rFill.action, 'stall_recover_fill');
      assert.strictEqual(editor.textContent.trim(), '继续');

      now += 1400;
      const rSend = engine.scanOnce();
      assert.strictEqual(rSend.action, 'stall_recover_sent');
      assert.strictEqual(rSend.manual, true);
      assert.strictEqual(sendBtn.clickCount, 1);
      assert.strictEqual(engine.stallRecoveryCount, 0, 'Manual force-recovery must not consume auto-recovery budget');

      hud.unmount();
    } finally {
      global.document = prevDoc;
      global.window = prevWin;
    }

    // Also verify Popup's btnForceRecover sends GMAH_FORCE_STALL_RECOVER
    const popupEnv = createMockEnv('chrome-extension://test/popup.html');
    for (const id of ['btnForceRecover', 'statLive', 'toast', 'btnSave']) {
      popupEnv.doc.body.appendChild(popupEnv.doc.createElement('button', { id }));
    }
    const sentMsgs = [];
    const mockChrome = {
      runtime: { lastError: null },
      storage: { local: { get(_k, cb) { cb({}); }, set(_o, cb) { if (cb) cb(); } } },
      tabs: {
        query(_q, cb) { cb([{ id: 42, active: true }]); },
        sendMessage(_id, msg, cb) {
          sentMsgs.push(msg);
          cb({ ok: true, state: engine.getState() });
        }
      }
    };
    const popup = createPopupController(popupEnv.doc, mockChrome);
    popup.init();
    popupEnv.doc.getElementById('btnForceRecover').click();
    assert.ok(sentMsgs.some((m) => m.type === 'GMAH_FORCE_STALL_RECOVER'));
  });

  // 39. Anti-burst governor slows down rapid consecutive actions & pointer click includes natural hover + non-center jitter
  test('anti-burst pacing governor adds cool-off after rapid bursts and clicks include hover + natural coordinate jitter', () => {
    const { doc, win } = createMockEnv('https://gemini.google.com/app/anti-burst');
    let now = 6000000;
    const engine = new GmahEngine({
      doc,
      win,
      now: () => now,
      randomFn: () => 0.8,
      settings: { allowCooldownMs: 600, humanPacingEnabled: true }
    });

    // Simulate 4 rapid allow clicks within 10s -> 4th click triggers anti-burst cool-off (> 2400ms)!
    for (let i = 0; i < 4; i++) {
      const btn = doc.createElement('button', { text: '始终允许' });
      doc.body.appendChild(btn);
      const res = engine.scanOnce();
      assert.strictEqual(res.action, 'clicked_allow');
      btn.remove();
      now += 1000;
    }

    // 5th Allow button right after 1000ms must be held back by anti-burst cool-off!
    const btn5 = doc.createElement('button', { text: '始终允许' });
    doc.body.appendChild(btn5);
    const held = engine.scanOnce();
    assert.strictEqual(held.action, 'wait');
    assert.strictEqual(held.reason, 'allow_cooldown');
    assert.ok(held.retryInMs > 1500, `Expected anti-burst cool-off > 1500ms, got ${held.retryInMs}`);

    // Advance past anti-burst cool-off -> clicks cleanly
    now += held.retryInMs + 100;
    const passed = engine.scanOnce();
    assert.strictEqual(passed.action, 'clicked_allow');

    // Verify defaultClickElement dispatches hover events and non-center coordinates
    const testBtn = doc.createElement('button', { text: 'Send', rect: { left: 100, top: 200, width: 100, height: 40 } });
    const received = [];
    win.PointerEvent = class { constructor(type, opts) { this.type = type; Object.assign(this, opts); } };
    win.MouseEvent = class { constructor(type, opts) { this.type = type; Object.assign(this, opts); } };
    for (const evType of ['pointerover', 'pointermove', 'mouseover', 'pointerdown', 'mousedown', 'pointerup', 'mouseup']) {
      testBtn.addEventListener(evType, (e) => received.push({ type: e.type, clientX: e.clientX, clientY: e.clientY }));
    }
    defaultClickElement(testBtn, win, 1, () => 0.9);
    assert.ok(received.some((e) => e.type === 'pointerover'));
    assert.ok(received.some((e) => e.type === 'mouseover'));
    assert.ok(received.some((e) => e.type === 'pointerdown'));
    // With rand=0.9, offsetX = (0.9 - 0.5)*0.44 = +0.176 -> clientX = 100 + 100*0.676 = 168 (not dead center 150!)
    assert.notStrictEqual(received[0].clientX, 150);
    assert.ok(received[0].clientX >= 120 && received[0].clientX <= 180);
  });

  // 40. v1.0.0 default & custom reconnect prompt ('继续，刚才mcp连接断开了') natural chunked typing + Popup live-typing non-clobber
  test('v1.0.0 default and custom reconnect prompts type cleanly in chunks and Popup preserves active input while typing', () => {
    const { doc, win } = createMockEnv('https://gemini.google.com/app/custom-reconnect-v1');
    let now = 7000000;

    addTurn(doc, '正在调用 MCP 工具...');
    const editor = doc.createElement('div', {
      className: 'ql-editor ql-blank',
      attrs: { contenteditable: 'true', role: 'textbox' }
    });
    doc.body.appendChild(editor);

    const sendBtn = doc.createElement('button', {
      className: 'send-button',
      attrs: { 'aria-label': '发送消息' },
      disabled: true
    });
    doc.body.appendChild(sendBtn);
    editor.addEventListener('input', () => { sendBtn.disabled = false; });

    // 1) Default v1.0.0 reconnect prompt: '继续，刚才mcp连接断开了'
    const engine = new GmahEngine({
      doc,
      win,
      now: () => now,
      randomFn: () => 0.5
    });
    assert.strictEqual(engine.settings.stallAutoRecoverPrompt, '继续，刚才mcp连接断开了');

    let stepRes = engine.forceStallRecovery();
    let safety = 0;
    const typedSnapshots = [];
    while (stepRes && stepRes.action !== 'stall_recover_sent' && safety < 20) {
      if (stepRes.action === 'stall_recover_type') {
        typedSnapshots.push(stepRes.typed);
      }
      now += (stepRes.retryInMs || 300) + 50;
      stepRes = engine.scanOnce();
      safety += 1;
    }
    assert.strictEqual(stepRes.action, 'stall_recover_sent');
    assert.strictEqual(stepRes.prompt, '继续，刚才mcp连接断开了');
    assert.strictEqual(editor.textContent.trim(), '继续，刚才mcp连接断开了');
    assert.ok(typedSnapshots.length >= 2, 'Longer reconnect prompt should type naturally in multiple chunks');
    assert.strictEqual(sendBtn.clickCount, 1);

    // 2) Custom user reconnect prompt with mixed comma/spaces/ASCII+Chinese
    const customMsg = '继续,刚才mcp 连接断开了，请接着上一步完成测试';
    editor.textContent = '';
    sendBtn.disabled = true;
    engine.updateSettings({ stallAutoRecoverPrompt: customMsg }, false);

    now += 5000;
    stepRes = engine.forceStallRecovery();
    safety = 0;
    while (stepRes && stepRes.action !== 'stall_recover_sent' && safety < 20) {
      now += (stepRes.retryInMs || 300) + 50;
      stepRes = engine.scanOnce();
      safety += 1;
    }
    assert.strictEqual(stepRes.action, 'stall_recover_sent');
    assert.strictEqual(stepRes.prompt, customMsg);
    assert.strictEqual(editor.textContent.trim(), customMsg);
    assert.strictEqual(sendBtn.clickCount, 2);

    // 3) Popup renderSettings({ preserveActiveInput: true }) must NOT overwrite actively focused input mid-typing
    const popupEnv = createMockEnv('chrome-extension://test/popup.html');
    const promptInput = popupEnv.doc.createElement('input', { id: 'stallAutoRecoverPrompt', value: '继续，刚才 ' });
    popupEnv.doc.body.appendChild(promptInput);
    popupEnv.doc.activeElement = promptInput;
    const popup = createPopupController(popupEnv.doc, null);
    popup.renderSettings({ stallAutoRecoverPrompt: '继续，刚才' }, { preserveActiveInput: true });
    assert.strictEqual(promptInput.value, '继续，刚才 ', 'Trailing space in actively focused input must not be clobbered while typing');
    popup.renderSettings({ stallAutoRecoverPrompt: '继续，刚才mcp连接断开了' });
    assert.strictEqual(promptInput.value, '继续，刚才mcp连接断开了', 'Explicit render without preserveActiveInput updates field value');
  });

  // 42. Circuit breaker desktop notification & badge wiring across content.js and background.js
  test('circuit breaker alerts wire end-to-end across GmahEngine and background.js (badge, notification, click focus, cleanup)', () => {
    const createdNotifs = [];
    const clearedNotifs = [];
    const badgeUpdates = [];
    const badgeColors = [];
    const windowUpdates = [];
    const tabUpdates = [];

    const mockChrome = {
      runtime: {
        lastError: null,
        getURL: (p) => `chrome-extension://test/${p}`,
        onConnect: { addListener() {} },
        onMessage: { addListener() {} },
        onInstalled: { addListener() {} },
        onStartup: { addListener() {} }
      },
      storage: {
        local: {
          get(_k, cb) {
            cb({
              [D.STORAGE_KEY]: {
                language: 'zh-CN',
                enabled: true,
                backgroundMode: true,
                preventTabDiscard: true,
                stallAlertEnabled: true
              }
            });
          }
        },
        onChanged: { addListener() {} }
      },
      action: {
        setBadgeText(opts, cb) { badgeUpdates.push(opts); if (cb) cb(); },
        setBadgeBackgroundColor(opts, cb) { badgeColors.push(opts); if (cb) cb(); }
      },
      notifications: {
        create(id, opts, cb) { createdNotifs.push({ id, opts }); if (cb) cb(id); },
        clear(id, cb) { clearedNotifs.push(id); if (cb) cb(true); },
        onClicked: { addListener() {} }
      },
      windows: {
        get(winId, cb) { cb({ id: winId, state: 'minimized' }); },
        update(winId, props, cb) { windowUpdates.push({ winId, props }); if (cb) cb(); }
      },
      tabs: {
        get(tabId, cb) { cb({ id: tabId, windowId: 91 }); },
        update(tabId, props, cb) { tabUpdates.push({ tabId, props }); if (cb) cb(); },
        query(_q, cb) { cb([]); },
        onUpdated: { addListener() {} },
        onRemoved: { addListener() {} }
      },
      alarms: {
        create() {},
        clear() {},
        onAlarm: { addListener() {} }
      }
    };

    const bg = createBackgroundController(mockChrome);
    bg.init();

    const { doc, win } = createMockEnv();
    const trippedPayloads = [];
    let clearCalls = 0;

    const engine = new GmahEngine({
      doc,
      win,
      onBreakerTrip: (payload) => {
        trippedPayloads.push(payload);
        bg.handleRuntimeMessage(Object.assign({ type: 'GMAH_BREAKER_ALERT' }, payload), { tab: { id: 501 } });
      },
      onBreakerClear: () => {
        clearCalls += 1;
        bg.handleRuntimeMessage({ type: 'GMAH_BREAKER_CLEAR' }, { tab: { id: 501 } });
      }
    });

    // 1) Non-emergency breaker (quota_error) triggers amber "!!" badge + desktop notification
    engine.tripBreaker('quota_error', null, 'breakerReasonQuotaError', { kw: 'quota exceeded' });
    assert.strictEqual(trippedPayloads.length, 1);
    assert.strictEqual(trippedPayloads[0].reasonCode, 'quota_error');
    assert.strictEqual(trippedPayloads[0].notify, true);
    assert.ok(badgeUpdates.some((b) => b.tabId === 501 && b.text === '!!'));
    assert.ok(badgeColors.some((b) => b.tabId === 501 && b.color === '#fbbc04'));
    assert.strictEqual(createdNotifs.length, 1);
    assert.strictEqual(createdNotifs[0].id, `${bg.BREAKER_NOTIF_PREFIX}501`);
    assert.ok(createdNotifs[0].opts.message.includes('quota exceeded'));

    // 2) Clicking breaker notification restores minimized window, activates tab, and clears alert/badge
    bg.handleNotificationClicked(`${bg.BREAKER_NOTIF_PREFIX}501`);
    assert.ok(clearedNotifs.includes(`${bg.BREAKER_NOTIF_PREFIX}501`));
    assert.strictEqual(badgeUpdates[badgeUpdates.length - 1].text, '');
    assert.deepStrictEqual(windowUpdates[0], { winId: 91, props: { focused: true, state: 'normal' } });
    assert.ok(tabUpdates.some((u) => u.tabId === 501 && u.props.active === true));

    // 3) Clearing breaker fires onBreakerClear and clears background alert
    engine.clearBreaker();
    assert.strictEqual(clearCalls, 1);

    // 4) Emergency stop sets red "!" badge without creating a desktop notification
    const notifCountBeforeEmergency = createdNotifs.length;
    engine.emergencyStop();
    assert.strictEqual(trippedPayloads[1].reasonCode, 'emergency_stop');
    assert.strictEqual(trippedPayloads[1].notify, false);
    assert.strictEqual(createdNotifs.length, notifCountBeforeEmergency);
    assert.strictEqual(badgeUpdates[badgeUpdates.length - 1].text, '!');
    assert.strictEqual(badgeColors[badgeColors.length - 1].color, '#ea4335');

    // 5) Closing tab cleans up breaker badge and notification
    bg.handleRuntimeMessage(
      { type: 'GMAH_BREAKER_ALERT', reasonCode: 'task_limit', reason: '达到上限', notify: true },
      { tab: { id: 502 } }
    );
    assert.ok(createdNotifs.some((n) => n.id === `${bg.BREAKER_NOTIF_PREFIX}502`));
    bg.handleTabRemoved(502);
    assert.ok(clearedNotifs.includes(`${bg.BREAKER_NOTIF_PREFIX}502`));
    assert.ok(badgeUpdates.some((b) => b.tabId === 502 && b.text === ''));
  });
}

module.exports = { runTests };
