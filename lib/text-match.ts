export type MatchType = "contains" | "exact" | "any";

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

export function matchesKeywords(
  text: string | null | undefined,
  keywords: string[],
  matchType: MatchType
): boolean {
  if (matchType === "any") return true;

  const normalizedText = normalize(text ?? "");
  if (!normalizedText) return false;

  return keywords.some((keyword) => {
    const normalizedKeyword = normalize(keyword);
    if (!normalizedKeyword) return false;
    return matchType === "exact"
      ? normalizedText === normalizedKeyword
      : normalizedText.includes(normalizedKeyword);
  });
}
