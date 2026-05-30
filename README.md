# File Header

Automatically inserts a header comment at the top of newly created files.

When you create a new file whose extension is recognized, the extension adds a
comment containing the file's workspace-relative path (and, optionally, the
creation date, author, and a description placeholder).

```ts
// src/components/Button.tsx
// Created: 2026-05-29
// Author: Remi Lemire
// Description:
```

```python
# backend/app/schemas.py
# Created: 2026-05-29
# Author: Remi Lemire
# Description:
```

Block-comment languages are wrapped appropriately:

```css
/*
src/styles/main.css
Created: 2026-05-29
*/
```

## Build & install from source

Requires [Node.js](https://nodejs.org) and VS Code.

```bash
npm ci
npx @vscode/vsce package
"/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code" --install-extension vscode-file-header-extension-0.0.1.vsix
```

Reload VS Code and the extension is active in every project. If the
`code` command isn't found, run **"Shell Command: Install 'code' command in
PATH"** from the Command Palette first.

## How it works

- Fires on file creation (`workspace.onDidCreateFiles`) — explorer "New File",
  Save As, etc. It only writes to **empty** files, so copied or templated files
  are left alone.
- The comment delimiter is chosen by **file extension**. Extensions not covered
  are skipped.
- There's also an **Insert File Header** command (Command Palette) to add the
  header to an existing file.

## Settings

| Setting | Default | Description |
| --- | --- | --- |
| `fileHeader.enable` | `true` | Turn automatic insertion on/off. |
| `fileHeader.fields` | `["path", "date", "author", "description"]` | Which lines to include, in order. |
| `fileHeader.author` | `""` | Author name. Empty → `git config user.name`, falling back to your OS username. |
| `fileHeader.commentStyles` | `{}` | Extra/overriding extension → comment styles, merged over the built-ins. |

### Adding a comment style

`commentStyles` merges over the built-in defaults, so you only specify
additions or overrides. A string is a line comment; a `[start, end]` array is a
block comment:

```json
"fileHeader.commentStyles": {
  "zig": "//",
  "vim": "\"",
  "html": ["<!--", "-->"]
}
```
