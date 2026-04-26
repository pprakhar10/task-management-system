import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Task } from '../types';
import { sortTasks, getDueDateStatus } from './tasks';

const FIXED_TODAY = '2026-05-01';

function makeTask(overrides: Partial<Task>): Task {
  return {
    id: 1,
    projectId: 1,
    workType: 'deep',
    title: 'Task',
    startDate: '2026-05-05',
    dueDate: '2026-05-10',
    flag: null,
    status: 'normal',
    completed: false,
    completedAt: null,
    createdAt: Date.now(),
    ...overrides,
  };
}

// ─── sortTasks ───────────────────────────────────────────────────────────────

describe('sortTasks — dueDate', () => {
  it('sorts ascending by due date', () => {
    const tasks = [
      makeTask({ id: 1, dueDate: '2026-05-10' }),
      makeTask({ id: 2, dueDate: '2026-05-01' }),
      makeTask({ id: 3, dueDate: '2026-05-20' }),
    ];
    const sorted = sortTasks(tasks, 'dueDate');
    expect(sorted.map(t => t.dueDate)).toEqual(['2026-05-01', '2026-05-10', '2026-05-20']);
  });

  it('does not mutate the original array', () => {
    const tasks = [
      makeTask({ id: 1, dueDate: '2026-05-10' }),
      makeTask({ id: 2, dueDate: '2026-05-01' }),
    ];
    const original = [...tasks];
    sortTasks(tasks, 'dueDate');
    expect(tasks).toEqual(original);
  });
});

describe('sortTasks — flag (priority)', () => {
  it('orders urgent before important before null', () => {
    const tasks = [
      makeTask({ id: 1, flag: null }),
      makeTask({ id: 2, flag: 'important' }),
      makeTask({ id: 3, flag: 'urgent' }),
    ];
    const sorted = sortTasks(tasks, 'flag');
    expect(sorted.map(t => t.flag)).toEqual(['urgent', 'important', null]);
  });

  it('treats null flag as lowest priority', () => {
    const tasks = [
      makeTask({ id: 1, flag: null }),
      makeTask({ id: 2, flag: null }),
      makeTask({ id: 3, flag: 'urgent' }),
    ];
    const sorted = sortTasks(tasks, 'flag');
    expect(sorted[0].flag).toBe('urgent');
    expect(sorted[1].flag).toBeNull();
    expect(sorted[2].flag).toBeNull();
  });
});

describe('sortTasks — status (current)', () => {
  it('orders currently_working before morning_meeting before normal', () => {
    const tasks = [
      makeTask({ id: 1, status: 'normal' }),
      makeTask({ id: 2, status: 'morning_meeting' }),
      makeTask({ id: 3, status: 'currently_working' }),
    ];
    const sorted = sortTasks(tasks, 'status');
    expect(sorted.map(t => t.status)).toEqual([
      'currently_working',
      'morning_meeting',
      'normal',
    ]);
  });
});

describe('sortTasks — edge cases', () => {
  it('returns empty array unchanged', () => {
    expect(sortTasks([], 'dueDate')).toEqual([]);
  });

  it('returns single-element array unchanged', () => {
    const tasks = [makeTask({ id: 1 })];
    expect(sortTasks(tasks, 'flag')).toHaveLength(1);
  });
});

// ─── getDueDateStatus ─────────────────────────────────────────────────────────

describe('getDueDateStatus', () => {
  beforeEach(() => {
    vi.setSystemTime(new Date(FIXED_TODAY));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns overdue for a date in the past', () => {
    expect(getDueDateStatus('2026-04-30', false)).toBe('overdue');
    expect(getDueDateStatus('2026-01-01', false)).toBe('overdue');
  });

  it('returns due_today for today\'s date', () => {
    expect(getDueDateStatus(FIXED_TODAY, false)).toBe('due_today');
  });

  it('returns normal for a future date', () => {
    expect(getDueDateStatus('2026-05-02', false)).toBe('normal');
    expect(getDueDateStatus('2026-12-31', false)).toBe('normal');
  });

  it('returns normal for a completed task regardless of date', () => {
    expect(getDueDateStatus('2026-04-30', true)).toBe('normal');
    expect(getDueDateStatus(FIXED_TODAY, true)).toBe('normal');
    expect(getDueDateStatus('2026-05-10', true)).toBe('normal');
  });
});
