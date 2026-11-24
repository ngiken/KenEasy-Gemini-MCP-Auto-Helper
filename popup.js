(function (root) {
  'use strict';

  const D =
    root.GMAH_DEFAULTS ||
    (typeof require === 'function' ? require('./defaults.js') : null);

  function createPopupController(doc, chromeApi) {
    const d = doc || (typeof document !== 'undefined' ? document : null);
    const api = chromeApi || (typeof chrome !== 'undefined' ? chrome : null);
    let toastTimer = null;
    let autoSaveTimer = null;
    let currentSettings = D.mergeSettings(D.DEFAULT_SETTINGS);
    let currentTabState = null;
    let currentTabMeta = null;

    const CHAT_TOGGLE_BINDINGS = [
      { id: 'chatEnabled', key: 'enabled' },
      { id: 'chatAutoAllow', key: 'autoAllow' },
      { id: 'chatAutoContinue', key: 'autoContinue' },
      { id: 'chatBackgroundMode', key: 'backgroundMode' },
      { id: 'chatStallAlertEnabled', key: 'stallAlertEnabled' },
      { id: 'chatStallAutoRecoverEnabled', key: 'stallAutoRecoverEnabled' },
      { id: 'chatModelLockEnabled', key: 'modelLockEnabled' }
    ];

    function byId(id) {
      return d ? d.getElementById(id) : null;
    }

    function tr(key, vars) {
      return D.t(currentSettings.language, key, vars);
    }

    function applyTheme(theme) {
      if (!d || !d.body) return;
      const isLight = theme === 'light';
      if (d.body.classList && typeof d.body.classList.add === 'function') {
        if (isLight) d.body.classList.add('theme-light');
        else d.body.classList.remove('theme-light');
      } else {
        const parts = String(d.body.className || '').split(/\s+/).filter((c) => c && c !== 'theme-light');
        if (isLight) parts.push('theme-light');
        d.body.className = parts.join(' ');
      }
    }

    function applyI18n(lang) {
      if (!d || typeof d.querySelectorAll !== 'function') return;
      if (d.documentElement && typeof d.documentElement.setAttribute === 'function') {
        d.documentElement.setAttribute('lang', lang);
      }
      const textNodes = d.querySelectorAll('[data-i18n]');
      for (let i = 0; i < textNodes.length; i++) {
        const node = textNodes[i];
        const key = node.getAttribute && node.getAttribute('data-i18n');
        if (key) node.textContent = D.t(lang, key);
      }
      const phNodes = d.querySelectorAll('[data-i18n-placeholder]');
      for (let i = 0; i < phNodes.length; i++) {
        const node = phNodes[i];
        const key = node.getAttribute && node.getAttribute('data-i18n-placeholder');
        if (key && typeof node.setAttribute === 'function') {
          node.setAttribute('placeholder', D.t(lang, key));
        }
      }
      const titleNodes = d.querySelectorAll('[data-i18n-title]');
      for (let i = 0; i < titleNodes.length; i++) {
        const node = titleNodes[i];
        const key = node.getAttribute && node.getAttribute('data-i18n-title');
        if (key && typeof node.setAttribute === 'function') {
          node.setAttribute('title', D.t(lang, key));
        }
      }
    }

    function showToast(msg, isError) {
      const el = byId('toast');
      if (!el) return;
      el.textContent = msg;
      const isLight = currentSettings && currentSettings.theme === 'light';
      el.style.color = isError ? (isLight ? '#d44c47' : '#f08080') : (isLight ? '#0f7b6c' : '#6bc9a4');
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(() => {
        el.textContent = '';
      }, 2400);
    }

    function renderSettings(settings, opts) {
      const s = D.mergeSettings(settings);
      const preserveActiveInput = Boolean(opts && opts.preserveActiveInput);
      currentSettings = s;
      applyTheme(s.theme);
      applyI18n(s.language);

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
        'stopOnQuotaOrError',
        'humanPacingEnabled',
        'stallAlertEnabled',
        'stallAutoRecoverEnabled',
        'modelLockEnabled',
        'stopOnModelUnavailable'
      ];
      for (const id of boolIds) {
        const el = byId(id);
        if (el) el.checked = Boolean(s[id]);
      }

      const setVal = (id, val) => {
        const el = byId(id);
        if (!el) return;
        if (preserveActiveInput && d && d.activeElement === el) return;
        el.value = String(val);
      };
      setVal('language', s.language);
      setVal('maxContinuesPerTask', s.maxContinuesPerTask);
      setVal('dailyContinueLimit', s.dailyContinueLimit);
      setVal('continueCooldownSec', Number((s.continueCooldownMs / 1000).toFixed(1)));
      setVal('idleSettleSec', Number((s.idleSettleMs / 1000).toFixed(1)));
      setVal('stallAlertMinutes', s.stallAlertMinutes);
      setVal('stallAutoRecoverMinutes', s.stallAutoRecoverMinutes);
      setVal('maxStallRecoveriesPerTask', s.maxStallRecoveriesPerTask);
      setVal('stallAutoRecoverPrompt', s.stallAutoRecoverPrompt);
      setVal('preferredModel', s.preferredModel || '');
      setVal('maxModelSwitchRetries', s.maxModelSwitchRetries);
      setVal('customAlwaysAllowKeywords', (s.customAlwaysAllowKeywords || []).join('\n'));
      setVal('customContinueKeywords', (s.customContinueKeywords || []).join('\n'));

      renderModelChips(s, currentTabState);

      const btnToggleNotif = byId('btnToggleNotif');
      if (btnToggleNotif) {
        btnToggleNotif.textContent = s.stallAlertEnabled ? tr('btnNotifOn') : tr('btnNotifOff');
        btnToggleNotif.className = s.stallAlertEnabled ? 'btn primary btn-sm' : 'btn secondary btn-sm';
      }

      const btnToggleTheme = byId('btnToggleTheme');
      if (btnToggleTheme) {
        btnToggleTheme.textContent = s.theme === 'light' ? tr('popupThemeLight') : tr('popupThemeDark');
      }

      if (currentTabState) {
        renderChatControl(currentTabState);
      }
    }

    function renderChatControl(tabState) {
      const card = byId('chatControlCard');
      if (!card) return;
      if (!tabState || tabState.isNonChatPage || !tabState.settings) {
        card.style.display = 'none';
        return;
      }

      card.style.display = 'flex';
      const lang = currentSettings.language;
      const eff = tabState.settings;
      const override = tabState.chatOverride && typeof tabState.chatOverride === 'object' ? tabState.chatOverride : {};
      const hasOverride = Boolean(
        tabState.hasChatOverride ||
          (typeof D.hasChatOverrideChanges === 'function' && D.hasChatOverrideChanges(override))
      );
      const isTripped = Boolean(tabState.circuitBreaker && tabState.circuitBreaker.tripped);

      const chatLabelEl = byId('chatLabel');
      if (chatLabelEl) {
        chatLabelEl.textContent =
          typeof D.formatConversationLabel === 'function'
            ? D.formatConversationLabel(tabState.conversationKey, lang)
            : tr('chatLabelNew');
      }

      const badgeEl = byId('chatOverrideBadge');
      if (badgeEl) {
        badgeEl.textContent = hasOverride ? tr('scopeChatCustom') : tr('scopeFollowGlobal');
        badgeEl.className = hasOverride ? 'chat-mode-tag custom' : 'chat-mode-tag';
      }

      const resetBtn = byId('btnResetChatOverride');
      if (resetBtn) {
        resetBtn.style.display = hasOverride ? 'inline-block' : 'none';
        resetBtn.textContent = tr('scopeResetBtn');
      }

      for (const item of CHAT_TOGGLE_BINDINGS) {
        const input = byId(item.id);
        if (!input) continue;
        input.checked = Boolean(eff[item.key]);
        const wrap = input.parentNode;
        if (wrap && wrap.nodeType === 1) {
          const isCustom = typeof override[item.key] === 'boolean';
          wrap.className = isCustom ? 'chat-toggle-item overridden' : 'chat-toggle-item';
        }
      }

      const btnChatEmergency = byId('btnChatEmergency');
      if (btnChatEmergency) {
        if (isTripped) {
          btnChatEmergency.textContent = tr('chatResumeBtn');
          btnChatEmergency.className = 'btn primary btn-sm';
        } else {
          btnChatEmergency.textContent = tr('chatEmergencyBtn');
          btnChatEmergency.className = 'btn danger btn-sm';
        }
      }
    }

    function renderModelChips(settings, tabState) {
      const wrap = byId('modelPresetChips');
      if (!wrap || !d || typeof d.createElement !== 'function') return;
      wrap.textContent = '';
      const s = settings || currentSettings || D.DEFAULT_SETTINGS;
      const pref = (s.preferredModel || '').trim().toLowerCase();
      const detected =
        tabState && Array.isArray(tabState.availableModels) ? tabState.availableModels : [];
      const presets = Array.isArray(D.MODEL_PRESETS) ? D.MODEL_PRESETS : ['Pro', 'Thinking', 'Fast'];
      const seen = new Set();
      const combined = [];
      for (const name of detected.concat(presets)) {
        if (typeof name !== 'string') continue;
        const clean = name.trim();
        if (!clean) continue;
        const key = clean.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        combined.push(clean);
        if (combined.length >= 12) break;
      }
      for (const name of combined) {
        const chip = d.createElement('button');
        chip.type = 'button';
        chip.className = pref && name.toLowerCase() === pref ? 'model-chip active' : 'model-chip';
        chip.textContent = name;
        chip.addEventListener('click', () => {
          const inp = byId('preferredModel');
          if (inp) inp.value = name;
          saveSettings(
            Object.assign({}, readSettingsFromForm(), { preferredModel: name }),
            tr('toastModelSetCurrent', { model: name })
          );
        });
        wrap.appendChild(chip);
      }
    }

    function renderStats(stats, settings) {
      const st = D.normalizeStats(stats);
      const s = D.mergeSettings(settings);
      const allowEl = byId('statAllow');
      const contEl = byId('statContinue');
      const dailyCapLabel = s.dailyContinueLimit > 0 ? String(s.dailyContinueLimit) : '∞';
      if (allowEl) allowEl.textContent = String(st.allowCount);
      if (contEl) contEl.textContent = `${st.continueCount} / ${dailyCapLabel}`;
    }

    function renderLiveStatus(tabState, meta) {
      currentTabState = tabState || null;
      currentTabMeta = meta || null;
      renderChatControl(tabState);
      renderModelChips(currentSettings, tabState);

      const detectedBadge = byId('detectedModelBadge');
      if (detectedBadge) {
        const detected = tabState && tabState.detectedModel ? String(tabState.detectedModel) : '';
        detectedBadge.textContent = detected || tr('modelUnknown');
        const mismatch = Boolean(
          tabState && tabState.settings && tabState.settings.modelLockEnabled && tabState.modelMismatchActive
        );
        detectedBadge.className = mismatch
          ? 'model-live-pill warn'
          : detected
            ? 'model-live-pill ok'
            : 'model-live-pill';
      }

      const liveEl = byId('statLive');
      if (!liveEl) return;
      if (!tabState) {
        if (meta && meta.reason === 'needs_reload') {
          liveEl.textContent = tr('liveNeedsReload');
          liveEl.className = 'badge-warn';
        } else {
          liveEl.textContent = tr('liveNoTab');
          liveEl.className = '';
        }
        return;
      }
      if (tabState.isNonChatPage) {
        liveEl.textContent = tr('liveStandby');
        liveEl.className = '';
        return;
      }
      if (tabState.circuitBreaker && tabState.circuitBreaker.tripped) {
        liveEl.textContent =
          tabState.circuitBreaker.reasonCode === 'model_unavailable'
            ? tr('liveModelError')
            : tr('liveTripped');
        liveEl.className = 'badge-stop';
      } else if (!tabState.settings || !tabState.settings.enabled) {
        liveEl.textContent = tr('livePaused');
        liveEl.className = 'badge-warn';
      } else if (tabState.stallAlertActive) {
        liveEl.textContent = tr('liveStall');
        liveEl.className = 'badge-warn';
      } else if (tabState.stallElapsedMs >= 1000) {
        const elapsed =
          typeof D.formatWaitDuration === 'function'
            ? D.formatWaitDuration(tabState.stallElapsedMs, currentSettings.language)
            : `${Math.floor(tabState.stallElapsedMs / 1000)}s`;
        liveEl.textContent = tr('liveWaiting', { elapsed });
        liveEl.className = 'badge-warn';
      } else {
        liveEl.textContent = tabState.settings.backgroundMode ? tr('liveBgReady') : tr('liveMonitoring');
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

      const langEl = byId('language');
      const selectedLang =
        langEl && langEl.value ? D.resolveLanguage(langEl.value) : currentSettings.language;

      const cooldownSec = getNum('continueCooldownSec', D.DEFAULT_SETTINGS.continueCooldownMs / 1000);
      const settleSec = getNum('idleSettleSec', D.DEFAULT_SETTINGS.idleSettleMs / 1000);

      return D.mergeSettings(
        Object.assign({}, currentSettings, {
          language: selectedLang,
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
          humanPacingEnabled: getBool('humanPacingEnabled', D.DEFAULT_SETTINGS.humanPacingEnabled),
          stallAlertEnabled: getBool('stallAlertEnabled', D.DEFAULT_SETTINGS.stallAlertEnabled),
          stallAlertMinutes: getNum('stallAlertMinutes', D.DEFAULT_SETTINGS.stallAlertMinutes),
          stallAutoRecoverEnabled: getBool(
            'stallAutoRecoverEnabled',
            D.DEFAULT_SETTINGS.stallAutoRecoverEnabled
          ),
          stallAutoRecoverMinutes: getNum(
            'stallAutoRecoverMinutes',
            D.DEFAULT_SETTINGS.stallAutoRecoverMinutes
          ),
          maxStallRecoveriesPerTask: getNum(
            'maxStallRecoveriesPerTask',
            D.DEFAULT_SETTINGS.maxStallRecoveriesPerTask
          ),
          stallAutoRecoverPrompt:
            byId('stallAutoRecoverPrompt')
              ? getStr('stallAutoRecoverPrompt')
              : currentSettings.stallAutoRecoverPrompt,
          modelLockEnabled: getBool('modelLockEnabled', D.DEFAULT_SETTINGS.modelLockEnabled),
          preferredModel:
            byId('preferredModel')
              ? D.sanitizeModelName(getStr('preferredModel'), '')
              : currentSettings.preferredModel,
          maxModelSwitchRetries: getNum(
            'maxModelSwitchRetries',
            D.DEFAULT_SETTINGS.maxModelSwitchRetries
          ),
          stopOnModelUnavailable: getBool(
            'stopOnModelUnavailable',
            D.DEFAULT_SETTINGS.stopOnModelUnavailable
          ),
          customAlwaysAllowKeywords: D.parseKeywordInput(getStr('customAlwaysAllowKeywords')),
          customContinueKeywords: D.parseKeywordInput(getStr('customContinueKeywords'))
        })
      );
    }

    function injectIntoTabs(tabs, done) {
      if (!api || !api.scripting || typeof api.scripting.executeScript !== 'function') {
        done(false);
        return;
      }
      const targets = tabs.filter((t) => t && typeof t.id === 'number' && !t.discarded);
      if (targets.length === 0) {
        done(false);
        return;
      }
      let remaining = targets.length;
      let anySuccess = false;
      for (const tab of targets) {
        try {
          if (typeof api.scripting.insertCSS === 'function') {
            const cssRes = api.scripting.insertCSS(
              { target: { tabId: tab.id }, files: ['hud.css'] },
              () => {
                void (api.runtime && api.runtime.lastError);
              }
            );
            if (cssRes && typeof cssRes.catch === 'function') cssRes.catch(() => {});
          }
          const jsRes = api.scripting.executeScript(
            { target: { tabId: tab.id }, files: ['defaults.js', 'hud.js', 'content.js'] },
            () => {
              const hadErr = Boolean(api.runtime && api.runtime.lastError);
              if (!hadErr) anySuccess = true;
              remaining -= 1;
              if (remaining === 0) done(anySuccess);
            }
          );
          if (jsRes && typeof jsRes.catch === 'function') {
            jsRes.catch(() => {
              remaining -= 1;
              if (remaining === 0) done(anySuccess);
            });
          }
        } catch (_) {
          remaining -= 1;
          if (remaining === 0) done(anySuccess);
        }
      }
    }

    function queryTabsAndSend(ordered, message, onDone) {
      const results = new Array(ordered.length).fill(null);
      let pending = ordered.length;
      ordered.forEach((tab, idx) => {
        api.tabs.sendMessage(tab.id, message, (resp) => {
          void (api.runtime && api.runtime.lastError);
          if (resp && resp.ok) {
            results[idx] = resp.state || null;
          }
          pending -= 1;
          if (pending === 0) {
            const best = results.find((s) => s !== null) || null;
            onDone(best);
          }
        });
      });
    }

    function withFocusedWindowId(cb) {
      if (api && api.windows && typeof api.windows.getLastFocused === 'function') {
        try {
          api.windows.getLastFocused((win) => {
            void (api.runtime && api.runtime.lastError);
            cb(win && typeof win.id === 'number' ? win.id : null);
          });
          return;
        } catch (_) {}
      }
      cb(null);
    }

    function sendToGeminiTabs(message, cb, opts) {
      const activeOnly = Boolean(opts && opts.activeOnly);
      if (!api || !api.tabs || typeof api.tabs.query !== 'function') {
        if (cb) cb(null, { reason: 'no_tab', tabCount: 0 });
        return;
      }
      withFocusedWindowId((focusedWinId) => {
        api.tabs.query({ url: 'https://gemini.google.com/*' }, (tabs) => {
          if (!Array.isArray(tabs) || tabs.length === 0) {
            if (cb) cb(null, { reason: 'no_tab', tabCount: 0 });
            return;
          }
          // Prefer currently focused window & active tab so multi-browser/multi-tab status reflects what the user is looking at
          const ordered = tabs.slice().sort((a, b) => {
            const aWin = focusedWinId !== null && a && a.windowId === focusedWinId ? 4 : 0;
            const bWin = focusedWinId !== null && b && b.windowId === focusedWinId ? 4 : 0;
            const aScore = aWin + (a && a.active ? 2 : 0) + (a && a.highlighted ? 1 : 0);
            const bScore = bWin + (b && b.active ? 2 : 0) + (b && b.highlighted ? 1 : 0);
            return bScore - aScore;
          });
          const targets = activeOnly ? ordered.slice(0, 1) : ordered;

          queryTabsAndSend(targets, message, (best) => {
            if (best) {
              if (cb) cb(best, { reason: 'ok', tabCount: ordered.length });
              return;
            }
            // Gemini tab is open but content script isn't injected yet (e.g., tab was open before install/reload)
            injectIntoTabs(targets, (injected) => {
              if (!injected) {
                if (cb) cb(null, { reason: 'needs_reload', tabCount: ordered.length });
                return;
              }
              queryTabsAndSend(targets, message, (retryBest) => {
                if (retryBest) {
                  if (cb) cb(retryBest, { reason: 'ok', injected: true, tabCount: ordered.length });
                } else if (cb) {
                  cb(null, { reason: 'needs_reload', tabCount: ordered.length });
                }
              });
            });
          });
        });
      });
    }

    function sendToActiveGeminiTab(message, cb) {
      return sendToGeminiTabs(message, cb, { activeOnly: true });
    }

    function saveSettings(customSettings, msg, opts) {
      if (autoSaveTimer) {
        clearTimeout(autoSaveTimer);
        autoSaveTimer = null;
      }
      const next = customSettings ? D.mergeSettings(customSettings) : readSettingsFromForm();
      renderSettings(next, opts);
      if (!next.stallAlertEnabled && api && api.runtime && typeof api.runtime.sendMessage === 'function') {
        try {
          api.runtime.sendMessage({ type: 'GMAH_CLEAR_ALL_STALL_NOTIFICATIONS' }, () => {
            void (api.runtime && api.runtime.lastError);
          });
        } catch (_) {}
      }
      if (api && api.storage && api.storage.local) {
        api.storage.local.set({ [D.STORAGE_KEY]: next }, () => {
          showToast(msg || tr('toastSaved'));
          api.storage.local.get([D.STATS_KEY], (res) => {
            renderStats(res && res[D.STATS_KEY], next);
          });
          // Push settings directly to open Gemini tabs so breaker reconciliation & live status never race storage.onChanged
          sendToGeminiTabs({ type: 'GMAH_APPLY_SETTINGS', settings: next }, (state, meta) => {
            if (state) {
              const effSettings =
                typeof D.resolveEffectiveSettings === 'function'
                  ? D.resolveEffectiveSettings(next, state.chatOverride)
                  : next;
              renderLiveStatus(Object.assign({}, state, { settings: effSettings, globalSettings: next }), meta);
            } else {
              renderLiveStatus(null, meta);
            }
          });
        });
      }
      return next;
    }

    function scheduleAutoSave() {
      if (autoSaveTimer) clearTimeout(autoSaveTimer);
      autoSaveTimer = setTimeout(() => {
        autoSaveTimer = null;
        saveSettings(null, tr('toastSynced'), { preserveActiveInput: true });
      }, 450);
    }

    function loadInitial() {
      if (api && api.storage && api.storage.local) {
        api.storage.local.get([D.STORAGE_KEY, D.STATS_KEY], (res) => {
          const migratedRes = D.migrateStoredSettings(res && res[D.STORAGE_KEY]);
          const settings = migratedRes.settings;
          const stats = D.normalizeStats(res && res[D.STATS_KEY]);
          if (migratedRes.migrated && typeof api.storage.local.set === 'function') {
            api.storage.local.set({ [D.STORAGE_KEY]: settings });
          }
          renderSettings(settings);
          renderStats(stats, settings);
          sendToGeminiTabs({ type: 'GMAH_GET_STATE' }, (state, meta) => {
            renderLiveStatus(state, meta);
          });
        });
      } else {
        renderSettings(D.DEFAULT_SETTINGS);
        renderStats(D.createEmptyStats(), D.DEFAULT_SETTINGS);
        sendToGeminiTabs({ type: 'GMAH_GET_STATE' }, (state, meta) => {
          renderLiveStatus(state, meta);
        });
      }
    }

    function bindEvents() {
      const btnSave = byId('btnSave');
      if (btnSave) {
        btnSave.addEventListener('click', () => {
          saveSettings(null, tr('toastSavedBtn'));
        });
      }

      const enabledEl = byId('enabled');
      if (enabledEl) {
        enabledEl.addEventListener('change', () => {
          saveSettings(null, enabledEl.checked ? tr('toastEnabledOn') : tr('toastEnabledOff'));
        });
      }

      const langEl = byId('language');
      if (langEl) {
        langEl.addEventListener('change', () => {
          const nextLang = D.resolveLanguage(langEl.value);
          saveSettings(
            Object.assign({}, readSettingsFromForm(), { language: nextLang }),
            D.t(nextLang, 'toastLangChanged')
          );
        });
      }

      const btnToggleTheme = byId('btnToggleTheme');
      if (btnToggleTheme) {
        btnToggleTheme.addEventListener('click', () => {
          const nextTheme = currentSettings.theme === 'light' ? 'dark' : 'light';
          saveSettings(
            Object.assign({}, readSettingsFromForm(), { theme: nextTheme }),
            nextTheme === 'light' ? tr('toastThemeLight') : tr('toastThemeDark')
          );
        });
      }

      const autoSyncToggleIds = [
        'autoAllow',
        'preferAlwaysAllow',
        'fallbackSingleAllow',
        'autoContinue',
        'backgroundMode',
        'preventTabDiscard',
        'showHud',
        'stopOnCompletionCues',
        'stopOnStagnantOutput',
        'stopOnQuotaOrError',
        'humanPacingEnabled',
        'stallAlertEnabled',
        'stallAutoRecoverEnabled',
        'modelLockEnabled',
        'stopOnModelUnavailable'
      ];
      for (const id of autoSyncToggleIds) {
        const el = byId(id);
        if (el) {
          el.addEventListener('change', () => {
            saveSettings(null, tr('toastSynced'));
          });
        }
      }

      const autoSyncFieldIds = [
        'maxContinuesPerTask',
        'dailyContinueLimit',
        'continueCooldownSec',
        'idleSettleSec',
        'stallAlertMinutes',
        'stallAutoRecoverMinutes',
        'maxStallRecoveriesPerTask',
        'stallAutoRecoverPrompt',
        'preferredModel',
        'maxModelSwitchRetries',
        'customAlwaysAllowKeywords',
        'customContinueKeywords'
      ];
      for (const id of autoSyncFieldIds) {
        const el = byId(id);
        if (el) {
          el.addEventListener('change', () => {
            saveSettings(null, tr('toastSynced'));
          });
          el.addEventListener('input', () => {
            scheduleAutoSave();
          });
        }
      }

      const btnUseCurrentModel = byId('btnUseCurrentModel');
      if (btnUseCurrentModel) {
        btnUseCurrentModel.addEventListener('click', () => {
          sendToActiveGeminiTab({ type: 'GMAH_USE_CURRENT_MODEL' }, (state, meta) => {
            renderLiveStatus(state, meta);
            const detected = state && state.detectedModel ? String(state.detectedModel) : '';
            if (detected) {
              const inp = byId('preferredModel');
              if (inp) inp.value = detected;
              saveSettings(
                Object.assign({}, readSettingsFromForm(), { preferredModel: detected }),
                tr('toastModelSetCurrent', { model: detected })
              );
            } else if (meta && meta.reason === 'needs_reload') {
              showToast(tr('toastNeedsReload'), true);
            } else {
              showToast(tr('toastModelNotDetected'), true);
            }
          });
        });
      }

      const btnDetectModels = byId('btnDetectModels');
      if (btnDetectModels) {
        btnDetectModels.addEventListener('click', () => {
          sendToActiveGeminiTab({ type: 'GMAH_DETECT_MODELS' }, (state, meta) => {
            renderLiveStatus(state, meta);
            if (!state) {
              showToast(meta && meta.reason === 'needs_reload' ? tr('toastNeedsReload') : tr('toastNoGeminiTab'), true);
              return;
            }
            const count = Array.isArray(state.availableModels) ? state.availableModels.length : 0;
            if (count > 0) {
              showToast(tr('toastModelDetectedCount', { count }));
            } else {
              // Menu opens asynchronously; fetch refreshed state shortly after
              setTimeout(() => {
                sendToActiveGeminiTab({ type: 'GMAH_GET_STATE' }, (refreshed, refreshedMeta) => {
                  renderLiveStatus(refreshed, refreshedMeta);
                  const n = refreshed && Array.isArray(refreshed.availableModels) ? refreshed.availableModels.length : 0;
                  if (n > 0) showToast(tr('toastModelDetectedCount', { count: n }));
                  else showToast(tr('toastModelNotDetected'), true);
                });
              }, 700);
            }
          });
        });
      }

      const btnSwitchModelNow = byId('btnSwitchModelNow');
      if (btnSwitchModelNow) {
        btnSwitchModelNow.addEventListener('click', () => {
          const target = D.sanitizeModelName(
            byId('preferredModel') ? byId('preferredModel').value : currentSettings.preferredModel,
            ''
          );
          if (!target) {
            showToast(tr('toastModelNoTarget'), true);
            return;
          }
          sendToActiveGeminiTab({ type: 'GMAH_FORCE_MODEL_SWITCH', model: target }, (state, meta) => {
            renderLiveStatus(state, meta);
            if (state) {
              showToast(tr('toastModelSwitchTriggered', { model: target }));
            } else if (meta && meta.reason === 'needs_reload') {
              showToast(tr('toastNeedsReload'), true);
            } else {
              showToast(tr('toastNoGeminiTab'), true);
            }
          });
        });
      }

      const btnToggleNotif = byId('btnToggleNotif');
      if (btnToggleNotif) {
        btnToggleNotif.addEventListener('click', () => {
          const nextVal = !currentSettings.stallAlertEnabled;
          const check = byId('stallAlertEnabled');
          if (check) check.checked = nextVal;
          saveSettings(
            Object.assign({}, currentSettings, { stallAlertEnabled: nextVal }),
            nextVal ? tr('toastNotifOn') : tr('toastNotifOff')
          );
        });
      }

      const btnTestNotif = byId('btnTestNotif');
      if (btnTestNotif) {
        btnTestNotif.addEventListener('click', () => {
          if (!api || !api.runtime || typeof api.runtime.sendMessage !== 'function') {
            showToast(tr('toastTestNotifUnsupported'), true);
            return;
          }
          api.runtime.sendMessage({ type: 'GMAH_TEST_NOTIFICATION' }, (resp) => {
            const err = api.runtime && api.runtime.lastError;
            if (err || !resp || !resp.ok) {
              showToast(tr('toastTestNotifFailed'), true);
            } else {
              showToast(tr('toastTestNotifSent'));
            }
          });
        });
      }

      const btnDefaults = byId('btnDefaults');
      if (btnDefaults) {
        btnDefaults.addEventListener('click', () => {
          const restored = Object.assign({}, D.DEFAULT_SETTINGS, {
            language: currentSettings.language,
            theme: currentSettings.theme
          });
          saveSettings(restored, D.t(restored.language, 'toastDefaultsRestored'));
        });
      }

      for (const item of CHAT_TOGGLE_BINDINGS) {
        const el = byId(item.id);
        if (!el) continue;
        el.addEventListener('change', () => {
          sendToActiveGeminiTab(
            { type: 'GMAH_UPDATE_CHAT_OVERRIDE', override: { [item.key]: Boolean(el.checked) } },
            (state, meta) => {
              renderLiveStatus(state, meta);
              if (state) {
                showToast(tr('toastChatUpdated'));
              } else if (meta && meta.reason === 'needs_reload') {
                showToast(tr('toastNeedsReload'), true);
              } else {
                showToast(tr('toastNoGeminiTab'), true);
              }
            }
          );
        });
      }

      const btnResetChatOverride = byId('btnResetChatOverride');
      if (btnResetChatOverride) {
        btnResetChatOverride.addEventListener('click', () => {
          sendToActiveGeminiTab({ type: 'GMAH_RESET_CHAT_OVERRIDE' }, (state, meta) => {
            renderLiveStatus(state, meta);
            if (state) {
              showToast(tr('toastChatReset'));
            } else if (meta && meta.reason === 'needs_reload') {
              showToast(tr('toastNeedsReload'), true);
            } else {
              showToast(tr('toastNoGeminiTab'), true);
            }
          });
        });
      }

      const btnChatEmergency = byId('btnChatEmergency');
      if (btnChatEmergency) {
        btnChatEmergency.addEventListener('click', () => {
          const isTripped = Boolean(
            currentTabState && currentTabState.circuitBreaker && currentTabState.circuitBreaker.tripped
          );
          const msgType = isTripped ? 'GMAH_RESET_BREAKER' : 'GMAH_EMERGENCY_STOP';
          sendToActiveGeminiTab({ type: msgType }, (state, meta) => {
            renderLiveStatus(state, meta);
            if (state) {
              showToast(isTripped ? tr('toastBreakerReset') : tr('toastEmergencyChatSent'), !isTripped);
            } else if (meta && meta.reason === 'needs_reload') {
              showToast(tr('toastNeedsReload'), true);
            } else {
              showToast(tr('toastNoGeminiTab'), true);
            }
          });
        });
      }

      const btnEmergency = byId('btnEmergency');
      if (btnEmergency) {
        btnEmergency.addEventListener('click', () => {
          sendToActiveGeminiTab({ type: 'GMAH_EMERGENCY_STOP' }, (state, meta) => {
            renderLiveStatus(state, meta);
            if (state) {
              showToast(tr('toastEmergencyChatSent'), true);
            } else if (meta && meta.reason === 'needs_reload') {
              showToast(tr('toastNeedsReload'), true);
            } else {
              showToast(tr('toastNoGeminiTab'), true);
            }
          });
        });
      }

      const btnEmergencyAll = byId('btnEmergencyAll');
      if (btnEmergencyAll) {
        btnEmergencyAll.addEventListener('click', () => {
          sendToGeminiTabs({ type: 'GMAH_EMERGENCY_STOP' }, (state, meta) => {
            renderLiveStatus(state, meta);
            if (state) {
              showToast(tr('toastEmergencyAllSent'), true);
            } else if (meta && meta.reason === 'needs_reload') {
              showToast(tr('toastNeedsReload'), true);
            } else {
              showToast(tr('toastNoGeminiTab'), true);
            }
          });
        });
      }

      const btnForceRecover = byId('btnForceRecover');
      if (btnForceRecover) {
        btnForceRecover.addEventListener('click', () => {
          sendToActiveGeminiTab({ type: 'GMAH_FORCE_STALL_RECOVER' }, (state, meta) => {
            renderLiveStatus(state, meta);
            if (state) {
              showToast(tr('toastForceRecoverSent'));
            } else if (meta && meta.reason === 'needs_reload') {
              showToast(tr('toastNeedsReload'), true);
            } else {
              showToast(tr('toastNoGeminiTab'), true);
            }
          });
        });
      }

      const btnResetBreaker = byId('btnResetBreaker');
      if (btnResetBreaker) {
        btnResetBreaker.addEventListener('click', () => {
          sendToActiveGeminiTab({ type: 'GMAH_RESET_BREAKER' }, (state, meta) => {
            renderLiveStatus(state, meta);
            if (state) {
              showToast(tr('toastBreakerReset'));
            } else if (meta && meta.reason === 'needs_reload') {
              showToast(tr('toastNeedsReload'), true);
            } else {
              showToast(tr('toastNoGeminiTab'), true);
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
              showToast(tr('toastStatsReset'));
              sendToGeminiTabs({ type: 'GMAH_GET_STATE' }, (state, meta) => {
                renderLiveStatus(state, meta);
              });
            });
          }
        });
      }

      const btnResetHudPos = byId('btnResetHudPos');
      if (btnResetHudPos) {
        btnResetHudPos.addEventListener('click', () => {
          if (api && api.storage && api.storage.local && typeof api.storage.local.remove === 'function') {
            api.storage.local.remove(['gmah_hud_position']);
          }
          sendToGeminiTabs({ type: 'GMAH_RESET_HUD_POS' }, () => {
            showToast(tr('toastHudPosReset'));
          });
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
      renderChatControl,
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
