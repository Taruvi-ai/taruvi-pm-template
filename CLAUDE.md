# CLAUDE.md - AI Assistant Guide for Taruvi Refine Template

## Project Overview

This is a **Refine.dev v5** project - a React-based framework for building admin panels, dashboards, and internal tools. Refine provides a collection of hooks and components that abstract CRUD operations and integrate with various backend services.

**CRITICAL:** This project uses **Refine v5** which has significantly different hook syntax from v4. Always use the v5 patterns documented in the "[IMPORTANT: Refine v5 Syntax Changes](#important-refine-v5-syntax-changes)" section below.

**When confused or need clarification:** Use the Task tool with `subagent_type='Explore'` and set thoroughness to "medium" or "very thorough" to understand the codebase patterns before making changes.

---

## Pre-Work Checklist

### Before Starting Any Task:

1. **Create a Project Spec Document**
   - Run exploration to understand current state
   - Document existing resources, data providers, and auth flow
   - Identify dependencies and integration points
   - Map out affected files and components

2. **Read Relevant Files**
   - Always use Read tool on files before editing
   - Check existing patterns in similar components
   - Review provider implementations

3. **Plan with TodoWrite**
   - Break down complex tasks into steps
   - Track progress through the implementation

---

## Data Providers

All providers are configured in `/src/providers/refineProviders.ts` and registered in `/src/App.tsx`.

**Available Providers:**

| Provider | Name in App.tsx | Purpose |
|----------|-----------------|---------|
| `taruviDataProvider` | `default` | Database CRUD operations |
| `taruviStorageProvider` | `storage` | File upload/download/delete |
| `taruviFunctionsProvider` | `functions` | Execute serverless functions |
| `taruviAppProvider` | `app` | App-level data (roles) |
| `taruviUserProvider` | `user` | Current user data |
| `taruviAnalyticsProvider` | `analytics` | Execute saved SQL queries |
| `taruviAuthProvider` | N/A | Authentication (separate prop) |
| `taruviAccessControlProvider` | N/A | Cerbos permissions (optional, separate prop) |

**Supported Operations by Provider:**

Not all providers support all Refine hooks. Use this matrix to know which hooks work with each provider:

| Hook | `default` | `storage` | `functions` | `app` | `user` | `analytics` |
|------|-----------|-----------|-------------|-------|--------|-------------|
| `useList` / `getList` | ✅ | ✅ | ❌ | ✅ (roles only) | ✅ (users only) | ❌ |
| `useOne` / `getOne` | ✅ | ✅ (returns URL) | ❌ | ✅ (settings only) | ✅ | ❌ |
| `useMany` / `getMany` | ✅ | ❌ (returns []) | ❌ | ❌ | ❌ | ❌ |
| `useCreate` / `create` | ✅ | ✅ (upload) | ✅ (execute) | ❌ | ✅ | ✅ (execute) |
| `useCreateMany` | ✅ | ✅ (batch upload) | ❌ | ❌ | ❌ | ❌ |
| `useUpdate` / `update` | ✅ | ✅ (metadata) | ❌ | ❌ | ✅ | ❌ |
| `useUpdateMany` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `useDelete` / `deleteOne` | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| `useDeleteMany` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `custom` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |

**Key Notes:**
- `functions` and `analytics` providers only support `useCreate` to execute functions/queries
- `app` provider: `useList` works only with `resource: "roles"`, `useOne` works only with `resource: "settings"`
- `user` provider: `useList`/`useOne`/`useCreate`/`useUpdate`/`useDelete` work with `resource: "users"`
- `storage` provider: `useOne` returns the file URL (not file content)

**Registration in App.tsx:**
```typescript
import {
  taruviDataProvider,
  taruviAuthProvider,
  taruviStorageProvider,
  taruviFunctionsProvider,
  taruviAppProvider,
  taruviUserProvider,
  taruviAnalyticsProvider,
  // taruviAccessControlProvider, // Optional - uncomment to enable
} from "./providers/refineProviders";

<Refine
  dataProvider={{
    default: taruviDataProvider,
    storage: taruviStorageProvider,
    functions: taruviFunctionsProvider,
    app: taruviAppProvider,
    user: taruviUserProvider,
    analytics: taruviAnalyticsProvider,
  }}
  authProvider={taruviAuthProvider}
  // accessControlProvider={taruviAccessControlProvider} // Optional - uncomment to enable
  // ...
/>
```

**Exported Types and Utilities:**

The providers also export useful types and utility functions:

```typescript
import {
  // Types
  TaruviUser,           // User identity interface
  TaruviMeta,           // Extended meta options (populate, aggregate, etc.)
  TaruviListResponse,   // Response wrapper for list endpoints
  StorageUploadVariables,  // Interface for storage uploads
  LoginParams,          // Login parameters
  LogoutParams,         // Logout parameters
  RegisterParams,       // Registration parameters
  FunctionMeta,         // Function execution meta options
  AnalyticsMeta,        // Analytics query meta options

  // Utility functions (for advanced usage)
  buildRefineQueryParams,   // Build query params from Refine options
  convertRefineFilters,     // Convert Refine filters to Taruvi format
  convertRefineSorters,     // Convert Refine sorters to Taruvi format
  convertRefinePagination,  // Convert pagination to Taruvi format
  buildQueryString,         // Build query string from params object
  REFINE_OPERATOR_MAP,      // Mapping of Refine operators to Taruvi suffixes
} from "./providers/refineProviders";
```

---

### 1. `taruviDataProvider` - Database CRUD Operations

**Location:** `/src/providers/refineProviders.ts`
**Package:** `@taruvi/refine-providers`

**Purpose:** Handles all database table operations (Create, Read, Update, Delete)

**Usage in Resources:**
```typescript
// App.tsx - Resource definition
resources={[
  {
    name: "blog_posts",        // Maps to database table
    list: "/blog-posts",
    create: "/blog-posts/create",
    edit: "/blog-posts/edit/:id",
    show: "/blog-posts/show/:id",
    meta: { canDelete: true },
  }
]}
```

**Common Hooks:**

```typescript
// List page - Display records in table
import { useDataGrid } from "@refinedev/mui";

const { dataGridProps } = useDataGrid({
  resource: "blog_posts",  // Table name
});

// Returns: columns, rows, pagination, sorting, filtering
```

```typescript
// Create/Edit page - Form handling
import { useForm } from "@refinedev/react-hook-form";

const {
  saveButtonProps,
  refineCore: { queryResult },
  register,
  control,
  formState: { errors },
} = useForm({
  resource: "blog_posts",
  action: "create", // or "edit"
});
```

```typescript
// Show page - Display single record (v5 syntax)
import { useShow, useOne } from "@refinedev/core";

const { result, query: { isLoading, isError } } = useShow({
  resource: "blog_posts",
  id: "123",
});

const record = result;  // Direct access, no need for .data
```

**Supported Operations:**
- `getList` - Fetch multiple records with pagination/filtering
- `getOne` - Fetch single record by ID
- `create` - Create new record
- `update` - Update existing record
- `deleteOne` - Delete single record
- `getMany` - Fetch multiple specific records by IDs
- `createMany` - Create multiple records
- `updateMany` - Update multiple records
- `deleteMany` - Delete multiple records
- `custom` - Custom API calls

**Advanced Meta Options:**

The `meta` parameter provides additional configuration for database operations:

```typescript
// Override table name (useful for dynamic tables)
useList({
  resource: "posts",
  meta: {
    tableName: "archived_posts",  // Use different table than resource name
  },
});

// Override ID column name (default: "id")
useOne({
  resource: "users",
  id: "abc123",
  meta: {
    idColumnName: "user_uuid",  // Use custom primary key column
  },
});

// Select specific fields only (performance optimization)
useList({
  resource: "blog_posts",
  meta: {
    select: ["id", "title", "created_at"],  // Array format
    // or
    select: "id,title,created_at",           // String format
  },
});

// Populate foreign key relationships
useShow({
  resource: "blog_posts",
  id: 1,
  meta: {
    populate: ["category", "author"],  // Array format
    // or
    populate: "category,author",       // String format
  },
});

// Combine multiple meta options
useList({
  resource: "products",
  meta: {
    tableName: "active_products",
    select: ["id", "name", "price"],
    populate: "category,supplier",
  },
});

// Advanced aggregation and grouping
useList({
  resource: "orders",
  meta: {
    aggregate: ["sum(total)", "count(*)", "avg(total)"],  // Array of aggregate expressions
    groupBy: ["region", "status"],                         // Array of field names
    having: [                                              // Array of CrudFilter objects
      { field: "sum(total)", operator: "gt", value: 1000 }
    ],
  },
});
```

**Advanced Query Features (Analytics & Aggregation):**

The data provider supports powerful SQL-like aggregation and grouping capabilities for building analytics dashboards and reports.

**Aggregate Functions:**

Use the `aggregate` meta option to perform calculations across rows:

```typescript
// Sales report with totals and averages
const { result, query: { isLoading } } = useList({
  resource: "orders",
  meta: {
    aggregate: ["sum(total)", "avg(total)", "count(*)"],
    groupBy: ["status"],
  },
});
// Result includes aggregated columns alongside regular data
```

**Supported Aggregate Functions:**
- `sum(field)` - Sum of values
- `avg(field)` - Average of values
- `count(*)` or `count(field)` - Count records
- `min(field)` - Minimum value
- `max(field)` - Maximum value
- `array_agg(field)` - PostgreSQL array aggregation
- `string_agg(field, delimiter)` - Concatenate strings
- `json_agg(field)` - JSON array aggregation
- `stddev(field)` - Standard deviation
- `variance(field)` - Statistical variance

**GROUP BY Clauses:**

Use the `groupBy` meta option to group results by one or more fields:

```typescript
// Group products by category
const { result } = useList({
  resource: "products",
  meta: {
    aggregate: ["count(*) as product_count", "avg(price) as avg_price"],
    groupBy: ["category", "status"],
  },
});
```

**HAVING Filters:**

Use the `having` meta option to filter aggregated results (uses same filter operators as regular filters):

```typescript
// Find categories with more than 10 products and average price > $50
const { result } = useList({
  resource: "products",
  meta: {
    aggregate: ["count(*)", "avg(price)"],
    groupBy: ["category"],
    having: [
      { field: "count(*)", operator: "gt", value: 10 },
      { field: "avg(price)", operator: "gte", value: 50 },
    ],
  },
});
```

**Complete Analytics Example:**

Combining filters, aggregates, grouping, and having clauses:

```typescript
// Sales dashboard: Revenue by region for completed orders with revenue > $1000
const { result, query: { isLoading } } = useList({
  resource: "orders",
  filters: [
    { field: "status", operator: "in", value: ["completed", "shipped"] },
    { field: "created_at", operator: "gte", value: "2024-01-01" },
  ],
  meta: {
    aggregate: [
      "sum(total) as revenue",
      "count(*) as order_count",
      "avg(total) as avg_order_value"
    ],
    groupBy: ["region", "status"],
    having: [
      { field: "sum(total)", operator: "gt", value: 1000 },
    ],
  },
});

// Access aggregated results
result.data.forEach(row => {
  console.log(`${row.region}: ${row.revenue} revenue, ${row.order_count} orders`);
});
```

**Filter Operators Reference:**

The data provider supports comprehensive filtering with the following operators:

| Operator | Description | Example Usage | Query Parameter |
|----------|-------------|---------------|-----------------|
| `eq` | Equals | `{ field: "status", operator: "eq", value: "active" }` | `status=active` |
| `ne` | Not equals | `{ field: "status", operator: "ne", value: "deleted" }` | `status__ne=deleted` |
| `lt` | Less than | `{ field: "age", operator: "lt", value: 18 }` | `age__lt=18` |
| `gt` | Greater than | `{ field: "age", operator: "gt", value: 21 }` | `age__gt=21` |
| `lte` | Less than or equal | `{ field: "price", operator: "lte", value: 100 }` | `price__lte=100` |
| `gte` | Greater than or equal | `{ field: "price", operator: "gte", value: 10 }` | `price__gte=10` |
| `contains` | Contains substring (case-sensitive) | `{ field: "name", operator: "contains", value: "phone" }` | `name__contains=phone` |
| `ncontains` | Does not contain (case-sensitive) | `{ field: "name", operator: "ncontains", value: "test" }` | `name__ncontains=test` |
| `containss` | Contains substring (case-insensitive) | `{ field: "name", operator: "containss", value: "PHONE" }` | `name__icontains=PHONE` |
| `startswith` | Starts with (case-sensitive) | `{ field: "email", operator: "startswith", value: "admin" }` | `email__startswith=admin` |
| `startswiths` | Starts with (case-insensitive) | `{ field: "email", operator: "startswiths", value: "ADMIN" }` | `email__istartswith=ADMIN` |
| `endswith` | Ends with (case-sensitive) | `{ field: "email", operator: "endswith", value: ".com" }` | `email__endswith=.com` |
| `endswiths` | Ends with (case-insensitive) | `{ field: "email", operator: "endswiths", value: ".COM" }` | `email__iendswith=.COM` |
| `in` | Value in array | `{ field: "status", operator: "in", value: ["active", "pending"] }` | `status__in=active,pending` |
| `nin` | Value not in array | `{ field: "status", operator: "nin", value: ["deleted", "banned"] }` | `status__nin=deleted,banned` |
| `null` | Is NULL | `{ field: "deleted_at", operator: "null", value: true }` | `deleted_at__null=true` |
| `nnull` | Is NOT NULL | `{ field: "verified_at", operator: "nnull", value: true }` | `verified_at__nnull=true` |
| `between` | Value between range (inclusive) | `{ field: "price", operator: "between", value: [10, 100] }` | `price__between=10,100` |
| `nbetween` | Value not between range | `{ field: "price", operator: "nbetween", value: [10, 100] }` | `price__nbetween=10,100` |

**Filter Examples:**

```typescript
// Multiple filters with different operators
useList({
  resource: "products",
  filters: [
    { field: "status", operator: "eq", value: "active" },
    { field: "price", operator: "between", value: [10, 100] },
    { field: "name", operator: "containss", value: "phone" },
    { field: "category", operator: "in", value: ["electronics", "gadgets"] },
    { field: "deleted_at", operator: "null", value: true },
  ],
});

// Case-insensitive search
useList({
  resource: "users",
  filters: [
    { field: "email", operator: "startswiths", value: "admin" },
    { field: "name", operator: "containss", value: "john" },
  ],
});

// Range and exclusion filters
useList({
  resource: "orders",
  filters: [
    { field: "total", operator: "gte", value: 100 },
    { field: "status", operator: "nin", value: ["cancelled", "refunded"] },
    { field: "created_at", operator: "between", value: ["2024-01-01", "2024-12-31"] },
  ],
});
```

**DataTable Schema Management:**
- Use `mcp__taruvi__create_update_schema` to define tables
- Use `mcp__taruvi__query_datatable_data` for advanced filtering
- Use `mcp__taruvi__upsert_datatable_data` for bulk operations

---

### 2. `taruviStorageProvider` - File Storage Operations

**Location:** `/src/providers/refineProviders.ts`
**Package:** `@taruvi/refine-providers`

**Purpose:** Handles file uploads, downloads, and deletions from storage buckets

**Integration:**
```typescript
// App.tsx
dataProvider={{
  default: taruviDataProvider,
  storage: taruviStorageProvider,  // Named provider
}}
```

**Usage Pattern (v5 syntax):**
```typescript
import { useCreate } from "@refinedev/core";

// Upload single file
const { mutate: uploadFile, mutation } = useCreate();

const handleUpload = (file: File) => {
  uploadFile({
    resource: "my-bucket",  // Bucket name (can override with meta.bucketName)
    values: {
      files: [file],           // Array of File objects
      paths: ["folder/file.pdf"],    // Optional: custom paths (defaults to file.name)
      metadatas: [{ userId: 123 }],  // Optional: metadata for each file
    },
    dataProviderName: "storage",  // Use storage provider
  });
};

// Upload multiple files
const handleMultipleUpload = (files: File[]) => {
  uploadFile({
    resource: "my-bucket",
    values: {
      files: files,
      paths: files.map(f => `uploads/${f.name}`),
      metadatas: files.map(() => ({ uploadedAt: new Date() })),
    },
    dataProviderName: "storage",
  });
};

// Check upload status
if (mutation.isPending) { /* show loading */ }
if (mutation.isError) { /* show error */ }
```

**Important:** The storage provider expects `{ files: File[], paths?: string[], metadatas?: Record<string, unknown>[] }` - NOT FormData!

**Advanced Meta Options:**

```typescript
// Override bucket name
useCreate({
  resource: "uploads",  // Default bucket name
  values: { files: [file] },
  dataProviderName: "storage",
  meta: {
    bucketName: "private-uploads",  // Use different bucket
  },
});

// List files with bucket override
useList({
  resource: "public-files",
  dataProviderName: "storage",
  meta: {
    bucketName: "media-assets",  // Override resource name
  },
});
```

**Supported Operations:**
- `getList` - List files in bucket with filtering
- `getOne` - Download single file by path
- `create` - Upload single or multiple files
- `update` - Update file metadata
- `deleteOne` - Delete single file
- `deleteMany` - Delete multiple files
- `custom` - Custom API calls

**Note:** `getMany` and `updateMany` are not applicable for file storage and return empty/undefined.

**Common Operations:**
- Upload files to buckets
- Generate download URLs
- Delete files
- List bucket contents

**MCP Tools for Storage:**
- `mcp__taruvi__list_buckets` - View available buckets
- `mcp__taruvi__create_bucket` - Create new bucket
- `mcp__taruvi__list_objects` - List files in bucket
- `mcp__taruvi__get_bucket_quota` - Check storage usage

---

### 3. `taruviAuthProvider` - Authentication

**Location:** `/src/providers/refineProviders.ts`
**Package:** `@taruvi/refine-providers`

**Purpose:** Manages user authentication state and permissions

**Methods Implemented:**
```typescript
{
  login: async (params) => { ... },       // Redirect or credentials login
  logout: async (params) => { ... },      // Clear session and logout
  check: async () => { ... },             // Verify auth status + auto token refresh
  register: async (params) => { ... },    // Redirect to signup page
  getIdentity: async () => { ... },       // Get current user (TaruviUser)
  getPermissions: async () => { ... },    // Get roles, permissions, groups
  onError: async (error) => { ... },      // Auto refresh on 401, handle errors
}
```

**Login Parameters:**
```typescript
interface LoginParams {
  callbackUrl?: string;    // URL to redirect after login (default: "/")
  username?: string;       // For credentials flow (if supported)
  password?: string;       // For credentials flow (if supported)
  redirect?: boolean;      // Use redirect flow (default: true)
}
```

**Usage in Components:**

```typescript
// Redirect-based login (default - most common)
import { useLogin } from "@refinedev/core";

const { mutate: login } = useLogin();

const handleLogin = () => {
  login({
    callbackUrl: window.location.origin + "/dashboard",
    redirect: true,  // Default behavior
  });
  // User will be redirected to backend OAuth/SSO login
};

// Credentials-based login (if supported by backend)
const handleCredentialsLogin = (username: string, password: string) => {
  login({
    username,
    password,
    redirect: false,
  });
};
```

```typescript
// Get current user identity
import { useGetIdentity } from "@refinedev/core";
import type { TaruviUser } from "../providers/refineProviders";

const { data: user } = useGetIdentity<TaruviUser>();
// Returns: TaruviUser object

// TaruviUser interface (exported from @taruvi/refine-providers)
interface TaruviUser {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  is_active: boolean;
  is_staff: boolean;
  is_superuser: boolean;
  is_deleted: boolean;
  date_joined: string;    // ISO 8601 date-time
  last_login: string;     // ISO 8601 date-time
  groups: UserGroup[];
  user_permissions: UserPermission[];
  attributes: Record<string, unknown>;
  missing_attributes: string[];
  roles: UserRole[];
}

interface UserGroup {
  id: number;
  name: string;
}

interface UserPermission {
  id: number;
  name: string;
  codename: string;
  content_type: string;   // "app_label.model"
}

interface UserRole {
  name: string;
  slug: string;
  type: "app_role";
  app_slug: string;
  source: "direct" | "site_role" | "inherited";
}
```

```typescript
// Get user permissions
import { usePermissions } from "@refinedev/core";

const { data: permissions } = usePermissions();
// Returns:
// {
//   roles: UserRole[],           // Array of role objects with name, slug, source
//   user_permissions: UserPermission[],  // Django permissions
//   groups: UserGroup[],         // Django groups
//   is_staff: boolean,
//   is_superuser: boolean,
// }
```

```typescript
// Protected routes
import { Authenticated } from "@refinedev/core";

<Authenticated
  fallback={<LoginRedirect />}
  loading={<LoadingScreen />}
>
  <YourProtectedComponent />
</Authenticated>
```

**Auth Flow:**
1. User clicks login → redirected to OAuth/SSO provider
2. OAuth callback → sets tokens (access + refresh)
3. `check()` validates token on protected routes (auto-refreshes if expired)
4. `getIdentity()` fetches user profile from JWT token
5. `onError()` handles 401 errors with automatic token refresh

---

### 4. `taruviAccessControlProvider` - Resource-Based Authorization (Optional)

**Location:** `/src/providers/refineProviders.ts`
**Package:** `@taruvi/refine-providers`

**Purpose:** Provides resource-based authorization using Cerbos policies (Policy as Code)

**Features:**
- Uses DataLoader for request batching (multiple `useCan` calls → single API request)
- Integrates with Refine's built-in TanStack Query for caching
- Configurable batch delay for optimizing network requests

**To Enable:** Uncomment the import and registration in `App.tsx`:
```typescript
// In imports:
import { taruviAccessControlProvider } from "./providers/refineProviders";

// In Refine component:
<Refine
  accessControlProvider={taruviAccessControlProvider}
  // ...
/>
```

**Advanced: Custom Batch Delay**

The provider uses DataLoader to batch multiple permission checks into a single API call.
You can customize the batch delay if needed:

```typescript
// In refineProviders.ts (default is 10ms)
export const taruviAccessControlProvider = accessControlProvider(taruviClient, {
  batchDelayMs: 50,  // Wait 50ms to collect permission checks before batching
});
```

**Usage with Refine Hooks:**

```typescript
// Check if user can perform action on resource
import { useCan } from "@refinedev/core";

const { data: canEdit } = useCan({
  resource: "blog_posts",
  action: "edit",
  params: { id: 123 },
});

if (canEdit?.can) {
  // Show edit button
}
```

```typescript
// Conditionally render components
import { CanAccess } from "@refinedev/core";

<CanAccess
  resource="blog_posts"
  action="delete"
  params={{ id: post.id }}
  fallback={<div>You don't have permission to delete this post</div>}
>
  <DeleteButton />
</CanAccess>
```

**How it Works:**
1. Builds principal from current user (JWT token)
2. Checks Cerbos policies for resource + action
3. Returns `{ can: boolean, reason?: string }`
4. Integrates with Refine's access control system

**Principal Structure:**
```typescript
{
  id: string,              // User ID
  roles: string[],         // Role slugs from UserRole[]
  attr: {
    username: string,
    email: string,
    first_name: string,
    last_name: string,
    is_staff: boolean,
    is_superuser: boolean,
    groups: string[],      // Group names from UserGroup[]
  }
}
```

**Resource Structure:**
```typescript
{
  tableName: string,       // Resource name
  recordId: string,        // Specific record ID or "*"
  attributes: object,      // Additional context
  actions: string[],       // Actions to check (e.g., ["edit", "delete"])
}
```

**Note:** Requires Cerbos policies to be configured in your Taruvi backend.

---

### 5. `taruviFunctionsProvider` - Serverless Functions

**Location:** `/src/providers/refineProviders.ts`
**Package:** `@taruvi/refine-providers`

**Purpose:** Execute serverless functions deployed on the Taruvi platform

**Usage with Refine Hooks:**
```typescript
import { useCreate } from "@refinedev/core";

// Execute a function
const { mutate: executeFunction, mutation } = useCreate();

const handleExecute = () => {
  executeFunction({
    resource: "my-function-slug",  // Function slug
    values: {
      param1: "value1",
      param2: 123,
    },
    dataProviderName: "functions",  // Use functions provider
    meta: {
      async: false,  // true for background execution
    },
  });
};

// Check execution status
if (mutation.isPending) { /* show loading */ }
if (mutation.isSuccess) { console.log(mutation.data); }
```

**Helper Functions (Recommended):**

Use the utility functions in `/src/utils/functionHelpers.ts` for simpler usage:

```typescript
import { executeFunction, executeFunctionAsync } from "../../utils/functionHelpers";

// Synchronous execution - wait for result
const result = await executeFunction("calculate-total", { items: [1, 2, 3] });

// Asynchronous execution - fire and forget
executeFunctionAsync("send-notification", { message: "Hello" })
  .catch(err => console.error("Error:", err));
```

---

### 6. `taruviAppProvider` - App-Level Data

**Location:** `/src/providers/refineProviders.ts`
**Package:** `@taruvi/refine-providers`

**Purpose:** Fetch app-level data like roles

**Usage:**
```typescript
import { useList } from "@refinedev/core";

// Get all app roles
const { result, query: { isLoading } } = useList({
  resource: "roles",
  dataProviderName: "app",
});

// result.data contains array of roles
```

---

### 7. `taruviUserProvider` - Current User Data

**Location:** `/src/providers/refineProviders.ts`
**Package:** `@taruvi/refine-providers`

**Purpose:** Fetch current user data and user-specific information

**Usage:**
```typescript
import { useOne, useList } from "@refinedev/core";

// Get current user (alternative to authProvider.getIdentity)
const { result: currentUser, query: { isLoading } } = useOne({
  resource: "me",
  id: "",  // Empty string - the provider handles this
  dataProviderName: "user",
});

// Get user's roles
const { result: userRoles } = useList({
  resource: "roles",
  dataProviderName: "user",
});
```

---

### 8. `taruviAnalyticsProvider` - Saved SQL Queries

**Location:** `/src/providers/refineProviders.ts`
**Package:** `@taruvi/refine-providers`

**Purpose:** Execute saved SQL queries created via MCP tools

**Usage:**
```typescript
import { useCreate } from "@refinedev/core";

// Execute a saved query
const { mutate: executeQuery, mutation } = useCreate();

const runQuery = () => {
  executeQuery({
    resource: "monthly-sales-report",  // Query slug
    values: {
      // Optional parameters for the query
      start_date: "2024-01-01",
      end_date: "2024-12-31",
    },
    dataProviderName: "analytics",
  });
};

// Access results
if (mutation.isSuccess) {
  const queryResults = mutation.data;
  console.log(queryResults);
}
```

**Creating Queries (via MCP):**
```typescript
await mcp__taruvi__create_query({
  name: "Monthly Sales Report",
  query_text: `
    SELECT
      DATE_TRUNC('month', created_at) as month,
      SUM(total) as revenue
    FROM orders
    WHERE created_at BETWEEN :start_date AND :end_date
    GROUP BY month
    ORDER BY month DESC
  `,
  secret_key: "postgres-analytics",
});
```

---

## Refine.dev Patterns

### Resource Structure

**Standard CRUD Pattern (Follow this for all resources):**

```
/src/pages/{resource}/
├── list.tsx     - Table view with pagination, sorting, filters
├── create.tsx   - Form to create new records
├── edit.tsx     - Form to update existing records
├── show.tsx     - Read-only detail view
└── index.ts     - Barrel export
```

**Example Resource Registration:**
```typescript
// App.tsx
resources={[
  {
    name: "categories",           // Database table name
    list: "/categories",          // Route for list page
    create: "/categories/create",
    edit: "/categories/edit/:id",
    show: "/categories/show/:id",
    meta: {
      canDelete: true,            // Enable delete button
      label: "Categories",        // Display name
      icon: <CategoryIcon />,     // Sidebar icon
    },
  }
]}
```

### Common Refine Hooks (v5 Syntax)

| Hook | Purpose | v5 Returns |
|------|---------|---------|
| `useDataGrid` | List view with MUI DataGrid | `dataGridProps`, `tableQuery`, `result` |
| `useForm` | Form handling (create/edit) | `saveButtonProps`, `register`, `control`, `refineCore` |
| `useShow` | Fetch single record for display | `result`, `query: { isLoading, isError }` |
| `useOne` | Fetch related single record | `result`, `query: { isLoading, isError }` |
| `useMany` | Fetch multiple related records | `result`, `query: { isLoading, isError }` |
| `useList` | Fetch list of records | `result`, `query: { isLoading, isError }` |
| `useCreate` | Create mutation | `mutate`, `mutation: { isPending, isError }` |
| `useUpdate` | Update mutation | `mutate`, `mutation: { isPending, isError }` |
| `useDelete` | Delete mutation | `mutate`, `mutation: { isPending, isError }` |
| `useGetIdentity` | Current user info | `data` (user object), `isLoading` |
| `useLogin` | Login mutation | `mutate`, `isLoading` |
| `useLogout` | Logout mutation | `mutate`, `isLoading` |
| `useGo` | Navigation (replaces useNavigation) | `go` function |

### Relationship Handling

**One-to-Many (e.g., Blog Post → Category):**

```typescript
// Edit form with autocomplete
<Controller
  control={control}
  name="category_id"
  render={({ field }) => (
    <Autocomplete
      {...autocompleteProps}  // From useAutocomplete hook
      {...field}
      onChange={(_, value) => field.onChange(value?.id)}
      getOptionLabel={(item) => item.title}
      renderInput={(params) => (
        <TextField
          {...params}
          label="Category"
          error={!!(errors as any)?.category_id}
        />
      )}
    />
  )}
/>
```

**Fetching Related Data (v5 syntax):**
```typescript
// In show page
const { result: blogPost, query: { isLoading } } = useShow({
  resource: "blog_posts"
});

const { result: category, query: { isLoading: categoryLoading } } = useOne({
  resource: "categories",
  id: blogPost?.category_id,
  queryOptions: { enabled: !!blogPost?.category_id },
});

// blogPost and category are direct objects, no need for .data
```

---

## IMPORTANT: Refine v5 Syntax Changes

**This project uses Refine v5** - Hook syntax has changed significantly from v4. Always use the v5 patterns below.

### Critical Hook Return Value Changes

#### Data Hooks (useList, useOne, useMany, useShow, useInfiniteList)

**v5 groups return values into `query` and `result` objects:**

```typescript
// ❌ WRONG (v4 syntax - will not work)
const { data, isLoading, isError } = useList({ resource: "posts" });
const posts = data.data;

// ✅ CORRECT (v5 syntax - use this)
const { result, query: { isLoading, isError } } = useList({ resource: "posts" });
const posts = result.data;
```

**useOne/useMany/useShow - Simplified result:**
```typescript
// ❌ WRONG (v4)
const { data, isLoading } = useOne({ resource: "users", id: 1 });
const user = data.data;

// ✅ CORRECT (v5)
const { result, query: { isLoading } } = useOne({ resource: "users", id: 1 });
const user = result;  // No need for .data
```

**useInfiniteList:**
```typescript
// ❌ WRONG (v4)
const { data, fetchNextPage, isLoading } = useInfiniteList();

// ✅ CORRECT (v5)
const { result, query: { fetchNextPage, isLoading } } = useInfiniteList();
const posts = result.data;
```

#### Mutation Hooks (useCreate, useUpdate, useDelete, useUpdateMany, useDeleteMany)

**Mutations now return `mutation` object instead of direct properties:**

```typescript
// ❌ WRONG (v4)
const { isPending, isError, mutate } = useUpdate();

// ✅ CORRECT (v5)
const { mutation: { isPending, isError }, mutate } = useUpdate();

// Or destructure if you need the mutation properties
const { mutate, mutation } = useUpdate();
if (mutation.isPending) { ... }
```

#### Table Hooks (useDataGrid, useTable, useSimpleList)

**Property renames:**
```typescript
// ❌ WRONG (v4)
const { tableQueryResult, setCurrent, current } = useDataGrid();

// ✅ CORRECT (v5)
const { tableQuery, setCurrentPage, currentPage } = useDataGrid();
```

**New result property:**
```typescript
const { dataGridProps, tableQuery, result } = useDataGrid({
  resource: "blog_posts",
});
// result contains the fetched data for custom access
```

---

### Parameter Name Changes

**Always use these v5 parameter names:**

| ❌ Old (v4) | ✅ New (v5) | Example |
|------------|------------|---------|
| `metaData` | `meta` | `useList({ meta: { foo: "bar" } })` |
| `sorter` or `sort` | `sorters` | `useList({ sorters: [{ field: "id", order: "desc" }] })` |
| `hasPagination: false` | `pagination: { mode: "off" }` | `useList({ pagination: { mode: "off" } })` |
| `initialCurrent` | `pagination: { currentPage: 1 }` | `useTable({ pagination: { currentPage: 1 } })` |
| `initialPageSize` | `pagination: { pageSize: 20 }` | `useTable({ pagination: { pageSize: 20 } })` |
| `resourceName` | `resource` | `useImport({ resource: "posts" })` |
| `isLoading` (mutations) | `isPending` | `mutation.isPending` |

---

### Filter Configuration Changes

**Structured filter configuration:**

```typescript
// ❌ WRONG (v4)
useList({
  config: {
    filters: [{ field: "status", operator: "eq", value: "active" }]
  }
});

// ✅ CORRECT (v5) - Direct filters prop
useList({
  filters: [
    { field: "status", operator: "eq", value: "active" }
  ]
});

// ✅ CORRECT (v5) - Structured filters for tables
useTable({
  filters: {
    initial: [{ field: "status", operator: "eq", value: "draft" }],
    permanent: [{ field: "deleted", operator: "eq", value: false }],
    defaultBehavior: "replace",  // or "merge"
  }
});
```

---

### Pagination Configuration

```typescript
// ❌ WRONG (v4)
useList({ hasPagination: false });

// ✅ CORRECT (v5)
useList({ pagination: { mode: "off" } });

// Available modes:
// - "off": No pagination
// - "server": Server-side pagination (default)
// - "client": Client-side pagination

useList({
  pagination: {
    mode: "server",
    currentPage: 1,
    pageSize: 20,
  }
});
```

---

### Navigation Changes

**useNavigation is deprecated - use useGo instead:**

```typescript
// ❌ WRONG (v4)
import { useNavigation } from "@refinedev/core";
const { push, replace, goBack } = useNavigation();
push("/tasks/new");
goBack();

// ✅ CORRECT (v5)
import { useGo } from "@refinedev/core";
import { useNavigate } from "react-router-dom";

const go = useGo();
const navigate = useNavigate();

// Navigation
go({ to: "/tasks/new", type: "push" });
go({ to: "/tasks/new", type: "replace" });

// Go back - use router's native navigate
navigate(-1);
```

---

### Resource Introspection Changes

```typescript
// ❌ WRONG (v4)
import { useResource } from "@refinedev/core";
useResource("posts");

// ✅ CORRECT (v5)
import { useResourceParams } from "@refinedev/core";
useResourceParams({ resource: "posts" });
```

---

### Access Control Props

```typescript
// ❌ WRONG (v4)
<CreateButton ignoreAccessControlProvider />

// ✅ CORRECT (v5)
<CreateButton accessControl={{ enabled: false }} />
```

---

### Resource Configuration

```typescript
// ❌ WRONG (v4)
<Refine
  resources={[{
    name: "posts",
    options: { label: "Blog Posts" }
  }]}
/>

// ✅ CORRECT (v5)
<Refine
  resources={[{
    name: "posts",
    meta: { label: "Blog Posts", canDelete: true, icon: <PostIcon /> }
  }]}
/>
```

---

### Type Import Changes

```typescript
// ❌ WRONG (v4)
import { type AuthBindings, type RouterBindings } from "@refinedev/core";

// ✅ CORRECT (v5)
import { type AuthProvider, type RouterProvider } from "@refinedev/core";
```

---

### Complete v5 Hook Examples

**List Page with useDataGrid:**
```typescript
import { useDataGrid } from "@refinedev/mui";

export const BlogPostList = () => {
  const { dataGridProps, tableQuery } = useDataGrid({
    resource: "blog_posts",
    pagination: {
      mode: "server",
      pageSize: 10,
    },
    sorters: {
      initial: [{ field: "created_at", order: "desc" }],
    },
    filters: {
      permanent: [{ field: "deleted", operator: "eq", value: false }],
    },
  });

  if (tableQuery.isLoading) return <Loading />;
  if (tableQuery.isError) return <Error />;

  return <DataGrid {...dataGridProps} />;
};
```

**Show Page with useShow + useOne:**
```typescript
import { useShow, useOne } from "@refinedev/core";

export const BlogPostShow = () => {
  const { result, query: { isLoading } } = useShow({
    resource: "blog_posts",
  });

  const post = result;

  const { result: category, query: { isLoading: categoryLoading } } = useOne({
    resource: "categories",
    id: post?.category_id,
    queryOptions: { enabled: !!post?.category_id },
  });

  if (isLoading || categoryLoading) return <Loading />;

  return (
    <Show>
      <TextField label="Title" value={post?.title} />
      <TextField label="Category" value={category?.title} />
    </Show>
  );
};
```

**Create/Update with Mutations:**
```typescript
import { useCreate, useUpdate } from "@refinedev/core";

export const BlogPostForm = ({ id }: { id?: string }) => {
  const { mutate: createPost, mutation: createMutation } = useCreate();
  const { mutate: updatePost, mutation: updateMutation } = useUpdate();

  const handleSubmit = (values: any) => {
    if (id) {
      updatePost({
        resource: "blog_posts",
        id,
        values,
        meta: { foo: "bar" },  // Note: meta not metaData
      });
    } else {
      createPost({
        resource: "blog_posts",
        values,
      });
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <form onSubmit={handleSubmit}>
      {/* form fields */}
      <button disabled={isLoading}>
        {isLoading ? "Saving..." : "Save"}
      </button>
    </form>
  );
};
```

---

### Migration Helper

**If you see old v4 code in this project, update it using these patterns:**

1. Replace `metaData` → `meta`
2. Replace `sorter` → `sorters`
3. Replace `hasPagination: false` → `pagination: { mode: "off" }`
4. Update destructuring: `{ data, isLoading }` → `{ result, query: { isLoading } }`
5. Update mutation destructuring: `{ isPending }` → `{ mutation: { isPending } }`
6. Replace `useNavigation` → `useGo` + `useNavigate`
7. Replace `useResource` → `useResourceParams`

**Automated migration (if needed):**
```bash
npx @refinedev/codemod@latest refine4-to-refine5
```

---

## Environment Configuration

**Required Variables (.env.local):**
```env
VITE_TARUVI_BASE_URL=http://tenant1.127.0.0.1.nip.io:8000
VITE_TARUVI_API_KEY=secret
VITE_TARUVI_APP_SLUG=sample-app
```

**Taruvi Client Initialization:**
```typescript
// src/taruviClient.ts
import { Client } from "@taruvi/sdk";

export const taruviClient = new Client({
  baseUrl: import.meta.env.VITE_TARUVI_BASE_URL,
  apiKey: import.meta.env.VITE_TARUVI_API_KEY,
  appSlug: import.meta.env.VITE_TARUVI_APP_SLUG,
});

// The client is used by all providers in /src/providers/refineProviders.ts
// For direct SDK usage (advanced):
// const response = await taruviClient.httpClient.get("api/...");
```

---

## MCP Tools Reference

### Schema Management
- `mcp__taruvi__create_update_schema` - Create/update table schemas
- `mcp__taruvi__get_datatable_schema` - Get table structure
- `mcp__taruvi__list_datatables` - List all tables

### Data Operations
- `mcp__taruvi__query_datatable_data` - Advanced queries with filters
- `mcp__taruvi__upsert_datatable_data` - Insert/update records
- `mcp__taruvi__delete_datatable_data` - Delete records

### Analytics Queries
- `mcp__taruvi__list_queries` - List saved queries
- `mcp__taruvi__get_query` - Get query details
- `mcp__taruvi__create_query` - Create analytics query
- `mcp__taruvi__execute_query` - Run query

### Serverless Functions
- `mcp__taruvi__list_functions` - List functions
- `mcp__taruvi__create_update_function` - Create/update function
- `mcp__taruvi__execute_function` - Execute function

### Storage
- `mcp__taruvi__list_buckets` - List storage buckets
- `mcp__taruvi__create_bucket` - Create new bucket
- `mcp__taruvi__list_objects` - List files in bucket

### Secrets
- `mcp__taruvi__list_secrets` - List secrets
- `mcp__taruvi__create_secret` - Create secret
- `mcp__taruvi__get_secret` - Get secret value

---

## Common Development Workflows

### 1. Adding a New Resource

**TodoList:**
1. Create database schema using MCP tools
2. Create resource pages (list, create, edit, show)
3. Register resource in App.tsx
4. Add navigation menu item (if needed)
5. Test CRUD operations

**Implementation:**

```typescript
// Step 1: Create schema
await mcp__taruvi__create_update_schema({
  datapackage: {
    resources: [{
      name: "products",
      schema: {
        fields: [
          { name: "id", type: "integer", constraints: { required: true } },
          { name: "name", type: "string", constraints: { required: true } },
          { name: "price", type: "number" },
        ],
        primaryKey: "id",
      }
    }]
  }
});

// Step 2: Copy page structure from existing resource (e.g., categories)
// Step 3: Add to resources array in App.tsx
// Step 4: Test in browser
```

### 2. Adding File Uploads to Resource (Path-Based Pattern)

**Pattern Overview:**
This template uses a path-based storage approach where:
- Files are stored in Taruvi storage buckets
- Database stores file paths (not URLs)
- URLs are generated on-demand using helper functions
- Simple async functions for upload/delete

**When to Use:** When resources need to store images, documents, or other file attachments

**Implementation Checklist:**
1. ☐ Create storage bucket(s) via MCP tool
2. ☐ Add path field(s) to resource schema (string type)
3. ☐ Import storage helpers from `/src/utils/storageHelpers.ts`
4. ☐ Call `uploadFile()` in create form
5. ☐ Call `uploadFileWithCleanup()` in edit form
6. ☐ Use `getStorageUrl()` to display files
7. ☐ Test upload, edit, delete flows

---

#### Step 1: Create Storage Buckets

```typescript
await mcp__taruvi__create_bucket({
  name: "resource-images",  // Convention: {resource}-{type}
  visibility: "public",      // or "private"
});
```

**Naming:** `{resource}-{file-type}` (lowercase, hyphens)

---

#### Step 2: Add Path Fields to Schema

```typescript
await mcp__taruvi__create_update_schema({
  datapackage: {
    resources: [{
      name: "your_resource",
      schema: {
        fields: [
          // ... other fields
          { name: "image_path", type: "string" },
        ]
      }
    }]
  }
});
```

**Why paths?** Environment-independent, portable, compact

---

#### Step 3: Create Form - Upload File

```typescript
import { useState } from "react";
import { uploadFile, getStorageUrl } from "../../utils/storageHelpers";

const [imagePath, setImagePath] = useState<string>("");
const [uploading, setUploading] = useState(false);

const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;

  setUploading(true);
  try {
    const path = await uploadFile("resource-images", file, { prefix: "image" });
    setImagePath(path);
    setValue("image_path", path);
  } catch (error) {
    console.error("Upload failed:", error);
  } finally {
    setUploading(false);
  }
};

// Display preview
const imageUrl = getStorageUrl("resource-images", imagePath || watch("image_path"));

// JSX:
<input type="file" onChange={handleFileChange} disabled={uploading} />
<input type="hidden" {...register("image_path")} />
{imageUrl && <img src={imageUrl} alt="Preview" />}
```

---

#### Step 4: Edit Form - Upload with Cleanup

```typescript
import { uploadFileWithCleanup, getStorageUrl } from "../../utils/storageHelpers";

const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;

  setUploading(true);
  try {
    const oldPath = queryResult?.result?.image_path;
    const path = await uploadFileWithCleanup(
      "resource-images",
      file,
      oldPath,  // Automatically deletes old file
      { prefix: "image" }
    );
    setImagePath(path);
    setValue("image_path", path);
  } catch (error) {
    console.error("Upload failed:", error);
  } finally {
    setUploading(false);
  }
};
```

**Key difference:** Use `uploadFileWithCleanup()` - deletes old file before upload

---

#### Step 5: Display Files

```typescript
import { getStorageUrl } from "../../utils/storageHelpers";

const imageUrl = getStorageUrl("resource-images", record?.image_path);

<img src={imageUrl} alt={record.title} />
```

---

#### Available Helper Functions

**Upload/Delete:**
- `uploadFile(bucket, file, options)` - Upload and return path
- `uploadFileWithCleanup(bucket, file, oldPath, options)` - Upload + delete old
- `deleteFile(bucket, path)` - Delete file

**URL Generation:**
- `getStorageUrl(bucket, path)` - Generate URL from path
- `generateFilePath(file, prefix)` - Create unique path

---

#### Testing Checklist

**Create:**
- ☐ Upload → path in database
- ☐ Preview displays
- ☐ Form submits with path

**Edit:**
- ☐ Upload → old file deleted
- ☐ New path in database
- ☐ MCP `list_objects` → old file gone

---

#### Common Pitfalls

**❌ Storing URLs:**
```typescript
setValue("image_url", url);  // BAD
```

**✅ Store paths:**
```typescript
setValue("image_path", path);  // GOOD
```

**❌ Manual cleanup:**
```typescript
await deleteFile(bucket, oldPath);
await uploadFile(bucket, file);  // BAD - verbose
```

**✅ Use cleanup helper:**
```typescript
await uploadFileWithCleanup(bucket, file, oldPath);  // GOOD
```

---

**See:** `/src/utils/storageHelpers.ts` for complete implementation

### 3. Adding Filtering to List Page

```typescript
// Basic filtering
const { dataGridProps } = useDataGrid({
  resource: "blog_posts",
  filters: {
    permanent: [
      { field: "status", operator: "eq", value: "published" }
    ],
  },
  sorters: {
    initial: [
      { field: "created_at", order: "desc" }
    ],
  },
});

// Advanced filtering with multiple operators
const { dataGridProps } = useDataGrid({
  resource: "products",
  filters: {
    permanent: [
      { field: "deleted_at", operator: "null", value: true },  // Only non-deleted
    ],
    initial: [
      { field: "status", operator: "in", value: ["active", "featured"] },
      { field: "price", operator: "between", value: [10, 1000] },
      { field: "name", operator: "containss", value: "phone" },  // Case-insensitive search
    ],
  },
  sorters: {
    initial: [
      { field: "created_at", order: "desc" }
    ],
  },
});

// Combining filters with aggregation for analytics
const { dataGridProps } = useDataGrid({
  resource: "sales",
  filters: {
    permanent: [
      { field: "status", operator: "nin", value: ["cancelled", "refunded"] },
    ],
    initial: [
      { field: "created_at", operator: "gte", value: "2024-01-01" },
    ],
  },
  meta: {
    aggregate: ["sum(amount) as total_sales", "count(*) as num_sales"],
    groupBy: ["product_id", "region"],
    having: [
      { field: "sum(amount)", operator: "gt", value: 5000 },
    ],
  },
});
```

### 4. Creating Custom Analytics Query

```typescript
// Create query for reporting
await mcp__taruvi__create_query({
  name: "Monthly Blog Stats",
  query_text: `
    SELECT
      DATE_TRUNC('month', created_at) as month,
      COUNT(*) as post_count,
      COUNT(DISTINCT author_id) as author_count
    FROM blog_posts
    WHERE created_at >= NOW() - INTERVAL '6 months'
    GROUP BY month
    ORDER BY month DESC
  `,
  secret_key: "postgres-analytics",
  description: "Blog post statistics by month",
});

// Execute query
const results = await mcp__taruvi__execute_query({
  query_slug: "monthly-blog-stats",
});
```

### 5. Calling Serverless Functions

**Pattern Overview:**
This template provides utility functions for calling serverless functions deployed on the Taruvi platform. The utilities handle authentication, URL construction, and error handling automatically.

**Location:** `/src/utils/functionHelpers.ts`

**Available Functions:**

```typescript
import { executeFunction, executeFunctionAsync } from "../../utils/functionHelpers";

// 1. Execute function and wait for result (sync)
const result = await executeFunction("calculate-total", {
  items: [1, 2, 3]
});
console.log(result);

// 2. Execute function in background (async mode)
const taskInfo = await executeFunction("process-data", {
  dataset: "large_file.csv"
}, { async: true });
console.log("Task ID:", taskInfo.task_id);

// 3. Fire-and-forget execution (best for notifications, logging)
executeFunctionAsync("send-notification", {
  message: "Order completed",
  userId: 123
}).catch(err => console.error("Notification error:", err));
```

**Common Use Cases:**

#### Notifications (Fire-and-Forget)
```typescript
// In create/edit forms - send notifications without blocking
const onSubmitHandler = async (data: any) => {
  try {
    const result = await onFinish(data);

    if (result?.data) {
      // Fire and forget - don't block form submission
      executeFunctionAsync("send-mattermost-notification", {
        action: "created",
        ticket: result.data
      }).catch(err => console.error("Notification error:", err));
    }
  } catch (error) {
    throw error;
  }
};
```

#### Background Processing
```typescript
// Long-running tasks - start async and poll/wait for result
const handleBulkImport = async (file: File) => {
  const taskInfo = await executeFunction("import-csv-data", {
    filename: file.name,
    size: file.size
  }, { async: true });

  // Poll for completion or show task ID to user
  console.log(`Import started: ${taskInfo.task_id}`);
};
```

#### Synchronous Operations
```typescript
// Quick calculations or validations - wait for result
const validateData = async (data: any) => {
  const result = await executeFunction("validate-format", {
    data: data
  });

  if (!result.valid) {
    alert(result.errors.join("\n"));
    return false;
  }
  return true;
};
```

**Implementation Details:**

The utility functions use `taruviFunctionsProvider` internally and handle:
- ✅ Authentication via the configured provider
- ✅ Error handling and logging
- ✅ Type safety with TypeScript generics
- ✅ Sync/async mode configuration

**Key Points:**
- **Use executeFunctionAsync for fire-and-forget** - cleaner than executeFunction + .catch()
- **Always handle errors** - even async calls should have .catch() for logging
- **Function slugs** - use kebab-case like "send-mattermost-notification"

**Alternative: Direct Provider Usage:**
```typescript
import { useCreate } from "@refinedev/core";

const { mutate } = useCreate();
mutate({
  resource: "my-function-slug",
  values: { param1: "value" },
  dataProviderName: "functions",
});
```

**Creating Functions:**
Use MCP tools to create/update serverless functions:
```typescript
await mcp__taruvi__create_update_function({
  name: "Send Notification",
  execution_mode: "app",
  slug: "send-notification",
  code: `
def main(params, user_data, sdk_client):
    # Your function logic here
    return {"success": True}
  `,
  async_mode: true,
});
```

### 6. Building Analytics Dashboard with Aggregation

**TodoList:**
1. Define data structure and analytics requirements
2. Create resource with appropriate schema
3. Implement list page with aggregation queries
4. Add filters for interactive exploration
5. Display results with charts or tables

**Implementation Example - Sales Analytics Dashboard:**

```typescript
// Step 1: Define schema (if needed)
await mcp__taruvi__create_update_schema({
  datapackage: {
    resources: [{
      name: "sales_transactions",
      schema: {
        fields: [
          { name: "id", type: "integer", constraints: { required: true } },
          { name: "product_id", type: "integer" },
          { name: "region", type: "string" },
          { name: "amount", type: "number" },
          { name: "quantity", type: "integer" },
          { name: "status", type: "string" },
          { name: "created_at", type: "datetime" },
        ],
        primaryKey: "id",
      }
    }]
  }
});

// Step 2: Create analytics list page - /src/pages/sales-analytics/list.tsx
import { useList } from "@refinedev/core";
import { useState } from "react";

export const SalesAnalyticsList = () => {
  const [dateRange, setDateRange] = useState({ start: "2024-01-01", end: "2024-12-31" });

  // Revenue by region with filtering
  const { result: regionStats, query: { isLoading } } = useList({
    resource: "sales_transactions",
    filters: [
      { field: "status", operator: "in", value: ["completed", "shipped"] },
      { field: "created_at", operator: "between", value: [dateRange.start, dateRange.end] },
    ],
    meta: {
      aggregate: [
        "sum(amount) as total_revenue",
        "count(*) as transaction_count",
        "avg(amount) as avg_transaction",
        "sum(quantity) as total_units"
      ],
      groupBy: ["region"],
      having: [
        { field: "sum(amount)", operator: "gt", value: 1000 },  // Only regions with >$1000 revenue
      ],
    },
  });

  // Top performing products
  const { result: productStats } = useList({
    resource: "sales_transactions",
    filters: [
      { field: "status", operator: "eq", value: "completed" },
      { field: "created_at", operator: "gte", value: dateRange.start },
    ],
    meta: {
      aggregate: [
        "sum(amount) as revenue",
        "sum(quantity) as units_sold",
        "count(*) as num_orders"
      ],
      groupBy: ["product_id"],
      having: [
        { field: "sum(amount)", operator: "gte", value: 500 },
      ],
    },
    pagination: {
      pageSize: 10,
    },
    sorters: [
      { field: "sum(amount)", order: "desc" },  // Sort by revenue
    ],
  });

  // Monthly trends
  const { result: monthlyTrends } = useList({
    resource: "sales_transactions",
    filters: [
      { field: "status", operator: "ne", value: "cancelled" },
    ],
    meta: {
      aggregate: [
        "sum(amount) as revenue",
        "count(*) as orders",
        "avg(amount) as avg_order"
      ],
      groupBy: ["DATE_TRUNC('month', created_at)"],  // SQL function in groupBy
    },
  });

  if (isLoading) return <div>Loading analytics...</div>;

  return (
    <div>
      <h1>Sales Analytics Dashboard</h1>

      {/* Date Range Selector */}
      <DateRangePicker value={dateRange} onChange={setDateRange} />

      {/* Revenue by Region */}
      <section>
        <h2>Revenue by Region</h2>
        <table>
          <thead>
            <tr>
              <th>Region</th>
              <th>Total Revenue</th>
              <th>Transactions</th>
              <th>Avg Transaction</th>
              <th>Units Sold</th>
            </tr>
          </thead>
          <tbody>
            {regionStats?.data.map((row: any) => (
              <tr key={row.region}>
                <td>{row.region}</td>
                <td>${row.total_revenue?.toFixed(2)}</td>
                <td>{row.transaction_count}</td>
                <td>${row.avg_transaction?.toFixed(2)}</td>
                <td>{row.total_units}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Top Products */}
      <section>
        <h2>Top Performing Products</h2>
        <ul>
          {productStats?.data.map((row: any) => (
            <li key={row.product_id}>
              Product #{row.product_id}: ${row.revenue} revenue, {row.units_sold} units
            </li>
          ))}
        </ul>
      </section>

      {/* Monthly Trends Chart */}
      <section>
        <h2>Monthly Trends</h2>
        {/* Integrate with charting library (Chart.js, Recharts, etc.) */}
        <pre>{JSON.stringify(monthlyTrends?.data, null, 2)}</pre>
      </section>
    </div>
  );
};

// Step 3: Register resource in App.tsx
resources={[
  {
    name: "sales_transactions",
    list: "/sales-analytics",
    meta: { label: "Sales Analytics", icon: <AnalyticsIcon /> },
  }
]}
```

**Key Analytics Patterns:**

1. **Time-based Aggregation**: Use SQL functions in groupBy
   ```typescript
   meta: {
     groupBy: ["DATE_TRUNC('day', created_at)"],
     aggregate: ["sum(amount)", "count(*)"],
   }
   ```

2. **Multiple Aggregates**: Calculate several metrics at once
   ```typescript
   meta: {
     aggregate: [
       "sum(amount) as total",
       "avg(amount) as average",
       "min(amount) as minimum",
       "max(amount) as maximum",
       "count(*) as count"
     ],
   }
   ```

3. **Conditional Aggregation**: Filter before aggregating
   ```typescript
   filters: [
     { field: "status", operator: "eq", value: "completed" },
     { field: "amount", operator: "gt", value: 0 },
   ],
   meta: {
     aggregate: ["sum(amount)"],
     groupBy: ["category"],
   }
   ```

4. **Ranking with HAVING**: Find top performers
   ```typescript
   meta: {
     aggregate: ["sum(revenue) as total"],
     groupBy: ["salesperson_id"],
     having: [
       { field: "sum(revenue)", operator: "gte", value: 10000 },
     ],
   }
   ```

**Performance Tips:**
- Add database indexes on frequently grouped/filtered columns
- Use `select` meta option to limit returned fields
- Implement pagination for large result sets
- Cache results for expensive aggregations
- Use permanent filters to exclude soft-deleted records

---

## Troubleshooting Guide

### Provider Not Working
- Check `.env.local` has all required variables
- Verify `taruviClient` is initialized in `/src/taruviClient.ts`
- Confirm providers are exported from `/src/providers/refineProviders.ts`
- Check network tab for API errors

### Resource Not Appearing
- Verify table exists using `mcp__taruvi__list_datatables`
- Check resource name matches database table name exactly
- Ensure resource is registered in `App.tsx` resources array
- Check meta.canDelete is set if delete operations needed

### Foreign Key Errors
- Ensure referenced table exists first
- Use correct field type (integer for IDs)
- Verify reference syntax: `{ resource: "table_name", fields: "id" }`
- Check if you need to reference system tables (auth_user, storage_objects)

### Authentication Issues
- Check if token is stored properly (localStorage/cookies)
- Verify `authProvider.check()` is working
- Test redirect flow with network tab open
- Ensure callback URL is whitelisted

---

## Best Practices

### Code Organization
- Keep one resource per directory in `/src/pages/`
- Use barrel exports (`index.ts`) for cleaner imports
- Follow existing component structure for consistency
- Extract reusable components to `/src/components/`

### Data Modeling
- Always define primary key in schema
- Use foreign keys for relationships
- Add indexes for frequently queried fields
- Use appropriate field types (integer, string, datetime, etc.)

### Form Validation
- Use react-hook-form validation
- Add constraints in schema (required, maxLength, etc.)
- Provide clear error messages
- Validate on both client and server

### Performance
- Use `queryOptions.enabled` to prevent unnecessary fetches
- Implement pagination for large datasets
- Add indexes on filtered/sorted columns
- Use `useMany` instead of multiple `useOne` calls

### Security
- Never expose API keys in frontend code
- Use environment variables for sensitive config
- Validate permissions on backend
- Sanitize user inputs

---

## When to Use Each Tool

**Explore Agent (`subagent_type='Explore'`):**
- Understanding project structure
- Finding how features are implemented
- Locating files that handle specific functionality
- Before making architectural changes

**Direct File Operations (Read/Edit/Write):**
- Simple file modifications
- Known file locations
- Quick bug fixes
- Adding new files to existing patterns

**MCP Tools:**
- Database schema management
- Creating analytics queries
- Managing storage buckets
- Configuring serverless functions
- Raw SQL execution for complex operations

---

## Project-Specific Notes

### Navkit Integration
- Global navigation bar is 60px height
- Custom Sider component accounts for this offset
- Styles in `/src/components/sider/index.tsx`

### Theme System
- ColorModeContext provides light/dark mode
- Uses Refine's BlueDark and Blue themes
- Toggle in header component
- Preference stored in localStorage

### Homepage / Dashboard

**Current State:**
- Simple "Hello" page at `/src/pages/home/index.tsx`
- Displays animated gradient background with welcome message
- Set as the index route in `App.tsx`

**When Building a New App with This Template:**

When you receive a problem statement for building an application, **replace the homepage with an analytics dashboard** that shows key metrics relevant to the application domain.

**Steps to Create Analytics Dashboard:**

1. **Analyze the Problem Statement**
   - Identify key metrics users need to see (e.g., total sales, active users, pending tasks)
   - Determine primary entities and their relationships
   - Define time-based trends (daily, weekly, monthly)

2. **Design Dashboard Layout**
   - Use MUI Grid for responsive card layout
   - Group related metrics together
   - Include charts for trends (use libraries like Recharts, Chart.js, or MUI X Charts)
   - Add filters for date ranges, categories, or other relevant dimensions

3. **Implement Dashboard with Aggregation Queries**
   ```typescript
   // Example: Sales Dashboard
   // /src/pages/dashboard/index.tsx
   import { useList } from "@refinedev/core";
   import { Grid, Card, CardContent, Typography } from "@mui/material";

   export const Dashboard = () => {
     // Total revenue query
     const { result: revenueStats } = useList({
       resource: "orders",
       filters: [
         { field: "status", operator: "eq", value: "completed" },
       ],
       meta: {
         aggregate: ["sum(total) as revenue", "count(*) as order_count"],
       },
     });

     // Revenue by month
     const { result: monthlyRevenue } = useList({
       resource: "orders",
       meta: {
         aggregate: ["sum(total) as revenue"],
         groupBy: ["DATE_TRUNC('month', created_at)"],
       },
     });

     return (
       <Grid container spacing={3}>
         <Grid item xs={12} md={6} lg={3}>
           <Card>
             <CardContent>
               <Typography variant="h6">Total Revenue</Typography>
               <Typography variant="h3">
                 ${revenueStats?.data[0]?.revenue || 0}
               </Typography>
             </CardContent>
           </Card>
         </Grid>
         {/* Add more metric cards and charts */}
       </Grid>
     );
   };
   ```

4. **Update App.tsx Routes**
   ```typescript
   // Replace the Home import
   import { Dashboard } from "./pages/dashboard";

   // Update the index route
   <Route index element={<Dashboard />} />
   ```

5. **Optional: Add to Resources for Sidebar Link**
   ```typescript
   resources={[
     {
       name: "dashboard",
       list: "/",
       meta: {
         label: "Dashboard",
         icon: <DashboardIcon />,
       },
     },
     // ... other resources
   ]}
   ```

**Dashboard Best Practices:**
- Use aggregate queries (sum, avg, count) for metrics - see "[Advanced Query Features](#advanced-query-features-analytics--aggregation)" section
- Add loading states for all data queries
- Include empty states when no data exists
- Make it actionable - add quick links to create/edit resources
- Show trends over time with charts
- Use cards for individual metrics
- Implement responsive design (mobile-friendly)
- Add date range filters for time-based analysis
- Cache expensive queries
- Consider auto-refresh for real-time dashboards

**Example Dashboard Metrics by Domain:**

- **E-commerce:** Total revenue, orders today, top products, conversion rate, abandoned carts
- **CRM:** Active deals, new leads this week, pipeline value, tasks due today, recent activities
- **Project Management:** Active projects, tasks completed this week, overdue items, team utilization
- **Content Management:** Published posts, pending reviews, page views, popular content
- **Inventory:** Low stock alerts, total items, recent orders, top-selling products

### Provider Fork Development
- See `PROVIDER_FORK_GUIDE.md` for local provider development
- Use `npm link` to test local provider changes
- Fork location: `../taruvi-refine-providers`

---

## Quick Reference

**File Paths:**
- Main app: `/src/App.tsx`
- Providers: `/src/providers/refineProviders.ts`
- Client: `/src/taruviClient.ts`
- Pages: `/src/pages/{resource}/`
- Components: `/src/components/`
- Env: `/.env.local`

**Key Commands:**
```bash
npm run dev          # Start dev server
npm run build        # Build for production
npm run refine       # Run Refine CLI
```

**IMPORTANT - Development Server:**
- **DO NOT run `npm run dev` or `npm run build`** - The development server is already running
- Changes to source files will automatically trigger hot reload
- Check the browser at the running dev server URL (typically http://localhost:5173)
- Only run build commands if explicitly requested by the user

**Documentation:**
- Refine Docs: https://refine.dev/docs
- MUI DataGrid: https://mui.com/x/react-data-grid/
- React Hook Form: https://react-hook-form.com/

---

## Remember

1. **Always use Refine v5 syntax** - Check the v5 syntax section for correct hook usage
2. **Always read files before editing** - Use Read tool
3. **Follow existing patterns** - Check similar components
4. **Use TodoWrite for complex tasks** - Track progress
5. **Explore when confused** - Use Task tool with Explore agent
6. **Create spec doc before starting** - Understand context
7. **Test incrementally** - Don't make many changes at once
8. **Validate schemas** - Use MCP tools to check table structure
9. **Keep it simple** - Don't over-engineer solutions
10. **Use `meta` not `metaData`** - v5 renamed this parameter
11. **Use `result` and `query` destructuring** - v5 grouped return values
12. **Leverage advanced query features** - Use aggregate, groupBy, having for analytics
13. **Know your filter operators** - 20+ operators available (eq, in, between, containss, etc.)
14. **Storage provider uses `bucketName`** - Not `bucket` in meta options
15. **Use `dataProviderName`** - Specify which provider to use (storage, functions, app, user, analytics)
16. **All 8 providers are configured** - See `/src/providers/refineProviders.ts` for the full list
17. **Import types from refineProviders** - Use `import type { TaruviUser, TaruviMeta } from "./providers/refineProviders"`

This is a **Refine.dev v5 project** - leverage the framework's hooks and patterns rather than reinventing CRUD operations.

## Active Technologies
- TypeScript 5.8.3 / React 19.1.0
- MUI v7.3.7 (Material UI) - uses new Grid `size` prop syntax
- PostgreSQL (via Taruvi backend) - schema managed through MCP tools
- @taruvi/sdk and @taruvi/refine-providers for backend integration

## Recent Changes
- **@taruvi/refine-providers v1.1.3**: Now exports types (TaruviUser, TaruviMeta, etc.) and utility functions
- **TaruviUser interface updated**: Now returns full user object from API (not just JWT claims)
- **accessControlProvider**: Now supports `batchDelayMs` option for DataLoader batching
- **Type exports added**: refineProviders.ts now re-exports types for app-wide use
- Upgraded MUI to v7.3.7 (Grid uses `size` prop instead of `xs`, `md`, etc.)
- All 8 @taruvi/refine-providers now configured and available
- Removed legacy authProvider.ts and custom DataProvider from taruviClient.ts
- functionHelpers.ts now uses taruviFunctionsProvider instead of direct HTTP calls
