import Link from "next/link";

export type CampaignMilestone = {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  receiptUrl: string | null;
  isCompleted: boolean;
  isVerified: boolean;
};

type MilestoneTrackerProps = {
  milestones: CampaignMilestone[];
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-LK", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(value));
}

export default function MilestoneTracker({ milestones }: MilestoneTrackerProps) {
  return (
    <section aria-labelledby="updates-heading">
      <h2 className="text-xl font-bold text-slate-950" id="updates-heading">
        Campaign updates
      </h2>
      {milestones.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white p-6 text-slate-600">
          No progress updates have been posted yet.
        </p>
      ) : (
        <ol className="mt-5 space-y-4 border-l-2 border-emerald-200 pl-5">
          {milestones.map((milestone) => (
            <li
              className="relative rounded-xl border border-slate-200 bg-white p-5"
              key={milestone.id}
            >
              <span
                aria-hidden="true"
                className="absolute -left-[1.65rem] top-6 h-3 w-3 rounded-full border-2 border-white bg-emerald-700 ring-2 ring-emerald-200"
              />
              <time
                className="text-xs font-medium text-slate-500"
                dateTime={milestone.createdAt}
              >
                {formatDate(milestone.createdAt)}
              </time>
              <h3 className="mt-1 font-semibold text-slate-950">{milestone.title}</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    milestone.isCompleted
                      ? "bg-emerald-50 text-emerald-900"
                      : "bg-amber-50 text-amber-900"
                  }`}
                >
                  {milestone.isCompleted ? "Completed" : "In progress"}
                </span>
                {milestone.isVerified && (
                  <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-800">
                    Verified update
                  </span>
                )}
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                {milestone.description}
              </p>
              {milestone.receiptUrl && (
                <Link
                  className="mt-4 inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900 transition hover:bg-emerald-100"
                  href={milestone.receiptUrl}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <span aria-hidden="true">↗</span>
                  View attached receipt
                </Link>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
