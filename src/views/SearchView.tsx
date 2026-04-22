import { useMemo, useRef, useEffect, useState } from 'react';
import type { Task, Subtask, Project, Category } from '../types';
import type { SearchFilters, CompletedFilter } from '../utils/search';
import { DEFAULT_FILTERS, filterTasks } from '../utils/search';
import { TaskCard } from '../components/tasks/TaskCard';

interface Props {
  allTasks: Task[];
  subtasksByTaskId: Map<number, Subtask[]>;
  projectMap: Map<number, Project>;
  categories: Category[];
  projects: Project[];
  onTaskClick: (taskId: number) => void;
  onSubtaskToggle: (subtaskId: number) => void;
  onCompleteTask: (taskId: number) => void;
  onRestoreTask: (taskId: number) => void;
  onFlagToggle: (taskId: number) => void;
  onStatusToggle: (taskId: number) => void;
  onAddSubtask: (taskId: number, title: string) => void;
  onUpdateSubtask: (subtaskId: number, title: string) => void;
  onDeleteSubtask: (subtaskId: number) => void;
}

const BTN_BASE = 'min-h-[36px] px-3 text-xs font-medium rounded-lg border transition-colors';
const BTN_ON = 'bg-indigo-100 border-indigo-300 text-indigo-700 dark:bg-indigo-900/50 dark:border-indigo-600 dark:text-indigo-300';
const BTN_OFF = 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100';

const LABEL_CLASS = 'text-xs text-gray-400 dark:text-gray-500 w-20 shrink-0';

export function SearchView({
  allTasks, subtasksByTaskId, projectMap, categories, projects,
  onTaskClick, onSubtaskToggle, onCompleteTask, onRestoreTask,
  onFlagToggle, onStatusToggle, onAddSubtask, onUpdateSubtask, onDeleteSubtask,
}: Props) {
  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_FILTERS);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const categoryProjects = useMemo(
    () => filters.categoryId !== null
      ? projects.filter(p => p.categoryId === filters.categoryId)
      : [],
    [projects, filters.categoryId],
  );

  const results = useMemo(
    () => filterTasks(allTasks, projects, filters),
    [allTasks, projects, filters],
  );

  const hasActiveFilters =
    filters.completedFilter !== 'all' ||
    filters.categoryId !== null ||
    filters.projectId !== null ||
    filters.workType !== null ||
    filters.flag !== null;

  function setFilter<K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) {
    setFilters(prev => ({ ...prev, [key]: value }));
  }

  function handleCategoryChange(categoryId: number | null) {
    setFilters(prev => ({ ...prev, categoryId, projectId: null }));
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header: search input + filters */}
      <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 space-y-3">

        {/* Search input */}
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={filters.query}
            onChange={e => setFilter('query', e.target.value)}
            placeholder="Search tasks..."
            className="w-full h-11 pl-9 pr-10 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          {filters.query && (
            <button
              type="button"
              onClick={() => setFilter('query', '')}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              aria-label="Clear search"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="space-y-2">
          {/* Status */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={LABEL_CLASS}>Status</span>
            {(['all', 'active', 'completed'] as CompletedFilter[]).map(opt => (
              <button
                key={opt}
                type="button"
                onClick={() => setFilter('completedFilter', opt)}
                className={`${BTN_BASE} ${filters.completedFilter === opt ? BTN_ON : BTN_OFF}`}
              >
                {opt.charAt(0).toUpperCase() + opt.slice(1)}
              </button>
            ))}
          </div>

          {/* Work type */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={LABEL_CLASS}>Work type</span>
            <button
              type="button"
              onClick={() => setFilter('workType', null)}
              className={`${BTN_BASE} ${filters.workType === null ? BTN_ON : BTN_OFF}`}
            >
              All
            </button>
            {(['deep', 'shallow'] as const).map(wt => (
              <button
                key={wt}
                type="button"
                onClick={() => setFilter('workType', wt)}
                className={`${BTN_BASE} ${filters.workType === wt ? BTN_ON : BTN_OFF}`}
              >
                {wt.charAt(0).toUpperCase() + wt.slice(1)}
              </button>
            ))}
          </div>

          {/* Flag */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={LABEL_CLASS}>Flag</span>
            <button
              type="button"
              onClick={() => setFilter('flag', null)}
              className={`${BTN_BASE} ${filters.flag === null ? BTN_ON : BTN_OFF}`}
            >
              All
            </button>
            {(['urgent', 'important', 'none'] as const).map(f => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter('flag', f)}
                className={`${BTN_BASE} ${filters.flag === f ? BTN_ON : BTN_OFF}`}
              >
                {f === 'none' ? 'No flag' : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>

          {/* Category */}
          {categories.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className={LABEL_CLASS}>Category</span>
              <button
                type="button"
                onClick={() => handleCategoryChange(null)}
                className={`${BTN_BASE} ${filters.categoryId === null ? BTN_ON : BTN_OFF}`}
              >
                All
              </button>
              {categories.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleCategoryChange(c.id)}
                  className={`${BTN_BASE} ${filters.categoryId === c.id ? BTN_ON : BTN_OFF}`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}

          {/* Project (only when a category is selected) */}
          {filters.categoryId !== null && categoryProjects.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className={LABEL_CLASS}>Project</span>
              <button
                type="button"
                onClick={() => setFilter('projectId', null)}
                className={`${BTN_BASE} ${filters.projectId === null ? BTN_ON : BTN_OFF}`}
              >
                All
              </button>
              {categoryProjects.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setFilter('projectId', p.id)}
                  className={`${BTN_BASE} ${filters.projectId === p.id ? BTN_ON : BTN_OFF}`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Result count + clear */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {results.length} result{results.length !== 1 ? 's' : ''}
          </span>
          {(filters.query || hasActiveFilters) && (
            <button
              type="button"
              onClick={() => setFilters(DEFAULT_FILTERS)}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto p-5">
        {results.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <p className="text-gray-400 dark:text-gray-500 text-sm">No tasks found.</p>
            {(filters.query || hasActiveFilters) && (
              <p className="text-gray-300 dark:text-gray-600 text-xs mt-1">
                Try different keywords or adjust your filters.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3 max-w-2xl">
            {results.map(task => (
              <TaskCard
                key={task.id}
                task={task}
                subtasks={subtasksByTaskId.get(task.id) ?? []}
                projectName={projectMap.get(task.projectId)?.name}
                onClick={onTaskClick}
                onSubtaskToggle={onSubtaskToggle}
                onComplete={task.completed ? undefined : onCompleteTask}
                onRestore={task.completed ? onRestoreTask : undefined}
                onFlagToggle={task.completed ? undefined : onFlagToggle}
                onStatusToggle={task.completed ? undefined : onStatusToggle}
                onAddSubtask={task.completed ? undefined : onAddSubtask}
                onUpdateSubtask={task.completed ? undefined : onUpdateSubtask}
                onDeleteSubtask={task.completed ? undefined : onDeleteSubtask}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
