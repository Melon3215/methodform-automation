# MethodForm Automation

Korean-language remote custom automation enquiry site and a free browser-only CSV inspection tool.

Public website: https://melon3215.github.io/methodform-automation/

**Important:** The CSV inspection page is a local feature under `feature/csv-checker-conversion` until explicitly approved for publication. Do not describe it as available on the public website before it is deployed and verified.

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

## Publication boundary

The user has not specifically approved publishing this new website feature. Keep this work local until a distinct publication decision. Before release, verify that GitHub Pages serves .mjs files with the JavaScript MIME type, run the Chrome checks against the actual public URL, and record a deployment receipt. Visitor counts and paid orders must be measured separately; repository traffic is not Pages traffic.
