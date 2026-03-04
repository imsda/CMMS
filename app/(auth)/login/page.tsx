import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";

import { signIn } from "../../../auth";

type LoginPageProps = {
  searchParams?: {
    error?: string;
  };
};

function getErrorMessage(error?: string) {
  if (!error) {
    return "";
  }

  if (error === "CredentialsSignin") {
    return "Invalid email or password. Please try again.";
  }

  return "Unable to sign in right now. Please try again.";
}

export default function LoginPage({ searchParams }: LoginPageProps) {
  const errorMessage = getErrorMessage(searchParams?.error);

  async function authenticate(formData: FormData) {
    "use server";

    const email = formData.get("email");
    const password = formData.get("password");

    if (typeof email !== "string" || typeof password !== "string") {
      return;
    }

    try {
      await signIn("credentials", {
        email,
        password,
        redirectTo: "/",
      });
    } catch (error) {
      if (error instanceof AuthError) {
        if (error.type === "CredentialsSignin") {
          redirect("/login?error=CredentialsSignin");
        }
      }

      throw error;
    }
  }

  return (
    <div className="mx-auto flex min-h-[75vh] w-full max-w-md items-center">
      <div className="w-full rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-indigo-600">
            Iowa-Missouri Conference
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">Welcome back</h2>
          <p className="mt-2 text-sm text-slate-600">
            Sign in to manage rosters, event registrations, and class scheduling.
          </p>
        </div>

        <form action={authenticate} className="mt-6 space-y-4">
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              placeholder="director@club.org"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              placeholder="Enter your password"
            />
          </div>

          {errorMessage ? (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {errorMessage}
            </p>
          ) : null}

          <button
            type="submit"
            className="w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500"
          >
            Sign in
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-slate-500">
          Need to return to dashboard shell?{" "}
          <Link href="/" className="font-medium text-indigo-600 hover:text-indigo-500">
            Go home
          </Link>
        </p>
      </div>
    </div>
  );
}
