export const LABEL_MAX_LENGTH = 64

export function sanitizeLabel(raw: unknown): string | null {
  if (typeof raw !== "string") return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  return trimmed
    .replace(/[/\\:*?"<>|]/g, "-")
    .replace(/[\x00-\x1F\x7F]/g, "")
    .substring(0, LABEL_MAX_LENGTH)
    .trim() || null
}
