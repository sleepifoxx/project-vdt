import React from 'react';
import { Layout, Avatar, Dropdown, Badge, Button, Space, Typography } from 'antd';
import {
    BellOutlined,
    UserOutlined,
    SettingOutlined,
    LogoutOutlined,
    QuestionCircleOutlined,
} from '@ant-design/icons';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import { logout } from '../../api/client';

const { Header } = Layout;
const { Text } = Typography;

const StyledHeader = styled(Header)`
    background: #ee0033;
    padding: 0 24px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 56px;
    line-height: 56px;
    box-shadow: 0 2px 8px rgba(238, 0, 51, 0.3);
    position: sticky;
    top: 0;
    z-index: 100;
`;

const LeftSection = styled.div`
    display: flex;
    align-items: center;
    gap: 16px;
`;

const RightSection = styled.div`
    display: flex;
    align-items: center;
    gap: 4px;
`;

const PageTitle = styled(Text)`
    color: rgba(255, 255, 255, 0.9) !important;
    font-size: 15px;
    font-weight: 500;
`;

const HeaderIconBtn = styled(Button)`
    color: rgba(255, 255, 255, 0.85) !important;
    border: none !important;
    background: transparent !important;

    &:hover {
        color: white !important;
        background: rgba(255, 255, 255, 0.15) !important;
    }
`;

const UserInfo = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 8px;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.2s;

    &:hover {
        background: rgba(255, 255, 255, 0.15);
    }
`;

const UserName = styled(Text)`
    color: white !important;
    font-size: 13px;
    font-weight: 500;
`;

type Props = {
    pageTitle?: string;
};

export default function AppHeader({ pageTitle }: Props) {
    const navigate = useNavigate();

    const userMenuItems = [
        {
            key: 'profile',
            icon: <UserOutlined />,
            label: 'Hồ sơ cá nhân',
        },
        {
            key: 'settings',
            icon: <SettingOutlined />,
            label: 'Cài đặt tài khoản',
            onClick: () => navigate('/settings'),
        },
        { type: 'divider' as const },
        {
            key: 'logout',
            icon: <LogoutOutlined />,
            label: 'Đăng xuất',
            danger: true,
            onClick: () => logout(),
        },
    ];

    return (
        <StyledHeader>
            <LeftSection>
                {pageTitle && <PageTitle>{pageTitle}</PageTitle>}
            </LeftSection>

            <RightSection>
                <Space size={4}>
                    <HeaderIconBtn
                        type="text"
                        icon={<QuestionCircleOutlined style={{ fontSize: 18 }} />}
                        title="Trợ giúp"
                    />
                    <Badge count={3} offset={[-4, 4]}>
                        <HeaderIconBtn
                            type="text"
                            icon={<BellOutlined style={{ fontSize: 18 }} />}
                            title="Thông báo"
                        />
                    </Badge>

                    <Dropdown menu={{ items: userMenuItems }} placement="bottomRight" trigger={['click']}>
                        <UserInfo>
                            <Avatar
                                size={30}
                                style={{ background: 'rgba(255,255,255,0.25)', color: 'white', fontSize: 13 }}
                            >
                                NVA
                            </Avatar>
                            <UserName>Nguyễn Văn A</UserName>
                        </UserInfo>
                    </Dropdown>
                </Space>
            </RightSection>
        </StyledHeader>
    );
}
