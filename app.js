const APP_VERSION = "2.3.0-20260913";
const BUILD_TAG = "230";
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
  $("#raceForm").addEventListener("submit",saveRace);
  $("#meetForm").addEventListener("submit",saveMeet);
  $("#profileForm").addEventListener("submit",saveProfile);
  $("#presetForm").addEventListener("submit",savePreset);
  $("#weightPresetForm").addEventListener("submit",saveWeightPreset);
  $("#customMenuForm").addEventListener("submit",saveCustomMenu);
  $("#category").addEventListener("change",()=>{toggleTrainingFields();liveRecalc();});
  $("#presetSelect").addEventListener("change",applyPreset);
  $("#distance").addEventListener("input",liveRecalc);
  $("#reps").addEventListener("input",()=>{renderTimeRows(true);liveRecalc();});
  $("#sets").addEventListener("input",()=>{renderTimeRows(true);liveRecalc();});
  $$('input[name="mode"]').forEach(r=>r.addEventListener("change",toggleMode));
  $("#averageTime").addEventListener("input",liveRecalc);
  $("#customAttempts").addEventListener("input",()=>{renderCustomValueRows(true);liveRecalc();});
  $("#weightExerciseSelect").addEventListener("change",applyWeightPreset);
  ["weightKg","weightReps","weightSets"].forEach(id=>$("#"+id).addEventListener("input",liveRecalc));
  $("#detailToggle").addEventListener("click",()=>$("#advancedFields").classList.toggle("hidden"));
  bindRange("rpe",10,liveRecalc); bindRange("fatigueBefore",5,liveRecalc); bindRange("fatigueAfter",5,liveRecalc);
  bindRange("raceRpe",10,updateRacePreview); bindRange("raceFatigueBefore",5,updateRacePreview); bindRange("raceFatigueAfter",5,updateRacePreview);
  ["raceDate","raceName","raceEvent","raceRound","raceResult","racePlace","raceWind","raceOfficial"].forEach(id=>$("#"+id).addEventListener("input",updateRacePreview));
  $("#historyTypeFilter").addEventListener("change",renderHistory);
  $("#historySearch").addEventListener("input",renderHistory);
  $("#exportBtn").addEventListener("click",exportData); $("#exportBtn2").addEventListener("click",exportData);
  $("#importInput").addEventListener("change",importData);
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
  $$(".bottom-nav button").forEach(b=>b.classList.toggle("active",b.dataset.nav===id));
  if(id==="historyView")renderHistory(); if(id==="calendarView")renderMeets(); if(id==="homeView")renderHome(); if(id==="settingsView")updatePwaStatus();
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
  if(s.includes(":")){ const p=s.split(":").map(Number); if(p.some(x=>!Number.isFinite(x)))return null; if(p.length===2)return p[0]*60+p[1]; if(p.length===3)return p[0]*3600+p[1]*60+p[2]; return null; }
  const n=Number(s); return Number.isFinite(n)&&n>0?n:null;
}
function timeFmt(v){
  if(v==null||!Number.isFinite(v))return"--";
  if(v>=3600){const h=Math.floor(v/3600),m=Math.floor((v%3600)/60),s=v%60;return`${h}:${String(m).padStart(2,"0")}:${s.toFixed(2).padStart(5,"0")}`;}
  if(v>=60){const m=Math.floor(v/60),s=v-m*60;return`${m}:${s.toFixed(2).padStart(5,"0")}`;}
  return`${v.toFixed(2)}秒`;
}
function daysTo(from,to){ return Math.round((new Date(`${to}T12:00:00`)-new Date(`${from}T12:00:00`))/86400000); }
function uniqueId(){ return crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random().toString(16).slice(2)}`; }

function standardOptions(){ return CATEGORY_GROUPS[profile.eventGroup]||CATEGORY_GROUPS.sprint; }
function populateCategories(){
  const standard=standardOptions(), sorted=[...customMenus].sort((a,b)=>(b.favorite?1:0)-(a.favorite?1:0)||a.name.localeCompare(b.name,"ja"));
  let html=`<optgroup label="標準メニュー">${standard.map(([v,l])=>`<option value="std:${v}">${l}</option>`).join("")}</optgroup>`;
  if(sorted.length) html+=`<optgroup label="カスタム（コーチ評価対象外）">${sorted.map(x=>`<option value="custom:${x.id}">${x.favorite?"★ ":""}${esc(x.name)}</option>`).join("")}</optgroup>`;
  $("#category").innerHTML=html; toggleTrainingFields();
}
function populatePresetCategory(){ $("#presetCategory").innerHTML=standardOptions().filter(x=>x[0]!=="weights").map(([v,l])=>`<option value="${v}">${l}</option>`).join(""); }
function populateRaceEvents(){
  const opts=PB_EVENTS.map(e=>`<option value="${e.key}">${e.key}</option>`).join("");
  $("#raceEvent").innerHTML=opts; $("#meetEvent").innerHTML=opts; $("#primaryEvent").innerHTML=opts;
}
function renderProfile(){
  $("#age").value=profile.age||18; $("#eventGroup").value=profile.eventGroup||"sprint"; $("#primaryEvent").value=profile.primaryEvent||"100m";
  $("#pbEditor").innerHTML=PB_EVENTS.map(e=>`<label class="pb-entry">${e.key}<input data-pb-key="${e.key}" type="text" inputmode="decimal" value="${profile.pbs?.[e.key]?timeInputValue(profile.pbs[e.key]):""}" placeholder="秒 / 分:秒"></label>`).join("");
}
function timeInputValue(v){ if(!v)return""; if(v>=60)return timeFmt(v).replace("秒",""); return Number(v).toFixed(2); }
function trainingPb(distance){ return Number(profile.pbs?.[`${distance}m`]||profile.pbs?.[distance])||null; }
function parseMenuSelection(){ const v=$("#category").value||""; if(v.startsWith("custom:")){const id=v.slice(7);return{kind:"custom",custom:customMenus.find(x=>String(x.id)===id)}}; const cat=v.replace(/^std:/,""); return{kind:cat==="weights"?"weight":"running",category:cat}; }
function toggleTrainingFields(){
  const s=parseMenuSelection(); $("#runningFields").classList.toggle("hidden",s.kind!=="running"); $("#weightFields").classList.toggle("hidden",s.kind!=="weight"); $("#customFields").classList.toggle("hidden",s.kind!=="custom");
  if(s.kind==="custom"&&s.custom){ $("#customMenuTitle").textContent=(s.custom.favorite?"★ ":"")+s.custom.name; $("#customBaselineDisplay").value=s.custom.baseline; $("#customBaselineUnit").textContent=s.custom.unit; $("#customDirectionHint").textContent=customDirection(s.custom)==="lower"?"小さいほど高パフォーマンス":"大きいほど高パフォーマンス"; renderCustomValueRows(true); }
  if(s.kind==="weight")renderWeightPresetOptions();
}
function renderTimeRows(keep=true){
  const reps=Math.max(1,Math.min(40,Number($("#reps").value)||1)),sets=Math.max(1,Math.min(12,Number($("#sets").value)||1)),n=Math.min(80,reps*sets),old=$$(".rep-time").map(x=>x.value);
  $("#timeRows").innerHTML=Array.from({length:n},(_,i)=>{const set=Math.floor(i/reps)+1,rep=i%reps+1,label=sets>1?`S${set}-${rep}`:`${rep}本目`;return`<div class="time-row"><span>${label}</span><div class="with-unit"><input class="rep-time" type="text" inputmode="decimal" value="${keep?(old[i]||""):""}" placeholder="12.34"><span>秒</span></div><span class="ratio-tag" data-ratio-row="${i}">--</span></div>`;}).join("");
  $$(".rep-time").forEach(x=>x.addEventListener("input",liveRecalc));
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
function currentTrainingDraft(){
  const s=parseMenuSelection(),common={activityType:"training",date:$("#trainingDate").value,rpe:Number($("#rpe").value),fatigueBefore:Number($("#fatigueBefore").value),fatigueAfter:Number($("#fatigueAfter").value),durationMin:Number($("#durationMin").value)||null,restMin:Number($("#restMin").value)||null,setRestMin:Number($("#setRestMin").value)||null,notes:$("#notes").value.trim()};
  if(s.kind==="custom"){
    const m=s.custom,values=$$(".custom-value").map(x=>Number(x.value)).filter(x=>x>0),rep=representativeCustom(m,values);
    return{...common,subtype:"custom",isCustom:true,customMenuId:m?.id,customMenuName:m?.name,metricType:m?.metricType,unit:m?.unit,baseline:Number(m?.baseline)||null,compareMode:m?.compareMode||"best",evaluationDirection:customDirection(m),values,representativeValue:rep,performancePct:performanceVsBaseline(m,rep)};
  }
  if(s.kind==="weight"){
    const kg=Number($("#weightKg").value)||0,reps=Number($("#weightReps").value)||1,sets=Number($("#weightSets").value)||1;
    return{...common,subtype:"weight",isWeight:true,category:"weights",weightExerciseId:$("#weightExerciseSelect").value||null,weightExerciseName:$("#weightExerciseName").value.trim(),weightKg:kg,weightReps:reps,weightSets:sets,weightVolume:kg*reps*sets};
  }
  const detail=$('input[name="mode"]:checked').value==="detail",times=detail?$$(".rep-time").map(x=>parseTimeInput(x.value)).filter(Number.isFinite):[],avg=detail?mean(times):parseTimeInput($("#averageTime").value),dist=Number($("#distance").value)||null,pb=dist?trainingPb(dist):null;
  return{...common,subtype:"running",isCustom:false,isWeight:false,category:s.category,distance:dist,reps:Number($("#reps").value)||1,sets:Number($("#sets").value)||1,mode:detail?"detail":"simple",times,averageTime:avg,pb,pbRatio:pbRatio(pb,avg),dropPct:detail?maxDrop(times):null};
}
async function liveRecalc(){
  const d=currentTrainingDraft();
  if(d.isCustom){ $("#customRepresentative").textContent=d.representativeValue!=null?`${d.representativeValue.toFixed(2)} ${d.unit}`:"--"; $("#customBaselinePreview").textContent=d.baseline?`${Number(d.baseline).toFixed(2)} ${d.unit}`:"--"; $("#customPerformancePreview").textContent=d.performancePct!=null?`${d.performancePct>=0?"+":""}${d.performancePct.toFixed(1)}%`:"--"; $("#liveCoach").textContent=buildCoachComment(d,[],profile,null); $("#liveCoach").classList.add("custom-note"); return; }
  if(d.isWeight){
    $("#weightVolumePreview").textContent=d.weightKg?`${d.weightVolume.toFixed(0)} kg`:"自重/未入力";
    const all=await getAll("trainings"),prev=[...all].filter(x=>isWeightRecord(x)&&x.weightExerciseName===d.weightExerciseName&&x.date<=d.date).sort((a,b)=>b.date.localeCompare(a.date)||b.id-a.id)[0];
    $("#weightPreviousPreview").textContent=prev?.weightVolume?`${prev.weightVolume.toFixed(0)} kg`:"--";
    $("#weightDeltaPreview").textContent=prev?.weightVolume&&d.weightVolume?`${d.weightVolume>=prev.weightVolume?"+":""}${((d.weightVolume/prev.weightVolume-1)*100).toFixed(1)}%`:"--";
    $("#liveCoach").textContent=buildCoachComment(d,all,profile,null); $("#liveCoach").classList.add("custom-note"); return;
  }
  $("#liveCoach").classList.remove("custom-note"); $("#pbPreview").textContent=d.pb?timeFmt(d.pb):"未登録"; $("#pbRatioPreview").textContent=d.pbRatio?`${d.pbRatio.toFixed(1)}%`:"--"; $("#dropPreview").textContent=d.dropPct!=null?`${d.dropPct.toFixed(1)}%`:"--";
  $$(".rep-time").forEach((el,i)=>{const t=parseTimeInput(el.value),r=pbRatio(d.pb,t),tag=document.querySelector(`[data-ratio-row="${i}"]`); if(tag)tag.textContent=r?`${r.toFixed(1)}%`:"--";});
  const history=await getAll("trainings"),meets=await getAll("meets"); $("#liveCoach").textContent=buildCoachComment(d,history,profile,findNextMeet(meets,d.date));
}
async function saveTraining(e){
  e.preventDefault(); const d=currentTrainingDraft(); if(!d.date)return toast("日付を入力してください");
  if(d.isCustom){ if(!d.customMenuId||!d.representativeValue)return toast("カスタムメニューの記録を入力してください"); }
  else if(d.isWeight){ if(!d.weightExerciseName)return toast("ウェイト種目名を入力してください"); }
  else { if(!d.category||!d.distance)return toast("メニューと距離を入力してください"); if(!d.averageTime&&!['jog','other'].includes(d.category))return toast("タイムを入力してください"); }
  const history=await getAll("trainings"),meets=await getAll("meets"); d.coach=buildCoachComment(d,history,profile,findNextMeet(meets,d.date)); d.createdAt=new Date().toISOString(); await addRecord("trainings",d); toast("練習を保存しました"); resetTrainingForm(); await refreshAll(); navigate("homeView");
}
function resetTrainingForm(){
  $("#trainingForm").reset(); $("#trainingDate").value=todayISO(); $("#reps").value=1; $("#sets").value=1; $("#customAttempts").value=1; $("#weightReps").value=5; $("#weightSets").value=3; $("#rpe").value=5; $("#fatigueBefore").value=2; $("#fatigueAfter").value=3; $("#rpeValue").textContent="5 / 10"; $("#fatigueBeforeValue").textContent="2 / 5"; $("#fatigueAfterValue").textContent="3 / 5"; populateCategories(); renderTimeRows(false); renderCustomValueRows(false);
}

function windSensitive(event){ return ["100m","200m","100mH","110mH"].includes(event); }
function currentRaceDraft(){
  return{id:Number($("#raceMeetId").value)||undefined,activityType:"race",status:"completed",date:$("#raceDate").value,name:$("#raceName").value.trim(),event:$("#raceEvent").value,round:$("#raceRound").value,resultSeconds:parseTimeInput($("#raceResult").value),place:Number($("#racePlace").value)||null,wind:$("#raceWind").value===""?null:Number($("#raceWind").value),official:$("#raceOfficial").checked,fatigueBefore:Number($("#raceFatigueBefore").value),fatigueAfter:Number($("#raceFatigueAfter").value),rpe:Number($("#raceRpe").value),notes:$("#raceNotes").value.trim()};
}
async function updateRacePreview(){
  const d=currentRaceDraft(); if(!d.date||!d.name){$("#raceAnalysisPreview").textContent="大会名と日付を入力すると、直前の練習状況をプレビューします。";return;}
  const tr=await getAll("trainings"),dummy={...d,pbBefore:Number(profile.pbs?.[d.event])||null,isPB:false}; const a=buildRaceAnalysis(dummy,tr,profile); $("#raceAnalysisPreview").textContent=a.text;
}
async function saveRace(e){
  e.preventDefault(); const d=currentRaceDraft(); if(!d.date||!d.name||!d.event||!d.resultSeconds)return toast("大会名・日付・種目・記録を入力してください");
  const meets=await getAll("meets"), existing=d.id?meets.find(x=>x.id===d.id):null, oldPB=Number(profile.pbs?.[d.event])||null;
  const eligible=d.official && (!windSensitive(d.event) || (d.wind!=null && d.wind<=2.0));
  d.pbBefore=oldPB; d.pbEligible=eligible; d.windAssisted=windSensitive(d.event)&&d.wind!=null&&d.wind>2.0; d.windMissing=windSensitive(d.event)&&d.wind==null;
  d.isPB=eligible && (!oldPB || d.resultSeconds<oldPB);
  const year=d.date.slice(0,4),priorSame=meets.filter(x=>x.status==="completed"&&x.event===d.event&&x.resultSeconds&&x.date.startsWith(year)&&x.id!==d.id); const priorSB=priorSame.length?Math.min(...priorSame.map(x=>x.resultSeconds)):null; d.sbBefore=priorSB; d.isSB=!priorSB||d.resultSeconds<priorSB;
  const trainings=await getAll("trainings"); const analysis=buildRaceAnalysis(d,trainings,profile); d.preRaceAnalysis=analysis; d.updatedAt=new Date().toISOString(); d.createdAt=existing?.createdAt||new Date().toISOString();
  if(existing) await putRecord("meets",{...existing,...d,id:existing.id}); else {delete d.id; await addRecord("meets",d);}
  if(d.isPB){ profile.pbs[d.event]=d.resultSeconds; await setSetting("profile",profile); renderProfile(); toast(`試合結果を保存しました。NEW PB ${timeFmt(d.resultSeconds)}`); }
  else if(d.windAssisted) toast("試合結果を保存しました（追い風参考のためPB自動更新なし）");
  else if(d.windMissing&&d.official) toast("試合結果を保存しました（風速未入力のためPB自動更新なし）");
  else toast("試合結果を保存しました");
  resetRaceForm(); await refreshAll(); navigate("homeView");
}
function resetRaceForm(){ $("#raceForm").reset(); $("#raceMeetId").value=""; $("#raceDate").value=todayISO(); $("#raceOfficial").checked=true; $("#raceFatigueBefore").value=2; $("#raceFatigueAfter").value=4; $("#raceRpe").value=9; $("#raceFatigueBeforeValue").textContent="2 / 5"; $("#raceFatigueAfterValue").textContent="4 / 5"; $("#raceRpeValue").textContent="9 / 10"; $("#raceAnalysisPreview").textContent="保存すると、試合前3日・7日の状態を分析します。"; }
async function startRaceFromMeet(id){
  const meets=await getAll("meets"),m=meets.find(x=>x.id===Number(id)); if(!m)return; navigate("entryView"); selectActivity("race"); $("#raceMeetId").value=m.id; $("#raceDate").value=m.date; $("#raceName").value=m.name; if(PB_EVENTS.some(e=>e.key===m.event))$("#raceEvent").value=m.event; await updateRacePreview();
}

async function saveMeet(e){ e.preventDefault(); await addRecord("meets",{activityType:"race",status:"planned",name:$("#meetName").value.trim(),date:$("#meetDate").value,event:$("#meetEvent").value,createdAt:new Date().toISOString()}); e.target.reset(); $("#meetDate").value=todayISO(); toast("大会予定を追加しました"); await refreshAll(); }
async function removeMeet(id){ if(!confirm("この大会記録・予定を削除しますか？"))return; await deleteRecord("meets",Number(id)); await refreshAll(); }
function findNextMeet(meets,base=todayISO()){ return [...meets].filter(x=>x.status!=="completed"&&x.date>=base).sort((a,b)=>a.date.localeCompare(b.date))[0]||null; }

async function saveProfile(e){
  e.preventDefault(); const pbs={...profile.pbs}; $$('[data-pb-key]').forEach(x=>{const v=parseTimeInput(x.value); if(v)pbs[x.dataset.pbKey]=v; else delete pbs[x.dataset.pbKey];});
  profile={age:Number($("#age").value)||18,eventGroup:$("#eventGroup").value,primaryEvent:$("#primaryEvent").value,pbs}; await setSetting("profile",profile); populateCategories(); populatePresetCategory(); toast("プロフィールを保存しました"); liveRecalc(); renderHome();
}
async function savePreset(e){
  e.preventDefault(); presets.push({id:uniqueId(),name:$("#presetName").value.trim(),category:$("#presetCategory").value,distance:Number($("#presetDistance").value),reps:Number($("#presetReps").value)||1,sets:Number($("#presetSets").value)||1,restMin:Number($("#presetRest").value)||null,favorite:$("#presetFavorite").checked}); await setSetting("presets",presets); e.target.reset(); $("#presetReps").value=3; $("#presetSets").value=1; renderPresetOptions(); renderPresetList(); toast("入力プリセットを追加しました");
}
function renderPresetOptions(){ const sorted=[...presets].sort((a,b)=>(b.favorite?1:0)-(a.favorite?1:0)||a.name.localeCompare(b.name,"ja")); $("#presetSelect").innerHTML='<option value="">プリセットを使わない</option>'+sorted.map(x=>`<option value="${x.id}">${x.favorite?"★ ":""}${esc(x.name)}</option>`).join(""); }
function renderPresetList(){ if(!presets.length){$("#presetList").innerHTML='<div class="muted">まだプリセットはありません。</div>';return;} $("#presetList").innerHTML=[...presets].sort((a,b)=>(b.favorite?1:0)-(a.favorite?1:0)).map(x=>`<div class="setting-item"><div><strong>${x.favorite?'<span class="star">★</span> ':''}${esc(x.name)}</strong><div class="meta">${esc(CATEGORY_LABELS[x.category]||x.category)} / ${x.distance}m × ${x.reps}${x.sets>1?` × ${x.sets}set`:""}${x.restMin?` / R=${x.restMin}分`:""}</div></div><div class="setting-actions"><button class="star-btn ${x.favorite?'active':''}" onclick="togglePresetFavorite('${x.id}')" type="button">★</button><button class="delete-btn" onclick="removePreset('${x.id}')" type="button">削除</button></div></div>`).join(""); }
async function togglePresetFavorite(id){ const x=presets.find(p=>String(p.id)===String(id)); if(x)x.favorite=!x.favorite; await setSetting("presets",presets); renderPresetOptions(); renderPresetList(); }
async function removePreset(id){ if(!confirm("このプリセットを削除しますか？"))return; presets=presets.filter(x=>String(x.id)!==String(id)); await setSetting("presets",presets); renderPresetOptions(); renderPresetList(); }
function applyPreset(){ const p=presets.find(x=>String(x.id)===$("#presetSelect").value); if(!p)return; $("#category").value=`std:${p.category}`; $("#distance").value=p.distance; $("#reps").value=p.reps; $("#sets").value=p.sets; $("#restMin").value=p.restMin||""; toggleTrainingFields(); renderTimeRows(false); liveRecalc(); }

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

async function refreshAll(){ await Promise.all([renderHome(),renderHistory(),renderMeets()]); liveRecalc(); }
function isWithinLastDays(iso,days,base=todayISO()){ const diff=daysTo(iso,base); return diff>=0&&diff<days; }
async function renderHome(){
  $("#todayLabel").textContent=new Intl.DateTimeFormat("ja-JP",{month:"long",day:"numeric",weekday:"short"}).format(new Date());
  const all=await getAll("trainings"),meets=await getAll("meets"),recent7=all.filter(x=>isWithinLastDays(x.date,7)),run7=recent7.filter(isRunningRecord),races7=meets.filter(x=>x.status==="completed"&&isWithinLastDays(x.date,7)),highs=run7.filter(x=>["high","very_high"].includes(intensityFromRatio(x.pbRatio))).length,next=findNextMeet(meets);
  $("#weekSessions").textContent=`${recent7.length} 回`; $("#weekHigh").textContent=`${highs} 回`; $("#weekRaces").textContent=`${races7.length} 回`;
  const analysis=buildWeeklyAnalysis(all,profile,next,todayISO()); $("#weeklyCoach").textContent=analysis.text;
  const m=analysis.metrics; $("#weeklyMetrics").innerHTML=`<div><span>走行量・通常比</span><strong>${m.volumeRatio!=null?Math.round(m.volumeRatio*100)+'%':'--'}</strong></div><div><span>練習前疲労</span><strong>${m.recentFat!=null?m.recentFat.toFixed(1)+'/5':'--'}</strong></div><div><span>休養日</span><strong>${m.restDays} 日</strong></div>`;
  $("#homeSummary").textContent=recent7.length?`直近7日 ${recent7.length}回｜標準走 ${run7.length}回｜ウェイト/カスタム ${recent7.length-run7.length}回｜専門 ${profile.primaryEvent}`:`専門 ${profile.primaryEvent}｜最初の活動を記録しましょう`;
  $("#nextMeet").innerHTML=next?`<strong>${esc(next.name)}</strong><div class="meta">${fmtDate(next.date)}｜${esc(next.event||"")}｜あと${Math.max(0,daysTo(todayISO(),next.date))}日</div>`:"大会予定はまだありません。";
  const activities=[...all.map(x=>({...x,_type:"training"})),...meets.filter(x=>x.status==="completed").map(x=>({...x,_type:"race"}))].sort((a,b)=>b.date.localeCompare(a.date)||(b.id||0)-(a.id||0)); $("#recentList").classList.toggle("empty",!activities.length); $("#recentList").innerHTML=activities.length?activities.slice(0,5).map(activityRow).join(""):"まだ記録がありません。";
}
function fatigueText(x){ const b=Number(x.fatigueBefore||x.fatigue||0),a=Number(x.fatigueAfter||x.fatigue||0); return b&&a?`${b}→${a}/5`:b?`${b}/5`:"--"; }
function activityRow(x){
  if(x._type==="race"||x.status==="completed") return`<div class="list-item"><div class="item-top"><span class="item-title"><span class="pill red">試合</span> ${esc(x.event)} ${timeFmt(x.resultSeconds)}</span><span>${x.isPB?'NEW PB':x.isSB?'SB':''}</span></div><div class="meta">${fmtDate(x.date)}｜${esc(x.name)}｜疲労 ${fatigueText(x)}</div></div>`;
  if(isWeightRecord(x))return`<div class="list-item"><div class="item-top"><span class="item-title"><span class="pill blue">ウェイト</span> ${esc(x.weightExerciseName||"ウェイト")}</span><span>${x.weightVolume?Math.round(x.weightVolume)+'kg':''}</span></div><div class="meta">${fmtDate(x.date)}｜${x.weightKg||0}kg × ${x.weightReps||0}rep × ${x.weightSets||0}set｜疲労 ${fatigueText(x)}</div></div>`;
  if(isCustomRecord(x))return`<div class="list-item"><div class="item-top"><span class="item-title"><span class="pill accent">カスタム</span> ${esc(x.customMenuName||"カスタム")}</span><span>${x.performancePct!=null?(x.performancePct>=0?'+':'')+x.performancePct.toFixed(1)+'%':''}</span></div><div class="meta">${fmtDate(x.date)}｜${x.representativeValue!=null?Number(x.representativeValue).toFixed(2)+esc(x.unit||''):"--"}｜疲労 ${fatigueText(x)}</div></div>`;
  return`<div class="list-item"><div class="item-top"><span class="item-title">${esc(CATEGORY_LABELS[x.category]||x.category)} ${x.distance||''}m × ${x.reps||1}${x.sets>1?` × ${x.sets}set`:''}</span><span>${x.pbRatio?x.pbRatio.toFixed(1)+'%':''}</span></div><div class="meta">${fmtDate(x.date)}｜平均 ${timeFmt(x.averageTime)}｜疲労 ${fatigueText(x)}</div></div>`;
}
async function renderHistory(){
  const filter=$("#historyTypeFilter")?.value||"",q=($("#historySearch")?.value||"").toLowerCase(),trainings=await getAll("trainings"),meets=await getAll("meets");
  let items=[...trainings.map(x=>({...x,_type:isCustomRecord(x)?"custom":isWeightRecord(x)?"weight":"running"})),...meets.filter(x=>x.status==="completed").map(x=>({...x,_type:"race"}))].sort((a,b)=>b.date.localeCompare(a.date)||(b.id||0)-(a.id||0));
  items=items.filter(x=>{const text=`${x.weightExerciseName||''} ${x.customMenuName||''} ${CATEGORY_LABELS[x.category]||''} ${x.name||''} ${x.event||''} ${x.notes||''} ${x.distance||''}`.toLowerCase();return(!filter||x._type===filter)&&(!q||text.includes(q));});
  $("#historyList").classList.toggle("empty",!items.length); $("#historyList").innerHTML=items.length?items.map(historyCard).join(""):"条件に合う記録がありません。";
}
function historyCard(x){
  if(x._type==="race"){
    const a=x.preRaceAnalysis?.text||"試合前分析は旧データのためありません。";return`<article class="history-card"><div class="item-top"><div><strong>${fmtDate(x.date)}｜<span class="pill red">試合</span> ${esc(x.name)} ${esc(x.event)}</strong><div class="meta">${timeFmt(x.resultSeconds)}${x.place?`｜${x.place}位`:''}${x.wind!=null?`｜風 ${x.wind>0?'+':''}${x.wind}m/s`:''}${x.isPB?'｜NEW PB':''}${x.windAssisted?'｜追い風参考':''}</div></div><button class="delete-btn" onclick="removeMeet(${x.id})">削除</button></div>${x.notes?`<div class="meta">メモ：${esc(x.notes)}</div>`:''}<div class="coach-message race-note">${esc(a)}</div></article>`;
  }
  if(x._type==="weight")return`<article class="history-card"><div class="item-top"><div><strong>${fmtDate(x.date)}｜<span class="pill blue">ウェイト</span> ${esc(x.weightExerciseName||'ウェイト')}</strong><div class="meta">${x.weightKg||0}kg × ${x.weightReps||0}rep × ${x.weightSets||0}set｜総ボリューム ${Math.round(x.weightVolume||0)}kg｜疲労 ${fatigueText(x)}</div></div><button class="delete-btn" onclick="removeTraining(${x.id})">削除</button></div>${x.notes?`<div class="meta">メモ：${esc(x.notes)}</div>`:''}<div class="coach-message custom-note">${esc(x.coach||weightCoachNotice())}</div></article>`;
  if(x._type==="custom")return`<article class="history-card"><div class="item-top"><div><strong>${fmtDate(x.date)}｜<span class="pill accent">カスタム</span> ${esc(x.customMenuName||'カスタム')}</strong><div class="meta">代表値 ${Number(x.representativeValue||0).toFixed(2)}${esc(x.unit||'')}｜基準 ${Number(x.baseline||0).toFixed(2)}${esc(x.unit||'')}｜パフォーマンス ${x.performancePct!=null?(x.performancePct>=0?'+':'')+x.performancePct.toFixed(1)+'%':'--'}｜疲労 ${fatigueText(x)}</div></div><button class="delete-btn" onclick="removeTraining(${x.id})">削除</button></div>${x.notes?`<div class="meta">メモ：${esc(x.notes)}</div>`:''}<div class="coach-message custom-note">${esc(x.coach||customCoachNotice())}</div></article>`;
  return`<article class="history-card"><div class="item-top"><div><strong>${fmtDate(x.date)}｜${esc(CATEGORY_LABELS[x.category]||x.category)}</strong><div class="meta">${x.distance||'-'}m × ${x.reps||1}${x.sets>1?` × ${x.sets}set`:''}｜平均 ${timeFmt(x.averageTime)}${x.pbRatio?`｜PB比 ${x.pbRatio.toFixed(1)}%`:''}｜疲労 ${fatigueText(x)}</div></div><button class="delete-btn" onclick="removeTraining(${x.id})">削除</button></div>${x.notes?`<div class="meta">メモ：${esc(x.notes)}</div>`:''}<div class="coach-message">${esc(x.coach||'')}</div></article>`;
}
async function removeTraining(id){ if(!confirm("この練習記録を削除しますか？"))return; await deleteRecord("trainings",Number(id)); toast("削除しました"); await refreshAll(); }
async function renderMeets(){
  const all=await getAll("meets"),trainings=await getAll("trainings"),today=todayISO();
  const sorted=[...all].sort((a,b)=>{const ap=a.status!=="completed"&&a.date>=today,bp=b.status!=="completed"&&b.date>=today;if(ap!==bp)return ap?-1:1;return ap?a.date.localeCompare(b.date):b.date.localeCompare(a.date);});
  $("#meetList").innerHTML=sorted.length?sorted.map(x=>{
    if(x.status==="completed")return`<article class="meet-card"><div class="item-top"><div><strong><span class="pill red">結果</span> ${esc(x.name)}</strong><div class="meta">${fmtDate(x.date)}｜${esc(x.event||'')}｜${timeFmt(x.resultSeconds)}${x.isPB?'｜NEW PB':''}</div></div><button class="delete-btn" onclick="removeMeet(${x.id})">削除</button></div><div class="coach-message race-note">${esc(x.preRaceAnalysis?.text||'試合前分析なし')}</div></article>`;
    const gap=daysTo(today,x.date),a=gap>=0&&gap<=7?buildRaceAnalysis({...x,status:"planned"},trainings,profile):null;return`<article class="meet-card"><div class="item-top"><div><strong>${esc(x.name)}</strong><div class="meta">${fmtDate(x.date)}｜${esc(x.event||'')}｜あと${Math.max(0,gap)}日</div></div><div class="setting-actions"><button class="small-btn" onclick="startRaceFromMeet(${x.id})" type="button">結果を入力</button><button class="delete-btn" onclick="removeMeet(${x.id})">削除</button></div></div>${a?`<div class="coach-message">${esc(a.text)}</div>`:''}</article>`;
  }).join(""):'<div class="card empty">大会予定はまだありません。</div>';
}

async function exportData(){
  const data={version:4,appVersion:APP_VERSION,exportedAt:new Date().toISOString(),profile,customMenus,presets,weightPresets,trainings:await getAll("trainings"),meets:await getAll("meets")}; const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"}),a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=`track-log-backup-${todayISO()}.json`; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
async function importData(e){
  const f=e.target.files?.[0]; if(!f)return; try{const data=JSON.parse(await f.text()); if(!Array.isArray(data.trainings)||!Array.isArray(data.meets))throw new Error("形式不正"); if(!confirm("現在のデータにバックアップ内容を追加します。重複する記録がある場合も追加されます。よろしいですか？"))return; if(data.profile){profile=normalizeProfile(data.profile);await setSetting("profile",profile);renderProfile();} if(Array.isArray(data.customMenus)){customMenus=data.customMenus;await setSetting("customMenus",customMenus);} if(Array.isArray(data.presets)){presets=data.presets;await setSetting("presets",presets);} if(Array.isArray(data.weightPresets)){weightPresets=data.weightPresets;await setSetting("weightPresets",weightPresets);} for(const x of data.trainings){const y={...x};delete y.id;await addRecord("trainings",y);} for(const x of data.meets){const y={...x};delete y.id;await addRecord("meets",y);} populateCategories();populatePresetCategory();renderPresetOptions();renderPresetList();renderWeightPresetOptions();renderWeightPresetList();renderCustomMenuList();toast("バックアップを復元しました");await refreshAll();}catch(err){toast(`復元に失敗しました：${err.message}`);} e.target.value="";
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
  let iconOk=false; try{iconOk=await new Promise(resolve=>{const im=new Image();im.onload=()=>resolve(true);im.onerror=()=>resolve(false);im.src=`./icons/icon-192-v230.png?diag=${Date.now()}`;});}catch{}
  box.innerHTML=`<div class="${secure?'diag-ok':'diag-warn'}">${secure?'✓':'!'} HTTPS / 安全なコンテキスト</div><div class="${controlled?'diag-ok':'diag-warn'}">${controlled?'✓':'!'} Service Worker ${controlled?'制御中':'初回読込後に有効化'}</div><div class="${iconOk?'diag-ok':'diag-warn'}">${iconOk?'✓':'!'} PWAアイコン v230 ${iconOk?'読込OK':'読込失敗'}</div><div class="${standalone?'diag-ok':''}">${standalone?'✓ インストール済み起動':'ブラウザ表示中'}</div>`;
}
