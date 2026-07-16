/* 美食家人格测试
   6 道趣味选择题 → 测出用户与哪位古代美食家最投缘（袁枚/苏轼/贾思勰/李时珍/张翰）
   → 展示人设 + 默契点 + 推荐该美食家的食谱（一键跳去 index.html 复刻）。 */
(function () {
  "use strict";
  const KB = window.KB;

  // —— 五位古代美食家人设 ——
  const FOODIES = {
    yuanmei: {
      name: "袁枚", author: "袁枚", title: "随园食单 · 清", tag: "食不厌精的随园主人",
      seal: "袁",
      desc: "你像袁子才——讲究却不迂腐，相信一碟豆腐也能吃出乾坤。火候、刀工、用料，你都乐意花心思；清淡里见真味，是你的人生态度。"
    },
    sushi: {
      name: "苏轼", author: "苏轼", title: "东坡 · 宋", tag: "豁达的美食江湖客",
      seal: "苏",
      desc: "你像苏东坡——人生起落都挡不住你爱吃爱做。一块东坡肉、一碗东坡羹，粗茶淡饭也能吃出豁达。不管境遇如何，先把这顿饭吃香。"
    },
    jiasixie: {
      name: "贾思勰", author: "贾思勰", title: "齐民要术 · 北魏", tag: "务实的农家食神",
      seal: "贾",
      desc: "你像贾思勰——相信应时而食、家常最养人。不追求花哨，地里什么熟就吃什么，一碗稠粥、一张饼，便是踏实的人间味。"
    },
    lishizhen: {
      name: "李时珍", author: "李时珍", title: "本草纲目 · 明", tag: "养生的药膳圣人",
      seal: "李",
      desc: "你像李时珍——吃东西讲究性味归经，什么时令吃什么、什么体质怎么补，你心里有本账。食药同源，吃进肚里要养人。"
    },
    zhanghan: {
      name: "张翰", author: "张翰", title: "莼鲈之思 · 晋", tag: "为美食弃官的归客",
      seal: "张",
      desc: "你像张翰——一口莼羹鲈脍，便能抛下功名归乡。你重念想、恋故味，江南水乡的一缕鲜，胜过半生浮沉。"
    }
  };
  // 平局优先级
  const PRIORITY = ["sushi", "yuanmei", "jiasixie", "lishizhen", "zhanghan"];

  // —— 六道小题（每题 5 选项，各对应一位）——
  const QUESTIONS = [
    { q: "深夜饿了，你的理想宵夜是？", options: [
      { t: "一小碟精致豆腐，温一壶黄酒", who: "yuanmei" },
      { t: "大块东坡肉盖饭，香就完事", who: "sushi" },
      { t: "一碗热乎小米粥，最踏实", who: "jiasixie" },
      { t: "一盅百合莲子羹，润一润", who: "lishizhen" },
      { t: "一盘清蒸鲈鱼，想家了", who: "zhanghan" }
    ]},
    { q: "你的下厨哲学更接近？", options: [
      { t: "食不厌精，火候刀工都要讲究", who: "yuanmei" },
      { t: "慢着火少着水，火候到了它自美", who: "sushi" },
      { t: "应时而食，地里什么熟吃什么", who: "jiasixie" },
      { t: "食药同源，吃进肚里要养人", who: "lishizhen" },
      { t: "想吃就吃，不高兴便罢了", who: "zhanghan" }
    ]},
    { q: "走在他乡，最戳你的味道是？", options: [
      { t: "家乡那道清鲜小菜", who: "yuanmei" },
      { t: "街边炭火的烟火气", who: "sushi" },
      { t: "娘蒸的馒头稠粥", who: "jiasixie" },
      { t: "一碗驱寒养生的汤", who: "lishizhen" },
      { t: "江南莼菜与鲈鱼脍", who: "zhanghan" }
    ]},
    { q: "对「健康饮食」，你的态度是？", options: [
      { t: "清淡就好，少油少腻", who: "yuanmei" },
      { t: "好吃就行，肥瘦随缘", who: "sushi" },
      { t: "粗茶淡饭最养人", who: "jiasixie" },
      { t: "性味时令最重要，对症而食", who: "lishizhen" },
      { t: "顺心最要紧，想吃什么吃什么", who: "zhanghan" }
    ]},
    { q: "若开一家小馆，你会开成？", options: [
      { t: "随园式私房菜，每日限定", who: "yuanmei" },
      { t: "东坡式大排档，热闹实惠", who: "sushi" },
      { t: "农家小院，时令家常", who: "jiasixie" },
      { t: "药膳坊，四季养生汤", who: "lishizhen" },
      { t: "水乡船菜，一席江南", who: "zhanghan" }
    ]},
    { q: "你最向往的生活状态？", options: [
      { t: "闲坐品茶，细味清欢", who: "yuanmei" },
      { t: "竹杖芒鞋，一蓑烟雨", who: "sushi" },
      { t: "晨兴理荒秽，带月荷锄归", who: "jiasixie" },
      { t: "调息养神，顺应四时", who: "lishizhen" },
      { t: "扁舟一叶，归隐江湖", who: "zhanghan" }
    ]}
  ];

  // —— 按作者聚合食谱 ——
  const byAuthor = {};
  KB.recipes.forEach((r) => { (byAuthor[r.author] = byAuthor[r.author] || []).push(r); });

  // —— 状态 ——
  let idx = 0;
  const scores = {}; Object.keys(FOODIES).forEach((k) => (scores[k] = 0));
  const picks = []; // {qIndex, who, qText}

  // —— DOM ——
  const $ = (s) => document.querySelector(s);
  const screens = { start: $("#quiz-start"), play: $("#quiz-play"), result: $("#quiz-result") };

  function show(name) {
    Object.values(screens).forEach((s) => (s.style.display = "none"));
    screens[name].style.display = "block";
    screens[name].scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function renderFigures() {
    const box = $("#quiz-figures");
    if (!box) return;
    box.innerHTML = Object.values(FOODIES).map((f) =>
      `<div class="q-fig"><div class="mini-seal">${f.seal}</div><small>${f.name}</small></div>`
    ).join("");
  }

  function renderQuestion() {
    const item = QUESTIONS[idx];
    $("#q-progress").textContent = `${idx + 1} / ${QUESTIONS.length}`;
    $("#q-bar").style.width = `${((idx + 1) / QUESTIONS.length) * 100}%`;
    $("#q-text").textContent = item.q;
    const opts = $("#q-options");
    opts.innerHTML = "";
    item.options.forEach((o) => {
      const b = document.createElement("button");
      b.className = "q-opt";
      b.textContent = o.t;
      b.addEventListener("click", () => choose(o.who, item.q, b));
      opts.appendChild(b);
    });
    $("#q-prev").style.visibility = idx === 0 ? "hidden" : "visible";
  }

  function choose(who, qText, btn) {
    // 若已选过本题，先撤销旧分
    if (picks[idx]) scores[picks[idx].who]--;
    picks[idx] = { qIndex: idx, who, qText };
    scores[who]++;
    [...$("#q-options").children].forEach((c) => c.classList.remove("chosen"));
    btn.classList.add("chosen");
    setTimeout(() => {
      if (idx < QUESTIONS.length - 1) { idx++; renderQuestion(); }
      else renderResult();
    }, 360);
  }

  function tally() {
    let best = null, bestScore = -1;
    PRIORITY.forEach((k) => {
      if (scores[k] > bestScore) { bestScore = scores[k]; best = k; }
    });
    return best;
  }

  function recommendRecipes(winner) {
    const list = byAuthor[winner.author] || [];
    return list.slice(0, 3).map((r) => {
      const mains = (r.core && r.core.length ? r.core : r.ingredients.slice(0, 2)).join("、");
      return { name: r.name, source: r.source, flavor: r.flavor, season: r.season, mains };
    });
  }

  function renderResult() {
    const key = tally();
    const f = FOODIES[key];
    const bondQ = picks.filter((p) => p.who === key).map((p) => `「${p.qText.replace(/\？$/, "")}」`);
    const bond = bondQ.length
      ? `你在${bondQ.join("、")}都与${f.name}想到一块去了。`
      : `你和${f.name}的气质，本就一脉相承。`;
    const recs = recommendRecipes(f);
    const recHTML = recs.map((r) => `
      <div class="rec-item">
        <div class="rec-info">
          <h4>${r.name}</h4>
          <small>《${r.source}》· ${r.flavor} · 宜${r.season}</small>
        </div>
        <a class="btn btn-mini rec-go" href="index.html?ing=${encodeURIComponent(r.mains)}">去复刻 →</a>
      </div>`).join("");

    $("#result-card").innerHTML = `
      <div class="result-seal">${f.seal}</div>
      <div class="result-name">${f.name}</div>
      <div class="result-title">${f.title}</div>
      <span class="tag tag-flavor" style="margin-top:8px;display:inline-block">${f.tag}</span>
      <p class="result-desc">${f.desc}</p>
      <p class="result-bond">${bond}</p>
      <h3 class="result-rec-title">为你推荐 ${f.name} 的食谱</h3>
      <div class="rec-list">${recHTML}</div>`;
    show("result");
  }

  function start() {
    idx = 0;
    Object.keys(scores).forEach((k) => (scores[k] = 0));
    picks.length = 0;
    renderQuestion();
    show("play");
  }

  function bind() {
    renderFigures();
    $("#quiz-begin").addEventListener("click", start);
    $("#quiz-retry").addEventListener("click", start);
    $("#q-prev").addEventListener("click", () => {
      if (idx > 0) { idx--; renderQuestion(); }
    });
  }

  document.addEventListener("DOMContentLoaded", bind);
})();
