import {
  CATEGORIES,
  CATEGORY_LABELS,
  CHAOS_LABELS,
  MAX_ROUND_POINTS,
  POINTS,
  type Category,
  type Driver,
  type PlayerRound,
  type Round,
} from '@parc-ferme/shared';

// The share card as an HTML string for workers-og (satori). Satori only does flexbox:
// every element with more than one child needs display:flex.

export const CARD = { width: 1200, height: 630 } as const;

const C = {
  bg: '#05050a',
  panel: '#0d0d18',
  line: '#26263a',
  dim: '#8585a3',
  text: '#f2f2ff',
  red: '#ff2d55',
  cyan: '#00e5ff',
  yellow: '#ffe600',
  green: '#39ff14',
};
const PIXEL = "font-family:'Press Start 2P'";

export const esc = (s: string) =>
  s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);

export interface CardData {
  round: Round;
  player: Pick<PlayerRound, 'displayName' | 'initials'> & Partial<Pick<PlayerRound, 'picks' | 'breakdown' | 'total'>>;
  drivers: Driver[];
  /** False before lock: the card must not reveal picks. */
  revealed: boolean;
}

export function cardHtml({ round, player, drivers, revealed }: CardData): string {
  const byNumber = new Map(drivers.map((d) => [d.number, d]));
  const driver = (n: number | undefined | null) => {
    if (n === undefined || n === null) return `<div style="display:flex;color:${C.dim}">---</div>`;
    const d = byNumber.get(n);
    return `<div style="display:flex;align-items:center">
      <div style="display:flex;width:10px;height:30px;margin-right:12px;background:#${esc(d?.colour ?? 'ffffff')}"></div>
      <div style="display:flex">${esc(d?.acronym ?? `#${n}`)}</div></div>`;
  };
  const many = (ns: number[] | null | undefined) =>
    !ns
      ? `<div style="display:flex;color:${C.dim}">---</div>`
      : ns.length === 0
        ? `<div style="display:flex;color:${C.dim}">NONE</div>`
        : `<div style="display:flex">${ns
            .slice(0, 3)
            .map((n) => `<div style="display:flex;margin-right:14px">${driver(n)}</div>`)
            .join('')}</div>`;

  const res = round.results;
  const p = player.picks;
  const pickCell: Record<Category, string> = {
    pole: driver(p?.pole),
    p1: driver(p?.p1),
    p2: driver(p?.p2),
    p3: driver(p?.p3),
    fastest_lap: driver(p?.fastestLap),
    first_dnf: driver(p?.firstDnf),
    chaos: `<div style="display:flex">${p ? esc(CHAOS_LABELS[p.chaos]) : '---'}</div>`,
  };
  const actualCell: Record<Category, string> = {
    pole: driver(res?.pole),
    p1: driver(res?.podium?.[0]),
    p2: driver(res?.podium?.[1]),
    p3: driver(res?.podium?.[2]),
    fastest_lap: many(res?.fastestLap),
    first_dnf: many(res?.firstDnf),
    chaos: `<div style="display:flex;color:${res?.chaos && p ? C.text : C.dim}">${
      res?.chaos && p ? (res.chaos.includes(p.chaos) ? 'HAPPENED' : 'NOPE') : '---'
    }</div>`,
  };

  const row = (cat: Category) => {
    const pts = player.breakdown?.[cat];
    // Hit green, podium driver in the wrong spot yellow, miss red, pending dim. The number always shows too.
    const wrongSpot = (cat === 'p1' || cat === 'p2' || cat === 'p3') && pts === POINTS.podiumWrongSpot;
    const colour = pts === null || pts === undefined ? C.dim : pts === 0 ? C.red : wrongSpot ? C.yellow : C.green;
    const label = pts === null || pts === undefined ? '--' : pts > 0 ? `+${pts}` : '0';
    return `<div style="display:flex;align-items:center;height:54px;border-bottom:2px solid ${C.line};font-size:38px">
      <div style="display:flex;width:210px;color:${C.cyan};${PIXEL};font-size:15px">${CATEGORY_LABELS[cat]}</div>
      <div style="display:flex;width:240px">${pickCell[cat]}</div>
      <div style="display:flex;width:240px">${actualCell[cat]}</div>
      <div style="display:flex;flex:1;justify-content:flex-end;color:${colour};${PIXEL};font-size:22px">${label}</div>
    </div>`;
  };

  const table = revealed
    ? `<div style="display:flex;flex-direction:column;flex:1">
        <div style="display:flex;height:36px;color:${C.dim};${PIXEL};font-size:13px;border-bottom:2px solid ${C.line}">
          <div style="display:flex;width:210px"></div>
          <div style="display:flex;width:240px">PICK</div>
          <div style="display:flex;width:240px">RESULT</div>
          <div style="display:flex;flex:1;justify-content:flex-end">PTS</div>
        </div>
        ${CATEGORIES.map(row).join('')}
      </div>`
    : `<div style="display:flex;flex-direction:column;flex:1;align-items:center;justify-content:center;border:4px dashed ${C.line}">
        <div style="display:flex;color:${C.yellow};${PIXEL};font-size:30px">PICKS SEALED</div>
        <div style="display:flex;margin-top:24px;font-size:40px;color:${C.dim}">REVEALED WHEN QUALIFYING STARTS</div>
      </div>`;

  // The chequered strip from the app icon: two rows of 18px squares.
  const flag = [0, 1]
    .map(
      (r) =>
        `<div style="display:flex">${Array.from(
          { length: 12 },
          (_, i) => `<div style="display:flex;width:18px;height:18px;background:${(i + r) % 2 === 0 ? C.text : C.panel}"></div>`,
        ).join('')}</div>`,
    )
    .join('');

  const scored = revealed && player.breakdown && Object.values(player.breakdown).some((v) => v !== null);
  const score = scored ? String(player.total ?? 0).padStart(2, '0') : '--';

  return `<div style="display:flex;flex-direction:column;width:${CARD.width}px;height:${CARD.height}px;background:${C.bg};color:${C.text};padding:36px 44px;font-family:'VT323'">
    <div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:18px;border-bottom:4px solid ${C.red}">
      <div style="display:flex;color:${C.red};${PIXEL};font-size:34px">PARC FERMÉ</div>
      <div style="display:flex;color:${C.cyan};${PIXEL};font-size:16px">${esc(round.name.toUpperCase())} ${round.season}</div>
    </div>
    <div style="display:flex;flex:1;margin-top:22px">
      <div style="display:flex;flex-direction:column;width:320px;margin-right:36px;padding:22px;background:${C.panel};border:4px solid ${C.line}">
        <div style="display:flex;color:${C.dim};${PIXEL};font-size:13px">PLAYER</div>
        <div style="display:flex;margin-top:14px;color:${C.yellow};${PIXEL};font-size:72px">${esc(player.initials)}</div>
        <div style="display:flex;margin-top:10px;font-size:36px">${esc(player.displayName.toUpperCase())}</div>
        <div style="display:flex;margin-top:26px;color:${C.dim};${PIXEL};font-size:13px">SCORE</div>
        <div style="display:flex;margin-top:14px;color:${scored ? C.green : C.dim};${PIXEL};font-size:80px">${score}</div>
        <div style="display:flex;margin-top:12px;font-size:32px;color:${C.dim}">OF ${MAX_ROUND_POINTS} PTS</div>
        <div style="display:flex;flex-direction:column;margin-top:auto">${flag}</div>
      </div>
      ${table}
    </div>
    <div style="display:flex;justify-content:space-between;margin-top:14px;font-size:28px;color:${C.dim}">
      <div style="display:flex">F1 PICK'EM LEAGUE</div>
      <div style="display:flex;color:${C.yellow}">INSERT COIN TO PLAY</div>
    </div>
  </div>`.replace(/>\s+</g, '><');
}
