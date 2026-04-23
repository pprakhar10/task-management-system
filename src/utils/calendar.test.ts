import { describe, it, expect } from 'vitest';
import { snapToSlot, isBlockInBreakBand, calcBlockMove } from './calendar';

describe('snapToSlot', () => {
  it('returns 0 for 0 minutes', () => {
    expect(snapToSlot(0)).toBe(0);
  });
  it('rounds down when closer to lower slot', () => {
    expect(snapToSlot(7)).toBe(0);
  });
  it('rounds up when closer to upper slot', () => {
    expect(snapToSlot(8)).toBe(15);
  });
  it('returns 15 for exactly 15', () => {
    expect(snapToSlot(15)).toBe(15);
  });
  it('rounds 22 down to 15', () => {
    expect(snapToSlot(22)).toBe(15);
  });
  it('rounds 23 up to 30', () => {
    expect(snapToSlot(23)).toBe(30);
  });
  it('returns 60 for exactly 60', () => {
    expect(snapToSlot(60)).toBe(60);
  });
  it('handles 1440 (midnight end)', () => {
    expect(snapToSlot(1440)).toBe(1440);
  });
});

describe('isBlockInBreakBand', () => {
  const BREAK_START = '13:00';
  const BREAK_END = '14:15';

  it('returns false when block ends before break starts', () => {
    expect(isBlockInBreakBand('11:00', '12:30', BREAK_START, BREAK_END)).toBe(false);
  });
  it('returns false when block starts at or after break end', () => {
    expect(isBlockInBreakBand('14:15', '15:00', BREAK_START, BREAK_END)).toBe(false);
  });
  it('returns false when block ends exactly at break start', () => {
    expect(isBlockInBreakBand('11:00', '13:00', BREAK_START, BREAK_END)).toBe(false);
  });
  it('returns true when block fully overlaps break', () => {
    expect(isBlockInBreakBand('12:00', '15:00', BREAK_START, BREAK_END)).toBe(true);
  });
  it('returns true when block is fully within break', () => {
    expect(isBlockInBreakBand('13:30', '14:00', BREAK_START, BREAK_END)).toBe(true);
  });
  it('returns true when block starts before and ends within break', () => {
    expect(isBlockInBreakBand('12:00', '13:30', BREAK_START, BREAK_END)).toBe(true);
  });
  it('returns true when block starts within and ends after break', () => {
    expect(isBlockInBreakBand('13:30', '15:00', BREAK_START, BREAK_END)).toBe(true);
  });
  it('returns true when block starts exactly at break start', () => {
    expect(isBlockInBreakBand('13:00', '13:30', BREAK_START, BREAK_END)).toBe(true);
  });
});

describe('calcBlockMove', () => {
  it('moves forward by 2 slots (30 min)', () => {
    const result = calcBlockMove('2026-04-21', 540, 600, 0, 2);
    expect(result).toEqual({ date: '2026-04-21', startTime: '09:30', endTime: '10:30' });
  });
  it('moves back by 2 slots (30 min)', () => {
    const result = calcBlockMove('2026-04-21', 540, 600, 0, -2);
    expect(result).toEqual({ date: '2026-04-21', startTime: '08:30', endTime: '09:30' });
  });
  it('moves to the next day', () => {
    const result = calcBlockMove('2026-04-21', 540, 600, 1, 0);
    expect(result).toEqual({ date: '2026-04-22', startTime: '09:00', endTime: '10:00' });
  });
  it('preserves block duration when moving', () => {
    const result = calcBlockMove('2026-04-21', 540, 660, 0, 4);
    expect(result).toEqual({ date: '2026-04-21', startTime: '10:00', endTime: '12:00' });
  });
  it('clamps start to 00:00 when moved too far back', () => {
    const result = calcBlockMove('2026-04-21', 15, 75, 0, -5);
    expect(result.startTime).toBe('00:00');
  });
  it('clamps end to 24:00 when block would overflow', () => {
    const result = calcBlockMove('2026-04-21', 1380, 1440, 0, 2);
    expect(result.endTime).toBe('24:00');
  });
  it('handles cross-year date boundary', () => {
    const result = calcBlockMove('2026-12-31', 540, 600, 1, 0);
    expect(result.date).toBe('2027-01-01');
  });
  it('handles moving to a previous day', () => {
    const result = calcBlockMove('2026-04-22', 540, 600, -1, 0);
    expect(result.date).toBe('2026-04-21');
  });
  it('snaps unaligned start minutes to nearest slot', () => {
    const result = calcBlockMove('2026-04-21', 543, 603, 0, 0);
    expect(result.startTime).toBe('09:00');
  });
});
