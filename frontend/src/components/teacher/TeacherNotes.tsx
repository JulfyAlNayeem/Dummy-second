// @ts-nocheck
import React from "react";
import NotesPanel from "@/components/shared/NotesPanel";
import { useUser } from "@/redux/slices/authSlice";

// Props: classId — pass the current open class conversation ID
export default function TeacherNotes({ classId }: { classId: string }) {
  const { user }: any = useUser({});
  return (
    <NotesPanel
      classId={classId}
      currentUserId={user?._id}
      isTeacher={true}
    />
  );
}
