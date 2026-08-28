import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  buildTeamsStickyNoteCommentMessage,
  buildTeamsStickyNoteCreatedMessage,
  buildTeamsStickyNoteReminderMessage,
  sendTeamsStickyDirectNotification,
  sendTeamsStickyGeneralNotification,
  sendTeamsStickyManagementNotification,
} from "@/lib/microsoftTeams";

export type StickyUserRole = "admin" | "owner" | "manager" | "seller" | "cc";
export type StickyVisibility = "private" | "management" | "public" | "shared" | "user";

export type StickyProfile = {
  id: string;
  display_name: string | null;
  email: string | null;
  role: StickyUserRole | null;
  is_active: boolean | null;
  sticky_note_color?: string | null;
};

export type StickyNoteRow = {
  id: string;
  content: string;
  author_id: string;
  author_name: string;
  color: string;
  visibility: StickyVisibility;
  recipient_ids: string[];
  expires_at: string | null;
  reminder_enabled: boolean;
  reminder_mode: string | null;
  reminder_amount: number | null;
  reminder_unit: string | null;
  reminder_at: string | null;
  next_reminder_at?: string | null;
  reminder_last_sent_at?: string | null;
  reminder_claimed_at?: string | null;
  reminder_error?: string | null;
  reminder_occurrence_count?: number;
  completed_at: string | null;
  completed_by_id: string | null;
  completed_by_name: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type StickyCommentRow = {
  id: string;
  note_id: string;
  author_id: string;
  author_name: string;
  content: string;
  created_at: string;
};

export class StickyNotesRequestError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "StickyNotesRequestError";
    this.status = status;
  }
}

function requireServerEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Brakuje zmiennej środowiskowej: ${name}`);
  return value;
}

export function getStickyNotesAdminClient() {
  return createClient(
    requireServerEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireServerEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

export async function authenticateStickyNotesRequest(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const accessToken = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";

  if (!accessToken) throw new StickyNotesRequestError("Brak aktywnej sesji CRM.", 401);

  const authClient = createClient(
    requireServerEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireServerEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const { data, error } = await authClient.auth.getUser(accessToken);

  if (error || !data.user) {
    throw new StickyNotesRequestError("Sesja CRM wygasła. Zaloguj się ponownie.", 401);
  }

  const admin = getStickyNotesAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, display_name, email, role, is_active, sticky_note_color")
    .eq("id", data.user.id)
    .maybeSingle();

  if (profileError || !profile || profile.is_active === false) {
    throw new StickyNotesRequestError("Brak aktywnego profilu CRM.", 403);
  }

  return { admin, user: data.user, profile: profile as StickyProfile };
}

export function canViewStickyNote(
  note: StickyNoteRow,
  userId: string,
  role: StickyUserRole | null
) {
  if (note.author_id === userId) return true;
  if (role === "admin") return note.visibility !== "private";
  if (note.visibility === "public") return true;
  if (note.recipient_ids.includes(userId)) return true;
  return role === "owner" && ["management", "shared"].includes(note.visibility);
}

export function canCompleteStickyNote(
  note: StickyNoteRow,
  userId: string,
  role: StickyUserRole | null
) {
  if (role === "admin" || note.author_id === userId) return true;
  if (note.recipient_ids.includes(userId)) return true;
  return role === "owner" && ["management", "shared"].includes(note.visibility);
}

export function validateStickyVisibility(
  visibility: StickyVisibility,
  role: StickyUserRole | null,
  recipientIds: string[]
) {
  const privileged = role === "admin" || role === "owner";
  const allowed = privileged
    ? ["private", "management", "public", "shared", "user"]
    : ["private", "management", "user"];

  if (!allowed.includes(visibility)) {
    throw new StickyNotesRequestError("Nie masz uprawnień do wybranego rodzaju widoczności.", 403);
  }

  if (["shared", "user"].includes(visibility) && recipientIds.length === 0) {
    throw new StickyNotesRequestError("Wybierz co najmniej jednego odbiorcę notatki.");
  }

  if (!["shared", "user"].includes(visibility) && recipientIds.length > 0) {
    throw new StickyNotesRequestError("Ten rodzaj widoczności nie przyjmuje odbiorców.");
  }
}

export async function loadActiveStickyProfiles(admin: SupabaseClient) {
  const { data, error } = await admin
    .from("profiles")
    .select("id, display_name, email, role, is_active, sticky_note_color")
    .neq("is_active", false)
    .order("display_name", { ascending: true });

  if (error) throw error;
  return (data || []) as StickyProfile[];
}

export function getStickyViewerIds(note: StickyNoteRow, profiles: StickyProfile[]) {
  const viewerIds = new Set<string>([note.author_id]);

  if (note.visibility === "public") {
    profiles.forEach((profile) => viewerIds.add(profile.id));
  }

  if (note.visibility === "management" || note.visibility === "shared") {
    profiles
      .filter((profile) => profile.role === "owner")
      .forEach((profile) => viewerIds.add(profile.id));
  }

  note.recipient_ids.forEach((recipientId) => viewerIds.add(recipientId));
  return viewerIds;
}

export function hydrateStickyNote(
  note: StickyNoteRow,
  comments: StickyCommentRow[],
  profiles: StickyProfile[]
) {
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));

  return {
    id: note.id,
    content: note.content,
    color: note.color,
    authorId: note.author_id,
    visibility: note.visibility,
    recipientIds: note.recipient_ids,
    recipientNames: note.recipient_ids.map((recipientId) => {
      const profile = profileById.get(recipientId);
      return profile?.display_name?.trim() || profile?.email?.trim() || "Użytkownik CRM";
    }),
    authorName: note.author_name,
    createdAt: note.created_at,
    expiresAt: note.expires_at,
    reminderEnabled: note.reminder_enabled,
    reminderMode: note.reminder_mode,
    reminderAmount: note.reminder_amount,
    reminderUnit: note.reminder_unit,
    reminderAt: note.reminder_at,
    completedAt: note.completed_at,
    completedById: note.completed_by_id,
    completedByName: note.completed_by_name,
    comments: comments
      .filter((comment) => comment.note_id === note.id)
      .map((comment) => ({
        id: comment.id,
        authorId: comment.author_id,
        authorName: comment.author_name,
        content: comment.content,
        createdAt: comment.created_at,
      })),
  };
}

function getStickyNoteUrl(noteId: string, showComments = false) {
  const configuredUrl =
    process.env.NEXT_PUBLIC_CRM_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    "https://crm.ideasol.pl";
  const url = new URL(configuredUrl);
  url.pathname = "/";
  url.search = "";
  url.searchParams.set("stickyNote", noteId);
  if (showComments) url.searchParams.set("comments", "1");
  return url.toString();
}

async function insertCrmNotifications(params: {
  admin: SupabaseClient;
  note: StickyNoteRow;
  actorId: string;
  actorName: string;
  viewerIds: Set<string>;
  title: string;
  body: string;
  linkUrl: string;
}) {
  const rows = [...params.viewerIds]
    .filter((userId) => userId !== params.actorId)
    .map((userId) => ({
      user_id: userId,
      title: params.title,
      body: params.body,
      sticky_note_id: params.note.id,
      link_url: params.linkUrl,
      is_read: false,
    }));

  if (rows.length === 0) return;
  const { error } = await params.admin.from("notifications").insert(rows);
  if (error) throw error;
}

async function sendTeamsForStickyEvent(params: {
  note: StickyNoteRow;
  profiles: StickyProfile[];
  actorId: string;
  mentionedUserIds: string[];
  message: string;
  includeAuthorDirect?: boolean;
}) {
  if (process.env.STICKY_NOTES_TEAMS_ENABLED !== "true") {
    console.warn("[sticky-notes] Pominięto powiadomienie Teams", {
      noteId: params.note.id,
      visibility: params.note.visibility,
      reason: "STICKY_NOTES_TEAMS_ENABLED nie ma wartości true",
    });
    return ["Powiadomienia Teams dla tablicy zadań są wyłączone w konfiguracji serwera."];
  }

  const viewerIds = getStickyViewerIds(params.note, params.profiles);
  const directIds = new Set<string>();

  if (params.includeAuthorDirect) directIds.add(params.note.author_id);

  if (params.note.visibility === "user" || params.note.visibility === "shared") {
    params.note.recipient_ids.forEach((recipientId) => directIds.add(recipientId));
  }

  params.mentionedUserIds
    .filter((userId) => viewerIds.has(userId))
    .forEach((userId) => directIds.add(userId));
  directIds.delete(params.actorId);

  const deliveries: Array<{ target: string; promise: Promise<unknown> }> = [];

  if (params.note.visibility === "management" || params.note.visibility === "shared") {
    deliveries.push({
      target: "management-chat",
      promise: sendTeamsStickyManagementNotification(params.message),
    });
  }

  if (params.note.visibility === "public") {
    deliveries.push({
      target: "general-chat",
      promise: sendTeamsStickyGeneralNotification(params.message),
    });
  }

  const profileById = new Map(params.profiles.map((profile) => [profile.id, profile]));
  directIds.forEach((userId) => {
    const email = profileById.get(userId)?.email?.trim();
    if (!email) return;
    deliveries.push({
      target: `direct:${userId}`,
      promise: sendTeamsStickyDirectNotification({ userEmail: email, message: params.message }),
    });
  });

  const settled = await Promise.allSettled(deliveries.map((delivery) => delivery.promise));
  const errors = settled.flatMap((result, index) => {
    if (result.status === "fulfilled") return [];
    const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
    return [`${deliveries[index]?.target || "unknown"}: ${reason}`];
  });

  const deliverySummary = {
    noteId: params.note.id,
    visibility: params.note.visibility,
    deliveryCount: deliveries.length,
    failedCount: errors.length,
  };

  if (errors.length > 0) {
    console.error("[sticky-notes] Błąd wysyłki powiadomienia Teams", deliverySummary, errors);
  } else {
    console.info("[sticky-notes] Wysłano powiadomienie Teams", deliverySummary);
  }

  return errors;
}

export async function notifyStickyReminder(params: {
  admin: SupabaseClient;
  note: StickyNoteRow;
  profiles: StickyProfile[];
}) {
  const linkUrl = getStickyNoteUrl(params.note.id);
  const viewerIds = getStickyViewerIds(params.note, params.profiles);
  const body = `Przypomnienie o notatce użytkownika ${params.note.author_name}: ${params.note.content}`;

  await insertCrmNotifications({
    admin: params.admin,
    note: params.note,
    actorId: "",
    actorName: "IdeaSol CRM",
    viewerIds,
    title: "Przypomnienie z tablicy zadań",
    body,
    linkUrl,
  });

  return sendTeamsForStickyEvent({
    note: params.note,
    profiles: params.profiles,
    actorId: "",
    mentionedUserIds: [],
    message: buildTeamsStickyNoteReminderMessage({
      authorName: params.note.author_name,
      noteContent: params.note.content,
      noteUrl: linkUrl,
    }),
    includeAuthorDirect:
      params.note.visibility === "private" || params.note.visibility === "user",
  });
}

export async function notifyStickyNoteCreated(params: {
  admin: SupabaseClient;
  note: StickyNoteRow;
  profiles: StickyProfile[];
  mentionedUserIds: string[];
}) {
  const linkUrl = getStickyNoteUrl(params.note.id);
  const viewerIds = getStickyViewerIds(params.note, params.profiles);
  const body = `Pojawiła się nowa notatka na tablicy zadań od ${params.note.author_name}.`;
  const message = buildTeamsStickyNoteCreatedMessage({
    authorName: params.note.author_name,
    noteUrl: linkUrl,
  });

  await insertCrmNotifications({
    admin: params.admin,
    note: params.note,
    actorId: params.note.author_id,
    actorName: params.note.author_name,
    viewerIds,
    title: "Nowa notatka na tablicy zadań",
    body,
    linkUrl,
  });

  return sendTeamsForStickyEvent({
    note: params.note,
    profiles: params.profiles,
    actorId: params.note.author_id,
    mentionedUserIds: params.mentionedUserIds,
    message,
  });
}

export async function notifyStickyCommentCreated(params: {
  admin: SupabaseClient;
  note: StickyNoteRow;
  comment: StickyCommentRow;
  profiles: StickyProfile[];
  mentionedUserIds: string[];
}) {
  const linkUrl = getStickyNoteUrl(params.note.id, true);
  const viewerIds = getStickyViewerIds(params.note, params.profiles);
  const body = `${params.comment.author_name} skomentował notatkę użytkownika ${params.note.author_name}: ${params.comment.content}`;
  const message = buildTeamsStickyNoteCommentMessage({
    commenterName: params.comment.author_name,
    noteAuthorName: params.note.author_name,
    commentContent: params.comment.content,
    noteUrl: linkUrl,
  });

  await insertCrmNotifications({
    admin: params.admin,
    note: params.note,
    actorId: params.comment.author_id,
    actorName: params.comment.author_name,
    viewerIds,
    title: "Nowy komentarz na tablicy zadań",
    body,
    linkUrl,
  });

  return sendTeamsForStickyEvent({
    note: params.note,
    profiles: params.profiles,
    actorId: params.comment.author_id,
    mentionedUserIds: params.mentionedUserIds,
    message,
    includeAuthorDirect: params.note.visibility === "user",
  });
}
