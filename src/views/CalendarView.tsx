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
const LONG_PRESS_DELAY = 500; // ms

const BREAK_START = '13:00';
const BREAK_END = '14:15';

const WORK_TYPE_LABELS: Record<WorkType, string> = {
  deep: 'Deep Work',
  shallow: 'Shallow Work',
  active_break: 'Active Break',
};

const BLOCK_COLORS: Record<WorkType, string> = {
  deep: 'bg-indigo-500 border-l-2 border-indigo-700 text-white',
  shallow: 'bg-emerald-500 border-l-2 border-emerald-700 text-white',
  active_break: 'bg-amber-300 border-l-2 border-amber-500 text-amber-900',
};

const BLOCK_DROP_COLORS: Record<WorkType, string> = {
  deep: 'border-indigo-500 bg-indigo-100/50 dark:bg-indigo-900/30',
  shallow: 'border-emerald-500 bg-emerald-100/50 dark:bg-emerald-900/30',
  active_break: 'border-amber-500 bg-amber-100/50 dark:bg-amber-900/30',
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

const BREAK_TOP_Y = timeToY(BREAK_START);
const BREAK_HEIGHT = timeToY(BREAK_END) - BREAK_TOP_Y;

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

interface DropTarget {
  blockId: number;
  workType: WorkType;
  date: string;
  startMin: number;
  endMin: number;
}

interface DragInfo {
  block: CalendarBlock;
  columnRects: { date: string; left: number; right: number }[];
  gridTopViewport: number;
  scrollTopAtStart: number;
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

  function handleWorkTypeChange(wt: WorkType) {
    if (wt === 'active_break') {
      onChange({ workType: wt, categoryId: null, projectId: null, taskId: null });
    } else if (state.workType === 'active_break') {
      const firstCat = categories[0];
      const firstProj = firstCat ? projects.find(p => p.categoryId === firstCat.id) : null;
      const firstTask = firstProj ? tasks.find(t => t.projectId === firstProj.id) : null;
      onChange({
        workType: wt,
        categoryId: firstCat?.id ?? null,
        projectId: firstProj?.id ?? null,
        taskId: firstTask?.id ?? null,
      });
    } else {
      onChange({ workType: wt });
    }
  }

  function handleCategoryChange(catId: number) {
    const firstProj = projects.find(p => p.categoryId === catId);
    const firstTask = firstProj ? tasks.find(t => t.projectId === firstProj.id) : null;
    onChange({ categoryId: catId, projectId: firstProj?.id ?? null, taskId: firstTask?.id ?? null });
  }

  function handleProjectChange(projId: number) {
    const firstTask = tasks.find(t => t.projectId === projId);
    onChange({ projectId: projId, taskId: firstTask?.id ?? null });
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
          {/* Work Type */}
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Work Type</p>
            <div className="flex flex-wrap gap-2">
              {(['deep', 'shallow', 'active_break'] as WorkType[]).map(wt => (
                <button
                  key={wt}
                  onClick={() => handleWorkTypeChange(wt)}
                  className={`${BTN_BASE} ${state.workType === wt ? BTN_ON : BTN_OFF}`}
                >
                  {WORK_TYPE_LABELS[wt]}
                </button>
              ))}
            </div>
          </div>

          {/* Task selectors — deep/shallow only */}
          {state.workType !== 'active_break' && (
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

              {/* Task */}
              {state.projectId !== null && (
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Task</p>
                  {filteredTasks.length > 0 ? (
                    <div className="flex flex-col gap-1.5">
                      {filteredTasks.map(task => (
                        <button
                          key={task.id}
                          onClick={() => onChange({ taskId: task.id })}
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
        <div className="px-5 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center gap-2 flex-shrink-0">
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
  );
}

// ── CalendarView ─────────────────────────────────────────────────────────────

interface CalendarViewProps {
  categories: Category[];
  projects: Project[];
  tasks: Task[];
  onCreateTask: (preset?: { categoryId: number; projectId: number }) => void;
}

export function CalendarView({ categories, projects, tasks, onCreateTask }: CalendarViewProps) {
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [draggingBlockId, setDraggingBlockId] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const dayColumnRefs = useRef<(HTMLDivElement | null)[]>([null, null, null, null, null]);
  const isDraggingRef = useRef(false);
  const dragInfoRef = useRef<DragInfo | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blockBeingPressedRef = useRef<CalendarBlock | null>(null);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  // Stores pending dialog state when "Create New Task" is clicked mid-schedule
  const pendingDialogRef = useRef<Omit<DialogState, 'taskId' | 'blockId'> | null>(null);
  const prevTaskIdsRef = useRef<Set<number> | null>(null);

  const days = getWeekDays(weekOffset);
  const today = formatLocalDate(new Date());
  const isCurrentWeek = weekOffset === 0;

  // Live query: blocks for the current week
  const weekBlocks = useLiveQuery(
    () => db.calendarBlocks.where('date').between(days[0].date, days[4].date, true, true).toArray(),
    [days[0].date],
  ) ?? [];

  // Lookup maps
  const taskMap = useMemo(() => new Map(tasks.map(t => [t.id, t])), [tasks]);
  const projectMap = useMemo(() => new Map(projects.map(p => [p.id, p])), [projects]);

  // Current time indicator
  const now = new Date();
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

  // Prevent container scroll while dragging on touch devices
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    function onTouchMove(e: TouchEvent) {
      if (isDraggingRef.current) e.preventDefault();
    }
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => el.removeEventListener('touchmove', onTouchMove);
  }, []);

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
    if (block.workType === 'active_break') return 'Active Break';
    if (block.taskId == null) return WORK_TYPE_LABELS[block.workType];
    return taskMap.get(block.taskId)?.title ?? 'Unknown Task';
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
      workType: 'deep',
      categoryId: firstCat?.id ?? null,
      projectId: firstProj?.id ?? null,
      taskId: firstTask?.id ?? null,
      startTime,
      endTime: minutesToTime(endMin),
    });
  }

  function openEdit(block: CalendarBlock) {
    const task = block.taskId != null ? taskMap.get(block.taskId) : null;
    const proj = task ? projectMap.get(task.projectId) : null;
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
    const blockData = {
      taskId: dialog.workType === 'active_break' ? null : (dialog.taskId ?? null),
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

  // ── Drag handlers ─────────────────────────────────────────────────────────

  function cancelLongPress() {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }

  function endDrag() {
    isDraggingRef.current = false;
    dragInfoRef.current = null;
    setDraggingBlockId(null);
    setDropTarget(null);
  }

  function handleBlockPointerDown(e: React.PointerEvent, block: CalendarBlock) {
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    blockBeingPressedRef.current = block;
    pointerStartRef.current = { x: e.clientX, y: e.clientY };

    longPressTimerRef.current = setTimeout(() => {
      longPressTimerRef.current = null;
      const b = blockBeingPressedRef.current;
      if (!b) return;

      const columnRects = dayColumnRefs.current.map((ref, i) => {
        const r = ref?.getBoundingClientRect();
        return { date: days[i].date, left: r?.left ?? 0, right: r?.right ?? 0 };
      });
      const gridRect = gridRef.current?.getBoundingClientRect();

      dragInfoRef.current = {
        block: b,
        columnRects,
        gridTopViewport: gridRect?.top ?? 0,
        scrollTopAtStart: scrollRef.current?.scrollTop ?? 0,
      };
      isDraggingRef.current = true;
      setDraggingBlockId(b.id);
      setDropTarget({
        blockId: b.id!,
        workType: b.workType,
        date: b.date,
        startMin: timeToMinutes(b.startTime),
        endMin: timeToMinutes(b.endTime),
      });
    }, LONG_PRESS_DELAY);
  }

  function handleBlockPointerMove(e: React.PointerEvent) {
    if (longPressTimerRef.current && pointerStartRef.current) {
      const dx = Math.abs(e.clientX - pointerStartRef.current.x);
      const dy = Math.abs(e.clientY - pointerStartRef.current.y);
      if (dx > 10 || dy > 10) {
        cancelLongPress();
        blockBeingPressedRef.current = null;
      }
      return;
    }

    if (!isDraggingRef.current || !dragInfoRef.current) return;

    const { block, columnRects, gridTopViewport, scrollTopAtStart } = dragInfoRef.current;
    const duration = timeToMinutes(block.endTime) - timeToMinutes(block.startTime);

    const colIndex = columnRects.findIndex(c => e.clientX >= c.left && e.clientX <= c.right);
    const targetDate = colIndex >= 0 ? columnRects[colIndex].date : block.date;

    const yInGrid = e.clientY - gridTopViewport + scrollTopAtStart - GRID_TOP_PADDING;
    const slotIndex = Math.max(0, Math.min(TOTAL_SLOTS - 1, Math.floor(yInGrid / SLOT_HEIGHT)));
    const startMin = snapToSlot(GRID_START_MIN + slotIndex * 15);
    const endMin = Math.min(GRID_END_MIN, startMin + duration);

    setDropTarget({ blockId: block.id!, workType: block.workType, date: targetDate, startMin, endMin });
  }

  function handleBlockPointerUp() {
    const pressedBlock = blockBeingPressedRef.current;

    if (longPressTimerRef.current) {
      // Tap — open edit dialog
      cancelLongPress();
      blockBeingPressedRef.current = null;
      pointerStartRef.current = null;
      if (pressedBlock) openEdit(pressedBlock);
      return;
    }

    if (isDraggingRef.current && dragInfoRef.current && dropTarget) {
      const { block } = dragInfoRef.current;
      updateCalendarBlock(block.id!, {
        date: dropTarget.date,
        startTime: minutesToTime(dropTarget.startMin),
        endTime: minutesToTime(dropTarget.endMin),
      }).catch(console.error);
    }

    endDrag();
    blockBeingPressedRef.current = null;
    pointerStartRef.current = null;
  }

  function handleBlockPointerCancel() {
    cancelLongPress();
    endDrag();
    blockBeingPressedRef.current = null;
    pointerStartRef.current = null;
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
                return (
                  <div
                    key={day.date}
                    className={`flex-1 py-2 text-center border-l border-gray-200 dark:border-gray-700 ${
                      isToday ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''
                    }`}
                  >
                    <div
                      className={`text-xs font-medium ${
                        isToday ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-500 dark:text-gray-400'
                      }`}
                    >
                      {day.dayName}
                    </div>
                    <div
                      className={`text-sm font-semibold ${
                        isToday ? 'text-indigo-700 dark:text-indigo-300' : 'text-gray-900 dark:text-gray-100'
                      }`}
                    >
                      {day.dayNum}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Time grid */}
          <div ref={gridRef} className="flex" style={{ height: TOTAL_HEIGHT + GRID_TOP_PADDING }}>
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
            {days.map((day, colIdx) => {
              const isToday = day.date === today;
              const blocksForDay = weekBlocks.filter(b => b.date === day.date);

              return (
                <div
                  key={day.date}
                  ref={el => { dayColumnRefs.current[colIdx] = el; }}
                  className={`flex-1 relative border-l border-gray-200 dark:border-gray-700 ${
                    isToday ? 'bg-indigo-50/20 dark:bg-indigo-900/5' : ''
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
                    className="absolute left-0 right-0 bg-amber-50 dark:bg-amber-900/10 pointer-events-none"
                    style={{ top: GRID_TOP_PADDING + BREAK_TOP_Y, height: BREAK_HEIGHT }}
                  />

                  {/* Clickable 15-min slots */}
                  {Array.from({ length: TOTAL_SLOTS }, (_, slot) => (
                    <div
                      key={slot}
                      className="absolute left-0 right-0 cursor-pointer hover:bg-indigo-50/60 dark:hover:bg-indigo-900/15 transition-colors"
                      style={{ top: GRID_TOP_PADDING + slot * SLOT_HEIGHT, height: SLOT_HEIGHT }}
                      onClick={
                        draggingBlockId === null
                          ? () => openCreate(day.date, minutesToTime(GRID_START_MIN + slot * 15))
                          : undefined
                      }
                    />
                  ))}

                  {/* Drop target indicator while dragging */}
                  {dropTarget && dropTarget.date === day.date && (
                    <div
                      className={`absolute left-0.5 right-0.5 rounded border-2 border-dashed ${BLOCK_DROP_COLORS[dropTarget.workType]} pointer-events-none z-10`}
                      style={{
                        top: GRID_TOP_PADDING + timeToY(minutesToTime(dropTarget.startMin)) + 1,
                        height:
                          timeToY(minutesToTime(dropTarget.endMin)) -
                          timeToY(minutesToTime(dropTarget.startMin)) -
                          2,
                      }}
                    />
                  )}

                  {/* Calendar blocks */}
                  {blocksForDay.map(block => {
                    const topY = GRID_TOP_PADDING + timeToY(block.startTime);
                    const blockHeight = timeToY(block.endTime) - timeToY(block.startTime);
                    const label = getBlockLabel(block);
                    const isDragged = block.id === draggingBlockId;
                    return (
                      <div
                        key={block.id}
                        onPointerDown={e => handleBlockPointerDown(e, block)}
                        onPointerMove={handleBlockPointerMove}
                        onPointerUp={handleBlockPointerUp}
                        onPointerCancel={handleBlockPointerCancel}
                        className={`absolute left-0.5 right-0.5 rounded overflow-hidden cursor-pointer z-10 select-none touch-none ${BLOCK_COLORS[block.workType]} ${isDragged ? 'opacity-40' : ''}`}
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
          onClose={() => setDialog(null)}
          onChange={changes => setDialog(prev => (prev ? { ...prev, ...changes } : prev))}
          onSave={handleDialogSave}
          onDelete={dialog.mode === 'edit' ? handleDialogDelete : undefined}
          onCreateTask={handleCreateNewTask}
          categories={categories}
          projects={projects}
          tasks={tasks}
        />
      )}
    </div>
  );
}
