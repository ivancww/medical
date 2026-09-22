(function(root){
'use strict';
function num(v,d=0){v=Number(v);return Number.isFinite(v)?v:d}
function truth(v){return v===true||String(v).toUpperCase()==='TRUE'}
function normalize(rows){const out={};(rows||[]).forEach(r=>{const id=String(r.plan_id||'').toUpperCase();if(!id)return;out[id]={planId:id,planName:r.plan_name||id,method:r.illustration_method||'',rate:num(r.default_rate,1),deductibleEnabled:truth(r.deductible_enabled),note:r.note||''}});return out}
function calculate(input={}){const rules=normalize(input.officialRules||[]),cost=Math.max(0,num(input.medicalCost)),company=Math.min(cost,Math.max(0,num(input.companyPaid))),remaining=Math.max(0,cost-company),deductible=Math.max(0,num(input.deductible));const results={};for(const [id,r] of Object.entries(rules)){let planPay=0;if(r.method==='percentage')planPay=remaining*Math.max(0,Math.min(1,r.rate));else if(r.method==='deductible_then_cover')planPay=Math.max(0,remaining-(r.deductibleEnabled?deductible:0))*Math.max(0,Math.min(1,r.rate));planPay=Math.min(remaining,planPay);results[id]={...r,medicalCost:cost,companyPaid:company,remainingBeforePlan:remaining,deductible:r.deductibleEnabled?deductible:0,planPay,youPay:Math.max(0,remaining-planPay)}}return results}
root.AVAMedicalClaimEngine={normalize,calculate};
})(typeof window!=='undefined'?window:globalThis);