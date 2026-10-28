// The dictionary is imported, so the bundler compiles it into the app; it is never read from disk at run time.
import raw from "../../../data/hr-dictionary.json";
import { normalize } from "./normalize";

export type DictionaryEntry = {
  readonly key: string;
  readonly label: string;
  readonly synonyms: readonly string[];
};

export const dictionary: readonly DictionaryEntry[] = raw.entries;

const byKey = new Map(dictionary.map((e) => [normalize(e.key), e]));
const byName = new Map<string, DictionaryEntry>();
for (const e of dictionary) {
  for (const name of [e.label, ...e.synonyms]) {
    const n = normalize(name);
    if (!byName.has(n)) byName.set(n, e);
  }
}

/** The entry of a tag key, or (for a tag named like a label, such as `ho_va_ten`) of an entry with that name. */
export function findEntry(tagKey: string): DictionaryEntry | undefined {
  const n = normalize(tagKey);
  return byKey.get(n) ?? byName.get(n);
}

/** Suggested display label of a tag: dictionary label, else underscores to spaces and a capital first letter. */
export function suggestLabel(tagKey: string): string {
  const entry = findEntry(tagKey);
  if (entry) return entry.label;
  const spaced = tagKey.replace(/_+/g, " ").trim();
  return spaced === "" ? tagKey : spaced.charAt(0).toLocaleUpperCase() + spaced.slice(1);
}
