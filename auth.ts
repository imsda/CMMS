import { UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { prisma } from "./lib/prisma";

/**
 * Extend the built-in NextAuth types so that `session.user.id` and
 * `session.user.role` are recognised by TypeScript everywhere `auth()` is
 * called.  Without this augmentation the compiler reports a type error
 * because the default `Session` interface only contains `name`, `email`
 * and `image`.
 */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
    } & DefaultSession["user"];
  }

  // The shape returned by `authorize()` — also used internally by NextAuth.
  interface User {
    id?: string;
    role: UserRole;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: UserRole;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
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
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: {
            email: credentials.email as string,
          },
        });

        if (!user?.passwordHash) {
          return null;
        }

        const passwordMatches = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash,
        );

        if (!passwordMatches) {
          return null;
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // `user` is only present on the first sign-in; persist custom fields
      // into the JWT so they survive between requests.
      if (user) {
        token.id = user.id as string;
        token.role = user.role;
      }

      return token;
    },
    async session({ session, token }) {
      // Copy the custom JWT fields into the session object that is exposed
      // to client components and server actions via `auth()`.
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
      }

      return session;
    },
  },
});
