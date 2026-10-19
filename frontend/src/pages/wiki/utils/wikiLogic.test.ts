import type { WikiData } from '../types/wiki.types';
import { parseWikiId, removeWikiArticle, removeWikiCategory, saveWikiArticle, saveWikiCategory, searchWikiArticles } from './wikiLogic.js';
import { parseMarkdown } from './markdown.js';

const before = '2026-10-17T10:00:00.000Z';
const now = '2026-10-18T12:00:00.000Z';
function fixture(): WikiData {
    return {
        categories: [
            { id: 1, name: 'Entwicklung', description: '', createdAt: before, updatedAt: before },
            { id: 2, name: 'Abläufe', description: '', createdAt: before, updatedAt: before }
        ],
        articles: [
            { id: 1, title: 'Kundenportal', content: 'Das Team entwickelt die Anmeldung.', categoryId: 1, createdAt: before, updatedAt: before },
            { id: 2, title: 'Anleitung', content: 'Schritte für neue Teammitglieder.', categoryId: 2, createdAt: before, updatedAt: now },
            { id: 3, title: 'Zugänge', content: 'Kontakt für Rückfragen.', categoryId: null, createdAt: now, updatedAt: now }
        ]
    };
}

function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
function equal(actual: unknown, expected: unknown) {
    assert(JSON.stringify(actual) === JSON.stringify(expected), `Erwartet ${JSON.stringify(expected)}, erhalten ${JSON.stringify(actual)}`);
}

export const wikiTests = [
    { name: 'Artikel benötigen Titel und Inhalt sowie eine vorhandene oder keine Kategorie', run() {
        const data = fixture();
        const draft = { title: 'Neu', content: 'Text', categoryId: null };
        for (const invalid of [{ ...draft, title: '  ' }, { ...draft, content: '\n ' }, { ...draft, categoryId: 99 }]) {
            const result = saveWikiArticle(data, invalid, null, 4, now);
            assert(result.error, 'Ungültiger Artikel muss abgelehnt werden');
            assert(result.data === data, 'Fehler darf keine Teiländerung verursachen');
        }
        assert(!saveWikiArticle(data, draft, null, 4, now).error, 'Artikel ohne Kategorie muss erlaubt sein');
    } },
    { name: 'Artikel speichern erhält Code-Einrückungen, normalisiert Zeilenumbrüche und ändert keine anderen Artikel', run() {
        const data = fixture();
        const result = saveWikiArticle(data, { title: '  Neu  ', content: '```ts\r\n  const x = 1;\r\n```\r\n', categoryId: 1 }, null, 4, now);
        assert(!result.error, 'Neuer Artikel muss gespeichert werden');
        equal(result.data.articles[3].title, 'Neu');
        equal(result.data.articles[3].content, '```ts\n  const x = 1;\n```\n');
        equal(data.articles.length, 3);
        assert(result.data.articles[0] === data.articles[0], 'Bestehende Artikel bleiben unverändert');
    } },
    { name: 'Bearbeiten erhält das Erstellungsdatum und gelöschte Artikel werden nicht wiederhergestellt', run() {
        const data = fixture();
        const result = saveWikiArticle(data, { title: 'Geändert', content: 'Neuer Inhalt', categoryId: 2 }, 1, 4, now);
        equal(result.data.articles[0].createdAt, before);
        equal(result.data.articles[0].updatedAt, now);
        equal(result.data.articles[0].categoryId, 2);
        equal(data.articles[0].title, 'Kundenportal');
        assert(saveWikiArticle(data, { title: 'Neu', content: 'Text', categoryId: null }, 99, 4, now).error, 'Fehlender Artikel muss erkannt werden');
    } },
    { name: 'Artikel löschen entfernt nur den gewählten Artikel', run() {
        const data = fixture();
        const result = removeWikiArticle(data, 1);
        equal(result.data.articles.map((article) => article.id), [2, 3]);
        assert(result.data.categories === data.categories, 'Kategorien bleiben erhalten');
        equal(data.articles.length, 3);
        assert(removeWikiArticle(data, 99).error, 'Fehlende Artikel müssen erkannt werden');
    } },
    { name: 'Kategorienamen sind nach Großschreibung und Unicode-Normalisierung eindeutig', run() {
        const data = fixture();
        assert(saveWikiCategory(data, { name: ' entwicklung ', description: '' }, null, 3, now).error, 'Großschreibung darf keine Duplikate erlauben');
        assert(saveWikiCategory(data, { name: 'Abla\u0308ufe', description: '' }, null, 3, now).error, 'Unicode-Varianten dürfen keine Duplikate erlauben');
        assert(!saveWikiCategory(data, { name: 'ENTWICKLUNG', description: 'Neu' }, 1, 3, now).error, 'Eigene Kategorie darf umbenannt werden');
        assert(saveWikiCategory(data, { name: ' ', description: '' }, null, 3, now).error, 'Leere Namen müssen abgelehnt werden');
        assert(saveWikiCategory(data, { name: 'Neu', description: '' }, 99, 3, now).error, 'Gelöschte Kategorie darf nicht neu entstehen');
    } },
    { name: 'Kategorie löschen ordnet Artikel neu zu und erhält Titel und Inhalte', run() {
        const data = fixture();
        const result = removeWikiCategory(data, 1, 2, now);
        assert(!result.error, 'Neuzuordnung muss möglich sein');
        equal(result.data.categories.map((category) => category.id), [2]);
        equal(result.data.articles.length, 3);
        equal(result.data.articles[0].categoryId, 2);
        equal(result.data.articles[0].content, data.articles[0].content);
        equal(result.data.articles[0].updatedAt, now);
        equal(data.articles[0].categoryId, 1);
        const without = removeWikiCategory(data, 1, null, now);
        equal(without.data.articles[0].categoryId, null);
    } },
    { name: 'Ungültige Zielkategorien verursachen keine verwaisten Artikel oder Teiländerungen', run() {
        const data = fixture();
        for (const target of [1, 99]) {
            const result = removeWikiCategory(data, 1, target, now);
            assert(result.error, 'Ungültiges Ziel muss abgelehnt werden');
            assert(result.data === data, 'Daten müssen bei Fehlern unverändert bleiben');
        }
    } },
    { name: 'Suche findet alle Begriffe über Titel, Inhalt und Kategorie hinweg', run() {
        const data = fixture();
        equal(searchWikiArticles(data, '  TEAM   portal ').map((article) => article.id), [1]);
        equal(searchWikiArticles(data, 'entwicklung').map((article) => article.id), [1]);
        equal(searchWikiArticles(data, 'RU\u0308CKFRAGEN').map((article) => article.id), [3]);
        equal(searchWikiArticles(data, 'team fehlt'), []);
    } },
    { name: 'Kategorie-Filter und Sortierung verändern die gespeicherten Artikel nicht', run() {
        const data = fixture();
        equal(searchWikiArticles(data, '', 'none').map((article) => article.id), [3]);
        equal(searchWikiArticles(data, '', 2).map((article) => article.id), [2]);
        equal(searchWikiArticles(data, '', 'all', 'title').map((article) => article.id), [2, 1, 3]);
        equal(searchWikiArticles(data, '').map((article) => article.id), [3, 2, 1]);
        equal(data.articles.map((article) => article.id), [1, 2, 3]);
    } },
    { name: 'Artikeladressen akzeptieren nur positive, sichere Ganzzahlen', run() {
        equal(parseWikiId('12'), 12);
        for (const value of [null, '', '0', '-1', '1e2', '3abc', 'Infinity', '9007199254740993']) equal(parseWikiId(value), null);
    } },
    { name: 'Markdown trennt Überschriften, Absätze, Listen und Code ohne Code zu verändern', run() {
        const blocks = parseMarkdown('# Titel\n\nAbsatz\nzweite Zeile\n\n- Eins\n- Zwei\n\n3. Drei\n4. Vier\n\n```ts\n  const tag = "<div>";\n```');
        equal(blocks, [
            { type: 'heading', level: 1, text: 'Titel' },
            { type: 'paragraph', text: 'Absatz\nzweite Zeile' },
            { type: 'list', ordered: false, start: 1, items: ['Eins', 'Zwei'] },
            { type: 'list', ordered: true, start: 3, items: ['Drei', 'Vier'] },
            { type: 'code', language: 'ts', text: '  const tag = "<div>";' }
        ]);
    } },
    { name: 'HTML bleibt Text und auch ein offener Codeblock wird vollständig dargestellt', run() {
        equal(parseMarkdown('<script>alert(1)</script>'), [{ type: 'paragraph', text: '<script>alert(1)</script>' }]);
        equal(parseMarkdown('```html\r\n<div>\r\n\r\nText'), [{ type: 'code', language: 'html', text: '<div>\n\nText' }]);
        equal(parseMarkdown(''), []);
    } }
];
