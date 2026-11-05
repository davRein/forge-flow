import { useMemo } from 'react';
import styled from 'styled-components';
import { highlightCode } from '../utils/codeHighlight';
import type { CodeLanguage } from '../../../services/developer/developer';
const Preview = styled.pre`
    max-height: 360px; overflow: auto; white-space: pre; padding: 14px; margin: 10px 0;
    font: 12px/1.6 'Cascadia Code', Consolas, monospace; border-radius: 6px;
    color: ${({ theme }) => theme.colors.text}; background: ${({ theme }) => theme.colors.content};
    border: 1px solid ${({ theme }) => theme.colors.border};
    .keyword { color: ${({ theme }) => theme.colors.primary}; font-weight: 600; }
    .string { color: ${({ theme }) => theme.colors.success}; }
    .comment { color: ${({ theme }) => theme.colors.textSecondary}; font-style: italic; }
    .number { color: ${({ theme }) => theme.colors.primary}; }
`;
export default function CodePreview({ code, language }: { code: string; language: CodeLanguage }) {
    const tokens = useMemo(() => highlightCode(code, language), [code, language]);
    return <Preview><code>{tokens.map((token, index) => <span key={index} className={token.kind}>{token.text}</span>)}</code></Preview>;
}
