import { UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import {
  assertLoginAllowed,
  clearFailedLoginAttempts,
  getClientIpFromHeaders,
  normalizeEmailAddress,
  recordFailedLoginAttempt,
} from "./lib/auth-rate-limit";
import { prisma } from "./lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "Email and Password",
      credentials: {
        email: {
          label: "Email",
          type: "email",
        },
        password: {
          label: "Password",
          type: "password",
        },
      },
      async authorize(credentials, request) {
        const email = typeof credentials?.email === "string" ? credentials.email.trim() : "";
        const password = typeof credentials?.password === "string" ? credentials.password : "";
        const normalizedEmail = normalizeEmailAddress(email);
        const clientIp = getClientIpFromHeaders(request.headers);

        if (!normalizedEmail || !password) {
          return null;
        }

        await assertLoginAllowed(normalizedEmail, clientIp);

        const user = await prisma.user.findFirst({
          where: {
            email: {
              equals: normalizedEmail,
              mode: "insensitive",
            },
          },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            passwordHash: true,
            memberships: {
              where: {
                isPrimary: true,
              },
              select: {
                clubId: true,
              },
              take: 1,
            },
          },
        });

        if (!user?.passwordHash) {
          await recordFailedLoginAttempt(normalizedEmail, clientIp);
          return null;
        }

        const passwordMatches = await bcrypt.compare(
          password,
          user.passwordHash,
        );

        if (!passwordMatches) {
          await recordFailedLoginAttempt(normalizedEmail, clientIp);
          return null;
        }

        await clearFailedLoginAttempts(normalizedEmail, clientIp);

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          clubId: user.memberships[0]?.clubId ?? null,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role as UserRole;
        token.clubId = user.clubId ?? null;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as UserRole;
        session.user.clubId = (token.clubId as string | null) ?? null;
      }

      return session;
    },
  },
});
