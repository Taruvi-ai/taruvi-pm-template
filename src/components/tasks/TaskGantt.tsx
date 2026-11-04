import { useList } from "@refinedev/core";
import { Box, IconButton, Paper, Stack, Typography } from "@mui/material";
import { ChevronRight, ExpandMore } from "@mui/icons-material";
import { useEffect, useMemo, useState } from "react";
import { buildTaskFilters, sortTasksByFilters, type TaskFilters } from "./taskFilters";
import { getTaskStatusColor, isDoneTaskStatus, normalizeTaskStatus } from "../../utils/taskVisuals";

interface TaskGanttProps {
  projectId?: string | number | null;
  filters: TaskFilters;
  onOpenTask?: (task: any, trail?: any[]) => void;
}

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const TASK_COLUMN_WIDTH = 260;

const parseDateOnly = (value?: string): Date | null => {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getTaskStartDate = (task: any) => parseDateOnly(task?.start_date);
const getTaskEndDate = (task: any) => parseDateOnly(task?.updated_end_date || task?.end_date);

const isTaskDelayed = (task: any) => {
  if (isDoneTaskStatus(task?.status)) return false;
  const endDate = getTaskEndDate(task);
  if (!endDate) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return endDate.getTime() < today.getTime();
};

const getTaskStatusKey = (task: any) => {
  if (isTaskDelayed(task)) return "delayed";
  const status = normalizeTaskStatus(task?.status);
  return status || "in_progress";
};

export const TaskGantt = ({ projectId, filters, onOpenTask }: TaskGanttProps) => {
  const { result, query: { isLoading } } = useList({
    resource: "tasks",
    filters: buildTaskFilters(projectId, filters) as any,
    pagination: { mode: "off" },
  });

  const fetchedTasks = result?.data || [];
  const tasks = useMemo(
    () => sortTasksByFilters(fetchedTasks, filters),
    [fetchedTasks, filters.sortBy, filters.sortOrder]
  );
  const [expandedParents, setExpandedParents] = useState<Record<string, boolean>>({});

  const taskById = useMemo(
    () =>
      tasks.reduce((acc: Record<string, any>, task: any) => {
        acc[String(task.id)] = task;
        return acc;
      }, {}),
    [tasks]
  );

  const tasksByParent = useMemo(() => {
    const grouped: Record<string, any[]> = {};
    tasks.forEach((task: any) => {
      const rawParent = task.parent_task_id;
      const hasParent = rawParent !== null && rawParent !== undefined && rawParent !== "";
      const parentExists = hasParent ? !!taskById[String(rawParent)] : false;
      const parentKey = hasParent && parentExists ? String(rawParent) : "root";
      grouped[parentKey] = grouped[parentKey] || [];
      grouped[parentKey].push(task);
    });

    Object.keys(grouped).forEach((key) => {
      grouped[key] = sortTasksByFilters(grouped[key], filters);
    });
    return grouped;
  }, [tasks, taskById, filters.sortBy, filters.sortOrder]);

  useEffect(() => {
    setExpandedParents((previous) => {
      const next = { ...previous };
      Object.keys(tasksByParent).forEach((parentId) => {
        if (parentId === "root") return;
        if (next[parentId] === undefined) next[parentId] = true;
      });
      return next;
    });
  }, [tasksByParent]);

  const roots = tasksByParent.root || [];

  const rows = useMemo(() => {
    const orderedRows: Array<{ task: any; level: number; hasChildren: boolean; ancestors: any[] }> = [];

    // `ancestors` carries the rows above this one, outermost first, so opening a
    // task can tell the details dialog which path led to it.
    const visit = (task: any, level: number, ancestors: any[]) => {
      const children = tasksByParent[String(task.id)] || [];
      const hasChildren = children.length > 0;
      orderedRows.push({ task, level, hasChildren, ancestors });
      if (hasChildren && expandedParents[String(task.id)] !== false) {
        const childAncestors = [...ancestors, task];
        children.forEach((child) => visit(child, level + 1, childAncestors));
      }
    };

    roots.forEach((task) => visit(task, 0, []));
    return orderedRows;
  }, [roots, tasksByParent, expandedParents]);

  const { timelineStart, timelineEnd, totalDays, weekCount } = useMemo(() => {
    const datedTasks = tasks
      .map((task: any) => ({
        start: getTaskStartDate(task),
        end: getTaskEndDate(task),
      }))
      .filter((entry) => entry.start && entry.end) as Array<{ start: Date; end: Date }>;

    if (datedTasks.length === 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const end = new Date(today);
      end.setDate(end.getDate() + 27);
      return { timelineStart: today, timelineEnd: end, totalDays: 28, weekCount: 4 };
    }

    const minStart = new Date(Math.min(...datedTasks.map((item) => item.start.getTime())));
    const maxEnd = new Date(Math.max(...datedTasks.map((item) => item.end.getTime())));
    minStart.setHours(0, 0, 0, 0);
    maxEnd.setHours(0, 0, 0, 0);

    const days = Math.max(1, Math.floor((maxEnd.getTime() - minStart.getTime()) / DAY_IN_MS) + 1);
    const weeks = Math.max(1, Math.ceil(days / 7));
    return { timelineStart: minStart, timelineEnd: maxEnd, totalDays: days, weekCount: weeks };
  }, [tasks]);

  const getBarPosition = (task: any) => {
    const startDate = getTaskStartDate(task);
    const endDate = getTaskEndDate(task);
    if (!startDate || !endDate) return null;

    const clampedStart = Math.max(startDate.getTime(), timelineStart.getTime());
    const clampedEnd = Math.min(endDate.getTime(), timelineEnd.getTime());
    if (clampedEnd < clampedStart) return null;

    const startOffset = Math.floor((clampedStart - timelineStart.getTime()) / DAY_IN_MS);
    const durationDays = Math.floor((clampedEnd - clampedStart) / DAY_IN_MS) + 1;
    const left = (startOffset / totalDays) * 100;
    const width = Math.max((durationDays / totalDays) * 100, 1.8);

    return { left: `${left}%`, width: `${width}%` };
  };

  const openTask = (task: any, ancestors: any[] = []) => onOpenTask?.(task, ancestors);

  if (isLoading) return <div>Loading...</div>;

  if (!tasks.length) {
    return (
      <Paper sx={{ p: 3, border: "1px solid #d8dde5", boxShadow: "none", borderRadius: 2 }}>
        <Typography variant="body2" color="text.secondary">
          No tasks to display in Gantt view.
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 2, border: "1px solid #d8dde5", boxShadow: "none", borderRadius: 2, bgcolor: "#ffffff" }}>
      <Box sx={{ border: "1px solid #dfe3ea", borderRadius: 1.5, overflow: "hidden", bgcolor: "#ffffff" }}>
        <Box sx={{ display: "flex", borderBottom: "1px solid #dfe3ea", bgcolor: "#f8f9fb" }}>
          <Box
            sx={{
              width: TASK_COLUMN_WIDTH,
              minWidth: TASK_COLUMN_WIDTH,
              px: 2,
              py: 1.2,
              borderRight: "1px solid #dfe3ea",
              display: "flex",
              alignItems: "center",
            }}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              Task
            </Typography>
          </Box>
          <Box sx={{ flex: 1, display: "grid", gridTemplateColumns: `repeat(${weekCount}, minmax(72px, 1fr))` }}>
            {Array.from({ length: weekCount }).map((_, index) => (
              <Box
                key={`week-${index + 1}`}
                sx={{
                  px: 1,
                  py: 1.2,
                  borderLeft: "1px solid #dfe3ea",
                  textAlign: "center",
                }}
              >
                <Typography variant="caption" sx={{ fontWeight: 700, color: "#4b5563" }}>
                  Week {index + 1}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>

        {rows.map(({ task, level, hasChildren, ancestors }) => {
          const rowKey = String(task.id);
          const isExpanded = expandedParents[rowKey] !== false;
          const barPosition = getBarPosition(task);
          const statusKey = getTaskStatusKey(task);
          const barColor = getTaskStatusColor(statusKey);
          const hasProgress = task.progress !== null && task.progress !== undefined;
          const progressLabel = hasProgress ? `${task.progress}%` : "";

          return (
            <Box key={rowKey} sx={{ display: "flex", minHeight: 42, borderTop: "1px solid #edf1f5" }}>
              <Box
                sx={{
                  width: TASK_COLUMN_WIDTH,
                  minWidth: TASK_COLUMN_WIDTH,
                  px: 1.25,
                  display: "flex",
                  alignItems: "center",
                  borderRight: "1px solid #edf1f5",
                }}
              >
                <Stack direction="row" alignItems="center" sx={{ pl: `${level * 2.5}px`, width: "100%" }}>
                  {hasChildren ? (
                    <IconButton
                      size="small"
                      onClick={() =>
                        setExpandedParents((previous) => ({
                          ...previous,
                          [rowKey]: !isExpanded,
                        }))
                      }
                      sx={{ mr: 0.2 }}
                    >
                      {isExpanded ? <ExpandMore sx={{ fontSize: 17 }} /> : <ChevronRight sx={{ fontSize: 17 }} />}
                    </IconButton>
                  ) : (
                    <Box sx={{ width: 28 }} />
                  )}
                  <Typography
                    variant="body2"
                    noWrap
                    onClick={() => openTask(task, ancestors)}
                    sx={{ cursor: "pointer", "&:hover": { textDecoration: "underline" } }}
                  >
                    {task.title}
                  </Typography>
                </Stack>
              </Box>

              <Box
                sx={{
                  flex: 1,
                  position: "relative",
                  backgroundImage: `linear-gradient(to right, #eef2f6 1px, transparent 1px)`,
                  backgroundSize: `${100 / weekCount}% 100%`,
                }}
              >
                {barPosition ? (
                  <Box
                    sx={{
                      position: "absolute",
                      top: 8,
                      left: barPosition.left,
                      width: barPosition.width,
                      height: 26,
                      borderRadius: 0.9,
                      bgcolor: barColor,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      px: 1,
                      cursor: "pointer",
                    }}
                    onClick={() => openTask(task, ancestors)}
                  >
                    <Typography variant="caption" sx={{ color: "#ffffff", fontWeight: 700 }} noWrap>
                      {progressLabel}
                    </Typography>
                  </Box>
                ) : null}
              </Box>
            </Box>
          );
        })}
      </Box>
    </Paper>
  );
};
