import { Create } from "@refinedev/mui";
import { useCreate, useGetIdentity, useGo, useList, useNotification, useWarnAboutChange } from "@refinedev/core";
import { useForm } from "@refinedev/react-hook-form";
import { Autocomplete, Box, Button, Checkbox, FormControlLabel, TextField, MenuItem } from "@mui/material";
import { Controller } from "react-hook-form";
import { useEffect, useMemo, useState } from "react";
import { useObserverUserOptions } from "../../hooks/useObserverUserOptions";
import { filterUserOptionsByLabel } from "../../utils/userResolver";

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
const DEFAULT_PROJECT_COLOR = "#1976d2";
const CREATE_REQUEST_TIMEOUT_MS = 20000;

const extractProjectIdFromUnknown = (value: any): string | null => {
  if (!value) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "bigint") {
    const text = String(value).trim();
    return text ? text : null;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const resolved = extractProjectIdFromUnknown(item);
      if (resolved) return resolved;
    }
    return null;
  }
  if (typeof value === "object") {
    const directId =
      value.id ??
      value.project_id ??
      value.uuid ??
      value.project_uuid ??
      value.pk;
    const resolvedDirect = extractProjectIdFromUnknown(directId);
    if (resolvedDirect) return resolvedDirect;

    const nestedId =
      extractProjectIdFromUnknown(value.data) ??
      extractProjectIdFromUnknown(value.result) ??
      extractProjectIdFromUnknown(value.record);
    if (nestedId) return nestedId;
  }
  return null;
};

export const ProjectCreate = () => {
  const { open: openNotification } = useNotification();
  const { setWarnWhen } = useWarnAboutChange();
  const go = useGo();
  const projectsListPath = "/projects";
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const {
    saveButtonProps,
    register,
    control,
    formState: { errors },
    setValue,
    watch,
    handleSubmit,
  } = useForm({
    refineCoreProps: {
      resource: "projects",
      action: "create",
      successNotification: false,
    },
    warnWhenUnsavedChanges: false,
  });
  const formId = "project-create-form";
  const submitSaveButtonProps = {
    ...saveButtonProps,
    onClick: undefined,
    type: "submit" as const,
    form: formId,
    disabled: Boolean(isCreatingProject),
  };
  const { mutate: createProject } = useCreate();
  const { mutate: createRelation } = useCreate();
  const [observerSearchText, setObserverSearchText] = useState("");

  const { data: user } = useGetIdentity();
  const userId =
    (user as any)?.id ||
    (user as any)?.uuid ||
    (user as any)?.data?.id ||
    (user as any)?.data?.uuid ||
    (user as any)?.user_id ||
    (user as any)?.user_uuid ||
    null;
  const isPrivateOnly = watch("private_only");
  const noEndDate = watch("no_end_date");
  const watchedObserverUserIds = watch("observer_user_ids");
  const selectedObserverUserIds = useMemo(
    () => normalizeIdArray(watchedObserverUserIds),
    [watchedObserverUserIds]
  );

  useEffect(() => {
    if (isPrivateOnly) {
      setValue("department_ids", []);
      setValue("team_ids", []);
    }
  }, [isPrivateOnly, setValue]);

  useEffect(() => {
    if (noEndDate) {
      setValue("end_date", "");
    }
  }, [noEndDate, setValue]);

  useEffect(() => {
    if (userId) {
      setValue("created_by_id", userId);
    }
  }, [userId, setValue]);

  useEffect(() => {
    setValue("color", DEFAULT_PROJECT_COLOR);
  }, [setValue]);

  const { result: departmentsResult } = useList({
    resource: "org_departments",
    pagination: { mode: "off" },
  });

  const { result: teamsResult } = useList({
    resource: "org_teams",
    pagination: { mode: "off" },
  });
  const departments = departmentsResult?.data || [];
  const teams = teamsResult?.data || [];
  const { options: observerUsers, isLoading: isObserversLoading } = useObserverUserOptions({
    searchText: observerSearchText,
    selectedUserIds: selectedObserverUserIds,
  });
  const getUserLabel = (user: any) => {
    const firstName = String(user?.first_name || "").trim();
    const lastName = String(user?.last_name || "").trim();
    const authUserName = `${firstName} ${lastName}`.trim();
    return authUserName || user?.full_name || user?.username || user?.email || `User ${user?.id}`;
  };

  const withTimeout = async <T,>(promiseFactory: () => Promise<T>, timeoutMs = CREATE_REQUEST_TIMEOUT_MS): Promise<T> => {
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

  const createProjectRow = async (values: Record<string, unknown>) => {
    return await withTimeout(
      () =>
        new Promise<any>((resolve, reject) => {
          createProject(
            {
              resource: "projects",
              values,
              successNotification: false,
              errorNotification: false,
            },
            {
              onSuccess: (data) => resolve(data),
              onError: (error) => reject(error),
            }
          );
        })
    );
  };
  const redirectToProjectsList = () => {
    setWarnWhen?.(false);
    go({ to: projectsListPath, type: "replace" });
  };

  const onSubmit = async (values: any) => {
    if (isCreatingProject) return;
    setIsCreatingProject(true);
    try {
      const departmentIds = normalizeIdArray(values.department_ids);
      const teamIds = normalizeIdArray(values.team_ids);
      const observerUserIds = normalizeIdArray(values.observer_user_ids);
      const payload = { ...values };
      delete payload.department_ids;
      delete payload.team_ids;
      delete payload.observer_user_ids;
      if (payload.no_end_date) {
        payload.end_date = null;
      }
      delete payload.no_end_date;

      const response: any = await createProjectRow(payload);
      const projectId = extractProjectIdFromUnknown(response);

      if (projectId) {
        const relationFailures: Array<{ resource: string; error: unknown }> = [];
        const uniqueDepartmentIds = Array.from(new Set(departmentIds));
        const uniqueTeamIds = Array.from(new Set(teamIds));
        const uniqueObserverUserIds = Array.from(new Set(observerUserIds));

        for (const departmentId of uniqueDepartmentIds) {
          try {
            await createRelationRow("project_departments", {
              project_id: projectId,
              department_id: departmentId,
            });
          } catch (error) {
            relationFailures.push({ resource: "project_departments", error });
          }
        }

        for (const teamId of uniqueTeamIds) {
          try {
            await createRelationRow("project_teams", {
              project_id: projectId,
              team_id: teamId,
            });
          } catch (error) {
            relationFailures.push({ resource: "project_teams", error });
          }
        }

        for (const observerUserId of uniqueObserverUserIds) {
          try {
            await createRelationRow("project_observers", {
              project_id: projectId,
              user_id: observerUserId,
            });
          } catch (error) {
            relationFailures.push({ resource: "project_observers", error });
          }
        }

        if (relationFailures.length > 0) {
          console.error("Some project relation rows failed after create.", relationFailures);
        }
      } else {
        console.error("Project created but response did not include project id for relation sync.", response);
      }

      openNotification?.({
        type: "success",
        message: "Success",
        description: "Project created successfully.",
      });
      redirectToProjectsList();
    } catch (error) {
      console.error("Failed to create project:", error);
      openNotification?.({
        type: "error",
        message: "Error",
        description: "Failed to create project. Please try again.",
      });
      setIsCreatingProject(false);
    }
  };

  return (
    <Create
      saveButtonProps={submitSaveButtonProps}
      footerButtons={() => (
        <>
          <Button
            type="button"
            variant="outlined"
            disabled={isCreatingProject}
            onClick={() => {
              redirectToProjectsList();
            }}
          >
            Cancel
          </Button>
          <Button {...submitSaveButtonProps} variant="contained">
            {isCreatingProject ? "Saving..." : "Save"}
          </Button>
        </>
      )}
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
              <TextField {...field} select label="Status" sx={{ minWidth: 220, flex: 1 }}>
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
            <Box sx={{ display: "inline-flex", alignItems: "center", alignSelf: "flex-start" }}>
              <Checkbox checked={!!value} onChange={(e) => onChange(e.target.checked)} />
              <Box component="span">Private Only For Me</Box>
            </Box>
          )}
        />
        <input type="hidden" {...register("created_by_id")} />
        {!isPrivateOnly && (
          <Box
            sx={{
              display: "grid",
              gap: 2,
              gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
              alignItems: "start",
            }}
          >
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
                  sx={{ width: "100%", minWidth: 0 }}
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
                  sx={{ width: "100%", minWidth: 0 }}
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
        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
          <TextField
            {...register("start_date", {
              required: "Start Date is required.",
            })}
            label="Start Date"
            type="date"
            InputLabelProps={{ shrink: true }}
            sx={{ width: 200 }}
            required
            error={!!errors.start_date}
            helperText={errors.start_date?.message as string}
          />
          <TextField
            {...register("end_date", {
              required: noEndDate ? false : "End Date is required.",
              validate: (value) => {
                if (noEndDate) return true;
                const startDate = String(watch("start_date") || "").trim();
                const endDate = String(value || "").trim();
                if (!startDate || !endDate) return true;
                return endDate >= startDate || "End Date cannot be earlier than Start Date.";
              },
            })}
            label="End Date"
            type="date"
            InputLabelProps={{ shrink: true }}
            sx={{ width: 200 }}
            required={!noEndDate}
            disabled={!!noEndDate}
            error={!!errors.end_date}
            helperText={errors.end_date?.message as string}
          />
          <Controller
            control={control}
            name="no_end_date"
            defaultValue={false}
            render={({ field: { value, onChange } }) => (
              <FormControlLabel
                control={<Checkbox checked={!!value} onChange={(e) => onChange(e.target.checked)} />}
                label="No end date"
              />
            )}
          />
        </Box>
      </Box>
    </Create>
  );
};
