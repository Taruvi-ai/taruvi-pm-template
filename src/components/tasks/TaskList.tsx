import { useList, useCreate, useUpdate, useDelete, useGetIdentity, useDataProvider, useNotification } from "@refinedev/core";
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  MenuItem,
  Stack,
  IconButton,
  Collapse,
  Chip,
  Autocomplete,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  List,
  ListItem,
  ListItemText,
  Avatar,
  CircularProgress,
  LinearProgress,
  Link,
  Tooltip,
} from "@mui/material";
import {
  ExpandMore,
  ExpandLess,
  Edit,
  Delete,
  Visibility,
  AttachFile,
  Download,
  Close,
  Check,
  Email,
  AccountTree,
  CheckCircle,
  RadioButtonUnchecked,
  SubdirectoryArrowRight,
  ArrowBack,
  ArrowUpward,
} from "@mui/icons-material";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState, type ForwardedRef } from "react";
import { useForm, Controller } from "react-hook-form";
import { buildTaskFilters, buildTaskSorters, sortTasksByFilters, type TaskFilters } from "./taskFilters";
import { RichTextEditor } from "./RichTextEditor";
import { TaskActivityHtmlPreviewDialog } from "./TaskActivityHtmlPreviewDialog";
import { useObserverUserOptions } from "../../hooks/useObserverUserOptions";
import {
  PROJECT_TASK_PRIORITY_CHIP_SX,
  TASK_STATUS_ORDER,
  formatTaskPriorityLabel,
  formatTaskStatusLabel,
  getTaskInfoChipSx,
  getTaskPriorityChipSx,
  getTaskStatusChipSx,
  getTaskStatusColor,
  getProgressForStatus,
  isDoneTaskStatus,
} from "../../utils/taskVisuals";
import { formatUiDate } from "../../utils/dateFormat";
import { sanitizeRichText } from "../../utils/sanitizeHtml";
import { normalizeProjectStatus } from "../../utils/projectVisuals";
import { compareActivitiesDesc, formatActivityTimestamp } from "../../utils/activityTimeline";
import { isProjectVisibleToUser } from "../../utils/projectAccess";
import { resolveUserId, resolveUser, getAssigneeLabel as resolveAssigneeLabel, formatUserLabel, filterUserOptionsByLabel, getUserInitials, extractIdentityId } from "../../utils/userResolver";
import { modalAlert, modalConfirm } from "../dialogs/globalDialogs";
import {
  ADDITIONAL_INFO_ACTIVITY_LABEL,
  isAdditionalInfoActivityField,
  normalizeAdditionalInfoActivityValue,
} from "../../utils/taskActivityRichText";

export interface TaskListHandle {
  openCreateTask: () => void;
  openTask: (taskOrId: any, options?: { trail?: any[] }) => void;
  editTask: (task: any) => void;
}

interface TaskListProps {
  projectId?: string | number | null;
  filters: TaskFilters;
  showList?: boolean;
  initialExpandedStatus?: string | null;
  initialOpenTaskId?: string | null;
  forceProjectPickerOnCreate?: boolean;
}

const statusOrder = TASK_STATUS_ORDER;
const TASK_DESCRIPTION_MAX_LENGTH = 500;
const TASK_ADDITIONAL_NOTES_MAX_LENGTH = 1000;
// Subtask rows line their chips up by reserving whitespace rather than by
// resizing the chips: a row with no priority still holds an empty slot of the
// same width, and the status chip sits in a right-aligned slot with a minimum
// width. The slot is a minimum so long labels ("IN PROGRESS") keep their
// natural size instead of being clipped.
const SUBTASK_PRIORITY_SLOT_WIDTH = PROJECT_TASK_PRIORITY_CHIP_SX.width;
const SUBTASK_STATUS_SLOT_MIN_WIDTH = "14ch";

// A long subtask list scrolls within itself rather than stretching the details
// dialog, so the fields and comments below it stay reachable. Roughly six rows
// before the scrollbar appears.
const SUBTASK_LIST_MAX_HEIGHT = 340;

const TASK_ACTIVITY_FIELD_LABELS: Record<string, string> = {
  title: "Title",
  description: "Description",
  additional_notes: ADDITIONAL_INFO_ACTIVITY_LABEL,
  parent_task_id: "Parent Task",
  status: "Status",
  priority: "Priority",
  start_date: "Start Date",
  end_date: "End Date",
  updated_end_date: "Updated End Date",
  assigned_to: "Assigned To",
  progress: "Progress",
  time_spent: "Time Spent",
};

// Parse a stored "H:MM" time_spent string into hours/minutes for the edit form.
const parseTimeSpent = (value?: string): { hours: number; minutes: number } => {
  const str = String(value ?? "").trim();
  if (!str) return { hours: 0, minutes: 0 };
  const [rawHours, rawMinutes] = str.split(":");
  let hours = Math.floor(Number(rawHours));
  let minutes = Math.floor(Number(rawMinutes));
  if (!Number.isFinite(hours) || hours < 0) hours = 0;
  if (!Number.isFinite(minutes) || minutes < 0) minutes = 0;
  if (minutes > 59) minutes = 59;
  return { hours, minutes };
};

const isTaskDelayed = (task: any) => {
  if (isDoneTaskStatus(task?.status)) return false;
  const deadline = task.updated_end_date || task.end_date;
  if (!deadline) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deadlineDate = new Date(`${deadline}T00:00:00`);
  return deadlineDate.getTime() < today.getTime();
};

const getTaskDateValidationError = (values: {
  start_date?: string;
  end_date?: string;
  updated_end_date?: string;
}) => {
  const startDate = String(values.start_date || "").trim();
  const endDate = String(values.end_date || "").trim();
  const updatedEndDate = String(values.updated_end_date || "").trim();

  if (startDate && endDate && endDate < startDate) {
    return "End Date cannot be earlier than Start Date.";
  }
  if (startDate && updatedEndDate && updatedEndDate < startDate) {
    return "Updated End Date cannot be earlier than Start Date.";
  }
  return null;
};

const getRichTextPlainLength = (value?: string) => {
  const html = String(value || "");
  if (!html.trim()) return 0;
  if (typeof window !== "undefined" && typeof window.DOMParser !== "undefined") {
    const parsed = new window.DOMParser().parseFromString(html, "text/html");
    return String(parsed.body.textContent || "").trim().length;
  }
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().length;
};

interface TaskFormValues {
  project_id?: string | number | null;
  title?: string;
  description?: string;
  parent_task_id?: string | number | null;
  status?: "todo" | "in_progress" | "review" | "done";
  priority?: "low" | "medium" | "high" | "critical" | "urgent";
  start_date?: string;
  end_date?: string;
  updated_end_date?: string;
  progress?: number;
  assigned_to?: string | number | null;
  additional_notes?: string;
  time_spent?: string;
  time_spent_hours?: number;
  time_spent_minutes?: number;
}

export const TaskList = forwardRef(function TaskList(
  { projectId, filters, showList = true, initialExpandedStatus = null, initialOpenTaskId = null, forceProjectPickerOnCreate = false }: TaskListProps,
  ref: ForwardedRef<TaskListHandle>
) {
  const alert = (message: string) => {
    void modalAlert(message, "Notice");
  };
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<any>(null);
  const [viewingTask, setViewingTask] = useState<any>(null);
  // Breadcrumb of tasks drilled through to reach `viewingTask`. Pushed when a
  // subtask (or parent link) is opened from inside the dialog, popped by Back.
  const [viewingTaskStack, setViewingTaskStack] = useState<any[]>([]);
  const [hasCommentDraft, setHasCommentDraft] = useState(false);
  const [activityPreview, setActivityPreview] = useState<{ html: string; title: string } | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [isSendingReminder, setIsSendingReminder] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<File[]>([]);
  const [attachmentsAccordionExpanded, setAttachmentsAccordionExpanded] = useState(false);
  const [isSavingTask, setIsSavingTask] = useState(false);
  const [collapsedStatuses, setCollapsedStatuses] = useState<Record<string, boolean>>({});
  const [expandedParents, setExpandedParents] = useState<Record<string, boolean>>({});
  const [additionalNotesLimitError, setAdditionalNotesLimitError] = useState("");
  const [assigneeSearchText, setAssigneeSearchText] = useState("");
  const assigneeSearchDebounceRef = useRef<number | null>(null);
  const submitLockRef = useRef(false);
  const lastAppliedExpandedStatusRef = useRef<string | null>(null);
  const lastOpenedInitialTaskIdRef = useRef<string | null>(null);
  const formDialogContentRef = useRef<HTMLDivElement | null>(null);
  const newCommentInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const activityListRef = useRef<HTMLUListElement | null>(null);
  const attachmentDeleteConfirmLockRef = useRef(false);
  const hasCommentDraftRef = useRef(false);
  const shouldLoadListData = showList || !!showForm || !!editingTask;
  const shouldLoadTaskData = shouldLoadListData || !!viewingTask;

  const { data: user } = useGetIdentity();
  const dataProvider = useDataProvider();
  const { open: openNotification } = useNotification();

  const identityUserId = extractIdentityId(user);

  const { result, query: { isLoading, refetch } } = useList({
    resource: "tasks",
    filters: buildTaskFilters(projectId, filters) as any,
    sorters: buildTaskSorters(filters) as any,
    meta: { populate: ["assigned_to"] },
    pagination: { mode: "off" },
    queryOptions: {
      enabled: shouldLoadListData,
    },
  });

  const fetchedTasks = result?.data || [];
  const allTasks = useMemo(
    () => sortTasksByFilters(fetchedTasks, filters),
    [fetchedTasks, filters.sortBy, filters.sortOrder]
  );
  const scopedProjectId = useMemo(() => {
    if (projectId === null || projectId === undefined || String(projectId).trim() === "") return null;
    return String(projectId);
  }, [projectId]);
  const useScopedProjectOnCreate = scopedProjectId !== null && !forceProjectPickerOnCreate;
  const cascadeTaskFilters = useMemo(
    () => (scopedProjectId !== null ? [{ field: "project_id", operator: "eq", value: scopedProjectId }] : []),
    [scopedProjectId]
  );
  const { result: cascadeTasksResult, query: cascadeTasksQuery } = useList({
    resource: "tasks",
    filters: cascadeTaskFilters as any,
    pagination: { mode: "off" },
    queryOptions: {
      enabled: shouldLoadListData,
    },
  });
  const { result: projectsResult } = useList({
    resource: "projects",
    pagination: { mode: "off" },
    queryOptions: {
      enabled: shouldLoadTaskData,
    },
  });

  const cascadeTasks = cascadeTasksResult?.data || allTasks;

  // The Activity & Comments panel is shared by the view dialog and the edit
  // dialog. Whichever task is active drives which comments are shown/added.
  const commentsTask = viewingTask || editingTask;

  // Activities for all tasks are fetched on-demand during delete (see fetchActivitiesForTaskIds)
  // instead of eagerly to avoid a massive task_id__in query on every render.

  const { result: activitiesResult, query: { refetch: refetchActivities } } = useList({
    resource: "task_activities",
    filters: commentsTask ? [{ field: "task_id", operator: "eq", value: commentsTask.id }] : [],
    sorters: [{ field: "created_at", order: "desc" }],
    meta: { populate: ["user_id"] },
    pagination: { mode: "off" },
    queryOptions: {
      enabled: !!commentsTask,
    },
  });

  const activeAttachmentTaskId = editingTask?.id ?? viewingTask?.id ?? null;
  const { result: attachmentsResult, query: { refetch: refetchAttachments, isLoading: isAttachmentsLoading } } = useList({
    resource: "task_attachments",
    filters: activeAttachmentTaskId ? [{ field: "task_id", operator: "eq", value: activeAttachmentTaskId }] : [],
    sorters: [{ field: "created_at", order: "desc" }],
    meta: { populate: ["storage_object_id"] },
    pagination: { mode: "off" },
    queryOptions: {
      enabled: !!activeAttachmentTaskId,
    },
  });

  const { mutate: createTask } = useCreate();
  const { mutate: updateTask } = useUpdate();
  const { mutate: createActivity } = useCreate();
  const { mutate: sendTaskAssignmentEmail } = useCreate();
  const { mutate: deleteAttachment } = useDelete();
  const { mutate: deleteStorageFile } = useDelete();

  const syncCommentDraft = (nextHasText: boolean) => {
    if (hasCommentDraftRef.current === nextHasText) return;
    hasCommentDraftRef.current = nextHasText;
    setHasCommentDraft(nextHasText);
  };

  const clearCommentDraft = () => {
    if (newCommentInputRef.current) {
      newCommentInputRef.current.value = "";
    }
    syncCommentDraft(false);
  };

  const { register, handleSubmit, control, reset, watch, setValue, getValues, formState: { errors } } = useForm<TaskFormValues>({
    defaultValues: {
      progress: 0,
      start_date: new Date().toISOString().slice(0, 10),
    },
  });
  const watchedAssignedTo = watch("assigned_to");
  const isDoneStatusLockedEdit = !!editingTask && isDoneTaskStatus(editingTask?.status);
  const selectedAssigneeUserIds = useMemo(() => {
    const resolvedId = resolveUserId(watchedAssignedTo);
    return resolvedId !== null && resolvedId !== undefined ? [String(resolvedId)] : [];
  }, [watchedAssignedTo]);

  const projects = projectsResult?.data || [];
  const projectById = projects.reduce((acc: Record<string, any>, project: any) => {
    acc[String(project.id)] = project;
    return acc;
  }, {});
  const currentUserId = identityUserId ?? null;
  const { result: employeeResult } = useList({
    resource: "org_employees",
    filters: currentUserId ? [{ field: "user_id", operator: "eq", value: currentUserId }] : [],
    pagination: { mode: "off" },
    queryOptions: { enabled: shouldLoadListData && !!currentUserId },
  });
  const employee = employeeResult?.data?.[0];
  const { result: teamMembersResult } = useList({
    resource: "org_team_members",
    filters: employee?.id ? [{ field: "employee_id", operator: "eq", value: employee.id }] : [],
    pagination: { mode: "off" },
    queryOptions: { enabled: shouldLoadListData && !!employee?.id },
  });
  const { result: projectDepartmentsResult } = useList({
    resource: "project_departments",
    pagination: { mode: "off" },
    queryOptions: { enabled: shouldLoadListData },
  });
  const { result: projectTeamsResult } = useList({
    resource: "project_teams",
    pagination: { mode: "off" },
    queryOptions: { enabled: shouldLoadListData },
  });
  const { result: projectObserversResult } = useList({
    resource: "project_observers",
    pagination: { mode: "off" },
    queryOptions: { enabled: shouldLoadListData },
  });
  const userDepartmentId = employee?.department_id ?? null;
  const userTeamIds = useMemo(
    () => (teamMembersResult?.data || []).map((m: any) => m.team_id),
    [teamMembersResult?.data]
  );
  const departmentIdsByProject = useMemo(
    () =>
      (projectDepartmentsResult?.data || []).reduce((acc: Record<string, string[]>, row: any) => {
        const projectKey = String(row.project_id);
        if (!acc[projectKey]) acc[projectKey] = [];
        acc[projectKey].push(String(row.department_id));
        return acc;
      }, {}),
    [projectDepartmentsResult?.data]
  );
  const teamIdsByProject = useMemo(
    () =>
      (projectTeamsResult?.data || []).reduce((acc: Record<string, string[]>, row: any) => {
        const projectKey = String(row.project_id);
        if (!acc[projectKey]) acc[projectKey] = [];
        acc[projectKey].push(String(row.team_id));
        return acc;
      }, {}),
    [projectTeamsResult?.data]
  );
  const observerUserIdsByProject = useMemo(
    () =>
      (projectObserversResult?.data || []).reduce((acc: Record<string, string[]>, row: any) => {
        const projectKey = String(row.project_id);
        if (!acc[projectKey]) acc[projectKey] = [];
        acc[projectKey].push(String(row.user_id));
        return acc;
      }, {}),
    [projectObserversResult?.data]
  );
  const visibleProjects = useMemo(
    () =>
      projects.filter((project: any) =>
        isProjectVisibleToUser(project, userDepartmentId, userTeamIds, currentUserId, {
          departmentIdsByProject,
          teamIdsByProject,
          observerUserIdsByProject,
        })
      ),
    [
      projects,
      userDepartmentId,
      userTeamIds,
      currentUserId,
      departmentIdsByProject,
      teamIdsByProject,
      observerUserIdsByProject,
    ]
  );
  const seededAssigneeUsers = useMemo(() => {
    const seeded: any[] = [];

    const pushUser = (candidate: any) => {
      if (!candidate || typeof candidate !== "object") return;
      const candidateId = (candidate as any).id ?? (candidate as any).user_id;
      if (candidateId === null || candidateId === undefined || candidateId === "") return;
      seeded.push(candidate);
    };

    const identityId = extractIdentityId(user);
    if (identityId !== null && user && typeof user === "object") {
      seeded.push({ ...(user as any), id: identityId });
    }

    allTasks.forEach((task: any) => pushUser(task?.assigned_to));
    pushUser(editingTask?.assigned_to);
    pushUser(viewingTask?.assigned_to);
    (activitiesResult?.data || []).forEach((activity: any) => pushUser(activity?.user_id));

    const seen = new Set<string>();
    return seeded.filter((candidate: any) => {
      const key = String((candidate as any).id ?? (candidate as any).user_id);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [allTasks, editingTask, viewingTask, activitiesResult?.data, user]);
  const { options: assigneeOptions, isLoading: isAssigneeOptionsLoading } = useObserverUserOptions({
    searchText: assigneeSearchText,
    selectedUserIds: selectedAssigneeUserIds,
    initialUsers: seededAssigneeUsers,
    loadDefaultUsers: false,
  });
  const assigneeOptionsWithIdentity = useMemo(() => {
    const identityId = extractIdentityId(user);
    if (!identityId) return assigneeOptions;
    const identityOption = { ...(user as any), id: identityId };
    const merged = [identityOption, ...assigneeOptions];
    const seen = new Set<string>();
    return merged.filter((option: any) => {
      if (!option || option.id === null || option.id === undefined) return false;
      const key = String(option.id);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [assigneeOptions, user]);
  const userById = useMemo(() => {
    const map: Record<string, any> = {};
    const registerUser = (candidate: any) => {
      if (!candidate || typeof candidate !== "object") return;
      const candidateId = (candidate as any).id ?? (candidate as any).user_id;
      if (candidateId === null || candidateId === undefined || candidateId === "") return;
      map[String(candidateId)] = candidate;
    };
    seededAssigneeUsers.forEach(registerUser);
    assigneeOptionsWithIdentity.forEach(registerUser);
    return map;
  }, [seededAssigneeUsers, assigneeOptionsWithIdentity]);
  const getAssigneeLabel = (value: any) => resolveAssigneeLabel(value, userById);
  const resolveAssigneeId = (value: any) => resolveUserId(value);
  const resolveAssigneeUser = (value: any) => resolveUser(value, userById);
  const queueAssigneeSearch = (nextValue: string) => {
    if (assigneeSearchDebounceRef.current !== null) {
      window.clearTimeout(assigneeSearchDebounceRef.current);
    }
    assigneeSearchDebounceRef.current = window.setTimeout(() => {
      setAssigneeSearchText(nextValue);
      assigneeSearchDebounceRef.current = null;
    }, 220);
  };
  useEffect(() => {
    return () => {
      if (assigneeSearchDebounceRef.current !== null) {
        window.clearTimeout(assigneeSearchDebounceRef.current);
      }
    };
  }, []);
  useEffect(() => {
    if (!showForm || !!editingTask) return;
    if (currentUserId === null || currentUserId === undefined) return;
    const currentValue = getValues("assigned_to");
    const resolvedCurrentValue = resolveAssigneeId(currentValue);
    if (resolvedCurrentValue !== null && resolvedCurrentValue !== undefined) return;
    setValue("assigned_to", currentUserId);
  }, [showForm, editingTask, currentUserId, getValues, setValue]);
  const activeViewingTaskId = commentsTask ? String(commentsTask.id) : null;
  const activities = useMemo(
    () => {
      if (!activeViewingTaskId) return [];
      return (activitiesResult?.data || []).filter(
        (activity: any) => String(activity?.task_id?.id ?? activity?.task_id ?? "") === activeViewingTaskId
      );
    },
    [activeViewingTaskId, activitiesResult?.data]
  );
  const sortedActivities = useMemo(
    () => [...activities].sort(compareActivitiesDesc),
    [activities]
  );
  const chronologicalActivities = useMemo(
    () => [...sortedActivities].reverse(),
    [sortedActivities]
  );

  const attachments = viewingTask ? attachmentsResult?.data || [] : [];
  const editTaskAttachments = editingTask ? attachmentsResult?.data || [] : [];

  const normalizeComparableId = (value: any): string | null => {
    if (value === null || value === undefined || value === "") return null;
    if (typeof value === "object") {
      const nested = (value as any)?.id ?? (value as any)?.user_id;
      if (nested === null || nested === undefined || nested === "") return null;
      return String(nested);
    }
    const asNumber = Number(value);
    if (Number.isFinite(asNumber)) return String(asNumber);
    const trimmed = String(value).trim();
    return trimmed ? trimmed : null;
  };
  const getTaskCreatorId = (task: any) => {
    return normalizeComparableId(
      task?.created_by_id ??
      task?.created_by?.id ??
      task?.created_by?.user_id ??
      task?.created_by
    );
  };
  const canCurrentUserDeleteTask = (task: any) => {
    const creatorId = getTaskCreatorId(task);
    const actorId = normalizeComparableId(currentUserId);
    if (!creatorId || !actorId) return false;
    return creatorId === actorId;
  };
  const canCurrentUserMarkTaskDone = (task: any) => {
    const actorId = normalizeComparableId(currentUserId);
    const assigneeId = normalizeComparableId(task?.assigned_to);
    if (!actorId || !assigneeId) return false;
    return actorId === assigneeId;
  };
  const isViewingTaskAssignedToCurrentUser = useMemo(() => {
    const actorId = normalizeComparableId(currentUserId);
    const assigneeId = normalizeComparableId(viewingTask?.assigned_to);
    if (!actorId || !assigneeId) return false;
    return actorId === assigneeId;
  }, [currentUserId, viewingTask?.assigned_to]);
  const normalizeTaskRelationId = (value: any): string | number | null => {
    if (value === null || value === undefined || value === "") return null;
    if (typeof value === "object") {
      const nestedId = (value as any)?.id ?? (value as any)?.task_id;
      if (nestedId === null || nestedId === undefined || nestedId === "") return null;
      return normalizeTaskRelationId(nestedId);
    }
    if (typeof value === "string") {
      const trimmed = value.trim();
      return trimmed ? trimmed : null;
    }
    return value;
  };

  // Subtasks rendered inside the view dialog. These are fetched on their own
  // rather than reusing the list query so the section always shows every child
  // of the opened task - the list can be filtered down to a single status, or
  // the dialog can be opened by deep link with no list mounted at all.
  // Scoping to the task's project (instead of parent_task_id) lets us build the
  // whole descendant tree from one request.
  const viewingTaskProjectId = useMemo(
    () => normalizeTaskRelationId(viewingTask?.project_id),
    [viewingTask?.project_id]
  );
  const viewingTaskSubtaskFilters = useMemo(() => {
    if (viewingTaskProjectId !== null) {
      return [{ field: "project_id", operator: "eq", value: viewingTaskProjectId }];
    }
    if (viewingTask?.id) {
      return [{ field: "parent_task_id", operator: "eq", value: viewingTask.id }];
    }
    return [];
  }, [viewingTaskProjectId, viewingTask?.id]);
  const { result: viewingTaskSubtasksResult, query: { isLoading: isViewingTaskSubtasksLoading } } = useList({
    resource: "tasks",
    filters: viewingTaskSubtaskFilters as any,
    meta: { populate: ["assigned_to"] },
    pagination: { mode: "off" },
    queryOptions: {
      enabled: !!viewingTask?.id,
    },
  });

  // Flatten the descendants of the viewed task into indented rows. The `seen`
  // set doubles as a cycle guard so a bad parent link can't loop forever.
  const viewingTaskSubtaskRows = useMemo(() => {
    if (!viewingTask?.id) return [] as Array<{ task: any; level: number }>;
    const pool: any[] = viewingTaskSubtasksResult?.data || [];
    const childrenOf = pool.reduce((acc: Record<string, any[]>, task: any) => {
      const parentId = normalizeTaskRelationId(task.parent_task_id);
      if (parentId === null) return acc;
      const key = String(parentId);
      if (!acc[key]) acc[key] = [];
      acc[key].push(task);
      return acc;
    }, {});
    Object.values(childrenOf).forEach((children: any[]) => {
      children.sort((a: any, b: any) => {
        const aCreated = String(a?.created_at || "");
        const bCreated = String(b?.created_at || "");
        if (aCreated && bCreated && aCreated !== bCreated) return aCreated < bCreated ? -1 : 1;
        return String(a?.id ?? "").localeCompare(String(b?.id ?? ""), undefined, { numeric: true });
      });
    });

    const rows: Array<{ task: any; level: number }> = [];
    const seen = new Set<string>([String(viewingTask.id)]);
    const walk = (parentId: string | number, level: number) => {
      (childrenOf[String(parentId)] || []).forEach((child: any) => {
        const key = String(child.id);
        if (seen.has(key)) return;
        seen.add(key);
        rows.push({ task: child, level });
        walk(child.id, level + 1);
      });
    };
    walk(viewingTask.id, 0);
    return rows;
  }, [viewingTask?.id, viewingTaskSubtasksResult?.data]);

  const viewingTaskSubtaskStats = useMemo(() => {
    const total = viewingTaskSubtaskRows.length;
    const done = viewingTaskSubtaskRows.filter(({ task }) => isDoneTaskStatus(task?.status)).length;
    return { total, done, percent: total === 0 ? 0 : Math.round((done / total) * 100) };
  }, [viewingTaskSubtaskRows]);

  const getActivityFieldLabel = (fieldName: string): string => {
    if (TASK_ACTIVITY_FIELD_LABELS[fieldName]) return TASK_ACTIVITY_FIELD_LABELS[fieldName];
    return fieldName
      .split("_")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  };
  const formatActivityFieldValue = (fieldName: string, value: any): string => {
    if (fieldName === "parent_task_id") {
      const normalizedParentId = normalizeTaskRelationId(value);
      if (normalizedParentId === null) return "None";
      const parentTask = allTasks.find((task: any) => String(task.id) === String(normalizedParentId));
      return parentTask?.title || `Task #${normalizedParentId}`;
    }

    if (fieldName === "additional_notes") {
      if (value === null || value === undefined || value === "") return "";
      return String(value);
    }

    if (fieldName === "assigned_to") {
      const assigneeLabel = getAssigneeLabel(value);
      return assigneeLabel || "Unassigned";
    }

    if (fieldName === "status") {
      if (value === null || value === undefined || value === "") return "None";
      return formatTaskStatusLabel(String(value));
    }

    if (fieldName === "priority") {
      if (value === null || value === undefined || value === "") return "None";
      return formatTaskPriorityLabel(String(value));
    }

    if (fieldName === "progress") {
      if (value === null || value === undefined || value === "") return "None";
      const numericProgress = Number(value);
      return Number.isFinite(numericProgress) ? `${numericProgress}%` : String(value);
    }

    if (fieldName === "start_date" || fieldName === "end_date" || fieldName === "updated_end_date") {
      if (value === null || value === undefined || value === "") return "None";
      return formatUiDate(String(value), String(value));
    }

    if (value === null || value === undefined || value === "") return "None";
    if (typeof value === "object") {
      if ((value as any)?.title) return String((value as any).title);
      if ((value as any)?.name) return String((value as any).name);
      if ((value as any)?.id !== undefined && (value as any)?.id !== null) return `#${(value as any).id}`;
    }
    return String(value);
  };

  const getAssignee = (task: any) => {
    if (!task.assigned_to) return null;
    return resolveAssigneeUser(task.assigned_to);
  };
  const getActivityUser = (value: any) => {
    if (value === null || value === undefined || value === "") return null;
    if (typeof value === "object") return value;
    return userById[String(value)] || null;
  };

  // Title search is part of the backend query (see buildTaskFilters), so the
  // fetched set is already narrowed. Kept for the empty-state message only.
  const searchText = String(filters.search ?? "").trim();
  const visibleTasks = allTasks;
  const cascadeTaskById = useMemo(
    () =>
      cascadeTasks.reduce((acc: Record<string, any>, task: any) => {
        acc[String(task.id)] = task;
        return acc;
      }, {}),
    [cascadeTasks]
  );
  const cascadeChildrenByParent = useMemo(
    () =>
      cascadeTasks.reduce((acc: Record<string, any[]>, task: any) => {
        const parentId = task.parent_task_id;
        if (parentId !== null && parentId !== undefined && parentId !== "") {
          const key = String(parentId);
          if (!acc[key]) acc[key] = [];
          acc[key].push(task);
        }
        return acc;
      }, {}),
    [cascadeTasks]
  );
  const taskById = visibleTasks.reduce((acc: Record<string, any>, task: any) => {
    acc[String(task.id)] = task;
    return acc;
  }, {});

  // Resolve the viewed task's parent so the dialog can link to it even when the
  // task was opened cold - from the board, the gantt, or a filtered list - and
  // there is no navigation history to go back through.
  const viewingTaskParent = useMemo(() => {
    const parentId = normalizeTaskRelationId(viewingTask?.parent_task_id);
    if (parentId === null) return null;
    const rawParent = viewingTask?.parent_task_id;
    if (rawParent && typeof rawParent === "object" && rawParent.title) return rawParent;
    const key = String(parentId);
    const pool: any[] = viewingTaskSubtasksResult?.data || [];
    return (
      pool.find((task: any) => String(task.id) === key) ||
      cascadeTaskById[key] ||
      taskById[key] ||
      null
    );
  }, [viewingTask?.parent_task_id, viewingTaskSubtasksResult?.data, cascadeTaskById, taskById]);

  const childrenByParent = visibleTasks.reduce((acc: Record<string, any[]>, task: any) => {
    const parentId = task.parent_task_id;
    if (parentId !== null && parentId !== undefined && parentId !== "") {
      const key = String(parentId);
      if (!acc[key]) acc[key] = [];
      acc[key].push(task);
    }
    return acc;
  }, {});

  const topLevelTasks = visibleTasks.filter((task: any) => {
    if (task.parent_task_id === null || task.parent_task_id === undefined || task.parent_task_id === "") {
      return true;
    }
    return !taskById[String(task.parent_task_id)];
  });

  const delayedTasks = visibleTasks.filter((task: any) => isTaskDelayed(task));
  const delayedSectionTasks = delayedTasks;
  const nonDelayedTopLevelTasks = topLevelTasks.filter(
    (task: any) => !isTaskDelayed(task) || isDoneTaskStatus(task.status)
  );
  const tasksByStatus = [
    { status: "delayed", tasks: delayedSectionTasks },
    ...statusOrder.map((status) => ({
      status,
      tasks: nonDelayedTopLevelTasks.filter((t: any) => t.status === status),
    })),
  ];

  const toggleStatus = (status: string) => {
    setCollapsedStatuses((prev) => ({ ...prev, [status]: !prev[status] }));
  };

  useEffect(() => {
    const node = activityListRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [commentsTask?.id, chronologicalActivities.length]);

  useEffect(() => {
    const normalized = String(initialExpandedStatus || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_");
    if (!normalized) return;
    if (lastAppliedExpandedStatusRef.current === normalized) return;

    const statuses = ["delayed", ...statusOrder.map((status) => String(status))];
    if (!statuses.includes(normalized)) return;

    const next: Record<string, boolean> = {};
    statuses.forEach((status) => {
      next[status] = status !== normalized;
    });
    setCollapsedStatuses(next);
    lastAppliedExpandedStatusRef.current = normalized;
  }, [initialExpandedStatus]);

  useEffect(() => {
    const taskId = String(initialOpenTaskId || "").trim();
    if (!taskId || lastOpenedInitialTaskIdRef.current === taskId) return;
    const foundTask = allTasks.find((task: any) => String(task.id) === taskId);
    if (!foundTask) return;
    setViewingTaskStack([]);
    setViewingTask(foundTask);
    clearCommentDraft();
    lastOpenedInitialTaskIdRef.current = taskId;
  }, [initialOpenTaskId, allTasks]);

  const toggleParent = (taskId: string | number) => {
    setExpandedParents((prev) => {
      const key = String(taskId);
      const isExpanded = prev[key] ?? true;
      return { ...prev, [key]: !isExpanded };
    });
  };

  const hasIncompleteChildren = (taskId: string | number) => {
    const children = childrenByParent[String(taskId)] || [];
    return children.some((child: any) => child.status !== "done");
  };

  const onSubmit = (data: any) => {
    if (submitLockRef.current) return;
    console.log("onSubmit called with editingTask:", editingTask, "data:", data);
    const normalizedData = {
      ...data,
      parent_task_id: normalizeTaskRelationId(data.parent_task_id),
    };
    if (typeof normalizedData.additional_notes === "string") {
      normalizedData.additional_notes = sanitizeRichText(normalizedData.additional_notes);
    }
    // Combine the Hours/Minutes inputs into a single "H:MM" time_spent value.
    if (editingTask) {
      let tsHours = Math.floor(Number(data.time_spent_hours));
      let tsMinutes = Math.floor(Number(data.time_spent_minutes));
      if (!Number.isFinite(tsHours) || tsHours < 0) tsHours = 0;
      if (!Number.isFinite(tsMinutes) || tsMinutes < 0) tsMinutes = 0;
      if (tsMinutes > 59) tsMinutes = 59;
      normalizedData.time_spent = `${tsHours}:${String(tsMinutes).padStart(2, "0")}`;
    }
    delete normalizedData.time_spent_hours;
    delete normalizedData.time_spent_minutes;
    if (!isDoneStatusLockedEdit) {
      const dateValidationError = getTaskDateValidationError(normalizedData);
      if (dateValidationError) {
        alert(dateValidationError);
        return;
      }
      const descriptionLength = String(normalizedData.description || "").length;
      if (descriptionLength > TASK_DESCRIPTION_MAX_LENGTH) {
        alert(`Description cannot exceed ${TASK_DESCRIPTION_MAX_LENGTH} characters.`);
        return;
      }
      const additionalNotesLength = getRichTextPlainLength(normalizedData.additional_notes);
      if (additionalNotesLength > TASK_ADDITIONAL_NOTES_MAX_LENGTH) {
        alert(`Additional Notes cannot exceed ${TASK_ADDITIONAL_NOTES_MAX_LENGTH} characters.`);
        return;
      }
    }

    if (normalizedData.status === "done" && editingTask?.id && hasIncompleteChildren(editingTask.id)) {
      alert("Cannot mark parent task as done while a child task is not done.");
      return;
    }
    
    // Clean up the data - remove empty strings, null, and undefined values
    let cleanedData = Object.keys(normalizedData).reduce((acc: any, key) => {
      const value = normalizedData[key];
      if (key === "parent_task_id") {
        // Explicitly pass null when parent is cleared.
        acc[key] = value ?? null;
        return acc;
      }
      if (value !== '' && value !== null && value !== undefined) {
        acc[key] = value;
      }
      return acc;
    }, {});
    if (isDoneStatusLockedEdit) {
      const lockedStatus = String(normalizedData.status || editingTask?.status || "done");
      // Reopening a done task (e.g. -> To Do) should carry the progress % that
      // matches the new status, otherwise the task keeps its old 100% progress.
      // Statuses with no fixed % (On Hold) still get capped below 100 by
      // passing the current progress through.
      // Derive from the saved progress, not the form value: the Status field's
      // onChange has already lowered the form value, so re-reading it here
      // would look "not complete" and skip the update entirely.
      const mappedProgress = getProgressForStatus(lockedStatus, editingTask?.progress);
      cleanedData = {
        status: lockedStatus,
        ...(mappedProgress !== null ? { progress: mappedProgress } : {}),
      };
    }
    
    if ("id" in cleanedData) {
      delete (cleanedData as any).id;
    }
    if ("project_id" in cleanedData) {
      delete (cleanedData as any).project_id;
    }
    const normalizedProjectId = (value: any) => {
      if (value === null || value === undefined || value === "") return null;
      return String(value);
    };
    const editProjectId = normalizedProjectId(projectId ?? editingTask?.project_id);
    const taskData = {
      ...cleanedData,
      ...(editProjectId !== null ? { project_id: editProjectId } : {}),
    };
    const userId = currentUserId;
    
    // Check if we're editing (must have an ID)
    if (editingTask && editingTask.id) {
      console.log("Updating task with ID:", editingTask.id);
      const previousAssigneeId = normalizeComparableId(editingTask.assigned_to);
      const nextAssigneeId = normalizeComparableId(normalizedData.assigned_to);
      const shouldNotifyNewAssignee =
        !!nextAssigneeId &&
        previousAssigneeId !== nextAssigneeId &&
        !isDoneStatusLockedEdit;
      const nextAssigneeUser = shouldNotifyNewAssignee ? resolveAssigneeUser(normalizedData.assigned_to) : null;
      const nextAssigneeEmail = nextAssigneeUser?.email;
      const editSelectedProject = projectById[String(editProjectId ?? editingTask.project_id ?? "")];
      
      // Track what changed
      const changes: any[] = [];
      Object.keys(normalizedData).forEach(key => {
        const oldDisplayValue = formatActivityFieldValue(key, editingTask[key]);
        const newDisplayValue = formatActivityFieldValue(key, normalizedData[key]);
        if (oldDisplayValue === newDisplayValue) return;
        changes.push({
          field_name: getActivityFieldLabel(key),
          old_value: oldDisplayValue,
          new_value: newDisplayValue,
        });
      });

      submitLockRef.current = true;
      setIsSavingTask(true);
      updateTask(
        { resource: "tasks", id: editingTask.id, values: taskData },
        { 
          onSuccess: () => { 
            submitLockRef.current = false;
            setIsSavingTask(false);
            console.log("Task updated successfully");
            // Log activities for each change (optional)
            if (userId) {
              changes.forEach(change => {
                createActivity(
                  {
                    resource: "task_activities",
                    values: {
                      task_id: editingTask.id,
                      user_id: userId,
                      action: "Updated",
                      created_at: new Date().toISOString(),
                      ...change,
                    },
                    successNotification: false,
                  },
                  {
                    onError: (error) => console.warn("Failed to log activity:", error),
                  }
                );
              });
            }

            if (shouldNotifyNewAssignee && nextAssigneeEmail) {
              sendTaskAssignmentEmail(
                {
                  resource: "send-task-assignment-email",
                  values: {
                    task_id: editingTask.id,
                    template_key: "task_reassigned",
                    to_email: nextAssigneeEmail,
                    app_base_url: window.location.origin,
                    context: {
                      assignee_name: getAssigneeLabel(normalizedData.assigned_to),
                      created_by: formatUserLabel(user),
                      project_name: editSelectedProject?.name || "",
                    },
                  },
                  dataProviderName: "functions",
                  successNotification: false,
                  errorNotification: false,
                },
                {
                  onError: (error) => console.warn("Failed to send task reassignment email:", error),
                }
              );
            } else if (shouldNotifyNewAssignee && !nextAssigneeEmail) {
              console.warn("Task reassignment email skipped because assignee email is unavailable.");
            }
            
            reset(); 
            setEditingTask(null);
            setAttachmentsAccordionExpanded(false);
            setShowForm(false); 
            refetch(); 
          },
          onError: (error: any) => {
            submitLockRef.current = false;
            setIsSavingTask(false);
            console.error("Failed to update task:", error);
            alert("Failed to update task: " + (error?.message || "Unknown error"));
          }
        }
      );
    } else {
      console.log("Creating new task");
      const createProjectId = normalizedProjectId(normalizedData.project_id ?? projectId);
      if (createProjectId === null) {
        alert("Cannot create a task without a project.");
        return;
      }
      const selectedProject = projectById[String(createProjectId)];
      const projectStatus = normalizeProjectStatus(selectedProject?.status);
      if (projectStatus === "completed" || projectStatus === "complete") {
        alert("Cannot create tasks for a completed project.");
        return;
      }
      if (projectStatus === "cancelled") {
        alert("Cannot create tasks for a cancelled project.");
        return;
      }
      const createTaskData = {
        ...cleanedData,
        project_id: createProjectId,
        ...(userId !== null ? { created_by_id: userId } : {}),
      };
      submitLockRef.current = true;
      setIsSavingTask(true);
      
      createTask(
        { resource: "tasks", values: createTaskData },
        { 
          onSuccess: (response: any) => { 
            submitLockRef.current = false;
            setIsSavingTask(false);
            // Extract task ID from response - handle different response structures
            let taskId = null;
            
            if (response?.data?.id) {
              taskId = response.data.id;
            } else if (response?.id) {
              taskId = response.id;
            } else if (response?.data?.data?.id) {
              taskId = response.data.data.id;
            } else if (Array.isArray(response?.data?.data) && response.data.data.length > 0) {
              taskId = response.data.data[0].id;
            } else if (Array.isArray(response?.data) && response.data.length > 0) {
              taskId = response.data[0].id;
            }
            
            if (taskId) {
              uploadPendingAttachments(taskId);
            }

            if (taskId && createTaskData.assigned_to) {
              const assigneeUser = resolveAssigneeUser(createTaskData.assigned_to);
              const assigneeEmail = assigneeUser?.email;
              sendTaskAssignmentEmail(
                {
                  resource: "send-task-assignment-email",
                  values: {
                    task_id: taskId,
                    to_email: assigneeEmail,
                    app_base_url: window.location.origin,
                    context: {
                      assignee_name: getAssigneeLabel(createTaskData.assigned_to),
                      created_by: formatUserLabel(user),
                      project_name: selectedProject?.name || "",
                    },
                  },
                  dataProviderName: "functions",
                  successNotification: false,
                  errorNotification: false,
                },
                {
                  onError: (error) => console.warn("Failed to send task assignment email:", error),
                }
              );
            }

            // Always close the form and refresh
            reset(); 
            setAttachmentsAccordionExpanded(false);
            setShowForm(false); 
            refetch();
            
            // Log task creation activity (optional)
            if (userId && taskId) {
              createActivity(
                {
                  resource: "task_activities",
                  values: {
                    task_id: taskId,
                    user_id: userId,
                    action: "Created task",
                    comment: "Task created",
                    created_at: new Date().toISOString(),
                  },
                  successNotification: false,
                },
                {
                  onError: (error) => console.warn("Failed to log activity:", error),
                }
              );
            }
          },
          onError: (error: any) => {
            submitLockRef.current = false;
            setIsSavingTask(false);
            console.error("Failed to create task:", error);
            alert("Failed to create task: " + (error?.message || "Unknown error"));
          }
        }
      );
    }
  };

  const handleEdit = (task: any) => {
    setEditingTask(task);
    setAdditionalNotesLimitError("");
    const { hours: timeSpentHours, minutes: timeSpentMinutes } = parseTimeSpent(task.time_spent);
    reset({
      ...task,
      parent_task_id: normalizeTaskRelationId(task.parent_task_id),
      assigned_to: resolveAssigneeId(task.assigned_to),
      time_spent_hours: timeSpentHours,
      time_spent_minutes: timeSpentMinutes,
    });
    if (assigneeSearchDebounceRef.current !== null) {
      window.clearTimeout(assigneeSearchDebounceRef.current);
      assigneeSearchDebounceRef.current = null;
    }
    setAssigneeSearchText("");
    setShowForm(true);
    setPendingAttachments([]);
    setAttachmentsAccordionExpanded(false);
    clearCommentDraft();
  };

  const fetchAttachmentsForTaskIds = async (taskIds: Array<string | number>) => {
    if (taskIds.length === 0) return [];
    const response = await dataProvider().getList({
      resource: "task_attachments",
      filters: [{ field: "task_id", operator: "in", value: taskIds }],
      pagination: { mode: "off" },
      meta: { populate: ["storage_object_id"] },
    });
    return response?.data || [];
  };
  const fetchActivitiesForTaskIds = async (taskIds: Array<string | number>) => {
    if (taskIds.length === 0) return [];
    const response = await dataProvider().getList({
      resource: "task_activities",
      filters: [{ field: "task_id", operator: "in", value: taskIds }],
      pagination: { mode: "off" },
    });
    return response?.data || [];
  };
  const collectCascadeTaskIds = (rootTaskId: string | number) => {
    const rootKey = String(rootTaskId);
    const visited = new Set<string>();
    const ordered: string[] = [];

    const walk = (taskId: string) => {
      if (visited.has(taskId)) return;
      visited.add(taskId);
      const children = cascadeChildrenByParent[taskId] || [];
      children.forEach((child: any) => {
        if (child?.id !== null && child?.id !== undefined && child?.id !== "") {
          walk(String(child.id));
        }
      });
      ordered.push(taskId);
    };

    walk(rootKey);
    return ordered;
  };
  const handleDelete = async (task: any) => {
    const taskId = task?.id;
    if (taskId === null || taskId === undefined || taskId === "") return;

    if (!canCurrentUserDeleteTask(task)) {
      alert("Only the task creator can delete this task.");
      return;
    }

    if (cascadeTasksQuery?.isLoading || cascadeTasksQuery?.isFetching) {
      alert("Please wait while task dependencies are loaded.");
      return;
    }
    if (cascadeTasksQuery?.isError) {
      alert("Unable to verify related tasks right now. Please try again.");
      return;
    }

    const taskIdStr = String(taskId);
    const cascadeDeleteOrder = collectCascadeTaskIds(taskIdStr);
    if (!cascadeTaskById[taskIdStr] && !cascadeDeleteOrder.includes(taskIdStr)) {
      alert("Task details are not fully loaded. Please refresh and try again.");
      return;
    }

    const deleteCount = cascadeDeleteOrder.length;
    const confirmMessage =
      deleteCount > 1
        ? `Delete this task and ${deleteCount - 1} subtask(s)? This will also delete related activities and attachments.`
        : "Delete this task? This will also delete related activities and attachments.";
    if (!(await modalConfirm(confirmMessage, "Confirm Delete"))) return;

    try {
      const cascadeTaskIdSet = new Set(cascadeDeleteOrder);
      const attachmentsToDelete = await fetchAttachmentsForTaskIds(cascadeDeleteOrder);
      const activitiesToDelete = await fetchActivitiesForTaskIds(cascadeDeleteOrder);

      const dp = dataProvider();

      // Batch-delete all attachment records in one call
      const attachmentIds = attachmentsToDelete.map((att: any) => att.id).filter(Boolean);
      if (attachmentIds.length > 0) {
        await dp.deleteMany!({ resource: "task_attachments", ids: attachmentIds });
      }

      // Batch-delete all storage files in one call
      const filePathsToDelete = attachmentsToDelete
        .map((att: any) => {
          const so = att?.storage_object_id;
          return String(so?.path || so?.file || "").trim();
        })
        .filter(Boolean);
      if (filePathsToDelete.length > 0) {
        try {
          const storageProvider = dataProvider("storage");
          if (storageProvider.custom) {
            await storageProvider.custom({
              url: `task-attachments/objects/batch-delete/`,
              method: "post",
              payload: { paths: filePathsToDelete },
            });
          }
        } catch (fileError) {
          console.warn("Failed to batch-delete attachment files from storage:", fileError);
        }
      }

      // Batch-delete all activity records in one call
      const activityIds = activitiesToDelete.map((act: any) => act.id).filter(Boolean);
      if (activityIds.length > 0) {
        await dp.deleteMany!({ resource: "task_activities", ids: activityIds });
      }

      // Batch-delete all task records in one call
      if (cascadeDeleteOrder.length > 0) {
        await dp.deleteMany!({ resource: "tasks", ids: cascadeDeleteOrder });
      }

      if (viewingTask?.id && cascadeTaskIdSet.has(String(viewingTask.id))) {
        setViewingTaskStack([]);
        setViewingTask(null);
      }
      if (editingTask?.id && cascadeTaskIdSet.has(String(editingTask.id))) {
        setEditingTask(null);
        setShowForm(false);
      }
      refetch();
      openNotification?.({
        type: "success",
        message: "Success",
        description:
          cascadeDeleteOrder.length > 1
            ? `Deleted ${cascadeDeleteOrder.length} tasks successfully.`
            : "Task deleted successfully.",
      });
    } catch (error: any) {
      console.error("Failed to delete task with cascade:", error);
      const errorMessage = error?.response?.data?.detail || error?.message || "Unknown error";
      alert(`Failed to delete task: ${errorMessage}`);
    }
  };

  const handleView = (task: any) => {
    // Entry point from the list, board and gantt - this starts a fresh trail.
    setViewingTaskStack([]);
    setViewingTask(task);
    clearCommentDraft();
  };

  // Drill from the open dialog into a related task (subtask or parent),
  // remembering where we came from so Back can return to it.
  const handleViewRelatedTask = (task: any) => {
    if (!task) return;
    clearCommentDraft();
    setActivityPreview(null);
    if (viewingTask) setViewingTaskStack([...viewingTaskStack, viewingTask]);
    setViewingTask(task);
  };

  // Back retraces the path taken to get here, so it only appears when there is
  // a real one: drilling through the dialog builds it, and the board and gantt
  // hand over the rows they were expanded through. A task opened cold has no
  // path and shows no arrow - the parent link above the title is the way up in
  // that case, and it says where it goes rather than implying a return trip.
  const viewingTaskBackTarget =
    viewingTaskStack.length > 0 ? viewingTaskStack[viewingTaskStack.length - 1] : null;

  const handleViewBack = () => {
    if (!viewingTaskBackTarget) return;
    clearCommentDraft();
    setActivityPreview(null);
    setViewingTaskStack(viewingTaskStack.slice(0, -1));
    setViewingTask(viewingTaskBackTarget);
  };

  const closeViewDialog = () => {
    clearCommentDraft();
    setActivityPreview(null);
    setViewingTaskStack([]);
    setViewingTask(null);
  };

  const handleMarkDone = (task: any) => {
    if (!task?.id || task.status === "done") return;
    if (!canCurrentUserMarkTaskDone(task)) {
      alert("Only the assignee can mark this task as done.");
      return;
    }
    if (hasIncompleteChildren(task.id)) {
      alert("Cannot mark parent task as done while a child task is not done.");
      return;
    }
    updateTask(
      { resource: "tasks", id: task.id, values: { status: "done", progress: 100 } },
      {
        onSuccess: () => {
          if (currentUserId) {
            createActivity(
              {
                resource: "task_activities",
                values: {
                  task_id: task.id,
                  user_id: currentUserId,
                  action: "Updated status",
                  field_name: "Status",
                  old_value: formatTaskStatusLabel(task.status),
                  new_value: formatTaskStatusLabel("done"),
                  comment: "Marked done from list",
                  created_at: new Date().toISOString(),
                },
                successNotification: false,
              },
              {
                onError: (error) => console.warn("Failed to log activity:", error),
              }
            );
          }
          refetch();
        },
        onError: (error: any) => {
          console.error("Failed to mark task done:", error);
          alert("Failed to update task status.");
        },
      }
    );
  };

  const handleAddComment = () => {
    const commentText = String(newCommentInputRef.current?.value || "").trim();
    if (!commentText || !commentsTask || !currentUserId) return;

    createActivity(
      {
        resource: "task_activities",
        values: {
          task_id: commentsTask.id,
          user_id: currentUserId,
          action: "Added comment",
          comment: commentText,
          created_at: new Date().toISOString(),
        },
      },
      {
        onSuccess: () => {
          clearCommentDraft();
          refetchActivities();
        },
        onError: (error) => {
          console.error("Failed to add comment:", error);
          alert("Failed to add comment. Please try again.");
        },
      }
    );
  };

  const getAttachmentFileName = (attachment: any): string => {
    const storageObject = attachment?.storage_object_id;
    const filename = String(storageObject?.filename || "").trim();
    if (filename) return filename;

    const filePath = String(storageObject?.path || storageObject?.file || "").trim();
    if (!filePath) return "";

    return filePath.split("/").pop() || "";
  };

  const uploadFilesForTask = async (taskId: string | number, files: FileList | File[], resetInput?: () => void) => {
    if (!currentUserId) {
      alert("User not logged in.");
      return;
    }

    const allFiles = Array.from(files);
    const selectedFileNames = allFiles
      .map((file) => String(file?.name || "").trim())
      .filter((name) => !!name);

    if (selectedFileNames.length === 0) {
      alert("No valid files selected.");
      resetInput?.();
      return;
    }

    const duplicateNamesInSelection = Array.from(
      new Set(
        selectedFileNames.filter((name, index) => selectedFileNames.indexOf(name) !== index)
      )
    );

    const existingFileNames = new Set(
      (attachmentsResult?.data || [])
        .filter((attachment: any) => String(attachment?.task_id) === String(taskId))
        .map((attachment: any) => getAttachmentFileName(attachment))
        .filter((name: string) => !!name)
    );

    const duplicateNamesInTask = Array.from(
      new Set(selectedFileNames.filter((name) => existingFileNames.has(name)))
    );

    if (duplicateNamesInSelection.length > 0 || duplicateNamesInTask.length > 0) {
      const issues: string[] = [];
      if (duplicateNamesInSelection.length > 0) {
        issues.push(`Selected more than once: ${duplicateNamesInSelection.join(", ")}`);
      }
      if (duplicateNamesInTask.length > 0) {
        issues.push(`Already attached to this task: ${duplicateNamesInTask.join(", ")}`);
      }
      alert(`Duplicate file names are not allowed.\n${issues.join("\n")}`);
      resetInput?.();
      return;
    }

    setUploadingFile(true);
    const allPaths = allFiles.map((file) => `task-${taskId}/${file.name}`);

    try {
      const formData = new FormData();
      allFiles.forEach((file) => formData.append("files", file));
      formData.append("paths", JSON.stringify(allPaths));
      formData.append("metadata", JSON.stringify(allFiles.map(() => ({}))));

      const storageProvider = dataProvider("storage");
      if (!storageProvider.custom) {
        throw new Error("Storage provider does not support custom operations");
      }
      const uploadResponse = await storageProvider.custom({
        url: `task-attachments/objects/batch-upload/`,
        method: "post",
        payload: formData,
      });

      const rawData = uploadResponse?.data;
      const successful = rawData?.successful || rawData?.data?.successful || [];
      const storageObjectIds: number[] = [];
      if (Array.isArray(successful)) {
        for (const entry of successful) {
          const objId = Number(entry?.object?.id);
          if (Number.isFinite(objId)) storageObjectIds.push(objId);
        }
      }

      if (storageObjectIds.length === 0) {
        console.error("Unable to resolve storage object ids:", uploadResponse);
        alert("Files uploaded but attachments could not be linked. Please refresh.");
        setUploadingFile(false);
        resetInput?.();
        return;
      }

      await dataProvider().createMany!({
        resource: "task_attachments",
        variables: storageObjectIds.map((id) => ({
          task_id: taskId,
          storage_object_id: id,
          uploaded_by: currentUserId,
        })),
      });

      setUploadingFile(false);
      refetchAttachments();
      alert(allFiles.length > 1 ? "Files uploaded successfully!" : "File uploaded successfully!");
      resetInput?.();
    } catch (error: any) {
      console.error("Failed to upload file(s):", error);
      alert("Failed to upload: " + (error?.message || "Unknown error"));
      setUploadingFile(false);
      resetInput?.();
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    if (!viewingTask) { alert("No task selected"); return; }
    await uploadFilesForTask(viewingTask.id, files, () => { event.target.value = ""; });
  };

  const handleEditFormFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    if (!editingTask?.id) { alert("No task ID - please save the task first"); return; }
    await uploadFilesForTask(editingTask.id, files, () => { event.target.value = ""; });
  };

  const handleDownloadAttachment = async (attachment: any) => {
    const storageObject = attachment?.storage_object_id;
    const filePath = String(storageObject?.path || storageObject?.file || "").trim();
    if (!filePath) {
      alert("Cannot find attachment path for download");
      return;
    }
    const fileName =
      String(storageObject?.filename || "").trim() ||
      filePath.split("/").pop() ||
      "download";
    try {
      const response = await dataProvider("storage").getOne({
        resource: "task-attachments",
        id: filePath,
      });
      const blob = response?.data as unknown as Blob;
      if (!blob || !(blob instanceof Blob)) {
        console.error("Unexpected download response format:", response?.data);
        alert("Failed to download file: unexpected response format");
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error("Failed to download attachment:", error);
      alert("Failed to download file: " + (error?.message || "Unknown error"));
    }
  };

  const handleDeleteAttachment = async (attachmentId: string | number, filePath?: string) => {
    if (attachmentDeleteConfirmLockRef.current) return;
    attachmentDeleteConfirmLockRef.current = true;

    if (!(await modalConfirm("Delete this attachment?", "Confirm Delete"))) {
      attachmentDeleteConfirmLockRef.current = false;
      return;
    }

    const attachment = (attachmentsResult?.data || []).find(
      (att: any) => String(att.id) === String(attachmentId)
    );

    const storageObject = attachment?.storage_object_id;
    const pathToDelete = filePath || String(storageObject?.path || storageObject?.file || "").trim();

    if (!pathToDelete) {
      alert("Cannot find file path for deletion");
      attachmentDeleteConfirmLockRef.current = false;
      return;
    }

    deleteAttachment(
      {
        resource: "task_attachments",
        id: attachmentId,
      },
      {
        onSuccess: () => {
          deleteStorageFile(
            {
              resource: "task-attachments",
              id: pathToDelete,
              dataProviderName: "storage",
              successNotification: false,
            },
            {
              onSuccess: () => {
                attachmentDeleteConfirmLockRef.current = false;
                refetchAttachments();
              },
              onError: (error) => {
                console.error("Failed to delete file from storage:", error);
                attachmentDeleteConfirmLockRef.current = false;
                refetchAttachments();
                alert("Attachment record deleted but file may still exist in storage");
              },
            }
          );
        },
        onError: (error) => {
          console.error("Failed to delete attachment record:", error);
          attachmentDeleteConfirmLockRef.current = false;
          alert("Failed to delete attachment. Please try again.");
        },
      }
    );
  };

  const handleCreateFormFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) {
      return;
    }
    setPendingAttachments((prev) => [...prev, ...Array.from(files)]);
    event.target.value = "";
  };

  const removePendingAttachment = (index: number) => {
    setPendingAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadPendingAttachments = async (taskId: string | number) => {
    if (!pendingAttachments.length) return;
    await uploadFilesForTask(taskId, pendingAttachments, () => {
      setPendingAttachments([]);
    });
  };

  const handleSendReminder = () => {
    if (!viewingTask?.id) return;
    if (!viewingTask.assigned_to) {
      alert("Cannot send a reminder because this task has no assignee.");
      return;
    }
    const assigneeUser = resolveAssigneeUser(viewingTask.assigned_to);
    const assigneeEmail = assigneeUser?.email;
    if (!assigneeEmail) {
      alert("Cannot send a reminder because the assignee email is not available.");
      return;
    }

    setIsSendingReminder(true);
    sendTaskAssignmentEmail(
      {
        resource: "send-task-assignment-email",
        values: {
          task_id: viewingTask.id,
          template_key: "task_reminder",
          to_email: assigneeEmail,
          app_base_url: window.location.origin,
          context: {
            assignee_name: getAssigneeLabel(viewingTask.assigned_to),
            reminder_sent_by: formatUserLabel(user),
            project_name: projectById[String(viewingTask.project_id)]?.name || "",
          },
        },
        dataProviderName: "functions",
        successNotification: false,
        errorNotification: false,
      },
      {
        onSuccess: (response: any) => {
          setIsSendingReminder(false);
          const result = response?.data ?? response;
          if (result?.success === false) {
            console.warn("Task reminder email was not sent:", result);
            openNotification?.({
              type: "error",
              message: "Reminder not sent",
              description: result?.error || "The reminder email could not be sent.",
            });
            return;
          }
          openNotification?.({
            type: "success",
            message: "Reminder sent",
            description: "Reminder email sent to the task assignee.",
          });
        },
        onError: (error) => {
          setIsSendingReminder(false);
          console.warn("Failed to send task reminder email:", error);
          openNotification?.({
            type: "error",
            message: "Reminder not sent",
            description: "The reminder email could not be sent.",
          });
        },
      }
    );
  };

  const openCreateTask = () => {
    if (scopedProjectId) {
      const project = projectById[String(scopedProjectId)];
      const status = normalizeProjectStatus(project?.status);
      if (status === "completed" || status === "complete") {
        alert("Cannot create tasks for a completed project.");
        return;
      }
      if (status === "cancelled") {
        alert("Cannot create tasks for a cancelled project.");
        return;
      }
    }
    setShowForm(true);
    setEditingTask(null);
    setAdditionalNotesLimitError("");
    if (assigneeSearchDebounceRef.current !== null) {
      window.clearTimeout(assigneeSearchDebounceRef.current);
      assigneeSearchDebounceRef.current = null;
    }
    setAssigneeSearchText("");
    setPendingAttachments([]);
    setAttachmentsAccordionExpanded(false);
    reset({
      project_id: scopedProjectId ?? null,
      status: "todo",
      priority: "medium",
      assigned_to: currentUserId || null,
      progress: 0,
      start_date: new Date().toISOString().slice(0, 10),
      additional_notes: "",
    });
  };

  // `trail` is the path the caller navigated to reach this task, outermost
  // first. The board sends the rows it expanded through so Back retraces the
  // real clicks; callers with no path to report leave it empty.
  const openTask = (taskOrId: any, options?: { trail?: any[] }) => {
    if (taskOrId === null || taskOrId === undefined) return;
    const trail = options?.trail?.filter(Boolean) ?? [];
    if (typeof taskOrId === "object") {
      setViewingTaskStack(trail);
      setViewingTask(taskOrId);
      clearCommentDraft();
      return;
    }
    const foundTask = allTasks.find((task: any) => String(task.id) === String(taskOrId));
    if (foundTask) {
      setViewingTaskStack(trail);
      setViewingTask(foundTask);
      clearCommentDraft();
    }
  };

  useImperativeHandle(ref, () => ({ openCreateTask, openTask, editTask: handleEdit }), [openCreateTask, openTask, handleEdit, allTasks]);

  const handleAttachmentsAccordionChange = (_: unknown, expanded: boolean) => {
    setAttachmentsAccordionExpanded(expanded);
    if (!expanded) return;
    setTimeout(() => {
      if (!formDialogContentRef.current) return;
      formDialogContentRef.current.scrollTo({
        top: formDialogContentRef.current.scrollHeight,
        behavior: "smooth",
      });
    }, 240);
  };

  if (isLoading && showList) return <div>Loading...</div>;

  const renderActivityItem = (activity: any) => {
    const activityUser = getActivityUser(activity.user_id);
    const isAdditionalInfoChange = isAdditionalInfoActivityField(activity.field_name);
    const previousAdditionalInfo = isAdditionalInfoChange
      ? normalizeAdditionalInfoActivityValue(activity.old_value)
      : null;
    const nextAdditionalInfo = isAdditionalInfoChange
      ? normalizeAdditionalInfoActivityValue(activity.new_value)
      : null;
    return (
      <ListItem key={activity.id} alignItems="flex-start" sx={{ px: 0 }}>
        <Avatar sx={{ mr: 2, width: 32, height: 32, fontSize: "0.875rem" }}>
          {getUserInitials(activityUser)}
        </Avatar>
        <ListItemText
          primary={
            <Typography variant="body2">
              {isAdditionalInfoChange ? (
                <>
                  <strong>{ADDITIONAL_INFO_ACTIVITY_LABEL}</strong> changed
                </>
              ) : (
                <>
                  <strong>{activity.action}</strong>
                  {activity.field_name && ` - ${activity.field_name}`}
                </>
              )}
            </Typography>
          }
          secondary={
            <Stack gap={0.5}>
              {isAdditionalInfoChange ? (
                (previousAdditionalInfo || nextAdditionalInfo) ? (
                  <Typography variant="caption" color="text.secondary">
                    {previousAdditionalInfo && nextAdditionalInfo ? (
                      <>
                        Changed from{' '}
                        <Link
                          component="button"
                          type="button"
                          underline="always"
                          onClick={() => setActivityPreview({
                            html: previousAdditionalInfo,
                            title: `Previous ${ADDITIONAL_INFO_ACTIVITY_LABEL}`,
                          })}
                          sx={{ fontSize: "inherit", verticalAlign: "baseline" }}
                        >
                          previous version
                        </Link>{' '}
                        to{' '}
                        <Link
                          component="button"
                          type="button"
                          underline="always"
                          onClick={() => setActivityPreview({
                            html: nextAdditionalInfo,
                            title: `Updated ${ADDITIONAL_INFO_ACTIVITY_LABEL}`,
                          })}
                          sx={{ fontSize: "inherit", verticalAlign: "baseline" }}
                        >
                          updated version
                        </Link>
                      </>
                    ) : nextAdditionalInfo ? (
                      <>
                        Set to{' '}
                        <Link
                          component="button"
                          type="button"
                          underline="always"
                          onClick={() => setActivityPreview({
                            html: nextAdditionalInfo,
                            title: `${ADDITIONAL_INFO_ACTIVITY_LABEL}`,
                          })}
                          sx={{ fontSize: "inherit", verticalAlign: "baseline" }}
                        >
                          view content
                        </Link>
                      </>
                    ) : (
                      <>
                        Cleared previously saved{' '}
                        <Link
                          component="button"
                          type="button"
                          underline="always"
                          onClick={() => setActivityPreview({
                            html: previousAdditionalInfo!,
                            title: `Previous ${ADDITIONAL_INFO_ACTIVITY_LABEL}`,
                          })}
                          sx={{ fontSize: "inherit", verticalAlign: "baseline" }}
                        >
                          content
                        </Link>
                      </>
                    )}
                  </Typography>
                ) : null
              ) : activity.old_value && activity.new_value ? (
                <Typography variant="caption" color="text.secondary">
                  Changed from "{activity.old_value}" to "{activity.new_value}"
                </Typography>
              ) : null}
              {activity.comment && (
                <Typography variant="body2" sx={{ mt: 0.5, whiteSpace: "pre-wrap" }}>
                  {activity.comment}
                </Typography>
              )}
              <Typography variant="caption" color="text.secondary">
                {formatActivityTimestamp(activity.created_at)}
              </Typography>
            </Stack>
          }
        />
      </ListItem>
    );
  };

  const showProjectColumn = projectId == null;
  const gridTemplateColumns = showProjectColumn
    ? {
        xs: "minmax(80px, 1fr) 150px 96px 84px 84px 80px 96px",
        sm: "minmax(90px, 1fr) 170px 104px 92px 92px 88px 104px",
        lg: "minmax(120px, 1.1fr) 210px 120px 110px 110px 96px 112px",
      }
    : {
        xs: "minmax(120px, 1.6fr) 130px 84px 84px 80px 96px",
        sm: "minmax(130px, 1.7fr) 150px 92px 92px 88px 104px",
        lg: "minmax(160px, 1.9fr) 180px 110px 110px 96px 112px",
      };
  const gridMinWidth = showProjectColumn
    ? { xs: 680, sm: 760, lg: 880 }
    : { xs: 580, sm: 660, lg: 780 };

  return (
    <Box>
      <Dialog
        open={showForm}
        onClose={() => {
          setShowForm(false);
          setEditingTask(null);
          submitLockRef.current = false;
          setIsSavingTask(false);
          setAdditionalNotesLimitError("");
          setPendingAttachments([]);
          setAttachmentsAccordionExpanded(false);
          clearCommentDraft();
          reset({});
        }}
        maxWidth={editingTask ? "md" : "sm"}
        fullWidth
        scroll="paper"
        PaperProps={{
          sx: {
            m: 1,
            maxHeight: "calc(100dvh - 16px)",
          },
        }}
      >
        <DialogTitle sx={{ pb: 0.5 }}>{editingTask ? "Edit Task" : "Create Task"}</DialogTitle>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogContent ref={formDialogContentRef} sx={{ pt: 1, pb: 1 }}>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: editingTask ? { xs: "1fr", md: "minmax(0, 1fr) 340px" } : "1fr",
                gap: 2,
                alignItems: "stretch",
              }}
            >
            <Stack gap={1.75}>
              {!editingTask &&
                (useScopedProjectOnCreate ? (
                  <TextField
                    label="Project"
                    value={projectById[String(scopedProjectId)]?.name || `Project ${scopedProjectId}`}
                    InputProps={{ readOnly: true }}
                    size="small"
                  />
                ) : (
                  <Controller
                    control={control}
                    name="project_id"
                    defaultValue={null}
                    rules={{ required: "Project is required." }}
                    render={({ field }) => (
                      <TextField
                        select
                        label="Project"
                        value={field.value ?? ""}
                        onChange={(event) => field.onChange(event.target.value || null)}
                        error={!!errors.project_id}
                        helperText={
                          errors.project_id?.message
                            ? String(errors.project_id.message)
                            : visibleProjects.length === 0
                              ? "No accessible projects available"
                              : ""
                        }
                        required
                        disabled={isDoneStatusLockedEdit}
                        size="small"
                      >
                        <MenuItem value="">Select project</MenuItem>
                        {visibleProjects.map((project: any) => (
                          <MenuItem key={project.id} value={String(project.id)}>
                            {project.name || `Project ${project.id}`}
                          </MenuItem>
                        ))}
                      </TextField>
                    )}
                  />
                ))}
              <TextField
                {...register("title", { required: true })}
                label="Title"
                required
                size="small"
                disabled={isDoneStatusLockedEdit}
              />
              <TextField
                {...register("description", {
                  maxLength: {
                    value: TASK_DESCRIPTION_MAX_LENGTH,
                    message: `Description cannot exceed ${TASK_DESCRIPTION_MAX_LENGTH} characters.`,
                  },
                })}
                label="Description"
                multiline
                minRows={1}
                maxRows={3}
                size="small"
                inputProps={{ maxLength: TASK_DESCRIPTION_MAX_LENGTH }}
                error={!!errors.description}
                helperText={errors.description?.message ? String(errors.description.message) : `Max ${TASK_DESCRIPTION_MAX_LENGTH} characters`}
                disabled={isDoneStatusLockedEdit}
              />
              <Accordion>
                <AccordionSummary
                  expandIcon={<ExpandMore />}
                  sx={{
                    minHeight: 32,
                    px: 1,
                    "&.Mui-expanded": { minHeight: 36 },
                    "& .MuiAccordionSummary-content": { my: 0.5 },
                    "& .MuiAccordionSummary-content.Mui-expanded": { my: 0.5 },
                  }}
                >
                  <Typography variant="subtitle2">Additional Notes (optional)</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Controller
                    control={control}
                    name="additional_notes"
                    defaultValue=""
                    render={({ field: { value, onChange } }) => (
                      <RichTextEditor
                        value={value}
                        onChange={(nextValue) => {
                          const nextLength = getRichTextPlainLength(nextValue);
                          if (isDoneStatusLockedEdit) return;
                          if (nextLength > TASK_ADDITIONAL_NOTES_MAX_LENGTH) {
                            setAdditionalNotesLimitError(
                              `Additional Notes cannot exceed ${TASK_ADDITIONAL_NOTES_MAX_LENGTH} characters.`
                            );
                            return;
                          }
                          setAdditionalNotesLimitError("");
                          onChange(nextValue);
                        }}
                      />
                    )}
                  />
                  <Typography
                    variant="caption"
                    color={additionalNotesLimitError ? "error" : "text.secondary"}
                    sx={{ mt: 1, display: "block" }}
                  >
                    {additionalNotesLimitError || `Supports rich text and links. Max ${TASK_ADDITIONAL_NOTES_MAX_LENGTH} characters`}
                  </Typography>
                </AccordionDetails>
              </Accordion>
              <Box sx={{ mt: 0.75 }} />
              <Controller
                control={control}
                name="parent_task_id"
                defaultValue={null}
                render={({ field: { onChange, value } }) => (
                  <Autocomplete
                    options={allTasks.filter((t: any) => String(t.id) !== String(editingTask?.id))}
                    getOptionLabel={(option: any) => option.title}
                    getOptionKey={(option: any) => String(option?.id ?? "")}
                    value={
                      allTasks.find(
                        (t: any) => String(t.id) === String(normalizeTaskRelationId(value))
                      ) || null
                    }
                    isOptionEqualToValue={(option, selected) =>
                      String(option.id) === String(selected.id)
                    }
                    onChange={(_, newValue) => onChange(newValue?.id ?? null)}
                    renderInput={(params) => <TextField {...params} label="Parent Task (Optional)" size="small" InputLabelProps={{ ...params.InputLabelProps, shrink: true }} />}
                    renderOption={(props, option: any) => (
                      <li {...props}>
                        <Box>
                          <Typography variant="body2">{option.title}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {option.status} • {option.priority}
                          </Typography>
                        </Box>
                      </li>
                    )}
                    disabled={isDoneStatusLockedEdit}
                  />
                )}
              />
              <Stack direction="row" gap={2}>
                <Controller
                  control={control}
                  name="status"
                  defaultValue="todo"
                  render={({ field }) => (
                    <TextField
                      {...field}
                      select
                      label="Status"
                      sx={{ flex: 1 }}
                      size="small"
                      onChange={(e) => {
                        field.onChange(e);
                        const mappedProgress = getProgressForStatus(
                          e.target.value,
                          getValues("progress")
                        );
                        if (mappedProgress !== null) {
                          setValue("progress", mappedProgress, { shouldDirty: true, shouldValidate: true });
                        }
                      }}
                    >
                      <MenuItem value="todo">To Do</MenuItem>
                      <MenuItem value="in_progress">In Progress</MenuItem>
                      <MenuItem value="on_hold">On Hold</MenuItem>
                      <MenuItem value="review">Review</MenuItem>
                      <MenuItem value="done">Done</MenuItem>
                    </TextField>
                  )}
                />
                <Controller
                  control={control}
                  name="priority"
                  defaultValue="medium"
                  render={({ field }) => (
                    <TextField {...field} select label="Priority" sx={{ flex: 1 }} size="small" disabled={isDoneStatusLockedEdit}>
                      <MenuItem value="low">Low</MenuItem>
                      <MenuItem value="medium">Medium</MenuItem>
                      <MenuItem value="high">High</MenuItem>
                      <MenuItem value="critical">Critical</MenuItem>
                    </TextField>
                  )}
                />
              </Stack>
              <Stack direction="row" gap={2}>
                <TextField
                  {...register("start_date")}
                  label="Start Date"
                  type="date"
                  InputLabelProps={{ shrink: true }}
                  sx={{ flex: 1 }}
                  size="small"
                  disabled={isDoneStatusLockedEdit}
                />
                <TextField 
                  {...register("end_date", {
                    required: "End Date is required.",
                    validate: (value) => {
                      const startDate = String(getValues("start_date") || "").trim();
                      const endDate = String(value || "").trim();
                      if (!startDate || !endDate) return true;
                      return endDate >= startDate || "End Date cannot be earlier than Start Date.";
                    },
                  })}
                  label={editingTask ? "Original End Date" : "End Date"}
                  type="date" 
                  InputLabelProps={{ shrink: true }} 
                  sx={{ flex: 1 }}
                  disabled={!!editingTask || isDoneStatusLockedEdit}
                  error={!!errors.end_date}
                  helperText={errors.end_date?.message ? String(errors.end_date.message) : editingTask ? "Cannot modify after creation" : ""}
                  required
                  size="small"
                />
              </Stack>
              {editingTask && (
                <Stack direction="row" gap={2} alignItems="flex-start">
                  <TextField
                    {...register("updated_end_date", {
                      validate: (value) => {
                        const startDate = String(getValues("start_date") || "").trim();
                        const updatedEndDate = String(value || "").trim();
                        if (!startDate || !updatedEndDate) return true;
                        return updatedEndDate >= startDate || "Updated End Date cannot be earlier than Start Date.";
                      },
                    })}
                    label="Updated End Date (Optional)"
                    type="date"
                    InputLabelProps={{ shrink: true }}
                    error={!!errors.updated_end_date}
                    helperText={errors.updated_end_date?.message ? String(errors.updated_end_date.message) : "Set if deadline needs to be extended or changed"}
                    size="small"
                    disabled={isDoneStatusLockedEdit}
                    sx={{ flex: 1 }}
                  />
                  <Stack sx={{ flex: 1 }} gap={0.5}>
                    <Stack direction="row" gap={1}>
                      <Controller
                        control={control}
                        name="time_spent_hours"
                        defaultValue={0}
                        render={({ field }) => (
                          <TextField
                            label="Hours Spent"
                            type="number"
                            size="small"
                            sx={{ flex: 1 }}
                            inputProps={{ min: 0 }}
                            InputLabelProps={{ shrink: true }}
                            disabled={isDoneStatusLockedEdit}
                            value={field.value ?? 0}
                            onChange={(e) => {
                              const raw = e.target.value;
                              if (raw === "") { field.onChange(0); return; }
                              let n = Math.floor(Number(raw));
                              if (!Number.isFinite(n) || n < 0) n = 0;
                              field.onChange(n);
                            }}
                          />
                        )}
                      />
                      <Controller
                        control={control}
                        name="time_spent_minutes"
                        defaultValue={0}
                        render={({ field }) => (
                          <TextField
                            label="Minutes Spent"
                            type="number"
                            size="small"
                            sx={{ flex: 1 }}
                            inputProps={{ min: 0, max: 59 }}
                            InputLabelProps={{ shrink: true }}
                            disabled={isDoneStatusLockedEdit}
                            value={field.value ?? 0}
                            onChange={(e) => {
                              const raw = e.target.value;
                              if (raw === "") { field.onChange(0); return; }
                              let n = Math.floor(Number(raw));
                              if (!Number.isFinite(n) || n < 0) n = 0;
                              if (n > 59) n = 59;
                              field.onChange(n);
                            }}
                          />
                        )}
                      />
                    </Stack>
                    <Typography variant="caption" color="text.secondary" sx={{ pl: 0.25 }}>
                      Total time spent on this task
                    </Typography>
                  </Stack>
                </Stack>
              )}
              <Stack direction="row" gap={2}>
                <Controller
                  control={control}
                  name="progress"
                  defaultValue={0}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      value={field.value ?? 0}
                      onChange={(e) =>
                        field.onChange(e.target.value === "" ? "" : Number(e.target.value))
                      }
                      label="Progress %"
                      type="number"
                      inputProps={{ min: 0, max: 100 }}
                      sx={{ flex: 1 }}
                      size="small"
                      disabled={isDoneStatusLockedEdit}
                    />
                  )}
                />
                <Controller
                  control={control}
                  name="assigned_to"
                  defaultValue={currentUserId || null}
                  render={({ field: { onChange, value } }) => {
                    const selectedUserId = resolveUserId(value);
                    const selectedUser =
                      assigneeOptionsWithIdentity.find((u: any) => String(u.id) === String(selectedUserId)) || null;
                    return (
                      <Autocomplete
                        options={assigneeOptionsWithIdentity}
                        getOptionLabel={(option: any) => formatUserLabel(option)}
                        getOptionKey={(option: any) => String(option?.id ?? "")}
                        value={selectedUser}
                        onChange={(_, newValue) => {
                          onChange(newValue?.id ?? null);
                          if (assigneeSearchDebounceRef.current !== null) {
                            window.clearTimeout(assigneeSearchDebounceRef.current);
                            assigneeSearchDebounceRef.current = null;
                          }
                          setAssigneeSearchText("");
                        }}
                        onInputChange={(_, newInput, reason) => {
                          if (reason === "clear") {
                            if (assigneeSearchDebounceRef.current !== null) {
                              window.clearTimeout(assigneeSearchDebounceRef.current);
                              assigneeSearchDebounceRef.current = null;
                            }
                            setAssigneeSearchText("");
                            return;
                          }
                          if (reason === "input") {
                            queueAssigneeSearch(newInput);
                          }
                        }}
                        loading={isAssigneeOptionsLoading}
                        filterOptions={filterUserOptionsByLabel}
                        noOptionsText={
                          assigneeSearchText.trim()
                            ? "No users found. Keep typing to search."
                            : "Type a user name to search users not in the list."
                        }
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            label="Assigned To"
                            placeholder="Type a user name to search"
                            size="small"
                          />
                        )}
                        isOptionEqualToValue={(option, selected) => String(option.id) === String(selected?.id)}
                        sx={{ flex: 1 }}
                        disabled={isDoneStatusLockedEdit}
                      />
                    );
                  }}
                />
              </Stack>

            <Accordion
              expanded={attachmentsAccordionExpanded}
              onChange={handleAttachmentsAccordionChange}
              sx={{ mt: 1.5 }}
            >
              <AccordionSummary
                expandIcon={<ExpandMore />}
                sx={{
                  minHeight: 32,
                  px: 1,
                  "&.Mui-expanded": { minHeight: 36 },
                  "& .MuiAccordionSummary-content": { my: 0.5 },
                  "& .MuiAccordionSummary-content.Mui-expanded": { my: 0.5 },
                }}
              >
                <Typography variant="subtitle2">Attachments (optional)</Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ pt: 0.5 }}>
                <Paper sx={{ p: 1.5, mb: 1.5, bgcolor: "grey.50" }}>
                  <Stack direction="row" gap={1} alignItems="center">
                    <Button
                      variant="outlined"
                      component="label"
                      startIcon={uploadingFile ? <CircularProgress size={16} /> : <AttachFile />}
                      disabled={uploadingFile || isDoneStatusLockedEdit}
                      size="small"
                    >
                      {uploadingFile ? "Uploading..." : "Upload Files"}
                      <input
                        type="file"
                        hidden
                        multiple
                        onChange={editingTask?.id ? handleEditFormFileUpload : handleCreateFormFileSelect}
                        disabled={uploadingFile || isDoneStatusLockedEdit}
                      />
                    </Button>
                    <Typography variant="caption" color="text.secondary">
                      Max file size: 10MB
                    </Typography>
                  </Stack>
                  {!editingTask?.id && (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
                      Files will upload after the task is created.
                    </Typography>
                  )}
                </Paper>

                {editingTask?.id ? (
                  isAttachmentsLoading ? (
                    <Typography variant="body2" color="text.secondary">Loading attachments...</Typography>
                  ) : editTaskAttachments.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">No attachments</Typography>
                  ) : (
                    <List dense>
                      {editTaskAttachments.map((attachment: any) => {
                        const storageObject = attachment?.storage_object_id;
                        const attachmentName =
                          String(storageObject?.filename || "").trim() ||
                          String(storageObject?.file || "").trim().split("/").pop() ||
                          "Unnamed file";
                        const numericAttachmentSize = Number(storageObject?.size);
                        const attachmentSize = Number.isFinite(numericAttachmentSize) ? numericAttachmentSize : null;
                        return (
                        <ListItem
                          key={attachment.id}
                          sx={{ px: 0, py: 0.5 }}
                          secondaryAction={
                            <Stack direction="row" gap={1}>
                              <IconButton
                                size="small"
                                onClick={() => handleDownloadAttachment(attachment)}
                                title="Download"
                              >
                                <Download fontSize="small" />
                              </IconButton>
                              <IconButton
                                size="small"
                                onClick={() => handleDeleteAttachment(attachment.id)}
                                title="Delete"
                                disabled={isDoneStatusLockedEdit}
                              >
                                <Close fontSize="small" />
                              </IconButton>
                            </Stack>
                          }
                        >
                          <ListItemText
                            primary={
                              <Stack direction="row" gap={1} alignItems="center">
                                <AttachFile fontSize="small" />
                                <Typography variant="body2">{attachmentName}</Typography>
                              </Stack>
                            }
                            secondary={
                              <Typography variant="caption" color="text.secondary">
                                {attachmentSize !== null ? `${(attachmentSize / 1024).toFixed(1)} KB` : "Unknown size"}
                              </Typography>
                            }
                          />
                        </ListItem>
                        );
                      })}
                    </List>
                  )
                ) : pendingAttachments.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">No attachments added yet</Typography>
                ) : (
                  <List dense>
                    {pendingAttachments.map((file, index) => (
                      <ListItem
                        key={`${file.name}-${file.lastModified}-${index}`}
                        sx={{ px: 0, py: 0.5 }}
                        secondaryAction={
                          <IconButton
                            size="small"
                            onClick={() => removePendingAttachment(index)}
                            title="Remove"
                            disabled={isDoneStatusLockedEdit}
                          >
                            <Close fontSize="small" />
                          </IconButton>
                        }
                      >
                        <ListItemText
                          primary={
                            <Stack direction="row" gap={1} alignItems="center">
                              <AttachFile fontSize="small" />
                              <Typography variant="body2">{file.name}</Typography>
                            </Stack>
                          }
                          secondary={
                            <Typography variant="caption" color="text.secondary">
                              {(file.size / 1024).toFixed(1)} KB
                            </Typography>
                          }
                        />
                      </ListItem>
                    ))}
                  </List>
                )}
              </AccordionDetails>
            </Accordion>
            </Stack>

            {editingTask && (
              <Box sx={{ position: "relative", minHeight: { md: 320 } }}>
                <Paper
                  variant="outlined"
                  sx={{
                    position: { xs: "static", md: "absolute" },
                    inset: 0,
                    p: 2,
                    borderRadius: 2,
                    display: "flex",
                    flexDirection: "column",
                    minHeight: 0,
                  }}
                >
                <Typography variant="subtitle2" gutterBottom>Activity & Comments</Typography>
                <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", mb: 1.5, maxHeight: { xs: 260, md: "none" } }}>
                  {activities.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      No activity yet
                    </Typography>
                  ) : (
                    <List ref={activityListRef} sx={{ py: 0 }}>
                      {chronologicalActivities.map(renderActivityItem)}
                    </List>
                  )}
                </Box>
                <Paper variant="outlined" sx={{ p: 1.5, bgcolor: "grey.50", mt: "auto" }}>
                  <Stack direction="row" gap={1}>
                    <TextField
                      fullWidth
                      size="small"
                      placeholder="Add a comment..."
                      inputRef={newCommentInputRef}
                      onChange={(event) => {
                        const nextHasText = String(event.target.value || "").trim().length > 0;
                        syncCommentDraft(nextHasText);
                      }}
                      multiline
                      rows={2}
                    />
                    <Button
                      type="button"
                      variant="contained"
                      size="small"
                      onClick={handleAddComment}
                      disabled={!hasCommentDraft}
                    >
                      Add
                    </Button>
                  </Stack>
                </Paper>
                </Paper>
              </Box>
            )}
            </Box>
          </DialogContent>
          <DialogActions sx={{ pt: 0.5 }}>
            <Button
              size="small"
              disabled={isSavingTask}
              onClick={() => {
                setShowForm(false);
                setEditingTask(null);
                submitLockRef.current = false;
                setIsSavingTask(false);
                setPendingAttachments([]);
                setAttachmentsAccordionExpanded(false);
                clearCommentDraft();
                reset({});
              }}
            >
              Cancel
            </Button>
            <Button type="submit" variant="contained" size="small" disabled={isSavingTask}>
              {isSavingTask ? "Saving..." : editingTask ? "Update" : "Create"}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <Box sx={{ display: showList ? "block" : "none" }}>
        <Box>
          {visibleTasks.length === 0 ? (
            <Paper sx={{ p: 3, border: "1px solid #d8dde5", boxShadow: "none", borderRadius: 2 }}>
              <Typography variant="body2" color="text.secondary">
                {searchText ? `No tasks match "${searchText}".` : "No tasks to show in Task List view."}
              </Typography>
            </Paper>
          ) : (
            tasksByStatus.map(({ status, tasks }) => {
              if (tasks.length === 0) return null;
              const statusLabelUpper = formatTaskStatusLabel(status);
              const isCollapsed = !!collapsedStatuses[status];
              return (
                <Box key={status} sx={{ py: 2 }}>
                  <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 1 }}>
                    <IconButton size="small" onClick={() => toggleStatus(status)}>
                      {isCollapsed ? <ExpandMore fontSize="small" /> : <ExpandLess fontSize="small" />}
                    </IconButton>
                    <Chip
                      label={`${statusLabelUpper} (${tasks.length})`}
                      size="small"
                      sx={getTaskStatusChipSx(status)}
                    />
                  </Stack>

                  <Collapse in={!isCollapsed}>
                    <Box sx={{ overflowX: "auto", pb: 0.5 }}>
                      <Box sx={{ minWidth: gridMinWidth }}>
                    <Box
                      sx={{
                        display: "grid",
                        gridTemplateColumns,
                        px: { xs: 1.25, sm: 1.5, md: 2 },
                        py: { xs: 0.75, sm: 1 },
                        mb: 1,
                        borderRadius: 1,
                        color: "text.secondary",
                        fontSize: { xs: "0.68rem", sm: "0.72rem", md: "0.75rem" },
                        fontWeight: 600,
                        textTransform: "uppercase",
                      }}
                    >
                      <Box>Name</Box>
                      {showProjectColumn && <Box>Project</Box>}
                      <Box>Assignee</Box>
                      <Box>Start date</Box>
                      <Box>Due date</Box>
                      <Box>Priority</Box>
                      <Box sx={{ textAlign: "right" }}>Actions</Box>
                    </Box>

                  <Box>
                      {tasks.map((task: any) => {
                      const renderTaskRow = (rowTask: any, level = 0, sectionStatus?: string) => {
                        const projectLabel =
                          projectById[String(rowTask.project_id)]?.name || "-";
                        const assignee = getAssignee(rowTask);
                        const assigneeLabel = getAssigneeLabel(rowTask.assigned_to) || "-";
                        const dueDate = rowTask.updated_end_date || rowTask.end_date || "-";
                        const formattedStartDate = rowTask.start_date
                          ? formatUiDate(rowTask.start_date, "-")
                          : "-";
                        const formattedDueDate = dueDate !== "-" ? formatUiDate(dueDate, "-") : "-";
                        const priorityLabel = formatTaskPriorityLabel(rowTask.priority);
                        const isDoneStatus = isDoneTaskStatus(rowTask.status);
                        const rowStatusColor =
                          sectionStatus === "delayed"
                            ? getTaskStatusColor("delayed")
                            : getTaskStatusColor(rowTask.status);
                        const childTasks =
                          sectionStatus === "delayed"
                            ? []
                            : childrenByParent[String(rowTask.id)] || [];
                        const isExpanded = expandedParents[String(rowTask.id)] ?? true;

                        const indentPx = level * 24;
                        const canDeleteTask = canCurrentUserDeleteTask(rowTask);
                        const canMarkDoneTask = canCurrentUserMarkTaskDone(rowTask);

                        return (
                          <Box key={rowTask.id}>
                            <Box
                              sx={{
                                display: "grid",
                                gridTemplateColumns,
                                alignItems: "center",
                                px: { xs: 1.25, sm: 1.5, md: 2 },
                                py: { xs: 1, sm: 1.25 },
                                mb: level === 0 ? 1 : 0.75,
                                borderRadius: 1,
                                border: "1px solid",
                                borderColor: "divider",
                                bgcolor: "background.paper",
                                boxShadow: "0 1px 2px rgba(0, 0, 0, 0.06)",
                                ml: indentPx ? `${indentPx}px` : 0,
                                width: indentPx ? `calc(100% - ${indentPx}px)` : "100%",
                              }}
                            >
                              <Stack
                                direction="row"
                                alignItems="center"
                                gap={1}
                                sx={{ minWidth: 0 }}
                              >
                                <Box
                                  sx={{
                                    width: 16,
                                    height: 16,
                                    borderRadius: "50%",
                                    border: "2px solid",
                                    borderColor: rowStatusColor,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    bgcolor: isDoneStatus ? rowStatusColor : "transparent",
                                    color: "white",
                                    flexShrink: 0,
                                    cursor: isDoneStatus ? "default" : canMarkDoneTask ? "pointer" : "not-allowed",
                                    position: "relative",
                                    ...(!isDoneStatus && canMarkDoneTask
                                      ? {
                                          "&::after": {
                                            content: '"✓"',
                                            position: "absolute",
                                            inset: 0,
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            fontSize: 10,
                                            lineHeight: 1,
                                            color: rowStatusColor,
                                            opacity: 0,
                                            transition: "opacity 0.12s ease-in-out",
                                          },
                                          "&:hover::after": {
                                            opacity: 1,
                                          },
                                        }
                                      : {}),
                                  }}
                                  role="button"
                                  aria-label={
                                    isDoneStatus
                                      ? "Task done"
                                      : canMarkDoneTask
                                        ? "Mark task done"
                                        : "Only assignee can mark task done"
                                  }
                                  onClick={() => handleMarkDone(rowTask)}
                                >
                                  {isDoneStatus && <Check sx={{ fontSize: 12 }} />}
                                </Box>
                                <Typography
                                  variant="body2"
                                  sx={{
                                    cursor: "pointer",
                                    fontWeight: level === 0 ? 600 : 500,
                                    whiteSpace: "nowrap",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                  }}
                                  onClick={() => handleView(rowTask)}
                                >
                                  {rowTask.title}
                                </Typography>
                                {sectionStatus !== "delayed" && childTasks.length > 0 && (
                                  <IconButton
                                    size="small"
                                    onClick={() => toggleParent(rowTask.id)}
                                  >
                                    {isExpanded ? (
                                      <ExpandLess fontSize="small" />
                                    ) : (
                                      <ExpandMore fontSize="small" />
                                    )}
                                  </IconButton>
                                )}
                                {sectionStatus === "delayed" && rowTask.parent_task_id && (
                                  <Typography variant="caption" color="text.secondary">
                                    Subtask
                                  </Typography>
                                )}
                              </Stack>

                              {showProjectColumn && (
                                <Typography
                                  variant="body2"
                                  color={projectLabel === "-" ? "text.secondary" : "text.primary"}
                                  noWrap
                                >
                                  {projectLabel}
                                </Typography>
                              )}

                              <Stack direction="row" alignItems="center" gap={1}>
                                {assigneeLabel !== "-" ? (
                                  <>
                                    <Avatar sx={{ width: 24, height: 24, fontSize: "0.75rem" }}>
                                      {assignee
                                        ? getUserInitials(assignee)
                                        : String(assigneeLabel).slice(0, 2).toUpperCase()}
                                    </Avatar>
                                    <Typography variant="body2" noWrap>
                                      {assigneeLabel}
                                    </Typography>
                                  </>
                                ) : (
                                  <Typography variant="body2" color="text.secondary">
                                    -
                                  </Typography>
                                )}
                              </Stack>

                              <Typography
                                variant="body2"
                                color={rowTask.start_date ? "text.primary" : "text.secondary"}
                              >
                                {formattedStartDate}
                              </Typography>

                              <Typography
                                variant="body2"
                                color={dueDate === "-" ? "text.secondary" : "text.primary"}
                              >
                                {formattedDueDate}
                              </Typography>

                              {!priorityLabel ? (
                                <Typography variant="body2" color="text.secondary">
                                  -
                                </Typography>
                              ) : (
                                <Chip
                                  label={priorityLabel}
                                  size="small"
                                  variant="outlined"
                                  sx={{ ...getTaskPriorityChipSx(rowTask.priority), ...PROJECT_TASK_PRIORITY_CHIP_SX }}
                                />
                              )}

                              <Stack direction="row" justifyContent="flex-end" gap={{ xs: 0.25, sm: 0.5 }}>
                                <Tooltip title="View Task">
                                  <IconButton size="small" onClick={() => handleView(rowTask)}>
                                    <Visibility fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Edit Task">
                                  <IconButton size="small" onClick={() => handleEdit(rowTask)}>
                                    <Edit fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title={canDeleteTask ? "Delete Task" : "Only creator can delete"}>
                                  <span>
                                    <IconButton
                                      size="small"
                                      onClick={() => handleDelete(rowTask)}
                                      disabled={!canDeleteTask}
                                      sx={!canDeleteTask ? { color: "text.disabled" } : undefined}
                                    >
                                      <Delete fontSize="small" />
                                    </IconButton>
                                  </span>
                                </Tooltip>
                              </Stack>
                            </Box>

                            {sectionStatus !== "delayed" && childTasks.length > 0 && (
                              <Collapse in={isExpanded}>
                                {childTasks.map((child: any) =>
                                  renderTaskRow(child, level + 1, sectionStatus)
                                )}
                              </Collapse>
                            )}
                          </Box>
                        );
                      };

                        return renderTaskRow(task, 0, status);
                      })}
                    </Box>
                      </Box>
                    </Box>
                  </Collapse>
                </Box>
              );
            })
          )}
        </Box>
      </Box>

      {/* View Task Dialog */}
      <Dialog
        open={!!viewingTask}
        onClose={closeViewDialog}
        maxWidth="xl"
        fullWidth
        PaperProps={{
          sx: {
            width: "min(1040px, 90vw)",
            maxHeight: "88vh",
          },
        }}
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Stack direction="row" alignItems="center" spacing={0.5} sx={{ minWidth: 0 }}>
            {viewingTaskBackTarget && (
              <Tooltip title={`Back to ${viewingTaskBackTarget.title || "previous task"}`}>
                <IconButton size="small" aria-label="Back to previous task" onClick={handleViewBack}>
                  <ArrowBack fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            <span>Task Details</span>
          </Stack>
          <Stack direction="row" alignItems="center" spacing={0.5}>
            {!isViewingTaskAssignedToCurrentUser && (
              <Tooltip title={viewingTask?.assigned_to ? "Send reminder" : "Task has no assignee"}>
                <span>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={isSendingReminder ? <CircularProgress size={14} /> : <Email fontSize="small" />}
                    disabled={isSendingReminder || !viewingTask?.assigned_to}
                    onClick={handleSendReminder}
                  >
                    Reminder
                  </Button>
                </span>
              </Tooltip>
            )}
            <IconButton
              size="small"
              aria-label="Edit task"
              onClick={() => {
                if (!viewingTask) return;
                const taskToEdit = viewingTask;
                closeViewDialog();
                handleEdit(taskToEdit);
              }}
            >
              <Edit fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              aria-label="Close task details"
              onClick={closeViewDialog}
            >
              <Close fontSize="small" />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent sx={{ px: { xs: 2, md: 3 }, py: 3 }}>
          {viewingTask && (
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1fr) 320px" },
                gap: 3,
                alignItems: "start",
                width: "100%",
              }}
            >
              <Stack gap={3} sx={{ minWidth: 0, pr: { lg: 1 } }}>
                <Box>
                  {viewingTaskParent && (
                    <Stack direction="row" alignItems="center" gap={0.5} sx={{ mb: 0.5, minWidth: 0 }}>
                      <ArrowUpward fontSize="inherit" sx={{ color: "text.secondary", flexShrink: 0 }} />
                      <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
                        Parent:
                      </Typography>
                      <Link
                        component="button"
                        type="button"
                        underline="hover"
                        title={viewingTaskParent.title}
                        onClick={() => handleViewRelatedTask(viewingTaskParent)}
                        sx={{
                          p: 0,
                          border: 0,
                          bgcolor: "transparent",
                          cursor: "pointer",
                          typography: "caption",
                          fontWeight: 600,
                          color: "text.secondary",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {viewingTaskParent.title}
                      </Link>
                    </Stack>
                  )}
                  <Typography variant="h6" gutterBottom>{viewingTask.title}</Typography>
                  <Typography variant="body2" color="text.secondary" paragraph>
                    {viewingTask.description || "No description"}
                  </Typography>
                </Box>

                <Stack direction="row" gap={2} flexWrap="wrap" alignItems="center">
                  <Chip
                    label={formatTaskStatusLabel(viewingTask.status)}
                    sx={getTaskStatusChipSx(viewingTask.status)}
                  />
                  {viewingTask.priority && (
                    <Chip
                      label={formatTaskPriorityLabel(viewingTask.priority)}
                      variant="outlined"
                      sx={{ ...getTaskPriorityChipSx(viewingTask.priority), ...PROJECT_TASK_PRIORITY_CHIP_SX }}
                    />
                  )}
                  {viewingTask.assigned_to && (
                    <Chip
                      label={`Assigned: ${getAssigneeLabel(viewingTask.assigned_to)}`}
                      variant="outlined"
                      size="small"
                      sx={getTaskInfoChipSx()}
                    />
                  )}
                  {viewingTask.progress !== null && (
                    <Chip
                      label={`Progress: ${viewingTask.progress}%`}
                      variant="outlined"
                      size="small"
                      sx={getTaskInfoChipSx()}
                    />
                  )}
                </Stack>

                <Stack direction="row" gap={4} flexWrap="wrap">
                  {viewingTask.start_date && (
                    <Box>
                      <Typography variant="caption" color="text.secondary">Start Date</Typography>
                      <Typography variant="body2">{formatUiDate(viewingTask.start_date, "-")}</Typography>
                    </Box>
                  )}
                  {viewingTask.end_date && (
                    <Box>
                      <Typography variant="caption" color="text.secondary">Original End Date</Typography>
                      <Typography variant="body2">{formatUiDate(viewingTask.end_date, "-")}</Typography>
                    </Box>
                  )}
                  {viewingTask.updated_end_date && (
                    <Box>
                      <Typography variant="caption" color="text.secondary">Updated End Date</Typography>
                      <Typography variant="body2" sx={{ fontWeight: "bold", color: "primary.main" }}>
                        {formatUiDate(viewingTask.updated_end_date, "-")}
                      </Typography>
                    </Box>
                  )}
                </Stack>

                <Box>
                  <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap" sx={{ mb: 1 }}>
                    <AccountTree fontSize="small" sx={{ color: "text.secondary" }} />
                    <Typography variant="h6">Subtasks</Typography>
                    {viewingTaskSubtaskStats.total > 0 && (
                      <Chip
                        label={`${viewingTaskSubtaskStats.done} of ${viewingTaskSubtaskStats.total} done`}
                        variant="outlined"
                        size="small"
                        sx={getTaskInfoChipSx()}
                      />
                    )}
                  </Stack>

                  {isViewingTaskSubtasksLoading ? (
                    <Stack direction="row" alignItems="center" gap={1}>
                      <CircularProgress size={16} />
                      <Typography variant="body2" color="text.secondary">Loading subtasks...</Typography>
                    </Stack>
                  ) : viewingTaskSubtaskStats.total === 0 ? (
                    <Typography variant="body2" color="text.secondary">No subtasks</Typography>
                  ) : (
                    <Paper variant="outlined" sx={{ overflow: "hidden", borderRadius: 1.5 }}>
                      <Box sx={{ px: 2, pt: 1.5, pb: 1.25, bgcolor: "grey.50" }}>
                        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.75 }}>
                          <Typography variant="caption" color="text.secondary">Subtask completion</Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                            {viewingTaskSubtaskStats.percent}%
                          </Typography>
                        </Stack>
                        <LinearProgress
                          variant="determinate"
                          value={viewingTaskSubtaskStats.percent}
                          sx={{ height: 6, borderRadius: 999 }}
                        />
                      </Box>

                      <Box
                        sx={{
                          maxHeight: SUBTASK_LIST_MAX_HEIGHT,
                          overflowY: "auto",
                          // Keep a long subtask list from scrolling the whole
                          // dialog once it reaches its own end.
                          overscrollBehavior: "contain",
                        }}
                      >
                      {viewingTaskSubtaskRows.map(({ task: subtask, level }) => {
                        const isSubtaskDone = isDoneTaskStatus(subtask.status);
                        const subtaskDueDate = subtask.updated_end_date || subtask.end_date;
                        const subtaskMetaParts = [
                          subtask.assigned_to ? getAssigneeLabel(subtask.assigned_to) : "Unassigned",
                          subtaskDueDate ? `Due ${formatUiDate(subtaskDueDate, "-")}` : null,
                          subtask.progress !== null && subtask.progress !== undefined
                            ? `${subtask.progress}%`
                            : null,
                        ].filter(Boolean);

                        return (
                          <Box
                            key={String(subtask.id)}
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 1.25,
                              py: 1,
                              pr: 1,
                              pl: 2 + level * 2.5,
                              borderTop: "1px solid",
                              borderColor: "divider",
                              "&:hover": { bgcolor: "action.hover" },
                            }}
                          >
                            {level > 0 && (
                              <SubdirectoryArrowRight fontSize="small" sx={{ color: "text.disabled", flexShrink: 0 }} />
                            )}
                            {isSubtaskDone ? (
                              <CheckCircle fontSize="small" sx={{ color: "success.main", flexShrink: 0 }} />
                            ) : (
                              <RadioButtonUnchecked fontSize="small" sx={{ color: "text.disabled", flexShrink: 0 }} />
                            )}

                            <Box sx={{ minWidth: 0, flex: 1 }}>
                              <Link
                                component="button"
                                type="button"
                                underline="hover"
                                title={subtask.title}
                                onClick={() => handleViewRelatedTask(subtask)}
                                sx={{
                                  display: "block",
                                  maxWidth: "100%",
                                  p: 0,
                                  border: 0,
                                  bgcolor: "transparent",
                                  textAlign: "left",
                                  cursor: "pointer",
                                  typography: "body2",
                                  fontWeight: 600,
                                  color: "text.primary",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                  ...(isSubtaskDone ? { color: "text.secondary" } : {}),
                                }}
                              >
                                {subtask.title}
                              </Link>
                              {subtaskMetaParts.length > 0 && (
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                  sx={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                                >
                                  {subtaskMetaParts.join(" · ")}
                                </Typography>
                              )}
                            </Box>

                            <Stack direction="row" gap={0.75} alignItems="center" sx={{ flexShrink: 0 }}>
                              {subtask.priority ? (
                                <Chip
                                  label={formatTaskPriorityLabel(subtask.priority)}
                                  variant="outlined"
                                  size="small"
                                  sx={{ ...getTaskPriorityChipSx(subtask.priority), ...PROJECT_TASK_PRIORITY_CHIP_SX }}
                                />
                              ) : (
                                <Box sx={{ width: SUBTASK_PRIORITY_SLOT_WIDTH, flexShrink: 0 }} />
                              )}
                              <Box
                                sx={{
                                  display: "flex",
                                  justifyContent: "flex-end",
                                  minWidth: SUBTASK_STATUS_SLOT_MIN_WIDTH,
                                  flexShrink: 0,
                                }}
                              >
                                <Chip
                                  label={formatTaskStatusLabel(subtask.status)}
                                  size="small"
                                  sx={getTaskStatusChipSx(subtask.status)}
                                />
                              </Box>
                              <Tooltip title="Open subtask">
                                <IconButton
                                  size="small"
                                  aria-label={`Open subtask ${subtask.title}`}
                                  onClick={() => handleViewRelatedTask(subtask)}
                                >
                                  <Visibility fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </Stack>
                          </Box>
                        );
                      })}
                      </Box>
                    </Paper>
                  )}
                </Box>

                <Divider />

                <Box>
                  <Typography variant="h6" gutterBottom>Additional Notes</Typography>
                  {viewingTask.additional_notes ? (
                    <Box
                      sx={{
                        typography: "body2",
                        "& a": { color: "primary.main", textDecoration: "underline" },
                        "& pre": {
                          bgcolor: "grey.50",
                          borderRadius: 1,
                          p: 1,
                          overflowX: "auto",
                        },
                      }}
                      dangerouslySetInnerHTML={{ __html: sanitizeRichText(viewingTask.additional_notes) }}
                    />
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No additional notes
                    </Typography>
                  )}
                </Box>

                <Divider />

                <Box>
                  <Typography variant="h6" gutterBottom>Attachments</Typography>

                  <Paper sx={{ p: 2, mb: 2, bgcolor: "grey.50" }}>
                    <Stack direction="row" gap={1} alignItems="center">
                      <Button
                        variant="outlined"
                        component="label"
                        startIcon={uploadingFile ? <CircularProgress size={16} /> : <AttachFile />}
                        disabled={uploadingFile}
                        size="small"
                      >
                        {uploadingFile ? "Uploading..." : "Upload Files"}
                        <input
                          type="file"
                          hidden
                          multiple
                          onChange={handleFileUpload}
                          disabled={uploadingFile}
                        />
                      </Button>
                      <Typography variant="caption" color="text.secondary">
                        Max file size: 10MB
                      </Typography>
                    </Stack>
                  </Paper>

                  {isAttachmentsLoading ? (
                    <Typography variant="body2" color="text.secondary">Loading attachments...</Typography>
                  ) : attachments.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">No attachments</Typography>
                  ) : (
                    <List>
                      {attachments.map((attachment: any) => {
                        const storageObject = attachment?.storage_object_id;
                        const attachmentName =
                          String(storageObject?.filename || "").trim() ||
                          String(storageObject?.file || "").trim().split("/").pop() ||
                          "Unnamed file";
                        const numericAttachmentSize = Number(storageObject?.size);
                        const attachmentSize = Number.isFinite(numericAttachmentSize) ? numericAttachmentSize : null;
                        const attachmentCreatedAt = String(attachment?.created_at || storageObject?.created_at || "").trim();
                        return (
                        <ListItem
                          key={attachment.id}
                          sx={{ px: 0, py: 1 }}
                          secondaryAction={
                            <Stack direction="row" gap={1}>
                              <IconButton
                                size="small"
                                onClick={() => handleDownloadAttachment(attachment)}
                                title="Download"
                              >
                                <Download fontSize="small" />
                              </IconButton>
                              <IconButton
                                size="small"
                                onClick={() => handleDeleteAttachment(attachment.id)}
                                title="Delete"
                              >
                                <Close fontSize="small" />
                              </IconButton>
                            </Stack>
                          }
                        >
                          <ListItemText
                            primary={
                              <Stack direction="row" gap={1} alignItems="center">
                                <AttachFile fontSize="small" />
                                <Typography variant="body2">{attachmentName}</Typography>
                              </Stack>
                            }
                            secondary={
                              <Typography variant="caption" color="text.secondary">
                                {attachmentSize !== null ? `${(attachmentSize / 1024).toFixed(1)} KB` : "Unknown size"}
                                {attachmentCreatedAt ? ` | ${formatActivityTimestamp(attachmentCreatedAt)}` : ""}
                              </Typography>
                            }
                          />
                        </ListItem>
                        );
                      })}
                    </List>
                  )}
                </Box>
              </Stack>

              <Paper
                variant="outlined"
                sx={{
                  p: 2.5,
                  borderRadius: 2,
                  alignSelf: "start",
                  width: "100%",
                  minHeight: 420,
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <Typography variant="h6" gutterBottom>Activity & Comments</Typography>

                <Box sx={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", justifyContent: "flex-end", mb: 2 }}>
                  {activities.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      No activity yet
                    </Typography>
                  ) : (
                    <List ref={activityListRef} sx={{ overflowY: "auto", maxHeight: "42vh" }}>
                      {chronologicalActivities.map(renderActivityItem)}
                  </List>
                )}
                </Box>

                <Paper sx={{ p: 2, bgcolor: "grey.50", mt: "auto" }}>
                  <Stack direction="row" gap={1}>
                    <TextField
                      fullWidth
                      size="small"
                      placeholder="Add a comment..."
                      inputRef={newCommentInputRef}
                      onChange={(event) => {
                        const nextHasText = String(event.target.value || "").trim().length > 0;
                        syncCommentDraft(nextHasText);
                      }}
                      multiline
                      rows={2}
                    />
                    <Button
                      variant="contained"
                      onClick={handleAddComment}
                      disabled={!hasCommentDraft}
                    >
                      Add
                    </Button>
                  </Stack>
                </Paper>
              </Paper>
            </Box>
          )}
        </DialogContent>
      </Dialog>

      <TaskActivityHtmlPreviewDialog
        open={!!activityPreview}
        title={activityPreview?.title || ADDITIONAL_INFO_ACTIVITY_LABEL}
        html={activityPreview?.html || null}
        onClose={() => setActivityPreview(null)}
      />

    </Box>
  );
});

TaskList.displayName = "TaskList";
