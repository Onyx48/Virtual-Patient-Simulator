/**
 * Educator dashboard, following vps_dashboards_v18 ("Educator" tab).
 *
 * Real data: cohorts (groups), learners in scope, History Taking scores,
 * progress first → latest, activity, practice time, scenarios. In development:
 * Clinical Reasoning and Treatment Planning, overall score, missed red flags,
 * common learning gaps per criterion.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import { ChevronRight, Search, Copy } from "lucide-react";
import { FullPageSpinner } from "../../lib/hooks/useLoading";
import {
  Card,
  SectionTitle,
  Kpi,
  CompetencyBar,
  COMPETENCIES,
  ACTIVITY,
  ActivityDot,
  InDevelopment,
  InDevTag,
  ScoreCell,
  Empty,
  Tag,
  fmtDate,
  fmtMinutes,
  daysAgo,
  okTag,
  badTag,
} from "../../components/Dashboard/ui";

const PAGE = 15;
const DISCIPLINE_FILTERS = [
  { id: "", label: "PT + OT" },
  { id: "PT", label: "Physiotherapy" },
  { id: "OT", label: "Occupational Therapy" },
];

function Chip({ active, children, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-semibold ${
        active ? "border-orange-400 bg-orange-50 text-orange-700" : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"
      }`}
    >
      {children}
    </button>
  );
}

export default function EducatorDashboard() {
  const navigate = useNavigate();
  const [groupId, setGroupId] = useState("");
  const [discipline, setDiscipline] = useState("");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const [activity, setActivity] = useState("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState({ key: "name", dir: 1 });
  const [page, setPage] = useState(0);

  useEffect(() => {
    setLoading(true);
    axios
      .get("/api/dashboard/v2/educator", { params: { groupId: groupId || undefined, discipline: discipline || undefined } })
      .then((r) => {
        setData(r.data);
        setError("");
      })
      .catch((e) => setError(e.response?.data?.message || "Could not load the dashboard."))
      .finally(() => setLoading(false));
  }, [groupId, discipline]);

  const rows = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    const val = (l) =>
      ({ name: l.name || "", cohort: l.cohort || "", ht: l.latestHT ?? -1, progress: l.progress ?? -999, sessions: l.completed, last: l.lastDate ? new Date(l.lastDate).getTime() : 0 })[sort.key];
    return data.learners
      .filter((l) => activity === "all" || l.activity.status === activity)
      .filter((l) => !q || `${l.name} ${l.email} ${l.cohort || ""}`.toLowerCase().includes(q))
      .sort((a, b) => {
        const x = val(a), y = val(b);
        return (typeof x === "string" ? x.localeCompare(y) : x - y) * sort.dir;
      });
  }, [data, activity, query, sort]);

  useEffect(() => setPage(0), [activity, query, sort, groupId, discipline]);

  if (error && !data) return <div className="p-6"><Empty>{error}</Empty></div>;
  if (!data) return <FullPageSpinner />;

  const { kpis, cohorts, learners, target, scope } = data;
  const scopeName = scope.groupName || "All cohorts";
  const pageRows = rows.slice(page * PAGE, page * PAGE + PAGE);
  const sortBy = (key) => setSort((s) => ({ key, dir: s.key === key ? -s.dir : 1 }));
  const th = (key, label) => (
    <th className="cursor-pointer select-none py-2 pr-3 hover:text-gray-800" onClick={() => sortBy(key)}>
      {label} {sort.key === key ? (sort.dir > 0 ? "▲" : "▼") : ""}
    </th>
  );

  const copyEmails = async () => {
    const list = rows.map((l) => l.email).filter(Boolean).join(", ");
    try {
      await navigator.clipboard.writeText(list);
      toast.success(`Copied ${rows.length} email address${rows.length === 1 ? "" : "es"}`);
    } catch {
      toast.error("Could not copy to the clipboard.");
    }
  };

  return (
    <div className={`w-full space-y-5 ${loading ? "opacity-60" : ""}`}>
      {/* Scope */}
      <Card>
        <p className="text-[11px] font-bold uppercase tracking-wider text-orange-600">Showing data for</p>
        <h1 className="text-2xl font-bold text-gray-900">{scopeName}</h1>
        <p className="text-xs text-gray-500">
          {scope.groupId ? "1 cohort" : `${cohorts.length} cohort${cohorts.length === 1 ? "" : "s"}`} · {kpis.learners} learners
          {kpis.notStarted ? ` (${kpis.notStarted} not started yet)` : ""} · every figure on this page reflects this selection
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-gray-500">Cohort</span>
          <Chip active={!groupId} onClick={() => setGroupId("")}>All cohorts</Chip>
          {cohorts.map((c) => (
            <Chip key={c.id} active={groupId === c.id} onClick={() => setGroupId(c.id)}>
              {c.name} ({c.learners})
            </Chip>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-xs text-gray-500">Discipline</span>
          {DISCIPLINE_FILTERS.map((d) => (
            <Chip key={d.id || "all"} active={discipline === d.id} onClick={() => setDiscipline(d.id)}>
              {d.label}
            </Chip>
          ))}
        </div>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Kpi
          accent
          label="Learning effectiveness"
          value={`${kpis.atTarget} of ${kpis.learners}`}
          sub={`learners at target (History Taking ${target}%+)`}
          info="Learners whose latest completed session reaches the target. Will include every competency once CR and TP are scored."
        />
        <Kpi
          label="Active learners"
          value={`${kpis.active} of ${kpis.learners}`}
          sub={`${kpis.atRisk} at risk · ${kpis.inactive} inactive`}
          info="Active = completed session within 14 days; at risk = 15–30 days; inactive = over 30 days or none."
        />
        <Kpi
          label="Competency progress"
          value={kpis.progress == null ? "–" : `${kpis.progress >= 0 ? "+" : ""}${kpis.progress} pts`}
          sub={`first → latest session · ${kpis.progressedLearners} of ${kpis.learners} learners`}
          info="Average History Taking change from first to latest completed session, for learners with 2+ sessions."
        />
        <Kpi label="Avg. practice time" value={fmtMinutes(kpis.avgPracticeMin)} sub="per learner, completed sessions" />
        <Kpi
          label="Scenarios"
          value={kpis.scenarios}
          sub={`${kpis.scenariosPublished} published · open Scenarios →`}
          onClick={() => navigate("/scenarios")}
        />
      </div>

      <InDevelopment title="Safety: missed red flags">
        Sessions where a learner missed a red flag will be listed here for review, once Clinical Reasoning
        scoring is connected.
      </InDevelopment>

      {/* Cohorts */}
      {cohorts.length > 0 && !scope.groupId && (
        <section>
          <SectionTitle title="Cohort comparison" hint="Select a cohort to focus the whole page on it" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {cohorts.map((c) => {
              const members = learners.filter((l) => l.cohortId === c.id);
              return (
                <button key={c.id} onClick={() => setGroupId(c.id)} className="rounded-xl border border-gray-200 bg-white p-4 text-left shadow-sm hover:border-orange-300">
                  <div className="flex items-baseline justify-between">
                    <p className="text-sm font-bold text-gray-900">{c.name}</p>
                    <p className="text-[11px] text-gray-500">{c.learners} learners</p>
                  </div>
                  <p className="mt-1 text-2xl font-bold text-gray-900">{c.atTarget} of {c.learners}</p>
                  <p className="text-xs text-gray-500">
                    at target{c.progress != null ? ` · ${c.progress >= 0 ? "+" : ""}${c.progress} pts progress` : ""}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                    {members.slice(0, 6).map((m) => (
                      <span key={m.id} className="flex items-center gap-1 text-xs text-gray-700">
                        <ActivityDot status={m.activity.status} /> {(m.name || "").split(" ")[0]}
                      </span>
                    ))}
                    {members.length > 6 && <span className="text-xs text-gray-400">+{members.length - 6}</span>}
                  </div>
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex gap-4 text-xs text-gray-500">
            {Object.entries(ACTIVITY).map(([k, a]) => (
              <span key={k} className="flex items-center gap-1"><ActivityDot status={k} /> {a.label}{k === "at_risk" ? " (15–30 days)" : k === "inactive" ? " (over 30 days)" : ""}</span>
            ))}
          </div>
        </section>
      )}

      {/* Competency profile + gaps */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <SectionTitle title="Competency profile" hint={`${scopeName} · average of latest completed sessions`} />
          <CompetencyBar
            name="History Taking"
            color={COMPETENCIES[0].color}
            value={kpis.avgHT}
            target={target}
            delta={kpis.avgHT != null && kpis.firstHT != null ? kpis.avgHT - kpis.firstHT : null}
          />
          {kpis.avgHT != null && (
            <div className="mb-1">{kpis.avgHT >= target ? okTag("On target") : badTag("Needs attention")}</div>
          )}
          <CompetencyBar name="Clinical Reasoning" color={COMPETENCIES[1].color} target={target} pending />
          <CompetencyBar name="Treatment Planning" color={COMPETENCIES[2].color} target={target} pending />
          <p className="mt-2 flex items-center gap-1 text-xs text-gray-500">
            <span className="inline-block h-3 w-0.5 bg-gray-800" /> {target}% target
          </p>
        </Card>
        <Card>
          <SectionTitle title="Common learning gaps" hint="History Taking criteria where learners score below Proficient" right={<InDevTag />} />
          <p className="text-sm text-gray-600">
            Once each session is rated on the 8 History Taking criteria, this lists the criteria with the
            most learners below Proficient (under 3 of 4), with the average rating and the learners affected.
          </p>
          <ul className="mt-3 space-y-2">
            {["Psychosocial & Contextual Exploration", "Follow-Up & Probing", "Organisation & Adaptability"].map((c) => (
              <li key={c} className="rounded-md border-l-4 border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-400">
                {c} <span className="float-right">–%</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* Learners */}
      <Card>
        <SectionTitle
          title={`Learners · ${scopeName}`}
          hint="Select a learner to see every session, feedback and transcripts · select a column to sort"
        />
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            {[["all", `All (${learners.length})`], ...Object.entries(ACTIVITY).map(([k, a]) => [k, `${a.label} (${learners.filter((l) => l.activity.status === k).length})`])].map(([k, label]) => (
              <Chip key={k} active={activity === k} onClick={() => setActivity(k)}>{label}</Chip>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-md border border-gray-300 px-2">
              <Search className="h-4 w-4 text-gray-400" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search learners" className="w-40 py-1.5 text-sm outline-none" />
            </div>
            <button onClick={copyEmails} disabled={!rows.length} className="flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">
              <Copy className="h-3.5 w-3.5" /> Copy emails ({rows.length})
            </button>
          </div>
        </div>

        {rows.length === 0 ? (
          <Empty>No learners match this selection.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-[11px] uppercase tracking-wider text-gray-500">
                  {th("name", "Learner")}
                  {th("cohort", "Cohort")}
                  {th("ht", "HT")}
                  <th className="py-2 pr-3">CR</th>
                  <th className="py-2 pr-3">TP</th>
                  <th className="py-2 pr-3">Target</th>
                  {th("progress", "Progress")}
                  {th("sessions", "Sessions")}
                  {th("last", "Activity · last session")}
                  <th />
                </tr>
              </thead>
              <tbody>
                {pageRows.map((l) => {
                  const a = ACTIVITY[l.activity.status];
                  return (
                    <tr key={l.id} onClick={() => navigate(`/learners/${l.id}`)} className="cursor-pointer border-b last:border-0 hover:bg-orange-50/40">
                      <td className="py-2.5 pr-3">
                        <p className="font-semibold text-gray-900">{l.name}</p>
                        <a href={`mailto:${l.email}`} onClick={(e) => e.stopPropagation()} className="text-xs text-gray-500 hover:text-orange-600">
                          {l.email}
                        </a>
                      </td>
                      <td className="py-2.5 pr-3 text-gray-700">{l.cohort || "–"}</td>
                      {l.completed === 0 ? (
                        <td colSpan={5} className="py-2.5 pr-3 text-xs text-gray-400">No completed sessions yet</td>
                      ) : (
                        <>
                          <td className="py-2.5 pr-3"><ScoreCell value={l.latestHT} target={target} /></td>
                          <td className="py-2.5 pr-3 text-gray-400">–</td>
                          <td className="py-2.5 pr-3 text-gray-400">–</td>
                          <td className="py-2.5 pr-3">{l.atTarget ? okTag("At target") : badTag("Below target")}</td>
                          <td className="py-2.5 pr-3 whitespace-nowrap">
                            {l.progress == null ? (
                              <span className="text-xs text-gray-500">1 session</span>
                            ) : (
                              <span className={l.progress >= 0 ? "text-green-700" : "text-red-700"}>
                                {l.progress >= 0 ? "▲ +" : "▼ "}{l.progress} pts
                              </span>
                            )}
                          </td>
                        </>
                      )}
                      <td className="py-2.5 pr-3 text-gray-700">
                        {l.completed}
                        {l.inProgress > 0 && <span className="ml-1 text-xs text-gray-400">+{l.inProgress} unfinished</span>}
                      </td>
                      <td className="py-2.5 pr-3 whitespace-nowrap">
                        {l.invited && l.completed === 0 ? (
                          <Tag>Invited</Tag>
                        ) : (
                          <Tag color={a.color} bg={a.bg}>{a.label}{l.activity.days != null ? ` · ${daysAgo(l.activity.days)}` : ""}</Tag>
                        )}
                        <p className="mt-0.5 text-xs text-gray-500">{l.lastDate ? `Last session ${fmtDate(l.lastDate)}` : "No session yet"}</p>
                      </td>
                      <td className="py-2.5 text-gray-400"><ChevronRight className="h-4 w-4" /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
          <span>
            Showing {rows.length ? page * PAGE + 1 : 0}–{Math.min(rows.length, (page + 1) * PAGE)} of {rows.length} learners
          </span>
          <span className="flex gap-2">
            <button disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="rounded border px-2 py-1 disabled:opacity-40">‹ Previous</button>
            <button disabled={(page + 1) * PAGE >= rows.length} onClick={() => setPage((p) => p + 1)} className="rounded border px-2 py-1 disabled:opacity-40">Next ›</button>
          </span>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          Scores from the latest completed session. At target = History Taking {target}% or higher (CR and TP will
          be added when scored); red figures are below {target}%. Activity: active = last completed session within 14
          days; at risk = 15 to 30 days; inactive = over 30 days or none.
        </p>
      </Card>
    </div>
  );
}
