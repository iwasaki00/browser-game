// Read-only view model. The scanner is the shared discovery/permission boundary.
import {scanObjects} from './space-scanner.js';

export function destinationInfo(context,id=context.stage.goal.id){
 const row=scanObjects(context).find(o=>o.id==='destination:'+(id??'goal'));
 if(!row)return null;
 const p=context.position??context.stage.launch.position;
 return {id:row.sourceId,name:row.name,state:row.state,description:row.description,method:row.method,distance:Math.round(Math.hypot(row.x-p.x,row.y-p.y)),selectable:Boolean(row.destination)};
}
const guide=(code,title,description,steps,selector,label,reason,after,focus=null)=>({code,title,description,steps,selector,label,reason,after,focus});
export function missionGuide(context){
 const {stage,phase='editing',playType='free',progress={},launchMode='precision',adjusted=false,ending:suppliedEnding=null,canNext=true}=context;
 const ending=stage.finalVoyage?suppliedEnding:null;
 const home=playType==='homeward',wide=home&&Boolean(stage.openVoyage||stage.deepSpace||stage.finalVoyage),info=destinationInfo(context);
 const navigation=wide?'#openDestinations':'#openHomeward';
 const raw=stage.finalVoyage?progress.finalVoyage:stage.deepSpace?progress.deep:progress.voyage;
 const target=info?.name??'目的地',route=()=>guide('destination','目的地を選ぼう','寄港中です。今いる地点とは別の航行先を選べます。',['目的地を開く','行き先を選び、説明と距離を確認する','「航行画面へ進む」で戻る'],navigation,'目的地を選ぶ','次に到達を判定する対象を決めます。','選択した行き先の予測航路を調整できます。');
 if(phase==='cleared'&&context.missionComplete===false)return guide('incomplete','到達しましたが任務条件が未達です',stage.description,['HOMEWARDの攻略ヒントで遭遇条件を確認する','直前の配置・入力で再調整する','予測を確認して再発射する'],'#retryLastResult','直前の条件で再調整','目的地への到達に加え、この宙域の遭遇条件が必要です。','条件を満たして到達すると次の宙域へ進めます。');
 if(phase==='cleared')return guide(ending?'ending':'arrived',ending?`航海の結末：${ending}`:'目的地に到達しました',ending?'記録は航海日誌から再閲覧できます。探索や別の結末への挑戦も続けられます。':'今回の航行を記録しました。次の航路へ進むか、再挑戦できます。',[canNext?'次の航路・目的地を確認する':'メニューから記録を確認する'],canNext?'#nextStage':'#openMenuSettings',canNext?'次の航路へ':'メニューを開く','到達後の選択は自分で行えます。','記録を保持したまま次の操作へ進みます。');
 if(!['editing','flying'].includes(phase))return guide('retry','航路を見直そう','失敗理由と最接近距離を確認し、少しずつ条件を変えて試せます。',['直前の配置・入力で再調整','予測線を見ながら角度か推力を変更','再発射する'],'#retryLastResult','直前の条件で再調整','失敗した入力から比較すると変更の効果を確かめやすくなります。','同じ発射地点と配置で再挑戦できます。');
 if(context.scanExpanded)return guide('scan','天体情報を確認中',`${target}が現在の目標です。SCANで確認後、航路の操作へ戻れます。飛行中の航行は継続しています。`,['天体情報・操作可否を確認する','SCANを閉じ、現在の任務へ戻る'],'#scanButton','SCANを閉じて航行画面へ','情報表示を閉じても天体や進行は変わりません。','広い盤面で航路の調整・航行を続けられます。');
 if(context.tutorial)return guide('tutorial',context.tutorial.title,context.tutorial.text,['盤面の航法ガイドで一つずつ操作する','必要ならガイドをスキップして自由に試す'],context.tutorial.selector,'案内されている操作へ','既存の初回チュートリアルを進めます。','ガイドを終えると通常の操作へ戻ります。');
 if(phase==='flying'){
  const investigated=wide&&info?.state==='INVESTIGATED';
  return guide(investigated?'investigated':'flying',investigated?'調査完了・航行継続':`${target}へ航行中`,investigated?'取得情報は航海日誌に残ります。飛行は継続中です。寄り道先の変更は任意です。':'ロケットは物理演算で航行しています。倍率やカメラを変更して見守れます。',[wide?'必要なら目的地を変更する':'ロケットと予測した航路を見比べる','航行速度・FOLLOWで様子を見る'],investigated?navigation:'#flightRate',investigated?'次の行き先を確認':'航行速度を確認','時間倍率は固定ステップの実行数だけを変えます。','ゴール・衝突・発見は航行中に判定されます。');
 }
 if(home&&stage.id==='homeward-07'&&!progress.choices?.[stage.id])return guide('branch','出航前の判断を選ぼう','この宙域では追跡／回避を選びます。後から変更できます。',['HOMEWARDを開く','追跡または回避を選ぶ','航行画面へ戻る'],'#openHomeward','判断を選ぶ','この宙域の既存の出航条件です。','選んだ条件で航路を設計できます。');
 if(wide&&(!info||raw?.selected===null||raw?.checkpoint===stage.goal.id))return route();
 const clues=progress.echoes?.clues??{};
 if(stage.openVoyage&&clues['CLUE-05']&&(!clues['CLUE-06']||!clues['CLUE-07']))return guide('analysis','回収した通信を解析できます','解析は任意です。帰還や別の調査も続けられます。',['目的地画面を開く','通信解析のボタンを押す','結果は航海日誌で確認する'],navigation,'通信解析へ','回収した記録から判明している情報を整理します。','条件を満たすと新しい調査先が分かります。',`[data-signal-analysis="${clues['CLUE-06']?'timestamp':'identity'}"]`);
 if(stage.finalVoyage&&!raw?.decision)return guide('branch','最後の航行方針を選ぼう','目的地と条件を確認して、航路を自分で決めます。',['目的地画面を開く','最後の判断を選ぶ','選択先の条件を確認する'],navigation,'最後の判断へ','結末は判断と実際の到達結果で決まります。','自動操縦せず、選んだ行き先へ航行します。');
 const newlyUnlocked=stage.openVoyage&&clues['CLUE-04']&&!clues['CLUE-05']&&stage.goal.id==='gate'&&!adjusted;
 if(newlyUnlocked)return guide('unlocked','新しい航行先を確認できます','手掛かりから追加の行き先が判明しました。帰還を続けても構いません。',['目的地画面で行き先を比較する','帰還または寄り道を自分で選ぶ'],navigation,'行き先を比較する','解放された対象だけが一覧に表示されます。','選択した目的地へ向かう航路を調整できます。');
 if(wide&&!stage.finalVoyage&&!adjusted&&!(stage.deepSpace?raw?.choices?.length:progress.echoes?.choices?.length)&&!raw?.visited?.length)return guide('route-policy','航路の方針と行き先を選ぼう','帰還を優先するか、任意の調査へ向かうか選べます。目的地の選択後も操縦は自分で行います。',['方針・判断を確認する','選択可能な目的地と距離を比較する','航行画面へ戻り予測線を調整する'],navigation,'航路を選ぶ','既存の方針・判断と目的地を一つずつ確認します。','選んだ目的地への航行を準備できます。');
 const returning=wide&&['gate','return','earth'].includes(stage.goal.id),sling=launchMode==='slingshot';
 return guide(adjusted?'launch':returning?'return-ready':info?.state==='DETECTED'?'survey-ready':'prepare',adjusted?'ロケットを発射しよう':returning?'帰還航路を準備しよう':`${target}への航路をつくろう`,info?.state==='DETECTED'?info.method:home?stage.description:'予測線を見ながらANGLE（角度）とTHRUST（初速）を調整します。',sling?['ロケット付近を引っ張る','予測を確認して指を離す（元へ戻すとキャンセル）']:['ANGLEとTHRUSTを少しずつ調整','予測線と目的地・危険天体を確認','LAUNCHで発射'],sling?'#gameCanvas':adjusted?'#launchButton':'#angleInput',sling?'ロケットを引いて発射':adjusted?'LAUNCHで発射':'ANGLEを調整','予測と実航行は同じ物理エンジンを使います。','領域内に実際に到達すると航行結果が確定します。');
}
