"""Browser regression coverage for the current Medical Ready and Frontstage contracts."""
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
PLANS = [
    {"plan_id": r["plan_id"], "plan_name": r["plan_name"], "record_type": "PLAN", "enabled": True}
    for r in RULES
] + [
    {"plan_id": r["plan_id"], "record_type": "FEATURE", "title": "保障重點", "description": f"{r['plan_id']} 官方描述", "enabled": True}
    for r in RULES
]
TABLES = {
    **{f"尊耀{d}自付額": {"35": 10000 + d, "40": 12000 + d} for d in [0, 16000, 25000]},
    **{f"睿選{d}自付額": {"35": 5000 + d, "40": 6000 + d} for d in [0, 8800, 18000, 30000]},
    "男靈活計劃": {"35": 7000, "40": 8000},
    "女靈活計劃": {"35": 6800, "40": 7800},
}
PAGES = [{"page_id": f"R{i:02}", "title": f"R{i:02}", "is_fixed": True, "sort_order": i} for i in range(1, 11)]
PAGES += [{"page_id": f"N{i:02}", "title": f"N{i:02}", "is_fixed": True, "sort_order": i} for i in range(1, 8)]
OFFICIAL = {"version": "fixture", "pages": PAGES, "options": [], "plans": PLANS, "claimRules": RULES, "premiumTables": TABLES, "premiumSettings": [], "comparisonItems": [
    {"item_id": "followup", "name": "🩺 出院後覆診", "elite": ["Official 已核實示例", "來源於 fixture"]},
]}
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


def open_page(browser, port, width=1180, entry="frontend"):
    context = browser.new_context(viewport={"width": width, "height": 900}, service_workers="block")
    context.add_init_script("localStorage.setItem('ava.medical.official.v1', JSON.stringify(" + json.dumps(OFFICIAL, ensure_ascii=False) + "));" )
    page = context.new_page()
    page.route("**/exec**", lambda route: route.fulfill(status=200, content_type="application/json", body=json.dumps({"status": "success", "version": OFFICIAL["version"]})))
    page.goto(f"http://127.0.0.1:{port}/?avaEntry={entry}", wait_until="domcontentloaded")
    page.wait_for_function("version => document.querySelector('#status').textContent.includes(version)", arg=str(OFFICIAL["version"]))
    return context, page


def at(page, page_id):
    page.evaluate("""id => { state.journey='ready'; state.index=journeyPages('ready').findIndex(p=>pageId(p)===id); document.querySelector('#home').hidden=true; document.querySelector('#journey').hidden=false; renderPage() }""", page_id)


def page_ids(page, journey="ready"):
    return page.evaluate("j => journeyPages(j).map(p => pageId(p))", journey)


def run():
    server = ThreadingHTTPServer(("127.0.0.1", 0), QuietHandler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(headless=True)
            context, page = open_page(browser, server.server_port)
            errors = []
            page.on("pageerror", lambda error: errors.append(str(error)))

            check(page.locator("#appVersion").inner_text().startswith("v1.1.9 · build "), "Medical App Version/build is visible in the header")
            check(page.locator("#status").is_hidden(), "Official Data technical status is hidden on customer Frontstage")
            check(page.locator("#prevBtn").count() == 0 and page.locator("#backBtn").count() == 1, "bottom Previous is absent and top Back remains")
            check(page_ids(page) == ["R01", "R02", "R03", "R04", "R05", "R07", "R09", "R08"], "Ready order excludes R06 and R10")

            at(page, "R01")
            page.locator(".option-card").first.click()
            check(page.locator("#pageCard h2").inner_text() == "R02", "R01 simple single-choice directly advances")
            page.locator(".option-card").first.click()
            check(page.locator("#pageCard h2").inner_text() == "R04", "R02 simple single-choice directly advances with conditional routing")

            at(page, "R03")
            coverage = page.locator("#companyCoverage")
            page.evaluate("window.__readyCard=document.querySelector('#pageCard')")
            coverage.fill("")
            for digit, expected in [("1", "1"), ("0", "10"), ("0", "100"), ("0", "1,000"), ("0", "10,000")]:
                coverage.type(digit)
                check(coverage.input_value() == expected, f"P3 live thousands display reaches {expected}")
                check(page.evaluate("state.companyCoverage") == int(expected.replace(",", "")), f"P3 canonical numeric state remains {expected}")
                check(page.evaluate("document.activeElement.id") == "companyCoverage", f"P3 focus remains after {expected}")
            check(page.evaluate("window.__readyCard===document.querySelector('#pageCard')"), "P3 typing does not replace the page card")
            check("HK$10,000" in page.locator("#companySetupSummary").inner_text(), "P3 summary updates without a full page rerender")

            page.evaluate("state.answers.R02=''; state.planVisibility={ELITE:true,WISE:true,FLEXI:true}; state.wiseConditions={hospital:true,networkDoctor:true,preapproval:true}; state.index=journeyPages('ready').findIndex(p=>pageId(p)==='R05'); renderPage()")
            check(page.locator("#claimCost").count() == 1 and page.locator("#claimCostDirect").count() == 0, "R05 keeps one active claim-cost control after R06 removal")
            check(page.locator("#eliteDeductible").count() == 1 and page.locator("#wiseDeductible").count() == 1, "R05 has plan-owned deductible selectors")
            check(page.locator("#eliteDeductible option").all_text_contents() == ["HK$0", "HK$16,000", "HK$25,000"] and page.locator("#wiseDeductible option").all_text_contents() == ["HK$0", "HK$8,800", "HK$18,000", "HK$30,000"], "deductible definitions remain canonical")
            check(page.evaluate("AVAMedicalProductData.lookupPremium(state.official, 'ELITE', {age: 35, deductible: 8800})") is None and page.evaluate("AVAMedicalProductData.lookupPremium(state.official, 'WISE', {age: 35, deductible: 16000})") is None, "premium lookup rejects cross-product deductibles")
            check(page.locator(".claim-result--deductible .claim-bar .customer:first-child").count() == 2, "deductible customer segment starts on left")
            check(page.locator("[data-product-id='ELITE'] .claim-bar span").first.get_attribute("class") == "customer" and page.locator("[data-product-id='ELITE'] .claim-bar span").nth(1).get_attribute("class") == "plan", "Elite bar is customer then plan")
            check(page.locator("[data-product-id='WISE'] .claim-bar span").first.get_attribute("class") == "customer" and page.locator("[data-product-id='WISE'] .claim-bar span").nth(1).get_attribute("class") == "plan", "Wise bar is customer then plan")
            check(page.locator("[data-product-id='FLEXI'] .claim-bar span").first.get_attribute("class") == "plan" and page.locator("[data-product-id='FLEXI'] .claim-bar span").nth(1).get_attribute("class") == "customer", "Flexi bar is plan then customer")
            check("自己" in page.locator("[data-product-id='ELITE'] .claim-bar").get_attribute("aria-label") and "計劃" in page.locator("[data-product-id='ELITE'] .claim-bar").get_attribute("aria-label"), "Elite accessibility order describes customer then plan")
            check(page.locator("[data-product-id='FLEXI'] .claim-bar").get_attribute("aria-label").startswith("計劃"), "Flexi accessibility order describes plan first")
            check(not page.locator("#nextBtn").is_hidden(), "R05 complex claim illustration keeps explicit Next")
            page.locator("#eliteDeductible").select_option("0")
            check(page.locator("#eliteDeductible").input_value() == "0" and "自己 HK$0" in page.locator("[data-product-id='ELITE'] .claim-bar-labels").inner_text(), "Elite zero deductible remains zero")
            check(page.locator("#wiseDeductible").input_value() == "8800", "Elite zero does not alter Wise")
            page.locator("#wiseDeductible").select_option("0")
            check(page.locator("#wiseDeductible").input_value() == "0" and "自己 HK$0" in page.locator("[data-product-id='WISE'] .claim-bar-labels").inner_text(), "Wise zero deductible remains zero")
            check(page.locator("#eliteDeductible").input_value() == "0", "Wise zero does not alter Elite")
            page.locator("#wiseDeductible").select_option("8800")
            check("91,200" in page.locator(".claim-result[data-product-id='WISE']").inner_text(), "Wise claim amount follows deductible")
            page.locator("#claimCost").fill("1000")
            check(page.evaluate("state.claimCost") == 1000, "editing the active claim control updates state.claimCost")
            check("1,000" in page.locator(".claim-result").nth(1).locator(".you-pay").inner_text() and "0" in page.locator(".claim-result").nth(1).locator(".claim-bar-labels").inner_text(), "cost below deductible stays nonnegative")
            page.evaluate("state.answers.R02='company_medical'; state.companyCoverage=30000; state.companyRate=100; state.claimCost=100000")
            at(page, "R05")
            company_flow = page.evaluate("({company:document.querySelector('.claim-flow > div:nth-of-type(2) strong')?.textContent, remaining:document.querySelector('.claim-flow > div:nth-of-type(3) strong')?.textContent})")
            check(company_flow == {"company": "HK$30,000", "remaining": "HK$70,000"}, "company medical and remaining amounts recalculate in R05")
            page.locator("#claimCost").fill("250000")
            check(page.evaluate("state.claimCost") == 250000 and "HK$30,000" in page.locator(".claim-flow").inner_text() and "HK$220,000" in page.locator(".claim-flow").inner_text(), "changing medical cost updates the company flow")
            check("187,000" in page.locator("[data-product-id='FLEXI']").inner_text(), "claim illustrations recalculate from remaining amount")
            check("187,000" in page.locator(".claim-result").nth(2).inner_text(), "Flexi uses Official 85 percent illustration")

            at(page, "R07")
            check(page.locator(".plan-visibility-toggle").count() == 3 and page.locator("[data-plan-column]").count() > 0, "P7 exposes three plan visibility controls and comparison columns")
            check(page.locator("#wiseStatus").inner_text() == "符合條件（享半私家）", "Wise all-three-qualified state is green")
            check("Official 已核實示例" in page.locator(".product-comparison").inner_text(), "P7 reads a benefit value from the Official comparison collection")
            page.locator("[data-plan-id='ELITE']").uncheck()
            check(page.locator("[data-plan-column='ELITE']").count() == 0 and page.locator("[data-plan-column='WISE']").count() > 0, "deselected Elite is removed rather than left as an empty column")
            page.locator("[data-plan-id='FLEXI']").uncheck()
            check(page.locator("[data-plan-column='WISE']").count() > 0 and page.locator("[data-plan-column='FLEXI']").count() == 0, "P7 adapts to one visible plan")
            page.locator("[data-plan-id='WISE']").check()
            page.locator("[data-condition-key='preapproval']").uncheck()
            check(page.locator("#wiseStatus").inner_text() == "條件未符（降為普通房級別）", "Wise partial-condition state is red and downgraded")
            page.evaluate("delete state.official.comparisonItems; renderPage()")
            check("未有可核實資料" in page.locator(".product-comparison").inner_text(), "P7 omits unverified benefit values safely")
            check(not any(value in page.locator(".product-comparison").inner_text() for value in ["90-365", "$640", "$848", "$650", "$1,000", "$1,200", "$2,400", "$96,000"]), "P7 does not publish screenshot-only benefit values")

            at(page, "R09")
            check(page.locator("#premiumEliteDeductible option").count() == 3 and page.locator("#premiumWiseDeductible option").count() == 4, "R09 shares product deductible definitions")
            check(page.locator(".premium-result").count() == 3, "R09 renders three Official premium results")
            check(page.evaluate("getComputedStyle(document.querySelector('.premium-results')).gridTemplateColumns.split(' ').length") == 3, "P9 uses three equal columns above compact width")
            page.locator("#premiumGender").select_option("female")
            check("7,800" in page.locator("[data-product-id='FLEXI'].premium-result").inner_text(), "Flexi premium follows gender")
            page.locator("#premiumAge").fill("35")
            page.locator("#premiumAge").dispatch_event("change")
            check("6,800" in page.locator("[data-product-id='FLEXI'].premium-result").inner_text(), "premium follows exact age")
            page.locator("#premiumEliteDeductible").select_option("0")
            page.locator("#premiumWiseDeductible").select_option("0")
            check("10,000" in page.locator("[data-product-id='ELITE'].premium-result").inner_text() and "5,000" in page.locator("[data-product-id='WISE'].premium-result").inner_text(), "R09 prices verified zero-deductible tables by product")
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

            at(page, "R05")
            page.locator("#eliteDeductible").select_option("25000")
            page.locator("#wiseDeductible").select_option("30000")
            at(page, "R09")
            check(page.locator("#premiumEliteDeductible").input_value() == "25000" and page.locator("#premiumWiseDeductible").input_value() == "30000", "R05 and R09 share selected deductible state")
            at(page, "R07")
            page.evaluate("state.planVisibility={ELITE:false,WISE:true,FLEXI:true}; state.wiseConditions={hospital:true,networkDoctor:false,preapproval:true}; renderPage()")
            page.locator("#backBtn").click()
            check(page.locator("#pageCard h2").inner_text() == "R05", "R07 Back returns exactly to R05")
            at(page, "R09")
            page.evaluate("state.claimCost=250000; state.planVisibility={ELITE:false,WISE:true,FLEXI:true}; state.wiseConditions={hospital:true,networkDoctor:false,preapproval:true}; renderPage()")
            page.locator("#backBtn").click()
            check(page.locator("#pageCard h2").inner_text() == "R07", "R09 Back returns exactly to R07")
            check(page.evaluate("state.claimCost") == 250000 and page.evaluate("state.planVisibility.WISE") and not page.evaluate("state.wiseConditions.networkDoctor"), "Back preserves Ready session state")
            at(page, "R08")
            check("除咗醫療費用之外，如果患上大病而需要停工休養，期間嘅生活費用又會由邊度嚟？" in page.locator("#pageCard").inner_text(), "P8 final reflection contains the bridge question")
            check(page.evaluate("journeyPages('ready')[journeyPages('ready').length-1].page_id") == "R08", "P8 is the final Ready page")
            check(page.locator("#nextBtn").is_hidden(), "P8 has no forward step after the final page")
            page.locator("#backBtn").click()
            check(page.locator("#pageCard h2").inner_text() == "R09", "R08 Back returns exactly to R09")

            page.evaluate("state.answers.R02='company_medical'; renderPage()")
            at(page, "R04")
            page.locator("#backBtn").click()
            check(page.locator("#pageCard h2").inner_text() == "R03", "R04 Back returns to active R03")
            page.evaluate("state.answers.R02='no_medical'")
            at(page, "R04")
            page.locator("#backBtn").click()
            check(page.locator("#pageCard h2").inner_text() == "R02", "R04 Back skips non-applicable R03")

            at(page, "R01")
            check(page.locator(".app-header a").get_attribute("href") == "https://ivancww.github.io/avaplatform/", "Return to AVA remains wired")
            for page_id in ["R01", "R02", "R03", "R04", "R05", "R07", "R09", "R08"]:
                page.evaluate("id => { state.answers.R02=''; state.journey='ready'; state.index=journeyPages('ready').findIndex(p=>pageId(p)===id); renderPage() }", page_id)
                check(page.locator("#pageCard h2").count() == 1, f"{page_id} still renders")
            page.evaluate("state.journey='notready'")
            for i in range(1, 8):
                page.evaluate("i => { state.index=i-1; renderPage() }", i)
                check(page.locator("#pageCard h2").count() == 1, f"N{i:02} still renders")
            check(not errors, "no browser JavaScript errors")
            context.close()

            context, page = open_page(browser, server.server_port, entry="user")
            at(page, "R05")
            check(page.locator(".app-shell").get_attribute("data-ava-mode") == "edit", "User entry opens Frontstage in Edit mode")
            page.locator("#pageCard h2").fill("客戶示例")
            page.locator("#previewBtn").click()
            check(page.locator(".app-shell").get_attribute("data-ava-mode") == "preview", "Preview mode remains available")
            page.locator("#saveBtn").click()
            check(page.evaluate("JSON.parse(localStorage.getItem('ava.medical.user.overrides.v1')).R05.title") == "客戶示例", "Save Local writes User override")
            context.close()

            for width in [390, 650, 720, 820, 1000, 1180, 1500]:
                context, page = open_page(browser, server.server_port, width)
                at(page, "R07")
                check(page.evaluate("document.documentElement.scrollWidth <= innerWidth"), f"P7 no horizontal overflow at {width}px")
                check(page.locator("[data-plan-column='ELITE']").count() > 0 and page.locator("[data-plan-column='WISE']").count() > 0 and page.locator("[data-plan-column='FLEXI']").count() > 0, f"P7 three plans are visible at {width}px")
                page.locator("[data-plan-id='ELITE']").uncheck()
                check(page.evaluate("document.documentElement.scrollWidth <= innerWidth") and page.locator("[data-plan-column='ELITE']").count() == 0, f"P7 two-plan layout has no overflow at {width}px")
                page.locator("[data-plan-id='FLEXI']").uncheck()
                check(page.evaluate("document.documentElement.scrollWidth <= innerWidth") and page.locator("[data-plan-column='WISE']").count() > 0 and page.locator("[data-plan-column='FLEXI']").count() == 0, f"P7 one-plan layout has no overflow at {width}px")
                check(page.evaluate("Math.min(...[...document.querySelectorAll('.comparison-cell')].map(e=>e.getBoundingClientRect().width)) >= 60"), f"P7 comparison remains legible at {width}px")
                at(page, "R09")
                check(page.evaluate("document.documentElement.scrollWidth <= innerWidth"), f"P9 no horizontal overflow at {width}px")
                expected = 1 if width <= 650 else 3
                check(page.evaluate("getComputedStyle(document.querySelector('.premium-results')).gridTemplateColumns.split(' ').length") == expected, f"P9 uses {'stacked' if expected == 1 else 'three-column'} layout at {width}px")
                context.close()
            browser.close()
    finally:
        server.shutdown()


if __name__ == "__main__":
    run()
