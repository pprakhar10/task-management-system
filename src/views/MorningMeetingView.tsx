import type { Task, Subtask, Project } from '../types';
import { TaskCard } from '../components/tasks/TaskCard';

interface Props {
  tasks: Task[];
  subtasksByTaskId: Map<number, Subtask[]>;
  projectMap: Map<number, Project>;
  onTaskClick: (taskId: number) => void;
  onSubtaskToggle: (subtaskId: number) => void;
}

export function MorningMeetingView({ tasks, subtasksByTaskId, projectMap, onTaskClick, onSubtaskToggle }: Props) {
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Morning Meeting</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          {tasks.length} task{tasks.length !== 1 ? 's' : ''} to discuss today
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <p className="text-gray-400 dark:text-gray-500 text-sm">Nothing queued for morning meeting.</p>
            <p className="text-gray-300 dark:text-gray-600 text-xs mt-1">
              Open a task and move it to Morning Meeting to see it here.
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
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
