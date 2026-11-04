---
name: refine-v5-enforcer
description: Triggers automatically before implementing any new feature, UI component, or data hook. It forces the agent to consult Refine.dev and MUI documentation via context7 to ensure strict adherence to Refine v5 and MUI v6 concepts.
---

# Refine v5 & MUI v6 Concept & Hook Checker

## Goal
To guarantee that all code strictly adheres to Refine v5 architecture, hooks, best practices, **and** MUI v6 component APIs before any files are modified.

## Instructions
Before generating code or implementation plans for a new feature (such as scaffolding a new view or improving a deployment status dashboard), you must execute the following steps:

1. **Read Local Context**: Locate and analyze `context7` in the workspace to load our project-specific Refine guidelines and constraints.
2. **Search Refine.dev Docs**: Query the official `refine.dev` documentation via context7 (library ID: `/refinedev/refine`), explicitly targeting **v5** concepts relevant to the current task.
3. **Search MUI Docs**: Query the official MUI documentation via context7 (library ID: `/mui/material-ui`), explicitly targeting **v6** component APIs, theming, and patterns relevant to the current task.
4. **List Documentation Links**: Before proceeding, **print the documentation URLs / pages you consulted** in a clear list so the user can read them too. Format example:
   - 📖 Refine v5 — AuthProvider: `https://refine.dev/docs/authentication/auth-provider/`
   - 📖 MUI v6 — DataGrid: `https://mui.com/x/react-data-grid/`
5. **Verify Hooks & Components**: List the Refine v5 hooks (e.g., `useList`, `useForm`, `useNavigation`) **and** MUI components (e.g., `DataGrid`, `TextField`, `Dialog`) you plan to use and verify their current v5/v6 signatures.
6. **Draft the Plan**: Output a brief implementation plan validating that your proposed approach is strictly "Refine v5 + MUI v6 aligned."

## Context7 Library IDs (Quick Reference)
| Library        | Context7 ID             | Target Version |
|----------------|-------------------------|----------------|
| Refine.dev     | `/refinedev/refine`     | v5             |
| MUI Material   | `/mui/material-ui`      | v6             |

## Constraints
- **Do Not** write code immediately; verification is mandatory.
- **Do Not** guess or hallucinate hook parameters or MUI component props.
- **Do Not** use legacy Refine v3/v4 patterns or MUI v4/v5 patterns under any circumstances.
- **Always** list the documentation links you consulted before writing code.
