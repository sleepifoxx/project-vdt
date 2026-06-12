import React, { useState } from 'react';
import { Form, Input, Button, Card, Typography, Alert } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import { login } from '../api/client';
import ViettelLogo from '../components/layout/ViettelLogo';

const { Title, Text } = Typography;

const PageWrapper = styled.div`
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #ee0033 0%, #aa0022 100%);
`;

const LoginCard = styled(Card)`
    width: 380px;
    border-radius: 14px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);

    .ant-card-body {
        padding: 40px 36px;
    }
`;

const LogoArea = styled.div`
    text-align: center;
    margin-bottom: 28px;
`;

const SubmitBtn = styled(Button)`
    height: 42px;
    font-size: 15px;
    font-weight: 600;
    border-radius: 6px;
`;

type FormValues = { username: string; password: string };

export default function LoginPage() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleLogin = async (values: FormValues) => {
        setLoading(true);
        setError('');
        try {
            await login(values.username, values.password);
            navigate('/');
        } catch {
            setError('Tên đăng nhập hoặc mật khẩu không đúng. Vui lòng thử lại.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <PageWrapper>
            <LoginCard bordered={false}>
                <LogoArea>
                    <ViettelLogo />
                    <Title level={4} style={{ marginTop: 16, marginBottom: 4 }}>
                        Viettel MetaHub
                    </Title>
                    <Text type="secondary" style={{ fontSize: 13 }}>
                        Nền tảng quản lý Metadata
                    </Text>
                </LogoArea>

                {error && (
                    <Alert
                        message={error}
                        type="error"
                        showIcon
                        style={{ marginBottom: 20, borderRadius: 6 }}
                    />
                )}

                <Form layout="vertical" onFinish={handleLogin} size="large">
                    <Form.Item
                        name="username"
                        rules={[{ required: true, message: 'Vui lòng nhập tên đăng nhập' }]}
                    >
                        <Input
                            prefix={<UserOutlined style={{ color: '#bbb' }} />}
                            placeholder="Tên đăng nhập"
                        />
                    </Form.Item>

                    <Form.Item
                        name="password"
                        rules={[{ required: true, message: 'Vui lòng nhập mật khẩu' }]}
                    >
                        <Input.Password
                            prefix={<LockOutlined style={{ color: '#bbb' }} />}
                            placeholder="Mật khẩu"
                        />
                    </Form.Item>

                    <Form.Item style={{ marginBottom: 0 }}>
                        <SubmitBtn
                            type="primary"
                            htmlType="submit"
                            block
                            loading={loading}
                            style={{ background: '#ee0033', borderColor: '#ee0033' }}
                        >
                            Đăng nhập
                        </SubmitBtn>
                    </Form.Item>
                </Form>

                <Text
                    type="secondary"
                    style={{ display: 'block', textAlign: 'center', marginTop: 16, fontSize: 12 }}
                >
                    Mặc định: datahub / datahub
                </Text>
            </LoginCard>
        </PageWrapper>
    );
}
