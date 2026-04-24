import { useState } from 'react';
import { getWeekRange, getMonthRange, formatShortDate } from '../../utils/pdf';
import type { ReportRange } from '../../utils/pdf';

type RangeMode = 'week' | 'month' | 'custom';

interface Props {
  onGenerate: (range: ReportRange) => void;
  onClose: () => void;
}

function todayDateStr(): string {
  return new Date().toISOString().split('T')[0];
}

function mondayDateStr(): string {
  const today = new Date();
  const dow = today.getDay();
  const offset = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(today);
  monday.setDate(today.getDate() + offset);
  return monday.toISOString().split('T')[0];
}

const BTN_BASE = 'px-3 py-1.5 rounded-md text-sm font-medium transition-colors border';
const BTN_ON = 'bg-indigo-600 border-indigo-600 text-white';
const BTN_OFF =
  'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700';

export function ReportDialog({ onGenerate, onClose }: Props) {
  const [mode, setMode] = useState<RangeMode>('week');
  const [customFrom, setCustomFrom] = useState(mondayDateStr());
  const [customTo, setCustomTo] = useState(todayDateStr());

  function handleGenerate() {
    let range: ReportRange;
    if (mode === 'week') {
      range = getWeekRange();
    } else if (mode === 'month') {
      range = getMonthRange();
    } else {
      const start = new Date(customFrom + 'T00:00:00');
      const end = new Date(customTo + 'T23:59:59');
      range = {
        startMs: start.getTime(),
        endMs: end.getTime(),
        label: `${formatShortDate(start)} – ${formatShortDate(end)}`,
      };
    }
    onGenerate(range);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-sm flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="font-semibold text-sm text-gray-900 dark:text-gray-100">Download Report</h2>
          <button
            onClick={onClose}
            className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
              Completed tasks period
            </p>
            <div className="flex gap-2">
              {(['week', 'month', 'custom'] as RangeMode[]).map(m => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`${BTN_BASE} ${mode === m ? BTN_ON : BTN_OFF}`}
                >
                  {m === 'week' ? 'This Week' : m === 'month' ? 'This Month' : 'Custom'}
                </button>
              ))}
            </div>
          </div>

          {mode === 'custom' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">From</p>
                <input
                  type="date"
                  value={customFrom}
                  onChange={e => setCustomFrom(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">To</p>
                <input
                  type="date"
                  value={customTo}
                  onChange={e => setCustomTo(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          )}

          <p className="text-xs text-gray-400 dark:text-gray-500">
            Active tasks are always included (no date filter).
          </p>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="min-h-[36px] px-4 rounded-lg text-sm font-medium border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleGenerate}
            className="min-h-[36px] px-4 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
          >
            Download PDF
          </button>
        </div>
      </div>
    </div>
  );
}
