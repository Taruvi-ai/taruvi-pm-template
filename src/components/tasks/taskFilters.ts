export type TaskFilters = {
  sortBy: string;
  sortOrder: "asc" | "desc";
  filterPriority: string;
  filterAssignedTo: string;
  hideDone: boolean;
  /** Free-text title search, sent to the backend as a case-insensitive `contains` filter. */
  search?: string;
};

const PRIORITY_SORT_RANK: Record<string, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

const STATUS_SORT_RANK: Record<string, number> = {
  todo: 1,
  in_progress: 2,
  review: 3,
  on_hold: 4,
  done: 5,
  complete: 5,
  completed: 5,
};

const DATE_SORT_FIELDS = new Set([
  "created_at",
  "updated_at",
  "start_date",
  "end_date",
  "updated_end_date",
]);

const normalizeText = (value: any) => String(value ?? "").trim().toLowerCase();
const normalizePriorityForSort = (value: any) => {
  const normalized = normalizeText(value);
  return normalized === "urgent" ? "high" : normalized;
};

const toTimestamp = (value: any): number | null => {
  if (value === null || value === undefined || value === "") return null;

  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    return value < 1e12 ? value * 1000 : value;
  }

  const raw = String(value).trim();
  if (!raw) return null;

  if (/^\d+$/.test(raw)) {
    const numeric = Number(raw);
    if (Number.isFinite(numeric)) {
      return numeric < 1e12 ? numeric * 1000 : numeric;
    }
  }

  const direct = Date.parse(raw);
  if (Number.isFinite(direct)) return direct;

  if (raw.includes(" ") && !raw.includes("T")) {
    const withT = Date.parse(raw.replace(" ", "T"));
    if (Number.isFinite(withT)) return withT;
  }

  return null;
};

const getSortValue = (task: any, sortBy: string): string | number | null => {
  const field = String(sortBy || "").trim();

  if (field === "priority") {
    const key = normalizePriorityForSort(task?.priority);
    return PRIORITY_SORT_RANK[key] ?? null;
  }

  if (field === "status") {
    const key = normalizeText(task?.status).replace(/\s+/g, "_");
    return STATUS_SORT_RANK[key] ?? null;
  }

  if (field === "end_date" || field === "updated_end_date") {
    return task?.updated_end_date || task?.end_date || null;
  }

  if (field === "progress") {
    const num = Number(task?.progress);
    return Number.isFinite(num) ? num : null;
  }

  if (DATE_SORT_FIELDS.has(field)) {
    const rawDate = field === "end_date" ? task?.updated_end_date || task?.end_date : task?.[field];
    return toTimestamp(rawDate);
  }

  const raw = task?.[field];
  if (raw === null || raw === undefined || raw === "") return null;

  const numeric = Number(raw);
  if (Number.isFinite(numeric) && typeof raw !== "string") return numeric;

  return String(raw);
};

export const buildTaskSorters = (filters: TaskFilters) => {
  const field = String(filters?.sortBy || "").trim();
  if (!field) return [];

  // Keep custom rank sorting client-side for priority/status.
  if (field === "priority" || field === "status") {
    return [];
  }

  const order: "asc" | "desc" = filters?.sortOrder === "asc" ? "asc" : "desc";
  const sortableField = field === "end_date" ? "updated_end_date" : field;
  return [{ field: sortableField, order }];
};

export const sortTasksByFilters = (tasks: any[], filters: TaskFilters) => {
  const sortBy = String(filters?.sortBy || "").trim();
  const sortOrder: "asc" | "desc" = filters?.sortOrder === "desc" ? "desc" : "asc";
  const direction = sortOrder === "desc" ? -1 : 1;

  if (!sortBy) return tasks;

  return [...tasks].sort((a: any, b: any) => {
    const aValue = getSortValue(a, sortBy);
    const bValue = getSortValue(b, sortBy);

    if (aValue === null && bValue === null) return 0;
    if (aValue === null) return 1;
    if (bValue === null) return -1;

    if (typeof aValue === "number" && typeof bValue === "number") {
      if (aValue === bValue) return 0;
      return aValue > bValue ? direction : -direction;
    }

    const compared = String(aValue).localeCompare(String(bValue), undefined, {
      sensitivity: "base",
      numeric: true,
    });
    return compared === 0 ? 0 : compared * direction;
  });
};

export const buildTaskFilters = (
  projectId: string | number | null | undefined,
  filters: TaskFilters
) => {
  const hasProjectId = projectId !== null && projectId !== undefined && String(projectId).trim() !== "";
  const assignedFilter = filters.filterAssignedTo;
  const assignedValue =
    assignedFilter !== "all" && assignedFilter !== ""
      ? (() => {
          const numeric = Number(assignedFilter);
          return Number.isFinite(numeric) ? numeric : assignedFilter;
        })()
      : null;
  const searchText = String(filters.search ?? "").trim();
  const activeFilters: any[] = [
    ...(hasProjectId ? [{ field: "project_id", operator: "eq", value: projectId }] : []),
    ...(filters.filterPriority !== "all"
      ? filters.filterPriority === "high"
        ? [{ field: "priority", operator: "in", value: ["high", "urgent"] }]
        : [{ field: "priority", operator: "eq", value: filters.filterPriority }]
      : []),
    ...(assignedValue !== null
      ? [{ field: "assigned_to", operator: "eq", value: assignedValue }]
      : []),
    ...(filters.hideDone ? [{ field: "status", operator: "ne", value: "done" }] : []),
    // `contains` → `title__contains`, which the platform runs as ILIKE.
    ...(searchText ? [{ field: "title", operator: "contains", value: searchText }] : []),
  ];
  return activeFilters;
};
