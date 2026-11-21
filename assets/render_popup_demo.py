import os
import subprocess
import base64
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS_DIR = os.path.join(ROOT, 'assets')
ICONS_DIR = os.path.join(ROOT, 'icons')
CHROME_PATH = r'C:\Program Files\Google\Chrome\Application\chrome.exe'


def get_icon_b64(name='icon128.png'):
    p = os.path.join(ICONS_DIR, name)
    if os.path.exists(p):
        with open(p, 'rb') as f:
            return 'data:image/png;base64,' + base64.b64encode(f.read()).decode('utf-8')
    return ''


def render_html_to_png(html_content, output_png_path, width=1200, height=700, dpr=2):
    os.makedirs(ASSETS_DIR, exist_ok=True)
    temp_html = os.path.join(ASSETS_DIR, '_temp_render.html')
    with open(temp_html, 'w', encoding='utf-8') as f:
        f.write(html_content)

    cmd = [
        CHROME_PATH,
        '--headless=new',
        '--disable-gpu',
        '--hide-scrollbars',
        f'--window-size={width},{height}',
        f'--force-device-scale-factor={dpr}',
        f'--screenshot={os.path.abspath(output_png_path)}',
        os.path.abspath(temp_html)
    ]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if os.path.exists(temp_html):
        os.remove(temp_html)

    if not os.path.exists(output_png_path):
        raise RuntimeError(f"Failed to render {output_png_path}: {res.stderr}")

    im = Image.open(output_png_path)
    if im.size != (width, height):
        im = im.resize((width, height), Image.Resampling.LANCZOS)
        im.save(output_png_path, 'PNG', optimize=True)
    else:
        im.close()

    print(f"Generated: {output_png_path} ({os.path.getsize(output_png_path)} bytes, {width}x{height})")


def render_popup_demo():
    icon_b64 = get_icon_b64('icon128.png')
    html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<style>
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{
    width: 1200px;
    height: 700px;
    background: #070b14;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif;
    color: #f8fafc;
    overflow: hidden;
    position: relative;
    padding: 26px 34px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 16px;
  }}

  .aura-left {{
    position: absolute; width: 520px; height: 520px; border-radius: 50%;
    background: radial-gradient(circle, rgba(59, 130, 246, 0.16) 0%, transparent 68%);
    top: -120px; left: -120px; pointer-events: none;
  }}
  .aura-right {{
    position: absolute; width: 540px; height: 540px; border-radius: 50%;
    background: radial-gradient(circle, rgba(255, 255, 255, 0.08) 0%, transparent 68%);
    bottom: -140px; right: 200px; pointer-events: none;
  }}

  /* Header */
  .top-header {{
    position: relative; z-index: 2;
    display: flex; align-items: center; justify-content: space-between;
  }}
  .h-left {{ display: flex; align-items: center; gap: 13px; }}
  .h-left img {{ width: 40px; height: 40px; border-radius: 10px; }}
  .h-title {{ font-size: 22px; font-weight: 800; color: #fff; display: flex; align-items: center; gap: 10px; }}
  .v-badge {{
    font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 999px;
    background: rgba(59, 130, 246, 0.2); border: 1px solid rgba(96, 165, 250, 0.45); color: #93c5fd;
  }}
  .h-sub {{ font-size: 13px; color: #94a3b8; margin-top: 2px; }}
  .theme-pill {{
    padding: 6px 14px; border-radius: 999px; font-size: 12px; font-weight: 600;
    background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.14); color: #e2e8f0;
  }}

  /* Main Stage: Dual Popups + Right Highlight Rail */
  .stage {{
    position: relative; z-index: 2;
    flex: 1;
    display: grid;
    grid-template-columns: 355px 355px 1fr;
    gap: 20px;
    align-items: stretch;
  }}

  .popup-col {{
    display: flex; flex-direction: column; gap: 8px;
  }}
  .col-label {{
    text-align: center; font-size: 11.5px; font-weight: 700;
    padding: 4px 10px; border-radius: 999px; align-self: center;
  }}
  .lbl-dark {{ background: rgba(30, 41, 59, 0.9); color: #93c5fd; border: 1px solid rgba(96, 165, 250, 0.35); }}
  .lbl-light {{ background: #ffffff; color: #0f172a; border: 1px solid rgba(255, 255, 255, 0.3); }}

  /* Shared Popup Mockup Geometry */
  .p-box {{
    flex: 1;
    border-radius: 15px;
    padding: 12px;
    display: flex; flex-direction: column; justify-content: space-between; gap: 8px;
    font-size: 10.5px;
  }}
  .p-dark {{
    background: #14161a; color: #e8eaed;
    border: 1px solid rgba(255, 255, 255, 0.15);
    box-shadow: 0 22px 48px rgba(0, 0, 0, 0.6);
  }}
  .p-light {{
    background: #f4f6fb; color: #111827;
    border: 1px solid rgba(255, 255, 255, 0.35);
    box-shadow: 0 22px 52px rgba(0, 0, 0, 0.55), 0 0 32px rgba(96, 165, 250, 0.18);
  }}

  .p-hdr {{ display: flex; justify-content: space-between; align-items: center; }}
  .p-brand {{ display: flex; align-items: center; gap: 8px; }}
  .p-brand img {{ width: 26px; height: 26px; border-radius: 7px; }}
  .p-h1 {{ font-size: 12.5px; font-weight: 700; display: flex; align-items: center; gap: 5px; }}
  .p-beta-d {{ font-size: 9px; padding: 1px 5px; border-radius: 999px; background: rgba(138,180,248,0.16); color: #8ab4f8; border: 1px solid rgba(138,180,248,0.4); }}
  .p-beta-l {{ font-size: 9px; padding: 1px 5px; border-radius: 999px; background: rgba(37,99,235,0.1); color: #1d4ed8; border: 1px solid rgba(37,99,235,0.3); }}
  .p-sub {{ font-size: 9.5px; opacity: 0.65; }}
  .p-sw {{ width: 34px; height: 18px; border-radius: 999px; background: #34a853; position: relative; }}
  .p-sw::after {{ content: ""; position: absolute; width: 13px; height: 13px; border-radius: 50%; background: #fff; right: 2.5px; top: 2.5px; }}

  .app-bar {{
    display: flex; align-items: center; justify-content: space-between; gap: 8px;
    padding: 5px 8px; border-radius: 9px;
  }}
  .p-dark .app-bar, .p-dark .p-card, .p-dark .p-stat {{
    background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.08);
  }}
  .p-light .app-bar, .p-light .p-card, .p-light .p-stat {{
    background: #ffffff; border: 1px solid rgba(15, 23, 42, 0.1);
  }}
  .lang-sel {{
    flex: 1; padding: 3px 7px; border-radius: 6px; font-size: 10.5px;
  }}
  .p-dark .lang-sel {{ background: rgba(0, 0, 0, 0.35); border: 1px solid rgba(255, 255, 255, 0.14); color: #e8eaed; }}
  .p-light .lang-sel {{ background: #f8fafc; border: 1px solid rgba(15, 23, 42, 0.14); color: #0f172a; }}
  .t-btn {{ padding: 3px 8px; border-radius: 6px; font-size: 10px; font-weight: 600; }}
  .p-dark .t-btn {{ background: rgba(255, 255, 255, 0.08); color: #e8eaed; }}
  .p-light .t-btn {{ background: #e2e8f0; color: #0f172a; }}

  .p-stats {{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }}
  .p-stat {{ border-radius: 8px; padding: 6px; text-align: center; }}
  .p-stat-l {{ font-size: 9px; opacity: 0.65; }}
  .p-stat-v {{ font-size: 11.5px; font-weight: 700; margin-top: 1px; }}

  .p-card {{ border-radius: 10px; padding: 8px 10px; display: flex; flex-direction: column; gap: 5px; }}
  .p-card h3 {{ font-size: 11px; font-weight: 700; margin-bottom: 1px; }}
  .p-dark .p-card h3 {{ color: #aecbfa; }}
  .p-light .p-card h3 {{ color: #1d4ed8; }}
  .p-row {{ display: flex; justify-content: space-between; align-items: center; font-size: 10.5px; }}
  .p-row.sub {{ padding-left: 10px; font-size: 10px; opacity: 0.78; }}
  .chk {{ width: 13px; height: 13px; accent-color: #34a853; }}

  .p-grid2 {{ display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }}
  .p-inp {{ border-radius: 6px; padding: 4px 7px; font-size: 10.5px; margin-top: 2px; }}
  .p-dark .p-inp {{ background: rgba(0, 0, 0, 0.35); border: 1px solid rgba(255, 255, 255, 0.14); color: #fff; }}
  .p-light .p-inp {{ background: #f8fafc; border: 1px solid rgba(15, 23, 42, 0.15); color: #0f172a; }}

  .p-acts {{ display: grid; grid-template-columns: repeat(2, 1fr); gap: 5px; }}
  .p-b {{ padding: 5px; border-radius: 7px; text-align: center; font-size: 10px; font-weight: 600; }}
  .p-dark .p-b {{ background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.12); color: #e2e8f0; }}
  .p-light .p-b {{ background: #e2e8f0; border: 1px solid rgba(15, 23, 42, 0.1); color: #1e293b; }}
  .p-b.dan {{ background: rgba(234, 67, 53, 0.16); border-color: rgba(234, 67, 53, 0.45); color: #f87171; }}
  .p-light .p-b.dan {{ background: rgba(220, 38, 38, 0.1); border-color: rgba(220, 38, 38, 0.3); color: #b91c1c; }}

  .p-foot {{ display: flex; gap: 6px; }}
  .p-save {{ flex: 1; padding: 6px; border-radius: 7px; text-align: center; font-size: 10.5px; font-weight: 700; background: #1a73e8; color: #fff; }}

  /* Right Highlight Rail */
  .rail {{
    display: flex; flex-direction: column; justify-content: space-between; gap: 11px;
    padding-top: 28px;
  }}
  .r-card {{
    flex: 1;
    background: rgba(15, 23, 42, 0.72);
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.07);
    border-radius: 14px;
    padding: 14px 16px;
    display: flex; gap: 12px; align-items: flex-start;
  }}
  .r-num {{
    width: 28px; height: 28px; border-radius: 9px; flex-shrink: 0;
    background: rgba(59, 130, 246, 0.18); border: 1px solid rgba(96, 165, 250, 0.4);
    color: #93c5fd; font-size: 13px; font-weight: 800;
    display: flex; align-items: center; justify-content: center;
  }}
  .r-t {{ font-size: 13.5px; font-weight: 700; color: #f8fafc; margin-bottom: 4px; }}
  .r-d {{ font-size: 11.5px; color: #94a3b8; line-height: 1.48; }}
</style>
</head>
<body>
  <div class="aura-left"></div>
  <div class="aura-right"></div>

  <div class="top-header">
    <div class="h-left">
      <img src="{icon_b64}" alt="logo">
      <div>
        <div class="h-title">
          <span>双主题控制中心全景 · 黑白模式与多语言同步</span>
          <span class="v-badge">v0.2 Beta</span>
        </div>
        <div class="h-sub">支持 简体中文 / 繁體中文 / English / 日本語 实时切换 · 深色/浅色模式双端同步</div>
      </div>
    </div>
    <div class="theme-pill">🌗 Dark &amp; Light · 4 Languages</div>
  </div>

  <div class="stage">
    <!-- Left Popup: Dark Mode (zh-CN) -->
    <div class="popup-col">
      <span class="col-label lbl-dark">🌙 深色夜间模式 · 简体中文</span>
      <div class="p-box p-dark">
        <div class="p-hdr">
          <div class="p-brand">
            <img src="{icon_b64}" alt="icon">
            <div>
              <div class="p-h1">Gemini MCP 助手 <span class="p-beta-d">v0.2 Beta</span></div>
              <div class="p-sub">自动允许 · 多语言黑白模式 · 防误触</div>
            </div>
          </div>
          <div class="p-sw"></div>
        </div>

        <div class="app-bar">
          <div class="lang-sel">🌐 简体中文 ▾</div>
          <div class="t-btn">🌙 深色模式</div>
        </div>

        <div class="p-stats">
          <div class="p-stat"><div class="p-stat-l">今日允许</div><div class="p-stat-v">42</div></div>
          <div class="p-stat"><div class="p-stat-l">今日继续</div><div class="p-stat-v">18 / ∞</div></div>
          <div class="p-stat"><div class="p-stat-l">当前状态</div><div class="p-stat-v" style="color:#81c995;">后台就绪</div></div>
        </div>

        <div class="p-card">
          <h3>⚡ 核心自动化</h3>
          <div class="p-row"><span>自动点击 MCP「始终允许」</span><input type="checkbox" class="chk" checked></div>
          <div class="p-row sub"><span>优先选择「始终允许」（推荐）</span><input type="checkbox" class="chk" checked></div>
          <div class="p-row"><span>自动点击下方「继续」按钮</span><input type="checkbox" class="chk" checked></div>
          <div class="p-row"><span>后台静默运行（防休眠丢弃）</span><input type="checkbox" class="chk" checked></div>
        </div>

        <div class="p-card">
          <h3>🛡️ 防刷额度熔断保护</h3>
          <div class="p-grid2">
            <div><span style="opacity:0.7;">单次继续上限</span><div class="p-inp">10</div></div>
            <div><span style="opacity:0.7;">每日总上限 (0=∞)</span><div class="p-inp">0</div></div>
          </div>
          <div class="p-row"><span>连接超时发送桌面通知 (5 分钟)</span><input type="checkbox" class="chk" checked></div>
        </div>

        <div class="p-acts">
          <div class="p-b dan">紧急停止</div>
          <div class="p-b">解除熔断</div>
          <div class="p-b">清零计数</div>
          <div class="p-b">复位悬浮窗</div>
        </div>
        <div class="p-foot">
          <div class="p-b" style="padding:6px 12px;">恢复默认</div>
          <div class="p-save">保存设置</div>
        </div>
      </div>
    </div>

    <!-- Center Popup: Light Mode (English) -->
    <div class="popup-col">
      <span class="col-label lbl-light">☀️ 浅色白昼模式 · English</span>
      <div class="p-box p-light">
        <div class="p-hdr">
          <div class="p-brand">
            <img src="{icon_b64}" alt="icon">
            <div>
              <div class="p-h1">Gemini MCP Helper <span class="p-beta-l">v0.2 Beta</span></div>
              <div class="p-sub">Auto-Allow · Multi-Lang &amp; Theme</div>
            </div>
          </div>
          <div class="p-sw"></div>
        </div>

        <div class="app-bar">
          <div class="lang-sel">🌐 English ▾</div>
          <div class="t-btn">☀️ Light</div>
        </div>

        <div class="p-stats">
          <div class="p-stat"><div class="p-stat-l">Allowed</div><div class="p-stat-v">42</div></div>
          <div class="p-stat"><div class="p-stat-l">Continued</div><div class="p-stat-v">18 / ∞</div></div>
          <div class="p-stat"><div class="p-stat-l">Status</div><div class="p-stat-v" style="color:#15803d;">BG Ready</div></div>
        </div>

        <div class="p-card">
          <h3>⚡ Core Automation</h3>
          <div class="p-row"><span>Auto-click MCP "Always allow"</span><input type="checkbox" class="chk" checked></div>
          <div class="p-row sub"><span>Prefer "Always allow" (Recommended)</span><input type="checkbox" class="chk" checked></div>
          <div class="p-row"><span>Auto-click "Continue / Yes"</span><input type="checkbox" class="chk" checked></div>
          <div class="p-row"><span>Run silently in background</span><input type="checkbox" class="chk" checked></div>
        </div>

        <div class="p-card">
          <h3>🛡️ 6-Layer Circuit Breaker</h3>
          <div class="p-grid2">
            <div><span style="opacity:0.7;">Max per task</span><div class="p-inp">10</div></div>
            <div><span style="opacity:0.7;">Daily cap (0=∞)</span><div class="p-inp">0</div></div>
          </div>
          <div class="p-row"><span>Send OS alert on stall (5 mins)</span><input type="checkbox" class="chk" checked></div>
        </div>

        <div class="p-acts">
          <div class="p-b dan">E-Stop</div>
          <div class="p-b">Reset Trip</div>
          <div class="p-b">Reset Stats</div>
          <div class="p-b">Reset HUD</div>
        </div>
        <div class="p-foot">
          <div class="p-b" style="padding:6px 12px;">Defaults</div>
          <div class="p-save">Save Settings</div>
        </div>
      </div>
    </div>

    <!-- Right Rail: Key Upgrades -->
    <div class="rail">
      <div class="r-card">
        <div class="r-num">1</div>
        <div>
          <div class="r-t">🌐 四语言实时无缝切换</div>
          <div class="r-d">内置简体中文、繁體中文、English、日本語全量界面翻译与对应语种 MCP 权限/继续关键词识别。</div>
        </div>
      </div>
      <div class="r-card">
        <div class="r-num">2</div>
        <div>
          <div class="r-t">🌗 黑白双模式深浅适配</div>
          <div class="r-d">Popup 弹窗与网页悬浮 HUD 共享深色/浅色主题状态，无论是深夜护眼还是白昼办公均清晰锐利。</div>
        </div>
      </div>
      <div class="r-card">
        <div class="r-num">3</div>
        <div>
          <div class="r-t">🛡️ 多浏览器与非对话页保护</div>
          <div class="r-d">自动屏蔽 Gems/设置页等非聊天路由，第 2 浏览器恢复旧会话时自动忽略陈旧芯片，彻底杜绝乱点。</div>
        </div>
      </div>
      <div class="r-card">
        <div class="r-num">4</div>
        <div>
          <div class="r-t">📍 一键复位悬浮窗与应急刹车</div>
          <div class="r-d">新增「复位悬浮窗」快捷按键；紧急停止与解除熔断即时下发至当前聚焦窗口中的 Gemini 标签页。</div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
"""
    output_png = os.path.join(ASSETS_DIR, 'popup-demo.png')
    render_html_to_png(html, output_png, width=1200, height=700, dpr=2)


if __name__ == '__main__':
    render_popup_demo()
