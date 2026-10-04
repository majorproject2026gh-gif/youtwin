// Runs on youtube.com. Answers the side panel's questions about what the
// viewer is watching, and seeks the player when a citation is clicked.
// Read-only apart from seeking — it never sends page data anywhere itself.
(() => {
  const TWIN_PATH_RE = /\/twin\/([A-Za-z0-9_-]{1,64})(?=[/?#\s]|$)/;

  function videoId() {
    const u = new URL(location.href);
    const v = u.searchParams.get("v");
    if (v && /^[A-Za-z0-9_-]{11}$/.test(v)) return v;
    const m = u.pathname.match(/^\/(?:shorts|live)\/([A-Za-z0-9_-]{11})/);
    return m ? m[1] : null;
  }

  function player() {
    return document.querySelector("video.html5-main-video") || document.querySelector("#movie_player video") || document.querySelector("video");
  }

  function title() {
    const h = document.querySelector("ytd-watch-metadata h1, h1.ytd-watch-metadata, h1.title");
    return (h && h.textContent.trim()) || document.title.replace(/\s*-\s*YouTube$/, "");
  }

  function channel() {
    const a = document.querySelector("ytd-watch-metadata ytd-channel-name a, #owner ytd-channel-name a, #channel-name a");
    return a ? a.textContent.trim() : "";
  }

  // The creator pastes their twin link into the video description.
  // YouTube wraps outbound links as /redirect?q=<url>, so unwrap those.
  function twinLink() {
    const root = document.querySelector("ytd-watch-metadata #description, #description-inline-expander, #description, ytd-expandable-video-description-body-renderer");
    if (!root) return null;
    const candidates = [];
    root.querySelectorAll("a[href]").forEach((a) => {
      let href = a.href;
      try {
        const u = new URL(href);
        if (u.pathname === "/redirect" && u.searchParams.get("q")) href = u.searchParams.get("q");
      } catch (_) { /* ignore */ }
      candidates.push(href, a.textContent || "");
    });
    candidates.push(root.textContent || "");
    for (const c of candidates) {
      const m = c && c.match(TWIN_PATH_RE);
      if (m) {
        let origin = null;
        try { origin = new URL(c.trim().startsWith("http") ? c.trim() : "https://" + c.trim()).origin; } catch (_) { /* text only */ }
        return { handle: m[1], origin };
      }
    }
    return null;
  }

  chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
    if (!msg || typeof msg !== "object") return;
    if (msg.type === "youtwin:context") {
      const v = player();
      reply({
        ok: true,
        videoId: videoId(),
        seconds: v ? Math.floor(v.currentTime) : null,
        paused: v ? v.paused : true,
        title: title(),
        channel: channel(),
        twin: twinLink(),
      });
      return;
    }
    if (msg.type === "youtwin:seek" && Number.isFinite(msg.seconds)) {
      const v = player();
      if (v && msg.videoId === videoId()) {
        v.currentTime = Math.max(0, msg.seconds);
        v.play().catch(() => {});
        reply({ ok: true });
      } else reply({ ok: false });
    }
  });
})();
