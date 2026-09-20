const APP_VERSION = "3.2.0-20260919";
const BUILD_TAG = "320";
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const PB_EVENTS = [
  {key:"60m",distance:60},{key:"100m",distance:100,wind:true},{key:"200m",distance:200,wind:true},{key:"400m",distance:400},
  {key:"800m",distance:800},{key:"1500m",distance:1500},{key:"3000m",distance:3000},{key:"5000m",distance:5000},{key:"10000m",distance:10000},
  {key:"100mH",distance:100,wind:true},{key:"110mH",distance:110,wind:true},{key:"400mH",distance:400}
];
const LEGACY_TRAINING_DISTANCES = [30,60,100,120,150,200,300,400,600,800,1000,1500,3000,5000,10000];
let profile = {age:18,eventGroup:"sprint",primaryEvent:"100m",pbs:{}};
let customMenus = [], presets = [], weightPresets = [];
let menuUsageStats = {};
let historyDisplayMode = "list";
let historyCalendarCursor = new Date(new Date().getFullYear(),new Date().getMonth(),1);
let historySelectedDate = null;
let bestSeasonYear = new Date().getFullYear();
let sessionItemsDraft = [];
let editingTrainingId = null, editingTrainingCreatedAt = null, editingSessionItemIndex = null;
let deferredPrompt = null, swReg = null, reloadingForUpdate = false;

document.addEventListener("DOMContentLoaded", init);

async function init(){
  setTimeout(()=>$("#launchScreen")?.classList.add("hide"),650);
  $("#appVersionLabel").textContent = `v${APP_VERSION}`;
  $("#trainingDate").value = todayISO();
  $("#raceDate").value = todayISO();
  $("#meetDate").value = todayISO();
  profile = normalizeProfile((await getSetting("profile")) || profile);
  customMenus = (await getSetting("customMenus")) || [];
  presets = (await getSetting("presets")) || [];
  weightPresets = (await getSetting("weightPresets")) || [];
  populateRaceEvents();
  renderProfile();
  await refreshMenuUsageStats();
  populateCategories();
  populatePresetCategory();
  renderPresetOptions();
  renderPresetList();
  renderWeightPresetOptions();
  renderWeightPresetList();
  renderCustomMenuList();
  bindUI();
  renderTimeRows(false);
  renderCustomValueRows();
  await refreshAll();
  setupPWA();
  if(location.hash==="#entry") navigate("entryView");
  else if(location.hash==="#calendar") navigate("calendarView");
  await checkRemoteVersion(true);
  updatePwaStatus();
}

function normalizeProfile(p){
  const out={age:Number(p?.age)||18,eventGroup:p?.eventGroup||"sprint",primaryEvent:p?.primaryEvent||"100m",pbs:{...(p?.pbs||{})}};
  PB_EVENTS.forEach(e=>{ if(!e.key.includes("H") && !out.pbs[e.key] && out.pbs[e.distance]) out.pbs[e.key]=out.pbs[e.distance]; });
  return out;
}

function bindUI(){
  $$('[data-nav]').forEach(b=>b.addEventListener("click",()=>navigate(b.dataset.nav)));
  $$('input[name="activityType"]').forEach(r=>r.addEventListener("change",toggleActivityType));
  $("#trainingForm").addEventListener("submit",saveTraining);
  $("#addTrainingItemBtn").addEventListener("click",addTrainingItem);
  $("#clearTrainingItemsBtn").addEventListener("click",clearTrainingItemsDraft);
  $("#raceForm").addEventListener("submit",saveRace);
  $("#meetForm").addEventListener("submit",saveMeet);
  $("#profileForm").addEventListener("submit",saveProfile);
  $("#presetForm").addEventListener("submit",savePreset);
  $("#weightPresetForm").addEventListener("submit",saveWeightPreset);
  $("#customMenuForm").addEventListener("submit",saveCustomMenu);
  $("#category").addEventListener("change",()=>{toggleTrainingFields();renderTimeRows(true);liveRecalc();});
  $("#presetSelect").addEventListener("change",applyPreset);
  $("#distance").addEventListener("input",liveRecalc);
  $("#flyingApproachDistance").addEventListener("input",liveRecalc);
  $("#reps").addEventListener("input",()=>{renderTimeRows(true);liveRecalc();});
  $("#sets").addEventListener("input",()=>{renderTimeRows(true);liveRecalc();});
  $$('input[name="mode"]').forEach(r=>r.addEventListener("change",toggleMode));
  $("#averageTime").addEventListener("input",liveRecalc);
  ["restMin","setRestMin"].forEach(id=>$("#"+id)?.addEventListener("input",liveRecalc));
  $$('[data-time-target]').forEach(btn=>btn.addEventListener("click",()=>insertColonInto($("#"+btn.dataset.timeTarget))));
  $("#customAttempts").addEventListener("input",()=>{renderCustomValueRows(true);liveRecalc();});
  $("#weightExerciseSelect").addEventListener("change",applyWeightPreset);
  ["weightKg","weightReps","weightSets"].forEach(id=>$("#"+id).addEventListener("input",liveRecalc));
  $("#detailToggle").addEventListener("click",()=>$("#advancedFields").classList.toggle("hidden"));
  bindRange("fatigueBefore",5,liveRecalc); bindRange("fatigueAfter",5,liveRecalc);
  bindRange("raceRpe",10,updateRacePreview); bindRange("raceFatigueBefore",5,updateRacePreview); bindRange("raceFatigueAfter",5,updateRacePreview);
  ["raceDate","raceName","raceEvent","raceRound","raceResult","racePlace","raceWind","raceOfficial"].forEach(id=>$("#"+id).addEventListener("input",updateRacePreview));
  $("#historyTypeFilter").addEventListener("change",renderHistory);
  $("#historySearch").addEventListener("input",renderHistory);
  $("#historySearchClear")?.addEventListener("click",()=>{$("#historySearch").value="";renderHistory();$("#historySearch").focus();});
  $("#historyListModeBtn")?.addEventListener("click",()=>setHistoryDisplayMode("list"));
  $("#historyCalendarModeBtn")?.addEventListener("click",()=>setHistoryDisplayMode("calendar"));
  $("#historyCalendarPrev")?.addEventListener("click",()=>moveHistoryCalendarMonth(-1));
  $("#historyCalendarNext")?.addEventListener("click",()=>moveHistoryCalendarMonth(1));
  $("#historyCalendarToday")?.addEventListener("click",()=>{const d=new Date();historyCalendarCursor=new Date(d.getFullYear(),d.getMonth(),1);historySelectedDate=todayISO();renderHistory();});
  $("#exportBtn").addEventListener("click",exportData); $("#exportBtn2").addEventListener("click",exportData);
  $("#csvExportBtn")?.addEventListener("click",exportCsv);
  $("#bestSeasonYear")?.addEventListener("change",()=>{bestSeasonYear=Number($("#bestSeasonYear").value)||new Date().getFullYear();renderBestRecords();});
  $("#importInput").addEventListener("change",importData);
  $("#comparisonCloseBtn")?.addEventListener("click",closeTrainingComparison);
  $("#comparisonModal")?.addEventListener("click",e=>{if(e.target===$("#comparisonModal"))closeTrainingComparison();});
  document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!$("#comparisonModal")?.classList.contains("hidden"))closeTrainingComparison();});
  $("#eventGroup").addEventListener("change",()=>{ profile.eventGroup=$("#eventGroup").value; populateCategories(); populatePresetCategory(); });
  $("#installBtn").addEventListener("click",triggerInstall); $("#installBtn2").addEventListener("click",triggerInstall);
  $("#updateBtn").addEventListener("click",forceLatestReload);
  $("#bookmarkHelpBtn").addEventListener("click",()=>showBookmarkHelp(false));
  $("#copyUrlBtn").addEventListener("click",copyCurrentUrl);
  $("#persistBtn").addEventListener("click",requestPersistentStorage);
  $("#customMetricType").addEventListener("change",syncCustomDefaults);
}
function bindRange(id,max,callback){ const el=$("#"+id),out=$("#"+id+"Value"); el.addEventListener("input",()=>{out.textContent=`${el.value} / ${max}`; callback?.();}); }

function navigate(id){
  $$(".view").forEach(v=>v.classList.toggle("active",v.id===id));
  const navId=id==="bestView"?"historyView":id;
  $$(".bottom-nav button").forEach(b=>b.classList.toggle("active",b.dataset.nav===navId));
  if(id==="historyView")renderHistory(); if(id==="bestView")renderBestRecords(); if(id==="calendarView")renderMeets(); if(id==="homeView")renderHome(); if(id==="settingsView")updatePwaStatus();
  window.scrollTo({top:0,behavior:"smooth"});
}
function toggleActivityType(){
  const type=$('input[name="activityType"]:checked').value;
  $("#trainingForm").classList.toggle("hidden",type!=="training");
  $("#raceForm").classList.toggle("hidden",type!=="race");
  if(type==="race") updateRacePreview(); else liveRecalc();
}
function selectActivity(type){ const r=$(`input[name="activityType"][value="${type}"]`); if(r)r.checked=true; toggleActivityType(); }
function todayISO(){ const d=new Date(); return isoOfLocal(d); }
function isoOfLocal(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function fmtDate(s){ return new Intl.DateTimeFormat("ja-JP",{month:"short",day:"numeric",weekday:"short"}).format(new Date(`${s}T12:00:00`)); }
function esc(s=""){ return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m])); }
function parseTimeInput(value){
  const s=String(value??"").trim(); if(!s)return null;
  if(s.includes(":")){ const p=s.split(":").map(Number); if(p.some(x=>!Number.isFinite(x))||p.some(x=>x<0))return null; if(p.length===2&&p[1]<60)return p[0]*60+p[1]; if(p.length===3&&p[1]<60&&p[2]<60)return p[0]*3600+p[1]*60+p[2]; return null; }
  const n=Number(s); return Number.isFinite(n)&&n>0?n:null;
}
function parseRestInput(value){
  const s=String(value??"").trim(); if(!s)return null;
  if(s.includes(":"))return parseTimeInput(s);
  const n=Number(s); return Number.isFinite(n)&&n>=0?n*60:null;
}
function restInputValue(seconds,fallbackMin=null){
  const sec=Number(seconds); if(Number.isFinite(sec)&&sec>0){ if(Math.abs(sec%60)<1e-9)return String(Math.round(sec/60)); return timeInputValue(sec); }
  const min=Number(fallbackMin); return Number.isFinite(min)&&min>0?String(min):"";
}
function insertColonInto(input){
  if(!input)return; const value=String(input.value||""); if(value.includes(":")){input.focus();return;}
  const start=input.selectionStart==null?value.length:input.selectionStart,end=input.selectionEnd==null?start:input.selectionEnd;
  input.value=value.slice(0,start)+":"+value.slice(end); input.focus(); try{input.setSelectionRange(start+1,start+1);}catch{} input.dispatchEvent(new Event("input",{bubbles:true}));
}
function pacePerKmSeconds(distance,time){ const d=Number(distance),t=Number(time); return d>0&&t>0?t*1000/d:null; }
function paceText(distance,time){ const p=pacePerKmSeconds(distance,time); return p?`${timeFmt(p).replace("秒","")} /km`:"--"; }
function isEnduranceCategory(cat){ return ["pace","interval","repetition","jog","long_run","build_up","tempo"].includes(cat); }
function clockSecondText(sec){ const s=Number(sec); if(!Number.isFinite(s))return"00"; const rounded=Math.round(s),hasFraction=Math.abs(s-rounded)>=0.005; return hasFraction?s.toFixed(2).padStart(5,"0"):String(rounded).padStart(2,"0"); }
function timeFmt(v){
  if(v==null||!Number.isFinite(v))return"--";
  if(v>=3600){const h=Math.floor(v/3600),m=Math.floor((v%3600)/60),s=v%60;return`${h}:${String(m).padStart(2,"0")}:${clockSecondText(s)}`;}
  if(v>=60){const m=Math.floor(v/60),s=v-m*60;return`${m}:${clockSecondText(s)}`;}
  return`${v.toFixed(2)}秒`;
}
function daysTo(from,to){ return Math.round((new Date(`${to}T12:00:00`)-new Date(`${from}T12:00:00`))/86400000); }
function uniqueId(){ return crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random().toString(16).slice(2)}`; }

function standardOptions(){ return CATEGORY_GROUPS[profile.eventGroup]||CATEGORY_GROUPS.sprint; }
function menuUsageKey(item){
  if(isCustomRecord(item))return `custom:${item.customMenuId||item.customMenuName||"unknown"}`;
  if(isWeightRecord(item))return "std:weights";
  return `std:${item.category||"unknown"}`;
}
function usageSortValue(key){
  const s=menuUsageStats[key]||{}; return {recent30:Number(s.recent30)||0,total:Number(s.total)||0,lastDate:s.lastDate||""};
}
function compareByUsage(aKey,bKey){
  const a=usageSortValue(aKey),b=usageSortValue(bKey);
  return b.recent30-a.recent30 || String(b.lastDate).localeCompare(String(a.lastDate)) || b.total-a.total;
}
async function refreshMenuUsageStats(){
  const trainings=await getAll("trainings"), today=todayISO(), stats={};
  for(const record of trainings){
    for(const item of sessionItems(record)){
      const key=menuUsageKey(item); if(key.endsWith(":unknown"))continue;
      const st=stats[key]||(stats[key]={total:0,recent30:0,lastDate:""}); st.total++;
      if(item.date&&daysTo(item.date,today)>=0&&daysTo(item.date,today)<30)st.recent30++;
      if(item.date&&item.date>st.lastDate)st.lastDate=item.date;
    }
  }
  menuUsageStats=stats;
}
function populateCategories(){
  const current=$("#category")?.value||"";
  const standard=[...standardOptions()].sort((a,b)=>compareByUsage(`std:${a[0]}`,`std:${b[0]}`));
  const sorted=[...customMenus].sort((a,b)=>(b.favorite?1:0)-(a.favorite?1:0)||compareByUsage(`custom:${a.id}`,`custom:${b.id}`)||a.name.localeCompare(b.name,"ja"));
  let html=`<optgroup label="標準メニュー（よく使う順）">${standard.map(([v,l])=>`<option value="std:${v}">${l}</option>`).join("")}</optgroup>`;
  if(sorted.length) html+=`<optgroup label="カスタム（よく使う順・コーチ評価対象外）">${sorted.map(x=>`<option value="custom:${x.id}">${x.favorite?"★ ":""}${esc(x.name)}</option>`).join("")}</optgroup>`;
  $("#category").innerHTML=html;
  if(current&&[...$("#category").options].some(o=>o.value===current))$("#category").value=current;
  toggleTrainingFields();
}
function populatePresetCategory(){ $("#presetCategory").innerHTML=standardOptions().filter(x=>x[0]!=="weights").map(([v,l])=>`<option value="${v}">${l}</option>`).join(""); }
function populateRaceEvents(){
  const opts=PB_EVENTS.map(e=>`<option value="${e.key}">${e.key}</option>`).join("");
  $("#raceEvent").innerHTML=opts; $("#meetEvent").innerHTML=opts; $("#primaryEvent").innerHTML=opts;
}
function renderProfile(){
  $("#age").value=profile.age||18; $("#eventGroup").value=profile.eventGroup||"sprint"; $("#primaryEvent").value=profile.primaryEvent||"100m";
  $("#pbEditor").innerHTML=PB_EVENTS.map(e=>`<label class="pb-entry">${e.key}<input data-pb-key="${e.key}" type="text" inputmode="text" value="${profile.pbs?.[e.key]?timeInputValue(profile.pbs[e.key]):""}" placeholder="秒 / 分:秒"></label>`).join("");
}
function timeInputValue(v){ if(!v)return""; if(v>=60)return timeFmt(v).replace("秒",""); return Number(v).toFixed(2); }
function trainingPb(distance){ return Number(profile.pbs?.[`${distance}m`]||profile.pbs?.[distance])||null; }
function parseMenuSelection(){ const v=$("#category").value||""; if(v.startsWith("custom:")){const id=v.slice(7);return{kind:"custom",custom:customMenus.find(x=>String(x.id)===id)}}; const cat=v.replace(/^std:/,""); return{kind:cat==="weights"?"weight":"running",category:cat}; }
function toggleTrainingFields(){
  const s=parseMenuSelection(); $("#runningFields").classList.toggle("hidden",s.kind!=="running"); $("#weightFields").classList.toggle("hidden",s.kind!=="weight"); $("#customFields").classList.toggle("hidden",s.kind!=="custom");
  const isFlying=s.kind==="running"&&s.category==="flying", isBlocks=s.kind==="running"&&s.category==="starting_blocks", isLongSprint=s.kind==="running"&&s.category==="speed_endurance", isEndurance=s.kind==="running"&&isEnduranceCategory(s.category);
  $("#flyingFields").classList.toggle("hidden",!isFlying); $("#startingBlockHint").classList.toggle("hidden",!isBlocks); $("#longSprintHint").classList.toggle("hidden",!isLongSprint); $("#enduranceHint").classList.toggle("hidden",!isEndurance);
  $("#distanceLabelText").textContent=isFlying?"計測距離":"距離";
  if(isEndurance){ const title={pace:"ペース走（一定ペース）",interval:"インターバル走",repetition:"レペティション",jog:"ジョグ",long_run:"ロング走・LSD",build_up:"ビルドアップ",tempo:"テンポ走"}[s.category]||"長距離系メニュー"; $("#enduranceHintTitle").textContent=title; $("#enduranceHintText").textContent=["jog","long_run"].includes(s.category)?"タイムは 25:00、1:02:30 のように入力できます。ジョグ・ロング走は、距離が分からない場合でも所要時間だけで保存できます。":"タイムは 3:20、5:45、25:00 のように入力できます。距離とタイムがあれば平均ペース（/km）も自動計算します。"; }
  if(s.kind==="custom"&&s.custom){ $("#customMenuTitle").textContent=(s.custom.favorite?"★ ":"")+s.custom.name; $("#customBaselineDisplay").value=s.custom.baseline; $("#customBaselineUnit").textContent=s.custom.unit; $("#customDirectionHint").textContent=customDirection(s.custom)==="lower"?"小さいほど高パフォーマンス":"大きいほど高パフォーマンス"; renderCustomValueRows(true); }
  if(s.kind==="weight")renderWeightPresetOptions();
}
function renderTimeRows(keep=true){
  const reps=Math.max(1,Math.min(40,Number($("#reps").value)||1)),sets=Math.max(1,Math.min(12,Number($("#sets").value)||1)),n=Math.min(80,reps*sets),old=$$(".rep-time").map(x=>x.value),cat=parseMenuSelection().category,isLong=isEnduranceCategory(cat)||Number($("#distance").value)>=600;
  $("#timeRows").innerHTML=Array.from({length:n},(_,i)=>{const set=Math.floor(i/reps)+1,rep=i%reps+1,label=sets>1?`S${set}-${rep}`:`${rep}本目`;return`<div class="time-row"><span>${label}</span><div class="smart-time"><input class="rep-time" type="text" inputmode="text" autocomplete="off" value="${keep?(old[i]||""):""}" placeholder="${isLong?'3:20':'12.34'}"><button class="time-colon-btn" type="button" aria-label="コロンを入力">:</button></div><span class="ratio-tag" data-ratio-row="${i}">--</span></div>`;}).join("");
  $$(".rep-time").forEach(x=>x.addEventListener("input",liveRecalc)); $$("#timeRows .time-colon-btn").forEach(btn=>btn.addEventListener("click",()=>insertColonInto(btn.previousElementSibling)));
}
function toggleMode(){ const detail=$('input[name="mode"]:checked').value==="detail"; $("#detailTimesBlock").classList.toggle("hidden",!detail); $("#simpleTimeBlock").classList.toggle("hidden",detail); liveRecalc(); }
function customDirection(m){ return m?.evaluationDirection||(m?.metricType==="time"?"lower":"higher"); }
function renderCustomValueRows(keep=true){
  const s=parseMenuSelection(),m=s.custom;if(!m)return; const n=Math.max(1,Math.min(60,Number($("#customAttempts").value)||1)),old=$$(".custom-value").map(x=>x.value);
  $("#customValueRows").innerHTML=Array.from({length:n},(_,i)=>`<div class="time-row"><span>${i+1}回目</span><div class="with-unit"><input class="custom-value" type="number" min="0" step="0.01" inputmode="decimal" value="${keep?(old[i]||""):""}"><span>${esc(m.unit)}</span></div><span class="ratio-tag"></span></div>`).join("");
  $$(".custom-value").forEach(x=>x.addEventListener("input",liveRecalc));
}
function representativeCustom(m,values){ if(!values.length)return null; if(m.compareMode==="average")return mean(values); return customDirection(m)==="lower"?Math.min(...values):Math.max(...values); }
function performanceVsBaseline(m,value){ if(!m||!value||!m.baseline)return null; return customDirection(m)==="lower"?(m.baseline/value-1)*100:(value/m.baseline-1)*100; }
function currentSessionCommon(){
  return{activityType:"training",date:$("#trainingDate").value,fatigueBefore:Number($("#fatigueBefore").value),fatigueAfter:Number($("#fatigueAfter").value),durationMin:Number($("#durationMin").value)||null,notes:$("#notes").value.trim()};
}
function currentMenuDraft(){
  const s=parseMenuSelection();
  if(s.kind==="custom"){
    const m=s.custom,values=$$(".custom-value").map(x=>Number(x.value)).filter(x=>x>0),rep=representativeCustom(m,values);
    return{subtype:"custom",isCustom:true,customMenuId:m?.id,customMenuName:m?.name,metricType:m?.metricType,unit:m?.unit,baseline:Number(m?.baseline)||null,compareMode:m?.compareMode||"best",evaluationDirection:customDirection(m),values,representativeValue:rep,performancePct:performanceVsBaseline(m,rep)};
  }
  if(s.kind==="weight"){
    const kg=Number($("#weightKg").value)||0,reps=Number($("#weightReps").value)||1,sets=Number($("#weightSets").value)||1;
    return{subtype:"weight",isWeight:true,category:"weights",weightExerciseId:$("#weightExerciseSelect").value||null,weightExerciseName:$("#weightExerciseName").value.trim(),weightKg:kg,weightReps:reps,weightSets:sets,weightVolume:kg*reps*sets};
  }
  const detail=$('input[name="mode"]:checked').value==="detail",times=detail?$$(".rep-time").map(x=>parseTimeInput(x.value)).filter(Number.isFinite):[],avg=detail?mean(times):parseTimeInput($("#averageTime").value),dist=Number($("#distance").value)||null,pb=dist?trainingPb(dist):null,restSeconds=parseRestInput($("#restMin").value),setRestSeconds=parseRestInput($("#setRestMin").value);
  return{subtype:"running",isCustom:false,isWeight:false,category:s.category,distance:dist,approachDistance:s.category==="flying"?(Number($("#flyingApproachDistance").value)||null):null,reps:Number($("#reps").value)||1,sets:Number($("#sets").value)||1,restSeconds:restSeconds||null,setRestSeconds:setRestSeconds||null,restMin:restSeconds!=null?restSeconds/60:null,setRestMin:setRestSeconds!=null?setRestSeconds/60:null,mode:detail?"detail":"simple",times,averageTime:avg,paceSecPerKm:pacePerKmSeconds(dist,avg),pb,pbRatio:pbRatio(pb,avg),dropPct:detail?maxDrop(times):null};
}
function currentTrainingDraft(){ return{...currentSessionCommon(),...currentMenuDraft()}; }
function menuDraftIsEmpty(d){
  if(d.isCustom)return !d.customMenuId || !d.representativeValue;
  if(d.isWeight)return !d.weightExerciseName;
  return !d.category || (!d.distance && !bestTrainingTime(d));
}
function validateMenuDraft(d){
  if(d.isCustom){ if(!d.customMenuId||!d.representativeValue)return "カスタムメニューの記録を入力してください"; }
  else if(d.isWeight){ if(!d.weightExerciseName)return "ウェイト種目名を入力してください"; }
  else {
    if(!d.category)return "練習メニューを選択してください";
    const timeOnlyOk=["jog","long_run"].includes(d.category)&&bestTrainingTime(d)>0;
    if(!d.distance&&!timeOnlyOk)return ["jog","long_run"].includes(d.category)?"距離を入力するか、所要時間を入力してください":"距離を入力してください";
  }
  return "";
}
function menuItemSummary(d){
  if(isWeightRecord(d))return `${d.weightExerciseName||"ウェイト"} ${d.weightKg||0}kg × ${d.weightReps||0}rep × ${d.weightSets||0}set`;
  if(isCustomRecord(d))return `${d.customMenuName||"カスタム"} ${d.representativeValue!=null?Number(d.representativeValue).toFixed(2)+(d.unit||""):""}`;
  const main=runningMenuSummary(d), reps=`${d.reps||1}本${d.sets>1?` × ${d.sets}set`:""}`, t=Number(d.averageTime)>0?` / ${d.reps>1?"平均 ":""}${timeFmt(Number(d.averageTime))}`:" / タイム未入力", pace=d.distance&&d.averageTime?` / ${paceText(d.distance,d.averageTime)}`:"";
  return `${main} / ${reps}${t}${pace}`;
}
function cloneValue(v){ return typeof structuredClone==="function"?structuredClone(v):JSON.parse(JSON.stringify(v)); }
function updateMenuEditorState(){
  const editing=editingSessionItemIndex!=null;
  $("#menuEditorTitle").textContent=editing?`練習内容 ${editingSessionItemIndex+1} を編集`:"練習内容を入力";
  $("#menuEditorModeLabel").textContent=editing?"編集中":"1メニューずつ追加";
  $("#addTrainingItemBtn").textContent=editing?"この練習内容を更新":"＋ この練習内容を追加";
  $("#cancelMenuItemEditBtn").classList.toggle("hidden",!editing);
}
function renderSessionItemsDraft(){
  const box=$("#sessionItemsList"),count=$("#sessionItemCount"),clear=$("#clearTrainingItemsBtn"); if(!box)return;
  count.textContent=`${sessionItemsDraft.length}件追加済み`; clear.classList.toggle("hidden",!sessionItemsDraft.length);
  box.innerHTML=sessionItemsDraft.length?sessionItemsDraft.map((x,i)=>`<div class="session-draft-item ${editingSessionItemIndex===i?'editing':''}"><div><span class="session-draft-number">${i+1}</span><strong>${esc(menuItemSummary(x))}</strong></div><div class="setting-actions"><button type="button" class="small-btn" onclick="editSessionDraftItem(${i})">編集</button><button type="button" class="delete-btn" onclick="removeSessionDraftItem(${i})">削除</button></div></div>`).join(""):'<div class="muted">まだ追加されていません。1つ目のメニューを入力し、下の「＋ この練習内容を追加」を押してください。</div>';
  updateMenuEditorState();
}
function removeSessionDraftItem(index){
  index=Number(index); sessionItemsDraft.splice(index,1);
  if(editingSessionItemIndex===index){ editingSessionItemIndex=null; resetMenuEditor(); }
  else if(editingSessionItemIndex!=null&&index<editingSessionItemIndex) editingSessionItemIndex--;
  renderSessionItemsDraft(); liveRecalc();
}
function clearTrainingItemsDraft(){ if(!sessionItemsDraft.length)return; if(!confirm("追加済みの練習内容をすべて外しますか？"))return; sessionItemsDraft=[]; editingSessionItemIndex=null; resetMenuEditor(); renderSessionItemsDraft(); liveRecalc(); }
function resetMenuEditor(){
  editingSessionItemIndex=null;
  $("#presetSelect").value=""; populateCategories(); $("#distance").value=""; $("#flyingApproachDistance").value=""; $("#reps").value=1; $("#sets").value=1; $("#restMin").value=""; $("#setRestMin").value=""; $("#averageTime").value=""; const mode=$('input[name="mode"][value="detail"]'); if(mode)mode.checked=true;
  $("#customAttempts").value=1; $("#weightExerciseSelect").value=""; $("#weightExerciseName").value=""; $("#weightKg").value=""; $("#weightReps").value=5; $("#weightSets").value=3; renderTimeRows(false); renderCustomValueRows(false); toggleTrainingFields(); updateMenuEditorState();
}
function setCategoryForItem(item){
  let value="";
  if(isCustomRecord(item)) value=`custom:${item.customMenuId}`;
  else if(isWeightRecord(item)) value="std:weights";
  else value=`std:${item.category}`;
  if([...$("#category").options].some(o=>o.value===value)) $("#category").value=value;
  else return false;
  toggleTrainingFields(); return true;
}
function loadMenuItemIntoEditor(item){
  if(!setCategoryForItem(item)){ toast("この記録は現在のメニュー設定では直接編集できません"); return false; }
  if(isWeightRecord(item)){
    renderWeightPresetOptions(); $("#weightExerciseSelect").value=item.weightExerciseId||""; $("#weightExerciseName").value=item.weightExerciseName||""; $("#weightKg").value=item.weightKg??""; $("#weightReps").value=item.weightReps||1; $("#weightSets").value=item.weightSets||1;
  }else if(isCustomRecord(item)){
    const vals=Array.isArray(item.values)?item.values:[]; $("#customAttempts").value=Math.max(1,vals.length||1); renderCustomValueRows(false); $$(".custom-value").forEach((el,i)=>el.value=vals[i]??"");
  }else{
    $("#distance").value=item.distance??""; $("#flyingApproachDistance").value=item.approachDistance??""; $("#reps").value=item.reps||1; $("#sets").value=item.sets||1; $("#restMin").value=restInputValue(item.restSeconds,item.restMin); $("#setRestMin").value=restInputValue(item.setRestSeconds,item.setRestMin);
    const detail=item.mode!=="simple"; const r=$(detail?'input[name="mode"][value="detail"]':'input[name="mode"][value="simple"]'); if(r)r.checked=true;
    $("#detailTimesBlock").classList.toggle("hidden",!detail); $("#simpleTimeBlock").classList.toggle("hidden",detail); renderTimeRows(false);
    if(detail){ const times=Array.isArray(item.times)?item.times:[]; $$(".rep-time").forEach((el,i)=>el.value=times[i]!=null?timeInputValue(Number(times[i])):""); }
    else $("#averageTime").value=item.averageTime!=null?timeInputValue(Number(item.averageTime)):"";
  }
  return true;
}
async function editSessionDraftItem(index){
  index=Number(index); const item=sessionItemsDraft[index]; if(!item)return;
  editingSessionItemIndex=index; if(!loadMenuItemIntoEditor(item)){ editingSessionItemIndex=null; updateMenuEditorState(); return; }
  renderSessionItemsDraft(); await liveRecalc(); document.querySelector(".menu-editor")?.scrollIntoView({behavior:"smooth",block:"start"});
}
function cancelSessionItemEdit(){ resetMenuEditor(); renderSessionItemsDraft(); liveRecalc(); }
async function addTrainingItem(){
  const d=currentMenuDraft(),err=validateMenuDraft(d); if(err)return toast(err); const copy=cloneValue(d);
  if(editingSessionItemIndex!=null){ const idx=editingSessionItemIndex; sessionItemsDraft[idx]=copy; resetMenuEditor(); renderSessionItemsDraft(); toast("練習内容を更新しました"); }
  else { sessionItemsDraft.push(copy); renderSessionItemsDraft(); resetMenuEditor(); toast("練習内容を追加しました。続けて次のメニューを入力できます"); }
  await liveRecalc();
}
function buildSessionDraft(includeCurrent=true){
  const common=currentSessionCommon(), items=sessionItemsDraft.map(cloneValue), current=currentMenuDraft();
  if(includeCurrent&&!menuDraftIsEmpty(current)){
    if(editingSessionItemIndex!=null&&items[editingSessionItemIndex]) items[editingSessionItemIndex]=current;
    else items.push(current);
  }
  return{...common,recordType:"daily_session",subtype:"session",isSession:true,items};
}
function annotateSessionTrainingBests(session,history=[]){
  const working=[...history], out={...session,items:(session.items||[]).map(cloneValue)};
  out.items=out.items.map(item=>{
    if(!isRunningRecord(item))return item;
    const withDate={...item,date:session.date,activityType:"training"}, st=trainingBestStats(withDate,working), annotated={...item,trainingBestCurrent:st.currentBest,trainingBestBefore:st.previousBest,isTrainingBest:!!st.isBest,trainingBestImprovementSec:st.improvementSec,trainingBestImprovementPct:st.improvementPct};
    working.push({...annotated,date:session.date,activityType:"training"}); return annotated;
  });
  return out;
}
function trainingBestPreviewText(st){
  if(st.currentBest!=null&&st.isBest)return `NEW ${timeFmt(st.currentBest)}`;
  if(st.previousBest!=null)return `過去 ${timeFmt(st.previousBest)}`;
  if(st.currentBest!=null)return `初回 ${timeFmt(st.currentBest)}`;
  return "記録なし";
}
async function liveRecalc(){
  const d=currentTrainingDraft(), allHistory=await getAll("trainings"), history=editingTrainingId?allHistory.filter(x=>Number(x.id)!==Number(editingTrainingId)):allHistory;
  if(d.isCustom){ $("#customRepresentative").textContent=d.representativeValue!=null?`${d.representativeValue.toFixed(2)} ${d.unit}`:"--"; $("#customBaselinePreview").textContent=d.baseline?`${Number(d.baseline).toFixed(2)} ${d.unit}`:"--"; $("#customPerformancePreview").textContent=d.performancePct!=null?`${d.performancePct>=0?"+":""}${d.performancePct.toFixed(1)}%`:"--"; }
  else if(d.isWeight){
    $("#weightVolumePreview").textContent=d.weightKg?`${d.weightVolume.toFixed(0)} kg`:"自重/未入力";
    const all=expandTrainings(history),prev=[...all].filter(x=>isWeightRecord(x)&&x.weightExerciseName===d.weightExerciseName&&x.date<=d.date).sort((a,b)=>b.date.localeCompare(a.date)||(b.id||0)-(a.id||0))[0];
    $("#weightPreviousPreview").textContent=prev?.weightVolume?`${prev.weightVolume.toFixed(0)} kg`:"--"; $("#weightDeltaPreview").textContent=prev?.weightVolume&&d.weightVolume?`${d.weightVolume>=prev.weightVolume?"+":""}${((d.weightVolume/prev.weightVolume-1)*100).toFixed(1)}%`:"--";
  } else {
    const bestStats=trainingBestStats(d,history);
    $("#pbPreview").textContent=d.pb?timeFmt(d.pb):"未登録"; $("#pbRatioPreview").textContent=d.averageTime==null?"未計測":d.pbRatio?`${d.pbRatio.toFixed(1)}%`:"PB未登録"; $("#pacePreview").textContent=d.distance&&d.averageTime?paceText(d.distance,d.averageTime):"--"; $("#dropPreview").textContent=d.averageTime==null?"未計測":d.dropPct!=null?`${d.dropPct.toFixed(1)}%`:"比較なし";
    $("#trainingBestPreview").textContent=trainingBestPreviewText(bestStats);
    $("#trainingBestPreview").classList.toggle("new-best",!!bestStats.isBest);
    $$(".rep-time").forEach((el,i)=>{const t=parseTimeInput(el.value),r=pbRatio(d.pb,t),tag=document.querySelector(`[data-ratio-row="${i}"]`); if(tag)tag.textContent=r?`${r.toFixed(1)}%`:"--";});
  }
  const meets=await getAll("meets"),next=findNextMeet(meets,d.date);
  if(sessionItemsDraft.length){ const sess=annotateSessionTrainingBests(buildSessionDraft(true),history); $("#liveCoach").textContent=buildSessionCoachComment(sess,history,profile,next); $("#liveCoach").classList.remove("custom-note"); }
  else { $("#liveCoach").textContent=buildCoachComment(d,history,profile,next); $("#liveCoach").classList.toggle("custom-note",d.isCustom||d.isWeight); }
}
async function saveTraining(e){
  e.preventDefault();
  if(editingSessionItemIndex!=null){ const err=validateMenuDraft(currentMenuDraft()); if(err)return toast(`編集中の練習内容を確認してください：${err}`); }
  let session=buildSessionDraft(true); if(!session.date)return toast("日付を入力してください"); if(!session.items.length)return toast("練習内容を1つ以上追加してください");
  for(let i=0;i<session.items.length;i++){const err=validateMenuDraft(session.items[i]);if(err)return toast(`練習内容${i+1}を確認してください：${err}`);}
  const history=await getAll("trainings"),meets=await getAll("meets"),now=new Date().toISOString(),historyForCoach=editingTrainingId?history.filter(x=>Number(x.id)!==Number(editingTrainingId)):history;
  session=annotateSessionTrainingBests(session,historyForCoach); session.coach=buildSessionCoachComment(session,historyForCoach,profile,findNextMeet(meets,session.date)); session.coachVersion="3.0"; session.updatedAt=now;
  if(editingTrainingId){ const existing=history.find(x=>Number(x.id)===Number(editingTrainingId)); session.id=Number(editingTrainingId); session.createdAt=existing?.createdAt||editingTrainingCreatedAt||now; await putRecord("trainings",session); toast("練習記録を更新しました。タイムなどの変更を反映して簡易診断も再計算しました"); }
  else { session.createdAt=now; await addRecord("trainings",session); toast(session.items.length>1?`${session.items.length}メニューを1日の練習として保存しました`:"この日の練習を保存しました"); }
  const wasEditing=editingTrainingId!=null; await refreshMenuUsageStats(); resetTrainingForm(); await refreshAll(); navigate(wasEditing?"historyView":"homeView");
}
function updateTrainingEditState(){
  const editing=editingTrainingId!=null; $("#trainingEditBanner").classList.toggle("hidden",!editing); $("#trainingSubmitBtn").textContent=editing?"編集内容を保存して診断を更新":"この日の練習をまとめて保存";
}
function resetTrainingForm(){
  sessionItemsDraft=[]; editingTrainingId=null; editingTrainingCreatedAt=null; editingSessionItemIndex=null; $("#trainingForm").reset(); $("#trainingDate").value=todayISO(); $("#reps").value=1; $("#sets").value=1; $("#customAttempts").value=1; $("#weightReps").value=5; $("#weightSets").value=3; $("#fatigueBefore").value=2; $("#fatigueAfter").value=3; $("#fatigueBeforeValue").textContent="2 / 5"; $("#fatigueAfterValue").textContent="3 / 5"; $("#advancedFields").classList.add("hidden"); populateCategories(); renderTimeRows(false); renderCustomValueRows(false); renderSessionItemsDraft(); updateTrainingEditState();
}
function legacyTrainingItem(record){
  const skip=new Set(["id","activityType","date","fatigueBefore","fatigueAfter","fatigue","durationMin","notes","coach","createdAt","updatedAt","recordType","isSession"]),item={}; Object.keys(record||{}).forEach(k=>{if(!skip.has(k))item[k]=cloneValue(record[k]);}); return item;
}
async function startEditTraining(id){
  const all=await getAll("trainings"),record=all.find(x=>Number(x.id)===Number(id)); if(!record)return toast("編集する記録が見つかりませんでした");
  resetTrainingForm(); editingTrainingId=Number(record.id); editingTrainingCreatedAt=record.createdAt||null; sessionItemsDraft=(isDailySession(record)?record.items:[legacyTrainingItem(record)]).map(cloneValue);
  $("#trainingDate").value=record.date||todayISO(); $("#fatigueBefore").value=Number(record.fatigueBefore||record.fatigue||2); $("#fatigueAfter").value=Number(record.fatigueAfter||record.fatigue||3); $("#fatigueBeforeValue").textContent=`${$("#fatigueBefore").value} / 5`; $("#fatigueAfterValue").textContent=`${$("#fatigueAfter").value} / 5`; $("#durationMin").value=record.durationMin??""; $("#notes").value=record.notes||"";
  if(record.durationMin||record.notes) $("#advancedFields").classList.remove("hidden"); renderSessionItemsDraft(); updateTrainingEditState(); navigate("entryView"); selectActivity("training"); await liveRecalc(); window.scrollTo({top:0,behavior:"smooth"});
}
function cancelTrainingEdit(){ if(!editingTrainingId)return; if(!confirm("編集中の変更を破棄しますか？"))return; resetTrainingForm(); navigate("historyView"); }

function windSensitive(event){ return ["100m","200m","100mH","110mH"].includes(event); }
function currentRaceDraft(){
  return{id:Number($("#raceMeetId").value)||undefined,activityType:"race",status:"completed",date:$("#raceDate").value,name:$("#raceName").value.trim(),event:$("#raceEvent").value,round:$("#raceRound").value,resultSeconds:parseTimeInput($("#raceResult").value),place:Number($("#racePlace").value)||null,wind:$("#raceWind").value===""?null:Number($("#raceWind").value),official:$("#raceOfficial").checked,fatigueBefore:Number($("#raceFatigueBefore").value),fatigueAfter:Number($("#raceFatigueAfter").value),rpe:Number($("#raceRpe").value),notes:$("#raceNotes").value.trim()};
}
function priorRaceEligibleForSeasonBest(x){
  if(!x?.resultSeconds)return false;
  if(!windSensitive(x.event))return x.official!==false;
  if(x.windAssisted)return false;
  if(x.pbEligible===true)return true;
  return x.official!==false&&Number.isFinite(Number(x.wind))&&Number(x.wind)<=2.0;
}
function applyRacePerformanceFlags(d,meets=[]){
  const out={...d},oldPB=Number(profile.pbs?.[out.event])||null;
  const eligible=!!out.official && (!windSensitive(out.event) || (out.wind!=null && Number(out.wind)<=2.0));
  out.pbBefore=oldPB; out.pbEligible=eligible; out.windAssisted=windSensitive(out.event)&&out.wind!=null&&Number(out.wind)>2.0; out.windMissing=windSensitive(out.event)&&out.wind==null;
  out.isPB=!!out.resultSeconds && eligible && (!oldPB || Number(out.resultSeconds)<oldPB);
  const year=String(out.date||"").slice(0,4),priorSame=meets.filter(x=>x.status==="completed"&&x.event===out.event&&x.resultSeconds&&x.date?.startsWith(year)&&Number(x.id)!==Number(out.id)&&priorRaceEligibleForSeasonBest(x));
  const priorSB=priorSame.length?Math.min(...priorSame.map(x=>Number(x.resultSeconds))):null; out.sbBefore=priorSB; out.isSB=!!out.resultSeconds&&eligible&&(!priorSB||Number(out.resultSeconds)<priorSB);
  return out;
}
async function updateRacePreview(){
  const raw=currentRaceDraft();
  if(!raw.date||!raw.name){$("#raceAnalysisPreview").textContent="大会名と日付を入力すると、直前の練習状況をプレビューします。"; $("#raceResultPreview").textContent="記録を入力すると、PB・SB・前回レース・最近の結果・風・疲労を組み合わせてコメントします。"; return;}
  const tr=await getAll("trainings"),meets=await getAll("meets"),d=applyRacePerformanceFlags(raw,meets),prep=buildRaceAnalysis(d,tr,profile); d.racePreparationAnalysis=prep; $("#raceAnalysisPreview").textContent=prep.text;
  if(d.resultSeconds){const rc=buildRaceResultComment(d,tr,meets,profile);$("#raceResultPreview").textContent=rc.text;}else $("#raceResultPreview").textContent="記録を入力すると、PB・SB・前回レース・最近の中央値・風・疲労を客観的に比較します。";
}
async function saveRace(e){
  e.preventDefault(); let d=currentRaceDraft(); if(!d.date||!d.name||!d.event||!d.resultSeconds)return toast("大会名・日付・種目・記録を入力してください");
  const meets=await getAll("meets"), existing=d.id?meets.find(x=>Number(x.id)===Number(d.id)):null; d=applyRacePerformanceFlags(d,meets);
  const trainings=await getAll("trainings"); d.racePreparationAnalysis=buildRaceAnalysis(d,trainings,profile); d.raceResultComment=buildRaceResultComment(d,trainings,meets,profile); d.updatedAt=new Date().toISOString(); d.createdAt=existing?.createdAt||new Date().toISOString();
  if(existing) await putRecord("meets",{...existing,...d,id:existing.id}); else {delete d.id; await addRecord("meets",d);}
  if(d.isPB){ profile.pbs[d.event]=d.resultSeconds; await setSetting("profile",profile); renderProfile(); toast(`試合結果を保存しました。NEW PB ${timeFmt(d.resultSeconds)}`); }
  else if(d.isSB) toast(`試合結果を保存しました。SB ${timeFmt(d.resultSeconds)}`);
  else if(d.windAssisted) toast("試合結果を保存しました（追い風参考のためPB/SB自動更新なし）");
  else if(d.windMissing&&d.official) toast("試合結果を保存しました（風速未入力のためPB/SB自動更新なし）");
  else toast("試合結果を保存しました");
  resetRaceForm(); await refreshAll(); navigate("homeView");
}
function resetRaceForm(){ $("#raceForm").reset(); $("#raceMeetId").value=""; $("#raceDate").value=todayISO(); $("#raceOfficial").checked=true; $("#raceFatigueBefore").value=2; $("#raceFatigueAfter").value=4; $("#raceRpe").value=9; $("#raceFatigueBeforeValue").textContent="2 / 5"; $("#raceFatigueAfterValue").textContent="4 / 5"; $("#raceRpeValue").textContent="9 / 10"; $("#raceAnalysisPreview").textContent="保存すると、試合前3日・7日の状態を分析します。"; $("#raceResultPreview").textContent="記録を入力すると、PB・SB・前回レース・最近の結果・風・疲労を組み合わせてコメントします。"; }
async function startRaceFromMeet(id){
  const meets=await getAll("meets"),m=meets.find(x=>Number(x.id)===Number(id)); if(!m)return; navigate("entryView"); selectActivity("race"); $("#raceMeetId").value=m.id; $("#raceDate").value=m.date; $("#raceName").value=m.name; if(PB_EVENTS.some(e=>e.key===m.event))$("#raceEvent").value=m.event; await updateRacePreview();
}

async function saveMeet(e){ e.preventDefault(); await addRecord("meets",{activityType:"race",status:"planned",name:$("#meetName").value.trim(),date:$("#meetDate").value,event:$("#meetEvent").value,createdAt:new Date().toISOString()}); e.target.reset(); $("#meetDate").value=todayISO(); toast("大会予定を追加しました"); await refreshAll(); }
async function removeMeet(id){ if(!confirm("この大会記録・予定を削除しますか？"))return; await deleteRecord("meets",Number(id)); await refreshAll(); }
function findNextMeet(meets,base=todayISO()){ return [...meets].filter(x=>x.status!=="completed"&&x.date>=base).sort((a,b)=>a.date.localeCompare(b.date))[0]||null; }

async function saveProfile(e){
  e.preventDefault(); const pbs={...profile.pbs}; $$('[data-pb-key]').forEach(x=>{const v=parseTimeInput(x.value); if(v)pbs[x.dataset.pbKey]=v; else delete pbs[x.dataset.pbKey];});
  profile={age:Number($("#age").value)||18,eventGroup:$("#eventGroup").value,primaryEvent:$("#primaryEvent").value,pbs}; await setSetting("profile",profile); populateCategories(); populatePresetCategory(); toast("プロフィールを保存しました"); liveRecalc(); renderHome();
}
async function savePreset(e){
  e.preventDefault(); const restSeconds=parseRestInput($("#presetRest").value); presets.push({id:uniqueId(),name:$("#presetName").value.trim(),category:$("#presetCategory").value,distance:Number($("#presetDistance").value),reps:Number($("#presetReps").value)||1,sets:Number($("#presetSets").value)||1,restSeconds:restSeconds||null,restMin:restSeconds!=null?restSeconds/60:null,favorite:$("#presetFavorite").checked}); await setSetting("presets",presets); e.target.reset(); $("#presetReps").value=3; $("#presetSets").value=1; renderPresetOptions(); renderPresetList(); toast("入力プリセットを追加しました");
}
function renderPresetOptions(){
  const valid=new Set(standardOptions().filter(x=>x[0]!=="weights").map(x=>x[0]));
  const sorted=[...presets].filter(x=>valid.has(x.category)).sort((a,b)=>(b.favorite?1:0)-(a.favorite?1:0)||a.name.localeCompare(b.name,"ja"));
  $("#presetSelect").innerHTML='<option value="">プリセットを使わない</option>'+sorted.map(x=>`<option value="${x.id}">${x.favorite?"★ ":""}${esc(x.name)}</option>`).join("");
}
function renderPresetList(){ if(!presets.length){$("#presetList").innerHTML='<div class="muted">まだプリセットはありません。</div>';return;} $("#presetList").innerHTML=[...presets].sort((a,b)=>(b.favorite?1:0)-(a.favorite?1:0)).map(x=>`<div class="setting-item"><div><strong>${x.favorite?'<span class="star">★</span> ':''}${esc(x.name)}</strong><div class="meta">${esc(CATEGORY_LABELS[x.category]||x.category)} / ${x.distance}m × ${x.reps}${x.sets>1?` × ${x.sets}set`:""}${(x.restSeconds||x.restMin)?` / R=${restInputValue(x.restSeconds,x.restMin)}`:""}</div></div><div class="setting-actions"><button class="star-btn ${x.favorite?'active':''}" onclick="togglePresetFavorite('${x.id}')" type="button">★</button><button class="delete-btn" onclick="removePreset('${x.id}')" type="button">削除</button></div></div>`).join(""); }
async function togglePresetFavorite(id){ const x=presets.find(p=>String(p.id)===String(id)); if(x)x.favorite=!x.favorite; await setSetting("presets",presets); renderPresetOptions(); renderPresetList(); }
async function removePreset(id){ if(!confirm("このプリセットを削除しますか？"))return; presets=presets.filter(x=>String(x.id)!==String(id)); await setSetting("presets",presets); renderPresetOptions(); renderPresetList(); }
function applyPreset(){
  const p=presets.find(x=>String(x.id)===$("#presetSelect").value); if(!p)return;
  const valid=new Set(standardOptions().filter(x=>x[0]!=="weights").map(x=>x[0]));
  if(!valid.has(p.category)){ $("#presetSelect").value=""; toast("このプリセットは旧メニューです。設定から削除し、新しい分類で作り直してください"); return; }
  $("#category").value=`std:${p.category}`; $("#distance").value=p.distance; $("#reps").value=p.reps; $("#sets").value=p.sets; $("#restMin").value=restInputValue(p.restSeconds,p.restMin); toggleTrainingFields(); renderTimeRows(false); liveRecalc();
}

async function saveWeightPreset(e){
  e.preventDefault(); weightPresets.push({id:uniqueId(),name:$("#weightPresetName").value.trim(),kg:Number($("#weightPresetKg").value)||null,reps:Number($("#weightPresetReps").value)||5,sets:Number($("#weightPresetSets").value)||3,favorite:$("#weightPresetFavorite").checked}); await setSetting("weightPresets",weightPresets); e.target.reset(); $("#weightPresetReps").value=5; $("#weightPresetSets").value=3; renderWeightPresetOptions(); renderWeightPresetList(); toast("ウェイト種目を追加しました");
}
function renderWeightPresetOptions(){ const sorted=[...weightPresets].sort((a,b)=>(b.favorite?1:0)-(a.favorite?1:0)||a.name.localeCompare(b.name,"ja")); $("#weightExerciseSelect").innerHTML='<option value="">登録種目を選択 / 手入力</option>'+sorted.map(x=>`<option value="${x.id}">${x.favorite?"★ ":""}${esc(x.name)}</option>`).join(""); }
function renderWeightPresetList(){ if(!weightPresets.length){$("#weightPresetList").innerHTML='<div class="muted">まだウェイト種目はありません。使用する種目だけ登録してください。</div>';return;} $("#weightPresetList").innerHTML=[...weightPresets].sort((a,b)=>(b.favorite?1:0)-(a.favorite?1:0)).map(x=>`<div class="setting-item"><div><strong>${x.favorite?'<span class="star">★</span> ':''}${esc(x.name)}</strong><div class="meta">${x.kg!=null?x.kg+'kg / ':''}${x.reps}rep × ${x.sets}set</div></div><div class="setting-actions"><button class="star-btn ${x.favorite?'active':''}" onclick="toggleWeightFavorite('${x.id}')" type="button">★</button><button class="delete-btn" onclick="removeWeightPreset('${x.id}')" type="button">削除</button></div></div>`).join(""); }
function applyWeightPreset(){ const p=weightPresets.find(x=>String(x.id)===$("#weightExerciseSelect").value); if(!p)return; $("#weightExerciseName").value=p.name; $("#weightKg").value=p.kg??""; $("#weightReps").value=p.reps||5; $("#weightSets").value=p.sets||3; liveRecalc(); }
async function toggleWeightFavorite(id){ const x=weightPresets.find(p=>String(p.id)===String(id)); if(x)x.favorite=!x.favorite; await setSetting("weightPresets",weightPresets); renderWeightPresetOptions(); renderWeightPresetList(); }
async function removeWeightPreset(id){ if(!confirm("このウェイト種目を削除しますか？過去の記録は残ります。"))return; weightPresets=weightPresets.filter(x=>String(x.id)!==String(id)); await setSetting("weightPresets",weightPresets); renderWeightPresetOptions(); renderWeightPresetList(); }

function syncCustomDefaults(){ const type=$("#customMetricType").value, defaults={time:["秒","lower"],distance:["m","higher"],count:["回","higher"],weight:["kg","higher"],other:["point","higher"]}; const d=defaults[type]; $("#customUnit").value=d[0]; $("#customEvaluationDirection").value=d[1]; }
async function saveCustomMenu(e){
  e.preventDefault(); customMenus.push({id:uniqueId(),name:$("#customMenuName").value.trim(),metricType:$("#customMetricType").value,unit:$("#customUnit").value.trim(),baseline:Number($("#customBaseline").value),evaluationDirection:$("#customEvaluationDirection").value,compareMode:$("#customCompareMode").value,favorite:$("#customFavorite").checked}); await setSetting("customMenus",customMenus); e.target.reset(); syncCustomDefaults(); populateCategories(); renderCustomMenuList(); toast("カスタムメニューを追加しました");
}
function renderCustomMenuList(){ if(!customMenus.length){$("#customMenuList").innerHTML='<div class="muted">まだカスタムメニューはありません。</div>';return;} $("#customMenuList").innerHTML=[...customMenus].sort((a,b)=>(b.favorite?1:0)-(a.favorite?1:0)).map(x=>`<div class="setting-item"><div><strong>${x.favorite?'<span class="star">★</span> ':''}${esc(x.name)}</strong><div class="meta">基準 ${Number(x.baseline).toFixed(2)}${esc(x.unit)} / ${customDirection(x)==='lower'?'小さいほど高評価':'大きいほど高評価'} / ${x.compareMode==='average'?'平均比較':'ベスト比較'} / コーチ評価対象外</div></div><div class="setting-actions"><button class="star-btn ${x.favorite?'active':''}" onclick="toggleCustomFavorite('${x.id}')" type="button">★</button><button class="delete-btn" onclick="removeCustomMenu('${x.id}')" type="button">削除</button></div></div>`).join(""); }
async function toggleCustomFavorite(id){ const x=customMenus.find(p=>String(p.id)===String(id)); if(x)x.favorite=!x.favorite; await setSetting("customMenus",customMenus); populateCategories(); renderCustomMenuList(); }
async function removeCustomMenu(id){ if(!confirm("このカスタムメニューを削除しますか？過去の記録は残ります。"))return; customMenus=customMenus.filter(x=>String(x.id)!==String(id)); await setSetting("customMenus",customMenus); populateCategories(); renderCustomMenuList(); }

async function refreshAll(){ await Promise.all([renderHome(),renderHistory(),renderMeets(),renderBestRecords()]); renderSessionItemsDraft(); liveRecalc(); }
function isWithinLastDays(iso,days,base=todayISO()){ const diff=daysTo(iso,base); return diff>=0&&diff<days; }
async function renderHome(){
  $("#todayLabel").textContent=new Intl.DateTimeFormat("ja-JP",{month:"long",day:"numeric",weekday:"short"}).format(new Date());
  const all=await getAll("trainings"),meets=await getAll("meets"),recent7=all.filter(x=>isWithinLastDays(x.date,7)),runItems7=expandTrainings(recent7).filter(isRunningRecord),races7=meets.filter(x=>x.status==="completed"&&isWithinLastDays(x.date,7)),highs=recent7.filter(isHighLoadSession).length,next=findNextMeet(meets),trainingDays=new Set(recent7.map(x=>x.date)).size;
  $("#weekSessions").textContent=`${trainingDays} 日`; $("#weekHigh").textContent=`${highs} 日`; $("#weekRaces").textContent=`${races7.length} 回`;
  const analysis=buildWeeklyAnalysis(all,profile,next,todayISO()); $("#weeklyCoach").textContent=analysis.text;
  const m=analysis.metrics; $("#weeklyMetrics").innerHTML=`<div><span>走行量・通常比</span><strong>${m.volumeRatio!=null?Math.round(m.volumeRatio*100)+'%':'--'}</strong></div><div><span>練習前疲労</span><strong>${m.recentFat!=null?m.recentFat.toFixed(1)+'/5':'--'}</strong></div><div><span>休養日</span><strong>${m.restDays} 日</strong></div>`;
  const weightCustomCount=expandTrainings(recent7).filter(x=>isWeightRecord(x)||isCustomRecord(x)).length;
  $("#homeSummary").textContent=recent7.length?`直近7日 ${trainingDays}練習日｜ランニング ${runItems7.length}メニュー｜ウェイト/カスタム ${weightCustomCount}メニュー｜専門 ${profile.primaryEvent}`:`専門 ${profile.primaryEvent}｜最初の活動を記録しましょう`;
  $("#nextMeet").innerHTML=next?`<strong>${esc(next.name)}</strong><div class="meta">${fmtDate(next.date)}｜${esc(next.event||"")}｜あと${Math.max(0,daysTo(todayISO(),next.date))}日</div>`:"大会予定はまだありません。";
  const activities=[...all.map(x=>({...x,_type:isDailySession(x)?"session":"training"})),...meets.filter(x=>x.status==="completed").map(x=>({...x,_type:"race"}))].sort((a,b)=>b.date.localeCompare(a.date)||(b.id||0)-(a.id||0)); $("#recentList").classList.toggle("empty",!activities.length); $("#recentList").innerHTML=activities.length?activities.slice(0,5).map(activityRow).join(""):"まだ記録がありません。";
  renderHomeBestSummary(all,meets);
}
function shortMonthDay(date){ if(!date)return"--"; const p=String(date).split("-"); return `${Number(p[1])}/${Number(p[2])}`; }
function seasonYearFromDate(date){ return Number(String(date||"").slice(0,4))||null; }
function trainingSeasonBestCandidates(trainings=[],year=bestSeasonYear){
  const normal=new Map(),flying=new Map();
  for(const rec of trainings){
    if(seasonYearFromDate(rec.date)!==Number(year))continue;
    const items=isDailySession(rec)?(rec.items||[]):[rec];
    items.forEach((raw,index)=>{
      const item={...raw,date:rec.date,activityType:"training"};
      if(!isRunningRecord(item)||!(Number(item.distance)>0))return;
      const value=bestTrainingTime(item); if(!(Number.isFinite(value)&&value>0))return;
      const candidate={value,date:rec.date,recordId:rec.id,itemIndex:index,item,category:item.category,distance:Number(item.distance),approachDistance:Number(item.approachDistance)||0};
      if(item.category==="flying"){
        const key=`${candidate.approachDistance}:${candidate.distance}`; const prev=flying.get(key); if(!prev||value<prev.value)flying.set(key,candidate);
      }else{
        const key=String(candidate.distance); const prev=normal.get(key); if(!prev||value<prev.value)normal.set(key,candidate);
      }
    });
  }
  return{normal:[...normal.values()].sort((a,b)=>a.distance-b.distance),flying:[...flying.values()].sort((a,b)=>a.distance-b.distance||a.approachDistance-b.approachDistance)};
}
function raceSeasonBestCandidates(meets=[],year=bestSeasonYear){
  const byEvent=new Map(); let excludedWind=0,excludedUnofficial=0;
  for(const race of meets){
    if(race.status!=="completed"||seasonYearFromDate(race.date)!==Number(year)||!(Number(race.resultSeconds)>0))continue;
    if(race.official===false){excludedUnofficial++;continue;}
    if(windSensitive(race.event)&&(!Number.isFinite(Number(race.wind))||Number(race.wind)>2.0)){excludedWind++;continue;}
    if(!priorRaceEligibleForSeasonBest(race))continue;
    const prev=byEvent.get(race.event); if(!prev||Number(race.resultSeconds)<Number(prev.resultSeconds))byEvent.set(race.event,race);
  }
  const order=new Map(PB_EVENTS.map((e,i)=>[e.key,i]));
  const records=[...byEvent.values()].sort((a,b)=>(order.get(a.event)??999)-(order.get(b.event)??999)||String(a.event).localeCompare(String(b.event),"ja"));
  return{records,excludedWind,excludedUnofficial};
}
function renderHomeBestSummary(trainings,meets){
  const year=new Date().getFullYear(),t=trainingSeasonBestCandidates(trainings,year),r=raceSeasonBestCandidates(meets,year);
  const y=$("#bestHomeYear"),box=$("#bestHomeSummary"); if(!box)return; if(y)y.textContent=`${year}年`;
  const examples=t.normal.slice(0,2).map(x=>`${x.distance}m ${timeFmt(x.value)}`).concat(r.records.slice(0,1).map(x=>`${x.event} ${timeFmt(x.resultSeconds)}`));
  box.innerHTML=`<div class="best-home-counts"><span><b>${t.normal.length}</b> 距離の練習SB</span><span><b>${r.records.length}</b> 種目の公認試合SB</span></div>${examples.length?`<div class="best-home-chips">${examples.map(v=>`<span>${esc(v)}</span>`).join("")}</div>`:`<div class="muted">今季のタイムを記録すると、ここにシーズンベストが自動表示されます。</div>`}`;
}
function fatigueText(x){ const b=Number(x.fatigueBefore||x.fatigue||0),a=Number(x.fatigueAfter||x.fatigue||0); return b&&a?`${b}→${a}/5`:b?`${b}/5`:"--"; }
function trainingTimeText(x){ const t=Number(x.averageTime); if(!(Number.isFinite(t)&&t>0))return "タイム未入力"; if(["jog","long_run"].includes(x.category)&&(Number(x.reps)||1)*(Number(x.sets)||1)===1)return `所要時間 ${timeFmt(t)}`; return `平均 ${timeFmt(t)}`; }
function missingTimeCount(x){ return sessionItems(x).filter(i=>isRunningRecord(i)&&!(Number.isFinite(Number(i.averageTime))&&Number(i.averageTime)>0)).length; }
function runningMenuSummary(x){
  const label=CATEGORY_LABELS[x.category]||x.category||"練習",dist=x.distance?`${x.distance}m`:"";
  if(x.category==="flying"&&x.approachDistance) return `${label} 助走${x.approachDistance}m→計測${dist}`;
  return `${label}${dist?` ${dist}`:""}`;
}
function sessionShortSummary(x){ const items=sessionItems(x), names=items.map(i=>isWeightRecord(i)?i.weightExerciseName||"ウェイト":isCustomRecord(i)?i.customMenuName||"カスタム":runningMenuSummary(i)); return `${names.slice(0,2).join(" / ")}${names.length>2?` ほか${names.length-2}件`:""}`; }
function activityRow(x){
  if(x._type==="race"||x.status==="completed") return`<div class="list-item"><div class="item-top"><span class="item-title"><span class="pill red">試合</span> ${esc(x.event)} ${timeFmt(x.resultSeconds)}</span><span>${x.isPB?'NEW PB':x.isSB?'SB':''}</span></div><div class="meta">${fmtDate(x.date)}｜${esc(x.name)}｜疲労 ${fatigueText(x)}</div></div>`;
  if(isDailySession(x))return`<div class="list-item"><div class="item-top"><span class="item-title"><span class="pill blue">1日</span> ${esc(sessionShortSummary(x))}</span><span>${x.items.length}メニュー</span></div><div class="meta">${fmtDate(x.date)}｜疲労 ${fatigueText(x)}</div></div>`;
  if(isWeightRecord(x))return`<div class="list-item"><div class="item-top"><span class="item-title"><span class="pill blue">ウェイト</span> ${esc(x.weightExerciseName||"ウェイト")}</span><span>${x.weightVolume?Math.round(x.weightVolume)+'kg':''}</span></div><div class="meta">${fmtDate(x.date)}｜${x.weightKg||0}kg × ${x.weightReps||0}rep × ${x.weightSets||0}set｜疲労 ${fatigueText(x)}</div></div>`;
  if(isCustomRecord(x))return`<div class="list-item"><div class="item-top"><span class="item-title"><span class="pill accent">カスタム</span> ${esc(x.customMenuName||"カスタム")}</span><span>${x.performancePct!=null?(x.performancePct>=0?'+':'')+x.performancePct.toFixed(1)+'%':''}</span></div><div class="meta">${fmtDate(x.date)}｜${x.representativeValue!=null?Number(x.representativeValue).toFixed(2)+esc(x.unit||''):"--"}｜疲労 ${fatigueText(x)}</div></div>`;
  return`<div class="list-item"><div class="item-top"><span class="item-title">${esc(runningMenuSummary(x))} × ${x.reps||1}${x.sets>1?` × ${x.sets}set`:''}</span><span>${x.pbRatio?x.pbRatio.toFixed(1)+'%':''}</span></div><div class="meta">${fmtDate(x.date)}｜${trainingTimeText(x)}｜疲労 ${fatigueText(x)}</div></div>`;
}
function normalizeSearchText(v){ return String(v??"").normalize("NFKC").toLowerCase().replace(/\s+/g," ").trim(); }
function searchableTime(v){ const n=Number(v); if(!Number.isFinite(n)||n<=0)return""; return `${n} ${n.toFixed(2)} ${timeFmt(n)} ${timeInputValue(n)}`; }
function dateSearchTokens(date){ if(!date)return""; const [y,m,d]=String(date).split("-"); return `${date} ${y}/${m}/${d} ${Number(m)}/${Number(d)}`; }
function itemSearchText(i){
  if(isWeightRecord(i))return `${i.weightExerciseName||""} ウェイト ${i.weightKg||""}kg ${i.weightReps||""}rep ${i.weightSets||""}set 総ボリューム ${i.weightVolume||""}`;
  if(isCustomRecord(i))return `${i.customMenuName||""} カスタム ${i.metricType||""} ${i.representativeValue??""}${i.unit||""} 基準 ${i.baseline??""}${i.unit||""} ${i.performancePct??""}%`;
  const times=(i.times||[]).map(searchableTime).join(" "),best=i.trainingBestCurrent?`練習ベスト ${searchableTime(i.trainingBestCurrent)}`:"";
  const rest=i.restSeconds||((Number(i.restMin)||0)*60),pace=i.distance&&i.averageTime?paceText(i.distance,i.averageTime):"";
  return `${CATEGORY_LABELS[i.category]||i.category||""} ${i.category||""} ${i.distance||""} ${i.distance?i.distance+"m":""} ${i.approachDistance?`助走 ${i.approachDistance}m`:""} ${i.reps||""}本 ${i.sets||""}set ${rest?`レスト ${timeInputValue(rest)} ${Number(i.restMin||0)}分`:""} ${searchableTime(i.averageTime)} ${times} ${pace} ${i.pbRatio??""} PB比 ${i.dropPct??""} タイム低下 ${best} ${i.isTrainingBest?"NEW 練習BEST":""}`;
}
function storedText(v){ return typeof v==="string"?v:(v?.text||""); }
function racePrepText(x){ return storedText(x.racePreparationAnalysis)||storedText(x.preRaceAnalysis)||""; }
function raceResultText(x,trainings=[],meets=[]){ return storedText(x.raceResultComment)||buildRaceResultComment(x,trainings,meets,profile).text; }
function historicalTrainingCoach(x,context={}){
  const trainings=context.trainings||[],meets=context.meets||[],prior=trainings.filter(t=>Number(t.id)!==Number(x.id)&&(!x.date||!t.date||t.date<=x.date)),next=findNextMeet(meets,x.date||todayISO());
  if(x.coachVersion==="3.0"&&x.coach)return x.coach;
  return isDailySession(x)?buildSessionCoachComment(x,prior,profile,next):buildCoachComment(x,prior,profile,next);
}
function historySearchText(x,context={}){
  const trainings=context.trainings||[],meets=context.meets||[];
  if(x._type==="race"||x.status==="completed"){
    const post=buildRacePostAnalysis(x,trainings,profile).text;
    return normalizeSearchText(`${dateSearchTokens(x.date)} 試合 ${x.name||""} ${x.event||""} ${x.round||""} ${searchableTime(x.resultSeconds)} ${x.place||""}位 風 ${x.wind??""} 疲労${x.fatigueBefore||""} 疲労前 ${x.fatigueBefore||""} 疲労後 ${x.fatigueAfter||""} RPE ${x.rpe||""} ${x.isPB?"PB NEW PB 自己ベスト":""} ${x.isSB?"SB シーズンベスト":""} ${x.windAssisted?"追い風参考":""} ${x.notes||""} ${raceResultText(x,trainings,meets)} ${racePrepText(x)} ${post}`);
  }
  if(isDailySession(x))return normalizeSearchText(`${dateSearchTokens(x.date)} 1日の練習 疲労${x.fatigueBefore||x.fatigue||""} 疲労前 ${x.fatigueBefore||x.fatigue||""} 疲労後 ${x.fatigueAfter||x.fatigue||""} ${x.durationMin?`練習時間 ${x.durationMin}分`:""} ${x.notes||""} ${historicalTrainingCoach(x,context)} ${(x.items||[]).map(itemSearchText).join(" ")}`);
  return normalizeSearchText(`${dateSearchTokens(x.date)} ${itemSearchText(x)} 疲労前 ${x.fatigueBefore||x.fatigue||""} 疲労後 ${x.fatigueAfter||x.fatigue||""} ${x.notes||""} ${historicalTrainingCoach(x,context)}`);
}
function historyTypeMatches(x,filter){ if(!filter)return true; if(x._type==="race")return filter==="race"; if(isDailySession(x)){const items=sessionItems(x); if(filter==="running")return items.some(isRunningRecord); if(filter==="weight")return items.some(isWeightRecord); if(filter==="custom")return items.some(isCustomRecord); return false;} return x._type===filter; }
function setHistoryDisplayMode(mode){
  historyDisplayMode=mode==="calendar"?"calendar":"list"; renderHistory();
}
function moveHistoryCalendarMonth(delta){
  historyCalendarCursor=new Date(historyCalendarCursor.getFullYear(),historyCalendarCursor.getMonth()+Number(delta||0),1); historySelectedDate=null; renderHistory();
}
function historyCalendarKinds(x,filter=""){
  if(x._type==="race")return filter&&filter!=="race"?[]:["race"]; const out=[]; const items=isDailySession(x)?sessionItems(x):[x];
  if((!filter||filter==="running")&&items.some(isRunningRecord))out.push("run"); if((!filter||filter==="weight")&&items.some(isWeightRecord))out.push("weight"); if((!filter||filter==="custom")&&items.some(isCustomRecord))out.push("custom"); return out;
}
function calendarDateISO(y,m,d){return `${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;}
function renderHistoryCalendar(items,context){
  const y=historyCalendarCursor.getFullYear(),m=historyCalendarCursor.getMonth(),monthStart=new Date(y,m,1),days=new Date(y,m+1,0).getDate(),offset=(monthStart.getDay()+6)%7,byDate=new Map(),filter=$("#historyTypeFilter")?.value||"";
  items.filter(x=>{const dt=new Date(`${x.date}T12:00:00`);return dt.getFullYear()===y&&dt.getMonth()===m;}).forEach(x=>{if(!byDate.has(x.date))byDate.set(x.date,[]);byDate.get(x.date).push(x);});
  $("#historyCalendarMonth").textContent=`${y}年${m+1}月`; const cells=[]; for(let i=0;i<offset;i++)cells.push('<div class="calendar-cell blank" aria-hidden="true"></div>');
  for(let d=1;d<=days;d++){ const iso=calendarDateISO(y,m,d),dayItems=byDate.get(iso)||[],kinds=[...new Set(dayItems.flatMap(x=>historyCalendarKinds(x,filter)))],selected=historySelectedDate===iso,today=iso===todayISO(); cells.push(`<button class="calendar-cell ${dayItems.length?'has-record':''} ${selected?'selected':''} ${today?'today':''}" type="button" onclick="selectHistoryCalendarDate('${iso}')"><span class="calendar-day">${d}</span><span class="calendar-dots">${kinds.map(k=>`<i class="cal-dot ${k}"></i>`).join('')}</span>${dayItems.length?`<small>${dayItems.length}件</small>`:''}</button>`); }
  $("#historyCalendarGrid").innerHTML=cells.join("");
  const monthItems=[...byDate.values()].flat(),trainingDays=new Set(monthItems.filter(x=>x._type!=="race").map(x=>x.date)).size,raceDays=new Set(monthItems.filter(x=>x._type==="race").map(x=>x.date)).size;
  $("#historyCalendarSummary").textContent=`この月：練習 ${trainingDays}日 / 試合 ${raceDays}日 / 表示 ${monthItems.length}件。日付をタップするとその日の詳細を確認できます。`;
  const detail=$("#historyCalendarDayDetail"); if(historySelectedDate){ const selectedItems=(byDate.get(historySelectedDate)||[]).sort((a,b)=>(b.id||0)-(a.id||0)); detail.innerHTML=selectedItems.length?`<div class="calendar-selected-title"><strong>${fmtDate(historySelectedDate)}の記録</strong><span>${selectedItems.length}件</span></div>${selectedItems.map(x=>historyCard(x,context)).join("")}`:`<div class="card empty">${fmtDate(historySelectedDate)}は条件に合う記録がありません。</div>`; }else detail.innerHTML='<div class="card calendar-tip">日付をタップすると、その日の練習・試合とコメントを表示します。</div>';
}
function selectHistoryCalendarDate(iso){ historySelectedDate=iso; renderHistory(); setTimeout(()=>$("#historyCalendarDayDetail")?.scrollIntoView({behavior:"smooth",block:"start"}),30); }
async function renderHistory(){
  const filter=$("#historyTypeFilter")?.value||"",rawQ=$("#historySearch")?.value||"",q=normalizeSearchText(rawQ),terms=q.split(/\s+/).filter(Boolean),trainings=await getAll("trainings"),meets=await getAll("meets"),context={trainings,meets};
  let items=[...trainings.map(x=>({...x,_type:isDailySession(x)?"session":isCustomRecord(x)?"custom":isWeightRecord(x)?"weight":"running"})),...meets.filter(x=>x.status==="completed").map(x=>({...x,_type:"race"}))].sort((a,b)=>b.date.localeCompare(a.date)||(b.id||0)-(a.id||0));
  items=items.filter(x=>{ if(!historyTypeMatches(x,filter))return false; if(!terms.length)return true; const text=historySearchText(x,context); return terms.every(t=>text.includes(t)); });
  const calendarMode=historyDisplayMode==="calendar"; $("#historyListView").classList.toggle("hidden",calendarMode); $("#historyCalendarView").classList.toggle("hidden",!calendarMode); $("#historyListModeBtn").classList.toggle("active",!calendarMode); $("#historyCalendarModeBtn").classList.toggle("active",calendarMode);
  $("#historyList").classList.toggle("empty",!items.length); $("#historyList").innerHTML=items.length?items.map(x=>historyCard(x,context)).join(""):"条件に合う記録がありません。";
  if(calendarMode)renderHistoryCalendar(items,context);
  const summary=$("#historySearchSummary"); if(summary)summary.textContent=terms.length?`「${rawQ.trim()}」の検索結果：${items.length}件（一覧・カレンダーの両方に反映）`:`キーワードは複数入力できます。距離・タイム・メニュー・大会名・メモ・簡易診断・レースコメントまで横断検索します。`;
}
function comparisonButton(recordId,itemIndex=0,label="過去比較"){
  return `<button class="small-btn compare-btn" onclick="openTrainingComparison(${Number(recordId)},${Number(itemIndex)})" type="button">${esc(label)}</button>`;
}
function sessionItemLine(x,recordId,itemIndex=0){
  const anchor=`history-item-${Number(recordId)}-${Number(itemIndex)}`;
  if(isWeightRecord(x))return `<div id="${anchor}" class="session-history-line"><span class="pill blue">ウェイト</span><strong>${esc(x.weightExerciseName||'ウェイト')}</strong><span>${x.weightKg||0}kg × ${x.weightReps||0}rep × ${x.weightSets||0}set</span>${comparisonButton(recordId,itemIndex,"推移")}</div>`;
  if(isCustomRecord(x))return `<div id="${anchor}" class="session-history-line"><span class="pill accent">カスタム</span><strong>${esc(x.customMenuName||'カスタム')}</strong><span>${x.representativeValue!=null?Number(x.representativeValue).toFixed(2)+esc(x.unit||''):''}</span>${comparisonButton(recordId,itemIndex,"推移")}</div>`;
  const best=x.isTrainingBest?` <span class="pill best">NEW 練習BEST</span>`:"";
  const pace=x.distance&&x.averageTime?` / ${paceText(x.distance,x.averageTime)}`:"";
  return `<div id="${anchor}" class="session-history-line"><span class="pill">走</span><strong>${esc(runningMenuSummary(x))}${best}</strong><span>${x.reps||1}本${x.sets>1?` × ${x.sets}set`:''} / ${trainingTimeText(x)}${pace}${x.pbRatio?` / PB比 ${x.pbRatio.toFixed(1)}%`:''}${x.trainingBestCurrent?` / 最速 ${timeFmt(Number(x.trainingBestCurrent))}`:''}</span>${comparisonButton(recordId,itemIndex,"推移")}</div>`;
}
function analysisBlock(title,text,cls=""){ return text?`<div class="analysis-label">${esc(title)}</div><div class="coach-message ${cls}">${esc(text)}</div>`:""; }
function historyCard(x,context={}){
  const trainings=context.trainings||[],meets=context.meets||[];
  if(x._type==="race"){
    const result=raceResultText(x,trainings,meets),prep=racePrepText(x)||buildRaceAnalysis(x,trainings,profile).text,post=buildRacePostAnalysis(x,trainings,profile).text;
    return`<article id="history-race-${Number(x.id)}" class="history-card race-card"><div class="item-top"><div><strong>${fmtDate(x.date)}｜<span class="pill red">試合</span> ${esc(x.name)} ${esc(x.event)}</strong><div class="meta">${timeFmt(x.resultSeconds)}${x.place?`｜${x.place}位`:''}${x.wind!=null?`｜風 ${x.wind>0?'+':''}${x.wind}m/s`:''}${x.isPB?'｜NEW PB':x.isSB?'｜SB':''}${x.windAssisted?'｜追い風参考':''}</div></div><button class="delete-btn" onclick="removeMeet(${x.id})">削除</button></div>${x.notes?`<div class="meta">メモ：${esc(x.notes)}</div>`:''}${analysisBlock("レース結果コメント",result,"race-result-note")}${analysisBlock("試合前分析",prep,"race-note")}${analysisBlock("試合後分析",post,"post-race-note")}</article>`;
  }
  if(isDailySession(x)){ const missing=missingTimeCount(x); return`<article id="history-training-${Number(x.id)}" class="history-card"><div class="item-top"><div><strong>${fmtDate(x.date)}｜<span class="pill blue">1日の練習</span> ${x.items.length}メニュー ${missing?`<span class="pill warn">タイム未入力 ${missing}件</span>`:''}</strong><div class="meta">疲労 ${fatigueText(x)}${x.durationMin?`｜練習時間 ${x.durationMin}分`:''}${x.updatedAt?`｜最終更新 ${new Date(x.updatedAt).toLocaleString('ja-JP',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}`:''}</div></div><div class="setting-actions"><button class="small-btn edit-btn" onclick="startEditTraining(${x.id})" type="button">編集</button><button class="delete-btn" onclick="removeTraining(${x.id})">この日を削除</button></div></div><div class="session-history-list">${sessionItems(x).map((item,index)=>sessionItemLine(item,x.id,index)).join('')}</div>${x.notes?`<div class="meta top-gap">メモ：${esc(x.notes)}</div>`:''}<div class="coach-message top-gap">${esc(historicalTrainingCoach(x,context))}</div></article>`; }
  if(x._type==="weight")return`<article id="history-training-${Number(x.id)}" class="history-card"><div class="item-top"><div><strong>${fmtDate(x.date)}｜<span class="pill blue">ウェイト</span> ${esc(x.weightExerciseName||'ウェイト')}</strong><div class="meta">${x.weightKg||0}kg × ${x.weightReps||0}rep × ${x.weightSets||0}set｜総ボリューム ${Math.round(x.weightVolume||0)}kg｜疲労 ${fatigueText(x)}</div></div><div class="setting-actions">${comparisonButton(x.id,0)}<button class="small-btn edit-btn" onclick="startEditTraining(${x.id})" type="button">編集</button><button class="delete-btn" onclick="removeTraining(${x.id})">削除</button></div></div>${x.notes?`<div class="meta">メモ：${esc(x.notes)}</div>`:''}<div class="coach-message custom-note">${esc(x.coach||weightCoachNotice())}</div></article>`;
  if(x._type==="custom")return`<article id="history-training-${Number(x.id)}" class="history-card"><div class="item-top"><div><strong>${fmtDate(x.date)}｜<span class="pill accent">カスタム</span> ${esc(x.customMenuName||'カスタム')}</strong><div class="meta">代表値 ${Number(x.representativeValue||0).toFixed(2)}${esc(x.unit||'')}｜基準 ${Number(x.baseline||0).toFixed(2)}${esc(x.unit||'')}｜パフォーマンス ${x.performancePct!=null?(x.performancePct>=0?'+':'')+x.performancePct.toFixed(1)+'%':'--'}｜疲労 ${fatigueText(x)}</div></div><div class="setting-actions">${comparisonButton(x.id,0)}<button class="small-btn edit-btn" onclick="startEditTraining(${x.id})" type="button">編集</button><button class="delete-btn" onclick="removeTraining(${x.id})">削除</button></div></div>${x.notes?`<div class="meta">メモ：${esc(x.notes)}</div>`:''}<div class="coach-message custom-note">${esc(x.coach||customCoachNotice())}</div></article>`;
  const best=x.isTrainingBest?'<span class="pill best">NEW 練習BEST</span>':'';
  return`<article id="history-training-${Number(x.id)}" class="history-card"><div class="item-top"><div><strong>${fmtDate(x.date)}｜${esc(runningMenuSummary(x))} ${best} ${missingTimeCount(x)?'<span class="pill warn">タイム未入力</span>':''}</strong><div class="meta">${x.reps||1}本${x.sets>1?` × ${x.sets}set`:''}｜${trainingTimeText(x)}${x.pbRatio?`｜PB比 ${x.pbRatio.toFixed(1)}%`:''}｜疲労 ${fatigueText(x)}</div></div><div class="setting-actions">${comparisonButton(x.id,0)}<button class="small-btn edit-btn" onclick="startEditTraining(${x.id})" type="button">編集</button><button class="delete-btn" onclick="removeTraining(${x.id})">削除</button></div></div>${x.notes?`<div class="meta">メモ：${esc(x.notes)}</div>`:''}<div class="coach-message">${esc(historicalTrainingCoach(x,context))}</div></article>`;
}
function seasonBestTrainingRow(x){
  const label=x.category==="flying"?`フライング ${x.distance}m${x.approachDistance?`（助走${x.approachDistance}m）`:""}`:`${x.distance}m`;
  const menu=CATEGORY_LABELS[x.category]||x.category||"練習";
  return `<button class="season-best-row" type="button" onclick="jumpToHistoryRecord('training',${Number(x.recordId)},${Number(x.itemIndex)})"><span class="sb-main"><b>${esc(label)}</b><small>${esc(menu)}</small></span><strong>${timeFmt(x.value)}</strong><span class="sb-date">${shortMonthDay(x.date)} <i>›</i></span></button>`;
}
function seasonBestRaceRow(x){
  const wind=x.wind!=null&&windSensitive(x.event)?` / 風 ${Number(x.wind)>0?"+":""}${Number(x.wind).toFixed(1)}m/s`:"";
  return `<button class="season-best-row race" type="button" onclick="jumpToHistoryRecord('race',${Number(x.id)},0)"><span class="sb-main"><b>${esc(x.event||"試合")}</b><small>${esc((x.name||"")+wind)}</small></span><strong>${timeFmt(Number(x.resultSeconds))}</strong><span class="sb-date">${shortMonthDay(x.date)} <i>›</i></span></button>`;
}
function seasonYears(trainings=[],meets=[]){
  const years=new Set([new Date().getFullYear()]); [...trainings,...meets].forEach(x=>{const y=seasonYearFromDate(x.date);if(y)years.add(y);}); return [...years].sort((a,b)=>b-a);
}
async function renderBestRecords(){
  const yearSelect=$("#bestSeasonYear"); if(!yearSelect)return;
  const trainings=await getAll("trainings"),meets=await getAll("meets"),years=seasonYears(trainings,meets);
  if(!years.includes(Number(bestSeasonYear)))bestSeasonYear=years[0]||new Date().getFullYear();
  yearSelect.innerHTML=years.map(y=>`<option value="${y}" ${Number(y)===Number(bestSeasonYear)?"selected":""}>${y}年</option>`).join("");
  const t=trainingSeasonBestCandidates(trainings,bestSeasonYear),r=raceSeasonBestCandidates(meets,bestSeasonYear);
  $("#bestSeasonYearLabel").textContent=`${bestSeasonYear}`; $("#trainingSbCount").textContent=String(t.normal.length); $("#raceSbCount").textContent=String(r.records.length);
  $("#trainingSeasonBestList").innerHTML=t.normal.length?t.normal.map(seasonBestTrainingRow).join(""):'<div class="season-best-empty">このシーズンの距離別タイムはまだありません。</div>';
  const flyingCard=$("#flyingSeasonBestCard"); flyingCard.classList.toggle("hidden",!t.flying.length); $("#flyingSeasonBestList").innerHTML=t.flying.map(seasonBestTrainingRow).join("");
  $("#raceSeasonBestList").innerHTML=r.records.length?r.records.map(seasonBestRaceRow).join(""):'<div class="season-best-empty">公認条件を満たす試合結果はまだありません。</div>';
  const notes=[]; if(r.excludedWind)notes.push(`風速未入力または+2.0m/s超の風力対象記録 ${r.excludedWind}件は公認SBから除外`); if(r.excludedUnofficial)notes.push(`「公認記録としてPB判定」がOFFの記録 ${r.excludedUnofficial}件は除外`); $("#raceSeasonBestNote").textContent=notes.length?`※ ${notes.join("。")}。`:"※ 公認試合SBは保存済みの試合結果から自動集計します。";
}
async function jumpToHistoryRecord(kind,id,itemIndex=0){
  historyDisplayMode="list"; historySelectedDate=null; if($("#historyTypeFilter"))$("#historyTypeFilter").value=""; if($("#historySearch"))$("#historySearch").value="";
  navigate("historyView"); await renderHistory();
  const target=kind==="race"?$("#history-race-"+Number(id)):$("#history-item-"+Number(id)+"-"+Number(itemIndex))||$("#history-training-"+Number(id));
  if(!target){toast("該当する日誌を見つけられませんでした");return;}
  target.classList.add("history-jump-highlight"); target.scrollIntoView({behavior:"smooth",block:"center"}); setTimeout(()=>target.classList.remove("history-jump-highlight"),2200);
}
function comparisonIdentity(item){
  if(isWeightRecord(item))return{kind:"weight",key:`weight:${String(item.weightExerciseName||item.weightExerciseId||"").trim().toLowerCase()}`,title:item.weightExerciseName||"ウェイト",metric:"総ボリューム",unit:"kg",lowerBetter:false};
  if(isCustomRecord(item))return{kind:"custom",key:`custom:${String(item.customMenuId||item.customMenuName||"").trim().toLowerCase()}`,title:item.customMenuName||"カスタム",metric:"代表値",unit:item.unit||"",lowerBetter:customDirection(item)==="lower"};
  return{kind:"running",key:`run:${item.category||""}:${Number(item.distance)||0}`,title:runningMenuSummary(item),metric:"平均タイム",unit:"",lowerBetter:true};
}
function comparisonMetricValue(item){
  if(isWeightRecord(item))return Number(item.weightVolume)||((Number(item.weightKg)||0)*(Number(item.weightReps)||0)*(Number(item.weightSets)||0))||null;
  if(isCustomRecord(item))return Number(item.representativeValue)||null;
  const avg=Number(item.averageTime); if(Number.isFinite(avg)&&avg>0)return avg; const ts=(item.times||[]).map(Number).filter(v=>Number.isFinite(v)&&v>0); return ts.length?mean(ts):bestTrainingTime(item);
}
function comparisonBestRepValue(item){ return isRunningRecord(item)?bestTrainingTime(item):comparisonMetricValue(item); }
function comparisonSameMenu(a,b){ return comparisonIdentity(a).key===comparisonIdentity(b).key; }
function comparisonSameCondition(a,b){
  if(!comparisonSameMenu(a,b))return false;
  if(isRunningRecord(a)&&isRunningRecord(b))return Number(a.reps||1)===Number(b.reps||1)&&Number(a.sets||1)===Number(b.sets||1)&&Number(a.approachDistance||0)===Number(b.approachDistance||0);
  if(isWeightRecord(a)&&isWeightRecord(b))return Number(a.weightReps||0)===Number(b.weightReps||0)&&Number(a.weightSets||0)===Number(b.weightSets||0);
  return true;
}
function comparisonMetricText(item,value){
  if(value==null||!Number.isFinite(Number(value)))return"--";
  if(isRunningRecord(item))return timeFmt(Number(value));
  const id=comparisonIdentity(item); return `${Number(value).toFixed(id.kind==="weight"?0:2)}${esc(id.unit)}`;
}
function allComparableTrainingItems(trainings){
  const out=[]; for(const rec of trainings){ const items=isDailySession(rec)?sessionItems(rec):[rec]; items.forEach((item,index)=>out.push({...item,date:rec.date,_recordId:rec.id,_itemIndex:index,_parentCreatedAt:rec.createdAt||""})); } return out;
}
function comparisonChartSvg(points,identity,currentRecordId,currentItemIndex){
  const clean=points.filter(p=>Number.isFinite(p.value)); if(clean.length<2)return '<div class="compare-empty">グラフ化できる記録が2件以上たまると推移を表示します。</div>';
  const recent=clean.slice(-12),w=680,h=230,left=52,right=18,top=20,bottom=42,pw=w-left-right,ph=h-top-bottom,vals=recent.map(p=>p.value),min=Math.min(...vals),max=Math.max(...vals),pad=(max-min||Math.max(Math.abs(max),1))*0.10,lo=min-pad,hi=max+pad;
  const x=i=>left+(recent.length===1?pw/2:i*pw/(recent.length-1));
  const y=v=>identity.lowerBetter?top+(v-lo)/(hi-lo)*ph:top+(hi-v)/(hi-lo)*ph;
  const path=recent.map((p,i)=>`${i?'L':'M'} ${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(' ');
  const dots=recent.map((p,i)=>{const cur=Number(p._recordId)===Number(currentRecordId)&&Number(p._itemIndex)===Number(currentItemIndex);return `<circle cx="${x(i).toFixed(1)}" cy="${y(p.value).toFixed(1)}" r="${cur?6:4}" class="${cur?'current':''}"><title>${p.date} ${comparisonMetricText(p.item,p.value)}</title></circle>`;}).join('');
  const first=recent[0].date?.slice(5).replace('-','/'),last=recent.at(-1).date?.slice(5).replace('-','/');
  const best=identity.lowerBetter?min:max,worst=identity.lowerBetter?max:min;
  return `<div class="compare-chart-caption"><span>直近${recent.length}件</span><span>上ほど${identity.lowerBetter?'良い記録':'大きい値'}${identity.kind==='weight'?'（参考）':''}</span></div><svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(identity.title)}の推移グラフ"><line x1="${left}" y1="${top}" x2="${left}" y2="${h-bottom}" class="axis"/><line x1="${left}" y1="${h-bottom}" x2="${w-right}" y2="${h-bottom}" class="axis"/><line x1="${left}" y1="${top+ph/2}" x2="${w-right}" y2="${top+ph/2}" class="grid"/><path d="${path}" class="trend" fill="none"/>${dots}<text x="8" y="${top+6}" class="axis-text">${esc(comparisonMetricText(recent[0].item,best))}</text><text x="8" y="${h-bottom}" class="axis-text">${esc(comparisonMetricText(recent[0].item,worst))}</text><text x="${left}" y="${h-12}" class="axis-text">${esc(first||'')}</text><text x="${w-right}" y="${h-12}" text-anchor="end" class="axis-text">${esc(last||'')}</text></svg>`;
}
async function openTrainingComparison(recordId,itemIndex=0){
  const trainings=await getAll("trainings"),record=trainings.find(r=>Number(r.id)===Number(recordId)); if(!record)return toast("比較する記録が見つかりませんでした");
  const current=(isDailySession(record)?sessionItems(record):[record])[Number(itemIndex)]||record,identity=comparisonIdentity(current),all=allComparableTrainingItems(trainings).filter(x=>comparisonSameMenu(current,x));
  const measured=all.map(x=>({...x,item:x,value:comparisonMetricValue(x)})).filter(x=>Number.isFinite(x.value)).sort((a,b)=>String(a.date).localeCompare(String(b.date))||Number(a._recordId)-Number(b._recordId)||Number(a._itemIndex)-Number(b._itemIndex));
  const currentValue=comparisonMetricValue(current),prior=measured.filter(x=>x.date<=record.date&&!(Number(x._recordId)===Number(record.id)&&Number(x._itemIndex)===Number(itemIndex))),sameConditionPrior=prior.filter(x=>comparisonSameCondition(current,x.item)),previous=(sameConditionPrior.length?sameConditionPrior:prior).at(-1)||null,recent=(sameConditionPrior.length?sameConditionPrior:prior).slice(-5),recentAvg=recent.length?mean(recent.map(x=>x.value)):null;
  const bestPoint=measured.length?(identity.lowerBetter?measured.reduce((a,b)=>a.value<=b.value?a:b):measured.reduce((a,b)=>a.value>=b.value?a:b)):null;
  const delta=previous&&currentValue!=null?currentValue-previous.value:null,improve=delta!=null?(identity.lowerBetter?-delta:delta):null;
  $("#comparisonTitle").textContent=`${identity.title}｜過去比較`;
  $("#comparisonSummary").innerHTML=`<div><span>今回</span><strong>${esc(comparisonMetricText(current,currentValue))}</strong></div><div><span>前回${sameConditionPrior.length?'（同条件）':''}</span><strong>${previous?esc(comparisonMetricText(previous.item,previous.value)):'--'}</strong></div><div><span>直近5回平均</span><strong>${recentAvg!=null?esc(comparisonMetricText(current,recentAvg)):'--'}</strong></div><div><span>${identity.kind==='running'?'練習BEST':'期間内ベスト'}</span><strong>${bestPoint?esc(comparisonMetricText(bestPoint.item,bestPoint.value)):'--'}</strong></div>`;
  $("#comparisonChart").innerHTML=comparisonChartSvg(measured,identity,record.id,itemIndex);
  const rows=[...measured].reverse().slice(0,12).map(p=>{const cur=Number(p._recordId)===Number(record.id)&&Number(p._itemIndex)===Number(itemIndex),cond=comparisonSameCondition(current,p.item)?'同条件':'条件差あり',detail=isRunningRecord(p.item)?`${p.item.reps||1}本${p.item.sets>1?` × ${p.item.sets}set`:''}${p.item.distance?` / ${p.item.distance}m`:''}${p.item.distance&&p.value?` / ${paceText(p.item.distance,p.value)}`:''}`:isWeightRecord(p.item)?`${p.item.weightKg||0}kg × ${p.item.weightReps||0}rep × ${p.item.weightSets||0}set`:`${Number(p.item.representativeValue||0).toFixed(2)}${p.item.unit||''}`;return `<div class="compare-record ${cur?'current':''}"><div><strong>${esc(fmtDate(p.date))}${cur?' <span class="pill blue">今回</span>':''}</strong><small>${esc(detail)}</small></div><div><strong>${esc(comparisonMetricText(p.item,p.value))}</strong><small>${esc(cond)}</small></div></div>`;}).join('');
  $("#comparisonRecords").innerHTML=rows||'<div class="compare-empty">比較できる過去記録がまだありません。</div>';
  let note="";
  if(identity.kind==="running")note=`同じメニュー名＋同じ距離の記録を集めています。本数・セット・助走条件が同じ記録を「同条件」として前回比較に優先します。${improve!=null?` 今回は前回比 ${improve>=0?'+':''}${improve.toFixed(2)}秒相当の変化です。`:''}`;
  else if(identity.kind==="weight")note="ウェイトは総ボリューム（重量×rep×set）の推移を表示します。総ボリュームが大きいほど優れているとは限らないため、良し悪しの自動判定には使用しません。";
  else note=`カスタムメニューの代表値を、設定した評価方向（${identity.lowerBetter?'小さいほど高評価':'大きいほど高評価'}）で表示します。`;
  $("#comparisonNote").textContent=note;
  $("#comparisonModal").classList.remove("hidden"); document.body.classList.add("modal-open");
}
function closeTrainingComparison(){ $("#comparisonModal")?.classList.add("hidden"); document.body.classList.remove("modal-open"); }
async function removeTraining(id){ if(!confirm("この練習記録を削除しますか？"))return; await deleteRecord("trainings",Number(id)); await refreshMenuUsageStats(); populateCategories(); toast("削除しました"); await refreshAll(); }
async function renderMeets(){
  const all=await getAll("meets"),trainings=await getAll("trainings"),today=todayISO();
  const sorted=[...all].sort((a,b)=>{const ap=a.status!=="completed"&&a.date>=today,bp=b.status!=="completed"&&b.date>=today;if(ap!==bp)return ap?-1:1;return ap?a.date.localeCompare(b.date):b.date.localeCompare(a.date);});
  $("#meetList").innerHTML=sorted.length?sorted.map(x=>{
    if(x.status==="completed"){
      const result=raceResultText(x,trainings,all),prep=racePrepText(x)||buildRaceAnalysis(x,trainings,profile).text,post=buildRacePostAnalysis(x,trainings,profile).text;
      return`<article class="meet-card"><div class="item-top"><div><strong><span class="pill red">結果</span> ${esc(x.name)}</strong><div class="meta">${fmtDate(x.date)}｜${esc(x.event||'')}｜${timeFmt(x.resultSeconds)}${x.isPB?'｜NEW PB':x.isSB?'｜SB':''}</div></div><button class="delete-btn" onclick="removeMeet(${x.id})">削除</button></div>${analysisBlock("レース結果コメント",result,"race-result-note")}${analysisBlock("試合前分析",prep,"race-note")}${analysisBlock("試合後分析",post,"post-race-note")}</article>`;
    }
    const gap=daysTo(today,x.date),a=gap>=0&&gap<=7?buildRaceAnalysis({...x,status:"planned"},trainings,profile):null;return`<article class="meet-card"><div class="item-top"><div><strong>${esc(x.name)}</strong><div class="meta">${fmtDate(x.date)}｜${esc(x.event||'')}｜あと${Math.max(0,gap)}日</div></div><div class="setting-actions"><button class="small-btn" onclick="startRaceFromMeet(${x.id})" type="button">結果を入力</button><button class="delete-btn" onclick="removeMeet(${x.id})">削除</button></div></div>${a?`<div class="analysis-label">試合前分析</div><div class="coach-message">${esc(a.text)}</div>`:''}</article>`;
  }).join(""):'<div class="card empty">大会予定はまだありません。</div>';
}

function csvEscape(value){ const s=String(value??"").replace(/\r?\n/g," "); return /[",\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s; }
function csvTimeValue(value){ const n=Number(value); return Number.isFinite(n)&&n>0?timeInputValue(n):""; }
function csvRestValue(item,keySeconds,keyMin){ const sec=Number(item?.[keySeconds])||((Number(item?.[keyMin])||0)*60); return sec>0?timeInputValue(sec):""; }
function csvTrainingRow(record,item,index,context){
  const base={日付:record.date||"",活動種別:"練習",メニュー番号:index+1,メニュー分類:"",メニュー名:"",距離m:"",助走距離m:"",本数:"",セット:"",平均タイム:"",最速タイム:"",全タイム:"",平均ペースkm:"",本間レスト:"",セット間レスト:"",重量kg:"",rep:"",ウェイトset:"",総ボリュームkg:"",カスタム代表値:"",単位:"",練習前疲労:record.fatigueBefore||record.fatigue||"",練習後疲労:record.fatigueAfter||record.fatigue||"",練習時間分:record.durationMin||"",大会名:"",試合種目:"",試合ラウンド:"",試合記録:"",順位:"",風速ms:"",PB:"",SB:"",RPE:"",メモ:record.notes||"",自動コメント:historicalTrainingCoach(record,context)};
  if(isWeightRecord(item)){base.メニュー分類="ウェイト";base.メニュー名=item.weightExerciseName||"ウェイト";base.重量kg=item.weightKg??"";base.rep=item.weightReps??"";base.ウェイトset=item.weightSets??"";base.総ボリュームkg=item.weightVolume??"";return base;}
  if(isCustomRecord(item)){base.メニュー分類="カスタム";base.メニュー名=item.customMenuName||"カスタム";base.カスタム代表値=item.representativeValue??"";base.単位=item.unit||"";return base;}
  const ts=(item.times||[]).map(Number).filter(v=>Number.isFinite(v)&&v>0); base.メニュー分類="ランニング";base.メニュー名=CATEGORY_LABELS[item.category]||item.category||"";base.距離m=item.distance??"";base.助走距離m=item.approachDistance??"";base.本数=item.reps??"";base.セット=item.sets??"";base.平均タイム=csvTimeValue(item.averageTime);base.最速タイム=csvTimeValue(bestTrainingTime(item));base.全タイム=ts.map(csvTimeValue).join(" / ");base.平均ペースkm=item.distance&&item.averageTime?paceText(item.distance,item.averageTime).replace(" /km","/km"):"";base.本間レスト=csvRestValue(item,"restSeconds","restMin");base.セット間レスト=csvRestValue(item,"setRestSeconds","setRestMin");return base;
}
function csvRaceRow(race){ return{日付:race.date||"",活動種別:"試合",メニュー番号:"",メニュー分類:"試合",メニュー名:race.name||"",距離m:"",助走距離m:"",本数:"",セット:"",平均タイム:"",最速タイム:"",全タイム:"",平均ペースkm:"",本間レスト:"",セット間レスト:"",重量kg:"",rep:"",ウェイトset:"",総ボリュームkg:"",カスタム代表値:"",単位:"",練習前疲労:race.fatigueBefore||"",練習後疲労:race.fatigueAfter||"",練習時間分:"",大会名:race.name||"",試合種目:race.event||"",試合ラウンド:race.round||"",試合記録:csvTimeValue(race.resultSeconds),順位:race.place??"",風速ms:race.wind??"",PB:race.isPB?"YES":"",SB:race.isSB?"YES":"",RPE:race.rpe??"",メモ:race.notes||"",自動コメント:storedText(race.raceResultComment)||""}; }
async function exportCsv(){
  const trainings=await getAll("trainings"),meets=await getAll("meets"),context={trainings,meets},rows=[];
  [...trainings].sort((a,b)=>String(a.date).localeCompare(String(b.date))||Number(a.id)-Number(b.id)).forEach(record=>{const items=isDailySession(record)?sessionItems(record):[record];items.forEach((item,index)=>rows.push(csvTrainingRow(record,item,index,context)));});
  meets.filter(x=>x.status==="completed").sort((a,b)=>String(a.date).localeCompare(String(b.date))||Number(a.id)-Number(b.id)).forEach(r=>rows.push(csvRaceRow(r)));
  const headers=["日付","活動種別","メニュー番号","メニュー分類","メニュー名","距離m","助走距離m","本数","セット","平均タイム","最速タイム","全タイム","平均ペースkm","本間レスト","セット間レスト","重量kg","rep","ウェイトset","総ボリュームkg","カスタム代表値","単位","練習前疲労","練習後疲労","練習時間分","大会名","試合種目","試合ラウンド","試合記録","順位","風速ms","PB","SB","RPE","メモ","自動コメント"];
  const csv='\uFEFF'+[headers.join(','),...rows.map(r=>headers.map(h=>csvEscape(r[h])).join(','))].join('\r\n'),name=`track-log-${todayISO()}.csv`,file=new File([csv],name,{type:"text/csv;charset=utf-8"});
  const mobile=/android|iphone|ipad|ipod/i.test(navigator.userAgent);
  if(mobile&&navigator.share&&navigator.canShare?.({files:[file]})){try{await navigator.share({files:[file],title:"Track Log CSV",text:"Track Logの練習・試合記録CSVです。"});toast("CSVの共有・保存画面を開きました");return;}catch(err){if(err?.name==="AbortError")return;}}
  const blob=new Blob([csv],{type:"text/csv;charset=utf-8"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);toast(`CSVを書き出しました（${rows.length}行）`);
}

async function exportData(){
  const data={version:10,appVersion:APP_VERSION,exportedAt:new Date().toISOString(),profile,customMenus,presets,weightPresets,trainings:await getAll("trainings"),meets:await getAll("meets")},name=`track-log-backup-${todayISO()}.json`,json=JSON.stringify(data,null,2),file=new File([json],name,{type:"application/json"});
  const mobile=/android|iphone|ipad|ipod/i.test(navigator.userAgent);
  if(mobile&&navigator.share&&navigator.canShare?.({files:[file]})){
    try{await navigator.share({files:[file],title:"Track Log バックアップ",text:"機種変更・復元用のバックアップファイルです。Google Drive / iCloud Drive / ファイル等へ保存してください。"});toast("バックアップの共有・保存画面を開きました");return;}catch(err){if(err?.name==="AbortError")return;}
  }
  const blob=new Blob([json],{type:"application/json"}),a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000); toast("バックアップファイルを保存しました");
}
function canonicalForFingerprint(v){ if(Array.isArray(v))return v.map(canonicalForFingerprint); if(v&&typeof v==="object"){const out={};Object.keys(v).filter(k=>!["id","createdAt","updatedAt","coach","racePreparationAnalysis","preRaceAnalysis","raceResultComment"].includes(k)).sort().forEach(k=>out[k]=canonicalForFingerprint(v[k]));return out;}return v; }
function recordFingerprint(v){ return JSON.stringify(canonicalForFingerprint(v)); }
function mergeSettingLists(current=[],incoming=[],nameKey="name"){
  const keyOf=x=>String(x?.[nameKey]||x?.id||"").trim().toLowerCase();
  const seen=new Set(current.map(keyOf).filter(Boolean)),out=[...current];
  for(const x of incoming||[]){const key=keyOf(x);if(key&&!seen.has(key)){out.push(x);seen.add(key);}}
  return out;
}
async function addUniqueRecords(storeName,incoming){ const current=await getAll(storeName),seen=new Set(current.map(recordFingerprint)); let added=0; for(const x of incoming){const y={...x};delete y.id;const key=recordFingerprint(y);if(seen.has(key))continue;await addRecord(storeName,y);seen.add(key);added++;}return added; }
async function importData(e){
  const f=e.target.files?.[0]; if(!f)return; try{
    const data=JSON.parse(await f.text()); if(!Array.isArray(data.trainings)||!Array.isArray(data.meets))throw new Error("バックアップ形式を確認できませんでした");
    const mode=$('input[name="restoreMode"]:checked')?.value||"replace";
    if(mode==="replace"){
      if(!confirm("機種変更向けの『置き換え復元』を行います。現在この端末にある練習・試合データを消去し、選択したバックアップ内容に置き換えます。よろしいですか？"))return;
      await clearStore("trainings"); await clearStore("meets");
      if(data.profile){profile=normalizeProfile(data.profile);await setSetting("profile",profile);} if(Array.isArray(data.customMenus)){customMenus=data.customMenus;await setSetting("customMenus",customMenus);} if(Array.isArray(data.presets)){presets=data.presets;await setSetting("presets",presets);} if(Array.isArray(data.weightPresets)){weightPresets=data.weightPresets;await setSetting("weightPresets",weightPresets);}
      for(const x of data.trainings){const y={...x};delete y.id;await addRecord("trainings",y);} for(const x of data.meets){const y={...x};delete y.id;await addRecord("meets",y);} toast("バックアップ内容でこの端末を置き換えました");
    }else{
      if(!confirm("現在のデータは残したまま、バックアップ内の未登録データを追加します。同一内容はできるだけ重複させません。よろしいですか？"))return;
      customMenus=mergeSettingLists(customMenus,data.customMenus||[]); presets=mergeSettingLists(presets,data.presets||[]); weightPresets=mergeSettingLists(weightPresets,data.weightPresets||[]); await setSetting("customMenus",customMenus);await setSetting("presets",presets);await setSetting("weightPresets",weightPresets);
      const t=await addUniqueRecords("trainings",data.trainings),m=await addUniqueRecords("meets",data.meets); toast(`追加復元しました（練習 ${t}件 / 試合 ${m}件）`);
    }
    profile=normalizeProfile((await getSetting("profile"))||profile); await refreshMenuUsageStats(); renderProfile(); populateCategories();populatePresetCategory();renderPresetOptions();renderPresetList();renderWeightPresetOptions();renderWeightPresetList();renderCustomMenuList();await refreshAll();
  }catch(err){toast(`復元に失敗しました：${err.message}`);} e.target.value="";
}
function toast(msg){ const t=$("#toast"); t.textContent=msg; t.classList.remove("hidden"); setTimeout(()=>t.classList.add("hidden"),3200); }

function setupPWA(){
  const ua=navigator.userAgent,isIOS=/iphone|ipad|ipod/i.test(ua),standalone=window.matchMedia("(display-mode: standalone)").matches||navigator.standalone;
  if(standalone){$("#installHelp").textContent="ホーム画面アプリとして起動中です。オンライン時は起動・復帰・再接続時に最新版を確認します。";$("#installBtn2").classList.add("hidden");}
  else if(isIOS)$("#installHelp").textContent="iPhone/iPad：Safariの共有ボタン →『ホーム画面に追加』を選択してください。ブックマークは共有 →『ブックマークを追加』です。";
  else $("#installHelp").textContent="対応ブラウザでは『アプリをインストール』を使用してください。メニューに『ホーム画面に追加』しか出ない場合でも、今回のmanifestとアイコンを読み込めるよう構成を強化しています。";
  window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredPrompt=e;$("#installBtn").classList.remove("hidden");$("#installBtn2").classList.remove("hidden");updatePwaStatus();});
  window.addEventListener("appinstalled",()=>{deferredPrompt=null;$("#installBtn").classList.add("hidden");toast("Track Logをインストールしました");updatePwaStatus();});
  if("serviceWorker" in navigator){navigator.serviceWorker.register(`./service-worker.js?v=${BUILD_TAG}`,{scope:"./",updateViaCache:"none"}).then(reg=>{swReg=reg;reg.update();reg.addEventListener("updatefound",()=>$("#updateBanner").classList.remove("hidden"));updatePwaStatus();}).catch(err=>{console.error("SW registration failed",err);updatePwaStatus();}); navigator.serviceWorker.addEventListener("controllerchange",()=>{if(!reloadingForUpdate){reloadingForUpdate=true;location.reload();}});}
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"){checkRemoteVersion(true);updatePwaStatus();}}); window.addEventListener("pageshow",()=>checkRemoteVersion(true)); window.addEventListener("online",()=>checkRemoteVersion(true)); setInterval(()=>checkRemoteVersion(true),30*60*1000);
}
async function triggerInstall(){ if(deferredPrompt){deferredPrompt.prompt();const choice=await deferredPrompt.userChoice;deferredPrompt=null;if(choice.outcome==="accepted")toast("インストール処理を開始しました");return;} showBookmarkHelp(true); }
function showBookmarkHelp(homeOnly=false){ const ua=navigator.userAgent;if(/iphone|ipad|ipod/i.test(ua))alert(homeOnly?"Safariで共有ボタン →『ホーム画面に追加』を選択してください。":"Safariの共有ボタンから『ホーム画面に追加』または『ブックマークを追加』を選択してください。"); else if(/android/i.test(ua))alert(homeOnly?"Chrome/Edgeのメニューから『アプリをインストール』を優先してください。表示されない場合は『ホーム画面に追加』を選択します。古いショートカットがある場合はいったん削除してから再追加してください。":"ブラウザの★またはメニューからブックマーク登録できます。ホーム画面には『アプリをインストール／ホーム画面に追加』を使用してください。"); else alert("ブックマークは通常 Ctrl+D（MacはCommand+D）です。PWA対応ブラウザではアドレスバー付近のインストールボタンも利用できます。"); }
async function copyCurrentUrl(){ try{await navigator.clipboard.writeText(location.href.split("?")[0].split("#")[0]);toast("URLをコピーしました");}catch{toast("URLをコピーできませんでした");} }
async function requestPersistentStorage(){ if(!navigator.storage?.persist)return toast("このブラウザは保存保護APIに対応していません"); const ok=await navigator.storage.persist();toast(ok?"端末保存の保護が有効になりました":"ブラウザ側で保存保護が許可されませんでした"); }
async function checkRemoteVersion(auto=false){
  if(!navigator.onLine)return; try{const res=await fetch(`./version.json?ts=${Date.now()}`,{cache:"no-store",headers:{"Cache-Control":"no-cache, no-store, max-age=0"}}); if(!res.ok)return; const remote=await res.json(); if(remote.version&&remote.version!==APP_VERSION){$("#updateBanner").classList.remove("hidden");if(swReg)await swReg.update();const key=`trackLogReloaded:${remote.version}`;if(auto&&sessionStorage.getItem(key)!=="1"){sessionStorage.setItem(key,"1");setTimeout(forceLatestReload,300);}} }catch(e){console.debug("version check skipped",e);}
}
async function forceLatestReload(){ if(reloadingForUpdate)return; reloadingForUpdate=true; try{if(swReg){await swReg.update();if(swReg.waiting)swReg.waiting.postMessage({type:"SKIP_WAITING"});} const regs=await navigator.serviceWorker?.getRegistrations?.();if(regs)for(const r of regs)await r.update?.();}catch{} const base=location.href.split("?")[0].split("#")[0];location.replace(`${base}?fresh=${Date.now()}`); }
async function updatePwaStatus(){
  const box=$("#pwaStatus"); if(!box)return; const secure=location.protocol==="https:"||location.hostname==="localhost",standalone=window.matchMedia("(display-mode: standalone)").matches||navigator.standalone,controlled=!!navigator.serviceWorker?.controller;
  let iconOk=false; try{iconOk=await new Promise(resolve=>{const im=new Image();im.onload=()=>resolve(true);im.onerror=()=>resolve(false);im.src=`./icon-192-v240.png?diag=${Date.now()}`;});}catch{}
  box.innerHTML=`<div class="${secure?'diag-ok':'diag-warn'}">${secure?'✓':'!'} HTTPS / 安全なコンテキスト</div><div class="${controlled?'diag-ok':'diag-warn'}">${controlled?'✓':'!'} Service Worker ${controlled?'制御中':'初回読込後に有効化'}</div><div class="${iconOk?'diag-ok':'diag-warn'}">${iconOk?'✓':'!'} PWAアイコン v240（ルート直下） ${iconOk?'読込OK':'読込失敗'}</div><div class="${standalone?'diag-ok':''}">${standalone?'✓ インストール済み起動':'ブラウザ表示中'}</div>`;
}
