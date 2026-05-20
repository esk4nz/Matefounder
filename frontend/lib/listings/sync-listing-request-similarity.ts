import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

const LOG_PREFIX = "[listing_request_similarity]";

function logSimilaritySyncError(context: string, error: unknown) {
  console.error(`${LOG_PREFIX} ${context}`, error);
}

async function applyRecalculatedScores(
  admin: SupabaseClient,
  rows: readonly { id: string; listing_id: string; initiator_id: string }[],
): Promise<void> {
  for (const row of rows) {
    try {
      const { data: scoreRaw, error: rpcError } = await admin.rpc(
        "recalculate_listing_request_similarity_service",
        {
          p_listing_id: row.listing_id,
          p_initiator_id: row.initiator_id,
        },
      );
      if (rpcError) {
        logSimilaritySyncError(`rpc row=${row.id}`, rpcError);
        continue;
      }
      const score = typeof scoreRaw === "number" ? scoreRaw : Number(scoreRaw);
      const similarityScore = Number.isFinite(score) ? score : 0;
      const { error: updateError } = await admin
        .from("listing_requests")
        .update({ similarity_score: similarityScore })
        .eq("id", row.id);
      if (updateError) {
        logSimilaritySyncError(`update row=${row.id}`, updateError);
      }
    } catch (e) {
      logSimilaritySyncError(`row=${row.id}`, e);
    }
  }
}

export async function refreshSimilarityScoresAfterProfileEmbeddingChange(
  profileUserId: string,
): Promise<void> {
  let admin: ReturnType<typeof createServiceRoleClient>;
  try {
    admin = createServiceRoleClient();
  } catch (e) {
    logSimilaritySyncError("service_role_unavailable", e);
    return;
  }

  try {
    const [asInitiatorRes, ownedListingsRes] = await Promise.all([
      admin.from("listing_requests").select("id, listing_id, initiator_id").eq("initiator_id", profileUserId),
      admin.from("listings").select("id").eq("creator_id", profileUserId),
    ]);

    if (asInitiatorRes.error) {
      logSimilaritySyncError("fetch_as_initiator", asInitiatorRes.error);
    }
    if (ownedListingsRes.error) {
      logSimilaritySyncError("fetch_owned_listings", ownedListingsRes.error);
    }

    const listingIds = (ownedListingsRes.data ?? [])
      .map((r) => r.id)
      .filter((id): id is string => typeof id === "string" && id.length > 0);

    let ownerRows: { id: string; listing_id: string; initiator_id: string }[] = [];
    if (listingIds.length > 0) {
      const asOwner = await admin
        .from("listing_requests")
        .select("id, listing_id, initiator_id")
        .in("listing_id", listingIds);
      if (asOwner.error) {
        logSimilaritySyncError("fetch_as_listing_owner", asOwner.error);
      } else {
        ownerRows = (asOwner.data ?? []).filter(
          (row): row is { id: string; listing_id: string; initiator_id: string } =>
            typeof row.id === "string" &&
            typeof row.listing_id === "string" &&
            typeof row.initiator_id === "string",
        );
      }
    }

    const byId = new Map<string, { id: string; listing_id: string; initiator_id: string }>();
    for (const row of asInitiatorRes.data ?? []) {
      if (
        typeof row.id === "string" &&
        typeof row.listing_id === "string" &&
        typeof row.initiator_id === "string"
      ) {
        byId.set(row.id, { id: row.id, listing_id: row.listing_id, initiator_id: row.initiator_id });
      }
    }
    for (const row of ownerRows) {
      byId.set(row.id, row);
    }

    await applyRecalculatedScores(admin, [...byId.values()]);
  } catch (e) {
    logSimilaritySyncError("refreshSimilarityScoresAfterProfileEmbeddingChange", e);
  }
}

export async function refreshSimilarityScoresForSeekerRequests(
  seekerUserId: string,
): Promise<void> {
  let admin: ReturnType<typeof createServiceRoleClient>;
  try {
    admin = createServiceRoleClient();
  } catch (e) {
    logSimilaritySyncError("service_role_unavailable", e);
    return;
  }

  try {
    const { data, error } = await admin
      .from("listing_requests")
      .select("id, listing_id, initiator_id")
      .eq("initiator_id", seekerUserId);
    if (error) {
      logSimilaritySyncError(`fetch initiator_id=${seekerUserId}`, error);
      return;
    }
    const rows = (data ?? []).filter(
      (row): row is { id: string; listing_id: string; initiator_id: string } =>
        typeof row.id === "string" &&
        typeof row.listing_id === "string" &&
        typeof row.initiator_id === "string",
    );
    await applyRecalculatedScores(admin, rows);
  } catch (e) {
    logSimilaritySyncError(`refreshSimilarityScoresForSeekerRequests initiator_id=${seekerUserId}`, e);
  }
}

export async function refreshSimilarityScoresForListingRequests(listingId: string): Promise<void> {
  let admin: ReturnType<typeof createServiceRoleClient>;
  try {
    admin = createServiceRoleClient();
  } catch (e) {
    logSimilaritySyncError("service_role_unavailable", e);
    return;
  }

  try {
    const { data, error } = await admin
      .from("listing_requests")
      .select("id, listing_id, initiator_id")
      .eq("listing_id", listingId);
    if (error) {
      logSimilaritySyncError(`fetch listing_id=${listingId}`, error);
      return;
    }
    const rows = (data ?? []).filter(
      (row): row is { id: string; listing_id: string; initiator_id: string } =>
        typeof row.id === "string" &&
        typeof row.listing_id === "string" &&
        typeof row.initiator_id === "string",
    );
    await applyRecalculatedScores(admin, rows);
  } catch (e) {
    logSimilaritySyncError(`refreshSimilarityScoresForListingRequests listing_id=${listingId}`, e);
  }
}
