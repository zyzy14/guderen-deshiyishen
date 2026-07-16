/* 动效系统：滚动入场缓展 + 页面幕帷转场。
   设计调性：宣纸铺展、墨色渐沉 —— 质朴·烟火气·古色。
   降级：JS 失效或用户偏好 reduced-motion 时，不隐藏任何内容。 */
(function () {
  "use strict";
  var reduce = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  /* ========== 一、滚动入场缓展 ========== */
  if (!reduce) {
    // 需要逐段/逐卡淡入上移的元素选择器
    var groups = [
      ".hero > *", ".cover > *",
      ".section-title", ".lead", ".body", ".epigraph",
      ".audience-card", ".feature-card", ".tech-card",
      ".src-page .src-card", ".src-page .person",
      ".src-page .xj-card", ".src-page .tl-row",
      ".chip", ".rec-item", ".step"
    ];
    var targets = [];
    groups.forEach(function (sel) {
      var els = document.querySelectorAll(sel);
      Array.prototype.forEach.call(els, function (el) {
        var parent = el.parentNode;
        var idx = Array.prototype.indexOf.call(parent ? parent.children : [], el);
        el._d = (idx >= 0 ? idx : 0) * 0.07; // 同组错落延迟
        targets.push(el);
      });
    });

    if ("IntersectionObserver" in window && targets.length) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          var el = en.target;
          el.style.transition =
            "opacity .72s cubic-bezier(.22,.61,.36,1), transform .72s cubic-bezier(.22,.61,.36,1)";
          el.style.transitionDelay = (el._d || 0) + "s";
          el.style.opacity = "1";
          el.style.transform = "none";
          el.classList.add("in-view");
          io.unobserve(el);
        });
      }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });

      // 先以同步内联样式置为隐藏态（在浏览器首帧绘制前完成，避免闪烁）
      targets.forEach(function (el) {
        el.style.opacity = "0";
        el.style.transform = "translateY(22px)";
        io.observe(el);
      });
    }
  }

  /* ========== 二、页面幕帷转场 ========== */
  var veil = document.querySelector(".page-veil");
  if (veil && !reduce) {
    var stamp = veil.querySelector(".veil-seal");
    var marks = ["食", "夜", "味", "古", "膳"];
    var busy = false;

    document.addEventListener("click", function (e) {
      if (busy) return;
      var a = e.target && e.target.closest ? e.target.closest("a") : null;
      if (!a) return;
      var href = a.getAttribute("href");
      if (!href || href.charAt(0) === "#" || a.target === "_blank" || a.hasAttribute("download")) return;
      var url;
      try { url = new URL(a.href, location.href); } catch (_) { return; }
      if (url.origin !== location.origin) return; // 仅站内跳转走帷幕

      e.preventDefault();
      busy = true;
      if (stamp) stamp.textContent = marks[Math.floor(Math.random() * marks.length)];
      veil.classList.add("show");
      try { sessionStorage.setItem("veil", "1"); } catch (_) {}
      setTimeout(function () { location.href = a.href; }, 430);
    });

    // 新页面加载：若由帷幕转场而来，先显示帷幕再缓缓揭开
    window.addEventListener("load", function () {
      try {
        if (sessionStorage.getItem("veil") === "1") {
          sessionStorage.removeItem("veil");
          veil.classList.add("show", "instant"); // 立即铺满
          requestAnimationFrame(function () {
            requestAnimationFrame(function () {
              veil.classList.remove("instant", "show"); // 过渡揭开
            });
          });
        }
      } catch (_) {}
    });
  }
})();
