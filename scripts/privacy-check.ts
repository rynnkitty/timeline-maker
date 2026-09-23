/**
 * H-2 커밋 전 개인정보 검사 (CLAUDE.md §5 H-2 · v1.2).
 *
 *   node scripts/privacy-check.ts            staged 파일 검사 (pre-commit 훅이 호출)
 *   node scripts/privacy-check.ts --all      추적 중인 전체 파일 검사 (push 전 점검)
 *
 * 1) 금지 경로: ref/ · docs/reference/ · Timeline*.json · Records.json · .claude/settings.local.json
 *    (tests/fixtures/ 의 합성 픽스처는 예외)
 * 2) 숫자 좌표 패턴: `\d{1,3}\.\d{4,}°` · `geo:-?\d+\.\d{4,}` — tests/fixtures/ · scripts/make-fixtures.ts 예외
 *
 * 걸린 값 자체는 출력하지 않는다 (파일:줄 · 패턴 이름만). 외부 의존성 없음 (Node ≥ 22.18).
 */
import { execFileSync } from 'node:child_process';

const all = process.argv.includes('--all');

const FORBIDDEN_PATHS: [RegExp, string][] = [
  [/^ref\//, 'ref/ (레퍼런스 · 실존 궤적)'],
  [/^docs\/reference\//, 'docs/reference/ (기준 프레임 · 실파일 집계)'],
  [/(^|\/)[Tt]imeline[^/]*\.json$/, 'Timeline*.json (실파일 추정)'],
  [/(^|\/)Records\.json$/, 'Records.json (구 Takeout)'],
  [/^\.claude\/settings\.local\.json$/, '.claude/settings.local.json'],
];
const PATH_EXEMPT = /^tests\/fixtures\//;

const PATTERNS: [RegExp, string][] = [
  [/\d{1,3}\.\d{4,}°/, 'deg-coordinate'],
  [/geo:-?\d+\.\d{4,}/, 'geo-uri-coordinate'],
];
const CONTENT_EXEMPT = /^(tests\/fixtures\/|scripts\/make-fixtures\.ts$)/;
const BINARY_EXT = /\.(png|jpe?g|gif|webp|mp4|webm|woff2?|ico|pdf|zip)$/i;

const git = (args: string[]) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });

const files = (all ? git(['ls-files', '-z']) : git(['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z']))
  .split('\0')
  .filter(Boolean);

const problems: string[] = [];
for (const f of files) {
  for (const [re, why] of FORBIDDEN_PATHS) {
    if (re.test(f) && !PATH_EXEMPT.test(f)) problems.push(`${f}: 금지 경로 — ${why}`);
  }
  if (CONTENT_EXEMPT.test(f) || BINARY_EXT.test(f)) continue;
  // staged 모드는 인덱스에 올라간 내용 그대로 검사
  let text: string;
  try {
    text = git(['show', `${all ? 'HEAD' : ''}:${f}`]);
  } catch {
    continue; // --all 에서 HEAD 에 아직 없는 파일
  }
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    for (const [re, name] of PATTERNS) if (re.test(lines[i])) problems.push(`${f}:${i + 1}: 숫자 좌표 패턴 (${name})`);
  }
}

if (problems.length) {
  console.error(`privacy-check: FAIL — ${problems.length}건 (H-2). 값은 출력하지 않음.`);
  for (const p of problems) console.error('  ' + p);
  process.exit(1);
}
console.log(`privacy-check: OK — ${files.length}개 파일 검사 (${all ? 'tracked' : 'staged'})`);
