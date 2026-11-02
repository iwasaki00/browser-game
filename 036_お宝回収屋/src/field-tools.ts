// Supplemental performance only: names, IDs and prices remain in the original 126-row master.
export const RIVER_ADDED=['R102','R202','R203','R204','R205','R210'];
export const GOLD_ADDED=['G104','G106','G108','G202','G204','G205'];
export interface FieldProfile {kind:'掘削'|'探知'|'回収'|'選別'|'補助';cost:number;operation:string;benefit:string;performance:string;}
export const fieldProfiles:Record<string,FieldProfile>={
 R102:{kind:'回収',cost:1.4,operation:'影をつかんで手前へ引く',benefit:'トングの届かない軽い非磁性物を回収。重さには弱い',performance:'距離190 / 引上げ1.5kg / 小物向け'},
 R202:{kind:'回収',cost:2.4,operation:'投擲・引きずり → 引く',benefit:'広い吸着面で鉄を探す。ロープ・巻取り器と併用可能',performance:'吸着12kg / 引上げ6kg / 範囲48 / ロープ併用'},
 R203:{kind:'回収',cost:2,operation:'隙間の影に引っかけて引く',benefit:'普通のフックでは重い非磁性物・障害物を回収',performance:'距離245 / 引上げ7kg / 隙間対応'},
 R204:{kind:'探知',cost:.4,operation:'影をタップして観察',benefit:'材質反応と障害物を観察。アームと併用して慎重に回収',performance:'観察距離330 / C07は観察後のアーム操作'},
 R205:{kind:'回収',cost:2,operation:'遠い影をつかんで引く',benefit:'ロープの届かない遠方の非磁性物へ。カメラと精密回収',performance:'距離330 / 引上げ3.2kg / C07時4.5kg'},
 R210:{kind:'探知',cost:.3,operation:'対象の負荷をタップで測る',benefit:'荷重を先に調べ、能力不足の無駄引きを回避。大型フックの姿勢制御',performance:'観察距離330 / 観察済みフックの品質保護'},
 G104:{kind:'回収',cost:.2,operation:'選別済みの粒をつまむ',benefit:'中粒は1操作。微細粒は2操作で、安価に精密回収を始める',performance:'中粒1回 / 微細2回 / 選別前は回収不可'},
 G106:{kind:'掘削',cost:6,operation:'採取地点を広くかき分ける',benefit:'1回10単位を広い範囲から採取。選別の供給を増やす',performance:'採取10単位 / 範囲52 / 後工程が必要'},
 G108:{kind:'補助',cost:0,operation:'装備して採取・投入を補助',benefit:'砂利袋を大きく集約。投入・粒径選別の準備を軽くする',performance:'袋上限96 / 同地点の未処理砂利を集約 / 準備体力軽減'},
 G202:{kind:'選別',cost:5.6,operation:'多段の網を左右に振る',benefit:'細粒を保持して大石を取り除く。皿での微細金の捕捉率を改善',performance:'粒径選別16単位 / 微細捕捉+0.06 / 比重選別は別工程'},
 G204:{kind:'回収',cost:.18,operation:'濃縮粒をまとめて吸い取る',benefit:'1操作で近い分離粒を最大4個回収。生砂利からは取れない',performance:'1回最大4粒 / 精密回収体力0.18'},
 G205:{kind:'選別',cost:1,operation:'投入済み砂利へ磁石をかける',benefit:'固定された砂鉄だけを取り除き、水流や皿の処理負担を軽くする',performance:'1回12単位 / 前処理後の水流時間18%減・微細捕捉+0.04 / C10'},
};
export const riverObservation=(id:string)=>id==='R204'||id==='R210';
export const goldGather=(id:string)=>['hand','G101','G106'].includes(id);
export const goldPrecision=(id:string)=>['hand','G104','G110','G204'].includes(id);
export const goldScreen=(id:string)=>id==='G103'||id==='G202';
export const goldProcessing=(id:string)=>['G102','G103','G201','G203','G202','G205'].includes(id);
