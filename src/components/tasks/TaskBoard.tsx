import { useList, useUpdate, useCreate, useGetIdentity } from "@refinedev/core";
import { Avatar, Box, Card, CardContent, Chip, Collapse, Link, Paper, Stack, Tooltip, Typography } from "@mui/material";
import { AccessTime, AccountTree, AttachFile, ExpandMore } from "@mui/icons-material";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { buildTaskFilters, buildTaskSorters, sortTasksByFilters, type TaskFilters } from "./taskFilters";
import {
  formatTaskPriorityLabel,
  formatTaskStatusLabel,
  getTaskPriorityChipSx,
  getTaskStatusChipSx,
  getTaskStatusColor,
  getProgressForStatus,
  normalizeTaskStatus,
  type TaskStatusKey,
} from "../../utils/taskVisuals";
import { formatUiDate } from "../../utils/dateFormat";
import { getAssigneeLabel as resolveAssigneeLabel } from "../../utils/userResolver";
import { modalAlert } from "../dialogs/globalDialogs";

interface TaskBoardProps {
  projectId?: string | number | null;
  filters: TaskFilters;
  onOpenTask?: (task: any, trail?: any[]) => void;
}

type BoardStatusColumnKey = "todo" | "in_progress" | "on_hold" | "review" | "complete";

const COLUMN_META: Record<
  BoardStatusColumnKey,
  {
    label: string;
    statusColorKey: "todo" | "in_progress" | "on_hold" | "review" | "done";
    canDrop: boolean;
  }
> = {
  todo: {
    label: "TO DO",
    statusColorKey: "todo",
    canDrop: true,
  },
  in_progress: {
    label: "IN PROGRESS",
    statusColorKey: "in_progress",
    canDrop: true,
  },
  on_hold: {
    label: "ON HOLD",
    statusColorKey: "on_hold",
    canDrop: true,
  },
  review: {
    label: "REVIEW",
    statusColorKey: "review",
    canDrop: true,
  },
  complete: {
    label: "DONE",
    statusColorKey: "done",
    canDrop: true,
  },
};

const COLUMN_ORDER: BoardStatusColumnKey[] = ["todo", "in_progress", "review", "complete", "on_hold"];
const DROP_COLUMNS: BoardStatusColumnKey[] = ["todo", "in_progress", "on_hold", "review", "complete"];

const normalizeStatus = (value?: string) => String(value || "").trim().toLowerCase();

const areStatusMapsEqual = (a: Record<string, string>, b: Record<string, string>) => {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((key) => normalizeStatus(a[key]) === normalizeStatus(b[key]));
};

const isTaskComplete = (task: any) => {
  const status = normalizeStatus(task?.status);
  return ["done", "complete", "completed", "closed"].includes(status);
};

const getParentId = (task: any): string | null => {
  const raw = task?.parent_task_id;
  if (raw === null || raw === undefined || raw === "") return null;
  return String(raw);
};

/** Shared reference so cards without subtasks keep a stable prop for memo. */
const EMPTY_SUBTASKS: any[] = [];

/**
 * Status is also encoded as a shape, so the indicator does not rely on color
 * alone. Shapes supplement the existing status colors rather than replace them.
 */
const STATUS_SHAPE_SX: Record<TaskStatusKey, Record<string, unknown>> = {
  todo: { borderRadius: "50%" }, // circle
  in_progress: { borderRadius: "1px" }, // square
  // scale keeps the rotated square inside its 9px box so it can't crowd neighbours.
  review: { borderRadius: "1px", transform: "rotate(45deg) scale(0.78)" }, // diamond
  on_hold: { borderRadius: "999px", height: 3 }, // bar
  done: { clipPath: "polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)" }, // hexagon
  delayed: { clipPath: "polygon(50% 0%, 100% 100%, 0% 100%)" }, // triangle
};

const STATUS_SHAPE_NAMES: Record<TaskStatusKey, string> = {
  todo: "circle",
  in_progress: "square",
  review: "diamond",
  on_hold: "bar",
  done: "hexagon",
  delayed: "triangle",
};

/** Mirrors getTaskStatusColor's fallback so shape and color never disagree. */
const getStatusShapeKey = (status?: string): TaskStatusKey => normalizeTaskStatus(status) ?? "in_progress";

const StatusShape = ({ status }: { status?: string }) => {
  const shapeKey = getStatusShapeKey(status);

  return (
    <Tooltip
      title={`${formatTaskStatusLabel(status, { uppercase: false })} (${STATUS_SHAPE_NAMES[shapeKey]})`}
    >
      <Box
        sx={{
          width: 9,
          height: 9,
          flexShrink: 0,
          bgcolor: getTaskStatusColor(status),
          ...STATUS_SHAPE_SX[shapeKey],
        }}
      />
    </Tooltip>
  );
};

/** Deepest level of nesting the card will render before it stops recursing. */
const MAX_SUBTASK_DEPTH = 5;

/**
 * Every subtask id beneath rootId, at any depth. Used to expand a card's whole
 * tree in one click. The `seen` set guards against a parent cycle, which the
 * task form permits since it only excludes the task itself.
 */
const collectDescendantIds = (rootId: string, subtasksByParent: Record<string, any[]>): string[] => {
  const found: string[] = [];
  const seen = new Set<string>([rootId]);
  const stack = (subtasksByParent[rootId] || []).map((task) => String(task.id));

  while (stack.length > 0) {
    const id = stack.pop() as string;
    if (seen.has(id)) continue;
    seen.add(id);
    found.push(id);
    stack.push(...(subtasksByParent[id] || []).map((task) => String(task.id)));
  }

  return found;
};

const getBoardColumnForTask = (task: any): BoardStatusColumnKey => {
  if (isTaskComplete(task)) return "complete";
  const statusKey = normalizeTaskStatus(task?.status);
  if (statusKey === "todo") return "todo";
  if (statusKey === "on_hold") return "on_hold";
  if (statusKey === "review") return "review";
  return "in_progress";
};

const getPersistedStatusFromColumn = (column: BoardStatusColumnKey) => {
  if (column === "todo") return "todo";
  if (column === "review") return "review";
  if (column === "complete") return "done";
  if (column === "on_hold") return "on_hold";
  return "in_progress";
};

const formatShortDate = (value?: string) => {
  return formatUiDate(value, "No due date");
};

const getAssigneeInitials = (label: string) => {
  const clean = String(label || "").trim();
  if (!clean) return "U";
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
};

/**
 * Compact read-only row for a subtask nested inside its parent's card. Recurses
 * for its own subtasks, each level indented and collapsed by default.
 */
const SubtaskRow = ({
  task,
  subtasksByParent,
  getAssigneeLabel,
  onOpenTask,
  depth,
  ancestorIds,
  ancestorTasks,
  expandedIds,
  onToggleExpanded,
}: {
  task: any;
  subtasksByParent: Record<string, any[]>;
  getAssigneeLabel: (value: any) => string;
  onOpenTask?: (task: any, trail?: any[]) => void;
  depth: number;
  ancestorIds: ReadonlySet<string>;
  // The rows expanded to reach this one, card root first. Handed to the details
  // dialog so its back arrow can retrace the path the click actually took.
  ancestorTasks: any[];
  expandedIds: ReadonlySet<string>;
  onToggleExpanded: (taskId: string) => void;
}) => {
  const taskId = String(task.id);
  const childrenOpen = expandedIds.has(taskId);
  const done = isTaskComplete(task);
  const assigneeLabel = getAssigneeLabel(task.assigned_to);
  const priorityLabel = formatTaskPriorityLabel(task?.priority);
  const dueDate = task?.updated_end_date || task?.end_date;

  // The task form only blocks picking yourself as a parent, so a cycle is
  // representable. Dropping ancestors keeps this recursion from never ending.
  const children = (subtasksByParent[taskId] || []).filter((child) => !ancestorIds.has(String(child.id)));
  const canNest = depth < MAX_SUBTASK_DEPTH && children.length > 0;
  const childDoneCount = children.filter(isTaskComplete).length;

  const nextAncestorIds = useMemo(() => {
    const next = new Set(ancestorIds);
    next.add(taskId);
    return next;
  }, [ancestorIds, taskId]);

  const nextAncestorTasks = useMemo(() => [...ancestorTasks, task], [ancestorTasks, task]);

  return (
    <Box sx={{ minWidth: 0 }}>
      <Box
        role={onOpenTask ? "button" : undefined}
        tabIndex={onOpenTask ? 0 : undefined}
        // The parent Card owns the drag listeners, so stop the pointer here or
        // clicking a subtask starts a drag of the whole card.
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          onOpenTask?.(task, ancestorTasks);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            event.stopPropagation();
            onOpenTask?.(task, ancestorTasks);
          }
        }}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.6,
          px: 0.8,
          py: 0.5,
          border: "1px solid #e4e8ee",
          borderRadius: 1.25,
          bgcolor: "#f8fafc",
          cursor: onOpenTask ? "pointer" : "default",
          minWidth: 0,
          "&:hover": onOpenTask ? { bgcolor: "#eef2f7", borderColor: "#cbd5e1" } : undefined,
        }}
      >
        <StatusShape status={task?.status} />

        <Typography
          variant="caption"
          noWrap
          sx={{
            flexGrow: 1,
            minWidth: 0,
            fontSize: "0.7rem",
            color: done ? "text.disabled" : "text.primary",
            textDecoration: done ? "line-through" : "none",
          }}
        >
          {task.title}
        </Typography>

        {canNest && (
          <Tooltip
            title={`${childDoneCount} of ${children.length} subtask${children.length === 1 ? "" : "s"} done — click to ${
              childrenOpen ? "hide" : "show"
            }`}
          >
            <Chip
              clickable
              label={
                <Stack direction="row" alignItems="center" gap={0.2}>
                  {`${childDoneCount}/${children.length}`}
                  <ExpandMore
                    sx={{
                      fontSize: 12,
                      transform: childrenOpen ? "rotate(180deg)" : "none",
                      transition: "transform 0.15s ease",
                    }}
                  />
                </Stack>
              }
              size="small"
              variant="outlined"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                onToggleExpanded(taskId);
              }}
              sx={{
                height: 17,
                flexShrink: 0,
                fontSize: "0.55rem",
                color: "text.secondary",
                borderColor: "#cbd5e1",
                bgcolor: "#ffffff",
                "& .MuiChip-label": { px: 0.5 },
              }}
            />
          </Tooltip>
        )}

        {dueDate && (
          <Stack direction="row" alignItems="center" gap={0.25} sx={{ flexShrink: 0 }}>
            <AccessTime sx={{ fontSize: 11, color: "text.secondary" }} />
            <Typography variant="caption" color="text.secondary" noWrap sx={{ fontSize: "0.6rem" }}>
              {formatUiDate(dueDate, "")}
            </Typography>
          </Stack>
        )}

        {priorityLabel && (
          <Chip
            label={priorityLabel}
            size="small"
            variant="outlined"
            sx={{
              ...getTaskPriorityChipSx(task?.priority, { height: 16, fontSize: "0.53rem" }),
              flexShrink: 0,
              "& .MuiChip-label": { px: 0.6, lineHeight: 1 },
            }}
          />
        )}

        {assigneeLabel ? (
          <Tooltip title={assigneeLabel}>
            <Avatar
              sx={{ width: 16, height: 16, flexShrink: 0, fontSize: "0.5rem", bgcolor: "#e5e7eb", color: "#4b5563" }}
            >
              {getAssigneeInitials(assigneeLabel)}
            </Avatar>
          </Tooltip>
        ) : null}
      </Box>

      {canNest && (
        <Collapse in={childrenOpen} unmountOnExit>
          <Stack gap={0.5} sx={{ mt: 0.5, pl: 1.25, borderLeft: "1px solid #e4e8ee", ml: 0.75 }}>
            {children.map((child) => (
              <SubtaskRow
                key={child.id}
                task={child}
                subtasksByParent={subtasksByParent}
                getAssigneeLabel={getAssigneeLabel}
                onOpenTask={onOpenTask}
                depth={depth + 1}
                ancestorIds={nextAncestorIds}
                ancestorTasks={nextAncestorTasks}
                expandedIds={expandedIds}
                onToggleExpanded={onToggleExpanded}
              />
            ))}
          </Stack>
        </Collapse>
      )}
    </Box>
  );
};

const TaskCard = memo(function TaskCard({
  task,
  attachmentCount,
  assigneeLabel,
  onOpenTask,
  subtasks,
  subtasksByParent,
  getAssigneeLabel,
}: {
  task: any;
  attachmentCount: number;
  assigneeLabel: string;
  onOpenTask?: (task: any, trail?: any[]) => void;
  subtasks: any[];
  subtasksByParent: Record<string, any[]>;
  getAssigneeLabel: (value: any) => string;
}) {
  // Starts closed on every card, per spec. Local state, so a card that moves
  // columns remounts and collapses again.
  const [subtasksOpen, setSubtasksOpen] = useState(false);
  // Which nested rows are open. Held here rather than in each row so the card's
  // own chip can expand or collapse the entire tree in one click.
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(() => new Set<string>());
  const subtaskDoneCount = subtasks.filter(isTaskComplete).length;

  // Seeded with this card's own id so a subtask pointing back at it is dropped
  // rather than recursing forever.
  const rootAncestorIds = useMemo(() => new Set([String(task.id)]), [task.id]);

  // Every trail out of this card starts at the card's own task.
  const rootAncestorTasks = useMemo(() => [task], [task]);

  const handleToggleCardSubtasks = () => {
    const nextOpen = !subtasksOpen;
    setSubtasksOpen(nextOpen);
    // Opening the card opens every nested dropdown beneath it; closing resets
    // them, so the next open starts fully expanded again.
    setExpandedIds(nextOpen ? new Set(collectDescendantIds(String(task.id), subtasksByParent)) : new Set<string>());
  };

  const handleToggleExpanded = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: String(task.id),
    data: { type: "task", taskId: task.id },
  });

  const style = {
    transform: transform ? `translate3d(${Math.round(transform.x)}px, ${Math.round(transform.y)}px, 0)` : undefined,
    opacity: isDragging ? 0.45 : 1,
  };

  const priorityLabel = formatTaskPriorityLabel(task?.priority);

  const content = (
    <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1} sx={{ mb: 0.5 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }} noWrap>
          {onOpenTask ? (
            <Link
              component="button"
              type="button"
              underline="hover"
              color="inherit"
              onPointerDown={(event) => {
                event.stopPropagation();
              }}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onOpenTask(task);
              }}
              sx={{
                fontWeight: 700,
                textAlign: "left",
                textDecorationColor: "rgba(0, 0, 0, 0.35)",
              }}
            >
              {task.title}
            </Link>
          ) : (
            task.title
          )}
        </Typography>
        {task.progress !== null && task.progress !== undefined && (
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
            {task.progress}%
          </Typography>
        )}
      </Stack>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }} noWrap>
        {task.description || "No description"}
      </Typography>

      <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
        <Stack direction="row" alignItems="center" gap={0.8}>
          {priorityLabel && (
            <Chip
              label={priorityLabel}
              size="small"
              variant="outlined"
              sx={getTaskPriorityChipSx(task?.priority)}
            />
          )}
          {subtasks.length > 0 && (
            <Tooltip
              title={`${subtaskDoneCount} of ${subtasks.length} subtask${subtasks.length === 1 ? "" : "s"} done — click to ${
                subtasksOpen ? "hide" : "show"
              }`}
            >
              <Chip
                clickable
                icon={<AccountTree sx={{ fontSize: "0.72rem !important" }} />}
                label={
                  <Stack direction="row" alignItems="center" gap={0.2}>
                    {`${subtaskDoneCount}/${subtasks.length}`}
                    <ExpandMore
                      sx={{
                        fontSize: 13,
                        transform: subtasksOpen ? "rotate(180deg)" : "none",
                        transition: "transform 0.15s ease",
                      }}
                    />
                  </Stack>
                }
                size="small"
                variant="outlined"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  handleToggleCardSubtasks();
                }}
                sx={{ height: 21, fontSize: "0.64rem", color: "text.secondary", borderColor: "#cbd5e1" }}
              />
            </Tooltip>
          )}
          <Stack direction="row" alignItems="center" spacing={0.4}>
            <AccessTime sx={{ fontSize: 13, color: "text.secondary" }} />
            <Typography variant="caption" color="text.secondary">
              {formatShortDate(task.updated_end_date || task.end_date)}
            </Typography>
          </Stack>
          {attachmentCount > 0 && (
            <Chip
              icon={<AttachFile sx={{ fontSize: "0.72rem !important" }} />}
              label={attachmentCount}
              size="small"
              variant="outlined"
              sx={{ height: 21, fontSize: "0.64rem", color: "text.secondary", borderColor: "#cbd5e1" }}
            />
          )}
        </Stack>

        {assigneeLabel ? (
          <Stack direction="row" alignItems="center" gap={0.6}>
            <Avatar sx={{ width: 22, height: 22, fontSize: "0.62rem", bgcolor: "#e5e7eb", color: "#4b5563" }}>
              {getAssigneeInitials(assigneeLabel)}
            </Avatar>
            <Typography variant="caption" color="text.secondary" noWrap>
              {assigneeLabel}
            </Typography>
          </Stack>
        ) : null}
      </Stack>

      {subtasks.length > 0 && (
        <Collapse in={subtasksOpen} unmountOnExit>
          <Box sx={{ mt: 1, pt: 1, borderTop: "1px dashed #e2e8f0" }}>
            <Stack gap={0.5} sx={{ pl: 1.25, ml: 0.75, borderLeft: "1px solid #e4e8ee" }}>
              {subtasks.map((subtask) => (
                <SubtaskRow
                  key={subtask.id}
                  task={subtask}
                  subtasksByParent={subtasksByParent}
                  getAssigneeLabel={getAssigneeLabel}
                  onOpenTask={onOpenTask}
                  depth={1}
                  ancestorIds={rootAncestorIds}
                  ancestorTasks={rootAncestorTasks}
                  expandedIds={expandedIds}
                  onToggleExpanded={handleToggleExpanded}
                />
              ))}
            </Stack>
          </Box>
        </Collapse>
      )}
    </CardContent>
  );

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      draggable={false}
      onDragStart={(event) => {
        event.preventDefault();
      }}
      sx={{
        mb: 1.2,
        cursor: "grab",
        "&:active": { cursor: "grabbing" },
        touchAction: "none",
        userSelect: "none",
        WebkitUserSelect: "none",
        WebkitUserDrag: "none",
        willChange: "transform",
        border: "1px solid #d4d8df",
        boxShadow: "none",
        borderRadius: 1.75,
        bgcolor: "#ffffff",
      }}
    >
      {content}
    </Card>
  );
});
TaskCard.displayName = "TaskBoardCard";

const Column = ({
  columnKey,
  tasks,
  attachmentCounts,
  getAssigneeLabel,
  onOpenTask,
  subtasksByParent,
}: {
  columnKey: BoardStatusColumnKey;
  tasks: any[];
  attachmentCounts: Record<string, number>;
  getAssigneeLabel: (value: any) => string;
  onOpenTask?: (task: any, trail?: any[]) => void;
  subtasksByParent: Record<string, any[]>;
}) => {
  const meta = COLUMN_META[columnKey];
  const { setNodeRef, isOver } = useDroppable({
    id: columnKey,
    data: { type: "column", status: columnKey },
    disabled: !meta.canDrop,
  });

  return (
    <Paper
      ref={setNodeRef}
      sx={{
        p: 1.2,
        width: "100%",
        minWidth: 0,
        minHeight: 520,
        bgcolor: "#f5f6f8",
        border: "1px solid",
        borderColor: meta.canDrop && isOver ? "#90caf9" : "#d9dde4",
        borderRadius: 2,
        boxShadow: meta.canDrop && isOver ? "inset 0 0 0 1px #90caf9" : "none",
        transition: "border-color 0.12s ease, box-shadow 0.12s ease",
      }}
    >
      <Stack direction="row" alignItems="center" gap={1} sx={{ pb: 1.2, mb: 1.2, borderBottom: "1px solid #dfe3e8" }}>
        <Chip
          label={meta.label}
          size="small"
          sx={getTaskStatusChipSx(meta.statusColorKey)}
        />
        <Typography variant="subtitle2" sx={{ fontWeight: 600, color: "text.secondary" }}>
          ({tasks.length})
        </Typography>
      </Stack>

      <Box sx={{ minHeight: 430 }}>
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            attachmentCount={attachmentCounts[String(task.id)] || 0}
            assigneeLabel={getAssigneeLabel(task.assigned_to)}
            onOpenTask={onOpenTask}
            subtasks={subtasksByParent[String(task.id)] || EMPTY_SUBTASKS}
            subtasksByParent={subtasksByParent}
            getAssigneeLabel={getAssigneeLabel}
          />
        ))}
      </Box>
    </Paper>
  );
};

export const TaskBoard = ({ projectId, filters, onOpenTask }: TaskBoardProps) => {
  const alert = (message: string) => {
    void modalAlert(message, "Notice");
  };
  const { data: user } = useGetIdentity();
  const [optimisticTasks, setOptimisticTasks] = useState<any[]>([]);
  const [pendingStatusByTaskId, setPendingStatusByTaskId] = useState<Record<string, string>>({});

  const { result, query: { isLoading, refetch } } = useList({
    resource: "tasks",
    filters: buildTaskFilters(projectId, filters) as any,
    sorters: buildTaskSorters(filters) as any,
    meta: { populate: ["assigned_to"] },
    pagination: { mode: "off" },
  });

  const fetchedTasks = result?.data || [];
  const sortedTasks = useMemo(
    () => sortTasksByFilters(fetchedTasks, filters),
    [fetchedTasks, filters.sortBy, filters.sortOrder]
  );
  const allTasks = sortedTasks;
  const tasks = optimisticTasks.length > 0 ? optimisticTasks : sortedTasks;
  const { result: usersResult } = useList({
    resource: "users",
    dataProviderName: "user",
    pagination: { mode: "off" },
  });
  const users = usersResult?.data || [];
  const userById = useMemo(() => {
    const map: Record<string, any> = {};
    users.forEach((u: any) => {
      if (u?.id != null) map[String(u.id)] = u;
    });
    return map;
  }, [users]);
  // Stable identity: TaskCard is memoized and now receives this as a prop.
  const getAssigneeLabel = useCallback(
    (value: any) => resolveAssigneeLabel(value, userById),
    [userById]
  );

  const attachmentTaskIds = useMemo(
    () => allTasks.map((task: any) => task.id),
    [allTasks]
  );
  const attachmentFilters = useMemo(
    () =>
      attachmentTaskIds.length > 0
        ? [{ field: "task_id", operator: "in", value: attachmentTaskIds }]
        : [],
    [attachmentTaskIds]
  );

  const { result: allAttachmentsResult } = useList({
    resource: "task_attachments",
    filters: attachmentFilters as any,
    pagination: { mode: "off" },
    queryOptions: {
      enabled: attachmentTaskIds.length > 0,
    },
  });
  const allAttachments = allAttachmentsResult?.data || [];
  const attachmentCounts = useMemo(
    () =>
      allAttachments.reduce((acc: Record<string, number>, attachment: any) => {
        const taskId = String(attachment.task_id);
        acc[taskId] = (acc[taskId] || 0) + 1;
        return acc;
      }, {}),
    [allAttachments]
  );

  // Subtasks are not cards of their own — they render inside their parent's
  // card. `tasks` stays the full set because the drag guard and the optimistic
  // reconciliation below both need to see subtasks.
  const subtasksByParent = useMemo(() => {
    return tasks.reduce((acc: Record<string, any[]>, task: any) => {
      const parentId = getParentId(task);
      if (!parentId) return acc;
      (acc[parentId] = acc[parentId] || []).push(task);
      return acc;
    }, {});
  }, [tasks]);

  // Filters (search, priority, assignee) run on the backend, so a subtask can
  // come back without its parent. Promote those to their own card rather than
  // dropping them — same as the list view does.
  const topLevelTasks = useMemo(() => {
    const idSet = new Set(tasks.map((task: any) => String(task.id)));
    return tasks.filter((task: any) => {
      const parentId = getParentId(task);
      return !parentId || !idSet.has(parentId);
    });
  }, [tasks]);

  const tasksByColumn = useMemo(() => {
    return COLUMN_ORDER.reduce((acc, columnKey) => {
      acc[columnKey] = topLevelTasks.filter((task: any) => getBoardColumnForTask(task) === columnKey);
      return acc;
    }, {} as Record<BoardStatusColumnKey, any[]>);
  }, [topLevelTasks]);

  const { mutate: updateTask } = useUpdate();
  const { mutate: createActivity } = useCreate();

  useEffect(() => {
    const pendingEntries = Object.entries(pendingStatusByTaskId);
    if (pendingEntries.length === 0) {
      if (optimisticTasks.length > 0) setOptimisticTasks([]);
      return;
    }

    const fetchedStatusByTaskId = sortedTasks.reduce((acc: Record<string, string>, task: any) => {
      acc[String(task.id)] = normalizeStatus(task?.status);
      return acc;
    }, {});

    const unresolvedPending = pendingEntries.reduce((acc: Record<string, string>, [taskId, expectedStatus]) => {
      const fetchedStatus = fetchedStatusByTaskId[taskId];
      if (normalizeStatus(fetchedStatus) !== normalizeStatus(expectedStatus)) {
        acc[taskId] = expectedStatus;
      }
      return acc;
    }, {});

    const unresolvedCount = Object.keys(unresolvedPending).length;
    if (unresolvedCount === 0) {
      if (pendingEntries.length > 0) setPendingStatusByTaskId({});
      setOptimisticTasks([]);
      return;
    }

    const nextOptimisticTasks = sortedTasks.map((task: any) => {
      const taskId = String(task.id);
      const pendingStatus = unresolvedPending[taskId];
      return pendingStatus ? { ...task, status: pendingStatus } : task;
    });

    if (!areStatusMapsEqual(pendingStatusByTaskId, unresolvedPending)) {
      setPendingStatusByTaskId(unresolvedPending);
    }
    setOptimisticTasks(nextOptimisticTasks);
  }, [pendingStatusByTaskId, sortedTasks, optimisticTasks.length]);

  const sensors = useSensors(
    useSensor(PointerSensor)
  );

  const getColumnFromDropTarget = (targetId: string): BoardStatusColumnKey | null => {
    if (COLUMN_ORDER.includes(targetId as BoardStatusColumnKey)) return targetId as BoardStatusColumnKey;
    const targetTask = tasks.find((task: any) => String(task.id) === targetId);
    if (!targetTask) return null;
    return getBoardColumnForTask(targetTask);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const targetColumn = getColumnFromDropTarget(String(over.id));
    if (!targetColumn || !DROP_COLUMNS.includes(targetColumn)) return;

    const newStatus = getPersistedStatusFromColumn(targetColumn);
    const task = tasks.find((rowTask: any) => String(rowTask.id) === activeId);
    if (!task) return;
    const taskId = task.id;

    if (
      newStatus === "done" &&
      tasks.some(
        (rowTask: any) =>
          rowTask.parent_task_id !== null &&
          rowTask.parent_task_id !== undefined &&
          rowTask.parent_task_id !== "" &&
          String(rowTask.parent_task_id) === String(taskId) &&
          !isTaskComplete(rowTask)
      )
    ) {
      alert("Cannot mark parent task as done while a child task is not done.");
      return;
    }

    if (normalizeStatus(task.status) === normalizeStatus(newStatus)) return;
    const oldStatus = task.status;
    const taskIdStr = String(taskId);

    const mappedProgress = getProgressForStatus(newStatus, task.progress);

    const updatedTasks = tasks.map((rowTask: any) =>
      String(rowTask.id) === activeId
        ? { ...rowTask, status: newStatus, ...(mappedProgress !== null ? { progress: mappedProgress } : {}) }
        : rowTask
    );
    setOptimisticTasks(updatedTasks);
    setPendingStatusByTaskId((prev) => ({ ...prev, [taskIdStr]: newStatus }));

    updateTask(
      {
        resource: "tasks",
        id: taskId,
        values: { status: newStatus, ...(mappedProgress !== null ? { progress: mappedProgress } : {}) },
      },
      {
        onSuccess: () => {
          if (user?.id) {
            createActivity(
              {
                resource: "task_activities",
                values: {
                  task_id: taskId,
                  user_id: user.id,
                  action: "Updated status",
                  field_name: "Status",
                  old_value: formatTaskStatusLabel(oldStatus),
                  new_value: formatTaskStatusLabel(newStatus),
                  comment: "Status changed via board",
                  created_at: new Date().toISOString(),
                },
                successNotification: false,
              },
              {
                onError: (error) => console.warn("Failed to log activity:", error),
              }
            );
          }
          void refetch();
        },
        onError: (error) => {
          console.error("Failed to update task:", error);
          setPendingStatusByTaskId((prev) => {
            const next = { ...prev };
            delete next[taskIdStr];
            return next;
          });
          setOptimisticTasks([]);
          void refetch();
        },
      }
    );
  };

  if (isLoading) return <div>Loading...</div>;

  return (
    <DndContext
      collisionDetection={pointerWithin}
      onDragEnd={handleDragEnd}
      sensors={sensors}
      accessibility={{
        screenReaderInstructions: {
          draggable: "",
        },
        announcements: {
          onDragStart: () => "",
          onDragOver: () => "",
          onDragEnd: () => "",
          onDragCancel: () => "",
        },
      }}
    >
      <Box
        sx={{
          width: "100%",
          maxWidth: "100%",
          overflowX: "auto",
          pb: 2,
        }}
      >
        <Box
          sx={{
            display: "grid",
            gap: { xs: 1, md: 1.5 },
            px: { xs: 0.5, md: 1.5, lg: 2.5 },
            width: "100%",
            minWidth: { xs: 900, md: 1080 },
            gridTemplateColumns: `repeat(${COLUMN_ORDER.length}, minmax(0, 1fr))`,
            alignItems: "start",
          }}
        >
          {COLUMN_ORDER.map((columnKey) => (
            <Column
              key={columnKey}
              columnKey={columnKey}
              tasks={tasksByColumn[columnKey]}
              attachmentCounts={attachmentCounts}
              getAssigneeLabel={getAssigneeLabel}
              onOpenTask={onOpenTask}
              subtasksByParent={subtasksByParent}
            />
          ))}
        </Box>
      </Box>

    </DndContext>
  );
};
