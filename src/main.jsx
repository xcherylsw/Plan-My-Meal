import React, { useEffect, useRef, useState } from "react";

class StartupErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error("Meal planner render failure", error, info); }
  render() {
    if (!this.state.error) return this.props.children;
    return <div style={{minHeight:"100vh",padding:"32px 22px",boxSizing:"border-box",fontFamily:"system-ui,sans-serif",background:"#F7EEDF",color:"#303241"}}>
      <h2>Today Cook What could not open</h2>
      <p>Something went wrong while showing the meal planner. Your saved recipes and plans have not been cleared.</p>
      <p style={{fontSize:12,overflowWrap:"anywhere",background:"#fff",padding:14,borderRadius:8}}>Error: {String(this.state.error?.message || this.state.error)}</p>
      <p style={{fontSize:12}}>Please screenshot this message so we can fix the cause. Do not clear site data.</p>
    </div>;
  }
}

import { createRoot } from "react-dom/client";
import MakanLedger from "./MakanLedger.jsx";
import AccountBar from "./AccountBar.jsx";
import { translate, useLanguage } from "./interfaceLanguage.js";
import { installStorage, initCloud, subscribe, getSnapshot, acknowledgeRemote } from "./cloud.js";

// window.storage must exist before the app first renders.
installStorage();
initCloud();

// Another family member's change has already been written to this device's
// storage; the app only reads storage when it starts, so it gets restarted to
// show it — but never mid-typing: wait until nobody is in a text field and
// there's been a quiet moment.
function useQuietRestart(pendingRemote) {
  const lastTouch = useRef(Date.now());
  useEffect(() => {
    const t = () => { lastTouch.current = Date.now(); };
    window.addEventListener("pointerdown", t, true);
    window.addEventListener("keydown", t, true);
    return () => { window.removeEventListener("pointerdown", t, true); window.removeEventListener("keydown", t, true); };
  }, []);
  useEffect(() => {
    if (!pendingRemote) return;
    const id = setInterval(() => {
      const el = document.activeElement;
      const typing = el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT");
      if (typing || Date.now() - lastTouch.current < 2500) return;
      clearInterval(id);
      const y = window.scrollY;
      acknowledgeRemote();
      requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, y)));
    }, 500);
    return () => clearInterval(id);
  }, [pendingRemote]);
}

function UpdateNotice() {
  const { language } = useLanguage();
  const [available, setAvailable] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    let live = true;
    const check = async () => {
      if (document.visibilityState === "hidden") return;
      try {
        const response = await fetch("/version.json", { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json();
        if (live && data.version && data.version !== __APP_BUILD_ID__) setAvailable(true);
      } catch { /* Offline: retry when the connection returns. */ }
    };
    const interval = setInterval(check, 5 * 60 * 1000);
    const onVisible = () => { if (document.visibilityState === "visible") check(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", check);
    check();
    return () => {
      live = false;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", check);
    };
  }, []);
  if (!available || dismissed) return null;
  return <div role="status" style={{position:"fixed",bottom:16,left:"50%",transform:"translateX(-50%)",zIndex:9999,width:"min(440px,calc(100% - 28px))",boxSizing:"border-box",padding:"12px 14px",borderRadius:14,background:"#fff",color:"#303241",boxShadow:"0 8px 32px #0003",display:"flex",alignItems:"center",gap:10,fontFamily:"system-ui,sans-serif",fontSize:13}}>
    <span style={{flex:1}}>{translate("updateReady",language)}</span>
    <button type="button" onClick={()=>window.location.reload()} style={{border:0,borderRadius:9,background:"#365C4B",color:"#fff",padding:"9px 11px",fontWeight:700,cursor:"pointer"}}>{translate("updateNow",language)}</button>
    <button type="button" aria-label={translate("updateLater",language)} onClick={()=>setDismissed(true)} style={{border:0,background:"transparent",color:"#555",fontSize:20,cursor:"pointer"}}>×</button>
  </div>;
}

function Root() {
  const [s, setS] = useState(getSnapshot());
  useEffect(() => subscribe(setS), []);
  useQuietRestart(s.pendingRemote);
  if (!s.ready) return <div className="boot">Loading your meals…</div>;
  return (
    <>
      {/* key = epoch: when saved data from the cloud replaces what the app
          loaded (or someone signs out), the app restarts and re-reads storage. */}
      <MakanLedger key={s.epoch} />
      <AccountBar />
      <UpdateNotice />
    </>
  );
}

createRoot(document.getElementById("root")).render(<StartupErrorBoundary><Root /></StartupErrorBoundary>);
