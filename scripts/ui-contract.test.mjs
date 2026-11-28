// UI 契約（ナビゲーション・共通シェル非汚染）および tokens.css の WCAG コントラスト比を検証する自動ガードテスト。
// TS/JS の解析には導入済み vite の公開 API（parseSync / Visitor）を用いる。
// typescript@7 は Go 移植版で JS Compiler API を持たず、postcss / lightningcss は推移的依存（ファントム依存）のため直接 import しない。

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { parseSync, Visitor } from 'vite';
import { ALL_LINKS, COMPONENT_GROUPS, MAIN_LINKS } from '../src/nav.ts';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// ============================================================================
// 区画 1: 対象定義（定数）
// ============================================================================

const SHELL_FILES = [
  'src/layout.ts',
  'src/theme.ts',
  'src/auth.ts',
  'index.html',
];

const EXPECTED_MAIN_LINKS = [
  { label: 'Home', href: '/' },
  { label: 'Todos', href: '/todos' },
  { label: 'Billing', href: '/settings/billing' },
  { label: 'Slow page', href: '/slow' },
  { label: 'Ambiguous page', href: '/ambiguous' },
];

const EXPECTED_SHELL_LINKS = ['Todo App', 'GitHub repository', 'Sign in'];

const FORBIDDEN_ROLES = new Set(['status', 'region', 'dialog']);
const FORBIDDEN_IMPLICIT_TAGS = new Set(['output', 'dialog']);
const VOID_HTML_TAGS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
]);
const SVG_SELF_CLOSING_TAGS = new Set([
  'svg', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon',
  'g', 'use', 'defs', 'symbol', 'stop', 'clippath', 'mask', 'pattern',
  'lineargradient', 'radialgradient', 'image',
]);

const WCAG_AA_TEXT = 4.5;
const WCAG_NON_TEXT = 3.0;

// 実 CSS で使用される前景/背景ペアおよび tokens.css で予約された意味色トークンのコントラスト契約。
const CONTRAST_PAIRS = [
  // 本文・補助文字・反転ツールチップ（WCAG AA >= 4.5:1）
  { fg: '--fg', bg: '--surface-page', minRatio: WCAG_AA_TEXT },
  { fg: '--fg', bg: '--surface', minRatio: WCAG_AA_TEXT },
  { fg: '--fg', bg: '--surface-sunken', minRatio: WCAG_AA_TEXT },
  { fg: '--fg', bg: '--surface-raised', minRatio: WCAG_AA_TEXT },
  { fg: '--fg-muted', bg: '--surface-page', minRatio: WCAG_AA_TEXT },
  { fg: '--fg-muted', bg: '--surface', minRatio: WCAG_AA_TEXT },
  { fg: '--fg-muted', bg: '--surface-sunken', minRatio: WCAG_AA_TEXT },
  { fg: '--fg-muted', bg: '--surface-raised', minRatio: WCAG_AA_TEXT },
  { fg: '--surface', bg: '--fg', minRatio: WCAG_AA_TEXT },

  // ボタン・バッジ・リンク・アクセント（WCAG AA >= 4.5:1）
  { fg: '--accent-fg', bg: '--accent', minRatio: WCAG_AA_TEXT },
  { fg: '--accent-fg', bg: '--accent-hover', minRatio: WCAG_AA_TEXT },
  { fg: '--accent-ink', bg: '--accent-soft', minRatio: WCAG_AA_TEXT },
  { fg: '--accent-ink', bg: '--surface', minRatio: WCAG_AA_TEXT },
  { fg: '--accent-ink', bg: '--surface-page', minRatio: WCAG_AA_TEXT },
  { fg: '--accent', bg: '--surface-page', minRatio: WCAG_AA_TEXT },
  { fg: '--accent', bg: '--surface', minRatio: WCAG_AA_TEXT },
  { fg: '--accent', bg: '--surface-sunken', minRatio: WCAG_AA_TEXT },
  { fg: '--accent', bg: '--surface-raised', minRatio: WCAG_AA_TEXT },
  { fg: '--accent-hover', bg: '--surface-page', minRatio: WCAG_AA_TEXT },
  { fg: '--accent-hover', bg: '--surface', minRatio: WCAG_AA_TEXT },
  { fg: '--accent-hover', bg: '--surface-sunken', minRatio: WCAG_AA_TEXT },
  { fg: '--accent-hover', bg: '--surface-raised', minRatio: WCAG_AA_TEXT },

  // 意味色（実使用＋予約意味色トークン、WCAG AA >= 4.5:1）
  { fg: '--danger-fg', bg: '--danger', minRatio: WCAG_AA_TEXT },
  { fg: '--danger-fg', bg: '--danger-hover', minRatio: WCAG_AA_TEXT },
  { fg: '--danger', bg: '--surface-page', minRatio: WCAG_AA_TEXT },
  { fg: '--danger', bg: '--surface', minRatio: WCAG_AA_TEXT },
  { fg: '--danger', bg: '--surface-sunken', minRatio: WCAG_AA_TEXT },
  { fg: '--danger', bg: '--surface-raised', minRatio: WCAG_AA_TEXT },
  { fg: '--danger', bg: '--danger-soft', minRatio: WCAG_AA_TEXT },
  { fg: '--success', bg: '--surface', minRatio: WCAG_AA_TEXT },
  { fg: '--success', bg: '--surface-raised', minRatio: WCAG_AA_TEXT },
  { fg: '--success', bg: '--success-soft', minRatio: WCAG_AA_TEXT },
  { fg: '--info', bg: '--surface', minRatio: WCAG_AA_TEXT },
  { fg: '--info', bg: '--surface-raised', minRatio: WCAG_AA_TEXT },
  { fg: '--info', bg: '--info-soft', minRatio: WCAG_AA_TEXT },
  { fg: '--warning', bg: '--surface', minRatio: WCAG_AA_TEXT },
  { fg: '--warning', bg: '--surface-raised', minRatio: WCAG_AA_TEXT },
  { fg: '--warning', bg: '--warning-soft', minRatio: WCAG_AA_TEXT },

  // UI コンポーネント境界・スイッチ・チャート（WCAG 1.4.11 >= 3.0:1）
  { fg: '--border-strong', bg: '--surface-page', minRatio: WCAG_NON_TEXT },
  { fg: '--border-strong', bg: '--surface', minRatio: WCAG_NON_TEXT },
  { fg: '--border-strong', bg: '--surface-sunken', minRatio: WCAG_NON_TEXT },
  { fg: '--border-strong', bg: '--surface-raised', minRatio: WCAG_NON_TEXT },
  { fg: '--accent-fg', bg: '--border-strong', minRatio: WCAG_NON_TEXT },
  { fg: '--accent-fg', bg: '--fg-muted', minRatio: WCAG_NON_TEXT },
  { fg: '--accent', bg: '--accent-soft', minRatio: WCAG_NON_TEXT },
  { fg: '--danger-hover', bg: '--surface', minRatio: WCAG_NON_TEXT },
  { fg: '--danger-hover', bg: '--surface-page', minRatio: WCAG_NON_TEXT },
  { fg: '--danger-hover', bg: '--surface-raised', minRatio: WCAG_NON_TEXT },
  { fg: '--chart-1', bg: '--surface', minRatio: WCAG_NON_TEXT },
  { fg: '--chart-2', bg: '--surface', minRatio: WCAG_NON_TEXT },
  { fg: '--chart-3', bg: '--surface', minRatio: WCAG_NON_TEXT },
];

// 装飾的な 1px hairline と旧互換エイリアスはペア表から明示除外する。
const EXCLUDED_COLOR_TOKENS = new Set(['--border', '--bg', '--muted']);

const EXPR_PLACEHOLDER = '${__EXPR__}';
const KNOWN_NAV_LABEL_EXPR = '${esc(link.label)}';

// ============================================================================
// 区画 2: 抽出アダプタ（ソース解析層）
// ============================================================================

function readRepoFile(relPath) {
  return readFileSync(resolve(REPO_ROOT, relPath), 'utf8');
}

function unwrapExpression(node) {
  let current = node;
  while (
    current
    && (
      current.type === 'ChainExpression'
      || current.type === 'TSAsExpression'
      || current.type === 'TSSatisfiesExpression'
      || current.type === 'TSNonNullExpression'
      || current.type === 'TSTypeAssertion'
    )
  ) {
    current = current.expression;
  }
  return current;
}

function extractStaticString(node) {
  const expr = unwrapExpression(node);
  if (!expr) return null;
  if (expr.type === 'Literal' && typeof expr.value === 'string') return expr.value;
  if (expr.type === 'TemplateLiteral' && expr.expressions.length === 0) {
    return expr.quasis[0]?.value.cooked ?? expr.quasis[0]?.value.raw ?? '';
  }
  if (expr.type === 'BinaryExpression' && expr.operator === '+') {
    const left = extractStaticString(expr.left);
    const right = extractStaticString(expr.right);
    if (left !== null && right !== null) return left + right;
  }
  return null;
}

function getMemberPropertyName(member) {
  if (!member.computed && member.property.type === 'Identifier') {
    return member.property.name;
  }
  if (member.computed) {
    return extractStaticString(member.property);
  }
  return null;
}

function isKnownNavLabelExpr(node) {
  const expr = unwrapExpression(node);
  if (expr?.type !== 'CallExpression' || expr.arguments.length !== 1) return false;
  const callee = unwrapExpression(expr.callee);
  if (callee?.type !== 'Identifier' || callee.name !== 'esc') return false;
  const arg = unwrapExpression(expr.arguments[0]);
  return (
    arg?.type === 'MemberExpression'
    && !arg.computed
    && unwrapExpression(arg.object)?.type === 'Identifier'
    && unwrapExpression(arg.object).name === 'link'
    && arg.property.type === 'Identifier'
    && arg.property.name === 'label'
  );
}

function reconstructTemplate(node) {
  let out = node.quasis[0]?.value.cooked ?? node.quasis[0]?.value.raw ?? '';
  for (let i = 0; i < node.expressions.length; i += 1) {
    const placeholder = isKnownNavLabelExpr(node.expressions[i]) ? KNOWN_NAV_LABEL_EXPR : EXPR_PLACEHOLDER;
    const nextChunk = node.quasis[i + 1]?.value.cooked ?? node.quasis[i + 1]?.value.raw ?? '';
    out += placeholder + nextChunk;
  }
  return out;
}

function flattenPlusExpression(node, consumedNodes) {
  const expr = unwrapExpression(node);
  if (!expr) return EXPR_PLACEHOLDER;
  if (expr.type === 'BinaryExpression' && expr.operator === '+') {
    consumedNodes.add(node);
    consumedNodes.add(expr);
    return flattenPlusExpression(expr.left, consumedNodes) + flattenPlusExpression(expr.right, consumedNodes);
  }
  if (expr.type === 'Literal' && typeof expr.value === 'string') {
    consumedNodes.add(node);
    consumedNodes.add(expr);
    return expr.value;
  }
  if (expr.type === 'TemplateLiteral') {
    consumedNodes.add(node);
    consumedNodes.add(expr);
    return reconstructTemplate(expr);
  }
  return isKnownNavLabelExpr(expr) ? KNOWN_NAV_LABEL_EXPR : EXPR_PLACEHOLDER;
}

function extractRoleTokens(value) {
  return value.trim().split(/\s+/).filter(Boolean).map((token) => token.toLowerCase());
}

function assertNoForbiddenRoleTokens(value, context, filePath) {
  for (const token of extractRoleTokens(value)) {
    if (FORBIDDEN_ROLES.has(token)) {
      throw new Error(`${filePath}: 共通シェルで禁止ロール "${token}" が設定されています (${context})`);
    }
  }
}

function inspectDynamicRoleExpression(node, context, filePath) {
  const expr = unwrapExpression(node);
  if (!expr) {
    throw new Error(`${filePath}: 共通シェルで未解決の動的 role が設定されています (${context})`);
  }
  if (expr.type === 'ConditionalExpression') {
    inspectDynamicRoleExpression(expr.consequent, context, filePath);
    inspectDynamicRoleExpression(expr.alternate, context, filePath);
    return;
  }
  if (expr.type === 'Literal') {
    if (expr.value === null && context === 'assignment') return;
    if (typeof expr.value === 'string') {
      assertNoForbiddenRoleTokens(expr.value, context, filePath);
      return;
    }
    throw new Error(`${filePath}: 共通シェルで不正な role 値が設定されています (${context})`);
  }
  if (expr.type === 'TemplateLiteral') {
    for (const quasi of expr.quasis) {
      const chunk = quasi.value.cooked ?? quasi.value.raw ?? '';
      assertNoForbiddenRoleTokens(chunk, context, filePath);
    }
    if (expr.expressions.length > 0) {
      throw new Error(`${filePath}: 共通シェルで未解決の動的 role が設定されています (${context})`);
    }
    return;
  }
  if (expr.type === 'BinaryExpression' && expr.operator === '+') {
    const folded = extractStaticString(expr);
    if (folded !== null) {
      assertNoForbiddenRoleTokens(folded, context, filePath);
      return;
    }
  }
  throw new Error(`${filePath}: 共通シェルで未解決の動的 role が設定されています (${context})`);
}

function inspectCreateElementTag(node, filePath) {
  const expr = unwrapExpression(node);
  if (!expr) {
    throw new Error(`${filePath}: 共通シェルで未解決の動的要素を生成しています`);
  }
  if (expr.type === 'ConditionalExpression') {
    inspectCreateElementTag(expr.consequent, filePath);
    inspectCreateElementTag(expr.alternate, filePath);
    return;
  }
  const tagName = extractStaticString(expr);
  if (tagName === null) {
    throw new Error(`${filePath}: 共通シェルで未解決の動的要素を生成しています`);
  }
  const normalized = tagName.trim().toLowerCase();
  if (FORBIDDEN_IMPLICIT_TAGS.has(normalized)) {
    throw new Error(`${filePath}: 共通シェルで禁止要素 <${normalized}> を動的生成しています`);
  }
}

function parseScriptAst(source, filePath, options = {}) {
  const result = parseSync(filePath, source, { preserveParens: false, ...options });
  if (result.errors.length > 0) {
    throw new Error(`${filePath}: スクリプトのパースに失敗しました (${result.errors[0].message})`);
  }
  return result.program;
}

function extractHtmlFragmentsFromScript(source, filePath, parseOptions = {}) {
  const program = parseScriptAst(source, filePath, parseOptions);
  const htmlFragments = [];
  const consumedNodes = new Set();

  new Visitor({
    BinaryExpression(node) {
      if (node.operator !== '+' || consumedNodes.has(node)) return;
      const flattened = flattenPlusExpression(node, consumedNodes);
      if (flattened.includes('<')) {
        htmlFragments.push(flattened);
      }
    },
    Literal(node) {
      if (consumedNodes.has(node)) return;
      if (typeof node.value === 'string' && node.value.includes('<')) {
        htmlFragments.push(node.value);
      }
    },
    TemplateLiteral(node) {
      if (consumedNodes.has(node)) return;
      const reconstructed = reconstructTemplate(node);
      if (reconstructed.includes('<')) {
        htmlFragments.push(reconstructed);
      }
    },
  }).visit(program);

  return htmlFragments;
}

function checkDomApiViolations(source, filePath, parseOptions = {}) {
  const program = parseScriptAst(source, filePath, parseOptions);
  new Visitor({
    CallExpression(node) {
      const callee = unwrapExpression(node.callee);
      if (callee?.type !== 'MemberExpression') return;
      const prop = getMemberPropertyName(callee);
      if (prop === 'setAttribute' && node.arguments.length >= 2) {
        const attr = extractStaticString(node.arguments[0]);
        if (attr?.toLowerCase() === 'role') {
          inspectDynamicRoleExpression(node.arguments[1], 'setAttribute', filePath);
        }
      } else if (prop === 'setAttributeNS' && node.arguments.length >= 3) {
        const attr = extractStaticString(node.arguments[1]);
        if (attr?.toLowerCase() === 'role') {
          inspectDynamicRoleExpression(node.arguments[2], 'setAttributeNS', filePath);
        }
      } else if (prop === 'createElement' && node.arguments.length >= 1) {
        inspectCreateElementTag(node.arguments[0], filePath);
      } else if (prop === 'createElementNS' && node.arguments.length >= 2) {
        inspectCreateElementTag(node.arguments[1], filePath);
      }
    },
    AssignmentExpression(node) {
      const left = unwrapExpression(node.left);
      if (left?.type === 'MemberExpression' && getMemberPropertyName(left) === 'role') {
        inspectDynamicRoleExpression(node.right, 'assignment', filePath);
      }
    },
  }).visit(program);
}

const JS_SCRIPT_TYPES = new Set([
  'module',
  'text/javascript',
  'application/javascript',
  'text/ecmascript',
  'application/ecmascript',
  'text/x-javascript',
  'application/x-javascript',
  'text/x-ecmascript',
  'application/x-ecmascript',
  'text/jscript',
  'text/livescript',
  'text/javascript1.0',
  'text/javascript1.1',
  'text/javascript1.2',
  'text/javascript1.3',
  'text/javascript1.4',
  'text/javascript1.5',
]);

function isJsScriptType(rawType) {
  if (rawType === undefined) return true;
  const essence = decodeHtmlEntities(rawType).split(';')[0].trim().toLowerCase();
  return essence === '' || JS_SCRIPT_TYPES.has(essence);
}

function scanOpenTagEnd(text, start) {
  let j = start;
  const len = text.length;
  let state = 'beforeName';
  let quote = null;
  let lastSlashStandalone = false;
  let slashPos = -1;

  while (j < len) {
    const ch = text[j];
    if (state === 'inQuoted') {
      if (ch === quote) {
        quote = null;
        state = 'beforeName';
      }
      lastSlashStandalone = false;
      j += 1;
      continue;
    }
    if (ch === '>') {
      return { endIndex: j, lastSlashStandalone, slashPos, truncatedByNextTag: false };
    }
    if (ch === '<' && /^<(?:[A-Za-z][A-Za-z0-9:-]*(?=[\s/>]|\$\{)|\$\{)/.test(text.slice(j))) {
      return { endIndex: j, lastSlashStandalone: false, slashPos: -1, truncatedByNextTag: true };
    }
    if (state === 'inUnquoted') {
      if (/\s/.test(ch)) state = 'beforeName';
      lastSlashStandalone = false;
      j += 1;
      continue;
    }
    if (state === 'beforeValue') {
      if (/\s/.test(ch)) {
        j += 1;
        continue;
      }
      if (ch === '"' || ch === "'") {
        quote = ch;
        state = 'inQuoted';
      } else {
        state = 'inUnquoted';
      }
      lastSlashStandalone = false;
      j += 1;
      continue;
    }
    if (state === 'beforeName') {
      if (/\s/.test(ch)) {
        lastSlashStandalone = false;
        j += 1;
        continue;
      }
      if (ch === '/') {
        lastSlashStandalone = true;
        slashPos = j;
        j += 1;
        continue;
      }
      lastSlashStandalone = false;
      state = 'inName';
      j += 1;
      continue;
    }
    if (state === 'inName') {
      if (ch === '=') {
        state = 'beforeValue';
        lastSlashStandalone = false;
      } else if (/\s/.test(ch)) {
        state = 'afterName';
        lastSlashStandalone = false;
      } else if (ch === '/') {
        state = 'beforeName';
        lastSlashStandalone = true;
        slashPos = j;
      } else {
        lastSlashStandalone = false;
      }
      j += 1;
      continue;
    }
    // state === 'afterName'
    if (/\s/.test(ch)) {
      j += 1;
      continue;
    }
    if (ch === '=') {
      state = 'beforeValue';
      lastSlashStandalone = false;
    } else if (ch === '/') {
      state = 'beforeName';
      lastSlashStandalone = true;
      slashPos = j;
    } else {
      state = 'inName';
      lastSlashStandalone = false;
    }
    j += 1;
  }

  return null;
}

function splitHtmlAndScripts(source, filePath = '<html document>') {
  const htmlParts = [];
  const scripts = [];
  let i = 0;
  const len = source.length;

  while (i < len) {
    const lt = source.indexOf('<', i);
    if (lt === -1) {
      htmlParts.push(source.slice(i));
      break;
    }
    htmlParts.push(source.slice(i, lt));
    i = lt;

    if (source.startsWith('<!--', i)) {
      const end = source.indexOf('-->', i + 4);
      const commentEnd = end === -1 ? len : end + 3;
      htmlParts.push(source.slice(i, commentEnd).replace(/[^\n]/g, ' '));
      i = commentEnd;
      continue;
    }

    const scriptMatch = /^<script(?=[\s/>]|\$\{|$)/i.exec(source.slice(i));
    if (scriptMatch) {
      const attrStart = i + scriptMatch[0].length;
      const scan = scanOpenTagEnd(source, attrStart);
      if (!scan || scan.truncatedByNextTag) {
        throw new Error(`${filePath}: <script> タグが閉じられていません`);
      }
      const attrBody = scan.lastSlashStandalone
        ? source.slice(attrStart, scan.slashPos)
        : source.slice(attrStart, scan.endIndex);
      const attrs = parseHtmlAttributes(attrBody);

      const openEnd = scan.endIndex + 1;
      const closeRe = /<\/script\s*>/gi;
      closeRe.lastIndex = openEnd;
      const closeMatch = closeRe.exec(source);
      if (!closeMatch) {
        throw new Error(`${filePath}: <script> タグが閉じられていません`);
      }

      const body = source.slice(openEnd, closeMatch.index);
      if (isJsScriptType(attrs.get('type')) && body.trim() !== '') {
        scripts.push(body);
      }
      i = closeMatch.index + closeMatch[0].length;
      continue;
    }

    const tagMatch = /^<([A-Za-z][A-Za-z0-9:-]*)(?=[\s/>]|\$\{)/.exec(source.slice(i));
    if (tagMatch) {
      const scan = scanOpenTagEnd(source, i + tagMatch[0].length);
      if (scan) {
        const tagEnd = scan.truncatedByNextTag ? scan.endIndex : scan.endIndex + 1;
        htmlParts.push(source.slice(i, tagEnd));
        i = tagEnd;
        continue;
      }
    }

    htmlParts.push('<');
    i += 1;
  }

  return { htmlWithoutScripts: htmlParts.join(''), scripts };
}

function parseHtmlAttributes(attrText) {
  const attrs = new Map();
  let i = 0;
  const len = attrText.length;

  while (i < len) {
    while (i < len && /[\s/]/.test(attrText[i])) i += 1;
    if (i >= len) break;

    const nameStart = i;
    while (i < len && !/[\s=/>"']/.test(attrText[i])) i += 1;
    if (i === nameStart) {
      i += 1;
      continue;
    }
    const name = attrText.slice(nameStart, i).toLowerCase();

    while (i < len && /\s/.test(attrText[i])) i += 1;
    if (i < len && attrText[i] === '=') {
      i += 1;
      while (i < len && /\s/.test(attrText[i])) i += 1;
      let value = '';
      if (i < len && (attrText[i] === '"' || attrText[i] === "'")) {
        const quote = attrText[i];
        i += 1;
        const valStart = i;
        while (i < len && attrText[i] !== quote) i += 1;
        value = attrText.slice(valStart, i);
        if (i < len) i += 1;
      } else {
        const valStart = i;
        while (i < len && !/[\s>]/.test(attrText[i])) i += 1;
        value = attrText.slice(valStart, i);
      }
      if (!attrs.has(name)) attrs.set(name, value);
    } else {
      if (!attrs.has(name)) attrs.set(name, '');
    }
  }
  return attrs;
}

function scanHtmlTags(fragment, filePath = '<html fragment>') {
  const tokens = [];
  const cleanedParts = [];
  let i = 0;
  const len = fragment.length;

  while (i < len) {
    const lt = fragment.indexOf('<', i);
    if (lt === -1) {
      cleanedParts.push(fragment.slice(i));
      break;
    }
    cleanedParts.push(fragment.slice(i, lt));
    i = lt;

    if (fragment.startsWith('<!--', i)) {
      const end = fragment.indexOf('-->', i + 4);
      const commentEnd = end === -1 ? len : end + 3;
      cleanedParts.push(fragment.slice(i, commentEnd).replace(/[^\n]/g, ' '));
      i = commentEnd;
      continue;
    }

    if (fragment.startsWith('<${', i)) {
      throw new Error(`${filePath}: 共通シェルに動的タグ名が含まれています`);
    }

    if (fragment[i + 1] === '/') {
      const match = /^<\/([A-Za-z][A-Za-z0-9:-]*)\s*>/.exec(fragment.slice(i));
      if (match) {
        tokens.push({
          kind: 'close',
          tag: match[1].toLowerCase(),
          start: i,
          end: i + match[0].length,
        });
        cleanedParts.push(match[0]);
        i += match[0].length;
        continue;
      }
      cleanedParts.push('<');
      i += 1;
      continue;
    }

    const nameMatch = /^<([A-Za-z][A-Za-z0-9:-]*)(?=[\s/>]|\$\{)/.exec(fragment.slice(i));
    if (!nameMatch) {
      cleanedParts.push('<');
      i += 1;
      continue;
    }

    const tag = nameMatch[1].toLowerCase();
    const attrStart = i + nameMatch[0].length;
    const scan = scanOpenTagEnd(fragment, attrStart);
    if (!scan) {
      cleanedParts.push('<');
      i += 1;
      continue;
    }

    const attrBody = scan.lastSlashStandalone
      ? fragment.slice(attrStart, scan.slashPos)
      : fragment.slice(attrStart, scan.endIndex);
    const attrs = parseHtmlAttributes(attrBody);
    for (const attrName of attrs.keys()) {
      if (attrName.includes('${')) {
        throw new Error(`${filePath}: 共通シェルに未知の動的属性展開 "${attrName}" が含まれています`);
      }
    }

    const selfClosing = VOID_HTML_TAGS.has(tag) || (scan.lastSlashStandalone && SVG_SELF_CLOSING_TAGS.has(tag));
    const tokenEnd = scan.truncatedByNextTag ? scan.endIndex : scan.endIndex + 1;

    tokens.push({
      kind: 'open',
      tag,
      attrs,
      selfClosing,
      start: i,
      end: tokenEnd,
    });
    cleanedParts.push(fragment.slice(i, tokenEnd));
    i = tokenEnd;
  }

  return { cleaned: cleanedParts.join(''), tokens };
}

function decodeHtmlEntities(text) {
  const named = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: ' ',
  };
  return text.replace(/&(#[xX][0-9a-fA-F]+|#\d+|[A-Za-z]+);/g, (full, body) => {
    if (body.startsWith('#x') || body.startsWith('#X')) {
      const code = Number.parseInt(body.slice(2), 16);
      return Number.isFinite(code) && code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : full;
    }
    if (body.startsWith('#')) {
      const code = Number.parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : full;
    }
    return Object.hasOwn(named, body) ? named[body] : full;
  });
}

function findClosingTokenIndex(tokens, openIndex) {
  const openToken = tokens[openIndex];
  if (openToken.selfClosing) return openIndex;
  let depth = 1;
  for (let k = openIndex + 1; k < tokens.length; k += 1) {
    const token = tokens[k];
    if (token.tag !== openToken.tag) continue;
    if (token.kind === 'open' && !token.selfClosing) depth += 1;
    else if (token.kind === 'close') {
      depth -= 1;
      if (depth === 0) return k;
    }
  }
  return -1;
}

function extractVisibleTextRange(cleaned, tokens, startTokenIndex, endTokenIndex) {
  const openToken = tokens[startTokenIndex];
  if (openToken.selfClosing || endTokenIndex <= startTokenIndex) return '';
  const closeToken = tokens[endTokenIndex];

  let out = '';
  let cursor = openToken.end;
  let k = startTokenIndex + 1;

  while (k < endTokenIndex) {
    const token = tokens[k];
    out += cleaned.slice(cursor, token.start);

    const isHidden =
      token.kind === 'open'
      && (token.attrs.get('aria-hidden')?.trim().toLowerCase() === 'true' || token.attrs.has('hidden'));
    if (isHidden) {
      const hiddenClose = findClosingTokenIndex(tokens, k);
      if (hiddenClose === -1 || hiddenClose >= endTokenIndex) {
        cursor = closeToken.start;
        break;
      }
      cursor = tokens[hiddenClose].end;
      k = hiddenClose + 1;
      continue;
    }

    if (token.kind === 'open' && token.tag === 'img') {
      const alt = token.attrs.get('alt');
      if (alt !== undefined && alt !== '') {
        out += ` ${alt} `;
      }
    }

    cursor = token.end;
    k += 1;
  }

  out += cleaned.slice(cursor, closeToken.start);
  return out;
}

function normalizeText(value) {
  return decodeHtmlEntities(value).replace(/\s+/g, ' ').trim();
}

function collectIdTextMap(parsedFragments) {
  const idTextMap = new Map();

  for (const { cleaned, tokens } of parsedFragments) {
    for (let idx = 0; idx < tokens.length; idx += 1) {
      const token = tokens[idx];
      if (token.kind !== 'open') continue;
      const id = token.attrs.get('id')?.trim();
      if (!id || idTextMap.has(id)) continue;

      const ariaLabel = token.attrs.get('aria-label')?.trim() ?? '';
      if (ariaLabel !== '') {
        idTextMap.set(id, ariaLabel);
        continue;
      }
      if (token.tag === 'img') {
        idTextMap.set(id, token.attrs.get('alt') ?? '');
        continue;
      }
      const closeIdx = findClosingTokenIndex(tokens, idx);
      if (closeIdx === -1) continue;
      // 二重デコードを防ぐため生テキストのまま保持し、最終出力時に 1 回だけ normalizeText を適用する。
      idTextMap.set(id, extractVisibleTextRange(cleaned, tokens, idx, closeIdx));
    }
  }

  return idTextMap;
}

function extractShellLinksFromHtml({ cleaned, tokens }, filePath, idTextMap) {
  const links = [];

  for (let idx = 0; idx < tokens.length; idx += 1) {
    const token = tokens[idx];
    if (token.kind !== 'open') continue;
    const isAnchorLink = token.tag === 'a' && token.attrs.has('href');
    const isRoleLink =
      token.attrs.has('role')
      && extractRoleTokens(decodeHtmlEntities(token.attrs.get('role'))).includes('link');
    if (!isAnchorLink && !isRoleLink) continue;

    let rawName = '';

    const labelledBy = token.attrs.get('aria-labelledby')?.trim() ?? '';
    if (labelledBy !== '') {
      if (labelledBy.includes('${')) {
        throw new Error(`${filePath}: 共通シェルリンクに未解決の動的 aria-labelledby が含まれています`);
      }
      const parts = [];
      for (const refId of labelledBy.split(/\s+/)) {
        if (!idTextMap.has(refId)) {
          throw new Error(`${filePath}: 共通シェルリンクの aria-labelledby="${refId}" が解決できません`);
        }
        parts.push(idTextMap.get(refId));
      }
      rawName = parts.join(' ');
    }

    if (rawName.trim() === '') {
      const ariaLabel = token.attrs.get('aria-label')?.trim() ?? '';
      if (ariaLabel !== '') {
        rawName = ariaLabel;
      }
    }

    if (rawName.trim() === '') {
      const closeIdx = findClosingTokenIndex(tokens, idx);
      if (closeIdx !== -1) {
        rawName = extractVisibleTextRange(cleaned, tokens, idx, closeIdx);
      }
    }

    if (rawName.trim() === '') {
      const title = token.attrs.get('title')?.trim() ?? '';
      if (title !== '') {
        rawName = title;
      }
    }

    const trimmedRaw = rawName.trim();
    if (trimmedRaw === KNOWN_NAV_LABEL_EXPR) {
      continue;
    }
    if (trimmedRaw.includes('${')) {
      throw new Error(`${filePath}: 共通シェルに未知の動的リンク名 "${trimmedRaw}" が含まれています`);
    }

    const label = normalizeText(trimmedRaw);
    if (label === '') {
      throw new Error(`${filePath}: 共通シェルにアクセシブル名のないリンクが含まれています`);
    }
    links.push({ label, source: filePath });
  }

  return links;
}

function collectShellHtmlFragments(source, filePath) {
  if (filePath.endsWith('.html')) {
    const { htmlWithoutScripts, scripts } = splitHtmlAndScripts(source, filePath);
    const fragments = [htmlWithoutScripts];
    for (let i = 0; i < scripts.length; i += 1) {
      const scriptFragments = extractHtmlFragmentsFromScript(
        scripts[i],
        `${filePath}#script-${i}.js`,
        { lang: 'js', sourceType: 'unambiguous' },
      );
      fragments.push(...scriptFragments);
    }
    return fragments;
  }
  return extractHtmlFragmentsFromScript(source, filePath);
}

function extractShellLinksFromSource(source, filePath) {
  const fragments = collectShellHtmlFragments(source, filePath);
  const parsedFragments = fragments.map((fragment) => scanHtmlTags(fragment, filePath));
  const idTextMap = collectIdTextMap(parsedFragments);
  const links = [];
  for (const parsed of parsedFragments) {
    links.push(...extractShellLinksFromHtml(parsed, filePath, idTextMap));
  }
  return links;
}

function checkShellForbiddenRolesInSource(source, filePath) {
  const fragments = [];
  if (filePath.endsWith('.html')) {
    const { htmlWithoutScripts, scripts } = splitHtmlAndScripts(source, filePath);
    fragments.push(htmlWithoutScripts);
    for (let i = 0; i < scripts.length; i += 1) {
      const scriptPath = `${filePath}#script-${i}.js`;
      const parseOptions = { lang: 'js', sourceType: 'unambiguous' };
      checkDomApiViolations(scripts[i], scriptPath, parseOptions);
      fragments.push(...extractHtmlFragmentsFromScript(scripts[i], scriptPath, parseOptions));
    }
  } else {
    checkDomApiViolations(source, filePath);
    fragments.push(...extractHtmlFragmentsFromScript(source, filePath));
  }

  for (const fragment of fragments) {
    const { tokens } = scanHtmlTags(fragment, filePath);
    for (const token of tokens) {
      if (token.kind !== 'open') continue;

      if (FORBIDDEN_IMPLICIT_TAGS.has(token.tag)) {
        throw new Error(`${filePath}: 共通シェルに禁止要素 <${token.tag}> が含まれています`);
      }

      if (token.attrs.has('role')) {
        const roleVal = token.attrs.get('role');
        if (roleVal.includes('${')) {
          throw new Error(`${filePath}: 共通シェルに動的 role 属性が含まれています`);
        }
        for (const roleToken of extractRoleTokens(decodeHtmlEntities(roleVal))) {
          if (FORBIDDEN_ROLES.has(roleToken)) {
            throw new Error(`${filePath}: 共通シェルに禁止ロール role="${roleToken}" が含まれています`);
          }
        }
      }

      if (token.tag === 'section') {
        for (const nameAttr of ['aria-label', 'aria-labelledby', 'title']) {
          const attrVal = token.attrs.get(nameAttr);
          if (attrVal !== undefined && attrVal.trim() !== '') {
            throw new Error(
              `${filePath}: 共通シェルに名前付き <section ${nameAttr}>（暗黙の region ロール）が含まれています`,
            );
          }
        }
      }
    }
  }
}

// --- CSS パース & var() 解決 ---

function stripCssComments(css) {
  let out = '';
  let i = 0;
  let quote = null;
  while (i < css.length) {
    const ch = css[i];
    if (quote) {
      out += ch;
      if (ch === '\\' && i + 1 < css.length) {
        out += css[i + 1];
        i += 2;
        continue;
      }
      if (ch === quote) quote = null;
      i += 1;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      out += ch;
      i += 1;
      continue;
    }
    if (ch === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2);
      if (end === -1) throw new Error('CSS コメントが閉じられていません');
      out += css.slice(i, end + 2).replace(/[^\n]/g, ' ');
      i = end + 2;
      continue;
    }
    out += ch;
    i += 1;
  }
  if (quote !== null) throw new Error('CSS のクォートが閉じられていません');
  return out;
}

function splitTopLevelCssRules(css) {
  const rules = [];
  let i = 0;
  const len = css.length;

  while (i < len) {
    while (i < len && /[\s;]/.test(css[i])) i += 1;
    if (i >= len) break;

    const preludeStart = i;
    let quote = null;
    while (i < len) {
      const ch = css[i];
      if (quote) {
        if (ch === '\\' && i + 1 < len) { i += 2; continue; }
        if (ch === quote) quote = null;
        i += 1;
        continue;
      }
      if (ch === '"' || ch === "'") { quote = ch; i += 1; continue; }
      if (ch === '{' || ch === ';') break;
      i += 1;
    }
    if (quote !== null) throw new Error('CSS ルールのクォートが閉じられていません');
    if (i >= len) {
      throw new Error(`CSS ルールにブロック "{" がありません: ${css.slice(preludeStart).trim()}`);
    }
    if (css[i] === ';') {
      throw new Error(`CSS にブロックのない文があります: ${css.slice(preludeStart, i).trim()}`);
    }

    const prelude = css.slice(preludeStart, i).trim();
    i += 1; // '{' をスキップ
    const bodyStart = i;
    let depth = 1;
    quote = null;

    while (i < len && depth > 0) {
      const ch = css[i];
      if (quote) {
        if (ch === '\\' && i + 1 < len) { i += 2; continue; }
        if (ch === quote) quote = null;
        i += 1;
        continue;
      }
      if (ch === '"' || ch === "'") { quote = ch; i += 1; continue; }
      if (ch === '{') depth += 1;
      else if (ch === '}') depth -= 1;
      i += 1;
    }
    if (quote !== null) throw new Error(`CSS ブロック "${prelude}" のクォートが閉じられていません`);
    if (depth !== 0) throw new Error(`CSS ブロック "${prelude}" の波括弧が閉じられていません`);
    rules.push({ prelude, body: css.slice(bodyStart, i - 1) });
  }

  return rules;
}

function parseCssDeclarations(body) {
  const decls = {};
  const statements = [];
  let start = 0;
  let parenDepth = 0;
  let quote = null;

  for (let i = 0; i <= body.length; i += 1) {
    const ch = body[i];
    if (i < body.length) {
      if (quote) {
        if (ch === '\\' && i + 1 < body.length) { i += 1; continue; }
        if (ch === quote) quote = null;
        continue;
      }
      if (ch === '"' || ch === "'") { quote = ch; continue; }
      if (ch === '(') { parenDepth += 1; continue; }
      if (ch === ')') {
        parenDepth -= 1;
        if (parenDepth < 0) {
          throw new Error(`CSS 宣言に余剰な閉じ括弧 ")" があります: ${body.slice(start, i + 1).trim()}`);
        }
        continue;
      }
    }
    if (i === body.length || (ch === ';' && parenDepth === 0)) {
      if (i === body.length) {
        if (quote !== null) throw new Error(`CSS 宣言のクォートが閉じられていません: ${body.slice(start).trim()}`);
        if (parenDepth !== 0) throw new Error(`CSS 宣言の括弧 "(" が閉じられていません: ${body.slice(start).trim()}`);
      }
      const stmt = body.slice(start, i).trim();
      if (stmt !== '') statements.push(stmt);
      start = i + 1;
    }
  }

  for (const stmt of statements) {
    const colon = stmt.indexOf(':');
    if (colon === -1) throw new Error(`不正な CSS 宣言です: ${stmt}`);
    const rawProp = stmt.slice(0, colon).trim();
    const value = stmt.slice(colon + 1).trim();
    if (rawProp === '') throw new Error(`CSS プロパティ名が空です: ${stmt}`);
    if (value === '') throw new Error(`CSS プロパティ "${rawProp}" の値が空です`);
    const prop = rawProp.startsWith('--') ? rawProp : rawProp.toLowerCase();
    decls[prop] = value;
  }

  return decls;
}

function normalizeSelector(selector) {
  return selector
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\[\s*([^\]]+?)\s*\]/g, (_m, inner) => {
      const eq = inner.indexOf('=');
      if (eq === -1) return `[${inner.trim()}]`;
      const k = inner.slice(0, eq).trim().toLowerCase();
      let v = inner.slice(eq + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      return `[${k}='${v}']`;
    })
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')');
}

function resolveCssVarValue(value, rawMap, stack) {
  let out = '';
  let i = 0;
  let quote = null;

  while (i < value.length) {
    const ch = value[i];
    if (quote) {
      out += ch;
      if (ch === '\\' && i + 1 < value.length) {
        out += value[i + 1];
        i += 2;
        continue;
      }
      if (ch === quote) quote = null;
      i += 1;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      out += ch;
      i += 1;
      continue;
    }

    const prev = i > 0 ? value[i - 1] : '';
    const isVarCall =
      !/[A-Za-z0-9_-]/.test(prev)
      && value.slice(i, i + 4).toLowerCase() === 'var(';

    if (!isVarCall) {
      out += ch;
      i += 1;
      continue;
    }

    let j = i + 4;
    let depth = 1;
    let innerQuote = null;
    let commaIndex = -1;

    while (j < value.length && depth > 0) {
      const innerCh = value[j];
      if (innerQuote) {
        if (innerCh === '\\' && j + 1 < value.length) { j += 2; continue; }
        if (innerCh === innerQuote) innerQuote = null;
        j += 1;
        continue;
      }
      if (innerCh === '"' || innerCh === "'") { innerQuote = innerCh; j += 1; continue; }
      if (innerCh === '(') depth += 1;
      else if (innerCh === ')') depth -= 1;
      else if (innerCh === ',' && depth === 1 && commaIndex === -1) commaIndex = j;
      j += 1;
    }
    if (depth !== 0) throw new Error(`var() の括弧が閉じられていません: ${value}`);

    const innerEnd = j - 1;
    const varName = (commaIndex === -1 ? value.slice(i + 4, innerEnd) : value.slice(i + 4, commaIndex)).trim();
    const fallback = commaIndex === -1 ? null : value.slice(commaIndex + 1, innerEnd).trim();

    if (stack.has(varName)) {
      throw new Error(`CSS カスタムプロパティの循環参照を検出しました: ${varName}`);
    }
    if (Object.hasOwn(rawMap, varName)) {
      stack.add(varName);
      out += resolveCssVarValue(rawMap[varName], rawMap, stack);
      stack.delete(varName);
    } else if (fallback !== null) {
      out += resolveCssVarValue(fallback, rawMap, stack);
    } else {
      throw new Error(`未定義の CSS トークンを参照しています: ${varName}`);
    }
    i = j;
  }
  return out;
}

function resolvePaletteVars(rawMap) {
  const resolved = {};
  for (const [key, val] of Object.entries(rawMap)) {
    const stack = new Set([key]);
    resolved[key] = resolveCssVarValue(val, rawMap, stack);
  }
  return resolved;
}

const DARK_MEDIA_PRELUDE_RE = /^@media\s+(?:(?:all|screen)\s+and\s+)?\(\s*prefers-color-scheme\s*:\s*dark\s*\)$/i;

function parseTokenPalettes(css) {
  const stripped = stripCssComments(css);
  const lightRaw = {};
  const darkMediaRaw = {};
  const darkAttrRaw = {};

  for (const rule of splitTopLevelCssRules(stripped)) {
    if (DARK_MEDIA_PRELUDE_RE.test(rule.prelude)) {
      for (const inner of splitTopLevelCssRules(rule.body)) {
        const selectors = inner.prelude.split(',').map(normalizeSelector);
        for (const selector of selectors) {
          if (selector !== ":root:not([data-theme='light'])") {
            throw new Error(`tokens.css の @media 内に想定外のセレクタがあります: ${inner.prelude}`);
          }
        }
        Object.assign(darkMediaRaw, parseCssDeclarations(inner.body));
      }
      continue;
    }

    const selectors = rule.prelude.split(',').map(normalizeSelector);
    let matchedLight = false;
    let matchedDarkAttr = false;
    for (const selector of selectors) {
      if (selector === ':root') {
        matchedLight = true;
      } else if (selector === ":root[data-theme='dark']") {
        matchedDarkAttr = true;
      } else {
        throw new Error(`tokens.css に想定外のルールがあります: ${rule.prelude}`);
      }
    }
    const decls = parseCssDeclarations(rule.body);
    if (matchedLight) Object.assign(lightRaw, decls);
    if (matchedDarkAttr) Object.assign(darkAttrRaw, decls);
  }

  if (Object.keys(lightRaw).length === 0) {
    throw new Error('tokens.css に Light (:root) ブロックが見つかりません');
  }
  if (Object.keys(darkMediaRaw).length === 0) {
    throw new Error("tokens.css に Dark (@media prefers-color-scheme: dark の :root:not([data-theme='light'])) ブロックが見つかりません");
  }
  if (Object.keys(darkAttrRaw).length === 0) {
    throw new Error("tokens.css に Dark (:root[data-theme='dark']) ブロックが見つかりません");
  }

  // :root のみに存在する互換エイリアス（--bg 等）を Dark 側でも正しく解決するため、必ず raw マージ後に var() を展開する。
  const light = resolvePaletteVars(lightRaw);
  const darkMedia = resolvePaletteVars({ ...lightRaw, ...darkMediaRaw });
  const darkAttr = resolvePaletteVars({ ...lightRaw, ...darkAttrRaw });

  return { lightRaw, darkMediaRaw, darkAttrRaw, light, darkMedia, darkAttr };
}

// ============================================================================
// 区画 3: 契約判定コア（純粋関数層）
// ============================================================================

function normalizeAccessibleName(name) {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

function checkMainLinks(mainLinks) {
  if (!Array.isArray(mainLinks) || mainLinks.length !== EXPECTED_MAIN_LINKS.length) {
    throw new Error(`MAIN_LINKS は ${EXPECTED_MAIN_LINKS.length} 件固定である必要があります（現在 ${Array.isArray(mainLinks) ? mainLinks.length : '非配列'} 件）`);
  }
  for (let i = 0; i < EXPECTED_MAIN_LINKS.length; i += 1) {
    const actual = mainLinks[i];
    const expected = EXPECTED_MAIN_LINKS[i];
    if (actual?.label !== expected.label || actual?.href !== expected.href) {
      throw new Error(
        `MAIN_LINKS[${i}] が契約と一致しません（期待: ${expected.label} -> ${expected.href}、実際: ${actual?.label} -> ${actual?.href}）`,
      );
    }
    if (typeof actual.description !== 'string' || actual.description.trim() === '') {
      throw new Error(`MAIN_LINKS[${i}] (${expected.label}) の description が空です`);
    }
  }
}

function checkNavStructure(mainLinks, componentGroups, allLinks) {
  if (!Array.isArray(componentGroups) || componentGroups.length === 0) {
    throw new Error('COMPONENT_GROUPS は 1 グループ以上必要です');
  }
  const seenGroupLabels = new Set();
  for (const group of componentGroups) {
    if (typeof group?.label !== 'string' || group.label.trim() === '') {
      throw new Error('COMPONENT_GROUPS に空の group.label が含まれています');
    }
    const normGroup = normalizeAccessibleName(group.label);
    if (seenGroupLabels.has(normGroup)) {
      throw new Error(`COMPONENT_GROUPS の group.label "${group.label}" が重複しています`);
    }
    seenGroupLabels.add(normGroup);
    if (!Array.isArray(group.links) || group.links.length === 0) {
      throw new Error(`COMPONENT_GROUPS "${group.label}" にリンクがありません`);
    }
  }

  const expectedAll = [...mainLinks, ...componentGroups.flatMap((group) => group.links)];
  assert.deepEqual(allLinks, expectedAll, 'ALL_LINKS が MAIN_LINKS と COMPONENT_GROUPS の結合結果と一致しません');

  const seenHrefs = new Set();
  for (const link of allLinks) {
    if (typeof link?.href !== 'string' || !link.href.startsWith('/')) {
      throw new Error(`ALL_LINKS のリンク "${link?.label}" の href が "/" で始まっていません: ${link?.href}`);
    }
    if (seenHrefs.has(link.href)) {
      throw new Error(`ALL_LINKS に重複する href があります: ${link.href}`);
    }
    seenHrefs.add(link.href);
    if (typeof link.description !== 'string' || link.description.trim() === '') {
      throw new Error(`ALL_LINKS のリンク "${link.label}" の description が空です`);
    }
  }
}

function checkNavLinkCollisions(links) {
  if (!Array.isArray(links) || links.length === 0) {
    throw new Error('衝突検査対象のナビゲーションリンクが 0 件です');
  }
  const normalized = links.map((link) => {
    const norm = typeof link?.label === 'string' ? normalizeAccessibleName(link.label) : '';
    if (norm === '') {
      throw new Error(`空のナビゲーションリンク名が含まれています (${link?.source ?? 'unknown'})`);
    }
    return { ...link, norm };
  });

  for (let i = 0; i < normalized.length; i += 1) {
    for (let j = i + 1; j < normalized.length; j += 1) {
      const a = normalized[i];
      const b = normalized[j];
      if (a.norm === b.norm) {
        throw new Error(
          `重複するナビゲーションリンク名: "${a.label}" (${a.source}) と "${b.label}" (${b.source})`,
        );
      }
      if (a.norm.includes(b.norm) || b.norm.includes(a.norm)) {
        throw new Error(
          `ナビゲーションリンク名が部分一致で衝突しています: "${a.label}" (${a.source}) と "${b.label}" (${b.source})`,
        );
      }
    }
  }
}

function checkDarkBlocksParity(darkMediaRaw, darkAttrRaw) {
  const mediaKeys = Object.keys(darkMediaRaw);
  const attrKeys = Object.keys(darkAttrRaw);
  if (mediaKeys.length === 0 || attrKeys.length === 0) {
    throw new Error('Dark ブロックの宣言が空です');
  }

  for (const key of mediaKeys) {
    if (!Object.hasOwn(darkAttrRaw, key)) {
      throw new Error(`Dark ブロック間で宣言が不一致です: "${key}" が :root[data-theme='dark'] に不足しています`);
    }
  }
  for (const key of attrKeys) {
    if (!Object.hasOwn(darkMediaRaw, key)) {
      throw new Error(`Dark ブロック間で宣言が不一致です: "${key}" が @media dark ブロックに不足しています`);
    }
  }

  for (const key of mediaKeys) {
    const mediaVal = darkMediaRaw[key].trim().replace(/\s+/g, ' ');
    const attrVal = darkAttrRaw[key].trim().replace(/\s+/g, ' ');
    if (mediaVal !== attrVal) {
      throw new Error(
        `Dark ブロック間で "${key}" の値が異なります (@media: "${mediaVal}", [data-theme='dark']: "${attrVal}")`,
      );
    }
  }
}

const HEX_COLOR_RE = /^#(?:([0-9a-f]{3})|([0-9a-f]{6}))$/i;
const COLOR_CANDIDATE_HEX_RE = /^#[0-9a-f]{3,8}(?:\s*!important)?$/i;
const COLOR_CANDIDATE_FN_RE = /^(?:rgba?|hsla?|oklch|oklab|hwb|lab|lch|color|color-mix)\s*\(/i;

function isColorTokenCandidate(val) {
  const trimmed = val.trim();
  return COLOR_CANDIDATE_HEX_RE.test(trimmed) || COLOR_CANDIDATE_FN_RE.test(trimmed);
}

function parseHexColor(hex) {
  if (typeof hex !== 'string') {
    throw new Error(`不正な hex 色値です: ${String(hex)}`);
  }
  const trimmed = hex.trim();
  const match = HEX_COLOR_RE.exec(trimmed);
  if (!match) {
    throw new Error(`不正な hex 色値です: ${hex}`);
  }
  const full = match[1]
    ? match[1].split('').map((ch) => ch + ch).join('')
    : match[2];
  return [
    Number.parseInt(full.slice(0, 2), 16),
    Number.parseInt(full.slice(2, 4), 16),
    Number.parseInt(full.slice(4, 6), 16),
  ];
}

function relativeLuminance(hex) {
  const [r, g, b] = parseHexColor(hex).map((channel) => {
    const s = channel / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(fgHex, bgHex) {
  const l1 = relativeLuminance(fgHex);
  const l2 = relativeLuminance(bgHex);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

function checkTokenCoverage(palette, pairs, excludedTokens, label) {
  const colorTokens = Object.entries(palette)
    .filter(([key, val]) => key.startsWith('--') && isColorTokenCandidate(val))
    .map(([key]) => key);

  if (colorTokens.length === 0) {
    throw new Error(`${label}: 色トークンが 0 件です`);
  }

  const covered = new Set(excludedTokens);
  for (const pair of pairs) {
    covered.add(pair.fg);
    covered.add(pair.bg);
  }

  const uncovered = colorTokens.filter((token) => !covered.has(token));
  if (uncovered.length > 0) {
    throw new Error(`${label}: コントラスト検証ペアにも除外リストにも含まれない色トークンがあります: ${uncovered.join(', ')}`);
  }

  const unsupported = colorTokens.filter((token) => !HEX_COLOR_RE.test(palette[token].trim()));
  if (unsupported.length > 0) {
    throw new Error(`${label}: 非対応の色形式（3/6 桁 hex 以外）が使用されています: ${unsupported.join(', ')}`);
  }
}

function checkPaletteContrast(palette, pairs, label) {
  if (!Array.isArray(pairs) || pairs.length === 0) {
    throw new Error(`${label}: コントラスト検証ペアが 0 件です`);
  }
  for (const { fg, bg, minRatio } of pairs) {
    if (!Object.hasOwn(palette, fg)) {
      throw new Error(`${label}: 前景トークン "${fg}" が定義されていません`);
    }
    if (!Object.hasOwn(palette, bg)) {
      throw new Error(`${label}: 背景トークン "${bg}" が定義されていません`);
    }
    const ratio = contrastRatio(palette[fg], palette[bg]);
    if (ratio < minRatio) {
      throw new Error(
        `${label}: ${fg} (${palette[fg]}) on ${bg} (${palette[bg]}) のコントラスト比が ${ratio.toFixed(2)}:1 で基準 ${minRatio}:1 未満です`,
      );
    }
  }
}

// ============================================================================
// 区画 4A: 実ファイル契約ガードテスト
// ============================================================================

test('preserves MAIN_LINKS order, labels, hrefs, and nav structure in src/nav.ts', () => {
  checkMainLinks(MAIN_LINKS);
  checkNavStructure(MAIN_LINKS, COMPONENT_GROUPS, ALL_LINKS);
  assert.ok(ALL_LINKS.length > MAIN_LINKS.length);
});

test('has no duplicate or case-insensitive substring collisions across all navigation and shell links', () => {
  const shellLinks = SHELL_FILES.flatMap((relPath) => extractShellLinksFromSource(readRepoFile(relPath), relPath));
  const shellLabels = new Set(shellLinks.map((item) => item.label));

  // 空回り防止: ファイル分割に依存せず共通シェル全体から公開リンク 3 件が抽出されていること。
  for (const expected of EXPECTED_SHELL_LINKS) {
    assert.ok(shellLabels.has(expected), `共通シェル全体から必須リンク "${expected}" を抽出できませんでした`);
  }

  const allNavLinks = [
    ...MAIN_LINKS.map((link) => ({ label: link.label, source: 'src/nav.ts (MAIN_LINKS)' })),
    ...COMPONENT_GROUPS.flatMap((group) =>
      group.links.map((link) => ({ label: link.label, source: `src/nav.ts (${group.label})` })),
    ),
    ...shellLinks,
  ];
  assert.ok(allNavLinks.length >= ALL_LINKS.length + EXPECTED_SHELL_LINKS.length);
  checkNavLinkCollisions(allNavLinks);
});

test('keeps common shell files free of forbidden status, region, and dialog roles', () => {
  assert.ok(SHELL_FILES.length > 0);
  for (const relPath of SHELL_FILES) {
    checkShellForbiddenRolesInSource(readRepoFile(relPath), relPath);
  }
});

test('satisfies WCAG AA / 1.4.11 contrast, token coverage, and dark block parity in src/styles/tokens.css', () => {
  const palettes = parseTokenPalettes(readRepoFile('src/styles/tokens.css'));
  checkDarkBlocksParity(palettes.darkMediaRaw, palettes.darkAttrRaw);

  for (const [label, palette] of [
    ['light (:root)', palettes.light],
    ['dark (@media)', palettes.darkMedia],
    ["dark ([data-theme='dark'])", palettes.darkAttr],
  ]) {
    checkTokenCoverage(palette, CONTRAST_PAIRS, EXCLUDED_COLOR_TOKENS, label);
    checkPaletteContrast(palette, CONTRAST_PAIRS, label);
  }
});

// ============================================================================
// 区画 4B: 検査ロジックの境界値・変異検出テスト（テーブル駆動）
// ============================================================================

test('checkMainLinks and checkNavStructure reject contract-breaking mutations', () => {
  const validMain = EXPECTED_MAIN_LINKS.map((item, idx) => ({ ...item, description: `説明 ${idx + 1}` }));
  const validGroups = [{ label: 'Forms', links: [{ label: 'Datepicker', href: '/forms/datepicker', description: '日付選択' }] }];
  const validAll = [...validMain, ...validGroups[0].links];

  assert.doesNotThrow(() => checkMainLinks(validMain));
  assert.doesNotThrow(() => checkNavStructure(validMain, validGroups, validAll));

  for (const [name, mutated, pattern] of [
    ['fewer than 5 items', validMain.slice(0, 4), /5 件固定/],
    ['more than 5 items', [...validMain, { label: 'Extra', href: '/extra', description: '追加' }], /5 件固定/],
    ['swapped order', [validMain[1], validMain[0], ...validMain.slice(2)], /MAIN_LINKS\[0\]/],
    ['changed label', validMain.map((l, i) => (i === 2 ? { ...l, label: 'Plans' } : l)), /MAIN_LINKS\[2\]/],
    ['changed href', validMain.map((l, i) => (i === 3 ? { ...l, href: '/slow-page' } : l)), /MAIN_LINKS\[3\]/],
    ['empty MAIN_LINKS description', validMain.map((l, i) => (i === 4 ? { ...l, description: '   ' } : l)), /description が空/],
  ]) {
    assert.throws(() => checkMainLinks(mutated), pattern, `expected checkMainLinks rejection for ${name}`);
  }

  for (const [name, groups, all, pattern] of [
    ['empty groups', [], validMain, /1 グループ以上/],
    ['empty group label', [{ label: '  ', links: validGroups[0].links }], validAll, /空の group\.label/],
    ['duplicate group label', [validGroups[0], { label: 'forms', links: [{ label: 'Board', href: '/board', description: 'ボード' }] }], [...validAll, { label: 'Board', href: '/board', description: 'ボード' }], /重複/],
    ['empty links in group', [{ label: 'Empty', links: [] }], validMain, /リンクがありません/],
    ['ALL_LINKS mismatch', validGroups, validMain, /ALL_LINKS/],
    ['href without leading slash', [{ label: 'Forms', links: [{ label: 'Datepicker', href: 'forms/datepicker', description: '日付' }] }], [...validMain, { label: 'Datepicker', href: 'forms/datepicker', description: '日付' }], /"\/" で始まっていません/],
    ['duplicate href', [{ label: 'Forms', links: [{ label: 'Other', href: '/todos', description: '重複パス' }] }], [...validMain, { label: 'Other', href: '/todos', description: '重複パス' }], /重複する href/],
    ['empty COMPONENT_GROUPS description', [{ label: 'Forms', links: [{ label: 'Datepicker', href: '/forms/datepicker', description: ' ' }] }], [...validMain, { label: 'Datepicker', href: '/forms/datepicker', description: ' ' }], /description が空/],
  ]) {
    assert.throws(() => checkNavStructure(validMain, groups, all), pattern, `expected checkNavStructure rejection for ${name}`);
  }
});

test('checkNavLinkCollisions enforces exact, normalized, substring, cross-source, and non-empty rules', () => {
  const base = [
    { label: 'Home', source: 'MAIN_LINKS' },
    { label: 'Sign in', source: 'src/auth.ts' },
    { label: 'Todo App', source: 'src/layout.ts' },
  ];
  assert.doesNotThrow(() => checkNavLinkCollisions(base));

  for (const [name, input, pattern] of [
    ['empty list', [], /0 件/],
    ['blank label', [...base, { label: '   ', source: 'test' }], /空のナビゲーションリンク名/],
    ['exact duplicate', [...base, { label: 'Home', source: 'extra' }], /重複する/],
    ['case-insensitive duplicate', [...base, { label: 'SIGN IN', source: 'extra' }], /重複する/],
    ['whitespace-normalized duplicate', [...base, { label: '  Todo   App ', source: 'extra' }], /重複する/],
    ['substring A in B', [...base, { label: 'Home settings', source: 'COMPONENT_GROUPS' }], /部分一致で衝突/],
    ['substring B in A', [...base, { label: 'App', source: 'COMPONENT_GROUPS' }], /部分一致で衝突/],
    ['case-insensitive cross-source collision (ALL_LINKS vs shell)', [...base, { label: 'Sign In Help', source: 'COMPONENT_GROUPS' }], /部分一致で衝突/],
  ]) {
    assert.throws(() => checkNavLinkCollisions(input), pattern, `expected collision rejection for ${name}`);
  }
});

test('extractShellLinksFromSource handles ACCNAME priority, entities, nested expressions, HTML path, and rejects unknown dynamic links', () => {
  const validSource = `
    // <a href="/ignored">Commented link</a>
    const shared = html('<span id="cross-frag">Cross Fragment</span>');
    const a = html(\`
      <aside>
        <span id="lbl-1">Primary</span>
        <span id="lbl-2">Action</span>
        <span id="aria-target" aria-label="Aria Target">Ignored Inner</span>
        <span id="ent-lbl">A &amp;amp; B</span>
        <a href="/a" aria-labelledby="lbl-1 lbl-2" aria-label="Ignored">Fallback</a>
        <a href="/aria-ref" aria-labelledby="aria-target">Fallback</a>
        <a href="/cross" aria-labelledby="cross-frag">Fallback</a>
        <a href="/ent" aria-labelledby="ent-lbl">Fallback</a>
        <a href="/override" aria-label="Override Label" title="Title">Visible Text</a>
        <a href="/dup" aria-label="First Label" aria-label="Second Label">Ignored</a>
        <a href="/b" aria-labelledby="  " aria-label="  "><span aria-hidden="true"><span>Hidden</span></span>Read &amp; Write</a>
        <a href="/hidden">Visible<span hidden> Hidden Detail</span></a>
        <a href="/img"><img alt="Icon" /> Guide<img hidden alt="Secret" /></a>
        <a href="/c" title="Titled &#39;Link&#39;"><svg aria-hidden="true"></svg></a>
        <a href="/svg-icon"><svg aria-hidden="true" />SVG Icon Link</a>
        <a href="/hex">It&#x27;s &#X27;ok&#X27; &#9999999; &#x110000; &constructor;</a>
        <a title="Safe" href=/>Root Link</a>
        <a href="/" />Slash Anchor</a>
        <a href=https://example.com/>External Root</a>
        <a href>Bare href</a>
        <span role="link" tabindex="0">Custom role link</span>
        <a data-href="/not-a-link">Not a real link</a>
      </aside>
    \`);
    const joined = html('<a href="/joined">' + 'Joined ' + 'Link</a>');
    function renderItems(links) {
      return links.map((link) => \`<li><a href="\${esc(link.href)}">\${esc(link.label)}</a></li>\`).join('');
    }
    function renderAuth(user) {
      return html(\`<div class="auth">\${user ? '<button>Sign out</button>' : '<a href="/login">Sign in</a>'}</div>\`);
    }
  `;
  const extracted = extractShellLinksFromSource(validSource, 'fixture.ts');
  assert.deepEqual(
    extracted.map((item) => item.label),
    [
      'Primary Action',
      'Aria Target',
      'Cross Fragment',
      'A &amp; B',
      'Override Label',
      'First Label',
      'Read & Write',
      'Visible',
      'Icon Guide',
      "Titled 'Link'",
      'SVG Icon Link',
      "It's 'ok' &#9999999; &#x110000; &constructor;",
      'Root Link',
      'Slash Anchor',
      'External Root',
      'Bare href',
      'Custom role link',
      'Joined Link',
      'Sign in',
    ],
  );

  // .html 経由のリンク抽出（HTML 本文＋インライン <script> 内 <a>＋非 JS script の無視）
  const htmlFixture = `<!doctype html>
    <html><body>
      <a href="/html-body">HTML Body Link</a>
      <script type="application/json">{"notJs": true}</script>
      <script>
        const linkHtml = '<a href="/inline-js">Inline Script Link</a>';
      </script>
    </body></html>`;
  assert.deepEqual(
    extractShellLinksFromSource(htmlFixture, 'index.html').map((item) => item.label),
    ['HTML Body Link', 'Inline Script Link'],
  );

  // HTML リンク抽出と DOM API 違反検査の責務独立性
  const domViolationWithLink = `
    document.createElement('dialog');
    el.setAttribute('role', 'status');
    const nav = html('<a href="/indep">Independent Link</a>');
  `;
  assert.deepEqual(
    extractShellLinksFromSource(domViolationWithLink, 'indep.ts').map((item) => item.label),
    ['Independent Link'],
  );
  assert.throws(() => checkShellForbiddenRolesInSource(domViolationWithLink, 'indep.ts'), /禁止要素 <dialog>/);

  for (const [name, badSource, pattern] of [
    ['unresolvable aria-labelledby', `const x = html('<a href="/x" aria-labelledby="missing">Text</a>');`, /aria-labelledby="missing"/],
    ['dynamic aria-labelledby', 'const x = html(`<a href="/x" aria-labelledby="${id}">Text</a>`);', /動的 aria-labelledby/],
    ['unknown dynamic link text (identifier)', 'const x = html(`<a href="/x">${esc(other)}</a>`);', /未知の動的リンク名/],
    ['unknown dynamic link text (wrong callee)', 'const x = html(`<a href="/x">${raw(link.label)}</a>`);', /未知の動的リンク名/],
    ['unknown dynamic link text (wrong object)', 'const x = html(`<a href="/x">${esc(other.label)}</a>`);', /未知の動的リンク名/],
    ['unknown dynamic link text (wrong property)', 'const x = html(`<a href="/x">${esc(link.href)}</a>`);', /未知の動的リンク名/],
    ['tag name interpolation on link', 'const x = html(`<a${cls} href="/x">Home</a>`);', /未知の動的属性展開/],
    ['empty static link', `const x = html('<a href="/x"><span aria-hidden="true">Icon</span></a>');`, /アクセシブル名のないリンク/],
  ]) {
    assert.throws(() => extractShellLinksFromSource(badSource, 'bad.ts'), pattern, `expected link extraction failure for ${name}`);
  }
});

test('checkShellForbiddenRolesInSource distinguishes clean shell patterns from forbidden roles and DOM APIs', () => {
  const cleanTs = `
    // role="status" <dialog> <output> document.createElement('dialog')
    /* <section aria-label="Commented"> */
    const re = /['"\`/*]/;
    const status = 'ok';
    const role = status;
    const found = document.querySelector('[role="dialog"]');
    const fn = <Output>(x: Output) => x;
    const node = q<Dialog>(document, '#x');
    el.role = null;
    el.role = '';
    el.role = \`note\`;
    el.setAttribute('role', 'button');
    el.setAttribute('role', 'but' + 'ton');
    el.setAttribute('role', ok ? 'alert' : 'button');
    el.setAttributeNS(null, 'role', 'button');
    document.createElement('div');
    document.createElement('a');
    document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const markup = html(\`
      <section data-title="ok" data-role="status" data-testid="auth-status" aria-label="  " title="">
        <!-- <dialog open></dialog> role="region" -->
        <div role="presentation" role="status" data-x=don't>ok</div>
        <div data-x="\${el.matches('[role="dialog"]') ? '1' : '0'}">\${result.status}</div>
      </section>
    \`);
  `;
  assert.doesNotThrow(() => checkShellForbiddenRolesInSource(cleanTs, 'clean.ts'));

  const cleanHtml = `<!doctype html>
    <!-- <dialog> role="status" -->
    <html><body>
      <div id="app" data-testid="auth-status"></div>
      <script type="application/json">{"role": "status", "notJs": true}</script>
      <script type="importmap">{"imports": {"app": "/app.js"}}</script>
      <script>
        // role="status" createElement('dialog')
        var theme = localStorage.getItem('theme');
      </script>
    </body></html>`;
  assert.doesNotThrow(() => checkShellForbiddenRolesInSource(cleanHtml, 'index.html'));

  for (const [name, filePath, badSource, pattern] of [
    ['double-quoted role="status"', 's.ts', `const x = html('<div role="status">ok</div>');`, /禁止ロール role="status"/],
    ['single-quoted role=region', 's.ts', `const x = html("<div role='region'>ok</div>");`, /禁止ロール role="region"/],
    ['unquoted role=dialog', 's.ts', `const x = html('<div role=dialog>ok</div>');`, /禁止ロール role="dialog"/],
    ['uppercase ROLE="STATUS"', 's.ts', `const x = html('<div ROLE="STATUS">ok</div>');`, /禁止ロール role="status"/],
    ['entity-encoded role status', 's.ts', `const x = html('<div role="&#115;tatus">ok</div>');`, /禁止ロール role="status"/],
    ['compound role list', 's.ts', `const x = html('<div role="alert status">ok</div>');`, /禁止ロール role="status"/],
    ['duplicate role first-wins', 's.ts', `const x = html('<div role="status" role="presentation">ok</div>');`, /禁止ロール role="status"/],
    ['dynamic role attribute', 's.ts', 'const x = html(`<div role="${r}">ok</div>`);', /動的 role 属性/],
    ['dynamic role with known nav expr', 's.ts', 'const x = html(`<div role="${esc(link.label)}">ok</div>`);', /動的 role 属性/],
    ['<output> tag', 's.ts', `const x = html('<output>0</output>');`, /禁止要素 <output>/],
    ['<dialog> tag', 's.ts', `const x = html('<dialog open>hi</dialog>');`, /禁止要素 <dialog>/],
    ['tag name interpolation <dialog${x}>', 's.ts', 'const x = html(`<dialog${open ? " open" : ""}>hi</dialog>`);', /未知の動的属性展開/],
    ['tag name interpolation <div${x} role="status">', 's.ts', 'const x = html(`<div${extra} role="status">hi</div>`);', /未知の動的属性展開/],
    ['dynamic tag name <${tag}>', 's.ts', 'const x = html(`<${tag}>hi</${tag}>`);', /動的タグ名/],
    ['attribute-position template expansion on div', 's.ts', 'const x = html(`<div ${cond ? \'role="status"\' : \'\'}>hi</div>`);', /未知の動的属性展開/],
    ['attribute-position template expansion on section', 's.ts', 'const x = html(`<section ${hasName ? \'aria-label="Panel"\' : \'\'}></section>`);', /未知の動的属性展開/],
    ['unquoted apostrophe before <dialog>', 's.ts', `const x = html("<div data-x=don't><dialog>hi</dialog></div>");`, /禁止要素 <dialog>/],
    ['unclosed ${ in plain string before <dialog>', 's.ts', `const x = '<div data-x=\${foo>ok</div><dialog>bad</dialog>';`, /禁止要素 <dialog>/],
    ['unclosed quote before <dialog>', 's.ts', `const x = '<div data-a="1 <dialog>hi</dialog>';`, /禁止要素 <dialog>/],
    ['unclosed tag before <dialog>', 's.ts', `const x = '<div data-a="1" <dialog>hi</dialog>';`, /禁止要素 <dialog>/],
    ['comment-like attribute value around role="status"', 's.ts', `const x = html('<div title="<!--" role="status" data-y="-->">hi</div>');`, /禁止ロール role="status"/],
    ['plus-concatenated role="status"', 's.ts', `const x = html('<div ' + 'role="status">hi</div>');`, /禁止ロール role="status"/],
    ['plus-concatenated <dialog>', 's.ts', `const x = html('<dialog' + '>hi</dialog>');`, /禁止要素 <dialog>/],
    ['plus-concatenated dynamic attribute', 's.ts', `const x = html('<div ' + expr + '>hi</div>');`, /未知の動的属性展開/],
    ['section aria-label', 's.ts', `const x = html('<section aria-label="Panel"></section>');`, /名前付き <section aria-label>/],
    ['section duplicate aria-label first-wins', 's.ts', `const x = html('<section aria-label="Panel" aria-label=""></section>');`, /名前付き <section aria-label>/],
    ['section aria-labelledby', 's.ts', `const x = html('<section aria-labelledby="h1"></section>');`, /名前付き <section aria-labelledby>/],
    ['section title', 's.ts', `const x = html('<section title="Info"></section>');`, /名前付き <section title>/],
    ['section dynamic aria-label', 's.ts', 'const x = html(`<section aria-label="${x}"></section>`);', /名前付き <section aria-label>/],
    ['syntax error TS source', 's.ts', 'const x = (;', /パースに失敗/],
    ['setAttribute role status', 's.ts', `el.setAttribute('role', 'status');`, /禁止ロール "status"/],
    ['setAttribute plus-concatenated role status', 's.ts', `el.setAttribute('role', 'stat' + 'us');`, /禁止ロール "status"/],
    ['setAttribute plus-concatenated dynamic role', 's.ts', `el.setAttribute('role', 'alert ' + roleVar);`, /未解決の動的 role/],
    ['optional call + TSAsExpression + uppercase ROLE', 's.ts', `(el?.setAttribute)?.('ROLE', 'alert dialog' as const);`, /禁止ロール "dialog"/],
    ['TSTypeAssertion in setAttribute', 's.ts', `el.setAttribute(<const>'role', <string>'status');`, /禁止ロール "status"/],
    ['setAttributeNS role status', 's.ts', `el.setAttributeNS(null, 'ROLE', 'status');`, /禁止ロール "status"/],
    ['setAttributeNS dynamic role', 's.ts', `el.setAttributeNS(null, 'role', roleVar);`, /未解決の動的 role/],
    ['computed setAttribute with template literal', 's.ts', "el['setAttribute']('role', `status`);", /禁止ロール "status"/],
    ['setAttribute dynamic template literal', 's.ts', 'el.setAttribute("role", `${r}`);', /未解決の動的 role/],
    ['setAttribute conditional consequent forbidden', 's.ts', `el.setAttribute('role', isErr ? 'status' : 'alert');`, /禁止ロール "status"/],
    ['setAttribute conditional alternate forbidden', 's.ts', `el.setAttribute('role', isErr ? 'alert' : 'status');`, /禁止ロール "status"/],
    ['setAttribute null value', 's.ts', `el.setAttribute('role', null);`, /不正な role 値/],
    ['setAttribute dynamic variable', 's.ts', `el.setAttribute('role', roleVar);`, /未解決の動的 role/],
    ['el.role assignment', 's.ts', `el.role = 'region';`, /禁止ロール "region"/],
    ['el.role numeric assignment', 's.ts', `el.role = 123;`, /不正な role 値/],
    ['computed el["role"] template assignment', 's.ts', "el['role'] = `dialog`;", /禁止ロール "dialog"/],
    ['createElement with satisfies and non-null assertion', 's.ts', `document.createElement(('dialog' satisfies string)!);`, /禁止要素 <dialog>/],
    ['createElement with TSTypeAssertion', 's.ts', `document.createElement(<string>'dialog');`, /禁止要素 <dialog>/],
    ['createElement with plus-concatenated tag', 's.ts', `document.createElement('dia' + 'log');`, /禁止要素 <dialog>/],
    ['createElement conditional consequent forbidden', 's.ts', `document.createElement(ok ? 'dialog' : 'div');`, /禁止要素 <dialog>/],
    ['createElement conditional alternate forbidden', 's.ts', `document.createElement(ok ? 'div' : 'output');`, /禁止要素 <output>/],
    ['createElement dynamic variable', 's.ts', `document.createElement(tagVar);`, /未解決の動的要素/],
    ['createElement dynamic template', 's.ts', 'document.createElement(`${tag}`);', /未解決の動的要素/],
    ['optional createElement uppercase template', 's.ts', 'document?.createElement(`OUTPUT`);', /禁止要素 <output>/],
    ['createElementNS dialog', 's.ts', `document.createElementNS('http://www.w3.org/1999/xhtml', 'dialog');`, /禁止要素 <dialog>/],
    ['createElementNS dynamic variable', 's.ts', `document.createElementNS('http://www.w3.org/1999/xhtml', tagVar);`, /未解決の動的要素/],
    ['inline script in index.html', 'index.html', `<html><body><script>document.createElement('dialog');</script></body></html>`, /禁止要素 <dialog>/],
    ['inline script with text/javascript type', 'index.html', `<html><body><script type="text/javascript">document.createElement('dialog');</script></body></html>`, /禁止要素 <dialog>/],
    ['inline script containing comment-like strings', 'index.html', `<html><body><script>const a = '<!--'; document.createElement('dialog'); const b = '-->';</script></body></html>`, /禁止要素 <dialog>/],
    ['unclosed script tag in index.html', 'index.html', `<html><body><script>document.createElement('dialog');</body></html>`, /<script> タグが閉じられていません/],
    ['comment-like attribute in index.html', 'index.html', `<html><body><div title="<!--" role="status" data-y="-->">hi</div></body></html>`, /禁止ロール role="status"/],
    ['dialog tag in index.html', 'index.html', `<html><body><dialog></dialog></body></html>`, /禁止要素 <dialog>/],
  ]) {
    assert.throws(() => checkShellForbiddenRolesInSource(badSource, filePath), pattern, `expected shell role failure for ${name}`);
  }
});

test('WCAG luminance, contrastRatio, boundaries, CSS parsing, dark parity, and token coverage detect mutations', () => {
  // 原色輝度・黒白・同色・対称性・3桁 hex・不正 hex
  assert.equal(relativeLuminance('#ff0000'), 0.2126);
  assert.equal(relativeLuminance('#00ff00'), 0.7152);
  assert.equal(relativeLuminance('#0000ff'), 0.0722);
  assert.equal(contrastRatio('#000000', '#ffffff'), 21);
  assert.equal(contrastRatio('#fff', '#ffffff'), 1);
  assert.equal(relativeLuminance('#1a9'), relativeLuminance('#11aa99'));
  assert.equal(contrastRatio('#4f46e5', '#f4f5f9'), contrastRatio('#f4f5f9', '#4f46e5'));
  assert.throws(() => parseHexColor('rgb(0,0,0)'), /不正な hex/);
  assert.throws(() => parseHexColor('prefix #ffffff'), /不正な hex/);
  assert.throws(() => parseHexColor('#12345678'), /不正な hex/);

  // 低輝度線形区間境界（#0a0a0a は <= 0.04045、#0b0b0b は > 0.04045。分岐反転の差は 7.5e-7 / 7.7e-6 のため 1e-9 で検証）
  const expected0a = (10 / 255) / 12.92;
  const expected0b = (((11 / 255) + 0.055) / 1.055) ** 2.4;
  assert.ok(Math.abs(relativeLuminance('#0a0a0a') - expected0a) < 1e-9);
  assert.ok(Math.abs(relativeLuminance('#0b0b0b') - expected0b) < 1e-9);

  // AA 4.5:1 および 1.4.11 3.0:1 の境界値（直上・直下・厳密等号 >= vs >）
  assert.doesNotThrow(() => checkPaletteContrast({ '--fg': '#757778', '--bg': '#ffffff' }, [{ fg: '--fg', bg: '--bg', minRatio: WCAG_AA_TEXT }], 'aa-pass'));
  assert.throws(() => checkPaletteContrast({ '--fg': '#767776', '--bg': '#ffffff' }, [{ fg: '--fg', bg: '--bg', minRatio: WCAG_AA_TEXT }], 'aa-fail'), /基準 4\.5:1 未満/);

  const exactRatio = contrastRatio('#767676', '#ffffff');
  assert.doesNotThrow(() => checkPaletteContrast({ '--fg': '#767676', '--bg': '#ffffff' }, [{ fg: '--fg', bg: '--bg', minRatio: exactRatio }], 'exact-pass'));
  assert.throws(() => checkPaletteContrast({ '--fg': '#767676', '--bg': '#ffffff' }, [{ fg: '--fg', bg: '--bg', minRatio: exactRatio + 1e-9 }], 'exact-fail'), /未満/);

  assert.doesNotThrow(() => checkPaletteContrast({ '--b': '#929692', '--bg': '#ffffff' }, [{ fg: '--b', bg: '--bg', minRatio: WCAG_NON_TEXT }], 'nt-pass'));
  assert.throws(() => checkPaletteContrast({ '--b': '#959594', '--bg': '#ffffff' }, [{ fg: '--b', bg: '--bg', minRatio: WCAG_NON_TEXT }], 'nt-fail'), /基準 3:1 未満/);

  assert.throws(() => checkPaletteContrast({ '--fg': '#000000' }, [], 'empty-pairs'), /0 件/);
  assert.throws(() => checkPaletteContrast({ '--bg': '#ffffff' }, [{ fg: '--fg', bg: '--bg', minRatio: 4.5 }], 'missing-fg'), /前景トークン/);
  assert.throws(() => checkPaletteContrast({ '--fg': '#000000' }, [{ fg: '--fg', bg: '--bg', minRatio: 4.5 }], 'missing-bg'), /背景トークン/);

  // CSS パース・重複ブロック上書き・表記揺れ・クォート・Dark マージ後 var() 解決・多段・フォールバック・独立性
  const cssFixture = `
    /* :root { --fg: #ffffff; } */
    :root {
      --font-sans: 'IBM Plex Sans', sans-serif;
      --quoted-var: 'myvar(foo)' "var(--nope)";
      --ident-var: myvar(foo);
      --surface: #ffffff;
      --fg: #111111;
      --FG: #333333;
      --bg: var(--surface);
      --upper-var: VAR(--surface);
      --chain: var(--bg);
      --with-fallback: var(--missing-token, #222222);
      --nested-fallback: var(--missing-token, var(--surface));
    }
    :root {
      --fg: #1b1f2a;
    }
    @media screen and (prefers-color-scheme:dark) {
      :root:not( [data-theme = "light"] ) {
        color-scheme: dark;
        --surface: #171a23;
        --fg: #e7e9f0;
        --shadow: 0 1px 2px rgb(0 0 0 / 40%),
          0 2px 4px rgb(0 0 0 / 20%);
      }
    }
    :root[data-theme="dark"] {
      color-scheme: dark;
      --surface: #171a23;
      --fg: #e7e9f0;
      --shadow: 0 1px 2px rgb(0 0 0 / 40%), 0 2px 4px rgb(0 0 0 / 20%);
    }
  `;
  const parsed = parseTokenPalettes(cssFixture);
  assert.equal(parsed.light['--fg'], '#1b1f2a');
  assert.equal(parsed.light['--FG'], '#333333');
  assert.equal(parsed.light['--bg'], '#ffffff');
  assert.equal(parsed.light['--upper-var'], '#ffffff');
  assert.equal(parsed.light['--quoted-var'], `'myvar(foo)' "var(--nope)"`);
  assert.equal(parsed.light['--ident-var'], 'myvar(foo)');
  assert.equal(parsed.darkMedia['--bg'], '#171a23');
  assert.equal(parsed.darkAttr['--bg'], '#171a23');
  assert.equal(parsed.darkMedia['--chain'], '#171a23');
  assert.equal(parsed.light['--with-fallback'], '#222222');
  assert.equal(parsed.light['--nested-fallback'], '#ffffff');
  assert.equal(parsed.darkMedia['--nested-fallback'], '#171a23');
  assert.doesNotThrow(() => checkDarkBlocksParity(parsed.darkMediaRaw, parsed.darkAttrRaw));

  // Dark 2 ブロック独立パース検証（片方だけ改変したとき対応パレットのみ変わる）
  const splitDark = cssFixture.replace(':root[data-theme="dark"] {\n      color-scheme: dark;\n      --surface: #171a23;', ':root[data-theme="dark"] {\n      color-scheme: dark;\n      --surface: #101218;');
  const parsedSplit = parseTokenPalettes(splitDark);
  assert.equal(parsedSplit.darkMedia['--surface'], '#171a23');
  assert.equal(parsedSplit.darkAttr['--surface'], '#101218');
  assert.throws(() => checkDarkBlocksParity(parsedSplit.darkMediaRaw, parsedSplit.darkAttrRaw), /値が異なります/);

  // ブロック欠落・空ブロック・未知ルール・構文異常・循環参照・未定義 var()
  assert.throws(() => parseTokenPalettes(`@media (prefers-color-scheme: dark) { :root:not([data-theme='light']) { --a: #000; } } :root[data-theme='dark'] { --a: #000; }`), /Light/);
  assert.throws(() => parseTokenPalettes(`:root {} @media (prefers-color-scheme: dark) { :root:not([data-theme='light']) { --a: #000; } } :root[data-theme='dark'] { --a: #000; }`), /Light/);
  assert.throws(() => parseTokenPalettes(`:root { --a: #fff; } :root[data-theme='dark'] { --a: #000; }`), /@media/);
  assert.throws(() => parseTokenPalettes(`:root { --a: #fff; } @media (prefers-color-scheme: dark) { :root:not([data-theme='light']) {} } :root[data-theme='dark'] { --a: #000; }`), /@media/);
  assert.throws(() => parseTokenPalettes(`:root { --a: #fff; } @media (prefers-color-scheme: dark) { :root:not([data-theme='light']) { --a: #000; } }`), /\[data-theme='dark'\]/);
  assert.throws(() => parseTokenPalettes(`:root { --a: #fff; } @media (prefers-color-scheme: dark) { :root:not([data-theme='light']) { --a: #000; } } :root[data-theme='dark'] {}`), /\[data-theme='dark'\]/);
  assert.throws(() => parseTokenPalettes(`${cssFixture}\n[data-theme='dark'] { --fg: #181818; }`), /想定外のルール/);
  assert.throws(() => parseTokenPalettes(`:root { --a: #fff; } @media not (prefers-color-scheme: dark) { :root:not([data-theme='light']) { --a: #000; } } :root[data-theme='dark'] { --a: #000; }`), /想定外のルール/);
  assert.throws(() => parseTokenPalettes(`:root { --a: #fff; } @media (prefers-color-scheme: dark) { :root { --a: #000; } } :root[data-theme='dark'] { --a: #000; }`), /想定外のセレクタ/);
  assert.throws(() => parseTokenPalettes(':root { /* unclosed --a: #fff; }'), /コメントが閉じられていません/);
  assert.throws(() => parseTokenPalettes(':root { --a: #fff;'), /波括弧が閉じられていません/);
  assert.throws(() => parseTokenPalettes(':root { --a: #fff; } stray'), /ブロック "\{" がありません/);
  assert.throws(() => parseTokenPalettes(':root { --a: #fff; } @import "x.css";'), /ブロックのない文/);
  assert.throws(() => splitTopLevelCssRules(":root[data-theme='dark] { --a: #fff; }"), /クォートが閉じられていません/);
  assert.throws(() => splitTopLevelCssRules(":root { --a: 'unclosed; }"), /クォートが閉じられていません/);
  assert.throws(() => parseTokenPalettes(':root { --a #fff; }'), /不正な CSS 宣言/);
  assert.throws(() => parseTokenPalettes(':root { : #fff; }'), /プロパティ名が空/);
  assert.throws(() => parseTokenPalettes(':root { --a: ; }'), /値が空/);
  assert.throws(() => parseTokenPalettes(':root { --s: rgb(0 0 0 / 6%; --b: #fff; }'), /括弧 "\(" が閉じられていません/);
  assert.throws(() => parseTokenPalettes(':root { --s: rgb(0 0 0)); }'), /余剰な閉じ括弧/);
  assert.throws(() => parseTokenPalettes(":root { --f: 'unclosed; }"), /クォートが閉じられていません/);
  assert.throws(() => parseCssDeclarations("--f: 'unclosed;"), /クォートが閉じられていません/);
  assert.throws(() => resolvePaletteVars({ '--a': 'var(--b' }), /var\(\) の括弧が閉じられていません/);
  assert.throws(() => resolvePaletteVars({ '--a': 'var(--b)', '--b': 'var(--a)' }), /循環参照/);
  assert.throws(() => resolvePaletteVars({ '--a': 'var(--nope)' }), /未定義/);

  // Dark パリティ双方向差分・タイポ宣言・空ブロック（片側空含む）
  const baseDark = { 'color-scheme': 'dark', '--fg': '#e7e9f0' };
  assert.throws(() => checkDarkBlocksParity({ ...baseDark, '--only-media': '#111111' }, baseDark), /不足/);
  assert.throws(() => checkDarkBlocksParity(baseDark, { ...baseDark, '--only-attr': '#111111' }), /不足/);
  assert.throws(() => checkDarkBlocksParity(baseDark, { ...baseDark, 'color-scheme': 'light' }), /値が異なります/);
  assert.throws(() => checkDarkBlocksParity(baseDark, { ...baseDark, '-fg': '#ffffff' }), /不足/);
  assert.throws(() => checkDarkBlocksParity({}, {}), /空です/);
  assert.throws(() => checkDarkBlocksParity({}, baseDark), /空です/);
  assert.throws(() => checkDarkBlocksParity(baseDark, {}), /空です/);

  // トークン網羅性メタチェック（色 0 件・非対応色形式・!important・非色トークンの非誤検知）
  const singlePair = [{ fg: '--fg', bg: '--bg', minRatio: 4.5 }];
  assert.doesNotThrow(() =>
    checkTokenCoverage(
      {
        '--fg': '#000000',
        '--bg': '#ffffff',
        '--border': '#cccccc',
        '--shadow': '0 1px 2px rgb(0 0 0 / 40%)',
        '--font-sans': "'IBM Plex Sans', sans-serif",
      },
      singlePair,
      new Set(['--border']),
      'cov-ok',
    ),
  );
  assert.throws(() => checkTokenCoverage({ color: '#000000', '--space-1': '4px', '--shadow': '0 1px 2px rgb(0 0 0 / 40%)' }, singlePair, new Set(), 'cov-zero'), /色トークンが 0 件/);
  assert.throws(() => checkTokenCoverage({ '--fg': '#000000', '--bg': '#ffffff', '--brand-new': '#123456' }, singlePair, new Set(), 'cov-fail'), /--brand-new/);
  assert.throws(() => checkTokenCoverage({ '--fg': '#000000', '--bg': '#ffffff', '--brand-rgb': 'rgb(250 250 250)' }, singlePair, new Set(), 'cov-rgb'), /--brand-rgb/);
  assert.throws(() => checkTokenCoverage({ '--fg': '#000000', '--bg': '#ffffff', '--brand-oklch': 'oklch(0.95 0 0)' }, singlePair, new Set(), 'cov-oklch'), /--brand-oklch/);
  assert.throws(() => checkTokenCoverage({ '--fg': '#000000', '--bg': '#ffffff', '--brand-hex4': '#f0a8' }, singlePair, new Set(), 'cov-hex4'), /--brand-hex4/);
  assert.throws(() => checkTokenCoverage({ '--fg': '#000000', '--bg': '#ffffff', '--brand-alpha': '#12345678' }, singlePair, new Set(), 'cov-hex8'), /--brand-alpha/);
  assert.throws(() => checkTokenCoverage({ '--fg': '#000000', '--bg': '#ffffff', '--brand-imp': '#fafafa !important' }, singlePair, new Set(), 'cov-imp'), /--brand-imp/);
  assert.throws(() => checkTokenCoverage({ '--fg': 'rgb(0 0 0)', '--bg': '#ffffff' }, singlePair, new Set(), 'cov-unsupported-rgb'), /非対応の色形式/);
  assert.throws(() => checkTokenCoverage({ '--fg': '#00000080', '--bg': '#ffffff' }, singlePair, new Set(), 'cov-unsupported-hex8'), /非対応の色形式/);
  assert.throws(() => checkTokenCoverage({ '--fg': '#000000 !important', '--bg': '#ffffff' }, singlePair, new Set(), 'cov-unsupported-imp'), /非対応の色形式/);
});
