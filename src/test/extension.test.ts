import * as assert from 'assert';
import * as fs from 'fs';
import * as vscode from 'vscode';

// Helper: create an empty file in the test workspace, open it, run the
// insert-header command against it, and return the resulting document.
async function insertHeaderInto(fileName: string): Promise<vscode.TextDocument> {
	const folder = vscode.workspace.workspaceFolders![0].uri;
	const fileUri = vscode.Uri.joinPath(folder, fileName);
	fs.writeFileSync(fileUri.fsPath, '');

	const doc = await vscode.workspace.openTextDocument(fileUri);
	await vscode.window.showTextDocument(doc);
	await vscode.commands.executeCommand('fileHeader.insertHeader');
	return doc;
}

suite('File Header', () => {
	suiteSetup(async () => {
		// Make sure the extension's command is registered before we call it.
		const ext = vscode.extensions.getExtension(
			'remilemire.vscode-file-header-extension'
		);
		await ext?.activate();
	});

	test('inserts a line-comment header into a .py file', async () => {
		const doc = await insertHeaderInto('sample.py');

		// `path` is the first configured field, so line 0 is the path comment.
		assert.strictEqual(doc.lineAt(0).text, '# sample.py');

		const text = doc.getText();
		assert.match(text, /^# Created: \d{4}-\d{2}-\d{2}$/m);
		assert.match(text, /^# Author: /m);
		assert.match(text, /^# Description: $/m);

		fs.unlinkSync(doc.uri.fsPath);
	});

	test('leaves files with an unknown extension untouched', async () => {
		const doc = await insertHeaderInto('sample.unknownext');

		assert.strictEqual(doc.getText(), '');

		fs.unlinkSync(doc.uri.fsPath);
	});
});
