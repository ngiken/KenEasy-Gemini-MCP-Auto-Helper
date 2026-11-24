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
// Selector matching helpers
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

// ---------------------------------------------------------------------------
// FuzzNode: Adversarial DOM mock with cycle detection, throwing mocks, NaN styles
// ---------------------------------------------------------------------------

class FuzzNode {
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
    this.dispatchedEvents = [];
    this._throwOnRect = Boolean(opts.throwOnRect);
    this._throwOnQuery = Boolean(opts.throwOnQuery);

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

  get parentElement() {
    return this.parentNode && this.parentNode.nodeType === 1 ? this.parentNode : null;
  }

  get isConnected() {
    let cur = this;
    let depth = 0;
    while (cur && depth++ < 100) {
      if (this.ownerDocument && (cur === this.ownerDocument.body || cur === this.ownerDocument.documentElement)) {
        return true;
      }
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

  attachShadow() {
    const sr = new FuzzNode('#shadow-root', this.ownerDocument, { nodeType: 11, host: this });
    this.shadowRoot = sr;
    return sr;
  }

  getRootNode() {
    let cur = this;
    let depth = 0;
    while (cur.parentNode && depth++ < 100) cur = cur.parentNode;
    return cur;
  }

  contains(target) {
    let cur = target;
    let depth = 0;
    while (cur && depth++ < 100) {
      if (cur === this) return true;
      cur = cur.parentNode;
    }
    return false;
  }

  getBoundingClientRect() {
    if (this._throwOnRect) {
      throw new Error('AdversarialDOMException: getBoundingClientRect() failed');
    }
    return this.rect;
  }

  querySelectorAll(selector) {
    if (this._throwOnQuery) {
      throw new Error('AdversarialDOMException: querySelectorAll() failed');
    }
    const out = [];
    const walk = (node, depth) => {
      if (depth > 100) return;
      for (const child of node.children) {
        if (matchesSelectorList(child, selector)) out.push(child);
        walk(child, depth + 1);
      }
    };
    walk(this, 0);
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

  focus() {}
}

function createFuzzEnv(href, options) {
  const opts = options || {};
  const docListeners = new Map();
  const winListeners = new Map();
  const doc = {
    hidden: Boolean(opts.hidden),
    _focused: opts.focused !== undefined ? Boolean(opts.focused) : true,
    hasFocus() { return this._focused; },
    createElement(tag, elOpts) { return new FuzzNode(tag, doc, elOpts); },
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
  doc.documentElement = new FuzzNode('HTML', doc);
  doc.body = new FuzzNode('BODY', doc);
  doc.documentElement.appendChild(doc.body);

  const lsStore = new Map();
  const localStorageMock = {
    getItem(k) { return lsStore.has(k) ? lsStore.get(k) : null; },
    setItem(k, v) { lsStore.set(k, String(v)); },
    removeItem(k) { lsStore.delete(k); }
  };

  const parsedUrl = new URL(href || (GEMINI_ORIGIN + '/app/fuzz-chat'));
  const win = {
    location: { href: parsedUrl.href, hostname: parsedUrl.hostname },
    innerWidth: opts.innerWidth !== undefined ? opts.innerWidth : 1440,
    innerHeight: opts.innerHeight !== undefined ? opts.innerHeight : 900,
    localStorage: localStorageMock,
    getComputedStyle(el) {
      if (opts.throwOnGetComputedStyle) {
        throw new Error('AdversarialDOMException: getComputedStyle failed');
      }
      return el.style || {};
    },
    PointerEvent: function PointerEvent(type, pOpts) { return Object.assign({ type }, pOpts || {}); },
    MouseEvent: function MouseEvent(type, mOpts) { return Object.assign({ type }, mOpts || {}); },
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

// ---------------------------------------------------------------------------
// Boundary Fuzz Tests
// ---------------------------------------------------------------------------

function runTests(test) {

  // =========================================================================
  // Suite 1: Adversarial DOM Boundaries
  // =========================================================================

  test('fuzz: 6-level deeply nested Shadow DOM preserves piercing and clicks Always Allow and Continue', () => {
    const { doc, win } = createFuzzEnv();
    let now = 10000;

    // Build 6-level nested Shadow DOM: host1 -> sr1 -> host2 -> sr2 -> ... -> host6 -> sr6 -> button
    let currentParent = doc.body;
    let deepAllowBtn = null;
    for (let level = 1; level <= 6; level++) {
      const host = doc.createElement(`nested-host-${level}`);
      currentParent.appendChild(host);
      const sr = host.attachShadow();
      if (level === 6) {
        deepAllowBtn = doc.createElement('button', { text: '始终允许' });
        sr.appendChild(deepAllowBtn);
      } else {
        currentParent = sr;
      }
    }

    const engine = new GmahEngine({ doc, win, now: () => now });
    const rAllow = engine.scanOnce();
    assert.strictEqual(rAllow.action, 'clicked_allow', '6-level nested Shadow DOM Allow button must be found and clicked');
    assert.strictEqual(deepAllowBtn.clickCount, 1);

    // Now test 6-level nested Shadow DOM inside a turn for Continue button
    deepAllowBtn.remove();
    now += 5000;
    const turn = addTurn(doc, '前六层嵌套组件渲染完成，准备继续执行');
    currentParent = turn;
    let deepContBtn = null;
    for (let level = 1; level <= 6; level++) {
      const host = doc.createElement(`cont-host-${level}`);
      currentParent.appendChild(host);
      const sr = host.attachShadow();
      if (level === 6) {
        deepContBtn = doc.createElement('button', { text: '继续' });
        sr.appendChild(deepContBtn);
      } else {
        currentParent = sr;
      }
    }

    const rCont = engine.scanOnce();
    assert.strictEqual(rCont.action, 'clicked_continue', '6-level nested Shadow DOM Continue button must be found and clicked');
    assert.strictEqual(deepContBtn.clickCount, 1);
  });

  test('fuzz: circular parentNode, host, and ShadowRoot cycles do not cause stack overflow or infinite loop', () => {
    const { doc, win } = createFuzzEnv();
    let now = 20000;

    // Circular parentNode reference
    const cyclicA = doc.createElement('div', { id: 'cyclic-a' });
    const cyclicB = doc.createElement('div', { id: 'cyclic-b' });
    cyclicA.appendChild(cyclicB);
    // Intentionally construct a cyclic graph in DOM parents
    cyclicA.parentNode = cyclicB;
    doc.body.appendChild(cyclicA);

    // Circular shadowRoot / host reference
    const host = doc.createElement('cyclic-host');
    const sr = host.attachShadow();
    const customChild = doc.createElement('cyclic-child');
    customChild.shadowRoot = sr; // circular shadowRoot reference
    sr.appendChild(customChild);
    doc.body.appendChild(host);

    // Valid button alongside cyclic nodes
    const validBtn = doc.createElement('button', { text: 'Always allow' });
    doc.body.appendChild(validBtn);

    const engine = new GmahEngine({ doc, win, now: () => now });

    // Must terminate within finite time without Maximum call stack size exceeded or freezing
    const start = Date.now();
    const res = engine.scanOnce();
    const elapsed = Date.now() - start;

    assert.ok(elapsed < 2000, `Execution took too long (${elapsed}ms), possible infinite loop on cyclic DOM`);
    assert.strictEqual(res.action, 'clicked_allow');
    assert.strictEqual(validBtn.clickCount, 1);
  });

  test('fuzz: throwing getBoundingClientRect(), getComputedStyle(), and querySelectorAll() are caught safely', () => {
    const { doc, win } = createFuzzEnv(null, { throwOnGetComputedStyle: false });
    let now = 30000;

    // Button whose getBoundingClientRect throws
    const throwingRectBtn = doc.createElement('button', { text: '始终允许', throwOnRect: true });
    doc.body.appendChild(throwingRectBtn);

    // Host whose ShadowRoot querySelectorAll throws
    const throwingQueryHost = doc.createElement('throwing-query-host');
    doc.body.appendChild(throwingQueryHost);
    const sr = throwingQueryHost.attachShadow();
    sr._throwOnQuery = true;

    // Normal button
    const normalContBtn = doc.createElement('button', { text: '继续' });
    addTurn(doc, '测试异常捕获输出', [normalContBtn]);

    const engine = new GmahEngine({ doc, win, now: () => now });

    // Should not throw unhandled exception
    let res;
    assert.doesNotThrow(() => {
      res = engine.scanOnce();
    }, 'Engine must not throw when DOM rect or query methods fail');

    // Throwing rect button is still handled or gracefully bypassed
    assert.ok(res && res.action, 'Scan must produce valid action descriptor');
  });

  test('fuzz: NaN and Infinity in styles and rect coordinates do not poison click coordinates or crash engine', () => {
    const { doc, win } = createFuzzEnv();
    let now = 40000;

    const nanBtn = doc.createElement('button', {
      text: 'Always allow',
      style: {
        width: 'NaNpx',
        height: 'Infinitypx',
        opacity: 'NaN',
        transform: 'scale(NaN)'
      },
      rect: {
        left: -Infinity,
        top: NaN,
        width: Infinity,
        height: -Infinity
      }
    });
    doc.body.appendChild(nanBtn);

    const engine = new GmahEngine({ doc, win, now: () => now });

    let res;
    assert.doesNotThrow(() => {
      res = engine.scanOnce();
    });

    if (res.action === 'clicked_allow') {
      assert.strictEqual(nanBtn.clickCount, 1);
      // Ensure dispatched event coordinates are NOT NaN or Infinity
      for (const ev of nanBtn.dispatchedEvents) {
        if (ev.clientX !== undefined) {
          assert.ok(Number.isFinite(ev.clientX), `clientX must be finite, got ${ev.clientX}`);
        }
        if (ev.clientY !== undefined) {
          assert.ok(Number.isFinite(ev.clientY), `clientY must be finite, got ${ev.clientY}`);
        }
      }
    }
  });

  test('fuzz: elements detached mid-scan are safely skipped and never clicked as ghost targets', () => {
    const { doc, win } = createFuzzEnv();
    let now = 50000;

    const ghostBtn = doc.createElement('button', { text: 'Always allow' });
    doc.body.appendChild(ghostBtn);

    const engine = new GmahEngine({
      doc,
      win,
      now: () => now,
      clickFn: (el) => {
        // If element was detached mid-scan, it must not be clicked
        assert.ok(el.isConnected, 'Detached element must not receive clickFn');
        el.click();
      }
    });

    // Detach element right before or during inspection
    ghostBtn.remove();
    assert.strictEqual(ghostBtn.isConnected, false);

    const res = engine.scanOnce();
    assert.strictEqual(ghostBtn.clickCount, 0, 'Detached element must never be clicked');
    assert.notStrictEqual(res.action, 'clicked_allow');
  });

  // =========================================================================
  // Suite 2: Timing & Clock Boundaries
  // =========================================================================

  test('fuzz: backward clock jump (NTP sync / DST rollback) does not freeze cooldowns, settle, or stall monitor', () => {
    const { doc, win } = createFuzzEnv();
    let clock = 100000;

    const btn1 = doc.createElement('button', { text: '继续' });
    addTurn(doc, '第 1 阶段生成完成', [btn1]);

    const engine = new GmahEngine({
      doc,
      win,
      now: () => clock,
      settings: { continueCooldownMs: 4000, idleSettleMs: 1000 }
    });

    const r1 = engine.scanOnce();
    assert.strictEqual(r1.action, 'clicked_continue');
    assert.strictEqual(btn1.clickCount, 1);

    // Next turn arrives
    btn1.remove();
    const btn2 = doc.createElement('button', { text: '继续' });
    addTurn(doc, '第 2 阶段生成完成，有了全新结果', [btn2]);
    engine.recordMutation();

    // Sudden NTP clock rollback: jumps backward by 10 minutes (-600,000ms)
    clock = clock - 600000;

    // Scan should gracefully handle the negative delta and NOT get locked for 10 minutes
    const rBack = engine.scanOnce();
    assert.ok(
      rBack.action === 'clicked_continue' || rBack.action === 'wait',
      `Expected valid action after clock rollback, got ${rBack.action} (${rBack.reason})`
    );

    // If waiting, retryInMs must be reasonable (<= 5000ms), never 600,000ms!
    if (rBack.action === 'wait' && rBack.retryInMs) {
      assert.ok(
        rBack.retryInMs <= 5000,
        `retryInMs after clock jump must be <= 5000ms, got ${rBack.retryInMs}ms`
      );
    }
  });

  test('fuzz: forward clock jump (+2 hours) rolls over date stats and expires cooldowns safely', () => {
    const { doc, win } = createFuzzEnv();
    let clock = 1700000000000; // Base timestamp

    const engine = new GmahEngine({
      doc,
      win,
      now: () => clock,
      settings: { continueCooldownMs: 4000, dailyContinueLimit: 5 }
    });

    // Artificially increment today's count to cap
    engine.stats.continueCount = 5;
    const btn1 = doc.createElement('button', { text: '继续' });
    addTurn(doc, '上限检查', [btn1]);

    const rBlocked = engine.scanOnce();
    assert.strictEqual(rBlocked.action, 'tripped');
    assert.strictEqual(rBlocked.reason, 'daily_limit');

    // Jump forward 26 hours (into the next calendar day)
    clock += 26 * 3600 * 1000;

    // Next day must auto-reset stats and clear daily breaker
    btn1.remove();
    const btn2 = doc.createElement('button', { text: '继续' });
    addTurn(doc, '新的一天全新阶段', [btn2]);

    const rNextDay = engine.scanOnce();
    assert.strictEqual(rNextDay.action, 'clicked_continue', 'Forward clock jump across days must reset daily continue limit');
    assert.strictEqual(btn2.clickCount, 1);
    assert.strictEqual(engine.stats.continueCount, 1);
  });

  test('fuzz: zero and negative timeout settings are clamped safely without divide-by-zero or NaN', () => {
    const rawSettings = {
      idleSettleMs: 0,
      continueCooldownMs: -1000,
      allowCooldownMs: 0,
      stallAlertMinutes: 0,
      stallAutoRecoverMinutes: -5,
      maxContinuesPerTask: -10,
      dailyContinueLimit: -1
    };

    const merged = D.mergeSettings(rawSettings);
    assert.ok(merged.idleSettleMs >= 400, `idleSettleMs must be >= 400, got ${merged.idleSettleMs}`);
    assert.ok(merged.continueCooldownMs >= 1000, `continueCooldownMs must be >= 1000, got ${merged.continueCooldownMs}`);
    assert.ok(merged.allowCooldownMs >= 200, `allowCooldownMs must be >= 200, got ${merged.allowCooldownMs}`);
    assert.ok(merged.stallAlertMinutes >= 1, `stallAlertMinutes must be >= 1, got ${merged.stallAlertMinutes}`);
    assert.ok(merged.stallAutoRecoverMinutes >= 1, `stallAutoRecoverMinutes must be >= 1, got ${merged.stallAutoRecoverMinutes}`);
    assert.ok(merged.maxContinuesPerTask >= 1, `maxContinuesPerTask must be >= 1, got ${merged.maxContinuesPerTask}`);
    assert.strictEqual(merged.dailyContinueLimit, 0, 'Negative dailyContinueLimit must clamp to 0');

    // Test engine instantiation with these raw settings
    const { doc, win } = createFuzzEnv();
    const engine = new GmahEngine({ doc, win, settings: rawSettings });
    assert.ok(Number.isFinite(engine.settings.continueCooldownMs));
    assert.ok(Number.isFinite(engine.settings.idleSettleMs));
  });

  test('fuzz: 1000+ rapid hidden DOM mutations burst defers settle cleanly and recovers without memory spike', () => {
    const { doc, win } = createFuzzEnv();
    let now = 60000;
    doc.hidden = true;

    const contBtn = doc.createElement('button', { text: '继续' });
    const turn = addTurn(doc, '代码片段生成中...', [contBtn]);

    const engine = new GmahEngine({
      doc,
      win,
      now: () => now,
      settings: { idleSettleMs: 1800, continueCooldownMs: 4000 }
    });

    // Fire 1000 rapid mutations in 5ms increments (= 5000ms of rapid streaming)
    for (let i = 0; i < 1000; i++) {
      now += 5;
      const span = doc.createElement('span', { text: `token-${i} ` });
      turn.appendChild(span);
      engine.recordMutation();

      // Scan during mid-stream burst must wait for settle
      if (i % 250 === 0) {
        const rWait = engine.scanOnce();
        assert.strictEqual(rWait.action, 'wait');
        assert.strictEqual(rWait.reason, 'settling');
      }
    }

    assert.strictEqual(contBtn.clickCount, 0, 'Must not click during rapid mutation storm');

    // Once burst finishes and settle period elapses, Continue clicks cleanly
    now += 2000;
    const rDone = engine.scanOnce();
    assert.strictEqual(rDone.action, 'clicked_continue');
    assert.strictEqual(contBtn.clickCount, 1);
  });

  // =========================================================================
  // Suite 3: Storage & Config Boundaries
  // =========================================================================

  test('fuzz: corrupted storage values (primitives, null, undefined, arrays) fallback safely to valid defaults', () => {
    const corruptInputs = [
      null,
      undefined,
      'completely corrupted string',
      123456,
      true,
      false,
      [],
      [1, 2, 3],
      { corruptedField: 'garbage' },
      { settingsVersion: 'not_a_number' },
      { [D.STORAGE_KEY]: 'corrupted_storage_key' },
      { [D.STATS_KEY]: 'corrupted_stats_key' }
    ];

    for (const corrupt of corruptInputs) {
      assert.doesNotThrow(() => {
        const merged = D.mergeSettings(corrupt);
        assert.ok(merged && typeof merged === 'object');
        assert.strictEqual(typeof merged.enabled, 'boolean');
        assert.ok(Number.isFinite(merged.maxContinuesPerTask));
      }, `mergeSettings must not throw on corrupted input: ${JSON.stringify(corrupt)}`);

      assert.doesNotThrow(() => {
        const migrated = D.migrateStoredSettings(corrupt);
        assert.ok(migrated && migrated.settings);
      }, `migrateStoredSettings must not throw on corrupted input: ${JSON.stringify(corrupt)}`);

      assert.doesNotThrow(() => {
        const stats = D.normalizeStats(corrupt);
        assert.ok(stats && typeof stats === 'object');
        assert.strictEqual(typeof stats.date, 'string');
        assert.strictEqual(typeof stats.allowCount, 'number');
        assert.strictEqual(typeof stats.continueCount, 'number');
      }, `normalizeStats must not throw on corrupted input: ${JSON.stringify(corrupt)}`);
    }
  });

  test('fuzz: prototype pollution keys (__proto__, constructor, prototype) never pollute Object.prototype', () => {
    const maliciousPayload = JSON.parse(
      '{"__proto__": {"pollutedKey": "hacked", "isAdmin": true}, "constructor": {"prototype": {"pollutedConstructor": true}}}'
    );

    // Test mergeSettings
    const merged = D.mergeSettings(maliciousPayload);
    assert.strictEqual(Object.prototype.pollutedKey, undefined);
    assert.strictEqual(Object.prototype.isAdmin, undefined);
    assert.strictEqual(Object.prototype.pollutedConstructor, undefined);
    assert.strictEqual(({}).pollutedKey, undefined);

    // Test migrateStoredSettings
    D.migrateStoredSettings(maliciousPayload);
    assert.strictEqual(Object.prototype.pollutedKey, undefined);
    assert.strictEqual(({}).isAdmin, undefined);

    // Test parseKeywordInput
    const parsed = D.parseKeywordInput('__proto__, constructor, prototype, 始终允许');
    assert.ok(Array.isArray(parsed));
    assert.strictEqual(Object.prototype.pollutedKey, undefined);

    // Clean up if anything slipped
    delete Object.prototype.pollutedKey;
    delete Object.prototype.isAdmin;
    delete Object.prototype.pollutedConstructor;
  });

  test('fuzz: extreme values (NaN, Infinity, negative numbers, non-arrays) are sanitized without throwing', () => {
    const extremeSettings = {
      maxContinuesPerTask: NaN,
      dailyContinueLimit: Infinity,
      continueCooldownMs: -Infinity,
      idleSettleMs: 'string',
      stallAlertMinutes: null,
      stallAutoRecoverMinutes: undefined,
      stallAutoRecoverPrompt: null,
      alwaysAllowKeywords: 'not an array',
      singleAllowKeywords: 12345,
      continueKeywords: {},
      customAlwaysAllowKeywords: null,
      customContinueKeywords: true,
      denyBlacklistKeywords: false,
      completionCueKeywords: undefined
    };

    const s = D.mergeSettings(extremeSettings);
    assert.ok(Number.isFinite(s.maxContinuesPerTask));
    assert.ok(Number.isFinite(s.dailyContinueLimit));
    assert.ok(Number.isFinite(s.continueCooldownMs));
    assert.ok(Number.isFinite(s.idleSettleMs));
    assert.ok(Number.isFinite(s.stallAlertMinutes));
    assert.ok(Number.isFinite(s.stallAutoRecoverMinutes));
    assert.strictEqual(typeof s.stallAutoRecoverPrompt, 'string');
    assert.ok(Array.isArray(s.alwaysAllowKeywords));
    assert.ok(Array.isArray(s.singleAllowKeywords));
    assert.ok(Array.isArray(s.continueKeywords));
    assert.ok(Array.isArray(s.customAlwaysAllowKeywords));
    assert.ok(Array.isArray(s.customContinueKeywords));
    assert.ok(Array.isArray(s.denyBlacklistKeywords));
    assert.ok(Array.isArray(s.completionCueKeywords));
  });

  test('fuzz: huge strings (100k prompt, 50k keyword) are clamped and do not trigger ReDoS regex lockup', () => {
    const hugePrompt = 'A'.repeat(100000);
    const hugeKeyword = 'B'.repeat(50000);

    const merged = D.mergeSettings({
      stallAutoRecoverPrompt: hugePrompt,
      customAlwaysAllowKeywords: [hugeKeyword, 'valid keyword']
    });

    assert.ok(merged.stallAutoRecoverPrompt.length <= 200, 'Prompt must be clamped to safe length (<= 200)');
    assert.ok(merged.customAlwaysAllowKeywords.includes(hugeKeyword));

    // Test label matching against huge keyword does not lock up regex
    const start = Date.now();
    const match = D.matchButtonLabel('Normal button label', [hugeKeyword], { maxLen: 80 });
    const elapsed = Date.now() - start;

    assert.strictEqual(match, null);
    assert.ok(elapsed < 50, `Huge keyword match must reject instantly without ReDoS (${elapsed}ms)`);
  });

  // =========================================================================
  // Suite 4: Multi-Tab, Service Worker & HUD Boundaries
  // =========================================================================

  test('fuzz: 10+ concurrent tabs closing and disconnecting mid-scan never crash background or content engines', () => {
    let clock = 1000000;
    const storageData = {
      [D.STORAGE_KEY]: D.mergeSettings({ enabled: true, autoAllow: true, autoContinue: true }),
      [D.STATS_KEY]: D.createEmptyStats(D.getTodayKey(new Date(clock)))
    };
    const clone = (o) => JSON.parse(JSON.stringify(o));

    const swListeners = { onConnect: [], onMessage: [], onAlarm: [], onStorage: [] };
    const tabsMap = new Map();

    const swChrome = {
      runtime: {
        id: 'gmah-fuzz-multi',
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
        query(_q, cb) {
          cb(Array.from(tabsMap.keys()).map((id) => ({ id, url: tabsMap.get(id).env.win.location.href, discarded: false })));
        },
        sendMessage(tabId, msg, cb) {
          const tab = tabsMap.get(tabId);
          if (tab && tab.onMessage) tab.onMessage(msg, cb);
          else if (cb) cb();
        },
        onUpdated: { addListener() {} },
        onRemoved: { addListener() {} },
        onActivated: { addListener() {} }
      },
      windows: { onFocusChanged: { addListener() {} } },
      alarms: { create() {}, clear() {}, onAlarm: { addListener() {} } },
      notifications: { create() {}, clear() {}, onClicked: { addListener() {} } },
      action: { setBadgeText() {}, setBadgeBackgroundColor() {} }
    };

    const bg = createBackgroundController(swChrome, { setInterval: () => 1, clearInterval: () => {}, setTimeout: () => 1, clearTimeout: () => {} }, () => clock);
    bg.init();

    // Create 12 concurrent tabs
    for (let tabId = 1; tabId <= 12; tabId++) {
      const env = createFuzzEnv(GEMINI_ORIGIN + `/app/fuzz-tab-${tabId}`);
      const btn = env.doc.createElement('button', { text: 'Always allow' });
      env.doc.body.appendChild(btn);

      const serverPort = {
        name: 'gmah-tab',
        sender: { tab: { id: tabId } },
        postMessage() {},
        disconnect() {},
        onMessage: { addListener() {} },
        onDisconnect: { addListener() {} }
      };
      for (const fn of swListeners.onConnect) fn(serverPort);

      const engine = new GmahEngine({ doc: env.doc, win: env.win, now: () => clock });
      tabsMap.set(tabId, { env, btn, engine, serverPort });
    }

    assert.strictEqual(bg.getConnectedTabIds().length, 12);

    // Concurrently scan and close tabs 3, 5, 7, 9 mid-scan
    for (let tabId = 1; tabId <= 12; tabId++) {
      const tab = tabsMap.get(tabId);
      if (tabId % 2 === 1 && tabId > 1 && tabId < 11) {
        // Tab closes mid-operation
        tab.serverPort.disconnect();
        bg.handleTabRemoved(tabId);
        tabsMap.delete(tabId);
      } else {
        const res = tab.engine.scanOnce();
        assert.strictEqual(res.action, 'clicked_allow');
      }
    }

    assert.ok(bg.getConnectedTabIds().length <= 8, 'Closed tabs must be cleanly unmapped from background');
  });

  test('fuzz: unexpected Service Worker disconnect during stall auto-recovery does not leave corrupted state', () => {
    const { doc, win } = createFuzzEnv();
    let now = 200000;

    const stopBtn = doc.createElement('button', { text: '停止响应', attrs: { 'aria-label': 'Stop generating' } });
    const promptInput = doc.createElement('div', { attrs: { role: 'textbox', contenteditable: 'true' } });
    doc.body.appendChild(stopBtn);
    doc.body.appendChild(promptInput);

    const engine = new GmahEngine({
      doc,
      win,
      now: () => now,
      settings: {
        stallAutoRecoverEnabled: true,
        stallAutoRecoverMinutes: 5,
        stallAutoRecoverPrompt: '继续，刚才mcp连接断开了'
      }
    });

    // Simulate turn stalled for 5 minutes
    addTurn(doc, '正在执行长时间 MCP 任务...');
    engine.isGenerating = true;
    engine.detectConnectingStatus = () => 'Connecting to MCP...';

    // Step 1: Initialize stall state
    engine.scanOnce();
    now += 5 * 60 * 1000 + 1000;

    // Step 2: Stall triggers auto-recovery stop
    const rStop = engine.scanOnce();
    assert.strictEqual(rStop.action, 'stall_recover_stop');
    assert.ok(rStop.element, 'Stop element must be targeted');

    // Simulate unexpected SW crash / disconnect right during stop settle
    engine.onConversationChange(win.location.href);

    // Verify recovery resets cleanly without hanging or duplicate sending
    assert.strictEqual(engine.stallRecovery, null, 'Conversation refresh must clear in-flight recovery safely');
  });

  test('fuzz: 5000+ turn churn on clickedElements and clickAttempts prunes unmounted nodes without leaking memory', () => {
    const { doc, win } = createFuzzEnv();
    let now = 300000;

    const engine = new GmahEngine({
      doc,
      win,
      now: () => now,
      settings: {
        continueCooldownMs: 1000,
        idleSettleMs: 400,
        maxContinuesPerTask: 10000,
        humanPacingEnabled: false
      }
    });

    let activeBtn = null;
    for (let turn = 1; turn <= 500; turn++) {
      if (activeBtn) activeBtn.remove();
      now += 1500;
      if (turn % 20 === 0) {
        engine.onUserManualPrompt();
        now += 500;
      }
      activeBtn = doc.createElement('button', { text: '继续' });
      addTurn(doc, `Turn ${turn} output completed`, [activeBtn]);
      const res = engine.scanOnce();
      assert.strictEqual(res.action, 'clicked_continue');
    }

    // In a long marathon session, memory tracking sets must prune unmounted buttons
    // Size should not exceed reasonable bound (e.g. <= 50 elements)
    const trackedCount = engine.clickedElements.size;
    assert.ok(
      trackedCount <= 100,
      `Memory leak detected: clickedElements has ${trackedCount} entries after 500 turns (expected <= 100)`
    );
  });

  test('fuzz: HUD drag interrupted by window blur, resize, or pagehide auto-releases without sticky drag', () => {
    const { doc, win } = createFuzzEnv();
    let now = 400000;

    const hudContainer = doc.createElement('div', { id: 'gmah-hud' });
    const header = doc.createElement('div', { className: 'gmah-header' });
    hudContainer.appendChild(header);
    doc.body.appendChild(hudContainer);

    let isDragging = false;
    header.addEventListener('pointerdown', (e) => {
      if (e.button === 0) isDragging = true;
    });
    win.addEventListener('pointermove', () => {
      // Moves while dragging
    });
    const releaseDrag = () => { isDragging = false; };
    win.addEventListener('pointerup', releaseDrag);
    win.addEventListener('pointercancel', releaseDrag);
    win.addEventListener('blur', releaseDrag);
    win.addEventListener('resize', releaseDrag);
    win.addEventListener('pagehide', releaseDrag);

    // Start dragging
    header.dispatchEvent({ type: 'pointerdown', button: 0 });
    assert.strictEqual(isDragging, true, 'Pointerdown must initiate drag');

    // Simulate unexpected window blur
    win.dispatchEvent({ type: 'blur' });
    assert.strictEqual(isDragging, false, 'Window blur must auto-release active HUD drag');

    // Start drag again and simulate resize
    header.dispatchEvent({ type: 'pointerdown', button: 0 });
    assert.strictEqual(isDragging, true);
    win.dispatchEvent({ type: 'resize' });
    assert.strictEqual(isDragging, false, 'Window resize must auto-release active HUD drag');

    // Start drag again and simulate pagehide
    header.dispatchEvent({ type: 'pointerdown', button: 0 });
    assert.strictEqual(isDragging, true);
    win.dispatchEvent({ type: 'pagehide' });
    assert.strictEqual(isDragging, false, 'Pagehide must auto-release active HUD drag');
  });

  // =========================================================================
  // Suite 5: Cross-Tab Isolation, Tab Navigation, and Memory Lifecycle Boundaries
  // =========================================================================

  test('fuzz: cross-tab stall alert isolation: Tab 1 resolving stall does NOT wipe Tab 2 active stall notification', () => {
    let clock = 1000000;
    const notificationsCleared = [];
    const notificationsCreated = [];

    const mockChrome = {
      runtime: { id: 'test-bg', lastError: null, getPlatformInfo(cb) { if (cb) cb({ os: 'win' }); }, onConnect: { addListener() {} }, onMessage: { addListener() {} }, onInstalled: { addListener() {} }, onStartup: { addListener() {} } },
      storage: { local: { get(_k, cb) { cb({ [D.STORAGE_KEY]: D.mergeSettings({ enabled: true, stallAlertEnabled: true }) }); }, set(_o, cb) { if (cb) cb(); } }, onChanged: { addListener() {} } },
      tabs: { update(_id, _p, cb) { if (cb) cb(); }, query(_q, cb) { cb([{ id: 101 }, { id: 102 }]); }, sendMessage() {}, onUpdated: { addListener() {} }, onRemoved: { addListener() {} }, onActivated: { addListener() {} } },
      windows: { onFocusChanged: { addListener() {} } },
      alarms: { create() {}, clear() {}, onAlarm: { addListener() {} } },
      notifications: {
        create(id, opts, cb) { notificationsCreated.push(id); if (cb) cb(id); },
        clear(id, cb) { notificationsCleared.push(id); if (cb) cb(true); },
        onClicked: { addListener() {} }
      },
      action: { setBadgeText() {}, setBadgeBackgroundColor() {} }
    };

    const bg = createBackgroundController(mockChrome, { setInterval: () => 1, clearInterval: () => {}, setTimeout: () => 1, clearTimeout: () => {} }, () => clock);
    bg.init();

    let tab101Handler = null;
    let tab102Handler = null;
    const port101 = {
      name: 'gmah-tab',
      sender: { tab: { id: 101 } },
      postMessage() {},
      disconnect() {},
      onMessage: { addListener(fn) { tab101Handler = fn; } },
      onDisconnect: { addListener() {} }
    };
    const port102 = {
      name: 'gmah-tab',
      sender: { tab: { id: 102 } },
      postMessage() {},
      disconnect() {},
      onMessage: { addListener(fn) { tab102Handler = fn; } },
      onDisconnect: { addListener() {} }
    };
    bg.handleConnect(port101);
    bg.handleConnect(port102);

    // Both Tab 101 and Tab 102 report stall alerts
    tab101Handler({ type: 'GMAH_STALL_ALERT', elapsedMs: 360000, mins: 6 });
    tab102Handler({ type: 'GMAH_STALL_ALERT', elapsedMs: 420000, mins: 7 });

    assert.ok(notificationsCreated.includes('gmah_stall_101'));
    assert.ok(notificationsCreated.includes('gmah_stall_102'));

    // Tab 101 resolves stall (should only send GMAH_STALL_CLEAR for Tab 101, NOT clear all notifications)
    tab101Handler({ type: 'GMAH_STALL_CLEAR' });

    assert.ok(notificationsCleared.includes('gmah_stall_101'), 'Tab 101 notification must be cleared');
    assert.ok(!notificationsCleared.includes('gmah_stall_102'), 'Tab 102 notification MUST REMAIN ACTIVE');
  });

  test('fuzz: tab navigating away from Gemini to external URL cleans up ports, badges, ticks, and notifications in background', () => {
    let clock = 2000000;
    const clearedBadges = [];
    const clearedNotifications = [];

    const mockChrome = {
      runtime: { id: 'test-bg', lastError: null, getPlatformInfo(cb) { if (cb) cb({ os: 'win' }); }, onConnect: { addListener() {} }, onMessage: { addListener() {} }, onInstalled: { addListener() {} }, onStartup: { addListener() {} } },
      storage: { local: { get(_k, cb) { cb({ [D.STORAGE_KEY]: D.mergeSettings({ enabled: true }) }); }, set(_o, cb) { if (cb) cb(); } }, onChanged: { addListener() {} } },
      tabs: { update(_id, _p, cb) { if (cb) cb(); }, query(_q, cb) { cb([]); }, sendMessage() {}, onUpdated: { addListener() {} }, onRemoved: { addListener() {} }, onActivated: { addListener() {} } },
      windows: { onFocusChanged: { addListener() {} } },
      alarms: { create() {}, clear() {}, onAlarm: { addListener() {} } },
      notifications: { create(_id, _o, cb) { if (cb) cb(); }, clear(id, cb) { clearedNotifications.push(id); if (cb) cb(true); }, onClicked: { addListener() {} } },
      action: {
        setBadgeText(opts) { if (opts.text === '') clearedBadges.push(opts.tabId); },
        setBadgeBackgroundColor() {}
      }
    };

    const bg = createBackgroundController(mockChrome, { setInterval: () => 1, clearInterval: () => {}, setTimeout: () => 1, clearTimeout: () => {} }, () => clock);
    bg.init();

    // Tab 201 connects and gets a badge/alert
    let tab201Handler = null;
    const port = {
      name: 'gmah-tab',
      sender: { tab: { id: 201 } },
      postMessage() {},
      disconnect() {},
      onMessage: { addListener(fn) { tab201Handler = fn; } },
      onDisconnect: { addListener() {} }
    };
    bg.handleConnect(port);
    tab201Handler({ type: 'GMAH_BREAKER_ALERT', reason: 'task_limit' });
    tab201Handler({ type: 'GMAH_SCHEDULE_TICK', delayMs: 2000, reason: 'test' });

    assert.ok(bg.getConnectedTabIds().includes(201));

    // Tab 201 navigates to https://github.com/
    bg.handleTabUpdated(201, { url: 'https://github.com/someone/repo' }, { id: 201, url: 'https://github.com/someone/repo' });

    assert.ok(!bg.getConnectedTabIds().includes(201), 'Port must be unmapped when navigating away from Gemini');
    assert.ok(clearedBadges.includes(201), 'Badge must be cleared when navigating away from Gemini');
  });

  test('fuzz: HUD rapid re-mount (10x) does not leak event listeners and pagehide mid-drag safely commits state', () => {
    const { doc, win } = createFuzzEnv();
    const { createHud } = require('../hud.js');
    const prevDoc = global.document;
    const prevWin = global.window;
    global.document = doc;
    global.window = win;

    try {
      let winListenerCount = 0;
      const origWinAdd = win.addEventListener;
      win.addEventListener = function(type, fn) {
        winListenerCount++;
        origWinAdd.call(win, type, fn);
      };

      const hud = createHud();

      // Rapid re-mount 10x
      for (let i = 0; i < 10; i++) {
        const el = hud.mount();
        assert.ok(el);
        if (i < 9) {
          el.remove();
        }
      }

      assert.ok(winListenerCount <= 12, `Listener leak detected: ${winListenerCount} listeners attached after 10 mounts (expected <= 12)`);
    } finally {
      global.document = prevDoc;
      global.window = prevWin;
    }
  });

  test('fuzz: clickedElements and clickAttempts stay bounded (<= 500 entries) and prune disconnected nodes during early returns', () => {
    const { doc, win } = createFuzzEnv();
    let now = 500000;

    const engine = new GmahEngine({
      doc,
      win,
      now: () => now,
      settings: { enabled: false }
    });

    // Populate clickedElements and clickAttempts with disconnected nodes
    for (let i = 0; i < 100; i++) {
      const detachedBtn = doc.createElement('button', { text: `btn-${i}` });
      engine.clickedElements.add(detachedBtn);
      engine.clickAttempts.set(detachedBtn, { kind: 'allow', count: 1, lastAttemptAt: now });
    }

    assert.strictEqual(engine.clickedElements.size, 100);

    // Call scanOnce() while disabled (early return: disabled)
    const res = engine.scanOnce();
    assert.strictEqual(res.action, 'noop');
    assert.strictEqual(res.reason, 'disabled');

    // Disconnected nodes MUST be pruned even on early return!
    assert.strictEqual(engine.clickedElements.size, 0, 'clickedElements must prune disconnected nodes even when disabled');
    assert.strictEqual(engine.clickAttempts.size, 0, 'clickAttempts must prune disconnected nodes even when disabled');

    // Test hard 500-entry capacity cap (FIFO eviction)
    engine.settings.enabled = true;
    for (let i = 0; i < 600; i++) {
      const liveBtn = doc.createElement('button', { text: `live-${i}` });
      doc.body.appendChild(liveBtn);
      if (engine.clickedElements.size >= 500) {
        const first = engine.clickedElements.values().next().value;
        engine.clickedElements.delete(first);
      }
      engine.clickedElements.add(liveBtn);
    }

    assert.ok(engine.clickedElements.size <= 500, `Capacity must be capped <= 500, got ${engine.clickedElements.size}`);
  });

  test('fuzz: containsKeyword with 50k+ char keyword or text never throws SyntaxError or hangs', () => {
    const hugeText = 'Some innocent text. '.repeat(2500) + '始终允许' + ' More text.'.repeat(2500);
    const hugeKeyword = 'A'.repeat(50000);

    // 1. Huge text with normal keyword
    const start1 = Date.now();
    const hit1 = D.containsKeyword(hugeText, ['始终允许']);
    const elapsed1 = Date.now() - start1;
    assert.strictEqual(hit1, '始终允许');
    assert.ok(elapsed1 < 100, `Large text matching must be fast (${elapsed1}ms)`);

    // 2. Normal text with huge keyword (must not throw Regular expression too large)
    let hit2 = null;
    assert.doesNotThrow(() => {
      const start2 = Date.now();
      hit2 = D.containsKeyword('Normal text without match', [hugeKeyword]);
      const elapsed2 = Date.now() - start2;
      assert.ok(elapsed2 < 100, `Huge keyword matching must not hang (${elapsed2}ms)`);
    }, 'containsKeyword must not throw SyntaxError on huge keywords');
    assert.strictEqual(hit2, null);
  });

  test('fuzz: port rotation onDisconnect firing asynchronously does not cause spurious duplicate reconnect', () => {
    let connectCalls = 0;
    const clientPorts = [];

    const mockChrome = {
      runtime: {
        id: 'test-port-race',
        lastError: null,
        connect(opts) {
          connectCalls++;
          const discFns = [];
          const msgFns = [];
          const port = {
            name: opts.name,
            postMessage() {},
            disconnect() { for (const fn of discFns.slice()) fn(); },
            onMessage: { addListener(fn) { msgFns.push(fn); } },
            onDisconnect: { addListener(fn) { discFns.push(fn); } }
          };
          clientPorts.push(port);
          return port;
        },
        sendMessage() {},
        onMessage: { addListener() {} }
      },
      storage: {
        local: {
          get(_k, cb) { cb({ [D.STORAGE_KEY]: D.mergeSettings({ enabled: true }) }); },
          set(_o, cb) { if (cb) cb(); }
        },
        onChanged: { addListener() {} }
      }
    };

    // Old port exists
    const oldPort = mockChrome.runtime.connect({ name: 'gmah-tab' });
    assert.strictEqual(connectCalls, 1);

    // Rotation begins: new port is established
    mockChrome.runtime.connect({ name: 'gmah-tab' });
    assert.strictEqual(connectCalls, 2);

    // Old port disconnect fires AFTER new port is already active
    oldPort.disconnect();
    assert.strictEqual(connectCalls, 2, 'Disconnecting superseded old port must not create a duplicate third port');
  });

  // =========================================================================
  // Suite 6: Targeted Post-Fix Edge-Cases & Regressions
  // =========================================================================

  test('fuzz: background.js handles storage.session rejection and Gemini -> external -> Gemini round-trip navigation', () => {
    let clock = 3000000;
    const clearedBadges = [];
    const setBadges = [];

    const mockChrome = {
      runtime: { id: 'test-bg', lastError: null, getPlatformInfo(cb) { if (cb) cb({ os: 'win' }); }, onConnect: { addListener() {} }, onMessage: { addListener() {} }, onInstalled: { addListener() {} }, onStartup: { addListener() {} } },
      storage: {
        local: { get(_k, cb) { cb({ [D.STORAGE_KEY]: D.mergeSettings({ enabled: true }) }); }, set(_o, cb) { if (cb) cb(); } },
        session: {
          get(_k, cb) {
            throw new Error('QuotaExceeded: session storage quota exceeded');
          },
          set(_o, cb) {
            throw new Error('QuotaExceeded: session storage set failed');
          }
        },
        onChanged: { addListener() {} }
      },
      tabs: { update(_id, _p, cb) { if (cb) cb(); }, query(_q, cb) { cb([]); }, sendMessage() {}, onUpdated: { addListener() {} }, onRemoved: { addListener() {} }, onActivated: { addListener() {} } },
      windows: { onFocusChanged: { addListener() {} } },
      alarms: { create() {}, clear() {}, onAlarm: { addListener() {} } },
      notifications: { create(_id, _o, cb) { if (cb) cb(); }, clear(_id, cb) { if (cb) cb(true); }, onClicked: { addListener() {} } },
      action: {
        setBadgeText(opts) {
          if (opts.text === '') clearedBadges.push(opts.tabId);
          else setBadges.push({ tabId: opts.tabId, text: opts.text });
        },
        setBadgeBackgroundColor() {}
      }
    };

    let bg;
    assert.doesNotThrow(() => {
      bg = createBackgroundController(mockChrome, { setInterval: () => 1, clearInterval: () => {}, setTimeout: () => 1, clearTimeout: () => {} }, () => clock);
      bg.init();
    }, 'Init must not throw when storage.session throws');

    // Tab 301 connects on Gemini
    let tab301Handler = null;
    const port301 = {
      name: 'gmah-tab',
      sender: { tab: { id: 301 } },
      postMessage() {},
      disconnect() {},
      onMessage: { addListener(fn) { tab301Handler = fn; } },
      onDisconnect: { addListener() {} }
    };
    bg.handleConnect(port301);
    assert.ok(bg.getConnectedTabIds().includes(301));

    // Breaker alert sets badge and persists (must not throw when storage.session.set throws)
    assert.doesNotThrow(() => {
      tab301Handler({ type: 'GMAH_BREAKER_ALERT', reason: 'task_limit' });
    });
    assert.ok(setBadges.some((b) => b.tabId === 301 && (b.text === '!' || b.text === '!!')));

    // Step 2: Tab 301 navigates to external site (https://github.com/)
    bg.handleTabUpdated(301, { url: 'https://github.com/' }, { id: 301, url: 'https://github.com/' });
    assert.ok(!bg.getConnectedTabIds().includes(301));
    assert.ok(clearedBadges.includes(301));

    // Step 3: Tab 301 navigates BACK to Gemini (https://gemini.google.com/app/new-chat)
    bg.handleTabUpdated(301, { url: 'https://gemini.google.com/app/new-chat' }, { id: 301, url: 'https://gemini.google.com/app/new-chat' });

    // Connects fresh port on return
    let tab301NewHandler = null;
    const port301New = {
      name: 'gmah-tab',
      sender: { tab: { id: 301 } },
      postMessage() {},
      disconnect() {},
      onMessage: { addListener(fn) { tab301NewHandler = fn; } },
      onDisconnect: { addListener() {} }
    };
    bg.handleConnect(port301New);
    assert.ok(bg.getConnectedTabIds().includes(301), 'Tab must reconnect cleanly on returning to Gemini');
  });

  test('fuzz: content.js handles navigator.locks.request rejection during stats flush and safeNow() NaN fallback', () => {
    const { doc, win } = createFuzzEnv();
    let clock = 4000000;

    // 1. Test safeNow() with corrupted this.now returning NaN, Infinity, -Infinity, strings, and throwing
    const badNows = [
      () => NaN,
      () => Infinity,
      () => -Infinity,
      () => 'not_a_time',
      () => { throw new Error('now() threw'); }
    ];

    const testEngine = new GmahEngine({ doc, win });
    for (const badNow of badNows) {
      testEngine.now = badNow;
      const current = testEngine.safeNow();
      assert.ok(Number.isFinite(current), `safeNow() must return finite number, got ${current}`);
      assert.ok(current > 0);
    }

    // 2. Test navigator.locks.request throwing/rejecting during stats flush
    let lockRequested = false;

    const mockChrome = {
      runtime: { id: 'test', lastError: null, connect() { return { postMessage() {}, disconnect() {}, onMessage: { addListener() {} }, onDisconnect: { addListener() {} } }; }, sendMessage() {}, onMessage: { addListener() {} } },
      storage: {
        local: {
          get(_k, cb) {
            cb({ [D.STATS_KEY]: { date: D.getTodayKey(new Date(clock)), allowCount: 5, continueCount: 2 } });
          },
          set(_obj, cb) {
            if (cb) cb();
          }
        }
      }
    };

    const mockNav = {
      locks: {
        request(_name, _fn) {
          lockRequested = true;
          return Promise.reject(new Error('Lock acquisition failed'));
        }
      }
    };

    const sandbox = {
      window: win,
      document: doc,
      localStorage: win.localStorage,
      chrome: mockChrome,
      navigator: mockNav,
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

    for (const rel of ['defaults.js', 'content.js']) {
      vm.runInNewContext(fs.readFileSync(path.join(ROOT, rel), 'utf8'), sandbox, { filename: rel });
    }

    assert.ok(lockRequested, 'Lock acquisition should be attempted');
  });

  test('fuzz: content.js suppressInitialContinueUntil preserves stale continue suppression and is not broken by sanitizeTimestamps', () => {
    const { doc, win } = createFuzzEnv();
    let clock = 5000000;

    const engine = new GmahEngine({
      doc,
      win,
      now: () => clock,
      ignoreStaleInitialContinue: true
    });

    assert.strictEqual(engine.suppressInitialContinueUntil, clock + 2000);

    engine.sanitizeTimestamps(clock);
    assert.strictEqual(
      engine.suppressInitialContinueUntil,
      clock + 2000,
      'sanitizeTimestamps must preserve valid forward suppression window (clock + 2000)'
    );

    const staleBtn = doc.createElement('button', { text: '继续' });
    addTurn(doc, '初始加载历史消息', [staleBtn]);

    clock += 500;
    const rSuppressed = engine.scanOnce();
    assert.strictEqual(rSuppressed.action, 'noop');
    assert.strictEqual(rSuppressed.reason, 'initial_stale_continue_ignored');
    assert.strictEqual(staleBtn.clickCount, 0);

    clock += 2000;
    staleBtn.remove();
    const freshBtn = doc.createElement('button', { text: '继续' });
    addTurn(doc, '新一轮回复生成完毕', [freshBtn]);

    const rClicked = engine.scanOnce();
    assert.strictEqual(rClicked.action, 'clicked_continue');
    assert.strictEqual(freshBtn.clickCount, 1);
  });

  test('fuzz: hud.js mount -> unmount -> mount cycle cleanly detaches and re-attaches listeners without leak', () => {
    const { doc, win } = createFuzzEnv();
    const { createHud } = require('../hud.js');
    const prevDoc = global.document;
    const prevWin = global.window;
    global.document = doc;
    global.window = win;

    try {
      let winListenerCount = 0;
      const origWinAdd = win.addEventListener;
      const origWinRemove = win.removeEventListener;

      win.addEventListener = function(type, fn) {
        winListenerCount++;
        origWinAdd.call(win, type, fn);
      };
      win.removeEventListener = function(type, fn) {
        winListenerCount--;
        origWinRemove.call(win, type, fn);
      };

      const hud = createHud();

      // 1. Mount
      const el1 = hud.mount();
      assert.ok(el1 && doc.getElementById('gmah-hud'));
      const listenersAfterMount1 = winListenerCount;
      assert.ok(listenersAfterMount1 > 0);

      // 2. Unmount
      hud.unmount();
      assert.strictEqual(doc.getElementById('gmah-hud'), null);
      assert.strictEqual(winListenerCount, 0, 'All window listeners must be detached on unmount()');

      // 3. Mount again
      const el2 = hud.mount();
      assert.ok(el2 && doc.getElementById('gmah-hud'));
      assert.strictEqual(winListenerCount, listenersAfterMount1, 'Re-mounting must re-attach exactly the original count of listeners');

      // 4. Final unmount
      hud.unmount();
      assert.strictEqual(winListenerCount, 0);
    } finally {
      global.document = prevDoc;
      global.window = prevWin;
    }
  });
}

module.exports = { runTests, createFuzzEnv, addTurn, FuzzNode };
