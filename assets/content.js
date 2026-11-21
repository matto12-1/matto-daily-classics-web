// assets/content.js: 시즌·회차 로딩 + 공개 회차 계산(순수 함수, Node 테스트 가능).
import { TIMEZONE_OFFSET_MIN } from "./config.js";
import { IMG_REV } from "./img-rev.js";

// 그림 주소는 **여기서만** 만든다 — 내용 해시 ?v= 를 붙인다(assets/img-rev.js, tools/img-rev.mjs 가 만든다).
// 표지·도판·초상 jpg 는 1년 immutable 캐시라, 같은 이름으로 그림을 바꾸면 주소가 바뀌어야 이미 본 학생에게 간다 (2026-09-23)
export const imgSrc = (seasonId, p) => {
  const v = IMG_REV[`${seasonId}/${p}`];
  return `content/${seasonId}/${p}${v ? `?v=${v}` : ""}`;
};

export function todayISO(offsetMin = TIMEZONE_OFFSET_MIN, now = Date.now()) {
  return new Date(now + offsetMin * 60000).toISOString().slice(0, 10);
}
export const epFile = (ep) => String(ep).padStart(3, "0");
// 주소 경로: 검색용 회차 주소(/<시즌>/NNN/)에서 그 회차를 보고 있으면 경로를 지키고, 다른 화면이면 맨 위(/)로.
// 회차 주소의 쪽은 <base href="/"> 라 「?…」만 쓰면 맨 위로 샌다 (2026-10-29 DECISIONS 「검색」 (2)). 맨 위 사이트에선 늘 「/」라 전과 같다
export const pathFor = (pathname, { s, ep } = {}) => (s && ep && pathname === `/${s}/${epFile(ep)}/` ? pathname : "/");

const toUTC = (iso) => { const [y, m, d] = iso.split("-").map(Number); return Date.UTC(y, m - 1, d); };
const fromUTC = (ms) => new Date(ms).toISOString().slice(0, 10);
export const addDays = (iso, n) => fromUTC(toUTC(iso) + n * 86400000);
export function isWeekday(iso) { const w = new Date(toUTC(iso)).getUTCDay(); return w >= 1 && w <= 5; }

// 공개일 목록 생성기: startDate부터 평일·비공휴일만 차례로. 회차 ep의 공개일 = 그 ep번째 날.
export function* releaseDays(season) {
  const skip = new Set(season.holidays || []);
  let d = season.startDate;
  while (true) {
    if (isWeekday(d) && !skip.has(d)) yield d;
    d = addDays(d, 1);
  }
}

// 오늘까지 공개된 회차 수. 시작 전 0, 상한 totalEpisodes.
export function unlockedCount(season, today) {
  if (!season?.startDate || today < season.startDate) return 0;
  let n = 0;
  for (const d of releaseDays(season)) {
    if (d > today || n >= season.totalEpisodes) break;
    n++;
  }
  return n;
}

// 시작일부터 today까지 실제로 공개된 날들(평일·비공휴일). 연속 읽기 일수 계산에 쓴다.
export function releaseDaysUntil(season, today) {
  const out = [];
  if (!season?.startDate || today < season.startDate) return out;
  for (const d of releaseDays(season)) {
    if (d > today || out.length >= season.totalEpisodes) break;
    out.push(d);
  }
  return out;
}

// ep회의 공개일. 범위 밖이면 null.
export function unlockDateOf(season, ep) {
  if (!Number.isInteger(ep) || ep < 1 || ep > season.totalEpisodes) return null;
  let i = 0;
  for (const d of releaseDays(season)) { if (++i === ep) return d; }
  return null;
}

// URL → 화면. 잘못된 값은 안전한 기본값으로.
export function parseParams(search) {
  const q = new URLSearchParams(search || "");
  const s = q.get("s") || null;
  const epRaw = Number(q.get("ep"));
  const ep = Number.isInteger(epRaw) && epRaw >= 1 ? epRaw : null;
  // p 는 **쪽 번호**다(0=표지, -1=끝). 화면 번호가 아니다: 도판이 끼면 화면 번호는 밀린다(book.js anchorOf).
  const pRaw = Number(q.get("p"));
  const p = Number.isInteger(pRaw) && pRaw >= -1 ? pRaw : 0;
  let view = "shelf";
  if (s && q.get("codex")) view = "codex";
  else if (s && ep) view = "book";
  else if (s) view = "list";
  return { s, ep, p, view };
}

async function getJSON(url, msg) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(msg);
  return r.json();
}
export const loadSeasons = () => getJSON("content/seasons.json", "서가를 불러올 수 없어요");
export const loadSeason = (id) => getJSON(`content/${id}/season.json`, "작품 정보를 불러올 수 없어요");
export const loadEpisode = (id, ep) => getJSON(`content/${id}/ep/${epFile(ep)}.json`, "이 회차를 찾을 수 없어요");
export const loadCharacters = (id) => getJSON(`content/${id}/characters.json`, "인물 도감을 불러올 수 없어요");
