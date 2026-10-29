import React, { useEffect, useRef, useState } from "react";
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

createRoot(document.getElementById("root")).render(<Root />);\nwindow.dispatchEvent(new Event("pmm:booted"));
