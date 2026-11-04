// Timestamps are written as UTC (`new Date().toISOString()`), but the API returns
// them without a timezone designator, e.g. "2026-08-18T18:24:29.017000". JS parses
// a bare date-time as *local* time, which would shift every reading by the viewer's
// UTC offset, so mark the value as UTC before parsing. Values that already carry a
// "Z" or a "+HH:MM"/"-HH:MM" offset (storage_objects rows do) are left untouched.
const ensureUtcDesignator = (value: string): string => {
  const timePart = value.slice(value.indexOf("T") + 1);
  if (/[Zz]$/.test(timePart) || /[+\-]\d{2}:?\d{2}$/.test(timePart)) return value;
  return `${value}Z`;
};

export const parseActivityTimestamp = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;

  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isFinite(ms) ? ms : null;
  }

  if (typeof value === "number") {
    const ms = value < 1e12 ? value * 1000 : value;
    return Number.isFinite(ms) && ms > 0 ? ms : null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;

    if (/^\d+$/.test(trimmed)) {
      const numeric = Number(trimmed);
      if (Number.isFinite(numeric)) {
        const ms = numeric < 1e12 ? numeric * 1000 : numeric;
        return ms > 0 ? ms : null;
      }
    }

    const withT = trimmed.includes(" ") && !trimmed.includes("T")
      ? trimmed.replace(" ", "T")
      : trimmed;
    // Date-only values ("2026-08-18") are already parsed as UTC by the spec.
    const normalized = withT.includes("T") ? ensureUtcDesignator(withT) : withT;
    const normalizedMs = Date.parse(normalized);
    if (Number.isFinite(normalizedMs)) return normalizedMs;

    const reducedPrecision = normalized.replace(
      /(\.\d{3})\d+(?=(?:Z|[+\-]\d{2}:?\d{2})?$)/,
      "$1",
    );
    const reducedPrecisionMs = Date.parse(reducedPrecision);
    if (Number.isFinite(reducedPrecisionMs)) return reducedPrecisionMs;
  }

  return null;
};

export const compareActivitiesDesc = (a: any, b: any): number => {
  const timeA = parseActivityTimestamp(a?.created_at);
  const timeB = parseActivityTimestamp(b?.created_at);

  if (timeA !== null && timeB !== null) {
    if (timeA !== timeB) return timeB - timeA;
  } else if (timeA === null && timeB !== null) {
    return 1;
  } else if (timeA !== null && timeB === null) {
    return -1;
  }

  const rawA = String(a?.created_at ?? "").trim();
  const rawB = String(b?.created_at ?? "").trim();
  if (rawA && rawB && rawA !== rawB) {
    return rawB.localeCompare(rawA, undefined, {
      sensitivity: "base",
      numeric: true,
    });
  }

  return String(b?.id ?? "").localeCompare(String(a?.id ?? ""), undefined, {
    sensitivity: "base",
    numeric: true,
  });
};

export const formatActivityTimestamp = (value: unknown): string => {
  const parsed = parseActivityTimestamp(value);
  if (!parsed) return "—";
  return new Date(parsed).toLocaleString();
};
