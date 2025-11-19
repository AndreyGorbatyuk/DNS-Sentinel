/**
 * @file tests/vitest-stubs.d.ts
 * Type stubs for Vitest in documentation stage
 * Remove when moving to real project with installed dependencies
 */

declare module 'vitest' {
	export const describe: any;
	export const it: any;
	export const expect: any;
	export const beforeEach: any;
	export const afterEach: any;
	export const vi: {
		fn: (impl?: any) => any;
		mocked: (item: any) => any;
		mock: (path: string, factory?: () => any) => void;
	};
}