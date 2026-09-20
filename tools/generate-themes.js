#!/usr/bin/env node
"use strict";
/*
 * Generate FULL-CHROME VS Code color themes from the QB64PE IDE's preset color
 * schemes (source/ide/ide_methods.bas: ColorSchemes$()).
 *
 * Each preset is "Name|<90 digits>" = 10 RGB colors in this fixed order:
 *   0 Text  1 Keyword  2 Numbers  3 String  4 Metacommand
 *   5 Comment  6 Background  7 Background2  8 BracketHighlight  9 Chroma
 *
 * Syntax colors come straight from the preset; the entire UI chrome (activity
 * bar, side bar, tabs, lists, inputs, peek views, diffs, gutter, minimap,
 * terminal, …) is DERIVED from those colors via mix()/alpha(), so every scheme
 * — light or dark — gets a coherent, fully-themed window.
 *
 * Usage: node tools/generate-themes.js   (writes themes/*.json, updates package.json)
 */
const fs = require("fs");
const path = require("path");

const PRESETS = [
  "Super Dark Blue|216216216069118147216098078255167000085206085098098098000000039000049078000088108170170170",
  "Dark Blue|226226226069147216245128177255177000085255085049196196000000069000068108000147177170170170",
  "QB64 Original|226226226147196235245128177255255085085255085085255255000000170000108177000147177170170170",
  "Classic QB4.5|177177177177177177177177177177177177177177177177177177000000170000000170000147177170170170",
  "Dark Side|255255255206206000245010098000177000085255085049186245011022029100100100000147177170170170",
  "Camouflage|196196196255255255245128177255177000137177147147137020000039029098069020000147177170170170",
  "Plum|186186186255255255245128177255108000085186078085186255059000059088088128000147177170170170",
  "Cornfield|255255180065130255255130065065255130255130255190160130100080060110090070170000000200200130",
  "CF Dark|226226226115222227255043138255178034185237049157118137043045037010000020088088088170170170",
  "Broadcast|228224220034085170221068051238238068221136000051153034024024024036036036034136170170170170",
  "VS Code|212212212086156214212099162206145120070201176106153085031031031040040040034136170170170170",
  "X11 SgiColors|197193170113113198198113113142142056113198113085085085024024024036036036142056142170170170",
  "Light Green|051051051000000216245128177255157255147177093206206206234255234206255206000147177170170170",
  "All White|051051051000000216245128177206147000059177000206206206255255255245245245000147177170170170",
];

// Already shipped by hand (rich themes) — don't regenerate.
const SKIP = new Set(["Super Dark Blue"]);

// ---- color helpers -------------------------------------------------------
const clamp = (x) => Math.max(0, Math.min(255, Math.round(x)));
const hx = (n) => clamp(n).toString(16).padStart(2, "0");
const toHex = (r, g, b) => `#${hx(r)}${hx(g)}${hx(b)}`;
const rgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (a, b, t) => {
  const A = rgb(a), B = rgb(b);
  return toHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
};
const alpha = (h, aa) => `${h}${aa}`;
const luminance = ([r, g, b]) => 0.299 * r + 0.587 * g + 0.114 * b;
const slug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function parse(line) {
  const [name, data] = line.split("|");
  const hex = [];
  for (let k = 0; k < 10; k++) {
    const o = k * 9;
    hex.push(toHex(+data.slice(o, o + 3), +data.slice(o + 3, o + 6), +data.slice(o + 6, o + 9)));
  }
  return {
    name,
    text: hex[0], keyword: hex[1], numbers: hex[2], string: hex[3], metacommand: hex[4],
    comment: hex[5], bg: hex[6], bg2: hex[7], bracket: hex[8], chroma: hex[9],
    bgRGB: rgb(hex[6]),
  };
}

function buildTheme(p) {
  const light = luminance(p.bgRGB) > 140;
  const uiTheme = light ? "vs" : "vs-dark";
  const ctr = light ? "#000000" : "#ffffff"; // contrast direction for elevation
  const elev = (t) => mix(p.bg, ctr, t); // raised surfaces (panels, widgets, tabs)
  const sink = (t) => mix(p.bg, light ? "#ffffff" : "#000000", t); // darker/lighter recess

  const accent = p.string; // QB64 IDE accent = string color
  const teal = mix(p.bracket, "#ffffff", light ? 0.0 : 0.25); // brighter bracket = secondary accent
  const green = p.metacommand;
  const red = p.numbers;
  const onAccent = luminance(rgb(accent)) > 150 ? "#000000" : "#ffffff";
  const onKeyword = luminance(rgb(p.keyword)) > 150 ? "#000000" : "#ffffff";
  const border = mix(p.bg, ctr, 0.28);
  const border2 = mix(p.bg, ctr, 0.16);
  const fgMuted = mix(p.text, p.bg, 0.35);

  const colors = {
    focusBorder: p.keyword,
    foreground: p.text,
    "icon.foreground": p.text,
    "widget.shadow": alpha("#000000", "66"),
    errorForeground: red,
    descriptionForeground: fgMuted,

    // Editor
    "editor.background": p.bg,
    "editor.foreground": p.text,
    "editorLineNumber.foreground": mix(p.comment, p.bg, 0.1),
    "editorLineNumber.activeForeground": p.text,
    "editorCursor.foreground": p.text,
    "editor.lineHighlightBackground": p.bg2,
    "editor.lineHighlightBorder": alpha(p.bg, "00"),
    "editor.selectionBackground": alpha(teal, "66"),
    "editor.selectionHighlightBackground": alpha(teal, "33"),
    "editor.inactiveSelectionBackground": alpha(teal, "33"),
    "editor.wordHighlightBackground": alpha(p.keyword, "44"),
    "editor.wordHighlightStrongBackground": alpha(p.keyword, "66"),
    "editor.findMatchBackground": alpha(accent, "88"),
    "editor.findMatchHighlightBackground": alpha(accent, "44"),
    "editor.foldBackground": alpha(teal, "20"),
    "editorWhitespace.foreground": mix(p.comment, p.bg, 0.2),
    "editorIndentGuide.background1": alpha(mix(p.comment, p.bg, 0.2), "aa"),
    "editorIndentGuide.activeBackground1": p.keyword,
    "editorRuler.foreground": alpha(mix(p.comment, p.bg, 0.2), "88"),
    "editorBracketMatch.background": alpha(p.bracket, "66"),
    "editorBracketMatch.border": teal,
    "editorBracketHighlight.foreground1": accent,
    "editorBracketHighlight.foreground2": teal,
    "editorBracketHighlight.foreground3": green,
    "editorBracketHighlight.unexpectedBracket.foreground": red,
    "editorBracketPairGuide.background1": alpha(p.keyword, "77"),
    "editorBracketPairGuide.activeBackground1": p.keyword,
    "editorGutter.background": p.bg,
    "editorGutter.modifiedBackground": accent,
    "editorGutter.addedBackground": green,
    "editorGutter.deletedBackground": red,
    "editorGutter.foldingControlForeground": accent,
    "editorLink.activeForeground": teal,
    "editorError.foreground": red,
    "editorWarning.foreground": accent,
    "editorInfo.foreground": teal,

    // Elevated surfaces
    "editorWidget.background": elev(0.14),
    "editorWidget.border": border,
    "editorHoverWidget.background": elev(0.1),
    "editorHoverWidget.border": border,
    "editorSuggestWidget.background": elev(0.12),
    "editorSuggestWidget.border": border,
    "editorSuggestWidget.selectedBackground": alpha(p.keyword, "88"),
    "editorSuggestWidget.highlightForeground": accent,
    "editorStickyScroll.background": elev(0.06),
    "editorStickyScrollHover.background": p.bg2,
    "peekView.border": teal,
    "peekViewEditor.background": elev(0.07),
    "peekViewEditor.matchHighlightBackground": alpha(accent, "44"),
    "peekViewResult.background": elev(0.04),
    "peekViewResult.matchHighlightBackground": alpha(accent, "55"),
    "peekViewResult.selectionBackground": alpha(p.keyword, "66"),
    "peekViewTitle.background": elev(0.07),
    "peekViewTitlelabel.foreground": p.text,

    // Activity bar
    "activityBar.background": elev(0.06),
    "activityBar.foreground": p.text,
    "activityBar.inactiveForeground": fgMuted,
    "activityBar.border": border2,
    "activityBar.activeBorder": accent,
    "activityBar.activeBackground": alpha(accent, "22"),
    "activityBarBadge.background": accent,
    "activityBarBadge.foreground": onAccent,
    "badge.background": accent,
    "badge.foreground": onAccent,

    // Side bar
    "sideBar.background": elev(0.03),
    "sideBar.foreground": p.text,
    "sideBar.border": border2,
    "sideBarSectionHeader.background": elev(0.06),
    "sideBarSectionHeader.foreground": p.text,
    "sideBarTitle.foreground": p.text,

    // Lists & trees
    "list.activeSelectionBackground": p.keyword,
    "list.activeSelectionForeground": onKeyword,
    "list.inactiveSelectionBackground": alpha(p.keyword, "66"),
    "list.inactiveSelectionForeground": p.text,
    "list.hoverBackground": elev(0.09),
    "list.focusBackground": alpha(p.keyword, "88"),
    "list.highlightForeground": accent,
    "list.errorForeground": red,
    "list.warningForeground": accent,
    "tree.indentGuidesStroke": mix(p.comment, p.bg, 0.2),

    // Inputs / dropdowns / buttons
    "input.background": light ? "#ffffff" : sink(0.4),
    "input.foreground": p.text,
    "input.border": border,
    "input.placeholderForeground": fgMuted,
    "inputOption.activeBorder": p.keyword,
    "inputOption.activeBackground": alpha(p.keyword, "44"),
    "inputValidation.errorBackground": mix(red, p.bg, 0.3),
    "inputValidation.errorBorder": red,
    "inputValidation.warningBackground": mix(accent, p.bg, 0.3),
    "inputValidation.warningBorder": accent,
    "inputValidation.infoBackground": mix(teal, p.bg, 0.3),
    "inputValidation.infoBorder": teal,
    "dropdown.background": elev(0.1),
    "dropdown.foreground": p.text,
    "dropdown.border": border,
    "button.background": p.keyword,
    "button.foreground": onKeyword,
    "button.hoverBackground": mix(p.keyword, ctr, 0.15),
    "button.secondaryBackground": elev(0.16),
    "button.secondaryForeground": p.text,
    "checkbox.background": light ? "#ffffff" : sink(0.4),
    "checkbox.foreground": p.text,
    "checkbox.border": border,
    "progressBar.background": accent,
    "extensionButton.prominentBackground": green,
    "extensionButton.prominentForeground": "#ffffff",
    "extensionButton.prominentHoverBackground": mix(green, ctr, 0.15),

    // Tabs & editor groups
    "editorGroup.border": border2,
    "editorGroupHeader.tabsBackground": elev(0.06),
    "editorGroupHeader.tabsBorder": border2,
    "tab.activeBackground": p.bg,
    "tab.activeForeground": p.text,
    "tab.activeBorderTop": accent,
    "tab.inactiveBackground": elev(0.06),
    "tab.inactiveForeground": fgMuted,
    "tab.border": border2,
    "tab.hoverBackground": elev(0.1),

    // Panels
    "panel.background": elev(0.05),
    "panel.border": border,
    "panelTitle.activeBorder": accent,
    "panelTitle.activeForeground": p.text,
    "panelTitle.inactiveForeground": fgMuted,

    // Status bar
    "statusBar.background": elev(0.06),
    "statusBar.foreground": p.text,
    "statusBar.border": border2,
    "statusBar.noFolderBackground": elev(0.1),
    "statusBar.debuggingBackground": accent,
    "statusBar.debuggingForeground": onAccent,
    "statusBarItem.remoteBackground": p.keyword,
    "statusBarItem.remoteForeground": onKeyword,
    "statusBarItem.prominentBackground": alpha(p.keyword, "cc"),
    "statusBarItem.hoverBackground": alpha(ctr, "18"),

    // Title bar
    "titleBar.activeBackground": elev(0.07),
    "titleBar.activeForeground": p.text,
    "titleBar.inactiveBackground": elev(0.04),
    "titleBar.inactiveForeground": fgMuted,
    "titleBar.border": border2,

    // Breadcrumbs
    "breadcrumb.background": p.bg,
    "breadcrumb.foreground": fgMuted,
    "breadcrumb.focusForeground": p.text,
    "breadcrumb.activeSelectionForeground": accent,
    "breadcrumbPicker.background": elev(0.12),

    // Git / diff decorations
    "gitDecoration.modifiedResourceForeground": accent,
    "gitDecoration.deletedResourceForeground": red,
    "gitDecoration.untrackedResourceForeground": green,
    "gitDecoration.ignoredResourceForeground": fgMuted,
    "diffEditor.insertedTextBackground": alpha(green, "22"),
    "diffEditor.removedTextBackground": alpha(red, "22"),
    "diffEditor.insertedLineBackground": alpha(green, "18"),
    "diffEditor.removedLineBackground": alpha(red, "18"),

    // Minimap & scrollbar
    "minimap.selectionHighlight": alpha(accent, "a0"),
    "minimap.findMatchHighlight": alpha(accent, "a0"),
    "minimap.errorHighlight": red,
    "minimap.warningHighlight": accent,
    "minimapGutter.addedBackground": green,
    "minimapGutter.modifiedBackground": accent,
    "minimapGutter.deletedBackground": red,
    "scrollbar.shadow": alpha("#000000", "66"),
    "scrollbarSlider.background": alpha(p.chroma, "22"),
    "scrollbarSlider.hoverBackground": alpha(p.chroma, "44"),
    "scrollbarSlider.activeBackground": alpha(p.chroma, "66"),

    // Pickers & notifications
    "pickerGroup.border": border,
    "pickerGroup.foreground": accent,
    "quickInput.background": elev(0.1),
    "quickInputList.focusBackground": alpha(p.keyword, "88"),
    "notifications.background": elev(0.12),
    "notifications.border": border,
    "notificationsErrorIcon.foreground": red,
    "notificationsWarningIcon.foreground": accent,
    "notificationsInfoIcon.foreground": teal,

    // Terminal
    "terminal.background": p.bg,
    "terminal.foreground": p.text,
    "terminal.selectionBackground": alpha(teal, "66"),
    "terminalCursor.foreground": p.text,
    "terminal.ansiBlack": "#000000",
    "terminal.ansiBlue": "#0000aa",
    "terminal.ansiGreen": "#00aa00",
    "terminal.ansiCyan": "#00aaaa",
    "terminal.ansiRed": "#aa0000",
    "terminal.ansiMagenta": "#aa00aa",
    "terminal.ansiYellow": "#aa5500",
    "terminal.ansiWhite": "#aaaaaa",
    "terminal.ansiBrightBlack": "#555555",
    "terminal.ansiBrightBlue": "#5555ff",
    "terminal.ansiBrightGreen": "#55ff55",
    "terminal.ansiBrightCyan": "#55ffff",
    "terminal.ansiBrightRed": "#ff5555",
    "terminal.ansiBrightMagenta": "#ff55ff",
    "terminal.ansiBrightYellow": "#ffff55",
    "terminal.ansiBrightWhite": "#ffffff",
  };

  // Derived syntax accents for a lively-but-coherent look.
  const fn = mix(green, ctr, 0.08);
  const typ = mix(teal, "#ffffff", light ? 0 : 0.35);
  const param = mix(p.keyword, "#ffffff", light ? 0 : 0.3);

  const tok = (scope, foreground, fontStyle) => ({
    scope,
    settings: fontStyle !== undefined ? { foreground, fontStyle } : { foreground },
  });

  const tokenColors = [
    tok(["comment", "punctuation.definition.comment"], p.comment, "italic"),
    tok(["string", "string.quoted", "string.quoted.double", "markup.inline.raw", "markup.quote"], p.string),
    tok(["constant.numeric", "constant.language", "constant.character", "constant.other"], p.numbers),
    tok(["keyword", "keyword.control", "keyword.operator", "storage", "storage.type", "storage.modifier"], p.keyword),
    tok("entity.name.tag", p.keyword),
    tok("entity.other.attribute-name", param),
    // QB64PE grammar / semantic scopes.
    tok(["keyword.all.QB64PE", "keywords.all.QB64PE", "keyword.QB64PE", "keyword.control.QB64PE", "graphics.QB64PE", "sound.QB64PE"], p.keyword),
    tok(["metacommand.QB64PE", "debug.QB64PE"], p.metacommand),
    tok(["variable.other.QB64PE"], p.text),
    tok(["entity.name.function", "support.function", "meta.function-call", "userfunctions.QB64PE"], fn),
    tok(["entity.name.type", "entity.name.class", "support.type", "support.class"], typ),
    tok(["variable", "variable.other", "variable.other.readwrite", "entity.name.variable"], p.text),
    tok("variable.parameter", param, "italic"),
    tok("markup.heading", accent, "bold"),
    tok("markup.bold", p.text, "bold"),
    tok("markup.italic", p.text, "italic"),
    tok("markup.inserted", green),
    tok("markup.deleted", red),
    tok("markup.changed", accent),
    tok("invalid", red),
  ];

  return { name: `QB64PE Theme - ${p.name}`, $schema: "vscode://schemas/color-theme", uiTheme, colors, tokenColors };
}

// ---- generate ------------------------------------------------------------
const root = path.resolve(__dirname, "..");
const themesDir = path.join(root, "themes");
const pkgPath = path.join(root, "package.json");
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
pkg.contributes = pkg.contributes || {};
const themes = pkg.contributes.themes || [];
const byPath = new Map(themes.map((t) => [t.path, t]));

let added = 0;
for (const line of PRESETS) {
  const p = parse(line);
  if (SKIP.has(p.name)) continue;
  const theme = buildTheme(p);
  const file = `QB64PE Theme-color-theme-${slug(p.name)}.json`;
  fs.writeFileSync(path.join(themesDir, file), JSON.stringify(theme, null, "\t") + "\n");
  const entry = { label: theme.name, uiTheme: theme.uiTheme, path: `./themes/${file}` };
  if (byPath.has(entry.path)) Object.assign(byPath.get(entry.path), entry);
  else { themes.push(entry); byPath.set(entry.path, entry); }
  added++;
  console.log(`  ${theme.uiTheme === "vs" ? "☀" : "☾"}  ${theme.name}  (${Object.keys(theme.colors).length} chrome keys)`);
}

pkg.contributes.themes = themes;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
console.log(`\nGenerated ${added} full-chrome themes; package.json lists ${themes.length}.`);
