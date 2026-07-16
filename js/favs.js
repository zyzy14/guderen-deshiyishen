/* 收藏模块：基于 localStorage 的食谱收藏（离线可用）。
   暴露 window.Favs；自动同步导航上的收藏计数徽标，并广播 fav-changed 事件。 */
(function () {
  "use strict";
  var KEY = "guren_favs_v1";

  function read() {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; }
    catch (e) { return []; }
  }
  function write(arr) {
    try { localStorage.setItem(KEY, JSON.stringify(arr)); } catch (e) {}
  }

  var Favs = {
    list: function () { return read(); },
    has: function (id) { return read().indexOf(id) >= 0; },
    count: function () { return read().length; },
    toggle: function (id) {
      var a = read(), i = a.indexOf(id), on;
      if (i >= 0) { a.splice(i, 1); on = false; }
      else { a.push(id); on = true; }
      write(a);
      syncBadges();
      return on;
    },
    getRecipes: function () {
      var ids = read();
      var all = (window.KB && window.KB.recipes) || [];
      return ids
        .map(function (id) { return all.filter(function (r) { return r.id === id; })[0]; })
        .filter(Boolean);
    }
  };

  // 同步所有带 data-fav-count 的导航文字（如「我的收藏 (3)」）
  function syncBadges() {
    var n = Favs.count();
    var els = document.querySelectorAll("[data-fav-count]");
    Array.prototype.forEach.call(els, function (el) {
      el.textContent = n ? "我的收藏 (" + n + ")" : "我的收藏";
    });
  }

  window.Favs = Favs;
  window.addEventListener("storage", function (e) { if (e.key === KEY) syncBadges(); });
  document.addEventListener("DOMContentLoaded", syncBadges);
  window.addEventListener("load", syncBadges);
})();
