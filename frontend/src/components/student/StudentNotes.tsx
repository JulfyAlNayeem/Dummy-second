// @ts-nocheck
import React from "react";
import { useParams } from "react-router-dom";
import NotesPanel from "@/components/shared/NotesPanel";
import DashboardLayout from "@/components/admin/DashboardLayout";
import { useUser } from "@/redux/slices/authSlice";

// Props: classId — pass the current open class conversation ID
export default function StudentNotes({ classId: propClassId }: { classId?: string }) {
  const { classId: routeClassId } = useParams<{ classId: string }>();
  const { user }: any = useUser({});
  const classId = propClassId || routeClassId;

  return (
    <DashboardLayout type="student">
      <div className="min-h-[calc(100vh-3rem)]">
        <NotesPanel
          classId={classId}
          currentUserId={user?._id}
          isTeacher={false}
        />
      </div>
    </DashboardLayout>
  );
}
