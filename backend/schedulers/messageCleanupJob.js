import cron from "node-cron";
import path from "path";
import { promises as fsPromises } from "fs";
import Conversation from "../src/common/models/conversationModel.js";
import Message from "../src/common/models/messageModel.js";

// Run every 5 minutes
const messageCleanupJob = cron.schedule("*/5 * * * *", async () => {
  try {
    const now = new Date();

    // Find messages scheduled for deletion, including necessary fields
    const messagesToDelete = await Message.find(
      { scheduledDeletionTime: { $lte: now } },
      { _id: 1, media: 1, conversation: 1, sender: 1 }
    );

    // Process each message
    for (const msg of messagesToDelete) {
      // Delete associated media files
      if (Array.isArray(msg.media) && msg.media.length > 0) {
        for (const mediaItem of msg.media) {
          if (mediaItem.url) {
            const correctedPath = mediaItem.url.includes("uploads")
              ? mediaItem.url
              : path.join("uploads", mediaItem.url);

            const filePath = path.join(process.cwd(), correctedPath);

            // Non-blocking delete
            await fsPromises.unlink(filePath).catch((err) => {
              console.error(`[Cron] Failed to delete file ${filePath}:`, err);
            });
          }
        }
      }

    }

    // Delete messages from DB
    const result = await Message.deleteMany({
      scheduledDeletionTime: { $lte: now },
    });

    if (global.io && result.deletedCount > 0) {
      for (const msg of messagesToDelete) {
        global.io.to(`conv:${msg.conversation}`).emit("messageDeleted", {
          messageId: msg._id.toString(),
          userId: msg.sender?.toString(),
          conversationId: msg.conversation.toString(),
          hardDelete: true,
        });
      }
    }

    const conversationsWithExpiringPreviews = await Conversation.find({
      "last_message.message": { $ne: "" },
      "last_message.timestamp": { $ne: null },
      $or: [
        { "last_message.expiresAt": { $lte: now } },
        {
          autoDeleteMessagesAfter: { $gt: 0 },
          $or: [
            { "last_message.expiresAt": { $exists: false } },
            { "last_message.expiresAt": null },
          ],
        },
      ],
    });

    for (const conversation of conversationsWithExpiringPreviews) {
      const lastMessage = conversation.last_message;
      const expiresAt =
        lastMessage.expiresAt ||
        new Date(
          new Date(lastMessage.timestamp).getTime() +
            conversation.autoDeleteMessagesAfter * 60 * 60 * 1000
        );
      if (expiresAt > now) continue;

      conversation.last_message = {
        message: "",
        sender: null,
        timestamp: null,
        expiresAt: null,
      };
      await conversation.save();

      if (global.io) {
        for (const participantId of conversation.participants) {
          global.io
            .to(`user_${participantId}`)
            .emit("conversationLastMessageExpired", {
              conversationId: conversation._id.toString(),
            });
        }
      }
    }

    console.log(
      `[Cron] Deleted ${result.deletedCount} expired messages, cleaned expired previews, and removed their media at ${now.toISOString()}`
    );
  } catch (error) {
    console.error("[Cron] Message cleanup failed:", error);
  }
});

export default messageCleanupJob;
