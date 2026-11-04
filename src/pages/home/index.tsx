import { useList, useGo, useGetIdentity } from "@refinedev/core";
import { Avatar, Box, Button, Chip, Divider, Grid, Card, CardContent, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material";
import { AccessTime, Add, ChatBubbleOutline } from "@mui/icons-material";
import { useMemo, useRef, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { isProjectVisibleToUser } from "../../utils/projectAccess";
import { TaskList, type TaskListHandle } from "../../components/tasks/TaskList";
import type { TaskFilters } from "../../components/tasks/taskFilters";
import {
  formatTaskPriorityLabel,
  formatTaskStatusLabel,
  getTaskPriorityChipSx,
  getTaskStatusChipSx,
  getTaskStatusColor,
  normalizeTaskStatus,
} from "../../utils/taskVisuals";
import { formatProjectStatusLabel, getProjectStatusChipColor } from "../../utils/projectVisuals";
import { formatUiDate } from "../../utils/dateFormat";
import { parseActivityTimestamp } from "../../utils/activityTimeline";
import { resolveUserId, extractIdentityId, extractIdentityUuid, formatUserLabel, getUserInitials } from "../../utils/userResolver";

const SHARED_TASK_DIALOG_FILTERS: TaskFilters = {
  sortBy: "created_at",
  sortOrder: "desc",
  filterPriority: "all",
  filterAssignedTo: "all",
  hideDone: false,
};

export const Home = () => {
  const go = useGo();
  const sharedTaskDialogRef = useRef<TaskListHandle>(null);
  const { data: user } = useGetIdentity();
  const [recentCommentsProjectFilter, setRecentCommentsProjectFilter] = useState<string>("all");
  const [recentCommentsTimeFilter, setRecentCommentsTimeFilter] = useState<string>("all");
  const { result: projectsResult } = useList({ 
    resource: "projects",
    pagination: { mode: "off" },
    queryOptions: {
      staleTime: 0,
      refetchOnMount: "always",
    },
  });

  const projects = projectsResult?.data || [];

  const currentUserId = extractIdentityId(user);
  const currentUserUuid = extractIdentityUuid(user);
  const { result: projectFavoritesResult } = useList({
    resource: "project_favorites",
    filters: currentUserUuid ? [{ field: "user_id", operator: "eq", value: currentUserUuid }] : [],
    pagination: { mode: "off" },
    queryOptions: { enabled: !!currentUserUuid },
  });
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
  const { result: allTasksResult } = useList({
    resource: "tasks",
    meta: { populate: ["assigned_to"] },
    pagination: { mode: "off" },
  });
  const { result: recentActivitiesResult } = useList({
    resource: "task_activities",
    sorters: [{ field: "created_at", order: "desc" }],
    meta: { populate: ["user_id"] },
    pagination: { mode: "off" },
  });
  const allTasks = allTasksResult?.data || [];
  const recentActivities = recentActivitiesResult?.data || [];
  const { result: employeeResult } = useList({
    resource: "org_employees",
    filters: currentUserId ? [{ field: "user_id", operator: "eq", value: currentUserId }] : [],
    pagination: { mode: "off" },
    queryOptions: { enabled: !!currentUserId },
  });

  const employee = employeeResult?.data?.[0];
  const { result: teamMembersResult } = useList({
    resource: "org_team_members",
    filters: employee?.id ? [{ field: "employee_id", operator: "eq", value: employee.id }] : [],
    pagination: { mode: "off" },
    queryOptions: { enabled: !!employee?.id },
  });
  const { result: projectDepartmentsResult } = useList({
    resource: "project_departments",
    pagination: { mode: "off" },
  });
  const { result: projectTeamsResult } = useList({
    resource: "project_teams",
    pagination: { mode: "off" },
  });
  const { result: projectObserversResult } = useList({
    resource: "project_observers",
    pagination: { mode: "off" },
  });

  const userDepartmentId = employee?.department_id ?? null;
  const userTeamIds = (teamMembersResult?.data || []).map((m: any) => m.team_id);
  const departmentIdsByProject = (projectDepartmentsResult?.data || []).reduce(
    (acc: Record<string, string[]>, row: any) => {
      const projectKey = String(row.project_id);
      if (!acc[projectKey]) acc[projectKey] = [];
      acc[projectKey].push(String(row.department_id));
      return acc;
    },
    {}
  );
  const teamIdsByProject = (projectTeamsResult?.data || []).reduce(
    (acc: Record<string, string[]>, row: any) => {
      const projectKey = String(row.project_id);
      if (!acc[projectKey]) acc[projectKey] = [];
      acc[projectKey].push(String(row.team_id));
      return acc;
    },
    {}
  );
  const observerUserIdsByProject = (projectObserversResult?.data || []).reduce(
    (acc: Record<string, string[]>, row: any) => {
      const projectKey = String(row.project_id);
      if (!acc[projectKey]) acc[projectKey] = [];
      acc[projectKey].push(String(row.user_id));
      return acc;
    },
    {}
  );
  const visibleProjects = projects.filter((project: any) =>
    isProjectVisibleToUser(project, userDepartmentId, userTeamIds, currentUserId, {
      departmentIdsByProject,
      teamIdsByProject,
      observerUserIdsByProject,
    })
  );

  const visibleProjectIds = new Set(visibleProjects.map((project: any) => String(project.id)));
  const projectById = visibleProjects.reduce((acc: Record<string, any>, project: any) => {
    acc[String(project.id)] = project;
    return acc;
  }, {});
  const visibleTaskById = allTasks.reduce((acc: Record<string, any>, task: any) => {
    if (visibleProjectIds.has(String(task.project_id))) {
      acc[String(task.id)] = task;
    }
    return acc;
  }, {});

  const parseDate = (value?: string) => {
    if (!value) return null;
    const parsed = new Date(`${value}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const next7Days = new Date(today);
  next7Days.setDate(today.getDate() + 7);
  const isTaskComplete = (task: any) => {
    const status = String(task?.status || "").trim().toLowerCase().replace(/\s+/g, "_");
    return ["done", "complete", "completed", "closed"].includes(status);
  };
  const isTaskDelayed = (task: any) => {
    if (isTaskComplete(task)) return false;
    const dueDate = parseDate(task?.updated_end_date || task?.end_date);
    if (!dueDate) return false;
    return dueDate < today;
  };

  const isAssignedToCurrentUser = (task: any) => {
    if (currentUserId == null) return false;
    const assignedId = resolveUserId(task?.assigned_to);
    return assignedId != null && String(assignedId) === String(currentUserId);
  };
  const myTasks = allTasks.filter((task: any) => isAssignedToCurrentUser(task));
  const overdueTasks = myTasks.filter((task: any) => isTaskDelayed(task));
  const dueInNext7Days = myTasks.filter((t: any) => {
    if (isTaskComplete(t)) return false;
    const dueDate = parseDate(t.updated_end_date || t.end_date);
    if (!dueDate) return false;
    return dueDate >= today && dueDate <= next7Days;
  });
  const formatRelativeTime = (value: any) => {
    const parsed = parseActivityTimestamp(value);
    if (!parsed) return "Unknown";
    const now = Date.now();
    const diffMs = Math.max(0, now - parsed);
    const diffMinutes = Math.floor(diffMs / (60 * 1000));
    const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
    const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));

    if (diffMinutes < 1) return "Just now";
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatUiDate(parsed, "Unknown");
  };
  const getActivityUser = (value: any) => {
    if (value === null || value === undefined || value === "") return null;
    if (typeof value === "object") return value;
    return userById[String(value)] || null;
  };

  const toProjectRecency = (project: any) => {
    const raw = project?.created_at || project?.start_date || null;
    const parsed = raw ? Date.parse(String(raw)) : NaN;
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const favoriteProjectIdSet = new Set(
    (projectFavoritesResult?.data || []).map((favorite: any) => String(favorite?.project_id))
  );
  const favoriteProjects = currentUserUuid
    ? visibleProjects.filter((project: any) =>
        favoriteProjectIdSet.has(String(project?.id))
      )
    : [];
  const recentProjects = [...visibleProjects].sort((a: any, b: any) => toProjectRecency(b) - toProjectRecency(a));
  const recentActiveProjects = (() => {
    const picked: any[] = [];
    const seen = new Set<string>();
    favoriteProjects
      .sort((a: any, b: any) => toProjectRecency(b) - toProjectRecency(a))
      .forEach((project: any) => {
        if (picked.length >= 3) return;
        const key = String(project.id);
        if (seen.has(key)) return;
        picked.push(project);
        seen.add(key);
      });
    recentProjects.forEach((project: any) => {
      if (picked.length >= 3) return;
      const key = String(project.id);
      if (seen.has(key)) return;
      picked.push(project);
      seen.add(key);
    });
    return picked;
  })();
  const normalizeDashboardStatus = (value?: string) => {
    return normalizeTaskStatus(value) || "in_progress";
  };
  const dashboardStatusColors: Record<string, string> = {
    delayed: getTaskStatusColor("delayed"),
    todo: getTaskStatusColor("todo"),
    in_progress: getTaskStatusColor("in_progress"),
    on_hold: getTaskStatusColor("on_hold"),
    review: getTaskStatusColor("review"),
    done: getTaskStatusColor("done"),
  };

  const dashboardStatusCounts = myTasks.reduce(
    (acc: Record<string, number>, task: any) => {
      if (isTaskDelayed(task)) {
        acc.delayed += 1;
        return acc;
      }
      const key = normalizeDashboardStatus(task.status);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    },
    { delayed: 0, todo: 0, in_progress: 0, review: 0, on_hold: 0, done: 0 }
  );

  const projectSummaryItems = [
    { key: "delayed", label: "DELAYED", value: dashboardStatusCounts.delayed, color: dashboardStatusColors.delayed },
    { key: "todo", label: "TO DO", value: dashboardStatusCounts.todo, color: dashboardStatusColors.todo },
    { key: "in_progress", label: "IN PROGRESS", value: dashboardStatusCounts.in_progress, color: dashboardStatusColors.in_progress },
    { key: "review", label: "REVIEW", value: dashboardStatusCounts.review, color: dashboardStatusColors.review },
    { key: "on_hold", label: "ON HOLD", value: dashboardStatusCounts.on_hold, color: dashboardStatusColors.on_hold },
    { key: "done", label: "DONE", value: dashboardStatusCounts.done, color: dashboardStatusColors.done },
  ];

  const totalDashboardProjects = projectSummaryItems.reduce((sum, item) => sum + item.value, 0);
  const projectChartData =
    totalDashboardProjects > 0
      ? projectSummaryItems.filter((item) => item.value > 0)
      : [{ key: "empty", label: "NO DATA", value: 1, color: "#cfd8dc" }];

  const formatStatusLabel = (value?: string) => {
    return formatTaskStatusLabel(value);
  };

  const formatDate = (value?: string) => {
    return formatUiDate(value, "No due date");
  };

  const formatDueWindow = (value?: string) => {
    const parsed = parseDate(value);
    if (!parsed) return "No due date";
    const diffDays = Math.round((parsed.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
    if (diffDays === 0) return "Due today";
    if (diffDays === 1) return "Due tomorrow";
    if (diffDays > 1) return `Due in ${diffDays} days`;
    return `Due ${formatDate(value)}`;
  };

  const openTaskFromDashboard = (task: any) => {
    if (!task) return;
    sharedTaskDialogRef.current?.openTask(task);
  };
  const openAssignmentsByStatus = (statusKey?: string) => {
    const normalized = String(statusKey || "").trim().toLowerCase().replace(/\s+/g, "_");
    if (!normalized || normalized === "empty") {
      go({ to: "/assignments" });
      return;
    }
    const params = new URLSearchParams();
    params.set("status", normalized);
    go({ to: `/assignments?${params.toString()}` });
  };
  const recentCommentProjectOptions = [...visibleProjects].sort((a: any, b: any) =>
    String(a.name || "").localeCompare(String(b.name || ""))
  );
  const recentCommentsStartTime = (() => {
    const now = Date.now();
    if (recentCommentsTimeFilter === "24h") return now - 24 * 60 * 60 * 1000;
    if (recentCommentsTimeFilter === "7d") return now - 7 * 24 * 60 * 60 * 1000;
    if (recentCommentsTimeFilter === "30d") return now - 30 * 24 * 60 * 60 * 1000;
    if (recentCommentsTimeFilter === "today") {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      return start.getTime();
    }
    return null;
  })();
  const recentComments = recentActivities
    .filter((activity: any) => {
      const commentText = String(activity?.comment || "").trim();
      if (!commentText) return false;
      const actionText = String(activity?.action || "").trim().toLowerCase();
      if (!actionText.includes("comment")) return false;
      const task = visibleTaskById[String(activity.task_id)];
      if (!task) return false;
      const projectId = String(task.project_id);
      if (!visibleProjectIds.has(projectId)) return false;
      if (recentCommentsProjectFilter !== "all" && projectId !== recentCommentsProjectFilter) return false;
      if (recentCommentsStartTime !== null) {
        const activityTime = parseActivityTimestamp(activity.created_at);
        if (!activityTime || activityTime < recentCommentsStartTime) return false;
      }
      return true;
    })
    .sort((a: any, b: any) => {
      const aTime = parseActivityTimestamp(a?.created_at) || 0;
      const bTime = parseActivityTimestamp(b?.created_at) || 0;
      return bTime - aTime;
    })
    .slice(0, 10);
  const getDashboardChipWidthCh = (
    labels: string[],
    options?: { minWidthCh?: number; paddingCh?: number; bufferCh?: number }
  ) => {
    const longest = labels.reduce((max, label) => Math.max(max, String(label || "").trim().length), 0);
    const minWidthCh = options?.minWidthCh ?? 8;
    const paddingCh = options?.paddingCh ?? 3;
    const bufferCh = options?.bufferCh ?? 1;
    return Math.max(minWidthCh, longest + paddingCh + bufferCh);
  };

  const getDashboardTaskChipSx = (widthCh: number) =>
    ({
      height: 22,
      width: "auto",
      minWidth: `${widthCh}ch`,
      maxWidth: "none",
      flex: "0 0 auto",
      justifyContent: "center",
      "& .MuiChip-label": {
        px: 0.65,
        fontSize: "0.6rem",
        fontWeight: 600,
        lineHeight: 1.05,
        letterSpacing: 0,
        whiteSpace: "nowrap",
      },
    }) as const;

  const overdueChipWidthCh = getDashboardChipWidthCh(
    [
      "DELAYED",
      "IN PROGRESS",
      ...overdueTasks
        .map((task: any) => formatTaskPriorityLabel(task.priority))
        .filter((label: string) => Boolean(label)),
    ],
    { minWidthCh: 9, paddingCh: 1, bufferCh: 0 }
  );
  const overdueDashboardTaskChipSx = getDashboardTaskChipSx(overdueChipWidthCh);

  const dueChipWidthCh = getDashboardChipWidthCh(
    dueInNext7Days.flatMap((task: any) => {
      const isDelayed = isTaskDelayed(task);
      const statusValue = isDelayed ? "delayed" : (task?.status || "in_progress");
      const labels = [formatStatusLabel(statusValue)];
      const priorityLabel = formatTaskPriorityLabel(task.priority);
      if (priorityLabel) labels.push(priorityLabel);
      return labels;
    }),
    { minWidthCh: 9, paddingCh: 1, bufferCh: 0 }
  );
  const dueDashboardTaskChipSx = getDashboardTaskChipSx(dueChipWidthCh);

  return (
    <Box
      sx={{
        p: { xs: 2, md: 3 },
        backgroundColor: "#f5f5f7",
        minHeight: "100%",
        m: { xs: -2, md: -3 },
      }}
    >
      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, lg: 6 }}>
          <Card sx={{ borderRadius: 2, border: "1px solid", borderColor: "divider", boxShadow: "none", height: "100%" }}>
            <CardContent sx={{ p: 2.5 }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  Project Management Dashboard
                </Typography>
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<Add />}
                  onClick={() => sharedTaskDialogRef.current?.openCreateTask()}
                >
                  Add Task
                </Button>
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                A quick snapshot of your projects and tasks
              </Typography>
              <Divider sx={{ mb: 2.5 }} />
              <Grid container spacing={2} alignItems="center" sx={{ minHeight: 200 }}>
                <Grid
                  size={{ xs: 12, sm: 4 }}
                  sx={{ display: "flex", alignItems: "center", justifyContent: "center" }}
                >
                  <Box sx={{ width: 220, maxWidth: "100%", height: 180, mx: "auto", position: "relative" }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={projectChartData}
                          dataKey="value"
                          nameKey="label"
                          innerRadius={48}
                          outerRadius={80}
                          startAngle={0}
                          endAngle={360}
                          strokeWidth={0}
                          onClick={(payload: any) => {
                            const key = String(payload?.key || payload?.payload?.key || "").trim();
                            openAssignmentsByStatus(key);
                          }}
                        >
                          {projectChartData.map((item) => (
                            <Cell
                              key={item.key}
                              fill={item.color}
                              style={{ cursor: item.key === "empty" ? "default" : "pointer" }}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: any, _name: any, props: any) => {
                            const label = props?.payload?.label || "Status";
                            return [value, label];
                          }}
                          labelFormatter={() => "Status"}
                          wrapperStyle={{ zIndex: 20 }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <Box
                      role="button"
                      aria-label="Open My Assignments"
                      tabIndex={0}
                      onClick={() => go({ to: "/assignments" })}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          go({ to: "/assignments" });
                        }
                      }}
                      sx={{
                        position: "absolute",
                        left: "50%",
                        top: "50%",
                        width: 96,
                        height: 96,
                        transform: "translate(-50%, -50%)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        borderRadius: "50%",
                        zIndex: 1,
                        transition: "color 0.2s ease",
                        "&:hover .dashboard-total": {
                          color: "primary.main",
                        },
                      }}
                    >
                      <Typography className="dashboard-total" variant="h3" sx={{ fontWeight: 700, lineHeight: 1 }}>
                        {totalDashboardProjects}
                      </Typography>
                    </Box>
                  </Box>
                </Grid>
                <Grid size={{ xs: 12, sm: 8 }} sx={{ display: "flex", alignItems: "center" }}>
                  <Box sx={{ width: "100%" }}>
                    <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                      My Tasks
                    </Typography>
                    <Grid container spacing={1.5}>
                      {projectSummaryItems.map((item) => (
                        <Grid key={item.key} size={{ xs: 6 }}>
                          <Typography
                            variant="h4"
                            sx={{ color: item.color, fontWeight: 700, lineHeight: 1.2, cursor: "pointer" }}
                            onClick={() => openAssignmentsByStatus(item.key)}
                          >
                            {item.value}
                          </Typography>
                          <Typography
                            variant="caption"
                            sx={{ color: "text.secondary", letterSpacing: 0.4, cursor: "pointer", textDecoration: "underline" }}
                            onClick={() => openAssignmentsByStatus(item.key)}
                          >
                            {item.label}
                          </Typography>
                        </Grid>
                      ))}
                    </Grid>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, lg: 6 }}>
          <Card sx={{ borderRadius: 2, border: "1px solid", borderColor: "divider", boxShadow: "none", height: "100%" }}>
            <CardContent sx={{ p: 2.5 }}>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Favorite and Recent Projects
              </Typography>
              <Divider sx={{ mt: 1, mb: 1.5 }} />
              <Stack spacing={1.25}>
                {recentActiveProjects.length === 0 ? (
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      No active projects available.
                    </Typography>
                  </Paper>
                ) : (
                  recentActiveProjects.map((project: any) => {
                    return (
                      <Paper
                        key={project.id}
                        variant="outlined"
                        onClick={() => go({ to: `/projects/show/${project.id}` })}
                        sx={{
                          p: 1.75,
                          borderRadius: 1.5,
                          cursor: "pointer",
                          transition: "border-color 0.2s ease, background-color 0.2s ease",
                          "&:hover": { borderColor: "primary.main", backgroundColor: "#fafafa" },
                        }}
                      >
                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 700, minWidth: 0 }}>
                            {project.name}
                          </Typography>
                          <Chip
                            label={formatProjectStatusLabel(project.status)}
                            size="small"
                            color={getProjectStatusChipColor(project.status)}
                            sx={{ flexShrink: 0 }}
                          />
                        </Stack>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                          {project.description || "No description"}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.8 }}>
                          Start: {formatUiDate(project.start_date, "N/A")}
                        </Typography>
                      </Paper>
                    );
                  })
                )}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ borderRadius: 2, border: "1px solid", borderColor: "divider", boxShadow: "none", height: "100%" }}>
            <CardContent sx={{ p: 2.25 }}>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                My Overdue Tasks
              </Typography>
              <Divider sx={{ mt: 1, mb: 1.5 }} />
              {overdueTasks.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No overdue tasks assigned to you.
                </Typography>
              ) : (
                <Stack spacing={1.1}>
                  {overdueTasks.map((task: any) => (
                    <Paper
                      key={task.id}
                      variant="outlined"
                      onClick={() => openTaskFromDashboard(task)}
                      sx={{ p: 1.25, borderRadius: 1.5, cursor: "pointer" }}
                    >
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 600 }} noWrap>
                            {task.title}
                          </Typography>
                          <Stack direction="row" spacing={0.6} alignItems="center" sx={{ mt: 0.45 }}>
                            <AccessTime sx={{ fontSize: 14, color: "text.secondary" }} />
                            <Typography variant="caption" color="text.secondary">
                              Due {formatUiDate(task.updated_end_date || task.end_date, "N/A")}
                            </Typography>
                          </Stack>
                        </Box>
                        <Stack direction="row" spacing={0.6}>
                          {task.priority ? (
                            <Chip
                              label={formatTaskPriorityLabel(task.priority)}
                              size="small"
                              variant="outlined"
                              sx={{ ...getTaskPriorityChipSx(task.priority), ...overdueDashboardTaskChipSx }}
                            />
                          ) : null}
                          <Chip
                            label="DELAYED"
                            size="small"
                            sx={{ ...getTaskStatusChipSx("delayed"), ...overdueDashboardTaskChipSx }}
                          />
                        </Stack>
                      </Stack>
                    </Paper>
                  ))}
                </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ borderRadius: 2, border: "1px solid", borderColor: "divider", boxShadow: "none", height: "100%" }}>
            <CardContent sx={{ p: 2.25 }}>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                My Tasks Due in Next 7 Days
              </Typography>
              <Divider sx={{ mt: 1, mb: 1.5 }} />
              {dueInNext7Days.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No upcoming tasks due in the next 7 days.
                </Typography>
              ) : (
                <Stack spacing={1.1}>
                  {dueInNext7Days.map((task: any) => {
                    const isDelayed = isTaskDelayed(task);
                    const statusValue = isDelayed ? "delayed" : (task?.status || "in_progress");
                    const statusLabel = formatStatusLabel(statusValue);
                    return (
                      <Paper
                        key={task.id}
                        variant="outlined"
                        onClick={() => openTaskFromDashboard(task)}
                        sx={{ p: 1.25, borderRadius: 1.5, cursor: "pointer" }}
                      >
                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600 }} noWrap>
                              {task.title}
                            </Typography>
                            <Stack direction="row" spacing={0.6} alignItems="center" sx={{ mt: 0.45 }}>
                              <AccessTime sx={{ fontSize: 14, color: "text.secondary" }} />
                              <Typography variant="caption" color="text.secondary">
                                {formatDueWindow(task.updated_end_date || task.end_date)}
                              </Typography>
                            </Stack>
                          </Box>
                          <Stack direction="row" spacing={0.6}>
                            {task.priority ? (
                              <Chip
                                label={formatTaskPriorityLabel(task.priority)}
                                size="small"
                                variant="outlined"
                                sx={{ ...getTaskPriorityChipSx(task.priority), ...dueDashboardTaskChipSx }}
                              />
                            ) : null}
                            <Chip
                              label={statusLabel}
                              size="small"
                              sx={{ ...getTaskStatusChipSx(statusValue), ...dueDashboardTaskChipSx }}
                            />
                          </Stack>
                        </Stack>
                      </Paper>
                    );
                  })}
                </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ borderRadius: 2, border: "1px solid", borderColor: "divider", boxShadow: "none", height: "100%" }}>
            <CardContent sx={{ p: 2.25 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1} flexWrap="wrap">
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Recent Comments
                </Typography>
                <Stack direction="row" spacing={1}>
                  <TextField
                    select
                    size="small"
                    value={recentCommentsProjectFilter}
                    onChange={(event) => setRecentCommentsProjectFilter(event.target.value)}
                    sx={{ minWidth: 140 }}
                  >
                    <MenuItem value="all">All Projects</MenuItem>
                    {recentCommentProjectOptions.map((project: any) => (
                      <MenuItem key={project.id} value={String(project.id)}>
                        {project.name || `Project ${project.id}`}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    select
                    size="small"
                    value={recentCommentsTimeFilter}
                    onChange={(event) => setRecentCommentsTimeFilter(event.target.value)}
                    sx={{ minWidth: 105 }}
                  >
                    <MenuItem value="all">All Time</MenuItem>
                    <MenuItem value="24h">24 Hours</MenuItem>
                    <MenuItem value="7d">7 Days</MenuItem>
                    <MenuItem value="30d">30 Days</MenuItem>
                    <MenuItem value="today">Today</MenuItem>
                  </TextField>
                </Stack>
              </Stack>
              <Divider sx={{ mt: 1, mb: 1.5 }} />
              {recentComments.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No recent comments found for the selected filters.
                </Typography>
              ) : (
                <Stack spacing={1.1}>
                  {recentComments.map((activity: any) => {
                    const task = visibleTaskById[String(activity.task_id)];
                    const project = task ? projectById[String(task.project_id)] : null;
                    const actor = getActivityUser(activity.user_id);
                    const actorId = actor?.id ?? (typeof activity.user_id === "object" ? activity.user_id?.id : activity.user_id);
                    const actorName = formatUserLabel(actor) || `User ${actorId ?? ""}`;
                    const contextLabel = `${project?.name || "Unknown Project"}${task?.title ? `  •  ${task.title}` : ""}`;
                    return (
                      <Paper
                        key={activity.id}
                        variant="outlined"
                        onClick={() => {
                          if (task) openTaskFromDashboard(task);
                        }}
                        sx={{
                          p: 1.25,
                          borderRadius: 1.5,
                          cursor: task ? "pointer" : "default",
                        }}
                      >
                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1} sx={{ mb: 0.8 }}>
                          <Stack direction="row" alignItems="center" spacing={1}>
                            <Avatar sx={{ width: 28, height: 28, fontSize: "0.72rem", bgcolor: "#f1f3f4", color: "#212121" }}>
                              {getUserInitials(actor)}
                            </Avatar>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                              {actorName}
                            </Typography>
                          </Stack>
                          <Chip
                            label={formatRelativeTime(activity.created_at)}
                            size="small"
                            sx={{ height: 22, fontSize: "0.68rem", fontWeight: 600, bgcolor: "#f1f3f4" }}
                          />
                        </Stack>
                        <Stack direction="row" spacing={0.6} alignItems="center" sx={{ mb: 0.45 }}>
                          <ChatBubbleOutline sx={{ fontSize: 14, color: "text.secondary" }} />
                          <Typography variant="caption" color="text.secondary" noWrap>
                            {contextLabel}
                          </Typography>
                        </Stack>
                        <Typography variant="body2" sx={{ lineHeight: 1.4, whiteSpace: "pre-wrap" }}>
                          {activity.comment}
                        </Typography>
                      </Paper>
                    );
                  })}
                </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Box sx={{ display: "none" }}>
        <TaskList
          ref={sharedTaskDialogRef}
          projectId={null}
          filters={SHARED_TASK_DIALOG_FILTERS}
          showList={false}
        />
      </Box>
    </Box>
  );
};
