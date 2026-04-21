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
}: Props) {
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

            return (
              <div key={category.id}>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      onToggleCategory(category.id);
                    }}
                    className="flex items-center gap-2 flex-1 min-h-[44px] px-3 py-2 rounded-lg text-sm font-semibold transition-colors text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
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
                    <span className={isCategorySelected ? 'text-indigo-700 dark:text-indigo-300' : ''}>
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
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
