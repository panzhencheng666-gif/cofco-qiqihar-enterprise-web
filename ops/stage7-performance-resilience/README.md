# Stage 7A performance and resilience entry points

Stage 7 has two evidence boundaries:

- `npm run stage7:performance:local -- --output <new-directory>` runs the isolated local proportional replay. Its evidence is always `LOCAL_PROPORTIONAL_ONLY`, `productionEquivalent=false`, and blocked by `EXT-005`.
- `npm run stage7:performance:replay -- --output <new-directory>` is the production-equivalent preproduction replay entry. The output can alternatively be supplied as `outputDirectory` in the admission file. It cannot start until the checked-in blank admission template has been replaced by approved, non-secret EXT-005 inputs.

Use `npm run stage7:performance:admit` for admission only and `npm run stage7:performance:replay-plan` to inspect the bound orchestration without contacting a target. The checked-in blank template must exit `2` with exactly `BLOCKED_EXTERNAL(EXT-005): approved HTTPS base URL is missing`.

## Production-equivalent replay contract

Admission binds the exact Backend, Frontend, and Web 40-character commits; Stage 7 profile SHA-256; three approval evidence SHA-256 values; Alibaba Cloud region and topology identifiers; private regional OSS endpoint; seven immutable ACR image digests; and approved HTTPS application, workload-control, fault-control, monitoring, and candidate-manifest endpoints. Secrets and credentials are never accepted in the admission file or evidence.

After admission, the replay entry reads the candidate manifest and fails before load if commits, the profile digest, or image digests differ. It then calls these phases at standard speed:

1. authoritative load profiles and page probe through the workload-control endpoint;
2. independent correctness scenarios through the workload-control endpoint;
3. database scenarios through the workload-control endpoint;
4. approved fault scenarios through the fault-control endpoint;
5. resource sampling through the monitoring endpoint;
6. five-file evidence rendering.

Every phase response must repeat the admitted candidate commits and profile digest, include exactly the expected scenario codes, and carry a non-secret SHA-256 execution receipt. Only a complete set of bound receipts can render `PREPRODUCTION_EQUIVALENT` evidence. Supplying the external inputs only reaches admission readiness; an approved real replay is still required to close EXT-005.

This entry does not run Terraform, deploy services, access SSH, call KMS/RDS administration APIs, or operate Docker. The final 24-hour gate and Stage 8 are excluded.
