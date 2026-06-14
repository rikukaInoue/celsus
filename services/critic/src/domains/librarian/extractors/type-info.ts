import ts from 'typescript';
import { registerExtractor } from './interface.js';
import type { ReviewInput, ExtractedContext } from '../../../core/types.js';

function extractTypeInfo(sourceCode: string, fileName = 'input.ts'): string[] {
  const sourceFile = ts.createSourceFile(fileName, sourceCode, ts.ScriptTarget.Latest, true);
  const typeInfo: string[] = [];

  function visit(node: ts.Node) {
    if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) {
      const name = node.name?.getText(sourceFile) ?? 'anonymous';
      const params = (node.parameters ?? []).map(p => {
        const pName = p.name.getText(sourceFile);
        const pType = p.type?.getText(sourceFile) ?? 'any';
        return `${pName}: ${pType}`;
      });
      const returnType = node.type?.getText(sourceFile) ?? 'void';
      typeInfo.push(`${name}(${params.join(', ')}): ${returnType}`);
    } else if (ts.isTypeAliasDeclaration(node)) {
      typeInfo.push(node.getText(sourceFile));
    } else if (ts.isInterfaceDeclaration(node)) {
      const members = node.members.map(m => {
        if (ts.isPropertySignature(m)) {
          const name = m.name.getText(sourceFile);
          const type = m.type?.getText(sourceFile) ?? 'unknown';
          return `  ${name}: ${type}`;
        }
        return `  ${m.getText(sourceFile)}`;
      });
      typeInfo.push(`interface ${node.name.getText(sourceFile)} {\n${members.join('\n')}\n}`);
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return typeInfo;
}

registerExtractor('type_info', (weight) => ({
  id: 'type_info',
  type: 'code',
  weight,
  async extract(input: ReviewInput): Promise<ExtractedContext | null> {
    if (!input.content.trim()) return null;

    const types = extractTypeInfo(input.content, input.filePath);
    if (types.length === 0) return null;

    const content = types.join('\n\n');
    return {
      extractorId: 'type_info',
      type: 'code',
      content,
      metadata: {
        symbols: types.map(t => t.split(/[\s({]/)[0] ?? t.slice(0, 20)),
      },
      tokenEstimate: Math.ceil(content.length / 4),
    };
  },
}));
