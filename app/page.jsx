import { useState, useEffect } from "react";

const TAX_2026 = {
  ZUS_EMERY: 0.0976,
  ZUS_RENT: 0.015,
  ZUS_CHOR: 0.0245,
  ZDROW: 0.09,
  PIT_RATE_1: 0.12,
  PIT_RATE_2: 0.32,
  PIT_THRESHOLD: 120000,
  PIT_FREE: 30000,
  PIT_MONTHLY_REDUCTION: 300,
  KUP_BASE: 250,
  ZDROW_RYCZALT: {
    THRESHOLD_1: 60000,
    THRESHOLD_2: 300000,
    AMOUNT_1: 498.35,
    AMOUNT_2: 830.58,
    AMOUNT_3: 1495.04,
  },
  RYCZALT_RATE_12: 0.12,
};

function calcUoP(brutto, yearGrossSoFar = 0) {
  if (!brutto || brutto <= 0) return null;
  const T = TAX_2026;
  const zusEmery = brutto * T.ZUS_EMERY;
  const zusRent = brutto * T.ZUS_RENT;
  const zusChor = brutto * T.ZUS_CHOR;
  const zusSpol = zusEmery + zusRent + zusChor;
  const podstZdrow = brutto - zusSpol;
  const zdrow = podstZdrow * T.ZDROW;
  const podstPit = brutto - zusSpol - T.KUP_BASE;
  const yearAfterMonth = yearGrossSoFar + podstPit;
  let pit;
  if (yearAfterMonth <= T.PIT_THRESHOLD) {
    pit = podstPit * T.PIT_RATE_1;
  } else if (yearGrossSoFar >= T.PIT_THRESHOLD) {
    pit = podstPit * T.PIT_RATE_2;
  } else {
    const inFirst = T.PIT_THRESHOLD - yearGrossSoFar;
    const inSecond = podstPit - inFirst;
    pit = inFirst * T.PIT_RATE_1 + inSecond * T.PIT_RATE_2;
  }
  pit = Math.max(0, pit - T.PIT_MONTHLY_REDUCTION);
  pit = Math.round(pit);
  const netto = brutto - zusSpol - zdrow - pit;
  return {
    brutto,
    zusEmery: Math.round(zusEmery * 100) / 100,
    zusRent: Math.round(zusRent * 100) / 100,
    zusChor: Math.round(zusChor * 100) / 100,
    zusSpol: Math.round(zusSpol * 100) / 100,
    zdrow: Math.round(zdrow * 100) / 100,
    pit: Math.round(pit),
    netto: Math.round(netto * 100) / 100,
    pitBase: podstPit,
  };
}

function calcUoPFromNetto(netto, yearGrossSoFar = 0) {
  if (!netto || netto <= 0) return null;
  let brutto = netto / 0.72;
  for (let i = 0; i < 20; i++) {
    const r = calcUoP(brutto, yearGrossSoFar);
    if (!r) break;
    const diff = r.netto - netto;
    if (Math.abs(diff) < 0.01) break;
    brutto -= diff * 0.9;
    if (brutto <= 0) { brutto = netto; break; }
  }
  return calcUoP(Math.round(brutto * 100) / 100, yearGrossSoFar);
}

function calcRyczalt(przychod, yearPrzychodSoFar = 0) {
  if (!przychod || przychod <= 0) return null;
  const T = TAX_2026;
  const yearTotal = yearPrzychodSoFar + przychod;
  let zdrow;
  if (yearTotal <= T.ZDROW_RYCZALT.THRESHOLD_1) {
    zdrow = T.ZDROW_RYCZALT.AMOUNT_1;
  } else if (yearTotal <= T.ZDROW_RYCZALT.THRESHOLD_2) {
    zdrow = T.ZDROW_RYCZALT.AMOUNT_2;
  } else {
    zdrow = T.ZDROW_RYCZALT.AMOUNT_3;
  }
  const odliczenie = zdrow * 0.5;
  const podstRyczalt = Math.max(0, przychod - odliczenie);
  const ryczalt = Math.round(podstRyczalt * T.RYCZALT_RATE_12);
  const netto = przychod - zdrow - ryczalt;
  return {
    przychod,
    zdrow: Math.round(zdrow * 100) / 100,
    ryczalt,
    netto: Math.round(netto * 100) / 100,
    zusSpol: 0,
  };
}

function calcRyczaltFromNetto(netto, yearPrzychodSoFar = 0) {
  if (!netto || netto <= 0) return null;
  let przychod = netto / 0.86;
  for (let i = 0; i < 20; i++) {
    const r = calcRyczalt(przychod, yearPrzychodSoFar);
    if (!r) break;
    const diff = r.netto - netto;
    if (Math.abs(diff) < 0.01) break;
    przychod -= diff * 0.9;
    if (przychod <= 0) { przychod = netto; break; }
  }
  return calcRyczalt(Math.round(przychod * 100) / 100, yearPrzychodSoFar);
}

const MONTHS_SHORT = ["Sty","Lut","Mar","Kwi","Maj","Cze","Lip","Sie","Wrz","Paź","Lis","Gru"];
const MONTHS_FULL = ["Styczeń","Luty","Marzec","Kwiecień","Maj","Czerwiec","Lipiec","Sierpień","Wrzesień","Październik","Listopad","Grudzień"];
const YEARS = [2024,2025,2026,2027];

const CAT_INCOME = [
  {id:"uop",label:"UoP",icon:"💼",isTaxed:true,taxType:"uop"},
  {id:"jdg_ryczalt",label:"JDG 12%",icon:"📈",isTaxed:true,taxType:"ryczalt12"},
  {id:"freelance",label:"Freelance",icon:"💻"},
  {id:"bonus",label:"Premia",icon:"🎁"},
  {id:"other_in",label:"Inne",icon:"➕"},
];
const CAT_EXPENSE = [
  {id:"food",label:"Jedzenie",icon:"🛒"},
  {id:"transport",label:"Transport",icon:"🚗"},
  {id:"bills",label:"Rachunki",icon:"📄"},
  {id:"rent",label:"Czynsz",icon:"🏠"},
  {id:"entertainment",label:"Rozrywka",icon:"🎬"},
  {id:"health",label:"Zdrowie",icon:"💊"},
  {id:"clothing",label:"Odzież",icon:"👗"},
  {id:"subscriptions",label:"Subskrypcje",icon:"📱"},
  {id:"other_ex",label:"Inne",icon:"💸"},
];
const GOAL_ICONS = ["🏠","🚗","✈️","💻","📱","🎓","💍","🏖️","🎸","⛵","🏋️","💰"];

const fmt = (n) => new Intl.NumberFormat("pl-PL",{style:"currency",currency:"PLN",minimumFractionDigits:0,maximumFractionDigits:0}).format(n);
const fmtDec = (n) => new Intl.NumberFormat("pl-PL",{style:"currency",currency:"PLN",minimumFractionDigits:2}).format(n);
const load = (key, def) => { try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : def; } catch { return def; } };
const save = (key, val) => { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} };
const monthKey = (y, m) => `${y}-${String(m).padStart(2,"0")}`;
const getCat = (type, id) => (type==="income"?CAT_INCOME:CAT_EXPENSE).find(c=>c.id===id)||{label:id,icon:"•"};

export default function App() {
  const now = new Date();
  const [tab, setTab] = useState("dashboard");
  const [selYear, setSelYear] = useState(now.getFullYear());
  const [selMonth, setSelMonth] = useState(now.getMonth());
  const [txData, setTxData] = useState(() => load("fin3_tx", {}));
  const [recurring, setRecurring] = useState(() => load("fin3_recur", []));
  const [goals, setGoals] = useState(() => load("fin3_goals", []));
  const [modal, setModal] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [txForm, setTxForm] = useState({type:"expense",amount:"",category:"food",note:"",year:now.getFullYear(),month:now.getMonth(),reverseCharge:false,inputMode:"brutto"});
  const [recurForm, setRecurForm] = useState({label:"",amount:"",category:"bills",icon:"📄",startYear:now.getFullYear(),startMonth:now.getMonth()});
  const [goalForm, setGoalForm] = useState({name:"",icon:"🏠",target:"",saved:"",deadline:""});
  const [savingForm, setSavingForm] = useState({goalId:"",amount:""});

  useEffect(() => save("fin3_tx", txData), [txData]);
  useEffect(() => save("fin3_recur", recurring), [recurring]);
  useEffect(() => save("fin3_goals", goals), [goals]);

  const getMonthEntries = (y, m) => {
    const k = monthKey(y, m);
    const manual = txData[k] || [];
    const recurEntries = recurring
      .filter(r => {
        const rk = monthKey(r.startYear, r.startMonth);
        return rk <= k && !(txData[k+"_skip"] || []).includes(r.id);
      })
      .map(r => ({ id:"rec_"+r.id+k, type:"expense", amount:r.amount, category:r.category, note:r.label, date:k+"-01", isRecurring:true, recurId:r.id }));
    return [...manual, ...recurEntries];
  };

  const computeYtdContext = (year, untilMonth) => {
    let uopPitBase = 0;
    let ryczaltPrzychod = 0;
    for (let m = 0; m < untilMonth; m++) {
      const ents = getMonthEntries(year, m);
      ents.filter(e => e.type === "income").forEach(e => {
        const cat = getCat("income", e.category);
        if (cat.taxType === "uop") {
          const r = calcUoP(e.amount, uopPitBase);
          if (r) uopPitBase += r.pitBase;
        }
        if (cat.taxType === "ryczalt12") {
          ryczaltPrzychod += e.amount;
        }
      });
    }
    return { uopPitBase, ryczaltPrzychod };
  };

  const computeMonthSummary = (year, month) => {
    const entries = getMonthEntries(year, month);
    const ytd = computeYtdContext(year, month);
    let bruttoUoP = 0, nettoUoP = 0, zusUoP = 0, zdrowUoP = 0, pitUoP = 0;
    let przychodJDG = 0, nettoJDG = 0, zdrowJDG = 0, ryczaltJDG = 0;
    let inneIncome = 0;
    let bruttoTotal = 0;
    let nettoFromTaxed = 0;

    entries.filter(e => e.type === "income").forEach(e => {
      const cat = getCat("income", e.category);
      bruttoTotal += e.amount;
      if (cat.taxType === "uop") {
        const r = calcUoP(e.amount, ytd.uopPitBase);
        if (r) {
          bruttoUoP += r.brutto;
          nettoUoP += r.netto;
          zusUoP += r.zusSpol;
          zdrowUoP += r.zdrow;
          pitUoP += r.pit;
          nettoFromTaxed += r.netto;
          ytd.uopPitBase += r.pitBase;
        }
      } else if (cat.taxType === "ryczalt12") {
        const r = calcRyczalt(e.amount, ytd.ryczaltPrzychod);
        if (r) {
          przychodJDG += r.przychod;
          nettoJDG += r.netto;
          zdrowJDG += r.zdrow;
          ryczaltJDG += r.ryczalt;
          nettoFromTaxed += r.netto;
          ytd.ryczaltPrzychod += r.przychod;
        }
      } else {
        inneIncome += e.amount;
      }
    });

    const expense = entries.filter(e => e.type === "expense").reduce((s,e)=>s+e.amount,0);
    const realIncome = nettoFromTaxed + inneIncome;
    const net = realIncome - expense;

    return {
      entries, expense,
      bruttoUoP, nettoUoP, zusUoP, zdrowUoP, pitUoP,
      przychodJDG, nettoJDG, zdrowJDG, ryczaltJDG,
      inneIncome, bruttoTotal, realIncome, net,
      ytd,
    };
  };

  const mKey = monthKey(selYear, selMonth);
  const summary = computeMonthSummary(selYear, selMonth);

  const computeYearTax = (year) => {
    let totalUopBrutto = 0, totalUopNetto = 0, totalUopZus = 0, totalUopZdrow = 0, totalUopPit = 0;
    let totalJdgPrzychod = 0, totalJdgNetto = 0, totalJdgZdrow = 0, totalJdgRyczalt = 0;
    for (let m = 0; m < 12; m++) {
      const s = computeMonthSummary(year, m);
      totalUopBrutto += s.bruttoUoP; totalUopNetto += s.nettoUoP;
      totalUopZus += s.zusUoP; totalUopZdrow += s.zdrowUoP; totalUopPit += s.pitUoP;
      totalJdgPrzychod += s.przychodJDG; totalJdgNetto += s.nettoJDG;
      totalJdgZdrow += s.zdrowJDG; totalJdgRyczalt += s.ryczaltJDG;
    }
    return {
      totalUopBrutto, totalUopNetto, totalUopZus, totalUopZdrow, totalUopPit,
      totalJdgPrzychod, totalJdgNetto, totalJdgZdrow, totalJdgRyczalt,
      totalTax: totalUopPit + totalJdgRyczalt,
      totalSkladki: totalUopZus + totalUopZdrow + totalJdgZdrow,
    };
  };
  const yearTax = computeYearTax(selYear);

  const computeForecast = () => {
    let pitSum = 0, ryczaltSum = 0, monthsCount = 0;
    for (let i = 1; i <= 3; i++) {
      let m = now.getMonth() - i, y = now.getFullYear();
      while (m < 0) { m += 12; y--; }
      const s = computeMonthSummary(y, m);
      if (s.bruttoUoP > 0 || s.przychodJDG > 0) {
        pitSum += s.pitUoP;
        ryczaltSum += s.ryczaltJDG;
        monthsCount++;
      }
    }
    if (monthsCount === 0) return null;
    return {
      avgPit: pitSum / monthsCount,
      avgRyczalt: ryczaltSum / monthsCount,
      total: (pitSum + ryczaltSum) / monthsCount,
    };
  };
  const forecast = computeForecast();

  const totalBalance = (() => {
    let total = 0;
    YEARS.forEach(y => {
      for (let m = 0; m < 12; m++) {
        const s = computeMonthSummary(y, m);
        total += s.net;
      }
    });
    return total;
  })();

  const submitTx = () => {
    const amt = parseFloat(String(txForm.amount).replace(",","."));
    if (!amt || amt <= 0) return;
    const k = monthKey(txForm.year, txForm.month);
    const cat = getCat("income", txForm.category);
    let bruttoAmt = amt;
    if (txForm.inputMode === "netto" && txForm.type === "income" && cat.isTaxed) {
      const ytd = computeYtdContext(txForm.year, txForm.month);
      let r = null;
      if (cat.taxType === "uop") r = calcUoPFromNetto(amt, ytd.uopPitBase);
      else if (cat.taxType === "ryczalt12") r = calcRyczaltFromNetto(amt, ytd.ryczaltPrzychod);
      if (r) bruttoAmt = cat.taxType === "uop" ? r.brutto : r.przychod;
    }
    if (editTarget) {
      setTxData(prev => ({ ...prev, [k]: (prev[k]||[]).map(e => e.id===editTarget.id ? {...e, amount:bruttoAmt, category:txForm.category, note:txForm.note, type:txForm.type, reverseCharge:txForm.reverseCharge} : e) }));
    } else {
      const entry = {id:Date.now(), type:txForm.type, amount:bruttoAmt, category:txForm.category, note:txForm.note, date:new Date().toISOString(), reverseCharge:txForm.reverseCharge};
      setTxData(prev => ({ ...prev, [k]: [...(prev[k]||[]), entry] }));
    }
    setModal(null); setEditTarget(null);
  };

  const deleteTx = (entry) => {
    if (entry.isRecurring) {
      setTxData(prev => ({ ...prev, [mKey+"_skip"]: [...(prev[mKey+"_skip"]||[]), entry.recurId] }));
    } else {
      setTxData(prev => ({ ...prev, [mKey]: (prev[mKey]||[]).filter(e=>e.id!==entry.id) }));
    }
  };

  const submitRecur = () => {
    const amt = parseFloat(String(recurForm.amount).replace(",","."));
    if (!amt||amt<=0||!recurForm.label) return;
    if (editTarget) {
      setRecurring(prev => prev.map(r => r.id===editTarget.id ? {...r,...recurForm,amount:amt} : r));
    } else {
      setRecurring(prev => [...prev, {...recurForm, amount:amt, id:Date.now()}]);
    }
    setModal(null); setEditTarget(null);
    setRecurForm({label:"",amount:"",category:"bills",icon:"📄",startYear:now.getFullYear(),startMonth:now.getMonth()});
  };

  const deleteRecur = (id) => setRecurring(prev => prev.filter(r=>r.id!==id));

  const submitGoal = () => {
    const target = parseFloat(String(goalForm.target).replace(",","."));
    const saved = parseFloat(String(goalForm.saved).replace(",","."))||0;
    if (!target||target<=0||!goalForm.name) return;
    if (editTarget) {
      setGoals(prev => prev.map(g => g.id===editTarget.id ? {...g,...goalForm,target,saved:g.saved} : g));
    } else {
      setGoals(prev => [...prev, {...goalForm, target, saved, id:Date.now(), history:[]}]);
    }
    setModal(null); setEditTarget(null);
    setGoalForm({name:"",icon:"🏠",target:"",saved:"",deadline:""});
  };

  const submitSaving = () => {
    const amt = parseFloat(String(savingForm.amount).replace(",","."));
    if (!amt||amt<=0) return;
    setGoals(prev => prev.map(g => g.id===Number(savingForm.goalId)
      ? {...g, saved: g.saved+amt, history:[...(g.history||[]), {date:new Date().toISOString(), amount:amt}]}
      : g
    ));
    setModal(null);
    setSavingForm({goalId:"",amount:""});
  };

  const deleteGoal = (id) => setGoals(prev => prev.filter(g=>g.id!==id));

  const openEditTx = (entry) => {
    if (entry.isRecurring) return;
    setEditTarget(entry);
    setTxForm({type:entry.type, amount:String(entry.amount), category:entry.category, note:entry.note||"", year:selYear, month:selMonth, reverseCharge:entry.reverseCharge||false, inputMode:"brutto"});
    setModal("addTx");
  };
  const openEditRecur = (r) => {
    setEditTarget(r);
    setRecurForm({label:r.label,amount:String(r.amount),category:r.category,icon:r.icon,startYear:r.startYear,startMonth:r.startMonth});
    setModal("addRecur");
  };
  const openEditGoal = (g) => {
    setEditTarget(g);
    setGoalForm({name:g.name,icon:g.icon,target:String(g.target),saved:String(g.saved),deadline:g.deadline||""});
    setModal("editGoal");
  };

  const barData = Array.from({length:6},(_,i)=>{
    let m = now.getMonth()-5+i, y = now.getFullYear();
    while (m<0){m+=12;y--;}
    const s = computeMonthSummary(y,m);
    return { label:MONTHS_SHORT[m], inc:s.realIncome, exp:s.expense };
  });
  const barMax = Math.max(...barData.flatMap(b=>[b.inc,b.exp]),1);

  const monthGrid = Array.from({length:12},(_,m)=>{
    const s = computeMonthSummary(selYear,m);
    return {m, net:s.net, hasData:s.entries.length>0};
  });

  return (
    <div style={{minHeight:"100vh",background:"#08080e",fontFamily:"Sora, sans-serif",color:"#eeeaf4",maxWidth:430,margin:"0 auto",position:"relative",overflowX:"hidden"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent;}
        ::-webkit-scrollbar{display:none;}
        input,textarea,select{outline:none;border:none;background:none;font-family:inherit;color:#eeeaf4;}
        button{border:none;cursor:pointer;font-family:inherit;}
        .card{background:rgba(255,255,255,0.038);border:1px solid rgba(255,255,255,0.07);border-radius:20px;}
        .row{display:flex;align-items:center;gap:12px;padding:13px 0;border-bottom:1px solid rgba(255,255,255,0.05);}
        .row:last-child{border-bottom:none;}
        .pill{border-radius:100px;padding:3px 9px;font-size:10px;font-weight:600;letter-spacing:.05em;}
        .green{color:#4ade80;} .red{color:#f87171;} .blue{color:#7dd3fc;} .amber{color:#fbbf24;} .violet{color:#a78bfa;}
        .bg-blue{background:rgba(125,211,252,.1);color:#7dd3fc;}
        .bg-violet{background:rgba(167,139,250,.12);color:#a78bfa;}
        .bg-amber{background:rgba(251,191,36,.12);color:#fbbf24;}
        .tab{flex:1;padding:10px 6px;background:none;font-size:11px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:#44445a;border-radius:10px;transition:all .2s;}
        .tab.on{background:rgba(255,255,255,.07);color:#eeeaf4;}
        .nav-btn{display:flex;flex-direction:column;align-items:center;gap:3px;background:none;transition:all .2s;padding:4px 8px;}
        .cat-chip{border-radius:12px;padding:8px 12px;background:rgba(255,255,255,.04);border:1.5px solid transparent;cursor:pointer;transition:all .15s;display:flex;flex-direction:column;align-items:center;gap:3px;font-size:10px;color:#666680;min-width:66px;}
        .cat-chip.sel-exp{border-color:#f87171;background:rgba(248,113,113,.1);color:#f87171;}
        .cat-chip.sel-inc{border-color:#4ade80;background:rgba(74,222,128,.1);color:#4ade80;}
        .icon-chip{width:40px;height:40px;border-radius:12px;background:rgba(255,255,255,.05);border:1.5px solid transparent;cursor:pointer;transition:all .15s;display:flex;align-items:center;justify-content:center;font-size:20px;}
        .icon-chip.sel{border-color:#7dd3fc;background:rgba(125,211,252,.1);}
        .modal-bg{position:fixed;inset:0;background:rgba(0,0,0,.7);backdrop-filter:blur(6px);z-index:200;display:flex;align-items:flex-end;justify-content:center;}
        .modal{background:#111119;border-radius:28px 28px 0 0;width:100%;max-width:430px;padding:24px 22px 40px;max-height:90vh;overflow-y:auto;border-top:1px solid rgba(255,255,255,.08);}
        .drag-handle{width:40px;height:4px;background:rgba(255,255,255,.15);border-radius:2px;margin:0 auto 20px;}
        .input-box{background:rgba(255,255,255,.05);border-radius:14px;padding:14px 16px;border:1px solid rgba(255,255,255,.08);display:flex;align-items:center;gap:10px;}
        .input-box input{flex:1;font-size:15px;}
        .select-box{background:rgba(255,255,255,.05);border-radius:14px;padding:14px 16px;border:1px solid rgba(255,255,255,.08);width:100%;color:#eeeaf4;font-size:14px;-webkit-appearance:none;appearance:none;}
        .btn-primary{width:100%;padding:17px;border-radius:16px;font-size:15px;font-weight:700;letter-spacing:.02em;color:#fff;transition:all .15s;}
        .progress-bar{height:8px;border-radius:100px;background:rgba(255,255,255,.07);overflow:hidden;}
        .progress-fill{height:100%;border-radius:100px;transition:width .5s ease;}
        @keyframes up{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        .up{animation:up .3s ease both;}
        @keyframes pop{from{transform:scale(.92);opacity:0}to{transform:scale(1);opacity:1}}
        .pop{animation:pop .2s ease both;}
        .breakdown-grid{display:grid;grid-template-columns:1fr auto;gap:8px 14px;}
        .breakdown-grid > *:nth-child(odd){color:#888899;font-size:12px;}
        .breakdown-grid > *:nth-child(even){font-family:monospace;font-size:13px;font-weight:600;text-align:right;}
      `}</style>

      <div style={{position:"fixed",top:-200,left:-100,width:500,height:500,background:"radial-gradient(ellipse,rgba(45,212,191,.07) 0%,transparent 65%)",pointerEvents:"none",zIndex:0}}/>
      <div style={{position:"fixed",top:300,right:-150,width:400,height:400,background:"radial-gradient(ellipse,rgba(167,139,250,.05) 0%,transparent 65%)",pointerEvents:"none",zIndex:0}}/>

      {tab==="dashboard" && (
        <div style={{padding:"0 0 110px",position:"relative",zIndex:1}}>
          <div style={{padding:"56px 22px 0"}}>
            <div style={{fontSize:11,color:"#44445a",letterSpacing:".1em",textTransform:"uppercase",marginBottom:6}}>Całkowite saldo</div>
            <div className="pop" style={{fontSize:46,fontWeight:800,letterSpacing:"-0.04em",color:totalBalance>=0?"#eeeaf4":"#f87171",lineHeight:1}}>
              {fmt(totalBalance)}
            </div>
            <div style={{marginTop:8,fontSize:12,color:"#44445a"}}>uwzględnia ZUS, zdrowotną, PIT i ryczałt</div>
          </div>

          <div className="card" style={{margin:"24px 18px 0",padding:"18px",cursor:"pointer"}} onClick={()=>setTab("month")}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
              <span style={{fontSize:15,fontWeight:600}}>{MONTHS_FULL[now.getMonth()]} {now.getFullYear()}</span>
              <span style={{fontSize:11,color:"#44445a",background:"rgba(255,255,255,.05)",borderRadius:8,padding:"4px 10px"}}>szczegóły →</span>
            </div>
            {(() => {
              const s = computeMonthSummary(now.getFullYear(), now.getMonth());
              return (
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
                  <div style={{background:"rgba(0,0,0,.35)",borderRadius:14,padding:"11px 10px",textAlign:"center"}}>
                    <div style={{fontSize:9,color:"#44445a",textTransform:"uppercase",letterSpacing:".08em",marginBottom:5}}>Na rękę</div>
                    <div className="green" style={{fontSize:13,fontWeight:700}}>{fmt(s.realIncome)}</div>
                  </div>
                  <div style={{background:"rgba(0,0,0,.35)",borderRadius:14,padding:"11px 10px",textAlign:"center"}}>
                    <div style={{fontSize:9,color:"#44445a",textTransform:"uppercase",letterSpacing:".08em",marginBottom:5}}>Wydatki</div>
                    <div className="red" style={{fontSize:13,fontWeight:700}}>{fmt(s.expense)}</div>
                  </div>
                  <div style={{background:"rgba(0,0,0,.35)",borderRadius:14,padding:"11px 10px",textAlign:"center"}}>
                    <div style={{fontSize:9,color:"#44445a",textTransform:"uppercase",letterSpacing:".08em",marginBottom:5}}>Bilans</div>
                    <div className={s.net>=0?"blue":"red"} style={{fontSize:13,fontWeight:700}}>{fmt(s.net)}</div>
                  </div>
                </div>
              );
            })()}
          </div>

          <div className="card" style={{margin:"14px 18px 0",padding:"18px"}}>
            <div style={{fontSize:11,color:"#44445a",letterSpacing:".08em",textTransform:"uppercase",marginBottom:14}}>Ostatnie 6 miesięcy</div>
            <div style={{display:"flex",alignItems:"flex-end",gap:5,height:72}}>
              {barData.map((b,i)=>(
                <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                  <div style={{width:"100%",display:"flex",gap:2,alignItems:"flex-end",height:56}}>
                    <div style={{flex:1,background:"rgba(74,222,128,.35)",borderRadius:"3px 3px 0 0",height:`${(b.inc/barMax)*100}%`,minHeight:b.inc>0?2:0}}/>
                    <div style={{flex:1,background:"rgba(248,113,113,.35)",borderRadius:"3px 3px 0 0",height:`${(b.exp/barMax)*100}%`,minHeight:b.exp>0?2:0}}/>
                  </div>
                  <div style={{fontSize:9,color:"#44445a"}}>{b.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{margin:"20px 18px 0"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
              <div style={{fontSize:11,color:"#44445a",letterSpacing:".08em",textTransform:"uppercase"}}>Historia</div>
              <div style={{display:"flex",gap:2}}>
                {YEARS.map(y=>(
                  <button key={y} onClick={()=>setSelYear(y)} style={{padding:"4px 8px",borderRadius:8,background:selYear===y?"rgba(125,211,252,.15)":"rgba(255,255,255,.04)",color:selYear===y?"#7dd3fc":"#44445a",fontSize:11,fontWeight:600}}>{y}</button>
                ))}
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
              {monthGrid.map(({m,net,hasData})=>{
                const isCur = m===now.getMonth()&&selYear===now.getFullYear();
                return (
                  <div key={m} onClick={()=>{setSelMonth(m);setTab("month");}} style={{background:isCur?"rgba(125,211,252,.07)":"rgba(255,255,255,.03)",borderRadius:14,padding:"11px 8px",border:isCur?"1px solid rgba(125,211,252,.25)":"1px solid rgba(255,255,255,.05)",cursor:"pointer",textAlign:"center"}}>
                    <div style={{fontSize:11,fontWeight:600,marginBottom:4,color:isCur?"#7dd3fc":"#eeeaf4"}}>{MONTHS_SHORT[m]}</div>
                    {hasData ? <div style={{fontSize:11,fontWeight:700,color:net>=0?"#4ade80":"#f87171"}}>{fmt(net)}</div>
                      : <div style={{fontSize:11,color:"#2a2a40"}}>—</div>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {tab==="month" && (
        <div style={{padding:"0 0 110px",position:"relative",zIndex:1}}>
          <div style={{padding:"56px 18px 16px"}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
              <button onClick={()=>setTab("dashboard")} style={{width:36,height:36,borderRadius:12,background:"rgba(255,255,255,.07)",color:"#eeeaf4",fontSize:18}}>‹</button>
              <div style={{flex:1,display:"flex",gap:8}}>
                <select className="select-box" style={{background:"rgba(255,255,255,.06)",borderRadius:12,padding:"6px 12px",fontSize:14,fontWeight:600,flex:2}} value={selMonth} onChange={e=>setSelMonth(Number(e.target.value))}>
                  {MONTHS_FULL.map((mn,i)=><option key={i} value={i}>{mn}</option>)}
                </select>
                <select className="select-box" style={{background:"rgba(255,255,255,.06)",borderRadius:12,padding:"6px 12px",fontSize:14,fontWeight:600,flex:1}} value={selYear} onChange={e=>setSelYear(Number(e.target.value))}>
                  {YEARS.map(y=><option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>

            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
              <div className="card" style={{padding:"12px 10px",textAlign:"center"}}>
                <div style={{fontSize:9,color:"#44445a",textTransform:"uppercase",letterSpacing:".07em",marginBottom:4}}>Na rękę</div>
                <div className="green" style={{fontSize:13,fontWeight:700}}>{fmt(summary.realIncome)}</div>
              </div>
              <div className="card" style={{padding:"12px 10px",textAlign:"center"}}>
                <div style={{fontSize:9,color:"#44445a",textTransform:"uppercase",letterSpacing:".07em",marginBottom:4}}>Wydatki</div>
                <div className="red" style={{fontSize:13,fontWeight:700}}>{fmt(summary.expense)}</div>
              </div>
              <div className="card" style={{padding:"12px 10px",textAlign:"center"}}>
                <div style={{fontSize:9,color:"#44445a",textTransform:"uppercase",letterSpacing:".07em",marginBottom:4}}>Bilans</div>
                <div className={summary.net>=0?"blue":"red"} style={{fontSize:13,fontWeight:700}}>{fmt(summary.net)}</div>
              </div>
            </div>

            {summary.bruttoTotal !== summary.realIncome && (summary.bruttoUoP>0||summary.przychodJDG>0) && (
              <div style={{marginTop:10,background:"rgba(167,139,250,.06)",borderRadius:12,padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:11}}>
                <span style={{color:"#888"}}>Brutto: <strong style={{color:"#eeeaf4"}}>{fmt(summary.bruttoTotal)}</strong></span>
                <span style={{color:"#a78bfa"}}>Podatki/składki: <strong>{fmt(summary.zusUoP+summary.zdrowUoP+summary.pitUoP+summary.zdrowJDG+summary.ryczaltJDG)}</strong></span>
              </div>
            )}
          </div>

          <div style={{padding:"0 18px"}}>
            {summary.entries.length===0 ? (
              <div style={{textAlign:"center",padding:"50px 0",color:"#2a2a40"}}>
                <div style={{fontSize:44,marginBottom:10}}>📋</div>
                <div style={{fontSize:14}}>Brak transakcji</div>
              </div>
            ) : summary.entries.map((e,i)=>{
              const cat = getCat(e.type,e.category);
              return (
                <div key={e.id} className="row up" style={{animationDelay:`${i*.03}s`}} onClick={()=>openEditTx(e)}>
                  <div style={{width:42,height:42,borderRadius:13,background:e.type==="income"?"rgba(74,222,128,.1)":"rgba(248,113,113,.08)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:19,flexShrink:0}}>{cat.icon}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:14,fontWeight:500,display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                      {cat.label}
                      {e.isRecurring && <span className="pill bg-blue" style={{fontSize:9}}>STAŁY</span>}
                      {cat.isTaxed && <span className="pill bg-violet" style={{fontSize:9}}>BRUTTO</span>}
                      {e.reverseCharge && <span className="pill" style={{fontSize:9,background:"rgba(34,211,238,.12)",color:"#22d3ee"}}>RC</span>}
                    </div>
                    {e.note && <div style={{fontSize:11,color:"#44445a",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.note}</div>}
                  </div>
                  <div style={{textAlign:"right",flexShrink:0}}>
                    <div style={{fontSize:15,fontWeight:700,color:e.type==="income"?"#4ade80":"#f87171"}}>{e.type==="income"?"+":"-"}{fmt(e.amount)}</div>
                    <div style={{fontSize:9,color:"#2a2a40"}}>{new Date(e.date).toLocaleDateString("pl-PL",{day:"2-digit",month:"2-digit"})}</div>
                  </div>
                  <button onClick={ev=>{ev.stopPropagation();deleteTx(e);}} style={{width:26,height:26,borderRadius:8,background:"rgba(248,113,113,.1)",color:"#f87171",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>×</button>
                </div>
              );
            })}
          </div>

          <div style={{padding:"20px 18px 0",display:"flex",justifyContent:"center"}}>
            <button onClick={()=>{setEditTarget(null);setTxForm({type:"expense",amount:"",category:"food",note:"",year:selYear,month:selMonth,reverseCharge:false,inputMode:"brutto"});setModal("addTx");}} style={{background:"linear-gradient(135deg,#2dd4bf,#14b8a6)",color:"#fff",borderRadius:16,padding:"14px 32px",fontSize:14,fontWeight:700,boxShadow:"0 8px 24px rgba(45,212,191,.25)"}}>
              + Dodaj transakcję
            </button>
          </div>
        </div>
      )}

      {tab==="taxes" && (
        <div style={{padding:"0 0 110px",position:"relative",zIndex:1}}>
          <div style={{padding:"56px 18px 20px"}}>
            <div style={{fontSize:20,fontWeight:700}}>Podatki i składki</div>
            <div style={{display:"flex",gap:6,marginTop:10}}>
              {YEARS.map(y=>(
                <button key={y} onClick={()=>setSelYear(y)} style={{padding:"6px 12px",borderRadius:10,background:selYear===y?"rgba(167,139,250,.15)":"rgba(255,255,255,.04)",color:selYear===y?"#a78bfa":"#666",fontSize:12,fontWeight:600}}>{y}</button>
              ))}
            </div>
          </div>

          <div className="card" style={{margin:"0 18px 14px",padding:"20px",borderColor:"rgba(167,139,250,.15)"}}>
            <div style={{fontSize:11,color:"#a78bfa",textTransform:"uppercase",letterSpacing:".1em",marginBottom:14}}>Rok {selYear} – podsumowanie</div>

            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
              <div style={{background:"rgba(167,139,250,.06)",borderRadius:13,padding:"12px 12px"}}>
                <div style={{fontSize:10,color:"#888",textTransform:"uppercase",letterSpacing:".06em",marginBottom:6}}>Podatki</div>
                <div className="amber" style={{fontSize:18,fontWeight:800,fontFamily:"monospace"}}>{fmt(yearTax.totalTax)}</div>
                <div style={{fontSize:10,color:"#666",marginTop:4}}>PIT + ryczałt</div>
              </div>
              <div style={{background:"rgba(167,139,250,.06)",borderRadius:13,padding:"12px 12px"}}>
                <div style={{fontSize:10,color:"#888",textTransform:"uppercase",letterSpacing:".06em",marginBottom:6}}>Składki</div>
                <div className="violet" style={{fontSize:18,fontWeight:800,fontFamily:"monospace"}}>{fmt(yearTax.totalSkladki)}</div>
                <div style={{fontSize:10,color:"#666",marginTop:4}}>ZUS + zdrowotna</div>
              </div>
            </div>

            {yearTax.totalUopBrutto > 0 && (
              <div style={{marginBottom:14,padding:"14px",background:"rgba(0,0,0,.3)",borderRadius:13}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                  <span style={{fontSize:16}}>💼</span><span style={{fontSize:13,fontWeight:600}}>Umowa o pracę</span>
                </div>
                <div className="breakdown-grid">
                  <div>Brutto</div><div>{fmtDec(yearTax.totalUopBrutto)}</div>
                  <div>ZUS społeczne (13,71%)</div><div className="violet">{fmtDec(yearTax.totalUopZus)}</div>
                  <div>Składka zdrowotna (9%)</div><div className="violet">{fmtDec(yearTax.totalUopZdrow)}</div>
                  <div>PIT (zaliczki)</div><div className="amber">{fmtDec(yearTax.totalUopPit)}</div>
                  <div style={{color:"#4ade80",fontWeight:600}}>Na rękę</div><div className="green">{fmtDec(yearTax.totalUopNetto)}</div>
                </div>
              </div>
            )}

            {yearTax.totalJdgPrzychod > 0 && (
              <div style={{padding:"14px",background:"rgba(0,0,0,.3)",borderRadius:13}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                  <span style={{fontSize:16}}>📈</span><span style={{fontSize:13,fontWeight:600}}>JDG – ryczałt 12%</span>
                </div>
                <div className="breakdown-grid">
                  <div>Przychód</div><div>{fmtDec(yearTax.totalJdgPrzychod)}</div>
                  <div>Składka zdrowotna</div><div className="violet">{fmtDec(yearTax.totalJdgZdrow)}</div>
                  <div>Ryczałt 12%</div><div className="amber">{fmtDec(yearTax.totalJdgRyczalt)}</div>
                  <div style={{color:"#4ade80",fontWeight:600}}>Na rękę</div><div className="green">{fmtDec(yearTax.totalJdgNetto)}</div>
                </div>
                <div style={{marginTop:10,padding:"8px 12px",background:"rgba(74,222,128,.06)",borderRadius:10,fontSize:11,color:"#4ade80"}}>
                  ✓ Zwolniony z ZUS społ. (UoP ≥ minimalna krajowa)
                </div>
              </div>
            )}
          </div>

          <div style={{padding:"0 18px"}}>
            <div style={{fontSize:11,color:"#44445a",textTransform:"uppercase",letterSpacing:".1em",marginBottom:10,marginTop:8}}>Po miesiącach</div>
            {Array.from({length:12},(_,m)=>{
              const s = computeMonthSummary(selYear, m);
              const monthTax = s.pitUoP + s.ryczaltJDG;
              const monthSkladki = s.zusUoP + s.zdrowUoP + s.zdrowJDG;
              if (monthTax + monthSkladki === 0) return null;
              return (
                <div key={m} className="card" style={{padding:"14px 16px",marginBottom:8}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                    <span style={{fontSize:14,fontWeight:600}}>{MONTHS_FULL[m]}</span>
                    <span className="violet" style={{fontSize:14,fontWeight:700,fontFamily:"monospace"}}>{fmt(monthTax+monthSkladki)}</span>
                  </div>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                    {s.zusUoP>0 && <span className="pill bg-violet">ZUS {fmt(s.zusUoP)}</span>}
                    {s.zdrowUoP>0 && <span className="pill bg-violet">Zdr.UoP {fmt(s.zdrowUoP)}</span>}
                    {s.pitUoP>0 && <span className="pill bg-amber">PIT {fmt(s.pitUoP)}</span>}
                    {s.zdrowJDG>0 && <span className="pill bg-violet">Zdr.JDG {fmt(s.zdrowJDG)}</span>}
                    {s.ryczaltJDG>0 && <span className="pill bg-amber">Ryczałt {fmt(s.ryczaltJDG)}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab==="recurring" && (
        <div style={{padding:"0 0 110px",position:"relative",zIndex:1}}>
          <div style={{padding:"56px 18px 20px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div>
              <div style={{fontSize:20,fontWeight:700}}>Stałe wydatki</div>
              <div style={{fontSize:12,color:"#44445a",marginTop:2}}>Kopiowane automatycznie</div>
            </div>
            <button onClick={()=>{setEditTarget(null);setRecurForm({label:"",amount:"",category:"bills",icon:"📄",startYear:now.getFullYear(),startMonth:now.getMonth()});setModal("addRecur");}} style={{width:38,height:38,borderRadius:13,background:"rgba(45,212,191,.15)",color:"#2dd4bf",fontSize:22,display:"flex",alignItems:"center",justifyContent:"center"}}>+</button>
          </div>

          <div className="card" style={{margin:"0 18px 20px",padding:"16px 18px",display:"flex",justifyContent:"space-between",boxShadow:"0 0 28px rgba(45,212,191,.15)"}}>
            <div style={{fontSize:13,color:"#44445a"}}>Suma miesięczna</div>
            <div style={{fontSize:20,fontWeight:800,color:"#2dd4bf"}}>{fmt(recurring.reduce((s,r)=>s+r.amount,0))}</div>
          </div>

          <div style={{padding:"0 18px"}}>
            {recurring.length===0 ? (
              <div style={{textAlign:"center",padding:"50px 0",color:"#2a2a40"}}>
                <div style={{fontSize:44,marginBottom:10}}>🔄</div>
                <div style={{fontSize:14}}>Brak stałych wydatków</div>
              </div>
            ) : recurring.map((r,i)=>{
              const cat = getCat("expense",r.category);
              return (
                <div key={r.id} className="row up" style={{animationDelay:`${i*.04}s`}} onClick={()=>openEditRecur(r)}>
                  <div style={{width:42,height:42,borderRadius:13,background:"rgba(248,113,113,.08)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:19,flexShrink:0}}>{r.icon||cat.icon}</div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:14,fontWeight:500}}>{r.label}</div>
                    <div style={{fontSize:11,color:"#44445a"}}>od {MONTHS_SHORT[r.startMonth]} {r.startYear} · {cat.label}</div>
                  </div>
                  <div style={{fontSize:15,fontWeight:700,color:"#f87171"}}>{fmt(r.amount)}/mies.</div>
                  <button onClick={ev=>{ev.stopPropagation();deleteRecur(r.id);}} style={{width:26,height:26,borderRadius:8,background:"rgba(248,113,113,.1)",color:"#f87171",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>×</button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab==="goals" && (
        <div style={{padding:"0 0 110px",position:"relative",zIndex:1}}>
          <div style={{padding:"56px 18px 20px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div>
              <div style={{fontSize:20,fontWeight:700}}>Cele oszczędnościowe</div>
              <div style={{fontSize:12,color:"#44445a",marginTop:2}}>Śledź swoje marzenia</div>
            </div>
            <button onClick={()=>{setEditTarget(null);setGoalForm({name:"",icon:"🏠",target:"",saved:"",deadline:""});setModal("addGoal");}} style={{width:38,height:38,borderRadius:13,background:"rgba(251,191,36,.12)",color:"#fbbf24",fontSize:22,display:"flex",alignItems:"center",justifyContent:"center"}}>+</button>
          </div>

          <div style={{padding:"0 18px",display:"flex",flexDirection:"column",gap:14}}>
            {goals.length===0 ? (
              <div style={{textAlign:"center",padding:"50px 0",color:"#2a2a40"}}>
                <div style={{fontSize:44,marginBottom:10}}>🎯</div>
                <div style={{fontSize:14}}>Brak celów</div>
              </div>
            ) : goals.map((g,gi)=>{
              const pct = Math.min((g.saved/g.target)*100,100);
              const remaining = Math.max(g.target-g.saved,0);
              const avgSaving = (() => {
                let total = 0;
                for (let i=0;i<3;i++){
                  let m = now.getMonth()-i, y=now.getFullYear();
                  if(m<0){m+=12;y--;}
                  const s = computeMonthSummary(y,m);
                  if (s.net>0) total += s.net;
                }
                return total/3;
              })();
              const monthsNeeded = avgSaving>0 ? Math.ceil(remaining/avgSaving) : null;
              const deadline = g.deadline ? new Date(g.deadline) : null;
              const daysLeft = deadline ? Math.ceil((deadline-now)/(1000*60*60*24)) : null;
              const monthsLeft = daysLeft ? Math.ceil(daysLeft/30) : null;
              const neededPerMonth = (monthsLeft&&monthsLeft>0&&remaining>0) ? remaining/monthsLeft : null;

              return (
                <div key={g.id} className="card up" style={{padding:"18px",animationDelay:`${gi*.06}s`}}>
                  <div style={{display:"flex",alignItems:"flex-start",gap:12,marginBottom:14}}>
                    <div style={{width:48,height:48,borderRadius:15,background:"rgba(251,191,36,.1)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,flexShrink:0}}>{g.icon}</div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:16,fontWeight:700}}>{g.name}</div>
                      <div style={{fontSize:12,color:"#44445a",marginTop:2}}>{fmtDec(g.saved)} z {fmtDec(g.target)}</div>
                    </div>
                    <div style={{fontSize:20,fontWeight:800,color:"#fbbf24"}}>{Math.round(pct)}%</div>
                  </div>

                  <div className="progress-bar" style={{marginBottom:14}}>
                    <div className="progress-fill" style={{width:`${pct}%`,background:"linear-gradient(90deg,#f59e0b,#fbbf24)"}}/>
                  </div>

                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:14}}>
                    <div style={{background:"rgba(0,0,0,.3)",borderRadius:12,padding:"10px 8px",textAlign:"center"}}>
                      <div style={{fontSize:9,color:"#44445a",marginBottom:4,textTransform:"uppercase",letterSpacing:".07em"}}>Pozostało</div>
                      <div style={{fontSize:12,fontWeight:700,color:"#f87171"}}>{fmt(remaining)}</div>
                    </div>
                    <div style={{background:"rgba(0,0,0,.3)",borderRadius:12,padding:"10px 8px",textAlign:"center"}}>
                      <div style={{fontSize:9,color:"#44445a",marginBottom:4,textTransform:"uppercase",letterSpacing:".07em"}}>{neededPerMonth?"/miesiąc":"Avg."}</div>
                      <div style={{fontSize:12,fontWeight:700,color:"#7dd3fc"}}>{neededPerMonth ? fmt(neededPerMonth) : (monthsNeeded ? `${monthsNeeded} mies.` : "—")}</div>
                    </div>
                    <div style={{background:"rgba(0,0,0,.3)",borderRadius:12,padding:"10px 8px",textAlign:"center"}}>
                      <div style={{fontSize:9,color:"#44445a",marginBottom:4,textTransform:"uppercase",letterSpacing:".07em"}}>{deadline?"Termin":"Czas"}</div>
                      <div style={{fontSize:12,fontWeight:700,color:daysLeft&&daysLeft<90?"#f87171":"#fbbf24"}}>{deadline ? (daysLeft>=0?`${daysLeft}d`:"Po term.") : (monthsNeeded?`${monthsNeeded} m.`:"—")}</div>
                    </div>
                  </div>

                  {deadline && neededPerMonth && (
                    <div style={{background:"rgba(251,191,36,.06)",borderRadius:12,padding:"10px 12px",marginBottom:12,fontSize:12,color:"#fbbf24",display:"flex",alignItems:"center",gap:8}}>
                      <span>⚡</span><span>Odkładaj <strong>{fmt(neededPerMonth)}/mies.</strong> aby zdążyć</span>
                    </div>
                  )}

                  {pct>=100 && (
                    <div style={{background:"rgba(74,222,128,.08)",borderRadius:12,padding:"10px 12px",marginBottom:12,fontSize:12,color:"#4ade80",display:"flex",alignItems:"center",gap:8}}>
                      <span>🎉</span><span>Cel osiągnięty!</span>
                    </div>
                  )}

                  <div style={{display:"flex",gap:8}}>
                    <button onClick={()=>{setSavingForm({goalId:String(g.id),amount:""});setModal("addSaving");}} style={{flex:1,padding:"11px",borderRadius:13,background:"linear-gradient(135deg,#f59e0b,#fbbf24)",color:"#000",fontSize:13,fontWeight:700}}>+ Wpłata</button>
                    <button onClick={()=>openEditGoal(g)} style={{width:40,height:40,borderRadius:13,background:"rgba(255,255,255,.06)",color:"#eeeaf4",fontSize:16}}>✏️</button>
                    <button onClick={()=>deleteGoal(g.id)} style={{width:40,height:40,borderRadius:13,background:"rgba(248,113,113,.08)",color:"#f87171",fontSize:16}}>🗑</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:430,background:"rgba(8,8,14,.94)",backdropFilter:"blur(20px)",borderTop:"1px solid rgba(255,255,255,.06)",padding:"10px 4px 26px",display:"flex",alignItems:"center",justifyContent:"space-around",zIndex:100}}>
        {[
          {id:"dashboard",icon:"◎",label:"Główna"},
          {id:"month",icon:"≡",label:"Miesiąc"},
          {id:"taxes",icon:"🧾",label:"Podatki"},
          {id:"recurring",icon:"🔄",label:"Stałe"},
          {id:"goals",icon:"🎯",label:"Cele"},
        ].map(n=>(
          <button key={n.id} className="nav-btn" onClick={()=>setTab(n.id)} style={{color:tab===n.id?"#eeeaf4":"#2a2a40"}}>
            <span style={{fontSize:20}}>{n.icon}</span>
            <span style={{fontSize:9,fontWeight:600,letterSpacing:".06em",textTransform:"uppercase",color:tab===n.id?"#a78bfa":"#2a2a40"}}>{n.label}</span>
          </button>
        ))}
      </div>

      {modal==="addTx" && (
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget){setModal(null);setEditTarget(null);}}}>
          <div className="modal">
            <div className="drag-handle"/>
            <div style={{fontSize:17,fontWeight:700,marginBottom:18}}>{editTarget?"Edytuj":"Nowa transakcja"}</div>

            <div style={{display:"flex",background:"rgba(255,255,255,.04)",borderRadius:14,padding:4,marginBottom:18}}>
              <button className={`tab ${txForm.type==="expense"?"on":""}`} onClick={()=>setTxForm(f=>({...f,type:"expense",category:"food"}))}>💸 Wydatek</button>
              <button className={`tab ${txForm.type==="income"?"on":""}`} onClick={()=>setTxForm(f=>({...f,type:"income",category:"uop"}))}>💰 Przychód</button>
            </div>

            {!editTarget && (
              <div style={{display:"flex",gap:8,marginBottom:14}}>
                <select className="select-box" style={{flex:2}} value={txForm.month} onChange={e=>setTxForm(f=>({...f,month:Number(e.target.value)}))}>
                  {MONTHS_FULL.map((m,i)=><option key={i} value={i}>{m}</option>)}
                </select>
                <select className="select-box" style={{flex:1}} value={txForm.year} onChange={e=>setTxForm(f=>({...f,year:Number(e.target.value)}))}>
                  {YEARS.map(y=><option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            )}

            {txForm.type==="income" && (txForm.category==="uop" || txForm.category==="jdg_ryczalt") && (
              <div style={{display:"flex",background:"rgba(255,255,255,.04)",borderRadius:12,padding:3,marginBottom:10}}>
                {["brutto","netto"].map(mode => (
                  <button key={mode} onClick={()=>setTxForm(f=>({...f,inputMode:mode,amount:""}))}
                    style={{flex:1,padding:"9px 6px",borderRadius:10,background:txForm.inputMode===mode?"rgba(255,255,255,.1)":"none",
                      color:txForm.inputMode===mode?"#eeeaf4":"#44445a",fontSize:12,fontWeight:600,
                      letterSpacing:".04em",textTransform:"uppercase",transition:"all .15s"}}>
                    {mode==="brutto" ? "BRUTTO (umowne)" : "NETTO (na rękę)"}
                  </button>
                ))}
              </div>
            )}

            <div className="input-box" style={{marginBottom:6}}>
              <span style={{fontSize:14,color:"#44445a",fontFamily:"monospace"}}>PLN</span>
              <input type="number" inputMode="decimal"
                placeholder={txForm.inputMode==="netto" && txForm.type==="income" && (txForm.category==="uop"||txForm.category==="jdg_ryczalt") ? "Kwota na rękę..." : "0,00"}
                value={txForm.amount} onChange={e=>setTxForm(f=>({...f,amount:e.target.value}))}
                style={{flex:1,fontSize:26,fontWeight:700,fontFamily:"monospace"}}/>
              {txForm.inputMode==="netto" && txForm.type==="income" && (txForm.category==="uop"||txForm.category==="jdg_ryczalt") && (
                <span style={{fontSize:10,color:"#22d3ee",fontWeight:700,letterSpacing:".05em",flexShrink:0}}>NETTO</span>
              )}
            </div>

            {txForm.type==="income" && (txForm.category==="uop" || txForm.category==="jdg_ryczalt") && txForm.amount && (() => {
              const amt = parseFloat(String(txForm.amount).replace(",","."));
              if (!amt || amt <= 0) return null;
              const cat = getCat("income", txForm.category);
              const ytd = computeYtdContext(txForm.year, txForm.month);
              const isNetto = txForm.inputMode === "netto";

              if (cat.taxType === "ryczalt12" && txForm.reverseCharge) {
                const result = isNetto ? calcRyczaltFromNetto(amt, ytd.ryczaltPrzychod) : calcRyczalt(amt, ytd.ryczaltPrzychod);
                if (!result) return null;
                return (
                  <div style={{marginBottom:14,padding:"12px 14px",background:"rgba(34,211,238,.06)",borderRadius:12,fontSize:12,border:"1px solid rgba(34,211,238,.15)"}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                      <span style={{fontSize:14}}>🔄</span>
                      <span style={{color:"#22d3ee",fontWeight:700,fontSize:11,textTransform:"uppercase",letterSpacing:".07em"}}>Reverse Charge</span>
                    </div>
                    <div style={{fontSize:11,color:"#888",marginBottom:10,lineHeight:1.5}}>VAT rozlicza nabywca — kwota netto bez VAT.</div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:"4px 14px",fontFamily:"monospace"}}>
                      {isNetto && <><span style={{color:"#888"}}>Brutto (obl.)</span><span style={{color:"#eeeaf4",fontWeight:700}}>{fmtDec(result.przychod)}</span></>}
                      <span style={{color:"#888"}}>VAT (RC)</span><span style={{color:"#22d3ee",fontWeight:600}}>0 zł</span>
                      <span style={{color:"#888"}}>Zdrowotna</span><span className="violet">−{fmtDec(result.zdrow)}</span>
                      <span style={{color:"#888"}}>Ryczałt 12%</span><span className="amber">−{fmtDec(result.ryczalt)}</span>
                      <span style={{color:"#4ade80",fontWeight:600}}>Na rękę</span><span className="green" style={{fontWeight:700}}>{fmtDec(result.netto)}</span>
                    </div>
                  </div>
                );
              }

              let result;
              if (cat.taxType === "uop") {
                result = isNetto ? calcUoPFromNetto(amt, ytd.uopPitBase) : calcUoP(amt, ytd.uopPitBase);
              } else {
                result = isNetto ? calcRyczaltFromNetto(amt, ytd.ryczaltPrzychod) : calcRyczalt(amt, ytd.ryczaltPrzychod);
              }
              if (!result) return null;
              return (
                <div style={{marginBottom:14,padding:"12px 14px",background:"rgba(167,139,250,.06)",borderRadius:12,fontSize:12}}>
                  <div style={{color:"#a78bfa",fontWeight:600,marginBottom:8,fontSize:11,textTransform:"uppercase",letterSpacing:".07em"}}>
                    {isNetto ? "Przeliczam z netto:" : "Z brutto liczę:"}
                  </div>
                  {cat.taxType === "uop" && (
                    <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:"4px 14px",fontFamily:"monospace"}}>
                      {isNetto && <><span style={{color:"#22d3ee"}}>Brutto (obl.)</span><span style={{color:"#22d3ee",fontWeight:700}}>{fmtDec(result.brutto)}</span></>}
                      <span style={{color:"#888"}}>ZUS społ.</span><span className="violet">−{fmtDec(result.zusSpol)}</span>
                      <span style={{color:"#888"}}>Zdrowotna</span><span className="violet">−{fmtDec(result.zdrow)}</span>
                      <span style={{color:"#888"}}>PIT</span><span className="amber">−{fmtDec(result.pit)}</span>
                      <span style={{color:"#4ade80",fontWeight:600}}>Na rękę</span><span className="green" style={{fontWeight:700}}>{fmtDec(result.netto)}</span>
                    </div>
                  )}
                  {cat.taxType === "ryczalt12" && (
                    <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:"4px 14px",fontFamily:"monospace"}}>
                      {isNetto && <><span style={{color:"#22d3ee"}}>Przychód (obl.)</span><span style={{color:"#22d3ee",fontWeight:700}}>{fmtDec(result.przychod)}</span></>}
                      <span style={{color:"#888"}}>Zdrowotna</span><span className="violet">−{fmtDec(result.zdrow)}</span>
                      <span style={{color:"#888"}}>Ryczałt 12%</span><span className="amber">−{fmtDec(result.ryczalt)}</span>
                      <span style={{color:"#4ade80",fontWeight:600}}>Na rękę</span><span className="green" style={{fontWeight:700}}>{fmtDec(result.netto)}</span>
                    </div>
                  )}
                </div>
              );
            })()}

            <div style={{fontSize:11,color:"#44445a",marginBottom:8,textTransform:"uppercase",letterSpacing:".08em",marginTop:8}}>Kategoria</div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14}}>
              {(txForm.type==="income"?CAT_INCOME:CAT_EXPENSE).map(c=>(
                <div key={c.id} className={`cat-chip ${txForm.category===c.id?(txForm.type==="income"?"sel-inc":"sel-exp"):""}`} onClick={()=>setTxForm(f=>({...f,category:c.id, reverseCharge: c.id!=="jdg_ryczalt" ? false : f.reverseCharge}))}>
                  <span style={{fontSize:18}}>{c.icon}</span>{c.label}
                </div>
              ))}
            </div>

            {txForm.type==="income" && txForm.category==="jdg_ryczalt" && (
              <div onClick={()=>setTxForm(f=>({...f,reverseCharge:!f.reverseCharge}))} style={{marginBottom:14,padding:"13px 16px",borderRadius:14,border: txForm.reverseCharge ? "1.5px solid rgba(34,211,238,.45)" : "1.5px solid rgba(255,255,255,.08)",background: txForm.reverseCharge ? "rgba(34,211,238,.07)" : "rgba(255,255,255,.03)",cursor:"pointer",display:"flex",alignItems:"center",gap:12,transition:"all .2s"}}>
                <div style={{width:44, height:26, borderRadius:13,background: txForm.reverseCharge ? "#22d3ee" : "rgba(255,255,255,.1)",position:"relative", flexShrink:0, transition:"background .2s"}}>
                  <div style={{position:"absolute", top:3,left: txForm.reverseCharge ? 21 : 3,width:20, height:20, borderRadius:10,background:"#fff",transition:"left .2s",boxShadow:"0 1px 4px rgba(0,0,0,.4)"}}/>
                </div>
                <div>
                  <div style={{fontSize:13,fontWeight:600,color:txForm.reverseCharge?"#22d3ee":"#888"}}>Reverse Charge</div>
                  <div style={{fontSize:11,color:"#555",marginTop:2,lineHeight:1.4}}>{txForm.reverseCharge ? "Kwota = netto · VAT rozlicza nabywca" : "Włącz jeśli VAT płaci klient"}</div>
                </div>
              </div>
            )}

            <div className="input-box" style={{marginBottom:20}}>
              <input type="text" placeholder="Notatka (opcjonalnie)" value={txForm.note} onChange={e=>setTxForm(f=>({...f,note:e.target.value}))} style={{flex:1,fontSize:15}}/>
            </div>

            <button className="btn-primary" onClick={submitTx} style={{background:txForm.type==="income"?"linear-gradient(135deg,#4ade80,#22c55e)":"linear-gradient(135deg,#f87171,#ef4444)"}}>
              {editTarget?"Zapisz":"Dodaj"}
            </button>
          </div>
        </div>
      )}

      {modal==="addRecur" && (
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget){setModal(null);setEditTarget(null);}}}>
          <div className="modal">
            <div className="drag-handle"/>
            <div style={{fontSize:17,fontWeight:700,marginBottom:18}}>{editTarget?"Edytuj":"Nowy stały wydatek"}</div>

            <div style={{fontSize:11,color:"#44445a",marginBottom:8,textTransform:"uppercase",letterSpacing:".08em"}}>Ikona</div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14}}>
              {["📄","🏠","🚗","📱","💡","🌊","🏥","🎓","🐕","💳","🛡️","🎵"].map(icon=>(
                <div key={icon} className={`icon-chip ${recurForm.icon===icon?"sel":""}`} onClick={()=>setRecurForm(f=>({...f,icon}))}>{icon}</div>
              ))}
            </div>

            <div className="input-box" style={{marginBottom:12}}>
              <input type="text" placeholder="Nazwa" value={recurForm.label} onChange={e=>setRecurForm(f=>({...f,label:e.target.value}))} style={{flex:1,fontSize:15}}/>
            </div>

            <div className="input-box" style={{marginBottom:12}}>
              <span style={{fontSize:13,color:"#44445a",fontFamily:"monospace"}}>PLN</span>
              <input type="number" inputMode="decimal" placeholder="Kwota" value={recurForm.amount} onChange={e=>setRecurForm(f=>({...f,amount:e.target.value}))} style={{flex:1,fontSize:20,fontWeight:700,fontFamily:"monospace"}}/>
            </div>

            <div style={{fontSize:11,color:"#44445a",marginBottom:8,textTransform:"uppercase",letterSpacing:".08em"}}>Kategoria</div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14}}>
              {CAT_EXPENSE.map(c=>(
                <div key={c.id} className={`cat-chip ${recurForm.category===c.id?"sel-exp":""}`} onClick={()=>setRecurForm(f=>({...f,category:c.id}))}>
                  <span style={{fontSize:18}}>{c.icon}</span>{c.label}
                </div>
              ))}
            </div>

            <div style={{fontSize:11,color:"#44445a",marginBottom:8,textTransform:"uppercase",letterSpacing:".08em"}}>Obowiązuje od</div>
            <div style={{display:"flex",gap:8,marginBottom:20}}>
              <select className="select-box" style={{flex:2}} value={recurForm.startMonth} onChange={e=>setRecurForm(f=>({...f,startMonth:Number(e.target.value)}))}>
                {MONTHS_FULL.map((m,i)=><option key={i} value={i}>{m}</option>)}
              </select>
              <select className="select-box" style={{flex:1}} value={recurForm.startYear} onChange={e=>setRecurForm(f=>({...f,startYear:Number(e.target.value)}))}>
                {YEARS.map(y=><option key={y} value={y}>{y}</option>)}
              </select>
            </div>

            <button className="btn-primary" onClick={submitRecur} style={{background:"linear-gradient(135deg,#2dd4bf,#14b8a6)"}}>
              {editTarget?"Zapisz":"Dodaj"}
            </button>
          </div>
        </div>
      )}

      {(modal==="addGoal"||modal==="editGoal") && (
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget){setModal(null);setEditTarget(null);}}}>
          <div className="modal">
            <div className="drag-handle"/>
            <div style={{fontSize:17,fontWeight:700,marginBottom:18}}>{editTarget?"Edytuj cel":"Nowy cel"}</div>

            <div style={{fontSize:11,color:"#44445a",marginBottom:8,textTransform:"uppercase",letterSpacing:".08em"}}>Ikona</div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14}}>
              {GOAL_ICONS.map(icon=>(
                <div key={icon} className={`icon-chip ${goalForm.icon===icon?"sel":""}`} onClick={()=>setGoalForm(f=>({...f,icon}))}>{icon}</div>
              ))}
            </div>

            <div className="input-box" style={{marginBottom:12}}>
              <input type="text" placeholder="Nazwa celu" value={goalForm.name} onChange={e=>setGoalForm(f=>({...f,name:e.target.value}))} style={{flex:1,fontSize:15}}/>
            </div>

            <div className="input-box" style={{marginBottom:12}}>
              <span style={{fontSize:13,color:"#44445a",fontFamily:"monospace"}}>PLN</span>
              <input type="number" inputMode="decimal" placeholder="Docelowo" value={goalForm.target} onChange={e=>setGoalForm(f=>({...f,target:e.target.value}))} style={{flex:1,fontSize:20,fontWeight:700,fontFamily:"monospace"}}/>
            </div>

            {!editTarget && (
              <div className="input-box" style={{marginBottom:12}}>
                <span style={{fontSize:13,color:"#44445a",fontFamily:"monospace"}}>PLN</span>
                <input type="number" inputMode="decimal" placeholder="Już odłożono" value={goalForm.saved} onChange={e=>setGoalForm(f=>({...f,saved:e.target.value}))} style={{flex:1,fontSize:20,fontWeight:700,fontFamily:"monospace"}}/>
              </div>
            )}

            <div style={{fontSize:11,color:"#44445a",marginBottom:8,textTransform:"uppercase",letterSpacing:".08em"}}>Deadline (opc.)</div>
            <div className="input-box" style={{marginBottom:20}}>
              <input type="date" value={goalForm.deadline} onChange={e=>setGoalForm(f=>({...f,deadline:e.target.value}))} style={{flex:1,fontSize:15,colorScheme:"dark"}}/>
            </div>

            <button className="btn-primary" onClick={submitGoal} style={{background:"linear-gradient(135deg,#f59e0b,#fbbf24)",color:"#000"}}>
              {editTarget?"Zapisz":"Utwórz"}
            </button>
          </div>
        </div>
      )}

      {modal==="addSaving" && (
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setModal(null);}}>
          <div className="modal">
            <div className="drag-handle"/>
            <div style={{fontSize:17,fontWeight:700,marginBottom:18}}>Wpłata do celu</div>

            <select className="select-box" style={{marginBottom:14}} value={savingForm.goalId} onChange={e=>setSavingForm(f=>({...f,goalId:e.target.value}))}>
              <option value="">Wybierz cel...</option>
              {goals.map(g=><option key={g.id} value={String(g.id)}>{g.icon} {g.name}</option>)}
            </select>

            <div className="input-box" style={{marginBottom:20}}>
              <span style={{fontSize:13,color:"#44445a",fontFamily:"monospace"}}>PLN</span>
              <input type="number" inputMode="decimal" placeholder="Kwota" value={savingForm.amount} onChange={e=>setSavingForm(f=>({...f,amount:e.target.value}))} style={{flex:1,fontSize:26,fontWeight:700,fontFamily:"monospace"}}/>
            </div>

            <button className="btn-primary" onClick={submitSaving} style={{background:"linear-gradient(135deg,#f59e0b,#fbbf24)",color:"#000"}}>
              Dodaj wpłatę
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
