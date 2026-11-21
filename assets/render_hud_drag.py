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


def render_html_to_png(html_content, output_png_path, width=1280, height=720, dpr=2):
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
    background: #070b14;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif;
    color: #f8fafc;
    overflow: hidden;
    position: relative;
    padding: 26px 36px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }}

  .bg-glow-1 {{
    position: absolute; width: 640px; height: 640px; border-radius: 50%;
    background: radial-gradient(circle, rgba(59, 130, 246, 0.16) 0%, transparent 68%);
    top: -180px; right: -80px; pointer-events: none;
  }}
  .bg-glow-2 {{
    position: absolute; width: 520px; height: 520px; border-radius: 50%;
    background: radial-gradient(circle, rgba(16, 185, 129, 0.11) 0%, transparent 68%);
    bottom: -160px; left: -60px; pointer-events: none;
  }}

  /* Header */
  .top-header {{
    position: relative; z-index: 2;
    display: flex; align-items: center; justify-content: space-between;
  }}
  .title-left {{ display: flex; align-items: center; gap: 14px; }}
  .app-icon {{ width: 42px; height: 42px; border-radius: 11px; box-shadow: 0 6px 18px rgba(59, 130, 246, 0.35); }}
  .title-row {{ display: flex; align-items: center; gap: 10px; }}
  .top-title {{ font-size: 22px; font-weight: 800; letter-spacing: -0.4px; color: #ffffff; }}
  .v-tag {{
    font-size: 11.5px; font-weight: 700; padding: 3px 10px; border-radius: 999px;
    background: rgba(59, 130, 246, 0.18); border: 1px solid rgba(96, 165, 250, 0.45); color: #93c5fd;
  }}
  .top-sub {{ font-size: 13px; color: #94a3b8; margin-top: 2px; }}
  .top-right-badge {{
    padding: 7px 14px; border-radius: 999px; font-size: 12px; font-weight: 600;
    background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.35); color: #6ee7b7;
  }}

  /* Browser Mockup Stage */
  .browser-shell {{
    position: relative; z-index: 2;
    flex: 1;
    background: #11141c;
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 16px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.6);
  }}
  .browser-bar {{
    background: #1a1d26;
    padding: 10px 16px;
    display: flex; align-items: center; gap: 14px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }}
  .dots {{ display: flex; gap: 7px; }}
  .dot {{ width: 10px; height: 10px; border-radius: 50%; }}
  .d-r {{ background: #ff5f56; }}
  .d-y {{ background: #ffbd2e; }}
  .d-g {{ background: #27c93f; }}
  .url-pill {{
    flex: 1; max-width: 620px;
    background: #0f1219; border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px; padding: 5px 12px;
    font-size: 12px; color: #94a3b8; display: flex; align-items: center; gap: 8px;
  }}

  /* Gemini Canvas: strict left-chat / right-drag-zone separation so ZERO overlap */
  .gemini-canvas {{
    flex: 1;
    position: relative;
    background: radial-gradient(circle at 80% 40%, rgba(30, 41, 59, 0.35) 0%, #111317 65%);
    padding: 28px 34px;
    display: grid;
    grid-template-columns: 620px 1fr;
    gap: 32px;
  }}

  /* Left: Clean Gemini Chat Flow */
  .chat-col {{
    display: flex; flex-direction: column; gap: 18px;
  }}
  .user-bubble {{
    align-self: flex-end;
    background: #23262f;
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 16px 16px 4px 16px;
    padding: 11px 16px;
    font-size: 13px; color: #e2e8f0; max-width: 85%;
  }}
  .ai-row {{ display: flex; gap: 12px; align-items: flex-start; }}
  .gemini-orb {{
    width: 30px; height: 30px; border-radius: 50%;
    background: linear-gradient(135deg, #4285f4, #a855f7);
    display: flex; align-items: center; justify-content: center;
    font-size: 14px; color: #fff; flex-shrink: 0;
  }}
  .ai-content {{ display: flex; flex-direction: column; gap: 12px; flex: 1; }}
  .ai-text {{ font-size: 13px; color: #cbd5e1; line-height: 1.55; }}
  .code-tag {{
    font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
    background: rgba(96, 165, 250, 0.14); color: #93c5fd;
    padding: 1px 6px; border-radius: 4px; font-size: 11.5px;
  }}

  .mcp-card {{
    background: #1b1f29;
    border: 1px solid rgba(96, 165, 250, 0.35);
    border-radius: 12px;
    padding: 15px 18px;
    display: flex; flex-direction: column; gap: 10px;
    box-shadow: 0 12px 28px rgba(0, 0, 0, 0.35);
  }}
  .mcp-title {{
    display: flex; align-items: center; justify-content: space-between;
    font-size: 13px; font-weight: 700; color: #f1f5f9;
  }}
  .mcp-hit {{
    font-size: 11px; color: #34d399;
    background: rgba(16, 185, 129, 0.14); border: 1px solid rgba(16, 185, 129, 0.35);
    padding: 2px 8px; border-radius: 999px;
  }}
  .mcp-actions {{ display: flex; gap: 8px; margin-top: 2px; }}
  .btn-always {{
    background: #1a73e8; color: #fff; border: 1px solid #60a5fa;
    border-radius: 8px; padding: 6px 14px; font-size: 12px; font-weight: 600;
    box-shadow: 0 0 16px rgba(37, 99, 235, 0.45);
  }}
  .btn-sub {{
    background: rgba(255, 255, 255, 0.05); color: #94a3b8;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 8px; padding: 6px 12px; font-size: 12px;
  }}

  .followup-row {{
    display: flex; gap: 8px; align-items: center; margin-top: 2px;
  }}
  .chip-yes {{
    background: rgba(52, 168, 83, 0.16); border: 1px solid rgba(52, 168, 83, 0.45);
    color: #86efac; padding: 5px 14px; border-radius: 999px; font-size: 12px; font-weight: 600;
  }}
  .chip-normal {{
    background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.12);
    color: #94a3b8; padding: 5px 12px; border-radius: 999px; font-size: 12px;
  }}

  /* Right: Dedicated Unobstructed Drag Demonstration Zone */
  .drag-zone {{
    position: relative;
    border-left: 1px dashed rgba(255, 255, 255, 0.08);
    padding-left: 24px;
  }}

  .hud-ghost {{
    position: absolute;
    right: 14px;
    bottom: 8px;
    width: 210px;
    height: 92px;
    border: 2px dashed rgba(148, 163, 184, 0.28);
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.02);
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;
    color: #64748b; font-size: 11px;
  }}

  .arc-svg {{
    position: absolute;
    right: 68px;
    bottom: 102px;
    width: 150px;
    height: 150px;
    pointer-events: none;
  }}

  .hud-floating {{
    position: absolute;
    top: 28px;
    left: 20px;
    width: 256px;
    background: rgba(22, 25, 32, 0.96);
    border: 1px solid rgba(96, 165, 250, 0.55);
    border-radius: 14px;
    padding: 11px 13px;
    box-shadow: 0 22px 50px rgba(0, 0, 0, 0.65), 0 0 28px rgba(59, 130, 246, 0.25);
  }}
  .drag-pill {{
    position: absolute;
    top: -32px;
    left: 50%;
    transform: translateX(-50%);
    background: linear-gradient(135deg, #2563eb, #1d4ed8);
    color: #fff;
    font-size: 11px; font-weight: 700;
    padding: 4px 12px; border-radius: 999px;
    white-space: nowrap;
    box-shadow: 0 6px 16px rgba(37, 99, 235, 0.45);
  }}
  .hud-hdr {{
    display: flex; align-items: center; justify-content: space-between;
    background: rgba(59, 130, 246, 0.12);
    margin: -11px -13px 9px; padding: 9px 13px;
    border-radius: 14px 14px 0 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }}
  .hud-hdr-title {{ display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700; }}
  .g-dot {{ width: 8px; height: 8px; border-radius: 50%; background: #34a853; box-shadow: 0 0 8px #34a853; }}
  .b-v02 {{ font-size: 9.5px; padding: 1px 6px; border-radius: 999px; background: rgba(138, 180, 248, 0.16); color: #93c5fd; border: 1px solid rgba(138, 180, 248, 0.35); }}
  .hdr-btns {{ display: flex; gap: 4px; font-size: 10px; color: #cbd5e1; }}
  .hdr-btn {{ padding: 2px 5px; border-radius: 5px; background: rgba(255, 255, 255, 0.08); }}

  .hud-rows {{ display: flex; flex-direction: column; gap: 7px; font-size: 11px; }}
  .hud-r {{ display: flex; justify-content: space-between; align-items: center; color: #d1d5db; }}
  .p-on {{
    padding: 2px 8px; border-radius: 999px; font-size: 10px; font-weight: 600;
    background: rgba(52, 168, 83, 0.2); border: 1px solid rgba(52, 168, 83, 0.55); color: #86efac;
  }}
  .hud-stat {{
    margin-top: 8px; padding: 6px 8px; border-radius: 8px;
    background: rgba(255, 255, 255, 0.04); font-size: 10.5px; color: #94a3b8;
  }}
  .hud-acts {{ margin-top: 8px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px; font-size: 10.5px; text-align: center; }}
  .h-act {{ padding: 4px; border-radius: 6px; background: rgba(255, 255, 255, 0.07); color: #e2e8f0; }}

  /* Bottom 4-Spec Strip */
  .spec-strip {{
    position: relative; z-index: 2;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
  }}
  .spec-item {{
    background: rgba(15, 23, 42, 0.78);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    padding: 11px 14px;
    display: flex; flex-direction: column; gap: 3px;
  }}
  .spec-t {{ font-size: 12.5px; font-weight: 700; color: #f1f5f9; display: flex; align-items: center; gap: 6px; }}
  .spec-d {{ font-size: 11px; color: #94a3b8; line-height: 1.4; }}
</style>
</head>
<body>
  <div class="bg-glow-1"></div>
  <div class="bg-glow-2"></div>

  <div class="top-header">
    <div class="title-left">
      <img src="{icon_b64}" class="app-icon" alt="logo">
      <div>
        <div class="title-row">
          <h1 class="top-title">按住自由拖拽悬浮窗 (Hold-to-Drag Floating HUD)</h1>
          <span class="v-tag">v0.2 Beta · 拖拽重构</span>
        </div>
        <div class="top-sub">左键按住标题栏才跟随移动 · 彻底修复鼠标悬停粘连问题 · 折叠/主题/语言按键独立响应</div>
      </div>
    </div>
    <div class="top-right-badge">✓ 悬停零误触 · 离窗自动释放</div>
  </div>

  <div class="browser-shell">
    <div class="browser-bar">
      <div class="dots"><span class="dot d-r"></span><span class="dot d-y"></span><span class="dot d-g"></span></div>
      <div class="url-pill"><span style="color: #34a853;">🔒</span><span>https://gemini.google.com/app/mcp-automation-session</span></div>
    </div>

    <div class="gemini-canvas">
      <div class="chat-col">
        <div class="user-bubble">请调用 filesystem MCP 工具扫描当前工程结构并自动继续执行重构方案</div>

        <div class="ai-row">
          <div class="gemini-orb">✦</div>
          <div class="ai-content">
            <div class="ai-text">正在请求调用工具 <span class="code-tag">filesystem:list_directory</span>，请确认工具访问权限：</div>
            <div class="mcp-card">
              <div class="mcp-title">
                <span>🛡️ MCP 工具权限确认</span>
                <span class="mcp-hit">⚡ 已自动命中</span>
              </div>
              <div class="mcp-actions">
                <span class="btn-always">✓ 在此对话中始终允许</span>
                <span class="btn-sub">允许一次</span>
                <span class="btn-sub">拒绝</span>
              </div>
            </div>
            <div class="ai-text">阶段 1 分析已就绪，需要继续执行下一阶段吗？</div>
            <div class="followup-row">
              <span class="chip-yes">↪ Yes</span>
              <span class="chip-normal">调整代码结构方向</span>
            </div>
          </div>
        </div>
      </div>

      <div class="drag-zone">
        <div class="hud-ghost">
          <span style="font-size: 16px;">📍</span>
          <span>默认初始位置（右下角）</span>
          <span style="font-size: 10px; color: #475569;">Popup 支持一键复位</span>
        </div>

        <svg class="arc-svg" viewBox="0 0 150 150" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M 118 140 C 122 65, 76 34, 16 26" stroke="#60a5fa" stroke-width="2.5" stroke-dasharray="6 6" />
          <polygon points="4,24 20,17 18,33" fill="#60a5fa" />
        </svg>

        <div class="hud-floating">
          <div class="drag-pill">✊ 左键按住标题栏拖拽中</div>
          <div class="hud-hdr">
            <div class="hud-hdr-title"><span class="g-dot"></span><span>MCP 助手</span><span class="b-v02">v0.2 Beta</span></div>
            <div class="hdr-btns"><span class="hdr-btn">简体</span><span class="hdr-btn">☀</span><span class="hdr-btn">−</span></div>
          </div>
          <div class="hud-rows">
            <div class="hud-r"><span>插件状态</span><span class="p-on">运行中</span></div>
            <div class="hud-r"><span>自动始终允许</span><span class="p-on">已开启</span></div>
            <div class="hud-r"><span>自动点击继续</span><span class="p-on">已开启</span></div>
            <div class="hud-r"><span>后台切屏运行</span><span class="p-on">已开启</span></div>
            <div class="hud-r"><span>桌面通知</span><span class="p-on">已开启</span></div>
          </div>
          <div class="hud-stat">监控中 · 允许 14 · 本次 3/10 · 今日 18/∞</div>
          <div class="hud-acts">
            <div class="h-act">紧急停止</div>
            <div class="h-act">探测按钮</div>
            <div class="h-act">日志</div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="spec-strip">
    <div class="spec-item">
      <div class="spec-t"><span style="color:#60a5fa;">①</span> 严格左键按压门控</div>
      <div class="spec-d">仅当左键按下后才进入拖拽，鼠标悬停靠近绝不粘连跟随。</div>
    </div>
    <div class="spec-item">
      <div class="spec-t"><span style="color:#34d399;">②</span> 4px 消抖 + 延迟捕获</div>
      <div class="spec-d">超过 4px 才触发指针捕获，单点标题栏或 −/+ 秒速折叠展开。</div>
    </div>
    <div class="spec-item">
      <div class="spec-t"><span style="color:#fbbf24;">③</span> 视口边界与缩放保护</div>
      <div class="spec-d">实时钳制坐标不飞出屏幕，窗口缩小时自动回弹至可视区。</div>
    </div>
    <div class="spec-item">
      <div class="spec-t"><span style="color:#c084fc;">④</span> 坐标记忆 + 一键复位</div>
      <div class="spec-d">自动持久化保存位置，Popup 新增「复位悬浮窗」一键归位。</div>
    </div>
  </div>
</body>
</html>
"""
    output_png = os.path.join(ASSETS_DIR, 'hud-drag-demo.png')
    render_html_to_png(html, output_png, width=1280, height=720, dpr=2)


if __name__ == '__main__':
    render_hud_drag_demo()
