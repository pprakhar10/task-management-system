import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { db } from './database';
import {
  createCategory, getCategories, getCategoryById, updateCategory, deleteCategory,
  createProject, getProjects, getProjectsByCategory, getProjectById, updateProject, deleteProject,
  createTask, getTasks, getTasksByProject, getTaskById, updateTask, completeTask, deleteTask,
  createSubtask, getSubtasks, getSubtasksByTask, getSubtaskById, updateSubtask, completeSubtask, deleteSubtask,
  createCalendarBlock, getCalendarBlocksByDate, getCalendarBlocksByDateRange,
  getCalendarBlockById, updateCalendarBlock, deleteCalendarBlock,
  getSettings, updateSettings,
  addLeaveDay, removeLeaveDay, getLeaveDays, getLeaveDaysByDateRange,
} from './crud';
import { exportDB, importDB, shouldPromptBackup } from './backup';

beforeEach(async () => {
  await db.open();
});

afterEach(async () => {
  await db.delete();
});

// ─── Categories ──────────────────────────────────────────────────────────────

describe('Category CRUD', () => {
  it('creates a category and retrieves it', async () => {
    const cat = await createCategory('ESG');
    expect(cat.id).toBeDefined();
    expect(cat.name).toBe('ESG');
    expect(cat.createdAt).toBeGreaterThan(0);
  });

  it('getCategories returns all created categories', async () => {
    await createCategory('A');
    await createCategory('B');
    const all = await getCategories();
    expect(all).toHaveLength(2);
  });

  it('getCategoryById returns the correct category', async () => {
    const cat = await createCategory('Finance');
    const found = await getCategoryById(cat.id);
    expect(found?.name).toBe('Finance');
  });

  it('getCategoryById returns undefined for unknown id', async () => {
    const found = await getCategoryById(9999);
    expect(found).toBeUndefined();
  });

  it('updateCategory changes the name', async () => {
    const cat = await createCategory('Old Name');
    await updateCategory(cat.id, { name: 'New Name' });
    const updated = await getCategoryById(cat.id);
    expect(updated?.name).toBe('New Name');
  });

  it('deleteCategory removes the category', async () => {
    const cat = await createCategory('To Delete');
    await deleteCategory(cat.id);
    const found = await getCategoryById(cat.id);
    expect(found).toBeUndefined();
  });

  it('deleteCategory cascades to projects, tasks, and subtasks', async () => {
    const cat = await createCategory('Cascade');
    const proj = await createProject(cat.id, 'Proj');
    const task = await createTask({
      projectId: proj.id, workType: 'deep', title: 'T', dueDate: '2026-05-01',
      flag: null, status: 'normal', completed: false, completedAt: null,
    });
    await createSubtask({ taskId: task.id, title: 'Sub', dueDate: null, completed: false, completedAt: null });

    await deleteCategory(cat.id);

    expect(await getProjects()).toHaveLength(0);
    expect(await getTasks()).toHaveLength(0);
    expect(await getSubtasks()).toHaveLength(0);
  });
});

// ─── Projects ────────────────────────────────────────────────────────────────

describe('Project CRUD', () => {
  it('creates a project and retrieves it', async () => {
    const cat = await createCategory('Cat');
    const proj = await createProject(cat.id, 'Dashboard');
    expect(proj.id).toBeDefined();
    expect(proj.categoryId).toBe(cat.id);
    expect(proj.name).toBe('Dashboard');
  });

  it('getProjectsByCategory filters correctly', async () => {
    const catA = await createCategory('A');
    const catB = await createCategory('B');
    await createProject(catA.id, 'P1');
    await createProject(catA.id, 'P2');
    await createProject(catB.id, 'P3');
    const results = await getProjectsByCategory(catA.id);
    expect(results).toHaveLength(2);
    expect(results.every(p => p.categoryId === catA.id)).toBe(true);
  });

  it('getProjectById returns undefined for unknown id', async () => {
    expect(await getProjectById(9999)).toBeUndefined();
  });

  it('updateProject changes the name', async () => {
    const cat = await createCategory('Cat');
    const proj = await createProject(cat.id, 'Old');
    await updateProject(proj.id, { name: 'New' });
    expect((await getProjectById(proj.id))?.name).toBe('New');
  });

  it('deleteProject cascades to tasks and subtasks', async () => {
    const cat = await createCategory('Cat');
    const proj = await createProject(cat.id, 'Proj');
    const task = await createTask({
      projectId: proj.id, workType: 'deep', title: 'T', dueDate: '2026-05-01',
      flag: null, status: 'normal', completed: false, completedAt: null,
    });
    await createSubtask({ taskId: task.id, title: 'Sub', dueDate: null, completed: false, completedAt: null });

    await deleteProject(proj.id);

    expect(await getTasks()).toHaveLength(0);
    expect(await getSubtasks()).toHaveLength(0);
    expect(await getProjectById(proj.id)).toBeUndefined();
  });
});

// ─── Tasks ───────────────────────────────────────────────────────────────────

describe('Task CRUD', () => {
  it('creates a task and retrieves it', async () => {
    const cat = await createCategory('Cat');
    const proj = await createProject(cat.id, 'Proj');
    const task = await createTask({
      projectId: proj.id, workType: 'deep', title: 'My Task', dueDate: '2026-05-01',
      flag: 'urgent', status: 'normal', completed: false, completedAt: null,
    });
    expect(task.id).toBeDefined();
    expect(task.title).toBe('My Task');
    expect(task.flag).toBe('urgent');
  });

  it('getTasksByProject returns only tasks for that project', async () => {
    const cat = await createCategory('Cat');
    const p1 = await createProject(cat.id, 'P1');
    const p2 = await createProject(cat.id, 'P2');
    await createTask({ projectId: p1.id, workType: 'deep', title: 'T1', dueDate: '2026-05-01', flag: null, status: 'normal', completed: false, completedAt: null });
    await createTask({ projectId: p1.id, workType: 'shallow', title: 'T2', dueDate: '2026-05-01', flag: null, status: 'normal', completed: false, completedAt: null });
    await createTask({ projectId: p2.id, workType: 'deep', title: 'T3', dueDate: '2026-05-01', flag: null, status: 'normal', completed: false, completedAt: null });

    const p1tasks = await getTasksByProject(p1.id);
    expect(p1tasks).toHaveLength(2);
    expect(p1tasks.every(t => t.projectId === p1.id)).toBe(true);
  });

  it('getTaskById returns undefined for unknown id', async () => {
    expect(await getTaskById(9999)).toBeUndefined();
  });

  it('updateTask persists changes', async () => {
    const cat = await createCategory('Cat');
    const proj = await createProject(cat.id, 'Proj');
    const task = await createTask({
      projectId: proj.id, workType: 'deep', title: 'Original', dueDate: '2026-05-01',
      flag: null, status: 'normal', completed: false, completedAt: null,
    });
    await updateTask(task.id, { title: 'Updated', flag: 'important', status: 'currently_working' });
    const updated = await getTaskById(task.id);
    expect(updated?.title).toBe('Updated');
    expect(updated?.flag).toBe('important');
    expect(updated?.status).toBe('currently_working');
  });

  it('completeTask marks completed, resets status, sets completedAt', async () => {
    const cat = await createCategory('Cat');
    const proj = await createProject(cat.id, 'Proj');
    const task = await createTask({
      projectId: proj.id, workType: 'deep', title: 'T', dueDate: '2026-05-01',
      flag: null, status: 'currently_working', completed: false, completedAt: null,
    });
    await completeTask(task.id);
    const completed = await getTaskById(task.id);
    expect(completed?.completed).toBe(true);
    expect(completed?.completedAt).toBeGreaterThan(0);
    expect(completed?.status).toBe('normal');
  });

  it('deleteTask cascades to subtasks', async () => {
    const cat = await createCategory('Cat');
    const proj = await createProject(cat.id, 'Proj');
    const task = await createTask({
      projectId: proj.id, workType: 'deep', title: 'T', dueDate: '2026-05-01',
      flag: null, status: 'normal', completed: false, completedAt: null,
    });
    await createSubtask({ taskId: task.id, title: 'S1', dueDate: null, completed: false, completedAt: null });
    await createSubtask({ taskId: task.id, title: 'S2', dueDate: null, completed: false, completedAt: null });

    await deleteTask(task.id);

    expect(await getTaskById(task.id)).toBeUndefined();
    expect(await getSubtasks()).toHaveLength(0);
  });
});

// ─── Subtasks ────────────────────────────────────────────────────────────────

describe('Subtask CRUD', () => {
  it('creates a subtask and retrieves it', async () => {
    const cat = await createCategory('Cat');
    const proj = await createProject(cat.id, 'Proj');
    const task = await createTask({
      projectId: proj.id, workType: 'deep', title: 'T', dueDate: '2026-05-01',
      flag: null, status: 'normal', completed: false, completedAt: null,
    });
    const sub = await createSubtask({ taskId: task.id, title: 'Step 1', dueDate: '2026-05-02', completed: false, completedAt: null });
    expect(sub.id).toBeDefined();
    expect(sub.taskId).toBe(task.id);
    expect(sub.title).toBe('Step 1');
    expect(sub.dueDate).toBe('2026-05-02');
  });

  it('getSubtasksByTask filters correctly', async () => {
    const cat = await createCategory('Cat');
    const proj = await createProject(cat.id, 'Proj');
    const t1 = await createTask({ projectId: proj.id, workType: 'deep', title: 'T1', dueDate: '2026-05-01', flag: null, status: 'normal', completed: false, completedAt: null });
    const t2 = await createTask({ projectId: proj.id, workType: 'deep', title: 'T2', dueDate: '2026-05-01', flag: null, status: 'normal', completed: false, completedAt: null });
    await createSubtask({ taskId: t1.id, title: 'S1', dueDate: null, completed: false, completedAt: null });
    await createSubtask({ taskId: t1.id, title: 'S2', dueDate: null, completed: false, completedAt: null });
    await createSubtask({ taskId: t2.id, title: 'S3', dueDate: null, completed: false, completedAt: null });

    const subs = await getSubtasksByTask(t1.id);
    expect(subs).toHaveLength(2);
    expect(subs.every(s => s.taskId === t1.id)).toBe(true);
  });

  it('getSubtaskById returns undefined for unknown id', async () => {
    expect(await getSubtaskById(9999)).toBeUndefined();
  });

  it('updateSubtask persists changes', async () => {
    const cat = await createCategory('Cat');
    const proj = await createProject(cat.id, 'Proj');
    const task = await createTask({ projectId: proj.id, workType: 'deep', title: 'T', dueDate: '2026-05-01', flag: null, status: 'normal', completed: false, completedAt: null });
    const sub = await createSubtask({ taskId: task.id, title: 'Old', dueDate: null, completed: false, completedAt: null });
    await updateSubtask(sub.id, { title: 'New', dueDate: '2026-06-01' });
    const updated = await getSubtaskById(sub.id);
    expect(updated?.title).toBe('New');
    expect(updated?.dueDate).toBe('2026-06-01');
  });

  it('completeSubtask marks completed and sets completedAt', async () => {
    const cat = await createCategory('Cat');
    const proj = await createProject(cat.id, 'Proj');
    const task = await createTask({ projectId: proj.id, workType: 'deep', title: 'T', dueDate: '2026-05-01', flag: null, status: 'normal', completed: false, completedAt: null });
    const sub = await createSubtask({ taskId: task.id, title: 'S', dueDate: null, completed: false, completedAt: null });
    await completeSubtask(sub.id);
    const completed = await getSubtaskById(sub.id);
    expect(completed?.completed).toBe(true);
    expect(completed?.completedAt).toBeGreaterThan(0);
  });

  it('deleteSubtask removes the subtask', async () => {
    const cat = await createCategory('Cat');
    const proj = await createProject(cat.id, 'Proj');
    const task = await createTask({ projectId: proj.id, workType: 'deep', title: 'T', dueDate: '2026-05-01', flag: null, status: 'normal', completed: false, completedAt: null });
    const sub = await createSubtask({ taskId: task.id, title: 'S', dueDate: null, completed: false, completedAt: null });
    await deleteSubtask(sub.id);
    expect(await getSubtaskById(sub.id)).toBeUndefined();
  });
});

// ─── Calendar Blocks ─────────────────────────────────────────────────────────

describe('CalendarBlock CRUD', () => {
  it('creates a block and retrieves it', async () => {
    const block = await createCalendarBlock({ taskId: null, workType: 'active_break', date: '2026-05-01', startTime: '13:00', endTime: '14:15' });
    expect(block.id).toBeDefined();
    expect(block.workType).toBe('active_break');
    expect(block.date).toBe('2026-05-01');
  });

  it('getCalendarBlocksByDate filters by date', async () => {
    await createCalendarBlock({ taskId: null, workType: 'active_break', date: '2026-05-01', startTime: '13:00', endTime: '14:15' });
    await createCalendarBlock({ taskId: null, workType: 'deep', date: '2026-05-01', startTime: '09:15', endTime: '11:00' });
    await createCalendarBlock({ taskId: null, workType: 'deep', date: '2026-05-02', startTime: '09:15', endTime: '11:00' });

    const results = await getCalendarBlocksByDate('2026-05-01');
    expect(results).toHaveLength(2);
    expect(results.every(b => b.date === '2026-05-01')).toBe(true);
  });

  it('getCalendarBlocksByDateRange returns blocks within range (inclusive)', async () => {
    await createCalendarBlock({ taskId: null, workType: 'deep', date: '2026-05-01', startTime: '09:00', endTime: '10:00' });
    await createCalendarBlock({ taskId: null, workType: 'deep', date: '2026-05-03', startTime: '09:00', endTime: '10:00' });
    await createCalendarBlock({ taskId: null, workType: 'deep', date: '2026-05-05', startTime: '09:00', endTime: '10:00' });
    await createCalendarBlock({ taskId: null, workType: 'deep', date: '2026-05-07', startTime: '09:00', endTime: '10:00' });

    const results = await getCalendarBlocksByDateRange('2026-05-03', '2026-05-05');
    expect(results).toHaveLength(2);
    expect(results.map(b => b.date).sort()).toEqual(['2026-05-03', '2026-05-05']);
  });

  it('getCalendarBlockById returns undefined for unknown id', async () => {
    expect(await getCalendarBlockById(9999)).toBeUndefined();
  });

  it('updateCalendarBlock persists changes', async () => {
    const block = await createCalendarBlock({ taskId: null, workType: 'deep', date: '2026-05-01', startTime: '09:00', endTime: '11:00' });
    await updateCalendarBlock(block.id, { endTime: '12:00', date: '2026-05-02' });
    const updated = await getCalendarBlockById(block.id);
    expect(updated?.endTime).toBe('12:00');
    expect(updated?.date).toBe('2026-05-02');
  });

  it('deleteCalendarBlock removes the block', async () => {
    const block = await createCalendarBlock({ taskId: null, workType: 'deep', date: '2026-05-01', startTime: '09:00', endTime: '11:00' });
    await deleteCalendarBlock(block.id);
    expect(await getCalendarBlockById(block.id)).toBeUndefined();
  });
});

// ─── Settings ────────────────────────────────────────────────────────────────

describe('Settings', () => {
  it('getSettings returns seeded defaults on a fresh DB', async () => {
    const settings = await getSettings();
    expect(settings.workDayStart).toBe('09:15');
    expect(settings.workDayEnd).toBe('18:00');
    expect(settings.defaultBreakStart).toBe('13:00');
    expect(settings.defaultBreakEnd).toBe('14:15');
    expect(settings.theme).toBe('light');
    expect(settings.lastBackupAt).toBeNull();
    expect(settings.backupReminderDays).toBe(7);
  });

  it('updateSettings persists changes', async () => {
    await updateSettings({ workDayStart: '08:00', backupReminderDays: 14 });
    const settings = await getSettings();
    expect(settings.workDayStart).toBe('08:00');
    expect(settings.backupReminderDays).toBe(14);
  });

  it('updateSettings only changes specified fields', async () => {
    await updateSettings({ theme: 'dark' });
    const settings = await getSettings();
    expect(settings.theme).toBe('dark');
    expect(settings.workDayStart).toBe('09:15');
  });
});

// ─── Backup ──────────────────────────────────────────────────────────────────

describe('Backup — exportDB / importDB', () => {
  it('exportDB returns valid JSON with all tables present', async () => {
    const cat = await createCategory('ESG');
    await createProject(cat.id, 'BRSR');
    const json = await exportDB();
    const snapshot = JSON.parse(json);
    expect(snapshot).toHaveProperty('categories');
    expect(snapshot).toHaveProperty('projects');
    expect(snapshot).toHaveProperty('tasks');
    expect(snapshot).toHaveProperty('subtasks');
    expect(snapshot).toHaveProperty('calendarBlocks');
    expect(snapshot).toHaveProperty('settings');
    expect(snapshot.categories).toHaveLength(1);
    expect(snapshot.projects).toHaveLength(1);
  });

  it('exportDB updates lastBackupAt in settings', async () => {
    const before = Date.now();
    await exportDB();
    const settings = await getSettings();
    expect(settings.lastBackupAt).toBeGreaterThanOrEqual(before);
  });

  it('importDB clears existing data and restores from snapshot', async () => {
    await createCategory('Original');
    const json = await exportDB();

    await createCategory('Added After Export');
    expect(await getCategories()).toHaveLength(2);

    await importDB(json);
    const restored = await getCategories();
    expect(restored).toHaveLength(1);
    expect(restored[0].name).toBe('Original');
  });

  it('round-trip: export then import produces identical data', async () => {
    const cat = await createCategory('Finance');
    const proj = await createProject(cat.id, 'Q1 Report');
    await createTask({
      projectId: proj.id, workType: 'deep', title: 'Compile data', dueDate: '2026-05-10',
      flag: 'urgent', status: 'currently_working', completed: false, completedAt: null,
    });

    const json = await exportDB();

    await createCategory('Noise');
    await importDB(json);

    const cats = await getCategories();
    const projs = await getProjects();
    const tasks = await getTasks();

    expect(cats).toHaveLength(1);
    expect(cats[0].name).toBe('Finance');
    expect(projs[0].name).toBe('Q1 Report');
    expect(tasks[0].title).toBe('Compile data');
    expect(tasks[0].flag).toBe('urgent');
  });

  it('importDB handles empty tables without error', async () => {
    const json = JSON.stringify({
      categories: [], projects: [], tasks: [], subtasks: [], calendarBlocks: [], settings: [],
    });
    await expect(importDB(json)).resolves.not.toThrow();
  });
});

// ─── shouldPromptBackup ───────────────────────────────────────────────────────

describe('shouldPromptBackup', () => {
  it('returns true when lastBackupAt is null (never backed up)', async () => {
    expect(await shouldPromptBackup()).toBe(true);
  });

  it('returns true when last backup is older than reminder threshold', async () => {
    const tenDaysAgo = Date.now() - 10 * 86_400_000;
    await updateSettings({ lastBackupAt: tenDaysAgo, backupReminderDays: 7 });
    expect(await shouldPromptBackup()).toBe(true);
  });

  it('returns false when last backup is within the threshold', async () => {
    const twoDaysAgo = Date.now() - 2 * 86_400_000;
    await updateSettings({ lastBackupAt: twoDaysAgo, backupReminderDays: 7 });
    expect(await shouldPromptBackup()).toBe(false);
  });

  it('respects a custom backupReminderDays value', async () => {
    const twoDaysAgo = Date.now() - 2 * 86_400_000;
    await updateSettings({ lastBackupAt: twoDaysAgo, backupReminderDays: 1 });
    expect(await shouldPromptBackup()).toBe(true);
  });

  it('uses a mocked clock correctly for boundary check', async () => {
    const now = Date.now();
    vi.setSystemTime(now);
    await updateSettings({ lastBackupAt: now - 7 * 86_400_000 - 1, backupReminderDays: 7 });
    expect(await shouldPromptBackup()).toBe(true);
    vi.useRealTimers();
  });
});

// ─── Task status transitions ──────────────────────────────────────────────────

describe('Task status transitions', () => {
  async function seedTask() {
    const cat = await createCategory('Work');
    const proj = await createProject(cat.id, 'Alpha');
    return createTask({
      projectId: proj.id,
      workType: 'deep',
      title: 'Do something',
      dueDate: '2026-06-01',
      flag: null,
      status: 'normal',
      completed: false,
      completedAt: null,
    });
  }

  it('starts with status normal', async () => {
    const task = await seedTask();
    expect(task.status).toBe('normal');
  });

  it('transitions normal → currently_working', async () => {
    const task = await seedTask();
    await updateTask(task.id, { status: 'currently_working' });
    const updated = await getTaskById(task.id);
    expect(updated?.status).toBe('currently_working');
  });

  it('transitions currently_working → morning_meeting', async () => {
    const task = await seedTask();
    await updateTask(task.id, { status: 'currently_working' });
    await updateTask(task.id, { status: 'morning_meeting' });
    const updated = await getTaskById(task.id);
    expect(updated?.status).toBe('morning_meeting');
  });

  it('transitions morning_meeting → normal', async () => {
    const task = await seedTask();
    await updateTask(task.id, { status: 'morning_meeting' });
    await updateTask(task.id, { status: 'normal' });
    const updated = await getTaskById(task.id);
    expect(updated?.status).toBe('normal');
  });

  it('completeTask resets status to normal regardless of prior status', async () => {
    const task = await seedTask();
    await updateTask(task.id, { status: 'currently_working' });
    await completeTask(task.id);
    const completed = await getTaskById(task.id);
    expect(completed?.completed).toBe(true);
    expect(completed?.status).toBe('normal');
    expect(completed?.completedAt).toBeGreaterThan(0);
  });

  it('completing a morning_meeting task also resets status to normal', async () => {
    const task = await seedTask();
    await updateTask(task.id, { status: 'morning_meeting' });
    await completeTask(task.id);
    const completed = await getTaskById(task.id);
    expect(completed?.completed).toBe(true);
    expect(completed?.status).toBe('normal');
  });

  it('can restore a completed task to active with status normal', async () => {
    const task = await seedTask();
    await completeTask(task.id);
    await updateTask(task.id, { completed: false, completedAt: null });
    const restored = await getTaskById(task.id);
    expect(restored?.completed).toBe(false);
    expect(restored?.completedAt).toBeNull();
    expect(restored?.status).toBe('normal');
  });

  it('flag can be set independently of status', async () => {
    const task = await seedTask();
    await updateTask(task.id, { status: 'currently_working', flag: 'urgent' });
    const updated = await getTaskById(task.id);
    expect(updated?.status).toBe('currently_working');
    expect(updated?.flag).toBe('urgent');
  });
});

// ─── Leave Days ───────────────────────────────────────────────────────────────

describe('LeaveDay CRUD', () => {
  it('adds a leave day and retrieves it', async () => {
    const leave = await addLeaveDay('2026-05-01');
    expect(leave.id).toBeDefined();
    expect(leave.date).toBe('2026-05-01');
    expect(leave.createdAt).toBeGreaterThan(0);
  });

  it('getLeaveDays returns all leave days ordered by date', async () => {
    await addLeaveDay('2026-05-05');
    await addLeaveDay('2026-05-01');
    await addLeaveDay('2026-05-10');
    const all = await getLeaveDays();
    expect(all).toHaveLength(3);
    expect(all.map(l => l.date)).toEqual(['2026-05-01', '2026-05-05', '2026-05-10']);
  });

  it('getLeaveDaysByDateRange returns only days within range (inclusive)', async () => {
    await addLeaveDay('2026-04-28');
    await addLeaveDay('2026-05-01');
    await addLeaveDay('2026-05-05');
    await addLeaveDay('2026-05-10');
    const results = await getLeaveDaysByDateRange('2026-05-01', '2026-05-05');
    expect(results).toHaveLength(2);
    expect(results.map(l => l.date).sort()).toEqual(['2026-05-01', '2026-05-05']);
  });

  it('removeLeaveDay deletes the record', async () => {
    const leave = await addLeaveDay('2026-05-01');
    await removeLeaveDay(leave.id);
    const all = await getLeaveDays();
    expect(all).toHaveLength(0);
  });
});
