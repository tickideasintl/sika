---
name: Sika
description: A quiet ledger for income, expenses, and giving.
colors:
  primary: "hsl(240 6% 5%)"
  primary-foreground: "hsl(45 20% 96%)"
  background: "hsl(45 15% 97%)"
  foreground: "hsl(240 6% 5%)"
  card: "hsl(0 0% 100%)"
  sunken: "hsl(45 12% 95%)"
  track: "hsl(45 8% 89%)"
  muted: "hsl(45 12% 93%)"
  muted-foreground: "hsl(240 4% 42%)"
  border: "hsl(45 8% 88%)"
  ring: "hsl(157 72% 26%)"
  destructive: "hsl(0 84% 60%)"
  brand: "hsl(157 72% 26%)"
  income: "#1447e6"
  income-surface: "#eff6ff"
  expense: "#c20039"
  expense-surface: "#fff1f2"
  giving: "#007956"
  giving-surface: "#ecfdf5"
  obligation: "#b75000"
  obligation-surface: "#fffbeb"
  dark-income: "#8ab4ff"
  dark-expense: "#ff8a9b"
  dark-giving: "#6fe3b0"
  dark-obligation: "#ffc46b"
  dark-background: "#0b0b0d"
  dark-card: "#141416"
  dark-sunken: "#0f0f11"
  dark-track: "#22222a"
  dark-foreground: "#f4f3ef"
  dark-primary: "#f4f3ef"
  dark-muted: "#1c1c20"
  dark-muted-foreground: "#96959d"
  dark-border: "hsl(240 6% 16%)"
  dark-brand: "#7ee0a8"
  hero: "#10291d"
  hero-ink: "#f1fbf5"
  hero-accent: "#7ee0a8"
  hero-muted: "#9bc0ab"
  hero-debt: "#2a1f10"
  hero-debt-ink: "#ffe0b0"
  hero-debt-muted: "#b79a70"
typography:
  display:
    fontFamily: "Bricolage Grotesque, Geist, system-ui, sans-serif"
    fontSize: "clamp(2.25rem, 5vw, 3.75rem)"
    fontWeight: 600
    lineHeight: 1.05
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Bricolage Grotesque, Geist, system-ui, sans-serif"
    fontSize: "clamp(1.5rem, 3vw, 1.875rem)"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Bricolage Grotesque, Geist, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-0.015em"
  body:
    fontFamily: "Geist, system-ui, -apple-system, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  control:
    fontFamily: "Geist, system-ui, -apple-system, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1
  label:
    fontFamily: "Geist, system-ui, -apple-system, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1
  amount:
    fontFamily: "Bricolage Grotesque, Geist, system-ui, sans-serif"
    fontSize: "clamp(1.125rem, 2vw, 1.5rem)"
    fontWeight: 600
    lineHeight: 1.2
    fontFeature: "tnum"
rounded:
  control: "0.6875rem"
  control-compact: "0.625rem"
  tile: "1rem"
  surface: "1.125rem"
  hero: "1.25rem"
  marketing: "0.8125rem"
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
    height: "2.375rem"
    padding: "0 0.9375rem"
  button-primary-hover:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
  button-outline:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    height: "2.375rem"
    padding: "0 0.9375rem"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    height: "2.375rem"
    padding: "0 0.9375rem"
  input-field:
    backgroundColor: "{colors.sunken}"
    textColor: "{colors.foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    height: "2.75rem"
    padding: "0.5rem 0.875rem"
  input-field-entry:
    backgroundColor: "{colors.sunken}"
    textColor: "{colors.foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    height: "2.75rem"
    padding: "0.5rem 0.875rem"
  card-surface:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.surface}"
    padding: "1.5rem"
  nav-item-active:
    backgroundColor: "{colors.muted}"
    textColor: "{colors.foreground}"
    typography: "{typography.control}"
    rounded: "{rounded.control-compact}"
    height: "2.375rem"
    padding: "0 0.625rem"
  badge-count:
    backgroundColor: "{colors.obligation-surface}"
    textColor: "{colors.obligation}"
    rounded: "0.375rem"
    padding: "0.125rem 0.375rem"
  pill-status:
    backgroundColor: "{colors.muted}"
    textColor: "{colors.muted-foreground}"
    rounded: "{rounded.pill}"
    padding: "0.125rem 0.5rem"
  stat-tile:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.tile}"
    padding: "1.125rem"
  type-tile-income:
    backgroundColor: "{colors.income-surface}"
    textColor: "{colors.income}"
    rounded: "0.5625rem"
    size: "1.75rem"
  type-tile-expense:
    backgroundColor: "{colors.expense-surface}"
    textColor: "{colors.expense}"
    rounded: "0.5625rem"
    size: "1.75rem"
  type-tile-giving:
    backgroundColor: "{colors.giving-surface}"
    textColor: "{colors.giving}"
    rounded: "0.5625rem"
    size: "1.75rem"
---

# Design System: Sika

## Overview

**Creative North Star: "The Quiet Ledger"**

Sika looks like a well-kept book of accounts, not a trading terminal. The page is a
near-black canvas by default, with a warm paper counterpart in light mode. Structure
comes from hairline borders, not from shadows or filled panels. Chrome recedes — the navigation is a translucent blur, cards are almost
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
- Near-black ground (`{colors.dark-background}`) with cards a shade lighter above it, and wells a shade darker below; light mode is the warm-paper counterpart
- Hairline borders at fractional opacity doing all the separation work
- Four semantic finance hues, used exclusively for financial meaning
- Tabular figures on every comparable number
- Radius that scales with surface size: 11px controls → 16px tiles → 18px surfaces → 20px heroes
- Shadows reserved for things that genuinely float; flat everywhere else
- Full light/dark parity via a single class-scoped token override

## Colors

Two palettes coexist: a desaturated neutral system carrying every surface, border, and
piece of text, and a small saturated set that exists only to classify money.

### Primary

- **Contrast Slab** (`{colors.primary}`): the primary action is a neutral, not a hue —
  cream on near-black in dark, ink on paper in light. At 17.7:1 it is the highest
  contrast pairing in the system, and because it carries no hue, pressing a button can
  never be mistaken for reading a money figure. Filled primary buttons and nothing else.
- **Sika Mint** (`{colors.brand}` / `{colors.dark-brand}`): interface accent and
  non-money chrome — the workspace chip, focus rings, the selection highlight, and
  marketing kickers. Darkens to a forest step in light mode so it clears AA on paper.
  Bound by the Mint-Is-Chrome Rule below; the logo palette lives in `docs/BRAND.md`.

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

### Chart ramps

A chart that breaks down one money type stays within that type's hue. The expense pie,
for example, uses six `--color-expense-chart-*` tones rather than borrowing Income Blue,
Giving Green, or Obligation Amber to distinguish expense categories. Multi-series charts
use the semantic token for each series.

### Neutral

- **Paper** (`{colors.background}`): the page ground. Deliberately off pure white so
  card surfaces can sit above it without a border.
- **Card White** (`{colors.card}`): raised surfaces — cards, dialogs, popovers, dropdowns.
- **Sunken** (`{colors.sunken}`): surfaces that sit *below* the card — inputs, table
  zebra bands, nested wells. Cards rise, wells drop; that difference is what tells you a
  field is a hole you can type into rather than a tile you can click.
- **Track** (`{colors.track}`): progress and meter rails. Never a money colour — the fill
  carries the meaning, the rail is chrome.
- **Ink** (`{colors.foreground}`): primary text, headings, and figures.
- **Graphite** (`{colors.muted-foreground}`): labels, secondary text, captions, inactive
  navigation, and every icon that is not carrying semantic color.
- **Wash** (`{colors.muted}`): filled quiet surfaces — secondary buttons, active
  navigation, hover states, skeletons.
- **Hairline** (`{colors.border}`): all borders and input strokes. Used at 40–60% opacity
  in most places, which is the system's actual signature separator.

### Hero surfaces

Two tinted grounds carry the app's two biggest figures, and nothing else:

- **Forest** (`{colors.hero}` with `hero-ink`, `hero-accent`, `hero-muted`): the dashboard
  net-position slab, the auth marketing panel, the landing showcase.
- **Ember** (`{colors.hero-debt}` with `hero-debt-ink`, `hero-debt-muted`): the debts page
  total-owed slab.

A hero is a surface in its own right, not a card with a background colour: it brings its
own ink and muted step because neutral Ink would not clear contrast on the tint. Do not
put body copy, tables, or form controls on one. A hero holds one anchor figure, one
sentence, at most one small control, and — set apart to the side — a cluster of no more
than two supporting stats. The moment it needs a third, it wants to be a card.

Dark mode is where this palette was designed; light is the derived counterpart. Ground
drops to `{colors.dark-background}`, cards rise to `{colors.dark-card}` (lighter than the
page — surfaces gain light as they rise), wells drop to `{colors.dark-sunken}`, and the
semantic four soften rather than brighten: on a near-black canvas the old 400 step glared,
so each hue lost saturation and gained lightness. All four clear 7.5:1 on both the page
and a card.

### Named Rules

**The Earned Ink Rule.** Saturated color appears only where money changes meaning. If a
colored element is not classifying an amount, a category, or a financial state, it should
be Ink, Graphite, or Hairline. Decoration does not earn color in this system.

**The Chrome-and-Amount Rule.** Chrome is for things you click; a money token is for an
amount. Never colour a figure with a chrome token, and never apply Inflow Blue to a
button, link, or focus ring.

**The Token-Or-Nothing Rule.** A money type is coloured with its token — `text-income`,
`bg-expense-surface` — and never with a raw palette class. `text-emerald-600` in a
component is a bug even when it looks right: it has no dark-mode value, it is not
contrast-checked, and it detaches the colour from the meaning. Raw palette steps remain
fine for things that are not money: a status tick, a decorative accent.

**The Single-Type Chart Rule.** A breakdown of one money type uses a tonal ramp of that
same type. An expense category may be a lighter or darker Outflow Rose; it may never turn
Income Blue, Giving Green, or Obligation Amber merely to make the slices different.

> **Tension, resolved.** Signal Blue and Inflow Blue used to be the same colour, and two
> rounds of contrast tuning only reduced the collision. The 2026 redesign resolved it by
> moving the primary off blue entirely: the primary action is now a neutral contrast slab,
> so blue means income and nothing else. The tension moved rather than vanished — see the
> Mint-Is-Chrome Rule for its new home.

**The Giving-Is-Not-Green-Money Rule.** Giving Green marks giving specifically, not
"positive" generally. Income is blue. Do not let a chart, a badge, or a summary card
recruit Giving Green to mean "good" or "up" — it collapses the distinction the product
exists to make.

> **Where this bites in practice.** Investment gains, shrinking debt balances, loan
> repayments, paid outgoings, valid import rows and under-budget states are all things a
> designer will reach for green to express. All of them are neutral ink here. The tick
> glyph and the words *Paid*, *Repaid*, *under budget* already carry the meaning; the
> colour would only duplicate it, and the duplicate costs the giving distinction. The
> 2026 redesign arrived colouring every one of these `#6FE3B0` and each was reverted to
> ink on import.

**The Mint-Is-Chrome Rule.** Sika Mint (`{colors.brand}` / `{colors.dark-brand}`) is
non-money chrome: the workspace chip, the focus ring, the selection highlight, and a
marketing kicker. It is adjacent in hue to Giving Green, so the line has to be absolute
— Mint never colours a figure, a badge on an amount, a chart series, or a table cell. If
a mint pixel sits next to a number, it is a bug.

> **Tension, acknowledged.** Mint and Giving Green are closer to each other than Signal
> Blue and Inflow Blue ever were. They are kept apart by *role* rather than by hue: money
> lives in the content column, Mint lives in the chrome around it, and the two never
> appear in the same row. A full resolution means moving Mint off green — worth doing if
> the two are ever seen to collide.

## Typography

**Body / Control / Label Font:** Geist (with `system-ui`, `-apple-system`, `sans-serif`),
exposed as `--font-sans` and applied by `font-sans` on `<body>`.

**Display Font:** Bricolage Grotesque, exposed as `--font-display` and applied with the
`font-display` utility. It is reserved for **figures and headings** — the net-position
number, page `<h1>`s, `CardTitle`, stat values, the landing headline. It never sets
prose, labels, controls, or table body text.

**Character:** Geist is a neutral grotesque that stays crisp at 11px label sizes and gets
out of the way, which is what a ledger's UI strings need. Bricolage Grotesque carries the
personality: slightly condensed, high contrast at large sizes, with tight negative
tracking (-0.02em to -0.04em) that lets a £-figure sit large without shouting. The
pairing is the point — the money is in the display face and everything else is not, so
the eye finds the figure before it finds the label. Weight range stays narrow: 400 for
prose, 500 for controls, 600 for headings and figures.

> **Why two families now.** The system ran on one family (Plus Jakarta Sans) until the
> 2026 redesign, on the principle that a ledger does not need a display face. The
> redesign inverted that: with ten equal-weight cards replaced by one hero figure, the
> figure had to carry hierarchy on its own, and a single family at one weight step could
> not do it. Two families, strictly divided by role, buys that hierarchy without adding a
> third weight.

> **How the families are wired.** `app/layout.tsx` self-hosts both via `next/font/google`
> and exposes them as `--font-geist` and `--font-bricolage`; `app/globals.css` maps those
> into `--font-sans` and `--font-display` inside `@theme`. That is the whole chain, and
> it is deliberately the only one — a previous `@import` from `fonts.googleapis.com` and
> a competing `body` font-family declaration were removed because the utility class
> silently beat the base rule (utilities win over base regardless of specificity),
> leaving the app rendering in the system stack while making an external request on every
> page load. Change a family in exactly one place: the `next/font` call, then the
> matching `--font-*` mapping.

### Hierarchy

- **Display** (600, fluid to 3.75rem, tight leading, -0.025em): the landing headline.
  Appears once per page, on marketing surfaces only.
- **Headline** (600, fluid to 1.875rem, -0.025em): the page `h1` inside the dashboard.
  One per screen, top-left, no exceptions.
- **Title** (display face, 600, 1rem, leading-none, -0.015em): card titles and section
  headings. Dropped from 1.125rem when the display face arrived — Bricolage carries more
  presence per pixel than the old single family did.
  Drops to 1rem on compact cards.
- **Body** (400, 0.875rem, 1.5): the default text size across the entire application.
  The app is built at 14px, not 16px; marketing surfaces step up to 1rem/1.125rem.
- **Control** (500, 0.8125rem): navigation items, input values, table cells, and the
  outline/ghost/secondary buttons. Filled primary and destructive buttons step to 600 —
  the only weight bump in the system, and it is what makes a filled action read as the
  one thing on the row you are meant to press.
- **Label** (500, 0.75rem, Graphite): field labels, stat-card captions, metadata.
- **Amount** (600, fluid 1.125rem → 1.5rem, tabular): every currency figure in a row,
  table cell, or list.
- **Figure** (display face, 600, 1.4375rem → 3.75rem, tabular, -0.02em to -0.035em): the
  one number a surface exists to show — the net-position hero, a stat tile, a page's
  total-owed or total-invested. One per surface; if a card has two, neither is a Figure.

### Named Rules

**The Tabular Rule.** Any number a user could compare against another number vertically
uses tabular figures (`tabular-nums`). Currency amounts, balances, percentages, and
totals are never proportional. This is already true in 19 components; it is not optional
in new ones.

**The Two-Weight Rule.** Hierarchy comes from size and color, not from weight variety.
400 for prose, 500 for interactive and label text, 600 for headings and figures. Reaching
for 300 or 700 means the size scale is being under-used.

## Layout

A sidebar-plus-column system, not a centered container: the rail is a fixed 15.5rem and
the content column caps at 77.5rem beside it, so the measure never outruns the rail.
Marketing caps at 67.5rem. Gutters run 1rem rising to 2rem at `lg`. Nothing goes
edge-to-edge.

Vertical rhythm runs on a 4px base with a strong preference for three steps: 0.5rem
between related controls, 1rem between grouped blocks, 1.5rem between sections. Card
interiors are a uniform 1.5rem, compressing to 1rem on the compact stat row at mobile
widths.

The dashboard is a stacked sequence of bands rather than a true grid: the net-position
hero and its three stat tiles, a two-up row pairing what is late with what is next, then
full-width activity, budgets, net worth and goals. Breakpoints are Tailwind defaults
(640 / 768 / 1024 / 1280 / 1536); the meaningful shifts are `sm` (padding and type step
up) and `lg` (the tab bar becomes the sidebar and the two-up rows split).

Control heights encode intent: 2.25rem compact, 2.375rem default, **2.75rem on
transaction entry**, 3rem for marketing calls to action.

### Named Rules

**The Thumb Row Rule.** Every control on a transaction-entry path — quick add, the
transaction form, onboarding — is 2.75rem tall, not the 2.375rem default. Entry happens
one-handed on a phone, and the record's accuracy depends on entry never being fiddly.

**The Two-Up Ceiling Rule.** Dashboard *panels* go at most two across — a panel being
anything with a heading and its own internal structure. A third column shrinks financial
figures below comfortable reading size and has never earned its place.

Stat *tiles* are not panels and go up to three: a label and one figure survive a narrow
column where a table or a list does not. The hero's three tiles and the budget row are
the sanctioned cases.

## Elevation & Depth

This system is flat by conviction. Cards carry **no shadow at all** and rely on a
70%-opacity hairline border plus the value step against the ground to read as raised —
lighter than the page in dark, white against paper in light. Depth is tonal, not cast.

Real shadow is reserved for the two things that genuinely float above the page, and it
arrives together with a scrim or a blur, never alone.

### Shadow Vocabulary

- **Control** (`box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05)`): filled primary and
  destructive buttons only. Outline and ghost buttons stay flat.
- **Transient** (`box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.05), 0 4px 6px -4px rgb(0 0 0 / 0.05)`):
  toasts and dropdown menus.
- **Modal** (`box-shadow: 0 25px 50px -12px rgb(0 0 0 / 0.1)`): dialogs, paired with a
  60%-black overlay and a 4px backdrop blur.
- **Floating bar** (`box-shadow: 0 14px 34px rgb(0 0 0 / 0.2)`, deepening to `0.55` in
  dark): the mobile tab bar, which genuinely floats over scrolling content. The only
  tier that changes value between themes — it has to read against both grounds.

### Named Rules

**The Hairline Rule.** Separation is a border, not a shadow. When two surfaces need to be
distinguished, reach for `border-border/60` or a tonal step before reaching for elevation.

**The Float-Or-Flat Rule.** An element either sits on the page (flat, hairline, tonal) or
floats above it (modal/transient shadow, plus scrim or blur). There is no middle tier, and
hover does not promote a surface between the two.

## Shapes

Rectangles with softened corners, and the softening scales with the surface. Small
interactive things are crisp; large containers are generous. Nothing is a perfect circle
except avatars and progress tracks.

- **Controls** (`0.625rem`–`0.6875rem`, rising to `0.8125rem` at the 3rem marketing size
  — buttons, inputs, select triggers, menu items;
  nav items sit at `0.625rem`)
- **Tiles** (`0.5625rem`–`1rem` — the app mark, semantic type tiles, toasts, icon
  containers, stat tiles inside a card)
- **Surfaces** (`1.125rem` — cards, dialogs at `sm` and up, feature panels)
- **Heroes** (`1.25rem` — the net-position and total-owed slabs)
- **Placeholders** (`0.375rem` — skeletons)
- **Pills** (`9999px` — progress bars and their fills, avatars)

The scale grew a step in the 2026 redesign: with a hero slab above the cards, cards had
to sit between the hero and the tiles inside them, so surfaces moved 16px → 18px and the
hero took 20px.

Borders are uniformly 1px and almost always translucent: `/60` on the rows inside a
surface, `/70` on cards, dialogs and the sidebar rail. Full-opacity `border-input` is
reserved for form fields, where the stroke has to be findable. There are no double
borders, no dashed strokes, and no decorative dividers where whitespace would do.

### Named Rules

**The Radius-Scales-With-Surface Rule.** Corner softening scales with the surface:
~11px for things you click, ~16px for things that hold an icon or a single figure, 18px
for things that hold content, 20px for a hero slab. A hero-radius button or a
control-radius card is out of system. The exact steps are in Shapes; this rule is the
ordering they must keep.

> **Inert token.** `--radius: 0.75rem` is declared in `@theme` but consumed by nothing;
> the `rounded-*` utilities resolve to Tailwind's own defaults. The values above are what
> actually renders. Do not "fix" a component by pointing it at `--radius`.

## Components

### Buttons

Modest, confident, and physically responsive — a 200ms transition on everything plus a
`scale(0.98)` press that makes the whole app feel connected to the finger.

- **Shape:** softened corners (`0.6875rem`), default height 2.375rem, 0.9375rem
  horizontal padding, 0.8125rem text. Weight follows Hierarchy: 500, stepping to 600 on
  filled primary and destructive only.
- **Primary:** Contrast Slab fill (cream on near-black, ink on paper), no shadow; hover
  drops to 90% opacity of the fill.
- **Outline:** Card White fill with a full-opacity hairline; hover darkens the border and
  fills with Wash. The default choice for secondary actions across the dashboard.
- **Ghost:** no border, no fill; hover fills with Wash. Icon buttons and navigation
  actions.
- **Destructive:** Rose fill, white text — used for irreversible actions only. Financial
  *outflow* uses Outflow Rose as a tint, which is a different thing; do not conflate them.
- **Focus:** a 2px Mint ring with a 2px background-colored offset, so the ring floats
  clear of the button edge.
- **Sizes:** 2.25rem compact, 2.375rem default, 2.75rem large / entry paths, 3rem
  marketing.

### Cards / Containers

- **Corner Style:** generous (`1.125rem`).
- **Background:** pure Card White over the Paper ground; in dark mode, one step lighter
  than the page.
- **Shadow Strategy:** flat at rest — the card carries no shadow at all. See Elevation.
- **Border:** 1px hairline at 70% opacity. This, not a shadow, is what defines the card.
- **Internal Padding:** 1.5rem uniform, 1.25rem below `sm`. Stat tiles and table rows
  sit tighter at 1.125rem, since they hold one line rather than a composition.
- **Header:** title and an optional semantic icon on one row, 0.375rem gap to the
  description beneath.

### Panel Primitives

Three shapes recur on almost every page, and they live in
`components/dashboard/panel.tsx` rather than in each page that needs them. They were
extracted after seven files carried literal copies, which is how a padding change reaches
six of them and misses the seventh.

- **Stat tile:** a label over one figure. Not a card — it takes the tile radius
  (`{rounded.tile}`), 1.125rem padding rising to 1.25rem horizontally at `sm`, a 0.75rem
  Graphite label, and a 1.625rem display-face figure at -0.02em with tabular numerals. The
  figure carries a money token when it is classified and neutral Ink when it is not, and
  an optional 0.75rem note sits beneath it.
- **Section heading:** a band heading *outside* a card, set to exactly the card title's
  type (display face, 1rem, weight 600, leading-none, -0.015em) so a section and a card
  read at the same level. An optional right-aligned aside carries a count or total at
  0.78125rem Graphite, tabular, baseline-aligned with the heading.
- **Empty state:** centred, 3rem of vertical air, opening with a 2.75rem Wash-filled
  rounded square (`1rem` radius) holding a 1.25rem Graphite icon, then a weight-500 title,
  an optional 0.875rem Graphite line, and an optional single action 1rem below. Every list
  surface in the app uses it, including error states, where the action is a Retry button.
- **Navigable figure:** a summary figure that opens the page it summarises — the hero's
  three money tiles, the four balance-sheet columns under net worth. It adds **nothing at
  rest**: a stat dressed as a button would put chrome on the one thing the surface exists
  to show. The affordance is a hover state (Wash at 60% behind the block, and the Graphite
  label going Ink) and the system's Mint focus ring. Per the Float-Or-Flat Rule it never
  lifts. The shared class in `panel.tsx` carries a `-m-2 p-2` pair so the hover fill
  breathes past the text without moving anything at rest.

### Inputs / Fields

Quiet at rest and unmistakable in focus, with a hover state that exists purely to confirm
the field is live.

- **Style:** 1px `border-input` stroke over the Sunken ground, 0.6875rem radius,
  2.75rem tall, 0.875rem horizontal padding, 0.875rem text. Sunken rather than Paper: a
  field reads as a hole in the card, not a tile on it.
- **Hover:** border darkens to 20%-opacity Ink.
- **Focus:** border becomes Mint and a 2px 25%-opacity Mint ring appears outside it — a
  soft halo rather than the hard offset ring buttons use.
- **Disabled:** 50% opacity, `not-allowed` cursor.
- **Labels:** 0.75rem, weight 500, Graphite, 0.375rem above the field.
- **Select triggers** match inputs exactly, plus a Graphite chevron at the right edge.
- **Textareas** keep the input's stroke, hover and focus behaviour but sit at a 0.5rem
  radius on the page ground (`bg-background`) rather than 0.6875rem on Sunken, with 5rem
  minimum height and 0.625rem vertical padding. The divergence is an unrefreshed scaffold
  default, not a decision — bring it onto the Sunken ground and the control radius when
  the file is next touched.
- **Switches** are a 2.75rem × 1.5rem pill track with a 1.25rem circular thumb that
  travels 1.25rem. On is the Contrast Slab (`{colors.primary}`), off is the input stroke
  colour, and the ring is the button-style offset ring rather than the input's soft halo —
  a switch is something you press, not something you type into.

### Navigation

A grouped left sidebar at `lg` and up, a floating tab bar below it. Eight destinations in
one flat bar gave every page equal weight and read as clutter; two named groups turned it
into two short lists. The list has since grown to twelve, which is what the groups were
bought for — a flat bar would have been unreadable at this length.

- **Sidebar:** 15.5rem wide, sticky full-height, closed by a 70%-opacity hairline on the
  right. Stacks logo → workspace switcher → grouped nav → settings + account footer. The
  whole rail scrolls, not only the nav: scrolling the nav alone let a short viewport clip
  the last destinations while the logo and footer held their space.
- **Groups:** Overview sits alone and ungrouped at the top. *Money in & out* carries
  Transactions, Outgoings, Calendar, Notifications, Clients and Giving, with Reports last;
  *Balance sheet* carries Accounts, Debts, Loans given and Investments. A hairline closes
  the nav, and below it the footer holds Settings then the account row. Group headings are
  0.65625rem weight-600 uppercase at 0.09em tracking, Graphite, with 1.375rem between
  groups and 0.125rem between items.
- **Items:** 2.375rem tall at the compact control radius (0.625rem), 0.84375rem weight-500
  with a 1rem leading icon; Graphite at rest, Ink over a Wash fill when active, Wash at 60%
  on hover. Active state is a filled pill, never an underline, and carries
  `aria-current="page"`.
- **Count badges:** two destinations carry a number — Outgoings shows how many are due or
  overdue, Notifications shows unread items. Both are a right-aligned 0.375rem-radius pill,
  Obligation Amber ink on its surface tint, 0.6875rem weight-600 and tabular, followed by a
  visually hidden phrase naming what the number counts. A count of money falling due is a
  financial state, so the amber is inside the Earned Ink Rule rather than an exception to
  it; a count of anything else would not be.
- **One label is not fixed:** the Clients destination reads *Clients* in a business
  workspace and *People* in a personal one. It is the only nav string that changes, and it
  changes because the same record means a different thing in each workspace type.
- **Mobile:** below `lg` the rail is replaced by a compact top row — logo, workspace
  switcher, then a 2.375rem bell and search button pair (0.6875rem radius, Card fill, full
  hairline), theme toggle and a 2.25rem account chip — plus a floating five-slot tab bar.
  The bar is a `1.125rem`-radius card at 95% opacity over an `xl` backdrop blur, sticky
  0.625rem above the bottom edge, carrying the floating-bar shadow. Slots are 3.125rem tall
  at 0.8125rem radius, a 1.1875rem icon over a 0.65625rem label. Four slots are
  destinations — Overview, Activity, Outgoings, Reports — and the fifth is **More**, a
  menu holding everything the row cannot: Calendar, Notifications, Clients, Giving,
  Accounts, Debts, Loans given, Investments, then Settings behind a separator. It opens
  upward from the bar on the ordinary dropdown grammar, keeps the sidebar's own group
  headings so it reads as the same map rather than a second one, and caps its height with
  Radix's measured available space, so only a genuinely short viewport scrolls. The More
  slot takes the active fill whenever the open page lives inside it, so "you are here"
  survives on all nine.
- **Why four and a menu, not five destinations.** Five links held the row at its legible
  limit while leaving eight of the twelve pages with no route below `lg` at all — Giving,
  Accounts, Debts, Loans given and Investments were unreachable on a phone, because the
  rail carrying them is `hidden … lg:flex`. Settings gave up the fifth slot rather than a
  destination, since the account menu in the mobile header already reaches it. A sixth
  slot is not the alternative: the thumb row stops at five.
- **Counts on mobile** are a filled circle rather than a pill — 1rem across on the bell,
  0.9375rem on a tab slot, `{colors.obligation}` with its `-foreground` ink, pinned to the
  icon's corner. This is the case the `-foreground` half of each money token exists for.
- **Account footer:** a 2.75rem row holding a 1.625rem round initial chip on Track, the
  name at 0.8125rem weight-500 over the email at 0.6875rem Graphite, both truncating.
- **Page header:** every page opens with a kicker (the sidebar group, uppercase Graphite)
  above the `<h1>`. The kicker answers "where am I", which is what lets the title stay
  short and large.

### Status Pills & Count Badges

Two shapes, and the difference between them is whether the thing being labelled is a
number.

- **Status pill:** a `{rounded.pill}` capsule, Wash fill, Graphite ink, 0.6875rem
  weight-500, 0.5rem horizontal padding. It states a condition in words — *Own cost*, *At
  cost*, *Fixed price*, *In retainer*, *Pending viewer invitation* — and it is deliberately
  neutral. The pill is often the only thing distinguishing an amber unrecovered figure from
  a healthy one, and WCAG 1.4.1 does not allow that distinction to be a hue.
- **Count badge:** a 0.375rem-radius rectangle, a money-type surface tint under its own
  ink, 0.6875rem weight-600, tabular. It appears where a destination or a row carries a
  number of money events, and its colour is the type of event being counted.

A pill never carries a currency amount; an amount belongs in the row's figure column where
it can align with the amounts above and below it.

### Row Lists

The app's default way of showing many records: a hairline-bordered container at the tile
or surface radius, its children divided by 60%-opacity hairlines rather than by gaps, each
row padded 1rem — rising to 1.25rem, and 1.5rem at `sm`, on a full-width list surface —
with the identifying text truncating on the left and controls held flush right. Rows stack
to a column below `sm` so a select and a delete button never compress the name beside them.

A row may be tinted to mark unread or unactioned state — a money-type surface at 30%
opacity, faint enough that the ink on it is untouched — and pairs that tint with a 0.5rem
status dot at the row's leading edge, filled with the money token when live and with the
hairline colour once handled. Tint alone would be colour carrying meaning on its own.

### Supporting Primitives

- **Avatar:** a 2.5rem circle with a Wash fallback holding the initial. Used in the account
  menu; the nav's own initial chips are smaller bespoke circles on Track.
- **Skeleton:** Wash fill at the placeholder radius (0.375rem) with a pulse. The only
  loading treatment other than a spinning 1.5rem Graphite loader centred in the surface
  that is still loading.
- **Alert:** a full-width 0.5rem-radius box with a hairline, an optional icon pinned top
  left, a weight-500 title and 0.875rem body. The destructive variant tints border, icon
  and text with `{colors.destructive}` and leaves the fill alone.
- **Confirm dialog:** the destructive counterpart to a dialog — same entrance, same 48%
  slide, but an 80%-black overlay with no blur, a 0.5rem radius, and the lighter transient
  shadow where a dialog takes the modal tier.

> **Known drift.** The alert, textarea and confirm dialog above are unrefreshed scaffold
> defaults: they sit at a 0.5rem radius that is on no step of the Shapes scale, and they
> reach for `bg-background` where the system distinguishes Card from Sunken. They are
> documented as they are, not as they should be. Bring each onto the scale when its file is
> next opened; do not copy their values into anything new.

### Transaction Type Tile *(signature)*

The system's most characteristic element and its semantic backbone: a rounded square
holding a directional arrow, tinted by money type. Income gets an up-right arrow on
`bg-income-surface`; expense a down-right arrow on `bg-expense-surface`; giving an
up-right arrow on `bg-giving-surface`. The glyph is the matching `text-*` token. Surfaces
are translucent tints of whatever sits beneath, so the tile works on Paper, on a card, and
on the Sunken ground without a second value.

It appears in transaction rows and summary cards. Budget tiles dropped it in the 2026
redesign — a budget is a category, not a movement, so the directional arrow was claiming
a direction it did not have. The quick-add segmented control now shares the job of being
where a user learns the colour language. It always pairs color with a distinct glyph — that
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

### Net Position Hero *(signature)*

The dashboard opens on one figure, not a row of four. A `{rounded.hero}` slab in Forest
carries the net position at up to 3.75rem in the display face, a single sentence naming
the surplus or deficit, and an in/out/kept bar splitting income three ways. Three stat
tiles sit beside it — Income, Expenses, Giving — each a Graphite 0.75rem label over a
weight-600 tabular figure in the token of what it measures, and each one navigable per the
Navigable Figure treatment. Income and Expenses open the register already filtered to that
type; Giving opens the giving workspace instead, because giving is the one money type with
a place of its own to go.

The hero is what replaced the old four-across stat row: ten equal-weight cards gave
nothing priority, and one large figure with three supporting tiles sets the colour
language for everything below while answering "how did I do" before anything is read.

### Budget Progress Bar *(signature)*

A `9999px`-radius track in `{colors.track}` with a fill that animates over 500ms — the
slowest motion in the system, and the only place duration is used expressively. Fill
colour shifts by utilisation: Outflow Rose over the limit, Obligation Amber near it, and
**neutral ink on track** — never green, because staying under budget is not giving.

That colour shift makes it the one component at genuine risk of communicating by colour
alone, so two things are required rather than decorative: the percentage label beside it,
and the remaining-or-over figure named in words beneath. The track carries
`role="progressbar"` with `aria-valuenow` so the value is available without sight of it.

### Financial Calendar *(signature)*

The densest application of the money palette in the product, and the clearest
demonstration of why it is only four colours. A month grid puts every expected movement —
income due, expenses scheduled, giving committed, debt payments falling — on the day it
lands, and the only way that stays readable is that a glance at a cell is a glance at four
hues and nothing else.

- **Grid:** seven equal columns inside a `{rounded.surface}` card. The weekday header is a
  Sunken band with 0.6875rem weight-600 uppercase Graphite labels at 0.06em tracking; day
  cells are at least 8rem tall, separated by 60%-opacity hairlines on the bottom and right
  edges only, and days outside the month drop to Sunken at 50%.
- **Date chip:** a 1.75rem circle holding the day number at 0.75rem, tabular. Graphite on
  an ordinary day; today fills with the Contrast Slab. Today is chrome, not money, so it
  takes the neutral primary rather than a hue.
- **Event chip:** a 0.5rem-radius block on the money type's surface tint, opening with a
  0.375rem dot in the solid token, then the title truncating at 0.6875rem weight-500, then
  the amount beneath in the token's ink at 0.625rem weight-600, tabular, indented past the
  dot. Hover shifts brightness rather than fill, because the fill is already carrying
  meaning. At full size the chip grows to 0.875rem title, 0.875rem amount, and adds the
  settlement status in words on the same baseline.
- **Overflow:** a cell that runs out of room ends with a Graphite `+N more` at 0.65625rem
  rather than compressing the chips.
- **Legend:** a closing row of four 0.5rem dots naming Income, Expense, Giving and Debt
  payment in words. The calendar is the one surface where all four hues appear at once, so
  it is the one surface that must name them.

> **Known drift.** The settled marker is a check glyph in Income Blue. By the doctrine
> recorded under the Giving-Is-Not-Green-Money Rule — paid, repaid and settled states are
> neutral ink — that tick should be Graphite: the glyph already says settled, and the blue
> claims the movement was income. Left as-is here because it is a live component, not a
> decision.

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
  the UI. Multi-series charts use one token per money type; single-type breakdowns use a
  tonal ramp of that same type.
- **Do** let a summary figure open the page it summarises, using the `navigableFigure`
  class rather than a fresh hover treatment — and add no chrome at rest. A figure is not a
  button; it becomes one only under the pointer.
- **Do** reach for the shared shapes in `components/dashboard/panel.tsx` — `StatTile`,
  `SectionHeading`, `EmptyState` — instead of re-deriving them. They were extracted
  because seven files held literal copies, which is how a padding change reaches six of
  them and misses the seventh.

### Don't:

- **Don't** reintroduce a `tailwind.config.{js,ts}`. This project is CSS-first Tailwind
  v4: there is no `@config` directive, so a JS config would never load. The previous one
  was deleted for exactly this reason — it had been silently inert, and its
  `hsl(var(--border))` values pointed at variables that never existed.
- **Don't** reference `--radius`. It is declared and unused; corner values come from the
  Shapes scale above.
- **Don't** apply Sika Mint to a number, badge, or chart series. See the Mint-Is-Chrome
  Rule and the tension recorded beneath it.
- **Don't** write `text-rose-600 dark:text-rose-400` for a money type. That pair is what
  the tokens replaced; half of its occurrences had lost their dark half.
- **Don't** use Giving Green as a generic "positive" or "up" color. Gains, repayments,
  paid bills and under-budget states are neutral ink.
- **Don't** set prose, labels, controls, or table body text in the display face, and
  don't add a third family, a third text weight beyond 400/500/600, or a monospace face
  for figures — tabular numerals already solve alignment.
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
- **Don't** paste a scaffold component in unmodified. A stock shadcn default arrives at a
  0.5rem radius on `bg-background`, and this system has neither — corners come from the
  Shapes scale and surfaces are Card or Sunken. The primitives already carrying those
  defaults are listed under Supporting Primitives as drift, not as precedent.
