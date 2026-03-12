import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";

import { signIn } from "../../../auth";
import { buildLoginErrorRedirectPath } from "../../../lib/auth-error-redirect";

type LoginPageProps = {
  searchParams?: Promise<{
    error?: string;
    code?: string;
  }>;
};

function getErrorMessage(error?: string, code?: string) {
  if (!error) {
    return "";
  }

  if (error === "CredentialsSignin") {
    if (code === "rate_limited") {
      return "Too many sign-in attempts. Please wait a few minutes and try again.";
    }

    return "Invalid email or password. Please try again.";
  }

  return "Unable to sign in right now. Please try again.";
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const resolvedSearchParams = await searchParams;
  const errorMessage = getErrorMessage(resolvedSearchParams?.error, resolvedSearchParams?.code);

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
          redirect(buildLoginErrorRedirectPath(error));
        }
      }

      throw error;
    }
  }

  return (
    <div className="mx-auto flex min-h-[78vh] w-full max-w-6xl items-center justify-center">
      <div className="grid w-full max-w-5xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="glass-panel hidden lg:flex lg:flex-col lg:justify-between">
          <div>
            <p className="hero-kicker">Conference Platform</p>
            <h1 className="hero-title mt-3">Calm, clearer workflows for every club and event.</h1>
            <p className="hero-copy">
              Manage rosters, registrations, attendance, compliance, and reporting from one
              refined workspace with safer server-side controls already in place.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="glass-card-soft">
              <p className="metric-label">Roster Readiness</p>
              <p className="mt-3 text-2xl font-semibold text-slate-950">Encrypted</p>
              <p className="mt-2 text-sm text-slate-600">Sensitive medical data stays protected at rest.</p>
            </div>
            <div className="glass-card-soft">
              <p className="metric-label">Registration State</p>
              <p className="mt-3 text-2xl font-semibold text-slate-950">Guarded</p>
              <p className="mt-2 text-sm text-slate-600">Draft, submit, and approval rules stay enforced server-side.</p>
            </div>
            <div className="glass-card-soft">
              <p className="metric-label">Class Flow</p>
              <p className="mt-3 text-2xl font-semibold text-slate-950">Aligned</p>
              <p className="mt-2 text-sm text-slate-600">Attendance, enrollment, and check-in stay separated correctly.</p>
            </div>
          </div>
        </section>

        <div className="glass-panel mx-auto w-full max-w-md p-8 sm:p-9">
          <div>
            <p className="hero-kicker">
            Iowa-Missouri Conference
          </p>
            <h2 className="hero-title mt-3 text-[2.4rem]">Welcome back</h2>
            <p className="hero-copy">
              Sign in to manage rosters, event registrations, attendance, and class operations.
            </p>
          </div>

          <form action={authenticate} className="mt-8 space-y-5">
            <div>
              <label htmlFor="email" className="field-label">
              Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                className="input-glass"
                placeholder="director@club.org"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="field-label"
              >
              Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className="input-glass"
                placeholder="Enter your password"
              />
            </div>

            {errorMessage ? (
              <p className="alert-danger">
                {errorMessage}
              </p>
            ) : null}

            <button
              type="submit"
              className="btn-primary w-full"
            >
              Sign in
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            Need to return to dashboard shell?{" "}
            <Link href="/" className="font-medium text-indigo-600 hover:text-indigo-500">
              Go home
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
