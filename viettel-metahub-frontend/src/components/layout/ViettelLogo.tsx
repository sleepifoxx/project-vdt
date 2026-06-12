import React from 'react';
import styled from 'styled-components';

const LogoWrapper = styled.div<{ collapsed?: boolean }>`
    display: flex;
    align-items: center;
    gap: 10px;
    padding: ${({ collapsed }) => (collapsed ? '0' : '0 4px')};
    justify-content: ${({ collapsed }) => (collapsed ? 'center' : 'flex-start')};
`;

const LogoIcon = styled.div`
    width: 36px;
    height: 36px;
    border-radius: 6px;
    background: white;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    overflow: hidden;
`;

const LogoSvg = () => (
    <svg width="30" height="30" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <rect width="200" height="200" fill="#EE0033" rx="8" />
        <text
            x="100"
            y="135"
            fontFamily="Arial,sans-serif"
            fontSize="100"
            fontWeight="bold"
            textAnchor="middle"
            fill="white"
        >
            V
        </text>
    </svg>
);

const LogoText = styled.div`
    display: flex;
    flex-direction: column;
    line-height: 1.1;
`;

const Brand = styled.span`
    font-size: 15px;
    font-weight: 800;
    color: white;
    letter-spacing: 0.5px;
`;

const SubBrand = styled.span`
    font-size: 10px;
    font-weight: 400;
    color: rgba(255, 255, 255, 0.8);
    letter-spacing: 2px;
    text-transform: uppercase;
`;

type Props = {
    collapsed?: boolean;
};

export default function ViettelLogo({ collapsed }: Props) {
    return (
        <LogoWrapper collapsed={collapsed}>
            <LogoIcon>
                <LogoSvg />
            </LogoIcon>
            {!collapsed && (
                <LogoText>
                    <Brand>Viettel</Brand>
                    <SubBrand>MetaHub</SubBrand>
                </LogoText>
            )}
        </LogoWrapper>
    );
}
