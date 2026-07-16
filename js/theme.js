/* 夜灯·深色模式：暖木底 + 灶火辉光（不冷调）。
   早期设置 data-theme 避免闪烁；浮动「夜灯」按钮切换并持久化；跨标签页同步。 */
(function () {
  "use strict";
  var KEY = "guren_theme";
  var root = document.documentElement;

  function apply(t) {
    if (t === "night") root.setAttribute("data-theme", "night");
    else root.setAttribute("data-theme", "day");
    var btn = document.getElementById("theme-toggle");
    if (btn) btn.textContent = (root.getAttribute("data-theme") === "night") ? "日" : "夜";
  }
  function saved() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }

  // 初始：已存则用之；否则跟随系统深色偏好
  var t = saved();
  if (!t) {
    try { if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) t = "night"; } catch (e) {}
  }
  if (t !== "night") t = "day";
  apply(t);

  // 浮动「夜灯」按钮
  function mount() {
    if (document.getElementById("theme-toggle")) return;
    var b = document.createElement("button");
    b.id = "theme-toggle";
    b.className = "theme-toggle";
    b.type = "button";
    b.title = "切换 夜灯 / 日灯";
    b.textContent = (root.getAttribute("data-theme") === "night") ? "日" : "夜";
    b.addEventListener("click", function () {
      var cur = root.getAttribute("data-theme") === "night" ? "night" : "day";
      var nx = cur === "night" ? "day" : "night";
      apply(nx);
      try { localStorage.setItem(KEY, nx); } catch (e) {}
      document.dispatchEvent(new CustomEvent("theme-changed", { detail: { theme: nx } }));
    });
    document.body.appendChild(b);
  }

  if (document.body) mount();
  else document.addEventListener("DOMContentLoaded", mount);

  // 跨标签页同步
  window.addEventListener("storage", function (e) {
    if (e.key === KEY) apply((e.newValue === "night") ? "night" : "day");
  });
})();
