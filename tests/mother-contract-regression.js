const fs=require('fs');
const index=fs.readFileSync('index.html','utf8');
const app=fs.readFileSync('app.js','utf8');
const product=fs.readFileSync('docs/PRODUCT-RULES.md','utf8');
const checks=[
  ['Return to AVA is persistent outside agent-only chrome', /<header class="app-header">[\s\S]*<a class="ava-button ava-button--secondary" href="https:\/\/ivancww\.github\.io\/avaplatform\/">返回 AVA<\/a>/],
  ['User override storage is separate from Official cache', /CACHE_KEY='ava\.medical\.official\.v1',OVERRIDE_KEY='ava\.medical\.user\.overrides\.v1'/],
  ['Fixed pages are retained in the page filter', /function allPages\(\)\{return \(state\.official\?\.pages\|\|\[\]\)\.filter\(p=>isFixed\(p\)\|\|isEnabled\(p\)\)\}/],
  ['Unpublished claim cases fail safely', /實際索償個案暫未發布/],
  ['Mother alignment and gap classification are documented', /## Current Mother Rules alignment[\s\S]*## Gap classification for the current MVP/]
];
const results=checks.map(([name,re])=>({name,pass:re.test(name==='Mother alignment and gap classification are documented'?product:name.includes('Return')?index:app)}));
console.table(results);
if(results.some(x=>!x.pass))throw Error('Mother contract regression failed');
