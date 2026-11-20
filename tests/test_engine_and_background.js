'use strict';

const assert = require('assert');
const D = require('../defaults.js');
const { GmahEngine, getAssistantTurns, getElementLabel, defaultClickElement } = require('../content.js');
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

  dispatchEvent(ev) {
    this.dispatchedEvents.push(ev.type);
    const list = this._listeners.get(ev.type) || [];
    for (const fn of list) fn(ev);
    return true;
  }

  click() {
    this.clickCount += 1;
    this.dispatchEvent({ type: 'click', target: this });
  }
}

function createMockEnv(url) {
  const doc = {
    hidden: false,
    body: null,
    documentElement: null,
    createElement(tag, opts) { return new MockNode(tag, doc, opts); },
    getElementById(id) { return doc.body ? doc.body.querySelector(`#${id}`) : null; },
    querySelectorAll(sel) { return doc.body ? doc.body.querySelectorAll(sel) : []; }
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

  const win = {
    innerWidth: 1440,
    innerHeight: 900,
    location: { href: url || 'https://gemini.google.com/app/chat-1' },
    PointerEvent: MockEvent,
    MouseEvent: MockEvent,
    getComputedStyle(el) {
      return el.style || { display: '', visibility: '', opacity: '', pointerEvents: '' };
    }
  };

  return { doc, win };
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
    assert.strictEqual(pdoc.getElementById('statContinue').textContent, '3 / 30');
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
}

module.exports = { runTests };
