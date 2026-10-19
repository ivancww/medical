const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const app = fs.readFileSync('app.js', 'utf8');
const match = app.match(/setEntry\(\);([\s\S]*?)\$\('#directPlansBtn'\)/);
assert.ok(match, 'Medical startup binding segment must remain discoverable');

const buttons = [
  { dataset: { journey: 'ready' }, onclick: null },
  { dataset: { journey: 'notready' }, onclick: null }
];
const calls = [];
const context = {
  setEntry() { calls.push('entry'); },
  startJourney(journey) { calls.push(journey); },
  $() { return buttons[0]; },
  $$() { return buttons; }
};

assert.doesNotThrow(() => vm.runInNewContext('setEntry();' + match[1], context), 'startup must bind journey buttons without throwing');
assert.equal(calls[0], 'entry');
assert.equal(typeof buttons[0].onclick, 'function');
assert.equal(typeof buttons[1].onclick, 'function');
buttons[0].onclick();
buttons[1].onclick();
assert.deepEqual(calls, ['entry', 'ready', 'notready']);

assert.match(app, /\$\$\('\[data-journey\]'\)\.forEach/);
assert.doesNotMatch(app, /setEntry\(\);\$\('\[data-journey\]'\)\.forEach/);

console.log('Medical admin/frontstage startup journey binding regression PASS');
