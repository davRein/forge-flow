import type { WikiData } from '../pages/wiki/types/wiki.types';

const createdAt = '2026-10-18T08:00:00.000Z';

export const initialWiki: WikiData = {
    categories: [
        { id: 1, name: 'Erste Schritte', description: 'Orientierung und Abläufe für den Einstieg.', createdAt, updatedAt: createdAt },
        { id: 2, name: 'Entwicklung', description: 'Technische Hinweise und Wissen zur Entwicklung.', createdAt, updatedAt: createdAt }
    ],
    articles: [
        {
            id: 1, title: 'Willkommen im Team-Wiki', categoryId: 1, createdAt, updatedAt: createdAt,
            content: '# Wissen an einem Ort\n\nHalte Entscheidungen, Anleitungen und Erfahrungen als Artikel fest.\n\n## So startest du\n\n1. Lege einen Artikel mit einem aussagekräftigen Titel an.\n2. Ordne ihn einer passenden Kategorie zu.\n3. Nutze die Suche, um Inhalte später wiederzufinden.\n\nDiese Beispielartikel kannst du bearbeiten oder entfernen.'
        },
        {
            id: 2, title: 'Projektarbeit organisieren', categoryId: 1, createdAt, updatedAt: createdAt,
            content: '# Von Zielen zu Aufgaben\n\n- Bündele größere Ziele in Epics.\n- Plane offene Aufgaben in Sprints ein.\n- Verfolge den Status im Board.\n- Halte wichtige Erkenntnisse im Wiki fest.\n\n## Sprint-Abschluss\n\nBeim Abschließen eines Sprints gehen offene Aufgaben zurück ins Backlog. Das Ergebnis des abgeschlossenen Sprints bleibt als Momentaufnahme erhalten.'
        },
        {
            id: 3, title: 'Entwicklungsumgebung starten', categoryId: 2, createdAt, updatedAt: createdAt,
            content: '# Lokal entwickeln\n\nInstalliere zuerst die Abhängigkeiten und starte danach Vite:\n\n```sh\nnpm install\nnpm run dev\n```\n\n## Änderungen prüfen\n\n```sh\nnpm run lint\nnpm test\nnpm run build\n```\n\nUnter Windows kann bei blockiertem PowerShell-Starter npm.cmd verwendet werden.'
        }
    ]
};
