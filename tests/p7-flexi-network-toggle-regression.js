const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('app.js','utf8');
const getFunction=name=>{
 const start=source.indexOf('function '+name+'(');
 const end=source.indexOf('\nfunction ',start+1);
 assert.ok(start>=0,name+' exists');
 return source.slice(start,end>=0?end:undefined);
};
const sandbox={comparisonHasDisplayData:v=>Boolean(v&&(String(v.main_value||'').trim()||String(v.sub_value||'').trim()))};
vm.createContext(sandbox);
vm.runInContext(getFunction('planFeatureValue'),sandbox);
const item={values:{FLEXI:{
 DEFAULT:{main_value:'網絡服務保障',sub_value:'網絡條件'},
 FLEXI_NON_NETWORK:{main_value:'非網絡服務保障',sub_value:'非網絡條件'}
}}};
assert.deepEqual(Array.from(sandbox.planFeatureValue(item,'FLEXI',true,false)),['網絡服務保障','網絡條件']);
assert.deepEqual(Array.from(sandbox.planFeatureValue(item,'FLEXI',true,true)),['非網絡服務保障','非網絡條件']);
assert.deepEqual(Array.from(sandbox.planFeatureValue({values:{FLEXI:{DEFAULT:item.values.FLEXI.DEFAULT}}},'FLEXI',true,true)),['資料待核實','']);
assert.match(source,/flexiNonNetwork:false/);
assert.match(source,/state\.flexiNonNetwork=input\.checked;renderPage\(\)/);
assert.match(source,/class="flexi-network-toggle"/);
for(const hospital of ['聖德肋撒醫院','仁安醫院','香港浸信會醫院','聖保祿醫院'])assert.ok(source.includes(hospital),hospital);
assert.match(source,/FLEXI_NON_NETWORK.*comparisonCell\('FLEXI','FLEXI_NON_NETWORK'\)/);
console.log('AVF network/default toggle and Wise hospital labels passed');
