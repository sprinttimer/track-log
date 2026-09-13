const CATEGORY_GROUPS = {
  sprint: [
    ["short_dash","ショートダッシュ"],["starting_blocks","スターティングブロック"],["acceleration","加速走"],["flying","フライング走（最高速度区間）"],["speed","スピード"],
    ["speed_endurance","スピード持久"],["tempo","テンポ走"],["hill","坂ダッシュ"],["hurdle_drill","ハードル技術"],
    ["jog","ジョグ"],["weights","ウェイト"],["other","その他"]
  ],
  middle: [
    ["interval","インターバル"],["repetition","レペティション"],["pace","ペース走"],["tempo","テンポ走"],
    ["speed","スピード"],["speed_endurance","スピード持久"],["jog","ジョグ"],["long_run","ロング走"],
    ["hill","坂"],["weights","ウェイト"],["other","その他"]
  ],
  long: [
    ["jog","ジョグ"],["pace","ペース走"],["interval","インターバル"],["repetition","レペティション"],
    ["long_run","ロング走・LSD"],["build_up","ビルドアップ"],["tempo","テンポ走"],["hill","坂"],
    ["weights","ウェイト"],["other","その他"]
  ],
  hurdles: [
    ["hurdle_drill","ハードル技術"],["short_dash","ショートダッシュ"],["starting_blocks","スターティングブロック"],["acceleration","加速走"],["flying","フライング走（最高速度区間）"],["speed","スピード"],
    ["speed_endurance","スピード持久"],["tempo","テンポ走"],["jog","ジョグ"],["weights","ウェイト"],["other","その他"]
  ]
};
const CATEGORY_LABELS = Object.fromEntries(Object.values(CATEGORY_GROUPS).flat());

function mean(arr){ const a=arr.filter(Number.isFinite); return a.length ? a.reduce((x,y)=>x+y,0)/a.length : null; }
function sum(arr){ return arr.filter(Number.isFinite).reduce((x,y)=>x+y,0); }
function maxDrop(times){ const a=times.filter(Number.isFinite); if(a.length<2||a[0]<=0)return null; return (Math.max(...a)/a[0]-1)*100; }
function pbRatio(pb,time){ return pb&&time&&time>0 ? pb/time*100 : null; }
function intensityFromRatio(r){ if(r==null)return"unknown"; if(r>=97)return"very_high"; if(r>=93)return"high"; if(r>=88)return"moderate_high"; if(r>=80)return"moderate"; return"low"; }
function hashSeed(obj){ const s=JSON.stringify(obj); let h=0; for(let i=0;i<s.length;i++)h=((h<<5)-h+s.charCodeAt(i))|0; return h; }
function pick(arr,seed=0){ return arr[Math.abs(seed)%arr.length]; }
function dateAt(iso){ return new Date(`${iso}T12:00:00`); }
function addDays(date,n){ const d=new Date(date); d.setDate(d.getDate()+n); return d; }
function isoOf(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function daysBetween(a,b){ return Math.round((dateAt(b)-dateAt(a))/86400000); }
function ageBand(age){ if(age<=12)return"youth"; if(age<=15)return"junior"; if(age<=18)return"highschool"; if(age<=22)return"college"; if(age<=34)return"adult"; if(age<=49)return"mastersA"; return"mastersB"; }
function isWeightRecord(x){ return !!x.isWeight || x.subtype==="weight" || x.category==="weights"; }
function isCustomRecord(x){ return !!x.isCustom || x.subtype==="custom"; }
function isRunningRecord(x){ return !isCustomRecord(x) && !isWeightRecord(x) && x.activityType!=="race"; }
function fatiguePair(x){ const before=Number(x.fatigueBefore||x.fatigue||0),after=Number(x.fatigueAfter||x.fatigue||0); return{before,after,delta:before&&after?after-before:0}; }
function runningVolume(x){ return isRunningRecord(x) ? (Number(x.distance)||0)*(Number(x.reps)||1)*(Number(x.sets)||1) : 0; }
function srpeLoad(x){ const d=Number(x.durationMin),r=Number(x.rpe); return d>0&&r>0?d*r:null; }
const HIGH_LOAD_CATEGORIES = new Set(["short_dash","starting_blocks","acceleration","flying","speed","speed_endurance","interval","repetition","hill","hurdle_drill"]);
function isHighLoadSession(x){
  if(!isRunningRecord(x)) return false;
  if(["high","very_high"].includes(intensityFromRatio(x.pbRatio))) return true;
  const rpe=Number(x.rpe||0), cat=x.category;
  if(["short_dash","starting_blocks","acceleration","flying","speed","speed_endurance"].includes(cat)) return rpe>=7;
  if(["interval","repetition","hill","hurdle_drill"].includes(cat)) return rpe>=8;
  return rpe>=9;
}
function median(arr){ const a=arr.filter(Number.isFinite).sort((x,y)=>x-y); if(!a.length)return null; const m=Math.floor(a.length/2); return a.length%2?a[m]:(a[m-1]+a[m])/2; }
function sessionVolumeComment(current,history=[],seed=0){
  const volume=runningVolume(current);
  if(!(volume>0)) return null;
  const same=history.filter(isRunningRecord).filter(x=>x.category===current.category&&runningVolume(x)>0&&x.date<=current.date).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,10);
  const typical=median(same.map(runningVolume));
  const totalText=volume>=1000?`${(volume/1000).toFixed(volume%1000===0?0:1)}km`:`${Math.round(volume)}m`;
  if(typical&&same.length>=3){
    const ratio=volume/typical;
    if(ratio>=1.35) return pick([`距離・本数・セットからみた総走行量は${totalText}で、同じメニューの最近の通常量より約${Math.round((ratio-1)*100)}%多めです。`,`今回は合計${totalText}で、同じメニューの過去記録と比べて量が多い構成です。`],seed);
    if(ratio<=0.7) return pick([`総走行量は${totalText}で、同じメニューの通常量より約${Math.round((1-ratio)*100)}%少なめです。軽め・質重視の日なら自然な構成です。`,`今回は合計${totalText}で、同じメニューの普段より量を抑えた構成です。タイム未計測でも、これを低パフォーマンスとは判定しません。`],seed+1);
    return pick([`総走行量は${totalText}で、同じメニューの最近の通常範囲に収まっています。`,`距離・本数・セットからみた量は合計${totalText}で、過去の同メニューと大きな差はありません。`],seed+2);
  }
  return `距離・本数・セットからみた総走行量は${totalText}です。比較データが増えると、同じメニュー内で通常量との差も判定します。`;
}
function inWindow(x,start,end){ const d=dateAt(x.date); return d>=start&&d<=end; }
function customCoachNotice(){ return "この記録はユーザー作成のカスタムメニューです。基準値との比較・履歴保存は行いますが、メニュー内容やパフォーマンス±％は簡易コーチの評価対象外です。前後の疲労感・RPEは本人のコンディション情報として全体傾向に利用します。"; }
function weightCoachNotice(){ return "ウェイトはユーザー登録種目を中心に記録します。重量・レップ・セット・総ボリュームは履歴比較に使用しますが、種目内容そのものは簡易コーチの負荷判定対象外です。RPEと前後の疲労感は全体コンディションに利用します。"; }
function conditionComments(x,seed=0){
  const {before,after,delta}=fatiguePair(x), out=[];
  if(before>=4) out.push(pick([
    `開始前の疲労感が${before}/5と高めです。直近の練習量と回復状況を確認してください。`,
    `練習前から疲労感${before}/5です。今日の数値だけでなく、数日間の推移も合わせて確認してください。`,
    `開始時点の疲労感が高い状態です（${before}/5）。高強度を連続させていないか履歴を見直す価値があります。`
  ],seed));
  if(after===5) out.push(pick([
    "練習後の疲労感が5/5です。次の高強度日まで回復を優先してください。",
    "終了後の疲労感が最大値です。翌日の開始前疲労が下がるかを確認してください。"
  ],seed+1));
  else if(delta>=2&&after>=4) out.push(pick([
    `疲労感が${before}/5→${after}/5へ大きく上昇しました。今日は十分な刺激が入った可能性があります。`,
    `前後の疲労差が+${delta}です。次回の練習前に回復しているかを確認してください。`
  ],seed+2));
  else if(delta<=-1) out.push(`疲労感は${before}/5→${after}/5へ低下しています。軽い調整・回復目的の日なら良い反応の可能性があります。`);
  return out;
}
function buildCoachComment(current,history=[],profile={},nextMeet=null){
  const seed=hashSeed({current,n:history.length});
  if(isCustomRecord(current)) return [customCoachNotice(),...conditionComments(current,seed)].join(" ");
  if(isWeightRecord(current)) return [weightCoachNotice(),...conditionComments(current,seed)].join(" ");
  const ratio=current.pbRatio??pbRatio(current.pb,current.averageTime), drop=current.dropPct??maxDrop(current.times||[]), rpe=Number(current.rpe||0);
  const parts=[], hasTime=Number.isFinite(Number(current.averageTime))&&Number(current.averageTime)>0;
  if(!hasTime) parts.push(pick([
    "タイムは未計測です。速度・PB比による評価は行わず、距離・本数・セット・RPE・疲労感からこの日の内容を判定します。",
    "今回はタイムなしの記録です。未計測をマイナス評価には使わず、練習量と主観的負荷、前後の疲労感を中心に見ています。",
    "タイムが入力されていないため速度評価だけを省略しています。練習そのものは距離・本数・セットとコンディション情報から通常どおり記録・分析します。"
  ],seed));
  const volumeNote=sessionVolumeComment(current,history,seed+20); if(volumeNote) parts.push(volumeNote);
  if(ratio!=null){
    if(ratio>=97) parts.push(pick([`PB速度比${ratio.toFixed(1)}%で非常に高い速度域です。追加量より質と回復を優先してください。`,`PBにかなり近い強度です（${ratio.toFixed(1)}%）。目的以上に本数を増やさない方が質を保ちやすいです。`,`PB速度比${ratio.toFixed(1)}%。最大速度に近い刺激なので、次の高強度日との間隔も記録しておきましょう。`],seed));
    else if(ratio>=93) parts.push(pick([`PB速度比${ratio.toFixed(1)}%の高強度域です。スピード刺激として十分な水準です。`,`PB速度比${ratio.toFixed(1)}%。高い質で走れているため、後半の再現性と回復を確認してください。`,`PB比${ratio.toFixed(1)}%で高強度です。フォームを崩さず終えられているかメモを残すと比較しやすくなります。`],seed+1));
    else if(ratio>=88) parts.push(pick([`PB速度比${ratio.toFixed(1)}%。中～高強度で反復の質を揃えやすい範囲です。`,`PB比${ratio.toFixed(1)}%。強度と本数の両方を確保しやすいゾーンです。`],seed+2));
    else if(ratio>=80) parts.push(pick([`PB速度比${ratio.toFixed(1)}%。全力系より量・フォーム・リズムを重視しやすい強度です。`,`PB比${ratio.toFixed(1)}%。設定練習としては、タイムより動きの再現性も確認してください。`],seed+3));
    else parts.push(`PB速度比${ratio.toFixed(1)}%。回復走や技術確認が目的なら妥当ですが、高強度が目的なら設定を確認してください。`);
  }
  if(drop!=null){
    if(drop>=7) parts.push(pick([`1本目からの最大タイム低下が${drop.toFixed(1)}%あります。本数・レスト・設定タイムを見直す候補です。`,`後半の低下が${drop.toFixed(1)}%と大きめです。次回は総量より各本の質を揃える方法も検討してください。`],seed+4));
    else if(drop>=4) parts.push(pick([`最大タイム低下は${drop.toFixed(1)}%で、後半にやや疲労が見られます。`,`反復間の低下は${drop.toFixed(1)}%。練習意図の範囲内か、次回も比較してください。`],seed+5));
    else if(drop>=0) parts.push(pick([`タイム低下は${drop.toFixed(1)}%に収まり、反復の再現性は良好です。`,`各本のばらつきが小さく、設定を安定してこなせています。`,`失速は${drop.toFixed(1)}%で小さく、後半まで比較的まとまっています。`],seed+6));
  }
  if(rpe>=9&&ratio!=null&&ratio<88) parts.push("PB比に対してRPEが高めです。疲労、暑熱、睡眠、体調などタイム以外の要因も確認してください。");
  if(rpe<=6&&ratio!=null&&ratio>=93) parts.push("高い速度に対してRPEが比較的低く、記録上は良いコンディションの可能性があります。無理な追加はせず良い感覚を残しましょう。");
  if(!hasTime&&rpe>=8) parts.push(pick([`タイムはありませんがRPE ${rpe}/10のため、主観的には負荷の高いセッションとして扱います。`,`速度データは未計測ですがRPE ${rpe}/10です。少なくとも主観的負担は高めだった日として週間傾向に反映します。`],seed+21));
  else if(!hasTime&&rpe<=4) parts.push("タイム未計測ですが、RPEからは主観的負担を抑えたセッションとして記録します。");
  parts.push(...conditionComments(current,seed+7));
  const cat=current.category;
  const categoryPhrases={
    short_dash:["短いダッシュはタイムだけでなく、最初の数歩の姿勢と接地位置も記録すると比較しやすくなります。","短距離の最高出力系では、フォームが崩れる前に終えることも練習品質の一部です。"],
    starting_blocks:["スターティングブロック練習では、号砲後の最初の数歩と加速へのつながりを記録すると比較しやすくなります。","ブロックスタートは1本ごとの質を優先し、疲労で姿勢や押し出しが崩れる前に終了することも重要です。"],
    acceleration:["加速走は静止または低速から速度を高めていく区間そのものを重視する練習です。最初の数歩から中盤までのつながりをメモしておくと、タイム変化の理由を追いやすくなります。","加速練習ではレスト不足で速度が落ちていないかも確認してください。"],
    flying:["フライング走は、助走・加速後の最高速度区間を計測する練習です。加速走とは分けて記録し、助走距離と計測距離を毎回そろえると比較精度が上がります。","最高速度区間の比較では、助走距離と計測距離の条件を固定することが重要です。"],
    speed:["速度練習では、タイムだけでなくフォームが崩れる前に終了することも重要です。","最高速度系は十分なレストで1本の質を守る方が目的に合いやすいです。"],
    speed_endurance:["スピード持久では、終盤のタイム低下とフォーム維持をセットで評価すると進歩が見えやすくなります。","スピード持久は負荷が高くなりやすいため、翌日の開始前疲労を確認してください。"],
    interval:["インターバルは平均だけでなく、最速・最遅・後半低下を見ると設定の適否を判断しやすくなります。","インターバルではレスト条件を固定すると過去比較がしやすくなります。"],
    repetition:["レペティションは各本の質と十分な回復の両方が重要です。","反復練習では設定ペースと後半の低下を一緒に残すと比較しやすくなります。"],
    pace:["ペース走は設定ペースの再現性とRPEの変化をセットで見ると状態を把握しやすくなります。","同じペースでもRPEが下がってくれば、記録上は余裕度の改善を追いやすくなります。"],
    jog:["ジョグは速さより回復目的との整合性を優先してください。","回復目的なら終了後の疲労感が過度に上がっていないかを見るのが有効です。"],
    long_run:["ロング走は1回のペースだけでなく、週全体の疲労感と合わせて評価してください。","長い走行の翌日に開始前疲労が残るかを追うと、適量を見つけやすくなります。"]
  };
  if(categoryPhrases[cat]) parts.push(pick(categoryPhrases[cat],seed+8));
  if(cat==="flying"&&Number(current.approachDistance)>0) parts.push(`今回は助走${Number(current.approachDistance)}m→計測${Number(current.distance)||0}mとして記録されています。今後も同じ助走条件で比較すると最高速度区間の変化を追いやすくなります。`);
  if(nextMeet){ const gap=daysBetween(current.date,nextMeet.date), highLoad=isHighLoadSession(current); if(gap>=0&&gap<=3&&highLoad) parts.push(`次の大会まで${gap}日です。記録上は高負荷セッションなので、ここからの追加負荷は慎重にしてください。`); else if(gap>=4&&gap<=7&&highLoad) parts.push(`次の大会まで${gap}日です。今回の負荷から疲労が抜けるか、練習前疲労の推移を確認してください。`); }
  const band=ageBand(Number(profile.age||18));
  if(["youth","junior"].includes(band)&&rpe>=9) parts.push("成長期では高い主観負荷を連日重ねないよう、指導者と回復状況を共有してください。");
  else if(["mastersA","mastersB"].includes(band)&&rpe>=8) parts.push("高負荷後は次回の開始前疲労が戻っているかを確認し、回復日を調整してください。");
  return parts.slice(0,5).join(" ") || "記録を保存すると、距離・本数・セット・RPE・前後疲労を基礎に、タイムがある場合のみPB比や反復低下も加えてコメントします。";
}

function periodMetrics(trainings,baseISO){
  const base=dateAt(baseISO), recentStart=addDays(base,-6), baselineEnd=addDays(base,-7), baselineStart=addDays(base,-34);
  const recent=trainings.filter(x=>inWindow(x,recentStart,base));
  const baseline=trainings.filter(x=>inWindow(x,baselineStart,baselineEnd));
  const recentRun=recent.filter(isRunningRecord), baseRun=baseline.filter(isRunningRecord);
  const recentVol=sum(recentRun.map(runningVolume)), baseWeeklyVol=sum(baseRun.map(runningVolume))/4;
  const recentHigh=recentRun.filter(isHighLoadSession).length;
  const baseWeeklyHigh=baseRun.filter(isHighLoadSession).length/4;
  const recentFat=mean(recent.map(x=>fatiguePair(x).before).filter(x=>x>0)), baseFat=mean(baseline.map(x=>fatiguePair(x).before).filter(x=>x>0));
  const recentRpe=mean(recent.map(x=>Number(x.rpe)).filter(x=>x>0)), baseRpe=mean(baseline.map(x=>Number(x.rpe)).filter(x=>x>0));
  const recentSrpe=sum(recent.map(srpeLoad).filter(Number.isFinite)), baseSrpeRaw=baseline.map(srpeLoad).filter(Number.isFinite), baseWeeklySrpe=baseSrpeRaw.length>=2?sum(baseSrpeRaw)/4:null;
  const uniqueDays=new Set(recent.map(x=>x.date)).size, restDays=Math.max(0,7-uniqueDays);
  const sorted=recent.filter(x=>fatiguePair(x).before>0).sort((a,b)=>a.date.localeCompare(b.date));
  const firstFat=mean(sorted.slice(0,Math.min(3,sorted.length)).map(x=>fatiguePair(x).before));
  const lastFat=mean(sorted.slice(-Math.min(3,sorted.length)).map(x=>fatiguePair(x).before));
  return{recent,baseline,recentRun,baseRun,recentVol,baseWeeklyVol,volumeRatio:baseWeeklyVol>0?recentVol/baseWeeklyVol:null,recentHigh,baseWeeklyHigh,recentFat,baseFat,fatigueDiff:recentFat!=null&&baseFat!=null?recentFat-baseFat:null,recentRpe,baseRpe,recentSrpe,baseWeeklySrpe,srpeRatio:baseWeeklySrpe>0?recentSrpe/baseWeeklySrpe:null,restDays,fatigueTrend:firstFat!=null&&lastFat!=null?lastFat-firstFat:null,baselineReady:baseline.length>=4};
}
function buildWeeklyAnalysis(trainings,profile={},nextMeet=null,baseISO=isoOf(new Date())){
  const m=periodMetrics(trainings,baseISO), seed=hashSeed({baseISO,n:trainings.length,profile}), parts=[];
  if(!m.recent.length) return{text:"直近7日間の記録がありません。距離・本数・セット、練習前後の疲労感、RPEを記録すると傾向を比較できます。タイムは任意です。",metrics:m};
  if(m.baselineReady){
    if(m.volumeRatio!=null){
      if(m.volumeRatio>=1.3) parts.push(pick([`標準ランニングの走行量は本人の通常週より約${Math.round((m.volumeRatio-1)*100)}%多く、負荷量が明確に増えています。`,`直近7日の標準メニュー走行量は通常比${Math.round(m.volumeRatio*100)}%です。普段よりかなり多い週になっています。`,`通常の週と比べて走行量が約${Math.round((m.volumeRatio-1)*100)}%増えています。疲労感が追随して上がっていないか確認してください。`],seed));
      else if(m.volumeRatio>=1.1) parts.push(pick([`標準ランニングの走行量は通常より約${Math.round((m.volumeRatio-1)*100)}%多めです。`,`直近7日の走行量は通常比${Math.round(m.volumeRatio*100)}%で、やや高めの週です。`],seed+1));
      else if(m.volumeRatio<=0.7) parts.push(pick([`標準ランニングの走行量は通常より約${Math.round((1-m.volumeRatio)*100)}%少なく、軽めの1週間です。`,`直近7日の走行量は通常比${Math.round(m.volumeRatio*100)}%で、普段より明確に少なめです。`],seed+2));
      else if(m.volumeRatio<=0.9) parts.push(`標準ランニングの走行量は通常より約${Math.round((1-m.volumeRatio)*100)}%少なめです。`);
      else parts.push(pick(["標準ランニングの走行量は本人の通常範囲に収まっています。","直近7日の走行量は過去28日から見た通常週と大きな差はありません。"],seed+3));
    }
    if(m.recentHigh>=m.baseWeeklyHigh+1.2&&m.recentHigh>=2) parts.push(pick([`高負荷セッションが${m.recentHigh}回あり、通常より負荷日の密度が高くなっています。`,`タイムがある場合のPB比、またはメニュー特性とRPEからみた高負荷セッションが${m.recentHigh}回で、普段より負荷日の間隔が詰まっています。`],seed+4));
    else if(m.recentHigh===0&&m.baseWeeklyHigh>=1) parts.push("普段は入っている高負荷セッションが直近7日にはありません。調整週・回復週であれば自然な変化です。");
    if(m.fatigueDiff!=null&&m.fatigueDiff>=0.8) parts.push(pick([`練習前疲労感は通常より平均${m.fatigueDiff.toFixed(1)}ポイント高く、疲労が残った状態で始める日が増えています。`,`開始前疲労が普段より高めです（+${m.fatigueDiff.toFixed(1)}）。負荷量だけでなく回復の進み方にも注意してください。`],seed+5));
    else if(m.fatigueDiff!=null&&m.fatigueDiff<=-0.6) parts.push(`練習前疲労感は通常より平均${Math.abs(m.fatigueDiff).toFixed(1)}ポイント低く、記録上は比較的回復した状態です。`);
    if(m.srpeRatio!=null&&m.srpeRatio>=1.25) parts.push(`入力済みの練習時間×RPEによる主観的負荷は通常比${Math.round(m.srpeRatio*100)}%です。走行量以外の負担も高めです。`);
  }else parts.push("通常値を作るための過去データがまだ少ないため、今回は直近7日内の変化を中心に判定しています。記録が4週間ほど蓄積すると本人比が安定します。");
  if(m.fatigueTrend!=null&&m.fatigueTrend>=1) parts.push(pick(["この1週間の中でも練習前疲労感が後半に向かって上昇しています。","週の前半より後半の開始前疲労が高く、疲労が抜け切らず積み上がっている可能性があります。"],seed+6));
  else if(m.fatigueTrend!=null&&m.fatigueTrend<=-1) parts.push("週後半に向けて練習前疲労感が低下しており、記録上は回復方向です。");
  if(m.restDays===0) parts.push("直近7日間に完全な記録上の休養日がありません。連続練習が目的でなければ回復日の余地を確認してください。");
  else if(m.restDays>=3&&m.recent.length>=2) parts.push(`直近7日には記録上${m.restDays}日の休養日があります。負荷を抑えた週としては回復時間を確保できています。`);
  if(nextMeet){ const gap=daysBetween(baseISO,nextMeet.date); if(gap>=0&&gap<=3) parts.push(`次の大会まで${gap}日です。ここからは新しい負荷を足すより、開始前疲労が下がるかを優先して確認してください。`); else if(gap>=4&&gap<=7&&m.recentHigh>=2) parts.push(`大会まで${gap}日で、高負荷セッションが直近7日に${m.recentHigh}回あります。試合日に疲労を残さない間隔になっているか確認してください。`); }
  const excluded=m.recent.filter(x=>isWeightRecord(x)||isCustomRecord(x)).length; if(excluded) parts.push(`ウェイト・カスタム${excluded}件の内容自体は標準メニュー負荷に加えていませんが、入力された疲労感・RPEはコンディション傾向に反映しています。`);
  return{text:parts.slice(0,5).join(" "),metrics:m};
}
function buildWeeklyCoach(trainings,profile,nextMeet){ return buildWeeklyAnalysis(trainings,profile,nextMeet).text; }

function buildRaceAnalysis(meet,trainings,profile={}){
  const raceDate=meet.date, end=dateAt(raceDate), d7start=addDays(end,-7), d3start=addDays(end,-3), beforeEnd=addDays(end,-1), baseStart=addDays(end,-35), baseEnd=addDays(end,-8);
  const prior7=trainings.filter(x=>inWindow(x,d7start,beforeEnd)), prior3=trainings.filter(x=>inWindow(x,d3start,beforeEnd)), baseline=trainings.filter(x=>inWindow(x,baseStart,baseEnd));
  const run7=prior7.filter(isRunningRecord), run3=prior3.filter(isRunningRecord), baseRun=baseline.filter(isRunningRecord);
  const vol7=sum(run7.map(runningVolume)), baseWeeklyVol=sum(baseRun.map(runningVolume))/4, volumeRatio=baseWeeklyVol>0?vol7/baseWeeklyVol:null;
  const high7=run7.filter(isHighLoadSession).length, high3=run3.filter(isHighLoadSession).length;
  const fatigueAvg=mean(prior7.map(x=>fatiguePair(x).before).filter(x=>x>0)), baseFat=mean(baseline.map(x=>fatiguePair(x).before).filter(x=>x>0));
  const uniqueDays=new Set(prior7.map(x=>x.date)).size, restDays=Math.max(0,7-uniqueDays);
  const highs=[...run7].filter(isHighLoadSession).sort((a,b)=>b.date.localeCompare(a.date));
  const lastHighGap=highs[0]?daysBetween(highs[0].date,raceDate):null;
  const seed=hashSeed({meet,prior7:prior7.length}), parts=[];
  if(volumeRatio!=null){
    if(volumeRatio>=1.3) parts.push(pick([`試合前7日の標準ランニング量は通常週の${Math.round(volumeRatio*100)}%で、かなり高めでした。`,`試合前1週間の走行量は通常より約${Math.round((volumeRatio-1)*100)}%多く、負荷量を残した状態で試合を迎えています。`],seed));
    else if(volumeRatio>=1.1) parts.push(`試合前7日の標準ランニング量は通常比${Math.round(volumeRatio*100)}%で、やや多めでした。`);
    else if(volumeRatio<=0.7) parts.push(pick([`試合前7日の標準ランニング量は通常比${Math.round(volumeRatio*100)}%で、明確に落としていました。`,`試合前1週間は通常より約${Math.round((1-volumeRatio)*100)}%走行量を減らしており、量の面では調整が入っています。`],seed+1));
    else parts.push("試合前7日の標準ランニング量は本人の通常週と大きな差がありませんでした。");
  }else parts.push("通常週との走行量比較に必要な過去データがまだ不足しています。");
  if(high3>=2) parts.push(pick([`試合3日前以内に高負荷セッションが${high3}回あり、直前まで強い刺激が続いています。`,`試合前3日間に、タイムがある場合のPB比またはメニュー特性とRPEからみた高負荷セッションが${high3}回あります。疲労が残っていなかったか確認してください。`],seed+2));
  else if(high3===1) parts.push(`試合3日前以内に高負荷セッションが1回あります。最後の刺激として意図したものか、当日の疲労感と合わせて振り返ってください。`);
  else if(high7>0&&lastHighGap!=null) parts.push(`最後の高負荷セッションは試合${lastHighGap}日前でした。直前3日には高負荷セッションが入っていません。`);
  else parts.push("試合前7日には、記録上の高負荷セッションはありませんでした。タイム未計測日は低評価にせず、メニュー特性とRPEも含めて判定しています。");
  if(fatigueAvg!=null&&baseFat!=null){ const diff=fatigueAvg-baseFat; if(diff>=0.8) parts.push(`試合前7日の練習前疲労感は通常より平均${diff.toFixed(1)}ポイント高く、疲労の影響を考慮すべき状態でした。`); else if(diff<=-0.6) parts.push(`試合前7日の練習前疲労感は通常より平均${Math.abs(diff).toFixed(1)}ポイント低く、記録上は回復した状態で試合に近づいていました。`); else parts.push("試合前7日の練習前疲労感は本人の通常範囲でした。"); }
  if(restDays>=3) parts.push(`試合前7日には記録上${restDays}日の休養日があり、回復時間は比較的多めでした。`); else if(restDays<=1) parts.push(`試合前7日の休養日は記録上${restDays}日です。連続した活動がパフォーマンスに影響していないか確認してください。`);
  if(meet.resultSeconds){
    if(meet.isPB) parts.push(pick([`結果は自己ベスト更新です。今回の試合前パターンは今後の調整を比較する重要な基準になります。`,`PB更新でした。直前7日の負荷・疲労・休養の組み合わせを成功例として残しておく価値があります。`],seed+3));
    else if(meet.pbBefore){ const ratio=pbRatio(meet.pbBefore,meet.resultSeconds); if(ratio>=99) parts.push(`結果は従来PBの速度比${ratio.toFixed(1)}%で、自己ベストに近いパフォーマンスでした。`); else if(ratio<95&&fatigueAvg!=null&&baseFat!=null&&fatigueAvg-baseFat>=0.8) parts.push("結果はPBから離れていますが、試合前疲労も通常より高かったため、単純な能力低下とは切り分けて考える必要があります。"); else if(ratio<95) parts.push(`結果は従来PBの速度比${ratio.toFixed(1)}%です。疲労以外のレース展開・気象・技術要因もメモと合わせて振り返ってください。`); }
  }
  const band=ageBand(Number(profile.age||18)); if(["youth","junior"].includes(band)&&high3>=1) parts.push("成長期の選手では、試合直前の高負荷を固定ルールにせず指導者と回復状態を共有してください。");
  return{text:parts.slice(0,6).join(" "),metrics:{volumeRatio,high7,high3,fatigueAvg,restDays,lastHighGap,prior7Count:prior7.length}};
}
