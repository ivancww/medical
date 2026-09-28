const fs=require('fs');
const index=fs.readFileSync('index.html','utf8');
const app=fs.readFileSync('app.js','utf8');
const sw=fs.readFileSync('sw.js','utf8');
const checks=[
  ['bare/frontend entries default to Frontstage', /function avaEntry\(\)\{[\s\S]*return value==='user'\?'user':'frontend'\}/.test(app)],
  ['user entry opens the real Frontstage in Edit mode without choosing a journey', /function renderEntry\(\)\{renderHome\(\);if\(state\.entry==='user'\)setMode\('edit'\)\}/.test(app)&&!/function renderEntry\(\)\{renderHome\(\);if\(state\.entry==='user'\)\{startJourney/.test(app)],
  ['Ready and Not Ready remain explicit Frontstage choices', /data-journey="ready"/.test(index)&&/data-journey="notready"/.test(index)&&/startJourney\(b\.dataset\.journey\)/.test(app)],
  ['user mode does not create a workspace copy', !/userWorkspace|User Workspace|duplicated/i.test(index+app)],
  ['Preview and Save Local use the existing mode flow', /\$\('#previewBtn'\)\.onclick=\(\)=>setMode\('preview'\)/.test(app)&&/\$\('#saveBtn'\)\.onclick=saveOverrides/.test(app)],
  ['User overrides remain separate from Official cache', /CACHE_KEY='ava\.medical\.official\.v1',OVERRIDE_KEY='ava\.medical\.user\.overrides\.v1'/.test(app)&&/localStorage\.setItem\(OVERRIDE_KEY/.test(app)],
  ['Return to AVA remains persistent', /href="https:\/\/ivancww\.github\.io\/avaplatform\/">返回 AVA<\/a>/.test(index)],
  ['Admin is not exposed as a capability', !/id="adminBtn"/.test(index)&&!/value==='admin'/.test(app)],
  ['invalid entries safely fall back to Frontstage', /value==='user'\?'user':'frontend'/.test(app)],
  ['installed PWA shell cache is refreshed', /ava-medical-shell-v3/.test(sw)],
  ['fixed Official pages remain protected', /function allPages\(\)\{return \(state\.official\?\.pages\|\|\[\]\)\.filter\(p=>isFixed\(p\)\|\|isEnabled\(p\)\)\}/.test(app)]
];
console.table(checks.map(([name,pass])=>({name,pass})));
if(checks.some(([,pass])=>!pass))throw Error('Platform entry regression failed');
