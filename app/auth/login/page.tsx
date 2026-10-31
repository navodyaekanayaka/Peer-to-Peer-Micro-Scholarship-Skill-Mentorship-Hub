"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";

function getSafeNextPath() {
  const nextPath = new URLSearchParams(window.location.search).get("next");
  if (!nextPath) {
    return "/";
  }

  const destination = new URL(nextPath, window.location.origin);
  if (destination.origin !== window.location.origin) {
    return "/";
  }

  return `${destination.pathname}${destination.search}${destination.hash}`;
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.has("error")) {
      setErrorMessage("Sign-in could not be completed. Please try again.");
    }
    if (searchParams.get("password_updated") === "1") {
      setSuccessMessage("Your password has been updated. Sign in with your new password.");
    }
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      router.replace(getSafeNextPath());
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to sign in.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleGoogleSignIn() {
    setErrorMessage("");
    setIsGoogleLoading(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(getSafeNextPath())}`,
        },
      });

      if (error) {
        setErrorMessage(error.message);
        setIsGoogleLoading(false);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to start Google sign-in.",
      );
      setIsGoogleLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-lg items-center px-4 py-12">
      <section className="w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
            Welcome back
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
            Sign in to your account
          </h1>
        </div>

        <button
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-3 font-semibold text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isGoogleLoading || isSubmitting}
          onClick={handleGoogleSignIn}
          type="button"
        >
          {isGoogleLoading ? "Connecting to Google..." : "Continue with Google"}
        </button>

        <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-wide text-slate-400">
          <span className="h-px flex-1 bg-slate-200" />
          or continue with email
          <span className="h-px flex-1 bg-slate-200" />
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div>
            <label
              className="mb-1.5 block text-sm font-medium text-slate-900"
              htmlFor="email"
            >
              Email address
            </label>
            <input
              autoComplete="email"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-950 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
              id="email"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </div>
          <div>
            <label
              className="mb-1.5 block text-sm font-medium text-slate-900"
              htmlFor="password"
            >
              Password
            </label>
            <input
              autoComplete="current-password"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-950 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
              id="password"
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
            <div className="mt-2 text-right">
              <Link
                className="text-sm font-medium text-emerald-800 hover:underline"
                href="/auth/forgot-password"
              >
                Forgot password?
              </Link>
            </div>
          </div>

          {errorMessage && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
              {errorMessage}
            </p>
          )}
          {successMessage && (
            <p
              className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900"
              role="status"
            >
              {successMessage}
            </p>
          )}

          <button
            className="w-full rounded-lg bg-emerald-700 px-4 py-3 font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting || isGoogleLoading}
            type="submit"
          >
            {isSubmitting ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-600">
          New to the community?{" "}
          <Link className="font-semibold text-emerald-800 hover:underline" href="/auth/signup">
            Create an account
          </Link>
        </p>
      </section>
    </main>
  );
}
