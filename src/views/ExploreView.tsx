import { useState } from 'react';
import type { Task, Subtask, Project, SortBy } from '../types';
import { TaskCard } from '../components/tasks/TaskCard';

interface Props {
  tasks: Task[];
  completedTasks: Task[];
  subtasksByTaskId: Map<number, Subtask[]>;
  projectMap: Map<number, Project>;
  sortBy: SortBy;
  onSortChange: (sort: SortBy) => void;
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

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: 'dueDate', label: 'Due Date' },
  { value: 'flag', label: 'Priority' },
  { value: 'status', label: 'Current' },
];

export function ExploreView({
  tasks,
  completedTasks,
  subtasksByTaskId,
  projectMap,
  sortBy,
  onSortChange,
  onTaskClick,
  onSubtaskToggle,
  onCompleteTask,
  onRestoreTask,
  onFlagToggle,
  onStatusToggle,
  onAddSubtask,
  onUpdateSubtask,
  onDeleteSubtask,
}: Props) {
  const [showCompleted, setShowCompleted] = useState(false);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Sort bar */}
      <div className="sticky top-0 z-10 px-5 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex items-center gap-2 shrink-0">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 mr-1">Sort by</span>
        {SORT_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => onSortChange(opt.value)}
            className={`min-h-[36px] px-3 rounded-lg text-xs font-medium transition-colors ${
              sortBy === opt.value
                ? 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            {opt.label}
          </button>
        ))}
        <span className="ml-auto text-xs text-gray-400 dark:text-gray-500">
          {tasks.length} task{tasks.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto p-5">
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <p className="text-gray-400 dark:text-gray-500 text-sm">No tasks here.</p>
            <p className="text-gray-300 dark:text-gray-600 text-xs mt-1">
              Select a project from the sidebar or create a new task.
            </p>
          </div>
        ) : (
          <div className="space-y-3 max-w-2xl">
            {tasks.map(task => (
              <TaskCard
                key={task.id}
                task={task}
                subtasks={subtasksByTaskId.get(task.id) ?? []}
                projectName={projectMap.get(task.projectId)?.name}
                onClick={onTaskClick}
                onSubtaskToggle={onSubtaskToggle}
                onComplete={onCompleteTask}
                onFlagToggle={onFlagToggle}
                onStatusToggle={onStatusToggle}
                onAddSubtask={onAddSubtask}
                onUpdateSubtask={onUpdateSubtask}
                onDeleteSubtask={onDeleteSubtask}
              />
            ))}
          </div>
        )}

        {/* Completed tasks toggle */}
        <div className="max-w-2xl mt-6">
          <button
            onClick={() => setShowCompleted(prev => !prev)}
            className="w-full flex items-center justify-center gap-2 py-3 text-xs font-medium text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors border-t border-gray-200 dark:border-gray-700"
          >
            <svg
              className={`w-3.5 h-3.5 transition-transform ${showCompleted ? 'rotate-90' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            Completed Tasks ({completedTasks.length})
          </button>

          {showCompleted && (
            <div className="mt-3 space-y-3">
              {completedTasks.length === 0 ? (
                <p className="text-center text-xs text-gray-400 dark:text-gray-500 py-4">
                  No completed tasks yet.
                </p>
              ) : (
                completedTasks.map(task => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    subtasks={subtasksByTaskId.get(task.id) ?? []}
                    projectName={projectMap.get(task.projectId)?.name}
                    onClick={onTaskClick}
                    onSubtaskToggle={onSubtaskToggle}
                    onRestore={onRestoreTask}
                  />
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
