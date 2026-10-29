# Repository Guidelines

## Project Structure & Module Organization

This is a static, Indonesian-language learning game for elementary school children, built with HTML, CSS, and vanilla JavaScript. All application files live at the repository root:

- `index.html`: page structure, controls, modals, and script loading.
- `script.js`: game engine, question generation, UI, audio, and browser storage.
- `style.css`: design tokens, animations, and responsive layouts.
- `cerita_bank_soal.js`, `gambar_bank_soal.js`, and `kosakata_bank_soal.js`: question banks exposed through `window`.
- `favicon.svg`: site icon.

Keep question-bank scripts loaded before `script.js`.

## Build, Test, and Development Commands

No dependency installation or build step is required.

- `Start-Process .\index.html`: open the game locally from PowerShell.
- `node --check script.js`: check JavaScript syntax if Node.js is installed. Repeat for each modified question-bank file.
- `git diff --check`: check changes for whitespace errors before committing.

There are no configured package scripts, automated test framework, formatter, or linter.

## Coding Style & Naming Conventions

Use four-space indentation and follow the surrounding code. JavaScript uses semicolons, camelCase functions and variables, uppercase constants, and strict-mode closures. CSS classes and HTML IDs use kebab-case.

Reuse CSS custom properties for colors, spacing, and typography. Preserve semantic HTML, accessible controls, and Indonesian user-facing text. Keep question-bank entries consistent with their existing field structure and use unique IDs within each bank.

## Testing Guidelines

Validate changes manually in a browser at mobile and desktop widths. Exercise affected game modes, question counts, correct and incorrect answers, keyboard and touch input, filters, progress, and restart behavior. For persistence changes, refresh the page and verify session restoration and star records. For audio changes, check mute and spoken questions.

Confirm question answers and distractors are valid. Check the browser console for application errors. No automated coverage threshold is configured.

## Commit & Pull Request Guidelines

Prefer the existing commit prefixes: `feat:`, `fix:`, `refactor:`, and `style:`. Keep messages concise and describe the behavior changed.

Pull requests should explain the change and list validation performed. Link relevant issues when available and include mobile and desktop screenshots for visual changes.

## Validation

Confirm the finished file contains 200–400 words, uses Markdown headings, and documents only commands and conventions supported by the repository. Review the diff to ensure only `AGENTS.md` was added.
