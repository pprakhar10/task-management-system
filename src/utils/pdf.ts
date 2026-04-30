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
    if (!project || project.isPrivate) continue;
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
const PAGE_HEIGHT = 297;
const PAGE_MAX_Y = 278; // leave 19mm bottom margin for page numbers

type RGB = [number, number, number];
type FontStyle = 'bold' | 'normal' | 'italic';

// Palette
const WHITE: RGB = [255, 255, 255];
const INDIGO_600: RGB = [79, 70, 229];
const INDIGO_50: RGB = [238, 242, 255];
const INDIGO_800: RGB = [55, 48, 163];
const EMERALD_600: RGB = [5, 150, 105];
const EMERALD_50: RGB = [209, 250, 229];
const EMERALD_800: RGB = [6, 78, 59];
const GRAY_900: RGB = [17, 24, 39];
const GRAY_500: RGB = [107, 114, 128];
const GRAY_400: RGB = [156, 163, 175];

function countTasks(groups: CategoryGroup[]): number {
  return groups.reduce(
    (sum, cat) => sum + cat.projects.reduce((s, p) => s + p.tasks.length, 0),
    0,
  );
}

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
  let y = 0;

  // ── Helpers ─────────────────────────────────────────────────────────────────

  function checkNewPage(needed = 10) {
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
    color: RGB = GRAY_900,
  ) {
    const maxW = PAGE_WIDTH - MARGIN * 2 - indent;
    doc.setFontSize(fontSize);
    doc.setFont('helvetica', style);
    doc.setTextColor(...color);
    const wrapped = doc.splitTextToSize(text, maxW) as string[];
    const lineH = fontSize * 0.4 + 1.5;
    checkNewPage(wrapped.length * lineH + 1);
    doc.text(wrapped, MARGIN + indent, y);
    y += wrapped.length * lineH;
  }

  function gap(mm: number) { y += mm; }

  function dot(xOffset: number, yOffset = 0) {
    doc.setFillColor(120, 120, 130);
    doc.circle(MARGIN + xOffset, y + yOffset - 1, 0.7, 'F');
  }

  // ── Page header bar (indigo strip at top of page 1) ──────────────────────────

  doc.setFillColor(...INDIGO_600);
  doc.rect(0, 0, PAGE_WIDTH, 32, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...WHITE);
  doc.text('Work Report', MARGIN, 20);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(199, 210, 254); // indigo-200
  doc.text(`Generated: ${formatShortDate(new Date())}`, PAGE_WIDTH - MARGIN, 20, { align: 'right' });

  y = 44;

  // ── Section renderer ─────────────────────────────────────────────────────────

  function renderSection(
    title: string,
    periodLabel: string | null,
    groups: CategoryGroup[],
    headerBg: RGB,
    categoryBg: RGB,
    categoryText: RGB,
  ) {
    const taskCount = countTasks(groups);

    // Section header bar
    checkNewPage(18);
    doc.setFillColor(...headerBg);
    doc.rect(MARGIN, y - 5, PAGE_WIDTH - MARGIN * 2, 12, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...WHITE);
    doc.text(title, MARGIN + 4, y + 3);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(
      `${taskCount} task${taskCount !== 1 ? 's' : ''}`,
      PAGE_WIDTH - MARGIN - 4,
      y + 3,
      { align: 'right' },
    );
    y += 9;

    // Period label (for completed section)
    if (periodLabel) {
      gap(2);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(...GRAY_500);
      doc.text(periodLabel, MARGIN + 2, y);
      y += 5;
    }

    gap(3);

    if (groups.length === 0) {
      write('No tasks.', 9, 'italic', 2, GRAY_400);
      gap(6);
      return;
    }

    for (const cat of groups) {
      checkNewPage(16);

      // Category row with tinted background
      doc.setFillColor(...categoryBg);
      doc.rect(MARGIN, y - 4, PAGE_WIDTH - MARGIN * 2, 9, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(...categoryText);
      doc.text(cat.categoryName.toUpperCase(), MARGIN + 3, y + 2);
      y += 7;
      gap(2);

      for (const proj of cat.projects) {
        checkNewPage(12);

        // Project name with a left accent line
        doc.setDrawColor(...headerBg);
        doc.setLineWidth(0.5);
        doc.line(MARGIN + 4, y - 3, MARGIN + 4, y + 3);

        write(proj.projectName, 9, 'italic', 7, GRAY_500);
        gap(1);

        for (const task of proj.tasks) {
          checkNewPage(8);
          dot(12, 0);
          write(task.title, 9, 'normal', 15, GRAY_900);

          for (const sub of task.subtasks) {
            checkNewPage(6);
            if (sub.completed) {
              write(`[done]  ${sub.title}`, 8, 'normal', 20, GRAY_400);
            } else {
              dot(18, 0);
              write(sub.title, 8, 'normal', 21, [60, 60, 70] as RGB);
            }
          }
          gap(1);
        }
        gap(3);
      }
      gap(4);
    }
    gap(3);
  }

  // Completed Tasks first, then Active Tasks
  renderSection('COMPLETED TASKS', range.label, completedGroups, EMERALD_600, EMERALD_50, EMERALD_800);
  renderSection('ACTIVE TASKS', null, activeGroups, INDIGO_600, INDIGO_50, INDIGO_800);

  // ── Page numbers ─────────────────────────────────────────────────────────────

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...GRAY_400);
    doc.text(`${i} / ${totalPages}`, PAGE_WIDTH / 2, PAGE_HEIGHT - 8, { align: 'center' });
  }

  const dateStr = new Date().toISOString().split('T')[0];
  doc.save(`work-report-${dateStr}.pdf`);
}
