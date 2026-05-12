"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type ClientNote = {
  id: string;
  content: string;
  created_at: string;
  created_by: string;
  author_name?: string | null;
};

type ClientNotesProps = {
  clientId: string;
  currentUserId: string;
};

export default function ClientNotes({
  clientId,
  currentUserId,
}: ClientNotesProps) {
  const [notes, setNotes] = useState<ClientNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [newNote, setNewNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    loadNotes();
  }, [clientId]);

  async function loadNotes() {
    setLoading(true);
    setErrorMessage("");

    const { data: notesData, error: notesError } = await supabase
      .from("client_notes")
      .select("id, content, created_at, created_by")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });

    if (notesError) {
      console.error("Błąd ładowania notatek", notesError);
      setErrorMessage("Nie udało się załadować notatek");
      setLoading(false);
      return;
    }

    if (!notesData || notesData.length === 0) {
      setNotes([]);
      setLoading(false);
      return;
    }

    const authorIds = [...new Set(notesData.map((note) => note.created_by))];

    const { data: profilesData, error: profilesError } = await supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", authorIds);

    if (profilesError) {
      console.error("Błąd ładowania profili autorów", profilesError);
    }

    const profilesById = new Map(
      (profilesData || []).map((profile) => [profile.id, profile.display_name])
    );

    setNotes(
      notesData.map((note) => ({
        ...note,
        author_name: profilesById.get(note.created_by) || null,
      }))
    );

    setLoading(false);
  }

  async function addNote() {
    if (!newNote.trim()) return;

    setSaving(true);
    setErrorMessage("");

    const { error } = await supabase.from("client_notes").insert({
      client_id: clientId,
      created_by: currentUserId,
      content: newNote,
    });

    if (error) {
      console.error("Błąd zapisu notatki", error);
      setErrorMessage("Nie udało się zapisać notatki");
      setSaving(false);
      return;
    }

    setNewNote("");
    await loadNotes();
    setSaving(false);
  }

  return (
    <div className="mt-10 border-t border-slate-200 pt-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h4 className="text-xl font-bold">Notatki</h4>

          <p className="text-sm text-slate-500 mt-1">
            Historia notatek handlowych klienta.
          </p>
        </div>
      </div>

      <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50 mb-6">
        <textarea
          placeholder="Dodaj notatkę..."
          value={newNote}
          onChange={(event) => setNewNote(event.target.value)}
          className="w-full min-h-[120px] rounded-xl border border-slate-300 bg-white px-4 py-3 resize-none"
        />

        <div className="flex justify-end mt-4">
          <button
            type="button"
            onClick={addNote}
            disabled={saving}
            className="bg-emerald-500 hover:bg-emerald-400 text-white font-medium px-4 py-2 rounded-xl disabled:opacity-50"
          >
            {saving ? "Zapisywanie..." : "Dodaj notatkę"}
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="text-sm text-red-500 mb-4">{errorMessage}</div>
      )}

      {loading ? (
        <div className="text-sm text-slate-400">Ładowanie notatek...</div>
      ) : notes.length === 0 ? (
        <div className="text-sm text-slate-400">
          Brak notatek dla tego klienta.
        </div>
      ) : (
        <div className="space-y-4">
          {notes.map((note) => (
            <div
              key={note.id}
              className="border border-slate-200 rounded-2xl p-4 bg-slate-50"
            >
              <div className="flex items-center justify-between gap-4 mb-3">
                <div>
                  <p className="font-semibold">
                    {note.author_name || note.created_by}
                  </p>

                  <p className="text-xs text-slate-400">
                    {new Date(note.created_at).toLocaleString("pl-PL")}
                  </p>
                </div>
              </div>

              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                {note.content}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}