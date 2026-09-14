const CACHE_NAME = "track-log-v2.9.0-20260914-r10";
const PRECACHE = [
  "./","./index.html","./styles.css?v=290","./db.js?v=290","./coach.js?v=290","./app.js?v=290",
  "./manifest.webmanifest?v=290",
  "./favicon.ico","./favicon-32-v240.png","./favicon-48-v240.png","./apple-touch-icon-v240.png",
  "./icon-192-v240.png","./icon-512-v240.png","./maskable-192-v240.png","./maskable-512-v240.png"
];
self.addEventListener("install", event => {
  event.waitUntil((async()=>{
    const cache = await caches.open(CACHE_NAME);
    // Cache each file independently: one optional file can no longer abort the entire SW install.
    await Promise.allSettled(PRECACHE.map(async x=>{
      const req=new Request(x,{cache:"reload"});
      const res=await fetch(req);
      if(res && res.ok) await cache.put(req,res.clone());
    }));
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
