import { useMemo } from 'react';
import type { Category, Project, Task } from '../types';
import { dateToOffset, filterGanttTasks, taskBarGeometry } from '../utils/gantt';

interface Props {
  tasks: Task[];
  categories: Category[];
  projects: Project[];
  rangeStart: string;
  rangeEnd: string;
}

function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatAxisDate(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return toYMD(d);
}

function calcTotalDays(rangeStart: string, rangeEnd: string): number {
  const ms = new Date(rangeEnd + 'T12:00:00').getTime() - new Date(rangeStart + 'T12:00:00').getTime();
  return Math.round(ms / 86_400_000) + 1;
}

export function GanttChart({ tasks, categories, projects, rangeStart, rangeEnd }: Props) {
  const totalDays = useMemo(() => calcTotalDays(rangeStart, rangeEnd), [rangeStart, rangeEnd]);
  const todayStr = toYMD(new Date());

  const filtered = useMemo(
    () => filterGanttTasks(tasks, rangeStart, rangeEnd),
    [tasks, rangeStart, rangeEnd],
  );

  const axisLabels = useMemo(() => {
    // Week view: one label per day
    if (totalDays <= 7) {
      return Array.from({ length: totalDays }, (_, i) => {
        const d = addDays(rangeStart, i);
        const date = new Date(d + 'T12:00:00');
        return {
          label: date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' }),
          offset: (i / totalDays) * 100,
        };
      });
    }
    // Month view: one label every 7 days
    if (totalDays <= 60) {
      const labels: Array<{ label: string; offset: number }> = [];
      for (let i = 0; i < totalDays; i += 7) {
        labels.push({ label: formatAxisDate(addDays(rangeStart, i)), offset: (i / totalDays) * 100 });
      }
      return labels;
    }
    // FY / long view: one label per month at the 1st of each month
    const labels: Array<{ label: string; offset: number }> = [];
    const endDate = new Date(rangeEnd + 'T12:00:00');
    let cur = new Date(rangeStart + 'T12:00:00');
    cur = new Date(cur.getFullYear(), cur.getMonth(), 1);
    while (cur <= endDate) {
      const d = toYMD(cur);
      if (d >= rangeStart) {
        labels.push({
          label: cur.toLocaleDateString('en-GB', { month: 'short' }),
          offset: dateToOffset(d, rangeStart, totalDays),
        });
      }
      cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
    }
    return labels;
  }, [rangeStart, rangeEnd, totalDays]);

  const todayOffset =
    todayStr >= rangeStart && todayStr <= rangeEnd
      ? dateToOffset(todayStr, rangeStart, totalDays)
      : null;

  const grouped = useMemo(() => {
    return categories
      .map(cat => ({
        category: cat,
        projGroups: projects
          .filter(p => p.categoryId === cat.id)
          .map(proj => ({ project: proj, tasks: filtered.filter(t => t.projectId === proj.id) }))
          .filter(pg => pg.tasks.length > 0),
      }))
      .filter(cg => cg.projGroups.length > 0);
  }, [filtered, categories, projects]);

  if (filtered.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-gray-400 dark:text-gray-500">
        No tasks overlap with this period.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[480px]">

        {/* Date axis */}
        <div className="flex items-end pb-1 border-b border-gray-100 dark:border-gray-800">
          <div className="w-[40%] shrink-0" />
          <div className="flex-1 relative h-7">
            {todayOffset !== null && (
              <div className="absolute top-0 w-px h-3 bg-red-500" style={{ left: `${todayOffset}%` }} />
            )}
            {axisLabels.map(({ label, offset }) => (
              <span
                key={label}
                className="absolute bottom-0 text-[10px] font-medium text-gray-400 dark:text-gray-500 select-none"
                style={{ left: `${offset}%` }}
              >
                {label}
              </span>
            ))}
          </div>
        </div>

        {/* Grouped rows */}
        {grouped.map(({ category, projGroups }) => (
          <div key={category.id}>

            {/* Category header */}
            <div className="flex items-center h-7 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
              <div className="w-[40%] shrink-0 px-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 truncate">
                {category.name}
              </div>
              <div className="flex-1 relative h-full">
                {todayOffset !== null && (
                  <div className="absolute top-0 bottom-0 w-px bg-red-400/30" style={{ left: `${todayOffset}%` }} />
                )}
              </div>
            </div>

            {projGroups.map(({ project, tasks: projTasks }) => (
              <div key={project.id}>

                {/* Project sub-header */}
                <div className="flex items-center h-6 bg-gray-50/40 dark:bg-gray-800/20 border-b border-gray-50 dark:border-gray-800/40">
                  <div className="w-[40%] shrink-0 pl-5 pr-3 text-[11px] font-medium text-gray-500 dark:text-gray-400 truncate">
                    {project.name}
                  </div>
                  <div className="flex-1 relative h-full">
                    {todayOffset !== null && (
                      <div className="absolute top-0 bottom-0 w-px bg-red-400/30" style={{ left: `${todayOffset}%` }} />
                    )}
                  </div>
                </div>

                {/* Task rows */}
                {projTasks.map(task => {
                  const { left, width } = taskBarGeometry(task.startDate, task.dueDate, rangeStart, totalDays);
                  const isOverdue = !task.completed && task.dueDate < todayStr;
                  const barColor = task.completed
                    ? 'bg-gray-300 dark:bg-gray-600 opacity-60'
                    : isOverdue
                    ? 'bg-red-300 dark:bg-red-700/70'
                    : task.workType === 'deep'
                    ? 'bg-indigo-500'
                    : 'bg-emerald-500';

                  return (
                    <div
                      key={task.id}
                      className="flex items-center h-9 border-b border-gray-50 dark:border-gray-800/30"
                    >
                      <div
                        className={`w-[40%] shrink-0 pl-8 pr-3 text-sm truncate ${
                          task.completed ? 'text-gray-400 dark:text-gray-500' : 'text-gray-800 dark:text-gray-200'
                        }`}
                        title={task.title}
                      >
                        {task.title}
                      </div>
                      <div className="flex-1 relative h-full overflow-hidden">
                        {todayOffset !== null && (
                          <div
                            className="absolute top-0 bottom-0 w-px bg-red-400/50"
                            style={{ left: `${todayOffset}%` }}
                          />
                        )}
                        <div
                          className={`absolute top-1/2 -translate-y-1/2 h-4 rounded-full ${barColor}`}
                          style={{ left: `${left}%`, width: `${width}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
