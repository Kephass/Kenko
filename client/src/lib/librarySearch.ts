/** Case/accent-insensitive word search, independent of word order. */
export function matchesLibrarySearch(query: string, text: string) {
  const words = (value: string) => value.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  const haystack = words(text);
  return words(query).every(needle => haystack.some(word => word.startsWith(needle)));
}
