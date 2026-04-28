import { describe, it, expect } from 'vitest';
import {
  timeToMinutes,
  minutesToDisplay,
  blockDurationMinutes,
  workDayOverlapMinutes,
  weekdaysInRange,
  calcWorkTypeSummary,
  calcCategoryBreakdown,
  calcProjectBreakdown,
  calcTaskBreakdown,
} from './statistics';
import type { CalendarBlock, Category, Project, Task } from '../types';

function makeBlock(overrides: Partial<CalendarBlock> & { id: number }): CalendarBlock {
  return {
    taskId: null,
    workType: 'active_break',
    date: '2026-04-21',
    startTime: '09:00',
    endTime: '10:00',
    createdAt: 0,
    ...overrides,
  };
}

// ─── timeToMinutes ──────────────────────────────────────────────────────────

describe('timeToMinutes', () => {
  it('converts midnight', () => expect(timeToMinutes('00:00')).toBe(0));
  it('converts 09:15', () => expect(timeToMinutes('09:15')).toBe(555));
  it('converts 18:00', () => expect(timeToMinutes('18:00')).toBe(1080));
  it('converts 23:59', () => expect(timeToMinutes('23:59')).toBe(1439));
});

// ─── minutesToDisplay ───────────────────────────────────────────────────────

describe('minutesToDisplay', () => {
  it('formats 0 minutes', () => expect(minutesToDisplay(0)).toBe('0m'));
  it('formats minutes only', () => expect(minutesToDisplay(30)).toBe('30m'));
  it('formats hours only', () => expect(minutesToDisplay(60)).toBe('1h'));
  it('formats hours and minutes', () => expect(minutesToDisplay(90)).toBe('1h 30m'));
  it('formats large value', () => expect(minutesToDisplay(525)).toBe('8h 45m'));
});

// ─── blockDurationMinutes ───────────────────────────────────────────────────

describe('blockDurationMinutes', () => {
  it('one hour block', () => expect(blockDurationMinutes('09:00', '10:00')).toBe(60));
  it('partial hour block', () => expect(blockDurationMinutes('09:15', '10:30')).toBe(75));
  it('break band duration', () => expect(blockDurationMinutes('13:00', '14:15')).toBe(75));
});

// ─── workDayOverlapMinutes ──────────────────────────────────────────────────

describe('workDayOverlapMinutes', () => {
  const WS = '09:15';
  const WE = '18:00'; // 525 min window

  it('returns full duration when block is inside work window', () => {
    expect(workDayOverlapMinutes('10:00', '11:00', WS, WE)).toBe(60);
  });

  it('clamps block starting before work day', () => {
    // 08:00–10:00, work starts 09:15 → overlap = 09:15–10:00 = 45 min
    expect(workDayOverlapMinutes('08:00', '10:00', WS, WE)).toBe(45);
  });

  it('clamps block ending after work day', () => {
    // 17:00–19:00, work ends 18:00 → overlap = 17:00–18:00 = 60 min
    expect(workDayOverlapMinutes('17:00', '19:00', WS, WE)).toBe(60);
  });

  it('returns 0 when block is entirely before work day', () => {
    expect(workDayOverlapMinutes('07:00', '09:00', WS, WE)).toBe(0);
  });

  it('returns 0 when block is entirely after work day', () => {
    expect(workDayOverlapMinutes('18:30', '19:00', WS, WE)).toBe(0);
  });

  it('returns full work window for block spanning entire day', () => {
    expect(workDayOverlapMinutes('00:00', '23:59', WS, WE)).toBe(525);
  });
});

// ─── weekdaysInRange ────────────────────────────────────────────────────────

describe('weekdaysInRange', () => {
  it('returns Mon–Fri for a single work week', () => {
    const days = weekdaysInRange('2026-04-20', '2026-04-24');
    expect(days).toHaveLength(5);
    expect(days[0]).toBe('2026-04-20'); // Monday
    expect(days[4]).toBe('2026-04-24'); // Friday
  });

  it('excludes weekends when range spans Sat and Sun', () => {
    const days = weekdaysInRange('2026-04-18', '2026-04-26'); // Sat to next Sun
    expect(days).toHaveLength(5);
    expect(days.every(d => {
      const dow = new Date(d + 'T12:00:00').getDay();
      return dow >= 1 && dow <= 5;
    })).toBe(true);
  });

  it('returns empty array for weekend-only range', () => {
    expect(weekdaysInRange('2026-04-18', '2026-04-19')).toHaveLength(0); // Sat–Sun
  });

  it('returns single day for a single weekday', () => {
    const days = weekdaysInRange('2026-04-21', '2026-04-21'); // Tuesday
    expect(days).toHaveLength(1);
    expect(days[0]).toBe('2026-04-21');
  });

  it('counts weekdays across a full month', () => {
    const days = weekdaysInRange('2026-04-01', '2026-04-30');
    expect(days).toHaveLength(22); // April 2026 has 22 weekdays
  });
});

// ─── calcWorkTypeSummary ────────────────────────────────────────────────────

const WORK_START = '09:15';
const WORK_END = '18:00'; // 525 min/day

describe('calcWorkTypeSummary', () => {
  const WEEK = ['2026-04-21', '2026-04-22', '2026-04-23', '2026-04-24', '2026-04-25'];

  it('returns fully unutilized when no blocks exist', () => {
    const r = calcWorkTypeSummary([], WORK_START, WORK_END, WEEK);
    expect(r.deepMinutes).toBe(0);
    expect(r.shallowMinutes).toBe(0);
    expect(r.breakMinutes).toBe(0);
    expect(r.unutilizedMinutes).toBe(525 * 5);
    expect(r.totalWindowMinutes).toBe(525 * 5);
  });

  it('counts each work type and computes unutilized correctly', () => {
    const blocks: CalendarBlock[] = [
      makeBlock({ id: 1, workType: 'deep', startTime: '10:00', endTime: '11:00', date: '2026-04-21' }),
      makeBlock({ id: 2, workType: 'shallow', startTime: '11:00', endTime: '11:30', date: '2026-04-21' }),
      makeBlock({ id: 3, workType: 'active_break', startTime: '13:00', endTime: '14:15', date: '2026-04-21' }),
    ];
    const r = calcWorkTypeSummary(blocks, WORK_START, WORK_END, ['2026-04-21']);
    expect(r.deepMinutes).toBe(60);
    expect(r.shallowMinutes).toBe(30);
    expect(r.breakMinutes).toBe(75);
    // All within work window: 525 - 60 - 30 - 75 = 360
    expect(r.unutilizedMinutes).toBe(360);
  });

  it('does not count blocks outside work window toward unutilized', () => {
    const blocks: CalendarBlock[] = [
      makeBlock({ id: 1, workType: 'deep', startTime: '07:00', endTime: '08:00', date: '2026-04-21' }),
    ];
    const r = calcWorkTypeSummary(blocks, WORK_START, WORK_END, ['2026-04-21']);
    expect(r.deepMinutes).toBe(60);     // raw block counted
    expect(r.unutilizedMinutes).toBe(525); // zero overlap → full day unutilized
  });

  it('clamps a block that partially overlaps the work window', () => {
    const blocks: CalendarBlock[] = [
      // 08:00–10:00: overlaps work window 09:15–10:00 = 45 min
      makeBlock({ id: 1, workType: 'deep', startTime: '08:00', endTime: '10:00', date: '2026-04-21' }),
    ];
    const r = calcWorkTypeSummary(blocks, WORK_START, WORK_END, ['2026-04-21']);
    expect(r.deepMinutes).toBe(120);             // raw block duration
    expect(r.deepInWindowMinutes).toBe(45);      // clipped to work window
    expect(r.unutilizedMinutes).toBe(525 - 45);  // 480
  });

  it('accumulates blocks across multiple days', () => {
    const blocks: CalendarBlock[] = [
      makeBlock({ id: 1, workType: 'deep', startTime: '10:00', endTime: '11:00', date: '2026-04-21' }),
      makeBlock({ id: 2, workType: 'shallow', startTime: '10:00', endTime: '11:00', date: '2026-04-22' }),
    ];
    const r = calcWorkTypeSummary(blocks, WORK_START, WORK_END, ['2026-04-21', '2026-04-22']);
    expect(r.deepMinutes).toBe(60);
    expect(r.shallowMinutes).toBe(60);
    expect(r.unutilizedMinutes).toBe(525 * 2 - 120);
  });

  it('tracks in-window per type separately', () => {
    const blocks: CalendarBlock[] = [
      makeBlock({ id: 1, workType: 'deep', startTime: '10:00', endTime: '12:00', date: '2026-04-21' }),
      makeBlock({ id: 2, workType: 'shallow', startTime: '14:00', endTime: '15:00', date: '2026-04-21' }),
      makeBlock({ id: 3, workType: 'active_break', startTime: '13:00', endTime: '14:00', date: '2026-04-21' }),
    ];
    const r = calcWorkTypeSummary(blocks, WORK_START, WORK_END, ['2026-04-21']);
    expect(r.deepInWindowMinutes).toBe(120);
    expect(r.shallowInWindowMinutes).toBe(60);
    expect(r.breakInWindowMinutes).toBe(60);
    // unutilized = 525 - 240 = 285
    expect(r.unutilizedMinutes).toBe(285);
    // all in-window values + unutilized = totalWindowMinutes
    const allInWindow = r.deepInWindowMinutes + r.shallowInWindowMinutes + r.breakInWindowMinutes + r.emailInWindowMinutes + r.meetingInWindowMinutes;
    expect(allInWindow + r.unutilizedMinutes).toBe(r.totalWindowMinutes);
  });

  describe('with daily exclusions (standup + break)', () => {
    // Standup 09:15–09:45 (30 min) + break 13:00–14:15 (75 min) = 105 min excluded
    // Effective day = 525 - 105 = 420 min
    const STANDUP = { start: '09:15', end: '09:45' };
    const BREAK = { start: '13:00', end: '14:15' };
    const EXCLUSIONS = [STANDUP, BREAK];

    it('reduces totalWindowMinutes by excluded slots per day', () => {
      const r = calcWorkTypeSummary([], WORK_START, WORK_END, ['2026-04-21'], EXCLUSIONS);
      expect(r.totalWindowMinutes).toBe(420); // 525 - 30 - 75
      expect(r.unutilizedMinutes).toBe(420);
    });

    it('blocks entirely within excluded slots do not reduce unutilized', () => {
      const blocks: CalendarBlock[] = [
        // Exactly covers the standup slot — should not count toward effective window
        makeBlock({ id: 1, workType: 'active_break', startTime: '09:15', endTime: '09:45', date: '2026-04-21' }),
      ];
      const r = calcWorkTypeSummary(blocks, WORK_START, WORK_END, ['2026-04-21'], EXCLUSIONS);
      expect(r.breakMinutes).toBe(30);           // raw block still counted
      expect(r.breakInWindowMinutes).toBe(0);    // zero effective contribution
      expect(r.unutilizedMinutes).toBe(420);     // excluded slot was already out of the window
    });

    it('blocks partially overlapping an excluded slot only count the non-excluded portion', () => {
      const blocks: CalendarBlock[] = [
        // 09:30–10:30: 09:30–09:45 is inside standup (15 min), 09:45–10:30 is productive (45 min)
        makeBlock({ id: 1, workType: 'deep', startTime: '09:30', endTime: '10:30', date: '2026-04-21' }),
      ];
      const r = calcWorkTypeSummary(blocks, WORK_START, WORK_END, ['2026-04-21'], EXCLUSIONS);
      expect(r.deepMinutes).toBe(60);            // raw block
      expect(r.deepInWindowMinutes).toBe(45);    // 09:45–10:30 only
      expect(r.unutilizedMinutes).toBe(420 - 45);
    });

    it('effective values still sum to totalWindowMinutes', () => {
      const blocks: CalendarBlock[] = [
        makeBlock({ id: 1, workType: 'deep', startTime: '10:00', endTime: '12:00', date: '2026-04-21' }),
        makeBlock({ id: 2, workType: 'shallow', startTime: '15:00', endTime: '16:00', date: '2026-04-21' }),
      ];
      const r = calcWorkTypeSummary(blocks, WORK_START, WORK_END, ['2026-04-21'], EXCLUSIONS);
      const utilized = r.deepInWindowMinutes + r.shallowInWindowMinutes + r.breakInWindowMinutes + r.emailInWindowMinutes + r.meetingInWindowMinutes;
      expect(utilized + r.unutilizedMinutes).toBe(r.totalWindowMinutes);
    });
  });

  it('counts email and meeting blocks separately', () => {
    const blocks: CalendarBlock[] = [
      makeBlock({ id: 1, workType: 'email', startTime: '09:30', endTime: '10:00', date: '2026-04-21' }),
      makeBlock({ id: 2, workType: 'meeting', startTime: '10:00', endTime: '11:00', date: '2026-04-21' }),
    ];
    const r = calcWorkTypeSummary(blocks, WORK_START, WORK_END, ['2026-04-21']);
    expect(r.emailMinutes).toBe(30);
    expect(r.meetingMinutes).toBe(60);
    expect(r.emailInWindowMinutes).toBe(30);
    expect(r.meetingInWindowMinutes).toBe(60);
    expect(r.unutilizedMinutes).toBe(525 - 30 - 60);
  });

  it('email and meeting in-window minutes reduce unutilized', () => {
    const blocks: CalendarBlock[] = [
      makeBlock({ id: 1, workType: 'email', startTime: '09:30', endTime: '10:30', date: '2026-04-21' }),
    ];
    const r = calcWorkTypeSummary(blocks, WORK_START, WORK_END, ['2026-04-21']);
    expect(r.emailInWindowMinutes).toBe(60);
    expect(r.unutilizedMinutes).toBe(525 - 60);
  });

  it('all five in-window types plus unutilized equal totalWindowMinutes', () => {
    const blocks: CalendarBlock[] = [
      makeBlock({ id: 1, workType: 'deep', startTime: '09:30', endTime: '10:30', date: '2026-04-21' }),
      makeBlock({ id: 2, workType: 'shallow', startTime: '10:30', endTime: '11:00', date: '2026-04-21' }),
      makeBlock({ id: 3, workType: 'active_break', startTime: '13:00', endTime: '13:30', date: '2026-04-21' }),
      makeBlock({ id: 4, workType: 'email', startTime: '14:00', endTime: '14:30', date: '2026-04-21' }),
      makeBlock({ id: 5, workType: 'meeting', startTime: '15:00', endTime: '16:00', date: '2026-04-21' }),
    ];
    const r = calcWorkTypeSummary(blocks, WORK_START, WORK_END, ['2026-04-21']);
    const allInWindow = r.deepInWindowMinutes + r.shallowInWindowMinutes + r.breakInWindowMinutes + r.emailInWindowMinutes + r.meetingInWindowMinutes;
    expect(allInWindow + r.unutilizedMinutes).toBe(r.totalWindowMinutes);
  });
});

// ─── calcCategoryBreakdown ──────────────────────────────────────────────────

const CATS: Category[] = [
  { id: 1, name: 'Engineering', sortOrder: 0, createdAt: 0 },
  { id: 2, name: 'Design', sortOrder: 1, createdAt: 0 },
];
const PROJECTS: Project[] = [
  { id: 1, categoryId: 1, name: 'Frontend', sortOrder: 0, createdAt: 0 },
  { id: 2, categoryId: 2, name: 'UI', sortOrder: 0, createdAt: 0 },
];
const TASKS: Task[] = [
  { id: 1, projectId: 1, workType: 'deep', title: 'Write tests', startDate: '2026-04-22', dueDate: '2026-04-25', flag: null, status: 'normal', completed: false, completedAt: null, createdAt: 0 },
  { id: 2, projectId: 2, workType: 'shallow', title: 'Review mockups', startDate: '2026-04-22', dueDate: '2026-04-25', flag: null, status: 'normal', completed: false, completedAt: null, createdAt: 0 },
];

describe('calcCategoryBreakdown', () => {
  it('groups blocks by category and excludes active_break (null taskId)', () => {
    const blocks: CalendarBlock[] = [
      makeBlock({ id: 1, taskId: 1, workType: 'deep', startTime: '10:00', endTime: '11:00' }),
      makeBlock({ id: 2, taskId: null, workType: 'active_break', startTime: '13:00', endTime: '14:15' }),
    ];
    const rows = calcCategoryBreakdown(blocks, TASKS, PROJECTS, CATS);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('Engineering');
    expect(rows[0].deepMinutes).toBe(60);
  });

  it('splits deep and shallow per category and sorts by total desc', () => {
    const blocks: CalendarBlock[] = [
      makeBlock({ id: 1, taskId: 1, workType: 'deep', startTime: '09:00', endTime: '11:00' }),   // 120 min Engineering
      makeBlock({ id: 2, taskId: 2, workType: 'shallow', startTime: '11:00', endTime: '11:30' }), // 30 min Design
    ];
    const rows = calcCategoryBreakdown(blocks, TASKS, PROJECTS, CATS);
    expect(rows).toHaveLength(2);
    expect(rows[0].name).toBe('Engineering'); // 120 min — sorted first
    expect(rows[0].deepMinutes).toBe(120);
    expect(rows[1].name).toBe('Design');
    expect(rows[1].shallowMinutes).toBe(30);
  });
});

// ─── calcProjectBreakdown ───────────────────────────────────────────────────

describe('calcProjectBreakdown', () => {
  it('groups blocks by project with category name attached', () => {
    const blocks: CalendarBlock[] = [
      makeBlock({ id: 1, taskId: 1, workType: 'deep', startTime: '10:00', endTime: '11:00' }),
    ];
    const rows = calcProjectBreakdown(blocks, TASKS, PROJECTS, CATS);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('Frontend');
    expect(rows[0].categoryName).toBe('Engineering');
    expect(rows[0].deepMinutes).toBe(60);
  });

  it('excludes active_break blocks (null taskId)', () => {
    const blocks: CalendarBlock[] = [
      makeBlock({ id: 1, taskId: null, workType: 'active_break', startTime: '13:00', endTime: '14:15' }),
    ];
    const rows = calcProjectBreakdown(blocks, TASKS, PROJECTS, CATS);
    expect(rows).toHaveLength(0);
  });
});

// ─── calcTaskBreakdown ──────────────────────────────────────────────────────

describe('calcTaskBreakdown', () => {
  it('groups blocks by task and sums durations', () => {
    const blocks: CalendarBlock[] = [
      makeBlock({ id: 1, taskId: 1, workType: 'deep', startTime: '09:00', endTime: '10:00' }),
      makeBlock({ id: 2, taskId: 1, workType: 'deep', startTime: '14:00', endTime: '15:00' }),
    ];
    const rows = calcTaskBreakdown(blocks, TASKS, PROJECTS);
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe('Write tests');
    expect(rows[0].minutes).toBe(120);
  });

  it('excludes active_break blocks and sorts by minutes desc', () => {
    const blocks: CalendarBlock[] = [
      makeBlock({ id: 1, taskId: 2, workType: 'shallow', startTime: '11:00', endTime: '11:30' }), // 30 min
      makeBlock({ id: 2, taskId: 1, workType: 'deep', startTime: '09:00', endTime: '11:00' }),     // 120 min
      makeBlock({ id: 3, taskId: null, workType: 'active_break', startTime: '13:00', endTime: '14:00' }),
    ];
    const rows = calcTaskBreakdown(blocks, TASKS, PROJECTS);
    expect(rows).toHaveLength(2);
    expect(rows[0].title).toBe('Write tests'); // 120 min — first
    expect(rows[1].title).toBe('Review mockups'); // 30 min — second
  });
});
