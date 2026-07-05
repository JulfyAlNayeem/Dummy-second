// @ts-nocheck
import React, { useState } from "react";
import { StickyNote, Plus, Pencil, Trash2, Check, X, BookOpen } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import NoteModal from "@/components/chatroom/NoteModal";
import {
  useGetNotesQuery,
  useCreateNoteMutation,
  useUpdateNoteMutation,
  useDeleteNoteMutation,
} from "@/redux/api/noteApi";

function NoteCard({ note, currentUserId, isTeacher, classId }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(note.title);
  const [description, setDescription] = useState(note.description || "");
  const [updateNote, { isLoading: isSaving }] = useUpdateNoteMutation();
  const [deleteNote, { isLoading: isDeleting }] = useDeleteNoteMutation();

  const canEdit = note.createdBy?._id === currentUserId;
  const canDelete = canEdit || isTeacher;

  const handleSave = async () => {
    if (!title.trim()) return;
    await updateNote({ noteId: note._id, classId, title, description }).unwrap();
    setEditing(false);
  };

  const handleDelete = async () => {
    if (!window.confirm("Delete this note?")) return;
    await deleteNote({ noteId: note._id, classId }).unwrap();
  };

  if (editing) {
    return (
      <div className="bg-gray-800 border border-blue-500/40 rounded-xl p-4 space-y-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 resize-none focus:outline-none focus:border-blue-500"
        />
        <div className="flex gap-2 justify-end">
          <button onClick={() => setEditing(false)} className="p-1 text-gray-500 hover:text-gray-300"><X size={14} /></button>
          <button onClick={handleSave} disabled={isSaving} className="p-1 text-blue-400 hover:text-blue-300 disabled:opacity-40"><Check size={14} /></button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 space-y-1.5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-white text-sm font-medium flex-1">{note.title}</p>
        <span className={`text-[10px] px-2 py-0.5 rounded-full border shrink-0 ${
          note.visibility === "class"
            ? "bg-blue-500/20 text-blue-300 border-blue-500/30"
            : "bg-gray-600/40 text-gray-400 border-gray-600/30"
        }`}>
          {note.visibility === "class" ? "Class" : "Personal"}
        </span>
      </div>
      {note.description && (
        <p className="text-gray-400 text-xs leading-relaxed whitespace-pre-wrap">{note.description}</p>
      )}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-1.5">
          <img src={note.createdBy?.image || "/images/avatar/default-avatar.svg"} className="w-4 h-4 rounded-full" alt="" />
          <span className="text-gray-500 text-xs">{note.createdBy?.name}</span>
          <span className="text-gray-600 text-xs">· {formatDistanceToNow(new Date(note.createdAt), { addSuffix: true })}</span>
        </div>
        <div className="flex gap-1">
          {canEdit && <button onClick={() => setEditing(true)} className="p-1 text-gray-600 hover:text-blue-400"><Pencil size={12} /></button>}
          {canDelete && <button onClick={handleDelete} disabled={isDeleting} className="p-1 text-gray-600 hover:text-red-400 disabled:opacity-40"><Trash2 size={12} /></button>}
        </div>
      </div>
    </div>
  );
}

export default function NotesPanel({ classId, currentUserId, isTeacher }) {
  const [page, setPage] = useState(1);
  // NoteModal state
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedText, setSelectedText] = useState("");

  const { data, isLoading, isFetching } = useGetNotesQuery(
    { classId, page, limit: 20 },
    { skip: !classId }
  );
  const [createNote] = useCreateNoteMutation();

  const notes = data?.notes || [];
  const totalPages = data?.totalPages || 1;

  // Called by NoteModal's "Add Note" button
  // NoteModal passes (selectedText, description) — selectedText = title
  const handleSaveNote = async (title: string, description: string) => {
    try {
      await createNote({ classId, title, description }).unwrap();
    } catch (err) {
      console.error("Failed to save note:", err);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-950">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <StickyNote size={18} className="text-yellow-400" />
          <span className="text-white font-semibold text-sm">Notes</span>
          {data?.total ? <span className="text-xs text-gray-500">({data.total})</span> : null}
        </div>
        {/* "New Note" button opens NoteModal with a blank title */}
        <button
          onClick={() => { setSelectedText(""); setModalOpen(true); }}
          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 text-xs transition-colors"
        >
          <Plus size={13} /> New Note
        </button>
      </div>

      {/* NoteModal — same modal used when long-pressing a message */}
      <NoteModal
        open={modalOpen}
        selectedText={selectedText}
        onSave={handleSaveNote}
        onClose={() => setModalOpen(false)}
      />

      {/* Notes list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {isLoading || isFetching ? (
          <p className="text-center text-gray-500 text-sm py-8">Loading…</p>
        ) : notes.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-gray-600 space-y-2">
            <BookOpen size={36} />
            <p className="text-sm">No notes yet</p>
            <p className="text-xs text-gray-700">Click "New Note" or long-press a message</p>
          </div>
        ) : (
          notes.map((note) => (
            <NoteCard key={note._id} note={note} currentUserId={currentUserId} isTeacher={isTeacher} classId={classId} />
          ))
        )}
        {totalPages > 1 && (
          <div className="flex justify-center gap-2 pt-2">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 rounded-lg bg-gray-800 text-gray-300 text-sm disabled:opacity-40">← Prev</button>
            <span className="px-3 py-1 text-gray-500 text-sm">{page} / {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 rounded-lg bg-gray-800 text-gray-300 text-sm disabled:opacity-40">Next →</button>
          </div>
        )}
      </div>
    </div>
  );
}