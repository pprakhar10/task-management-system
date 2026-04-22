import { db } from './database';
import { getSettings, updateSettings } from './crud';
import type { Category, Project, Task, Subtask, CalendarBlock, Settings } from '../types';

interface DBSnapshot {
  categories: Category[];
  projects: Project[];
  tasks: Task[];
  subtasks: Subtask[];
  calendarBlocks: CalendarBlock[];
  settings: Settings[];
}

export async function exportDB(): Promise<string> {
  await updateSettings({ lastBackupAt: Date.now() });
  const snapshot: DBSnapshot = {
    categories: await db.categories.toArray(),
    projects: await db.projects.toArray(),
    tasks: await db.tasks.toArray(),
    subtasks: await db.subtasks.toArray(),
    calendarBlocks: await db.calendarBlocks.toArray(),
    settings: await db.settings.toArray(),
  };
  return JSON.stringify(snapshot, null, 2);
}

export async function importDB(json: string): Promise<void> {
  const snapshot: DBSnapshot = JSON.parse(json);
  await db.transaction(
    'rw',
    [db.categories, db.projects, db.tasks, db.subtasks, db.calendarBlocks, db.settings],
    async () => {
      await db.categories.clear();
      await db.projects.clear();
      await db.tasks.clear();
      await db.subtasks.clear();
      await db.calendarBlocks.clear();
      await db.settings.clear();

      if (snapshot.categories.length > 0) await db.categories.bulkAdd(snapshot.categories);
      if (snapshot.projects.length > 0) await db.projects.bulkAdd(snapshot.projects);
      if (snapshot.tasks.length > 0) await db.tasks.bulkAdd(snapshot.tasks);
      if (snapshot.subtasks.length > 0) await db.subtasks.bulkAdd(snapshot.subtasks);
      if (snapshot.calendarBlocks.length > 0) await db.calendarBlocks.bulkAdd(snapshot.calendarBlocks);
      if (snapshot.settings.length > 0) await db.settings.bulkAdd(snapshot.settings);
    },
  );
}

export async function shouldPromptBackup(): Promise<boolean> {
  const settings = await getSettings();
  if (settings.lastBackupAt === null) return true;
  const msPerDay = 86_400_000;
  return Date.now() - settings.lastBackupAt > settings.backupReminderDays * msPerDay;
}
