import { useState, useMemo } from 'react';
import type { Task, Subtask, Project } from '../types';
import { TaskCard } from '../components/tasks/TaskCard';
import { sortTasksByPriority, type PrimarySort } from '../utils/tasks';

interface Props {
  tasks: Task[];
  subtasksByTaskId: Map<number, Subtask[]>;
  projectMap: Map<number, Project>;
  onTaskClick: (taskId: number) => void;
  onSubtaskToggle: (subtaskId: number) => void;
  onCompleteTask: (taskId: number) => void;
  onFlagToggle: (taskId: number) => void;
  onStatusToggle: (taskId: number) => void;
  onAddSubtask: (taskId: number, title: string) => void;
  onUpdateSubtask: (subtaskId: number, title: string) => void;
  onDeleteSubtask: (subtaskId: number) => void;
  onMoveSubtaskUp: (subtaskId: number, taskId: number) => void;
  onMoveSubtaskDown: (subtaskId: number, taskId: number) => void;
}

const SORT_OPTIONS: { value: PrimarySort; label: string }[] = [
  { value: 'urgent', label: 'Urgent' },
  { value: 'important', label: 'Important' },
  { value: 'dueDate', label: 'Due Date' },
];

export function MorningMeetingView({ tasks, subtasksByTaskId, projectMap, onTaskClick, onSubtaskToggle, onCompleteTask, onFlagToggle, onStatusToggle, onAddSubtask, onUpdateSubtask, onDeleteSubtask, onMoveSubtaskUp, onMoveSubtaskDown }: Props) {
  const [sortBy, setSortBy] = useState<PrimarySort>('urgent');

  const sortedTasks = useMemo(() => sortTasksByPriority(tasks, sortBy), [tasks, sortBy]);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Morning Meeting</h1>
        </div>
        <div className="flex items-center justify-between mt-2">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {tasks.length} task{tasks.length !== 1 ? 's' : ''} to discuss today
          </p>
          <div className="flex rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
            {SORT_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setSortBy(opt.value)}
                className={`px-3 py-1 text-xs font-medium transition-colors ${
                  sortBy === opt.value
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {sortedTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <p className="text-gray-400 dark:text-gray-500 text-sm">Nothing queued for morning meeting.</p>
            <p className="text-gray-300 dark:text-gray-600 text-xs mt-1">
              Open a task and move it to Morning Meeting to see it here.
            </p>
          </div>
        ) : (
          <div className="space-y-3 max-w-2xl">
            {sortedTasks.map(task => (
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
                onMoveSubtaskUp={onMoveSubtaskUp}
                onMoveSubtaskDown={onMoveSubtaskDown}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
