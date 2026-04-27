import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { AppView, Category, Project, SortBy, TaskFlag, TaskStatus, Theme } from './types';
import { MOCK_CATEGORIES, MOCK_PROJECTS, MOCK_SUBTASKS, MOCK_TASKS } from './data/mockData';
import { db } from './db/database';
import {
  completeTask, createTask, deleteTask, updateTask,
  createSubtask, updateSubtask, deleteSubtask,
  updateSettings,
  createCategory, createProject, updateCategory, deleteCategory, updateProject, deleteProject,
  swapCategorySortOrder, swapProjectSortOrder, swapSubtaskSortOrder,
} from './db/crud';
import { exportDB, shouldPromptBackup } from './db/backup';
import { sortTasks } from './utils/tasks';
import type { PanelMode } from './components/layout/SidePanel';
import { TopNav } from './components/layout/TopNav';
import { Sidebar } from './components/layout/Sidebar';
import { SidePanel } from './components/layout/SidePanel';
import { BackupPromptModal } from './components/layout/BackupPromptModal';
import { ExploreView } from './views/ExploreView';
import { CurrentlyWorkingView } from './views/CurrentlyWorkingView';
import { MorningMeetingView } from './views/MorningMeetingView';
import { SearchView } from './views/SearchView';
import { CalendarView } from './views/CalendarView';
import { StatisticsView } from './views/StatisticsView';
import { SettingsView } from './views/SettingsView';
import { generateWeeklyReport } from './utils/pdf';
import type { ReportRange } from './utils/pdf';
import { ReportDialog } from './components/layout/ReportDialog';

export default function App() {
  const [view, setView] = useState<AppView>('explore');
  const [theme, setTheme] = useState<Theme>('light');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<number>>(new Set());
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [sidePanelMode, setSidePanelMode] = useState<PanelMode>('view');
  const [sortBy, setSortBy] = useState<SortBy>('dueDate');
  const [showBackupPrompt, setShowBackupPrompt] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [calendarCreatePreset, setCalendarCreatePreset] = useState<{ categoryId: number; projectId: number } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Live queries — UI re-renders automatically when DB changes
  const categoriesRaw = useLiveQuery(() => db.categories.orderBy('sortOrder').toArray(), []);
  const projectsRaw = useLiveQuery(() => db.projects.orderBy('sortOrder').toArray(), []);
  const tasksRaw = useLiveQuery(() => db.tasks.filter(t => !t.completed).toArray(), []);
  const completedTasksRaw = useLiveQuery(() => db.tasks.filter(t => t.completed).toArray(), []);
  const subtasksRaw = useLiveQuery(() => db.subtasks.orderBy('sortOrder').toArray(), []);

  const isLoading = categoriesRaw === undefined;
  const categories = categoriesRaw ?? [];
  const projects = projectsRaw ?? [];
  const tasks = tasksRaw ?? [];
  const completedTasks = completedTasksRaw ?? [];
  const subtasks = subtasksRaw ?? [];

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

  // Auto-dismiss error toast after 4 seconds
  useEffect(() => {
    if (!errorMessage) return;
    const timer = setTimeout(() => setErrorMessage(null), 4000);
    return () => clearTimeout(timer);
  }, [errorMessage]);

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
    () => sortTasks(
      tasks.filter(t => t.status === 'currently_working' || t.status === 'morning_meeting'),
      'dueDate',
    ),
    [tasks],
  );

  const morningMeetingTasks = useMemo(
    () => sortTasks(tasks.filter(t => t.status === 'morning_meeting'), 'dueDate'),
    [tasks],
  );

  const allTasksForSearch = useMemo(
    () => [...tasks, ...completedTasks],
    [tasks, completedTasks],
  );

  const selectedTask = useMemo(
    () => (selectedTaskId !== null ? allTasksForSearch.find(t => t.id === selectedTaskId) ?? null : null),
    [selectedTaskId, allTasksForSearch],
  );

  const selectedTaskSubtasks = useMemo(
    () => (selectedTaskId !== null ? subtasksByTaskId.get(selectedTaskId) ?? [] : []),
    [selectedTaskId, subtasksByTaskId],
  );

  const selectedProject = selectedTask ? projectMap.get(selectedTask.projectId) : null;
  const selectedCategory = selectedProject ? categoryMap.get(selectedProject.categoryId) : null;

  const isPanelOpen = selectedTaskId !== null || sidePanelMode === 'create';

  // ── Panel helpers ────────────────────────────────────────────────────────────

  function closePanel() {
    setSelectedTaskId(null);
    setSidePanelMode('view');
    setCalendarCreatePreset(null);
  }

  function handleOpenCreate(preset?: { categoryId: number; projectId: number }) {
    setSelectedTaskId(null);
    setCalendarCreatePreset(preset ?? null);
    setSidePanelMode('create');
  }

  function handleOpenEdit() {
    setSidePanelMode('edit');
  }

  // ── Handlers ─────────────────────────────────────────────────────────────────

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
    closePanel();
  }

  async function handleSubtaskToggle(subtaskId: number) {
    const sub = subtasks.find(s => s.id === subtaskId);
    if (!sub) return;
    try {
      await updateSubtask(subtaskId, {
        completed: !sub.completed,
        completedAt: !sub.completed ? Date.now() : null,
      });
    } catch {
      setErrorMessage('Failed to update subtask. Please try again.');
    }
  }

  async function handleMarkComplete(taskId: number) {
    try {
      await completeTask(taskId);
      if (selectedTaskId === taskId) closePanel();
    } catch {
      setErrorMessage('Failed to complete task. Please try again.');
    }
  }

  async function handleRestoreTask(taskId: number) {
    try {
      await updateTask(taskId, { completed: false, completedAt: null });
    } catch {
      setErrorMessage('Failed to restore task. Please try again.');
    }
  }

  async function handleFlagToggle(taskId: number) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    const FLAG_CYCLE: (TaskFlag | null)[] = [null, 'urgent', 'important'];
    const next = FLAG_CYCLE[(FLAG_CYCLE.indexOf(task.flag) + 1) % FLAG_CYCLE.length];
    try {
      await updateTask(taskId, { flag: next });
    } catch {
      setErrorMessage('Failed to update task flag. Please try again.');
    }
  }

  async function handleStatusToggle(taskId: number) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    const STATUS_CYCLE: TaskStatus[] = ['normal', 'currently_working', 'morning_meeting'];
    const next = STATUS_CYCLE[(STATUS_CYCLE.indexOf(task.status) + 1) % STATUS_CYCLE.length];
    try {
      await updateTask(taskId, { status: next });
    } catch {
      setErrorMessage('Failed to update task status. Please try again.');
    }
  }

  async function handleAddCategory(name: string) {
    try {
      const category = await createCategory(name);
      setExpandedCategories(prev => new Set(prev).add(category.id));
    } catch {
      setErrorMessage('Failed to add category. Please try again.');
    }
  }

  async function handleAddProject(categoryId: number, name: string) {
    try {
      await createProject(categoryId, name);
    } catch {
      setErrorMessage('Failed to add project. Please try again.');
    }
  }

  async function handleRenameCategory(id: number, name: string) {
    try {
      await updateCategory(id, { name });
    } catch {
      setErrorMessage('Failed to rename category. Please try again.');
    }
  }

  async function handleDeleteCategory(id: number) {
    try {
      await deleteCategory(id);
      if (selectedCategoryId === id) {
        setSelectedCategoryId(null);
        setSelectedProjectId(null);
      }
    } catch {
      setErrorMessage('Failed to delete category. Please try again.');
    }
  }

  async function handleRenameProject(id: number, name: string) {
    try {
      await updateProject(id, { name });
    } catch {
      setErrorMessage('Failed to rename project. Please try again.');
    }
  }

  async function handleDeleteProject(id: number) {
    try {
      await deleteProject(id);
      if (selectedProjectId === id) {
        setSelectedProjectId(null);
      }
    } catch {
      setErrorMessage('Failed to delete project. Please try again.');
    }
  }

  async function handleMoveCategoryUp(id: number) {
    const idx = categories.findIndex(c => c.id === id);
    if (idx <= 0) return;
    try {
      await swapCategorySortOrder(id, categories[idx - 1].id);
    } catch {
      setErrorMessage('Failed to reorder category. Please try again.');
    }
  }

  async function handleMoveCategoryDown(id: number) {
    const idx = categories.findIndex(c => c.id === id);
    if (idx < 0 || idx >= categories.length - 1) return;
    try {
      await swapCategorySortOrder(id, categories[idx + 1].id);
    } catch {
      setErrorMessage('Failed to reorder category. Please try again.');
    }
  }

  async function handleMoveProjectUp(id: number) {
    const proj = projects.find(p => p.id === id);
    if (!proj) return;
    const siblings = projects.filter(p => p.categoryId === proj.categoryId);
    const idx = siblings.findIndex(p => p.id === id);
    if (idx <= 0) return;
    try {
      await swapProjectSortOrder(id, siblings[idx - 1].id);
    } catch {
      setErrorMessage('Failed to reorder project. Please try again.');
    }
  }

  async function handleMoveProjectDown(id: number) {
    const proj = projects.find(p => p.id === id);
    if (!proj) return;
    const siblings = projects.filter(p => p.categoryId === proj.categoryId);
    const idx = siblings.findIndex(p => p.id === id);
    if (idx < 0 || idx >= siblings.length - 1) return;
    try {
      await swapProjectSortOrder(id, siblings[idx + 1].id);
    } catch {
      setErrorMessage('Failed to reorder project. Please try again.');
    }
  }

  async function handleThemeToggle() {
    const next: Theme = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    try {
      await updateSettings({ theme: next });
    } catch {
      setErrorMessage('Failed to save theme preference. Please try again.');
    }
  }

  function handleDownloadReport(range: ReportRange) {
    generateWeeklyReport(tasks, completedTasks, subtasks, projects, categories, range);
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

  async function handleCreateTask(input: Parameters<typeof createTask>[0]) {
    try {
      await createTask(input);
      closePanel();
    } catch {
      setErrorMessage('Failed to create task. Please try again.');
    }
  }

  async function handleUpdateTask(
    taskId: number,
    changes: Parameters<typeof updateTask>[1],
  ) {
    try {
      await updateTask(taskId, changes);
      setSidePanelMode('view');
    } catch {
      setErrorMessage('Failed to save task changes. Please try again.');
    }
  }

  async function handleDeleteTask(taskId: number) {
    try {
      await deleteTask(taskId);
      closePanel();
    } catch {
      setErrorMessage('Failed to delete task. Please try again.');
    }
  }

  async function handleAddSubtask(taskId: number, title: string, dueDate: string | null) {
    try {
      await createSubtask({ taskId, title, dueDate, completed: false, completedAt: null });
    } catch {
      setErrorMessage('Failed to add subtask. Please try again.');
    }
  }

  async function handleUpdateSubtask(subtaskId: number, title: string) {
    try {
      await updateSubtask(subtaskId, { title });
    } catch {
      setErrorMessage('Failed to update subtask. Please try again.');
    }
  }

  async function handleDeleteSubtask(subtaskId: number) {
    try {
      await deleteSubtask(subtaskId);
    } catch {
      setErrorMessage('Failed to delete subtask. Please try again.');
    }
  }

  async function handleMoveSubtask(subtaskId: number, taskId: number, direction: 'up' | 'down') {
    const taskSubs = subtasks.filter(s => s.taskId === taskId);
    const idx = taskSubs.findIndex(s => s.id === subtaskId);
    if (idx < 0) return;
    const neighborIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (neighborIdx < 0 || neighborIdx >= taskSubs.length) return;
    try {
      await swapSubtaskSortOrder(subtaskId, taskSubs[neighborIdx].id);
    } catch {
      setErrorMessage('Failed to reorder subtask. Please try again.');
    }
  }

  const showSidebar = view === 'explore';

  return (
    <div className="h-dvh overflow-hidden bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <TopNav
        view={view}
        onViewChange={handleViewChange}
        theme={theme}
        onThemeToggle={handleThemeToggle}
        onCreateTask={handleOpenCreate}
        onSearch={() => handleViewChange('search')}
        onSettings={() => handleViewChange('settings')}
      />

      <div className="flex pt-14 h-full">
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
            onRenameCategory={handleRenameCategory}
            onDeleteCategory={handleDeleteCategory}
            onRenameProject={handleRenameProject}
            onDeleteProject={handleDeleteProject}
            onMoveCategoryUp={handleMoveCategoryUp}
            onMoveCategoryDown={handleMoveCategoryDown}
            onMoveProjectUp={handleMoveProjectUp}
            onMoveProjectDown={handleMoveProjectDown}
          />
        )}

        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-sm text-gray-400 dark:text-gray-500">Loading…</p>
            </div>
          ) : (
            <>
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
                  onAddSubtask={(taskId, title) => handleAddSubtask(taskId, title, null)}
                  onUpdateSubtask={handleUpdateSubtask}
                  onDeleteSubtask={handleDeleteSubtask}
                  onMoveSubtaskUp={(id, taskId) => handleMoveSubtask(id, taskId, 'up')}
                  onMoveSubtaskDown={(id, taskId) => handleMoveSubtask(id, taskId, 'down')}
                  onAddTask={selectedProjectId !== null ? handleOpenCreate : undefined}
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
                  onAddSubtask={(taskId, title) => handleAddSubtask(taskId, title, null)}
                  onUpdateSubtask={handleUpdateSubtask}
                  onDeleteSubtask={handleDeleteSubtask}
                  onMoveSubtaskUp={(id, taskId) => handleMoveSubtask(id, taskId, 'up')}
                  onMoveSubtaskDown={(id, taskId) => handleMoveSubtask(id, taskId, 'down')}
                  onDownloadReport={() => setShowReportDialog(true)}
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
                  onAddSubtask={(taskId, title) => handleAddSubtask(taskId, title, null)}
                  onUpdateSubtask={handleUpdateSubtask}
                  onDeleteSubtask={handleDeleteSubtask}
                  onMoveSubtaskUp={(id, taskId) => handleMoveSubtask(id, taskId, 'up')}
                  onMoveSubtaskDown={(id, taskId) => handleMoveSubtask(id, taskId, 'down')}
                />
              )}

              {view === 'search' && (
                <SearchView
                  allTasks={allTasksForSearch}
                  subtasksByTaskId={subtasksByTaskId}
                  projectMap={projectMap}
                  categories={categories}
                  projects={projects}
                  onTaskClick={setSelectedTaskId}
                  onSubtaskToggle={handleSubtaskToggle}
                  onCompleteTask={handleMarkComplete}
                  onRestoreTask={handleRestoreTask}
                  onFlagToggle={handleFlagToggle}
                  onStatusToggle={handleStatusToggle}
                  onAddSubtask={(taskId, title) => handleAddSubtask(taskId, title, null)}
                  onUpdateSubtask={handleUpdateSubtask}
                  onDeleteSubtask={handleDeleteSubtask}
                  onMoveSubtaskUp={(id, taskId) => handleMoveSubtask(id, taskId, 'up')}
                  onMoveSubtaskDown={(id, taskId) => handleMoveSubtask(id, taskId, 'down')}
                />
              )}

              {view === 'statistics' && (
                <StatisticsView
                  allTasks={allTasksForSearch}
                  projects={projects}
                  categories={categories}
                />
              )}

              {view === 'calendar' && (
                <CalendarView
                  categories={categories}
                  projects={projects}
                  tasks={tasks}
                  allTasks={allTasksForSearch}
                  onCreateTask={handleOpenCreate}
                />
              )}

              {view === 'settings' && <SettingsView />}
            </>
          )}
        </main>
      </div>

      <SidePanel
        mode={sidePanelMode}
        task={selectedTask}
        subtasks={selectedTaskSubtasks}
        projectName={selectedProject?.name ?? ''}
        categoryName={selectedCategory?.name ?? ''}
        categories={categories}
        projects={projects}
        isOpen={isPanelOpen}
        createPreset={
          calendarCreatePreset ??
          (selectedProjectId !== null && selectedCategoryId !== null
            ? { categoryId: selectedCategoryId, projectId: selectedProjectId }
            : undefined)
        }
        onClose={closePanel}
        onSubtaskToggle={handleSubtaskToggle}
        onMarkComplete={() => selectedTask && handleMarkComplete(selectedTask.id)}
        onFlagToggle={() => selectedTask && handleFlagToggle(selectedTask.id)}
        onStatusToggle={() => selectedTask && handleStatusToggle(selectedTask.id)}
        onEdit={handleOpenEdit}
        onCreateTask={handleCreateTask}
        onUpdateTask={handleUpdateTask}
        onDeleteTask={handleDeleteTask}
        onAddSubtask={handleAddSubtask}
        onUpdateSubtask={handleUpdateSubtask}
        onDeleteSubtask={handleDeleteSubtask}
        onMoveSubtaskUp={(id, taskId) => handleMoveSubtask(id, taskId, 'up')}
        onMoveSubtaskDown={(id, taskId) => handleMoveSubtask(id, taskId, 'down')}
      />

      {showBackupPrompt && (
        <BackupPromptModal
          onBackUp={handleBackUp}
          onDismiss={() => setShowBackupPrompt(false)}
        />
      )}

      {showReportDialog && (
        <ReportDialog
          onGenerate={handleDownloadReport}
          onClose={() => setShowReportDialog(false)}
        />
      )}

      {errorMessage && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-3 max-w-sm px-4 py-3 bg-red-600 text-white text-sm font-medium rounded-lg shadow-lg">
          <span className="flex-1">{errorMessage}</span>
          <button
            onClick={() => setErrorMessage(null)}
            className="shrink-0 w-5 h-5 flex items-center justify-center rounded hover:bg-red-500 transition-colors text-base leading-none"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
