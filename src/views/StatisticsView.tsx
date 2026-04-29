import { useMemo, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import type { Category, Project, Task } from '../types';
import { GanttChart } from '../components/GanttChart';
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
  type DailyExclusion,
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

// ─── Gantt period types + helpers ─────────────────────────────────────────────

type GanttPeriod = 'week' | 'month' | 'fy';

const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function ganttWeekRange(offset: number): { startDate: string; endDate: string; label: string } {
  const today = new Date();
  const dow = today.getDay();
  const daysFromMon = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(today);
  monday.setDate(today.getDate() + daysFromMon + offset * 7);
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  const mDay = monday.getDate();
  const mMon = MONTH_ABBR[monday.getMonth()];
  const fDay = friday.getDate();
  const fMon = MONTH_ABBR[friday.getMonth()];
  const year = friday.getFullYear();
  const label = monday.getMonth() === friday.getMonth()
    ? `${mDay}–${fDay} ${fMon} ${year}`
    : `${mDay} ${mMon} – ${fDay} ${fMon} ${year}`;
  return { startDate: toYMD(monday), endDate: toYMD(friday), label };
}

function ganttMonthRange(offset: number): { startDate: string; endDate: string; label: string } {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth() + offset, 1);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
  const label = `${MONTH_ABBR[start.getMonth()]} ${start.getFullYear()}`;
  return { startDate: toYMD(start), endDate: toYMD(end), label };
}

function ganttFyRange(offset: number): { startDate: string; endDate: string; label: string } {
  const today = new Date();
  const fyStartYear = (today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1) + offset;
  const start = new Date(fyStartYear, 3, 1);       // April 1
  const end = new Date(fyStartYear + 1, 2, 31);    // March 31
  const label = `FY ${fyStartYear}–${String(fyStartYear + 1).slice(2)}`;
  return { startDate: toYMD(start), endDate: toYMD(end), label };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface SummaryCardProps {
  label: string;
  minutes: number;
  pct: number;
  color: string;
  darkColor: string;
  children?: ReactNode;
}

function SummaryCard({ label, minutes, pct, color, darkColor, children }: SummaryCardProps) {
  return (
    <div className={`rounded-xl p-4 ${color} ${darkColor}`}>
      <p className="text-xs font-medium opacity-70 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold mt-1">{minutesToDisplay(minutes)}</p>
      <p className="text-sm opacity-60 mt-0.5">{pct.toFixed(0)}% of work window</p>
      {children}
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
  const { deepInWindowMinutes: d, shallowInWindowMinutes: s, breakInWindowMinutes: b, emailInWindowMinutes: e, meetingInWindowMinutes: m, unutilizedMinutes: u, totalWindowMinutes: t } = summary;
  if (t === 0) return null;
  const pct = (v: number) => `${(v / t) * 100}%`;

  const segments = [
    { value: d, label: 'Deep', cls: 'bg-indigo-500' },
    { value: s + e + m, label: 'Shallow', cls: 'bg-emerald-500' }, // email + meeting merged into shallow
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
  const [activeTab, setActiveTab] = useState<'summary' | 'gantt'>('summary');
  const [period, setPeriod] = useState<Period>('week');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [ganttPeriod, setGanttPeriod] = useState<GanttPeriod>('month');
  const [ganttOffset, setGanttOffset] = useState(0);

  const ganttDateRange = useMemo(() => {
    if (ganttPeriod === 'week') return ganttWeekRange(ganttOffset);
    if (ganttPeriod === 'month') return ganttMonthRange(ganttOffset);
    return ganttFyRange(ganttOffset);
  }, [ganttPeriod, ganttOffset]);

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

  const leaveDaysInRange = useLiveQuery(
    () =>
      dateRange
        ? db.leaveDays.where('date').between(dateRange.startDate, dateRange.endDate, true, true).toArray()
        : Promise.resolve([] as import('../types').LeaveDay[]),
    [dateRange?.startDate, dateRange?.endDate],
  ) ?? [];
  const leaveDaySet = useMemo(() => new Set(leaveDaysInRange.map(l => l.date)), [leaveDaysInRange]);

  const settings = useLiveQuery(() => db.settings.toCollection().first(), []);
  const workDayStart = settings?.workDayStart ?? '09:15';
  const workDayEnd = settings?.workDayEnd ?? '18:00';

  // Daily slots excluded from the productive window (standup + default break)
  const exclusions = useMemo<DailyExclusion[]>(() => {
    const result: DailyExclusion[] = [];
    if (settings?.standupStart && settings?.standupEnd) {
      result.push({ start: settings.standupStart, end: settings.standupEnd });
    }
    if (settings?.defaultBreakStart && settings?.defaultBreakEnd) {
      result.push({ start: settings.defaultBreakStart, end: settings.defaultBreakEnd });
    }
    return result;
  }, [settings]);

  const weekdays = useMemo(
    () => (dateRange ? weekdaysInRange(dateRange.startDate, dateRange.endDate).filter(d => !leaveDaySet.has(d)) : []),
    [dateRange, leaveDaySet],
  );

  const summary = useMemo(
    () => calcWorkTypeSummary(blocks, workDayStart, workDayEnd, weekdays, exclusions),
    [blocks, workDayStart, workDayEnd, weekdays, exclusions],
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
  const shallowTotalMinutes = summary.shallowMinutes + summary.emailMinutes + summary.meetingMinutes;
  const shallowInWindowTotal = summary.shallowInWindowMinutes + summary.emailInWindowMinutes + summary.meetingInWindowMinutes;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">

        {/* Tab switcher */}
        <div className="flex rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 self-start">
          {(['summary', 'gantt'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`min-h-[36px] px-4 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              {tab === 'summary' ? 'Summary' : 'Gantt'}
            </button>
          ))}
        </div>

        {activeTab === 'summary' && (
          <>
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
                  {leaveDaysInRange.length > 0 && (
                    <span className="text-gray-400 dark:text-gray-500">
                      {` · ${leaveDaysInRange.length} leave day${leaveDaysInRange.length !== 1 ? 's' : ''} excluded`}
                    </span>
                  )}
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
                  <SummaryCard
                    label="Deep Work"
                    minutes={summary.deepMinutes}
                    pct={tw > 0 ? (summary.deepInWindowMinutes / tw) * 100 : 0}
                    color="bg-indigo-50 text-indigo-900"
                    darkColor="dark:bg-indigo-900/20 dark:text-indigo-100"
                  />
                  <SummaryCard
                    label="Shallow Work"
                    minutes={shallowTotalMinutes}
                    pct={tw > 0 ? (shallowInWindowTotal / tw) * 100 : 0}
                    color="bg-emerald-50 text-emerald-900"
                    darkColor="dark:bg-emerald-900/20 dark:text-emerald-100"
                  >
                    {(summary.emailMinutes > 0 || summary.meetingMinutes > 0) && (
                      <div className="mt-2 pt-2 border-t border-emerald-200 dark:border-emerald-700/40 flex flex-wrap gap-x-3 gap-y-0.5">
                        {summary.shallowMinutes > 0 && (
                          <span className="text-xs opacity-60">Pure {minutesToDisplay(summary.shallowMinutes)}</span>
                        )}
                        {summary.emailMinutes > 0 && (
                          <span className="text-xs opacity-60">Email {minutesToDisplay(summary.emailMinutes)}</span>
                        )}
                        {summary.meetingMinutes > 0 && (
                          <span className="text-xs opacity-60">Mtg {minutesToDisplay(summary.meetingMinutes)}</span>
                        )}
                      </div>
                    )}
                  </SummaryCard>
                  <SummaryCard
                    label="Active Break"
                    minutes={summary.breakMinutes}
                    pct={tw > 0 ? (summary.breakInWindowMinutes / tw) * 100 : 0}
                    color="bg-amber-50 text-amber-900"
                    darkColor="dark:bg-amber-900/20 dark:text-amber-100"
                  />
                  <SummaryCard
                    label="Unutilized"
                    minutes={summary.unutilizedMinutes}
                    pct={tw > 0 ? (summary.unutilizedMinutes / tw) * 100 : 0}
                    color="bg-gray-100 text-gray-700"
                    darkColor="dark:bg-gray-800 dark:text-gray-300"
                  />
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
          </>
        )}

        {activeTab === 'gantt' && (
          <>
            {/* Gantt period selector + navigation */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Period type */}
              <div className="flex rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                {(['week', 'month', 'fy'] as GanttPeriod[]).map(p => (
                  <button
                    key={p}
                    onClick={() => { setGanttPeriod(p); setGanttOffset(0); }}
                    className={`min-h-[36px] px-4 text-sm font-medium transition-colors ${
                      ganttPeriod === p
                        ? 'bg-indigo-600 text-white'
                        : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                  >
                    {p === 'week' ? 'Week' : p === 'month' ? 'Month' : 'Financial Year'}
                  </button>
                ))}
              </div>

              {/* Prev / label / next */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setGanttOffset(o => o - 1)}
                  className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  aria-label="Previous period"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 min-w-[160px] text-center tabular-nums">
                  {ganttDateRange.label}
                </span>
                <button
                  onClick={() => setGanttOffset(o => o + 1)}
                  className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  aria-label="Next period"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              {ganttOffset !== 0 && (
                <button
                  onClick={() => setGanttOffset(0)}
                  className="min-h-[32px] px-3 rounded-lg text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 transition-colors"
                >
                  Current
                </button>
              )}
            </div>

            <Section title="Project Timeline">
              <GanttChart
                tasks={allTasks}
                categories={categories}
                projects={projects}
                rangeStart={ganttDateRange.startDate}
                rangeEnd={ganttDateRange.endDate}
              />
            </Section>
          </>
        )}
      </div>
    </div>
  );
}
