# WEB2 v1 — immutable upstream test inputs

These files mirror the canonical backend corpus at `chung6a8m/MyDmsVn@de6a00c6ccbcfe30b8cc114bc4408ee60294c478`, `docs/contracts/web2-v1`. Only line endings are normalized to LF. `provenance.json` records SHA-256 of these normalized bytes so tests can run without requiring a sibling checkout.

The backend owns the contract and examples. Do not edit these JSON inputs independently. Update only from an identified backend revision; build fault/variation cases from per-test clones. This directory is test input, not another specification or a production mock runtime.
