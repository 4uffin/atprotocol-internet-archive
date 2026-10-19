import { getItem, blobUrl, esc } from "./atproto.js";

const params = new URLSearchParams(location.search);
const did = params.get("did");
const rkey = params.get("rkey");
const root = document.getElementById("item");

// Only preview types that can't run scripts on the PDS origin.
// text/html and other active content are deliberately excluded.
function preview(mime, url) {
  const u = esc(url);
  if (mime.startsWith("image/")) return `<img src="${u}" alt="">`;
  if (mime.startsWith("audio/")) return `<audio controls src="${u}"></audio>`;
  if (mime.startsWith("video/")) return `<video controls src="${u}"></video>`;
  if (mime === "application/pdf") return `<iframe src="${u}" title="PDF preview"></iframe>`;
  if (mime === "text/plain") return `<iframe src="${u}" title="Text preview"></iframe>`;
  return `<p class="empty">No inline preview for this file type.</p>`;
}

function row(label, value) {
  if (!value) return "";
  return `<dt>${esc(label)}</dt><dd>${esc(value)}</dd>`;
}

async function init() {
  if (!did || !rkey) {
    root.innerHTML = `<p class="empty">Missing item reference.</p>`;
    return;
  }
  try {
    const it = await getItem(did, rkey);
    const mime = it.mimeType || it.file?.mimeType || "application/octet-stream";
    const url = await blobUrl(did, it.file);
    document.title = `${it.title} · Archive`;

    root.innerHTML = `
      <h1>${esc(it.title)}</h1>
      <div class="tags">${(it.tags || []).map(t =>
        `<a class="tag" href="index.html?tag=${encodeURIComponent(t)}">${esc(t)}</a>`).join("")}</div>
      ${it.description ? `<p>${esc(it.description)}</p>` : ""}
      <div class="preview">${preview(mime, url)}</div>
      <p><a class="button" href="${esc(url)}" download="${esc(it.fileName || "file")}">Download original</a></p>
      <dl>
        ${row("Creator", it.creator)}
        ${row("Date", it.date)}
        ${row("License", it.license)}
        ${row("File", it.fileName)}
        ${row("Type", mime)}
        ${row("Added", it.createdAt)}
        ${row("Repository", did)}
        ${row("Record key", rkey)}
      </dl>
      ${it.sourceUrl ? `<p>Source: <a href="${esc(it.sourceUrl)}" rel="noopener noreferrer">${esc(it.sourceUrl)}</a></p>` : ""}
      <p><a href="index.html">← Back to archive</a></p>`;
  } catch (err) {
    root.innerHTML = `<p class="empty">Could not load item: ${esc(err.message)}</p>`;
  }
}

init();
