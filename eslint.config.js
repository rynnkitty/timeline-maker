import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/', 'node_modules/', 'spikes/**/out/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // H-6 렌더 결정론: 엔진은 벽시계·난수에 의존하지 않는다 (에이전트 §5 결정론 계약)
    files: ['src/engine/**/*.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        { selector: "MemberExpression[object.name='Date'][property.name='now']", message: 'engine: Date.now 금지 (H-6)' },
        { selector: "MemberExpression[object.name='Math'][property.name='random']", message: 'engine: Math.random 금지 (H-6)' },
        { selector: "MemberExpression[object.name='performance'][property.name='now']", message: 'engine: performance.now 금지 (H-6)' },
        { selector: "NewExpression[callee.name='Date'][arguments.length=0]", message: 'engine: new Date() 금지 (H-6)' },
      ],
    },
  },
);
