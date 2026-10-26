import React, { useState } from "react";
import FoodArt from "./FoodArt.jsx";
import { CalendarDays, ShoppingBasket, ClipboardCheck, ChevronRight, ArrowLeft, ArrowRight, Check, X, RefreshCw, Trash2, BookOpen } from "lucide-react";

const ui = {
  card: { background: "#fff", border: "1px solid #E5E3EE", borderRadius: 18, padding: 18 },
  button: { border: "1px solid #E5E3EE", borderRadius: 12, background: "#fff", padding: "10px 13px", color: "#303241", fontWeight: 600, cursor: "pointer" },
};
const dateLabel = (date) => {
  if (!date) return "Planned meal";
  const [y,m,d] = date.split("-").map(Number);
  return new Date(y,m-1,d).toLocaleDateString("en-SG", { weekday: "long", day: "numeric", month: "short" });
};
export default function SimpleWeek({ plan, skippedDays, onSkip, onSwap, onRemove, onMove, onAdd, pickableMeals, onGenerate, shopping, prepList, prepChecked, onPrepChecked, onOpenKitchen, onMarkCooked, pax }) {
  const view = "meals";
  const [recipe, setRecipe] = useState(null);
  const [showAllMeals, setShowAllMeals] = useState(false);
  const [step, setStep] = useState(null);
  const [swapUid, setSwapUid] = useState(null);
  const [adding, setAdding] = useState(null);
  const [moveUid, setMoveUid] = useState(null);
  const [query, setQuery] = useState("");
  const now = new Date();
  const dateKey = d => [d.getFullYear(), String(d.getMonth()+1).padStart(2,"0"), String(d.getDate()).padStart(2,"0")].join("-");
  const dates = Array.from({length:7},(_,i)=>dateKey(new Date(now.getFullYear(),now.getMonth(),now.getDate()+i)));
  const hasCurrentPlan = plan.some(m => dates.includes(m.date) && m.mealType === "dinner");
  const activeMeals = plan.filter(m => !m.date || !skippedDays.includes(m.date));
  const recipeOptions = (pickableMeals || []).filter(m => !query || m.name.toLowerCase().includes(query.toLowerCase())).slice(0,80);
  const openRecipe = (meal) => { setRecipe(meal); setStep(null); };
  const actionStyle = { ...ui.button, fontSize: 12, padding: "8px 10px" };
  return <main style={{ maxWidth: 760, margin: "0 auto", padding: "26px 18px 90px", color: "#303241", fontFamily: "system-ui, sans-serif" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, background: "#F1EFFB", borderRadius: 22, padding: 16 }}>
      <div><div style={{ color: "#67677E", fontSize: 12, fontWeight: 700, letterSpacing: 1.5 }}>SEVEN DAYS AT A GLANCE</div>
      <h2 style={{ fontSize: 30, letterSpacing: -1, margin: "7px 0 8px" }}>Your week, sorted.</h2>
      <p style={{ color: "#67677E", margin: 0, lineHeight: 1.5 }}>Tap a dish to cook, swap or move it.</p></div><FoodArt kind="meal" size={110}/>
    </div>
    {view === "meals" && <>
      <div style={{ display: "flex", gap: 8, margin: "17px 0", padding: 5, background: "#F1EFFB", borderRadius: 15 }} role="group" aria-label="Meals shown">
        {[[false,"Dinner plan"],[true,"All meals"]].map(([all,label]) => <button key={label} aria-pressed={showAllMeals===all} onClick={()=>setShowAllMeals(all)} style={{ flex:1, padding:"12px 8px", border:0, borderRadius:12, background:showAllMeals===all?"#fff":"transparent", boxShadow:showAllMeals===all?"0 2px 8px #30324112":"none", color:"#303241", fontWeight:showAllMeals===all?800:600 }}>{label}</button>)}
      </div>
      {!showAllMeals && <p style={{fontSize:13,color:"#67677E",margin:"0 0 13px"}}>Showing dinners only. Switch to All meals to see breakfast and lunch from your saved plan.</p>}
      {!hasCurrentPlan && <section style={{ ...ui.card, textAlign: "center", padding: 28 }}><CalendarDays size={30} color="#D98976" />
        <h3>Nothing planned yet</h3><p style={{ color: "#67677E" }}>Get seven dinners in one tap. You can swap any dish afterwards.</p>
        <button style={{ ...ui.button, background: "#EAA28F", color: "#303241" }} onClick={onGenerate}>Plan my week</button></section>}
      <div style={{ display: "grid", gap: 13 }}>
        {dates.map(date => {
          const meals = plan.filter(m => m.date === date && (showAllMeals || m.mealType === "dinner"));
          const other = plan.filter(m => m.date === date && m.mealType !== "dinner");
          const skipped = skippedDays.includes(date);
          return <section key={date} style={{ ...ui.card, opacity: skipped ? .65 : 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <strong style={{ fontSize: 16 }}>{dateLabel(date)}</strong>
              <button style={actionStyle} onClick={() => onSkip(date)}>{skipped ? "Restore day" : "Skip day"}</button>
            </div>
            {meals.length === 0 && <div style={{background:"#F7F7FB",padding:14,borderRadius:13,display:"grid",gap:8}}><span style={{color:"#67677E",fontSize:13}}>No {showAllMeals?"meals":"dinner"} planned for this day.</span><button style={ui.button} onClick={() => { setAdding(date); setQuery(""); }}>+ Add dinner</button></div>}
            {["breakfast","lunch","dinner"].filter(slot=>meals.some(m=>m.mealType===slot)).map(slot => {
              const slotMeals=meals.filter(m=>m.mealType===slot);
              return <div key={slot} style={{marginTop:14}}>
                {showAllMeals && <div style={{fontSize:12,fontWeight:800,letterSpacing:1.3,color:"#A65D4E",textTransform:"uppercase",padding:"9px 0",borderBottom:"1px solid #E5E3EE",marginBottom:12}}>{slot} · {slotMeals.length} {slotMeals.length===1?"dish":"dishes"}</div>}
                {slotMeals.map((meal,i)=><div key={meal.uid || i} style={{borderTop:i?"1px solid #E5E3EE":"none",paddingTop:i?16:0,marginTop:i?16:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:12}}>
                    <FoodArt name={meal.name} size={85}/>
                    <div style={{flex:1,minWidth:0}}>
                      <button onClick={()=>openRecipe(meal)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,background:"none",border:0,padding:"0 0 7px",width:"100%",textAlign:"left",color:"#303241",cursor:"pointer"}}>
                        <span><span style={{display:"block",fontSize:10,letterSpacing:1.1,fontWeight:800,color:"#A65D4E",textTransform:"uppercase",marginBottom:3}}>{slot} · {slotMeals.length===1?"Dish":`Dish ${i+1} of ${slotMeals.length}`}</span>
                          <strong style={{fontSize:17}}>{meal.name}</strong>
                          <span style={{display:"block",color:"#67677E",fontSize:12,marginTop:4}}>{meal.cuisine||"Family favourite"} · {meal.time||"—"} min · {meal.pax||pax||2} servings</span>
                        </span><ChevronRight size={19}/>
                      </button>
                      <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
                        <button style={actionStyle} onClick={()=>{setSwapUid(meal.uid);setQuery("");}}><RefreshCw size={13}/> Swap</button>
                        <button style={actionStyle} onClick={()=>setMoveUid(meal.uid)}>Move</button>
                        <button style={actionStyle} onClick={()=>onMarkCooked(meal.uid)}>{meal.cooked?"Cooked ✓":"Mark cooked"}</button>
                        <button aria-label={"Remove "+meal.name} style={actionStyle} onClick={()=>onRemove(meal.uid)}><Trash2 size={13}/></button>
                      </div>
                    </div>
                  </div>
                </div>)}
              </div>;
            })}
            {!showAllMeals && other.length > 0 && <button onClick={()=>setShowAllMeals(true)} style={{background:"#F1EFFB",color:"#303241",border:0,borderRadius:10,padding:"10px 12px",fontSize:12,marginTop:12,textAlign:"left",width:"100%"}}>☀️ Breakfast / lunch also saved ({other.length}) · Show all meals →</button>}
          </section>;
        })}
      </div>
      {hasCurrentPlan && <button style={{ ...ui.button, width: "100%", marginTop: 16 }} onClick={onGenerate}>↻ Make a fresh seven-day dinner plan</button>}
    </>}
    {view === "shopping" && <section style={ui.card}><ShoppingBasket color="#D98976"/><h3>Shopping, already consolidated</h3>
      <p style={{ color: "#67677E", lineHeight: 1.6 }}>Your existing shopping list deducts kitchen stock, keeps quantities and tracks purchases.</p>
      {shopping}
      <button style={{ ...ui.button, marginTop: 14 }} onClick={onOpenKitchen}>Update what I already have</button>
    </section>}
    {view === "prep" && <section style={ui.card}><ClipboardCheck color="#D98976"/><h3>A little prep goes a long way</h3>
      <p style={{ color: "#67677E", lineHeight: 1.6 }}>Only prep what you can safely store. Refrigerate perishables promptly; freeze items that won't be used soon.</p>
      {!prepList.length && <p>No prep tasks for your current plan.</p>}
      <div style={{ display: "grid", gap: 12 }}>{prepList.map((task,i) => <label key={task.key || i} style={{ display: "flex", alignItems: "start", gap: 12, borderTop: "1px solid #E5E3EE", paddingTop: 12, opacity: task.ready === false ? .6 : 1 }}>
        <input type="checkbox" checked={!!prepChecked[task.key]} onChange={() => onPrepChecked(task.key, task.ready, task.label)} />
        <span><strong>{task.label}</strong>{task.hint && <span style={{ display: "block", fontSize: 12, color: "#67677E", marginTop: 4 }}>{task.hint}</span>}</span></label>)}</div>
    </section>}
    {(swapUid || adding || moveUid) && <div role="dialog" aria-modal="true" aria-label="Edit meal" style={{ position: "fixed", inset: 0, zIndex: 50, background: "#303241CC", display: "grid", placeItems: "center", padding: 16 }}>
      <div style={{ ...ui.card, width: "100%", maxWidth: 520, maxHeight: "85vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><h3 style={{ margin: "0 0 12px" }}>{moveUid ? "Move to another day" : swapUid ? "Swap this dish" : "Add dinner"}</h3><button style={actionStyle} onClick={() => { setSwapUid(null); setAdding(null); setMoveUid(null); }}>Close</button></div>
        {moveUid ? <div style={{ display: "grid", gap: 8 }}>{dates.map(date => <button key={date} style={ui.button} onClick={() => { onMove(moveUid,date); setMoveUid(null); }}>{dateLabel(date)}</button>)}</div> : <>
          <input aria-label="Search recipes" placeholder="Find a recipe…" value={query} onChange={e => setQuery(e.target.value)} style={{ width: "100%", padding: 13, border: "1px solid #E5E3EE", borderRadius: 10, marginBottom: 12 }} />
          <div style={{ display: "grid", gap: 8 }}>{recipeOptions.map(m => <button key={m.id} style={{ ...ui.button, textAlign: "left" }} onClick={() => { if (swapUid) onSwap(swapUid,m.id); else onAdd(adding,"dinner",m.id); setSwapUid(null); setAdding(null); }}>{m.name} <span style={{ float: "right", color: "#67677E" }}>{m.time}m</span></button>)}</div>
        </>}
      </div></div>}
    {recipe && <div role="dialog" aria-modal="true" aria-label={recipe.name} style={{ position: "fixed", inset: 0, zIndex: 60, background: "#303241CC", display: "grid", placeItems: "center", padding: 14 }}>
      <article style={{ ...ui.card, width: "100%", maxWidth: 550, maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 12 }}><div><span style={{ color: "#67677E", fontSize: 12 }}>{recipe.cuisine} · {recipe.time} min</span><h2 style={{ margin: "5px 0 15px" }}>{recipe.name}</h2></div><button aria-label="Close recipe" style={actionStyle} onClick={() => setRecipe(null)}><X size={18}/></button></div>
        {step === null ? <>
          <h3>What you'll need</h3><ul style={{ lineHeight: 1.9, paddingLeft: 22 }}>{(recipe.ingredients || []).map((i,n) => <li key={n}>{i.amount == null ? "" : Math.round(i.amount * ((recipe.pax || pax || recipe.baseServings || 1)/(recipe.baseServings || 1))*10)/10 + " " + (i.unit || "") + " "}{i.name}</li>)}</ul>
          <h3>How to make it</h3><ol style={{ lineHeight: 1.8, paddingLeft: 22 }}>{(recipe.steps || []).map((s,n) => <li key={n}>{s}</li>)}</ol>
          <button style={{ ...ui.button, width: "100%", background: "#EAA28F", color: "#303241" }} onClick={() => setStep(0)}>Start cooking mode</button>
        </> : <>
          <div style={{ color: "#67677E", fontWeight: 700 }}>STEP {step + 1} OF {(recipe.steps || []).length}</div>
          <p style={{ fontSize: 21, lineHeight: 1.6, minHeight: 130 }}>{(recipe.steps || [])[step]}</p>
          <div style={{ display: "flex", gap: 10 }}><button style={{ ...ui.button, flex: 1 }} onClick={() => setStep(step === 0 ? null : step - 1)}><ArrowLeft size={15}/> Back</button>
          <button style={{ ...ui.button, flex: 1, background: "#EAA28F", color: "#303241" }} onClick={() => step + 1 >= (recipe.steps || []).length ? setStep(null) : setStep(step + 1)}>{step + 1 >= (recipe.steps || []).length ? "Finish" : "Next"} <ArrowRight size={15}/></button></div>
        </>}
      </article></div>}
  </main>;
}
