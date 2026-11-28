// assets/print.js: 회차 1편 A4 인쇄(3~4면). 퀴즈 없음. 아침신문 printWorksheet 방식.
import { SITE_NAME } from "./config.js";
import { splitParas, isSay } from "./book.js";
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export function buildEpisodePrintHtml(season, ep, characters = []) {
  const names = (ep.cast || []).map((id) => characters.find((c) => c.id === id)?.name).filter(Boolean);
  const pages = (ep.pages || []).map((p) =>
    (p.heading ? `<h2 class="pw-sec">${esc(p.heading)}</h2>` : "") +
    splitParas(p.text).map((t) => `<p${isSay(t) ? ' class="say"' : ""}>${esc(t)}</p>`).join("") +
    `<p class="pw-pno">· ${p.no} ·</p>`).join("");
  return `<section class="page">
    <div class="pw-mast"><span class="nm">${esc(SITE_NAME)}</span><span class="meta">${esc(season.short)} · 제 ${ep.ep} 회 · 약 ${ep.readingTimeMin}분</span></div>
    <h1 class="pw-title">${esc(ep.title)}</h1>
    <div class="pw-fill"><div><b>이름</b></div><div><b>학년 / 반</b></div><div><b>읽은 날짜</b></div></div>
    ${ep.recap?.length ? `<div class="pw-recap"><b>지난 이야기</b><ol>${ep.recap.map((r) => `<li>${esc(r)}</li>`).join("")}</ol></div>` : ""}
    <div class="pw-body">${pages}</div>
    <div class="pw-predict"><b>🤔 생각해 보기</b><p>${esc(ep.predict?.question)}</p><div class="pw-write"><div class="ln"></div><div class="ln"></div><div class="ln"></div></div></div>
    ${names.length ? `<p class="pw-cast"><b>오늘 등장한 인물</b> ${names.map(esc).join(" · ")}</p>` : ""}
    <div class="pw-foot"><span>${esc(SITE_NAME)} · ${esc(season.short)} · 제 ${ep.ep} 회 · ${esc(ep.title)}</span><span>made by Matto</span></div>
  </section>`;
}

export function printEpisode(season, ep, characters) {
  let root = document.getElementById("print-root");
  if (!root) { root = document.createElement("div"); root.id = "print-root"; root.style.display = "none"; document.body.appendChild(root); }
  root.innerHTML = buildEpisodePrintHtml(season, ep, characters);
  document.body.classList.add("printing");
  const cleanup = () => { document.body.classList.remove("printing"); window.removeEventListener("afterprint", cleanup); };
  window.addEventListener("afterprint", cleanup);
  window.print();
}
