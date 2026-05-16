"use client";
import { useState, useEffect, useRef } from "react";
import { encryptBackup, decryptBackup, generatePassword, getLastBackupDate, setLastBackupDate, isBackupDue } from "./backup";

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
  if (yearTotal <= T.ZDROW_RYCZALT.THRESHOLD_1) zdrow = T.ZDROW_RYCZALT.AMOUNT_1;
  else if (yearTotal <= T.ZDROW_RYCZALT.THRESHOLD_2) zdrow = T.ZDROW_RYCZALT.AMOUNT_2;
  else zdrow = T.ZDROW_RYCZALT.AMOUNT_3;
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

const MONTHS_SHORT = ["Sty","Lut","Mar","Kwi","Maj","Cze","Lip","Sie","Wrz","Paz","Lis","Gru"];
const MONTHS_FULL = ["Styczen","Luty","Marzec","Kwiecien","Maj","Czerwiec","Lipiec","Sierpien","Wrzesien","Pazdziernik","Listopad","Grudzien"];
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
  {id:"clothing",label:"Odziez",icon:"👗"},
  {id:"subscriptions",label:"Subskrypcje",icon:"📱"},
  {id:"other_ex",label:"Inne",icon:"💸"},
];
const GOAL_ICONS = ["🏠","🚗","✈️","💻","📱","🎓","💍","🏖️","🎸","⛵","🏋️","💰"];

const fmt = (n) => new Intl.NumberFormat("pl-PL",{style:"currency",currency:"PLN",minimumFractionDigits:0,maximumFractionDigits:0}).format(n);
const fmtDec = (n) => new Intl.NumberFormat("pl-PL",{style:"currency",currency:"PLN",minimumFractionDigits:2}).format(n);
const load = (key, def) => {
  if (typeof window === "undefined") return def;
  try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : def; } catch { return def; }
};
const save = (key, val) => { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} };
const monthKey = (y, m) => `${y}-${String(m).padStart(2,"0")}`;
const getCat = (type, id) => (type==="income"?CAT_INCOME:CAT_EXPENSE).find(c=>c.id===id)||{label:id,icon:"•"};

export default function App() {
  const now = new Date();
  const [isMobile, setIsMobile] = useState(false);
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
  const [backupPassword, setBackupPassword] = useState(() => load("fin3_backup_pwd", ""));
  const [backupStatus, setBackupStatus] = useState("");
  const [backupLoading, setBackupLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [lastBackup, setLastBackup] = useState(() => getLastBackupDate());
  const [showRestoreInput, setShowRestoreInput] = useState(false);
  const [restoreText, setRestoreText] = useState("");
  const [restorePassword, setRestorePassword] = useState("");
  const fileInputRef = useRef(null);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => save("fin3_tx", txData), [txData]);
  useEffect(() => save("fin3_recur", recurring), [recurring]);
  useEffect(() => save("fin3_goals", goals), [goals]);
  useEffect(() => save("fin3_backup_pwd", backupPassword), [backupPassword]);

  useEffect(() => {
    if (backupPassword && isBackupDue()) {
      setBackupStatus("⚠️ Czas na backup!");
    }
  }, [backupPassword]);

  const getBackupData = () => ({ txData, recurring, goals });

  const handleBackup = async () => {
    if (!backupPassword) {
      setBackupStatus("❌ Ustaw haslo backup!");
      return;
    }
    setBackupLoading(true);
    setBackupStatus("");
    try {
      const encrypted = await encryptBackup(getBackupData(), backupPassword);
      const blob = new Blob([encrypted], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const date = new Date().toISOString().slice(0,10);
      a.href = url;
      a.download = `finance-backup-${date}.enc`;
      a.click();
      URL.revokeObjectURL(url);
      setLastBackupDate();
      setLastBackup(new Date().toISOString());
      setBackupStatus("✅ Backup pobrany!");
    } catch (e) {
      setBackupStatus("❌ Blad: " + e.message);
    }
    setBackupLoading(false);
  };

  const handleRestore = async () => {
    if (!restoreText || !restorePassword) {
      setBackupStatus("❌ Wklej dane i haslo");
      return;
    }
    setBackupLoading(true);
    setBackupStatus("");
    try {
      const result = await decryptBackup(restoreText.trim(), restorePassword);
      if (!result || !result.data) throw new Error("Niepoprawne dane");
      const { txData: td, recurring: rc, goals: gl } = result.data;
      if (td) setTxData(td);
      if (rc) setRecurring(rc);
      if (gl) setGoals(gl);
      setBackupStatus("✅ Dane przywrocone!");
      setShowRestoreInput(false);
      setRestoreText("");
      setRestorePassword("");
    } catch (e) {
      setBackupStatus("❌ Blad: Niepoprawne haslo");
    }
    setBackupLoading(false);
  };

  const handleFileRestore = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setRestoreText(ev.target.result);
      setShowRestoreInput(true);
    };
    reader.readAsText(file);
  };

  const handleGeneratePassword = () => {
    const pwd = generatePassword(20);
    setBackupPassword(pwd);
    setShowPassword(true);
    setBackupStatus("⚠️ Zapisz to haslo!");
  };

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
        if (cat.taxType === "ryczalt12") ryczaltPrzychod += e.amount;
      });
    }
    return { uopPitBase, ryczaltPrzychod };
  };

  const computeMonthSummary = (year, month) => {
    const entries = getMonthEntries(year, month);
    const ytd = computeYtdContext(year, month);
    let bruttoUoP = 0, nettoUoP = 0, zusUoP = 0, zdrowUoP = 0, pitUoP = 0;
    let przychodJDG = 0, nettoJDG = 0, zdrowJDG = 0, ryczaltJDG = 0;
    let inneIncome = 0, bruttoTotal = 0, nettoFromTaxed = 0;

    entries.filter(e => e.type === "income").forEach(e => {
      const cat = getCat("income", e.category);
      bruttoTotal += e.amount;
      if (cat.taxType === "uop") {
        const r = calcUoP(e.amount, ytd.uopPitBase);
        if (r) { bruttoUoP += r.brutto; nettoUoP += r.netto; zusUoP += r.zusSpol; zdrowUoP += r.zdrow; pitUoP += r.pit; nettoFromTaxed += r.netto; ytd.uopPitBase += r.pitBase; }
      } else if (cat.taxType === "ryczalt12") {
        const r = calcRyczalt(e.amount, ytd.ryczaltPrzychod);
        if (r) { przychodJDG += r.przychod; nettoJDG += r.netto; zdrowJDG += r.zdrow; ryczaltJDG += r.ryczalt; nettoFromTaxed += r.netto; ytd.ryczaltPrzychod += r.przychod; }
      } else { inneIncome += e.amount; }
    });

    const expense = entries.filter(e => e.type === "expense").reduce((s,e)=>s+e.amount,0);
    const realIncome = nettoFromTaxed + inneIncome;
    const net = realIncome - expense;
    return { entries, expense, bruttoUoP, nettoUoP, zusUoP, zdrowUoP, pitUoP, przychodJDG, nettoJDG, zdrowJDG, ryczaltJDG, inneIncome, bruttoTotal, realIncome, net, ytd };
  };

  const mKey = monthKey(selYear, selMonth);
  const summary = computeMonthSummary(selYear, selMonth);

  const computeYearTax = (year) => {
    let totalUopBrutto=0,totalUopNetto=0,totalUopZus=0,totalUopZdrow=0,totalUopPit=0;
    let totalJdgPrzychod=0,totalJdgNetto=0,totalJdgZdrow=0,totalJdgRyczalt=0;
    for (let m=0;m<12;m++) {
      const s = computeMonthSummary(year,m);
      totalUopBrutto+=s.bruttoUoP; totalUopNetto+=s.nettoUoP; totalUopZus+=s.zusUoP; totalUopZdrow+=s.zdrowUoP; totalUopPit+=s.pitUoP;
      totalJdgPrzychod+=s.przychodJDG; totalJdgNetto+=s.nettoJDG; totalJdgZdrow+=s.zdrowJDG; totalJdgRyczalt+=s.ryczaltJDG;
    }
    return { totalUopBrutto,totalUopNetto,totalUopZus,totalUopZdrow,totalUopPit, totalJdgPrzychod,totalJdgNetto,totalJdgZdrow,totalJdgRyczalt, totalTax:totalUopPit+totalJdgRyczalt, totalSkladki:totalUopZus+totalUopZdrow+totalJdgZdrow };
  };
  const yearTax = computeYearTax(selYear);

  const computeForecast = () => {
    let pitSum=0,ryczaltSum=0,monthsCount=0;
    for (let i=1;i<=3;i++) {
      let m=now.getMonth()-i,y=now.getFullYear();
      while(m<0){m+=12;y--;}
      const s=computeMonthSummary(y,m);
      if(s.bruttoUoP>0||s.przychodJDG>0){pitSum+=s.pitUoP;ryczaltSum+=s.ryczaltJDG;monthsCount++;}
    }
    if(monthsCount===0) return null;
    return { avgPit:pitSum/monthsCount, avgRyczalt:ryczaltSum/monthsCount, total:(pitSum+ryczaltSum)/monthsCount };
  };
  const forecast = computeForecast();

  const totalBalance = (() => {
    let total=0;
    [2024,2025,2026,2027].forEach(y=>{for(let m=0;m<12;m++){const s=computeMonthSummary(y,m);total+=s.net;}});
    return total;
  })();

  const submitTx = () => {
    const amt = parseFloat(String(txForm.amount).replace(",","."));
    if(!amt||amt<=0) return;
    const k = monthKey(txForm.year,txForm.month);
    const cat = getCat("income",txForm.category);
    let bruttoAmt = amt;
    if(txForm.inputMode==="netto"&&txForm.type==="income"&&cat.isTaxed) {
      const ytd = computeYtdContext(txForm.year,txForm.month);
      let r = null;
      if(cat.taxType==="uop") r=calcUoPFromNetto(amt,ytd.uopPitBase);
      else if(cat.taxType==="ryczalt12") r=calcRyczaltFromNetto(amt,ytd.ryczaltPrzychod);
      if(r) bruttoAmt = cat.taxType==="uop" ? r.brutto : r.przychod;
    }
    if(editTarget) {
      setTxData(prev=>({...prev,[k]:(prev[k]||[]).map(e=>e.id===editTarget.id?{...e,amount:bruttoAmt,category:txForm.category,note:txForm.note,type:txForm.type,reverseCharge:txForm.reverseCharge}:e)}));
    } else {
      const entry={id:Date.now(),type:txForm.type,amount:bruttoAmt,category:txForm.category,note:txForm.note,date:new Date().toISOString(),reverseCharge:txForm.reverseCharge};
      setTxData(prev=>({...prev,[k]:[...(prev[k]||[]),entry]}));
    }
    setModal(null); setEditTarget(null);
  };

  const deleteTx = (entry) => {
    if(entry.isRecurring) { setTxData(prev=>({...prev,[mKey+"_skip"]:[...(prev[mKey+"_skip"]||[]),entry.recurId]})); }
    else { setTxData(prev=>({...prev,[mKey]:(prev[mKey]||[]).filter(e=>e.id!==entry.id)})); }
  };

  const submitRecur = () => {
    const amt=parseFloat(String(recurForm.amount).replace(",","."));
    if(!amt||amt<=0||!recurForm.label) return;
    if(editTarget) { setRecurring(prev=>prev.map(r=>r.id===editTarget.id?{...r,...recurForm,amount:amt}:r)); }
    else { setRecurring(prev=>[...prev,{...recurForm,amount:amt,id:Date.now()}]); }
    setModal(null); setEditTarget(null);
    setRecurForm({label:"",amount:"",category:"bills",icon:"📄",startYear:now.getFullYear(),startMonth:now.getMonth()});
  };
  const deleteRecur = (id) => setRecurring(prev=>prev.filter(r=>r.id!==id));

  const submitGoal = () => {
    const target=parseFloat(String(goalForm.target).replace(",","."));
    const saved=parseFloat(String(goalForm.saved).replace(",","."))||0;
    if(!target||target<=0||!goalForm.name) return;
    if(editTarget) { setGoals(prev=>prev.map(g=>g.id===editTarget.id?{...g,...goalForm,target,saved:g.saved}:g)); }
    else { setGoals(prev=>[...prev,{...goalForm,target,saved,id:Date.now(),history:[]}]); }
    setModal(null); setEditTarget(null);
    setGoalForm({name:"",icon:"🏠",target:"",saved:"",deadline:""});
  };

  const submitSaving = () => {
    const amt=parseFloat(String(savingForm.amount).replace(",","."));
    if(!amt||amt<=0) return;
    setGoals(prev=>prev.map(g=>g.id===Number(savingForm.goalId)?{...g,saved:g.saved+amt,history:[...(g.history||[]),{date:new Date().toISOString(),amount:amt}]}:g));
    setModal(null); setSavingForm({goalId:"",amount:""});
  };
  const deleteGoal = (id) => setGoals(prev=>prev.filter(g=>g.id!==id));

  const openEditTx = (entry) => {
    if(entry.isRecurring) return;
    setEditTarget(entry);
    setTxForm({type:entry.type,amount:String(entry.amount),category:entry.category,note:entry.note||"",year:selYear,month:selMonth,reverseCharge:entry.reverseCharge||false,inputMode:"brutto"});
    setModal("addTx");
  };
  const openEditRecur = (r) => { setEditTarget(r); setRecurForm({label:r.label,amount:String(r.amount),category:r.category,icon:r.icon,startYear:r.startYear,startMonth:r.startMonth}); setModal("addRecur"); };
  const openEditGoal = (g) => { setEditTarget(g); setGoalForm({name:g.name,icon:g.icon,target:String(g.target),saved:String(g.saved),deadline:g.deadline||""}); setModal("editGoal"); };

  const barData = Array.from({length:6},(_,i)=>{ let m=now.getMonth()-5+i,y=now.getFullYear(); while(m<0){m+=12;y--;} const s=computeMonthSummary(y,m); return{label:MONTHS_SHORT[m],inc:s.realIncome,exp:s.expense}; });
  const barMax = Math.max(...barData.flatMap(b=>[b.inc,b.exp]),1);
  const monthGrid = Array.from({length:12},(_,m)=>{ const s=computeMonthSummary(selYear,m); return{m,net:s.net,hasData:s.entries.length>0}; });

  const sidebarItems = [
    {id:"dashboard",icon:"◎",label:"Główna"},
    {id:"month",icon:"≡",label:"Miesiąc"},
    {id:"taxes",icon:"🧾",label:"Podatki"},
    {id:"recurring",icon:"🔄",label:"Stałe"},
    {id:"goals",icon:"🎯",label:"Cele"},
    {id:"backup",icon:"🔐",label:"Backup"},
  ];

  return (
    <div style={{minHeight:"100vh",background:"#08080e",fontFamily:"Sora, sans-serif",color:"#eeeaf4",display:"flex"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent;}
        ::-webkit-scrollbar{width:8px;}
        ::-webkit-scrollbar-track{background:rgba(255,255,255,.05);}
        ::-webkit-scrollbar-thumb{background:rgba(255,255,255,.2);border-radius:4px;}
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
        .input-box{background:rgba(255,255,255,.05);border-radius:14px;padding:14px 16px;border:1px solid rgba(255,255,255,.08);display:flex;align-items:center;gap:10px;}
        .input-box input{flex:1;font-size:15px;}
        .select-box{background:rgba(255,255,255,.05);border-radius:14px;padding:14px 16px;border:1px solid rgba(255,255,255,.08);width:100%;color:#eeeaf4;font-size:14px;-webkit-appearance:none;appearance:none;}
        .btn-primary{width:100%;padding:17px;border-radius:16px;font-size:15px;font-weight:700;letter-spacing:.02em;color:#fff;transition:all .15s;}
        .modal-bg{position:fixed;inset:0;background:rgba(0,0,0,.7);backdrop-filter:blur(6px);z-index:200;display:flex;align-items:center;justify-content:center;}
        .modal{background:#111119;border-radius:20px;width:95%;max-width:500px;max-height:90vh;overflow-y:auto;padding:24px;border:1px solid rgba(255,255,255,.08);}
        @media(max-width:767px){
          .modal{width:100%;border-radius:28px 28px 0 0;position:fixed;bottom:0;max-height:90vh;}
        }
        .drag-handle{width:40px;height:4px;background:rgba(255,255,255,.15);border-radius:2px;margin:0 auto 20px;}
      `}</style>

      {/* DESKTOP SIDEBAR */}
      {!isMobile && (
        <div style={{width:240,background:"rgba(0,0,0,.4)",borderRight:"1px solid rgba(255,255,255,.08)",padding:"24px 16px",position:"fixed",height:"100vh",overflow:"auto"}}>
          <div style={{fontSize:20,fontWeight:800,marginBottom:32,color:"#eeeaf4"}}>💰 Finance</div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {sidebarItems.map(item=>(
              <button key={item.id} onClick={()=>setTab(item.id)} style={{
                padding:"14px 16px",borderRadius:12,background:tab===item.id?"rgba(125,211,252,.15)":"transparent",
                border:tab===item.id?"1px solid rgba(125,211,252,.3)":"1px solid transparent",
                color:tab===item.id?"#7dd3fc":"#888",fontSize:14,fontWeight:tab===item.id?600:500,
                display:"flex",alignItems:"center",gap:10,transition:"all .2s",cursor:"pointer",textAlign:"left"
              }}>
                <span style={{fontSize:18}}>{item.icon}</span>{item.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* MAIN CONTENT */}
      <div style={{flex:1,marginLeft:isMobile?0:240,paddingBottom:isMobile?110:0,position:"relative",minHeight:"100vh"}}>
        
        {/* DASHBOARD */}
        {tab==="dashboard" && (
          <div style={{padding:isMobile?"0 0 110px":"40px"}}>
            <div style={{maxWidth:1200,margin:"0 auto"}}>
              <div style={{marginBottom:32}}>
                <div style={{fontSize:isMobile?11:14,color:"#44445a",letterSpacing:".1em",textTransform:"uppercase",marginBottom:8}}>Całkowite saldo</div>
                <div style={{fontSize:isMobile?36:56,fontWeight:800,letterSpacing:"-0.04em",color:totalBalance>=0?"#eeeaf4":"#f87171",lineHeight:1}}>{fmt(totalBalance)}</div>
                <div style={{marginTop:8,fontSize:isMobile?11:13,color:"#44445a"}}>uwzględnia ZUS, zdrowotną, PIT i ryczałt</div>
              </div>

              {backupPassword && isBackupDue() && (
                <div onClick={()=>setTab("backup")} style={{marginBottom:20,padding:"14px 18px",background:"rgba(251,191,36,.08)",borderRadius:14,fontSize:isMobile?12:14,color:"#fbbf24",display:"flex",alignItems:"center",gap:8,cursor:"pointer",border:"1px solid rgba(251,191,36,.2)"}}>
                  <span>⚠️</span><span>Czas na tygodniowy backup!</span>
                </div>
              )}

              <div style={{display:isMobile?"block":"grid",gridTemplateColumns:"1fr 1fr",gap:20,marginBottom:20}}>
                {/* Current month card */}
                <div className="card" style={{padding:"20px",cursor:"pointer"}} onClick={()=>setTab("month")}>
                  <div style={{fontSize:isMobile?13:15,fontWeight:600,marginBottom:12}}>Bieżący miesiąc</div>
                  {(()=>{ const s=computeMonthSummary(now.getFullYear(),now.getMonth()); return (
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
                      {[{label:"Na rękę",val:s.realIncome,cls:"green"},{label:"Wydatki",val:s.expense,cls:"red"},{label:"Bilans",val:s.net,cls:s.net>=0?"blue":"red"}].map(x=>(
                        <div key={x.label} style={{background:"rgba(0,0,0,.35)",borderRadius:12,padding:"10px 8px",textAlign:"center"}}>
                          <div style={{fontSize:isMobile?8:9,color:"#44445a",textTransform:"uppercase",letterSpacing:".08em",marginBottom:4}}>{x.label}</div>
                          <div className={x.cls} style={{fontSize:isMobile?12:14,fontWeight:700}}>{fmt(x.val)}</div>
                        </div>
                      ))}
                    </div>
                  ); })()}
                </div>

                {/* Forecast */}
                {forecast && forecast.total>0 && (
                  <div className="card" style={{padding:"20px"}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
                      <span style={{fontSize:isMobile?16:20}}>🔮</span>
                      <span style={{fontSize:isMobile?12:14,fontWeight:600,color:"#a78bfa"}}>Prognoza</span>
                    </div>
                    <div style={{fontSize:isMobile?18:24,fontWeight:800,color:"#a78bfa",fontFamily:"monospace"}}>{fmt(forecast.total)}</div>
                    <div style={{fontSize:isMobile?10:12,color:"#44445a",marginTop:6}}>szacowana zaliczka</div>
                  </div>
                )}
              </div>

              {/* Chart */}
              <div className="card" style={{padding:"20px",marginBottom:20}}>
                <div style={{fontSize:isMobile?11:13,color:"#44445a",letterSpacing:".08em",textTransform:"uppercase",marginBottom:14}}>Ostatnie 6 miesięcy</div>
                <div style={{display:"flex",alignItems:"flex-end",gap:isMobile?3:5,height:isMobile?60:80}}>
                  {barData.map((b,i)=>(
                    <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                      <div style={{width:"100%",display:"flex",gap:1.5,alignItems:"flex-end",height:isMobile?48:64}}>
                        <div style={{flex:1,background:"rgba(74,222,128,.35)",borderRadius:"3px 3px 0 0",height:`${(b.inc/barMax)*100}%`,minHeight:b.inc>0?2:0}}/>
                        <div style={{flex:1,background:"rgba(248,113,113,.35)",borderRadius:"3px 3px 0 0",height:`${(b.exp/barMax)*100}%`,minHeight:b.exp>0?2:0}}/>
                      </div>
                      <div style={{fontSize:isMobile?8:10,color:"#44445a"}}>{b.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Month grid */}
              <div>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
                  <div style={{fontSize:isMobile?11:13,color:"#44445a",letterSpacing:".08em",textTransform:"uppercase"}}>Historia</div>
                  <div style={{display:"flex",gap:2}}>
                    {YEARS.map(y=><button key={y} onClick={()=>setSelYear(y)} style={{padding:"6px 12px",borderRadius:8,background:selYear===y?"rgba(125,211,252,.15)":"rgba(255,255,255,.04)",color:selYear===y?"#7dd3fc":"#44445a",fontSize:12,fontWeight:600}}>{y}</button>)}
                  </div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(80px,1fr))",gap:8}}>
                  {monthGrid.map(({m,net,hasData})=>{ const isCur=m===now.getMonth()&&selYear===now.getFullYear(); return (
                    <div key={m} onClick={()=>{setSelMonth(m);setTab("month");}} style={{background:isCur?"rgba(125,211,252,.07)":"rgba(255,255,255,.03)",borderRadius:12,padding:"12px 8px",border:isCur?"1px solid rgba(125,211,252,.25)":"1px solid rgba(255,255,255,.05)",cursor:"pointer",textAlign:"center",transition:"all .2s"}}>
                      <div style={{fontSize:11,fontWeight:600,marginBottom:4,color:isCur?"#7dd3fc":"#eeeaf4"}}>{MONTHS_SHORT[m]}</div>
                      {hasData?<div style={{fontSize:11,fontWeight:700,color:net>=0?"#4ade80":"#f87171"}}>{fmt(net)}</div>:<div style={{fontSize:11,color:"#2a2a40"}}>—</div>}
                    </div>
                  ); })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MONTH */}
        {tab==="month" && (
          <div style={{padding:isMobile?"56px 18px 0":"40px",maxWidth:1200,margin:"0 auto"}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
              {isMobile && <button onClick={()=>setTab("dashboard")} style={{width:36,height:36,borderRadius:12,background:"rgba(255,255,255,.07)",color:"#eeeaf4",fontSize:18}}>‹</button>}
              <div style={{flex:1,display:"flex",gap:8}}>
                <select className="select-box" style={{flex:isMobile?2:1}} value={selMonth} onChange={e=>setSelMonth(Number(e.target.value))}>
                  {MONTHS_FULL.map((mn,i)=><option key={i} value={i}>{mn}</option>)}
                </select>
                <select className="select-box" style={{flex:1}} value={selYear} onChange={e=>setSelYear(Number(e.target.value))}>
                  {YEARS.map(y=><option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr 1fr",gap:10,marginBottom:20}}>
              {[{label:"Na rękę",val:summary.realIncome,cls:"green"},{label:"Wydatki",val:summary.expense,cls:"red"},{label:"Bilans",val:summary.net,cls:summary.net>=0?"blue":"red"}].map(x=>(
                <div key={x.label} className="card" style={{padding:"14px 12px",textAlign:"center"}}>
                  <div style={{fontSize:9,color:"#44445a",textTransform:"uppercase",marginBottom:4}}>{x.label}</div>
                  <div className={x.cls} style={{fontSize:isMobile?13:15,fontWeight:700}}>{fmt(x.val)}</div>
                </div>
              ))}
            </div>
            <div style={{background:isMobile?"none":"rgba(255,255,255,.02)",borderRadius:isMobile?0:14,padding:isMobile?0:20}}>
              {summary.entries.length===0 ? (
                <div style={{textAlign:"center",padding:"50px 0",color:"#2a2a40"}}><div style={{fontSize:44,marginBottom:10}}>📋</div><div>Brak transakcji</div></div>
              ) : summary.entries.map((e,i)=>{ const cat=getCat(e.type,e.category); return (
                <div key={e.id} className="row" onClick={()=>openEditTx(e)} style={{cursor:"pointer",padding:isMobile?"13px 0":"16px 0"}}>
                  <div style={{width:42,height:42,borderRadius:13,background:e.type==="income"?"rgba(74,222,128,.1)":"rgba(248,113,113,.08)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:19,flexShrink:0}}>{cat.icon}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:isMobile?13:15,fontWeight:500,display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                      {cat.label}
                      {e.isRecurring&&<span className="pill bg-blue">STAŁY</span>}
                      {cat.isTaxed&&<span className="pill bg-violet">BRUTTO</span>}
                      {e.reverseCharge&&<span className="pill" style={{fontSize:9,background:"rgba(34,211,238,.12)",color:"#22d3ee"}}>RC</span>}
                    </div>
                    {e.note&&<div style={{fontSize:11,color:"#44445a",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.note}</div>}
                  </div>
                  <div style={{textAlign:"right",flexShrink:0}}>
                    <div style={{fontSize:isMobile?14:15,fontWeight:700,color:e.type==="income"?"#4ade80":"#f87171"}}>{e.type==="income"?"+":"-"}{fmt(e.amount)}</div>
                    <div style={{fontSize:9,color:"#2a2a40"}}>{new Date(e.date).toLocaleDateString("pl-PL")}</div>
                  </div>
                  <button onClick={ev=>{ev.stopPropagation();deleteTx(e);}} style={{width:26,height:26,borderRadius:8,background:"rgba(248,113,113,.1)",color:"#f87171",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>×</button>
                </div>
              ); })}
            </div>
            <div style={{padding:isMobile?"20px 18px 0":"20px 0 0",display:"flex",justifyContent:isMobile?"center":"flex-start"}}>
              <button onClick={()=>{setEditTarget(null);setTxForm({type:"expense",amount:"",category:"food",note:"",year:selYear,month:selMonth,reverseCharge:false,inputMode:"brutto"});setModal("addTx");}} style={{background:"linear-gradient(135deg,#2dd4bf,#14b8a6)",color:"#fff",borderRadius:16,padding:"14px 32px",fontSize:14,fontWeight:700}}>
                + Dodaj transakcję
              </button>
            </div>
          </div>
        )}

        {/* TAXES */}
        {tab==="taxes" && (
          <div style={{padding:isMobile?"56px 18px":"40px",maxWidth:1200,margin:"0 auto"}}>
            <div style={{fontSize:isMobile?18:24,fontWeight:700,marginBottom:20}}>Podatki i składki</div>
            <div style={{display:"flex",gap:6,marginBottom:20}}>
              {YEARS.map(y=><button key={y} onClick={()=>setSelYear(y)} style={{padding:"8px 14px",borderRadius:10,background:selYear===y?"rgba(167,139,250,.15)":"rgba(255,255,255,.04)",color:selYear===y?"#a78bfa":"#666",fontSize:12,fontWeight:600}}>{y}</button>)}
            </div>
            <div className="card" style={{padding:"20px",marginBottom:20}}>
              <div style={{fontSize:isMobile?12:14,color:"#a78bfa",textTransform:"uppercase",letterSpacing:".1em",marginBottom:16}}>Rok {selYear}</div>
              <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:12,marginBottom:16}}>
                <div style={{background:"rgba(167,139,250,.06)",borderRadius:13,padding:"14px"}}>
                  <div style={{fontSize:10,color:"#888",textTransform:"uppercase",marginBottom:8}}>Podatki</div>
                  <div className="amber" style={{fontSize:isMobile?18:22,fontWeight:800,fontFamily:"monospace"}}>{fmt(yearTax.totalTax)}</div>
                </div>
                <div style={{background:"rgba(167,139,250,.06)",borderRadius:13,padding:"14px"}}>
                  <div style={{fontSize:10,color:"#888",textTransform:"uppercase",marginBottom:8}}>Składki</div>
                  <div className="violet" style={{fontSize:isMobile?18:22,fontWeight:800,fontFamily:"monospace"}}>{fmt(yearTax.totalSkladki)}</div>
                </div>
              </div>
              {yearTax.totalUopBrutto>0 && (
                <div style={{marginBottom:14,padding:"14px",background:"rgba(0,0,0,.3)",borderRadius:13}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}><span>💼</span><span style={{fontSize:13,fontWeight:600}}>Umowa o pracę</span></div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:"4px 12px",fontSize:isMobile?11:12}}>
                    <div style={{color:"#888"}}>Brutto</div><div style={{fontFamily:"monospace",fontWeight:600,textAlign:"right"}}>{fmtDec(yearTax.totalUopBrutto)}</div>
                    <div style={{color:"#888"}}>ZUS społeczne</div><div className="violet" style={{fontFamily:"monospace",fontWeight:600,textAlign:"right"}}>{fmtDec(yearTax.totalUopZus)}</div>
                    <div style={{color:"#888"}}>Zdrowotna</div><div className="violet" style={{fontFamily:"monospace",fontWeight:600,textAlign:"right"}}>{fmtDec(yearTax.totalUopZdrow)}</div>
                    <div style={{color:"#888"}}>PIT</div><div className="amber" style={{fontFamily:"monospace",fontWeight:600,textAlign:"right"}}>{fmtDec(yearTax.totalUopPit)}</div>
                    <div style={{color:"#4ade80",fontWeight:600}}>Na rękę</div><div className="green" style={{fontFamily:"monospace",fontWeight:700,textAlign:"right"}}>{fmtDec(yearTax.totalUopNetto)}</div>
                  </div>
                </div>
              )}
              {yearTax.totalJdgPrzychod>0 && (
                <div style={{padding:"14px",background:"rgba(0,0,0,.3)",borderRadius:13}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}><span>📈</span><span style={{fontSize:13,fontWeight:600}}>JDG – ryczałt 12%</span></div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:"4px 12px",fontSize:isMobile?11:12}}>
                    <div style={{color:"#888"}}>Przychód</div><div style={{fontFamily:"monospace",fontWeight:600,textAlign:"right"}}>{fmtDec(yearTax.totalJdgPrzychod)}</div>
                    <div style={{color:"#888"}}>Zdrowotna</div><div className="violet" style={{fontFamily:"monospace",fontWeight:600,textAlign:"right"}}>{fmtDec(yearTax.totalJdgZdrow)}</div>
                    <div style={{color:"#888"}}>Ryczałt 12%</div><div className="amber" style={{fontFamily:"monospace",fontWeight:600,textAlign:"right"}}>{fmtDec(yearTax.totalJdgRyczalt)}</div>
                    <div style={{color:"#4ade80",fontWeight:600}}>Na rękę</div><div className="green" style={{fontFamily:"monospace",fontWeight:700,textAlign:"right"}}>{fmtDec(yearTax.totalJdgNetto)}</div>
                  </div>
                  <div style={{marginTop:10,padding:"8px 12px",background:"rgba(74,222,128,.06)",borderRadius:10,fontSize:11,color:"#4ade80"}}>✓ Zwolniony z ZUS</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* BACKUP */}
        {tab==="backup" && (
          <div style={{padding:isMobile?"56px 18px":"40px",maxWidth:800,margin:"0 auto"}}>
            <div style={{fontSize:isMobile?18:24,fontWeight:700,marginBottom:10}}>Backup danych</div>
            <div style={{fontSize:isMobile?11:13,color:"#44445a",marginBottom:24}}>Szyfrowanie AES-256</div>

            {backupStatus && (
              <div style={{padding:"12px 16px",borderRadius:14,background:backupStatus.startsWith("✅")?"rgba(74,222,128,.08)":backupStatus.startsWith("⚠️")?"rgba(251,191,36,.08)":"rgba(248,113,113,.08)",border:backupStatus.startsWith("✅")?"1px solid rgba(74,222,128,.2)":backupStatus.startsWith("⚠️")?"1px solid rgba(251,191,36,.2)":"1px solid rgba(248,113,113,.2)",fontSize:isMobile?12:13,color:backupStatus.startsWith("✅")?"#4ade80":backupStatus.startsWith("⚠️")?"#fbbf24":"#f87171",marginBottom:20}}>
                {backupStatus}
              </div>
            )}

            <div className="card" style={{padding:"16px 18px",marginBottom:20}}>
              <div style={{fontSize:11,color:"#44445a",textTransform:"uppercase",letterSpacing:".08em",marginBottom:8}}>Ostatni backup</div>
              <div style={{fontSize:isMobile?14:15,fontWeight:600,color:lastBackup?"#4ade80":"#f87171"}}>
                {lastBackup ? new Date(lastBackup).toLocaleDateString("pl-PL",{day:"2-digit",month:"2-digit",year:"numeric"}) : "Brak backupu"}
              </div>
            </div>

            <div className="card" style={{padding:"18px",marginBottom:20}}>
              <div style={{fontSize:13,fontWeight:600,marginBottom:8}}>🔑 Hasło szyfrowania</div>
              <div className="input-box" style={{marginBottom:14}}>
                <input type={showPassword?"text":"password"} placeholder="Wpisz lub wygeneruj hasło..." value={backupPassword} onChange={e=>setBackupPassword(e.target.value)} style={{flex:1,fontSize:14}}/>
                <button onClick={()=>setShowPassword(p=>!p)} style={{background:"none",color:"#666",fontSize:18}}>  {showPassword?"🙈":"👁️"}</button>
              </div>
              <button onClick={handleGeneratePassword} style={{width:"100%",padding:"12px",borderRadius:13,background:"rgba(125,211,252,.1)",color:"#7dd3fc",fontSize:13,fontWeight:600,marginBottom:12}}>
                🎲 Wygeneruj silne hasło
              </button>
              {backupPassword && <div style={{padding:"10px 12px",background:"rgba(251,191,36,.06)",borderRadius:10,fontSize:11,color:"#fbbf24"}}>⚠️ Zapisz hasło w bezpiecznym miejscu</div>}
            </div>

            <div className="card" style={{padding:"18px"}}>
              <div style={{fontSize:13,fontWeight:600,marginBottom:8}}>💾 Wykonaj backup</div>
              <button onClick={handleBackup} disabled={backupLoading||!backupPassword} style={{width:"100%",padding:"15px",borderRadius:14,background:backupPassword?"linear-gradient(135deg,#4ade80,#22c55e)":"rgba(255,255,255,.05)",color:backupPassword?"#000":"#444",fontSize:14,fontWeight:700,marginBottom:12,opacity:backupLoading?0.7:1}}>
                {backupLoading?"Szyfrowanie...":"⬇️ Pobierz backup"}
              </button>
              <input type="file" ref={fileInputRef} accept=".enc,.txt" onChange={handleFileRestore} style={{display:"none"}}/>
              <button onClick={()=>fileInputRef.current?.click()} style={{width:"100%",padding:"13px",borderRadius:13,background:"rgba(125,211,252,.08)",color:"#7dd3fc",fontSize:13,fontWeight:600}}>
                📂 Wgraj plik backupu
              </button>
              {showRestoreInput && (
                <>
                  <div style={{fontSize:11,color:"#4ade80",marginTop:12,marginBottom:10}}>✅ Plik wczytany. Podaj hasło:</div>
                  <div className="input-box" style={{marginBottom:12}}>
                    <input type="password" placeholder="Hasło..." value={restorePassword} onChange={e=>setRestorePassword(e.target.value)} style={{flex:1,fontSize:14}}/>
                  </div>
                  <button onClick={handleRestore} disabled={backupLoading} style={{width:"100%",padding:"15px",borderRadius:14,background:"linear-gradient(135deg,#f59e0b,#fbbf24)",color:"#000",fontSize:14,fontWeight:700}}>
                    {backupLoading?"Odszyfrowywanie...":"🔓 Przywróć dane"}
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* RECURRING */}
        {tab==="recurring" && (
          <div style={{padding:isMobile?"56px 18px":"40px",maxWidth:1200,margin:"0 auto"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,marginBottom:18}}>
              <div style={{fontSize:isMobile?18:24,fontWeight:700}}>Stałe wydatki</div>
              <button
                onClick={()=>{
                  setEditTarget(null);
                  setRecurForm({label:"",amount:"",category:"bills",icon:"📄",startYear:selYear,startMonth:selMonth});
                  setModal("addRecur");
                }}
                style={{background:"linear-gradient(135deg,#2dd4bf,#14b8a6)",color:"#fff",borderRadius:14,padding:"10px 16px",fontSize:13,fontWeight:700,whiteSpace:"nowrap"}}
              >
                + Dodaj
              </button>
            </div>

            <div className="card" style={{padding:isMobile?"14px":"18px",marginBottom:14}}>
              <div style={{fontSize:11,color:"#44445a",textTransform:"uppercase",letterSpacing:".08em",marginBottom:6}}>Miesięczny koszt stały</div>
              <div style={{fontSize:isMobile?20:24,fontWeight:800,color:"#f87171",fontFamily:"monospace"}}>
                {fmt(recurring.reduce((sum, r) => sum + r.amount, 0))}
              </div>
            </div>

            <div style={{background:isMobile?"none":"rgba(255,255,255,.02)",borderRadius:isMobile?0:14,padding:isMobile?0:18}}>
              {recurring.length===0 ? (
                <div style={{textAlign:"center",padding:"42px 0",color:"#2a2a40"}}>
                  <div style={{fontSize:36,marginBottom:8}}>🔄</div>
                  <div>Brak stałych wydatków</div>
                </div>
              ) : recurring
                .slice()
                .sort((a,b)=>a.startYear===b.startYear?a.startMonth-b.startMonth:a.startYear-b.startYear)
                .map(r=>(
                  <div key={r.id} className="row" onClick={()=>openEditRecur(r)} style={{cursor:"pointer",padding:isMobile?"13px 0":"16px 0"}}>
                    <div style={{width:42,height:42,borderRadius:13,background:"rgba(45,212,191,.12)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{r.icon||"📄"}</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:isMobile?13:15,fontWeight:600,display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                        <span>{r.label}</span>
                        <span className="pill bg-blue">STAŁY</span>
                      </div>
                      <div style={{fontSize:11,color:"#44445a"}}>od {MONTHS_FULL[r.startMonth]} {r.startYear}</div>
                    </div>
                    <div style={{fontSize:isMobile?14:15,fontWeight:700,color:"#f87171",fontFamily:"monospace",marginRight:8}}>-{fmt(r.amount)}</div>
                    <button
                      onClick={ev=>{ev.stopPropagation();deleteRecur(r.id);}}
                      style={{width:26,height:26,borderRadius:8,background:"rgba(248,113,113,.1)",color:"#f87171",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}
                    >
                      ×
                    </button>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* GOALS */}
        {tab==="goals" && (
          <div style={{padding:isMobile?"56px 18px":"40px",maxWidth:1200,margin:"0 auto"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,marginBottom:18}}>
              <div style={{fontSize:isMobile?18:24,fontWeight:700}}>Cele oszczędnościowe</div>
              <button
                onClick={()=>{
                  setEditTarget(null);
                  setGoalForm({name:"",icon:"🏠",target:"",saved:"",deadline:""});
                  setModal("addGoal");
                }}
                style={{background:"linear-gradient(135deg,#f59e0b,#fbbf24)",color:"#000",borderRadius:14,padding:"10px 16px",fontSize:13,fontWeight:700,whiteSpace:"nowrap"}}
              >
                + Dodaj
              </button>
            </div>

            <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:12}}>
              {goals.length===0 && (
                <div className="card" style={{gridColumn:isMobile?"1":"1 / -1",textAlign:"center",padding:"42px 20px",color:"#2a2a40"}}>
                  <div style={{fontSize:36,marginBottom:8}}>🎯</div>
                  <div>Brak celów oszczędnościowych</div>
                </div>
              )}

              {goals.map(g=>{
                const pct = Math.max(0, Math.min(100, (g.saved / g.target) * 100));
                const left = Math.max(0, g.target - g.saved);
                return (
                  <div key={g.id} className="card" style={{padding:"16px"}}>
                    <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:10,marginBottom:10}}>
                      <div style={{display:"flex",alignItems:"center",gap:10,minWidth:0}}>
                        <div style={{fontSize:26,lineHeight:1}}>{g.icon||"🎯"}</div>
                        <div style={{minWidth:0}}>
                          <div style={{fontSize:15,fontWeight:700,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{g.name}</div>
                          <div style={{fontSize:11,color:"#44445a"}}>{fmt(g.saved)} / {fmt(g.target)}</div>
                        </div>
                      </div>
                      <div style={{display:"flex",gap:6,flexShrink:0}}>
                        <button onClick={()=>openEditGoal(g)} style={{padding:"6px 9px",borderRadius:8,background:"rgba(125,211,252,.12)",color:"#7dd3fc",fontSize:11,fontWeight:700}}>Edytuj</button>
                        <button onClick={()=>deleteGoal(g.id)} style={{padding:"6px 9px",borderRadius:8,background:"rgba(248,113,113,.1)",color:"#f87171",fontSize:11,fontWeight:700}}>Usuń</button>
                      </div>
                    </div>

                    <div style={{height:9,background:"rgba(255,255,255,.06)",borderRadius:999,overflow:"hidden",marginBottom:8}}>
                      <div style={{width:`${pct}%`,height:"100%",background:"linear-gradient(135deg,#4ade80,#22c55e)",borderRadius:999}}/>
                    </div>

                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",fontSize:11,color:"#44445a",marginBottom:12}}>
                      <span>{Math.round(pct)}% celu</span>
                      <span>zostało: {fmt(left)}</span>
                    </div>

                    <button
                      onClick={()=>{
                        setSavingForm({goalId:String(g.id),amount:""});
                        setModal("addSaving");
                      }}
                      style={{width:"100%",padding:"10px",borderRadius:10,background:"rgba(74,222,128,.1)",color:"#4ade80",fontSize:12,fontWeight:700}}
                    >
                      + Dodaj wpłatę
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* MOBILE BOTTOM NAV */}
      {isMobile && (
        <div style={{position:"fixed",bottom:0,left:0,right:0,background:"rgba(8,8,14,.95)",backdropFilter:"blur(20px)",borderTop:"1px solid rgba(255,255,255,.06)",padding:"10px 0 20px",display:"flex",alignItems:"center",justifyContent:"space-around",zIndex:100}}>
          {sidebarItems.map(item=>(
            <button key={item.id} onClick={()=>setTab(item.id)} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3,background:"none",color:tab===item.id?"#eeeaf4":"#2a2a40",transition:"color .2s",padding:"4px 6px"}}>
              <span style={{fontSize:18}}>{item.icon}</span>
              <span style={{fontSize:8,fontWeight:600,letterSpacing:".06em",textTransform:"uppercase",color:tab===item.id?"#a78bfa":"#2a2a40"}}>{item.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* MODALS */}
      {modal && (
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget){setModal(null);setEditTarget(null);}}}>
          <div className="modal">
            {isMobile && <div className="drag-handle"/>}
            <div style={{fontSize:isMobile?16:18,fontWeight:700,marginBottom:18}}>
              {modal==="addTx"?(editTarget?"Edytuj":"Nowa transakcja")
              :modal==="addRecur"?(editTarget?"Edytuj":"Nowy stały wydatek")
              :modal==="addSaving"?"Nowa wpłata"
              :"Nowy cel"}
            </div>

            {modal==="addTx" && (
              <>
                <div style={{display:"flex",background:"rgba(255,255,255,.04)",borderRadius:14,padding:4,marginBottom:18}}>
                  <button style={{flex:1,padding:"10px 6px",borderRadius:10,background:txForm.type==="expense"?"rgba(255,255,255,.1)":"none",color:txForm.type==="expense"?"#eeeaf4":"#44445a",fontSize:12,fontWeight:600,textTransform:"uppercase"}} onClick={()=>setTxForm(f=>({...f,type:"expense",category:"food"}))}>💸 Wydatek</button>
                  <button style={{flex:1,padding:"10px 6px",borderRadius:10,background:txForm.type==="income"?"rgba(255,255,255,.1)":"none",color:txForm.type==="income"?"#eeeaf4":"#44445a",fontSize:12,fontWeight:600,textTransform:"uppercase"}} onClick={()=>setTxForm(f=>({...f,type:"income",category:"uop"}))}>💰 Przychód</button>
                </div>
                {!editTarget&&(<div style={{display:"flex",gap:8,marginBottom:14}}>
                  <select className="select-box" style={{flex:2}} value={txForm.month} onChange={e=>setTxForm(f=>({...f,month:Number(e.target.value)}))}>
                    {MONTHS_FULL.map((m,i)=><option key={i} value={i}>{m}</option>)}
                  </select>
                  <select className="select-box" style={{flex:1}} value={txForm.year} onChange={e=>setTxForm(f=>({...f,year:Number(e.target.value)}))}>
                    {YEARS.map(y=><option key={y} value={y}>{y}</option>)}
                  </select>
                </div>)}
                <div className="input-box" style={{marginBottom:6}}>
                  <span style={{fontSize:13,color:"#44445a",fontFamily:"monospace"}}>PLN</span>
                  <input type="number" inputMode="decimal" placeholder="0,00" value={txForm.amount} onChange={e=>setTxForm(f=>({...f,amount:e.target.value}))} style={{flex:1,fontSize:isMobile?20:26,fontWeight:700,fontFamily:"monospace"}}/>
                </div>
                <div className="input-box" style={{marginBottom:20}}>
                  <input type="text" placeholder="Notatka (opcjonalnie)" value={txForm.note} onChange={e=>setTxForm(f=>({...f,note:e.target.value}))} style={{flex:1,fontSize:14}}/>
                </div>
                <button className="btn-primary" onClick={submitTx} style={{background:txForm.type==="income"?"linear-gradient(135deg,#4ade80,#22c55e)":"linear-gradient(135deg,#f87171,#ef4444)"}}>
                  {editTarget?"Zapisz":"Dodaj"}
                </button>
              </>
            )}

            {modal==="addRecur" && (
              <>
                <div className="input-box" style={{marginBottom:12}}><input type="text" placeholder="Nazwa" value={recurForm.label} onChange={e=>setRecurForm(f=>({...f,label:e.target.value}))} style={{flex:1,fontSize:14}}/></div>
                <div className="input-box" style={{marginBottom:20}}>
                  <span style={{fontSize:13,color:"#44445a",fontFamily:"monospace"}}>PLN</span>
                  <input type="number" inputMode="decimal" placeholder="Kwota" value={recurForm.amount} onChange={e=>setRecurForm(f=>({...f,amount:e.target.value}))} style={{flex:1,fontSize:18,fontWeight:700,fontFamily:"monospace"}}/>
                </div>
                <button className="btn-primary" onClick={submitRecur} style={{background:"linear-gradient(135deg,#2dd4bf,#14b8a6)"}}>{editTarget?"Zapisz":"Dodaj"}</button>
              </>
            )}

            {(modal==="addGoal"||modal==="editGoal") && (
              <>
                <div className="input-box" style={{marginBottom:12}}><input type="text" placeholder="Nazwa celu" value={goalForm.name} onChange={e=>setGoalForm(f=>({...f,name:e.target.value}))} style={{flex:1,fontSize:14}}/></div>
                <div className="input-box" style={{marginBottom:12}}>
                  <span style={{fontSize:13,color:"#44445a",fontFamily:"monospace"}}>PLN</span>
                  <input type="number" inputMode="decimal" placeholder="Docelowo" value={goalForm.target} onChange={e=>setGoalForm(f=>({...f,target:e.target.value}))} style={{flex:1,fontSize:18,fontWeight:700,fontFamily:"monospace"}}/>
                </div>
                <button className="btn-primary" onClick={submitGoal} style={{background:"linear-gradient(135deg,#f59e0b,#fbbf24)",color:"#000"}}>{editTarget?"Zapisz":"Utwórz"}</button>
              </>
            )}

            {modal==="addSaving" && (
              <>
                <select className="select-box" style={{marginBottom:12}} value={savingForm.goalId} onChange={e=>setSavingForm(f=>({...f,goalId:e.target.value}))}>
                  <option value="">Wybierz cel...</option>
                  {goals.map(g=><option key={g.id} value={String(g.id)}>{g.icon||"🎯"} {g.name}</option>)}
                </select>
                <div className="input-box" style={{marginBottom:16}}>
                  <span style={{fontSize:13,color:"#44445a",fontFamily:"monospace"}}>PLN</span>
                  <input type="number" inputMode="decimal" placeholder="Kwota wpłaty" value={savingForm.amount} onChange={e=>setSavingForm(f=>({...f,amount:e.target.value}))} style={{flex:1,fontSize:18,fontWeight:700,fontFamily:"monospace"}}/>
                </div>
                <button className="btn-primary" onClick={submitSaving} style={{background:"linear-gradient(135deg,#4ade80,#22c55e)",color:"#04110a"}}>Dodaj wpłatę</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
