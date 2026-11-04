# UI Guidelines

## Status colors not fully theme-controlled

The following status color implementations are currently hardcoded in component-level logic and cannot be fully controlled through `themeOptions.ts` alone:

- `src/pages/home/index.tsx` (**My Assignments page**)
  - Dashboard status cards and chip styling use hardcoded status colors in `dashboardStatusCards` and `getStatusChipStyles`.
  - Because these styles are set through component-level constants and `sx` values, theme palette changes do not fully override them.
- `src/components/tasks/TaskGantt.tsx`
  - `statusBarColors` uses hardcoded hex values (e.g., delayed `#d32f2f`).
- `src/components/tasks/TaskList.tsx`
  - `statusMeta` and `statusCircleColors` use hardcoded hex values for status chips and indicators.
- `src/pages/calendar/index.tsx`
  - `statusColors` uses hardcoded hex values for calendar task status display.

## Project dashboard chart colors not theme-controlled

- `src/pages/projects/dashboard.tsx`
  - Chart colors are currently hardcoded via a local `palette` array and direct `Cell fill` color values in Recharts.
  - These chart colors do not automatically inherit from MUI `themeOptions.ts` palette values.

If strict color consistency is required across all task and dashboard surfaces (including Projects dashboard charts), those components should be refactored to derive colors from the MUI theme palette instead of local constants.
