// Shared AT Protocol helpers. Plain ES modules, no build step.

export const CONFIG = {
  // Collection NSID for archive items. Replace "example.com" with a domain you
  // control BEFORE uploading anything. Renaming later means migrating records.
  collection: "com.example.archive.item",
  bskyHost: "https://bsky.social",     // used only to resolve handles
  plc: "https://plc.directory",        // DID document lookup (did:plc only)
  maxUploadBytes: 50 * 1024 * 1024,    // keep well under PDS blob limits
};

const pdsCache = new Map();

export function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

async function xrpc(base, nsid, { method = "GET", params = {}, body, rawBody, contentType, token } = {}) {
  const url = new URL(`${base}/xrpc/${nsid}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  let payload;
  if (rawBody !== undefined) {
    headers["Content-Type"] = contentType || "application/octet-stream";
    payload = rawBody;
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  const res = await fetch(url, { method, headers, body: payload });
  if (!res.ok) {
    let detail = res.statusText;
    try { const j = await res.json(); detail = j.message || j.error || detail; } catch {}
    throw new Error(`${nsid}: ${detail} (HTTP ${res.status})`);
  }
  return res.json();
}

export async function resolveHandle(handle) {
  const { did } = await xrpc(CONFIG.bskyHost, "com.atproto.identity.resolveHandle", {
    params: { handle },
  });
  return did;
}

// Find the PDS that hosts a given account. Results are cached in memory.
export async function pdsFor(did) {
  if (!pdsCache.has(did)) {
    if (!did.startsWith("did:plc:")) throw new Error(`Unsupported DID method: ${did}`);
    const doc = await (await fetch(`${CONFIG.plc}/${did}`)).json();
    const svc = (doc.service || []).find(s => s.id === "#atproto_pds");
    if (!svc) throw new Error(`No PDS listed for ${did}`);
    pdsCache.set(did, svc.serviceEndpoint);
  }
  return pdsCache.get(did);
}

// Read every record in one collection from one repo, following cursors.
async function listRecords(did, collection = CONFIG.collection) {
  const pds = await pdsFor(did);
  const out = [];
  let cursor;
  do {
    const params = { repo: did, collection, limit: "100" };
    if (cursor) params.cursor = cursor;
    const page = await xrpc(pds, "com.atproto.repo.listRecords", { params });
    out.push(...page.records);
    cursor = page.cursor;
  } while (cursor);
  return out;
}

const rkeyOf = uri => uri.split("/").pop();

// Load items from every listed contributor. Failures on one repo don't stop the rest.
export async function loadItems(handles) {
  const results = await Promise.allSettled(handles.map(async h => {
    const did = await resolveHandle(h);
    const recs = await listRecords(did);
    return recs.map(r => ({ did, rkey: rkeyOf(r.uri), ...r.value }));
  }));

  const items = [];
  const errors = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") items.push(...r.value);
    else errors.push(`${handles[i]}: ${r.reason.message}`);
  });
  items.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  return { items, errors };
}

export async function getItem(did, rkey) {
  const pds = await pdsFor(did);
  const r = await xrpc(pds, "com.atproto.repo.getRecord", {
    params: { repo: did, collection: CONFIG.collection, rkey },
  });
  return { did, rkey, ...r.value };
}

// Public URL for a blob. Blob refs look like { ref: { $link: "bafy..." }, mimeType, size }.
export async function blobUrl(did, blob) {
  const pds = await pdsFor(did);
  return `${pds}/xrpc/com.atproto.sync.getBlob?did=${encodeURIComponent(did)}&cid=${encodeURIComponent(blob.ref.$link)}`;
}

// Sign in with a handle (or DID) and an app password. The session lives only in memory.
export async function login(identifier, appPassword) {
  const did = identifier.startsWith("did:") ? identifier : await resolveHandle(identifier);
  const pds = await pdsFor(did);
  const s = await xrpc(pds, "com.atproto.server.createSession", {
    method: "POST",
    body: { identifier, password: appPassword },
  });
  return { did: s.did, handle: s.handle, pds, token: s.accessJwt };
}

export async function listMine(session) {
  const recs = await listRecords(session.did);
  return recs.map(r => ({ did: session.did, rkey: rkeyOf(r.uri), ...r.value }));
}

export async function createItem(session, file, meta, onStatus = () => {}) {
  if (!meta.title) throw new Error("Title is required");
  if (file.size > CONFIG.maxUploadBytes) {
    throw new Error(`File is larger than ${CONFIG.maxUploadBytes / 1048576} MB`);
  }

  const slug = meta.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "item";
  const rkey = `${slug}-${Date.now().toString(36)}`;

  onStatus("Uploading file…");
  const mime = file.type || "application/octet-stream";
  const { blob } = await xrpc(session.pds, "com.atproto.repo.uploadBlob", {
    method: "POST",
    rawBody: file,
    contentType: mime,
    token: session.token,
  });

  onStatus("Saving record…");
  const record = {
    $type: CONFIG.collection,
    title: meta.title,
    creator: meta.creator || undefined,
    description: meta.description || undefined,
    date: meta.date || undefined,
    sourceUrl: meta.sourceUrl || undefined,
    license: meta.license || undefined,
    tags: meta.tags || [],
    fileName: file.name,
    mimeType: mime,
    file: blob,
    createdAt: new Date().toISOString(),
  };

  await xrpc(session.pds, "com.atproto.repo.createRecord", {
    method: "POST",
    token: session.token,
    body: { repo: session.did, collection: CONFIG.collection, rkey, record, validate: false },
  });
  return rkey;
}

export async function deleteItem(session, rkey) {
  await xrpc(session.pds, "com.atproto.repo.deleteRecord", {
    method: "POST",
    token: session.token,
    body: { repo: session.did, collection: CONFIG.collection, rkey },
  });
}
