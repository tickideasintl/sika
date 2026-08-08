---
name: Sika
description: A quiet ledger for income, expenses, and giving.
colors:
  primary: "hsl(221 83% 53%)"
  primary-foreground: "hsl(0 0% 100%)"
  background: "hsl(0 0% 99%)"
  foreground: "hsl(240 6% 10%)"
  card: "hsl(0 0% 100%)"
  muted: "hsl(240 5% 96%)"
  muted-foreground: "hsl(240 4% 46%)"
  border: "hsl(240 6% 90%)"
  ring: "hsl(221 83% 53%)"
  destructive: "hsl(0 84% 60%)"
  income: "#1447e6"
  income-surface: "#eff6ff"
  expense: "#c20039"
  expense-surface: "#fff1f2"
  giving: "#007956"
  giving-surface: "#ecfdf5"
  obligation: "#b75000"
  obligation-surface: "#fffbeb"
  dark-income: "#51a2ff"
  dark-expense: "#ff667f"
  dark-giving: "#00d294"
  dark-obligation: "#ffb900"
  dark-background: "hsl(240 10% 4%)"
  dark-card: "hsl(240 10% 7%)"
  dark-foreground: "hsl(0 0% 98%)"
  dark-primary: "hsl(217 91% 60%)"
  dark-muted-foreground: "hsl(240 5% 58%)"
  dark-border: "hsl(240 6% 16%)"
typography:
  display:
    fontFamily: "Plus Jakarta Sans, system-ui, -apple-system, sans-serif"
    fontSize: "clamp(2.25rem, 5vw, 3.75rem)"
    fontWeight: 600
    lineHeight: 1.05
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Plus Jakarta Sans, system-ui, -apple-system, sans-serif"
    fontSize: "clamp(1.5rem, 3vw, 1.875rem)"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Plus Jakarta Sans, system-ui, -apple-system, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Plus Jakarta Sans, system-ui, -apple-system, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  control:
    fontFamily: "Plus Jakarta Sans, system-ui, -apple-system, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1
  label:
    fontFamily: "Plus Jakarta Sans, system-ui, -apple-system, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1
  amount:
    fontFamily: "Plus Jakarta Sans, system-ui, -apple-system, sans-serif"
    fontSize: "clamp(1.125rem, 2vw, 1.5rem)"
    fontWeight: 600
    lineHeight: 1.2
    fontFeature: "tnum"
rounded:
  control: "0.5rem"
  tile: "0.75rem"
  surface: "1rem"
  placeholder: "0.375rem"
  pill: "9999px"
spacing:
  tight: "0.5rem"
  snug: "0.75rem"
  base: "1rem"
  section: "1.5rem"
  page: "2rem"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    height: "2.5rem"
    padding: "0 1rem"
  button-primary-hover:
    backgroundColor: "hsl(221 83% 53% / 0.9)"
    textColor: "{colors.primary-foreground}"
  button-outline:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    height: "2.5rem"
    padding: "0 1rem"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    height: "2.5rem"
    padding: "0 1rem"
  input-field:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    height: "2.5rem"
    padding: "0.5rem 0.75rem"
  input-field-entry:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    height: "2.75rem"
    padding: "0.5rem 0.75rem"
  card-surface:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.surface}"
    padding: "1.5rem"
  nav-item-active:
    backgroundColor: "{colors.muted}"
    textColor: "{colors.foreground}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: "0.5rem 0.75rem"
  type-tile-income:
    backgroundColor: "{colors.income-surface}"
    textColor: "{colors.income}"
    rounded: "{rounded.tile}"
    size: "2.5rem"
  type-tile-expense:
    backgroundColor: "{colors.expense-surface}"
    textColor: "{colors.expense}"
    rounded: "{rounded.tile}"
    size: "2.5rem"
  type-tile-giving:
    backgroundColor: "{colors.giving-surface}"
    textColor: "{colors.giving}"
    rounded: "{rounded.tile}"
    size: "2.5rem"
---

# Design System: Sika

## Overview

**Creative North Star: "The Quiet Ledger"**

Sika looks like a well-kept book of accounts, not a trading terminal. The page is
near-white paper. Structure comes from hairline borders, not from shadows or filled
panels. Chrome recedes — the navigation is a translucent blur, cards are almost
borderless, buttons are modest — so that the only things with real presence on screen
are the numbers and the four colors that tell you what kind of money you are looking at.

The system's discipline is restraint with one licensed exception. Everything neutral is
genuinely neutral: greys at 4–6% saturation, type at two weights, surfaces flat at rest.
Against that, four saturated hues carry the entire semantic load — inflow, outflow,
giving, obligation — and they appear nowhere else. A colored pixel in Sika means money
changed meaning. That is what makes the ledger quiet: not that it is grey, but that its
color is never spent on decoration.

Density is comfortable rather than compressed. Cards breathe at 24px, sections at 24px,
and entry controls grow to 44px on the paths where a thumb does the work. Nothing is
crowded, nothing is precious. The register is *trustworthy and unhurried* — a record you
can sit with for three years — and it explicitly rejects both the dark glassmorphic
crypto-terminal look and the gamified budgeting app with streaks, confetti, mascots, and
emoji-as-interface.

**Key Characteristics:**
- Paper-white ground (`hsl(0 0% 99%)`), never pure white, with pure-white cards floating a shade above it
- Hairline borders at fractional opacity doing all the separation work
- Four semantic finance hues, used exclusively for financial meaning
- Tabular figures on every comparable number
- Radius that scales with surface size: 8px controls → 12px tiles → 16px surfaces
- Shadows reserved for things that genuinely float; flat everywhere else
- Full light/dark parity via a single class-scoped token override

## Colors

Two palettes coexist: a desaturated neutral system carrying every surface, border, and
piece of text, and a small saturated set that exists only to classify money.

### Primary

- **Signal Blue** (`{colors.primary}`): interactive chrome and nothing else. Filled
  primary buttons, focus rings, the app mark, selected-state checks, active links.
  Lightens to `{colors.dark-primary}` in dark mode so it holds against near-black.

### Secondary

The semantic finance set. These are the only saturated colors in the product, and each
one is bound to a single financial meaning across every screen, chart, and export.

- **Inflow Blue** (`{colors.income}`): income. Money arriving.
- **Outflow Rose** (`{colors.expense}`): expenses. Money leaving. Also carries negative
  net worth and destructive-adjacent financial actions.
- **Giving Green** (`{colors.giving}`): giving — tithes, partnership, offerings. A peer
  of the two above, never a shade of expense.
- **Obligation Amber** (`{colors.obligation}`): liabilities, debts, and bills falling
  due. Caution, not alarm.

Each is a **token, not a palette step**: `text-income`, `bg-giving-surface`,
`text-obligation-foreground`. The token carries its own dark-mode value, so a money type
cannot be coloured correctly in one theme and wrongly in the other. Each has three parts —
the ink itself, a `-surface` tint for the tile or row it sits on, and a `-foreground` for
the rare case where the money type is the fill rather than the ink.

The light values are the 700 step, not the 600 step the system originally used. 600 fails
WCAG AA on white for giving (3.65:1) and obligations (3.20:1), and only scrapes it for
expenses (4.48:1). Every token above clears 4.5:1 on the page, on card white, and on its
own surface tint, in both themes.

### Tertiary

- **Chart Violet** (`#8b5cf6`) and **Chart Cyan** (`#06b6d4`): category-breakdown charts
  only, extending the semantic four when a pie needs more than four slices. They carry
  no meaning outside a chart legend.

### Neutral

- **Paper** (`{colors.background}`): the page ground. Deliberately off pure white so
  card surfaces can sit above it without a border.
- **Card White** (`{colors.card}`): raised surfaces — cards, dialogs, popovers, dropdowns.
- **Ink** (`{colors.foreground}`): primary text, headings, and figures.
- **Graphite** (`{colors.muted-foreground}`): labels, secondary text, captions, inactive
  navigation, and every icon that is not carrying semantic color.
- **Wash** (`{colors.muted}`): filled quiet surfaces — secondary buttons, active
  navigation, hover states, skeletons.
- **Hairline** (`{colors.border}`): all borders and input strokes. Used at 40–60% opacity
  in most places, which is the system's actual signature separator.

Dark mode is a token swap, not a redesign: ground drops to `{colors.dark-background}`,
cards rise to `{colors.dark-card}` (lighter than the page — surfaces gain light as they
rise), and the semantic four step from 600-level to 400-level.

### Named Rules

**The Earned Ink Rule.** Saturated color appears only where money changes meaning. If a
colored element is not classifying an amount, a category, or a financial state, it should
be Ink, Graphite, or Hairline. Decoration does not earn color in this system.

**The Chrome-and-Amount Rule.** Signal Blue is for things you click. Inflow Blue is for
money that arrived. Never apply Signal Blue to a figure, and never apply Inflow Blue to
a button, link, or focus ring.

**The Token-Or-Nothing Rule.** A money type is coloured with its token — `text-income`,
`bg-expense-surface` — and never with a raw palette class. `text-emerald-600` in a
component is a bug even when it looks right: it has no dark-mode value, it is not
contrast-checked, and it detaches the colour from the meaning. Raw palette steps remain
fine for things that are not money: a status tick, a decorative accent.

> **Tension, reduced but not resolved.** Signal Blue `hsl(221 83% 53%)` (≈ `#2463eb`) and
> Inflow Blue were the same colour. Moving income to the 700 step for contrast also moved
> it to `#1447e6`, which is now visibly darker than the primary, so the two no longer
> collide at a glance. They remain the same hue family, and a full resolution still means
> moving one of them off blue.

**The Giving-Is-Not-Green-Money Rule.** Giving Green marks giving specifically, not
"positive" generally. Income is blue. Do not let a chart, a badge, or a summary card
recruit Giving Green to mean "good" or "up" — it collapses the distinction the product
exists to make.

## Typography

**Display / Body / Label Font:** Plus Jakarta Sans (with `system-ui`, `-apple-system`,
`sans-serif`). One family for everything; there is no display/body pairing and no mono.

**Character:** A geometric humanist sans with slightly narrow, open counters and
noticeably tall lowercase — it stays crisp at 12px label sizes and reads as contemporary
without novelty. It is doing a plain, competent job, which suits a ledger. Weight range
is deliberately narrow: 400 for prose, 500 for controls and labels, 600 for headings and
figures. 300 and 700 are loaded but effectively unused.

> **How the family is wired.** `app/layout.tsx` self-hosts Plus Jakarta Sans via
> `next/font` and exposes it as `--font-jakarta`; `app/globals.css` maps that into
> `--font-sans` inside `@theme`, which is what the `font-sans` utility on `<body>`
> resolves. That is the whole chain, and it is deliberately the only one — a previous
> `@import` from `fonts.googleapis.com` and a competing `body` font-family declaration
> were removed because the utility class silently beat the base rule (utilities win over
> base regardless of specificity), leaving the app rendering in the system stack while
> making an external request on every page load. Change the family in exactly one place:
> the `next/font` call, then `--font-sans`.

### Hierarchy

- **Display** (600, fluid to 3.75rem, tight leading, -0.025em): the landing headline.
  Appears once per page, on marketing surfaces only.
- **Headline** (600, fluid to 1.875rem, -0.025em): the page `h1` inside the dashboard.
  One per screen, top-left, no exceptions.
- **Title** (600, 1.125rem, leading-none, -0.025em): card titles and section headings.
  Drops to 1rem on compact cards.
- **Body** (400, 0.875rem, 1.5): the default text size across the entire application.
  The app is built at 14px, not 16px; marketing surfaces step up to 1rem/1.125rem.
- **Control** (500, 0.875rem): buttons, navigation items, input values, table cells.
- **Label** (500, 0.75rem, Graphite): field labels, stat-card captions, metadata.
- **Amount** (600, fluid 1.125rem → 1.5rem, tabular): every currency figure.

### Named Rules

**The Tabular Rule.** Any number a user could compare against another number vertically
uses tabular figures (`tabular-nums`). Currency amounts, balances, percentages, and
totals are never proportional. This is already true in 19 components; it is not optional
in new ones.

**The Two-Weight Rule.** Hierarchy comes from size and color, not from weight variety.
400 for prose, 500 for interactive and label text, 600 for headings and figures. Reaching
for 300 or 700 means the size scale is being under-used.

## Layout

A centered-container system with a hard ceiling: `max-w-7xl` (80rem) for the application,
`max-w-5xl` (64rem) for marketing, gutters at 1rem rising to 1.5rem at `sm`. Nothing goes
edge-to-edge.

Vertical rhythm runs on a 4px base with a strong preference for three steps: 0.5rem
between related controls, 1rem between grouped blocks, 1.5rem between sections. Card
interiors are a uniform 1.5rem, compressing to 1rem on the compact stat row at mobile
widths.

The dashboard is a stacked sequence of full-width bands rather than a true grid: a
2-column stat row that becomes 4 columns at `lg`, then a run of `md:grid-cols-2` panel
pairs, then a full-width recent-activity card. Breakpoints are Tailwind defaults
(640 / 768 / 1024 / 1280 / 1536); the meaningful shifts are `sm` (padding and type step
up), `md` (navigation goes from hamburger to inline, panels go two-up), and `lg` (stats
go four-up).

Control heights encode intent: 2.25rem compact, 2.5rem default, **2.75rem on transaction
entry**, 3rem for marketing calls to action. The navigation bar is a fixed 4rem and
sticks with `backdrop-blur-xl` over an 80%-opaque ground.

### Named Rules

**The Thumb Row Rule.** Every control on a transaction-entry path — quick add, the
transaction form, onboarding — is 2.75rem tall, not the default 2.5rem. Entry happens
one-handed on a phone, and the record's accuracy depends on entry never being fiddly.

**The Two-Up Ceiling Rule.** Dashboard panels go at most two across. A third column
shrinks financial figures below comfortable reading size and has never earned its place.

## Elevation & Depth

This system is flat by conviction. Cards carry `0 1px 2px rgb(0 0 0 / 0.02)` — a shadow
so faint it is effectively decorative — and rely on a 60%-opacity hairline border plus the
white-on-paper-white value step to read as raised. Depth is tonal, not cast.

Real shadow is reserved for the two things that genuinely float above the page, and it
arrives together with a scrim or a blur, never alone.

### Shadow Vocabulary

- **Resting surface** (`box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.02)`): cards and panels.
  Barely perceptible; the border is doing the work.
- **Control** (`box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05)`): filled primary and
  destructive buttons only. Outline and ghost buttons stay flat.
- **Transient** (`box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.05), 0 4px 6px -4px rgb(0 0 0 / 0.05)`):
  toasts and dropdown menus.
- **Modal** (`box-shadow: 0 25px 50px -12px rgb(0 0 0 / 0.1)`): dialogs, paired with a
  60%-black overlay and a 4px backdrop blur.

### Named Rules

**The Hairline Rule.** Separation is a border, not a shadow. When two surfaces need to be
distinguished, reach for `border-border/50` or a tonal step before reaching for elevation.

**The Float-Or-Flat Rule.** An element either sits on the page (flat, hairline, tonal) or
floats above it (modal/transient shadow, plus scrim or blur). There is no middle tier, and
hover does not promote a surface between the two.

## Shapes

Rectangles with softened corners, and the softening scales with the surface. Small
interactive things are crisp; large containers are generous. Nothing is a perfect circle
except avatars and progress tracks.

- **Controls** (`0.5rem` — buttons, inputs, select triggers, nav items, menu items)
- **Tiles** (`0.75rem` — the app mark, semantic type tiles, toasts, icon containers)
- **Surfaces** (`1rem` — cards, dialogs at `sm` and up, feature panels)
- **Placeholders** (`0.375rem` — skeletons)
- **Pills** (`9999px` — progress bars and their fills, avatars)

Borders are uniformly 1px and almost always translucent: `border-border/40` on marketing
chrome, `/50` on navigation, `/60` on cards and dialogs. Full-opacity `border-input` is
reserved for form fields, where the stroke has to be findable. There are no double
borders, no dashed strokes, and no decorative dividers where whitespace would do.

### Named Rules

**The Radius-Scales-With-Surface Rule.** 8px for things you click, 12px for things that
hold an icon, 16px for things that hold content. A 16px-radius button or an 8px-radius
card is out of system.

> **Inert token.** `--radius: 0.75rem` is declared in `@theme` but consumed by nothing;
> the `rounded-*` utilities resolve to Tailwind's own defaults. The values above are what
> actually renders. Do not "fix" a component by pointing it at `--radius`.

## Components

### Buttons

Modest, confident, and physically responsive — a 200ms transition on everything plus a
`scale(0.98)` press that makes the whole app feel connected to the finger.

- **Shape:** softened corners (`0.5rem`), full height 2.5rem, 1rem horizontal padding.
- **Primary:** Signal Blue fill, white text, faint control shadow; hover drops to 90%
  opacity of the fill.
- **Outline:** transparent over Paper with a full-opacity hairline; hover fills with Wash.
  The default choice for secondary actions across the dashboard.
- **Ghost:** no border, no fill; hover fills with Wash. Icon buttons and navigation
  actions.
- **Destructive:** Rose fill, white text — used for irreversible actions only. Financial
  *outflow* uses Outflow Rose as a tint, which is a different thing; do not conflate them.
- **Focus:** a 2px Signal Blue ring with a 2px background-colored offset, so the ring
  floats clear of the button edge.
- **Sizes:** 2.25rem compact, 2.5rem default, 2.75rem large / entry paths, 3rem marketing.

### Cards / Containers

- **Corner Style:** generous (`1rem`).
- **Background:** pure Card White over the Paper ground; in dark mode, one step lighter
  than the page.
- **Shadow Strategy:** resting surface only — see Elevation.
- **Border:** 1px hairline at 60% opacity. This, not the shadow, is what defines the card.
- **Internal Padding:** 1.5rem uniform; 1rem on compact stat cards below `sm`.
- **Header:** title and an optional semantic icon on one row, 0.375rem gap to the
  description beneath.

### Inputs / Fields

Quiet at rest and unmistakable in focus, with a hover state that exists purely to confirm
the field is live.

- **Style:** 1px `border-input` stroke over Paper, 0.5rem radius, 2.5rem tall,
  0.75rem horizontal padding, 0.875rem text.
- **Hover:** border darkens to 20%-opacity Ink.
- **Focus:** border becomes Signal Blue and a 2px 20%-opacity Signal Blue ring appears
  outside it — a soft halo rather than the hard offset ring buttons use.
- **Disabled:** 50% opacity, `not-allowed` cursor.
- **Labels:** 0.75rem, weight 500, Graphite, 0.375rem above the field.
- **Select triggers** match inputs exactly, plus a Graphite chevron at the right edge.

### Navigation

- **Style:** sticky, 4rem tall, 80%-opaque Paper with `backdrop-blur-xl`, closed by a
  50%-opacity hairline. No shadow.
- **Items:** 0.875rem weight-500 with a 1rem leading icon; Graphite at rest, Ink over a
  Wash fill when active. Active state is a filled pill, never an underline.
- **Left cluster:** app mark (Signal Blue tile, white glyph) → wordmark → workspace
  switcher → nav items, with 2rem between the brand group and the links.
- **Right cluster:** theme toggle, avatar menu, and a hamburger below `md`.
- **Mobile:** links collapse into a stacked panel beneath the bar with taller
  (2.75rem-equivalent) rows.

### Transaction Type Tile *(signature)*

The system's most characteristic element and its semantic backbone: a 2.5rem rounded-12px
square holding a directional arrow, tinted by money type. Income gets an up-right arrow on
blue-50; expense a down-right arrow on rose-50; giving an up-right arrow on emerald-50. In
dark mode the tint becomes the 950-level at 30% opacity and the glyph steps to 400-level.

It appears in transaction rows, budget lists, and summary cards, and it is the single
place a user learns the color language. It always pairs color with a distinct glyph — that
pairing is the accessibility contract, not a nicety.

### Overlay Motion

Everything that floats enters and leaves the same way: a fade paired with a 95% scale and
a short directional slide, at the system's 200ms. Nothing slides more than a couple of
pixels except toasts, which travel the full edge distance because they arrive unrequested
and need to be noticed.

- **Dialogs:** fade with `zoom-in-95`, sliding 48% from the top on the way in and back out
  the way they came. The overlay fades independently behind them.
- **Dropdowns and selects:** fade with `zoom-in-95` plus a 2px slide from whichever side
  the menu is anchored to, so the panel appears to grow out of its trigger.
- **Toasts:** slide the full distance from the top on mobile and from the bottom at `sm`
  and up, exit to the right, and fade to 80% rather than to zero — a swipe-dismissed toast
  should look thrown, not deleted.

The grammar is supplied by `tw-animate-css`, imported at the top of `app/globals.css`.
(The Tailwind v3 plugin these classes originally came from, `tailwindcss-animate`, was
only registered in a JS config Tailwind v4 never loaded, so every one of these classes
emitted nothing and overlays popped instantly. Verified working since the swap.) The
global `prefers-reduced-motion` block flattens all of it to 0.01ms.

### Stat Card *(signature)*

A four-across (two-across on mobile) row of compact cards, each a Graphite 0.75rem label
on the left, a semantic icon on the right, and a weight-600 tabular figure beneath. The
figure takes the semantic color of what it measures. This row is the first thing on the
dashboard and sets the color language for everything below it.

### Budget Progress Bar *(signature)*

A `9999px`-radius track in Wash with a fill that animates over 500ms — the slowest motion
in the system, and the only place duration is used expressively. Fill color shifts by
utilization, which makes it the one component at genuine risk of communicating by color
alone; the percentage label beside it is required, not decorative, and the track carries
`role="progressbar"` with `aria-valuenow` so the value is available without sight of it.

## Do's and Don'ts

### Do:

- **Do** put new tokens in the `@theme` block of `app/globals.css`, and add the matching
  `.dark` override in the same commit. That block is the only live source of truth.
- **Do** colour money with its token (`text-giving`, `bg-expense-surface`), per the
  Token-Or-Nothing Rule. The token is contrast-checked and theme-aware; a palette step is
  neither.
- **Do** keep `@custom-variant dark (&:where(.dark, .dark *))` at the top of
  `globals.css`. Tailwind v4 otherwise compiles every `dark:` utility into
  `@media (prefers-color-scheme: dark)`, which silently ignores the in-app theme toggle.
- **Do** pair every semantic color with a glyph, a label, or a sign. Financial state is
  never conveyed by hue alone (WCAG 1.4.1). Every budget bar, status badge, and net-worth
  figure states its condition in words as well as colour.
- **Do** use `tabular-nums` on every currency figure, percentage, and total.
- **Do** size transaction-entry controls at 2.75rem, per the Thumb Row Rule.
- **Do** separate surfaces with a translucent hairline (`border-border/50`) before
  considering a shadow.
- **Do** keep the semantic four bound to their meanings in charts and exports, not just in
  the UI: income blue, expenses rose, giving green — as `analytics-charts.tsx` already does.

### Don't:

- **Don't** reintroduce a `tailwind.config.{js,ts}`. This project is CSS-first Tailwind
  v4: there is no `@config` directive, so a JS config would never load. The previous one
  was deleted for exactly this reason — it had been silently inert, and its
  `hsl(var(--border))` values pointed at variables that never existed.
- **Don't** reference `--radius`. It is declared and unused; corner values come from the
  Shapes scale above.
- **Don't** apply Signal Blue to a number or Inflow Blue to a control. See the
  Chrome-and-Amount Rule and the tension recorded beneath it.
- **Don't** write `text-rose-600 dark:text-rose-400` for a money type. That pair is what
  the tokens replaced; half of its occurrences had lost their dark half.
- **Don't** use Giving Green as a generic "positive" or "up" color.
- **Don't** introduce a second typeface, a third text weight beyond 400/500/600, or a
  monospace face for figures — tabular numerals already solve alignment.
- **Don't** add `@import url(...)` for fonts or any other remote asset in `globals.css`.
  Every external request contradicts the product's zero-third-party default. A Google
  Fonts import lived here and was removed; self-host through `next/font` instead.
- **Don't** add shadow tiers between flat and floating, and don't promote a card on hover.
  Hover changes fill or border, never elevation.
- **Don't** reach for gradients, glassmorphism, neon accents, confetti, streak counters,
  mascots, or emoji as interface elements. The rejected references are the crypto terminal
  and the gamified budgeting app.
- **Don't** exceed two dashboard panels across.
- **Don't** rebuild interactive primitives by hand. Radix supplies the semantics; restyle
  the existing wrapper in `components/ui/` instead.
