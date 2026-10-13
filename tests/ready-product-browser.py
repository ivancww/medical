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
PLANS = [{"plan_id": r["plan_id"], "plan_name": r["plan_name"], "record_type": "PLAN", "enabled": True} for r in RULES]
TABLES = {
    **{f"尊耀{d}自付額": {"35": 10000 + d, "40": 12000 + d} for d in [0, 16000, 25000]},
    **{f"睿選{d}自付額": {"35": 5000 + d, "40": 6000 + d} for d in [0, 8800, 18000, 30000]},
    "男靈活計劃": {"35": 7000, "40": 8000},
    "女靈活計劃": {"35": 6800, "40": 7800},
}
PAGES = [{"page_id": f"R{i:02}", "title": f"R{i:02}", "is_fixed": True, "sort_order": i} for i in range(1, 11)]
PAGES += [{"page_id": f"N{i:02}", "title": f"N{i:02}", "is_fixed": True, "sort_order": i} for i in range(1, 8)]
OFFICIAL = {"version": "fixture", "pages": PAGES, "options": [], "plans": PLANS, "claimRules": RULES, "premiumTables": TABLES, "premiumSettings": []}
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
            at(page, "R03")
            coverage = page.locator("#companyCoverage")
            coverage.focus()
            coverage.fill("1")
            coverage.press("End")
            coverage.type("000")
            check(coverage.input_value() == "1,000" and page.evaluate("state.companyCoverage") == 1000, "P3 continuously accepts digits with live thousands formatting and numeric state")
            check(page.evaluate("document.activeElement.id") == "companyCoverage", "P3 input retains focus while typing")
            check("HK$1,000" in page.locator("#companySetupSummary").inner_text(), "P3 summary updates without a full page rerender")

            page.evaluate("state.planVisibility={ELITE:true,WISE:true,FLEXI:true}; state.wiseConditions={hospital:true,networkDoctor:true,preapproval:true}; state.index=journeyPages('ready').findIndex(p=>pageId(p)==='R07'); renderPage()")
            check(page.locator(".plan-visibility-toggle").count() == 3 and page.locator("[data-plan-column]").count() > 0, "P7 exposes three plan visibility controls and comparison columns")
            check(page.locator("#wiseStatus").inner_text() == "符合條件（享半私家）", "Wise all-three-qualified state is green")
            page.locator("[data-plan-id='ELITE']").uncheck()
            check(page.locator("[data-plan-column='ELITE']").count() == 0 and page.locator("[data-plan-column='WISE']").count() > 0, "deselected Elite is removed rather than left as an empty column")
            page.locator("[data-plan-id='FLEXI']").uncheck()
            check(page.locator("[data-plan-column='WISE']").count() > 0 and page.locator("[data-plan-column='FLEXI']").count() == 0, "P7 adapts to one visible plan")
            page.locator("[data-plan-id='WISE']").check()
            page.locator("[data-condition-key='preapproval']").uncheck()
            check(page.locator("#wiseStatus").inner_text() == "條件未符（降為普通房級別）" and "上限 $640" in page.locator(".product-comparison").inner_text(), "Wise partial-condition state downgrades the comparison")

            at(page, "R09")
            check(page.locator(".premium-result").count() == 3, "P9 renders three Official premium cards")
            for width in [390, 650, 720, 820, 1000, 1180, 1500]:
                context.close()
                context, page = open_page(browser, server.server_port, width)
                at(page, "R09")
                check(page.evaluate("document.documentElement.scrollWidth <= innerWidth"), f"P9 no horizontal overflow at {width}px")

            at(page, "R08")
            check("除咗醫療費用之外，如果患上大病而需要停工休養，期間嘅生活費用又會由邊度嚟？" in page.locator("#pageCard").inner_text(), "P8 final reflection contains the bridge question")
            check(page.evaluate("journeyPages('ready')[journeyPages('ready').length-1].page_id") == "R08", "P8 is the final Ready page")
            check(page.locator("#nextBtn").is_hidden(), "P8 has no forward step after the final page")
            page.evaluate("state.index=journeyPages('ready').findIndex(p=>pageId(p)==='R09'); renderPage(); state.claimCost=250000; state.planVisibility={ELITE:false,WISE:true,FLEXI:true}; state.wiseConditions={hospital:true,networkDoctor:false,preapproval:true}; renderPage()")
            page.locator("#backBtn").click()
            check(page.evaluate("pageId(journeyPages('ready')[state.index])") == "R07", "Back returns exactly one Ready step")
            check(page.evaluate("state.claimCost") == 250000 and page.evaluate("state.planVisibility.WISE") and not page.evaluate("state.wiseConditions.networkDoctor"), "Back preserves Ready session state")
            check(not errors, "no browser JavaScript errors")
            context.close()
            browser.close()
    finally:
        server.shutdown()


if __name__ == "__main__":
    run()
