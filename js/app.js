/* 古人的深夜食堂 —— 前端逻辑
   职责：解析食材 → 同义词归一 → 匹配古籍食谱 → 半文白文风生成 → 渲染卡片与水墨图。
   优先调用后端 /api/cook（若部署了 server.py 并接入大模型），否则使用本地生成。 */
(function () {
  "use strict";

  const KB = window.KB;
  const SYN = KB.synonyms;
  const ANA = KB.anachronism;
  const RECIPES = KB.recipes;

  const CLOSINGS = [
    "一箸入口，万虑俱息。深夜食堂，不过如此。",
    "灶上烟火，釜中春秋。愿君食之，好梦如旧。",
    "古人诚不欺我：治庖如治心，火候到了，滋味自来。",
    "家常一味，最养凡人。纵无珍馐，亦可慰风尘。",
    "箪食瓢饮，回也不改其乐。君今有此，胜却膏粱。"
  ];

  // —— 解析与归一 ——
  function parse(text) {
    return (text || "")
      .split(/[，,、\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  function normalize(tokens) {
    const rawList = [];
    const normSet = new Set();
    const normToRaw = {};
    tokens.forEach((t) => {
      const key = t.replace(/[。．.；;]/g, "");
      if (!key) return;
      const norm = SYN[key] || SYN[key.replace(/[老嫩鲜活小大]/g, "")] || key;
      rawList.push(key);
      normSet.add(norm);
      (normToRaw[norm] = normToRaw[norm] || []).push(key);
    });
    return { rawList, normSet, normToRaw };
  }

  // —— 匹配 ——
  function scoreRecipe(recipe, normSet) {
    let coreHits = 0, ingHits = 0;
    (recipe.core || []).forEach((c) => { if (normSet.has(c)) coreHits++; });
    recipe.ingredients.forEach((i) => { if (normSet.has(i)) ingHits++; });
    return { score: coreHits * 5 + ingHits, coreHits, ingHits };
  }

  function match(tokens) {
    const { rawList, normSet, normToRaw } = normalize(tokens);
    const scored = RECIPES.map((r) => ({ r, ...scoreRecipe(r, normSet) }))
      .sort((a, b) => b.score - a.score);
    const strong = scored.filter((s) => s.score > 0);

    const notes = [];
    rawList.forEach((t) => { if (ANA[t]) notes.push(ANA[t]); });

    let matches, isFallback = false;
    if (strong.length) {
      matches = strong.slice(0, 4).map((s) => s.r);
    } else {
      isFallback = true;
      const flexible = RECIPES.filter((r) => r.flexible)
        .sort((a, b) => b.ingredients.length - a.ingredients.length);
      matches = [flexible[0], flexible[1], flexible[2]].filter(Boolean);
    }
    return { rawList, normSet, normToRaw, matches, notes, isFallback };
  }

  // —— 文风生成（本地模板，离线兜底）——
  function buildNarrative(recipe, ctx) {
    const { rawList, normSet, normToRaw, isFallback } = ctx;
    const raw = rawList.join("、") || "几味寻常";
    const coreHits = (recipe.core || []).filter((c) => normSet.has(c)).length;

    let intro;
    if (isFallback) {
      intro = `夜深灶冷，君冰箱所储，不过「${raw}」数味。此等物事，古谱未详其用，然治庖之道，贵在变通。今取《${recipe.source}》之「${recipe.name}」古法为底，权以君家所有入馔，亦成一格清欢。`;
    } else if (coreHits > 0) {
      intro = `君家既有其主材，正合《${recipe.source}》古法。${recipe.author}若见，当笑曰："此子解味。" 今为君量身复原一味「${recipe.name}」，寻常物事，亦作人间清欢。`;
    } else {
      intro = `夜深人静，君冰箱所储，不过「${raw}」数味。莫嫌寒俭——古人庖厨，本自就地取材。检《${recipe.source}》，得「${recipe.name}」一味，最宜今宵。`;
    }

    const have = recipe.ingredients.filter((i) => normSet.has(i));
    const haveLabel = have.map((i) => `${i}（君家：${(normToRaw[i] || [i]).join("/")}）`);
    const need = recipe.ingredients.filter((i) => !normSet.has(i));
    const closing = CLOSINGS[(recipe.name.length + recipe.dynasty.length) % CLOSINGS.length];

    return {
      id: recipe.id, name: recipe.name, source: recipe.source, dynasty: recipe.dynasty,
      author: recipe.author, flavor: recipe.flavor, season: recipe.season,
      hue: recipe.hue, bowl: recipe.bowl, garnish: recipe.garnish,
      steps: recipe.steps, tcm: recipe.tcm, original: recipe.original,
      intro, haveLabel, need, closing
    };
  }

  // —— 渲染 ——
  const $ = (sel) => document.querySelector(sel);
  const elResult = $("#result");
  const elMenu = $("#menu-chips");
  let state = { narratives: [], index: 0 };

  function recipeCardHTML(n) {
    const svg = window.InkDish.generate({
      id: n.name, name: n.name, hue: n.hue, bowl: n.bowl, garnish: n.garnish
    });

    const stepsHTML = (n.steps || [])
      .map((s, i) => `<li><span class="step-no">${i + 1}</span><span>${s}</span></li>`)
      .join("");
    const haveHTML = (n.haveLabel && n.haveLabel.length)
      ? n.haveLabel.map((h) => `<span class="tag tag-have">${h}</span>`).join("")
      : `<span class="tag tag-mute">君家暂未备此味主料</span>`;
    const needHTML = (n.need && n.need.length)
      ? n.need.map((x) => `<span class="tag tag-need">${x}</span>`).join("")
      : `<span class="tag tag-mute">—— 主料已足，无需外求</span>`;
    const tcmHTML = n.tcm
      ? `<div class="tcm"><span class="tcm-label">本草</span><p>${n.tcm}</p></div>`
      : "";
    const origHTML = n.original
      ? `<div class="orig">原典 · ${n.original}</div>`
      : "";

    // 大模型润色文案优先展示
    const body = n.llm_text
      ? `<div class="llm-essay"><p>${escapeHtml(n.llm_text).replace(/\n{2,}/g, "</p><p>").replace(/\n/g, "<br/>")}</p></div>`
      : `<p class="intro">${n.intro}</p>
         <div class="section"><h3>古法</h3><ol class="steps">${stepsHTML}</ol></div>`;

    return `
      <div class="dish-col">
        <div class="dish-frame">${svg}</div>
        <div class="dish-cap">${n.name} · 水墨写意</div>
      </div>
      <div class="recipe-col">
        <div class="recipe-head">
          <h2>${n.name}</h2>
          <div class="source-badge">《${n.source}》·${n.dynasty}·${n.author}</div>
        </div>
        <div class="flavor-tags">
          <span class="tag tag-flavor">性味 ${n.flavor}</span>
          <span class="tag tag-flavor">时令 ${n.season}</span>
          ${n.llm_enhanced ? '<span class="tag tag-ai">✦ AI 润色</span>' : ""}
        </div>
        ${body}
        <div class="section">
          <h3>用料</h3>
          <div class="tags">${haveHTML}${needHTML}</div>
        </div>
        ${tcmHTML}
        ${origHTML}
        <div class="colophon">${n.closing}</div>
      </div>`;
  }

  function escapeHtml(s) {
    return (s || "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  }

  function render(index, animate) {
    const n = state.narratives[index];
    if (!n) return;
    state.index = index;
    const card = $("#recipe-card");
    if (animate) {
      card.classList.remove("flip-in");
      void card.offsetWidth;
      card.innerHTML = (window.RecipeCard ? window.RecipeCard.innerHTML(n) : recipeCardHTML(n));
      card.classList.add("flip-in");
    } else {
      card.innerHTML = (window.RecipeCard ? window.RecipeCard.innerHTML(n) : recipeCardHTML(n));
    }
    [...elMenu.children].forEach((c, i) => c.classList.toggle("active", i === index));
    elResult.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function showNotes(notes) {
    const box = $("#notes");
    if (!notes || !notes.length) { box.style.display = "none"; return; }
    box.style.display = "block";
    box.innerHTML = `<div class="notes-title">考据小笺</div>` +
      notes.map((t) => `<p>${t}</p>`).join("");
  }

  function showMenu(narratives, onPick) {
    elMenu.innerHTML = narratives
      .map((n, i) => `<button class="chip" data-i="${i}">${n.name}<small>《${n.source}》</small></button>`)
      .join("");
    [...elMenu.children].forEach((c) => {
      c.addEventListener("click", () => onPick(parseInt(c.dataset.i, 10)));
    });
  }

  // —— 主流程 ——
  async function cook(rawText) {
    const tokens = parse(rawText);
    if (!tokens.length) {
      elResult.style.display = "none";
      alert("且报上几味食材，方好为君备席。");
      return;
    }

    // 取数：优先后端 /api/cook，否则本地匹配（离线兜底）
    const compute = async () => {
      let narratives = null, notes = [];
      try {
        const resp = await fetch("/api/cook", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ingredients: tokens })
        });
        if (resp.ok) {
          const data = await resp.json();
          if (data && Array.isArray(data.matches) && data.matches.length) {
            narratives = data.matches;
            notes = data.notes || [];
            showAiBadge(!!data.llm_enabled);
          }
        }
      } catch (e) { /* 本地回退 */ }
      if (!narratives) {
        const ctx = match(tokens);
        narratives = ctx.matches.map((r) => buildNarrative(r, ctx));
        notes = ctx.notes;
        showAiBadge(false);
      }
      return { narratives, notes };
    };

    // 渲染：在「起锅」暖光晕开时调用，结果于底层备好
    const renderAll = (d) => {
      if (!d) return;
      state.narratives = d.narratives;
      showNotes(d.notes);
      elResult.style.display = "block";
      showMenu(d.narratives, (i) => render(i, true));
      render(0, false);
    };

    if (window.StoveTransition) {
      await window.StoveTransition.play(compute(), renderAll);
    } else {
      renderAll(await compute());
    }
  }

  function showAiBadge(on) {
    let badge = $("#ai-badge");
    if (!badge) {
      badge = document.createElement("span");
      badge.id = "ai-badge";
      badge.className = "ai-badge";
      $(".result-head").insertBefore(badge, $(".flip-nav"));
    }
    badge.style.display = on ? "inline-flex" : "none";
    badge.textContent = "✦ 大模型已接入";
  }

  // —— 事件绑定 ——
  function bind() {
    // 首访引导：若无访问记录则显示一句欢迎语
    try {
      if (!localStorage.getItem("guren_visited")) {
        var fvh = document.getElementById("first-visit-hint");
        if (fvh) fvh.style.display = "block";
        localStorage.setItem("guren_visited", "1");
      }
    } catch (e) {}

    $("#btn-cook").addEventListener("click", () => cook($("#input").value));
    $("#input").addEventListener("keydown", (e) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) cook($("#input").value);
    });
    $("#btn-random").addEventListener("click", () => {
      const r = RECIPES[Math.floor(Math.random() * RECIPES.length)];
      $("#input").value = (r.core || [r.ingredients[0]]).join("、");
      cook($("#input").value);
    });
    $("#btn-prev").addEventListener("click", () => {
      const i = (state.index - 1 + state.narratives.length) % state.narratives.length;
      render(i, true);
    });
    $("#btn-next").addEventListener("click", () => {
      const i = (state.index + 1) % state.narratives.length;
      render(i, true);
    });
    document.querySelectorAll(".example").forEach((b) => {
      b.addEventListener("click", () => {
        $("#input").value = b.dataset.ing;
        cook(b.dataset.ing);
      });
    });

    // 支持 ?ing=食材 直接预填并生成（人格测试「去复刻」跳转）
    const ingParam = new URLSearchParams(location.search).get("ing");
    if (ingParam) {
      $("#input").value = ingParam;
      cook(ingParam);
    }
  }

  document.addEventListener("DOMContentLoaded", bind);
})();
