// @ts-nocheck
import React, { useState } from "react";
import toast from "react-hot-toast";
import { StickyNote, Pencil, Trash2, BookOpen } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import {
  useGetNotesQuery,
  useDeleteNoteMutation,
} from "@/redux/api/noteApi";
import NoteModal from "@/components/chatroom/NoteModal";

// ── NoteCard ──────────────────────────────────────────────────────────────────
function NoteCard({ note, currentUserId, isTeacher, classId }) {
  const [showEditModal, setShowEditModal] = useState(false);
  const [deleteNote, { isLoading: isDeleting }] = useDeleteNoteMutation();

  const canEdit = note.createdBy?._id === currentUserId;
  const canDelete = canEdit || isTeacher;

  const handleDelete = async () => {
    if (!window.confirm("Delete this note?")) return;
    try {
      await deleteNote({ noteId: note._id, classId }).unwrap();
      toast.success("Note deleted successfully");
    } catch (error) {
      console.error("Failed to delete note:", error);
      toast.error("Failed to delete note");
    }
  };

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
          {canEdit && <button onClick={() => setShowEditModal(true)} className="p-1 text-gray-600 hover:text-blue-400"><Pencil size={12} /></button>}
          {canDelete && <button onClick={handleDelete} disabled={isDeleting} className="p-1 text-gray-600 hover:text-red-400 disabled:opacity-40"><Trash2 size={12} /></button>}
        </div>
      </div>
      <NoteModal
        open={showEditModal}
        mode="edit"
        classId={classId}
        noteId={note._id}
        initialTitle={note.title}
        initialDescription={note.description || ""}
        onSave={() => setShowEditModal(false)}
        onClose={() => setShowEditModal(false)}
      />
    </div>
  );
}

// ── NotesPanel ────────────────────────────────────────────────────────────────
export default function NotesPanel({ classId, currentUserId, isTeacher }) {
  const [page, setPage] = useState(1);
  const { data, isLoading, isFetching } = useGetNotesQuery(
    { classId, page, limit: 20 },
    { skip: !classId }
  );

  const notes = data?.notes || [];
  const totalPages = data?.totalPages || 1;

  return (
    <div className="flex flex-col h-full min-h-0 bg-gray-950/90 rounded-2xl p-4 shadow-lg">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-800">
        <StickyNote size={18} className="text-yellow-400" />
        <span className="text-white font-semibold text-sm">Notes</span>
        {data?.total ? <span className="text-xs text-gray-500">({data.total})</span> : null}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-3">
        {isLoading || isFetching ? (
          <p className="text-center text-gray-500 text-sm py-8">Loading…</p>
        ) : notes.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-gray-600 space-y-2">
            <BookOpen size={36} />
            <p className="text-sm">No notes yet — long-press a message to add one</p>
          </div>
        ) : (
          notes.map((note) => (
            <NoteCard key={note._id} note={note} currentUserId={currentUserId} isTeacher={isTeacher} classId={classId} />
          ))
        )}
        {totalPages > 1 && (
          <div className="flex justify-center gap-2 pt-2">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 rounded-lg bg-gray-800 text-gray-200 text-sm disabled:opacity-40">← Prev</button>
            <span className="px-3 py-1 text-gray-400 text-sm">{page} / {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 rounded-lg bg-gray-800 text-gray-200 text-sm disabled:opacity-40">Next →</button>
          </div>
        )}
      </div>
    </div>
  );
}
