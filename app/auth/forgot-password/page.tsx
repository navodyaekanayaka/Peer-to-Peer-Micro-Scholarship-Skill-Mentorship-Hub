"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { createClient } from "../../../lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/auth/update-password")}`,
      });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      setSent(true);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to request a password reset.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-lg items-center px-4 py-12">
      <section className="w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
          Account recovery
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
          Reset your password
        </h1>
        {sent ? (
          <p className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-950" role="status">
            If an account is registered with that address, a password reset link is on its way.
          </p>
        ) : (
          <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="mb-1.5 block text-sm font-medium" htmlFor="reset-email">
                Email address
              </label>
              <input
                autoComplete="email"
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
                id="reset-email"
                onChange={(event) => setEmail(event.target.value)}
                required
                type="email"
                value={email}
              />
            </div>
            {errorMessage && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
                {errorMessage}
              </p>
            )}
            <button
              className="w-full rounded-lg bg-emerald-700 px-4 py-3 font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting ? "Sending reset link..." : "Send reset link"}
            </button>
          </form>
        )}
        <p className="mt-6 text-center text-sm text-slate-600">
          Remembered your password?{" "}
          <Link className="font-semibold text-emerald-800 hover:underline" href="/auth/login">
            Sign in
          </Link>
        </p>
      </section>
    </main>
  );
}
