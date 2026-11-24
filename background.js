(function (root) {
  'use strict';

  if (!root.GMAH_DEFAULTS && typeof importScripts === 'function') {
    try {
      importScripts('defaults.js');
    } catch (_) {}
  }

  const D =
    root.GMAH_DEFAULTS ||
    (typeof require === 'function' ? require('./defaults.js') : null);

  const GEMINI_URL_PATTERN = 'https://gemini.google.com/*';
  const ALARM_NAME = 'gmah_bg_keepalive';
  const STORAGE_KEY = 'gmah_settings_v1';
  const CHAT_OVERRIDES_KEY = (D && D.CHAT_OVERRIDES_KEY) || 'gmah_chat_overrides_v1';
  const HEARTBEAT_INTERVAL_MS = 1500;
  const KEEPALIVE_EVERY_N_TICKS = 13; // ~19.5s: resets Chrome MV3 30s SW idle timer
  const RESYNC_EVERY_N_TICKS = 6; // ~9s: rediscovers & wakes any unattached background Gemini tabs
  const PORT_ROTATE_MS = 4 * 60 * 1000; // Rotate long-lived MV3 port before Chrome's 5-min hard disconnect
  const PONG_TIMEOUT_MS = 8 * 1000; // Fast 8s zombie-port watchdog so background tabs never stall
  const PONG_RECOVERY_COOLDOWN_MS = 5 * 1000;
  const MIN_SCHEDULED_TICK_MS = 150;
  const MAX_SCHEDULED_TICK_MS = 30000;

  function isGeminiUrl(url) {
    return typeof url === 'string' && /^https:\/\/gemini\.google\.com(\/|$|\?)/i.test(url);
  }

  /**
   * Self-contained MAIN-world click executor for background / minimized tabs.
   * Pierces open ShadowRoots and Angular Material chips, wakes page Zone.js handlers,
   * and executes a complete Pointer + Mouse + click() sequence inside the page's MAIN world.
   */
  function mainWorldClickByToken(token, attempt, kind) {
    try {
      if (typeof token !== 'string' || !token) return { clicked: false, reason: 'invalid_token' };
      const selector = `[data-gmah-click-target="${token.replace(/["\\]/g, '')}"]`;
      const visited = new Set();
      const findInRoot = (rootNode, depth) => {
        if (!rootNode || depth > 32 || visited.has(rootNode)) return null;
        visited.add(rootNode);
        if (typeof rootNode.querySelector === 'function') {
          const direct = rootNode.querySelector(selector);
          if (direct) return direct;
        }
        if (typeof rootNode.querySelectorAll === 'function') {
          const all = rootNode.querySelectorAll('*');
          for (let i = 0; i < all.length; i++) {
            const sr = all[i] && all[i].shadowRoot;
            if (sr && !visited.has(sr)) {
              const hit = findInRoot(sr, depth + 1);
              if (hit) return hit;
            }
          }
        }
        return null;
      };

      const el = findInRoot(document, 0);
      if (!el || el.isConnected === false) return { clicked: false, reason: 'not_found' };
      try {
        el.removeAttribute('data-gmah-click-target');
      } catch (_) {}

      if (el.disabled === true || el.hidden === true) return { clicked: false, reason: 'disabled' };
      if (el.getAttribute && (el.getAttribute('aria-disabled') === 'true' || el.getAttribute('aria-hidden') === 'true')) {
        return { clicked: false, reason: 'aria_disabled' };
      }
      if (kind === 'send') {
        const sendCls = typeof el.className === 'string' ? el.className : '';
        const sendAria = (el.getAttribute && el.getAttribute('aria-label')) || '';
        if (/\bstop(?:-button)?\b/i.test(sendCls) || /\bstop\b|停止|取消生成|终止|終止|中止/i.test(sendAria)) {
          return { clicked: false, reason: 'already_sending' };
        }
      } else if (kind === 'model_trigger') {
        // Prevent double-toggling an already-opened model switcher menu
        if (el.getAttribute && el.getAttribute('aria-expanded') === 'true') {
          return { clicked: false, reason: 'already_expanded' };
        }
        try {
          if (
            document.querySelector(
              'bard-mode-switcher-menu, .mat-mdc-menu-panel, mat-bottom-sheet-container, .cdk-overlay-pane [role="menu"]'
            )
          ) {
            return { clicked: false, reason: 'menu_already_open' };
          }
        } catch (_) {}
      } else if (kind === 'model_option') {
        if (
          el.getAttribute &&
          (el.getAttribute('aria-checked') === 'true' || el.getAttribute('aria-selected') === 'true')
        ) {
          return { clicked: false, reason: 'already_selected' };
        }
      }
      if (typeof window.getComputedStyle === 'function') {
        const st = window.getComputedStyle(el);
        if (st && (st.display === 'none' || st.visibility === 'hidden')) {
          return { clicked: false, reason: 'hidden' };
        }
      }

      let target = el;
      try {
        if (target.shadowRoot && typeof target.shadowRoot.querySelector === 'function') {
          const inner = target.shadowRoot.querySelector('button, [role="button"]');
          if (inner && !inner.disabled) target = inner;
        } else if (typeof target.querySelector === 'function') {
          const tag = (target.tagName || '').toUpperCase();
          const cls = typeof target.className === 'string' ? target.className : '';
          if (
            tag === 'MAT-CHIP' ||
            tag === 'MAT-CHIP-OPTION' ||
            tag === 'MAT-ACTION-CHIP' ||
            tag === 'SUGGESTION-CHIP' ||
            /\b(suggestion-chip|follow-up-chip|mat-mdc-chip|mdc-evolution-chip)\b/i.test(cls)
          ) {
            const inner = target.querySelector('button, [role="button"]');
            if (inner && !inner.disabled) {
              target = (inner.shadowRoot && inner.shadowRoot.querySelector('button, [role="button"]')) || inner;
            }
          }
        }
      } catch (_) {}

      let coords = {};
      if (typeof target.getBoundingClientRect === 'function') {
        try {
          const r = target.getBoundingClientRect();
          if (r && Number.isFinite(r.width) && Number.isFinite(r.height) && r.width > 0 && r.height > 0) {
            coords = {
              clientX: Math.round((Number.isFinite(r.left) ? r.left : 0) + r.width * 0.5),
              clientY: Math.round((Number.isFinite(r.top) ? r.top : 0) + r.height * 0.5)
            };
          }
        } catch (_) {}
      }

      if (typeof target.focus === 'function') {
        try {
          target.focus({ preventScroll: true });
        } catch (_) {
          try { target.focus(); } catch (_) {}
        }
      }

      const base = Object.assign({ bubbles: true, cancelable: true, composed: true, button: 0, view: window }, coords);
      const enterOpts = Object.assign({ bubbles: false, cancelable: false, composed: true, buttons: 0, detail: 0, view: window }, coords);
      const hoverOpts = Object.assign({ buttons: 0, detail: 0 }, base);
      const downOpts = Object.assign({ buttons: 1, detail: 1 }, base);
      const upOpts = Object.assign({ buttons: 0, detail: 1 }, base);

      try {
        if (typeof window.PointerEvent === 'function') {
          target.dispatchEvent(new window.PointerEvent('pointerenter', Object.assign({ pointerId: 1, isPrimary: true }, enterOpts)));
          target.dispatchEvent(new window.PointerEvent('pointerover', Object.assign({ pointerId: 1, isPrimary: true }, hoverOpts)));
          target.dispatchEvent(new window.PointerEvent('pointermove', Object.assign({ pointerId: 1, isPrimary: true }, hoverOpts)));
        }
        if (typeof window.MouseEvent === 'function') {
          target.dispatchEvent(new window.MouseEvent('mouseenter', enterOpts));
          target.dispatchEvent(new window.MouseEvent('mouseover', hoverOpts));
        }
        if (typeof window.PointerEvent === 'function') {
          target.dispatchEvent(new window.PointerEvent('pointerdown', Object.assign({ pointerId: 1, isPrimary: true }, downOpts)));
        }
        if (typeof window.MouseEvent === 'function') {
          target.dispatchEvent(new window.MouseEvent('mousedown', downOpts));
        }
        if (typeof window.PointerEvent === 'function') {
          target.dispatchEvent(new window.PointerEvent('pointerup', Object.assign({ pointerId: 1, isPrimary: true }, upOpts)));
        }
        if (typeof window.MouseEvent === 'function') {
          target.dispatchEvent(new window.MouseEvent('mouseup', upOpts));
        }
      } catch (_) {}

      if (typeof target.click === 'function') {
        target.click();
      } else if (typeof window.MouseEvent === 'function') {
        target.dispatchEvent(new window.MouseEvent('click', upOpts));
      }

      if (Number(attempt) >= 3 && typeof window.KeyboardEvent === 'function') {
        const keyOpts = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true, composed: true };
        for (const kt of ['keydown', 'keypress', 'keyup']) {
          try { target.dispatchEvent(new window.KeyboardEvent(kt, keyOpts)); } catch (_) {}
        }
      }
      return { clicked: true };
    } catch (err) {
      return { clicked: false, reason: String(err && err.message || 'exception') };
    }
  }

  function createBackgroundController(chromeApi, timers, clockFn) {
    const api = chromeApi || (typeof chrome !== 'undefined' ? chrome : null);
    const t = Object.assign({ setInterval, clearInterval, setTimeout, clearTimeout }, timers || {});
    const nowFn = typeof clockFn === 'function' ? clockFn : () => Date.now();
    const ports = new Map(); // tabId -> port
    const portMeta = new Map(); // tabId -> { connectedAt, lastPongAt, rotateSent }
    const scheduledTicks = new Map(); // tabId -> { timerId, dueAt }
    let heartbeatTimer = null;
    let heartbeatTickCount = 0;
    let settingsLoaded = false;
    let chatOverrides = {};
    let settings = {
      language: 'zh-CN',
      enabled: true,
      backgroundMode: true,
      preventTabDiscard: true,
      stallAlertEnabled: true
    };

    function trBg(key, vars, fallback) {
      if (D && typeof D.t === 'function') {
        return D.t(settings.language, key, vars);
      }
      return fallback || key;
    }

    function applyRawSettings(raw) {
      if (!raw || typeof raw !== 'object') return;
      settings = {
        language:
          D && typeof D.resolveLanguage === 'function'
            ? D.resolveLanguage(raw.language)
            : typeof raw.language === 'string'
              ? raw.language
              : 'zh-CN',
        enabled: typeof raw.enabled === 'boolean' ? raw.enabled : true,
        backgroundMode: typeof raw.backgroundMode === 'boolean' ? raw.backgroundMode : true,
        preventTabDiscard:
          typeof raw.preventTabDiscard === 'boolean' ? raw.preventTabDiscard : true,
        stallAlertEnabled:
          typeof raw.stallAlertEnabled === 'boolean' ? raw.stallAlertEnabled : true
      };
    }

    function applyRawChatOverrides(raw) {
      if (D && typeof D.sanitizeChatOverridesMap === 'function') {
        chatOverrides = D.sanitizeChatOverridesMap(raw);
      } else if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        chatOverrides = Object.assign({}, raw);
      } else {
        chatOverrides = {};
      }
    }

    function isAnyBackgroundActive() {
      if (settings.enabled && settings.backgroundMode) return true;
      if (!chatOverrides || typeof chatOverrides !== 'object') return false;
      for (const key of Object.keys(chatOverrides)) {
        const ov = chatOverrides[key];
        if (!ov || typeof ov !== 'object' || ov.emergencyStopped === true) continue;
        const effEnabled = typeof ov.enabled === 'boolean' ? ov.enabled : settings.enabled;
        const effBg = typeof ov.backgroundMode === 'boolean' ? ov.backgroundMode : settings.backgroundMode;
        if (effEnabled && effBg) return true;
      }
      return false;
    }

    function isTabBackgroundActive(tabUrl) {
      if (typeof tabUrl === 'string' && tabUrl && D && typeof D.extractConversationKey === 'function') {
        const chatKey = D.extractConversationKey(tabUrl);
        if (chatKey && chatOverrides && chatOverrides[chatKey]) {
          const ov = chatOverrides[chatKey];
          if (ov.emergencyStopped === true) return false;
          const effEnabled = typeof ov.enabled === 'boolean' ? ov.enabled : settings.enabled;
          const effBg = typeof ov.backgroundMode === 'boolean' ? ov.backgroundMode : settings.backgroundMode;
          return Boolean(effEnabled && effBg);
        }
        return Boolean(settings.enabled && settings.backgroundMode);
      }
      return isAnyBackgroundActive();
    }

    function loadSettings(cb) {
      if (!api || !api.storage || !api.storage.local) {
        settingsLoaded = true;
        if (cb) cb(settings);
        return;
      }
      api.storage.local.get([STORAGE_KEY, CHAT_OVERRIDES_KEY], (res) => {
        const raw = res && res[STORAGE_KEY];
        applyRawSettings(raw);
        if (res && Object.prototype.hasOwnProperty.call(res, CHAT_OVERRIDES_KEY)) {
          applyRawChatOverrides(res[CHAT_OVERRIDES_KEY]);
        }
        settingsLoaded = true;
        if (cb) cb(settings);
      });
    }

    function withLoadedSettings(cb) {
      if (settingsLoaded) {
        cb(settings);
      } else {
        loadSettings(cb);
      }
    }

    function applyDiscardProtection(tabId, tabUrl) {
      if (!api || !api.tabs || typeof api.tabs.update !== 'function') return;
      if (typeof tabId !== 'number') return;
      const resolvedUrl = tabUrl || (portMeta.has(tabId) && portMeta.get(tabId).url) || null;
      const shouldProtect = Boolean(
        isTabBackgroundActive(resolvedUrl) && settings.preventTabDiscard
      );
      try {
        const res = api.tabs.update(tabId, { autoDiscardable: !shouldProtect }, () => {
          // Consume chrome.runtime.lastError if tab closed
          void (api.runtime && api.runtime.lastError);
        });
        if (res && typeof res.catch === 'function') {
          res.catch(() => {});
        }
      } catch (_) {
        // Ignore transient tab errors
      }
    }

    function injectIntoTab(tabId, onDone) {
      if (!api || !api.scripting || typeof api.scripting.executeScript !== 'function') {
        if (onDone) onDone(false);
        return;
      }
      if (typeof tabId !== 'number') {
        if (onDone) onDone(false);
        return;
      }
      try {
        if (typeof api.scripting.insertCSS === 'function') {
          const cssRes = api.scripting.insertCSS(
            { target: { tabId }, files: ['hud.css'] },
            () => {
              void (api.runtime && api.runtime.lastError);
            }
          );
          if (cssRes && typeof cssRes.catch === 'function') {
            cssRes.catch(() => {});
          }
        }
        const jsRes = api.scripting.executeScript(
          { target: { tabId }, files: ['defaults.js', 'hud.js', 'content.js'] },
          () => {
            const hadErr = Boolean(api.runtime && api.runtime.lastError);
            if (onDone) onDone(!hadErr);
          }
        );
        if (jsRes && typeof jsRes.catch === 'function') {
          jsRes.catch(() => {
            if (onDone) onDone(false);
          });
        }
      } catch (_) {
        if (onDone) onDone(false);
      }
    }

    function ensureTabInjected(tabId) {
      if (api && api.tabs && typeof api.tabs.sendMessage === 'function') {
        try {
          const res = api.tabs.sendMessage(
            tabId,
            { type: 'GMAH_GET_STATE' },
            () => {
              const hadErr = Boolean(api.runtime && api.runtime.lastError);
              if (hadErr) {
                injectIntoTab(tabId);
              }
            }
          );
          if (res && typeof res.catch === 'function') {
            res.catch(() => {});
          }
          return;
        } catch (_) {
          // Fall through to direct injection
        }
      }
      injectIntoTab(tabId);
    }

    function syncAllGeminiTabs(sendTick, autoInject) {
      if (!api || !api.tabs || typeof api.tabs.query !== 'function') return;
      try {
        api.tabs.query({ url: GEMINI_URL_PATTERN }, (tabs) => {
          if (api.runtime && api.runtime.lastError) return;
          if (!Array.isArray(tabs)) return;
          const bgActive = isAnyBackgroundActive();
          for (const tab of tabs) {
            if (!tab || typeof tab.id !== 'number') continue;
            if (tab.url && !isGeminiUrl(tab.url)) continue;
            applyDiscardProtection(tab.id, tab.url);
            if (tab.discarded) continue;
            const tabBgActive = tab.url ? isTabBackgroundActive(tab.url) : bgActive;
            if (sendTick && tabBgActive) {
              // pingTab already probes via port or sendMessage and falls back to injectIntoTab if missing
              pingTab(tab.id, 'alarm');
            } else if (autoInject && !ports.has(tab.id)) {
              if (
                tabBgActive &&
                api.tabs &&
                typeof api.tabs.sendMessage === 'function'
              ) {
                // Wake unattached background tab via tabs.sendMessage (also auto-injects if missing)
                pingTab(tab.id, 'resync');
              } else {
                ensureTabInjected(tab.id);
              }
            }
          }
        });
      } catch (_) {
        // Ignore
      }
    }

    function pingTab(tabId, source) {
      if (!isAnyBackgroundActive()) return;
      const port = ports.get(tabId);
      if (port) {
        try {
          port.postMessage({ type: 'GMAH_BG_TICK', source, ts: nowFn() });
          return;
        } catch (_) {
          ports.delete(tabId);
          portMeta.delete(tabId);
        }
      }
      if (api && api.tabs && typeof api.tabs.sendMessage === 'function') {
        try {
          const res = api.tabs.sendMessage(
            tabId,
            { type: 'GMAH_BG_TICK', source, ts: nowFn() },
            () => {
              const hadErr = Boolean(api.runtime && api.runtime.lastError);
              if (hadErr && source !== 'post_inject') {
                injectIntoTab(tabId, (ok) => {
                  if (ok) pingTab(tabId, 'post_inject');
                });
              }
            }
          );
          if (res && typeof res.catch === 'function') {
            res.catch(() => {});
          }
        } catch (_) {
          // Tab might still be loading
        }
      }
    }

    function keepServiceWorkerAlive() {
      if (!api) return;
      try {
        if (api.runtime && typeof api.runtime.getPlatformInfo === 'function') {
          api.runtime.getPlatformInfo(() => {
            void (api.runtime && api.runtime.lastError);
          });
        } else if (api.storage && api.storage.local && typeof api.storage.local.get === 'function') {
          api.storage.local.get([STORAGE_KEY], () => {
            void (api.runtime && api.runtime.lastError);
          });
        }
      } catch (_) {
        // Ignore transient SW keepalive errors
      }
    }

    function clearScheduledTick(tabId) {
      const entry = scheduledTicks.get(tabId);
      if (entry) {
        try {
          t.clearTimeout(entry.timerId);
        } catch (_) {}
        scheduledTicks.delete(tabId);
      }
    }

    function clearAllScheduledTicks() {
      for (const tabId of Array.from(scheduledTicks.keys())) {
        clearScheduledTick(tabId);
      }
    }

    function scheduleDelayedTick(tabId, delayMs, source) {
      if (typeof tabId !== 'number') return false;
      if (!isAnyBackgroundActive()) return false;
      const numericDelay = Number(delayMs);
      const clamped = Number.isFinite(numericDelay)
        ? Math.min(MAX_SCHEDULED_TICK_MS, Math.max(MIN_SCHEDULED_TICK_MS, Math.round(numericDelay)))
        : 1000;
      const now = nowFn();
      const dueAt = now + clamped;
      const existing = scheduledTicks.get(tabId);
      if (existing && existing.dueAt <= dueAt + 120) {
        return true;
      }
      if (existing) {
        clearScheduledTick(tabId);
      }
      const timerId = t.setTimeout(() => {
        scheduledTicks.delete(tabId);
        withLoadedSettings(() => {
          if (isAnyBackgroundActive()) {
            pingTab(tabId, source || 'scheduled');
          }
        });
      }, clamped);
      scheduledTicks.set(tabId, { timerId, dueAt });
      return true;
    }

    function wakeTabRenderer(tabId) {
      if (!api || !api.scripting || typeof api.scripting.executeScript !== 'function') return;
      if (typeof tabId !== 'number') return;
      try {
        const res = api.scripting.executeScript(
          {
            target: { tabId },
            world: 'MAIN',
            func: () => Date.now()
          },
          () => {
            void (api.runtime && api.runtime.lastError);
          }
        );
        if (res && typeof res.catch === 'function') res.catch(() => {});
      } catch (_) {}
    }

    function executeMainWorldClick(tabId, token, attempt, sendResponse, kind) {
      if (
        !api ||
        !api.scripting ||
        typeof api.scripting.executeScript !== 'function' ||
        typeof tabId !== 'number' ||
        typeof token !== 'string' ||
        !token
      ) {
        if (typeof sendResponse === 'function') sendResponse({ ok: false, reason: 'unavailable' });
        return;
      }
      try {
        const res = api.scripting.executeScript(
          {
            target: { tabId },
            world: 'MAIN',
            func: mainWorldClickByToken,
            args: [token, Number(attempt) || 2, typeof kind === 'string' ? kind : '']
          },
          (results) => {
            const err = api.runtime && api.runtime.lastError;
            if (typeof sendResponse === 'function') {
              if (err) {
                sendResponse({ ok: false, error: err.message || 'execute_failed' });
              } else {
                const payload = Array.isArray(results) && results[0] ? results[0].result : null;
                sendResponse({ ok: true, result: payload });
              }
            }
          }
        );
        if (res && typeof res.catch === 'function') {
          res.catch(() => {
            if (typeof sendResponse === 'function') sendResponse({ ok: false, error: 'rejected' });
          });
        }
      } catch (_) {
        if (typeof sendResponse === 'function') sendResponse({ ok: false, error: 'exception' });
      }
    }

    function tickConnectedPorts() {
      if (!isAnyBackgroundActive()) {
        stopHeartbeat();
        return;
      }
      if (ports.size === 0) {
        stopHeartbeat();
        return;
      }
      heartbeatTickCount += 1;
      const now = nowFn();
      for (const tabId of Array.from(ports.keys())) {
        const meta = portMeta.get(tabId);
        const port = ports.get(tabId);
        if (meta && port && !meta.rotateSent && now - meta.connectedAt >= PORT_ROTATE_MS) {
          meta.rotateSent = true;
          try {
            port.postMessage({ type: 'GMAH_ROTATE_PORT', ts: now });
            continue;
          } catch (_) {
            ports.delete(tabId);
            portMeta.delete(tabId);
          }
        }
        // Zombie-port watchdog: if tab hasn't returned PONG in >= 8s, wake renderer + poke via tabs.sendMessage
        if (
          meta &&
          now - meta.lastPongAt >= PONG_TIMEOUT_MS &&
          (!meta.lastRecoveryAt || now - meta.lastRecoveryAt >= PONG_RECOVERY_COOLDOWN_MS)
        ) {
          meta.lastRecoveryAt = now;
          wakeTabRenderer(tabId);
          if (api && api.tabs && typeof api.tabs.sendMessage === 'function') {
            try {
              const res = api.tabs.sendMessage(
                tabId,
                { type: 'GMAH_BG_TICK', source: 'pong_recovery', ts: now },
                () => {
                  const hadErr = Boolean(api.runtime && api.runtime.lastError);
                  if (hadErr) {
                    injectIntoTab(tabId, (ok) => {
                      if (ok) pingTab(tabId, 'post_inject');
                    });
                  }
                }
              );
              if (res && typeof res.catch === 'function') res.catch(() => {});
            } catch (_) {}
          }
        }
        pingTab(tabId, 'heartbeat');
      }
      if (heartbeatTickCount % KEEPALIVE_EVERY_N_TICKS === 0) {
        keepServiceWorkerAlive();
      }
      if (heartbeatTickCount % RESYNC_EVERY_N_TICKS === 0) {
        syncAllGeminiTabs(false, true);
      }
    }

    function startHeartbeat() {
      if (heartbeatTimer !== null) return;
      if (!isAnyBackgroundActive()) return;
      if (ports.size === 0) return;
      heartbeatTickCount = 0;
      heartbeatTimer = t.setInterval(tickConnectedPorts, HEARTBEAT_INTERVAL_MS);
    }

    function stopHeartbeat() {
      if (heartbeatTimer !== null) {
        t.clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
      heartbeatTickCount = 0;
    }

    function ensureAlarm() {
      if (!api || !api.alarms || typeof api.alarms.create !== 'function') return;
      if (isAnyBackgroundActive()) {
        try {
          api.alarms.create(ALARM_NAME, { periodInMinutes: 0.5 });
        } catch (_) {
          // Older Chromium fallback: 1 minute minimum
          try {
            api.alarms.create(ALARM_NAME, { periodInMinutes: 1 });
          } catch (_) {
            // Ignore
          }
        }
      } else if (typeof api.alarms.clear === 'function') {
        api.alarms.clear(ALARM_NAME);
      }
    }

    const STALL_NOTIF_PREFIX = 'gmah_stall_';
    const BREAKER_NOTIF_PREFIX = 'gmah_breaker_';
    const notifTabMap = new Map(); // notificationId -> tabId
    const breakerBadgeMap = new Map(); // tabId -> { text, color }

    function persistBreakerBadges() {
      if (api && api.storage && api.storage.session && typeof api.storage.session.set === 'function') {
        try {
          const entries = Array.from(breakerBadgeMap.entries());
          api.storage.session.set({ gmah_breaker_badges: entries }, () => {
            void (api.runtime && api.runtime.lastError);
          });
        } catch (_) {}
      }
    }

    if (api && api.storage && api.storage.session && typeof api.storage.session.get === 'function') {
      try {
        api.storage.session.get(['gmah_breaker_badges'], (res) => {
          if (res && Array.isArray(res.gmah_breaker_badges)) {
            for (const [tabId, data] of res.gmah_breaker_badges) {
              if (typeof tabId === 'number' && data && !breakerBadgeMap.has(tabId)) {
                breakerBadgeMap.set(tabId, data);
              }
            }
          }
        });
      } catch (_) {}
    }

    function setTabBadge(tabId, text, bgColor) {
      if (!api || !api.action || typeof api.action.setBadgeText !== 'function') return;
      if (typeof tabId !== 'number') return;
      try {
        const res = api.action.setBadgeText({ tabId, text }, () => {
          void (api.runtime && api.runtime.lastError);
        });
        if (res && typeof res.catch === 'function') res.catch(() => {});
        if (text && typeof api.action.setBadgeBackgroundColor === 'function') {
          const colorRes = api.action.setBadgeBackgroundColor({ tabId, color: bgColor || '#ea4335' }, () => {
            void (api.runtime && api.runtime.lastError);
          });
          if (colorRes && typeof colorRes.catch === 'function') colorRes.catch(() => {});
        }
      } catch (_) {
        // Ignore transient tab badge errors
      }
    }

    function showBreakerAlert(tabId, payload) {
      if (typeof tabId !== 'number') return;
      const reasonCode = (payload && payload.reasonCode) || 'breaker';
      const reason = (payload && payload.reason) || '';
      const isEmergency = reasonCode === 'emergency_stop';
      const isModelError = reasonCode === 'model_unavailable';
      const badgeText = isModelError ? 'ERR' : isEmergency ? '!' : '!!';
      const badgeColor = isEmergency || isModelError ? '#ea4335' : '#fbbc04';
      breakerBadgeMap.set(tabId, { text: badgeText, color: badgeColor });
      persistBreakerBadges();
      setTabBadge(tabId, badgeText, badgeColor);

      const shouldNotify = Boolean(payload && payload.notify && settings.stallAlertEnabled && !isEmergency);
      if (!shouldNotify) return;

      const notifId = `${BREAKER_NOTIF_PREFIX}${tabId}`;
      notifTabMap.set(notifId, tabId);
      if (!api || !api.notifications || typeof api.notifications.create !== 'function') return;
      const iconUrl =
        api.runtime && typeof api.runtime.getURL === 'function'
          ? api.runtime.getURL('icons/icon128.png')
          : 'icons/icon128.png';
      try {
        const title = isModelError
          ? trBg('bgNotifModelErrorTitle', null, 'Gemini 默认模型不可用，已报错停止')
          : trBg('bgNotifBreakerTitle', null, 'Gemini 自动助手已触发安全熔断');
        const message = isModelError
          ? trBg(
              'bgNotifModelErrorMsg',
              { reason: reason || reasonCode },
              `${reason || reasonCode}。点击此处切回对应 Gemini 标签页处理。`
            )
          : trBg(
              'bgNotifBreakerMsg',
              { reason: reason || reasonCode },
              `${reason || reasonCode}。点击此处切回对应 Gemini 标签页查看。`
            );
        const res = api.notifications.create(
          notifId,
          {
            type: 'basic',
            iconUrl,
            title,
            message,
            priority: 2,
            requireInteraction: true
          },
          () => {
            void (api.runtime && api.runtime.lastError);
          }
        );
        if (res && typeof res.catch === 'function') res.catch(() => {});
      } catch (_) {
        // Ignore notification errors
      }
    }

    function clearBreakerAlert(tabId, keepBadge) {
      if (typeof tabId !== 'number') return;
      const notifId = `${BREAKER_NOTIF_PREFIX}${tabId}`;
      notifTabMap.delete(notifId);
      if (!keepBadge) {
        breakerBadgeMap.delete(tabId);
        persistBreakerBadges();
        if (notifTabMap.has(`${STALL_NOTIF_PREFIX}${tabId}`)) {
          setTabBadge(tabId, '!', '#ea4335');
        } else {
          setTabBadge(tabId, '');
        }
      }
      if (!api || !api.notifications || typeof api.notifications.clear !== 'function') return;
      try {
        const res = api.notifications.clear(notifId, () => {
          void (api.runtime && api.runtime.lastError);
        });
        if (res && typeof res.catch === 'function') res.catch(() => {});
      } catch (_) {}
    }

    function clearAllBreakerAlerts(keepBadge) {
      const tabIds = new Set(breakerBadgeMap.keys());
      for (const [notifId, tabId] of notifTabMap.entries()) {
        if (notifId.startsWith(BREAKER_NOTIF_PREFIX)) {
          tabIds.add(tabId);
        }
      }
      for (const tabId of tabIds) {
        clearBreakerAlert(tabId, keepBadge);
      }
    }

    function showStallNotification(tabId, payload) {
      if (typeof tabId !== 'number') return;
      const mins = Math.max(1, Number((payload && payload.minutes) || 5));
      const notifId = `${STALL_NOTIF_PREFIX}${tabId}`;
      notifTabMap.set(notifId, tabId);
      setTabBadge(tabId, '!', '#ea4335');

      if (!api || !api.notifications || typeof api.notifications.create !== 'function') return;
      const iconUrl =
        api.runtime && typeof api.runtime.getURL === 'function'
          ? api.runtime.getURL('icons/icon128.png')
          : 'icons/icon128.png';
      try {
        const res = api.notifications.create(
          notifId,
          {
            type: 'basic',
            iconUrl,
            title: trBg('bgNotifStallTitle', { mins }, `Gemini 连接已超过 ${mins} 分钟`),
            message: trBg(
              'bgNotifStallMsg',
              { mins },
              `检测到该对话连续连接/等待超过 ${mins} 分钟仍无新进展，点击此处立即切回对应标签页检查。`
            ),
            priority: 2,
            requireInteraction: true
          },
          () => {
            void (api.runtime && api.runtime.lastError);
          }
        );
        if (res && typeof res.catch === 'function') res.catch(() => {});
      } catch (_) {
        // Ignore notification errors
      }
    }

    function clearStallNotification(tabId) {
      if (typeof tabId !== 'number') return;
      const notifId = `${STALL_NOTIF_PREFIX}${tabId}`;
      notifTabMap.delete(notifId);
      const activeBreakerBadge = breakerBadgeMap.get(tabId);
      if (activeBreakerBadge) {
        setTabBadge(tabId, activeBreakerBadge.text, activeBreakerBadge.color);
      } else {
        setTabBadge(tabId, '');
      }
      if (!api || !api.notifications || typeof api.notifications.clear !== 'function') return;
      try {
        const res = api.notifications.clear(notifId, () => {
          void (api.runtime && api.runtime.lastError);
        });
        if (res && typeof res.catch === 'function') res.catch(() => {});
      } catch (_) {
        // Ignore
      }
    }

    function clearAllStallNotifications() {
      const stallTabIds = [];
      for (const [notifId, tabId] of notifTabMap.entries()) {
        if (notifId.startsWith(STALL_NOTIF_PREFIX)) {
          stallTabIds.push(tabId);
        }
      }
      for (const tabId of stallTabIds) {
        clearStallNotification(tabId);
      }
    }

    function showTestNotification(sendResponse) {
      if (!api || !api.notifications || typeof api.notifications.create !== 'function') {
        if (typeof sendResponse === 'function') sendResponse({ ok: false, error: 'notifications_unavailable' });
        return;
      }
      const iconUrl =
        api.runtime && typeof api.runtime.getURL === 'function'
          ? api.runtime.getURL('icons/icon128.png')
          : 'icons/icon128.png';
      try {
        const res = api.notifications.create(
          `gmah_test_${Date.now()}`,
          {
            type: 'basic',
            iconUrl,
            title: trBg('bgNotifTestTitle', null, 'KenEasy Gemini MCP 助手 · 桌面通知正常'),
            message: trBg(
              'bgNotifTestMsg',
              null,
              '当 Gemini 连接或等待超时无进展时，系统将弹出此类提醒，点击即可切回对应标签页。'
            ),
            priority: 2
          },
          () => {
            const err = api.runtime && api.runtime.lastError;
            if (typeof sendResponse === 'function') {
              sendResponse(err ? { ok: false, error: err.message || 'failed' } : { ok: true });
            }
          }
        );
        if (res && typeof res.catch === 'function') {
          res.catch(() => {
            if (typeof sendResponse === 'function') sendResponse({ ok: false, error: 'failed' });
          });
        }
      } catch (_) {
        if (typeof sendResponse === 'function') sendResponse({ ok: false, error: 'exception' });
      }
    }

    function focusWindowForTab(windowId) {
      if (typeof windowId !== 'number' || !api || !api.windows || typeof api.windows.update !== 'function') {
        return;
      }
      const doFocus = (props) => {
        try {
          const winRes = api.windows.update(windowId, props, () => {
            void (api.runtime && api.runtime.lastError);
          });
          if (winRes && typeof winRes.catch === 'function') winRes.catch(() => {});
        } catch (_) {}
      };

      if (typeof api.windows.get === 'function') {
        try {
          api.windows.get(windowId, (win) => {
            if (api.runtime && api.runtime.lastError) {
              doFocus({ focused: true });
              return;
            }
            const props = { focused: true };
            if (win && win.state === 'minimized') {
              props.state = 'normal';
            }
            doFocus(props);
          });
        } catch (_) {
          doFocus({ focused: true });
        }
      } else {
        doFocus({ focused: true });
      }
    }

    function handleNotificationClicked(notifId) {
      if (typeof notifId !== 'string') return;
      const isStall = notifId.startsWith(STALL_NOTIF_PREFIX);
      const isBreaker = notifId.startsWith(BREAKER_NOTIF_PREFIX);
      if (!isStall && !isBreaker) return;

      const prefix = isStall ? STALL_NOTIF_PREFIX : BREAKER_NOTIF_PREFIX;
      let tabId = notifTabMap.get(notifId);
      if (typeof tabId !== 'number') {
        const parsed = Number(notifId.slice(prefix.length));
        if (Number.isFinite(parsed)) tabId = parsed;
      }
      if (typeof tabId !== 'number') return;

      if (isStall) {
        clearStallNotification(tabId);
      } else {
        clearBreakerAlert(tabId);
      }
      if (!api || !api.tabs) return;
      try {
        if (typeof api.tabs.get === 'function') {
          api.tabs.get(tabId, (tab) => {
            if (api.runtime && api.runtime.lastError) return;
            if (tab && typeof tab.windowId === 'number') {
              focusWindowForTab(tab.windowId);
            }
            if (typeof api.tabs.update === 'function') {
              try {
                const tabRes = api.tabs.update(tabId, { active: true }, () => {
                  void (api.runtime && api.runtime.lastError);
                });
                if (tabRes && typeof tabRes.catch === 'function') tabRes.catch(() => {});
              } catch (_) {}
            }
          });
        } else if (typeof api.tabs.update === 'function') {
          api.tabs.update(tabId, { active: true }, () => {
            void (api.runtime && api.runtime.lastError);
          });
        }
      } catch (_) {
        // Ignore
      }
    }

    function handleTabRemoved(tabId) {
      ports.delete(tabId);
      portMeta.delete(tabId);
      clearScheduledTick(tabId);
      if (ports.size === 0) {
        stopHeartbeat();
      }
      clearStallNotification(tabId);
      clearBreakerAlert(tabId);
    }

    function handleTabActivated() {
      withLoadedSettings(() => {
        if (!isAnyBackgroundActive()) return;
        ensureAlarm();
        keepServiceWorkerAlive();
        if (ports.size > 0 && heartbeatTimer === null) {
          startHeartbeat();
        }
        syncAllGeminiTabs(true, true);
      });
    }

    function handleWindowFocusChanged(windowId) {
      withLoadedSettings(() => {
        if (!isAnyBackgroundActive()) return;
        ensureAlarm();
        keepServiceWorkerAlive();
        if (ports.size > 0 && heartbeatTimer === null) {
          startHeartbeat();
        }
        syncAllGeminiTabs(true, true);
        // When Chrome loses focus or is minimized (WINDOW_ID_NONE === -1), schedule a fast follow-up wake tick
        if (windowId === -1) {
          for (const tabId of ports.keys()) {
            const meta = portMeta.get(tabId);
            if (!meta || !meta.url || isTabBackgroundActive(meta.url)) {
              scheduleDelayedTick(tabId, 1200, 'window_minimized_followup');
            }
          }
        }
      });
    }

    function handleRuntimeMessage(msg, sender, sendResponse) {
      if (!msg || typeof msg !== 'object') return;
      const tabId = sender && sender.tab && sender.tab.id;
      const tabUrl = sender && sender.tab && sender.tab.url;
      if (msg.type === 'GMAH_SCHEDULE_TICK' && typeof tabId === 'number') {
        withLoadedSettings(() => {
          const ok = scheduleDelayedTick(tabId, msg.delayMs, msg.reason || 'scheduled');
          if (typeof sendResponse === 'function') sendResponse({ ok });
        });
        return true;
      } else if (msg.type === 'GMAH_MAIN_WORLD_CLICK' && typeof tabId === 'number') {
        executeMainWorldClick(tabId, msg.token, msg.attempt, sendResponse, msg.kind);
        return true;
      } else if (msg.type === 'GMAH_TAB_KEEPALIVE' && typeof tabId === 'number') {
        withLoadedSettings(() => {
          applyDiscardProtection(tabId, tabUrl);
          ensureAlarm();
          if (isAnyBackgroundActive()) {
            keepServiceWorkerAlive();
            if (ports.size > 0 && heartbeatTimer === null) {
              startHeartbeat();
            }
            if (!ports.has(tabId)) {
              pingTab(tabId, 'keepalive_sync');
            }
          }
          if (typeof sendResponse === 'function') sendResponse({ ok: true, connected: ports.has(tabId) });
        });
        return true;
      } else if (msg.type === 'GMAH_STALL_ALERT' && typeof tabId === 'number') {
        showStallNotification(tabId, msg);
        if (typeof sendResponse === 'function') sendResponse({ ok: true });
      } else if (msg.type === 'GMAH_STALL_CLEAR' && typeof tabId === 'number') {
        clearStallNotification(tabId);
        if (typeof sendResponse === 'function') sendResponse({ ok: true });
      } else if (msg.type === 'GMAH_BREAKER_ALERT' && typeof tabId === 'number') {
        withLoadedSettings(() => {
          showBreakerAlert(tabId, msg);
          if (typeof sendResponse === 'function') sendResponse({ ok: true });
        });
        return true;
      } else if (msg.type === 'GMAH_BREAKER_CLEAR' && typeof tabId === 'number') {
        clearBreakerAlert(tabId);
        if (typeof sendResponse === 'function') sendResponse({ ok: true });
      } else if (msg.type === 'GMAH_CLEAR_ALL_STALL_NOTIFICATIONS') {
        clearAllStallNotifications();
        clearAllBreakerAlerts(true);
        if (typeof sendResponse === 'function') sendResponse({ ok: true });
      } else if (msg.type === 'GMAH_TEST_NOTIFICATION') {
        showTestNotification(sendResponse);
        return true;
      }
    }

    function handleConnect(port) {
      if (!port || port.name !== 'gmah-tab') return;
      const tabId = port.sender && port.sender.tab && port.sender.tab.id;
      if (typeof tabId !== 'number') return;

      ports.set(tabId, port);
      const connectedNow = nowFn();
      const senderUrl = port.sender && port.sender.tab && port.sender.tab.url ? port.sender.tab.url : '';
      portMeta.set(tabId, { connectedAt: connectedNow, lastPongAt: connectedNow, rotateSent: false, url: senderUrl });

      port.onMessage.addListener((msg) => {
        if (!msg || typeof msg !== 'object') return;
        if (msg.type === 'GMAH_TAB_HELLO') {
          const meta = portMeta.get(tabId);
          if (meta && typeof msg.url === 'string' && msg.url) {
            meta.url = msg.url;
          }
          if (!msg.stallAlertActive) {
            clearStallNotification(tabId);
          }
          if (
            !msg.breakerTripped &&
            (breakerBadgeMap.has(tabId) || notifTabMap.has(`${BREAKER_NOTIF_PREFIX}${tabId}`))
          ) {
            clearBreakerAlert(tabId);
          }
          withLoadedSettings(() => {
            applyDiscardProtection(tabId, msg.url);
            pingTab(tabId, 'hello_ack');
          });
        } else if (msg.type === 'GMAH_TAB_PONG') {
          // Two-way port traffic keeps the MV3 service worker awake while monitoring in background
          const meta = portMeta.get(tabId);
          if (meta) meta.lastPongAt = nowFn();
          void msg.ts;
        } else if (msg.type === 'GMAH_SCHEDULE_TICK') {
          withLoadedSettings(() => {
            scheduleDelayedTick(tabId, msg.delayMs, msg.reason || 'scheduled');
          });
        } else if (msg.type === 'GMAH_MAIN_WORLD_CLICK') {
          executeMainWorldClick(tabId, msg.token, msg.attempt, null, msg.kind);
        } else if (msg.type === 'GMAH_STALL_ALERT') {
          showStallNotification(tabId, msg);
        } else if (msg.type === 'GMAH_STALL_CLEAR') {
          clearStallNotification(tabId);
        } else if (msg.type === 'GMAH_BREAKER_ALERT') {
          withLoadedSettings(() => {
            showBreakerAlert(tabId, msg);
          });
        } else if (msg.type === 'GMAH_BREAKER_CLEAR') {
          clearBreakerAlert(tabId);
        } else if (msg.type === 'GMAH_CLEAR_ALL_STALL_NOTIFICATIONS') {
          clearAllStallNotifications();
          clearAllBreakerAlerts(true);
        }
      });

      port.onDisconnect.addListener(() => {
        if (ports.get(tabId) === port) {
          ports.delete(tabId);
          portMeta.delete(tabId);
        }
        if (ports.size === 0) {
          stopHeartbeat();
        }
      });

      withLoadedSettings(() => {
        if (ports.get(tabId) !== port) return;
        applyDiscardProtection(tabId);
        ensureAlarm();
        if (isAnyBackgroundActive()) {
          startHeartbeat();
        } else {
          stopHeartbeat();
        }
      });
    }

    function handleAlarm(alarm) {
      if (!alarm || alarm.name !== ALARM_NAME) return;
      loadSettings(() => {
        syncAllGeminiTabs(true, true);
        if (isAnyBackgroundActive() && ports.size > 0 && heartbeatTimer === null) {
          startHeartbeat();
        }
      });
    }

    function handleTabUpdated(tabId, changeInfo, tab) {
      const url = (changeInfo && changeInfo.url) || (tab && tab.url);
      if (!isGeminiUrl(url)) {
        if (
          url &&
          (ports.has(tabId) ||
            portMeta.has(tabId) ||
            scheduledTicks.has(tabId) ||
            breakerBadgeMap.has(tabId) ||
            notifTabMap.has(`${STALL_NOTIF_PREFIX}${tabId}`))
        ) {
          handleTabRemoved(tabId);
        }
        return;
      }
      if (portMeta.has(tabId) && url) {
        portMeta.get(tabId).url = url;
      }
      const meaningfulChange =
        !changeInfo ||
        Boolean(changeInfo.url) ||
        changeInfo.status === 'complete' ||
        changeInfo.discarded === false;
      if (!meaningfulChange) return;
      withLoadedSettings(() => {
        applyDiscardProtection(tabId, url);
        if (changeInfo && changeInfo.status === 'complete' && isTabBackgroundActive(url) && !ports.has(tabId)) {
          ensureTabInjected(tabId);
        }
      });
    }

    function handleStorageChanged(changes, area) {
      if (area !== 'local' || !changes) return;
      let shouldResync = false;
      if (changes[STORAGE_KEY] && changes[STORAGE_KEY].newValue) {
        applyRawSettings(changes[STORAGE_KEY].newValue);
        if (!settings.enabled && !isAnyBackgroundActive()) {
          clearAllStallNotifications();
          clearAllBreakerAlerts(false);
        } else if (!settings.stallAlertEnabled) {
          clearAllStallNotifications();
          clearAllBreakerAlerts(true);
        }
        shouldResync = true;
      }
      if (Object.prototype.hasOwnProperty.call(changes, CHAT_OVERRIDES_KEY)) {
        applyRawChatOverrides(changes[CHAT_OVERRIDES_KEY] ? changes[CHAT_OVERRIDES_KEY].newValue : {});
        shouldResync = true;
      }
      if (shouldResync) {
        ensureAlarm();
        if (isAnyBackgroundActive() && ports.size > 0) {
          startHeartbeat();
        } else {
          stopHeartbeat();
          if (!isAnyBackgroundActive()) {
            clearAllScheduledTicks();
          }
        }
        syncAllGeminiTabs(false);
      }
    }

    function init() {
      loadSettings(() => {
        ensureAlarm();
        syncAllGeminiTabs(false, true);
      });

      if (!api) return;
      if (api.runtime && api.runtime.onConnect) {
        api.runtime.onConnect.addListener(handleConnect);
      }
      if (api.runtime && api.runtime.onMessage) {
        api.runtime.onMessage.addListener(handleRuntimeMessage);
      }
      if (api.alarms && api.alarms.onAlarm) {
        api.alarms.onAlarm.addListener(handleAlarm);
      }
      if (api.tabs && api.tabs.onUpdated) {
        api.tabs.onUpdated.addListener(handleTabUpdated);
      }
      if (api.tabs && api.tabs.onRemoved) {
        api.tabs.onRemoved.addListener(handleTabRemoved);
      }
      if (api.tabs && api.tabs.onActivated) {
        api.tabs.onActivated.addListener(handleTabActivated);
      }
      if (api.windows && api.windows.onFocusChanged) {
        api.windows.onFocusChanged.addListener(handleWindowFocusChanged);
      }
      if (api.notifications && api.notifications.onClicked) {
        api.notifications.onClicked.addListener(handleNotificationClicked);
      }
      if (api.storage && api.storage.onChanged) {
        api.storage.onChanged.addListener(handleStorageChanged);
      }
      if (api.runtime && api.runtime.onInstalled) {
        api.runtime.onInstalled.addListener(() => {
          loadSettings(() => {
            ensureAlarm();
            syncAllGeminiTabs(false, true);
          });
        });
      }
      if (api.runtime && api.runtime.onStartup) {
        api.runtime.onStartup.addListener(() => {
          loadSettings(() => {
            ensureAlarm();
            syncAllGeminiTabs(false, true);
          });
        });
      }
    }

    return {
      init,
      handleConnect,
      handleRuntimeMessage,
      handleNotificationClicked,
      handleAlarm,
      handleTabUpdated,
      handleTabRemoved,
      handleTabActivated,
      handleWindowFocusChanged,
      handleStorageChanged,
      syncAllGeminiTabs,
      injectIntoTab,
      scheduleDelayedTick,
      clearScheduledTick,
      keepServiceWorkerAlive,
      tickConnectedPorts,
      clearAllStallNotifications,
      clearStallNotification,
      showBreakerAlert,
      clearBreakerAlert,
      clearAllBreakerAlerts,
      executeMainWorldClick,
      wakeTabRenderer,
      getConnectedTabIds: () => Array.from(ports.keys()),
      getScheduledTickTabIds: () => Array.from(scheduledTicks.keys()),
      getPortMeta: (tabId) => (portMeta.has(tabId) ? Object.assign({}, portMeta.get(tabId)) : null),
      isHeartbeatRunning: () => heartbeatTimer !== null,
      isAnyBackgroundActive,
      isTabBackgroundActive,
      getSettings: () => Object.assign({}, settings),
      getChatOverrides: () => Object.assign({}, chatOverrides),
      ALARM_NAME,
      PORT_ROTATE_MS,
      STALL_NOTIF_PREFIX,
      BREAKER_NOTIF_PREFIX
    };
  }

  root.GMAH_BG = { createBackgroundController, mainWorldClickByToken, isGeminiUrl, ALARM_NAME, PORT_ROTATE_MS };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = root.GMAH_BG;
  }

  // Auto-init inside real Chrome MV3 Service Worker
  if (
    typeof chrome !== 'undefined' &&
    chrome.runtime &&
    chrome.runtime.id &&
    typeof window === 'undefined'
  ) {
    const controller = createBackgroundController(chrome);
    controller.init();
  }
})(typeof globalThis !== 'undefined' ? globalThis : self);
