// assets/app.js: 부팅·라우팅·상태·에러 폴백.
import { loadSeasons, loadSeason, loadEpisode, loadCharacters, todayISO, unlockedCount, parseParams, unlockDateOf, releaseDaysUntil, pathFor } from "./content.js";
import { getLast, setLast, markRead, readSet, readDays, streakDays, packAll, mergeAll } from "./progress.js";
import { renderShelf, renderEpisodeList, fmtDate } from "./shelf.js";
import { renderBook } from "./book.js";
import { renderCodex } from "./codex.js";
import { printEpisode } from "./print.js";
import { mountViews } from "./views.js";
import { SITE_NAME } from "./config.js";
import { SPECKLE } from "./art.js";
import { footWrap } from "./shelf.js";
// ── 주소 이사 (2026-09-11) ── classics.matto.kr 로 옮기자 옛 주소에서 읽은 기록이 새 주소에서 안 보였다(Matto 제보).
// 옛 주소로 들어오면 그 칸의 기록을 들고 새 주소로 넘어가고(주소창도 새 주소가 된다), 새 주소는 받은 기록을 합친다.
// `#` 뒤는 서버로 가지 않는다. ⚠ 서버(Vercel) 리디렉트로 바꾸지 마라 — 옛 주소 페이지가 한 번은 떠야 그 칸을 읽는다.
// 옛 주소 칸은 지우지 않는다(mergeAll 은 두 번 합쳐도 같다).
const OLD_HOST = "matto-daily-classics.vercel.app", NEW_ORIGIN = "https://classics.matto.kr";
if (location.hostname === OLD_HOST) {
  const packed = packAll();
  location.replace(NEW_ORIGIN + location.pathname + location.search
    + (Object.keys(packed).length ? "#move=" + encodeURIComponent(JSON.stringify(packed)) : location.hash));
} else if (location.hash.startsWith("#move=")) {
  try { mergeAll(JSON.parse(decodeURIComponent(location.hash.slice(6)))); } catch { /* 깨진 주소면 합치지 않는다 */ }
  history.replaceState(null, "", location.pathname + location.search);
}


const app = document.getElementById("app");
const cache = { seasons: null, season: {}, chars: {}, ep: {} };
let current = null; // 현재 화면 요소(cleanup용)
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const seasons = async () => (cache.seasons ??= await loadSeasons());
const season = async (id) => (cache.season[id] ??= await loadSeason(id));
const chars = async (id) => (cache.chars[id] ??= await loadCharacters(id));
const episode = async (id, ep) => (cache.ep[`${id}/${ep}`] ??= await loadEpisode(id, ep));

function show(el) { current?.cleanup?.(); current = el; app.replaceChildren(el); window.scrollTo({ top: 0 }); }
function setUrl(params) { const q = new URLSearchParams(Object.entries({ ...params, today: PREVIEW }).filter(([, v]) => v != null && v !== "")); history.replaceState(null, "", pathFor(location.pathname, params) + (q.toString() ? `?${q}` : "")); }

// 내일 회차를 미리 눈으로 검수하려고 날짜를 옮기는 스위치. **로컬에서만 먹는다.**
// 배포본에서 먹으면 아무나 다음 회차를 앞질러 볼 수 있다: 매일 한 회씩 여는 연재가 무너진다.
//   node serve.mjs  →  http://localhost:8080/?s=greek-myth&ep=4&today=2026-09-04
const PREVIEW = (/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)
  && /^\d{4}-\d{2}-\d{2}$/.test(new URLSearchParams(location.search).get("today") || ""))
  ? new URLSearchParams(location.search).get("today") : null;
const today = () => PREVIEW || todayISO();

// 시즌이 하나뿐이면 서가를 건너뛰고 바로 회차 목록으로 간다(DECISIONS 2026-08-23).
// 둘 이상이 되면 자동으로 서가가 되살아난다.
async function goHome() {
  const list = await seasons();
  if (list.length === 1) return goList(list[0].id);
  return goShelf();
}

async function goShelf() {
  const list = await seasons();
  const unlockedBySeason = {}, lastBySeason = {};
  for (const s of list) { const full = await season(s.id); unlockedBySeason[s.id] = unlockedCount(full, today()); lastBySeason[s.id] = getLast(s.id); }
  const el = renderShelf({ seasons: list, today: today(), lastBySeason, unlockedBySeason }, {
    onContinue: (id) => { const l = getLast(id); goBook(id, l?.ep || 1, l?.p || 0); },
    onStart: (id) => goBook(id, 1, 0),
    onList: (id) => goList(id),
    onCodex: (id) => goCodex(id),
  });
  setUrl({}); show(el);
}

async function goList(id) {
  const s = await season(id), unlocked = unlockedCount(s, today());
  const streak = streakDays(readDays(id), releaseDaysUntil(s, today()));
  const el = renderEpisodeList({ season: s, unlocked, readSet: readSet(id), last: getLast(id), streak }, {
    onOpen: (ep) => goBook(id, ep, 0),
    onContinue: () => { const l = getLast(id); goBook(id, l?.ep || 1, l?.p || 0); },
    onCodex: () => goCodex(id),
  });
  setUrl({ s: id }); show(el); mountViews(el);
  // 공개 회차 제목 채우기(비동기, 실패해도 목록은 뜬다)
  const titles = {};
  await Promise.all(Array.from({ length: unlocked }, (_, i) => i + 1).map(async (ep) => { try { titles[ep] = (await episode(id, ep)).title; } catch { /* 무시 */ } }));
  el.fillTitles(titles);
}

// p 는 화면 번호가 아니라 **쪽 번호**다(0=표지, -1=끝). 도판이 끼어도 안 밀린다.
async function goBook(id, ep, p = 0) {
  const s = await season(id), unlocked = unlockedCount(s, today());
  if (ep > unlocked || ep < 1) return renderLocked(s, ep, unlocked);
  const [e, c] = await Promise.all([episode(id, ep), chars(id)]);
  const nextWhen = unlockDateOf(s, ep + 1);
  const el = renderBook({ season: s, episode: e, characters: c, startAnchor: p, unlocked,
    nextOpensOn: nextWhen ? fmtDate(nextWhen) : null,
    readHere: () => markRead(id, ep, undefined, today()) }, {
    onScreen: (a) => { setLast(id, ep, a); setUrl({ s: id, ep, p: a || null }); },
    onOpenCodex: (focusId) => goCodex(id, ep, focusId),
    onNext: () => goBook(id, ep + 1, 0),
    onList: () => goList(id),
    onPrint: () => printEpisode(s, e, c),
  });
  show(el);
  el.mount?.();   // 지면을 재서 쪽을 나눈다. 문서에 붙은 뒤여야 잴 수 있다.
}

// returnTo = 닫을 때 돌아갈 회차(기본은 들어온 회차). 기준 회차(ep)를 바꿔도 돌아갈 곳은 안 변한다.
async function goCodex(id, ep = null, focusId = null, returnTo = ep) {
  const s = await season(id), unlocked = unlockedCount(s, today());
  if (!unlocked) return renderLocked(s, 1, 0); // 아직 시작 안 한 작품: 도감으로 1회 인물을 미리 보여주지 않는다
  const base = Math.min(ep || getLast(id)?.ep || unlocked || 1, Math.max(unlocked, 1));
  const c = await chars(id);
  const el = renderCodex({ season: s, characters: c, ep: base, unlocked, focusId }, {
    onClose: () => (returnTo ? goBook(id, returnTo, getLast(id)?.ep === returnTo ? getLast(id).p : 0) : goList(id)),
    onHome: () => goList(id),
    onEpChange: (n) => goCodex(id, n, null, returnTo),
  });
  setUrl({ s: id, codex: 1, ep: base }); show(el); mountViews(el);
}

// 일부러 setUrl을 부르지 않는다: 사용자가 친 ?ep=N을 그대로 남겨 새로고침해도 같은 화면이 뜨게.
function renderLocked(s, ep, unlocked) {
  const when = unlockDateOf(s, ep);
  const el = document.createElement("article"); el.className = `paper theme-${esc(s.theme)}`;
  el.innerHTML = `${SPECKLE}
    <header class="topbar">
      <button type="button" class="brand home" id="lk-home" title="처음 화면으로">${esc(SITE_NAME)}</button>
      <span class="brand-meta">${esc(s.short)}</span>
      <h1 class="bar-title">아직 안 열린 회차</h1>
      <div class="controls">
        <button type="button" class="tbtn" id="lk-codex" aria-label="인물 도감">👥<span class="tb-txt"> 인물 도감</span></button>
        <button type="button" class="tbtn" id="lk-home2" aria-label="처음 화면으로">🏠<span class="tb-txt"> 홈</span></button>
      </div>
    </header>
    <section class="notice"><h1>아직 펼칠 수 없어요</h1>
    <p>${when ? `제 ${ep} 회는 ${fmtDate(when)}에 열려요.` : "이 회차는 없어요."}<br>${unlocked ? `지금은 제 ${unlocked} 회까지 읽을 수 있어요.` : "아직 시즌이 시작되지 않았어요."}</p>
    <button type="button" class="btn primary" id="lk-list">회차 목록으로</button></section>
    ${footWrap()}`;
  el.querySelectorAll("#lk-list, #lk-home, #lk-home2").forEach((b) => b.addEventListener("click", () => goList(s.id)));
  mountViews(el);
  el.querySelector("#lk-codex").addEventListener("click", () => goCodex(s.id));
  show(el);
}

function renderError(err) {
  current?.cleanup?.(); current = null;
  app.innerHTML = `<article class="paper theme-olympus">
    <header class="topbar">
      <button type="button" class="brand home" id="er-home" title="처음 화면으로">${SITE_NAME}</button>
      <div class="controls">
        <button type="button" class="tbtn" id="er-home2" aria-label="처음 화면으로">🏠<span class="tb-txt"> 홈</span></button>
      </div>
    </header>
    <section class="notice">
    <h1>책장을 잠시 닫아둘게요</h1><p id="er-msg"></p><p>잠시 후 다시 열어 주세요.</p>
    <button type="button" class="btn primary" id="er-home3">처음으로</button></section></article>`;
  // 에러 화면은 상태가 망가진 뒤라 라우터를 다시 부르지 않고 주소를 비워 새로 띄운다.
  app.querySelectorAll("#er-home, #er-home2, #er-home3").forEach((b) =>
    b.addEventListener("click", () => { location.search = ""; }));
  app.querySelector("#er-msg").textContent = `${err?.message || "불러오지 못했어요"}.`; // 에러 문구는 innerHTML로 넣지 않는다
}

// 화면 전환은 전부 async라 실패가 떠 있는 프로미스로 샌다: 한 군데서 받아 에러 화면으로 돌린다.
window.addEventListener("unhandledrejection", (e) => { e.preventDefault(); renderError(e.reason); });

(async function boot() {
  document.title ||= SITE_NAME;   // 검색용 회차 주소의 쪽은 회차 제목을 지닌다 — 덮어쓰지 않는다 (2026-10-29 「검색」 (2))
  try {
    const { s, ep, p, view } = parseParams(location.search);
    if (view === "codex") return await goCodex(s, ep);
    if (view === "book") return await goBook(s, ep, p);
    if (view === "list") return await goList(s);
    return await goHome();
  } catch (err) { renderError(err); }
})();
