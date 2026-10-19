export type MarkdownBlock =
    | { type: 'heading'; level: number; text: string }
    | { type: 'paragraph'; text: string }
    | { type: 'list'; ordered: boolean; start: number; items: string[] }
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
            && !/^\s*(?:[-*]\s+|\d+\.\s+)/.test(lines[index])) paragraph.push(lines[index++]);
        blocks.push({ type: 'paragraph', text: paragraph.join('\n') });
    }
    return blocks;
}
