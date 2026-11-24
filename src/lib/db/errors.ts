// Whether a query failed because the value is already taken. Drizzle wraps
// the database's error, so its code is on the cause.
export function isUniqueViolation(error: unknown): boolean {
  const cause = error instanceof Error ? error.cause : undefined;
  return [error, cause].some((e) => (e as { code?: unknown } | undefined)?.code === "23505");
}
