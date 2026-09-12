import type { RealtimeBusinessRepository } from "@/platform/api/realtimeBusinessRepository";
export function taskRepository(
  repository: RealtimeBusinessRepository,
): RealtimeBusinessRepository {
  return new Proxy(repository, {
    get(target, key, receiver) {
      const value: unknown = Reflect.get(target, key, receiver);
      if (
        [
          "listEligibleFormalSamples",
          "listProduction",
          "listMarket",
          "listLogistics",
        ].includes(String(key)) &&
        typeof value === "function"
      ) {
        const scopedMethod = value as (input: object) => unknown;
        return (input: object) =>
          scopedMethod.call(target, { ...input, scope: "MY_TASKS" });
      }
      return typeof value === "function"
        ? (value as (...args: unknown[]) => unknown).bind(target)
        : value;
    },
  });
}
