const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync('index.html', 'utf8');
const workflow = fs.readFileSync('.github/workflows/pages.yml', 'utf8');
const serviceWorker = fs.readFileSync('sw.js', 'utf8');
const officialSync = fs.readFileSync('medical-official-sync.js', 'utf8');

const scripts = [...html.matchAll(/<script\s+src="([^"]+)"/g)]
  .map(match => match[1].split('?')[0]);
const localScripts = scripts.filter(src => !src.startsWith('http://') && !src.startsWith('https://'));

assert.equal(new Set(scripts).size, scripts.length, 'HTML must not declare duplicate scripts');
assert.ok(localScripts.includes('medical-official-sync.js'), 'HTML must load Medical Official Sync');
assert.ok(localScripts.indexOf('medical-admin-auth.js') < localScripts.indexOf('medical-official-sync.js'), 'Admin auth must load before Official Sync');
assert.ok(localScripts.indexOf('medical-official-sync.js') < localScripts.indexOf('app.js'), 'Official Sync must load before app.js');

const assembleLine = workflow.split('\n').find(line => /\bcp\s+.+_site\//.test(line));
assert.ok(assembleLine, 'Pages workflow must assemble a site artifact');
const copiedAssets = assembleLine
  .trim()
  .replace(/^cp\s+/, '')
  .replace(/\s+_site\/$/, '')
  .split(/\s+/);
for (const script of localScripts) assert.ok(copiedAssets.includes(script), `Pages artifact must include ${script}`);

assert.match(serviceWorker, /['"]\.\/medical-official-sync\.js(?:\?[^'" ]+)?['"]/);

const context = {};
context.window = context;
context.globalThis = context;
vm.runInNewContext(officialSync, context, { filename: 'medical-official-sync.js' });
assert.equal(typeof context.MedicalOfficialSync, 'object', 'MedicalOfficialSync global must initialize');
assert.equal(typeof context.MedicalOfficialSync.mount, 'function', 'MedicalOfficialSync.mount must be available');

console.log('Medical Pages asset, script order and Official Sync initialization regression passed');
