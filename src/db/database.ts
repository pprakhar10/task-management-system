import Dexie, { type EntityTable } from 'dexie';
import type { Category, Project, Task, Subtask, CalendarBlock, Settings, LeaveDay } from '../types';

const DEFAULT_SETTINGS: Omit<Settings, 'id'> = {
  workDayStart: '09:15',
  workDayEnd: '18:00',
  defaultBreakStart: '13:00',
  defaultBreakEnd: '14:15',
  standupStart: '09:15',
  standupEnd: '09:45',
  theme: 'light',
  lastBackupAt: null,
  backupReminderDays: 7,
};

export class AppDatabase extends Dexie {
  categories!: EntityTable<Category, 'id'>;
  projects!: EntityTable<Project, 'id'>;
  tasks!: EntityTable<Task, 'id'>;
  subtasks!: EntityTable<Subtask, 'id'>;
  calendarBlocks!: EntityTable<CalendarBlock, 'id'>;
  settings!: EntityTable<Settings, 'id'>;
  leaveDays!: EntityTable<LeaveDay, 'id'>;

  constructor() {
    super('TaskManagementDB');
    this.version(1).stores({
      categories: '++id',
      projects: '++id, categoryId',
      tasks: '++id, projectId, status, completed, dueDate',
      subtasks: '++id, taskId',
      calendarBlocks: '++id, date, taskId',
      settings: '++id',
    });
    this.version(2).stores({
      categories: '++id',
      projects: '++id, categoryId',
      tasks: '++id, projectId, status, completed, dueDate',
      subtasks: '++id, taskId',
      calendarBlocks: '++id, date, taskId',
      settings: '++id',
    }).upgrade(tx =>
      tx.table('settings').toCollection().modify((s: Settings) => {
        if (s.standupStart === undefined) s.standupStart = '09:15';
        if (s.standupEnd === undefined) s.standupEnd = '09:45';
      }),
    );
    this.version(3).stores({
      categories: '++id',
      projects: '++id, categoryId',
      tasks: '++id, projectId, status, completed, dueDate',
      subtasks: '++id, taskId',
      calendarBlocks: '++id, date, taskId',
      settings: '++id',
      leaveDays: '++id, date',
    });
    this.version(4).stores({
      categories: '++id',
      projects: '++id, categoryId',
      tasks: '++id, projectId, status, completed, dueDate',
      subtasks: '++id, taskId',
      calendarBlocks: '++id, date, taskId',
      settings: '++id',
      leaveDays: '++id, date',
    }).upgrade(tx =>
      tx.table('tasks').toCollection().modify((task: Task) => {
        if (!task.startDate) task.startDate = new Date(task.createdAt).toISOString().split('T')[0];
      }),
    );
    this.version(5).stores({
      categories: '++id, sortOrder',
      projects: '++id, categoryId, sortOrder',
      tasks: '++id, projectId, status, completed, dueDate',
      subtasks: '++id, taskId, sortOrder',
      calendarBlocks: '++id, date, taskId',
      settings: '++id',
      leaveDays: '++id, date',
    }).upgrade(async tx => {
      const cats = await tx.table('categories').orderBy('id').toArray();
      await Promise.all(cats.map((c: Category, i: number) => tx.table('categories').update(c.id, { sortOrder: i })));
      const projs = await tx.table('projects').orderBy('id').toArray();
      await Promise.all(projs.map((p: Project, i: number) => tx.table('projects').update(p.id, { sortOrder: i })));
      const subs = await tx.table('subtasks').orderBy('id').toArray();
      await Promise.all(subs.map((s: Subtask, i: number) => tx.table('subtasks').update(s.id, { sortOrder: i })));
    });
    this.version(6).stores({
      categories: '++id, sortOrder',
      projects: '++id, categoryId, sortOrder',
      tasks: '++id, projectId, status, completed, dueDate',
      subtasks: '++id, taskId, sortOrder',
      calendarBlocks: '++id, date, taskId',
      settings: '++id',
      leaveDays: '++id, date',
    }).upgrade(tx =>
      tx.table('calendarBlocks').toCollection().modify((b: CalendarBlock) => {
        if (b.projectId === undefined) b.projectId = null;
      }),
    );
    this.on('populate', () => {
      this.settings.add(DEFAULT_SETTINGS as Settings);
    });
  }
}

export const db = new AppDatabase();
