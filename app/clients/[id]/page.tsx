"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import ClientContactForm, {
  ContactFormPayload,
} from "../components/ClientContactForm";

type Client = {
  id: string;
  public_id: number | null;
  full_name: string | null;
  company_name: string | null;
  phone: string | null;
  email: string | null;
  province: string | null;
  phone_country_code: string | null;
  pesel: string | null;
  regon: string | null;
  city: string | null;
  address: string | null;
  street: string | null;
  building_number: string | null;
  postal_code: string | null;
  nip: string | null;
  contact_person: string | null;
  contact_phone: string | null;
  client_type: string | null;
  lead_source: string | null;
  status: string | null;
  assigned_user_id: string | null;
  assigned_user?: {
    id: string;
    display_name: string | null;
    email: string | null;
    role: string | null;
  } | null;
  created_at: string;
  created_by: string | null;
  created_by_user?: {
    id: string;
    display_name: string | null;
    email: string | null;
  } | null;
};

type CalendarEvent = {
  id: string;
  public_id: number | null;
  title: string;
  description: string | null;
  event_type: string;
  event_at: string;
  status: string | null;
};


type Sale = {
  id: string;
  public_id: number | null;
  sale_date: string;
  contract_value: number | null;
  status: string;
};

type ClientOffer = {
  id: string;
  offer_public_id: string | null;
  offer_type: string | null;
  status: string | null;
  sale_price_gross: number | null;
  seller_margin: number | null;
  company_margin: number | null;
  pv_power_kw: number | null;
  energy_storage: string | null;
  created_by: string | null;
  created_at: string;
};

type ClientTag = {
  id: string;
  name: string;
  color: string | null;
};

type ClientTagLink = {
  id: string;
  tag_id: string;
};

type ClientActivity = {
  id: string;
  client_id: string;
  activity_type: string;
  contact_type: string | null;
  status: string | null;
  description: string | null;
  follow_up_at: string | null;
  created_by: string | null;
  created_at: string;
  author_name?: string | null;
  author_email?: string | null;
};


type ClientNote = {
  id: string;
  client_id: string;
  content: string;
  created_by: string | null;
  created_at: string;
  author_name?: string | null;
  author_email?: string | null;
};


type UserRole = "owner" | "admin" | "cc" | "seller" | string;



type Profile = {
  id: string;
  display_name: string | null;
  email: string | null;
  role: UserRole | null;
};

type MentionableUser = {
  id: string;
  display_name: string | null;
  email: string | null;
  role: UserRole | null;
};

type ClientEditForm = {
  full_name: string;
  company_name: string;
  phone: string;
  email: string;
  city: string;
  province: string;
  street: string;
  building_number: string;
  postal_code: string;
  pesel: string;
  nip: string;
  regon: string;
  contact_person: string;
  contact_phone: string;
};

const provinces = [
  "Dolnośląskie",
  "Kujawsko-Pomorskie",
  "Lubelskie",
  "Lubuskie",
  "Łódzkie",
  "Małopolskie",
  "Mazowieckie",
  "Opolskie",
  "Podkarpackie",
  "Podlaskie",
  "Pomorskie",
  "Śląskie",
  "Świętokrzyskie",
  "Warmińsko-Mazurskie",
  "Wielkopolskie",
  "Zachodniopomorskie",
];


type ContactChannel = "phone" | "sms" | "email" | "meeting";

const contactChannelLabels: Record<ContactChannel, string> = {
  phone: "Telefon",
  sms: "SMS",
  email: "E-mail",
  meeting: "Spotkanie",
};

const contactChannelStyles: Record<
  string,
  {
    bar: string;
    border: string;
    body: string;
    bodyHover: string;
    shadow: string;
  }
> = {
  phone: {
    bar: "bg-[#C93200] text-white",
    border: "border-[#C93200]/35",
    body: "bg-[#C93200]/8",
    bodyHover: "group-hover:bg-[#C93200]/12",
    shadow: "hover:shadow-[0_10px_22px_rgba(201,50,0,0.12)]",
  },
  sms: {
    bar: "bg-[#910049] text-white",
    border: "border-[#910049]/35",
    body: "bg-[#910049]/8",
    bodyHover: "group-hover:bg-[#910049]/12",
    shadow: "hover:shadow-[0_10px_22px_rgba(145,0,73,0.12)]",
  },
  email: {
    bar: "bg-[#187B96] text-white",
    border: "border-[#187B96]/35",
    body: "bg-[#187B96]/8",
    bodyHover: "group-hover:bg-[#187B96]/12",
    shadow: "hover:shadow-[0_10px_22px_rgba(24,123,150,0.12)]",
  },
  meeting: {
    bar: "bg-[#3A752A] text-white",
    border: "border-[#3A752A]/35",
    body: "bg-[#3A752A]/8",
    bodyHover: "group-hover:bg-[#3A752A]/12",
    shadow: "hover:shadow-[0_10px_22px_rgba(58,117,42,0.12)]",
  },
};

type ActiveTab = "dashboard" | "sales" | "offers" | "meetings";

const tabs: { id: ActiveTab; label: string }[] = [
  { id: "dashboard", label: "Pulpit" },
  { id: "sales", label: "Sprzedaże" },
  { id: "offers", label: "Oferty" },
  { id: "meetings", label: "Spotkania" },
];

export default function ClientPage() {
  const params = useParams<{ id: string }>();
  const clientId = params.id;

  const [client, setClient] = useState<Client | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [offers, setOffers] = useState<ClientOffer[]>([]);
  const [notes, setNotes] = useState<ClientNote[]>([]);
  const [activities, setActivities] = useState<ClientActivity[]>([]);
  const [tags, setTags] = useState<ClientTag[]>([]);
  const [availableTags, setAvailableTags] = useState<ClientTag[]>([]);
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [tagSearch, setTagSearch] = useState("");
  const [savingTag, setSavingTag] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [mentionSearch, setMentionSearch] = useState("");
  const [mentionStartIndex, setMentionStartIndex] = useState<number | null>(null);
  const [showMentionSuggestions, setShowMentionSuggestions] = useState(false);
  const noteTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  // removed phoneStatus, contactChannel, activityDescription, followUpAt
  const [savingActivity, setSavingActivity] = useState(false);
  const [showAllActivities, setShowAllActivities] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>("dashboard");
  const [currentUserRole, setCurrentUserRole] = useState<UserRole | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [assignableUsers, setAssignableUsers] = useState<Profile[]>([]);
  const [meetingAdvisors, setMeetingAdvisors] = useState<Profile[]>([]);
  const [mentionableUsers, setMentionableUsers] = useState<MentionableUser[]>([]);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [savingAssignment, setSavingAssignment] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [savingClientEdit, setSavingClientEdit] = useState(false);
  const [clientEditForm, setClientEditForm] = useState<ClientEditForm>({
    full_name: "",
    company_name: "",
    phone: "",
    email: "",
    city: "",
    province: "",
    street: "",
    building_number: "",
    postal_code: "",
    pesel: "",
    nip: "",
    regon: "",
    contact_person: "",
    contact_phone: "",
  });

  useEffect(() => {
    loadClientCard();
    loadAssignmentData();
    loadMeetingAdvisors();
    loadMentionableUsers();
  }, [clientId]);

  async function loadClientCard() {
    setLoading(true);
    setAccessDenied(false);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setAccessDenied(true);
      setLoading(false);
      return;
    }

    setCurrentUserId(user.id);

    const { data: profileData } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    const role = (profileData?.role || "seller") as UserRole;
    setCurrentUserRole(role);

    const normalizedRole = String(role || "seller").toLowerCase();
    const canViewAllClients = ["owner", "admin", "cc"].includes(normalizedRole);
    let allowedAssignedUserIds: string[] | null = null;

    if (!canViewAllClients) {
      if (normalizedRole === "manager") {
        const { data: teamMembers, error: teamError } = await supabase
          .from("profiles")
          .select("id")
          .eq("manager_id", user.id);

        if (teamError) {
          console.error("Błąd ładowania zespołu managera przy dostępie do klienta:", teamError);
        }

        allowedAssignedUserIds = [
          user.id,
          ...((teamMembers || []).map((member: { id: string }) => member.id)),
        ];
      } else {
        allowedAssignedUserIds = [user.id];
      }
    }

    let clientQuery = supabase
      .from("clients")
      .select("id, public_id, full_name, company_name, phone, email, province, phone_country_code, pesel, regon, city, address, street, building_number, postal_code, nip, contact_person, contact_phone, client_type, lead_source, status, assigned_user_id, assigned_user:profiles!clients_assigned_user_id_fkey(id, display_name, email, role), created_at, created_by")
      .eq("id", clientId);

    if (!canViewAllClients) {
      if (!allowedAssignedUserIds || allowedAssignedUserIds.length === 0) {
        clientQuery = clientQuery.eq("assigned_user_id", "__no_user__");
      } else {
        clientQuery = clientQuery.in("assigned_user_id", allowedAssignedUserIds);
      }
    }

    const { data: clientData, error: clientError } = await clientQuery.maybeSingle();

    if (clientError) {
      console.error("Błąd ładowania klienta:", clientError);
      setLoading(false);
      return;
    }

    if (!clientData) {
      setClient(null);
      setEvents([]);
      setSales([]);
      setOffers([]);
      setNotes([]);
      setActivities([]);
      setAccessDenied(true);
      setLoading(false);
      return;
    }

    let createdByUser: {
      id: string;
      display_name: string | null;
      email: string | null;
    } | null = null;

    if (clientData.created_by) {
      const { data: creatorData, error: creatorError } = await supabase
        .from("profiles")
        .select("id, display_name, email")
        .eq("id", clientData.created_by)
        .maybeSingle();

      if (creatorError) {
        console.error("Błąd ładowania użytkownika, który dodał leada:", creatorError);
      }

      createdByUser = creatorData || null;
    }

    const normalizedClient = {
      ...clientData,
      assigned_user: Array.isArray(clientData.assigned_user)
        ? clientData.assigned_user[0] || null
        : clientData.assigned_user || null,
      created_by_user: createdByUser,
    };

    const canAccessClient =
      canViewAllClients ||
      (!!clientData.assigned_user_id &&
        !!allowedAssignedUserIds?.includes(clientData.assigned_user_id));

    if (!canAccessClient) {
      setClient(null);
      setEvents([]);
      setSales([]);
      setOffers([]);
      setNotes([]);
      setActivities([]);
      setAccessDenied(true);
      setLoading(false);
      return;
    }

    setClient(normalizedClient as Client);

    await loadClientTags();


    const { data: eventsData, error: eventsError } = await supabase
      .from("calendar_events")
      .select("id, public_id, title, description, event_type, event_at, status")
      .eq("client_id", clientId)
      .order("event_at", { ascending: false });

    if (eventsError) {
      console.error("Błąd ładowania wydarzeń klienta:", eventsError);
    }

    setEvents((eventsData as CalendarEvent[]) || []);

    const { data: salesData, error: salesError } = await supabase
      .from("sales")
      .select("id, public_id, sale_date, contract_value, status")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });

    if (salesError) {
      console.error("Błąd ładowania sprzedaży klienta:", salesError);
    }

    setSales((salesData as Sale[]) || []);

    const { data: offersData, error: offersError } = await supabase
      .from("client_offers")
      .select("id, offer_public_id, offer_type, status, sale_price_gross, seller_margin, company_margin, pv_power_kw, energy_storage, created_by, created_at")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });

    if (offersError) {
      console.error("Błąd ładowania ofert klienta:", offersError);
    }

    setOffers((offersData as ClientOffer[]) || []);

    const { data: notesData, error: notesError } = await supabase
      .from("client_notes")
      .select("id, client_id, content, created_by, created_at")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });

    if (notesError) {
      console.error("Błąd ładowania notatek klienta:", notesError);
      setNotes([]);
    } else {
      const authorIds = Array.from(
        new Set((notesData || []).map((note) => note.created_by).filter(Boolean))
      ) as string[];

      let profilesById: Record<
        string,
        { display_name: string | null; email: string | null }
      > = {};

      if (authorIds.length > 0) {
        const { data: noteAuthorsData, error: noteAuthorsError } = await supabase
          .from("profiles")
          .select("id, display_name, email")
          .in("id", authorIds);

        if (noteAuthorsError) {
          console.error("Błąd ładowania autorów notatek:", noteAuthorsError);
        }

        profilesById = Object.fromEntries(
          (noteAuthorsData || []).map((profile) => [profile.id, profile])
        );
      }

      const notesWithAuthors = (notesData || []).map((note) => {
        const author = note.created_by ? profilesById[note.created_by] : null;

        return {
          ...note,
          author_name: author?.display_name || "Nieznany użytkownik",
          author_email: author?.email || null,
        };
      });

      setNotes(notesWithAuthors as ClientNote[]);
    }
    const { data: activitiesData, error: activitiesError } = await supabase
      .from("client_activities")
      .select(
        "id, client_id, activity_type, contact_type, status, description, follow_up_at, created_by, created_at"
      )
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });

    if (activitiesError) {
      console.error("Błąd ładowania historii kontaktów klienta:", activitiesError);
      setActivities([]);
    } else {
      const activityAuthorIds = Array.from(
        new Set((activitiesData || []).map((activity) => activity.created_by).filter(Boolean))
      ) as string[];

      let activityProfilesById: Record<
        string,
        { display_name: string | null; email: string | null }
      > = {};

      if (activityAuthorIds.length > 0) {
        const { data: activityAuthorsData, error: activityAuthorsError } = await supabase
          .from("profiles")
          .select("id, display_name, email")
          .in("id", activityAuthorIds);

        if (activityAuthorsError) {
          console.error("Błąd ładowania autorów historii kontaktów:", activityAuthorsError);
        }

        activityProfilesById = Object.fromEntries(
          (activityAuthorsData || []).map((profile) => [profile.id, profile])
        );
      }

      const activitiesWithAuthors = (activitiesData || []).map((activity) => {
        const author = activity.created_by ? activityProfilesById[activity.created_by] : null;

        return {
          ...activity,
          author_name: author?.display_name || "Nieznany użytkownik",
          author_email: author?.email || null,
        };
      });

      setActivities(activitiesWithAuthors as ClientActivity[]);
    }
    setLoading(false);
  }
  async function loadClientTags() {
    const { data, error } = await supabase.rpc("get_client_tags_for_card", {
      p_client_id: clientId,
    });

    if (error) {
      console.error("Błąd ładowania tagów klienta przez RPC:", error);
      setTags([]);
      return;
    }

    setTags((data || []) as ClientTag[]);
  }

  async function loadAvailableTags() {
    const { data, error } = await supabase
      .from("client_tags")
      .select("id, name, color")
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (error) {
      console.error("Błąd ładowania dostępnych tagów:", error);
      setAvailableTags([]);
      return;
    }

    setAvailableTags((data || []) as ClientTag[]);
  }

  function openTagPicker() {
    setTagSearch("");
    setShowTagPicker(true);
    loadAvailableTags();
  }

  function closeTagPicker() {
    setShowTagPicker(false);
    setTagSearch("");
  }

  function getTagClass(tag: ClientTag) {
    if (tag.color === "red") return "bg-red-100 text-red-800 border-red-200";
    if (tag.color === "amber") return "bg-amber-100 text-amber-900 border-amber-200";
    if (tag.color === "blue") return "bg-blue-100 text-blue-800 border-blue-200";
    if (tag.color === "emerald") return "bg-emerald-100 text-emerald-800 border-emerald-200";
    if (tag.color === "purple") return "bg-purple-100 text-purple-800 border-purple-200";
    return "bg-slate-100 text-slate-700 border-slate-200";
  }

  function getTagStyle(tag: ClientTag): React.CSSProperties | undefined {
    if (!tag.color?.startsWith("#")) return undefined;

    return {
      backgroundColor: `${tag.color}1A`,
      borderColor: `${tag.color}66`,
      color: tag.color,
    };
  }

  async function addTagToClient(tag: ClientTag) {
    if (tags.some((currentTag) => currentTag.id === tag.id)) {
      closeTagPicker();
      return;
    }

    setSavingTag(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase.from("client_tag_links").insert({
      client_id: clientId,
      tag_id: tag.id,
      created_by: user?.id || null,
    });

    if (error) {
      console.error("Błąd dodawania tagu do klienta:", error);
      alert(`Nie udało się dodać tagu: ${error.message}`);
      setSavingTag(false);
      return;
    }

    await loadClientTags();
    setSavingTag(false);
    closeTagPicker();
  }

  async function removeTagFromClient(tag: ClientTag) {
    const confirmed = window.confirm(`Usunąć tag "${tag.name}" z tego klienta?`);

    if (!confirmed) return;

    setSavingTag(true);

    const { error } = await supabase
      .from("client_tag_links")
      .delete()
      .eq("client_id", clientId)
      .eq("tag_id", tag.id);

    if (error) {
      console.error("Błąd usuwania tagu z klienta:", error);
      alert(`Nie udało się usunąć tagu: ${error.message}`);
      setSavingTag(false);
      return;
    }

    await loadClientTags();
    setSavingTag(false);
  }
  async function loadAssignmentData() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;
    setCurrentUserId(user.id);

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("id, display_name, role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("Błąd ładowania profilu:", profileError);
    }

    const role = (profileData?.role || null) as UserRole | null;
    setCurrentUserRole(role);

    if (!["owner", "admin"].includes(role || "")) return;

    const { data: usersData, error: usersError } = await supabase
      .from("profiles")
      .select("id, display_name, role")
      .in("role", ["seller", "manager", "owner", "admin", "cc"])
      .eq("hidden_from_assignment", false)
      .order("display_name", { ascending: true });

    if (usersError) {
      console.error("Błąd ładowania użytkowników do przypisania:", usersError);
      return;
    }

    setAssignableUsers(
      ((usersData || []) as Omit<Profile, "email">[]).map((profile) => ({
        ...profile,
        email: null,
      }))
    );
  }


  async function loadMeetingAdvisors() {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, display_name, email, role")
      .neq("role", "admin")
      .eq("hidden_from_assignment", false)
      .order("display_name", { ascending: true });

    if (error) {
      console.error("Błąd ładowania doradców do formularza kontaktu:", error);
      setMeetingAdvisors([]);
      return;
    }

    setMeetingAdvisors((data || []) as Profile[]);
  }

  async function loadMentionableUsers() {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, display_name, email, role")
      .eq("hidden_from_assignment", false)
      .order("display_name", { ascending: true });

    if (error) {
      console.error("Błąd ładowania użytkowników do wzmianek:", error);
      setMentionableUsers([]);
      return;
    }

    setMentionableUsers((data || []) as MentionableUser[]);
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

  function getMentionDisplayName(user: MentionableUser) {
    return user.display_name || user.email || "Użytkownik";
  }

  function getMentionSuggestionMatches() {
    const normalizedSearch = normalizeMentionText(mentionSearch.replace(/^@/, ""));

    if (!showMentionSuggestions) return [];

    return mentionableUsers
      .filter((mentionableUser) => mentionableUser.id !== currentUserId)
      .filter((mentionableUser) => {
        const displayName = String(mentionableUser.display_name || "").trim();
        const email = String(mentionableUser.email || "").trim();
        const emailName = email.includes("@") ? email.split("@")[0] : email;
        const searchableValue = normalizeMentionText(`${displayName} ${emailName} ${email}`);

        if (!normalizedSearch) return true;

        return searchableValue.includes(normalizedSearch);
      })
      .slice(0, 6);
  }

  function updateNoteDraft(value: string, cursorPosition?: number | null) {
    setNewNote(value);

    const position = cursorPosition ?? value.length;
    const textBeforeCursor = value.slice(0, position);
    const mentionMatch = textBeforeCursor.match(/(^|\s)@([\p{L}0-9._-]{0,40})$/u);

    if (!mentionMatch) {
      setShowMentionSuggestions(false);
      setMentionSearch("");
      setMentionStartIndex(null);
      return;
    }

    const query = mentionMatch[2] || "";
    const atIndex = position - query.length - 1;

    setMentionSearch(query);
    setMentionStartIndex(atIndex);
    setShowMentionSuggestions(true);
  }

  function insertMentionIntoNote(mentionableUser: MentionableUser) {
    if (mentionStartIndex === null) return;

    const displayName = getMentionDisplayName(mentionableUser);
    const mentionText = `@${displayName} `;
    const textarea = noteTextareaRef.current;
    const selectionEnd = textarea?.selectionEnd ?? newNote.length;
    const nextNote = `${newNote.slice(0, mentionStartIndex)}${mentionText}${newNote.slice(selectionEnd)}`;
    const nextCursorPosition = mentionStartIndex + mentionText.length;

    setNewNote(nextNote);
    setShowMentionSuggestions(false);
    setMentionSearch("");
    setMentionStartIndex(null);

    window.requestAnimationFrame(() => {
      noteTextareaRef.current?.focus();
      noteTextareaRef.current?.setSelectionRange(nextCursorPosition, nextCursorPosition);
    });
  }

  function renderNoteContentWithMentions(content: string) {
    if (!content) return null;

    const mentionNames = mentionableUsers
      .map((mentionableUser) => getMentionDisplayName(mentionableUser))
      .filter((name) => name && name !== "Użytkownik")
      .sort((firstName, secondName) => secondName.length - firstName.length);

    if (mentionNames.length === 0) return content;

    const escapedMentionNames = mentionNames.map((name) =>
      name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    );
    const mentionRegex = new RegExp(`@(${escapedMentionNames.join("|")})`, "g");
    const parts = content.split(mentionRegex);

    return parts.map((part, index) => {
      const isMention = mentionNames.includes(part);

      if (!isMention) return <span key={`${part}-${index}`}>{part}</span>;

      return (
        <span
          key={`${part}-${index}`}
          className="rounded-md bg-[#119182]/10 px-1.5 py-0.5 font-bold text-[#0f7f72]"
        >
          @{part}
        </span>
      );
    });
  }

  function findMentionedUsers(noteContent: string, currentAuthorId?: string | null) {
    const normalizedContent = normalizeMentionText(noteContent);

    return mentionableUsers.filter((mentionableUser) => {
      if (!mentionableUser.id || mentionableUser.id === currentAuthorId) return false;

      const displayName = String(mentionableUser.display_name || "").trim();
      const email = String(mentionableUser.email || "").trim();
      const emailName = email.includes("@") ? email.split("@")[0] : email;
      const possibleNames = [displayName, emailName]
        .map((value) => normalizeMentionText(value))
        .filter((value) => value.length >= 3);

      return possibleNames.some((name) => normalizedContent.includes(`@${name}`));
    });
  }

  async function createNoteMentionNotifications(params: {
    noteId: string;
    noteContent: string;
    mentionedByUserId: string;
    mentionedByName: string;
  }) {
    const mentionedUsers = findMentionedUsers(
      params.noteContent,
      params.mentionedByUserId
    );

    if (mentionedUsers.length === 0) return;

    const clientNameForNotification = client?.full_name || client?.company_name || "kliencie";
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      "https://crm.ideasol.pl";
    const noteUrl = `${appUrl.replace(/\/$/, "")}/clients/${clientId}#note-${params.noteId}`;

    for (const mentionedUser of mentionedUsers) {
      const { error: mentionError } = await supabase
        .from("client_note_mentions")
        .upsert(
          {
            client_id: clientId,
            note_id: params.noteId,
            mentioned_user_id: mentionedUser.id,
            mentioned_by_user_id: params.mentionedByUserId,
          },
          {
            onConflict: "note_id,mentioned_user_id",
          }
        );

      if (mentionError) {
        console.error("Błąd zapisu wzmianki w notatce:", mentionError);
      }

      const notificationBody = `Użytkownik ${params.mentionedByName} wspomniał o Tobie w notatce na kliencie ${clientNameForNotification}. Kliknij, aby przejść na kartę klienta.`;

      const { error: notificationError } = await supabase.rpc("create_notification", {
        p_user_id: mentionedUser.id,
        p_title: "Wspomniano o Tobie w notatce",
        p_body: notificationBody,
        p_client_id: clientId,
      });

      if (notificationError) {
        console.error("Błąd tworzenia powiadomienia o wzmiance:", notificationError);
      }

      try {
        const teamsResponse = await fetch("/api/teams/send-notification", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userId: mentionedUser.id,
            userEmail: mentionedUser.email,
            mentionedByName: params.mentionedByName,
            clientName: clientNameForNotification,
            noteUrl,
          }),
        });
 
        if (!teamsResponse.ok) {
          const teamsErrorText = await teamsResponse.text().catch(() => "");
          let teamsErrorBody: unknown = teamsErrorText;

          try {
            teamsErrorBody = teamsErrorText ? JSON.parse(teamsErrorText) : null;
          } catch {
            teamsErrorBody = teamsErrorText;
          }

          console.error("Błąd odpowiedzi endpointu Teams o wzmiance:", {
            status: teamsResponse.status,
            body: teamsErrorBody,
          });
        }
      } catch (teamsError) {
        console.error("Błąd wysyłki powiadomienia Teams o wzmiance:", teamsError);
      }
    }

    window.dispatchEvent(new Event("ideasol-notifications-refresh"));
  }

  function canAssignClient() {
    return ["owner", "admin"].includes(currentUserRole || "");
  }

  function canEditClient() {
    return ["owner", "admin", "cc"].includes(currentUserRole || "");
  }

  function canManageClientTags() {
    return currentUserRole === "admin";
  }

  function getAdvisorName() {
    return client?.assigned_user?.display_name || client?.assigned_user?.email || "Brak";
  }

  function getPhoneHref(phone: string | null, countryCode?: string | null) {
    const cleanPhone = String(phone || "").trim();
    const cleanCountryCode = String(countryCode || "").trim();

    if (!cleanPhone) return "";

    const phoneWithCountryCode = cleanPhone.startsWith("+")
      ? cleanPhone
      : `${cleanCountryCode}${cleanPhone}`;
    const normalizedPhone = phoneWithCountryCode.replace(/[^+\d]/g, "");

    return normalizedPhone ? `tel:${normalizedPhone}` : "";
  }

  function getEmailHref(email: string | null) {
    const cleanEmail = String(email || "").trim();

    return cleanEmail ? `mailto:${cleanEmail}` : "";
  }

  function getLeadCreatorName() {
    return (
      client?.created_by_user?.display_name ||
      client?.created_by_user?.email ||
      "Nieznany użytkownik"
    );
  }

  function getRoleLabel(role: string | null) {
    if (role === "owner") return "Członek Zarządu";
    if (role === "admin") return "Administrator";
    if (role === "manager") return "Manager";
    if (role === "cc") return "Konsultant CC";
    if (role === "seller") return "Doradca Techniczny";

    return role || "Użytkownik";
  }

  function addMinutesToIsoDateTime(value: string, minutes: number) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    date.setMinutes(date.getMinutes() + minutes);
    return date.toISOString();
  }

  async function sendMeetingConfirmationSms(calendarEventId: string) {
    const trimmedCalendarEventId = String(calendarEventId || "").trim();

    if (!trimmedCalendarEventId) return;

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        console.warn("Pominięto SMS potwierdzający spotkanie - brak aktywnej sesji użytkownika.");
        return;
      }

      const response = await fetch("/api/sms/meeting-confirmation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          calendarEventId: trimmedCalendarEventId,
        }),
      });

      const responseText = await response.text().catch(() => "");
      let responseBody: unknown = responseText;

      try {
        responseBody = responseText ? JSON.parse(responseText) : null;
      } catch {
        responseBody = responseText;
      }

      if (!response.ok) {
        console.error("Błąd odpowiedzi endpointu SMS potwierdzenia spotkania:", {
          status: response.status,
          body: responseBody,
        });
        return;
      }

      console.log("SMS potwierdzający spotkanie obsłużony:", responseBody);
    } catch (error) {
      console.error("Nie udało się wywołać SMS potwierdzającego spotkanie:", error);
    }
  }

  async function syncClientMeetingToOutlook(params: {
    calendarEventId: string;
    title: string;
    description: string | null;
    eventAt: string;
    clientName: string;
    location: string;
    phone: string;
    advisorEmail: string | null;
  }) {
    const syncUserEmail = params.advisorEmail;

    await sendMeetingConfirmationSms(params.calendarEventId);

    if (!syncUserEmail) {
      await supabase
        .from("calendar_events")
        .update({
          microsoft_sync_status: "sync_failed",
          microsoft_sync_error: "Brak adresu e-mail przypisanego doradcy.",
        })
        .eq("id", params.calendarEventId);
      return;
    }

    try {
      const appUrl = window.location.origin;
      const response = await fetch("/api/microsoft/outlook/events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userEmail: syncUserEmail,
          assignedUserEmail: syncUserEmail,
          subject: params.title,
          body: "",
          meetingNote: params.description || "",
          clientName: params.clientName,
          clientPhone: params.phone,
          clientAddress: params.location,
          crmUrl: `${appUrl}/event/${params.calendarEventId}`,
          location: params.location,
          startDateTime: new Date(params.eventAt).toISOString(),
          endDateTime: addMinutesToIsoDateTime(params.eventAt, 60),
          timeZone: "Europe/Warsaw",
          reminderMinutesBeforeStart: 10,
        }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || "Nie udało się utworzyć wydarzenia Outlook.");
      }

      console.log("Outlook event utworzony dla spotkania z karty klienta:", {
        calendarEventId: params.calendarEventId,
        microsoftEventId: result.microsoftEventId || result.eventId || null,
      });
    } catch (error) {
      console.error("Nie udało się zsynchronizować spotkania klienta z Outlook:", error);

      console.warn("Pominięto zapis błędu synchronizacji Outlook w calendar_events:", {
        calendarEventId: params.calendarEventId,
        error: error instanceof Error ? error.message : "Nieznany błąd synchronizacji Outlook.",
      });
    }
  }

  function canSeeFullOfferFinancials() {
    return ["owner", "admin"].includes(currentUserRole || "");
  }

  function getOfferTypeLabel(offerType: string | null) {
    if (offerType === "pv") return "Fotowoltaika";
    if (offerType === "storage") return "Magazyn energii";
    if (offerType === "pv_storage") return "PV + magazyn energii";
    return offerType || "Oferta";
  }

  function openAssignModal() {
    setSelectedUserId(client?.assigned_user_id || "");
    setShowAssignModal(true);
  }

  function closeAssignModal() {
    setShowAssignModal(false);
    setSelectedUserId("");
  }

  function openEditModal() {
    if (!client) return;

    setClientEditForm({
      full_name: client.full_name || "",
      company_name: client.company_name || "",
      phone: client.phone || "",
      email: client.email || "",
      city: client.city || "",
      province: client.province || "",
      street: client.street || "",
      building_number: client.building_number || "",
      postal_code: client.postal_code || "",
      pesel: client.pesel || "",
      nip: client.nip || "",
      regon: client.regon || "",
      contact_person: client.contact_person || "",
      contact_phone: client.contact_phone || "",
    });

    setShowEditModal(true);
  }

  function closeEditModal() {
    setShowEditModal(false);
  }

  async function saveClientEdit() {
    if (!client) return;

    const isEditedB2B = clientType === "B2B";

    if (!isEditedB2B && !clientEditForm.full_name.trim()) {
      alert("Uzupełnij imię i nazwisko klienta.");
      return;
    }

    if (isEditedB2B && !clientEditForm.company_name.trim()) {
      alert("Uzupełnij nazwę firmy.");
      return;
    }

    setSavingClientEdit(true);

    const payload = {
      full_name: isEditedB2B ? null : clientEditForm.full_name.trim() || null,
      company_name: isEditedB2B ? clientEditForm.company_name.trim() || null : null,
      phone: clientEditForm.phone.trim() || null,
      email: clientEditForm.email.trim() || null,
      city: clientEditForm.city.trim() || null,
      province: clientEditForm.province || null,
      street: clientEditForm.street.trim() || null,
      building_number: clientEditForm.building_number.trim() || null,
      postal_code: clientEditForm.postal_code.trim() || null,
      pesel: isEditedB2B ? null : clientEditForm.pesel.trim() || null,
      nip: isEditedB2B ? clientEditForm.nip.trim() || null : null,
      regon: isEditedB2B ? clientEditForm.regon.trim() || null : null,
      contact_person: isEditedB2B ? clientEditForm.contact_person.trim() || null : null,
      contact_phone: isEditedB2B ? clientEditForm.contact_phone.trim() || null : null,
    };

    const { error } = await supabase
      .from("clients")
      .update(payload)
      .eq("id", client.id);

    if (error) {
      console.error("Błąd edycji klienta:", error);
      alert(`Nie udało się zapisać zmian: ${error.message}`);
      setSavingClientEdit(false);
      return;
    }

    setClient({
      ...client,
      ...payload,
    });

    setSavingClientEdit(false);
    closeEditModal();
  }

  async function assignClientToUser() {
    if (!client || !selectedUserId) {
      alert("Wybierz użytkownika.");
      return;
    }

    setSavingAssignment(true);

    const { error } = await supabase
      .from("clients")
      .update({
        assigned_user_id: selectedUserId,
        status: "Przypisany",
      })
      .eq("id", client.id);

    if (error) {
      console.error("Błąd przypisywania klienta:", error);
      alert(`Nie udało się przypisać klienta: ${error.message}`);
      setSavingAssignment(false);
      return;
    }

    // Notification creation
    const clientName = client.full_name || client.company_name || "Nowy klient";
    const clientCity = client.city || "Brak miejscowości";

    const { error: notificationError } = await supabase.rpc("create_notification", {
      p_user_id: selectedUserId,
      p_title: "Przypisano Ci nowego klienta",
      p_body: `${clientName}, ${clientCity}`,
      p_client_id: client.id,
    });

    if (notificationError) {
      console.error("Błąd tworzenia powiadomienia z karty klienta:", {
        message: notificationError.message,
        details: notificationError.details,
        hint: notificationError.hint,
        code: notificationError.code,
        selectedUserId,
        clientId: client.id,
      });
    } else {
      window.dispatchEvent(new Event("ideasol-notifications-refresh"));
    }

    const selectedUser = assignableUsers.find((user) => user.id === selectedUserId) || null;

    setClient({
      ...client,
      assigned_user_id: selectedUserId,
      assigned_user: selectedUser,
      status: "Przypisany",
    });
    setSavingAssignment(false);
    closeAssignModal();
  }

  async function addNote() {
    const trimmedNote = newNote.trim();

    if (!trimmedNote) {
      return;
    }

    setSavingNote(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from("client_notes")
      .insert({
        client_id: clientId,
        content: trimmedNote,
        created_by: user?.id || null,
      })
      .select("id, client_id, content, created_by, created_at")
      .single();

    if (error) {
      console.error("Błąd dodawania notatki:", error);
      alert(`Nie udało się dodać notatki: ${error.message}`);
      setSavingNote(false);
      return;
    }

    let authorName = "Nieznany użytkownik";
    let authorEmail: string | null = null;

    if (user?.id) {
      const { data: noteAuthorData, error: noteAuthorError } = await supabase
        .from("profiles")
        .select("display_name, email")
        .eq("id", user.id)
        .maybeSingle();

      if (noteAuthorError) {
        console.error("Błąd ładowania autora dodanej notatki:", noteAuthorError);
      }

      authorName = noteAuthorData?.display_name || "Nieznany użytkownik";
      authorEmail = noteAuthorData?.email || null;
    }

    const createdNote = data as ClientNote;

    setNotes((currentNotes) => [
      {
        ...createdNote,
        author_name: authorName,
        author_email: authorEmail,
      },
      ...currentNotes,
    ]);

    if (user?.id) {
      await createNoteMentionNotifications({
        noteId: createdNote.id,
        noteContent: trimmedNote,
        mentionedByUserId: user.id,
        mentionedByName: authorName,
      });
    }

    setNewNote("");
    setShowMentionSuggestions(false);
    setMentionSearch("");
    setMentionStartIndex(null);
    setSavingNote(false);
  }
  async function addContactActivity(payload: ContactFormPayload) {
    setSavingActivity(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      alert("Nie udało się dodać aktywności: brak zalogowanego użytkownika.");
      setSavingActivity(false);
      return;
    }

    const contactTypeLabels: Record<string, string> = {
      marketing: "Kontakt marketingowy",
      relationship: "Kontakt relacyjny",
      incoming: "Kontakt przychodzący",
    };

    const statusLabels: Record<string, string> = {
      nie_odbiera: "Nie odbiera",
      prosba_o_ponowny_kontakt: "Prośba o ponowny kontakt",
      niezainteresowany: "Niezainteresowany",
      umowione_spotkanie: "Umówione spotkanie",
      pytania_techniczne: "Pytania techniczne",
      reklamacja: "Reklamacja",
      zainteresowanie_oferta: "Zainteresowanie ofertą",
      inne: "Inne",
    };

    const contactType = payload.phoneContactType
      ? contactTypeLabels[payload.phoneContactType]
      : null;

    const status = payload.phoneStatus
      ? statusLabels[payload.phoneStatus] || payload.phoneStatus
      : null;

    const { data: activityData, error: activityError } = await supabase
      .from("client_activities")
      .insert({
        client_id: clientId,
        activity_type: payload.contactMethod,
        contact_type: contactType,
        status,
        description: payload.description || null,
        follow_up_at: payload.reminderAt || null,
        created_by: user.id,
      })
      .select(
        "id, client_id, activity_type, contact_type, status, description, follow_up_at, created_by, created_at"
      )
      .single();

    if (activityError) {
      console.error("Błąd dodawania aktywności:", activityError);
      alert(`Nie udało się dodać aktywności: ${activityError.message}`);
      setSavingActivity(false);
      return;
    }

    let activityAuthorName = "Nieznany użytkownik";
    let activityAuthorEmail: string | null = null;

    const { data: activityAuthorData, error: activityAuthorError } = await supabase
      .from("profiles")
      .select("display_name, email")
      .eq("id", user.id)
      .maybeSingle();

    if (activityAuthorError) {
      console.error("Błąd ładowania autora dodanego kontaktu:", activityAuthorError);
    }

    activityAuthorName = activityAuthorData?.display_name || "Nieznany użytkownik";
    activityAuthorEmail = activityAuthorData?.email || null;

    setActivities((currentActivities) => [
      {
        ...(activityData as ClientActivity),
        author_name: activityAuthorName,
        author_email: activityAuthorEmail,
      },
      ...currentActivities,
    ]);

    if (payload.reminderAt) {
      const { data: reminderData, error: reminderError } = await supabase
        .from("calendar_events")
        .insert({
          client_id: clientId,
          source_activity_id: (activityData as ClientActivity).id,
          title: status ? `Ponowny kontakt: ${status}` : "Ponowny kontakt",
          description: payload.description || null,
          event_type: "reminder",
          event_at: payload.reminderAt,
          status: "planned",
          created_by: user.id,
          assigned_user_id: client?.assigned_user_id || user.id,
        })
        .select("id, public_id, title, description, event_type, event_at, status")
        .single();

      if (reminderError) {
        console.error(
          "Aktywność dodana, ale nie udało się utworzyć przypomnienia:",
          reminderError
        );
        alert(
          `Aktywność dodana, ale nie udało się utworzyć przypomnienia: ${reminderError.message}`
        );
        setSavingActivity(false);
        return;
      }

      setEvents((currentEvents) => [
        reminderData as CalendarEvent,
        ...currentEvents,
      ]);
    }

    if (payload.meetingAt) {
      const { data: meetingData, error: meetingError } = await supabase
        .from("calendar_events")
        .insert({
          client_id: clientId,
          source_activity_id: (activityData as ClientActivity).id,
          title: `Spotkanie: ${client?.full_name || client?.company_name || "Klient"}`,
          description: payload.description || null,
          event_type: "meeting",
          event_at: payload.meetingAt,
          status: "planned",
          created_by: user.id,
          assigned_user_id: payload.assignedUserId || client?.assigned_user_id || user.id,
          microsoft_sync_status: "pending",
        })
        .select("id, public_id, title, description, event_type, event_at, status")
        .single();

      if (meetingError) {
        console.error(
          "Aktywność dodana, ale nie udało się utworzyć spotkania:",
          meetingError
        );
        alert(
          `Aktywność dodana, ale nie udało się utworzyć spotkania: ${meetingError.message}`
        );
        setSavingActivity(false);
        return;
      }

      setEvents((currentEvents) => [
        meetingData as CalendarEvent,
        ...currentEvents,
      ]);

      const assignedAdvisor =
        meetingAdvisors.find((advisor) => advisor.id === payload.assignedUserId) ||
        meetingAdvisors.find((advisor) => advisor.id === client?.assigned_user_id) ||
        client?.assigned_user ||
        null;

      await syncClientMeetingToOutlook({
        calendarEventId: (meetingData as CalendarEvent).id,
        title: `Spotkanie: ${client?.full_name || client?.company_name || "Klient"}`,
        description: payload.description || null,
        eventAt: payload.meetingAt,
        clientName: client?.full_name || client?.company_name || "Klient",
        location: fullAddress,
        phone: client?.phone || "",
        advisorEmail: assignedAdvisor?.email || null,
      });
    }

    setSavingActivity(false);
  }

  if (loading) {
    return (
      <main className="text-slate-900 dark:text-slate-100">
        <p className="text-slate-500">Ładowanie karty klienta...</p>
      </main>
    );
  }

  if (accessDenied) {
    return (
      <main className="text-slate-900 dark:text-slate-100">
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
          Nie masz uprawnień do przeglądania tego profilu.
        </div>

        <Link
          href="/clients"
          className="inline-flex rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
        >
          Wróć do listy klientów
        </Link>
      </main>
    );
  }

  if (!client) {
    return (
      <main className="text-slate-900 dark:text-slate-100">
        <section className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
          <h1 className="text-2xl font-bold text-slate-900">Nie znaleziono klienta</h1>
          <p className="text-slate-500 mt-2 break-all">Szukane ID: {clientId}</p>
        </section>
      </main>
    );
  }

  const visibleLeadId = client.public_id
    ? `LEAD-${String(client.public_id).padStart(6, "0")}`
    : `LEAD-${client.id.slice(0, 8).toUpperCase()}`;

  const clientName = client.full_name || client.company_name || "Brak nazwy klienta";
  const clientType = client.client_type || (client.company_name ? "B2B" : "B2C");
  const structuredAddress = [
    [client.street, client.building_number].filter(Boolean).join(" "),
    [client.postal_code, client.city].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ");

  const fullAddress = client.address || structuredAddress || "Brak adresu";
  const isB2B = clientType === "B2B";
  const meetings = events.filter((event) => event.event_type === "meeting");
  const reminders = events.filter((event) => event.event_type === "reminder");
  const visibleActivities = activities;
  const lastContactAt = activities.length > 0 ? activities[0].created_at : null;

  function isReminderDone(status: string | null) {
    return status === "done" || status?.startsWith("Zakończone");
  }

  function getReminderStatusLabel(status: string | null) {
    if (!status) return "Do wykonania";
    if (status === "planned") return "Do wykonania";
    if (status === "done") return "Zakończone";
    return status;
  }

  function getReminderVisualState(event: CalendarEvent) {
    const isDone = isReminderDone(event.status);
    const isOverdue =
      !isDone && new Date(event.event_at).getTime() < Date.now();

    if (isDone) {
      return {
        cardClass: "border-slate-200 bg-slate-100 hover:bg-slate-200",
        titleClass: "text-slate-800",
        textClass: "text-slate-600",
        dateClass: "text-slate-600",
        badgeClass: "bg-slate-200 text-slate-700 border-slate-300",
        label: getReminderStatusLabel(event.status),
      };
    }

    if (isOverdue) {
      return {
        cardClass: "border-red-300 bg-red-50 hover:bg-red-100",
        titleClass: "text-red-950",
        textClass: "text-red-800",
        dateClass: "text-red-900",
        badgeClass: "bg-red-100 text-red-900 border-red-200",
        label: `Zaległe - ${getReminderStatusLabel(event.status)}`,
      };
    }

    return {
      cardClass: "border-blue-200 bg-blue-50 hover:bg-blue-100",
      titleClass: "text-blue-950",
      textClass: "text-blue-800",
      dateClass: "text-blue-900",
      badgeClass: "bg-blue-100 text-blue-900 border-blue-200",
      label: getReminderStatusLabel(event.status),
    };
  }

  return (
    <main className="text-slate-900 dark:text-slate-100">
      <div className="space-y-6">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex flex-wrap items-start justify-between gap-4 bg-[#C7EAF0] px-6 py-6 dark:bg-slate-900">
            <div>
              <div className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                <p className="text-sm font-semibold text-slate-600">{visibleLeadId}</p>
                <p className="text-[11px] font-medium text-slate-500">
                  Dodano: {new Date(client.created_at).toLocaleString("pl-PL")}
                </p>
              </div>


              <h1 className="text-3xl font-bold text-slate-900">{clientName}</h1>

              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href={`/calculator?clientId=${client.id}`}
                  className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-blue-500"
                >
                  Przygotuj ofertę
                </Link>
              </div>

              <div className="mt-1 space-y-0.5 text-xs font-medium text-slate-400">
  <p>
    Lead dodany przez: {getLeadCreatorName()} | Opiekun klienta: {getAdvisorName()}
  </p>
  <p>
    Data ostatniego kontaktu: {lastContactAt ? new Date(lastContactAt).toLocaleString("pl-PL") : "Brak kontaktu"}
  </p>
</div>

              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-sm font-semibold">
                  {clientType}
                </span>

                <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-900 text-sm font-semibold">
                  {client.status || "Brak statusu"}
                </span>

                <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-900 text-sm font-semibold">
                  {client.lead_source || "Źródło nieznane"}
                </span>

                {tags.map((tag) =>
                  canManageClientTags() ? (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => removeTagFromClient(tag)}
                      disabled={savingTag}
                      title="Kliknij, aby usunąć tag z klienta"
                      style={getTagStyle(tag)}
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-semibold transition hover:opacity-80 disabled:opacity-50 ${getTagClass(tag)}`}
                    >
                      {tag.name}
                      <span aria-hidden="true">×</span>
                    </button>
                  ) : (
                    <span
                      key={tag.id}
                      style={getTagStyle(tag)}
                      className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-semibold ${getTagClass(tag)}`}
                    >
                      {tag.name}
                    </span>
                  )
                )}

                {canManageClientTags() && (
                  <button
                    type="button"
                    onClick={openTagPicker}
                    disabled={savingTag}
                    className="inline-flex items-center justify-center rounded-full border border-dashed border-slate-300 bg-white px-3 py-1 text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                  >
                    + Tag
                  </button>
                )}
              </div>
            </div>

            <div className="ml-auto flex items-start justify-end">
              <div className="flex items-center gap-2 flex-nowrap">
                {canEditClient() && (
                  <button
                    type="button"
                    onClick={openEditModal}
                    className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-5 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
                  >
                    Edycja danych
                  </button>
                )}

                {canAssignClient() && (
                  <button
                    type="button"
                    onClick={openAssignModal}
                    className="inline-flex h-11 items-center justify-center rounded-xl bg-emerald-500 px-5 text-sm font-bold text-white transition hover:bg-emerald-400"
                  >
                    Przypisz
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="border-t border-slate-200 bg-[#EBF8FA] px-6 py-5 dark:border-slate-700 dark:bg-slate-900">
            <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="space-y-5">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                    Dane adresowe
                  </h3>

                  <div className="mt-2 border-t border-slate-200 pt-3">
                    <p className="text-sm font-semibold text-slate-900">
                      {[client.street, client.building_number].filter(Boolean).join(" ") || "Brak adresu"}
                    </p>
                    <p className="mt-1 text-sm text-slate-700">
                      {[client.postal_code, client.city].filter(Boolean).join(" ") || "Brak miejscowości"}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {client.province || "Brak województwa"}
                    </p>
                  </div>
                </div>

                {!isB2B && (
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                      Dane identyfikacyjne
                    </h3>

                    <div className="mt-2 border-t border-slate-200 pt-3">
                      <div className="flex items-center justify-start gap-3">
                        <span className="text-sm font-semibold text-slate-700">PESEL</span>

                        <details>
                          <summary className="cursor-pointer list-none text-sm font-bold text-[#119182] hover:underline">
                            Pokaż
                          </summary>
                          <p className="mt-2 font-mono text-sm text-slate-900">
                            {client.pesel || "Brak"}
                          </p>
                        </details>
                      </div>
                    </div>
                  </div>
                )}

                {isB2B && (
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                      Dane firmowe
                    </h3>

                    <div className="mt-2 grid gap-3 border-t border-slate-200 pt-3 sm:grid-cols-2">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">NIP</p>
                        <p className="mt-1 font-semibold text-slate-900">{client.nip || "Brak"}</p>
                      </div>

                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">REGON</p>
                        <p className="mt-1 font-semibold text-slate-900">{client.regon || "Brak"}</p>
                      </div>

                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Osoba kontaktowa</p>
                        <p className="mt-1 font-semibold text-slate-900">{client.contact_person || "Brak"}</p>
                      </div>

                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Telefon osoby kontaktowej</p>
                        <p className="mt-1 font-semibold text-slate-900">
                          {client.contact_phone ? (
                            <a
                              href={getPhoneHref(client.contact_phone)}
                              className="text-[#119182] hover:underline"
                            >
                              {client.contact_phone}
                            </a>
                          ) : (
                            "Brak"
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                  Kontakt
                </h3>

                <div className="mt-2 border-t border-slate-200 pt-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Telefon</p>
                    <p className="mt-1 text-lg font-bold text-slate-900">
                      {client.phone ? (
                        <a
                          href={getPhoneHref(client.phone, client.phone_country_code)}
                          className="text-[#119182] hover:underline"
                        >
                          {client.phone}
                        </a>
                      ) : (
                        "Brak"
                      )}
                    </p>
                  </div>

                  <div className="mt-4 border-t border-slate-200 pt-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-400">E-mail</p>
                    <p className="mt-1 break-all text-sm font-semibold text-slate-900">
                      {client.email ? (
                        <a
                          href={getEmailHref(client.email)}
                          className="text-[#119182] hover:underline"
                        >
                          {client.email}
                        </a>
                      ) : (
                        "Brak"
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center gap-3 overflow-x-auto border-b border-slate-200 px-6 py-4 dark:border-slate-700">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-xl font-semibold text-sm whitespace-nowrap ${
                  activeTab === tab.id
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="p-6">
            {activeTab === "dashboard" && (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div className="space-y-8">
                  <ClientContactForm
  onSubmit={addContactActivity}
  isSubmitting={savingActivity}
  advisors={meetingAdvisors}
/>

                  <div>
                    <h3 className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                      HISTORIA KONTAKTÓW
                    </h3>

                    <div className="max-h-[460px] space-y-3 overflow-y-auto px-1 py-2">
                      {activities.length === 0 ? (
                        <div className="border border-dashed border-slate-300 rounded-2xl p-6 text-center">
                          <p className="font-semibold text-slate-900">
                            Brak historii kontaktów.
                          </p>
                        </div>
                      ) : (
                        visibleActivities.map((activity) => {
                          const activityType = activity.activity_type || "phone";
                          const activityLabel =
                            contactChannelLabels[activityType as ContactChannel] || activityType;
                          const activityVisual =
                            contactChannelStyles[activityType] || contactChannelStyles.phone;
                          const contactTypeLabel = activity.contact_type || "Kontakt";

                          return (
                            <div
                              key={activity.id}
                              className={`group overflow-hidden rounded-lg border bg-white shadow-sm transition-all duration-200 hover:-translate-y-px ${activityVisual.border} ${activityVisual.shadow}`}
                            >
                              <div
                                className={`flex flex-col gap-1 border-b px-3 py-1.5 transition-colors duration-200 sm:flex-row sm:items-center sm:justify-between ${activityVisual.bar} ${activityVisual.border}`}
                              >
                                <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                                  <p className="text-[12px] font-bold">
                                    {activity.author_name || "Nieznany użytkownik"}
                                  </p>
                                  <span className="text-[11px] opacity-80">•</span>
                                  <p className="text-[11px] font-semibold opacity-90">
                                    {contactTypeLabel}
                                  </p>
                                  <span className="text-[11px] opacity-80">•</span>
                                  <p className="text-[11px] font-semibold opacity-90">
                                    {activityLabel}
                                  </p>
                                </div>

                                <p className="text-[10px] font-medium opacity-90">
                                  {new Date(activity.created_at).toLocaleString("pl-PL")}
                                </p>
                              </div>

                              <div
                                className={`p-3 text-[13px] leading-6 text-slate-800 whitespace-pre-line transition-colors duration-200 ${activityVisual.body} ${activityVisual.bodyHover}`}
                              >
                                {activity.description || "Brak opisu"}

                                {activity.follow_up_at && (
                                  <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
                                    Ponowny kontakt: {new Date(activity.follow_up_at).toLocaleString("pl-PL")}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}

                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-3">
                    <h3 className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                      PRZYPOMNIENIA
                    </h3>
                    <div className="max-h-[220px] space-y-3 overflow-y-auto px-1 py-2">
                      {reminders.length === 0 ? (
                        <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-500">
                          Brak przypomnień dla tego klienta.
                        </p>
                      ) : (
                        reminders.map((event) => {
                          const reminderVisualState = getReminderVisualState(event);
                          return (
                            <Link
                              key={event.id}
                              href={`/event/${event.id}`}
                              className="group block overflow-hidden rounded-lg border border-blue-200 bg-white shadow-sm transition-all duration-200 hover:-translate-y-px hover:border-blue-400 hover:shadow-[0_10px_22px_rgba(37,99,235,0.10)]"
                            >
                              <div className="flex flex-col gap-1 border-b border-blue-200 bg-blue-100 px-3 py-1.5 text-blue-950 transition-colors duration-200 group-hover:bg-blue-200 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                                  <p className="text-[12px] font-bold">
                                    {event.title}
                                  </p>
                                  <span className="text-[11px] opacity-70">•</span>
                                  <p className="text-[11px] font-semibold opacity-90">
                                    {reminderVisualState.label}
                                  </p>
                                </div>

                                <p className="text-[10px] font-medium opacity-90">
                                  {new Date(event.event_at).toLocaleString("pl-PL")}
                                </p>
                              </div>

                              <div className="bg-blue-50 p-3 text-[13px] leading-6 text-slate-800 transition-colors duration-200 group-hover:bg-blue-100 whitespace-pre-line">
                                {event.description || "Brak opisu"}
                              </div>
                            </Link>
                          );
                        })
                      )}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                      NOTATKI NA KLIENCIE
                    </h3>

                    <div className="relative">
                      <textarea
                        ref={noteTextareaRef}
                        value={newNote}
                        onChange={(event) =>
                          updateNoteDraft(event.target.value, event.target.selectionStart)
                        }
                        onKeyUp={(event) =>
                          updateNoteDraft(event.currentTarget.value, event.currentTarget.selectionStart)
                        }
                        onClick={(event) =>
                          updateNoteDraft(event.currentTarget.value, event.currentTarget.selectionStart)
                        }
                        placeholder="Dodaj nową notatkę... Wpisz @, aby oznaczyć użytkownika"
                        className="min-h-[78px] w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none transition focus:border-[#119182] focus:ring-4 focus:ring-[#119182]/10"
                      />

                      {showMentionSuggestions && getMentionSuggestionMatches().length > 0 && (
                        <div className="absolute left-0 top-full z-20 mt-1 w-72 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                          <div className="border-b border-slate-100 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wide text-slate-400">
                            Oznacz
                          </div>
                          {getMentionSuggestionMatches().map((mentionableUser) => (
                            <button
                              key={mentionableUser.id}
                              type="button"
                              onClick={() => insertMentionIntoNote(mentionableUser)}
                              className="block w-full truncate border-b border-slate-100 px-2.5 py-1.5 text-left text-sm font-bold text-slate-900 transition last:border-b-0 hover:bg-slate-50"
                            >
                              @{getMentionDisplayName(mentionableUser)}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={addNote}
                        disabled={savingNote || !newNote.trim()}
                        className="rounded-lg bg-[#119182] px-3.5 py-1.5 text-xs font-black text-white shadow-sm transition hover:bg-[#0f7f72] disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none"
                      >
                        {savingNote ? "Zapisywanie..." : "Dodaj notatkę"}
                      </button>
                    </div>

                    <div className="mt-6 max-h-[460px] space-y-3 overflow-y-auto px-1 py-2">
                      {notes.length === 0 ? (
                        <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
                          Brak notatek dla tego klienta.
                        </p>
                      ) : (
                        notes.map((note) => (
                          <div
                            id={`note-${note.id}`}
                            key={note.id}
                            className="scroll-mt-32 group overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition-all duration-200 hover:-translate-y-px hover:border-[#119182] hover:shadow-[0_10px_22px_rgba(17,145,130,0.10)] target:border-[#119182] target:ring-4 target:ring-[#119182]/20 dark:border-slate-700 dark:bg-slate-950"
                          >
                            <div className="flex flex-col gap-1 border-b border-[#9EECEF] bg-[#BDF6F9] px-3 py-1.5 transition-colors duration-200 group-hover:border-[#119182]/40 group-hover:bg-[#9FECEF] dark:border-slate-700 dark:bg-slate-800 dark:group-hover:border-slate-600 dark:group-hover:bg-slate-800 sm:flex-row sm:items-center sm:justify-between">
                              <div>
                                <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                                  {note.author_name || "Nieznany użytkownik"}
                                </p>
                              </div>

                              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                                {new Date(note.created_at).toLocaleString("pl-PL")}
                              </p>
                            </div>

                            <div className="whitespace-pre-line bg-slate-100 p-3 text-[13px] leading-6 text-slate-800 transition-colors duration-200 group-hover:bg-slate-200 dark:bg-slate-950 dark:text-slate-100 dark:group-hover:bg-slate-900">
                              {renderNoteContentWithMentions(note.content)}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                </div>
              </div>
            )}

            {activeTab === "meetings" && (
              <div className="space-y-3">
                {meetings.length === 0 ? (
                  <p className="text-sm text-slate-500">Brak spotkań dla tego klienta.</p>
                ) : (
                  meetings.map((event) => (
                    <Link
                      key={event.id}
                      href={`/event/${event.id}`}
                      className="block border border-slate-200 rounded-2xl p-4 hover:bg-slate-50 transition"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="font-bold text-slate-900">{event.title}</p>
                          <p className="text-sm text-slate-500">{event.description || "Brak opisu"}</p>
                        </div>

                        <p className="text-sm font-semibold text-slate-700 whitespace-nowrap">
                          {new Date(event.event_at).toLocaleString("pl-PL")}
                        </p>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            )}

            {activeTab === "sales" && (
              <div className="space-y-3">
                {sales.length === 0 ? (
                  <p className="text-sm text-slate-500">Brak sprzedaży dla tego klienta.</p>
                ) : (
                  sales.map((sale) => (
                    <Link
                      key={sale.id}
                      href={`/sales/${sale.id}`}
                      className="block border border-slate-200 rounded-2xl p-4 hover:bg-slate-50 transition"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="font-bold text-slate-900">
                            {sale.public_id
                              ? `SALE-${String(sale.public_id).padStart(6, "0")}`
                              : `SALE-${sale.id.slice(0, 8).toUpperCase()}`}
                          </p>
                          <p className="text-sm text-slate-500">{sale.status}</p>
                        </div>

                        <p className="text-sm font-semibold text-slate-700 whitespace-nowrap">
                          {sale.contract_value
                            ? `${sale.contract_value.toLocaleString("pl-PL")} zł`
                            : "Brak wartości"}
                        </p>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            )}


            {activeTab === "offers" && (
              <div className="space-y-3">
                {offers.length === 0 ? (
                  <div className="border border-dashed border-slate-300 rounded-2xl p-6 text-center">
                    <p className="font-bold text-slate-900">Brak ofert klienta</p>
                    <p className="text-sm text-slate-500 mt-1">
                      Oferty zapisane z kalkulatora pojawią się tutaj automatycznie.
                    </p>
                  </div>
                ) : (
                  offers.map((offer) => (
                    <Link
                      key={offer.id}
                      href={`/offers/${offer.id}`}
                      className="block border border-slate-200 rounded-2xl p-4 hover:bg-slate-50 transition"
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-bold text-slate-900">
                              {offer.offer_public_id || `O-${offer.id.slice(0, 8).toUpperCase()}`}
                            </p>

                            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-900">
                              {getOfferTypeLabel(offer.offer_type)}
                            </span>

                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                              {offer.status || "draft"}
                            </span>
                          </div>

                          <p className="text-sm text-slate-500 mt-2">
                            Utworzono: {new Date(offer.created_at).toLocaleString("pl-PL")}
                          </p>

                          <p className="text-sm text-slate-500 mt-1">
                            Moc PV: {offer.pv_power_kw ? `${offer.pv_power_kw} kWp` : "brak"}
                            {offer.energy_storage ? ` · Magazyn: ${offer.energy_storage}` : ""}
                          </p>
                        </div>

                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:min-w-[340px]">
                          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                            <p className="text-xs font-semibold uppercase text-slate-400">
                              Cena sprzedaży
                            </p>
                            <p className="mt-1 font-black text-slate-900">
                              {offer.sale_price_gross
                                ? `${offer.sale_price_gross.toLocaleString("pl-PL", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })} zł`
                                : "Brak"}
                            </p>
                          </div>

                          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                            <p className="text-xs font-semibold uppercase text-slate-400">
                              {canSeeFullOfferFinancials() ? "Marża firmy" : "Moja marża"}
                            </p>
                            <p className="mt-1 font-black text-slate-900">
                              {(canSeeFullOfferFinancials()
                                ? offer.company_margin
                                : offer.seller_margin
                              )
                                ? `${(canSeeFullOfferFinancials()
                                    ? offer.company_margin
                                    : offer.seller_margin
                                  )?.toLocaleString("pl-PL", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })} zł`
                                : "Brak"}
                            </p>
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            )}
          </div>
        </section>
      </div>
      {showTagPicker && canManageClientTags() && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-emerald-600">Tagi klienta</p>
                <h2 className="mt-1 text-xl font-bold text-slate-900">
                  Dodaj tag
                </h2>
              </div>

              <button
                type="button"
                onClick={closeTagPicker}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                Zamknij
              </button>
            </div>

            <input
              type="text"
              value={tagSearch}
              onChange={(event) => setTagSearch(event.target.value)}
              placeholder="Szukaj tagu..."
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500"
            />

            <div className="mt-4 max-h-[320px] overflow-y-auto rounded-2xl border border-slate-200 bg-white">
              {availableTags
                .filter((tag) => !tags.some((currentTag) => currentTag.id === tag.id))
                .filter((tag) =>
                  tag.name.toLowerCase().includes(tagSearch.trim().toLowerCase())
                ).length === 0 ? (
                <div className="p-5 text-sm text-slate-500">
                  Brak dostępnych tagów.
                </div>
              ) : (
                availableTags
                  .filter((tag) => !tags.some((currentTag) => currentTag.id === tag.id))
                  .filter((tag) =>
                    tag.name.toLowerCase().includes(tagSearch.trim().toLowerCase())
                  )
                  .map((tag) => (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => addTagToClient(tag)}
                      disabled={savingTag}
                      className="flex w-full items-center justify-between border-b border-slate-100 px-5 py-4 text-left text-sm font-semibold text-slate-800 transition hover:bg-slate-50 disabled:opacity-50"
                    >
                      <span
                        style={getTagStyle(tag)}
                        className={`rounded-full border px-3 py-1 ${getTagClass(tag)}`}
                      >
                        {tag.name}
                      </span>
                      <span className="text-slate-400">Dodaj</span>
                    </button>
                  ))
              )}
            </div>
          </div>
        </div>
      )}
      {showEditModal && client && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6">
          <div className="max-h-[95vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-emerald-600">Karta klienta</p>
                <h2 className="mt-1 text-2xl font-bold text-slate-900">
                  Edycja danych
                </h2>
              </div>

              <button
                type="button"
                onClick={closeEditModal}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                Zamknij
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {isB2B ? (
                <>
                  <input
                    type="text"
                    placeholder="Nazwa firmy"
                    value={clientEditForm.company_name}
                    onChange={(event) =>
                      setClientEditForm({ ...clientEditForm, company_name: event.target.value })
                    }
                    className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-500"
                  />

                  <input
                    type="text"
                    placeholder="NIP"
                    value={clientEditForm.nip}
                    onChange={(event) =>
                      setClientEditForm({ ...clientEditForm, nip: event.target.value })
                    }
                    className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-500"
                  />

                  <input
                    type="text"
                    placeholder="REGON"
                    value={clientEditForm.regon}
                    onChange={(event) =>
                      setClientEditForm({ ...clientEditForm, regon: event.target.value })
                    }
                    className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-500"
                  />

                  <input
                    type="text"
                    placeholder="Osoba kontaktowa"
                    value={clientEditForm.contact_person}
                    onChange={(event) =>
                      setClientEditForm({ ...clientEditForm, contact_person: event.target.value })
                    }
                    className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-500"
                  />

                  <input
                    type="text"
                    placeholder="Telefon osoby kontaktowej"
                    value={clientEditForm.contact_phone}
                    onChange={(event) =>
                      setClientEditForm({ ...clientEditForm, contact_phone: event.target.value })
                    }
                    className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-500"
                  />
                </>
              ) : (
                <>
                  <input
                    type="text"
                    placeholder="Imię i nazwisko"
                    value={clientEditForm.full_name}
                    onChange={(event) =>
                      setClientEditForm({ ...clientEditForm, full_name: event.target.value })
                    }
                    className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-500"
                  />

                  <input
                    type="text"
                    placeholder="PESEL"
                    value={clientEditForm.pesel}
                    onChange={(event) =>
                      setClientEditForm({ ...clientEditForm, pesel: event.target.value })
                    }
                    className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-500"
                  />
                </>
              )}

              <input
                type="text"
                placeholder="Telefon"
                value={clientEditForm.phone}
                onChange={(event) =>
                  setClientEditForm({ ...clientEditForm, phone: event.target.value })
                }
                className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-500"
              />

              <input
                type="email"
                placeholder="Email"
                value={clientEditForm.email}
                onChange={(event) =>
                  setClientEditForm({ ...clientEditForm, email: event.target.value })
                }
                className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-500"
              />

              <input
                type="text"
                placeholder="Miejscowość"
                value={clientEditForm.city}
                onChange={(event) =>
                  setClientEditForm({ ...clientEditForm, city: event.target.value })
                }
                className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-500"
              />

              <input
                type="text"
                placeholder="Kod pocztowy"
                value={clientEditForm.postal_code}
                onChange={(event) =>
                  setClientEditForm({ ...clientEditForm, postal_code: event.target.value })
                }
                className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-500"
              />

              <input
                type="text"
                placeholder="Ulica"
                value={clientEditForm.street}
                onChange={(event) =>
                  setClientEditForm({ ...clientEditForm, street: event.target.value })
                }
                className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-500"
              />

              <input
                type="text"
                placeholder="Nr domu"
                value={clientEditForm.building_number}
                onChange={(event) =>
                  setClientEditForm({ ...clientEditForm, building_number: event.target.value })
                }
                className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-500"
              />

              <select
                value={clientEditForm.province}
                onChange={(event) =>
                  setClientEditForm({ ...clientEditForm, province: event.target.value })
                }
                className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-500"
              >
                <option value="">Województwo</option>
                {provinces.map((province) => (
                  <option key={province} value={province}>
                    {province}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-8 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeEditModal}
                className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                Anuluj
              </button>

              <button
                type="button"
                onClick={saveClientEdit}
                disabled={savingClientEdit}
                className="rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-400 disabled:opacity-50"
              >
                {savingClientEdit ? "Zapisywanie..." : "Zapisz zmiany"}
              </button>
            </div>
          </div>
        </div>
      )}
      {showAssignModal && canAssignClient() && client && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="mb-5">
              <p className="text-sm font-semibold text-emerald-600">Przypisanie klienta</p>
              <h2 className="mt-1 text-xl font-bold text-slate-900">
                {client.full_name || client.company_name || "Klient"}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Wybierz użytkownika, do którego ma trafić ten klient.
              </p>
            </div>

            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Użytkownik
            </label>
            <select
              value={selectedUserId}
              onChange={(event) => setSelectedUserId(event.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500"
            >
              <option value="">Wybierz użytkownika</option>
              {assignableUsers.map((user) => {
                const roleLabel = getRoleLabel(user.role);

                return (
                  <option key={user.id} value={user.id}>
                    {user.display_name || user.email || user.id} — {roleLabel}
                  </option>
                );
              })}
            </select>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeAssignModal}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                Anuluj
              </button>

              <button
                type="button"
                onClick={assignClientToUser}
                disabled={savingAssignment || !selectedUserId}
                className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-400 disabled:opacity-50"
              >
                {savingAssignment ? "Przypisywanie..." : "Przypisz"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}