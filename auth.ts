import { UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import {
  assertLoginRateLimit,
  clearFailedLoginAttempts,
  getRateLimitKey,
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

        if (!email || !password) {
          return null;
        }

        const key = getRateLimitKey(email, request?.headers?.get("x-forwarded-for"));
        assertLoginRateLimit(key);

        const user = await prisma.user.findUnique({
          where: {
            email,
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
          recordFailedLoginAttempt(key);
          return null;
        }

        const passwordMatches = await bcrypt.compare(
          password,
          user.passwordHash,
        );

        if (!passwordMatches) {
          recordFailedLoginAttempt(key);
          return null;
        }

        clearFailedLoginAttempts(key);

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
