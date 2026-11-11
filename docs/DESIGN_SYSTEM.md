# Design system (from ci/internal-shortlisting)

Source: **`D:\ci\internal-shortlisting`** (branch `dev-ayush`): `app/globals.css`, `components/ui/*` (button, button-group, input-group, expand), and the HR "New opening" page `app/(protected)/openings/new/page.tsx`. An earlier version of this doc was read from an older copy in `D:\vx\internal-shortlisting` (amber/Inter); that was wrong and is replaced here.

Their stack is Next.js + Tailwind 4 + shadcn on Base UI + `motion`. Ours is Vite + React 19 + Tailwind 3.4 + cva + tailwind-merge; section 8 says how to carry each piece over.

---

## 1. The idea

A **warm cream paper app with one sun-yellow accent and black ink**. Cards are white on a cream page. Yellow marks action and "look here", never decoration; the focus ring is black (ink), not yellow. Controls are Material 3 style: tall (40 px), pill-shaped, and they **square off while pressed**. Related controls are **one shape**: joined buttons (`ButtonGroup`) and joined fields with the label inside the cell (`InputGroup`). The page guides the eye: one field at a time is highlighted as "fill me next", and the main button changes its words to say what is missing. Dark mode is true black.

## 2. Colours

| Token | Light | Dark | Use |
|---|---|---|---|
| `--background` | `#F6F4EF` (cream) | `#000000` | page |
| `--foreground` | `#1C1B18` (ink) | `#e8e8e8` | text |
| `--card` / `--popover` | `#FFFFFF` | `#0a0a0a` | cards, sections |
| `--primary` | `#F9CF33` (sun yellow) | `#F4C02C` | main action, guide highlight |
| `--primary-foreground` | `#1C1B18` | `#14130F` | **dark text on yellow** |
| `--secondary` / `--muted` | `#EFECE5` | `#141414` | input cells, fills |
| `--muted-foreground` | `#6B665D` | `#929292` | labels, hints |
| `--accent` | `#FFF2C6` (pale yellow) | `#141414` | hover fill |
| `--border` / `--input` | `#E7E3DA` | `#202020` | lines |
| `--ring` | `#1C1B18` | `#e8e8e8` | focus ring = ink |
| `--destructive` | `#E63935` | `#E5675E` | |
| `--success` | `#0FA05C` | `#4FBF8A` | |
| `--warning` | `#D57700` | `#E8A23A` | e.g. "12 of 60 words" |
| `--brand` / `--brand-text` | `#DCAB0E` / `#8A6700` | `#F4C02C` | logo, yellow text on white (plain yellow text is under 3:1) |
| `--sidebar` | `#EFECE5` | `#000000` | app frame |
| `--sidebar-accent` | `#FFF2C6` | `#141414` | active nav item |

Rule from their code: outlined and text buttons use **foreground** labels, because yellow on white is under 3:1 contrast. Yellow is a fill, not a text colour.

## 3. Type

- **Figtree** for everything (body and headings); IBM Plex Mono for numbers/code; Kalam (hand) only for sticky-note style touches.
- Page title `text-3xl font-semibold tracking-tight` ("New opening"). Section title `text-2xl font-semibold tracking-tight` with a `text-sm text-muted-foreground` hint under it.
- The **main field is big**: the opening-name input is `text-2xl font-medium`. The thing that matters most is the largest thing on the page.
- Body, hints and helper lines `text-sm`; cell labels `text-sm font-medium text-muted-foreground`; numbers `tabular-nums`.

## 4. Shape and depth

- `--radius: 0.75rem` (12 px). Sections and cards `rounded-2xl border border-border/70 bg-card p-5 md:p-6`. Few shadows: sections are flat on cream, only floating things (the action dock, toasts) get `shadow-lg`.
- Buttons are pills in **pixel radii** so the press morph animates: default `h-10 rounded-[20px] px-6`, pressed `rounded-[8px]`; `sm` `h-9 rounded-[18px]`; `lg` `h-12 rounded-[24px] px-6 text-base`; icons 18 px (20 px on lg). A state layer (`after:bg-current` at 8 % on hover, 10 % on press) and a ripple.

## 5. Buttons

| Variant | Look |
|---|---|
| default | `bg-primary text-primary-foreground` (yellow, ink text) |
| soft | `border border-primary bg-primary/12 text-foreground` (yellow outline, faint yellow fill): the "suggested" action, e.g. Generate with AI |
| secondary | `bg-secondary` |
| elevated | `bg-card shadow-sm`, `hover:shadow-md` |
| outline | `border-foreground/25 bg-transparent`, `hover:border-primary hover:bg-accent` |
| ghost | transparent, ink text |
| destructive | `bg-destructive/12 text-destructive` (tinted, not solid) |
| disabled (all) | `bg-foreground/12 text-foreground/38` |

## 6. Combination controls

**ButtonGroup**: buttons 2 px apart (`gap-0.5`), inner corners 8 px, outer ends 20 px, and a pressed button rounds to 20 px. Orientation `horizontal`, `vertical` or `responsive` (stacks on phones).

**InputGroup**: the input twin. Cells 2 px apart, each `bg-secondary/60 px-4 pt-2.5 pb-2` with its **label inside the cell** (`text-sm font-medium text-muted-foreground`); inner corners 8 px, outer ends `rounded-2xl`. Stacked on phones, a row from `md:`. Focus: `bg-secondary ring-2 ring-primary`. A press anywhere on a cell focuses its input or toggles its checkbox. The control inside drops its own border (`inputGroupControl`: `border-0 bg-transparent px-0 py-0 shadow-none`). A cell can hold a checkbox + text + info tooltip instead of an input; when on, the cell tints `bg-primary/10` and the text turns primary.

**Border beam** (`border-beam` npm, v1.3.0, MIT): an animated light travelling around an element's border, `colorVariant="colorful"`. Used **only for a moment, to point at something**: on the first click into the empty description, "Generate with AI" beams for 3 s (`size="sm" strength={0.6}`), and the AI facts panel beams while the AI is writing (`size="md" strength={0.7} active={isGenerating}`). Skipped when the user prefers reduced motion.

**Action dock**: Cancel + Create float bottom-right in a pill (`rounded-full border bg-background/95 p-1.5 shadow-lg backdrop-blur`) as a `ButtonGroup`, size `lg`. It stays visible however long the form is.

## 7. How the page guides (the "highlighting")

From New opening, the behaviours worth copying:

1. **One thing glows at a time**: `GUIDE = ring-2 ring-primary/40 bg-primary/5` on the next field to fill (name first, then description). Never two.
2. **The button says what is missing**: "Add a name" → "Add the description" → "Create opening". When ready it **pops** (`zoom-in-90`, `ring-4 ring-primary/25`) so a person who pasted sees it.
3. **Live quality line under the box**, where the eye is: "12 of 60 words. At least 60 make the ranking reliable." in warning colour, gone once met.
4. **Several ways in, one box**: type, paste, upload a file, drop a file, generate with AI, or start from a standard role. A long text pasted into the name field is moved into the description, and the name is read from it and flashed with "Taken from the description. Check it."
5. **Shows only what is needed**: AI facts sit behind a "Generate with AI" switch; extra facts behind "Add more detail"; standard-role cards appear only while the description is short and fold away once it can stand alone (`Expand`, 0.24 s, ease `[0.22,1,0.36,1]`; tall sections 0.45 s ease-in-out).
6. **Everything that overwrites can be undone**: a toast with Undo, plus a line under the box ("Filled in from X. Undo") until the user types.
7. **Copy is instructions, not labels**: placeholders say what to do and the shortcuts ("Have a file? Upload a file above, or drop it here.").
8. **Proportions**: page `px-4 md:px-6`, sections `gap-6`, section padding `p-5 md:p-6`; name cell `flex-1`, toggle cells `md:w-80`; description `min-h-36 max-h-[40vh]`, grows with content (`field-sizing-content`); `pb-28` at the bottom so the dock never covers content.

## 8. Carrying it into VPS (Tailwind 3.4)

- Tokens: put section 2 in `src/index.css` (`:root` and `.dark`) as hex, map them in `tailwind.config.js`. Hex works with Tailwind 3 opacity only if stored as RGB channels (`--primary: 249 207 51`, `primary: "rgb(var(--primary) / <alpha-value>)"`); do that, since the design leans on `/12`, `/25`, `/40`.
- Font: Figtree from Google Fonts (already loaded by the sign-in page).
- Translate Tailwind 4 syntax: `*:data-[slot=x]:` → a small CSS block or explicit classes; `ring-3` → `ring-[3px]`; `field-sizing-content` → an auto-grow textarea; `animate-in zoom-in-90` → a keyframe.
- `border-beam` is a plain React component: `pnpm add border-beam` works in our app as is.
- `Expand` uses `motion`; we can add `motion` or do a CSS grid-rows height transition.

The sign-in page (`src/components/StartupPages/auth/`) was built before this correction (amber accent); retune it to the yellow/ink tokens when the tokens land.
