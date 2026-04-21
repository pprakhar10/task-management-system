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
  data/mockData.ts            — Phase 1 static mock data (replaced by DB in Phase 3)
  components/
    layout/
      TopNav.tsx              — top navigation bar
      Sidebar.tsx             — left sidebar (categories → projects)
      SidePanel.tsx           — right sliding detail panel
    tasks/
      TaskCard.tsx            — task card with subtasks
      SubtaskItem.tsx         — individual subtask checkbox row
  views/
    ExploreView.tsx           — main task browsing view
    CurrentlyWorkingView.tsx  — tasks with status=currently_working
    MorningMeetingView.tsx    — tasks with status=morning_meeting
  App.tsx                     — root: state, view switching, theme, sort logic
  index.css                   — Tailwind import + dark variant config
```

### State (App.tsx)
- `view: AppView` — which view is active
- `theme: Theme` — light/dark, applied as class on `<html>`
- `selectedCategoryId / selectedProjectId` — sidebar filter state
- `expandedCategories: Set<number>` — sidebar expand/collapse state
- `selectedTaskId` — which task's side panel is open
- `sortBy: SortBy` — explore view sort order

### Key Behaviours
- Task status (`currently_working`, `morning_meeting`) is a tag — task appears in BOTH its project view and the special view
- Completing a task auto-removes it from Currently Working / Morning Meeting
- Calendar blocks override the default active break window (13:00–14:15)
- All calendar time snaps to 15-min intervals
- Unutilized time = work window (settings) minus all calendar blocks for that period

### Build Phases
1. ✅ Static app shell (mock data, all UI components)
2. Data layer — Dexie.js schema, CRUD, tests, backup/restore
3. Wire explore view to real DB
4. Task CRUD — create/edit/delete at all levels
5. Top nav special views — Currently Working, Morning Meeting, Search
6. Calendar UI (static)
7. Wire calendar to DB
8. Statistics page
9. PDF report
10. Settings + backup UI
11. Polish — error states, loading states, edge cases
```
