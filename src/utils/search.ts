import type { Task, Project, TaskFlag } from '../types';

export type CompletedFilter = 'all' | 'active' | 'completed';
export type DueFilter = 'all' | 'today' | 'past_due' | 'later';

export interface SearchFilters {
  query: string;
  completedFilter: CompletedFilter;
  categoryId: number | null;
  projectId: number | null;
  workType: 'deep' | 'shallow' | null;
  flag: TaskFlag | 'none' | null;
  dueFilter: DueFilter;
}

export const DEFAULT_FILTERS: SearchFilters = {
  query: '',
  completedFilter: 'all',
  categoryId: null,
  projectId: null,
  workType: null,
  flag: null,
  dueFilter: 'all',
};

function localDateString(d: Date = new Date()): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${day}`;
}

export function filterTasks(
  tasks: Task[],
  projects: Project[],
  filters: SearchFilters,
  today: string = localDateString(),
): Task[] {
  const projectById = new Map(projects.map(p => [p.id, p]));
  const q = filters.query.trim().toLowerCase();

  return tasks.filter(task => {
    if (q && !task.title.toLowerCase().includes(q)) return false;
    if (filters.completedFilter === 'active' && task.completed) return false;
    if (filters.completedFilter === 'completed' && !task.completed) return false;
    if (filters.projectId !== null && task.projectId !== filters.projectId) return false;
    if (filters.categoryId !== null && filters.projectId === null) {
      const project = projectById.get(task.projectId);
      if (!project || project.categoryId !== filters.categoryId) return false;
    }
    if (filters.workType !== null && task.workType !== filters.workType) return false;
    if (filters.flag === 'none' && task.flag !== null) return false;
    if (filters.flag !== null && filters.flag !== 'none' && task.flag !== filters.flag) return false;
    if (filters.dueFilter === 'today' && task.dueDate !== today) return false;
    if (filters.dueFilter === 'past_due' && task.dueDate >= today) return false;
    if (filters.dueFilter === 'later' && task.dueDate <= today) return false;
    return true;
  });
}
