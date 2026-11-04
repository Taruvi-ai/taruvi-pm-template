---
name: pre-push-reviewer
description: Triggers automatically after code is committed but before it is pushed to a remote repository, or when explicitly asked to review recent commits. It audits the unpushed code against refine.dev docs and context7 for v5 alignment, DRY principles, code debt, and optimization.
---

# Pre-Push Code Review & Refine v5 Audit

## Goal
To act as a strict quality gate that prevents unoptimized code, technical debt, or legacy Refine v3/v4 patterns from being pushed to the codebase.

## Instructions
Before executing a `git push` or when reviewing unpushed commits, you must perform the following audit on the code diffs:

1. **Refine v5 Alignment Check**: 
   - Read `context7` for local architectural constraints.
   - Search `refine.dev` official documentation to verify any Refine hooks or components modified in the commits use valid **v5** signatures.
2. **DRY (Don't Repeat Yourself) Analysis**:
   - Scan the diffs for duplicated logic, hardcoded strings, or repeated UI layouts that should be abstracted into reusable components or utility functions.
3. **Code Debt & Optimization Check**:
   - Identify any temporary workarounds, left-over `TODO`s, or debugger statements.
   - Flag unoptimized React patterns (e.g., missing memoization, unnecessary API calls, or inefficient state management).
4. **Generate the Review Report**:
   - Output a structured list of findings, referencing exact files and line numbers.
   - Categorize findings as `BLOCKING` (must fix before push) or `SUGGESTION` (optional improvement).

## Constraints
- **Do Not** execute the `git push` command if any `BLOCKING` issues (especially Refine v5 violations) are found.
- **Do Not** provide generic advice; all feedback must directly reference the committed code.
