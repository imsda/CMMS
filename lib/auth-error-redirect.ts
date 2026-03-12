import { AuthError } from "next-auth";

export function buildLoginErrorRedirectPath(error: AuthError) {
  const params = new URLSearchParams({
    error: error.type,
  });
  const code = "code" in error && typeof error.code === "string" ? error.code : null;

  if (code) {
    params.set("code", code);
  }

  return `/login?${params.toString()}`;
}
