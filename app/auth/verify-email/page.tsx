import Link from "next/link";

type VerifyEmailPageProps = {
  searchParams: Promise<{ confirmed?: string; ready?: string }>;
};

export default async function VerifyEmailPage({
  searchParams,
}: VerifyEmailPageProps) {
  const { confirmed, ready } = await searchParams;

  return (
    <main className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-lg items-center px-4 py-12">
      <section className="w-full rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm sm:p-10">
        <div
          aria-hidden="true"
          className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl text-emerald-800"
        >
          {confirmed === "1" ? "✓" : "✉"}
        </div>
        <h1 className="mt-5 text-2xl font-bold tracking-tight text-slate-950">
          {confirmed === "1"
            ? "Email confirmed"
            : ready === "1"
              ? "Account created"
              : "Check your email"}
        </h1>
        <p className="mt-3 leading-7 text-slate-600">
          {confirmed === "1"
            ? "Your email address is confirmed. You can now sign in to your Impact Lanka account."
            : ready === "1"
              ? "Your account is ready. Sign in to continue to Impact Lanka."
              : "If the address can be registered, we have sent a confirmation link. Open it to verify your email and finish creating your account."}
        </p>
        <Link
          className="mt-6 inline-flex rounded-lg bg-emerald-700 px-5 py-3 font-semibold text-white transition hover:bg-emerald-800"
          href="/auth/login"
        >
          Continue to sign in
        </Link>
      </section>
    </main>
  );
}
