import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "../lib/supabase/server";

async function signOut() {
  "use server";

  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw new Error(`Unable to sign out: ${error.message}`);
  }

  redirect("/");
}

const linkClass =
  "rounded-md px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-emerald-50 hover:text-emerald-800";

export default async function Navbar() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    throw new Error(`Unable to load the current user: ${authError.message}`);
  }

  let role: "student" | "donor" | "mentor" | null = null;
  if (user) {
    const { data: account, error } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      throw new Error(`Unable to load the user role: ${error.message}`);
    }

    if (
      account?.role === "student" ||
      account?.role === "donor" ||
      account?.role === "mentor"
    ) {
      role = account.role;
    }
  }

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
      <nav
        aria-label="Main navigation"
        className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8"
      >
        <Link
          className="text-base font-bold tracking-tight text-emerald-900 sm:text-lg"
          href="/"
        >
          Micro-Scholarship Hub
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          <Link className={linkClass} href="/explore">
            Explore campaigns
          </Link>
          <Link className={linkClass} href="/mentorship">
            Mentorship
          </Link>
          {user && role === "student" && (
            <Link className={linkClass} href="/dashboard">
              Dashboard
            </Link>
          )}
          {!user && (
            <Link className={linkClass} href="/auth/signup?role=mentor">
              Become a mentor
            </Link>
          )}
        </div>

        <div className="hidden items-center gap-2 md:flex">
          {user ? (
            <>
              <span className="max-w-40 truncate px-2 text-sm text-slate-600">
                {user.user_metadata.full_name ?? user.email}
              </span>
              <form action={signOut}>
                <button
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  type="submit"
                >
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <>
              <Link
                className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:text-emerald-800"
                href="/auth/login"
              >
                Sign in
              </Link>
              <Link
                className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800"
                href="/auth/signup"
              >
                Get started
              </Link>
            </>
          )}
        </div>

        <details className="relative md:hidden">
          <summary className="cursor-pointer list-none rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700">
            Menu
          </summary>
          <div className="absolute right-0 top-12 z-10 flex min-w-56 flex-col gap-1 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
            <Link className={linkClass} href="/explore">
              Explore campaigns
            </Link>
            <Link className={linkClass} href="/mentorship">
              Mentorship
            </Link>
            {user && role === "student" && (
              <Link className={linkClass} href="/dashboard">
                Student dashboard
              </Link>
            )}
            {!user ? (
              <>
                <Link className={linkClass} href="/auth/signup?role=mentor">
                  Become a mentor
                </Link>
                <Link className={linkClass} href="/auth/login">
                  Sign in
                </Link>
                <Link className={linkClass} href="/auth/signup">
                  Get started
                </Link>
              </>
            ) : (
              <form action={signOut}>
                <button
                  className={`${linkClass} w-full text-left`}
                  type="submit"
                >
                  Sign out
                </button>
              </form>
            )}
          </div>
        </details>
      </nav>
    </header>
  );
}
