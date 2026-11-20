(function (root) {
  'use strict';

  const D =
    root.GMAH_DEFAULTS ||
    (typeof require === 'function' ? require('./defaults.js') : null);

  function createPopupController(doc, chromeApi) {
    const d = doc || (typeof document !== 'undefined' ? document : null);
    const api = chromeApi || (typeof chrome !== 'undefined' ? chrome : null);
    let toastTimer = null;
    let currentSettings = D.mergeSettings(D.DEFAULT_SETTINGS);

    function byId(id) {
      return d ? d.getElementById(id) : null;
    }

    function showToast(msg, isError) {
      const el = byId('toast');
      if (!el) return;
      el.textContent = msg;
      el.style.color = isError ? '#f28b82' : '#81c995';
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(() => {
        el.textContent = '';
      }, 2400);
    }

    function renderSettings(settings) {
      const s = D.mergeSettings(settings);
      currentSettings = s;
      const boolIds = [
        'enabled',
        'autoAllow',
        'preferAlwaysAllow',
        'fallbackSingleAllow',
        'autoContinue',
        'backgroundMode',
        'preventTabDiscard',
        'showHud',
        'stopOnCompletionCues',
        'stopOnStagnantOutput',
        'stopOnQuotaOrError'
      ];
      for (const id of boolIds) {
        const el = byId(id);
        if (el) el.checked = Boolean(s[id]);
      }

      const setVal = (id, val) => {
        const el = byId(id);
        if (el) el.value = String(val);
      };
      setVal('maxContinuesPerTask', s.maxContinuesPerTask);
      setVal('dailyContinueLimit', s.dailyContinueLimit);
      setVal('continueCooldownSec', Number((s.continueCooldownMs / 1000).toFixed(1)));
      setVal('idleSettleSec', Number((s.idleSettleMs / 1000).toFixed(1)));
      setVal('customAlwaysAllowKeywords', (s.customAlwaysAllowKeywords || []).join('\n'));
      setVal('customContinueKeywords', (s.customContinueKeywords || []).join('\n'));
    }

    function renderStats(stats, settings) {
      const st = D.normalizeStats(stats);
      const s = D.mergeSettings(settings);
      const allowEl = byId('statAllow');
      const contEl = byId('statContinue');
      if (allowEl) allowEl.textContent = String(st.allowCount);
      if (contEl) contEl.textContent = `${st.continueCount} / ${s.dailyContinueLimit}`;
    }

    function renderLiveStatus(tabState) {
      const liveEl = byId('statLive');
      if (!liveEl) return;
      if (!tabState) {
        liveEl.textContent = '未打开 Gemini';
        liveEl.className = '';
        return;
      }
      if (tabState.circuitBreaker && tabState.circuitBreaker.tripped) {
        liveEl.textContent = '已熔断';
        liveEl.className = 'badge-stop';
      } else if (!tabState.settings || !tabState.settings.enabled) {
        liveEl.textContent = '已暂停';
        liveEl.className = 'badge-warn';
      } else {
        liveEl.textContent = tabState.settings.backgroundMode ? '后台就绪' : '监控中';
        liveEl.className = 'badge-ok';
      }
    }

    function readSettingsFromForm() {
      const getBool = (id, fallback) => {
        const el = byId(id);
        return el ? Boolean(el.checked) : fallback;
      };
      const getNum = (id, fallback) => {
        const el = byId(id);
        if (!el) return fallback;
        const n = Number(el.value);
        return Number.isFinite(n) ? n : fallback;
      };
      const getStr = (id) => {
        const el = byId(id);
        return el ? String(el.value || '') : '';
      };

      const cooldownSec = getNum('continueCooldownSec', D.DEFAULT_SETTINGS.continueCooldownMs / 1000);
      const settleSec = getNum('idleSettleSec', D.DEFAULT_SETTINGS.idleSettleMs / 1000);

      return D.mergeSettings(
        Object.assign({}, currentSettings, {
          enabled: getBool('enabled', D.DEFAULT_SETTINGS.enabled),
          autoAllow: getBool('autoAllow', D.DEFAULT_SETTINGS.autoAllow),
          preferAlwaysAllow: getBool('preferAlwaysAllow', D.DEFAULT_SETTINGS.preferAlwaysAllow),
          fallbackSingleAllow: getBool('fallbackSingleAllow', D.DEFAULT_SETTINGS.fallbackSingleAllow),
          autoContinue: getBool('autoContinue', D.DEFAULT_SETTINGS.autoContinue),
          backgroundMode: getBool('backgroundMode', D.DEFAULT_SETTINGS.backgroundMode),
          preventTabDiscard: getBool('preventTabDiscard', D.DEFAULT_SETTINGS.preventTabDiscard),
          showHud: getBool('showHud', D.DEFAULT_SETTINGS.showHud),
          maxContinuesPerTask: getNum('maxContinuesPerTask', D.DEFAULT_SETTINGS.maxContinuesPerTask),
          dailyContinueLimit: getNum('dailyContinueLimit', D.DEFAULT_SETTINGS.dailyContinueLimit),
          continueCooldownMs: Math.round(cooldownSec * 1000),
          idleSettleMs: Math.round(settleSec * 1000),
          stopOnCompletionCues: getBool('stopOnCompletionCues', D.DEFAULT_SETTINGS.stopOnCompletionCues),
          stopOnStagnantOutput: getBool('stopOnStagnantOutput', D.DEFAULT_SETTINGS.stopOnStagnantOutput),
          stopOnQuotaOrError: getBool('stopOnQuotaOrError', D.DEFAULT_SETTINGS.stopOnQuotaOrError),
          customAlwaysAllowKeywords: D.parseKeywordInput(getStr('customAlwaysAllowKeywords')),
          customContinueKeywords: D.parseKeywordInput(getStr('customContinueKeywords'))
        })
      );
    }

    function sendToGeminiTabs(message, cb) {
      if (!api || !api.tabs || typeof api.tabs.query !== 'function') {
        if (cb) cb(null);
        return;
      }
      api.tabs.query({ url: 'https://gemini.google.com/*' }, (tabs) => {
        if (!Array.isArray(tabs) || tabs.length === 0) {
          if (cb) cb(null);
          return;
        }
        // Prefer currently active tab so multi-tab status reflects what the user is looking at
        const ordered = tabs.slice().sort((a, b) => {
          const aScore = (a && a.active ? 2 : 0) + (a && a.highlighted ? 1 : 0);
          const bScore = (b && b.active ? 2 : 0) + (b && b.highlighted ? 1 : 0);
          return bScore - aScore;
        });
        const results = new Array(ordered.length).fill(null);
        let pending = ordered.length;
        ordered.forEach((tab, idx) => {
          api.tabs.sendMessage(tab.id, message, (resp) => {
            void (api.runtime && api.runtime.lastError);
            if (resp && resp.ok) {
              results[idx] = resp.state || null;
            }
            pending -= 1;
            if (pending === 0 && cb) {
              const best = results.find((s) => s !== null) || null;
              cb(best);
            }
          });
        });
      });
    }

    function saveSettings(customSettings, msg) {
      const next = customSettings ? D.mergeSettings(customSettings) : readSettingsFromForm();
      renderSettings(next);
      if (api && api.storage && api.storage.local) {
        api.storage.local.set({ [D.STORAGE_KEY]: next }, () => {
          showToast(msg || '设置已保存并同步到 Gemini 页面');
          api.storage.local.get([D.STATS_KEY], (res) => {
            renderStats(res && res[D.STATS_KEY], next);
          });
          sendToGeminiTabs({ type: 'GMAH_GET_STATE' }, (state) => {
            if (state) {
              renderLiveStatus(Object.assign({}, state, { settings: next }));
            } else {
              renderLiveStatus(null);
            }
          });
        });
      }
      return next;
    }

    function loadInitial() {
      if (api && api.storage && api.storage.local) {
        api.storage.local.get([D.STORAGE_KEY, D.STATS_KEY], (res) => {
          const settings = D.mergeSettings(res && res[D.STORAGE_KEY]);
          const stats = D.normalizeStats(res && res[D.STATS_KEY]);
          renderSettings(settings);
          renderStats(stats, settings);
        });
      } else {
        renderSettings(D.DEFAULT_SETTINGS);
        renderStats(D.createEmptyStats(), D.DEFAULT_SETTINGS);
      }
      sendToGeminiTabs({ type: 'GMAH_GET_STATE' }, (state) => {
        renderLiveStatus(state);
      });
    }

    function bindEvents() {
      const btnSave = byId('btnSave');
      if (btnSave) {
        btnSave.addEventListener('click', () => {
          saveSettings(null, '已保存设置');
        });
      }

      const enabledEl = byId('enabled');
      if (enabledEl) {
        enabledEl.addEventListener('change', () => {
          saveSettings(null, enabledEl.checked ? '已开启自动助手' : '已暂停自动助手');
        });
      }

      const btnDefaults = byId('btnDefaults');
      if (btnDefaults) {
        btnDefaults.addEventListener('click', () => {
          saveSettings(D.DEFAULT_SETTINGS, '已恢复默认安全设置');
        });
      }

      const btnEmergency = byId('btnEmergency');
      if (btnEmergency) {
        btnEmergency.addEventListener('click', () => {
          sendToGeminiTabs({ type: 'GMAH_EMERGENCY_STOP' }, (state) => {
            renderLiveStatus(state);
            if (state) {
              showToast('已向 Gemini 标签页发送紧急停止指令', true);
            } else {
              showToast('当前未检测到已打开的 Gemini 标签页', true);
            }
          });
        });
      }

      const btnResetBreaker = byId('btnResetBreaker');
      if (btnResetBreaker) {
        btnResetBreaker.addEventListener('click', () => {
          sendToGeminiTabs({ type: 'GMAH_RESET_BREAKER' }, (state) => {
            renderLiveStatus(state);
            if (state) {
              showToast('已解除熔断并重置本次任务计数');
            } else {
              showToast('当前未检测到已打开的 Gemini 标签页', true);
            }
          });
        });
      }

      const btnResetStats = byId('btnResetStats');
      if (btnResetStats) {
        btnResetStats.addEventListener('click', () => {
          const fresh = D.createEmptyStats();
          if (api && api.storage && api.storage.local) {
            api.storage.local.set({ [D.STATS_KEY]: fresh }, () => {
              renderStats(fresh, readSettingsFromForm());
              showToast('今日统计计数已清零');
              sendToGeminiTabs({ type: 'GMAH_GET_STATE' }, (state) => {
                renderLiveStatus(state);
              });
            });
          }
        });
      }
    }

    function init() {
      bindEvents();
      loadInitial();
    }

    return {
      init,
      loadInitial,
      renderSettings,
      renderStats,
      renderLiveStatus,
      readSettingsFromForm,
      saveSettings
    };
  }

  root.GMAH_POPUP = { createPopupController };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = root.GMAH_POPUP;
  }

  if (typeof document !== 'undefined' && document.getElementById('btnSave')) {
    const controller = createPopupController(document, typeof chrome !== 'undefined' ? chrome : null);
    controller.init();
  }
})(typeof globalThis !== 'undefined' ? globalThis : window);
