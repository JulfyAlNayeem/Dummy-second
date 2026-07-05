import mongoose from "mongoose";
const { Schema } = mongoose;

const noteSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: "",
    },
    // The class/group conversation this note belongs to
    classId: {
      type: Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
    },
    // The message the note was taken from (optional — from NoteModal's selectedText)
    messageId: {
      type: Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },
    // Who created the note
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // Role context — teachers create notes for the whole class,
    // students create personal notes
    visibility: {
      type: String,
      enum: ["class", "personal"],
      default: "personal",
    },
  },
  { timestamps: true }
);

noteSchema.index({ classId: 1, createdBy: 1 });
noteSchema.index({ classId: 1, visibility: 1 });

const Note = mongoose.models.Note || mongoose.model("Note", noteSchema);
export default Note;
