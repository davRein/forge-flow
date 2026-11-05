import { useTranslation as useUiTranslation } from '../../../hooks/languageContext';
export default function TicketsTab() {
    const { t: tx } = useUiTranslation();

    return (
        <div>
            {tx('Das Ticketsystem ist vorerst zurückgestellt.')}</div>
    );
}
