import type { Task, Subtask } from '../../types';
import { SubtaskItem } from './SubtaskItem';
import { getDueDateStatus } from '../../utils/tasks';

interface Props {
  task: Task;
  subtasks: Subtask[];
  projectName?: string;
  onClick: (taskId: number) => void;
  onSubtaskToggle: (subtaskId: number) => void;
  onComplete?: (taskId: number) => void;
  onRestore?: (taskId: number) => void;
  onFlagToggle?: (taskId: number) => void;
  onStatusToggle?: (taskId: number) => void;
}

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const WORK_TYPE_BADGE: Record<string, string> = {
  deep: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  shallow: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  active_break: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
};

const WORK_TYPE_LABEL: Record<string, string> = {
  deep: 'Deep Work',
  shallow: 'Shallow Work',
  active_break: 'Active Break',
};

const STATUS_BADGE: Record<string, string> = {
  currently_working: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  morning_meeting: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
};

const STATUS_LABEL: Record<string, string> = {
  currently_working: 'Working',
  morning_meeting: 'Morning Meeting',
};

export function TaskCard({ task, subtasks, projectName, onClick, onSubtaskToggle, onComplete, onRestore, onFlagToggle, onStatusToggle }: Props) {
  const dueDateStatus = getDueDateStatus(task.dueDate, task.completed);
  const isOverdue = dueDateStatus === 'overdue';
  const isDueToday = dueDateStatus === 'due_today';

  const completedCount = subtasks.filter(s => s.completed).length;

  const borderColorClass = isOverdue
    ? 'border-l-red-500'
    : isDueToday
    ? 'border-l-amber-400'
    : 'border-l-transparent';

  const dueDateColorClass = isOverdue
    ? 'text-red-600 dark:text-red-400 font-medium'
    : isDueToday
    ? 'text-amber-600 dark:text-amber-400 font-medium'
    : 'text-gray-500 dark:text-gray-400';

  return (
    <div
      onClick={() => onClick(task.id)}
      className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 border-l-4 ${borderColorClass} cursor-pointer hover:shadow-md transition-shadow`}
    >
      <div className="p-4">
        {/* Title row */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-start gap-2 flex-1 min-w-0">
            {onComplete && (
              <button
                onClick={e => { e.stopPropagation(); onComplete(task.id); }}
                className="shrink-0 flex items-center justify-center min-h-[44px] min-w-[44px] -mx-2 -mt-2 group"
                aria-label="Mark complete"
              >
                <span className="w-5 h-5 rounded-full border-2 border-gray-300 dark:border-gray-600 group-hover:border-indigo-500 dark:group-hover:border-indigo-400 transition-colors flex items-center justify-center">
                  <svg className="w-3 h-3 text-indigo-500 dark:text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </span>
              </button>
            )}
            <h3 className={`text-sm font-semibold leading-snug pt-0.5 ${task.completed ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-gray-100'}`}>
              {task.title}
            </h3>
          </div>
          {/* Flag + Status stacked on the right */}
          <div className="shrink-0 flex flex-col items-end gap-1">
            {onFlagToggle ? (
              <button
                onClick={e => { e.stopPropagation(); onFlagToggle(task.id); }}
                className={`text-xs font-semibold px-2 py-0.5 rounded-full transition-colors ${
                  task.flag === 'urgent'
                    ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/60'
                    : task.flag === 'important'
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/60'
                    : 'border border-dashed border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-500 hover:border-gray-400 dark:hover:border-gray-500'
                }`}
                aria-label="Cycle flag"
              >
                {task.flag === 'urgent' ? 'Urgent' : task.flag === 'important' ? 'Important' : 'Flag'}
              </button>
            ) : task.flag ? (
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  task.flag === 'urgent'
                    ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
                    : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
                }`}
              >
                {task.flag === 'urgent' ? 'Urgent' : 'Important'}
              </span>
            ) : null}
            {onStatusToggle ? (
              <button
                onClick={e => { e.stopPropagation(); onStatusToggle(task.id); }}
                className={`text-xs px-2 py-0.5 rounded-full font-medium transition-colors ${
                  task.status !== 'normal'
                    ? `${STATUS_BADGE[task.status]} hover:opacity-80`
                    : 'border border-dashed border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-500 hover:border-gray-400 dark:hover:border-gray-500'
                }`}
                aria-label="Cycle status"
              >
                {task.status !== 'normal' ? STATUS_LABEL[task.status] : 'Status'}
              </button>
            ) : task.status !== 'normal' ? (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[task.status]}`}>
                {STATUS_LABEL[task.status]}
              </span>
            ) : null}
          </div>
        </div>

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {task.completed ? (
            <span className="text-xs text-gray-400 dark:text-gray-500">
              Completed · {formatTimestamp(task.completedAt ?? task.createdAt)}
            </span>
          ) : (
            <span className={`text-xs ${dueDateColorClass}`}>
              {isOverdue ? 'Overdue · ' : isDueToday ? 'Due today · ' : ''}{formatDate(task.dueDate)}
            </span>
          )}
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${WORK_TYPE_BADGE[task.workType]}`}>
            {WORK_TYPE_LABEL[task.workType]}
          </span>
          {projectName && (
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {projectName}
            </span>
          )}
        </div>

        {/* Subtasks */}
        {subtasks.length > 0 && (
          <div
            className="border-t border-gray-100 dark:border-gray-700 pt-2"
            onClick={e => e.stopPropagation()}
          >
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-1 px-1">
              {completedCount} / {subtasks.length} subtasks
            </p>
            <div className="space-y-0">
              {subtasks.map(subtask => (
                <SubtaskItem key={subtask.id} subtask={subtask} onToggle={onSubtaskToggle} />
              ))}
            </div>
          </div>
        )}

        {/* Add subtask / Restore */}
        <div
          className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700"
          onClick={e => e.stopPropagation()}
        >
          {onRestore ? (
            <button
              onClick={() => onRestore(task.id)}
              className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors min-h-[44px] px-1"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
              Restore to active
            </button>
          ) : (
            <button
              onClick={() => onClick(task.id)}
              className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors min-h-[44px] px-1"
            >
              <span className="text-base leading-none">+</span>
              Add subtask
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
