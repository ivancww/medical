const assert = require('node:assert/strict');
const fs = require('node:fs');

const app = fs.readFileSync('app.js', 'utf8');
const css = fs.readFileSync('ready-product.css', 'utf8');
const rules = fs.readFileSync('docs/PRODUCT-RULES.md', 'utf8');

assert.match(app, /const READY_PAGE_ORDER=\['R01','R02','R03','R04','R05','R07','R09','R08','FINAL_SUMMARY'\]/);
assert.match(app, /function goBack\(\)\{if\(!state\.journey\)\{renderHome\(\);return\}const ps=journeyPages\(state\.journey\);if\(state\.index>0&&ps\.length\)navigateJourney\(-1\);else renderHome\(\)\}/);
assert.match(app, /companyCoverage.*inputmode="numeric"/);
assert.match(app, /function bindLiveNumericInput\(/);
assert.match(app, /state\[key\]=value/);
assert.match(app, /data-plan-id="'\+id/);
assert.match(app, /data-condition-key="'\+key/);
assert.match(app, /符合條件（享半私家）/);
assert.match(app, /條件未符（降為普通房級別）/);
assert.match(app, /WISE_GENERAL_ROOM/);
assert.match(app, /--plan-count:'\+visible\.length/);
assert.match(app, /planComparison/);
assert.match(app, /WISE_SEMI_PRIVATE/);
assert.match(app, /WISE_GENERAL_ROOM/);
assert.match(app, /function effectiveComparisonItems\(/);
assert.match(app, /comparisonHasDisplayData/);
assert.match(app, /未有資料/);
assert.match(app, /function p7UserModel\(/);
assert.match(app, /function p7ComparisonEditor\(/);
assert.match(app, /p7AddUserItem/);
assert.doesNotMatch(app, /READY_COMPARISON_ITEMS/);
assert.match(app, /FINAL_SUMMARY/);
assert.match(app, /function readySummaryBlock\(/);
assert.match(app, /function brochureButton\(/);
assert.match(app, /brochure_url/);
assert.match(app, /function planFeaturesBlockV2\(/);
assert.doesNotMatch(app, /legacyPlanFeaturesBlockV2|Official Plan_Comparison rows are shown|三個計劃，保障方法各有不同/);
assert.doesNotMatch(app, /return '<section class="premium-experience">.*保費按 Official 表格/);
assert.equal((app.match(/除咗醫療費用之外，如果患上大病而需要停工休養，期間嘅生活費用又會由邊度嚟？/g)||[]).length,1);
assert.doesNotMatch(app, /90-365日|上限 \$640|上限 \$848|每日 \$1,200|每日 \$2,400|上限 \$96,000/);
assert.match(app, /除咗醫療費用之外，如果患上大病而需要停工休養，期間嘅生活費用又會由邊度嚟？/);
assert.match(app, /\$\('#backBtn'\)\.onclick=goBack/);
assert.doesNotMatch(css, /@media\(max-width:1000px\)[^\n]*premium-results[^\n]*repeat\(2/);
assert.match(css, /\.premium-results \{[^}]*grid-template-columns: repeat\(3/);
assert.match(css, /@media\(max-width:650px\)[^}]*premium-results[^}]*grid-template-columns: 1fr/);
assert.match(rules, /R01 Concern Setup → R02 Existing Medical[\s\S]*R07 Plan Coverage & Features[\s\S]*R09 Premium[\s\S]*R08 Concern Reflection \(final Ready page\)/);

console.log('Ready flow UX regression contract PASS');

assert.match(app, /startJourneyAtPage\(j,pageIdValue\)/);
assert.match(app, /directPlansBtn/);
assert.doesNotMatch(app, /brochureIcon\(/);
