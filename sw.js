const CACHE='ava-medical-shell';
const ASSETS=['./','./index.html','./styles.css','./ready-product.css','./app.js?v=1.1.8','./medical-admin-auth.js?v=1.1.8','./medical-official-sync.js?v=1.1.8','./ava-admin-connector.mjs?v=1.1.8','./claim-engine.js','./product-data.js','./app-build.js','./release-version.json','./manifest.json'];
const cached=request=>caches.open(CACHE).then(cache=>cache.match(request));
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('ava-medical-shell')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=='GET'||url.origin!==location.origin)return;
  if(event.request.mode==='navigate'){
    event.respondWith(fetch(event.request,{cache:'no-store'}).then(response=>{
      if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put('./index.html',copy)))}
      return response;
    }).catch(()=>cached('./index.html')));
    return;
  }
  event.respondWith(fetch(event.request,{cache:'no-store'}).then(response=>{
    if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(event.request,copy)))}
    return response;
  }).catch(()=>cached(event.request)));
});
