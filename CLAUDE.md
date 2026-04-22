# CLAUDE.md — Task Management System

## Commands

```bash
npm run dev       # Start Vite dev server (http://localhost:5173)
npm run build     # Type-check (tsc -b) then production build → dist/
npm run lint      # Run ESLint
npm run preview   # Serve production build locally
npx vitest run    # Run all tests once
npx vitest        # Run tests in watch mode
```

## Deploy

- **Repo:** https://github.com/pprakhar10/task-management-system
- **Live (Vercel):** https://task-management-system-khaki-seven.vercel.app
- Vercel is connected to GitHub — every push to `master` auto-deploys.

## Architecture

### Tech Stack
- **React 19 + TypeScript** (strict mode), built with **Vite**
- **Tailwind CSS v4** via `@tailwindcss/vite` plugin — dark mode via `.dark` class on `<html>`
- **Dexie.js** (IndexedDB wrapper) — local-first, no backend
- **dexie-react-hooks** — `useLiveQuery` for reactive DB queries
- **fake-indexeddb** (dev) — IndexedDB polyfill for Vitest
- **Vitest + jsdom** for unit/integration tests
- **jsPDF** for PDF report generation (text/table API only, no DOM screenshots)
- **Recharts** for statistics charts (Phase 8)
- Custom CSS Grid calendar (Phase 6)

### Data Model
```
WorkType: "deep" | "shallow" | "active_break"
// "unutilized" is derived (work window − calendar blocks), never stored

Category     { id, name, createdAt }
Project      { id, categoryId, name, createdAt }
Task         { id, projectId, workType, title, dueDate (YYYY-MM-DD, required),
               flag: "urgent"|"important"|null,
               status: "normal"|"currently_working"|"morning_meeting",
               completed, completedAt, createdAt }
Subtask      { id, taskId, title, dueDate (optional), completed, completedAt, createdAt }
CalendarBlock{ id, taskId (null = active_break), workType, date, startTime, endTime, createdAt }
Settings     { workDayStart, workDayEnd, defaultBreakStart, defaultBreakEnd,
               theme, lastBackupAt, backupReminderDays }
```

### File Structure
```
src/
  types/index.ts              — all TypeScript interfaces and type aliases
  data/mockData.ts            — seed data (bulkAdded on first app load if DB is empty)
  components/
    layout/
      TopNav.tsx              — top navigation bar
      Sidebar.tsx             — left sidebar: categories → projects, inline add category/project
      SidePanel.tsx           — right sliding detail panel with Mark Complete button
      BackupPromptModal.tsx   — backup reminder modal (shown on load when overdue)
    tasks/
      TaskCard.tsx            — task card: quick-complete circle, subtask checkboxes, restore button
      SubtaskItem.tsx         — individual subtask checkbox row
  views/
    ExploreView.tsx           — main task browsing: active tasks + collapsible completed archive
    CurrentlyWorkingView.tsx  — tasks with status=currently_working
    MorningMeetingView.tsx    — tasks with status=morning_meeting
  db/
    database.ts               — AppDatabase (Dexie) class + db singleton + settings seed on populate
    crud.ts                   — all CRUD: Category, Project, Task, Subtask, CalendarBlock, Settings
    backup.ts                 — exportDB, importDB, shouldPromptBackup
    index.ts                  — re-exports all db exports
    database.test.ts          — 43 unit tests covering all CRUD + backup round-trip
  utils/
    tasks.ts                  — sortTasks, getDueDateStatus, flagOrder, STATUS_ORDER
    tasks.test.ts             — 11 unit tests for sort and due date logic
  App.tsx                     — root: live queries, seeder, all handlers
  index.css                   — Tailwind import + dark variant config
```

### State (App.tsx)
- `view: AppView` — which view is active
- `theme: Theme` — light/dark, loaded from DB settings on mount, persisted on toggle
- `selectedCategoryId / selectedProjectId` — sidebar filter state
- `expandedCategories: Set<number>` — sidebar expand/collapse state (first category auto-expanded)
- `selectedTaskId` — which task's side panel is open
- `sortBy: SortBy` — explore view sort order
- `showBackupPrompt` — whether backup reminder modal is visible
- Live queries: `categories`, `projects`, `tasks` (incomplete only), `completedTasks`, `subtasks`

### Key Behaviours
- **Subtask completion is independent of task completion** — completing all subtasks does NOT auto-complete the task. Intentional decision.
- Task status (`currently_working`, `morning_meeting`) is a tag — task appears in BOTH its project view and the special view
- Completing a task sets `completed=true`, `completedAt=now`, `status='normal'` — auto-removes from Currently Working / Morning Meeting
- Completed tasks are archived in the same DB table, visible in the Explore view via a collapsible "Completed Tasks (N)" section at the bottom, sorted by completedAt DESC
- Completed tasks can be restored to active via "Restore to active" button on the card
- Quick-complete circle on each active task card — tap to complete without opening the side panel
- Sort bar in Explore view is sticky (won't scroll away on iOS Safari)
- Mock data seeded into DB on first app load (when categories table is empty) — not re-seeded after that
- Backup prompt shown on app load when `now − lastBackupAt > backupReminderDays`; null lastBackupAt also triggers prompt

### Build Phases

**Current phase: 5 — Top nav special views (next)**
**Plan file:** `C:\Users\pprak\.claude\plans\staged-shimmying-wadler.md`

| # | Phase | Status |
|---|---|---|
| 1 | Static app shell (mock data, all UI components) | ✅ Complete |
| 2 | Data layer — Dexie.js schema, CRUD, tests, backup/restore | ✅ Complete |
| 3 | Wire explore view to real DB | ✅ Complete |
| 4 | Task CRUD — create/edit/delete at all levels | ✅ Complete |
| 5 | Top nav special views — Currently Working, Morning Meeting, Search | ⬜ |
| 6 | Calendar UI (static) | ⬜ |
| 7 | Wire calendar to DB | ⬜ |
| 8 | Statistics page | ⬜ |
| 9 | PDF report | ⬜ |
| 10 | Settings + backup UI | ⬜ |
| 11 | Polish — error states, loading states, edge cases | ⬜ |

### Phase 4 — What's done vs remaining

**Done (shipped, pushed to master):**
- [x] Add category — inline input in sidebar, auto-expands on create
- [x] Add project — inline input inside expanded category
- [x] Quick-complete task — circle button on card, no panel needed
- [x] Restore completed task — "Restore to active" button in completed archive
- [x] Completed archive section in Explore view (collapsible, sorted newest-first)
- [x] Edit / delete category from sidebar (dots menu → rename / delete with inline confirm)
- [x] Edit / delete project from sidebar (dots menu → rename / delete with inline confirm)
- [x] Move task to "Currently Working" / "Morning Meeting" — tap-to-cycle status badge on card + panel

**Done (local, not yet pushed):**
- [x] "Create New Task" button → opens side panel form (title, due date, work type, flag, category, project)
- [x] Side panel edit mode — prefills form, saves on submit
- [x] Delete task with inline confirmation in side panel
- [x] Add subtask via "+" input in side panel (title only; due date optional, not exposed in UI)
- [x] Edit subtask inline in side panel (hover → pencil icon → edit in place)
- [x] Delete subtask in side panel (hover → trash icon, immediate)
- [x] Tests for task status transitions (8 new tests, 62 total)

**Remaining:**
- [ ] Touch-friendly side panel: full-height on narrow viewports, scrollable (deferred to Phase 11)

**Update the current phase and table at the end of every session.**
