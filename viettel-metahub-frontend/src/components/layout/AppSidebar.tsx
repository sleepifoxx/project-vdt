import React, { useState } from 'react';
import { Layout, Menu } from 'antd';
import {
    SearchOutlined,
    ApartmentOutlined,
    ApiOutlined,
    HomeOutlined,
    MenuFoldOutlined,
    MenuUnfoldOutlined,
} from '@ant-design/icons';
import styled from 'styled-components';
import { useNavigate, useLocation } from 'react-router-dom';
import ViettelLogo from './ViettelLogo';

const { Sider } = Layout;

const StyledSider = styled(Sider)`
    background: #1a1a2e !important;
    height: 100vh;
    position: sticky;
    top: 0;
    left: 0;
    overflow: hidden;

    .ant-layout-sider-children {
        display: flex;
        flex-direction: column;
        height: 100%;
    }

    .ant-menu {
        background: transparent !important;
        border-inline-end: none !important;
        flex: 1;
    }

    .ant-menu-item {
        color: rgba(255, 255, 255, 0.65) !important;
        margin: 2px 8px !important;
        border-radius: 6px !important;

        &:hover {
            background: rgba(238, 0, 51, 0.15) !important;
            color: rgba(255, 255, 255, 0.9) !important;
        }

        &.ant-menu-item-selected {
            background: rgba(238, 0, 51, 0.25) !important;
            color: white !important;

            &::after {
                border-color: #ee0033 !important;
            }
        }
    }

    .ant-menu-item .anticon {
        color: inherit !important;
    }
`;

const LogoContainer = styled.div`
    padding: 16px 16px 12px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    background: #ee0033;
`;

const CollapseBtn = styled.div`
    padding: 12px 16px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    cursor: pointer;
    color: rgba(255, 255, 255, 0.55);
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    transition: all 0.2s;

    &:hover {
        color: white;
        background: rgba(255, 255, 255, 0.05);
    }
`;

const menuItems = [
    {
        key: '/',
        icon: <HomeOutlined />,
        label: 'Tổng quan',
    },
    {
        key: '/search',
        icon: <SearchOutlined />,
        label: 'Tìm kiếm',
    },
    {
        key: '/classification',
        icon: <ApartmentOutlined />,
        label: 'Phân loại dữ liệu',
    },
    {
        key: '/settings',
        icon: <ApiOutlined />,
        label: 'Kết nối & Cập nhật',
    },
];

export default function AppSidebar() {
    const [collapsed, setCollapsed] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();

    return (
        <StyledSider width={220} collapsedWidth={64} collapsed={collapsed}>
            <LogoContainer>
                <ViettelLogo collapsed={collapsed} />
            </LogoContainer>

            <Menu
                mode="inline"
                selectedKeys={[location.pathname]}
                items={menuItems}
                onClick={({ key }) => navigate(key)}
                style={{ paddingTop: 8 }}
            />

            <CollapseBtn onClick={() => setCollapsed(!collapsed)}>
                {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                {!collapsed && <span>Thu gọn</span>}
            </CollapseBtn>
        </StyledSider>
    );
}
