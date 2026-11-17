"""Real Chromium regressions. All Official-looking data below is a synthetic fixture."""
import copy
import itertools
import json
import os
import threading
from http.server import ThreadingHTTPServer
from pathlib import Path
from playwright.sync_api import sync_playwright
from importlib.util import spec_from_file_location, module_from_spec

spec = spec_from_file_location('medical_fixture', Path(__file__).with_name('ready-product-browser.py'))
fixture = module_from_spec(spec)
spec.loader.exec_module(fixture)
OFFICIAL = copy.deepcopy(fixture.OFFICIAL)
OFFICIAL['revision'] = 'synthetic-qa-fixture'
TITLES = {'R03': '公司醫療可以幫到幾多？', 'R05': '公司醫療與個人醫療點樣配合？', 'R07': '三個醫療計劃', 'R09': '保費參考'}
for row in OFFICIAL['pages']:
    row['title'] = TITLES.get(row['page_id'], row['title'])
OFFICIAL['claimCases'] = []
QUESTIONS = ['如果有一日轉工、離職或者退休，現有公司醫保仲可唔可以繼續保障你？', '如果曾經做過手術或者患過疾病，到時先買個人醫保，仲可唔可以獲得全面保障？']
IDS = ['ELITE', 'WISE', 'FLEXI']
ROOT = Path(__file__).resolve().parents[1]
MOTHER = Path(os.environ.get('AVA_MOTHER_ROOT', ROOT.parent / 'avaplatform'))
SHOTS = Path(os.environ.get('MEDICAL_QA_SCREENSHOTS', ROOT / 'docs/qa/v1.2.12'))
CHECKS = 0


def check(condition, label):
    global CHECKS
    assert condition, label
    CHECKS += 1
    print('PASS', label, flush=True)


def at(page, page_id, journey='ready'):
    page.evaluate('''({id,journey})=>{
        state.planHubOpen=false; state.planHubSection='plans'; state.journey=journey;
        state.index=journeyPages(journey).findIndex(p=>pageId(p)===id);
        document.querySelector('#home').hidden=true;document.querySelector('#journey').hidden=false;
        renderPage();
    }''', {'id': page_id, 'journey': journey})


def section(page, key):
    page.locator(f'[data-hub-section="{key}"]').click()


def screenshot(page, name):
    SHOTS.mkdir(parents=True, exist_ok=True)
    page.evaluate('window.scrollTo(0,0)')
    page.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))')
    page.screenshot(path=str(SHOTS / f'{name}.png'), full_page=True)


def run():
    server = ThreadingHTTPServer(('127.0.0.1', 0), fixture.QuietHandler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    errors = []
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or None, args=['--no-sandbox'])
            context = browser.new_context(viewport={'width': 1180, 'height': 820}, service_workers='block')
            context.add_init_script("localStorage.setItem('ava.medical.official.v1',JSON.stringify(" + json.dumps(OFFICIAL, ensure_ascii=False) + '));')
            page = context.new_page()
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.route('**/exec**', lambda route: route.fulfill(status=200, content_type='application/json', body=json.dumps({'status': 'success', **OFFICIAL})))
            # The actual canonical CSS, pinned to the inspected Mother checkout for repeatability.
            page.route('https://ivancww.github.io/avaplatform/design-system/*.css', lambda route: route.fulfill(path=str(MOTHER / 'design-system' / route.request.url.split('/')[-1]), content_type='text/css'))
            page.goto(f'http://127.0.0.1:{server.server_port}/', wait_until='networkidle')
            page.locator('[data-journey="ready"]').click()
            check(page.evaluate("journeyPages('ready').map(pageId)") == ['R01','R02','R03','R05','R07','R08','FINAL_SUMMARY'], 'Ready pages omit R04/R09 and count active pages')
            page.locator('[data-key="concern"]').click()
            page.locator('[data-key="no_medical"]').click()
            check(page.evaluate('state.renderedPageId') == 'R05', 'No medical skips conditional R03 and retired R04')
            r05_palette = page.locator('.claim-bar').first.evaluate("e=>['plan','customer'].map(c=>getComputedStyle(e.querySelector('.'+c)).backgroundColor)")
            page.locator('#backBtn').click()
            page.locator('[data-key="company_medical"]').click()
            check(page.evaluate('state.renderedPageId') == 'R03', 'Company medical includes R03')
            check(page.locator('.company-reflection-questions article').count() == 2 and page.locator('.company-reflection-questions p').all_inner_texts() == ['💭 '+q for q in QUESTIONS], 'Exactly two reflection cards with emoji and exact Chinese wording')
            check(page.locator('.company-reflection-questions').inner_text().replace('\n', '') == ''.join('💭 '+q for q in QUESTIONS), 'Question area has only the two emoji-prefixed sentences')
            check(page.locator('.company-reimbursement-bar').evaluate("e=>['plan','customer'].map(c=>getComputedStyle(e.querySelector('.'+c)).backgroundColor)") == r05_palette, 'R03 insurer/customer colors match the accepted R05 palette')
            for cost, coverage, rate, paid in [(100000,80000,80,64000),(50000,80000,80,40000),(100000,80000,0,0),(100000,80000,100,80000),(100000,0,80,0),(0,80000,80,0),(100000,1000,100,1000),(100000,99000,100,99000)]:
                page.locator('#companyMedicalExpense').fill(str(cost))
                page.locator('#companyCoverage').fill(str(coverage))
                page.locator('#companyRate').fill(str(rate))
                amounts = page.locator('#companyMedicalBreakdown strong').all_inner_texts()
                check(amounts == [fixture_money(cost),fixture_money(paid),fixture_money(cost-paid)] and page.evaluate('state.companyPaid') == paid, f'Company live breakdown {cost}/{coverage}/{rate}%')
                check_company_bar(page,f'Company {cost}/{coverage}/{rate}%')
            page.locator('#companyMedicalExpense').fill('100000')
            page.locator('#companyCoverage').fill('80000')
            page.locator('#companyRate').fill('80')
            screenshot(page, 'ipad-landscape-r03')
            page.locator('#viewPlansBtn').click()
            check(page.evaluate("state.journey==='ready'&&state.index===2&&state.planHubOpen") and page.locator('[data-hub-section="plans"]').get_attribute('aria-current') == 'page', 'Guided shortcut opens default Hub without changing journey position')
            check(page.locator('.plan-feature').count() == 3 and page.locator('.product-positioning').evaluate("e=>getComputedStyle(e).gridTemplateColumns.split(' ').length") == 3, 'Existing three parallel plan cards remain')
            screenshot(page, 'ipad-landscape-plan-hub')
            for combination in itertools.product([False, True], repeat=3):
                section(page, 'plans')
                for id, selected in zip(IDS, combination):
                    page.locator(f'[data-plan-id="{id}"]').set_checked(selected)
                section(page, 'premiums')
                actual = page.locator('.premium-result').evaluate_all('es=>es.map(e=>e.dataset.productId)')
                check(actual == [id for id, selected in zip(IDS, combination) if selected], f'Premium cards exactly match {combination}')
                check(page.locator('.premium-selection-required').count() == (0 if any(combination) else 1), 'Empty selection requires plan selection')
                check(page.locator('.plan-visibility-toggle').count() == 0, 'Premium has no independent plan selection checkboxes')
                check(page.locator('#premiumEliteDeductible').count() == int(combination[0]) and page.locator('#premiumWiseDeductible').count() == int(combination[1]), 'No unselected premium deductible controls')
            page.locator('#premiumAge').fill('35')
            page.locator('#premiumAge').dispatch_event('change')
            page.locator('#premiumGender').select_option('female')
            page.locator('#premiumEliteDeductible').select_option('25000')
            page.locator('#premiumWiseDeductible').select_option('18000')
            page.locator('#premiumVitality').check()
            page.locator('#premiumVhis').check()
            page.locator('#premiumMode').select_option('monthly')
            section(page, 'claims')
            check(page.locator('.empty-official').count() == 1 and '非真實個案' in page.locator('#pageCard').inner_text(), 'Empty real-case state appears only beside labelled simulation in Hub')
            page.locator('#claimCostDirect').fill('120000')
            page.locator('#eliteDeductible').select_option('16000')
            screenshot(page, 'ipad-landscape-claim-hub')
            # Remain in the Hub and on its section after a reload / SW-style resume.
            page.reload(wait_until='networkidle')
            check(page.evaluate('state.planHubOpen&&state.planHubSection==="claims"') and page.locator('#claimCostDirect').input_value() == '120,000', 'Reload resumes Hub section and edited claim amount')
            section(page, 'premiums')
            check(page.locator('#premiumAge').input_value() == '35' and page.locator('#premiumGender').input_value() == 'female' and page.locator('#premiumWiseDeductible').input_value() == '18000' and page.locator('#premiumVitality').is_checked() and page.locator('#premiumVhis').is_checked() and page.locator('#premiumMode').input_value() == 'monthly', 'Premium age/gender/deductibles/discounts/payment state persists across sections and reload')
            page.locator('#returnGuidedFlowBtn').click()
            check(page.evaluate('state.renderedPageId==="R03"&&!state.planHubOpen') and page.locator('#companyMedicalExpense').input_value() == '120,000' and page.locator('#companyRate').input_value() == '80', 'Hub returns to exact R03 with live edited inputs')
            page.locator('#nextBtn').click()
            check(page.evaluate('state.renderedPageId') == 'R05' and page.locator('.claim-flow strong').all_inner_texts() == ['HK$120,000','HK$64,000','HK$56,000'], 'R03 advances directly to R05 and passes actual reimbursement')
            check(page.locator('[data-product-id="ELITE"] .you-pay strong').inner_text() == fixture_money(0), 'Existing Official columns calculate company-deductible credit without new claim-sheet flags')
            check('待核實' not in page.locator('[data-product-id="ELITE"] .you-pay').inner_text(), 'Simplified claim illustration remains usable before Claims Sheet update')
            screenshot(page, 'ipad-landscape-r05-unverified')
            # Use the normal production-shaped Claim_Rules fixture; no offset flags.
            page.evaluate("state.claimCost=100000;state.companyCoverage=80000;state.companyRate=100;renderPage()")
            for company, expected in [(80000,0),(10000,6000),(0,16000),(16000,0),(20000,0)]:
                page.evaluate('paid=>{state.companyCoverage=paid;state.eliteDeductible=16000;renderPage()}', company)
                check(page.locator('[data-product-id="ELITE"] .you-pay strong').inner_text() == fixture_money(expected), f'R05 original cards use corrected deductible coordination at company {company}')
                check(page.locator('[data-product-id="FLEXI"] .you-pay strong').inner_text() == fixture_money((100000-company)*.15), 'Flexi independently keeps Official 85% rate')
            page.evaluate('state.companyCoverage=80000;renderPage()')
            screenshot(page, 'ipad-landscape-r05-verified-fixture')
            page.locator('#nextBtn').click()
            check(page.evaluate('state.renderedPageId') == 'R07', 'Normal Ready progression enters Hub')
            section(page, 'premiums')
            page.locator('#nextBtn').click()
            check(page.evaluate('state.renderedPageId') == 'R08', 'Next leaves Hub for reflection without sequential premium/claim steps')
            page.locator('#backBtn').click()
            check(page.evaluate('state.renderedPageId') == 'R07', 'Back enters default plan section')
            # Every active page has a working bidirectional shortcut, including Not Ready.
            for journey in ['ready','notready']:
                ids=page.evaluate('j=>journeyPages(j).map(pageId)',journey)
                for id in ids:
                    if id=='R07':continue
                    at(page,id,journey)
                    page.locator('#viewPlansBtn').click()
                    section(page,'premiums')
                    page.locator('#returnGuidedFlowBtn').click()
                    check(page.evaluate('state.renderedPageId')==id and page.evaluate('state.journey')==journey,f'Exact return to {journey}/{id}')
            at(page,'N07','notready')
            page.evaluate('state.returnedFromPlanInfo=false')
            page.locator('[data-key="future_insurance"]').click()
            check(page.evaluate('state.planHubOpen&&state.journey==="notready"'), 'N07 conditional insurance route opens Hub in same session')
            page.locator('#backBtn').click()
            check(page.evaluate('state.renderedPageId==="N07"&&state.returnedFromPlanInfo') and page.locator('#nextBtn').inner_text()=='查看總結','N07 returns with summary route preserved')
            page.locator('#nextBtn').click()
            check(page.evaluate('state.renderedPageId')=='NOTREADY_FINAL_SUMMARY','Not Ready completes its own summary')
            # Old snapshots retain stable IDs while mapping removed active pages to safe successors.
            for old_id,new_id in [('R04','R05'),('R09','R07')]:
                page.evaluate('id=>{const saved=journeySessionSnapshot();saved.journey="ready";saved.pageId=id;saved.planHubOpen=false;restoreJourneySnapshot(saved);renderPage()}',old_id)
                check(page.evaluate("pageId(journeyPages('ready')[state.index])")==new_id,f'Legacy {old_id} snapshot maps to {new_id}')
            # Publish only fixture cases, ensure no unverified or disabled case can enter real-case area.
            page.evaluate('''()=>{state.official.claimCases=[
                {case_title:'Synthetic verified A',enabled:true,verified:true,medical_cost:100,actual_reimbursement:80},
                {case_title:'Synthetic verified B',enabled:true,verified:true,medical_cost:200,actual_reimbursement:150},
                {case_title:'unverified',enabled:true,verified:false,medical_cost:100,actual_reimbursement:80},
                {case_title:'disabled',enabled:false,verified:true,medical_cost:100,actual_reimbursement:80},
                {case_title:'incomplete',enabled:true,verified:true,medical_cost:'',actual_reimbursement:''}];openPlanHub()}''')
            section(page,'claims')
            check(page.locator('.claim-case h3').all_inner_texts()==['Synthetic verified A','Synthetic verified B'],'Hub displays all and only verified enabled real-case fixtures')
            page.evaluate('state.official.claimCases=[];state.answers.R02="company_medical";state.planVisibility={ELITE:true,WISE:true,FLEXI:true}')
            for name,width,height in [('ipad-landscape',1180,820),('ipad-portrait',820,1180),('honor-magic-v5-unfolded',795,720),('mobile',390,844),('boundary-650',650,900),('boundary-651',651,900),('boundary-1000',1000,900),('boundary-1001',1001,900)]:
                page.set_viewport_size({'width':width,'height':height})
                for id in ['R03','R05','R07']:
                    at(page,id)
                    check_visual(page,f'{name}/{id}')
                    if name in ['ipad-portrait','honor-magic-v5-unfolded','mobile']:
                        screenshot(page,f'{name}-{id.lower()}')
                    if id=='R07':
                        cols=page.locator('.product-positioning').evaluate("e=>getComputedStyle(e).gridTemplateColumns.split(' ').length")
                        check(cols==(1 if width<=650 else 3),f'{name} preserves original responsive plan columns')
                        for key in ['premiums','claims']:
                            section(page,key)
                            check_visual(page,f'{name}/hub-{key}')
                # Return to AVA remains visible, usable and outside presentation-mode agent chrome.
                page.evaluate("setMode('presentation')")
                check(page.get_by_role('link',name='返回 AVA',exact=True).is_visible(),f'{name} Return to AVA remains in presentation')
                page.evaluate("setMode('use')")
            for width in [320,390]:
                page.set_viewport_size({'width':width,'height':844})
                for paid in [1000,99000]:
                    at(page,'R03')
                    page.locator('#companyMedicalExpense').fill('100000')
                    page.locator('#companyCoverage').fill(str(paid))
                    page.locator('#companyRate').fill('100')
                    check_company_bar(page,f'{width}px tiny '+('company' if paid==1000 else 'customer'))
                    check(page.evaluate('document.documentElement.scrollWidth<=innerWidth'),'R03 narrow small-segment scenario has no overflow')
                    if width==390:screenshot(page,'mobile-r03-small-'+('company' if paid==1000 else 'customer'))
            at(page,'R03')
            page.evaluate("state.entry='user';setMode('edit')")
            page.locator('#viewPlansBtn').click()
            section(page,'premiums')
            page.locator('#pageCard h2').fill('User premium section title')
            page.locator('#saveBtn').click()
            check(page.evaluate("JSON.parse(localStorage.getItem(OVERRIDE_KEY)).R09.title==='User premium section title'&&state.official.pages.find(p=>pageId(p)==='R09').title==='保費參考'"),'Hub edits preserve R09 stable identity and Official/User separation')
            check(not errors,'No browser JavaScript errors: '+repr(errors))
            print(f'{CHECKS} browser checks PASS; Chromium {browser.version}', flush=True)
            context.close();browser.close()
    finally:
        server.shutdown()


def fixture_money(n):
    return f'HK${round(n):,}'


def check_company_bar(page,label):
    data=page.locator('.company-reimbursement-bar').evaluate("""e=>({width:e.getBoundingClientRect().width,segments:[...e.children].map(s=>{const b=s.querySelector('b');return {text:b.textContent,x:s.getBoundingClientRect().x,width:s.getBoundingClientRect().width,color:getComputedStyle(s).backgroundColor,visible:getComputedStyle(b).visibility!=='hidden',labelWidth:b.getBoundingClientRect().width}})})""")
    cost,paid=page.evaluate('[state.claimCost,state.companyPaid]')
    expected=[paid/cost if cost else 0,(cost-paid)/cost if cost else 0]
    segments=data['segments']
    check([x['text'] for x in segments]==['公司','自己'] and segments[0]['x']<=segments[1]['x'],label+' company stays LEFT and customer stays RIGHT')
    check([x['color'] for x in segments]==['rgb(220, 252, 231)','rgb(219, 234, 254)'],label+' exact company green and customer blue')
    check(all(abs(x['width']-data['width']*fraction)<=1 for x,fraction in zip(segments,expected)),label+' segment widths match actual calculated amounts')
    check(all(not x['visible'] or x['labelWidth']<=x['width'] for x in segments),label+' no inside label is clipped')
    check(all(x['visible'] for x in segments if x['width']>33),label+' readable segments display their inside labels')
    check(page.locator('.company-bar-amounts > span').all_inner_texts()==['公司 '+fixture_money(paid),'自己 '+fixture_money(cost-paid)],label+' amounts remain underneath in company/customer order')


def check_visual(page,label):
    if page.locator('.company-reimbursement-bar').count():check_company_bar(page,label)
    if page.locator('.plan-hub-nav').count():
        nav=page.locator('.plan-hub-nav')
        check(nav.locator(':scope > button').all_inner_texts()==['返回 Guided Flow','三個醫療計劃','保費參考','索償案例／索償示範'],label+' navigation order is Return, Plans, Premium, Claims in one container')
        check(page.locator('#returnGuidedFlowBtn').count()==1 and page.locator('.nav-actions #returnGuidedFlowBtn').count()==0,label+' has no separate return-button row')
        if page.viewport_size['width']>650:
            boxes=nav.locator(':scope > button').evaluate_all('es=>es.map(e=>({x:e.getBoundingClientRect().x,y:e.getBoundingClientRect().y}))')
            check(boxes[0]['x']<boxes[1]['x'] and abs(boxes[0]['y']-boxes[1]['y'])<1,label+' Return and Plans share the navigation row')
            if page.viewport_size['width']>=795:
                check(all(abs(b['y']-boxes[0]['y'])<1 for b in boxes),label+' all four navigation controls share the iPad/unfolded row')
    check(page.evaluate('document.documentElement.scrollWidth<=innerWidth'),label+' has no horizontal overflow')
    check(page.evaluate('''()=>[...document.querySelectorAll('.claim-flow strong,.case-metrics strong,.you-pay strong,.premium-result .metric')].every(e=>e.scrollWidth<=e.clientWidth+1)'''),label+' has no clipped amounts')
    for selector in ['#backBtn','#viewPlansBtn','#nextBtn','#returnGuidedFlowBtn','[data-hub-section]']:
        for element in page.locator(selector).all():
            if element.is_visible():
                box=element.bounding_box()
                check(box['height']>=44 and box['x']>=0 and box['x']+box['width']<=page.viewport_size['width']+1,label+': '+selector+' usable touch target')


if __name__=='__main__':
    run()
