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

const hourOptions = Array.from({ length: 13 }, (_, index) =>
  String(index + 8).padStart(2, "0")
);

const minuteOptions = ["00", "15", "30", "45"];

function getMinimumLocalDateTime() {
  return new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}

function getDateValue(value: string) {
  return value ? value.slice(0, 10) : "";
}

function getTimeValue(value: string) {
  return value ? value.slice(11, 16) : "";
}

function combineDateAndTime(date: string, time: string) {
  if (!date || !time) return "";
  return `${date}T${time}`;
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
  const selectedDate = getDateValue(reminderAt);
  const selectedTime = getTimeValue(reminderAt);
  const selectedHour = selectedTime ? selectedTime.slice(0, 2) : "09";
  const selectedMinute = selectedTime ? selectedTime.slice(3, 5) : "00";
  const meetingDate = getDateValue(meetingAt || "");

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
        <div className="mt-3">
          <p className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
            Kiedy przypomnieć doradcy?
          </p>
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-700 dark:bg-slate-900">
            <div className="mt-1 flex items-end gap-3">
              <div className="min-w-0 flex-1">
                <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Data
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  min={minimumDateTime.slice(0, 10)}
                  max={meetingDate || undefined}
                  disabled={disabled}
                  onChange={(event) => {
                    const nextDate = event.target.value;
                    onReminderAtChange(
                      combineDateAndTime(nextDate, `${selectedHour}:00`)
                    );
                  }}
                  className="h-11 w-full cursor-pointer rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition hover:border-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-200/70 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:border-slate-500 dark:focus:border-slate-500 dark:focus:ring-slate-700/50 dark:disabled:bg-slate-800"
                />
              </div>
              <div className="w-24">
                <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Godzina
                </label>
                <select
                  value={selectedHour}
                  disabled={disabled}
                  onChange={(event) => {
                    const nextDate =
                      selectedDate || minimumDateTime.slice(0, 10);
                    onReminderAtChange(
                      combineDateAndTime(
                        nextDate,
                        `${event.target.value}:${selectedMinute}`
                      )
                    );
                  }}
                  className="h-11 w-full cursor-pointer rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition hover:border-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-200/70 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:border-slate-500 dark:focus:border-slate-500 dark:focus:ring-slate-700/50 dark:disabled:bg-slate-800"
                >
                  {hourOptions.map((hour) => (
                    <option key={hour} value={hour}>
                      {hour}
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-24">
                <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Minuty
                </label>
                <select
                  value={selectedMinute}
                  disabled={disabled}
                  onChange={(event) => {
                    const nextDate =
                      selectedDate || minimumDateTime.slice(0, 10);
                    onReminderAtChange(
                      combineDateAndTime(
                        nextDate,
                        `${selectedHour}:${event.target.value}`
                      )
                    );
                  }}
                  className="h-11 w-full cursor-pointer rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition hover:border-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-200/70 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:border-slate-500 dark:focus:border-slate-500 dark:focus:ring-slate-700/50 dark:disabled:bg-slate-800"
                >
                  {minuteOptions.map((minute) => (
                    <option key={minute} value={minute}>
                      {minute}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
