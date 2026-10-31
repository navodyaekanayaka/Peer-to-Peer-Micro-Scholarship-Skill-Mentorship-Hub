import Link from "next/link";

const pathways = [
  {
    title: "For students",
    description:
      "Share a specific education need, such as exam fees, books, data, or learning equipment.",
    href: "/auth/signup?role=student",
    action: "Request support",
  },
  {
    title: "For donors",
    description:
      "Support a student directly with transparent LKR fundraising progress and campaign updates.",
    href: "/explore",
    action: "Explore campaigns",
  },
  {
    title: "For mentors",
    description:
      "Share your experience and make time for one-on-one learning with students.",
    href: "/auth/signup?role=mentor",
    action: "Become a mentor",
  },
];

const principles = [
  {
    number: "01",
    title: "Small needs matter",
    description:
      "A focused contribution can help cover a real education expense, from exam registration to internet data.",
  },
  {
    number: "02",
    title: "Progress stays visible",
    description:
      "Campaign totals and student-posted milestones help the community follow each request over time.",
  },
  {
    number: "03",
    title: "Skills open doors",
    description:
      "Students can connect with university and industry mentors for practical, one-to-one guidance.",
  },
];

export default function HomePage() {
  return (
    <main>
      <section className="relative overflow-hidden bg-emerald-950">
        <div
          aria-hidden="true"
          className="absolute -right-36 -top-40 h-[30rem] w-[30rem] rounded-full border border-emerald-700/50"
        />
        <div
          aria-hidden="true"
          className="absolute -right-16 -top-20 h-[22rem] w-[22rem] rounded-full border border-emerald-700/50"
        />
        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-20 sm:px-6 sm:py-28 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-center lg:px-8">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-300">
              Sri Lanka learns together
            </p>
            <h1 className="mt-5 text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
              Small support.
              <br />
              <span className="text-emerald-300">Lasting opportunity.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-emerald-50/80">
              Connect deserving students with the people who can help: local donors, Sri Lankan
              diaspora supporters, and mentors ready to share their skills.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                className="rounded-lg bg-amber-300 px-5 py-3 text-center font-semibold text-emerald-950 transition hover:bg-amber-200"
                href="/explore"
              >
                Explore student campaigns
              </Link>
              <Link
                className="rounded-lg border border-emerald-100/40 px-5 py-3 text-center font-semibold text-white transition hover:bg-white/10"
                href="/auth/signup?role=student"
              >
                I&apos;m a student
              </Link>
            </div>
            <p className="mt-5 text-sm text-emerald-100/70">
              Micro-funding · One-to-one mentorship · Student progress updates
            </p>
          </div>

          <aside className="rounded-2xl border border-white/15 bg-white/10 p-6 text-white shadow-2xl backdrop-blur-sm">
            <p className="text-sm font-semibold text-amber-300">A practical difference</p>
            <p className="mt-3 text-3xl font-bold">LKR 5,000</p>
            <p className="mt-2 text-sm leading-6 text-emerald-50/80">
              can help with an exam fee, learning materials, or an internet package when a student
              needs it most.
            </p>
            <div className="mt-6 h-px bg-white/15" />
            <p className="mt-5 text-sm leading-6 text-emerald-50/80">
              Every request is a person&apos;s next step in learning. Browse campaigns to see the
              needs and updates shared by students.
            </p>
          </aside>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
            One community, many ways to help
          </p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
            Find your way in
          </h2>
        </div>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {pathways.map((pathway) => (
            <article
              className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
              key={pathway.title}
            >
              <h3 className="text-xl font-bold text-slate-950">{pathway.title}</h3>
              <p className="mt-3 flex-1 leading-7 text-slate-600">{pathway.description}</p>
              <Link
                className="mt-6 inline-flex items-center gap-2 font-semibold text-emerald-800 hover:underline"
                href={pathway.href}
              >
                {pathway.action} <span aria-hidden="true">&rarr;</span>
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
              Built around trust and access
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
              Support that stays connected to learning
            </h2>
          </div>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {principles.map((principle) => (
              <article className="rounded-2xl bg-slate-50 p-6" key={principle.number}>
                <p className="text-sm font-bold tracking-wide text-emerald-700">
                  {principle.number}
                </p>
                <h3 className="mt-3 text-lg font-bold text-slate-950">{principle.title}</h3>
                <p className="mt-2 leading-7 text-slate-600">{principle.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 text-center sm:px-6 lg:px-8 lg:py-20">
        <h2 className="text-3xl font-bold tracking-tight text-slate-950">
          Be part of a student&apos;s next step
        </h2>
        <p className="mx-auto mt-3 max-w-2xl leading-7 text-slate-600">
          Discover a campaign, share your experience, or tell the community what would help you
          continue learning.
        </p>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            className="rounded-lg bg-emerald-700 px-5 py-3 font-semibold text-white hover:bg-emerald-800"
            href="/explore"
          >
            Explore campaigns
          </Link>
          <Link
            className="rounded-lg border border-slate-300 px-5 py-3 font-semibold text-slate-800 hover:bg-white"
            href="/mentorship"
          >
            Find a mentor
          </Link>
        </div>
      </section>
    </main>
  );
}
