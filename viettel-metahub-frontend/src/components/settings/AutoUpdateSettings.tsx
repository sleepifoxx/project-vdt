import React, { useState } from 'react';
import {
    Table, Tag, Button, Space, Modal, Form, Select, Switch,
    InputNumber, Badge, Tooltip, Typography, message, Alert, Input,
} from 'antd';
import {
    PlusOutlined, EditOutlined, DeleteOutlined, PlayCircleOutlined,
    PauseCircleOutlined, SyncOutlined, ClockCircleOutlined,
} from '@ant-design/icons';
import styled from 'styled-components';
import type { ColumnsType } from 'antd/es/table';
import type { AutoUpdateSchedule, ScheduleFrequency } from '../../types';
import { mockSchedules, mockConnections } from '../../api/mockData';

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
    const [schedules, setSchedules] = useState<AutoUpdateSchedule[]>(mockSchedules);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingSched, setEditingSched] = useState<AutoUpdateSchedule | null>(null);
    const [running, setRunning] = useState<string | null>(null);
    const [form] = Form.useForm<FormValues>();
    const selectedFreq = Form.useWatch('frequency', form);

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
        const conn = mockConnections.find((c) => c.id === values.connectionId);
        if (editingSched) {
            setSchedules((prev) =>
                prev.map((s) =>
                    s.id === editingSched.id
                        ? { ...editingSched, ...values, connectionName: conn?.name ?? '' }
                        : s,
                ),
            );
            message.success('Đã cập nhật lịch cập nhật');
        } else {
            const newSched: AutoUpdateSchedule = {
                ...values,
                id: `sched-${Date.now()}`,
                connectionName: conn?.name ?? '',
            };
            setSchedules((prev) => [...prev, newSched]);
            message.success('Đã thêm lịch cập nhật mới');
        }
        setModalOpen(false);
    };

    const handleDelete = (id: string) => {
        Modal.confirm({
            title: 'Xác nhận xoá',
            content: 'Bạn có chắc muốn xoá lịch tự động cập nhật này?',
            okText: 'Xoá',
            okButtonProps: { danger: true },
            cancelText: 'Huỷ',
            onOk: () => {
                setSchedules((prev) => prev.filter((s) => s.id !== id));
                message.success('Đã xoá lịch cập nhật');
            },
        });
    };

    const handleToggle = (id: string, enabled: boolean) => {
        setSchedules((prev) => prev.map((s) => (s.id === id ? { ...s, enabled } : s)));
        message.success(enabled ? 'Đã bật lịch cập nhật' : 'Đã tắt lịch cập nhật');
    };

    const handleRunNow = (id: string) => {
        setRunning(id);
        setSchedules((prev) =>
            prev.map((s) => (s.id === id ? { ...s, lastRunStatus: 'RUNNING' } : s)),
        );
        setTimeout(() => {
            const success = Math.random() > 0.2;
            setSchedules((prev) =>
                prev.map((s) =>
                    s.id === id
                        ? {
                              ...s,
                              lastRunStatus: success ? 'SUCCESS' : 'FAILED',
                              lastRunAt: new Date().toISOString(),
                          }
                        : s,
                ),
            );
            message.open({
                type: success ? 'success' : 'error',
                content: success ? 'Cập nhật metadata thành công!' : 'Cập nhật metadata thất bại!',
            });
            setRunning(null);
        }, 3000);
    };

    const columns: ColumnsType<AutoUpdateSchedule> = [
        {
            title: 'Kết nối',
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
            width: 140,
            render: (freq: ScheduleFrequency, record) => (
                <Space direction="vertical" size={2}>
                    <Tag color={FREQUENCY_COLORS[freq]}>{FREQUENCY_LABELS[freq]}</Tag>
                    {freq === 'CUSTOM' && record.cronExpression && (
                        <Text type="secondary" style={{ fontSize: 11 }}>
                            {record.cronExpression}
                        </Text>
                    )}
                </Space>
            ),
        },
        {
            title: 'Trạng thái',
            key: 'enabled',
            width: 130,
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
            width: 180,
            render: (_, record) => (
                <Space direction="vertical" size={2}>
                    {record.lastRunAt && (
                        <Text style={{ fontSize: 12 }}>
                            {new Date(record.lastRunAt).toLocaleString('vi-VN')}
                        </Text>
                    )}
                    {record.lastRunStatus && (
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
            title: 'Lưu lịch sử (ngày)',
            dataIndex: 'retainHistory',
            key: 'retainHistory',
            width: 130,
            render: (days: number) => <Tag>{days} ngày</Tag>,
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
                <AddBtn icon={<PlusOutlined />} onClick={openAdd}>
                    Thêm lịch
                </AddBtn>
            </PageHeader>

            <Alert
                message="Lưu ý: Mỗi lịch cập nhật sẽ tự động thu thập metadata từ kết nối tương ứng theo tần suất đã cấu hình."
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
                    pagination={false}
                />
            </ScheduleCard>

            <Modal
                title={editingSched ? 'Chỉnh sửa lịch cập nhật' : 'Thêm lịch cập nhật mới'}
                open={modalOpen}
                onOk={handleSave}
                onCancel={() => setModalOpen(false)}
                okText="Lưu"
                cancelText="Huỷ"
                okButtonProps={{ style: { background: '#ee0033', borderColor: '#ee0033' } }}
                width={520}
            >
                <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
                    <Form.Item
                        name="connectionId"
                        label="Kết nối"
                        rules={[{ required: true, message: 'Vui lòng chọn kết nối' }]}
                    >
                        <Select placeholder="Chọn kết nối">
                            {mockConnections.map((c) => (
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
