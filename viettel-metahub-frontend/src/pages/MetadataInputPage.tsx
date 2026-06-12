import React from 'react';
import { Alert } from 'antd';
import styled from 'styled-components';
import AppLayout from '../components/layout/AppLayout';
import MetadataForm from '../components/metadata/MetadataForm';
import type { MetadataFormData } from '../types';

const PageWrapper = styled.div`
    padding: 24px;
    max-width: 900px;
`;

export default function MetadataInputPage() {
    const handleSuccess = (data: MetadataFormData) => {
        console.info('Saved metadata:', data);
    };

    return (
        <AppLayout pageTitle="Nhập thông tin Metadata">
            <PageWrapper>
                <Alert
                    message="Hướng dẫn"
                    description="Nhập thông tin metadata cho các đối tượng dữ liệu. Các trường đánh dấu (*) là bắt buộc. Sau khi lưu, metadata sẽ được đồng bộ lên hệ thống DataHub."
                    type="info"
                    showIcon
                    style={{ marginBottom: 20, borderRadius: 8 }}
                />
                <MetadataForm onSuccess={handleSuccess} />
            </PageWrapper>
        </AppLayout>
    );
}
