import { useDataGrid, List } from "@refinedev/mui";
import { useCreate, useDataProvider, useDelete, useGetIdentity, useGo, useList } from "@refinedev/core";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import { Box, Checkbox, Chip, FormControlLabel, Typography, IconButton, Tooltip, Stack } from "@mui/material";
import { BarChart, Delete, Edit, PushPin, PushPinOutlined, Visibility } from "@mui/icons-material";
import { isProjectVisibleToUser } from "../../utils/projectAccess";
import { formatProjectStatusLabel, getProjectStatusChipColor } from "../../utils/projectVisuals";
import { formatUiDate } from "../../utils/dateFormat";
import { useMemo, useState } from "react";
import { modalAlert, modalConfirm } from "../../components/dialogs/globalDialogs";
import { SearchField } from "../../components/SearchField";
import { extractIdentityId, extractIdentityUuid } from "../../utils/userResolver";

export const ProjectList = () => {
  const alert = (message: string) => {
    void modalAlert(message, "Notice");
  };
  const go = useGo();
  const dataProvider = useDataProvider();
  const { data: user } = useGetIdentity();
  const userId = extractIdentityId(user);
  const userUuid = extractIdentityUuid(user);
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false);
  const [projectSearch, setProjectSearch] = useState("");
  const projectSearchText = projectSearch.trim();
  const { dataGridProps, tableQuery } = useDataGrid({
    resource: "projects",
    sorters: { initial: [{ field: "start_date", order: "desc" }] },
    // Name search runs on the backend (`name__contains` is ILIKE on the platform).
    filters: {
      permanent: projectSearchText
        ? [{ field: "name", operator: "contains", value: projectSearchText }]
        : [],
    },
    // Load every matching project up-front. Visibility + favorites filtering
    // happens on the client, so pagination must be client-side too (see the
    // DataGrid below).
    pagination: { mode: "off" },
  });
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 25 });
  const { result: tasksResult, query: tasksQuery } = useList({
    resource: "tasks",
    pagination: { mode: "off" },
    meta: { select: ["id", "project_id"] },
  });
  const { result: projectFavoritesResult, query: projectFavoritesQuery } = useList({
    resource: "project_favorites",
    filters: userUuid ? [{ field: "user_id", operator: "eq", value: userUuid }] : [],
    pagination: { mode: "off" },
    queryOptions: { enabled: !!userUuid },
  });
  const { mutate: deleteProject } = useDelete();
  const { mutate: createFavorite } = useCreate();
  const [favoriteActionProjectIds, setFavoriteActionProjectIds] = useState<Record<string, boolean>>({});
  const [deleteActionProjectIds, setDeleteActionProjectIds] = useState<Record<string, boolean>>({});

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
  const tasksPanelGrey = "#EBEBEC";
  const listHeaderBg = "#fff";

  const visibleRows = useMemo(
    () =>
      (dataGridProps.rows || []).filter((project: any) =>
        isProjectVisibleToUser(project, userDepartmentId, userTeamIds, userId, {
          departmentIdsByProject,
          teamIdsByProject,
          observerUserIdsByProject,
        })
      ),
    [dataGridProps.rows, userDepartmentId, userTeamIds, userId, departmentIdsByProject, teamIdsByProject, observerUserIdsByProject]
  );
  const favoriteRows = projectFavoritesResult?.data || [];
  const favoriteProjectIds = useMemo(
    () => new Set(favoriteRows.map((row: any) => String(row.project_id))),
    [favoriteRows]
  );
  const filteredRows = useMemo(
    () =>
      showOnlyFavorites
        ? visibleRows.filter((project: any) => favoriteProjectIds.has(String(project.id)))
        : visibleRows,
    [showOnlyFavorites, visibleRows, favoriteProjectIds]
  );
  const taskCountsByProjectId = useMemo(() => {
    return (tasksResult?.data || []).reduce((acc: Record<string, number>, task: any) => {
      if (task?.project_id === null || task?.project_id === undefined) return acc;
      const projectKey = String(task.project_id);
      acc[projectKey] = (acc[projectKey] || 0) + 1;
      return acc;
    }, {});
  }, [tasksResult?.data]);

  const getErrorMessage = (error: any) => {
    const detail = error?.response?.data?.detail;
    if (typeof detail === "string" && detail.trim()) return detail.trim();
    const message = error?.message;
    if (typeof message === "string" && message.trim()) return message.trim();
    return "Unknown error";
  };

  const handleDeleteProject = async (projectId: string | number) => {
    const projectKey = String(projectId);
    if (deleteActionProjectIds[projectKey]) return;
    setDeleteActionProjectIds((prev) => ({ ...prev, [projectKey]: true }));

    if (tasksQuery?.isLoading || tasksQuery?.isFetching) {
      alert("Please wait a moment while project dependencies are being checked.");
      setDeleteActionProjectIds((prev) => {
        const next = { ...prev };
        delete next[projectKey];
        return next;
      });
      return;
    }
    if (tasksQuery?.isError) {
      alert("Unable to verify project dependencies right now. Please try again.");
      setDeleteActionProjectIds((prev) => {
        const next = { ...prev };
        delete next[projectKey];
        return next;
      });
      return;
    }

    const associatedTaskCount = taskCountsByProjectId[String(projectId)] || 0;
    if (associatedTaskCount > 0) {
      const taskLabel = associatedTaskCount === 1 ? "task" : "tasks";
      alert(
        `Cannot delete this project because it has ${associatedTaskCount} associated ${taskLabel}. Please delete or reassign the tasks first.`
      );
      setDeleteActionProjectIds((prev) => {
        const next = { ...prev };
        delete next[projectKey];
        return next;
      });
      return;
    }

    if (!(await modalConfirm("Delete this project?", "Confirm Delete"))) {
      setDeleteActionProjectIds((prev) => {
        const next = { ...prev };
        delete next[projectKey];
        return next;
      });
      return;
    }

    const dp = dataProvider();
    const relationResources = ["project_departments", "project_teams", "project_observers", "project_favorites"];

    try {
      // Remove relation rows first to avoid FK constraint errors on project delete.
      for (const resource of relationResources) {
        const relationResponse = await dp.getList({
          resource,
          filters: [{ field: "project_id", operator: "eq", value: projectId }],
          pagination: { mode: "off" },
          meta: { select: ["id"] },
        });

        const ids = (relationResponse?.data || [])
          .map((row: any) => row?.id)
          .filter((id: any) => id !== null && id !== undefined && id !== "");

        if (ids.length > 0 && dp.deleteMany) {
          await dp.deleteMany({ resource, ids });
        }
      }

      await new Promise<void>((resolve, reject) => {
        deleteProject(
          { resource: "projects", id: projectId },
          {
            onSuccess: () => resolve(),
            onError: (error) => reject(error),
          }
        );
      });

      tableQuery?.refetch?.();
      tasksQuery?.refetch?.();
    } catch (error: any) {
      const errorMessage = getErrorMessage(error).toLowerCase();
      if (
        errorMessage.includes("task") ||
        errorMessage.includes("foreign key") ||
        errorMessage.includes("constraint")
      ) {
        alert("Cannot delete this project because it has associated tasks. Please remove the tasks first.");
        return;
      }
      alert("Failed to delete project. Please try again.");
    } finally {
      setDeleteActionProjectIds((prev) => {
        const next = { ...prev };
        delete next[projectKey];
        return next;
      });
    }
  };

  const setFavoritePending = (projectId: string, pending: boolean) => {
    setFavoriteActionProjectIds((prev) => {
      if (pending) return { ...prev, [projectId]: true };
      const next = { ...prev };
      delete next[projectId];
      return next;
    });
  };

  const handleToggleFavorite = async (project: any) => {
    if (!userUuid) return;
    const projectKey = String(project?.id ?? "");
    if (!projectKey || favoriteActionProjectIds[projectKey]) return;

    setFavoritePending(projectKey, true);

    try {
      const isFavorite = favoriteProjectIds.has(projectKey);
      const dp = dataProvider();

      if (isFavorite) {
        const relationResponse = await dp.getList({
          resource: "project_favorites",
          filters: [
            { field: "project_id", operator: "eq", value: projectKey },
            { field: "user_id", operator: "eq", value: userUuid },
          ],
          pagination: { mode: "off" },
          meta: { select: ["id"] },
        });

        const ids = (relationResponse?.data || [])
          .map((row: any) => row?.id)
          .filter((id: any) => id !== null && id !== undefined && id !== "");

        if (ids.length > 0 && dp.deleteMany) {
          await dp.deleteMany({ resource: "project_favorites", ids });
        }
      } else {
        await new Promise<void>((resolve, reject) => {
          createFavorite(
            {
              resource: "project_favorites",
              values: {
                project_id: projectKey,
                user_id: userUuid,
              },
              successNotification: false,
            },
            {
              onSuccess: () => resolve(),
              onError: (error) => reject(error),
            }
          );
        });
      }

      projectFavoritesQuery?.refetch?.();
    } catch (error: any) {
      alert(`Failed to update favorite. ${getErrorMessage(error)}`);
    } finally {
      setFavoritePending(projectKey, false);
    }
  };

  const columns: GridColDef[] = [
    { 
      field: "name", 
      headerName: "Project Name", 
      flex: 1, 
      minWidth: 200,
    },
    { 
      field: "description", 
      headerName: "Description", 
      flex: 1, 
      minWidth: 250,
    },
    {
      field: "status",
      headerName: "Status",
      width: 130,
      align: "center",
      headerAlign: "center",
      renderCell: ({ value }) => {
        return <Chip label={formatProjectStatusLabel(value)} color={getProjectStatusChipColor(value)} size="small" />;
      },
    },
    { 
      field: "start_date", 
      headerName: "Start Date", 
      width: 120,
      align: "center",
      headerAlign: "center",
      renderCell: ({ value }) => formatUiDate(value, "-"),
    },
    { 
      field: "end_date", 
      headerName: "End Date", 
      width: 120,
      align: "center",
      headerAlign: "center",
      renderCell: ({ value }) => formatUiDate(value, "-"),
    },
    {
      field: "actions",
      headerName: "Actions",
      width: 240,
      sortable: false,
      align: "center",
      headerAlign: "center",
      renderCell: ({ row }) => {
        const rowProjectId = String(row.id);
        const isFavorite = favoriteProjectIds.has(rowProjectId);
        const isFavoritePending = !!favoriteActionProjectIds[rowProjectId];
        const isDeletePending = !!deleteActionProjectIds[rowProjectId];
        return (
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.25 }}>
            <Tooltip title="Favorite">
              <IconButton
                size="small"
                onClick={() => handleToggleFavorite(row)}
                disabled={!userUuid || isFavoritePending}
              >
                {isFavorite ? (
                  <PushPin fontSize="small" sx={{ color: "warning.main" }} />
                ) : (
                  <PushPinOutlined fontSize="small" />
                )}
              </IconButton>
            </Tooltip>
            <Tooltip title="Project Dashboard">
              <IconButton size="small" onClick={() => go({ to: `/projects/dashboard/${row.id}` })}>
                <BarChart fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="View Project">
              <IconButton size="small" onClick={() => go({ to: `/projects/show/${row.id}` })}>
                <Visibility fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Edit Project">
              <IconButton size="small" onClick={() => go({ to: `/projects/edit/${row.id}` })}>
                <Edit fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Delete Project">
              <IconButton size="small" onClick={() => handleDeleteProject(row.id)} disabled={isDeletePending}>
                <Delete fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        );
      },
    },
  ];

  return (
    <List
      title={
        <Stack gap={0.5}>
          <Typography variant="h5">Projects</Typography>
          <Typography variant="body2" color="text.secondary">
            All projects you have access to
          </Typography>
        </Stack>
      }
      contentProps={{ sx: { p: 0, minHeight: "inherit" } }}
      wrapperProps={{
        sx: {
          bgcolor: "transparent",
          boxShadow: "none",
          border: "none",
          p: 0,
          overflow: "visible",
          minHeight: "calc(100vh - var(--nav-height, 0px))",
          display: "flex",
          flexDirection: "column",
        },
      }}
    >
      <Box
        sx={{
          boxSizing: "border-box",
          mx: { xs: -2, md: -3 },
          mb: { xs: -2, md: -3 },
          mt: { xs: 0.5, md: 1 },
        }}
      >
        <Box
          sx={{
            px: { xs: 2, md: 3 },
            py: 1,
            backgroundColor: listHeaderBg,
            borderBottom: "1px solid",
            borderColor: "divider",
          }}
        >
          <Stack direction="row" gap={1.5} flexWrap="wrap" alignItems="center">
            <SearchField
              value={projectSearch}
              onChange={(value) => {
                setProjectSearch(value);
                setPaginationModel((prev) => ({ ...prev, page: 0 }));
              }}
              placeholder="Search projects…"
              ariaLabel="Search projects"
            />
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={showOnlyFavorites}
                  onChange={(event) => setShowOnlyFavorites(event.target.checked)}
                  disabled={!userUuid || !!projectFavoritesQuery?.isLoading}
                />
              }
              label="Show only Favorites"
            />
          </Stack>
        </Box>
        <Box
          sx={{
            p: { xs: 2, md: 3 },
            backgroundColor: tasksPanelGrey,
            minHeight: "calc(100vh - var(--nav-height, 0px) - 52px)",
            boxSizing: "border-box",
          }}
        >
        <DataGrid
          {...dataGridProps}
          rows={filteredRows}
          rowCount={undefined}
          localeText={{
            noRowsLabel: projectSearchText
              ? `No projects match "${projectSearchText}".`
              : "No projects to show.",
          }}
          paginationMode="client"
          paginationModel={paginationModel}
          onPaginationModelChange={setPaginationModel}
          pageSizeOptions={[10, 25, 50, 100]}
          columns={columns}
          disableRowSelectionOnClick
          onRowClick={(params, event) => {
            const target = event.target as HTMLElement;
            if (target.closest("button, a, [role=\"button\"], input, textarea, select")) {
              return;
            }
            go({ to: `/projects/show/${params.id}` });
          }}
          autoHeight 
          sx={{
            bgcolor: "transparent",
            '& .MuiDataGrid-columnHeader, & .MuiDataGrid-cell': {
              px: "15px",
            },
            '& .MuiDataGrid-columnHeaders': {
              backgroundColor: listHeaderBg,
              fontSize: '0.875rem',
              fontWeight: 700,
            },
            '& .MuiDataGrid-columnHeaderTitle': {
              fontWeight: 700,
              fontSize: '0.875rem',
            },
            '& .MuiDataGrid-iconButtonContainer': {
              visibility: "visible",
              width: "auto",
            },
            '& .MuiDataGrid-sortIcon': {
              opacity: 1,
            },
            '& .MuiDataGrid-menuIcon': {
              width: "auto",
              visibility: "visible",
              opacity: 1,
            },
            '& .MuiDataGrid-virtualScroller': {
              backgroundColor: "transparent",
            },
            '& .MuiDataGrid-row': {
              backgroundColor: "background.paper",
              minHeight: '52px !important',
              maxHeight: '52px !important',
              cursor: 'pointer',
            },
            '& .MuiDataGrid-cell': {
              backgroundColor: "background.paper",
              fontSize: '0.8125rem',
              display: 'flex',
              alignItems: 'center',
            },
            '& .MuiDataGrid-cell:focus, & .MuiDataGrid-cell:focus-within': {
              outline: "none",
            },
            '& .MuiDataGrid-row.Mui-selected, & .MuiDataGrid-row.Mui-selected:hover': {
              backgroundColor: "background.paper",
            },
            '& .MuiDataGrid-footerContainer': {
              backgroundColor: listHeaderBg,
              minHeight: 52,
              maxHeight: 52,
              alignItems: "center",
            },
            '& .MuiDataGrid-footerContainer .MuiTablePagination-root': {
              backgroundColor: listHeaderBg,
              width: "100%",
            },
            '& .MuiDataGrid-footerContainer .MuiTablePagination-toolbar': {
              backgroundColor: listHeaderBg,
              minHeight: 52,
              px: 1,
              alignItems: "center",
            },
            '& .MuiDataGrid-bottomContainer': {
              backgroundColor: listHeaderBg,
            },
            '& .MuiDataGrid-scrollbarFiller': {
              backgroundColor: listHeaderBg,
            },
            '& .MuiDataGrid-footerContainer .MuiTablePagination-selectLabel, & .MuiDataGrid-footerContainer .MuiTablePagination-displayedRows': {
              mb: 0,
              mt: 0,
              lineHeight: 1.2,
              display: "flex",
              alignItems: "center",
            },
          }}
        />
        </Box>
      </Box>
    </List>
  );
};
