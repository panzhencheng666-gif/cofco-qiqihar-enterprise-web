export type QueueViewState = "loading" | "error" | "empty" | "ready";

export function resolveQueueViewState({
  isLoading,
  isError,
  itemCount,
}: {
  isLoading: boolean;
  isError: boolean;
  itemCount: number;
}): QueueViewState {
  if (isLoading) return "loading";
  if (isError) return "error";
  if (itemCount === 0) return "empty";
  return "ready";
}
