export type TaskStatusKey = "delayed" | "todo" | "in_progress" | "review" | "on_hold" | "done";
const DEFAULT_CHIP_HEIGHT = 22;
const DEFAULT_CHIP_FONT_SIZE = "0.62rem";
const DEFAULT_CHIP_FONT_WEIGHT = 700;
const PROJECT_TASK_PRIORITY_CHIP_WIDTH_CH = 12;

export const TASK_STATUS_COLORS: Record<TaskStatusKey, string> = {
  delayed: "#C2185B",
  todo: "#757575",
  in_progress: "#1E88E5",
  review: "#F59E0B",
  on_hold: "#880E4F",
  done: "#0A7D5A",
};

export const TASK_STATUS_LABELS: Record<TaskStatusKey, string> = {
  delayed: "Delayed",
  todo: "To Do",
  in_progress: "In Progress",
  review: "Review",
  on_hold: "On Hold",
  done: "Done",
};

export const TASK_STATUS_ORDER: TaskStatusKey[] = ["todo", "in_progress", "on_hold", "review", "done"];

const DONE_STATUS_VALUES = new Set(["done", "complete", "completed", "closed"]);

export const normalizeTaskStatus = (value?: string): TaskStatusKey | undefined => {
  const normalized = String(value || "").trim().toLowerCase().replace(/\s+/g, "_");
  if (!normalized) return undefined;
  if (normalized.includes("delay") || normalized === "overdue") return "delayed";
  if (["todo", "to_do", "open", "pending"].includes(normalized)) return "todo";
  if (normalized.includes("review")) return "review";
  if (normalized === "on_hold" || normalized === "onhold") return "on_hold";
  if (["in_progress", "inprogress", "active"].includes(normalized)) return "in_progress";
  if (DONE_STATUS_VALUES.has(normalized)) return "done";
  return undefined;
};

export const isDoneTaskStatus = (value?: string) => {
  const normalized = String(value || "").trim().toLowerCase().replace(/\s+/g, "_");
  return DONE_STATUS_VALUES.has(normalized);
};

// Highest progress an unfinished task is allowed to show. Only "done" may
// read 100%, so a task moved out of done never keeps a completed-looking bar.
export const MAX_INCOMPLETE_PROGRESS = 90;

// Progress % that a status change should suggest. Returns null when the status
// shouldn't drive progress (on_hold, delayed) so callers leave it as-is.
// Moving (back) to "todo" resets progress to 0.
// Pass the task's current progress so that leaving "done" for a status without
// a fixed % (on_hold, delayed) still drops it below 100 instead of staying at
// 100% forever.
export const getProgressForStatus = (
  value?: string,
  currentProgress?: number | string | null
): number | null => {
  const key = normalizeTaskStatus(value);
  if (key === "todo") return 0;
  if (key === "in_progress") return 40;
  if (key === "review") return 70;
  if (key === "done") return 100;
  const numericProgress = Number(currentProgress);
  if (Number.isFinite(numericProgress) && numericProgress >= 100) {
    return MAX_INCOMPLETE_PROGRESS;
  }
  return null;
};

export const getTaskStatusColor = (value?: string, options?: { delayed?: boolean }) => {
  const key = options?.delayed ? "delayed" : normalizeTaskStatus(value);
  if (!key) return TASK_STATUS_COLORS.in_progress;
  return TASK_STATUS_COLORS[key];
};

export const formatTaskStatusLabel = (value?: string, options?: { delayed?: boolean; uppercase?: boolean }) => {
  const key = options?.delayed ? "delayed" : normalizeTaskStatus(value);
  const label = key ? TASK_STATUS_LABELS[key] : String(value || "").replace(/_/g, " ").trim();
  if (!label) return "IN PROGRESS";
  return options?.uppercase === false ? label : label.toUpperCase();
};

export const getTaskStatusChipSx = (
  value?: string,
  options?: { delayed?: boolean; height?: number; fontSize?: string; fontWeight?: number }
) => ({
  height: options?.height ?? DEFAULT_CHIP_HEIGHT,
  minHeight: options?.height ?? DEFAULT_CHIP_HEIGHT,
  fontSize: options?.fontSize ?? DEFAULT_CHIP_FONT_SIZE,
  fontWeight: options?.fontWeight ?? DEFAULT_CHIP_FONT_WEIGHT,
  letterSpacing: 0.3,
  color: "#ffffff",
  backgroundColor: getTaskStatusColor(value, { delayed: options?.delayed }),
  borderRadius: "999px",
  textTransform: "uppercase",
  boxSizing: "border-box",
  "& .MuiChip-label": {
    px: 1.2,
    lineHeight: 1,
    display: "inline-flex",
    alignItems: "center",
  },
});

export const PROJECT_TASK_PRIORITY_CHIP_SX = {
  width: `${PROJECT_TASK_PRIORITY_CHIP_WIDTH_CH}ch`,
  minWidth: `${PROJECT_TASK_PRIORITY_CHIP_WIDTH_CH}ch`,
  maxWidth: `${PROJECT_TASK_PRIORITY_CHIP_WIDTH_CH}ch`,
  justifyContent: "center",
  "& .MuiChip-label": {
    width: "100%",
    textAlign: "center",
    px: 0.9,
  },
} as const;

export const normalizeTaskPriority = (value?: string) =>
  (() => {
    const normalized = String(value || "").trim().toLowerCase().replace(/\s+/g, "_");
    return normalized === "urgent" ? "high" : normalized;
  })();

export const getTaskPriorityColor = (value?: string) => {
  const key = normalizeTaskPriority(value);
  if (key === "low") return "#0A7D5A";
  if (key === "medium") return "#F59E0B";
  if (key === "high") return "#D64545";
  if (key === "critical") return "#8B1A1A";
  return "#90A4AE";
};

export const formatTaskPriorityLabel = (value?: string, options?: { uppercase?: boolean }) => {
  const normalized = normalizeTaskPriority(value);
  if (!normalized) return "";
  const label = normalized.replace(/_/g, " ");
  return options?.uppercase === false ? label : label.toUpperCase();
};

export const getTaskPriorityChipSx = (value?: string, options?: { height?: number; fontSize?: string; fontWeight?: number }) => {
  const color = getTaskPriorityColor(value);
  return {
    height: options?.height ?? DEFAULT_CHIP_HEIGHT,
    minHeight: options?.height ?? DEFAULT_CHIP_HEIGHT,
    fontSize: options?.fontSize ?? DEFAULT_CHIP_FONT_SIZE,
    fontWeight: options?.fontWeight ?? DEFAULT_CHIP_FONT_WEIGHT,
    color: "#111111",
    borderColor: color,
    borderWidth: 2,
    backgroundColor: "#ffffff",
    borderRadius: "999px",
    textTransform: "uppercase",
    boxSizing: "border-box",
    "& .MuiChip-label": {
      px: 1.2,
      lineHeight: 1,
      display: "inline-flex",
      alignItems: "center",
    },
  };
};

export const getTaskInfoChipSx = (options?: { height?: number; fontSize?: string; fontWeight?: number }) => ({
  height: options?.height ?? DEFAULT_CHIP_HEIGHT,
  minHeight: options?.height ?? DEFAULT_CHIP_HEIGHT,
  fontSize: options?.fontSize ?? DEFAULT_CHIP_FONT_SIZE,
  fontWeight: options?.fontWeight ?? 600,
  color: "#334155",
  borderColor: "#b8c1cc",
  borderRadius: "999px",
  backgroundColor: "#ffffff",
  boxSizing: "border-box",
  "& .MuiChip-label": {
    px: 1.2,
    lineHeight: 1,
    display: "inline-flex",
    alignItems: "center",
  },
});
