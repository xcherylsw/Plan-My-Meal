import React, { useEffect, useRef, useState } from "react";
import { useLanguage } from "./interfaceLanguage.js";
import { signIn, signOut, subscribe, getSnapshot, pullIfStale, joinHousehold, leaveHousehold, listInvites, addInvite, removeInvite, requestHouseholdAccess, getHouseholdRequestStatus, watchHouseholdRequests, reviewHouseholdRequest } from "./cloud.js";

// Small floating account control, pinned inside the app's centred column so
// it sits over the header's right-hand side on phone and laptop alike.
const INK = "#303241", BROWN = "#303241", OAT = "#F7F7FB", MUSTARD = "#EAA28F", LINE = "#E5E3EE", CLAY = "#A44B36";

export default function AccountBar() {
  const { t } = useLanguage();
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
  const [requests, setRequests] = useState([]);
  const [requestStatus, setRequestStatus] = useState(null);
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

  useEffect(() => {
    if (!isOwner) { setRequests([]); return; }
    return watchHouseholdRequests(setRequests);
  }, [isOwner, s.household?.id]);
  useEffect(() => {
    if (joining && code.trim().length >= 8) getHouseholdRequestStatus(code).then(setRequestStatus);
    else setRequestStatus(null);
  }, [joining, code, open]);

  if (!s.configured) return null;

  const backedUp = !!(s.user && s.household && s.sync === "saved");
  const dot = !s.user || !s.household ? "#D89B75" : { saving: MUSTARD, saved: "#4E9B72", offline: "#9A9184", error: "#D36C56", idle: "#D89B75" }[s.sync] || "#D89B75";
  const label = !s.user ? t("signin") : !s.household ? t("connecting") : t(({saving:"saving",saved:"backup",offline:"offline",error:"error",idle:"checking"})[s.sync] || "checking");
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
            >{busy ? t("signing") : t("signin")}</button>
          ) : (
            <button
              onClick={() => setOpen(o => !o)}
              aria-label={t("account")}
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
              {requests.length > 0 && <span aria-label={`${requests.length} pending household requests`} style={{position:"absolute",top:-7,right:-9,minWidth:17,height:17,padding:"0 3px",borderRadius:12,background:"#C6573E",color:"white",fontSize:10,fontWeight:800,lineHeight:"17px",border:"2px solid white"}}>{requests.length}</span>}
            </button>
          )}

          {open && s.user && (
            <div style={{
              position: "absolute", right: 0, top: 44, width: 290, background: "#fff", border: `1px solid ${LINE}`, borderRadius: 12,
              boxShadow: "0 8px 24px rgba(74,42,31,.2)", padding: 12, fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
            }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.user.name || s.user.email}</div>
              {s.user.name && <div style={{ fontSize: 11.5, color: "#666A73", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.user.email}</div>}
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, fontSize: 11.5, color: "#666A73" }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: dot, flexShrink: 0 }} /> {label}
              </div>
              <div style={{fontSize:11.5,color:"#666A73",lineHeight:1.5,marginTop:8,padding:"9px 10px",background:backedUp?"#EEF7F0":"#FFF5EC",borderRadius:9}}>
                {backedUp ? t("restore") : t("warning")}
              </div>
              {s.household && s.household.members.length > 0 && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${LINE}` }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#666A73", letterSpacing: 0.5, textTransform: "uppercase" }}>{t("accountHousehold")}</div>
                  <div style={{ fontSize: 12, color: INK, marginTop: 4, lineHeight: 1.45 }}>
                    {s.household.members.map(m => m.name).join(", ")}
                  </div>
                  <div style={{ fontSize: 11, color: "#666A73", marginTop: 8 }}>{isOwner ? t("accountFamilyCodeHelp") : t("accountCodeLabel")}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                    <code style={{ flex: 1, background: OAT, border: `1px solid ${LINE}`, borderRadius: 8, padding: "6px 8px", fontSize: 14, fontWeight: 700, letterSpacing: 1, color: BROWN, textAlign: "center" }}>{s.household.id}</code>
                    <button onClick={async () => {
                      const text = t("accountShareMessage").replace("{url}", location.origin).replace("{code}", s.household.id);
                      try { if (navigator.share) { await navigator.share({ text }); return; } } catch (e) { return; }
                      try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch (e) { setNote(t("accountCopyError")); }
                    }} style={{ ...btn(false), flex: "none", padding: "7px 10px" }}>{copied ? t("accountCopied") : t("accountShare")}</button>
                  </div>
                </div>
              )}
              {isOwner && s.household && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${LINE}` }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#666A73", letterSpacing: 0.5, textTransform: "uppercase" }}>{t("accountWhoCanJoin")}</div>
                  <div style={{ fontSize: 11, color: "#666A73", marginTop: 4, lineHeight: 1.4 }}>{t("accountInviteHelp")}</div>
                  {invites.map(em => (
                    <div key={em} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, fontSize: 12, color: INK }}>
                      <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{em}</span>
                      <button aria-label={t("accountRemoveInvite") + " " + em} onClick={async () => { const r = await removeInvite(em); if (r.ok) setInvites(v => v.filter(x => x !== em)); else setNote(r.message || ""); }} style={{ ...link, fontSize: 15, lineHeight: 1, padding: "0 4px" }}>×</button>
                    </div>
                  ))}
                  <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                    <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="family@gmail.com" type="email" inputMode="email" autoCapitalize="off" autoCorrect="off" spellCheck={false}
                      style={{ flex: 1, minWidth: 0, border: `1px solid ${LINE}`, borderRadius: 8, padding: "7px 8px", fontSize: 13 }} />
                    <button onClick={async () => {
                      const r = await addInvite(inviteEmail);
                      if (r.ok) { setInvites(v => [...new Set([...v, r.email])].sort()); setInviteEmail(""); setNote(""); } else setNote(r.message || "");
                    }} style={{ ...btn(false), flex: "none", padding: "7px 12px" }}>{t("accountAdd")}</button>
                  </div>
                </div>
              )}
              {isOwner && requests.length > 0 && <div style={{marginTop:12,padding:"10px",background:"#FFF5EC",borderRadius:9,border:"1px solid #F0D8C9"}}>
                <div style={{fontSize:12,fontWeight:800,color:INK,marginBottom:6}}>{t("requestPendingTitle")} ({requests.length})</div>
                {requests.map(req=><div key={req.id} style={{padding:"8px 0",borderTop:"1px solid #E8D7CD"}}>
                  <div style={{fontWeight:700,fontSize:12,overflowWrap:"anywhere"}}>{req.name || req.email}</div>
                  <div style={{fontSize:11,color:"#666A73",overflowWrap:"anywhere"}}>{req.email}</div>
                  <div style={{display:"flex",gap:8,marginTop:7}}>
                    <button style={btn(false)} onClick={async()=>{const r=await reviewHouseholdRequest(req.id,"approved");setNote(r.ok?t("requestApprovedNote"):r.message);}}>{t("requestApprove")}</button>
                    <button style={btn(true)} onClick={async()=>{const r=await reviewHouseholdRequest(req.id,"declined");setNote(r.ok?t("requestDeclinedNote"):r.message);}}>{t("requestDecline")}</button>
                  </div>
                </div>)}
              </div>}
              {!joining ? (
                <div style={{ display: "flex", gap: 14, marginTop: 10 }}>
                  <button onClick={() => { setJoining(true); setNote(""); }} style={link}>{t("accountJoinHousehold")}</button>
                  {s.household && s.household.members.length > 1 && !isOwner && (
                    <button onClick={async () => {
                      if (!window.confirm(t("accountLeaveConfirm"))) return;
                      const r = await leaveHousehold(); if (!r.ok) setNote(r.message || "");
                    }} style={link}>{t("accountLeave")}</button>
                  )}
                </div>
              ) : (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 11, color: "#666A73", lineHeight: 1.4 }}>{t("accountJoinHelp")}</div>
                  <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                    <input value={code} onChange={e => setCode(e.target.value)} placeholder="ABCD-2345" autoCapitalize="characters" autoCorrect="off" spellCheck={false}
                      style={{ flex: 1, minWidth: 0, border: `1px solid ${LINE}`, borderRadius: 8, padding: "7px 8px", fontSize: 14, letterSpacing: 1, textTransform: "uppercase", fontFamily: "'IBM Plex Mono', monospace" }} />
                    <button onClick={async () => {
                      if (!window.confirm(t("accountJoinConfirm"))) return;
                      setNote(t("accountJoining"));
                      const r = await joinHousehold(code);
                      if (r.ok) { setJoining(false); setCode(""); setNote(""); setOpen(false); } else setNote(r.message || "");
                    }} style={{ ...btn(false), flex: "none", padding: "7px 12px" }}>{t("accountJoin")}</button>
                  </div>
                  <div style={{display:"flex",gap:8,marginTop:8,alignItems:"center"}}>
                    <button onClick={async()=>{setBusy(true);const r=await requestHouseholdAccess(code);setBusy(false);setRequestStatus(r.status||null);setNote(r.ok?(r.status==="approved"?t("requestAlreadyApproved"):t("requestSent")):r.message);}} disabled={busy || code.trim().length<8} style={{...btn(true),opacity:busy?0.6:1}}>{t("requestAccess")}</button>
                  </div>
                  {requestStatus && <div style={{fontSize:11,color:"#49745C",marginTop:5}}>{requestStatus==="approved"?t("requestAlreadyApproved"):requestStatus==="pending"?t("requestAwaiting"):t("requestDeclinedNote")}</div>}
                  <button onClick={() => { setJoining(false); setNote(""); }} style={{ ...link, marginTop: 6 }}>{t("accountCancel")}</button>
                </div>
              )}
              {note && <div style={{ fontSize: 11.5, color: CLAY, marginTop: 8, lineHeight: 1.4 }}>{note}</div>}
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button onClick={() => { pullIfStale(true); setOpen(false); }} style={btn(false)}>{t("refresh")}</button>
                <button
                  onClick={async () => { setOpen(false); await signOut(); }}
                  style={btn(true)}
                >{t("signout")}</button>
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
