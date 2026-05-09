export const LISTING_TAG_DISPLAY_LABELS: Record<string, string> = {
  smoke_no: "🚭 Не палить",
  smoke_yes: "🚬 Палить",
  smoke_sometimes: "💨 Палить інколи",

  pets_ok: "🐾 Не проти тварин",
  pets_no: "🚫 Без тварин",
  has_pet: "🐕 Власник тварини",

  guests_none: "🛑 Без гостей (тиша)",
  guests_rare: "☕ Гості іноді",
  guests_party: "🎉 Любить компанію",
};

export function getListingTagDisplayLabel(slug: string, labelUk: string): string {
  return LISTING_TAG_DISPLAY_LABELS[slug] ?? labelUk;
}
