import { db } from './database';
import type { Category, Project, Task, Subtask, CalendarBlock, Settings } from '../types';

// ─── Categories ─────────────────────────────────────────────────────────────

export async function createCategory(name: string): Promise<Category> {
  const entity = { name, createdAt: Date.now() };
  const id = await db.categories.add(entity as Category);
  return { ...entity, id: id as number };
}

export async function getCategories(): Promise<Category[]> {
  return db.categories.toArray();
}

export async function getCategoryById(id: number): Promise<Category | undefined> {
  return db.categories.get(id);
}

export async function updateCategory(id: number, changes: Pick<Category, 'name'>): Promise<void> {
  await db.categories.update(id, changes);
}

export async function deleteCategory(id: number): Promise<void> {
  await db.transaction('rw', db.categories, db.projects, db.tasks, db.subtasks, async () => {
    const projects = await db.projects.where('categoryId').equals(id).toArray();
    const projectIds = projects.map(p => p.id as number);
    if (projectIds.length > 0) {
      const tasks = await db.tasks.where('projectId').anyOf(projectIds).toArray();
      const taskIds = tasks.map(t => t.id as number);
      if (taskIds.length > 0) {
        await db.subtasks.where('taskId').anyOf(taskIds).delete();
      }
      await db.tasks.where('projectId').anyOf(projectIds).delete();
    }
    await db.projects.where('categoryId').equals(id).delete();
    await db.categories.delete(id);
  });
}

// ─── Projects ────────────────────────────────────────────────────────────────

export async function createProject(categoryId: number, name: string): Promise<Project> {
  const entity = { categoryId, name, createdAt: Date.now() };
  const id = await db.projects.add(entity as Project);
  return { ...entity, id: id as number };
}

export async function getProjects(): Promise<Project[]> {
  return db.projects.toArray();
}

export async function getProjectsByCategory(categoryId: number): Promise<Project[]> {
  return db.projects.where('categoryId').equals(categoryId).toArray();
}

export async function getProjectById(id: number): Promise<Project | undefined> {
  return db.projects.get(id);
}

export async function updateProject(id: number, changes: Pick<Project, 'name'>): Promise<void> {
  await db.projects.update(id, changes);
}

export async function deleteProject(id: number): Promise<void> {
  await db.transaction('rw', db.projects, db.tasks, db.subtasks, async () => {
    const tasks = await db.tasks.where('projectId').equals(id).toArray();
    const taskIds = tasks.map(t => t.id as number);
    if (taskIds.length > 0) {
      await db.subtasks.where('taskId').anyOf(taskIds).delete();
    }
    await db.tasks.where('projectId').equals(id).delete();
    await db.projects.delete(id);
  });
}

// ─── Tasks ───────────────────────────────────────────────────────────────────

type CreateTaskInput = Omit<Task, 'id' | 'createdAt'>;

export async function createTask(input: CreateTaskInput): Promise<Task> {
  const entity = { ...input, createdAt: Date.now() };
  const id = await db.tasks.add(entity as Task);
  return { ...entity, id: id as number };
}

export async function getTasks(): Promise<Task[]> {
  return db.tasks.toArray();
}

export async function getTasksByProject(projectId: number): Promise<Task[]> {
  return db.tasks.where('projectId').equals(projectId).toArray();
}

export async function getTaskById(id: number): Promise<Task | undefined> {
  return db.tasks.get(id);
}

export async function updateTask(
  id: number,
  changes: Partial<Omit<Task, 'id' | 'createdAt'>>,
): Promise<void> {
  await db.tasks.update(id, changes);
}

export async function completeTask(id: number): Promise<void> {
  await db.tasks.update(id, {
    completed: true,
    completedAt: Date.now(),
    status: 'normal',
  });
}

export async function deleteTask(id: number): Promise<void> {
  await db.transaction('rw', db.tasks, db.subtasks, async () => {
    await db.subtasks.where('taskId').equals(id).delete();
    await db.tasks.delete(id);
  });
}

// ─── Subtasks ────────────────────────────────────────────────────────────────

type CreateSubtaskInput = Omit<Subtask, 'id' | 'createdAt'>;

export async function createSubtask(input: CreateSubtaskInput): Promise<Subtask> {
  const entity = { ...input, createdAt: Date.now() };
  const id = await db.subtasks.add(entity as Subtask);
  return { ...entity, id: id as number };
}

export async function getSubtasks(): Promise<Subtask[]> {
  return db.subtasks.toArray();
}

export async function getSubtasksByTask(taskId: number): Promise<Subtask[]> {
  return db.subtasks.where('taskId').equals(taskId).toArray();
}

export async function getSubtaskById(id: number): Promise<Subtask | undefined> {
  return db.subtasks.get(id);
}

export async function updateSubtask(
  id: number,
  changes: Partial<Omit<Subtask, 'id' | 'createdAt'>>,
): Promise<void> {
  await db.subtasks.update(id, changes);
}

export async function completeSubtask(id: number): Promise<void> {
  await db.subtasks.update(id, { completed: true, completedAt: Date.now() });
}

export async function deleteSubtask(id: number): Promise<void> {
  await db.subtasks.delete(id);
}

// ─── Calendar Blocks ─────────────────────────────────────────────────────────

type CreateCalendarBlockInput = Omit<CalendarBlock, 'id' | 'createdAt'>;

export async function createCalendarBlock(input: CreateCalendarBlockInput): Promise<CalendarBlock> {
  const entity = { ...input, createdAt: Date.now() };
  const id = await db.calendarBlocks.add(entity as CalendarBlock);
  return { ...entity, id: id as number };
}

export async function getCalendarBlocks(): Promise<CalendarBlock[]> {
  return db.calendarBlocks.toArray();
}

export async function getCalendarBlocksByDate(date: string): Promise<CalendarBlock[]> {
  return db.calendarBlocks.where('date').equals(date).toArray();
}

export async function getCalendarBlocksByDateRange(
  startDate: string,
  endDate: string,
): Promise<CalendarBlock[]> {
  return db.calendarBlocks.where('date').between(startDate, endDate, true, true).toArray();
}

export async function getCalendarBlockById(id: number): Promise<CalendarBlock | undefined> {
  return db.calendarBlocks.get(id);
}

export async function updateCalendarBlock(
  id: number,
  changes: Partial<Omit<CalendarBlock, 'id' | 'createdAt'>>,
): Promise<void> {
  await db.calendarBlocks.update(id, changes);
}

export async function deleteCalendarBlock(id: number): Promise<void> {
  await db.calendarBlocks.delete(id);
}

// ─── Settings ────────────────────────────────────────────────────────────────

export async function getSettings(): Promise<Settings> {
  const settings = await db.settings.toCollection().first();
  if (!settings) {
    throw new Error('Settings not found — database was not seeded correctly');
  }
  return settings;
}

export async function updateSettings(changes: Partial<Omit<Settings, 'id'>>): Promise<void> {
  const settings = await getSettings();
  await db.settings.update(settings.id as number, changes);
}
