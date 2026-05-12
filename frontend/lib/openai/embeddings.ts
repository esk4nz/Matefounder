const DISALLOWED_CHARS = /[^\p{Script=Cyrillic}a-zA-Z0-9.,!?'\-\s]/gu;
const WHITESPACE_RUN = /[\s\n\r\t]+/g;

export class EmptyProfileEmbeddingSourceError extends Error {
  override readonly name = "EmptyProfileEmbeddingSourceError";

  constructor() {
    super("EMPTY_PROFILE_EMBEDDING_SOURCE");
  }
}

function composeProfileEmbeddingRawText(bio: string, interestTags: string[]): string {
  const parts: string[] = [];
  const trimmedBio = bio.trim();
  if (trimmedBio) {
    parts.push(`Про мене: ${trimmedBio}.`);
  }
  const tags = interestTags.map((t) => t.trim()).filter(Boolean);
  if (tags.length > 0) {
    parts.push(`Мої інтереси: ${tags.join(", ")}.`);
  }
  return parts.join(" ");
}

export function cleanTextForEmbedding(text: string): string {
  let s = text.replaceAll("/", " / ");
  s = s.replace(DISALLOWED_CHARS, "");
  s = s.replace(WHITESPACE_RUN, " ");
  return s.trim();
}

type OpenAIEmbeddingsResponse = {
  data?: Array<{ embedding?: number[] }>;
  error?: { message?: string };
};

export async function generateProfileEmbedding(bio: string, interestTags: string[]): Promise<number[]> {
  const raw = composeProfileEmbeddingRawText(bio, interestTags);
  const cleanedText = cleanTextForEmbedding(raw);

  if (!cleanedText) {
    throw new EmptyProfileEmbeddingSourceError();
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  try {
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: cleanedText,
        model: "text-embedding-3-small",
      }),
    });

    const payload = (await response.json()) as OpenAIEmbeddingsResponse;

    if (!response.ok) {
      const detail = payload.error?.message ?? response.statusText;
      throw new Error(`OpenAI embeddings request failed: ${response.status} ${detail}`);
    }

    const embedding = payload.data?.[0]?.embedding;
    if (!Array.isArray(embedding) || embedding.length === 0) {
      throw new Error("OpenAI embeddings response is missing data[0].embedding");
    }

    return embedding;
  } catch (error) {
    if (error instanceof EmptyProfileEmbeddingSourceError) {
      throw error;
    }
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("OpenAI embeddings request failed with an unknown error");
  }
}
