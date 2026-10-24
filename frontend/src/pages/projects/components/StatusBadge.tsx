import styled from 'styled-components';
import { getBadgeTextColor } from '../../../styles/colorUtils';

const Badge = styled.div<{ $color: string; $pulse?: boolean }>`
    display: inline-flex;
    align-items: center;
    justify-content: center;

    padding: 3px 8px;
    border-radius: 4px;
    white-space: nowrap;
    flex-shrink: 0;

    font-size: 11px;
    font-weight: 650;

    background: ${({ $color }) => `${$color}20`};
    color: ${({ $color, theme }) => getBadgeTextColor($color, theme.mode)};

    border: 1px solid ${({ $color }) => `${$color}55`};

    &::before {
        content: ${({ $pulse }) => $pulse ? "''" : 'none'};
        width: 5px;
        height: 5px;
        margin-right: 6px;
        border-radius: 50%;
        background: currentColor;
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
