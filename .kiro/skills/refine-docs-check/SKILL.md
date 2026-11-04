---
name: refine-docs-check
description: Always check Refine.dev v5 and MUI v6 docs before implementing any feature in this project.
---

# Refine.dev v5 & MUI v6 Documentation Check

**MANDATORY**: Before implementing ANY feature in this project, you MUST:

1. Use the context7 MCP tool to resolve the **Refine.dev** library ID (`/refinedev/refine`) and query the v5 docs for the specific feature being implemented (e.g., AuthProvider, DataProvider, routing, Authenticated component, AuthPage, etc.)
2. Use the context7 MCP tool to resolve the **MUI** library ID (`/mui/material-ui`) and query the v6 docs for any UI components, theming, or styling relevant to the feature (e.g., DataGrid, TextField, Dialog, ThemeProvider, etc.)
3. **List the documentation links / pages consulted** so the user can read them independently. Format as a bullet list, e.g.:
   - 📖 Refine v5 — AuthProvider: `https://refine.dev/docs/authentication/auth-provider/`
   - 📖 MUI v6 — Button API: `https://mui.com/material-ui/api/button/`
4. Confirm to the user that you have reviewed **both** Refine and MUI docs before writing any code
5. Use the patterns and APIs from the v5 (Refine) and v6 (MUI) docs — do NOT rely on memory or older versions

This applies to every feature, not just the first one.
