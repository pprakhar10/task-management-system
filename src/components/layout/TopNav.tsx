import type { AppView, Theme } from '../../types';

interface Props {
  view: AppView;
  onViewChange: (view: AppView) => void;
  theme: Theme;
  onThemeToggle: () => void;
  onCreateTask: () => void;
  onSearch: () => void;
  onSettings: () => void;
}

const NAV_ITEMS: { view: AppView; label: string }[] = [
  { view: 'currently_working', label: 'Currently Working' },
  { view: 'morning_meeting', label: 'Morning Meeting' },
  { view: 'statistics', label: 'Statistics' },
];

export function TopNav({ view, onViewChange, theme, onThemeToggle, onCreateTask, onSearch, onSettings }: Props) {
  const isCalendar = view === 'calendar';

  return (
    <header className="fixed top-0 left-0 right-0 z-30 h-14 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex items-center px-4 gap-3">
      <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400 mr-2 shrink-0">
        WorkTrack
      </span>

      <nav className="flex items-center gap-1">
        {NAV_ITEMS.map(item => (
          <button
            key={item.view}
            onClick={() => onViewChange(item.view)}
            className={`min-h-[44px] px-3 rounded-md text-sm font-medium transition-colors ${
              view === item.view
                ? 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-2">
        {/* Explore / Calendar toggle */}
        <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          <button
            onClick={() => onViewChange('explore')}
            className={`min-h-[36px] px-3 rounded-md text-sm font-medium transition-colors ${
              !isCalendar
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            Explore
          </button>
          <button
            onClick={() => onViewChange('calendar')}
            className={`min-h-[36px] px-3 rounded-md text-sm font-medium transition-colors ${
              isCalendar
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            Calendar
          </button>
        </div>

        {/* Create Task */}
        <button
          onClick={onCreateTask}
          className="min-h-[44px] px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5"
        >
          <span className="text-lg leading-none">+</span>
          <span className="hidden sm:inline">Create Task</span>
        </button>

        {/* Search */}
        <button
          onClick={onSearch}
          className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg transition-colors ${
            view === 'search'
              ? 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400'
              : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
          aria-label="Search"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
        </button>

        {/* Theme toggle */}
        <button
          onClick={onThemeToggle}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
        >
          {theme === 'light' ? (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <circle cx="12" cy="12" r="5" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
            </svg>
          )}
        </button>

        {/* Settings */}
        <button
          onClick={onSettings}
          className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg transition-colors ${
            view === 'settings'
              ? 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400'
              : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
          aria-label="Settings"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 0 0-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 0 0-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 0 0-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 0 0-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 0 0 1.066-2.573c-.94-1.543.826-3.31 2.37-2.37a1.724 1.724 0 0 0 2.572-1.065z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>
      </div>
    </header>
  );
}
