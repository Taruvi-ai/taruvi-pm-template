export const ADDITIONAL_INFO_ACTIVITY_LABEL = "Additional Info";

const ADDITIONAL_INFO_ACTIVITY_FIELDS = new Set(["additional info", "additional notes"]);

export const isAdditionalInfoActivityField = (fieldName: unknown): boolean => {
  const normalized = String(fieldName || "").trim().toLowerCase();
  return ADDITIONAL_INFO_ACTIVITY_FIELDS.has(normalized);
};

export const normalizeAdditionalInfoActivityValue = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;

  const raw = String(value);
  const trimmed = raw.trim();
  if (!trimmed || trimmed.toLowerCase() === "none") return null;

  return raw;
};
