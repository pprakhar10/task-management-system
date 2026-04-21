import type { Task, Subtask } from '../../types';
import { SubtaskItem } from '../tasks/SubtaskItem';

interface Props {
  task: Task | null;
  subtasks: Subtask[];
  projectName: string;
  categoryName: string;
  isOpen: boolean;
  onClose: () => void;
  onSubtaskToggle: (subtaskId: number) => void;
}

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

const WORK_TYPE_BADGE: Record<string, string> = {
  deep: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  shallow: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
};

const WORK_TYPE_LABEL: Record<string, string> = {
  deep: 'Deep Work',
  shallow: 'Shallow Work',
};

export function SidePanel({ task, subtasks, projectName, categoryName, isOpen, onClose, onSubtaskToggle }: Props) {
  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 z-40 bg-black/20 dark:bg-black/40 transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={`fixed top-14 right-0 bottom-0 z-50 w-full sm:w-96 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 shadow-xl transform transition-transform duration-300 flex flex-col ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {task && (
          <>
            {/* Header */}
            <div className="flex items-start justify-between gap-3 p-5 border-b border-gray-200 dark:border-gray-700">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">
                  {categoryName} › {projectName}
                </p>
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 leading-snug">
                  {task.title}
                </h2>
              </div>
              <button
                onClick={onClose}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors shrink-0"
                aria-label="Close panel"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Badges */}
              <div className="flex flex-wrap gap-2">
                {task.flag && (
                  <span
                    className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                      task.flag === 'urgent'
                        ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
                    }`}
                  >
                    {task.flag === 'urgent' ? 'Urgent' : 'Important'}
                  </span>
                )}
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${WORK_TYPE_BADGE[task.workType]}`}>
                  {WORK_TYPE_LABEL[task.workType]}
                </span>
                {task.status === 'currently_working' && (
                  <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                    Currently Working
                  </span>
                )}
                {task.status === 'morning_meeting' && (
                  <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300">
                    Morning Meeting
                  </span>
                )}
              </div>

              {/* Due date */}
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                  Due Date
                </p>
                <p className="text-sm text-gray-900 dark:text-gray-100">
                  {formatDate(task.dueDate)}
                </p>
              </div>

              {/* Subtasks */}
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                  Subtasks ({subtasks.filter(s => s.completed).length} / {subtasks.length})
                </p>
                {subtasks.length === 0 ? (
                  <p className="text-sm text-gray-400 dark:text-gray-500 italic">No subtasks yet</p>
                ) : (
                  <div className="space-y-0 -mx-1">
                    {subtasks.map(subtask => (
                      <SubtaskItem key={subtask.id} subtask={subtask} onToggle={onSubtaskToggle} />
                    ))}
                  </div>
                )}
                <button className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors min-h-[44px] px-1 mt-1">
                  <span className="text-base leading-none">+</span>
                  Add subtask
                </button>
              </div>
            </div>

            {/* Footer actions */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex gap-2">
              <button className="flex-1 min-h-[44px] bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors">
                Mark Complete
              </button>
              <button className="min-h-[44px] px-4 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 text-sm font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                Edit
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
