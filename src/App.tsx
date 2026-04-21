import { useEffect, useMemo, useState } from 'react';
import type { AppView, Category, Project, SortBy, Task, Theme } from './types';
import { MOCK_CATEGORIES, MOCK_PROJECTS, MOCK_SUBTASKS, MOCK_TASKS } from './data/mockData';
import { TopNav } from './components/layout/TopNav';
import { Sidebar } from './components/layout/Sidebar';
import { SidePanel } from './components/layout/SidePanel';
import { ExploreView } from './views/ExploreView';
import { CurrentlyWorkingView } from './views/CurrentlyWorkingView';
import { MorningMeetingView } from './views/MorningMeetingView';

function flagOrder(flag: Task['flag']): number {
  if (flag === 'urgent') return 0;
  if (flag === 'important') return 1;
  return 2;
}

const STATUS_ORDER: Record<string, number> = {
  currently_working: 0,
  morning_meeting: 1,
  normal: 2,
};

function sortTasks(tasks: Task[], sortBy: SortBy): Task[] {
  return [...tasks].sort((a, b) => {
    if (sortBy === 'dueDate') return a.dueDate.localeCompare(b.dueDate);
    if (sortBy === 'flag') return flagOrder(a.flag) - flagOrder(b.flag);
    if (sortBy === 'status') return STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    return 0;
  });
}

export default function App() {
  const [view, setView] = useState<AppView>('explore');
  const [theme, setTheme] = useState<Theme>('light');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<number>>(new Set([1]));
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<SortBy>('dueDate');

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  const subtasksByTaskId = useMemo(() => {
    const map = new Map<number, typeof MOCK_SUBTASKS>();
    for (const subtask of MOCK_SUBTASKS) {
      const arr = map.get(subtask.taskId) ?? [];
      arr.push(subtask);
      map.set(subtask.taskId, arr);
    }
    return map;
  }, []);

  const projectMap = useMemo(
    () => new Map<number, Project>(MOCK_PROJECTS.map(p => [p.id, p])),
    [],
  );

  const categoryMap = useMemo(
    () => new Map<number, Category>(MOCK_CATEGORIES.map(c => [c.id, c])),
    [],
  );

  const filteredTasks = useMemo(() => {
    let tasks = MOCK_TASKS.filter(t => !t.completed);
    if (selectedProjectId !== null) {
      tasks = tasks.filter(t => t.projectId === selectedProjectId);
    } else if (selectedCategoryId !== null) {
      const projectIds = new Set(
        MOCK_PROJECTS.filter(p => p.categoryId === selectedCategoryId).map(p => p.id),
      );
      tasks = tasks.filter(t => projectIds.has(t.projectId));
    }
    return sortTasks(tasks, sortBy);
  }, [selectedProjectId, selectedCategoryId, sortBy]);

  const currentlyWorkingTasks = useMemo(
    () => MOCK_TASKS.filter(t => !t.completed && t.status === 'currently_working'),
    [],
  );

  const morningMeetingTasks = useMemo(
    () => MOCK_TASKS.filter(t => !t.completed && t.status === 'morning_meeting'),
    [],
  );

  const selectedTask = selectedTaskId !== null
    ? (MOCK_TASKS.find(t => t.id === selectedTaskId) ?? null)
    : null;

  const selectedTaskSubtasks = selectedTaskId !== null
    ? (subtasksByTaskId.get(selectedTaskId) ?? [])
    : [];

  const selectedProject = selectedTask ? projectMap.get(selectedTask.projectId) : null;
  const selectedCategory = selectedProject ? categoryMap.get(selectedProject.categoryId) : null;

  function handleToggleCategory(categoryId: number) {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  }

  function handleSelectProject(projectId: number, categoryId: number) {
    setSelectedProjectId(projectId);
    setSelectedCategoryId(categoryId);
  }

  function handleSelectAll() {
    setSelectedProjectId(null);
    setSelectedCategoryId(null);
  }

  function handleViewChange(nextView: AppView) {
    setView(nextView);
    setSelectedTaskId(null);
  }

  const showSidebar = view === 'explore' || view === 'calendar';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <TopNav
        view={view}
        onViewChange={handleViewChange}
        theme={theme}
        onThemeToggle={() => setTheme(prev => (prev === 'light' ? 'dark' : 'light'))}
      />

      <div className="flex pt-14 h-screen">
        {showSidebar && (
          <Sidebar
            categories={MOCK_CATEGORIES}
            projects={MOCK_PROJECTS}
            selectedCategoryId={selectedCategoryId}
            selectedProjectId={selectedProjectId}
            expandedCategories={expandedCategories}
            onToggleCategory={handleToggleCategory}
            onSelectProject={handleSelectProject}
            onSelectAll={handleSelectAll}
          />
        )}

        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {view === 'explore' && (
            <ExploreView
              tasks={filteredTasks}
              subtasksByTaskId={subtasksByTaskId}
              projectMap={projectMap}
              sortBy={sortBy}
              onSortChange={setSortBy}
              onTaskClick={setSelectedTaskId}
              onSubtaskToggle={() => {}}
            />
          )}

          {view === 'currently_working' && (
            <CurrentlyWorkingView
              tasks={currentlyWorkingTasks}
              subtasksByTaskId={subtasksByTaskId}
              projectMap={projectMap}
              onTaskClick={setSelectedTaskId}
              onSubtaskToggle={() => {}}
            />
          )}

          {view === 'morning_meeting' && (
            <MorningMeetingView
              tasks={morningMeetingTasks}
              subtasksByTaskId={subtasksByTaskId}
              projectMap={projectMap}
              onTaskClick={setSelectedTaskId}
              onSubtaskToggle={() => {}}
            />
          )}

          {view === 'statistics' && (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-gray-400 dark:text-gray-500 text-sm">Statistics — coming in Phase 8</p>
            </div>
          )}

          {view === 'calendar' && (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-gray-400 dark:text-gray-500 text-sm">Calendar — coming in Phase 6</p>
            </div>
          )}
        </main>
      </div>

      <SidePanel
        task={selectedTask}
        subtasks={selectedTaskSubtasks}
        projectName={selectedProject?.name ?? ''}
        categoryName={selectedCategory?.name ?? ''}
        isOpen={selectedTaskId !== null}
        onClose={() => setSelectedTaskId(null)}
        onSubtaskToggle={() => {}}
      />
    </div>
  );
}
