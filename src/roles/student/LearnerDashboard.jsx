/**
 * Learner dashboard, following vps_dashboards_v18 ("Learner" tab).
 *
 * Real data: scenarios, sessions, attempts, History Taking scores, progress,
 * cohort average. Not built yet, shown as "in development": per-criterion
 * rubric and learning focus, Clinical Reasoning, Treatment Planning, overall
 * score, self-reflection summaries.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { ChevronRight } from "lucide-react";
import { FullPageSpinner } from "../../lib/hooks/useLoading";
import DisciplineBadge from "../../components/ui/DisciplineBadge";
import {
  Card,
  SectionTitle,
  Kpi,
  CompetencyBar,
  COMPETENCIES,
  InDevelopment,
  InDevTag,
  ScoreCell,
  Empty,
  fmtDate,
  okTag,
  amberTag,
  greyTag,
} from "../../components/Dashboard/ui";

const STATUS = {
  completed: () => okTag("Completed"),
  in_progress: () => amberTag("In progress"),
  not_started: () => greyTag("Not started"),
};

export default function LearnerDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    axios
      .get("/api/dashboard/v2/learner")
      .then((r) => setData(r.data))
      .catch((e) => setError(e.response?.data?.message || "Could not load your dashboard."));
  }, []);

  if (error) return <div className="p-6"><Empty>{error}</Empty></div>;
  if (!data) return <FullPageSpinner />;

  const { learner, educator, summary, scenarios, sessions, target } = data;
  const firstName = (learner.name || "").split(" ")[0];
  const counts = {
    completed: scenarios.filter((s) => s.status === "completed").length,
    inProgress: scenarios.filter((s) => s.status === "in_progress").length,
    notStarted: scenarios.filter((s) => s.status === "not_started").length,
  };
  // Continue the most recent unfinished scenario, else start the first untouched one.
  const resume =
    scenarios.find((s) => s.status === "in_progress") || scenarios.find((s) => s.status === "not_started");
  const htDelta = summary.progress;

  return (
    <div className="w-full space-y-5">
      {/* Header */}
      <Card className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs text-gray-500">VPS Clinical{learner.cohort ? ` · ${learner.cohort}` : ""}</p>
          <h1 className="text-2xl font-bold text-gray-900">Welcome back, {firstName}</h1>
          <p className="text-sm text-gray-600">
            Your learning status at a glance. Choose a scenario or session to see the details.
          </p>
          {educator && (
            <p className="mt-1 text-xs text-gray-600">
              Your educator: <span className="font-semibold">{educator.name}</span> ·{" "}
              <a className="text-orange-600 hover:underline" href={`mailto:${educator.email}`}>
                {educator.email}
              </a>
            </p>
          )}
        </div>
        {resume && (
          <div className="text-right">
            <button
              onClick={() => navigate(`/student/scenario/${resume.id}`)}
              className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
            >
              {resume.status === "in_progress" ? "Continue" : "Start"} {resume.name} →
            </button>
            {resume.inProgressSince && (
              <p className="mt-1 text-xs text-gray-500">Started {fmtDate(resume.inProgressSince)}</p>
            )}
          </div>
        )}
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Kpi label="Scenarios assigned" value={summary.assigned} sub="by your educator" info="Published scenarios assigned to you or your cohort." />
        <Kpi label="Completed" value={counts.completed} sub="at least one finished session" info="Scenarios with at least one graded session." />
        <Kpi label="In progress" value={counts.inProgress} sub="started, not finished" info="Scenarios you started but have no graded session for yet." />
        <Kpi label="Not started" value={counts.notStarted} sub="no sessions yet" />
        <Kpi label="Sessions completed" value={summary.completed} sub="across all scenarios" />
      </div>

      {/* Competency profile + learning focus */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <SectionTitle
            title="My competency profile"
            hint={
              summary.lastDate
                ? `Latest completed session · ${fmtDate(sessions.find((s) => s.status === "completed")?.date)}`
                : "No completed session yet"
            }
          />
          <CompetencyBar
            name="History Taking"
            color={COMPETENCIES[0].color}
            value={summary.latestHT}
            target={target}
            cohort={summary.cohortHT}
            delta={htDelta}
          />
          <CompetencyBar name="Clinical Reasoning" color={COMPETENCIES[1].color} target={target} pending />
          <CompetencyBar name="Treatment Planning" color={COMPETENCIES[2].color} target={target} pending />
          <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="inline-block h-3 w-0.5 bg-gray-800" /> {target}% target</span>
            {summary.cohortHT != null && (
              <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rotate-45 border-2 border-orange-500" /> Cohort average</span>
            )}
          </div>
          <div className="mt-3 rounded-lg bg-gray-50 p-3 text-xs text-gray-700">
            {summary.latestHT == null
              ? "Complete a session to see your History Taking score."
              : summary.latestHT >= target
                ? <><b>History Taking is at target.</b> The overall target is reached when every competency is {target}% or higher; Clinical Reasoning and Treatment Planning scores are coming soon.</>
                : <><b>Not yet at target:</b> History Taking is below {target}%. The target is reached when every competency is {target}% or higher.</>}
          </div>
          {summary.cohortHT != null && (
            <p className="mt-2 text-xs text-gray-500">The cohort average is shown for context only. Your goal is the {target}% target.</p>
          )}
        </Card>

        <div className="rounded-xl bg-orange-500 p-5 text-white shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-white/80">Current learning focus</p>
          <h2 className="mt-1 text-lg font-bold">Your personal focus area</h2>
          <p className="mt-2 text-sm text-white/90">
            Once rubric scoring is live, this shows the History Taking criterion with the most room to grow,
            your strengths and priorities, and your progress on it across attempts.
          </p>
          <div className="mt-4 rounded-lg bg-white/15 p-3 text-sm">
            <span className="mr-2 rounded-full bg-white/25 px-2 py-0.5 text-[11px] font-semibold">In development</span>
            Until then, read the feedback of your latest session for what to work on next.
          </div>
          {sessions.find((s) => s.status === "completed") && (
            <button
              onClick={() => navigate(`/sessions/${sessions.find((s) => s.status === "completed").id}`)}
              className="mt-3 text-sm font-semibold underline underline-offset-2"
            >
              Open my latest feedback ›
            </button>
          )}
        </div>
      </div>

      {/* Scenarios */}
      <section>
        <SectionTitle title="My scenarios" hint="Select a scenario to see your progress and sessions" />
        {scenarios.length === 0 ? (
          <Empty>No scenarios have been assigned to you yet.</Empty>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {scenarios.map((s) => (
              <Card key={s.id} className="flex flex-col justify-between !p-4">
                <div>
                  <div className="mb-1 flex items-start justify-between gap-2">
                    <h3 className="line-clamp-2 text-sm font-bold text-gray-900">{s.name}</h3>
                    {STATUS[s.status]()}
                  </div>
                  <DisciplineBadge scenario={s} />
                  <p className="mt-2 text-xs text-gray-700">
                    {s.status === "completed" ? (
                      <>Best <b>{s.bestHT}%</b> · latest <b>{s.latestHT}%</b><br />{s.sessionsCompleted} session{s.sessionsCompleted === 1 ? "" : "s"} completed</>
                    ) : s.status === "in_progress" ? (
                      <>Started {fmtDate(s.inProgressSince)}, not finished</>
                    ) : (
                      "No sessions yet"
                    )}
                  </p>
                </div>
                <button
                  onClick={() => navigate(`/student/scenario/${s.id}`)}
                  className="mt-3 self-start text-xs font-semibold text-orange-600 hover:underline"
                >
                  {s.status === "not_started" ? "Start scenario ›" : "View details ›"}
                </button>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Recent sessions */}
      <Card>
        <SectionTitle
          title="Recent sessions"
          hint="Your latest sessions across all scenarios · select a session for details"
        />
        {sessions.length === 0 ? (
          <Empty>You have no sessions yet. Start a scenario to begin.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-[11px] uppercase tracking-wider text-gray-500">
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">Scenario</th>
                  <th className="py-2 pr-3">Status · reflection</th>
                  <th className="py-2 pr-3">HT</th>
                  <th className="py-2 pr-3">CR</th>
                  <th className="py-2 pr-3">TP</th>
                  <th className="py-2 pr-3">Time</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {sessions.slice(0, 10).map((s) => (
                  <tr
                    key={s.id}
                    onClick={() => navigate(`/sessions/${s.id}`)}
                    className="cursor-pointer border-b last:border-0 hover:bg-orange-50/40"
                  >
                    <td className="py-2.5 pr-3 whitespace-nowrap text-gray-700">{fmtDate(s.date)}</td>
                    <td className="py-2.5 pr-3">
                      <p className="font-semibold text-gray-900">{s.scenarioName}</p>
                      <p className="text-xs text-gray-500">Attempt {s.attempt} at this scenario</p>
                    </td>
                    <td className="py-2.5 pr-3">
                      {s.status === "completed" ? okTag("Completed") : amberTag("Not finished")}
                      {s.status === "completed" && (
                        <p className="mt-1 text-xs text-gray-400">Reflection summary: in development</p>
                      )}
                    </td>
                    <td className="py-2.5 pr-3"><ScoreCell value={s.ht} target={target} /></td>
                    <td className="py-2.5 pr-3 text-gray-400">–</td>
                    <td className="py-2.5 pr-3 text-gray-400">–</td>
                    <td className="py-2.5 pr-3 whitespace-nowrap text-gray-600">{s.durationMin ? `${s.durationMin} min` : "–"}</td>
                    <td className="py-2.5 text-gray-400"><ChevronRight className="h-4 w-4" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 flex items-center gap-2 text-xs text-gray-500">
              CR and TP scores <InDevTag />
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
