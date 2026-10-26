import React, { useState } from "react";
import { CalendarDays, ShoppingBasket, ClipboardCheck, ChevronRight, ArrowLeft, ArrowRight, Check, X, RefreshCw, Trash2, BookOpen } from "lucide-react";

const ui = {
  card: { background: "#fff", border: "1px solid #E2E8E5", borderRadius: 18, padding: 18 },
  button: { border: "1px solid #D5E2DC", borderRadius: 12, background: "#fff", padding: "10px 13px", color: "#23473D", fontWeight: 600, cursor: "pointer" },
};
const dateLabel = (date) => {
  if (!date) return "Planned meal";
  const [y,m,d] = date.split("-").map(Number);
  return new Date(y,m-1,d).toLocaleDateString("en-SG", { weekday: "long", day: "numeric", month: "short" });
};
export default function SimpleWeek({ plan, skippedDays, onSkip, onSwap, onRemove, onMove, onAdd, pickableMeals, onGenerate, shopping, prepList, prepChecked, onPrepChecked, onOpenKitchen, onMarkCooked, pax }) {
  const [view, setView] = useState("meals");
  const [recipe, setRecipe] = useState(null);
  const [step, setStep] = useState(null);
  const [swapUid, setSwapUid] = useState(null);
  const [adding, setAdding] = useState(null);
  const [moveUid, setMoveUid] = useState(null);
  const [query, setQuery] = useState("");
  const dates = [...new Set(plan.map(m => m.date).filter(Boolean))].sort();
  const activeMeals = plan.filter(m => !m.date || !skippedDays.includes(m.date));
  const recipeOptions = (pickableMeals || []).filter(m => !query || m.name.toLowerCase().includes(query.toLowerCase())).slice(0,80);
  const openRecipe = (meal) => { setRecipe(meal); setStep(null); };
  const actionStyle = { ...ui.button, fontSize: 12, padding: "8px 10px" };
  return <main style={{ maxWidth: 760, margin: "0 auto", padding: "26px 18px 90px", color: "#173A32", fontFamily: "system-ui, sans-serif" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 10 }}>
      <div><div style={{ color: "#5D8176", fontSize: 12, fontWeight: 700, letterSpacing: 1.5 }}>YOUR WEEK, SORTED</div>
      <h2 style={{ fontSize: 30, letterSpacing: -1, margin: "7px 0 8px" }}>Dinner, without the decisions.</h2>
      <p style={{ color: "#668078", margin: 0, lineHeight: 1.5 }}>Change anything. Your shopping and prep follow along.</p></div>
    </div>
    <div role="tablist" aria-label="Plan results" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 7, background: "#E9F1ED", borderRadius: 14, padding: 5, margin: "22px 0" }}>
      {[["meals", "Meals"], ["shopping", "Shopping"], ["prep", "Prep"]].map(([key,label]) =>
        <button key={key} role="tab" aria-selected={view === key} onClick={() => setView(key)}
          style={{ border: "none", borderRadius: 10, padding: "12px 4px", background: view === key ? "#fff" : "transparent", color: "#17493B", fontWeight: view === key ? 750 : 500, boxShadow: view === key ? "0 2px 8px #18453715" : "none" }}>{label}</button>)}
    </div>
    {view === "meals" && <>
      {!dates.length && <section style={{ ...ui.card, textAlign: "center", padding: 28 }}><CalendarDays size={30} color="#3E8068" />
        <h3>Nothing planned yet</h3><p style={{ color: "#668078" }}>Get seven dinners in one tap. You can swap any dish afterwards.</p>
        <button style={{ ...ui.button, background: "#176A51", color: "#fff" }} onClick={onGenerate}>Plan my week</button></section>}
      <div style={{ display: "grid", gap: 13 }}>
        {dates.map(date => {
          const meals = plan.filter(m => m.date === date && m.mealType === "dinner");
          const other = plan.filter(m => m.date === date && m.mealType !== "dinner");
          const skipped = skippedDays.includes(date);
          return <section key={date} style={{ ...ui.card, opacity: skipped ? .65 : 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <strong style={{ fontSize: 16 }}>{dateLabel(date)}</strong>
              <button style={actionStyle} onClick={() => onSkip(date)}>{skipped ? "Restore day" : "Skip day"}</button>
            </div>
            {meals.length === 0 && <button style={ui.button} onClick={() => { setAdding(date); setQuery(""); }}>+ Add dinner</button>}
            {meals.map((meal,i) => <div key={meal.uid || i} style={{ borderTop: i ? "1px solid #EDF1EF" : "none", paddingTop: i ? 12 : 0, marginTop: i ? 12 : 0 }}>
              <button onClick={() => openRecipe(meal)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, background: "none", border: 0, padding: "0 0 7px", width: "100%", textAlign: "left", color: "#173A32", cursor: "pointer" }}>
                <span><strong style={{ fontSize: 17 }}>{meal.name}</strong><span style={{ display: "block", color: "#779087", fontSize: 12, marginTop: 4 }}>{meal.cuisine || "Family favourite"} · {meal.time || "—"} min · {meal.pax || pax || 2} servings</span></span><ChevronRight size={19}/></button>
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                <button style={actionStyle} onClick={() => { setSwapUid(meal.uid); setQuery(""); }}><RefreshCw size={13}/> Swap</button>
                <button style={actionStyle} onClick={() => setMoveUid(meal.uid)}>Move</button>
                <button style={actionStyle} onClick={() => onMarkCooked(meal.uid)}>{meal.cooked ? "Cooked ✓" : "Mark cooked"}</button>
                <button aria-label={"Remove " + meal.name} style={actionStyle} onClick={() => onRemove(meal.uid)}><Trash2 size={13}/></button>
              </div>
            </div>)}
            {other.length > 0 && <p style={{ color: "#779087", fontSize: 12, marginBottom: 0 }}>Also planned: {other.map(m => m.name).join(", ")}</p>}
          </section>;
        })}
      </div>
      {dates.length > 0 && <button style={{ ...ui.button, width: "100%", marginTop: 16 }} onClick={onGenerate}>↻ Make a fresh seven-day dinner plan</button>}
    </>}
    {view === "shopping" && <section style={ui.card}><ShoppingBasket color="#23775C"/><h3>Shopping, already consolidated</h3>
      <p style={{ color: "#668078", lineHeight: 1.6 }}>Your existing shopping list deducts kitchen stock, keeps quantities and tracks purchases.</p>
      {shopping}
      <button style={{ ...ui.button, marginTop: 14 }} onClick={onOpenKitchen}>Update what I already have</button>
    </section>}
    {view === "prep" && <section style={ui.card}><ClipboardCheck color="#23775C"/><h3>A little prep goes a long way</h3>
      <p style={{ color: "#668078", lineHeight: 1.6 }}>Only prep what you can safely store. Refrigerate perishables promptly; freeze items that won't be used soon.</p>
      {!prepList.length && <p>No prep tasks for your current plan.</p>}
      <div style={{ display: "grid", gap: 12 }}>{prepList.map((task,i) => <label key={task.key || i} style={{ display: "flex", alignItems: "start", gap: 12, borderTop: "1px solid #E9EFEB", paddingTop: 12, opacity: task.ready === false ? .6 : 1 }}>
        <input type="checkbox" checked={!!prepChecked[task.key]} onChange={() => onPrepChecked(task.key, task.ready, task.label)} />
        <span><strong>{task.label}</strong>{task.hint && <span style={{ display: "block", fontSize: 12, color: "#6B8279", marginTop: 4 }}>{task.hint}</span>}</span></label>)}</div>
    </section>}
    {(swapUid || adding || moveUid) && <div role="dialog" aria-modal="true" aria-label="Edit meal" style={{ position: "fixed", inset: 0, zIndex: 50, background: "#102F2BCC", display: "grid", placeItems: "center", padding: 16 }}>
      <div style={{ ...ui.card, width: "100%", maxWidth: 520, maxHeight: "85vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><h3 style={{ margin: "0 0 12px" }}>{moveUid ? "Move to another day" : swapUid ? "Swap this dish" : "Add dinner"}</h3><button style={actionStyle} onClick={() => { setSwapUid(null); setAdding(null); setMoveUid(null); }}>Close</button></div>
        {moveUid ? <div style={{ display: "grid", gap: 8 }}>{dates.map(date => <button key={date} style={ui.button} onClick={() => { onMove(moveUid,date); setMoveUid(null); }}>{dateLabel(date)}</button>)}</div> : <>
          <input aria-label="Search recipes" placeholder="Find a recipe…" value={query} onChange={e => setQuery(e.target.value)} style={{ width: "100%", padding: 13, border: "1px solid #CADDD4", borderRadius: 10, marginBottom: 12 }} />
          <div style={{ display: "grid", gap: 8 }}>{recipeOptions.map(m => <button key={m.id} style={{ ...ui.button, textAlign: "left" }} onClick={() => { if (swapUid) onSwap(swapUid,m.id); else onAdd(adding,"dinner",m.id); setSwapUid(null); setAdding(null); }}>{m.name} <span style={{ float: "right", color: "#79958A" }}>{m.time}m</span></button>)}</div>
        </>}
      </div></div>}
    {recipe && <div role="dialog" aria-modal="true" aria-label={recipe.name} style={{ position: "fixed", inset: 0, zIndex: 60, background: "#102F2BCC", display: "grid", placeItems: "center", padding: 14 }}>
      <article style={{ ...ui.card, width: "100%", maxWidth: 550, maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 12 }}><div><span style={{ color: "#46816C", fontSize: 12 }}>{recipe.cuisine} · {recipe.time} min</span><h2 style={{ margin: "5px 0 15px" }}>{recipe.name}</h2></div><button aria-label="Close recipe" style={actionStyle} onClick={() => setRecipe(null)}><X size={18}/></button></div>
        {step === null ? <>
          <h3>What you'll need</h3><ul style={{ lineHeight: 1.9, paddingLeft: 22 }}>{(recipe.ingredients || []).map((i,n) => <li key={n}>{i.amount == null ? "" : Math.round(i.amount * ((recipe.pax || pax || recipe.baseServings || 1)/(recipe.baseServings || 1))*10)/10 + " " + (i.unit || "") + " "}{i.name}</li>)}</ul>
          <h3>How to make it</h3><ol style={{ lineHeight: 1.8, paddingLeft: 22 }}>{(recipe.steps || []).map((s,n) => <li key={n}>{s}</li>)}</ol>
          <button style={{ ...ui.button, width: "100%", background: "#176A51", color: "white" }} onClick={() => setStep(0)}>Start cooking mode</button>
        </> : <>
          <div style={{ color: "#46816C", fontWeight: 700 }}>STEP {step + 1} OF {(recipe.steps || []).length}</div>
          <p style={{ fontSize: 21, lineHeight: 1.6, minHeight: 130 }}>{(recipe.steps || [])[step]}</p>
          <div style={{ display: "flex", gap: 10 }}><button style={{ ...ui.button, flex: 1 }} onClick={() => setStep(step === 0 ? null : step - 1)}><ArrowLeft size={15}/> Back</button>
          <button style={{ ...ui.button, flex: 1, background: "#176A51", color: "white" }} onClick={() => step + 1 >= (recipe.steps || []).length ? setStep(null) : setStep(step + 1)}>{step + 1 >= (recipe.steps || []).length ? "Finish" : "Next"} <ArrowRight size={15}/></button></div>
        </>}
      </article></div>}
  </main>;
}
