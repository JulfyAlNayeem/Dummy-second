import express from "express";
import { createNote, getNotes, updateNote, deleteNote } from "./note.controller.js";
import { isLogin } from "../../../middlewares/auth.middleware.js";

const noteRouters = express.Router();
noteRouters.use(isLogin);

// Class-scoped
noteRouters.post("/:classId", createNote);
noteRouters.get("/:classId", getNotes);

// Note-scoped
noteRouters.patch("/:noteId", updateNote);
noteRouters.delete("/:noteId", deleteNote);

export default noteRouters;
