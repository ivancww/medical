const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const app = fs.readFileSync('app.js', 'utf8');
const css = fs.readFileSync('styles.css', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');
const sw = fs.readFileSync('sw.js', 'utf8');

assert.match(app, /function medicalCostScenarios\(\)/);
assert.match(app, /medical-cost-scenarios/);
assert.match(app, /data-medical-cost-scenario/);
assert.match(app, /function fundingBarModel\(/);
assert.match(app, /function bindLiveFundingInput\(/);
assert.match(app, /type="text" autocomplete="off" value="/);
assert.match(app, /startJourneyAtPage\('ready','R07',\{returnJourney:true\}\)/);
assert.match(css, /\.medical-cost-scenarios\{[^}]*grid-template-columns:repeat\(3/);
assert.match(css, /\.funding-bar \.self-paid\{background:#16a34a/);
assert.match(css, /@media\(max-width:760px\)\{\.medical-cost-scenarios\{grid-template-columns:1fr\}\}/);

const nodes = new Map();
const fakeNode = () => ({ hidden: false, textContent: '', innerHTML: '', dataset: {}, className: '', setAttribute() {}, addEventListener() {} });
const context = {
  window: { AVA_MEDICAL_VERSION: 'v1.2.9', AVA_MEDICAL_BUILD: 'test', location: { search: '' } },
  document: { querySelector: selector => nodes.get(selector) || fakeNode(), querySelectorAll: () => [] },
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  MedicalAdminAuth: { hasSession: () => false },
  URLSearchParams,
  Intl,
  console
};
context.window.document = context.document;
vm.runInNewContext(app.slice(0, app.indexOf('setEntry();')), context, { filename: 'medical-notready-refinement.js' });

const result = vm.runInNewContext(`
  state.official = { config: {
    medical_cost_endoscopy_min: 10000, medical_cost_endoscopy_max: 25000,
    medical_cost_cancer_min: 200000, medical_cost_cancer_max: 500000,
    medical_cost_pci_min: 100000, medical_cost_pci_max: 160000,
    medical_inflation_default: 6
  }, pages: [], options: [] };
  state.answers = { N05: 'fund_savings' };
  state.medicalCostScenario = 'cancer';
  state.medicalCost = medicalCostScenarioBase();
  const cards = costBlock();
  const selector = inflationBlock();
  const funding = fundingReport();
  const endoscopyBase = medicalCostScenarioBase('endoscopy');
  const pciBase = medicalCostScenarioBase('pci');
  const cancerBase = medicalCostScenarioBase('cancer');
  const funded = fundingBarModel(200000, 600000);
  const shortfall = fundingBarModel(600000, 200000);
  ({ cards, selector, funding, endoscopyBase, pciBase, cancerBase, funded, shortfall });
`, context);

assert.ok(result.cards.indexOf('腸胃鏡／日間內視鏡') < result.cards.indexOf('大型癌症治療情境'));
assert.ok(result.cards.indexOf('大型癌症治療情境') < result.cards.indexOf('通波仔'));
assert.match(result.selector, /腸胃鏡/);
assert.match(result.selector, /癌症/);
assert.match(result.selector, /通波仔/);
assert.equal(result.endoscopyBase, 10000);
assert.equal(result.cancerBase, 200000);
assert.equal(result.pciBase, 100000);
assert.equal(result.funded.selfPercent, 33.33333333333333);
assert.equal(result.funded.balancePercent, 66.6666666666666);
assert.equal(result.shortfall.selfPercent, 33.33333333333333);
assert.equal(result.shortfall.balancePercent, 66.6666666666666);
assert.match(result.funding, /value="200,000"/);
assert.match(result.funding, /value="600,000"/);
assert.match(result.funding, /self-paid/);
assert.match(result.funding, /自己比/);

assert.match(index, /app\.js\?v=1\.2\.9/);
assert.match(sw, /app\.js\?v=1\.2\.9/);
assert.doesNotMatch(index, /v=1\.2\.8/);
assert.doesNotMatch(sw, /v=1\.2\.8/);

console.log('Not Ready cost scenarios, funding bar, direct plan routing and release asset regression PASS');
