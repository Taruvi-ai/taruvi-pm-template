# Taruvi Refine Providers - Fork Development Guide

## Setup Complete ✅

Your local development environment is now set up to work with a forked version of `@taruvi/refine-providers`.

### What's Been Done

1. **Repository Cloned**: `../taruvi-refine-providers` (https://github.com/Taruvi-ai/taruvi-refine-providers)
2. **Package Built**: The TypeScript source has been compiled to `dist/`
3. **NPM Link Created**: A symlink connects this project to your local fork
4. **Verified**: The dev server runs successfully with the linked package

### File Locations

```
Documents/GitHub/
├── taruvi-refine-providers/        # Your fork
│   ├── src/                        # Source code to edit
│   ├── dist/                       # Built output
│   └── package.json
└── taruvi-refine-template/         # This project
    └── node_modules/@taruvi/refine-providers -> ../../taruvi-refine-providers
```

## Development Workflow

### 1. Making Changes

Navigate to the providers repository:
```bash
cd ../taruvi-refine-providers
```

The source code structure:
```
src/
├── index.ts              # Main exports
├── dataProvider.ts       # Database CRUD operations
├── authProvider.ts       # Authentication (login, logout, etc.)
├── storageProvider.ts    # File storage operations
├── accessControlProvider.ts  # Authorization (Cerbos integration)
└── utils/
    ├── filters.ts        # Filter conversion utilities
    ├── sorting.ts        # Sort conversion utilities
    └── errors.ts         # Error handling
```

### 2. Building Your Changes

After making changes, rebuild the package:

```bash
cd ../taruvi-refine-providers
npm run build
```

Or use watch mode for automatic rebuilding:
```bash
npm run dev
```

### 3. Testing in Your Template

The changes will automatically be available in your template project because of the npm link.

Start your dev server:
```bash
cd ../taruvi-refine-template
npm run dev
```

### 4. Hot Module Replacement (HMR)

**Recommended Setup for Best DX:**

Open two terminal windows:

**Terminal 1 - Provider (watch mode):**
```bash
cd ../taruvi-refine-providers
npm run dev
```

**Terminal 2 - Template (dev server):**
```bash
cd ../taruvi-refine-template
npm run dev
```

Now any changes to the provider source will automatically rebuild and hot-reload in your template!

## Common Customizations

### Example 1: Add Logging to Data Provider

Edit [`../taruvi-refine-providers/src/dataProvider.ts`](../taruvi-refine-providers/src/dataProvider.ts):

```typescript
export function dataProvider(client: Client): DataProvider {
  return {
    getList: async ({ resource, pagination, filters, sorters, meta }) => {
      console.log(`[DataProvider] getList called for ${resource}`, {
        pagination,
        filters,
        sorters
      });

      // ... existing implementation
    },
    // ... other methods
  };
}
```

### Example 2: Add Custom Headers

```typescript
export function dataProvider(client: Client): DataProvider {
  return {
    getList: async ({ resource, pagination, filters, sorters, meta }) => {
      const customHeaders = {
        'X-Custom-Header': 'my-value',
        ...meta?.headers
      };

      const result = await client.data.query({
        table_name: meta?.tableName || resource,
        params: buildRefineQueryParams({ filters, sorters, pagination, meta }),
        headers: customHeaders
      });

      return result;
    },
  };
}
```

### Example 3: Transform Data on Create

```typescript
export function dataProvider(client: Client): DataProvider {
  return {
    create: async ({ resource, variables, meta }) => {
      // Add timestamp or modify data before sending
      const enhancedData = {
        ...variables,
        created_at: new Date().toISOString(),
        created_by: 'system' // or get from auth context
      };

      const result = await client.data.upsert({
        table_name: meta?.tableName || resource,
        data: enhancedData,
        // ... rest of implementation
      });

      return result;
    },
  };
}
```

### Example 4: Custom Error Handling

Edit [`../taruvi-refine-providers/src/utils/errors.ts`](../taruvi-refine-providers/src/utils/errors.ts):

```typescript
export function handleError(error: unknown): never {
  // Add custom error tracking
  console.error('[Taruvi Provider Error]', error);

  // Send to error tracking service
  // trackError(error);

  // ... existing error handling
  throw error;
}
```

## Contributing Back Upstream

### 1. Create a Feature Branch

```bash
cd ../taruvi-refine-providers
git checkout -b feature/your-feature-name
```

### 2. Make Your Changes

Edit the source files and test thoroughly in your template project.

### 3. Commit Your Changes

```bash
git add .
git commit -m "feat: add your feature description"
```

### 4. Push and Create PR

```bash
git push origin feature/your-feature-name
```

Then create a Pull Request on GitHub: https://github.com/Taruvi-ai/taruvi-refine-providers/pulls

## Unlinking (When You're Done)

To go back to using the published npm package:

```bash
cd ../taruvi-refine-template
npm unlink @taruvi/refine-providers
npm install @taruvi/refine-providers
```

## Troubleshooting

### Changes Not Reflected

1. Make sure the build succeeded:
   ```bash
   cd ../taruvi-refine-providers
   npm run build
   ```

2. Restart your dev server:
   ```bash
   cd ../taruvi-refine-template
   # Kill the dev server (Ctrl+C) and restart
   npm run dev
   ```

### TypeScript Errors

If you see TypeScript errors in your IDE:

1. Rebuild the providers:
   ```bash
   cd ../taruvi-refine-providers
   npm run build
   ```

2. Restart your TypeScript server in VSCode:
   - Press `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows/Linux)
   - Type "TypeScript: Restart TS Server"
   - Select the option

### Link Broken

If the symlink breaks, recreate it:

```bash
cd ../taruvi-refine-providers
npm link

cd ../taruvi-refine-template
npm link @taruvi/refine-providers
```

## Package Source Code Overview

### Key Files to Know

- **[dataProvider.ts](../taruvi-refine-providers/src/dataProvider.ts)**: All CRUD operations (getList, getOne, create, update, delete)
- **[authProvider.ts](../taruvi-refine-providers/src/authProvider.ts)**: Authentication flow (login, logout, check, getIdentity)
- **[storageProvider.ts](../taruvi-refine-providers/src/storageProvider.ts)**: File upload/download operations
- **[accessControlProvider.ts](../taruvi-refine-providers/src/accessControlProvider.ts)**: Permission checks via Cerbos
- **[utils/filters.ts](../taruvi-refine-providers/src/utils/filters.ts)**: Converts Refine filters to Taruvi API format
- **[utils/sorting.ts](../taruvi-refine-providers/src/utils/sorting.ts)**: Converts Refine sorters to Taruvi API format

### Exported Types

You can also customize TypeScript types:
- `TaruviMeta` - Extended metadata options
- `TaruviUser` - User identity structure
- `LoginParams`, `LogoutParams`, `RegisterParams` - Auth params
- `StorageUploadVariables` - Storage upload interface

## Next Steps

1. ✅ Make your changes in `../taruvi-refine-providers/src/`
2. ✅ Build with `npm run build` or `npm run dev` (watch mode)
3. ✅ Test in your template project
4. ✅ Commit and push to create a PR for upstream contribution

Happy coding! 🚀
