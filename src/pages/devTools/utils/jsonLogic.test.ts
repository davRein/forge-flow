import { formatJson, validateJson } from './jsonLogic.js';

function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
function equal(actual: unknown, expected: unknown) { assert(actual === expected, `Erwartet ${String(expected)}, erhalten ${String(actual)}`); }

export const jsonTests = [
    { name: 'JSON-Formatierung erhält verschachtelte Werte, leere Container und skalare Wurzeln', run() {
        equal(formatJson('{"a":[1,{},[]],"b":true}', '  '), '{\n  "a": [\n    1,\n    {},\n    []\n  ],\n  "b": true\n}');
        for (const source of ['null', 'false', '0', '"Text"', '{}', '[]']) equal(formatJson(source, '    '), source);
        equal(formatJson('{"a":1}', '\t'), '{\n\t"a": 1\n}');
    } },
    { name: 'JSON-Komprimierung verändert weder Leerzeichen in Strings noch Escape-Sequenzen', run() {
        const data = { a: 'Text mit  Abstand', b: '" \\ \n', c: [1, 2] };
        equal(formatJson(JSON.stringify(data, null, 4), null), JSON.stringify(data));
    } },
    { name: 'Große JSON-Zahlen, Exponenten und doppelte Schlüssel bleiben exakt erhalten', run() {
        const source = '{"id":900719925474099312345,"id":1.2300e+99,"zero":-0}';
        equal(formatJson(formatJson(source, '  '), null), source);
    } },
    { name: 'Ungültiges und leeres JSON wird vor Formatierung abgelehnt', run() {
        for (const source of ['', ' ', '{"a":}', '{"a":1,}', '[NaN]', 'undefined', '/* Kommentar */{}', 'true false']) {
            assert(validateJson(source), 'Ungültiges JSON muss erkannt werden');
            let failed = false;
            try { formatJson(source, '  '); } catch { failed = true; }
            assert(failed, 'Formatierung darf keine Ausgabe erzeugen');
        }
    } }
];
