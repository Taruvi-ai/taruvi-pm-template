import {
  dataProvider,
  authProvider,
  storageDataProvider,
  functionsDataProvider,
  appDataProvider,
  userDataProvider,
  analyticsDataProvider,
  accessControlProvider,
} from "@taruvi/refine-providers";
import type { TaruviUser } from "@taruvi/sdk";
import { taruviClient } from "../taruviClient";

// Re-export types for easy access throughout the app
export type { TaruviUser } from "@taruvi/sdk";
export type {
  TaruviMeta,
  TaruviListResponse,
  StorageUploadVariables,
  LoginParams,
  LogoutParams,
  RegisterParams,
  FunctionMeta,
  AnalyticsMeta,
} from "@taruvi/refine-providers";

// Re-export utility functions for advanced usage
export {
  buildRefineQueryParams,
  convertRefineFilters,
  convertRefineSorters,
  convertRefinePagination,
  buildQueryString,
  REFINE_OPERATOR_MAP,
} from "@taruvi/refine-providers";

/**
 * Official Refine providers from @taruvi/refine-providers
 *
 * Available providers:
 * - taruviDataProvider (default): Database CRUD operations
 * - taruviStorageProvider (storage): File upload/download/delete
 * - taruviFunctionsProvider (functions): Execute serverless functions
 * - taruviAppProvider (app): App-level data (roles)
 * - taruviUserProvider (user): Current user data
 * - taruviAnalyticsProvider (analytics): Execute saved SQL queries
 * - taruviAuthProvider: Authentication (login, logout, check, getIdentity)
 * - taruviAccessControlProvider: Cerbos-based permission checks (with DataLoader batching)
 */

// Database CRUD operations (default data provider)
export const taruviDataProvider = dataProvider(taruviClient);

// Authentication operations (login, logout, check, getIdentity, getPermissions)
export const taruviAuthProvider = authProvider(taruviClient);

// Storage operations (file upload, download, delete from buckets)
export const taruviStorageProvider = storageDataProvider(taruviClient);

// Functions operations (execute serverless functions via useCreate)
export const taruviFunctionsProvider = functionsDataProvider(taruviClient);

// App operations (fetch app roles via useList with resource="roles")
export const taruviAppProvider = appDataProvider(taruviClient);

// User operations (get current user via useOne with resource="me", or roles via useList)
export const taruviUserProvider = userDataProvider(taruviClient);

// Analytics operations (execute saved queries via useCreate)
export const taruviAnalyticsProvider = analyticsDataProvider(taruviClient);

// Access control provider (Cerbos-based permission checks via useCan)
export const taruviAccessControlProvider = accessControlProvider(taruviClient);
