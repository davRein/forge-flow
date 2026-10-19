import { useState } from 'react';
import { SecondaryButton } from '../styles/toolStyles';

export default function CopyButton({ text }: { text: string }) {
    const [message, setMessage] = useState('');
    const [copiedText, setCopiedText] = useState<string | null>(null);
    return <>
        <SecondaryButton type="button" disabled={!text} onClick={async () => {
            try { await navigator.clipboard.writeText(text); setMessage('Kopiert.'); }
            catch { setMessage('Kopieren nicht verfügbar. Bitte den Text manuell markieren und kopieren.'); }
            setCopiedText(text);
        }}>Kopieren</SecondaryButton>
        <span role="status">{copiedText === text ? message : ''}</span>
    </>;
}
