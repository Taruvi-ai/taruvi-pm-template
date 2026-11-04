/**
 * Helpers for resolving a written person name against the users endpoint.
 *
 * The endpoint's `search` filter matches a single term against individual
 * columns (`first_name`, `last_name`, `username`, `email`) and never against a
 * concatenation of them. A query of "Aditya Achar" therefore returns zero rows
 * even when a user exists with first_name "Aditya" and last_name "Achar".
 *
 * The workaround everywhere in the app: search each word separately, then keep
 * only the people who match *every* word. A zero-result search is never on its
 * own evidence that the person does not exist.
 */

/** Split a written name into searchable words. */
export const tokenizeName = (value: string): string[] =>
  String(value || "")
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 0);

/** Everything about a user that a written name might plausibly refer to. */
export const userSearchText = (user: any): string =>
  [user?.first_name, user?.last_name, user?.full_name, user?.username, user?.email]
    .map((value) => String(value || "").trim().toLowerCase())
    .filter(Boolean)
    .join(" ");

/** True when every word of the written name appears somewhere in the user. */
export const userMatchesAllTokens = (user: any, tokens: string[]): boolean => {
  if (tokens.length === 0) return false;
  const haystack = userSearchText(user);
  return tokens.every((token) => haystack.includes(token.toLowerCase()));
};

/**
 * Which words to actually send to the server. The first and last carry the most
 * signal for a person name ("Aditya Achar", "Jeff Culliton"); middle words rarely
 * narrow anything and each one costs a request.
 */
export const searchableTokens = (tokens: string[]): string[] => {
  if (tokens.length <= 1) return tokens;
  const first = tokens[0];
  const last = tokens[tokens.length - 1];
  return first === last ? [first] : [first, last];
};

/**
 * Narrow a pool of candidates to those matching every word of the written name.
 * Falls back to the unfiltered pool when nothing matches every word, so callers
 * still get something to show rather than an empty dropdown.
 */
export const filterUsersByAllTokens = (users: any[], value: string): any[] => {
  const tokens = tokenizeName(value);
  if (tokens.length <= 1) return users;
  const matches = users.filter((user) => userMatchesAllTokens(user, tokens));
  return matches.length > 0 ? matches : users;
};

/** Merge user lists, keeping the first occurrence of each id. */
export const dedupeUsers = (...lists: (any[] | undefined)[]): any[] => {
  const seen = new Set<string>();
  const merged: any[] = [];
  lists.forEach((list) => {
    (list || []).forEach((user: any) => {
      if (!user || user.id == null) return;
      const key = String(user.id);
      if (seen.has(key)) return;
      seen.add(key);
      merged.push(user);
    });
  });
  return merged;
};
