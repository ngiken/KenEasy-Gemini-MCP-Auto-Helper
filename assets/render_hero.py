import os
import shutil
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


def render_html_to_png(html_content, output_png_path, width=1280, height=640, dpr=2):
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


def build_hero_banner():
    icon_b64 = get_icon_b64('icon128.png')
    html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<style>
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{
    width: 1280px;
    height: 640px;
    background: #070b14;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif;
    color: #f8fafc;
    overflow: hidden;
    position: relative;
    padding: 46px 56px 34px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }}

  /* Subtle architectural dot grid + soft Gemini aura */
  .bg-grid {{
    position: absolute;
    inset: 0;
    background-image: radial-gradient(rgba(148, 163, 184, 0.14) 1px, transparent 1px);
    background-size: 26px 26px;
    mask-image: radial-gradient(ellipse at 65% 45%, black 35%, transparent 82%);
    pointer-events: none;
  }}
  .aura-blue {{
    position: absolute;
    width: 680px; height: 680px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(59, 130, 246, 0.22) 0%, rgba(59, 130, 246, 0) 68%);
    top: -190px; left: -120px;
    pointer-events: none;
  }}
  .aura-violet {{
    position: absolute;
    width: 620px; height: 620px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(139, 92, 246, 0.18) 0%, rgba(139, 92, 246, 0) 68%);
    top: -80px; right: -60px;
    pointer-events: none;
  }}
  .aura-emerald {{
    position: absolute;
    width: 520px; height: 520px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(16, 185, 129, 0.14) 0%, rgba(16, 185, 129, 0) 68%);
    bottom: -180px; right: 240px;
    pointer-events: none;
  }}

  /* Main Split Stage */
  .stage {{
    position: relative;
    z-index: 2;
    display: grid;
    grid-template-columns: 600px 1fr;
    gap: 36px;
    align-items: center;
    flex: 1;
  }}

  /* Left Editorial Hero */
  .left-col {{
    display: flex;
    flex-direction: column;
    gap: 20px;
  }}

  .top-meta {{
    display: flex;
    align-items: center;
    gap: 12px;
  }}
  .logo-badge {{
    width: 58px; height: 58px;
    border-radius: 16px;
    padding: 4px;
    background: linear-gradient(135deg, rgba(96, 165, 250, 0.35), rgba(167, 139, 250, 0.25));
    box-shadow: 0 12px 32px rgba(37, 99, 235, 0.35);
    display: flex; align-items: center; justify-content: center;
  }}
  .logo-badge img {{
    width: 50px; height: 50px;
    border-radius: 12px;
  }}

  .pill-group {{
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }}
  .ver-pill {{
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 12px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 700;
    background: linear-gradient(135deg, rgba(59, 130, 246, 0.25), rgba(16, 185, 129, 0.2));
    border: 1px solid rgba(96, 165, 250, 0.5);
    color: #93c5fd;
    box-shadow: 0 0 18px rgba(59, 130, 246, 0.2);
  }}
  .ver-dot {{
    width: 7px; height: 7px; border-radius: 50%;
    background: #34d399;
    box-shadow: 0 0 8px #34d399;
  }}
  .lang-pill {{
    padding: 5px 11px;
    border-radius: 999px;
    font-size: 11.5px;
    font-weight: 600;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.14);
    color: #e2e8f0;
  }}

  .hero-title {{
    font-size: 42px;
    font-weight: 800;
    line-height: 1.12;
    letter-spacing: -0.9px;
    background: linear-gradient(125deg, #ffffff 15%, #dbeafe 55%, #93c5fd 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }}

  .hero-sub {{
    font-size: 16px;
    line-height: 1.55;
    color: #94a3b8;
    max-width: 590px;
  }}
  .hero-sub strong {{
    color: #e2e8f0;
    font-weight: 600;
  }}

  /* 2x2 Bento Feature Highlights */
  .bento-mini {{
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-top: 4px;
  }}
  .mini-card {{
    background: rgba(15, 23, 42, 0.72);
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
    border-radius: 14px;
    padding: 13px 15px;
    display: flex;
    align-items: flex-start;
    gap: 11px;
  }}
  .mini-icon {{
    width: 32px; height: 32px;
    border-radius: 9px;
    display: flex; align-items: center; justify-content: center;
    font-size: 16px;
    flex-shrink: 0;
  }}
  .ic-blue {{ background: rgba(59, 130, 246, 0.18); border: 1px solid rgba(59, 130, 246, 0.35); }}
  .ic-green {{ background: rgba(16, 185, 129, 0.18); border: 1px solid rgba(16, 185, 129, 0.35); }}
  .ic-amber {{ background: rgba(245, 158, 11, 0.18); border: 1px solid rgba(245, 158, 11, 0.35); }}
  .ic-purple {{ background: rgba(168, 85, 247, 0.18); border: 1px solid rgba(168, 85, 247, 0.35); }}

  .mini-title {{ font-size: 13.5px; font-weight: 700; color: #f1f5f9; margin-bottom: 2px; }}
  .mini-desc {{ font-size: 11.5px; color: #94a3b8; line-height: 1.38; }}

  /* Right Dual-Theme Live UI Showcase */
  .right-stage {{
    position: relative;
    height: 470px;
  }}

  /* Underlying MCP Approval Toast Card */
  .mcp-glow-card {{
    position: absolute;
    top: 8px;
    left: 0;
    right: 0;
    background: rgba(17, 24, 39, 0.88);
    border: 1px solid rgba(96, 165, 250, 0.38);
    border-radius: 16px;
    padding: 15px 18px;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.1);
  }}
  .mcp-head {{
    display: flex; justify-content: space-between; align-items: center;
    font-size: 12px; font-weight: 600; color: #93c5fd; margin-bottom: 10px;
  }}
  .mcp-btn-row {{
    display: flex; gap: 8px; justify-content: flex-end;
  }}
  .m-btn {{
    padding: 6px 12px; border-radius: 8px; font-size: 11px; font-weight: 600;
  }}
  .m-deny {{ background: rgba(255, 255, 255, 0.06); color: #94a3b8; border: 1px solid rgba(255, 255, 255, 0.1); }}
  .m-always {{
    background: linear-gradient(135deg, #2563eb, #1d4ed8);
    color: #fff;
    border: 1px solid #60a5fa;
    box-shadow: 0 0 20px rgba(37, 99, 235, 0.55);
  }}

  /* Dark Mode HUD Card (Side-by-Side Left) */
  .hud-card-dark {{
    position: absolute;
    top: 146px;
    left: 0;
    width: 248px;
    background: rgba(20, 23, 29, 0.96);
    border: 1px solid rgba(255, 255, 255, 0.16);
    border-radius: 16px;
    padding: 12px 14px;
    box-shadow: 0 24px 55px rgba(0, 0, 0, 0.65), inset 0 1px 0 rgba(255, 255, 255, 0.12);
    z-index: 3;
  }}

  /* Light Mode HUD Card (Side-by-Side Right) */
  .hud-card-light {{
    position: absolute;
    top: 166px;
    right: 0;
    width: 260px;
    background: rgba(255, 255, 255, 0.97);
    color: #111827;
    border: 1px solid rgba(15, 23, 42, 0.14);
    border-radius: 16px;
    padding: 12px 14px;
    box-shadow: 0 26px 60px rgba(0, 0, 0, 0.55), 0 0 36px rgba(96, 165, 250, 0.22);
    z-index: 4;
  }}

  .h-top {{
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 10px; padding-bottom: 8px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }}
  .hud-card-light .h-top {{
    border-bottom-color: rgba(15, 23, 42, 0.08);
  }}
  .h-title {{
    display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700;
  }}
  .h-dot {{
    width: 8px; height: 8px; border-radius: 50%;
    background: #22c55e; box-shadow: 0 0 8px #22c55e;
  }}
  .h-beta-dark {{
    font-size: 9.5px; padding: 1px 6px; border-radius: 999px;
    background: rgba(96, 165, 250, 0.16); color: #93c5fd; border: 1px solid rgba(96, 165, 250, 0.35);
  }}
  .h-beta-light {{
    font-size: 9.5px; padding: 1px 6px; border-radius: 999px;
    background: rgba(37, 99, 235, 0.1); color: #1d4ed8; border: 1px solid rgba(37, 99, 235, 0.3);
  }}
  .h-icons {{
    display: flex; gap: 4px; font-size: 10px; opacity: 0.8;
  }}
  .h-chip-dark {{
    padding: 2px 5px; border-radius: 5px; background: rgba(255, 255, 255, 0.08); color: #cbd5e1;
  }}
  .h-chip-light {{
    padding: 2px 5px; border-radius: 5px; background: rgba(15, 23, 42, 0.07); color: #334155;
  }}

  .h-rows {{ display: flex; flex-direction: column; gap: 7px; font-size: 11px; }}
  .h-row {{ display: flex; justify-content: space-between; align-items: center; }}
  .pill-dark-on {{
    padding: 2px 8px; border-radius: 999px; font-size: 10px; font-weight: 600;
    background: rgba(34, 197, 94, 0.18); border: 1px solid rgba(34, 197, 94, 0.5); color: #86efac;
  }}
  .pill-light-on {{
    padding: 2px 8px; border-radius: 999px; font-size: 10px; font-weight: 600;
    background: rgba(22, 163, 74, 0.14); border: 1px solid rgba(22, 163, 74, 0.45); color: #15803d;
  }}
  .h-status-dark {{
    margin-top: 9px; padding: 7px 9px; border-radius: 8px;
    background: rgba(255, 255, 255, 0.05); color: #94a3b8; font-size: 10.5px; line-height: 1.4;
  }}
  .h-status-light {{
    margin-top: 9px; padding: 7px 9px; border-radius: 8px;
    background: rgba(15, 23, 42, 0.05); color: #475569; font-size: 10.5px; line-height: 1.4;
  }}
  .h-actions {{
    margin-top: 8px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px; text-align: center; font-size: 10.5px;
  }}
  .h-act-dark {{
    padding: 4px; border-radius: 6px; background: rgba(255, 255, 255, 0.07); color: #e2e8f0;
  }}
  .h-act-light {{
    padding: 4px; border-radius: 6px; background: rgba(15, 23, 42, 0.06); color: #1e293b;
  }}

  /* Theme label callouts */
  .theme-tag {{
    position: absolute;
    font-size: 10.5px;
    font-weight: 700;
    padding: 4px 10px;
    border-radius: 999px;
    z-index: 5;
  }}
  .tag-dark {{
    top: 126px; left: 10px;
    background: #1e293b; color: #e2e8f0; border: 1px solid rgba(255, 255, 255, 0.2);
  }}
  .tag-light {{
    top: 146px; right: 12px;
    background: #ffffff; color: #0f172a; border: 1px solid rgba(15, 23, 42, 0.15);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.25);
  }}

  /* Bottom Footer */
  .footer {{
    position: relative;
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    padding-top: 14px;
    font-size: 12px;
    color: #64748b;
  }}
  .footer-left {{
    display: flex; gap: 22px; color: #94a3b8;
  }}
  .f-item {{ display: flex; align-items: center; gap: 7px; }}
  .f-dot {{ width: 6px; height: 6px; border-radius: 50%; background: #34d399; }}
</style>
</head>
<body>
  <div class="bg-grid"></div>
  <div class="aura-blue"></div>
  <div class="aura-violet"></div>
  <div class="aura-emerald"></div>

  <div class="stage">
    <div class="left-col">
      <div class="top-meta">
        <div class="logo-badge"><img src="{icon_b64}" alt="logo"></div>
        <div class="pill-group">
          <span class="ver-pill"><span class="ver-dot"></span>v1.0.0 Official Release</span>
          <span class="lang-pill">🌐 简 / 繁 / EN / 日本語</span>
          <span class="lang-pill">🌗 Dark &amp; Light Mode</span>
        </div>
      </div>

      <h1 class="hero-title">KenEasy Gemini MCP<br>Auto Helper</h1>

      <p class="hero-sub">
        专为 <strong>Google Gemini 网页端</strong> 打造的免手操 MCP 自动化扩展：自动放行「始终允许」、智能延续追问芯片，全新升级<strong>按住拖拽悬浮窗</strong>、<strong>4 语言切换</strong>、<strong>黑白双模式</strong>与<strong>多浏览器防误触守卫</strong>。
      </p>

      <div class="bento-mini">
        <div class="mini-card">
          <div class="mini-icon ic-blue">⚡</div>
          <div>
            <div class="mini-title">MCP 权限秒级放行</div>
            <div class="mini-desc">Shadow DOM 穿透，优先「始终允许」，严防误点拒绝/删除。</div>
          </div>
        </div>

        <div class="mini-card">
          <div class="mini-icon ic-green">🖱️</div>
          <div>
            <div class="mini-title">按住拖拽 · 精准防粘连</div>
            <div class="mini-desc">左键按住标题栏才拖动，悬停零跟随，点击秒折叠展开。</div>
          </div>
        </div>

        <div class="mini-card">
          <div class="mini-icon ic-amber">🌗</div>
          <div>
            <div class="mini-title">4 语言 + 黑白双模式</div>
            <div class="mini-desc">简中 / 繁中 / English / 日本語，深浅主题 HUD 与弹窗同步。</div>
          </div>
        </div>

        <div class="mini-card">
          <div class="mini-icon ic-purple">🛡️</div>
          <div>
            <div class="mini-title">多窗口防误点 + 6 层熔断</div>
            <div class="mini-desc">屏蔽非对话页与历史旧芯片，防第 2 浏览器误点击与刷额度。</div>
          </div>
        </div>
      </div>
    </div>

    <div class="right-stage">
      <div class="mcp-glow-card">
        <div class="mcp-head">
          <span>⚙️ filesystem-mcp · 请求访问本地目录权限</span>
          <span style="color: #34d399;">⚡ 已自动命中</span>
        </div>
        <div class="mcp-btn-row">
          <span class="m-btn m-deny">拒绝</span>
          <span class="m-btn m-deny">允许一次</span>
          <span class="m-btn m-always">✓ 在此对话中始终允许</span>
        </div>
      </div>

      <span class="theme-tag tag-dark">🌙 深色夜间 · 简体中文</span>
      <div class="hud-card-dark">
        <div class="h-top">
          <div class="h-title"><span class="h-dot"></span><span>MCP 助手</span><span class="h-beta-dark">v1.0.0</span></div>
          <div class="h-icons"><span class="h-chip-dark">简体</span><span class="h-chip-dark">☀</span><span class="h-chip-dark">−</span></div>
        </div>
        <div class="h-rows">
          <div class="h-row"><span>插件状态</span><span class="pill-dark-on">运行中</span></div>
          <div class="h-row"><span>自动始终允许</span><span class="pill-dark-on">已开启</span></div>
          <div class="h-row"><span>自动点击继续</span><span class="pill-dark-on">已开启</span></div>
          <div class="h-row"><span>桌面通知</span><span class="pill-dark-on">已开启</span></div>
        </div>
        <div class="h-status-dark">监控中<br>允许 24 · 本次 3/10 · 今日 18/∞</div>
        <div class="h-actions">
          <div class="h-act-dark">紧急停止</div>
          <div class="h-act-dark">探测按钮</div>
          <div class="h-act-dark">日志</div>
        </div>
      </div>

      <span class="theme-tag tag-light">☀️ 浅色白昼 · English</span>
      <div class="hud-card-light">
        <div class="h-top">
          <div class="h-title"><span class="h-dot"></span><span>MCP Helper</span><span class="h-beta-light">v1.0.0</span></div>
          <div class="h-icons"><span class="h-chip-light">EN</span><span class="h-chip-light">☾</span><span class="h-chip-light">−</span></div>
        </div>
        <div class="h-rows">
          <div class="h-row"><span>Extension</span><span class="pill-light-on">Active</span></div>
          <div class="h-row"><span>Auto Always Allow</span><span class="pill-light-on">On</span></div>
          <div class="h-row"><span>Auto Continue</span><span class="pill-light-on">On</span></div>
          <div class="h-row"><span>Desktop Alert</span><span class="pill-light-on">On</span></div>
        </div>
        <div class="h-status-light">Monitoring<br>Allow 24 · Task 3/10 · Today 18/∞</div>
        <div class="h-actions">
          <div class="h-act-light">E-Stop</div>
          <div class="h-act-light">Inspect</div>
          <div class="h-act-light">Logs</div>
        </div>
      </div>
    </div>
  </div>

  <footer class="footer">
    <div class="footer-left">
      <span class="f-item"><span class="f-dot"></span> Chrome &amp; Edge · Manifest V3</span>
      <span class="f-item"><span class="f-dot"></span> 100% 本地纯净运行 · 零数据上传</span>
      <span class="f-item"><span class="f-dot"></span> 后台切屏保活 · 桌面卡死预警</span>
    </div>
    <div>KenEasy Ecosystem · MIT Open Source</div>
  </footer>
</body>
</html>
"""
    hero_path = os.path.join(ASSETS_DIR, 'hero-banner.png')
    render_html_to_png(html, hero_path, width=1280, height=640, dpr=2)

    banner_path = os.path.join(ASSETS_DIR, 'banner.png')
    gh_path = os.path.join(ASSETS_DIR, 'github-preview.png')
    shutil.copyfile(hero_path, banner_path)
    shutil.copyfile(hero_path, gh_path)
    print(f"Generated: {banner_path}")
    print(f"Generated: {gh_path}")


if __name__ == '__main__':
    build_hero_banner()
