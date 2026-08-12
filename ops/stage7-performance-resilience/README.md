# Stage 7A performance and resilience entry points

Stage 7 has two evidence boundaries:

- `npm run stage7:performance:local -- --output <new-directory>` runs the isolated local proportional replay. Before creating its database or starting Backend, it builds the exact clean Backend commit declared in the immutable profile with JDK 21 and the fixed Maven command. The run binds that source commit, build environment, JAR manifest, size, and SHA-256. Its evidence is always `LOCAL_PROPORTIONAL_ONLY`, `productionEquivalent=false`, and blocked by `EXT-005`.
- `npm run stage7:performance:replay -- --output <new-directory>` is the production-equivalent preproduction replay entry. The output can alternatively be supplied as `outputDirectory` in the admission file. It cannot start until the checked-in blank admission template has been replaced by approved, non-secret EXT-005 inputs.

Use `npm run stage7:performance:admit` for admission only and `npm run stage7:performance:replay-plan` to inspect the bound orchestration without contacting a target. The checked-in blank template must exit `2` with exactly `BLOCKED_EXTERNAL(EXT-005): approved HTTPS base URL is missing`.

Each evidence directory is published as one five-file bundle from a single immutable run model. Verify it with `npm run stage7:performance:evidence:verify -- --evidence <directory>`; the command regenerates all four Markdown files from `run.json` and rejects any byte-level drift.

## Production-equivalent replay contract

Admission binds the exact Backend, Frontend, and Web 40-character commits; Stage 7 profile SHA-256; three approval evidence SHA-256 values; the approved Ed25519 receipt-authority public-key SHA-256; Alibaba Cloud region and topology identifiers; private regional OSS endpoint; seven immutable ACR image digests; and approved HTTPS application, workload-control, fault-control, monitoring, and candidate-manifest endpoints. The receipt-authority digest must also equal the trust pin in the immutable Stage 7 profile, so an admission caller cannot authorize a self-generated key merely by filling in a matching digest. That pin remains `null` until EXT-005 supplies and independently approves the authority; the blank standard entry still stops first with the single approved-base-URL blocker. Secrets and credentials are never accepted in the admission file or evidence.

After admission, the replay entry reads the candidate manifest and fails before load if commits, the profile digest, or image digests differ. It then calls these phases at standard speed:

1. authoritative load profiles and page probe through the workload-control endpoint;
2. independent correctness scenarios through the workload-control endpoint;
3. database scenarios through the workload-control endpoint;
4. approved fault scenarios through the fault-control endpoint;
5. resource sampling through the monitoring endpoint;
6. five-file evidence rendering.

For every phase, the runner creates a unique request nonce and canonical request binding. The trusted local orchestration adapter or approved HTTPS control plane must return a uniquely identified Ed25519-signed receipt envelope binding the phase identity, canonical request and result digests, candidate commits, profile digest, candidate-manifest digest, and immutable image-set digest. Arbitrary hex, blank, reused, cross-phase, or modified receipts fail closed. The final evidence renderer independently verifies the complete signed replay bundle; callers cannot self-assert a digest and obtain `PREPRODUCTION_EQUIVALENT`. Supplying the external inputs only reaches admission readiness; an approved real replay is still required to close EXT-005.

This entry does not run Terraform, deploy services, access SSH, call KMS/RDS administration APIs, or operate Docker. The final 24-hour gate and Stage 8 are excluded.
