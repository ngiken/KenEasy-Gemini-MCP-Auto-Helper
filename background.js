(function (root) {
  'use strict';

  const GEMINI_URL_PATTERN = 'https://gemini.google.com/*';
  const ALARM_NAME = 'gmah_bg_keepalive';
  const STORAGE_KEY = 'gmah_settings_v1';
  const HEARTBEAT_INTERVAL_MS = 1500;

  function isGeminiUrl(url) {
    return typeof url === 'string' && /^https:\/\/gemini\.google\.com(\/|$|\?)/i.test(url);
  }

  function createBackgroundController(chromeApi, timers) {
    const api = chromeApi || (typeof chrome !== 'undefined' ? chrome : null);
    const t = timers || { setInterval, clearInterval };
    const ports = new Map(); // tabId -> port
    let heartbeatTimer = null;
    let settingsLoaded = false;
    let settings = {
      enabled: true,
      backgroundMode: true,
      preventTabDiscard: true
    };

    function loadSettings(cb) {
      if (!api || !api.storage || !api.storage.local) {
        settingsLoaded = true;
        if (cb) cb(settings);
        return;
      }
      api.storage.local.get([STORAGE_KEY], (res) => {
        const raw = res && res[STORAGE_KEY];
        if (raw && typeof raw === 'object') {
          settings = {
            enabled: typeof raw.enabled === 'boolean' ? raw.enabled : true,
            backgroundMode: typeof raw.backgroundMode === 'boolean' ? raw.backgroundMode : true,
            preventTabDiscard:
              typeof raw.preventTabDiscard === 'boolean' ? raw.preventTabDiscard : true
          };
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

    function syncAllGeminiTabs(sendTick) {
      if (!api || !api.tabs || typeof api.tabs.query !== 'function') return;
      try {
        api.tabs.query({ url: GEMINI_URL_PATTERN }, (tabs) => {
          if (api.runtime && api.runtime.lastError) return;
          if (!Array.isArray(tabs)) return;
          for (const tab of tabs) {
            if (!tab || typeof tab.id !== 'number') continue;
            applyDiscardProtection(tab.id);
            if (sendTick && settings.enabled && settings.backgroundMode) {
              pingTab(tab.id, 'alarm');
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
          port.postMessage({ type: 'GMAH_BG_TICK', source, ts: Date.now() });
          return;
        } catch (_) {
          ports.delete(tabId);
        }
      }
      if (api && api.tabs && typeof api.tabs.sendMessage === 'function') {
        try {
          const res = api.tabs.sendMessage(
            tabId,
            { type: 'GMAH_BG_TICK', source, ts: Date.now() },
            () => {
              void (api.runtime && api.runtime.lastError);
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

    function tickConnectedPorts() {
      if (!settings.enabled || !settings.backgroundMode) {
        stopHeartbeat();
        return;
      }
      if (ports.size === 0) {
        stopHeartbeat();
        return;
      }
      for (const tabId of Array.from(ports.keys())) {
        pingTab(tabId, 'heartbeat');
      }
    }

    function startHeartbeat() {
      if (heartbeatTimer !== null) return;
      if (!settings.enabled || !settings.backgroundMode) return;
      if (ports.size === 0) return;
      heartbeatTimer = t.setInterval(tickConnectedPorts, HEARTBEAT_INTERVAL_MS);
    }

    function stopHeartbeat() {
      if (heartbeatTimer !== null) {
        t.clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
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

    function handleConnect(port) {
      if (!port || port.name !== 'gmah-tab') return;
      const tabId = port.sender && port.sender.tab && port.sender.tab.id;
      if (typeof tabId !== 'number') return;

      ports.set(tabId, port);

      port.onMessage.addListener((msg) => {
        if (!msg || typeof msg !== 'object') return;
        if (msg.type === 'GMAH_TAB_HELLO') {
          withLoadedSettings(() => {
            applyDiscardProtection(tabId);
            pingTab(tabId, 'hello_ack');
          });
        } else if (msg.type === 'GMAH_TAB_PONG') {
          // Two-way port traffic keeps the MV3 service worker awake while monitoring in background
          void msg.ts;
        }
      });

      port.onDisconnect.addListener(() => {
        if (ports.get(tabId) === port) {
          ports.delete(tabId);
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
        syncAllGeminiTabs(true);
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
      });
    }

    function handleStorageChanged(changes, area) {
      if (area !== 'local') return;
      if (changes && changes[STORAGE_KEY] && changes[STORAGE_KEY].newValue) {
        const raw = changes[STORAGE_KEY].newValue;
        settings = {
          enabled: typeof raw.enabled === 'boolean' ? raw.enabled : true,
          backgroundMode: typeof raw.backgroundMode === 'boolean' ? raw.backgroundMode : true,
          preventTabDiscard:
            typeof raw.preventTabDiscard === 'boolean' ? raw.preventTabDiscard : true
        };
        ensureAlarm();
        if (settings.enabled && settings.backgroundMode && ports.size > 0) {
          startHeartbeat();
        } else {
          stopHeartbeat();
        }
        syncAllGeminiTabs(false);
      }
    }

    function init() {
      loadSettings(() => {
        ensureAlarm();
        syncAllGeminiTabs(false);
      });

      if (!api) return;
      if (api.runtime && api.runtime.onConnect) {
        api.runtime.onConnect.addListener(handleConnect);
      }
      if (api.alarms && api.alarms.onAlarm) {
        api.alarms.onAlarm.addListener(handleAlarm);
      }
      if (api.tabs && api.tabs.onUpdated) {
        api.tabs.onUpdated.addListener(handleTabUpdated);
      }
      if (api.storage && api.storage.onChanged) {
        api.storage.onChanged.addListener(handleStorageChanged);
      }
      if (api.runtime && api.runtime.onInstalled) {
        api.runtime.onInstalled.addListener(() => {
          loadSettings(() => {
            ensureAlarm();
            syncAllGeminiTabs(false);
          });
        });
      }
      if (api.runtime && api.runtime.onStartup) {
        api.runtime.onStartup.addListener(() => {
          loadSettings(() => {
            ensureAlarm();
            syncAllGeminiTabs(false);
          });
        });
      }
    }

    return {
      init,
      handleConnect,
      handleAlarm,
      handleTabUpdated,
      handleStorageChanged,
      syncAllGeminiTabs,
      tickConnectedPorts,
      getConnectedTabIds: () => Array.from(ports.keys()),
      isHeartbeatRunning: () => heartbeatTimer !== null,
      getSettings: () => Object.assign({}, settings),
      ALARM_NAME
    };
  }

  root.GMAH_BG = { createBackgroundController, isGeminiUrl, ALARM_NAME };
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
