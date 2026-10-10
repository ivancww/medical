const assert = require('node:assert/strict');
const fs = require('node:fs');

const html = fs.readFileSync('index.html', 'utf8');
const workflow = fs.readFileSync('.github/workflows/pages.yml', 'utf8');
const serviceWorker = fs.readFileSync('sw.js', 'utf8');
const officialSync = fs.readFileSync('medical-official-sync.js', 'utf8');

const localScripts = [...html.matchAll(/<script\s+src="([^"]+)"/g)]
  .map(match => match[1].split('?')[0])
  .filter(src => !src.startsWith('http://') && !src.startsWith('https://'));
const assembleLine = workflow.split('\n').find(line => /\bcp\s+.+_site\//.test(line));
assert.ok(assembleLine, 'Pages workflow must assemble a site artifact');
const copiedAssets = assembleLine
  .trim()
  .replace(/^cp\s+/, '')
  .replace(/\s+_site\/$/, '')
  .split(/\s+/);

for (const script of localScripts) {
  assert.ok(copiedAssets.includes(script), `Pages artifact must include ${script}`);
}

assert.match(officialSync, /global\.MedicalOfficialSync\s*=\s*Object\.freeze/);
assert.match(serviceWorker, /['"]\.\/medical-official-sync\.js['"]/);
console.log('Medical Pages runtime asset deployment regression passed');
