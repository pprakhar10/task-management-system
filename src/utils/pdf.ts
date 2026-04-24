import jsPDF from 'jspdf';
import type { Task, Subtask, Project, Category } from '../types';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SubtaskEntry {
  title: string;
  completed: boolean;
}

export interface TaskEntry {
  title: string;
  dueDate: string;
  subtasks: SubtaskEntry[];
}

export interface ProjectEntry {
  projectName: string;
  tasks: TaskEntry[];
}

export interface CategoryGroup {
  categoryName: string;
  projects: ProjectEntry[];
}

export interface ReportRange {
  startMs: number;
  endMs: number;
  label: string; // shown in PDF header ("Week of 21–25 Apr" / "April 2026" / custom)
}

// ── Pure utilities ─────────────────────────────────────────────────────────────

export function groupTasksForReport(
  tasks: Task[],
  subtasks: Subtask[],
  projects: Project[],
  categories: Category[],
): CategoryGroup[] {
  const projectMap = new Map(projects.map(p => [p.id, p]));
  const categoryMap = new Map(categories.map(c => [c.id, c]));

  const subtasksByTask = new Map<number, Subtask[]>();
  for (const sub of subtasks) {
    const arr = subtasksByTask.get(sub.taskId) ?? [];
    arr.push(sub);
    subtasksByTask.set(sub.taskId, arr);
  }

  const catToProjs = new Map<number, Map<number, TaskEntry[]>>();

  for (const task of tasks) {
    const project = projectMap.get(task.projectId);
    if (!project) continue;
    const category = categoryMap.get(project.categoryId);
    if (!category) continue;

    if (!catToProjs.has(category.id)) catToProjs.set(category.id, new Map());
    const projMap = catToProjs.get(category.id)!;

    if (!projMap.has(project.id)) projMap.set(project.id, []);
    projMap.get(project.id)!.push({
      title: task.title,
      dueDate: task.dueDate,
      subtasks: (subtasksByTask.get(task.id) ?? []).map(s => ({
        title: s.title,
        completed: s.completed,
      })),
    });
  }

  const result: CategoryGroup[] = [];
  for (const [catId, projMap] of catToProjs) {
    const category = categoryMap.get(catId)!;
    const projectEntries: ProjectEntry[] = [];
    for (const [projId, taskEntries] of projMap) {
      const project = projectMap.get(projId)!;
      projectEntries.push({ projectName: project.name, tasks: taskEntries });
    }
    result.push({ categoryName: category.name, projects: projectEntries });
  }
  return result;
}

export function filterCompletedInRange(tasks: Task[], startMs: number, endMs: number): Task[] {
  return tasks.filter(
    t => t.completedAt !== null && t.completedAt >= startMs && t.completedAt <= endMs,
  );
}

// ── Range helpers ─────────────────────────────────────────────────────────────

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function formatShortDate(d: Date): string {
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

export function getWeekRange(): ReportRange {
  const today = new Date();
  const dow = today.getDay();
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(today);
  monday.setDate(today.getDate() + mondayOffset);
  monday.setHours(0, 0, 0, 0);
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  friday.setHours(23, 59, 59, 999);
  return {
    startMs: monday.getTime(),
    endMs: friday.getTime(),
    label: `Week of ${formatShortDate(monday)} – ${formatShortDate(friday)}`,
  };
}

export function getMonthRange(): ReportRange {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  end.setHours(23, 59, 59, 999);
  return {
    startMs: start.getTime(),
    endMs: end.getTime(),
    label: `${MONTHS_LONG[today.getMonth()]} ${today.getFullYear()}`,
  };
}

// ── PDF generation ─────────────────────────────────────────────────────────────

const MARGIN = 18;
const PAGE_WIDTH = 210;
const PAGE_MAX_Y = 275; // 297mm - 22mm bottom margin

export function generateWeeklyReport(
  activeTasks: Task[],
  allCompletedTasks: Task[],
  subtasks: Subtask[],
  projects: Project[],
  categories: Category[],
  range: ReportRange,
): void {
  const completedInRange = filterCompletedInRange(
    allCompletedTasks,
    range.startMs,
    range.endMs,
  );

  const activeGroups = groupTasksForReport(activeTasks, subtasks, projects, categories);
  const completedGroups = groupTasksForReport(completedInRange, subtasks, projects, categories);

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  let y = MARGIN;

  type RGB = [number, number, number];
  type FontStyle = 'bold' | 'normal' | 'italic';

  function checkNewPage(needed = 8) {
    if (y + needed > PAGE_MAX_Y) {
      doc.addPage();
      y = MARGIN;
    }
  }

  function write(
    text: string,
    fontSize: number,
    style: FontStyle = 'normal',
    indent = 0,
    color: RGB = [30, 30, 30],
  ) {
    const maxW = PAGE_WIDTH - MARGIN * 2 - indent;
    doc.setFontSize(fontSize);
    doc.setFont('helvetica', style);
    doc.setTextColor(...color);
    const wrapped = doc.splitTextToSize(text, maxW) as string[];
    const lineH = fontSize * 0.38 + 1.5;
    checkNewPage(wrapped.length * lineH + 1);
    doc.text(wrapped, MARGIN + indent, y);
    y += wrapped.length * lineH;
  }

  function gap(mm: number) {
    y += mm;
  }

  function hrule() {
    doc.setDrawColor(180, 180, 180);
    doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
    y += 3;
  }

  // Header
  write('Work Report', 16, 'bold');
  gap(1.5);
  write(`Generated: ${formatShortDate(new Date())}`, 9, 'normal', 0, [120, 120, 120]);
  gap(7);

  function renderSection(title: string, periodLabel: string | null, groups: CategoryGroup[]) {
    write(title, 11, 'bold');
    if (periodLabel) {
      gap(0.5);
      write(periodLabel, 8, 'normal', 0, [140, 140, 140]);
    }
    hrule();

    if (groups.length === 0) {
      write('No tasks.', 9, 'normal', 2, [160, 160, 160]);
      gap(5);
      return;
    }

    for (const cat of groups) {
      checkNewPage(12);
      write(cat.categoryName, 10, 'bold');
      gap(1);

      for (const proj of cat.projects) {
        checkNewPage(10);
        write(proj.projectName, 9, 'italic', 4, [90, 90, 90]);

        for (const task of proj.tasks) {
          write(`- ${task.title}`, 9, 'normal', 9);
          for (const sub of task.subtasks) {
            if (sub.completed) {
              write(`[done] ${sub.title}`, 8, 'normal', 14, [150, 150, 150]);
            } else {
              write(sub.title, 8, 'normal', 14, [60, 60, 60]);
            }
          }
        }
        gap(2);
      }
      gap(3);
    }
    gap(2);
  }

  renderSection('ACTIVE TASKS', null, activeGroups);
  renderSection('COMPLETED TASKS', range.label, completedGroups);

  const dateStr = new Date().toISOString().split('T')[0];
  doc.save(`work-report-${dateStr}.pdf`);
}
