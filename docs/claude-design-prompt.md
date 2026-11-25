# Claude Design brief: PARC FERMÉ

Paste everything below the line into Claude Design.

---

Design the UI for **PARC FERMÉ**, a retro-arcade F1 pick'em league. It is a mobile-first PWA (most
use is on a phone on race weekend), with a comfortable desktop layout up to about 800px of content.

## Concept

A 1989 arcade cabinet crossed with an F1 timing screen. Players join a private league, predict each
Grand Prix before qualifying, and climb a HIGH SCORE table. It should feel like walking up to a
cabinet in attract mode: loud, pixelated, a little cheeky, but as legible as a real timing tower.

## Visual direction

- Near-black background (`#05050a`), panels one step lighter (`#0d0d18`), hard 4px borders
  (`#26263a`), no rounded corners, no soft shadows. Hard offset pixel shadows are fine.
- Neon accents: red `#ff2d55` (brand, locked, misses), cyan `#00e5ff` (labels, the current player),
  yellow `#ffe600` (primary actions, points, INSERT COIN), green `#39ff14` (scores, hits, open),
  pink `#ff3df2` (chaos call, leaderboard titles). Driver codes carry their real team colour as a
  small vertical bar, like a timing tower.
- Type: **Press Start 2P** for headings, labels, ranks and scores (small sizes, it is wide);
  **VT323** for body text and data. Everything uppercase.
- Motion: blinking "INSERT COIN" style accents (1s hard blink), leaderboard rows that slide in one
  at a time with scores rolling up, a colour-cycling 1st place. Respect reduced motion.
- A CRT scanline and vignette overlay that the player can switch off. Design both states; text must
  stay readable with it on.
- Keep contrast accessible, tap targets at least 44px, and visible focus rings (yellow).

## Screens to design

1. **Attract / start (signed out)**: big PARC FERMÉ title, blinking INSERT COIN, a "1 PLAYER START"
   form (league name, display name, 3-character initials entered arcade-style), and a short
   HOW TO PLAY panel.
2. **Home (signed in)**: "PLAYER ACE READY", list of the player's leagues, a NEW LEAGUE form.
3. **Join league** (from an invite link): "A NEW CHALLENGER APPROACHES", league name, player count,
   name + initials form, PRESS START button.
4. **League**: league name and season, COPY INVITE LINK, a NEXT UP panel with a DD:HH:MM:SS
   countdown to lock and the lock time in the viewer's local time zone, a MAKE YOUR PICKS button,
   the season HIGH SCORES table, the list of rounds (R01...R24, each OPEN / LOCKED / SCORED), and
   an ALERTS on/off control for push notifications.
5. **Round, open**: countdown, then the pick card: six driver slots (POLE, P1, P2, P3, FASTEST LAP,
   FIRST DNF) each showing its point value, and one CHAOS CALL chosen from five options
   (SAFETY CAR, RED FLAG, VIRTUAL SC, LAP 1 INCIDENT, NO SC / VSC). Save button with saved and error
   states. Choosing from 22 drivers must be quick with a thumb; a driver cannot be picked twice
   across P1 to P3.
6. **Round, locked (waiting for results)**: a "PARC FERMÉ: picks are locked" state, everyone's picks
   now visible, scores pending.
7. **Round, scored**: round HIGH SCORES table, then a timing-screen grid comparing the actual result
   with each player's picks per category, with points per cell (hit, partial, miss, pending) and
   totals. Four to ten players must fit; think about horizontal scroll on phones. A SHARE MY CARD
   button.
8. **Share card (1200x630 image)**: player initials and name, big score out of 27, a table of
   category / pick / result / points, round name, PARC FERMÉ branding, "INSERT COIN TO PLAY". Also a
   "PICKS SEALED" variant shown before the round locks. This is rendered with Satori, so use only
   flexbox layouts, solid colours and the two fonts above (no gradients, blurs or CSS grid).
9. **States**: loading, empty (no leagues, nobody picked, calendar not synced yet), error, and a
   GAME OVER 404.

## Components (please design these as a reusable set)

ArcadeButton (yellow, cyan, red, ghost; default, hover, pressed, disabled, busy), Panel with pixel
heading, text Field, initials input, Blink text, Notice (info, success, error), CRT overlay toggle,
Countdown, DriverTag (team colour bar + three-letter code), DriverSelect (a pick slot),
chaos call option, HighScoreTable row (1st, top 3, the current player, everyone else),
PicksTable cell (hit, partial, miss, pending), round list row, alerts toggle.

## Scoring, for copy and layout

Exact podium position 5, on the podium in the wrong position 2, pole 3, fastest lap 2, first DNF 3,
chaos call 4. Maximum 27 per round. Picks lock when qualifying starts.

## Sample data

League "Pit Lane Legends", 2026 season. Players: ACE (Ace Ventura) 27, DRS (DRS Train) 12,
MAX (Maximum Attack) 8, BOX (Box Box) 7. Las Vegas Grand Prix result: pole ANT, podium VER / NOR /
PIA, fastest lap LAW, first DNF PER, safety car deployed.

## Constraints

The app is React + Tailwind v4. Colours, fonts and animations are CSS custom properties in one
`@theme` block, and screens are composed from the components listed above, so please express the
design as tokens plus component specs rather than one-off page styling. Deliver mobile (390px wide)
and desktop (about 800px content width) for each screen.
