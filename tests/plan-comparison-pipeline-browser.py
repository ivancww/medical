"""Transport/cache/UI regression; optional captured live JSON is labelled separately."""
import copy
import json
import os
import threading
from http.server import ThreadingHTTPServer
from pathlib import Path
from importlib.util import spec_from_file_location, module_from_spec
from playwright.sync_api import sync_playwright
spec=spec_from_file_location('hub',Path(__file__).with_name('guided-plan-hub-browser.py'))
hub=module_from_spec(spec);spec.loader.exec_module(hub)
ROOT=Path(__file__).resolve().parents[1]
CHECKS=0

def check(value,label):
    global CHECKS
    assert value,label
    CHECKS+=1
    print('PASS',label,flush=True)

def run():
    server=ThreadingHTTPServer(('127.0.0.1',0),hub.fixture.QuietHandler)
    threading.Thread(target=server.serve_forever,daemon=True).start()
    with sync_playwright() as pw:
        browser=pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or None,args=['--no-sandbox'])
        errors=[]
        def case(cached,remote,offline=False):
            context=browser.new_context(viewport={'width':1180,'height':820},service_workers='block')
            seed="localStorage.setItem('ava.medical.user.overrides.v1',JSON.stringify({R07:{title:'Synthetic local title'}}));"
            if cached is not None:seed+="localStorage.setItem('ava.medical.official.v1',"+json.dumps(json.dumps(cached,ensure_ascii=False))+');'
            context.add_init_script(seed)
            page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
            page.route('https://ivancww.github.io/avaplatform/design-system/*.css',lambda r:r.fulfill(path=str(hub.MOTHER/'design-system'/r.request.url.split('/')[-1]),content_type='text/css'))
            requests=[]
            def route(r):
                requests.append(r.request.url)
                if offline:r.abort();return
                data={k:remote[k] for k in ['version','revision'] if k in remote} if 'checkVersion' in r.request.url else remote
                r.fulfill(status=200,content_type='application/json',body=json.dumps({'status':'success',**data}))
            page.route('**/exec**',route)
            page.goto(f'http://127.0.0.1:{server.server_port}/',wait_until='networkidle')
            hub.at(page,'R07')
            return context,page,requests
        base=copy.deepcopy(hub.OFFICIAL)
        context,page,requests=case(base,base)
        check(len(requests)==1 and page.locator('.plan-feature').count()==3,'Unchanged Official revision reuses comparison cache and keeps three cards')
        context.close()
        for key in ['planComparison','plan_comparison']:
            remote=copy.deepcopy(base);remote['version']='synthetic-refresh';remote['revision']='synthetic-r2'
            rows=remote.pop('planComparison');rows[0]['main_value']='Synthetic updated Elite'
            remote[key]=rows
            if key=='plan_comparison':remote['planComparison']=[]
            context,page,requests=case(base,remote)
            check(len(requests)==2 and page.evaluate('state.official.version')=='synthetic-refresh',key+' version change refreshes Official cache')
            check('Synthetic updated Elite' in page.locator('.product-comparison').inner_text(),key+' fresh data appears in the Elite comparison column')
            check(page.locator('#pageCard h2').inner_text()=='Synthetic local title',key+' refresh preserves User text override')
            check(page.locator('.comparison-data-status').count()==0,key+' valid data is not labelled as missing')
            page.locator('[data-condition-key="preapproval"]').uncheck()
            check('fixture WISE general-room' in page.locator('.product-comparison').inner_text(),key+' Wise condition mapping uses general-room data')
            context.close()
        for kind in ['empty','missing','offline','invalid']:
            remote=copy.deepcopy(base);remote['revision']='synthetic-'+kind
            if kind=='empty':remote['planComparison']=[]
            if kind=='missing':del remote['planComparison']
            if kind=='invalid':remote={'version':'invalid','revision':'invalid'}
            context,page,requests=case(base,remote,kind=='offline')
            message=page.locator('.comparison-data-status').inner_text()
            if kind=='empty':check('暫未提供' in message and '未能連線' not in message,'Explicit empty data differs from connection failure')
            if kind=='missing':check('尚未載入' in message and '暫未提供' not in message,'Missing payload field is not presented as an empty Sheet')
            if kind in ['offline','invalid']:
                check(('未能連線' if kind=='offline' else '資料格式有誤') in message and '本機已儲存' in message,kind+' failure visibly identifies its cause and retained local data')
                check('fixture ELITE value' in page.locator('.product-comparison').inner_text(),kind+' retains cached comparison values')
                check(page.evaluate('JSON.parse(localStorage.getItem(CACHE_KEY)).revision')==base['revision'],kind+' failure cannot overwrite the last valid cache')
            check(page.locator('.plan-feature').count()==3,kind+' data state preserves the existing cards')
            if kind in ['missing','offline']:hub.screenshot(page,'plan-comparison-'+kind+'-synthetic')
            context.close()
        live_path=os.environ.get('MEDICAL_LIVE_OFFICIAL_PATH')
        if live_path:
            payload=json.loads(Path(live_path).read_text())
            context,page,requests=case(None,payload)
            rows=page.evaluate('officialComparisonRows()')
            check(bool(rows),'Captured live deployed response contains Plan Comparison')
            check(page.locator('.plan-feature').count()==3,'Captured live payload renders existing three parallel cards')
            for qualified,nonnetwork in [(True,False),(False,False),(True,True),(False,True)]:
                page.evaluate('''({qualified,nonnetwork})=>{state.wiseConditions={hospital:qualified,networkDoctor:true,preapproval:true};state.flexiNonNetwork=nonnetwork;renderPage()}''',{'qualified':qualified,'nonnetwork':nonnetwork})
                expected_state={'ELITE':'DEFAULT','WISE':'WISE_SEMI_PRIVATE' if qualified else 'WISE_GENERAL_ROOM','FLEXI':'FLEXI_NON_NETWORK' if nonnetwork else 'DEFAULT'}
                applicable=[r for r in rows if (r.get('enabled') is True or str(r.get('enabled','TRUE')).upper()=='TRUE') and (str(r.get('main_value','')).strip() or str(r.get('sub_value','')).strip()) and str(r.get('condition_state','')).strip().upper()==expected_state.get(str(r.get('plan_id','')).strip().upper())]
                for row in applicable:
                    item=page.locator('.comparison-row').filter(has=page.get_by_text(row['item_name'],exact=True))
                    plan=str(row['plan_id']).strip().upper()
                    check(item.locator(f'[data-plan-column="{plan}"] strong').inner_text()==str(row.get('main_value','')),'Captured live '+plan+' cell maps '+row['item_key']+'/'+row['condition_state'])
                check(page.evaluate('document.documentElement.scrollWidth<=innerWidth'),'Captured live comparison has no horizontal overflow')
            hub.screenshot(page,'captured-live-plan-comparison')
            print('CAPTURED_LIVE_ROWS',len(rows),flush=True)
            context.close()
        else:print('LIVE UI replay NOT TESTED: no captured live payload supplied',flush=True)
        check(not errors,'No browser JavaScript errors')
        print(f'{CHECKS} Plan Comparison browser checks PASS',flush=True)
        browser.close()
    server.shutdown()
if __name__=='__main__':run()
