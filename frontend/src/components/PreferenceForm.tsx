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
  availableDates: string;
  budgetPerDay: string;
  activityTypes: string;
  mustSee: string;
  dealbreakers: string;
}

function toFormState(pref: TripPreferenceState | undefined): FormState {
  return {
    destinations: pref?.destinations.join(', ') ?? '',
    availableDates: pref?.availableDates.join(', ') ?? '',
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
        availableDates: splitList(next.availableDates),
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

  const fields: Array<{ key: keyof FormState; label: string; placeholder: string }> = [
    { key: 'destinations', label: 'Destinations', placeholder: 'Tokyo, Kyoto' },
    { key: 'availableDates', label: 'Available dates', placeholder: '2026-09-01, 2026-09-10' },
    { key: 'activityTypes', label: 'Activities', placeholder: 'food, hiking, nightlife' },
    { key: 'mustSee', label: 'Must see', placeholder: 'Fushimi Inari' },
    { key: 'dealbreakers', label: 'Dealbreakers', placeholder: 'no early mornings' },
  ];

  return (
    <div className="space-y-3 rounded-lg bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-700">Your preferences</h2>
      {fields.map(({ key, label, placeholder }) => (
        <div key={key}>
          <label className="mb-1 block text-xs font-medium text-slate-500">{label}</label>
          <input
            className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm focus:border-slate-400 focus:outline-none"
            value={form[key]}
            placeholder={placeholder}
            onFocus={() => onFocusField(key)}
            onChange={(e) => update(key, e.target.value)}
          />
        </div>
      ))}
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Budget per day (USD)</label>
        <input
          type="number"
          className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm focus:border-slate-400 focus:outline-none"
          value={form.budgetPerDay}
          onFocus={() => onFocusField('budgetPerDay')}
          onChange={(e) => update('budgetPerDay', e.target.value)}
        />
      </div>
    </div>
  );
}
