import { useMemo, useState, type ReactNode } from "react";
import { useDataProvider, useList } from "@refinedev/core";
import { List } from "@refinedev/mui";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  MenuItem,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { Add, Delete, Edit } from "@mui/icons-material";
import { SearchField } from "../../components/SearchField";
import { modalAlert, modalConfirm } from "../../components/dialogs/globalDialogs";
import { useIsAdmin } from "../../hooks/useIsAdmin";
import { useObserverUserOptions } from "../../hooks/useObserverUserOptions";
import { filterUserOptionsByLabel, formatUserLabel } from "../../utils/userResolver";
import { formatUiDate } from "../../utils/dateFormat";

/**
 * Admin page for the app-owned organization tables: org_departments,
 * org_employees, org_teams and org_team_members. Project visibility reads
 * these (an employee's department and teams decide which projects they see),
 * so this is where an admin wires people into the org structure.
 *
 * Writes are enforced by the backend policies (Super Admin only); the page
 * hides itself from everyone else.
 */

const EMPLOYMENT_STATUSES = [
  { value: "active", label: "Active" },
  { value: "on_leave", label: "On Leave" },
  { value: "terminated", label: "Terminated" },
];

const EMPLOYMENT_TYPES = [
  { value: "full_time", label: "Full Time" },
  { value: "part_time", label: "Part Time" },
  { value: "contract", label: "Contract" },
  { value: "intern", label: "Intern" },
];

// Stable fallback so memos keyed on list data don't recompute every render.
const EMPTY_ROWS: any[] = [];

const labelFor = (options: { value: string; label: string }[], value: unknown) =>
  options.find((option) => option.value === value)?.label || String(value || "") || "-";

const employeeName = (employee: any) =>
  `${String(employee?.first_name || "").trim()} ${String(employee?.last_name || "").trim()}`.trim() ||
  employee?.email ||
  "Unnamed employee";

const getErrorMessage = (error: any) => {
  const status = error?.statusCode ?? error?.status ?? error?.response?.status;
  if (status === 403) return "You don't have permission to change organization data.";
  const detail = error?.response?.data?.detail ?? error?.response?.data?.error;
  if (typeof detail === "string" && detail.trim()) return detail.trim();
  const message = error?.message;
  if (typeof message === "string" && message.trim()) return message.trim();
  return "Unknown error";
};

/** Empty strings become null so optional UUID / date columns are cleared, not rejected. */
const nullIfBlank = (value: unknown) => {
  if (value === undefined || value === null) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  return value;
};

const matchesSearch = (search: string, ...values: unknown[]) => {
  const query = search.trim().toLowerCase();
  if (!query) return true;
  return values.some((value) => String(value ?? "").toLowerCase().includes(query));
};

type EditorDialogProps = {
  open: boolean;
  title: string;
  saving: boolean;
  onClose: () => void;
  onSave: () => void;
  children: ReactNode;
};

const EditorDialog = ({ open, title, saving, onClose, onSave, children }: EditorDialogProps) => (
  <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="sm">
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSave();
      }}
    >
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Stack gap={2} sx={{ pt: 1 }}>
          {children}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" variant="contained" disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </Button>
      </DialogActions>
    </form>
  </Dialog>
);

const RowActions = ({
  label,
  onEdit,
  onDelete,
}: {
  label: string;
  onEdit: () => void;
  onDelete: () => void;
}) => (
  <Box sx={{ display: "flex", alignItems: "center", gap: 0.25 }}>
    <Tooltip title={`Edit ${label}`}>
      <IconButton size="small" onClick={onEdit} aria-label={`Edit ${label}`}>
        <Edit fontSize="small" />
      </IconButton>
    </Tooltip>
    <Tooltip title={`Delete ${label}`}>
      <IconButton size="small" onClick={onDelete} aria-label={`Delete ${label}`}>
        <Delete fontSize="small" />
      </IconButton>
    </Tooltip>
  </Box>
);

const OrgGrid = ({
  rows,
  columns,
  loading,
  emptyLabel,
}: {
  rows: any[];
  columns: GridColDef[];
  loading: boolean;
  emptyLabel: string;
}) => (
  <DataGrid
    rows={rows}
    columns={columns}
    loading={loading}
    autoHeight
    disableRowSelectionOnClick
    pageSizeOptions={[10, 25, 50, 100]}
    initialState={{ pagination: { paginationModel: { page: 0, pageSize: 25 } } }}
    localeText={{ noRowsLabel: emptyLabel }}
  />
);

export const OrganizationAdmin = () => {
  const { isAdmin, isLoading: isIdentityLoading } = useIsAdmin();
  const dataProvider = useDataProvider();
  const [tab, setTab] = useState(0);
  const [search, setSearch] = useState("");

  const { result: departmentsResult, query: departmentsQuery } = useList({
    resource: "org_departments",
    pagination: { mode: "off" },
    sorters: [{ field: "name", order: "asc" }],
    queryOptions: { enabled: isAdmin },
  });
  const { result: employeesResult, query: employeesQuery } = useList({
    resource: "org_employees",
    pagination: { mode: "off" },
    sorters: [{ field: "last_name", order: "asc" }],
    queryOptions: { enabled: isAdmin },
  });
  const { result: teamsResult, query: teamsQuery } = useList({
    resource: "org_teams",
    pagination: { mode: "off" },
    sorters: [{ field: "name", order: "asc" }],
    queryOptions: { enabled: isAdmin },
  });
  const { result: membersResult, query: membersQuery } = useList({
    resource: "org_team_members",
    pagination: { mode: "off" },
    queryOptions: { enabled: isAdmin },
  });

  const departments = departmentsResult?.data ?? EMPTY_ROWS;
  const employees = employeesResult?.data ?? EMPTY_ROWS;
  const teams = teamsResult?.data ?? EMPTY_ROWS;
  const members = membersResult?.data ?? EMPTY_ROWS;

  const departmentById = useMemo(
    () => new Map(departments.map((d: any) => [String(d.id), d])),
    [departments]
  );
  const employeeById = useMemo(
    () => new Map(employees.map((e: any) => [String(e.id), e])),
    [employees]
  );
  const memberIdsByTeam = useMemo(() => {
    const map = new Map<string, string[]>();
    members.forEach((row: any) => {
      const key = String(row.team_id);
      map.set(key, [...(map.get(key) || []), String(row.employee_id)]);
    });
    return map;
  }, [members]);
  const employeeCountByDepartment = useMemo(() => {
    const map = new Map<string, number>();
    employees.forEach((e: any) => {
      if (!e.department_id) return;
      const key = String(e.department_id);
      map.set(key, (map.get(key) || 0) + 1);
    });
    return map;
  }, [employees]);

  const refetchAll = () => {
    departmentsQuery.refetch();
    employeesQuery.refetch();
    teamsQuery.refetch();
    membersQuery.refetch();
  };

  // ---------------------------------------------------------------- editors
  const [saving, setSaving] = useState(false);
  const [departmentDraft, setDepartmentDraft] = useState<any | null>(null);
  const [employeeDraft, setEmployeeDraft] = useState<any | null>(null);
  const [teamDraft, setTeamDraft] = useState<any | null>(null);
  const [draftErrors, setDraftErrors] = useState<Record<string, string>>({});
  const [userSearch, setUserSearch] = useState("");

  const { options: userOptions, isLoading: isUsersLoading } = useObserverUserOptions({
    searchText: userSearch,
    selectedUserIds: employeeDraft?.user_id ? [String(employeeDraft.user_id)] : [],
    loadDefaultUsers: !!employeeDraft,
  });

  const closeEditors = () => {
    setDepartmentDraft(null);
    setEmployeeDraft(null);
    setTeamDraft(null);
    setDraftErrors({});
    setUserSearch("");
  };

  /** Create or update a row; returns the saved record. */
  const saveRecord = async (resource: string, draft: any, values: Record<string, unknown>) => {
    const dp = dataProvider();
    if (draft.id) {
      const response = await dp.update({ resource, id: draft.id, variables: values });
      return (response as any)?.data ?? { ...values, id: draft.id };
    }
    const response = await dp.create({ resource, variables: values });
    return (response as any)?.data;
  };

  const runSave = async (work: () => Promise<void>) => {
    setSaving(true);
    try {
      await work();
      closeEditors();
      refetchAll();
    } catch (error) {
      void modalAlert(`Save failed. ${getErrorMessage(error)}`, "Error");
    } finally {
      setSaving(false);
    }
  };

  const saveDepartment = () => {
    const name = String(departmentDraft?.name || "").trim();
    if (!name) {
      setDraftErrors({ name: "Name is required" });
      return;
    }
    void runSave(async () => {
      await saveRecord("org_departments", departmentDraft, {
        name,
        description: nullIfBlank(departmentDraft.description),
        lead_id: nullIfBlank(departmentDraft.lead_id),
        is_active: departmentDraft.is_active !== false,
      });
    });
  };

  const saveEmployee = () => {
    const required: Record<string, string> = {
      employee_number: "Employee number",
      first_name: "First name",
      last_name: "Last name",
      email: "Email",
      hire_date: "Hire date",
    };
    const errors: Record<string, string> = {};
    Object.entries(required).forEach(([field, label]) => {
      if (!String(employeeDraft?.[field] || "").trim()) errors[field] = `${label} is required`;
    });
    if (Object.keys(errors).length > 0) {
      setDraftErrors(errors);
      return;
    }
    void runSave(async () => {
      await saveRecord("org_employees", employeeDraft, {
        employee_number: String(employeeDraft.employee_number).trim(),
        first_name: String(employeeDraft.first_name).trim(),
        last_name: String(employeeDraft.last_name).trim(),
        email: String(employeeDraft.email).trim(),
        title: nullIfBlank(employeeDraft.title),
        phone: nullIfBlank(employeeDraft.phone),
        hire_date: employeeDraft.hire_date,
        end_date: nullIfBlank(employeeDraft.end_date),
        employment_status: employeeDraft.employment_status || "active",
        employment_type: employeeDraft.employment_type || "full_time",
        department_id: nullIfBlank(employeeDraft.department_id),
        user_id: nullIfBlank(employeeDraft.user_id),
      });
    });
  };

  const saveTeam = () => {
    const name = String(teamDraft?.name || "").trim();
    if (!name) {
      setDraftErrors({ name: "Name is required" });
      return;
    }
    void runSave(async () => {
      const saved = await saveRecord("org_teams", teamDraft, {
        name,
        description: nullIfBlank(teamDraft.description),
        team_lead_id: nullIfBlank(teamDraft.team_lead_id),
        is_active: teamDraft.is_active !== false,
      });
      const teamId = String(saved?.id ?? teamDraft.id);

      // Sync membership: add newly picked employees, remove unpicked ones.
      const wanted = new Set<string>((teamDraft.member_ids || []).map(String));
      const existingRows = members.filter((row: any) => String(row.team_id) === teamId);
      const existing = new Set(existingRows.map((row: any) => String(row.employee_id)));
      const dp = dataProvider();
      const toRemove = existingRows
        .filter((row: any) => !wanted.has(String(row.employee_id)))
        .map((row: any) => row.id);
      for (const id of toRemove) {
        await dp.deleteOne({ resource: "org_team_members", id });
      }
      for (const employeeId of wanted) {
        if (existing.has(employeeId)) continue;
        await dp.create({
          resource: "org_team_members",
          variables: { team_id: teamId, employee_id: employeeId },
        });
      }
    });
  };

  const deleteRecord = async (resource: string, id: string | number, message: string) => {
    if (!(await modalConfirm(message, "Confirm Delete"))) return;
    try {
      await dataProvider().deleteOne({ resource, id });
      refetchAll();
    } catch (error) {
      void modalAlert(`Delete failed. ${getErrorMessage(error)}`, "Error");
    }
  };

  // ---------------------------------------------------------------- columns
  const departmentColumns: GridColDef[] = [
    { field: "name", headerName: "Department", flex: 1, minWidth: 180 },
    { field: "description", headerName: "Description", flex: 1.5, minWidth: 200 },
    {
      field: "lead_id",
      headerName: "Lead",
      flex: 1,
      minWidth: 160,
      valueGetter: (value) => (value ? employeeName(employeeById.get(String(value))) : "-"),
    },
    {
      field: "employee_count",
      headerName: "Employees",
      width: 110,
      align: "center",
      headerAlign: "center",
      valueGetter: (_value, row) => employeeCountByDepartment.get(String(row.id)) || 0,
    },
    {
      field: "is_active",
      headerName: "Status",
      width: 110,
      align: "center",
      headerAlign: "center",
      renderCell: ({ value }) => (
        <Chip size="small" label={value === false ? "Inactive" : "Active"} color={value === false ? "default" : "success"} />
      ),
    },
    {
      field: "actions",
      headerName: "Actions",
      width: 110,
      sortable: false,
      align: "center",
      headerAlign: "center",
      renderCell: ({ row }) => (
        <RowActions
          label={row.name}
          onEdit={() => setDepartmentDraft({ ...row })}
          onDelete={() =>
            deleteRecord(
              "org_departments",
              row.id,
              `Delete the "${row.name}" department? Its employees will have no department, and projects shared with it will lose that link.`
            )
          }
        />
      ),
    },
  ];

  const employeeColumns: GridColDef[] = [
    {
      field: "name",
      headerName: "Name",
      flex: 1,
      minWidth: 170,
      valueGetter: (_value, row) => employeeName(row),
    },
    { field: "employee_number", headerName: "Emp #", width: 110 },
    { field: "email", headerName: "Email", flex: 1, minWidth: 200 },
    { field: "title", headerName: "Title", flex: 1, minWidth: 140 },
    {
      field: "department_id",
      headerName: "Department",
      flex: 1,
      minWidth: 150,
      valueGetter: (value) => (value ? departmentById.get(String(value))?.name || "-" : "-"),
    },
    {
      field: "user_id",
      headerName: "Login",
      width: 100,
      align: "center",
      headerAlign: "center",
      renderCell: ({ value }) => (
        <Chip size="small" label={value ? "Linked" : "None"} color={value ? "success" : "default"} />
      ),
    },
    {
      field: "employment_status",
      headerName: "Status",
      width: 120,
      valueGetter: (value) => labelFor(EMPLOYMENT_STATUSES, value),
    },
    {
      field: "hire_date",
      headerName: "Hired",
      width: 110,
      renderCell: ({ value }) => formatUiDate(value, "-"),
    },
    {
      field: "actions",
      headerName: "Actions",
      width: 110,
      sortable: false,
      align: "center",
      headerAlign: "center",
      renderCell: ({ row }) => (
        <RowActions
          label={employeeName(row)}
          onEdit={() => setEmployeeDraft({ ...row })}
          onDelete={() =>
            deleteRecord(
              "org_employees",
              row.id,
              `Delete ${employeeName(row)}? They will be removed from every team, and any department or team they lead will have no lead.`
            )
          }
        />
      ),
    },
  ];

  const teamColumns: GridColDef[] = [
    { field: "name", headerName: "Team", flex: 1, minWidth: 180 },
    { field: "description", headerName: "Description", flex: 1.5, minWidth: 200 },
    {
      field: "team_lead_id",
      headerName: "Lead",
      flex: 1,
      minWidth: 160,
      valueGetter: (value) => (value ? employeeName(employeeById.get(String(value))) : "-"),
    },
    {
      field: "member_count",
      headerName: "Members",
      width: 110,
      align: "center",
      headerAlign: "center",
      valueGetter: (_value, row) => memberIdsByTeam.get(String(row.id))?.length || 0,
    },
    {
      field: "is_active",
      headerName: "Status",
      width: 110,
      align: "center",
      headerAlign: "center",
      renderCell: ({ value }) => (
        <Chip size="small" label={value === false ? "Inactive" : "Active"} color={value === false ? "default" : "success"} />
      ),
    },
    {
      field: "actions",
      headerName: "Actions",
      width: 110,
      sortable: false,
      align: "center",
      headerAlign: "center",
      renderCell: ({ row }) => (
        <RowActions
          label={row.name}
          onEdit={() =>
            setTeamDraft({ ...row, member_ids: memberIdsByTeam.get(String(row.id)) || [] })
          }
          onDelete={() =>
            deleteRecord(
              "org_teams",
              row.id,
              `Delete the "${row.name}" team? Its memberships are removed, and projects shared with it will lose that link.`
            )
          }
        />
      ),
    },
  ];

  // ---------------------------------------------------------------- render
  if (isIdentityLoading) {
    return (
      <Box sx={{ p: 4, display: "flex", justifyContent: "center" }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  if (!isAdmin) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning">
          Organization settings are only available to users with the Super Admin role.
        </Alert>
      </Box>
    );
  }

  const tabs = [
    {
      label: "Departments",
      addLabel: "Add Department",
      onAdd: () => setDepartmentDraft({ is_active: true }),
      rows: departments.filter((d: any) => matchesSearch(search, d.name, d.description)),
      columns: departmentColumns,
      loading: !!departmentsQuery.isLoading,
    },
    {
      label: "Employees",
      addLabel: "Add Employee",
      onAdd: () => setEmployeeDraft({ employment_status: "active", employment_type: "full_time" }),
      rows: employees.filter((e: any) =>
        matchesSearch(search, employeeName(e), e.email, e.employee_number, e.title)
      ),
      columns: employeeColumns,
      loading: !!employeesQuery.isLoading,
    },
    {
      label: "Teams",
      addLabel: "Add Team",
      onAdd: () => setTeamDraft({ is_active: true, member_ids: [] }),
      rows: teams.filter((t: any) => matchesSearch(search, t.name, t.description)),
      columns: teamColumns,
      loading: !!teamsQuery.isLoading || !!membersQuery.isLoading,
    },
  ];
  const activeTab = tabs[tab];

  const employeeOptions = employees.map((e: any) => String(e.id));
  const employeeLabel = (id: string) => employeeName(employeeById.get(String(id)));
  const setDraftField = (setter: (fn: (prev: any) => any) => void, field: string, value: unknown) => {
    setter((prev: any) => ({ ...prev, [field]: value }));
    setDraftErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const selectedUser = employeeDraft?.user_id
    ? userOptions.find((user: any) => String(user.id) === String(employeeDraft.user_id)) || null
    : null;

  return (
    <List
      title={
        <Stack gap={0.5}>
          <Typography variant="h5">Organization</Typography>
          <Typography variant="body2" color="text.secondary">
            Departments, employees and teams decide who can see which projects.
          </Typography>
        </Stack>
      }
      headerButtons={
        <Button variant="contained" startIcon={<Add />} onClick={activeTab.onAdd}>
          {activeTab.addLabel}
        </Button>
      }
    >
      <Stack gap={2}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5}>
          <Tabs
            value={tab}
            onChange={(_event, next) => {
              setTab(next);
              setSearch("");
            }}
          >
            {tabs.map((t) => (
              <Tab key={t.label} label={t.label} />
            ))}
          </Tabs>
          <SearchField
            value={search}
            onChange={setSearch}
            placeholder={`Search ${activeTab.label.toLowerCase()}…`}
            ariaLabel={`Search ${activeTab.label.toLowerCase()}`}
          />
        </Stack>
        <OrgGrid
          rows={activeTab.rows}
          columns={activeTab.columns}
          loading={activeTab.loading}
          emptyLabel={
            search.trim()
              ? `No ${activeTab.label.toLowerCase()} match "${search.trim()}".`
              : `No ${activeTab.label.toLowerCase()} yet.`
          }
        />
      </Stack>

      {/* Department editor */}
      <EditorDialog
        open={!!departmentDraft}
        title={departmentDraft?.id ? "Edit Department" : "Add Department"}
        saving={saving}
        onClose={closeEditors}
        onSave={saveDepartment}
      >
        <TextField
          label="Name"
          required
          autoFocus
          value={departmentDraft?.name || ""}
          onChange={(e) => setDraftField(setDepartmentDraft, "name", e.target.value)}
          error={!!draftErrors.name}
          helperText={draftErrors.name}
          slotProps={{ htmlInput: { maxLength: 200 } }}
        />
        <TextField
          label="Description"
          multiline
          minRows={2}
          value={departmentDraft?.description || ""}
          onChange={(e) => setDraftField(setDepartmentDraft, "description", e.target.value)}
          slotProps={{ htmlInput: { maxLength: 1000 } }}
        />
        <Autocomplete
          options={employeeOptions}
          value={departmentDraft?.lead_id ? String(departmentDraft.lead_id) : null}
          onChange={(_event, value) => setDraftField(setDepartmentDraft, "lead_id", value)}
          getOptionLabel={employeeLabel}
          renderInput={(params) => <TextField {...params} label="Department Lead" />}
        />
        <FormControlLabel
          control={
            <Switch
              checked={departmentDraft?.is_active !== false}
              onChange={(e) => setDraftField(setDepartmentDraft, "is_active", e.target.checked)}
            />
          }
          label="Active"
        />
      </EditorDialog>

      {/* Employee editor */}
      <EditorDialog
        open={!!employeeDraft}
        title={employeeDraft?.id ? "Edit Employee" : "Add Employee"}
        saving={saving}
        onClose={closeEditors}
        onSave={saveEmployee}
      >
        <Stack direction={{ xs: "column", sm: "row" }} gap={2}>
          <TextField
            label="First Name"
            required
            autoFocus
            fullWidth
            value={employeeDraft?.first_name || ""}
            onChange={(e) => setDraftField(setEmployeeDraft, "first_name", e.target.value)}
            error={!!draftErrors.first_name}
            helperText={draftErrors.first_name}
            slotProps={{ htmlInput: { maxLength: 100 } }}
          />
          <TextField
            label="Last Name"
            required
            fullWidth
            value={employeeDraft?.last_name || ""}
            onChange={(e) => setDraftField(setEmployeeDraft, "last_name", e.target.value)}
            error={!!draftErrors.last_name}
            helperText={draftErrors.last_name}
            slotProps={{ htmlInput: { maxLength: 100 } }}
          />
        </Stack>
        <Stack direction={{ xs: "column", sm: "row" }} gap={2}>
          <TextField
            label="Email"
            type="email"
            required
            fullWidth
            value={employeeDraft?.email || ""}
            onChange={(e) => setDraftField(setEmployeeDraft, "email", e.target.value)}
            error={!!draftErrors.email}
            helperText={draftErrors.email}
          />
          <TextField
            label="Employee Number"
            required
            fullWidth
            value={employeeDraft?.employee_number || ""}
            onChange={(e) => setDraftField(setEmployeeDraft, "employee_number", e.target.value)}
            error={!!draftErrors.employee_number}
            helperText={draftErrors.employee_number}
            slotProps={{ htmlInput: { maxLength: 20 } }}
          />
        </Stack>
        <Stack direction={{ xs: "column", sm: "row" }} gap={2}>
          <TextField
            label="Title"
            fullWidth
            value={employeeDraft?.title || ""}
            onChange={(e) => setDraftField(setEmployeeDraft, "title", e.target.value)}
            slotProps={{ htmlInput: { maxLength: 200 } }}
          />
          <TextField
            label="Phone"
            fullWidth
            value={employeeDraft?.phone || ""}
            onChange={(e) => setDraftField(setEmployeeDraft, "phone", e.target.value)}
          />
        </Stack>
        <Autocomplete
          options={departments.map((d: any) => String(d.id))}
          value={employeeDraft?.department_id ? String(employeeDraft.department_id) : null}
          onChange={(_event, value) => setDraftField(setEmployeeDraft, "department_id", value)}
          getOptionLabel={(id) => departmentById.get(String(id))?.name || "Unknown department"}
          renderInput={(params) => <TextField {...params} label="Department" />}
        />
        <Autocomplete
          options={userOptions}
          value={selectedUser}
          loading={isUsersLoading}
          onChange={(_event, user: any) => setDraftField(setEmployeeDraft, "user_id", user ? String(user.id) : null)}
          onInputChange={(_event, value, reason) => {
            if (reason === "input") setUserSearch(value);
            if (reason === "clear") setUserSearch("");
          }}
          filterOptions={filterUserOptionsByLabel}
          getOptionLabel={(user: any) => formatUserLabel(user)}
          isOptionEqualToValue={(option: any, value: any) => String(option.id) === String(value.id)}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Linked Login"
              helperText="The app account this employee signs in with. Needed for department and team project access."
            />
          )}
        />
        <Stack direction={{ xs: "column", sm: "row" }} gap={2}>
          <TextField
            select
            label="Employment Status"
            fullWidth
            value={employeeDraft?.employment_status || "active"}
            onChange={(e) => setDraftField(setEmployeeDraft, "employment_status", e.target.value)}
          >
            {EMPLOYMENT_STATUSES.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Employment Type"
            fullWidth
            value={employeeDraft?.employment_type || "full_time"}
            onChange={(e) => setDraftField(setEmployeeDraft, "employment_type", e.target.value)}
          >
            {EMPLOYMENT_TYPES.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
        <Stack direction={{ xs: "column", sm: "row" }} gap={2}>
          <TextField
            label="Hire Date"
            type="date"
            required
            fullWidth
            value={employeeDraft?.hire_date || ""}
            onChange={(e) => setDraftField(setEmployeeDraft, "hire_date", e.target.value)}
            error={!!draftErrors.hire_date}
            helperText={draftErrors.hire_date}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            label="End Date"
            type="date"
            fullWidth
            value={employeeDraft?.end_date || ""}
            onChange={(e) => setDraftField(setEmployeeDraft, "end_date", e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />
        </Stack>
      </EditorDialog>

      {/* Team editor */}
      <EditorDialog
        open={!!teamDraft}
        title={teamDraft?.id ? "Edit Team" : "Add Team"}
        saving={saving}
        onClose={closeEditors}
        onSave={saveTeam}
      >
        <TextField
          label="Name"
          required
          autoFocus
          value={teamDraft?.name || ""}
          onChange={(e) => setDraftField(setTeamDraft, "name", e.target.value)}
          error={!!draftErrors.name}
          helperText={draftErrors.name}
        />
        <TextField
          label="Description"
          multiline
          minRows={2}
          value={teamDraft?.description || ""}
          onChange={(e) => setDraftField(setTeamDraft, "description", e.target.value)}
        />
        <Autocomplete
          options={employeeOptions}
          value={teamDraft?.team_lead_id ? String(teamDraft.team_lead_id) : null}
          onChange={(_event, value) => setDraftField(setTeamDraft, "team_lead_id", value)}
          getOptionLabel={employeeLabel}
          renderInput={(params) => <TextField {...params} label="Team Lead" />}
        />
        <Autocomplete
          multiple
          options={employeeOptions}
          value={(teamDraft?.member_ids || []).map(String)}
          onChange={(_event, value) => setDraftField(setTeamDraft, "member_ids", value)}
          getOptionLabel={employeeLabel}
          disableCloseOnSelect
          renderInput={(params) => <TextField {...params} label="Members" />}
        />
        <FormControlLabel
          control={
            <Switch
              checked={teamDraft?.is_active !== false}
              onChange={(e) => setDraftField(setTeamDraft, "is_active", e.target.checked)}
            />
          }
          label="Active"
        />
      </EditorDialog>
    </List>
  );
};
