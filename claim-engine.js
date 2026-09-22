(function(root){
'use strict';
const LEGACY_RULES={
 wise:{item1:{type:'full',hasDays:true},item2:{type:'full'},item3:{type:'full'},item4:{type:'full'},item5:{type:'full',hasDays:true},item6:{type:'full'},item7:{type:'full'},item8:{type:'full',hasDays:true},item8a:{type:'full',hasDays:true},item9:{type:'full'},item10:{type:'full'},item13:{type:'full',hasDays:true},item12:{type:'cash_benefit',hasDays:true},item11:{type:'per_visit_cap',limit:1000,hasDays:true},item14:{type:'cap',limit:40000},item15:{type:'cap',limit:100000}},
 flexi:{item6:{type:'cap',limit:5250,smm:true},item7:{type:'cap',limit:15000,smm:true},item10:{type:'cap',limit:96000},item14:{type:'cap',limit:33000},item1:{type:'daily_cap',limit:1100,hasDays:true},item5:{type:'daily_cap',limit:1100,hasDays:true},item8:{type:'daily_cap',limit:848,hasDays:true},item8a:{type:'tiered_daily_cap',limit:640,tier_days:3,tier_rate:.85,hasDays:true,smm:true},item9:{type:'coinsurance',rate:.70,annual_limit:22000,smm:true},item2:{type:'dynamic_cap',smm:true},item3:{type:'dynamic_cap',auto:true,smm:true},item4:{type:'dynamic_cap',auto:true,smm:true}}
};
const SURGERY={item2:{none:0,minor:5000,intermediate:14375,major:25000,complex:43750},item3:{none:0,minor:2125,intermediate:5000,major:8750,complex:10625},item4:{none:0,minor:2125,intermediate:5000,major:8750,complex:10625}};
function num(v,d=0){v=Number(v);return Number.isFinite(v)?v:d}
function truth(v){return v===true||String(v).toUpperCase()==='TRUE'}
function rulesFromOfficial(rows,planId){const plan=String(planId).toUpperCase();const out={};(rows||[]).filter(r=>String(r.plan_id||'').toUpperCase()===plan&&truth(r.enabled)).forEach(r=>{const key=r.benefit_code;if(!key)return;const x={type:r.rule_type};if(r.limit!=='')x.limit=num(r.limit);if(r.rate!=='')x.rate=num(r.rate);if(r.annual_limit!=='')x.annual_limit=num(r.annual_limit);if(r.days_limit!=='')x.days_limit=num(r.days_limit);out[key]=x});return out}
function mergedRules(officialRows){const wise={...LEGACY_RULES.wise},flexi={...LEGACY_RULES.flexi};const ow=rulesFromOfficial(officialRows,'WISE'),of=rulesFromOfficial(officialRows,'FLEXI');for(const [k,v] of Object.entries(ow))wise[k]={...wise[k],...v};for(const [k,v] of Object.entries(of))flexi[k]={...flexi[k],...v};return {wise,flexi}}
function calculatePlan(plan,rules,items,ctx={}){
 let claimableTotal=0,totalExpenditure=0,smmShortfall=0,wardCash=0; const details={};
 Object.keys(rules).forEach(key=>{const rule=rules[key],input=items[key]||{};let days=rule.hasDays?num(input.days,1):1,actual=num(input.actual);let expenditure=actual*days,reimbursement=0,currentLimit=rule.limit;
 if(rule.type==='cash_benefit'){}else totalExpenditure+=expenditure;
 if(rule.type==='dynamic_cap'&&plan==='flexi'){const surgeryType=ctx.surgeryType||'major'; if(key==='item2')currentLimit=SURGERY[key][surgeryType]||0; else currentLimit=(ctx[key+'Enabled']===false)?0:(SURGERY[key][surgeryType]||0)}
 if(rule.type==='full'||rule.type==='cash_benefit')reimbursement=expenditure;
 else if(rule.type==='cap'||rule.type==='dynamic_cap')reimbursement=Math.min(expenditure,currentLimit===undefined?0:currentLimit);
 else if(rule.type==='per_visit_cap')reimbursement=expenditure; // exact legacy behaviour
 else if(rule.type==='daily_cap')reimbursement=Math.min(expenditure,rule.limit*days);
 else if(rule.type==='tiered_daily_cap'){const d1=Math.min(days,rule.tier_days),d2=Math.max(0,days-rule.tier_days);reimbursement=Math.min(actual,rule.limit)*d1+(Math.min(actual,rule.limit)*rule.tier_rate)*d2}
 else if(rule.type==='coinsurance')reimbursement=Math.min(expenditure*rule.rate,rule.annual_limit||Infinity);
 const shortfall=expenditure-reimbursement;if(rule.smm&&shortfall>0)smmShortfall+=shortfall;if(key==='item12'&&plan==='wise')wardCash=reimbursement;else claimableTotal+=reimbursement;details[key]={expenditure,reimbursement,shortfall,currentLimit};
 });
 return {claimableTotal,totalExpenditure,smmShortfall,wardCash,details};
}
function calculate(input){
 const rules=mergedRules(input.officialRules||[]);const wise=calculatePlan('wise',rules.wise,input.items||{},input.context||{}),flexi=calculatePlan('flexi',rules.flexi,input.items||{},input.context||{});
 const deductible=num(input.wiseDeductible);const wiseFinalClaim=Math.max(0,wise.claimableTotal-deductible),wiseOOP=Math.max(0,wise.totalExpenditure-wiseFinalClaim);
 const smm=Math.min(flexi.smmShortfall*.85,120000),flexiFinalClaim=flexi.claimableTotal+smm,flexiOOP=Math.max(0,flexi.totalExpenditure-flexiFinalClaim);
 return {wise:{...wise,deductible,finalClaim:wiseFinalClaim,outOfPocket:wiseOOP},flexi:{...flexi,smm,finalClaim:flexiFinalClaim,outOfPocket:flexiOOP}};
}
root.AVAMedicalClaimEngine={LEGACY_RULES,SURGERY,rulesFromOfficial,mergedRules,calculatePlan,calculate};
})(typeof window!=='undefined'?window:globalThis);