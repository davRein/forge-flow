export function calculate(expression: string): number {
    const source = expression.trim();
    if (!source) throw new Error('Bitte einen Rechenausdruck eingeben.');
    if (source.length > 1000) throw new Error('Der Ausdruck darf höchstens 1.000 Zeichen enthalten.');
    let index = 0;
    let nesting = 0;
    const skip = () => { while (/\s/.test(source[index] ?? '') && index < source.length) index++; };
    const take = (char: string) => { skip(); if (source[index] !== char) return false; index++; return true; };
    function finite(value: number) {
        if (!Number.isFinite(value)) throw new Error('Das Ergebnis liegt außerhalb des darstellbaren Zahlenbereichs.');
        return Object.is(value, -0) ? 0 : value;
    }
    function atom(): number {
        if (++nesting > 100) throw new Error('Der Ausdruck ist zu tief verschachtelt.');
        try {
            skip();
            if (take('(')) {
                const value = sum();
                if (!take(')')) throw new Error('Eine schließende Klammer fehlt.');
                return value;
            }
            const token = source.slice(index).match(/^(?:(?:\d+(?:[.,]\d*)?|[.,]\d+)(?:[eE][+-]?\d+)?)/);
            if (!token) throw new Error(`Zahl oder Klammer an Position ${index + 1} erwartet.`);
            index += token[0].length;
            return finite(Number(token[0].replace(',', '.')));
        } finally { nesting--; }
    }
    function power(): number {
        const left = atom();
        return take('^') ? finite(left ** unary()) : left;
    }
    function unary(): number {
        if (++nesting > 100) throw new Error('Der Ausdruck ist zu tief verschachtelt.');
        try {
            if (take('+')) return unary();
            if (take('-')) return finite(-unary());
            return power();
        } finally { nesting--; }
    }
    function product(): number {
        let value = unary();
        while (true) {
            if (take('*')) value = finite(value * unary());
            else if (take('/')) {
                const divisor = unary();
                if (divisor === 0) throw new Error('Division durch null ist nicht möglich.');
                value = finite(value / divisor);
            } else if (take('%')) {
                const divisor = unary();
                if (divisor === 0) throw new Error('Modulo durch null ist nicht möglich.');
                value = finite(value % divisor);
            } else return value;
        }
    }
    function sum(): number {
        let value = product();
        while (true) {
            if (take('+')) value = finite(value + product());
            else if (take('-')) value = finite(value - product());
            else return value;
        }
    }
    const result = sum();
    skip();
    if (index !== source.length) throw new Error(`Unerwartetes Zeichen an Position ${index + 1}.`);
    return finite(result);
}
