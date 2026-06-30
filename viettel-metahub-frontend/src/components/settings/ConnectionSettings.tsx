import React, { useState, useEffect } from 'react';
import {
    Table, Tag, Button, Space, Modal, Form, Input, Select, Switch,
    InputNumber, Badge, Tooltip, Typography, Divider, message, Drawer,
    Timeline, Spin, Alert,
} from 'antd';
import {
    PlusOutlined, EditOutlined, DeleteOutlined, LinkOutlined,
    CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined,
    ApiOutlined, CodeOutlined, FileTextOutlined,
} from '@ant-design/icons';
import styled from 'styled-components';
import type { ColumnsType } from 'antd/es/table';
import type { ConnectionConfig, ConnectionType } from '../../types';
import {
    listIngestionSources,
    createIngestionSource,
    updateIngestionSourceDetails,
    deleteIngestionSource,
    runIngestionSource,
    getIngestionExecutions,
} from '../../api/datahubApi';
import type { IngestionExecution } from '../../api/datahubApi';

const { Option } = Select;
const { Text } = Typography;
const { Password, TextArea } = Input;

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

        .anticon { color: #ee0033; }
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

const LogBox = styled.pre`
    background: #1e1e1e;
    color: #d4d4d4;
    padding: 12px;
    border-radius: 6px;
    font-size: 11px;
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-word;
    max-height: 320px;
    overflow-y: auto;
    margin: 0;
`;

const StatusMap: Record<string, { color: string; label: string; icon: React.ReactNode }> = {
    CONNECTED:    { color: 'success',    label: 'Đã kết nối',    icon: <CheckCircleOutlined style={{ color: '#52c41a' }} /> },
    DISCONNECTED: { color: 'default',    label: 'Chưa kết nối',  icon: <CloseCircleOutlined style={{ color: '#9e9e9e' }} /> },
    ERROR:        { color: 'error',      label: 'Lỗi',           icon: <CloseCircleOutlined style={{ color: '#ff4d4f' }} /> },
    TESTING:      { color: 'processing', label: 'Đang kiểm tra', icon: <LoadingOutlined    style={{ color: '#1677ff' }} /> },
};

// Connection types with labels + default ports
const CONNECTION_META: { type: ConnectionType; label: string; defaultPort?: number }[] = [
    { type: 'CUSTOM',      label: '⚙ Kết nối tuỳ chỉnh (Recipe YAML)' },
    { type: 'MYSQL',       label: 'MySQL',        defaultPort: 3306 },
    { type: 'POSTGRESQL',  label: 'PostgreSQL',   defaultPort: 5432 },
    { type: 'ORACLE',      label: 'Oracle DB',    defaultPort: 1521 },
    { type: 'MSSQL',       label: 'SQL Server',   defaultPort: 1433 },
    { type: 'MONGODB',     label: 'MongoDB',      defaultPort: 27017 },
    { type: 'KAFKA',       label: 'Kafka',        defaultPort: 9092 },
    { type: 'HIVE',        label: 'Apache Hive',  defaultPort: 10000 },
    { type: 'SPARK',       label: 'Apache Spark', defaultPort: 7077 },
    { type: 'REST_API',    label: 'REST API / OpenAPI' },
    { type: 'JDBC',        label: 'JDBC (Generic)' },
];

const DEFAULT_PORT: Partial<Record<ConnectionType, number>> = Object.fromEntries(
    CONNECTION_META.filter((m) => m.defaultPort).map((m) => [m.type, m.defaultPort]),
);

type FormValues = Omit<ConnectionConfig, 'id' | 'status' | 'lastTestedAt'>;

// Fields shown per connection type
function ConnectionFields({ type }: { type: ConnectionType }) {
    if (type === 'CUSTOM') {
        return (
            <>
                <Text type="secondary" style={{ display: 'block', marginBottom: 8, fontSize: 12 }}>
                    Nhập recipe YAML theo định dạng DataHub. Xem tài liệu tại{' '}
                    <a href="https://docs.datahub.com/docs/metadata-ingestion" target="_blank" rel="noreferrer">
                        docs.datahub.com
                    </a>
                </Text>
                <Form.Item
                    name="customRecipe"
                    label="Recipe YAML / JSON"
                    rules={[{ required: true, message: 'Vui lòng nhập recipe' }]}
                >
                    <TextArea
                        rows={12}
                        placeholder={`source:\n  type: postgres\n  config:\n    host_port: host.docker.internal:5432\n    database: mydb\n    username: user\n    password: pass\nsink:\n  type: datahub-rest\n  config:\n    server: http://datahub-gms:8080`}
                        style={{ fontFamily: 'monospace', fontSize: 12 }}
                    />
                </Form.Item>
            </>
        );
    }

    if (type === 'KAFKA') {
        return (
            <>
                <Form.Item name="bootstrapServers" label="Bootstrap Servers" rules={[{ required: true }]}>
                    <Input placeholder="host.docker.internal:9092" />
                </Form.Item>
                <Form.Item name="schemaRegistryUrl" label="Schema Registry URL">
                    <Input placeholder="http://host.docker.internal:8081" />
                </Form.Item>
            </>
        );
    }

    if (type === 'REST_API') {
        return (
            <>
                <Form.Item name="connectionUrl" label="Base URL" rules={[{ required: true }]}>
                    <Input placeholder="https://api.example.com" />
                </Form.Item>
                <Form.Item name="token" label="Bearer Token">
                    <Password placeholder="Token xác thực (nếu có)" />
                </Form.Item>
            </>
        );
    }

    if (type === 'JDBC') {
        return (
            <>
                <Form.Item name="connectionUrl" label="JDBC Connection URL" rules={[{ required: true }]}>
                    <Input placeholder="jdbc:postgresql://host.docker.internal:5432/mydb" />
                </Form.Item>
                <Space style={{ width: '100%' }} size={16}>
                    <Form.Item name="username" label="Username" style={{ flex: 1 }} rules={[{ required: true }]}>
                        <Input />
                    </Form.Item>
                    <Form.Item name="password" label="Password" style={{ flex: 1 }}>
                        <Password />
                    </Form.Item>
                </Space>
            </>
        );
    }

    if (type === 'ORACLE') {
        return (
            <>
                <Space style={{ width: '100%' }} size={16}>
                    <Form.Item name="host" label="Host" style={{ flex: 2 }} rules={[{ required: true }]}>
                        <Input placeholder="host.docker.internal" />
                    </Form.Item>
                    <Form.Item name="port" label="Port" style={{ flex: 1 }} rules={[{ required: true }]}>
                        <InputNumber style={{ width: '100%' }} min={1} max={65535} />
                    </Form.Item>
                </Space>
                <Form.Item name="serviceNameOrSid" label="Service Name / SID" rules={[{ required: true }]}>
                    <Input placeholder="ORCL" />
                </Form.Item>
                <Space style={{ width: '100%' }} size={16}>
                    <Form.Item name="username" label="Username" style={{ flex: 1 }} rules={[{ required: true }]}>
                        <Input />
                    </Form.Item>
                    <Form.Item name="password" label="Password" style={{ flex: 1 }}>
                        <Password />
                    </Form.Item>
                </Space>
            </>
        );
    }

    if (type === 'MONGODB') {
        return (
            <>
                <Space style={{ width: '100%' }} size={16}>
                    <Form.Item name="host" label="Host" style={{ flex: 2 }} rules={[{ required: true }]}>
                        <Input placeholder="host.docker.internal" />
                    </Form.Item>
                    <Form.Item name="port" label="Port" style={{ flex: 1 }} rules={[{ required: true }]}>
                        <InputNumber style={{ width: '100%' }} min={1} max={65535} />
                    </Form.Item>
                </Space>
                <Form.Item name="database" label="Database">
                    <Input placeholder="mydb" />
                </Form.Item>
                <Space style={{ width: '100%' }} size={16}>
                    <Form.Item name="username" label="Username" style={{ flex: 1 }}>
                        <Input />
                    </Form.Item>
                    <Form.Item name="password" label="Password" style={{ flex: 1 }}>
                        <Password />
                    </Form.Item>
                </Space>
            </>
        );
    }

    // MySQL, PostgreSQL, MSSQL, Hive, Spark
    const showSchema = type === 'POSTGRESQL';
    const showSsl = ['MYSQL', 'POSTGRESQL', 'MSSQL'].includes(type);

    return (
        <>
            <Space style={{ width: '100%' }} size={16}>
                <Form.Item name="host" label="Host" style={{ flex: 2 }} rules={[{ required: true }]}>
                    <Input placeholder="host.docker.internal" />
                </Form.Item>
                <Form.Item name="port" label="Port" style={{ flex: 1 }} rules={[{ required: true }]}>
                    <InputNumber style={{ width: '100%' }} min={1} max={65535} />
                </Form.Item>
            </Space>
            <Form.Item name="database" label="Database">
                <Input placeholder="tên database" />
            </Form.Item>
            {showSchema && (
                <Form.Item name="schema" label="Schema (tuỳ chọn)">
                    <Input placeholder="public" />
                </Form.Item>
            )}
            <Space style={{ width: '100%' }} size={16}>
                <Form.Item name="username" label="Username" style={{ flex: 1 }} rules={[{ required: true }]}>
                    <Input />
                </Form.Item>
                <Form.Item name="password" label="Password" style={{ flex: 1 }}>
                    <Password />
                </Form.Item>
            </Space>
            {showSsl && (
                <Form.Item name="ssl" label="Bật SSL" valuePropName="checked">
                    <Switch checkedChildren="Bật" unCheckedChildren="Tắt" />
                </Form.Item>
            )}
        </>
    );
}

export default function ConnectionSettings() {
    const [connections, setConnections] = useState<ConnectionConfig[]>([]);
    const [loadingInit, setLoadingInit] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingConn, setEditingConn] = useState<ConnectionConfig | null>(null);
    const [testing, setTesting] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [selectedType, setSelectedType] = useState<ConnectionType>('MYSQL');
    const [form] = Form.useForm<FormValues>();
    const [logDrawer, setLogDrawer] = useState<{ open: boolean; conn: ConnectionConfig | null }>({ open: false, conn: null });
    const [executions, setExecutions] = useState<IngestionExecution[]>([]);
    const [logLoading, setLogLoading] = useState(false);

    const reload = () => {
        setLoadingInit(true);
        listIngestionSources()
            .then(setConnections)
            .catch(() => setConnections([]))
            .finally(() => setLoadingInit(false));
    };

    useEffect(() => { reload(); }, []);

    const openLog = async (conn: ConnectionConfig) => {
        setLogDrawer({ open: true, conn });
        setLogLoading(true);
        setExecutions([]);
        try {
            const execs = await getIngestionExecutions(conn.id, 5);
            setExecutions(execs);
        } catch {
            setExecutions([]);
        } finally {
            setLogLoading(false);
        }
    };

    const openAdd = () => {
        setEditingConn(null);
        setSelectedType('MYSQL');
        form.resetFields();
        form.setFieldsValue({ type: 'MYSQL', ssl: false, port: 3306 });
        setModalOpen(true);
    };

    const openEdit = (conn: ConnectionConfig) => {
        setEditingConn(conn);
        setSelectedType(conn.type);
        form.setFieldsValue(conn);
        setModalOpen(true);
    };

    const handleTypeChange = (type: ConnectionType) => {
        setSelectedType(type);
        form.setFieldsValue({
            host: undefined, port: DEFAULT_PORT[type], database: undefined,
            username: undefined, password: undefined, ssl: false,
            schema: undefined, serviceNameOrSid: undefined,
            bootstrapServers: undefined, schemaRegistryUrl: undefined,
            connectionUrl: undefined, token: undefined, customRecipe: undefined,
        });
    };

    const handleSave = async () => {
        const values = await form.validateFields();
        setSaving(true);
        try {
            if (editingConn) {
                await updateIngestionSourceDetails(editingConn.id, values);
                message.success('Đã cập nhật kết nối');
            } else {
                await createIngestionSource(values);
                message.success('Đã thêm kết nối mới');
            }
            setModalOpen(false);
            reload();
        } catch (err: unknown) {
            message.error(`Lỗi: ${err instanceof Error ? err.message : 'Không xác định'}`);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = (id: string) => {
        Modal.confirm({
            title: 'Xác nhận xoá',
            content: 'Xoá ingestion source này khỏi DataHub. Thao tác không thể hoàn tác.',
            okText: 'Xoá',
            okButtonProps: { danger: true },
            cancelText: 'Huỷ',
            onOk: async () => {
                try {
                    await deleteIngestionSource(id);
                    message.success('Đã xoá kết nối');
                    reload();
                } catch (err: unknown) {
                    message.error(`Lỗi khi xoá: ${err instanceof Error ? err.message : 'Không xác định'}`);
                }
            },
        });
    };

    const handleTest = async (id: string) => {
        setTesting(id);
        setConnections((prev) => prev.map((c) => (c.id === id ? { ...c, status: 'TESTING' } : c)));
        try {
            await runIngestionSource(id);
            message.info('Đã kích hoạt chạy thử — kết quả sẽ cập nhật sau vài giây');
            setTimeout(() => { reload(); setTesting(null); }, 5000);
        } catch (err: unknown) {
            message.error(`Không thể kiểm tra: ${err instanceof Error ? err.message : 'Lỗi không xác định'}`);
            setConnections((prev) => prev.map((c) => (c.id === id ? { ...c, status: 'ERROR' } : c)));
            setTesting(null);
        }
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
                        <Text
                            strong
                            style={{ fontSize: 13, cursor: 'pointer', color: record.status === 'ERROR' ? '#ff4d4f' : undefined }}
                            onClick={() => openLog(record)}
                            title="Xem log thực thi"
                        >
                            {name} <FileTextOutlined style={{ fontSize: 11, opacity: 0.6 }} />
                        </Text>
                        <br />
                        <Text type="secondary" style={{ fontSize: 11 }}>
                            {record.type === 'CUSTOM'
                                ? 'Recipe tuỳ chỉnh'
                                : record.type === 'KAFKA'
                                ? record.bootstrapServers ?? ''
                                : record.type === 'REST_API' || record.type === 'JDBC'
                                ? record.connectionUrl ?? ''
                                : record.host ? `${record.host}:${record.port}` : ''}
                        </Text>
                    </div>
                </Space>
            ),
        },
        {
            title: 'Loại',
            dataIndex: 'type',
            key: 'type',
            width: 130,
            render: (type: ConnectionType) => (
                <Tag color={type === 'CUSTOM' ? 'purple' : 'blue'} icon={type === 'CUSTOM' ? <CodeOutlined /> : undefined}>
                    {type === 'CUSTOM' ? 'Tuỳ chỉnh' : type}
                </Tag>
            ),
        },
        {
            title: 'Database',
            dataIndex: 'database',
            key: 'database',
            width: 140,
            render: (db?: string, record?: ConnectionConfig) => (
                <Text style={{ fontSize: 12 }}>
                    {record?.serviceNameOrSid ?? db ?? '—'}
                </Text>
            ),
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
                ) : '—',
        },
        {
            title: 'Thao tác',
            key: 'actions',
            width: 180,
            render: (_, record) => (
                <Space>
                    <Tooltip title="Chạy thử ingestion">
                        <Button size="small" icon={<LinkOutlined />} onClick={() => handleTest(record.id)} loading={testing === record.id}>
                            Chạy thử
                        </Button>
                    </Tooltip>
                    <Tooltip title="Chỉnh sửa">
                        <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />
                    </Tooltip>
                    <Tooltip title="Xoá">
                        <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record.id)} />
                    </Tooltip>
                </Space>
            ),
        },
    ];

    return (
        <>
            <PageHeader>
                <h2><ApiOutlined /> Quản lý kết nối</h2>
                <AddBtn icon={<PlusOutlined />} onClick={openAdd}>Thêm kết nối</AddBtn>
            </PageHeader>

            <ConnectionCard>
                <Table
                    columns={columns}
                    dataSource={connections}
                    rowKey="id"
                    size="middle"
                    pagination={false}
                    loading={loadingInit}
                />
            </ConnectionCard>

            <Drawer
                title={
                    <Space>
                        <FileTextOutlined />
                        Log thực thi — {logDrawer.conn?.name}
                    </Space>
                }
                open={logDrawer.open}
                onClose={() => setLogDrawer({ open: false, conn: null })}
                width={600}
                destroyOnClose
            >
                {logLoading ? (
                    <div style={{ textAlign: 'center', paddingTop: 40 }}><Spin /></div>
                ) : executions.length === 0 ? (
                    <Alert message="Chưa có lần thực thi nào được ghi nhận." type="info" showIcon />
                ) : (
                    <Timeline
                        items={executions.map((exec) => {
                            const status = exec.result?.status ?? 'UNKNOWN';
                            const isError = status === 'FAILURE' || status === 'FAILED';
                            const startMs = exec.result?.startTimeMs ?? exec.input?.requestedAt;
                            const durationMs = exec.result?.durationMs;
                            return {
                                color: isError ? 'red' : status === 'SUCCESS' ? 'green' : 'blue',
                                children: (
                                    <div>
                                        <Space style={{ marginBottom: 4 }}>
                                            <Tag color={isError ? 'error' : status === 'SUCCESS' ? 'success' : 'processing'}>
                                                {status}
                                            </Tag>
                                            {startMs && (
                                                <Text type="secondary" style={{ fontSize: 11 }}>
                                                    {new Date(startMs).toLocaleString('vi-VN')}
                                                </Text>
                                            )}
                                            {durationMs && (
                                                <Text type="secondary" style={{ fontSize: 11 }}>
                                                    ({(durationMs / 1000).toFixed(1)}s)
                                                </Text>
                                            )}
                                        </Space>
                                        {exec.result?.report && (
                                            <LogBox>{exec.result.report}</LogBox>
                                        )}
                                    </div>
                                ),
                            };
                        })}
                    />
                )}
            </Drawer>

            <Modal
                title={editingConn ? 'Chỉnh sửa kết nối' : 'Thêm kết nối mới'}
                open={modalOpen}
                onOk={handleSave}
                onCancel={() => setModalOpen(false)}
                okText="Lưu"
                cancelText="Huỷ"
                okButtonProps={{ style: { background: '#ee0033', borderColor: '#ee0033' }, loading: saving }}
                width={620}
                destroyOnClose
            >
                <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
                    <Form.Item name="name" label="Tên kết nối" rules={[{ required: true, message: 'Vui lòng nhập tên kết nối' }]}>
                        <Input placeholder="VD: PostgreSQL Production" />
                    </Form.Item>

                    <Form.Item name="type" label="Loại kết nối" rules={[{ required: true }]}>
                        <Select onChange={handleTypeChange}>
                            {CONNECTION_META.map(({ type, label }) => (
                                <Option key={type} value={type}>{label}</Option>
                            ))}
                        </Select>
                    </Form.Item>

                    <Divider style={{ margin: '12px 0' }} />

                    <ConnectionFields type={selectedType} />
                </Form>
            </Modal>
        </>
    );
}
