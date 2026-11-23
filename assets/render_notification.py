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
    background: #070b14;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif;
    color: #f8fafc;
    overflow: hidden;
    position: relative;
    padding: 28px 40px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 18px;
  }}

  .aura-1 {{
    position: absolute; width: 600px; height: 600px; border-radius: 50%;
    background: radial-gradient(circle, rgba(245, 158, 11, 0.14) 0%, transparent 68%);
    top: -160px; right: -100px; pointer-events: none;
  }}
  .aura-2 {{
    position: absolute; width: 540px; height: 540px; border-radius: 50%;
    background: radial-gradient(circle, rgba(16, 185, 129, 0.12) 0%, transparent 68%);
    bottom: -180px; left: -100px; pointer-events: none;
  }}

  /* Header */
  .top-header {{
    position: relative; z-index: 2;
    display: flex; align-items: center; justify-content: space-between;
  }}
  .brand-row {{ display: flex; align-items: center; gap: 14px; }}
  .brand-row img {{ width: 42px; height: 42px; border-radius: 11px; box-shadow: 0 6px 18px rgba(59, 130, 246, 0.3); }}
  .top-title {{ font-size: 22px; font-weight: 800; color: #fff; display: flex; align-items: center; gap: 10px; }}
  .tag-pill {{
    font-size: 11.5px; font-weight: 700; padding: 3px 10px; border-radius: 999px;
    background: rgba(16, 185, 129, 0.16); border: 1px solid rgba(16, 185, 129, 0.45); color: #6ee7b7;
  }}
  .top-sub {{ font-size: 13px; color: #94a3b8; margin-top: 2px; }}
  .lang-chip {{
    font-size: 12px; font-weight: 600; color: #cbd5e1;
    padding: 6px 14px; border-radius: 999px;
    background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.12);
  }}

  /* Center Flow Grid */
  .flow-grid {{
    position: relative; z-index: 2;
    flex: 1;
    display: grid;
    grid-template-columns: 1fr 56px 1fr;
    align-items: center;
    gap: 12px;
  }}

  .col-panel {{
    height: 100%;
    background: rgba(15, 23, 42, 0.62);
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 20px 50px rgba(0, 0, 0, 0.45);
    border-radius: 18px;
    padding: 22px 24px;
    display: flex; flex-direction: column; justify-content: space-between; gap: 16px;
  }}

  .panel-title {{
    font-size: 14px; font-weight: 700; color: #93c5fd;
    display: flex; align-items: center; justify-content: space-between;
  }}
  .panel-sub {{ font-size: 11.5px; color: #64748b; font-weight: 500; }}

  /* Left: Controls Cards */
  .sub-card {{
    background: #131823;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 14px;
    padding: 15px 18px;
    display: flex; flex-direction: column; gap: 12px;
  }}
  .sub-head {{
    display: flex; justify-content: space-between; align-items: center;
    font-size: 12.5px; font-weight: 700; color: #e2e8f0;
  }}
  .pill-row {{
    display: flex; justify-content: space-between; align-items: center;
    padding: 8px 12px; border-radius: 10px;
    background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.06);
  }}
  .p-label {{ font-size: 12px; color: #cbd5e1; }}
  .pill-on {{
    padding: 4px 12px; border-radius: 999px; font-size: 11.5px; font-weight: 700;
    background: rgba(52, 168, 83, 0.2); border: 1px solid rgba(52, 168, 83, 0.55); color: #86efac;
  }}
  .pill-off {{
    padding: 4px 12px; border-radius: 999px; font-size: 11.5px; font-weight: 600;
    background: rgba(148, 163, 184, 0.12); border: 1px solid rgba(148, 163, 184, 0.3); color: #94a3b8;
  }}

  .switch {{ width: 38px; height: 20px; border-radius: 999px; background: #34a853; position: relative; }}
  .switch::after {{ content: ""; position: absolute; width: 14px; height: 14px; border-radius: 50%; background: #fff; right: 3px; top: 3px; }}
  .thresh-box {{
    display: flex; align-items: center; justify-content: space-between; gap: 10px;
    background: rgba(255, 255, 255, 0.03); padding: 9px 12px; border-radius: 10px;
  }}
  .num-chip {{
    background: #0b0e15; border: 1px solid rgba(255, 255, 255, 0.16);
    padding: 4px 12px; border-radius: 7px; font-weight: 700; color: #fff; font-size: 12px;
  }}
  .test-btn {{
    background: rgba(59, 130, 246, 0.18); border: 1px solid rgba(96, 165, 250, 0.45);
    color: #93c5fd; padding: 5px 12px; border-radius: 8px; font-size: 11.5px; font-weight: 600;
  }}

  /* Connector Arrow */
  .connector {{
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px;
  }}
  .arrow-circle {{
    width: 44px; height: 44px; border-radius: 50%;
    background: linear-gradient(135deg, rgba(59, 130, 246, 0.25), rgba(16, 185, 129, 0.25));
    border: 1px solid rgba(96, 165, 250, 0.45);
    display: flex; align-items: center; justify-content: center;
    font-size: 18px; color: #93c5fd;
    box-shadow: 0 0 24px rgba(59, 130, 246, 0.25);
  }}

  /* Right: System Notification + Badge */
  .os-toast {{
    background: #1b202b;
    border: 1px solid rgba(255, 255, 255, 0.16);
    border-left: 4px solid #f59e0b;
    border-radius: 14px;
    padding: 18px 20px;
    box-shadow: 0 20px 48px rgba(0, 0, 0, 0.55);
    display: flex; flex-direction: column; gap: 12px;
  }}
  .toast-bar {{
    display: flex; justify-content: space-between; align-items: center;
    font-size: 11.5px; color: #94a3b8;
  }}
  .toast-main {{ display: flex; gap: 14px; align-items: flex-start; }}
  .toast-ico {{
    width: 44px; height: 44px; border-radius: 11px; flex-shrink: 0;
    background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.45);
    display: flex; align-items: center; justify-content: center; font-size: 20px;
  }}
  .toast-t {{ font-size: 14.5px; font-weight: 700; color: #fff; margin-bottom: 4px; }}
  .toast-m {{ font-size: 12.5px; color: #cbd5e1; line-height: 1.5; }}
  .toast-cta {{
    margin-top: 4px; display: inline-flex; align-items: center; gap: 6px;
    font-size: 11.5px; font-weight: 600; color: #60a5fa;
  }}

  .browser-tab-card {{
    background: #131823;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 14px;
    padding: 15px 18px;
    display: flex; flex-direction: column; gap: 10px;
  }}
  .tab-strip {{
    background: #0b0e15;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    padding: 10px 14px;
    display: flex; align-items: center; justify-content: space-between;
  }}
  .tab-pill {{
    display: flex; align-items: center; gap: 8px;
    background: #1e2533; padding: 6px 14px; border-radius: 8px;
    font-size: 12px; color: #f1f5f9; border: 1px solid rgba(255, 255, 255, 0.08);
  }}
  .ext-wrap {{ position: relative; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; }}
  .ext-wrap img {{ width: 24px; height: 24px; border-radius: 6px; }}
  .badge-alert {{
    position: absolute; top: -3px; right: -3px;
    width: 15px; height: 15px; border-radius: 50%;
    background: #ea4335; color: #fff; font-size: 10px; font-weight: 800;
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 0 8px #ea4335;
  }}

  /* Bottom 3-Card Matrix */
  .bottom-row {{
    position: relative; z-index: 2;
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px;
  }}
  .b-card {{
    background: rgba(15, 23, 42, 0.72);
    border: 1px solid rgba(255, 255, 255, 0.09);
    border-radius: 12px;
    padding: 12px 16px;
    display: flex; align-items: flex-start; gap: 11px;
  }}
  .b-ico {{ font-size: 18px; line-height: 1.2; }}
  .b-title {{ font-size: 13px; font-weight: 700; color: #f1f5f9; margin-bottom: 2px; }}
  .b-desc {{ font-size: 11.5px; color: #94a3b8; line-height: 1.4; }}
</style>
</head>
<body>
  <div class="aura-1"></div>
  <div class="aura-2"></div>

  <div class="top-header">
    <div class="brand-row">
      <img src="{icon_b64}" alt="logo">
      <div>
        <div class="top-title">
          <span>一键启停桌面通知 · 卡死超时主动预警</span>
          <span class="tag-pill">v1.0.0 · 多语言本地通知</span>
        </div>
        <div class="top-sub">HUD 悬浮窗与 Popup 双向秒切静音 · 超时无进展系统弹窗提醒 · 点击直达并唤醒对应窗口标签页</div>
      </div>
    </div>
    <div class="lang-chip">🌐 支持 简 / 繁 / EN / 日 通知文案</div>
  </div>

  <div class="flow-grid">
    <!-- Left Column: Dual Controls -->
    <div class="col-panel">
      <div class="panel-title">
        <span>⚙️ 1. 双向即时控制开关</span>
        <span class="panel-sub">HUD / Popup 实时同步</span>
      </div>

      <div class="sub-card">
        <div class="sub-head">
          <span>网页悬浮窗 (HUD) 第 5 行一键切换</span>
          <span style="font-size: 11px; color: #34d399;">零跳转瞬切</span>
        </div>
        <div class="pill-row">
          <span class="p-label">🔔 桌面通知 · 运行中</span>
          <span class="pill-on">已开启</span>
        </div>
        <div class="pill-row">
          <span class="p-label">🔕 桌面通知 · 静音模式</span>
          <span class="pill-off">已关闭</span>
        </div>
      </div>

      <div class="sub-card">
        <div class="sub-head">
          <span>扩展设置面板 (Popup) 精细配置</span>
          <div class="switch"></div>
        </div>
        <div class="thresh-box">
          <div style="display:flex; align-items:center; gap:8px; font-size:12px; color:#cbd5e1;">
            <span>超时提醒阈值:</span>
            <span class="num-chip">5 分钟</span>
          </div>
          <span class="test-btn">🔔 测试通知</span>
        </div>
      </div>
    </div>

    <!-- Middle Arrow -->
    <div class="connector">
      <div class="arrow-circle">➔</div>
    </div>

    <!-- Right Column: Native OS Toast + Badge -->
    <div class="col-panel">
      <div class="panel-title">
        <span>🖥️ 2. 原生桌面报警与标签唤醒</span>
        <span class="panel-sub">智能过滤跳秒动画</span>
      </div>

      <div class="os-toast">
        <div class="toast-bar">
          <span style="display:flex; align-items:center; gap:7px;">
            <span style="width:10px;height:10px;border-radius:50%;background:#4285f4;display:inline-block;"></span>
            Google Chrome · 刚刚
          </span>
          <span>✕</span>
        </div>
        <div class="toast-main">
          <div class="toast-ico">⚠️</div>
          <div>
            <div class="toast-t">Gemini 连接已超过 5 分钟</div>
            <div class="toast-m">检测到该对话连续连接或等待超过 5 分钟仍无新进展，点击此处立即切回对应标签页检查。</div>
            <div class="toast-cta">👉 点击自动还原最小化窗口并聚焦 Gemini 标签页</div>
          </div>
        </div>
      </div>

      <div class="browser-tab-card">
        <div class="sub-head">
          <span>工具栏扩展图标红点角标联动</span>
          <span style="font-size: 11px; color: #fbbf24;">超限预警中</span>
        </div>
        <div class="tab-strip">
          <div class="tab-pill"><span>✦</span><span>Gemini - MCP 工程自动化会话</span></div>
          <div class="ext-wrap">
            <img src="{icon_b64}" alt="ext">
            <span class="badge-alert">!</span>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="bottom-row">
    <div class="b-card">
      <span class="b-ico">⚡</span>
      <div>
        <div class="b-title">双向秒级同步</div>
        <div class="b-desc">HUD 药丸与 Popup 开关共享本地状态，关闭时即时撤回所有挂起通知。</div>
      </div>
    </div>
    <div class="b-card">
      <span class="b-ico">🧮</span>
      <div>
        <div class="b-title">指纹防误报过滤</div>
        <div class="b-desc">自动忽略读秒倒计时和省略号动画，仅在输出真实停滞时精准计时。</div>
      </div>
    </div>
    <div class="b-card">
      <span class="b-ico">🔄</span>
      <div>
        <div class="b-title">恢复生成自动消警</div>
        <div class="b-desc">工具返回数据或恢复文字输出后，自动清除桌面通知并摘除红色角标。</div>
      </div>
    </div>
  </div>
</body>
</html>
"""
    output_png = os.path.join(ASSETS_DIR, 'notification-toggle-demo.png')
    render_html_to_png(html, output_png, width=1280, height=720, dpr=2)


if __name__ == '__main__':
    render_notification_demo()
