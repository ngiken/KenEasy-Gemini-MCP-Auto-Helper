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

def render_html_to_png(html_content, output_png_path, width=1280, height=800):
    temp_html = os.path.join(STORE_DIR, '_temp_store_render.html')
    with open(temp_html, 'w', encoding='utf-8') as f:
        f.write(html_content)
    
    cmd = [
        CHROME_PATH,
        '--headless=new',
        '--disable-gpu',
        '--hide-scrollbars',
        f'--window-size={width},{height}',
        '--force-device-scale-factor=1',
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
    background: #0e1217;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif;
    color: #e2e8f0;
    overflow: hidden;
    position: relative;
    padding: 30px 40px;
  }}
  .header-bar {{
    display: flex; justify-content: space-between; align-items: center;
    border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 18px; margin-bottom: 24px;
  }}
  .brand {{ display: flex; align-items: center; gap: 14px; }}
  .brand img {{ width: 44px; height: 44px; border-radius: 10px; }}
  .title-area h1 {{ font-size: 20px; font-weight: 700; color: #fff; display: flex; align-items: center; gap: 10px; }}
  .badge {{ background: rgba(59,130,246,0.2); color: #60a5fa; border: 1px solid #3b82f6; font-size: 11px; padding: 2px 8px; border-radius: 999px; }}
  .badge-beta {{ background: rgba(245,158,11,0.2); color: #fbbf24; border: 1px solid #f59e0b; font-size: 11px; padding: 2px 8px; border-radius: 999px; }}
  .subtitle {{ font-size: 13px; color: #94a3b8; margin-top: 2px; }}

  .main-stage {{
    display: grid; grid-template-columns: 1fr 340px; gap: 28px; height: 660px;
  }}
  
  /* Left: Gemini web chat simulation */
  .gemini-chat {{
    background: #161b22; border: 1px solid rgba(255,255,255,0.08); border-radius: 16px;
    padding: 24px; display: flex; flex-direction: column; justify-content: space-between;
    box-shadow: 0 12px 36px rgba(0,0,0,0.4); position: relative;
  }}
  .user-msg {{
    align-self: flex-end; background: #21262d; border-radius: 16px 16px 4px 16px;
    padding: 12px 18px; font-size: 14px; max-width: 80%; border: 1px solid rgba(255,255,255,0.06);
  }}
  .ai-turn {{ margin-top: 18px; }}
  .ai-badge {{ display: flex; align-items: center; gap: 8px; font-weight: 600; font-size: 14px; color: #8ab4f8; margin-bottom: 12px; }}
  .ai-text {{ font-size: 14px; line-height: 1.6; color: #cbd5e1; }}
  
  /* MCP Tool Dialog Card */
  .mcp-card {{
    margin-top: 20px; background: #1f2937; border: 2px solid #3b82f6; border-radius: 12px;
    padding: 18px 20px; box-shadow: 0 0 24px rgba(59,130,246,0.3); position: relative;
  }}
  .mcp-header {{ display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }}
  .mcp-title {{ font-size: 14px; font-weight: 600; color: #93c5fd; display: flex; align-items: center; gap: 8px; }}
  .mcp-desc {{ font-size: 13px; color: #94a3b8; margin-bottom: 16px; line-height: 1.4; }}
  .mcp-actions {{ display: flex; gap: 12px; justify-content: flex-end; align-items: center; }}
  .btn-deny {{ background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.15); color: #cbd5e1; padding: 7px 14px; border-radius: 8px; font-size: 12px; }}
  .btn-single {{ background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.2); color: #e2e8f0; padding: 7px 14px; border-radius: 8px; font-size: 12px; }}
  .btn-always {{
    background: #2563eb; border: 1px solid #60a5fa; color: #ffffff; padding: 8px 18px;
    border-radius: 8px; font-size: 12px; font-weight: 600; box-shadow: 0 0 14px rgba(37,99,235,0.6);
    position: relative; animation: pulse-btn 1.5s infinite;
  }}
  .callout-arrow {{
    position: absolute; bottom: -38px; right: 28px;
    background: #10b981; color: #fff; font-size: 11px; font-weight: 700;
    padding: 4px 10px; border-radius: 6px; box-shadow: 0 4px 12px rgba(16,185,129,0.4);
  }}

  /* Right: HUD Panel feature showcase */
  .hud-preview-card {{
    background: rgba(24, 26, 31, 0.96); border: 1px solid rgba(255,255,255,0.15);
    border-radius: 16px; padding: 18px 20px; box-shadow: 0 14px 40px rgba(0,0,0,0.5);
    display: flex; flex-direction: column; justify-content: space-between;
  }}
  .hud-top {{ display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 12px; }}
  .hud-title {{ font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 8px; }}
  .hud-dot {{ width: 8px; height: 8px; border-radius: 50%; background: #10b981; box-shadow: 0 0 8px #10b981; }}
  .hud-rows {{ margin: 16px 0; display: flex; flex-direction: column; gap: 12px; }}
  .hud-row {{ display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: #cbd5e1; }}
  .pill {{ background: rgba(16,185,129,0.2); color: #34d399; border: 1px solid rgba(16,185,129,0.4); padding: 3px 10px; border-radius: 999px; font-size: 11px; font-weight: 600; }}
  .hud-status-box {{ background: rgba(0,0,0,0.3); border-radius: 8px; padding: 10px; font-size: 11px; color: #94a3b8; line-height: 1.5; }}
  .feature-points {{ margin-top: 18px; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 14px; display: flex; flex-direction: column; gap: 10px; }}
  .f-item {{ font-size: 12px; color: #93c5fd; display: flex; align-items: center; gap: 8px; }}
</style>
</head>
<body>
  <div class="header-bar">
    <div class="brand">
      <img src="{icon_b64}" alt="logo">
      <div class="title-area">
        <h1>Google Gemini MCP 自动化放行 · 智能连续追问 <span class="badge">Chrome Web Store 官方认证</span> <span class="badge-beta">v0.1 Beta</span></h1>
        <p class="subtitle">深度适配 Gemini 网页端，自动点击「始终允许」权限与「↪ Yes / 继续」确认芯片，彻底告别频繁手动点击打断思路</p>
      </div>
    </div>
  </div>

  <div class="main-stage">
    <div class="gemini-chat">
      <div class="user-msg">请使用已连接的 MCP 文件系统工具与代码搜索工具，批量分析项目架构并持续输出完整重构规划。</div>
      <div class="ai-turn">
        <div class="ai-badge">✦ Gemini 2.5 Pro</div>
        <p class="ai-text">我将开始调用本地 MCP 服务器 <code>filesystem-mcp</code> 检索工程代码目录。根据安全策略，需要先获取权限：</p>
        <div class="mcp-card">
          <div class="mcp-header">
            <div class="mcp-title">⚙️ filesystem-mcp · 请求访问本地目录权限</div>
            <span class="badge" style="background: rgba(16,185,129,0.2); color: #34d399; border-color: #10b981;">⚡ 已智能命中</span>
          </div>
          <div class="mcp-desc">MCP 服务器希望在当前会话中执行只读扫描。此操作受到浏览器的安全隔离保护。</div>
          <div class="mcp-actions">
            <span class="btn-deny">拒绝</span>
            <span class="btn-single">仅允许一次</span>
            <span class="btn-always">✓ 在此对话中始终允许 (优先自动放行)</span>
          </div>
          <div class="callout-arrow">⚡ 0.6 秒毫秒级安全自动放行</div>
        </div>
      </div>
      <div style="font-size: 12px; color: #64748b; margin-top: 20px;">✓ 自动穿透 Material Web Components Shadow DOM 与下拉菜单，支持后台切屏不中断</div>
    </div>

    <div class="hud-preview-card">
      <div>
        <div class="hud-top">
          <div class="hud-title"><span class="hud-dot"></span> MCP 助手 <span class="badge-beta" style="font-size: 9px; padding: 1px 5px;">v0.1 Beta</span></div>
          <span style="font-size: 11px; color: #64748b;">网页悬浮看板</span>
        </div>
        <div class="hud-rows">
          <div class="hud-row"><span>插件总控</span><span class="pill">运行中</span></div>
          <div class="hud-row"><span>自动始终允许</span><span class="pill">已开启</span></div>
          <div class="hud-row"><span>自动点击继续</span><span class="pill">已开启</span></div>
          <div class="hud-row"><span>后台防休眠</span><span class="pill">已开启</span></div>
          <div class="hud-row"><span>桌面通知</span><span class="pill">已开启</span></div>
        </div>
        <div class="hud-status-box">
          今日允许: <b>42 次</b> | 今日继续: <b>18 / ∞</b><br>
          当前状态: <span style="color: #34d399;">后台就绪 (切屏运行中)</span>
        </div>
      </div>

      <div class="feature-points">
        <div class="f-item">✦ 智能优先选择「始终允许」，回退单次允许</div>
        <div class="f-item">✦ 6 层防刷额度熔断（防死循环/停滞/限流）</div>
        <div class="f-item">✦ 100% 本地运行，零数据上传，开源可审计</div>
      </div>
    </div>
  </div>
</body>
</html>
"""
render_html_to_png(html_s1, os.path.join(SCREENSHOTS_DIR, 'screenshot-1-mcp-auto-approval-1280x800.png'), 1280, 800)

# -------------------------------------------------------------
# SCREENSHOT 2: Draggable Floating HUD (1280x800)
# -------------------------------------------------------------
html_s2 = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<style>
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{
    width: 1280px; height: 800px;
    background: #0b0f19;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif;
    color: #f1f5f9;
    overflow: hidden;
    position: relative;
    padding: 30px 40px;
  }}
  .header-bar {{
    display: flex; justify-content: space-between; align-items: center;
    border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 18px; margin-bottom: 24px;
  }}
  .brand {{ display: flex; align-items: center; gap: 14px; }}
  .brand img {{ width: 44px; height: 44px; border-radius: 10px; }}
  .title-area h1 {{ font-size: 20px; font-weight: 700; color: #fff; display: flex; align-items: center; gap: 10px; }}
  .badge-new {{ background: rgba(16,185,129,0.2); color: #34d399; border: 1px solid #10b981; font-size: 11px; padding: 2px 8px; border-radius: 999px; }}
  .subtitle {{ font-size: 13px; color: #94a3b8; margin-top: 2px; }}

  .canvas-stage {{
    width: 100%; height: 660px; background: radial-gradient(circle at 60% 40%, #1e293b 0%, #0f172a 70%);
    border: 1px dashed rgba(255,255,255,0.15); border-radius: 18px; position: relative;
    display: flex; align-items: center; justify-content: center; overflow: hidden;
  }}
  
  .mockup-bg {{
    position: absolute; top: 30px; left: 40px; right: 40px; bottom: 30px;
    background: rgba(15,23,42,0.6); border: 1px solid rgba(255,255,255,0.06); border-radius: 14px;
    padding: 24px; opacity: 0.5;
  }}

  /* Drag path line */
  .drag-path {{
    position: absolute; top: 120px; left: 220px; width: 680px; height: 380px;
    border: 2px dashed #3b82f6; border-radius: 40px; opacity: 0.6; pointer-events: none;
  }}

  /* Floating HUD Mockup */
  .hud-draggable {{
    position: absolute; top: 180px; left: 520px;
    width: 260px; background: rgba(24, 26, 31, 0.94);
    backdrop-filter: blur(12px); border: 2px solid #60a5fa; border-radius: 14px;
    box-shadow: 0 20px 50px rgba(0,0,0,0.6), 0 0 25px rgba(59,130,246,0.35);
    padding: 12px 14px; cursor: grabbing;
  }}
  .hud-header {{ display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px; }}
  .drag-handle-hint {{
    position: absolute; top: -38px; left: 50%; transform: translateX(-50%);
    background: #3b82f6; color: #fff; font-size: 11px; font-weight: 700;
    padding: 4px 12px; border-radius: 999px; box-shadow: 0 4px 14px rgba(59,130,246,0.5);
    white-space: nowrap; display: flex; align-items: center; gap: 6px;
  }}

  .hud-pill-row {{ display: flex; justify-content: space-between; align-items: center; margin: 8px 0; font-size: 11px; color: #cbd5e1; }}
  .pill-on {{ background: rgba(16,185,129,0.25); color: #34d399; border: 1px solid rgba(16,185,129,0.4); padding: 2px 8px; border-radius: 999px; font-size: 10px; font-weight: 600; }}

  .feature-box {{
    position: absolute; bottom: 40px; left: 50px;
    background: rgba(15,23,42,0.9); border: 1px solid rgba(59,130,246,0.3); border-radius: 12px;
    padding: 16px 20px; max-width: 420px; box-shadow: 0 10px 30px rgba(0,0,0,0.4);
  }}
  .feature-box h3 {{ font-size: 14px; color: #60a5fa; margin-bottom: 6px; }}
  .feature-box p {{ font-size: 12px; color: #94a3b8; line-height: 1.5; }}
</style>
</head>
<body>
  <div class="header-bar">
    <div class="brand">
      <img src="{icon_b64}" alt="logo">
      <div class="title-area">
        <h1>全域自由拖拽悬浮窗 (Draggable Floating HUD) <span class="badge-new">v0.1 重磅升级</span></h1>
        <p class="subtitle">告别死板右下角限制！滑鼠按住頂部標題列隨意拖動至螢幕任意角落，智慧防溢出與位置自動持久化記憶</p>
      </div>
    </div>
  </div>

  <div class="canvas-stage">
    <div class="mockup-bg">
      <div style="font-size: 14px; color: #475569;">Google Gemini Web Application Interface</div>
      <div style="margin-top: 10px; width: 60%; height: 12px; background: rgba(255,255,255,0.05); border-radius: 4px;"></div>
      <div style="margin-top: 8px; width: 40%; height: 12px; background: rgba(255,255,255,0.04); border-radius: 4px;"></div>
    </div>

    <div class="drag-path"></div>

    <div class="hud-draggable">
      <div class="drag-handle-hint">✊ 抓取任意拖曳至理想位置</div>
      <div class="hud-header">
        <div style="font-weight: 600; font-size: 12px; display: flex; align-items: center; gap: 6px;">
          <span style="width: 8px; height: 8px; border-radius: 50%; background: #10b981;"></span> MCP 助手
        </div>
        <span style="font-size: 11px; color: #94a3b8;">−</span>
      </div>
      <div style="margin-top: 8px;">
        <div class="hud-pill-row"><span>插件狀態</span><span class="pill-on">已啟用</span></div>
        <div class="hud-pill-row"><span>自動始終允許</span><span class="pill-on">已開啟</span></div>
        <div class="hud-pill-row"><span>自動點擊繼續</span><span class="pill-on">已開啟</span></div>
        <div class="hud-pill-row"><span>後台切屏運行</span><span class="pill-on">已開啟</span></div>
        <div class="hud-pill-row"><span>桌面通知</span><span class="pill-on">已開啟</span></div>
      </div>
    </div>

    <div class="feature-box">
      <h3>🎯 核心拖拽特點</h3>
      <p>1. <b>邊界防溢出約束</b>：智慧演算法將懸浮窗嚴格限制在螢幕可視區內，絕不拖丟。<br>
      2. <b>4px 防誤觸消抖</b>：點擊折疊與按鈕切換絕不觸發位移。<br>
      3. <b>座標自動記憶</b>：位置自動儲存至 LocalStorage，切換對話與重新整理無縫復位。</p>
    </div>
  </div>
</body>
</html>
"""
render_html_to_png(html_s2, os.path.join(SCREENSHOTS_DIR, 'screenshot-2-draggable-hud-1280x800.png'), 1280, 800)

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
    background: #0d1117;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif;
    color: #f3f4f6;
    overflow: hidden;
    position: relative;
    padding: 30px 40px;
  }}
  .header-bar {{
    display: flex; justify-content: space-between; align-items: center;
    border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 18px; margin-bottom: 24px;
  }}
  .brand {{ display: flex; align-items: center; gap: 14px; }}
  .brand img {{ width: 44px; height: 44px; border-radius: 10px; }}
  .title-area h1 {{ font-size: 20px; font-weight: 700; color: #fff; display: flex; align-items: center; gap: 10px; }}
  .badge {{ background: rgba(245,158,11,0.2); color: #fbbf24; border: 1px solid #f59e0b; font-size: 11px; padding: 2px 8px; border-radius: 999px; }}
  .subtitle {{ font-size: 13px; color: #94a3b8; margin-top: 2px; }}

  .stage {{
    display: grid; grid-template-columns: 1fr 1fr; gap: 30px; height: 660px; align-items: center;
  }}

  /* Left: Desktop Notification Toast */
  .notif-card {{
    background: #1f2937; border: 1px solid rgba(255,255,255,0.15); border-left: 5px solid #f59e0b;
    border-radius: 12px; padding: 20px 22px; box-shadow: 0 16px 40px rgba(0,0,0,0.6);
    position: relative;
  }}
  .notif-header {{ display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }}
  .notif-header img {{ width: 24px; height: 24px; }}
  .notif-header span {{ font-size: 12px; color: #9ca3af; font-weight: 600; text-transform: uppercase; }}
  .notif-title {{ font-size: 15px; font-weight: 700; color: #ffffff; margin-bottom: 6px; }}
  .notif-body {{ font-size: 13px; color: #d1d5db; line-height: 1.5; }}
  .notif-actions {{ margin-top: 14px; display: flex; gap: 10px; }}
  .btn-action {{ background: #2563eb; color: #fff; padding: 6px 14px; border-radius: 6px; font-size: 12px; font-weight: 600; }}

  /* Right: One click toggle showcase */
  .control-card {{
    background: #161b22; border: 1px solid rgba(255,255,255,0.1); border-radius: 16px;
    padding: 26px; box-shadow: 0 14px 36px rgba(0,0,0,0.4);
  }}
  .card-title {{ font-size: 16px; font-weight: 700; color: #60a5fa; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }}
  .row-item {{ display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.06); font-size: 13px; }}
  .btn-toggle {{
    background: #10b981; color: #fff; border: none; padding: 6px 14px; border-radius: 999px;
    font-size: 12px; font-weight: 600; cursor: pointer; box-shadow: 0 0 12px rgba(16,185,129,0.4);
  }}
</style>
</head>
<body>
  <div class="header-bar">
    <div class="brand">
      <img src="{icon_b64}" alt="logo">
      <div class="title-area">
        <h1>卡死超時桌面通知 · 一鍵隨心啟閉 <span class="badge">Windows / Chrome 原生通知</span></h1>
        <p class="subtitle">MCP 工具執行超時或生成中途卡滯主動警報，懸浮窗與彈窗均支援一鍵靜音/開啟，點擊通知即刻喚醒分頁</p>
      </div>
    </div>
  </div>

  <div class="stage">
    <div>
      <div class="notif-card">
        <div class="notif-header">
          <img src="{icon_b64}" alt="app">
          <span>Google Chrome · 桌面系統通知</span>
        </div>
        <div class="notif-title">⚠️ Gemini MCP 助手：生成中途停滯警報</div>
        <div class="notif-body">當前分頁已超過 5 分鐘無任何文字更新或進展。可能遭遇 MCP 連線超時或伺服器卡死，請點擊返回檢查對話。</div>
        <div class="notif-actions">
          <span class="btn-action">點擊立即喚醒並置頂 Gemini 分頁</span>
        </div>
      </div>
      <p style="font-size: 12px; color: #94a3b8; margin-top: 14px; line-height: 1.6;">
        ✦ 擴充功能圖示同步呈現紅色 <b>!</b> 報警角標<br>
        ✦ 智慧過濾跳秒動畫數字與假死進度，停穩時才精確計時
      </p>
    </div>

    <div class="control-card">
      <div class="card-title">🔔 靈敏通知控制台</div>
      <div class="row-item">
        <span>桌面通知總開關</span>
        <span class="btn-toggle">一鍵開啟中 ✓</span>
      </div>
      <div class="row-item">
        <span>超時報警閾值</span>
        <span style="color: #60a5fa; font-weight: 600;">5 分鐘 (可自由調節 1~60 分鐘)</span>
      </div>
      <div class="row-item">
        <span>關閉通知即時響應</span>
        <span style="color: #34d399;">即時撤銷所有桌面懸掛通知</span>
      </div>
      <div class="row-item">
        <span>測試通知功能</span>
        <span style="background: rgba(255,255,255,0.08); padding: 4px 10px; border-radius: 6px; font-size: 11px;">支援一鍵發送測試</span>
      </div>
    </div>
  </div>
</body>
</html>
"""
render_html_to_png(html_s3, os.path.join(SCREENSHOTS_DIR, 'screenshot-3-desktop-notifications-1280x800.png'), 1280, 800)

# -------------------------------------------------------------
# SCREENSHOT 4: Extension Popup Settings Overview (1280x800)
# -------------------------------------------------------------
html_s4 = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<style>
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{
    width: 1280px; height: 800px;
    background: #0b0f19;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif;
    color: #f1f5f9;
    overflow: hidden;
    position: relative;
    padding: 30px 40px;
  }}
  .header-bar {{
    display: flex; justify-content: space-between; align-items: center;
    border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 18px; margin-bottom: 24px;
  }}
  .brand {{ display: flex; align-items: center; gap: 14px; }}
  .brand img {{ width: 44px; height: 44px; border-radius: 10px; }}
  .title-area h1 {{ font-size: 20px; font-weight: 700; color: #fff; display: flex; align-items: center; gap: 10px; }}
  .badge {{ background: rgba(59,130,246,0.2); color: #60a5fa; border: 1px solid #3b82f6; font-size: 11px; padding: 2px 8px; border-radius: 999px; }}
  .subtitle {{ font-size: 13px; color: #94a3b8; margin-top: 2px; }}

  .stage {{
    display: grid; grid-template-columns: 460px 1fr; gap: 36px; height: 660px; align-items: center;
  }}

  /* Popup UI Mockup */
  .popup-frame {{
    width: 440px; background: #161b22; border: 1px solid rgba(255,255,255,0.14);
    border-radius: 16px; padding: 20px; box-shadow: 0 20px 50px rgba(0,0,0,0.6);
  }}
  .popup-header {{ display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 12px; }}
  .stats-row {{ display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; background: rgba(255,255,255,0.03); padding: 10px; border-radius: 10px; margin: 12px 0; text-align: center; }}
  .stat-num {{ font-size: 16px; font-weight: 700; color: #38bdf8; }}
  .stat-label {{ font-size: 11px; color: #94a3b8; margin-top: 2px; }}
  
  .section-card {{ background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 12px; margin-bottom: 10px; }}
  .sec-title {{ font-size: 12px; font-weight: 600; color: #93c5fd; margin-bottom: 8px; }}
  .toggle-line {{ display: flex; justify-content: space-between; font-size: 12px; margin: 6px 0; color: #cbd5e1; }}
  .check-box {{ color: #34d399; font-weight: 700; }}

  /* Right explanation columns */
  .info-col {{ display: flex; flex-direction: column; gap: 18px; }}
  .info-box {{ background: rgba(30,41,59,0.7); border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 18px 22px; }}
  .info-box h3 {{ font-size: 15px; color: #38bdf8; margin-bottom: 8px; }}
  .info-box p {{ font-size: 13px; color: #94a3b8; line-height: 1.6; }}
</style>
</head>
<body>
  <div class="header-bar">
    <div class="brand">
      <img src="{icon_b64}" alt="logo">
      <div class="title-area">
        <h1>強大直觀的設定面板 (Extension Popup Control Panel) <span class="badge">全功能配置</span></h1>
        <p class="subtitle">即時監控今日呼叫統計、精細化自訂防刷冷卻時間與熔斷閥值，支援緊急停止與自訂匹配詞拓展</p>
      </div>
    </div>
  </div>

  <div class="stage">
    <div class="popup-frame">
      <div class="popup-header">
        <div style="font-weight: 700; font-size: 15px; color: #fff;">Gemini MCP 助手 <span style="font-size: 10px; color: #f59e0b; border: 1px solid #f59e0b; padding: 1px 6px; border-radius: 999px;">v0.1 Beta</span></div>
        <span style="color: #34d399; font-size: 12px;">● 運行中</span>
      </div>

      <div class="stats-row">
        <div><div class="stat-num">42</div><div class="stat-label">今日允許</div></div>
        <div><div class="stat-num">18 / ∞</div><div class="stat-label">今日繼續</div></div>
        <div><div class="stat-num" style="color: #34d399;">後台就緒</div><div class="stat-label">連線狀態</div></div>
      </div>

      <div class="section-card">
        <div class="sec-title">核心自動化選項</div>
        <div class="toggle-line"><span>自動點擊 MCP「始終允許」</span><span class="check-box">☑</span></div>
        <div class="toggle-line"><span style="color: #94a3b8; margin-left: 10px;">优先选择「始终允许」</span><span class="check-box">☑</span></div>
        <div class="toggle-line"><span style="color: #94a3b8; margin-left: 10px;">无始终允许时回退单次允许</span><span class="check-box">☑</span></div>
        <div class="toggle-line"><span>自動點擊「繼續」與「↪ Yes」</span><span class="check-box">☑</span></div>
        <div class="toggle-line"><span>後台靜默運行 (防 Chrome 休眠)</span><span class="check-box">☑</span></div>
      </div>

      <div class="section-card">
        <div class="sec-title">快捷防護動作</div>
        <div style="display: flex; gap: 8px; margin-top: 6px;">
          <span style="background: #ef4444; color: #fff; font-size: 11px; padding: 6px 12px; border-radius: 6px; font-weight: 600;">緊急停止</span>
          <span style="background: rgba(255,255,255,0.08); color: #e2e8f0; font-size: 11px; padding: 6px 12px; border-radius: 6px;">解除熔斷</span>
          <span style="background: rgba(255,255,255,0.08); color: #e2e8f0; font-size: 11px; padding: 6px 12px; border-radius: 6px;">清零計數</span>
        </div>
      </div>
    </div>

    <div class="info-col">
      <div class="info-box">
        <h3>🛡️ 防刷額度熔斷保護</h3>
        <p>提供單任務繼續上限（預設 10 次）、每日上限設定、停穩等待秒數調節與自適應冷卻，確保 AI 不會陷入死迴圈消耗配額。</p>
      </div>
      <div class="info-box">
        <h3>⚡ 自訂關鍵字擴充</h3>
        <p>若你的 MCP 工具彈窗包含特殊客製化提示或繁體/日語變體，可在面板中自由貼上自訂關鍵詞，即時熱更新生效。</p>
      </div>
      <div class="info-box">
        <h3>🔒 嚴格資料隱私承諾</h3>
        <p>所有設定均儲存在 Chrome 原生 <code>storage.local</code> 中，完全離線運作，無任何第三方統計與追蹤代碼。</p>
      </div>
    </div>
  </div>
</body>
</html>
"""
render_html_to_png(html_s4, os.path.join(SCREENSHOTS_DIR, 'screenshot-4-popup-settings-1280x800.png'), 1280, 800)

# -------------------------------------------------------------
# SCREENSHOT 5: 6-Layer Circuit Breaker Protection (1280x800)
# -------------------------------------------------------------
html_s5 = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<style>
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{
    width: 1280px; height: 800px;
    background: #090d16;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif;
    color: #f1f5f9;
    overflow: hidden;
    position: relative;
    padding: 30px 40px;
  }}
  .header-bar {{
    display: flex; justify-content: space-between; align-items: center;
    border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 18px; margin-bottom: 24px;
  }}
  .brand {{ display: flex; align-items: center; gap: 14px; }}
  .brand img {{ width: 44px; height: 44px; border-radius: 10px; }}
  .title-area h1 {{ font-size: 20px; font-weight: 700; color: #fff; display: flex; align-items: center; gap: 10px; }}
  .badge {{ background: rgba(239,68,68,0.2); color: #f87171; border: 1px solid #ef4444; font-size: 11px; padding: 2px 8px; border-radius: 999px; }}
  .subtitle {{ font-size: 13px; color: #94a3b8; margin-top: 2px; }}

  .layers-grid {{
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; height: 660px;
  }}
  .layer-card {{
    background: #131b2e; border: 1px solid rgba(255,255,255,0.08); border-radius: 14px;
    padding: 22px; display: flex; flex-direction: column; justify-content: space-between;
    box-shadow: 0 10px 24px rgba(0,0,0,0.4);
  }}
  .layer-tag {{
    display: inline-block; font-size: 11px; font-weight: 700; color: #38bdf8;
    background: rgba(56,189,248,0.15); padding: 3px 10px; border-radius: 6px; margin-bottom: 12px;
  }}
  .layer-title {{ font-size: 16px; font-weight: 700; color: #ffffff; margin-bottom: 8px; }}
  .layer-desc {{ font-size: 13px; color: #94a3b8; line-height: 1.6; }}
  .layer-badge {{
    margin-top: 14px; padding: 6px 12px; border-radius: 8px; font-size: 12px; font-weight: 600;
    background: rgba(16,185,129,0.15); color: #34d399; border: 1px solid rgba(16,185,129,0.3); text-align: center;
  }}
</style>
</head>
<body>
  <div class="header-bar">
    <div class="brand">
      <img src="{icon_b64}" alt="logo">
      <div class="title-area">
        <h1>6 層防刷額度熔斷機制 (6-Layer Anti-Loop Circuit Breaker) <span class="badge">工業級守護</span></h1>
        <p class="subtitle">全面杜絕無限迴圈、卡死發送、配額耗盡與重複回答，為你的 Gemini API 與帳號額度保駕護航</p>
      </div>
    </div>
  </div>

  <div class="layers-grid">
    <div class="layer-card">
      <div>
        <span class="layer-tag">Layer 1</span>
        <div class="layer-title">配額超限與錯誤熔斷</div>
        <p class="layer-desc">即時檢測畫面是否出現「達到上限」、「配額超限」、「出了點問題」等錯誤字眼，0 秒瞬時熔斷停機。</p>
      </div>
      <div class="layer-badge">✓ 即時報錯熔斷防護</div>
    </div>

    <div class="layer-card">
      <div>
        <span class="layer-tag">Layer 2</span>
        <div class="layer-title">單任務繼續次數上限</div>
        <p class="layer-desc">為單次對話任務設定點擊「繼續」的次數閥值（預設 10 次），防止 AI 在單次提問中無休止點擊。</p>
      </div>
      <div class="layer-badge">✓ 單次會話配額鎖定</div>
    </div>

    <div class="layer-card">
      <div>
        <span class="layer-tag">Layer 3</span>
        <div class="layer-title">停穩等待與動態冷卻</div>
        <p class="layer-desc">必須等待 Gemini 輸出串流徹底停穩（預設 1.8 秒）且經過點擊冷卻（4 秒），絕不在打字中途搶點。</p>
      </div>
      <div class="layer-badge">✓ 串流輸出停穩守衛</div>
    </div>

    <div class="layer-card">
      <div>
        <span class="layer-tag">Layer 4</span>
        <div class="layer-title">每日總繼續配額上限</div>
        <p class="layer-desc">支援設定每天自動點擊繼續的上限次數（預設 0 為無上限），達到上限後自動暫停，次日自動重設。</p>
      </div>
      <div class="layer-badge">✓ 跨天循環安全審核</div>
    </div>

    <div class="layer-card">
      <div>
        <span class="layer-tag">Layer 5</span>
        <div class="layer-title">完工訊號智慧跳過</div>
        <p class="layer-desc">識別文字末尾「已全部完成」、「所有任務完成」等結語，若無明確截斷提示則自動跳過點擊繼續。</p>
      </div>
      <div class="layer-badge">✓ 完工語義識別機制</div>
    </div>

    <div class="layer-card">
      <div>
        <span class="layer-tag">Layer 6</span>
        <div class="layer-title">停滯與重複輸出熔斷</div>
        <p class="layer-desc">智慧 Hash 比較前後兩次回答文本，若內容 100% 重複或 DOM 長時間無新進展，自動觸發熔斷。</p>
      </div>
      <div class="layer-badge">✓ 停滯死循環自動阻斷</div>
    </div>
  </div>
</body>
</html>
"""
render_html_to_png(html_s5, os.path.join(SCREENSHOTS_DIR, 'screenshot-5-circuit-breaker-protection-1280x800.png'), 1280, 800)

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
    background: radial-gradient(circle at 20% 20%, #1e1b4b 0%, #0d1117 65%, #05070c 100%);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif;
    color: #f3f4f6;
    overflow: hidden;
    position: relative;
    padding: 24px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }}
  .top-row {{ display: flex; align-items: center; gap: 12px; }}
  .top-row img {{ width: 48px; height: 48px; border-radius: 10px; box-shadow: 0 4px 14px rgba(59,130,246,0.4); }}
  .title-area h1 {{ font-size: 16px; font-weight: 700; color: #fff; line-height: 1.2; }}
  .title-area p {{ font-size: 11px; color: #38bdf8; margin-top: 3px; font-weight: 600; }}
  .badge-row {{ display: flex; gap: 6px; margin: 10px 0; }}
  .pill {{ background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); font-size: 10px; padding: 3px 8px; border-radius: 999px; color: #cbd5e1; }}
  .footer-row {{ display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 10px; font-size: 10px; color: #94a3b8; }}
</style>
</head>
<body>
  <div class="top-row">
    <img src="{icon_b64}" alt="logo">
    <div class="title-area">
      <h1>Gemini MCP Auto Helper</h1>
      <p>自动放行 · 自由拖拽 · 防刷熔断</p>
    </div>
  </div>

  <div>
    <div class="badge-row">
      <span class="pill">⚡ 始终允许自动点击</span>
      <span class="pill">🖱️ 全域自由拖拽</span>
    </div>
    <div class="badge-row">
      <span class="pill">🔔 超时桌面通知</span>
      <span class="pill">🛡️ 6层防刷额度熔断</span>
    </div>
  </div>

  <div class="footer-row">
    <span>Google Gemini 生产力助手</span>
    <span style="color: #f59e0b; font-weight: 600;">v0.1 Beta</span>
  </div>
</body>
</html>
"""
render_html_to_png(html_p_small, os.path.join(PROMO_DIR, 'small-promo-tile-440x280.png'), 440, 280)

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
    background: radial-gradient(circle at 15% 25%, #1e1b4b 0%, #0d1117 50%, #05070c 100%);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif;
    color: #f3f4f6;
    overflow: hidden;
    position: relative;
    padding: 50px 70px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }}
  .left-col {{ max-width: 680px; }}
  .brand-row {{ display: flex; align-items: center; gap: 16px; margin-bottom: 20px; }}
  .brand-row img {{ width: 64px; height: 64px; border-radius: 14px; box-shadow: 0 8px 24px rgba(59,130,246,0.4); }}
  .hero-title {{ font-size: 34px; font-weight: 800; color: #ffffff; line-height: 1.2; letter-spacing: -0.5px; }}
  .hero-sub {{ font-size: 16px; color: #94a3b8; margin: 16px 0 24px; line-height: 1.6; }}
  .pills-row {{ display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 26px; }}
  .pill {{ background: rgba(59,130,246,0.15); border: 1px solid rgba(59,130,246,0.3); color: #93c5fd; font-size: 12px; font-weight: 600; padding: 6px 14px; border-radius: 999px; }}

  /* Right column: floating mockup illustration */
  .mockup-card {{
    width: 480px; background: rgba(22, 27, 34, 0.95); border: 2px solid rgba(59,130,246,0.3);
    border-radius: 20px; padding: 24px; box-shadow: 0 24px 60px rgba(0,0,0,0.6);
  }}
  .mock-header {{ display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 14px; margin-bottom: 16px; }}
  .mock-row {{ display: flex; justify-content: space-between; align-items: center; margin: 10px 0; font-size: 13px; color: #cbd5e1; }}
  .mock-pill {{ background: rgba(16,185,129,0.25); color: #34d399; padding: 3px 12px; border-radius: 999px; font-size: 11px; font-weight: 700; }}
</style>
</head>
<body>
  <div class="left-col">
    <div class="brand-row">
      <img src="{icon_b64}" alt="logo">
      <div>
        <div style="font-size: 13px; font-weight: 700; color: #38bdf8; text-transform: uppercase; letter-spacing: 1px;">Google Gemini MCP Automation</div>
        <div style="font-size: 12px; color: #f59e0b; font-weight: 600;">v0.1 Beta Release</div>
      </div>
    </div>
    <h1 class="hero-title">KenEasy Gemini MCP Auto Helper</h1>
    <p class="hero-sub">專為 Google Gemini 網頁端打造的自動授權與連續對話助手：自動點擊 MCP 工具權限、全螢幕任意拖拽懸浮窗、卡滯桌面通知，內建 6 層防刷額度熔斷保護。</p>
    <div class="pills-row">
      <span class="pill">⚡ 始終允許自動點擊</span>
      <span class="pill">🖱️ 全域自由拖拽</span>
      <span class="pill">🔔 超時桌面系統通知</span>
      <span class="pill">🛡️ 6層防刷額度熔斷</span>
      <span class="pill">🔒 100% 純本機運作</span>
    </div>
  </div>

  <div class="mockup-card">
    <div class="mock-header">
      <div style="display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 14px;">
        <span style="width: 10px; height: 10px; border-radius: 50%; background: #10b981;"></span> 網頁懸浮控制窗
      </div>
      <span style="font-size: 11px; color: #94a3b8;">可隨意拖動位置</span>
    </div>
    <div class="mock-row"><span>MCP 權限自動放行</span><span class="mock-pill">優先始終允許</span></div>
    <div class="mock-row"><span>自動點擊「繼續」</span><span class="mock-pill">智慧追問晶片</span></div>
    <div class="mock-row"><span>後台靜默運行</span><span class="mock-pill">防分頁休眠</span></div>
    <div class="mock-row"><span>超時桌面通知</span><span class="mock-pill">一鍵隨時啟閉</span></div>
    <div style="margin-top: 18px; padding: 12px; background: rgba(0,0,0,0.3); border-radius: 10px; font-size: 12px; color: #94a3b8; line-height: 1.5;">
      今日允許: <b style="color: #fff;">42 次</b> | 今日繼續: <b style="color: #fff;">18 / ∞</b><br>
      狀態: <span style="color: #34d399; font-weight: 600;">後台就緒 · 監控中</span>
    </div>
  </div>
</body>
</html>
"""
render_html_to_png(html_p_marquee, os.path.join(PROMO_DIR, 'marquee-promo-tile-1400x560.png'), 1400, 560)

print("All screenshots and promo tiles generated successfully!")
