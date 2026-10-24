import styled from 'styled-components';
import { parseInlineMarkdown, parseMarkdown } from '../utils/markdown';

const Content = styled.div`
    line-height: 1.75;
    overflow-wrap: anywhere;
    h2, h3, h4 { margin: 24px 0 12px; line-height: 1.4; }
    p { white-space: pre-wrap; margin: 14px 0; }
    ul, ol { padding-left: 24px; margin: 14px 0; }
    li { margin: 6px 0; }
    pre { padding: 16px; border-radius: 8px; background: ${({ theme }) => theme.colors.content}; overflow-x: auto; margin: 16px 0; }
    code { font-family: Consolas, 'Courier New', monospace; white-space: pre; }
    h2, h3, h4 { scroll-margin-top: 24px; }
    :not(pre) > code { padding: 2px 5px; background: ${({ theme }) => theme.colors.content}; border-radius: 4px; white-space: pre-wrap; }
    a { color: ${({ theme }) => theme.colors.primary}; }
    blockquote { border-left: 3px solid ${({ theme }) => theme.colors.primary}; padding: 12px 18px; margin: 18px 0; background: ${({ theme }) => theme.colors.primarySubtle}; white-space: pre-wrap; }
    hr { border: 0; border-top: 1px solid ${({ theme }) => theme.colors.border}; margin: 26px 0; }
    table { border-collapse: collapse; width: 100%; margin: 18px 0; font-size: 13px; }
    th, td { border: 1px solid ${({ theme }) => theme.colors.border}; padding: 10px 12px; text-align: left; }
    th { background: ${({ theme }) => theme.colors.content}; }
    .table-scroll { overflow: auto; }
`;

function inline(text: string) {
    return parseInlineMarkdown(text).map((part, index) => part.type === 'strong' ? <strong key={index}>{part.text}</strong>
        : part.type === 'emphasis' ? <em key={index}>{part.text}</em> : part.type === 'code' ? <code key={index}>{part.text}</code>
        : part.type === 'link' ? <a key={index} href={part.href} target="_blank" rel="noopener noreferrer">{part.text}</a> : part.text);
}
export default function ArticleContent({ content, idPrefix = 'wiki-preview' }: { content: string; idPrefix?: string }) {
    return (
        <Content>
            {parseMarkdown(content).map((block, index) => {
                if (block.type === 'heading') {
                    if (block.level === 1) return <h2 id={`${idPrefix}-${index}`} key={index}>{inline(block.text)}</h2>;
                    if (block.level === 2) return <h3 id={`${idPrefix}-${index}`} key={index}>{inline(block.text)}</h3>;
                    return <h4 id={`${idPrefix}-${index}`} key={index}>{inline(block.text)}</h4>;
                }
                if (block.type === 'code') return <pre key={index}><code aria-label={block.language ? `Code (${block.language})` : 'Code'}>{block.text}</code></pre>;
                if (block.type === 'list') {
                    const items = block.items.map((text, itemIndex) => <li key={itemIndex}>{inline(text)}</li>);
                    return block.ordered ? <ol key={index} start={block.start}>{items}</ol> : <ul key={index}>{items}</ul>;
                }
                if (block.type === 'divider') return <hr key={index} />;
                if (block.type === 'quote') return <blockquote key={index}>{inline(block.text)}</blockquote>;
                if (block.type === 'table') return <div key={index} className="table-scroll"><table><thead><tr>{block.headers.map((header, column) => <th key={column} scope="col">{inline(header)}</th>)}</tr></thead>
                    <tbody>{block.rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, column) => <td key={column}>{inline(cell)}</td>)}</tr>)}</tbody></table></div>;
                return <p key={index}>{inline(block.text)}</p>;
            })}
        </Content>
    );
}
