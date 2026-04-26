import type { Task } from '../types';

function daysBetween(earlier: string, later: string): number {
  const ms = new Date(later + 'T12:00:00').getTime() - new Date(earlier + 'T12:00:00').getTime();
  return Math.round(ms / 86_400_000);
}

// Returns 0–100 clamped percentage position of a date within the display range.
// Position 0 = start of rangeStart day; position 100 = end of last day in range.
export function dateToOffset(date: string, rangeStart: string, totalDays: number): number {
  if (totalDays <= 0) return 0;
  const raw = (daysBetween(rangeStart, date) / totalDays) * 100;
  return Math.max(0, Math.min(100, raw));
}

// Returns left% and width% for a CSS-positioned Gantt bar within the display range.
// Both values are clamped to [0, 100]. Width has a minimum of 0.5 to remain visible.
export function taskBarGeometry(
  startDate: string,
  dueDate: string,
  rangeStart: string,
  totalDays: number,
): { left: number; width: number } {
  if (totalDays <= 0) return { left: 0, width: 0 };
  const rawLeft = (daysBetween(rangeStart, startDate) / totalDays) * 100;
  const rawRight = ((daysBetween(rangeStart, dueDate) + 1) / totalDays) * 100;
  const left = Math.max(0, Math.min(100, rawLeft));
  const right = Math.max(0, Math.min(100, rawRight));
  const width = Math.max(0.5, right - left);
  return { left, width };
}

// Returns tasks that overlap with the given date range (inclusive on both ends).
// Overlap condition: task.startDate ≤ rangeEnd AND task.dueDate ≥ rangeStart
export function filterGanttTasks(tasks: Task[], rangeStart: string, rangeEnd: string): Task[] {
  return tasks.filter(t => t.startDate <= rangeEnd && t.dueDate >= rangeStart);
}
