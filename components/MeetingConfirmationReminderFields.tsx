"use client";

import { useState } from "react";

export {
  meetingConfirmationReminderToIso,
  validateMeetingConfirmationReminder,
} from "@/lib/meetingConfirmation";

type Props = {
  required: boolean;
  reminderAt: string;
  meetingAt?: string;
  onRequiredChange: (required: boolean) => void;
  onReminderAtChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
};

function getMinimumLocalDateTime() {
  return new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}

export default function MeetingConfirmationReminderFields({
  required,
  reminderAt,
  meetingAt,
  onRequiredChange,
  onReminderAtChange,
  disabled = false,
  className = "",
}: Props) {
  const [minimumDateTime] = useState(() => getMinimumLocalDateTime());

  return (
    <div
      className={`rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-700 dark:bg-slate-900 ${className}`}
    >
      <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
        <input
          type="checkbox"
          checked={required}
          disabled={disabled}
          onChange={(event) => {
            const nextRequired = event.target.checked;
            onRequiredChange(nextRequired);

            if (!nextRequired) {
              onReminderAtChange("");
            }
          }}
          className="h-4 w-4 accent-blue-600"
        />
        Czy klient wymaga potwierdzenia spotkania wcześniej?
      </label>

      {required && (
        <label className="mt-3 block">
          <span className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
            Kiedy przypomnieć doradcy?
          </span>
          <input
            type="datetime-local"
            value={reminderAt}
            min={minimumDateTime}
            max={meetingAt || undefined}
            disabled={disabled}
            onChange={(event) => onReminderAtChange(event.target.value)}
            className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-blue-500/20 dark:disabled:bg-slate-800"
          />
        </label>
      )}
    </div>
  );
}
