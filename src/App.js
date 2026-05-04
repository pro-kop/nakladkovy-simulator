import { useState, useMemo } from "react";

// ── Konstanty ────────────────────────────────────────────────────────────
const TRAILERS = [
  { id:"plachtovy", name:"Plachtový návěs", length:13600, width:2480, height:2700, desc:"Standardní plachta", accent:"#6366F1" },
  { id:"mega",      name:"Mega návěs",      length:13600, width:2480, height:3000, desc:"Zvýšená výška 3,0 m", accent:"#7C3AED" },
];

const INIT_PALLETS = [
  { id:"eur",       name:"Paleta EUR",     length:1200, width:800,  height:1000, stohovatelnost:3, swapDims:true,  color:"#FBBF24", bg:"#FFFBEB", brd:"#D97706" },
  { id:"vw",        name:"Paleta VW",      length:1200, width:1000, height:1000, stohovatelnost:3, color:"#6EE7B7", bg:"#ECFDF5", brd:"#059669" },
  { id:"ktp777",    name:"KTP 114 777",    length:1230, width:830,  height:950,  stohovatelnost:3, color:"#34D399", bg:"#D1FAE5", brd:"#047857" },
  { id:"eco1208l",  name:"Ecopack 1208L",  length:1200, width:800,  height:995,  stohovatelnost:3, color:"#60A5FA", bg:"#EFF6FF", brd:"#2563EB" },
  { id:"eco1208ls", name:"Ecopack 1208Ls", length:1200, width:800,  height:750,  stohovatelnost:3, color:"#A78BFA", bg:"#F5F3FF", brd:"#7C3AED" },
  { id:"ktp888",    name:"KTP 114 888",    length:1200, width:1000, height:990,  stohovatelnost:3, color:"#F87171", bg:"#FEF2F2", brd:"#DC2626" },
  { id:"eco1210l",  name:"Ecopack 1210L",  length:1200, width:1000, height:990,  stohovatelnost:3, color:"#FB923C", bg:"#FFF7ED", brd:"#EA580C" },
  { id:"eco1210ls", name:"Ecopack 1210Ls", length:1200, width:1000, height:750,  stohovatelnost:3, color:"#2DD4BF", bg:"#F0FDFA", brd:"#0D9488" },
].map(p => ({ ...p, custom:false, active:false, qty:0, swapDims: p.swapDims || false }));

const CUSTOM_COLORS = [
  { color:"#E879F9", bg:"#FDF4FF", brd:"#A21CAF" },
  { color:"#94A3B8", bg:"#F8FAFC", brd:"#475569" },
  { color:"#4ADE80", bg:"#F0FDF4", brd:"#15803D" },
  { color:"#F59E0B", bg:"#FFFBEB", brd:"#B45309" },
  { color:"#38BDF8", bg:"#F0F9FF", brd:"#0369A1" },
];
let colorIdx = 0;

// ── Algoritmy ────────────────────────────────────────────────────────────
function bestOrient(pL, pW, tL, tW) {
  if (!pL || !pW) return null;
  const rA = Math.floor(tW / pW), cA = Math.floor(tL / pL);
  const rB = Math.floor(tW / pL), cB = Math.floor(tL / pW);
  if (!rA && !rB) return null;
  if (!rA) return { d:pW, across:pL, rows:rB, cols:cB };
  if (!rB) return { d:pL, across:pW, rows:rA, cols:cA };
  const tA = rA * cA, tB = rB * cB;
  return (tB > tA || (tB === tA && rB > rA))
    ? { d:pW, across:pL, rows:rB, cols:cB }
    : { d:pL, across:pW, rows:rA, cols:cA };
}

function packAll(items, tL, tW, tH) {
  const placed = [];
  let x = 0;

  // Připrav položky s orientací a efektivním stohováním
      const oriented = items.map(item => {
    let o;
    if (item.swapDims) {
      // Vynutit orientaci dle zadaných rozměrů (d = délka, across = šířka)
      const rows = Math.floor(tW / item.width);
      const cols = Math.floor(tL / item.length);
      if (!rows || !cols) return null;
      o = { d: item.length, across: item.width, rows, cols };
    } else {
      o = bestOrient(item.length, item.width, tL, tW);
      if (!o) return null;
    }
    const maxStack = Math.max(1, Math.min(item.stohovatelnost, Math.floor(tH / item.height)));
    return { ...item, o, maxStack, rem: item.qty };
  }).filter(Boolean);

  // Seskup podle půdorysu — stejný půdorys = lze míchat vertikálně
  const groups = new Map();
  for (const it of oriented) {
    const key = `${it.o.d}|${it.o.across}`;
    if (!groups.has(key)) groups.set(key, { o: it.o, items: [] });
    groups.get(key).items.push(it);
  }

  for (const { o, items: gItems } of groups.values()) {
    let running = true;
    while (running) {
      if (x + o.d > tL || !gItems.some(gi => gi.rem > 0)) break;
      let anyPlaced = false;
      for (let r = 0; r < o.rows; r++) {
        let hLeft = tH;
        const slot = [];
        for (const gi of gItems) {
          if (gi.rem <= 0) continue;
          const n = Math.min(gi.rem, Math.min(gi.maxStack, Math.floor(hLeft / gi.height)));
          if (n > 0) { slot.push({ gi, n }); hLeft -= n * gi.height; gi.rem -= n; }
        }
        if (slot.length > 0) {
          const dom = slot.reduce((a, b) => a.n >= b.n ? a : b);
          placed.push({
            x, y: r * o.across, d: o.d, w: o.across,
            stacks: slot.reduce((s, e) => s + e.n, 0),
            color: dom.gi.color, name: dom.gi.name, id: dom.gi.id, pH: dom.gi.height,
          });
          anyPlaced = true;
        }
      }
      if (anyPlaced) x += o.d; else running = false;
    }
  }
  return { placed };
}

// ── UI helpers ────────────────────────────────────────────────────────────
const pcol = p => p < 70 ? "#10B981" : p < 90 ? "#F59E0B" : "#EF4444";
const pgrad = p => p < 70
  ? "linear-gradient(90deg,#10B981,#34D399)"
  : p < 90
  ? "linear-gradient(90deg,#F59E0B,#FBBF24)"
  : "linear-gradient(90deg,#EF4444,#F87171)";

const INP = { padding:"5px 8px", borderRadius:8, border:"1.5px solid #E5E7EB", fontSize:13, fontWeight:600, color:"#374151", background:"white", outline:"none" };

function Card({ children, style }) {
  return <div style={{ background:"white", borderRadius:22, padding:24, boxShadow:"0 4px 24px rgba(0,0,0,0.07)", ...style }}>{children}</div>;
}

function StepHeader({ n, title }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:18 }}>
      <div style={{ width:28, height:28, borderRadius:"50%", background:"linear-gradient(135deg,#6366F1,#8B5CF6)", color:"white", fontWeight:700, fontSize:13, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>{n}</div>
      <h2 style={{ margin:0, fontSize:19, fontWeight:700, color:"#111827" }}>{title}</h2>
    </div>
  );
}

function NumInput({ label, value, onChange, width=60, brd="#E5E7EB", step }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
      <span style={{ fontSize:10, color:"#9CA3AF", fontWeight:500 }}>{label}</span>
      <input type="number" min="0" step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        style={{ ...INP, width, border:`1.5px solid ${brd}` }} />
    </div>
  );
}

function PalletRow({ p, onChange, onDelete }) {
  const brd = p.active ? p.brd : "#E5E7EB";
  return (
    <div style={{ borderRadius:14, padding:"12px 14px", border:`2px solid ${p.active ? p.brd : "#E5E7EB"}`, background:p.active ? p.bg : "#FAFAFA", transition:"all 0.2s" }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
        {/* Checkbox */}
        <div onClick={() => onChange({ active: !p.active })}
          style={{ width:22, height:22, borderRadius:6, cursor:"pointer", flexShrink:0, border:`2px solid ${p.active ? p.brd : "#D1D5DB"}`, background:p.active ? p.color : "white", display:"flex", alignItems:"center", justifyContent:"center", transition:"all 0.2s" }}>
          {p.active && <span style={{ color:"white", fontSize:12, fontWeight:800, lineHeight:1 }}>✓</span>}
        </div>
        {/* Název */}
        {p.custom
          ? <input value={p.name} onChange={e => onChange({ name:e.target.value })} placeholder="Název"
              style={{ ...INP, width:130, fontWeight:700, fontSize:14, border:`1.5px solid ${brd}` }} />
          : <div style={{ minWidth:130, fontWeight:700, fontSize:14, color:"#111827" }}>{p.name}</div>
        }
        {/* Rozměry + stohovatelnost + počet */}
        <div style={{ display:"flex", gap:7, flexWrap:"wrap", alignItems:"flex-end" }}>
          <NumInput label="Délka cm"  value={+(p.length/10).toFixed(1)} onChange={v => onChange({ length:Math.round(v*10) })} brd={brd} />
          <NumInput label="Šířka cm"  value={+(p.width/10).toFixed(1)}  onChange={v => onChange({ width:Math.round(v*10) })}  brd={brd} />
          <NumInput label="Výška cm"  value={+(p.height/10).toFixed(1)} onChange={v => onChange({ height:Math.round(v*10) })} brd={brd} />
          <NumInput label="Počet ks"  value={p.qty} width={68} onChange={v => { const q = Math.max(0, Math.round(v)); onChange({ qty:q, active:q > 0 ? true : p.active }); }} brd={brd} />
          <div style={{ display:"flex", flexDirection:"column", gap:2, alignSelf:"flex-end" }}>
            <span style={{ fontSize:10, color:"#9CA3AF", fontWeight:500, whiteSpace:"nowrap" }}>Prohodit D/Š</span>
            <div onClick={() => onChange({ swapDims: !p.swapDims })}
              style={{ width:32, height:32, borderRadius:6, cursor:"pointer", border:`2px solid ${p.swapDims ? p.brd : "#D1D5DB"}`, background:p.swapDims ? p.color : "white", display:"flex", alignItems:"center", justifyContent:"center", transition:"all 0.2s" }}>
              {p.swapDims && <span style={{ color:"white", fontSize:14, fontWeight:800, lineHeight:1 }}>✓</span>}
            </div>
          </div>
        </div>
        {p.custom && (
          <button onClick={onDelete} style={{ marginLeft:"auto", background:"#FEF2F2", border:"none", borderRadius:8, color:"#DC2626", cursor:"pointer", padding:"4px 9px", fontSize:16, lineHeight:1 }}>🗑</button>
        )}
      </div>
    </div>
  );
}

// ── Hlavní komponenta ─────────────────────────────────────────────────────
export default function App() {
  const [tid, setTid] = useState(null);
  const [pallets, setPallets] = useState(INIT_PALLETS);

  const trailer = TRAILERS.find(t => t.id === tid) || null;
  const updPallet = (i, u) => setPallets(prev => prev.map((p, j) => j === i ? { ...p, ...u } : p));
  const delPallet = i => setPallets(prev => prev.filter((_, j) => j !== i));
  const addCustom = () => {
    const c = CUSTOM_COLORS[colorIdx++ % CUSTOM_COLORS.length];
    setPallets(prev => [...prev, { id:`c${Date.now()}`, custom:true, name:"Nová jednotka", length:1200, width:800, height:1000, stohovatelnost:3, swapDims:false, ...c, active:false, qty:0 }]);
  };

  const result = useMemo(() => {
    if (!trailer) return null;
    const items = pallets.filter(p => p.active && p.qty > 0 && p.length > 0 && p.width > 0 && p.height > 0);
    if (!items.length) return null;

    const { placed } = packAll(items, trailer.length, trailer.width, trailer.height);
    const tFloor = trailer.length * trailer.width;
    const tVol   = tFloor * trailer.height;
    const gotPal  = placed.reduce((s, p) => s + p.stacks, 0);
    const wantPal = items.reduce((s, p) => s + p.qty, 0);
    const covFloor = placed.reduce((s, p) => s + p.d * p.w, 0);
    const palVol   = placed.reduce((s, p) => s + p.d * p.w * p.stacks * p.pH, 0);
    const floorPct = Math.min(100, covFloor / tFloor * 100);
    const volPct   = Math.min(100, palVol   / tVol   * 100);
    const hints = items.map(item => {
      let o;
      if (item.swapDims) {
        const rows = Math.floor(trailer.width / item.width);
        const cols = Math.floor(trailer.length / item.length);
        if (!rows || !cols) return null;
        o = { d: item.length, across: item.width, rows, cols };
      } else {
        o = bestOrient(item.length, item.width, trailer.length, trailer.width);
        if (!o) return null;
      }
      if (!o) return null;
      const effStacks = Math.max(1, Math.min(item.stohovatelnost, Math.floor(trailer.height / item.height)));
      return { id:item.id, name:item.name, rows:o.rows, d:o.d/10, total:o.rows*o.cols, stacks:effStacks };
    }).filter(Boolean);

    return { placed, floorPct, volPct, gotPal, wantPal, hints };
  }, [trailer, pallets]);

  // Půdorys SVG parametry
  const FW=680, FH=136, FPX=28, FPY=14;
  const tL = trailer?.length || 13600;
  const tW = trailer?.width  || 2480;
  const sx = (FW - FPX*2) / tL;
  const sy = (FH - FPY*2) / tW;

  return (
    <div style={{ minHeight:"100vh", background:"linear-gradient(150deg,#EEF2FF 0%,#F5F3FF 50%,#FCE7F3 100%)", fontFamily:"-apple-system,'SF Pro Display',BlinkMacSystemFont,'Segoe UI',sans-serif", padding:"28px 16px 64px" }}>

      {/* Header */}
      <div style={{ textAlign:"center", marginBottom:32 }}>
        <div style={{ fontSize:48, marginBottom:4 }}>🚚</div>
        <h1 style={{ margin:0, fontSize:28, fontWeight:800, letterSpacing:-0.8, background:"linear-gradient(135deg,#4F46E5,#7C3AED,#BE185D)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>Simulátor nakládky</h1>
        <p style={{ margin:"6px 0 0", color:"#6B7280", fontSize:14 }}>Plánování naplnění návěsu nákladního vozidla</p>
      </div>

      <div style={{ maxWidth:860, margin:"0 auto", display:"flex", flexDirection:"column", gap:18 }}>

        {/* ── Krok 1 ── */}
        <Card>
          <StepHeader n={1} title="Typ vozidla" />
          <div style={{ display:"flex", gap:14 }}>
            {TRAILERS.map(t => {
              const sel = tid === t.id;
              return (
                <div key={t.id} onClick={() => setTid(t.id)}
                  style={{ flex:1, padding:"18px 20px", borderRadius:16, cursor:"pointer", border:`2px solid ${sel ? t.accent : "#E5E7EB"}`, background:sel ? `${t.accent}12` : "#FAFAFA", boxShadow:sel ? `0 6px 24px ${t.accent}28` : "0 1px 4px rgba(0,0,0,0.05)", transform:sel ? "translateY(-3px)" : "none", transition:"all 0.25s" }}>
                  <div style={{ fontWeight:700, fontSize:17, color:"#111827", marginBottom:4 }}>{t.name}</div>
                  <div style={{ fontSize:12, color:"#9CA3AF", marginBottom:14 }}>{t.desc}</div>
                  {[["Délka", `${t.length/1000} m`], ["Šířka", `${t.width/1000} m`], ["Výška", `${t.height/1000} m`]].map(([k, v]) => (
                    <div key={k} style={{ display:"flex", justifyContent:"space-between", fontSize:13, marginBottom:3 }}>
                      <span style={{ color:"#6B7280" }}>{k}</span>
                      <span style={{ fontWeight:600, color:"#374151" }}>{v}</span>
                    </div>
                  ))}
                  {sel && <div style={{ marginTop:12, display:"inline-flex", alignItems:"center", gap:4, background:t.accent, color:"white", borderRadius:20, padding:"3px 12px", fontSize:12, fontWeight:600 }}>✓ Vybráno</div>}
                </div>
              );
            })}
          </div>
        </Card>

        {/* ── Krok 2 ── */}
        <Card>
          <StepHeader n={2} title="Obalové jednotky" />
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {pallets.map((p, i) => <PalletRow key={p.id} p={p} onChange={u => updPallet(i, u)} onDelete={() => delPallet(i)} />)}
          </div>
          <button onClick={addCustom} style={{ marginTop:14, display:"flex", alignItems:"center", gap:8, background:"linear-gradient(135deg,#EEF2FF,#F5F0FF)", border:"2px dashed #A5B4FC", borderRadius:14, padding:"11px 18px", cursor:"pointer", width:"100%", color:"#6366F1", fontWeight:600, fontSize:14, boxSizing:"border-box" }}>
            <span style={{ fontSize:18, lineHeight:1 }}>＋</span> Přidat vlastní jednotku
          </button>
        </Card>

        {/* ── Krok 3 ── */}
        <Card>
          <StepHeader n={3} title="Výsledek nakládky" />

          {!trailer ? (
            <div style={{ textAlign:"center", padding:"28px 0", color:"#9CA3AF" }}>
              <div style={{ fontSize:36, marginBottom:8 }}>👆</div>
              <div style={{ fontSize:15 }}>Vyberte typ vozidla v kroku 1</div>
            </div>
          ) : !result ? (
            <div style={{ textAlign:"center", padding:"28px 0", color:"#9CA3AF" }}>
              <div style={{ fontSize:36, marginBottom:8 }}>📦</div>
              <div style={{ fontSize:15 }}>Zadejte počty obalových jednotek v kroku 2</div>
            </div>
          ) : (<>

            {result.gotPal < result.wantPal && (
              <div style={{ background:"#FEF3C7", border:"1px solid #FCD34D", borderRadius:10, padding:"10px 14px", marginBottom:14, fontSize:13, color:"#92400E" }}>
                ⚠️ Umístěno <strong>{result.gotPal}</strong> ks z požadovaných <strong>{result.wantPal}</strong> ks — část nákladu se nevejde.
              </div>
            )}

            {/* Orientace */}
            <div style={{ background:"#F0FDF4", border:"1px solid #BBF7D0", borderRadius:10, padding:"10px 14px", marginBottom:14, fontSize:12, color:"#14532D", lineHeight:1.9 }}>
              <strong>📐 Optimální orientace:</strong><br />
              {result.hints.map((h, i) => (
                <span key={h.id}>
                  {i > 0 && <span style={{ color:"#86EFAC" }}> · </span>}
                  <strong>{h.name}</strong>:{" "}
                  <span style={{ background:"#DCFCE7", borderRadius:4, padding:"1px 5px" }}>{h.rows}×/řada · {h.d} cm hloubka · {h.total} míst</span>
                  {h.stacks > 1 && <span style={{ color:"#166534" }}>, vrstvit {h.stacks}×</span>}
                </span>
              ))}
            </div>

            {/* Stat karty */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14 }}>
              {[
                { lbl:"Využití plochy", sub:"podlahová plocha",  val:`${result.floorPct.toFixed(1)} %`, icon:"📐", bg:"#EEF2FF", pct:result.floorPct },
                { lbl:"Využití objemu", sub:"3D prostor návěsu", val:`${result.volPct.toFixed(1)} %`,   icon:"📦", bg:"#F5F0FF", pct:result.volPct   },
              ].map((s, i) => (
                <div key={i} style={{ background:s.bg, borderRadius:14, padding:"14px 15px", boxShadow:"0 1px 6px rgba(0,0,0,0.05)" }}>
                  <div style={{ fontSize:22, marginBottom:4 }}>{s.icon}</div>
                  <div style={{ fontSize:24, fontWeight:800, color:"#111827", letterSpacing:-0.5 }}>{s.val}</div>
                  <div style={{ fontSize:11, color:"#374151", fontWeight:600 }}>{s.lbl}</div>
                  <div style={{ fontSize:10, color:"#9CA3AF", marginTop:1 }}>{s.sub}</div>
                  <div style={{ marginTop:8, height:4, background:"#E5E7EB", borderRadius:2, overflow:"hidden" }}>
                    <div style={{ height:"100%", width:`${Math.min(100, s.pct)}%`, background:pgrad(s.pct), transition:"width 0.7s" }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Progress bar */}
            <div style={{ background:"#F9FAFB", borderRadius:12, padding:"12px 16px", marginBottom:14 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
                <span style={{ fontSize:13, fontWeight:600, color:"#374151" }}>Naplnění podlahové plochy</span>
                <span style={{ fontSize:14, fontWeight:700, color:pcol(result.floorPct) }}>{result.floorPct.toFixed(1)} %</span>
              </div>
              <div style={{ height:12, background:"#E5E7EB", borderRadius:6, overflow:"hidden" }}>
                <div style={{ height:"100%", width:`${Math.min(100, result.floorPct)}%`, background:pgrad(result.floorPct), borderRadius:6, transition:"width 0.8s cubic-bezier(.34,1.56,.64,1)" }} />
              </div>
            </div>

            {/* Půdorys */}
            <div style={{ background:"#F9FAFB", borderRadius:14, padding:16 }}>
              <div style={{ fontWeight:600, fontSize:14, color:"#374151", marginBottom:10 }}>📐 Půdorys — pohled shora</div>
              <div style={{ overflowX:"auto" }}>
                <svg width={FW} height={FH+40} style={{ display:"block" }}>
                  <rect x={FPX+3} y={FPY+3} width={FW-FPX*2} height={FH-FPY*2} fill="rgba(0,0,0,0.04)" rx={5} />
                  <rect x={FPX}   y={FPY}   width={FW-FPX*2} height={FH-FPY*2} fill="white" stroke="#D1D5DB" strokeWidth={1.5} rx={4} />
                  {[2000,4000,6000,8000,10000,12000].map(gx => (
                    <line key={gx} x1={FPX+gx*sx} y1={FPY} x2={FPX+gx*sx} y2={FH-FPY} stroke="#F3F4F6" strokeWidth={1} />
                  ))}
                  {[0,2,4,6,8,10,13.6].map(m => (
                    <text key={m} x={FPX+m*1000*sx} y={FH-FPY+13} textAnchor="middle" fontSize={9} fill="#C4C9D4">{m}m</text>
                  ))}
                  {result.placed.map((p, i) => (
                    <g key={i}>
                      <rect x={FPX+p.x*sx+0.5} y={FPY+p.y*sy+0.5} width={Math.max(2, p.d*sx-1)} height={Math.max(2, p.w*sy-1)} fill={p.color} fillOpacity={0.82} stroke="rgba(255,255,255,0.9)" strokeWidth={1} rx={1.5} />
                      {p.d*sx > 16 && p.w*sy > 10 && (
                        <text x={FPX+p.x*sx+p.d*sx/2} y={FPY+p.y*sy+p.w*sy/2+3.5} textAnchor="middle" fontSize={7} fill="rgba(0,0,0,0.50)" fontWeight="bold">×{p.stacks}</text>
                      )}
                    </g>
                  ))}
                  <text x={10} y={FPY+(FH-FPY*2)/2+4} textAnchor="middle" fontSize={9} fill="#C4C9D4" transform={`rotate(-90,10,${FPY+(FH-FPY*2)/2+4})`}>{tW/1000}m</text>
                  <text x={FW/2} y={FH+32} textAnchor="middle" fontSize={10} fill="#9CA3AF">← {tL/1000} m →</text>
                </svg>
              </div>
              {/* Legenda */}
              <div style={{ display:"flex", gap:14, marginTop:8, flexWrap:"wrap", alignItems:"center" }}>
                {pallets.filter(p => p.active && p.qty > 0).map(p => (
                  <span key={p.id} style={{ display:"flex", alignItems:"center", gap:5 }}>
                    <span style={{ width:11, height:11, borderRadius:3, background:p.color, display:"inline-block", opacity:.85 }} />
                    <span style={{ fontSize:12, color:"#4B5563" }}>{p.name}</span>
                  </span>
                ))}
                <span style={{ fontSize:11, color:"#9CA3AF", marginLeft:"auto" }}>×N = počet vrstev</span>
              </div>
            </div>

          </>)}
        </Card>
      </div>
    </div>
  );
}
