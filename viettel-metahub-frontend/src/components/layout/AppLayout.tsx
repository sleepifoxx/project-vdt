import React from 'react';
import { Layout } from 'antd';
import styled from 'styled-components';
import AppSidebar from './AppSidebar';
import AppHeader from './AppHeader';

const { Content } = Layout;

const StyledLayout = styled(Layout)`
    min-height: 100vh;
    background: #f5f5f5;
`;

const MainLayout = styled(Layout)`
    background: #f5f5f5;
`;

const StyledContent = styled(Content)`
    overflow: auto;
    background: #f5f5f5;
`;

type Props = {
    children: React.ReactNode;
    pageTitle?: string;
};

export default function AppLayout({ children, pageTitle }: Props) {
    return (
        <StyledLayout>
            <AppSidebar />
            <MainLayout>
                <AppHeader pageTitle={pageTitle} />
                <StyledContent>{children}</StyledContent>
            </MainLayout>
        </StyledLayout>
    );
}
