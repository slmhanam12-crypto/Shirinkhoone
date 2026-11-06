/* ============================================================
   شیرینی‌خونه – Service Worker (کار کردن بدون اینترنت)

   مهم: هر وقت هر فایلی از اپ را عوض کردی (کد، عکس، فونت، آیکون)،
   عدد CACHE_VERSION را بالا ببر (مثلاً v2). همین باعث می‌شود
   نسخه‌ی جدید روی گوشی کاربرها نصب شود و نوار
   «نسخه‌ی جدید آماده است» نشان داده شود.
   ============================================================ */
const CACHE_VERSION = "v3";
const CACHE_NAME = "shirinikhoone-" + CACHE_VERSION;

const FILES = [
  "./", "./index.html", "./style.css", "./app.js", "./manifest.json",
  "./data/recipes.json", "./data/ingredients.json", "./data/categories.json", "./data/app-info.json", "./data/kitchen.json",
  "./fonts/Vazir-Medium.ttf", "./fonts/Vazir-Bold.ttf",
  "./icons/icon-192.png", "./icons/icon-512.png", "./icons/icon-maskable-512.png", "./icons/apple-touch-icon.png",
  "./images/chocolate-cake.webp", "./images/red-velvet.webp", "./images/carrot-walnut-cake.webp",
  "./images/apple-pie.webp", "./images/tiramisu-cake.webp", "./images/chickpea-cookie.webp",
  "./images/raisin-cookie.webp", "./images/danish-pastry.webp", "./images/coconut-cookie.webp",
  "./images/date-cookie.webp",
  // عکس‌های آشپزخانه
  "./images/kitchen/fridge.webp", "./images/kitchen/flour-shelf.webp", "./images/kitchen/nuts-cabinet.webp",
  "./images/kitchen/spice-drawer.webp", "./images/kitchen/fruit-basket.webp"
];

// نصب: همه‌ی فایل‌ها را در حافظه‌ی گوشی ذخیره می‌کند
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(FILES.map((u) => cache.add(new Request(u, { cache: "reload" }))))
    )
  );
});

// فعال‌سازی: کش‌های نسخه‌های قدیمی را پاک می‌کند
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("shirinikhoone-") && k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// وقتی کاربر دکمه‌ی «به‌روزرسانی» را زد
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  // داده‌های دستورها: اول اینترنت (تا تغییرات زود برسد)، اگر نبود از حافظه
  if (url.pathname.includes("/data/")) {
    event.respondWith(
      Promise.race([
        fetch(req),
        new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 5000))
      ]).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put(req, copy));
        return res;
      }).catch(() => caches.match(req))
    );
    return;
  }

  // بقیه: اول حافظه، بعد اینترنت
  event.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).catch(() => {
      if (req.mode === "navigate") return caches.match("./index.html");
    }))
  );
});
