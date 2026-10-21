import { createServer } from 'vite';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const server = await createServer({ root, configFile: false, appType: 'custom', server: { middlewareMode: true } });
try {
  const { stages } = await server.ssrLoadModule('/src/stage.ts');
  const { solveStage } = await server.ssrLoadModule('/src/solver.ts');
  const reports = [];
  if (new Set(stages.map(s => s.id)).size !== stages.length) throw new Error('ステージIDが重複しています。');
  for (const stage of stages) reports.push(await solveStage(stage));
  const expected = [
    ['01', '4', 2, { a: ['L', 'R'] }], ['02', '8', 2, { a: ['L', 'L', 'R'] }],
    ['03', '8', 2, { a: ['L', 'R', 'R'] }], ['04', '16', 2, { a: ['L', 'R', 'R', 'L'] }],
    ['05', '32', 4, { a: ['L', 'R', 'R'], b: ['L', 'R'] }],
  ];
  const chapterTwoExpected = [
    ['06', '64', 3, 1, 2, 4, { 2: 1, 4: 2 }],
    ['07', '128', 2, 2, 4, 4, { 4: 2 }],
    ['08', '128', 8, 5, 2, 6, { 2: 5, 4: 2, 6: 1 }],
    ['09', '256', 2, 1, 4, 6, { 4: 1, 6: 1 }],
    ['10', '512', 7, 2, 4, 8, { 4: 2, 6: 4, 8: 1 }],
  ];
  const chapterThreeExpected = [
    ['11', '512', 6, 1, 4, 8], ['12', '1024', 7, 4, 4, 8],
    ['13', '1024', 7, 1, 4, 8], ['14', '2048', 6, 2, 4, 8], ['15', '4096', 7, 1, 6, 10],
  ];
  const chapterFourExpected = [
    ['16', '256', 3, 2, 4, 6, { 4: 2, 6: 1 }],
    ['17', '1024', 3, 1, 4, 6, { 4: 1, 6: 2 }],
    ['18', '1024', 4, 1, 6, 8, { 6: 1, 8: 3 }],
    ['19', '8192', 2, 1, 6, 8, { 6: 1, 8: 1 }],
    ['20', '8192', 2, 1, 6, 8, { 6: 1, 8: 1 }],
  ];
  if (reports.length !== 20) throw new Error('Stage 01〜20の20ステージが必要です。');
  for (const report of reports) {
    const spec = expected.find(e => e[0] === report.stageId);
    const chapterTwo = [...chapterTwoExpected, ...chapterThreeExpected, ...chapterFourExpected].find(e => e[0] === report.stageId);
    const matches = chapterTwo
      ? report.status === 'VALID' && report.totalConfigurations === chapterTwo[1] &&
        String(report.checkedConfigurations) === chapterTwo[1] && report.solutionCount === chapterTwo[2] &&
        report.optimalSolutionCount === chapterTwo[3] && report.minCost === chapterTwo[4] &&
        report.maxCost === chapterTwo[5] && (!chapterTwo[6] || JSON.stringify(report.costDistribution) === JSON.stringify(chapterTwo[6]))
      : !!spec && !(report.status !== 'VALID' || report.totalConfigurations !== spec[1] ||
        String(report.checkedConfigurations) !== spec[1] || report.solutionCount !== 1 ||
        report.minCost !== spec[2] || report.maxCost !== spec[2] || report.optimalSolutionCount !== 1 ||
        JSON.stringify(report.solutions[0]?.patterns) !== JSON.stringify(spec[3]));
    if (!matches) {
      report.validationErrors.push('設計上の探索期待値と一致しません。配送ルール・ステージ・探索を確認してください。');
    }
  }
  const prefixReports = [];
  const stage18 = stages.find(s => s.id === '18');
  for (const [length, count] of [[7, 19], [8, 19], [9, 4], [11, 4]]) {
    const r = await solveStage({ ...stage18, parcels: stage18.parcels.slice(0, length) });
    if (r.status !== 'VALID' || r.checkedConfigurations !== 1024 || r.solutionCount !== count) throw new Error(`Stage 18 先頭${length}個の期待値が不一致です。`);
    prefixReports.push({ parcels: length, status: r.status, checked: r.checkedConfigurations, solutions: r.solutionCount });
  }
  console.table(prefixReports);
  const summaries = reports.map(({ solutions, validationErrors, ...summary }) => summary);
  const files = [
    [new URL('../reports/stage-validation.json', import.meta.url), reports],
    [new URL('../src/generated/stage-ratings.json', import.meta.url), summaries],
    [new URL('../reports/stage18-prefix-validation.json', import.meta.url), prefixReports],
  ];
  console.table(reports.map(r => ({ Stage: r.stageId, status: r.status, total: r.totalConfigurations,
    checked: r.checkedConfigurations, solutions: r.solutionCount, optimal: r.optimalSolutionCount,
    min: r.minCost, max: r.maxCost, distribution: JSON.stringify(r.costDistribution), errors: r.validationErrors.join(' / ') })));
  if (reports.some(r => r.validationErrors.length)) throw new Error('探索期待値に不一致があります。結果は書き換えていません。');
  if (process.argv.includes('--write')) {
    for (const [url, data] of files) {
      await mkdir(new URL('./', url), { recursive: true });
      await writeFile(url, JSON.stringify(data, null, 2) + '\n');
    }
    console.log('探索レポートとゲーム用評価データを生成しました。');
  } else {
    for (const [url, data] of files) {
      let saved;
      try { saved = JSON.parse(await readFile(url, 'utf8')); }
      catch { throw new Error('検証レポートがありません。npm run generate:stages を実行してください。'); }
      if (JSON.stringify(saved) !== JSON.stringify(data)) throw new Error('保存済みレポートと現在の全探索結果が不一致です。内容を確認し、npm run generate:stages で更新してください。');
    }
    console.log('保存済みレポート・現在のステージ・全探索結果が一致しました。');
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally { await server.close(); }
