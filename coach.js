const CATEGORY_GROUPS = {
  sprint: [
    ["short_dash","ショートダッシュ"],
    ["starting_blocks","スターティングブロック"],
    ["acceleration","加速走"],
    ["flying","フライング走（最高速度区間）"],
    ["speed_endurance","ロングスプリント（200〜400mなど）"],
    ["tempo","テンポ走"],
    ["pace","ペース走（一定ペース）"],
    ["interval","インターバル走"],
    ["hill","坂ダッシュ"],
    ["hurdle_drill","ハードル技術"],
    ["jog","ジョグ"],
    ["weights","ウェイト"]
  ],
  middle: [
    ["interval","インターバル走"],
    ["repetition","レペティション"],
    ["pace","ペース走（一定ペース）"],
    ["tempo","テンポ走"],
    ["speed_endurance","ロングスプリント（200〜400mなど）"],
    ["jog","ジョグ"],
    ["long_run","ロング走"],
    ["hill","坂"],
    ["weights","ウェイト"]
  ],
  long: [
    ["jog","ジョグ"],
    ["pace","ペース走（一定ペース）"],
    ["interval","インターバル走"],
    ["repetition","レペティション"],
    ["long_run","ロング走・LSD"],
    ["build_up","ビルドアップ"],
    ["tempo","テンポ走"],
    ["hill","坂"],
    ["weights","ウェイト"]
  ],
  hurdles: [
    ["hurdle_drill","ハードル技術"],
    ["short_dash","ショートダッシュ"],
    ["starting_blocks","スターティングブロック"],
    ["acceleration","加速走"],
    ["flying","フライング走（最高速度区間）"],
    ["speed_endurance","ロングスプリント（200〜400mなど）"],
    ["tempo","テンポ走"],
    ["pace","ペース走（一定ペース）"],
    ["interval","インターバル走"],
    ["jog","ジョグ"],
    ["weights","ウェイト"]
  ]
};
const CATEGORY_LABELS = {
  ...Object.fromEntries(Object.values(CATEGORY_GROUPS).flat()),
  speed:"旧メニュー：スピード",
  other:"旧メニュー：その他"
};

function mean(arr){ const a=arr.filter(Number.isFinite); return a.length ? a.reduce((x,y)=>x+y,0)/a.length : null; }
function sum(arr){ return arr.filter(Number.isFinite).reduce((x,y)=>x+y,0); }
function median(arr){ const a=arr.filter(Number.isFinite).sort((x,y)=>x-y); if(!a.length)return null; const m=Math.floor(a.length/2); return a.length%2?a[m]:(a[m-1]+a[m])/2; }
function stddev(arr){ const a=arr.filter(Number.isFinite); if(a.length<2)return null; const m=mean(a); return Math.sqrt(a.reduce((s,x)=>s+(x-m)**2,0)/a.length); }
function maxDrop(times){ const a=times.filter(Number.isFinite); if(a.length<2||a[0]<=0)return null; return (Math.max(...a)/a[0]-1)*100; }
function pbRatio(pb,time){ return pb&&time&&time>0 ? pb/time*100 : null; }
function coachSecondText(sec){ const s=Number(sec); const r=Math.round(s); return Math.abs(s-r)>=0.005?s.toFixed(2).padStart(5,"0"):String(r).padStart(2,"0"); }
function coachTime(seconds){
  const s=Number(seconds); if(!Number.isFinite(s)||s<=0)return "--";
  if(s<60)return `${s.toFixed(2)}秒`;
  if(s>=3600){const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),rest=s%60;return `${h}:${String(m).padStart(2,"0")}:${coachSecondText(rest)}`;}
  const m=Math.floor(s/60),rest=s-m*60; return `${m}:${coachSecondText(rest)}`;
}
function coachPace(distance,time){ const d=Number(distance),t=Number(time); if(!(d>0&&t>0))return null; const sec=t*1000/d; if(sec>=3600){const h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60),r=Math.round(sec%60);return `${h}:${String(m).padStart(2,"0")}:${String(r).padStart(2,"0")}/km`;} const m=Math.floor(sec/60),r=Math.round(sec%60);return `${m}:${String(r).padStart(2,"0")}/km`; }
function restClock(x){ const s=Number(x?.restSeconds)||((Number(x?.restMin)||0)*60); if(!(s>0))return null; const m=Math.floor(s/60),r=Math.round(s%60); return r?`${m}:${String(r).padStart(2,"0")}`:`${m}分`; }
function intensityFromRatio(r){ if(r==null)return"unknown"; if(r>=97)return"very_high"; if(r>=93)return"high"; if(r>=88)return"moderate_high"; if(r>=80)return"moderate"; return"low"; }
function hashSeed(obj){ const s=JSON.stringify(obj); let h=0; for(let i=0;i<s.length;i++)h=((h<<5)-h+s.charCodeAt(i))|0; return h; }
function pick(arr,seed=0){ return arr[Math.abs(seed)%arr.length]; }
function dateAt(iso){ return new Date(`${iso}T12:00:00`); }
function addDays(date,n){ const d=new Date(date); d.setDate(d.getDate()+n); return d; }
function isoOf(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function daysBetween(a,b){ return Math.round((dateAt(b)-dateAt(a))/86400000); }
function ageBand(age){ if(age<=12)return"youth"; if(age<=15)return"junior"; if(age<=18)return"highschool"; if(age<=22)return"college"; if(age<=34)return"adult"; if(age<=49)return"mastersA"; return"mastersB"; }
function inWindow(x,start,end){ const d=dateAt(x.date); return d>=start&&d<=end; }

function isDailySession(x){ return !!x && Array.isArray(x.items) && (x.isSession || x.subtype==="session" || x.recordType==="daily_session"); }
function isWeightRecord(x){ return !isDailySession(x) && (!!x?.isWeight || x?.subtype==="weight" || x?.category==="weights"); }
function isCustomRecord(x){ return !isDailySession(x) && (!!x?.isCustom || x?.subtype==="custom"); }
function isRunningRecord(x){ return !!x && !isDailySession(x) && !isCustomRecord(x) && !isWeightRecord(x) && x.activityType!=="race"; }
function fatiguePair(x){ const before=Number(x?.fatigueBefore||x?.fatigue||0),after=Number(x?.fatigueAfter||x?.fatigue||0); return{before,after,delta:before&&after?after-before:0}; }
function sessionItems(x){
  if(!isDailySession(x)) return [x];
  return (x.items||[]).map(item=>({
    ...item, activityType:"training", date:x.date,
    rpe:Number(x.rpe||item.rpe||0), fatigueBefore:Number(x.fatigueBefore||item.fatigueBefore||item.fatigue||0),
    fatigueAfter:Number(x.fatigueAfter||item.fatigueAfter||item.fatigue||0), durationMin:Number(x.durationMin||item.durationMin)||null,
    notes:x.notes||item.notes||"", _sessionParentId:x.id||null
  }));
}
function expandTrainings(trainings=[]){ return trainings.flatMap(sessionItems).filter(Boolean); }
function hasWeightContent(x){ return isDailySession(x)?sessionItems(x).some(isWeightRecord):isWeightRecord(x); }
function hasCustomContent(x){ return isDailySession(x)?sessionItems(x).some(isCustomRecord):isCustomRecord(x); }
function runningVolume(x){
  if(isDailySession(x)) return sum(sessionItems(x).filter(isRunningRecord).map(runningVolume));
  return isRunningRecord(x) ? (Number(x.distance)||0)*(Number(x.reps)||1)*(Number(x.sets)||1) : 0;
}
function bestTrainingTime(x){
  if(!isRunningRecord(x))return null;
  const times=(x.times||[]).map(Number).filter(v=>Number.isFinite(v)&&v>0);
  if(times.length)return Math.min(...times);
  const avg=Number(x.averageTime); return Number.isFinite(avg)&&avg>0?avg:null;
}
function repConsistency(x){
  const a=(x?.times||[]).map(Number).filter(v=>Number.isFinite(v)&&v>0); if(a.length<3)return null;
  const m=mean(a),sd=stddev(a); return m&&sd!=null?sd/m*100:null;
}
function trainingBestStats(current,history=[]){
  if(!isRunningRecord(current)||!(Number(current.distance)>0))return{currentBest:null,previousBest:null,recentMedian:null,samples:0,isBest:false,improvementSec:null,improvementPct:null,recentDeltaPct:null};
  const currentBest=bestTrainingTime(current), prior=expandTrainings(history).filter(isRunningRecord).filter(x=>Number(x.distance)===Number(current.distance)&&bestTrainingTime(x)>0&&(!current.date||!x.date||x.date<=current.date));
  const priorSorted=[...prior].sort((a,b)=>String(b.date||"").localeCompare(String(a.date||""))||Number(b._sessionParentId||b.id||0)-Number(a._sessionParentId||a.id||0));
  const vals=prior.map(bestTrainingTime).filter(Number.isFinite), previousBest=vals.length?Math.min(...vals):null, recentVals=priorSorted.slice(0,6).map(bestTrainingTime).filter(Number.isFinite), recentMedian=median(recentVals);
  const improvementSec=currentBest!=null&&previousBest!=null?previousBest-currentBest:null, improvementPct=improvementSec!=null&&previousBest>0?improvementSec/previousBest*100:null;
  const recentDeltaPct=currentBest!=null&&recentMedian!=null&&recentMedian>0?(recentMedian-currentBest)/recentMedian*100:null;
  return{currentBest,previousBest,recentMedian,samples:vals.length,isBest:currentBest!=null&&(previousBest==null||currentBest<previousBest-0.0005),improvementSec,improvementPct,recentDeltaPct};
}
function sameCategoryUsage(current,history=[]){
  if(!isRunningRecord(current)||!current.category||!current.date)return{count7:0,count14:0,lastGap:null};
  const cur=dateAt(current.date), prior=expandTrainings(history).filter(isRunningRecord).filter(x=>x.category===current.category&&x.date&&x.date<=current.date).sort((a,b)=>b.date.localeCompare(a.date));
  const count7=prior.filter(x=>{const g=daysBetween(x.date,current.date);return g>=0&&g<=7;}).length, count14=prior.filter(x=>{const g=daysBetween(x.date,current.date);return g>=0&&g<=14;}).length;
  const last=prior[0],lastGap=last?daysBetween(last.date,current.date):null; return{count7,count14,lastGap};
}
function srpeLoad(x){ const d=Number(x?.durationMin),r=Number(x?.rpe); return d>0&&r>0?d*r:null; }
const HIGH_LOAD_CATEGORIES = new Set(["short_dash","starting_blocks","acceleration","flying","speed_endurance","interval","repetition","hill","hurdle_drill"]);
function isHighLoadItem(x){
  if(!isRunningRecord(x)) return false;
  if(["high","very_high"].includes(intensityFromRatio(x.pbRatio))) return true;
  const cat=x.category,{after,delta}=fatiguePair(x);
  if(["short_dash","starting_blocks","acceleration","flying","speed_endurance"].includes(cat)) return true;
  const legacyRpe=Number(x.rpe||0);
  if(["interval","repetition","hill","hurdle_drill"].includes(cat)) return after>=4||delta>=2||legacyRpe>=8;
  return false;
}
function isHighLoadSession(x){ return isDailySession(x)?sessionItems(x).some(isHighLoadItem):isHighLoadItem(x); }

function customCoachNotice(){ return "この記録はユーザー作成のカスタムメニューです。基準値との比較・履歴保存は行いますが、メニュー内容やパフォーマンス±％は簡易コーチの評価対象外です。前後の疲労感は本人のコンディション情報として全体傾向に利用します。"; }
function weightCoachNotice(){ return "ウェイトはユーザー登録種目を中心に記録します。重量・レップ・セット・総ボリュームは履歴比較に使用しますが、種目内容そのものは簡易コーチの負荷判定対象外です。前後の疲労感は全体コンディションに利用します。"; }
function conditionComments(x,seed=0){
  const {before,after,delta}=fatiguePair(x), out=[];
  if(before>=4) out.push(pick([
    `開始前の疲労感が${before}/5と高めです。直近の練習量と回復状況を確認してください。`,
    `練習前から疲労感${before}/5です。今日の数値だけでなく、数日間の推移も合わせて確認してください。`,
    `開始時点の疲労感が高い状態です（${before}/5）。高負荷日が連続していないか日誌で確認する価値があります。`,
    `練習開始前の疲労感${before}/5は高めの入力です。タイムが良くても回復状態とは別に扱ってください。`
  ],seed));
  else if(before===1) out.push(pick(["開始前疲労感は1/5で、主観的にはかなりフレッシュな状態です。","練習前疲労感は1/5です。少なくとも自己申告上は疲労が少ない状態で開始しています。"],seed+1));
  if(after===5) out.push(pick(["練習後の疲労感が5/5です。次の高負荷日まで回復を優先してください。","終了後の疲労感が最大値です。翌日の開始前疲労が下がるかを確認してください。","練習後5/5まで疲労感が上がっています。次回の高強度練習前に回復しているかを日誌で確認してください。"],seed+2));
  else if(delta>=2&&after>=4) out.push(pick([`疲労感が${before}/5→${after}/5へ大きく上昇しました。今日は十分な刺激が入った可能性があります。`,`前後の疲労差が+${delta}です。次回の練習前に回復しているかを確認してください。`,`練習前後で疲労感が${delta}段階上昇しています。タイムだけでなく回復まで含めて今回の負荷を評価してください。`],seed+3));
  else if(delta===0&&after<=3) out.push(pick([`疲労感は${before}/5→${after}/5で変化がなく、主観的負担は比較的安定しています。`,`前後の疲労感は同じ${after}/5でした。今回の負荷に対する主観反応は大きく変化していません。`],seed+4));
  else if(delta<=-1) out.push(`疲労感は${before}/5→${after}/5へ低下しています。軽い調整・回復目的の日なら整合する反応です。`);
  return out;
}
function sessionVolumeComment(current,history=[],seed=0){
  const volume=runningVolume(current); if(!(volume>0)) return null;
  const flat=expandTrainings(history), same=flat.filter(isRunningRecord).filter(x=>x.category===current.category&&runningVolume(x)>0&&x.date<=current.date).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,10);
  const typical=median(same.map(runningVolume)), totalText=volume>=1000?`${(volume/1000).toFixed(volume%1000===0?0:1)}km`:`${Math.round(volume)}m`;
  if(typical&&same.length>=3){
    const ratio=volume/typical;
    if(ratio>=1.35) return pick([`距離・本数・セットからみた総走行量は${totalText}で、同じメニューの最近の通常量より約${Math.round((ratio-1)*100)}%多めです。`,`今回は合計${totalText}で、同じメニューの過去記録と比べて量が多い構成です。`,`同メニューの最近の中央値に対して走行量が${Math.round(ratio*100)}%です。量の増加分と疲労反応をセットで確認してください。`],seed);
    if(ratio<=0.7) return pick([`総走行量は${totalText}で、同じメニューの通常量より約${Math.round((1-ratio)*100)}%少なめです。軽め・質重視の日なら自然な構成です。`,`今回は合計${totalText}で、同じメニューの普段より量を抑えた構成です。タイム未計測でも、これを低パフォーマンスとは判定しません。`],seed+1);
    return pick([`総走行量は${totalText}で、同じメニューの最近の通常範囲に収まっています。`,`距離・本数・セットからみた量は合計${totalText}で、過去の同メニューと大きな差はありません。`],seed+2);
  }
  return `距離・本数・セットからみた総走行量は${totalText}です。比較データが増えると、同じメニュー内で通常量との差も判定します。`;
}
function trainingBestComment(current,history,seed=0){
  const s=trainingBestStats(current,history); if(s.currentBest==null)return null;
  if(s.previousBest==null) return pick([`同距離${Number(current.distance)}mの練習タイムとしては初回データです。今回の${coachTime(s.currentBest)}が今後の比較基準になります。`,`この距離の練習記録はまだ比較対象がありません。今回の${coachTime(s.currentBest)}を最初の練習ベスト基準として保存します。`],seed);
  if(s.isBest){ const sec=Math.max(0,s.improvementSec||0); return pick([`同距離の練習ベストを${sec.toFixed(2)}秒更新しています。公式PBとは分けて、練習内の進歩として記録します。`,`今回の最速${coachTime(s.currentBest)}は、過去の同距離練習ベスト${coachTime(s.previousBest)}を上回りました。NEW 練習BESTです。`,`同距離の過去練習記録を更新しました（${coachTime(s.previousBest)}→${coachTime(s.currentBest)}）。条件差はあるため、レストや本数も合わせて比較してください。`],seed+1); }
  const gap=(s.currentBest/s.previousBest-1)*100;
  if(gap<=0.5) return pick([`今回の最速は練習ベストまで${(s.currentBest-s.previousBest).toFixed(2)}秒で、ほぼベスト水準です。`,`同距離の練習ベスト${coachTime(s.previousBest)}に対し、今回は${coachTime(s.currentBest)}で非常に近い水準です。`],seed+2);
  if(s.recentDeltaPct!=null&&s.samples>=3&&s.recentDeltaPct>=2) return `直近の同距離記録中央値より約${s.recentDeltaPct.toFixed(1)}%速く、最近の練習内では高いパフォーマンスです。`;
  if(s.recentDeltaPct!=null&&s.samples>=3&&s.recentDeltaPct<=-4) return `直近の同距離記録中央値より約${Math.abs(s.recentDeltaPct).toFixed(1)}%遅めです。疲労・レスト・本数・天候など条件差と合わせて確認してください。`;
  return null;
}

function buildCoachComment(current,history=[],profile={},nextMeet=null){
  if(isDailySession(current)) return buildSessionCoachComment(current,history,profile,nextMeet);
  const seed=hashSeed({current,n:history.length});
  if(isCustomRecord(current)) return [customCoachNotice(),...conditionComments(current,seed)].join(" ");
  if(isWeightRecord(current)) return [weightCoachNotice(),...conditionComments(current,seed)].join(" ");
  const ratio=current.pbRatio??pbRatio(current.pb,current.averageTime), drop=current.dropPct??maxDrop(current.times||[]), consistency=repConsistency(current), parts=[], hasTime=bestTrainingTime(current)!=null, cat=current.category;
  if(!hasTime) parts.push(pick([
    "タイムは未計測です。速度・PB比による評価は行わず、距離・本数・セット・前後の疲労感から内容を判定します。",
    "今回はタイムなしの記録です。未計測をマイナス評価には使わず、練習量と前後の疲労感を中心に見ています。",
    "タイムが入力されていないため速度評価だけを省略しています。距離・本数・セットとコンディション情報から通常どおり記録・分析します。",
    "速度データは未入力です。後から活動日誌でタイムを追加すると、練習ベスト・PB速度比・反復低下を含めて再診断します。"
  ],seed));
  const bestNote=trainingBestComment(current,history,seed+30); if(bestNote)parts.push(bestNote);
  const volumeNote=sessionVolumeComment(current,history,seed+20); if(volumeNote) parts.push(volumeNote);
  if(ratio!=null){
    if(ratio>=97) parts.push(pick([`PB速度比${ratio.toFixed(1)}%で非常に高い速度域です。追加量より質と回復を優先してください。`,`PBにかなり近い強度です（${ratio.toFixed(1)}%）。目的以上に本数を増やさない方が質を保ちやすいです。`,`PB速度比${ratio.toFixed(1)}%。最大速度に近い刺激なので、次の高負荷日との間隔も記録しておきましょう。`,`PB比${ratio.toFixed(1)}%は非常に高い値です。タイムが良いことと回復が十分であることは別なので、翌日の開始前疲労も確認してください。`],seed));
    else if(ratio>=93) parts.push(pick([`PB速度比${ratio.toFixed(1)}%の高強度域です。スピード刺激として十分な水準です。`,`PB速度比${ratio.toFixed(1)}%。高い質で走れているため、後半の再現性と回復を確認してください。`,`PB比${ratio.toFixed(1)}%で高強度です。フォームを崩さず終えられているかメモを残すと比較しやすくなります。`,`今回の速度はPB比${ratio.toFixed(1)}%です。高出力系として扱い、直近の高負荷日との間隔も合わせて見ます。`],seed+1));
    else if(ratio>=88) parts.push(pick([`PB速度比${ratio.toFixed(1)}%。中～高強度で反復の質を揃えやすい範囲です。`,`PB比${ratio.toFixed(1)}%。強度と本数の両方を確保しやすいゾーンです。`,`PB速度比${ratio.toFixed(1)}%です。設定タイムと反復の安定性を一緒に見ると練習意図を評価しやすくなります。`],seed+2));
    else if(ratio>=80) parts.push(pick([`PB速度比${ratio.toFixed(1)}%。全力系より量・フォーム・リズムを重視しやすい強度です。`,`PB比${ratio.toFixed(1)}%。設定練習としては、タイムより動きの再現性も確認してください。`],seed+3));
    else parts.push(`PB速度比${ratio.toFixed(1)}%。回復走や技術確認が目的なら整合しますが、高強度が目的なら設定を確認してください。`);
  }
  if(drop!=null){
    if(drop>=7) parts.push(pick([`1本目からの最大タイム低下が${drop.toFixed(1)}%あります。本数・レスト・設定タイムを見直す候補です。`,`後半の低下が${drop.toFixed(1)}%と大きめです。次回は総量より各本の質を揃える方法も検討してください。`,`最大低下${drop.toFixed(1)}%です。狙いが耐乳酸・後半維持でない場合は、レストまたは本数が多すぎないか比較してください。`],seed+4));
    else if(drop>=4) parts.push(pick([`最大タイム低下は${drop.toFixed(1)}%で、後半にやや低下が見られます。`,`反復間の低下は${drop.toFixed(1)}%。練習意図の範囲内か、次回も同条件で比較してください。`,`最速からの落ち幅は中程度です（${drop.toFixed(1)}%）。レスト条件を揃えると推移を判断しやすくなります。`],seed+5));
    else if(drop>=0) parts.push(pick([`タイム低下は${drop.toFixed(1)}%に収まり、反復の再現性は良好です。`,`各本のばらつきが小さく、設定を安定してこなせています。`,`失速は${drop.toFixed(1)}%で小さく、後半まで比較的まとまっています。`],seed+6));
  }
  if(consistency!=null){
    if(consistency<=1.2)parts.push(pick([`各本のタイム変動係数は約${consistency.toFixed(1)}%で、反復のばらつきは小さいです。`,`タイムの散らばりは約${consistency.toFixed(1)}%で、再現性の高いセットになっています。`],seed+11));
    else if(consistency>=4.5)parts.push(`各本のタイム変動は約${consistency.toFixed(1)}%と大きめです。意図したペース変化でなければ、レスト・本数・計測条件を確認してください。`);
  }
  const pace=coachPace(current.distance,current.averageTime);
  if(pace&&["pace","interval","repetition","jog","long_run","build_up","tempo"].includes(cat)){
    if(cat==="pace") parts.push(pick([`今回の平均ペースは${pace}です。同じ距離・同じ条件で継続すると、ペースの再現性と前後疲労の変化を比較できます。`,`距離とタイムからみた平均ペースは${pace}です。ペース走では速さ単独ではなく、反復のばらつきと終了後疲労を合わせて追います。`],seed+40));
    else if(cat==="interval") parts.push(pick([`インターバルの平均は${pace}です。平均だけでなく各本のばらつきと後半低下も同時に判定しています。`,`今回の平均ペースは${pace}です。インターバルでは同じレスト条件で比較すると変化を追いやすくなります。`],seed+41));
    else if(cat==="jog") parts.push(`距離と時間からみた平均ペースは${pace}です。ジョグではペースの速さを高評価するのではなく、回復目的と疲労反応を優先して見ます。`);
    else if(cat==="long_run") parts.push(`距離と時間からみた平均ペースは${pace}です。ロング走は単日の速さより、週全体の走行量と翌日の開始前疲労を合わせて評価します。`);
    else parts.push(`距離とタイムからみた平均ペースは${pace}です。今後も同じ条件で記録すると過去比較に使えます。`);
  }
  if(["jog","long_run"].includes(cat)&&!Number(current.distance)&&Number(current.averageTime)>0) parts.push(`今回は距離なし・所要時間${coachTime(Number(current.averageTime))}の時間ベース記録として保存します。距離が分かる回だけ入力すれば、平均ペースも追加で比較できます。`);
  if(cat==="interval"){ const rest=restClock(current); if(rest)parts.push(`本間レストは${rest}で記録されています。インターバル比較では距離・本数・レストをそろえるとタイム差の解釈がしやすくなります。`); }
  if(cat==="build_up"&&Array.isArray(current.times)&&current.times.length>=3){ const a=current.times.map(Number).filter(v=>Number.isFinite(v)&&v>0); if(a.length>=3){const change=(a[a.length-1]/a[0]-1)*100;if(change<=-3)parts.push(`最初の区間から最後の区間にかけて約${Math.abs(change).toFixed(1)}%タイムが短縮しています。ビルドアップとして後半へ速度を上げた記録です。`);else if(change>=3)parts.push(`最初の区間より最後の区間が約${change.toFixed(1)}%遅くなっています。意図したビルドアップであれば、区間設定や疲労の影響を確認してください。`);}}
  const usage=sameCategoryUsage(current,history); if(isHighLoadItem(current)&&usage.lastGap!=null&&usage.lastGap<=2)parts.push(pick([`同系統の高負荷メニューを${usage.lastGap}日前にも実施しています。開始前疲労と今日のタイムが維持できているかを確認してください。`,`同じメニュー系統との間隔は${usage.lastGap}日です。短い間隔で高負荷が続いているため、翌日の回復反応も記録しておくと判断材料になります。`],seed+12));
  parts.push(...conditionComments(current,seed+7));
  const categoryPhrases={
    short_dash:["短いダッシュはタイムだけでなく、最初の数歩の姿勢と接地位置も記録すると比較しやすくなります。","短距離の最高出力系では、フォームが崩れる前に終えることも練習品質の一部です。","ショートダッシュは距離が短いほど計測誤差の影響も大きくなるため、同じ計測方法で比較してください。"],
    starting_blocks:["スターティングブロック練習では、号砲後の最初の数歩と加速へのつながりを記録すると比較しやすくなります。","ブロックスタートは1本ごとの質を優先し、疲労で姿勢や押し出しが崩れる前に終了することも重要です。","スタート練習は10m・20m・30mなど同じ区間で継続比較すると変化を追いやすくなります。"],
    acceleration:["加速走は静止または低速から速度を高めていく区間そのものを重視する練習です。最初の数歩から中盤までのつながりをメモしておくと、タイム変化の理由を追いやすくなります。","加速練習ではレスト不足で速度が落ちていないかも確認してください。","加速走は同じ距離でもスタート姿勢や開始条件でタイムが変わるため、条件をそろえた比較が有効です。"],
    flying:["フライング走は、助走・加速後の最高速度区間を計測する練習です。加速走とは分けて記録し、助走距離と計測距離を毎回そろえると比較精度が上がります。","最高速度区間の比較では、助走距離と計測距離の条件を固定することが重要です。","フライング走は助走条件の差が計測区間へ影響するため、同じ助走距離での練習ベスト比較を優先してください。"],
    speed_endurance:["ロングスプリントでは、終盤のタイム低下とフォーム維持をセットで評価すると進歩が見えやすくなります。","200〜400mなどのロングスプリントは負荷が高くなりやすいため、翌日の開始前疲労も確認してください。","ロングスプリントは同じ距離でも本数とレストで性質が変わるため、練習ベストだけでなくセット構成も残してください。"],
    interval:["インターバル走は平均だけでなく、最速・最遅・後半低下を見ると設定の適否を判断しやすくなります。","インターバル走ではレスト条件を固定すると過去比較がしやすくなります。","距離・各本タイム・レスト・疲労感を揃えると、同じメニューの再現性を客観的に比較しやすくなります。"],
    repetition:["レペティションは各本の質と十分な回復の両方が重要です。","反復練習では設定ペースと後半の低下を一緒に残すと比較しやすくなります。"],
    pace:["ペース走は平均ペースだけでなく、一定ペースを維持できたかと練習前後の疲労感をセットで見ると状態を把握しやすくなります。","同じ距離・近いペースでも練習後の疲労感が抑えられてくれば、記録上は余裕度の変化を追いやすくなります。","ペース走は距離・所要時間・平均ペースを残すことで、同じコースや条件での比較がしやすくなります。"],
    jog:["ジョグは速さより回復目的との整合性を優先してください。","回復目的なら終了後の疲労感が過度に上がっていないかを見るのが有効です。","時間ベースのジョグでも記録できます。距離が分かる場合は入力しておくと平均ペースも残せます。"],
    long_run:["ロング走は1回のペースだけでなく、週全体の疲労感と合わせて評価してください。","長い走行の翌日に開始前疲労が残るかを追うと、適量を見つけやすくなります。","ロング走は距離が不明でも所要時間で記録でき、距離がある場合は平均ペースも比較できます。"],
    build_up:["ビルドアップは各区間のタイム推移を見ると、後半へ計画的に上げられたかを確認しやすくなります。","ビルドアップでは最終区間だけでなく、序盤から終盤までの段階的な変化を残すと比較しやすくなります。"],
    tempo:["テンポ走は距離・所要時間・疲労感を同じ条件で記録すると、同程度の負荷に対する反応の変化を追いやすくなります。","テンポ走は平均ペースだけでなく、終了後疲労と翌日の開始前疲労も合わせて確認してください。"]
  };
  if(categoryPhrases[cat]) parts.push(pick(categoryPhrases[cat],seed+8));
  if(cat==="flying"&&Number(current.approachDistance)>0) parts.push(`今回は助走${Number(current.approachDistance)}m→計測${Number(current.distance)||0}mとして記録されています。今後も同じ助走条件で比較すると最高速度区間の変化を追いやすくなります。`);
  if(nextMeet){ const gap=daysBetween(current.date,nextMeet.date), highLoad=isHighLoadItem(current); if(gap>=0&&gap<=3&&highLoad) parts.push(`次の大会まで${gap}日です。記録上は高負荷メニューなので、ここからの追加負荷は慎重にしてください。`); else if(gap>=4&&gap<=7&&highLoad) parts.push(`次の大会まで${gap}日です。今回の負荷から疲労が抜けるか、練習前疲労の推移を確認してください。`); }
  const band=ageBand(Number(profile.age||18)),fat=fatiguePair(current);
  if(["youth","junior"].includes(band)&&fat.after>=5) parts.push("成長期で練習後疲労が5/5です。高負荷を連日重ねず、指導者と回復状況を共有してください。");
  else if(["mastersA","mastersB"].includes(band)&&fat.after>=4) parts.push("練習後疲労が高めです。次回の開始前疲労が戻っているかを確認し、回復日を調整してください。");
  return parts.filter(Boolean).slice(0,7).join(" ") || "記録を保存すると、距離・本数・セット・前後疲労を基礎に、タイムがある場合のみ練習ベスト・PB比・反復低下も加えてコメントします。";
}

function buildSessionCoachComment(session,history=[],profile={},nextMeet=null){
  const items=sessionItems(session), run=items.filter(isRunningRecord), weights=items.filter(isWeightRecord), customs=items.filter(isCustomRecord), seed=hashSeed({session,n:history.length}), parts=[];
  if(items.length>1){ const labels=items.map(x=>isWeightRecord(x)?x.weightExerciseName||"ウェイト":isCustomRecord(x)?x.customMenuName||"カスタム":CATEGORY_LABELS[x.category]||x.category).filter(Boolean); parts.push(pick([`本日は${items.length}メニューを1つの練習日としてまとめて評価しています（${labels.slice(0,3).join("・")}${labels.length>3?"ほか":""}）。`,`今日の${items.length}メニューを個別ではなく、1日の練習全体として判定しています。`,`1日の中で${items.length}メニューを実施しています。簡易診断は各メニューのタイムだけでなく、組み合わせ・総量・前後疲労をまとめて見ています。`],seed)); }
  const totalVol=sum(run.map(runningVolume));
  if(totalVol>0){ const t=totalVol>=1000?`${(totalVol/1000).toFixed(totalVol%1000===0?0:1)}km`:`${Math.round(totalVol)}m`; parts.push(`ランニング系メニューの合計走行量は${t}です。短い距離と長い距離を組み合わせた場合も、この合計と各メニューの質を分けて見ています。`); }
  const enduranceRuns=run.filter(x=>["pace","interval","repetition","jog","long_run","build_up","tempo"].includes(x.category));
  const paced=enduranceRuns.filter(x=>coachPace(x.distance,x.averageTime));
  if(paced.length){ const labels=paced.slice(0,3).map(x=>`${CATEGORY_LABELS[x.category]||x.category}${x.distance?` ${Number(x.distance)}m`:""} ${coachPace(x.distance,x.averageTime)}`); parts.push(`長距離系メニューの実測ペース：${labels.join(" / ")}。速さだけでなく、各本のばらつき・後半低下・前後疲労と合わせて評価します。`); }
  const interval=enduranceRuns.find(x=>x.category==="interval"&&Array.isArray(x.times)&&x.times.filter(v=>Number(v)>0).length>=3);
  if(interval){ const c=repConsistency(interval),d=maxDrop(interval.times||[]),rest=restClock(interval); if(c!=null&&c<=1.5)parts.push(`インターバルのタイム変動は約${c.toFixed(1)}%で、各本は比較的そろっています${rest?`（本間レスト ${rest}）`:""}。`); else if(d!=null&&d>=5)parts.push(`インターバルでは1本目からの最大低下が${d.toFixed(1)}%あります${rest?`（本間レスト ${rest}）`:""}。同じ設定で本数・レスト・疲労感を比較してください。`); }
  const timeOnly=enduranceRuns.filter(x=>["jog","long_run"].includes(x.category)&&!Number(x.distance)&&Number(x.averageTime)>0);
  if(timeOnly.length)parts.push(`距離なしの時間ベース記録が${timeOnly.map(x=>`${CATEGORY_LABELS[x.category]||x.category} ${coachTime(Number(x.averageTime))}`).join("・")}あります。距離が分からない日も記録として扱い、疲労傾向には反映します。`);
  if(run.length>=2){ const ds=run.map(x=>Number(x.distance)).filter(x=>x>0); if(ds.length){ const min=Math.min(...ds),max=Math.max(...ds); if(max>min*2){ if(min<=400&&max>=600)parts.push(`走行メニューは${min}m〜${max}mまで幅があります。短いスピード系と長めの走行を同日に組み合わせた構成として扱っています。`); else parts.push(`走行メニューは${min}m〜${max}mまで幅があります。距離特性が異なる複数メニューとして、各メニューのペース・反復安定性と1日全体の疲労を分けて見ています。`); } } }
  const timed=run.filter(x=>bestTrainingTime(x)!=null), untimed=run.filter(x=>bestTrainingTime(x)==null);
  if(untimed.length&&timed.length===0) parts.push(`ランニング${untimed.length}メニューはタイム未入力です。現在は距離・本数・セット・前後疲労を中心に判定しています。活動日誌の「編集」から後でタイムを追加すると、練習ベスト・PB速度比・反復低下を含めて診断を再計算します。`);
  else if(untimed.length) parts.push(`ランニング${untimed.length}メニューはタイム未入力のため、その部分は走行量と疲労反応を中心に評価しています。後からタイムを追加すると診断内容も更新されます。`);
  const bests=run.map(x=>({x,s:trainingBestStats(x,history)})).filter(o=>o.s.isBest&&o.s.currentBest!=null);
  if(bests.length){ const names=bests.slice(0,3).map(o=>`${Number(o.x.distance)}m ${coachTime(o.s.currentBest)}`); parts.push(pick([`今日は${names.join("・")}で同距離の練習ベストを更新しています。公式PBとは別に、練習内の進歩として記録します。`,`同距離の過去練習と比べ、${names.join("・")}が新しい練習ベストです。条件差もあるため本数・レストと一緒に比較してください。`],seed+20)); }
  const highItems=run.filter(isHighLoadItem), ratios=timed.map(x=>Number(x.pbRatio)).filter(Number.isFinite), bestRatio=ratios.length?Math.max(...ratios):null;
  if(highItems.length>=2) parts.push(pick([`高負荷と判定されるランニングメニューが${highItems.length}種類あります。1日の総負荷が高くなりやすいため、翌日の練習前疲労を確認してください。`,`高出力・高負荷系が${highItems.length}メニュー重なっています。個々のタイムが良くても、回復は1日全体の負荷で確認してください。`],seed+21));
  else if(highItems.length===1) parts.push("高負荷と判定されるランニングメニューが1種類含まれています。ほかのメニューとの組み合わせも含めて1日単位で回復を見てください。");
  if(bestRatio!=null&&bestRatio>=93) parts.push(`タイムを入力したメニューの中では最大PB速度比${bestRatio.toFixed(1)}%で、高い速度域の刺激が入っています。`);
  const drops=run.map(x=>Number(x.dropPct)).filter(Number.isFinite), worstDrop=drops.length?Math.max(...drops):null;
  if(worstDrop!=null&&worstDrop>=7) parts.push(`反復タイムを入力したメニューでは最大${worstDrop.toFixed(1)}%の低下がありました。後半の質が落ちすぎていないか確認してください。`);
  const priorSessions=history.filter(x=>x.date&&x.date<=(session.date||"9999-99-99")).slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,12), priorVols=priorSessions.map(runningVolume).filter(v=>v>0), typicalVol=median(priorVols);
  if(totalVol>0&&typicalVol&&priorVols.length>=4){ const r=totalVol/typicalVol; if(r>=1.4)parts.push(`1日合計走行量は最近の練習日の中央値より約${Math.round((r-1)*100)}%多めです。速度域が高い日なら、量との組み合わせを負荷要因として見ます。`); else if(r<=0.65)parts.push(`1日合計走行量は最近の練習日の中央値より約${Math.round((1-r)*100)}%少なめです。調整・質重視の日であれば自然な構成です。`); }
  parts.push(...conditionComments(session,seed+5));
  if(nextMeet){ const gap=daysBetween(session.date,nextMeet.date); if(gap>=0&&gap<=3&&highItems.length) parts.push(`次の大会まで${gap}日です。今日の高負荷メニューを追加で重ねるより、疲労が下がるかを優先して確認してください。`); else if(gap>=0&&gap<=3&&!highItems.length)parts.push(`次の大会まで${gap}日です。記録上は高負荷メニューを増やしていないため、前後疲労が落ち着くかを確認しながら調整できます。`); }
  if(weights.length||customs.length){ const extraLabels=[]; if(weights.length)extraLabels.push(`ウェイト${weights.length}件`); if(customs.length)extraLabels.push(`カスタム${customs.length}件`); parts.push(`${extraLabels.join("・")}は内容自体を標準ランニング負荷へ換算せず、前後の疲労感を1日の総合状態に反映しています。`); }
  const band=ageBand(Number(profile.age||18)),fat=fatiguePair(session); if(["youth","junior"].includes(band)&&fat.after>=5) parts.push("成長期で練習後疲労が5/5です。高負荷を連日重ねず、指導者と回復状況を共有してください。");
  return parts.filter(Boolean).slice(0,8).join(" ") || "この日の複数メニューをまとめて保存し、走行量・タイム・練習ベスト・前後疲労から1日単位で分析します。";
}

function periodMetrics(trainings,baseISO){
  const base=dateAt(baseISO), recentStart=addDays(base,-6), baselineEnd=addDays(base,-7), baselineStart=addDays(base,-34);
  const recent=trainings.filter(x=>inWindow(x,recentStart,base)), baseline=trainings.filter(x=>inWindow(x,baselineStart,baselineEnd));
  const recentRun=expandTrainings(recent).filter(isRunningRecord), baseRun=expandTrainings(baseline).filter(isRunningRecord);
  const recentVol=sum(recentRun.map(runningVolume)), baseWeeklyVol=sum(baseRun.map(runningVolume))/4;
  const recentHigh=recent.filter(isHighLoadSession).length, baseWeeklyHigh=baseline.filter(isHighLoadSession).length/4;
  const recentFat=mean(recent.map(x=>fatiguePair(x).before).filter(x=>x>0)), baseFat=mean(baseline.map(x=>fatiguePair(x).before).filter(x=>x>0));
  const uniqueDays=new Set(recent.map(x=>x.date)).size, restDays=Math.max(0,7-uniqueDays);
  const sorted=recent.filter(x=>fatiguePair(x).before>0).sort((a,b)=>a.date.localeCompare(b.date));
  const firstFat=mean(sorted.slice(0,Math.min(3,sorted.length)).map(x=>fatiguePair(x).before)), lastFat=mean(sorted.slice(-Math.min(3,sorted.length)).map(x=>fatiguePair(x).before));
  return{recent,baseline,recentRun,baseRun,recentVol,baseWeeklyVol,volumeRatio:baseWeeklyVol>0?recentVol/baseWeeklyVol:null,recentHigh,baseWeeklyHigh,recentFat,baseFat,fatigueDiff:recentFat!=null&&baseFat!=null?recentFat-baseFat:null,restDays,fatigueTrend:firstFat!=null&&lastFat!=null?lastFat-firstFat:null,baselineReady:baseline.length>=4};
}
function buildWeeklyAnalysis(trainings,profile={},nextMeet=null,baseISO=isoOf(new Date())){
  const m=periodMetrics(trainings,baseISO), seed=hashSeed({baseISO,n:trainings.length,profile}), parts=[];
  if(!m.recent.length) return{text:"直近7日間の記録がありません。距離・本数・セット、練習前後の疲労感を記録すると傾向を比較できます。タイムは任意です。",metrics:m};
  if(m.baselineReady){
    if(m.volumeRatio!=null){
      if(m.volumeRatio>=1.3) parts.push(pick([`標準ランニングの走行量は本人の通常週より約${Math.round((m.volumeRatio-1)*100)}%多く、負荷量が明確に増えています。`,`直近7日の標準メニュー走行量は通常比${Math.round(m.volumeRatio*100)}%です。普段よりかなり多い週になっています。`,`通常の週と比べて走行量が約${Math.round((m.volumeRatio-1)*100)}%増えています。疲労感が追随して上がっていないか確認してください。`],seed));
      else if(m.volumeRatio>=1.1) parts.push(pick([`標準ランニングの走行量は通常より約${Math.round((m.volumeRatio-1)*100)}%多めです。`,`直近7日の走行量は通常比${Math.round(m.volumeRatio*100)}%で、やや高めの週です。`],seed+1));
      else if(m.volumeRatio<=0.7) parts.push(pick([`標準ランニングの走行量は通常より約${Math.round((1-m.volumeRatio)*100)}%少なく、軽めの1週間です。`,`直近7日の走行量は通常比${Math.round(m.volumeRatio*100)}%で、普段より明確に少なめです。`],seed+2));
      else if(m.volumeRatio<=0.9) parts.push(`標準ランニングの走行量は通常より約${Math.round((1-m.volumeRatio)*100)}%少なめです。`);
      else parts.push(pick(["標準ランニングの走行量は本人の通常範囲に収まっています。","直近7日の走行量は過去28日から見た通常週と大きな差はありません。"],seed+3));
    }
    if(m.recentHigh>=m.baseWeeklyHigh+1.2&&m.recentHigh>=2) parts.push(pick([`高負荷の練習日が${m.recentHigh}回あり、通常より負荷日の密度が高くなっています。`,`タイムがある場合のPB比、またはメニュー特性と疲労反応からみた高負荷日が${m.recentHigh}回で、普段より間隔が詰まっています。`],seed+4));
    else if(m.recentHigh===0&&m.baseWeeklyHigh>=1) parts.push("普段は入っている高負荷日が直近7日にはありません。調整週・回復週であれば自然な変化です。");
    if(m.fatigueDiff!=null&&m.fatigueDiff>=0.8) parts.push(pick([`練習前疲労感は通常より平均${m.fatigueDiff.toFixed(1)}ポイント高く、疲労が残った状態で始める日が増えています。`,`開始前疲労が普段より高めです（+${m.fatigueDiff.toFixed(1)}）。負荷量だけでなく回復の進み方にも注意してください。`],seed+5));
    else if(m.fatigueDiff!=null&&m.fatigueDiff<=-0.6) parts.push(`練習前疲労感は通常より平均${Math.abs(m.fatigueDiff).toFixed(1)}ポイント低く、記録上は比較的回復した状態です。`);
  }else parts.push("通常値を作るための過去データがまだ少ないため、今回は直近7日内の変化を中心に判定しています。記録が4週間ほど蓄積すると本人比が安定します。");
  if(m.fatigueTrend!=null&&m.fatigueTrend>=1) parts.push(pick(["この1週間の中でも練習前疲労感が後半に向かって上昇しています。","週の前半より後半の開始前疲労が高く、疲労が抜け切らず積み上がっている可能性があります。"],seed+6));
  else if(m.fatigueTrend!=null&&m.fatigueTrend<=-1) parts.push("週後半に向けて練習前疲労感が低下しており、記録上は回復方向です。");
  if(m.restDays===0) parts.push("直近7日間に完全な記録上の休養日がありません。連続練習が目的でなければ回復日の余地を確認してください。");
  else if(m.restDays>=3&&m.recent.length>=2) parts.push(`直近7日には記録上${m.restDays}日の休養日があります。負荷を抑えた週としては回復時間を確保できています。`);
  if(nextMeet){ const gap=daysBetween(baseISO,nextMeet.date); if(gap>=0&&gap<=3) parts.push(`次の大会まで${gap}日です。ここからは新しい負荷を足すより、開始前疲労が下がるかを優先して確認してください。`); else if(gap>=4&&gap<=7&&m.recentHigh>=2) parts.push(`大会まで${gap}日で、高負荷の練習日が直近7日に${m.recentHigh}回あります。試合日に疲労を残さない間隔になっているか確認してください。`); }
  const excluded=m.recent.filter(x=>hasWeightContent(x)||hasCustomContent(x)).length; if(excluded) parts.push(`ウェイト・カスタムを含む練習日が${excluded}日あります。内容自体は標準ランニング負荷に加えていませんが、入力された前後の疲労感はコンディション傾向に反映しています。`);
  return{text:parts.slice(0,6).join(" "),metrics:m};
}
function buildWeeklyCoach(trainings,profile,nextMeet){ return buildWeeklyAnalysis(trainings,profile,nextMeet).text; }

function buildRaceAnalysis(meet,trainings,profile={}){
  const raceDate=meet.date, end=dateAt(raceDate), d7start=addDays(end,-7), d3start=addDays(end,-3), beforeEnd=addDays(end,-1), baseStart=addDays(end,-35), baseEnd=addDays(end,-8);
  const racePrev7=trainings.filter(x=>inWindow(x,d7start,beforeEnd)), racePrev3=trainings.filter(x=>inWindow(x,d3start,beforeEnd)), baseline=trainings.filter(x=>inWindow(x,baseStart,baseEnd));
  const run7=expandTrainings(racePrev7).filter(isRunningRecord), baseRun=expandTrainings(baseline).filter(isRunningRecord);
  const vol7=sum(run7.map(runningVolume)), baseWeeklyVol=sum(baseRun.map(runningVolume))/4, volumeRatio=baseWeeklyVol>0?vol7/baseWeeklyVol:null;
  const high7=racePrev7.filter(isHighLoadSession).length, high3=racePrev3.filter(isHighLoadSession).length;
  const fatigueAvg=mean(racePrev7.map(x=>fatiguePair(x).before).filter(x=>x>0)), baseFat=mean(baseline.map(x=>fatiguePair(x).before).filter(x=>x>0));
  const uniqueDays=new Set(racePrev7.map(x=>x.date)).size, restDays=Math.max(0,7-uniqueDays);
  const highs=[...racePrev7].filter(isHighLoadSession).sort((a,b)=>b.date.localeCompare(a.date)), lastHighGap=highs[0]?daysBetween(highs[0].date,raceDate):null;
  const seed=hashSeed({meet,racePrev7:racePrev7.length}), parts=[];
  if(volumeRatio!=null){
    if(volumeRatio>=1.3) parts.push(pick([`試合前7日の標準ランニング量は通常週の${Math.round(volumeRatio*100)}%で、かなり高めでした。`,`試合前1週間の走行量は通常より約${Math.round((volumeRatio-1)*100)}%多く、負荷量を残した状態で試合を迎えています。`,`通常週に対して試合前7日の走行量は${Math.round(volumeRatio*100)}%です。量の面では強めの週でした。`],seed));
    else if(volumeRatio>=1.1) parts.push(pick([`試合前7日の標準ランニング量は通常比${Math.round(volumeRatio*100)}%で、やや多めでした。`,`試合前1週間の走行量は普段より約${Math.round((volumeRatio-1)*100)}%多めです。疲労感とセットで結果を振り返ってください。`],seed+1));
    else if(volumeRatio<=0.7) parts.push(pick([`試合前7日の標準ランニング量は通常比${Math.round(volumeRatio*100)}%で、明確に落としていました。`,`試合前1週間は通常より約${Math.round((1-volumeRatio)*100)}%走行量を減らしており、量の面では調整が入っています。`,`試合前7日の走行量は通常の${Math.round(volumeRatio*100)}%です。記録上は明確なボリュームダウンが見られます。`],seed+2));
    else parts.push(pick(["試合前7日の標準ランニング量は本人の通常週と大きな差がありませんでした。","試合前1週間の走行量は過去の通常値の範囲です。"],seed+3));
  }else parts.push("通常週との走行量比較に必要な過去データがまだ不足しています。");
  if(high3>=2) parts.push(pick([`試合3日前以内に高負荷の練習日が${high3}回あり、直前まで強い刺激が続いています。`,`試合前3日間に高負荷日が${high3}回あります。疲労が残っていなかったか結果と合わせて確認してください。`,`直前3日で高負荷日が${high3}日です。刺激の維持を狙った調整か、負荷が残ったのかを当日の疲労感から切り分けてください。`],seed+4));
  else if(high3===1) parts.push(pick(["試合3日前以内に高負荷の練習日が1回あります。最後の刺激として意図したものか、当日の疲労感と合わせて振り返ってください。","直前3日に高負荷日が1日あります。最後の強い刺激から試合までの間隔として今後比較できます。"],seed+5));
  else if(high7>0&&lastHighGap!=null) parts.push(`最後の高負荷日は試合${lastHighGap}日前でした。直前3日には高負荷の練習日が入っていません。`);
  else parts.push("試合前7日には、記録上の高負荷日はありませんでした。タイム未計測日は低評価にせず、メニュー特性と前後の疲労感も含めて判定しています。");
  if(fatigueAvg!=null&&baseFat!=null){ const diff=fatigueAvg-baseFat; if(diff>=0.8) parts.push(`試合前7日の練習前疲労感は通常より平均${diff.toFixed(1)}ポイント高く、疲労の影響を考慮すべき状態でした。`); else if(diff<=-0.6) parts.push(`試合前7日の練習前疲労感は通常より平均${Math.abs(diff).toFixed(1)}ポイント低く、記録上は回復した状態で試合に近づいていました。`); else parts.push("試合前7日の練習前疲労感は本人の通常範囲でした。"); }
  if(restDays>=3) parts.push(`試合前7日には記録上${restDays}日の休養日があり、回復時間は比較的多めでした。`); else if(restDays<=1) parts.push(`試合前7日の休養日は記録上${restDays}日です。連続した活動が結果とどう重なるか、今後の試合でも比較できます。`);
  if(meet.resultSeconds){
    if(meet.isPB) parts.push(pick(["結果は自己ベスト更新です。今回の試合前パターンは今後の調整を比較する重要な基準になります。","PB更新でした。直前7日の負荷・疲労・休養の組み合わせを成功例として残しておく価値があります。","自己ベストが出たため、今回の直前7日を今後の試合前調整の比較基準として保存します。"],seed+6));
    else if(meet.pbBefore){ const ratio=pbRatio(meet.pbBefore,meet.resultSeconds); if(ratio>=99) parts.push(`結果は従来PBの速度比${ratio.toFixed(1)}%で、自己ベストに近いパフォーマンスでした。`); else if(ratio<95&&fatigueAvg!=null&&baseFat!=null&&fatigueAvg-baseFat>=0.8) parts.push("結果はPBから離れていますが、試合前疲労も通常より高かったため、単純な能力低下とは切り分けて考える必要があります。"); else if(ratio<95) parts.push(`結果は従来PBの速度比${ratio.toFixed(1)}%です。疲労以外のレース展開・気象・技術要因もメモと合わせて振り返ってください。`); }
  }
  const band=ageBand(Number(profile.age||18)); if(["youth","junior"].includes(band)&&high3>=1) parts.push("成長期の選手では、試合直前の高負荷を固定ルールにせず指導者と回復状態を共有してください。");
  return{text:parts.slice(0,7).join(" "),metrics:{volumeRatio,high7,high3,fatigueAvg,baseFat,restDays,lastHighGap,racePrev7Count:racePrev7.length}};
}

function buildRaceResultComment(meet,trainings=[],meets=[],profile={}){
  const seed=hashSeed({meet,n:meets.length,t:trainings.length}), parts=[], prior=[...meets].filter(x=>x.status==="completed"&&x.event===meet.event&&x.resultSeconds&&Number(x.id)!==Number(meet.id)&&x.date<=meet.date).sort((a,b)=>b.date.localeCompare(a.date)||(b.id||0)-(a.id||0));
  const previous=prior[0]||null, recent=prior.slice(0,5), recentMedian=median(recent.map(x=>Number(x.resultSeconds)).filter(Number.isFinite)), prep=meet.racePreparationAnalysis||buildRaceAnalysis(meet,trainings,profile), pbr=meet.pbBefore?pbRatio(Number(meet.pbBefore),Number(meet.resultSeconds)):null;
  if(meet.isPB) parts.push(pick([
    `自己ベスト更新です。${meet.pbBefore?`従来PB ${coachTime(meet.pbBefore)}から${(Number(meet.pbBefore)-Number(meet.resultSeconds)).toFixed(2)}秒短縮しました。`:`今回の${coachTime(meet.resultSeconds)}を新しいPBとして記録します。`}`,
    `NEW PBです。結果そのものに加え、試合前7日の負荷・休養・疲労感を「うまくいった調整例」として今後比較できます。`,
    `自己ベストを更新しました。単発の評価で終わらせず、直前3日・7日のパターンを次回の比較基準として残します。`,
    `PB更新。今回の結果は、今後「好調時の試合前パターン」を作るための重要な基準データです。`
  ],seed));
  else if(meet.isSB) parts.push(pick(["今季ベスト（SB）です。PB更新ではありませんが、今季の状態が最も高い水準まで上がった記録として扱えます。","SB更新です。シーズン内では最良の結果なので、直前1週間の調整を今季の比較基準にできます。","今季最高記録を更新しました。PBとの差と試合前コンディションを分けて記録しておくと次戦の判断材料になります。"],seed+1));
  if(!meet.isPB&&pbr!=null){
    if(pbr>=99.5)parts.push(pick([`PB速度比${pbr.toFixed(1)}%で、自己ベストとほぼ同水準のレースです。`,`従来PBに対して${pbr.toFixed(1)}%の速度水準で、非常に近いパフォーマンスでした。`],seed+2));
    else if(pbr>=97)parts.push(pick([`PB速度比${pbr.toFixed(1)}%で、高い水準の結果です。`,`自己ベストの${pbr.toFixed(1)}%相当の速度でまとめています。試合条件と直前疲労を合わせて評価できます。`],seed+3));
    else if(pbr<95)parts.push(pick([`PB速度比${pbr.toFixed(1)}%です。PBとの差だけで判断せず、風・展開・疲労・ラウンドなどの条件もメモと合わせて振り返ってください。`,`自己ベストからは差のある結果です（PB速度比${pbr.toFixed(1)}%）。単純な能力低下と断定せず、試合条件と直前の負荷を分けて確認します。`],seed+4));
  }
  if(previous){ const diff=Number(meet.resultSeconds)-Number(previous.resultSeconds); if(Math.abs(diff)>=0.01){ if(diff<0)parts.push(`同種目の前回レースより${Math.abs(diff).toFixed(2)}秒速くなっています。`); else parts.push(`同種目の前回レースより${diff.toFixed(2)}秒遅い結果です。前回との条件差も合わせて比較してください。`); } }
  if(recentMedian&&recent.length>=3){ const d=(recentMedian-Number(meet.resultSeconds))/recentMedian*100; if(d>=1.5)parts.push(`直近${recent.length}レースの中央値より約${d.toFixed(1)}%速く、最近の試合の中では高い結果です。`); else if(d<=-2)parts.push(`直近${recent.length}レースの中央値より約${Math.abs(d).toFixed(1)}%遅めです。最近の状態との差として記録しておく価値があります。`); }
  if(meet.windAssisted) parts.push("追い風参考条件のため、結果は保存しますが公式PB・SBの自動更新対象にはしていません。");
  else if(meet.windMissing&&meet.official) parts.push("風の影響を受ける種目で風速が未入力のため、公式PB判定は保留しています。");
  else if(Number.isFinite(Number(meet.wind))){ const w=Number(meet.wind); if(w<=-1)parts.push(`風速${w.toFixed(1)}m/sの向かい風条件です。記録差の要因候補として残しますが、風だけを原因とは断定しません。`); else if(w>=1.5&&w<=2)parts.push(`風速+${w.toFixed(1)}m/sで、公認範囲内では比較的追い風の強い条件です。条件差として記録しておきます。`); }
  const fb=Number(meet.fatigueBefore||0),fa=Number(meet.fatigueAfter||0); if(fb>=4)parts.push(pick([`試合前疲労感は${fb}/5と高めでした。今回の結果と直前7日の負荷をセットで比較してください。`,`スタート前の疲労感が${fb}/5です。結果が良くても悪くても、次戦では同程度の疲労状態だったかを比較できます。`],seed+5)); else if(fb<=2)parts.push(pick([`試合前疲労感は${fb}/5で、主観的には比較的フレッシュな状態でした。`,`レース前疲労感${fb}/5で、自己申告上は疲労が少ない状態で試合を迎えています。`],seed+6));
  if(fa&&fb&&fa-fb>=3)parts.push(`試合前後で疲労感が${fb}/5→${fa}/5へ大きく上がっています。次の高負荷練習までの回復日数を追跡します。`);
  if(prep?.metrics){ const m=prep.metrics; if(pbr!=null&&pbr>=99&&m.volumeRatio!=null&&m.volumeRatio<=0.85)parts.push("PBに近い結果と、試合前7日の走行量減少が同時に記録されています。今後同様の試合が増えれば、自分に合う調整パターンか比較できます。"); else if(pbr!=null&&pbr<95&&m.fatigueAvg!=null&&m.baseFat!=null&&m.fatigueAvg-m.baseFat>=0.8)parts.push("今回はPBとの差と、普段より高い試合前疲労が同時に見られました。因果関係は断定せず、次の試合でも同じ組み合わせが出るか確認します。"); }
  if(previous){ const gap=daysBetween(previous.date,meet.date); if(gap>0&&gap<=7)parts.push(`同種目の前回レースから${gap}日です。短い間隔での連戦なので、試合後疲労の戻り方も記録しておくと比較しやすくなります。`); }
  return{text:parts.filter(Boolean).slice(0,8).join(" ")||"試合結果を保存しました。試合数が増えると、PB・SB、前回レース、最近の中央値、試合前後の疲労を組み合わせて比較します。",metrics:{pbRatio:pbr,priorCount:prior.length,recentMedian,previousResult:previous?.resultSeconds||null}};
}

function buildRacePostAnalysis(meet,trainings=[],profile={},baseISO=isoOf(new Date())){
  if(!meet?.date)return{text:"試合日がないため試合後分析はできません。",metrics:{}};
  const elapsed=daysBetween(meet.date,baseISO); if(elapsed<1)return{text:"試合後の練習記録が増えると、回復までの日数・疲労感の戻り方・次の高負荷日までの間隔を自動で分析します。",metrics:{elapsed}};
  const start=addDays(dateAt(meet.date),1), end3=addDays(dateAt(meet.date),Math.min(3,elapsed)), end7=addDays(dateAt(meet.date),Math.min(7,elapsed));
  const post3=trainings.filter(x=>inWindow(x,start,end3)), post7=trainings.filter(x=>inWindow(x,start,end7));
  const sorted=[...post7].sort((a,b)=>a.date.localeCompare(b.date)), first=sorted[0]||null, firstGap=first?daysBetween(meet.date,first.date):null;
  const high2=post7.filter(x=>daysBetween(meet.date,x.date)<=2&&isHighLoadSession(x)).length, high7=post7.filter(isHighLoadSession).length;
  const beforeVals=sorted.map(x=>fatiguePair(x).before).filter(x=>x>0), firstFat=beforeVals[0]??null,lastFat=beforeVals.length?beforeVals[beforeVals.length-1]:null;
  const baseStart=addDays(dateAt(meet.date),-35),baseEnd=addDays(dateAt(meet.date),-8),baseline=trainings.filter(x=>inWindow(x,baseStart,baseEnd)),baseFat=mean(baseline.map(x=>fatiguePair(x).before).filter(x=>x>0));
  const recovery=sorted.find(x=>{const f=fatiguePair(x).before;return f>0&&(f<=2||(baseFat!=null&&f<=baseFat+0.25));}), recoveryDay=recovery?daysBetween(meet.date,recovery.date):null;
  const seed=hashSeed({meet,post7:post7.length,baseISO}),parts=[];
  if(!post7.length){ if(elapsed>=3)parts.push(`試合後${Math.min(elapsed,7)}日間は日誌上の練習記録がありません。実際に休養していた場合は回復期間として扱えますが、未入力の可能性もあるため断定はしません。`); else parts.push("試合後の練習記録はまだありません。次の練習を入力すると回復状況の追跡を開始します。"); return{text:parts.join(" "),metrics:{elapsed,postDays:0,firstGap:null,high2:0,high7:0,recoveryDay:null}}; }
  if(firstGap!=null)parts.push(pick([`試合後最初の練習記録は${firstGap}日後です。`,`レース後${firstGap}日で次の練習を再開しています。`],seed));
  if(recoveryDay!=null)parts.push(pick([`練習前疲労感は試合${recoveryDay}日後に${fatiguePair(recovery).before}/5まで戻っています。記録上の回復目安として残します。`,`試合後${recoveryDay}日で開始前疲労が通常域に戻った記録があります。今後の試合後回復日数と比較できます。`],seed+1));
  else if(firstFat!=null&&firstFat>=4)parts.push(`試合後の練習前疲労感は${firstFat}/5と高めから始まっており、現時点では通常域への回復日を確認できていません。`);
  if(firstFat!=null&&lastFat!=null&&beforeVals.length>=2){ const d=lastFat-firstFat; if(d<=-1)parts.push(`試合後の練習前疲労感は${firstFat}/5→${lastFat}/5へ低下しており、記録上は回復方向です。`); else if(d>=1)parts.push(`試合後の練習前疲労感は${firstFat}/5→${lastFat}/5へ上昇しています。試合後に負荷を重ねた影響がないか日誌と合わせて確認してください。`); }
  if(high2>=1)parts.push(pick([`試合後2日以内に高負荷日が${high2}回あります。レース後の回復途中で強い刺激を入れたパターンとして記録します。`,`レースから2日以内に高負荷練習を再開しています。次の試合でも疲労の戻り方と合わせて比較してください。`],seed+2));
  else if(elapsed>=2)parts.push("試合後2日以内には、記録上の高負荷日はありませんでした。");
  if(Number(meet.fatigueAfter)>=5&&high2>=1)parts.push("試合後疲労感が5/5だったうえで2日以内に高負荷練習があります。次回の開始前疲労が戻っていたかを重点的に確認してください。");
  if(meet.isPB&&recoveryDay!=null)parts.push(`PBを出した試合後は${recoveryDay}日で疲労感が通常域に戻った記録になっています。今後、好結果後の回復パターンとして比較できます。`);
  return{text:parts.filter(Boolean).slice(0,6).join(" "),metrics:{elapsed,postDays:new Set(post7.map(x=>x.date)).size,firstGap,high2,high7,recoveryDay,firstFat,lastFat,baseFat}};
}
