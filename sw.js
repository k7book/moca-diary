// 오프라인 열람용 서비스 워커: 앱 껍데기만 캐시하고, 데이터 요청(Supabase)은 캐시하지 않는다.
const CACHE = "moca-shell-v1";
const SHELL = ["./", "./index.html", "./css/app.css", "./js/config.js", "./js/data.js", "./js/app.js", "./manifest.webmanifest", "./icons/icon.svg"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  if (url.origin !== location.origin) return; // CDN·Supabase는 네트워크 그대로
  e.respondWith(
    fetch(e.request).then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return res; })
      .catch(() => caches.match(e.request).then((r) => r || caches.match("./index.html")))
  );
});
