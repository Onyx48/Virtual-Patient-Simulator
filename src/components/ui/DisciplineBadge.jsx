import { disciplineOf, disciplineName } from "../../lib/disciplines";

const STYLES = {
  PT: "bg-sky-50 text-sky-700 border-sky-200",
  OT: "bg-violet-50 text-violet-700 border-violet-200",
};

/** "PT" or "OT" chip for a scenario; scenarios from before OT read as PT. */
export default function DisciplineBadge({ scenario, className = "" }) {
  const d = disciplineOf(scenario);
  return (
    <span
      title={disciplineName(d)}
      className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-bold tracking-wider ${STYLES[d]} ${className}`}
    >
      {d}
    </span>
  );
}
