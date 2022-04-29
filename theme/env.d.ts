import type { ClipboardJS as Clipboard } from "clipboard";
import type { HLJSApi } from "highlight.js";

declare global {
  declare var hljs: HLJSApi;
  declare var ace: Ace;
  declare var playground_copyable: unknown;
  declare var default_theme: string;
  declare var playground_text: (playground: HTMLElement) => string;
  declare var editors: AceEditor[] | undefined;
  declare var ClipboardJS: Clipboard;
  declare var search: Searcher;
}

interface Searcher {
  hasFocus(): boolean;
}

interface Ace {
  edit(element: HTMLElement): AceEditor;
}

interface AceEditor {
  readonly commands: AceCommands;
  readonly originalCode: string;

  setTheme(theme: string): void;
  getValue(): string;
  setValue(code: string): void;
  clearSelection(): void;
  addEventListener(event: "change", callback: () => void): void;
}

interface AceCommands {
  addCommand(command: AceCommand): void;
}

interface AceCommand {
  name: string;
  bindKey: {
    win: string;
    mac: string;
  };
  exec: (editor: AceEditor) => void;
}

declare const ClipboardJS: import("@types/clipboard").ClipboardJS;
