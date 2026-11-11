// Pages of the public VPS Clinical website. Content follows the product docs in Notion
// (Learning Architecture v9, Clinical Reasoning rubric v3.2, User Guide v0.5). No pricing:
// every call to action is "Talk to us".
import React, { useState } from "react";
import axios from "axios";
import {
  Mic, MessageSquareText, ClipboardCheck, Brain, RefreshCcw, ShieldCheck, Sparkles, Users, BarChart3, Languages,
  GraduationCap, Building2, Stethoscope, HeartHandshake, Lock, Eye, FileCheck2, CheckCircle2, Clock, Target, Layers, Mail,
} from "lucide-react";
import { toast } from "react-hot-toast";
import SiteLayout, { Section, PageHero, Card, CTA, TalkBand, muted } from "./SiteLayout";
import { Link } from "../lib/router";
import { cn } from "../lib/utils";

const wrap = (Page) => function Wrapped() { return <SiteLayout><Page /></SiteLayout>; };

/* ---------------- Home ---------------- */

const STEPS = [
  [Mic, "History taking", "A spoken conversation with an AI virtual patient, up to 15 minutes. The learner asks; the patient answers like a real one, with cues to pick up."],
  [MessageSquareText, "Guided self-reflection", "Three short questions before any score: how did it go, what went well, what next. Their own view, uninfluenced."],
  [ClipboardCheck, "Feedback and score", "Every checklist item marked met, partly or not, with the moment in the conversation as evidence. On screen and as a PDF."],
  [Brain, "Clinical reasoning", "A conversation with an AI guide that asks for the learner's reasoning, and narrows its questions only when they get stuck."],
  [RefreshCcw, "Try again, differently", "Back to practice with a new case and patient persona, so improvement comes from skill, not memory."],
];

function HomePage() {
  return (
    <>
      <div className="relative overflow-hidden">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 md:grid-cols-[1.1fr_1fr] md:px-6 md:py-24">
          <div>
            <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-[rgb(var(--vx-accent)/0.15)] px-3 py-1 text-sm font-semibold text-[rgb(var(--vx-accent-text))]">
              <Sparkles size={15} /> Virtual patients for health-profession education
            </p>
            <h1 className="text-4xl font-semibold leading-[1.08] tracking-tight md:text-6xl">The practice ground between the classroom and the clinic.</h1>
            <p className={cn("mt-5 max-w-xl text-lg leading-relaxed md:text-xl", muted)}>
              Learners talk to AI patients, reflect, and get feedback they can act on. Educators see exactly where the cohort needs teaching, without marking a single transcript by hand.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <CTA>Talk to us</CTA>
              <CTA to="/how-it-works" variant="secondary">See how it works</CTA>
            </div>
            <p className={cn("mt-6 text-sm", muted)}>Built with the Singapore Institute of Technology · Physiotherapy and Occupational Therapy · English and Japanese</p>
          </div>

          {/* A product glimpse built from real UI pieces, not a screenshot. */}
          <div className="relative">
            <div className="rounded-3xl border border-[rgb(var(--vx-line))] bg-[rgb(var(--vx-card))] p-5 shadow-xl">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-full bg-[rgb(var(--vx-accent)/0.2)] font-semibold">MT</span>
                <div><p className="font-semibold">Mr Tan, 52 · shoulder pain</p><p className={cn("text-sm", muted)}>History taking · 08:42 left</p></div>
                <span className="ml-auto flex items-center gap-1.5 rounded-full bg-[rgb(var(--vx-danger)/0.1)] px-2.5 py-1 text-xs font-semibold text-[rgb(var(--vx-danger))]"><span className="size-1.5 animate-pulse rounded-full bg-current" /> Live</span>
              </div>
              <div className="mt-5 flex flex-col gap-2.5 text-sm">
                <p className="self-end rounded-2xl rounded-br-md bg-[rgb(var(--vx-accent))] px-3.5 py-2 text-[rgb(var(--vx-on-accent))]">How has the pain affected your work?</p>
                <p className="max-w-[85%] rounded-2xl rounded-bl-md bg-[rgb(var(--vx-cell))] px-3.5 py-2">I can't lift boxes like I used to. My supervisor has noticed.</p>
                <p className="self-end rounded-2xl rounded-br-md bg-[rgb(var(--vx-accent))] px-3.5 py-2 text-[rgb(var(--vx-on-accent))]">Which tasks are hardest?</p>
              </div>
            </div>
            <div className="absolute -bottom-8 -left-4 w-64 rounded-2xl border border-[rgb(var(--vx-line))] bg-[rgb(var(--vx-card))] p-4 shadow-xl md:-left-10">
              <p className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--vx-accent-text))]">Feedback</p>
              {[["Red flags & safety", 100], ["Psychosocial context", 75], ["Follow-up & probing", 50]].map(([k, v]) => (
                <div key={k} className="mt-2">
                  <div className="flex justify-between text-xs"><span>{k}</span><b className="tabular-nums">{v}%</b></div>
                  <div className="mt-1 h-1.5 rounded-full bg-[rgb(var(--vx-cell))]"><div className="h-full rounded-full bg-[rgb(var(--vx-accent))]" style={{ width: `${v}%` }} /></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <Section eyebrow="Why it matters" title="Clinical skill is built by practising, not by reading about it."
        intro="History taking shapes most of a diagnosis, yet learners get few chances to practise it before they meet real patients. VPS Clinical gives them as many as they need, in a space where mistakes are safe.">
        <div className="grid gap-4 md:grid-cols-3">
          <Card icon={ShieldCheck} title="Safe to get it wrong">Dedicated practice scenarios are never graded or shown to educators. Learners rehearse without the fear of being watched.</Card>
          <Card icon={Target} title="Feedback that teaches">Not just a number: each skill, the evidence from the conversation, and one clear thing to do next time.</Card>
          <Card icon={Clock} title="Fifteen minutes at a time">Short sessions that fit between classes, on any laptop with a microphone. No headset, no lab booking.</Card>
        </div>
      </Section>

      <div className="bg-[rgb(var(--vx-card))]">
        <Section eyebrow="One session" title="Practise, reflect, learn, and try again." intro="Every step routes the learner back into practice, changed enough that it cannot be memorised.">
          <ol className="grid gap-4 md:grid-cols-5">
            {STEPS.map(([Icon, t, d], i) => (
              <li key={t} className="relative rounded-2xl border border-[rgb(var(--vx-line)/0.7)] bg-[rgb(var(--vx-bg))] p-5">
                <span className={cn("text-sm font-semibold tabular-nums", muted)}>0{i + 1}</span>
                <Icon className="my-3 text-[rgb(var(--vx-accent-text))]" size={24} />
                <h3 className="font-semibold">{t}</h3>
                <p className={cn("mt-1.5 text-sm leading-relaxed", muted)}>{d}</p>
              </li>
            ))}
          </ol>
          <div className="mt-8"><CTA to="/how-it-works" variant="secondary">The full learning design</CTA></div>
        </Section>
      </div>

      <Section eyebrow="Two sides of one platform" title="For the people who learn, and the people who teach.">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl bg-[rgb(var(--vx-accent))] p-8 text-[rgb(var(--vx-on-accent))]">
            <GraduationCap size={28} />
            <h3 className="mt-4 text-2xl font-semibold">Learners</h3>
            <ul className="mt-4 flex flex-col gap-2.5 text-base">
              {["A current focus: the one skill with most room to grow", "Their trend on it across attempts", "A recommended next case, matched to that focus", "A private coach that never gives the answers away", "No rankings, ever. Only they and their educator see results"].map((x) => (
                <li key={x} className="flex gap-2.5"><CheckCircle2 size={20} className="mt-0.5 shrink-0" />{x}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-3xl border border-[rgb(var(--vx-line))] bg-[rgb(var(--vx-card))] p-8">
            <Stethoscope size={28} className="text-[rgb(var(--vx-accent-text))]" />
            <h3 className="mt-4 text-2xl font-semibold">Educators</h3>
            <ul className={cn("mt-4 flex flex-col gap-2.5 text-base", muted)}>
              {["Write a case in plain words; AI drafts the patient, you approve", "See where the cohort is below standard, by skill", "Know who needs you today, and write to them in one go", "Read any transcript and overrule the AI: you stay the judge", "Readiness proposed for the practical exam; you decide"].map((x) => (
                <li key={x} className="flex gap-2.5"><CheckCircle2 size={20} className="mt-0.5 shrink-0 text-[rgb(var(--vx-ok))]" /><span className="text-[rgb(var(--vx-ink))]">{x}</span></li>
              ))}
            </ul>
            <Link to="/for-educators" className="mt-6 inline-block font-semibold text-[rgb(var(--vx-accent-text))] hover:underline">More for educators →</Link>
          </div>
        </div>
      </Section>

      <div className="bg-[rgb(var(--vx-card))]">
        <Section eyebrow="Where it fits" title="From knows how to shows how."
          intro="Miller's pyramid describes how clinical competence builds up. Lectures cover knowing; placements cover doing. VPS Clinical fills the two tiers in between: applying knowledge to a case, and performing it in a simulated encounter.">
          <div className="mx-auto flex max-w-xl flex-col items-center gap-2">
            {[["Does", "Real patients, on placement", false, "60%"], ["Shows how", "Simulated encounters", true, "75%"], ["Knows how", "Applying knowledge to cases", true, "90%"], ["Knows", "Lectures and self-study", false, "100%"]].map(([t, d, on, w]) => (
              <div key={t} style={{ width: w }} className={cn("rounded-xl px-4 py-3 text-center", on ? "bg-[rgb(var(--vx-accent))] text-[rgb(var(--vx-on-accent))]" : "bg-[rgb(var(--vx-cell))]")}>
                <p className="font-semibold">{t}</p><p className={cn("text-sm", on ? "opacity-85" : muted)}>{d}</p>
              </div>
            ))}
          </div>
        </Section>
      </div>

      <Section eyebrow="Questions" title="What people ask us first">
        <div className="grid gap-x-10 gap-y-8 md:grid-cols-2">
          {[
            ["Does it replace standardised patients or placements?", "No. It adds practice before and between them, so learners arrive better prepared and educators spend contact time on what the data says needs it."],
            ["Who writes the cases?", "Your educators, in plain language. The AI drafts the patient's story, persona and feedback questions; an educator reviews and approves everything before learners see it."],
            ["How accurate is the AI grading?", "Every verdict comes with the evidence quoted from the conversation, and educators can overrule any of them. The platform also shows where educators most often disagree with the AI."],
            ["What do learners need?", "A browser and a microphone. Sessions run in English or Japanese."],
            ["Which professions does it support?", "Physiotherapy and Occupational Therapy today, with musculoskeletal cases. Tell us what you teach; new professions follow the same design."],
            ["How do we start?", "With a conversation and a pilot around your own curriculum. There is no self-serve sign-up and no public price list: we set it up with you."],
          ].map(([q, a]) => (
            <div key={q}><h3 className="text-lg font-semibold">{q}</h3><p className={cn("mt-2 text-base leading-relaxed", muted)}>{a}</p></div>
          ))}
        </div>
      </Section>

      <TalkBand />
    </>
  );
}

/* ---------------- How it works ---------------- */

function HowItWorksPage() {
  return (
    <>
      <PageHero eyebrow="How it works" title="One platform, two journeys."
        intro="The educator prepares, publishes and follows the data. The learner practises, reflects, learns and tries again. Learning happens in five distinct places, and every one of them leads back into practice.">
        <CTA>Talk to us</CTA>
      </PageHero>
      <Section eyebrow="The learner" title="A session, step by step">
        <ol className="flex flex-col gap-4">
          {[
            ["History taking (up to 15 minutes)", "From their dashboard, the learner starts a spoken conversation with an AI virtual patient. The goal: focused, well-sequenced questions that narrow the possibilities. The patient answers naturally, including cues that only come out if the learner follows up."],
            ["Guided self-reflection (3–5 minutes)", "Before any score is shown: How do you feel you did, and why? What went well, and what would you change? What will you do differently next time? Their own judgement, not shaped by the feedback."],
            ["Feedback and score", "Released only after reflection, on screen and as a PDF. Each skill (presenting concern, red flags, psychosocial context, follow-up and more) with the evidence from the conversation and a clear next step."],
            ["Clinical reasoning", "A natural-language conversation with an AI guide. It opens with broad questions; a confident learner reasons through unaided, a stuck one gets narrower questions until they reach a justified diagnosis. The reasoning is assessed, not just the conclusion."],
            ["Retry with a new case", "Back to history taking with a different scenario and patient persona. Improvement comes from practising under new conditions, not from repeating a fixed exercise."],
          ].map(([t, d], i) => (
            <li key={t} className="flex gap-5 rounded-2xl border border-[rgb(var(--vx-line)/0.7)] bg-[rgb(var(--vx-card))] p-6">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[rgb(var(--vx-accent))] font-semibold text-[rgb(var(--vx-on-accent))]">{i + 1}</span>
              <div><h3 className="text-lg font-semibold">{t}</h3><p className={cn("mt-1.5 text-base leading-relaxed", muted)}>{d}</p></div>
            </li>
          ))}
        </ol>
        <p className={cn("mt-6 text-sm", muted)}>Treatment planning, with structured plans and written feedback, is on the roadmap.</p>
      </Section>
      <div className="bg-[rgb(var(--vx-card))]">
        <Section eyebrow="The educator" title="Create, test, publish, follow, improve">
          <div className="grid gap-4 md:grid-cols-4">
            <Card icon={Sparkles} title="Create">Describe the case in plain words. The AI drafts the patient, persona variants and feedback questions. You review and approve; you remain clinically responsible.</Card>
            <Card icon={FileCheck2} title="Test">Run the case yourself before learners do. Change anything, and keep a bank of rubric items to reuse across cases.</Card>
            <Card icon={Users} title="Publish">Assign to learners or to whole classes. Learners join a class with a six-character code you show in the room.</Card>
            <Card icon={BarChart3} title="Follow">Who is active, who is at risk, which skills are below standard, and what learners said in their own reflections.</Card>
          </div>
        </Section>
      </div>
      <Section eyebrow="Assessment" title="How the scoring works">
        <div className="grid gap-4 md:grid-cols-2">
          <Card icon={ClipboardCheck} title="History taking">A fixed checklist for every case plus questions specific to it, grouped under eight criteria in order of importance, from relevant history gathering to presenting concern exploration.</Card>
          <Card icon={Brain} title="Clinical reasoning">Five weighted criteria: cue recognition, hypothesis generation, analysis of findings, red flags and safety, and justification. The support a learner needed caps each rating, so independent reasoning counts for more.</Card>
        </div>
      </Section>
      <TalkBand />
    </>
  );
}

/* ---------------- For educators ---------------- */

function EducatorsPage() {
  const feats = [
    [Target, "Where the cohort is below standard", "By skill, not by question: what to teach next. Group-level, with no names, so it can go on a projector."],
    [Users, "Who needs you today", "Never signed in, assigned but not started, quiet for two weeks, averaging under half. Write to a whole group in one go."],
    [Eye, "You stay the judge", "Every AI verdict has its evidence. Change any of them; the platform counts where you disagree with the AI, so you know where to trust it."],
    [CheckCircle2, "Readiness for the practical exam", "Proposed from clear rules, with the reasons. One click to overrule, and everyone sees who decided."],
    [Layers, "Rubric bank", "Paste your existing checklist; it is split into reusable feedback questions you can add to any case."],
    [Sparkles, "An assistant for your data", "Ask who needs attention, which skills are weakest, or to draft a reminder. Nothing changes until you press Confirm."],
  ];
  return (
    <>
      <PageHero eyebrow="For educators" title="Know where to teach, without marking every transcript."
        intro="VPS Clinical does the repetitive part: listening to every practice session and checking it against your criteria. You get the picture, and the final word.">
        <CTA>Talk to us</CTA>
      </PageHero>
      <Section>
        <div className="grid gap-4 md:grid-cols-3">{feats.map(([I, t, d]) => <Card key={t} icon={I} title={t}>{d}</Card>)}</div>
      </Section>
      <div className="bg-[rgb(var(--vx-card))]">
        <Section eyebrow="In class" title="Small things that save time every week">
          <ul className="grid gap-x-10 gap-y-4 md:grid-cols-2">
            {["Class join codes, shown full-screen on the projector", "Every number explains how it is calculated", "Filters remembered in the link, so Back works", "Print a one-page summary for your programme lead",
              "Learners' own reflection next to their score", "Flags from learners when the patient misheard them", "Realism ratings to improve your cases", "Dark mode and keyboard shortcuts"].map((x) => (
              <li key={x} className="flex gap-3 text-base"><CheckCircle2 size={20} className="mt-0.5 shrink-0 text-[rgb(var(--vx-ok))]" />{x}</li>
            ))}
          </ul>
        </Section>
      </div>
      <TalkBand />
    </>
  );
}

/* ---------------- For institutions ---------------- */

function InstitutionsPage() {
  return (
    <>
      <PageHero eyebrow="For institutions" title="Objective practice data across every cohort."
        intro="A standardised learning experience for every learner, and a clear view of learning progress for programme leads, from institution to cohort to individual session.">
        <CTA>Talk to us</CTA>
      </PageHero>
      <Section>
        <div className="grid gap-4 md:grid-cols-3">
          <Card icon={Building2} title="School-wide overview">Learners at target, who is active, progress from first to latest session, and cohort comparison, with the same drill-down educators have.</Card>
          <Card icon={Users} title="Educators and cohorts">Add educators and learners, organise classes, and see which educators' cohorts are practising.</Card>
          <Card icon={BarChart3} title="Gap analysis">Map cohort performance against your competency standards and target practice where it is needed most.</Card>
          <Card icon={Languages} title="Languages">English and Japanese today, for the interface and the patient conversation.</Card>
          <Card icon={Lock} title="Data protection">Role-based access, data kept to what teaching needs, and practice scenarios that are never recorded. See Data and AI.</Card>
          <Card icon={HeartHandshake} title="Set up with you">A pilot around your curriculum, onboarding for educators, and a named contact. No self-serve sign-up.</Card>
        </div>
      </Section>
      <div className="bg-[rgb(var(--vx-card))]">
        <Section eyebrow="Outcomes we design for" title="What learners and educators get out of it">
          <div className="grid gap-4 md:grid-cols-2">
            <Card title="For learners">Improved clinical confidence, less performance anxiety, and stronger history-taking, clinical-reasoning and treatment-planning skills.</Card>
            <Card title="For educators">Objective performance data, a standardised learning experience, and contact time spent where it matters.</Card>
          </div>
        </Section>
      </div>
      <TalkBand />
    </>
  );
}

/* ---------------- About ---------------- */

function AboutPage() {
  return (
    <>
      <PageHero eyebrow="About" title="Built by clinicians, educators and engineers, together."
        intro="VPS Clinical is made by Silver Wings XR in collaboration with the Singapore Institute of Technology, as part of the InnovSpur programme." />
      <Section>
        <div className="grid gap-10 md:grid-cols-2">
          <div className="flex flex-col gap-4 text-lg leading-relaxed">
            <p>We started from a simple observation: learners in health professions get too few chances to practise talking to patients before they meet real ones, and educators have too little time to listen to every practice attempt.</p>
            <p className={muted}>So we built virtual patients that talk back, a reflection step that comes before the score, and feedback grounded in published clinical-reasoning rubrics. Domain experts review every rubric, and educators approve every case.</p>
            <p className={muted}>Our guiding principle: learning happens through repeated, varied practice with feedback and reflection, not through a single assessed attempt.</p>
          </div>
          <div className="grid gap-4">
            <Card icon={Stethoscope} title="Clinically grounded">Rubrics and case design developed with physiotherapy and occupational therapy educators.</Card>
            <Card icon={HeartHandshake} title="Educator in the loop">AI drafts and grades; people approve, review and decide.</Card>
            <Card icon={ShieldCheck} title="Safe by design">A protected practice space, distress-aware reflection, and no rankings between learners.</Card>
          </div>
        </div>
      </Section>
      <TalkBand />
    </>
  );
}

/* ---------------- Trust: data and AI ---------------- */

function TrustPage() {
  return (
    <>
      <PageHero eyebrow="Data and AI" title="How we handle learner data and AI."
        intro="Plain answers to the questions programme leads and data protection officers ask us." />
      <Section>
        <div className="grid gap-4 md:grid-cols-2">
          <Card icon={Lock} title="Who sees what">Learners see only their own results. Educators see their own learners; school admins see their school. Practice and familiarisation scenarios are not recorded.</Card>
          <Card icon={Sparkles} title="Where AI is used">To voice the virtual patient, to guide reflection and reasoning, to grade against your checklist, to draft cases for educator approval, and in the assistant. AI never publishes a case or changes data on its own.</Card>
          <Card icon={Eye} title="People decide">Every grading verdict shows its evidence and can be overruled by an educator. Readiness decisions are proposals that educators confirm or change.</Card>
          <Card icon={HeartHandshake} title="Learner wellbeing">If a learner shows distress during reflection, the session ends gently and no score is given; their educator is made aware.</Card>
          <Card icon={FileCheck2} title="Third-party AI providers">Conversation text is processed by AI model providers under contract to generate responses and feedback. We do not allow them to train on your data where the provider offers that choice.</Card>
          <Card icon={Mail} title="Questions or requests">Ask us for our data processing terms, a list of sub-processors, or to export or delete your institution's data, through the contact page.</Card>
        </div>
      </Section>
      <TalkBand />
    </>
  );
}

/* ---------------- Contact ---------------- */

function ContactPage() {
  const [f, setF] = useState({ name: "", email: "", organisation: "", role: "", topic: "A pilot for my institution", message: "", website: "" });
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await axios.post("/api/contact", f);
      setSent(true);
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not send. Please try again.");
    } finally { setBusy(false); }
  };
  const field = "h-12 w-full rounded-xl border border-[rgb(var(--vx-line))] bg-[rgb(var(--vx-bg))] px-4 text-base outline-none focus:border-[rgb(var(--vx-accent))] focus:ring-2 focus:ring-[rgb(var(--vx-accent)/0.3)]";
  return (
    <>
      <PageHero eyebrow="Contact" title="Talk to us."
        intro="Tell us what you teach and what you would like learners to practise. We reply within two working days, usually sooner. There is no price list: we shape every pilot around the institution." />
      <Section>
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr]">
          {sent ? (
            <div className="flex flex-col items-start gap-3 rounded-3xl border border-[rgb(var(--vx-line))] bg-[rgb(var(--vx-card))] p-8">
              <CheckCircle2 size={36} className="text-[rgb(var(--vx-ok))]" />
              <h2 className="text-2xl font-semibold">Thank you, {f.name.split(" ")[0]}.</h2>
              <p className={cn("text-lg", muted)}>We have your message and will reply to {f.email} shortly.</p>
              <CTA to="/" variant="secondary">Back to home</CTA>
            </div>
          ) : (
            <form onSubmit={submit} className="flex flex-col gap-4 rounded-3xl border border-[rgb(var(--vx-line))] bg-[rgb(var(--vx-card))] p-6 md:p-8">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="flex flex-col gap-1.5 text-sm font-medium">Your name<input required className={field} value={f.name} onChange={set("name")} autoComplete="name" /></label>
                <label className="flex flex-col gap-1.5 text-sm font-medium">Work email<input required type="email" className={field} value={f.email} onChange={set("email")} autoComplete="email" /></label>
                <label className="flex flex-col gap-1.5 text-sm font-medium">Institution<input className={field} value={f.organisation} onChange={set("organisation")} autoComplete="organization" /></label>
                <label className="flex flex-col gap-1.5 text-sm font-medium">Your role<input className={field} value={f.role} onChange={set("role")} placeholder="e.g. Programme lead" /></label>
              </div>
              <label className="flex flex-col gap-1.5 text-sm font-medium">What is it about?
                <select className={field} value={f.topic} onChange={set("topic")}>
                  {["A pilot for my institution", "A demo", "Research collaboration", "Support for an existing account", "Data protection", "Something else"].map((t) => <option key={t}>{t}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-medium">Message
                <textarea required rows={6} className={cn(field, "h-auto py-3")} value={f.message} onChange={set("message")} placeholder="Which profession, how many learners, and what you would like them to practise." />
              </label>
              {/* Honeypot, hidden from people. */}
              <input tabIndex={-1} autoComplete="off" value={f.website} onChange={set("website")} className="hidden" aria-hidden="true" />
              <div className="flex flex-wrap items-center gap-4">
                <button disabled={busy} className="inline-flex h-12 items-center rounded-full bg-[rgb(var(--vx-accent))] px-7 text-base font-semibold text-[rgb(var(--vx-on-accent))] disabled:opacity-60">{busy ? "Sending…" : "Send message"}</button>
                <p className={cn("text-sm", muted)}>We use your details only to reply. See our <Link to="/privacy" className="underline">privacy policy</Link>.</p>
              </div>
            </form>
          )}
          <div className="flex flex-col gap-4">
            <Card icon={Building2} title="Institutions">Pilots, onboarding and licences, shaped around your curriculum and cohort size.</Card>
            <Card icon={GraduationCap} title="Existing users">Educators and learners: sign in and use the assistant, or ask your school admin first.</Card>
            <Card icon={Lock} title="Data protection">Data processing terms, sub-processors, and export or deletion requests.</Card>
          </div>
        </div>
      </Section>
    </>
  );
}

/* ---------------- Legal ---------------- */

function Legal({ title, updated, intro, sections }) {
  return (
    <>
      <PageHero eyebrow="Legal" title={title} intro={intro} />
      <Section>
        <div className="grid gap-10 md:grid-cols-[14rem_1fr]">
          <nav className="hidden md:block" aria-label="On this page">
            <ul className="sticky top-24 flex flex-col gap-2 text-sm">
              {sections.map(([h], i) => <li key={h}><a href={`#s${i}`} className={cn("hover:text-[rgb(var(--vx-ink))]", muted)}>{h}</a></li>)}
            </ul>
          </nav>
          <article className="flex max-w-3xl flex-col gap-8">
            <p className={cn("text-sm", muted)}>Last updated {updated}</p>
            {sections.map(([h, body], i) => (
              <section key={h} id={`s${i}`} className="scroll-mt-24">
                <h2 className="text-xl font-semibold">{i + 1}. {h}</h2>
                <div className={cn("mt-2 flex flex-col gap-3 text-base leading-relaxed", muted)}>{(Array.isArray(body) ? body : [body]).map((p, j) => <p key={j}>{p}</p>)}</div>
              </section>
            ))}
            <p className={cn("text-sm", muted)}>Questions about this document: use the <Link to="/contact" className="underline">contact page</Link> and choose "Data protection".</p>
          </article>
        </div>
      </Section>
    </>
  );
}

const UPDATED = "8 November 2026";

function TermsPage() {
  return <Legal title="Terms of service" updated={UPDATED}
    intro="These terms govern use of VPS Clinical. Your institution's agreement with us takes precedence where it differs."
    sections={[
      ["Who we are", "VPS Clinical is provided by Silver Wings XR (\"we\", \"us\"). By using the service you agree to these terms."],
      ["Accounts", ["Accounts are created by an institution, an educator or us. There is no public sign-up.", "Keep your sign-in details private and tell your administrator or us if you think your account has been misused. You are responsible for activity under your account."]],
      ["The service", ["VPS Clinical provides AI virtual patients, feedback and educator tools for health-profession education.", "It is an educational tool. It is not a medical device, does not give medical advice, and must not be used to diagnose or treat real patients."]],
      ["AI-generated content", ["Patients, feedback, grades, drafts and assistant answers are generated by AI and can be wrong or incomplete. Educators remain responsible for the cases they publish and for any assessment decision.", "Do not rely on AI output as the sole basis for a formal or high-stakes decision about a learner."]],
      ["Your content", ["Institutions and educators keep ownership of the cases, rubrics and notes they create. You give us the rights needed to host and process that content to provide the service.", "Do not upload real patient information or other personal data that is not needed for teaching."]],
      ["Acceptable use", "Use the service lawfully and as described in our Acceptable use policy. We may suspend accounts that break it."],
      ["Availability and changes", "We work to keep the service available and secure but do not guarantee uninterrupted access. We improve the service over time and will give reasonable notice of material changes to these terms."],
      ["Intellectual property", "The software, design, rubrics and default scenarios are ours or our licensors'. You may not copy, resell or reverse-engineer the service except as the law allows."],
      ["Liability", "To the extent permitted by law, we are not liable for indirect or consequential loss. Our total liability is limited as set out in your institution's agreement, or otherwise to the fees paid in the twelve months before the claim."],
      ["Ending use", "Your institution may end access under its agreement. We may suspend or end access for serious or repeated breaches of these terms. On ending, we delete or return institution data as set out in our Privacy policy."],
      ["Governing law", "These terms are governed by the laws of Singapore, unless your institution's agreement says otherwise."],
    ]} />;
}

function PrivacyPage() {
  return <Legal title="Privacy policy" updated={UPDATED}
    intro="What personal data VPS Clinical processes, why, and the choices you have. For learners and educators, your institution is usually the controller and we process data on its behalf."
    sections={[
      ["Roles", "When an institution uses VPS Clinical, the institution decides why learner and educator data is processed (controller) and we process it on its instructions (processor). For visitors to this website and people who contact us, we are the controller."],
      ["What we collect", ["Account data: name, email, role, institution, class.", "Learning data: session recordings converted to text transcripts, self-reflections, scores, feedback, educator notes and verdict changes, and ratings or flags learners give.", "Technical data: sign-in times, device and browser information, and logs needed to run and secure the service.", "Website enquiries: what you send us through the contact form."]],
      ["Why we use it", ["To provide the service: run sessions, generate feedback, show dashboards, send emails your educator writes.", "To keep it secure and working, and to improve it in aggregate.", "To reply to enquiries.", "We do not sell personal data or use it for advertising."]],
      ["Audio and transcripts", "Microphone audio is converted to text to run the conversation. The transcript and feedback are kept as part of the learner's record; practice and familiarisation scenarios are not recorded for educators."],
      ["AI providers and sub-processors", "We use carefully chosen providers for hosting, email, speech and AI models. They process data only to provide their service to us, under contract. Where providers offer it, we opt out of model training on your data. A current list is available on request."],
      ["Wellbeing information", "Self-reflection can include how a learner felt. If signs of distress appear, the session ends gently and the learner's educator is made aware, so they can offer support."],
      ["Retention", "We keep institution data for as long as the institution's agreement runs, then delete or return it within a reasonable period, except where the law requires us to keep it. Contact enquiries are kept for up to two years."],
      ["Security", "Role-based access, encryption in transit, restricted administrative access and logging. No system is perfectly secure; we will notify affected institutions of a personal data breach as the law requires."],
      ["International transfers", "Some providers process data outside your country. Where that happens we rely on appropriate safeguards such as contractual clauses."],
      ["Your rights", "Depending on where you live you may access, correct, export or delete your data, or object to some processing. Learners and educators should usually contact their institution first; we will help it respond. You may also complain to your data protection authority."],
      ["Children", "VPS Clinical is intended for adult learners in higher and professional education."],
      ["Changes", "We will update this page when our practices change and show the date at the top."],
    ]} />;
}

function AcceptableUsePage() {
  return <Legal title="Acceptable use policy" updated={UPDATED}
    intro="A short list of what not to do, so the service stays safe and useful for everyone."
    sections={[
      ["Do not", ["Upload real patient records or identifiable health information.", "Share your account or let others use your sign-in.", "Try to access data that is not yours, or to get around access controls.", "Use the service to harass anyone, including through messages to learners.", "Try to make the AI produce harmful, discriminatory or explicit content.", "Scrape, overload, probe or reverse-engineer the service."]],
      ["Assessment integrity", "Learners should do their own sessions. Educators should treat AI grades as evidence to review, not as final marks."],
      ["Reporting", "Report misuse or a security concern through the contact page. We act on reports promptly."],
    ]} />;
}

function CookiesPage() {
  return <Legal title="Cookies and local storage" updated={UPDATED}
    intro="We keep this minimal."
    sections={[
      ["What we use", ["Essential: storage that keeps you signed in and remembers settings such as theme, language and dismissed tours.", "We do not use advertising or cross-site tracking cookies."]],
      ["Third parties", "Fonts are loaded from Google Fonts, which may receive your IP address as part of the request."],
      ["Your choices", "You can clear stored data in your browser at any time. Doing so signs you out and resets your preferences."],
    ]} />;
}

export const SiteHome = wrap(HomePage);
export const SiteHowItWorks = wrap(HowItWorksPage);
export const SiteEducators = wrap(EducatorsPage);
export const SiteInstitutions = wrap(InstitutionsPage);
export const SiteAbout = wrap(AboutPage);
export const SiteTrust = wrap(TrustPage);
export const SiteContact = wrap(ContactPage);
export const SiteTerms = wrap(TermsPage);
export const SitePrivacy = wrap(PrivacyPage);
export const SiteAcceptableUse = wrap(AcceptableUsePage);
export const SiteCookies = wrap(CookiesPage);
