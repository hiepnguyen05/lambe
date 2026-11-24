# Runtime dependency evidence — 2026-10-31

**Latest verified status:** rebuilt image `a257b1c8555a` physically contains follow-redirects **1.16.2**. A fresh isolated audit confirms **0 high, 0 critical and 10 moderate package entries**. The complete earlier `674c2d6194fe` report is retained below as historical pre-patch evidence. Parent validation subsequently passed the final-image check (808 unit), full E2E (77), and the added real-PostgreSQL dashboard case in the rerun security suite (38). The same image is now deployed locally and healthy; see [the parent verification report](quality-verification-2026-10-30.md). This audit alone did not establish test/deployment outcomes.

P6 Quality/Operations documentation pass; P5 remains paused. This pass owns this document and the update to [quality-performance-baseline.md](quality-performance-baseline.md). It made no source, package, lockfile, plan or application-data changes, installation, audit fix, pentest, benchmark rerun or commit. No existing container was restarted, deployed or cleaned up. Only the authorized disposable `docker run --rm` inspection containers were used, without env files, secrets or host mounts. The physical inventory container had networking disabled; the audit container contacted the package registry.

## Latest rebuilt-image audit — 2026-10-31

Image inspected before the audit and again after physical verification: **`sha256:a257b1c8555a5af5f4d328384cadd63864bfa74724400ff9c7c9bb51c38f5d95`**, created `2026-10-31T07:21:07.234540707Z`; workdir `/usr/src/app`; physical Node **22.23.4**. The tag remained unchanged across these checks.

The same authorized isolated command was executed with proper elevated Docker access, no mounts and no supplied environment or secrets:

```text
docker run --rm backend-lambe_server npm audit --omit=dev --omit=peer --ignore-scripts --json
```

Fresh report: **exit 1**, completed with **10 moderate, 0 high, 0 critical, 0 low and 0 info** package entries. The zero-high result comes from this report, not subtraction from the old total. There is no follow-redirects entry. The remaining report covers **11 physically verified package paths**, **5 packages with direct advisory objects**, **5 dependency-only rollup entries**, and **9 distinct GHSA records**. These counts do not represent demonstrated exploits.

Latest raw evidence: [tasks/p6-runtime-reaudit-20261031-06898e0bac094b2cb48f4fc842f994db](../../tasks/p6-runtime-reaudit-20261031-06898e0bac094b2cb48f4fc842f994db/), containing `image.txt`, `image-after.txt`, `audit.json`, `audit.stderr.log`, `audit.exit.txt`, `physical.json`, `physical.stderr.log` and `verified-summary.json`. Only image/package metadata was collected. Physical manifests were read with `fs.existsSync` and JSON parsing in a separate `--network none` container without mounts; package exports were not used to infer physical absence.

### Latest physical override checks

| Manifest under `/usr/src/app/`               | Verified version | Latest audit |
| -------------------------------------------- | ---------------- | ------------ |
| `node_modules/follow-redirects/package.json` | **1.16.2**       | No entry     |
| `node_modules/body-parser/package.json`      | **2.4.0**        | No entry     |
| `node_modules/multer/package.json`           | **2.5.0**        | No entry     |
| `node_modules/qs/package.json`               | **6.16.2**       | No entry     |

Recursive physical inventory found one copy of each of these four packages, all at the expected versions. Prisma CLI, `@prisma/config` and `deepmerge-ts` remain physically absent. This establishes physical versions and scanner results, not a blanket dependency-safety or application-compatibility claim.

### Latest remaining advisory paths

All paths below are relative to `/usr/src/app/` and have physically verified manifests. Their versions match the historical pre-patch inventory; the original advisory links and the distinction between direct records and dependency rollups are preserved in that section.

| Physical path                                                                            | Version | Moderate audit classification                     |
| ---------------------------------------------------------------------------------------- | ------- | ------------------------------------------------- |
| `node_modules/@nestjs/swagger`                                                           | 11.4.7  | Rollup via js-yaml                                |
| `node_modules/@nestjs/swagger/node_modules/js-yaml`                                      | 5.3.0   | Direct advisory record                            |
| `node_modules/nodemailer`                                                                | 10.0.10 | Five direct advisory records in one package entry |
| `node_modules/uuid`                                                                      | 9.0.1   | Direct advisory record                            |
| `node_modules/rimraf/node_modules/glob`                                                  | 10.5.0  | Direct advisory record plus minimatch rollup      |
| `node_modules/rimraf/node_modules/minimatch`                                             | 9.0.9   | Direct advisory record                            |
| `node_modules/rimraf`                                                                    | 5.0.10  | Rollup via glob                                   |
| `node_modules/gaxios`                                                                    | 6.7.1   | Shared gaxios entry; this copy depends on uuid    |
| `node_modules/@google-cloud/firestore-api/node_modules/gcp-metadata/node_modules/gaxios` | 7.1.3   | Same gaxios entry; this copy depends on rimraf    |
| `node_modules/@google-cloud/firestore-api/node_modules/gcp-metadata`                     | 8.1.4   | Rollup via nested gaxios                          |
| `node_modules/@google-cloud/firestore-api/node_modules/google-gax`                       | 5.0.8   | Rollup via rimraf                                 |

Latest dependency metadata remains `prod: 217`, `dev: 0`, `optional: 154`, `peer: 35`, `peerOptional: 0`, `total: 370`. These are overlapping npm classifications, not independent physical package counts.

### Preventive patch and handoff

The physical SDK dependency branch is `sepay-pg-node` 1.0.0 → axios **1.20.0** → follow-redirects, now **1.16.2**. The [primary follow-redirects advisory](https://github.com/advisories/GHSA-mrwp-f3q8-3g9p) explicitly reports that its Axios 1.20.0 case with follow-redirects 1.16.1 did not reproduce because Axios normalized the array, and does not claim Axios is affected. Package-range matching in the earlier audit therefore did not demonstrate an application vulnerability on this SDK branch. The parent applied the patch preventively within existing P6 authorization. This worker ran no reproduction, exploit payload or application request.

The parent reports final-image unit/E2E checks in progress before deployment; no passing outcome is claimed here. Moderate dependency fixes remain outside this batch. This re-audit changed only this runtime document and added the unique evidence directory; it made no package/source changes, performance rerun, restart, deployment, existing-container cleanup or commit. P5 remains paused.

## Historical pre-patch report — image `674c2d6194fe`

The following inventory, audit totals and handoff describe the earlier image and the state before the parent-owned follow-redirects update. They are retained for comparison and do not supersede the latest verified results above.

### Image and reproducible evidence

- Audited tag: `backend-lambe_server`.
- Audited pre-patch image: `sha256:674c2d6194fe7752f68123196daa8e97e6b7254e37b9077fd430b3601d285c7a`, created `2026-10-30T14:50:02.371142084Z`; workdir `/usr/src/app`; physical Node version **22.23.4**.
- At inspection, running `lambe_server` still used old image **337fdc0b7822**, container `f1863da38c5b`. The new image was built but **not deployed**. These findings do not describe the running app's dependencies.
- Raw evidence directory: [tasks/p6-runtime-20261031-890509882d9f436d967fb06c3c01aecd](../../tasks/p6-runtime-20261031-890509882d9f436d967fb06c3c01aecd/). It contains `image.txt`, `containers.txt`, `audit.json`, `audit.stderr.log`, `audit.exit.txt`, `physical.json` and `physical.stderr.log`. Logs contain package/image metadata only; no application payloads, PII, credentials or environment values were collected.

Executed audit:

```text
docker run --rm backend-lambe_server npm audit --omit=dev --omit=peer --ignore-scripts --json
```

Audit **exit 1** means a completed advisory report, not execution failure. Pre-patch metadata: **11 affected package entries: 1 high, 10 moderate, 0 critical/low/info**. These entries cover **12 physical package paths**, **6 packages with their own advisory objects**, **5 dependency-only rollup entries**, and **10 distinct GHSA records**. Multiple advisories can affect one package; parent rollups repeat underlying findings. None of these counts is a count of demonstrated exploits or a post-patch total. References to this report's findings below apply only to the recorded pre-patch image.

Physical verification used Node's `fs.existsSync(<physical path>/package.json)` and `fs.readFileSync`/JSON parsing, recursively inspecting installed `node_modules`, including scopes and nested copies. It did not use `require.resolve('package/package.json')`, which can fail because of package export restrictions even when a file exists. Every path listed in this audit matched a physical manifest. Root absence was checked separately from nested presence.

### Verified overrides and excluded historical chain

| Physical manifest under `/usr/src/app/`    | Result                                      | Interpretation                                                                    |
| ------------------------------------------ | ------------------------------------------- | --------------------------------------------------------------------------------- |
| `node_modules/body-parser/package.json`    | 2.4.0; Node `>=18`; qs dependency `^6.16.1` | Expected override present; no current audit entry.                                |
| `node_modules/multer/package.json`         | 2.5.0; Node `>=10.16.0`                     | Expected override present; no current audit entry.                                |
| `node_modules/qs/package.json`             | 6.16.2; Node `>=0.6`                        | Expected override present and within body-parser's range; no current audit entry. |
| `node_modules/prisma/package.json`         | Absent                                      | Prisma CLI is not physically shipped here.                                        |
| `node_modules/@prisma/config/package.json` | Absent                                      | Historical config rollup is not a physical runtime finding here.                  |
| `node_modules/deepmerge-ts/package.json`   | Absent                                      | Historical merge advisory package is not physically shipped here.                 |
| `node_modules/@prisma/client/package.json` | 6.19.3 present                              | Runtime client is distinct from the absent CLI/config chain.                      |
| `node_modules/js-yaml/package.json`        | Absent                                      | Does not establish absence of Swagger's nested copy below.                        |

The three override engine ranges admit Node 22.23.4. This verifies versions and declared engine compatibility, not full application regression compatibility. The prior **12 entries / 5 high / 7 moderate** snapshot in [quality-security-evidence.md](quality-security-evidence.md) is historical. Its Prisma/config/deepmerge entries were already reported physically absent in the old image because peers were omitted. Do not subtract them from that audit to manufacture a current total. This fresh audit has a different dependency/advisory snapshot and reports none of that three-package chain.

### Remaining packages with direct advisory records

Paths below are relative to `/usr/src/app/`; each has a verified physical `package.json`. Severity is the audit classification, which need not equal a CVSS score's conventional band. Existing advisory descriptions and source-inspection limitations remain in [quality-security-evidence.md](quality-security-evidence.md); they were not retested here.

| Physical package path and version                             | Current audit evidence                                                                                                                                                                                                                                                                                                                                                                                                                     | Evidence limit                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `node_modules/follow-redirects` **1.16.1**                    | **High**, [GHSA-mrwp-f3q8-3g9p](https://github.com/advisories/GHSA-mrwp-f3q8-3g9p): cross-realm sensitive-header handling during redirects; affected `>=1.16.0 <=1.16.1`, patched 1.16.2.                                                                                                                                                                                                                                                  | Physical manifests show `sepay-pg-node` 1.0.0 → axios 1.20.0 → follow-redirects. No cross-realm array, credential forwarding or attacker-controlled redirect path was exercised.                                                                               |
| `node_modules/@nestjs/swagger/node_modules/js-yaml` **5.3.0** | Moderate, [GHSA-r3ph-w7gj-g6xm](https://github.com/advisories/GHSA-r3ph-w7gj-g6xm), affected `>=5.0.0 <=5.4.0`.                                                                                                                                                                                                                                                                                                                            | Resolves the previously pending nested-path check: present despite root absence. Historical source review found no untrusted YAML loader and development-gated Swagger setup; that is not a reachability proof.                                                |
| `node_modules/nodemailer` **10.0.10**                         | Moderate, five records: [nested comments](https://github.com/advisories/GHSA-8c8m-p3m8-cjg8), [group delimiters](https://github.com/advisories/GHSA-m943-m63m-w62w), [quoted local parts](https://github.com/advisories/GHSA-85x2-q946-cp5h) (`>=3.0.0 <10.1.4`), [SMTP AUTH regex](https://github.com/advisories/GHSA-4ffr-jq9g-5ffx), [angle-address comments](https://github.com/advisories/GHSA-g73g-hqqh-jr95) (`>=3.0.0 <=10.0.12`). | One package entry, five advisories. No mail delivery, hostile SMTP response or recipient-parser exploitation was tested.                                                                                                                                       |
| `node_modules/uuid` **9.0.1**                                 | Moderate, [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq), affected `<11.1.1`; caller-buffer bounds in versioned UUID APIs.                                                                                                                                                                                                                                                                                       | Physical dependency of root gaxios 6.7.1. No caller-controlled vulnerable UUID buffer operation was demonstrated.                                                                                                                                              |
| `node_modules/rimraf/node_modules/glob` **10.5.0**            | Moderate, [GHSA-3g3m-2fjr-6pw4](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4), affected `>=9.0.0 <=14.0.1`, patched 14.0.2; also inherits minimatch's finding.                                                                                                                                                                                                                                                                        | Present through rimraf 5.0.10. No AbortSignal cancellation or attacker-controlled filesystem traversal was tested.                                                                                                                                             |
| `node_modules/rimraf/node_modules/minimatch` **9.0.9**        | Moderate, [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249), audit affected range `<11.0.1`, patched 11.0.1.                                                                                                                                                                                                                                                                                                        | The primary advisory describes pattern amplification at optimization level >=2 and discusses 10.2.6. The scanner's broader affected range includes installed 9.0.9; version-specific behavior and application reachability were not independently established. |

The three newly encountered advisory records for follow-redirects, glob and minimatch were checked against the linked primary GHSA pages. During the initial audit pass, published patch boundaries were recorded as advisory metadata only and this worker applied no package changes. The parent has since verified GHSA/npm metadata and selected follow-redirects 1.16.2 for the authorized override/lock update. Its physical inclusion and advisory outcome require the rebuilt-image check; moderate dependency fixes are outside this batch.

### Dependency-only audit entries

These five entries have no advisory objects of their own in this report. They are physically present packages whose audit status propagates through the named dependencies; they are not five additional underlying vulnerabilities.

| Physical package path and version                                                                  | Audit rollup                                                  | Exact distinction                                                                                                 |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `node_modules/@nestjs/swagger` **11.4.7**                                                          | Moderate via js-yaml                                          | Same nested YAML advisory. npm proposes Swagger 12.0.5 as a semver-major fix; this is not compatibility approval. |
| `node_modules/gaxios` **6.7.1**                                                                    | Moderate package entry lists rimraf and uuid across its paths | This copy declares uuid `^9.0.1`; it does not declare rimraf.                                                     |
| `node_modules/@google-cloud/firestore-api/node_modules/gcp-metadata/node_modules/gaxios` **7.1.3** | Same moderate gaxios entry                                    | This copy declares rimraf `^5.0.1`; it does not declare uuid. Two physical paths are grouped in one audit entry.  |
| `node_modules/@google-cloud/firestore-api/node_modules/gcp-metadata` **8.1.4**                     | Moderate via gaxios                                           | Declares gaxios exactly 7.1.3. Root gcp-metadata 9.0.4 is a separate physical copy and is not this audit path.    |
| `node_modules/@google-cloud/firestore-api/node_modules/google-gax` **5.0.8**                       | Moderate via rimraf                                           | Declares rimraf `^5.0.1`. Root google-gax 6.7.0 is a different copy and is not this audit path.                   |
| `node_modules/rimraf` **5.0.10**                                                                   | Moderate via glob                                             | Declares glob `^10.3.7`, resolved physically to the nested 10.5.0 copy above.                                     |

Other physically present gaxios copies at `node_modules/@google-cloud/firestore-api/node_modules/gaxios`, `node_modules/gcp-metadata/node_modules/gaxios`, `node_modules/google-auth-library/node_modules/gaxios` and `node_modules/gtoken/node_modules/gaxios` are **7.3.1**; none is listed as an affected path in this audit. That does not certify them free of every vulnerability.

Audit dependency metadata is `prod: 217`, `dev: 0`, `optional: 154`, `peer: 35`, `peerOptional: 0`, `total: 370`. These classifications are metadata, not independent physical package counts, and `--omit=peer` does not imply the peer metadata field must be zero. Unlike the historical Prisma discrepancy, this current report's 12 affected paths all have physical manifests. npm reports fixes available, but this pass neither ran `npm audit fix` nor established the safety of any suggested upgrade.

### Historical handoff before rebuild

Image `674c2d6194fe` had the high follow-redirects finding and moderate chains above at audit time. The parent is applying the follow-redirects 1.16.2 override and lock update under existing P6 authorization, will rebuild the image, and will request a new isolated audit when ready. The next check must record the rebuilt image ID, verify the physical follow-redirects version and all reported advisory paths, and capture fresh audit totals. Do not infer a post-patch pass or subtract one finding from the historical total. No further moderate dependency fixes are planned in this batch. This worker has not rerun the audit during the parent-owned change.

Parent-reported regression status at this handoff: root regression checks have passed except the Windows Node 24 restart run, which crashed the OS; an ephemeral Node 22 retry is being attempted and has no recorded result yet. Following time-only test-fixture corrections, organization booking passed **20/20**, Members **75/75**, and Notifications **18/18**. These are parent-reported results, not reruns by this documentation worker or evidence that the future rebuilt image has passed. P5 remains paused; no P5 features were developed.

The saved Linux FD benchmark is documented in [quality-performance-baseline.md](quality-performance-baseline.md). Dependency presence, advisory range matching, source inference and demonstrated exploitation remain separate evidence categories; this audit pass performed only the first two.
