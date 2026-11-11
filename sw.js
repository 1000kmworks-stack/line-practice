// オフラインでも開けるようにするための小さなプログラム。
// 基本はネットから最新を取りにいって、つながらないときだけ前に保存したものを使う。
var CACHE = "line-practice-v2";
var FILES = [
  "./", "./index.html", "./data.js", "./demo.js", "./app.js", "./manifest.json",
  "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png"
];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FILES); }));
  self.skipWaiting();
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    // ブラウザの古い控えを使わず、毎回サーバーに「新しくなってない?」と聞く
    fetch(req, { cache: "no-cache" }).then(function (res) {
      var copy = res.clone();
      caches.open(CACHE).then(function (c) { c.put(req, copy); });
      return res;
    }).catch(function () { return caches.match(req).then(function (r) { return r || caches.match("./index.html"); }); })
  );
});
