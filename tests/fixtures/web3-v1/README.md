# WEB3 v1 — immutable backend contract inputs

This is a byte-exact mirror of canonical JSON and MJS files from `chung6a8m/MyDmsVn@d2d4b5e799916d058a90149331ac15345248d025`, `docs/contracts/web3-v1`. `provenance.json` records the reviewed corpus revision, its inspected runtime baseline and SHA-256 of every copied file. Files were copied from committed Git bytes without normalization; upstream README and `.gitattributes` remain backend-owned.

The backend owns the fixtures, controls and executable validator. Do not edit copied files independently or create a second frontend Receipt schema here. Update from an identified backend revision; create variation cases from clones. Tests run the copied validator directly and need no sibling checkout. The README/provenance are frontend mirror metadata, not a second wire specification.

`web3ContractCheckpoint.test.ts` checks existing production scalar, envelope, error and decimal-preview behavior against compatible canonical values. It does not implement a Receipt/Inventory codec or HTTP port. Current primitives do not cover zero-inclusive int64 counts, signed stock quantity or canonical rowversion. Signed negative zero, UTC fractional precision above seven digits and the 64-character decimal lexeme limit also need explicit F03 rules; complete corpus validation continues to enforce the backend contract.

Passing these checks proves local fixture consistency and the stated primitive compatibility only. It does not prove HTTP routes, JWT permission enforcement, SQL stock/valuation, browser behavior or a real Post transaction.
