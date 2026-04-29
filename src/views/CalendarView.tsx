import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { CalendarBlock, Category, Project, Task, WorkType } from '../types';
import { db } from '../db/database';
import { createCalendarBlock, updateCalendarBlock, deleteCalendarBlock } from '../db/crud';
import { snapToSlot } from '../utils/calendar';

// ── Constants ────────────────────────────────────────────────────────────────

const SLOT_HEIGHT = 20; // px per 15-min interval
const GRID_START_MIN = 0;
const GRID_END_MIN = 24 * 60;
const TOTAL_SLOTS = (GRID_END_MIN - GRID_START_MIN) / 15; // 96
const TOTAL_HEIGHT = TOTAL_SLOTS * SLOT_HEIGHT; // 1920px
const GRID_TOP_PADDING = 8;

const BREAK_START_DEFAULT = '13:00';
const BREAK_END_DEFAULT = '14:15';
const WORK_START_DEFAULT = '09:15';
const WORK_END_DEFAULT = '18:00';

const WORK_TYPE_LABELS: Record<WorkType, string> = {
  deep: 'Deep Work',
  shallow: 'Shallow Work',
  active_break: 'Active Break',
  email: 'Email',
  meeting: 'Meeting',
};

const BLOCK_COLORS: Record<WorkType, string> = {
  deep: 'bg-indigo-500 border-l-2 border-indigo-700 text-white',
  shallow: 'bg-emerald-500 border-l-2 border-emerald-700 text-white',
  active_break: 'bg-amber-300 border-l-2 border-amber-500 text-amber-900',
  email: 'bg-sky-400 border-l-2 border-sky-600 text-white',
  meeting: 'bg-rose-400 border-l-2 border-rose-600 text-white',
};

// No category/project/task association
const NO_ASSOC_WORK_TYPES = new Set<WorkType>(['active_break']);
// Category + project association only — no task
const PROJECT_ONLY_WORK_TYPES = new Set<WorkType>(['email', 'meeting']);

// Active-state button colour for each no-task type in the dialog
const SPECIAL_TYPE_BTN_ACTIVE: Record<string, string> = {
  active_break: 'bg-amber-500 border-amber-500 text-white',
  email: 'bg-sky-500 border-sky-500 text-white',
  meeting: 'bg-rose-500 border-rose-500 text-white',
};

const HOUR_MARKS = Array.from({ length: 24 }, (_, i) => i);

// ── Utilities ────────────────────────────────────────────────────────────────

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(min: number): string {
  return `${Math.floor(min / 60).toString().padStart(2, '0')}:${(min % 60).toString().padStart(2, '0')}`;
}

function timeToY(time: string): number {
  return ((timeToMinutes(time) - GRID_START_MIN) / 15) * SLOT_HEIGHT;
}

function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}

function formatHour(h: number): string {
  if (h === 0) return '12am';
  if (h === 12) return '12pm';
  return h < 12 ? `${h}am` : `${h - 12}pm`;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function getWeekDays(weekOffset: number): { date: string; dayName: string; dayNum: number; month: string; year: number }[] {
  const today = new Date();
  const dow = today.getDay(); // 0=Sun
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(today);
  monday.setDate(today.getDate() + mondayOffset + weekOffset * 7);
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return {
      date: formatLocalDate(d),
      dayName: dayNames[i],
      dayNum: d.getDate(),
      month: MONTH_NAMES[d.getMonth()],
      year: d.getFullYear(),
    };
  });
}

function formatWeekLabel(days: ReturnType<typeof getWeekDays>): string {
  const first = days[0];
  const last = days[4];
  if (first.year !== last.year) {
    return `${first.dayNum} ${first.month} ${first.year} – ${last.dayNum} ${last.month} ${last.year}`;
  }
  if (first.month !== last.month) {
    return `${first.dayNum} ${first.month} – ${last.dayNum} ${last.month} ${last.year}`;
  }
  return `${first.dayNum} – ${last.dayNum} ${first.month} ${first.year}`;
}

// ── Types ────────────────────────────────────────────────────────────────────

interface DialogState {
  mode: 'create' | 'edit';
  date: string;
  workType: WorkType;
  categoryId: number | null;
  projectId: number | null;
  taskId: number | null;
  startTime: string;
  endTime: string;
  blockId?: number;
}

// ── Style constants ──────────────────────────────────────────────────────────

const BTN_BASE = 'px-3 py-1.5 rounded-md text-sm font-medium transition-colors border';
const BTN_ON = 'bg-indigo-600 border-indigo-600 text-white';
const BTN_OFF =
  'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700';

// ── Block Dialog ─────────────────────────────────────────────────────────────

interface BlockDialogProps {
  state: DialogState;
  onClose: () => void;
  onChange: (changes: Partial<DialogState>) => void;
  onSave: () => void;
  onDelete?: () => void;
  onCreateTask: () => void;
  categories: Category[];
  projects: Project[];
  tasks: Task[];
  error?: string;
}

function BlockDialog({
  state,
  onClose,
  onChange,
  onSave,
  onDelete,
  onCreateTask,
  categories,
  projects,
  tasks,
  error,
}: BlockDialogProps) {
  function adjustTime(field: 'startTime' | 'endTime', delta: number) {
    const startMin = timeToMinutes(state.startTime);
    const endMin = timeToMinutes(state.endTime);
    if (field === 'startTime') {
      const next = Math.max(GRID_START_MIN, Math.min(endMin - 15, startMin + delta));
      onChange({ startTime: minutesToTime(snapToSlot(next)) });
    } else {
      const next = Math.max(startMin + 15, Math.min(GRID_END_MIN, endMin + delta));
      onChange({ endTime: minutesToTime(snapToSlot(next)) });
    }
  }

  function handleSpecialTypeToggle(wt: 'active_break' | 'email' | 'meeting') {
    if (state.workType === wt) {
      // Deselect — return to task-linked mode with first available task
      const firstCat = categories[0];
      const firstProj = firstCat ? projects.find(p => p.categoryId === firstCat.id) : null;
      const firstTask = firstProj ? tasks.find(t => t.projectId === firstProj.id) : null;
      onChange({
        workType: firstTask?.workType ?? 'deep',
        categoryId: firstCat?.id ?? null,
        projectId: firstProj?.id ?? null,
        taskId: firstTask?.id ?? null,
      });
    } else if (wt === 'active_break') {
      onChange({ workType: wt, categoryId: null, projectId: null, taskId: null });
    } else {
      // email or meeting — initialise with first available category + project, no task
      const firstCat = categories[0];
      const firstProj = firstCat ? projects.find(p => p.categoryId === firstCat.id) : null;
      onChange({
        workType: wt,
        categoryId: firstCat?.id ?? null,
        projectId: firstProj?.id ?? null,
        taskId: null,
      });
    }
  }

  function handleCategoryChange(catId: number) {
    const firstProj = projects.find(p => p.categoryId === catId);
    if (PROJECT_ONLY_WORK_TYPES.has(state.workType)) {
      onChange({ categoryId: catId, projectId: firstProj?.id ?? null, taskId: null });
      return;
    }
    const firstTask = firstProj ? tasks.find(t => t.projectId === firstProj.id) : null;
    onChange({
      categoryId: catId,
      projectId: firstProj?.id ?? null,
      taskId: firstTask?.id ?? null,
      workType: firstTask?.workType ?? state.workType,
    });
  }

  function handleProjectChange(projId: number) {
    if (PROJECT_ONLY_WORK_TYPES.has(state.workType)) {
      onChange({ projectId: projId, taskId: null });
      return;
    }
    const firstTask = tasks.find(t => t.projectId === projId);
    onChange({
      projectId: projId,
      taskId: firstTask?.id ?? null,
      workType: firstTask?.workType ?? state.workType,
    });
  }

  const filteredProjects = projects.filter(p => p.categoryId === state.categoryId);
  const filteredTasks = tasks.filter(t => t.projectId === state.projectId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <h2 className="font-semibold text-sm text-gray-900 dark:text-gray-100">
            {state.mode === 'create' ? 'Schedule Block' : 'Edit Block'}
          </h2>
          <button
            onClick={onClose}
            className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Non-task work types: Active Break, Email, Meeting */}
          <div className="flex flex-wrap gap-2">
            {(['active_break', 'email', 'meeting'] as const).map(wt => (
              <button
                key={wt}
                onClick={() => handleSpecialTypeToggle(wt)}
                className={`${BTN_BASE} ${
                  state.workType === wt ? SPECIAL_TYPE_BTN_ACTIVE[wt] : BTN_OFF
                }`}
              >
                {WORK_TYPE_LABELS[wt]}
              </button>
            ))}
          </div>

          {/* Category + Project selectors — shown for email/meeting and task-linked types */}
          {!NO_ASSOC_WORK_TYPES.has(state.workType) && (
            <>
              {/* Category */}
              {categories.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Category</p>
                  <div className="flex flex-wrap gap-2">
                    {categories.map(cat => (
                      <button
                        key={cat.id}
                        onClick={() => handleCategoryChange(cat.id)}
                        className={`${BTN_BASE} ${state.categoryId === cat.id ? BTN_ON : BTN_OFF}`}
                      >
                        {cat.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Project */}
              {filteredProjects.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Project</p>
                  <div className="flex flex-wrap gap-2">
                    {filteredProjects.map(proj => (
                      <button
                        key={proj.id}
                        onClick={() => handleProjectChange(proj.id)}
                        className={`${BTN_BASE} ${state.projectId === proj.id ? BTN_ON : BTN_OFF}`}
                      >
                        {proj.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Task — only for task-linked types (deep/shallow), not email/meeting */}
              {!PROJECT_ONLY_WORK_TYPES.has(state.workType) && state.projectId !== null && (
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Task</p>
                  {filteredTasks.length > 0 ? (
                    <div className="flex flex-col gap-1.5">
                      {filteredTasks.map(task => (
                        <button
                          key={task.id}
                          onClick={() => onChange({ taskId: task.id, workType: task.workType })}
                          className={`text-left px-3 py-2 rounded-md text-sm border transition-colors ${
                            state.taskId === task.id ? BTN_ON : BTN_OFF
                          }`}
                        >
                          {task.title}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 dark:text-gray-500 py-1">
                      No active tasks in this project.
                    </p>
                  )}
                  <button
                    onClick={onCreateTask}
                    className="mt-2 text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    + Create New Task
                  </button>
                </div>
              )}
            </>
          )}

          {/* Time controls */}
          <div className="grid grid-cols-2 gap-4">
            {(['startTime', 'endTime'] as const).map(field => (
              <div key={field}>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                  {field === 'startTime' ? 'Start' : 'End'}
                </p>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => adjustTime(field, -15)}
                    className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors font-semibold text-base"
                  >
                    −
                  </button>
                  <span className="flex-1 text-center font-mono text-sm font-medium text-gray-900 dark:text-gray-100 tabular-nums">
                    {state[field]}
                  </span>
                  <button
                    onClick={() => adjustTime(field, +15)}
                    className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors font-semibold text-base"
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0 space-y-3">
          {error && (
            <p className="text-xs text-red-600 dark:text-red-400 font-medium">{error}</p>
          )}
          <div className="flex items-center gap-2">
          {onDelete && (
            <button
              onClick={onDelete}
              className="min-h-[36px] px-3 rounded-lg text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              Delete
            </button>
          )}
          <div className="ml-auto flex gap-2">
            <button
              onClick={onClose}
              className="min-h-[36px] px-4 rounded-lg text-sm font-medium border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onSave}
              className="min-h-[36px] px-4 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
            >
              Save
            </button>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── CalendarView ─────────────────────────────────────────────────────────────

interface CalendarViewProps {
  categories: Category[];
  projects: Project[];
  tasks: Task[];
  allTasks: Task[];
  onCreateTask: (preset?: { categoryId: number; projectId: number }) => void;
}

export function CalendarView({ categories, projects, tasks, allTasks, onCreateTask }: CalendarViewProps) {
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);

  const scrollRef = useRef<HTMLDivElement>(null);
  const pendingDialogRef = useRef<Omit<DialogState, 'taskId' | 'blockId'> | null>(null);
  const prevTaskIdsRef = useRef<Set<number> | null>(null);

  const settings = useLiveQuery(() => db.settings.toCollection().first(), []);
  const breakStart = settings?.defaultBreakStart ?? BREAK_START_DEFAULT;
  const breakEnd = settings?.defaultBreakEnd ?? BREAK_END_DEFAULT;
  const workStart = settings?.workDayStart ?? WORK_START_DEFAULT;
  const workEnd = settings?.workDayEnd ?? WORK_END_DEFAULT;
  const breakTopY = timeToY(breakStart);
  const breakHeight = timeToY(breakEnd) - breakTopY;
  const standupStart = settings?.standupStart ?? null;
  const standupEnd = settings?.standupEnd ?? null;
  const standupBand = standupStart && standupEnd
    ? { top: GRID_TOP_PADDING + timeToY(standupStart), height: timeToY(standupEnd) - timeToY(standupStart) }
    : null;

  const days = getWeekDays(weekOffset);
  const today = formatLocalDate(new Date());
  const isCurrentWeek = weekOffset === 0;

  // Live query: blocks for the current week
  const weekBlocks = useLiveQuery(
    () => db.calendarBlocks.where('date').between(days[0].date, days[4].date, true, true).toArray(),
    [days[0].date],
  ) ?? [];

  // Live query: leave days for the current week
  const weekLeaveDays = useLiveQuery(
    () => db.leaveDays.where('date').between(days[0].date, days[4].date, true, true).toArray(),
    [days[0].date],
  ) ?? [];
  const leaveDaySet = useMemo(() => new Set(weekLeaveDays.map(l => l.date)), [weekLeaveDays]);

  // Lookup maps
  const taskMap = useMemo(() => new Map(allTasks.map(t => [t.id, t])), [allTasks]);
  const projectMap = useMemo(() => new Map(projects.map(p => [p.id, p])), [projects]);

  // Current time indicator — updates every minute
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const showCurrentTime = nowMin >= GRID_START_MIN && nowMin <= GRID_END_MIN;
  const currentTimeY = ((nowMin - GRID_START_MIN) / 15) * SLOT_HEIGHT;

  // Scroll to current time on mount
  useEffect(() => {
    if (scrollRef.current) {
      const target = showCurrentTime ? Math.max(0, currentTimeY - 120) : 0;
      scrollRef.current.scrollTop = target;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-open scheduling dialog when a task is created via "+ Create New Task"
  useEffect(() => {
    const currentIds = new Set(tasks.map(t => t.id));
    if (prevTaskIdsRef.current === null) {
      prevTaskIdsRef.current = currentIds;
      return;
    }
    if (pendingDialogRef.current) {
      const newTasks = tasks.filter(t => !prevTaskIdsRef.current!.has(t.id));
      if (newTasks.length > 0) {
        const pending = pendingDialogRef.current;
        const match =
          newTasks
            .filter(t => pending.projectId === null || t.projectId === pending.projectId)
            .sort((a, b) => b.createdAt - a.createdAt)[0] ??
          newTasks[newTasks.length - 1];
        setDialog({ ...pending, taskId: match.id });
        pendingDialogRef.current = null;
      }
    }
    prevTaskIdsRef.current = currentIds;
  }, [tasks]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  function getBlockLabel(block: CalendarBlock): string {
    if (block.taskId != null) return taskMap.get(block.taskId)?.title ?? 'Unknown Task';
    if (block.projectId != null && PROJECT_ONLY_WORK_TYPES.has(block.workType)) {
      const projName = projectMap.get(block.projectId)?.name;
      return projName
        ? `${WORK_TYPE_LABELS[block.workType]} [${projName}]`
        : WORK_TYPE_LABELS[block.workType];
    }
    return WORK_TYPE_LABELS[block.workType];
  }

  // ── Dialog actions ────────────────────────────────────────────────────────

  function openCreate(date: string, startTime: string) {
    const startMin = timeToMinutes(startTime);
    const endMin = Math.min(GRID_END_MIN, startMin + 30);
    const firstCat = categories[0];
    const firstProj = firstCat ? projects.find(p => p.categoryId === firstCat.id) : null;
    const firstTask = firstProj ? tasks.find(t => t.projectId === firstProj.id) : null;
    setDialog({
      mode: 'create',
      date,
      workType: firstTask?.workType ?? 'deep',
      categoryId: firstCat?.id ?? null,
      projectId: firstProj?.id ?? null,
      taskId: firstTask?.id ?? null,
      startTime,
      endTime: minutesToTime(endMin),
    });
  }

  function openEdit(block: CalendarBlock) {
    const task = block.taskId != null ? taskMap.get(block.taskId) : null;
    const proj = task
      ? projectMap.get(task.projectId)
      : block.projectId != null
      ? projectMap.get(block.projectId)
      : null;
    const cat = proj ? categories.find(c => c.id === proj.categoryId) : null;
    setDialog({
      mode: 'edit',
      date: block.date,
      workType: block.workType,
      categoryId: cat?.id ?? null,
      projectId: proj?.id ?? null,
      taskId: block.taskId,
      startTime: block.startTime,
      endTime: block.endTime,
      blockId: block.id,
    });
  }

  async function handleDialogSave() {
    if (!dialog) return;
    const newStart = timeToMinutes(dialog.startTime);
    const newEnd = timeToMinutes(dialog.endTime);
    const conflict = weekBlocks.find(b => {
      if (b.date !== dialog.date) return false;
      if (dialog.mode === 'edit' && b.id === dialog.blockId) return false;
      return newStart < timeToMinutes(b.endTime) && timeToMinutes(b.startTime) < newEnd;
    });
    if (conflict) {
      setDialogError(`Overlaps with existing block (${conflict.startTime}–${conflict.endTime})`);
      return;
    }
    const isProjectOnly = PROJECT_ONLY_WORK_TYPES.has(dialog.workType);
    const blockData = {
      taskId: isProjectOnly || NO_ASSOC_WORK_TYPES.has(dialog.workType) ? null : (dialog.taskId ?? null),
      projectId: isProjectOnly ? (dialog.projectId ?? null) : null,
      workType: dialog.workType,
      date: dialog.date,
      startTime: dialog.startTime,
      endTime: dialog.endTime,
    };
    if (dialog.mode === 'create') {
      await createCalendarBlock(blockData);
    } else if (dialog.blockId !== undefined) {
      await updateCalendarBlock(dialog.blockId, blockData);
    }
    setDialog(null);
  }

  async function handleDialogDelete() {
    if (dialog?.blockId === undefined) return;
    await deleteCalendarBlock(dialog.blockId);
    setDialog(null);
  }

  function handleCreateNewTask() {
    if (!dialog) return;
    pendingDialogRef.current = {
      mode: 'create',
      date: dialog.date,
      workType: dialog.workType,
      categoryId: dialog.categoryId,
      projectId: dialog.projectId,
      startTime: dialog.startTime,
      endTime: dialog.endTime,
    };
    setDialog(null);
    onCreateTask(
      dialog.categoryId !== null && dialog.projectId !== null
        ? { categoryId: dialog.categoryId, projectId: dialog.projectId }
        : undefined,
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <div ref={scrollRef} className="flex-1 overflow-auto">
        <div style={{ minWidth: '600px' }}>
          {/* Sticky header — week nav + day labels */}
          <div className="sticky top-0 z-20 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
            {/* Week navigation bar */}
            <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 dark:border-gray-800">
              <button
                onClick={() => setWeekOffset(w => w - 1)}
                className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                aria-label="Previous week"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="flex-1 text-center text-sm font-medium text-gray-700 dark:text-gray-300 tabular-nums">
                {formatWeekLabel(days)}
              </span>
              <button
                onClick={() => setWeekOffset(w => w + 1)}
                className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                aria-label="Next week"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
              {!isCurrentWeek && (
                <button
                  onClick={() => setWeekOffset(0)}
                  className="min-h-[32px] px-3 rounded-lg text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 transition-colors"
                >
                  Today
                </button>
              )}
            </div>

            {/* Day labels */}
            <div className="flex">
              <div className="w-14 flex-shrink-0 border-r border-gray-200 dark:border-gray-700" />
              {days.map(day => {
                const isToday = day.date === today;
                const isLeave = leaveDaySet.has(day.date);
                return (
                  <div
                    key={day.date}
                    className={`flex-1 py-2 text-center border-l border-gray-200 dark:border-gray-700 ${
                      isLeave
                        ? 'bg-gray-100 dark:bg-gray-800/60'
                        : isToday
                        ? 'bg-indigo-50 dark:bg-indigo-900/20'
                        : ''
                    }`}
                  >
                    <div
                      className={`text-xs font-medium ${
                        isLeave
                          ? 'text-gray-400 dark:text-gray-500'
                          : isToday
                          ? 'text-indigo-600 dark:text-indigo-400'
                          : 'text-gray-500 dark:text-gray-400'
                      }`}
                    >
                      {day.dayName}
                    </div>
                    <div
                      className={`text-sm font-semibold ${
                        isLeave
                          ? 'text-gray-400 dark:text-gray-500'
                          : isToday
                          ? 'text-indigo-700 dark:text-indigo-300'
                          : 'text-gray-900 dark:text-gray-100'
                      }`}
                    >
                      {day.dayNum}
                    </div>
                    {isLeave && (
                      <div className="text-[10px] font-medium text-gray-400 dark:text-gray-500 leading-tight">
                        Leave
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Time grid */}
          <div className="flex" style={{ height: TOTAL_HEIGHT + GRID_TOP_PADDING }}>
            {/* Time label column */}
            <div className="w-14 flex-shrink-0 relative border-r border-gray-200 dark:border-gray-700">
              {HOUR_MARKS.map(h => (
                <div
                  key={h}
                  className="absolute right-2 text-[10px] text-gray-400 dark:text-gray-500 tabular-nums leading-none select-none"
                  style={{ top: GRID_TOP_PADDING + ((h * 60 - GRID_START_MIN) / 15) * SLOT_HEIGHT - 5 }}
                >
                  {formatHour(h)}
                </div>
              ))}
            </div>

            {/* Day columns */}
            {days.map(day => {
              const isToday = day.date === today;
              const isLeave = leaveDaySet.has(day.date);
              const blocksForDay = weekBlocks.filter(b => b.date === day.date);

              return (
                <div
                  key={day.date}
                  className={`flex-1 relative border-l border-gray-200 dark:border-gray-700 ${
                    isLeave
                      ? 'bg-gray-50/60 dark:bg-gray-800/30'
                      : isToday
                      ? 'bg-indigo-50/20 dark:bg-indigo-900/5'
                      : ''
                  }`}
                >
                  {/* Grid lines — hour / half-hour / 15-min tiers */}
                  {Array.from({ length: TOTAL_SLOTS }, (_, slot) => {
                    const minFromStart = slot * 15;
                    const isHour = minFromStart % 60 === 0;
                    const isHalf = minFromStart % 30 === 0 && !isHour;
                    return (
                      <div
                        key={slot}
                        className={`absolute left-0 right-0 border-t ${
                          isHour
                            ? 'border-gray-200 dark:border-gray-700'
                            : isHalf
                            ? 'border-gray-100 dark:border-gray-800'
                            : 'border-gray-100/60 dark:border-gray-800/40'
                        }`}
                        style={{ top: GRID_TOP_PADDING + slot * SLOT_HEIGHT }}
                      />
                    );
                  })}

                  {/* Active break band */}
                  <div
                    className="absolute left-0 right-0 bg-amber-50 dark:bg-amber-700/20 pointer-events-none"
                    style={{ top: GRID_TOP_PADDING + breakTopY, height: breakHeight }}
                  />

                  {/* Morning meeting band */}
                  {standupBand && (
                    <div
                      className="absolute left-0 right-0 bg-amber-50 dark:bg-amber-700/20 pointer-events-none"
                      style={{ top: standupBand.top, height: standupBand.height }}
                    />
                  )}

                  {/* Clickable 15-min slots */}
                  {Array.from({ length: TOTAL_SLOTS }, (_, slot) => (
                    <div
                      key={slot}
                      className="absolute left-0 right-0 cursor-pointer hover:bg-indigo-50/60 dark:hover:bg-indigo-900/15 transition-colors"
                      style={{ top: GRID_TOP_PADDING + slot * SLOT_HEIGHT, height: SLOT_HEIGHT }}
                      onClick={() => openCreate(day.date, minutesToTime(GRID_START_MIN + slot * 15))}
                    />
                  ))}

                  {/* Calendar blocks */}
                  {blocksForDay.map(block => {
                    const topY = GRID_TOP_PADDING + timeToY(block.startTime);
                    const blockHeight = timeToY(block.endTime) - timeToY(block.startTime);
                    const label = getBlockLabel(block);
                    const isOutsideHours = block.endTime <= workStart || block.startTime >= workEnd;
                    return (
                      <div
                        key={block.id}
                        onClick={e => { e.stopPropagation(); openEdit(block); }}
                        className={`absolute left-0.5 right-0.5 rounded overflow-hidden cursor-pointer z-10 ${BLOCK_COLORS[block.workType]}${isOutsideHours ? ' opacity-50 grayscale' : ''}`}
                        style={{ top: topY + 1, height: blockHeight - 2 }}
                      >
                        <div className="px-1.5 py-0.5">
                          <div className="text-[11px] font-medium leading-tight truncate">{label}</div>
                          {blockHeight >= 40 && (
                            <div className="text-[10px] opacity-70 leading-tight tabular-nums">
                              {block.startTime}–{block.endTime}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Current time indicator */}
                  {isToday && showCurrentTime && (
                    <div
                      className="absolute left-0 right-0 z-20 pointer-events-none flex items-center"
                      style={{ top: GRID_TOP_PADDING + currentTimeY }}
                    >
                      <div className="w-2 h-2 rounded-full bg-red-500 -ml-1 flex-shrink-0" />
                      <div className="flex-1 border-t-2 border-red-500" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Scheduling / edit dialog */}
      {dialog && (
        <BlockDialog
          state={dialog}
          onClose={() => { setDialog(null); setDialogError(null); }}
          onChange={changes => { setDialogError(null); setDialog(prev => (prev ? { ...prev, ...changes } : prev)); }}
          onSave={handleDialogSave}
          onDelete={dialog.mode === 'edit' ? handleDialogDelete : undefined}
          onCreateTask={handleCreateNewTask}
          categories={categories}
          projects={projects}
          tasks={tasks}
          error={dialogError ?? undefined}
        />
      )}
    </div>
  );
}
