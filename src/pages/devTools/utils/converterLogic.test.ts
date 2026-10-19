import { convertBase, convertText, convertUnit } from './converterLogic.js';

function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
function equal(actual: unknown, expected: unknown) { assert(actual === expected, `Erwartet ${String(expected)}, erhalten ${String(actual)}`); }
function near(actual: number, expected: number) { assert(Math.abs(actual - expected) < 1e-8, `Erwartet etwa ${expected}, erhalten ${actual}`); }
function rejects(action: () => unknown) { let failed = false; try { action(); } catch { failed = true; } assert(failed, 'Ungültige Eingabe muss abgelehnt werden'); }

export const converterTests = [
    { name: 'Base64 erhält UTF-8, Emoji, Leerzeichen und ein führendes BOM', run() {
        equal(convertText('Hallo', 'base64Encode'), 'SGFsbG8=');
        for (const text of ['', 'Grüße 🌍\nText', '\uFEFFAnfang', '  Abstand  ']) equal(convertText(convertText(text, 'base64Encode'), 'base64Decode'), text);
        equal(convertText('SGFs\nbG8=', 'base64Decode'), 'Hallo');
        equal(convertText('SGk', 'base64Decode'), 'Hi');
    } },
    { name: 'Base64 lehnt ungültige Zeichen, defekte Auffüllung und binäre Nicht-UTF-8-Daten ab', run() {
        for (const value of ['a', '===', 'ab=c', 'SGk===', 'SG!k', '/w==']) rejects(() => convertText(value, 'base64Decode'));
        rejects(() => convertText('\uD800', 'base64Encode'));
    } },
    { name: 'URL-Komponenten erhalten Sonderzeichen und Unicode ohne Plus in Leerzeichen umzuwandeln', run() {
        const text = 'Grüße + /?&=# 🌍';
        equal(convertText(convertText(text, 'urlEncode'), 'urlDecode'), text);
        equal(convertText('a+b', 'urlDecode'), 'a+b');
        rejects(() => convertText('%E0%A4', 'urlDecode'));
        rejects(() => convertText('%ZZ', 'urlDecode'));
    } },
    { name: 'Einheiten verwenden korrekte Faktoren für Länge, Masse und dezimale sowie binäre Datenmengen', run() {
        near(convertUnit('1,5', 'length', 'km', 'm'), 1500);
        near(convertUnit('1', 'length', 'in', 'cm'), 2.54);
        near(convertUnit('1e3', 'mass', 'g', 'kg'), 1);
        near(convertUnit('1', 'mass', 'lb', 'kg'), 0.45359237);
        near(convertUnit('1', 'data', 'MB', 'B'), 1000000);
        near(convertUnit('1', 'data', 'MiB', 'B'), 1048576);
        near(convertUnit('8', 'data', 'bit', 'B'), 1);
    } },
    { name: 'Temperaturen berücksichtigen Offset und absoluten Nullpunkt', run() {
        near(convertUnit('0', 'temperature', 'C', 'F'), 32);
        near(convertUnit('212', 'temperature', 'F', 'C'), 100);
        near(convertUnit('0', 'temperature', 'K', 'C'), -273.15);
        near(convertUnit('-459.67', 'temperature', 'F', 'K'), 0);
        rejects(() => convertUnit('-1', 'temperature', 'K', 'C'));
    } },
    { name: 'Ungültige Zahlen, gemischte Gruppen, Überläufe und negative Datenmengen werden abgelehnt', run() {
        for (const value of ['', ' ', '1,000.00', '1 000', 'Infinity', 'NaN', '1e309']) rejects(() => convertUnit(value, 'length', 'm', 'km'));
        rejects(() => convertUnit('1', 'mass', 'm', 'kg'));
        rejects(() => convertUnit('-1', 'data', 'B', 'bit'));
    } },
    { name: 'Zahlensysteme rechnen große und negative Ganzzahlen ohne Rundung um', run() {
        equal(convertBase('255', 10, 16), 'FF');
        equal(convertBase('-FF', 16, 2), '-11111111');
        equal(convertBase('777', 8, 10), '511');
        const huge = '900719925474099312345678901234567890';
        equal(convertBase(convertBase(huge, 10, 16), 16, 10), huge);
        equal(convertBase('+0', 10, 2), '0');
        equal(convertBase('-0', 10, 2), '0');
    } },
    { name: 'Zahlensysteme weisen falsche Ziffern, Präfixe und überlange Eingaben zurück', run() {
        for (const value of ['', '102', '0b11', '2.5', '1 0', '-']) rejects(() => convertBase(value, 2, 10));
        rejects(() => convertBase('0xFF', 16, 10));
        rejects(() => convertBase('1'.repeat(4097), 2, 10));
        rejects(() => convertBase('10', 3, 10));
    } }
];
