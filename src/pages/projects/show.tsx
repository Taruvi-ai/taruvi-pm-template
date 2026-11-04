import { useGetIdentity, useGo, useList, useShow } from "@refinedev/core";
import { Show, Breadcrumb } from "@refinedev/mui";
import { Typography, Stack, Chip, Box, ToggleButtonGroup, ToggleButton, Tooltip, IconButton } from "@mui/material";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router";
import { TaskBoard } from "../../components/tasks/TaskBoard";
import { TaskGantt } from "../../components/tasks/TaskGantt";
import { TaskList, type TaskListHandle } from "../../components/tasks/TaskList";
import { ViewList, ViewKanban, Timeline, BarChart } from "@mui/icons-material";
import { TaskFiltersBar } from "../../components/tasks/TaskFiltersBar";
import type { TaskFilters } from "../../components/tasks/taskFilters";
import { isProjectVisibleToUser } from "../../utils/projectAccess";
import { formatUiDate } from "../../utils/dateFormat";
import { getAssigneeLabel as resolveAssigneeLabel, extractIdentityId } from "../../utils/userResolver";

export const ProjectShow = () => {
  const location = useLocation();
  const go = useGo();
  const { result, query: { isLoading } } = useShow({ resource: "projects" });
  const { data: user } = useGetIdentity();
  const [activeTab, setActiveTab] = useState(0);
  const [taskFilters, setTaskFilters] = useState<TaskFilters>({
    sortBy: "created_at",
    sortOrder: "desc",
    filterPriority: "all",
    filterAssignedTo: "all",
    hideDone: true,
    search: "",
  });
  const taskListRef = useRef<TaskListHandle>(null);
  const [initialExpandedStatus, setInitialExpandedStatus] = useState<string | null>(null);

  const project = result;
  const projectStatusLabel = String(project?.status || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  const projectId = project?.id !== undefined && project?.id !== null ? String(project.id) : "";
  const hasProjectId = projectId.trim().length > 0;

  const userId = extractIdentityId(user);

  useEffect(() => {
    if (!project?.name) return;
    document.title = `${project.name} | Project Management`;
  }, [project?.name]);

  useEffect(() => {
    const params = new URLSearchParams(location.search || "");
    const statusParam = String(params.get("status") || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_");
    if (!statusParam) return;
    setInitialExpandedStatus(statusParam);
    setActiveTab(0);
    setTaskFilters((prev) => ({
      ...prev,
      hideDone: statusParam !== "done",
    }));
  }, [location.search]);

  const { result: employeeResult } = useList({
    resource: "org_employees",
    filters: userId ? [{ field: "user_id", operator: "eq", value: userId }] : [],
    pagination: { mode: "off" },
    queryOptions: { enabled: !!userId },
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
    filters: hasProjectId ? [{ field: "project_id", operator: "eq", value: projectId }] : [],
    pagination: { mode: "off" },
    queryOptions: { enabled: hasProjectId },
  });
  const { result: projectTeamsResult } = useList({
    resource: "project_teams",
    filters: hasProjectId ? [{ field: "project_id", operator: "eq", value: projectId }] : [],
    pagination: { mode: "off" },
    queryOptions: { enabled: hasProjectId },
  });
  const { result: projectObserversResult } = useList({
    resource: "project_observers",
    filters: hasProjectId ? [{ field: "project_id", operator: "eq", value: projectId }] : [],
    pagination: { mode: "off" },
    queryOptions: { enabled: hasProjectId },
  });

  const userDepartmentId = employee?.department_id ?? null;
  const userTeamIds = (teamMembersResult?.data || []).map((m: any) => m.team_id);
  const departmentIdsByProject = useMemo(
    () =>
      (projectDepartmentsResult?.data || []).reduce((acc: Record<string, string[]>, row: any) => {
        const key = String(row.project_id);
        if (!acc[key]) acc[key] = [];
        acc[key].push(String(row.department_id));
        return acc;
      }, {}),
    [projectDepartmentsResult?.data]
  );
  const teamIdsByProject = useMemo(
    () =>
      (projectTeamsResult?.data || []).reduce((acc: Record<string, string[]>, row: any) => {
        const key = String(row.project_id);
        if (!acc[key]) acc[key] = [];
        acc[key].push(String(row.team_id));
        return acc;
      }, {}),
    [projectTeamsResult?.data]
  );
  const observerUserIdsByProject = useMemo(
    () =>
      (projectObserversResult?.data || []).reduce((acc: Record<string, string[]>, row: any) => {
        const key = String(row.project_id);
        if (!acc[key]) acc[key] = [];
        acc[key].push(String(row.user_id));
        return acc;
      }, {}),
    [projectObserversResult?.data]
  );
  const canViewProject = project
    ? isProjectVisibleToUser(project, userDepartmentId, userTeamIds, userId, {
        departmentIdsByProject,
        teamIdsByProject,
        observerUserIdsByProject,
      })
    : true;

  const { result: assigneesResult } = useList({
    resource: "tasks",
    filters: hasProjectId ? [{ field: "project_id", operator: "eq", value: projectId }] : [],
    pagination: { mode: "off" },
    queryOptions: { enabled: hasProjectId },
    meta: { populate: ["assigned_to"] },
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
  const getAssigneeLabel = (value: any) => resolveAssigneeLabel(value, userById);

  const assignedToOptions = Array.from(
    new Map(
      (assigneesResult?.data || [])
        .map((task: any) => task.assigned_to)
        .filter((assignee: any) => assignee !== null && assignee !== undefined && assignee !== "")
        .map((assignee: any) => {
          const optionValue =
            typeof assignee === "object"
              ? String(assignee?.id ?? "")
              : String(assignee);
          return [optionValue, getAssigneeLabel(assignee)] as [string, string];
        })
        .filter(([value]) => value.length > 0)
    ).entries()
  )
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label));

  if (isLoading) return <div>Loading...</div>;
  if (!canViewProject) {
    return (
      <Show
        isLoading={isLoading}
        title={false}
        headerButtons={() => null}
        goBack={null}
        contentProps={{ sx: { p: 0 } }}
        wrapperProps={{
          sx: {
            bgcolor: "transparent",
            boxShadow: "none",
            border: "none",
            p: 0,
            overflow: "visible",
          },
        }}
        breadcrumb={
          <Breadcrumb
            breadcrumbProps={{
              sx: { px: 2, pt: 2, pb: 0 },
            }}
          />
        }
        headerProps={{ sx: { pt: 0 } }}
      >
        <Box sx={{ px: { xs: 1, md: 2, lg: 3 }, py: 3 }}>
          <Typography variant="h6">You don’t have access to this project.</Typography>
          <Typography variant="body2" color="text.secondary">
            This project is restricted to specific teams or departments.
          </Typography>
        </Box>
      </Show>
    );
  }

  return (
    <Show
      isLoading={isLoading}
      title={false}
      headerButtons={() => null}
      goBack={null}
      contentProps={{ sx: { p: 0 } }}
      wrapperProps={{
        sx: {
          bgcolor: "transparent",
          boxShadow: "none",
          border: "none",
          p: 0,
          overflow: "visible",
        },
      }}
      breadcrumb={
        <Breadcrumb
          breadcrumbProps={{
            sx: { px: 2, pt: 2, pb: 0 },
          }}
        />
      }
      headerProps={{ sx: { pt: 0 } }}
    >
      <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <Stack gap={2} sx={{ px: { xs: 1, md: 2, lg: 3 }, pt: 2, mb: 2 }}>
          <Stack gap={0.5}>
            <Stack direction="row" alignItems="center" flexWrap="wrap" gap={2}>
              <Typography variant="h5">
                {project?.name}
              </Typography>
              {project?.status && (
                <Chip
                  label={projectStatusLabel === "completed" || projectStatusLabel === "complete" ? "Done" : project.status}
                  size="small"
                  sx={{
                    bgcolor: "primary.main",
                    color: "white",
                    textTransform: "capitalize",
                    fontWeight: 600,
                  }}
                />
              )}
              <Stack direction="row" gap={2} alignItems="center" flexWrap="wrap">
                {project?.start_date && (
                  <Typography variant="body2" color="text.secondary">
                    Start: {formatUiDate(project.start_date, "N/A")}
                  </Typography>
                )}
                {project?.end_date && (
                  <Typography variant="body2" color="text.secondary">
                    End: {formatUiDate(project.end_date, "N/A")}
                  </Typography>
                )}
              </Stack>
            </Stack>
            {project?.description && (
              <Typography variant="body2" color="text.secondary">
                {project.description}
              </Typography>
            )}
          </Stack>

          <TaskFiltersBar
            filters={taskFilters}
            onChange={setTaskFilters}
            onAddTask={() => taskListRef.current?.openCreateTask()}
            assignedToOptions={assignedToOptions}
            showHideDone={activeTab !== 1}
            showSort
            showOrder
            showStatusSortOption={false}
            paperSx={{ bgcolor: "transparent", border: "none", boxShadow: "none" }}
            rightActions={
              <Stack direction="row" spacing={0.75} alignItems="center">
                <ToggleButtonGroup
                  size="small"
                  exclusive
                  value={activeTab}
                  onChange={(_, v) => {
                    if (v === null) return;
                    setActiveTab(v);
                  }}
                  sx={{ bgcolor: "background.paper" }}
                >
                  <ToggleButton value={0} aria-label="Task list view">
                    <Tooltip title="Task List">
                      <ViewList fontSize="small" />
                    </Tooltip>
                  </ToggleButton>
                  <ToggleButton value={1} aria-label="Board view">
                    <Tooltip title="Board View">
                      <ViewKanban fontSize="small" />
                    </Tooltip>
                  </ToggleButton>
                  <ToggleButton value={2} aria-label="Gantt chart view">
                    <Tooltip title="Gantt Chart">
                      <Timeline fontSize="small" />
                    </Tooltip>
                  </ToggleButton>
                </ToggleButtonGroup>
                <Tooltip title="Project Dashboard">
                  <span>
                    <IconButton
                      size="small"
                      aria-label="Project dashboard"
                      disabled={!hasProjectId}
                      onClick={() => {
                        if (!hasProjectId) return;
                        go({ to: `/projects/dashboard/${projectId}` });
                      }}
                      sx={{
                        bgcolor: "background.paper",
                        border: "1px solid",
                        borderColor: "divider",
                        borderRadius: 1,
                      }}
                    >
                      <BarChart fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              </Stack>
            }
          />
        </Stack>

        {hasProjectId && (
          <Box
            sx={{
              bgcolor: "#EBEBEC",
              borderRadius: 0,
              mx: { xs: -1, md: -2, lg: -3 },
              flex: 1,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <Box sx={{ px: { xs: 2, md: 4, lg: 6 }, py: 2, flex: 1 }}>
              <TaskList
                ref={taskListRef}
                projectId={projectId}
                filters={taskFilters}
                showList={activeTab === 0}
                initialExpandedStatus={initialExpandedStatus}
              />
              {activeTab === 1 && (
                <TaskBoard
                  projectId={projectId}
                  filters={{ ...taskFilters, hideDone: false }}
                  onOpenTask={(task, trail) => taskListRef.current?.openTask(task, { trail })}
                />
              )}
              {activeTab === 2 && (
                <TaskGantt
                  projectId={projectId}
                  filters={taskFilters}
                  onOpenTask={(task, trail) => taskListRef.current?.openTask(task, { trail })}
                />
              )}
            </Box>
          </Box>
        )}
      </Box>
    </Show>
  );
};
