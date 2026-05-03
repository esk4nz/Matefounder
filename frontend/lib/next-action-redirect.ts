export function isNextRedirectFromAction(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  const digest =
    "digest" in error && typeof (error as { digest?: unknown }).digest === "string"
      ? (error as { digest: string }).digest
      : "";
  return digest.startsWith("NEXT_REDIRECT");
}
