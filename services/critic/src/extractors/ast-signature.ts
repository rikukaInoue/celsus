import ts from 'typescript';
import { registerExtractor } from './interface.js';
import type { Extractor, ReviewInput, ExtractedContext } from '../core/types.js';

function extractSignatures(sourceCode: string, fileName = 'input.ts'): string[] {
  const sourceFile = ts.createSourceFile(fileName, sourceCode, ts.ScriptTarget.Latest, true);
  const signatures: string[] = [];

  function visit(node: ts.Node) {
    if (ts.isFunctionDeclaration(node) && node.name) {
      signatures.push(node.getText(sourceFile));
    } else if (ts.isMethodDeclaration(node) && node.name) {
      signatures.push(node.getText(sourceFile));
    } else if (ts.isInterfaceDeclaration(node)) {
      signatures.push(node.getText(sourceFile));
    } else if (ts.isTypeAliasDeclaration(node)) {
      signatures.push(node.getText(sourceFile));
    } else if (ts.isClassDeclaration(node) && node.name) {
      const header = `class ${node.name.getText(sourceFile)}`;
      const heritage = node.heritageClauses?.map(h => h.getText(sourceFile)).join(' ') ?? '';
      signatures.push(`${header} ${heritage}`.trim());
    } else if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        if (decl.type && ts.isArrowFunction(decl.initializer ?? ({} as ts.Node))) {
          signatures.push(decl.getText(sourceFile));
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return signatures;
}

registerExtractor('ast_signature', (weight) => ({
  id: 'ast_signature',
  type: 'code',
  weight,
  async extract(input: ReviewInput): Promise<ExtractedContext | null> {
    if (!input.content.trim()) return null;

    const signatures = extractSignatures(input.content, input.filePath);
    if (signatures.length === 0) return null;

    const content = signatures.join('\n\n');
    return {
      extractorId: 'ast_signature',
      type: 'code',
      content,
      metadata: {
        symbols: signatures.map(s => s.split(/[\s(:{]/)[1] ?? s.slice(0, 30)),
      },
      tokenEstimate: Math.ceil(content.length / 4),
    };
  },
}));
