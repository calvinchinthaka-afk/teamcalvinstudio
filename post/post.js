// TCR "Post with music": Reels Calvin sent from Reel Studio, handed to Instagram through the iPhone share sheet.
// Works with the Mac off: talks only to the Supabase function tcr-phone. Nothing is shown until this phone is
// paired with a one-time code made on the Mac; the phone then keeps its own device key (localStorage).
(() => {
  const FN = "https://gxitusyxtoxuucxlzbwf.supabase.co/functions/v1/tcr-phone";
  const STORE = "tcr-post-key";
  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const getKey = () => { try { return localStorage.getItem(STORE); } catch { return null; } };
  const setKey = (k) => { try { k ? localStorage.setItem(STORE, k) : localStorage.removeItem(STORE); } catch { /* private mode */ } };
  const files = {};
  // which share buttons were used, per Reel, kept on this phone only
  const SHARED = "tcr-post-shared";
  const sharedAll = () => { try { return JSON.parse(localStorage.getItem(SHARED) || "{}"); } catch { return {}; } };
  const shared = (id) => ({ ...(sharedAll()[id] || {}), ...(sessionTicks[id] || {}) });
  const markShared = (id, where) => {
    const all = sharedAll();
    all[id] = { ...(all[id] || {}), [where]: Date.now() };
    const cutoff = Date.now() - 60 * 864e5;  // forget after 60 days
    for (const k of Object.keys(all)) if (Math.max(...Object.values(all[k])) < cutoff) delete all[k];
    try { localStorage.setItem(SHARED, JSON.stringify(all)); } catch { /* private mode: tick lasts until reload */ }
    sessionTicks[id] = { ...(sessionTicks[id] || {}), [where]: 1 };
  };
  const sessionTicks = {};

  async function call(action, extra = {}) {
    const headers = { "Content-Type": "application/json" };
    const k = getKey();
    if (k) headers["x-device-key"] = k;
    const r = await fetch(FN, { method: "POST", headers, body: JSON.stringify({ action, ...extra }), cache: "no-store" });
    const data = await r.json().catch(() => ({}));
    if (r.status === 401) { setKey(null); showPair(); throw new Error("not paired"); }
    if (!r.ok) throw new Error(data.error || `Error ${r.status}`);
    return data;
  }

  function showPair() { $("app").classList.add("hidden"); $("refresh").classList.add("hidden"); $("pair").classList.remove("hidden"); }
  function showApp() { $("pair").classList.add("hidden"); $("app").classList.remove("hidden"); $("refresh").classList.remove("hidden"); }

  $("pairForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    $("pairErr").textContent = "";
    try {
      const label = (navigator.userAgent.match(/\(([^)]+)\)/) || [, "Phone"])[1].slice(0, 60);
      const { key } = await call("pair", { code: $("code").value, label });
      setKey(key);
      $("code").value = "";
      showApp(); load();
    } catch (err) { if (err.message !== "not paired") $("pairErr").textContent = err.message; }
  });

  $("signout").addEventListener("click", () => {
    if (!confirm("Sign this phone out? You'll need a new code from the Mac to pair again.")) return;
    setKey(null); showPair();
  });
  $("refresh").addEventListener("click", () => (view === "archive" ? loadArchive(archDate) : load()));

  // ---- tabs: Ready to post / Archive
  let view = "ready", archDate = "", archDates = [];
  function setView(v) {
    view = v;
    $("tabReady").classList.toggle("on", v === "ready"); $("tabReady").setAttribute("aria-selected", v === "ready");
    $("tabArchive").classList.toggle("on", v === "archive"); $("tabArchive").setAttribute("aria-selected", v === "archive");
    $("readyView").classList.toggle("hidden", v !== "ready");
    $("archiveView").classList.toggle("hidden", v !== "archive");
    v === "archive" ? loadArchive(archDate) : load();
  }
  $("tabReady").addEventListener("click", () => setView("ready"));
  $("tabArchive").addEventListener("click", () => setView("archive"));
  const dayLabel = (d) => {
    if (!d) return "";
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
    const yest = new Date(Date.now() - 864e5).toLocaleDateString("en-CA", { timeZone: "Europe/London" });
    const nice = new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
    return d === today ? `Today · ${nice}` : d === yest ? `Yesterday · ${nice}` : nice;
  };
  // archDates is newest first: "older" moves right in the list, "newer" left
  $("older").addEventListener("click", () => { const i = archDates.indexOf(archDate); if (i >= 0 && i < archDates.length - 1) loadArchive(archDates[i + 1]); });
  $("newer").addEventListener("click", () => { const i = archDates.indexOf(archDate); if (i > 0) loadArchive(archDates[i - 1]); });

  async function loadArchive(date) {
    $("archErr").textContent = "";
    let data;
    try { data = await call("archive", date ? { date } : {}); } catch (e) { if (e.message !== "not paired") $("archErr").textContent = e.message; return; }
    archDates = data.dates || []; archDate = data.date || "";
    const i = archDates.indexOf(archDate);
    $("older").disabled = i < 0 || i >= archDates.length - 1;
    $("newer").disabled = i <= 0;
    $("archDay").textContent = archDate ? dayLabel(archDate) : "Archive";
    const list = data.reels || [];
    $("archCount").textContent = list.length ? `${list.length} posted` : "";
    $("archEmpty").classList.toggle("hidden", !!list.length);
    $("archList").replaceChildren(...list.map((r) => row(r, true)));
  }

  async function load() {
    if (view !== "ready") return;
    $("err").textContent = "";
    let data;
    try { data = await call("list"); } catch (e) { if (e.message !== "not paired") $("err").textContent = e.message; return; }
    const list = data.reels || [];
    $("count").textContent = list.length ? `(${list.length})` : "";
    $("empty").classList.toggle("hidden", !!list.length);
    $("list").replaceChildren(...list.map(row));
  }

  function row(r, archived = false) {
    const id = `${r.day}/${r.key}`;
    const li = el("li");
    const img = el("img"); img.alt = ""; if (r.cover) img.src = r.cover;
    const body = el("div", "body");
    const t = el("div", "t", r.title);
    t.append(el("small", null, `${r.day}${r.mb ? ` · ${r.mb} MB` : ""}`));
    // "Get video" first (iOS only opens the share sheet straight from a tap, so the download is its own tap),
    // then two equal buttons: Share to Instagram / Share to TikTok. Both open the share sheet (Instagram, TikTok,
    // Save Video...); each gets a tick once used, remembered on this phone.
    const get = el("button", "share", "Get video");
    const shares = el("div", "shares");
    const btnIg = el("button", "share", ""), btnTt = el("button", "share tt", "");
    shares.append(btnIg, btnTt);
    const paint = () => {
      const sh = shared(id);
      btnIg.textContent = sh.ig ? "✓ Shared to Instagram" : "Share to Instagram";
      btnTt.textContent = sh.tt ? "✓ Shared to TikTok" : "Share to TikTok";
      btnIg.classList.toggle("did", !!sh.ig); btnTt.classList.toggle("did", !!sh.tt);
      get.classList.toggle("hidden", !!files[id]);
      btnIg.disabled = btnTt.disabled = !files[id];  // shown (with their ticks) but usable once the video is here
    };
    const row2 = el("div", "row2");
    // Ready to post: "Mark as posted" (no tick until it really is). Archive: a plain "Posted ✓ <time>".
    const copy = el("button", null, "Copy caption"), cover = el("button", null, "Save cover"), done = el("button", null, "Mark as posted");
    [get, btnIg, btnTt, copy, cover, done].forEach((b) => { b.type = "button"; });
    if (archived) {
      const when = r.posted ? new Date(r.posted).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }) : "";
      t.append(el("div", "ticked", `Posted ✓${when ? ` ${when}` : ""}`));
      row2.append(copy, cover);
    } else row2.append(copy, cover, done);
    body.append(t, get, shares, row2);
    li.append(img, body);
    paint();

    const copyCaption = () => navigator.clipboard?.writeText(r.caption || "").catch(() => {});
    get.addEventListener("click", async () => {
      get.disabled = true; get.textContent = "Getting video…";
      try {
        const res = await fetch(r.video, { cache: "no-store" });
        if (!res.ok) throw new Error(res.status === 400 || res.status === 403 ? "link expired, tap Refresh" : `Error ${res.status}`);
        files[id] = new File([await res.blob()], `${r.key}.mp4`, { type: "video/mp4" });
        get.textContent = "Get video";
      } catch (e) { get.textContent = "Get video (try again)"; (archived ? $("archErr") : $("err")).textContent = e.message; }
      get.disabled = false;
      paint();
    });
    const shareTo = async (where) => {
      copyCaption();
      const f = files[id];
      if (!navigator.canShare || !navigator.canShare({ files: [f] })) { alert("This browser can't share videos. Open this page in Safari."); return; }
      try { await navigator.share({ files: [f] }); markShared(id, where); paint(); }
      catch (e) { if (e.name !== "AbortError") alert(`Couldn't open the share sheet: ${e.message}`); }
    };
    btnIg.addEventListener("click", () => shareTo("ig"));
    btnTt.addEventListener("click", () => shareTo("tt"));
    copy.addEventListener("click", async () => { await copyCaption(); copy.textContent = "Copied ✓"; setTimeout(() => { copy.textContent = "Copy caption"; }, 1500); });
    cover.addEventListener("click", async () => {
      if (!r.cover) return;
      try {
        const f = new File([await (await fetch(r.cover)).blob()], `${r.key}-cover.jpg`, { type: "image/jpeg" });
        if (navigator.canShare?.({ files: [f] })) await navigator.share({ files: [f] });  // then Save Image
      } catch (e) { if (e.name !== "AbortError") alert(e.message); }
    });
    done.addEventListener("click", async () => {
      if (!confirm(`Mark "${r.title}" as posted (or scheduled) on Instagram?`)) return;
      try {
        await call("posted", { day: r.day, key: r.key });
        li.classList.add("done"); done.textContent = "Posted ✓"; done.disabled = true; delete files[id];
        setTimeout(load, 700);
      } catch (e) { if (e.message !== "not paired") alert(e.message); }
    });
    return li;
  }

  document.addEventListener("visibilitychange", () => { if (!document.hidden && getKey()) (view === "archive" ? loadArchive(archDate) : load()); });
  if (getKey()) { showApp(); load(); } else showPair();
})();
