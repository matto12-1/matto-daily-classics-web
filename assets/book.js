// assets/book.js: 책 모드. 순수 함수(흐름·쪽 나누기·펼침)는 위, DOM 렌더는 아래.
//
// 쪽 경계는 **JSON이 아니라 화면이 정한다**(Matto, 2026-09-03). 회차 JSON의 pages는
// 집필·검사용 단위로 남기고, 읽을 때는 문단만 이어 붙여 지면에 재서 다시 나눈다.
// 왜: 폰은 한 줄 16자, 데스크톱 두 쪽 펼침은 31자다. 한 벌의 쪽 나누기로 둘 다 채울 수 없어서
// 폰에서는 17쪽 중 13쪽이 넘쳤고(390x844 실측), 넘치는 펼침마다 fitToScreen이 글씨를 22%까지
// 줄여 쪽을 넘길 때마다 글씨가 흔들렸다. 지면에 맞춰 나누면 넷이 한꺼번에 없어진다:
// 휑한 쪽 · 글씨 흔들림 · 폰 넘침 · 도판 쪽 넘침.
//
// 도판(plates)은 화면을 따로 차지하지 않고 제 문단 옆에 떠서 글이 그 옆으로 흐른다.
// 좌우는 회차 안에서 번갈아 둔다: 첫 장 오른쪽, 둘째 장 왼쪽.
export function platesOf(episode) {
  const out = new Map();
  (episode.plates || []).forEach((p, i) => out.set(p.on, { ...p, side: i % 2 === 0 ? "r" : "l" }));
  return out;
}

/**
 * 회차를 한 줄기 흐름으로 편다. 쪽 경계는 여기서 사라진다.
 * 머리글과 도판은 그 자리의 문단에 붙어 다닌다: 기기가 달라도 같은 문단 옆에 선다.
 */
export function unitsOf(episode) {
  const plates = platesOf(episode);
  const out = [];
  for (const page of episode.pages || []) {
    splitParas(page.text).forEach((text, i) => out.push({
      text,
      heading: i === 0 ? page.heading || null : null,
      plate: i === 0 ? plates.get(page.no) || null : null,
    }));
  }
  return out;
}

/**
 * 흐름을 지면에 맞춰 쪽으로 나눈다.
 * @param fits  (units) => boolean. 이 문단들이 지면 하나에 들어가는지 재서 답한다(DOM은 renderBook이 쥔다).
 * 머리글은 언제나 새 쪽을 연다. 한 문단이 통째로 안 들어가면 그 문단만으로 한 쪽을 만든다
 * (넘치는 쪽은 .more-hint가 받아 준다: 못 나누느니 넘치는 게 낫다).
 */
export function paginate(units, fits) {
  // 글은 문단보다 잘게 못 쪼갠다. 그러니 문단 하나가 지면보다 크면 **그림이 물러선다.**
  //   1) 줄여서 들어가면 줄인다(.cut.tight, 74회 11쪽)
  //   2) 줄여도 안 들어가면 다음 문단으로 넘긴다(32회 24쪽). 바로 이어지는 글이라 멀어지지 않는다.
  const flow = units.map((u) => ({ ...u }));
  for (let i = 0; i < flow.length - 1; i++) {
    if (flow[i].plate && !fits([flow[i]], true)) { flow[i + 1].plate = flow[i].plate; flow[i].plate = null; }
  }
  const pages = [];
  let cur = [];
  const push = () => {
    if (!cur.length) return;
    const tight = cur.length === 1 && !!cur[0].plate && !fits(cur, false);
    pages.push({ units: cur, tight });
    cur = [];
  };
  for (const u of flow) {
    if (cur.length && (u.heading || !fits([...cur, u], false))) push();
    cur.push(u);
  }
  push();
  return pages.map((p, i) => ({ no: i + 1, units: p.units, tight: p.tight, at: flow.indexOf(p.units[0]) }));
}

export function screensOf(pages) {
  return [{ kind: "cover" }, ...pages.map((page) => ({ kind: "page", page })), { kind: "end" }];
}
// two=true면 표지(0)와 마지막(total-1)은 단독, 본문은 홀수-짝수 쌍으로 묶는다.
export function spreadsOf(total, two) {
  if (!two) return Array.from({ length: total }, (_, i) => [i]);
  const out = [[0]];
  for (let i = 1; i < total - 1; i += 2) out.push(i + 1 < total - 1 ? [i, i + 1] : [i]);
  out.push([total - 1]);
  return out;
}
export const spreadIndexOf = (spreads, screen) => spreads.findIndex((s) => s.includes(screen));
export const clampScreen = (i, total) => Math.max(0, Math.min(total - 1, Number.isInteger(i) ? i : 0));

// ── 이어보기 자리표 ──
// 쪽 번호는 이제 기기마다 다르다(화면이 나누니까). 그래서 **문단 번호**로 기억한다.
// 문단은 어느 기기에서도 같은 문단이라 폰에서 읽다 태블릿으로 옮겨도 자리가 안 흔들린다.
// 0=표지, N=N번째 문단(1부터), -1=끝. 저장값과 주소의 `p`가 이 값이다.
export function anchorOf(screens, i) {
  const s = screens[clampScreen(i, screens.length)];
  if (!s || s.kind === "cover") return 0;
  if (s.kind === "end") return -1;
  return s.page.at + 1;
}
// 못 찾으면 그 문단보다 앞선 가장 가까운 쪽으로 — 앞으로 건너뛰어 못 읽고 지나치는 것보다 낫다.
export function screenOfAnchor(screens, a) {
  if (a === -1) return screens.length - 1;
  if (!Number.isInteger(a) || a <= 0) return 0;
  let best = 0;
  screens.forEach((s, j) => { if (s.kind === "page" && s.page.at + 1 <= a) best = j; });
  return best;
}
export const splitParas = (text) => String(text ?? "").split(/\n\s*\n+/).map((p) => p.trim()).filter(Boolean);
// 대사 문단(따옴표로 시작)은 조판 간격을 좁힌다: 책의 대화 조판이고, 한 쪽에 들어가는 줄 수도 아낀다.
export const isSay = (p) => /^["“‘]/.test(String(p ?? ""));

// ── 이하 DOM 렌더 ──
import { SPECKLE } from "./art.js";
import { SITE_NAME } from "./config.js";
import { byId } from "./codex.js";
import { imgSrc } from "./content.js";
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
// 그림 주소는 imgSrc 로만 만든다 — 내용 해시 ?v= 가 붙어, 같은 이름으로 그림을 바꿔도 1년 캐시에 안 막힌다.
// (09-23 에 잠깐 표지에만 손으로 올리는 COVER_REV 를 두었다가 이것으로 바꿨다. middleware 는 pathname 만 봐서 잠금은 그대로)

// 두 쪽으로 펼칠지는 CSS가 정한 지면 폭에서 곧장 나온다.
//   .sheet          max-width = 34 x 본문크기 + 72px
//   .book-stage.two 좌우 여백 40px + 지면 사이 20px = 60px
// 줄 길이 34em이 이상이고 **33em까지가 읽을 만한 선**이다. 그 아래로 눌리면 한 쪽이 낫다.
//   두 쪽 조건: 창 너비 >= 2 x (33 x 본문크기 + 72) + 60
//
// 본문 크기는 화면 높이가 정하고 큰 글씨는 **다른 clamp**를 쓴다. 이걸 빠뜨리면
// 큰 글씨를 켠 1264x677에서 두 지면이 231px씩 넘쳤다(2026-09-01 실측).
// 옛 고정 문턱(1180x880)은 그 창을 아예 한 쪽으로 막아서 이 조합이 안 생겼을 뿐이다.
const MIN_EM = 33, SHEET_PAD = 72, STAGE_CHROME = 60, FIT_FLOOR = 0.78;
// CSS --body-base 두 갈래를 그대로 옮긴 것이다. 화면 **높이**가 본문 크기를 정한다.
//   보통    clamp(17px, 2.2vh, 21px)
//   큰 글씨 clamp(20px, 2.7vh, 26px)
const baseBodyPx = () => document.body.classList.contains("bigfont")
  ? Math.min(26, Math.max(20, window.innerHeight * 0.027))
  : Math.min(21, Math.max(17, window.innerHeight * 0.022));
// 두 쪽이 서려면 지면 하나가 33em을 담아야 하니 창 너비 >= 2 x (33 x f + 72) + 60.
// f로 풀면 두 쪽이 허용하는 **본문 크기 상한**이 나온다.
const twoPageMaxPx = () => (window.innerWidth - 2 * SHEET_PAD - STAGE_CHROME) / (2 * MIN_EM);
// 큰 글씨는 --fit이 줄여 주지 않으므로(크게 읽겠다고 한 사람이다) 있는 그대로 재고,
// 보통은 --fit이 0.78까지 줄일 수 있으니 **줄였을 때 되는지**를 묻는다.
//
// "지금 크기로 되나"로 물으면 전체화면에서 두 쪽이 한 쪽으로 접힌다: 전체화면은 세로를
// 키우고, 세로가 크면 본문이 커지고(2.2vh), 커진 본문은 두 쪽에 안 들어간다.
// 공간을 얻으려고 누른 버튼이 펼침을 뺏는 셈이었다(2026-09-01, 1264x677 -> 1264x813).
const fitFloorNow = () => (document.body.classList.contains("bigfont") ? 1 : FIT_FLOOR);
const isTwo = () => window.matchMedia("(orientation:landscape)").matches
  && twoPageMaxPx() >= baseBodyPx() * fitFloorNow();
const canFullscreen = () => !!document.documentElement.requestFullscreen;
const ARROW_DOWN = `<svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M7 2v9M3 7.5L7 11.5l4-4" stroke="currentColor" stroke-width="1.8"/></svg>`;
const ARROW_L = `<svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M9 2L4 7l5 5" stroke="currentColor" stroke-width="1.8"/></svg>`;
const ARROW_R = `<svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M5 2l5 5-5 5" stroke="currentColor" stroke-width="1.8"/></svg>`;

export function renderBook({ season, episode, characters, startAnchor = 0, unlocked = 0, nextOpensOn = null, readHere = () => {} }, handlers = {}) {
  const units = unitsOf(episode);
  // 쪽은 지면을 재서 나눈다. 아래 layout()이 채운다.
  let screens = [], total = 0, nPages = 0, spreads = [], two = isTwo();
  let cur = 0;
  const chars = byId(characters);

  const el = document.createElement("article");
  el.className = `paper reading theme-${esc(season.theme)}`;
  el.innerHTML = `${SPECKLE}
    <header class="topbar">
      <button type="button" class="brand home" data-home title="처음 화면으로">${esc(SITE_NAME)}</button>
      <span class="brand-meta">${esc(season.short)} · <span class="credit">made by Matto</span></span>
      <h1 class="bar-title"><em>제${episode.ep}회</em> ${esc(episode.title)}<small>약 ${episode.readingTimeMin}분</small></h1>
      <div class="controls">
        <button type="button" class="tbtn" id="bk-codex" aria-label="인물 도감">👥<span class="tb-txt"> 인물 도감</span></button>
        <button type="button" class="tbtn" data-home aria-label="처음 화면으로">🏠<span class="tb-txt"> 홈</span></button>
        <button type="button" class="tbtn" id="bk-font" aria-label="큰 글씨" aria-pressed="${document.body.classList.contains("bigfont")}">Aa<span class="tb-txt"> 큰 글씨</span></button>
        ${canFullscreen() ? `<button type="button" class="tbtn" id="bk-fs" aria-label="전체화면" aria-pressed="false">⛶<span class="tb-txt"> 전체화면</span></button>` : ""}
        <button type="button" class="tbtn" id="bk-print" aria-label="인쇄">🖨<span class="tb-txt"> 인쇄</span></button>
      </div>
    </header>
    <section class="book" aria-label="책 읽기">
      <div class="book-stage ${two ? "two" : "one"}" id="stage">
        <button type="button" class="tap-zone left" id="tap-l" tabindex="-1" aria-hidden="true"></button>
        <button type="button" class="tap-zone right" id="tap-r" tabindex="-1" aria-hidden="true"></button>
      </div>
      <nav class="book-nav" aria-label="쪽 넘기기">
        <button type="button" class="nav-btn" id="nv-prev">${ARROW_L} 이전 쪽</button>
        <div class="progress">
          <span class="pg-bar" id="pg-bar" aria-hidden="true"></span>
          <span class="pg-label" id="pg-label" role="status"></span>
        </div>
        <button type="button" class="nav-btn next" id="nv-next">다음 쪽 ${ARROW_R}</button>
      </nav>
    </section>`;

  const stage = el.querySelector("#stage");
  const prevBtn = el.querySelector("#nv-prev");
  const nextBtn = el.querySelector("#nv-next");
  const bar = el.querySelector("#pg-bar");
  let ticks = [];

  // 한 쪽의 속. 도판은 제 문단 **앞에** 띄운다: 그 문단부터 글이 그림 옆으로 흐른다.
  const bodyHtml = (us, tight) => us.map((u) =>
    (u.plate ? `<figure class="cut cut-${esc(u.plate.side)}${tight ? " tight" : ""}"><img src="${esc(imgSrc(season.id, u.plate.file))}" alt="${esc(u.plate.scene || "")}" onerror="this.closest('figure').remove()"></figure>` : "")
    + `<p${isSay(u.text) ? ' class="say"' : ""}>${esc(u.text)}</p>`).join("");
  const pageHtml = (page) => `<div class="sheet page">
      <div class="folio"><span>${page.no}</span><span class="rule"></span></div>
      ${page.units[0].heading ? `<div class="meander" aria-hidden="true"></div><h2 class="p-head">${esc(page.units[0].heading)}</h2>` : ""}
      <div class="p-body">${bodyHtml(page.units, page.tight)}</div>
      <div class="leafend" aria-hidden="true"><i></i></div>
    </div>`;

  // 지면 하나를 실제로 그려 보고 넘치는지 묻는다. 재는 동안만 무대에 세우고 곧 치운다.
  // 두 쪽 모드에서는 지면 폭이 절반이므로 짝이 될 빈 지면도 같이 세워야 폭이 맞는다.
  function measurer() {
    stage.querySelectorAll(".sheet").forEach((x) => x.remove());
    stage.insertAdjacentHTML("afterbegin",
      `<div class="sheet page probe" style="visibility:hidden"><div class="folio"><span>0</span><span class="rule"></span></div><div class="p-body"></div><div class="leafend"><i></i></div></div>`
      + (two ? `<div class="sheet page probe" style="visibility:hidden"></div>` : ""));
    const probe = stage.querySelector(".sheet.probe");
    const head = probe.querySelector(".folio");
    const body = probe.querySelector(".p-body");
    return {
      fits(us, tight) {
        const h = us[0].heading;
        head.nextElementSibling?.classList.contains("meander") && head.nextElementSibling.remove();
        probe.querySelector(".p-head")?.remove();
        if (h) head.insertAdjacentHTML("afterend", `<div class="meander"></div><h2 class="p-head">${esc(h)}</h2>`);
        body.innerHTML = bodyHtml(us, tight);
        return probe.scrollHeight <= probe.clientHeight;
      },
      done() { stage.querySelectorAll(".sheet.probe").forEach((x) => x.remove()); },
    };
  }

  // 지면을 재서 쪽을 다시 나눈다. 창 크기·큰 글씨·전체화면이 바뀌면 다시 부른다.
  // 읽던 자리(문단)를 붙들고 있다가 새 쪽에서 그 문단이 실린 쪽으로 되돌아간다.
  function layout(keepAnchor = null) {
    const m = measurer();
    const pages = paginate(units, m.fits);
    m.done();
    screens = screensOf(pages);
    total = screens.length;
    nPages = pages.length;
    spreads = spreadsOf(total, two);
    if (bar.childElementCount !== nPages) {
      bar.innerHTML = Array.from({ length: nPages }, () => "<i></i>").join("");
      ticks = [...bar.querySelectorAll("i")];
    }
    cur = clampScreen(screenOfAnchor(screens, keepAnchor == null ? startAnchor : keepAnchor), total);
  }

  const sheetHtml = (i) => {
    const s = screens[i];
    // 글(회차·제목·지난 이야기)을 한 칸으로 묶는다 — 두 쪽 화면에서 그림 왼쪽 · 글 오른쪽으로 선다(styles.css 표지)
    if (s.kind === "cover") return `<div class="sheet cover">
        <img src="${esc(imgSrc(season.id, episode.cover))}" alt="" loading="lazy" onerror="this.remove()">
        <div class="cover-txt">
        <p class="ep-no">제 ${episode.ep} 회 · 약 ${episode.readingTimeMin}분</p>
        <h1>${esc(episode.title)}</h1>
        ${episode.recap?.length ? `<div class="recap"><h3>지난 이야기</h3><ol>${episode.recap.map((r) => `<li>${esc(r)}</li>`).join("")}</ol></div>`
                                : `<div class="recap"><h3>이야기를 시작하며</h3><p>${esc(season.intro)}</p></div>`}
        </div>
      </div>`;
    if (s.kind === "page") return pageHtml(s.page);
    const canNext = episode.ep < season.totalEpisodes && episode.ep + 1 <= unlocked;
    // 도감에 카드가 아직 없는 인물은 조용히 건너뛴다. 한 명도 없으면 제목까지 숨긴다.
    const castCards = (episode.cast || []).map((id) => chars.get(id)).filter(Boolean).map((c) =>
      `<button type="button" class="cast-card" data-id="${esc(c.id)}"><img src="${esc(imgSrc(season.id, c.portrait))}" alt="" onerror="this.remove()"><b>${esc(c.name)}</b></button>`).join("");
    return `<div class="sheet end">
        <div class="folio"><span>FIN</span><span class="rule"></span></div>
        <h2>오늘은 여기까지</h2>
        <div class="predict"><p class="q">${esc(episode.predict?.question)}</p><p class="h">${esc(episode.predict?.hint || "정답은 없어요.")}</p></div>
        ${episode.nextPreview ? `<p class="next-preview">${esc(episode.nextPreview)}</p>` : ""}
        ${castCards ? `<h3>오늘 등장한 인물</h3><div class="cast">${castCards}</div>` : ""}
        <div class="end-actions">
          <button type="button" class="btn primary" id="end-next" ${canNext ? "" : "disabled"}>${episode.ep >= season.totalEpisodes ? "완결! 고마워요" : canNext ? "다음 회 읽기" : nextOpensOn ? `${nextOpensOn}에 열려요` : "다음 회는 곧 공개돼요"}</button>
          <button type="button" class="btn" id="end-codex">인물 도감</button>
          <button type="button" class="btn" id="end-list">회차 목록</button>
        </div>
      </div>`;
  };

  // 넘침 안전장치: 화면이 작아 쪽이 잘리면 "아직 남았어요"를 띄우고,
  // 끝까지 내려가기 전에는 다음 쪽 버튼을 안 켠다(DECISIONS 2026-08-23).
  const atLastSpread = () => spreadIndexOf(spreads, cur) === spreads.length - 1;
  const overflowing = () => [...stage.querySelectorAll(".sheet")].some((sh) => sh.scrollHeight - sh.clientHeight > 2);
  // 쪽이 화면보다 크면 글자를 한 단계씩 줄여 맞춘다. 바닥(0.78)까지 줄여도 안 들어가면
  // 그때는 스크롤을 허용하고 아래 안전장치가 받는다.
  const FIT_STEP = 0.06;
  function fitToScreen() {
    // 두 쪽일 때는 가로가 먼저 본문 크기를 묶는다. 1에서 시작하면 지면이 옆으로 눌려
    // 줄이 짧아지므로(31em 같은), 두 쪽이 허용하는 상한에서 시작한다.
    const cap = two ? Math.min(1, twoPageMaxPx() / baseBodyPx()) : 1;
    // 넘칠 때 글씨를 줄이던 고리는 없앴다(2026-09-03). 쪽을 지면에 맞춰 나누므로 줄일 일이 없고,
    // 줄이면 펼침마다 글씨 크기가 달라져 넘길 때마다 흔들렸다. 남은 것은 두 쪽 폭 상한뿐이다.
    el.style.setProperty("--fit", String(Math.max(FIT_FLOOR, Math.floor(cap * 100) / 100)));
  }
  function syncOverflow() {
    let blocked = false;
    // 표지(지난 이야기)와 마지막 쪽(예측 질문·인물)도 잘리면 안 된다. 본문 쪽만 보다가 놓쳤다.
    stage.querySelectorAll(".sheet").forEach((sh) => {
      const over = sh.scrollHeight - sh.clientHeight > 2;
      let hint = sh.querySelector(".more-hint");
      if (!over) { hint?.remove(); return; }
      if (!hint) {
        hint = document.createElement("p");
        hint.className = "more-hint";
        hint.setAttribute("role", "status");
        hint.innerHTML = `${ARROW_DOWN} 아직 남았어요. 끝까지 내려서 읽어요`;
        sh.appendChild(hint);
      }
      const atEnd = sh.scrollTop + sh.clientHeight >= sh.scrollHeight - 4;
      hint.hidden = atEnd;
      if (!atEnd) blocked = true;
    });
    nextBtn.disabled = atLastSpread() || blocked;
  }

  function paint() {
    const si = spreadIndexOf(spreads, cur);
    stage.querySelectorAll(".sheet").forEach((s) => s.remove());
    stage.insertAdjacentHTML("afterbegin", spreads[si].map(sheetHtml).join(""));
    prevBtn.disabled = si === 0;

    const shown = spreads[si].map((i) => screens[i]);
    const nums = shown.filter((s) => s.kind === "page").map((s) => s.page.no);
    const firstNo = nums[0] ?? null;
    ticks.forEach((t, i) => {
      t.className = nums.includes(i + 1) ? "now" : (firstNo != null ? i + 1 < firstNo : screens[cur].kind === "end") ? "done" : "";
    });
    el.querySelector("#pg-label").innerHTML = nums.length
      ? `<b>${nums.join("·")}</b> / ${nPages}쪽<span>← → 키로도 넘겨요</span>`
      : `${{ cover: "표지", end: "끝" }[screens[cur].kind]}<span>← → 키로도 넘겨요</span>`;

    stage.querySelectorAll(".cast-card").forEach((b) => b.addEventListener("click", () => handlers.onOpenCodex?.(b.dataset.id)));
    stage.querySelector("#end-next")?.addEventListener("click", () => handlers.onNext?.());
    stage.querySelector("#end-codex")?.addEventListener("click", () => handlers.onOpenCodex?.());
    stage.querySelector("#end-list")?.addEventListener("click", () => handlers.onList?.());
    stage.querySelectorAll(".sheet").forEach((sh) => sh.addEventListener("scroll", syncOverflow, { passive: true }));

    if (screens[cur].kind === "end") readHere();
    handlers.onScreen?.(anchorOf(screens, cur));
    syncOverflow();
  }

  function go(delta) {
    if (delta > 0 && nextBtn.disabled) return;
    const si = spreadIndexOf(spreads, cur);
    const ni = Math.max(0, Math.min(spreads.length - 1, si + delta));
    if (ni === si) return;
    cur = spreads[ni][0];
    paint();
  }

  prevBtn.addEventListener("click", () => go(-1));
  nextBtn.addEventListener("click", () => go(1));
  el.querySelector("#tap-l").addEventListener("click", () => go(-1));
  el.querySelector("#tap-r").addEventListener("click", () => go(1));
  el.querySelectorAll("[data-home]").forEach((b) => b.addEventListener("click", () => handlers.onList?.()));
  el.querySelector("#bk-codex").addEventListener("click", () => handlers.onOpenCodex?.());
  el.querySelector("#bk-print").addEventListener("click", () => handlers.onPrint?.());
  el.querySelector("#bk-font").addEventListener("click", (e) => {
    const on = document.body.classList.toggle("bigfont");
    e.currentTarget.setAttribute("aria-pressed", String(on));
    reflow();
  });
  const fsBtn = el.querySelector("#bk-fs");
  fsBtn?.addEventListener("click", async () => {
    try { document.fullscreenElement ? await document.exitFullscreen() : await document.documentElement.requestFullscreen(); }
    catch { /* 브라우저가 막으면 조용히 넘어간다 */ }
  });
  const onFs = () => {
    fsBtn?.setAttribute("aria-pressed", String(!!document.fullscreenElement));
    reflow(); // 전체화면은 세로를 바꾼다 = 본문 크기가 바뀐다 = 펼침을 다시 따져야 한다
  };

  const onKey = (e) => {
    if (e.target.closest("input,select,textarea")) return;
    if (e.key === "ArrowRight") go(1); else if (e.key === "ArrowLeft") go(-1);
  };
  let x0 = null, y0 = 0;
  stage.addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
  stage.addEventListener("touchend", (e) => {
    if (x0 == null) return;
    const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
    x0 = null;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1);
  });
  // 본문 크기가 바뀌면(창 크기 · 큰 글씨) 두 쪽이 아직 성립하는지 다시 따진다.
  // 큰 글씨만 켜고 모드를 그대로 두면 두 지면이 나란히 넘친다.
  // 창 크기·큰 글씨·전체화면이 바뀌면 지면이 달라진다 = 쪽을 다시 나눠야 한다.
  let reflowing = false;
  const reflow = () => {
    if (reflowing) return;
    reflowing = true;
    const keep = anchorOf(screens, cur);
    two = isTwo();
    stage.classList.toggle("two", two); stage.classList.toggle("one", !two);
    fitToScreen();
    layout(keep);
    paint();
    reflowing = false;
  };
  const onResize = reflow;
  document.addEventListener("keydown", onKey);
  window.addEventListener("resize", onResize);
  document.addEventListener("fullscreenchange", onFs);
  el.cleanup = () => {
    document.removeEventListener("keydown", onKey);
    window.removeEventListener("resize", onResize);
    document.removeEventListener("fullscreenchange", onFs);
  };
  // 무대가 문서에 붙기 전에는 지면을 못 잰다. app.js가 붙인 다음 프레임에 처음 나눈다.
  el.mount = () => { fitToScreen(); layout(); paint();
    // 웹폰트가 늦게 오면 첫 측정이 실제보다 작게 나온다. 폰트가 앉은 뒤 한 번 더 나눈다.
    document.fonts?.ready.then(() => reflow());
  };
  return el;
}
