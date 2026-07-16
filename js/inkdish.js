/* 水墨菜图生成器 v4：清晰·立体·有食欲的程序化 SVG 菜品图。
   核心改进（解决「模糊」问题）：
   ✓ 完全移除高斯模糊滤镜 —— 每一像素都清晰锐利
   ✓ 饱和度提升 30%+ —— 色彩饱满不灰暗
   ✓ 立体食堆（穹顶形）—— 有厚度、有明暗、有轮廓线
   ✓ 大块食材颗粒 —— 可辨识的豆腐/肉丁/菜叶形状
   ✓ 粗描边策略 —— 食堆+碗口均有深色轮廓，层次分明
   ✓ 同食谱输出稳定（按 id 播种 RNG）。 */
(function () {
  "use strict";

  /* ====== 播种 RNG ====== */
  function rng(seed) {
    let s = 2166136261 >>> 0;
    for (let i = 0; i < seed.length; i++) {
      s ^= seed.charCodeAt(i);
      s = Math.imul(s, 16777619) >>> 0;
    }
    return function () {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  /* ====== 色彩工具 ====== */
  function hexToRgb(h) {
    h = h.replace("#", "");
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function shade(hex, p) {
    const [r, g, b] = hexToRgb(hex);
    const f = (c) => Math.max(0, Math.min(255, Math.round(c + (p / 100) * 255)));
    return `rgb(${f(r)},${f(g)},${f(b)})`;
  }
  /* 提升饱和度：向纯色方向推 */
  function saturate(hex, amt) {
    const [r, g, b] = hexToRgb(hex);
    const max = Math.max(r, g, b);
    const f = (c) => Math.round(c + (max - c) * amt / 100);
    return `rgb(${f(r)},${f(g)},${f(b)})`;
  }
  function lerpColor(a, b, ratio) {
    const [ar, ag, ab] = hexToRgb(a);
    const [br, bg, bb] = hexToRgb(b);
    return `rgb(${Math.round(ar + (br - ar) * ratio)},${Math.round(ag + (bg - ag) * ratio)},${Math.round(ab + (bb - ab) * ratio)})`;
  }

  /* ====== 配料配色表 ====== */
  const GARNISH_COLORS = {
    "葱": "#5a8a2e", "葱白": "#e0ebc8", "松仁": "#d8a84a", "核桃仁": "#a06830",
    "火腿": "#b84828", "椒": "#dd2208", "姜": "#ddb85a", "莲": "#e8dcc0",
    "百合": "#f0eac8", "枣": "#922820", "杏": "#dda04a", "荠": "#789a48",
    "莼": "#88b458", "鸡": "#dcaa72", "虾": "#e08858", "笋": "#e4cc80",
    "香菇": "#7c5636", "番茄": "#cc3828", "虾油": "#dc8848",
    "韭": "#5a8a2e", "芹": "#5a8a2e"
  };

  /* ====== 碗体配色 ====== */
  function bowlColors(type) {
    if (type === "celadon") {
      return { rim: "#aac4aa", top: "#d0e4d0", bot: "#82a082", stroke: "#4e704e", inner: "#94b494", innerEdge: "#6e906e" };
    }
    return { rim: "#e6dfd0", top: "#faf6ec", bot: "#ccc0a8", stroke: "#a89876", inner: "#ddd0b8", innerEdge: "#baa888" };
  }

  /* ====== 食材颗粒 ======
     根据配料名称推断形状，渲染为清晰的大块元素。
  */
  function renderPieces(recipe, r, cx, rimY) {
    let out = "";
    const hue = recipe.hue || "#c9a86a";
    const ing = recipe.ingredients || [];
    const core = recipe.core || [];

    function guessShape(name) {
      const n = name.toLowerCase();
      if (/豆腐|腐|糕|饼|冻/.test(n)) return "cube";
      if (/肉|鸡|鸭|鱼|虾|肝|腰|肚/.test(n)) return "chunk";
      if (/豆|丸|珠|米|粒/.test(n)) return "round";
      if (/丝|条|针|面/.test(n)) return "strip";
      if (/片|叶|耳/.test(n)) return "slice";
      return "blob";
    }

    // 主料大块
    const mainSources = core.length ? core : ing.slice(0, 3);
    mainSources.forEach((name) => {
      const sh = guessShape(name);
      const size = 14 + r() * 14;
      const px = cx + (r() - 0.46) * 96;
      const py = rimY - 10 + (r() - 0.55) * 30;
      out += drawPiece(sh, px, py, size, hue, r, 0.82);
    });

    // 辅料小块
    const nExtra = 5 + Math.floor(r() * 5);
    for (let i = 0; i < nExtra; i++) {
      const shapes = ["blob", "round", "cube", "slice"];
      const sh = shapes[Math.floor(r() * shapes.length)];
      const size = 7 + r() * 10;
      const px = cx + (r() - 0.5) * 118;
      const py = rimY - 6 + (r() - 0.52) * 34;
      out += drawPiece(sh, px, py, size, hue, r, 0.55 + r() * 0.35);
    }

    return out;

    function drawPiece(shape, x, y, sz, baseHue, rr, op) {
      const hv = rr() * 28 - 14; // 色相偏移
      const fill = lerpColor(saturate(shade(baseHue, hv - 12), 15), saturate(shade(baseHue, hv + 18), 12), rr());
      const sx = x.toFixed(1), sy = y.toFixed(1);

      switch (shape) {
        case "cube": {
          const w = sz, h = sz * 0.7, rad = w * 0.16;
          return `<g opacity="${op.toFixed(2)}">
            <rect x="${sx}" y="${sy}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="${rad.toFixed(1)}"
                  fill="${fill}" stroke="${shade(fill, -32)}" stroke-width="0.8"/>
            <rect x="${(+sx + 1.5).toFixed(1)}" y="${(+sy + 1.5).toFixed(1)}"
                  width="${(w * 0.42).toFixed(1)}" height="${(h - 4).toFixed(1)}" rx="${(rad * 0.5).toFixed(1)}"
                  fill="white" opacity="0.16"/>
          </g>`;
        }
        case "chunk":
        case "blob": {
          const rx_ = sz * (0.8 + rr() * 0.35), ry_ = sz * (0.55 + rr() * 0.28);
          return `<g opacity="${op.toFixed(2)}">
            <ellipse cx="${sx}" cy="${sy}" rx="${rx_.toFixed(1)}" ry="${ry_.toFixed(1)}"
                     fill="${fill}" stroke="${shade(fill, -30)}" stroke-width="0.8"/>
            <ellipse cx="${(+sx - rx_ * 0.25).toFixed(1)}" cy="${(+sy - ry_ * 0.25).toFixed(1)}"
                     rx="${(rx_ * 0.35).toFixed(1)}" ry="${(ry_ * 0.3).toFixed(1)}"
                     fill="white" opacity="0.14"/>
          </g>`;
        }
        case "round": {
          const rad = sz * 0.44;
          return `<g opacity="${op.toFixed(2)}">
            <circle cx="${sx}" cy="${sy}" r="${rad.toFixed(1)}"
                    fill="${fill}" stroke="${shade(fill, -28)}" stroke-width="0.8"/>
            <circle cx="${(+sx - rad * 0.28).toFixed(1)}" cy="${(+sy - rad * 0.28).toFixed(1)}"
                    r="${(rad * 0.32).toFixed(1)}" fill="white" opacity="0.14"/>
          </g>`;
        }
        case "strip": {
          const len = sz * (1.5 + rr()), wid = sz * 0.24, rot = (rr() * 140 - 70).toFixed(1);
          return `<g opacity="${op.toFixed(2)}">
            <rect x="${sx}" y="${sy}" width="${len.toFixed(1)}" height="${wid.toFixed(1)}"
                  rx="${wid.toFixed(1)}" fill="${fill}" stroke="${shade(fill, -28)}" stroke-width="0.6"
                  transform="rotate(${rot} ${sx} ${sy})"/>
          </g>`;
        }
        case "slice": {
          const rx2 = sz * 1.05, ry2 = sz * 0.4;
          return `<g opacity="${op.toFixed(2)}">
            <ellipse cx="${sx}" cy="${sy}" rx="${rx2.toFixed(1)}" ry="${ry2.toFixed(1)}"
                     fill="${fill}" stroke="${shade(fill, -28)}" stroke-width="0.8"/>
            <ellipse cx="${(+sx - rx2 * 0.2).toFixed(1)}" cy="${(+sy - ry2 * 0.3).toFixed(1)}"
                     rx="${(rx2 * 0.3).toFixed(1)}" ry="${(ry2 * 0.25).toFixed(1)}"
                     fill="white" opacity="0.13"/>
          </g>`;
        }
        default:
          return "";
      }
    }
  }

  /* ====== 点缀层 ====== */
  function renderGarnishTop(garnishList, r, cx, rimY) {
    let out = "";
    (garnishList || []).forEach((g) => {
      const col = GARNISH_COLORS[g] || "#5a402c";
      const isLeaf = g === "葱" || g === "韭" || g === "芹";
      const n = isLeaf ? 5 + Math.floor(r() * 3) : 3 + Math.floor(r() * 2);
      for (let i = 0; i < n; i++) {
        const x = cx + (r() - 0.5) * 148;
        const y = rimY - 12 + (r() - 0.56) * 34;
        if (isLeaf) {
          const w = 11 + r() * 8, rot = (r() * 80 - 40).toFixed(0);
          out += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="3" rx="1.5"
                      fill="${col}" stroke="${shade(col, -24)}" stroke-width="0.5"
                      transform="rotate(${rot} ${x.toFixed(1)} ${y.toFixed(1)})" opacity="0.94"/>`;
          out += `<circle cx="${(x + w / 2).toFixed(1)}" cy="${y.toFixed(1)}" r="1.4" fill="${shade(col, -18)}"/>`;
        } else if (g === "椒") {
          const cr = (2.4 + r()).toFixed(1);
          out += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${cr}"
                      fill="${col}" stroke="${shade(col, -20)}" stroke-width="0.5"/>`;
          out += `<rect x="${(x - 0.5).toFixed(1)}" y="${(y - 5).toFixed(1)}" width="1" height="4" rx="0.5" fill="#5a8a32"/>`;
        } else {
          const erx = g === "火腿" || g === "松仁" ? 4.2 : 3;
          out += `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${erx}" ry="${(erx * 0.62).toFixed(1)}"
                      fill="${col}" stroke="${shade(col, -22)}" stroke-width="0.5" opacity="0.93"/>`;
        }
      }
    });
    return out;
  }

  /* ====== 主函数 ====== */
  function generate(recipe) {
    const r = rng(recipe.id || recipe.name || "x");
    // 饱和化主色
    const rawHue = recipe.hue || "#c9a86a";
    const hue = saturate(rawHue, 25);
    const bc = bowlColors(recipe.bowl || "white");
    const cx = 180;
    const rimY = 250;

    /* ---- 碗体 ---- */
    let bowl = "";
    // 桌面阴影
    bowl += `<ellipse cx="${cx}" cy="344" rx="95" ry="13" fill="#241c14" opacity="0.13"/>`;
    // 碗身（弧形底部）
    bowl += `<path d="M${cx - 116},${rimY} Q${cx},352 ${cx + 116},${rimY} Z"
              fill="url(#bowlGrad)" stroke="${bc.stroke}" stroke-width="2.4"/>`;
    // 圈足
    bowl += `<path d="M146,340 Q${cx},358 ${214},340" fill="none" stroke="${bc.stroke}" stroke-width="2" opacity="0.6"/>`;
    // 碗口外沿（粗亮圈）
    bowl += `<ellipse cx="${cx}" cy="${rimY}" rx="116" ry="32" fill="none" stroke="${bc.rim}" stroke-width="3.4"/>`;
    // 碗内壁（径向渐变模拟深度）
    bowl += `<ellipse cx="${cx}" cy="${rimY}" rx="100" ry="26" fill="url(#innerGrad)" stroke="${bc.innerEdge}" stroke-width="1.5"/>`;

    /* ---- 盘中物 ---- */
    const clipId = "clipFood";
    let clipDef = `<clipPath id="${clipId}"><ellipse cx="${cx}" cy="${rimY - 2}" rx="97" ry="23"/></clipPath>`;

    let food = `<g clip-path="url(#${clipId})">`;

    // 第1层：底色（清晰椭圆，无模糊！）
    food += `<ellipse cx="${cx}" cy="${rimY - 2}" rx="93" ry="21" fill="url(#dishBase)" opacity="0.92"/>`;

    // 第2层：立体食堆（穹顶形，粗轮廓）
    const mh = 16 + Math.floor(r() * 10); // 堆高
    const mw = 82; // 半宽
    food += `<path d="M${cx - mw},${rimY - 2}
                       Q${cx - mw * 0.36},${rimY - mh - 6} ${cx},${rimY - mh - 1}
                       Q${cx + mw * 0.36},${rimY - mh - 6} ${cx + mw},${rimY - 2}
                       Q${cx + mw * 0.28},${rimY - 0.5} ${cx},${rimY}
                       Q${cx - mw * 0.28},${rimY - 0.5} ${cx - mw},${rimY - 2} Z"
              fill="url(#moundGrad)" stroke="${saturate(shade(hue, -38), 20)}" stroke-width="1.5" stroke-linejoin="round"/>`;

    // 第3层：散落食材（每块带描边，清晰可见）
    food += renderPieces(recipe, r, cx, rimY);

    // 第4层：顶部高光（光泽）
    food += `<ellipse cx="${cx - 20}" cy="${rimY - mh - 3}" rx="30" ry="7.5" fill="white" opacity="0.26"/>`;
    food += `<ellipse cx="${cx - 8}" cy="${rimY - mh + 3}" rx="18" ry="4" fill="${saturate(shade(hue, 38), 15)}" opacity="0.30"/>`;

    // 第5层：边缘加深线（增强立体感）
    food += `<path d="M${cx - mw + 8},${rimY - 2} Q${cx - mw * 0.25},${rimY} ${cx},${rimY} Q${cx + mw * 0.25},${rimY} ${cx + mw - 8},${rimY - 2}"
              fill="none" stroke="${saturate(shade(hue, -48), 18)}" stroke-width="2" opacity="0.4" stroke-linecap="round"/>`;

    // 第6层：点缀（葱花等顶层装饰）
    food += renderGarnishTop(recipe.garnish || [], r, cx, rimY);

    food += `</g>`;

    /* ---- 热气（自然曲线，渐变透明）---- */
    let steam = "";
    const nSteam = 2 + Math.floor(r() * 2);
    for (let i = 0; i < nSteam; i++) {
      const sx = cx - 30 + i * 38 + (r() - 0.5) * 14;
      let sy = rimY - mh - 22;
      let d = `M${sx},${sy}`;
      for (let seg = 0; seg < 3; seg++) {
        sy -= 17 + r() * 13;
        const cpx = sx + (seg % 2 === 0 ? 1 : -1) * (10 + r() * 14);
        d += ` Q${cpx.toFixed(1)},${(sy + 9).toFixed(1)} ${(sx + (seg % 2 === 0 ? -1 : 1) * (6 + r() * 10)).toFixed(1)},${sy.toFixed(1)}`;
      }
      const sw = (2.4 + r() * 1.4).toFixed(1);
      const sop = (0.45 + r() * 0.4).toFixed(2);
      steam += `<path class="ink-steam" d="${d}" fill="none" stroke="url(#steamGrad)" stroke-width="${sw}" stroke-linecap="round" opacity="${sop}"/>`;
    }

    /* ---- 竖排题字 ---- */
    const name = recipe.name || "";
    let title = "";
    const tx = 334;
    for (let i = 0; i < name.length && i < 6; i++) {
      title += `<text x="${tx}" y="${52 + i * 30}" font-family="'Noto Serif SC','Songti SC','SimSun',serif"
                       font-size="22" fill="#282828" text-anchor="middle">${name[i]}</text>`;
    }

    /* ---- 印章 ---- */
    const sealChar = (recipe.author || "古")[0];
    const seal = `<g transform="translate(306,248)">
      <rect width="34" height="34" rx="5" fill="#a22820" stroke="#7a1814" stroke-width="1"/>
      <rect x="2.5" y="2.5" width="29" height="29" rx="3.5" fill="none" stroke="#f0e8dc" stroke-width="0.9" opacity="0.55"/>
      <text x="17" y="24" font-family="'Noto Serif SC',serif" font-size="20" fill="#f0e8dc" text-anchor="middle">${sealChar}</text>
    </g>`;

    /* ---- defs ---- */
    const defs = `<defs>
      <linearGradient id="bowlGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${bc.top}"/>
        <stop offset="100%" stop-color="${bc.bot}"/>
      </linearGradient>
      <radialGradient id="innerGrad" cx="50%" cy="42%" r="62%">
        <stop offset="0%" stop-color="${bc.inner}"/>
        <stop offset="100%" stop-color="${bc.innerEdge}"/>
      </radialGradient>
      <radialGradient id="dishBase" cx="50%" cy="48%" r="60%">
        <stop offset="0%" stop-color="${shade(hue, 16)}"/>
        <stop offset="55%" stop-color="${hue}"/>
        <stop offset="100%" stop-color="${shade(hue, -16)}"/>
      </radialGradient>
      <linearGradient id="moundGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${shade(hue, 32)}"/>
        <stop offset="42%" stop-color="${hue}"/>
        <stop offset="100%" stop-color="${shade(hue, -30)}"/>
      </linearGradient>
      <linearGradient id="steamGrad" x1="0" y1="1" x2="0" y2="0">
        <stop offset="0%" stop-color="#fff" stop-opacity="0.60"/>
        <stop offset="100%" stop-color="#fff" stop-opacity="0"/>
      </linearGradient>
      ${clipDef}
    </defs>`;

    return `<svg class="ink-dish" viewBox="0 0 360 360" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${recipe.name} 水墨图">${defs}${bowl}${food}${steam}${title}${seal}</svg>`;
  }

  window.InkDish = { generate };
})();
