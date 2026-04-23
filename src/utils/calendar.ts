function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(min: number): string {
  return `${Math.floor(min / 60).toString().padStart(2, '0')}:${(min % 60).toString().padStart(2, '0')}`;
}

export function snapToSlot(minutes: number): number {
  return Math.round(minutes / 15) * 15;
}

export function isBlockInBreakBand(
  startTime: string,
  endTime: string,
  breakStart: string,
  breakEnd: string,
): boolean {
  const startMin = timeToMinutes(startTime);
  const endMin = timeToMinutes(endTime);
  const bStart = timeToMinutes(breakStart);
  const bEnd = timeToMinutes(breakEnd);
  return startMin < bEnd && endMin > bStart;
}

export function calcBlockMove(
  originalDate: string,
  originalStartMin: number,
  originalEndMin: number,
  dayDelta: number,
  slotDelta: number,
): { date: string; startTime: string; endTime: string } {
  const duration = originalEndMin - originalStartMin;
  const rawStart = originalStartMin + slotDelta * 15;
  const clampedStart = Math.max(0, Math.min(24 * 60 - 15, rawStart));
  const newStartMin = snapToSlot(clampedStart);
  const newEndMin = Math.min(24 * 60, newStartMin + duration);

  const d = new Date(`${originalDate}T00:00:00`);
  d.setDate(d.getDate() + dayDelta);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');

  return {
    date: `${y}-${mo}-${da}`,
    startTime: minutesToTime(newStartMin),
    endTime: minutesToTime(newEndMin),
  };
}
