export const LISTING_MY_LISTINGS_FLASH_STORAGE_KEY = "matefounder.myListings.flash";

export const LISTING_FLASH_CODE = {
  listingNotFound: "listing_not_found",
} as const;

export type ListingFlashCode = (typeof LISTING_FLASH_CODE)[keyof typeof LISTING_FLASH_CODE];

const LISTING_FLASH_MESSAGE_UA: Record<ListingFlashCode, string> = {
  listing_not_found: "Цю анкету було видалено. Список оновлено.",
};

export function getListingMyListingsFlashMessage(code: string): string | null {
  if (Object.prototype.hasOwnProperty.call(LISTING_FLASH_MESSAGE_UA, code)) {
    return LISTING_FLASH_MESSAGE_UA[code as ListingFlashCode];
  }
  return null;
}

export type UpdateMyListingActionState =
  | { ok: true }
  | { ok: false; reason: typeof LISTING_FLASH_CODE.listingNotFound }
  | { ok: false; message: string };
