"""Browser regression coverage for the current Medical Ready journey."""
import json
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
RULES = [
    {"plan_id": "ELITE", "plan_name": "尊耀醫療計劃", "illustration_method": "deductible_then_cover", "default_rate": 1, "deductible_enabled": True},
    {"plan_id": "WISE", "plan_name": "睿選醫療計劃", "illustration_method": "deductible_then_cover", "default_rate": 1, "deductible_enabled": True},
    {"plan_id": "FLEXI", "plan_name": "靈活醫療計劃", "illustration_method": "percentage", "default_rate": .85, "deductible_enabled": False},
]
PLANS = [{"plan_id": r["plan_id"], "plan_name": r["plan_name"], "record_type": "PLAN", "enabled": True} for r in RULES] + [{"plan_id": r["plan_id"], "record_type": "FEATURE", "title": "保障重點", "description": f"{r['plan_id']} 官方描述", "enabled": True} for r in RULES]
TABLES = {
    **{f"尊耀{d}自付額": {"35": 10000 + d, "40": 12000 + d} for d in [0, 16000, 25000]},
    **{f"睿選{d}自付額": {"35": 5000 + d, "40": 6000 + d} for d in [0, 8800, 18000, 30000]},
    "男靈活計劃": {"35": 7000, "40": 8000},
    "女靈活計劃": {"35": 6800, "40": 7800},
}
PAGES = [{"page_id": f"R{i:02}", "title": f"R{i:02}", "is_fixed": True, "sort_order": i} for i in range(1, 11)]
PAGES += [{"page_id": f"N{i:02}", "title": f"N{i:02}", "is_fixed": True, "sort_order": i} for i in range(1, 8)]
OFFICIAL = {"version": "fixture", "pages": PAGES, "options": [], "plans": PLANS, "claimRules": RULES, "premiumTables": TABLES, "premiumSettings": []}
OFFICIAL["planComparison"] = [
    {"comparison_id": "fixture-elite-followup", "item_key": "post_discharge_followup", "item_name": "出院後覆診", "plan_id": "ELITE", "condition_state": "DEFAULT", "main_value": "fixture ELITE value", "sub_value": "fixture source", "enabled": True, "sort_order": 1, "source_name": "fixture", "verified": True},
    {"comparison_id": "fixture-wise-semi", "item_key": "post_discharge_followup", "item_name": "出院後覆診", "plan_id": "WISE", "condition_state": "WISE_SEMI_PRIVATE", "main_value": "fixture WISE semi-private", "sub_value": "fixture source", "enabled": True, "sort_order": 2, "source_name": "fixture", "verified": True},
    {"comparison_id": "fixture-wise-general", "item_key": "post_discharge_followup", "item_name": "出院後覆診", "plan_id": "WISE", "condition_state": "WISE_GENERAL_ROOM", "main_value": "fixture WISE general-room", "sub_value": "fixture source", "enabled": True, "sort_order": 3, "source_name": "fixture", "verified": True},
    {"comparison_id": "fixture-flexi-followup", "item_key": "post_discharge_followup", "item_name": "出院後覆診", "plan_id": "FLEXI", "condition_state": "DEFAULT", "main_value": "fixture FLEXI value", "sub_value": "fixture source", "enabled": True, "sort_order": 4, "source_name": "fixture", "verified": True},
    {"comparison_id": "fixture-unverified", "item_key": "post_discharge_tcm", "item_name": "出院後中醫", "plan_id": "ELITE", "condition_state": "DEFAULT", "main_value": "fixture unverified value", "sub_value": "Official Sheet is the publication source", "enabled": True, "sort_order": 5, "source_name": "fixture", "verified": False},
    {"comparison_id": "fixture-disabled", "item_key": "room_downgrade_cash", "item_name": "次級病房每日現金津貼", "plan_id": "FLEXI", "condition_state": "DEFAULT", "main_value": "fixture disabled value", "sub_value": "not publishable", "enabled": False, "sort_order": 6, "source_name": "fixture", "verified": True},
    {"comparison_id": "fixture-dynamic", "item_key": "diagnostic_imaging", "item_name": "診斷影像", "plan_id": "ELITE", "condition_state": "DEFAULT", "main_value": "自動新增項目", "sub_value": "Sheet-driven", "enabled": True, "sort_order": 0, "source_name": "fixture", "verified": False},
]
OFFICIAL["options"] = [
    {"option_group": "R01", "option_id": "concern", "display_name": "Concern"},
    {"option_group": "R02", "option_id": "company_medical", "display_name": "Company medical"},
    {"option_group": "R02", "option_id": "no_medical", "display_name": "No medical"},
    {"option_group": "N01", "option_id": "private", "display_name": "Private"},
    {"option_group": "N02", "option_id": "cost", "display_name": "Cost"},
    {"option_group": "N05", "option_id": "savings", "display_name": "Savings"},
    {"option_group": "N07", "option_id": "future_insurance", "display_name": "Future insurance"},
]


class QuietHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, *_):
        pass


def check(condition, message):
    if not condition:
        raise AssertionError(message)
    print("PASS", message)


def open_page(browser, port, width=1180):
    context = browser.new_context(viewport={"width": width, "height": 900}, service_workers="block")
    context.add_init_script("localStorage.setItem('ava.medical.official.v1', JSON.stringify(" + json.dumps(OFFICIAL, ensure_ascii=False) + "));" )
    page = context.new_page()
    page.route("**/exec**", lambda route: route.fulfill(status=200, content_type="application/json", body=json.dumps({"status": "success", "version": OFFICIAL["version"]})))
    page.goto(f"http://127.0.0.1:{port}/?avaEntry=frontend", wait_until="domcontentloaded")
    page.wait_for_function("version => document.querySelector('#status').textContent.includes(version)", arg=str(OFFICIAL["version"]))
    return context, page


def at(page, page_id):
    page.evaluate("""id => { state.journey='ready'; state.index=journeyPages('ready').findIndex(p=>pageId(p)===id); document.querySelector('#home').hidden=true; document.querySelector('#journey').hidden=false; renderPage() }""", page_id)


def retired_claim_illustration(page):
    """Exercise the retained claim illustration renderer without making R06 navigable."""
    page.evaluate("""() => {
        document.querySelector('#pageCard').innerHTML = readyClaimIllustrationBlock();
        const ci = document.querySelector('#claimCostDirect');
        const ed = document.querySelector('#eliteDeductible');
        const wd = document.querySelector('#wiseDeductible');
        if (ci) { ci.oninput = () => { state.claimCost = Math.max(0, Number(ci.value.replace(/[^0-9.]/g, '')) || 0); refreshClaimIllustration(); }; ci.onblur = () => { ci.value = claimCostInputValue(state.claimCost); } }
        if (ed) ed.onchange = () => { state.eliteDeductible = Number(ed.value); refreshClaimIllustration(); };
        if (wd) wd.onchange = () => { state.wiseDeductible = Number(wd.value); refreshClaimIllustration(); };
    }""")


def run():
    server = ThreadingHTTPServer(("127.0.0.1", 0), QuietHandler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(headless=True)
            context, page = open_page(browser, server.server_port)
            errors = []
            page.on("pageerror", lambda error: errors.append(str(error)))

            check(page.locator("#prevBtn").count() == 0 and page.locator("#backBtn").count() == 1, "top Back remains and bottom Previous is absent")
            check(page.evaluate("journeyPages('ready').map(p=>pageId(p))") == ["R01", "R02", "R03", "R04", "R05", "R07", "R09", "R08"], "Ready order excludes R06 and R10")
            at(page, "R01")
            page.locator(".option-card").first.click()
            check(page.locator("#pageCard h2").inner_text() == "R02", "R01 simple single-choice directly advances")
            page.locator("[data-key='no_medical']").click()
            check(page.locator("#pageCard h2").inner_text() == "R04", "R02 conditional routing skips Company Medical when not applicable")
            at(page, "R03")
            coverage = page.locator("#companyCoverage")
            coverage.focus()
            coverage.fill("1")
            coverage.press("End")
            coverage.type("000")
            check(coverage.input_value() == "1,000" and page.evaluate("state.companyCoverage") == 1000, "P3 continuously accepts digits with live thousands formatting and numeric state")
            check(page.evaluate("document.activeElement.id") == "companyCoverage", "P3 input retains focus while typing")
            check("HK$1,000" in page.locator("#companySetupSummary").inner_text(), "P3 summary updates without a full page rerender")

            check("R06" not in page.evaluate("journeyPages('ready').map(p=>pageId(p))"), "R06 is absent from the active Ready journey")
            retired_claim_illustration(page)
            check(page.locator("#claimCostDirect").count() == 1 and page.locator("#claimCost").count() == 0, "retained claim illustration has exactly one medical cost control")
            check(page.locator("#claimCostDirect").input_value() == "100,000" and page.evaluate("state.claimCost") == 100000, "claim illustration initial input matches state.claimCost")
            check(page.locator("#wiseDeductible").count() == 1 and page.locator("#eliteDeductible").count() == 1, "claim illustration keeps plan-owned deductible selectors")
            check(page.locator("#eliteDeductible option").count() == 3 and page.locator("#wiseDeductible option").count() == 4, "deductible options follow product tables")
            check(page.locator("#eliteDeductible").input_value() == "16000" and page.locator("#wiseDeductible").input_value() == "8800", "product defaults remain preserved")
            check(page.evaluate("AVAMedicalProductData.lookupPremium(state.official, 'ELITE', {age: 35, deductible: 8800})") is None and page.evaluate("AVAMedicalProductData.lookupPremium(state.official, 'WISE', {age: 35, deductible: 16000})") is None, "premium lookup rejects cross-product deductibles")
            check(page.locator(".claim-result--deductible .claim-bar .customer:first-child").count() == 2, "deductible customer segment starts on left")
            check(page.locator("[data-product-id='ELITE'] .claim-bar span").first.get_attribute("class") == "customer" and page.locator("[data-product-id='ELITE'] .claim-bar span").nth(1).get_attribute("class") == "plan", "Elite bar is customer then plan")
            check(page.locator("[data-product-id='WISE'] .claim-bar span").first.get_attribute("class") == "customer" and page.locator("[data-product-id='WISE'] .claim-bar span").nth(1).get_attribute("class") == "plan", "Wise bar is customer then plan")
            check(page.locator("[data-product-id='FLEXI'] .claim-bar span").first.get_attribute("class") == "plan" and page.locator("[data-product-id='FLEXI'] .claim-bar span").nth(1).get_attribute("class") == "customer", "Flexi bar is plan then customer")
            page.locator("#eliteDeductible").select_option("0")
            check(page.locator("#eliteDeductible").input_value() == "0" and "自己 HK$0" in page.locator("[data-product-id='ELITE'] .claim-bar-labels").inner_text(), "Elite zero deductible remains zero")
            check(page.locator("#wiseDeductible").input_value() == "8800", "Elite deductible selection does not alter Wise")
            page.locator("#wiseDeductible").select_option("0")
            check(page.locator("#wiseDeductible").input_value() == "0" and "自己 HK$0" in page.locator("[data-product-id='WISE'] .claim-bar-labels").inner_text(), "Wise zero deductible remains zero")
            check(page.locator("#eliteDeductible").input_value() == "0", "Wise deductible selection does not alter Elite")
            page.locator("#wiseDeductible").select_option("8800")
            check("91,200" in page.locator(".claim-result[data-product-id='WISE']").inner_text(), "Wise claim amount follows deductible")
            page.locator("#claimCostDirect").fill("1000")
            check(page.evaluate("state.claimCost") == 1000 and "1,000" in page.locator(".claim-result").nth(1).locator(".you-pay").inner_text(), "claim cost below deductible stays nonnegative")
            page.evaluate("state.answers.R02='company_medical'; state.companyCoverage=30000; state.companyRate=100; state.claimCost=100000")
            retired_claim_illustration(page)
            company_flow = page.evaluate("({company:document.querySelector('.claim-flow__company')?.textContent, remaining:document.querySelector('.claim-flow__remaining')?.textContent})")
            check(company_flow == {"company": "HK$30,000", "remaining": "HK$70,000"}, "company medical and remaining amounts recalculate")
            page.locator("#claimCostDirect").fill("250000")
            check(page.evaluate("state.claimCost") == 250000 and page.locator(".claim-flow__company").inner_text() == "HK$30,000" and page.locator(".claim-flow__remaining").first.inner_text() == "HK$220,000", "changing medical cost updates the company flow")
            check("187,000" in page.locator("[data-product-id='FLEXI']").inner_text(), "Flexi illustration uses the remaining amount and Official 85 percent")

            page.evaluate("state.planVisibility={ELITE:true,WISE:true,FLEXI:true}; state.wiseConditions={hospital:true,networkDoctor:true,preapproval:true}; state.index=journeyPages('ready').findIndex(p=>pageId(p)==='R07'); renderPage()")
            check(page.locator(".plan-visibility-toggle").count() == 3 and page.locator("[data-plan-column]").count() > 0, "P7 exposes three plan visibility controls and comparison columns")
            check(page.locator("#wiseStatus").inner_text() == "符合條件（享半私家）", "Wise all-three-qualified state is green")
            check("fixture ELITE value" in page.locator(".product-comparison").inner_text() and "fixture WISE semi-private" in page.locator(".product-comparison").inner_text() and "fixture FLEXI value" in page.locator(".product-comparison").inner_text(), "verified ELITE, Wise, and FLEXI comparison rows display")
            check("WISE 官方描述" in page.locator(".product-comparison").inner_text(), "P7 retains the Official product presentation description")
            page.locator("[data-plan-id='ELITE']").uncheck()
            check(page.locator("[data-plan-column='ELITE']").count() == 0 and page.locator("[data-plan-column='WISE']").count() > 0, "deselected Elite is removed rather than left as an empty column")
            page.locator("[data-plan-id='FLEXI']").uncheck()
            check(page.locator("[data-plan-column='WISE']").count() > 0 and page.locator("[data-plan-column='FLEXI']").count() == 0, "P7 adapts to one visible plan")
            page.locator("[data-plan-id='WISE']").check()
            page.locator("[data-condition-key='preapproval']").uncheck()
            check(page.locator("#wiseStatus").inner_text() == "條件未符（降為普通房級別）" and "fixture WISE general-room" in page.locator(".product-comparison").inner_text(), "Wise partial-condition state downgrades the comparison")
            check("fixture unverified value" in page.locator(".product-comparison").inner_text() and "自動新增項目" in page.locator(".product-comparison").inner_text(), "enabled Official rows display dynamically without a verified gate")
            check("未有資料" in page.locator(".product-comparison").inner_text() and "fixture disabled value" not in page.locator(".product-comparison").inner_text(), "missing plan values show the safe fallback and disabled rows stay hidden")

            at(page, "R09")
            check(page.locator("#premiumEliteDeductible option").count() == 3 and page.locator("#premiumWiseDeductible option").count() == 4, "P9 shares product deductible definitions")
            check(page.locator(".premium-result").count() == 3, "P9 renders three Official premium cards")
            page.locator("#premiumGender").select_option("female")
            check("7,800" in page.locator("[data-product-id='FLEXI'].premium-result").inner_text(), "Flexi premium follows gender")
            page.locator("#premiumAge").fill("35")
            page.locator("#premiumAge").dispatch_event("change")
            check("6,800" in page.locator("[data-product-id='FLEXI'].premium-result").inner_text(), "premium follows exact age")
            page.locator("#premiumEliteDeductible").select_option("0")
            page.locator("#premiumWiseDeductible").select_option("0")
            check("10,000" in page.locator("[data-product-id='ELITE'].premium-result").inner_text() and "5,000" in page.locator("[data-product-id='WISE'].premium-result").inner_text(), "P9 prices verified zero-deductible tables by product")
            page.locator("#premiumEliteDeductible").select_option("25000")
            check("35,000" in page.locator("[data-product-id='ELITE'].premium-result").inner_text(), "Elite premium follows its own deductible")
            page.locator("#premiumWiseDeductible").select_option("30000")
            check("35,000" in page.locator("[data-product-id='WISE'].premium-result").inner_text(), "Wise premium follows its own deductible")
            page.locator("#premiumVitality").check()
            check("6,120" in page.locator("[data-product-id='FLEXI'].premium-result").inner_text(), "Vitality applies verified 10 percent premium reduction")
            page.locator("#premiumVhis").check()
            check("並非保費折扣" in page.locator("[data-product-id='FLEXI'].premium-result").inner_text(), "VHIS estimate stays separate from charged premium")
            page.locator("#premiumMode").select_option("monthly")
            check("541" in page.locator("[data-product-id='FLEXI'].premium-result").inner_text(), "monthly mode applies verified 1.06 factor")
            page.locator("#premiumAge").fill("101")
            page.locator("#premiumAge").dispatch_event("change")
            check(page.locator(".premium-unavailable").count() == 3, "unsupported age fails safely")
            page.locator("[data-product-id='ELITE'].premium-result").click()
            check(page.locator("[data-product-id='ELITE'].premium-result").get_attribute("aria-pressed") == "true", "plan selection remains valid")
            for width in [390, 650, 720, 820, 1000, 1180, 1500]:
                context.close()
                context, page = open_page(browser, server.server_port, width)
                at(page, "R07")
                check(page.evaluate("document.documentElement.scrollWidth <= innerWidth"), f"P7 no horizontal overflow at {width}px")
                page.locator("[data-plan-id='ELITE']").uncheck()
                check(page.locator("[data-plan-column='ELITE']").count() == 0, f"P7 two-plan filter removes Elite at {width}px")
                page.locator("[data-plan-id='WISE']").uncheck()
                check(page.locator("[data-plan-column='WISE']").count() == 0 and page.locator("[data-plan-column='FLEXI']").count() > 0, f"P7 one-plan filter removes Wise at {width}px")
                at(page, "R09")
                check(page.evaluate("document.documentElement.scrollWidth <= innerWidth"), f"P9 no horizontal overflow at {width}px")
                columns = page.locator(".premium-results").evaluate("element => getComputedStyle(element).gridTemplateColumns.split(' ').length")
                check(columns == (3 if width > 650 else 1), f"P9 uses {'three columns' if width > 650 else 'stacked cards'} at {width}px")

            at(page, "R08")
            check("除咗醫療費用之外，如果患上大病而需要停工休養，期間嘅生活費用又會由邊度嚟？" in page.locator("#pageCard").inner_text(), "P8 final reflection contains the bridge question")
            check(page.evaluate("journeyPages('ready')[journeyPages('ready').length-1].page_id") == "R08", "P8 is the final Ready page")
            check(page.locator("#nextBtn").is_hidden(), "P8 has no forward step after the final page")
            page.evaluate("state.index=journeyPages('ready').findIndex(p=>pageId(p)==='R09'); renderPage(); state.claimCost=250000; state.planVisibility={ELITE:false,WISE:true,FLEXI:true}; state.wiseConditions={hospital:true,networkDoctor:false,preapproval:true}; renderPage()")
            page.locator("#backBtn").click()
            check(page.evaluate("pageId(journeyPages('ready')[state.index])") == "R07", "Back returns exactly one Ready step")
            check(page.evaluate("state.claimCost") == 250000 and page.evaluate("state.planVisibility.WISE") and not page.evaluate("state.wiseConditions.networkDoctor"), "Back preserves Ready session state")
            page.evaluate("state.journey='notready'; state.index=0; renderPage()")
            for i in range(1, 8):
                page.evaluate("i => { state.index=i-1; renderPage() }", i)
                check(page.locator("#pageCard h2").count() == 1, f"N{i:02} still renders")
            check(not errors, "no browser JavaScript errors")
            context.close()
            context, page = open_page(browser, server.server_port)
            page.goto(f"http://127.0.0.1:{server.server_port}/?avaEntry=user", wait_until="domcontentloaded")
            page.wait_for_function("version => document.querySelector('#status').textContent.includes(version)", arg=str(OFFICIAL["version"]))
            at(page, "R01")
            check(page.locator(".app-shell").get_attribute("data-ava-mode") == "edit", "User entry opens Frontstage in Edit mode")
            page.locator("#pageCard h2").fill("客戶示例")
            page.locator("#previewBtn").click()
            check(page.locator(".app-shell").get_attribute("data-ava-mode") == "preview", "Preview mode remains available")
            page.locator("#saveBtn").click()
            check(page.evaluate("JSON.parse(localStorage.getItem('ava.medical.user.overrides.v1')).R01.title") == "客戶示例", "Save Local writes User override")
            at(page, "R07")
            check(page.locator("#p7UserEditor").count() == 1, "User Edit exposes the structured P7 editor")
            official_name = page.evaluate("state.official.planComparison.find(row => row.item_key === 'post_discharge_followup').item_name")
            name_input = page.locator("[data-p7-user-field='item_name'][data-p7-user-item='post_discharge_followup']")
            name_input.fill("我的出院後覆診")
            name_input.dispatch_event("change")
            check("我的出院後覆診" in page.locator(".comparison-label").all_inner_texts(), "User item-name override wins in presentation")
            check(page.evaluate("state.official.planComparison.find(row => row.item_key === 'post_discharge_followup').item_name") == official_name, "User P7 edit does not mutate Official data")
            page.locator("#p7AddUserItem").click()
            check(page.locator("[data-p7-editor-item^='user_p7_']").count() == 1, "User can add a stable local P7 item")
            page.locator("[data-p7-editor-item^='user_p7_'] [data-p7-user-field='item_name']").fill("門診物理治療")
            page.locator("[data-p7-editor-item^='user_p7_'] [data-p7-user-field='item_name']").dispatch_event("change")
            check("門診物理治療" in page.locator(".comparison-label").all_inner_texts(), "User-created P7 item appears in presentation")
            context.close()
            browser.close()
    finally:
        server.shutdown()


if __name__ == "__main__":
    run()
