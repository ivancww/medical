const assert = require('node:assert/strict');
const fs = require('node:fs');

const release = JSON.parse(fs.readFileSync('release-version.json', 'utf8'));
const app = fs.readFileSync('app.js', 'utf8');
const build = fs.readFileSync('app-build.js', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');
const sw = fs.readFileSync('sw.js', 'utf8');
const pages = fs.readFileSync('.github/workflows/pages.yml', 'utf8');
const connectorPin = fs.readFileSync('docs/MEDICAL-ADMIN-CONNECTOR-PIN.md', 'utf8');

assert.equal(release.appVersion, 'v1.1.6');
assert.equal(release.releaseType, 'admin-ui');
assert.match(app, /window\.AVA_MEDICAL_VERSION\|\|'v1\.1\.6'/);
assert.match(build, /AVA_MEDICAL_VERSION.*v1\.1\.6/);
assert.match(index, /medical-admin-auth\.js\?v=1\.1\.6/);
assert.match(index, /medical-official-sync\.js\?v=1\.1\.6/);
assert.match(index, /app\.js\?v=1\.1\.6/);
assert.match(sw, /medical-admin-auth\.js\?v=1\.1\.6/);
assert.match(sw, /medical-official-sync\.js\?v=1\.1\.6/);
assert.match(sw, /release-version\.json/);
assert.match(pages, /release-version\.json/);
assert.match(pages, /AVA_MEDICAL_VERSION/);
assert.match(connectorPin, /Medical release: `v1\.1\.6`/);

console.log('Medical frontend release identity v1.1.6 is consistent across source, build and PWA metadata');
