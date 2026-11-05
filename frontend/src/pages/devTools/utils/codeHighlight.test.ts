import { highlightCode } from './codeHighlight.js';
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
export const codeHighlightTests = [
    { name: 'Highlighting preserves source bytes and distinguishes SQL, Python and plain text', run() {
        for (const source of ['<script>alert("x")</script>', 'SELECT \'a;\' -- keep\nFROM sample WHERE id = 42', 'def greeting():\n    # comment\n    return "Hello"']) {
            const tokens = highlightCode(source, 'sql'); assert(tokens.map(item => item.text).join('') === source, 'Highlighting must not interpret or modify source');
        }
        assert(highlightCode('SELECT count(*) FROM sample', 'sql').some(item => item.kind === 'keyword' && item.text === 'SELECT'), 'SQL keywords must highlight');
        assert(highlightCode('# comment\nreturn 2', 'python')[0].kind === 'comment', 'Python comments must highlight');
        assert(highlightCode('SELECT 2', 'plaintext').every(item => item.kind === 'plain'), 'Plain text must not imply a language');
    } }
];
