import os
import subprocess
import base64
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STORE_DIR = os.path.join(ROOT, 'store-submission')
SCREENSHOTS_DIR = os.path.join(STORE_DIR, '03-screenshots')
PROMO_DIR = os.path.join(STORE_DIR, '04-promotional-tiles')
ICONS_DIR = os.path.join(ROOT, 'icons')
ASSETS_DIR = os.path.join(ROOT, 'assets')
CHROME_PATH = r'C:\Program Files\Google\Chrome\Application\chrome.exe'
GEMINI_SAMPLE_URL = 'https://' + 'gemini.' + 'google.' + 'com/app/a1b2c3d4e5'

os.makedirs(SCREENSHOTS_DIR, exist_ok=True)
os.makedirs(PROMO_DIR, exist_ok=True)


def file_to_b64(path):
    if os.path.exists(path):
        with open(path, 'rb') as f:
            return 'data:image/png;base64,' + base64.b64encode(f.read()).decode('utf-8')
    return ''


def render_html_to_png(html_content, output_png_path, width=1280, height=800, dpr=2):
    temp_html = os.path.join(STORE_DIR, '_temp_store_render.html')
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

    print(f"Generated: {os.path.basename(output_png_path)} ({os.path.getsize(output_png_path)} bytes, {width}x{height})")


icon_b64 = file_to_b64(os.path.join(ICONS_DIR, 'icon128.png'))
popup_light_b64 = file_to_b64(os.path.join(ASSETS_DIR, 'notion-popup-light.png'))
popup_dark_b64 = file_to_b64(os.path.join(ASSETS_DIR, 'notion-popup-dark.png'))

NOTION_FONT = 'ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI Variable Display", "Segoe UI", Helvetica, "PingFang SC", "Microsoft YaHei", sans-serif'

BASE_STYLE = f"""
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{
    font-family: {NOTION_FONT};
    background: #f7f6f3;
    color: #37352f;
    overflow: hidden;
    -webkit-font-smoothing: antialiased;
  }}
  .top-header {{
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 16px;
    border-bottom: 1px solid rgba(55, 53, 47, 0.1);
  }}
  .brand {{ display: flex; align-items: center; gap: 14px; }}
  .brand img {{
    width: 44px; height: 44px; border-radius: 10px;
    border: 1px solid rgba(55, 53, 47, 0.12);
    background: #ffffff;
  }}
  .title-line {{ display: flex; align-items: center; gap: 9px; flex-wrap: wrap; }}
  .title-line h1 {{ font-size: 21px; font-weight: 700; letter-spacing: -0.02em; color: #37352f; }}
  .subtitle {{ font-size: 13px; color: #787774; margin-top: 3px; }}
  .tag {{
    font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 5px;
    border: 1px solid rgba(55, 53, 47, 0.12); background: #ffffff; color: #37352f;
    white-space: nowrap;
  }}
  .tag-blue {{ background: #ebf3fb; border-color: rgba(35, 131, 226, 0.28); color: #2383e2; }}
  .tag-green {{ background: #edf6f3; border-color: rgba(15, 123, 108, 0.25); color: #0f7b6c; }}
  .tag-amber {{ background: #faebdd; border-color: rgba(217, 115, 13, 0.28); color: #b35c07; }}
  .tag-red {{ background: #fdebeb; border-color: rgba(235, 87, 87, 0.28); color: #d44c47; }}
  .card {{
    background: #ffffff;
    border: 1px solid rgba(55, 53, 47, 0.11);
    border-radius: 12px;
    box-shadow: 0 2px 10px rgba(15, 15, 15, 0.04);
  }}
"""

# -------------------------------------------------------------
# SCREENSHOT 1: MCP Auto-Approval + MAIN-World BG Clicking + Notion HUD (1280x800)
# -------------------------------------------------------------
html_s1 = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<style>
  {BASE_STYLE}
  body {{
    width: 1280px; height: 800px;
    padding: 30px 40px;
    display: flex; flex-direction: column; justify-content: space-between; gap: 20px;
  }}
  .stage {{
    flex: 1;
    display: grid;
    grid-template-columns: 1fr 334px;
    gap: 24px;
    min-height: 0;
  }}
  .chat-card {{
    padding: 24px 26px;
    display: flex; flex-direction: column; justify-content: space-between; gap: 16px;
  }}
  .browser-strip {{
    display: flex; align-items: center; justify-content: space-between;
    padding-bottom: 12px; border-bottom: 1px solid rgba(55, 53, 47, 0.08);
    font-size: 12px; color: #787774;
  }}
  .url-pill {{
    background: #f7f6f3; border: 1px solid rgba(55, 53, 47, 0.09);
    border-radius: 6px; padding: 4px 12px; color: #37352f; font-size: 12px;
  }}
  .user-bubble {{
    align-self: flex-end;
    background: #f7f6f3; border: 1px solid rgba(55, 53, 47, 0.1);
    border-radius: 12px 12px 4px 12px;
    padding: 11px 16px; font-size: 13.5px; color: #37352f; max-width: 82%;
  }}
  .ai-block {{ display: flex; flex-direction: column; gap: 13px; }}
  .ai-head {{ display: flex; align-items: center; gap: 8px; font-size: 13.5px; font-weight: 600; color: #37352f; }}
  .ai-text {{ font-size: 13.5px; color: #5b5954; line-height: 1.55; }}
  .code-chip {{
    font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
    background: #f7f6f3; border: 1px solid rgba(55, 53, 47, 0.1);
    color: #d44c47; padding: 1px 6px; border-radius: 4px; font-size: 12px;
  }}
  .mcp-box {{
    background: #f7f9fc; border: 1px solid rgba(35, 131, 226, 0.28);
    border-radius: 10px; padding: 16px 18px;
    display: flex; flex-direction: column; gap: 11px;
  }}
  .mcp-top {{ display: flex; justify-content: space-between; align-items: center; }}
  .mcp-title {{ font-size: 14px; font-weight: 600; color: #37352f; }}
  .mcp-desc {{ font-size: 12.5px; color: #787774; line-height: 1.45; }}
  .mcp-btns {{ display: flex; justify-content: flex-end; gap: 9px; }}
  .btn-flat {{
    background: #ffffff; border: 1px solid rgba(55, 53, 47, 0.14);
    color: #787774; padding: 6px 13px; border-radius: 6px; font-size: 12px; font-weight: 500;
  }}
  .btn-primary {{
    background: #2383e2; border: 1px solid #2383e2; color: #ffffff;
    padding: 6px 15px; border-radius: 6px; font-size: 12px; font-weight: 600;
  }}
  .followup {{ display: flex; align-items: center; gap: 10px; }}
  .chip-yes {{
    background: #edf6f3; border: 1px solid rgba(15, 123, 108, 0.28);
    color: #0f7b6c; padding: 5px 13px; border-radius: 6px; font-size: 12.5px; font-weight: 600;
  }}
  .foot-strip {{
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;
    padding-top: 12px; border-top: 1px solid rgba(55, 53, 47, 0.08);
  }}
  .foot-item {{
    background: #f7f6f3; border: 1px solid rgba(55, 53, 47, 0.08);
    border-radius: 7px; padding: 8px 10px; font-size: 11.5px; color: #5b5954;
  }}
  .foot-item strong {{ display: block; color: #37352f; font-size: 12px; margin-bottom: 2px; }}

  .hud-shell {{
    padding: 16px;
    display: flex; flex-direction: column; justify-content: space-between; gap: 12px;
  }}
  .hud-top {{
    display: flex; align-items: center; justify-content: space-between;
    padding-bottom: 10px; border-bottom: 1px solid rgba(55, 53, 47, 0.09);
  }}
  .hud-name {{ display: flex; align-items: center; gap: 7px; font-size: 13.5px; font-weight: 600; }}
  .dot-g {{ width: 8px; height: 8px; border-radius: 50%; background: #0f7b6c; }}
  .hud-tools {{ display: flex; gap: 4px; }}
  .ht {{
    font-size: 10.5px; color: #787774; background: #f7f6f3;
    border: 1px solid rgba(55, 53, 47, 0.1); border-radius: 4px; padding: 2px 6px;
  }}
  .scope-box {{
    background: #f7f6f3; border: 1px solid rgba(55, 53, 47, 0.09);
    border-radius: 8px; padding: 7px; display: flex; flex-direction: column; gap: 6px;
  }}
  .scope-tabs {{
    display: grid; grid-template-columns: 1fr 1fr; gap: 3px;
    background: rgba(55, 53, 47, 0.07); padding: 2px; border-radius: 6px;
    font-size: 11.5px; text-align: center;
  }}
  .st-on {{ background: #ffffff; color: #37352f; font-weight: 600; padding: 4px; border-radius: 4px; box-shadow: 0 1px 2px rgba(15,15,15,0.08); }}
  .st-off {{ color: #787774; padding: 4px; }}
  .scope-meta {{ display: flex; justify-content: space-between; align-items: center; font-size: 11px; }}
  .rows {{ display: flex; flex-direction: column; gap: 8px; }}
  .row {{
    display: flex; justify-content: space-between; align-items: center;
    padding: 3px 6px; border-radius: 6px; font-size: 12.5px; color: #37352f;
  }}
  .row-custom {{ background: #f7f9fc; }}
  .bdot {{ display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #2383e2; margin-left: 5px; vertical-align: middle; }}
  .pill-on {{ background: #edf6f3; border: 1px solid rgba(15, 123, 108, 0.25); color: #0f7b6c; padding: 2px 9px; border-radius: 5px; font-size: 11px; font-weight: 600; }}
  .pill-off {{ background: #f7f6f3; border: 1px solid rgba(55, 53, 47, 0.12); color: #787774; padding: 2px 9px; border-radius: 5px; font-size: 11px; font-weight: 500; }}
  .pill-act {{ background: #ebf3fb; border: 1px solid rgba(35, 131, 226, 0.25); color: #2383e2; padding: 2px 8px; border-radius: 5px; font-size: 11px; font-weight: 600; margin-right: 4px; }}
  .status-callout {{
    background: #f7f6f3; border: 1px solid rgba(55, 53, 47, 0.09);
    border-radius: 7px; padding: 9px 10px; font-size: 11.5px; color: #6b6a66; line-height: 1.5;
  }}
  .hud-acts {{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; text-align: center; font-size: 11.5px; font-weight: 500; }}
  .act-stop {{ background: #fdf2f2; border: 1px solid rgba(235, 87, 87, 0.25); color: #d44c47; padding: 6px; border-radius: 6px; }}
  .act-std {{ background: #ffffff; border: 1px solid rgba(55, 53, 47, 0.12); color: #37352f; padding: 6px; border-radius: 6px; }}
</style>
</head>
<body>
  <div class="top-header">
    <div class="brand">
      <img src="{icon_b64}" alt="logo">
      <div>
        <div class="title-line">
          <h1>Google Gemini MCP 智能自动放行 · 全新 Notion 极简风格</h1>
          <span class="tag tag-blue">v1.0.1</span>
          <span class="tag tag-green">后台最小化稳定点击</span>
        </div>
        <div class="subtitle">自动点击「始终允许」与「继续 / Yes」追问芯片，切屏或窗口最小化自动升级 MAIN 世界点击不中断</div>
      </div>
    </div>
  </div>

  <div class="stage">
    <div class="card chat-card">
      <div class="browser-strip">
        <span class="url-pill">🔒 {GEMINI_SAMPLE_URL}</span>
        <span class="tag tag-green">⚡ 后台保活 + MAIN 世界穿透就绪</span>
      </div>

      <div class="user-bubble">请调用本地 Desktop Commander MCP 扫描工程目录，完成 UI 重构并持续跑完所有自动化测试。</div>

      <div class="ai-block">
        <div class="ai-head">✦ Gemini · MCP Tool Workflow</div>
        <div class="ai-text">正在请求执行 <span class="code-chip">desktop-commander:start_process</span>，请确认工具权限：</div>

        <div class="mcp-box">
          <div class="mcp-top">
            <span class="mcp-title">⚙️ Desktop Commander · MCP 工具权限确认</span>
            <span class="tag tag-green">✓ 0.6s 自动命中</span>
          </div>
          <div class="mcp-desc">穿透 Shadow DOM、Material 芯片与下拉菜单，严格过滤「拒绝 / 删除 / 取消」等黑名单按钮。</div>
          <div class="mcp-btns">
            <span class="btn-flat">拒绝</span>
            <span class="btn-flat">允许一次</span>
            <span class="btn-primary">✓ 在此对话中始终允许</span>
          </div>
        </div>

        <div class="followup">
          <span class="chip-yes">↪ Yes</span>
          <span style="font-size: 12.5px; color: #787774;">输出停稳后自动点击确认芯片，不误触普通推荐问题</span>
        </div>
      </div>

      <div class="foot-strip">
        <div class="foot-item"><strong>⚡ MAIN 世界点击升级</strong>隐藏/最小化点击被节流时自动穿透 ShadowRoot</div>
        <div class="foot-item"><strong>🛌 最小化 1.2s 跟进唤醒</strong>窗口失焦或最小化立即调度保底扫描不漏点</div>
        <div class="foot-item"><strong>🛡️ 防休眠按对话隔离</strong>仅对开启后台模式的对话关闭标签页自动休眠</div>
      </div>
    </div>

    <div class="card hud-shell">
      <div>
        <div class="hud-top">
          <div class="hud-name"><span class="dot-g"></span> MCP 助手 <span class="tag" style="font-size:10px;padding:1px 5px;">v1.0.1</span></div>
          <div class="hud-tools"><span class="ht">简体</span><span class="ht">☾</span><span class="ht">−</span></div>
        </div>

        <div class="scope-box" style="margin-top: 10px;">
          <div class="scope-tabs"><div class="st-on">本对话</div><div class="st-off">全局默认</div></div>
          <div class="scope-meta">
            <span class="tag tag-blue" style="font-size:10.5px;padding:1px 6px;">对话 #a1b2c3d4</span>
            <span class="ht" style="background:#ffffff;">恢复全局</span>
          </div>
        </div>

        <div class="rows" style="margin-top: 10px;">
          <div class="row"><span>插件状态</span><span class="pill-on">运行中</span></div>
          <div class="row"><span>自动始终允许</span><span class="pill-on">已开启</span></div>
          <div class="row row-custom"><span>自动点击继续<span class="bdot"></span></span><span class="pill-off">已关闭</span></div>
          <div class="row"><span>后台切屏运行</span><span class="pill-on">已开启</span></div>
          <div class="row"><span>桌面通知</span><span class="pill-on">已开启</span></div>
          <div class="row"><span>超时自动续接</span><span><span class="pill-act">立即续接</span><span class="pill-on">已开启</span></span></div>
        </div>
      </div>

      <div style="display:flex; flex-direction:column; gap:10px;">
        <div class="status-callout">
          状态：<strong>监控中</strong>（本对话独立配置）<br>
          允许 18 · 本次继续 3/10 · 今日 6/∞
        </div>
        <div class="hud-acts">
          <div class="act-stop">紧急停止</div>
          <div class="act-std">探测按钮</div>
          <div class="act-std">日志</div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
"""
render_html_to_png(html_s1, os.path.join(SCREENSHOTS_DIR, 'screenshot-1-mcp-auto-approval-1280x800.png'), 1280, 800, dpr=2)

# -------------------------------------------------------------
# SCREENSHOT 2: Per-Chat Independent Controls & Isolated E-Stop + Notion Dual HUD (1280x800)
# -------------------------------------------------------------
html_s2 = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<style>
  {BASE_STYLE}
  body {{
    width: 1280px; height: 800px;
    padding: 30px 40px;
    display: flex; flex-direction: column; justify-content: space-between; gap: 18px;
  }}
  .stage {{
    flex: 1;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
    min-height: 0;
  }}
  .chat-pane {{
    padding: 20px 22px;
    display: flex; flex-direction: column; justify-content: space-between; gap: 14px;
  }}
  .chat-pane.dark-pane {{
    background: #191919; border-color: rgba(255, 255, 255, 0.1); color: #e6e6e4;
  }}
  .pane-top {{
    display: flex; justify-content: space-between; align-items: center;
    padding-bottom: 10px; border-bottom: 1px solid rgba(55, 53, 47, 0.09);
  }}
  .dark-pane .pane-top {{ border-bottom-color: rgba(255, 255, 255, 0.08); }}
  .pane-url {{ font-size: 12px; font-weight: 600; color: #37352f; }}
  .dark-pane .pane-url {{ color: #e6e6e4; }}

  .mini-hud-light {{
    background: #ffffff; border: 1px solid rgba(55, 53, 47, 0.13); border-radius: 10px;
    padding: 13px 14px; box-shadow: 0 6px 20px rgba(15, 15, 15, 0.07);
    display: flex; flex-direction: column; gap: 8px;
  }}
  .mini-hud-dark {{
    background: #1f1f1f; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 10px;
    padding: 13px 14px; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
    display: flex; flex-direction: column; gap: 8px; color: #e6e6e4;
  }}
  .mh-head {{ display: flex; justify-content: space-between; align-items: center; font-size: 12.5px; font-weight: 600; padding-bottom: 7px; border-bottom: 1px solid rgba(55,53,47,0.08); }}
  .mini-hud-dark .mh-head {{ border-bottom-color: rgba(255,255,255,0.08); }}
  .mh-scope {{
    background: #f7f6f3; border: 1px solid rgba(55,53,47,0.09); border-radius: 7px; padding: 6px;
    display: flex; flex-direction: column; gap: 5px;
  }}
  .mini-hud-dark .mh-scope {{ background: #262626; border-color: rgba(255,255,255,0.08); }}
  .mh-tabs {{ display: grid; grid-template-columns: 1fr 1fr; gap: 3px; background: rgba(55,53,47,0.07); padding: 2px; border-radius: 5px; font-size: 11px; text-align: center; }}
  .mini-hud-dark .mh-tabs {{ background: rgba(0,0,0,0.28); }}
  .mt-on {{ background: #ffffff; color: #37352f; font-weight: 600; padding: 3px; border-radius: 4px; }}
  .mini-hud-dark .mt-on {{ background: #333333; color: #f1f1ef; }}
  .mt-off {{ color: #787774; padding: 3px; }}
  .mini-hud-dark .mt-off {{ color: #9b9a97; }}

  .mh-row {{ display: flex; justify-content: space-between; align-items: center; font-size: 12px; padding: 2px 4px; border-radius: 5px; }}
  .p-l-on {{ background: #edf6f3; color: #0f7b6c; border: 1px solid rgba(15,123,108,0.24); padding: 2px 8px; border-radius: 5px; font-size: 11px; font-weight: 600; }}
  .p-l-off {{ background: #f7f6f3; color: #787774; border: 1px solid rgba(55,53,47,0.12); padding: 2px 8px; border-radius: 5px; font-size: 11px; }}
  .p-l-red {{ background: #fdebeb; color: #d44c47; border: 1px solid rgba(235,87,87,0.28); padding: 2px 8px; border-radius: 5px; font-size: 11px; font-weight: 600; }}
  .p-d-on {{ background: rgba(45,170,126,0.15); color: #6bc9a4; border: 1px solid rgba(45,170,126,0.3); padding: 2px 8px; border-radius: 5px; font-size: 11px; font-weight: 600; }}

  .alert-box-light {{
    background: #fdebeb; border: 1px solid rgba(235, 87, 87, 0.25);
    color: #b91c1c; border-radius: 6px; padding: 7px 9px; font-size: 11px; line-height: 1.45;
  }}
  .ok-box-dark {{
    background: #262626; border: 1px solid rgba(255, 255, 255, 0.08);
    color: #9b9a97; border-radius: 6px; padding: 7px 9px; font-size: 11px; line-height: 1.45;
  }}
  .mh-acts {{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px; font-size: 11px; text-align: center; font-weight: 500; }}
  .specs {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }}
  .sp {{ padding: 11px 13px; }}
  .sp h4 {{ font-size: 12.5px; color: #37352f; margin-bottom: 3px; }}
  .sp p {{ font-size: 11px; color: #787774; line-height: 1.45; }}
</style>
</head>
<body>
  <div class="top-header">
    <div class="brand">
      <img src="{icon_b64}" alt="logo">
      <div>
        <div class="title-line">
          <h1>单对话独立控制 &amp; 隔离紧急停止 · 浅色纸感 / 深色炭灰</h1>
          <span class="tag tag-blue">v1.0.1 新特性</span>
          <span class="tag tag-red">单对话独立急停</span>
        </div>
        <div class="subtitle">每个 Gemini 对话均可单独开启/关闭功能或紧急停止，切到其他对话完全不受影响，切回自动恢复</div>
      </div>
    </div>
  </div>

  <div class="stage">
    <div class="card chat-pane">
      <div class="pane-top">
        <span class="pane-url">📄 对话 A · /app/chat-a1b2c3</span>
        <span class="tag tag-red">🛑 仅停本对话（浅色纸感）</span>
      </div>

      <div class="mini-hud-light">
        <div class="mh-head">
          <span><span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#eb5757;margin-right:6px;"></span>MCP 助手 <span class="tag" style="font-size:10px;padding:0 4px;">v1.0.1</span></span>
          <span style="font-size:10.5px;color:#787774;">简体 &nbsp; ☾ &nbsp; −</span>
        </div>
        <div class="mh-scope">
          <div class="mh-tabs"><div class="mt-on">本对话</div><div class="mt-off">全局默认</div></div>
          <div style="display:flex;justify-content:space-between;align-items:center;font-size:10.5px;">
            <span class="tag tag-blue" style="font-size:10px;padding:1px 5px;">对话 #chat-a1b</span>
            <span style="color:#787774;border:1px solid rgba(55,53,47,0.14);padding:1px 6px;border-radius:4px;background:#fff;">恢复全局</span>
          </div>
        </div>
        <div class="mh-row"><span>插件状态</span><span class="p-l-on">运行中</span></div>
        <div class="mh-row"><span>自动始终允许</span><span class="p-l-on">已开启</span></div>
        <div class="mh-row" style="background:#f7f9fc;"><span>自动点击继续 <span style="display:inline-block;width:5px;height:5px;border-radius:50%;background:#2383e2;"></span></span><span class="p-l-off">已关闭</span></div>
        <div class="mh-row"><span>后台切屏运行</span><span class="p-l-on">已开启</span></div>
        <div class="alert-box-light"><strong>熔断: 用户手动紧急停止（仅锁定此对话）</strong><br>允许 12 · 本次继续 0/10 · 今日 18/∞</div>
        <div class="mh-acts">
          <div class="p-l-red" style="padding:5px;">解除熔断</div>
          <div style="border:1px solid rgba(55,53,47,0.12);border-radius:5px;padding:5px;">探测按钮</div>
          <div style="border:1px solid rgba(55,53,47,0.12);border-radius:5px;padding:5px;">日志</div>
        </div>
      </div>

      <div style="font-size:12px;color:#787774;">
        ✓ 对话 A 触发「紧急停止」后自动持久化，切回该对话时依然保持停机保护。
      </div>
    </div>

    <div class="card chat-pane dark-pane">
      <div class="pane-top">
        <span class="pane-url">📄 对话 B · /app/chat-x9y8z7</span>
        <span style="font-size:11px;font-weight:600;padding:2px 8px;border-radius:5px;background:rgba(45,170,126,0.16);border:1px solid rgba(45,170,126,0.32);color:#6bc9a4;">✅ 继续全自动运行（深色炭灰）</span>
      </div>

      <div class="mini-hud-dark">
        <div class="mh-head">
          <span><span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#2daa7e;margin-right:6px;"></span>MCP Helper <span style="font-size:10px;padding:1px 5px;border-radius:4px;background:rgba(255,255,255,0.06);color:#9b9a97;border:1px solid rgba(255,255,255,0.09);">v1.0.1</span></span>
          <span style="font-size:10.5px;color:#9b9a97;">EN &nbsp; ☀ &nbsp; −</span>
        </div>
        <div class="mh-scope">
          <div class="mh-tabs"><div class="mt-on">This chat</div><div class="mt-off">Global</div></div>
          <div style="display:flex;justify-content:space-between;align-items:center;font-size:10.5px;">
            <span style="color:#9b9a97;background:rgba(255,255,255,0.05);padding:1px 6px;border-radius:4px;">Chat #chat-x9y</span>
            <span style="color:#9b9a97;">Following global</span>
          </div>
        </div>
        <div class="mh-row"><span>Extension</span><span class="p-d-on">Active</span></div>
        <div class="mh-row"><span>Auto Always Allow</span><span class="p-d-on">On</span></div>
        <div class="mh-row"><span>Auto Continue</span><span class="p-d-on">On</span></div>
        <div class="mh-row"><span>Background Run</span><span class="p-d-on">On</span></div>
        <div class="ok-box-dark"><strong style="color:#6bc9a4;">Monitoring · Background Ready</strong><br>Allow 12 · Task 4/10 · Today 18/∞</div>
        <div class="mh-acts">
          <div style="background:rgba(235,87,87,0.1);border:1px solid rgba(235,87,87,0.25);color:#f08080;border-radius:5px;padding:5px;">E-Stop</div>
          <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);color:#d4d4d1;border-radius:5px;padding:5px;">Inspect</div>
          <div style="background:rgba(35,131,226,0.16);border:1px solid rgba(35,131,226,0.34);color:#6eaef5;border-radius:5px;padding:5px;">Logs</div>
        </div>
      </div>

      <div style="font-size:12px;color:#9b9a97;">
        ✓ 对话 B 与其他已打开标签页完全不受对话 A 急停影响，后台继续稳定执行。
      </div>
    </div>
  </div>

  <div class="specs">
    <div class="card sp"><h4>① 本对话 / 全局切换</h4><p>HUD 顶部一键切换作用域，6 项开关独立生效并以蓝点标示。</p></div>
    <div class="card sp"><h4>② 隔离紧急停止</h4><p>默认仅停当前对话；弹窗底部另设「停止全部对话」广播急停。</p></div>
    <div class="card sp"><h4>③ 新对话自动迁移</h4><p>/app 落地页的独立设置发送后自动迁移至新会话 ID。</p></div>
    <div class="card sp"><h4>④ 左键按住自由拖拽</h4><p>4px 消抖防悬停粘连，记忆屏幕坐标并支持一键复位。</p></div>
  </div>
</body>
</html>
"""
render_html_to_png(html_s2, os.path.join(SCREENSHOTS_DIR, 'screenshot-2-draggable-hud-1280x800.png'), 1280, 800, dpr=2)

# -------------------------------------------------------------
# SCREENSHOT 3: Live Wait Timer, Stall Auto-Recovery & OS Notifications (1280x800)
# -------------------------------------------------------------
html_s3 = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<style>
  {BASE_STYLE}
  body {{
    width: 1280px; height: 800px;
    padding: 30px 40px;
    display: flex; flex-direction: column; justify-content: space-between; gap: 20px;
  }}
  .stage {{
    flex: 1; display: grid; grid-template-columns: 1fr 1fr; gap: 24px;
  }}
  .panel {{
    padding: 24px; display: flex; flex-direction: column; justify-content: space-between; gap: 16px;
  }}
  .sec-title {{ font-size: 14px; font-weight: 700; color: #37352f; display: flex; align-items: center; justify-content: space-between; }}
  .wait-callout {{
    background: #faebdd; border: 1px solid rgba(217, 115, 13, 0.28);
    border-radius: 8px; padding: 12px 14px; color: #b35c07; font-size: 13px; font-weight: 600;
  }}
  .notif-card {{
    background: #ffffff; border: 1px solid rgba(55, 53, 47, 0.14);
    border-left: 4px solid #d9730d; border-radius: 10px;
    padding: 18px 20px; box-shadow: 0 6px 18px rgba(15, 15, 15, 0.06);
  }}
  .n-meta {{ display: flex; justify-content: space-between; font-size: 11.5px; color: #787774; margin-bottom: 8px; }}
  .n-title {{ font-size: 15px; font-weight: 700; color: #37352f; margin-bottom: 6px; }}
  .n-body {{ font-size: 12.5px; color: #5b5954; line-height: 1.55; }}
  .n-cta {{
    margin-top: 12px; display: inline-block; background: #2383e2; color: #ffffff;
    padding: 6px 13px; border-radius: 6px; font-size: 12px; font-weight: 600;
  }}
  .tab-bar {{
    background: #f7f6f3; border: 1px solid rgba(55, 53, 47, 0.1);
    border-radius: 8px; padding: 12px 15px; display: flex; justify-content: space-between; align-items: center;
  }}
  .badge-ico {{ position: relative; }}
  .badge-ico img {{ width: 26px; height: 26px; border-radius: 6px; }}
  .red-dot {{
    position: absolute; top: -4px; right: -5px; width: 15px; height: 15px; border-radius: 50%;
    background: #eb5757; color: #fff; font-size: 10px; font-weight: 800;
    display: flex; align-items: center; justify-content: center;
  }}
  .ctrl-row {{
    background: #f7f6f3; border: 1px solid rgba(55, 53, 47, 0.09);
    border-radius: 8px; padding: 13px 15px;
    display: flex; justify-content: space-between; align-items: center; font-size: 13px;
  }}
  .prompt-preview {{
    background: #ebf3fb; border: 1px solid rgba(35, 131, 226, 0.25);
    border-radius: 8px; padding: 13px 15px; font-size: 12.5px; color: #1d4ed8; line-height: 1.55;
  }}
</style>
</head>
<body>
  <div class="top-header">
    <div class="brand">
      <img src="{icon_b64}" alt="logo">
      <div>
        <div class="title-line">
          <h1>连接卡死实时计时 · 超时自动续接 &amp; 桌面通知提醒</h1>
          <span class="tag tag-amber">超时自动恢复</span>
          <span class="tag tag-blue">一键立即续接</span>
        </div>
        <div class="subtitle">实时监控 MCP 工具连接耗时，超时自动终止并拟人发送自定义续接话术，同时支持系统级桌面告警</div>
      </div>
    </div>
  </div>

  <div class="stage">
    <div class="card panel">
      <div class="sec-title"><span>🖥️ 系统级桌面告警 &amp; 点击唤醒标签页</span><span class="tag tag-amber">4 语言通知</span></div>
      <div class="wait-callout">⏳ 正在连接 Desktop Commander · 已等 4分52秒 / 阈值 5分钟</div>
      <div class="notif-card">
        <div class="n-meta"><span>Google Chrome · 桌面通知</span><span>刚刚</span></div>
        <div class="n-title">⚠️ Gemini 连接已超过 5 分钟</div>
        <div class="n-body">检测到该对话连续连接/等待超过 5 分钟仍无新进展，��击此处立即还原最小化窗口并切回对应标签页。</div>
        <span class="n-cta">👉 点击直达对应 Gemini 对话标签页</span>
      </div>
      <div class="tab-bar">
        <span style="font-size:12.5px;font-weight:500;">✦ Gemini · 对话 #a1b2c3d4 <span style="color:#b35c07;">(停滞告警中)</span></span>
        <div class="badge-ico"><img src="{icon_b64}" alt="ext"><span class="red-dot">!</span></div>
      </div>
    </div>

    <div class="card panel">
      <div class="sec-title"><span>🔄 超时自动终止续接 &amp; 拟人防降速节流</span><span class="tag tag-green">草稿安全保护</span></div>
      <div class="prompt-preview">
        <strong>默认自动续接文案（支持自定义 200 字）：</strong><br>
        「继续，刚才mcp连接断开了」<br>
        <span style="font-size:11.5px;color:#5b5954;">发送前自动检查输入框是否有用户未发送草稿，绝不覆盖；后台隐藏态发送按钮支持 MAIN 世界点击兜底。</span>
      </div>
      <div class="ctrl-row"><span>一键立即续接（免等待阈值）</span><span class="tag tag-blue">立即续接</span></div>
      <div class="ctrl-row"><span>拟人防降速节流</span><span class="tag tag-green">随机延迟 + 分段输入</span></div>
      <div class="ctrl-row"><span>单对话独立开关通知与续接</span><span class="tag">互不干扰其他标签页</span></div>
    </div>
  </div>
</body>
</html>
"""
render_html_to_png(html_s3, os.path.join(SCREENSHOTS_DIR, 'screenshot-3-desktop-notifications-1280x800.png'), 1280, 800, dpr=2)

# -------------------------------------------------------------
# SCREENSHOT 4: Real-DOM Notion Popup Showcase (Light + Dark) (1280x800)
# -------------------------------------------------------------
html_s4 = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<style>
  {BASE_STYLE}
  body {{
    width: 1280px; height: 800px;
    padding: 28px 40px;
    display: flex; flex-direction: column; justify-content: space-between; gap: 18px;
  }}
  .stage {{
    flex: 1;
    display: grid;
    grid-template-columns: 356px 356px 1fr;
    gap: 22px;
    min-height: 0;
  }}
  .popup-frame {{
    border-radius: 11px;
    overflow: hidden;
    border: 1px solid rgba(55, 53, 47, 0.14);
    box-shadow: 0 8px 24px rgba(15, 15, 15, 0.08);
    background: #ffffff;
    display: flex; flex-direction: column;
  }}
  .popup-frame.dark {{
    background: #191919;
    border-color: rgba(15, 15, 15, 0.35);
    box-shadow: 0 10px 28px rgba(15, 15, 15, 0.16);
  }}
  .frame-bar {{
    padding: 7px 12px;
    font-size: 11px; font-weight: 600; color: #787774;
    background: #f7f6f3; border-bottom: 1px solid rgba(55, 53, 47, 0.09);
    display: flex; justify-content: space-between; align-items: center;
  }}
  .popup-frame.dark .frame-bar {{
    background: #202020; color: #9b9a97; border-bottom-color: rgba(255, 255, 255, 0.08);
  }}
  .img-wrap {{ flex: 1; overflow: hidden; }}
  .img-wrap img {{ width: 100%; height: auto; display: block; }}

  .notes {{ display: flex; flex-direction: column; justify-content: space-between; gap: 12px; }}
  .note {{
    padding: 15px 17px; flex: 1;
    display: flex; flex-direction: column; justify-content: center; gap: 5px;
  }}
  .note h3 {{ font-size: 14px; font-weight: 700; color: #37352f; }}
  .note p {{ font-size: 12px; color: #6b6a66; line-height: 1.5; }}
</style>
</head>
<body>
  <div class="top-header">
    <div class="brand">
      <img src="{icon_b64}" alt="logo">
      <div>
        <div class="title-line">
          <h1>Notion 极简设定中心 · 单对话卡片 + 全局配置</h1>
          <span class="tag tag-blue">v1.0.1 真实界面</span>
          <span class="tag tag-green">浅色纸感 / 深色炭灰</span>
        </div>
        <div class="subtitle">顶部专属「当前对话独立控制」卡片，支持 6 项独立开关、仅停本对话、恢复全局与 4 语言实时联动</div>
      </div>
    </div>
  </div>

  <div class="stage">
    <div class="popup-frame">
      <div class="frame-bar"><span>☀️ 浅色纸感模式 (Paper Light)</span><span>真实 DOM</span></div>
      <div class="img-wrap"><img src="{popup_light_b64}" alt="Notion Popup Light"></div>
    </div>

    <div class="popup-frame dark">
      <div class="frame-bar"><span>🌙 深色炭灰模式 (Charcoal Dark)</span><span>真实 DOM</span></div>
      <div class="img-wrap"><img src="{popup_dark_b64}" alt="Notion Popup Dark"></div>
    </div>

    <div class="notes">
      <div class="card note">
        <h3>🎛️ 顶部单对话独立卡片</h3>
        <p>自动识别当前聚焦 Gemini 标签页，支持独立开关 6 项功能、一键「仅停本对话」或「恢复全局」。</p>
      </div>
      <div class="card note">
        <h3>🛑 紧急停止精细分层</h3>
        <p>清晰区分「仅停本对话（紧急停止）」与「停止全部对话」，不再牵连其他正在跑任务的标签页。</p>
      </div>
      <div class="card note">
        <h3>🌐 4 语言 + 双主题同步</h3>
        <p>原生支持 简体中文、繁體中文、English、日本語，深浅主题在弹窗与悬浮窗间秒级同步。</p>
      </div>
      <div class="card note">
        <h3>🔒 100% 本地安全存储</h3>
        <p>所有全局配置、单对话覆写与计数均保存在 Chrome 本地 <code>storage.local</code>，零外联采集。</p>
      </div>
    </div>
  </div>
</body>
</html>
"""
render_html_to_png(html_s4, os.path.join(SCREENSHOTS_DIR, 'screenshot-4-popup-settings-1280x800.png'), 1280, 800, dpr=2)

# -------------------------------------------------------------
# SCREENSHOT 5: 6-Layer Circuit Breaker + Per-Chat & Background Safeguards (1280x800)
# -------------------------------------------------------------
html_s5 = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<style>
  {BASE_STYLE}
  body {{
    width: 1280px; height: 800px;
    padding: 30px 40px;
    display: flex; flex-direction: column; justify-content: space-between; gap: 18px;
  }}
  .grid {{ flex: 1; display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }}
  .layer {{
    padding: 18px 20px; display: flex; flex-direction: column; justify-content: space-between; gap: 10px;
  }}
  .layer-title {{ font-size: 15.5px; font-weight: 700; color: #37352f; margin: 8px 0 6px; }}
  .layer-desc {{ font-size: 12.5px; color: #6b6a66; line-height: 1.55; }}
  .layer-foot {{
    padding: 6px 10px; border-radius: 6px; font-size: 11.5px; font-weight: 600; text-align: center;
    background: #edf6f3; border: 1px solid rgba(15, 123, 108, 0.22); color: #0f7b6c;
  }}
  .guard-bar {{
    padding: 15px 20px;
    display: flex; align-items: center; justify-content: space-between; gap: 18px;
    background: #ffffff; border: 1px solid rgba(35, 131, 226, 0.26); border-radius: 10px;
  }}
</style>
</head>
<body>
  <div class="top-header">
    <div class="brand">
      <img src="{icon_b64}" alt="logo">
      <div>
        <div class="title-line">
          <h1>6 层防刷额度熔断 + 115 项自动化防线</h1>
          <span class="tag tag-red">防误触熔断</span>
          <span class="tag tag-green">115/115 测试通过</span>
        </div>
        <div class="subtitle">严防死循环消耗额度、Shadow DOM 异常结构与非对话页误点击，兼顾后台高可靠与极致安全</div>
      </div>
    </div>
  </div>

  <div class="grid">
    <div class="card layer">
      <div>
        <span class="tag tag-blue">Layer 1</span>
        <div class="layer-title">配额超限与报错瞬时熔断</div>
        <p class="layer-desc">实时检测「达到上限」「配额用完」「Too many requests」等字样，0 秒切断自动点击并告警。</p>
      </div>
      <div class="layer-foot">✓ 报错即时熔断停机</div>
    </div>

    <div class="card layer">
      <div>
        <span class="tag tag-blue">Layer 2</span>
        <div class="layer-title">单任务继续上限</div>
        <p class="layer-desc">限制单次对话任务连续点击继续次数（默认 10 次），发送新提问时自动清零复位。</p>
      </div>
      <div class="layer-foot">✓ 单轮会话额度锁</div>
    </div>

    <div class="card layer">
      <div>
        <span class="tag tag-blue">Layer 3</span>
        <div class="layer-title">流式停稳与拟人冷却</div>
        <p class="layer-desc">严格等待输出停稳（默认 1.8 秒）并叠加随机冷却与 60 秒防突发节流，绝不抢点。</p>
      </div>
      <div class="layer-foot">✓ 停稳防抖 + 拟人节流</div>
    </div>

    <div class="card layer">
      <div>
        <span class="tag tag-blue">Layer 4</span>
        <div class="layer-title">每日继续总配额上限</div>
        <p class="layer-desc">支持自定义全天继续上限（默认 0 为无上限），跨日零点自动归零，支持 Web Locks 原子计数。</p>
      </div>
      <div class="layer-foot">✓ 多标签并发零丢数</div>
    </div>

    <div class="card layer">
      <div>
        <span class="tag tag-blue">Layer 5</span>
        <div class="layer-title">完工语义智能避让</div>
        <p class="layer-desc">识别「全部完成」「All tests passed」等结语，若无截断信号或明确追问则自动跳过。</p>
      </div>
      <div class="layer-foot">✓ 完工智能跳过</div>
    </div>

    <div class="card layer">
      <div>
        <span class="tag tag-blue">Layer 6</span>
        <div class="layer-title">停滞与重复指纹阻断</div>
        <p class="layer-desc">比对前后轮输出指纹，连续重复或无新进展立即熔断，结合单对话隔离急停保护其他会话。</p>
      </div>
      <div class="layer-foot">✓ 死循环自动阻断</div>
    </div>
  </div>

  <div class="guard-bar">
    <div>
      <div style="font-size:14px; font-weight:700; color:#37352f;">🛡️ v1.0.1 非对话页护卫 · 隔离急停 · 深层边界防线</div>
      <div style="font-size:12px; color:#6b6a66; margin-top:3px;">自动屏蔽 /gems、/extensions、/settings 与 0 回复首页；内置 ShadowRoot 防环、时钟回拨保护、ReDoS 防护与零 innerHTML CSP 合规。</div>
    </div>
    <span class="tag tag-green" style="padding:5px 12px;font-size:12px;">✓ 115 / 115 Pass</span>
  </div>
</body>
</html>
"""
render_html_to_png(html_s5, os.path.join(SCREENSHOTS_DIR, 'screenshot-5-circuit-breaker-protection-1280x800.png'), 1280, 800, dpr=2)

# -------------------------------------------------------------
# PROMO TILE 1: Small Promo Tile (440x280) — Notion Paper Light
# -------------------------------------------------------------
html_p_small = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<style>
  {BASE_STYLE}
  body {{
    width: 440px; height: 280px;
    padding: 22px 24px;
    background: #f7f6f3;
    display: flex; flex-direction: column; justify-content: space-between;
  }}
  .top-row {{ display: flex; align-items: center; gap: 13px; }}
  .top-row img {{
    width: 48px; height: 48px; border-radius: 11px;
    border: 1px solid rgba(55, 53, 47, 0.12); background: #ffffff;
  }}
  .title-area h1 {{ font-size: 18px; font-weight: 700; color: #37352f; letter-spacing: -0.02em; }}
  .title-area p {{ font-size: 11.5px; color: #787774; margin-top: 3px; font-weight: 500; }}
  .badge-grid {{ display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }}
  .pill {{
    background: #ffffff; border: 1px solid rgba(55, 53, 47, 0.11);
    font-size: 11.5px; padding: 8px 10px; border-radius: 8px; color: #37352f; font-weight: 600; text-align: center;
  }}
  .footer-row {{
    display: flex; justify-content: space-between; align-items: center;
    border-top: 1px solid rgba(55, 53, 47, 0.1); padding-top: 10px; font-size: 11px; color: #787774;
  }}
</style>
</head>
<body>
  <div class="top-row">
    <img src="{icon_b64}" alt="logo">
    <div class="title-area">
      <h1>Gemini MCP Helper</h1>
      <p>Notion 极简界面 · 单对话控制 · 后台稳定运行</p>
    </div>
  </div>

  <div class="badge-grid">
    <div class="pill">⚡ MCP 始终允许</div>
    <div class="pill">🎛️ 单对话独立急停</div>
    <div class="pill">🛌 后台最小化点击</div>
    <div class="pill">🛡️ 6 层防刷熔断</div>
  </div>

  <div class="footer-row">
    <span>KenEasy · Google Gemini 专用</span>
    <span class="tag tag-blue" style="font-size:10.5px;padding:1px 7px;">v1.0.1</span>
  </div>
</body>
</html>
"""
render_html_to_png(html_p_small, os.path.join(PROMO_DIR, 'small-promo-tile-440x280.png'), 440, 280, dpr=2)

# -------------------------------------------------------------
# PROMO TILE 2: Marquee Promo Tile (1400x560) — Notion Showcase
# -------------------------------------------------------------
html_p_marquee = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<style>
  {BASE_STYLE}
  body {{
    width: 1400px; height: 560px;
    background: #f7f6f3;
    padding: 44px 60px;
    display: grid; grid-template-columns: 650px 1fr; gap: 40px; align-items: center;
  }}
  .brand-row {{ display: flex; align-items: center; gap: 15px; margin-bottom: 18px; }}
  .brand-row img {{
    width: 58px; height: 58px; border-radius: 14px;
    border: 1px solid rgba(55, 53, 47, 0.12); background: #ffffff;
  }}
  .hero-title {{ font-size: 38px; font-weight: 800; color: #37352f; line-height: 1.16; letter-spacing: -0.025em; }}
  .hero-sub {{ font-size: 15.5px; color: #6b6a66; margin: 16px 0 24px; line-height: 1.65; }}
  .pills-row {{ display: flex; flex-wrap: wrap; gap: 9px; }}
  .pill {{
    background: #ffffff; border: 1px solid rgba(55, 53, 47, 0.12);
    color: #37352f; font-size: 12.5px; font-weight: 600; padding: 7px 13px; border-radius: 7px;
  }}

  .dual-stage {{ position: relative; height: 430px; }}
  .card-light {{
    position: absolute; top: 10px; left: 0; width: 286px;
    background: #ffffff; color: #37352f; border: 1px solid rgba(55, 53, 47, 0.13); border-radius: 12px;
    padding: 14px 15px; box-shadow: 0 10px 28px rgba(15, 15, 15, 0.08);
  }}
  .card-dark {{
    position: absolute; bottom: 10px; right: 0; width: 286px;
    background: #1f1f1f; color: #e6e6e4; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px;
    padding: 14px 15px; box-shadow: 0 16px 38px rgba(15, 15, 15, 0.24);
  }}
  .ct {{ display: flex; justify-content: space-between; align-items: center; padding-bottom: 8px; margin-bottom: 8px; border-bottom: 1px solid rgba(55,53,47,0.09); font-size: 12.5px; font-weight: 600; }}
  .card-dark .ct {{ border-bottom-color: rgba(255,255,255,0.08); }}
  .sc {{ display: grid; grid-template-columns: 1fr 1fr; gap: 3px; background: rgba(55,53,47,0.07); padding: 2px; border-radius: 5px; font-size: 10.5px; text-align: center; margin-bottom: 8px; }}
  .card-dark .sc {{ background: rgba(0,0,0,0.28); }}
  .sc-on {{ background: #ffffff; color: #37352f; font-weight: 600; padding: 3px; border-radius: 4px; }}
  .card-dark .sc-on {{ background: #333333; color: #f1f1ef; }}
  .sc-off {{ color: #787774; padding: 3px; }}
  .card-dark .sc-off {{ color: #9b9a97; }}
  .cr {{ display: flex; justify-content: space-between; align-items: center; font-size: 11.5px; margin: 7px 0; }}
  .pl {{ background: #edf6f3; color: #0f7b6c; border: 1px solid rgba(15,123,108,0.24); padding: 2px 8px; border-radius: 5px; font-size: 10.5px; font-weight: 600; }}
  .pd {{ background: rgba(45,170,126,0.15); color: #6bc9a4; border: 1px solid rgba(45,170,126,0.3); padding: 2px 8px; border-radius: 5px; font-size: 10.5px; font-weight: 600; }}
</style>
</head>
<body>
  <div>
    <div class="brand-row">
      <img src="{icon_b64}" alt="logo">
      <div>
        <div style="font-size: 12px; font-weight: 700; color: #787774; letter-spacing: 0.06em; text-transform: uppercase;">Google Gemini MCP Automation</div>
        <div style="display:flex; gap:6px; margin-top:5px;">
          <span class="tag tag-blue">v1.0.1</span>
          <span class="tag tag-green">Notion 极简双主题</span>
          <span class="tag">4 Languages</span>
        </div>
      </div>
    </div>
    <h1 class="hero-title">KenEasy Gemini MCP Auto Helper</h1>
    <p class="hero-sub">专为 Google Gemini 网页端打造的 Notion 风格自动化助手：单对话独立开关与隔离紧急停止、后台最小化 MAIN 世界稳定点击、卡死自动续接与 6 层防刷熔断。</p>
    <div class="pills-row">
      <span class="pill">⚡ MCP 始终允许</span>
      <span class="pill">🎛️ 单对话独立控制</span>
      <span class="pill">🛑 隔离紧急停止</span>
      <span class="pill">🛌 后台最小化点击</span>
      <span class="pill">🛡️ 6 层防刷熔断</span>
    </div>
  </div>

  <div class="dual-stage">
    <div class="card-light">
      <div class="ct"><span><span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#0f7b6c;margin-right:6px;"></span>MCP 助手 <small style="color:#787774;">v1.0.1</small></span><span style="font-size:10.5px;color:#787774;">简体 ☾</span></div>
      <div class="sc"><div class="sc-on">本对话</div><div class="sc-off">全局默认</div></div>
      <div class="cr"><span>插件状态</span><span class="pl">运行中</span></div>
      <div class="cr"><span>自动始终允许</span><span class="pl">已开启</span></div>
      <div class="cr"><span>自动点击继续</span><span class="pl">已开启</span></div>
      <div class="cr"><span>后台切屏运行</span><span class="pl">已开启</span></div>
      <div class="cr"><span>超时自动续接</span><span class="pl">已开启</span></div>
      <div style="margin-top:9px;padding:7px 8px;border-radius:6px;background:#f7f6f3;border:1px solid rgba(55,53,47,0.08);font-size:10.5px;color:#787774;">对话 #a1b2c3 · 允许 18 · 今日 6/∞</div>
    </div>

    <div class="card-dark">
      <div class="ct"><span><span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#2daa7e;margin-right:6px;"></span>MCP Helper <small style="color:#9b9a97;">v1.0.1</small></span><span style="font-size:10.5px;color:#9b9a97;">EN ☀</span></div>
      <div class="sc"><div class="sc-on">This chat</div><div class="sc-off">Global</div></div>
      <div class="cr"><span>Extension</span><span class="pd">Active</span></div>
      <div class="cr"><span>Auto Always Allow</span><span class="pd">On</span></div>
      <div class="cr"><span>Auto Continue</span><span class="pd">On</span></div>
      <div class="cr"><span>Background Run</span><span class="pd">On</span></div>
      <div class="cr"><span>Stall Auto-Resume</span><span class="pd">On</span></div>
      <div style="margin-top:9px;padding:7px 8px;border-radius:6px;background:#262626;border:1px solid rgba(255,255,255,0.08);font-size:10.5px;color:#9b9a97;">Chat #x9y8z7 · Allow 18 · Today 6/∞</div>
    </div>
  </div>
</body>
</html>
"""
render_html_to_png(html_p_marquee, os.path.join(PROMO_DIR, 'marquee-promo-tile-1400x560.png'), 1400, 560, dpr=2)

print("All v1.0.1 Notion-style store screenshots and promo tiles generated successfully!")
