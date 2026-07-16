/* 食谱卡渲染（共享）：主页与「我的收藏」页共用同一张卡片样式。
   含「藏」印章按钮（朱砂·古色），点击由全局委托处理。 */
(function () {
  "use strict";

  function escapeHtml(s) {
    return (s || "").replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  // —— 收藏印章按钮 ——
  function favBtnHTML(id) {
    var on = !!(window.Favs && window.Favs.has(id));
    return '<button type="button" class="fav-btn ' + (on ? "on" : "") +
      '" data-fav="' + id + '" aria-pressed="' + (on ? "true" : "false") + '">' +
      '<span class="h">藏</span><span class="t">' + (on ? "已藏" : "收藏") + "</span></button>";
  }

  // —— 卡片内部 HTML（.dish-col + .recipe-col）——
  function innerHTML(n) {
    var svg = window.InkDish.generate({
      id: n.id || n.name, name: n.name, hue: n.hue, bowl: n.bowl, garnish: n.garnish
    });

    var stepsHTML = (n.steps || []).map(function (s, i) {
      return '<li><span class="step-no">' + (i + 1) + "</span><span>" + escapeHtml(s) + "</span></li>";
    }).join("");

    var haveHTML = (n.haveLabel && n.haveLabel.length)
      ? n.haveLabel.map(function (h) { return '<span class="tag tag-have">' + escapeHtml(h) + "</span>"; }).join("")
      : '<span class="tag tag-mute">主料未详</span>';
    var needHTML = (n.need && n.need.length)
      ? n.need.map(function (x) { return '<span class="tag tag-need">' + escapeHtml(x) + "</span>"; }).join("")
      : '<span class="tag tag-mute">—— 主料已足</span>';

    var tcmHTML = n.tcm
      ? '<div class="tcm"><span class="tcm-label">本草</span><p>' + escapeHtml(n.tcm) + "</p></div>"
      : "";
    var origHTML = n.original
      ? '<div class="orig">原典 · ' + escapeHtml(n.original) + "</div>"
      : "";

    var body = n.llm_text
      ? '<div class="llm-essay"><p>' +
        escapeHtml(n.llm_text).replace(/\n{2,}/g, "</p><p>").replace(/\n/g, "<br/>") + "</p></div>"
      : '<p class="intro">' + escapeHtml(n.intro) + "</p>" +
        '<div class="section"><h3>古法</h3><ol class="steps">' + stepsHTML + "</ol></div>";

    return '' +
      '<div class="dish-col">' +
        '<div class="dish-frame">' + svg + "</div>" +
        '<div class="dish-cap">' + escapeHtml(n.name) + " · 水墨写意</div>" +
      "</div>" +
      '<div class="recipe-col">' +
        '<div class="recipe-head">' +
          "<h2>" + escapeHtml(n.name) + "</h2>" +
          '<div class="source-badge">《' + escapeHtml(n.source) + "》·" + escapeHtml(n.dynasty) + "·" + escapeHtml(n.author) + "</div>" +
          favBtnHTML(n.id || n.name) +
        "</div>" +
        '<div class="flavor-tags">' +
          '<span class="tag tag-flavor">性味 ' + escapeHtml(n.flavor) + "</span>" +
          '<span class="tag tag-flavor">时令 ' + escapeHtml(n.season) + "</span>" +
          (n.llm_enhanced ? '<span class="tag tag-ai">✦ AI 润色</span>' : "") +
        "</div>" +
        body +
        '<div class="section"><h3>用料</h3><div class="tags">' + haveHTML + needHTML + "</div></div>" +
        tcmHTML +
        origHTML +
        '<div class="colophon">' + escapeHtml(n.closing) + "</div>" +
        '<div class="share-row">' +
          '<button type="button" class="share-btn share-copy">复制题跋</button>' +
          '<button type="button" class="share-btn share-img">存水墨图</button>' +
          '<button type="button" class="share-btn share-link">复制链接</button>' +
        "</div>" +
      "</div>";
  }

  // —— 收藏页用：由 recipe 对象生成中性叙事 ——
  function liteNarrative(recipe) {
    var haveLabel = (recipe.ingredients || []).map(function (i) { return "" + i; });
    return {
      id: recipe.id, name: recipe.name, source: recipe.source, dynasty: recipe.dynasty,
      author: recipe.author, flavor: recipe.flavor, season: recipe.season,
      hue: recipe.hue, bowl: recipe.bowl, garnish: recipe.garnish,
      steps: recipe.steps, tcm: recipe.tcm, original: recipe.original,
      intro: "「" + recipe.name + "」，君曾藏于此间深夜食堂。今重展此味，温故如晤故人。",
      haveLabel: haveLabel, need: [],
      closing: "一箸入口，万虑俱息。所藏之味，最宜重逢。"
    };
  }

  // —— 生成一个完整 .recipe-card 元素 ——
  function renderEl(recipe, opts) {
    var n = liteNarrative(recipe);
    var card = document.createElement("div");
    card.className = "recipe-card" + (opts && opts.flip ? " flip-in" : "");
    card.innerHTML = innerHTML(n);
    return card;
  }

  // —— 全局委托：收藏按钮 + 分享按钮 ——
  document.addEventListener("click", function (e) {
    var tgt = e.target;
    var fav = tgt && tgt.closest ? tgt.closest(".fav-btn") : null;
    if (fav) {
      var id = fav.getAttribute("data-fav");
      var on = window.Favs.toggle(id);
      fav.classList.toggle("on", on);
      fav.setAttribute("aria-pressed", on ? "true" : "false");
      var t = fav.querySelector(".t");
      if (t) t.textContent = on ? "已藏" : "收藏";
      document.dispatchEvent(new CustomEvent("fav-changed", { detail: { id: id, on: on } }));
      return;
    }
    var card = tgt && tgt.closest ? tgt.closest(".recipe-card") : null;
    if (!card) return;
    if (tgt.closest && tgt.closest(".share-copy")) return shareCopy(card);
    if (tgt.closest && tgt.closest(".share-img")) return shareImg(card);
    if (tgt.closest && tgt.closest(".share-link")) return shareLink(card);
  });

  // —— 分享：复制/存图 ——
  function textOf(card, sel) {
    var el = card.querySelector(sel);
    return el ? el.textContent.trim() : "";
  }
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve) {
      var ta = document.createElement("textarea");
      ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); } catch (e) {}
      document.body.removeChild(ta); resolve();
    });
  }
  function feedback(btn, msg) {
    if (!btn) return;
    var old = btn.textContent;
    btn.textContent = msg;
    setTimeout(function () { btn.textContent = old; }, 1500);
  }
  function shareCopy(card) {
    var btn = card.querySelector(".share-copy");
    var name = textOf(card, ".recipe-head h2");
    var src = textOf(card, ".source-badge");
    var intro = textOf(card, ".intro") || textOf(card, ".llm-essay");
    var steps = Array.prototype.map.call(card.querySelectorAll(".steps li"), function (li) { return li.textContent.trim(); });
    var closing = textOf(card, ".colophon");
    var lines = [];
    lines.push(name + (src ? "（" + src + "）" : ""));
    lines.push("");
    if (intro) lines.push(intro);
    if (steps.length) {
      lines.push(""); lines.push("古法：");
      steps.forEach(function (s, i) { lines.push((i + 1) + ". " + s); });
    }
    if (closing) lines.push("", closing);
    lines.push("", "—— 古人的深夜食堂");
    copyText(lines.join("\n")).then(function () { feedback(btn, "已复制 ✓"); });
  }
  function shareLink(card) {
    var btn = card.querySelector(".share-link");
    var id = card.querySelector(".fav-btn") && card.querySelector(".fav-btn").getAttribute("data-fav");
    var recipe = (window.KB && window.KB.recipes || []).filter(function (r) { return r.id === id; })[0];
    var core = (recipe && recipe.core && recipe.core[0]) || (recipe && recipe.ingredients && recipe.ingredients[0]) || "";
    var url = location.origin + location.pathname + "?ing=" + encodeURIComponent(core);
    copyText(url).then(function () { feedback(btn, "已复制 ✓"); });
  }
  function shareImg(card) {
    var btn = card.querySelector(".share-img");
    var svg = card.querySelector(".ink-dish");
    var name = textOf(card, ".recipe-head h2") || "古人的深夜食堂";
    if (!svg) { feedback(btn, "暂无图"); return; }
    svgToPng(svg, name + ".png").then(function () {
      feedback(btn, "已存图 ✓");
    }).catch(function () { feedback(btn, "存图失败"); });
  }
  function svgToPng(svgEl, filename) {
    return new Promise(function (resolve, reject) {
      var clone = svgEl.cloneNode(true);
      clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      clone.setAttribute("width", "720");
      clone.setAttribute("height", "720");
      var xml = new XMLSerializer().serializeToString(clone);
      var src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(xml);
      var img = new Image();
      img.onload = function () {
        var S = 2, c = document.createElement("canvas");
        c.width = 720 * S; c.height = 720 * S;
        var ctx = c.getContext("2d");
        ctx.fillStyle = "#f3ece0"; ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        c.toBlob(function (b) {
          if (!b) { reject(); return; }
          var a = document.createElement("a");
          a.href = URL.createObjectURL(b); a.download = filename;
          document.body.appendChild(a); a.click(); document.body.removeChild(a);
          setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
          resolve();
        }, "image/png");
      };
      img.onerror = reject;
      img.src = src;
    });
  }

  window.RecipeCard = {
    innerHTML: innerHTML,
    renderEl: renderEl,
    liteNarrative: liteNarrative,
    favBtnHTML: favBtnHTML
  };
})();
