(function (root) {
  'use strict';

  const D =
    root.GMAH_DEFAULTS ||
    (typeof require === 'function' ? require('./defaults.js') : null);

  function createHud(callbacks) {
    const cb = callbacks || {};
    let container = null;
    let els = {};
    let activePanel = null; // null | 'logs' | 'inspect'
    let editScope = 'chat'; // 'chat' | 'global'
    let currentState = null;
    let lastLogSignature = '';
    let lastRenderSignature = '';
    let lastMinimized = null;
    let lastLang = null;
    let docCleanup = null;

    const STORAGE_POS_KEY = 'gmah_hud_position';

    function getLang() {
      const lang = currentState && currentState.settings && currentState.settings.language;
      if (D && typeof D.resolveLanguage === 'function') {
        return D.resolveLanguage(lang);
      }
      return lang || 'zh-CN';
    }

    function tr(key, vars) {
      if (D && typeof D.t === 'function') {
        return D.t(getLang(), key, vars);
      }
      return key;
    }

    function getWindow() {
      if (typeof window !== 'undefined') return window;
      if (typeof globalThis !== 'undefined' && globalThis.window) return globalThis.window;
      return null;
    }

    function getLocalStorage() {
      try {
        if (typeof localStorage !== 'undefined') return localStorage;
        const win = getWindow();
        if (win && win.localStorage) return win.localStorage;
      } catch (_) {}
      return null;
    }

    function addClass(node, cls) {
      if (!node) return;
      if (node.classList && typeof node.classList.add === 'function') {
        node.classList.add(cls);
      } else {
        const cur = String(node.className || '');
        if (!cur.split(/\s+/).includes(cls)) {
          node.className = (cur + ' ' + cls).trim();
        }
      }
    }

    function removeClass(node, cls) {
      if (!node) return;
      if (node.classList && typeof node.classList.remove === 'function') {
        node.classList.remove(cls);
      } else {
        const cur = String(node.className || '');
        node.className = cur.split(/\s+/).filter((c) => c !== cls).join(' ');
      }
    }

    function el(tag, className, text) {
      const node = document.createElement(tag);
      if (className) node.className = className;
      if (typeof text === 'string') node.textContent = text;
      return node;
    }

    function loadSavedPosition() {
      const ls = getLocalStorage();
      if (ls && typeof ls.getItem === 'function') {
        try {
          const raw = ls.getItem(STORAGE_POS_KEY);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed.left === 'number' && typeof parsed.top === 'number') {
              return parsed;
            }
          }
        } catch (_) {}
      }
      return null;
    }

    function savePosition(pos) {
      if (!pos || typeof pos.left !== 'number' || typeof pos.top !== 'number') return;
      const ls = getLocalStorage();
      if (ls && typeof ls.setItem === 'function') {
        try {
          ls.setItem(STORAGE_POS_KEY, JSON.stringify(pos));
        } catch (_) {}
      }
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        try {
          chrome.storage.local.set({ [STORAGE_POS_KEY]: pos });
        } catch (_) {}
      }
      if (cb && typeof cb.onPositionChange === 'function') {
        try {
          cb.onPositionChange(pos);
        } catch (_) {}
      }
    }

    function applyPosition(left, top) {
      if (!container) return { left: 0, top: 0 };
      const win = getWindow();
      const vw = (win && typeof win.innerWidth === 'number') ? win.innerWidth : 1024;
      const vh = (win && typeof win.innerHeight === 'number') ? win.innerHeight : 768;
      // Guard against Windows minimized viewport (0x0) snapping the HUD to top-left (0, 0)
      if (vw < 120 || vh < 120) {
        const curLeft = container.style.left ? parseFloat(container.style.left) : Math.round(Number(left) || 0);
        const curTop = container.style.top ? parseFloat(container.style.top) : Math.round(Number(top) || 0);
        return {
          left: Number.isFinite(curLeft) ? curLeft : 0,
          top: Number.isFinite(curTop) ? curTop : 0
        };
      }
      let r = null;
      try {
        if (container.getBoundingClientRect) r = container.getBoundingClientRect();
      } catch (_) {}
      if (!r) r = { width: 262, height: 290 };
      const width = (r && typeof r.width === 'number' && r.width > 0) ? r.width : 262;
      const height = (r && typeof r.height === 'number' && r.height > 0) ? r.height : 290;

      const maxLeft = Math.max(0, vw - width);
      const maxTop = Math.max(0, vh - height);

      const clampedLeft = Math.max(0, Math.min(maxLeft, Math.round(Number(left) || 0)));
      const clampedTop = Math.max(0, Math.min(maxTop, Math.round(Number(top) || 0)));

      container.style.left = clampedLeft + 'px';
      container.style.top = clampedTop + 'px';
      container.style.right = 'auto';
      container.style.bottom = 'auto';
      return { left: clampedLeft, top: clampedTop };
    }

    function ensureInViewport() {
      if (!container || !container.style.left || container.style.left === 'auto') return;
      if (!container.style.top || container.style.top === 'auto') return;
      const curLeft = parseFloat(container.style.left);
      const curTop = parseFloat(container.style.top);
      if (Number.isFinite(curLeft) && Number.isFinite(curTop)) {
        applyPosition(curLeft, curTop);
      }
    }

    let winListenersAttached = false;
    let cancelActiveDrag = () => {};

    function handleWinResize() {
      const w = getWindow();
      if (w && (w.innerWidth < 120 || w.innerHeight < 120)) return;
      ensureInViewport();
    }

    function handleWinBlur() {
      if (typeof cancelActiveDrag === 'function') {
        cancelActiveDrag();
      }
    }

    function attachWinListeners() {
      if (winListenersAttached) return;
      const win = getWindow();
      if (win && typeof win.addEventListener === 'function') {
        win.addEventListener('resize', handleWinResize);
        win.addEventListener('blur', handleWinBlur);
        win.addEventListener('pagehide', handleWinBlur);
        win.addEventListener('beforeunload', handleWinBlur);
        winListenersAttached = true;
      }
    }

    function detachWinListeners() {
      if (!winListenersAttached) return;
      const win = getWindow();
      if (win && typeof win.removeEventListener === 'function') {
        win.removeEventListener('resize', handleWinResize);
        win.removeEventListener('blur', handleWinBlur);
        win.removeEventListener('pagehide', handleWinBlur);
        win.removeEventListener('beforeunload', handleWinBlur);
      }
      winListenersAttached = false;
    }

    function mount() {
      if (container && container.isConnected) return container;
      if (docCleanup) {
        try { docCleanup(); } catch (_) {}
        docCleanup = null;
      }
      attachWinListeners();
      lastRenderSignature = '';
      lastLogSignature = '';
      lastMinimized = null;
      const existing = document.getElementById('gmah-hud');
      if (existing) existing.remove();

      container = el('div');
      container.id = 'gmah-hud';
      container.setAttribute('data-gmah-ignore', 'true');

      const card = el('div', 'gmah-card');

      // Header (Acts as draggable handle when left mouse button is pressed)
      const header = el('div', 'gmah-header');
      const title = el('div', 'gmah-title');
      const dot = el('span', 'gmah-dot');
      const titleText = el('span', '', tr('hudTitle'));
      const betaBadge = el('span', 'gmah-badge-beta', tr('betaBadge'));
      betaBadge.title = tr('betaBadgeTitle');
      title.appendChild(dot);
      title.appendChild(titleText);
      title.appendChild(betaBadge);
      title.title = tr('hudTitleTip');

      const headerActions = el('div', 'gmah-header-actions');

      const langBtn = el('button', 'gmah-icon-btn gmah-lang-btn', tr('langLabel'));
      langBtn.type = 'button';
      langBtn.title = tr('langCycleTip');

      const themeBtn = el('button', 'gmah-icon-btn gmah-theme-btn', '☀');
      themeBtn.type = 'button';
      themeBtn.title = tr('themeToggleToLight');

      const minBtn = el('button', 'gmah-icon-btn', '−');
      minBtn.type = 'button';
      minBtn.title = tr('minBtnTitle');

      headerActions.appendChild(langBtn);
      headerActions.appendChild(themeBtn);
      headerActions.appendChild(minBtn);

      header.appendChild(title);
      header.appendChild(headerActions);

      // Body
      const body = el('div', 'gmah-body');

      // Scope Bar: Notion-style segmented switcher (This Chat vs Global) + Chat Label + Reset
      const scopeBar = el('div', 'gmah-scope-bar');
      const scopeTabs = el('div', 'gmah-scope-tabs');
      const btnScopeChat = el('button', 'gmah-scope-tab active', tr('scopeChat'));
      btnScopeChat.type = 'button';
      btnScopeChat.title = tr('scopeChatTip');
      const btnScopeGlobal = el('button', 'gmah-scope-tab', tr('scopeGlobal'));
      btnScopeGlobal.type = 'button';
      btnScopeGlobal.title = tr('scopeGlobalTip');
      scopeTabs.appendChild(btnScopeChat);
      scopeTabs.appendChild(btnScopeGlobal);

      const scopeMeta = el('div', 'gmah-scope-meta');
      const chatChip = el('span', 'gmah-chat-chip', tr('chatLabelNew'));
      const btnScopeReset = el('button', 'gmah-scope-reset', tr('scopeResetBtn'));
      btnScopeReset.type = 'button';
      btnScopeReset.title = tr('scopeResetTip');
      btnScopeReset.style.display = 'none';
      scopeMeta.appendChild(chatChip);
      scopeMeta.appendChild(btnScopeReset);

      scopeBar.appendChild(scopeTabs);
      scopeBar.appendChild(scopeMeta);

      // Row 1: Master toggle
      const rowMaster = el('div', 'gmah-row');
      const lblMasterWrap = el('span', 'gmah-row-label');
      const lblMaster = el('span', '', tr('hudRowMaster'));
      const dotMasterCustom = el('span', 'gmah-override-dot');
      lblMasterWrap.appendChild(lblMaster);
      lblMasterWrap.appendChild(dotMasterCustom);
      rowMaster.appendChild(lblMasterWrap);
      const btnMaster = el('button', 'gmah-pill');
      btnMaster.type = 'button';
      rowMaster.appendChild(btnMaster);

      // Row 2: Auto Allow
      const rowAllow = el('div', 'gmah-row');
      const lblAllowWrap = el('span', 'gmah-row-label');
      const lblAllow = el('span', '', tr('hudRowAllow'));
      const dotAllowCustom = el('span', 'gmah-override-dot');
      lblAllowWrap.appendChild(lblAllow);
      lblAllowWrap.appendChild(dotAllowCustom);
      rowAllow.appendChild(lblAllowWrap);
      const btnAllow = el('button', 'gmah-pill');
      btnAllow.type = 'button';
      rowAllow.appendChild(btnAllow);

      // Row 3: Auto Continue
      const rowContinue = el('div', 'gmah-row');
      const lblContinueWrap = el('span', 'gmah-row-label');
      const lblContinue = el('span', '', tr('hudRowContinue'));
      const dotContinueCustom = el('span', 'gmah-override-dot');
      lblContinueWrap.appendChild(lblContinue);
      lblContinueWrap.appendChild(dotContinueCustom);
      rowContinue.appendChild(lblContinueWrap);
      const btnContinue = el('button', 'gmah-pill');
      btnContinue.type = 'button';
      rowContinue.appendChild(btnContinue);

      // Row 4: Background Mode
      const rowBackground = el('div', 'gmah-row');
      const lblBackgroundWrap = el('span', 'gmah-row-label');
      const lblBackground = el('span', '', tr('hudRowBackground'));
      const dotBackgroundCustom = el('span', 'gmah-override-dot');
      lblBackgroundWrap.appendChild(lblBackground);
      lblBackgroundWrap.appendChild(dotBackgroundCustom);
      rowBackground.appendChild(lblBackgroundWrap);
      const btnBackground = el('button', 'gmah-pill');
      btnBackground.type = 'button';
      rowBackground.appendChild(btnBackground);

      // Row 5: Desktop Notification Toggle
      const rowNotification = el('div', 'gmah-row');
      const lblNotificationWrap = el('span', 'gmah-row-label');
      const lblNotification = el('span', '', tr('hudRowNotif'));
      const dotNotificationCustom = el('span', 'gmah-override-dot');
      lblNotificationWrap.appendChild(lblNotification);
      lblNotificationWrap.appendChild(dotNotificationCustom);
      rowNotification.appendChild(lblNotificationWrap);
      const btnNotification = el('button', 'gmah-pill');
      btnNotification.type = 'button';
      rowNotification.appendChild(btnNotification);

      // Row 6: Stall Auto-Recovery Toggle + Immediate Force-Recover Action Button
      const rowStallRecover = el('div', 'gmah-row');
      const lblStallRecoverWrap = el('span', 'gmah-row-label');
      const lblStallRecover = el('span', '', tr('hudRowStallRecover'));
      const dotStallRecoverCustom = el('span', 'gmah-override-dot');
      lblStallRecoverWrap.appendChild(lblStallRecover);
      lblStallRecoverWrap.appendChild(dotStallRecoverCustom);
      rowStallRecover.appendChild(lblStallRecoverWrap);
      const stallRecoverControls = el('div', 'gmah-row-controls');
      const btnForceRecover = el('button', 'gmah-pill gmah-pill-action', tr('btnForceRecover'));
      btnForceRecover.type = 'button';
      btnForceRecover.title = tr('btnForceRecoverTip', {
        prompt: (D && D.DEFAULT_SETTINGS && D.DEFAULT_SETTINGS.stallAutoRecoverPrompt) || '继续，刚才mcp连接断开了'
      });
      const btnStallRecover = el('button', 'gmah-pill');
      btnStallRecover.type = 'button';
      stallRecoverControls.appendChild(btnForceRecover);
      stallRecoverControls.appendChild(btnStallRecover);
      rowStallRecover.appendChild(stallRecoverControls);

      // Live connection / wait elapsed timer bar (shown when waiting/connecting)
      const waitBar = el('div', 'gmah-wait-bar');
      waitBar.style.display = 'none';

      // Status box
      const statusBox = el('div', 'gmah-status', tr('hudInit'));
      statusBox.style.whiteSpace = 'pre-line';

      // Action buttons
      const actions = el('div', 'gmah-actions');
      const btnEmergency = el('button', 'gmah-action-stop', tr('btnEmergency'));
      btnEmergency.type = 'button';
      const btnInspect = el('button', '', tr('btnInspect'));
      btnInspect.type = 'button';
      const btnLogs = el('button', '', tr('btnLogs'));
      btnLogs.type = 'button';
      actions.appendChild(btnEmergency);
      actions.appendChild(btnInspect);
      actions.appendChild(btnLogs);

      // Collapsible Panel
      const panel = el('div', 'gmah-panel');

      body.appendChild(scopeBar);
      body.appendChild(rowMaster);
      body.appendChild(rowAllow);
      body.appendChild(rowContinue);
      body.appendChild(rowBackground);
      body.appendChild(rowNotification);
      body.appendChild(rowStallRecover);
      body.appendChild(waitBar);
      body.appendChild(statusBox);
      body.appendChild(actions);
      body.appendChild(panel);

      card.appendChild(header);
      card.appendChild(body);
      container.appendChild(card);

      // Dragging logic: strictly requires pressing left mouse button on header
      let isPointerDown = false;
      let isDragging = false;
      let hasDragged = false;
      let activeInputMode = null; // null | 'pointer' | 'mouse'
      let activePointerId = null;
      let hasDraggedResetTimer = null;
      let startPointerX = 0;
      let startPointerY = 0;
      let startElemLeft = 0;
      let startElemTop = 0;
      let lastHandledDragEvent = null;

      function isDuplicateEvent(e) {
        if (!e) return false;
        if (lastHandledDragEvent === e) return true;
        lastHandledDragEvent = e;
        return false;
      }

      function getEventCoords(e) {
        const clientX = e && e.clientX !== undefined ? e.clientX : (e && e.pageX !== undefined ? e.pageX : 0);
        const clientY = e && e.clientY !== undefined ? e.clientY : (e && e.pageY !== undefined ? e.pageY : 0);
        return { x: clientX, y: clientY };
      }

      function isInteractiveControl(target) {
        let cur = target;
        while (cur && cur !== header) {
          const tag = cur.tagName ? String(cur.tagName).toUpperCase() : '';
          if (tag === 'BUTTON' || tag === 'SELECT' || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'A') {
            return true;
          }
          cur = cur.parentNode || cur.parentElement || null;
        }
        return false;
      }

      function releaseCaptureSafe(pointerId) {
        if (pointerId !== null && typeof header.releasePointerCapture === 'function') {
          try {
            header.releasePointerCapture(pointerId);
          } catch (_) {}
        }
      }

      function onDragStart(mode, e) {
        if (!e) return;
        if (e.button !== undefined && e.button !== 0) return;
        if (activeInputMode && activeInputMode !== mode) return;
        if (isInteractiveControl(e.target)) return;

        if (hasDraggedResetTimer) {
          clearTimeout(hasDraggedResetTimer);
          hasDraggedResetTimer = null;
        }

        const coords = getEventCoords(e);
        startPointerX = coords.x;
        startPointerY = coords.y;
        isPointerDown = true;
        isDragging = false;
        hasDragged = false;
        activeInputMode = mode;
        activePointerId = e.pointerId !== undefined ? e.pointerId : null;

        let rect = null;
        try {
          if (container.getBoundingClientRect) rect = container.getBoundingClientRect();
        } catch (_) {}
        if (!rect) rect = { width: 262, height: 290 };
        const win = getWindow();
        const vw = (win && typeof win.innerWidth === 'number') ? win.innerWidth : 1024;
        const vh = (win && typeof win.innerHeight === 'number') ? win.innerHeight : 768;
        const w = (rect && rect.width) || 262;
        const h = (rect && rect.height) || 290;

        if (container.style.left && container.style.left !== 'auto') {
          startElemLeft = parseFloat(container.style.left) || 0;
        } else if (rect.left !== undefined) {
          startElemLeft = rect.left;
        } else {
          startElemLeft = vw - w - 18;
        }

        if (container.style.top && container.style.top !== 'auto') {
          startElemTop = parseFloat(container.style.top) || 0;
        } else if (rect.top !== undefined) {
          startElemTop = rect.top;
        } else {
          startElemTop = vh - h - 84;
        }
      }

      function onDragMove(mode, e) {
        if (!isPointerDown || !e || isDuplicateEvent(e)) return;
        if (activeInputMode && activeInputMode !== mode) return;
        if (typeof e.buttons === 'number' && (e.buttons & 1) === 0) {
          // Left button was released off-screen: finalize at current HUD coordinates without jumping
          const capturedId = activePointerId;
          const wasDragging = isDragging;
          isPointerDown = false;
          isDragging = false;
          activeInputMode = null;
          activePointerId = null;
          if (wasDragging) {
            const curLeft = parseFloat(container.style.left);
            const curTop = parseFloat(container.style.top);
            if (Number.isFinite(curLeft) && Number.isFinite(curTop)) {
              savePosition({ left: curLeft, top: curTop });
            }
            removeClass(container, 'gmah-dragging');
            hasDragged = true;
            hasDraggedResetTimer = setTimeout(() => {
              hasDragged = false;
              hasDraggedResetTimer = null;
            }, 250);
          }
          releaseCaptureSafe(capturedId);
          return;
        }

        const coords = getEventCoords(e);
        const dx = coords.x - startPointerX;
        const dy = coords.y - startPointerY;

        if (!isDragging) {
          if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
            isDragging = true;
            hasDragged = true;
            addClass(container, 'gmah-dragging');
            // Capture pointer ONLY once drag threshold is exceeded so regular clicks hit title/buttons normally
            if (mode === 'pointer' && activePointerId !== null && typeof header.setPointerCapture === 'function') {
              try {
                header.setPointerCapture(activePointerId);
              } catch (_) {}
            }
          }
        }

        if (isDragging) {
          if (typeof e.preventDefault === 'function') e.preventDefault();
          applyPosition(startElemLeft + dx, startElemTop + dy);
        }
      }

      function onDragEnd(mode, e) {
        if (isDuplicateEvent(e)) return;
        if (activeInputMode && activeInputMode !== mode) return;
        if (!isPointerDown && !isDragging) return;

        const wasDragging = isDragging;
        const capturedId = activePointerId;
        isPointerDown = false;
        isDragging = false;
        activeInputMode = null;
        activePointerId = null;

        if (wasDragging) {
          const coords = getEventCoords(e);
          const dx = coords.x - startPointerX;
          const dy = coords.y - startPointerY;
          const finalPos = applyPosition(startElemLeft + dx, startElemTop + dy);
          savePosition(finalPos);
          removeClass(container, 'gmah-dragging');
          hasDragged = true;
          hasDraggedResetTimer = setTimeout(() => {
            hasDragged = false;
            hasDraggedResetTimer = null;
          }, 250);
        }
        releaseCaptureSafe(capturedId);
      }

      cancelActiveDrag = function() {
        if (!isPointerDown && !isDragging) return;
        const capturedId = activePointerId;
        const wasDragging = isDragging;
        isPointerDown = false;
        isDragging = false;
        hasDragged = false;
        activeInputMode = null;
        activePointerId = null;
        if (wasDragging && container && container.style) {
          const curLeft = parseFloat(container.style.left);
          const curTop = parseFloat(container.style.top);
          if (Number.isFinite(curLeft) && Number.isFinite(curTop)) {
            savePosition({ left: curLeft, top: curTop });
          }
        }
        removeClass(container, 'gmah-dragging');
        releaseCaptureSafe(capturedId);
        ensureInViewport();
      };

      const onHeaderPointerDown = (e) => onDragStart('pointer', e);
      const onHeaderPointerMove = (e) => onDragMove('pointer', e);
      const onHeaderPointerUp = (e) => onDragEnd('pointer', e);
      const onHeaderPointerCancel = () => cancelActiveDrag();
      const onHeaderMouseDown = (e) => onDragStart('mouse', e);
      const onHeaderMouseMove = (e) => onDragMove('mouse', e);
      const onHeaderMouseUp = (e) => onDragEnd('mouse', e);

      header.addEventListener('pointerdown', onHeaderPointerDown);
      header.addEventListener('pointermove', onHeaderPointerMove);
      header.addEventListener('pointerup', onHeaderPointerUp);
      header.addEventListener('pointercancel', onHeaderPointerCancel);
      header.addEventListener('mousedown', onHeaderMouseDown);
      header.addEventListener('mousemove', onHeaderMouseMove);
      header.addEventListener('mouseup', onHeaderMouseUp);

      function handleDocPointerMove(e) {
        if (isPointerDown) onDragMove('pointer', e);
      }
      function handleDocPointerUp(e) {
        if (isPointerDown || isDragging) onDragEnd('pointer', e);
      }
      function handleDocMouseMove(e) {
        if (isPointerDown) onDragMove('mouse', e);
      }
      function handleDocMouseUp(e) {
        if (isPointerDown || isDragging) onDragEnd('mouse', e);
      }
      if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
        document.addEventListener('pointermove', handleDocPointerMove);
        document.addEventListener('pointerup', handleDocPointerUp);
        document.addEventListener('pointercancel', cancelActiveDrag);
        document.addEventListener('mousemove', handleDocMouseMove);
        document.addEventListener('mouseup', handleDocMouseUp);
      }

      docCleanup = () => {
        if (hasDraggedResetTimer) {
          clearTimeout(hasDraggedResetTimer);
          hasDraggedResetTimer = null;
        }
        if (typeof document !== 'undefined' && typeof document.removeEventListener === 'function') {
          document.removeEventListener('pointermove', handleDocPointerMove);
          document.removeEventListener('pointerup', handleDocPointerUp);
          document.removeEventListener('pointercancel', cancelActiveDrag);
          document.removeEventListener('mousemove', handleDocMouseMove);
          document.removeEventListener('mouseup', handleDocMouseUp);
        }
      };

      // Event bindings
      function handleToggleMin(e) {
        if (hasDragged || isDragging) {
          if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
          return;
        }
        if (cb.onToggleMinimize) cb.onToggleMinimize();
      }
      title.addEventListener('click', handleToggleMin);
      minBtn.addEventListener('click', handleToggleMin);

      themeBtn.addEventListener('click', (e) => {
        if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
        if (cb.onToggleTheme) cb.onToggleTheme();
      });
      langBtn.addEventListener('click', (e) => {
        if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
        if (cb.onCycleLanguage) cb.onCycleLanguage();
      });

      btnScopeChat.addEventListener('click', () => {
        if (editScope === 'chat') return;
        editScope = 'chat';
        lastRenderSignature = '';
        if (currentState) update(currentState);
      });
      btnScopeGlobal.addEventListener('click', () => {
        if (editScope === 'global') return;
        editScope = 'global';
        lastRenderSignature = '';
        if (currentState) update(currentState);
      });
      btnScopeReset.addEventListener('click', () => {
        if (cb.onResetChatOverride) cb.onResetChatOverride();
      });

      btnMaster.addEventListener('click', () => {
        if (cb.onToggleEnabled) cb.onToggleEnabled(editScope);
      });
      btnAllow.addEventListener('click', () => {
        if (cb.onToggleAllow) cb.onToggleAllow(editScope);
      });
      btnContinue.addEventListener('click', () => {
        if (cb.onToggleContinue) cb.onToggleContinue(editScope);
      });
      btnBackground.addEventListener('click', () => {
        if (cb.onToggleBackground) cb.onToggleBackground(editScope);
      });
      btnNotification.addEventListener('click', () => {
        if (cb.onToggleNotification) cb.onToggleNotification(editScope);
      });
      btnStallRecover.addEventListener('click', () => {
        if (cb.onToggleStallRecover) cb.onToggleStallRecover(editScope);
      });
      btnForceRecover.addEventListener('click', () => {
        if (cb.onForceStallRecover) cb.onForceStallRecover();
      });
      btnEmergency.addEventListener('click', () => {
        if (currentState && currentState.circuitBreaker && currentState.circuitBreaker.tripped) {
          if (cb.onResetBreaker) cb.onResetBreaker();
        } else if (cb.onEmergencyStop) {
          cb.onEmergencyStop();
        }
      });
      btnLogs.addEventListener('click', () => {
        activePanel = activePanel === 'logs' ? null : 'logs';
        renderPanel();
      });
      btnInspect.addEventListener('click', () => {
        activePanel = activePanel === 'inspect' ? null : 'inspect';
        renderPanel();
      });

      els = {
        card,
        header,
        dot,
        title,
        titleText,
        betaBadge,
        langBtn,
        themeBtn,
        minBtn,
        body,
        scopeBar,
        btnScopeChat,
        btnScopeGlobal,
        chatChip,
        btnScopeReset,
        rowMaster,
        lblMaster,
        dotMasterCustom,
        btnMaster,
        rowAllow,
        lblAllow,
        dotAllowCustom,
        btnAllow,
        rowContinue,
        lblContinue,
        dotContinueCustom,
        btnContinue,
        rowBackground,
        lblBackground,
        dotBackgroundCustom,
        btnBackground,
        rowNotification,
        lblNotification,
        dotNotificationCustom,
        btnNotification,
        rowStallRecover,
        lblStallRecover,
        dotStallRecoverCustom,
        btnStallRecover,
        btnForceRecover,
        waitBar,
        statusBox,
        btnEmergency,
        btnInspect,
        btnLogs,
        panel
      };

      (document.body || document.documentElement).appendChild(container);

      // Restore saved position
      const savedPos = (cb && cb.initialPosition) || loadSavedPosition();
      if (savedPos && typeof savedPos.left === 'number' && typeof savedPos.top === 'number') {
        applyPosition(savedPos.left, savedPos.top);
      }
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        try {
          chrome.storage.local.get([STORAGE_POS_KEY], (res) => {
            if (isDragging || isPointerDown) return;
            if (res && res[STORAGE_POS_KEY] && typeof res[STORAGE_POS_KEY].left === 'number') {
              applyPosition(res[STORAGE_POS_KEY].left, res[STORAGE_POS_KEY].top);
            }
          });
        } catch (_) {}
      }

      if (currentState) update(currentState);
      return container;
    }

    function renderPanel() {
      if (els.btnLogs) {
        els.btnLogs.className = activePanel === 'logs' ? 'gmah-action-active' : '';
      }
      if (els.btnInspect) {
        els.btnInspect.className = activePanel === 'inspect' ? 'gmah-action-active' : '';
      }
      if (!els.panel) return;
      if (!activePanel) {
        els.panel.className = 'gmah-panel';
        els.panel.textContent = '';
        return;
      }

      els.panel.className = 'gmah-panel open';
      els.panel.textContent = '';

      if (activePanel === 'logs') {
        const logs = (currentState && currentState.logs) || [];
        if (logs.length > 0 && cb.onClearLogs) {
          const toolbar = el('div', 'gmah-panel-toolbar');
          const countLabel = el('span', 'gmah-panel-meta', `${tr('btnLogs')} (${logs.length})`);
          const clearBtn = el('button', 'gmah-panel-mini-btn', tr('logsClearBtn'));
          clearBtn.type = 'button';
          clearBtn.addEventListener('click', () => {
            if (cb.onClearLogs) cb.onClearLogs();
          });
          toolbar.appendChild(countLabel);
          toolbar.appendChild(clearBtn);
          els.panel.appendChild(toolbar);
        }
        if (logs.length === 0) {
          els.panel.appendChild(el('div', 'gmah-log-item', tr('logsEmpty')));
        } else {
          for (const item of logs) {
            els.panel.appendChild(el('div', 'gmah-log-item', `[${item.time}] ${item.message}`));
          }
        }
        ensureInViewport();
        return;
      }

      if (activePanel === 'inspect') {
        const candidates = cb.onInspectButtons ? cb.onInspectButtons() : [];
        const toolbar = el('div', 'gmah-panel-toolbar');
        const hint = el(
          'span',
          'gmah-panel-meta',
          candidates.length > 0
            ? tr('inspectFound', { count: candidates.length })
            : tr('inspectNone')
        );
        const refreshBtn = el('button', 'gmah-panel-mini-btn', tr('inspectRefreshBtn'));
        refreshBtn.type = 'button';
        refreshBtn.addEventListener('click', () => renderPanel());
        toolbar.appendChild(hint);
        toolbar.appendChild(refreshBtn);
        els.panel.appendChild(toolbar);

        for (const item of candidates) {
          const wrap = el('div', 'gmah-log-item');
          const labelSpan = el('span', '', `「${item.text}」 `);
          wrap.appendChild(labelSpan);

          const addAllow = el('button', 'gmah-inspect-btn', tr('inspectAddAllow'));
          addAllow.type = 'button';
          addAllow.addEventListener('click', () => {
            if (cb.onAddKeyword) cb.onAddKeyword('allow', item.text);
            addAllow.textContent = tr('inspectAddedAllow');
            addAllow.disabled = true;
          });

          const addCont = el('button', 'gmah-inspect-btn', tr('inspectAddCont'));
          addCont.type = 'button';
          addCont.addEventListener('click', () => {
            if (cb.onAddKeyword) cb.onAddKeyword('continue', item.text);
            addCont.textContent = tr('inspectAddedCont');
            addCont.disabled = true;
          });

          wrap.appendChild(addAllow);
          wrap.appendChild(addCont);
          els.panel.appendChild(wrap);
        }
        ensureInViewport();
      }
    }

    function update(state) {
      currentState = state;
      if (!container || !els.card) return;

      const s = state.settings;
      const g = state.globalSettings || s;
      const chatOverride = state.chatOverride && typeof state.chatOverride === 'object' ? state.chatOverride : {};
      const hasChatOverride = Boolean(
        state.hasChatOverride ||
          (D && typeof D.hasChatOverrideChanges === 'function' && D.hasChatOverrideChanges(chatOverride))
      );
      const effectiveScope = state.isNonChatPage ? 'global' : editScope;
      const view = effectiveScope === 'global' ? g : s;
      const stats = state.stats;
      const cbState = state.circuitBreaker;
      const lang = getLang();

      const logs = (state && state.logs) || [];
      const logSig = logs.length > 0 ? `${logs.length}|${logs[0].time}|${logs[0].message}` : '0';
      const waitSec = Math.floor((state.stallElapsedMs || 0) / 1000);
      const waitLabel = state.stallConnectingLabel || '';
      const overrideSig = [
        chatOverride.enabled === true ? '1' : chatOverride.enabled === false ? '0' : '-',
        chatOverride.autoAllow === true ? '1' : chatOverride.autoAllow === false ? '0' : '-',
        chatOverride.autoContinue === true ? '1' : chatOverride.autoContinue === false ? '0' : '-',
        chatOverride.backgroundMode === true ? '1' : chatOverride.backgroundMode === false ? '0' : '-',
        chatOverride.stallAlertEnabled === true ? '1' : chatOverride.stallAlertEnabled === false ? '0' : '-',
        chatOverride.stallAutoRecoverEnabled === true ? '1' : chatOverride.stallAutoRecoverEnabled === false ? '0' : '-',
        chatOverride.emergencyStopped ? 'E' : '-'
      ].join('');
      const renderSig = [
        effectiveScope,
        state.conversationKey || '',
        hasChatOverride ? 1 : 0,
        overrideSig,
        s.showHud ? 1 : 0,
        s.theme,
        lang,
        s.hudMinimized ? 1 : 0,
        s.enabled ? 1 : 0,
        s.autoAllow ? 1 : 0,
        s.autoContinue ? 1 : 0,
        s.backgroundMode ? 1 : 0,
        s.stallAlertEnabled ? 1 : 0,
        s.stallAutoRecoverEnabled ? 1 : 0,
        g.enabled ? 1 : 0,
        g.autoAllow ? 1 : 0,
        g.autoContinue ? 1 : 0,
        g.backgroundMode ? 1 : 0,
        g.stallAlertEnabled ? 1 : 0,
        g.stallAutoRecoverEnabled ? 1 : 0,
        s.stallAutoRecoverMinutes || 5,
        s.stallAutoRecoverPrompt || '',
        s.maxContinuesPerTask,
        s.dailyContinueLimit,
        stats.allowCount,
        stats.continueCount,
        state.taskContinueCount,
        state.isGenerating ? 1 : 0,
        state.isNonChatPage ? 1 : 0,
        state.stallAlertActive ? 1 : 0,
        state.stallRecoveryActive ? 1 : 0,
        state.stallRecoveryCount || 0,
        waitSec,
        waitLabel,
        cbState.tripped ? 1 : 0,
        cbState.reasonCode || '',
        cbState.reason || '',
        state.lastStatusText || '',
        logSig
      ].join('|');

      if (renderSig === lastRenderSignature) {
        return;
      }
      lastRenderSignature = renderSig;

      container.style.display = s.showHud ? 'block' : 'none';
      if (!s.showHud) return;

      // Apply Light/Dark theme
      if (s.theme === 'light') {
        addClass(container, 'gmah-theme-light');
      } else {
        removeClass(container, 'gmah-theme-light');
      }

      // Update localized labels
      els.titleText.textContent = tr('hudTitle');
      els.betaBadge.textContent = tr('betaBadge');
      els.betaBadge.title = tr('betaBadgeTitle');
      els.title.title = tr('hudTitleTip');
      els.minBtn.title = tr('minBtnTitle');
      if (els.langBtn) {
        els.langBtn.textContent = tr('langLabel');
        els.langBtn.title = tr('langCycleTip');
      }
      if (els.themeBtn) {
        els.themeBtn.textContent = s.theme === 'light' ? '☾' : '☀';
        els.themeBtn.title = s.theme === 'light' ? tr('themeToggleToDark') : tr('themeToggleToLight');
      }

      // Scope Bar update
      if (els.scopeBar) {
        els.scopeBar.style.display = state.isNonChatPage ? 'none' : 'flex';
      }
      if (els.btnScopeChat) {
        els.btnScopeChat.textContent = tr('scopeChat');
        els.btnScopeChat.title = tr('scopeChatTip');
        els.btnScopeChat.className = effectiveScope === 'chat' ? 'gmah-scope-tab active' : 'gmah-scope-tab';
      }
      if (els.btnScopeGlobal) {
        els.btnScopeGlobal.textContent = tr('scopeGlobal');
        els.btnScopeGlobal.title = tr('scopeGlobalTip');
        els.btnScopeGlobal.className = effectiveScope === 'global' ? 'gmah-scope-tab active' : 'gmah-scope-tab';
      }
      if (els.chatChip) {
        const chatLabel =
          D && typeof D.formatConversationLabel === 'function'
            ? D.formatConversationLabel(state.conversationKey, lang)
            : tr('chatLabelNew');
        els.chatChip.textContent = chatLabel;
        els.chatChip.className = hasChatOverride ? 'gmah-chat-chip custom' : 'gmah-chat-chip';
        els.chatChip.title = hasChatOverride ? tr('scopeChatCustom') : tr('scopeFollowGlobal');
      }
      if (els.btnScopeReset) {
        els.btnScopeReset.textContent = tr('scopeResetBtn');
        els.btnScopeReset.title = tr('scopeResetTip');
        els.btnScopeReset.style.display = hasChatOverride ? 'inline-flex' : 'none';
      }

      els.lblMaster.textContent = tr('hudRowMaster');
      els.lblAllow.textContent = tr('hudRowAllow');
      els.lblContinue.textContent = tr('hudRowContinue');
      els.lblBackground.textContent = tr('hudRowBackground');
      els.lblNotification.textContent = tr('hudRowNotif');
      if (els.lblStallRecover) {
        els.lblStallRecover.textContent = tr('hudRowStallRecover');
      }
      els.btnInspect.textContent = tr('btnInspect');
      els.btnLogs.textContent = tr('btnLogs');

      const markOverride = (rowNode, dotNode, key) => {
        const isOverridden = effectiveScope === 'chat' && typeof chatOverride[key] === 'boolean';
        if (rowNode) {
          rowNode.className = isOverridden ? 'gmah-row gmah-row-custom' : 'gmah-row';
        }
        if (dotNode) {
          dotNode.style.display = isOverridden ? 'inline-block' : 'none';
          dotNode.title = isOverridden ? tr('scopeChatCustom') : '';
        }
      };
      markOverride(els.rowMaster, els.dotMasterCustom, 'enabled');
      markOverride(els.rowAllow, els.dotAllowCustom, 'autoAllow');
      markOverride(els.rowContinue, els.dotContinueCustom, 'autoContinue');
      markOverride(els.rowBackground, els.dotBackgroundCustom, 'backgroundMode');
      markOverride(els.rowNotification, els.dotNotificationCustom, 'stallAlertEnabled');
      markOverride(els.rowStallRecover, els.dotStallRecoverCustom, 'stallAutoRecoverEnabled');

      // Minimized state
      const wasMinimized = lastMinimized;
      lastMinimized = Boolean(s.hudMinimized);
      if (s.hudMinimized) {
        els.card.className = 'gmah-card minimized';
        els.body.style.display = 'none';
        els.minBtn.textContent = '+';
      } else {
        els.card.className = 'gmah-card';
        els.body.style.display = 'flex';
        els.minBtn.textContent = '−';
        if (wasMinimized === true) {
          ensureInViewport();
        }
      }

      // Status dot (always reflects effective state of current conversation)
      let dotClass = 'gmah-dot';
      if (cbState.tripped) {
        dotClass += cbState.reasonCode === 'emergency_stop' ? ' stopped' : ' warn';
      } else if (state.stallAlertActive || state.stallRecoveryActive) {
        dotClass += ' warn';
      } else if (s.enabled && (s.autoAllow || s.autoContinue)) {
        dotClass += ' active';
      }
      els.dot.className = dotClass;

      // Master pill
      els.btnMaster.textContent = view.enabled ? tr('stateRunning') : tr('statePaused');
      els.btnMaster.className = view.enabled ? 'gmah-pill on' : 'gmah-pill';

      // Auto Allow pill
      els.btnAllow.textContent = view.autoAllow ? tr('stateOn') : tr('stateOff');
      els.btnAllow.className = view.autoAllow ? 'gmah-pill on' : 'gmah-pill';

      // Auto Continue pill
      els.btnContinue.textContent = view.autoContinue ? tr('stateOn') : tr('stateOff');
      els.btnContinue.className = view.autoContinue ? 'gmah-pill on' : 'gmah-pill';

      // Background Mode pill
      if (els.btnBackground) {
        els.btnBackground.textContent = view.backgroundMode ? tr('stateOn') : tr('stateForeground');
        els.btnBackground.className = view.backgroundMode ? 'gmah-pill on' : 'gmah-pill';
      }

      // Desktop Notification pill
      if (els.btnNotification) {
        const notifOn = Boolean(view.stallAlertEnabled);
        els.btnNotification.textContent = notifOn ? tr('stateOn') : tr('stateOff');
        els.btnNotification.className = notifOn ? 'gmah-pill on' : 'gmah-pill';
        els.btnNotification.title = notifOn ? tr('notifPillDisableTip') : tr('notifPillEnableTip');
      }

      // Stall Auto-Recovery pill & immediate action button
      if (els.btnStallRecover) {
        const recOn = Boolean(view.stallAutoRecoverEnabled);
        els.btnStallRecover.textContent = recOn ? tr('stateOn') : tr('stateOff');
        els.btnStallRecover.className = recOn ? 'gmah-pill on' : 'gmah-pill';
        els.btnStallRecover.title = recOn ? tr('stallRecoverPillDisableTip') : tr('stallRecoverPillEnableTip');
      }
      if (els.btnForceRecover) {
        const promptText =
          s.stallAutoRecoverPrompt ||
          (D && D.DEFAULT_SETTINGS && D.DEFAULT_SETTINGS.stallAutoRecoverPrompt) ||
          '继续，刚才mcp连接断开了';
        els.btnForceRecover.textContent = tr('btnForceRecover');
        els.btnForceRecover.title = tr('btnForceRecoverTip', { prompt: promptText });
        els.btnForceRecover.disabled = Boolean(
          state.isNonChatPage ||
            (cbState.tripped && cbState.reasonCode === 'emergency_stop')
        );
      }

      // Live connection / wait elapsed duration bar
      if (els.waitBar) {
        const elapsedMs = Number(state.stallElapsedMs) || 0;
        const showWaitBar = Boolean(
          s.enabled &&
            !state.isNonChatPage &&
            !cbState.tripped &&
            !state.stallRecoveryActive &&
            (elapsedMs >= 1000 || Boolean(waitLabel))
        );
        if (showWaitBar) {
          const elapsedStr =
            D && typeof D.formatWaitDuration === 'function'
              ? D.formatWaitDuration(elapsedMs, lang)
              : `${Math.floor(elapsedMs / 1000)}s`;
          const limitMins = Math.max(1, Number(s.stallAutoRecoverMinutes) || 5);
          if (s.stallAutoRecoverEnabled) {
            els.waitBar.textContent = waitLabel
              ? tr('hudWaitConnecting', { label: waitLabel, elapsed: elapsedStr, limit: limitMins })
              : tr('hudWaitElapsed', { elapsed: elapsedStr, limit: limitMins });
          } else {
            els.waitBar.textContent = waitLabel
              ? tr('hudWaitConnectingNoLimit', { label: waitLabel, elapsed: elapsedStr })
              : tr('hudWaitElapsedNoLimit', { elapsed: elapsedStr });
          }
          const nearThreshold = s.stallAutoRecoverEnabled && elapsedMs >= limitMins * 60 * 1000 * 0.6;
          els.waitBar.className = nearThreshold || state.stallAlertActive ? 'gmah-wait-bar warn' : 'gmah-wait-bar';
          els.waitBar.style.display = 'block';
        } else {
          els.waitBar.style.display = 'none';
          els.waitBar.textContent = '';
        }
      }

      // Emergency / Reset button (scoped to current conversation)
      if (cbState.tripped) {
        els.btnEmergency.textContent = tr('btnResetBreaker');
        els.btnEmergency.className = 'gmah-pill danger';
        els.btnEmergency.title = tr('chatResumeBtn');
      } else {
        els.btnEmergency.textContent = tr('btnEmergency');
        els.btnEmergency.className = 'gmah-action-stop';
        els.btnEmergency.title = tr('chatEmergencyBtn');
      }

      // Status text
      const dailyCapLabel = s.dailyContinueLimit > 0 ? String(s.dailyContinueLimit) : '∞';
      const countsText = tr('hudCounts', {
        allow: stats.allowCount,
        task: state.taskContinueCount,
        max: s.maxContinuesPerTask,
        daily: stats.continueCount,
        cap: dailyCapLabel
      });
      if (cbState.tripped) {
        els.statusBox.className = 'gmah-status alert';
        els.statusBox.textContent = `${tr('hudStatusBreaker', { reason: cbState.reason })}\n${countsText}`;
      } else if (!s.enabled) {
        els.statusBox.className = 'gmah-status';
        els.statusBox.textContent = `${tr('hudStatusPaused')}\n${countsText}`;
      } else if (state.stallRecoveryActive) {
        els.statusBox.className = 'gmah-status alert';
        els.statusBox.textContent = `${state.lastStatusText || tr('hudStatusStallFallback')}\n${countsText}`;
      } else if (state.stallAlertActive) {
        els.statusBox.className = 'gmah-status alert';
        els.statusBox.textContent = `${state.lastStatusText || tr('hudStatusStallFallback')}\n${countsText}`;
      } else if (state.isGenerating) {
        els.statusBox.className = 'gmah-status';
        els.statusBox.textContent = `${tr('hudStatusGenerating')}\n${countsText}`;
      } else if (state.isNonChatPage) {
        els.statusBox.className = 'gmah-status';
        els.statusBox.textContent = `${tr('hudStatusNonChat')}\n${countsText}`;
      } else {
        const statusLine = state.lastStatusText || tr('hudStatusMonitoring');
        els.statusBox.className = 'gmah-status';
        els.statusBox.textContent = `${statusLine}\n${countsText}`;
      }

      const langChanged = lastLang !== null && lastLang !== lang;
      lastLang = lang;
      if (activePanel && langChanged) {
        renderPanel();
      } else if (activePanel === 'logs') {
        const logs = (state && state.logs) || [];
        const sig = logs.length > 0 ? `${logs.length}|${logs[0].time}|${logs[0].message}` : '0';
        if (sig !== lastLogSignature) {
          lastLogSignature = sig;
          renderPanel();
        }
      }
    }

    function unmount() {
      detachWinListeners();
      if (docCleanup) {
        try { docCleanup(); } catch (_) {}
        docCleanup = null;
      }
      if (container && container.parentNode) {
        container.parentNode.removeChild(container);
      }
      container = null;
      els = {};
    }

    return {
      mount,
      unmount,
      update,
      getScope: () => editScope,
      setScope: (scope) => {
        editScope = scope === 'global' ? 'global' : 'chat';
        lastRenderSignature = '';
        if (currentState) update(currentState);
      },
      getActivePanel: () => activePanel,
      setActivePanel: (mode) => {
        activePanel = mode;
        renderPanel();
      },
      getPosition: () => ({
        left: container && container.style.left ? parseFloat(container.style.left) : null,
        top: container && container.style.top ? parseFloat(container.style.top) : null
      }),
      setPosition: (pos) => (pos ? applyPosition(pos.left, pos.top) : null),
      resetPosition: () => {
        const ls = getLocalStorage();
        if (ls && typeof ls.removeItem === 'function') {
          try { ls.removeItem(STORAGE_POS_KEY); } catch (_) {}
        }
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local && typeof chrome.storage.local.remove === 'function') {
          try { chrome.storage.local.remove([STORAGE_POS_KEY]); } catch (_) {}
        }
        if (!container) return;
        container.style.left = '';
        container.style.top = '';
        container.style.right = '18px';
        container.style.bottom = '84px';
      }
    };
  }

  root.GMAH_HUD = { createHud };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { createHud };
  }
})(typeof globalThis !== 'undefined' ? globalThis : window);
