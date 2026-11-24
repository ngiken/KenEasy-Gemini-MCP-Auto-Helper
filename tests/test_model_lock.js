'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '..');
const GEMINI_ORIGIN = 'https://' + 'gemini.google.com';
const D = require('../defaults.js');
const {
  GmahEngine,
  findModelSwitcherButton,
  findOpenModelMenu,
  cleanModelTriggerText
} = require('../content.js');
const { createBackgroundController, mainWorldClickByToken } = require('../background.js');
const { createHud } = require('../hud.js');
const { createPopupController } = require('../popup.js');

// ---------------------------------------------------------------------------
// Lightweight Mock DOM supporting descendant selectors, Shadow DOM, visualViewport
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

function splitDescendantSegments(part) {
  const segments = [];
  let cur = '';
  let inBracket = false;
  let inQuote = false;
  for (let i = 0; i < part.length; i++) {
    const ch = part[i];
    if (ch === '"') inQuote = !inQuote;
    else if (!inQuote && ch === '[') inBracket = true;
    else if (!inQuote && ch === ']') inBracket = false;
    if (!inBracket && !inQuote && /\s/.test(ch)) {
      if (cur) {
        segments.push(cur);
        cur = '';
      }
    } else {
      cur += ch;
    }
  }
  if (cur) segments.push(cur);
  return segments;
}

function matchCompoundSelector(el, part) {
  const segments = splitDescendantSegments(part.trim());
  if (segments.length === 0) return false;
  if (!matchSingleSelector(el, segments[segments.length - 1])) return false;
  let cur = el.parentNode;
  for (let i = segments.length - 2; i >= 0; i--) {
    let found = false;
    while (cur && cur.nodeType === 1) {
      if (matchSingleSelector(cur, segments[i])) {
        found = true;
        cur = cur.parentNode;
        break;
      }
      cur = cur.parentNode;
    }
    if (!found) return false;
  }
  return true;
}

function matchesSelectorList(el, selectorList) {
  return String(selectorList || '').split(',').some((part) => matchCompoundSelector(el, part));
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
    this.scrollIntoViewCount = 0;
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
    return this._ownText + this.children.map((c) => c.textContent).join('\n');
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

  scrollIntoView() {
    this.scrollIntoViewCount += 1;
  }

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

  focus() {}

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
    },
    dispatchEvent(ev) {
      const list = doc._listeners.get(ev.type) || [];
      for (const fn of list.slice()) fn(ev);
      return true;
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

  const vvListeners = new Map();
  const winListeners = new Map();
  const win = {
    location: { href: url || `${GEMINI_ORIGIN}/app/model-test` },
    innerWidth: typeof options.innerWidth === 'number' ? options.innerWidth : 1280,
    innerHeight: typeof options.innerHeight === 'number' ? options.innerHeight : 800,
    visualViewport: {
      width: typeof options.vvWidth === 'number' ? options.vvWidth : (typeof options.innerWidth === 'number' ? options.innerWidth : 1280),
      height: typeof options.vvHeight === 'number' ? options.vvHeight : (typeof options.innerHeight === 'number' ? options.innerHeight : 800),
      addEventListener(type, fn) {
        if (!vvListeners.has(type)) vvListeners.set(type, []);
        vvListeners.get(type).push(fn);
      },
      removeEventListener(type, fn) {
        const list = vvListeners.get(type) || [];
        const idx = list.indexOf(fn);
        if (idx >= 0) list.splice(idx, 1);
      },
      dispatchResize() {
        for (const fn of (vvListeners.get('resize') || []).slice()) fn();
      }
    },
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
      const list = winListeners.get(ev.type) || [];
      for (const fn of list.slice()) fn(ev);
      return true;
    }
  };

  return { doc, win };
}

/**
 * Helper to mount a realistic Gemini model switcher (header, composer, shadow, or narrow mobile bottom-sheet).
 */
function mountGeminiModelSwitcher(doc, config) {
  const cfg = Object.assign(
    {
      layout: 'composer', // 'composer' | 'header' | 'shadow' | 'mobile_icon'
      initialModel: 'Fast',
      models: [
        { title: 'Fast', desc: 'Answers quickly', disabled: false },
        { title: 'Thinking', desc: 'Solves complex problems with 3 Pro', disabled: false },
        { title: 'Pro', desc: 'Advanced math and code', disabled: false }
      ],
      refuseSwitch: false,
      emitErrorBanner: '',
      includeUpsell: true,
      triggerDisabled: false
    },
    config || {}
  );

  let activeModel = cfg.initialModel;
  let menuContainer = null;

  let hostContainer = doc.body;
  if (cfg.layout === 'header') {
    const header = doc.createElement('header', { className: 'top-bar-actions' });
    doc.body.appendChild(header);
    hostContainer = header;
  } else if (cfg.layout === 'shadow') {
    const host = doc.createElement('bard-mode-switcher');
    doc.body.appendChild(host);
    hostContainer = host.attachShadow();
  } else {
    const inputArea = doc.createElement('input-area-v2', { className: 'input-area-container' });
    doc.body.appendChild(inputArea);
    hostContainer = inputArea;
  }

  const switcherWrap = cfg.layout === 'shadow' ? hostContainer : doc.createElement('bard-mode-switcher');
  if (cfg.layout !== 'shadow') hostContainer.appendChild(switcherWrap);

  const triggerBtn = doc.createElement('button', {
    className: cfg.layout === 'header' ? 'gds-mode-switch-button' : 'input-area-switch',
    disabled: cfg.triggerDisabled,
    attrs: {
      'data-test-id': 'bard-mode-menu-button',
      'aria-haspopup': 'menu',
      'aria-expanded': 'false',
      'aria-label': cfg.layout === 'mobile_icon' ? '切换模型' : `Switch model, currently ${activeModel}`
    },
    text: cfg.layout === 'mobile_icon' ? '' : activeModel
  });
  switcherWrap.appendChild(triggerBtn);

  function closeMenu() {
    if (menuContainer && menuContainer.parentNode) {
      menuContainer.remove();
    }
    menuContainer = null;
    triggerBtn.setAttribute('aria-expanded', 'false');
  }

  function openMenu() {
    closeMenu();
    triggerBtn.setAttribute('aria-expanded', 'true');
    const isBottomSheet = cfg.layout === 'mobile_icon';
    const overlay = doc.createElement(
      isBottomSheet ? 'mat-bottom-sheet-container' : 'div',
      {
        className: isBottomSheet ? 'mat-bottom-sheet-container' : 'cdk-overlay-pane mat-mdc-menu-panel',
        attrs: { role: isBottomSheet ? 'dialog' : 'menu' }
      }
    );
    const list = doc.createElement('div', { className: 'bard-mode-list' });
    overlay.appendChild(list);

    for (const m of cfg.models) {
      const isSelected = m.title.toLowerCase() === activeModel.toLowerCase();
      const itemBtn = doc.createElement('button', {
        className: 'mat-mdc-menu-item bard-mode-list-button' + (m.disabled ? ' mat-mdc-menu-item-disabled' : ''),
        disabled: Boolean(m.disabled),
        attrs: {
          role: 'menuitemradio',
          'aria-checked': isSelected ? 'true' : 'false',
          'aria-disabled': m.disabled ? 'true' : 'false'
        }
      });
      const titleSpan = doc.createElement('span', { className: 'mode-title', text: m.title });
      const descSpan = doc.createElement('span', { className: 'mode-desc', text: m.desc || '' });
      itemBtn.appendChild(titleSpan);
      if (m.desc) itemBtn.appendChild(descSpan);
      if (m.lockIcon) {
        const icon = doc.createElement('mat-icon', { attrs: { fonticon: 'lock' }, text: 'lock' });
        itemBtn.appendChild(icon);
      }

      itemBtn.addEventListener('click', () => {
        if (m.disabled) return;
        if (cfg.emitErrorBanner) {
          const alert = doc.createElement('div', {
            className: 'rate-limit-banner',
            attrs: { role: 'alert' },
            text: cfg.emitErrorBanner
          });
          doc.body.appendChild(alert);
          closeMenu();
          return;
        }
        if (!cfg.refuseSwitch) {
          activeModel = m.title;
          if (cfg.layout !== 'mobile_icon') {
            triggerBtn.textContent = activeModel;
            triggerBtn.setAttribute('aria-label', `Switch model, currently ${activeModel}`);
          }
        }
        closeMenu();
      });

      list.appendChild(itemBtn);
    }

    if (cfg.includeUpsell) {
      const upsell = doc.createElement('button', {
        className: 'mat-mdc-menu-item',
        attrs: { role: 'menuitem' },
        text: 'Upgrade to Google AI Pro'
      });
      list.appendChild(upsell);
    }

    overlay.addEventListener('keydown', (e) => {
      if (e && e.key === 'Escape') closeMenu();
    });
    doc.body.appendChild(overlay);
    menuContainer = overlay;
  }

  triggerBtn.addEventListener('click', () => {
    if (triggerBtn.disabled) return;
    if (menuContainer) closeMenu();
    else openMenu();
  });

  return {
    triggerBtn,
    getActiveModel: () => activeModel,
    setActiveModel: (next) => {
      activeModel = next;
      if (cfg.layout !== 'mobile_icon') {
        triggerBtn.textContent = next;
        triggerBtn.setAttribute('aria-label', `Switch model, currently ${next}`);
      }
    },
    isMenuOpen: () => Boolean(menuContainer && menuContainer.isConnected),
    getMenuContainer: () => menuContainer,
    closeMenu
  };
}

function runTests(test) {
  test('model lock defaults: mergeSettings clamps retries, sanitizes names, and rejects prototype keys', () => {
    const def = D.mergeSettings(null);
    assert.strictEqual(def.modelLockEnabled, false);
    assert.strictEqual(def.preferredModel, '');
    assert.strictEqual(def.maxModelSwitchRetries, 3);
    assert.strictEqual(def.stopOnModelUnavailable, true);

    const custom = D.mergeSettings({
      modelLockEnabled: true,
      preferredModel: '  2.5\u200B Pro\n ',
      maxModelSwitchRetries: 99,
      stopOnModelUnavailable: false
    });
    assert.strictEqual(custom.modelLockEnabled, true);
    assert.strictEqual(custom.preferredModel, '2.5 Pro');
    assert.strictEqual(custom.maxModelSwitchRetries, 10);
    assert.strictEqual(custom.stopOnModelUnavailable, false);

    assert.strictEqual(D.mergeSettings({ maxModelSwitchRetries: 0 }).maxModelSwitchRetries, 1);
    assert.strictEqual(D.mergeSettings({ preferredModel: '__proto__' }).preferredModel, '');
    assert.strictEqual(D.mergeSettings({ preferredModel: 'x'.repeat(200) }).preferredModel.length, 80);
  });

  test('model name matcher: handles cross-language aliases, Gemini prefix, and blocks tier/upsell collisions', () => {
    // Exact & brand prefix
    assert.strictEqual(D.scoreModelMatch('Pro', 'Pro Advanced math', 'Pro'), 100);
    assert.strictEqual(D.scoreModelMatch('Gemini 2.5 Pro', 'Gemini 2.5 Pro', '2.5 Pro'), 95);
    assert.strictEqual(D.scoreModelMatch('2.5 Pro', '2.5 Pro', 'Gemini 2.5 Pro'), 95);

    // Cross-language canonical aliases
    assert.ok(D.isModelNameMatch('快速', 'Fast'));
    assert.ok(D.isModelNameMatch('高速', 'Fast'));
    assert.ok(D.isModelNameMatch('思考', 'Thinking'));
    assert.ok(D.isModelNameMatch('思考モード', 'Thinking'));
    assert.ok(D.isModelNameMatch('深度思考', 'Thinking'));

    // CRITICAL: target "Pro" MUST NOT match "Thinking with 3 Pro" or "Fast" or upsell!
    assert.strictEqual(D.scoreModelMatch('Thinking with 3 Pro', 'Thinking with 3 Pro', 'Pro'), 0);
    assert.strictEqual(D.scoreModelMatch('Fast', 'Fast answers', 'Pro'), 0);
    assert.strictEqual(D.scoreModelMatch('Upgrade to Google AI Pro', 'Upgrade to Google AI Pro', 'Pro'), 0);
    assert.strictEqual(D.scoreModelMatch('升级至 Pro', '升级至 Google AI Pro', 'Pro'), 0);

    // Clean narrow-screen trigger aria-label patterns
    assert.strictEqual(cleanModelTriggerText('Switch model, currently 2.5 Pro'), '2.5 Pro');
    assert.strictEqual(cleanModelTriggerText('切换模型 (Pro)'), 'Pro');
    assert.strictEqual(cleanModelTriggerText('当前模型：思考'), '思考');
  });

  test('model lock auto-switch: switches Fast -> Pro before clicking Continue and skips while streaming', () => {
    const { doc, win } = createEnv();
    const ui = mountGeminiModelSwitcher(doc, { layout: 'composer', initialModel: 'Fast' });

    const turn = doc.createElement('model-response', { text: 'Step 1 finished.' });
    doc.body.appendChild(turn);
    const contBtn = doc.createElement('button', { text: '继续' });
    doc.body.appendChild(contBtn);

    let now = 10000;
    const engine = new GmahEngine({
      doc,
      win,
      now: () => now,
      settings: {
        enabled: true,
        autoContinue: true,
        modelLockEnabled: true,
        preferredModel: 'Pro',
        humanPacingEnabled: false
      }
    });

    // While Gemini is actively generating (Stop button present), Model Guard must NOT interrupt!
    const stopBtn = doc.createElement('button', { attrs: { 'aria-label': 'Stop generating' } });
    doc.body.appendChild(stopBtn);
    const rGen = engine.scanOnce();
    assert.strictEqual(rGen.action, 'wait');
    assert.strictEqual(rGen.reason, 'generating');
    assert.strictEqual(ui.getActiveModel(), 'Fast');
    assert.strictEqual(contBtn.clickCount, 0);
    stopBtn.remove();

    // Now idle: Model Guard detects Fast != Pro, blocks Continue, and opens model menu
    now += 3000;
    const rOpen = engine.scanOnce();
    assert.strictEqual(rOpen.action, 'model_switch_open');
    assert.strictEqual(ui.isMenuOpen(), true);
    assert.strictEqual(contBtn.clickCount, 0, 'Auto-Continue must NOT fire while model is mismatched');

    // Step 2: selects Pro (ignoring Thinking with 3 Pro and Upgrade to Google AI Pro)
    now += 400;
    const rSelect = engine.scanOnce();
    assert.strictEqual(rSelect.action, 'model_switch_select');
    assert.strictEqual(rSelect.model, 'Pro');
    assert.strictEqual(ui.getActiveModel(), 'Pro');

    // Step 3: verifies switch succeeded
    now += 600;
    const rVerify = engine.scanOnce();
    assert.strictEqual(rVerify.action, 'model_switched');
    assert.strictEqual(engine.detectedModel, 'Pro');
    assert.strictEqual(engine.modelMismatchActive, false);

    // Step 4: now that model is Pro, Auto-Continue runs cleanly!
    now += 2500;
    const rCont = engine.scanOnce();
    assert.strictEqual(rCont.action, 'clicked_continue');
    assert.strictEqual(contBtn.clickCount, 1);
  });

  test('responsive layouts: works in desktop <header>, nested Shadow DOM, and narrow mobile icon + bottom sheet', () => {
    // 1. Desktop <header> switcher (wide 1920x1080)
    {
      const { doc, win } = createEnv(null, { innerWidth: 1920, innerHeight: 1080 });
      const ui = mountGeminiModelSwitcher(doc, { layout: 'header', initialModel: 'Fast' });
      let now = 5000;
      const engine = new GmahEngine({
        doc,
        win,
        now: () => now,
        settings: { modelLockEnabled: true, preferredModel: 'Thinking' }
      });
      assert.strictEqual(engine.scanOnce().action, 'model_switch_open');
      now += 400;
      assert.strictEqual(engine.scanOnce().action, 'model_switch_select');
      now += 600;
      assert.strictEqual(engine.scanOnce().action, 'model_switched');
      assert.strictEqual(ui.getActiveModel(), 'Thinking');
    }

    // 2. Shadow DOM switcher (split-screen 768x700)
    {
      const { doc, win } = createEnv(null, { innerWidth: 768, innerHeight: 700 });
      const ui = mountGeminiModelSwitcher(doc, { layout: 'shadow', initialModel: 'Fast' });
      let now = 5000;
      const engine = new GmahEngine({
        doc,
        win,
        now: () => now,
        settings: { modelLockEnabled: true, preferredModel: 'Pro' }
      });
      assert.strictEqual(engine.scanOnce().action, 'model_switch_open');
      now += 400;
      const selRes = engine.scanOnce();
      assert.strictEqual(selRes.action, 'model_switch_select');
      assert.strictEqual(selRes.element.scrollIntoViewCount, 1, 'Scrolls option into view for compact viewports');
      now += 600;
      assert.strictEqual(engine.scanOnce().action, 'model_switched');
      assert.strictEqual(ui.getActiveModel(), 'Pro');
    }

    // 3. Narrow mobile viewport (375x667) with icon-only trigger & mat-bottom-sheet-container
    {
      const { doc, win } = createEnv(null, { innerWidth: 375, innerHeight: 667 });
      const ui = mountGeminiModelSwitcher(doc, { layout: 'mobile_icon', initialModel: 'Pro' });
      let now = 5000;
      const engine = new GmahEngine({
        doc,
        win,
        now: () => now,
        settings: { modelLockEnabled: true, preferredModel: 'Pro' }
      });

      // Trigger is icon-only -> opens bottom sheet to inspect aria-checked="true" -> sees Pro is already selected -> closes cleanly!
      assert.strictEqual(engine.scanOnce().action, 'model_switch_open');
      assert.strictEqual(ui.isMenuOpen(), true);
      now += 400;
      const rVer = engine.scanOnce();
      assert.strictEqual(rVer.action, 'model_verified');
      assert.strictEqual(engine.detectedModel, 'Pro');
      assert.strictEqual(ui.isMenuOpen(), false, 'Bottom sheet must be dismissed cleanly after verification');

      // Subsequent tick within 15s caches verification without reopening bottom sheet
      now += 1000;
      const rCached = engine.scanOnce();
      assert.strictEqual(rCached.action, 'noop');
      assert.strictEqual(ui.isMenuOpen(), false);
    }
  });

  test('minimized & background tab: relaxes 0x0 layout, prevents double-toggle, and escalates throttled clicks to MAIN world', () => {
    // 1. When isolated-world click is throttled (no-op), engine escalates to MAIN-world click which opens & selects cleanly
    const { doc, win } = createEnv(null, { hidden: true, innerWidth: 0, innerHeight: 0 });
    const ui = mountGeminiModelSwitcher(doc, { layout: 'composer', initialModel: 'Fast' });
    ui.triggerBtn.rect = { left: 0, top: 0, width: 0, height: 0 };

    const mainWorldCalls = [];
    let now = 10000;
    const prevDoc = global.document;
    const prevWin = global.window;
    global.document = doc;
    global.window = win;
    try {
      const engine = new GmahEngine({
        doc,
        win,
        now: () => now,
        // Simulate isolated-world click being throttled/dropped by Chromium in minimized tab
        clickFn: () => {},
        settings: { modelLockEnabled: true, preferredModel: 'Pro', backgroundMode: true },
        onMainWorldClick: (p) => {
          mainWorldCalls.push(p);
          const res = mainWorldClickByToken(p.token, p.attempt, p.kind);
          assert.strictEqual(res.clicked, true, `MAIN-world click for ${p.kind} must succeed`);
        }
      });

      assert.strictEqual(engine.scanOnce().action, 'model_switch_open');
      assert.ok(mainWorldCalls.some((c) => c.kind === 'model_trigger'));
      assert.strictEqual(ui.isMenuOpen(), true);

      // Calling mainWorldClickByToken again on an already-expanded model_trigger MUST NOT double-toggle it closed!
      ui.triggerBtn.setAttribute('data-gmah-click-target', 'dup_guard_token');
      const dupRes = mainWorldClickByToken('dup_guard_token', 1, 'model_trigger');
      assert.strictEqual(dupRes.clicked, false);
      assert.strictEqual(dupRes.reason, 'already_expanded');
      assert.strictEqual(ui.isMenuOpen(), true, 'Menu must stay open when duplicate trigger guard fires');

      now += 400;
      assert.strictEqual(engine.scanOnce().action, 'model_switch_select');
      assert.ok(mainWorldCalls.some((c) => c.kind === 'model_option'));

      now += 600;
      assert.strictEqual(engine.scanOnce().action, 'model_switched');
      assert.strictEqual(ui.getActiveModel(), 'Pro');
    } finally {
      global.document = prevDoc;
      global.window = prevWin;
    }

    // 2. When isolated-world click ALREADY opens the menu, engine skips redundant model_trigger MAIN-world escalation
    {
      const env2 = createEnv(null, { hidden: true, innerWidth: 0, innerHeight: 0 });
      const ui2 = mountGeminiModelSwitcher(env2.doc, { layout: 'composer', initialModel: 'Fast' });
      const calls2 = [];
      let t2 = 10000;
      const eng2 = new GmahEngine({
        doc: env2.doc,
        win: env2.win,
        now: () => t2,
        settings: { modelLockEnabled: true, preferredModel: 'Pro', backgroundMode: true },
        onMainWorldClick: (p) => calls2.push(p)
      });
      assert.strictEqual(eng2.scanOnce().action, 'model_switch_open');
      assert.strictEqual(ui2.isMenuOpen(), true);
      assert.strictEqual(
        calls2.filter((c) => c.kind === 'model_trigger').length,
        0,
        'Must not double-toggle an already-opened menu via MAIN-world escalation'
      );
    }
  });

  test('error stop: disabled/quota-locked model trips model_unavailable, blocks ALL actions, and notifies via background.js', () => {
    const { doc, win } = createEnv();
    const ui = mountGeminiModelSwitcher(doc, {
      layout: 'composer',
      initialModel: 'Fast',
      models: [
        { title: 'Fast', desc: 'Answers quickly', disabled: false },
        { title: 'Pro', desc: 'Limit reached until 5:00 PM', disabled: true, lockIcon: true }
      ]
    });

    const badges = [];
    const notifs = [];
    const mockChrome = {
      runtime: { lastError: null, getURL: (p) => p },
      storage: { local: { get: (_k, cb) => cb({}), set: () => {} } },
      action: {
        setBadgeText: (o, cb) => { badges.push(o); if (cb) cb(); },
        setBadgeBackgroundColor: (o, cb) => { badges.push(o); if (cb) cb(); }
      },
      notifications: {
        create: (id, opt, cb) => { notifs.push({ id, opt }); if (cb) cb(); },
        clear: (_id, cb) => { if (cb) cb(); }
      }
    };
    const bg = createBackgroundController(mockChrome);

    let now = 10000;
    const engine = new GmahEngine({
      doc,
      win,
      now: () => now,
      settings: {
        modelLockEnabled: true,
        preferredModel: 'Pro',
        maxModelSwitchRetries: 2,
        stopOnModelUnavailable: true,
        stallAlertEnabled: true
      },
      onBreakerTrip: (payload) => {
        bg.showBreakerAlert(77, payload);
      }
    });

    // Attempt 1: opens menu, finds Pro disabled, dismisses menu, enters retry backoff
    assert.strictEqual(engine.scanOnce().action, 'model_switch_open');
    now += 400;
    const rFail1 = engine.scanOnce();
    assert.strictEqual(rFail1.action, 'wait');
    assert.strictEqual(rFail1.reason, 'model_switch_retry_backoff');
    assert.strictEqual(ui.isMenuOpen(), false, 'Menu must be dismissed after disabled hit');

    // Attempt 2: after backoff, rechecks once -> still disabled -> trips hard error breaker!
    now += 1500;
    assert.strictEqual(engine.scanOnce().action, 'model_switch_open');
    now += 400;
    const rTrip = engine.scanOnce();
    assert.strictEqual(rTrip.action, 'tripped');
    assert.strictEqual(rTrip.reason, 'model_unavailable');
    assert.strictEqual(engine.circuitBreaker.tripped, true);
    assert.strictEqual(engine.circuitBreaker.reasonCode, 'model_unavailable');

    // Verify background.js set red 'ERR' badge & desktop notification
    assert.ok(badges.some((b) => b.tabId === 77 && b.text === 'ERR'));
    assert.ok(badges.some((b) => b.tabId === 77 && b.color === '#ea4335'));
    assert.strictEqual(notifs.length, 1);
    assert.ok(notifs[0].opt.title.includes('默认模型不可用'));

    // While tripped with model_unavailable, EVEN MCP Allow and Continue MUST BE BLOCKED!
    const allowBtn = doc.createElement('button', { text: '始终允许' });
    doc.body.appendChild(allowBtn);
    now += 5000;
    const rBlocked = engine.scanOnce();
    assert.strictEqual(rBlocked.action, 'blocked');
    assert.strictEqual(rBlocked.reason, 'model_unavailable');
    assert.strictEqual(allowBtn.clickCount, 0);

    // Changing preferredModel to a working model auto-clears model_unavailable!
    engine.updateSettings({ preferredModel: 'Fast' }, false);
    assert.strictEqual(engine.circuitBreaker.tripped, false);
  });

  test('error stop: anti-flap protection catches Gemini repeatedly reverting model back to Fast', () => {
    const { doc, win } = createEnv();
    const ui = mountGeminiModelSwitcher(doc, { layout: 'composer', initialModel: 'Fast' });

    let now = 10000;
    const engine = new GmahEngine({
      doc,
      win,
      now: () => now,
      settings: {
        modelLockEnabled: true,
        preferredModel: 'Pro',
        maxModelSwitchRetries: 2,
        stopOnModelUnavailable: true
      }
    });

    // Switch #1 succeeds: Fast -> Pro
    assert.strictEqual(engine.scanOnce().action, 'model_switch_open');
    now += 400;
    assert.strictEqual(engine.scanOnce().action, 'model_switch_select');
    now += 600;
    assert.strictEqual(engine.scanOnce().action, 'model_switched');
    assert.strictEqual(ui.getActiveModel(), 'Pro');

    // Gemini silently reverts back to Fast after 2s! (Revert #1 -> retries switch)
    now += 2000;
    ui.setActiveModel('Fast');
    assert.strictEqual(engine.scanOnce().action, 'model_switch_open');
    now += 400;
    assert.strictEqual(engine.scanOnce().action, 'model_switch_select');
    now += 600;
    assert.strictEqual(engine.scanOnce().action, 'model_switched');

    // Gemini reverts back to Fast AGAIN after 2s! (Revert #2 === maxRetries -> error stop!)
    now += 2000;
    ui.setActiveModel('Fast');
    const rTripped = engine.scanOnce();
    assert.strictEqual(rTripped.action, 'tripped');
    assert.strictEqual(rTripped.reason, 'model_unavailable');
    assert.strictEqual(rTripped.detail, 'breakerReasonModelReverted');
  });

  test('error stop: catches missing model, error snackbar after click, missing switcher, and soft-warn mode', () => {
    // 1. Target model missing from menu
    {
      const { doc, win } = createEnv();
      mountGeminiModelSwitcher(doc, { layout: 'composer', initialModel: 'Fast' });
      let now = 10000;
      const engine = new GmahEngine({
        doc,
        win,
        now: () => now,
        settings: { modelLockEnabled: true, preferredModel: 'Gemini 9 Ultra', maxModelSwitchRetries: 1 }
      });
      assert.strictEqual(engine.scanOnce().action, 'model_switch_open');
      now += 400;
      const r = engine.scanOnce();
      assert.strictEqual(r.action, 'tripped');
      assert.strictEqual(r.detail, 'breakerReasonModelNotFound');
    }

    // 2. Error snackbar pops up during verifying phase
    {
      const { doc, win } = createEnv();
      mountGeminiModelSwitcher(doc, {
        layout: 'composer',
        initialModel: 'Fast',
        emitErrorBanner: "You've reached your limit for Pro"
      });
      let now = 10000;
      const engine = new GmahEngine({
        doc,
        win,
        now: () => now,
        settings: { modelLockEnabled: true, preferredModel: 'Pro', maxModelSwitchRetries: 1 }
      });
      assert.strictEqual(engine.scanOnce().action, 'model_switch_open');
      now += 400;
      assert.strictEqual(engine.scanOnce().action, 'model_switch_select');
      now += 300;
      const r = engine.scanOnce();
      assert.strictEqual(r.action, 'tripped');
      assert.strictEqual(r.reason, 'model_unavailable');
    }

    // 3. Missing switcher + stopOnModelUnavailable=false -> soft warning with cooldown, no breaker trip
    {
      const { doc, win } = createEnv();
      let now = 10000;
      const engine = new GmahEngine({
        doc,
        win,
        now: () => now,
        settings: {
          modelLockEnabled: true,
          preferredModel: 'Pro',
          maxModelSwitchRetries: 1,
          stopOnModelUnavailable: false
        }
      });
      const rWarn = engine.scanOnce();
      assert.strictEqual(rWarn.action, 'model_unavailable_warn');
      assert.strictEqual(engine.circuitBreaker.tripped, false);
    }
  });

  test('adversarial & fuzz safety: ignores chat response/nav/code buttons, survives clock jumps & throwing DOM', () => {
    const { doc, win } = createEnv();
    // Adversarial fake model buttons in chat reply, nav sidebar, and code block
    const resp = doc.createElement('model-response');
    const fakeRespBtn = doc.createElement('button', {
      attrs: { 'aria-label': 'Switch model', 'aria-haspopup': 'menu' },
      text: 'Fast'
    });
    resp.appendChild(fakeRespBtn);
    doc.body.appendChild(resp);

    const nav = doc.createElement('nav');
    const fakeNavBtn = doc.createElement('button', {
      attrs: { 'aria-label': 'Model selector' },
      text: 'Fast'
    });
    nav.appendChild(fakeNavBtn);
    doc.body.appendChild(nav);

    assert.strictEqual(findModelSwitcherButton(doc, win, null, 'Pro'), null);

    // Real switcher with throwing scrollIntoView + backward clock jump mid-switch
    const ui = mountGeminiModelSwitcher(doc, { layout: 'composer', initialModel: 'Fast' });
    let now = 50000;
    const engine = new GmahEngine({
      doc,
      win,
      now: () => now,
      settings: { modelLockEnabled: true, preferredModel: 'Pro' }
    });
    assert.strictEqual(engine.scanOnce().action, 'model_switch_open');
    const menu = findOpenModelMenu(doc, win, null, ui.triggerBtn, 'Pro');
    assert.ok(menu && menu.options.length === 3, 'Upsell option must be excluded from model options');
    for (const o of menu.options) {
      o.el.scrollIntoView = () => { throw new Error('scrollIntoView crash'); };
    }
    // Backward clock jump (-10s) must be sanitized without freezing!
    now -= 10000;
    const rSel = engine.scanOnce();
    assert.strictEqual(rSel.action, 'model_switch_select');
    now += 600;
    assert.strictEqual(engine.scanOnce().action, 'model_switched');
  });

  test('per-chat override, HUD model panel (Trusted Types safe + visualViewport clamp), and Popup wiring', () => {
    const { doc, win } = createEnv(`${GEMINI_ORIGIN}/app/chatA`, { innerWidth: 360, innerHeight: 480 });
    const ui = mountGeminiModelSwitcher(doc, { layout: 'composer', initialModel: 'Fast' });

    const prevDoc = global.document;
    const prevWin = global.window;
    global.document = doc;
    global.window = win;
    try {
      const engine = new GmahEngine({
        doc,
        win,
        settings: { modelLockEnabled: false, preferredModel: 'Pro', showHud: true }
      });

      // Enable modelLockEnabled ONLY for chatA via per-chat override
      engine.updateChatOverride({ modelLockEnabled: true }, false);
      assert.strictEqual(engine.settings.modelLockEnabled, true);
      assert.strictEqual(engine.globalSettings.modelLockEnabled, false);

      // Switch to chatB -> follows global (false)
      engine.onConversationChange(`${GEMINI_ORIGIN}/app/chatB`);
      assert.strictEqual(engine.settings.modelLockEnabled, false);

      // Return to chatA -> restores per-chat modelLockEnabled=true
      engine.onConversationChange(`${GEMINI_ORIGIN}/app/chatA`);
      assert.strictEqual(engine.settings.modelLockEnabled, true);

      // HUD Model Panel & visualViewport clamping on small 360x480 screen
      let setModelCalls = [];
      let detectCalls = 0;
      const hud = createHud({
        onSetPreferredModel: (m) => {
          setModelCalls.push(m);
          engine.updateSettings({ preferredModel: m }, false);
          hud.update(engine.getState());
        },
        onDetectModels: () => {
          detectCalls += 1;
          engine.forceModelCheckOrSwitch({ inspectOnly: true });
          hud.update(engine.getState());
        }
      });

      const rootEl = hud.mount();
      hud.setPosition({ left: 900, top: 900 });
      const clamped = hud.getPosition();
      assert.ok(clamped.left >= 0 && clamped.left <= 360, 'HUD left clamped to small viewport');
      assert.ok(clamped.top >= 0 && clamped.top <= 480, 'HUD top clamped to small viewport');

      // Shrink visualViewport (e.g. zoom in) and fire resize -> HUD re-clamps safely
      win.visualViewport.width = 300;
      win.visualViewport.height = 320;
      win.visualViewport.dispatchResize();
      const reclamped = hud.getPosition();
      assert.ok(reclamped.left >= 0 && reclamped.left <= 300);
      assert.ok(reclamped.top >= 0 && reclamped.top <= 320);

      // Open HUD 'model' panel and verify zero innerHTML + interactive preset chips
      engine.detectCurrentModelInfo();
      hud.update(engine.getState());
      hud.setActivePanel('model');
      const chips = rootEl.querySelectorAll('.gmah-model-chip');
      assert.ok(chips.length >= 3, 'Model panel renders preset chips');
      chips.find((c) => c.textContent === 'Thinking').click();
      assert.deepStrictEqual(setModelCalls, ['Thinking']);
      assert.strictEqual(engine.settings.preferredModel, 'Thinking');

      // Verify hud.js source has no innerHTML assignments
      const hudSrc = fs.readFileSync(path.join(ROOT, 'hud.js'), 'utf8');
      assert.ok(!/\.innerHTML\s*=/.test(hudSrc), 'hud.js must never assign innerHTML (Trusted Types CSP)');

      hud.unmount();
    } finally {
      global.document = prevDoc;
      global.window = prevWin;
    }

    // Popup controller test: renders model lock fields, chips, and handles liveModelError status
    const pEnv = createEnv();
    const ids = [
      'enabled', 'autoAllow', 'preferAlwaysAllow', 'fallbackSingleAllow', 'autoContinue',
      'backgroundMode', 'preventTabDiscard', 'showHud', 'stopOnCompletionCues', 'stopOnStagnantOutput',
      'stopOnQuotaOrError', 'humanPacingEnabled', 'stallAlertEnabled', 'stallAutoRecoverEnabled',
      'modelLockEnabled', 'stopOnModelUnavailable', 'preferredModel', 'maxModelSwitchRetries',
      'detectedModelBadge', 'modelPresetChips', 'btnUseCurrentModel', 'btnDetectModels', 'btnSwitchModelNow',
      'chatControlCard', 'chatLabel', 'chatOverrideBadge', 'btnResetChatOverride',
      'chatEnabled', 'chatAutoAllow', 'chatAutoContinue', 'chatBackgroundMode',
      'chatStallAlertEnabled', 'chatStallAutoRecoverEnabled', 'chatModelLockEnabled',
      'btnChatEmergency', 'statAllow', 'statContinue', 'statLive', 'toast'
    ];
    for (const id of ids) {
      const tag = id.startsWith('btn') ? 'button' : (id === 'modelPresetChips' || id === 'chatControlCard' || id === 'toast' ? 'div' : 'input');
      pEnv.doc.body.appendChild(pEnv.doc.createElement(tag, { id }));
    }

    const sentMsgs = [];
    const mockPopupChrome = {
      runtime: { lastError: null },
      storage: { local: { get: (_k, cb) => cb({}), set: (_v, cb) => { if (cb) cb(); } } },
      tabs: {
        query: (_q, cb) => cb([{ id: 1, active: true, highlighted: true, windowId: 1 }]),
        sendMessage: (_id, msg, cb) => {
          sentMsgs.push(msg);
          if (cb) {
            cb({
              ok: true,
              state: {
                settings: D.mergeSettings({ modelLockEnabled: true, preferredModel: 'Pro' }),
                detectedModel: 'Fast',
                availableModels: ['Fast', 'Thinking', 'Pro'],
                modelMismatchActive: true,
                circuitBreaker: { tripped: true, reasonCode: 'model_unavailable', reason: 'unavailable' }
              }
            });
          }
        }
      }
    };

    const popup = createPopupController(pEnv.doc, mockPopupChrome);
    popup.init();
    assert.strictEqual(pEnv.doc.getElementById('statLive').textContent, '模型异常停止');
    assert.strictEqual(pEnv.doc.getElementById('detectedModelBadge').textContent, 'Fast');
    assert.ok(pEnv.doc.getElementById('modelPresetChips').querySelectorAll('.model-chip').length >= 3);

    pEnv.doc.getElementById('preferredModel').value = 'Pro';
    pEnv.doc.getElementById('btnSwitchModelNow').click();
    assert.ok(sentMsgs.some((m) => m.type === 'GMAH_FORCE_MODEL_SWITCH' && m.model === 'Pro'));
    pEnv.doc.getElementById('btnUseCurrentModel').click();
    assert.ok(sentMsgs.some((m) => m.type === 'GMAH_USE_CURRENT_MODEL'));
    pEnv.doc.getElementById('btnDetectModels').click();
    assert.ok(sentMsgs.some((m) => m.type === 'GMAH_DETECT_MODELS'));
    void ui;
  });

  test('audit hardening: duplicate responsive switchers prefer active visible trigger, .0 versions match, and stall recovery switches model before sending', () => {
    // 1. .0 version normalization
    assert.ok(D.isModelNameMatch('3.0 Pro', '3 Pro'));
    assert.ok(D.isModelNameMatch('3 Pro', '3.0 Pro'));
    assert.ok(!D.isModelNameMatch('2.5 Pro', '2 Pro'));

    // 2. Duplicate responsive switchers in DOM while tab is in background: prefer strictly visible active switcher over 0x0 hidden duplicate
    {
      const { doc, win } = createEnv(null, { hidden: true, innerWidth: 500, innerHeight: 700 });
      const hiddenDesktop = doc.createElement('button', {
        className: 'gds-mode-switch-button',
        rect: { left: 0, top: 0, width: 0, height: 0 },
        style: { opacity: '0', width: '0px', height: '0px' },
        attrs: { 'data-test-id': 'bard-mode-menu-button', 'aria-label': '切换模型' },
        text: ''
      });
      const visibleMobile = doc.createElement('button', {
        className: 'input-area-switch',
        rect: { left: 20, top: 600, width: 90, height: 32 },
        attrs: { 'data-test-id': 'bard-mode-menu-button', 'aria-label': 'Switch model, currently Pro' },
        text: 'Pro'
      });
      doc.body.appendChild(hiddenDesktop);
      doc.body.appendChild(visibleMobile);

      const picked = findModelSwitcherButton(doc, win, null, 'Pro');
      assert.ok(picked && picked.el === visibleMobile, 'Must pick strictly visible responsive trigger over 0x0 hidden duplicate');
      assert.strictEqual(picked.label, 'Pro');
    }

    // 3. Stall auto-recovery switches model Fast -> Pro BEFORE filling & sending reconnect prompt
    {
      const { doc, win } = createEnv();
      const ui = mountGeminiModelSwitcher(doc, { layout: 'composer', initialModel: 'Fast' });
      const turn = doc.createElement('model-response', { text: 'Working...' });
      doc.body.appendChild(turn);
      const statusNode = doc.createElement('div', { attrs: { role: 'status' }, text: '正在连接 Desktop Commander...' });
      doc.body.appendChild(statusNode);
      const inputEl = doc.createElement('div', {
        className: 'ql-editor',
        attrs: { contenteditable: 'true', role: 'textbox' }
      });
      doc.body.appendChild(inputEl);
      const sendBtn = doc.createElement('button', { className: 'send-button', attrs: { 'aria-label': 'Send message' } });
      doc.body.appendChild(sendBtn);

      let now = 10000;
      const engine = new GmahEngine({
        doc,
        win,
        now: () => now,
        settings: {
          enabled: true,
          stallAutoRecoverEnabled: true,
          stallAutoRecoverMinutes: 1,
          humanPacingEnabled: false,
          modelLockEnabled: true,
          preferredModel: 'Pro'
        }
      });

      // Start stall timer
      engine.scanOnce();
      // Advance 61s -> stall recovery starts direct fill, detects Fast != Pro, opens model switcher FIRST!
      now += 61000;
      const r1 = engine.scanOnce();
      assert.strictEqual(r1.action, 'model_switch_open');
      assert.strictEqual(sendBtn.clickCount, 0);

      now += 400;
      assert.strictEqual(engine.scanOnce().action, 'model_switch_select');
      now += 600;
      assert.strictEqual(engine.scanOnce().action, 'model_switched');
      assert.strictEqual(ui.getActiveModel(), 'Pro');

      // Now model is Pro -> stall recovery immediately fills & sends reconnect prompt!
      now += 200;
      const rFill = engine.scanOnce();
      assert.strictEqual(rFill.action, 'stall_recover_fill');
      now += 500;
      const rSend = engine.scanOnce();
      assert.strictEqual(rSend.action, 'stall_recover_sent');
      assert.strictEqual(sendBtn.clickCount, 1);
    }
  });

  test('audit round 2: hidden check/lock icons ignored, nested Angular Material wrappers unwrapped, and fresh /app landing switches before first prompt', () => {
    // 1. Hidden check icon on Fast and hidden lock icon on Pro must NOT misclassify options
    {
      const { doc, win } = createEnv(`${GEMINI_ORIGIN}/app`);
      const overlay = doc.createElement('div', {
        className: 'cdk-overlay-pane mat-mdc-menu-panel',
        attrs: { role: 'menu' }
      });

      const mkWrappedItem = (titleText, descText, checkVisible, lockVisible) => {
        const btn = doc.createElement('button', {
          className: 'mat-mdc-menu-item',
          attrs: { role: 'menuitem' }
        });
        const outerSpan = doc.createElement('span', { className: 'mat-mdc-menu-item-text' });
        const stack = doc.createElement('div');
        const line1 = doc.createElement('div', { text: titleText });
        const line2 = doc.createElement('div', { text: descText });
        stack.appendChild(line1);
        stack.appendChild(line2);
        outerSpan.appendChild(stack);
        btn.appendChild(outerSpan);

        const checkIcon = doc.createElement('mat-icon', {
          attrs: { fonticon: 'check' },
          style: checkVisible ? {} : { visibility: 'hidden' },
          text: 'check'
        });
        btn.appendChild(checkIcon);

        const lockIcon = doc.createElement('mat-icon', {
          attrs: { fonticon: 'lock' },
          style: lockVisible ? {} : { display: 'none' },
          text: 'lock'
        });
        btn.appendChild(lockIcon);
        return btn;
      };

      overlay.appendChild(mkWrappedItem('Fast', 'Everyday fast answers', true, false));
      overlay.appendChild(mkWrappedItem('Pro', 'Complex coding and math', false, false));
      doc.body.appendChild(overlay);

      const menu = findOpenModelMenu(doc, win, null, null, 'Pro');
      assert.ok(menu && menu.options.length === 2);
      assert.strictEqual(menu.options[0].title, 'Fast');
      assert.strictEqual(menu.options[0].selected, true);
      assert.strictEqual(menu.options[0].disabled, false);

      assert.strictEqual(menu.options[1].title, 'Pro');
      assert.strictEqual(menu.options[1].selected, false, 'Hidden check icon must NOT mark Pro as selected');
      assert.strictEqual(menu.options[1].disabled, false, 'Hidden lock icon must NOT mark Pro as disabled');
    }

    // 2. Fresh /app landing page (0 turns) immediately switches default model before user sends first prompt
    {
      const { doc, win } = createEnv(`${GEMINI_ORIGIN}/app`);
      const ui = mountGeminiModelSwitcher(doc, { layout: 'composer', initialModel: 'Fast' });
      let now = 5000;
      const engine = new GmahEngine({
        doc,
        win,
        now: () => now,
        settings: { enabled: true, modelLockEnabled: true, preferredModel: 'Pro' }
      });

      assert.strictEqual(engine.scanOnce().action, 'model_switch_open');
      now += 400;
      assert.strictEqual(engine.scanOnce().action, 'model_switch_select');
      now += 600;
      assert.strictEqual(engine.scanOnce().action, 'model_switched');
      assert.strictEqual(ui.getActiveModel(), 'Pro');
    }
  });

  test('E2E integration: background.js + GmahEngine + HUD complete background model switch, Continue, and ERR notification focus', () => {
    const { doc, win } = createEnv(`${GEMINI_ORIGIN}/app/e2e-model`, {
      hidden: true,
      innerWidth: 0,
      innerHeight: 0
    });
    const ui = mountGeminiModelSwitcher(doc, { layout: 'composer', initialModel: 'Fast' });
    const turn = doc.createElement('model-response', { text: 'Chunk 1 done' });
    doc.body.appendChild(turn);
    const contBtn = doc.createElement('button', { text: '继续' });
    doc.body.appendChild(contBtn);

    const badges = [];
    const notifs = [];
    const focusedWins = [];
    const activatedTabs = [];
    const scheduledCallbacks = [];

    const mockChrome = {
      runtime: { lastError: null, getURL: (p) => p },
      storage: {
        local: {
          get: (_k, cb) => cb({
            [D.STORAGE_KEY]: D.mergeSettings({
              enabled: true,
              backgroundMode: true,
              stallAlertEnabled: true,
              modelLockEnabled: true,
              preferredModel: 'Pro'
            })
          }),
          set: () => {}
        }
      },
      tabs: {
        get: (id, cb) => cb({ id, windowId: 55, url: `${GEMINI_ORIGIN}/app/e2e-model` }),
        update: (id, props, cb) => { activatedTabs.push({ id, props }); if (cb) cb(); },
        query: (_q, cb) => cb([]),
        sendMessage: () => {}
      },
      windows: {
        get: (id, cb) => cb({ id, state: 'minimized' }),
        update: (id, props, cb) => { focusedWins.push({ id, props }); if (cb) cb(); }
      },
      action: {
        setBadgeText: (o, cb) => { badges.push(o); if (cb) cb(); },
        setBadgeBackgroundColor: (o, cb) => { badges.push(o); if (cb) cb(); }
      },
      notifications: {
        create: (id, opt, cb) => { notifs.push({ id, opt }); if (cb) cb(); },
        clear: (_id, cb) => { if (cb) cb(); }
      },
      alarms: { create: () => {}, clear: () => {} }
    };

    let now = 20000;
    const bg = createBackgroundController(
      mockChrome,
      {
        setInterval: () => 1,
        clearInterval: () => {},
        setTimeout: (fn, delay) => {
          const id = scheduledCallbacks.length + 1;
          scheduledCallbacks.push({ id, fn, delay, cleared: false });
          return id;
        },
        clearTimeout: (id) => {
          const item = scheduledCallbacks.find((c) => c.id === id);
          if (item) item.cleared = true;
        }
      },
      () => now
    );

    const prevDoc = global.document;
    const prevWin = global.window;
    global.document = doc;
    global.window = win;

    let hud = null;
    try {
      const engine = new GmahEngine({
        doc,
        win,
        now: () => now,
        settings: {
          enabled: true,
          autoContinue: true,
          backgroundMode: true,
          humanPacingEnabled: false,
          stallAlertEnabled: true,
          modelLockEnabled: true,
          preferredModel: 'Pro',
          maxModelSwitchRetries: 1,
          stopOnModelUnavailable: true
        },
        onMainWorldClick: (p) => mainWorldClickByToken(p.token, p.attempt, p.kind),
        onBreakerTrip: (payload) => bg.showBreakerAlert(9, payload),
        onBreakerClear: () => bg.clearBreakerAlert(9),
        onStateChange: (st) => { if (hud) hud.update(st); }
      });

      hud = createHud({});
      const hudRoot = hud.mount();
      hud.update(engine.getState());

      // Phase 1: Background scan switches Fast -> Pro, then auto-continues!
      assert.strictEqual(engine.scanOnce().action, 'model_switch_open');
      now += 400;
      assert.strictEqual(engine.scanOnce().action, 'model_switch_select');
      now += 600;
      assert.strictEqual(engine.scanOnce().action, 'model_switched');
      assert.strictEqual(ui.getActiveModel(), 'Pro');
      now += 2500;
      assert.strictEqual(engine.scanOnce().action, 'clicked_continue');
      assert.ok(contBtn.clickCount >= 1, 'Continue button clicked (including MAIN-world escalation in hidden tab)');

      // Phase 2: Later Gemini switches model away and target becomes unavailable -> ERR trip + notification + HUD red dot
      now += 5000;
      ui.setActiveModel('Fast');
      const rTrip = engine.scanOnce();
      assert.strictEqual(rTrip.action, 'tripped');
      assert.strictEqual(rTrip.reason, 'model_unavailable');
      assert.ok(hudRoot.querySelector('.gmah-dot').className.includes('stopped'));
      assert.ok(badges.some((b) => b.tabId === 9 && b.text === 'ERR'));
      assert.strictEqual(notifs.length, 1);

      // Phase 3: Clicking the OS notification restores minimized window & focuses tab 9!
      bg.handleNotificationClicked(notifs[0].id);
      assert.ok(focusedWins.some((w) => w.id === 55 && w.props.focused === true && w.props.state === 'normal'));
      assert.ok(activatedTabs.some((t) => t.id === 9 && t.props.active === true));

      hud.unmount();
    } finally {
      global.document = prevDoc;
      global.window = prevWin;
    }
  });
}

module.exports = { runTests };
