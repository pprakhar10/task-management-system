import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { AppView, Category, Project, SortBy, TaskFlag, TaskStatus, Theme } from './types';
import { MOCK_CATEGORIES, MOCK_PROJECTS, MOCK_SUBTASKS, MOCK_TASKS } from './data/mockData';
import { db } from './db/database';
import { completeTask, updateTask, updateSubtask, updateSettings, createCategory, createProject } from './db/crud';
import { exportDB, shouldPromptBackup } from './db/backup';
import { sortTasks } from './utils/tasks';
import { TopNav } from './components/layout/TopNav';
import { Sidebar } from './components/layout/Sidebar';
import { SidePanel } from './components/layout/SidePanel';
import { BackupPromptModal } from './components/layout/BackupPromptModal';
import { ExploreView } from './views/ExploreView';
import { CurrentlyWorkingView } from './views/CurrentlyWorkingView';
import { MorningMeetingView } from './views/MorningMeetingView';

export default function App() {
  const [view, setView] = useState<AppView>('explore');
  const [theme, setTheme] = useState<Theme>('light');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<number>>(new Set());
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<SortBy>('dueDate');
  const [showBackupPrompt, setShowBackupPrompt] = useState(false);

  // Live queries — UI re-renders automatically when DB changes
  const categories = useLiveQuery(() => db.categories.toArray(), []) ?? [];
  const projects = useLiveQuery(() => db.projects.toArray(), []) ?? [];
  const tasks = useLiveQuery(() => db.tasks.filter(t => !t.completed).toArray(), []) ?? [];
  const completedTasks = useLiveQuery(() => db.tasks.filter(t => t.completed).toArray(), []) ?? [];
  const subtasks = useLiveQuery(() => db.subtasks.toArray(), []) ?? [];

  // Seed mock data on first run (when DB is empty)
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current) return;
    seededRef.current = true;
    db.categories.count().then(count => {
      if (count === 0) {
        db.transaction('rw', db.categories, db.projects, db.tasks, db.subtasks, async () => {
          await db.categories.bulkAdd(MOCK_CATEGORIES);
          await db.projects.bulkAdd(MOCK_PROJECTS);
          await db.tasks.bulkAdd(MOCK_TASKS);
          await db.subtasks.bulkAdd(MOCK_SUBTASKS);
        });
      }
    });
  }, []);

  // Load persisted theme from settings on mount
  useEffect(() => {
    db.settings.toCollection().first().then(s => {
      if (s) setTheme(s.theme);
    });
  }, []);

  // Check if backup reminder should be shown
  useEffect(() => {
    shouldPromptBackup().then(should => {
      if (should) setShowBackupPrompt(true);
    });
  }, []);

  // Apply theme class to <html>
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
  }, [theme]);

  // Auto-expand first category when categories first load
  const categoriesInitializedRef = useRef(false);
  useEffect(() => {
    if (!categoriesInitializedRef.current && categories.length > 0) {
      setExpandedCategories(new Set([categories[0].id]));
      categoriesInitializedRef.current = true;
    }
  }, [categories]);

  // Derived lookup maps
  const projectMap = useMemo(
    () => new Map<number, Project>(projects.map(p => [p.id, p])),
    [projects],
  );

  const categoryMap = useMemo(
    () => new Map<number, Category>(categories.map(c => [c.id, c])),
    [categories],
  );

  const subtasksByTaskId = useMemo(() => {
    const map = new Map<number, typeof subtasks>();
    for (const sub of subtasks) {
      const arr = map.get(sub.taskId) ?? [];
      arr.push(sub);
      map.set(sub.taskId, arr);
    }
    return map;
  }, [subtasks]);

  // Filtered + sorted tasks for explore view
  const filteredTasks = useMemo(() => {
    let filtered = tasks;
    if (selectedProjectId !== null) {
      filtered = tasks.filter(t => t.projectId === selectedProjectId);
    } else if (selectedCategoryId !== null) {
      const projectIds = new Set(
        projects.filter(p => p.categoryId === selectedCategoryId).map(p => p.id),
      );
      filtered = tasks.filter(t => projectIds.has(t.projectId));
    }
    return sortTasks(filtered, sortBy);
  }, [tasks, projects, selectedProjectId, selectedCategoryId, sortBy]);

  const filteredCompletedTasks = useMemo(() => {
    let filtered = completedTasks;
    if (selectedProjectId !== null) {
      filtered = completedTasks.filter(t => t.projectId === selectedProjectId);
    } else if (selectedCategoryId !== null) {
      const projectIds = new Set(
        projects.filter(p => p.categoryId === selectedCategoryId).map(p => p.id),
      );
      filtered = completedTasks.filter(t => projectIds.has(t.projectId));
    }
    return [...filtered].sort(
      (a, b) => (b.completedAt ?? b.createdAt) - (a.completedAt ?? a.createdAt),
    );
  }, [completedTasks, projects, selectedProjectId, selectedCategoryId]);

  const currentlyWorkingTasks = useMemo(
    () => tasks.filter(t => t.status === 'currently_working'),
    [tasks],
  );

  const morningMeetingTasks = useMemo(
    () => tasks.filter(t => t.status === 'morning_meeting'),
    [tasks],
  );

  const selectedTask = useMemo(
    () => (selectedTaskId !== null ? tasks.find(t => t.id === selectedTaskId) ?? null : null),
    [selectedTaskId, tasks],
  );

  const selectedTaskSubtasks = useMemo(
    () => (selectedTaskId !== null ? subtasksByTaskId.get(selectedTaskId) ?? [] : []),
    [selectedTaskId, subtasksByTaskId],
  );

  const selectedProject = selectedTask ? projectMap.get(selectedTask.projectId) : null;
  const selectedCategory = selectedProject ? categoryMap.get(selectedProject.categoryId) : null;

  // Handlers
  function handleToggleCategory(categoryId: number) {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
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

  async function handleSubtaskToggle(subtaskId: number) {
    const sub = subtasks.find(s => s.id === subtaskId);
    if (!sub) return;
    await updateSubtask(subtaskId, {
      completed: !sub.completed,
      completedAt: !sub.completed ? Date.now() : null,
    });
  }

  async function handleMarkComplete(taskId: number) {
    await completeTask(taskId);
    if (selectedTaskId === taskId) setSelectedTaskId(null);
  }

  async function handleRestoreTask(taskId: number) {
    await updateTask(taskId, { completed: false, completedAt: null });
  }

  async function handleFlagToggle(taskId: number) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    const FLAG_CYCLE: (TaskFlag | null)[] = [null, 'urgent', 'important'];
    const next = FLAG_CYCLE[(FLAG_CYCLE.indexOf(task.flag) + 1) % FLAG_CYCLE.length];
    await updateTask(taskId, { flag: next });
  }

  async function handleStatusToggle(taskId: number) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    const STATUS_CYCLE: TaskStatus[] = ['normal', 'currently_working', 'morning_meeting'];
    const next = STATUS_CYCLE[(STATUS_CYCLE.indexOf(task.status) + 1) % STATUS_CYCLE.length];
    await updateTask(taskId, { status: next });
  }

  async function handleAddCategory(name: string) {
    const category = await createCategory(name);
    setExpandedCategories(prev => new Set(prev).add(category.id));
  }

  async function handleAddProject(categoryId: number, name: string) {
    await createProject(categoryId, name);
  }

  async function handleThemeToggle() {
    const next: Theme = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    await updateSettings({ theme: next });
  }

  async function handleBackUp() {
    const json = await exportDB();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `task-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setShowBackupPrompt(false);
  }

  const showSidebar = view === 'explore';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <TopNav
        view={view}
        onViewChange={handleViewChange}
        theme={theme}
        onThemeToggle={handleThemeToggle}
      />

      <div className="flex pt-14 h-screen">
        {showSidebar && (
          <Sidebar
            categories={categories}
            projects={projects}
            selectedCategoryId={selectedCategoryId}
            selectedProjectId={selectedProjectId}
            expandedCategories={expandedCategories}
            onToggleCategory={handleToggleCategory}
            onSelectProject={handleSelectProject}
            onSelectAll={handleSelectAll}
            onAddCategory={handleAddCategory}
            onAddProject={handleAddProject}
          />
        )}

        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {view === 'explore' && (
            <ExploreView
              tasks={filteredTasks}
              completedTasks={filteredCompletedTasks}
              subtasksByTaskId={subtasksByTaskId}
              projectMap={projectMap}
              sortBy={sortBy}
              onSortChange={setSortBy}
              onTaskClick={setSelectedTaskId}
              onSubtaskToggle={handleSubtaskToggle}
              onCompleteTask={handleMarkComplete}
              onRestoreTask={handleRestoreTask}
              onFlagToggle={handleFlagToggle}
              onStatusToggle={handleStatusToggle}
            />
          )}

          {view === 'currently_working' && (
            <CurrentlyWorkingView
              tasks={currentlyWorkingTasks}
              subtasksByTaskId={subtasksByTaskId}
              projectMap={projectMap}
              onTaskClick={setSelectedTaskId}
              onSubtaskToggle={handleSubtaskToggle}
              onCompleteTask={handleMarkComplete}
              onFlagToggle={handleFlagToggle}
              onStatusToggle={handleStatusToggle}
            />
          )}

          {view === 'morning_meeting' && (
            <MorningMeetingView
              tasks={morningMeetingTasks}
              subtasksByTaskId={subtasksByTaskId}
              projectMap={projectMap}
              onTaskClick={setSelectedTaskId}
              onSubtaskToggle={handleSubtaskToggle}
              onCompleteTask={handleMarkComplete}
              onFlagToggle={handleFlagToggle}
              onStatusToggle={handleStatusToggle}
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
        onSubtaskToggle={handleSubtaskToggle}
        onMarkComplete={() => selectedTask && handleMarkComplete(selectedTask.id)}
        onFlagToggle={() => selectedTask && handleFlagToggle(selectedTask.id)}
        onStatusToggle={() => selectedTask && handleStatusToggle(selectedTask.id)}
      />

      {showBackupPrompt && (
        <BackupPromptModal
          onBackUp={handleBackUp}
          onDismiss={() => setShowBackupPrompt(false)}
        />
      )}
    </div>
  );
}
