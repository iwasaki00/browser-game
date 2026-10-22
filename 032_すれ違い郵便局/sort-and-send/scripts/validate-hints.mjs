import { createServer } from 'vite';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const server = await createServer({ root, configFile: false, appType: 'custom', server: { middlewareMode: true } });
try {
  const { stages } = await server.ssrLoadModule('/src/stage.ts');
  const { stageHints } = await server.ssrLoadModule('/src/hints.ts');
  const { validateHints } = await server.ssrLoadModule('/src/hint-validation.ts');
  const reports = JSON.parse(await readFile(new URL('../reports/stage-validation.json', import.meta.url), 'utf8'));
  const errors = validateHints(stages, stageHints, reports);
  if (stages.length !== 20 || stageHints.length !== 20) errors.push('20ステージ・60件が必要です。');
  if (errors.length) throw new Error(errors.join('\n'));
  console.log('20ステージ / 60件 VALID：ID・識別子・重複・参照・経路・成功解との部分方向指定を検証しました。');
  console.log('自然言語・段階性・完全解答非公開のレビューは reports/hint-review.md を参照してください。');
} catch (error) { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }
finally { await server.close(); }
