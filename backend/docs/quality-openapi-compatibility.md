# OpenAPI contract comparison

`backend/scripts/check-openapi-compatibility.cjs` is a standalone, standard-library-only Node CLI. It reads two saved OpenAPI JSON documents and reports potential changes to existing contracts. It does not load the application, contact a server, resolve network references, use credentials or install dependencies.

From the repository root:

```powershell
node backend/scripts/check-openapi-compatibility.cjs BEFORE_JSON AFTER_JSON
node backend/scripts/check-openapi-compatibility.cjs --self-test
```

The comparison is directional: **old before, new after**. The commands were verified on Windows and, subsequently, with all 23 self-tests in the Node 22 Linux builder.

## Comparison policy

P6 deployment 31/10/2026 compared the actual 312-operation runtime snapshot
with the deployed 313-operation document. No paths/operations/referenced
schemas were removed. Three parameter differences required manual review:
only the order of existing enum strings changed; their accepted values,
types, required flags, locations and defaults remained identical. The CLI
intentionally retains its conservative review result; see
[the recorded disposition](quality-openapi-review-2026-10-31.json).
The 23 CLI self-tests also passed inside the Node 22 Linux builder.

- Every old path and HTTP method (`get`, `put`, `post`, `delete`, `patch`, `head`, `options`, `trace`) must remain present. New operations are additive. Counts alone never establish compatibility.
- Existing operations compare effective parameters, request body, effective security requirements and the definitions of their selected security schemes. Path-level parameters are inherited, operation-level parameters override the same `(in, name)` pair, and parameter declaration order is ignored. Duplicate parameters within one level are rejected. Explicit operation security overrides root security, including an explicit empty array.
- Every old response entry must remain structurally unchanged after normalization, including response headers, content types and schemas. Adding a response code is allowed. `default` responses are compared and their schema references are followed.
- Local JSON Pointer `$ref` targets are followed transitively, including shared parameters, request bodies, responses, security definitions and recursive schemas. Every schema reachable from an old operation must remain present and unchanged. A reference into a schema's subfield protects the whole schema. Local discriminator mappings and bare component-schema names are followed too. Changes to unused schemas and additions of schemas are allowed.
- Object key order, parameter order, security-alternative order, security-scope order and schema `required` order are normalized. Structural `description`, `summary`, `example` and `examples` annotations are ignored. Dictionary keys are preserved: a property called `description` or `example` is still a contract field. Literal `default`, `const`, `enum`, security values and extension data are preserved; their business fields are not stripped as annotations.

Adding even an optional property to an old referenced schema, changing a `$ref` spelling, or adding a parameter to an existing operation can trigger review. Other arrays retain their order. This intentionally conservative policy is **not a semantic compatibility proof** and does not label every change as a confirmed breaking change.

The comparison scope is the operation contracts listed above. It does not compare deployment URLs/servers, document info, tags, operation IDs, runtime authorization, actual handler behavior or all OpenAPI/JSON Schema semantics. It is a focused comparison, not a complete OpenAPI validator. Unsupported external/anchor references, `$id`, `$dynamicRef` and `$recursiveRef` in compared structures are rejected rather than fetched or guessed. Unreferenced additions are not fully validated.

## Output and exit status

Exactly one JSON object is written to stdout. There are no raw diffs, payloads, security values, file contents, filenames or exception messages in the output.

| Exit | `status`          | Meaning                                                                                                                                      |
| ---- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 0    | `compatible`      | No change found within this policy.                                                                                                          |
| 1    | `review_required` | Old paths/operations/schemas are missing or compared contracts changed; human review is needed.                                              |
| 2    | `invalid_input`   | Wrong argument count, unreadable/missing/oversized file, invalid JSON/basic structure, unresolved/unsupported reference or comparison limit. |

`--self-test` emits `passed`/`failed` with a check count, exits 0/2 and suppresses assertion details. It creates temporary synthetic JSON files, invokes the actual CLI as a subprocess and removes its own temporary directory. It does not call the app or any network endpoint.

Normal reports include inventory counts, additive-operation counts, protected-schema counts, aggregate issue counts and bounded lists of operation/path/schema names. Lists stop at **40 entries per group**, names are character-filtered and truncated to **160 characters**, and `truncated` indicates omitted entries. Changed operation entries contain fixed field labels, never old/new values. Annotation content and security material never appear in the report. Route/schema identifiers are contract names, so input snapshots should use route templates rather than concrete user URLs.

Each input file is limited to 16 MiB, normalized structures to 128 nested levels, and each old operation's reachable reference graph to 4096 distinct references. UTF-8 BOMs are accepted. OpenAPI 3.0.x/3.1.x is accepted; a version change itself triggers review. Empty operation inventories are rejected to prevent an accidental empty/empty pass. An invalid after document may produce exit 2 instead of a detailed contract-change list; both prevent a false success.

## Proof and deployment check

Verified locally on Node 24.15.0/Windows:

- `node --check backend/scripts/check-openapi-compatibility.cjs` passes.
- Standalone ESLint recommended JavaScript checks pass with zero errors/warnings. The repository's TypeScript project-service lint configuration does not include `.cjs` scripts; it was not changed.
- The CLI self-test covers 23 subprocess cases: unchanged/additive documents; annotation and order changes; missing paths/methods; parameter and request-body changes; changed/removed responses; nested and recursive schema references; security inheritance/definition changes; fields named `description`/`example`; literal defaults; `default`-only schema references; shared response changes; invalid references, arguments, files and JSON. Synthetic secret/payload sentinels are checked for absence from stdout, and stderr must be empty.
- Comparing `tasks/quality-openapi-before.json` with itself passes: **271 paths, 312 operations, 101 schemas; all 101 schemas protected; zero issues**.
- The `backend/docs/openapi-baseline-2026-10-26.json` file was inspected for inventory only: **204 paths, 236 operations, 80 schemas**. It was not used as proof of current contract compatibility, and no full metadata dump was printed.

After the parent deploys the frozen image, have the parent provide a saved JSON snapshot of its deployed specification. Run once against that artifact:

```powershell
node backend/scripts/check-openapi-compatibility.cjs tasks/quality-openapi-before.json tasks/quality-openapi-after.json
```

The expected deployed inventory is **313 operations**. Verify exit 0, `inventory.after.operations === 313`, `inventory.addedOperations === 1`, and zero issue counts. The generic CLI deliberately does not hardcode 313. That post-deployment comparison is **pending** until the parent supplies the deployed snapshot; self-comparison is not deployment evidence. No app query, package change, root-plan change or commit is required.
