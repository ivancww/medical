const assert=require('node:assert/strict');
require('../claim-engine.js');
const E=globalThis.AVAMedicalClaimEngine;
const base={illustration_method:'deductible_then_cover',deductible_enabled:true,default_rate:1};
const rules=['ELITE','WISE'].map(plan_id=>({...base,plan_id}));
rules.push({plan_id:'FLEXI',illustration_method:'percentage',deductible_enabled:false,default_rate:.85});
for(const [company,credit,remainingDeductible,pay,own] of [[80000,16000,0,20000,0],[10000,10000,6000,84000,6000],[0,0,16000,84000,16000],[16000,16000,0,84000,0],[20000,16000,0,80000,0],[120000,16000,0,0,0]]){
 const result=E.calculate({officialRules:rules,medicalCost:100000,companyPaid:company,deductible:16000});
 for(const id of ['ELITE','WISE']){
  assert.equal(result[id].deductibleCredit,credit,id);
  assert.equal(result[id].remainingDeductible,remainingDeductible,id);
  assert.equal(result[id].planPay,pay,id);
  assert.equal(result[id].youPay,own,id);
  assert.equal(result[id].companyPaid+result[id].planPay+result[id].youPay,100000,'no double counting');
 }
 assert.equal(result.FLEXI.planPay,Math.max(0,100000-Math.min(100000,company))*.85);
 assert.equal(result.FLEXI.deductibleCredit,0);
}
const calc=(rule,input={})=>E.calculate({officialRules:[{...base,plan_id:'WISE',...rule}],medicalCost:100000,companyPaid:10000,deductible:16000,...input}).WISE;
assert.equal(calc({}).needsVerification,false);
assert.equal(calc({}).planPay,84000,'base official rules support deductible credit without new claim-sheet flags');
assert.equal(calc({}).youPay,6000);
assert.equal(calc({},{eligibleCompanyPaid:3000}).planPay,77000,'only eligible company payment offsets deductible');
assert.equal(calc({default_rate:.8}).planPay,67200,'preserve Official reimbursement rate');
assert.equal(calc({company_deductible_offset_allowed:false}).planPay,84000,'legacy/unpublished offset flag cannot block the existing customer illustration');
assert.equal(calc({},{companyPaid:0}).planPay,84000);
assert.equal(calc({},{deductible:0}).planPay,90000);
for(const cost of [-100,0,1000,100000])for(const companyPaid of [-1,0,10000,200000])for(const deductible of [-1,0,16000,200000]){
 for(const x of Object.values(E.calculate({officialRules:rules,medicalCost:cost,companyPaid,deductible}))){
  assert.ok(x.planPay>=0&&x.youPay>=0);
  assert.ok(Math.abs(x.companyPaid+x.planPay+x.youPay-Math.max(0,cost))<1e-8);
 }
}
console.log('Deductible credit examples, sheet-independent illustration, bounded payouts and unchanged Flexi PASS');
