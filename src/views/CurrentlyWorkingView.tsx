import type { Task, Subtask, Project } from '../types';
import { TaskCard } from '../components/tasks/TaskCard';

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
  onDownloadReport: () => void;
}

export function CurrentlyWorkingView({ tasks, subtasksByTaskId, projectMap, onTaskClick, onSubtaskToggle, onCompleteTask, onFlagToggle, onStatusToggle, onAddSubtask, onUpdateSubtask, onDeleteSubtask, onMoveSubtaskUp, onMoveSubtaskDown, onDownloadReport }: Props) {
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Currently Working</h1>
          <button
            onClick={onDownloadReport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2M7 10l5 5 5-5M12 3v12" />
            </svg>
            Download Report
          </button>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          {tasks.length} active task{tasks.length !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <p className="text-gray-400 dark:text-gray-500 text-sm">No tasks currently in progress.</p>
            <p className="text-gray-300 dark:text-gray-600 text-xs mt-1">
              Open a task and move it to Currently Working to see it here.
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
