export function parseRatings(json: string | undefined): { card_id: string; rating: string }[] {
  if (!json) return [];
  try {
    return JSON.parse(json) as { card_id: string; rating: string }[];
  } catch {
    return [];
  }
}
