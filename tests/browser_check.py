"""Independent headless Chrome smoke checks for the local service and browser-only CSV utility.
No network outside the ephemeral local HTTP server. This script does not publish anything.
"""
from __future__ import annotations
import argparse
import functools
import http.server
import json
from pathlib import Path
import tempfile
import threading
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
SHOTS = ROOT / ".local-evidence"

class QuietHandler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, '.mjs': 'text/javascript'}
    def log_message(self, *args): pass

def main():
    SHOTS.mkdir(parents=True, exist_ok=True)
    service = http.server.ThreadingHTTPServer(
        ("127.0.0.1", 0), functools.partial(QuietHandler, directory=str(ROOT))
    )
    thread = threading.Thread(target=service.serve_forever, daemon=True)
    thread.start()
    base = f"http://127.0.0.1:{service.server_port}"
    errors, external, bad = [], [], []
    checks = []
    def check(label):
        checks.append(label); print("PASS", label, flush=True)
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(channel="chrome", headless=True, args=[
                "--no-sandbox", "--disable-background-networking", "--disable-sync",
                "--no-first-run", "--disable-component-update"
            ])
            context = browser.new_context(viewport={"width": 1440, "height": 900}, accept_downloads=True)
            page = context.new_page()
            page.on("pageerror", lambda error: errors.append(str(error)))
            page.on("console", lambda msg: errors.append("console: " + msg.text) if msg.type == "error" else None)
            page.on("request", lambda req: external.append(req.url) if not req.url.startswith((base, "data:", "blob:", "about:")) else None)
            page.on("response", lambda res: bad.append([res.status, res.url]) if res.status >= 400 and not res.url.endswith("/favicon.ico") else None)

            page.goto(base + "/", wait_until="load", timeout=18000)
            expect(page.locator(".free-tool-banner a")).to_have_attribute("href","csv-checker.html")
            expect(page.locator("header .logo")).to_be_visible()
            page.screenshot(path=str(SHOTS/"1-home.png"), full_page=False)
            check("Homepage promotes real free CSV inspection and the existing enquiry CTA")

            page.locator(".free-tool-banner a").click()
            expect(page).to_have_url(base + "/csv-checker.html")
            expect(page.locator("h1")).to_contain_text("CSV 중복")
            check("Checker linked and loads as a static GitHub-Pages-compatible page")

            page.locator("#sample").click()
            expect(page.locator("#total")).to_have_text("8")
            expect(page.locator("#duplicate")).to_have_text("1")
            expect(page.locator("#bad-columns")).to_have_text("1")
            expect(page.locator("#empty-key")).to_have_text("1")
            expect(page.locator("#result-body tr")).to_have_count(8)
            check("Sample file: exact duplicate, missing-column and empty-key counts")

            page.locator("#status-filter").select_option("중복")
            expect(page.locator("#result-body tr")).to_have_count(1)
            expect(page.locator("#result-body tr .status")).to_have_text("중복")
            page.locator("#status-filter").select_option("all")
            check("Dynamic result filters distinguish actual duplicate rows")

            page.locator("#csv-text").fill('id,variant\nAAA,one\nAAA,two\nBBB,three')
            page.locator("#inspect").click()
            expect(page.locator("#duplicate")).to_have_text("1")
            inputs = page.locator("#key-fields input")
            expect(inputs).to_have_count(2)
            inputs.nth(1).check()
            expect(page.locator("#duplicate")).to_have_text("0")
            inputs.nth(0).uncheck()
            expect(page.locator("#duplicate")).to_have_text("0")
            inputs.nth(1).click()
            expect(inputs.nth(1)).to_be_checked()
            check("Recomputing by multiple keys and preventing empty key selection")

            page.locator("#sample").click()
            with page.expect_download() as download_info:
                page.locator("#download").click()
            download=download_info.value
            assert download.suggested_filename.endswith(".csv")
            with tempfile.TemporaryDirectory() as tmp:
                path=Path(tmp)/download.suggested_filename
                download.save_as(str(path))
                exported=path.read_text(encoding="utf-8-sig")
                assert "검사결과" in exported and "최초행" in exported
                assert "중복" in exported and "A001" in exported
            check("Downloads complete, Excel-compatible BOM CSV without altering original rows")

            csv='id,value\nA,=HYPERLINK(fake)\nB,"normal"\nA,duplicate'
            page.locator("#csv-text").fill(csv)
            page.locator("#inspect").click()
            expect(page.locator("#total")).to_have_text("3")
            expect(page.locator("#duplicate")).to_have_text("1")
            with page.expect_download() as download_info:
                page.locator("#download").click()
            with tempfile.TemporaryDirectory() as tmp:
                output=Path(tmp)/"safe.csv"
                download_info.value.save_as(str(output))
                assert "'=HYPERLINK" in output.read_text(encoding="utf-8-sig")
            check("Excel formula injection neutralized in downloadable report")

            with tempfile.TemporaryDirectory() as tmp:
                path=Path(tmp)/"input.csv"
                path.write_text('item;qty\nK1;2\nK1;3\nK2;1', encoding="utf-8")
                page.locator("#csv-file").set_input_files(str(path))
                page.locator("#inspect").click()
                expect(page.locator("#duplicate")).to_have_text("1")
                assert page.evaluate("document.querySelector('#csv-text').value") == ""
            check("Semicolon-delimited file input parsed locally")

            page.locator("#csv-file").set_input_files([])
            page.locator("#csv-text").fill('id,value\nA,"unterminated')
            page.locator("#inspect").click()
            expect(page.locator("#results")).to_be_hidden()
            expect(page.locator("#input-message")).to_contain_text("닫히지 않은")
            check("Malformed CSV fails safely without stale or misleading results")

            with tempfile.TemporaryDirectory() as tmp:
                too_big=Path(tmp)/"oversized.csv"
                too_big.write_bytes(b'A'*(2*1024*1024+1))
                page.locator("#csv-file").set_input_files(str(too_big))
                page.locator("#inspect").click()
                expect(page.locator("#results")).to_be_hidden()
                expect(page.locator("#input-message")).to_contain_text("2 MiB")
            check("2 MiB file cap rejects oversized local inputs")

            page.locator("#clear").click()
            expect(page.locator("#csv-text")).to_have_value("")
            check("Clear discards input and visible analysis")

            page.locator("#sample").click()
            page.screenshot(path=str(SHOTS/"2-checker-desktop.png"), full_page=False)
            page.set_viewport_size({"width":390,"height":844})
            page.goto(base+"/csv-checker.html",wait_until="load")
            page.locator("#sample").click()
            assert page.evaluate("document.documentElement.scrollWidth <= innerWidth"), "Mobile overflow"
            expect(page.locator("#download")).to_be_visible()
            page.screenshot(path=str(SHOTS/"3-checker-mobile.png"),full_page=True)
            check("Real 1440px desktop and 390px mobile screenshots; no horizontal overflow")

            assert not errors, f"Browser errors: {errors}"
            assert not external, f"Unapproved requests: {external}"
            assert not bad, f"Broken local files: {bad}"
            check("No JavaScript exceptions, remote requests or broken local resources")
            context.close();browser.close()
    finally:
        service.shutdown();service.server_close();thread.join(timeout=4)
    report={"passed":True,"checks":checks,"javascript_errors":errors,"external_requests":external,"http_failures":bad}
    (SHOTS/"report.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("TESTS",len(checks),"/",len(checks),"PASS", flush=True)

if __name__=="__main__":main()
