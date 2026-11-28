// assets/family.js: 인물 도감의 "가족" 보기.
// 순수 함수(가족 묶기)는 위, HTML 조립은 아래. 세대 계산도 좌표 계산도 하지 않는다:
// 가로로 넓은 가계도 대신 가족 카드를 세로로 쌓아서 한 줄이 한 문장이 되게 한다
// (DECISIONS 2026-08-23: 가로 그래프는 아이에게 안 읽히고 화면 밖으로 잘렸다).
import { imgSrc } from "./content.js";

const KINDS =["parent", "child", "spouse", "sibling", "other"];
export const kindsOf = (k) => (Array.isArray(k) ? k : k == null ? [] : [k]);
export const hasKind = (k, want) => kindsOf(k).includes(want);

/**
 * 두 사람 사이에 붙은 라벨.
 * kind를 주면 **그 종류의 관계에 달린 라벨만** 가져온다. 한 쌍이 여러 관계일 수 있어서
 * (제우스와 헤라 = 남매이자 짝) 종류를 안 보면 "짝: 제우스 · 막내동생" 같은 문구가 나온다.
 * 내 카드에 없으면 상대 카드에서 가져오되, 그때도 종류가 맞아야 한다.
 * 부모/자식은 방향이 뒤집히므로 상대 카드에서는 반대 종류를 찾는다.
 */
// 반대쪽 카드에서 가져와도 되는 것은 **대칭 관계**뿐이다. 부모·자식·형제는 라벨이 관점에
// 묶여 있어서(아버지 / 막내아들) 뒤집어 쓰면 "아이: 제우스 · 아버지"가 된다.
// 못 찾으면 빈 문자열이고, 화면에는 이름만 뜬다: 틀린 말이 나가는 것보다 낫다.
//
// `other`도 여기 들어 있었는데 **틀렸다**(2026-08-31 앱 실검증에서 발견). 이 시즌의
// `other` 라벨은 거의 다 방향이 있다("방패를 준 신", "문을 맡긴 이", "벌을 내린 여신").
// 빌려 쓰면 **행위자와 상대가 뒤바뀐다**: 아테나 카드에 "페르세우스 · 방패를 준 신"이
// 떴다. 49건 가운데 24건이 그랬다. 짝(spouse)만 남긴다.
const SYMMETRIC = new Set(["spouse"]);
export function relationLabel(chars, fromId, toId, kind = null) {
  const find = (a, b, want) => chars.find((c) => c.id === a)?.relations
    ?.find((r) => r.to === b && (!want || hasKind(r.kind, want)))?.label;
  const mine = find(fromId, toId, kind);
  if (mine) return mine;
  if (!kind || SYMMETRIC.has(kind)) return find(toId, fromId, kind) || "";
  return "";
}

/**
 * 보이는 인물만 넘겨 받아 가족 단위로 묶는다(스포일러 게이트는 호출부 책임).
 * @returns {{cards, pairs, sibs, loners, kids, par, sp, sib, oth, by, order}}
 *   cards  [{ who, rows: [[짝id|"", [자식id…]], …] }]  짝과 낳은 아이가 먼저, "혼자서"가 마지막
 *   pairs  [[a,b], …]   같이 낳은 아이가 없는 짝
 *   sibs   [[id, …], …] 부모가 안 보이는 형제 묶음
 *   loners [id, …]      어느 묶음에도 못 든 인물
 */
export function groupFamilies(chars) {
  const ids = new Set(chars.map((c) => c.id));
  const by = new Map(chars.map((c) => [c.id, c]));
  const order = new Map(chars.map((c, i) => [c.id, i]));
  const kids = new Map(), par = new Map(), sp = new Map(), sib = new Map(), oth = new Map();
  for (const c of chars) for (const m of [kids, par, sp, sib, oth]) m.set(c.id, new Set());

  for (const c of chars) for (const r of c.relations || []) {
    if (!ids.has(r.to)) continue;                      // 아직 안 열린 상대는 없는 셈 친다
    const k = r.kind;
    if (hasKind(k, "spouse"))  { sp.get(c.id).add(r.to);   sp.get(r.to).add(c.id); }
    if (hasKind(k, "parent"))  { par.get(c.id).add(r.to);  kids.get(r.to).add(c.id); }
    if (hasKind(k, "child"))   { kids.get(c.id).add(r.to); par.get(r.to).add(c.id); }
    if (hasKind(k, "sibling")) { sib.get(c.id).add(r.to);  sib.get(r.to).add(c.id); }
    if (hasKind(k, "other"))   { oth.get(c.id).add(r.to);  oth.get(r.to).add(c.id); }
  }
  // 짝이면서 동시에 부모·자식인 사이(가이아와 우라노스)는 '짝'으로만 센다.
  // 통상의 가계도 그림과 같고, 바이블 ④-7의 완충 의도와도 맞는다.
  // **형제 유도보다 먼저** 해야 한다. 안 그러면 우라노스가 가이아의 아이로 남아
  // 크로노스의 형제로 잡힌다.
  // 짝은 형제 칸에도 뜨면 안 된다. 제우스와 헤라가 '짝'과 '형제자매' 두 칸에 동시에 뜨면
  // 바이블 ④-7이 라벨로 막으려던 직설 계보가 묶음 배치로 새어 나간다.
  for (const a of ids) for (const b of sp.get(a)) {
    kids.get(a).delete(b); par.get(a).delete(b); sib.get(a).delete(b);
  }
  // 부모를 하나라도 함께 쓰면 형제다. 여섯 남매에게 sibling 관계 20줄을 적게 하지 않는다.
  for (const a of ids) for (const b of ids) {
    if (a === b || sp.get(a).has(b)) continue;
    if ([...par.get(a)].some((p) => par.get(b).has(p))) sib.get(a).add(b);
  }

  const byOrder = (a, b) => order.get(a) - order.get(b);
  const covered = new Set(), usedAsKid = new Set();

  // 아이가 있는 사람마다 카드 하나. 아이는 '함께 낳은 짝'별로 줄을 나눈다.
  const cards = [];
  for (const c of chars) {
    const mine = [...kids.get(c.id)];
    if (!mine.length) continue;
    // 같은 아이의 다른 부모가 나보다 먼저 나왔으면 그 사람이 카드 주인이다(중복 카드 방지).
    const isOwner = mine.every((k) =>
      ![...par.get(k)].some((p) => p !== c.id && order.get(p) < order.get(c.id)));
    if (!isOwner) continue;

    const rows = new Map();
    for (const k of mine.sort(byOrder)) {
      const co = [...par.get(k)].filter((p) => p !== c.id).sort(byOrder);
      const mate = co[0] || "";
      if (!rows.has(mate)) rows.set(mate, []);
      rows.get(mate).push(k);
      usedAsKid.add(k);
      if (mate) covered.add(mate);
    }
    covered.add(c.id);
    // 짝과 낳은 아이가 먼저, "혼자서"는 맨 아래
    const sorted = [...rows.entries()].sort((a, b) =>
      (a[0] ? order.get(a[0]) : Infinity) - (b[0] ? order.get(b[0]) : Infinity));
    cards.push({ who: c.id, rows: sorted });
  }
  cards.sort((a, b) => byOrder(a.who, b.who));

  // 같이 낳은 아이가 없는 짝
  const seenPair = new Set(), pairs = [];
  for (const c of chars) for (const m of sp.get(c.id)) {
    const key = [c.id, m].sort().join("|");
    if (seenPair.has(key)) continue;
    seenPair.add(key);
    if ([...kids.get(c.id)].some((k) => par.get(k).has(m))) continue;
    pairs.push([c.id, m].sort(byOrder));
    covered.add(c.id); covered.add(m);
  }

  // 부모가 안 보이는 형제 묶음
  const seenSib = new Set(), sibs = [];
  for (const c of chars) {
    if (seenSib.has(c.id) || par.get(c.id).size || !sib.get(c.id).size) continue;
    const grp = [c.id, ...[...sib.get(c.id)].filter((s) => !par.get(s).size)];
    if (grp.length < 2) continue;
    grp.forEach((g) => { seenSib.add(g); covered.add(g); });
    sibs.push(grp.sort(byOrder));
  }

  const loners = chars.filter((c) => !covered.has(c.id) && !usedAsKid.has(c.id)).map((c) => c.id);
  return { cards, pairs, sibs, loners, kids, par, sp, sib, oth, by, order };
}

export const KIND_VALUES = KINDS;

// ── 이하 HTML 조립 ──
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/** 가족 보기 본문 HTML. G는 groupFamilies 결과. 클릭 배선은 codex.js가 한다(.p[data-id]). */
export function familyStackHtml({ season, G, open = null }) {
  const hasCard = new Set(G.cards.map((c) => c.who));
  const img = (c) => `<img src="${esc(imgSrc(season.id, c.portrait))}" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('span'),{textContent:this.dataset.ini}))" data-ini="${esc(c.name[0])}">`;

  const chip = (id, big = false) => {
    const c = G.by.get(id);
    if (!c) return "";
    return `<button type="button" class="p f-${esc(c.faction)}${big ? " big" : ""}${id === open ? " on" : ""}" data-id="${esc(id)}">
      <span class="av">${img(c)}</span><span class="nm">${esc(c.name)}</span>
      ${!big && hasCard.has(id) ? `<span class="down" aria-label="이 인물도 아래에 가족이 있어요">↓</span>` : ""}</button>`;
  };
  const inCard = (card) => !!open && (card.who === open
    || card.rows.some(([m, ks]) => m === open || ks.includes(open)));

  const cardHtml = (card) => `<section class="fam${inCard(card) ? " hit" : ""}">
      <div class="fam-who">${chip(card.who, true)}<span class="of">의 아이들</span></div>
      <div class="fam-rows">${card.rows.map(([mate, ks]) => `<div class="fam-row">
        <p class="with">${mate ? `<b>${esc(G.by.get(mate).name)}</b>와 함께` : "혼자서"}</p>
        <div class="kids">${ks.map((k) => chip(k)).join("")}</div></div>`).join("")}</div>
    </section>`;

  const mini = (cls, title, inner, hit) =>
    `<div class="mini ${cls}${hit ? " hit" : ""}"><h3>${title}</h3><div class="mrow">${inner}</div></div>`;

  return G.cards.map(cardHtml).join("")
    + (G.pairs.length ? mini("", "짝을 이룬 사이",
        G.pairs.map(([a, b]) => `<span class="pair">${chip(a)}<span class="link" aria-hidden="true">♥</span>${chip(b)}</span>`).join(""),
        open && G.pairs.some(([a, b]) => a === open || b === open)) : "")
    + (G.sibs.length ? mini("", "형제자매",
        G.sibs.map((g) => `<span class="pair">${g.map((x) => chip(x)).join("")}</span>`).join(""),
        open && G.sibs.some((g) => g.includes(open))) : "")
    + (G.loners.length ? mini("sunk", "혼자 나온 인물",
        G.loners.map((x) => chip(x)).join(""),
        open && G.loners.includes(open)) : "")
    || `<p class="char-empty">아직 만난 인물이 없어요.<br>이야기를 읽으면 하나씩 열려요.</p>`;
}
