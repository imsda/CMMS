import { UserRole } from "@prisma/client";
import { type Session } from "next-auth";

export function canAccessTeacherPortal(role: UserRole | null | undefined) {
  return role === UserRole.STAFF_TEACHER || role === UserRole.SUPER_ADMIN;
}

export function requireTeacherPortalSession(session: Session | null) {
  if (!session?.user || !canAccessTeacherPortal(session.user.role)) {
    throw new Error("Only teaching staff and super admins can access teacher workflows.");
  }

  return {
    isSuperAdmin: session.user.role === UserRole.SUPER_ADMIN,
    userId: session.user.id,
  };
}
