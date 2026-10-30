import React from "react";

/** Tiny original vector illustrations. No remote image URLs or user tracking. */
export default function FoodArt({ kind = "meal", name = "", size = 112 }) {
  const n = String(name ?? "").toLowerCase();
  const type = kind === "meal" ? (/fish|salmon/.test(n) ? "fish" : /beans|vegetable|broccoli|spinach|peas|corn/.test(n) ? "veg" : /chicken|ayam|katsu/.test(n) ? "chicken" : /egg|omelette/.test(n) ? "egg" : /noodle|mee|laksa|ramen|udon|pasta/.test(n) ? "noodle" : /soup|porridge|congee/.test(n) ? "soup" : "rice") : kind;
  const bg = type === "fridge" ? "#E9E7FB" : type === "shop" ? "#FCE9E5" : type === "prep" ? "#E7F3F6" : "#FBEDE9";
  return <svg viewBox="0 0 160 160" width={size} height={size} role="img" aria-label={type === "meal" ? "Illustrated meal bowl" : "Cute " + type + " illustration"} style={{ flexShrink: 0, maxWidth: "100%", height: "auto" }}>
    <rect width="160" height="160" rx="32" fill={bg}/>
    <circle cx="128" cy="31" r="12" fill="#F8C9B9" opacity=".65"/><path d="M22 29l4 7 8 3-8 3-4 7-4-7-8-3 8-3z" fill="#EE9A82"/>
    {type === "fridge" ? <g stroke="#303241" strokeWidth="3" strokeLinejoin="round"><rect x="47" y="25" width="67" height="115" rx="12" fill="#F9F8FF"/><path d="M47 79h67" fill="none"/><path d="M59 48v19M59 92v17" strokeWidth="5" strokeLinecap="round"/><circle cx="76" cy="55" r="3" fill="#303241" stroke="none"/><circle cx="94" cy="55" r="3" fill="#303241" stroke="none"/><path d="M78 66q8 9 16 0" fill="none" strokeLinecap="round"/></g> :
    type === "shop" ? <g stroke="#303241" strokeWidth="3" strokeLinejoin="round"><path d="M42 61h76l-9 72H51z" fill="#F7C9BC"/><path d="M60 64V51q0-21 20-21t20 21v13" fill="none"/><path d="M69 93q11 14 22 0" fill="none" strokeLinecap="round"/><circle cx="67" cy="82" r="3" fill="#303241" stroke="none"/><circle cx="94" cy="82" r="3" fill="#303241" stroke="none"/><path d="M115 35q10-14 18 0-9 15-18 0z" fill="#F5A786"/></g> :
    type === "prep" ? <g stroke="#303241" strokeWidth="3" strokeLinejoin="round"><rect x="42" y="30" width="80" height="108" rx="12" fill="#FFFFFF"/><rect x="65" y="24" width="35" height="13" rx="5" fill="#B8B4DF"/>{[59,86,113].map((y,i)=><g key={y}><rect x="54" y={y-9} width="15" height="15" rx="4" fill={i===0?"#EAA28F":"#F4F2F9"}/>{i===0&&<path d="M57 58l4 4 7-9" fill="none" stroke="#fff" strokeWidth="2"/>}<path d={`M79 ${y}h30`} stroke="#B8B4DF" strokeLinecap="round"/></g>)}</g> :
    <g><ellipse cx="80" cy="124" rx="52" ry="12" fill="#303241" opacity=".09"/><path d="M31 82q0 53 49 53t49-53z" fill="#EAA28F" stroke="#303241" strokeWidth="3"/><ellipse cx="80" cy="82" rx="49" ry="23" fill="#FFFDF9" stroke="#303241" strokeWidth="3"/>
    {type === "fish" ? <g><path d="M45 82q27-25 56 0-29 25-56 0z" fill="#9FC8D1"/><path d="M101 82l15-13v26z" fill="#84B3BE"/><circle cx="59" cy="80" r="3" fill="#303241"/></g> :
    type === "veg" ? <g><circle cx="63" cy="79" r="17" fill="#83B7A3"/><circle cx="88" cy="75" r="19" fill="#A9D3A8"/><path d="M77 100V65" stroke="#558B6F" strokeWidth="4"/></g> :
    type === "chicken" ? <g><ellipse cx="77" cy="80" rx="35" ry="19" fill="#E7AD79"/><path d="M96 75l19-10" stroke="#FFF7E6" strokeWidth="9" strokeLinecap="round"/></g> :
    type === "egg" ? <g><ellipse cx="80" cy="82" rx="37" ry="19" fill="#FFF9F1"/><circle cx="80" cy="82" r="13" fill="#F3BF63"/></g> :
    type === "noodle" ? <g stroke="#E8AE65" strokeWidth="4" fill="none" strokeLinecap="round"><path d="M48 76q15-20 30 0t35 0M47 87q18-16 33 0t34-2M56 67q17-12 31 0t21 0"/></g> :
    type === "soup" ? <g><ellipse cx="80" cy="82" rx="39" ry="16" fill="#F1C88E"/><circle cx="62" cy="79" r="9" fill="#F9E7C4"/><circle cx="97" cy="84" r="9" fill="#ECA28B"/></g> :
    <g><ellipse cx="80" cy="82" rx="39" ry="16" fill="#FFF4DD"/><ellipse cx="69" cy="79" rx="17" ry="12" fill="#F4B6A0"/><circle cx="71" cy="78" r="8" fill="#F7CE72"/><path d="M90 76q8-20 20-8-1 15-20 8zM88 88q12-12 23 0-12 10-23 0z" fill="#83B7A3"/></g>}
    <circle cx="68" cy="108" r="3" fill="#303241"/><circle cx="91" cy="108" r="3" fill="#303241"/><path d="M73 117q7 8 14 0" stroke="#303241" strokeWidth="2.5" strokeLinecap="round" fill="none"/><circle cx="57" cy="116" r="5" fill="#F7C4B8"/><circle cx="102" cy="116" r="5" fill="#F7C4B8"/></g>}
  </svg>;
}
