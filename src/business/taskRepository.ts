import type { RealtimeBusinessRepository } from "@/platform/api/realtimeBusinessRepository";
export function taskRepository(
  repository: RealtimeBusinessRepository,
): RealtimeBusinessRepository {
  return new Proxy(repository, {
    get(target, key) {
      const value = Reflect.get(target, key);
      if (
        [
          "listEligibleFormalSamples",
          "listProduction",
          "listMarket",
          "listLogistics",
        ].includes(String(key)) &&
        typeof value === "function"
      ) {
        return (input: object) =>
          value.call(target, { ...input, scope: "MY_TASKS" });
      }
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}
