/**
 * Utility functions for resolving user data from the `assigned_to` field.
 *
 * The `assigned_to` column is an FK to auth_user.
 * - Without `populate`: an id/uuid scalar
 * - With `populate: ["assigned_to"]`: a full user object `{ id, first_name, ... }`
 *
 * All functions take a `userById` lookup map (Record<string, any>) built
 * from the user provider's list, so there's zero data fetching here.
 */

const normalizeUserId = (value: any): string | number | null => {
  if (value == null || value === "") return null;

  if (typeof value === "object") {
    const id = value.id ?? value.uuid ?? value.user_id ?? value.user_uuid;
    if (id == null || id === "") return null;
    return normalizeUserId(id);
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "bigint") {
    return Number(value);
  }

  const trimmed = String(value).trim();
  if (!trimmed.length) return null;
  if (/^-?\d+$/.test(trimmed)) {
    const numeric = Number(trimmed);
    if (Number.isFinite(numeric)) return numeric;
  }
  return trimmed;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const normalizeUuid = (value: any): string | null => {
  if (value == null || value === "") return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  return UUID_REGEX.test(trimmed) ? trimmed : null;
};

/** Extract a user ID from any shape of assigned_to value. */
export const resolveUserId = (value: any): string | number | null => {
  return normalizeUserId(value);
};

/**
 * Resolve a full user object from any shape of assigned_to value.
 * Falls back to the populated object itself when the lookup map
 * doesn't contain the user (e.g. users list still loading).
 */
export const resolveUser = (value: any, userById: Record<string, any>): any | null => {
  if (value == null || value === "") return null;

  if (typeof value === "object") {
    const id = normalizeUserId(value);
    if (id) {
      const found = userById[id];
      if (found) return found;
    }
    return value;
  }

  const id = normalizeUserId(value);
  return id ? userById[id] || null : null;
};

/** Get a display label for a user object. */
export const formatUserLabel = (user: any): string => {
  if (!user) return "";
  const first = String(user.first_name || "").trim();
  const last = String(user.last_name || "").trim();
  const fullName = `${first} ${last}`.trim();
  return fullName || user.full_name || user.username || user.email || `User ${user.id ?? user.uuid}`;
};

/**
 * Autocomplete filter for user options, matching on the label the user sees.
 *
 * The users API searches username and email as well as names, so `?search=ma`
 * matches every address containing "gmail.com" / "yopmail.com" and returns
 * hundreds of people whose displayed name has nothing to do with the query.
 * Filtering the server results down to the rendered label makes the user
 * pickers behave like the Departments/Teams pickers, which filter client-side
 * on the option label. A query containing "@" is treated as an address lookup
 * so pasting a full email still finds the person behind it.
 */
export const filterUserOptionsByLabel = <T,>(
  options: T[],
  state: { inputValue?: string }
): T[] => {
  const query = String(state?.inputValue || "").trim().toLowerCase();
  if (!query) return options;
  const isContactQuery = query.includes("@");
  return options.filter((option: any) => {
    if (formatUserLabel(option).toLowerCase().includes(query)) return true;
    if (!isContactQuery) return false;
    const email = String(option?.email || "").toLowerCase();
    const username = String(option?.username || "").toLowerCase();
    return email.includes(query) || username.includes(query);
  });
};

/** Get a display label for any shape of assigned_to value. */
export const getAssigneeLabel = (value: any, userById: Record<string, any>): string => {
  if (value == null || value === "") return "";
  const user = resolveUser(value, userById);
  if (user) return formatUserLabel(user);
  return "Unknown assignee";
};

/**
 * Extract the user ID from the useGetIdentity() data object.
 *
 * The Taruvi auth provider's getIdentity() returns a flat UserData object
 * with `id` at the top level. The `data?.id` fallback covers any edge case
 * where the response wrapper leaks through.
 */
export const extractIdentityId = (user: any): string | number | null => {
  if (user == null) return null;
  return normalizeUserId(
    user.id ??
    user.uuid ??
    user.data?.id ??
    user.data?.uuid ??
    user.user_id ??
    user.user_uuid
  );
};

/** Extract UUID identity from useGetIdentity() result when available. */
export const extractIdentityUuid = (user: any): string | null => {
  if (user == null) return null;
  return (
    normalizeUuid(user.uuid) ??
    normalizeUuid(user.data?.uuid) ??
    normalizeUuid(user.user_uuid) ??
    normalizeUuid(user.id) ??
    normalizeUuid(user.data?.id) ??
    normalizeUuid(user.user_id)
  );
};

/** Get initials for an avatar from any user-like object. */
export const getUserInitials = (user: any): string => {
  if (!user) return "?";
  const fullName =
    user.full_name || `${user.first_name || ""} ${user.last_name || ""}`.trim();
  if (fullName) {
    const parts = fullName.split(/\s+/).filter(Boolean);
    return parts.slice(0, 2).map((p: string) => p[0]).join("").toUpperCase();
  }
  const fallback = user.username || user.email || String(user.id || "?");
  return String(fallback).slice(0, 2).toUpperCase();
};
