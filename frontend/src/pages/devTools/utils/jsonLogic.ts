export function validateJson(source: string): string | null {
    if (!source.trim()) return 'Bitte JSON eingeben.';
    try { JSON.parse(source); return null; }
    catch (error) { return `Ungültiges JSON: ${error instanceof Error ? error.message : 'Syntax prüfen.'}`; }
}

// Validate with JSON.parse, but format the original tokens to preserve large numbers and duplicate keys.
export function formatJson(source: string, indentation: string | null): string {
    const error = validateJson(source);
    if (error) throw new Error(error);
    const tokens = source.match(/"(?:\\.|[^"\\])*"|[^\s]/g) ?? [];
    let depth = 0;
    let output = '';
    const newline = () => indentation === null ? '' : `\n${indentation.repeat(depth)}`;
    for (let index = 0; index < tokens.length; index++) {
        const token = tokens[index];
        if (token === '{' || token === '[') {
            output += token;
            depth++;
            if (tokens[index + 1] !== '}' && tokens[index + 1] !== ']') output += newline();
        } else if (token === '}' || token === ']') {
            depth--;
            if (tokens[index - 1] !== '{' && tokens[index - 1] !== '[') output += newline();
            output += token;
        } else if (token === ',') output += token + newline();
        else if (token === ':') output += indentation === null ? ':' : ': ';
        else output += token;
    }
    return output;
}
