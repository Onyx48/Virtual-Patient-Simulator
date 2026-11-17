/**
 * One learner, for educators: score summary and every session. Opened from the
 * educator dashboard's learner table.
 */
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { ChevronRight } from "lucide-react";
import { FullPageSpinner } from "../../lib/hooks/useLoading";
import DisciplineBadge from "../ui/DisciplineBadge";
import { Card, SectionTitle, Kpi, ScoreCell, Empty, InDevTag, fmtDate, fmtMinutes, okTag, amberTag } from "./ui";

export default function LearnerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [d, setD] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    axios
      .get(`/api/dashboard/v2/learner/${id}`)
      .then((r) => setD(r.data))
      .catch((e) => setError(e.response?.data?.message || "Could not load this learner."));
  }, [id]);

  if (error) return <div className="p-6"><Empty>{error}</Empty></div>;
  if (!d) return <FullPageSpinner />;
  const { learner, summary, sessions, target } = d;

  return (
    <div className="w-full space-y-5">
      <button onClick={() => navigate(-1)} className="text-sm font-semibold text-orange-600 hover:underline">← Back to dashboard</button>
      <Card>
        <h1 className="text-xl font-bold text-gray-900">{learner.name}</h1>
        <a href={`mailto:${learner.email}`} className="text-sm text-orange-600 hover:underline">{learner.email}</a>
      </Card>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Latest History Taking" value={summary.latestHT == null ? "–" : `${summary.latestHT}%`} sub={summary.atTarget ? "at target" : `target ${target}%`} />
        <Kpi label="Progress" value={summary.progress == null ? "–" : `${summary.progress >= 0 ? "+" : ""}${summary.progress} pts`} sub="first → latest" />
        <Kpi label="Sessions completed" value={summary.completed} sub={summary.inProgress ? `+${summary.inProgress} unfinished` : "all finished"} />
        <Kpi label="Practice time" value={fmtMinutes(summary.practiceMin)} sub="completed sessions" />
      </div>
      <Card>
        <SectionTitle title="All sessions" hint="Select a session for feedback and transcript" right={<span className="flex items-center gap-1 text-xs text-gray-500">CR, TP, reflection <InDevTag /></span>} />
        {sessions.length === 0 ? (
          <Empty>This learner has no sessions yet.</Empty>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-[11px] uppercase tracking-wider text-gray-500">
                <th className="py-2 pr-3">Date</th>
                <th className="py-2 pr-3">Scenario</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">HT</th>
                <th className="py-2 pr-3">Time</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id} onClick={() => navigate(`/sessions/${s.id}`)} className="cursor-pointer border-b last:border-0 hover:bg-orange-50/40">
                  <td className="py-2.5 pr-3 text-gray-700">{fmtDate(s.date)}</td>
                  <td className="py-2.5 pr-3">
                    <p className="flex items-center gap-2 font-semibold text-gray-900">{s.scenarioName} <DisciplineBadge scenario={s} /></p>
                    <p className="text-xs text-gray-500">Attempt {s.attempt}</p>
                  </td>
                  <td className="py-2.5 pr-3">{s.status === "completed" ? okTag("Completed") : amberTag("Not finished")}</td>
                  <td className="py-2.5 pr-3"><ScoreCell value={s.ht} target={target} /></td>
                  <td className="py-2.5 pr-3 text-gray-600">{s.durationMin ? `${s.durationMin} min` : "–"}</td>
                  <td className="py-2.5 text-gray-400"><ChevronRight className="h-4 w-4" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
