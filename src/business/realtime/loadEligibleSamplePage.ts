import type { RealtimeBusinessRepository } from "@/platform/api/realtimeBusinessRepository";

export async function loadEligibleSamplePage(
  repository: RealtimeBusinessRepository,
  input: Parameters<
    NonNullable<RealtimeBusinessRepository["listEligibleFormalSamples"]>
  >[0],
  pageNumber: number,
  pageSize: number,
) {
  if (repository.listEligibleFormalSamplesPage) {
    return repository.listEligibleFormalSamplesPage({
      ...input,
      pageNumber,
      pageSize,
    });
  }
  // Compatibility for offline repositories; the production adapter always pages on the server.
  const samples = await repository.listEligibleFormalSamples!(input);
  return {
    items: samples.slice(pageNumber * pageSize, (pageNumber + 1) * pageSize),
    pageNumber,
    pageSize,
    totalElements: samples.length,
    totalPages: Math.ceil(samples.length / pageSize),
  };
}
