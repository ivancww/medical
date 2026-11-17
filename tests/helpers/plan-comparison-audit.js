// Read-only audit of a captured Official payload; never writes Sheet data.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'../..');
function enabled(r){return r.enabled===undefined||r.enabled===true||String(r.enabled).toUpperCase()==='TRUE'}
function summarize(rows){
 const tuples=rows.map(r=>['comparison_id','item_key','item_name','plan_id','condition_state','main_value','sub_value'].map(k=>String(r[k]??'')).concat(enabled(r)));
 tuples.sort((a,b)=>JSON.stringify(a)<JSON.stringify(b)?-1:JSON.stringify(a)>JSON.stringify(b)?1:0);
 const count=key=>rows.reduce((out,r)=>(out[String(r[key]??'')]=(out[String(r[key]??'')]||0)+1,out),{});
 return {rows:rows.length,enabled:rows.filter(enabled).length,byPlan:count('plan_id'),byState:count('condition_state'),itemKeys:[...new Set(rows.map(r=>String(r.item_key||'').trim()))].sort(),displayDigest:crypto.createHash('sha256').update(JSON.stringify(tuples)).digest('hex'),duplicateIds:[...new Set(rows.filter((r,i)=>rows.findIndex(x=>x.comparison_id===r.comparison_id)!==i).map(r=>r.comparison_id))]};
}
function appContext(){
 const elements=new Map(),storage=new Map(),session=new Map();
 const context={window:{location:{search:''}},document:{querySelector:s=>{if(!elements.has(s))elements.set(s,{textContent:'',className:'',hidden:false});return elements.get(s)},querySelectorAll:()=>[]},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},sessionStorage:{getItem:k=>session.get(k)||null,setItem:(k,v)=>session.set(k,v),removeItem:k=>session.delete(k)},console,Intl,URLSearchParams};
 vm.createContext(context);
 vm.runInContext(fs.readFileSync(path.join(root,'product-data.js'),'utf8'),context);
 const app=fs.readFileSync(path.join(root,'app.js'),'utf8');vm.runInContext(app.slice(0,app.indexOf('setEntry();')),context);
 return {context,storage,elements,run:code=>vm.runInContext(code,context)};
}
function auditPayload(payload){
 const h=appContext();h.context.payload=payload;
 h.run('state.official=payload');
 assert.equal(h.run('isValidOfficialData(payload)'),true,'Full Official response must retain pages/options/version');
 assert.equal(h.run('officialComparisonSource().provided'),true,'Deployed bootstrap omitted Plan Comparison dataset');
 const rows=h.run('officialComparisonRows()');assert.ok(rows.length,'Deployed Plan Comparison dataset is empty');
 const applicable=rows.filter(r=>enabled(r)&&String(r.main_value??'').trim()+String(r.sub_value??'').trim());
 const items=h.run('officialComparisonItems()');
 for(const id of ['ELITE','WISE','FLEXI'])assert.ok(applicable.some(r=>String(r.plan_id).trim().toUpperCase()===id),'Missing enabled comparison rows for '+id);
 for(const row of applicable){
  const id=String(row.plan_id||'').trim().toUpperCase(),condition=String(row.condition_state||'').trim().toUpperCase(),key=String(row.item_key||'').trim();
  assert.ok(key,'Enabled display row has no item_key');
  assert.ok(({ELITE:['DEFAULT'],WISE:['WISE_SEMI_PRIVATE','WISE_GENERAL_ROOM'],FLEXI:['DEFAULT','FLEXI_NON_NETWORK']})[id]?.includes(condition),'Unmapped plan/condition '+id+'/'+condition);
  const item=items.find(x=>x.item_key===key);assert.ok(item,'Enabled applicable item filtered: '+key);
  h.context.auditItem=item;h.context.auditId=id;h.context.auditCondition=condition;
  const value=h.run("planFeatureValue(auditItem,auditId,auditCondition==='WISE_SEMI_PRIVATE',auditCondition==='FLEXI_NON_NETWORK')");
  assert.deepEqual(Array.from(value),[String(row.main_value??''),String(row.sub_value??'')],key+'/'+id+'/'+condition+' must reach the selected UI cell without a verified flag gate');
 }
 const html=h.run('planFeaturesBlockV2()');
 for(const id of ['ELITE','WISE','FLEXI'])assert.ok(html.includes('data-plan-column="'+id+'"'),'Missing existing plan column '+id);
 return summarize(Array.from(rows));
}
if(require.main===module){
 const files=process.argv.slice(2);assert.ok(files.length,'Pass captured full Official JSON, optionally followed by dataset alias JSON files');
 const payload=JSON.parse(fs.readFileSync(files[0],'utf8')),result=auditPayload(payload);
 console.log('LIVE_PLAN_COMPARISON_AUDIT '+JSON.stringify(result));
 for(const file of files.slice(1)){
  const alias=JSON.parse(fs.readFileSync(file,'utf8'));assert.equal(alias.status,'success');assert.ok(Array.isArray(alias.data));
  assert.equal(summarize(alias.data).displayDigest,result.displayDigest,'Dataset alias differs from full Official bootstrap: '+file);
  console.log('LIVE_ALIAS_MATCH '+file+' '+alias.data.length);
 }
}
module.exports={summarize,appContext,auditPayload};
