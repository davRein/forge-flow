import styled from 'styled-components';

const Badge = styled.div<{ $color: string; $pulse?: boolean }>`
    display: inline-flex;
    align-items: center;
    justify-content: center;

    padding: 6px 12px;
    border-radius: 999px;

    font-size: 13px;
    font-weight: 700;

    background: ${({ $color }) => `${$color}20`};
    color: ${({ $color }) => $color};

    border: 1px solid ${({ $color }) => `${$color}55`};

    animation: ${({ $pulse }) =>
    $pulse ? 'pulse 1.6s infinite' : 'none'};

    @keyframes pulse {
        0% {
            box-shadow: 0 0 0 0 ${({ $color }) => `${$color}66`};
        }

        70% {
            box-shadow: 0 0 0 6px transparent;
        }

        100% {
            box-shadow: 0 0 0 0 transparent;
        }
    }
`;

type Props = {
    label: string;
    color: string;
    pulse?: boolean;
};

export default function StatusBadge({ label, color, pulse }: Props) {
    return (
        <Badge $color={color} $pulse={pulse}>
            {label}
        </Badge>
    );
}