import mongoose from "mongoose";
import Note from "./note.model.js";
import Conversation from "../../common/models/conversationModel.js";

// ── helpers ──────────────────────────────────────────────────────────────────

const isMember = (conversation, userId) =>
  conversation.participants.some((p) => p.toString() === userId.toString());

const isTeacher = (req) =>
  ["teacher", "admin", "superadmin"].includes(req.user?.role);

// ── POST /notes/:classId  — create a note ────────────────────────────────────
export const createNote = async (req, res) => {
  try {
    const { classId } = req.params;
    const { title, description, messageId } = req.body;
    const userId = req.user._id;

    if (!classId || !mongoose.isValidObjectId(classId)) {
      return res.status(400).json({ message: "Invalid class ID." });
    }
    if (!title?.trim()) {
      return res.status(400).json({ message: "Title is required." });
    }

    const conversation = await Conversation.findById(classId);
    if (!conversation) {
      return res.status(404).json({ message: "Class not found." });
    }
    if (!isMember(conversation, userId)) {
      return res.status(403).json({ message: "You are not a member of this class." });
    }

    // Teachers create class-wide visible notes; students create personal notes
    const visibility = isTeacher(req) ? "class" : "personal";

    const note = await Note.create({
      title: title.trim(),
      description: description?.trim() || "",
      classId,
      messageId: messageId && mongoose.isValidObjectId(messageId) ? messageId : null,
      createdBy: userId,
      visibility,
    });

    await note.populate("createdBy", "name image role");

    res.status(201).json({ message: "Note created.", note });
  } catch (err) {
    console.error("createNote error:", err);
    res.status(500).json({ message: "Server error." });
  }
};

// ── GET /notes/:classId  — get notes for a class ─────────────────────────────
// Teachers see ALL notes in the class.
// Students only see their own personal notes + any class-wide notes from teachers.
export const getNotes = async (req, res) => {
  try {
    const { classId } = req.params;
    const userId = req.user._id;
    const { page = 1, limit = 20 } = req.query;

    if (!classId || !mongoose.isValidObjectId(classId)) {
      return res.status(400).json({ message: "Invalid class ID." });
    }

    const conversation = await Conversation.findById(classId);
    if (!conversation) {
      return res.status(404).json({ message: "Class not found." });
    }
    if (!isMember(conversation, userId)) {
      return res.status(403).json({ message: "Access denied." });
    }

    let query;
    if (isTeacher(req)) {
      // Teachers see everything in this class
      query = { classId };
    } else {
      // Students see class-wide notes from teachers + their own personal notes
      query = {
        classId,
        $or: [
          { visibility: "class" },
          { createdBy: userId },
        ],
      };
    }

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);

    const [notes, total] = await Promise.all([
      Note.find(query)
        .populate("createdBy", "name image role")
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum),
      Note.countDocuments(query),
    ]);

    res.json({
      notes,
      total,
      totalPages: Math.ceil(total / limitNum),
      currentPage: pageNum,
    });
  } catch (err) {
    console.error("getNotes error:", err);
    res.status(500).json({ message: "Server error." });
  }
};

// ── PATCH /notes/:noteId  — update a note ────────────────────────────────────
export const updateNote = async (req, res) => {
  try {
    const { noteId } = req.params;
    const { title, description } = req.body;
    const userId = req.user._id;

    if (!mongoose.isValidObjectId(noteId)) {
      return res.status(400).json({ message: "Invalid note ID." });
    }

    const note = await Note.findById(noteId);
    if (!note) return res.status(404).json({ message: "Note not found." });

    // Only the creator can edit their own note
    if (note.createdBy.toString() !== userId.toString()) {
      return res.status(403).json({ message: "You can only edit your own notes." });
    }

    if (title?.trim()) note.title = title.trim();
    if (description !== undefined) note.description = description.trim();

    await note.save();
    await note.populate("createdBy", "name image role");

    res.json({ message: "Note updated.", note });
  } catch (err) {
    console.error("updateNote error:", err);
    res.status(500).json({ message: "Server error." });
  }
};

// ── DELETE /notes/:noteId  — delete a note ───────────────────────────────────
export const deleteNote = async (req, res) => {
  try {
    const { noteId } = req.params;
    const userId = req.user._id;

    if (!mongoose.isValidObjectId(noteId)) {
      return res.status(400).json({ message: "Invalid note ID." });
    }

    const note = await Note.findById(noteId);
    if (!note) return res.status(404).json({ message: "Note not found." });

    // Creator or teacher/admin can delete
    const canDelete =
      note.createdBy.toString() === userId.toString() || isTeacher(req);

    if (!canDelete) {
      return res.status(403).json({ message: "Access denied." });
    }

    await Note.findByIdAndDelete(noteId);
    res.json({ message: "Note deleted." });
  } catch (err) {
    console.error("deleteNote error:", err);
    res.status(500).json({ message: "Server error." });
  }
};
