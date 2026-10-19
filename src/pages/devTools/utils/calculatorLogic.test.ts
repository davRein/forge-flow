import { calculate } from './calculatorLogic.js';

function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
function equal(actual: number, expected: number) { assert(actual === expected, `Erwartet ${expected}, erhalten ${actual}`); }

export const calculatorTests = [
    { name: 'Rechner berücksichtigt Vorrang, Klammern, Vorzeichen und Leerzeichen', run() {
        equal(calculate('2 + 3 * 4'), 14);
        equal(calculate('(2 + 3) * 4'), 20);
        equal(calculate(' 4 / -2 - -3 '), 1);
        equal(calculate('--5'), 5);
        equal(calculate('17 % 5'), 2);
        equal(calculate('-0'), 0);
    } },
    { name: 'Potenzen werden rechtsassoziativ mit korrekten unären Vorzeichen ausgewertet', run() {
        equal(calculate('2^3^2'), 512);
        equal(calculate('-2^2'), -4);
        equal(calculate('(-2)^2'), 4);
        equal(calculate('2^-3'), 0.125);
    } },
    { name: 'Dezimalkomma, Dezimalpunkt und wissenschaftliche Schreibweise sind erlaubt', run() {
        equal(calculate('(12,5 + 7.5) * .5'), 10);
        equal(calculate('1e3 + 2,5e-1'), 1000.25);
        equal(calculate('5.'), 5);
    } },
    { name: 'Ungültige Ausdrücke, Division durch null und nicht endliche Ergebnisse werden abgelehnt', run() {
        for (const source of ['', '1/0', '0%0', '1e309', '10^999', '(-1)^.5', '2(3)', '(2+3', '2+3)', '1..2', '1e', '2**3', 'Math.random()', 'alert(1)', '1;2', '1 2']) {
            let failed = false;
            try { calculate(source); } catch { failed = true; }
            assert(failed, `Ausdruck muss abgelehnt werden: ${source}`);
        }
    } },
    { name: 'Sehr lange oder zu tief verschachtelte Ausdrücke werden begrenzt', run() {
        for (const source of ['1'.repeat(1001), `${'('.repeat(150)}1${')'.repeat(150)}`, `${'-'.repeat(150)}1`]) {
            let failed = false;
            try { calculate(source); } catch { failed = true; }
            assert(failed, 'Die Begrenzung muss greifen');
        }
    } }
];
