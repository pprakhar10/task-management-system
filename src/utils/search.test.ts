import { describe, it, expect } from 'vitest';
import { filterTasks } from './search';
import type { SearchFilters } from './search';
import type { Task, Project } from '../types';

function makeTask(overrides: Partial<Task>): Task {
  return {
    id: 1,
    projectId: 1,
    workType: 'deep',
    title: 'Test task',
    startDate: '2026-04-19',
    dueDate: '2026-04-22',
    flag: null,
    status: 'normal',
    completed: false,
    completedAt: null,
    createdAt: Date.now(),
    ...overrides,
  };
}

function makeProject(overrides: Partial<Project>): Project {
  return {
    id: 1,
    categoryId: 1,
    name: 'Project A',
    sortOrder: 0,
    isPrivate: false,
    createdAt: Date.now(),
    ...overrides,
  };
}

const projects: Project[] = [
  makeProject({ id: 1, categoryId: 1 }),
  makeProject({ id: 2, categoryId: 2 }),
];

const DEFAULT: SearchFilters = {
  query: '',
  completedFilter: 'all',
  categoryId: null,
  projectId: null,
  workType: null,
  flag: null,
  dueFilter: 'all',
};

describe('filterTasks', () => {
  it('returns all tasks when no filters applied', () => {
    const tasks = [makeTask({ id: 1 }), makeTask({ id: 2 })];
    expect(filterTasks(tasks, projects, DEFAULT)).toHaveLength(2);
  });

  it('filters by text query (case insensitive)', () => {
    const tasks = [
      makeTask({ id: 1, title: 'Fix login bug' }),
      makeTask({ id: 2, title: 'Update dashboard' }),
    ];
    const result = filterTasks(tasks, projects, { ...DEFAULT, query: 'LOGIN' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });

  it('returns empty when query matches nothing', () => {
    const tasks = [makeTask({ id: 1, title: 'Fix login bug' })];
    expect(filterTasks(tasks, projects, { ...DEFAULT, query: 'xyz' })).toHaveLength(0);
  });

  it('shows only active tasks when completedFilter is active', () => {
    const tasks = [
      makeTask({ id: 1, completed: false }),
      makeTask({ id: 2, completed: true }),
    ];
    const result = filterTasks(tasks, projects, { ...DEFAULT, completedFilter: 'active' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });

  it('shows only completed tasks when completedFilter is completed', () => {
    const tasks = [
      makeTask({ id: 1, completed: false }),
      makeTask({ id: 2, completed: true }),
    ];
    const result = filterTasks(tasks, projects, { ...DEFAULT, completedFilter: 'completed' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(2);
  });

  it('shows both active and completed when completedFilter is all', () => {
    const tasks = [
      makeTask({ id: 1, completed: false }),
      makeTask({ id: 2, completed: true }),
    ];
    expect(filterTasks(tasks, projects, { ...DEFAULT, completedFilter: 'all' })).toHaveLength(2);
  });

  it('filters by project', () => {
    const tasks = [
      makeTask({ id: 1, projectId: 1 }),
      makeTask({ id: 2, projectId: 2 }),
    ];
    const result = filterTasks(tasks, projects, { ...DEFAULT, projectId: 1 });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });

  it('filters by category', () => {
    const tasks = [
      makeTask({ id: 1, projectId: 1 }), // categoryId 1
      makeTask({ id: 2, projectId: 2 }), // categoryId 2
    ];
    const result = filterTasks(tasks, projects, { ...DEFAULT, categoryId: 1 });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });

  it('project filter takes precedence over category filter', () => {
    const tasks = [
      makeTask({ id: 1, projectId: 1 }), // categoryId 1
      makeTask({ id: 2, projectId: 2 }), // categoryId 2
    ];
    const result = filterTasks(tasks, projects, { ...DEFAULT, categoryId: 1, projectId: 2 });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(2);
  });

  it('filters by work type', () => {
    const tasks = [
      makeTask({ id: 1, workType: 'deep' }),
      makeTask({ id: 2, workType: 'shallow' }),
    ];
    const result = filterTasks(tasks, projects, { ...DEFAULT, workType: 'deep' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });

  it('filters by flag type', () => {
    const tasks = [
      makeTask({ id: 1, flag: 'urgent' }),
      makeTask({ id: 2, flag: 'important' }),
      makeTask({ id: 3, flag: null }),
    ];
    const result = filterTasks(tasks, projects, { ...DEFAULT, flag: 'urgent' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });

  it('filters tasks with no flag when flag filter is "none"', () => {
    const tasks = [
      makeTask({ id: 1, flag: 'urgent' }),
      makeTask({ id: 2, flag: null }),
    ];
    const result = filterTasks(tasks, projects, { ...DEFAULT, flag: 'none' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(2);
  });

  it('applies multiple filters together', () => {
    const tasks = [
      makeTask({ id: 1, workType: 'deep', flag: 'urgent', completed: false }),
      makeTask({ id: 2, workType: 'deep', flag: null, completed: false }),
      makeTask({ id: 3, workType: 'shallow', flag: 'urgent', completed: false }),
      makeTask({ id: 4, workType: 'deep', flag: 'urgent', completed: true }),
    ];
    const result = filterTasks(tasks, projects, {
      ...DEFAULT,
      workType: 'deep',
      flag: 'urgent',
      completedFilter: 'active',
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });

  describe('dueFilter', () => {
    const TODAY = '2026-05-01';
    const tasks = [
      makeTask({ id: 1, dueDate: '2026-04-30' }), // past
      makeTask({ id: 2, dueDate: '2026-05-01' }), // today
      makeTask({ id: 3, dueDate: '2026-05-02' }), // later
    ];

    it('"all" returns every task', () => {
      expect(filterTasks(tasks, projects, { ...DEFAULT, dueFilter: 'all' }, TODAY)).toHaveLength(3);
    });

    it('"past_due" returns only tasks with dueDate before today', () => {
      const result = filterTasks(tasks, projects, { ...DEFAULT, dueFilter: 'past_due' }, TODAY);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
    });

    it('"today" returns only tasks due today', () => {
      const result = filterTasks(tasks, projects, { ...DEFAULT, dueFilter: 'today' }, TODAY);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(2);
    });

    it('"later" returns only tasks with dueDate after today', () => {
      const result = filterTasks(tasks, projects, { ...DEFAULT, dueFilter: 'later' }, TODAY);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(3);
    });

    it('dueFilter combines with other filters', () => {
      const mixed = [
        makeTask({ id: 1, dueDate: '2026-04-30', workType: 'deep' }),
        makeTask({ id: 2, dueDate: '2026-04-30', workType: 'shallow' }),
        makeTask({ id: 3, dueDate: '2026-05-02', workType: 'deep' }),
      ];
      const result = filterTasks(mixed, projects, { ...DEFAULT, dueFilter: 'past_due', workType: 'deep' }, TODAY);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
    });
  });
});
