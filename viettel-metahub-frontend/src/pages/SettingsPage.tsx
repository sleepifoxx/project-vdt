import React, { useState } from 'react';
import { Tabs } from 'antd';
import { ApiOutlined, SyncOutlined } from '@ant-design/icons';
import styled from 'styled-components';
import AppLayout from '../components/layout/AppLayout';
import ConnectionSettings from '../components/settings/ConnectionSettings';
import AutoUpdateSettings from '../components/settings/AutoUpdateSettings';

const PageWrapper = styled.div`
    padding: 24px;
`;

const StyledTabs = styled(Tabs)`
    .ant-tabs-nav {
        margin-bottom: 20px;

        &::before {
            border-color: #f0f0f0;
        }
    }

    .ant-tabs-tab {
        padding: 10px 4px;
        font-size: 14px;
        color: #616161;

        &:hover {
            color: #ee0033;
        }

        &.ant-tabs-tab-active .ant-tabs-tab-btn {
            color: #ee0033;
            font-weight: 600;
        }
    }

    .ant-tabs-ink-bar {
        background: #ee0033;
    }
`;

const tabItems = [
    {
        key: 'connections',
        label: (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <ApiOutlined />
                Quản lý kết nối
            </span>
        ),
        children: <ConnectionSettings />,
    },
    {
        key: 'schedules',
        label: (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <SyncOutlined />
                Tự động cập nhật
            </span>
        ),
        children: <AutoUpdateSettings />,
    },
];

export default function SettingsPage() {
    return (
        <AppLayout pageTitle="Kết nối & Cập nhật tự động">
            <PageWrapper>
                <StyledTabs defaultActiveKey="connections" items={tabItems} size="large" />
            </PageWrapper>
        </AppLayout>
    );
}
