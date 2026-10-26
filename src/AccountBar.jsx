import React, { useEffect, useRef, useState } from "react";
import { signIn, signOut, subscribe, getSnapshot, pullIfStale, joinHousehold, leaveHousehold, listInvites, addInvite, removeInvite } from "./cloud.js";

// Small floating account control, pinned inside the app's centred column so
// it sits over the header's right-hand side on phone and laptop alike.
const INK = "#163A30", BROWN = "#174D3D", OAT = "#F7FAF8", MUSTARD = "#CBEADD", LINE = "#D8E5DE", CLAY = "#A14F35";

export default function AccountBar() {
  const [s, setS] = useState(getSnapshot());
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const box = useRef(null);
  const [joining, setJoining] = useState(false);
  const [code, setCode] = useState("");
  const [note, setNote] = useState("");
  const [copied, setCopied] = useState(false);
  const [invites, setInvites] = useState([]);
  const [inviteEmail, setInviteEmail] = useState("");
  useEffect(() => subscribe(setS), []);
  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  const isOwner = !!(s.user && s.household && s.household.owner && s.household.owner === s.user.uid);
  useEffect(() => {
    if (open && isOwner) listInvites().then(setInvites).catch(() => {});
  }, [open, isOwner, s.household && s.household.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!s.configured) return null;

  const dot = { saving: MUSTARD, saved: "#6DA58B", offline: "#9A9184", error: "#D17D5C", idle: "#6DA58B" }[s.sync] || "#6DA58B";
  const label = { saving: "Saving…", saved: "Saved to your account", offline: "Offline — will save when you're back", error: "Couldn't save just now", idle: "Signed in" }[s.sync];
  const initial = (s.user?.name || s.user?.email || "?").trim().charAt(0).toUpperCase();

  return (
    <div style={{
      position: "fixed", top: "calc(env(safe-area-inset-top, 0px) + 10px)", left: 0, right: 0, zIndex: 70,
      display: "flex", justifyContent: "center", pointerEvents: "none",
    }}>
      <div style={{ width: "100%", maxWidth: 560, padding: "0 14px", display: "flex", justifyContent: "flex-end", pointerEvents: "none" }}>
        <div ref={box} style={{ position: "relative", pointerEvents: "auto" }}>
          {!s.user ? (
            <button
              onClick={async () => { setBusy(true); await signIn(); setBusy(false); }}
              disabled={busy}
              style={{
                background: MUSTARD, color: BROWN, border: "none", borderRadius: 999, padding: "8px 14px",
                fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 700, fontSize: 12.5,
                boxShadow: "0 2px 0 #A6D1BD", opacity: busy ? 0.7 : 1, cursor: "pointer",
              }}
            >{busy ? "Signing in…" : "Sign in to sync"}</button>
          ) : (
            <button
              onClick={() => setOpen(o => !o)}
              aria-label="Account"
              style={{
                position: "relative", width: 36, height: 36, borderRadius: 999, border: `2px solid ${OAT}`,
                background: MUSTARD, color: BROWN, fontWeight: 700, fontSize: 15, padding: 0, cursor: "pointer",
                fontFamily: "'IBM Plex Sans', system-ui, sans-serif", overflow: "visible",
              }}
            >
              {s.user.photo
                ? <img src={s.user.photo} alt="" referrerPolicy="no-referrer" style={{ width: "100%", height: "100%", borderRadius: 999, display: "block" }} />
                : initial}
              <span style={{ position: "absolute", right: -2, bottom: -2, width: 11, height: 11, borderRadius: 999, background: dot, border: `2px solid ${OAT}` }} />
            </button>
          )}

          {open && s.user && (
            <div style={{
              position: "absolute", right: 0, top: 44, width: 290, background: "#fff", border: `1px solid ${LINE}`, borderRadius: 12,
              boxShadow: "0 8px 24px rgba(74,42,31,.2)", padding: 12, fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
            }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.user.name || s.user.email}</div>
              {s.user.name && <div style={{ fontSize: 11.5, color: "#617B70", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.user.email}</div>}
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, fontSize: 11.5, color: "#617B70" }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: dot, flexShrink: 0 }} /> {label}
              </div>
              {s.household && s.household.members.length > 0 && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${LINE}` }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#617B70", letterSpacing: 0.5, textTransform: "uppercase" }}>Your household</div>
                  <div style={{ fontSize: 12, color: INK, marginTop: 4, lineHeight: 1.45 }}>
                    {s.household.members.map(m => m.name).join(", ")}
                  </div>
                  <div style={{ fontSize: 11, color: "#617B70", marginTop: 8 }}>{isOwner ? "Family need this code and an invite below:" : "Household code:"}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                    <code style={{ flex: 1, background: OAT, border: `1px solid ${LINE}`, borderRadius: 8, padding: "6px 8px", fontSize: 14, fontWeight: 700, letterSpacing: 1, color: BROWN, textAlign: "center" }}>{s.household.id}</code>
                    <button onClick={async () => {
                      const text = `Join my Plan My Meals household. Open ${location.origin}, sign in with Google, then tap your picture → Join a household and enter: ${s.household.id}. Use the Google account I invited.`;
                      try { if (navigator.share) { await navigator.share({ text }); return; } } catch (e) { return; }
                      try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch (e) { setNote("Couldn't copy — select the code and copy it."); }
                    }} style={{ ...btn(false), flex: "none", padding: "7px 10px" }}>{copied ? "Copied" : "Share"}</button>
                  </div>
                </div>
              )}
              {isOwner && s.household && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${LINE}` }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#617B70", letterSpacing: 0.5, textTransform: "uppercase" }}>Who can join</div>
                  <div style={{ fontSize: 11, color: "#617B70", marginTop: 4, lineHeight: 1.4 }}>Only the Google emails you add here can join, and they still need the code. Use the exact email they sign in with.</div>
                  {invites.map(em => (
                    <div key={em} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, fontSize: 12, color: INK }}>
                      <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{em}</span>
                      <button aria-label={"Remove " + em} onClick={async () => { const r = await removeInvite(em); if (r.ok) setInvites(v => v.filter(x => x !== em)); else setNote(r.message || ""); }} style={{ ...link, fontSize: 15, lineHeight: 1, padding: "0 4px" }}>×</button>
                    </div>
                  ))}
                  <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                    <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="family@gmail.com" type="email" inputMode="email" autoCapitalize="off" autoCorrect="off" spellCheck={false}
                      style={{ flex: 1, minWidth: 0, border: `1px solid ${LINE}`, borderRadius: 8, padding: "7px 8px", fontSize: 13 }} />
                    <button onClick={async () => {
                      const r = await addInvite(inviteEmail);
                      if (r.ok) { setInvites(v => [...new Set([...v, r.email])].sort()); setInviteEmail(""); setNote(""); } else setNote(r.message || "");
                    }} style={{ ...btn(false), flex: "none", padding: "7px 12px" }}>Add</button>
                  </div>
                </div>
              )}
              {!joining ? (
                <div style={{ display: "flex", gap: 14, marginTop: 10 }}>
                  <button onClick={() => { setJoining(true); setNote(""); }} style={link}>Join a household</button>
                  {s.household && s.household.members.length > 1 && !isOwner && (
                    <button onClick={async () => {
                      if (!window.confirm("Leave this household? You'll keep a copy of everything on this device in a new, private household.")) return;
                      const r = await leaveHousehold(); if (!r.ok) setNote(r.message || "");
                    }} style={link}>Leave</button>
                  )}
                </div>
              ) : (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 11, color: "#617B70", lineHeight: 1.4 }}>Enter the code from your family. This replaces the plans on this device with the household's.</div>
                  <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                    <input value={code} onChange={e => setCode(e.target.value)} placeholder="ABCD-2345" autoCapitalize="characters" autoCorrect="off" spellCheck={false}
                      style={{ flex: 1, minWidth: 0, border: `1px solid ${LINE}`, borderRadius: 8, padding: "7px 8px", fontSize: 14, letterSpacing: 1, textTransform: "uppercase", fontFamily: "'IBM Plex Mono', monospace" }} />
                    <button onClick={async () => {
                      if (!window.confirm("Join this household? The plans, kitchen and recipes on this device will be replaced by the household's.")) return;
                      setNote("Joining…");
                      const r = await joinHousehold(code);
                      if (r.ok) { setJoining(false); setCode(""); setNote(""); setOpen(false); } else setNote(r.message || "");
                    }} style={{ ...btn(false), flex: "none", padding: "7px 12px" }}>Join</button>
                  </div>
                  <button onClick={() => { setJoining(false); setNote(""); }} style={{ ...link, marginTop: 6 }}>Cancel</button>
                </div>
              )}
              {note && <div style={{ fontSize: 11.5, color: CLAY, marginTop: 8, lineHeight: 1.4 }}>{note}</div>}
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button onClick={() => { pullIfStale(true); setOpen(false); }} style={btn(false)}>Refresh</button>
                <button
                  onClick={async () => { setOpen(false); await signOut(); }}
                  style={btn(true)}
                >Sign out</button>
              </div>
            </div>
          )}

          {s.error && (
            <div style={{
              position: "absolute", right: 0, top: s.user ? 44 : 42, width: 260, background: "#F7E6DC", color: CLAY, border: `1px solid #E8C7B3`,
              borderRadius: 10, padding: "8px 10px", fontSize: 11.5, lineHeight: 1.4, fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
              boxShadow: "0 4px 14px rgba(74,42,31,.15)", display: open ? "none" : "block",
            }}>{s.error}</div>
          )}
        </div>
      </div>
    </div>
  );
}

const link = { background: "transparent", border: "none", padding: 0, color: BROWN, fontWeight: 700, fontSize: 12, textDecoration: "underline", cursor: "pointer", fontFamily: "'IBM Plex Sans', system-ui, sans-serif" };

function btn(primary) {
  return {
    flex: 1, background: primary ? "#fff" : BROWN, color: primary ? BROWN : OAT,
    border: primary ? `1.5px solid ${BROWN}` : "none", borderRadius: 9, padding: "8px 0",
    fontWeight: 700, fontSize: 12.5, cursor: "pointer", fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
  };
}
