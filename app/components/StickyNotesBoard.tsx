"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { supabase } from "@/lib/supabase";

type UserRole = "admin" | "owner" | "manager" | "seller" | "cc";
type NoteVisibility = "private" | "management" | "public" | "shared" | "user";
type NoteColor =
  | "yellow"
  | "mint"
  | "blue"
  | "pink"
  | "lavender"
  | "peach"
  | "coral"
  | "aqua"
  | "sage"
  | "lilac"
  | "apricot"
  | "stone";
type ReminderUnit = "minutes" | "hours" | "days" | "weeks";
type ReminderMode = "relative" | "scheduled" | "recurring";

type NoteComment = {
  id: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: string;
};

type StickyNote = {
  id: string;
  content: string;
  color: NoteColor;
  authorId?: string;
  visibility: NoteVisibility;
  recipientIds: string[];
  recipientNames: string[];
  authorName: string;
  createdAt: string;
  expiresAt: string | null;
  reminderEnabled?: boolean;
  reminderMode?: ReminderMode;
  reminderAmount?: number | null;
  reminderUnit?: ReminderUnit | null;
  reminderAt?: string | null;
  completedAt?: string | null;
  completedById?: string | null;
  completedByName?: string | null;
  comments?: NoteComment[];
};

type Recipient = {
  id: string;
  display_name: string | null;
  email: string | null;
  role: UserRole | null;
  is_active: boolean | null;
  sticky_note_color?: NoteColor | null;
};

type PreviewRecipient = {
  id: string;
  displayName: string;
  email?: string;
  role: UserRole;
  stickyNoteColor?: NoteColor;
};

type StickyNotesBoardProps = {
  currentUserId: string;
  currentUserEmail?: string;
  currentUserName?: string;
  currentUserRole: UserRole;
  currentUserColor?: NoteColor;
  previewRecipients?: PreviewRecipient[];
  persistLocally?: boolean;
};

const noteColorStyles: Record<NoteColor, string> = {
  yellow: "border-amber-200 bg-[#fff2a8]",
  mint: "border-emerald-200 bg-[#ccebdc]",
  blue: "border-sky-200 bg-[#cdebf7]",
  pink: "border-rose-200 bg-[#ffd7df]",
  lavender: "border-violet-200 bg-[#e8ddff]",
  peach: "border-orange-200 bg-[#ffd8b8]",
  coral: "border-red-200 bg-[#ffc9c2]",
  aqua: "border-cyan-200 bg-[#c8f0ee]",
  sage: "border-lime-200 bg-[#dce8c5]",
  lilac: "border-fuchsia-200 bg-[#f0d6f2]",
  apricot: "border-amber-200 bg-[#ffe2a8]",
  stone: "border-stone-300 bg-[#e8e3dc]",
};

const noteGlowColors: Record<NoteColor, string> = {
  yellow: "rgba(250, 204, 21, 0.88)",
  mint: "rgba(52, 211, 153, 0.88)",
  blue: "rgba(56, 189, 248, 0.88)",
  pink: "rgba(251, 113, 133, 0.88)",
  lavender: "rgba(167, 139, 250, 0.88)",
  peach: "rgba(251, 146, 60, 0.88)",
  coral: "rgba(248, 113, 113, 0.88)",
  aqua: "rgba(34, 211, 238, 0.88)",
  sage: "rgba(163, 230, 53, 0.88)",
  lilac: "rgba(232, 121, 249, 0.88)",
  apricot: "rgba(251, 191, 36, 0.88)",
  stone: "rgba(168, 162, 158, 0.88)",
};

const reminderUnitOptions: Array<{ value: ReminderUnit; label: string }> = [
  { value: "minutes", label: "minut" },
  { value: "hours", label: "godzin" },
  { value: "days", label: "dni" },
  { value: "weeks", label: "tygodni" },
];

const reminderModeOptions: Array<{
  value: ReminderMode;
  title: string;
  description: string;
}> = [
  { value: "relative", title: "Przed terminem", description: "Np. 2 dni wcześniej" },
  { value: "scheduled", title: "Jednorazowe", description: "W konkretnej dacie" },
  { value: "recurring", title: "Cykliczne", description: "Np. co 2 dni" },
];

const reminderUnitMilliseconds: Record<ReminderUnit, number> = {
  minutes: 60_000,
  hours: 3_600_000,
  days: 86_400_000,
  weeks: 604_800_000,
};

const noteRotations = ["md:-rotate-[0.6deg]", "md:rotate-[0.5deg]", "md:-rotate-[0.2deg]"];
const hourOptions = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, "0"));
const minuteOptions = ["00", "15", "30", "45"];

const roleLabels: Record<UserRole, string> = {
  admin: "Admin",
  owner: "Zarząd",
  manager: "Manager",
  seller: "Handlowiec",
  cc: "Call center",
};

function getRecipientName(profile: Recipient) {
  return profile.display_name?.trim() || profile.email?.trim() || "Użytkownik CRM";
}

function getNoteIdAtPoint(clientX: number, clientY: number) {
  const element = document.elementFromPoint(clientX, clientY);
  return element?.closest<HTMLElement>("[data-sticky-note-id]")?.dataset.stickyNoteId || null;
}

function reorderNotes(currentNotes: StickyNote[], sourceId: string, targetId: string) {
  const sourceIndex = currentNotes.findIndex((note) => note.id === sourceId);
  const targetIndex = currentNotes.findIndex((note) => note.id === targetId);

  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return currentNotes;

  const reordered = [...currentNotes];
  const [movedNote] = reordered.splice(sourceIndex, 1);
  reordered.splice(targetIndex, 0, movedNote);
  return reordered;
}

function formatReminderLead(amount: number, unit: ReminderUnit) {
  if (unit === "minutes") {
    if (amount === 1) return "1 minutę";
    if (amount % 10 >= 2 && amount % 10 <= 4 && (amount % 100 < 12 || amount % 100 > 14)) {
      return `${amount} minuty`;
    }
    return `${amount} minut`;
  }

  if (unit === "hours") {
    if (amount === 1) return "1 godzinę";
    if (amount % 10 >= 2 && amount % 10 <= 4 && (amount % 100 < 12 || amount % 100 > 14)) {
      return `${amount} godziny`;
    }
    return `${amount} godzin`;
  }

  if (unit === "days") return amount === 1 ? "1 dzień" : `${amount} dni`;

  if (amount === 1) return "1 tydzień";
  if (amount % 10 >= 2 && amount % 10 <= 4 && (amount % 100 < 12 || amount % 100 > 14)) {
    return `${amount} tygodnie`;
  }
  return `${amount} tygodni`;
}

function formatReminderDate(value: string) {
  return new Date(value).toLocaleString("pl-PL", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Warsaw",
  });
}

function reminderSummary(note: StickyNote) {
  const mode = note.reminderMode || "relative";

  if (mode === "scheduled" && note.reminderAt) {
    return `Przypomnienie: ${formatReminderDate(note.reminderAt)} · CRM + Teams`;
  }

  if (mode === "recurring" && note.reminderAt && note.reminderAmount && note.reminderUnit) {
    return `Co ${formatReminderLead(note.reminderAmount, note.reminderUnit)}, od ${formatReminderDate(note.reminderAt)} · CRM + Teams`;
  }

  if (note.reminderAmount && note.reminderUnit) {
    return `${formatReminderLead(note.reminderAmount, note.reminderUnit)} wcześniej · CRM + Teams`;
  }

  return null;
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

function visibilityLabel(note: StickyNote) {
  if (note.visibility === "private") return "Tylko ja";
  if (note.visibility === "management") return "Tylko zarząd";
  if (note.visibility === "public") return "Publiczna";
  if (note.visibility === "shared") {
    return note.recipientNames.length > 0
      ? `Zarząd + ${note.recipientNames.join(", ")}`
      : "Zarząd";
  }
  return note.recipientNames.length > 0
    ? `Dla: ${note.recipientNames.join(", ")}`
    : "Wybrani użytkownicy";
}

function canUserSeeNote(note: StickyNote, userId: string, role: UserRole) {
  if (note.visibility === "private") return note.authorId === userId;
  if (note.visibility === "management") return role === "owner";
  if (note.visibility === "public") return true;
  if (note.visibility === "shared") {
    return role === "owner" || note.recipientIds.includes(userId);
  }

  return note.authorId === userId || note.recipientIds.includes(userId);
}

function VisibilityIcon({ visibility }: { visibility: NoteVisibility }) {
  if (visibility === "private") {
    return (
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="5" y="10" width="14" height="10" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </svg>
    );
  }

  if (visibility === "management") {
    return (
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 19h16M6 16V9m4 7V5m4 11V8m4 8v-4" />
      </svg>
    );
  }

  if (visibility === "public") {
    return (
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="8" r="3" />
      <path d="M5 20c.8-4 3.1-6 7-6s6.2 2 7 6" />
    </svg>
  );
}

function normalizeMentionText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ł/g, "l")
    .replace(/[^a-z0-9@]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function renderTextWithMentions(content: string, profiles: Recipient[]) {
  const names = profiles
    .map(getRecipientName)
    .filter((name) => name && name !== "Użytkownik CRM")
    .sort((first, second) => second.length - first.length);

  if (names.length === 0) return content;
  const escapedNames = names.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const parts = content.split(new RegExp(`@(${escapedNames.join("|")})`, "g"));

  return parts.map((part, index) =>
    names.includes(part) ? (
      <span key={`${part}-${index}`} className="rounded-md bg-white/65 px-1 py-0.5 font-black text-slate-900">
        @{part}
      </span>
    ) : (
      <span key={`${part}-${index}`}>{part}</span>
    )
  );
}

type MentionTextareaProps = {
  value: string;
  onChange: (value: string) => void;
  allowedRecipients: Recipient[];
  mentionedUserIds: string[];
  onMentionedUserIdsChange: (ids: string[]) => void;
  placeholder: string;
  maxLength: number;
  rows?: number;
  autoFocus?: boolean;
  ariaLabel?: string;
  className: string;
};

function MentionTextarea({
  value,
  onChange,
  allowedRecipients,
  mentionedUserIds,
  onMentionedUserIdsChange,
  placeholder,
  maxLength,
  rows,
  autoFocus,
  ariaLabel,
  className,
}: MentionTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [mentionSearch, setMentionSearch] = useState("");
  const [mentionStartIndex, setMentionStartIndex] = useState<number | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const suggestions = allowedRecipients
    .filter((profile) => {
      const search = normalizeMentionText(mentionSearch);
      if (!search) return true;
      return normalizeMentionText(`${getRecipientName(profile)} ${profile.email || ""}`).includes(search);
    })
    .slice(0, 6);

  function updateDraft(nextValue: string, cursorPosition?: number | null) {
    onChange(nextValue);
    const retainedMentionIds = mentionedUserIds.filter((userId) => {
      const profile = allowedRecipients.find((item) => item.id === userId);
      return profile ? nextValue.includes(`@${getRecipientName(profile)}`) : false;
    });
    if (retainedMentionIds.length !== mentionedUserIds.length) {
      onMentionedUserIdsChange(retainedMentionIds);
    }

    const position = cursorPosition ?? nextValue.length;
    const textBeforeCursor = nextValue.slice(0, position);
    const match = textBeforeCursor.match(/(^|\s)@([\p{L}0-9._-]{0,40})$/u);

    if (!match) {
      setShowSuggestions(false);
      setMentionSearch("");
      setMentionStartIndex(null);
      return;
    }

    const query = match[2] || "";
    setMentionSearch(query);
    setMentionStartIndex(position - query.length - 1);
    setShowSuggestions(true);
  }

  function insertMention(profile: Recipient) {
    if (mentionStartIndex === null) return;
    const mentionText = `@${getRecipientName(profile)} `;
    const selectionEnd = textareaRef.current?.selectionEnd ?? value.length;
    const nextValue = `${value.slice(0, mentionStartIndex)}${mentionText}${value.slice(selectionEnd)}`;
    const nextCursor = mentionStartIndex + mentionText.length;
    onChange(nextValue);
    onMentionedUserIdsChange([...new Set([...mentionedUserIds, profile.id])]);
    setShowSuggestions(false);
    setMentionSearch("");
    setMentionStartIndex(null);
    window.requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(nextCursor, nextCursor);
    });
  }

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(event) => updateDraft(event.target.value, event.target.selectionStart)}
        onKeyUp={(event) => updateDraft(event.currentTarget.value, event.currentTarget.selectionStart)}
        onClick={(event) => updateDraft(event.currentTarget.value, event.currentTarget.selectionStart)}
        placeholder={placeholder}
        maxLength={maxLength}
        rows={rows}
        autoFocus={autoFocus}
        aria-label={ariaLabel}
        className={className}
      />
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute left-0 top-full z-[70] mt-1 w-full max-w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-600 dark:bg-slate-800">
          <div className="border-b border-slate-100 px-3 py-2 text-[10px] font-black uppercase tracking-wide text-slate-400 dark:border-slate-700">
            Wspomnij użytkownika
          </div>
          {suggestions.map((profile) => (
            <button
              key={profile.id}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => insertMention(profile)}
              className="block w-full truncate border-b border-slate-100 px-3 py-2 text-left text-sm font-bold text-slate-900 transition last:border-b-0 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-700"
            >
              @{getRecipientName(profile)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function StickyNotesBoard({
  currentUserId,
  currentUserEmail,
  currentUserName,
  currentUserRole,
  currentUserColor = "mint",
  previewRecipients,
  persistLocally = true,
}: StickyNotesBoardProps) {
  const isPreviewMode = Boolean(previewRecipients) || !persistLocally;
  const [notes, setNotes] = useState<StickyNote[]>([]);
  const [recipients, setRecipients] = useState<Recipient[]>(() =>
    (previewRecipients || []).map((profile) => ({
      id: profile.id,
      display_name: profile.displayName,
      email: profile.email || null,
      role: profile.role,
      is_active: true,
      sticky_note_color: profile.stickyNoteColor || null,
    }))
  );
  const [recipientsLoading, setRecipientsLoading] = useState(!previewRecipients);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [content, setContent] = useState("");
  const [visibility, setVisibility] = useState<NoteVisibility>("private");
  const [selectedRecipientIds, setSelectedRecipientIds] = useState<string[]>([]);
  const [expiresAt, setExpiresAt] = useState("");
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderMode, setReminderMode] = useState<ReminderMode>("relative");
  const [reminderAmount, setReminderAmount] = useState("2");
  const [reminderUnit, setReminderUnit] = useState<ReminderUnit>("days");
  const [reminderStartsAt, setReminderStartsAt] = useState("");
  const [formError, setFormError] = useState("");
  const [boardError, setBoardError] = useState("");
  const [notesLoading, setNotesLoading] = useState(!isPreviewMode);
  const [backendAvailable, setBackendAvailable] = useState(true);
  const [savingNote, setSavingNote] = useState(false);
  const [composerMentionIds, setComposerMentionIds] = useState<string[]>([]);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [openCommentsNoteId, setOpenCommentsNoteId] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [commentMentionIds, setCommentMentionIds] = useState<string[]>([]);
  const [commentError, setCommentError] = useState("");
  const [savingComment, setSavingComment] = useState(false);
  const [highlightedNoteId, setHighlightedNoteId] = useState<string | null>(null);
  const [currentTimestamp, setCurrentTimestamp] = useState(0);
  const highlightHandledRef = useRef("");
  const localFallbackKey = `ideasol:sticky-notes-prototype:v9:${currentUserId}`;

  const isOwnerOrAdmin = currentUserRole === "owner" || currentUserRole === "admin";
  const currentProfile = recipients.find((profile) => profile.id === currentUserId);
  const authorName = currentProfile
    ? getRecipientName(currentProfile)
    : currentUserName || currentUserEmail || "Użytkownik CRM";
  const authorColor = currentProfile?.sticky_note_color || currentUserColor;
  const selectedExpiryDate = getDateValue(expiresAt);
  const selectedExpiryTime = getTimeValue(expiresAt);
  const selectedExpiryHour = selectedExpiryTime ? selectedExpiryTime.slice(0, 2) : "09";
  const selectedExpiryMinute = selectedExpiryTime ? selectedExpiryTime.slice(3, 5) : "00";
  const selectedReminderDate = getDateValue(reminderStartsAt);
  const selectedReminderTime = getTimeValue(reminderStartsAt);
  const selectedReminderHour = selectedReminderTime ? selectedReminderTime.slice(0, 2) : "09";
  const selectedReminderMinute = selectedReminderTime ? selectedReminderTime.slice(3, 5) : "00";

  const availableRecipients = useMemo(
    () => recipients.filter((profile) => profile.id !== currentUserId),
    [currentUserId, recipients]
  );
  const visibleNotes = useMemo(
    () => notes.filter((note) => canUserSeeNote(note, currentUserId, currentUserRole)),
    [currentUserId, currentUserRole, notes]
  );
  const recipientsForSelection =
    visibility === "shared"
      ? availableRecipients.filter((profile) => profile.role !== "owner")
      : availableRecipients;
  const composerMentionRecipients = availableRecipients.filter((profile) => {
    if (visibility === "private") return false;
    if (visibility === "public") return true;
    if (visibility === "management") return profile.role === "owner";
    if (visibility === "shared") {
      return profile.role === "owner" || selectedRecipientIds.includes(profile.id);
    }
    return selectedRecipientIds.includes(profile.id);
  });

  const reminderAudienceDescription = (() => {
    if (visibility === "private") {
      return "Notatkę widzisz tylko Ty. Nie wysyłamy powiadomienia Teams do samego autora.";
    }

    if (visibility === "management") {
      return "Zarząd otrzyma powiadomienie w CRM, a Teams wyśle jedną wiadomość na czat grupowy „Zarząd”.";
    }

    if (visibility === "public") {
      return "Każdy użytkownik zobaczy notatkę w CRM, a Teams wyśle wiadomość na czat „Ogólny”.";
    }

    if (visibility === "shared") {
      const selectedCount = selectedRecipientIds.length;
      return selectedCount > 0
        ? `Powiadomienie otrzyma zarząd oraz ${selectedCount} ${selectedCount === 1 ? "wskazana osoba" : "wskazane osoby"}. Teams użyje czatu „Zarząd” i wiadomości prywatnych.`
        : "Powiadomienie otrzyma zarząd oraz wszystkie wskazane osoby. Teams użyje czatu „Zarząd” i wiadomości prywatnych.";
    }

    return selectedRecipientIds.length > 0
      ? "Powiadomienie otrzymasz Ty i wskazany użytkownik — w CRM i wiadomościach prywatnych Teams."
      : "Po wybraniu użytkownika oboje otrzymacie powiadomienie w CRM i Teams.";
  })();
  const reminderDatePreview = (() => {
    if (!reminderEnabled) return null;

    let reminderTimestamp: number;

    if (reminderMode === "relative") {
      if (!expiresAt) return null;
      const parsedAmount = Number(reminderAmount);
      if (!Number.isInteger(parsedAmount) || parsedAmount < 1) return null;
      reminderTimestamp =
        new Date(expiresAt).getTime() - parsedAmount * reminderUnitMilliseconds[reminderUnit];
    } else {
      if (!reminderStartsAt) return null;
      reminderTimestamp = new Date(reminderStartsAt).getTime();
    }

    if (!Number.isFinite(reminderTimestamp)) return null;

    return new Date(reminderTimestamp).toLocaleString("pl-PL", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Warsaw",
    });
  })();

  useEffect(() => {
    if (previewRecipients) return;

    let mounted = true;

    async function loadRecipients() {
      setRecipientsLoading(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, email, role, is_active, sticky_note_color")
        .order("display_name", { ascending: true });

      if (!mounted) return;

      if (error) {
        console.error("Nie udało się pobrać odbiorców sticky notes", error);
        setRecipients([]);
      } else {
        setRecipients(
          ((data || []) as Recipient[]).filter((profile) => profile.is_active !== false)
        );
      }

      setRecipientsLoading(false);
    }

    void loadRecipients();

    return () => {
      mounted = false;
    };
  }, [previewRecipients]);

  useEffect(() => {
    if (isPreviewMode) return;
    let active = true;

    async function loadNotes() {
      setNotesLoading(true);
      setBoardError("");
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        if (active) {
          setBoardError("Sesja wygasła. Zaloguj się ponownie.");
          setNotesLoading(false);
        }
        return;
      }

      try {
        const response = await fetch("/api/sticky-notes", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const result = (await response.json()) as {
          ok?: boolean;
          notes?: StickyNote[];
          error?: string;
        };
        if (!response.ok) throw new Error(result.error || "Nie udało się pobrać notatek.");
        if (active) {
          setBackendAvailable(true);
          setNotes(result.notes || []);
        }
      } catch (error) {
        if (active) {
          if (process.env.NODE_ENV === "development") {
            const savedNotes = window.localStorage.getItem(localFallbackKey);
            let fallbackNotes: StickyNote[] = [];
            if (savedNotes) {
              try {
                const parsedNotes = JSON.parse(savedNotes) as StickyNote[];
                if (Array.isArray(parsedNotes)) fallbackNotes = parsedNotes;
              } catch {
                // Ignore invalid local data and keep the development board empty.
              }
            }
            setNotes(fallbackNotes);
            setBackendAvailable(false);
            setBoardError("");
          } else {
            setBoardError(error instanceof Error ? error.message : "Nie udało się pobrać notatek.");
          }
        }
      } finally {
        if (active) setNotesLoading(false);
      }
    }

    void loadNotes();
    return () => {
      active = false;
    };
  }, [currentUserEmail, currentUserId, currentUserName, isPreviewMode, localFallbackKey, previewRecipients]);

  useEffect(() => {
    if (isPreviewMode || backendAvailable || process.env.NODE_ENV !== "development") return;
    window.localStorage.setItem(localFallbackKey, JSON.stringify(notes));
  }, [backendAvailable, isPreviewMode, localFallbackKey, notes]);

  useEffect(() => {
    if (notesLoading || notes.length === 0) return;
    const searchParams = new URLSearchParams(window.location.search);
    const noteId = searchParams.get("stickyNote") || "";
    if (!noteId || highlightHandledRef.current === noteId) return;
    if (!notes.some((note) => note.id === noteId)) return;

    highlightHandledRef.current = noteId;
    window.requestAnimationFrame(() => {
      setHighlightedNoteId(noteId);
      if (searchParams.get("comments") === "1") setOpenCommentsNoteId(noteId);
      document.getElementById(`sticky-note-${noteId}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      window.setTimeout(() => setHighlightedNoteId(null), 9000);
    });
  }, [notes, notesLoading]);

  useEffect(() => {
    if (!isComposerOpen) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setIsComposerOpen(false);
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isComposerOpen]);

  useEffect(() => {
    if (!openCommentsNoteId) return;

    function closeCommentsOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpenCommentsNoteId(null);
      setCommentDraft("");
      setCommentMentionIds([]);
      setCommentError("");
    }

    window.addEventListener("keydown", closeCommentsOnEscape);
    return () => window.removeEventListener("keydown", closeCommentsOnEscape);
  }, [openCommentsNoteId]);

  useEffect(() => {
    const updateCurrentTime = () => setCurrentTimestamp(Date.now());
    const frameId = window.requestAnimationFrame(updateCurrentTime);
    const intervalId = window.setInterval(updateCurrentTime, 60_000);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (!draggedId) return;
    const sourceId = draggedId;

    function updateDropTarget(event: PointerEvent) {
      const targetId = getNoteIdAtPoint(event.clientX, event.clientY);
      setDragOverId(targetId && targetId !== sourceId ? targetId : null);
    }

    function finishDrag(event: PointerEvent) {
      const targetId = getNoteIdAtPoint(event.clientX, event.clientY);

      if (targetId && targetId !== sourceId) {
        const reordered = reorderNotes(notes, sourceId, targetId);
        setNotes(reordered);
        if (!isPreviewMode && backendAvailable) {
          void (async () => {
            try {
              const { data } = await supabase.auth.getSession();
              const accessToken = data.session?.access_token;
              if (!accessToken) throw new Error("Sesja wygasła. Zaloguj się ponownie.");
              const response = await fetch("/api/sticky-notes/reorder", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${accessToken}`,
                },
                body: JSON.stringify({ orderedIds: reordered.map((note) => note.id) }),
              });
              const result = (await response.json()) as { error?: string };
              if (!response.ok) throw new Error(result.error || "Nie udało się zapisać układu tablicy.");
            } catch (error) {
              setBoardError(error instanceof Error ? error.message : "Nie udało się zapisać układu tablicy.");
            }
          })();
        }
      }

      setDraggedId(null);
      setDragOverId(null);
    }

    function cancelDrag() {
      setDraggedId(null);
      setDragOverId(null);
    }

    window.addEventListener("pointermove", updateDropTarget);
    window.addEventListener("pointerup", finishDrag, true);
    window.addEventListener("pointercancel", cancelDrag, true);
    window.addEventListener("blur", cancelDrag);

    return () => {
      window.removeEventListener("pointermove", updateDropTarget);
      window.removeEventListener("pointerup", finishDrag, true);
      window.removeEventListener("pointercancel", cancelDrag, true);
      window.removeEventListener("blur", cancelDrag);
    };
  }, [backendAvailable, draggedId, isPreviewMode, notes]);

  function resetComposer() {
    setContent("");
    setVisibility("private");
    setSelectedRecipientIds([]);
    setExpiresAt("");
    setReminderEnabled(false);
    setReminderMode("relative");
    setReminderAmount("2");
    setReminderUnit("days");
    setReminderStartsAt("");
    setComposerMentionIds([]);
    setFormError("");
  }

  function closeComposer() {
    setIsComposerOpen(false);
    resetComposer();
  }

  async function getStickyApiHeaders() {
    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;
    if (!accessToken) throw new Error("Sesja wygasła. Zaloguj się ponownie.");
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    };
  }

  async function addNote() {
    const trimmedContent = content.trim();

    if (!trimmedContent) {
      setFormError("Wpisz treść notatki.");
      return;
    }

    if ((visibility === "shared" || visibility === "user") && selectedRecipientIds.length === 0) {
      setFormError("Wybierz co najmniej jedną osobę, która ma zobaczyć notatkę.");
      return;
    }

    const parsedReminderAmount = Number(reminderAmount);
    const expiresAtTimestamp = expiresAt ? new Date(expiresAt).getTime() : null;
    let reminderAtTimestamp: number | null = null;

    if (
      reminderEnabled &&
      reminderMode !== "scheduled" &&
      (!Number.isInteger(parsedReminderAmount) || parsedReminderAmount < 1)
    ) {
      setFormError("Wpisz pełną liczbę większą od zera dla przypomnienia.");
      return;
    }

    if (reminderEnabled && reminderMode === "relative") {
      if (expiresAtTimestamp === null) {
        setFormError("Wybierz konkretną datę przypomnienia albo tryb cykliczny.");
        return;
      }

      reminderAtTimestamp =
        expiresAtTimestamp - parsedReminderAmount * reminderUnitMilliseconds[reminderUnit];
    }

    if (reminderEnabled && reminderMode !== "relative") {
      if (!reminderStartsAt) {
        setFormError(
          reminderMode === "recurring"
            ? "Ustaw datę i godzinę pierwszego przypomnienia."
            : "Ustaw datę i godzinę przypomnienia."
        );
        return;
      }

      reminderAtTimestamp = new Date(reminderStartsAt).getTime();
    }

    if (reminderEnabled && reminderAtTimestamp !== null && reminderAtTimestamp <= currentTimestamp) {
      setFormError("Termin przypomnienia musi przypadać w przyszłości.");
      return;
    }

    if (
      reminderEnabled &&
      reminderMode === "recurring" &&
      expiresAtTimestamp !== null &&
      reminderAtTimestamp !== null &&
      reminderAtTimestamp > expiresAtTimestamp
    ) {
      setFormError("Pierwsze przypomnienie cykliczne musi przypadać przed terminem notatki.");
      return;
    }

    const selectedRecipients = recipients.filter((profile) => selectedRecipientIds.includes(profile.id));
    const newNote: StickyNote = {
      id: crypto.randomUUID(),
      content: trimmedContent,
      color: authorColor,
      authorId: currentUserId,
      visibility,
      recipientIds:
        visibility === "shared" || visibility === "user" ? selectedRecipientIds : [],
      recipientNames:
        visibility === "shared" || visibility === "user"
          ? selectedRecipients.map(getRecipientName)
          : [],
      authorName,
      createdAt: new Date().toISOString(),
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      reminderEnabled,
      reminderMode: reminderEnabled ? reminderMode : undefined,
      reminderAmount:
        reminderEnabled && reminderMode !== "scheduled" ? parsedReminderAmount : null,
      reminderUnit:
        reminderEnabled && reminderMode !== "scheduled" ? reminderUnit : null,
      reminderAt:
        reminderEnabled && reminderAtTimestamp !== null
          ? new Date(reminderAtTimestamp).toISOString()
          : null,
      comments: [],
    };

    if (isPreviewMode || !backendAvailable) {
      setNotes((currentNotes) => [...currentNotes, newNote]);
      closeComposer();
      return;
    }

    setSavingNote(true);
    setFormError("");
    try {
      const response = await fetch("/api/sticky-notes", {
        method: "POST",
        headers: await getStickyApiHeaders(),
        body: JSON.stringify({
          content: trimmedContent,
          visibility,
          recipientIds: newNote.recipientIds,
          mentionedUserIds: composerMentionIds,
          expiresAt: newNote.expiresAt,
          reminderEnabled,
          reminderMode: newNote.reminderMode,
          reminderAmount: newNote.reminderAmount,
          reminderUnit: newNote.reminderUnit,
          reminderAt: newNote.reminderAt,
        }),
      });
      const result = (await response.json()) as {
        note?: StickyNote;
        error?: string;
        notificationErrors?: string[];
      };
      if (!response.ok || !result.note) {
        throw new Error(result.error || "Nie udało się dodać notatki.");
      }
      setNotes((currentNotes) => [...currentNotes, result.note as StickyNote]);
      if (result.notificationErrors?.length) {
        console.warn("Notatka została zapisana, ale część powiadomień nie została wysłana:", result.notificationErrors);
      }
      window.dispatchEvent(new Event("ideasol-notifications-refresh"));
      closeComposer();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Nie udało się dodać notatki.");
    } finally {
      setSavingNote(false);
    }
  }

  async function removeNote(note: StickyNote) {
    const canDelete = currentUserRole === "admin" || note.authorId === currentUserId;
    if (!canDelete) return;

    if (!isPreviewMode && backendAvailable) {
      try {
        const response = await fetch(`/api/sticky-notes/${note.id}`, {
          method: "DELETE",
          headers: await getStickyApiHeaders(),
        });
        const result = (await response.json()) as { error?: string };
        if (!response.ok) throw new Error(result.error || "Nie udało się usunąć notatki.");
      } catch (error) {
        setBoardError(error instanceof Error ? error.message : "Nie udało się usunąć notatki.");
        return;
      }
    }

    setNotes((currentNotes) => currentNotes.filter((currentNote) => currentNote.id !== note.id));
    if (openCommentsNoteId === note.id) {
      setOpenCommentsNoteId(null);
      setCommentMentionIds([]);
    }
  }

  function canCompleteNote(note: StickyNote) {
    if (currentUserRole === "admin" || note.authorId === currentUserId) return true;
    if (note.recipientIds.includes(currentUserId)) return true;

    return (
      currentUserRole === "owner" &&
      (note.visibility === "management" || note.visibility === "shared")
    );
  }

  async function toggleNoteCompleted(note: StickyNote) {
    if (!canCompleteNote(note)) return;

    const isCompleted = Boolean(note.completedAt);
    let completedAt = isCompleted ? null : new Date().toISOString();
    let completedById = isCompleted ? null : currentUserId;
    let completedByName = isCompleted ? null : authorName;

    if (!isPreviewMode && backendAvailable) {
      try {
        const response = await fetch(`/api/sticky-notes/${note.id}`, {
          method: "PATCH",
          headers: await getStickyApiHeaders(),
          body: JSON.stringify({ action: "toggle-completed" }),
        });
        const result = (await response.json()) as {
          error?: string;
          completion?: {
            completed_at: string | null;
            completed_by_id: string | null;
            completed_by_name: string | null;
          };
        };
        if (!response.ok || !result.completion) {
          throw new Error(result.error || "Nie udało się zmienić statusu notatki.");
        }
        completedAt = result.completion.completed_at;
        completedById = result.completion.completed_by_id;
        completedByName = result.completion.completed_by_name;
      } catch (error) {
        setBoardError(error instanceof Error ? error.message : "Nie udało się zmienić statusu notatki.");
        return;
      }
    }

    setNotes((currentNotes) =>
      currentNotes.map((currentNote) =>
        currentNote.id === note.id
          ? {
              ...currentNote,
              completedAt,
              completedById,
              completedByName,
            }
          : currentNote
      )
    );
  }

  function toggleComments(noteId: string) {
    setOpenCommentsNoteId((currentId) => (currentId === noteId ? null : noteId));
    setCommentDraft("");
    setCommentMentionIds([]);
    setCommentError("");
  }

  async function addComment(noteId: string) {
    const trimmedComment = commentDraft.trim();

    if (!trimmedComment) {
      setCommentError("Wpisz treść komentarza.");
      return;
    }

    let newComment: NoteComment = {
      id: crypto.randomUUID(),
      authorId: currentUserId,
      authorName,
      content: trimmedComment,
      createdAt: new Date().toISOString(),
    };

    if (!isPreviewMode && backendAvailable) {
      setSavingComment(true);
      setCommentError("");
      try {
        const response = await fetch(`/api/sticky-notes/${noteId}/comments`, {
          method: "POST",
          headers: await getStickyApiHeaders(),
          body: JSON.stringify({
            content: trimmedComment,
            mentionedUserIds: commentMentionIds,
          }),
        });
        const result = (await response.json()) as {
          comment?: NoteComment;
          error?: string;
          notificationErrors?: string[];
        };
        if (!response.ok || !result.comment) {
          throw new Error(result.error || "Nie udało się dodać komentarza.");
        }
        newComment = result.comment;
        if (result.notificationErrors?.length) {
          console.warn("Komentarz został zapisany, ale część powiadomień nie została wysłana:", result.notificationErrors);
        }
        window.dispatchEvent(new Event("ideasol-notifications-refresh"));
      } catch (error) {
        setCommentError(error instanceof Error ? error.message : "Nie udało się dodać komentarza.");
        setSavingComment(false);
        return;
      }
      setSavingComment(false);
    }

    setNotes((currentNotes) =>
      currentNotes.map((note) =>
        note.id === noteId
          ? { ...note, comments: [...(note.comments || []), newComment] }
          : note
      )
    );
    setCommentDraft("");
    setCommentMentionIds([]);
    setCommentError("");
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className={`flex flex-col gap-4 px-4 py-5 sm:px-6 sm:py-6 lg:flex-row lg:items-center lg:justify-between ${isCollapsed ? "" : "border-b border-slate-200 dark:border-slate-700"}`}>
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950/70 dark:text-amber-200">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 3h12a2 2 0 0 1 2 2v10l-6 6H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
              <path d="M14 21v-6h6M8 8h8M8 12h5" />
            </svg>
          </div>

          <h2 className="pt-1 text-xl font-bold text-slate-900 dark:text-slate-100 sm:text-2xl">
            Tablica zadań
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
          <button
            type="button"
            onClick={() => setIsComposerOpen(true)}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-400"
          >
            <span className="text-lg leading-none">+</span>
            Dodaj notatkę
          </button>
          <button
            type="button"
            onClick={() => setIsCollapsed((value) => !value)}
            className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
            aria-expanded={!isCollapsed}
          >
            {isCollapsed ? "Rozwiń" : "Zwiń"}
          </button>
        </div>
      </div>

      {!isCollapsed && <div
        className="sticky-notes-surface relative min-h-[300px] p-4 sm:p-6"
      >
        {boardError && (
          <p className="mb-4 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 dark:border-red-900 dark:bg-red-950/70 dark:text-red-200" role="alert">
            {boardError}
          </p>
        )}
        {notesLoading ? (
          <div className="flex min-h-56 items-center justify-center text-sm font-bold text-slate-500 dark:text-slate-400">
            Ładowanie tablicy zadań…
          </div>
        ) : visibleNotes.length === 0 ? (
          <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/65 px-6 text-center dark:border-slate-600 dark:bg-slate-900/65">
            <div className="mb-3 text-3xl">📝</div>
            <p className="font-bold text-slate-800 dark:text-slate-100">Tablica jest pusta</p>
            <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">
              Dodaj pierwszą notatkę i zdecyduj, kto powinien ją zobaczyć.
            </p>
          </div>
        ) : (
          <div
            className={`grid items-start gap-3 transition-[padding] duration-200 sm:gap-4 md:grid-cols-2 xl:grid-cols-3 ${
              openCommentsNoteId ? "pb-80" : ""
            }`}
          >
            {visibleNotes.map((note, index) => {
              const isCompleted = Boolean(note.completedAt);
              const isExpired = Boolean(
                !isCompleted &&
                  note.expiresAt &&
                  currentTimestamp > 0 &&
                  new Date(note.expiresAt).getTime() < currentTimestamp
              );
              const noteAuthorProfile = note.authorId
                ? recipients.find((profile) => profile.id === note.authorId)
                : null;
              const noteAuthorName = noteAuthorProfile
                ? getRecipientName(noteAuthorProfile)
                : note.authorName;
              const noteAuthorColor = noteAuthorProfile?.sticky_note_color || note.color;
              const canDeleteNote =
                currentUserRole === "admin" || note.authorId === currentUserId;
              const canMarkCompleted = canCompleteNote(note);
              const noteComments = note.comments || [];
              const areCommentsOpen = openCommentsNoteId === note.id;
              const noteReminderSummary = reminderSummary(note);
              const noteMentionRecipients = availableRecipients.filter((profile) => {
                if (note.visibility === "private") return profile.id === note.authorId;
                if (note.visibility === "public") return true;
                if (note.visibility === "management") return profile.role === "owner";
                if (note.visibility === "shared") {
                  return (
                    profile.role === "owner" ||
                    profile.id === note.authorId ||
                    note.recipientIds.includes(profile.id)
                  );
                }
                return profile.id === note.authorId || note.recipientIds.includes(profile.id);
              });
              const isHighlighted = highlightedNoteId === note.id;
              const highlightStyle = isHighlighted
                ? ({ "--sticky-note-glow": noteGlowColors[noteAuthorColor] } as CSSProperties)
                : undefined;

              return (
                <article
                  key={note.id}
                  id={`sticky-note-${note.id}`}
                  data-sticky-note-id={note.id}
                  style={highlightStyle}
                  className={`sticky-note-card group relative flex min-h-40 flex-col rounded-xl border p-4 text-slate-950 shadow-[0_8px_20px_rgba(15,23,42,0.10)] transition sm:min-h-48 sm:rounded-sm sm:p-5 md:hover:-translate-y-1 md:hover:shadow-[0_14px_28px_rgba(15,23,42,0.14)] ${noteColorStyles[noteAuthorColor]} ${noteRotations[index % noteRotations.length]} ${
                    draggedId === note.id ? "opacity-40" : "opacity-100"
                  } ${dragOverId === note.id ? "ring-4 ring-emerald-300" : "ring-0"} ${
                    isCompleted ? "ring-2 ring-emerald-500/70" : ""
                  } ${areCommentsOpen ? "z-30" : "z-0"} ${isHighlighted ? "sticky-note-highlighted" : ""}`}
                >
                <button
                  type="button"
                  onPointerDown={(event) => {
                    if (event.button !== 0) return;

                    event.preventDefault();
                    setDraggedId(note.id);
                    setDragOverId(null);
                  }}
                  className="sticky-note-chip absolute left-1/2 top-0 z-10 hidden h-7 w-24 -translate-x-1/2 -translate-y-2 touch-none select-none cursor-grab items-center justify-center rounded-md bg-white/65 text-slate-600 shadow-sm transition hover:bg-white hover:text-slate-800 active:cursor-grabbing md:flex"
                  aria-label={`Przeciągnij notatkę: ${note.content}`}
                  title="Chwyć i przeciągnij"
                >
                  <svg viewBox="0 0 24 12" className="h-3 w-6" fill="currentColor" aria-hidden="true">
                    <circle cx="6" cy="3" r="1.5" />
                    <circle cx="12" cy="3" r="1.5" />
                    <circle cx="18" cy="3" r="1.5" />
                    <circle cx="6" cy="9" r="1.5" />
                    <circle cx="12" cy="9" r="1.5" />
                    <circle cx="18" cy="9" r="1.5" />
                  </svg>
                </button>

                <div className="relative flex items-start justify-between gap-3">
                  <span
                    className="sticky-note-chip inline-flex max-w-[48%] items-center gap-1.5 rounded-full bg-white/60 px-2.5 py-1 text-[11px] font-bold text-slate-900 sm:max-w-[58%]"
                    title={visibilityLabel(note)}
                  >
                    <VisibilityIcon visibility={note.visibility} />
                    <span className="truncate">{visibilityLabel(note)}</span>
                  </span>

                  <div className="flex shrink-0 items-center gap-1">
                    {canMarkCompleted && (
                      <button
                        type="button"
                        onClick={() => toggleNoteCompleted(note)}
                        className={`flex h-8 w-8 items-center justify-center rounded-full shadow-sm transition ${
                          isCompleted
                            ? "bg-emerald-600 text-white hover:bg-emerald-700"
                            : "bg-white/60 text-slate-700 hover:bg-white hover:text-emerald-700"
                        }`}
                        aria-label={isCompleted ? "Cofnij oznaczenie wykonania" : "Oznacz jako wykonaną"}
                        title={isCompleted ? "Cofnij oznaczenie wykonania" : "Oznacz jako wykonaną"}
                      >
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                          <path d="m5 12 4 4L19 6" />
                        </svg>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => toggleComments(note.id)}
                      className={`inline-flex h-8 min-w-8 items-center justify-center gap-1 rounded-full px-2 text-xs font-black shadow-sm transition ${
                        areCommentsOpen
                          ? "bg-slate-900 text-white"
                          : "bg-white/60 text-slate-700 hover:bg-white hover:text-slate-950"
                      }`}
                      aria-label={`Komentarze (${noteComments.length})`}
                      aria-expanded={areCommentsOpen}
                      aria-controls={`sticky-note-comments-${note.id}`}
                      title="Komentarze"
                    >
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" />
                      </svg>
                      <span>{noteComments.length}</span>
                    </button>
                    {isExpired && (
                      <span
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-red-600 text-base font-black text-white shadow-sm"
                        title="Termin ważności minął"
                        aria-label="Termin ważności minął"
                      >
                        !
                      </span>
                    )}
                    {canDeleteNote ? (
                      <button
                        type="button"
                        onClick={() => removeNote(note)}
                        className="flex h-8 w-8 items-center justify-center rounded-full text-slate-600 transition hover:bg-white/60 hover:text-slate-950"
                        aria-label="Usuń notatkę"
                        title="Usuń notatkę"
                      >
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="m7 7 10 10M17 7 7 17" />
                        </svg>
                      </button>
                    ) : null}
                  </div>
                </div>

                <p className={`relative mt-4 flex-1 whitespace-pre-wrap text-[15px] font-semibold leading-relaxed sm:text-base ${
                  isCompleted ? "text-slate-600 line-through decoration-emerald-700/70 decoration-2" : ""
                }`}>
                  {renderTextWithMentions(note.content, recipients)}
                </p>

                <div className="sticky-note-muted relative mt-5 border-t border-black/10 pt-3 text-[11px] text-slate-600">
                  <div className="min-w-0 space-y-1">
                    <p className="truncate font-bold text-slate-700">{noteAuthorName}</p>
                    <p>
                      {new Date(note.createdAt).toLocaleDateString("pl-PL", {
                        day: "2-digit",
                        month: "short",
                        timeZone: "Europe/Warsaw",
                      })}
                      , {new Date(note.createdAt).toLocaleTimeString("pl-PL", {
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZone: "Europe/Warsaw",
                      })}
                    </p>
                    {note.expiresAt ? (
                      <p
                        className={
                          isExpired
                            ? "sticky-note-expired text-xs font-black text-red-700"
                            : "font-semibold text-slate-700"
                        }
                      >
                        {isCompleted ? "Termin: " : isExpired ? "Termin minął: " : "Ważna do: "}
                        {new Date(note.expiresAt).toLocaleString("pl-PL", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                          timeZone: "Europe/Warsaw",
                        })}
                      </p>
                    ) : (
                      <p className="font-semibold text-slate-700">Bez terminu</p>
                    )}
                    {note.reminderEnabled && !isCompleted && noteReminderSummary && (
                      <p className="sticky-note-chip inline-flex items-center gap-1.5 rounded-full bg-white/60 px-2.5 py-1 font-bold text-slate-700">
                        <svg
                          viewBox="0 0 24 24"
                          className="h-3.5 w-3.5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          aria-hidden="true"
                        >
                          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
                          <path d="M10 21h4" />
                        </svg>
                        {noteReminderSummary}
                      </p>
                    )}
                    {isCompleted && note.completedAt && (
                      <p className="sticky-note-chip inline-flex items-center gap-1.5 rounded-full bg-emerald-50/80 px-2.5 py-1 font-black text-emerald-800">
                        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                          <path d="m5 12 4 4L19 6" />
                        </svg>
                        Wykonano {new Date(note.completedAt).toLocaleString("pl-PL", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                          timeZone: "Europe/Warsaw",
                        })}
                        {note.completedByName ? ` · ${note.completedByName}` : ""}
                      </p>
                    )}
                  </div>
                </div>

                {areCommentsOpen && (
                  <div
                    id={`sticky-note-comments-${note.id}`}
                    role="dialog"
                    aria-label={`Komentarze do notatki: ${note.content}`}
                    className="absolute inset-x-3 top-14 z-40 rounded-2xl border border-slate-200 bg-white p-3 text-slate-900 shadow-2xl sm:left-auto sm:right-3 sm:w-80 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-2 dark:border-slate-700">
                      <div>
                        <p className="text-sm font-black">Komentarze</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {noteComments.length === 1 ? "1 komentarz" : `${noteComments.length} komentarzy`}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleComments(note.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200 hover:text-slate-900 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
                        aria-label="Zamknij komentarze"
                      >
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                          <path d="m7 7 10 10M17 7 7 17" />
                        </svg>
                      </button>
                    </div>

                    <div className="mt-3 max-h-48 space-y-2 overflow-y-auto pr-1">
                      {noteComments.length > 0 ? (
                        noteComments.map((comment) => (
                          <div key={comment.id} className="rounded-xl bg-slate-100 px-3 py-2 dark:bg-slate-800">
                            <div className="flex items-start justify-between gap-2 text-[10px]">
                              <span className="min-w-0 truncate font-black text-slate-700 dark:text-slate-200">
                                {comment.authorName}
                              </span>
                              <span className="shrink-0 text-slate-500 dark:text-slate-400">
                                {new Date(comment.createdAt).toLocaleString("pl-PL", {
                                  day: "2-digit",
                                  month: "short",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  timeZone: "Europe/Warsaw",
                                })}
                              </span>
                            </div>
                            <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-slate-700 dark:text-slate-200">
                              {renderTextWithMentions(comment.content, recipients)}
                            </p>
                          </div>
                        ))
                      ) : (
                        <p className="rounded-xl bg-slate-50 px-3 py-4 text-center text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                          Brak komentarzy. Dodaj pierwszy.
                        </p>
                      )}
                    </div>

                    <div className="mt-3 block">
                      <span className="sr-only">Nowy komentarz</span>
                      <MentionTextarea
                        value={commentDraft}
                        onChange={(value) => {
                          setCommentDraft(value);
                          setCommentError("");
                        }}
                        allowedRecipients={noteMentionRecipients}
                        mentionedUserIds={commentMentionIds}
                        onMentionedUserIdsChange={setCommentMentionIds}
                        placeholder="Napisz komentarz… Wpisz @, aby wspomnieć"
                        ariaLabel="Nowy komentarz"
                        maxLength={500}
                        rows={3}
                        className="w-full resize-none rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-emerald-500 dark:focus:ring-emerald-950"
                      />
                    </div>
                    {commentError && (
                      <p className="mt-1 text-xs font-bold text-red-600 dark:text-red-400" role="alert">
                        {commentError}
                      </p>
                    )}
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <span className="text-[10px] text-slate-400">{commentDraft.length}/500</span>
                      <button
                        type="button"
                        onClick={() => addComment(note.id)}
                        disabled={savingComment}
                        className="min-h-9 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-black text-white transition hover:bg-emerald-500 disabled:cursor-wait disabled:opacity-60"
                      >
                        {savingComment ? "Dodawanie…" : "Dodaj komentarz"}
                      </button>
                    </div>
                  </div>
                )}
                </article>
              );
            })}
          </div>
        )}
      </div>}

      {isComposerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sticky-note-dialog-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeComposer();
          }}
        >
          <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900 sm:max-w-xl sm:rounded-2xl sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h3 id="sticky-note-dialog-title" className="text-xl font-bold text-slate-900 dark:text-slate-100">
                  Nowa notatka
                </h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Wpisz treść i wybierz odbiorców. Termin jest opcjonalny.</p>
              </div>
              <button
                type="button"
                onClick={closeComposer}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
                aria-label="Zamknij"
              >
                ✕
              </button>
            </div>

            <div className="space-y-5">
              <div className="block">
                <span className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-200">Treść notatki</span>
                <MentionTextarea
                  value={content}
                  onChange={(value) => {
                    setContent(value);
                    setFormError("");
                  }}
                  allowedRecipients={composerMentionRecipients}
                  mentionedUserIds={composerMentionIds}
                  onMentionedUserIdsChange={setComposerMentionIds}
                  placeholder="Np. oddzwonić do klienta w piątek… Wpisz @, aby wspomnieć"
                  maxLength={320}
                  autoFocus
                  className="min-h-32 w-full resize-none rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-base text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-emerald-500 dark:focus:ring-emerald-950"
                />
                <span className="mt-1 block text-right text-xs text-slate-400">{content.length}/320</span>
              </div>

              <div>
                <span className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-200">Ważna do <span className="font-normal text-slate-400">(opcjonalnie)</span></span>
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-700 dark:bg-slate-950/70">
                  <div className="grid grid-cols-2 items-end gap-2 sm:grid-cols-[minmax(0,1fr)_6rem_6rem] sm:gap-3">
                    <label className="col-span-2 min-w-0 sm:col-span-1">
                      <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Data
                      </span>
                      <input
                        type="date"
                        value={selectedExpiryDate}
                        onChange={(event) => {
                          const nextExpiresAt = combineDateAndTime(
                            event.target.value,
                            `${selectedExpiryHour}:${selectedExpiryMinute}`
                          );
                          setExpiresAt(nextExpiresAt);
                          if (!nextExpiresAt && reminderMode === "relative") {
                            setReminderMode("scheduled");
                          }
                          setFormError("");
                        }}
                        required
                        className="h-11 w-full cursor-pointer rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition hover:border-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-200/70 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:border-slate-500 dark:focus:border-slate-500 dark:focus:ring-slate-700/50"
                      />
                    </label>
                    <label>
                      <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Godzina
                      </span>
                      <select
                        value={selectedExpiryHour}
                        onChange={(event) => {
                          setExpiresAt(
                            combineDateAndTime(selectedExpiryDate, `${event.target.value}:${selectedExpiryMinute}`)
                          );
                          setFormError("");
                        }}
                        className="h-11 w-full cursor-pointer rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition hover:border-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-200/70 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:border-slate-500 dark:focus:border-slate-500 dark:focus:ring-slate-700/50"
                      >
                        {hourOptions.map((hour) => <option key={hour} value={hour}>{hour}</option>)}
                      </select>
                    </label>
                    <label>
                      <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Minuty
                      </span>
                      <select
                        value={selectedExpiryMinute}
                        onChange={(event) => {
                          setExpiresAt(
                            combineDateAndTime(selectedExpiryDate, `${selectedExpiryHour}:${event.target.value}`)
                          );
                          setFormError("");
                        }}
                        className="h-11 w-full cursor-pointer rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition hover:border-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-200/70 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:border-slate-500 dark:focus:border-slate-500 dark:focus:ring-slate-700/50"
                      >
                        {minuteOptions.map((minute) => <option key={minute} value={minute}>{minute}</option>)}
                      </select>
                    </label>
                  </div>
                </div>
                <span className="mt-1.5 block text-xs text-slate-500 dark:text-slate-400">
                  Bez wybranego terminu notatka pozostanie bezterminowa. Po przekroczeniu ustawionego terminu pojawi się czerwony wykrzyknik.
                </span>
              </div>

              <fieldset>
                <legend className="mb-2 text-sm font-bold text-slate-700 dark:text-slate-200">Kto ma ją widzieć?</legend>
                <div className={`grid gap-2 ${isOwnerOrAdmin ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}>
                  {(isOwnerOrAdmin
                    ? [
                        { value: "private" as const, title: "Prywatna", description: "Tylko autor" },
                        { value: "management" as const, title: "Zarządu", description: "Tylko zarząd" },
                        { value: "public" as const, title: "Publiczna", description: "Każdy użytkownik" },
                        { value: "shared" as const, title: "Udostępniona", description: "Zarząd + wskazane osoby" },
                        { value: "user" as const, title: "Wybrane osoby", description: "Tylko wskazani użytkownicy" },
                      ]
                    : [
                        { value: "private" as const, title: "Prywatna", description: "Tylko autor" },
                        { value: "management" as const, title: "Zarządu", description: "Tylko zarząd" },
                        { value: "user" as const, title: "Wybrane osoby", description: "Tylko wskazani użytkownicy" },
                      ]
                  ).map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setVisibility(option.value);
                        setSelectedRecipientIds([]);
                        setComposerMentionIds([]);
                        setFormError("");
                      }}
                      className={`min-h-16 rounded-xl border px-3 py-2.5 text-left transition ${
                        visibility === option.value
                          ? "border-emerald-400 bg-emerald-50 ring-2 ring-emerald-100 dark:border-emerald-400 dark:bg-emerald-950/50 dark:ring-emerald-900"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:hover:border-slate-600 dark:hover:bg-slate-800"
                      }`}
                      aria-pressed={visibility === option.value}
                    >
                      <span className="block text-sm font-bold text-slate-900 dark:text-slate-100">{option.title}</span>
                      <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{option.description}</span>
                    </button>
                  ))}
                </div>
              </fieldset>

              {(visibility === "shared" || visibility === "user") && (
                <fieldset>
                  <legend className="mb-2 text-sm font-bold text-slate-700 dark:text-slate-200">
                    {visibility === "shared" ? "Wskaż osoby" : "Wybierz użytkowników"}
                  </legend>
                  <div className="max-h-52 space-y-1 overflow-y-auto rounded-xl border border-slate-300 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-950">
                    {recipientsLoading && (
                      <p className="px-3 py-4 text-sm text-slate-500">Ładowanie listy...</p>
                    )}
                    {!recipientsLoading && recipientsForSelection.map((profile) => {
                      const isChecked = selectedRecipientIds.includes(profile.id);

                      return (
                        <label
                          key={profile.id}
                          className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg bg-white px-3 py-2 text-sm hover:bg-emerald-50 dark:bg-slate-900 dark:hover:bg-emerald-950/50"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              setSelectedRecipientIds((currentIds) => {
                                return isChecked
                                  ? currentIds.filter((id) => id !== profile.id)
                                  : [...currentIds, profile.id];
                              });
                              setFormError("");
                            }}
                            className="h-5 w-5 shrink-0 border-slate-300 text-emerald-600"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-bold text-slate-900 dark:text-slate-100">{getRecipientName(profile)}</span>
                            <span className="block text-xs text-slate-500 dark:text-slate-400">
                              {profile.role ? roleLabels[profile.role] : "Użytkownik CRM"}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  {!recipientsLoading && recipientsForSelection.length === 0 && (
                    <span className="mt-2 block text-xs text-amber-700">
                      Lista użytkowników nie jest dostępna w tym podglądzie.
                    </span>
                  )}
                  {visibility === "shared" && selectedRecipientIds.length > 0 && (
                    <span className="mt-2 block text-xs font-semibold text-emerald-700">
                      Wybrano: {selectedRecipientIds.length}
                    </span>
                  )}
                </fieldset>
              )}

              <fieldset className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950/70">
                <legend className="sr-only">Ustawienia przypomnienia</legend>
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={reminderEnabled}
                    onChange={(event) => {
                      const isEnabled = event.target.checked;
                      setReminderEnabled(isEnabled);
                      if (isEnabled && !expiresAt && reminderMode === "relative") {
                        setReminderMode("scheduled");
                      }
                      setFormError("");
                    }}
                    className="mt-0.5 h-5 w-5 shrink-0 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>
                    <span className="block text-sm font-bold text-slate-900 dark:text-slate-100">Przypomnij</span>
                    <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
                      Jednorazowo lub cyklicznie w CRM i Teams.
                    </span>
                  </span>
                </label>

                {reminderEnabled && (
                  <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-700">
                    <div className="grid gap-2 sm:grid-cols-3">
                      {reminderModeOptions
                        .filter((option) => option.value !== "relative" || Boolean(expiresAt))
                        .map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => {
                              setReminderMode(option.value);
                              setFormError("");
                            }}
                            className={`min-h-16 rounded-xl border px-3 py-2.5 text-left transition ${
                              reminderMode === option.value
                                ? "border-emerald-400 bg-emerald-50 ring-2 ring-emerald-100 dark:bg-emerald-950/50 dark:ring-emerald-900"
                                : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600"
                            }`}
                            aria-pressed={reminderMode === option.value}
                          >
                            <span className="block text-sm font-bold text-slate-900 dark:text-slate-100">
                              {option.title}
                            </span>
                            <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
                              {option.description}
                            </span>
                          </button>
                        ))}
                    </div>

                    {reminderMode === "relative" ? (
                      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                        <span>Przypomnij</span>
                        <label>
                          <span className="sr-only">Ile czasu wcześniej</span>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            inputMode="numeric"
                            value={reminderAmount}
                            onChange={(event) => {
                              setReminderAmount(event.target.value);
                              setFormError("");
                            }}
                            className="h-11 w-20 rounded-xl border border-slate-300 bg-white px-3 text-base font-bold text-slate-900 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-emerald-950"
                          />
                        </label>
                        <label>
                          <span className="sr-only">Jednostka czasu</span>
                          <select
                            value={reminderUnit}
                            onChange={(event) => {
                              setReminderUnit(event.target.value as ReminderUnit);
                              setFormError("");
                            }}
                            className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-base font-semibold text-slate-900 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-emerald-950"
                          >
                            {reminderUnitOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <span>wcześniej</span>
                      </div>
                    ) : (
                      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                        {reminderMode === "recurring" && (
                          <div className="mb-4 flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                            <span>Powtarzaj co</span>
                            <label>
                              <span className="sr-only">Odstęp między przypomnieniami</span>
                              <input
                                type="number"
                                min="1"
                                step="1"
                                inputMode="numeric"
                                value={reminderAmount}
                                onChange={(event) => {
                                  setReminderAmount(event.target.value);
                                  setFormError("");
                                }}
                                className="h-11 w-20 rounded-xl border border-slate-300 bg-white px-3 text-base font-bold text-slate-900 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-emerald-950"
                              />
                            </label>
                            <label>
                              <span className="sr-only">Jednostka cyklu</span>
                              <select
                                value={reminderUnit}
                                onChange={(event) => {
                                  setReminderUnit(event.target.value as ReminderUnit);
                                  setFormError("");
                                }}
                                className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-base font-semibold text-slate-900 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-emerald-950"
                              >
                                {reminderUnitOptions.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                          </div>
                        )}

                        <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                          {reminderMode === "recurring" ? "Pierwsze przypomnienie" : "Termin przypomnienia"}
                        </span>
                        <div className="grid grid-cols-2 items-end gap-2 sm:grid-cols-[minmax(0,1fr)_6rem_6rem] sm:gap-3">
                          <label className="col-span-2 min-w-0 sm:col-span-1">
                            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Data</span>
                            <input
                              type="date"
                              value={selectedReminderDate}
                              onChange={(event) => {
                                setReminderStartsAt(
                                  combineDateAndTime(event.target.value, `${selectedReminderHour}:${selectedReminderMinute}`)
                                );
                                setFormError("");
                              }}
                              className="h-11 w-full cursor-pointer rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-emerald-950"
                            />
                          </label>
                          <label>
                            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Godzina</span>
                            <select
                              value={selectedReminderHour}
                              onChange={(event) => {
                                setReminderStartsAt(
                                  combineDateAndTime(selectedReminderDate, `${event.target.value}:${selectedReminderMinute}`)
                                );
                                setFormError("");
                              }}
                              className="h-11 w-full cursor-pointer rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-emerald-950"
                            >
                              {hourOptions.map((hour) => <option key={hour} value={hour}>{hour}</option>)}
                            </select>
                          </label>
                          <label>
                            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Minuty</span>
                            <select
                              value={selectedReminderMinute}
                              onChange={(event) => {
                                setReminderStartsAt(
                                  combineDateAndTime(selectedReminderDate, `${selectedReminderHour}:${event.target.value}`)
                                );
                                setFormError("");
                              }}
                              className="h-11 w-full cursor-pointer rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-emerald-950"
                            >
                              {minuteOptions.map((minute) => <option key={minute} value={minute}>{minute}</option>)}
                            </select>
                          </label>
                        </div>
                        {reminderMode === "recurring" && (
                          <p className="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                            {expiresAt
                              ? "Cykl zakończy się po terminie ważności notatki."
                              : "Przy notatce bezterminowej cykl trwa do jej usunięcia."}
                          </p>
                        )}
                      </div>
                    )}

                    {reminderDatePreview && (
                      <p className="mt-3 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                        {reminderMode === "recurring"
                          ? "Pierwsze powiadomienie"
                          : "Planowany termin powiadomienia"}: {reminderDatePreview}
                      </p>
                    )}

                    <p className="mt-3 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5 text-xs leading-relaxed text-blue-800 dark:border-blue-900 dark:bg-blue-950/60 dark:text-blue-200">
                      {reminderAudienceDescription}
                    </p>
                  </div>
                )}
              </fieldset>

              {formError && (
                <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:border-red-900 dark:bg-red-950/60 dark:text-red-200" aria-live="polite">
                  {formError}
                </p>
              )}
            </div>

            <div className="mt-6 flex flex-col-reverse gap-2 border-t border-slate-200 pt-5 dark:border-slate-700 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeComposer}
                className="min-h-12 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
              >
                Anuluj
              </button>
              <button
                type="button"
                onClick={addNote}
                disabled={savingNote}
                className="min-h-12 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-emerald-400 disabled:cursor-wait disabled:opacity-60"
              >
                {savingNote ? "Dodawanie…" : "Dodaj na tablicę"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
