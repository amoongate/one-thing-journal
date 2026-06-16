// BUILD: app-phase1-v6-20260616
// App engine: the approved One Thing Journal logic, adapted to run on live
// Supabase data and to persist changes. Mounted by App.jsx into a container.
import { SIG, DEFAULT_QUOTES } from "./assets";

export function mountApp(root, opts){

/* ============================================================
   One Thing Journal: mobile mockup
   Structured for a future React port: one `state` object +
   component-style render functions + event delegation.
   In React: state -> useReducer/context, render* -> components,
   the seed `entries` -> fetched from an API, TODAY -> new Date().
   ============================================================ */

  

  

  /* ---- constants ---- */
  var TODAY = opts.today;
  var WEEKDAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  var WD_SHORT = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  var MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  
  function cloneQuotes(src){return src.map(function(x){return {q:x.q,a:x.a};});}

  /* ---- date helpers (local, TZ-safe) ---- */
  function parseISO(s){var p=s.split("-");return new Date(+p[0],+p[1]-1,+p[2]);}
  function toISO(d){return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");}
  function addDays(s,n){var d=parseISO(s);d.setDate(d.getDate()+n);return toISO(d);}
  function weekStart(s){var d=parseISO(s);d.setDate(d.getDate()-d.getDay());return toISO(d);}
  function weekdayIdx(s){return parseISO(s).getDay();}
  function fmtLong(s){var d=parseISO(s);return WEEKDAYS[d.getDay()]+", "+MONTHS[d.getMonth()]+" "+d.getDate()+", "+d.getFullYear();}
  function fmtRange(ws){
    var a=parseISO(ws),b=parseISO(addDays(ws,6));
    var left=MONTHS[a.getMonth()]+" "+a.getDate();
    var right=(a.getMonth()===b.getMonth())?b.getDate():(MONTHS[b.getMonth()]+" "+b.getDate());
    return left+" – "+right;
  }

  /* ---- seed data ---- */
  function E(pri,sec,rating){
    function mk(x){return {t:x[0],e:x[1],a:x[2],done:(x[3]!==undefined?x[3]:(x[2]!==""&&x[2]!=null))};}
    return {
      priorities: pri.map(mk),
      secondary: sec.map(mk),
      reflection:{rating:rating||"",note:""}
    };
  }
  var entries = opts.data.entries || {};
  // Upgrade any saved days from the old priorities/secondary shape to one + tasks.
  Object.keys(entries).forEach(function(d){
    var en=entries[d]; if(!en) return;
    if(en.priorities){
      var tk=(en.priorities.slice(1)||[]).concat(en.secondary||[]);
      if(!tk.some(function(x){return x&&x.t;})) tk=[blank(),blank(),blank()];
      entries[d]={ one:en.priorities[0]||blank(), tasks:tk, reflection:en.reflection||{rating:"",note:""} };
    } else {
      if(!en.one) en.one=blank();
      if(!en.tasks) en.tasks=[];
      if(!en.reflection) en.reflection={rating:"",note:""};
    }
  });

  /* ---- app state ---- */
  var state = {
    view: "today",          /* today | day | journal | guide | profile */
    activeDate: TODAY,
    openWeeks: {},
    openMonths: {},
    move: null,             /* {g,i} of the task being rescheduled */
    overrideRest: {},       /* dates where the user chose to plan despite it being a rest day */
    onboard: { done:false, dismissed:false },  /* install-to-home-screen card; gate on a new-user flag in the real build */
    installSheet: false,    /* iOS / fallback instructions modal */
    showPw: false,
    user: opts.data.user,
    quotes: opts.data.quotes
  };
  function restIdx(){ return (state.user.restDay==null||state.user.restDay==="") ? -1 : +state.user.restDay; }
  function isRestDay(date){ var r=restIdx(); return r>=0 && weekdayIdx(date)===r; }

  /* ---- install-to-home-screen (PWA) detection ---- */
  var pwa = { deferred:null };
  function isStandalone(){
    try{ return (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || window.navigator.standalone===true; }
    catch(e){ return false; }
  }
  function platform(){
    var ua=navigator.userAgent||navigator.vendor||"";
    if(/iPad|iPhone|iPod/.test(ua) && !window.MSStream) return "ios";
    if(/Android/i.test(ua)) return "android";
    return "other";
  }
  function uaStr(){ return navigator.userAgent||navigator.vendor||""; }
  function isIos(){ return /iPad|iPhone|iPod/.test(uaStr()) && !window.MSStream; }
  /* On iOS every browser is WebKit but only Safari reliably supports Add to Home Screen.
     CriOS=Chrome, FxiOS=Firefox, EdgiOS=Edge, OPiOS=Opera. */
  function isIosNonSafari(){ return isIos() && /CriOS|FxiOS|EdgiOS|OPiOS/.test(uaStr()); }
  function pwaDismiss(){ try{ localStorage.setItem("otj_install_dismissed","1"); }catch(e){} state.onboard.dismissed=true; }

  function getEntry(date){
    if(!entries[date]){
      entries[date] = { one:blank(), tasks:[blank(),blank(),blank()], reflection:{rating:"",note:""} };
    }
    return entries[date];
  }
  function blank(){return {t:"",e:"",a:"",done:false};}
  function num(v){var n=parseFloat(v);return isNaN(n)?0:n;}
  function allItems(en){ return (en&&en.tasks) ? [en.one].concat(en.tasks) : []; }
  function totals(entry){
    var e=0,a=0;
    allItems(entry).forEach(function(x){e+=num(x.e);a+=num(x.a);});
    return {est:e,act:a};
  }
  function hm(min){return Math.floor(min/60)+"h "+String(Math.round(min%60)).padStart(2,"0")+"m";}
  function esc(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/"/g,"&quot;");}

  /* ---- icons ---- */
  var ICON = {
    today:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3.5" y="4.5" width="17" height="16" rx="2.5"/><path d="M3.5 9h17M8 3v3M16 3v3"/><circle cx="12" cy="14.5" r="1.6" fill="currentColor" stroke="none"/></svg>',
    journal:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M5 4.5h11a2.5 2.5 0 0 1 2.5 2.5v12.5H7.5A2.5 2.5 0 0 1 5 19V4.5z"/><path d="M5 4.5v15M9 8.5h6M9 12h6"/></svg>',
    guide:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5" stroke-linecap="round"/><circle cx="12" cy="7.8" r="1.05" fill="currentColor" stroke="none"/></svg>',
    profile:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="8.5" r="3.6"/><path d="M5 19.5a7 7 0 0 1 14 0" stroke-linecap="round"/></svg>',
    back:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M14.5 5.5 8 12l6.5 6.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    x:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6 6 18" stroke-linecap="round"/></svg>',
    plus:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5.5v13M5.5 12h13" stroke-linecap="round"/></svg>',
    chev:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M6 9.5 12 15l6-5.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    eye:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.6"/></svg>',
    eyeoff:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 4l16 16" stroke-linecap="round"/><path d="M9.5 9.7A2.6 2.6 0 0 0 12 14.5M6.5 6.9C3.9 8.4 2.5 12 2.5 12s3.5 6.5 9.5 6.5c1.5 0 2.8-.3 3.9-.8M17.5 15.2c2-1.4 4-3.2 4-3.2S18 5.5 12 5.5c-.6 0-1.2.1-1.7.2"/></svg>',
    check:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><path d="M5 12.5l4.3 4.3L19 7.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    move:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 12h11" stroke-linecap="round"/><path d="M12 7.5l4.5 4.5-4.5 4.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M20 5.5v13" stroke-linecap="round"/></svg>',
    moon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M20 14.4A8 8 0 1 1 9.6 4 6.5 6.5 0 0 0 20 14.4z" stroke-linejoin="round"/></svg>',
    share:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3.5v11" stroke-linecap="round"/><path d="M8.4 7 12 3.4 15.6 7" stroke-linecap="round" stroke-linejoin="round"/><path d="M7.5 10.5H6A1.5 1.5 0 0 0 4.5 12v6.5A1.5 1.5 0 0 0 6 20h12a1.5 1.5 0 0 0 1.5-1.5V12A1.5 1.5 0 0 0 18 10.5h-1.5" stroke-linecap="round"/></svg>'
  };

  /* ============ install-to-home-screen card ============ */
  function markMini(){ return '<div class="mm"><div class="mmw"><span class="mmhl"></span><span class="mm-top"></span></div><div class="mm-l"></div><div class="mm-l short"></div></div>'; }

  function renderInstallCard(){
    if(state.onboard.done || state.onboard.dismissed || isStandalone()) return "";
    var primary = pwa.deferred
      ? '<button class="ic-btn primary" data-action="pwa-install">Install</button>'
      : '<button class="ic-btn primary" data-action="pwa-how">How to install</button>';
    return '<div class="installcard">'+
      '<button class="ic-x" data-action="pwa-dismiss" aria-label="Dismiss">'+ICON.x+'</button>'+
      '<div class="ic-top">'+
        '<div class="miniicon">'+markMini()+'</div>'+
        '<div class="ic-txt"><div class="ic-title">Add One Thing to your home screen</div>'+
        '<div class="ic-sub">One tap to your day. Works offline, no app store needed.</div></div>'+
      '</div>'+
      '<div class="ic-actions">'+primary+'<button class="ic-btn" data-action="pwa-dismiss">Not now</button></div>'+
    '</div>';
  }

  function istep(n,html){ return '<div class="istep"><div class="n">'+n+'</div><div class="t">'+html+'</div></div>'; }
  function installSheetHTML(){
    var glyph='<span class="shareico">'+ICON.share+'</span>';
    var title, sub, steps, copy="";
    if(isIosNonSafari()){
      title="Open in Safari to install";
      sub="Add to Home Screen works in Safari. Open this page in Safari, then add it.";
      steps=istep(1,'Tap the <strong>\u00b7\u00b7\u00b7</strong> menu in the top-right')+
            istep(2,'Tap <strong>Open in Safari</strong>')+
            istep(3,'In Safari, tap '+glyph+' Share, then <strong>Add to Home Screen</strong>');
      copy='<button class="copylink" data-action="pwa-copy">Copy this page\u2019s link</button>';
    } else if(isIos()){
      title="Install on iPhone";
      sub="Add One Thing to your home screen for one-tap access.";
      steps=istep(1,'Tap the '+glyph+' <strong>Share</strong> button at the bottom of Safari')+
            istep(2,'Scroll and tap <strong>Add to Home Screen</strong>')+
            istep(3,'Tap <strong>Add</strong> in the top-right');
    } else {
      title="Install the app";
      sub="Look for the install icon in your browser address bar, or use the menu to add it.";
      steps=istep(1,'Open your browser menu')+
            istep(2,'Choose <strong>Install</strong> or <strong>Add to Home Screen</strong>');
    }
    return '<div class="sheet-wrap"><div class="sheet-bd" data-action="pwa-sheet-close"></div>'+
      '<div class="sheet" role="dialog" aria-label="Install instructions">'+
        '<div class="ic-modal-icon">'+markMini()+'</div>'+
        '<div class="ic-modal-title">'+title+'</div>'+
        '<div class="ic-modal-sub">'+sub+'</div>'+
        steps+copy+
        '<button class="gotit" data-action="pwa-sheet-close">Got it</button>'+
        '<button class="skip" data-action="pwa-skip">Skip for now</button>'+
      '</div></div>';
  }

  /* ============ render: REST DAY ============ */
  function renderRestDay(date){
    var d=parseISO(date);
    var h="";
    if(state.view==="day"){
      h+='<div class="topbar"><button class="iconbtn" data-action="back" aria-label="Back to journal">'+ICON.back+'</button><h1>Day detail</h1></div>';
    }
    h+='<div class="dayhead"><div class="dayrow1"><div class="dayname">'+WEEKDAYS[d.getDay()]+'<span class="restchip">Rest day</span></div>'+sigMark()+'</div>';
    h+='<div class="daydate">'+MONTHS[d.getMonth()]+' '+d.getDate()+', '+d.getFullYear()+'</div></div>';
    h+='<div class="restscreen"><div class="restmoon">'+ICON.moon+'</div>';
    h+='<div class="restbig">Your day of rest</div>';
    h+='<div class="restsub">No work planned today. Step back, recharge, and come back sharper tomorrow.</div>';
    h+='<button class="restplan" data-action="plan-rest" data-date="'+date+'">Plan anyway</button></div>';
    return h;
  }

  /* ============ render: DAY (today + archived day detail) ============ */
  function renderDay(date){
    var entry=getEntry(date);
    var isToday=(date===TODAY);
    var quote=state.quotes[weekdayIdx(date)];
    var d=parseISO(date);
    var t=totals(entry);
    var h="";

    if(isRestDay(date) && !state.overrideRest[date]) return renderRestDay(date);

    if(state.view==="day"){
      h+='<div class="topbar"><button class="iconbtn" data-action="back" aria-label="Back to journal">'+ICON.back+'</button><h1>Day detail</h1></div>';
    }

    h+='<div class="dayhead">';
    h+='<div class="dayrow1"><div class="dayname">'+WEEKDAYS[d.getDay()]+(isToday?'<span class="todaychip">Today</span>':'')+'</div>'+sigMark()+'</div>';
    h+='<div class="daydate">'+MONTHS[d.getMonth()]+' '+d.getDate()+', '+d.getFullYear()+'</div>';
    h+='</div>';
    if(isRestDay(date)){
      h+='<div class="restbanner">'+ICON.moon+'<span>Rest day, planning anyway.</span><button data-action="mark-rest" data-date="'+date+'">Mark as rest</button></div>';
    } else {
      h+='<p class="quote">“'+esc(quote.q)+'”'+(quote.a?' <span class="attr">- '+esc(quote.a)+'</span>':'')+'</p>';
    }

    /* install-to-home-screen prompt for new users, pinned above the plan */
    if(isToday) h+=renderInstallCard();

    /* hero: The ONE Thing */
    h+='<div class="sec-head"><h2>Today\'s plan</h2></div>';
    h+='<p class="sec-sub">Start with the one thing that makes the rest easier.</p>';
    h+=heroCard(entry.one);

    /* unified task list (no priority/secondary split) */
    h+='<div class="tasklist">';
    if(entry.tasks.length===0){
      h+='<div class="emptyrow">No tasks yet. Add one below.</div>';
    } else {
      entry.tasks.forEach(function(p,i){ h+=taskRow("task",i,p,i); });
    }
    h+='</div>';
    h+='<button class="addbtn" data-action="add-task">'+ICON.plus+' Add task</button>';

    /* summary */
    var v=t.act-t.est, vcls="",vtxt="-";
    if(t.act>0){ if(v>0){vcls="over";vtxt="+"+Math.round(v)+"m";} else if(v<0){vcls="under";vtxt=Math.round(v)+"m";} else {vcls="under";vtxt="0m";} }
    h+='<div class="summary">';
    h+='<div class="metric"><div class="k">Est. total</div><div class="v" id="tot-est">'+Math.round(t.est)+'</div><div class="hm">'+hm(t.est)+'</div></div>';
    h+='<div class="metric"><div class="k">Act. total</div><div class="v" id="tot-act">'+Math.round(t.act)+'</div><div class="hm">'+hm(t.act)+'</div></div>';
    h+='<div class="metric var"><div class="k">Variance</div><div class="v '+vcls+'" id="tot-var">'+vtxt+'</div><div class="hm">'+(t.act>0?(v>0?'over estimate':v<0?'under estimate':'spot on'):'-')+'</div></div>';
    h+='</div>';

    /* reflection */
    h+='<div class="reflect"><h3>Did I allocate my time well today?</h3><div class="ratings">';
    [["yes","On target"],["close","Close"],["off","Off, adjust"]].forEach(function(r){
      h+='<button data-action="rate" data-r="'+r[0]+'" aria-pressed="'+(entry.reflection.rating===r[0])+'">'+r[1]+'</button>';
    });
    h+='</div><textarea data-action="note" placeholder="What ran long or short? One note to estimate better tomorrow.">'+esc(entry.reflection.note)+'</textarea></div>';

    /* goal */
    h+='<div class="goal"><div class="big">Get the right things done</div><div class="small">Thinking is the job. We are the producers of knowledge, creative ideas, and information.</div></div>';

    return h;
  }
  function timeRow(g,i,p){
    return '<div class="timerow">'+
      '<span class="tlabel">Est</span><input class="t-time" data-g="'+g+'" data-i="'+i+'" data-f="e" type="number" min="0" step="5" inputmode="numeric" value="'+esc(p.e)+'" placeholder="–" aria-label="Estimated minutes">'+
      '<span class="tlabel">Act</span><input class="t-time act" data-g="'+g+'" data-i="'+i+'" data-f="a" type="number" min="0" step="5" inputmode="numeric" value="'+esc(p.a)+'" placeholder="–" aria-label="Actual minutes">'+
      '<span class="unit">min</span>'+
    '</div>';
  }
  /* ---- Hero card: The ONE Thing ---- */
  function heroCard(p){
    return '<div class="hero'+(p.done?" done":"")+'">'+
      '<div class="cardactions"><button class="icoact" data-action="move" data-g="one" data-i="0" aria-label="Move to another day">'+ICON.move+'</button></div>'+
      '<span class="onelabel">The ONE Thing</span>'+
      '<div class="hero-main">'+
        '<button class="check'+(p.done?" on":"")+'" data-action="toggle-done" data-g="one" data-i="0" aria-pressed="'+(!!p.done)+'" aria-label="Mark complete">'+ICON.check+'</button>'+
        '<textarea class="t-input" rows="1" data-g="one" data-i="0" data-f="t" placeholder="The task that makes everything else easier…">'+esc(p.t)+'</textarea>'+
      '</div>'+
      timeRow("one",0,p)+
    '</div>';
  }
  /* ---- Compact task row ---- */
  function taskRow(g,i,p,rowIdx){
    var ph = "Task…";
    var actions='<div class="rowactions">'+
      '<button class="icoact" data-action="move" data-g="'+g+'" data-i="'+i+'" aria-label="Move to another day">'+ICON.move+'</button>'+
      '<button class="icoact" data-action="rm-task" data-i="'+i+'" aria-label="Remove task">'+ICON.x+'</button>'+
    '</div>';
    return '<div class="trow'+(p.done?" done":"")+(rowIdx%2?" alt":"")+'">'+
      '<button class="check'+(p.done?" on":"")+'" data-action="toggle-done" data-g="'+g+'" data-i="'+i+'" aria-pressed="'+(!!p.done)+'" aria-label="Mark complete">'+ICON.check+'</button>'+
      '<div class="trow-body">'+
        '<div class="trow-line">'+
          '<textarea class="t-input" rows="1" data-g="'+g+'" data-i="'+i+'" data-f="t" placeholder="'+ph+'">'+esc(p.t)+'</textarea>'+
          actions+
        '</div>'+
        timeRow(g,i,p)+
      '</div>'+
    '</div>';
  }

  /* ============ estimation-accuracy stats ============ */
  /* Per-task accuracy = min(est,act)/max(est,act): symmetric, 0..1, no blow-ups.
     A task only counts once it has BOTH an estimate and an actual. */
  function periodStats(dates){
    var accs=[], est=0, act=0;
    dates.forEach(function(d){
      var entry=entries[d]; if(!entry) return;
      allItems(entry).forEach(function(x){
        var e=num(x.e), a=num(x.a);
        if(e>0 && a>0){ accs.push(Math.min(e,a)/Math.max(e,a)); est+=e; act+=a; }
      });
    });
    if(!accs.length) return null;
    var acc=accs.reduce(function(s,v){return s+v;},0)/accs.length;
    return {acc:acc, n:accs.length, est:est, act:act, bias:act-est};
  }
  function pct(a){return Math.round(a*100);}
  function sparkline(series){
    if(series.length<2) return '';
    var w=132,h=38,pad=5,n=series.length;
    var vals=series.map(function(s){return s.acc;});
    var lo=Math.max(0,Math.min.apply(null,vals)-0.04), hi=Math.min(1,Math.max.apply(null,vals)+0.04);
    if(hi-lo<0.1){lo=Math.max(0,lo-0.05);hi=Math.min(1,hi+0.05);}
    var pts=series.map(function(s,i){
      return [pad+i*(w-2*pad)/(n-1), h-pad-((s.acc-lo)/(hi-lo))*(h-2*pad)];
    });
    var d=pts.map(function(p,i){return (i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1);}).join(' ');
    var dir=series[n-1].acc-series[n-2].acc;
    var col=dir>0?'var(--good)':dir<0?'var(--over)':'var(--ink-soft)';
    var last=pts[n-1];
    return '<svg class="spark" viewBox="0 0 '+w+' '+h+'" width="'+w+'" height="'+h+'" aria-hidden="true">'+
      '<path d="'+d+'" fill="none" stroke="#D7D2C2" stroke-width="1.4"/>'+
      '<path d="'+d+'" fill="none" stroke="'+col+'" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>'+
      '<circle cx="'+last[0].toFixed(1)+'" cy="'+last[1].toFixed(1)+'" r="3" fill="'+col+'"/></svg>';
  }
  function deltaPill(cur,prev,unit){
    if(prev==null) return '';
    var d=pct(cur)-pct(prev), u=(Math.abs(d)===1?'pt':unit);
    if(d>0) return '<span class="delta up">▲ '+d+' '+u+'</span>';
    if(d<0) return '<span class="delta down">▼ '+Math.abs(d)+' '+u+'</span>';
    return '<span class="delta flat">±0</span>';
  }
  function trendCard(series){
    if(!series.length) return '';
    var latest=series[series.length-1], note;
    var deltaHtml='';
    if(series.length>=2){
      var prev=series[series.length-2], d=pct(latest.acc)-pct(prev.acc);
      deltaHtml=deltaPill(latest.acc,prev.acc,'pts');
      note=d>0?'Your estimates are getting sharper.':d<0?'Estimates slipped a little lately.':'Holding steady, consistent estimates.';
    } else { note='Keep logging to see your trend take shape.'; }
    return '<div class="trendcard"><div class="trendtop">'+
      '<div><div class="tk">Estimating accuracy</div><div class="tv">'+pct(latest.acc)+'%'+deltaHtml+'</div></div>'+
      sparkline(series)+'</div><div class="tnote">'+note+'</div></div>';
  }
  function monthSummary(stats,prevAcc){
    var bias=Math.round(stats.bias);
    var tend = bias>0?('Runs long +'+bias+'m'):bias<0?('Runs short '+bias+'m'):'On the dot';
    var dcls='', dtxt='First month';
    if(prevAcc!=null){
      var d=pct(stats.acc)-pct(prevAcc);
      dcls = d>0?'up':d<0?'down':'';
      dtxt = (d>0?'▲ '+d:d<0?'▼ '+Math.abs(d):'±0')+(Math.abs(d)===1?' pt':' pts');
    }
    return '<div class="msum">'+
      '<div class="it"><div class="k">Accuracy</div><div class="v">'+pct(stats.acc)+'%</div></div>'+
      '<div class="it"><div class="k">Tendency</div><div class="v">'+tend+'</div></div>'+
      '<div class="it"><div class="k">vs prev</div><div class="v '+dcls+'">'+dtxt+'</div></div>'+
    '</div>';
  }

  /* ============ render: JOURNAL (current week + month/year archive) ============ */
  function renderJournal(){
    var curWS=weekStart(TODAY);
    var h='<div class="topbar"><h1>Journal</h1><span class="sub">'+Object.keys(entries).length+' entries</span>'+sigMark()+'</div><div class="pad" style="padding-top:0">';

    /* current week: always shown, expanded */
    h+='<div class="sec-head" style="padding-left:0"><h2>This week</h2><span class="cap">'+fmtRange(curWS)+'</span></div>';
    h+=weekCard(curWS,true,true);

    /* archive: past days grouped Year > Month, with week dividers inside */
    var pastDates=Object.keys(entries).filter(function(d){return d<curWS;}).sort().reverse();
    if(pastDates.length){
      var months={}, order=[];
      pastDates.forEach(function(d){var mk=d.slice(0,7); if(!months[mk]){months[mk]=[];order.push(mk);} months[mk].push(d);});

      /* monthly accuracy series (chronological) + each month's previous-month accuracy */
      var chrono=order.slice().reverse(), statByMonth={}, prevAccByMonth={}, last=null, series=[];
      chrono.forEach(function(mk){
        var st=periodStats(months[mk]); statByMonth[mk]=st;
        prevAccByMonth[mk]=last;
        if(st){ series.push({mk:mk,acc:st.acc}); last=st.acc; }
      });

      h+='<div class="sec-head" style="padding-left:0;margin-top:26px"><h2>Archive</h2><span class="cap">'+order.length+' month'+(order.length>1?'s':'')+'</span></div>';
      h+=trendCard(series);

      var lastYear=null;
      order.forEach(function(mk,idx){
        var yr=mk.slice(0,4);
        if(yr!==lastYear){ h+='<div class="yeardiv">'+yr+'</div>'; lastYear=yr; }
        if(state.openMonths[mk]===undefined) state.openMonths[mk]=(idx===0); /* newest month open */
        h+=monthCard(mk,months[mk],state.openMonths[mk],statByMonth[mk],prevAccByMonth[mk]);
      });
    }
    h+='</div>';
    return h;
  }
  function weekLabel(ws){var d=parseISO(ws);return "Week of "+MONTHS[d.getMonth()]+" "+d.getDate();}
  function monthCard(mk,dates,expanded,stats,prevAcc){
    var mi=+mk.slice(5,7)-1, act=0;
    dates.forEach(function(d){act+=totals(entries[d]).act;});
    var meta=dates.length+' day'+(dates.length>1?'s':'')+(act>0?' · '+hm(act):'')+(stats?' · '+pct(stats.acc)+'%':'');

    /* group this month's days by week so each divider can show week accuracy */
    var weeks=[], wmap={};
    dates.forEach(function(d){var ws=weekStart(d); if(!wmap[ws]){wmap[ws]=[];weeks.push(ws);} wmap[ws].push(d);});
    var body=(expanded&&stats)?monthSummary(stats,prevAcc):'';
    weeks.forEach(function(ws){
      var wd=wmap[ws], wst=periodStats(wd);
      body+='<div class="weekdiv">'+weekLabel(ws)+(wst?'<span class="wkacc"> · '+pct(wst.acc)+'% acc</span>':'')+'</div>';
      wd.forEach(function(d){ body+=dayRow(d,entries[d],totals(entries[d])); });
    });

    var h='<div class="weekcard">';
    h+='<button class="weekhead" data-action="toggle-month" data-mk="'+mk+'" aria-expanded="'+expanded+'">'+
       '<span class="wname">'+MONTHS[mi]+'</span><span class="wmeta">'+meta+'</span><span class="chev">'+ICON.chev+'</span></button>';
    if(expanded) h+='<div class="daylist">'+body+'</div>';
    h+='</div>';
    return h;
  }
  function weekCard(ws,isCur,expanded){
    var trackedAct=0, days="";
    for(var i=0;i<7;i++){
      var date=addDays(ws,i);
      if(isRestDay(date)) continue;   /* rest day isn't a journal day */
      var entry=entries[date];
      var t=entry?totals(entry):{est:0,act:0};
      trackedAct+=t.act;
      days+=dayRow(date,entry,t);
    }
    var meta=trackedAct>0?hm(trackedAct)+" tracked":"-";
    var h='<div class="weekcard'+(isCur?' cur':'')+'">';
    if(isCur){
      h+='<div class="daylist">'+days+'</div>';
    }else{
      h+='<button class="weekhead" data-action="toggle-week" data-ws="'+ws+'" aria-expanded="'+expanded+'">'+
         '<span class="wname">'+fmtRange(ws)+'</span><span class="wmeta">'+meta+'</span><span class="chev">'+ICON.chev+'</span></button>';
      if(expanded) h+='<div class="daylist">'+days+'</div>';
    }
    h+='</div>';
    return h;
  }
  function dayRow(date,entry,t){
    var d=parseISO(date), isToday=(date===TODAY), isFuture=(date>TODAY);
    var head=(entry&&entry.one&&entry.one.t)?esc(entry.one.t):"";
    var chip="";
    if(isFuture){ chip='<span class="chip future">·</span>'; }
    else if(entry&&t.act>0){
      var v=t.act-t.est, cls=v>0?"over":"under", txt=hm(t.act)+(v>0?" · +"+Math.round(v)+"m":v<0?" · "+Math.round(v)+"m":"");
      chip='<span class="chip '+cls+'">'+txt+'</span>';
    } else if(entry){ chip='<span class="chip plan">Planned</span>'; }
    else { chip='<span class="chip future">-</span>'; }

    var items = allItems(entry).filter(function(p){return p.t;});
    var done = items.filter(function(p){return p.done;}).length;
    var sub = entry ? (items.length ? done+" of "+items.length+" done" : "No tasks") : (isFuture?"Upcoming":"No entry");
    return '<div class="dayrow'+(isToday?' today':'')+'" data-action="open-day" data-date="'+date+'">'+
      '<div class="ddate">'+WD_SHORT[d.getDay()]+'<b>'+d.getDate()+'</b></div>'+
      '<div class="dtitle"><div class="h'+(head?'':' empty')+'">'+(head||"No plan yet")+'</div><div class="s">'+sub+'</div></div>'+
      chip+'</div>';
  }

  /* ============ render: GUIDE ============ */
  function renderGuide(){
    var steps=[
      ["Plan the night before","At the end of each day, spend 5–10 minutes writing tomorrow's ONE Thing and your tasks. Sit down the next morning already knowing what matters."],
      ["Estimate first","While you plan, fill the <span class=\"mark\">Estimated</span> minutes for each task. Most of us are poor at this, which is exactly why you practice it."],
      ["Track the actual","The next day, record the <span class=\"mark\">Actual</span> time each task took. The gap between estimated and actual is how you get sharper."],
      ["Line up with goals","Make sure your ONE Thing and your tasks ladder up to the bigger goals you've set for yourself."],
      ["Make it yours","Adjust anything here that doesn't fit how you work. The journal serves you, not the other way around."]
    ];
    var h='<div class="topbar"><h1>How to use it</h1>'+sigMark()+'</div><div class="guide">';
    h+='<p class="intro">A simple loop: plan tonight, estimate, then track what actually happened. Repeat, and your sense of time gets reliable.</p>';
    steps.forEach(function(s,i){
      h+='<div class="step"><div class="n">'+(i+1)+'</div><div class="body"><h4>'+s[0]+'</h4><p>'+s[1]+'</p></div></div>';
    });
    h+='<div class="books"><div class="k">Recommended reading</div>'+
       '<div class="b">The Effective Executive <span>by Peter Drucker</span></div>'+
       '<div class="b">The ONE Thing <span>by Gary Keller</span></div></div>';
    h+='</div>';
    return h;
  }

  /* ============ render: PROFILE ============ */
  function renderProfile(){
    var u=state.user;
    var initials=u.name.split(/\s+/).map(function(w){return w[0];}).slice(0,2).join("").toUpperCase();
    var h='<div class="topbar"><h1>Profile</h1>'+sigMark()+'</div><div class="profile">';
    h+='<div class="avatar">'+esc(initials||"?")+'</div>';
    h+='<div class="pname">'+esc(u.name)+'</div><div class="prole">Realtor & Listing Agent</div>';
    h+=field("name","Full name","text",u.name);
    h+='<div class="field"><label>Email</label><div class="inwrap"><input type="email" value="'+esc(u.email)+'" disabled></div></div>';
    h+=field("phone","Phone","tel",u.phone);
    /* password is managed through the secure reset flow, not stored here */
    h+='<div class="field"><label>Password</label><div class="inwrap"><input type="password" value="********" disabled></div><p class="fieldnote">To change your password, sign out and use Forgot password.</p></div>';
    /* rest day picker (optional) */
    h+='<div class="field"><label>Rest day <span class="opt">optional</span></label><div class="inwrap"><select data-uf2="restDay">';
    h+='<option value=""'+(u.restDay===""?" selected":"")+'>No rest day, full 7-day week</option>';
    WEEKDAYS.forEach(function(w,i){ h+='<option value="'+i+'"'+(u.restDay===String(i)?" selected":"")+'>'+w+'</option>'; });
    h+='</select></div><p class="fieldnote">On your rest day the journal skips planning, hides the day, and shows no quote.</p></div>';
    h+='<button class="savebtn" data-action="save-profile">Save changes</button>';

    /* daily motivation: one editable quote per weekday */
    h+='<div class="qsection"><div class="qhead"><h3>Daily motivation</h3><button class="qreset" data-action="reset-quotes">Reset to defaults</button></div>';
    h+='<p class="qintro">A quote for each day of the week. These are yours to start, so make them your own.</p>';
    var rIdx=restIdx();
    state.quotes.forEach(function(qt,i){
      if(i===rIdx){
        h+='<div class="qedit rest"><div class="qday">'+WEEKDAYS[i]+'</div><div class="qrest">'+ICON.moon+'Rest day, no quote needed</div></div>';
        return;
      }
      h+='<div class="qedit">'+
        '<div class="qday">'+WEEKDAYS[i]+'</div>'+
        '<textarea class="q-input" rows="1" data-q="'+i+'" data-qf="q" placeholder="Quote…">'+esc(qt.q)+'</textarea>'+
        '<input class="qattr" data-q="'+i+'" data-qf="a" value="'+esc(qt.a)+'" placeholder="Attribution (optional)">'+
      '</div>';
    });
    h+='</div>';

    h+='<button class="signout" data-action="signout">Sign out</button>';
    h+='</div>';
    return h;
  }
  function field(key,label,type,val){
    return '<div class="field"><label>'+label+'</label><div class="inwrap">'+
      '<input data-uf="'+key+'" type="'+type+'" value="'+esc(val)+'"></div></div>';
  }

  /* ============ bottom nav ============ */
  function renderNav(){
    var active = (state.view==="day")?"journal":state.view;
    var items=[["today","Today"],["journal","Journal"],["guide","Guide"],["profile","Profile"]];
    return items.map(function(it){
      var on=active===it[0];
      return '<button class="navitem" data-action="nav" data-view="'+it[0]+'" aria-current="'+on+'">'+
        (on?'<span class="dot"></span>':'')+ICON[it[0]]+'<span>'+it[1]+'</span></button>';
    }).join("");
  }

  /* ============ mount ============ */
  var screen=root.querySelector(".screen");
  var nav=root.querySelector(".bottomnav");
  var sheet=root.querySelector(".sheet-host");
  var app=root;
  var _saveT=null, _dirty={};
  function markDirty(d){ if(d) _dirty[d]=true; scheduleSave(); }
  function scheduleSave(){ if(_saveT) clearTimeout(_saveT); _saveT=setTimeout(flushSave,600); }
  function flushSave(){ _saveT=null; if(!opts.onChange) return; var ents={}; for(var d in _dirty){ ents[d]=entries[d]; } _dirty={}; opts.onChange({entries:ents, user:state.user, quotes:state.quotes}); }

  function render(keepScroll){
    var sc=screen.scrollTop, v=state.view, body="";
    if(v==="today"){ state.activeDate=TODAY; body=renderDay(TODAY); }
    else if(v==="day"){ body=renderDay(state.activeDate); }
    else if(v==="journal"){ body=renderJournal(); }
    else if(v==="guide"){ body=renderGuide(); }
    else if(v==="profile"){ body=renderProfile(); }
    screen.innerHTML = body + brandFooter();
    nav.innerHTML=renderNav();
    renderSheet();
    sizeTaskFields();
    requestAnimationFrame(sizeTaskFields);
    screen.scrollTop = keepScroll ? sc : 0;
  }
  function sigMark(){ return '<img class="brandsig" src="'+SIG+'" alt="Ralph Richardson">'; }
  function brandFooter(){
    return '<div class="appfoot"><div class="fname">One Thing Journal</div>'+
      'Brought to you by <a href="https://listwithralph.com" class="flink">ListWithRalph.com</a>'+
      '<div class="fsub">Helping you finish what matters most.</div></div>';
  }

  function autosize(el){ el.style.height="auto"; el.style.height=el.scrollHeight+"px"; }
  function sizeTaskFields(){ screen.querySelectorAll("textarea.t-input, textarea.q-input").forEach(autosize); }

  function updateTotals(){
    var entry=getEntry(state.activeDate), t=totals(entry);
    var el;
    if(el=screen.querySelector("#tot-est")){el.textContent=Math.round(t.est);el.parentNode.querySelector(".hm").textContent=hm(t.est);}
    if(el=screen.querySelector("#tot-act")){el.textContent=Math.round(t.act);el.parentNode.querySelector(".hm").textContent=hm(t.act);}
    if(el=screen.querySelector("#tot-var")){
      var v=t.act-t.est, cls="", txt="-", sub="-";
      if(t.act>0){ if(v>0){cls="over";txt="+"+Math.round(v)+"m";sub="over estimate";} else if(v<0){cls="under";txt=Math.round(v)+"m";sub="under estimate";} else {cls="under";txt="0m";sub="spot on";} }
      el.className="v "+cls; el.textContent=txt; el.parentNode.querySelector(".hm").textContent=sub;
    }
  }

  /* ---- move sheet ---- */
  function shortDate(s){var d=parseISO(s);return WD_SHORT[d.getDay()]+", "+MONTHS[d.getMonth()]+" "+d.getDate();}
  function renderSheet(){
    if(state.installSheet){ sheet.innerHTML=installSheetHTML(); return; }
    if(!state.move){ sheet.innerHTML=""; return; }
    var m=state.move, src=getEntry(state.activeDate);
    var item=(m.g==="one"?src.one:src.tasks[m.i])||{t:""};
    function q(label,date){return '<button class="qbtn" data-action="move-to" data-date="'+date+'">'+label+'<span class="d">'+shortDate(date)+'</span></button>';}
    sheet.innerHTML='<div class="sheet-wrap"><div class="sheet-bd" data-action="move-cancel"></div>'+
      '<div class="sheet" role="dialog" aria-label="Move task">'+
        '<h3>Move to another day</h3>'+
        '<div class="tasklbl">“'+esc(item.t||"Untitled task")+'”</div>'+
        '<div class="qrow">'+q("Tomorrow",addDays(state.activeDate,1))+q("In 2 days",addDays(state.activeDate,2))+q("Next week",addDays(state.activeDate,7))+'</div>'+
        '<div class="datepick"><label>Pick a date</label><input type="date" value="'+addDays(state.activeDate,1)+'" data-action="move-date"></div>'+
        '<button class="cancel" data-action="move-cancel">Cancel</button>'+
      '</div></div>';
  }
  function doMove(targetDate){
    var m=state.move; if(!m||!targetDate){ state.move=null; render(true); return; }
    var src=getEntry(state.activeDate);
    var item=(m.g==="one"?src.one:src.tasks[m.i]); if(!item){ state.move=null; render(true); return; }
    var moved={t:item.t,e:item.e,a:"",done:false};   /* carry plan + estimate, reset actual */
    if(m.g==="one"){ src.one=blank(); }                /* clear the ONE Thing on this day */
    else { src.tasks.splice(m.i,1); }
    getEntry(targetDate).tasks.push(moved);            /* lands as a task on the new day */
    markDirty(state.activeDate); markDirty(targetDate);
    state.move=null;
    render(true);
    showToast("Moved to "+shortDate(targetDate));
  }
  function showToast(msg){
    var ex=app.querySelector(".toast"); if(ex) ex.remove();
    var el=document.createElement("div"); el.className="toast"; el.textContent=msg;
    app.appendChild(el);
    setTimeout(function(){ if(el.parentNode) el.remove(); },1800);
  }

  /* ---- input: text/number fields write to state without re-render ---- */
  screen.addEventListener("input",function(e){
    var el=e.target;
    if(el.dataset.g){
      var entry=getEntry(state.activeDate);
      var obj=el.dataset.g==="one"?entry.one:entry.tasks[+el.dataset.i];
      if(obj) obj[el.dataset.f]=el.value;
      if(el.dataset.f==="e"||el.dataset.f==="a") updateTotals();
      else if(el.tagName==="TEXTAREA") autosize(el);
    } else if(el.dataset.uf){
      state.user[el.dataset.uf]=el.value;
    } else if(el.dataset.q!==undefined){
      state.quotes[+el.dataset.q][el.dataset.qf]=el.value;
      if(el.tagName==="TEXTAREA") autosize(el);
    } else if(el.dataset.action==="note"){
      getEntry(state.activeDate).reflection.note=el.value;
    }
    if(el.dataset.g||el.dataset.action==="note") markDirty(state.activeDate);
    else if(el.dataset.uf||el.dataset.q!==undefined) scheduleSave();
  });

  /* ---- clicks: shared across screen + sheet ---- */
  function onClick(e){
    var t=e.target.closest("[data-action]"); if(!t) return;
    var a=t.dataset.action;
    if(a==="add-task"){ getEntry(state.activeDate).tasks.push(blank()); markDirty(state.activeDate); render(true);
      var ins=screen.querySelectorAll('[data-g="task"][data-f="t"]'); if(ins.length) ins[ins.length-1].focus(); }
    else if(a==="rm-task"){ getEntry(state.activeDate).tasks.splice(+t.dataset.i,1); markDirty(state.activeDate); render(true); }
    else if(a==="toggle-done"){
      var entry=getEntry(state.activeDate);
      var item=(t.dataset.g==="one"?entry.one:entry.tasks[+t.dataset.i]);
      item.done=!item.done;
      var card=t.closest(".hero,.trow,.card"); card.classList.toggle("done",item.done);
      t.classList.toggle("on",item.done); t.setAttribute("aria-pressed",item.done); markDirty(state.activeDate);
    }
    else if(a==="move"){ state.move={g:t.dataset.g,i:+t.dataset.i}; render(true); }
    else if(a==="move-to"){ doMove(t.dataset.date); }
    else if(a==="move-cancel"){ state.move=null; render(true); }
    else if(a==="pwa-install"){
      if(pwa.deferred){ pwa.deferred.prompt(); pwa.deferred.userChoice.then(function(c){ if(c&&c.outcome==="accepted") state.onboard.done=true; pwa.deferred=null; render(true); }); }
      else { state.installSheet=true; render(true); }
    }
    else if(a==="pwa-how"){ state.installSheet=true; render(true); }
    else if(a==="pwa-sheet-close"){ state.installSheet=false; render(true); }
    else if(a==="pwa-skip"){ state.installSheet=false; pwaDismiss(); render(true); }
    else if(a==="pwa-copy"){ try{ navigator.clipboard && navigator.clipboard.writeText(location.href); }catch(e){} showToast("Link copied"); }
    else if(a==="pwa-dismiss"){ pwaDismiss(); render(true); }
    else if(a==="rate"){
      var en=getEntry(state.activeDate);
      en.reflection.rating = (en.reflection.rating===t.dataset.r)?"":t.dataset.r;
      t.parentNode.querySelectorAll("button").forEach(function(b){b.setAttribute("aria-pressed", b.dataset.r===en.reflection.rating);}); markDirty(state.activeDate);
    }
    else if(a==="back"){ state.view="journal"; render(); }
    else if(a==="open-day"){ state.activeDate=t.dataset.date; state.view="day"; render(); }
    else if(a==="toggle-week"){ var ws=t.dataset.ws; state.openWeeks[ws]=!state.openWeeks[ws]; render(true); }
    else if(a==="toggle-month"){ var mk=t.dataset.mk; state.openMonths[mk]=!state.openMonths[mk]; render(true); }
    else if(a==="toggle-pw"){ state.showPw=!state.showPw; render(true); }
    else if(a==="save-profile"){ scheduleSave(); t.classList.add("done"); t.textContent="Saved ✓"; setTimeout(function(){t.classList.remove("done");t.textContent="Save changes";},1400); }
    else if(a==="plan-rest"){ state.overrideRest[t.dataset.date]=true; render(true); }
    else if(a==="mark-rest"){ delete state.overrideRest[t.dataset.date]; render(true); }
    else if(a==="reset-quotes"){ state.quotes=cloneQuotes(DEFAULT_QUOTES); scheduleSave(); render(true); showToast("Quotes reset to defaults"); }
    else if(a==="signout"){ if(opts.onSignOut) opts.onSignOut(); }
  }
  screen.addEventListener("click",onClick);
  screen.addEventListener("change",function(e){
    if(e.target.dataset.uf2==="restDay"){ state.user.restDay=e.target.value; scheduleSave(); render(true); }
  });
  sheet.addEventListener("click",onClick);
  sheet.addEventListener("change",function(e){ if(e.target.dataset.action==="move-date"){ doMove(e.target.value); } });

  nav.addEventListener("click",function(e){
    var t=e.target.closest("[data-action='nav']"); if(!t) return;
    state.move=null; state.installSheet=false; state.view=t.dataset.view; render();
  });

  /* install-to-home-screen wiring */
  state.onboard.done = isStandalone();
  try{ if(localStorage.getItem("otj_install_dismissed")==="1") state.onboard.dismissed=true; }catch(e){}
  function _bip(e){ e.preventDefault(); pwa.deferred=e; if(state.view==="today") render(true); }
  function _ai(){ state.onboard.done=true; pwa.deferred=null; if(state.view==="today") render(true); }
  window.addEventListener("beforeinstallprompt", _bip);
  window.addEventListener("appinstalled", _ai);

  render();

  return function destroy(){
    if(_saveT){ clearTimeout(_saveT); flushSave(); }
    window.removeEventListener("beforeinstallprompt", _bip);
    window.removeEventListener("appinstalled", _ai);
  };


}
