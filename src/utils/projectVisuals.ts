export const normalizeProjectStatus = (value?: string) =>
  String(value || "").trim().toLowerCase().replace(/\s+/g, "_");

export const formatProjectStatusLabel = (value?: string) => {
  const normalized = normalizeProjectStatus(value);
  if (!normalized) return "Planning";
  if (normalized === "on_hold") return "On Hold";
  if (normalized === "completed" || normalized === "complete") return "Done";
  return normalized
    .split("_")
    .map((part) => (part ? `${part[0].toUpperCase()}${part.slice(1)}` : part))
    .join(" ");
};

export const getProjectStatusChipColor = (value?: string) => {
  const normalized = normalizeProjectStatus(value);
  const colorMap: Record<string, "default" | "primary" | "warning" | "success" | "error"> = {
    planning: "default",
    active: "primary",
    on_hold: "warning",
    completed: "success",
    complete: "success",
    cancelled: "error",
  };
  return colorMap[normalized] || "default";
};
