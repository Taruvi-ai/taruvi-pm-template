import { User, type Client } from "@taruvi/sdk";

const USER_PATCH_FLAG = "__pm_getUserApps404Patched__";
const HTTP_PATCH_FLAG = "__pm_httpGetUserApps404Patched__";

const USER_APPS_PATH_PATTERN = /\/users\/[^/]+\/apps\/?$/i;

const isUserAppsEndpoint = (endpoint: unknown): boolean => {
  if (typeof endpoint !== "string") return false;
  const withoutQuery = endpoint.split("?")[0] || "";
  return USER_APPS_PATH_PATTERN.test(withoutQuery);
};

const getStatusCode = (error: unknown): number | undefined => {
  if (!error || typeof error !== "object") return undefined;
  const maybeError = error as { response?: { status?: number }; status?: number; message?: string };
  if (typeof maybeError.response?.status === "number") return maybeError.response.status;
  if (typeof maybeError.status === "number") return maybeError.status;
  if (typeof maybeError.message === "string" && maybeError.message.includes("status code 404")) return 404;
  return undefined;
};

const patchUserPrototype = () => {
  const userProto = User.prototype as unknown as Record<string, unknown>;
  if (userProto[USER_PATCH_FLAG]) return;

  const original = userProto.getUserApps;
  if (typeof original !== "function") {
    userProto[USER_PATCH_FLAG] = true;
    return;
  }

  userProto.getUserApps = async function patchedGetUserApps(this: unknown, ...args: unknown[]) {
    try {
      return await (original as (...params: unknown[]) => Promise<unknown>).apply(this, args);
    } catch (error) {
      if (getStatusCode(error) === 404) {
        // Some tenants don't expose the user-apps endpoint; treat as empty launcher.
        return { data: [] };
      }
      throw error;
    }
  };

  userProto[USER_PATCH_FLAG] = true;
};

const patchClientHttpGet = (client?: Client | null) => {
  const httpClient = (client as unknown as { httpClient?: Record<string, unknown> })?.httpClient;
  if (!httpClient || httpClient[HTTP_PATCH_FLAG]) return;

  const originalGet = httpClient.get;
  if (typeof originalGet !== "function") {
    httpClient[HTTP_PATCH_FLAG] = true;
    return;
  }

  httpClient.get = async function patchedHttpGet(this: unknown, endpoint: string, ...args: unknown[]) {
    try {
      return await (originalGet as (...params: unknown[]) => Promise<unknown>).apply(this, [endpoint, ...args]);
    } catch (error) {
      if (isUserAppsEndpoint(endpoint) && getStatusCode(error) === 404) {
        return { data: [] };
      }
      throw error;
    }
  };

  httpClient[HTTP_PATCH_FLAG] = true;
};

export const patchTaruviUserApps404 = (client?: Client | null) => {
  patchUserPrototype();
  patchClientHttpGet(client);
};
