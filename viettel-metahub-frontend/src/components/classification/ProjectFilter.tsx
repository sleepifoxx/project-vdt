import React, { useState, useEffect } from 'react';
import { Tag, Space, Typography, Badge, Empty, Input, Spin, Button, Modal, Form, message, Popconfirm } from 'antd';
import { TagsOutlined, SearchOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import styled from 'styled-components';
import { getTagAggregations, createTag, deleteEntity } from '../../api/datahubApi';
import type { Project } from '../../types';

const { Text } = Typography;

const FilterWrapper = styled.div`
    background: white;
    border-radius: 10px;
    padding: 20px;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
    border: 1px solid #f0f0f0;
`;

const FilterHeader = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 16px;

    h3 {
        font-size: 15px;
        font-weight: 600;
        color: #212121;
        margin: 0;
    }

    .anticon {
        color: #ee0033;
    }
`;

const TagCard = styled.div<{ $selected?: boolean }>`
    padding: 8px 12px;
    border-radius: 8px;
    border: 1.5px solid ${({ $selected }) => ($selected ? '#ee0033' : '#e0e0e0')};
    background: ${({ $selected }) => ($selected ? '#fff0f3' : 'white')};
    cursor: pointer;
    transition: all 0.15s;
    margin-bottom: 6px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;

    &:hover {
        border-color: #ee0033;
        background: #fff5f7;
    }

    &:hover .tag-delete-btn {
        opacity: 1;
    }

    .tag-delete-btn {
        opacity: 0;
        transition: opacity 0.15s;
        flex-shrink: 0;
    }
`;

const TagName = styled(Text)<{ $selected?: boolean }>`
    font-size: 13px;
    font-weight: ${({ $selected }) => ($selected ? 600 : 400)};
    display: block;
    flex: 1;
    min-width: 0;
`;

type Props = {
    selectedDepartmentIds: string[];
    selectedProjectIds: string[];
    onProjectSelect: (projectIds: string[]) => void;
};

export default function ProjectFilter({ selectedProjectIds, onProjectSelect }: Props) {
    const [tags, setTags] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [modalOpen, setModalOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [form] = Form.useForm();

    const reload = () => {
        setLoading(true);
        getTagAggregations()
            .then(setTags)
            .catch(() => setTags([]))
            .finally(() => setLoading(false));
    };

    useEffect(() => { reload(); }, []);

    const filtered = tags.filter(
        (t) => !search || t.name.toLowerCase().includes(search.toLowerCase()),
    );

    const toggle = (id: string) => {
        const updated = selectedProjectIds.includes(id)
            ? selectedProjectIds.filter((x) => x !== id)
            : [...selectedProjectIds, id];
        onProjectSelect(updated);
    };

    const handleDelete = async (e: React.MouseEvent, tag: Project) => {
        e.stopPropagation();
        try {
            await deleteEntity(tag.id);
            message.success(`Đã xoá tag "${tag.name}"`);
            onProjectSelect(selectedProjectIds.filter((id) => id !== tag.id));
            reload();
        } catch {
            message.error('Không thể xoá tag');
        }
    };

    const handleCreate = async () => {
        const values = await form.validateFields();
        setSaving(true);
        try {
            await createTag({
                name: values.name.trim(),
                description: values.description?.trim() || undefined,
            });
            message.success(`Đã tạo tag "${values.name}"`);
            form.resetFields();
            setModalOpen(false);
            reload();
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            message.error(`Tạo tag thất bại: ${msg}`);
        } finally {
            setSaving(false);
        }
    };

    return (
        <FilterWrapper>
            <FilterHeader>
                <TagsOutlined />
                <h3>Tags / Nhãn</h3>
                {!loading && <Badge count={filtered.length} style={{ background: '#ee0033' }} />}
                <Button
                    type="primary"
                    size="small"
                    icon={<PlusOutlined />}
                    onClick={() => setModalOpen(true)}
                    style={{ marginLeft: 'auto', background: '#ee0033', borderColor: '#ee0033' }}
                >
                    Tạo mới
                </Button>
            </FilterHeader>

            <Input
                prefix={<SearchOutlined style={{ color: '#9e9e9e' }} />}
                placeholder="Tìm tag..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                allowClear
                style={{ marginBottom: 12, borderRadius: 6 }}
            />

            {selectedProjectIds.length > 0 && (
                <Space wrap style={{ marginBottom: 12 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                        Đang lọc:
                    </Text>
                    {selectedProjectIds.map((id) => {
                        const tag = tags.find((t) => t.id === id);
                        return tag ? (
                            <Tag
                                key={id}
                                closable
                                onClose={() => toggle(id)}
                                color="red"
                                style={{ borderRadius: 4 }}
                            >
                                {tag.name}
                            </Tag>
                        ) : null;
                    })}
                </Space>
            )}

            {loading ? (
                <div style={{ textAlign: 'center', padding: '24px 0' }}>
                    <Spin size="small" />
                    <Text type="secondary" style={{ display: 'block', marginTop: 8, fontSize: 12 }}>
                        Đang tải danh sách tag...
                    </Text>
                </div>
            ) : filtered.length === 0 ? (
                <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={search ? 'Không tìm thấy tag phù hợp' : 'Chưa có tag nào'}
                />
            ) : (
                filtered.map((tag) => (
                    <TagCard
                        key={tag.id}
                        $selected={selectedProjectIds.includes(tag.id)}
                        onClick={() => toggle(tag.id)}
                    >
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <TagName $selected={selectedProjectIds.includes(tag.id)}>
                                {tag.name}
                            </TagName>
                            {tag.description && (
                                <Text type="secondary" style={{ fontSize: 11 }}>
                                    {tag.description.slice(0, 30)}
                                </Text>
                            )}
                        </div>
                        <Popconfirm
                            title={`Xoá tag "${tag.name}"?`}
                            description="Hành động này không thể hoàn tác."
                            onConfirm={(e) => handleDelete(e as React.MouseEvent, tag)}
                            onCancel={(e) => e?.stopPropagation()}
                            okText="Xoá"
                            cancelText="Huỷ"
                            okButtonProps={{ danger: true }}
                        >
                            <Button
                                className="tag-delete-btn"
                                type="text"
                                size="small"
                                icon={<DeleteOutlined style={{ color: '#ee0033', fontSize: 12 }} />}
                                onClick={(e) => e.stopPropagation()}
                                style={{ padding: '0 4px' }}
                            />
                        </Popconfirm>
                    </TagCard>
                ))
            )}

            <Modal
                title="Tạo Tag mới"
                open={modalOpen}
                onCancel={() => { setModalOpen(false); form.resetFields(); }}
                onOk={handleCreate}
                okText="Tạo"
                cancelText="Huỷ"
                confirmLoading={saving}
                okButtonProps={{ style: { background: '#ee0033', borderColor: '#ee0033' } }}
            >
                <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
                    <Form.Item
                        name="name"
                        label="Tên Tag"
                        rules={[{ required: true, message: 'Vui lòng nhập tên tag' }]}
                    >
                        <Input placeholder="Ví dụ: dự-án-alpha, production..." />
                    </Form.Item>
                    <Form.Item name="description" label="Mô tả">
                        <Input.TextArea rows={2} placeholder="Mô tả ngắn về tag này" />
                    </Form.Item>
                </Form>
            </Modal>
        </FilterWrapper>
    );
}
