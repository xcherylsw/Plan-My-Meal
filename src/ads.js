// Web build. MakanLedger.jsx imports these from here:
//  - initAds / showInterstitialAd: phone-app leftovers, intentionally empty (AdSense has no
//    "interstitial after a tap" format for websites).
//  - AdSlot: one banner-style Google AdSense unit, shown only after AdSense details are
//    entered in site.config.json (which generates /ads-config.js). With nothing entered it renders nothing.
//  - SiteFooter: links to the public pages (About, Guides, Privacy, Contact).
import React, { useEffect } from "react";

export function initAds() {}
export function showInterstitialAd() {}

function cfg() { return (typeof window !== "undefined" && window.PMM_ADS) || {}; }

let scriptAdded = false;
function loadAdsenseScript(publisherId) {
  if (scriptAdded) return;
  scriptAdded = true;
  const s = document.createElement("script");
  s.async = true;
  s.crossOrigin = "anonymous";
  s.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=" + encodeURIComponent(publisherId);
  document.head.appendChild(s);
}

export function AdSlot() {
  const c = cfg();
  const on = !!(c.publisherId && c.appSlot);
  useEffect(() => {
    if (!on) return;
    loadAdsenseScript(c.publisherId);
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) { /* already filled */ }
  }, [on]);
  if (!on) return null;
  // Sits at the very end of the page content, well away from buttons and the
  // tab bar, with a label, so nobody taps it by accident.
  return React.createElement("div", { style: { margin: "40px 18px 8px", textAlign: "center" } },
    React.createElement("div", { style: { fontSize: 10.5, letterSpacing: 1, textTransform: "uppercase", color: "#617B70", marginBottom: 4 } }, "Advertisement"),
    React.createElement("ins", {
      className: "adsbygoogle", style: { display: "block", minHeight: 100 },
      "data-ad-client": c.publisherId, "data-ad-slot": c.appSlot, "data-ad-format": "auto", "data-full-width-responsive": "true",
    }));
}

export function SiteFooter() {
  const a = { color: "#276D57", textDecoration: "underline" };
  return React.createElement("div", { style: { padding: "22px 18px 26px", fontSize: 12, color: "#617B70", textAlign: "center", lineHeight: 1.8 } },
    React.createElement("a", { href: "/about.html", style: a }, "About"), " · ",
    React.createElement("a", { href: "/guides/", style: a }, "Guides"), " · ",
    React.createElement("a", { href: "/privacy.html", style: a }, "Privacy"), " · ",
    React.createElement("a", { href: "/contact.html", style: a }, "Contact"));
}

// Slim bar above the app title: public pages on the left. The sign-in / account
// control floats over its right-hand side (see AccountBar.jsx).
export function SiteBar() {
  const a = { color: "#CDE8DB", textDecoration: "none", fontSize: 12.5, fontWeight: 500 };
  return React.createElement("div", {
    style: { background: "#174D3D", minHeight: 52, display: "flex", alignItems: "center", gap: 14, padding: "0 18px", flexWrap: "wrap",
      fontFamily: "'IBM Plex Sans', system-ui, sans-serif" },
  },
    React.createElement("a", { href: "/about.html", style: a }, "About"),
    React.createElement("a", { href: "/guides/", style: a }, "Guides"),
    React.createElement("a", { href: "/privacy.html", style: a }, "Privacy"),
    React.createElement("a", { href: "/contact.html", style: a }, "Contact"));
}

// Plain, visible introduction at the bottom of the Generate screen: tells
// visitors (and Google's reviewers) what the site is, in real words.
export function SiteIntro() {
  const h = { fontFamily: "'Fraunces', Georgia, serif", fontWeight: 600, fontSize: 17, color: "#174D3D", margin: "0 0 6px" };
  const p = { fontSize: 13, lineHeight: 1.6, color: "#617B70", margin: "0 0 10px" };
  const a = { color: "#276D57", textDecoration: "underline" };
  return React.createElement("section", { style: { margin: "34px 18px 0", paddingTop: 22, borderTop: "1px dashed #D8E5DE", fontFamily: "'IBM Plex Sans', system-ui, sans-serif" } },
    React.createElement("h2", { style: h }, "What is Plan My Meals?"),
    React.createElement("p", { style: p }, "A free meal planner for households that cook at home. It plans the week's breakfasts, lunches and dinners, builds a shopping list that already subtracts what's in your kitchen, and scales every amount to the number of people eating each meal."),
    React.createElement("p", { style: p }, "Halal, vegetarian and soft-food settings adjust the dishes automatically. Sign in with Google to keep your plans on every device and share them with your family, who then see the same plan and shopping list."),
    React.createElement("p", { style: p }, "New to meal planning? Read ",
      React.createElement("a", { href: "/guides/plan-a-week-of-family-meals.html", style: a }, "how to plan a week of family meals"), ", ",
      React.createElement("a", { href: "/guides/cook-from-what-you-have.html", style: a }, "how to cook from what you already have"), " and ",
      React.createElement("a", { href: "/guides/halal-vegetarian-and-soft-food.html", style: a }, "planning for halal, vegetarian and soft-food needs"), "."));
}

// Story-first top of the home page: what it is, how it works, then the app below.
export function SiteHero() {
  const h = React.createElement;
  const steps = [
    ["1", "Say who's eating", "Set the household once: how many people, halal, vegetarian or soft-food needs, and what you don't eat."],
    ["2", "Generate the plan", "A day, a week or a month of breakfasts, lunches and dinners, each scaled to how many are eating that meal."],
    ["3", "Shop only what's missing", "The shopping list subtracts what's already in your kitchen, so nothing gets bought twice."],
  ];
  const css = `
    .pmm-hero{background:#174D3D;color:#F7FAF8;font-family:'IBM Plex Sans',system-ui,sans-serif}
    .pmm-hero a{color:inherit}
    .pmm-hero .in{max-width:880px;margin:0 auto;padding:0 20px}
    .pmm-hero .bar{display:flex;align-items:center;gap:20px;flex-wrap:wrap;min-height:54px;padding-top:6px}
    .pmm-hero .brand{font:700 20px 'Fraunces',Georgia,serif;margin-right:auto}
    .pmm-hero .links{display:flex;gap:16px;font-size:13px;color:#B5D8C7;width:100%;order:3;padding-bottom:6px}
    .pmm-hero .links a{text-decoration:none}.pmm-hero .links a:hover{text-decoration:underline;color:#fff}
    .pmm-hero h1{font:700 clamp(28px,6vw,44px)/1.12 'Fraunces',Georgia,serif;margin:34px 0 12px;max-width:22ch}
    .pmm-hero .sub{font-size:15.5px;line-height:1.6;color:#CDE8DB;max-width:54ch;margin:0 0 22px}
    .pmm-hero .cta{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:34px}
    .pmm-hero .b1{background:#CBEADD;color:#fff;font-weight:700;font-size:14.5px;padding:11px 20px;border-radius:12px;text-decoration:none;box-shadow:0 3px 0 #A6D1BD}
    .pmm-hero .b2{border:1.5px solid rgba(235,217,189,.45);font-size:14.5px;padding:10px 18px;border-radius:12px;text-decoration:none;color:#F7FAF8}
    .pmm-hero .steps{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;padding-bottom:30px}
    .pmm-hero .st{background:rgba(247,238,223,.07);border:1px solid rgba(235,217,189,.18);border-radius:14px;padding:14px 16px}
    .pmm-hero .st b.n{display:inline-flex;width:24px;height:24px;border-radius:50%;background:#CBEADD;color:#fff;font-size:12.5px;align-items:center;justify-content:center;margin-bottom:8px}
    .pmm-hero .st h2{font:600 16px 'Fraunces',Georgia,serif;margin:0 0 4px}
    .pmm-hero .st p{font-size:13px;line-height:1.55;color:#B5D8C7;margin:0}
    .pmm-hero .fine{font-size:13px;line-height:1.6;color:#B5D8C7;padding:0 0 22px;max-width:70ch}
    .pmm-hero .fine h2{font:600 15px 'Fraunces',Georgia,serif;color:#F7FAF8;margin:0 0 4px}
    @media(max-width:700px){.pmm-hero .steps{grid-template-columns:1fr}.pmm-hero h1{margin-top:24px}}
  `;
  return h("header", { className: "pmm-hero" },
    h("style", null, css),
    h("div", { className: "in" },
      h("div", { className: "bar" },
        h("div", { className: "brand" }, "Plan My Meals 🍚"),
        h("nav", { className: "links", "aria-label": "Site" },
          h("a", { href: "/about.html" }, "About"), h("a", { href: "/guides/" }, "Guides"),
          h("a", { href: "/privacy.html" }, "Privacy"), h("a", { href: "/contact.html" }, "Contact"))),
      h("h1", null, "What's for dinner? Sorted for the week."),
      h("p", { className: "sub" }, "A free meal planner for households that cook at home. It plans breakfast, lunch and dinner, scales every amount to who's actually eating, and builds a shopping list that already knows what's in your kitchen."),
      h("div", { className: "cta" },
        h("a", { className: "b1", href: "#app" }, "Start planning ↓"),
        h("a", { className: "b2", href: "/guides/plan-a-week-of-family-meals.html" }, "How to plan a week")),
      h("div", { className: "steps" }, steps.map(([n, t, d]) =>
        h("div", { className: "st", key: n }, h("b", { className: "n" }, n), h("h2", null, t), h("p", null, d)))),
      h("div", { className: "fine" },
        h("h2", null, "What is Plan My Meals?"),
        "Halal, vegetarian and soft-food settings adjust the dishes automatically. Sign in with Google to keep your plans on every device and share them with your family, who then see the same plan and shopping list. No download needed; it works in any phone or laptop browser.")));
}
