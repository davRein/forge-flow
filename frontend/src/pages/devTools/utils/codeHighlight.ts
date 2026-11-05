import type { CodeLanguage } from '../../../services/developer/developer';
export type CodeToken = { text: string; kind: 'plain' | 'keyword' | 'string' | 'comment' | 'number' };
const words: Partial<Record<CodeLanguage, string>> = {
    sql: 'select from where join inner left right outer on as and or not null true false insert into values update set delete create alter drop table index view function procedure begin end return returns language if else then loop case when distinct group by order having limit offset with union all primary key references default grant revoke commit rollback do declare raise returning conflict exists count sum asc desc',
    python: 'def class import from as return if elif else for while in is not and or None True False try except finally raise with async await yield lambda pass break continue',
    bash: 'if then else fi for do done case esac function in export local return exit echo',
    json: 'true false null',
};
const common = 'const let var function class interface type enum public private protected static final void new return if else for while switch case break continue try catch finally throw throws import export from default async await extends implements package namespace using true false null undefined int string boolean double long val fun fn struct impl use mod pub mut self this';
// Lexical highlighting only. React renders every token as text; source is never HTML.
export function highlightCode(source: string, language: CodeLanguage): CodeToken[] {
    if (language === 'plaintext') return [{ text: source, kind: 'plain' }];
    const keywords = new Set((words[language] ?? common).split(' '));
    const pattern = language === 'sql' ? /(--[^\n]*|\/\*[\s\S]*?\*\/|'(?:''|[^'])*'|"(?:""|[^"])*"|\b\d+(?:\.\d+)?\b|\b[A-Za-z_]\w*\b)/g
        : language === 'python' || language === 'bash' ? /(# [^\n]*|#[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b\d+(?:\.\d+)?\b|\b[A-Za-z_]\w*\b)/g
        : /(\/\/[^\n]*|\/\*[\s\S]*?\*\/|<!--[^]*?-->|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\b\d+(?:\.\d+)?\b|\b[A-Za-z_]\w*\b)/g;
    const result: CodeToken[] = []; let cursor = 0;
    for (const match of source.matchAll(pattern)) {
        const start = match.index!; if (start > cursor) result.push({ text: source.slice(cursor, start), kind: 'plain' });
        const text = match[0];
        const kind: CodeToken['kind'] = /^(\/\/|\/\*|--|#|<!--)/.test(text) ? 'comment' : /^['"`]/.test(text) ? 'string' : /^\d/.test(text) ? 'number' : keywords.has(language === 'sql' ? text.toLowerCase() : text) ? 'keyword' : 'plain';
        result.push({ text, kind }); cursor = start + text.length;
    }
    if (cursor < source.length) result.push({ text: source.slice(cursor), kind: 'plain' });
    return result;
}
