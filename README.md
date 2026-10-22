# SupplyLens / v0.3

**Clarity before commitment.** Product specification workspace by Kacper Wiklendt.

Compare two supplier offers, investigate mismatches, estimate order costs and prepare a follow-up. Deterministic specification comparison works offline; AI analysis of free text is a separate, optional server feature.

## Start

Open `preview.html` for the self-contained application. No install or API key is required for product comparison, planning and exports. Browser storage and clipboard support depend on browser settings; use export as a backup.

Or run `python3 app.py` and open http://127.0.0.1:8765. Python 3.10+; no third-party runtime packages.

## Working features

- Six editable product starters: jacket, pack, gloves, shoes, bottle and power bank. All supplier data is fictional.
- Search/category filters, create/duplicate product (up to 30), add/remove/undo specification (1–30 rows).
- Two supplier offers, critical flags and live alignment summaries.
- Exact text, minimum/maximum, required-list and deadline comparison; compatible unit conversion.
- Findings filters/search, source-field links, review checks, notes, selected follow-up questions, tones and editable messages.
- JSON/CSV/Markdown review export; full print report; clipboard copy with manual fallback.
- Order planner with quantity, freight, contingency, supplier minimum-order warnings and Use MOQ action.
- Explicit browser-local saving, up to 12 revisions, difference inspection and restore.
- Project JSON import/export. Import creates a separate product and does not overwrite existing work.
- Three clearly labelled, fixed document examples; these are not live model outputs.
- AI setup instructions when unavailable; real document analysis when the Python backend is configured.

## Optional AI

Set OPENAI_API_KEY in your server environment, optionally OPENAI_MODEL (default gpt-4.1-mini), then start Python. Never put a key into frontend files or commit it. `/api/config` returns only an availability boolean. A key does not guarantee provider/model access or credit. Both documents are sent to OpenAI only when the user runs Live AI.

The backend validates structured model output and exact source quotations. Quotation presence does not prove truth, interpretation or completeness. Provider failures are displayed, never silently replaced with sample results. No paid live-model request was made for this release; provider tests use controlled responses.

Hosted/static editions cannot run the Python server and do not call a model. The local Python server is not a public production backend. A production AI deployment needs a suitable server, authentication, quotas, secret management and operational controls.

## Rules and limitations

- Text equality ignores case/repeated spaces; it does not infer synonyms.
- Numeric rules support mass, length, volume, charge, power, time and same-currency values. Currency exchange is never inferred.
- Required lists are comma-separated whole items. Dates use valid YYYY-MM-DD calendar dates.
- Empty offers are missing; ambiguous/approximate/incompatible numeric offers are unclear. Invalid targets block full review. Offer summaries are provisional until validation.
- Aligned claims do not prove product quality, legal compliance or certification validity.
- Cost = (price × quantity + freight) × (1 + contingency / 100), excluding duties, taxes and exchange rates. The planner uses stable `price` and `moq` row IDs from templates. Removing price disables cost estimation; Undo recovers an accidental deletion.

## Data

Edits are in memory until Save revision or export. Save stores all products and up to 12 snapshots in browser local storage. For structured reviews, a snapshot also includes notes, checkboxes and draft; restore that revision to reopen them. Re-comparing starts a new review. Restoring preserves the previous specification as an in-memory checkpoint; save to persist it.

Project JSON exports the specification and offers only. Review exports include source inputs, findings, notes and draft. Data is not cloud-synced or encrypted by this application. Clearing browser data deletes saves. Avoid sensitive data on shared devices and keep file backups. Browser policies can restrict storage, download, copy and print.

## Architecture and tests

- `web/products.js`: pure units, rules, validation, cost and revision diff.
- `web/core.js`: pure review filtering, composition and exports.
- `web/studio.js`: product editor, catalog, planner and local revisions.
- `web/app.js`: document analysis and shared review UI.
- `app.py`: local HTTP server; `engine.py`: AI adapter and quote validation.
- `build_preview.py`: embeds code and images into preview.html.

Run:

```bash
python3 -m unittest discover -s tests
node tests/test_core.mjs
node tests/test_products.mjs
python3 build_preview.py
```

54 checks: 21 Python, 9 review logic and 24 product logic. Browser QA covers edited-value recomputation, save/diff/restore with notes, add/remove/undo rows, cost recalculation, example replay, AI setup, follow-up copying and JSON export. Physical mobile-device testing and live-provider integration remain advisable before public use.

Inputs are rendered using text nodes. CSV output guards common formula prefixes. Same-origin JSON checks, size limits and one simultaneous AI request are prototype safeguards, not a production security certification.

## Design and authorship

Charcoal, graphite and cobalt; editorial photography, SVG technical product drawings, responsive tool panels and reduced-motion support. Product/fabric/port imagery was generated with AI. No affiliation with brands used as visual inspiration.

Developed with AI assistance. Explain the implementation and limitations honestly in portfolio conversations. See INTERVIEW_PL.md.
