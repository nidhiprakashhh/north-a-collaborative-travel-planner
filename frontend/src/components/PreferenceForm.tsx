import { useEffect, useRef, useState } from 'react';
import type { TripPreferenceState } from '../hooks/useTrip';

interface PreferenceFormProps {
  initial: TripPreferenceState | undefined;
  onSubmit: (updates: {
    destinations?: string[];
    availableDates?: string[];
    budgetPerDay?: number;
    activityTypes?: string[];
    mustSee?: string[];
    dealbreakers?: string[];
  }) => void;
  onFocusField: (field: string) => void;
}

interface FormState {
  destinations: string;
  dateFrom: string;
  dateTo: string;
  budgetPerDay: string;
  activityTypes: string;
  mustSee: string;
  dealbreakers: string;
}

// availableDates has always meant a [from, to] range (see synthesisService's
// day-count math), it just used to be typed in as free text - this reads
// that same two-element shape back out for the date pickers below.
function toFormState(pref: TripPreferenceState | undefined): FormState {
  return {
    destinations: pref?.destinations.join(', ') ?? '',
    dateFrom: pref?.availableDates[0] ?? '',
    dateTo: pref?.availableDates[1] ?? '',
    budgetPerDay: pref ? String(pref.budgetPerDay) : '',
    activityTypes: pref?.activityTypes.join(', ') ?? '',
    mustSee: pref?.mustSee.join(', ') ?? '',
    dealbreakers: pref?.dealbreakers.join(', ') ?? '',
  };
}

const DEBOUNCE_MS = 500;

// Live-syncs as you type (debounced client-side) rather than requiring an
// explicit submit — matches the "everyone sees inputs live" premise. The
// server debounces again (3s) before triggering synthesis on top of this.
export function PreferenceForm({ initial, onSubmit, onFocusField }: PreferenceFormProps) {
  const [form, setForm] = useState<FormState>(() => toFormState(initial));
  const seededRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!seededRef.current && initial) {
      seededRef.current = true;
      setForm(toFormState(initial));
    }
  }, [initial]);

  function scheduleSubmit(next: FormState) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onSubmit({
        destinations: splitList(next.destinations),
        availableDates: [next.dateFrom, next.dateTo].filter(Boolean),
        budgetPerDay: Number(next.budgetPerDay) || 0,
        activityTypes: splitList(next.activityTypes),
        mustSee: splitList(next.mustSee),
        dealbreakers: splitList(next.dealbreakers),
      });
    }, DEBOUNCE_MS);
  }

  function splitList(value: string): string[] {
    return value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function update(field: keyof FormState, value: string) {
    const next = { ...form, [field]: value };
    setForm(next);
    scheduleSubmit(next);
  }

  const listFields: Array<{ key: keyof FormState; label: string; placeholder: string }> = [
    { key: 'destinations', label: 'Destinations', placeholder: 'Tokyo, Kyoto' },
    { key: 'activityTypes', label: 'Activities', placeholder: 'food, hiking, nightlife' },
    { key: 'mustSee', label: 'Must see', placeholder: 'Fushimi Inari' },
    { key: 'dealbreakers', label: 'Dealbreakers', placeholder: 'no early mornings' },
  ];

  const inputClass =
    'w-full rounded-lg border border-haze-200 bg-white px-2 py-1.5 text-sm focus:border-sky focus:outline-none';

  return (
    <div className="space-y-3 rounded-xl bg-white p-6 shadow-sm">
      <h2 className="text-base font-semibold text-ink">Your preferences</h2>

      <div>
        <label className="mb-1 block text-sm font-medium text-ink-soft">Destinations</label>
        <input
          className={inputClass}
          value={form.destinations}
          placeholder={listFields[0].placeholder}
          onFocus={() => onFocusField('destinations')}
          onChange={(e) => update('destinations', e.target.value)}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-ink-soft">Available dates</label>
        {/* min-w-0 overrides flex items' default min-width:auto — a date
            input's intrinsic content width (dd/mm/yyyy + the calendar icon)
            won't shrink below that on its own, so without this it overflows
            the card instead of sharing the row with its sibling. */}
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            className={`min-w-0 flex-1 ${inputClass}`}
            value={form.dateFrom}
            onFocus={() => onFocusField('availableDates')}
            onChange={(e) => update('dateFrom', e.target.value)}
          />
          <span className="shrink-0 text-xs text-ink-faint">to</span>
          <input
            type="date"
            className={`min-w-0 flex-1 ${inputClass}`}
            value={form.dateTo}
            min={form.dateFrom || undefined}
            onFocus={() => onFocusField('availableDates')}
            onChange={(e) => update('dateTo', e.target.value)}
          />
        </div>
      </div>

      {listFields.slice(1).map(({ key, label, placeholder }) => (
        <div key={key}>
          <label className="mb-1 block text-sm font-medium text-ink-soft">{label}</label>
          <input
            className={inputClass}
            value={form[key]}
            placeholder={placeholder}
            onFocus={() => onFocusField(key)}
            onChange={(e) => update(key, e.target.value)}
          />
        </div>
      ))}

      <div>
        <label className="mb-1 block text-sm font-medium text-ink-soft">Budget per day (USD)</label>
        <input
          type="number"
          className={inputClass}
          value={form.budgetPerDay}
          onFocus={() => onFocusField('budgetPerDay')}
          onChange={(e) => update('budgetPerDay', e.target.value)}
        />
      </div>
    </div>
  );
}
