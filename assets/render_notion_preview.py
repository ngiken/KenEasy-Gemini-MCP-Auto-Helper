import os
import subprocess
import base64
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS_DIR = os.path.join(ROOT, 'assets')
CHROME_PATH = r'C:\Program Files\Google\Chrome\Application\chrome.exe'


def run_chrome_screenshot(html_path, output_png, width, height, dpr=2):
    cmd = [
        CHROME_PATH,
        '--headless=new',
        '--disable-gpu',
        '--hide-scrollbars',
        '--virtual-time-budget=2000',
        f'--window-size={width},{height}',
        f'--force-device-scale-factor={dpr}',
        f'--screenshot={os.path.abspath(output_png)}',
        os.path.abspath(html_path)
    ]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if not os.path.exists(output_png):
        raise RuntimeError(f'Chrome failed to render {output_png}: {res.stderr}')
    im = Image.open(output_png)
    w, h = im.size
    print(f'Rendered {os.path.basename(output_png)}: {w}x{h} ({os.path.getsize(output_png)} bytes)')
    im.close()


def build_popup_harness(theme='dark'):
    with open(os.path.join(ROOT, 'popup.html'), 'r', encoding='utf-8') as f:
        raw_html = f.read()

    mock_chrome = f"""
<style>
  /* Remove popup max-height clipping ONLY for full-height inspection screenshot */
  body {{ max-height: none !important; overflow: visible !important; }}
</style>
<script>
(function() {{
  const theme = {theme!r};
  const globalSettings = {{
    settingsVersion: 5,
    language: 'zh-CN',
    theme: theme,
    enabled: true,
    autoAllow: true,
    preferAlwaysAllow: true,
    fallbackSingleAllow: true,
    autoContinue: true,
    backgroundMode: true,
    preventTabDiscard: true,
    showHud: true,
    hudMinimized: false,
    maxContinuesPerTask: 10,
    dailyContinueLimit: 0,
    continueCooldownMs: 4000,
    idleSettleMs: 1800,
    stopOnCompletionCues: true,
    stopOnStagnantOutput: true,
    stopOnQuotaOrError: true,
    humanPacingEnabled: true,
    stallAlertEnabled: true,
    stallAlertMinutes: 5,
    stallAutoRecoverEnabled: true,
    stallAutoRecoverMinutes: 5,
    maxStallRecoveriesPerTask: 3,
    stallAutoRecoverPrompt: '继续，刚才mcp连接断开了',
    customAlwaysAllowKeywords: [],
    customContinueKeywords: []
  }};
  const today = new Date();
  const dateKey = today.getFullYear() + '-' + String(today.getMonth()+1).padStart(2,'0') + '-' + String(today.getDate()).padStart(2,'0');
  const chatOverride = {{ autoContinue: false }};
  const effectiveSettings = Object.assign({{}}, globalSettings, chatOverride);
  const tabState = {{
    conversationKey: 'chat:a1b2c3d4e5',
    settings: effectiveSettings,
    globalSettings: globalSettings,
    chatOverride: chatOverride,
    hasChatOverride: true,
    isNonChatPage: false,
    stallAlertActive: false,
    stallElapsedMs: 0,
    circuitBreaker: {{ tripped: false, reasonCode: null, reason: '' }}
  }};
  window.chrome = {{
    runtime: {{ lastError: null, sendMessage: function(_m, cb) {{ if (cb) cb({{ ok: true }}); }} }},
    windows: {{ getLastFocused: function(cb) {{ cb({{ id: 1 }}); }} }},
    storage: {{
      local: {{
        get: function(_keys, cb) {{
          cb({{
            gmah_settings_v1: globalSettings,
            gmah_stats_v1: {{ date: dateKey, allowCount: 18, continueCount: 6 }}
          }});
        }},
        set: function(_obj, cb) {{ if (cb) cb(); }}
      }}
    }},
    tabs: {{
      query: function(_q, cb) {{ cb([{{ id: 101, windowId: 1, active: true, highlighted: true }}]); }},
      sendMessage: function(_id, _msg, cb) {{ cb({{ ok: true, state: tabState }}); }}
    }}
  }};
}})();
</script>
"""
    return raw_html.replace('<script src="defaults.js"></script>', mock_chrome + '\n  <script src="defaults.js"></script>')


def build_hud_harness(theme='dark', with_logs=False):
    bg_color = '#ffffff' if theme == 'light' else '#131314'
    grid_color = 'rgba(55, 53, 47, 0.04)' if theme == 'light' else 'rgba(255, 255, 255, 0.03)'
    return f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <link rel="stylesheet" href="hud.css" />
  <style>
    html, body {{
      margin: 0;
      padding: 0;
      width: 340px;
      height: {610 if with_logs else 460}px;
      background: {bg_color};
      background-image: radial-gradient({grid_color} 1px, transparent 1px);
      background-size: 16px 16px;
      overflow: hidden;
    }}
    #gmah-hud {{
      left: 33px !important;
      top: 26px !important;
      right: auto !important;
      bottom: auto !important;
    }}
  </style>
</head>
<body>
  <script src="defaults.js"></script>
  <script src="hud.js"></script>
  <script>
    (function() {{
      const D = window.GMAH_DEFAULTS;
      const globalSettings = D.mergeSettings({{
        language: 'zh-CN',
        theme: {theme!r},
        enabled: true,
        autoAllow: true,
        autoContinue: true,
        backgroundMode: true,
        stallAlertEnabled: true,
        stallAutoRecoverEnabled: true,
        showHud: true,
        hudMinimized: false
      }});
      const chatOverride = {{ autoContinue: false }};
      const effectiveSettings = D.resolveEffectiveSettings(globalSettings, chatOverride);
      const hud = window.GMAH_HUD.createHud({{
        onClearLogs: function() {{}},
        onInspectButtons: function() {{ return [{{ text: '始终允许' }}, {{ text: '继续' }}]; }}
      }});
      hud.mount();
      hud.update({{
        conversationKey: 'chat:a1b2c3d4e5',
        settings: effectiveSettings,
        globalSettings: globalSettings,
        chatOverride: chatOverride,
        hasChatOverride: true,
        isNonChatPage: false,
        isGenerating: false,
        stallAlertActive: false,
        stallRecoveryActive: false,
        stallElapsedMs: 72000,
        stallConnectingLabel: '正在连接 Desktop Commander',
        taskContinueCount: 3,
        lastStatusText: '监控中',
        stats: {{ date: D.getTodayKey(), allowCount: 18, continueCount: 6 }},
        circuitBreaker: {{ tripped: false, reasonCode: null, reason: '' }},
        logs: [
          {{ time: '03:08:12', message: '🎛️ 本对话独立设置：自动点击继续 -> 已关闭' }},
          {{ time: '03:07:45', message: '✅ 自动点击[始终允许] [后台]：「始终允许」' }},
          {{ time: '03:06:18', message: '⚡ 后台主世界点击升级：「继续」 (2/4)' }}
        ]
      }});
      if ({'true' if with_logs else 'false'}) {{
        hud.setActivePanel('logs');
      }}
    }})();
  </script>
</body>
</html>
"""


def img_to_b64(path):
    with open(path, 'rb') as f:
        return 'data:image/png;base64,' + base64.b64encode(f.read()).decode('utf-8')


def main():
    os.makedirs(ASSETS_DIR, exist_ok=True)
    tmp_files = []
    try:
        # 1. Render real Popup (Dark & Light)
        popup_dark_html = os.path.join(ROOT, '_tmp_popup_dark.html')
        popup_light_html = os.path.join(ROOT, '_tmp_popup_light.html')
        popup_dark_png = os.path.join(ASSETS_DIR, 'notion-popup-dark.png')
        popup_light_png = os.path.join(ASSETS_DIR, 'notion-popup-light.png')
        tmp_files.extend([popup_dark_html, popup_light_html])

        with open(popup_dark_html, 'w', encoding='utf-8') as f:
            f.write(build_popup_harness('dark'))
        with open(popup_light_html, 'w', encoding='utf-8') as f:
            f.write(build_popup_harness('light'))

        run_chrome_screenshot(popup_dark_html, popup_dark_png, width=382, height=1120, dpr=2)
        run_chrome_screenshot(popup_light_html, popup_light_png, width=382, height=1120, dpr=2)

        # 2. Render real HUD (Dark + Light, with logs expanded on Dark)
        hud_dark_html = os.path.join(ROOT, '_tmp_hud_dark.html')
        hud_light_html = os.path.join(ROOT, '_tmp_hud_light.html')
        hud_dark_png = os.path.join(ASSETS_DIR, 'notion-hud-dark.png')
        hud_light_png = os.path.join(ASSETS_DIR, 'notion-hud-light.png')
        tmp_files.extend([hud_dark_html, hud_light_html])

        with open(hud_dark_html, 'w', encoding='utf-8') as f:
            f.write(build_hud_harness('dark', with_logs=True))
        with open(hud_light_html, 'w', encoding='utf-8') as f:
            f.write(build_hud_harness('light', with_logs=False))

        run_chrome_screenshot(hud_dark_html, hud_dark_png, width=340, height=610, dpr=2)
        run_chrome_screenshot(hud_light_html, hud_light_png, width=340, height=460, dpr=2)

        # 3. Compose side-by-side Notion UI Showcase Board
        showcase_html = os.path.join(ROOT, '_tmp_notion_showcase.html')
        showcase_png = os.path.join(ASSETS_DIR, 'notion-ui-preview.png')
        tmp_files.append(showcase_html)

        board = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<style>
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{
    width: 1400px;
    height: 1020px;
    background: #f7f6f3;
    color: #37352f;
    font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, "PingFang SC", "Microsoft YaHei", sans-serif;
    padding: 28px 34px;
    display: flex;
    flex-direction: column;
    gap: 18px;
  }}
  .top {{
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    border-bottom: 1px solid rgba(55, 53, 47, 0.1);
    padding-bottom: 12px;
  }}
  .top h1 {{
    font-size: 20px;
    font-weight: 700;
    letter-spacing: -0.02em;
  }}
  .top span {{
    font-size: 12.5px;
    color: #787774;
  }}
  .grid {{
    flex: 1;
    display: grid;
    grid-template-columns: 390px 390px 1fr;
    gap: 24px;
    align-items: start;
  }}
  .col {{
    display: flex;
    flex-direction: column;
    gap: 10px;
  }}
  .col-label {{
    font-size: 11.5px;
    font-weight: 600;
    color: #787774;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }}
  .shot-frame {{
    background: #ffffff;
    border: 1px solid rgba(55, 53, 47, 0.12);
    border-radius: 10px;
    overflow: hidden;
    box-shadow: 0 6px 20px rgba(15, 15, 15, 0.06);
  }}
  .shot-frame.dark {{
    background: #191919;
    border-color: rgba(15, 15, 15, 0.25);
  }}
  .shot-frame img {{
    display: block;
    width: 100%;
    height: auto;
  }}
  .popup-crop {{
    max-height: 870px;
    overflow: hidden;
  }}
  .hud-stack {{
    display: flex;
    flex-direction: column;
    gap: 18px;
  }}
  .hud-card-wrap {{
    display: flex;
    flex-direction: column;
    gap: 8px;
  }}
  .hud-box {{
    display: flex;
    justify-content: center;
    padding: 8px;
    border-radius: 10px;
    border: 1px solid rgba(55, 53, 47, 0.12);
  }}
  .hud-box.light {{ background: #ffffff; }}
  .hud-box.dark {{ background: #131314; border-color: rgba(15, 15, 15, 0.25); }}
  .hud-box img {{
    width: 310px;
    height: auto;
    display: block;
  }}
</style>
</head>
<body>
  <div class="top">
    <h1>KenEasy Gemini MCP Auto Helper · Notion Style UI Preview</h1>
    <span>Real DOM Capture · Paper Light &amp; Charcoal Dark · Per-Chat Scope &amp; Isolated Emergency Stop</span>
  </div>
  <div class="grid">
    <div class="col">
      <div class="col-label"><span>Popup · Light (Paper)</span><span>382px</span></div>
      <div class="shot-frame popup-crop"><img src="{img_to_b64(popup_light_png)}" alt="Popup Light" /></div>
    </div>
    <div class="col">
      <div class="col-label"><span>Popup · Dark (Charcoal)</span><span>382px</span></div>
      <div class="shot-frame dark popup-crop"><img src="{img_to_b64(popup_dark_png)}" alt="Popup Dark" /></div>
    </div>
    <div class="hud-stack">
      <div class="hud-card-wrap">
        <div class="col-label"><span>Floating HUD · Light (Scope Bar + Wait Timer)</span><span>274px</span></div>
        <div class="hud-box light"><img src="{img_to_b64(hud_light_png)}" alt="HUD Light" /></div>
      </div>
      <div class="hud-card-wrap">
        <div class="col-label"><span>Floating HUD · Dark (Logs Panel Expanded)</span><span>274px</span></div>
        <div class="hud-box dark"><img src="{img_to_b64(hud_dark_png)}" alt="HUD Dark" /></div>
      </div>
    </div>
  </div>
</body>
</html>
"""
        with open(showcase_html, 'w', encoding='utf-8') as f:
            f.write(board)
        run_chrome_screenshot(showcase_html, showcase_png, width=1400, height=1020, dpr=2)
    finally:
        for p in tmp_files:
            if os.path.exists(p):
                os.remove(p)


if __name__ == '__main__':
    main()
