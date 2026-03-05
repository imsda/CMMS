"use server";

import { ClubType, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";

import { auth } from "../../auth";
import { prisma } from "../../lib/prisma";

export type AdminCreateFormState = {
  status: "idle" | "success" | "error";
  message: string | null;
};

function parseRequiredString(value: FormDataEntryValue | null, label: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} is required.`);
  }

  return value.trim();
}

function parseOptionalString(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function ensureSuperAdmin(role: UserRole | undefined) {
  if (role !== UserRole.SUPER_ADMIN) {
    throw new Error("Only super admins can perform this action.");
  }
}

function parseClubType(value: FormDataEntryValue | null) {
  const clubType = parseRequiredString(value, "Club type");

  if (!Object.values(ClubType).includes(clubType as ClubType)) {
    throw new Error("Club type is invalid.");
  }

  return clubType as ClubType;
}

function parseUserRole(value: FormDataEntryValue | null) {
  const role = parseRequiredString(value, "User role");

  if (!Object.values(UserRole).includes(role as UserRole)) {
    throw new Error("User role is invalid.");
  }

  return role as UserRole;
}

const INITIAL_STATE: AdminCreateFormState = {
  status: "idle",
  message: null,
};

export const adminCreateInitialState = INITIAL_STATE;

export async function createClubAction(
  _prevState: AdminCreateFormState,
  formData: FormData,
): Promise<AdminCreateFormState> {
  try {
    const session = await auth();
    ensureSuperAdmin(session?.user?.role);

    const name = parseRequiredString(formData.get("name"), "Club name");
    const code = parseRequiredString(formData.get("code"), "Club code").toUpperCase();
    const type = parseClubType(formData.get("type"));
    const city = parseOptionalString(formData.get("city"));
    const state = parseOptionalString(formData.get("state"));

    await prisma.club.create({
      data: {
        name,
        code,
        type,
        city,
        state,
      },
    });

    revalidatePath("/admin/clubs");

    return {
      status: "success",
      message: `Club "${name}" created.`,
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to create club.",
    };
  }
}

export async function createUserAction(
  _prevState: AdminCreateFormState,
  formData: FormData,
): Promise<AdminCreateFormState> {
  try {
    const session = await auth();
    ensureSuperAdmin(session?.user?.role);

    const name = parseRequiredString(formData.get("name"), "Name");
    const email = parseRequiredString(formData.get("email"), "Email").toLowerCase();
    const role = parseUserRole(formData.get("role"));
    const password = parseRequiredString(formData.get("password"), "Temporary password");
    const primaryClubId = parseOptionalString(formData.get("primaryClubId"));
    const membershipTitle = parseOptionalString(formData.get("membershipTitle"));

    if (password.length < 8) {
      throw new Error("Temporary password must be at least 8 characters.");
    }

    if (role !== UserRole.SUPER_ADMIN && !primaryClubId) {
      throw new Error("Primary club is required for non-admin users.");
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          name,
          email,
          role,
          passwordHash,
        },
        select: {
          id: true,
        },
      });

      if (primaryClubId) {
        await tx.clubMembership.create({
          data: {
            userId: createdUser.id,
            clubId: primaryClubId,
            title: membershipTitle,
            isPrimary: true,
          },
        });
      }
    });

    revalidatePath("/admin/users");

    return {
      status: "success",
      message: `User "${name}" created.`,
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to create user.",
    };
  }
}

export async function assignUserMembershipAction(
  _prevState: AdminCreateFormState,
  formData: FormData,
): Promise<AdminCreateFormState> {
  try {
    const session = await auth();
    ensureSuperAdmin(session?.user?.role);

    const userId = parseRequiredString(formData.get("userId"), "User");
    const clubId = parseRequiredString(formData.get("clubId"), "Club");
    const title = parseOptionalString(formData.get("membershipTitle"));
    const isPrimary = formData.get("isPrimary") === "on";

    await prisma.$transaction(async (tx) => {
      const existing = await tx.clubMembership.findUnique({
        where: {
          clubId_userId: {
            clubId,
            userId,
          },
        },
        select: {
          id: true,
        },
      });

      if (!existing) {
        await tx.clubMembership.create({
          data: {
            userId,
            clubId,
            title,
            isPrimary,
          },
        });
      } else {
        await tx.clubMembership.update({
          where: {
            id: existing.id,
          },
          data: {
            title,
            isPrimary,
          },
        });
      }

      if (isPrimary) {
        await tx.clubMembership.updateMany({
          where: {
            userId,
            clubId: {
              not: clubId,
            },
            isPrimary: true,
          },
          data: {
            isPrimary: false,
          },
        });
      }
    });

    revalidatePath("/admin/users");

    return {
      status: "success",
      message: "Membership saved.",
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to save membership.",
    };
  }
}

export async function resetUserPasswordAction(
  _prevState: AdminCreateFormState,
  formData: FormData,
): Promise<AdminCreateFormState> {
  try {
    const session = await auth();
    ensureSuperAdmin(session?.user?.role);

    const userId = parseRequiredString(formData.get("userId"), "User");
    const newPassword = parseRequiredString(formData.get("newPassword"), "New password");

    if (newPassword.length < 8) {
      throw new Error("New password must be at least 8 characters.");
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        passwordHash,
      },
    });

    revalidatePath("/admin/users");

    return {
      status: "success",
      message: "Password updated.",
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to reset password.",
    };
  }
}
