import React, { useState } from 'react';
import { Card, Select, Tag, Space, Typography, Badge, Empty, Input } from 'antd';
import { ProjectOutlined, SearchOutlined } from '@ant-design/icons';
import styled from 'styled-components';
import { mockProjects } from '../../api/mockData';
import type { Project } from '../../types';

const { Text } = Typography;
const { Option } = Select;

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

const ProjectCard = styled.div<{ selected?: boolean; inactive?: boolean }>`
    padding: 10px 12px;
    border-radius: 8px;
    border: 1.5px solid ${({ selected }) => (selected ? '#ee0033' : '#e0e0e0')};
    background: ${({ selected }) => (selected ? '#fff0f3' : 'white')};
    cursor: pointer;
    transition: all 0.15s;
    opacity: ${({ inactive }) => (inactive ? 0.5 : 1)};
    margin-bottom: 8px;

    &:hover {
        border-color: #ee0033;
        background: #fff5f7;
    }
`;

const ProjectName = styled(Text)`
    font-size: 13px;
    font-weight: ${({ strong }) => (strong ? 600 : 400)};
    display: block;
`;

const ProjectCode = styled(Text)`
    font-size: 11px;
    color: #9e9e9e;
`;

const StyledSelect = styled(Select)`
    width: 100%;
    margin-bottom: 12px;

    .ant-select-selector {
        border-radius: 6px !important;

        &:hover,
        &:focus {
            border-color: #ee0033 !important;
        }
    }
`;

type Props = {
    selectedDepartmentIds: string[];
    selectedProjectIds: string[];
    onProjectSelect: (projectIds: string[]) => void;
};

export default function ProjectFilter({ selectedDepartmentIds, selectedProjectIds, onProjectSelect }: Props) {
    const [search, setSearch] = useState('');

    const filteredProjects = mockProjects.filter((p) => {
        const matchesDept = selectedDepartmentIds.length === 0 || selectedDepartmentIds.includes(p.departmentId);
        const matchesSearch =
            !search ||
            p.name.toLowerCase().includes(search.toLowerCase()) ||
            p.code.toLowerCase().includes(search.toLowerCase());
        return matchesDept && matchesSearch;
    });

    const toggleProject = (projectId: string) => {
        const updated = selectedProjectIds.includes(projectId)
            ? selectedProjectIds.filter((id) => id !== projectId)
            : [...selectedProjectIds, projectId];
        onProjectSelect(updated);
    };

    return (
        <FilterWrapper>
            <FilterHeader>
                <ProjectOutlined />
                <h3>Dự án</h3>
                <Badge count={filteredProjects.length} style={{ background: '#ee0033' }} />
            </FilterHeader>

            <Input
                prefix={<SearchOutlined style={{ color: '#9e9e9e' }} />}
                placeholder="Tìm dự án..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                allowClear
                style={{ marginBottom: 12, borderRadius: 6 }}
            />

            {selectedProjectIds.length > 0 && (
                <Space wrap style={{ marginBottom: 12 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                        Đã chọn:
                    </Text>
                    {selectedProjectIds.map((id) => {
                        const proj = mockProjects.find((p) => p.id === id);
                        return proj ? (
                            <Tag
                                key={id}
                                closable
                                onClose={() => toggleProject(id)}
                                color="red"
                                style={{ borderRadius: 4 }}
                            >
                                {proj.name}
                            </Tag>
                        ) : null;
                    })}
                </Space>
            )}

            {filteredProjects.length === 0 ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Không có dự án" />
            ) : (
                filteredProjects.map((project) => (
                    <ProjectCard
                        key={project.id}
                        selected={selectedProjectIds.includes(project.id)}
                        inactive={project.status === 'INACTIVE'}
                        onClick={() => toggleProject(project.id)}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                                <ProjectName strong={selectedProjectIds.includes(project.id)}>
                                    {project.name}
                                </ProjectName>
                                <ProjectCode>[{project.code}]</ProjectCode>
                            </div>
                            <Tag
                                color={project.status === 'ACTIVE' ? 'success' : 'default'}
                                style={{ fontSize: 10, borderRadius: 4 }}
                            >
                                {project.status === 'ACTIVE' ? 'Hoạt động' : 'Không hoạt động'}
                            </Tag>
                        </div>
                        {project.description && (
                            <Text type="secondary" style={{ fontSize: 11, marginTop: 4, display: 'block' }}>
                                {project.description}
                            </Text>
                        )}
                    </ProjectCard>
                ))
            )}
        </FilterWrapper>
    );
}
