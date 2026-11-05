import { useTranslation as useUiTranslation } from '../hooks/languageContext';
import styled from 'styled-components';
import { ModuleKey } from '../config/moduleConfig';

const Container = styled.div`
    padding: 20px;
`;

type Props = {
    activeModule: ModuleKey;
};

export default function Dashboard({ activeModule }: Props) {
    const { t: tx } = useUiTranslation();

    return (
        <Container>
            <h1>{activeModule}</h1>
            <p>{tx('Aktuelles Programm: ')}{activeModule}</p>
        </Container>
    );
}