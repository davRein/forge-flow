import styled from 'styled-components';

const Mark = styled.span<{ $size: number }>`
    display: grid;
    place-items: center;
    flex-shrink: 0;
    width: ${({ $size }) => $size}px;
    height: ${({ $size }) => $size}px;
    border-radius: ${({ $size }) => $size / 4}px;
    background: ${({ theme }) => theme.colors.primary};
    color: ${({ theme }) => theme.colors.onPrimary};
`;

export default function BrandMark({ size = 28 }: { size?: number }) {
    return <Mark $size={size} aria-hidden="true">
        <svg width={size * 19 / 28} height={size * 19 / 28} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 19V5h11M7 12h8m-4 7 7-7" />
        </svg>
    </Mark>;
}
