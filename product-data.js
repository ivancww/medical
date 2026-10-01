(function(root){
  'use strict';
  const PRODUCT_ORDER=['ELITE','WISE','FLEXI'];
  const TABLE_PREFIXES={ELITE:['尊耀','尊顯'],WISE:['睿選'],FLEXI:['男靈活計劃','女靈活計劃']};
  const GENDER_KEYS={male:'男靈活計劃',female:'女靈活計劃'};
  function enabled(value){return value?.enabled===undefined||value.enabled===true||String(value.enabled).toUpperCase()==='TRUE'}
  function rowsFor(official,id){return (official?.plans||[]).filter(x=>enabled(x)&&String(x.plan_id||'').toUpperCase()===id)}
  function ruleFor(official,id){return (official?.claimRules||official?.claim_rules||[]).find(x=>String(x.plan_id||'').toUpperCase()===id)}
  function tableEntries(official,id){
    const tables=official?.premiumTables||official?.premium_tables||{};
    return Object.entries(tables).filter(([key])=>TABLE_PREFIXES[id]?.some(prefix=>key.startsWith(prefix)));
  }
  function deductibleOptions(official,id){
    if(id==='FLEXI')return [];
    return tableEntries(official,id).map(([key])=>key.match(/(\d+)自付額$/)?.[1]).filter(Boolean).map(Number).filter(Number.isFinite).sort((a,b)=>a-b).filter((x,i,a)=>i===0||x!==a[i-1]);
  }
  function premiumTable(official,id,deductible,gender){
    const tables=official?.premiumTables||official?.premium_tables||{};
    const keys=id==='FLEXI'?[GENDER_KEYS[gender]]:tableEntries(official,id).map(([key])=>key).filter(key=>Number(key.match(/(\d+)自付額$/)?.[1])===Number(deductible));
    for(const key of keys)if(tables[key]&&typeof tables[key]==='object')return tables[key];
    return null;
  }
  function lookupPremium(official,id,{age,deductible=0,gender='male'}={}){
    if(!Number.isInteger(Number(age))||!Number.isInteger(Number(deductible)))return null;
    const table=premiumTable(official,id,deductible,gender), key=String(age);
    if(!table||!Object.prototype.hasOwnProperty.call(table,key))return null;
    const value=Number(table[key]);
    return Number.isFinite(value)&&value>=0?value:null;
  }
  function calculatePremium(annual,{vitality=false,vhis=false,mode='annual'}={}){
    if(!Number.isFinite(annual)||annual<0)return null;
    const discounted=Math.round(annual*(vitality?0.9:1));
    // Legacy premium presentation: 10% Vitality discount, separate HK$430 yearly fee,
    // monthly instalment factor 1.06, and an estimated tax benefit capped at HK$8,000.
    const charged=mode==='monthly'?Math.round(discounted*1.06/12):discounted;
    const taxEstimate=vhis?Math.round(Math.min(8000,discounted)*0.17):0;
    return {baseAnnual:annual,discountedAnnual:discounted,charged,period:mode==='monthly'?'month':'year',vitalityFeeAnnual:vitality?430:0,taxEstimate};
  }
  function getProductData(official){
    return PRODUCT_ORDER.map(id=>{
      const planRows=rowsFor(official,id), base=planRows.find(x=>String(x.record_type||'').toUpperCase()==='PLAN')||planRows[0]||{};
      return {id,name:base.plan_name||base.title||ruleFor(official,id)?.plan_name||id,rule:ruleFor(official,id)||null,deductibles:deductibleOptions(official,id),features:planRows.filter(x=>String(x.record_type||'').toUpperCase()==='FEATURE')};
    }).filter(x=>x.rule||x.name!==x.id);
  }
  root.AVAMedicalProductData={PRODUCT_ORDER,getProductData,deductibleOptions,lookupPremium,calculatePremium};
})(typeof window!=='undefined'?window:globalThis);
