interface Props {
  onBackUp: () => void;
  onDismiss: () => void;
}

export function BackupPromptModal({ onBackUp, onDismiss }: Props) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onDismiss} />
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 max-w-sm w-full">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Back up your data
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          It's been a while since your last backup. Export a JSON snapshot to keep your data safe.
        </p>
        <div className="flex gap-3 mt-5">
          <button
            onClick={onBackUp}
            className="flex-1 min-h-[44px] bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Export Backup
          </button>
          <button
            onClick={onDismiss}
            className="flex-1 min-h-[44px] border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 text-sm font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Remind Me Later
          </button>
        </div>
      </div>
    </div>
  );
}
