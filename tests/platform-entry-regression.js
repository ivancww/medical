const fs=require('fs');
const index=fs.readFileSync('index.html','utf8');
const app=fs.readFileSync('app.js','utf8');
const sw=fs.readFileSync('sw.js','utf8');
const renderEntry=app.slice(app.indexOf('function renderEntry'),app.indexOf('function isEnabled'));
const checks=[
  ['bare/frontend entries default to Frontstage', /function avaEntry\(\)\{[\s\S]*return \['user','admin'\]\.includes\(value\)\?value:'frontend'\}/.test(app)],
  ['user entry opens the real Frontstage in Edit mode without choosing a journey', /renderHome\(\);if\(state\.entry==='user'\)setMode\('edit'\)/.test(renderEntry)&&!/startJourney/.test(renderEntry)],
  ['Ready and Not Ready remain explicit Frontstage choices', /data-journey="ready"/.test(index)&&/data-journey="notready"/.test(index)&&/startJourney\(b\.dataset\.journey\)/.test(app)],
  ['user mode does not create a workspace copy', !/userWorkspace|User Workspace|duplicated/i.test(index+app)],
  ['Preview and Save Local use the existing mode flow', /\$\('#previewBtn'\)\.onclick=\(\)=>setMode\('preview'\)/.test(app)&&/\$\('#saveBtn'\)\.onclick=saveOverrides/.test(app)],
  ['User overrides remain separate from Official cache', /CACHE_KEY='ava\.medical\.official\.v1',OVERRIDE_KEY='ava\.medical\.user\.overrides\.v1'/.test(app)&&/localStorage\.setItem\(OVERRIDE_KEY/.test(app)],
  ['Return to AVA remains persistent', /href="https:\/\/ivancww\.github\.io\/avaplatform\/">返回 AVA<\/a>/.test(index)],
  ['bottom Previous is removed while top Back remains', !/id="prevBtn"|上一步/.test(index+app)&&/id="backBtn"/.test(index)],
  ['simple choices use Direct Advance and complex pages retain Next', /DIRECT_ADVANCE_PAGES=\['R01','R02','N01','N02','N05','N07'\]/.test(app)&&/state\.index\+\+;renderPage\(\)/.test(app)&&/\$\('#nextBtn'\)\.hidden=isDirectAdvancePage\(id\)/.test(app)],
  ['customer Frontstage hides Official Data status', /\$\('#status'\)\.hidden=state\.entry==='frontend'/.test(app)],
  ['Medical App version/build is separate from Official Data', /APP_VERSION='v1\.1\.0',APP_BUILD=window\.AVA_MEDICAL_BUILD\|\|'local'/.test(app)&&/id="appVersion"/.test(index)&&/app-build\.js/.test(index+sw)],
  ['bar direction is product-specific', /percentage\?\['plan',plan,'計劃'\]:\['customer',customer,'自己'\]/.test(app)&&/percentage\?\['customer',customer,'自己'\]:\['plan',plan,'計劃'\]/.test(app)],
  ['Admin entry is explicit and authenticated', /\['user','admin'\]\.includes\(value\)/.test(app)&&/authorizeAdmin\(\)/.test(app)&&/MedicalAdminAuth\.hasGrant\(\)/.test(app)],
  ['invalid entries safely fall back to Frontstage', /\['user','admin'\]\.includes\(value\)\?value:'frontend'/.test(app)],
  ['installed PWA shell cache is refreshed', /const CACHE='ava-medical-shell'/.test(sw)&&/fetch\(event\.request,\{cache:'no-store'\}\)/.test(sw)&&/product-data\.js/.test(sw)&&/app-build\.js/.test(sw)&&/medical-admin-auth\.js/.test(sw)&&/cache\.put\('\.\/index\.html'/.test(sw)&&/if\(url\.search\)return/.test(sw)&&/key\.startsWith\('ava-medical-shell'\)/.test(sw)],
  ['Medical worker uses explicit uncached update discovery', /serviceWorker\.register\('sw\.js',\{scope:'\.\/',updateViaCache:'none'\}\)\.then\(registration=>registration\.update\(\)\)/.test(app)&&/controllerChangeReloaded/.test(app)],
  ['fixed Official pages remain protected', /function allPages\(\)\{return \(state\.official\?\.pages\|\|\[\]\)\.filter\(p=>isFixed\(p\)\|\|isEnabled\(p\)\)\}/.test(app)]
];
console.table(checks.map(([name,pass])=>({name,pass})));
if(checks.some(([,pass])=>!pass))throw Error('Platform entry regression failed');
