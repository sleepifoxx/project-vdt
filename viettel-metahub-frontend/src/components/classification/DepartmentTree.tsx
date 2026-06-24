import React, { useState, useEffect } from 'react';
import { Tree, Input, Badge, Typography, Spin, Empty, Button, Modal, Form, Select, message, Popconfirm } from 'antd';
import { SearchOutlined, ApartmentOutlined, FolderOutlined, FolderOpenOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import styled from 'styled-components';
import type { Department } from '../../types';
import { listDomains, createDomain, deleteEntity } from '../../api/datahubApi';

const { Text } = Typography;

const TreeWrapper = styled.div`
    background: white;
    border-radius: 10px;
    padding: 20px;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
    border: 1px solid #f0f0f0;
    min-height: 200px;
`;

const TreeHeader = styled.div`
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

const SearchInput = styled(Input)`
    margin-bottom: 12px;
    border-radius: 6px;

    &:focus,
    &:hover {
        border-color: #ee0033;
    }
`;

const DeptCount = styled(Badge)`
    .ant-badge-count {
        background: #ee0033;
        font-size: 10px;
        height: 16px;
        min-width: 16px;
        line-height: 16px;
        padding: 0 4px;
    }
`;

const StyledTree = styled(Tree)`
    .ant-tree-node-content-wrapper:hover {
        background: #fff0f3 !important;
    }

    .ant-tree-node-selected .ant-tree-node-content-wrapper {
        background: #ffe0e6 !important;
        color: #ee0033 !important;
    }

    .ant-tree-title {
        font-size: 13px;
    }

    .ant-tree-treenode:hover .domain-delete-btn {
        opacity: 1;
    }

    .domain-delete-btn {
        opacity: 0;
        transition: opacity 0.15s;
    }
`;

const NodeTitle = styled.span`
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
`;

function deptToTreeData(
    dept: Department,
    onDelete: (urn: string, name: string) => void,
): object {
    return {
        key: dept.id,
        title: (
            <NodeTitle>
                <span>{dept.name}</span>
                <Text type="secondary" style={{ fontSize: 10 }}>
                    [{dept.code}]
                </Text>
                <Popconfirm
                    title={`Xoá domain "${dept.name}"?`}
                    description="Hành động này không thể hoàn tác."
                    onConfirm={(e) => { e?.stopPropagation(); onDelete(dept.id, dept.name); }}
                    onCancel={(e) => e?.stopPropagation()}
                    okText="Xoá"
                    cancelText="Huỷ"
                    okButtonProps={{ danger: true }}
                >
                    <Button
                        className="domain-delete-btn"
                        type="text"
                        size="small"
                        icon={<DeleteOutlined style={{ color: '#ee0033', fontSize: 11 }} />}
                        style={{ marginLeft: 'auto', padding: '0 4px', height: 18 }}
                        onClick={(e) => e.stopPropagation()}
                    />
                </Popconfirm>
            </NodeTitle>
        ),
        icon: ({ expanded }: { expanded?: boolean }) =>
            expanded ? (
                <FolderOpenOutlined style={{ color: '#ee0033' }} />
            ) : (
                <FolderOutlined style={{ color: '#faad14' }} />
            ),
        children: dept.children?.length
            ? dept.children.map((c) => deptToTreeData(c, onDelete))
            : undefined,
    };
}

function filterDepts(data: Department[], search: string): Department[] {
    if (!search) return data;
    return data.reduce<Department[]>((acc, dept) => {
        const match =
            dept.name.toLowerCase().includes(search.toLowerCase()) ||
            dept.code.toLowerCase().includes(search.toLowerCase());
        if (match) {
            acc.push(dept);
        } else if (dept.children?.length) {
            const filtered = filterDepts(dept.children, search);
            if (filtered.length > 0) acc.push({ ...dept, children: filtered });
        }
        return acc;
    }, []);
}

function flattenDepts(data: Department[]): Department[] {
    return data.reduce<Department[]>((acc, d) => {
        acc.push(d);
        if (d.children?.length) acc.push(...flattenDepts(d.children));
        return acc;
    }, []);
}

type Props = {
    onSelect: (departmentIds: string[]) => void;
    selectedKeys?: string[];
};

export default function DepartmentTree({ onSelect, selectedKeys = [] }: Props) {
    const [domains, setDomains] = useState<Department[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchValue, setSearchValue] = useState('');
    const [modalOpen, setModalOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [form] = Form.useForm();

    const reload = () => {
        setLoading(true);
        listDomains()
            .then(setDomains)
            .catch((err) => {
                console.error('[DepartmentTree] listDomains error:', err);
                setDomains([]);
            })
            .finally(() => setLoading(false));
    };

    useEffect(() => { reload(); }, []);

    const handleDelete = async (urn: string, name: string) => {
        try {
            await deleteEntity(urn);
            message.success(`Đã xoá domain "${name}"`);
            reload();
        } catch {
            message.error('Không thể xoá domain');
        }
    };

    const filteredDepts = filterDepts(domains, searchValue);
    const filteredTreeData = filteredDepts.map((d) => deptToTreeData(d, handleDelete));
    const allFlat = flattenDepts(domains);

    const countLeaves = (items: Department[]): number =>
        items.reduce((n, d) => n + 1 + countLeaves(d.children ?? []), 0);

    const handleCreate = async () => {
        const values = await form.validateFields();
        setSaving(true);
        try {
            await createDomain({
                name: values.name.trim(),
                description: values.description?.trim() || undefined,
                parentDomain: values.parentDomain || undefined,
            });
            message.success(`Đã tạo domain "${values.name}"`);
            form.resetFields();
            setModalOpen(false);
            reload();
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            message.error(`Tạo domain thất bại: ${msg}`);
        } finally {
            setSaving(false);
        }
    };

    return (
        <TreeWrapper>
            <TreeHeader>
                <ApartmentOutlined />
                <h3>Domain / Lĩnh vực</h3>
                {!loading && <DeptCount count={countLeaves(filteredDepts)} />}
                <Button
                    type="primary"
                    size="small"
                    icon={<PlusOutlined />}
                    onClick={() => setModalOpen(true)}
                    style={{ marginLeft: 'auto', background: '#ee0033', borderColor: '#ee0033' }}
                >
                    Tạo mới
                </Button>
            </TreeHeader>

            <SearchInput
                prefix={<SearchOutlined style={{ color: '#9e9e9e' }} />}
                placeholder="Tìm domain..."
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                allowClear
            />

            {loading ? (
                <div style={{ textAlign: 'center', padding: '32px 0' }}>
                    <Spin size="small" />
                    <Text type="secondary" style={{ display: 'block', marginTop: 8, fontSize: 12 }}>
                        Đang tải danh sách domain...
                    </Text>
                </div>
            ) : filteredTreeData.length === 0 ? (
                <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={
                        searchValue
                            ? 'Không tìm thấy domain phù hợp'
                            : 'Chưa có domain nào được cấu hình'
                    }
                    style={{ padding: '24px 0' }}
                />
            ) : (
                <StyledTree
                    treeData={filteredTreeData}
                    defaultExpandAll
                    showIcon
                    checkable
                    checkedKeys={selectedKeys}
                    onCheck={(checked) => {
                        const keys = Array.isArray(checked) ? checked : checked.checked;
                        onSelect(keys as string[]);
                    }}
                    selectable={false}
                />
            )}

            <Modal
                title="Tạo Domain mới"
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
                        label="Tên Domain"
                        rules={[{ required: true, message: 'Vui lòng nhập tên domain' }]}
                    >
                        <Input placeholder="Ví dụ: Tài chính, Kỹ thuật..." />
                    </Form.Item>
                    <Form.Item name="description" label="Mô tả">
                        <Input.TextArea rows={2} placeholder="Mô tả ngắn về domain này" />
                    </Form.Item>
                    <Form.Item name="parentDomain" label="Domain cha (tuỳ chọn)">
                        <Select
                            allowClear
                            showSearch
                            placeholder="Chọn domain cha nếu có"
                            optionFilterProp="label"
                            options={allFlat.map((d) => ({ value: d.id, label: d.name }))}
                        />
                    </Form.Item>
                </Form>
            </Modal>
        </TreeWrapper>
    );
}
