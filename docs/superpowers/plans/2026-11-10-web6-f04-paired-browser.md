# WEB6 F04 Paired Browser Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tạo React candidate artifact được pin rõ ràng và kiểm chứng manual same-key resend bằng Chromium/Edge thật trên đúng backend B05 IIS Express/SQL candidate.

**Architecture:** F04a thêm một build-time candidate ID fail-closed vào production entry và mở rộng manifest pilot hiện có bằng contract WEB6 strict. F04b dùng Playwright ngoài Vite dev server để chạy UI/IndexedDB thật; backend B05 sở hữu host, SQL, actor, oracle, workload/recovery và cleanup. Default build không có candidate ID nên resend luôn OFF.

**Tech Stack:** React 19, TypeScript 5.9, Vite 8, Vitest 5, Playwright 1.64, native IndexedDB, Chromium, Microsoft Edge.

**Spec:** `docs/superpowers/specs/2026-11-10-web6-f04-paired-browser-design.md`

## Global Constraints

- Giữ Tailwind v4, Nova/Base UI, AG Grid Community, Dockview và Floating UI; không thêm UI framework hoặc popup controller mới.
- Không automatic HTTP mutation retry, không ID mới cho same-key, không suy 404 thành NOT_EXECUTED.
- Candidate switch chỉ là build-time ID khớp regex `^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$`; không query/localStorage/runtime toggle.
- Ordinary `npm run build` phải giữ resend OFF; live pilot chỉ dùng exact IIS Express HTTPS origin và backend-owned manifest.
- Không ghi trace/HAR live; screenshot/network summary phải allowlist và redacted.
- Chromium và Edge chạy tuần tự; fake/component test không thay actual SQL/browser acceptance.

## Review Focus

- Missing, empty, malformed hoặc overlong candidate ID không được tạo runtime có resend — Task 1 có unit/component/artifact tests.
- Backend context trả candidate ID khác compiled ID phải giữ operation protected và không mở confirmation — Task 3 có live negative case.
- Hai tab cùng storage partition chỉ một claim được dispatch, tab thua zero mutation — Task 3 có two-page test.
- COMMITTED response lost không được vào manual resend; not-observed + valid receipt mới được explicit consent — Task 3 kiểm cả hai cut point.
- Old exact12 host, restart/epoch change và authority revoke không được tự dispatch — Task 4 có cutover tests.

---

### Task 1: Candidate-bound production bootstrap (F04a)

**Files:**
- Create: `src/app/runtime/web6CandidateConfig.ts`
- Modify: `src/app/runtime/ApplicationEntry.tsx`
- Modify: `src/vite-env.d.ts`
- Modify: `vite.config.ts`
- Create: `tests/unit/http/web6CandidateConfig.test.ts`
- Modify: `tests/components/ApplicationEntry.test.tsx`
- Modify: `tests/production/runtimeIsolation.spec.ts`

**Interfaces:**
- Produces: `readWeb6CandidateConfig(value: string | undefined): { enabled: false } | { enabled: true; candidateId: string }`.
- Produces: `createConfiguredProductionRuntime(auth: AuthSession): ProtectedRuntime`, gọi `createProductionRuntime` với `manualResend` chỉ khi config enabled.
- Consumes: `import.meta.env.VITE_MYDMSVN_WEB6_CANDIDATE_ID`; không đọc URL, storage hoặc host response để enable.

- [ ] **Step 1: Viết RED unit/component tests**

Thêm các test tên `candidate config is disabled when absent or noncanonical`, `configured production runtime passes the exact candidate once`, và `default ApplicationEntry creates a resend-disabled runtime`. Assert literal disabled/enabled result, exact candidate ID và `operations.manualResendEnabled`; không assert source text.

- [ ] **Step 2: Chạy RED**

Run: `npm.cmd run test:unit -- tests/unit/http/web6CandidateConfig.test.ts tests/components/ApplicationEntry.test.tsx`

Expected: FAIL vì module/factory chưa tồn tại và default entry chưa consume candidate config.

- [ ] **Step 3: Implement bootstrap tối thiểu**

Tạo parser strict, factory production riêng và nối factory vào default prop của `ApplicationEntry`. Khai báo `ImportMetaEnv` typed. Trong `vite.config.ts`, validate candidate variable khi build: absent hợp lệ/OFF; nonempty invalid làm build fail trước artifact acceptance.

- [ ] **Step 4: Chạy GREEN và artifact isolation**

Run focused command ở Step 2, sau đó:

```powershell
npm.cmd run build
$env:VITE_MYDMSVN_WEB6_CANDIDATE_ID='web6-candidate-plan'
try { npm.cmd run build } finally { Remove-Item Env:VITE_MYDMSVN_WEB6_CANDIDATE_ID -ErrorAction SilentlyContinue }
npm.cmd run test:e2e -- --config playwright.production.config.ts --workers=1
```

Expected: focused tests PASS; ordinary và candidate build PASS; production artifact test PASS và không có Lab/fake modules. Test phải chứng minh ordinary artifact không expose resend.

- [ ] **Step 5: Commit**

```powershell
git add src/app/runtime/web6CandidateConfig.ts src/app/runtime/ApplicationEntry.tsx src/vite-env.d.ts vite.config.ts tests/unit/http/web6CandidateConfig.test.ts tests/components/ApplicationEntry.test.tsx tests/production/runtimeIsolation.spec.ts
git commit -m "feat(web6): bind resend to candidate build"
```

### Task 2: Strict WEB6 pilot manifest và redacted result contract (F04a)

**Files:**
- Create: `tests/pilot/web6-candidate-manifest.ts`
- Modify: `playwright.pilot.config.ts`
- Modify: `tests/pilot/web4-helpers.ts`
- Modify: `tests/pilot/pilot-count-reporter.ts`
- Create: `tests/unit/http/web6PilotManifest.test.ts`

**Interfaces:**
- Consumes: backend-owned private manifest với `version: 2`, `mode: "web6-candidate"`, exact HTTPS origin, `candidateId`, frontend/backend source SHA, frontend dist manifest hash, `resultPath`, actor/catalog/recovery handles.
- Produces: `readWeb6PilotManifest(path: string): Web6PilotManifest`, strict keys/shape/length; secrets chỉ tồn tại trong private input.
- Produces: sanitized result/count JSON chỉ gồm IDs/hashes/check markers/counts, không URL credential, token, cookie, receipt hoặc payload.

- [ ] **Step 1: Viết RED parser tests**

Test valid literal fixture và từ chối: HTTP origin, wrong mode/version, missing/extra field, malformed candidate/SHA/hash, result path ngoài owned run root và manifest chứa field `token`, `cookie`, `connectionString` ở sanitized output shape.

- [ ] **Step 2: Chạy RED**

Run: `npm.cmd run test:unit -- tests/unit/http/web6PilotManifest.test.ts`

Expected: FAIL vì parser/WEB6 mode chưa tồn tại.

- [ ] **Step 3: Implement parser và config**

Thêm `web6-candidate` vào `playwright.pilot.config.ts`, chọn đúng WEB6 specs, giữ `workers=1`, `retries=0`, `trace/video/screenshot=off`. `web4-helpers.ts` consume typed manifest thay vì cast rộng; count reporter giữ numeric-only output.

- [ ] **Step 4: Chạy GREEN**

Run focused unit test và `npm.cmd run typecheck`.

Expected: PASS; thiếu backend manifest tiếp tục fail trước browser launch.

- [ ] **Step 5: Commit**

```powershell
git add tests/pilot/web6-candidate-manifest.ts playwright.pilot.config.ts tests/pilot/web4-helpers.ts tests/pilot/pilot-count-reporter.ts tests/unit/http/web6PilotManifest.test.ts
git commit -m "test(web6): define paired pilot manifest"
```

### Task 3: Sáu manual same-key scenarios và two-tab one-shot (F04b)

**Files:**
- Create: `tests/pilot/web6-manual-resend-helpers.ts`
- Create: `tests/pilot/web6-manual-resend-live.spec.ts`
- Modify: `tests/pilot/web4-helpers.ts`
- Modify: `tests/pilot/pilot-count-reporter.ts`

**Interfaces:**
- Consumes: Task 2 manifest, production UI, `/api/v3/operations/*`, existing native draft/operation/manual-resend IDB stores.
- Produces: six per-kind records `{ operationKind, operationId, requestFingerprint, consentDispatches, candidateId, checkId }` và backend control/oracle check markers.
- Fault contract: not-observed dùng `route.abort` trước `route.fetch`; committed-response-lost dùng `route.fetch({ maxRetries: 0 })`, đọc 200 thật, dispose rồi abort browser response.

- [ ] **Step 1: Viết RED live specs**

Table-drive Sales/Receipt Create/Update/Post. Mỗi row tạo receipt trước original dispatch, abort original trước server observation, xác nhận UNKNOWN/protected, mở modal, explicit confirm, assert exact original key/method/route/body và đúng một resend request. Thêm committed-response-lost row chứng minh resolution/settlement không expose resend. Thêm two-page same-storage case: cả hai review, một winner dispatch, loser zero HTTP; reload không auto-dispatch. Thêm wrong-candidate, revoked grant, 401/5xx và IME/double-click cases.

- [ ] **Step 2: Chạy RED qua backend-owned fixture**

Run: backend B05 Task 3 sẽ gọi `node_modules/@playwright/test/cli.js test --config playwright.pilot.config.ts --project=chromium --workers=1 --max-failures=1` với private manifest.

Expected: FAIL trước khi backend producer/result validator và WEB6 mode hoàn chỉnh. Nếu owned fixture chưa sẵn sàng, ghi BLOCKED; không thay bằng fake PASS.

- [ ] **Step 3: Implement helper/spec tối thiểu**

Reuse UI selectors và IDB readers hiện có; không thêm runtime test endpoint. Network summary chỉ ghi method + allowlisted route class + status/count, không header/body. Browser chỉ ghi result sau backend control xác nhận expected cut point.

- [ ] **Step 4: Chạy Chromium GREEN**

Run lại backend-owned Chromium command. Expected: nonzero discovery, tất cả mandatory rows PASS, zero skip/retry, sáu kinds hiện diện, one transmission/consent và backend oracle one effect.

- [ ] **Step 5: Chạy Edge GREEN trên cùng pair**

Run cùng manifest/artifact với `--project=edge`. Expected cùng assertions PASS, zero skip/retry; không rebuild giữa hai browser.

- [ ] **Step 6: Commit**

```powershell
git add tests/pilot/web6-manual-resend-helpers.ts tests/pilot/web6-manual-resend-live.spec.ts tests/pilot/web4-helpers.ts tests/pilot/pilot-count-reporter.ts
git commit -m "test(web6): cover live manual resend"
```

### Task 4: Compatible cutover và restored-epoch browser boundaries (F04b)

**Files:**
- Create: `tests/pilot/web6-cutover-live.spec.ts`
- Modify: `tests/pilot/web6-candidate-manifest.ts`
- Modify: `playwright.pilot.config.ts`

**Interfaces:**
- Consumes: backend B05 cutover handles cho current pair, frontend WEB4 merge `ea104582...`, backend exact12 merge `a3f3db1...`, separate compatible DB/origin và restored epoch.
- Produces: sanitized markers cho old-client/new-host, new-client/old-host, same-epoch restart, revoked grant và restored-epoch rejection.

- [ ] **Step 1: Viết RED cutover specs**

Assert cached WEB4 artifact không có resend; current artifact trên old host giữ disabled; same-epoch restart giữ UNKNOWN/không dispatch; epoch rotation làm old receipt/client fail closed; support COMMITTED-unavailable không settle giả.

- [ ] **Step 2: Chạy RED bằng backend cutover fixture**

Expected: FAIL/BLOCKED cho tới khi B05 Task 4 cung cấp exact pinned artifacts/origins; tuyệt đối không dùng schema13 với exact12 binary.

- [ ] **Step 3: Implement manifest routing và assertions**

Chỉ thêm browser logic cần thiết; không thêm production compatibility fallback ngoài existing fail-closed decoder.

- [ ] **Step 4: Chạy Chromium rồi Edge tuần tự**

Expected: mọi mandatory marker PASS, zero skip/retry; artifact hashes và source pins trùng backend run record.

- [ ] **Step 5: Commit**

```powershell
git add tests/pilot/web6-cutover-live.spec.ts tests/pilot/web6-candidate-manifest.ts playwright.pilot.config.ts
git commit -m "test(web6): verify candidate cutover boundaries"
```

### Task 5: Frontend regression, evidence và handoff F04

**Files:**
- Create: `docs/evidence/web6/20261110-f04a-paired-cutover.md`
- Create: `docs/evidence/web6/20261110-f04b-measured-quality.md`
- Modify: `docs/evidence/web6/README.md`
- Modify: `docs/plans/20261103-001-web6-recovery-quality-web.md`
- Modify: `docs/development/WEB6_WEB_ACCEPTANCE.md`

**Interfaces:**
- Consumes: exact frontend/backend SHAs, dist/DLL/config hashes, browser count JSON, backend SQL/oracle/workload/recovery evidence.
- Produces: honest F6-PAIR/COMP/LOAD/REC dispositions; không tự cấp pilot/staging/production approval.

- [ ] **Step 1: Chạy complete affected frontend gates**

```powershell
npm.cmd ci
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run test:e2e -- --config playwright.production.config.ts --workers=1
```

Expected: nonzero counts, zero failed/skipped ngoài policy đã ghi; record exact totals và bundle warning nếu có.

- [ ] **Step 2: Reconcile live runs**

Đối chiếu Chromium/Edge count, six-kind scenario count, backend one-effect oracle, host/queue/process drain, SQL cleanup/quarantine, cutover pins và candidate ID. Không cộng scenario rows thành browser test count.

- [ ] **Step 3: Ghi evidence từ kết quả thật**

Ghi PASS/FAIL/BLOCKED/NOT RUN, retries và failed attempts. Attended Telex/VNI/zoom và Narrator tách riêng; Narrator chưa chạy là NOT RUN/Owner exception. Ordinary resend vẫn OFF.

- [ ] **Step 4: Verify docs/hygiene**

Run `git diff --check`, UTF-8 no-BOM/LF check, link check, `git status --short`; xác nhận WEB5 archive và corpus không đổi.

- [ ] **Step 5: Commit**

```powershell
git add docs/evidence/web6 docs/plans/20261103-001-web6-recovery-quality-web.md docs/development/WEB6_WEB_ACCEPTANCE.md
git commit -m "docs(web6): record F04 paired candidate evidence"
```

- [ ] **Step 6: Independent review**

Review candidate enablement, no-auto-retry, cross-tab CAS, secret redaction, count reconciliation và evidence. Mọi behavioral fix bắt đầu bằng RED test và lặp focused/full gate liên quan.

