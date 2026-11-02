import {writeFileSync} from 'node:fs';
import {lineBenchmark,summarizeLines,lineModelTimes} from '../src/dev-line-model';
const rows=[];for(let seed=6000;seed<6100;seed++){for(const field of ['B','R','G'] as const)for(const mode of ['A','B','C','D'] as const)rows.push(lineBenchmark(seed,field,mode));if(seed%10===9)console.log('seeds',seed-5999);}
const result={version:'0.6.0',seeds:100,trials:rows.length,assumptions:{horizonSeconds:900,initialFN:100000,lineModelTimes,time:'モデル操作時間。人間のプレイ時間ではない',policy:'継続採取、公開された位置・在庫だけを利用。精密回収・洗浄は手動。J報酬なし',investment:'初期資金から実価格で購入。回収時間は測定追加FN/分が続く仮定の外挿'},summary:summarizeLines(rows),rows};writeFileSync('docs/line-results-v060.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result.summary,null,2));
