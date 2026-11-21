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

def render_html_to_png(html_content, output_png_path, width=1200, height=700, dpr=1):
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
    background: #090c15;
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
    margin-bottom: 14px;
  }}
  .feature-badge-row {{
    display: flex;
    align-items: center;
    gap: 12px;
  }}
  .main-tag {{
    background: linear-gradient(135deg, rgba(66, 133, 244, 0.2) 0%, rgba(168, 85, 247, 0.2) 100%);
    border: 1px solid rgba(66, 133, 244, 0.4);
    color: #8ab4f8;
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

  /* Main Stage Layout */
  .stage-layout {{
    display: grid;
    grid-template-columns: 410px 1fr;
    grid-gap: 28px;
    flex: 1;
    align-items: start;
  }}

  /* The Realistic Extension Popup UI */
  .popup-frame {{
    width: 380px;
    background: #14161a;
    border: 1px solid rgba(255, 255, 255, 0.16);
    border-radius: 14px;
    box-shadow: 0 16px 45px rgba(0, 0, 0, 0.7), 0 0 25px rgba(66, 133, 244, 0.15);
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 9px;
    font-size: 11px;
    position: relative;
  }}

  /* Popup Header */
  .p-header {{
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 4px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }}
  .p-brand {{
    display: flex;
    align-items: center;
    gap: 8px;
  }}
  .p-logo {{
    width: 26px;
    height: 26px;
    border-radius: 6px;
  }}
  .p-title {{
    font-size: 13px;
    font-weight: 700;
    color: #f8fafc;
    display: flex;
    align-items: center;
    gap: 6px;
  }}
  .p-beta {{
    font-size: 9px;
    color: #fbbf24;
    background: rgba(245, 158, 11, 0.2);
    border: 1px solid rgba(245, 158, 11, 0.4);
    padding: 1px 5px;
    border-radius: 999px;
  }}
  .p-sub {{
    font-size: 10px;
    color: #9aa0a6;
  }}
  .p-switch {{
    width: 34px;
    height: 18px;
    background: #34a853;
    border-radius: 999px;
    position: relative;
  }}
  .p-slider {{
    width: 14px;
    height: 14px;
    background: white;
    border-radius: 50%;
    position: absolute;
    right: 2px;
    top: 2px;
  }}

  /* Stats Bar */
  .p-stats {{
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    padding: 6px 4px;
    text-align: center;
  }}
  .p-stat-val {{
    font-size: 12px;
    font-weight: 700;
    color: #f8fafc;
  }}
  .p-stat-lbl {{
    font-size: 9.5px;
    color: #9aa0a6;
  }}

  /* Section Card in popup */
  .p-card {{
    background: rgba(255, 255, 255, 0.025);
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 8px;
    padding: 8px 10px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }}
  .p-card-title {{
    font-size: 11px;
    font-weight: 700;
    color: #cbd5e1;
    display: flex;
    align-items: center;
    gap: 5px;
  }}
  .p-row {{
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 10.5px;
    color: #e2e8f0;
  }}
  .p-row.sub {{
    padding-left: 10px;
    color: #94a3b8;
  }}
  .p-chk {{
    accent-color: #34a853;
    width: 13px;
    height: 13px;
  }}
  .p-grid-2 {{
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-gap: 6px;
  }}
  .p-field {{
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 9.5px;
    color: #94a3b8;
  }}
  .p-input {{
    background: #202124;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 4px;
    color: white;
    font-size: 10px;
    padding: 2px 5px;
  }}
  .p-btns {{
    display: flex;
    gap: 5px;
  }}
  .p-btn {{
    flex: 1;
    padding: 4px;
    border-radius: 5px;
    font-size: 10px;
    font-weight: 600;
    text-align: center;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.05);
    color: #cbd5e1;
  }}
  .p-btn-pri {{ background: #1a73e8; color: white; border: none; }}
  .p-btn-dan {{ background: rgba(234, 67, 53, 0.18); color: #f28b82; border-color: rgba(234, 67, 53, 0.4); }}

  /* Callout Guides Column */
  .guides-col {{
    display: flex;
    flex-direction: column;
    gap: 12px;
  }}
  .guide-card {{
    background: rgba(17, 24, 39, 0.65);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    padding: 12px 14px;
    display: flex;
    gap: 12px;
  }}
  .guide-num {{
    width: 26px;
    height: 26px;
    border-radius: 50%;
    background: rgba(59, 130, 246, 0.15);
    border: 1px solid rgba(59, 130, 246, 0.4);
    color: #60a5fa;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 13px;
    flex-shrink: 0;
  }}
  .guide-body {{
    display: flex;
    flex-direction: column;
    gap: 3px;
  }}
  .guide-title {{
    font-size: 13px;
    font-weight: 700;
    color: #f3f4f6;
  }}
  .guide-desc {{
    font-size: 11.5px;
    color: #94a3b8;
    line-height: 1.45;
  }}
</style>
</head>
<body>
  <div class="top-header">
    <div class="feature-badge-row">
      <div class="main-tag"><span>⚙️</span> 完整面板速览</div>
      <h2 class="top-title">KenEasy Gemini MCP Auto Helper 设置面板全景图</h2>
    </div>
    <div class="top-desc">详尽配置项分类解析 · 精准掌控自动化行为与安全保护</div>
  </div>

  <div class="stage-layout">
    <!-- Extension Popup UI -->
    <div class="popup-frame">
      <div class="p-header">
        <div class="p-brand">
          <img src="{icon_b64}" class="p-logo">
          <div>
            <div class="p-title">Gemini MCP 助手 <span class="p-beta">v0.1 Beta</span></div>
            <div class="p-sub">自动允许 · 后台保活 · 防刷额度熔断</div>
          </div>
        </div>
        <div class="p-switch"><div class="p-slider"></div></div>
      </div>

      <div class="p-stats">
        <div><div class="p-stat-val">38</div><div class="p-stat-lbl">今日允许</div></div>
        <div><div class="p-stat-val">12 / ∞</div><div class="p-stat-lbl">今日继续</div></div>
        <div><div class="p-stat-val" style="color: #81c995;">● 监控中</div><div class="p-stat-lbl">当前状态</div></div>
      </div>

      <div class="p-card">
        <div class="p-card-title"><span>⚡</span> 核心自动化</div>
        <div class="p-row"><span>自动点击 MCP「始终允许」</span><input type="checkbox" class="p-chk" checked></div>
        <div class="p-row sub"><span>优先选择「始终允许」（推荐）</span><input type="checkbox" class="p-chk" checked></div>
        <div class="p-row sub"><span>无始终允许时回退点「允许一次」</span><input type="checkbox" class="p-chk" checked></div>
        <div class="p-row"><span>自动点击下方「继续」按钮</span><input type="checkbox" class="p-chk" checked></div>
        <div class="p-row"><span>后台静默运行（切屏/最小化不中断）</span><input type="checkbox" class="p-chk" checked></div>
        <div class="p-row sub"><span>防止 Chrome 休眠丢弃 Gemini 标签页</span><input type="checkbox" class="p-chk" checked></div>
        <div class="p-row"><span>在 Gemini 页面显示右下角悬浮窗</span><input type="checkbox" class="p-chk" checked></div>
      </div>

      <div class="p-card">
        <div class="p-card-title"><span>🛡️</span> 防刷额度熔断保护</div>
        <div class="p-grid-2">
          <div class="p-field"><span>单次任务继续上限</span><input class="p-input" value="10"></div>
          <div class="p-field"><span>每日继续总上限 (0=无上限)</span><input class="p-input" value="0"></div>
          <div class="p-field"><span>继续冷却 (秒)</span><input class="p-input" value="3.0"></div>
          <div class="p-field"><span>输出停稳等待 (秒)</span><input class="p-input" value="1.8"></div>
        </div>
        <div class="p-row"><span>检测到完工信号时跳过继续</span><input type="checkbox" class="p-chk" checked></div>
        <div class="p-row"><span>输出无新进展 / 重复时自动熔断</span><input type="checkbox" class="p-chk" checked></div>
        <div class="p-row"><span>连接 / 卡死超时发送电脑桌面通知</span><input type="checkbox" class="p-chk" checked></div>
      </div>

      <div class="p-btns">
        <div class="p-btn p-btn-dan">紧急停止</div>
        <div class="p-btn">解除熔断</div>
        <div class="p-btn">清零计数</div>
        <div class="p-btn p-btn-pri">保存设置</div>
      </div>
    </div>

    <!-- Guides Column -->
    <div class="guides-col">
      <div class="guide-card">
        <div class="guide-num">1</div>
        <div class="guide-body">
          <div class="guide-title">核心 MCP 穿透与继续控制</div>
          <div class="guide-desc">自由勾选「始终允许优先」与「单次允许回退」，智能穿透 Material 菜单与 Shadow DOM 按钮；支持自动点击 <code>↪ Yes</code> 追问芯片。</div>
        </div>
      </div>

      <div class="guide-card">
        <div class="guide-num">2</div>
        <div class="guide-body">
          <div class="guide-title">后台常驻保活与防休眠 (Keep-Alive)</div>
          <div class="guide-desc">开启「后台静默运行」与「防止 Chrome 休眠丢弃」，即使最小化窗口或锁屏切屏，后台 Service Worker 心跳长连接维持任务持续执行。</div>
        </div>
      </div>

      <div class="guide-card">
        <div class="guide-num">3</div>
        <div class="guide-body">
          <div class="guide-title">6 层防刷额度安全熔断 (Circuit Breakers)</div>
          <div class="guide-desc">严格限制单次任务上限（默认 10 次）与每日总上限（默认 0=无上限），配合 1.8 秒输出停稳等待与完工信号识别，杜绝无限死循环消耗 Token。</div>
        </div>
      </div>

      <div class="guide-card">
        <div class="guide-num">4</div>
        <div class="guide-body">
          <div class="guide-title">一键桌面超时通知 (Anti-Stall Alert)</div>
          <div class="guide-desc">连接或生成超时超过阈值（默认 5 分钟）无新输出时主动桌面报警，内置「测试通知」按钮便于随时验证系统通知音效与显示权限。</div>
        </div>
      </div>

      <div class="guide-card">
        <div class="guide-num">5</div>
        <div class="guide-body">
          <div class="guide-title">快捷应急防护 (Emergency & Reset)</div>
          <div class="guide-desc">点击「紧急停止」即可全局封锁所有自动点击行为；点击「解除熔断」一键复位被触发的安全断路器，恢复正常自动化监控。</div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
"""
    output_png = os.path.join(ASSETS_DIR, 'popup-demo.png')
    render_html_to_png(html, output_png, width=1200, height=700)

if __name__ == '__main__':
    render_popup_demo()
