(function (root) {
  'use strict';

  function createHud(callbacks) {
    const cb = callbacks || {};
    let container = null;
    let els = {};
    let activePanel = null; // null | 'logs' | 'inspect'
    let currentState = null;
    let lastLogSignature = '';

    function el(tag, className, text) {
      const node = document.createElement(tag);
      if (className) node.className = className;
      if (typeof text === 'string') node.textContent = text;
      return node;
    }

    function mount() {
      if (container && container.isConnected) return container;
      const existing = document.getElementById('gmah-hud');
      if (existing) existing.remove();

      container = el('div');
      container.id = 'gmah-hud';
      container.setAttribute('data-gmah-ignore', 'true');

      const card = el('div', 'gmah-card');

      // Header
      const header = el('div', 'gmah-header');
      const title = el('div', 'gmah-title');
      const dot = el('span', 'gmah-dot');
      const titleText = el('span', '', 'MCP 助手');
      title.appendChild(dot);
      title.appendChild(titleText);
      title.title = '点击折叠或展开面板';

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
      body.appendChild(statusBox);
      body.appendChild(actions);
      body.appendChild(panel);

      card.appendChild(header);
      card.appendChild(body);
      container.appendChild(card);

      // Event bindings
      function handleToggleMin() {
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
        statusBox,
        btnEmergency,
        btnInspect,
        btnLogs,
        panel
      };

      (document.body || document.documentElement).appendChild(container);
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
          });

          const addCont = el('button', 'gmah-inspect-btn', '+继续词');
          addCont.type = 'button';
          addCont.addEventListener('click', () => {
            if (cb.onAddKeyword) cb.onAddKeyword('continue', item.text);
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
      }
    };
  }

  root.GMAH_HUD = { createHud };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { createHud };
  }
})(typeof globalThis !== 'undefined' ? globalThis : window);
