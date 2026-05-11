export function extractListingIncomingRequestsCount(row: {
  listing_requests?: { count?: number }[] | null | undefined;
}): number {
  const arr = row.listing_requests;
  if (!Array.isArray(arr) || arr.length === 0) {
    return 0;
  }
  const n = arr[0]?.count;
  return typeof n === "number" && Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}

export function formatMyListingRequestsButtonLabel(count: number): string {
  const display = count > 99 ? "99+" : String(count);
  return `Заявки (${display})`;
}
