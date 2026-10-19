export type TextConversion = 'base64Encode' | 'base64Decode' | 'urlEncode' | 'urlDecode';
export type UnitGroup = 'length' | 'mass' | 'temperature' | 'data';
type Unit = { id: string; name: string; factor: number; offset?: number };

export const unitGroups: Record<UnitGroup, { name: string; units: Unit[] }> = {
    length: { name: 'Länge', units: [
        { id: 'm', name: 'Meter (m)', factor: 1 }, { id: 'km', name: 'Kilometer (km)', factor: 1000 },
        { id: 'cm', name: 'Zentimeter (cm)', factor: 0.01 }, { id: 'mm', name: 'Millimeter (mm)', factor: 0.001 },
        { id: 'in', name: 'Zoll (in)', factor: 0.0254 }, { id: 'ft', name: 'Fuß (ft)', factor: 0.3048 },
        { id: 'mi', name: 'Meilen (mi)', factor: 1609.344 }
    ] },
    mass: { name: 'Masse', units: [
        { id: 'kg', name: 'Kilogramm (kg)', factor: 1 }, { id: 'g', name: 'Gramm (g)', factor: 0.001 },
        { id: 'mg', name: 'Milligramm (mg)', factor: 0.000001 }, { id: 't', name: 'Tonnen (t)', factor: 1000 },
        { id: 'lb', name: 'Pfund (lb)', factor: 0.45359237 }
    ] },
    temperature: { name: 'Temperatur', units: [
        { id: 'C', name: 'Celsius (°C)', factor: 1, offset: 273.15 },
        { id: 'F', name: 'Fahrenheit (°F)', factor: 5 / 9, offset: 273.15 - 32 * 5 / 9 },
        { id: 'K', name: 'Kelvin (K)', factor: 1 }
    ] },
    data: { name: 'Datenmenge', units: [
        { id: 'B', name: 'Byte (B)', factor: 1 }, { id: 'bit', name: 'Bit', factor: 1 / 8 },
        { id: 'kB', name: 'Kilobyte (kB)', factor: 1000 }, { id: 'MB', name: 'Megabyte (MB)', factor: 1e6 },
        { id: 'GB', name: 'Gigabyte (GB)', factor: 1e9 }, { id: 'KiB', name: 'Kibibyte (KiB)', factor: 1024 },
        { id: 'MiB', name: 'Mebibyte (MiB)', factor: 1024 ** 2 }, { id: 'GiB', name: 'Gibibyte (GiB)', factor: 1024 ** 3 }
    ] }
};

export function convertText(input: string, mode: TextConversion): string {
    try {
        if (mode === 'urlEncode') return encodeURIComponent(input);
        if (mode === 'urlDecode') return decodeURIComponent(input);
        if (mode === 'base64Encode') {
            const bytes = new TextEncoder().encode(input);
            if (new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes) !== input) throw new Error('Unicode');
            let binary = '';
            for (const byte of bytes) binary += String.fromCharCode(byte);
            return btoa(binary);
        }
        const compact = input.replace(/\s/g, '');
        if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}(?:==)?|[A-Za-z0-9+/]{3}=?|)?$/.test(compact)) {
            throw new Error('Base64-Syntax');
        }
        const binary = atob(compact);
        const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
        return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
    } catch {
        throw new Error(mode === 'base64Decode' ? 'Bitte gültiges Base64 mit UTF-8-Text eingeben.'
            : mode === 'urlDecode' ? 'Die URL-Kodierung ist ungültig oder enthält kein UTF-8.' : 'Der Text enthält ungültige Unicode-Zeichen.');
    }
}

export function convertUnit(input: string, group: UnitGroup, fromId: string, toId: string): number {
    if (!/^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)(?:[eE][+-]?\d+)?$/.test(input.trim())) {
        throw new Error('Bitte eine Zahl ohne Tausendertrennzeichen eingeben.');
    }
    const value = Number(input.trim().replace(',', '.'));
    const units = unitGroups[group].units;
    const from = units.find((unit) => unit.id === fromId);
    const to = units.find((unit) => unit.id === toId);
    if (!from || !to) throw new Error('Bitte gültige Einheiten wählen.');
    const base = value * from.factor + (from.offset ?? 0);
    if (group === 'temperature' && base < -1e-10) throw new Error('Die Temperatur liegt unter dem absoluten Nullpunkt.');
    if (group === 'data' && value < 0) throw new Error('Datenmengen dürfen nicht negativ sein.');
    const result = (base - (to.offset ?? 0)) / to.factor;
    if (!Number.isFinite(base) || !Number.isFinite(result)) throw new Error('Die Zahl liegt außerhalb des darstellbaren Bereichs.');
    return Object.is(result, -0) ? 0 : result;
}

export function convertBase(input: string, from: number, to: number): string {
    if (![2, 8, 10, 16].includes(from) || ![2, 8, 10, 16].includes(to)) throw new Error('Ungültiges Zahlensystem.');
    const source = input.trim();
    if (!source || !/^[+-]?[0-9a-f]+$/i.test(source)) throw new Error('Bitte eine ganze Zahl ohne Präfix oder Trennzeichen eingeben.');
    if (source.length > 4096) throw new Error('Die Eingabe darf höchstens 4.096 Zeichen enthalten.');
    const negative = source.startsWith('-');
    const digits = source.replace(/^[+-]/, '').toLowerCase();
    let value = 0n;
    for (const digit of digits) {
        const number = parseInt(digit, 16);
        if (number >= from) throw new Error(`Die Ziffer „${digit}“ ist in Basis ${from} nicht erlaubt.`);
        value = value * BigInt(from) + BigInt(number);
    }
    return (negative && value !== 0n ? '-' : '') + value.toString(to).toUpperCase();
}
