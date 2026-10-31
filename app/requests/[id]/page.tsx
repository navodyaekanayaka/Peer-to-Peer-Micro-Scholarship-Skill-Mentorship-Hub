import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import CampaignTabs from "../../../components/CampaignTabs";
import DonateModal from "../../../components/DonateModal";
import MilestoneTracker, {
  type CampaignMilestone,
} from "../../../components/MilestoneTracker";
import { createAdminClient } from "../../../lib/supabase/admin";
import { createClient } from "../../../lib/supabase/server";

type RequestStatus = "pending" | "active" | "funded" | "completed";

type ScholarshipRequest = {
  id: string;
  student_id: string;
  title: string;
  description: string;
  category: string;
  target_amount_lkr: number;
  cost_breakdown: string;
  deadline: string;
  proof_document_path: string | null;
  status: RequestStatus;
  created_at: string;
};

type MilestoneRecord = {
  id: string;
  title: string;
  description: string;
  receipt_path: string | null;
  is_completed: boolean;
  is_verified: boolean;
  created_at: string;
};

const categoryLabels: Record<string, string> = {
  books: "Books and learning materials",
  exam_fee: "Examination fees",
  internet_data: "Internet and data",
  hardware: "Learning hardware",
  other: "Other education need",
};

const statusLabels: Record<RequestStatus, string> = {
  pending: "Awaiting review",
  active: "Accepting support",
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
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(`${value.slice(0, 10)}T00:00:00Z`));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("scholarship_requests")
    .select("title")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to load campaign metadata: ${error.message}`);
  }

  return { title: data?.title ?? "Campaign" };
}

export default async function RequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    throw new Error(`Unable to verify your session: ${authError.message}`);
  }

  const { data: requestData, error: requestError } = await supabase
    .from("scholarship_requests")
    .select(
      "id, student_id, title, description, category, target_amount_lkr, cost_breakdown, deadline, proof_document_path, status, created_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (requestError) {
    throw new Error(`Unable to load this campaign: ${requestError.message}`);
  }
  if (!requestData) {
    notFound();
  }

  const request = requestData as ScholarshipRequest;
  const isOwner = user?.id === request.student_id;
  if (request.status === "pending" && !isOwner) {
    notFound();
  }

  let canDonate = false;
  if (user) {
    const { data: account, error: accountError } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (accountError) {
      throw new Error(`Unable to load your account role: ${accountError.message}`);
    }
    canDonate = account?.role === "donor";
  }

  const [
    { data: student, error: studentError },
    { data: profile, error: profileError },
    { data: milestonesData, error: milestonesError },
    { data: totals, error: totalsError },
  ] = await Promise.all([
    supabase
      .from("users")
      .select("full_name")
      .eq("id", request.student_id)
      .maybeSingle(),
    supabase
      .from("student_profiles")
      .select("district, school_name, education_level, is_verified")
      .eq("user_id", request.student_id)
      .maybeSingle(),
    supabase
      .from("milestones")
      .select("id, title, description, receipt_path, is_completed, is_verified, created_at")
      .eq("request_id", request.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("request_fundraising_totals")
      .select("raised_amount_lkr")
      .eq("request_id", request.id)
      .maybeSingle(),
  ]);

  if (studentError) {
    throw new Error(`Unable to load student details: ${studentError.message}`);
  }
  if (profileError) {
    throw new Error(`Unable to load student verification: ${profileError.message}`);
  }
  if (milestonesError) {
    throw new Error(`Unable to load campaign updates: ${milestonesError.message}`);
  }
  if (totalsError) {
    throw new Error(`Unable to load campaign donations: ${totalsError.message}`);
  }

  const milestoneRecords = (milestonesData ?? []) as MilestoneRecord[];
  let milestones: CampaignMilestone[] = milestoneRecords.map((milestone) => ({
    id: milestone.id,
    title: milestone.title,
    description: milestone.description,
    createdAt: milestone.created_at,
    receiptUrl: null,
    isCompleted: milestone.is_completed,
    isVerified: milestone.is_verified,
  }));
  const receiptRecords = milestoneRecords.filter(
    (milestone): milestone is MilestoneRecord & { receipt_path: string } =>
      milestone.receipt_path !== null,
  );

  if (receiptRecords.length > 0) {
    const admin = createAdminClient();
    const signedReceipts = await Promise.all(
      receiptRecords.map(async (milestone) => {
        const { data, error } = await admin.storage
          .from("milestone-receipts")
          .createSignedUrl(milestone.receipt_path, 60 * 30);

        if (error) {
          throw new Error(`Unable to create a private receipt link: ${error.message}`);
        }

        return [milestone.id, data.signedUrl] as const;
      }),
    );
    const receiptUrlByMilestone = new Map(signedReceipts);
    milestones = milestones.map((milestone) => ({
      ...milestone,
      receiptUrl: receiptUrlByMilestone.get(milestone.id) ?? null,
    }));
  }
  const targetAmount = Number(request.target_amount_lkr);
  const raisedAmount = Math.max(0, Number(totals?.raised_amount_lkr ?? 0));
  const progressPercent =
    targetAmount > 0 ? Math.min(100, Math.round((raisedAmount / targetAmount) * 100)) : 0;
  const canAcceptDonations =
    request.status === "active" && raisedAmount < targetAmount;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:py-14">
      <Link className="text-sm font-medium text-emerald-800 hover:underline" href="/explore">
        &larr; Explore campaigns
      </Link>

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <article className="space-y-8">
          <header>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-900">
                {categoryLabels[request.category] ?? request.category}
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
                {statusLabels[request.status]}
              </span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
              {request.title}
            </h1>
            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-slate-600">
              <span>
                Shared by <strong className="font-semibold text-slate-900">{student?.full_name ?? "Sri Lankan student"}</strong>
              </span>
              {profile?.district && <span>&middot; {profile.district} District</span>}
              {profile?.education_level && <span>&middot; {profile.education_level}</span>}
              {profile?.is_verified && (
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 font-semibold text-blue-800">
                  <span aria-hidden="true">✓</span> Verified student
                </span>
              )}
              {profile?.school_name && <span>&middot; {profile.school_name}</span>}
            </div>
          </header>

          <CampaignTabs
            overview={
              <section aria-labelledby="story-heading" className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
                <h2 className="text-lg font-semibold text-slate-950" id="story-heading">
                  Campaign overview
                </h2>
                <p className="mt-4 whitespace-pre-wrap leading-7 text-slate-700">
                  {request.description}
                </p>
                {request.cost_breakdown && (
                  <div className="mt-6">
                    <h3 className="font-semibold text-slate-950">Cost breakdown</h3>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                      {request.cost_breakdown}
                    </p>
                  </div>
                )}
                <p className="mt-6 text-sm text-slate-500">
                  Requested on {formatDate(request.created_at)} · Target deadline {formatDate(request.deadline)}
                </p>
              </section>
            }
            proofs={
              <section aria-labelledby="proofs-heading" className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
                <h2 className="text-lg font-semibold text-slate-950" id="proofs-heading">
                  Verification documents
                </h2>
                {request.proof_document_path ? (
                  <div className="mt-4 rounded-xl bg-slate-50 p-4">
                    <p className="font-medium text-slate-900">
                      Supporting document received
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      Admission cards, student IDs, and other identity documents are stored
                      privately and are not displayed publicly to protect student information.
                    </p>
                  </div>
                ) : (
                  <p className="mt-4 text-slate-600">
                    No supporting document is attached to this request.
                  </p>
                )}
                {profile?.is_verified && (
                  <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-800">
                    <span aria-hidden="true">✓</span> Student profile verified
                  </p>
                )}
                {profile?.school_name && (
                  <p className="mt-4 text-sm text-slate-700">
                    Institution: <span className="font-medium">{profile.school_name}</span>
                  </p>
                )}
              </section>
            }
            updates={<MilestoneTracker milestones={milestones} />}
          />
        </article>

        <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:sticky lg:top-24">
          <p className="text-sm font-medium text-slate-600">Fundraising progress</p>
          <p className="mt-2 text-2xl font-bold text-slate-950">{formatLkr(raisedAmount)}</p>
          <p className="mt-1 text-sm text-slate-600">
            raised of {formatLkr(targetAmount)}
          </p>
          <div
            aria-label={`${progressPercent}% of target raised`}
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={progressPercent}
            className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100"
            role="progressbar"
          >
            <div
              className="h-full rounded-full bg-emerald-600 transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="mt-2 text-right text-sm font-semibold text-emerald-800">
            {progressPercent}% funded
          </p>

          {canAcceptDonations && !user ? (
            <Link
              className="mt-6 block rounded-lg bg-emerald-700 px-4 py-3 text-center font-semibold text-white transition hover:bg-emerald-800"
              href={`/auth/signup?role=donor&next=${encodeURIComponent(`/requests/${request.id}`)}`}
            >
              Donate Now
            </Link>
          ) : canAcceptDonations && canDonate ? (
            <DonateModal
              remainingLkr={Math.max(0, targetAmount - raisedAmount)}
              requestId={request.id}
              requestTitle={request.title}
            />
          ) : canAcceptDonations ? (
            <p className="mt-6 rounded-lg bg-slate-100 px-4 py-3 text-center text-sm font-medium text-slate-600">
              Sign in with a donor account to support this campaign.
            </p>
          ) : (
            <p className="mt-6 rounded-lg bg-slate-100 px-4 py-3 text-center text-sm font-medium text-slate-600">
              {request.status === "pending"
                ? "This request is awaiting review before it can receive donations."
                : request.status === "funded"
                  ? "This request has reached its funding goal."
                  : request.status === "completed"
                    ? "This campaign is complete."
                    : "This campaign has met its funding target."}
            </p>
          )}
          <p className="mt-4 text-xs leading-5 text-slate-500">
            Donations are recorded after payment is confirmed. Updates help supporters follow progress.
          </p>
        </aside>
      </div>
    </main>
  );
}
