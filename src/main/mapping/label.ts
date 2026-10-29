/** Display label of a tag: underscores as spaces and a capital first letter. */
export function suggestLabel(tagKey: string): string {
  const spaced = tagKey.replace(/_+/g, " ").trim();
  return spaced === "" ? tagKey : spaced.charAt(0).toLocaleUpperCase() + spaced.slice(1);
}
