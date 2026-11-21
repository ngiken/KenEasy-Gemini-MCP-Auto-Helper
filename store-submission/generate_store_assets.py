import os
import subprocess
import base64
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STORE_DIR = os.path.join(ROOT, 'store-submission')
SCREENSHOTS_DIR = os.path.join(STORE_DIR, '03-screenshots')
PROMO_DIR = os.path.join(STORE_DIR, '04-promotional-tiles')
ICONS_DIR = os.path.join(ROOT, 'icons')
CHROME_PATH = r'C:\Program Files\Google\Chrome\Application\chrome.exe'

os.makedirs(SCREENSHOTS_DIR, exist_ok=True)
os.makedirs(PROMO_DIR, exist_ok=True)


def get_icon_b64(name='icon128.png'):
    p = os.path.join(ICONS_DIR, name)
    if os.path.exists(p):
        with open(p, 'rb') as f:
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


icon_b64 = get_icon_b64('icon128.png')

# -------------------------------------------------------------
# SCREENSHOT 1: MCP Auto-Approval in Action (1280x800)
# -------------------------------------------------------------
html_s1 = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<style>
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{
    width: 1280px; height: 800px;
    background: #070b14;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif;
    color: #f8fafc;
    overflow: hidden; position: relative;
    padding: 34px 44px;
    display: flex; flex-direction: column; justify-content: space-between; gap: 22px;
  }}
  .aura {{
    position: absolute; width: 680px; height: 680px; border-radius: 50%;
    background: radial-gradient(circle, rgba(59,130,246,0.18) 0%, transparent 68%);
    top: -180px; left: -120px; pointer-events: none;
  }}
  .header-bar {{
    position: relative; z-index: 2;
    display: flex; justify-content: space-between; align-items: center;
    border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 18px;
  }}
  .brand {{ display: flex; align-items: center; gap: 14px; }}
  .brand img {{ width: 46px; height: 46px; border-radius: 12px; box-shadow: 0 8px 20px rgba(59,130,246,0.35); }}
  .title-area h1 {{ font-size: 22px; font-weight: 800; color: #fff; display: flex; align-items: center; gap: 10px; }}
  .badge {{ background: rgba(59,130,246,0.2); color: #93c5fd; border: 1px solid rgba(96,165,250,0.45); font-size: 11px; padding: 3px 9px; border-radius: 999px; font-weight: 700; }}
  .badge-g {{ background: rgba(16,185,129,0.18); color: #6ee7b7; border: 1px solid rgba(16,185,129,0.45); font-size: 11px; padding: 3px 9px; border-radius: 999px; font-weight: 700; }}
  .subtitle {{ font-size: 13.5px; color: #94a3b8; margin-top: 3px; }}

  .main-stage {{
    position: relative; z-index: 2; flex: 1;
    display: grid; grid-template-columns: 1fr 340px; gap: 26px;
  }}
  .gemini-chat {{
    background: #111520; border: 1px solid rgba(255,255,255,0.12); border-radius: 18px;
    padding: 26px; display: flex; flex-direction: column; justify-content: space-between;
    box-shadow: 0 22px 54px rgba(0,0,0,0.5);
  }}
  .user-msg {{
    align-self: flex-end; background: #1e2534; border-radius: 16px 16px 4px 16px;
    padding: 13px 18px; font-size: 14px; max-width: 82%; border: 1px solid rgba(255,255,255,0.08); color: #f1f5f9;
  }}
  .ai-turn {{ display: flex; flex-direction: column; gap: 14px; }}
  .ai-badge {{ display: flex; align-items: center; gap: 9px; font-weight: 700; font-size: 14.5px; color: #93c5fd; }}
  .ai-text {{ font-size: 14px; line-height: 1.6; color: #cbd5e1; }}
  .mcp-card {{
    background: #182030; border: 1.5px solid rgba(96,165,250,0.55); border-radius: 14px;
    padding: 20px 22px; box-shadow: 0 12px 32px rgba(37,99,235,0.2);
    display: flex; flex-direction: column; gap: 12px;
  }}
  .mcp-header {{ display: flex; justify-content: space-between; align-items: center; }}
  .mcp-title {{ font-size: 14.5px; font-weight: 700; color: #f8fafc; }}
  .mcp-desc {{ font-size: 13px; color: #94a3b8; line-height: 1.45; }}
  .mcp-actions {{ display: flex; gap: 10px; justify-content: flex-end; align-items: center; }}
  .btn-deny {{ background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12); color: #94a3b8; padding: 8px 15px; border-radius: 9px; font-size: 12.5px; }}
  .btn-single {{ background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.2); color: #e2e8f0; padding: 8px 15px; border-radius: 9px; font-size: 12.5px; }}
  .btn-always {{
    background: linear-gradient(135deg, #2563eb, #1d4ed8); border: 1px solid #60a5fa; color: #ffffff;
    padding: 9px 18px; border-radius: 9px; font-size: 12.5px; font-weight: 700;
    box-shadow: 0 0 20px rgba(37,99,235,0.55);
  }}
  .chip-row {{ display: flex; gap: 10px; align-items: center; }}
  .chip-yes {{ background: rgba(16,185,129,0.16); border: 1px solid rgba(16,185,129,0.45); color: #6ee7b7; padding: 6px 14px; border-radius: 999px; font-size: 12.5px; font-weight: 700; }}
  .chip-hint {{ font-size: 12px; color: #64748b; }}

  .hud-preview-card {{
    background: rgba(19, 22, 29, 0.96); border: 1px solid rgba(255,255,255,0.15);
    border-radius: 18px; padding: 20px; box-shadow: 0 20px 50px rgba(0,0,0,0.55);
    display: flex; flex-direction: column; justify-content: space-between;
  }}
  .hud-top {{ display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 12px; }}
  .hud-title {{ font-size: 13.5px; font-weight: 700; display: flex; align-items: center; gap: 8px; }}
  .hud-dot {{ width: 9px; height: 9px; border-radius: 50%; background: #22c55e; box-shadow: 0 0 8px #22c55e; }}
  .hud-chips {{ display: flex; gap: 5px; font-size: 10.5px; }}
  .hc {{ padding: 2px 6px; border-radius: 5px; background: rgba(255,255,255,0.08); color: #cbd5e1; }}
  .hud-rows {{ margin: 16px 0; display: flex; flex-direction: column; gap: 13px; }}
  .hud-row {{ display: flex; justify-content: space-between; align-items: center; font-size: 12.5px; color: #e2e8f0; }}
  .pill {{ background: rgba(16,185,129,0.2); color: #6ee7b7; border: 1px solid rgba(16,185,129,0.45); padding: 3px 11px; border-radius: 999px; font-size: 11px; font-weight: 700; }}
  .hud-status-box {{ background: rgba(255,255,255,0.04); border-radius: 10px; padding: 11px 13px; font-size: 11.5px; color: #94a3b8; line-height: 1.55; }}
  .feature-points {{ border-top: 1px solid rgba(255,255,255,0.08); padding-top: 14px; display: flex; flex-direction: column; gap: 10px; }}
  .f-item {{ font-size: 12px; color: #93c5fd; display: flex; align-items: center; gap: 8px; }}
</style>
</head>
<body>
  <div class="aura"></div>
  <div class="header-bar">
    <div class="brand">
      <img src="{icon_b64}" alt="logo">
      <div class="title-area">
        <h1>Google Gemini MCP 智能自动放行 · 连续追问芯片 <span class="badge">v0.2 Beta</span> <span class="badge-g">4 语言 + 黑白双模式</span></h1>
        <p class="subtitle">穿透 Shadow DOM 与下拉菜单自动点击「始终允许」，严格过滤非对话页与历史旧芯片，零误触干扰</p>
      </div>
    </div>
  </div>

  <div class="main-stage">
    <div class="gemini-chat">
      <div class="user-msg">请调用已连接的 MCP 文件系统工具扫描工作区代码，并持续输出完整重构计划。</div>
      <div class="ai-turn">
        <div class="ai-badge">✦ Gemini · MCP Workflow</div>
        <p class="ai-text">我将调用本地 MCP 工具 <code>filesystem:list_directory</code> 获取目录结构，请授权权限：</p>
        <div class="mcp-card">
          <div class="mcp-header">
            <div class="mcp-title">⚙️ filesystem-mcp · 工具权限确认请求</div>
            <span class="badge-g">⚡ 0.6s 自动命中</span>
          </div>
          <div class="mcp-desc">允许当前对话中调用本地只读扫描工具（严格避让「拒绝 / 删除 / 取消」等反向黑名单按钮）。</div>
          <div class="mcp-actions">
            <span class="btn-deny">拒绝</span>
            <span class="btn-single">允许一次</span>
            <span class="btn-always">✓ 在此对话中始终允许</span>
          </div>
        </div>
        <div class="chip-row">
          <span class="chip-yes">↪ Yes</span>
          <span class="chip-hint">停稳等待后自动点击确认追问芯片，忽略普通长句推荐</span>
        </div>
      </div>
      <div style="font-size: 12px; color: #64748b; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 14px;">
        ✓ 支持后台切屏 / 最小化保持运行 · ✓ 屏蔽 /gems、/settings 等非对话页与未聚焦第 2 浏览器误点击
      </div>
    </div>

    <div class="hud-preview-card">
      <div>
        <div class="hud-top">
          <div class="hud-title"><span class="hud-dot"></span> MCP 助手 <span class="badge" style="font-size:9.5px; padding:1px 6px;">v0.2 Beta</span></div>
          <div class="hud-chips"><span class="hc">简体</span><span class="hc">☀</span><span class="hc">−</span></div>
        </div>
        <div class="hud-rows">
          <div class="hud-row"><span>插件状态</span><span class="pill">运行中</span></div>
          <div class="hud-row"><span>自动始终允许</span><span class="pill">已开启</span></div>
          <div class="hud-row"><span>自动点击继续</span><span class="pill">已开启</span></div>
          <div class="hud-row"><span>后台切屏运行</span><span class="pill">已开启</span></div>
          <div class="hud-row"><span>桌面通知</span><span class="pill">已开启</span></div>
        </div>
        <div class="hud-status-box">
          允许 42 · 本次继续 3/10 · 今日 18/∞<br>
          当前状态: <span style="color: #6ee7b7; font-weight:600;">监控中 · 后台就绪</span>
        </div>
      </div>

      <div class="feature-points">
        <div class="f-item">✦ 优先点击「始终允许」，可选回退单次允许</div>
        <div class="f-item">✦ 6 层防刷额度熔断（限流 / 停滞 / 完工识别）</div>
        <div class="f-item">✦ 100% 本地浏览器执行，零网络上传</div>
      </div>
    </div>
  </div>
</body>
</html>
"""
render_html_to_png(html_s1, os.path.join(SCREENSHOTS_DIR, 'screenshot-1-mcp-auto-approval-1280x800.png'), 1280, 800, dpr=2)

# -------------------------------------------------------------
# SCREENSHOT 2: Hold-to-Drag HUD + Dual Light/Dark Mode (1280x800)
# -------------------------------------------------------------
html_s2 = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<style>
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{
    width: 1280px; height: 800px;
    background: #070b14;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif;
    color: #f8fafc; overflow: hidden; position: relative;
    padding: 32px 44px;
    display: flex; flex-direction: column; justify-content: space-between; gap: 18px;
  }}
  .header-bar {{
    display: flex; justify-content: space-between; align-items: center;
    border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 16px;
  }}
  .brand {{ display: flex; align-items: center; gap: 14px; }}
  .brand img {{ width: 44px; height: 44px; border-radius: 11px; }}
  .title-area h1 {{ font-size: 21px; font-weight: 800; color: #fff; display: flex; align-items: center; gap: 10px; }}
  .badge-new {{ background: rgba(16,185,129,0.2); color: #6ee7b7; border: 1px solid rgba(16,185,129,0.45); font-size: 11px; padding: 3px 9px; border-radius: 999px; font-weight:700; }}
  .subtitle {{ font-size: 13px; color: #94a3b8; margin-top: 3px; }}

  .browser-box {{
    flex: 1; background: #10131b; border: 1px solid rgba(255,255,255,0.12); border-radius: 18px;
    display: flex; flex-direction: column; overflow: hidden;
    box-shadow: 0 24px 60px rgba(0,0,0,0.55);
  }}
  .b-top {{ background: #181c26; padding: 10px 18px; display: flex; align-items: center; gap: 14px; border-bottom: 1px solid rgba(255,255,255,0.08); }}
  .dots {{ display: flex; gap: 7px; }}
  .dot {{ width: 10px; height: 10px; border-radius: 50%; }}
  .url {{ flex:1; max-width: 560px; background: #0d1017; padding: 5px 12px; border-radius: 7px; font-size: 12px; color: #94a3b8; }}

  .canvas {{
    flex: 1; display: grid; grid-template-columns: 520px 1fr; padding: 26px 32px; gap: 28px; position: relative;
    background: radial-gradient(circle at 75% 40%, rgba(30,41,59,0.3) 0%, #10131b 70%);
  }}
  .left-chat {{ display: flex; flex-direction: column; gap: 16px; }}
  .u-msg {{ align-self: flex-end; background: #202533; padding: 11px 16px; border-radius: 16px 16px 4px 16px; font-size: 13px; color: #e2e8f0; }}
  .ai-card {{ background: #171c28; border: 1px solid rgba(96,165,250,0.35); border-radius: 12px; padding: 16px; display: flex; flex-direction: column; gap: 10px; }}
  .a-btn {{ background: #2563eb; color: #fff; padding: 7px 14px; border-radius: 8px; font-size: 12px; font-weight: 700; display: inline-block; align-self: flex-start; }}

  .drag-stage {{ position: relative; border-left: 1px dashed rgba(255,255,255,0.1); padding-left: 24px; }}
  .ghost {{
    position: absolute; right: 20px; bottom: 10px; width: 220px; height: 96px;
    border: 2px dashed rgba(148,163,184,0.28); border-radius: 14px;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    font-size: 11.5px; color: #64748b; gap: 3px;
  }}
  .arc {{ position: absolute; left: 260px; bottom: 92px; width: 170px; height: 150px; }}

  /* Light HUD + Dark HUD */
  .hud-dark {{
    position: absolute; top: 34px; left: 26px; width: 262px;
    background: rgba(22,25,32,0.96); border: 1px solid rgba(96,165,250,0.55); border-radius: 14px;
    padding: 11px 13px; box-shadow: 0 20px 46px rgba(0,0,0,0.65);
  }}
  .hud-light {{
    position: absolute; top: 130px; right: 24px; width: 262px;
    background: rgba(255,255,255,0.97); color: #111827; border: 1px solid rgba(15,23,42,0.15); border-radius: 14px;
    padding: 11px 13px; box-shadow: 0 22px 50px rgba(0,0,0,0.55);
  }}
  .drag-pill {{
    position: absolute; top: -30px; left: 50%; transform: translateX(-50%);
    background: #2563eb; color: #fff; font-size: 11px; font-weight: 700; padding: 4px 12px; border-radius: 999px; white-space: nowrap;
  }}
  .h-top {{ display: flex; justify-content: space-between; align-items: center; padding-bottom: 8px; margin-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.08); font-size: 12px; font-weight: 700; }}
  .hud-light .h-top {{ border-bottom-color: rgba(15,23,42,0.08); }}
  .h-r {{ display: flex; justify-content: space-between; align-items: center; font-size: 11px; margin: 6px 0; }}
  .p-d {{ padding: 2px 8px; border-radius: 999px; font-size: 10px; font-weight: 600; background: rgba(52,168,83,0.2); color: #86efac; border: 1px solid rgba(52,168,83,0.5); }}
  .p-l {{ padding: 2px 8px; border-radius: 999px; font-size: 10px; font-weight: 600; background: rgba(22,163,74,0.14); color: #15803d; border: 1px solid rgba(22,163,74,0.45); }}

  .bottom-specs {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }}
  .sp {{ background: rgba(15,23,42,0.75); border: 1px solid rgba(255,255,255,0.09); border-radius: 12px; padding: 12px 14px; }}
  .sp h4 {{ font-size: 12.5px; color: #93c5fd; margin-bottom: 3px; }}
  .sp p {{ font-size: 11px; color: #94a3b8; line-height: 1.4; }}
</style>
</head>
<body>
  <div class="header-bar">
    <div class="brand">
      <img src="{icon_b64}" alt="logo">
      <div class="title-area">
        <h1>按住自由拖拽悬浮窗 · 黑白深浅主题随心切换 <span class="badge-new">v0.2 Beta 重磅升级</span></h1>
        <p class="subtitle">严格左键按住拖拽（鼠标悬停绝不粘连跟随），支持深色/浅色模式与 简体 / 繁體 / EN / 日本語 标题栏一键切换</p>
      </div>
    </div>
  </div>

  <div class="browser-box">
    <div class="b-top">
      <div class="dots"><span class="dot" style="background:#ff5f56"></span><span class="dot" style="background:#ffbd2e"></span><span class="dot" style="background:#27c93f"></span></div>
      <div class="url">🔒 https://gemini.google.com/app/workspace-mcp-session</div>
    </div>
    <div class="canvas">
      <div class="left-chat">
        <div class="u-msg">自动执行工程代码扫描并保持后台监听确认</div>
        <div class="ai-card">
          <div style="font-size:13px; font-weight:700; color:#93c5fd;">🛡️ MCP 工具权限请求已自动放行</div>
          <div style="font-size:12px; color:#94a3b8; line-height:1.5;">悬浮窗支持拖拽至屏幕任意角落，左侧对话区完全无遮挡。</div>
          <span class="a-btn">✓ 在此对话中始终允许</span>
        </div>
      </div>

      <div class="drag-stage">
        <div class="ghost"><span>📍 默认右下角位置</span><span style="font-size:10px;">支持弹窗一键复位</span></div>

        <div class="hud-dark">
          <div class="drag-pill">✊ 左键按住拖拽中 (深色模式)</div>
          <div class="h-top">
            <span>🟢 MCP 助手 <small style="color:#93c5fd;">v0.2</small></span>
            <span style="font-size:10px; opacity:0.8;">简体 ☀ −</span>
          </div>
          <div class="h-r"><span>插件状态</span><span class="p-d">运行中</span></div>
          <div class="h-r"><span>自动始终允许</span><span class="p-d">已开启</span></div>
          <div class="h-r"><span>自动点击继续</span><span class="p-d">已开启</span></div>
          <div class="h-r"><span>桌面通知</span><span class="p-d">已开启</span></div>
        </div>

        <div class="hud-light">
          <div class="drag-pill" style="background:#0f172a; border:1px solid rgba(255,255,255,0.2);">☀️ 浅色模式 (English)</div>
          <div class="h-top">
            <span>🟢 MCP Helper <small style="color:#1d4ed8;">v0.2</small></span>
            <span style="font-size:10px; opacity:0.8;">EN ☾ −</span>
          </div>
          <div class="h-r"><span>Extension</span><span class="p-l">Active</span></div>
          <div class="h-r"><span>Always Allow</span><span class="p-l">On</span></div>
          <div class="h-r"><span>Auto Continue</span><span class="p-l">On</span></div>
          <div class="h-r"><span>Desktop Alert</span><span class="p-l">On</span></div>
        </div>
      </div>
    </div>
  </div>

  <div class="bottom-specs">
    <div class="sp"><h4>① 悬停零粘连修复</h4><p>仅左键按住标题栏才启动拖动，左键轻点立即展开/折叠。</p></div>
    <div class="sp"><h4>② 黑白双模式同步</h4><p>点击标题栏 ☀/☾ 即可即时切换浅色/深色主题并同步弹窗。</p></div>
    <div class="sp"><h4>③ 四语言快捷切换</h4><p>一键轮换 简体中文 / 繁體中文 / English / 日本語。</p></div>
    <div class="sp"><h4>④ 坐标记忆与复位</h4><p>自动存储屏幕坐标并防溢出边界，支持弹窗一键复位右下角。</p></div>
  </div>
</body>
</html>
"""
render_html_to_png(html_s2, os.path.join(SCREENSHOTS_DIR, 'screenshot-2-draggable-hud-1280x800.png'), 1280, 800, dpr=2)

# -------------------------------------------------------------
# SCREENSHOT 3: Desktop Notifications & Stall Alert (1280x800)
# -------------------------------------------------------------
html_s3 = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<style>
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{
    width: 1280px; height: 800px;
    background: #070b14;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif;
    color: #f8fafc; overflow: hidden; position: relative;
    padding: 34px 44px;
    display: flex; flex-direction: column; justify-content: space-between; gap: 22px;
  }}
  .header-bar {{
    display: flex; justify-content: space-between; align-items: center;
    border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 18px;
  }}
  .brand {{ display: flex; align-items: center; gap: 14px; }}
  .brand img {{ width: 46px; height: 46px; border-radius: 12px; }}
  .title-area h1 {{ font-size: 22px; font-weight: 800; color: #fff; display: flex; align-items: center; gap: 10px; }}
  .badge {{ background: rgba(245,158,11,0.2); color: #fbbf24; border: 1px solid rgba(245,158,11,0.5); font-size: 11px; padding: 3px 9px; border-radius: 999px; font-weight:700; }}
  .subtitle {{ font-size: 13.5px; color: #94a3b8; margin-top: 3px; }}

  .stage {{ flex: 1; display: grid; grid-template-columns: 1fr 1fr; gap: 26px; align-items: stretch; }}
  .panel {{
    background: rgba(15,23,42,0.65); border: 1px solid rgba(255,255,255,0.1); border-radius: 18px;
    padding: 26px; display: flex; flex-direction: column; justify-content: space-between; gap: 16px;
  }}
  .p-head {{ font-size: 15px; font-weight: 700; color: #93c5fd; }}

  .notif-card {{
    background: #1c222e; border: 1px solid rgba(255,255,255,0.15); border-left: 5px solid #f59e0b;
    border-radius: 14px; padding: 20px 22px; box-shadow: 0 18px 44px rgba(0,0,0,0.55);
  }}
  .n-top {{ display: flex; align-items: center; justify-content: space-between; font-size: 12px; color: #94a3b8; margin-bottom: 12px; }}
  .n-title {{ font-size: 15.5px; font-weight: 700; color: #fff; margin-bottom: 6px; }}
  .n-body {{ font-size: 13px; color: #cbd5e1; line-height: 1.55; }}
  .n-cta {{ margin-top: 14px; display: inline-block; background: #2563eb; color: #fff; padding: 7px 14px; border-radius: 8px; font-size: 12px; font-weight: 700; }}

  .tab-bar {{
    background: #131823; border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 14px 18px;
    display: flex; align-items: center; justify-content: space-between;
  }}
  .badge-ico {{ position: relative; }}
  .badge-ico img {{ width: 26px; height: 26px; border-radius: 6px; }}
  .red-dot {{ position: absolute; top:-4px; right:-4px; width:15px; height:15px; border-radius:50%; background:#ea4335; color:#fff; font-size:10px; font-weight:800; display:flex; align-items:center; justify-content:center; }}

  .ctrl-row {{
    background: #131823; border: 1px solid rgba(255,255,255,0.09); border-radius: 12px; padding: 15px 18px;
    display: flex; justify-content: space-between; align-items: center; font-size: 13.5px;
  }}
  .pill-on {{ background: rgba(16,185,129,0.2); color: #6ee7b7; border: 1px solid rgba(16,185,129,0.45); padding: 4px 13px; border-radius: 999px; font-size: 12px; font-weight: 700; }}
</style>
</head>
<body>
  <div class="header-bar">
    <div class="brand">
      <img src="{icon_b64}" alt="logo">
      <div class="title-area">
        <h1>卡死超时桌面通知 · 一键启闭与红点唤醒 <span class="badge">多语言原生提醒</span></h1>
        <p class="subtitle">MCP 调用挂起或响应停滞超过设定阈值自动弹窗报警，HUD 与设置面板随时秒切静音</p>
      </div>
    </div>
  </div>

  <div class="stage">
    <div class="panel">
      <div class="p-head">🖥️ 系统级桌面告警与标签聚焦</div>
      <div class="notif-card">
        <div class="n-top"><span>🔵 Google Chrome · 桌面通知</span><span>✕</span></div>
        <div class="n-title">⚠️ Gemini 连接已超过 5 分钟</div>
        <div class="n-body">检测到该对话连续连接/等待超过 5 分钟仍无新进展，点击此处立即切回对应标签页检查。</div>
        <span class="n-cta">👉 点击还原最小化窗口并激活 Gemini 标签页</span>
      </div>
      <div class="tab-bar">
        <span style="font-size:13px; color:#e2e8f0;">✦ Gemini - 工作区会话 <small style="color:#fbbf24;">(停滞报警中)</small></span>
        <div class="badge-ico"><img src="{icon_b64}" alt="ext"><span class="red-dot">!</span></div>
      </div>
    </div>

    <div class="panel">
      <div class="p-head">🔔 双向控制台与防误报机制</div>
      <div class="ctrl-row"><span>悬浮窗 / 弹窗一键开关</span><span class="pill-on">已开启 · 点击秒静音</span></div>
      <div class="ctrl-row"><span>超时提醒阈值设置</span><span style="color:#93c5fd; font-weight:700;">5 分钟 (支持 1~60 分钟)</span></div>
      <div class="ctrl-row"><span>多语言通知文案</span><span style="color:#6ee7b7; font-weight:700;">简 / 繁 / EN / 日本語 自动匹配</span></div>
      <div class="ctrl-row"><span>动态读秒倒计时过滤</span><span style="color:#cbd5e1;">仅真实无新文本进展时计时</span></div>
    </div>
  </div>
</body>
</html>
"""
render_html_to_png(html_s3, os.path.join(SCREENSHOTS_DIR, 'screenshot-3-desktop-notifications-1280x800.png'), 1280, 800, dpr=2)

# -------------------------------------------------------------
# SCREENSHOT 4: Dark/Light Popup & Multi-Language Settings (1280x800)
# -------------------------------------------------------------
html_s4 = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<style>
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{
    width: 1280px; height: 800px;
    background: #070b14;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif;
    color: #f8fafc; overflow: hidden; position: relative;
    padding: 32px 44px;
    display: flex; flex-direction: column; justify-content: space-between; gap: 20px;
  }}
  .header-bar {{
    display: flex; justify-content: space-between; align-items: center;
    border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 16px;
  }}
  .brand {{ display: flex; align-items: center; gap: 14px; }}
  .brand img {{ width: 44px; height: 44px; border-radius: 11px; }}
  .title-area h1 {{ font-size: 21px; font-weight: 800; color: #fff; display: flex; align-items: center; gap: 10px; }}
  .badge {{ background: rgba(59,130,246,0.2); color: #93c5fd; border: 1px solid rgba(96,165,250,0.45); font-size: 11px; padding: 3px 9px; border-radius: 999px; font-weight:700; }}
  .subtitle {{ font-size: 13px; color: #94a3b8; margin-top: 3px; }}

  .stage {{ flex: 1; display: grid; grid-template-columns: 375px 375px 1fr; gap: 22px; }}
  .p-card-shell {{
    border-radius: 16px; padding: 14px; display: flex; flex-direction: column; justify-content: space-between; font-size: 11px;
  }}
  .dark {{ background: #14161a; border: 1px solid rgba(255,255,255,0.15); color: #e8eaed; box-shadow: 0 22px 50px rgba(0,0,0,0.6); }}
  .light {{ background: #f4f6fb; border: 1px solid rgba(255,255,255,0.35); color: #111827; box-shadow: 0 22px 50px rgba(0,0,0,0.55); }}

  .p-h {{ display: flex; justify-content: space-between; align-items: center; padding-bottom: 8px; border-bottom: 1px solid rgba(148,163,184,0.18); }}
  .sw {{ width: 34px; height: 18px; border-radius: 999px; background: #34a853; position: relative; }}
  .sw::after {{ content: ""; position: absolute; width: 14px; height: 14px; border-radius: 50%; background: #fff; right: 2px; top: 2px; }}
  .bar {{ display: flex; justify-content: space-between; align-items: center; padding: 6px 9px; border-radius: 9px; }}
  .dark .bar, .dark .sec, .dark .st {{ background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); }}
  .light .bar, .light .sec, .light .st {{ background: #ffffff; border: 1px solid rgba(15,23,42,0.1); }}
  .sts {{ display: grid; grid-template-columns: repeat(3,1fr); gap: 6px; }}
  .st {{ border-radius: 9px; padding: 7px; text-align: center; }}
  .sec {{ border-radius: 11px; padding: 9px 11px; display: flex; flex-direction: column; gap: 6px; }}
  .row {{ display: flex; justify-content: space-between; align-items: center; font-size: 11px; }}
  .btn-save {{ background: #1a73e8; color: #fff; text-align: center; padding: 7px; border-radius: 8px; font-weight: 700; }}

  .notes {{ display: flex; flex-direction: column; justify-content: space-between; gap: 14px; }}
  .note {{ background: rgba(15,23,42,0.72); border: 1px solid rgba(255,255,255,0.1); border-radius: 14px; padding: 16px 18px; flex: 1; display:flex; flex-direction:column; justify-content:center; gap:5px; }}
  .note h3 {{ font-size: 14.5px; color: #93c5fd; }}
  .note p {{ font-size: 12px; color: #94a3b8; line-height: 1.5; }}
</style>
</head>
<body>
  <div class="header-bar">
    <div class="brand">
      <img src="{icon_b64}" alt="logo">
      <div class="title-area">
        <h1>黑白深浅双模式 · 多语言全功能设定面板 <span class="badge">v0.2 Beta</span></h1>
        <p class="subtitle">实时监控今日自动放行统计、灵活调整熔断阈值与关键词库，深色/浅色主题与 4 国语言同步切换</p>
      </div>
    </div>
  </div>

  <div class="stage">
    <div class="p-card-shell dark">
      <div class="p-h">
        <div style="font-weight:700; font-size:13px;">Gemini MCP 助手 <small style="color:#93c5fd;">v0.2 Beta</small></div>
        <div class="sw"></div>
      </div>
      <div class="bar"><span>🌐 简体中文 ▾</span><span>🌙 深色模式</span></div>
      <div class="sts">
        <div class="st"><small style="opacity:0.65">今日允许</small><div style="font-weight:700;font-size:13px;">42</div></div>
        <div class="st"><small style="opacity:0.65">今日继续</small><div style="font-weight:700;font-size:13px;">18 / ∞</div></div>
        <div class="st"><small style="opacity:0.65">当前状态</small><div style="font-weight:700;color:#81c995;">后台就绪</div></div>
      </div>
      <div class="sec">
        <div style="font-weight:700;color:#aecbfa;">⚡ 核心自动化</div>
        <div class="row"><span>自动点击 MCP「始终允许」</span><span>☑</span></div>
        <div class="row"><span>自动点击下方「继续」按钮</span><span>☑</span></div>
        <div class="row"><span>后台静默运行（防休眠）</span><span>☑</span></div>
        <div class="row"><span>显示网页自由拖拽悬浮窗</span><span>☑</span></div>
      </div>
      <div class="sec">
        <div style="font-weight:700;color:#aecbfa;">🛡️ 防刷熔断保护</div>
        <div class="row"><span>单次任务上限 / 每日上限</span><span>10 / ∞</span></div>
        <div class="row"><span>超时桌面通知提醒 (分钟)</span><span>5 分钟</span></div>
      </div>
      <div class="btn-save">保存设置并同步到 Gemini</div>
    </div>

    <div class="p-card-shell light">
      <div class="p-h">
        <div style="font-weight:700; font-size:13px;">Gemini MCP Helper <small style="color:#1d4ed8;">v0.2 Beta</small></div>
        <div class="sw"></div>
      </div>
      <div class="bar"><span>🌐 English ▾</span><span>☀️ Light</span></div>
      <div class="sts">
        <div class="st"><small style="opacity:0.65">Allowed</small><div style="font-weight:700;font-size:13px;">42</div></div>
        <div class="st"><small style="opacity:0.65">Continued</small><div style="font-weight:700;font-size:13px;">18 / ∞</div></div>
        <div class="st"><small style="opacity:0.65">Status</small><div style="font-weight:700;color:#15803d;">BG Ready</div></div>
      </div>
      <div class="sec">
        <div style="font-weight:700;color:#1d4ed8;">⚡ Core Automation</div>
        <div class="row"><span>Auto-click MCP "Always allow"</span><span>☑</span></div>
        <div class="row"><span>Auto-click "Continue / Yes"</span><span>☑</span></div>
        <div class="row"><span>Run silently in background</span><span>☑</span></div>
        <div class="row"><span>Show floating draggable HUD</span><span>☑</span></div>
      </div>
      <div class="sec">
        <div style="font-weight:700;color:#1d4ed8;">🛡️ 6-Layer Circuit Breaker</div>
        <div class="row"><span>Max per task / Daily cap</span><span>10 / ∞</span></div>
        <div class="row"><span>Desktop stall alert threshold</span><span>5 mins</span></div>
      </div>
      <div class="btn-save">Save Settings</div>
    </div>

    <div class="notes">
      <div class="note">
        <h3>🌐 4 语言原生适配</h3>
        <p>内置 简体中文、繁體中文、English、日本語，同步适配对应语言的 MCP 权限与继续关键词。</p>
      </div>
      <div class="note">
        <h3>🌗 黑白深浅主题切换</h3>
        <p>一键在深色护眼与浅色白昼模式间切换，Popup 面板与页面悬浮 HUD 实时联动。</p>
      </div>
      <div class="note">
        <h3>📍 悬浮窗复位 &amp; 应急停止</h3>
        <p>支持一键重置悬浮窗坐标至默认右下角，提供「紧急停止」与「解除熔断」快捷控制。</p>
      </div>
      <div class="note">
        <h3>🔒 100% 本地离线安全</h3>
        <p>所有配置与统计均保存在 Chrome 原生 <code>storage.local</code>，无第三方统计与外联请求。</p>
      </div>
    </div>
  </div>
</body>
</html>
"""
render_html_to_png(html_s4, os.path.join(SCREENSHOTS_DIR, 'screenshot-4-popup-settings-1280x800.png'), 1280, 800, dpr=2)

# -------------------------------------------------------------
# SCREENSHOT 5: 6-Layer Circuit Breaker + Multi-Window Guard (1280x800)
# -------------------------------------------------------------
html_s5 = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<style>
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{
    width: 1280px; height: 800px;
    background: #070b14;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif;
    color: #f8fafc; overflow: hidden; position: relative;
    padding: 34px 44px;
    display: flex; flex-direction: column; justify-content: space-between; gap: 20px;
  }}
  .header-bar {{
    display: flex; justify-content: space-between; align-items: center;
    border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 16px;
  }}
  .brand {{ display: flex; align-items: center; gap: 14px; }}
  .brand img {{ width: 44px; height: 44px; border-radius: 11px; }}
  .title-area h1 {{ font-size: 21px; font-weight: 800; color: #fff; display: flex; align-items: center; gap: 10px; }}
  .badge {{ background: rgba(239,68,68,0.2); color: #fca5a5; border: 1px solid rgba(239,68,68,0.5); font-size: 11px; padding: 3px 9px; border-radius: 999px; font-weight:700; }}
  .subtitle {{ font-size: 13px; color: #94a3b8; margin-top: 3px; }}

  .layers-grid {{ flex: 1; display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }}
  .layer-card {{
    background: rgba(15,23,42,0.72); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px;
    padding: 20px; display: flex; flex-direction: column; justify-content: space-between;
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.07);
  }}
  .layer-tag {{
    display: inline-block; font-size: 11px; font-weight: 700; color: #93c5fd;
    background: rgba(59,130,246,0.18); border: 1px solid rgba(96,165,250,0.35);
    padding: 3px 10px; border-radius: 999px; margin-bottom: 10px;
  }}
  .layer-title {{ font-size: 16px; font-weight: 700; color: #fff; margin-bottom: 7px; }}
  .layer-desc {{ font-size: 12.5px; color: #94a3b8; line-height: 1.55; }}
  .layer-badge {{
    margin-top: 12px; padding: 6px 12px; border-radius: 8px; font-size: 11.5px; font-weight: 700;
    background: rgba(16,185,129,0.14); color: #6ee7b7; border: 1px solid rgba(16,185,129,0.3); text-align: center;
  }}

  .guard-banner {{
    background: linear-gradient(135deg, rgba(30,58,138,0.28), rgba(15,23,42,0.85));
    border: 1px solid rgba(96,165,250,0.35); border-radius: 14px;
    padding: 15px 22px; display: flex; align-items: center; justify-content: space-between; gap: 20px;
  }}
</style>
</head>
<body>
  <div class="header-bar">
    <div class="brand">
      <img src="{icon_b64}" alt="logo">
      <div class="title-area">
        <h1>6 层防刷额度熔断 + 多浏览器防误点护卫 <span class="badge">安全防误触</span></h1>
        <p class="subtitle">全面防止无限循环消耗配额、误触非对话页按钮或第 2 浏览器恢复旧会话时自动误点击</p>
      </div>
    </div>
  </div>

  <div class="layers-grid">
    <div class="layer-card">
      <div>
        <span class="layer-tag">Layer 1</span>
        <div class="layer-title">配额超限与报错瞬时熔断</div>
        <p class="layer-desc">实时检测「达到上限」「配额用完」「Too many requests」等字样，0 秒切断自动点击。</p>
      </div>
      <div class="layer-badge">✓ 报错即时熔断停机</div>
    </div>

    <div class="layer-card">
      <div>
        <span class="layer-tag">Layer 2</span>
        <div class="layer-title">单任务继续上限</div>
        <p class="layer-desc">限制单次对话任务连续点击继续的次数（默认 10 次），发送新提问时自动清零复位。</p>
      </div>
      <div class="layer-badge">✓ 单轮会话额度锁</div>
    </div>

    <div class="layer-card">
      <div>
        <span class="layer-tag">Layer 3</span>
        <div class="layer-title">流式停稳与冷却守卫</div>
        <p class="layer-desc">严格等待 Gemini 输出完全停稳（默认 1.8 秒）及冷却防抖（4 秒），绝不在打字途中抢点。</p>
      </div>
      <div class="layer-badge">✓ 停稳防抖守卫</div>
    </div>

    <div class="layer-card">
      <div>
        <span class="layer-tag">Layer 4</span>
        <div class="layer-title">每日继续总配额上限</div>
        <p class="layer-desc">支持自定义全天自动点击继续总额度（默认 0 为无上限），跨日零点自动重置计数。</p>
      </div>
      <div class="layer-badge">✓ 跨天自动归零</div>
    </div>

    <div class="layer-card">
      <div>
        <span class="layer-tag">Layer 5</span>
        <div class="layer-title">完工语义智能跳过</div>
        <p class="layer-desc">识别「全部完成」「All tests passed」等结语，若无截断信号或明确追问则自动跳过继续。</p>
      </div>
      <div class="layer-badge">✓ 完工智能避让</div>
    </div>

    <div class="layer-card">
      <div>
        <span class="layer-tag">Layer 6</span>
        <div class="layer-title">停滞与重复输出检测</div>
        <p class="layer-desc">比对前后轮回答 Hash 指纹，若连续输出完全重复或 DOM 无新进展，立即自动熔断。</p>
      </div>
      <div class="layer-badge">✓ 死循环自动阻断</div>
    </div>
  </div>

  <div class="guard-banner">
    <div>
      <div style="font-size:14.5px; font-weight:700; color:#f8fafc;">🆕 v0.2 多浏览器 &amp; 非对话页安全守卫</div>
      <div style="font-size:12px; color:#94a3b8; margin-top:2px;">自动屏蔽 <code>/gems</code>、<code>/extensions</code>、<code>/settings</code> 与 0 回复首页；第 2 浏览器恢复历史会话时自动忽略陈旧芯片。</div>
    </div>
    <span style="background:rgba(16,185,129,0.2); color:#6ee7b7; border:1px solid rgba(16,185,129,0.45); padding:6px 14px; border-radius:999px; font-size:12px; font-weight:700; white-space:nowrap;">✓ 零误触保护</span>
  </div>
</body>
</html>
"""
render_html_to_png(html_s5, os.path.join(SCREENSHOTS_DIR, 'screenshot-5-circuit-breaker-protection-1280x800.png'), 1280, 800, dpr=2)

# -------------------------------------------------------------
# PROMO TILE 1: Small Promo Tile (440x280)
# -------------------------------------------------------------
html_p_small = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<style>
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{
    width: 440px; height: 280px;
    background: radial-gradient(circle at 20% 20%, #172554 0%, #090d16 62%, #05070c 100%);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif;
    color: #f8fafc; overflow: hidden; position: relative;
    padding: 24px;
    display: flex; flex-direction: column; justify-content: space-between;
  }}
  .top-row {{ display: flex; align-items: center; gap: 14px; }}
  .top-row img {{ width: 52px; height: 52px; border-radius: 13px; box-shadow: 0 8px 22px rgba(59,130,246,0.45); }}
  .title-area h1 {{ font-size: 18px; font-weight: 800; color: #fff; line-height: 1.2; }}
  .title-area p {{ font-size: 11.5px; color: #93c5fd; margin-top: 4px; font-weight: 600; }}
  .badge-grid {{ display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }}
  .pill {{
    background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12);
    font-size: 11px; padding: 7px 10px; border-radius: 10px; color: #e2e8f0; font-weight: 600; text-align: center;
  }}
  .footer-row {{
    display: flex; justify-content: space-between; align-items: center;
    border-top: 1px solid rgba(255,255,255,0.1); padding-top: 10px; font-size: 11px; color: #94a3b8;
  }}
</style>
</head>
<body>
  <div class="top-row">
    <img src="{icon_b64}" alt="logo">
    <div class="title-area">
      <h1>Gemini MCP Helper</h1>
      <p>自动放行 · 黑白双模式 · 4 语言</p>
    </div>
  </div>

  <div class="badge-grid">
    <div class="pill">⚡ MCP 始终允许</div>
    <div class="pill">🖱️ 按住自由拖拽</div>
    <div class="pill">🌗 深色 / 浅色主题</div>
    <div class="pill">🛡️ 6 层防刷熔断</div>
  </div>

  <div class="footer-row">
    <span>KenEasy · Google Gemini 专用</span>
    <span style="color: #60a5fa; font-weight: 700;">v0.2 Beta</span>
  </div>
</body>
</html>
"""
render_html_to_png(html_p_small, os.path.join(PROMO_DIR, 'small-promo-tile-440x280.png'), 440, 280, dpr=2)

# -------------------------------------------------------------
# PROMO TILE 2: Marquee Promo Tile (1400x560)
# -------------------------------------------------------------
html_p_marquee = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<style>
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{
    width: 1400px; height: 560px;
    background: radial-gradient(circle at 18% 22%, #172554 0%, #090d16 55%, #05070c 100%);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif;
    color: #f8fafc; overflow: hidden; position: relative;
    padding: 46px 64px;
    display: grid; grid-template-columns: 650px 1fr; gap: 38px; align-items: center;
  }}
  .brand-row {{ display: flex; align-items: center; gap: 16px; margin-bottom: 18px; }}
  .brand-row img {{ width: 62px; height: 62px; border-radius: 15px; box-shadow: 0 10px 28px rgba(59,130,246,0.45); }}
  .v-pill {{
    display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 11.5px; font-weight: 700;
    background: rgba(59,130,246,0.2); border: 1px solid rgba(96,165,250,0.45); color: #93c5fd; margin-top: 4px;
  }}
  .hero-title {{ font-size: 40px; font-weight: 800; color: #fff; line-height: 1.15; letter-spacing: -0.7px; }}
  .hero-sub {{ font-size: 16px; color: #94a3b8; margin: 16px 0 24px; line-height: 1.6; }}
  .pills-row {{ display: flex; flex-wrap: wrap; gap: 10px; }}
  .pill {{
    background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.14);
    color: #e2e8f0; font-size: 12.5px; font-weight: 600; padding: 7px 14px; border-radius: 999px;
  }}

  .dual-stage {{ position: relative; height: 420px; }}
  .card-dark {{
    position: absolute; top: 18px; left: 0; width: 274px;
    background: rgba(20,23,29,0.96); border: 1px solid rgba(255,255,255,0.16); border-radius: 16px;
    padding: 15px; box-shadow: 0 24px 54px rgba(0,0,0,0.65);
  }}
  .card-light {{
    position: absolute; bottom: 18px; right: 0; width: 274px;
    background: rgba(255,255,255,0.97); color: #111827; border: 1px solid rgba(15,23,42,0.14); border-radius: 16px;
    padding: 15px; box-shadow: 0 26px 60px rgba(0,0,0,0.55);
  }}
  .ct {{ display: flex; justify-content: space-between; align-items: center; padding-bottom: 9px; margin-bottom: 9px; border-bottom: 1px solid rgba(148,163,184,0.2); font-size: 12.5px; font-weight: 700; }}
  .cr {{ display: flex; justify-content: space-between; align-items: center; font-size: 11.5px; margin: 8px 0; }}
  .pd {{ background: rgba(52,168,83,0.2); color: #86efac; border: 1px solid rgba(52,168,83,0.5); padding: 2px 9px; border-radius: 999px; font-size: 10.5px; font-weight: 700; }}
  .pl {{ background: rgba(22,163,74,0.14); color: #15803d; border: 1px solid rgba(22,163,74,0.45); padding: 2px 9px; border-radius: 999px; font-size: 10.5px; font-weight: 700; }}
</style>
</head>
<body>
  <div>
    <div class="brand-row">
      <img src="{icon_b64}" alt="logo">
      <div>
        <div style="font-size: 12.5px; font-weight: 700; color: #60a5fa; letter-spacing: 1px; text-transform: uppercase;">Google Gemini MCP Automation</div>
        <span class="v-pill">v0.2 Beta · 4 Languages · Dark &amp; Light Mode</span>
      </div>
    </div>
    <h1 class="hero-title">KenEasy Gemini MCP Auto Helper</h1>
    <p class="hero-sub">专为 Google Gemini 网页端打造的自动化放行与连续交互助手：智能点击「始终允许」、修复左键按住拖拽悬浮窗、支持 简/繁/EN/日 与黑白双模式、多窗口防误触及 6 层防刷熔断。</p>
    <div class="pills-row">
      <span class="pill">⚡ MCP 始终允许放行</span>
      <span class="pill">🖱️ 按住拖拽悬浮窗</span>
      <span class="pill">🌗 黑白深浅主题</span>
      <span class="pill">🌐 4 语言界面切换</span>
      <span class="pill">🛡️ 6 层防刷熔断</span>
    </div>
  </div>

  <div class="dual-stage">
    <div class="card-dark">
      <div class="ct"><span>🟢 MCP 助手 <small style="color:#93c5fd;">v0.2</small></span><span style="font-size:10.5px;opacity:0.8;">简体 ☀</span></div>
      <div class="cr"><span>插件状态</span><span class="pd">运行中</span></div>
      <div class="cr"><span>自动始终允许</span><span class="pd">已开启</span></div>
      <div class="cr"><span>自动点击继续</span><span class="pd">已开启</span></div>
      <div class="cr"><span>后台切屏运行</span><span class="pd">已开启</span></div>
      <div class="cr"><span>桌面超时通知</span><span class="pd">已开启</span></div>
      <div style="margin-top:10px;padding:8px;border-radius:8px;background:rgba(255,255,255,0.05);font-size:11px;color:#94a3b8;">允许 42 · 本次 3/10 · 今日 18/∞</div>
    </div>

    <div class="card-light">
      <div class="ct"><span>🟢 MCP Helper <small style="color:#1d4ed8;">v0.2</small></span><span style="font-size:10.5px;opacity:0.8;">EN ☾</span></div>
      <div class="cr"><span>Extension</span><span class="pl">Active</span></div>
      <div class="cr"><span>Auto Always Allow</span><span class="pl">On</span></div>
      <div class="cr"><span>Auto Continue</span><span class="pl">On</span></div>
      <div class="cr"><span>Background Run</span><span class="pl">On</span></div>
      <div class="cr"><span>Desktop Alert</span><span class="pl">On</span></div>
      <div style="margin-top:10px;padding:8px;border-radius:8px;background:rgba(15,23,42,0.05);font-size:11px;color:#475569;">Allow 42 · Task 3/10 · Today 18/∞</div>
    </div>
  </div>
</body>
</html>
"""
render_html_to_png(html_p_marquee, os.path.join(PROMO_DIR, 'marquee-promo-tile-1400x560.png'), 1400, 560, dpr=2)

print("All screenshots and promo tiles generated successfully!")
