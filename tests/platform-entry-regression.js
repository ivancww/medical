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
  ['Admin entry is explicit and authenticated', /\['user','admin'\]\.includes\(value\)/.test(app)&&/authorizeAdmin\(\)/.test(app)&&/MedicalAdminAuth\.hasGrant\(\)/.test(app)],
  ['invalid entries safely fall back to Frontstage', /\['user','admin'\]\.includes\(value\)\?value:'frontend'/.test(app)],
  ['installed PWA shell cache is refreshed', /const CACHE='ava-medical-shell'/.test(sw)&&/fetch\(event\.request,\{cache:'no-store'\}\)/.test(sw)&&/product-data\.js/.test(sw)&&/medical-admin-auth\.js/.test(sw)&&/cache\.put\('\.\/index\.html'/.test(sw)&&/if\(url\.search\)return/.test(sw)&&/key\.startsWith\('ava-medical-shell'\)/.test(sw)],
  ['fixed Official pages remain protected', /function allPages\(\)\{return \(state\.official\?\.pages\|\|\[\]\)\.filter\(p=>isFixed\(p\)\|\|isEnabled\(p\)\)\}/.test(app)]
];
console.table(checks.map(([name,pass])=>({name,pass})));
if(checks.some(([,pass])=>!pass))throw Error('Platform entry regression failed');
