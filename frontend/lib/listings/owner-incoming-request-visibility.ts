import { createClient } from "@/lib/supabase/server";
import type { ListingRequestStatus } from "@/lib/listings/listing-details-types";

type OwnerIncomingRequestVisibilityInput = {
  status: ListingRequestStatus;
  seekerBlockedMe: boolean;
  iBlockedSeeker: boolean;
};

type VisibleIncomingRequestCountRow = {
  listing_id: string | null;
  initiator_id: string | null;
  status: string | null;
};

function isListingRequestStatus(value: string | null): value is ListingRequestStatus {
  return value === "pending" || value === "accepted" || value === "rejected";
}

export function isOwnerIncomingRequestVisible({
  status,
  seekerBlockedMe,
  iBlockedSeeker,
}: OwnerIncomingRequestVisibilityInput): boolean {
  return !(seekerBlockedMe && !iBlockedSeeker && status !== "accepted");
}

export async function loadVisibleIncomingRequestCountsByListingId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ownerId: string,
  listingIds: string[],
): Promise<Map<string, number> | null> {
  const uniqueListingIds = [...new Set(listingIds)].filter((id) => id.length > 0);
  const countsByListingId = new Map<string, number>();

  for (const listingId of uniqueListingIds) {
    countsByListingId.set(listingId, 0);
  }

  if (uniqueListingIds.length === 0) {
    return countsByListingId;
  }

  const [requestsRes, myBlocksRes, blockedMeRes] = await Promise.all([
    supabase
      .from("listing_requests")
      .select("listing_id, initiator_id, status")
      .in("listing_id", uniqueListingIds),
    supabase.from("user_blocks").select("blocked_id").eq("blocker_id", ownerId),
    supabase.from("user_blocks").select("blocker_id").eq("blocked_id", ownerId),
  ]);

  if (requestsRes.error || myBlocksRes.error || blockedMeRes.error) {
    return null;
  }

  const iBlockedSeekerIds = new Set(
    (myBlocksRes.data ?? [])
      .map((row) => row.blocked_id)
      .filter((id): id is string => typeof id === "string" && id.length > 0),
  );
  const seekerIdsWhoBlockedMe = new Set(
    (blockedMeRes.data ?? [])
      .map((row) => row.blocker_id)
      .filter((id): id is string => typeof id === "string" && id.length > 0),
  );

  for (const row of (requestsRes.data ?? []) as VisibleIncomingRequestCountRow[]) {
    const listingId = typeof row.listing_id === "string" ? row.listing_id : "";
    const seekerId = typeof row.initiator_id === "string" ? row.initiator_id : "";
    const status = row.status;

    if (!listingId || !seekerId || !isListingRequestStatus(status)) {
      continue;
    }

    const seekerBlockedMe = seekerIdsWhoBlockedMe.has(seekerId);
    const iBlockedSeeker = iBlockedSeekerIds.has(seekerId);

    if (!isOwnerIncomingRequestVisible({ status, seekerBlockedMe, iBlockedSeeker })) {
      continue;
    }

    countsByListingId.set(listingId, (countsByListingId.get(listingId) ?? 0) + 1);
  }

  return countsByListingId;
}
