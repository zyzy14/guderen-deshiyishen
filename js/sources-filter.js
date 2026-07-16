/* 古籍页检索/筛选：搜索框 + 典籍·文人芯片，实时过滤卡片与时间轴。
   过滤目标：.src-card, .person, .tl-row（按 data-src/data-author）；
   小笺（.xj-card）：仅受搜索文本影响。 */
(function () {
  "use strict";

  var FILTERABLES = ".src-card,.person,.tl-row";
  var SEARCH_TARGETS = ".src-card,.person,.tl-row,.xj-card";

  function getActive() {
    var btn = document.querySelector(".src-chips .chip.active");
    return btn ? btn.getAttribute("data-f") || "all" : "all";
  }
  function getQuery() {
    var el = document.querySelector(".src-search");
    return el ? el.value.trim().toLowerCase() : "";
  }

  // 判断一个元素是否匹配当前筛选条件
  function matches(el, f, q) {
    if (f !== "all") {
      var hasSrc = el.getAttribute("data-src") === f;
      var hasAuth = el.getAttribute("data-author") === f;
      if (!hasSrc && !hasAuth) return false;
    }
    if (!q) return true;
    // 搜索文本：在元素文本内容中查找（忽略大小写）
    return (el.textContent || "").toLowerCase().indexOf(q) >= 0;
  }

  function apply() {
    var f = getActive();
    var q = getQuery();
    document.querySelectorAll(FILTERABLES).forEach(function (el) {
      if (matches(el, f, q)) {
        el.style.display = "";
        // 清除动画隐藏状态（若尚未入场）
        el.style.opacity = "1";
        el.style.transform = "none";
        el.classList.add("in-view");
      } else {
        el.style.display = "none";
      }
    });
    // 小笺仅受搜索影响
    document.querySelectorAll(".xj-card").forEach(function (el) {
      if (!q || (el.textContent || "").toLowerCase().indexOf(q) >= 0) {
        el.style.display = "";
        el.style.opacity = "1"; el.style.transform = "none";
        el.classList.add("in-view");
      } else {
        el.style.display = "none";
      }
    });

    // 空结果提示（可选：暂不加，保持简洁）
  }

  function init() {
    var searchEl = document.querySelector(".src-search");
    var chips = document.querySelectorAll(".src-chips .chip");

    // 芯片点击
    Array.prototype.forEach.call(chips, function (c) {
      c.addEventListener("click", function () {
        chips.forEach(function (x) { x.classList.remove("active"); });
        c.classList.add("active");
        apply();
      });
    });

    // 搜索框输入（防抖 220ms）
    if (searchEl) {
      var timer = null;
      searchEl.addEventListener("input", function () {
        clearTimeout(timer);
        timer = setTimeout(apply, 220);
      });
    }

    // 初始应用（若有 URL 参数 ?q=xxx 则自动填入并过滤）
    var qp = new URLSearchParams(location.search).get("q");
    if (qp && searchEl) { searchEl.value = decodeURIComponent(qp); apply(); }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
