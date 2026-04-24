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

## Verification Rule

**Always push to Vercel for UI verification.** Do not ask the user to check `localhost`. After every phase or visual change, push to `master` and give the Vercel URL. The user verifies on Vercel, not the dev server.

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
    CurrentlyWorkingView.tsx  — tasks with status=currently_working (morning_meeting included), sorted by dueDate
    MorningMeetingView.tsx    — tasks with status=morning_meeting, sorted by dueDate
    SearchView.tsx            — search + filter view: text query, status/workType/flag/category/project filters
    CalendarView.tsx          — full 24-hour week calendar; week nav; scheduling dialog wired to DB; tap block to edit/delete
    StatisticsView.tsx        — time analytics: period filter, summary cards, stacked bar, category/project/task breakdowns
    SettingsView.tsx          — work hours, time exclusions, backup export/restore
  db/
    database.ts               — AppDatabase (Dexie) class + db singleton + settings seed on populate
    crud.ts                   — all CRUD: Category, Project, Task, Subtask, CalendarBlock, Settings
    backup.ts                 — exportDB, importDB, shouldPromptBackup
    index.ts                  — re-exports all db exports
    database.test.ts          — 43 unit tests covering all CRUD + backup round-trip
  utils/
    tasks.ts                  — sortTasks, getDueDateStatus, flagOrder, STATUS_ORDER
    tasks.test.ts             — 11 unit tests for sort and due date logic
    search.ts                 — filterTasks, SearchFilters, DEFAULT_FILTERS, CompletedFilter
    search.test.ts            — 13 unit tests for all filter types and combinations
    calendar.ts               — snapToSlot, isBlockInBreakBand, calcBlockMove (pure utilities)
    calendar.test.ts          — 25 unit tests for calendar utilities
    statistics.ts             — timeToMinutes, minutesToDisplay, blockDurationMinutes, workDayOverlapMinutes, weekdaysInRange, calcWorkTypeSummary, calcCategoryBreakdown, calcProjectBreakdown, calcTaskBreakdown
    pdf.ts                    — groupTasksForReport, filterCompletedInRange, generateWeeklyReport (jsPDF)
    statistics.test.ts        — 35 unit tests for all statistics functions
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
- `calendarCreatePreset` — pre-fills SidePanel category/project when "+ Create New Task" is clicked from calendar dialog
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
- Morning Meeting tasks appear in Both Morning Meeting view AND Currently Working view
- Category/project selection in create/edit form uses button-group selectors (same pattern as Work Type / Flag), not dropdowns — projects auto-populate when category is tapped
- Flag badge and Status badge are stacked vertically on the top-right of each task card
- Subtasks on task cards are fully editable inline (add/edit/delete) without opening side panel; edit/delete icons always visible (not hover-only) — touch-friendly
- Subtask edit/delete buttons in side panel are always visible (not hover-only)

### Build Phases

**Current phase: 11 — Polish (next)**
**Plan file:** `C:\Users\pprak\.claude\plans\staged-shimmying-wadler.md`

| # | Phase | Status |
|---|---|---|
| 1 | Static app shell (mock data, all UI components) | ✅ Complete |
| 2 | Data layer — Dexie.js schema, CRUD, tests, backup/restore | ✅ Complete |
| 3 | Wire explore view to real DB | ✅ Complete |
| 4 | Task CRUD — create/edit/delete at all levels | ✅ Complete |
| 5 | Top nav special views — Currently Working, Morning Meeting, Search | ✅ Complete |
| 6 | Calendar UI (static) | ✅ Complete |
| 7 | Wire calendar to DB | ✅ Complete |
| 8 | Statistics page | ✅ Complete |
| 9 | PDF report | ✅ Complete |
| 10 | Settings + backup UI | ✅ Complete |
| 11 | Polish — error states, loading states, edge cases | ⬜ |

### Phase 9 — Complete

- [x] Download Report icon button in TopNav (download arrow icon, always visible)
- [x] Two sections in order: Active Tasks → Completed This Week
- [x] Both sections grouped by Category → Project
- [x] Each task shows subtasks underneath; completed subtasks labelled [done] in grey, incomplete in dark
- [x] No internal fields shown (no flags, status, work type)
- [x] Completed this week = completedAt within Mon–Fri of current work week
- [x] Empty sections show "No tasks." message
- [x] Generated via jsPDF (A4 portrait, text API, helvetica font), triggers browser download
- [x] New: src/utils/pdf.ts — groupTasksForReport, filterCompletedInRange, generateWeeklyReport
- [x] New: src/utils/pdf.test.ts — 17 tests for pure functions (156 total)

### Phase 10 — Complete

- [x] Settings view accessible from gear icon in TopNav (highlights when active)
- [x] Work Hours section: editable workDayStart and workDayEnd (+/− 15-min steps), persisted to DB on each change
- [x] Time Exclusions section: editable standupStart/standupEnd and defaultBreakStart/defaultBreakEnd
- [x] All time changes immediately update Statistics (via existing useLiveQuery on settings) and Calendar break band
- [x] CalendarView break band now reads defaultBreakStart/defaultBreakEnd from DB settings (was hardcoded)
- [x] Backup section: last backup timestamp, backup reminder threshold (+/− 1 day, 1–365), Export + Restore buttons
- [x] Export: downloads full JSON snapshot, updates lastBackupAt
- [x] Restore: file picker (.json), confirm dialog, calls importDB, reloads page to reset all state
- [x] New file: src/views/SettingsView.tsx

**Note:** Calendar drag-to-move feature was removed (was unreliable on iPad). CalendarView is tap-only: tap block to edit/delete via dialog.

### Phase 8 — Complete

- [x] Statistics page accessible from top nav (Statistics button)
- [x] Period filter: This Week / This Month / Custom date range
- [x] Summary cards: Deep Work / Shallow Work / Active Break / Unutilized (hours + % of work window)
- [x] Stacked distribution bar: work window split by type, in-window minutes only
- [x] Category breakdown table with mini bars (deep + shallow split)
- [x] Project breakdown table with mini bars (category name + deep + shallow split)
- [x] Task breakdown table with mini bars (work type badge + project + time)
- [x] All derived from real CalendarBlocks via useLiveQuery; settings-aware (workDayStart/workDayEnd)
- [x] New src/utils/statistics.ts: timeToMinutes, minutesToDisplay, blockDurationMinutes, workDayOverlapMinutes, weekdaysInRange, calcWorkTypeSummary, calcCategoryBreakdown, calcProjectBreakdown, calcTaskBreakdown
- [x] 35 new tests — 135 total passing
- [x] Standup (09:15–09:45) and lunch break excluded from unutilized denominator via DailyExclusion[] in calcWorkTypeSummary — 4 more tests (139 total)
- [x] Settings type extended with standupStart/standupEnd; DB bumped to version 2 with upgrade migration
- [x] Calendar dialog blocks overlapping saves: overlap check in handleDialogSave, inline error shown in dialog footer

### Phase 7 — Complete

- [x] useLiveQuery for calendar blocks within displayed week (date-range indexed query)
- [x] Click empty slot → dialog creates real CalendarBlock in DB
- [x] Tap existing block → edit dialog updates real CalendarBlock in DB
- [x] Delete block from edit dialog
- [x] Cascading category → project → task selectors populated from real DB
- [x] All time entry snaps to 15-min intervals via snapToSlot utility
- [x] Long press (500ms) on block enters drag mode; drop commits updated date/time to DB
- [x] Drop indicator rendered at snapped 15-min target position during drag
- [x] Touchmove scroll prevented on container during active drag (non-passive listener)
- [x] Block tap vs long-press distinguished: tap opens edit dialog, long press starts drag
- [x] "+ Create New Task" in dialog: stores pending state, opens SidePanel; dialog re-opens with new task pre-selected after creation
- [x] calendarCreatePreset in App.tsx pre-fills SidePanel from calendar without changing Explore sidebar selection
- [x] Active break band override: deep/shallow blocks render on top of amber band (z-10)
- [x] New src/utils/calendar.ts: snapToSlot, isBlockInBreakBand, calcBlockMove (pure, exported)
- [x] 25 new tests — 100 total passing

### Phase 6 — Complete

- [x] Calendar grid: full 24-hour day, Mon–Fri columns, 15-min row height with visible grid lines
- [x] Week navigation: prev/next arrows, week date range label, Today button when off current week
- [x] Mock calendar blocks rendered in indigo (deep) / emerald (shallow) with time labels
- [x] Active break band 13:00–14:15 rendered as amber background across all columns
- [x] Current time indicator: red dot + line on today's column
- [x] Click empty slot → scheduling dialog (work type, category/project/task selectors, time +/− controls)
- [x] Click existing block → edit dialog pre-filled (includes Delete button placeholder)
- [x] + Create New Task in dialog → closes dialog, opens SidePanel create form
- [x] Explore view: "+ Add Task" button in sort bar when a project is selected, pre-fills category/project in SidePanel

### Phase 5 — Complete

- [x] Currently Working view: live query, sorted by dueDate (morning meeting tasks included)
- [x] Morning Meeting view: live query, sorted by dueDate
- [x] Search view: text search + 5 filter types (status, work type, flag, category, project)
- [x] Category→project drill-down in search filters (projects appear when category selected)
- [x] Search shows active + completed tasks; completed cards show restore, active cards show full controls
- [x] Clicking any task in search opens side panel (selectedTask lookup fixed to cover completed tasks)
- [x] Search button in TopNav highlights when search view is active
- [x] 13 new tests for filterTasks logic (75 total)

### Phase 4 — Complete (all shipped to master)

- [x] Add category — inline input in sidebar, auto-expands on create
- [x] Add project — inline input inside expanded category
- [x] Quick-complete task — circle button on card, no panel needed
- [x] Restore completed task — "Restore to active" button in completed archive
- [x] Completed archive section in Explore view (collapsible, sorted newest-first)
- [x] Edit / delete category from sidebar (dots menu → rename / delete with inline confirm)
- [x] Edit / delete project from sidebar (dots menu → rename / delete with inline confirm)
- [x] Move task to "Currently Working" / "Morning Meeting" — tap-to-cycle status badge on card + panel
- [x] "Create New Task" button → opens side panel form (title, due date, work type, flag, category, project)
- [x] Side panel edit mode — prefills form, saves on submit
- [x] Delete task with inline confirmation in side panel
- [x] Add / edit / delete subtask inline on task card (no side panel needed)
- [x] Add / edit / delete subtask in side panel (always-visible icons, touch-friendly)
- [x] Tests for task status transitions (8 new tests, 62 total)
- [ ] Touch-friendly side panel: full-height on narrow viewports, scrollable (deferred to Phase 11)

**Update the current phase and table at the end of every session.**
