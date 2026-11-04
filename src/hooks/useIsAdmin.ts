import { useGetIdentity } from "@refinedev/core";

/**
 * App role allowed to manage organization data (departments, employees, teams).
 * Keep in sync with the `admin_write` rule on the org_* datatable policies in
 * the backend — this check only hides UI, the policies are what enforce it.
 */
export const ADMIN_ROLE_SLUG = "super-admin";
const ADMIN_ROLE_NAME = "super admin";

export const useIsAdmin = () => {
  const { data: user, isLoading } = useGetIdentity<any>();
  const appSlug = import.meta.env.VITE_TARUVI_APP_SLUG;
  const roles: any[] = Array.isArray(user?.roles) ? user.roles : [];

  const isAdmin = roles.some((role) => {
    // Roles from other apps on the same site don't count.
    if (role?.app_slug && appSlug && role.app_slug !== appSlug) return false;
    return (
      role?.slug === ADMIN_ROLE_SLUG ||
      String(role?.name || "").trim().toLowerCase() === ADMIN_ROLE_NAME
    );
  });

  return { isAdmin, isLoading };
};
