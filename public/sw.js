/**
 * INSIGHT PWA Service Worker
 * Cache básico para app shell, fontes e assets estáticos.
 */

const CACHE_NAME = "insight-pwa-v3-camera-video";
const ASSETS_TO_CACHE = [
  "/",
  "/library",
  "/folders",
  "/settings",
  "/translate",
  "/manifest.json",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch(() => {});
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // Ignora requisições de API e métodos não-GET para não interferir na comunicação com o backend
  if (
    event.request.method !== "GET" ||
    event.request.url.includes("/ia/") ||
    event.request.url.includes("/conteudo/") ||
    event.request.url.includes("/materias") ||
    event.request.url.includes("/pastas") ||
    event.request.url.includes("/videos") ||
    event.request.url.includes("/v1/") ||
    event.request.url.includes("/libras/")
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (
          networkResponse &&
          networkResponse.status === 200 &&
          networkResponse.type === "basic"
        ) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone).catch(() => {});
          });
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          if (event.request.mode === "navigate") {
            return caches.match("/");
          }
          return new Response("Offline", { status: 503, statusText: "Offline" });
        });
      })
  );
});
