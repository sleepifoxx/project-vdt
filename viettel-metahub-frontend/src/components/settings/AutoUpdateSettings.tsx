import React, { useState, useEffect } from 'react';
import {
    Table, Tag, Button, Space, Modal, Form, Select, Switch,
    InputNumber, Badge, Tooltip, Typography, message, Alert, Input, Spin,
} from 'antd';
import {
    PlusOutlined, EditOutlined, DeleteOutlined, PlayCircleOutlined,
    SyncOutlined, ClockCircleOutlined, ReloadOutlined,
} from '@ant-design/icons';
import styled from 'styled-components';
import type { ColumnsType } from 'antd/es/table';
import type { AutoUpdateSchedule, ScheduleFrequency, ConnectionConfig } from '../../types';
import {
    listIngestionSchedules,
    listIngestionSources,
    runIngestionSource,
    updateIngestionSourceSchedule,
    deleteIngestionSource,
} from '../../api/datahubApi';

const { Option } = Select;
const { Text } = Typography;

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

const ScheduleCard = styled.div`
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
    }
`;

const FREQUENCY_LABELS: Record<ScheduleFrequency, string> = {
    HOURLY: 'Mỗi giờ',
    DAILY: 'Hàng ngày',
    WEEKLY: 'Hàng tuần',
    MONTHLY: 'Hàng tháng',
    CUSTOM: 'Tuỳ chỉnh (Cron)',
};

const FREQUENCY_COLORS: Record<ScheduleFrequency, string> = {
    HOURLY: 'blue',
    DAILY: 'green',
    WEEKLY: 'purple',
    MONTHLY: 'orange',
    CUSTOM: 'geekblue',
};

const RunStatusMap: Record<string, { color: 'success' | 'processing' | 'error' | 'default'; label: string }> = {
    SUCCESS: { color: 'success', label: 'Thành công' },
    FAILED: { color: 'error', label: 'Thất bại' },
    RUNNING: { color: 'processing', label: 'Đang chạy' },
};

type FormValues = {
    connectionId: string;
    frequency: ScheduleFrequency;
    cronExpression?: string;
    enabled: boolean;
    retainHistory: number;
};

export default function AutoUpdateSettings() {
    const [schedules, setSchedules] = useState<AutoUpdateSchedule[]>([]);
    const [connections, setConnections] = useState<ConnectionConfig[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingSched, setEditingSched] = useState<AutoUpdateSchedule | null>(null);
    const [running, setRunning] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [form] = Form.useForm<FormValues>();
    const selectedFreq = Form.useWatch('frequency', form);

    const reload = () => {
        setLoading(true);
        Promise.all([
            listIngestionSchedules(),
            listIngestionSources(),
        ])
            .then(([scheds, conns]) => {
                setSchedules(scheds);
                setConnections(conns);
            })
            .catch(() => {
                setSchedules([]);
                setConnections([]);
            })
            .finally(() => setLoading(false));
    };

    useEffect(() => { reload(); }, []);

    const openAdd = () => {
        setEditingSched(null);
        form.resetFields();
        form.setFieldsValue({ enabled: true, frequency: 'DAILY', retainHistory: 30 });
        setModalOpen(true);
    };

    const openEdit = (sched: AutoUpdateSchedule) => {
        setEditingSched(sched);
        form.setFieldsValue(sched);
        setModalOpen(true);
    };

    const handleSave = async () => {
        const values = await form.validateFields();
        setSaving(true);
        try {
            const urn = editingSched ? editingSched.id : values.connectionId;
            await updateIngestionSourceSchedule(urn, values.enabled, values.frequency, values.cronExpression);
            message.success(editingSched ? 'Đã cập nhật lịch' : 'Đã đặt lịch cho nguồn dữ liệu');
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
            title: 'Xác nhận xoá lịch',
            content: 'Xoá lịch này sẽ xoá toàn bộ ingestion source khỏi DataHub. Thao tác không thể hoàn tác.',
            okText: 'Xoá',
            okButtonProps: { danger: true },
            cancelText: 'Huỷ',
            onOk: async () => {
                try {
                    await deleteIngestionSource(id);
                    message.success('Đã xoá lịch cập nhật');
                    reload();
                } catch (err: unknown) {
                    message.error(`Lỗi khi xoá: ${err instanceof Error ? err.message : 'Không xác định'}`);
                }
            },
        });
    };

    const handleToggle = async (id: string, enabled: boolean) => {
        const sched = schedules.find((s) => s.id === id);
        if (!sched) return;
        try {
            await updateIngestionSourceSchedule(id, enabled, sched.frequency, sched.cronExpression);
            message.success(enabled ? 'Đã bật lịch' : 'Đã tắt lịch');
            reload();
        } catch (err: unknown) {
            message.error(`Lỗi: ${err instanceof Error ? err.message : 'Không xác định'}`);
        }
    };

    const handleRunNow = async (id: string) => {
        setRunning(id);
        setSchedules((prev) =>
            prev.map((s) => (s.id === id ? { ...s, lastRunStatus: 'RUNNING' } : s)),
        );

        try {
            await runIngestionSource(id);
            message.success('Đã kích hoạt thu thập metadata thành công!');
            // Refresh schedules after a short delay to pick up new execution status
            setTimeout(() => {
                listIngestionSchedules()
                    .then(setSchedules)
                    .catch(() => {/* ignore */});
            }, 5000);
        } catch (err: unknown) {
            const errMsg = err instanceof Error ? err.message : 'Lỗi không xác định';
            message.error(`Không thể kích hoạt: ${errMsg}`);
            setSchedules((prev) =>
                prev.map((s) => (s.id === id ? { ...s, lastRunStatus: 'FAILED' } : s)),
            );
        } finally {
            setRunning(null);
        }
    };

    const columns: ColumnsType<AutoUpdateSchedule> = [
        {
            title: 'Nguồn dữ liệu',
            dataIndex: 'connectionName',
            key: 'connectionName',
            render: (name: string) => (
                <Text strong style={{ fontSize: 13 }}>
                    {name}
                </Text>
            ),
        },
        {
            title: 'Tần suất',
            dataIndex: 'frequency',
            key: 'frequency',
            width: 160,
            render: (freq: ScheduleFrequency, record) => (
                <Space direction="vertical" size={2}>
                    <Tag color={FREQUENCY_COLORS[freq]}>{FREQUENCY_LABELS[freq]}</Tag>
                    {(freq === 'CUSTOM' || record.cronExpression) && (
                        <Text type="secondary" style={{ fontSize: 11, fontFamily: 'monospace' }}>
                            {record.cronExpression}
                        </Text>
                    )}
                </Space>
            ),
        },
        {
            title: 'Kích hoạt',
            key: 'enabled',
            width: 120,
            render: (_, record) => (
                <Switch
                    checked={record.enabled}
                    checkedChildren="Bật"
                    unCheckedChildren="Tắt"
                    onChange={(val) => handleToggle(record.id, val)}
                    style={{ background: record.enabled ? '#ee0033' : undefined }}
                />
            ),
        },
        {
            title: 'Lần chạy gần nhất',
            key: 'lastRun',
            width: 190,
            render: (_, record) => (
                <Space direction="vertical" size={2}>
                    {record.lastRunAt ? (
                        <Text style={{ fontSize: 12 }}>
                            {new Date(record.lastRunAt).toLocaleString('vi-VN')}
                        </Text>
                    ) : (
                        <Text type="secondary" style={{ fontSize: 12 }}>Chưa chạy</Text>
                    )}
                    {record.lastRunStatus && RunStatusMap[record.lastRunStatus] && (
                        <Badge
                            status={RunStatusMap[record.lastRunStatus].color}
                            text={RunStatusMap[record.lastRunStatus].label}
                        />
                    )}
                </Space>
            ),
        },
        {
            title: 'Lần chạy tiếp theo',
            dataIndex: 'nextRunAt',
            key: 'nextRunAt',
            width: 150,
            render: (date: string | undefined, record: AutoUpdateSchedule) =>
                record.enabled && date ? (
                    <Space>
                        <ClockCircleOutlined style={{ color: '#faad14' }} />
                        <Text style={{ fontSize: 12 }}>
                            {new Date(date).toLocaleString('vi-VN')}
                        </Text>
                    </Space>
                ) : (
                    <Text type="secondary">—</Text>
                ),
        },
        {
            title: 'Thao tác',
            key: 'actions',
            width: 180,
            render: (_, record) => (
                <Space>
                    <Tooltip title="Chạy ngay">
                        <Button
                            size="small"
                            icon={<PlayCircleOutlined />}
                            onClick={() => handleRunNow(record.id)}
                            loading={running === record.id}
                            style={{ color: '#ee0033', borderColor: '#ee0033' }}
                        >
                            Chạy ngay
                        </Button>
                    </Tooltip>
                    <Tooltip title="Chỉnh sửa">
                        <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />
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
                    <SyncOutlined />
                    Lịch tự động cập nhật Metadata
                </h2>
                <Space>
                    <Button
                        icon={<ReloadOutlined />}
                        onClick={reload}
                        loading={loading}
                        size="small"
                    >
                        Làm mới
                    </Button>
                    <AddBtn icon={<PlusOutlined />} onClick={openAdd}>
                        Thêm lịch
                    </AddBtn>
                </Space>
            </PageHeader>

            <Alert
                message="Dữ liệu lấy trực tiếp từ DataHub Ingestion Sources. Nút Chạy ngay sẽ kích hoạt thu thập metadata thật sự."
                type="info"
                showIcon
                style={{ marginBottom: 16, borderRadius: 8 }}
            />

            <ScheduleCard>
                <Table
                    columns={columns}
                    dataSource={schedules}
                    rowKey="id"
                    size="middle"
                    loading={loading}
                    pagination={false}
                    locale={{
                        emptyText: loading
                            ? <Spin size="small" tip="Đang tải..." />
                            : 'Chưa có ingestion source nào được cấu hình. Thêm mới tại trang DataHub Admin hoặc dùng nút Thêm lịch.'
                    }}
                />
            </ScheduleCard>

            <Modal
                title={editingSched ? 'Chỉnh sửa lịch cập nhật' : 'Thêm lịch cập nhật'}
                open={modalOpen}
                onOk={handleSave}
                onCancel={() => setModalOpen(false)}
                okText="Lưu"
                cancelText="Huỷ"
                okButtonProps={{ style: { background: '#ee0033', borderColor: '#ee0033' }, loading: saving }}
                width={520}
            >
                <Form form={form} layout="vertical">
                    <Form.Item
                        name="connectionId"
                        label="Nguồn dữ liệu"
                        rules={[{ required: true, message: 'Vui lòng chọn nguồn dữ liệu' }]}
                    >
                        <Select placeholder="Chọn nguồn dữ liệu" notFoundContent="Không có nguồn dữ liệu nào">
                            {connections.map((c) => (
                                <Option key={c.id} value={c.id}>
                                    <Space>
                                        <Tag color="blue">{c.type}</Tag>
                                        {c.name}
                                    </Space>
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>

                    <Form.Item
                        name="frequency"
                        label="Tần suất cập nhật"
                        rules={[{ required: true }]}
                    >
                        <Select>
                            {Object.entries(FREQUENCY_LABELS).map(([key, label]) => (
                                <Option key={key} value={key}>
                                    {label}
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>

                    {selectedFreq === 'CUSTOM' && (
                        <Form.Item
                            name="cronExpression"
                            label="Biểu thức Cron"
                            rules={[{ required: true, message: 'Vui lòng nhập biểu thức cron' }]}
                            extra="VD: 0 2 * * * (chạy lúc 2:00 AM mỗi ngày)"
                        >
                            <Input placeholder="0 2 * * *" style={{ fontFamily: 'monospace' }} />
                        </Form.Item>
                    )}

                    <Form.Item
                        name="retainHistory"
                        label="Số ngày lưu lịch sử"
                        rules={[{ required: true }]}
                    >
                        <InputNumber min={1} max={365} style={{ width: '100%' }} addonAfter="ngày" />
                    </Form.Item>

                    <Form.Item name="enabled" label="Kích hoạt" valuePropName="checked">
                        <Switch checkedChildren="Bật" unCheckedChildren="Tắt" />
                    </Form.Item>
                </Form>
            </Modal>
        </>
    );
}
