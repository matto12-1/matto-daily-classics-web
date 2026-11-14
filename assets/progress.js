// assets/progress.js: 이어 읽기 위치·읽음 표시. 기기 localStorage에만, 서버 0.
// 저장소가 없거나(사파리 사생활 보호 등) 던지면 조용히 무시한다: 기억을 못 할 뿐 앱은 뜬다.
const K = (id, k) => `dc:${id}:${k}`;
const read = (store, key) => { try { return store?.getItem(key) ?? null; } catch { return null; } };
const write = (store, key, v) => { try { store?.setItem(key, v); } catch { /* 무시 */ } };
const parse = (s, fallback) => { try { return s == null ? fallback : JSON.parse(s); } catch { return fallback; } };
const def = () => { try { return globalThis.localStorage; } catch { return undefined; } };

// p 는 **쪽 번호**다(0=표지, -1=끝). 화면 index를 저장하면 도판이 끼거나 빠질 때 자리가 밀린다(book.js anchorOf).
export function getLast(seasonId, store = def()) {
  const v = parse(read(store, K(seasonId, "last")), null);
  return v && Number.isInteger(v.ep) && Number.isInteger(v.p) ? { ep: v.ep, p: v.p } : null;
}
export function setLast(seasonId, ep, p, store = def()) {
  write(store, K(seasonId, "last"), JSON.stringify({ ep, p }));
}
export function readSet(seasonId, store = def()) {
  const arr = parse(read(store, K(seasonId, "read")), []);
  return new Set(Array.isArray(arr) ? arr.filter(Number.isInteger) : []);
}
export function markRead(seasonId, ep, store = def(), today = null) {
  const set = readSet(seasonId, store); set.add(ep);
  write(store, K(seasonId, "read"), JSON.stringify([...set].sort((a, b) => a - b)));
  if (today) markDay(seasonId, today, store);
}

// 읽은 '날'을 따로 남긴다. 회차 번호만으로는 "며칠째 이어서 읽었는가"를 알 수 없다.
export function readDays(seasonId, store = def()) {
  const arr = parse(read(store, K(seasonId, "days")), []);
  return Array.isArray(arr) ? arr.filter((d) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)) : [];
}
export function markDay(seasonId, dayISO, store = def()) {
  const days = new Set(readDays(seasonId, store)); days.add(dayISO);
  write(store, K(seasonId, "days"), JSON.stringify([...days].sort()));
}

/**
 * 이어서 읽은 날 수. 공개일(평일)만 센다: 주말에 안 읽었다고 끊기면 억울하다.
 * 가장 최근 공개일부터 거꾸로, 읽은 날이 이어지는 만큼.
 * 오늘이 공개일인데 아직 안 읽었으면 어제까지로 세고, 그것도 끊겼으면 0.
 * @param {string[]} days     읽은 날(ISO, 오름차순)
 * @param {string[]} release  시작일부터 오늘까지의 공개일(ISO, 오름차순)
 */
export function streakDays(days, release) {
  const seen = new Set(days);
  let n = 0;
  for (let i = release.length - 1; i >= 0; i--) {
    if (seen.has(release[i])) n++;
    else if (n === 0 && i === release.length - 1) continue;  // 오늘 아직 안 읽었을 뿐
    else break;
  }
  return n;
}

// ── 주소 이사 (2026-09-11) ── 브라우저는 저장소를 주소마다 따로 둔다. 옛 주소의 기록을 새 주소로 옮길 때
// 이 앱의 칸(dc:*)을 통째로 싸고(packAll), 받는 쪽은 합친다(mergeAll).
// ⚠ 같은 꾸러미를 두 번 합쳐도 결과가 같아야 한다 — 옛 주소로 다시 들어올 때마다 또 넘어온다.
export function packAll(store = def()) {
  const out = {};
  try {
    for (let i = 0; i < store.length; i++) { const k = store.key(i); if (k?.startsWith("dc:")) out[k] = store.getItem(k); }
  } catch { /* 저장 막힘 — 빈 꾸러미 */ }
  return out;
}
// 읽은 회차·읽은 날은 합집합. 이어 읽기 자리는 **더 멀리 간 쪽**(같은 회차면 뒤쪽 쪽, -1 = 끝까지 읽음).
export function mergeAll(packed, store = def()) {
  const far = (v) => (v ? v.ep * 1e4 + (v.p === -1 ? 9999 : v.p) : -1);
  for (const [k, v] of Object.entries(packed || {})) {
    const m = /^dc:(.+):(read|days|last)$/.exec(k);
    if (!m || typeof v !== "string") continue;
    const [, id, kind] = m;
    if (kind === "last") {
      const inc = parse(v, null);
      if (inc && Number.isInteger(inc.ep) && Number.isInteger(inc.p) && far(inc) > far(getLast(id, store))) setLast(id, inc.ep, inc.p, store);
      continue;
    }
    const a = parse(read(store, k), []), b = parse(v, []);
    const all = [...new Set([...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])])];
    write(store, k, JSON.stringify(all.sort((x, y) => (x < y ? -1 : x > y ? 1 : 0))));
  }
}
