import { useGetIdentity, useList } from "@refinedev/core";
import {
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Chip,
  FormControlLabel,
  IconButton,
  ButtonGroup,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { ChevronLeft, ChevronRight, Today } from "@mui/icons-material";
import { useEffect, useMemo, useRef, useState } from "react";
import { isProjectVisibleToUser } from "../../utils/projectAccess";
import { TaskList, type TaskListHandle } from "../../components/tasks/TaskList";
import type { TaskFilters } from "../../components/tasks/taskFilters";
import {
  formatTaskPriorityLabel,
  formatTaskStatusLabel,
  getTaskPriorityChipSx,
  getTaskStatusChipSx,
  isDoneTaskStatus,
} from "../../utils/taskVisuals";
import { modalAlert } from "../../components/dialogs/globalDialogs";
import { extractIdentityId } from "../../utils/userResolver";

const parseDate = (value?: string) => {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};
const getWeekStart = (date: Date) => {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  start.setDate(start.getDate() - start.getDay());
  return start;
};
const getWeekEnd = (weekStart: Date) => {
  const end = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate());
  end.setDate(end.getDate() + 6);
  return end;
};

const getStartDate = (task: any) => parseDate(task.start_date || task.end_date || task.updated_end_date);
const getEndDate = (task: any) => parseDate(task.updated_end_date || task.end_date || task.start_date);
const DEFAULT_PROJECT_COLOR = "#1976d2";
const SHARED_TASK_DIALOG_FILTERS: TaskFilters = {
  sortBy: "created_at",
  sortOrder: "desc",
  filterPriority: "all",
  filterAssignedTo: "all",
  hideDone: false,
};
const isHexColor = (value: unknown) =>
  typeof value === "string" && /^#(?:[0-9a-fA-F]{3}){1,2}$/.test(value.trim());

export const CalendarView = () => {
  const alert = (message: string) => {
    void modalAlert(message, "Notice");
  };
  const sharedTaskDialogRef = useRef<TaskListHandle>(null);
  const { data: user } = useGetIdentity();
  const [assignedOnly, setAssignedOnly] = useState(true);
  const [hideDone, setHideDone] = useState(true);
  const [selectedDepartmentIds, setSelectedDepartmentIds] = useState<string[]>([]);
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const today = new Date();
  const [viewMode, setViewMode] = useState<"month" | "week" | "year">("month");
  const [viewDate, setViewDate] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));

  // Clear selections when switching back to assigned-only view
  useEffect(() => {
    if (assignedOnly && (selectedDepartmentIds.length > 0 || selectedTeamIds.length > 0)) {
      setSelectedDepartmentIds([]);
      setSelectedTeamIds([]);
    }
  }, [assignedOnly, selectedDepartmentIds.length, selectedTeamIds.length]);

  const currentUserId = extractIdentityId(user);

  const { result: projectsResult } = useList({
    resource: "projects",
    pagination: { mode: "off" },
  });

  const { result: departmentsResult } = useList({
    resource: "org_departments",
    pagination: { mode: "off" },
  });

  const { result: teamsResult } = useList({
    resource: "org_teams",
    pagination: { mode: "off" },
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

  const userDepartmentId = employee?.department_id ?? null;
  const userTeamIds = (teamMembersResult?.data || []).map((m: any) => String(m.team_id));
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
  const visibleProjects = (projectsResult?.data || []).filter((project: any) =>
    isProjectVisibleToUser(project, userDepartmentId, userTeamIds, currentUserId, {
      departmentIdsByProject,
      teamIdsByProject,
      observerUserIdsByProject,
    })
  );
  const projectColorById = useMemo(
    () =>
      visibleProjects.reduce((acc: Record<string, string>, project: any) => {
        acc[String(project.id)] = isHexColor(project?.color) ? project.color : DEFAULT_PROJECT_COLOR;
        return acc;
      }, {}),
    [visibleProjects]
  );
  const getTaskProjectColor = (task: any) =>
    projectColorById[String(task?.project_id)] || DEFAULT_PROJECT_COLOR;

  const departmentOptions = (departmentsResult?.data || []).filter((dept: any) =>
    userDepartmentId != null && String(dept.id) === String(userDepartmentId)
  );
  const teamOptions = (teamsResult?.data || []).filter((team: any) =>
    userTeamIds.includes(String(team.id))
  );

  const hasSelection = selectedDepartmentIds.length > 0 || selectedTeamIds.length > 0;
  const projectOptions = useMemo(() => {
    if (!hasSelection) return visibleProjects;
    return visibleProjects.filter((project: any) => {
      const projectDeptIds = departmentIdsByProject[String(project.id)] || [];
      const projectTeamIds = teamIdsByProject[String(project.id)] || [];
      const departmentMatch =
        selectedDepartmentIds.length > 0 &&
        selectedDepartmentIds.some((id) => projectDeptIds.includes(id));
      const teamMatch =
        selectedTeamIds.length > 0 &&
        selectedTeamIds.some((id) => projectTeamIds.includes(id));
      return departmentMatch || teamMatch;
    });
  }, [hasSelection, selectedDepartmentIds, selectedTeamIds, visibleProjects]);

  const projectIdsForFilter = useMemo(() => {
    if (selectedProjectId) {
      return visibleProjects
        .filter((project: any) => String(project.id) === String(selectedProjectId))
        .map((project: any) => project.id);
    }
    if (assignedOnly) {
      return visibleProjects.map((project: any) => project.id);
    }
    if (!hasSelection) return [];
    return visibleProjects
      .filter((project: any) => {
        const projectDeptIds = departmentIdsByProject[String(project.id)] || [];
        const projectTeamIds = teamIdsByProject[String(project.id)] || [];
        const departmentMatch =
          selectedDepartmentIds.length > 0 &&
          selectedDepartmentIds.some((id) => projectDeptIds.includes(id));
        const teamMatch =
          selectedTeamIds.length > 0 &&
          selectedTeamIds.some((id) => projectTeamIds.includes(id));
        return departmentMatch || teamMatch;
      })
      .map((project: any) => project.id);
  }, [
    assignedOnly,
    hasSelection,
    selectedDepartmentIds,
    selectedTeamIds,
    visibleProjects,
    selectedProjectId,
    departmentIdsByProject,
    teamIdsByProject,
  ]);

  const shouldFetchTasks = projectIdsForFilter.length > 0;
  const tasksFilters: any[] = [];
  if (projectIdsForFilter.length === 1) {
    tasksFilters.push({ field: "project_id", operator: "eq", value: projectIdsForFilter[0] });
  }
  if (assignedOnly) {
    if (currentUserId) {
      tasksFilters.push({ field: "assigned_to", operator: "eq", value: currentUserId });
    } else {
      tasksFilters.push({ field: "assigned_to", operator: "eq", value: "__no_matching_user__" });
    }
  }

  const { result, query: { isLoading, refetch } } = useList({
    resource: "tasks",
    filters: tasksFilters,
    meta: { populate: ["assigned_to"] },
    pagination: { mode: "off" },
    sorters: [{ field: "end_date", order: "asc" }],
    queryOptions: {
      enabled: shouldFetchTasks,
    },
  });

  const fetchedTasks = result?.data || [];
  const projectIdSet = useMemo(
    () => new Set(projectIdsForFilter.map((id) => String(id))),
    [projectIdsForFilter]
  );
  const tasks = useMemo(
    () => fetchedTasks.filter((task: any) => projectIdSet.has(String(task.project_id))),
    [fetchedTasks, projectIdSet]
  );
  const calendarTasks = useMemo(
    () => (hideDone ? tasks.filter((task: any) => !isDoneTaskStatus(task?.status)) : tasks),
    [tasks, hideDone]
  );

  useEffect(() => {
    if (!assignedOnly && (selectedDepartmentIds.length > 0 || selectedTeamIds.length > 0)) {
      refetch();
    }
  }, [assignedOnly, selectedDepartmentIds, selectedTeamIds, refetch]);

  const viewYear = viewDate.getFullYear();
  const viewMonth = viewDate.getMonth();
  const weekStart = getWeekStart(viewDate);
  const weekEnd = getWeekEnd(weekStart);
  const weekDays = Array.from({ length: 7 }).map(
    (_, idx) => new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + idx)
  );
  const getMonthMeta = (year: number, month: number) => {
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0);
    const daysInMonth = monthEnd.getDate();
    const firstDayIndex = monthStart.getDay(); // 0 = Sunday
    const totalCells = Math.ceil((firstDayIndex + daysInMonth) / 7) * 7;
    const dayCells = Array.from({ length: totalCells }).map((_, idx) => {
      const dayNumber = idx - firstDayIndex + 1;
      if (dayNumber < 1 || dayNumber > daysInMonth) return null;
      return dayNumber;
    });
    return { monthStart, monthEnd, daysInMonth, firstDayIndex, dayCells };
  };

  const { monthStart, monthEnd, dayCells } = getMonthMeta(viewYear, viewMonth);

  const tasksWithDates = calendarTasks
    .map((task: any) => {
      const start = getStartDate(task);
      const end = getEndDate(task);
      if (!start || !end) return null;
      return { task, start, end };
    })
    .filter(Boolean) as Array<{ task: any; start: Date; end: Date }>;

  const visibleMonthTasks = tasksWithDates.filter(({ start, end }) => {
    return end >= monthStart && start <= monthEnd;
  });
  const visibleWeekTasks = tasksWithDates.filter(({ start, end }) => {
    return end >= weekStart && start <= weekEnd;
  });

  const tasksWithoutDates = calendarTasks.filter(
    (task: any) => !getStartDate(task) || !getEndDate(task)
  );

  const openTaskFromCalendar = (task: any) => {
    sharedTaskDialogRef.current?.openTask(task);
  };

  if (isLoading) return <div>Loading...</div>;

  const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const weekTitle =
    weekStart.getFullYear() === weekEnd.getFullYear()
      ? `${weekStart.toLocaleDateString("default", { month: "short", day: "numeric" })} - ${weekEnd.toLocaleDateString("default", { month: "short", day: "numeric", year: "numeric" })}`
      : `${weekStart.toLocaleDateString("default", { month: "short", day: "numeric", year: "numeric" })} - ${weekEnd.toLocaleDateString("default", { month: "short", day: "numeric", year: "numeric" })}`;
  const viewTitle =
    viewMode === "month"
      ? new Date(viewYear, viewMonth, 1).toLocaleString("default", { month: "long", year: "numeric" })
      : viewMode === "week"
        ? weekTitle
        : String(viewYear);
  const yearStart = new Date(viewYear, 0, 1);
  const yearEnd = new Date(viewYear, 11, 31);
  const visibleYearTasks = tasksWithDates.filter(({ start, end }) => {
    return end >= yearStart && start <= yearEnd;
  });

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" sx={{ mb: 2 }}>
        <Stack direction="row" alignItems="center" gap={1}>
          <IconButton
            size="small"
            onClick={() =>
              setViewDate((prev) =>
                viewMode === "month"
                  ? new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
                  : viewMode === "week"
                    ? new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() - 7)
                    : new Date(prev.getFullYear() - 1, prev.getMonth(), 1)
              )
            }
            aria-label="Previous"
          >
            <ChevronLeft fontSize="small" />
          </IconButton>
          <Typography variant="h5">
            Calendar View - {viewTitle}
          </Typography>
          <IconButton
            size="small"
            onClick={() =>
              setViewDate((prev) =>
                viewMode === "month"
                  ? new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
                  : viewMode === "week"
                    ? new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() + 7)
                    : new Date(prev.getFullYear() + 1, prev.getMonth(), 1)
              )
            }
            aria-label="Next"
          >
            <ChevronRight fontSize="small" />
          </IconButton>
          <Button
            size="small"
            variant="text"
            startIcon={<Today fontSize="small" />}
            onClick={() =>
              setViewDate(
                viewMode === "week"
                  ? new Date(today.getFullYear(), today.getMonth(), today.getDate())
                  : new Date(today.getFullYear(), today.getMonth(), 1)
              )
            }
          >
            Today
          </Button>
        </Stack>
        <ButtonGroup size="small" variant="outlined">
          <Button
            variant={viewMode === "month" ? "contained" : "outlined"}
            onClick={() => setViewMode("month")}
          >
            Month
          </Button>
          <Button
            variant={viewMode === "week" ? "contained" : "outlined"}
            onClick={() => setViewMode("week")}
          >
            Week
          </Button>
          <Button
            variant={viewMode === "year" ? "contained" : "outlined"}
            onClick={() => setViewMode("year")}
          >
            Full Year
          </Button>
        </ButtonGroup>
      </Stack>
      <Stack direction="row" alignItems="center" gap={2} flexWrap="wrap" sx={{ mb: 2 }}>
        <FormControlLabel
          control={
            <Checkbox
              checked={assignedOnly}
              onChange={(e) => setAssignedOnly(e.target.checked)}
            />
          }
          label="Tasks Assigned to Me"
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={hideDone}
              onChange={(e) => setHideDone(e.target.checked)}
            />
          }
          label="Hide done"
        />
        {!assignedOnly && (
          <>
            <Autocomplete
              multiple
              options={departmentOptions}
              getOptionLabel={(option: any) => option.name}
              getOptionKey={(option: any) => String(option?.id ?? "")}
              value={departmentOptions.filter((d: any) => selectedDepartmentIds.includes(String(d.id)))}
              onChange={(_, newValue) => setSelectedDepartmentIds(newValue.map((item: any) => String(item.id)))}
              renderInput={(params) => (
                <TextField {...params} label="Departments" placeholder="Select departments" />
              )}
              sx={{ minWidth: 220 }}
            />
            <Autocomplete
              multiple
              options={teamOptions}
              getOptionLabel={(option: any) => option.name}
              getOptionKey={(option: any) => String(option?.id ?? "")}
              value={teamOptions.filter((t: any) => selectedTeamIds.includes(String(t.id)))}
              onChange={(_, newValue) => setSelectedTeamIds(newValue.map((item: any) => String(item.id)))}
              renderInput={(params) => (
                <TextField {...params} label="Teams" placeholder="Select teams" />
              )}
              sx={{ minWidth: 220 }}
            />
          </>
        )}
        <Autocomplete
          options={projectOptions}
          getOptionLabel={(option: any) => option.name}
          getOptionKey={(option: any) => String(option?.id ?? "")}
          value={projectOptions.find((p: any) => String(p.id) === String(selectedProjectId)) || null}
          onChange={(_, newValue) => setSelectedProjectId(newValue?.id != null ? String(newValue.id) : null)}
          renderInput={(params) => (
            <TextField {...params} label="Project (Optional)" placeholder="All projects" />
          )}
          sx={{ minWidth: 240 }}
          isOptionEqualToValue={(option, selected) => String(option.id) === String(selected?.id)}
        />
      </Stack>
      {!currentUserId && (
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          No user found. Showing empty calendar.
        </Typography>
      )}
      {!assignedOnly && !hasSelection && !selectedProjectId ? (
        <Typography color="text.secondary">Select at least one team, department, or project.</Typography>
      ) : !assignedOnly && hasSelection && projectIdsForFilter.length === 0 ? (
        <Typography color="text.secondary">
          No projects match the selected teams/departments.
        </Typography>
      ) : !assignedOnly && selectedProjectId && projectIdsForFilter.length === 0 ? (
        <Typography color="text.secondary">
          No projects match the selected project.
        </Typography>
      ) : calendarTasks.length === 0 ? (
        <Typography color="text.secondary">
          {assignedOnly ? "No tasks assigned to you." : "No tasks for the selected teams/departments."}
        </Typography>
      ) : (
        <Stack gap={2}>
          {viewMode === "month" ? (
            <Paper sx={{ p: 2, overflowX: "auto" }}>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: "repeat(7, minmax(140px, 1fr))",
                  gap: 1,
                }}
              >
                {weekdayLabels.map((label) => (
                  <Box
                    key={label}
                    sx={{
                      fontWeight: 600,
                      color: "text.secondary",
                      fontSize: 12,
                      textTransform: "uppercase",
                    }}
                  >
                    {label}
                  </Box>
                ))}
                {dayCells.map((dayNumber, idx) => {
                  if (!dayNumber) {
                    return <Box key={`empty-${idx}`} sx={{ height: 120 }} />;
                  }
                  const date = new Date(viewYear, viewMonth, dayNumber);
                  const dayTasks = visibleMonthTasks.filter(({ start, end }) => {
                    return start <= date && end >= date;
                  });

                  return (
                    <Box
                      key={dayNumber}
                      sx={{
                        border: "1px solid",
                        borderColor: "divider",
                        borderRadius: 1,
                        minHeight: 120,
                        p: 1,
                        display: "flex",
                        flexDirection: "column",
                        gap: 0.5,
                        bgcolor:
                          dayNumber === today.getDate() &&
                          viewYear === today.getFullYear() &&
                          viewMonth === today.getMonth()
                            ? "action.hover"
                            : "background.paper",
                      }}
                    >
                      <Typography variant="caption" color="text.secondary">
                        {dayNumber}
                      </Typography>
                      {dayTasks.length === 0 ? (
                        <Typography variant="caption" color="text.secondary">
                          No tasks
                        </Typography>
                      ) : (
                        dayTasks.map(({ task }) => (
                          <Box
                            key={task.id}
                            sx={{
                              bgcolor: getTaskProjectColor(task),
                              color: "white",
                              borderRadius: 0.5,
                              px: 0.5,
                              py: 0.25,
                              fontSize: 11,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              cursor: "pointer",
                            }}
                            title={task.title}
                            onClick={() => openTaskFromCalendar(task)}
                          >
                            {task.title}
                          </Box>
                        ))
                      )}
                    </Box>
                  );
                })}
              </Box>
              {visibleMonthTasks.length === 0 && (
                <Typography color="text.secondary" sx={{ mt: 2 }}>
                  No tasks in this month.
                </Typography>
              )}
            </Paper>
          ) : viewMode === "week" ? (
            <Paper sx={{ p: 2, overflowX: "auto" }}>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: "repeat(7, minmax(160px, 1fr))",
                  gap: 1,
                }}
              >
                {weekdayLabels.map((label) => (
                  <Box
                    key={`week-header-${label}`}
                    sx={{
                      fontWeight: 600,
                      color: "text.secondary",
                      fontSize: 12,
                      textTransform: "uppercase",
                    }}
                  >
                    {label}
                  </Box>
                ))}
                {weekDays.map((date) => {
                  const dayKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
                  const isToday =
                    date.getDate() === today.getDate() &&
                    date.getMonth() === today.getMonth() &&
                    date.getFullYear() === today.getFullYear();
                  const dayTasks = visibleWeekTasks.filter(({ start, end }) => {
                    return start <= date && end >= date;
                  });

                  return (
                    <Box
                      key={dayKey}
                      sx={{
                        border: "1px solid",
                        borderColor: "divider",
                        borderRadius: 1,
                        minHeight: 180,
                        p: 1,
                        display: "flex",
                        flexDirection: "column",
                        gap: 0.5,
                        bgcolor: isToday ? "action.hover" : "background.paper",
                      }}
                    >
                      <Typography variant="caption" color="text.secondary">
                        {date.toLocaleDateString("default", { month: "short", day: "numeric" })}
                      </Typography>
                      {dayTasks.length === 0 ? (
                        <Typography variant="caption" color="text.secondary">
                          No tasks
                        </Typography>
                      ) : (
                        dayTasks.map(({ task }) => (
                          <Box
                            key={`${dayKey}-${task.id}`}
                            sx={{
                              bgcolor: getTaskProjectColor(task),
                              color: "white",
                              borderRadius: 0.5,
                              px: 0.5,
                              py: 0.25,
                              fontSize: 11,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              cursor: "pointer",
                            }}
                            title={task.title}
                            onClick={() => openTaskFromCalendar(task)}
                          >
                            {task.title}
                          </Box>
                        ))
                      )}
                    </Box>
                  );
                })}
              </Box>
              {visibleWeekTasks.length === 0 && (
                <Typography color="text.secondary" sx={{ mt: 2 }}>
                  No tasks in this week.
                </Typography>
              )}
            </Paper>
          ) : (
            <Paper sx={{ p: 2 }}>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: {
                    xs: "repeat(1, minmax(0, 1fr))",
                    sm: "repeat(2, minmax(0, 1fr))",
                    md: "repeat(3, minmax(0, 1fr))",
                    lg: "repeat(4, minmax(0, 1fr))",
                  },
                  gap: 2,
                }}
              >
                {Array.from({ length: 12 }).map((_, monthIndex) => {
                  const monthLabel = new Date(viewYear, monthIndex, 1).toLocaleString("default", { month: "long" });
                  const monthMeta = getMonthMeta(viewYear, monthIndex);
                  const monthTasks = tasksWithDates.filter(({ start, end }) => {
                    return end >= monthMeta.monthStart && start <= monthMeta.monthEnd;
                  });
                  const weekCount = monthMeta.dayCells.length / 7;
                  const segmentsByWeek: Record<number, Array<{
                    task: any;
                    weekIndex: number;
                    startCol: number;
                    endCol: number;
                  }>> = {};

                  monthTasks.forEach(({ task, start, end }) => {
                    const startDay =
                      start < monthMeta.monthStart ? 1 : start.getDate();
                    const endDay =
                      end > monthMeta.monthEnd ? monthMeta.daysInMonth : end.getDate();
                    const startIndex = monthMeta.firstDayIndex + (startDay - 1);
                    const endIndex = monthMeta.firstDayIndex + (endDay - 1);
                    const startWeek = Math.floor(startIndex / 7);
                    const endWeek = Math.floor(endIndex / 7);

                    for (let weekIndex = startWeek; weekIndex <= endWeek; weekIndex += 1) {
                      const weekStartCol = weekIndex === startWeek ? (startIndex % 7) + 1 : 1;
                      const weekEndCol = weekIndex === endWeek ? (endIndex % 7) + 1 : 7;
                      if (!segmentsByWeek[weekIndex]) segmentsByWeek[weekIndex] = [];
                      segmentsByWeek[weekIndex].push({
                        task,
                        weekIndex,
                        startCol: weekStartCol,
                        endCol: weekEndCol,
                      });
                    }
                  });

                  const weekLanes = Array.from({ length: weekCount }).map(() => {
                    return [] as Array<{
                      task: any;
                      startCol: number;
                      endCol: number;
                      lane: number;
                    }>;
                  });

                  Object.entries(segmentsByWeek).forEach(([weekKey, segments]) => {
                    const weekIndex = Number(weekKey);
                    const sorted = [...segments].sort((a, b) => a.startCol - b.startCol);
                    const laneEnds: number[] = [];
                    sorted.forEach((segment) => {
                      let laneIndex = 0;
                      while (laneIndex < laneEnds.length && segment.startCol <= laneEnds[laneIndex]) {
                        laneIndex += 1;
                      }
                      laneEnds[laneIndex] = segment.endCol;
                      weekLanes[weekIndex].push({
                        task: segment.task,
                        startCol: segment.startCol,
                        endCol: segment.endCol,
                        lane: laneIndex,
                      });
                    });
                  });

                  return (
                    <Box key={`${viewYear}-${monthIndex}`} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1, p: 1 }}>
                      <Button
                        variant="text"
                        size="small"
                        onClick={() => {
                          setViewMode("month");
                          setViewDate(new Date(viewYear, monthIndex, 1));
                        }}
                        sx={{ mb: 1, fontWeight: 600 }}
                      >
                        {monthLabel}
                      </Button>
                      <Box sx={{ display: "grid", gap: 0.5 }}>
                        <Box
                          sx={{
                            display: "grid",
                            gridTemplateColumns: "repeat(7, minmax(24px, 1fr))",
                            gap: 0.5,
                          }}
                        >
                          {weekdayLabels.map((label) => (
                            <Box
                              key={`${monthLabel}-${label}`}
                              sx={{
                                fontWeight: 600,
                                color: "text.secondary",
                                fontSize: 10,
                                textTransform: "uppercase",
                                textAlign: "center",
                              }}
                            >
                              {label[0]}
                            </Box>
                          ))}
                        </Box>
                        {Array.from({ length: weekCount }).map((_, weekIndex) => {
                          const weekDays = monthMeta.dayCells.slice(weekIndex * 7, weekIndex * 7 + 7);
                          const lanes = weekLanes[weekIndex] || [];
                          const laneCount = Math.max(1, ...lanes.map((lane) => lane.lane + 1));

                          return (
                            <Box key={`week-${monthIndex}-${weekIndex}`} sx={{ display: "grid", gap: 0.5 }}>
                              <Box
                                sx={{
                                  display: "grid",
                                  gridTemplateColumns: "repeat(7, minmax(24px, 1fr))",
                                  gap: 0.5,
                                }}
                              >
                                {weekDays.map((dayNumber, dayIdx) => {
                                  if (!dayNumber) {
                                    return <Box key={`empty-${monthIndex}-${weekIndex}-${dayIdx}`} sx={{ height: 24 }} />;
                                  }
                                  const isToday =
                                    dayNumber === today.getDate() &&
                                    viewYear === today.getFullYear() &&
                                    monthIndex === today.getMonth();

                                  return (
                                    <Box
                                      key={`day-${monthIndex}-${weekIndex}-${dayNumber}`}
                                      sx={{
                                        height: 24,
                                        borderRadius: 0.5,
                                        bgcolor: isToday ? "action.hover" : "transparent",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        position: "relative",
                                        fontSize: 10,
                                      }}
                                    >
                                      {dayNumber}
                                    </Box>
                                  );
                                })}
                              </Box>
                              {lanes.length > 0 && (
                                <Box
                                  sx={{
                                    display: "grid",
                                    gridTemplateColumns: "repeat(7, minmax(24px, 1fr))",
                                    gridTemplateRows: `repeat(${laneCount}, 8px)`,
                                    gap: 0.5,
                                  }}
                                >
                                  {lanes.map((lane, laneIdx) => (
                                    <Box
                                      key={`bar-${monthIndex}-${weekIndex}-${laneIdx}`}
                                      title={lane.task.title}
                                      sx={{
                                        gridColumn: `${lane.startCol} / ${lane.endCol + 1}`,
                                        gridRow: lane.lane + 1,
                                        bgcolor: getTaskProjectColor(lane.task),
                                        borderRadius: 4,
                                      }}
                                    />
                                  ))}
                                </Box>
                              )}
                            </Box>
                          );
                        })}
                      </Box>
                    </Box>
                  );
                })}
              </Box>
              {visibleYearTasks.length === 0 && (
                <Typography color="text.secondary" sx={{ mt: 2 }}>
                  No tasks in this year.
                </Typography>
              )}
            </Paper>
          )}

          {tasksWithoutDates.length > 0 && (
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle1" sx={{ mb: 1 }}>
                Tasks without dates
              </Typography>
              <Stack gap={1}>
                {tasksWithoutDates.map((task: any) => (
                  <Stack
                    key={task.id}
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                    gap={2}
                  >
                    <Typography variant="body2">{task.title}</Typography>
                    <Stack direction="row" gap={1}>
                      {task.status && (
                        <Chip
                          label={formatTaskStatusLabel(task.status)}
                          size="small"
                          sx={getTaskStatusChipSx(task.status)}
                        />
                      )}
                      {task.priority && (
                        <Chip
                          label={formatTaskPriorityLabel(task.priority)}
                          size="small"
                          variant="outlined"
                          sx={getTaskPriorityChipSx(task.priority)}
                        />
                      )}
                    </Stack>
                  </Stack>
                ))}
              </Stack>
            </Paper>
          )}
        </Stack>
      )}

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
