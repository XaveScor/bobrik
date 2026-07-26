export function formatUnexpectedError(error: unknown) {
  return error instanceof Error ? (error.stack ?? error.message) : String(error);
}
