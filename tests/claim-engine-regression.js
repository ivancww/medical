// Browser/Node-compatible regression fixtures for rules extracted from medicalclaims/main script.js.
(function(root){
'use strict';
function close(a,b){return Math.abs(a-b)<0.005}
function run(){const E=root.AVAMedicalClaimEngine;if(!E)throw Error('Claim engine missing');const results=[];
function t(name,input,expect){const r=E.calculate(input);const ok=Object.entries(expect).every(([path,v])=>{const got=path.split('.').reduce((o,k)=>o[k],r);return close(got,v)});results.push({name,ok,result:r,expect});}
t('Wise deductible',{wiseDeductible:8800,items:{item6:{actual:20000}}},{'wise.finalClaim':11200,'wise.outOfPocket':8800});
t('Flexi cap + SMM 85%',{items:{item6:{actual:10000}}},{'flexi.finalClaim':9287.5,'flexi.outOfPocket':712.5});
t('Flexi daily cap',{items:{item1:{actual:1500,days:2}}},{'flexi.finalClaim':2200,'flexi.outOfPocket':800});
t('Flexi tiered nursing',{items:{item8a:{actual:800,days:5}}},{'flexi.finalClaim':3851.2,'flexi.outOfPocket':148.8});
t('Flexi imaging coinsurance + SMM',{items:{item9:{actual:40000}}},{'flexi.finalClaim':37300,'flexi.outOfPocket':2700});
t('Flexi surgery dynamic cap',{items:{item2:{actual:50000}},context:{surgeryType:'major'}},{'flexi.finalClaim':46250,'flexi.outOfPocket':3750});
const officialRows=[{plan_id:'FLEXI',benefit_code:'item6',rule_type:'cap',limit:5250,enabled:true},{plan_id:'FLEXI',benefit_code:'item8a',rule_type:'tiered_daily_cap',limit:640,rate:.85,days_limit:3,enabled:true}];
const merged=E.mergedRules(officialRows);results.push({name:'Official rules overlay preserves verified parameters',ok:merged.flexi.item6.limit===5250&&merged.flexi.item8a.limit===640&&merged.flexi.item8a.tier_rate===.85&&merged.flexi.item8a.tier_days===3});
const officialCalc=E.calculate({officialRules:officialRows,items:{item6:{actual:10000}}});results.push({name:'Official rules calculation parity',ok:close(officialCalc.flexi.finalClaim,9287.5)&&close(officialCalc.flexi.outOfPocket,712.5)});
const failed=results.filter(x=>!x.ok);if(typeof console!=='undefined')console.table(results.map(x=>({test:x.name,pass:x.ok})));if(failed.length)throw Error(failed.length+' claim regression fixture(s) failed');return results}
root.runMedicalClaimRegression=run;if(typeof module!=='undefined'&&module.exports){module.exports={run};}
})(typeof window!=='undefined'?window:globalThis);