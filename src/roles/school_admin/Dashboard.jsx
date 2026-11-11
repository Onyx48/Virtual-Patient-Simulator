// School admin dashboard in the vx design, with bklit charts (mindsets/school-admin.md): adoption
// first, then who needs help, then the school's learning picture. Reuses the educator panels, whose
// endpoints already scope a school_admin to their school.
import React, { useEffect, useMemo, useState } from "react";
import { useData } from "../../lib/query";
import axios from "axios";
import { GraduationCap, BookOpen, Printer, ChevronRight } from "lucide-react";
import { useAuth } from "../../AuthContext";
import { useNavigate } from "../../lib/router";
import { getAuthHeaders, cn } from "../../lib/utils.js";
import { BarChart } from "@/components/charts/bar-chart";
import { Bar } from "@/components/charts/bar";
import { BarXAxis } from "@/components/charts/bar-x-axis";
import { Grid } from "@/components/charts/grid";
import { ChartTooltip } from "@/components/charts/tooltip";
import { Button } from "@/components/vx/ui";
import { ToolbarToggle } from "@/components/vx/list";
import { Ago } from "@/components/vx/bits";
import TranscriptViewerModal from "@/components/ui/TranscriptViewerModal";
import { Panel, CohortMisses, RecentSessions, ScoreSpread, DistressAlert, StudentFlags, Calibration } from "../educator/Dashboard";
import "@/components/vx/vx.css";
import { useLearningOverview, LearningStats, LearningGaps, LearnersTable, CohortTable, CohortSwitch, Stat } from "../educator/learning";

const muted = "text-[rgb(var(--vx-muted))]";
const SERIES = [
  { value: "students", label: "Students" },
  { value: "educators", label: "Educators" },
  { value: "scenarios", label: "Scenarios" },
];

export default function SchoolAdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const stats = useData("/api/dashboard/school-admin-stats", { fallback: {} });
  const overview = useData("/api/dashboard/educators-overview", { fallback: { educators: [] } });
  const summary = useData("/api/dashboard/scenario-summary", { fallback: { total: 0, published: 0, withSessions: [] } });
  const scenarios = summary?.withSessions || [];
  const groups = useData("/api/groups", { fallback: [] }) || [];
  const [series, setSeries] = useState("students");
  const [since, setSince] = useState("30");
  const [groupId, setGroupId] = useState("");
  const [transcript, setTranscript] = useState(null);


  const learning = useLearningOverview(groupId);
  const groupsById = useMemo(() => new Map(groups.map((g) => [g._id, g.name])), [groups]);
  const filters = useMemo(() => ({ ...(groupId && { groupId }), ...(since !== "all" && { since }) }), [groupId, since]);
  const first = String(user?.name || "").split(/\s+/).find((w) => w && !/^(dr|prof|mr|mrs|ms|miss|mx)\.?$/i.test(w)) || "";
  const eds = overview?.educators || [];
  const activeEds = eds.filter((e) => e.sessions30 > 0).length;
  const published = summary?.published ?? 0;

  return (
    <div className="vx min-h-full px-4 pb-16 pt-6 md:px-6">
      <div className="flex flex-col gap-5">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">{first ? `Welcome back, ${first}` : "Dashboard"}</h1>
          <Button variant="secondary" onClick={() => window.print()} className="print:hidden" title="Print or save as PDF for your dean or a report">
            <Printer /> Print summary
          </Button>
        </header>

        <DistressAlert navigate={navigate} />
        <StudentFlags onOpen={(r) => setTranscript(r)} />

        <CohortSwitch groups={groups} value={groupId} onChange={setGroupId} totals={learning?.totals} />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <LearningStats data={learning} onLearners={() => navigate("/students")} />
          <Stat icon={GraduationCap} label="Educators using it" value={overview ? `${activeEds} of ${eds.length}` : "…"}
            hint={overview ? `${overview.sessions30} sessions in 30 days` : ""} onClick={() => navigate("/educators")}
            info="Educators with at least one student session in the last 30 days, out of all educators in the school." />
          <Stat icon={BookOpen} label="Scenarios" value={stats ? stats.totalScenarios ?? summary?.total ?? 0 : "…"} hint={`${published} published`}
            onClick={() => navigate("/scenarios")} info="All scenarios in the school. Published ones can be assigned to learners." />
        </div>

        {!groupId && <CohortTable data={learning} onPick={setGroupId} current={groupId} />}

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
          <Panel title="Educators" className="xl:col-span-2"
            action={<Button variant="secondary" size="sm" onClick={() => navigate("/educators")}>All educators <ChevronRight /></Button>}>
            {!overview ? <div className="h-48 animate-pulse rounded-2xl bg-[rgb(var(--vx-cell)/0.7)]" /> : eds.length === 0 ? (
              <p className={cn("py-10 text-center text-base", muted)}>No educators yet. Add them on the Educators page.</p>
            ) : (
              <div className="-mx-5 overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead className="border-y border-[rgb(var(--vx-line)/0.7)] bg-[rgb(var(--vx-cell)/0.5)]">
                    <tr>
                      {["Educator", "Students", "Scenarios", "Sessions (30 d)", "Last session"].map((h, i) => (
                        <th key={h} className={cn("whitespace-nowrap px-5 py-2.5 text-sm font-medium", muted, i ? "text-right" : "text-left")}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[rgb(var(--vx-line)/0.7)]">
                    {eds.slice(0, 6).map((e) => (
                      <tr key={e._id}>
                        <td className="max-w-xs px-5 py-3">
                          <div className="truncate text-base font-semibold">{e.name}</div>
                          <div className={cn("truncate text-sm", muted)}>{e.email}</div>
                        </td>
                        <td className="px-5 py-3 text-right text-base tabular-nums">{e.students}</td>
                        <td className="px-5 py-3 text-right text-base tabular-nums">{e.scenarios}<span className={cn("text-sm", muted)}> · {e.published} live</span></td>
                        <td className="px-5 py-3 text-right text-base font-semibold tabular-nums">{e.sessions30}</td>
                        <td className={cn("whitespace-nowrap px-5 py-3 text-right text-base", !e.lastSessionAt && muted)}><Ago date={e.lastSessionAt} fallback="None yet" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <Panel title="Added each month" action={
            <div className="flex [&>div]:flex [&>div]:h-9 [&>div]:items-center [&>div]:rounded-full [&>div]:bg-[rgb(var(--vx-cell))] [&_button]:h-7 [&_button]:px-3 [&_button]:text-sm">
              <ToolbarToggle label="Series" value={series} onChange={setSeries} options={SERIES} />
            </div>
          }>
            {!stats ? <div className="h-56 animate-pulse rounded-2xl bg-[rgb(var(--vx-cell)/0.7)]" /> : !(stats.chartData || []).length ? (
              <p className={cn("py-10 text-center text-base", muted)}>Nothing added in the last six months.</p>
            ) : (
              <div className="vx-chart">
                <BarChart data={stats.chartData} xDataKey="name" aspectRatio="auto" className="h-[240px]"
                  margin={{ top: 12, right: 8, bottom: 32, left: 8 }} maxBarWidth={36} animationDuration={600} revealSignature={series}>
                  <Grid horizontal vertical={false} />
                  <Bar dataKey={series} fill="var(--chart-1)" />
                  <BarXAxis showAllLabels />
                  <ChartTooltip rows={(p) => [{ color: "var(--chart-1)", label: `New ${series}`, value: p[series] ?? 0 }]} />
                </BarChart>
              </div>
            )}
          </Panel>
        </div>

        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <span className={cn("mr-1 text-sm font-medium", muted)}>Showing</span>
            <div className="flex [&>div]:flex [&>div]:h-11 [&>div]:items-center [&>div]:rounded-full [&>div]:bg-[rgb(var(--vx-cell))]">
              <ToolbarToggle label="Period" value={since} onChange={setSince}
                options={[{ value: "7", label: "7 days" }, { value: "30", label: "30 days" }, { value: "90", label: "90 days" }, { value: "all", label: "All time" }]} />
            </div>
          </div>
          <LearnersTable data={learning} groupsById={groupsById} onAll={() => navigate("/students")}
            onOpen={(l) => navigate(`/students?q=${encodeURIComponent(l.email || l.name || "")}`)} />
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            <LearningGaps data={learning} />
            <CohortMisses navigate={navigate} filters={filters} />
          </div>
          <RecentSessions filters={filters} onOpen={(r) => setTranscript(r)} />
          <ScoreSpread filters={filters} scenarios={scenarios} />
          <Calibration />
        </section>

        {transcript && (
          <TranscriptViewerModal isOpen onClose={() => setTranscript(null)}
            student={{ id: transcript.studentId, name: transcript.studentName }} initialSessionId={transcript.sessionId} />
        )}
      </div>
    </div>
  );
}
