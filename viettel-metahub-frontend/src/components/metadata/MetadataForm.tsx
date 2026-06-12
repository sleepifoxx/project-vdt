import React, { useState } from 'react';
import {
    Form, Input, Select, Button, Space, Tag, Divider, Typography,
    Table, Switch, message, Card, Row, Col, Tooltip, Alert,
} from 'antd';
import {
    PlusOutlined, DeleteOutlined, SaveOutlined, FormOutlined,
    InfoCircleOutlined,
} from '@ant-design/icons';
import styled from 'styled-components';
import type { MetadataFormData, EntityType } from '../../types';
import { mockDepartments, mockProjects } from '../../api/mockData';
import { ingestMetadata } from '../../api/datahubApi';

const { Option } = Select;
const { TextArea } = Input;
const { Text, Title } = Typography;

const FormWrapper = styled.div`
    background: white;
    border-radius: 10px;
    padding: 28px 32px;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
    border: 1px solid #f0f0f0;
`;

const SectionTitle = styled.div`
    font-size: 13px;
    font-weight: 700;
    color: #ee0033;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    margin-bottom: 16px;
    display: flex;
    align-items: center;
    gap: 8px;

    &::after {
        content: '';
        flex: 1;
        height: 1px;
        background: #f0f0f0;
    }
`;

const SubmitBtn = styled(Button)`
    background: #ee0033 !important;
    border-color: #ee0033 !important;
    color: white !important;
    height: 40px;
    font-size: 14px;
    font-weight: 600;
    border-radius: 6px;
    padding: 0 32px;

    &:hover {
        background: #cc0029 !important;
    }
`;

const AddFieldBtn = styled(Button)`
    border-style: dashed;
    border-color: #ee0033;
    color: #ee0033;

    &:hover {
        background: #fff0f3 !important;
        border-color: #ee0033 !important;
    }
`;

const ENTITY_TYPES: Array<{ value: EntityType; label: string }> = [
    { value: 'DATASET', label: 'Bộ dữ liệu (Dataset)' },
    { value: 'DASHBOARD', label: 'Dashboard' },
    { value: 'CHART', label: 'Biểu đồ (Chart)' },
    { value: 'DATA_FLOW', label: 'Luồng dữ liệu (Data Flow)' },
    { value: 'DATA_JOB', label: 'Công việc dữ liệu (Data Job)' },
    { value: 'CORP_USER', label: 'Người dùng tổ chức' },
    { value: 'CORP_GROUP', label: 'Nhóm tổ chức' },
];

const PLATFORMS = ['mysql', 'postgresql', 'oracle', 'mssql', 'mongodb', 'kafka', 'hive', 'spark', 'superset', 'metabase'];

const SUB_TYPES: Record<EntityType, string[]> = {
    DATASET: ['Table', 'View', 'External Table', 'Materialized View'],
    DASHBOARD: ['Operational', 'Reporting', 'Analytical'],
    CHART: ['Bar Chart', 'Line Chart', 'Pie Chart', 'Table', 'Metric'],
    DATA_FLOW: ['ETL', 'ELT', 'Stream Processing'],
    DATA_JOB: ['Spark Job', 'Airflow DAG', 'Kafka Stream'],
    CORP_USER: [],
    CORP_GROUP: [],
};

const NATIVE_TYPES = ['VARCHAR', 'INT', 'BIGINT', 'FLOAT', 'DOUBLE', 'BOOLEAN', 'DATE', 'TIMESTAMP', 'TEXT', 'JSON', 'ARRAY', 'MAP'];

function flattenDepartments(depts: typeof mockDepartments): Array<{ id: string; name: string; level: number }> {
    const result: Array<{ id: string; name: string; level: number }> = [];
    function traverse(list: typeof mockDepartments, level: number) {
        list.forEach((d) => {
            result.push({ id: d.id, name: d.name, level });
            if (d.children) traverse(d.children, level + 1);
        });
    }
    traverse(depts, 0);
    return result;
}

const flatDepts = flattenDepartments(mockDepartments);

type SchemaField = {
    fieldPath: string;
    nativeDataType: string;
    description: string;
    nullable: boolean;
    isKey: boolean;
};

type Props = {
    initialValues?: Partial<MetadataFormData>;
    onSuccess?: (data: MetadataFormData) => void;
};

export default function MetadataForm({ initialValues, onSuccess }: Props) {
    const [form] = Form.useForm<MetadataFormData>();
    const [schemaFields, setSchemaFields] = useState<SchemaField[]>(
        initialValues?.schemaFields ?? [],
    );
    const [customProps, setCustomProps] = useState<Array<{ key: string; value: string }>>(
        initialValues?.customProperties ?? [],
    );
    const [tags, setTags] = useState<string[]>(initialValues?.tags ?? []);
    const [tagInput, setTagInput] = useState('');
    const [saving, setSaving] = useState(false);

    const selectedType = Form.useWatch('type', form);
    const selectedDept = Form.useWatch('departmentId', form);

    const availableProjects = mockProjects.filter(
        (p) => !selectedDept || p.departmentId === selectedDept,
    );

    const addSchemaField = () => {
        setSchemaFields((prev) => [
            ...prev,
            { fieldPath: '', nativeDataType: 'VARCHAR', description: '', nullable: true, isKey: false },
        ]);
    };

    const updateSchemaField = <K extends keyof SchemaField>(index: number, key: K, value: SchemaField[K]) => {
        setSchemaFields((prev) => prev.map((f, i) => (i === index ? { ...f, [key]: value } : f)));
    };

    const removeSchemaField = (index: number) => {
        setSchemaFields((prev) => prev.filter((_, i) => i !== index));
    };

    const addCustomProp = () => {
        setCustomProps((prev) => [...prev, { key: '', value: '' }]);
    };

    const updateCustomProp = (index: number, field: 'key' | 'value', value: string) => {
        setCustomProps((prev) => prev.map((p, i) => (i === index ? { ...p, [field]: value } : p)));
    };

    const addTag = () => {
        const trimmed = tagInput.trim();
        if (trimmed && !tags.includes(trimmed)) {
            setTags((prev) => [...prev, trimmed]);
        }
        setTagInput('');
    };

    const handleSubmit = async () => {
        try {
            const values = await form.validateFields();
            setSaving(true);
            const formData: MetadataFormData = {
                ...values,
                tags,
                customProperties: customProps,
                schemaFields: selectedType === 'DATASET' ? schemaFields : undefined,
            };
            await ingestMetadata(formData);
            message.success('Đã lưu metadata lên DataHub thành công!');
            onSuccess?.(formData);
        } catch (err) {
            const errMsg = err instanceof Error ? err.message : '';
            if (errMsg) {
                message.error(`Lỗi khi lưu: ${errMsg}`);
            } else {
                message.error('Vui lòng kiểm tra lại thông tin hoặc kết nối DataHub');
            }
        } finally {
            setSaving(false);
        }
    };

    const schemaColumns = [
        {
            title: 'Tên trường',
            dataIndex: 'fieldPath',
            width: '22%',
            render: (_: string, __: SchemaField, index: number) => (
                <Input
                    size="small"
                    value={schemaFields[index].fieldPath}
                    onChange={(e) => updateSchemaField(index, 'fieldPath', e.target.value)}
                    placeholder="column_name"
                />
            ),
        },
        {
            title: 'Kiểu dữ liệu',
            dataIndex: 'nativeDataType',
            width: '18%',
            render: (_: string, __: SchemaField, index: number) => (
                <Select
                    size="small"
                    value={schemaFields[index].nativeDataType}
                    onChange={(v) => updateSchemaField(index, 'nativeDataType', v)}
                    style={{ width: '100%' }}
                >
                    {NATIVE_TYPES.map((t) => (
                        <Option key={t} value={t}>
                            {t}
                        </Option>
                    ))}
                </Select>
            ),
        },
        {
            title: 'Mô tả',
            dataIndex: 'description',
            render: (_: string, __: SchemaField, index: number) => (
                <Input
                    size="small"
                    value={schemaFields[index].description}
                    onChange={(e) => updateSchemaField(index, 'description', e.target.value)}
                    placeholder="Mô tả trường dữ liệu"
                />
            ),
        },
        {
            title: 'Nullable',
            dataIndex: 'nullable',
            width: 80,
            render: (_: boolean, __: SchemaField, index: number) => (
                <Switch
                    size="small"
                    checked={schemaFields[index].nullable}
                    onChange={(v) => updateSchemaField(index, 'nullable', v)}
                />
            ),
        },
        {
            title: 'Khoá',
            dataIndex: 'isKey',
            width: 70,
            render: (_: boolean, __: SchemaField, index: number) => (
                <Switch
                    size="small"
                    checked={schemaFields[index].isKey}
                    onChange={(v) => updateSchemaField(index, 'isKey', v)}
                    style={{ background: schemaFields[index].isKey ? '#ee0033' : undefined }}
                />
            ),
        },
        {
            title: '',
            width: 40,
            render: (_: unknown, __: SchemaField, index: number) => (
                <Button
                    type="text"
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => removeSchemaField(index)}
                />
            ),
        },
    ];

    return (
        <FormWrapper>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
                <FormOutlined style={{ color: '#ee0033', fontSize: 20 }} />
                <Title level={4} style={{ margin: 0 }}>
                    {initialValues?.urn ? 'Chỉnh sửa Metadata' : 'Nhập Metadata mới'}
                </Title>
            </div>

            <Form form={form} layout="vertical" initialValues={initialValues}>
                <SectionTitle>Thông tin cơ bản</SectionTitle>

                <Row gutter={20}>
                    <Col span={12}>
                        <Form.Item
                            name="type"
                            label="Loại đối tượng"
                            rules={[{ required: true, message: 'Vui lòng chọn loại đối tượng' }]}
                        >
                            <Select placeholder="Chọn loại đối tượng">
                                {ENTITY_TYPES.map((et) => (
                                    <Option key={et.value} value={et.value}>
                                        {et.label}
                                    </Option>
                                ))}
                            </Select>
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item
                            name="platform"
                            label="Nền tảng (Platform)"
                            rules={[{ required: true, message: 'Vui lòng chọn nền tảng' }]}
                        >
                            <Select placeholder="Chọn nền tảng">
                                {PLATFORMS.map((p) => (
                                    <Option key={p} value={p}>
                                        {p.toUpperCase()}
                                    </Option>
                                ))}
                            </Select>
                        </Form.Item>
                    </Col>
                </Row>

                <Row gutter={20}>
                    <Col span={selectedType && SUB_TYPES[selectedType]?.length > 0 ? 16 : 24}>
                        <Form.Item
                            name="name"
                            label="Tên đối tượng"
                            rules={[{ required: true, message: 'Vui lòng nhập tên' }]}
                        >
                            <Input placeholder="VD: khach_hang, dashboard_kpi" />
                        </Form.Item>
                    </Col>
                    {selectedType && SUB_TYPES[selectedType]?.length > 0 && (
                        <Col span={8}>
                            <Form.Item name="subType" label="Kiểu con (Sub-type)">
                                <Select placeholder="Chọn kiểu con" allowClear>
                                    {SUB_TYPES[selectedType].map((st) => (
                                        <Option key={st} value={st}>
                                            {st}
                                        </Option>
                                    ))}
                                </Select>
                            </Form.Item>
                        </Col>
                    )}
                </Row>

                <Form.Item
                    name="description"
                    label="Mô tả"
                    rules={[{ required: true, message: 'Vui lòng nhập mô tả' }]}
                >
                    <TextArea
                        rows={3}
                        placeholder="Mô tả ngắn gọn về đối tượng metadata này..."
                        showCount
                        maxLength={500}
                    />
                </Form.Item>

                <SectionTitle>Phân loại & Sở hữu</SectionTitle>

                <Row gutter={20}>
                    <Col span={12}>
                        <Form.Item
                            name="departmentId"
                            label="Phòng ban"
                            rules={[{ required: true, message: 'Vui lòng chọn phòng ban' }]}
                        >
                            <Select
                                placeholder="Chọn phòng ban"
                                onChange={() => form.setFieldValue('projectId', undefined)}
                                showSearch
                                filterOption={(input, option) =>
                                    String(option?.children ?? '').toLowerCase().includes(input.toLowerCase())
                                }
                            >
                                {flatDepts.map((d) => (
                                    <Option key={d.id} value={d.id}>
                                        {'  '.repeat(d.level)}{d.name}
                                    </Option>
                                ))}
                            </Select>
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item name="projectId" label="Dự án">
                            <Select
                                placeholder="Chọn dự án (tuỳ chọn)"
                                allowClear
                                disabled={availableProjects.length === 0}
                            >
                                {availableProjects.map((p) => (
                                    <Option key={p.id} value={p.id}>
                                        {p.name}
                                    </Option>
                                ))}
                            </Select>
                        </Form.Item>
                    </Col>
                </Row>

                <Form.Item
                    name="owner"
                    label={
                        <Space>
                            Người sở hữu
                            <Tooltip title="Nhập username hoặc email của người chịu trách nhiệm">
                                <InfoCircleOutlined style={{ color: '#9e9e9e' }} />
                            </Tooltip>
                        </Space>
                    }
                    rules={[{ required: true, message: 'Vui lòng nhập người sở hữu' }]}
                >
                    <Input placeholder="VD: nguyen.van.a hoặc nguyen.van.a@viettel.com.vn" />
                </Form.Item>

                <Form.Item label="Tags">
                    <Space wrap>
                        {tags.map((tag) => (
                            <Tag
                                key={tag}
                                closable
                                onClose={() => setTags((prev) => prev.filter((t) => t !== tag))}
                                color="red"
                                style={{ borderRadius: 4 }}
                            >
                                {tag}
                            </Tag>
                        ))}
                        <Input
                            size="small"
                            value={tagInput}
                            onChange={(e) => setTagInput(e.target.value)}
                            onPressEnter={addTag}
                            placeholder="Thêm tag..."
                            style={{ width: 120 }}
                            suffix={
                                <PlusOutlined
                                    style={{ cursor: 'pointer', color: '#ee0033' }}
                                    onClick={addTag}
                                />
                            }
                        />
                    </Space>
                </Form.Item>

                {selectedType === 'DATASET' && (
                    <>
                        <SectionTitle>Schema (Cấu trúc dữ liệu)</SectionTitle>

                        <Table
                            dataSource={schemaFields}
                            columns={schemaColumns}
                            rowKey={(_, idx) => String(idx)}
                            size="small"
                            pagination={false}
                            style={{ marginBottom: 12 }}
                            locale={{ emptyText: 'Chưa có trường dữ liệu nào' }}
                        />

                        <AddFieldBtn icon={<PlusOutlined />} onClick={addSchemaField} block>
                            Thêm trường dữ liệu
                        </AddFieldBtn>
                    </>
                )}

                <SectionTitle style={{ marginTop: 24 }}>Thuộc tính tuỳ chỉnh</SectionTitle>

                {customProps.map((prop, idx) => (
                    <Row key={idx} gutter={12} style={{ marginBottom: 8 }}>
                        <Col span={10}>
                            <Input
                                placeholder="Tên thuộc tính"
                                value={prop.key}
                                onChange={(e) => updateCustomProp(idx, 'key', e.target.value)}
                            />
                        </Col>
                        <Col span={12}>
                            <Input
                                placeholder="Giá trị"
                                value={prop.value}
                                onChange={(e) => updateCustomProp(idx, 'value', e.target.value)}
                            />
                        </Col>
                        <Col span={2}>
                            <Button
                                danger
                                type="text"
                                icon={<DeleteOutlined />}
                                onClick={() => setCustomProps((prev) => prev.filter((_, i) => i !== idx))}
                            />
                        </Col>
                    </Row>
                ))}

                <AddFieldBtn icon={<PlusOutlined />} onClick={addCustomProp} style={{ marginBottom: 28 }}>
                    Thêm thuộc tính
                </AddFieldBtn>

                <Divider />

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                    <Button onClick={() => form.resetFields()}>Đặt lại</Button>
                    <SubmitBtn icon={<SaveOutlined />} onClick={handleSubmit} loading={saving}>
                        Lưu Metadata
                    </SubmitBtn>
                </div>
            </Form>
        </FormWrapper>
    );
}
