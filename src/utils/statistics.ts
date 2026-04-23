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

export interface WorkTypeSummary {
  deepMinutes: number;
  shallowMinutes: number;
  breakMinutes: number;
  deepInWindowMinutes: number;
  shallowInWindowMinutes: number;
  breakInWindowMinutes: number;
  unutilizedMinutes: number;
  totalWindowMinutes: number;
}

export function calcWorkTypeSummary(
  blocks: CalendarBlock[],
  workDayStart: string,
  workDayEnd: string,
  weekdays: string[],
): WorkTypeSummary {
  const workDayMinutes = timeToMinutes(workDayEnd) - timeToMinutes(workDayStart);
  const totalWindowMinutes = workDayMinutes * weekdays.length;
  const weekdaySet = new Set(weekdays);

  let deepMinutes = 0;
  let shallowMinutes = 0;
  let breakMinutes = 0;
  let deepInWindowMinutes = 0;
  let shallowInWindowMinutes = 0;
  let breakInWindowMinutes = 0;

  for (const block of blocks) {
    const dur = blockDurationMinutes(block.startTime, block.endTime);
    if (block.workType === 'deep') deepMinutes += dur;
    else if (block.workType === 'shallow') shallowMinutes += dur;
    else if (block.workType === 'active_break') breakMinutes += dur;

    if (weekdaySet.has(block.date)) {
      const overlap = workDayOverlapMinutes(block.startTime, block.endTime, workDayStart, workDayEnd);
      if (block.workType === 'deep') deepInWindowMinutes += overlap;
      else if (block.workType === 'shallow') shallowInWindowMinutes += overlap;
      else if (block.workType === 'active_break') breakInWindowMinutes += overlap;
    }
  }

  const utilizedInWindowMinutes = deepInWindowMinutes + shallowInWindowMinutes + breakInWindowMinutes;
  const unutilizedMinutes = Math.max(0, totalWindowMinutes - utilizedInWindowMinutes);

  return {
    deepMinutes,
    shallowMinutes,
    breakMinutes,
    deepInWindowMinutes,
    shallowInWindowMinutes,
    breakInWindowMinutes,
    unutilizedMinutes,
    totalWindowMinutes,
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
