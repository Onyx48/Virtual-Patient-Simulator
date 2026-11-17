/**
 * Building blocks for the learner and educator dashboards, following the
 * vps_dashboards_v18 design (Notion, 17 Nov 2026). Colours, levels and the 75%
 * target come from that design.
 */
import { Info, Construction } from "lucide-react";

export const COMPETENCIES = [
  { key: "HT", name: "History Taking", color: "#263A49" },
  { key: "CR", name: "Clinical Reasoning", color: "#FF7C00" },
  { key: "TP", name: "Treatment Planning", color: "#5B8DB8" },
];

/* History Taking rubric, in the agreed order (UI15, most important first). */
export const HT_CRITERIA = [
  "Relevant History Gathering",
  "Follow-Up & Probing",
  "Psychosocial & Contextual Exploration",
  "Relevance & Prioritisation",
  "Red Flags & Safety Screening",
  "Questioning Technique & Communication",
  "Organisation & Adaptability",
  "Presenting Concern Exploration",
];

export const ACTIVITY = {
  active: { label: "Active", color: "#2F855A", bg: "#E8F5EE" },
  at_risk: { label: "At risk", color: "#B7791F", bg: "#FDF4E3" },
  inactive: { label: "Inactive", color: "#B42318", bg: "#FDECEA" },
};

export const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "–";
export const fmtDateLong = (d) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "–";
export const fmtMinutes = (m) => {
  if (!m) return "–";
  const h = Math.floor(m / 60);
  return h ? `${h}h ${m % 60}m` : `${m} min`;
};
export const daysAgo = (d) => (d == null ? "" : d === 0 ? "today" : `${d}d ago`);

export function Card({ children, className = "", ...rest }) {
  return (
    <section className={`rounded-xl border border-gray-200 bg-white p-5 shadow-sm ${className}`} {...rest}>
      {children}
    </section>
  );
}

export function SectionTitle({ title, hint, right }) {
  return (
    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
      <div className="flex flex-wrap items-baseline gap-2">
        <h2 className="text-base font-bold text-gray-900">{title}</h2>
        {hint && <p className="text-xs text-gray-500">{hint}</p>}
      </div>
      {right}
    </div>
  );
}

export function Tag({ children, color = "#6B7380", bg = "#EEF1F5", className = "" }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${className}`}
      style={{ color, background: bg }}
    >
      {children}
    </span>
  );
}

export const okTag = (t) => <Tag color="#2F855A" bg="#E8F5EE">{t}</Tag>;
export const badTag = (t) => <Tag color="#B42318" bg="#FDECEA">{t}</Tag>;
export const amberTag = (t) => <Tag color="#B7791F" bg="#FDF4E3">{t}</Tag>;
export const greyTag = (t) => <Tag>{t}</Tag>;

export function ActivityDot({ status }) {
  const a = ACTIVITY[status] || ACTIVITY.inactive;
  return <span className="inline-block h-2 w-2 rounded-full" style={{ background: a.color }} />;
}

export function Kpi({ label, value, sub, info, accent = false, onClick }) {
  const Tagname = onClick ? "button" : "div";
  return (
    <Tagname
      onClick={onClick}
      className={`relative rounded-xl border p-4 text-left ${
        accent ? "border-orange-500 bg-orange-500 text-white" : "border-orange-200 bg-white"
      } ${onClick ? "hover:shadow-md" : ""}`}
    >
      {info && (
        <span title={info} className={`absolute right-3 top-3 ${accent ? "text-white/80" : "text-gray-400"}`}>
          <Info className="h-4 w-4" />
        </span>
      )}
      <p className={`text-xs font-semibold ${accent ? "text-white/90" : "text-gray-600"}`}>{label}</p>
      <p className={`mt-1 text-2xl font-bold ${accent ? "text-white" : "text-gray-900"}`}>{value}</p>
      {sub && <p className={`mt-0.5 text-xs ${accent ? "text-white/90" : "text-gray-500"}`}>{sub}</p>}
    </Tagname>
  );
}

/** A competency bar with the target tick and an optional cohort marker. */
export function CompetencyBar({ name, color, value, target, cohort, delta, pending }) {
  return (
    <div className="py-2">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold text-gray-800">{name}</span>
        {pending ? (
          <InDevTag />
        ) : (
          <span className="text-sm">
            <span className="font-bold text-gray-900">{value == null ? "–" : `${value}%`}</span>
            {delta != null && (
              <span className={`ml-2 text-xs ${delta >= 0 ? "text-green-700" : "text-red-700"}`}>
                {delta >= 0 ? "▲" : "▼"} {delta >= 0 ? "+" : ""}
                {delta} since first
              </span>
            )}
          </span>
        )}
      </div>
      <div className="relative h-2.5 rounded-full bg-gray-100">
        {!pending && value != null && (
          <div className="h-full rounded-full" style={{ width: `${value}%`, background: color }} />
        )}
        {pending && <div className="h-full w-full rounded-full bg-[repeating-linear-gradient(45deg,#E5E7EB_0_6px,#F3F4F6_6px_12px)]" />}
        <span
          className="absolute -top-1 h-4.5 w-0.5 bg-gray-800"
          style={{ left: `${target}%`, height: "18px" }}
          title={`${target}% target`}
        />
        {!pending && cohort != null && (
          <span
            className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 border-2 border-orange-500 bg-white"
            style={{ left: `${cohort}%` }}
            title={`Cohort average ${cohort}%`}
          />
        )}
      </div>
    </div>
  );
}

export function InDevTag({ label = "In development" }) {
  return (
    <Tag color="#6B7380" bg="#F3F4F6">
      <Construction className="h-3 w-3" />
      {label}
    </Tag>
  );
}

/** A section of the design that has no data source yet. */
export function InDevelopment({ title, children, className = "" }) {
  return (
    <div className={`rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 ${className}`}>
      <div className="mb-1 flex items-center gap-2">
        {title && <p className="text-sm font-semibold text-gray-700">{title}</p>}
        <InDevTag />
      </div>
      <div className="text-xs leading-relaxed text-gray-500">{children}</div>
    </div>
  );
}

export function ScoreCell({ value, target }) {
  if (value == null) return <span className="text-gray-400">–</span>;
  return <span className={value < target ? "font-semibold text-red-700" : "text-gray-900"}>{value}%</span>;
}

export function Empty({ children }) {
  return <p className="rounded-lg bg-gray-50 p-4 text-center text-sm text-gray-500">{children}</p>;
}
