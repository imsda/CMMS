import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";

import { auth, signOut } from "../auth";

import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Iowa-Missouri Club Management",
  description:
    "Conference-wide platform for yearly roster management, event registration, and class scheduling.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  const isLoggedIn = Boolean(session?.user);

  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="min-h-screen bg-slate-50">
          <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
            <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-indigo-600">
                  Iowa-Missouri Conference
                </p>
                <h1 className="text-lg font-semibold text-slate-900">
                  Club Management & Event Registration
                </h1>
              </div>

              {isLoggedIn ? (
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-900">{session?.user.name}</p>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      {session?.user.role.replaceAll("_", " ")}
                    </p>
                  </div>
                  <form
                    action={async () => {
                      "use server";
                      await signOut({ redirectTo: "/login" });
                    }}
                  >
                    <button
                      type="submit"
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-indigo-300 hover:text-indigo-700"
                    >
                      Sign out
                    </button>
                  </form>
                </div>
              ) : (
                <Link
                  href="/login"
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-indigo-300 hover:text-indigo-700"
                >
                  Sign in
                </Link>
              )}
            </div>
          </header>
          <main className="mx-auto w-full max-w-7xl px-6 py-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
