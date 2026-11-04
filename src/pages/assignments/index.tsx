import { useGetIdentity, useList } from "@refinedev/core";
import {
  Autocomplete,
  Box,
  Button,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router";
import { TaskList, type TaskListHandle } from "../../components/tasks/TaskList";
import { TaskBoard } from "../../components/tasks/TaskBoard";
import { TaskFiltersBar } from "../../components/tasks/TaskFiltersBar";
import type { TaskFilters } from "../../components/tasks/taskFilters";
import { Add, ViewKanban, ViewList } from "@mui/icons-material";
import { extractIdentityId } from "../../utils/userResolver";

export const MyAssignments = () => {
  const location = useLocation();
  const { data: user } = useGetIdentity();
  const [activeTab, setActiveTab] = useState(0);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [initialExpandedStatus, setInitialExpandedStatus] = useState<string | null>(null);
  const [initialOpenTaskId, setInitialOpenTaskId] = useState<string | null>(null);
  const taskListRef = useRef<TaskListHandle>(null);
  const [taskFilters, setTaskFilters] = useState<TaskFilters>({
    sortBy: "created_at",
    sortOrder: "desc",
    filterPriority: "all",
    filterAssignedTo: "all",
    hideDone: true,
    search: "",
  });

  const currentUserId = extractIdentityId(user);

  const taskFiltersForProjects = useMemo(() => {
    if (!currentUserId) return [];
    const filters: any[] = [{ field: "assigned_to", operator: "eq", value: currentUserId }];
    if (taskFilters.filterPriority !== "all") {
      filters.push({ field: "priority", operator: "eq", value: taskFilters.filterPriority });
    }
    if (taskFilters.hideDone) {
      filters.push({ field: "status", operator: "ne", value: "done" });
    }
    return filters;
  }, [currentUserId, taskFilters.filterPriority, taskFilters.hideDone]);

  const { result: tasksForProjectsResult } = useList({
    resource: "tasks",
    filters: taskFiltersForProjects,
    pagination: { mode: "off" },
    queryOptions: { enabled: !!currentUserId },
  });

  const { result: projectsResult } = useList({
    resource: "projects",
    pagination: { mode: "off" },
  });

  const projects = projectsResult?.data || [];
  const projectById = projects.reduce((acc: Record<string, any>, project: any) => {
    acc[String(project.id)] = project;
    return acc;
  }, {});
  const projectIdsForOptions = Array.from(
    new Set((tasksForProjectsResult?.data || []).map((task: any) => String(task.project_id)))
  );
  const projectOptions = projectIdsForOptions
    .map((id) => projectById[id])
    .filter(Boolean);

  useEffect(() => {
    if (selectedProjectId && !projectIdsForOptions.includes(String(selectedProjectId))) {
      setSelectedProjectId(null);
    }
  }, [projectIdsForOptions, selectedProjectId]);

  useEffect(() => {
    if (!currentUserId) return;
    setTaskFilters((prev) => ({
      ...prev,
      filterAssignedTo: String(currentUserId),
    }));
  }, [currentUserId]);

  useEffect(() => {
    const params = new URLSearchParams(location.search || "");
    const statusParam = String(params.get("status") || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_");
    const projectParam = String(params.get("projectId") || "").trim();
    const taskParam = String(params.get("taskId") || "").trim();

    if (statusParam) {
      setInitialExpandedStatus(statusParam);
      setActiveTab(0);
      setTaskFilters((prev) => ({
        ...prev,
        hideDone: statusParam !== "done",
      }));
    }

    if (projectParam) {
      setSelectedProjectId(projectParam);
    }

    if (taskParam) {
      setInitialOpenTaskId(taskParam);
      setActiveTab(0);
      setTaskFilters((prev) => ({
        ...prev,
        hideDone: false,
      }));
    }
  }, [location.search]);

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, minHeight: "100vh", display: "flex", flexDirection: "column", minWidth: 0, overflowX: "hidden" }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "stretch", sm: "flex-start" }}
        gap={2}
        sx={{ mb: 2 }}
      >
        <Stack gap={0.5}>
          <Typography variant="h5">My Assignments</Typography>
          <Typography variant="body2" color="text.secondary">
            Tasks assigned to you across your projects.
          </Typography>
        </Stack>
        <Button
          variant="contained"
          size="small"
          startIcon={<Add />}
          onClick={() => taskListRef.current?.openCreateTask()}
          sx={{ alignSelf: { xs: "flex-start", sm: "auto" } }}
        >
          Add Task
        </Button>
      </Stack>

      <TaskFiltersBar
        filters={taskFilters}
        onChange={setTaskFilters}
        onAddTask={() => undefined}
        paperSx={{ bgcolor: "transparent", border: "none", boxShadow: "none" }}
        leftActions={
          <Autocomplete
            options={projectOptions}
            getOptionLabel={(option: any) => option.name}
            getOptionKey={(option: any) => String(option?.id ?? "")}
            value={projectOptions.find((p: any) => String(p.id) === String(selectedProjectId)) || null}
            onChange={(_, newValue) =>
              setSelectedProjectId(newValue?.id != null ? String(newValue.id) : null)
            }
            renderInput={(params) => (
              <TextField {...params} label="Project" placeholder="All projects" size="small" />
            )}
            sx={{ width: { xs: "100%", sm: 220 }, minWidth: 0, bgcolor: "background.paper" }}
            isOptionEqualToValue={(option, selected) => String(option.id) === String(selected?.id)}
          />
        }
        rightActions={
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
            <ToggleButton value={0} aria-label="List view">
              <ViewList fontSize="small" />
            </ToggleButton>
            <ToggleButton value={1} aria-label="Board view">
              <ViewKanban fontSize="small" />
            </ToggleButton>
          </ToggleButtonGroup>
        }
        assignedToOptions={[]}
        showAssignedToFilter={false}
        showAddTask={false}
        showHideDone={activeTab !== 1}
        showSort
        showOrder
        showStatusSortOption={false}
      />

      <Box
        sx={{
          bgcolor: "#EBEBEC",
          borderRadius: 0,
          mx: { xs: -2, sm: -3, md: -5, lg: -6 },
          px: { xs: 2, sm: 3, md: 5, lg: 6 },
          py: 2,
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
        }}
      >
        {!currentUserId ? (
          <Typography color="text.secondary">Loading user profile...</Typography>
        ) : (
          <>
            <TaskList
              ref={taskListRef}
              projectId={selectedProjectId}
              filters={taskFilters}
              showList={activeTab === 0}
              initialExpandedStatus={initialExpandedStatus}
              initialOpenTaskId={initialOpenTaskId}
              forceProjectPickerOnCreate
            />
            {activeTab === 1 && (
              <TaskBoard
                projectId={selectedProjectId}
                filters={{ ...taskFilters, hideDone: false }}
                onOpenTask={(task) => taskListRef.current?.openTask(task)}
              />
            )}
          </>
        )}
      </Box>
    </Box>
  );
};
