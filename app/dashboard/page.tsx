import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import MilestoneForm from "../../components/MilestoneForm";
import { createClient } from "../../lib/supabase/server";

export const metadata: Metadata = {
  title: "Student dashboard",
};

type StudentRequest = {
  id: string;
  title: string;
  status: "pending" | "active" | "funded" | "completed";
  target_amount_lkr: number;
  deadline: string;
  created_at: string;
};

type DonationTotal = {
  request_id: string;
  raised_amount_lkr: number;
};

type UpdateRow = {
  id: string;
  request_id: string;
  title: string;
  created_at: string;
};

const statusClass: Record<StudentRequest["status"], string> = {
  pending: "bg-amber-50 text-amber-900",
  active: "bg-emerald-50 text-emerald-900",
  funded: "bg-blue-50 text-blue-900",
  completed: "bg-slate-100 text-slate-700",
};

const statusLabel: Record<StudentRequest["status"], string> = {
  pending: "Awaiting review",
  active: "Active",
  funded: "Funded",
  completed: "Completed",
};

function formatLkr(amount: number) {
  return new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-LK", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(`${value.slice(0, 10)}T00:00:00Z`));
}

export default async function StudentDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    throw new Error(`Unable to verify your sign-in: ${authError.message}`);
  }
  if (!user) {
    redirect("/auth/login?next=%2Fdashboard");
  }

  const { data: account, error: accountError } = await supabase
    .from("users")
    .select("full_name, role")
    .eq("id", user.id)
    .maybeSingle();

  if (accountError) {
    throw new Error(`Unable to load your account: ${accountError.message}`);
  }
  if (account?.role !== "student") {
    redirect("/");
  }

  const { data: requestRows, error: requestsError } = await supabase
    .from("scholarship_requests")
    .select("id, title, status, target_amount_lkr, deadline, created_at")
    .eq("student_id", user.id)
    .order("created_at", { ascending: false });

  if (requestsError) {
    throw new Error(`Unable to load your requests: ${requestsError.message}`);
  }

  const requests = (requestRows ?? []) as StudentRequest[];
  const requestIds = requests.map((request) => request.id);
  let totals: DonationTotal[] = [];
  let updates: UpdateRow[] = [];

  if (requestIds.length > 0) {
    const [
      { data: totalsData, error: totalsError },
      { data: updatesData, error: updatesError },
    ] = await Promise.all([
      supabase
        .from("request_fundraising_totals")
        .select("request_id, raised_amount_lkr")
        .in("request_id", requestIds),
      supabase
        .from("milestones")
        .select("id, request_id, title, created_at")
        .in("request_id", requestIds)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    if (totalsError) {
      throw new Error(`Unable to load your donation totals: ${totalsError.message}`);
    }
    if (updatesError) {
      throw new Error(`Unable to load your campaign updates: ${updatesError.message}`);
    }

    totals = (totalsData ?? []) as DonationTotal[];
    updates = (updatesData ?? []) as UpdateRow[];
  }

  const raisedByRequest = new Map(
    totals.map((total) => [total.request_id, Number(total.raised_amount_lkr)] as const),
  );
  const requestsById = new Map(requests.map((request) => [request.id, request] as const));
  const totalRaised = totals.reduce(
    (sum, total) => sum + Number(total.raised_amount_lkr),
    0,
  );

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:py-14">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
            Student dashboard
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
            Welcome, {account.full_name}
          </h1>
          <p className="mt-2 text-slate-600">
            Track support, manage your campaigns, and share progress with supporters.
          </p>
        </div>
        <Link
          className="rounded-lg bg-emerald-700 px-4 py-3 text-center font-semibold text-white hover:bg-emerald-800"
          href="/requests/new"
        >
          Create a request
        </Link>
      </header>

      <section aria-label="Your scholarship summary" className="mt-8 grid gap-4 sm:grid-cols-3">
        {[
          { label: "Campaigns", value: String(requests.length) },
          {
            label: "Total raised",
            value: formatLkr(totalRaised),
          },
          {
            label: "Active campaigns",
            value: String(requests.filter((request) => request.status === "active").length),
          },
        ].map((item) => (
          <article className="rounded-2xl border border-slate-200 bg-white p-5" key={item.label}>
            <p className="text-sm text-slate-600">{item.label}</p>
            <p className="mt-2 text-2xl font-bold text-slate-950">{item.value}</p>
          </article>
        ))}
      </section>

      <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(18rem,0.8fr)]">
        <section aria-labelledby="requests-heading">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-bold text-slate-950" id="requests-heading">
              Your campaigns
            </h2>
            <Link className="text-sm font-semibold text-emerald-800 hover:underline" href="/explore">
              Explore campaigns
            </Link>
          </div>

          {requests.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
              <h3 className="font-semibold text-slate-950">Your first request starts here</h3>
              <p className="mt-2 text-sm text-slate-600">
                Tell the community what education support would help you continue learning.
              </p>
              <Link
                className="mt-4 inline-flex rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800"
                href="/requests/new"
              >
                Create a request
              </Link>
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              {requests.map((request) => {
                const raised = raisedByRequest.get(request.id) ?? 0;
                const target = Number(request.target_amount_lkr);
                const progress =
                  target > 0 ? Math.min(100, Math.round((raised / target) * 100)) : 0;

                return (
                  <article className="rounded-2xl border border-slate-200 bg-white p-5" key={request.id}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-slate-950">
                          <Link className="hover:text-emerald-800" href={`/requests/${request.id}`}>
                            {request.title}
                          </Link>
                        </h3>
                        <p className="mt-1 text-sm text-slate-500">
                          Deadline {formatDate(request.deadline)}
                        </p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass[request.status]}`}>
                        {statusLabel[request.status]}
                      </span>
                    </div>

                    <div className="mt-4 flex justify-between gap-3 text-sm">
                      <span className="font-semibold text-slate-950">{formatLkr(raised)} raised</span>
                      <span className="text-slate-600">of {formatLkr(target)}</span>
                    </div>
                    <div
                      aria-label={`${progress}% of target raised`}
                      aria-valuemax={100}
                      aria-valuemin={0}
                      aria-valuenow={progress}
                      className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100"
                      role="progressbar"
                    >
                      <div className="h-full rounded-full bg-emerald-600" style={{ width: `${progress}%` }} />
                    </div>
                    <p className="mt-2 text-xs text-slate-500">Created {formatDate(request.created_at)}</p>
                  </article>
                );
              })}
            </div>
          )}

          <section aria-labelledby="recent-updates-heading" className="mt-8">
            <h2 className="text-xl font-bold text-slate-950" id="recent-updates-heading">
              Recent updates
            </h2>
            {updates.length === 0 ? (
              <p className="mt-3 rounded-xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-600">
                Your progress updates will appear here.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
                {updates.map((update) => (
                  <li className="flex items-center justify-between gap-4 p-4" key={update.id}>
                    <div>
                      <p className="font-medium text-slate-900">{update.title}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {requestsById.get(update.request_id)?.title ?? "Campaign"} ·{" "}
                        {formatDate(update.created_at)}
                      </p>
                    </div>
                    <Link
                      className="shrink-0 text-sm font-semibold text-emerald-800 hover:underline"
                      href={`/requests/${update.request_id}`}
                    >
                      View
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </section>

        <aside className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <h2 className="text-xl font-bold text-slate-950">Share a progress update</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Keep supporters informed. You can optionally attach a receipt or progress document.
          </p>
          <div className="mt-5">
            <MilestoneForm
              requests={requests.map(({ id, title }) => ({ id, title }))}
            />
          </div>
        </aside>
      </div>
    </main>
  );
}
