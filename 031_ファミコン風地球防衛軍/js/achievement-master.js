// Published 0.8.0 targets are snapshots, not the growing game masters.
export const CHALLENGE_MISSIONS=Object.freeze(['M01','M02','M03','M04','M05','M06']);
export const CHALLENGE_CLASSES=Object.freeze(['RANGER','SCOUT','GUARDIAN','WING']);
export const CHALLENGE_WEAPONS=Object.freeze(['A-01','S-02','L-03','R-04','F-05','T-06','G-07','H-08','B-09','R-10','X-11','P-12','P-13','G-14','F-15','T-16','S-17','M-18','D-19','M-20']);
export const ACHIEVEMENT_CATEGORIES=Object.freeze({C:'キャンペーン',K:'兵科',W:'武器',B:'戦闘',S:'特殊攻略',T:'探索・戦略'});
const badge={C:'盾',K:'階級章',W:'照準器',B:'爆発星',S:'勲章',T:'作戦記号'};
const rows=[
 ['C01','初陣突破','M01を通常プレイでクリア',1,'mission',1,'save','M01'],
 ['C02','地下の突破者','M02を通常プレイでクリア',1,'mission',1,'save','M02'],
 ['C03','沿岸防衛成功','M03を通常プレイでクリア',2,'mission',1,'save','M03'],
 ['C04','天空の制圧者','M04を通常プレイでクリア',2,'mission',1,'save','M04'],
 ['C05','移動要塞の破壊者','M05を通常プレイでクリア',3,'mission',1,'save','M05'],
 ['C06','地球防衛の英雄','M01〜M06をすべて通常クリア',4,'campaign',6,'save',null,'地球防衛の英雄'],
 ['K01','レンジャー初勝利','RANGERで通常ミッションをクリア',1,'class',1,'stats','RANGER'],
 ['K02','スカウト初勝利','SCOUTで通常ミッションをクリア',1,'class',1,'stats','SCOUT'],
 ['K03','ガーディアン初勝利','GUARDIANで通常ミッションをクリア',2,'class',1,'stats','GUARDIAN'],
 ['K04','ウイング初勝利','WINGで通常ミッションをクリア',2,'class',1,'stats','WING'],
 ['K05','四兵科の指揮官','4兵科すべてで通常ミッションをクリア',3,'classes',4,'stats',null,'四兵科の指揮官'],
 ['W01','武器収集家','武器を5種類以上取得',1,'collection',5,'save'],
 ['W02','武器コレクター','武器を10種類以上取得',2,'collection',10,'save'],
 ['W03','武器マスター','0.8.0の固定対象20武器を取得',4,'collection',20,'save',null,'武器マスター'],
 ['W04','多彩な火力','異なる5武器を通常プレイで実際に使用',2,'weaponsUsed',5,'stats'],
 ['W05','十種の使い手','異なる10武器を通常プレイで実際に使用',3,'weaponsUsed',10,'stats'],
 ['W06','全武装運用','固定対象20武器を通常プレイで実際に使用',5,'weaponsUsed',20,'stats'],
 ['B01','最初の一撃','通常プレイで敵を1体撃破',1,'firstKill',1,'stats'],
 ['B02','小隊掃討','1回の正式出撃で敵を30体撃破',1,'runKills',30,'new'],
 ['B03','大群撃破','1回の正式出撃で敵を100体撃破',3,'runKills',100,'new'],
 ['B04','連続撃破','撃破間隔5秒以内で10体の連続撃破',3,'streak',10,'new'],
 ['B05','戦場の掃討者','0.8.0以降の通常プレイで累計1000体撃破',4,'kills',1000,'new'],
 ['S01','初期装備の達人','A-01/S-02だけを実際に使用してM01を通常クリア',2,'special',1,'new','M01'],
 ['S02','初期武器の挑戦者','A-01/S-02だけを使用してM03〜M06のいずれかを通常クリア',4,'special',1,'new'],
 ['S03','無傷の帰還','実際の被ダメージ0で任意ミッションを通常クリア',5,'special',1,'new',null,'無傷の帰還者'],
 ['S04','孤高の装備','1種類の武器だけを実際に使用してM02を通常クリア',3,'special',1,'new','M02'],
 ['S05','最前線の生還者','残HPが最大HPの25%以下で通常クリア',3,'special',1,'new'],
 ['T01','二つの選択','B-05の左先行・右先行の両順序でM05を通常クリア',3,'orders',2,'new','M05'],
 ['T02','神経遮断の達人','B-06の神経核を3回以上露出させてM06を通常クリア',3,'exposures',3,'new','M06','神経遮断の達人'],
 ['T03','再挑戦の達人','同じミッションの通常GAME OVER経験後に通常クリア',2,'special',1,'new']
];
export const ACHIEVEMENTS=Object.freeze(rows.map(([suffix,name,description,difficulty,method,target,past,scope=null,title=null],i)=>Object.freeze({id:'ACH-'+suffix,category:suffix[0],name,description,condition:description,target,method,past,scope,difficulty,badge:badge[suffix[0]],title,order:i+1,implemented:true,hiddenWhen:null})));
export const ACHIEVEMENT_BY_ID=new Map(ACHIEVEMENTS.map(a=>[a.id,a]));
