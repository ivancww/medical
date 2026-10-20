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
  sessionStorage: { getItem: key => behaviorSession.get(key) || null, setItem: (key, value) => behaviorSession.set(key, value), removeItem: key => behaviorSession.delete(key) },
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
assert.ok(Math.abs(result.funded.balancePercent - 66.66666666666667) < 1e-10);
assert.equal(result.shortfall.selfPercent, 33.33333333333333);
assert.ok(Math.abs(result.shortfall.balancePercent - 66.66666666666667) < 1e-10);
assert.match(result.funding, /value="200,000"/);
assert.match(result.funding, /value="600,000"/);
assert.match(result.funding, /self-paid/);
assert.match(result.funding, /自己比/);

assert.match(index, /app\.js\?v=1\.2\.9/);
assert.match(sw, /app\.js\?v=1\.2\.9/);
assert.doesNotMatch(index, /v=1\.2\.8/);
assert.doesNotMatch(sw, /v=1\.2\.8/);


assert.match(app, /NOTREADY_FINAL_SUMMARY/);
assert.match(app, /function notReadySummaryBlock\(/);
assert.match(app, /function officialOptionLabel\(/);
assert.match(app, /returnJourneyEntryPage/);
assert.match(app, /isReturnEntry/);
assert.match(app, /returnedFromPlanInfo/);
assert.match(app, /查看總結/);
assert.match(app, /state\.answers\.N01/);
assert.match(app, /state\.answers\.N02/);
assert.match(app, /state\.answers\.N05/);
assert.match(app, /state\.answers\.N07/);

const behaviorNodes = new Map();
const behaviorOptionButtons = [];
const behaviorNode = () => ({
  hidden: false, textContent: '', innerHTML: '', dataset: {}, style: {},
  setAttribute() {}, addEventListener() {}, getBoundingClientRect: () => ({ top: 0, height: 0 })
});
const behaviorSession = new Map();
const behaviorContext = {
  window: { AVA_MEDICAL_VERSION: 'v1.2.9', AVA_MEDICAL_BUILD: 'test', location: { search: '' }, scrollTo() {}, requestAnimationFrame: fn => fn() },
  document: {
    querySelector: selector => behaviorNodes.get(selector) || behaviorNodes.set(selector, behaviorNode()).get(selector),
    querySelectorAll: selector => selector === '.option-card' ? behaviorOptionButtons : []
  },
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  sessionStorage: { getItem: key => behaviorSession.get(key) || null, setItem: (key, value) => behaviorSession.set(key, value), removeItem: key => behaviorSession.delete(key) },
  MedicalAdminAuth: { hasSession: () => false },
  URLSearchParams,
  Intl,
  console
};
behaviorContext.window.document = behaviorContext.document;
vm.runInNewContext(app.slice(0, app.indexOf('setEntry();')), behaviorContext, { filename: 'medical-notready-behavior.js' });
const routeResult = vm.runInNewContext(`
  state.official = {
    config: {
      medical_cost_endoscopy_min: 10000, medical_cost_endoscopy_max: 25000,
      medical_cost_cancer_min: 200000, medical_cost_cancer_max: 500000,
      medical_cost_pci_min: 100000, medical_cost_pci_max: 160000,
      medical_inflation_default: 6
    },
    pages: [
      { page_id: 'N01', page_type: 'medical_choice', sort_order: 1 },
      { page_id: 'N02', page_type: 'tradeoff_priority', sort_order: 2 },
      { page_id: 'N03', page_type: 'medical_cost', sort_order: 3 },
      { page_id: 'N04', page_type: 'inflation', sort_order: 4 },
      { page_id: 'N05', page_type: 'funding_source', sort_order: 5 },
      { page_id: 'N06', page_type: 'funding_report', sort_order: 6 },
      { page_id: 'N07', page_type: 'future_arrangement', sort_order: 7 },
      { page_id: 'R07', page_type: 'ready_features', sort_order: 1 }
    ],
    options: [
      { option_id: 'private', option_group: 'medical_choice', display_name: '私家醫療' },
      { option_id: 'public', option_group: 'medical_choice', display_name: '公立醫療' },
      { option_id: 'private_tradeoff', option_group: 'tradeoff_priority', display_name: '即時處理但費用較高' },
      { option_id: 'fund_savings', option_group: 'funding_source', display_name: '銀行存款' },
      { option_id: 'reserve_fund', option_group: 'future_arrangement', display_name: '預留一筆醫療預備資金' },
      { option_id: 'future_insurance', option_group: 'future_arrangement', display_name: '了解醫療保障可以負擔幾多' }
    ]
  };
  startJourneyAtPage('notready', 'N07');
  state.answers = { N01: 'private', N02: 'private_tradeoff', N05: 'fund_savings' };
  state.medicalCostScenario = 'pci';
  state.medicalGrowthRate = 6;
  state.medicalCost = 100000;
  state.fundingAmount = 600000;
  behaviorOptionButtons.push(...state.official.options
    .filter(option => option.option_group === 'future_arrangement')
    .map(option => ({
      dataset: { key: option.option_id },
      classList: { add() {} },
      setAttribute() {},
      onclick: null
    })));
  renderPage();
  const futureInsuranceButton = behaviorOptionButtons.find(button => button.dataset.key === 'future_insurance');
  futureInsuranceButton.onclick();
  const firstTapJourney = state.journey;
  const firstTapPage = pageId(journeyPages(state.journey)[state.index]);
  const firstTapAnswer = state.answers.N07;
  const savedPage = state.returnJourney.pageId;
  goBack();
  const returnedNext = document.querySelector('#nextBtn');
  const returnedMarker = state.returnedFromPlanInfo;
  const returnedNextHidden = returnedNext.hidden;
  const returnedNextText = returnedNext.textContent;
  const returnedPage = pageId(journeyPages(state.journey)[state.index]);
  persistJourneySession();
  state.journey = null;
  state.returnJourney = null;
  state.returnJourneyEntryPage = null;
  state.returnedFromPlanInfo = false;
  restoreJourneySession();
  renderPage();
  const restoredNext = document.querySelector('#nextBtn');
  const restoredMarker = state.returnedFromPlanInfo;
  const restoredNextHidden = restoredNext.hidden;
  const restoredPage = pageId(journeyPages(state.journey)[state.index]);
  navigateJourney(1);
  const summaryPage = pageId(journeyPages(state.journey)[state.index]);
  const summaryHtml = document.querySelector('#pageCard').innerHTML;
  const returnedAnswers = { ...state.answers };
  const returnedScenario = state.medicalCostScenario;
  const returnedGrowth = state.medicalGrowthRate;
  const returnedCost = state.medicalCost;
  const returnedFunding = state.fundingAmount;
  startJourneyAtPage('notready', 'N07');
  state.answers.N07 = 'reserve_fund';
  navigateJourney(1);
  const reservePage = pageId(journeyPages(state.journey)[state.index]);
  startJourneyAtPage('notready', 'N07');
  state.answers.N07 = 'maintain';
  navigateJourney(1);
  const maintainPage = pageId(journeyPages(state.journey)[state.index]);
  ({
    journey: state.journey,
    page: returnedPage,
    answers: returnedAnswers,
    scenario: returnedScenario,
    growth: returnedGrowth,
    cost: returnedCost,
    funding: returnedFunding,
    savedPage,
    firstTapJourney,
    firstTapPage,
    firstTapAnswer,
    returnedFromPlanInfo: returnedMarker,
    nextHidden: returnedNextHidden,
    nextText: returnedNextText,
    restoredPage,
    restoredMarker,
    restoredNextHidden,
    summaryPage,
    summaryHtml,
    reservePage,
    maintainPage
  });
`, behaviorContext);
assert.equal(routeResult.journey, 'notready');
assert.equal(routeResult.page, 'N07');
assert.equal(routeResult.savedPage, 'N07');
assert.equal(routeResult.firstTapJourney, 'ready');
assert.equal(routeResult.firstTapPage, 'R07');
assert.equal(routeResult.firstTapAnswer, 'future_insurance');
assert.equal(routeResult.answers.N01, 'private');
assert.equal(routeResult.answers.N02, 'private_tradeoff');
assert.equal(routeResult.answers.N05, 'fund_savings');
assert.equal(routeResult.answers.N07, 'future_insurance');
assert.equal(routeResult.scenario, 'pci');
assert.equal(routeResult.growth, 6);
assert.equal(routeResult.cost, 100000);
assert.equal(routeResult.funding, 600000);
assert.equal(routeResult.returnedFromPlanInfo, true);
assert.equal(routeResult.nextHidden, false);
assert.equal(routeResult.nextText, '查看總結');
assert.equal(routeResult.restoredPage, 'N07');
assert.equal(routeResult.restoredNextHidden, false);
assert.equal(routeResult.summaryPage, 'NOTREADY_FINAL_SUMMARY');
assert.match(routeResult.summaryHtml, /了解醫療保障可以負擔幾多/);
assert.doesNotMatch(routeResult.summaryHtml, /future_insurance/);
assert.equal(routeResult.reservePage, 'NOTREADY_FINAL_SUMMARY');
assert.equal(routeResult.maintainPage, 'NOTREADY_FINAL_SUMMARY');

vm.runInNewContext(`state.answers = { N01: 'private', N02: 'private_tradeoff', N05: 'fund_savings', N07: 'future_insurance' }; state.medicalCostScenario = 'pci'; state.medicalGrowthRate = 6; state.medicalCost = 100000; state.fundingAmount = 600000;`, behaviorContext);
const summaryResult = vm.runInNewContext(`
  notReadySummaryBlock();
`, behaviorContext);
assert.match(summaryResult, /私家醫療/);
assert.match(summaryResult, /即時處理但費用較高/);
assert.match(summaryResult, /通波仔/);
assert.match(summaryResult, /6\.0%/);
assert.match(summaryResult, /今日/);
assert.match(summaryResult, /5年後/);
assert.match(summaryResult, /10年後/);
assert.match(summaryResult, /20年後/);
assert.match(summaryResult, /銀行存款/);
assert.match(summaryResult, /HK\$100,000/);
assert.match(summaryResult, /HK\$600,000/);
assert.match(summaryResult, /餘額/);
assert.match(summaryResult, /了解醫療保障可以負擔幾多/);
assert.doesNotMatch(summaryResult, /private|private_tradeoff|fund_savings|reserve_fund|future_insurance/);
vm.runInNewContext(`state.answers.N01 = 'public';`, behaviorContext);
const changedSummary = vm.runInNewContext(`notReadySummaryBlock();`, behaviorContext);
assert.match(changedSummary, /公立醫療/);
assert.doesNotMatch(changedSummary, /私家醫療/);

console.log('Not Ready cost scenarios, funding bar, direct plan routing and release asset regression PASS');
