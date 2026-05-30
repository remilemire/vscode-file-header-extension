import { defineConfig } from '@vscode/test-cli';

export default defineConfig({
	files: 'out/test/**/*.test.js',
	// Run the tests against a known folder so workspace-relative paths are stable.
	workspaceFolder: '.testworkspace',
});
