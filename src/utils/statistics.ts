import type { CalendarBlock, Category, Project, Task } from '../types';

// ─── Time helpers ────────────────────────────────────────────────────────────

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function minutesToDisplay(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function blockDurationMinutes(startTime: string, endTime: string): number {
  return timeToMinutes(endTime) - timeToMinutes(startTime);
}

// Minutes that [startTime, endTime] overlaps with [workStart, workEnd].
export function workDayOverlapMinutes(
  startTime: string,
  endTime: string,
  workStart: string,
  workEnd: string,
): number {
  const s = Math.max(timeToMinutes(startTime), timeToMinutes(workStart));
  const e = Math.min(timeToMinutes(endTime), timeToMinutes(workEnd));
  return Math.max(0, e - s);
}

// YYYY-MM-DD strings for Mon–Fri weekdays within [startDate, endDate] inclusive.
export function weekdaysInRange(startDate: string, endDate: string): string[] {
  const days: string[] = [];
  const cur = new Date(startDate + 'T12:00:00');
  const end = new Date(endDate + 'T12:00:00');
  while (cur <= end) {
    const dow = cur.getDay();
    if (dow >= 1 && dow <= 5) {
      const y = cur.getFullYear();
      const mo = String(cur.getMonth() + 1).padStart(2, '0');
      const d = String(cur.getDate()).padStart(2, '0');
      days.push(`${y}-${mo}-${d}`);
    }
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

// ─── Summary ─────────────────────────────────────────────────────────────────

export interface DailyExclusion {
  start: string; // HH:MM — recurring daily slot excluded from the productive window
  end: string;   // HH:MM
}

export interface WorkTypeSummary {
  deepMinutes: number;
  shallowMinutes: number;
  breakMinutes: number;
  emailMinutes: number;
  meetingMinutes: number;
  deepInWindowMinutes: number;
  shallowInWindowMinutes: number;
  breakInWindowMinutes: number;
  emailInWindowMinutes: number;
  meetingInWindowMinutes: number;
  unutilizedMinutes: number;
  totalWindowMinutes: number; // effective window (work day minus exclusions) × weekdays
}

// Returns how many minutes of [blockStart, blockEnd] fall inside the exclusion slot.
function exclusionOverlap(blockStart: string, blockEnd: string, ex: DailyExclusion): number {
  const s = Math.max(timeToMinutes(blockStart), timeToMinutes(ex.start));
  const e = Math.min(timeToMinutes(blockEnd), timeToMinutes(ex.end));
  return Math.max(0, e - s);
}

export function calcWorkTypeSummary(
  blocks: CalendarBlock[],
  workDayStart: string,
  workDayEnd: string,
  weekdays: string[],
  exclusions: DailyExclusion[] = [],
): WorkTypeSummary {
  // Effective window per day = work day minus recurring excluded slots (standup, break, etc.)
  const workDayMinutes = timeToMinutes(workDayEnd) - timeToMinutes(workDayStart);
  const excludedPerDay = exclusions.reduce(
    (sum, ex) => sum + workDayOverlapMinutes(ex.start, ex.end, workDayStart, workDayEnd),
    0,
  );
  const effectiveDayMinutes = Math.max(0, workDayMinutes - excludedPerDay);
  const totalWindowMinutes = effectiveDayMinutes * weekdays.length;

  const weekdaySet = new Set(weekdays);

  let deepMinutes = 0;
  let shallowMinutes = 0;
  let breakMinutes = 0;
  let emailMinutes = 0;
  let meetingMinutes = 0;
  let deepInWindowMinutes = 0;
  let shallowInWindowMinutes = 0;
  let breakInWindowMinutes = 0;
  let emailInWindowMinutes = 0;
  let meetingInWindowMinutes = 0;

  for (const block of blocks) {
    const dur = blockDurationMinutes(block.startTime, block.endTime);
    if (block.workType === 'deep') deepMinutes += dur;
    else if (block.workType === 'shallow') shallowMinutes += dur;
    else if (block.workType === 'active_break') breakMinutes += dur;
    else if (block.workType === 'email') emailMinutes += dur;
    else if (block.workType === 'meeting') meetingMinutes += dur;

    if (weekdaySet.has(block.date)) {
      // Effective overlap = work-day overlap minus any portion inside excluded slots
      const workOverlap = workDayOverlapMinutes(block.startTime, block.endTime, workDayStart, workDayEnd);
      const exOverlap = exclusions.reduce((sum, ex) => sum + exclusionOverlap(block.startTime, block.endTime, ex), 0);
      const effective = Math.max(0, workOverlap - exOverlap);
      if (block.workType === 'deep') deepInWindowMinutes += effective;
      else if (block.workType === 'shallow') shallowInWindowMinutes += effective;
      else if (block.workType === 'active_break') breakInWindowMinutes += effective;
      else if (block.workType === 'email') emailInWindowMinutes += effective;
      else if (block.workType === 'meeting') meetingInWindowMinutes += effective;
    }
  }

  const utilizedInWindowMinutes =
    deepInWindowMinutes + shallowInWindowMinutes + breakInWindowMinutes +
    emailInWindowMinutes + meetingInWindowMinutes;
  const unutilizedMinutes = Math.max(0, totalWindowMinutes - utilizedInWindowMinutes);

  return {
    deepMinutes, shallowMinutes, breakMinutes, emailMinutes, meetingMinutes,
    deepInWindowMinutes, shallowInWindowMinutes, breakInWindowMinutes,
    emailInWindowMinutes, meetingInWindowMinutes,
    unutilizedMinutes, totalWindowMinutes,
  };
}

// ─── Breakdowns ──────────────────────────────────────────────────────────────

export interface CategoryRow {
  categoryId: number;
  name: string;
  deepMinutes: number;
  shallowMinutes: number;
  totalMinutes: number;
}

export function calcCategoryBreakdown(
  blocks: CalendarBlock[],
  tasks: Task[],
  projects: Project[],
  categories: Category[],
): CategoryRow[] {
  const taskMap = new Map(tasks.map(t => [t.id, t]));
  const projectMap = new Map(projects.map(p => [p.id, p]));
  const rows = new Map<number, CategoryRow>(
    categories.map(c => [c.id, { categoryId: c.id, name: c.name, deepMinutes: 0, shallowMinutes: 0, totalMinutes: 0 }]),
  );

  for (const block of blocks) {
    if (block.taskId === null) continue;
    const task = taskMap.get(block.taskId);
    if (!task) continue;
    const project = projectMap.get(task.projectId);
    if (!project) continue;
    const row = rows.get(project.categoryId);
    if (!row) continue;
    const dur = blockDurationMinutes(block.startTime, block.endTime);
    if (block.workType === 'deep') row.deepMinutes += dur;
    else if (block.workType === 'shallow') row.shallowMinutes += dur;
    row.totalMinutes += dur;
  }

  return [...rows.values()]
    .filter(r => r.totalMinutes > 0)
    .sort((a, b) => b.totalMinutes - a.totalMinutes);
}

export interface ProjectRow {
  projectId: number;
  name: string;
  categoryName: string;
  deepMinutes: number;
  shallowMinutes: number;
  totalMinutes: number;
}

export function calcProjectBreakdown(
  blocks: CalendarBlock[],
  tasks: Task[],
  projects: Project[],
  categories: Category[],
): ProjectRow[] {
  const taskMap = new Map(tasks.map(t => [t.id, t]));
  const projectMap = new Map(projects.map(p => [p.id, p]));
  const categoryMap = new Map(categories.map(c => [c.id, c]));
  const rows = new Map<number, ProjectRow>();

  for (const block of blocks) {
    if (block.taskId === null) continue;
    const task = taskMap.get(block.taskId);
    if (!task) continue;
    const project = projectMap.get(task.projectId);
    if (!project) continue;

    if (!rows.has(project.id)) {
      rows.set(project.id, {
        projectId: project.id,
        name: project.name,
        categoryName: categoryMap.get(project.categoryId)?.name ?? 'Unknown',
        deepMinutes: 0,
        shallowMinutes: 0,
        totalMinutes: 0,
      });
    }
    const row = rows.get(project.id)!;
    const dur = blockDurationMinutes(block.startTime, block.endTime);
    if (block.workType === 'deep') row.deepMinutes += dur;
    else if (block.workType === 'shallow') row.shallowMinutes += dur;
    row.totalMinutes += dur;
  }

  return [...rows.values()].sort((a, b) => b.totalMinutes - a.totalMinutes);
}

export interface TaskRow {
  taskId: number;
  title: string;
  projectName: string;
  workType: string;
  minutes: number;
}

export function calcTaskBreakdown(
  blocks: CalendarBlock[],
  tasks: Task[],
  projects: Project[],
): TaskRow[] {
  const taskMap = new Map(tasks.map(t => [t.id, t]));
  const projectMap = new Map(projects.map(p => [p.id, p]));
  const rows = new Map<number, TaskRow>();

  for (const block of blocks) {
    if (block.taskId === null) continue;
    const task = taskMap.get(block.taskId);
    if (!task) continue;

    if (!rows.has(task.id)) {
      rows.set(task.id, {
        taskId: task.id,
        title: task.title,
        projectName: projectMap.get(task.projectId)?.name ?? 'Unknown',
        workType: task.workType,
        minutes: 0,
      });
    }
    rows.get(task.id)!.minutes += blockDurationMinutes(block.startTime, block.endTime);
  }

  return [...rows.values()].sort((a, b) => b.minutes - a.minutes);
}
