import React, { useState } from 'react';
import { Tree, Input, Badge, Typography, Tooltip } from 'antd';
import { SearchOutlined, ApartmentOutlined, FolderOutlined, FolderOpenOutlined } from '@ant-design/icons';
import styled from 'styled-components';
import type { Department } from '../../types';
import { mockDepartments } from '../../api/mockData';

const { Text } = Typography;

const TreeWrapper = styled.div`
    background: white;
    border-radius: 10px;
    padding: 20px;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
    border: 1px solid #f0f0f0;
    min-height: 400px;
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
`;

function deptToTreeData(dept: Department): object {
    return {
        key: dept.id,
        title: (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>{dept.name}</span>
                <Text type="secondary" style={{ fontSize: 10 }}>
                    [{dept.code}]
                </Text>
            </span>
        ),
        icon: ({ expanded }: { expanded?: boolean }) =>
            expanded ? (
                <FolderOpenOutlined style={{ color: '#ee0033' }} />
            ) : (
                <FolderOutlined style={{ color: '#faad14' }} />
            ),
        children: dept.children?.map(deptToTreeData),
    };
}

type Props = {
    onSelect: (departmentIds: string[]) => void;
    selectedKeys?: string[];
};

export default function DepartmentTree({ onSelect, selectedKeys = [] }: Props) {
    const [searchValue, setSearchValue] = useState('');

    const treeData = mockDepartments.map(deptToTreeData);

    const filterTree = (data: Department[], search: string): Department[] => {
        if (!search) return data;
        return data.reduce<Department[]>((acc, dept) => {
            if (dept.name.toLowerCase().includes(search.toLowerCase()) || dept.code.toLowerCase().includes(search.toLowerCase())) {
                acc.push(dept);
            } else if (dept.children) {
                const filtered = filterTree(dept.children, search);
                if (filtered.length > 0) {
                    acc.push({ ...dept, children: filtered });
                }
            }
            return acc;
        }, []);
    };

    const filteredDepts = filterTree(mockDepartments, searchValue);
    const filteredTreeData = filteredDepts.map(deptToTreeData);

    return (
        <TreeWrapper>
            <TreeHeader>
                <ApartmentOutlined />
                <h3>Cơ cấu tổ chức</h3>
                <DeptCount count={filteredDepts.length} />
            </TreeHeader>

            <SearchInput
                prefix={<SearchOutlined style={{ color: '#9e9e9e' }} />}
                placeholder="Tìm phòng ban..."
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                allowClear
            />

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
        </TreeWrapper>
    );
}
