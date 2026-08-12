// Enkel offline-cache så appen öppnas även utan nät.
// Höj CACHE_VERSION när filerna ändras rejält och gamla cachar ska rensas.
var CACHE_VERSION = "franco-laxor-v1";

var CORE_FILES = [
  "./",
  "./index.html",
  "./manifest.json",
  "./assets/engine.css",
  "./assets/engine.js",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(function (cache) {
      return cache.addAll(CORE_FILES);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (key) { return key !== CACHE_VERSION; }).map(function (key) { return caches.delete(key); })
      );
    })
  );
  self.clients.claim();
});

// Nätet först (så nya/ändrade läxor syns direkt), cache som fallback offline.
self.addEventListener("fetch", function (event) {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request)
      .then(function (response) {
        var copy = response.clone();
        caches.open(CACHE_VERSION).then(function (cache) { cache.put(event.request, copy); });
        return response;
      })
      .catch(function () { return caches.match(event.request); })
  );
});
