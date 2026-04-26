import { describe, it, expect } from 'vitest';
import type { Task } from '../types';
import { dateToOffset, taskBarGeometry, filterGanttTasks } from './gantt';

// Range: May 1–30 (30 days). Position 0% = start of May 1; 100% = end of May 30.
const RANGE_START = '2026-05-01';
const TOTAL_DAYS = 30;

function makeTask(overrides: Partial<Task>): Task {
  return {
    id: 1,
    projectId: 1,
    workType: 'deep',
    title: 'Task',
    startDate: '2026-05-01',
    dueDate: '2026-05-10',
    flag: null,
    status: 'normal',
    completed: false,
    completedAt: null,
    createdAt: 0,
    ...overrides,
  };
}

// ─── dateToOffset ─────────────────────────────────────────────────────────────

describe('dateToOffset', () => {
  it('returns 0 for the range start date', () => {
    expect(dateToOffset('2026-05-01', RANGE_START, TOTAL_DAYS)).toBe(0);
  });

  it('returns 50 for a date halfway through the range', () => {
    // May 16 is 15 days after May 1; 15/30 * 100 = 50
    expect(dateToOffset('2026-05-16', RANGE_START, TOTAL_DAYS)).toBe(50);
  });

  it('returns 100 for a date one past the last day (end boundary)', () => {
    // May 31 is 30 days after May 1; 30/30 * 100 = 100
    expect(dateToOffset('2026-05-31', RANGE_START, TOTAL_DAYS)).toBe(100);
  });

  it('clamps to 0 for a date before the range', () => {
    expect(dateToOffset('2026-04-20', RANGE_START, TOTAL_DAYS)).toBe(0);
  });

  it('clamps to 100 for a date well after the range', () => {
    expect(dateToOffset('2026-07-01', RANGE_START, TOTAL_DAYS)).toBe(100);
  });

  it('returns 0 when totalDays is 0 (guard)', () => {
    expect(dateToOffset('2026-05-15', RANGE_START, 0)).toBe(0);
  });
});

// ─── taskBarGeometry ──────────────────────────────────────────────────────────

describe('taskBarGeometry', () => {
  it('returns correct geometry for a task in the first half of the range', () => {
    // May 1–15 (15 days): left=0, right=(14+1)/30*100=50, width=50
    const { left, width } = taskBarGeometry('2026-05-01', '2026-05-15', RANGE_START, TOTAL_DAYS);
    expect(left).toBe(0);
    expect(width).toBe(50);
  });

  it('returns correct geometry for a mid-range task', () => {
    // May 11–20 (10 days): left=10/30*100≈33.33, right=(19+1)/30*100≈66.67, width≈33.33
    const { left, width } = taskBarGeometry('2026-05-11', '2026-05-20', RANGE_START, TOTAL_DAYS);
    expect(left).toBeCloseTo(33.33, 1);
    expect(width).toBeCloseTo(33.33, 1);
  });

  it('clips a task that extends beyond range on both sides', () => {
    // Task Apr 1 – Jun 30: entirely encompasses range → left=0, width=100
    const { left, width } = taskBarGeometry('2026-04-01', '2026-06-30', RANGE_START, TOTAL_DAYS);
    expect(left).toBe(0);
    expect(width).toBe(100);
  });

  it('clips a task that starts before the range', () => {
    // Task Apr 20 – May 15: left clamped to 0, right=50 → width=50
    const { left, width } = taskBarGeometry('2026-04-20', '2026-05-15', RANGE_START, TOTAL_DAYS);
    expect(left).toBe(0);
    expect(width).toBe(50);
  });

  it('clips a task that ends after the range', () => {
    // Task May 16 – Jun 30: left=50, right clamped to 100 → width=50
    const { left, width } = taskBarGeometry('2026-05-16', '2026-06-30', RANGE_START, TOTAL_DAYS);
    expect(left).toBe(50);
    expect(width).toBe(50);
  });

  it('enforces minimum width of 0.5 for a single-day task on a large range', () => {
    // Single day (May 15) in a 365-day range: natural width ≈ 0.27 → clamped to 0.5
    const { width } = taskBarGeometry('2026-05-15', '2026-05-15', '2026-01-01', 365);
    expect(width).toBe(0.5);
  });

  it('returns { left: 0, width: 0 } when totalDays is 0', () => {
    const result = taskBarGeometry('2026-05-01', '2026-05-10', RANGE_START, 0);
    expect(result).toEqual({ left: 0, width: 0 });
  });
});

// ─── filterGanttTasks ────────────────────────────────────────────────────────

describe('filterGanttTasks', () => {
  const RANGE_END = '2026-05-30';

  it('includes a task fully inside the range', () => {
    const tasks = [makeTask({ startDate: '2026-05-10', dueDate: '2026-05-20' })];
    expect(filterGanttTasks(tasks, RANGE_START, RANGE_END)).toHaveLength(1);
  });

  it('excludes a task that ends before the range starts', () => {
    const tasks = [makeTask({ startDate: '2026-04-01', dueDate: '2026-04-30' })];
    expect(filterGanttTasks(tasks, RANGE_START, RANGE_END)).toHaveLength(0);
  });

  it('excludes a task that starts after the range ends', () => {
    const tasks = [makeTask({ startDate: '2026-06-01', dueDate: '2026-06-15' })];
    expect(filterGanttTasks(tasks, RANGE_START, RANGE_END)).toHaveLength(0);
  });

  it('includes a task that straddles the range start', () => {
    // startDate before range, dueDate inside range
    const tasks = [makeTask({ startDate: '2026-04-20', dueDate: '2026-05-15' })];
    expect(filterGanttTasks(tasks, RANGE_START, RANGE_END)).toHaveLength(1);
  });

  it('includes a task that straddles the range end', () => {
    // startDate inside range, dueDate after range
    const tasks = [makeTask({ startDate: '2026-05-20', dueDate: '2026-06-15' })];
    expect(filterGanttTasks(tasks, RANGE_START, RANGE_END)).toHaveLength(1);
  });

  it('includes a task that spans the entire range', () => {
    const tasks = [makeTask({ startDate: '2026-04-01', dueDate: '2026-06-30' })];
    expect(filterGanttTasks(tasks, RANGE_START, RANGE_END)).toHaveLength(1);
  });

  it('includes tasks touching range boundaries exactly', () => {
    const start = makeTask({ id: 1, startDate: '2026-04-01', dueDate: '2026-05-01' }); // dueDate = rangeStart
    const end = makeTask({ id: 2, startDate: '2026-05-30', dueDate: '2026-06-30' });   // startDate = rangeEnd
    const result = filterGanttTasks([start, end], RANGE_START, RANGE_END);
    expect(result).toHaveLength(2);
  });

  it('returns an empty array when no tasks are given', () => {
    expect(filterGanttTasks([], RANGE_START, RANGE_END)).toHaveLength(0);
  });

  it('filters a mixed list correctly', () => {
    const tasks = [
      makeTask({ id: 1, startDate: '2026-04-01', dueDate: '2026-04-30' }), // before → out
      makeTask({ id: 2, startDate: '2026-05-10', dueDate: '2026-05-20' }), // inside → in
      makeTask({ id: 3, startDate: '2026-06-01', dueDate: '2026-06-15' }), // after → out
      makeTask({ id: 4, startDate: '2026-04-20', dueDate: '2026-05-05' }), // straddles start → in
    ];
    const result = filterGanttTasks(tasks, RANGE_START, RANGE_END);
    expect(result).toHaveLength(2);
    expect(result.map(t => t.id).sort()).toEqual([2, 4]);
  });
});
