import Dexie, { type EntityTable } from 'dexie';
import type { Category, Project, Task, Subtask, CalendarBlock, Settings } from '../types';

const DEFAULT_SETTINGS: Omit<Settings, 'id'> = {
  workDayStart: '09:15',
  workDayEnd: '18:00',
  defaultBreakStart: '13:00',
  defaultBreakEnd: '14:15',
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
    this.on('populate', () => {
      this.settings.add(DEFAULT_SETTINGS as Settings);
    });
  }
}

export const db = new AppDatabase();
