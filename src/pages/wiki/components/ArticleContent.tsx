import styled from 'styled-components';
import { parseMarkdown } from '../utils/markdown';

const Content = styled.div`
    line-height: 1.75;
    overflow-wrap: anywhere;
    h2, h3, h4 { margin: 24px 0 12px; line-height: 1.4; }
    p { white-space: pre-wrap; margin: 14px 0; }
    ul, ol { padding-left: 24px; margin: 14px 0; }
    li { margin: 6px 0; }
    pre { padding: 16px; border-radius: 8px; background: ${({ theme }) => theme.colors.content}; overflow-x: auto; margin: 16px 0; }
    code { font-family: Consolas, 'Courier New', monospace; white-space: pre; }
`;

export default function ArticleContent({ content }: { content: string }) {
    return (
        <Content>
            {parseMarkdown(content).map((block, index) => {
                if (block.type === 'heading') {
                    if (block.level === 1) return <h2 key={index}>{block.text}</h2>;
                    if (block.level === 2) return <h3 key={index}>{block.text}</h3>;
                    return <h4 key={index}>{block.text}</h4>;
                }
                if (block.type === 'code') return <pre key={index}><code aria-label={block.language ? `Code (${block.language})` : 'Code'}>{block.text}</code></pre>;
                if (block.type === 'list') {
                    const items = block.items.map((text, itemIndex) => <li key={itemIndex}>{text}</li>);
                    return block.ordered ? <ol key={index} start={block.start}>{items}</ol> : <ul key={index}>{items}</ul>;
                }
                return <p key={index}>{block.text}</p>;
            })}
        </Content>
    );
}
