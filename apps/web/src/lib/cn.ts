/** 轻量类名拼接，避免为此引一个依赖 */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}
