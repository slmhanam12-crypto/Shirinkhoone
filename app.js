/* ============================================================
   شیرینی‌خونه – منطق اپ
   همه‌چیز روی خود گوشی کار می‌کند؛ سرور و اینترنتِ اجباری ندارد.
   ============================================================ */
"use strict";

/* ---------- ۱) ابزارهای کوچک ---------- */
const FAV_KEY = "shirinikhoone-favs";            // کلید ذخیره‌ی علاقه‌مندی‌ها
const view = document.getElementById("view");
let DB = null;                                    // همه‌ی داده‌ها بعد از بارگذاری اینجا می‌آیند
let navCount = 1;                                 // برای دکمه‌ی بازگشت

const fa = (n) => Number(n).toLocaleString("fa-IR", { useGrouping: false });
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
// نرمال‌سازی متن فارسی برای جستجو (ی و ک عربی، نیم‌فاصله و ...)
const norm = (s) => String(s).replace(/ي/g, "ی").replace(/ك/g, "ک").replace(/[\u200c\u200f]/g, "").replace(/\s+/g, " ").trim().toLowerCase();

/* آیکون‌های ساده (SVG داخلی؛ از اینترنت چیزی لود نمی‌شود) */
const IC = {
  search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></svg>',
  right: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg>',
  left: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5-7 7 7 7"/></svg>',
  heart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10Z"/></svg>',
  plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  minus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/></svg>',
  basket: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 10h17l-1.6 9.2a1.5 1.5 0 0 1-1.5 1.3H6.6a1.5 1.5 0 0 1-1.5-1.3L3.5 10ZM8 10l3-5.5M16 10l-3-5.5"/></svg>',
};

/* ---------- ۲) علاقه‌مندی‌ها (localStorage) ---------- */
let memFavs = [];                                 // اگر مرورگر ذخیره‌سازی را قبول نکرد
function getFavs() {
  try { return JSON.parse(localStorage.getItem(FAV_KEY)) || []; } catch (e) { return memFavs; }
}
function setFavs(list) {
  memFavs = list;
  try { localStorage.setItem(FAV_KEY, JSON.stringify(list)); } catch (e) { /* اشکالی ندارد */ }
}
function toggleFav(id) {
  const f = getFavs();
  const i = f.indexOf(id);
  if (i >= 0) f.splice(i, 1); else f.push(id);
  setFavs(f);
  return i < 0;                                   // true یعنی الان اضافه شد
}

/* ---------- ۳) بارگذاری داده‌ها ---------- */
async function loadData() {
  const get = async (p) => { const r = await fetch(p); if (!r.ok) throw new Error(p); return r.json(); };
  const [r, i, c, a, k] = await Promise.all([
    get("./data/recipes.json"), get("./data/ingredients.json"),
    get("./data/categories.json"), get("./data/app-info.json"), get("./data/kitchen.json"),
  ]);
  DB = {
    recipes: r.recipes, ingredients: i.ingredients, categories: c.categories, info: a, kitchen: k.sections,
    ingName: Object.fromEntries(i.ingredients.map((x) => [x.id, x.name])),
  };
}
const recipeById = (id) => DB.recipes.find((r) => r.id === id);

/* ---------- ۴) محاسبه‌ی مقدار مواد ---------- */
function fraction(n) {                             // ۰٫۵ → «نیم»
  const whole = Math.floor(n), frac = n - whole;
  const word = frac >= .74 ? "سه‌ربع" : frac >= .49 ? "نیم" : frac >= .24 ? "ربع" : "";
  if (!word) return fa(whole || 1);
  return whole ? fa(whole) + " و " + word : word;
}
function scaleAmount(ing, factor) {
  const base = ing.amount;
  if (ing.unit === "ریزه") return { text: fa(base), unit: ing.unit };
  let v = base * factor;
  if (ing.unit === "گرم" || ing.unit === "میلی‌لیتر") {
    v = v >= 20 ? Math.round(v / 5) * 5 : Math.max(1, Math.round(v));
    return { text: fa(v), unit: ing.unit };
  }
  if (ing.unit === "عدد") return { text: fa(Math.max(1, Math.round(v))), unit: ing.unit };
  v = Math.max(.25, Math.round(v * 4) / 4);          // قاشق‌ها: نزدیک‌ترین ربع
  return { text: fraction(v), unit: ing.unit };
}

/* ---------- ۵) قطعه‌های تکراری صفحه‌ها ---------- */
const backBtn = () => `<button class="back" data-back aria-label="بازگشت">${IC.right}</button>`;
const pageHead = (t) => `<div class="page-head">${backBtn()}<h1>${esc(t)}</h1></div>`;
const meta = (r) => {
  const t = [];
  t.push(r.difficulty);
  const total = (r.prepMinutes || 0) + (r.cookMinutes || 0);
  if (total) t.push(fa(total) + " دقیقه");
  return t.join(" | ");
};
const rowCard = (r, extra = "") => `
  <a class="row" href="#/recipe/${r.id}">
    <img src="./${r.image}" alt="" loading="lazy" width="92" height="78">
    <div class="t"><h3>${esc(r.title)}</h3><p>${esc(r.summary)}</p>${extra}</div>
    <span class="chev-wrap">${IC.left.replace("<svg", '<svg class="chev"')}</span>
  </a>`;
const emptyBox = (title, text, btn = true) => `
  <div class="empty"><b>${title}</b><p>${text}</p>${btn ? '<a class="btn" href="#/">برگرد به خانه</a>' : ""}</div>`;

/* ---------- ۶) صفحه‌ها ---------- */
let heroId = null;                                 // دستور تصویر شاخص؛ هر بار که اپ باز می‌شود تصادفی است

function pageHome() {
  if (!heroId) heroId = DB.recipes[Math.floor(Math.random() * DB.recipes.length)].id;
  const h = recipeById(heroId);
  const cats = DB.categories.map((c) => `
    <a class="cat" href="#/list/${c.id}">
      <img src="./${c.cover}" alt="" loading="lazy">
      <span class="lbl">${esc(c.title)}${IC.left.replace("<svg", "<svg")}</span>
    </a>`).join("");
  view.innerHTML = `<div class="page">
    <form class="search" role="search" id="home-search">
      ${IC.search}
      <input type="search" name="q" placeholder="جستجو در دستورهای پخت..." aria-label="جستجو" autocomplete="off">
    </form>
    <a class="hero" href="#/recipe/${h.id}">
      <img src="./${h.image}" alt="${esc(h.title)}">
      <div class="cap"><div><small>پیشنهاد امروز</small><h2>${esc(h.title)}</h2></div><span class="btn">مشاهده دستور</span></div>
    </a>
    <h2 class="sec-title">دسته‌بندی‌ها</h2>
    <div class="cats">${cats}</div>
    <a class="pick-btn" href="#/pick">${IC.basket}<span>بهم بگو چی تو آشپزخونه داری؟</span></a>
  </div>`;
  document.getElementById("home-search").addEventListener("submit", (e) => {
    e.preventDefault();
    const q = new FormData(e.target).get("q").trim();
    if (q) location.hash = "#/search/" + encodeURIComponent(q);
  });
}

/* فهرست یک دسته با ورق زدن افقی */
function pageList(catId) {
  const cat = DB.categories.find((c) => c.id === catId);
  if (!cat) return pageNotFound();
  const items = DB.recipes.filter((r) => r.category === catId);
  view.innerHTML = `<div class="page">
    ${pageHead(cat.title)}
    <div class="counter">
      <span class="num" id="cnt"></span>
      <div class="arrows">
        <button class="arrow" id="prev" aria-label="دستور قبلی">${IC.right}</button>
        <button class="arrow" id="next" aria-label="دستور بعدی">${IC.left}</button>
      </div>
    </div>
    <div class="snap" id="snap">${items.map((r) => `
      <a class="slide" href="#/recipe/${r.id}">
        <img src="./${r.image}" alt="${esc(r.title)}" loading="lazy">
        <div class="body"><h2>${esc(r.title)}</h2><p>${esc(r.summary)}</p><p>${meta(r)}</p></div>
      </a>`).join("")}</div>
  </div>`;
  const snap = document.getElementById("snap"), slides = [...snap.children];
  const cnt = document.getElementById("cnt"), prev = document.getElementById("prev"), next = document.getElementById("next");
  let cur = 0;
  const update = () => {
    const mid = snap.getBoundingClientRect().left + snap.clientWidth / 2;
    let best = 0, bd = 1e9;
    slides.forEach((s, i) => { const r = s.getBoundingClientRect(); const d = Math.abs(r.left + r.width / 2 - mid); if (d < bd) { bd = d; best = i; } });
    cur = best;
    cnt.textContent = fa(cur + 1) + " از " + fa(slides.length);
    prev.disabled = cur === 0; next.disabled = cur === slides.length - 1;
  };
  const go = (i) => {
    i = Math.max(0, Math.min(slides.length - 1, i));
    const s = slides[i];
    const left = s.offsetLeft - (snap.clientWidth - s.offsetWidth) / 2 - snap.offsetLeft;
    snap.scrollTo({ left, behavior: "smooth" });
  };
  let tick = false;
  snap.addEventListener("scroll", () => { if (!tick) { tick = true; requestAnimationFrame(() => { update(); tick = false; }); } }, { passive: true });
  prev.addEventListener("click", () => go(cur - 1));
  next.addEventListener("click", () => go(cur + 1));
  update();
}

/* جستجو */
function searchRecipes(q) {
  const n = norm(q);
  if (!n) return [];
  return DB.recipes.filter((r) => {
    const names = r.ingredients.map((i) => DB.ingName[i.ingredientId] || "").join(" ");
    return norm(r.title + " " + r.summary + " " + names).includes(n);
  });
}
function pageSearch(q) {
  view.innerHTML = `<div class="page">
    ${pageHead("جستجو")}
    <div class="search">${IC.search}<input type="search" id="q" value="${esc(q)}" placeholder="جستجو در دستورهای پخت..." aria-label="جستجو" autocomplete="off"></div>
    <h2 class="sec-title" id="res-title"></h2>
    <div class="list" id="res"></div>
  </div>`;
  const input = document.getElementById("q"), res = document.getElementById("res"), title = document.getElementById("res-title");
  const draw = () => {
    const v = input.value.trim();
    if (!v) { title.textContent = ""; res.innerHTML = emptyBox("چیزی بنویس", "نام کیک یا شیرینی یا یکی از موادش را بنویس.", false); return; }
    const found = searchRecipes(v);
    title.textContent = "نتیجه برای «" + v + "»";
    res.innerHTML = found.length ? found.map((r) => rowCard(r)).join("")
      : emptyBox("چیزی پیدا نشد", "نام را کوتاه‌تر بنویس یا از دسته‌بندی‌ها دستور را پیدا کن.");
  };
  input.addEventListener("input", draw);
  draw();
}

/* صفحه‌ی دستور پخت */
function pageRecipe(id) {
  const r = recipeById(id);
  if (!r) return pageNotFound();
  let servings = r.baseServings;
  const fav = getFavs().includes(r.id);
  const times = [];
  if (r.prepMinutes) times.push("آماده‌سازی " + fa(r.prepMinutes) + " دقیقه");
  if (r.cookMinutes) times.push("پخت " + fa(r.cookMinutes) + " دقیقه");
  if (r.extraTime) times.push(r.extraTime);
  view.innerHTML = `<div class="page">
    <div class="rhero">
      <img src="./${r.image}" alt="${esc(r.title)}">
      <span class="rback">${backBtn()}</span>
      <button class="heart" id="heart" aria-pressed="${fav}" aria-label="${fav ? "حذف از علاقه‌مندی‌ها" : "افزودن به علاقه‌مندی‌ها"}">${IC.heart}</button>
    </div>
    <h1 class="rtitle">${esc(r.title)}</h1>
    <div class="chips"><span class="chip">${esc(r.difficulty)}</span>${times.map((t) => `<span class="chip">${esc(t)}</span>`).join("")}</div>
    <div class="stepper">
      <b>تعداد نفرات</b>
      <div class="ctl">
        <button id="inc" aria-label="افزایش تعداد نفرات">${IC.plus}</button>
        <span class="n" id="sv"></span>
        <button id="dec" aria-label="کاهش تعداد نفرات">${IC.minus}</button>
      </div>
    </div>
    <p id="yield" class="chips"></p>
    <h2 class="sec-title">مواد لازم</h2>
    <div id="ings"></div>
    <h2 class="sec-title">مراحل پخت</h2>
    <ol class="steps">${r.steps.map((s, i) => `<li data-n="${fa(i + 1)}">${esc(s)}</li>`).join("")}</ol>
    <section class="secret">
      <h2>رازهای مهم پخت (فوت کوزه‌گری)</h2>
      <ul>${r.secrets.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>
    </section>
  </div>`;

  const draw = () => {
    const factor = servings / r.baseServings;
    document.getElementById("sv").textContent = fa(servings);
    document.getElementById("dec").disabled = servings <= 1;
    document.getElementById("inc").disabled = servings >= 40;
    const y = r.yield ? scaleAmount({ amount: r.yield.amount, unit: "عدد" }, factor) : null;
    document.getElementById("yield").innerHTML = y ? `<span class="chip">حدود ${y.text} ${esc(r.yield.unit)}</span>` : "";
    let html = "", group = null, open = false;
    r.ingredients.forEach((ing) => {
      const g = ing.group || "";
      if (g !== group || !open) {
        if (open) html += "</ul>";
        if (g) html += `<div class="ing-group">${esc(g)}</div>`;
        html += '<ul class="ings">'; open = true; group = g;
      }
      const a = scaleAmount(ing, factor);
      const note = [ing.note, ing.optional ? "اختیاری" : ""].filter(Boolean).join("، ");
      html += `<li><span>${esc(DB.ingName[ing.ingredientId] || ing.ingredientId)}${note ? ` <small>(${esc(note)})</small>` : ""}</span><span>${a.text} ${esc(a.unit)}</span></li>`;
    });
    document.getElementById("ings").innerHTML = html + (open ? "</ul>" : "");
  };
  document.getElementById("inc").addEventListener("click", () => { servings = Math.min(40, servings + 1); draw(); });
  document.getElementById("dec").addEventListener("click", () => { servings = Math.max(1, servings - 1); draw(); });
  const heart = document.getElementById("heart");
  heart.addEventListener("click", () => {
    const now = toggleFav(r.id);
    heart.setAttribute("aria-pressed", now);
    heart.setAttribute("aria-label", now ? "حذف از علاقه‌مندی‌ها" : "افزودن به علاقه‌مندی‌ها");
    heart.classList.remove("pop"); void heart.offsetWidth; heart.classList.add("pop");
  });
  draw();
}

/* علاقه‌مندی‌ها */
function pageFavs() {
  const favs = getFavs().map(recipeById).filter(Boolean);
  view.innerHTML = `<div class="page"><div class="page-head"><h1>علاقه‌مندی‌ها</h1></div>
    ${favs.length ? `<div class="list">${favs.map((r) => rowCard(r)).join("")}</div>`
      : emptyBox("هنوز چیزی ذخیره نکرده‌ای", "روی دستورها قلب را بزن تا اینجا جمع شوند.")}
  </div>`;
}

/* انتخاب مواد: آشپزخانه با چند بخش بازشونده */
const picked = new Set();
let openSection = null;                            // فقط یک بخش هر بار باز است
function pagePick() {
  view.innerHTML = `<div class="page">
    ${pageHead("بهم بگو چی تو آشپزخونه داری؟")}
    <p class="hint">روی هر عکس بزن تا باز شود و مواد موجودت را انتخاب کن.</p>
    <div class="search">${IC.search}<input type="search" id="ing-q" placeholder="جستجو در مواد..." aria-label="جستجو در مواد" autocomplete="off"></div>
    <div class="ing-found" id="ing-found" aria-live="polite" hidden></div>
    <div class="kitchen" id="kitchen"></div>
    <div class="selected-box" id="sel"></div>
    <div class="sticky-act"><button class="btn" id="go">نمایش پیشنهادها</button></div>
    <div class="results" id="out"></div>
  </div>`;
  const kitchen = document.getElementById("kitchen"), sel = document.getElementById("sel");
  const found = document.getElementById("ing-found"), q = document.getElementById("ing-q");
  const secs = DB.kitchen;
  const countOf = (s) => s.ingredients.filter((i) => picked.has(i)).length;
  const chipHtml = (id) => `<button class="pchip" data-id="${id}" aria-pressed="${picked.has(id)}">${esc(DB.ingName[id] || id)}</button>`;
  const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const drawSel = () => {
    sel.textContent = picked.size ? "انتخاب‌شده (" + fa(picked.size) + "): " + [...picked].map((i) => DB.ingName[i]).join("، ") : "هنوز ماده‌ای انتخاب نکرده‌ای.";
  };
  // نشان تعداد روی هر عکس
  const drawBadges = () => {
    kitchen.querySelectorAll(".tile").forEach((t) => {
      const n = countOf(secs.find((x) => x.id === t.dataset.sec));
      let b = t.querySelector(".badge");
      if (n) {
        if (!b) { b = document.createElement("span"); b.className = "badge"; t.querySelector(".pic").appendChild(b); }
        b.textContent = fa(n); b.setAttribute("aria-label", fa(n) + " ماده انتخاب شده");
      } else if (b) b.remove();
    });
  };
  const drawKitchen = (animate = true) => {
    let html = "";
    secs.forEach((s, i) => {
      const isOpen = openSection === s.id, n = countOf(s);
      html += `<button type="button" class="tile${isOpen ? " open" : ""}${i === secs.length - 1 && secs.length % 2 ? " wide" : ""}" data-sec="${s.id}" aria-expanded="${isOpen}">
        <span class="pic">${IC.basket}<img src="./${esc(s.image)}" alt="" width="800" height="800" loading="lazy">${n ? `<span class="badge" aria-label="${fa(n)} ماده انتخاب شده">${fa(n)}</span>` : ""}</span>
        <span class="tl">${esc(s.title)}</span>
      </button>`;
      // کشو را بعد از آخرین کارتِ همان ردیف می‌گذاریم تا پهنای کامل بگیرد
      const rowEnd = (i % 2 === 1) || i === secs.length - 1;
      if (rowEnd) {
        const o = secs.slice(i - (i % 2), i + 1).find((x) => x.id === openSection);
        if (o) html += `<div class="drawer${animate ? "" : " still"}" data-for="${o.id}"><div class="drawer-in"><div class="drawer-title">${esc(o.title)}</div><div class="chips-pick">${o.ingredients.map(chipHtml).join("")}</div></div></div>`;
      }
    });
    kitchen.innerHTML = html;
    // اگر عکسی نبود، جای‌گزین ساده نشان داده شود
    kitchen.querySelectorAll(".pic img").forEach((im) => {
      const fail = () => im.parentElement.classList.add("noimg");
      im.addEventListener("error", fail);
      if (im.complete && im.naturalWidth === 0) fail();
    });
  };
  // جستجو در همه‌ی مواد
  const drawFound = () => {
    const v = norm(q.value);
    if (!v) { found.hidden = true; found.innerHTML = ""; return; }
    const ids = secs.flatMap((s) => s.ingredients).filter((id) => norm(DB.ingName[id] || id).includes(v));
    found.hidden = false;
    found.innerHTML = ids.length ? `<div class="drawer-title">نتیجه‌ی جستجو</div><div class="chips-pick">${ids.map(chipHtml).join("")}</div>`
      : `<p class="none">ماده‌ای با این نام پیدا نشد.</p>`;
  };
  let closing = false;
  const toggleSection = (id) => {
    if (closing) return;
    const finish = () => { closing = false; drawKitchen(); const d = kitchen.querySelector(".drawer"); if (d) d.scrollIntoView({ block: "nearest", behavior: reduced() ? "auto" : "smooth" }); };
    if (openSection === id) {                       // لمس دوباره: بسته شود
      openSection = null;
      const d = kitchen.querySelector(".drawer");
      if (d && !reduced()) { closing = true; d.classList.add("closing"); setTimeout(finish, 240); } else finish();
    } else { openSection = id; finish(); }
  };
  q.addEventListener("input", drawFound);
  const onClick = (e) => {
    const chip = e.target.closest(".pchip");
    if (chip) {
      const id = chip.dataset.id;
      if (picked.has(id)) picked.delete(id); else picked.add(id);
      document.querySelectorAll('.pchip[data-id="' + id + '"]').forEach((c) => c.setAttribute("aria-pressed", picked.has(id)));
      drawBadges(); drawSel(); return;
    }
    const tile = e.target.closest(".tile");
    if (tile) toggleSection(tile.dataset.sec);
  };
  kitchen.addEventListener("click", onClick);
  found.addEventListener("click", onClick);
  document.getElementById("go").addEventListener("click", () => {
    const out = document.getElementById("out");
    if (!picked.size) { out.innerHTML = emptyBox("اول چند ماده انتخاب کن", "مواد موجود در خانه را بزن تا دستورهای مناسب را پیدا کنم.", false); return; }
    const ready = [], near = [];
    DB.recipes.forEach((r) => {
      const need = [...new Set(r.ingredients.filter((i) => !i.optional).map((i) => i.ingredientId))];
      const miss = need.filter((id) => !picked.has(id));
      if (!miss.length) ready.push(r); else if (miss.length <= 3) near.push({ r, miss });
    });
    near.sort((a, b) => a.miss.length - b.miss.length);
    let html = "";
    if (ready.length) html += `<h2>می‌توانی همین حالا بپزی</h2><div class="list">${ready.map((r) => rowCard(r)).join("")}</div>`;
    if (near.length) html += `<h2>نزدیک‌ترین‌ها</h2><div class="list">${near.map((x) =>
      rowCard(x.r, `<p class="miss">کم داری: ${x.miss.map((i) => esc(DB.ingName[i])).join("، ")}</p>`)).join("")}</div>`;
    if (!html) html = emptyBox("دستوری پیدا نشد", "با این مواد، دستوری نزدیک نیست. چند ماده‌ی دیگر هم انتخاب کن.", false);
    out.innerHTML = html;
    out.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  drawKitchen(false); drawSel();
}

/* درباره من */
function pageAbout() {
  const a = DB.info;
  const clean = (s) => String(s || "").trim().replace(/^@/, "");
  const tg = clean(a.telegram), ig = clean(a.instagram);
  view.innerHTML = `<div class="page about">
    <img src="./icons/icon-192.png" alt="" width="120" height="120">
    <h1>${esc(a.appName)}</h1>
    <p class="tag">${esc(a.tagline)}</p>
    <p class="intro">${esc(a.intro)}</p>
    <div class="maker">
      <p>سازنده</p><b>${esc(a.makerName)}</b>
      ${(tg || ig) ? `<div class="links">
        ${tg ? `<a class="btn" href="https://t.me/${encodeURIComponent(tg)}" target="_blank" rel="noopener">تلگرام: @${esc(tg)}</a>` : ""}
        ${ig ? `<a class="btn" href="https://instagram.com/${encodeURIComponent(ig)}" target="_blank" rel="noopener">اینستاگرام: @${esc(ig)}</a>` : ""}
      </div>` : ""}
    </div>
  </div>`;
}

function pageNotFound() {
  view.innerHTML = `<div class="page">${emptyBox("این صفحه پیدا نشد", "ممکن است لینک قدیمی باشد.")}</div>`;
}

/* ---------- ۷) مسیریابی ---------- */
function route() {
  if (!DB) return;
  const parts = decodeURIComponent(location.hash.replace(/^#\/?/, "")).split("/");
  const [name, arg] = [parts[0], parts.slice(1).join("/")];
  let active = "home";
  if (name === "favorites") { pageFavs(); active = "favorites"; }
  else if (name === "about") { pageAbout(); active = "about"; }
  else if (name === "list") pageList(arg);
  else if (name === "recipe") pageRecipe(arg);
  else if (name === "search") pageSearch(arg);
  else if (name === "pick") pagePick();
  else pageHome();
  document.querySelectorAll(".bottom a").forEach((a) => a.classList.toggle("active", a.dataset.nav === active));
  window.scrollTo(0, 0);
}
window.addEventListener("hashchange", () => { navCount++; route(); });
document.addEventListener("click", (e) => {
  if (e.target.closest("[data-back]")) { e.preventDefault(); if (navCount > 1) { navCount -= 2; history.back(); } else location.hash = "#/"; }
});

/* ---------- ۸) شروع اپ ---------- */
async function start() {
  try {
    await loadData();
    route();
  } catch (e) {
    view.innerHTML = `<div class="page">${emptyBox("اپ باز نشد", "اینترنت را وصل کن و دوباره امتحان کن. بعد از اولین بازشدن موفق، اپ بدون اینترنت هم کار می‌کند.", false)}
      <p style="text-align:center;margin-top:14px"><button class="btn" onclick="location.reload()">تلاش دوباره</button></p></div>`;
  }
}
start();

/* ---------- ۹) آفلاین‌شدن و به‌روزرسانی (Service Worker) ---------- */
if ("serviceWorker" in navigator) {
  let userAsked = false;                          // فقط وقتی کاربر دکمه را زد صفحه دوباره بارگذاری شود
  const bar = document.getElementById("update-bar");
  const showBar = (worker) => {
    bar.hidden = false;
    document.getElementById("update-btn").onclick = () => { userAsked = true; worker.postMessage({ type: "SKIP_WAITING" }); };
  };
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").then((reg) => {
      if (reg.waiting && navigator.serviceWorker.controller) showBar(reg.waiting);
      reg.addEventListener("updatefound", () => {
        const w = reg.installing;
        w && w.addEventListener("statechange", () => {
          if (w.state === "installed" && navigator.serviceWorker.controller) showBar(w);
        });
      });
    }).catch(() => { /* ثبت نشد؛ اپ همچنان با اینترنت کار می‌کند */ });
  });
  navigator.serviceWorker.addEventListener("controllerchange", () => { if (userAsked) location.reload(); });
}
