import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import type { Category, Project, Task } from '../types';
import {
  minutesToDisplay,
  weekdaysInRange,
  calcWorkTypeSummary,
  calcCategoryBreakdown,
  calcProjectBreakdown,
  calcTaskBreakdown,
  type CategoryRow,
  type ProjectRow,
  type TaskRow,
  type WorkTypeSummary,
} from '../utils/statistics';

// ─── Date range helpers ───────────────────────────────────────────────────────

function toYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function currentWeekRange(): { startDate: string; endDate: string } {
  const today = new Date();
  const dow = today.getDay();
  const daysFromMon = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(today);
  monday.setDate(today.getDate() + daysFromMon);
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  return { startDate: toYMD(monday), endDate: toYMD(friday) };
}

function currentMonthRange(): { startDate: string; endDate: string } {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  return { startDate: toYMD(start), endDate: toYMD(end) };
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface SummaryCardProps {
  label: string;
  minutes: number;
  pct: number;
  color: string;
  darkColor: string;
}

function SummaryCard({ label, minutes, pct, color, darkColor }: SummaryCardProps) {
  return (
    <div className={`rounded-xl p-4 ${color} ${darkColor}`}>
      <p className="text-xs font-medium opacity-70 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold mt-1">{minutesToDisplay(minutes)}</p>
      <p className="text-sm opacity-60 mt-0.5">{pct.toFixed(0)}% of work window</p>
    </div>
  );
}

interface MiniBarProps {
  max: number;
  deepMinutes: number;
  shallowMinutes: number;
}

function MiniBar({ max, deepMinutes, shallowMinutes }: MiniBarProps) {
  if (max === 0) return <div className="h-2 w-full rounded-full bg-gray-100 dark:bg-gray-800" />;
  const deepPct = (deepMinutes / max) * 100;
  const shallowPct = (shallowMinutes / max) * 100;
  return (
    <div className="h-2 w-full rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden flex">
      <div className="h-full bg-indigo-500 rounded-l-full" style={{ width: `${deepPct}%` }} />
      <div className="h-full bg-emerald-500" style={{ width: `${shallowPct}%` }} />
    </div>
  );
}

interface CategoryTableProps { rows: CategoryRow[]; }

function CategoryTable({ rows }: CategoryTableProps) {
  if (rows.length === 0) {
    return <p className="text-sm text-gray-400 dark:text-gray-500 py-4">No data for this period.</p>;
  }
  const maxMinutes = rows[0].totalMinutes;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800">
            <th className="pb-2 font-medium">Category</th>
            <th className="pb-2 font-medium text-right pr-4">Deep</th>
            <th className="pb-2 font-medium text-right pr-4">Shallow</th>
            <th className="pb-2 font-medium text-right pr-4">Total</th>
            <th className="pb-2 font-medium w-24" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
          {rows.map(row => (
            <tr key={row.categoryId}>
              <td className="py-2.5 font-medium text-gray-900 dark:text-gray-100">{row.name}</td>
              <td className="py-2.5 text-right pr-4 text-indigo-600 dark:text-indigo-400">{minutesToDisplay(row.deepMinutes)}</td>
              <td className="py-2.5 text-right pr-4 text-emerald-600 dark:text-emerald-400">{minutesToDisplay(row.shallowMinutes)}</td>
              <td className="py-2.5 text-right pr-4 text-gray-700 dark:text-gray-300 tabular-nums">{minutesToDisplay(row.totalMinutes)}</td>
              <td className="py-2.5 w-24">
                <MiniBar max={maxMinutes} deepMinutes={row.deepMinutes} shallowMinutes={row.shallowMinutes} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface ProjectTableProps { rows: ProjectRow[]; }

function ProjectTable({ rows }: ProjectTableProps) {
  if (rows.length === 0) {
    return <p className="text-sm text-gray-400 dark:text-gray-500 py-4">No data for this period.</p>;
  }
  const maxMinutes = rows[0].totalMinutes;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800">
            <th className="pb-2 font-medium">Category</th>
            <th className="pb-2 font-medium">Project</th>
            <th className="pb-2 font-medium text-right pr-4">Deep</th>
            <th className="pb-2 font-medium text-right pr-4">Shallow</th>
            <th className="pb-2 font-medium text-right pr-4">Total</th>
            <th className="pb-2 font-medium w-24" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
          {rows.map(row => (
            <tr key={row.projectId}>
              <td className="py-2.5 text-gray-500 dark:text-gray-400">{row.categoryName}</td>
              <td className="py-2.5 font-medium text-gray-900 dark:text-gray-100">{row.name}</td>
              <td className="py-2.5 text-right pr-4 text-indigo-600 dark:text-indigo-400">{minutesToDisplay(row.deepMinutes)}</td>
              <td className="py-2.5 text-right pr-4 text-emerald-600 dark:text-emerald-400">{minutesToDisplay(row.shallowMinutes)}</td>
              <td className="py-2.5 text-right pr-4 text-gray-700 dark:text-gray-300 tabular-nums">{minutesToDisplay(row.totalMinutes)}</td>
              <td className="py-2.5 w-24">
                <MiniBar max={maxMinutes} deepMinutes={row.deepMinutes} shallowMinutes={row.shallowMinutes} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface TaskTableProps { rows: TaskRow[]; }

function TaskTable({ rows }: TaskTableProps) {
  if (rows.length === 0) {
    return <p className="text-sm text-gray-400 dark:text-gray-500 py-4">No data for this period.</p>;
  }
  const maxMinutes = rows[0].minutes;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800">
            <th className="pb-2 font-medium">Project</th>
            <th className="pb-2 font-medium">Task</th>
            <th className="pb-2 font-medium">Type</th>
            <th className="pb-2 font-medium text-right pr-4">Time</th>
            <th className="pb-2 font-medium w-24" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
          {rows.map(row => (
            <tr key={row.taskId}>
              <td className="py-2.5 text-gray-500 dark:text-gray-400">{row.projectName}</td>
              <td className="py-2.5 font-medium text-gray-900 dark:text-gray-100">{row.title}</td>
              <td className="py-2.5">
                <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                  row.workType === 'deep'
                    ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                    : 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                }`}>
                  {row.workType === 'deep' ? 'Deep' : 'Shallow'}
                </span>
              </td>
              <td className="py-2.5 text-right pr-4 text-gray-700 dark:text-gray-300 tabular-nums">{minutesToDisplay(row.minutes)}</td>
              <td className="py-2.5 w-24">
                <div className="h-2 w-full rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${row.workType === 'deep' ? 'bg-indigo-500' : 'bg-emerald-500'}`}
                    style={{ width: `${(row.minutes / maxMinutes) * 100}%` }}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface StackedBarProps { summary: WorkTypeSummary; }

function StackedBar({ summary }: StackedBarProps) {
  const { deepInWindowMinutes: d, shallowInWindowMinutes: s, breakInWindowMinutes: b, unutilizedMinutes: u, totalWindowMinutes: t } = summary;
  if (t === 0) return null;
  const pct = (v: number) => `${(v / t) * 100}%`;

  const segments = [
    { value: d, label: 'Deep', cls: 'bg-indigo-500' },
    { value: s, label: 'Shallow', cls: 'bg-emerald-500' },
    { value: b, label: 'Break', cls: 'bg-amber-400' },
    { value: u, label: 'Unutilized', cls: 'bg-gray-200 dark:bg-gray-700' },
  ].filter(seg => seg.value > 0);

  return (
    <div className="space-y-2">
      <div className="h-5 w-full rounded-full overflow-hidden flex">
        {segments.map(seg => (
          <div key={seg.label} className={`h-full ${seg.cls}`} style={{ width: pct(seg.value) }} title={`${seg.label}: ${minutesToDisplay(seg.value)}`} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {segments.map(seg => (
          <div key={seg.label} className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
            <span className={`inline-block w-2 h-2 rounded-full ${seg.cls}`} />
            {seg.label} — {minutesToDisplay(seg.value)}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">{title}</h2>
      {children}
    </div>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────

interface Props {
  allTasks: Task[];
  projects: Project[];
  categories: Category[];
}

type Period = 'week' | 'month' | 'custom';

export function StatisticsView({ allTasks, projects, categories }: Props) {
  const [period, setPeriod] = useState<Period>('week');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const dateRange = useMemo(() => {
    if (period === 'week') return currentWeekRange();
    if (period === 'month') return currentMonthRange();
    if (customStart && customEnd && customStart <= customEnd) {
      return { startDate: customStart, endDate: customEnd };
    }
    return null;
  }, [period, customStart, customEnd]);

  const blocks = useLiveQuery(
    () =>
      dateRange
        ? db.calendarBlocks
            .where('date')
            .between(dateRange.startDate, dateRange.endDate, true, true)
            .toArray()
        : Promise.resolve([] as import('../types').CalendarBlock[]),
    [dateRange?.startDate, dateRange?.endDate],
  ) ?? [];

  const settings = useLiveQuery(() => db.settings.toCollection().first(), []);
  const workDayStart = settings?.workDayStart ?? '09:15';
  const workDayEnd = settings?.workDayEnd ?? '18:00';

  const weekdays = useMemo(
    () => (dateRange ? weekdaysInRange(dateRange.startDate, dateRange.endDate) : []),
    [dateRange],
  );

  const summary = useMemo(
    () => calcWorkTypeSummary(blocks, workDayStart, workDayEnd, weekdays),
    [blocks, workDayStart, workDayEnd, weekdays],
  );

  const categoryRows = useMemo(
    () => calcCategoryBreakdown(blocks, allTasks, projects, categories),
    [blocks, allTasks, projects, categories],
  );

  const projectRows = useMemo(
    () => calcProjectBreakdown(blocks, allTasks, projects, categories),
    [blocks, allTasks, projects, categories],
  );

  const taskRows = useMemo(
    () => calcTaskBreakdown(blocks, allTasks, projects),
    [blocks, allTasks, projects],
  );

  const tw = summary.totalWindowMinutes;

  const cards = [
    {
      label: 'Deep Work',
      minutes: summary.deepMinutes,
      pct: tw > 0 ? (summary.deepInWindowMinutes / tw) * 100 : 0,
      color: 'bg-indigo-50 text-indigo-900',
      darkColor: 'dark:bg-indigo-900/20 dark:text-indigo-100',
    },
    {
      label: 'Shallow Work',
      minutes: summary.shallowMinutes,
      pct: tw > 0 ? (summary.shallowInWindowMinutes / tw) * 100 : 0,
      color: 'bg-emerald-50 text-emerald-900',
      darkColor: 'dark:bg-emerald-900/20 dark:text-emerald-100',
    },
    {
      label: 'Active Break',
      minutes: summary.breakMinutes,
      pct: tw > 0 ? (summary.breakInWindowMinutes / tw) * 100 : 0,
      color: 'bg-amber-50 text-amber-900',
      darkColor: 'dark:bg-amber-900/20 dark:text-amber-100',
    },
    {
      label: 'Unutilized',
      minutes: summary.unutilizedMinutes,
      pct: tw > 0 ? (summary.unutilizedMinutes / tw) * 100 : 0,
      color: 'bg-gray-100 text-gray-700',
      darkColor: 'dark:bg-gray-800 dark:text-gray-300',
    },
  ];

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">

        {/* Period filter */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
            {(['week', 'month', 'custom'] as Period[]).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`min-h-[36px] px-4 text-sm font-medium transition-colors ${
                  period === p
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                {p === 'week' ? 'This Week' : p === 'month' ? 'This Month' : 'Custom'}
              </button>
            ))}
          </div>

          {period === 'custom' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customStart}
                onChange={e => setCustomStart(e.target.value)}
                className="min-h-[36px] px-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100"
              />
              <span className="text-gray-400 text-sm">to</span>
              <input
                type="date"
                value={customEnd}
                onChange={e => setCustomEnd(e.target.value)}
                className="min-h-[36px] px-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100"
              />
            </div>
          )}

          {dateRange && (
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {formatDateLabel(dateRange.startDate)} – {formatDateLabel(dateRange.endDate)}
              {weekdays.length > 0 && ` · ${weekdays.length} work day${weekdays.length !== 1 ? 's' : ''}`}
            </span>
          )}
        </div>

        {period === 'custom' && !dateRange && (
          <p className="text-sm text-amber-600 dark:text-amber-400">Select a start and end date to view statistics.</p>
        )}

        {dateRange && (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {cards.map(c => (
                <SummaryCard key={c.label} {...c} />
              ))}
            </div>

            {/* Stacked distribution bar */}
            <Section title={`Work Window — ${minutesToDisplay(summary.totalWindowMinutes)}`}>
              <StackedBar summary={summary} />
            </Section>

            {/* Category breakdown */}
            <Section title="By Category">
              <CategoryTable rows={categoryRows} />
            </Section>

            {/* Project breakdown */}
            <Section title="By Project">
              <ProjectTable rows={projectRows} />
            </Section>

            {/* Task breakdown */}
            <Section title="By Task">
              <TaskTable rows={taskRows} />
            </Section>
          </>
        )}
      </div>
    </div>
  );
}
