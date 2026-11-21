(function (root) {
  'use strict';

  function createHud(callbacks) {
    const cb = callbacks || {};
    let container = null;
    let els = {};
    let activePanel = null; // null | 'logs' | 'inspect'
    let currentState = null;
    let lastLogSignature = '';
    let docCleanup = null;

    const STORAGE_POS_KEY = 'gmah_hud_position';

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
      const r = (container.getBoundingClientRect && container.getBoundingClientRect()) || { width: 248, height: 280 };
      const width = (r && typeof r.width === 'number' && r.width > 0) ? r.width : 248;
      const height = (r && typeof r.height === 'number' && r.height > 0) ? r.height : 280;

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

    function mount() {
      if (container && container.isConnected) return container;
      const existing = document.getElementById('gmah-hud');
      if (existing) existing.remove();

      container = el('div');
      container.id = 'gmah-hud';
      container.setAttribute('data-gmah-ignore', 'true');

      const card = el('div', 'gmah-card');

      // Header (Acts as draggable handle)
      const header = el('div', 'gmah-header');
      const title = el('div', 'gmah-title');
      const dot = el('span', 'gmah-dot');
      const titleText = el('span', '', 'MCP 助手');
      const betaBadge = el('span', 'gmah-badge-beta', 'v0.1 Beta');
      betaBadge.title = '公开测试预览版 (Beta Preview)';
      title.appendChild(dot);
      title.appendChild(titleText);
      title.appendChild(betaBadge);
      title.title = '按住可自由拖拽 · 点击折叠展开 · v0.1 Beta 预览版';

      const minBtn = el('button', 'gmah-icon-btn', '−');
      minBtn.type = 'button';
      minBtn.title = '最小化 / 展开';

      header.appendChild(title);
      header.appendChild(minBtn);

      // Body
      const body = el('div', 'gmah-body');

      // Row 1: Master toggle
      const rowMaster = el('div', 'gmah-row');
      rowMaster.appendChild(el('span', '', '插件状态'));
      const btnMaster = el('button', 'gmah-pill');
      btnMaster.type = 'button';
      rowMaster.appendChild(btnMaster);

      // Row 2: Auto Allow
      const rowAllow = el('div', 'gmah-row');
      rowAllow.appendChild(el('span', '', '自动始终允许'));
      const btnAllow = el('button', 'gmah-pill');
      btnAllow.type = 'button';
      rowAllow.appendChild(btnAllow);

      // Row 3: Auto Continue
      const rowContinue = el('div', 'gmah-row');
      rowContinue.appendChild(el('span', '', '自动点击继续'));
      const btnContinue = el('button', 'gmah-pill');
      btnContinue.type = 'button';
      rowContinue.appendChild(btnContinue);

      // Row 4: Background Mode
      const rowBackground = el('div', 'gmah-row');
      rowBackground.appendChild(el('span', '', '后台切屏运行'));
      const btnBackground = el('button', 'gmah-pill');
      btnBackground.type = 'button';
      rowBackground.appendChild(btnBackground);

      // Row 5: Desktop Notification Toggle
      const rowNotification = el('div', 'gmah-row');
      rowNotification.appendChild(el('span', '', '桌面通知'));
      const btnNotification = el('button', 'gmah-pill');
      btnNotification.type = 'button';
      rowNotification.appendChild(btnNotification);

      // Status box
      const statusBox = el('div', 'gmah-status', '初始化中...');
      statusBox.style.whiteSpace = 'pre-line';

      // Action buttons
      const actions = el('div', 'gmah-actions');
      const btnEmergency = el('button', '', '紧急停止');
      btnEmergency.type = 'button';
      const btnInspect = el('button', '', '探测按钮');
      btnInspect.type = 'button';
      const btnLogs = el('button', '', '日志');
      btnLogs.type = 'button';
      actions.appendChild(btnEmergency);
      actions.appendChild(btnInspect);
      actions.appendChild(btnLogs);

      // Collapsible Panel
      const panel = el('div', 'gmah-panel');

      body.appendChild(rowMaster);
      body.appendChild(rowAllow);
      body.appendChild(rowContinue);
      body.appendChild(rowBackground);
      body.appendChild(rowNotification);
      body.appendChild(statusBox);
      body.appendChild(actions);
      body.appendChild(panel);

      card.appendChild(header);
      card.appendChild(body);
      container.appendChild(card);

      // Dragging logic
      let isDragging = false;
      let hasDragged = false;
      let startPointerX = 0;
      let startPointerY = 0;
      let startElemLeft = 0;
      let startElemTop = 0;

      function getEventCoords(e) {
        const clientX = e.clientX !== undefined ? e.clientX : (e.pageX !== undefined ? e.pageX : 0);
        const clientY = e.clientY !== undefined ? e.clientY : (e.pageY !== undefined ? e.pageY : 0);
        return { x: clientX, y: clientY };
      }

      function onDragStart(e) {
        if (e.button !== undefined && e.button !== 0) return;
        const coords = getEventCoords(e);
        startPointerX = coords.x;
        startPointerY = coords.y;
        hasDragged = false;
        isDragging = false;

        const rect = (container.getBoundingClientRect && container.getBoundingClientRect()) || { width: 248, height: 280 };
        const win = getWindow();
        const vw = (win && typeof win.innerWidth === 'number') ? win.innerWidth : 1024;
        const vh = (win && typeof win.innerHeight === 'number') ? win.innerHeight : 768;
        const w = (rect && rect.width) || 248;
        const h = (rect && rect.height) || 280;

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

        if (typeof header.setPointerCapture === 'function' && e.pointerId !== undefined) {
          try {
            header.setPointerCapture(e.pointerId);
          } catch (_) {}
        }
      }

      function onDragMove(e) {
        const coords = getEventCoords(e);
        const dx = coords.x - startPointerX;
        const dy = coords.y - startPointerY;

        if (!isDragging) {
          if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
            isDragging = true;
            hasDragged = true;
            addClass(container, 'gmah-dragging');
          }
        }

        if (isDragging) {
          applyPosition(startElemLeft + dx, startElemTop + dy);
        }
      }

      function onDragEnd(e) {
        if (isDragging) {
          const coords = getEventCoords(e);
          const dx = coords.x - startPointerX;
          const dy = coords.y - startPointerY;
          const finalPos = applyPosition(startElemLeft + dx, startElemTop + dy);
          savePosition(finalPos);
          isDragging = false;
          removeClass(container, 'gmah-dragging');
          setTimeout(() => {
            hasDragged = false;
          }, 80);
        } else {
          isDragging = false;
        }
        if (typeof header.releasePointerCapture === 'function' && e.pointerId !== undefined) {
          try {
            header.releasePointerCapture(e.pointerId);
          } catch (_) {}
        }
      }

      header.addEventListener('pointerdown', onDragStart);
      header.addEventListener('pointermove', onDragMove);
      header.addEventListener('pointerup', onDragEnd);
      header.addEventListener('pointercancel', onDragEnd);
      header.addEventListener('mousedown', onDragStart);
      header.addEventListener('mousemove', onDragMove);
      header.addEventListener('mouseup', onDragEnd);

      function handleDocMove(e) {
        if (isDragging) onDragMove(e);
      }
      function handleDocUp(e) {
        if (isDragging) onDragEnd(e);
      }
      if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
        document.addEventListener('pointermove', handleDocMove);
        document.addEventListener('pointerup', handleDocUp);
        document.addEventListener('mousemove', handleDocMove);
        document.addEventListener('mouseup', handleDocUp);
      }

      docCleanup = () => {
        if (typeof document !== 'undefined' && typeof document.removeEventListener === 'function') {
          document.removeEventListener('pointermove', handleDocMove);
          document.removeEventListener('pointerup', handleDocUp);
          document.removeEventListener('mousemove', handleDocMove);
          document.removeEventListener('mouseup', handleDocUp);
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

      btnMaster.addEventListener('click', () => {
        if (cb.onToggleEnabled) cb.onToggleEnabled();
      });
      btnAllow.addEventListener('click', () => {
        if (cb.onToggleAllow) cb.onToggleAllow();
      });
      btnContinue.addEventListener('click', () => {
        if (cb.onToggleContinue) cb.onToggleContinue();
      });
      btnBackground.addEventListener('click', () => {
        if (cb.onToggleBackground) cb.onToggleBackground();
      });
      btnNotification.addEventListener('click', () => {
        if (cb.onToggleNotification) cb.onToggleNotification();
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
        dot,
        titleText,
        minBtn,
        body,
        btnMaster,
        btnAllow,
        btnContinue,
        btnBackground,
        btnNotification,
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
        if (logs.length === 0) {
          els.panel.appendChild(el('div', 'gmah-log-item', '暂无操作记录'));
          return;
        }
        for (const item of logs) {
          els.panel.appendChild(el('div', 'gmah-log-item', `[${item.time}] ${item.message}`));
        }
        return;
      }

      if (activePanel === 'inspect') {
        const candidates = cb.onInspectButtons ? cb.onInspectButtons() : [];
        const hint = el(
          'div',
          'gmah-log-item',
          candidates.length > 0
            ? `发现 ${candidates.length} 个可见按钮（点击添加到规则）：`
            : '当前页面未发现可点击按钮'
        );
        els.panel.appendChild(hint);

        for (const item of candidates) {
          const wrap = el('div', 'gmah-log-item');
          const labelSpan = el('span', '', `「${item.text}」 `);
          wrap.appendChild(labelSpan);

          const addAllow = el('button', 'gmah-inspect-btn', '+允许词');
          addAllow.type = 'button';
          addAllow.addEventListener('click', () => {
            if (cb.onAddKeyword) cb.onAddKeyword('allow', item.text);
            addAllow.textContent = '已加允许 ✓';
            addAllow.disabled = true;
          });

          const addCont = el('button', 'gmah-inspect-btn', '+继续词');
          addCont.type = 'button';
          addCont.addEventListener('click', () => {
            if (cb.onAddKeyword) cb.onAddKeyword('continue', item.text);
            addCont.textContent = '已加继续 ✓';
            addCont.disabled = true;
          });

          wrap.appendChild(addAllow);
          wrap.appendChild(addCont);
          els.panel.appendChild(wrap);
        }
      }
    }

    function update(state) {
      currentState = state;
      if (!container || !els.card) return;

      const s = state.settings;
      const stats = state.stats;
      const cbState = state.circuitBreaker;

      container.style.display = s.showHud ? 'block' : 'none';
      if (!s.showHud) return;

      // Minimized state
      if (s.hudMinimized) {
        els.card.className = 'gmah-card minimized';
        els.body.style.display = 'none';
        els.minBtn.textContent = '+';
      } else {
        els.card.className = 'gmah-card';
        els.body.style.display = 'flex';
        els.minBtn.textContent = '−';
      }

      // Status dot
      let dotClass = 'gmah-dot';
      if (cbState.tripped) {
        dotClass += cbState.reasonCode === 'emergency_stop' ? ' stopped' : ' warn';
      } else if (state.stallAlertActive) {
        dotClass += ' warn';
      } else if (s.enabled && (s.autoAllow || s.autoContinue)) {
        dotClass += ' active';
      }
      els.dot.className = dotClass;

      // Master pill
      els.btnMaster.textContent = s.enabled ? '运行中' : '已暂停';
      els.btnMaster.className = s.enabled ? 'gmah-pill on' : 'gmah-pill';

      // Auto Allow pill
      els.btnAllow.textContent = s.autoAllow ? '已开启' : '已关闭';
      els.btnAllow.className = s.autoAllow ? 'gmah-pill on' : 'gmah-pill';

      // Auto Continue pill
      els.btnContinue.textContent = s.autoContinue ? '已开启' : '已关闭';
      els.btnContinue.className = s.autoContinue ? 'gmah-pill on' : 'gmah-pill';

      // Background Mode pill
      if (els.btnBackground) {
        els.btnBackground.textContent = s.backgroundMode ? '已开启' : '仅前台';
        els.btnBackground.className = s.backgroundMode ? 'gmah-pill on' : 'gmah-pill';
      }

      // Desktop Notification pill
      if (els.btnNotification) {
        const notifOn = Boolean(s.stallAlertEnabled);
        els.btnNotification.textContent = notifOn ? '已开启' : '已关闭';
        els.btnNotification.className = notifOn ? 'gmah-pill on' : 'gmah-pill';
        els.btnNotification.title = notifOn ? '点击关闭连接超时桌面通知' : '点击开启连接超时桌面通知';
      }

      // Emergency / Reset button
      if (cbState.tripped) {
        els.btnEmergency.textContent = '解除熔断';
        els.btnEmergency.className = 'gmah-pill danger';
      } else {
        els.btnEmergency.textContent = '紧急停止';
        els.btnEmergency.className = '';
      }

      // Status text
      const dailyCapLabel = s.dailyContinueLimit > 0 ? String(s.dailyContinueLimit) : '∞';
      const countsText = `允许 ${stats.allowCount} · 本次继续 ${state.taskContinueCount}/${s.maxContinuesPerTask} · 今日 ${stats.continueCount}/${dailyCapLabel}`;
      if (cbState.tripped) {
        els.statusBox.className = 'gmah-status alert';
        els.statusBox.textContent = `熔断: ${cbState.reason}\n${countsText}`;
      } else if (!s.enabled) {
        els.statusBox.className = 'gmah-status';
        els.statusBox.textContent = `已暂停监控\n${countsText}`;
      } else if (state.stallAlertActive) {
        els.statusBox.className = 'gmah-status alert';
        els.statusBox.textContent = `${state.lastStatusText || '⚠️ 连接超时无进展'}\n${countsText}`;
      } else if (state.isGenerating) {
        els.statusBox.className = 'gmah-status';
        els.statusBox.textContent = `Gemini 输出中（等待完成后检测继续）\n${countsText}`;
      } else {
        els.statusBox.className = 'gmah-status';
        els.statusBox.textContent = `${state.lastStatusText || '监控中'}\n${countsText}`;
      }

      if (activePanel === 'logs') {
        const logs = (state && state.logs) || [];
        const sig = logs.length > 0 ? `${logs.length}|${logs[0].time}|${logs[0].message}` : '0';
        if (sig !== lastLogSignature) {
          lastLogSignature = sig;
          renderPanel();
        }
      }
    }

    function unmount() {
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
        if (!container) return;
        container.style.left = '';
        container.style.top = '';
        container.style.right = '18px';
        container.style.bottom = '84px';
        savePosition(null);
      }
    };
  }

  root.GMAH_HUD = { createHud };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { createHud };
  }
})(typeof globalThis !== 'undefined' ? globalThis : window);
