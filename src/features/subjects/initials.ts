// Up to two letters or digits for an avatar: "Mia Rose" → "MR", "Noah" → "NO",
// "Biscuit (dog)" → "BD". Punctuation and symbols are skipped.
export function initials(name: string) {
  const words = name
    .split(/\s+/)
    .map((word) => word.match(/[\p{L}\p{N}]+/gu)?.join('') ?? '')
    .filter(Boolean)
  const letters =
    words.length > 1
      ? [...words[0]][0] + [...words[1]][0]
      : [...(words[0] ?? '?')].slice(0, 2).join('')
  return letters.toLocaleUpperCase()
}
