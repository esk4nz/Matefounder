const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "h",
  ґ: "g",
  д: "d",
  е: "e",
  є: "ye",
  ж: "zh",
  з: "z",
  и: "y",
  і: "i",
  ї: "yi",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "kh",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "shch",
  ь: "",
  ю: "yu",
  я: "ya",
};

function transliterateChar(ch: string): string {
  const lower = ch.toLowerCase();
  if (CYRILLIC_TO_LATIN[lower] !== undefined) {
    return CYRILLIC_TO_LATIN[lower];
  }
  if (/[a-zA-Z]/.test(ch)) {
    return ch.toLowerCase();
  }
  if (/[0-9]/.test(ch)) {
    return ch;
  }
  return "";
}

/** Готує базовий slug int_* з української назви (унікальність перевіряється окремо). */
export function buildInterestSlugFromLabel(labelUk: string): string {
  const stripped = labelUk
    .trim()
    .replace(/[^\p{L}\p{N}\s\-_.]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  let out = "";
  for (const ch of stripped) {
    if (ch === " " || ch === "-" || ch === "_") {
      out += "_";
      continue;
    }
    out += transliterateChar(ch);
  }

  let collapsed = out
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .toLowerCase();

  if (!collapsed) {
    collapsed = "tag";
  }

  return `int_${collapsed}`;
}

export function normalizeManualInterestSlug(raw: string): string {
  const t = raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");

  if (!t) {
    return "";
  }

  return t.startsWith("int_") ? t : `int_${t}`;
}
