const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const app = fs.readFileSync('app.js', 'utf8');
const syncSource = fs.readFileSync('medical-official-sync.js', 'utf8');

const p7 = app.slice(app.indexOf('function planFeaturesBlockV2'), app.indexOf('function brochureButton'));
assert.match(p7, /p\.id==='WISE'\?wiseStatusBlock\(\):''/, 'Wise eligibility is composed inside the Wise product card');
assert.doesNotMatch(p7, /const wise=|\+wise\+/, 'no standalone Wise eligibility block remains');
assert.doesNotMatch(p7.replace(/p\.id==='WISE'\?wiseStatusBlock\(\):''/, ''), /wise-condition-toggle/, 'Elite and Flexi cards do not receive Wise controls');
assert.match(app, /符合條件（享半私家）/);
assert.match(app, /條件未符（降為普通房級別）/);
assert.match(app, /WISE_CONDITION_KEYS/);

const resolverStart = app.indexOf('function comparisonHasDisplayData');
const resolverEnd = app.indexOf('function wiseStatusBlock');
const resolverContext = { console };
vm.runInNewContext(app.slice(resolverStart, resolverEnd), resolverContext, { filename: 'medical-comparison-resolver.js' });
const cancer = { values: { WISE: { WISE_SEMI_PRIVATE: { main_value: '', sub_value: '' }, WISE_GENERAL_ROOM: { main_value: '全數賠償', sub_value: '' } } } };
const roomSensitive = { values: { WISE: { WISE_SEMI_PRIVATE: { main_value: '半私家值', sub_value: '' }, WISE_GENERAL_ROOM: { main_value: '普通房值', sub_value: '' } } } };
resolverContext.cancer = cancer;
resolverContext.roomSensitive = roomSensitive;
assert.equal(JSON.stringify(vm.runInNewContext("planFeatureValue(cancer,'WISE',true)", resolverContext)), JSON.stringify(['資料待核實', '']), 'Wise semi-private must not inherit an unverified general-room cancer value');
assert.equal(JSON.stringify(vm.runInNewContext("planFeatureValue(cancer,'WISE',false)", resolverContext)), JSON.stringify(['全數賠償', '']), 'Wise general-room keeps its own cancer value');
assert.equal(JSON.stringify(vm.runInNewContext("planFeatureValue(roomSensitive,'WISE',true)", resolverContext)), JSON.stringify(['半私家值', '']), 'room-sensitive Wise values prefer the exact state');
assert.equal(JSON.stringify(vm.runInNewContext("planFeatureValue(roomSensitive,'WISE',false)", resolverContext)), JSON.stringify(['普通房值', '']), 'room-sensitive Wise values switch to general-room state');

const syncContext = { window: null, globalThis: null };
syncContext.window = syncContext;
syncContext.globalThis = syncContext;
vm.runInNewContext(syncSource, syncContext, { filename: 'medical-official-sync.js' });
const sync = syncContext.MedicalOfficialSync;
assert.equal(sync.canonicalPlanId({ record_id: 'elite_plan', record_type: 'PLAN' }), 'ELITE');
assert.equal(sync.canonicalPlanId({ record_id: 'wise_plan', record_type: 'PLAN' }), 'WISE');
assert.equal(sync.canonicalPlanId({ record_id: 'flexi_plan', record_type: 'PLAN' }), 'FLEXI');
for (const id of ['ELITE', 'WISE', 'FLEXI']) assert.equal(sync.canonicalPlanId({ record_id: id, record_type: 'PLAN' }), id);
assert.equal(sync.canonicalPlanId({ record_id: 'elite_plan', record_type: 'FEATURE' }), null, 'non-plan records remain rejected');
assert.match(fs.readFileSync('medical-official-sync.js', 'utf8'), /uploadOfficialBrochure\(\{\s*planId,\s*file/, 'uploader receives the resolved canonical ID');

const session = new Map();
const local = new Map();
const element = () => ({ hidden: false, textContent: '', className: '', dataset: {}, setAttribute() {}, addEventListener() {} });
const persistenceContext = {
  window: { AVA_MEDICAL_VERSION: 'v1.2.10', AVA_MEDICAL_BUILD: 'test', location: { search: '' } },
  document: { querySelector: () => element(), querySelectorAll: () => [] },
  localStorage: { getItem: key => local.get(key) || null, setItem: (key, value) => local.set(key, value), removeItem: key => local.delete(key) },
  sessionStorage: { getItem: key => session.get(key) || null, setItem: (key, value) => session.set(key, value), removeItem: key => session.delete(key) },
  MedicalAdminAuth: { hasSession: () => false }, console, URLSearchParams
};
vm.runInNewContext(app.slice(0, app.indexOf('setEntry();')), persistenceContext, { filename: 'medical-session.js' });
const sessionResult = vm.runInNewContext(`
  state.entry='frontend';
  state.official={pages:[
    {page_id:'R01',enabled:true},{page_id:'R02',enabled:true},{page_id:'R03',enabled:true},{page_id:'R04',enabled:true},{page_id:'R05',enabled:true}
  ],options:[]};
  state.journey='ready'; state.answers={R02:'company_medical'}; state.index=4; state.companyCoverage=123000; state.wiseConditions={hospital:true,networkDoctor:false,preapproval:true};
  persistJourneySession();
  const first=JSON.parse(sessionStorage.getItem(JOURNEY_SESSION_KEY));
  state.journey=null; state.index=0; state.answers={}; state.companyCoverage=80000; state.wiseConditions={hospital:true,networkDoctor:true,preapproval:true};
  restoreJourneySession();
  const company={pageId:pageId(journeyPages('ready')[state.index]),index:state.index,coverage:state.companyCoverage,wise:state.wiseConditions.networkDoctor};
  sessionStorage.setItem(JOURNEY_SESSION_KEY,JSON.stringify({...first,answers:{R02:'no_medical'},pageId:'R04'}));
  state.resumeRestored=false; restoreJourneySession();
  ({first,company,noMedical:{pageId:pageId(journeyPages('ready')[state.index]),index:state.index,hasR03:journeyPages('ready').some(p=>pageId(p)==='R03')}});
`, persistenceContext);
assert.equal(sessionResult.first.pageId, 'R05', 'session stores the current logical page ID');
assert.equal(sessionResult.company.pageId, 'R05');
assert.equal(sessionResult.company.coverage, 123000);
assert.equal(sessionResult.company.wise, false);
assert.equal(sessionResult.noMedical.pageId, 'R04', 'conditional restoration uses logical page identity');
assert.equal(sessionResult.noMedical.hasR03, false);
assert.match(app, /function startJourney\(j,\{returnJourney=null,returnJourneyEntryPage=null\}=\{\}\)\{clearJourneySession\(\);resetJourneyPresentationState\(\)/, 'starting a new journey clears the resume pointer and state');
assert.match(app, /function renderHome\(\)\{clearJourneySession\(\)/, 'deliberate Home navigation clears the resume pointer');
assert.match(app, /persistJourneySession\(\);\s*try\{sessionStorage\.setItem\(SW_RELOAD_KEY/, 'service-worker reload persists the active conversation first');

console.log('Post-v1.2.10 Wise, brochure plan-ID and journey-resume regressions PASS');
