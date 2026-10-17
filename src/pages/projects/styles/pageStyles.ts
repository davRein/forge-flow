import styled from 'styled-components';

export const Container = styled.div`
    padding: 24px;
`;

export const HeaderRow = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;

    margin-bottom: 20px;
`;

export const Title = styled.h1``;

export const IconButton = styled.button`
    border: none;
    border-radius: 10px;

    padding: 10px 14px;

    cursor: pointer;

    color: ${({ theme }) => theme.colors.text};
    background: ${({ theme }) => theme.colors.primary};

    font-size: 18px;
    font-weight: 700;

    box-shadow:
        0 0 14px ${({ theme }) => theme.colors.primary};
`;

export const Grid = styled.div`
    display: grid;
    grid-template-columns: 320px 1fr;
    gap: 20px;
`;