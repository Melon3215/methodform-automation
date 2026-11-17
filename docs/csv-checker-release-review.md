# CSV checker launch review — 2026-11-17

## Why this release exists
The existing MethodForm Automation landing page is live, but the only measured channel was zero **repository** views in the last 14 days and no publicly labeled enquiries at 09:08 KST. Repository views do not measure GitHub Pages visitors; zero repository views is **not** evidence that nobody opened the website.

A free, working, privacy-aware tool provides verifiable service capability to someone already visiting. It also adds a search-discoverable page for Korean-language CSV duplicate inspection. Traffic gains and orders are hypotheses, not earned revenue.

## Actual work
- `csv-checker.html`: Korean UX, file/text input, sample data, result table, filters, multi-key selection, export, FAQ, existing consultation CTA.
- `csv-core.mjs`: RFC4180-style CSV parsing with quoted fields, quoted line breaks, BOM and three separator types. Flags duplicate keys, inconsistent column counts and missing keys independently.
- `checker.js` and `checker.css`: browser-only interaction, accessible status, desktop/mobile layout, filename report export.
- `index.html` and `site.css`: an above-service-banner path to the tool; original paid consultation CTA retained.
- `favicon.svg`: internal static branding, avoids missing icon requests.
- `.gitignore`: excludes local captured screenshots/test report and environment files.
- README clarifies input/output/limitations, local tests and publication gate.

## Reproducible checks
Run in the site directory:

```
node --test tests/csv-core.test.mjs
python -X utf8 tests/browser_check.py
```

As of 2026-11-17 09:15 KST: **12/12 Node tests** passed, **13/13 real Chrome checks** passed, desktop and mobile screenshots captured under ignored `.local-evidence/`. The browser check verifies no external network requests, no console errors, no broken assets, CSV export formula neutralization, 2 MiB limit, and responsive width.

## Operating boundary
**This feature is only committed locally in `feature/csv-checker-conversion`.** The public site is still on `main`; do not claim the new tool is available on the hosted URL. Owner approval is required before public release or changes to legal/privacy-facing contact routes.

When approved:
1. Review actual browser screenshots, privacy copy and source changes.
2. Merge feature branch to public `main` and push with the authenticated account.
3. Verify the actual `/csv-checker.html` URL returns HTTP 200, `csv-core.mjs` is served with JavaScript MIME type, and no page errors.
4. Check the GitHub issue form still accepts a sanitized, fictional sample request.
5. Record deployment URL/time/commit, then measure traffic independently of GitHub repository views. Actual enquiries and paid orders are separate metrics; there is no cash evidence yet.

Avoid client files, real identifiers, contact details, tokens, passwords and sensitive business documents in public GitHub Issues. The checker does not transmit an input file, but a user should still avoid running untrusted extensions on sensitive data.
