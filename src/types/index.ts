export type WorkType = 'deep' | 'shallow' | 'active_break';
export type TaskFlag = 'urgent' | 'important';
export type TaskStatus = 'normal' | 'currently_working' | 'morning_meeting';
export type Theme = 'light' | 'dark';
export type AppView = 'explore' | 'currently_working' | 'morning_meeting' | 'statistics' | 'calendar' | 'search' | 'settings';
export type SortBy = 'dueDate' | 'flag' | 'status';

export interface Category {
  id: number;
  name: string;
  createdAt: number;
}

export interface Project {
  id: number;
  categoryId: number;
  name: string;
  createdAt: number;
}

export interface Task {
  id: number;
  projectId: number;
  workType: WorkType;
  title: string;
  dueDate: string; // YYYY-MM-DD
  flag: TaskFlag | null;
  status: TaskStatus;
  completed: boolean;
  completedAt: number | null;
  createdAt: number;
}

export interface Subtask {
  id: number;
  taskId: number;
  title: string;
  dueDate: string | null; // YYYY-MM-DD or null
  completed: boolean;
  completedAt: number | null;
  createdAt: number;
}

export interface CalendarBlock {
  id: number;
  taskId: number | null;
  workType: WorkType;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  createdAt: number;
}

export interface Settings {
  id?: number;
  workDayStart: string; // HH:MM
  workDayEnd: string; // HH:MM
  defaultBreakStart: string; // HH:MM
  defaultBreakEnd: string; // HH:MM
  standupStart: string | null; // HH:MM — daily standup excluded from unutilized
  standupEnd: string | null;   // HH:MM
  theme: Theme;
  lastBackupAt: number | null;
  backupReminderDays: number;
}

export interface LeaveDay {
  id: number;
  date: string; // YYYY-MM-DD
  createdAt: number;
}
