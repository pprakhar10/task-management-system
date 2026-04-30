import type { Category, Project, Task, Subtask } from '../types';

const NOW = Date.now();
const TODAY = '2026-04-21';
const OVERDUE = '2026-04-18';
const TOMORROW = '2026-04-22';
const NEXT_WEEK = '2026-04-28';
const NEXT_MONTH = '2026-05-15';
const LAST_WEEK = '2026-04-14';

export const MOCK_CATEGORIES: Category[] = [
  { id: 1, name: 'ESG Reporting', sortOrder: 0, createdAt: NOW },
  { id: 2, name: 'Stakeholder Communication', sortOrder: 1, createdAt: NOW },
  { id: 3, name: 'Process & Operations', sortOrder: 2, createdAt: NOW },
];

export const MOCK_PROJECTS: Project[] = [
  { id: 1, categoryId: 1, name: 'BRSR Dashboard', sortOrder: 0, isPrivate: false, createdAt: NOW },
  { id: 2, categoryId: 1, name: 'Tata Steel Benchmark', sortOrder: 1, isPrivate: false, createdAt: NOW },
  { id: 3, categoryId: 2, name: 'Weekly Updates', sortOrder: 0, isPrivate: false, createdAt: NOW },
  { id: 4, categoryId: 2, name: 'Board Presentations', sortOrder: 1, isPrivate: false, createdAt: NOW },
  { id: 5, categoryId: 3, name: 'Documentation', sortOrder: 0, isPrivate: false, createdAt: NOW },
];

export const MOCK_TASKS: Task[] = [
  {
    id: 1,
    projectId: 1,
    workType: 'deep',
    title: 'Complete Section A data collection',
    startDate: LAST_WEEK,
    dueDate: OVERDUE,
    flag: 'urgent',
    status: 'currently_working',
    completed: false,
    completedAt: null,
    createdAt: NOW,
  },
  {
    id: 2,
    projectId: 1,
    workType: 'deep',
    title: 'Review emissions methodology with consultant',
    startDate: '2026-04-17',
    dueDate: TODAY,
    flag: 'important',
    status: 'morning_meeting',
    completed: false,
    completedAt: null,
    createdAt: NOW,
  },
  {
    id: 3,
    projectId: 1,
    workType: 'shallow',
    title: 'Submit draft report to internal reviewer',
    startDate: '2026-04-19',
    dueDate: TOMORROW,
    flag: null,
    status: 'normal',
    completed: false,
    completedAt: null,
    createdAt: NOW,
  },
  {
    id: 4,
    projectId: 2,
    workType: 'deep',
    title: 'Download and verify Tata Steel annual data',
    startDate: LAST_WEEK,
    dueDate: OVERDUE,
    flag: 'urgent',
    status: 'normal',
    completed: false,
    completedAt: null,
    createdAt: NOW,
  },
  {
    id: 5,
    projectId: 2,
    workType: 'deep',
    title: 'Build KPI comparison tables',
    startDate: '2026-04-18',
    dueDate: TODAY,
    flag: null,
    status: 'currently_working',
    completed: false,
    completedAt: null,
    createdAt: NOW,
  },
  {
    id: 6,
    projectId: 3,
    workType: 'shallow',
    title: 'Send weekly status update to team',
    startDate: '2026-04-20',
    dueDate: TODAY,
    flag: null,
    status: 'morning_meeting',
    completed: false,
    completedAt: null,
    createdAt: NOW,
  },
  {
    id: 7,
    projectId: 3,
    workType: 'shallow',
    title: 'Follow up on pending queries from last week',
    startDate: '2026-04-23',
    dueDate: NEXT_WEEK,
    flag: 'important',
    status: 'normal',
    completed: false,
    completedAt: null,
    createdAt: NOW,
  },
  {
    id: 8,
    projectId: 4,
    workType: 'deep',
    title: 'Prepare Q1 board presentation deck',
    startDate: TODAY,
    dueDate: NEXT_WEEK,
    flag: 'important',
    status: 'normal',
    completed: false,
    completedAt: null,
    createdAt: NOW,
  },
  {
    id: 9,
    projectId: 5,
    workType: 'deep',
    title: 'Document BRSR data collection process end-to-end',
    startDate: '2026-04-28',
    dueDate: NEXT_MONTH,
    flag: null,
    status: 'normal',
    completed: false,
    completedAt: null,
    createdAt: NOW,
  },
  {
    id: 10,
    projectId: 5,
    workType: 'shallow',
    title: 'Update process flowcharts for new workflow',
    startDate: '2026-05-01',
    dueDate: NEXT_MONTH,
    flag: null,
    status: 'normal',
    completed: false,
    completedAt: null,
    createdAt: NOW,
  },
];

export const MOCK_SUBTASKS: Subtask[] = [
  // Task 1
  { id: 1, taskId: 1, title: 'Gather emissions data from plant reports', dueDate: null, completed: true, completedAt: NOW, sortOrder: 0, createdAt: NOW },
  { id: 2, taskId: 1, title: 'Compile water usage statistics', dueDate: null, completed: false, completedAt: null, sortOrder: 1, createdAt: NOW },
  { id: 3, taskId: 1, title: 'Verify energy consumption figures', dueDate: null, completed: false, completedAt: null, sortOrder: 2, createdAt: NOW },
  // Task 2
  { id: 4, taskId: 2, title: 'Pull latest data from tracking sheet', dueDate: null, completed: true, completedAt: NOW, sortOrder: 0, createdAt: NOW },
  { id: 5, taskId: 2, title: 'Cross-check figures with source reports', dueDate: null, completed: false, completedAt: null, sortOrder: 1, createdAt: NOW },
  // Task 3
  { id: 6, taskId: 3, title: 'Format document per submission template', dueDate: null, completed: false, completedAt: null, sortOrder: 0, createdAt: NOW },
  // Task 4
  { id: 7, taskId: 4, title: 'Find Tata Steel 2024 annual report', dueDate: null, completed: true, completedAt: NOW, sortOrder: 0, createdAt: NOW },
  { id: 8, taskId: 4, title: 'Extract all ESG KPIs into spreadsheet', dueDate: null, completed: false, completedAt: null, sortOrder: 1, createdAt: NOW },
  // Task 5
  { id: 9, taskId: 5, title: 'Set up comparison sheet structure', dueDate: null, completed: true, completedAt: NOW, sortOrder: 0, createdAt: NOW },
  { id: 10, taskId: 5, title: 'Fill in all data rows', dueDate: null, completed: false, completedAt: null, sortOrder: 1, createdAt: NOW },
  { id: 11, taskId: 5, title: 'Add benchmark charts', dueDate: null, completed: false, completedAt: null, sortOrder: 2, createdAt: NOW },
  // Task 6
  { id: 12, taskId: 6, title: 'Compile task list for the week', dueDate: null, completed: false, completedAt: null, sortOrder: 0, createdAt: NOW },
  { id: 13, taskId: 6, title: 'Draft and send email', dueDate: null, completed: false, completedAt: null, sortOrder: 1, createdAt: NOW },
  // Task 8
  { id: 14, taskId: 8, title: 'Gather Q1 data points from all teams', dueDate: null, completed: false, completedAt: null, sortOrder: 0, createdAt: NOW },
  { id: 15, taskId: 8, title: 'Create slide deck structure', dueDate: null, completed: false, completedAt: null, sortOrder: 1, createdAt: NOW },
  { id: 16, taskId: 8, title: 'Review with manager before submission', dueDate: null, completed: false, completedAt: null, sortOrder: 2, createdAt: NOW },
  // Task 9
  { id: 17, taskId: 9, title: 'Draft outline and section headings', dueDate: null, completed: false, completedAt: null, sortOrder: 0, createdAt: NOW },
  { id: 18, taskId: 9, title: 'Write step-by-step guide with screenshots', dueDate: null, completed: false, completedAt: null, sortOrder: 1, createdAt: NOW },
  // Task 10
  { id: 19, taskId: 10, title: 'Update all flowchart diagrams', dueDate: null, completed: false, completedAt: null, sortOrder: 0, createdAt: NOW },
];
