/* 我的收藏页：读取 Favs，复用 RecipeCard 渲染卡片列表。 */
(function () {
  "use strict";

  function render() {
    var list = document.getElementById("fav-list");
    var empty = document.getElementById("fav-empty");
    if (!list || !empty) return;

    var recipes = window.Favs.getRecipes();
    list.innerHTML = "";

    if (!recipes.length) {
      list.style.display = "none";
      empty.style.display = "block";
      return;
    }
    list.style.display = "grid";
    empty.style.display = "none";

    recipes.forEach(function (r) {
      var card = window.RecipeCard.renderEl(r, { flip: true });
      list.appendChild(card);
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    if (!window.Favs || !window.RecipeCard) return;
    render();
    // 在收藏页内取消收藏时，列表即时重绘
    document.addEventListener("fav-changed", function () { render(); });
  });
})();
