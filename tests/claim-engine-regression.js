(function(root){'use strict';
function close(a,b){return Math.abs(a-b)<0.005}
function run(){const E=root.AVAMedicalClaimEngine;if(!E)throw Error('Claim illustration engine missing');const rules=[
{plan_id:'ELITE',plan_name:'尊耀醫療計劃',illustration_method:'deductible_then_cover',default_rate:1,deductible_enabled:true},
{plan_id:'WISE',plan_name:'睿選醫療計劃',illustration_method:'deductible_then_cover',default_rate:1,deductible_enabled:true},
{plan_id:'FLEXI',plan_name:'靈活醫療計劃',illustration_method:'percentage',default_rate:.85,deductible_enabled:false}
];const a=E.calculate({officialRules:rules,medicalCost:100000,deductible:8800});const b=E.calculate({officialRules:rules,medicalCost:100000,companyPaid:30000,deductible:8800});const results=[
{name:'Elite deductible illustration',ok:close(a.ELITE.planPay,91200)&&close(a.ELITE.youPay,8800)},
{name:'Wise deductible illustration',ok:close(a.WISE.planPay,91200)&&close(a.WISE.youPay,8800)},
{name:'Flexi 85% illustration',ok:close(a.FLEXI.planPay,85000)&&close(a.FLEXI.youPay,15000)},
{name:'Company then personal coordination',ok:close(b.FLEXI.planPay,59500)&&close(b.FLEXI.youPay,10500)}
];console.table(results.map(x=>({test:x.name,pass:x.ok})));const failed=results.filter(x=>!x.ok);if(failed.length)throw Error(failed.length+' illustration regression fixture(s) failed');return results}
root.runMedicalClaimRegression=run;if(typeof module!=='undefined'&&module.exports)module.exports={run};
})(typeof window!=='undefined'?window:globalThis);