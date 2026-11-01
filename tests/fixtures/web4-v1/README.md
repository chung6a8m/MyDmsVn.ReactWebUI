# WEB4 B01 canonical consumer pin

Backend owns this contract. `corpus/` is an exact byte mirror of all 48 committed blobs under `docs/contracts/web4-v1` at [MyDmsVn `1c603c6ac57e59a3f7b4bc6ca976b2d531c079aa`](https://github.com/chung6a8m/MyDmsVn/blob/1c603c6ac57e59a3f7b4bc6ca976b2d531c079aa/docs/contracts/web4-v1/README.md). Do not edit or regenerate the mirror locally. `provenance.json` pins the repository, commit, source baseline, directory, manifest and every mirrored file SHA-256.

Manifest SHA-256: `0acab190e7fe126d53c13c0510a1958365e5a6e1fda78a4321da78297e0b3f1a`. The manifest pins 47 artifacts; it is pinned externally by provenance to avoid self-reference. Consumer metadata stays outside `corpus/` because the backend oracle rejects unmanifested files.

The corpus has 38 wire fixtures, 8 protected statuses, 24 independently generated fingerprint vectors (including 400 expanded lines), and 12 protocol scenarios. These are synthetic contract examples, not live SQL records or executed HTTP behavior. Run `node tests/fixtures/web4-v1/corpus/validate-corpus.mjs` and `npm.cmd run test:unit -- tests/unit/http/web4ContractCheckpoint.test.ts` from the frontend root.

[Source/consumer checkpoint](../../../docs/development/WEB4_F01_SOURCE_CHECKPOINT.md) and [F01 evidence](../../../docs/evidence/web4/20261101-web4-01-contract.md) own scope and actual results. B04 API, F02 IndexedDB and F03 protected settlement are not implemented by this pin. Existing WEB2/WEB3 corpora remain unchanged.
