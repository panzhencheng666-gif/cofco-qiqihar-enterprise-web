import { performance } from "node:perf_hooks";

function scaledConcurrency(value, scale) {
  return Math.max(1, Math.ceil(value * scale));
}

function scaledDuration(value, local) {
  return Math.max(
    local.minimumDurationSeconds,
    Math.min(
      local.maximumDurationSeconds,
      Math.ceil(value * local.durationScale),
    ),
  );
}

export function scaleProfiles(profile) {
  const local = profile?.localProportional;
  if (
    !local ||
    !Array.isArray(profile.profiles) ||
    !Number.isFinite(local.concurrencyScale) ||
    !Number.isFinite(local.durationScale)
  ) {
    throw new Error("Invalid local proportional profile");
  }
  return profile.profiles.flatMap((item) => {
    if (Array.isArray(item.concurrencySteps)) {
      return item.concurrencySteps.map((concurrency) => ({
        code: `${item.code}-${concurrency}`,
        concurrency: scaledConcurrency(concurrency, local.concurrencyScale),
        durationSeconds: scaledDuration(item.durationSecondsPerStep, local),
      }));
    }
    return [
      {
        code: item.code,
        concurrency: scaledConcurrency(
          item.concurrency,
          local.concurrencyScale,
        ),
        durationSeconds: scaledDuration(item.durationSeconds, local),
      },
    ];
  });
}

export function buildWeightedSchedule(workloads, length = 100) {
  if (
    !Array.isArray(workloads) ||
    workloads.length === 0 ||
    !Number.isInteger(length) ||
    length < 1 ||
    workloads.some(
      ({ code, weight }) => !code || !Number.isFinite(weight) || weight <= 0,
    )
  ) {
    throw new Error("Invalid weighted schedule input");
  }
  const totalWeight = workloads.reduce((sum, { weight }) => sum + weight, 0);
  const allocation = workloads.map((workload, index) => {
    const exact = (workload.weight * length) / totalWeight;
    return {
      ...workload,
      index,
      count: Math.floor(exact),
      remainder: exact - Math.floor(exact),
    };
  });
  let remaining =
    length - allocation.reduce((sum, { count }) => sum + count, 0);
  for (const item of [...allocation].sort(
    (left, right) =>
      right.remainder - left.remainder || left.index - right.index,
  )) {
    if (remaining === 0) break;
    item.count += 1;
    remaining -= 1;
  }
  const schedule = [];
  const emitted = new Map(allocation.map(({ code }) => [code, 0]));
  while (schedule.length < length) {
    let selected;
    let selectedDebt = -Infinity;
    for (const item of allocation) {
      const already = emitted.get(item.code);
      if (already >= item.count) continue;
      const debt = ((schedule.length + 1) * item.count) / length - already;
      if (debt > selectedDebt) {
        selected = item;
        selectedDebt = debt;
      }
    }
    schedule.push(selected.code);
    emitted.set(selected.code, emitted.get(selected.code) + 1);
  }
  return schedule;
}

export async function runHttpLoad({
  baseUrl,
  concurrency,
  iterations,
  schedule,
  requestFor,
}) {
  if (
    !baseUrl ||
    !Number.isInteger(concurrency) ||
    concurrency < 1 ||
    !Number.isInteger(iterations) ||
    iterations < 1 ||
    !Array.isArray(schedule) ||
    schedule.length === 0 ||
    typeof requestFor !== "function"
  ) {
    throw new Error("Invalid HTTP load input");
  }
  let next = 0;
  const latenciesMs = [];
  let unexpectedErrors = 0;
  const byWorkload = Object.fromEntries(
    [...new Set(schedule)].map((code) => [
      code,
      { attempts: 0, unexpectedErrors: 0 },
    ]),
  );
  async function worker() {
    while (true) {
      const index = next;
      next += 1;
      if (index >= iterations) return;
      const code = schedule[index % schedule.length];
      const request = await requestFor(code, index);
      const startedAt = performance.now();
      let failed;
      try {
        const response = await fetch(
          new URL(request.path, baseUrl),
          request.options,
        );
        const accepted =
          request.acceptStatus ?? ((status) => status >= 200 && status < 400);
        failed = !accepted(response.status);
        await response.arrayBuffer();
      } catch {
        failed = true;
      }
      latenciesMs.push(Math.max(0, performance.now() - startedAt));
      byWorkload[code].attempts += 1;
      if (failed) {
        unexpectedErrors += 1;
        byWorkload[code].unexpectedErrors += 1;
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, iterations) }, worker),
  );
  return { attempts: iterations, unexpectedErrors, latenciesMs, byWorkload };
}
