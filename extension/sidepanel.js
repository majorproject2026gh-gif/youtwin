// YouTwin side panel — M5's "browser sidebar" delivery channel.
// Talks only to the public viewer API (resolve twin link, chat). All text
// from the network is rendered with textContent, never as HTML.
"use strict";

const $ = (id) => document.getElementById(id);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TWIN_PATH_RE = /\/twin\/([A-Za-z0-9_-]{1,64})(?=[/?#\s]|$)/;

const state = {
  settings: { appUrl: "", apiUrl: "" },
  tabId: null,
  ctx: null,              // latest context from the YouTube tab
  twin: null,             // { twinId, creatorName, handle }
  manual: new Map(),      // videoId -> handle typed by the viewer
  resolving: null,
  sending: false,
};

// ------------------------------------------------------------ helpers

function fmt(sec) {
  sec = Math.max(0, Math.floor(sec || 0));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}

function cleanUrl(raw) {
  const v = (raw || "").trim().replace(/\/+$/, "");
  if (!v) return "";
  let u;
  try { u = new URL(v); } catch { return null; }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname);
  if (u.protocol !== "https:" && !(local && u.protocol === "http:")) return null;
  return u.origin + u.pathname.replace(/\/+$/, "");
}

async function api(path, options = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 45000);
  try {
    const res = await fetch(state.settings.apiUrl + path, {
      ...options,
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      credentials: "omit",
    });
    let body = null;
    try { body = await res.json(); } catch { /* empty */ }
    if (!res.ok) {
      const msg = (body && typeof body.error === "string" && body.error) ||
        (res.status === 429 ? "Too many messages — wait a moment." : `Request failed (${res.status}).`);
      const err = new Error(msg); err.status = res.status; throw err;
    }
    return body;
  } catch (e) {
    if (e.name === "AbortError") throw new Error("The twin took too long to answer. Try again.");
    if (e instanceof TypeError) throw new Error("Couldn't reach the YouTwin API. Check the API URL in settings.");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

function scrollLog() { const l = $("log"); l.scrollTop = l.scrollHeight; }

function setStatus(text) { $("status").textContent = text; }

function setComposer(enabled) {
  $("input").disabled = !enabled;
  $("send").disabled = !enabled || state.sending;
}

// ------------------------------------------------------------ settings

async function loadSettings() {
  const s = await chrome.storage.sync.get(["appUrl", "apiUrl"]);
  state.settings = { appUrl: s.appUrl || "", apiUrl: s.apiUrl || "" };
  $("appUrl").value = state.settings.appUrl;
  $("apiUrl").value = state.settings.apiUrl;
  $("settings").hidden = !!state.settings.apiUrl;
}

$("settingsBtn").addEventListener("click", () => { $("settings").hidden = !$("settings").hidden; });

$("saveSettings").addEventListener("click", async () => {
  const appUrl = cleanUrl($("appUrl").value);
  const apiUrl = cleanUrl($("apiUrl").value);
  if (apiUrl === null || appUrl === null || !apiUrl) {
    $("settingsMsg").textContent = "Enter valid https:// URLs (http only for localhost).";
    return;
  }
  await chrome.storage.sync.set({ appUrl, apiUrl });
  state.settings = { appUrl, apiUrl };
  $("settingsMsg").textContent = "Saved.";
  $("settings").hidden = true;
  state.twin = null;
  refresh();
});

// ------------------------------------------------------------ YouTube tab

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab || null;
}

async function readContext() {
  const tab = await activeTab();
  if (!tab) return null;
  state.tabId = tab.id;
  try {
    const ctx = await chrome.tabs.sendMessage(tab.id, { type: "youtwin:context" });
    return ctx && ctx.ok ? ctx : null;
  } catch {
    return null; // not a YouTube tab, or the tab predates the install
  }
}

function renderContext() {
  const ctx = state.ctx;
  const has = !!(ctx && ctx.videoId);
  $("watching").hidden = !has;
  if (has) {
    $("videoTitle").textContent = ctx.title || "";
    $("channel").textContent = ctx.channel || "";
    $("playhead").textContent = fmt(ctx.seconds);
  }
  updateOpenFull();
}

function updateOpenFull() {
  const a = $("openFull");
  if (!state.twin || !state.settings.appUrl) { a.hidden = true; return; }
  const q = new URLSearchParams();
  if (state.ctx && state.ctx.videoId && $("tieToMoment").checked) {
    q.set("v", state.ctx.videoId);
    if (Number.isFinite(state.ctx.seconds)) q.set("t", String(state.ctx.seconds));
  }
  a.href = `${state.settings.appUrl}/twin/${encodeURIComponent(state.twin.handle)}/chat${q.toString() ? "?" + q : ""}`;
  a.hidden = false;
}

// ------------------------------------------------------------ twin

async function resolveTwin(handle) {
  if (state.twin && state.twin.handle === handle) return;
  if (state.resolving === handle) return;
  state.resolving = handle;
  setStatus("Finding the twin…");
  try {
    const path = UUID_RE.test(handle) ? `/twins/by-id/${handle}` : `/twins/by-handle/${encodeURIComponent(handle)}`;
    const data = await api(path);
    state.twin = { twinId: data.twinId, creatorName: data.creatorName, handle };
    $("creator").textContent = data.creatorName || "Creator";
    $("log").replaceChildren();
    addTwinMessage({ answer: `Hi! I'm ${data.creatorName || "the creator"}'s AI twin. Ask me anything from my videos.`, intro: true });
    setStatus(data.status === "ready" ? "AI twin · answers cite the exact moment" : "Twin is still training");
    setComposer(true);
  } catch (e) {
    state.twin = null;
    $("creator").textContent = "YouTwin";
    setStatus(e.status === 404 ? "That twin link doesn't exist." : e.message);
    setComposer(false);
  } finally {
    state.resolving = null;
    updateOpenFull();
  }
}

async function refresh() {
  state.ctx = await readContext();
  renderContext();
  if (!state.settings.apiUrl) { setStatus("Add the YouTwin API URL to start"); setComposer(false); return; }
  if (!state.ctx || !state.ctx.videoId) {
    if (!state.twin) { setStatus("Open a YouTube video (reload the tab if you just installed)"); setComposer(false); }
    $("linkBox").hidden = true;
    return;
  }
  const handle = (state.ctx.twin && state.ctx.twin.handle) || state.manual.get(state.ctx.videoId);
  $("linkBox").hidden = !!handle || !!state.twin;
  if (handle) await resolveTwin(handle);
}

$("useLink").addEventListener("click", () => {
  const raw = $("manualLink").value.trim();
  const m = raw.match(TWIN_PATH_RE);
  const handle = m ? m[1] : (/^[A-Za-z0-9_-]{1,64}$/.test(raw) ? raw : null);
  if (!handle) { setStatus("That doesn't look like a YouTwin link."); return; }
  if (state.ctx && state.ctx.videoId) state.manual.set(state.ctx.videoId, handle);
  $("linkBox").hidden = true;
  resolveTwin(handle);
});

// ------------------------------------------------------------ chat

function addViewerMessage(text) {
  $("log").append(el("div", "msg viewer", text));
  scrollLog();
}

function addTwinMessage(data) {
  const box = el("div", "msg twin" + (data.refused ? " refused" : "") + (data.error ? " error" : ""), data.answer || "");
  if (!data.intro && !data.error) {
    const meta = el("div", "meta");
    if (data.refused) meta.append(el("span", "badge warn", "Not covered in the videos — refused instead of guessing"));
    else if (data.grounded) meta.append(el("span", "badge", `✓ Grounded · ${Math.round((data.confidence || 0) * 100)}% match`));
    (data.citations || []).forEach((c) => {
      const b = el("button", "cite", `▶ ${fmt(c.timestamp_seconds)} · ${c.video_title || "video"}`);
      b.type = "button";
      b.title = c.snippet || "";
      b.addEventListener("click", () => jumpTo(c));
      meta.append(b);
    });
    if (meta.childNodes.length) box.append(meta);
  }
  $("log").append(box);
  scrollLog();
}

async function jumpTo(c) {
  if (!/^[A-Za-z0-9_-]{11}$/.test(c.video_id || "")) return; // sample/demo transcript
  const seconds = Math.max(0, Math.floor(c.timestamp_seconds || 0));
  if (state.tabId != null && state.ctx && state.ctx.videoId === c.video_id) {
    try {
      const r = await chrome.tabs.sendMessage(state.tabId, { type: "youtwin:seek", videoId: c.video_id, seconds });
      if (r && r.ok) return;
    } catch { /* fall through */ }
  }
  if (state.tabId != null) chrome.tabs.update(state.tabId, { url: `https://www.youtube.com/watch?v=${c.video_id}&t=${seconds}s` });
}

$("composer").addEventListener("submit", async (e) => {
  e.preventDefault();
  const message = $("input").value.trim();
  if (!message || !state.twin || state.sending) return;
  $("input").value = "";
  addViewerMessage(message);
  state.sending = true;
  setComposer(true);
  const typing = el("div", "msg twin typing", "…");
  $("log").append(typing); scrollLog();

  // Fresh playhead at send time, so the answer is tied to *this* moment.
  const ctx = await readContext();
  if (ctx) { state.ctx = ctx; renderContext(); }
  const body = { twinId: state.twin.twinId, message, language: $("language").value };
  if ($("tieToMoment").checked && state.ctx && state.ctx.videoId) {
    body.videoId = state.ctx.videoId;
    if (Number.isFinite(state.ctx.seconds)) body.atSeconds = Math.min(86400, Math.max(0, state.ctx.seconds));
  }
  try {
    const data = await api("/chat", { method: "POST", body: JSON.stringify(body) });
    typing.remove();
    addTwinMessage(data);
  } catch (err) {
    typing.remove();
    addTwinMessage({ answer: err.message || "Something went wrong. Try again.", error: true });
  } finally {
    state.sending = false;
    setComposer(!!state.twin);
    $("input").focus();
  }
});

$("input").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $("composer").requestSubmit(); }
});
$("tieToMoment").addEventListener("change", updateOpenFull);

// ------------------------------------------------------------ boot

chrome.tabs.onActivated.addListener(() => refresh());
chrome.tabs.onUpdated.addListener((_id, info) => { if (info.status === "complete") refresh(); });

loadSettings().then(refresh);
setInterval(async () => {
  // keep the playhead display live without re-resolving the twin
  const ctx = await readContext();
  const changedVideo = (ctx && ctx.videoId) !== (state.ctx && state.ctx.videoId);
  state.ctx = ctx;
  if (changedVideo) refresh(); else renderContext();
}, 1500);
