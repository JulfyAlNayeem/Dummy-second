// ─────────────────────────────────────────────────────────────────────────────
// PATCH for MessageContainer.tsx
//
// 1. Add this import near the top with other API imports:
import { useCreateNoteMutation } from "@/redux/api/noteApi";
import { useConversation } from "@/redux/slices/conversationSlice";

// 2. Inside the component, add these two lines near where `socket` and `user`
//    are already destructured:
const { conversationId, isGroup } = useConversation();
const [createNote] = useCreateNoteMutation();

// 3. Replace the existing handleNote stub:
//
//    BEFORE (stub):
//      const handleNote = (msgId, selectedText) => {
//        setSelectedText(selectedText);
//        setShowNoteModal(true);
//      };
//
//    AFTER (wired):
const handleNote = (msgId, selectedText) => {
  setSelectedText(selectedText);
  setShowNoteModal(true);
  // store messageId so NoteModal's onSave can attach it
  setCurrentMessageId(msgId);
};

// 4. Replace the existing handleSaveNote stub:
//
//    BEFORE (stub):
//      const handleSaveNote = (title, description) => {
//        setShowNoteModal(false);
//        setSelectedText('');
//      };
//
//    AFTER (wired):
const handleSaveNote = async (title, description) => {
  // NoteModal passes (selectedText, description) — selectedText becomes the title
  try {
    await createNote({
      classId: conversationId,    // class/group conversation this note belongs to
      title,                      // the message text the user long-pressed on
      description,                // the description they typed in NoteModal
      messageId: currentMessageId // links the note back to the specific message
    }).unwrap();
  } catch (err) {
    console.error("Failed to save note:", err);
  }
  setShowNoteModal(false);
  setSelectedText('');
  setCurrentMessageId(null);
};

// ─────────────────────────────────────────────────────────────────────────────
// NOTHING ELSE in MessageContainer.tsx needs changing.
// NoteModal is already rendered there with:
//   <NoteModal
//     open={showNoteModal}
//     selectedText={selectedText}
//     onSave={handleSaveNote}       ← this now calls createNote
//     onClose={() => { setShowNoteModal(false); setSelectedText(''); }}
//   />
// ─────────────────────────────────────────────────────────────────────────────
