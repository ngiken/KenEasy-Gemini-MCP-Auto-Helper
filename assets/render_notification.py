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

def render_html_to_png(html_content, output_png_path, width=1280, height=720, dpr=1):
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

def render_notification_demo():
    icon_b64 = get_icon_b64('icon128.png')
    html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<style>
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{
    width: 1280px;
    height: 720px;
    background: #090d16;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif;
    color: #e5e7eb;
    overflow: hidden;
    position: relative;
    padding: 24px 32px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }}

  /* Top Banner */
  .top-header {{
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
  }}
  .feature-badge-row {{
    display: flex;
    align-items: center;
    gap: 12px;
  }}
  .main-tag {{
    background: linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(59, 130, 246, 0.2) 100%);
    border: 1px solid rgba(16, 185, 129, 0.4);
    color: #34d399;
    font-size: 13px;
    font-weight: 700;
    padding: 5px 14px;
    border-radius: 999px;
    display: flex;
    align-items: center;
    gap: 6px;
  }}
  .top-title {{
    font-size: 24px;
    font-weight: 800;
    color: #f9fafb;
    letter-spacing: -0.3px;
  }}
  .top-desc {{
    font-size: 13.5px;
    color: #94a3b8;
  }}

  /* Main 2-column layout */
  .main-layout {{
    display: grid;
    grid-template-columns: 580px 620px;
    grid-gap: 24px;
    flex: 1;
  }}

  /* Column 1: Controls showcase */
  .controls-col {{
    display: flex;
    flex-direction: column;
    gap: 16px;
  }}
  .section-label {{
    font-size: 14px;
    font-weight: 700;
    color: #60a5fa;
    display: flex;
    align-items: center;
    gap: 8px;
  }}

  /* HUD Toggle Card Mockup */
  .hud-toggle-card {{
    background: rgba(24, 26, 31, 0.92);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 14px;
    padding: 16px 18px;
    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.45);
    display: flex;
    flex-direction: column;
    gap: 12px;
  }}
  .hud-card-header {{
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 12px;
    font-weight: 600;
    color: #f3f4f6;
  }}
  .hud-toggle-box {{
    background: rgba(255, 255, 255, 0.04);
    border: 1px dashed rgba(52, 168, 83, 0.4);
    border-radius: 10px;
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }}
  .toggle-state-row {{
    display: flex;
    align-items: center;
    justify-content: space-between;
  }}
  .pill-interactive {{
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 12px;
    border-radius: 999px;
    font-size: 11.5px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 0 12px rgba(52, 168, 83, 0.25);
  }}
  .pill-on {{
    background: rgba(52, 168, 83, 0.22);
    border: 1px solid rgba(52, 168, 83, 0.65);
    color: #81c995;
  }}
  .pill-off {{
    background: rgba(148, 163, 184, 0.15);
    border: 1px solid rgba(148, 163, 184, 0.3);
    color: #94a3b8;
  }}

  /* Popup Settings Card Mockup */
  .popup-settings-card {{
    background: #14161a;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 14px;
    padding: 16px 18px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.45);
  }}
  .popup-card-header {{
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    font-weight: 700;
    color: #f3f4f6;
  }}
  .popup-row {{
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 12px;
    color: #cbd5e1;
  }}
  .switch-ui {{
    width: 38px;
    height: 20px;
    background: #34a853;
    border-radius: 999px;
    position: relative;
  }}
  .switch-circle {{
    width: 14px;
    height: 14px;
    background: white;
    border-radius: 50%;
    position: absolute;
    right: 3px;
    top: 3px;
  }}
  .threshold-row {{
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    background: rgba(255, 255, 255, 0.03);
    padding: 8px 12px;
    border-radius: 8px;
  }}
  .num-input {{
    background: #202124;
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 6px;
    color: white;
    font-size: 12px;
    padding: 4px 8px;
    width: 50px;
    text-align: center;
  }}
  .btn-test {{
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.18);
    border-radius: 6px;
    color: #8ab4f8;
    padding: 5px 12px;
    font-size: 11.5px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 5px;
  }}

  /* Column 2: Notification & System Action */
  .system-col {{
    display: flex;
    flex-direction: column;
    gap: 16px;
  }}

  /* Desktop Toast Notification */
  .desktop-toast {{
    background: #202124;
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 12px;
    padding: 16px 18px;
    box-shadow: 0 16px 45px rgba(0, 0, 0, 0.65), 0 0 20px rgba(234, 67, 53, 0.18);
    display: flex;
    flex-direction: column;
    gap: 10px;
    position: relative;
    border-left: 4px solid #ea4335;
  }}
  .toast-app-bar {{
    display: flex;
    align-items: center;
    justify-content: space-between;
  }}
  .toast-app-info {{
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
    color: #9aa0a6;
  }}
  .chrome-icon {{
    width: 16px;
    height: 16px;
    border-radius: 50%;
  }}
  .toast-close {{
    color: #9aa0a6;
    font-size: 14px;
    cursor: pointer;
  }}
  .toast-content {{
    display: flex;
    gap: 12px;
  }}
  .toast-icon-wrap {{
    width: 42px;
    height: 42px;
    border-radius: 10px;
    background: rgba(234, 67, 53, 0.15);
    border: 1px solid rgba(234, 67, 53, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    flex-shrink: 0;
  }}
  .toast-body {{
    display: flex;
    flex-direction: column;
    gap: 4px;
  }}
  .toast-title {{
    font-size: 13.5px;
    font-weight: 700;
    color: #f1f3f4;
  }}
  .toast-message {{
    font-size: 12px;
    color: #bdc1c6;
    line-height: 1.45;
  }}
  .toast-action-hint {{
    font-size: 11px;
    color: #8ab4f8;
    margin-top: 4px;
    display: flex;
    align-items: center;
    gap: 4px;
  }}

  /* Browser Tab & Icon Badge Preview */
  .badge-preview-card {{
    background: #18191c;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    padding: 14px 18px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }}
  .mock-tab-bar {{
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: #202124;
    border-radius: 8px;
    padding: 6px 12px;
  }}
  .mock-tab {{
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: #e8eaed;
  }}
  .extension-icon-wrap {{
    position: relative;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
  }}
  .icon-img {{
    width: 22px;
    height: 22px;
    border-radius: 4px;
  }}
  .red-badge {{
    position: absolute;
    top: -2px;
    right: -2px;
    background: #ea4335;
    color: white;
    font-size: 9px;
    font-weight: 800;
    border-radius: 50%;
    width: 13px;
    height: 13px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 0 6px #ea4335;
  }}

  /* Bottom Feature Matrix */
  .feature-matrix {{
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    grid-gap: 16px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    padding-top: 14px;
  }}
  .matrix-item {{
    display: flex;
    align-items: flex-start;
    gap: 10px;
  }}
  .m-icon {{
    font-size: 16px;
    line-height: 1.2;
  }}
  .m-title {{
    font-size: 12.5px;
    font-weight: 700;
    color: #f3f4f6;
  }}
  .m-desc {{
    font-size: 11px;
    color: #94a3b8;
    line-height: 1.4;
  }}
</style>
</head>
<body>
  <div class="top-header">
    <div class="feature-badge-row">
      <div class="main-tag"><span>🔔</span> v0.1 核心特性</div>
      <h2 class="top-title">一键启停桌面提醒通知 · 超时卡死主动预警</h2>
    </div>
    <div class="top-desc">网页悬浮窗极速启闭 · 超时无进展桌面预警 · 点击通知自动切回会话</div>
  </div>

  <div class="main-layout">
    <!-- Left Column: Dual Controls -->
    <div class="controls-col">
      <div class="section-label">
        <span>⚙️</span> 双向极速启闭控制 (Dual Fast Controls)
      </div>

      <!-- HUD Card Mockup -->
      <div class="hud-toggle-card">
        <div class="hud-card-header">
          <span>网页端悬浮窗 (HUD) 单触切换</span>
          <span style="font-size: 11px; color: #81c995;">无需跳转弹窗</span>
        </div>
        <div class="hud-toggle-box">
          <div class="toggle-state-row">
            <span style="font-size: 12px; color: #d1d5db;">状态 A · 开启中</span>
            <div class="pill-interactive pill-on">
              <span>🔔</span> 桌面通知: [ 开启 ] (点击静音)
            </div>
          </div>
          <div style="border-top: 1px dashed rgba(255,255,255,0.08); margin: 2px 0;"></div>
          <div class="toggle-state-row">
            <span style="font-size: 12px; color: #94a3b8;">状态 B · 已静音</span>
            <div class="pill-interactive pill-off">
              <span>🔕</span> 桌面通知: [ 关闭 ] (点击开启)
            </div>
          </div>
        </div>
      </div>

      <!-- Popup Settings Card -->
      <div class="popup-settings-card">
        <div class="popup-card-header">
          <img src="{icon_b64}" style="width: 18px; height: 18px; border-radius: 4px;">
          <span>扩展 Popup 面板设置</span>
        </div>
        <div class="popup-row">
          <span>连接 / 卡死超时发送电脑桌面通知</span>
          <div class="switch-ui"><div class="switch-circle"></div></div>
        </div>
        <div class="threshold-row">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="color: #94a3b8;">超时提醒阈值:</span>
            <input class="num-input" value="5" readonly>
            <span style="color: #94a3b8;">分钟</span>
          </div>
          <div class="btn-test">
            <span>🔔</span> 测试通知
          </div>
        </div>
      </div>
    </div>

    <!-- Right Column: System Action & Notification -->
    <div class="system-col">
      <div class="section-label">
        <span>🖥️</span> 系统桌面通知与角标联动 (System Alert & Tab Focus)
      </div>

      <!-- Windows 11 / Chrome Toast -->
      <div class="desktop-toast">
        <div class="toast-app-bar">
          <div class="toast-app-info">
            <div class="chrome-icon" style="background: #4285f4; display: flex; align-items: center; justify-content: center; font-size: 10px; color: white;">●</div>
            <span>Google Chrome • 刚才</span>
          </div>
          <span class="toast-close">✕</span>
        </div>
        <div class="toast-content">
          <div class="toast-icon-wrap">⚠️</div>
          <div class="toast-body">
            <div class="toast-title">KenEasy Gemini MCP 任务停滞提醒</div>
            <div class="toast-message">
              检测到 MCP 外部工具执行或 Gemini 模型生成已超过 5 分钟无新输出，可能卡死或等待授权。点击立即切回标签页！
            </div>
            <div class="toast-action-hint">
              <span>👉</span> 点击直接还原最小化窗口并激活对应 Gemini 标签页
            </div>
          </div>
        </div>
      </div>

      <!-- Tab bar & Icon badge -->
      <div class="badge-preview-card">
        <div style="font-size: 11.5px; color: #94a3b8; display: flex; justify-content: space-between;">
          <span>浏览器标签与工具栏扩展图标状态</span>
          <span style="color: #f87171;">停滞报警触发中</span>
        </div>
        <div class="mock-tab-bar">
          <div class="mock-tab">
            <span>♊</span>
            <span>Gemini - 工作区 MCP 自动化会话</span>
          </div>
          <div class="extension-icon-wrap">
            <img src="{icon_b64}" class="icon-img">
            <div class="red-badge">!</div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Bottom Feature Matrix -->
  <div class="feature-matrix">
    <div class="matrix-item">
      <span class="m-icon">⚡</span>
      <div>
        <div class="m-title">双向实时无感同步</div>
        <div class="m-desc">HUD 与 Popup 状态双向联动，修改立即持久化存储，无需刷新页面。</div>
      </div>
    </div>
    <div class="matrix-item">
      <span class="m-icon">🔇</span>
      <div>
        <div class="m-title">智能静音与即时清空</div>
        <div class="m-desc">关闭通知时立即清除所有挂起的桌面弹窗，并自动摘除扩展红点角标。</div>
      </div>
    </div>
    <div class="matrix-item">
      <span class="m-icon">🔄</span>
      <div>
        <div class="m-title">自动恢复零打扰</div>
        <div class="m-desc">用户发送新消息或 Gemini 恢复输出时，报警自动解除，避免持续无效干扰。</div>
      </div>
    </div>
  </div>
</body>
</html>
"""
    output_png = os.path.join(ASSETS_DIR, 'notification-toggle-demo.png')
    render_html_to_png(html, output_png, width=1280, height=720)

if __name__ == '__main__':
    render_notification_demo()
