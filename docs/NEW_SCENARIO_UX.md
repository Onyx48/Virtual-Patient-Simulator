# New Scenario: redesign plan

Model: internal-shortlisting's HR **New opening** page (see `DESIGN_SYSTEM.md` §6–7). Today ours is `src/components/shared/ScenarioFormPage.jsx`: a white modal, every field visible at once (ID, name, difficulty, short description, environment, model, scenario prompt, feedback questions, learning objectives), an orange AI prompt bar at the top, blue focus rings, and Save at the bottom of a long scroll.

## What New opening does that we do not

| New opening | Our form today |
|---|---|
| A full page, not a modal | Modal over the list |
| Two sections only (Role, Job description); the rest is hidden until wanted | Nine fields shown at once, including internal ones (ID, environment, model) |
| One field glows: "fill this next" | Nothing tells the educator where to start |
| Main button says what is missing, pops when ready, floats bottom-right | Save at the bottom of the scroll |
| Several ways in to the one box: type, paste, upload, drop, AI, standard role | One AI prompt bar |
| AI is a mode with a few facts, beams while writing, can be undone | AI overwrites the form; no undo |
| Live quality line ("12 of 60 words") | No guidance on what makes a good case |
| Standard roles as cards while the box is short | No starting points |

## Proposed page

**Header**: "New scenario" (`text-3xl`).

**Section 1, Patient** (InputGroup row):
- **Scenario name**, big (`text-2xl`), autofocus, glows first. Pasting a whole case into it moves the text to the case box and reads the name from it ("Taken from the case. Check it.").
- **Profession** cell: a joined two-button toggle, PT | OT.
- **Setting** cell: Singapore | General.
- **Difficulty** cell: Easy | Medium | Hard as a joined toggle.

**Section 2, The case** (action buttons top right: **Upload a file** (outline), **Generate with AI** (soft, border beam on the first click into the empty box)):
- **Write mode**: one big case box (the scenario prompt), auto-growing, with the placeholder telling the three ways in. Under it, the live line: words so far vs the minimum the patient needs to stay consistent, in warning colour until met. While the box is short: "Start from a standard case" with cards from our existing MSK conditions (shoulder impingement, cervical spine, low back pain, CTS, tennis elbow, DQV…), each filling name, profession and case; undo available.
- **Generate mode**: a few facts as InputGroups (age and sex, occupation, main complaint), "Add more detail" folds open the rest (onset, red flags present or not, psychosocial factors, Singapore context). Enter or "Write the case" generates; the panel beams while the AI writes; Undo after.

**Section 3, Learning and feedback** (folded by default, opens with "Edit"): learning objectives and feedback questions, prefilled by the AI and the profession defaults, as today. Shown as a summary line ("4 objectives · 24 standard questions + 3 for this case") until opened.

**Hidden from educators**: ID (auto), environment and model (defaults; superadmin only).

**Action dock** (bottom right): Cancel | Create, the Create label walking "Add a name" → "Describe the case" → "Create scenario", popping when ready. For edit: Cancel | Save changes, plus **Test** as a third joined button, since testing is what educators do next.

## Build order

1. Tokens, Figtree, and the shared components in JSX: `Button` (M3 variants), `ButtonGroup`, `InputGroup`/`InputGroupItem`, `Expand`, plus `border-beam`.
2. The page shell and route (`/scenarios/new`, `/scenarios/:id/edit`) in place of the modal, wired to the same create/update/AI endpoints.
3. Guide highlight, live quality line, walking button and dock.
4. Upload/drop/paste handling, standard-case cards, undo.
5. Generate mode with facts and the beam.

Open questions: the minimum word count for a case; which standard cases to offer first; whether educators may change environment/model at all.
