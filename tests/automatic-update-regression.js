const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

function deferredEvent(){
  const waits=[];
  return {waitUntil(promise){waits.push(Promise.resolve(promise))},respondWith(promise){this.response=Promise.resolve(promise)},async complete(){await Promise.all(waits)}};
}

async function runServiceWorkerContract(){
  const handlers={};
  const cacheData=new Map();
  const fetchCalls=[];
  let networkMode='online';
  let networkVersion='A';
  let skipWaitingCalls=0;
  let clientsClaimCalls=0;
  const userStorage=new Map([
    ['ava.medical.user.overrides.v1','{"R06":{"title":"客戶自訂"}}'],
    ['ava.medical.official.v1','{"version":"1.0.0"}'],
    ['ava.medical.local.setting.v1','local-setting']
  ]);
  const responseFor=version=>({ok:true,type:'basic',version,clone(){return this}});
  const caches={
    open:async name=>{
      if(!cacheData.has(name))cacheData.set(name,new Map());
      const entries=cacheData.get(name);
      return {
        addAll:async assets=>assets.forEach(asset=>entries.set(asset,responseFor(networkVersion))),
        put:async(request,response)=>entries.set(typeof request==='string'?request:request.url,response),
        match:async request=>entries.get(typeof request==='string'?request:request.url)
      };
    },
    keys:async()=>[...cacheData.keys()],
    delete:async name=>cacheData.delete(name),
    match:async request=>{
      const key=typeof request==='string'?request:request.url;
      for(const entries of cacheData.values())if(entries.has(key))return entries.get(key);
      return undefined;
    }
  };
  const context={
    self:{location:{origin:'https://ivancww.github.io',href:'https://ivancww.github.io/medical/sw.js'},clients:{claim:async()=>{clientsClaimCalls++}},skipWaiting:async()=>{skipWaitingCalls++},addEventListener:(type,handler)=>{handlers[type]=handler}},
    location:{origin:'https://ivancww.github.io',href:'https://ivancww.github.io/medical/sw.js'},
    caches,
    URL,
    fetch:async(request,options)=>{
      fetchCalls.push({request,options});
      if(networkMode==='offline')throw Error('offline');
      return responseFor(networkVersion);
    },
    Response:{error:()=>({ok:false})},
    console
  };
  vm.runInNewContext(fs.readFileSync('sw.js','utf8'),context,{filename:'sw.js'});

  cacheData.set('ava-medical-shell-old',new Map([['./index.html',responseFor('old')]]));
  cacheData.set('unrelated-app-shell',new Map([['./index.html',responseFor('other-app')]]));
  const install=deferredEvent();
  await handlers.install(install); await install.complete();
  assert.equal(skipWaitingCalls,1,'new worker skips waiting after its shell is installed');
  assert.equal(cacheData.get('ava-medical-shell').get('./index.html').version,'A','initial shell is installed');

  const activate=deferredEvent();
  await handlers.activate(activate); await activate.complete();
  assert.equal(clientsClaimCalls,1,'new worker claims existing clients');
  assert.equal(cacheData.has('ava-medical-shell-old'),false,'stale Medical shell cache is retired');
  assert.equal(cacheData.has('unrelated-app-shell'),true,'unrelated app cache is preserved');
  assert.equal(userStorage.get('ava.medical.user.overrides.v1'),'{"R06":{"title":"客戶自訂"}}','User Override survives worker activation');
  assert.equal(userStorage.get('ava.medical.official.v1'),'{"version":"1.0.0"}','Official local data is not erased by shell activation');
  assert.equal(userStorage.get('ava.medical.local.setting.v1'),'local-setting','other Medical local data survives worker activation');

  networkVersion='B';
  const navigation={url:'https://ivancww.github.io/medical/?avaEntry=user',mode:'navigate',method:'GET'};
  const onlineNavigation=deferredEvent();
  onlineNavigation.request=navigation;
  await handlers.fetch({...onlineNavigation,request:navigation});
  await onlineNavigation.complete();
  assert.equal(fetchCalls.at(-1).options.cache,'no-store','online navigation bypasses HTTP cache');
  assert.equal(cacheData.get('ava-medical-shell').get('./index.html').version,'B','new online shell replaces cached shell');

  const assetRequest={url:'https://ivancww.github.io/medical/app.js',mode:'cors',method:'GET'};
  const assetEvent=deferredEvent();
  await handlers.fetch({...assetEvent,request:assetRequest});
  await assetEvent.complete();
  assert.equal(fetchCalls.at(-1).options.cache,'no-store','online shell assets bypass HTTP cache');
  assert.equal(cacheData.get('ava-medical-shell').get(assetRequest.url).version,'B','new shell assets replace cached assets');

  const releaseAsset={url:'https://ivancww.github.io/medical/medical-admin-auth.js?v=1.1.4',mode:'cors',method:'GET'};
  const releaseEvent=deferredEvent();
  await handlers.fetch({...releaseEvent,request:releaseAsset});
  await releaseEvent.complete();
  assert.equal(fetchCalls.at(-1).options.cache,'no-store','release-keyed Admin auth bypasses HTTP cache');
  assert.equal(cacheData.get('ava-medical-shell').get(releaseAsset.url).version,'B','release-keyed Admin auth is cached coherently');

  networkMode='offline';
  const offlineNavigation=deferredEvent();
  offlineNavigation.request=navigation;
  const offlineEvent={...offlineNavigation,request:navigation};
  await handlers.fetch(offlineEvent);
  assert.equal((await offlineEvent.response).version,'B','offline navigation falls back to latest valid shell');
  assert.equal((await offlineEvent.response).version,'B','offline fallback remains stable for query entry modes');
}

async function runRegistrationContract(){
  const app=fs.readFileSync('app.js','utf8');
  const start=app.indexOf('function registerMedicalServiceWorker');
  const end=app.indexOf('setEntry();',start);
  assert.ok(start>=0&&end>start,'Medical exposes its update lifecycle registration');
  const serviceWorkerHandlers={};
  const calls=[];
  let reloads=0;
  const sessionValues=new Map();
  const registration={update:async()=>{calls.push('update')}};
  const context={
    navigator:{serviceWorker:{addEventListener:(type,handler)=>{serviceWorkerHandlers[type]=handler},register:async(...args)=>{calls.push(args);return registration}}},
    sessionStorage:{removeItem:key=>sessionValues.delete(key),setItem:(key,value)=>sessionValues.set(key,value)},
    window:{location:{reload:()=>{reloads++}}},
    console
  };
  vm.runInNewContext(app.slice(start,end),context,{filename:'app-update-lifecycle.js'});
  await vm.runInNewContext('registerMedicalServiceWorker()',context);
  assert.equal(calls[0][0],'sw.js','registration uses the app-owned worker');
  assert.equal(calls[0][1].scope,'./','registration keeps the Medical scope');
  assert.equal(calls[0][1].updateViaCache,'none','registration disables HTTP cache for update discovery');
  assert.equal(calls[1],'update','startup explicitly checks for a newer worker');
  serviceWorkerHandlers.controllerchange();
  serviceWorkerHandlers.controllerchange();
  assert.equal(reloads,1,'controller changes trigger at most one reload per page update cycle');
  assert.equal(sessionValues.get('ava:medical:sw-reload'),'1','reload cycle is recorded without browser-storage deletion');
}

async function run(){
  const sw=fs.readFileSync('sw.js','utf8');
  assert.doesNotMatch(sw,/localStorage\.clear\(|indexedDB\.deleteDatabase\(/,'shell update code does not delete user storage');
  await runServiceWorkerContract();
  await runRegistrationContract();
  console.log('Automatic Official App Shell update lifecycle regression passed');
}

run().catch(error=>{console.error(error);process.exitCode=1});
