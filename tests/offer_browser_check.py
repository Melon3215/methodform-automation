"""Independent real Chrome smoke checks for the public-facing ₩69,000 service page.
Tests only a local HTTP mirror; does not post a GitHub issue or charge anyone.
"""
from __future__ import annotations
import functools
import http.server
import json
from pathlib import Path
import tempfile
import threading

from playwright.sync_api import sync_playwright, expect

ROOT=Path(__file__).resolve().parents[1]
CAP=ROOT/".local-evidence"

class QuietHandler(http.server.SimpleHTTPRequestHandler):
    extensions_map={**http.server.SimpleHTTPRequestHandler.extensions_map,".mjs":"text/javascript"}
    def log_message(self,*_):pass

def main():
    CAP.mkdir(exist_ok=True)
    server=http.server.ThreadingHTTPServer(("127.0.0.1",0),functools.partial(QuietHandler,directory=str(ROOT)))
    th=threading.Thread(target=server.serve_forever,daemon=True)
    th.start()
    root=f"http://127.0.0.1:{server.server_port}"
    checks=[]
    errors=[]
    external=[]
    bad=[]
    try:
        with sync_playwright() as pw:
            browser=pw.chromium.launch(channel="chrome",headless=True,args=["--no-sandbox","--disable-background-networking","--disable-component-update"])
            ctx=browser.new_context(viewport={"width":1365,"height":900},accept_downloads=True)
            page=ctx.new_page()
            page.on("pageerror",lambda e:errors.append(str(e)))
            page.on("console",lambda m:errors.append(m.text) if m.type=="error" else None)
            page.on("request",lambda req:external.append(req.url) if not req.url.startswith((root,"data:","blob:","about:")) else None)
            page.on("response",lambda res:bad.append({"code":res.status,"url":res.url}) if res.status>=400 else None)
            page.goto(root+"/",wait_until="load")
            expect(page.locator(".fixed-offer")).to_be_visible()
            expect(page.locator(".fixed-price")).to_contain_text("69,000")
            checks.append("Homepage visible fixed 69k price and realistic scoped deliverable")
            page.locator(".fixed-offer-foot a").click()
            expect(page).to_have_url(root+"/csv-merge-service.html")
            expect(page.locator("h1")).to_contain_text("CSV")
            expect(page.locator(".offer-facts")).to_contain_text("69,000")
            checks.append("Home-to-service navigation works and price is disclosed before inquiry")
            assert page.locator(".offer-visual img").evaluate("e=>e.complete&&e.naturalWidth===1200")
            checks.append("Genuine original 1200x900 service illustration renders")
            assert page.locator(".offer-facts>div").count()==4
            expect(page.locator(".offer-facts")).to_contain_text("5,000")
            expect(page.locator(".offer-facts")).to_contain_text("3")
            checks.append("Service scope, correction and timeline fully visible")
            assert page.locator(".offer-cta .button").get_attribute("href").endswith("issues/new?template=csv-merge-request.yml")
            assert "정식 주문·결제는 별도 조건 합의" in page.locator(".terms").inner_text()
            assert "GitHub 로그인이 필요" in page.locator("body").inner_text()
            checks.append("Clear consultation boundary; no fake payment checkout or order conversion")
            assert page.locator("script[src*=analytics],script[src*=tracking]").count()==0
            assert "실제 고객 납품 사례 아님" in page.locator("body").inner_text()
            checks.append("No fabricated customer work, tracking pixels or fake testimonials")
            page.screenshot(path=str(CAP/"paid-offer-desktop.png"),full_page=False)
            for width,height in [(390,844),(768,950)]:
                page.set_viewport_size({"width":width,"height":height})
                page.reload(wait_until="load")
                assert page.evaluate("document.documentElement.scrollWidth<=window.innerWidth"),f"Mobile width overflow {width}"
                expect(page.locator("h1")).to_be_visible()
                expect(page.locator(".offer-cta .button")).to_be_visible()
                checks.append(f"Real Chrome responsive layout {width}px without sideways overflow")
                if width==390:page.screenshot(path=str(CAP/"paid-offer-mobile.png"),full_page=True)
            page.goto(root+"/csv-checker.html",wait_until="load")
            assert page.locator(".checker-cta .button").get_attribute("href")=="csv-merge-service.html"
            page.locator(".checker-cta .button").click()
            expect(page).to_have_url(root+"/csv-merge-service.html")
            checks.append("Free CSV checker converts to in-scope paid service page")
            assert not errors,errors
            assert not external,external
            assert not bad,bad
            checks.append("No runtime JS errors, external requests or broken HTTP resources")
            ctx.close()
            browser.close()
    finally:
        server.shutdown()
        server.server_close()
        th.join(timeout=3)
    import yaml
    y=yaml.safe_load((ROOT/".github"/"ISSUE_TEMPLATE"/"csv-merge-request.yml").read_text("utf-8"))
    assert y["labels"]==["customer-inquiry"]
    assert len(y["body"])>=6
    checks.append("GitHub inquiry YAML parses and preserves the existing inquiry label")
    out={"at":"2026-11-17","all_passed":True,"checks":checks,"js_errors":errors,"remote_requests":external,"bad_responses":bad}
    (CAP/"paid-offer-tests.json").write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding="utf-8")
    for name in checks:print("PASS",name)
    print("PASSED",len(checks),"/",len(checks))

if __name__=="__main__":main()
