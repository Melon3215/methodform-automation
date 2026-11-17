# MethodForm Automation

Korean-language remote custom automation enquiry site and a free browser-only CSV inspection tool.

Public website: https://melon3215.github.io/methodform-automation/

**Live:** The CSV inspection utility was published to the public GitHub Pages site on 2026-11-17 and verified in live desktop Chrome. The feature originated on `feature/csv-checker-conversion` and was merged to `main` at commit `40ed43d`.

## Pages

- `index.html`: existing static service landing page and the enquiry path using the GitHub Issue Form.
- `csv-checker.html`: standalone SEO-friendly, browser-only CSV data-quality checker and route to the existing paid service enquiry.
- `csv-core.mjs`: deterministic zero-dependency CSV parser, duplicate analyser, width validation, and safe CSV report generator.
- `checker.js`, `checker.css`: user interface, controls, downloading and mobile layout.
- `tests/csv-core.test.mjs`: Node unit tests.
- `tests/browser_check.py`: real Chrome/Playwright tests and screenshots.

## Run locally

No npm install or web framework required.

```powershell
# In this repository, using Node 22+ and Python with playwright installed:
node --test tests/csv-core.test.mjs
python -X utf8 tests/browser_check.py

# For manual inspection:
python -m http.server 8765
# Visit http://127.0.0.1:8765/csv-checker.html
```

The browser test starts and shuts down its own ephemeral local server. Captures and its machine-readable test report are saved to ignored `.local-evidence/`.

## Privacy and scope

- All data parsing, normalization, duplicate detection, result rendering, and exports run in the current browser process. There is no form submission, analytics, network request, storage, remote API or telemetry in the utility.
- Does not automatically send the customer's real file in a GitHub issue; the only outbound link is the existing opt-in public enquiry form. The form warns users to use synthetic examples and avoid secrets or personal information.
- Input is bounded to 2 MiB and 20,000 data records, at most 150 columns. UTF-8 CSV with comma, tab or semicolon delimiters is supported, with quoted commas, double quotes and embedded line breaks. XLSX and binary codepages are not supported.
- One or more selectable keys determine repeated records. Comparison normalizes unicode width, leading/trailing spaces, spaces and English case. It does not imply that non-key fields are identical.
- The original file is never changed. Export includes the original fields and separate result columns, using UTF-8 BOM for Excel and formula escaping to reduce spreadsheet injection risk.
- This is a practical convenience checker, not formal data certification, legal advice, or verified full document recovery.

## Production deployment and monitoring

Production URL: https://melon3215.github.io/methodform-automation/csv-checker.html. The GitHub Pages build for commit `40ed43dbe7d6b9bf6059b51f4e5037f7b8df88aa` completed successfully. Live HTTP checks returned 200 on home, checker, module, CSS, JS and favicon; `.mjs` is served as `text/javascript`. A real Chrome test exercised the published CTA, accurate sample analysis and CSV download with zero browser exceptions. Evidence is in ignored `.local-evidence/live_verification.json`; no client content was saved. This deployment is an acquisition experiment, not verified revenue. Monitor actual inquiries/accepted quotes and paid settlements; GitHub repository views are not Pages traffic.
