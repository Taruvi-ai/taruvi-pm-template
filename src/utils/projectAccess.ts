export type ProjectVisibilityScope = {
  departmentIdsByProject?: Record<string, string[]>;
  teamIdsByProject?: Record<string, string[]>;
  observerUserIdsByProject?: Record<string, string[]>;
};

export const isProjectVisibleToUser = (
  project: any,
  departmentId?: string | number | null,
  teamIds: Array<string | number> = [],
  userId?: string | number | null,
  scope?: ProjectVisibilityScope
) => {
  const projectKey = String(project?.id ?? "");
  const departmentIds = projectKey ? scope?.departmentIdsByProject?.[projectKey] || [] : [];
  const projectTeamIds = projectKey ? scope?.teamIdsByProject?.[projectKey] || [] : [];
  const observerUserIds = projectKey ? scope?.observerUserIdsByProject?.[projectKey] || [] : [];

  if (userId != null && observerUserIds.includes(String(userId))) {
    return true;
  }

  if (project?.private_only) {
    return userId != null && String(project?.created_by_id) === String(userId);
  }

  if (departmentIds.length === 0 && projectTeamIds.length === 0) {
    return true;
  }

  const normalizedDepartmentId =
    departmentId != null && departmentId !== "" ? String(departmentId) : null;
  const normalizedTeamIds = teamIds
    .map((id) => String(id).trim())
    .filter((id) => id.length > 0);

  const hasDepartmentMatch =
    normalizedDepartmentId != null && departmentIds.includes(normalizedDepartmentId);
  const hasTeamMatch = projectTeamIds.some((id) => normalizedTeamIds.includes(id));

  return hasDepartmentMatch || hasTeamMatch;
};
