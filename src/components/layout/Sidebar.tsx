import { useRef, useState } from 'react';
import type { Category, Project } from '../../types';

interface Props {
  categories: Category[];
  projects: Project[];
  selectedCategoryId: number | null;
  selectedProjectId: number | null;
  expandedCategories: Set<number>;
  onToggleCategory: (categoryId: number) => void;
  onSelectProject: (projectId: number, categoryId: number) => void;
  onSelectAll: () => void;
  onAddCategory: (name: string) => void;
  onAddProject: (categoryId: number, name: string) => void;
  onRenameCategory: (id: number, name: string) => void;
  onDeleteCategory: (id: number) => void;
  onRenameProject: (id: number, name: string) => void;
  onDeleteProject: (id: number) => void;
}

interface InlineInputProps {
  placeholder: string;
  defaultValue?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

function InlineInput({ placeholder, defaultValue = '', onConfirm, onCancel }: InlineInputProps) {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleConfirm() {
    const trimmed = value.trim();
    if (trimmed) onConfirm(trimmed);
    else onCancel();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleConfirm();
    if (e.key === 'Escape') onCancel();
  }

  return (
    <div className="flex items-center gap-1 px-1 py-1">
      <input
        ref={inputRef}
        autoFocus
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="flex-1 min-w-0 text-sm px-2 py-1.5 rounded-md border border-indigo-300 dark:border-indigo-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-400"
      />
      <button
        onClick={handleConfirm}
        className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded-md text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
        aria-label="Confirm"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </button>
      <button
        onClick={onCancel}
        className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded-md text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        aria-label="Cancel"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

interface InlineConfirmProps {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function InlineConfirm({ message, onConfirm, onCancel }: InlineConfirmProps) {
  return (
    <div className="mx-1 my-0.5 px-2 py-1.5 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-400">
      <p className="mb-1.5 leading-snug">{message}</p>
      <div className="flex gap-2">
        <button
          onClick={onConfirm}
          className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded-md font-medium transition-colors"
        >
          Delete
        </button>
        <button
          onClick={onCancel}
          className="px-2.5 py-1 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-md border border-gray-200 dark:border-gray-700 font-medium transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function DotsIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="5" cy="12" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="19" cy="12" r="2" />
    </svg>
  );
}

const ICON_RENAME = (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
  </svg>
);

const ICON_DELETE = (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

export function Sidebar({
  categories,
  projects,
  selectedCategoryId,
  selectedProjectId,
  expandedCategories,
  onToggleCategory,
  onSelectProject,
  onSelectAll,
  onAddCategory,
  onAddProject,
  onRenameCategory,
  onDeleteCategory,
  onRenameProject,
  onDeleteProject,
}: Props) {
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [addingProjectForCategoryId, setAddingProjectForCategoryId] = useState<number | null>(null);
  const [openMenuFor, setOpenMenuFor] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function toggleMenu(id: string) {
    setOpenMenuFor(prev => (prev === id ? null : id));
    setRenamingId(null);
    setDeletingId(null);
  }

  function handleAddCategory(name: string) {
    onAddCategory(name);
    setIsAddingCategory(false);
  }

  function handleAddProject(categoryId: number, name: string) {
    onAddProject(categoryId, name);
    setAddingProjectForCategoryId(null);
  }

  return (
    <aside className="w-64 shrink-0 bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 overflow-y-auto">
      <div className="p-3">
        <button
          onClick={onSelectAll}
          className={`w-full text-left min-h-[44px] px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            selectedProjectId === null && selectedCategoryId === null
              ? 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
        >
          All Tasks
        </button>

        <div className="mt-2 space-y-1">
          {categories.map(category => {
            const catKey = `cat-${category.id}`;
            const isExpanded = expandedCategories.has(category.id);
            const categoryProjects = projects.filter(p => p.categoryId === category.id);
            const isCategorySelected = selectedCategoryId === category.id && selectedProjectId === null;
            const isAddingProjectHere = addingProjectForCategoryId === category.id;

            return (
              <div key={category.id}>
                {/* Category row */}
                {renamingId === catKey ? (
                  <InlineInput
                    placeholder="Category name"
                    defaultValue={category.name}
                    onConfirm={name => { onRenameCategory(category.id, name); setRenamingId(null); }}
                    onCancel={() => setRenamingId(null)}
                  />
                ) : deletingId === catKey ? (
                  <InlineConfirm
                    message={`Delete "${category.name}" and all its projects and tasks?`}
                    onConfirm={() => { onDeleteCategory(category.id); setDeletingId(null); }}
                    onCancel={() => setDeletingId(null)}
                  />
                ) : (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onToggleCategory(category.id)}
                      className="flex items-center gap-2 flex-1 min-h-[44px] px-3 py-2 rounded-lg text-sm font-semibold transition-colors text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 overflow-hidden"
                      aria-expanded={isExpanded}
                    >
                      <svg
                        className={`w-4 h-4 text-gray-400 transition-transform shrink-0 ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2.5}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                      <span className={`truncate ${isCategorySelected ? 'text-indigo-700 dark:text-indigo-300' : ''}`} title={category.name}>
                        {category.name}
                      </span>
                    </button>
                    <button
                      onClick={() => toggleMenu(catKey)}
                      className={`min-h-[32px] min-w-[32px] flex items-center justify-center rounded-md transition-colors shrink-0 ${
                        openMenuFor === catKey
                          ? 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                          : 'text-gray-400 dark:text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-300'
                      }`}
                      aria-label="Category options"
                    >
                      <DotsIcon />
                    </button>
                  </div>
                )}

                {/* Category inline menu */}
                {openMenuFor === catKey && (
                  <div className="ml-2 mb-1 flex gap-1">
                    <button
                      onClick={() => { setRenamingId(catKey); setOpenMenuFor(null); }}
                      className="flex-1 flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                      {ICON_RENAME}
                      Rename
                    </button>
                    <button
                      onClick={() => { setDeletingId(catKey); setOpenMenuFor(null); }}
                      className="flex-1 flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                      {ICON_DELETE}
                      Delete
                    </button>
                  </div>
                )}

                {/* Projects */}
                {isExpanded && (
                  <div className="ml-4 mt-1 space-y-0.5">
                    {categoryProjects.map(project => {
                      const projKey = `proj-${project.id}`;
                      return (
                        <div key={project.id}>
                          {renamingId === projKey ? (
                            <InlineInput
                              placeholder="Project name"
                              defaultValue={project.name}
                              onConfirm={name => { onRenameProject(project.id, name); setRenamingId(null); }}
                              onCancel={() => setRenamingId(null)}
                            />
                          ) : deletingId === projKey ? (
                            <InlineConfirm
                              message={`Delete "${project.name}" and all its tasks?`}
                              onConfirm={() => { onDeleteProject(project.id); setDeletingId(null); }}
                              onCancel={() => setDeletingId(null)}
                            />
                          ) : (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => onSelectProject(project.id, category.id)}
                                className={`flex-1 text-left min-h-[44px] px-3 py-2 rounded-lg text-sm transition-colors truncate ${
                                  selectedProjectId === project.id
                                    ? 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-medium'
                                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                                }`}
                                title={project.name}
                              >
                                {project.name}
                              </button>
                              <button
                                onClick={() => toggleMenu(projKey)}
                                className={`min-h-[32px] min-w-[32px] flex items-center justify-center rounded-md transition-colors shrink-0 ${
                                  openMenuFor === projKey
                                    ? 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                                    : 'text-gray-400 dark:text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-300'
                                }`}
                                aria-label="Project options"
                              >
                                <DotsIcon />
                              </button>
                            </div>
                          )}

                          {/* Project inline menu */}
                          {openMenuFor === projKey && (
                            <div className="ml-1 mb-1 flex gap-1">
                              <button
                                onClick={() => { setRenamingId(projKey); setOpenMenuFor(null); }}
                                className="flex-1 flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                              >
                                {ICON_RENAME}
                                Rename
                              </button>
                              <button
                                onClick={() => { setDeletingId(projKey); setOpenMenuFor(null); }}
                                className="flex-1 flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                              >
                                {ICON_DELETE}
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {isAddingProjectHere ? (
                      <InlineInput
                        placeholder="Project name"
                        onConfirm={name => handleAddProject(category.id, name)}
                        onCancel={() => setAddingProjectForCategoryId(null)}
                      />
                    ) : (
                      <button
                        onClick={() => setAddingProjectForCategoryId(category.id)}
                        className="w-full text-left min-h-[44px] px-3 py-2 rounded-lg text-xs text-gray-400 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex items-center gap-1.5"
                      >
                        <span className="text-base leading-none">+</span>
                        Add project
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Add category */}
        <div className="mt-3 border-t border-gray-200 dark:border-gray-700 pt-3">
          {isAddingCategory ? (
            <InlineInput
              placeholder="Category name"
              onConfirm={handleAddCategory}
              onCancel={() => setIsAddingCategory(false)}
            />
          ) : (
            <button
              onClick={() => setIsAddingCategory(true)}
              className="w-full text-left min-h-[44px] px-3 py-2 rounded-lg text-xs font-medium text-gray-400 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex items-center gap-1.5"
            >
              <span className="text-base leading-none">+</span>
              New Category
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
