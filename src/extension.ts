import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';
import { execFile } from 'child_process';

// A comment style is either a single line-comment prefix (e.g. "//", "#")
// or a [start, end] pair for block comments (e.g. ["/*", "*/"]).
type CommentStyle = string | [string, string];

// Built-in extension -> comment style map. Anything the user adds via the
// `fileHeader.commentStyles` setting is merged on top of these.
const DEFAULT_COMMENT_STYLES: Record<string, CommentStyle> = {
	js: '//', jsx: '//', ts: '//', tsx: '//', mjs: '//', cjs: '//',
	c: '//', h: '//', cpp: '//', hpp: '//', cc: '//', cs: '//',
	java: '//', go: '//', rs: '//', swift: '//', kt: '//', kts: '//',
	scala: '//', php: '//', dart: '//',
	py: '#', rb: '#', sh: '#', bash: '#', zsh: '#',
	yaml: '#', yml: '#', toml: '#', r: '#', pl: '#', ps1: '#',
	lua: '--', sql: '--',
	css: ['/*', '*/'], scss: ['/*', '*/'], less: ['/*', '*/'],
	html: ['<!--', '-->'], xml: ['<!--', '-->'],
	vue: ['<!--', '-->'], svelte: ['<!--', '-->'], md: ['<!--', '-->'],
};

// User overrides/additions merged over the built-in defaults.
function getCommentStyles(): Record<string, CommentStyle> {
	const user = vscode.workspace
		.getConfiguration('fileHeader')
		.get<Record<string, CommentStyle>>('commentStyles', {});
	return { ...DEFAULT_COMMENT_STYLES, ...user };
}

// Look up the comment style for a file's extension, if one is configured.
function getStyleForUri(uri: vscode.Uri): CommentStyle | undefined {
	const base = uri.path.split('/').pop() ?? '';
	const dot = base.lastIndexOf('.');
	// dot > 0 skips dotfiles like ".gitignore" (no real extension).
	const ext = dot > 0 ? base.slice(dot + 1).toLowerCase() : '';
	if (!ext) {
		return undefined;
	}
	return getCommentStyles()[ext];
}

// Which header lines to emit, in order.
function getFields(): string[] {
	return vscode.workspace
		.getConfiguration('fileHeader')
		.get<string[]>('fields', ['path', 'date', 'author', 'description']);
}

// Local date as YYYY-MM-DD.
function todayISO(): string {
	const d = new Date();
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// `git config user.name` for the file's workspace folder, or '' if unavailable.
function getGitUserName(uri: vscode.Uri): Promise<string> {
	const cwd =
		vscode.workspace.getWorkspaceFolder(uri)?.uri.fsPath ??
		path.dirname(uri.fsPath);
	return new Promise((resolve) => {
		execFile('git', ['config', 'user.name'], { cwd }, (err, stdout) => {
			resolve(err ? '' : stdout.trim());
		});
	});
}

// Resolve the author: explicit setting first, then git, then OS username.
async function resolveAuthor(uri: vscode.Uri): Promise<string> {
	const configured = vscode.workspace
		.getConfiguration('fileHeader')
		.get<string>('author', '')
		.trim();
	if (configured) {
		return configured;
	}
	const gitName = await getGitUserName(uri);
	if (gitName) {
		return gitName;
	}
	try {
		return os.userInfo().username;
	} catch {
		return '';
	}
}

// Build the raw (un-commented) header lines for a file.
async function buildHeaderLines(uri: vscode.Uri): Promise<string[]> {
	const lines: string[] = [];
	for (const field of getFields()) {
		switch (field) {
			case 'path':
				lines.push(vscode.workspace.asRelativePath(uri, false));
				break;
			case 'date':
				lines.push(`Created: ${todayISO()}`);
				break;
			case 'author':
				lines.push(`Author: ${await resolveAuthor(uri)}`);
				break;
			case 'description':
				lines.push('Description: ');
				break;
		}
	}
	return lines;
}

// Wrap header lines in the appropriate comment syntax.
function wrapComment(lines: string[], style: CommentStyle): string {
	if (Array.isArray(style)) {
		const [start, end] = style;
		if (lines.length === 1) {
			return `${start} ${lines[0]} ${end}`;
		}
		return [start, ...lines, end].join('\n');
	}
	return lines.map((line) => `${style} ${line}`).join('\n');
}

// Compose the full header text (no trailing newline) for a file.
async function buildHeader(uri: vscode.Uri, style: CommentStyle): Promise<string> {
	const lines = await buildHeaderLines(uri);
	return wrapComment(lines, style);
}

// Insert a header into a freshly created file, but only when it makes sense:
// the extension is configured and the file is still empty.
async function addHeaderToNewFile(uri: vscode.Uri): Promise<void> {
	const style = getStyleForUri(uri);
	if (!style) {
		return;
	}

	let stat: vscode.FileStat;
	try {
		stat = await vscode.workspace.fs.stat(uri);
	} catch {
		return; // file vanished or isn't accessible
	}
	// Only touch regular, empty files — don't clobber copied/templated content.
	if (stat.type !== vscode.FileType.File || stat.size > 0) {
		return;
	}

	const header = await buildHeader(uri, style);
	const edit = new vscode.WorkspaceEdit();
	edit.insert(uri, new vscode.Position(0, 0), header + '\n');
	await vscode.workspace.applyEdit(edit);
}

// Manual command: insert the header at the top of the active editor's file.
async function insertHeaderCommand(): Promise<void> {
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		vscode.window.showInformationMessage('File Header: no active editor.');
		return;
	}

	const uri = editor.document.uri;
	const style = getStyleForUri(uri);
	if (!style) {
		vscode.window.showInformationMessage(
			'File Header: no comment style configured for this file type.'
		);
		return;
	}

	const header = await buildHeader(uri, style);
	await editor.edit((builder) => {
		builder.insert(new vscode.Position(0, 0), header + '\n');
	});
}

export function activate(context: vscode.ExtensionContext) {
	const onCreate = vscode.workspace.onDidCreateFiles(async (event) => {
		const config = vscode.workspace.getConfiguration('fileHeader');
		if (!config.get<boolean>('enable', true)) {
			return;
		}
		for (const uri of event.files) {
			await addHeaderToNewFile(uri);
		}
	});

	const command = vscode.commands.registerCommand(
		'fileHeader.insertHeader',
		insertHeaderCommand
	);

	context.subscriptions.push(onCreate, command);
}

export function deactivate() {}
