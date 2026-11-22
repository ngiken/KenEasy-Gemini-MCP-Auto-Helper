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
  const HEARTBEAT_INTERVAL_MS = 1500;
  const KEEPALIVE_EVERY_N_TICKS = 13; // ~19.5s: resets Chrome MV3 30s SW idle timer
  const RESYNC_EVERY_N_TICKS = 10; // ~15s: rediscovers any unattached Gemini tabs
  const PORT_ROTATE_MS = 4 * 60 * 1000; // Rotate long-lived MV3 port before Chrome's 5-min hard disconnect
  const MIN_SCHEDULED_TICK_MS = 150;
  const MAX_SCHEDULED_TICK_MS = 30000;

  function isGeminiUrl(url) {
    return typeof url === 'string' && /^https:\/\/gemini\.google\.com(\/|$|\?)/i.test(url);
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

    function loadSettings(cb) {
      if (!api || !api.storage || !api.storage.local) {
        settingsLoaded = true;
        if (cb) cb(settings);
        return;
      }
      api.storage.local.get([STORAGE_KEY], (res) => {
        const raw = res && res[STORAGE_KEY];
        applyRawSettings(raw);
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

    function applyDiscardProtection(tabId) {
      if (!api || !api.tabs || typeof api.tabs.update !== 'function') return;
      if (typeof tabId !== 'number') return;
      const shouldProtect = Boolean(
        settings.enabled && settings.backgroundMode && settings.preventTabDiscard
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
          for (const tab of tabs) {
            if (!tab || typeof tab.id !== 'number') continue;
            if (tab.url && !isGeminiUrl(tab.url)) continue;
            applyDiscardProtection(tab.id);
            if (tab.discarded) continue;
            if (sendTick && settings.enabled && settings.backgroundMode) {
              // pingTab already probes via port or sendMessage and falls back to injectIntoTab if missing
              pingTab(tab.id, 'alarm');
            } else if (autoInject && !ports.has(tab.id)) {
              ensureTabInjected(tab.id);
            }
          }
        });
      } catch (_) {
        // Ignore
      }
    }

    function pingTab(tabId, source) {
      if (!settings.enabled || !settings.backgroundMode) return;
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
      if (!settings.enabled || !settings.backgroundMode) return false;
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
          if (settings.enabled && settings.backgroundMode) {
            pingTab(tabId, source || 'scheduled');
          }
        });
      }, clamped);
      scheduledTicks.set(tabId, { timerId, dueAt });
      return true;
    }

    function tickConnectedPorts() {
      if (!settings.enabled || !settings.backgroundMode) {
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
          } catch (_) {
            ports.delete(tabId);
            portMeta.delete(tabId);
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
      if (!settings.enabled || !settings.backgroundMode) return;
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
      if (settings.enabled && settings.backgroundMode) {
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
    const notifTabMap = new Map(); // notificationId -> tabId

    function setTabBadge(tabId, text) {
      if (!api || !api.action || typeof api.action.setBadgeText !== 'function') return;
      if (typeof tabId !== 'number') return;
      try {
        const res = api.action.setBadgeText({ tabId, text }, () => {
          void (api.runtime && api.runtime.lastError);
        });
        if (res && typeof res.catch === 'function') res.catch(() => {});
        if (text && typeof api.action.setBadgeBackgroundColor === 'function') {
          const colorRes = api.action.setBadgeBackgroundColor({ tabId, color: '#ea4335' }, () => {
            void (api.runtime && api.runtime.lastError);
          });
          if (colorRes && typeof colorRes.catch === 'function') colorRes.catch(() => {});
        }
      } catch (_) {
        // Ignore transient tab badge errors
      }
    }

    function showStallNotification(tabId, payload) {
      if (typeof tabId !== 'number') return;
      const mins = Math.max(1, Number((payload && payload.minutes) || 5));
      const notifId = `${STALL_NOTIF_PREFIX}${tabId}`;
      notifTabMap.set(notifId, tabId);
      setTabBadge(tabId, '!');

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
      setTabBadge(tabId, '');
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
      for (const tabId of Array.from(notifTabMap.values())) {
        clearStallNotification(tabId);
      }
      notifTabMap.clear();
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
      if (typeof notifId !== 'string' || !notifId.startsWith(STALL_NOTIF_PREFIX)) return;
      let tabId = notifTabMap.get(notifId);
      if (typeof tabId !== 'number') {
        const parsed = Number(notifId.slice(STALL_NOTIF_PREFIX.length));
        if (Number.isFinite(parsed)) tabId = parsed;
      }
      if (typeof tabId !== 'number') return;

      clearStallNotification(tabId);
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
    }

    function handleTabActivated() {
      withLoadedSettings(() => {
        if (!settings.enabled || !settings.backgroundMode) return;
        ensureAlarm();
        syncAllGeminiTabs(true, true);
      });
    }

    function handleWindowFocusChanged() {
      withLoadedSettings(() => {
        if (!settings.enabled || !settings.backgroundMode) return;
        ensureAlarm();
        syncAllGeminiTabs(true, true);
      });
    }

    function handleRuntimeMessage(msg, sender, sendResponse) {
      if (!msg || typeof msg !== 'object') return;
      const tabId = sender && sender.tab && sender.tab.id;
      if (msg.type === 'GMAH_SCHEDULE_TICK' && typeof tabId === 'number') {
        withLoadedSettings(() => {
          const ok = scheduleDelayedTick(tabId, msg.delayMs, msg.reason || 'scheduled');
          if (typeof sendResponse === 'function') sendResponse({ ok });
        });
        return true;
      } else if (msg.type === 'GMAH_TAB_KEEPALIVE' && typeof tabId === 'number') {
        withLoadedSettings(() => {
          applyDiscardProtection(tabId);
          ensureAlarm();
          if (settings.enabled && settings.backgroundMode) {
            keepServiceWorkerAlive();
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
      } else if (msg.type === 'GMAH_CLEAR_ALL_STALL_NOTIFICATIONS') {
        clearAllStallNotifications();
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
      portMeta.set(tabId, { connectedAt: connectedNow, lastPongAt: connectedNow, rotateSent: false });

      port.onMessage.addListener((msg) => {
        if (!msg || typeof msg !== 'object') return;
        if (msg.type === 'GMAH_TAB_HELLO') {
          if (!msg.stallAlertActive) {
            clearStallNotification(tabId);
          }
          withLoadedSettings(() => {
            applyDiscardProtection(tabId);
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
        } else if (msg.type === 'GMAH_STALL_ALERT') {
          showStallNotification(tabId, msg);
        } else if (msg.type === 'GMAH_STALL_CLEAR') {
          clearStallNotification(tabId);
        } else if (msg.type === 'GMAH_CLEAR_ALL_STALL_NOTIFICATIONS') {
          clearAllStallNotifications();
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
        if (settings.enabled && settings.backgroundMode) {
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
      });
    }

    function handleTabUpdated(tabId, changeInfo, tab) {
      const url = (changeInfo && changeInfo.url) || (tab && tab.url);
      if (!isGeminiUrl(url)) return;
      const meaningfulChange =
        !changeInfo ||
        Boolean(changeInfo.url) ||
        changeInfo.status === 'complete' ||
        changeInfo.discarded === false;
      if (!meaningfulChange) return;
      withLoadedSettings(() => {
        applyDiscardProtection(tabId);
        if (changeInfo && changeInfo.status === 'complete' && settings.enabled && settings.backgroundMode && !ports.has(tabId)) {
          ensureTabInjected(tabId);
        }
      });
    }

    function handleStorageChanged(changes, area) {
      if (area !== 'local') return;
      if (changes && changes[STORAGE_KEY] && changes[STORAGE_KEY].newValue) {
        applyRawSettings(changes[STORAGE_KEY].newValue);
        if (!settings.enabled || !settings.stallAlertEnabled) {
          clearAllStallNotifications();
        }
        ensureAlarm();
        if (settings.enabled && settings.backgroundMode && ports.size > 0) {
          startHeartbeat();
        } else {
          stopHeartbeat();
          if (!settings.enabled || !settings.backgroundMode) {
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
      getConnectedTabIds: () => Array.from(ports.keys()),
      getScheduledTickTabIds: () => Array.from(scheduledTicks.keys()),
      getPortMeta: (tabId) => (portMeta.has(tabId) ? Object.assign({}, portMeta.get(tabId)) : null),
      isHeartbeatRunning: () => heartbeatTimer !== null,
      getSettings: () => Object.assign({}, settings),
      ALARM_NAME,
      PORT_ROTATE_MS,
      STALL_NOTIF_PREFIX
    };
  }

  root.GMAH_BG = { createBackgroundController, isGeminiUrl, ALARM_NAME, PORT_ROTATE_MS };
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
