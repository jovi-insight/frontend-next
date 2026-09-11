/**
 * INSIGHT PWA Service Worker
 * Cache básico para app shell, fontes e assets estáticos.
 */

const CACHE_NAME = "insight-pwa-v17-biblioteca-lembretes";
const IMAGE_CACHE_NAME = "insight-images-v2";
const VALID_CACHE_NAMES = new Set([CACHE_NAME, IMAGE_CACHE_NAME]);
const ASSETS_TO_CACHE = [
  "/",
  "/library",
  "/folders",
  "/settings",
  "/calendar",
  "/libras-training",
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
          if (!VALID_CACHE_NAMES.has(key)) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // OCR versionado: cache-first evita baixar o motor/modelo a cada ativação.
  const url = new URL(event.request.url);
  if (event.request.method === "GET" && url.origin === self.location.origin && url.pathname.startsWith("/vendor/math-ocr/7.0.0/")) {
    event.respondWith(caches.open(CACHE_NAME).then(async (cache) => {
      const salvo = await cache.match(event.request);
      if (salvo) return salvo;
      const resposta = await fetch(event.request);
      if (resposta.ok) await cache.put(event.request, resposta.clone());
      return resposta;
    }));
    return;
  }
  if (event.request.method === "GET" && event.request.destination === "image") {
    // Cache-first com prazo: voltar à galeria não baixa cada foto novamente.
    event.respondWith((async () => {
      const cache = await caches.open(IMAGE_CACHE_NAME);
      const salvo = await cache.match(event.request);
      const data = salvo?.headers.get("x-insight-cache-em");
      if (salvo && data && Date.now() - Number(data) < 86400000) return salvo;
      const resposta = await fetch(event.request);
      const pequena = url.pathname.endsWith("/miniatura") || url.pathname.endsWith(".thumb-v1.webp") || url.origin === self.location.origin;
      if (resposta.ok && resposta.type !== "opaque" && pequena) {
        const headers = new Headers(resposta.headers);
        headers.set("x-insight-cache-em", String(Date.now()));
        const copia = new Response(await resposta.clone().blob(), { status: resposta.status, headers });
        await cache.put(event.request, copia).catch(() => {});
        const chaves = await cache.keys();
        await Promise.all(chaves.slice(0, Math.max(0, chaves.length - 80)).map(chave => cache.delete(chave)));
      }
      return resposta;
    })());
    return;
  }

  // Ignora requisições de API e métodos não-GET para não interferir na comunicação com o backend
  if (
    event.request.method !== "GET" ||
    event.request.url.includes("/ia/") ||
    event.request.url.includes("/matematica/") ||
    event.request.url.includes("/conteudo/") ||
    event.request.url.includes("/materias") ||
    event.request.url.includes("/pastas") ||
    event.request.url.includes("/videos") ||
    event.request.url.includes("/calendario/") ||
    event.request.url.includes("/dashboard/") ||
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

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destino = event.notification.data?.url || "/calendar";
  const candidata = new URL(destino, self.location.origin);
  const url = candidata.origin === self.location.origin ? candidata.href : self.location.origin + "/calendar";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((janelas) => {
      const existente = janelas.find((janela) => janela.url.startsWith(self.location.origin));
      if (existente) {
        return existente.navigate(url).then((janela) => janela?.focus());
      }
      return self.clients.openWindow(url);
    }),
  );
});

self.addEventListener("push", (event) => {
  let dados = {};
  try { dados = event.data?.json() || {}; } catch { /* Payload vazio ainda produz aviso visível. */ }
  event.waitUntil(self.registration.showNotification(String(dados.titulo || "Lembrete do INSIGHT"), {
    body: String(dados.corpo || "Confira seu calendário de estudos."),
    icon: "/icons/icon-192x192.png", badge: "/icons/icon-192x192.png",
    tag: String(dados.tag || "calendario"),
    data: { url: typeof dados.url === "string" && /^\/calendar(?:\/|$)/.test(dados.url) ? dados.url : "/calendar" },
  }));
});
