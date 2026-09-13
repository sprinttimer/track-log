const CACHE_NAME = "track-log-v2.3.0-20260913-r4";
const PRECACHE = [
  "./","./index.html","./styles.css?v=230","./db.js?v=230","./coach.js?v=230","./app.js?v=230",
  "./manifest.webmanifest?v=230",
  "./icons/favicon-32-v230.png","./icons/favicon-48-v230.png","./icons/apple-touch-icon-v230.png",
  "./icons/icon-192-v230.png","./icons/icon-512-v230.png","./icons/maskable-192-v230.png","./icons/maskable-512-v230.png"
];
self.addEventListener("install", event => {
  event.waitUntil((async()=>{
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(PRECACHE.map(x => new Request(x,{cache:"reload"})));
    await self.skipWaiting();
  })());
});
self.addEventListener("activate", event => {
  event.waitUntil((async()=>{
    for (const key of await caches.keys()) if (key !== CACHE_NAME) await caches.delete(key);
    await self.clients.claim();
  })());
});
async function networkFirst(request){
  const url = new URL(request.url);
  try{
    const fresh = await fetch(request,{cache:"no-store"});
    if (fresh && fresh.ok && !url.pathname.endsWith("/version.json")) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request,fresh.clone());
    }
    return fresh;
  }catch(err){
    const exact = await caches.match(request,{ignoreSearch:false});
    if (exact) return exact;
    const noQuery = await caches.match(request,{ignoreSearch:true});
    if (noQuery) return noQuery;
    if (request.mode === "navigate") return (await caches.match("./index.html")) || (await caches.match("./"));
    return Response.error();
  }
}
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(networkFirst(event.request));
});
self.addEventListener("message", event => { if (event.data?.type === "SKIP_WAITING") self.skipWaiting(); });
