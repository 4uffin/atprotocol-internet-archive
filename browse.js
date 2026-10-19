import { loadItems, esc } from "./atproto.js";

const $ = id => document.getElementById(id);
const state = {
  items: [],
  tag: new URLSearchParams(location.search).get("tag") || "",
  q: "",
  sort: "newest",
};

function visible() {
  const q = state.q.toLowerCase();
  let list = state.items.filter(it =>
    (!state.tag || (it.tags || []).includes(state.tag)) &&
    (!q || [it.title, it.description, it.creator, ...(it.tags || [])]
      .join(" ").toLowerCase().includes(q))
  );
  if (state.sort === "oldest") list = [...list].reverse();
  if (state.sort === "title") list = [...list].sort((a, b) => (a.title || "").localeCompare(b.title || ""));
  return list;
}

function card(it) {
  const href = `item.html?did=${encodeURIComponent(it.did)}&rkey=${encodeURIComponent(it.rkey)}`;
  const date = it.date || (it.createdAt || "").slice(0, 10);
  return `
    <a class="card" href="${esc(href)}">
      <h2>${esc(it.title) || "Untitled"}</h2>
      <p class="meta">${esc(it.creator || "Unknown creator")} · ${esc(date)}</p>
      <p>${esc((it.description || "").slice(0, 160))}</p>
      <div class="tags">${(it.tags || []).map(t => `<span class="tag">${esc(t)}</span>`).join("")}</div>
    </a>`;
}

function renderTags() {
  const counts = new Map();
  for (const it of state.items) for (const t of it.tags || []) counts.set(t, (counts.get(t) || 0) + 1);
  const sorted = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  $("tags").innerHTML = [["", "All"], ...sorted.map(([t, n]) => [t, `${t} (${n})`])]
    .map(([t, label]) => `<button data-tag="${esc(t)}" class="${t === state.tag ? "active" : ""}">${esc(label)}</button>`)
    .join("");
}

function render() {
  const list = visible();
  $("grid").innerHTML = list.length ? list.map(card).join("") : `<p class="empty">No items match.</p>`;
}

$("tags").addEventListener("click", e => {
  const btn = e.target.closest("button[data-tag]");
  if (!btn) return;
  state.tag = btn.dataset.tag;
  renderTags();
  render();
});
$("q").addEventListener("input", e => { state.q = e.target.value; render(); });
$("sort").addEventListener("change", e => { state.sort = e.target.value; render(); });

async function init() {
  const handles = await (await fetch("contributors.json")).json();
  $("status").textContent = "Loading items…";
  const { items, errors } = await loadItems(handles);
  state.items = items;
  $("status").textContent =
    `${items.length} item(s) from ${handles.length} contributor(s)` +
    (errors.length ? ` · ${errors.length} repo(s) unavailable` : "");
  if (errors.length) console.warn("Unavailable repos:", errors);
  renderTags();
  render();
}

init().catch(err => { $("status").textContent = `Could not load archive: ${err.message}`; });
