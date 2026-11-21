// assets/codex.js: 인물 도감. 순수 함수(스포일러 게이트)는 위, DOM 렌더는 아래(Task 9).
import { SPECKLE } from "./art.js";
import { footWrap } from "./shelf.js";
import { SITE_NAME } from "./config.js";
import { groupFamilies, familyStackHtml, relationLabel } from "./family.js";
import { imgSrc } from "./content.js";

export const byId = (chars) => new Map(chars.map((c) => [c.id, c]));

// 현재 회차 ep 기준으로 보여도 되는 인물만, 각 인물의 타임라인·관계도 ep 이하/보이는 상대만.
export function visibleCharacters(chars, ep) {
  const shown = chars.filter((c) => Number.isInteger(c.firstEp) && c.firstEp <= ep);
  const ids = new Set(shown.map((c) => c.id));
  return shown.map((c) => ({
    ...c,
    timeline: (c.timeline || []).filter((t) => t.ep <= ep),
    // 상대가 아직 안 열렸거나, 그 관계가 밝혀지는 회차(sinceEp)가 아직 안 왔으면 감춘다.
    relations: (c.relations || []).filter((r) => ids.has(r.to) && (r.sinceEp ?? 0) <= ep),
    // 칭호도 그 자리를 맡는 회차부터. 4회에 하데스 카드를 연 아이에게 6회 결말을 미리 알리지 않는다.
    titles: (c.titles || []).filter((t) => t.sinceEp <= ep),
  }));
}

export function groupByFaction(chars, factions) {
  const order = [...(factions || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return order
    .map((f) => ({ faction: f.id, label: f.label, items: chars.filter((c) => c.faction === f.id) }))
    .filter((g) => g.items.length);
}

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export function renderCodex({ season, characters, ep, unlocked, focusId = null }, handlers = {}) {
  const visible = visibleCharacters(characters, ep);
  const map = byId(visible);
  const countOf = (fid) => visible.filter((c) => c.faction === fid).length;
  // 아직 아무도 안 나온 진영도 흐리게 보여 준다: "더 나올 게 있다"가 보여야 한다.
  const allFactions = [...(season.factions || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  let mode = "cards";                                   // cards | family
  let tab = visible.find((c) => c.id === focusId)?.faction || "all";
  let open = focusId && map.has(focusId) ? focusId : null;

  const el = document.createElement("article");
  el.className = `paper theme-${esc(season.theme)}`;
  el.innerHTML = `${SPECKLE}
    <header class="topbar">
      <button type="button" class="brand home" data-home title="처음 화면으로">${esc(SITE_NAME)}</button>
      <span class="brand-meta">${esc(season.short)}</span>
      <h1 class="bar-title">인물 도감<small>제 ${esc(ep)} 회까지 ${visible.length}명</small></h1>
      <div class="controls"><button type="button" class="tbtn" id="cx-close" aria-label="돌아가기">←<span class="tb-txt"> 돌아가기</span></button><button type="button" class="tbtn" data-home aria-label="처음 화면으로">🏠<span class="tb-txt"> 홈</span></button></div>
    </header>
    <section class="codex">
      <div class="codex-head">
        <h1>인물 도감</h1>
        <div class="codex-tools">
          <div class="seg" role="group" aria-label="보기">
            <button type="button" data-m="cards" aria-pressed="true">카드</button>
            <button type="button" data-m="family" aria-pressed="false">가족</button>
          </div>
          <label>기준 회차 <select class="codex-ep" id="cx-ep" aria-label="기준 회차">${Array.from({ length: Math.max(1, unlocked) }, (_, i) => `<option value="${i + 1}" ${i + 1 === ep ? "selected" : ""}>제 ${i + 1} 회까지</option>`).join("")}</select></label>
        </div>
      </div>
      <p class="codex-note" id="cx-note"></p>
      <div class="fac-tabs" role="tablist" id="cx-tabs"></div>
      <div class="codex-body">
        <div id="cx-main"></div>
        <aside class="codex-detail" id="cx-detail" aria-live="polite"></aside>
      </div>
    </section>
    ${footWrap()}`;

  const tabsEl = el.querySelector("#cx-tabs"), main = el.querySelector("#cx-main");
  const detail = el.querySelector("#cx-detail"), note = el.querySelector("#cx-note");
  const seg = el.querySelector(".seg");
  const img = (c) => `<img src="${esc(imgSrc(season.id, c.portrait))}" alt="" loading="lazy" onerror="this.remove()">`;

  function paint() {
    // 진영 탭: 아직 아무도 안 나온 진영은 뒤로 민다
    const fac = allFactions.map((f) => ({ id: f.id, label: f.label, n: countOf(f.id) }));
    const tabs = [{ id: "all", label: "전체", n: visible.length }, ...fac.filter((t) => t.n), ...fac.filter((t) => !t.n)];
    tabsEl.innerHTML = tabs.map((t) =>
      `<button type="button" role="tab" class="fac-tab${t.n ? "" : " dim"}" data-f="${esc(t.id)}" aria-selected="${t.id === tab}" ${t.n ? "" : "disabled"}>${esc(t.label)} <em>${t.n}</em></button>`).join("");
    tabsEl.querySelectorAll(".fac-tab:not([disabled])").forEach((b) =>
      b.addEventListener("click", () => { tab = b.dataset.f; open = null; paint(); }));

    const shown = tab === "all" ? visible : visible.filter((c) => c.faction === tab);
    const G = groupFamilies(shown);

    seg.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.m === mode)));
    note.textContent = mode === "family"
      ? "한 줄이 한 문장이에요. 인물을 누르면 그 사람이 나오는 가족만 밝아져요."
      : "읽은 데까지만 열려요. 뒷이야기는 비밀이에요.";

    main.className = mode === "family" ? `family-stack${open ? " focused" : ""}` : "char-grid";
    main.innerHTML = mode === "family"
      ? familyStackHtml({ season, G, open })
      : (shown.length
        ? shown.map((c) => `<button type="button" class="char-card" data-id="${esc(c.id)}" aria-expanded="${open === c.id}">${img(c)}<span class="cc-in"><b>${esc(c.name)}</b>${c.titles?.length ? `<span class="title-badge sm">${esc(c.titles.at(-1).text)}</span>` : ""}<small>${esc(c.oneLine)}</small></span></button>`).join("")
        : `<p class="char-empty">아직 만난 인물이 없어요.<br>이야기를 읽으면 하나씩 열려요.</p>`);

    main.querySelectorAll("[data-id]").forEach((b) => b.addEventListener("click", () => {
      open = open === b.dataset.id ? null : b.dataset.id; paint();
      if (open && mode === "cards") detail.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }));

    detail.innerHTML = detailHtml(open ? map.get(open) : null, G);
  }

  function detailHtml(c, G) {
    if (!c) return `<p class="detail-empty">인물을 누르면 관계와 발자취가 여기에 열려요.</p>`;
    const grp = (label, set, kind, cls = "") => {
      const arr = [...(set || [])].filter((x) => map.has(x));
      if (!arr.length) return "";
      return `<div class="rel-grp ${cls}"><b>${label}</b>${arr.map((x) => {
        const lb = relationLabel(visible, c.id, x, kind);
        return `<span>${esc(map.get(x).name)}${lb ? ` · ${esc(lb)}` : ""}</span>`;
      }).join("")}</div>`;
    };
    const inView = G.by.has(c.id);
    return `<div class="char-detail">
        ${img(c)}
        <div>
          <h2>${esc(c.name)}${c.titles?.length ? `<span class="title-badge">${esc(c.titles.at(-1).text)}</span>` : ""}</h2>
          ${c.alias?.length ? `<p class="alias">${c.alias.map(esc).join(" · ")}</p>` : ""}
          <p class="one">${esc(c.oneLine)}</p>
          ${c.about ? `<p class="about">${esc(c.about)}</p>` : ""}
          <dl><dt>진영</dt><dd>${esc(allFactions.find((f) => f.id === c.faction)?.label || c.faction)}</dd></dl>
          <dl><dt>첫 등장</dt><dd>제 ${esc(c.firstEp)} 회</dd></dl>
          ${inView ? grp("부모", G.par.get(c.id), "parent") + grp("짝", G.sp.get(c.id), "spouse")
                   + grp("형제자매", G.sib.get(c.id), "sibling") + grp("아이", G.kids.get(c.id), "child")
                   + grp("그 밖의 사이", G.oth.get(c.id), "other", "other") : ""}
          ${c.timeline.length ? `<div class="trace"><p class="lbl">발자취</p><ol>${c.timeline.map((t) => `<li><b>${esc(t.ep)}</b><span>${esc(t.text)}</span></li>`).join("")}</ol></div>` : ""}
        </div></div>`;
  }

  seg.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => { mode = b.dataset.m; paint(); }));
  el.querySelector("#cx-close").addEventListener("click", () => handlers.onClose?.());
  el.querySelectorAll("[data-home]").forEach((b) => b.addEventListener("click", () => handlers.onHome?.()));
  el.querySelector("#cx-ep").addEventListener("change", (e) => handlers.onEpChange?.(Number(e.target.value)));
  paint();
  return el;
}
