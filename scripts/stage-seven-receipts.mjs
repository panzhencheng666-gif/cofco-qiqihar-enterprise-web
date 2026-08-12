import { createHash, createPublicKey, verify } from "node:crypto";

const sha256Pattern = /^[a-f0-9]{64}$/u;
const uuidPattern =
  /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u;

export function canonicalJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function canonicalSha256(value) {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function sameJson(left, right) {
  return canonicalJson(left) === canonicalJson(right);
}

export function receiptAuthorityFromManifest(manifest, expectedSha256) {
  const authority = manifest?.receiptAuthority;
  if (
    authority?.algorithm !== "ED25519" ||
    typeof authority.keyId !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/u.test(authority.keyId) ||
    typeof authority.publicKeySpkiDerBase64 !== "string" ||
    !sha256Pattern.test(expectedSha256 ?? "")
  ) {
    throw new Error("candidate manifest lacks a trusted receipt authority");
  }
  const publicKeyDer = Buffer.from(authority.publicKeySpkiDerBase64, "base64");
  if (
    publicKeyDer.length === 0 ||
    publicKeyDer.toString("base64") !== authority.publicKeySpkiDerBase64 ||
    createHash("sha256").update(publicKeyDer).digest("hex") !== expectedSha256
  ) {
    throw new Error("candidate manifest receipt authority is not approved");
  }
  const publicKey = createPublicKey({
    key: publicKeyDer,
    format: "der",
    type: "spki",
  });
  if (publicKey.asymmetricKeyType !== "ed25519") {
    throw new Error("candidate manifest receipt authority is not ED25519");
  }
  return { authority: structuredClone(authority), publicKey };
}

export function createPhaseReceiptRequest({
  runId,
  phase,
  nonce,
  candidates,
  profileSha256,
  manifestSha256,
  artifactSetSha256,
  approvalEvidence,
  target,
}) {
  return {
    schemaVersion: "cofco-stage7-phase-request-v2",
    runId,
    nonce,
    phase: structuredClone(phase),
    candidates: structuredClone(candidates),
    profileSha256,
    manifestSha256,
    artifactSetSha256,
    approvalEvidence: structuredClone(approvalEvidence),
    target: structuredClone(target),
  };
}

export function verifyPhaseExecutionReceipt({
  code,
  runId,
  request,
  result,
  executionReceipt,
  candidates,
  profileSha256,
  manifestSha256,
  artifactSetSha256,
  approvalEvidence,
  target,
  publicKey,
  seenReceiptIds,
  seenRequestNonces,
}) {
  const payload = executionReceipt?.payload;
  const signatureBase64 = executionReceipt?.signatureBase64;
  if (
    request?.schemaVersion !== "cofco-stage7-phase-request-v2" ||
    typeof runId !== "string" ||
    runId.trim() === "" ||
    request.runId !== runId ||
    request.phase?.code !== code ||
    !uuidPattern.test(request.nonce ?? "") ||
    !sameJson(request.candidates, candidates) ||
    request.profileSha256 !== profileSha256 ||
    request.manifestSha256 !== manifestSha256 ||
    request.artifactSetSha256 !== artifactSetSha256 ||
    !sameJson(request.approvalEvidence, approvalEvidence) ||
    !sameJson(request.target, target) ||
    payload?.schemaVersion !== "cofco-stage7-phase-receipt-v2" ||
    payload.phaseCode !== code ||
    !uuidPattern.test(payload.receiptId ?? "") ||
    payload.requestNonce !== request.nonce ||
    payload.requestSha256 !== canonicalSha256(request) ||
    payload.resultSha256 !== canonicalSha256(result) ||
    !sameJson(payload.candidates, candidates) ||
    payload.profileSha256 !== profileSha256 ||
    payload.manifestSha256 !== manifestSha256 ||
    payload.artifactSetSha256 !== artifactSetSha256 ||
    typeof signatureBase64 !== "string"
  ) {
    throw new Error(`${code} lacks a trusted and verifiable execution receipt`);
  }
  if (
    seenReceiptIds.has(payload.receiptId) ||
    seenRequestNonces.has(request.nonce)
  ) {
    throw new Error("Stage 7 execution receipts must be unique across phases");
  }
  let signature;
  try {
    signature = Buffer.from(signatureBase64, "base64");
  } catch {
    throw new Error(`${code} execution receipt signature is invalid`);
  }
  if (
    signature.length !== 64 ||
    signature.toString("base64") !== signatureBase64 ||
    !verify(null, Buffer.from(canonicalJson(payload)), publicKey, signature)
  ) {
    throw new Error(`${code} execution receipt signature is invalid`);
  }
  seenReceiptIds.add(payload.receiptId);
  seenRequestNonces.add(request.nonce);
  return {
    code,
    request: structuredClone(request),
    result: structuredClone(result),
    executionReceipt: structuredClone(executionReceipt),
  };
}

export function verifyReplayReceiptBundle(run) {
  const replay = run?.replay;
  if (
    replay?.schemaVersion !== "cofco-stage7-preproduction-replay-v2" ||
    !replay.candidateManifest ||
    !Array.isArray(replay.phaseReceipts) ||
    !replay.target ||
    !sameJson(replay.candidateManifest?.candidates, run.candidates) ||
    replay.candidateManifest?.profileSha256 !== run.profileSha256 ||
    !sameJson(replay.candidateManifest?.artifacts, run.admission?.artifacts)
  ) {
    throw new Error(
      "Stage 7 preproduction evidence lacks a verified replay bundle",
    );
  }
  const manifestSha256 = canonicalSha256(replay.candidateManifest);
  const artifactSetSha256 = canonicalSha256(run.admission.artifacts);
  const expectedTarget = {
    baseUrl: run.admission.baseUrl,
    candidateManifestUrl: new URL(
      run.admission.topology.candidateManifestPath,
      run.admission.baseUrl,
    ).href,
    rdsResourceId: run.admission.topology.rdsResourceId,
    ossBucket: run.admission.topology.ossBucket,
    ossEndpoint: run.admission.topology.ossEndpoint,
    workloadControlEndpoint: run.admission.topology.workloadControlEndpoint,
    monitoringEndpoint: run.admission.topology.monitoringEndpoint,
    faultControlEndpoint: run.admission.topology.faultControlEndpoint,
  };
  if (
    replay.manifestSha256 !== manifestSha256 ||
    replay.artifactSetSha256 !== artifactSetSha256 ||
    !sameJson(replay.target, expectedTarget)
  ) {
    throw new Error("Stage 7 candidate manifest binding is invalid");
  }
  const { publicKey } = receiptAuthorityFromManifest(
    replay.candidateManifest,
    run.admission.receiptAuthorityPublicKeySha256,
  );
  const expectedCodes = [
    "load",
    "correctness",
    "database",
    "faults",
    "resource-sampling",
  ];
  if (
    !sameJson(
      replay.phaseReceipts.map(({ code }) => code),
      expectedCodes,
    )
  ) {
    throw new Error("Stage 7 preproduction receipt phase order is invalid");
  }
  const seenReceiptIds = new Set();
  const seenRequestNonces = new Set();
  const scenarios = [];
  let resourceTrend;
  for (const receipt of replay.phaseReceipts) {
    verifyPhaseExecutionReceipt({
      ...receipt,
      runId: run.runId,
      candidates: run.candidates,
      profileSha256: run.profileSha256,
      manifestSha256,
      artifactSetSha256,
      approvalEvidence: run.admission.approvalEvidence,
      target: expectedTarget,
      publicKey,
      seenReceiptIds,
      seenRequestNonces,
    });
    const expectedScenarioCodes = receipt.request.phase.expectedScenarioCodes;
    const actualScenarioCodes = receipt.result.scenarios?.map(
      ({ code }) => code,
    );
    if (
      !Array.isArray(expectedScenarioCodes) ||
      !Array.isArray(actualScenarioCodes) ||
      !sameJson(
        [...expectedScenarioCodes].sort(),
        [...actualScenarioCodes].sort(),
      )
    ) {
      throw new Error(`${receipt.code} receipt scenario binding is invalid`);
    }
    scenarios.push(...receipt.result.scenarios);
    if (receipt.code === "resource-sampling") {
      resourceTrend = receipt.result.resourceTrend;
    }
  }
  if (
    !sameJson(scenarios, run.scenarios) ||
    !sameJson(resourceTrend, run.resourceTrend)
  ) {
    throw new Error("Stage 7 replay results drifted from verified receipts");
  }
  return true;
}
