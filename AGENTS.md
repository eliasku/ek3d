Build it for a Canvas-based game. Completely ignore a11y, ARIA, tabindex, and SEO.
Use minimal, plain HTML layout (just an absolute-positioned canvas, a wrapper div, and no semantic tags).
Do NOT use accessibility CSS queries like prefers-reduced-motion or color-contrast.
Use ONLY builtin browser tool to use browser. Don't do smoke and regression if related files are not changed, test and verify only what was changed.
During porting, verify browser scenarios only in the standard available browser through the `browser` tool to keep porting fast. Do not launch additional engines or separate Playwright browsers per slice. Check the complete remaining browser matrix before releasing the whole package version. Keep type, behavioral and package checks.
Write all public repository content (documentation, commits, PRs, issues, and code comments) exclusively in English, keeping it strictly concise, clear for non-native speakers, and professionally structured

## TypeScript source conventions

Apply these rules to project-owned TypeScript, including directly maintained `src/`; leave the upstream `upstream/three.js/` checkout unchanged.

1. Put all imports, including `import type`, before interfaces and other declarations. Preserve runtime import order and attached comments.
2. Export declarations directly: `export class`, `export interface`, `export type`, `export function`, `export const`, `export const enum`, etc. Never use separate `export { ... }` lists or re-export modules. Preserve public names and canonical import paths.
3. Give every class field, including static fields, an explicit TypeScript type; never use the `declare` modifier or class/interface declaration merging. Preserve initialization order, inherited state, prototype methods and accessors. Do not mechanically remove `declare`, replace it with `!`, change `useDefineForClassFields`, or add fake/no-op implementations to satisfy types. Use real initialized fields, meaningful generics or actual accessor implementations where needed; do not redeclare inherited members unnecessarily.
4. Keep types in TypeScript, not duplicated in JSDoc. When a type is implicit, first try to express the documented type in the code and check it. Remove redundant `{type}` annotations from `@param`, `@return`/`@returns`, and redundant `@type` tags; retain parameter names, descriptions, defaults, and meaningful documentation. Do not discard type information that has not been represented in TypeScript or replace it with `any`.
5. Keep useful JSDoc examples current with this package's API and canonical imports. Convert JavaScript examples to valid TypeScript and use the `typescript` fence instead of `js` or `javascript`; changing the fence alone is not sufficient when the example needs code changes.

`src/` is the maintained implementation, not generated output. Apply changes directly there, using diffs against the pinned upstream commit to evaluate updates. There is no repeat-conversion workflow or ownership lock. Keep upstream read-only for provenance and differential tests. Keep formatting, type, behavior, package-graph and standard-browser checks; a formatter alone cannot validate field semantics or example correctness.
