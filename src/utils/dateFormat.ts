const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export const parseUiDate = (value: unknown): Date | null => {
  if (value === null || value === undefined || value === "") return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;

    const isoDateOnly = /^\d{4}-\d{2}-\d{2}$/;
    const parsed = isoDateOnly.test(trimmed)
      ? new Date(`${trimmed}T00:00:00`)
      : new Date(trimmed);

    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
};

export const formatUiDate = (value: unknown, fallback = "-"): string => {
  const parsed = parseUiDate(value);
  if (!parsed) return fallback;

  const day = String(parsed.getDate()).padStart(2, "0");
  const month = MONTH_LABELS[parsed.getMonth()];
  const year = parsed.getFullYear();

  return `${month} ${day}, ${year}`;
};
