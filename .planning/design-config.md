# CBSS 3D Printing Club — design direction

## Brief

- **Audience:** Dr. Charles Best Secondary students first, with teachers and other adult visitors as an equally credible secondary audience.
- **Primary action:** Request a print.
- **Secondary action:** Join the club.
- **Personality:** Professional, precise, curious, and student-run. Eye-catching without feeling childish or corporate.
- **Proof:** Real club work and honest process details. Do not invent scale, turnaround times, printer capabilities, or impact figures.

## Visual system: Precision in Motion

The subject is additive manufacturing: forms are built one deliberate layer at a time. The site uses that idea structurally through horizontal rules, build-plate grids, technical labels, and one interactive hero object. Motion reveals, stacks, and resolves. It does not float, sparkle, or introduce unrelated metaphors.

### Palette

Use the existing project colours only:

- `#12172B` — Ink: primary dark ground and strongest text.
- `#213366` — Navy: club brand anchor and secondary dark ground.
- `#FFFFFF` — Snow: light surfaces and dark-ground text.
- `#F2F5FA` — Cloud: quiet section and field backgrounds.
- `#E1E8F3` — Mist: rules, borders, and subtle grid lines.
- `#56637F` — Slate: secondary text.
- `#FFC93C` — Signal: primary actions, focus, and the hero layer detail. Keep to roughly 10–15% of a screen.

### Typography

- Display and body: Geist Sans. Headlines use very large sizes, tight tracking, and short line lengths.
- Utility: Geist Mono for room, time, process labels, and project metadata.
- Avoid decorative type. Character comes from scale, spacing, and contrast.

### Shape and spacing

- Keep the existing 20px card radius and pill action radius.
- Use a 6xl content shell, generous vertical rhythm, and asymmetrical compositions.
- Prefer bordered editorial rows and one large feature over repeated equal cards.

### Signature

The homepage build stage is the one memorable interaction: the club mark assembles through staggered layer lines, then responds subtly to pointer position. It runs once, stays useful as a static image without JavaScript, and becomes fully still under `prefers-reduced-motion`.

## Content rules

- Be concise, concrete, and warm.
- Say what visitors can do and what happens next.
- Use verified facts: Tuesdays, 3:30–4:30 PM, Room 113 Drafting, student contact `080-wwen@sd43.bc.ca`, sponsor Mr. Anania at `danania@sd43.bc.ca`.
- The request system supports PLA, PETG, and ASA preferences and accepts STL or 3MF files up to 50 MB. Treat colors as preferences until the club reviews current stock.
- Do not claim free printing, a turnaround time, a printer count/model, a founding year, or specific failure rates.
- Status pages and email templates must never introduce a promised completion date or duration.

## Acceptance checks

- Request a Print and Join the Club are visible above the fold on common desktop and mobile viewports.
- Navigation is keyboard-operable and does not rely on horizontal scrolling.
- Motion is non-essential and respects reduced-motion preferences.
- Normal text meets 4.5:1 contrast; focus remains visible on light and dark grounds.
- Every route works at 375px, 768px, and 1280px without clipping or horizontal scroll.
- Real student work appears before broad claims.
