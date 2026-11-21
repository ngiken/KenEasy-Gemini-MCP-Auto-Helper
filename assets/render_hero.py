import os
import sys
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

def render_html_to_png(html_content, output_png_path, width=1280, height=640, dpr=1):
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
    
    # If dpr was > 1 or window-size differed, resize or crop cleanly with Pillow
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
    background: radial-gradient(circle at 15% 20%, #1e1b4b 0%, #0d1117 55%, #05070c 100%);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif;
    color: #f3f4f6;
    overflow: hidden;
    position: relative;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 44px 56px;
  }}

  /* Ambient Glows */
  .glow-1 {{
    position: absolute;
    width: 600px;
    height: 600px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(66, 133, 244, 0.18) 0%, rgba(66, 133, 244, 0) 70%);
    top: -120px;
    left: -100px;
    pointer-events: none;
  }}
  .glow-2 {{
    position: absolute;
    width: 500px;
    height: 500px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(168, 85, 247, 0.15) 0%, rgba(168, 85, 247, 0) 70%);
    bottom: -100px;
    right: 50px;
    pointer-events: none;
  }}
  .glow-3 {{
    position: absolute;
    width: 400px;
    height: 400px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(52, 168, 83, 0.12) 0%, rgba(52, 168, 83, 0) 70%);
    top: 50px;
    right: 250px;
    pointer-events: none;
  }}

  /* Header Section */
  .header {{
    display: flex;
    align-items: center;
    justify-content: space-between;
    position: relative;
    z-index: 2;
  }}
  .brand-wrap {{
    display: flex;
    align-items: center;
    gap: 18px;
  }}
  .app-icon {{
    width: 68px;
    height: 68px;
    border-radius: 18px;
    box-shadow: 0 8px 24px rgba(66, 133, 244, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.18);
  }}
  .brand-text {{
    display: flex;
    flex-direction: column;
    gap: 4px;
  }}
  .title-row {{
    display: flex;
    align-items: center;
    gap: 14px;
  }}
  .brand-title {{
    font-size: 32px;
    font-weight: 800;
    letter-spacing: -0.5px;
    background: linear-gradient(135deg, #ffffff 30%, #c7d2fe 70%, #93c5fd 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }}
  .beta-tag {{
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: rgba(245, 158, 11, 0.15);
    border: 1px solid rgba(245, 158, 11, 0.5);
    color: #fbbf24;
    padding: 4px 12px;
    border-radius: 999px;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.5px;
    box-shadow: 0 0 16px rgba(245, 158, 11, 0.25);
  }}
  .beta-dot {{
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #f59e0b;
    box-shadow: 0 0 8px #f59e0b;
  }}
  .brand-sub {{
    font-size: 15px;
    color: #94a3b8;
    font-weight: 400;
  }}

  /* Badges bar */
  .badge-bar {{
    display: flex;
    gap: 10px;
  }}
  .shield-badge {{
    display: flex;
    align-items: center;
    gap: 6px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 8px;
    padding: 6px 12px;
    font-size: 12px;
    font-weight: 600;
    color: #cbd5e1;
    backdrop-filter: blur(8px);
  }}
  .badge-blue {{ color: #60a5fa; border-color: rgba(96, 165, 250, 0.3); background: rgba(96, 165, 250, 0.08); }}
  .badge-green {{ color: #34d399; border-color: rgba(52, 211, 153, 0.3); background: rgba(52, 211, 153, 0.08); }}
  .badge-purple {{ color: #c084fc; border-color: rgba(192, 132, 252, 0.3); background: rgba(192, 132, 252, 0.08); }}

  /* Cards Grid */
  .cards-grid {{
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    grid-gap: 16px;
    margin-top: 24px;
    margin-bottom: 24px;
    position: relative;
    z-index: 2;
  }}
  .feature-card {{
    background: rgba(17, 24, 39, 0.72);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 14px;
    padding: 16px 18px;
    backdrop-filter: blur(14px);
    display: flex;
    flex-direction: column;
    gap: 8px;
    box-shadow: 0 10px 24px rgba(0, 0, 0, 0.35);
    position: relative;
    overflow: hidden;
  }}
  .feature-card.highlight {{
    border-color: rgba(96, 165, 250, 0.45);
    background: linear-gradient(145deg, rgba(30, 58, 138, 0.25) 0%, rgba(17, 24, 39, 0.8) 100%);
    box-shadow: 0 12px 30px rgba(59, 130, 246, 0.18);
  }}
  .card-top {{
    display: flex;
    align-items: center;
    justify-content: space-between;
  }}
  .card-icon-title {{
    display: flex;
    align-items: center;
    gap: 10px;
  }}
  .card-icon {{
    font-size: 20px;
    line-height: 1;
  }}
  .card-title {{
    font-size: 15px;
    font-weight: 700;
    color: #f9fafb;
  }}
  .card-tag {{
    font-size: 10px;
    font-weight: 700;
    padding: 2px 7px;
    border-radius: 999px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }}
  .tag-new {{
    background: rgba(16, 185, 129, 0.2);
    color: #34d399;
    border: 1px solid rgba(16, 185, 129, 0.5);
  }}
  .tag-core {{
    background: rgba(59, 130, 246, 0.2);
    color: #60a5fa;
    border: 1px solid rgba(59, 130, 246, 0.5);
  }}
  .tag-guard {{
    background: rgba(239, 68, 68, 0.2);
    color: #f87171;
    border: 1px solid rgba(239, 68, 68, 0.5);
  }}
  .card-desc {{
    font-size: 12.5px;
    color: #9ca3af;
    line-height: 1.45;
  }}
  .card-pills {{
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 4px;
  }}
  .card-pill {{
    font-size: 10.5px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 6px;
    padding: 2px 7px;
    color: #cbd5e1;
  }}

  /* Bottom Bar */
  .footer-bar {{
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    padding-top: 14px;
    font-size: 12.5px;
    color: #64748b;
    position: relative;
    z-index: 2;
  }}
  .footer-points {{
    display: flex;
    gap: 20px;
  }}
  .footer-point {{
    display: flex;
    align-items: center;
    gap: 6px;
    color: #94a3b8;
  }}
  .dot-green {{ width: 6px; height: 6px; border-radius: 50%; background: #10b981; }}
</style>
</head>
<body>
  <div class="glow-1"></div>
  <div class="glow-2"></div>
  <div class="glow-3"></div>

  <header class="header">
    <div class="brand-wrap">
      <img src="{icon_b64}" class="app-icon" alt="Logo">
      <div class="brand-text">
        <div class="title-row">
          <h1 class="brand-title">KenEasy Gemini MCP Auto Helper</h1>
          <div class="beta-tag"><span class="beta-dot"></span>v0.1 Beta</div>
        </div>
        <p class="brand-sub">Google Gemini 网页端 MCP 自动化辅助与智能连续交互助手</p>
      </div>
    </div>
    <div class="badge-bar">
      <div class="shield-badge badge-blue">Chrome / Edge</div>
      <div class="shield-badge badge-purple">Manifest V3</div>
      <div class="shield-badge badge-green">MIT License</div>
    </div>
  </header>

  <div class="cards-grid">
    <div class="feature-card highlight">
      <div class="card-top">
        <div class="card-icon-title">
          <span class="card-icon">⚡</span>
          <span class="card-title">MCP 权限智能穿透</span>
        </div>
        <span class="card-tag tag-core">CORE</span>
      </div>
      <p class="card-desc">自动点击「始终允许 / Always allow」，兼容 Material Web Components Shadow DOM 与下拉菜单，严格避让取消/拒绝黑名单。</p>
      <div class="card-pills">
        <span class="card-pill">始终允许优先</span>
        <span class="card-pill">单次允许回退</span>
        <span class="card-pill">Shadow DOM 穿透</span>
      </div>
    </div>

    <div class="feature-card highlight">
      <div class="card-top">
        <div class="card-icon-title">
          <span class="card-icon">🖱️</span>
          <span class="card-title">自由拖拽悬浮窗</span>
        </div>
        <span class="card-tag tag-new">v0.1 NEW</span>
      </div>
      <p class="card-desc">页面专属悬浮卡片随心拖曳，视口边界自适应防溢出，位置坐标本地持久化恢复，折叠小巧零遮挡。</p>
      <div class="card-pills">
        <span class="card-pill">任意自由拖拽</span>
        <span class="card-pill">4px 判定消抖</span>
        <span class="card-pill">位置持久记忆</span>
      </div>
    </div>

    <div class="feature-card highlight">
      <div class="card-top">
        <div class="card-icon-title">
          <span class="card-icon">🔔</span>
          <span class="card-title">一键启停桌面提醒</span>
        </div>
        <span class="card-tag tag-new">v0.1 NEW</span>
      </div>
      <p class="card-desc">悬浮窗与弹窗一键即时静音/开启，MCP 卡死或超时自动弹出桌面系统通知，点击一键唤醒标签页。</p>
      <div class="card-pills">
        <span class="card-pill">悬浮窗单触切换</span>
        <span class="card-pill">超时停滞预警</span>
        <span class="card-pill">红点角标联动</span>
      </div>
    </div>

    <div class="feature-card">
      <div class="card-top">
        <div class="card-icon-title">
          <span class="card-icon">🛡️</span>
          <span class="card-title">6 层防刷额度熔断</span>
        </div>
        <span class="card-tag tag-guard">SAFETY</span>
      </div>
      <p class="card-desc">内置层层守护回路：单次任务/每日总上限、输出停稳等待、完工信号跳过、无进展空转指纹与报错断路保护。</p>
      <div class="card-pills">
        <span class="card-pill">单次/每日上限</span>
        <span class="card-pill">完工信号识别</span>
        <span class="card-pill">额度报错熔断</span>
      </div>
    </div>

    <div class="feature-card">
      <div class="card-top">
        <div class="card-icon-title">
          <span class="card-icon">🌙</span>
          <span class="card-title">后台静默常驻运行</span>
        </div>
        <span class="card-tag tag-core">CORE</span>
      </div>
      <p class="card-desc">MV3 Service Worker 定时心跳唤醒，禁止 Chrome 内存节省程序休眠或丢弃标签页，切屏最小化无忧。</p>
      <div class="card-pills">
        <span class="card-pill">长连接心跳保活</span>
        <span class="card-pill">防标签休眠丢弃</span>
        <span class="card-pill">微任务后台调度</span>
      </div>
    </div>

    <div class="feature-card">
      <div class="card-top">
        <div class="card-icon-title">
          <span class="card-icon">↪</span>
          <span class="card-title">智能继续与追问点击</span>
        </div>
        <span class="card-tag tag-core">SMART</span>
      </div>
      <p class="card-desc">严格匹对「继续 / Yes」等明确操作按钮，精准点击 <code>↪ Yes</code> 追问芯片，排除长文本追问与调查问卷。</p>
      <div class="card-pills">
        <span class="card-pill">↪ Yes 芯片识别</span>
        <span class="card-pill">停稳延迟判定</span>
        <span class="card-pill">自定义关键词</span>
      </div>
    </div>
  </div>

  <footer class="footer-bar">
    <div class="footer-points">
      <span class="footer-point"><span class="dot-green"></span> 专为 Google Gemini 网页端深度定制</span>
      <span class="footer-point"><span class="dot-green"></span> 零外部依赖 · 本地纯净执行</span>
      <span class="footer-point"><span class="dot-green"></span> 欢迎提交 Issue / PR 共同完善</span>
    </div>
    <div>KenEasy Ecosystem · Open Source Beta Preview</div>
  </footer>
</body>
</html>
"""
    hero_path = os.path.join(ASSETS_DIR, 'hero-banner.png')
    render_html_to_png(html, hero_path, width=1280, height=640)
    
    # Also banner.png and github-preview.png
    banner_path = os.path.join(ASSETS_DIR, 'banner.png')
    gh_path = os.path.join(ASSETS_DIR, 'github-preview.png')
    
    # Save copies
    import shutil
    shutil.copyfile(hero_path, banner_path)
    shutil.copyfile(hero_path, gh_path)
    print(f"Generated: {banner_path}")
    print(f"Generated: {gh_path}")

if __name__ == '__main__':
    build_hero_banner()
