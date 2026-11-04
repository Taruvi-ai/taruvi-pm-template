import { Add } from "@mui/icons-material";
import { Button, Checkbox, FormControlLabel, MenuItem, Paper, Stack, TextField } from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";
import type { TaskFilters } from "./taskFilters";
import { SearchField } from "../SearchField";

type TaskFiltersBarProps = {
  filters: TaskFilters;
  onChange: (filters: TaskFilters) => void;
  onAddTask: () => void;
  rightActions?: React.ReactNode;
  leftActions?: React.ReactNode;
  assignedToOptions: Array<{ value: string; label: string }>;
  showAssignedToFilter?: boolean;
  showAddTask?: boolean;
  showHideDone?: boolean;
  showSort?: boolean;
  showOrder?: boolean;
  showStatusSortOption?: boolean;
  showSearch?: boolean;
  paperSx?: SxProps<Theme>;
};

export const TaskFiltersBar = ({
  filters,
  onChange,
  onAddTask,
  rightActions,
  leftActions,
  assignedToOptions,
  showAssignedToFilter = true,
  showAddTask = true,
  showHideDone = true,
  showSort = true,
  showOrder = true,
  showStatusSortOption = true,
  showSearch = true,
  paperSx,
}: TaskFiltersBarProps) => {
  const update = (patch: Partial<TaskFilters>) => {
    onChange({ ...filters, ...patch });
  };

  const isPriorityFilterActive = filters.filterPriority !== "all";
  const isAssignedFilterActive = showAssignedToFilter && filters.filterAssignedTo !== "all";
  const showClearFilters = isPriorityFilterActive || isAssignedFilterActive;
  const baseSx: SxProps<Theme> = {
    mb: 2,
    p: 1.5,
    bgcolor: "grey.50",
    borderRadius: 2,
  };
  const resolvedSx: SxProps<Theme> = Array.isArray(paperSx)
    ? [baseSx, ...paperSx]
    : paperSx
      ? [baseSx, paperSx]
      : baseSx;

  return (
    <Paper
      variant="outlined"
      sx={resolvedSx}
    >
      <Stack
        direction="row"
        gap={2}
        flexWrap="wrap"
        alignItems="center"
        justifyContent="space-between"
      >
        <Stack direction="row" gap={1.5} flexWrap="wrap" alignItems="center">
          {leftActions}
          {showSearch && (
            <SearchField
              value={filters.search ?? ""}
              onChange={(search) => update({ search })}
              placeholder="Search tasks…"
              ariaLabel="Search tasks"
            />
          )}
          {showSort && (
            <TextField
              select
              size="small"
              label="Sort By"
              value={filters.sortBy}
              onChange={(e) => update({ sortBy: e.target.value })}
              sx={{ minWidth: 150, bgcolor: "background.paper" }}
            >
              <MenuItem value="created_at">Created Date</MenuItem>
              <MenuItem value="title">Title</MenuItem>
              <MenuItem value="priority">Priority</MenuItem>
              {showStatusSortOption && <MenuItem value="status">Status</MenuItem>}
              <MenuItem value="start_date">Start Date</MenuItem>
              <MenuItem value="end_date">End Date</MenuItem>
              <MenuItem value="updated_at">Last Updated</MenuItem>
              <MenuItem value="progress">Progress</MenuItem>
            </TextField>
          )}

          {showOrder && (
            <TextField
              select
              size="small"
              label="Order"
              value={filters.sortOrder}
              onChange={(e) => update({ sortOrder: e.target.value as TaskFilters["sortOrder"] })}
              sx={{ minWidth: 120, bgcolor: "background.paper" }}
            >
              <MenuItem value="asc">Ascending</MenuItem>
              <MenuItem value="desc">Descending</MenuItem>
            </TextField>
          )}

          <TextField
            select
            size="small"
            label="Priority"
            value={filters.filterPriority}
            onChange={(e) => update({ filterPriority: e.target.value })}
            sx={{ minWidth: 150, bgcolor: "background.paper" }}
          >
            <MenuItem value="all">All Priority</MenuItem>
            <MenuItem value="low">Low</MenuItem>
            <MenuItem value="medium">Medium</MenuItem>
            <MenuItem value="high">High</MenuItem>
            <MenuItem value="critical">Critical</MenuItem>
          </TextField>

          {showAssignedToFilter && (
            <TextField
              select
              size="small"
              label="Assigned To"
              value={filters.filterAssignedTo}
              onChange={(e) => update({ filterAssignedTo: e.target.value })}
              sx={{ minWidth: 170, bgcolor: "background.paper" }}
            >
              <MenuItem value="all">All Assignees</MenuItem>
              {assignedToOptions.map((assignee) => (
                <MenuItem key={assignee.value} value={assignee.value}>
                  {assignee.label}
                </MenuItem>
              ))}
            </TextField>
          )}

          {showHideDone && (
            <FormControlLabel
              control={
                <Checkbox
                  checked={filters.hideDone}
                  onChange={(e) => update({ hideDone: e.target.checked })}
                  size="small"
                />
              }
              label="Hide Done"
            />
          )}

          {showClearFilters && (
            <Button
              size="small"
              onClick={() =>
                update({
                  ...(isPriorityFilterActive ? { filterPriority: "all" } : {}),
                  ...(isAssignedFilterActive ? { filterAssignedTo: "all" } : {}),
                })
              }
            >
              Clear Filters
            </Button>
          )}
        </Stack>

        <Stack direction="row" alignItems="center" gap={1}>
          {rightActions}
          {showAddTask && (
            <Button variant="contained" startIcon={<Add />} onClick={onAddTask} size="small">
              Add Task
            </Button>
          )}
        </Stack>
      </Stack>
    </Paper>
  );
};
