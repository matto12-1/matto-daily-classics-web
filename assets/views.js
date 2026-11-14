// assets/views.js: 조회수. 탭(세션) 하나당 한 번만 센다.
// 조회수를 못 가져와도 신문은 그대로 떠야 한다. 실패는 전부 조용히 삼킨다.
import { SUPABASE_URL, SUPABASE_ANON_KEY, RPC_BUMP, RPC_GET } from "./config.js";

const MARK = "dc-counted";

// sessionStorage는 사파리 사생활 보호 모드 등에서 던질 수 있다.
// 읽기가 실패하면 '아직 안 셈'으로 보고 넘어간다(최악이라도 숫자가 조금 부풀 뿐).
const marked = (store) => { try { return !!store?.getItem(MARK); } catch { return false; } };
const mark = (store) => { try { store?.setItem(MARK, "1"); } catch { /* 무시 */ } };

// 로봇(검색·공유 미리보기)과 자동으로 모는 브라우저는 세지 않고 읽기만 한다 — 회차마다 원래 화면을 주소로 미리 찍어 두면서
// 로봇도 이 화면을 연다(2026-10-29 DECISIONS 「검색」 (2)). 화면에는 아무 차이 없다
export const isBot = (ua = globalThis.navigator?.userAgent, webdriver = globalThis.navigator?.webdriver) =>
  webdriver === true || /bot|crawl|spider|slurp|yeti|daum\/|daumoa|scrap|externalhit|bingpreview|headless|lighthouse/i.test(ua || "");

// 이 탭이 이미 셌거나 로봇이면 읽기만, 아니면 +1. 순수 함수라 테스트로 잡는다.
export const pickRpc = (store, bot = isBot()) => (bot || marked(store) ? RPC_GET : RPC_BUMP);

export const formatCount = (n) => Number(n || 0).toLocaleString("ko-KR");

export async function fetchViews(store = globalThis.sessionStorage) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${pickRpc(store)}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  if (!res.ok) throw new Error(`조회수 조회 실패 (${res.status})`);
  const [row] = await res.json();
  mark(store);
  return { today: Number(row?.today ?? 0), total: Number(row?.total ?? 0) };
}

// 한 번 부른 결과를 재사용한다. 학년 토글처럼 화면을 다시 그릴 때마다
// 네트워크를 다시 타지 않게(그리고 두 번 세지 않게) 하기 위함.
let pending;

export function mountViews(root) {
  const el = root.querySelector(".views");
  if (!el) return;
  pending ??= fetchViews();
  pending
    .then(({ today, total }) => {
      // 숫자만 형광펜(--hi)으로 칠한다. 본문 낱말(.vocab)과 같은 문법.
      // formatCount는 Number를 통과시킨 문자열이라 innerHTML에 넣어도 안전하다.
      el.innerHTML =
        `오늘 <span class="n">${formatCount(today)}</span>명이 읽었어요` +
        ` · 지금까지 <span class="n">${formatCount(total)}</span>명`;
      el.hidden = false;
    })
    .catch(() => { /* 조회수는 못 보여도 신문은 뜬다 */ });
}
