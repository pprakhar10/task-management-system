import { useEffect, useRef, useState } from 'react';
import type { WorkType } from '../types';

// ── Constants ───────────────────────────────────────────────────────────────

const SLOT_HEIGHT = 20; // px per 15-min interval
const GRID_START_MIN = 9 * 60; // 09:00
const GRID_END_MIN = 18 * 60; // 18:00
const TOTAL_SLOTS = (GRID_END_MIN - GRID_START_MIN) / 15; // 36
const TOTAL_HEIGHT = TOTAL_SLOTS * SLOT_HEIGHT; // 720px

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

const HOUR_MARKS = Array.from({ length: 10 }, (_, i) => i + 9); // 9..18

// Static options for the scheduling dialog
const DIALOG_CATEGORIES = ['Engineering', 'Admin', 'Personal'] as const;
type DialogCategory = (typeof DIALOG_CATEGORIES)[number];

const DIALOG_PROJECTS: Record<DialogCategory, string[]> = {
  Engineering: ['Backend API', 'Frontend Dashboard'],
  Admin: ['Management'],
  Personal: ['Learning'],
};

const DIALOG_TASKS: Record<string, string[]> = {
  'Backend API': ['System architecture review', 'Write unit tests', 'Performance optimization', 'Code review'],
  'Frontend Dashboard': ['UI component library', 'Dashboard widgets', 'Responsive layout'],
  'Management': ['Weekly standup notes', 'Sprint planning', 'Budget review'],
  'Learning': ['Read design patterns book', 'Complete TypeScript course'],
};

// ── Utilities ───────────────────────────────────────────────────────────────

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
  if (h === 12) return '12pm';
  return h < 12 ? `${h}am` : `${h - 12}pm`;
}

function getCurrentWeekDays(): { date: string; dayName: string; dayNum: number }[] {
  const today = new Date();
  const dow = today.getDay(); // 0=Sun
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(today);
  monday.setDate(today.getDate() + mondayOffset);
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return { date: formatLocalDate(d), dayName: dayNames[i], dayNum: d.getDate() };
  });
}

// Precomputed break band positions
const BREAK_TOP_Y = timeToY(BREAK_START);
const BREAK_HEIGHT = timeToY(BREAK_END) - BREAK_TOP_Y;

// ── Types ────────────────────────────────────────────────────────────────────

interface MockBlock {
  id: number;
  date: string;
  startTime: string;
  endTime: string;
  workType: WorkType;
  taskTitle: string;
  category: string;
  project: string;
}

interface DialogState {
  mode: 'create' | 'edit';
  date: string;
  workType: WorkType;
  category: string;
  project: string;
  taskTitle: string;
  startTime: string;
  endTime: string;
  blockId?: number;
}

// ── Block Dialog ─────────────────────────────────────────────────────────────

const BTN_BASE = 'px-3 py-1.5 rounded-md text-sm font-medium transition-colors border';
const BTN_ON = 'bg-indigo-600 border-indigo-600 text-white';
const BTN_OFF =
  'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700';

function BlockDialog({
  state,
  onClose,
  onChange,
}: {
  state: DialogState;
  onClose: () => void;
  onChange: (changes: Partial<DialogState>) => void;
}) {
  function adjustTime(field: 'startTime' | 'endTime', delta: number) {
    const startMin = timeToMinutes(state.startTime);
    const endMin = timeToMinutes(state.endTime);
    if (field === 'startTime') {
      const next = Math.max(GRID_START_MIN, Math.min(endMin - 15, startMin + delta));
      onChange({ startTime: minutesToTime(next) });
    } else {
      const next = Math.max(startMin + 15, Math.min(GRID_END_MIN, endMin + delta));
      onChange({ endTime: minutesToTime(next) });
    }
  }

  function handleWorkTypeChange(wt: WorkType) {
    if (wt === 'active_break') {
      onChange({ workType: wt, category: '', project: '', taskTitle: '' });
    } else if (state.workType === 'active_break') {
      const cat = DIALOG_CATEGORIES[0];
      const proj = (DIALOG_PROJECTS[cat] ?? [])[0] ?? '';
      const task = (DIALOG_TASKS[proj] ?? [])[0] ?? '';
      onChange({ workType: wt, category: cat, project: proj, taskTitle: task });
    } else {
      onChange({ workType: wt });
    }
  }

  function handleCategoryChange(cat: string) {
    const proj = (DIALOG_PROJECTS[cat as DialogCategory] ?? [])[0] ?? '';
    const task = (DIALOG_TASKS[proj] ?? [])[0] ?? '';
    onChange({ category: cat, project: proj, taskTitle: task });
  }

  function handleProjectChange(proj: string) {
    const task = (DIALOG_TASKS[proj] ?? [])[0] ?? '';
    onChange({ project: proj, taskTitle: task });
  }

  const categoryProjects = DIALOG_PROJECTS[state.category as DialogCategory] ?? [];
  const projectTasks = DIALOG_TASKS[state.project] ?? [];

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
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Category</p>
                <div className="flex flex-wrap gap-2">
                  {DIALOG_CATEGORIES.map(cat => (
                    <button
                      key={cat}
                      onClick={() => handleCategoryChange(cat)}
                      className={`${BTN_BASE} ${state.category === cat ? BTN_ON : BTN_OFF}`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {categoryProjects.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Project</p>
                  <div className="flex flex-wrap gap-2">
                    {categoryProjects.map(proj => (
                      <button
                        key={proj}
                        onClick={() => handleProjectChange(proj)}
                        className={`${BTN_BASE} ${state.project === proj ? BTN_ON : BTN_OFF}`}
                      >
                        {proj}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {projectTasks.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Task</p>
                  <div className="flex flex-col gap-1.5">
                    {projectTasks.map(task => (
                      <button
                        key={task}
                        onClick={() => onChange({ taskTitle: task })}
                        className={`text-left px-3 py-2 rounded-md text-sm border transition-colors ${
                          state.taskTitle === task ? BTN_ON : BTN_OFF
                        }`}
                      >
                        {task}
                      </button>
                    ))}
                  </div>
                  <button className="mt-2 text-sm text-indigo-600 dark:text-indigo-400 hover:underline">
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
          {state.mode === 'edit' && (
            <button className="min-h-[36px] px-3 rounded-lg text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
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
            <button className="min-h-[36px] px-4 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition-colors">
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── CalendarView ─────────────────────────────────────────────────────────────

export function CalendarView() {
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const days = getCurrentWeekDays();
  const today = formatLocalDate(new Date());

  const mockBlocks: MockBlock[] = [
    { id: 1, date: days[0].date, startTime: '09:15', endTime: '10:30', workType: 'deep', taskTitle: 'System architecture review', category: 'Engineering', project: 'Backend API' },
    { id: 2, date: days[0].date, startTime: '10:30', endTime: '11:30', workType: 'shallow', taskTitle: 'Review PRs and respond', category: 'Engineering', project: 'Backend API' },
    { id: 3, date: days[1].date, startTime: '09:15', endTime: '11:45', workType: 'deep', taskTitle: 'Write unit tests', category: 'Engineering', project: 'Frontend Dashboard' },
    { id: 4, date: days[2].date, startTime: '14:15', endTime: '16:00', workType: 'deep', taskTitle: 'Performance optimization', category: 'Engineering', project: 'Backend API' },
    { id: 5, date: days[3].date, startTime: '09:15', endTime: '10:00', workType: 'shallow', taskTitle: 'Weekly standup notes', category: 'Admin', project: 'Management' },
    { id: 6, date: days[4].date, startTime: '15:00', endTime: '17:00', workType: 'deep', taskTitle: 'Sprint planning document', category: 'Admin', project: 'Management' },
  ];

  // Current time indicator
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const showCurrentTime = nowMin >= GRID_START_MIN && nowMin <= GRID_END_MIN;
  const currentTimeY = ((nowMin - GRID_START_MIN) / 15) * SLOT_HEIGHT;

  // Scroll to current time (or 9:00) on mount
  useEffect(() => {
    if (scrollRef.current) {
      const target = showCurrentTime ? Math.max(0, currentTimeY - 120) : 0;
      scrollRef.current.scrollTop = target;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function openCreate(date: string, startTime: string) {
    const startMin = timeToMinutes(startTime);
    const endMin = Math.min(GRID_END_MIN, startMin + 30);
    const cat = DIALOG_CATEGORIES[0];
    const proj = (DIALOG_PROJECTS[cat] ?? [])[0] ?? '';
    const task = (DIALOG_TASKS[proj] ?? [])[0] ?? '';
    setDialog({
      mode: 'create',
      date,
      workType: 'deep',
      category: cat,
      project: proj,
      taskTitle: task,
      startTime,
      endTime: minutesToTime(endMin),
    });
  }

  function openEdit(block: MockBlock) {
    setDialog({
      mode: 'edit',
      date: block.date,
      workType: block.workType,
      category: block.category,
      project: block.project,
      taskTitle: block.taskTitle,
      startTime: block.startTime,
      endTime: block.endTime,
      blockId: block.id,
    });
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Single scrollable container — header sticks within it */}
      <div ref={scrollRef} className="flex-1 overflow-auto">
        <div style={{ minWidth: '600px' }}>
          {/* Sticky day header */}
          <div className="sticky top-0 z-20 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex">
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
                  <div className={`text-xs font-medium ${isToday ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-500 dark:text-gray-400'}`}>
                    {day.dayName}
                  </div>
                  <div className={`text-sm font-semibold ${isToday ? 'text-indigo-700 dark:text-indigo-300' : 'text-gray-900 dark:text-gray-100'}`}>
                    {day.dayNum}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Time grid */}
          <div className="flex" style={{ height: TOTAL_HEIGHT }}>
            {/* Time label column */}
            <div className="w-14 flex-shrink-0 relative border-r border-gray-200 dark:border-gray-700">
              {HOUR_MARKS.map(h => (
                <div
                  key={h}
                  className="absolute right-2 text-[10px] text-gray-400 dark:text-gray-500 tabular-nums leading-none select-none"
                  style={{ top: ((h * 60 - GRID_START_MIN) / 15) * SLOT_HEIGHT - 5 }}
                >
                  {formatHour(h)}
                </div>
              ))}
            </div>

            {/* Day columns */}
            {days.map(day => {
              const isToday = day.date === today;
              const blocksForDay = mockBlocks.filter(b => b.date === day.date);

              return (
                <div
                  key={day.date}
                  className={`flex-1 relative border-l border-gray-200 dark:border-gray-700 ${
                    isToday ? 'bg-indigo-50/20 dark:bg-indigo-900/5' : ''
                  }`}
                >
                  {/* Hour lines */}
                  {HOUR_MARKS.map(h => (
                    <div
                      key={h}
                      className="absolute left-0 right-0 border-t border-gray-100 dark:border-gray-800"
                      style={{ top: ((h * 60 - GRID_START_MIN) / 15) * SLOT_HEIGHT }}
                    />
                  ))}

                  {/* Half-hour lines */}
                  {HOUR_MARKS.slice(0, -1).map(h => (
                    <div
                      key={`${h}h`}
                      className="absolute left-0 right-0 border-t border-dashed border-gray-50 dark:border-gray-800/60"
                      style={{ top: ((h * 60 + 30 - GRID_START_MIN) / 15) * SLOT_HEIGHT }}
                    />
                  ))}

                  {/* Active break band */}
                  <div
                    className="absolute left-0 right-0 bg-amber-50 dark:bg-amber-900/10 pointer-events-none"
                    style={{ top: BREAK_TOP_Y, height: BREAK_HEIGHT }}
                  />

                  {/* Clickable 15-min slots */}
                  {Array.from({ length: TOTAL_SLOTS }, (_, slot) => (
                    <div
                      key={slot}
                      className="absolute left-0 right-0 cursor-pointer hover:bg-indigo-50/60 dark:hover:bg-indigo-900/15 transition-colors"
                      style={{ top: slot * SLOT_HEIGHT, height: SLOT_HEIGHT }}
                      onClick={() => openCreate(day.date, minutesToTime(GRID_START_MIN + slot * 15))}
                    />
                  ))}

                  {/* Calendar blocks */}
                  {blocksForDay.map(block => {
                    const topY = timeToY(block.startTime);
                    const height = timeToY(block.endTime) - topY;
                    return (
                      <div
                        key={block.id}
                        onClick={e => { e.stopPropagation(); openEdit(block); }}
                        className={`absolute left-0.5 right-0.5 rounded overflow-hidden cursor-pointer z-10 ${BLOCK_COLORS[block.workType]}`}
                        style={{ top: topY + 1, height: height - 2 }}
                      >
                        <div className="px-1.5 py-0.5">
                          <div className="text-[11px] font-medium leading-tight truncate">{block.taskTitle}</div>
                          {height >= 40 && (
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
                      style={{ top: currentTimeY }}
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

      {/* Scheduling dialog */}
      {dialog && (
        <BlockDialog
          state={dialog}
          onClose={() => setDialog(null)}
          onChange={changes => setDialog(prev => (prev ? { ...prev, ...changes } : prev))}
        />
      )}
    </div>
  );
}
