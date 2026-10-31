import Link from "next/link";
import { createClient } from "../../lib/supabase/server";

type SearchParams = Promise<{
  category?: string;
  district?: string;
  urgency?: string;
}>;

type Campaign = {
  id: string;
  student_id: string;
  title: string;
  description: string;
  category: string;
  target_amount_lkr: number;
  deadline: string;
  created_at: string;
};

const categories = [
  { value: "books", label: "Books and learning materials" },
  { value: "exam_fee", label: "Examination fees" },
  { value: "internet_data", label: "Internet and data" },
  { value: "hardware", label: "Learning hardware" },
  { value: "other", label: "Other education need" },
];

function isValidCategory(value: string | undefined) {
  return categories.some((category) => category.value === value);
}

function formatLkr(amount: number) {
  return new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function dateOnly(value: string) {
  return value.slice(0, 10);
}

function districtLabel(value: string | undefined) {
  return value ? `${value} District` : "All districts";
}

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const filters = await searchParams;
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const urgentThrough = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const { data: profileRows, error: profilesError } = await supabase
    .from("student_profiles")
    .select("user_id, district")
    .order("district");

  if (profilesError) {
    throw new Error(`Unable to load district filters: ${profilesError.message}`);
  }

  const districts = [...new Set((profileRows ?? []).map((profile) => profile.district))]
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right));
  const districtProfileIds = filters.district
    ? (profileRows ?? [])
        .filter((profile) => profile.district === filters.district)
        .map((profile) => profile.user_id)
    : null;

  let campaignRows: Campaign[] = [];
  if (districtProfileIds?.length !== 0) {
    let campaignQuery = supabase
      .from("scholarship_requests")
      .select("id, student_id, title, description, category, target_amount_lkr, deadline, created_at")
      .eq("status", "active")
      .gte("deadline", today)
      .order("deadline", { ascending: true })
      .limit(60);

    if (isValidCategory(filters.category)) {
      campaignQuery = campaignQuery.eq("category", filters.category);
    }
    if (districtProfileIds) {
      campaignQuery = campaignQuery.in("student_id", districtProfileIds);
    }
    if (filters.urgency === "urgent") {
      campaignQuery = campaignQuery.lte("deadline", urgentThrough);
    }

    const { data, error } = await campaignQuery;
    if (error) {
      throw new Error(`Unable to load campaigns: ${error.message}`);
    }
    campaignRows = (data ?? []) as Campaign[];
  }

  const campaigns = campaignRows;
  const studentIds = [...new Set(campaigns.map((campaign) => campaign.student_id))];
  const [
    { data: profiles, error: profileError },
    { data: users, error: usersError },
    { data: totals, error: totalsError },
  ] = studentIds.length
    ? await Promise.all([
        supabase
          .from("student_profiles")
          .select("user_id, district, is_verified")
          .in("user_id", studentIds),
        supabase.from("users").select("id, full_name").in("id", studentIds),
        supabase
          .from("request_fundraising_totals")
          .select("request_id, raised_amount_lkr")
          .in("request_id", campaigns.map((campaign) => campaign.id)),
      ])
    : [
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
      ];

  if (profileError) {
    throw new Error(`Unable to load student profiles: ${profileError.message}`);
  }
  if (usersError) {
    throw new Error(`Unable to load student names: ${usersError.message}`);
  }
  if (totalsError) {
    throw new Error(`Unable to load campaign progress: ${totalsError.message}`);
  }

  const profilesByUser = new Map(
    (profiles ?? []).map((profile) => [profile.user_id, profile] as const),
  );
  const namesByUser = new Map(
    (users ?? []).map((user) => [user.id, user.full_name] as const),
  );
  const totalsByCampaign = new Map(
    (totals ?? []).map(
      (total) => [total.request_id, Number(total.raised_amount_lkr)] as const,
    ),
  );
  const selectedDistrict = districts.includes(filters.district ?? "")
    ? filters.district
    : undefined;

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:py-14">
      <header className="max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
          Direct student support
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
          Explore student campaigns
        </h1>
        <p className="mt-3 text-slate-600">
          Discover education needs from students across Sri Lanka and support a request directly.
        </p>
      </header>

      <form
        action="/explore"
        className="mt-8 grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto]"
      >
        <div>
          <label className="mb-1.5 block text-sm font-medium" htmlFor="category">
            Category
          </label>
          <select
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5"
            defaultValue={isValidCategory(filters.category) ? filters.category : ""}
            id="category"
            name="category"
          >
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category.value} value={category.value}>
                {category.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium" htmlFor="district">
            District
          </label>
          <select
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5"
            defaultValue={selectedDistrict ?? ""}
            id="district"
            name="district"
          >
            <option value="">All districts</option>
            {districts.map((district) => (
              <option key={district} value={district}>
                {district}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium" htmlFor="urgency">
            Deadline
          </label>
          <select
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5"
            defaultValue={filters.urgency === "urgent" ? "urgent" : ""}
            id="urgency"
            name="urgency"
          >
            <option value="">Any upcoming date</option>
            <option value="urgent">Urgent (within 7 days)</option>
          </select>
        </div>
        <div className="flex items-end gap-2">
          <button
            className="flex-1 rounded-lg bg-emerald-700 px-4 py-2.5 font-semibold text-white hover:bg-emerald-800"
            type="submit"
          >
            Apply filters
          </button>
          <Link
            className="rounded-lg border border-slate-300 px-4 py-2.5 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50"
            href="/explore"
          >
            Clear
          </Link>
        </div>
      </form>

      <div className="mt-8 flex items-center justify-between gap-4">
        <p className="text-sm text-slate-600">
          Showing {campaigns.length} {campaigns.length === 1 ? "campaign" : "campaigns"}
          {selectedDistrict ? ` in ${districtLabel(selectedDistrict)}` : ""}
        </p>
        <Link
          className="text-sm font-semibold text-emerald-800 hover:underline"
          href="/mentorship"
        >
          Explore mentorship &rarr;
        </Link>
      </div>

      {campaigns.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <h2 className="text-lg font-semibold text-slate-950">No campaigns match these filters</h2>
          <p className="mt-2 text-slate-600">Try another category or district, or check back soon.</p>
        </div>
      ) : (
        <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {campaigns.map((campaign) => {
            const profile = profilesByUser.get(campaign.student_id);
            const raised = totalsByCampaign.get(campaign.id) ?? 0;
            const target = Number(campaign.target_amount_lkr);
            const progress = target > 0 ? Math.min(100, Math.round((raised / target) * 100)) : 0;
            const urgent = dateOnly(campaign.deadline) <= urgentThrough;

            return (
              <article
                className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                key={campaign.id}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-900">
                    {categories.find((category) => category.value === campaign.category)?.label ??
                      campaign.category}
                  </span>
                  {urgent && (
                    <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900">
                      Urgent
                    </span>
                  )}
                  {profile?.is_verified && (
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800">
                      Verified student
                    </span>
                  )}
                </div>
                <h2 className="mt-4 text-xl font-bold text-slate-950">
                  <Link className="hover:text-emerald-800" href={`/requests/${campaign.id}`}>
                    {campaign.title}
                  </Link>
                </h2>
                <p className="mt-2 line-clamp-3 flex-1 text-sm leading-6 text-slate-600">
                  {campaign.description}
                </p>
                <p className="mt-4 text-sm text-slate-600">
                  {namesByUser.get(campaign.student_id) ?? "Sri Lankan student"}
                  {profile?.district ? ` · ${profile.district} District` : ""}
                </p>
                <div className="mt-4">
                  <div className="flex justify-between gap-3 text-sm">
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
                  <p className="mt-2 text-xs text-slate-500">
                    Needed by{" "}
                    {new Intl.DateTimeFormat("en-LK", { dateStyle: "medium" }).format(
                      new Date(`${dateOnly(campaign.deadline)}T00:00:00`),
                    )}
                  </p>
                </div>
                <Link
                  className="mt-5 rounded-lg border border-emerald-700 px-4 py-2.5 text-center text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50"
                  href={`/requests/${campaign.id}`}
                >
                  View campaign
                </Link>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}
