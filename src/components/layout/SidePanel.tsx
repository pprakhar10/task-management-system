import { useEffect, useState } from 'react';
import type { Category, Project, Subtask, Task, TaskFlag } from '../../types';
import { SubtaskItem } from '../tasks/SubtaskItem';

export type PanelMode = 'view' | 'create' | 'edit';

interface Props {
  mode: PanelMode;
  task: Task | null;
  subtasks: Subtask[];
  projectName: string;
  categoryName: string;
  categories: Category[];
  projects: Project[];
  isOpen: boolean;
  createPreset?: { categoryId: number; projectId: number };
  onClose: () => void;
  onSubtaskToggle: (subtaskId: number) => void;
  onMarkComplete: () => void;
  onFlagToggle: () => void;
  onStatusToggle: () => void;
  onEdit: () => void;
  onCreateTask: (input: Omit<Task, 'id' | 'createdAt'>) => void;
  onUpdateTask: (taskId: number, changes: Partial<Omit<Task, 'id' | 'createdAt'>>) => void;
  onDeleteTask: (taskId: number) => void;
  onAddSubtask: (taskId: number, title: string, dueDate: string | null) => void;
  onUpdateSubtask: (subtaskId: number, title: string) => void;
  onDeleteSubtask: (subtaskId: number) => void;
  onMoveSubtaskUp: (subtaskId: number, taskId: number) => void;
  onMoveSubtaskDown: (subtaskId: number, taskId: number) => void;
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

const ICON_CHECK = (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);

const ICON_X = (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const ICON_PENCIL = (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
  </svg>
);

const ICON_TRASH = (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const ICON_UP = (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
  </svg>
);

const ICON_DOWN = (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
  </svg>
);

const INPUT_CLASS =
  'w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-400';

const INLINE_INPUT_CLASS =
  'flex-1 min-w-0 text-sm px-2 py-1 rounded-md border border-indigo-300 dark:border-indigo-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-400';

const LABEL_CLASS =
  'block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1';

export function SidePanel({
  mode, task, subtasks, projectName, categoryName, categories, projects,
  isOpen, createPreset, onClose, onSubtaskToggle, onMarkComplete, onFlagToggle, onStatusToggle,
  onEdit, onCreateTask, onUpdateTask, onDeleteTask, onAddSubtask, onUpdateSubtask, onDeleteSubtask,
  onMoveSubtaskUp, onMoveSubtaskDown,
}: Props) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [editingSubtaskId, setEditingSubtaskId] = useState<number | null>(null);
  const [editSubtaskTitle, setEditSubtaskTitle] = useState('');

  // Form state (shared between create and edit modes)
  const [formTitle, setFormTitle] = useState('');
  const [formStartDate, setFormStartDate] = useState('');
  const [formDueDate, setFormDueDate] = useState('');
  const [formWorkType, setFormWorkType] = useState<'deep' | 'shallow'>('deep');
  const [formFlag, setFormFlag] = useState<TaskFlag | null>(null);
  const [formCategoryId, setFormCategoryId] = useState<number | null>(null);
  const [formProjectId, setFormProjectId] = useState<number | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Reset state when mode or task changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setShowDeleteConfirm(false);
    setAddingSubtask(false);
    setNewSubtaskTitle('');
    setEditingSubtaskId(null);
    setFormError(null);

    if (mode === 'create') {
      setFormTitle('');
      const today = new Date();
      setFormStartDate(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`);
      setFormDueDate('');
      setFormWorkType('deep');
      setFormFlag(null);
      setFormCategoryId(createPreset?.categoryId ?? null);
      setFormProjectId(createPreset?.projectId ?? null);
    } else if (mode === 'edit' && task) {
      const proj = projects.find(p => p.id === task.projectId);
      setFormTitle(task.title);
      setFormStartDate(task.startDate);
      setFormDueDate(task.dueDate);
      setFormWorkType(task.workType === 'shallow' ? 'shallow' : 'deep');
      setFormFlag(task.flag);
      setFormCategoryId(proj?.categoryId ?? null);
      setFormProjectId(task.projectId);
    }
  }, [mode, task?.id]); // intentionally omits task/projects to avoid resetting on field-level updates

  const formProjects =
    formCategoryId !== null ? projects.filter(p => p.categoryId === formCategoryId) : [];

  function handleCategorySelect(catId: number | null) {
    setFormCategoryId(catId);
    setFormProjectId(null);
  }

  function handleFormSubmit() {
    const title = formTitle.trim();
    if (!title) { setFormError('Title is required.'); return; }
    if (!formStartDate) { setFormError('Start date is required.'); return; }
    if (!formDueDate) { setFormError('Due date is required.'); return; }
    if (formStartDate > formDueDate) { setFormError('Start date must be on or before due date.'); return; }
    if (formProjectId === null) { setFormError('Please select a category and project.'); return; }
    setFormError(null);

    if (mode === 'create') {
      onCreateTask({
        projectId: formProjectId,
        workType: formWorkType,
        title,
        startDate: formStartDate,
        dueDate: formDueDate,
        flag: formFlag,
        status: 'normal',
        completed: false,
        completedAt: null,
      });
    } else if (mode === 'edit' && task) {
      onUpdateTask(task.id, {
        projectId: formProjectId,
        workType: formWorkType,
        title,
        startDate: formStartDate,
        dueDate: formDueDate,
        flag: formFlag,
      });
    }
  }

  function handleAddSubtaskConfirm() {
    const title = newSubtaskTitle.trim();
    if (!title || !task) return;
    onAddSubtask(task.id, title, null);
    setNewSubtaskTitle('');
    setAddingSubtask(false);
  }

  function handleEditSubtaskConfirm() {
    if (editingSubtaskId === null) return;
    const title = editSubtaskTitle.trim();
    if (title) onUpdateSubtask(editingSubtaskId, title);
    setEditingSubtaskId(null);
    setEditSubtaskTitle('');
  }

  const isFormMode = mode === 'create' || mode === 'edit';
  const showContent = isFormMode || task !== null;

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
        {showContent && (
          <>
            {/* Header */}
            <div className="flex items-start justify-between gap-3 p-5 border-b border-gray-200 dark:border-gray-700">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">
                  {mode === 'create'
                    ? 'New task'
                    : mode === 'edit'
                    ? 'Editing task'
                    : `${categoryName} › ${projectName}`}
                </p>
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 leading-snug">
                  {mode === 'create' ? 'New Task' : task?.title ?? ''}
                </h2>
              </div>
              <button
                onClick={onClose}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors shrink-0"
                aria-label="Close panel"
              >
                {ICON_X}
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {isFormMode ? (
                <div className="space-y-4">
                  {/* Title */}
                  <div>
                    <label className={LABEL_CLASS}>
                      Title <span className="text-red-500">*</span>
                    </label>
                    <input
                      autoFocus
                      type="text"
                      value={formTitle}
                      onChange={e => setFormTitle(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleFormSubmit(); }}
                      placeholder="Task title"
                      className={INPUT_CLASS}
                    />
                  </div>

                  {/* Start Date */}
                  <div>
                    <label className={LABEL_CLASS}>
                      Start Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={formStartDate}
                      onChange={e => setFormStartDate(e.target.value)}
                      className={INPUT_CLASS}
                    />
                  </div>

                  {/* Due Date */}
                  <div>
                    <label className={LABEL_CLASS}>
                      Due Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={formDueDate}
                      onChange={e => setFormDueDate(e.target.value)}
                      className={INPUT_CLASS}
                    />
                  </div>

                  {/* Work Type */}
                  <div>
                    <label className={LABEL_CLASS}>Work Type</label>
                    <div className="flex gap-2">
                      {(['deep', 'shallow'] as const).map(wt => (
                        <button
                          key={wt}
                          type="button"
                          onClick={() => setFormWorkType(wt)}
                          className={`flex-1 min-h-[40px] text-sm font-medium rounded-lg border transition-colors ${
                            formWorkType === wt
                              ? wt === 'deep'
                                ? 'bg-blue-100 border-blue-300 text-blue-700 dark:bg-blue-900/40 dark:border-blue-600 dark:text-blue-300'
                                : 'bg-emerald-100 border-emerald-300 text-emerald-700 dark:bg-emerald-900/40 dark:border-emerald-600 dark:text-emerald-300'
                              : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                          }`}
                        >
                          {WORK_TYPE_LABEL[wt]}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Flag */}
                  <div>
                    <label className={LABEL_CLASS}>Flag</label>
                    <div className="flex gap-2">
                      {([null, 'urgent', 'important'] as (TaskFlag | null)[]).map(f => (
                        <button
                          key={String(f)}
                          type="button"
                          onClick={() => setFormFlag(f)}
                          className={`flex-1 min-h-[40px] text-sm font-medium rounded-lg border transition-colors ${
                            formFlag === f
                              ? f === 'urgent'
                                ? 'bg-red-100 border-red-300 text-red-700 dark:bg-red-900/40 dark:border-red-600 dark:text-red-400'
                                : f === 'important'
                                ? 'bg-amber-100 border-amber-300 text-amber-700 dark:bg-amber-900/40 dark:border-amber-600 dark:text-amber-400'
                                : 'bg-gray-100 border-gray-300 text-gray-700 dark:bg-gray-700 dark:border-gray-500 dark:text-gray-300'
                              : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700'
                          }`}
                        >
                          {f === null ? 'None' : f === 'urgent' ? 'Urgent' : 'Important'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Category */}
                  <div>
                    <label className={LABEL_CLASS}>
                      Category <span className="text-red-500">*</span>
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {categories.map(c => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => handleCategorySelect(c.id)}
                          className={`min-h-[40px] px-3 text-sm font-medium rounded-lg border transition-colors ${
                            formCategoryId === c.id
                              ? 'bg-indigo-100 border-indigo-300 text-indigo-700 dark:bg-indigo-900/40 dark:border-indigo-600 dark:text-indigo-300'
                              : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                          }`}
                        >
                          {c.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Project */}
                  {formCategoryId !== null && (
                    <div>
                      <label className={LABEL_CLASS}>
                        Project <span className="text-red-500">*</span>
                      </label>
                      {formProjects.length === 0 ? (
                        <p className="text-xs text-gray-400 dark:text-gray-500 italic">
                          No projects in this category.
                        </p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {formProjects.map(p => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => setFormProjectId(p.id)}
                              className={`min-h-[40px] px-3 text-sm font-medium rounded-lg border transition-colors ${
                                formProjectId === p.id
                                  ? 'bg-indigo-100 border-indigo-300 text-indigo-700 dark:bg-indigo-900/40 dark:border-indigo-600 dark:text-indigo-300'
                                  : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                              }`}
                            >
                              {p.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {formError && (
                    <p className="text-xs text-red-600 dark:text-red-400">{formError}</p>
                  )}
                </div>
              ) : task ? (
                <>
                  {/* Badges */}
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={onFlagToggle}
                      className={`text-xs font-semibold px-2.5 py-1 rounded-full transition-colors ${
                        task.flag === 'urgent'
                          ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/60'
                          : task.flag === 'important'
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/60'
                          : 'border border-dashed border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-500 hover:border-gray-400 dark:hover:border-gray-500'
                      }`}
                      aria-label="Cycle flag"
                    >
                      {task.flag === 'urgent'
                        ? 'Urgent'
                        : task.flag === 'important'
                        ? 'Important'
                        : 'Flag'}
                    </button>
                    <span
                      className={`text-xs font-medium px-2.5 py-1 rounded-full ${WORK_TYPE_BADGE[task.workType]}`}
                    >
                      {WORK_TYPE_LABEL[task.workType]}
                    </span>
                    <button
                      onClick={onStatusToggle}
                      className={`text-xs font-medium px-2.5 py-1 rounded-full transition-colors ${
                        task.status === 'currently_working'
                          ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300 hover:opacity-80'
                          : task.status === 'morning_meeting'
                          ? 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300 hover:opacity-80'
                          : 'border border-dashed border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-500 hover:border-gray-400 dark:hover:border-gray-500'
                      }`}
                      aria-label="Cycle status"
                    >
                      {task.status === 'currently_working'
                        ? 'Currently Working'
                        : task.status === 'morning_meeting'
                        ? 'Morning Meeting'
                        : 'Status'}
                    </button>
                  </div>

                  {/* Dates */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                        Start Date
                      </p>
                      <p className="text-sm text-gray-900 dark:text-gray-100">
                        {formatDate(task.startDate)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                        Due Date
                      </p>
                      <p className="text-sm text-gray-900 dark:text-gray-100">
                        {formatDate(task.dueDate)}
                      </p>
                    </div>
                  </div>

                  {/* Subtasks */}
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                      Subtasks ({subtasks.filter(s => s.completed).length} / {subtasks.length})
                    </p>

                    <div className="space-y-0 -mx-1">
                      {subtasks.map(subtask =>
                        editingSubtaskId === subtask.id ? (
                          <div
                            key={subtask.id}
                            className="flex items-center gap-1 px-1 py-1 min-h-[44px]"
                          >
                            <input
                              autoFocus
                              value={editSubtaskTitle}
                              onChange={e => setEditSubtaskTitle(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') handleEditSubtaskConfirm();
                                if (e.key === 'Escape') setEditingSubtaskId(null);
                              }}
                              className={INLINE_INPUT_CLASS}
                            />
                            <button
                              onClick={handleEditSubtaskConfirm}
                              className="min-h-[32px] min-w-[32px] flex items-center justify-center text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-md transition-colors"
                              aria-label="Save subtask"
                            >
                              {ICON_CHECK}
                            </button>
                            <button
                              onClick={() => setEditingSubtaskId(null)}
                              className="min-h-[32px] min-w-[32px] flex items-center justify-center text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                              aria-label="Cancel"
                            >
                              {ICON_X}
                            </button>
                          </div>
                        ) : (
                          <div key={subtask.id} className="flex items-center">
                            <div className="flex-1 min-w-0">
                              <SubtaskItem subtask={subtask} onToggle={onSubtaskToggle} />
                            </div>
                            <div className="flex items-center gap-0.5 shrink-0 pr-1">
                              {(() => {
                                const idx = subtasks.indexOf(subtask);
                                return (
                                  <>
                                    <button
                                      onClick={() => task && onMoveSubtaskUp(subtask.id, task.id)}
                                      disabled={idx === 0}
                                      className="min-h-[36px] min-w-[36px] flex items-center justify-center text-gray-300 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent dark:disabled:hover:bg-transparent"
                                      aria-label="Move subtask up"
                                    >
                                      {ICON_UP}
                                    </button>
                                    <button
                                      onClick={() => task && onMoveSubtaskDown(subtask.id, task.id)}
                                      disabled={idx === subtasks.length - 1}
                                      className="min-h-[36px] min-w-[36px] flex items-center justify-center text-gray-300 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent dark:disabled:hover:bg-transparent"
                                      aria-label="Move subtask down"
                                    >
                                      {ICON_DOWN}
                                    </button>
                                  </>
                                );
                              })()}
                              <button
                                onClick={() => {
                                  setEditingSubtaskId(subtask.id);
                                  setEditSubtaskTitle(subtask.title);
                                }}
                                className="min-h-[36px] min-w-[36px] flex items-center justify-center text-gray-300 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                                aria-label="Edit subtask"
                              >
                                {ICON_PENCIL}
                              </button>
                              <button
                                onClick={() => onDeleteSubtask(subtask.id)}
                                className="min-h-[36px] min-w-[36px] flex items-center justify-center text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                                aria-label="Delete subtask"
                              >
                                {ICON_TRASH}
                              </button>
                            </div>
                          </div>
                        ),
                      )}
                    </div>

                    {addingSubtask ? (
                      <div className="flex items-center gap-1 mt-1 px-1">
                        <input
                          autoFocus
                          value={newSubtaskTitle}
                          onChange={e => setNewSubtaskTitle(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleAddSubtaskConfirm();
                            if (e.key === 'Escape') {
                              setAddingSubtask(false);
                              setNewSubtaskTitle('');
                            }
                          }}
                          placeholder="Subtask title"
                          className={INLINE_INPUT_CLASS}
                        />
                        <button
                          onClick={handleAddSubtaskConfirm}
                          className="min-h-[32px] min-w-[32px] flex items-center justify-center text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-md transition-colors"
                          aria-label="Add subtask"
                        >
                          {ICON_CHECK}
                        </button>
                        <button
                          onClick={() => {
                            setAddingSubtask(false);
                            setNewSubtaskTitle('');
                          }}
                          className="min-h-[32px] min-w-[32px] flex items-center justify-center text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                          aria-label="Cancel"
                        >
                          {ICON_X}
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setAddingSubtask(true)}
                        className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors min-h-[44px] px-1 mt-1"
                      >
                        <span className="text-base leading-none">+</span>
                        Add subtask
                      </button>
                    )}
                  </div>

                  {/* Delete confirm */}
                  {showDeleteConfirm && (
                    <div className="px-4 py-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                      <p className="text-xs font-medium text-red-700 dark:text-red-400 mb-2 leading-snug">
                        Delete this task and all its subtasks?
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            onDeleteTask(task.id);
                            setShowDeleteConfirm(false);
                          }}
                          className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs rounded-md font-medium transition-colors"
                        >
                          Delete
                        </button>
                        <button
                          onClick={() => setShowDeleteConfirm(false)}
                          className="px-3 py-1.5 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs rounded-md border border-gray-200 dark:border-gray-700 font-medium transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : null}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-700">
              {isFormMode ? (
                <div className="flex gap-2">
                  <button
                    onClick={onClose}
                    className="flex-1 min-h-[44px] border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 text-sm font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleFormSubmit}
                    className="flex-1 min-h-[44px] bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    {mode === 'create' ? 'Create Task' : 'Save Changes'}
                  </button>
                </div>
              ) : task ? (
                <div className="flex gap-2">
                  <button
                    onClick={onMarkComplete}
                    className="flex-1 min-h-[44px] bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    Mark Complete
                  </button>
                  <button
                    onClick={onEdit}
                    className="min-h-[44px] px-4 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 text-sm font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center border border-gray-200 dark:border-gray-700 text-red-500 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-200 dark:hover:border-red-800 transition-colors"
                    aria-label="Delete task"
                  >
                    {ICON_TRASH}
                  </button>
                </div>
              ) : null}
            </div>
          </>
        )}
      </div>
    </>
  );
}
