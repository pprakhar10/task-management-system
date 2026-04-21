import type { Subtask } from '../../types';

interface Props {
  subtask: Subtask;
  onToggle: (id: number) => void;
}

export function SubtaskItem({ subtask, onToggle }: Props) {
  return (
    <label className="flex items-center gap-2 min-h-[44px] px-1 cursor-pointer">
      <input
        type="checkbox"
        checked={subtask.completed}
        onChange={() => onToggle(subtask.id)}
        className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 accent-indigo-600 cursor-pointer flex-shrink-0"
        onClick={e => e.stopPropagation()}
      />
      <span
        className={`text-sm flex-1 ${
          subtask.completed
            ? 'line-through text-gray-400 dark:text-gray-500'
            : 'text-gray-700 dark:text-gray-300'
        }`}
      >
        {subtask.title}
      </span>
    </label>
  );
}
