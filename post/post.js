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
  $("refresh").addEventListener("click", () => load());

  async function load() {
    $("err").textContent = "";
    let data;
    try { data = await call("list"); } catch (e) { if (e.message !== "not paired") $("err").textContent = e.message; return; }
    const list = data.reels || [];
    $("count").textContent = list.length ? `(${list.length})` : "";
    $("empty").classList.toggle("hidden", !!list.length);
    $("list").replaceChildren(...list.map(row));
  }

  function row(r) {
    const id = `${r.day}/${r.key}`;
    const li = el("li");
    const img = el("img"); img.alt = ""; if (r.cover) img.src = r.cover;
    const body = el("div", "body");
    const t = el("div", "t", r.title);
    t.append(el("small", null, `${r.day}${r.mb ? ` · ${r.mb} MB` : ""}`));
    const share = el("button", "share", files[id] ? "Share to Instagram" : "Get video");
    const row2 = el("div", "row2");
    const copy = el("button", null, "Copy caption"), cover = el("button", null, "Save cover"), done = el("button", null, "Posted ✓");
    [share, copy, cover, done].forEach((b) => { b.type = "button"; });
    row2.append(copy, cover, done);
    body.append(t, share, row2);
    li.append(img, body);

    const copyCaption = () => navigator.clipboard?.writeText(r.caption || "").catch(() => {});
    share.addEventListener("click", async () => {
      if (!files[id]) {  // first tap downloads; the second tap opens the share sheet straight away
        share.disabled = true; share.textContent = "Getting video…";
        try {
          const res = await fetch(r.video, { cache: "no-store" });
          if (!res.ok) throw new Error(res.status === 400 || res.status === 403 ? "link expired, tap Refresh" : `Error ${res.status}`);
          files[id] = new File([await res.blob()], `${r.key}.mp4`, { type: "video/mp4" });
          share.textContent = "Share to Instagram";
        } catch (e) { share.textContent = "Get video (try again)"; $("err").textContent = e.message; }
        share.disabled = false;
        return;
      }
      copyCaption();
      const f = files[id];
      if (!navigator.canShare || !navigator.canShare({ files: [f] })) { alert("This browser can't share videos. Open this page in Safari."); return; }
      try { await navigator.share({ files: [f] }); }
      catch (e) { if (e.name !== "AbortError") alert(`Couldn't open the share sheet: ${e.message}`); }
    });
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
        li.classList.add("done"); delete files[id];
        setTimeout(load, 700);
      } catch (e) { if (e.message !== "not paired") alert(e.message); }
    });
    return li;
  }

  document.addEventListener("visibilitychange", () => { if (!document.hidden && getKey()) load(); });
  if (getKey()) { showApp(); load(); } else showPair();
})();
