#!/usr/bin/env python3
"""从单一数据源 recipes.json 生成前端可用的 js/data.js（window.KB）。
保持 DRY：前端与后端共用 recipes.json。"""
import json

with open("recipes.json", "r", encoding="utf-8") as f:
    kb = json.load(f)

out = "// 本文件由 build_data.py 自动生成，请勿手改。数据源：recipes.json\n"
out += "window.KB = " + json.dumps(kb, ensure_ascii=False, indent=2) + ";\n"

with open("js/data.js", "w", encoding="utf-8") as f:
    f.write(out)

print("js/data.js 已生成，recipes:", len(kb["recipes"]))
