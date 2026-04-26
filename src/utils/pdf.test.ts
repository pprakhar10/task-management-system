import { describe, it, expect } from 'vitest';
import { groupTasksForReport, filterCompletedInRange } from './pdf';
import type { Task, Subtask, Project, Category } from '../types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeCategory(id: number, name: string): Category {
  return { id, name, createdAt: 0 };
}

function makeProject(id: number, categoryId: number, name: string): Project {
  return { id, categoryId, name, createdAt: 0 };
}

function makeTask(id: number, projectId: number, overrides: Partial<Task> = {}): Task {
  return {
    id,
    projectId,
    workType: 'deep',
    title: `Task ${id}`,
    startDate: '2026-04-22',
    dueDate: '2026-04-25',
    flag: null,
    status: 'normal',
    completed: false,
    completedAt: null,
    createdAt: 0,
    ...overrides,
  };
}

function makeSubtask(id: number, taskId: number, completed = false): Subtask {
  return {
    id,
    taskId,
    title: `Subtask ${id}`,
    dueDate: null,
    completed,
    completedAt: completed ? 1000 : null,
    createdAt: 0,
  };
}

// ── groupTasksForReport ────────────────────────────────────────────────────────

describe('groupTasksForReport', () => {
  it('returns empty array when there are no tasks', () => {
    expect(groupTasksForReport([], [], [], [])).toEqual([]);
  });

  it('groups a single task under its category and project', () => {
    const cats = [makeCategory(1, 'Work')];
    const projs = [makeProject(10, 1, 'Alpha')];
    const tasks = [makeTask(100, 10, { title: 'Do the thing' })];

    const result = groupTasksForReport(tasks, [], projs, cats);

    expect(result).toHaveLength(1);
    expect(result[0].categoryName).toBe('Work');
    expect(result[0].projects).toHaveLength(1);
    expect(result[0].projects[0].projectName).toBe('Alpha');
    expect(result[0].projects[0].tasks).toHaveLength(1);
    expect(result[0].projects[0].tasks[0].title).toBe('Do the thing');
  });

  it('groups multiple tasks in the same project together', () => {
    const cats = [makeCategory(1, 'Work')];
    const projs = [makeProject(10, 1, 'Alpha')];
    const tasks = [makeTask(1, 10), makeTask(2, 10)];

    const result = groupTasksForReport(tasks, [], projs, cats);

    expect(result).toHaveLength(1);
    expect(result[0].projects[0].tasks).toHaveLength(2);
  });

  it('groups tasks in different projects under the same category', () => {
    const cats = [makeCategory(1, 'Work')];
    const projs = [makeProject(10, 1, 'Alpha'), makeProject(11, 1, 'Beta')];
    const tasks = [makeTask(1, 10), makeTask(2, 11)];

    const result = groupTasksForReport(tasks, [], projs, cats);

    expect(result).toHaveLength(1);
    expect(result[0].projects).toHaveLength(2);
  });

  it('creates separate category groups for different categories', () => {
    const cats = [makeCategory(1, 'Work'), makeCategory(2, 'Personal')];
    const projs = [makeProject(10, 1, 'Alpha'), makeProject(20, 2, 'Home')];
    const tasks = [makeTask(1, 10), makeTask(2, 20)];

    const result = groupTasksForReport(tasks, [], projs, cats);

    expect(result).toHaveLength(2);
    const names = result.map(g => g.categoryName);
    expect(names).toContain('Work');
    expect(names).toContain('Personal');
  });

  it('excludes tasks whose projectId has no matching project', () => {
    const cats = [makeCategory(1, 'Work')];
    const tasks = [makeTask(1, 999)];

    const result = groupTasksForReport(tasks, [], [], cats);

    expect(result).toHaveLength(0);
  });

  it('includes both completed and incomplete subtasks under the task', () => {
    const cats = [makeCategory(1, 'Work')];
    const projs = [makeProject(10, 1, 'Alpha')];
    const tasks = [makeTask(1, 10)];
    const subs = [makeSubtask(1, 1, false), makeSubtask(2, 1, true)];

    const result = groupTasksForReport(tasks, subs, projs, cats);

    const taskEntry = result[0].projects[0].tasks[0];
    expect(taskEntry.subtasks).toHaveLength(2);
    expect(taskEntry.subtasks[0].completed).toBe(false);
    expect(taskEntry.subtasks[1].completed).toBe(true);
  });

  it('does not include subtasks belonging to other tasks', () => {
    const cats = [makeCategory(1, 'Work')];
    const projs = [makeProject(10, 1, 'Alpha')];
    const tasks = [makeTask(1, 10)];
    const subs = [makeSubtask(1, 99)]; // taskId 99 ≠ task 1

    const result = groupTasksForReport(tasks, subs, projs, cats);

    expect(result[0].projects[0].tasks[0].subtasks).toHaveLength(0);
  });

  it('preserves the dueDate field on task entries', () => {
    const cats = [makeCategory(1, 'Work')];
    const projs = [makeProject(10, 1, 'Alpha')];
    const tasks = [makeTask(1, 10, { dueDate: '2026-05-01' })];

    const result = groupTasksForReport(tasks, [], projs, cats);

    expect(result[0].projects[0].tasks[0].dueDate).toBe('2026-05-01');
  });
});

// ── filterCompletedInRange ────────────────────────────────────────────────────

describe('filterCompletedInRange', () => {
  const start = new Date('2026-04-21T00:00:00').getTime(); // Mon
  const end = new Date('2026-04-25T23:59:59').getTime();   // Fri

  it('returns empty array when there are no tasks', () => {
    expect(filterCompletedInRange([], start, end)).toHaveLength(0);
  });

  it('includes tasks completed within the range', () => {
    const tasks = [makeTask(1, 1, { completedAt: new Date('2026-04-23T10:00:00').getTime() })];
    expect(filterCompletedInRange(tasks, start, end)).toHaveLength(1);
  });

  it('includes tasks completed exactly at range start', () => {
    const tasks = [makeTask(1, 1, { completedAt: start })];
    expect(filterCompletedInRange(tasks, start, end)).toHaveLength(1);
  });

  it('includes tasks completed exactly at range end', () => {
    const tasks = [makeTask(1, 1, { completedAt: end })];
    expect(filterCompletedInRange(tasks, start, end)).toHaveLength(1);
  });

  it('excludes tasks completed before the range', () => {
    const tasks = [makeTask(1, 1, { completedAt: start - 1 })];
    expect(filterCompletedInRange(tasks, start, end)).toHaveLength(0);
  });

  it('excludes tasks completed after the range', () => {
    const tasks = [makeTask(1, 1, { completedAt: end + 1 })];
    expect(filterCompletedInRange(tasks, start, end)).toHaveLength(0);
  });

  it('excludes tasks with null completedAt', () => {
    const tasks = [makeTask(1, 1, { completedAt: null })];
    expect(filterCompletedInRange(tasks, start, end)).toHaveLength(0);
  });

  it('handles a mix of in-range and out-of-range tasks', () => {
    const tasks = [
      makeTask(1, 1, { completedAt: new Date('2026-04-23').getTime() }), // in range
      makeTask(2, 1, { completedAt: new Date('2026-04-20').getTime() }), // before
      makeTask(3, 1, { completedAt: null }),                             // no date
      makeTask(4, 1, { completedAt: new Date('2026-04-24').getTime() }), // in range
    ];
    const result = filterCompletedInRange(tasks, start, end);
    expect(result).toHaveLength(2);
    expect(result.map(t => t.id)).toEqual([1, 4]);
  });
});
