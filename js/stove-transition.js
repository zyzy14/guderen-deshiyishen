/* 灶台过场：烧灶火 → 掀盖 → 起锅。
   点击「为我备席」后浮现全屏灶台：灶火由暗燃起、摇曳升腾；鼎盖掀开、热气升腾；
   釜身微抬泛暖光，朱印「食」落定，暖光如刷痕般晕开，揭开今夜食单。
   风格呼应《明日方舟·相见欢》暖色灯笼 / 水墨圆窗。
   降级：reduced-motion 或脚本缺失时，直接返回结果，不阻塞主流程。 */
(function () {
  "use strict";
  var reduce = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  var SCENE = [
    '<div class="stove-halo"></div>',
    '<div class="stove-lantern stove-lantern-l"></div>',
    '<div class="stove-lantern stove-lantern-r"></div>',
    '<div class="stove-scene">',
    '<svg viewBox="0 0 360 360" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">',
    '  <defs>',
    '    <linearGradient id="stStone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a3a2a"/><stop offset="1" stop-color="#2a1d12"/></linearGradient>',
    '    <radialGradient id="stEmber" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="rgba(255,184,96,.95)"/><stop offset="55%" stop-color="rgba(224,130,62,.45)"/><stop offset="100%" stop-color="rgba(224,130,62,0)"/></radialGradient>',
    '    <linearGradient id="stFlameOut" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#c8473c"/><stop offset="1" stop-color="#e0823e"/></linearGradient>',
    '    <linearGradient id="stFlameMid" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#e0823e"/><stop offset="1" stop-color="#f0a44a"/></linearGradient>',
    '    <linearGradient id="stFlameCore" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ffd06a"/><stop offset="1" stop-color="#ffe6a8"/></linearGradient>',
    '    <linearGradient id="stPot" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6b4a2e"/><stop offset="1" stop-color="#36240f"/></linearGradient>',
    '    <linearGradient id="stLid" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7a5636"/><stop offset="1" stop-color="#46301d"/></linearGradient>',
    '    <linearGradient id="stSteam" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="rgba(255,240,210,0)"/><stop offset="50%" stop-color="rgba(255,240,210,.85)"/><stop offset="100%" stop-color="rgba(255,240,210,0)"/></linearGradient>',
    '  </defs>',
    '  <g class="st-hearth">',
    '    <rect x="56" y="288" width="248" height="58" rx="16" fill="url(#stStone)"/>',
    '    <ellipse cx="180" cy="292" rx="80" ry="18" fill="#160f09"/>',
    '    <ellipse cx="180" cy="290" rx="72" ry="14" fill="#0c0805"/>',
    '  </g>',
    '  <g class="st-fire">',
    '    <circle class="st-ember-glow" cx="180" cy="280" r="48" fill="url(#stEmber)"/>',
    '    <path class="st-flame f1" d="M180,286 C150,256 166,222 180,202 C194,222 210,256 180,286 Z" fill="url(#stFlameOut)"/>',
    '    <path class="st-flame f2" d="M180,284 C162,260 170,234 180,218 C190,234 198,260 180,284 Z" fill="url(#stFlameMid)"/>',
    '    <path class="st-flame f3" d="M180,282 C168,264 172,244 180,232 C188,244 192,264 180,282 Z" fill="url(#stFlameCore)"/>',
    '  </g>',
    '  <g class="st-pot-grp">',
    '    <path d="M114,240 A66,42 0 0 0 246,240 Z" fill="url(#stPot)" stroke="#2e2014" stroke-width="2"/>',
    '    <path d="M126,262 Q180,284 234,262" fill="none" stroke="rgba(255,210,150,.25)" stroke-width="3" stroke-linecap="round"/>',
    '    <ellipse cx="180" cy="240" rx="66" ry="14" fill="#241910" stroke="#46301d" stroke-width="2"/>',
    '    <ellipse cx="180" cy="238" rx="54" ry="10" fill="#160f09"/>',
    '    <path d="M114,242 q-18,3 -18,17 q0,11 13,11" fill="none" stroke="#46301d" stroke-width="5" stroke-linecap="round"/>',
    '    <path d="M246,242 q18,3 18,17 q0,11 -13,11" fill="none" stroke="#46301d" stroke-width="5" stroke-linecap="round"/>',
    '  </g>',
    '  <g class="st-lid-grp">',
    '    <path d="M120,240 Q180,182 240,240 Z" fill="url(#stLid)" stroke="#46301d" stroke-width="2"/>',
    '    <path d="M132,232 Q180,196 228,232" fill="none" stroke="rgba(255,210,150,.22)" stroke-width="2.5" stroke-linecap="round"/>',
    '    <ellipse cx="180" cy="240" rx="60" ry="10" fill="#160f09" opacity=".45"/>',
    '    <circle cx="180" cy="184" r="7.5" fill="#5a4128" stroke="#2e2014" stroke-width="1.5"/>',
    '  </g>',
    '  <g class="st-steam">',
    '    <path d="M168,182 q-14,-20 2,-38 q14,-16 0,-34" fill="none" stroke="url(#stSteam)" stroke-width="6" stroke-linecap="round"/>',
    '    <path d="M192,182 q14,-20 -2,-38 q-14,-16 0,-34" fill="none" stroke="url(#stSteam)" stroke-width="6" stroke-linecap="round"/>',
    '  </g>',
    '</svg>',
    '</div>',
    '<div class="stove-caption">灶上忙碌中，古法正在为您温锅备席……</div>',
    '<div class="stove-wipe"></div>',
    '<div class="stove-end-seal">食</div>'
  ].join("");

  var overlay = null, root = null, timers = [];
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }
  function later(fn, ms) { var t = setTimeout(fn, ms); timers.push(t); return t; }

  function build() {
    var ov = document.createElement("div");
    ov.className = "stove-transition";
    ov.setAttribute("aria-hidden", "true");
    ov.innerHTML = SCENE;
    document.body.appendChild(ov);
    return ov;
  }

  function show() {
    clearTimers();
    if (!overlay) overlay = build();
    root = overlay;
    overlay.classList.remove("st-show", "st-lid", "st-pot", "st-wipe");
    overlay.style.display = "flex";
    void overlay.offsetWidth; // 强制回流，确保过渡生效
    overlay.classList.add("st-show");
  }

  function hide() {
    clearTimers();
    if (!overlay) return;
    overlay.classList.remove("st-show");
    later(function () {
      if (overlay) {
        overlay.style.display = "none";
        overlay.classList.remove("st-lid", "st-pot", "st-wipe");
      }
    }, 520);
  }

  /* play(readyPromise, onReveal)
     - readyPromise：数据就绪（fetch / 本地匹配），Promise<{narratives,notes}>
     - onReveal(data)：在「起锅」暖光晕开时调用，用于渲染结果（此时结果已在底层备好）
     - 返回 Promise，于过场淡出后 resolve(data) */
  function play(ready, onReveal) {
    if (!ready || typeof ready.then !== "function") {
      if (onReveal) onReveal(ready);
      return Promise.resolve(ready);
    }
    if (reduce) {
      return ready.then(function (d) { if (onReveal) onReveal(d); return d; });
    }
    show();
    var t0 = Date.now();
    return ready.then(function (data) {
      var wait = Math.max(0, 820 - (Date.now() - t0)); // 最小灶火时间，让「烧灶火」可读
      return new Promise(function (res) {
        later(function () {
          root.classList.add("st-lid");                 // 掀盖
          later(function () {
            root.classList.add("st-pot");               // 起锅
            later(function () {
              root.classList.add("st-wipe");            // 暖光晕开 + 朱印落定
              if (onReveal) onReveal(data);
              later(function () {
                hide();
                res(data);
              }, 460);
            }, 470);
          }, 470);
        }, wait);
      });
    }).catch(function (err) {
      hide();
      if (onReveal) onReveal(undefined);
      return Promise.reject(err);
    });
  }

  window.StoveTransition = { play: play, show: show, hide: hide };
})();
