const CATEGORY_GROUPS={
 sprint:[["short_dash","ショートダッシュ"],["acceleration","加速走"],["flying","フライング"],["speed","スピード"],["speed_endurance","スピード持久"],["tempo","テンポ走"],["hill","坂ダッシュ"],["hurdle_drill","ハードル技術"],["jog","ジョグ"],["weights","ウェイト・補強"],["other","その他"]],
 middle:[["interval","インターバル"],["repetition","レペティション"],["pace","ペース走"],["tempo","テンポ走"],["speed","スピード"],["speed_endurance","スピード持久"],["jog","ジョグ"],["long_run","ロング走"],["hill","坂"],["weights","ウェイト・補強"],["other","その他"]],
 long:[["jog","ジョグ"],["pace","ペース走"],["interval","インターバル"],["repetition","レペティション"],["long_run","ロング走・LSD"],["build_up","ビルドアップ"],["tempo","テンポ走"],["hill","坂"],["weights","ウェイト・補強"],["other","その他"]],
 hurdles:[["hurdle_drill","ハードル技術"],["short_dash","ショートダッシュ"],["acceleration","加速走"],["speed","スピード"],["speed_endurance","スピード持久"],["tempo","テンポ走"],["jog","ジョグ"],["weights","ウェイト・補強"],["other","その他"]]
};
const CATEGORY_LABELS=Object.fromEntries(Object.values(CATEGORY_GROUPS).flat());
function ageBand(age){if(age<=12)return"youth";if(age<=15)return"junior";if(age<=18)return"highschool";if(age<=22)return"college";if(age<=34)return"adult";if(age<=49)return"mastersA";return"mastersB"}
function mean(arr){const a=arr.filter(Number.isFinite);return a.length?a.reduce((x,y)=>x+y,0)/a.length:null}
function maxDrop(times){const a=times.filter(Number.isFinite);if(a.length<2||a[0]<=0)return null;const worst=Math.max(...a);return(worst/a[0]-1)*100}
function pbRatio(pb,time){return pb&&time&&time>0?pb/time*100:null}
function intensityFromRatio(r){if(r==null)return"unknown";if(r>=97)return"very_high";if(r>=93)return"high";if(r>=88)return"moderate_high";if(r>=80)return"moderate";return"low"}
function select(arr,seed=0){return arr[Math.abs(seed)%arr.length]}
function hashSeed(obj){const s=JSON.stringify(obj);let h=0;for(let i=0;i<s.length;i++)h=((h<<5)-h+s.charCodeAt(i))|0;return h}
function customCoachNotice(){return"この記録はユーザー作成のカスタムメニューです。基準値とのパフォーマンス比較と履歴保存は行いますが、メニュー自体は簡易コーチの評価対象外です。練習前後の疲労感はコンディション情報として確認します。"}
function fatiguePair(x){const before=Number(x.fatigueBefore||x.fatigue||0),after=Number(x.fatigueAfter||x.fatigue||0);return{before,after,delta:before&&after?after-before:0}}
function conditionComment(x){const{before,after,delta}=fatiguePair(x),parts=[];if(before>=4)parts.push(`練習前の疲労感が${before}/5と高めです。直近の練習量・睡眠・回復状態を確認してください。`);if(after>=5)parts.push("練習後の疲労感が5/5です。次回の高強度練習まで十分な回復を確保してください。");else if(delta>=2&&after>=4)parts.push(`疲労感が練習前${before}/5から練習後${after}/5へ大きく上昇しています。今日は十分な負荷がかかった可能性があります。`);else if(delta<=-1)parts.push(`疲労感は練習前${before}/5から練習後${after}/5へ低下しています。回復目的の軽い練習だった場合は良い反応の可能性があります。`);return parts}
function buildCoachComment(current,history=[],profile={},nextMeet=null){
 if(current.isCustom){const c=conditionComment(current);return [customCoachNotice(),...c].join(" ")}
 const seed=hashSeed(current),avg=current.averageTime||mean(current.times||[]),ratio=current.pbRatio||pbRatio(current.pb,avg),drop=current.dropPct??maxDrop(current.times||[]),rpe=Number(current.rpe||0),{before:fatigueBefore,after:fatigueAfter,delta:fatigueDelta}=fatiguePair(current),age=Number(profile.age||18),band=ageBand(age),date=new Date(current.date+"T12:00:00");
 const sevenAgo=new Date(date);sevenAgo.setDate(sevenAgo.getDate()-6);
 const standardHistory=history.filter(x=>!x.isCustom),recent=standardHistory.filter(x=>{const d=new Date(x.date+"T12:00:00");return d>=sevenAgo&&d<=date});
 const highRecent=recent.filter(x=>["high","very_high"].includes(intensityFromRatio(x.pbRatio))).length+(["high","very_high"].includes(intensityFromRatio(ratio))?1:0);
 let consecutive=1;const uniqueDates=[...new Set([...recent.map(x=>x.date),current.date])].sort().reverse();if(uniqueDates.length){let d0=new Date(uniqueDates[0]+"T12:00:00");for(let i=1;i<uniqueDates.length;i++){const d1=new Date(uniqueDates[i]+"T12:00:00"),diff=Math.round((d0-d1)/86400000);if(diff===1){consecutive++;d0=d1}else break}}
 const parts=[];
 if(ratio!=null){if(ratio>=97)parts.push(select([`PB速度比${ratio.toFixed(1)}%で、非常に高いスピード域です。量を増やすより質と回復を優先してください。`,`PBにかなり近い強度です（${ratio.toFixed(1)}%）。追加メニューは目的を絞り、疲労を残し過ぎない構成が安全です。`],seed));else if(ratio>=93)parts.push(select([`PB速度比${ratio.toFixed(1)}%の高強度域です。スピード刺激として十分な負荷です。`,`PB速度比${ratio.toFixed(1)}%。質の高い練習です。次回は回復状態を確認して高強度を重ねてください。`],seed));else if(ratio>=88)parts.push(`PB速度比${ratio.toFixed(1)}%。中～高強度で、反復の質を揃えやすい範囲です。`);else if(ratio>=80)parts.push(`PB速度比${ratio.toFixed(1)}%。全力系より量・フォーム・リズムを重視しやすい強度です。`);else parts.push(`PB速度比${ratio.toFixed(1)}%。回復走・技術確認など低強度が目的なら妥当です。`)}
 if(drop!=null){if(drop>=7)parts.push(select([`1本目からの最大タイム低下が${drop.toFixed(1)}%あります。本数・レスト・設定タイムの見直し候補です。`,`反復後半で${drop.toFixed(1)}%低下しています。次回は本数より各本の質を揃えることを優先してみてください。`],seed+1));else if(drop>=4)parts.push(`最大タイム低下は${drop.toFixed(1)}%です。後半にやや疲労が見られます。練習意図と照らして確認してください。`);else if(drop>=0)parts.push(select([`タイム低下は${drop.toFixed(1)}%に収まり、反復の再現性は良好です。`,`各本のばらつきが比較的小さく、設定を安定してこなせています。`],seed+2))}
 if(rpe>=9&&ratio!=null&&ratio<88)parts.push("主観強度が高い一方でPB比は低めです。疲労・睡眠・暑熱・体調の影響がないか確認してください。");if(rpe<=6&&ratio!=null&&ratio>=93)parts.push("高い速度に対してRPEが比較的低く、コンディションが良い可能性があります。無理な追加はせず良い感覚を残しましょう。");parts.push(...conditionComment(current));if(fatigueBefore>=4&&ratio!=null&&ratio<88&&rpe>=8)parts.push("練習前疲労が高く、PB比が低めでRPEも高い組み合わせです。疲労蓄積の可能性も考え、次回は回復状態を優先して確認してください。");if(consecutive>=4)parts.push(`${consecutive}日連続で標準メニューの練習記録があります。回復日を入れる余地がないか確認してください。`);if(highRecent>=3)parts.push(`直近7日で高強度の標準メニューが${highRecent}回あります。高強度日の間隔と睡眠・筋疲労を確認してください。`);
 const cat=current.category;if(["short_dash","acceleration","flying","speed"].includes(cat))parts.push(select(["速度練習では、タイムだけでなくフォームが崩れる前に終了することも重要です。","最高速度系は疲労した状態で本数だけ増やすより、十分なレストで1本の質を守る方が目的に合いやすいです。","スタートや加速が目的なら、最初の数歩の姿勢・接地位置・力みもメモしておくと比較しやすくなります。"],seed+3));else if(cat==="speed_endurance")parts.push(select(["スピード持久では、終盤のタイム低下とフォーム維持をセットで評価すると進歩が見えやすくなります。","スピード持久は負荷が高くなりやすいため、翌日に高強度を自動的に続けない方が無難です。"],seed+4));else if(["interval","repetition"].includes(cat))parts.push(select(["インターバル系は平均タイムだけでなく、最速・最遅・後半の低下も見ると設定の適否を判断しやすくなります。","反復練習では、設定ペースと後半の失速率を両方記録すると比較しやすくなります。"],seed+5));else if(["pace","long_run","build_up","jog"].includes(cat))parts.push(select(["持久系ではタイムだけでなくRPEも残すと、同じペースが楽になったか長期比較できます。","低～中強度日は、次の高強度練習につなげる回復・有酸素刺激という役割も意識すると週全体を組みやすくなります。"],seed+6));else if(cat==="hurdle_drill")parts.push("ハードルはタイムだけでなく、歩数・リズム・踏切位置など技術メモを残すと再現性の比較に役立ちます。");else if(cat==="weights")parts.push("ウェイトは走練習と別日に見えても神経・筋疲労が残るため、翌日の高速度練習との組み合わせを確認してください。");
 if(band==="youth"||band==="junior")parts.push("成長期は高負荷を連日積み重ねるより、技術・動きの質・十分な休養を優先してください。痛みがある場合は練習を中止し、保護者や指導者に相談してください。");else if(band==="highschool")parts.push("高校年代は練習量が増えやすい時期です。記録向上だけでなく、痛み・睡眠・疲労の変化も継続して見てください。");else if(band==="mastersA"||band==="mastersB")parts.push("マスターズでは高強度練習の質を保ちつつ、回復日を十分に確保することを優先してください。");
 if(nextMeet){const md=new Date(nextMeet.date+"T12:00:00"),days=Math.ceil((md-date)/86400000);if(days>=0&&days<=2)parts.push(`大会まで${days===0?"当日":days+"日"}です。新しい刺激を増やすより、疲労を残さず動きの確認を中心にしてください。`);else if(days<=7)parts.push(`大会まで${days}日です。高強度を入れる場合も量を抑え、疲労を抜く余地を残してください。`);else if(days<=14)parts.push(`大会まで${days}日です。試合に向けて高強度の「量」より「質」を整える時期に入っています。`)}
 if(!parts.length)parts.push("練習を保存すると、PB比・反復の低下・RPE・練習前後の疲労感・直近負荷・年齢・大会予定を組み合わせてコメントします。");return parts.slice(0,4).join(" ")
}
function buildWeeklyCoach(trainings,profile,nextMeet){
 const standard=trainings.filter(x=>!x.isCustom),all=trainings;
 if(!all.length)return"今週の記録がありません。練習を保存すると週間負荷とコンディションを自動分析します。";
 const pre=all.map(x=>fatiguePair(x).before).filter(Boolean),post=all.map(x=>fatiguePair(x).after).filter(Boolean),avgPre=mean(pre),avgPost=mean(post);
 if(!standard.length){let msg="今週はカスタムメニューの記録のみです。メニュー自体は簡易コーチ評価対象外です。";if(avgPre!=null)msg+=` 練習前疲労感の平均は${avgPre.toFixed(1)}/5`;if(avgPost!=null)msg+=`、練習後は${avgPost.toFixed(1)}/5です。`;return msg}
 const sorted=[...standard].sort((a,b)=>a.date.localeCompare(b.date)),highs=sorted.filter(x=>["high","very_high"].includes(intensityFromRatio(x.pbRatio))).length,avgRpe=mean(sorted.map(x=>Number(x.rpe)).filter(Boolean));let msg=`標準メニューは今週${sorted.length}回、高強度は${highs}回です。`;
 if(highs>=3)msg+=" 高強度が多めなので、次の高強度日までの回復を確認してください。";else if(highs===0)msg+=" PB比93%以上の高強度記録はありません。目的がスピード向上期なら刺激不足でないか確認してください。";
 if(avgRpe>=8)msg+=` 平均RPEは${avgRpe.toFixed(1)}で高めです。`;
 if(avgPre>=4)msg+=` 練習前疲労感の平均が${avgPre.toFixed(1)}/5と高めです。`;
 if(avgPost!=null&&avgPre!=null&&avgPost-avgPre>=1.5)msg+=` 練習前後で疲労感が平均${(avgPost-avgPre).toFixed(1)}ポイント上昇しています。回復日の配置を確認してください。`;
 const dated=[...all].sort((a,b)=>a.date.localeCompare(b.date)).slice(-4);if(dated.length>=3){const vals=dated.map(x=>fatiguePair(x).before).filter(Boolean);if(vals.length>=3&&vals.every((v,i)=>i===0||v>=vals[i-1])&&vals[vals.length-1]-vals[0]>=2)msg+=" 直近の練習前疲労感が連続して上昇しています。タイムが落ちる前でも回復状態を確認してください。"}
 if(nextMeet){const d=Math.ceil((new Date(nextMeet.date+"T12:00:00")-new Date())/86400000);if(d>=0&&d<=14)msg+=` 次の大会まで${d}日です。`}
 if(trainings.some(x=>x.isCustom))msg+=" カスタムメニューの内容・基準比はこの評価に含めず、疲労感のみコンディション情報として参照しています。";return msg
}
