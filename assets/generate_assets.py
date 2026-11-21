"""
Assets Generator for KenEasy Gemini MCP Auto Helper
Generates all promotional graphics and documentation visual assets.
Run: python assets/generate_assets.py
"""
import os
import sys

from render_hero import build_hero_banner
from render_hud_drag import render_hud_drag_demo
from render_notification import render_notification_demo
from render_popup_demo import render_popup_demo

def main():
    print("Generating assets for KenEasy Gemini MCP Auto Helper...")
    build_hero_banner()
    render_hud_drag_demo()
    render_notification_demo()
    render_popup_demo()
    print("All assets generated successfully!")

if __name__ == '__main__':
    main()
