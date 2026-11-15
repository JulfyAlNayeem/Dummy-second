// @ts-nocheck
import React, { useState, useRef, useEffect } from "react";
import ImageDisplay from "../chatroom/ImageDisplay";
import VoiceMessageCard from "../chatroom/VoiceMessageCard";
import VideoMessageCard from "../chatroom/VideoMessageCard";
import CallCard from "../chatroom/CallCard";
import MessageReactions from "../chatroom/MessageReactions";
import ReactionPicker from "../chatroom/ReactionPicker";
import { themeSenderMessage, themeReceiverMessage } from "@/lib/themeUtils";
import { BASE_URL, resolveMediaUrl } from "@/utils/baseUrls";
import { cn } from "@/lib/utils";
import {
  useConversation,
  updateMessageReaction,
} from "@/redux/slices/conversationSlice";
import { useUserAuth } from "@/context-reducer/UserAuthContext";
import ProfileAvatar from "../chatroom/ProfileAvatar";
import MessageHeader from "../chatroom/MessageHeader";
import ReplyCard from "../chatroom/ReplyCard";
import ReactionBottomSheet from "../chatroom/ReactionBottomSheet";
import { useDispatch } from "react-redux";
import TextMessageCard from "../chatroom/TextMessageCard";
import ActionMenu from "../chatroom/ActionMenu";
import { SmilePlus } from "lucide-react";
import { decryptFile as decryptFileV1 } from "@/utils/messageEncryptionV1";
import { useMessageDecryption } from "@/hooks/useMessageDecryption";

const isV1EncryptedMedia = (media: any): boolean =>
  /^V1ENC_[a-f0-9]{32}\.bin$/i.test(media?.filename || "");

const MessageCards = ({
  msg,
  isOwnMessage,
  onImageClick,
  openDialog,
  retryMessage,
  removeMessage,
  activeMessageId,
  themeIndex,
  toggleActiveMessageId,
  sender,
  getSeenByNames,
  conversationId,
  isLastMessage,
}: any): JSX.Element => {
  const { isGroup }: any = useConversation();
  const { socket, user }: any = useUserAuth();
  const { decryptedText: decryptedReplyContent } = useMessageDecryption(
    msg.replyTo ? msg.text : null,
    conversationId,
    sender?._id || msg.sender?._id || msg.sender,
    user?._id,
    false
  );
  const { decryptedText: decryptedQuotedText } = useMessageDecryption(
    msg.replyTo?.text,
    conversationId,
    msg.replyTo?.sender?._id || msg.replyTo?.sender,
    user?._id,
    false
  );
  const dispatch = useDispatch();
  const [isStatusVisible, setIsStatusVisible] =
    useState<boolean>(isLastMessage);
  const [isReactionPickerOpen, setIsReactionPickerOpen] =
    useState<boolean>(false);
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState<boolean>(false);
  const [decryptedMediaByUrl, setDecryptedMediaByUrl] = useState<any>({});
  const [shouldLoadMedia, setShouldLoadMedia] = useState<boolean>(false);
  const messageRef = useRef<HTMLDivElement | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const node = messageRef.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setShouldLoadMedia(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldLoadMedia(true);
          observer.disconnect();
        }
      },
      { rootMargin: "300px" }
    );
    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let active = true;
    const objectUrls: string[] = [];
    const encryptedMedia = [
      ...(msg.media || []),
      ...(msg.replyTo?.media || []),
    ].filter(
      (media) =>
        isV1EncryptedMedia(media) &&
        media.url &&
        !media.url.startsWith("blob:")
    );

    setDecryptedMediaByUrl({});
    if (encryptedMedia.length === 0 || !conversationId || !shouldLoadMedia) {
      return () => {
        active = false;
      };
    }

    const decryptMedia = async () => {
      const entries = await Promise.all(
        encryptedMedia.map(async (media) => {
          try {
            const response = await fetch(resolveMediaUrl(media.url));
            if (!response.ok) {
              throw new Error(`Attachment download failed (${response.status})`);
            }

            const decrypted = await decryptFileV1(
              await response.arrayBuffer(),
              conversationId
            );
            if (!active) return [media.url, { url: "" }];
            const url = URL.createObjectURL(
              new Blob([decrypted.data], { type: decrypted.type })
            );
            objectUrls.push(url);
            const type = decrypted.type.startsWith("image/")
              ? "image"
              : decrypted.type.startsWith("video/")
                ? "video"
                : decrypted.type.startsWith("audio/")
                  ? "audio"
                  : "file";

            return [
              media.url,
              {
                url,
                type,
                filename: decrypted.filename,
                size: decrypted.size,
              },
            ];
          } catch (error) {
            console.error("Failed to decrypt V1 attachment", error);
            return [media.url, { url: "", decryptFailed: true }];
          }
        })
      );

      if (active) {
        setDecryptedMediaByUrl(Object.fromEntries(entries));
      }
    };

    decryptMedia();
    return () => {
      active = false;
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [conversationId, msg.media, msg.replyTo?.media, shouldLoadMedia]);

  const getDisplayedMedia = (mediaItems: any[] = []) =>
    mediaItems.map((media) => {
      if (!isV1EncryptedMedia(media)) return media;
      const decryptedMedia = decryptedMediaByUrl[media.url];
      return decryptedMedia
        ? { ...media, ...decryptedMedia }
        : { ...media, url: "" };
    });

  // Use reactions from msg prop (from Redux store)
  const messageReactions = msg.reactions || {};

  useEffect(() => {
    if (!socket) return;

    // Named handlers so socket.off() only removes THIS card's listener,
    // not every other MessageCards instance's listener on the same event.
    const handleReactionUpdate = ({ messageId, reactions, clientTempId }) => {
      if (
        messageId === (msg._id || msg.clientTempId) ||
        clientTempId === msg.clientTempId
      ) {
        dispatch(
          updateMessageReaction({
            conversationId,
            messageId,
            clientTempId,
            reactions,
          }),
        );
      }
    };

    const handleReactionSuccess = ({ messageId, reactions, clientTempId }) => {
      if (
        messageId === (msg._id || msg.clientTempId) ||
        clientTempId === msg.clientTempId
      ) {
        dispatch(
          updateMessageReaction({
            conversationId,
            messageId,
            clientTempId,
            reactions,
          }),
        );
      }
    };

    const handleReactionError = ({ message, clientTempId }) => {
      console.error("Reaction error:", message);
      // Revert optimistic update in Redux
      dispatch(
        updateMessageReaction({
          conversationId,
          messageId: msg._id,
          clientTempId: msg.clientTempId,
          reactions: msg.reactions || {},
        }),
      );
    };

    socket.on("reactionUpdate", handleReactionUpdate);
    socket.on("reactionSuccess", handleReactionSuccess);
    socket.on("reactionError", handleReactionError);

    return () => {
      // Pass the same function reference — only removes THIS card's listener
      socket.off("reactionUpdate", handleReactionUpdate);
      socket.off("reactionSuccess", handleReactionSuccess);
      socket.off("reactionError", handleReactionError);
    };
  }, [
    socket,
    msg._id,
    msg.clientTempId,
    conversationId,
    dispatch,
    msg.reactions,
  ]);

  const handleLongPressStart = (e) => {
    e.preventDefault();
    longPressTimer.current = setTimeout(() => {
      const rect = messageRef.current.getBoundingClientRect();
      setIsReactionPickerOpen(true);
    }, 700);
  };

  const handleLongPressEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleMessageClick = () => {
    if (!isLastMessage) {
      setIsStatusVisible((prev) => !prev);
    }
  };
  const handleReaction = (emoji) => {
    const messageId = msg._id || msg.clientTempId;
    const currentReactions = messageReactions || {};

    if (currentReactions[user._id] === emoji) {
      // Optimistically remove reaction
      const { [user._id]: _, ...otherReactions } = currentReactions;
      dispatch(
        updateMessageReaction({
          conversationId,
          messageId,
          clientTempId: msg.clientTempId,
          reactions: otherReactions,
        }),
      );

      socket.emit("removeReaction", {
        conversationId,
        messageId,
        userId: user._id,
        clientTempId: msg.clientTempId,
      });
    } else {
      // Optimistically add reaction
      const updatedReactions = {
        ...currentReactions,
        [user._id]: { emoji, username: user.name || user._id },
      };
      dispatch(
        updateMessageReaction({
          conversationId,
          messageId,
          clientTempId: msg.clientTempId,
          reactions: updatedReactions,
        }),
      );

      socket.emit("addReaction", {
        conversationId,
        messageId,
        userId: user._id,
        reaction: emoji, // backend expects `reaction` not `emoji`
        clientTempId: msg.clientTempId,
      });
    }

    setIsReactionPickerOpen(false);
  };

  const handleRemoveReaction = (clickedUserId) => {
    if (clickedUserId !== user._id) return;

    const messageId = msg._id || msg.clientTempId;
    const currentReactions = messageReactions || {};

    const { [user._id]: _, ...otherReactions } = currentReactions;
    dispatch(
      updateMessageReaction({
        conversationId,
        messageId,
        clientTempId: msg.clientTempId,
        reactions: otherReactions,
      }),
    );

    socket.emit("removeReaction", {
      conversationId,
      messageId,
      userId: user._id,
      clientTempId: msg.clientTempId,
    });
  };

  const getReactionSummary = () => {
    const reactions = messageReactions || {};
    const summary = {};

    Object.values(reactions).forEach(({ emoji }) => {
      summary[emoji] = (summary[emoji] || 0) + 1;
    });

    return Object.entries(summary).map(([emoji, count]) => ({ emoji, count }));
  };

  const showBackground =
    msg.messageType === "text" &&
    !msg.replyTo &&
    !msg.media?.length &&
    msg.emojiType !== "custom";
  const displayedMedia = getDisplayedMedia(msg.media || []);
  const displayedReplyMedia = getDisplayedMedia(msg.replyTo?.media || []);
  const hasAttachmentDecryptionFailure = [
    ...displayedMedia,
    ...displayedReplyMedia,
  ].some((media) => media.decryptFailed);

  return (
    <div className="max-w-[90%] relative ">
      {activeMessageId === (msg._id || msg.clientTempId) && !isOwnMessage && (
        <MessageHeader
          sender={sender}
          msg={msg}
          themeIndex={themeIndex}
          isOwnMessage={isOwnMessage}
        />
      )}
      <div
        className={`flex ${isOwnMessage ? "justify-end items-end" : null} gap-2 relative`}
      >
        {!isOwnMessage && (
          <ProfileAvatar
            isOwnMessage={isOwnMessage}
            sender={sender}
            currentUser={user}
            setActiveMessageId={() =>
              toggleActiveMessageId(msg._id || msg.clientTempId)
            }
            message={msg}
            setIsStatusVisible={setIsStatusVisible}
          />
        )}
        <div
          ref={messageRef}
          onClick={handleMessageClick}
          onMouseDown={handleLongPressStart}
          onMouseUp={handleLongPressEnd}
          onMouseLeave={handleLongPressEnd}
          onTouchStart={handleLongPressStart}
          onTouchEnd={handleLongPressEnd}
        >
          {msg.replyTo && (
            <ReplyCard
              themeIndex={themeIndex}
              isOwnMessage={isOwnMessage}
              replyTo={
                sender._id === msg.replyTo.sender?._id ? "yourself" : "someone"
              }
              replyType={
                displayedReplyMedia[0]?.type || msg.replyTo.messageType
              }
              repliedMessage={
                msg.replyTo.messageType === "text"
                  ? decryptedQuotedText || `${msg.replyTo.text}`
                  : displayedReplyMedia[0]?.url
                    ? resolveMediaUrl(displayedReplyMedia[0].url)
                    : null
              }
              repliedName={displayedReplyMedia[0]?.filename}
              contentType={displayedMedia[0]?.type || msg.messageType}
              content={
                msg.messageType === "text"
                  ? decryptedReplyContent || msg.plainText || msg.text
                  : displayedMedia[0]?.url
                    ? resolveMediaUrl(displayedMedia[0].url)
                    : null
              }
              contentName={displayedMedia[0]?.filename}
            />
          )}
          {/* Always show emoji image if media is present and type is image */}
          {msg.media?.length > 0 &&
            msg.media[0].type === "image" &&
            msg.media[0].url?.includes("emoji") && (
              <img src={`/${msg.media[0].url}`} className="max-w-[100px]" />
            )}
          {/* If emojiType is standard, show htmlEmoji */}
          {msg.emojiType === "standard" && (
            <span className="text-2xl">{msg.htmlEmoji}</span>
          )}
          {hasAttachmentDecryptionFailure && (
            <div role="alert" className="text-sm text-red-300">
              Could not decrypt attachment. Verify the V1 conversation key.
            </div>
          )}
          {/* If not emoji, show text and other media as usual */}
          {(!msg.media?.length ||
            msg.media[0].type !== "image" ||
            !msg.media[0].url?.includes("emoji")) &&
            msg.emojiType !== "standard" && (
              <>
                {msg.text && !msg.replyTo && (
                  <div
                    className={cn(
                      `${
                        showBackground
                          ? isOwnMessage
                            ? themeSenderMessage(
                                themeIndex,
                                "rounded-l-xl rounded-t-xl",
                              )
                            : themeReceiverMessage(
                                themeIndex,
                                "rounded-r-xl rounded-b-xl",
                              )
                          : themeSenderMessage(
                              themeIndex,
                              "rounded-l-xl rounded-t-xl",
                            )
                      } relative ${msg.emojiType === "custom" || msg.replyTo || msg.media?.length ? "p-0" : "p-3"} w-fit text-base max-w-[100%] relative`,
                    )}
                  >
                    <TextMessageCard
                      text={msg.text}
                      plainText={msg.plainText}
                      senderId={sender?._id}
                      messageId={msg._id || msg.messageId}
                    />
                  </div>
                )}
                {displayedMedia.length > 0 &&
                  displayedMedia.some((media) => media.type === "image") && (
                    <div className="mt-2">
                      <ImageDisplay
                        img={displayedMedia
                          .filter((media) => media.type === "image")
                          .map((media) => ({ img: resolveMediaUrl(media.url) }))}
                        onImageClick={(index) =>
                          onImageClick(
                            index,
                            displayedMedia
                              .filter((media) => media.type === "image")
                              .map((media) => ({
                                img: resolveMediaUrl(media.url),
                              })),
                          )
                        }
                      />
                    </div>
                  )}
                {displayedMedia.length > 0 &&
                  displayedMedia.some((media) => media.type === "audio") && (
                    <div className="mt-2">
                      <VoiceMessageCard
                        duration={
                          displayedMedia.find((media) => media.type === "audio")
                            ?.duration || "0:00"
                        }
                        audioUrl={resolveMediaUrl(displayedMedia.find((media) => media.type === "audio")?.url)}
                      />
                    </div>
                  )}
                {displayedMedia.length > 0 &&
                  displayedMedia.some((media) => media.type === "video") && (
                    <div className="mt-2">
                      <VideoMessageCard
                        videoUrl={resolveMediaUrl(displayedMedia.find((media) => media.type === "video")?.url)}
                      />
                    </div>
                  )}
                {displayedMedia.length > 0 &&
                  displayedMedia.some((media) => media.type === "file") && (
                    <div className="mt-2">
                      <ReplyCard
                        isOwnMessage={isOwnMessage}
                        contentType="file"
                        content={resolveMediaUrl(displayedMedia.find((media) => media.type === "file")?.url)}
                        contentName={displayedMedia.find((media) => media.type === "file")?.filename}
                        themeIndex={themeIndex}
                      />
                    </div>
                  )}
                {msg.voice && (
                  <div className="mb-2">
                    <VoiceMessageCard
                      duration={msg.voice.duration}
                      audioUrl={msg.voice.audioUrl}
                    />
                  </div>
                )}
                {msg.call && (
                  <div className="mb-2">
                    <CallCard
                      type={msg.call.type}
                      duration={msg.call.duration}
                      timestamp={msg.call.timestamp}
                      callerName={msg.call.callerName}
                    />
                  </div>
                )}
                {msg.img && (
                  <div className="mb-2">
                    <ImageDisplay
                      img={[{ img: resolveMediaUrl(msg.img) }]}
                      onImageClick={() =>
                        onImageClick(0, [{ img: resolveMediaUrl(msg.img) }])
                      }
                    />
                  </div>
                )}
              </>
            )}
          <MessageReactions
            reactions={getReactionSummary()}
            onAddReaction={() => setIsBottomSheetOpen(true)}
            showAddButton={false}
          />
          <div
            className={cn(
              "absolute top-0 bottom-0 flex items-center gap-1",
              isOwnMessage ? "-left-12" : "-right-12",
            )}
          >
           
            <ActionMenu
              isOwnMessage={isOwnMessage}
              themeIndex={themeIndex}
              msg={msg}
              openDialog={openDialog}
            />

             <button
              type="button"
              title="React"
              onClick={(e) => {
                e.stopPropagation();
                setIsReactionPickerOpen((v) => !v);
              }}
              className="p-1 rounded-full hover:bg-white/10 transition-colors text-base leading-none select-none"
              aria-label="Add reaction"
            >
              <SmilePlus className={`text-gray-200 w-4 h-7 px-0.5 rounded-2xl ${isOwnMessage ? themeSenderMessage(themeIndex) : themeReceiverMessage(themeIndex) } hover:bg-white/20`} />
            </button>
            
          </div>
          {isReactionPickerOpen && (
            <ReactionPicker
              open={isReactionPickerOpen}
              onReaction={handleReaction}
              onClose={() => {
                setIsReactionPickerOpen(false);
                setIsStatusVisible(false);
              }}
              themeIndex={themeIndex}
              messageRef={messageRef}
            >
              <div />
            </ReactionPicker>
          )}
        </div>
        {isOwnMessage && (
          <ProfileAvatar
            isOwnMessage={isOwnMessage}
            sender={sender}
            currentUser={user}
            setActiveMessageId={() =>
              toggleActiveMessageId(msg._id || msg.clientTempId)
            }
            message={msg}
            setIsStatusVisible={setIsStatusVisible}
          />
        )}
      </div>
      {isOwnMessage && isStatusVisible && (
        <div
          className={`absolute text-xs flex items-center bg-slate-800 rounded-full px-2 text-gray-100 ${isOwnMessage ? "right-8" : "left-0"} -bottom-2 ${isOwnMessage ? "justify-end" : "justify-start"} animate-slide-in `}
          style={{
            animation: isStatusVisible
              ? "slideIn 0.3s ease-in-out"
              : "slideOut 0.3s ease-in-out",
          }}
        >
          {msg.status === "sending" && "Sending..."}
          {msg.status === "fail" && (
            <div className="flex items-center gap-2 min-w-44">
              <p className="text-red-600">Failed to send</p>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  retryMessage(msg.clientTempId);
                }}
                className="text-green-500 ml-1"
              >
                Retry
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeMessage(conversationId, msg.clientTempId);
                }}
                className="text-yellow-400 ml-1"
              >
                Remove
              </button>
            </div>
          )}
          {msg.status === "sent" && "Sent"}
          {msg.status === "delivered" && !isGroup && "Delivered"}
          {msg.status === "read" && !isGroup && "Seen"}
          {isGroup && msg.readBy && msg.readBy.length > 0 && (
            <span>{getSeenByNames(msg.readBy)}</span>
          )}
        </div>
      )}
      {activeMessageId === (msg._id || msg.clientTempId) && isOwnMessage && (
        <MessageHeader
          sender={sender}
          msg={msg}
          themeIndex={themeIndex}
          isOwnMessage={isOwnMessage}
        />
      )}
      <ReactionBottomSheet
        open={isBottomSheetOpen}
        onOpenChange={setIsBottomSheetOpen}
        reactions={messageReactions}
        userId={user._id}
        onRemoveReaction={handleRemoveReaction}
        messageId={msg._id || msg.clientTempId}
      />
    </div>
  );
};

export default MessageCards;