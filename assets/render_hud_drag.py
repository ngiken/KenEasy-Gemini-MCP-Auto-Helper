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

def render_hud_drag_demo():
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
    background: #0b0f19;
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
    background: linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(147, 51, 234, 0.2) 100%);
    border: 1px solid rgba(147, 51, 234, 0.4);
    color: #c084fc;
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

  /* Content split: Gemini UI Mockup (Left) + Highlights Panel (Right) */
  .workspace-layout {{
    display: grid;
    grid-template-columns: 820px 380px;
    grid-gap: 24px;
    flex: 1;
    position: relative;
  }}

  /* Gemini Browser Mockup */
  .browser-window {{
    background: #131314;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 14px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.55);
    position: relative;
  }}
  .browser-bar {{
    background: #1e1f20;
    padding: 10px 16px;
    display: flex;
    align-items: center;
    gap: 14px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }}
  .browser-dots {{
    display: flex;
    gap: 6px;
  }}
  .b-dot {{ width: 10px; height: 10px; border-radius: 50%; }}
  .b-red {{ background: #ff5f56; }}
  .b-yellow {{ background: #ffbd2e; }}
  .b-green {{ background: #27c93f; }}
  .url-bar {{
    background: #282a2c;
    border-radius: 6px;
    padding: 4px 12px;
    font-size: 12px;
    color: #9aa0a6;
    flex: 1;
    display: flex;
    align-items: center;
    gap: 8px;
  }}
  .url-lock {{ color: #34a853; }}

  /* Gemini Chat View */
  .gemini-chat {{
    flex: 1;
    padding: 24px 28px;
    display: flex;
    flex-direction: column;
    gap: 20px;
    position: relative;
    background: #131314;
    overflow: hidden;
  }}
  .chat-turn-user {{
    align-self: flex-end;
    background: #282a2c;
    padding: 10px 16px;
    border-radius: 18px 18px 4px 18px;
    font-size: 13px;
    color: #e3e3e3;
    max-width: 80%;
  }}
  .chat-turn-ai {{
    align-self: flex-start;
    display: flex;
    gap: 12px;
    max-width: 90%;
  }}
  .gemini-sparkle {{
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: linear-gradient(135deg, #4285f4, #9b72cb);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    color: white;
    flex-shrink: 0;
  }}
  .ai-bubble {{
    display: flex;
    flex-direction: column;
    gap: 10px;
    font-size: 13px;
    color: #e3e3e3;
    line-height: 1.5;
  }}

  /* MCP Auth Card inside Gemini */
  .mcp-auth-card {{
    background: #1e1f20;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 6px;
  }}
  .mcp-auth-header {{
    font-weight: 600;
    font-size: 13px;
    color: #f1f3f4;
    display: flex;
    align-items: center;
    gap: 8px;
  }}
  .mcp-auth-tool {{
    color: #8ab4f8;
    background: rgba(138, 180, 248, 0.12);
    padding: 2px 6px;
    border-radius: 4px;
    font-family: monospace;
    font-size: 11.5px;
  }}
  .mcp-auth-actions {{
    display: flex;
    gap: 8px;
  }}
  .btn-allow-always {{
    background: #1a73e8;
    color: white;
    border: none;
    border-radius: 6px;
    padding: 6px 14px;
    font-size: 12px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 6px;
    box-shadow: 0 0 14px rgba(66, 133, 244, 0.6);
    outline: 2px solid #8ab4f8;
  }}
  .btn-allow-once {{
    background: transparent;
    color: #8ab4f8;
    border: 1px solid rgba(138, 180, 248, 0.3);
    border-radius: 6px;
    padding: 6px 12px;
    font-size: 12px;
  }}
  .btn-deny {{
    background: transparent;
    color: #9aa0a6;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    padding: 6px 12px;
    font-size: 12px;
  }}

  /* GHOST ORIGIN of HUD */
  .hud-ghost {{
    position: absolute;
    right: 20px;
    bottom: 24px;
    width: 248px;
    height: 180px;
    border: 2px dashed rgba(255, 255, 255, 0.22);
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.02);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    gap: 6px;
    color: #64748b;
    font-size: 11.5px;
  }}

  /* TRAJECTORY MOTION ARROW */
  .motion-path {{
    position: absolute;
    right: 140px;
    bottom: 160px;
    width: 260px;
    height: 160px;
    pointer-events: none;
    z-index: 10;
  }}

  /* DRAGGED FLOATING HUD */
  .dragged-hud {{
    position: absolute;
    top: 100px;
    right: 180px;
    width: 270px;
    background: rgba(24, 26, 31, 0.94);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(96, 165, 250, 0.45);
    border-radius: 14px;
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.6), 0 0 24px rgba(59, 130, 246, 0.25);
    padding: 12px 14px;
    z-index: 20;
    user-select: none;
  }}
  .hud-header {{
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 8px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    cursor: grabbing;
    background: rgba(59, 130, 246, 0.08);
    margin: -12px -14px 8px -14px;
    padding: 10px 14px;
    border-radius: 14px 14px 0 0;
  }}
  .hud-drag-indicator {{
    display: flex;
    align-items: center;
    gap: 6px;
    font-weight: 700;
    font-size: 12px;
    color: #f3f4f6;
  }}
  .hud-dot {{
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #34a853;
    box-shadow: 0 0 8px #34a853;
  }}
  .hud-badge {{
    font-size: 10px;
    color: #fbbf24;
    background: rgba(245, 158, 11, 0.2);
    border: 1px solid rgba(245, 158, 11, 0.4);
    padding: 1px 6px;
    border-radius: 999px;
  }}
  .hud-rows {{
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-size: 11px;
  }}
  .hud-row {{
    display: flex;
    align-items: center;
    justify-content: space-between;
  }}
  .hud-label {{ color: #9ca3af; }}
  .hud-pill {{
    padding: 2px 8px;
    border-radius: 999px;
    font-size: 10.5px;
    font-weight: 600;
  }}
  .pill-green {{
    background: rgba(52, 168, 83, 0.2);
    border: 1px solid rgba(52, 168, 83, 0.5);
    color: #81c995;
  }}
  .pill-blue {{
    background: rgba(66, 133, 244, 0.2);
    border: 1px solid rgba(66, 133, 244, 0.5);
    color: #8ab4f8;
  }}
  .hud-btns {{
    display: flex;
    gap: 6px;
    margin-top: 4px;
  }}
  .hud-btn {{
    flex: 1;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 6px;
    padding: 4px;
    color: #e5e7eb;
    font-size: 10.5px;
    text-align: center;
  }}

  /* Drag Hand Icon & Tooltip */
  .drag-cursor-tooltip {{
    position: absolute;
    top: -28px;
    left: 40px;
    background: #2563eb;
    color: white;
    font-size: 11px;
    font-weight: 600;
    padding: 3px 10px;
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(37, 99, 235, 0.4);
    display: flex;
    align-items: center;
    gap: 5px;
    white-space: nowrap;
  }}

  /* Highlights Column (Right) */
  .highlights-col {{
    display: flex;
    flex-direction: column;
    gap: 14px;
  }}
  .tech-card {{
    background: rgba(17, 24, 39, 0.7);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }}
  .tech-card.active-card {{
    border-color: rgba(96, 165, 250, 0.5);
    background: linear-gradient(145deg, rgba(30, 58, 138, 0.2) 0%, rgba(17, 24, 39, 0.7) 100%);
  }}
  .tech-header {{
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13.5px;
    font-weight: 700;
    color: #f3f4f6;
  }}
  .tech-desc {{
    font-size: 12px;
    color: #94a3b8;
    line-height: 1.45;
  }}
</style>
</head>
<body>
  <div class="top-header">
    <div class="feature-badge-row">
      <div class="main-tag"><span>🖱️</span> v0.1 核心特性</div>
      <h2 class="top-title">网页端全域自由拖拽悬浮窗 (Draggable Floating HUD)</h2>
    </div>
    <div class="top-desc">画面中任意拖放 · 视口边界碰撞防溢出 · 坐标本地持久化保存</div>
  </div>

  <div class="workspace-layout">
    <!-- Gemini Mockup Window -->
    <div class="browser-window">
      <div class="browser-bar">
        <div class="browser-dots">
          <div class="b-dot b-red"></div>
          <div class="b-dot b-yellow"></div>
          <div class="b-dot b-green"></div>
        </div>
        <div class="url-bar">
          <span class="url-lock">🔒</span>
          <span>https://gemini.google.com/app/c/workspace-mcp-session</span>
        </div>
      </div>

      <div class="gemini-chat">
        <div class="chat-turn-user">
          请调用 filesystem 与 git MCP 工具扫描当前工程的所有提交与目录树
        </div>

        <div class="chat-turn-ai">
          <div class="gemini-sparkle">✦</div>
          <div class="ai-bubble">
            <div>正在调用 MCP 外部工具 <span style="font-family: monospace; color: #8ab4f8;">filesystem:list_allowed_directories</span> 获取工作区读写权限...</div>

            <!-- MCP Authorization Card inside Gemini -->
            <div class="mcp-auth-card">
              <div class="mcp-auth-header">
                <span>🛡️ MCP 工具权限确认请求</span>
                <span class="mcp-auth-tool">filesystem</span>
              </div>
              <div style="font-size: 12px; color: #bdc1c6;">
                该工具正在请求访问本地工作区：<code>E:\code\gemini-mcp-auto-helper</code>
              </div>
              <div class="mcp-auth-actions">
                <button class="btn-allow-always">✓ 始终允许 (Always allow) [已自动锁定]</button>
                <button class="btn-allow-once">允许一次</button>
                <button class="btn-deny">拒绝</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Ghost outline of HUD in bottom right -->
        <div class="hud-ghost">
          <span style="font-size: 20px;">📍</span>
          <span>默认初始位置 (右下角)</span>
          <span style="font-size: 10px; color: #475569;">按住顶部标题栏随意拖动</span>
        </div>

        <!-- SVG trajectory arc -->
        <svg class="motion-path" viewBox="0 0 260 160" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M 230 140 C 200 40, 100 20, 20 20" stroke="#60a5fa" stroke-width="2.5" stroke-dasharray="6 6" />
          <polygon points="12,20 24,14 24,26" fill="#60a5fa" />
        </svg>

        <!-- The actively dragged HUD -->
        <div class="dragged-hud">
          <div class="drag-cursor-tooltip">
            <span>✋</span> 正在自由拖拽移动中...
          </div>
          <div class="hud-header">
            <div class="hud-drag-indicator">
              <span class="hud-dot"></span>
              <span>Gemini MCP 助手</span>
              <span class="hud-badge">v0.1 Beta</span>
            </div>
            <span style="font-size: 12px; color: #94a3b8;">_</span>
          </div>
          <div class="hud-rows">
            <div class="hud-row">
              <span class="hud-label">MCP 权限确认</span>
              <span class="hud-pill pill-blue">始终允许优先 ✓</span>
            </div>
            <div class="hud-row">
              <span class="hud-label">自动继续任务</span>
              <span class="hud-pill pill-green">运行中 (3/10)</span>
            </div>
            <div class="hud-row">
              <span class="hud-label">桌面超时通知</span>
              <span class="hud-pill pill-green">已开启 🔔 [点击切换]</span>
            </div>
            <div class="hud-row">
              <span class="hud-label">今日继续总计</span>
              <span style="font-weight: 700; color: #f3f4f6;">18 / ∞ 次</span>
            </div>
          </div>
          <div class="hud-btns">
            <div class="hud-btn" style="color: #f87171; border-color: rgba(239, 68, 68, 0.4);">紧急停止</div>
            <div class="hud-btn">解除熔断</div>
            <div class="hud-btn">折叠</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Highlights Column (Right) -->
    <div class="highlights-col">
      <div class="tech-card active-card">
        <div class="tech-header">
          <span style="color: #60a5fa;">①</span> 标题栏指针拖拽捕获
        </div>
        <div class="tech-desc">
          基于现代 Pointer Events（<code>pointerdown/move/up</code>）原生捕获，光标自适应 <code>grab / grabbing</code> 态，手感丝滑流畅。
        </div>
      </div>

      <div class="tech-card active-card">
        <div class="tech-header">
          <span style="color: #34d399;">②</span> 视口四极边界碰撞保护
        </div>
        <div class="tech-desc">
          实时通过 <code>Math.max/min</code> 将悬浮卡片严格钳制在 <code>[0, innerWidth - W]</code> 与 <code>[0, innerHeight - H]</code> 内，杜绝卡片飘出可视区域。
        </div>
      </div>

      <div class="tech-card">
        <div class="tech-header">
          <span style="color: #fbbf24;">③</span> 4px 拖动/点击智能消抖
        </div>
        <div class="tech-desc">
          严格设置 4 像素移动判定死区，点击折叠按钮或状态卡片时零误触拖曳，确保操作确定性。
        </div>
      </div>

      <div class="tech-card">
        <div class="tech-header">
          <span style="color: #c084fc;">④</span> 本地坐标跨会话持久化
        </div>
        <div class="tech-desc">
          拖拽落位瞬间自动写入 <code>gmah_hud_position</code>，刷新页面或切换对话无缝复位到用户最习惯的舒适区域。
        </div>
      </div>
    </div>
  </div>
</body>
</html>
"""
    output_png = os.path.join(ASSETS_DIR, 'hud-drag-demo.png')
    render_html_to_png(html, output_png, width=1280, height=720)

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

if __name__ == '__main__':
    render_hud_drag_demo()
