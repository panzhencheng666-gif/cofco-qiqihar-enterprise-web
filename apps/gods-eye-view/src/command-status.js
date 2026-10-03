export function commandExitCode(result) {
  if (
    result.error ||
    result.signal ||
    !Number.isInteger(result.status) ||
    result.status < 0
  )
    return 1;
  return result.status;
}
