import React, { useState } from 'react';
import {
    Table, Tag, Button, Space, Modal, Form, Input, Select, Switch,
    InputNumber, Badge, Tooltip, Typography, Divider, message,
} from 'antd';
import {
    PlusOutlined, EditOutlined, DeleteOutlined, LinkOutlined,
    CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined,
    ApiOutlined,
} from '@ant-design/icons';
import styled from 'styled-components';
import type { ColumnsType } from 'antd/es/table';
import type { ConnectionConfig, ConnectionType } from '../../types';
import { mockConnections } from '../../api/mockData';

const { Option } = Select;
const { Text } = Typography;
const { Password } = Input;

const PageHeader = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20px;

    h2 {
        font-size: 16px;
        font-weight: 600;
        color: #212121;
        margin: 0;
        display: flex;
        align-items: center;
        gap: 8px;

        .anticon {
            color: #ee0033;
        }
    }
`;

const ConnectionCard = styled.div`
    background: white;
    border-radius: 10px;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
    border: 1px solid #f0f0f0;
    overflow: hidden;
`;

const AddBtn = styled(Button)`
    background: #ee0033 !important;
    border-color: #ee0033 !important;
    color: white !important;
    border-radius: 6px;

    &:hover {
        background: #cc0029 !important;
        border-color: #cc0029 !important;
    }
`;

const StatusMap: Record<string, { color: string; label: string; icon: React.ReactNode }> = {
    CONNECTED: { color: 'success', label: 'Đã kết nối', icon: <CheckCircleOutlined style={{ color: '#52c41a' }} /> },
    DISCONNECTED: { color: 'default', label: 'Chưa kết nối', icon: <CloseCircleOutlined style={{ color: '#9e9e9e' }} /> },
    ERROR: { color: 'error', label: 'Lỗi', icon: <CloseCircleOutlined style={{ color: '#ff4d4f' }} /> },
    TESTING: { color: 'processing', label: 'Đang kiểm tra', icon: <LoadingOutlined style={{ color: '#1677ff' }} /> },
};

const CONNECTION_TYPES: ConnectionType[] = [
    'MYSQL', 'POSTGRESQL', 'ORACLE', 'MSSQL', 'MONGODB', 'KAFKA', 'HIVE', 'SPARK', 'REST_API', 'JDBC',
];

const DEFAULT_PORTS: Record<ConnectionType, number> = {
    MYSQL: 3306, POSTGRESQL: 5432, ORACLE: 1521, MSSQL: 1433,
    MONGODB: 27017, KAFKA: 9092, HIVE: 10000, SPARK: 7077,
    REST_API: 443, JDBC: 5432,
};

type FormValues = Omit<ConnectionConfig, 'id' | 'status' | 'lastTestedAt'>;

export default function ConnectionSettings() {
    const [connections, setConnections] = useState<ConnectionConfig[]>(mockConnections);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingConn, setEditingConn] = useState<ConnectionConfig | null>(null);
    const [testing, setTesting] = useState<string | null>(null);
    const [form] = Form.useForm<FormValues>();

    const openAdd = () => {
        setEditingConn(null);
        form.resetFields();
        form.setFieldsValue({ ssl: false, port: 3306, type: 'MYSQL' });
        setModalOpen(true);
    };

    const openEdit = (conn: ConnectionConfig) => {
        setEditingConn(conn);
        form.setFieldsValue(conn);
        setModalOpen(true);
    };

    const handleSave = async () => {
        const values = await form.validateFields();
        if (editingConn) {
            setConnections((prev) =>
                prev.map((c) => (c.id === editingConn.id ? { ...editingConn, ...values } : c)),
            );
            message.success('Đã cập nhật kết nối');
        } else {
            const newConn: ConnectionConfig = {
                ...values,
                id: `conn-${Date.now()}`,
                status: 'DISCONNECTED',
            };
            setConnections((prev) => [...prev, newConn]);
            message.success('Đã thêm kết nối mới');
        }
        setModalOpen(false);
    };

    const handleDelete = (id: string) => {
        Modal.confirm({
            title: 'Xác nhận xoá',
            content: 'Bạn có chắc muốn xoá kết nối này không?',
            okText: 'Xoá',
            okButtonProps: { danger: true },
            cancelText: 'Huỷ',
            onOk: () => {
                setConnections((prev) => prev.filter((c) => c.id !== id));
                message.success('Đã xoá kết nối');
            },
        });
    };

    const handleTest = (id: string) => {
        setTesting(id);
        setConnections((prev) =>
            prev.map((c) => (c.id === id ? { ...c, status: 'TESTING' } : c)),
        );
        setTimeout(() => {
            const success = Math.random() > 0.3;
            setConnections((prev) =>
                prev.map((c) =>
                    c.id === id
                        ? { ...c, status: success ? 'CONNECTED' : 'ERROR', lastTestedAt: new Date().toISOString() }
                        : c,
                ),
            );
            message.open({
                type: success ? 'success' : 'error',
                content: success ? 'Kết nối thành công!' : 'Kết nối thất bại. Vui lòng kiểm tra cấu hình.',
            });
            setTesting(null);
        }, 2000);
    };

    const columns: ColumnsType<ConnectionConfig> = [
        {
            title: 'Tên kết nối',
            dataIndex: 'name',
            key: 'name',
            render: (name: string, record) => (
                <Space>
                    {StatusMap[record.status].icon}
                    <div>
                        <Text strong style={{ fontSize: 13 }}>
                            {name}
                        </Text>
                        <br />
                        <Text type="secondary" style={{ fontSize: 11 }}>
                            {record.host}:{record.port}
                        </Text>
                    </div>
                </Space>
            ),
        },
        {
            title: 'Loại',
            dataIndex: 'type',
            key: 'type',
            width: 120,
            render: (type: string) => <Tag color="blue">{type}</Tag>,
        },
        {
            title: 'Database',
            dataIndex: 'database',
            key: 'database',
            width: 140,
            render: (db?: string) => <Text style={{ fontSize: 12 }}>{db || '—'}</Text>,
        },
        {
            title: 'SSL',
            dataIndex: 'ssl',
            key: 'ssl',
            width: 70,
            render: (ssl: boolean) => <Tag color={ssl ? 'green' : 'default'}>{ssl ? 'Bật' : 'Tắt'}</Tag>,
        },
        {
            title: 'Trạng thái',
            dataIndex: 'status',
            key: 'status',
            width: 140,
            render: (status: string) => {
                const s = StatusMap[status];
                return <Badge status={s.color as any} text={s.label} />;
            },
        },
        {
            title: 'Kiểm tra lần cuối',
            dataIndex: 'lastTestedAt',
            key: 'lastTestedAt',
            width: 140,
            render: (date?: string) =>
                date ? (
                    <Text style={{ fontSize: 12, color: '#9e9e9e' }}>
                        {new Date(date).toLocaleString('vi-VN')}
                    </Text>
                ) : (
                    '—'
                ),
        },
        {
            title: 'Thao tác',
            key: 'actions',
            width: 180,
            render: (_, record) => (
                <Space>
                    <Tooltip title="Kiểm tra kết nối">
                        <Button
                            size="small"
                            icon={<LinkOutlined />}
                            onClick={() => handleTest(record.id)}
                            loading={testing === record.id}
                        >
                            Kiểm tra
                        </Button>
                    </Tooltip>
                    <Tooltip title="Chỉnh sửa">
                        <Button
                            size="small"
                            icon={<EditOutlined />}
                            onClick={() => openEdit(record)}
                        />
                    </Tooltip>
                    <Tooltip title="Xoá">
                        <Button
                            size="small"
                            danger
                            icon={<DeleteOutlined />}
                            onClick={() => handleDelete(record.id)}
                        />
                    </Tooltip>
                </Space>
            ),
        },
    ];

    return (
        <>
            <PageHeader>
                <h2>
                    <ApiOutlined />
                    Quản lý kết nối
                </h2>
                <AddBtn icon={<PlusOutlined />} onClick={openAdd}>
                    Thêm kết nối
                </AddBtn>
            </PageHeader>

            <ConnectionCard>
                <Table columns={columns} dataSource={connections} rowKey="id" size="middle" pagination={false} />
            </ConnectionCard>

            <Modal
                title={editingConn ? 'Chỉnh sửa kết nối' : 'Thêm kết nối mới'}
                open={modalOpen}
                onOk={handleSave}
                onCancel={() => setModalOpen(false)}
                okText="Lưu"
                cancelText="Huỷ"
                okButtonProps={{ style: { background: '#ee0033', borderColor: '#ee0033' } }}
                width={600}
            >
                <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
                    <Form.Item
                        name="name"
                        label="Tên kết nối"
                        rules={[{ required: true, message: 'Vui lòng nhập tên kết nối' }]}
                    >
                        <Input placeholder="VD: MySQL Production DWH" />
                    </Form.Item>

                    <Form.Item
                        name="type"
                        label="Loại kết nối"
                        rules={[{ required: true }]}
                    >
                        <Select
                            onChange={(type: ConnectionType) => {
                                form.setFieldValue('port', DEFAULT_PORTS[type]);
                            }}
                        >
                            {CONNECTION_TYPES.map((t) => (
                                <Option key={t} value={t}>
                                    {t}
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>

                    <Space style={{ width: '100%' }} size={16}>
                        <Form.Item
                            name="host"
                            label="Host"
                            rules={[{ required: true, message: 'Vui lòng nhập host' }]}
                            style={{ flex: 2 }}
                        >
                            <Input placeholder="VD: mysql.viettel.internal" />
                        </Form.Item>
                        <Form.Item
                            name="port"
                            label="Port"
                            rules={[{ required: true }]}
                            style={{ flex: 1 }}
                        >
                            <InputNumber style={{ width: '100%' }} min={1} max={65535} />
                        </Form.Item>
                    </Space>

                    <Form.Item name="database" label="Tên database">
                        <Input placeholder="VD: viettel_dwh" />
                    </Form.Item>

                    <Space style={{ width: '100%' }} size={16}>
                        <Form.Item
                            name="username"
                            label="Tên đăng nhập"
                            rules={[{ required: true, message: 'Vui lòng nhập username' }]}
                            style={{ flex: 1 }}
                        >
                            <Input placeholder="username" />
                        </Form.Item>
                        <Form.Item name="password" label="Mật khẩu" style={{ flex: 1 }}>
                            <Password placeholder="password" />
                        </Form.Item>
                    </Space>

                    <Form.Item name="ssl" label="Bật SSL" valuePropName="checked">
                        <Switch checkedChildren="Bật" unCheckedChildren="Tắt" />
                    </Form.Item>
                </Form>
            </Modal>
        </>
    );
}
