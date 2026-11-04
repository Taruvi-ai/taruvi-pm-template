import { Edit } from "@refinedev/mui";
import { useCreate, useDelete, useGetIdentity, useGo, useList, useNotification, useParsed, useWarnAboutChange, type BaseKey } from "@refinedev/core";
import { useForm } from "@refinedev/react-hook-form";
import {
  Autocomplete,
  Box,
  Breadcrumbs,
  Button,
  Checkbox,
  FormControlLabel,
  Link,
  MenuItem,
  TextField,
  Typography,
} from "@mui/material";
import { Controller } from "react-hook-form";
import { useEffect, useMemo, useRef, useState } from "react";
import { useObserverUserOptions } from "../../hooks/useObserverUserOptions";
import { filterUserOptionsByLabel } from "../../utils/userResolver";
import { modalAlert, modalConfirm } from "../../components/dialogs/globalDialogs";

const normalizeIdArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((v) => String(v).trim())
      .filter((v) => v.length > 0);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    const cleaned = trimmed.replace(/^\{|\}$/g, "");
    return cleaned
      .split(",")
      .map((v) => v.trim())
      .filter((v) => v.length > 0);
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return [String(value)];
  }
  if (typeof value === "bigint") {
    return [String(value)];
  }
  return [];
};

const resolveObserverUserId = (value: unknown): string | null => {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "object") {
    const id = (value as any).id ?? (value as any).user_id;
    if (id === null || id === undefined || id === "") return null;
    return String(id);
  }
  return String(value);
};

const resolveObserverUserObject = (value: unknown): any | null => {
  if (!value || typeof value !== "object") return null;
  const candidate = value as any;
  const id = candidate.id ?? candidate.user_id;
  if (id === null || id === undefined || id === "") return null;
  return candidate;
};

const DEFAULT_PROJECT_COLOR = "#1976d2";
const EDIT_REQUEST_TIMEOUT_MS = 20000;

export const ProjectEdit = () => {
  const { open: openNotification } = useNotification();
  const { setWarnWhen } = useWarnAboutChange();
  const go = useGo();
  const projectsListPath = "/projects";
  const [isSavingProject, setIsSavingProject] = useState(false);
  const initializedRef = useRef<BaseKey | null>(null);
  const { id } = useParsed();
  const projectId = id != null ? String(id) : "";
  const {
    saveButtonProps,
    register,
    control,
    formState: { errors, dirtyFields, isDirty },
    refineCore: { query, onFinish },
    setValue,
    watch,
    handleSubmit,
  } = useForm({
    refineCoreProps: {
      resource: "projects",
      action: "edit",
      id,
      successNotification: false,
    },
    warnWhenUnsavedChanges: false,
  });
  const formId = "project-edit-form";
  const submitSaveButtonProps = {
    ...saveButtonProps,
    onClick: undefined,
    type: "submit" as const,
    form: formId,
    disabled: Boolean(isSavingProject),
  };
  const { mutate: createRelation } = useCreate();
  const { mutate: deleteRelation } = useDelete();
  const [observerSearchText, setObserverSearchText] = useState("");

  useEffect(() => {
    const record = query?.data?.data;
    if (!record?.id) return;
    if (initializedRef.current === record.id) return;

    if (record?.status) {
      setValue("status", record.status);
    }
    setValue("color", record?.color || DEFAULT_PROJECT_COLOR);
    setValue("private_only", record?.private_only ?? false);
    if (record?.created_by_id) {
      setValue("created_by_id", record.created_by_id);
    }
    initializedRef.current = record.id;
  }, [query?.data?.data?.id, setValue]);

  const { data: user } = useGetIdentity();
  const userId =
    (user as any)?.id ||
    (user as any)?.uuid ||
    (user as any)?.data?.id ||
    (user as any)?.data?.uuid ||
    (user as any)?.user_id ||
    (user as any)?.user_uuid ||
    null;
  useEffect(() => {
    const projectName = String(query?.data?.data?.name || "").trim();
    if (!projectName) return;
    document.title = `${projectName} | Project Management`;
  }, [query?.data?.data?.name]);

  const isPrivateOnly = watch("private_only");
  const createdById = watch("created_by_id");
  // Whether-or-not a project has an end date is fixed at creation. Reflect the
  // saved record's state in a read-only checkbox.
  const projectHasNoEndDate = !!query?.data?.data && !query.data.data.end_date;
  const watchedObserverUserIds = watch("observer_user_ids");
  const selectedObserverUserIds = useMemo(
    () => normalizeIdArray(watchedObserverUserIds),
    [watchedObserverUserIds]
  );

  useEffect(() => {
    if (isPrivateOnly) {
      setValue("department_ids", []);
      setValue("team_ids", []);
      if (!createdById && userId) {
        setValue("created_by_id", userId);
      }
    }
  }, [isPrivateOnly, setValue, createdById, userId]);

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
    filters: projectId ? [{ field: "project_id", operator: "eq", value: projectId }] : [],
    pagination: { mode: "off" },
    queryOptions: { enabled: !!projectId },
  });
  const { result: projectTeamsResult } = useList({
    resource: "project_teams",
    filters: projectId ? [{ field: "project_id", operator: "eq", value: projectId }] : [],
    pagination: { mode: "off" },
    queryOptions: { enabled: !!projectId },
  });
  const { result: projectObserversResult } = useList({
    resource: "project_observers",
    filters: projectId ? [{ field: "project_id", operator: "eq", value: projectId }] : [],
    meta: { populate: ["user_id"] },
    pagination: { mode: "off" },
    queryOptions: { enabled: !!projectId },
  });

  const departments = departmentsResult?.data || [];
  const teams = teamsResult?.data || [];
  const { options: observerUsers, isLoading: isObserversLoading } = useObserverUserOptions({
    searchText: observerSearchText,
    selectedUserIds: selectedObserverUserIds,
    initialUsers: (projectObserversResult?.data || [])
      .map((row: any) => resolveObserverUserObject(row?.user_id))
      .filter(Boolean),
  });
  const getUserLabel = (user: any) => {
    const firstName = String(user?.first_name || "").trim();
    const lastName = String(user?.last_name || "").trim();
    const authUserName = `${firstName} ${lastName}`.trim();
    return authUserName || user?.full_name || user?.username || user?.email || `User ${user?.id}`;
  };
  const projectDepartmentRows = useMemo(
    () =>
      (projectDepartmentsResult?.data || []).map((row: any) => ({
        id: String(row.id),
        department_id: String(row.department_id),
      })),
    [projectDepartmentsResult?.data]
  );
  const projectTeamRows = useMemo(
    () =>
      (projectTeamsResult?.data || []).map((row: any) => ({
        id: String(row.id),
        team_id: String(row.team_id),
      })),
    [projectTeamsResult?.data]
  );
  const projectObserverRows = useMemo(
    () =>
      ((projectObserversResult?.data || [])
        .map((row: any) => {
          const observerUserId = resolveObserverUserId(row?.user_id);
          if (!observerUserId) return null;
          return {
            id: String(row.id),
            user_id: observerUserId,
          };
        })
        .filter(Boolean) as Array<{ id: string; user_id: string }>),
    [projectObserversResult?.data]
  );
  const didUserChangeScopeSelections = Boolean(
    (dirtyFields as any)?.department_ids ||
    (dirtyFields as any)?.team_ids ||
    (dirtyFields as any)?.observer_user_ids
  );
  const hasUnsavedChanges = isDirty || didUserChangeScopeSelections;
  const redirectToProjectsList = () => {
    setWarnWhen?.(false);
    go({ to: projectsListPath, type: "replace" });
  };

  const navigateToProjectsList = async () => {
    if (hasUnsavedChanges) {
      const shouldLeave = await modalConfirm(
        "You have unsaved changes. Leave this page without saving?",
        "Unsaved Changes"
      );
      if (!shouldLeave) return;
    }
    redirectToProjectsList();
  };

  useEffect(() => {
    if (!projectId) return;
    if (!projectDepartmentsResult?.data || !projectTeamsResult?.data || !projectObserversResult?.data) return;
    if (didUserChangeScopeSelections) return;

    setValue(
      "department_ids",
      projectDepartmentRows.map((row) => row.department_id)
    );
    setValue(
      "team_ids",
      projectTeamRows.map((row) => row.team_id)
    );
    setValue(
      "observer_user_ids",
      projectObserverRows.map((row) => row.user_id)
    );
  }, [
    projectId,
    projectDepartmentsResult?.data,
    projectTeamsResult?.data,
    projectObserversResult?.data,
    setValue,
    projectDepartmentRows,
    projectTeamRows,
    projectObserverRows,
    didUserChangeScopeSelections,
  ]);

  const withTimeout = async <T,>(promiseFactory: () => Promise<T>, timeoutMs = EDIT_REQUEST_TIMEOUT_MS): Promise<T> => {
    return await new Promise<T>((resolve, reject) => {
      const timer = window.setTimeout(() => {
        reject(new Error("Request timed out."));
      }, timeoutMs);

      promiseFactory()
        .then((value) => {
          window.clearTimeout(timer);
          resolve(value);
        })
        .catch((error) => {
          window.clearTimeout(timer);
          reject(error);
        });
    });
  };

  const createRelationRow = async (resource: string, values: Record<string, unknown>) => {
    await withTimeout(
      () =>
        new Promise<void>((resolve, reject) => {
          createRelation(
            {
              resource,
              values,
              successNotification: false,
              errorNotification: false,
            },
            {
              onSuccess: () => resolve(),
              onError: (error) => reject(error),
            }
          );
        })
    );
  };
  const deleteRelationRow = async (resource: string, id: string) => {
    await withTimeout(
      () =>
        new Promise<void>((resolve, reject) => {
          deleteRelation(
            {
              resource,
              id,
              successNotification: false,
              errorNotification: false,
            },
            {
              onSuccess: () => resolve(),
              onError: (error) => reject(error),
            }
          );
        })
    );
  };

  const onSubmit = async (values: any) => {
    if (isSavingProject) return;
    setIsSavingProject(true);
    try {
      const departmentIds = normalizeIdArray(values.department_ids);
      const teamIds = normalizeIdArray(values.team_ids);
      const observerUserIds = normalizeIdArray(values.observer_user_ids);
      const payload = { ...values };
      delete payload.department_ids;
      delete payload.team_ids;
      delete payload.observer_user_ids;
      if (!String(payload.end_date || "").trim()) {
        payload.end_date = null;
      }

      const response: any = await onFinish(payload);
      const savedProjectId =
        response?.data?.id ??
        response?.id ??
        response?.data?.data?.id ??
        projectId;
      if (!savedProjectId) {
        throw new Error("Project save succeeded but no project id was returned.");
      }

      const currentDeptSet = new Set(projectDepartmentRows.map((row) => row.department_id));
      const currentTeamSet = new Set(projectTeamRows.map((row) => row.team_id));
      const currentObserverSet = new Set(projectObserverRows.map((row) => row.user_id));
      const selectedDeptSet = new Set(departmentIds.map((value) => String(value)));
      const selectedTeamSet = new Set(teamIds.map((value) => String(value)));
      const selectedObserverSet = new Set(observerUserIds.map((value) => String(value)));
      const uniqueDepartmentIds = Array.from(new Set(departmentIds));
      const uniqueTeamIds = Array.from(new Set(teamIds));
      const uniqueObserverUserIds = Array.from(new Set(observerUserIds));
      const deptToCreate = uniqueDepartmentIds.filter((deptId) => !currentDeptSet.has(String(deptId)));
      const teamToCreate = uniqueTeamIds.filter((teamId) => !currentTeamSet.has(String(teamId)));
      const observerToCreate = uniqueObserverUserIds.filter(
        (observerUserId) => !currentObserverSet.has(String(observerUserId))
      );
      const deptToDelete = projectDepartmentRows.filter(
        (row) => !selectedDeptSet.has(row.department_id)
      );
      const teamToDelete = projectTeamRows.filter((row) => !selectedTeamSet.has(row.team_id));
      const observerToDelete = projectObserverRows.filter(
        (row) => !selectedObserverSet.has(row.user_id)
      );

      const relationFailures: Array<{ action: "create" | "delete"; resource: string; error: unknown }> = [];

      for (const departmentId of deptToCreate) {
        try {
          await createRelationRow("project_departments", {
            project_id: savedProjectId,
            department_id: departmentId,
          });
        } catch (error) {
          relationFailures.push({ action: "create", resource: "project_departments", error });
        }
      }
      for (const teamId of teamToCreate) {
        try {
          await createRelationRow("project_teams", {
            project_id: savedProjectId,
            team_id: teamId,
          });
        } catch (error) {
          relationFailures.push({ action: "create", resource: "project_teams", error });
        }
      }
      for (const observerUserId of observerToCreate) {
        try {
          await createRelationRow("project_observers", {
            project_id: savedProjectId,
            user_id: observerUserId,
          });
        } catch (error) {
          relationFailures.push({ action: "create", resource: "project_observers", error });
        }
      }
      for (const row of deptToDelete) {
        try {
          await deleteRelationRow("project_departments", row.id);
        } catch (error) {
          relationFailures.push({ action: "delete", resource: "project_departments", error });
        }
      }
      for (const row of teamToDelete) {
        try {
          await deleteRelationRow("project_teams", row.id);
        } catch (error) {
          relationFailures.push({ action: "delete", resource: "project_teams", error });
        }
      }
      for (const row of observerToDelete) {
        try {
          await deleteRelationRow("project_observers", row.id);
        } catch (error) {
          relationFailures.push({ action: "delete", resource: "project_observers", error });
        }
      }

      if (relationFailures.length > 0) {
        console.error("Some project relation updates failed after save.", relationFailures);
      }

      openNotification?.({
        type: "success",
        message: "Success",
        description: "Project updated successfully.",
      });
      redirectToProjectsList();
    } catch (error) {
      console.error("Failed to save project:", error);
      await modalAlert("Failed to save project. Please try again.", "Save Failed");
      setIsSavingProject(false);
    }
  };

  return (
    <Edit
      title={query?.data?.data?.name ? `Edit Project: ${query.data.data.name}` : "Edit Project"}
      saveButtonProps={submitSaveButtonProps}
      breadcrumb={
        <Breadcrumbs aria-label="breadcrumb" sx={{ px: 2, pt: 2, pb: 0 }}>
          <Link
            component="a"
            href={projectsListPath}
            underline="hover"
            color="inherit"
            onClick={(event) => {
              event.preventDefault();
              void navigateToProjectsList();
            }}
            sx={{ cursor: "pointer" }}
          >
            Projects
          </Link>
          <Typography color="text.primary">Edit Project</Typography>
        </Breadcrumbs>
      }
      footerButtons={() => (
        <>
          <Button
            type="button"
            variant="outlined"
            disabled={isSavingProject}
            onClick={() => {
              void navigateToProjectsList();
            }}
          >
            Cancel
          </Button>
          <Button {...submitSaveButtonProps} variant="contained">
            {isSavingProject ? "Saving..." : "Save"}
          </Button>
        </>
      )}
      headerButtons={() => null}
      goBack={null}
    >
      <Box
        component="form"
        id={formId}
        onSubmit={handleSubmit(onSubmit)}
        sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}
      >
        <TextField
          {...register("name", { required: "Name is required" })}
          error={!!errors.name}
          helperText={errors.name?.message as string}
          label="Project Name"
          InputLabelProps={{ shrink: true }}
          required
        />
        <TextField
          {...register("description")}
          label="Description"
          InputLabelProps={{ shrink: true }}
          multiline
          rows={2}
        />
        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
          <Controller
            control={control}
            name="color"
            defaultValue={DEFAULT_PROJECT_COLOR}
            render={({ field }) => (
              <TextField
                {...field}
                type="color"
                label="Project Color"
                InputLabelProps={{ shrink: true }}
                sx={{ width: 180 }}
              />
            )}
          />
          <Controller
            control={control}
            name="status"
            defaultValue="planning"
            render={({ field }) => (
              <TextField
                {...field}
                select
                label="Status"
                InputLabelProps={{ shrink: true }}
                sx={{ minWidth: 220, flex: 1 }}
              >
                <MenuItem value="planning">Planning</MenuItem>
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="on_hold">On Hold</MenuItem>
                <MenuItem value="completed">Done</MenuItem>
                <MenuItem value="cancelled">Cancelled</MenuItem>
              </TextField>
            )}
          />
        </Box>
        <Controller
          control={control}
          name="private_only"
          defaultValue={false}
          render={({ field: { value, onChange } }) => (
            <FormControlLabel
              control={<Checkbox checked={!!value} onChange={(e) => onChange(e.target.checked)} />}
              label="Private Only For Me"
            />
          )}
        />
        <input type="hidden" {...register("created_by_id")} />
        {!isPrivateOnly && (
          <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
            <Controller
              control={control}
              name="department_ids"
              defaultValue={[]}
              render={({ field: { onChange, value } }) => (
                <Autocomplete
                  multiple
                  options={departments}
                  getOptionLabel={(option: any) => option.name}
                  getOptionKey={(option: any) => String(option?.id ?? "")}
                  value={departments.filter((d: any) =>
                    normalizeIdArray(value).includes(String(d.id))
                  )}
                  onChange={(_, newValue) => onChange(newValue.map((item: any) => item.id))}
                  renderInput={(params) => (
                    <TextField {...params} label="Departments (Optional)" placeholder="Select departments" />
                  )}
                  sx={{ flex: 1, minWidth: 280 }}
                />
              )}
            />
            <Controller
              control={control}
              name="team_ids"
              defaultValue={[]}
              render={({ field: { onChange, value } }) => (
                <Autocomplete
                  multiple
                  options={teams}
                  getOptionLabel={(option: any) => option.name}
                  getOptionKey={(option: any) => String(option?.id ?? "")}
                  value={teams.filter((t: any) =>
                    normalizeIdArray(value).includes(String(t.id))
                  )}
                  onChange={(_, newValue) => onChange(newValue.map((item: any) => item.id))}
                  renderInput={(params) => (
                    <TextField {...params} label="Teams (Optional)" placeholder="Select teams" />
                  )}
                  sx={{ flex: 1, minWidth: 280 }}
                />
              )}
            />
          </Box>
        )}
        <Controller
          control={control}
          name="observer_user_ids"
          defaultValue={[]}
          render={({ field: { onChange, value } }) => (
            <Autocomplete
              multiple
              options={observerUsers}
              getOptionLabel={(option: any) => getUserLabel(option)}
              getOptionKey={(option: any) => String(option?.id ?? "")}
              value={observerUsers.filter((u: any) => normalizeIdArray(value).includes(String(u.id)))}
              onChange={(_, newValue) => {
                onChange(newValue.map((item: any) => item.id));
                setObserverSearchText("");
              }}
              onInputChange={(_, newInput, reason) => {
                if (reason === "input" || reason === "clear") {
                  setObserverSearchText(newInput);
                }
              }}
              inputValue={observerSearchText}
              loading={isObserversLoading}
              filterOptions={filterUserOptionsByLabel}
              noOptionsText={
                observerSearchText.trim()
                  ? "No users found. Keep typing to search."
                  : "Type a user name to search users not in the list."
              }
              isOptionEqualToValue={(option, selected) => String(option?.id) === String(selected?.id)}
              renderOption={(props, option: any) => {
                const { key, ...rest } = props;
                return (
                  <li {...rest} key={String(option?.id ?? key)}>
                    {getUserLabel(option)}
                  </li>
                );
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Observers (Optional)"
                  placeholder="Type a user name to search"
                />
              )}
            />
          )}
        />
        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", alignItems: "flex-start" }}>
          <TextField
            {...register("start_date")}
            label="Start Date"
            type="date"
            InputLabelProps={{ shrink: true }}
            sx={{ width: 200 }}
          />
          <TextField
            {...register("end_date")}
            label="End Date"
            type="date"
            InputLabelProps={{ shrink: true }}
            sx={{ width: 200 }}
            disabled={projectHasNoEndDate}
          />
          <Box sx={{ display: "flex", flexDirection: "column" }}>
            <FormControlLabel
              control={<Checkbox checked={projectHasNoEndDate} disabled />}
              label="No end date"
              sx={{ mr: 0 }}
            />
            <Typography variant="caption" color="text.secondary" sx={{ pl: 1.75, mt: -0.5 }}>
              Cannot change after creation
            </Typography>
          </Box>
        </Box>
      </Box>
    </Edit>
  );
};
