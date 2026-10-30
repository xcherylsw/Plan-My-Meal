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
    </>
  );
}

createRoot(document.getElementById("root")).render(<StartupErrorBoundary><Root /></StartupErrorBoundary>);
