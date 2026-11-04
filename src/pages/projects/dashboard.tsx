import { useGo, useList, useResourceParams } from "@refinedev/core";
import { useParams } from "react-router";
import { useMemo } from "react";
import { Box, Card, CardContent, Grid, Stack, Typography, Divider, Chip, Link, Breadcrumbs } from "@mui/material";
import { Folder } from "@mui/icons-material";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import {
  formatTaskPriorityLabel,
  formatTaskStatusLabel,
  getTaskPriorityColor,
  getTaskStatusChipSx,
  getTaskStatusColor,
  normalizeTaskStatus,
} from "../../utils/taskVisuals";
import { getAssigneeLabel as resolveAssigneeLabel } from "../../utils/userResolver";

const assigneeBarColor = "#1E88E5";

export const ProjectDashboard = () => {
  const go = useGo();
  const { resources } = useResourceParams();
  const { id } = useParams();
  const projectId = id ? String(id) : undefined;
  const { result: projectsResult } = useList({
    resource: "projects",
    pagination: { mode: "off" },
  });
  const { result: tasksResult } = useList({
    resource: "tasks",
    filters: projectId ? [{ field: "project_id", operator: "eq", value: projectId }] : [],
    meta: { populate: ["assigned_to"] },
    pagination: { mode: "off" },
  });
  const { result: usersResult } = useList({
    resource: "users",
    dataProviderName: "user",
    pagination: { mode: "off" },
  });

  const projects = projectsResult?.data || [];
  const tasks = tasksResult?.data || [];
  const users = usersResult?.data || [];
  const userById = useMemo(() => {
    const map: Record<string, any> = {};
    users.forEach((u: any) => {
      if (u?.id != null) map[String(u.id)] = u;
    });
    return map;
  }, [users]);
  const getAssigneeLabel = (value: any) => resolveAssigneeLabel(value, userById);
  const projectResourceIcon = resources.find((resource) => resource.name === "projects")?.meta?.icon;
  const project = projects.find((p: any) => String(p.id) === String(projectId));
  const normalizedProjectStatus = String(project?.status || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  const projectStatusLabel =
    normalizedProjectStatus === "completed" || normalizedProjectStatus === "complete"
      ? "Done"
      : project?.status;
  const normalizeTaskStatusLabel = (value: any) => {
    const normalized = String(value || "").trim().toLowerCase().replace(/\s+/g, "_");
    if (normalized === "completed" || normalized === "complete") return "done";
    return normalized || "unknown";
  };

  const statusCounts = tasks.reduce((acc: Record<string, number>, t: any) => {
    const key = normalizeTaskStatusLabel(t.status);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const statusData = Object.entries(statusCounts).map(([name, value]) => {
    const statusKey = normalizeTaskStatus(name) || "in_progress";
    return {
      statusKey,
      name: formatTaskStatusLabel(statusKey, { uppercase: false }),
      value,
      color: getTaskStatusColor(statusKey),
    };
  });

  const priorityCounts = tasks.reduce((acc: Record<string, number>, t: any) => {
    const key = (t.priority || "unknown").toString();
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const priorityData = Object.entries(priorityCounts).map(([name, value]) => ({
    name: formatTaskPriorityLabel(name, { uppercase: false }),
    value,
    color: getTaskPriorityColor(name),
  }));

  const assigneeCounts = tasks.reduce((acc: Record<string, number>, t: any) => {
    const label = getAssigneeLabel(t.assigned_to);
    const key = label || "Unassigned";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const assigneeData = Object.entries(assigneeCounts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((t: any) => normalizeTaskStatusLabel(t.status) === "done").length;
  const inProgress = tasks.filter((t: any) => t.status === "in_progress").length;
  const openTasks = totalTasks - doneTasks;

  return (
    <Box sx={{ p: 3, width: "100%", mx: "auto" }}>
      <Breadcrumbs
        sx={{
          mb: 2,
          "& .MuiSvgIcon-root": { fontSize: 16 },
          "& .MuiLink-root, & .MuiTypography-root": { fontSize: 14 },
        }}
        aria-label="breadcrumb"
      >
        <Link
          component="a"
          href="/projects"
          underline="hover"
          color="inherit"
          onClick={(event) => {
            event.preventDefault();
            go({ to: "/projects" });
          }}
          sx={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 0.5 }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              color: "inherit",
              "& .MuiSvgIcon-root": { fontSize: 16 },
            }}
          >
            {projectResourceIcon || <Folder />}
          </Box>
          Projects
        </Link>
        {projectId ? (
          <Link
            component="a"
            href={`/projects/show/${projectId}`}
            underline="hover"
            color="inherit"
            onClick={(event) => {
              event.preventDefault();
              go({ to: `/projects/show/${projectId}` });
            }}
            sx={{ cursor: "pointer" }}
          >
            {project?.name || "Project"}
          </Link>
        ) : (
          <Typography color="text.secondary">
            Project
          </Typography>
        )}
        <Typography color="text.primary">
          Dashboard
        </Typography>
      </Breadcrumbs>

      <Card
        sx={{
          mb: 3,
          p: 2.5,
          borderRadius: 3,
          bgcolor: "background.paper",
          border: "1px solid",
          borderColor: "divider",
        }}
      >
        <Stack spacing={1}>
          <Typography variant="overline" sx={{ letterSpacing: 1.5, color: "text.secondary" }}>
            Project Analytics
          </Typography>
          <Typography variant="h5">Project Dashboard</Typography>
          <Typography variant="caption" color="text.secondary">
            Dashboard v2026-02-02-6
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            {project ? <Chip label={project.name} color="primary" variant="outlined" /> : null}
            {project?.status ? <Chip label={formatTaskStatusLabel(projectStatusLabel)} sx={getTaskStatusChipSx(projectStatusLabel)} /> : null}
          </Stack>
          <Typography variant="body2" color="text.secondary">
            Visual overview of project health, task priority, and assignee workload
          </Typography>
        </Stack>
      </Card>

      <Grid container spacing={3} sx={{ mb: 1 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card sx={{ p: 2, borderRadius: 3, bgcolor: "grey.50" }}>
            <Typography variant="overline" color="text.secondary">Total Tasks</Typography>
            <Typography variant="h4">{totalTasks}</Typography>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card sx={{ p: 2, borderRadius: 3, bgcolor: "grey.50" }}>
            <Typography variant="overline" color="text.secondary">Open Tasks</Typography>
            <Typography variant="h4">{openTasks}</Typography>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card sx={{ p: 2, borderRadius: 3, bgcolor: "grey.50" }}>
            <Typography variant="overline" color="text.secondary">In Progress</Typography>
            <Typography variant="h4">{inProgress}</Typography>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card sx={{ p: 2, borderRadius: 3, bgcolor: "grey.50" }}>
            <Typography variant="overline" color="text.secondary">Done</Typography>
            <Typography variant="h4">{doneTasks}</Typography>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={4} wrap="wrap" sx={{ width: "100%" }}>
        <Grid size={{ xs: 12, md: 6 }} sx={{ minWidth: 420 }}>
          <Card sx={{ height: "100%", width: "100%", borderRadius: 3, minHeight: 440 }}>
            <CardContent>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                <Typography variant="h6">Project Status</Typography>
                <Chip label="Snapshot" size="small" />
              </Stack>
              <Divider sx={{ mb: 2 }} />
              <Box sx={{ height: 420, minHeight: 420, overflow: "visible" }}>
                <ResponsiveContainer width="100%" height="100%" minWidth={380}>
                  <PieChart margin={{ top: 12, right: 12, left: 12, bottom: 12 }}>
                    <Pie
                      data={statusData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={70}
                      outerRadius={115}
                      cx="50%"
                      cy="45%"
                    >
                      {statusData.map((entry, idx) => (
                        <Cell key={idx} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: any, _name: any, props: any) => {
                        const label = props?.payload?.name || "Status";
                        return [value, label];
                      }}
                      labelFormatter={() => "Status"}
                    />
                    <Legend verticalAlign="bottom" height={54} />
                  </PieChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }} sx={{ minWidth: 420 }}>
          <Card sx={{ height: "100%", width: "100%", borderRadius: 3, minHeight: 440 }}>
            <CardContent>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                <Typography variant="h6">Tasks by Priority</Typography>
                <Chip label="Distribution" size="small" />
              </Stack>
              <Divider sx={{ mb: 2 }} />
              <Box sx={{ height: 420, minHeight: 420, overflow: "visible" }}>
                <ResponsiveContainer width="100%" height="100%" minWidth={380}>
                  <PieChart margin={{ top: 12, right: 12, left: 12, bottom: 12 }}>
                    <Pie
                      data={priorityData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={70}
                      outerRadius={115}
                      cx="50%"
                      cy="45%"
                    >
                      {priorityData.map((entry, idx) => (
                        <Cell key={idx} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend verticalAlign="bottom" height={54} />
                  </PieChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 12 }} sx={{ width: "100%" }}>
          <Card sx={{ borderRadius: 3, minHeight: 420, width: "100%" }}>
            <CardContent>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                <Typography variant="h6">Tasks by Assignee</Typography>
                <Chip label="Top 10" size="small" />
              </Stack>
              <Divider sx={{ mb: 2 }} />
              <Box sx={{ height: 360, minHeight: 360 }}>
                <ResponsiveContainer width="100%" height="100%" minWidth={600}>
                  <BarChart data={assigneeData} margin={{ left: 16, right: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 12 }}
                      interval={0}
                      angle={0}
                      textAnchor="middle"
                      height={80}
                      tickFormatter={(value: string) =>
                        value.length > 10 ? `${value.slice(0, 10)}…` : value
                      }
                    />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="value" fill={assigneeBarColor} radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};
