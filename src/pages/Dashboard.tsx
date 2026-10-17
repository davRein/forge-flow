import styled from 'styled-components';
import { ModuleKey } from '../config/moduleConfig';

const Container = styled.div`
    padding: 20px;
`;

type Props = {
    activeModule: ModuleKey;
};

export default function Dashboard({ activeModule }: Props) {
    return (
        <Container>
            <h1>{activeModule}</h1>
            <p>Aktuelles Programm: {activeModule}</p>
        </Container>
    );
}