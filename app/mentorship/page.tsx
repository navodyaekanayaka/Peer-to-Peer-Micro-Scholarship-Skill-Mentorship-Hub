import Link from "next/link";
import MentorshipBookingCalendar, {
  type AvailableMentorshipSlot,
} from "../../components/MentorshipBookingCalendar";
import { createClient } from "../../lib/supabase/server";

type MentorProfile = {
  user_id: string;
  headline: string;
  bio: string;
  expertise: string[];
  organization: string | null;
};

type MentorshipSlot = {
  id: string;
  mentor_id: string;
  starts_at: string;
  ends_at: string;
};

function getColomboDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Colombo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export default async function MentorshipPage() {
  const supabase = await createClient();
  const now = new Date();
  const twoMonthsFromNow = new Date(now);
  twoMonthsFromNow.setDate(twoMonthsFromNow.getDate() + 60);

  const { data: mentorRows, error: mentorError } = await supabase
    .from("mentor_profiles")
    .select("user_id, headline, bio, expertise, organization")
    .order("created_at", { ascending: false });

  if (mentorError) {
    throw new Error(`Unable to load mentors: ${mentorError.message}`);
  }

  const mentors = (mentorRows ?? []) as MentorProfile[];
  const mentorIds = mentors.map((mentor) => mentor.user_id);
  const [{ data: users, error: usersError }, { data: slotRows, error: slotsError }] =
    mentorIds.length
      ? await Promise.all([
          supabase.from("users").select("id, full_name, avatar_url").in("id", mentorIds),
          supabase
            .from("mentorship_slots")
            .select("id, mentor_id, starts_at, ends_at")
            .in("mentor_id", mentorIds)
            .is("booked_by", null)
            .gt("starts_at", now.toISOString())
            .lte("starts_at", twoMonthsFromNow.toISOString())
            .order("starts_at")
            .limit(200),
        ])
      : [
          { data: [], error: null },
          { data: [], error: null },
        ];

  if (usersError) {
    throw new Error(`Unable to load mentor names: ${usersError.message}`);
  }
  if (slotsError) {
    throw new Error(`Unable to load mentorship availability: ${slotsError.message}`);
  }

  const namesById = new Map(
    (users ?? []).map((user) => [user.id, user.full_name] as const),
  );
  const slots = (slotRows ?? []) as MentorshipSlot[];
  const slotsByMentor = new Map<string, AvailableMentorshipSlot[]>();
  for (const slot of slots) {
    const mentorSlots = slotsByMentor.get(slot.mentor_id) ?? [];
    mentorSlots.push({
      id: slot.id,
      startsAt: slot.starts_at,
      endsAt: slot.ends_at,
    });
    slotsByMentor.set(slot.mentor_id, mentorSlots);
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:py-14">
      <header className="max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
          Learn one-on-one
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
          Meet your next mentor
        </h1>
        <p className="mt-3 text-slate-600">
          Browse university and industry mentors, explore their expertise, and book a time to learn.
          Sessions display in Sri Lanka time.
        </p>
      </header>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-emerald-100 bg-emerald-50 p-4">
        <p className="text-sm text-emerald-950">
          Interested in mentoring? Create a mentor account to share your experience.
        </p>
        <Link
          className="rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800"
          href="/auth/signup?role=mentor"
        >
          Become a mentor
        </Link>
      </div>

      {mentors.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <h2 className="text-lg font-semibold text-slate-950">Mentors are joining soon</h2>
          <p className="mt-2 text-slate-600">
            Check back soon to find university and industry mentors.
          </p>
        </div>
      ) : (
        <section aria-label="Available mentors" className="mt-8 grid gap-5 lg:grid-cols-2">
          {mentors.map((mentor) => {
            const name = namesById.get(mentor.user_id) ?? "Community mentor";
            const expertise = Array.isArray(mentor.expertise) ? mentor.expertise : [];
            return (
              <article
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7"
                key={mentor.user_id}
              >
                <p className="text-sm font-semibold text-emerald-800">
                  {mentor.organization ?? "University and industry mentor"}
                </p>
                <h2 className="mt-1 text-xl font-bold text-slate-950">{name}</h2>
                <p className="mt-1 font-medium text-slate-700">{mentor.headline}</p>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                  {mentor.bio}
                </p>

                {expertise.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2" aria-label="Areas of expertise">
                    {expertise.map((item) => (
                      <span
                        className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700"
                        key={item}
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                )}

                <MentorshipBookingCalendar
                  initialDate={getColomboDate()}
                  mentorId={mentor.user_id}
                  mentorName={name}
                  slots={slotsByMentor.get(mentor.user_id) ?? []}
                />
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}
