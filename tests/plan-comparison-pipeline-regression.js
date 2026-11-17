const assert=require('node:assert/strict');
const {appContext,auditPayload}=require('./helpers/plan-comparison-audit.js');
const rows=[
 {comparison_id:'duplicate-wise',item_key:'custom_item',item_name:'Synthetic item',plan_id:' ELITE ',condition_state:' DEFAULT ',main_value:'Synthetic elite',enabled:true,verified:false},
 {comparison_id:'duplicate-wise',item_key:'custom_item',item_name:'Synthetic item',plan_id:'WISE',condition_state:'WISE_SEMI_PRIVATE',main_value:'Synthetic semi',enabled:true},
 {comparison_id:'duplicate-wise',item_key:'custom_item',item_name:'Synthetic item',plan_id:'WISE',condition_state:'WISE_GENERAL_ROOM',main_value:'Synthetic general',enabled:true},
 {comparison_id:'flexi',item_key:'custom_item',item_name:'Synthetic item',plan_id:'FLEXI',condition_state:'DEFAULT',main_value:'Synthetic flexi',enabled:'TRUE'},
 {comparison_id:'flexi-other',item_key:'custom_item',item_name:'Synthetic item',plan_id:'FLEXI',condition_state:'FLEXI_NON_NETWORK',main_value:'Synthetic non-network',enabled:'TRUE'},
 {comparison_id:'sub-only',item_key:'sub_item',item_name:'Synthetic sub-only',plan_id:'ELITE',condition_state:'DEFAULT',main_value:'',sub_value:'Synthetic sub',enabled:true},
 {comparison_id:'disabled',item_key:'disabled_item',plan_id:'ELITE',condition_state:'DEFAULT',main_value:'Must stay hidden',enabled:false},
];
const base={version:'synthetic-1',revision:'r1',pages:[{page_id:'R07',title:'Synthetic plans'}],options:[],claimRules:['ELITE','WISE','FLEXI'].map(plan_id=>({plan_id,plan_name:plan_id})),plans:[]};
assert.equal(auditPayload({...base,planComparison:rows}).enabled,6);
const h=appContext();h.context.rows=rows;h.context.base=base;
for(const expression of ['{...base,planComparison:rows}','{...base,plan_comparison:rows}','{...base,adminDatasets:{planComparison:rows}}','{...base,adminDatasets:{plan_comparison:rows}}','{...base,comparisonItems:rows}','{...base,comparison_items:rows}','{...base,planComparison:[],plan_comparison:rows}','{...base,planComparison:{invalid:true},plan_comparison:rows}']){
 h.run('state.official='+expression);assert.equal(h.run('officialComparisonRows().length'),7);
 assert.equal(h.run('officialComparisonItems().length'),2,'No hardcoded item whitelist or verified flag filter');
 assert.equal(h.run("officialComparisonItems()[0].values.WISE.WISE_GENERAL_ROOM.main_value"),'Synthetic general');
}
h.run("state.official={...base,planComparison:[]};state.officialReadStatus='current'");assert.match(h.run('comparisonDataStatusBlock()'),/暫未提供/);
h.run('state.official=base');assert.match(h.run('comparisonDataStatusBlock()'),/尚未載入/);
h.run("state.official={...base,planComparison:rows};state.officialReadStatus='offline'");assert.match(h.run('comparisonDataStatusBlock()'),/未能連線.*本機已儲存/);
h.run("state.officialReadStatus='current'");assert.equal(h.run('comparisonDataStatusBlock()'),'');
(async()=>{
 const h=appContext(),cacheKey='ava.medical.official.v1',overrideKey='ava.medical.user.overrides.v1';
 const cached={...base,planComparison:rows};h.storage.set(cacheKey,JSON.stringify(cached));h.storage.set(overrideKey,'{"R07":{"title":"User title"}}');
 let calls=[];
 function network(version,full,error=false){calls=[];h.context.fetch=async url=>{calls.push(url);if(error)throw Error('Synthetic connection failure');return {ok:true,json:async()=>url.includes('checkVersion')?version:full}}}
 network({version:base.version,revision:base.revision});await h.run('bootstrap({render:false})');assert.equal(calls.length,1,'Unchanged cache makes only lightweight version request');
 const newer={...base,version:'synthetic-2',revision:'r2',plan_comparison:rows.map(r=>({...r,main_value:r.main_value+' updated'}))};
 network({version:newer.version,revision:newer.revision},newer);await h.run('bootstrap({render:false})');assert.equal(calls.length,2);assert.equal(JSON.parse(h.storage.get(cacheKey)).version,newer.version);assert.match(h.run('officialComparisonRows()[0].main_value'),/updated$/);
 const revised={...newer,revision:'r3'};network({version:revised.version,revision:revised.revision},revised);await h.run('bootstrap({render:false})');assert.equal(calls.length,2,'Revision change refreshes comparison data even at same version');
 network(null,null,true);await h.run('bootstrap({render:false})');assert.equal(h.run('state.officialReadStatus'),'offline');assert.equal(h.run('state.official.revision'),'r3');assert.match(h.run('comparisonDataStatusBlock()'),/本機已儲存/);
 network({version:'bad',revision:'bad'},{version:'bad',planComparison:[]});await h.run('bootstrap({render:false})');assert.equal(h.run('state.officialReadStatus'),'invalid');assert.match(h.run('comparisonDataStatusBlock()'),/資料格式有誤/);assert.equal(h.run('state.official.revision'),'r3','Invalid response cannot replace valid in-memory cache');assert.equal(JSON.parse(h.storage.get(cacheKey)).revision,'r3');
 assert.equal(h.storage.get(overrideKey),'{"R07":{"title":"User title"}}','Refresh/failure never rewrites User overrides');
 network({version:'synthetic-2'},revised);await h.run('bootstrap({render:false})');assert.equal(calls.length,2,'Absent revision uses existing safe full-read fallback');
 console.log('Plan Comparison aliases, applicable rows, duplicate IDs, conditions, cache version/revision refresh and connection/missing states PASS');
})().catch(error=>{console.error(error);process.exitCode=1});
