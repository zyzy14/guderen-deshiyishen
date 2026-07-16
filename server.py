#!/usr/bin/env python3
"""
古人的深夜食堂 · 后端服务（Flask）
─────────────────────────────
功能：
  ① 托管前端静态资源（index.html / css / js / recipes.json）
  ② 暴露 POST /api/cook：食材匹配 + 半文白食谱生成
     · 无需任何外部 API 即可运行（本地知识库 + 模板生成，离线兜底）
     · 配置 LLM_PROVIDER + LLM_API_KEY 后，自动调用大模型润色文风
  ③ GET /api/status：返回当前模式（离线 / 大模型）与所用服务商

大模型接入（OpenAI 兼容接口，以下任选其一）：
  A. 服务商预设（最简）：
       LLM_PROVIDER=dashscope   LLM_API_KEY=sk-xxx        # 通义千问，默认 qwen-plus
       LLM_PROVIDER=deepseek    LLM_API_KEY=sk-xxx        # DeepSeek，默认 deepseek-chat
       LLM_PROVIDER=openai      LLM_API_KEY=sk-xxx        # OpenAI，默认 gpt-4o-mini
       LLM_PROVIDER=ollama      LLM_API_KEY=（可空）       # 本地，默认 qwen2.5:latest
  B. 自定义 OpenAI 兼容端点：
       OPENAI_BASE_URL=https://你的端点/v1   LLM_API_KEY=xxx   LLM_MODEL=模型名
  可选覆盖：LLM_MODEL=xxx 可改默认模型。

启动：
  python3 server.py                 # 默认 :5000
  FLASK_PORT=8080 python3 server.py
"""

import json
import os
import re
from pathlib import Path

from flask import Flask, request, jsonify, send_from_directory

BASE = Path(__file__).resolve().parent
app = Flask(__name__, static_folder=str(BASE), static_url_path="")


# ── 读取 .env（不依赖第三方库）──────────────────────────────
def load_dotenv():
    p = BASE / ".env"
    if not p.exists():
        return
    for line in p.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        v = v.strip().strip('"').strip("'")
        os.environ.setdefault(k.strip(), v)


load_dotenv()

# ── 加载单一数据源 ────────────────────────────────────────────
with open(BASE / "recipes.json", "r", encoding="utf-8") as f:
    KB = json.load(f)

SYN = KB["synonyms"]
ANA = KB["anachronism"]
RECIPES = KB["recipes"]

CLOSINGS = [
    "一箸入口，万虑俱息。深夜食堂，不过如此。",
    "灶上烟火，釜中春秋。愿君食之，好梦如旧。",
    "古人诚不欺我：治庖如治心，火候到了，滋味自来。",
    "家常一味，最养凡人。纵无珍馐，亦可慰风尘。",
    "箪食瓢饮，回也不改其乐。君今有此，胜却膏粱。",
]

# ── 大模型配置解析 ───────────────────────────────────────────
PROVIDERS = {
    "dashscope": ("https://dashscope.aliyuncs.com/compatible-mode/v1", "qwen-plus"),
    "deepseek": ("https://api.deepseek.com/v1", "deepseek-chat"),
    "openai": ("https://api.openai.com/v1", "gpt-4o-mini"),
    "ollama": ("http://localhost:11434/v1", "qwen2.5:latest"),
}

PROVIDER = os.environ.get("LLM_PROVIDER", "").strip().lower()
if PROVIDER in PROVIDERS:
    LLM_BASE_URL, LLM_MODEL = PROVIDERS[PROVIDER]
    if os.environ.get("LLM_BASE_URL"):
        LLM_BASE_URL = os.environ["LLM_BASE_URL"].rstrip("/")
    if os.environ.get("LLM_MODEL"):
        LLM_MODEL = os.environ["LLM_MODEL"]
    LLM_API_KEY = os.environ.get("LLM_API_KEY") or os.environ.get("OPENAI_API_KEY", "")
else:
    LLM_BASE_URL = (os.environ.get("OPENAI_BASE_URL") or "https://api.openai.com/v1").rstrip("/")
    LLM_MODEL = os.environ.get("LLM_MODEL", "gpt-4o-mini")
    LLM_API_KEY = os.environ.get("OPENAI_API_KEY") or os.environ.get("LLM_API_KEY", "")

LLM_ENABLED = bool(LLM_API_KEY)
IMAGE_GEN_KEY = os.environ.get("IMAGE_GEN_API_KEY") or LLM_API_KEY
IMAGE_GEN_MODEL = os.environ.get("IMAGE_GEN_MODEL", "dall-e-3")


# ── 同义词归一（与前端逻辑对齐）───────────────────────────────
def parse(text):
    return [t.strip() for t in re.split(r"[，,、\s]+", text or "") if t.strip()]


def normalize(tokens):
    raw_list, norm_set, norm_to_raw = [], set(), {}
    for t in tokens:
        k = re.sub(r"[。．.；;]", "", t)
        if not k:
            continue
        norm = SYN.get(k) or SYN.get(re.sub(r"[老嫩鲜活小大]", "", k)) or k
        raw_list.append(k)
        norm_set.add(norm)
        norm_to_raw.setdefault(norm, []).append(k)
    return raw_list, norm_set, norm_to_raw


# ── 食谱匹配打分 ──────────────────────────────────────────────
def score_recipe(recipe, norm_set):
    core_hits = sum(1 for c in recipe.get("core", []) if c in norm_set)
    ing_hits = sum(1 for i in recipe["ingredients"] if i in norm_set)
    return {"score": core_hits * 5 + ing_hits, "core_hits": core_hits, "ing_hits": ing_hits}


def do_match(tokens):
    raw_list, norm_set, norm_to_raw = normalize(tokens)

    scored = sorted(
        [{"recipe": r, **score_recipe(r, norm_set)} for r in RECIPES],
        key=lambda x: x["score"],
        reverse=True,
    )
    strong = [s for s in scored if s["score"] > 0]

    notes = []
    for t in raw_list:
        note = ANA.get(t)
        if note:
            notes.append(note)

    if strong:
        matches = [s["recipe"] for s in strong[:4]]
        fallback = False
    else:
        flexible = [r for r in RECIPES if r.get("flexible")]
        flexible.sort(key=lambda r: len(r.get("ingredients", [])), reverse=True)
        matches = flexible[:3] if flexible else RECIPES[:2]
        fallback = True

    return {
        "raw_list": raw_list,
        "norm_set": list(norm_set),
        "norm_to_raw": norm_to_raw,
        "matches": matches,
        "notes": notes,
        "is_fallback": fallback,
    }


# ── 半文白文风生成（模板引擎，离线兜底）────────────────────────
def build_narrative(recipe, ctx):
    raw = ctx["raw_list"]
    raw_str = "、".join(raw) or "几味寻常"
    norm_set = set(ctx["norm_set"])
    is_fb = ctx.get("is_fallback", False)
    core_hits = sum(1 for c in recipe.get("core", []) if c in norm_set)
    norm_to_raw = ctx.get("norm_to_raw", {})

    if is_fb:
        intro = (
            f'夜深灶冷，君冰箱所储，不过「{raw_str}」数味。'
            f'此等物事，古谱未详其用，然治庖之道，贵在变通。'
            f'今取《{recipe["source"]}》之「{recipe["name"]}」古法为底，'
            f"权以君家所有入馔，亦成一格清欢。"
        )
    elif core_hits > 0:
        intro = (
            f'君家既有其主材，正合《{recipe["source"]}》古法。'
            f'{recipe["author"]}若见，当笑曰："此子解味。" '
            f'今为君量身复原一味「{recipe["name"]}」，寻常物事，亦作人间清欢。'
        )
    else:
        intro = (
            f'夜深人静，君冰箱所储，不过「{raw_str}」数味。'
            f"莫嫌寒俭——古人庖厨，本自就地取材。"
            f'检《{recipe["source"]}》，得「{recipe["name"]}」一味，最宜今宵。'
        )

    have = [i for i in recipe["ingredients"] if i in norm_set]
    have_label = [
        f"{i}（君家：{'/'.join(norm_to_raw.get(i, [i]))}）" for i in have
    ]
    need = [i for i in recipe["ingredients"] if i not in norm_set]
    closing = CLOSINGS[(len(recipe["name"]) + len(recipe["dynasty"])) % len(CLOSINGS)]

    return {
        "id": recipe["id"],
        "name": recipe["name"],
        "source": recipe["source"],
        "dynasty": recipe["dynasty"],
        "author": recipe["author"],
        "flavor": recipe.get("flavor", ""),
        "season": recipe.get("season", ""),
        "hue": recipe.get("hue", "#c9a86a"),
        "bowl": recipe.get("bowl", "white"),
        "garnish": recipe.get("garnish", []),
        "steps": recipe.get("steps", []),
        "tcm": recipe.get("tcm"),
        "original": recipe.get("original"),
        "intro": intro,
        "have_label": have_label,
        "need": need,
        "closing": closing,
    }


# ── 大模型增强（可选）─────────────────────────────────────────
def enhance_with_llm(recipe, ctx, narrative):
    """调用大模型，以真实古籍食谱为底本，生成半文白复古食谱文案。"""
    import requests

    user_ings = "、".join(ctx["raw_list"])
    recipe_ctx = {
        "菜名": recipe["name"],
        "出处": f'《{recipe["source"]}》·{recipe["dynasty"]}·{recipe["author"]}',
        "原用料": recipe["ingredients"],
        "古法步骤": recipe.get("steps", []),
        "原典引文": recipe.get("original", ""),
        "本草注": recipe.get("tcm", ""),
    }

    system = (
        "你是「古人的深夜食堂」的专属文案师，深谙《齐民要术》《随园食单》《本草纲目》等典籍，"
        "擅长半文半白的治愈系美食文案。你只依据给定的真实古籍食谱发挥，绝不编造古籍引文。"
    )
    user = f"""请基于下面这道【真实古籍食谱】，为一位深夜打开冰箱、手里只有这些食材的现代人，
创作一期「古代复古食谱」的半文白文案。

用户现有食材：{user_ings}

真实古籍食谱底本（务必以此为准，原典引文须原样保留）：
{json.dumps(recipe_ctx, ensure_ascii=False, indent=2)}

要求：
1. intro（引子）：温暖有烟火气的开场，点出用户现有食材与这道古法之间的缘分，半文半白。
2. steps（古法）：把原制法改写成 3-6 句半文半白、现代人能照着下厨的步骤。
3. closing（题跋）：一句治愈系收尾，给深夜独食的人一点温柔。
4. 不得编造《原文》之外的古籍引文。

请只返回如下 JSON，不要任何额外解释：
{{"intro": "...", "steps": ["...", "..."], "closing": "..."}}"""

    url = f"{LLM_BASE_URL}/chat/completions"
    headers = {"Authorization": f"Bearer {LLM_API_KEY}", "Content-Type": "application/json"}
    payload = {
        "model": LLM_MODEL,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "temperature": 0.85,
        "max_tokens": 1200,
        "response_format": {"type": "json_object"} if "gpt" in LLM_MODEL or "qwen" in LLM_MODEL else None,
    }
    payload = {k: v for k, v in payload.items() if v is not None}

    resp = requests.post(url, headers=headers, json=payload, timeout=40)
    resp.raise_for_status()
    text = resp.json()["choices"][0]["message"]["content"].strip()

    try:
        parsed = json.loads(text)
        intro = parsed.get("intro", "").strip() or narrative["intro"]
        steps = [s for s in parsed.get("steps", []) if isinstance(s, str) and s.strip()] or narrative["steps"]
        closing = parsed.get("closing", "").strip() or narrative["closing"]
    except Exception:
        # 模型未严格返回 JSON：整段作为润色文本兜底
        intro, steps, closing = narrative["intro"], narrative["steps"], narrative["closing"]

    return {
        **narrative,
        "intro": intro,
        "steps": steps,
        "closing": closing,
        "llm_enhanced": True,
        "llm_text": f"{intro}\n\n" + "\n".join(f"· {s}" for s in steps) + f"\n\n{closing}",
    }


# ── AI 绘图（可选占位）─────────────────────────────────────────
def generate_dish_image(recipe):
    """调用 AI 绘图生成水墨风菜品图片，返回 URL 或 None。"""
    if not IMAGE_GEN_KEY:
        return None
    try:
        import requests

        prompt = (
            f"Chinese ink wash painting (水墨画), a traditional porcelain bowl containing {recipe['name']}, "
            f"a dish from {recipe['dynasty']} dynasty {recipe['source']}. Soft brush strokes, warm rice-paper "
            f"texture, subtle rising steam, a red seal stamp in the corner, vertical calligraphy title. "
            f"Minimalist, elegant, healing atmosphere."
        )
        url = f"{(LLM_BASE_URL or 'https://api.openai.com/v1')}/images/generations"
        resp = requests.post(
            url,
            headers={"Authorization": f"Bearer {IMAGE_GEN_KEY}", "Content-Type": "application/json"},
            json={"model": IMAGE_GEN_MODEL, "prompt": prompt, "n": 1, "size": "1024x1024"},
            timeout=60,
        )
        data = resp.json()
        return data["data"][0].get("url") or data["data"][0].get("b64_json")
    except Exception as e:
        print(f"[image-gen] error: {e}")
        return None


# ── API 接口 ───────────────────────────────────────────────────
@app.route("/api/cook", methods=["POST"])
def api_cook():
    data = request.get_json(silent=True) or {}
    tokens_raw = data.get("ingredients", [])

    if isinstance(tokens_raw, str):
        tokens_raw = parse(tokens_raw)
    if not tokens_raw:
        return jsonify({"error": "请提供至少一种食材"}), 400

    ctx = do_match(tokens_raw)

    narratives = []
    for r in ctx["matches"]:
        n = build_narrative(r, ctx)
        if LLM_ENABLED:
            try:
                n = enhance_with_llm(r, ctx, n)
            except Exception as e:
                print(f"[llm] enhance failed for {r['name']}, using local: {e}")
        narratives.append(n)

    img_url = generate_dish_image(ctx["matches"][0]) if IMAGE_GEN_KEY else None

    return jsonify({
        "llm_enabled": LLM_ENABLED,
        "provider": PROVIDER or "custom",
        "matches": narratives,
        "ctx": {k: v for k, v in ctx.items() if k != "norm_to_raw"},
        "notes": ctx.get("notes", []),
        "top_image": img_url,
    })


@app.route("/api/recipes", methods=["GET"])
def api_recipes():
    summary = [
        {"id": r["id"], "name": r["name"], "source": r["source"],
         "dynasty": r["dynasty"], "core": r.get("core", [])}
        for r in RECIPES
    ]
    return jsonify({"count": len(summary), "recipes": summary})


@app.route("/api/status", methods=["GET"])
def api_status():
    return jsonify({
        "llm_enabled": LLM_ENABLED,
        "provider": PROVIDER or "custom",
        "model": LLM_MODEL if LLM_ENABLED else None,
        "base_url": LLM_BASE_URL if LLM_ENABLED else None,
        "recipes": len(RECIPES),
    })


# ── 静态资源路由 ───────────────────────────────────────────────
@app.route("/")
def index():
    return send_from_directory(BASE, "index.html")


@app.route("/<path:path>")
def static_files(path):
    return send_from_directory(BASE, path)


if __name__ == "__main__":
    port = int(os.environ.get("FLASK_PORT", 5000))
    mode = f"✦ 大模型[{PROVIDER or 'custom'}/{LLM_MODEL}]" if LLM_ENABLED else "📚 本地离线"
    print(f"\n{'═'*52}\n 古人的深夜食堂 · 舌尖上的古籍\n 模式: {mode} | http://localhost:{port}\n{'═'*52}\n")
    app.run(host="0.0.0.0", port=port, debug=False)
