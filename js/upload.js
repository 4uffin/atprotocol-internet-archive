import { login, createItem, listMine, deleteItem, esc } from "./atproto.js";

const $ = id => document.getElementById(id);
let session = null; // kept in memory only; gone when the page closes

function msg(text, isError = false) {
  const el = $("msg");
  el.textContent = text;
  el.className = isError ? "error" : "ok";
}

function setBusy(form, busy) {
  for (const el of form.querySelectorAll("button, input, textarea, select")) el.disabled = busy;
}

async function refreshMine() {
  const items = await listMine(session);
  $("mine").innerHTML = items.length
    ? items.map(it => `
        <li>
          <a href="item.html?did=${encodeURIComponent(it.did)}&rkey=${encodeURIComponent(it.rkey)}">${esc(it.title)}</a>
          <button class="danger" data-rkey="${esc(it.rkey)}">Delete</button>
        </li>`).join("")
    : "<li>No items yet.</li>";
}

function showSession() {
  $("login-section").hidden = true;
  $("upload-section").hidden = false;
  $("who").textContent = `Signed in as @${session.handle}`;
  refreshMine().catch(e => msg(e.message, true));
}

$("login-form").addEventListener("submit", async e => {
  e.preventDefault();
  const form = e.target;
  setBusy(form, true);
  msg("Signing in…");
  try {
    session = await login($("identifier").value.trim(), $("app-password").value.trim());
    $("app-password").value = "";
    msg("");
    showSession();
  } catch (err) {
    msg(`Sign-in failed: ${err.message}`, true);
  } finally {
    setBusy(form, false);
  }
});

$("upload-form").addEventListener("submit", async e => {
  e.preventDefault();
  const form = e.target;
  const file = $("file").files[0];
  if (!file) return msg("Choose a file first.", true);

  const tags = $("tags").value.split(",").map(t => t.trim().toLowerCase()).filter(Boolean);
  const meta = {
    title: $("title").value.trim(),
    creator: $("creator").value.trim(),
    description: $("description").value.trim(),
    date: $("date").value,
    sourceUrl: $("sourceUrl").value.trim(),
    license: $("license").value.trim(),
    tags,
  };

  setBusy(form, true);
  try {
    await createItem(session, file, meta, msg);
    msg("Saved. It may take a moment to appear in the archive.");
    form.reset();
    await refreshMine();
  } catch (err) {
    msg(`Upload failed: ${err.message}`, true);
  } finally {
    setBusy(form, false);
  }
});

$("mine").addEventListener("click", async e => {
  const rkey = e.target.dataset?.rkey;
  if (!rkey) return;
  if (!confirm("Delete this item from your repository? This cannot be undone.")) return;
  try {
    await deleteItem(session, rkey);
    await refreshMine();
  } catch (err) {
    msg(`Delete failed: ${err.message}`, true);
  }
});

$("logout").addEventListener("click", () => location.reload());
