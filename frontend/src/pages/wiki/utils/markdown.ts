export type MarkdownBlock =
    | { type: 'heading'; level: number; text: string }
    | { type: 'paragraph'; text: string }
    | { type: 'list'; ordered: boolean; start: number; items: string[] }
    | { type: 'quote'; text: string }
    | { type: 'divider' }
    | { type: 'table'; headers: string[]; rows: string[][] }
    | { type: 'code'; language: string; text: string };

export function parseMarkdown(content: string): MarkdownBlock[] {
    const lines = content.replace(/\r\n?/g, '\n').split('\n');
    const blocks: MarkdownBlock[] = [];
    let index = 0;
    while (index < lines.length) {
        const line = lines[index];
        if (!line.trim()) { index++; continue; }
        const fence = line.match(/^\s*```([^`]*)$/);
        if (fence) {
            index++;
            const code: string[] = [];
            while (index < lines.length && !/^\s*```\s*$/.test(lines[index])) code.push(lines[index++]);
            if (index < lines.length) index++;
            blocks.push({ type: 'code', language: fence[1].trim(), text: code.join('\n') });
            continue;
        }
        const heading = line.match(/^(#{1,3})\s+(.+)$/);
        if (heading) { blocks.push({ type: 'heading', level: heading[1].length, text: heading[2] }); index++; continue; }
        if (/^\s*---+\s*$/.test(line)) { blocks.push({ type: 'divider' }); index++; continue; }
        if (/^>\s?/.test(line)) {
            const quote: string[] = [];
            while (index < lines.length && /^>\s?/.test(lines[index])) quote.push(lines[index++].replace(/^>\s?/, ''));
            blocks.push({ type: 'quote', text: quote.join('\n') }); continue;
        }
        const cells = (row: string) => row.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(cell => cell.trim());
        if (line.includes('|') && index + 1 < lines.length && cells(lines[index + 1]).length === cells(line).length && cells(lines[index + 1]).every(cell => /^:?-{3,}:?$/.test(cell))) {
            const headers = cells(line); const rows: string[][] = []; index += 2;
            while (index < lines.length && lines[index].includes('|') && lines[index].trim()) {
                const values = cells(lines[index++]); rows.push(headers.map((_, column) => values[column] ?? ''));
            }
            blocks.push({ type: 'table', headers, rows }); continue;
        }
        const item = line.match(/^\s*(?:([-*])\s+|(\d+)\.\s+)(.+)$/);
        if (item) {
            const ordered = !!item[2];
            const items: string[] = [];
            const number = Number(item[2]);
            const start = ordered && Number.isSafeInteger(number) ? number : 1;
            while (index < lines.length) {
                const next = lines[index].match(/^\s*(?:([-*])\s+|(\d+)\.\s+)(.+)$/);
                if (!next || !!next[2] !== ordered) break;
                items.push(next[3]);
                index++;
            }
            blocks.push({ type: 'list', ordered, start, items });
            continue;
        }
        const paragraph = [line];
        index++;
        while (index < lines.length && lines[index].trim()
            && !/^\s*```/.test(lines[index]) && !/^#{1,3}\s+/.test(lines[index])
            && !/^>\s?/.test(lines[index]) && !/^\s*---+\s*$/.test(lines[index])
            && !/^\s*(?:[-*]\s+|\d+\.\s+)/.test(lines[index])) paragraph.push(lines[index++]);
        blocks.push({ type: 'paragraph', text: paragraph.join('\n') });
    }
    return blocks;
}

export type InlinePart = { type: 'text' | 'strong' | 'emphasis' | 'code'; text: string } | { type: 'link'; text: string; href: string };
export function parseInlineMarkdown(text: string): InlinePart[] {
    const pattern = /(`[^`\n]+`|\*\*[^*\n]+\*\*|\*[^*\n]+\*|\[[^\]\n]+\]\([^\s)]+\))/g;
    const parts: InlinePart[] = []; let end = 0;
    for (const match of text.matchAll(pattern)) {
        const start = match.index!; const token = match[0];
        if (start > end) parts.push({ type: 'text', text: text.slice(end, start) });
        if (token.startsWith('`')) parts.push({ type: 'code', text: token.slice(1, -1) });
        else if (token.startsWith('**')) parts.push({ type: 'strong', text: token.slice(2, -2) });
        else if (token.startsWith('*')) parts.push({ type: 'emphasis', text: token.slice(1, -1) });
        else {
            const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/)!;
            if (/^(https?:\/\/|mailto:)/i.test(link[2])) parts.push({ type: 'link', text: link[1], href: link[2] });
            else parts.push({ type: 'text', text: token });
        }
        end = start + token.length;
    }
    if (end < text.length) parts.push({ type: 'text', text: text.slice(end) });
    return parts;
}
