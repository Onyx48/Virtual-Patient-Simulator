/**
 * One session, following the vps_dashboards_v18 session view. Shared by the
 * learner (their own sessions) and educators (their learners').
 *
 * Real: History Taking score, AI feedback, transcript. In development: the
 * stages after History Taking, the 8-criterion rubric, PDF report,
 * self-reflection and educator comment.
 */
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { Check, Circle, ChevronDown, ChevronRight, Download } from "lucide-react";
import { FullPageSpinner } from "../../lib/hooks/useLoading";
import DisciplineBadge from "../ui/DisciplineBadge";
import {
  Card,
  SectionTitle,
  HT_CRITERIA,
  InDevelopment,
  InDevTag,
  Empty,
  fmtDateLong,
  okTag,
  amberTag,
  badTag,
} from "./ui";

const STAGES = [
  { label: "History Taking", real: true },
  { label: "Self-reflection" },
  { label: "HT feedback", real: true },
  { label: "Clinical Reasoning" },
  { label: "CR feedback" },
  { label: "Treatment Planning" },
  { label: "TP feedback" },
];

export default function SessionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [s, setS] = useState(null);
  const [error, setError] = useState("");
  const [showTranscript, setShowTranscript] = useState(false);

  useEffect(() => {
    axios
      .get(`/api/dashboard/v2/session/${id}`)
      .then((r) => setS(r.data))
      .catch((e) => setError(e.response?.data?.message || "Could not load this session."));
  }, [id]);

  if (error) return <div className="p-6"><Empty>{error}</Empty></div>;
  if (!s) return <FullPageSpinner />;

  const done = s.status === "completed";
  const paragraphs = String(s.feedback || "").split(/\n\s*\n/).filter((p) => p.trim());

  return (
    <div className="w-full space-y-5">
      <button onClick={() => navigate(-1)} className="text-sm font-semibold text-orange-600 hover:underline">
        ← Back
      </button>

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs text-gray-500">
              Attempt {s.attempt} at this scenario{s.learner ? ` · ${s.learner.name}` : ""}
            </p>
            <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900">
              {s.scenario.name} <DisciplineBadge scenario={s.scenario} />
            </h1>
            <p className="text-sm text-gray-600">
              {fmtDateLong(s.date)}
              {s.durationMin ? ` · ${s.durationMin} min` : ""}
            </p>
          </div>
          {done ? okTag("Completed") : amberTag("Not finished")}
        </div>

        <ol className="mt-4 flex flex-wrap items-center gap-x-1 gap-y-2 text-xs">
          {STAGES.map((st, i) => {
            const reached = st.real && (st.label === "History Taking" ? s.transcription.length > 0 : done);
            return (
              <li key={st.label} className="flex items-center gap-1">
                <span
                  title={st.real ? "" : "In development"}
                  className={`flex items-center gap-1 rounded-full px-2 py-1 font-semibold ${
                    reached ? "bg-green-50 text-green-700" : st.real ? "bg-gray-100 text-gray-600" : "bg-gray-50 text-gray-400"
                  }`}
                >
                  {reached ? <Check className="h-3 w-3" /> : <Circle className="h-3 w-3" />}
                  {st.label}
                </span>
                {i < STAGES.length - 1 && <ChevronRight className="h-3 w-3 text-gray-300" />}
              </li>
            );
          })}
        </ol>
      </Card>

      {/* Scores */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <Card className="!p-4">
          <p className="text-xs font-semibold text-gray-600">Overall score</p>
          <div className="mt-2"><InDevTag /></div>
          <p className="mt-1 text-xs text-gray-500">Average of HT, CR and TP</p>
        </Card>
        <Card className="!p-4">
          <p className="text-xs font-semibold text-gray-600">History Taking</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{s.ht == null ? "–" : `${s.ht}%`}</p>
          {s.ht != null && (s.ht >= s.target ? okTag(`At or above the ${s.target}% target`) : badTag(`Below the ${s.target}% target`))}
        </Card>
        <Card className="!p-4">
          <p className="text-xs font-semibold text-gray-600">Clinical Reasoning</p>
          <div className="mt-2"><InDevTag /></div>
        </Card>
        <Card className="!p-4">
          <p className="text-xs font-semibold text-gray-600">Treatment Planning</p>
          <div className="mt-2"><InDevTag /></div>
        </Card>
      </div>

      {/* Rubric */}
      <Card>
        <SectionTitle title="History Taking rubric" hint="8 criteria, rated 1–4, most important first" right={<InDevTag />} />
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-[11px] uppercase tracking-wider text-gray-500">
              <th className="py-2">Criterion</th>
              <th className="py-2">Rating</th>
              <th className="py-2">Level</th>
            </tr>
          </thead>
          <tbody>
            {HT_CRITERIA.map((c) => (
              <tr key={c} className="border-b last:border-0">
                <td className="py-2 font-medium text-gray-800">{c}</td>
                <td className="py-2 text-gray-400">– / 4</td>
                <td className="py-2 text-gray-400">–</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-gray-500">
          Per-criterion ratings will be filled in once rubric scoring is connected. The History Taking
          score above is today's score from the feedback questions.
        </p>
      </Card>

      {/* Feedback */}
      <Card>
        <SectionTitle title="History Taking feedback" hint="AI feedback on this consultation" />
        {paragraphs.length ? (
          <div className="space-y-3 text-sm leading-relaxed text-gray-800">
            {paragraphs.map((p, i) => <p key={i}>{p}</p>)}
          </div>
        ) : (
          <Empty>{done ? "No feedback was recorded for this session." : "Feedback appears once the session is finished."}</Empty>
        )}

        <button
          onClick={() => setShowTranscript((v) => !v)}
          className="mt-4 flex items-center gap-1 text-sm font-semibold text-gray-700 hover:text-gray-900"
          disabled={!s.transcription.length}
        >
          {showTranscript ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          History Taking transcript ({s.transcription.length} turns)
        </button>
        {showTranscript && (
          <div className="mt-2 max-h-[420px] space-y-2 overflow-y-auto rounded-lg bg-gray-50 p-3 text-sm">
            {s.transcription.map((t, i) => (
              <p key={i}>
                <span className={`font-semibold ${t.role === "user" ? "text-gray-900" : "text-orange-700"}`}>
                  {t.role === "user" ? "Learner" : "Patient"}:
                </span>{" "}
                <span className="text-gray-700">{t.content}</span>
              </p>
            ))}
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <InDevelopment title="PDF report">
          History Taking report: score summary, evidence per criterion, self-reflection summary, feedback,
          summary and key reminders.
          <button disabled className="mt-2 flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-400">
            <Download className="h-3.5 w-3.5" /> Download PDF report
          </button>
        </InDevelopment>
        <InDevelopment title="Self-reflection summary">
          Captured straight after History Taking, before any feedback is shown: what the learner noticed
          and what they will do differently.
        </InDevelopment>
        <InDevelopment title="Educator comment">
          Human feedback from the educator on this session.
        </InDevelopment>
      </div>
    </div>
  );
}
