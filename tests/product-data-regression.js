const assert=require('node:assert/strict');
require('../product-data.js');
const P=globalThis.AVAMedicalProductData;
const official={
  plans:[
    {plan_id:'ELITE',record_type:'PLAN',plan_name:'尊耀醫療計劃'},
    {plan_id:'WISE',record_type:'PLAN',plan_name:'睿選醫療計劃'},
    {plan_id:'FLEXI',record_type:'PLAN',plan_name:'靈活醫療計劃'}
  ],
  claimRules:[
    {plan_id:'ELITE',illustration_method:'deductible_then_cover'},
    {plan_id:'WISE',illustration_method:'deductible_then_cover'},
    {plan_id:'FLEXI',illustration_method:'percentage',default_rate:.85}
  ],
  premiumTables:{
    '尊顯0自付額':{'35':21024},
    '尊顯16000自付額':{'35':8612},
    '尊顯25000自付額':{'35':8352},
    '睿選0自付額':{'35':14592},
    '睿選8800自付額':{'35':7064},
    '睿選18000自付額':{'35':5518},
    '睿選30000自付額':{'35':5024},
    '男靈活計劃':{'35':7372.8},
    '女靈活計劃':{'35':7099.6}
  }
};
assert.deepEqual(P.getProductData(official).map(p=>p.id),['ELITE','WISE','FLEXI']);
assert.deepEqual(P.deductibleOptions(official,'ELITE'),[0,16000,25000]);
assert.deepEqual(P.deductibleOptions(official,'WISE'),[0,8800,18000,30000]);
assert.deepEqual(P.deductibleOptions(official,'FLEXI'),[]);
assert.equal(P.lookupPremium(official,'ELITE',{age:35,deductible:0}),21024);
assert.equal(P.lookupPremium(official,'ELITE',{age:35,deductible:16000}),8612);
assert.equal(P.lookupPremium(official,'ELITE',{age:35,deductible:25000}),8352);
assert.equal(P.lookupPremium(official,'WISE',{age:35,deductible:18000}),5518);
assert.equal(P.lookupPremium(official,'FLEXI',{age:35,gender:'male'}),7372.8);
assert.equal(P.lookupPremium(official,'FLEXI',{age:35,gender:'female'}),7099.6);
assert.equal(P.lookupPremium(official,'WISE',{age:36,deductible:18000}),null);
assert.equal(P.lookupPremium(official,'WISE',{age:35.5,deductible:18000}),null);
assert.equal(P.lookupPremium(official,'WISE',{age:35,deductible:9000}),null);
assert.equal(P.lookupPremium(official,'FLEXI',{age:35,gender:'other'}),null);
const annual=P.calculatePremium(10000,{vitality:true,vhis:true});
assert.equal(annual.charged,9000);
assert.equal(annual.vitalityFeeAnnual,430);
assert.equal(annual.taxEstimate,1360);
assert.equal(P.calculatePremium(10000,{vitality:true,mode:'monthly'}).charged,795);
assert.equal(P.calculatePremium(10000,{vitality:true,vhis:true}).charged,9000);
console.log('Product identity, exact lookup, discounts, tax distinction and payment-mode checks passed');
