import jwt from "jsonwebtoken";
import User from "../src/common/models/userModel.js";
import Conversation from "../src/common/models/conversationModel.js";
import Session from "../src/common/models/sessionModel.js";
import logger from "../src/common/utils/logger.js";

const getAccessToken = (req) => {
  const cookieToken = req.cookies?.accessToken || req.cookies?.access_token;
  if (cookieToken) return cookieToken;

  const authHeader = req.headers["authorization"];
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.split(" ")[1];
  }

  return null;
};

const authenticateUser = async (req) => {
  const token = getAccessToken(req);
  if (!token) {
    const error = new Error("Access token required");
    error.statusCode = 401;
    throw error;
  }

  const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
  const user = await User.findById(decoded.id);
  if (!user) {
    const error = new Error("User not found");
    error.statusCode = 401;
    throw error;
  }

  return user;
};

// Require Teacher (or higher)
export const requireTeacher = async (req, res, next) => {
  try {
    const user = await authenticateUser(req);

    if (!["teacher", "admin", "superadmin"].includes(user.role)) {
      logger.warn({ userId: user._id, role: user.role }, "Teacher authorization denied");
      return res
        .status(403)
        .json({ message: "Access denied. Teacher role required." });
    }

    req.user = user;
    next();
  } catch (error) {
    logger.warn({ error: error.message }, "Teacher authentication failed");
    return res.status(error.statusCode || 401).json({ message: error.statusCode === 401 ? error.message : "Invalid token" });
  }
};

// Require Auth (any logged-in user)
export const requireAuth = async (req, res, next) => {
  try {
    req.user = await authenticateUser(req);
    next();
  } catch (error) {
    logger.warn({ error: error.message }, "Authentication failed");
    return res.status(error.statusCode || 401).json({ message: error.statusCode === 401 ? error.message : "Invalid token" });
  }
};

// Require Conversation Admin
export const requireConversationAdmin = async (req, res, next) => {
  try {
    let { classId } = req.params;
    const userId = req.user._id.toString();

    // If classId isn't provided but a sessionId is, resolve the classId from the session.
    if (!classId && req.params?.sessionId) {
      const session = await Session.findById(req.params.sessionId);
      if (!session) {
        return res.status(404).json({ message: "Session not found." });
      }
      classId = session.classId?._id ? session.classId._id.toString() : session.classId?.toString();
    }

    if (!classId) {
      return res.status(400).json({ message: "classId is required." });
    }

    const classGroup = await Conversation.findById(classId);
    if (!classGroup || !classGroup.group.is_group) {
      return res.status(404).json({ message: "Conversation not found." });
    }

    const isAdmin = classGroup.group.admins.some(
      (admin) => admin.toString() === userId
    );

    if (!isAdmin) {
      return res
        .status(403)
        .json({ message: "Access denied. Class admin privileges required." });
    }

    req.classGroup = classGroup;
    next();
  } catch (error) {
    logger.error({ error: error.message }, "Conversation admin authorization failed");
    return res.status(500).json({ message: "Server error" });
  }
};
