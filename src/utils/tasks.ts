import type { Task, SortBy } from '../types';

export function flagOrder(flag: Task['flag']): number {
  if (flag === 'urgent') return 0;
  if (flag === 'important') return 1;
  return 2;
}

export const STATUS_ORDER: Record<string, number> = {
  currently_working: 0,
  morning_meeting: 1,
  normal: 2,
};

export type PrimarySort = 'urgent' | 'important' | 'dueDate';

function importantFirstOrder(flag: Task['flag']): number {
  if (flag === 'important') return 0;
  if (flag === 'urgent') return 1;
  return 2;
}

export function sortTasksByPriority(tasks: Task[], primary: PrimarySort): Task[] {
  return [...tasks].sort((a, b) => {
    if (primary === 'urgent') {
      const diff = flagOrder(a.flag) - flagOrder(b.flag);
      return diff !== 0 ? diff : a.dueDate.localeCompare(b.dueDate);
    }
    if (primary === 'important') {
      const diff = importantFirstOrder(a.flag) - importantFirstOrder(b.flag);
      return diff !== 0 ? diff : a.dueDate.localeCompare(b.dueDate);
    }
    // dueDate primary, tiebreak by flag
    const diff = a.dueDate.localeCompare(b.dueDate);
    return diff !== 0 ? diff : flagOrder(a.flag) - flagOrder(b.flag);
  });
}

export function sortTasks(tasks: Task[], sortBy: SortBy): Task[] {
  return [...tasks].sort((a, b) => {
    if (sortBy === 'dueDate') return a.dueDate.localeCompare(b.dueDate);
    if (sortBy === 'flag') return flagOrder(a.flag) - flagOrder(b.flag);
    if (sortBy === 'status') return STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    return 0;
  });
}

export type DueDateStatus = 'overdue' | 'due_today' | 'normal';

export function getDueDateStatus(dueDate: string, completed: boolean): DueDateStatus {
  if (completed) return 'normal';
  const today = new Date().toISOString().split('T')[0];
  if (dueDate < today) return 'overdue';
  if (dueDate === today) return 'due_today';
  return 'normal';
}
