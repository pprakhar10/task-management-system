import { useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import { updateSettings } from '../db/crud';
import { exportDB, importDB } from '../db/backup';
import type { Settings } from '../types';

// ── Defaults (used as fallback when field is null) ────────────────────────────

const DEFAULT_WORK_START = '09:15';
const DEFAULT_WORK_END = '18:00';
const DEFAULT_BREAK_START = '13:00';
const DEFAULT_BREAK_END = '14:15';
const DEFAULT_STANDUP_START = '09:15';
const DEFAULT_STANDUP_END = '09:45';

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(m: number): string {
  return `${Math.floor(m / 60).toString().padStart(2, '0')}:${(m % 60).toString().padStart(2, '0')}`;
}

function formatBackupDate(ts: number | null): string {
  if (ts === null) return 'Never';
  return new Date(ts).toLocaleString();
}

// ── Sub-components ────────────────────────────────────────────────────────────

const TIME_ADJ_BTN =
  'min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors font-semibold text-base';

interface TimeFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
}

function TimeField({ label, value, onChange }: TimeFieldProps) {
  function adjust(delta: number) {
    const next = Math.max(0, Math.min(23 * 60 + 45, timeToMinutes(value) + delta));
    const snapped = Math.round(next / 15) * 15;
    onChange(minutesToTime(snapped));
  }

  return (
    <div>
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">{label}</p>
      <div className="flex items-center gap-2">
        <button onClick={() => adjust(-15)} className={TIME_ADJ_BTN}>−</button>
        <span className="w-14 text-center font-mono text-sm font-medium text-gray-900 dark:text-gray-100 tabular-nums">
          {value}
        </span>
        <button onClick={() => adjust(+15)} className={TIME_ADJ_BTN}>+</button>
      </div>
    </div>
  );
}

type TimeSettingKey = keyof Pick<
  Settings,
  'workDayStart' | 'workDayEnd' | 'defaultBreakStart' | 'defaultBreakEnd' | 'standupStart' | 'standupEnd'
>;

// ── SettingsView ──────────────────────────────────────────────────────────────

export function SettingsView() {
  const settings = useLiveQuery(() => db.settings.toCollection().first(), []);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!settings) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm">
        Loading…
      </div>
    );
  }

  function saveTime(field: TimeSettingKey, value: string) {
    updateSettings({ [field]: value } as Partial<Omit<Settings, 'id'>>);
  }

  async function handleExport() {
    const json = await exportDB();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `task-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function handleRestoreClick() {
    setRestoreError(null);
    fileInputRef.current?.click();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!window.confirm('This will replace all current data with the backup. Continue?')) {
      e.target.value = '';
      return;
    }
    try {
      const text = await file.text();
      await importDB(text);
      window.location.reload();
    } catch {
      setRestoreError('Restore failed. The file may be corrupted or in the wrong format.');
      e.target.value = '';
    }
  }

  function adjustReminderDays(delta: number) {
    if (!settings) return;
    const next = Math.max(1, Math.min(365, settings.backupReminderDays + delta));
    updateSettings({ backupReminderDays: next });
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-lg mx-auto px-4 py-6 space-y-8">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Settings</h1>

        {/* Work Hours */}
        <section className="space-y-3">
          <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Work Hours
          </h2>
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-4">
            <div className="grid grid-cols-2 gap-6">
              <TimeField
                label="Day starts"
                value={settings.workDayStart ?? DEFAULT_WORK_START}
                onChange={v => saveTime('workDayStart', v)}
              />
              <TimeField
                label="Day ends"
                value={settings.workDayEnd ?? DEFAULT_WORK_END}
                onChange={v => saveTime('workDayEnd', v)}
              />
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Defines the work window used for unutilized time in Statistics.
            </p>
          </div>
        </section>

        {/* Time Exclusions */}
        <section className="space-y-3">
          <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Time Exclusions
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            These slots are subtracted from the work window when calculating unutilized time.
          </p>

          {/* Morning standup */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-4">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Morning Standup</p>
            <div className="grid grid-cols-2 gap-6">
              <TimeField
                label="Start"
                value={settings.standupStart ?? DEFAULT_STANDUP_START}
                onChange={v => saveTime('standupStart', v)}
              />
              <TimeField
                label="End"
                value={settings.standupEnd ?? DEFAULT_STANDUP_END}
                onChange={v => saveTime('standupEnd', v)}
              />
            </div>
          </div>

          {/* Lunch break */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-4">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Lunch Break</p>
            <div className="grid grid-cols-2 gap-6">
              <TimeField
                label="Start"
                value={settings.defaultBreakStart ?? DEFAULT_BREAK_START}
                onChange={v => saveTime('defaultBreakStart', v)}
              />
              <TimeField
                label="End"
                value={settings.defaultBreakEnd ?? DEFAULT_BREAK_END}
                onChange={v => saveTime('defaultBreakEnd', v)}
              />
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Also controls the amber band shown on the calendar.
            </p>
          </div>
        </section>

        {/* Backup */}
        <section className="space-y-3">
          <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Backup
          </h2>
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">Last backup</span>
              <span className="text-gray-900 dark:text-gray-100 font-medium tabular-nums">
                {formatBackupDate(settings.lastBackupAt)}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">Remind every</span>
              <div className="flex items-center gap-2">
                <button onClick={() => adjustReminderDays(-1)} className={TIME_ADJ_BTN}>−</button>
                <span className="w-20 text-center text-sm font-medium text-gray-900 dark:text-gray-100 tabular-nums">
                  {settings.backupReminderDays} {settings.backupReminderDays === 1 ? 'day' : 'days'}
                </span>
                <button onClick={() => adjustReminderDays(+1)} className={TIME_ADJ_BTN}>+</button>
              </div>
            </div>

            {restoreError && (
              <p className="text-xs text-red-600 dark:text-red-400 font-medium">{restoreError}</p>
            )}

            <div className="flex gap-3 pt-1">
              <button
                onClick={handleExport}
                className="flex-1 min-h-[44px] bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Export Backup
              </button>
              <button
                onClick={handleRestoreClick}
                className="flex-1 min-h-[44px] border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 text-sm font-medium rounded-lg transition-colors"
              >
                Restore from Backup
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
