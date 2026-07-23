"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { trackMetaCrmEvent } from "@/lib/metaConversionsClient";

type Activity = {
  id: string;
  activity_type: string;
  title: string;
  description: string | null;
  created_at: string;
  created_by: string;
  phone_contact_type: string | null;
  phone_status: string | null;
  follow_up_at: string | null;
  meeting_at: string | null;
  meeting_owner_id: string | null;
  author_name?: string | null;
};

type ClientActivitiesProps = {
  clientId: string;
  currentUserId: string;
};

const phoneContactTypeOptions = [
  { value: "marketing", label: "Kontakt marketingowy" },
  { value: "relationship", label: "Kontakt relacyjny" },
  { value: "incoming", label: "Kontakt przychodzący" },
];

const marketingStatusOptions = [
  { value: "no_answer", label: "Nie odbiera" },
  { value: "call_back_request", label: "Prośba o ponowny kontakt" },
  { value: "not_interested", label: "Niezainteresowany" },
  { value: "meeting_scheduled", label: "Umówione spotkanie" },
];

const incomingStatusOptions = [
  { value: "technical_questions", label: "Pytania techniczne" },
  { value: "complaint", label: "Reklamacja" },
  { value: "offer_interest", label: "Zainteresowanie ofertą" },
  { value: "other", label: "Inne" },
];

// Shared DateTimePicker code
const hourOptions = Array.from({ length: 13 }, (_, index) =>
  String(index + 8).padStart(2, "0")
);

const minuteOptions = ["00", "15", "30", "45"];

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

function DateTimePicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const selectedDate = getDateValue(value);
  const selectedTime = getTimeValue(value);
  const selectedHour = selectedTime ? selectedTime.slice(0, 2) : "09";
  const selectedMinute = selectedTime ? selectedTime.slice(3, 5) : "00";

  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-slate-700">
        {label}
      </label>
      <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
        <div className="mt-1 flex items-end gap-3">
          <div className="min-w-0 flex-1">
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
              Data
            </label>
            <input
              type="date"
              value={selectedDate}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(event) => {
                const nextDate = event.target.value;
                onChange(combineDateAndTime(nextDate, `${selectedHour}:00`));
              }}
              className="h-11 w-full cursor-pointer rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition hover:border-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-200/70"
            />
          </div>
          <div className="w-24">
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
              Godzina
            </label>
            <select
              value={selectedHour}
              onChange={(event) => {
                const nextDate = selectedDate || new Date().toISOString().slice(0, 10);
                onChange(combineDateAndTime(nextDate, `${event.target.value}:${selectedMinute}`));
              }}
              className="h-11 w-full cursor-pointer rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition hover:border-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-200/70"
            >
              {hourOptions.map((hour) => (
                <option key={hour} value={hour}>
                  {hour}
                </option>
              ))}
            </select>
          </div>
          <div className="w-24">
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
              Minuty
            </label>
            <select
              value={selectedMinute}
              onChange={(event) => {
                const nextDate = selectedDate || new Date().toISOString().slice(0, 10);
                onChange(combineDateAndTime(nextDate, `${selectedHour}:${event.target.value}`));
              }}
              className="h-11 w-full cursor-pointer rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition hover:border-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-200/70"
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
  );
}

export default function ClientActivities({
  clientId,
  currentUserId,
}: ClientActivitiesProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [activityType, setActivityType] = useState("phone");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const [phoneContactType, setPhoneContactType] = useState("marketing");
  const [phoneStatus, setPhoneStatus] = useState("no_answer");
  const [followUpAt, setFollowUpAt] = useState("");
  const [meetingAt, setMeetingAt] = useState("");

  useEffect(() => {
    loadActivities();
  }, [clientId]);

  useEffect(() => {
    if (phoneContactType === "marketing") {
      setPhoneStatus("no_answer");
      return;
    }

    if (phoneContactType === "incoming") {
      setPhoneStatus("technical_questions");
      return;
    }

    setPhoneStatus("");
    setFollowUpAt("");
    setMeetingAt("");
  }, [phoneContactType]);

  async function loadActivities() {
    setLoading(true);
    setErrorMessage("");

    const { data, error } = await supabase
      .from("client_activities")
      .select(
        "id, activity_type, title, description, created_at, created_by, phone_contact_type, phone_status, follow_up_at, meeting_at, meeting_owner_id"
      )
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Błąd ładowania aktywności", error);
      setErrorMessage("Nie udało się załadować historii kontaktów");
      setLoading(false);
      return;
    }

    if (!data || data.length === 0) {
      setActivities([]);
      setLoading(false);
      return;
    }

    const authorIds = [...new Set(data.map((item) => item.created_by))];

    const { data: profilesData } = await supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", authorIds);

    const profilesById = new Map(
      (profilesData || []).map((profile) => [profile.id, profile.display_name])
    );

    setActivities(
      data.map((item) => ({
        ...item,
        author_name: profilesById.get(item.created_by) || null,
      }))
    );

    setLoading(false);
  }

  function selectedPhoneStatusLabel() {
    if (phoneContactType === "marketing") {
      return (
        marketingStatusOptions.find((status) => status.value === phoneStatus)
          ?.label || "Kontakt marketingowy"
      );
    }

    if (phoneContactType === "incoming") {
      return (
        incomingStatusOptions.find((status) => status.value === phoneStatus)
          ?.label || "Kontakt przychodzący"
      );
    }

    return "Kontakt relacyjny";
  }

  function selectedPhoneContactTypeLabel(value: string | null) {
    return (
      phoneContactTypeOptions.find((type) => type.value === value)?.label ||
      "Kontakt telefoniczny"
    );
  }

  function selectedPhoneStatusDisplayLabel(value: string | null) {
    return (
      [...marketingStatusOptions, ...incomingStatusOptions].find(
        (status) => status.value === value
      )?.label || value
    );
  }

  function shouldShowFollowUp() {
    return (
      phoneContactType === "marketing" &&
      ["no_answer", "call_back_request"].includes(phoneStatus)
    );
  }

  function shouldShowMeetingDate() {
    return (
      (phoneContactType === "marketing" &&
        phoneStatus === "meeting_scheduled") ||
      (phoneContactType === "incoming" && phoneStatus === "offer_interest")
    );
  }

  async function addActivity() {
    if (activityType !== "phone" && !title.trim()) return;

    if (activityType === "phone" && shouldShowFollowUp() && !followUpAt) {
      setErrorMessage("Ustaw datę i godzinę ponownego kontaktu");
      return;
    }
    if (
      activityType === "phone" &&
      shouldShowFollowUp() &&
      new Date(followUpAt).getTime() <= Date.now()
    ) {
      setErrorMessage("Data ponownego kontaktu nie może być z przeszłości");
      return;
    }

    if (activityType === "phone" && shouldShowMeetingDate() && !meetingAt) {
      setErrorMessage("Ustaw datę i godzinę spotkania");
      return;
    }
    if (
      activityType === "phone" &&
      shouldShowMeetingDate() &&
      new Date(meetingAt).getTime() <= Date.now()
    ) {
      setErrorMessage("Data spotkania nie może być z przeszłości");
      return;
    }

    setSaving(true);
    setErrorMessage("");

    const activityTitle =
      activityType === "phone" ? selectedPhoneStatusLabel() : title;

    const { data: createdActivity, error } = await supabase
      .from("client_activities")
      .insert({
        client_id: clientId,
        created_by: currentUserId,
        activity_type: activityType,
        title: activityTitle,
        description,
        phone_contact_type: activityType === "phone" ? phoneContactType : null,
        phone_status: activityType === "phone" ? phoneStatus || null : null,
        follow_up_at:
          activityType === "phone" && shouldShowFollowUp() ? followUpAt : null,
        meeting_at:
          activityType === "phone" && shouldShowMeetingDate() ? meetingAt : null,
        meeting_owner_id:
          activityType === "phone" && shouldShowMeetingDate()
            ? currentUserId
            : null,
      })
      .select("id")
      .single();

    if (error) {
      console.error("Błąd zapisu aktywności", error);
      setErrorMessage("Nie udało się zapisać aktywności");
      setSaving(false);
      return;
    }

    if (
      createdActivity &&
      activityType === "phone" &&
      phoneContactType === "marketing" &&
      phoneStatus === "meeting_scheduled"
    ) {
      void trackMetaCrmEvent({
        eventName: "Schedule",
        sourceType: "client_activity",
        sourceId: createdActivity.id,
        clientId,
      });
    }

    setTitle("");
    setDescription("");
    setFollowUpAt("");
    setMeetingAt("");

    await loadActivities();
    setSaving(false);
  }

  function getActivityLabel(type: string) {
    switch (type) {
      case "phone":
        return "Telefon";
      case "sms":
        return "SMS";
      case "email":
        return "E-mail";
      case "meeting":
        return "Spotkanie";
      default:
        return type;
    }
  }

  function getBadgeStyle(type: string) {
    return {
      backgroundColor:
        type === "sms"
          ? "#16B4F2"
          : type === "phone"
          ? "#08C985"
          : type === "email"
          ? "#C94208"
          : type === "meeting"
          ? "#8F08C9"
          : "#64748B",
      color: type === "sms" || type === "phone" ? "#000000" : "#FFFFFF",
    };
  }

  return (
    <div className="mt-10 border-t border-slate-200 pt-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h4 className="text-xl font-bold">Historia kontaktów</h4>

          <p className="text-sm text-slate-500 mt-1">
            Telefony, maile, SMS-y i spotkania.
          </p>
        </div>
      </div>

      <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50 mb-6 space-y-4">
        <div className="flex flex-wrap gap-2">
          {[
            { value: "phone", label: "Telefon" },
            { value: "sms", label: "SMS" },
            { value: "email", label: "E-mail" },
            { value: "meeting", label: "Spotkanie" },
          ].map((type) => (
            <button
              key={type.value}
              type="button"
              onClick={() => setActivityType(type.value)}
              className={`px-4 py-2 rounded-xl border text-sm ${
                activityType === type.value
                  ? "bg-emerald-500 border-emerald-500 text-white"
                  : "bg-white border-slate-300 text-slate-700"
              }`}
            >
              {type.label}
            </button>
          ))}
        </div>

        {activityType === "phone" ? (
          <>
            <div className="grid md:grid-cols-2 gap-4">
              <select
                value={phoneContactType}
                onChange={(event) => setPhoneContactType(event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3"
              >
                {phoneContactTypeOptions.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>

              {phoneContactType !== "relationship" && (
                <select
                  value={phoneStatus}
                  onChange={(event) => setPhoneStatus(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3"
                >
                  {(phoneContactType === "marketing"
                    ? marketingStatusOptions
                    : incomingStatusOptions
                  ).map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {shouldShowFollowUp() && (
              <DateTimePicker
                label="Data i godzina ponownego kontaktu"
                value={followUpAt}
                onChange={setFollowUpAt}
              />
            )}

            {shouldShowMeetingDate() && (
              <DateTimePicker
                label="Data i godzina spotkania"
                value={meetingAt}
                onChange={setMeetingAt}
              />
            )}
          </>
        ) : (
          <input
            type="text"
            placeholder="Tytuł kontaktu"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3"
          />
        )}

        <textarea
          placeholder="Opis kontaktu..."
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          className="w-full min-h-[120px] rounded-xl border border-slate-300 bg-white px-4 py-3 resize-none"
        />

        <div className="flex justify-end">
          <button
            type="button"
            onClick={addActivity}
            disabled={saving}
            className="bg-emerald-500 hover:bg-emerald-400 text-white font-medium px-4 py-2 rounded-xl disabled:opacity-50"
          >
            {saving ? "Zapisywanie..." : "Dodaj aktywność"}
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="text-sm text-red-500 mb-4">{errorMessage}</div>
      )}

      {loading ? (
        <div className="text-sm text-slate-400">
          Ładowanie historii kontaktów...
        </div>
      ) : activities.length === 0 ? (
        <div className="text-sm text-slate-400">
          Brak historii kontaktów.
        </div>
      ) : (
        <div className="space-y-4">
          {activities.map((activity) => (
            <div
              key={activity.id}
              className="border border-slate-200 rounded-2xl p-4 bg-slate-50"
            >
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className="text-xs px-2 py-1 rounded-lg font-medium"
                      style={getBadgeStyle(activity.activity_type)}
                    >
                      {getActivityLabel(activity.activity_type)}
                    </span>

                    <p className="font-semibold">{activity.title}</p>
                  </div>

                  <p className="text-xs text-slate-400 mt-1">
                    {activity.author_name || activity.created_by} •{" "}
                    {new Date(activity.created_at).toLocaleString("pl-PL")}
                  </p>

                  {activity.activity_type === "phone" && (
                    <div className="flex flex-wrap gap-2 mt-3 text-xs">
                      {activity.phone_contact_type && (
                        <span className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-600">
                          {selectedPhoneContactTypeLabel(
                            activity.phone_contact_type
                          )}
                        </span>
                      )}

                      {activity.phone_status && (
                        <span className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-600">
                          {selectedPhoneStatusDisplayLabel(
                            activity.phone_status
                          )}
                        </span>
                      )}

                      {activity.follow_up_at && (
                        <span className="bg-amber-100 text-amber-800 rounded-lg px-2 py-1 font-medium">
                          Follow-up: {" "}
                          {new Date(activity.follow_up_at).toLocaleString(
                            "pl-PL"
                          )}
                        </span>
                      )}

                      {activity.meeting_at && (
                        <span className="bg-purple-100 text-purple-800 rounded-lg px-2 py-1 font-medium">
                          Spotkanie: {" "}
                          {new Date(activity.meeting_at).toLocaleString(
                            "pl-PL"
                          )}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {activity.description && (
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                  {activity.description}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
