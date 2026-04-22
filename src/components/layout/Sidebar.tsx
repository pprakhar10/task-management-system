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
}

interface InlineInputProps {
  placeholder: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

function InlineInput({ placeholder, onConfirm, onCancel }: InlineInputProps) {
  const [value, setValue] = useState('');
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
}: Props) {
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [addingProjectForCategoryId, setAddingProjectForCategoryId] = useState<number | null>(null);

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
            const isExpanded = expandedCategories.has(category.id);
            const categoryProjects = projects.filter(p => p.categoryId === category.id);
            const isCategorySelected = selectedCategoryId === category.id && selectedProjectId === null;
            const isAddingProjectHere = addingProjectForCategoryId === category.id;

            return (
              <div key={category.id}>
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
                </div>

                {isExpanded && (
                  <div className="ml-4 mt-1 space-y-0.5">
                    {categoryProjects.map(project => (
                      <button
                        key={project.id}
                        onClick={() => onSelectProject(project.id, category.id)}
                        className={`w-full text-left min-h-[44px] px-3 py-2 rounded-lg text-sm transition-colors ${
                          selectedProjectId === project.id
                            ? 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-medium'
                            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                        }`}
                      >
                        {project.name}
                      </button>
                    ))}

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
