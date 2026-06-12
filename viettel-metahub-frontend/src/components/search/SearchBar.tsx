import React, { useState, useCallback } from 'react';
import { Input, Select, Button, Space, Tag, Tooltip } from 'antd';
import { SearchOutlined, FilterOutlined, CloseCircleOutlined } from '@ant-design/icons';
import styled from 'styled-components';
import type { EntityType } from '../../types';

const { Option } = Select;

const SearchWrapper = styled.div`
    background: white;
    border-radius: 10px;
    padding: 20px 24px;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
    border: 1px solid #f0f0f0;
`;

const SearchTitle = styled.h3`
    font-size: 15px;
    font-weight: 600;
    color: #212121;
    margin: 0 0 16px;
    display: flex;
    align-items: center;
    gap: 8px;

    .anticon {
        color: #ee0033;
    }
`;

const SearchInputRow = styled.div`
    display: flex;
    gap: 12px;
    align-items: center;
    flex-wrap: wrap;
`;

const StyledInput = styled(Input.Search)`
    flex: 1;
    min-width: 260px;

    .ant-input {
        border-radius: 6px 0 0 6px;
        border-color: #e0e0e0;
        font-size: 14px;

        &:focus,
        &:hover {
            border-color: #ee0033;
        }
    }

    .ant-btn-primary {
        background: #ee0033 !important;
        border-color: #ee0033 !important;
        border-radius: 0 6px 6px 0;

        &:hover {
            background: #cc0029 !important;
        }
    }
`;

const FilterRow = styled.div`
    display: flex;
    gap: 8px;
    margin-top: 12px;
    flex-wrap: wrap;
    align-items: center;
`;

const ActiveFilters = styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 10px;
    align-items: center;
`;

const FilterLabel = styled.span`
    font-size: 12px;
    color: #757575;
    font-weight: 500;
`;

const ENTITY_TYPE_LABELS: Record<EntityType, string> = {
    DATASET: 'Bộ dữ liệu',
    DASHBOARD: 'Dashboard',
    CHART: 'Biểu đồ',
    DATA_FLOW: 'Luồng dữ liệu',
    DATA_JOB: 'Công việc',
    CORP_USER: 'Người dùng',
    CORP_GROUP: 'Nhóm',
};

const PLATFORM_OPTIONS = ['mysql', 'postgresql', 'oracle', 'kafka', 'hive', 'spark', 'mongodb'];

type Props = {
    onSearch: (keyword: string, entityTypes: EntityType[], platforms: string[]) => void;
    loading?: boolean;
};

export default function SearchBar({ onSearch, loading }: Props) {
    const [keyword, setKeyword] = useState('');
    const [selectedTypes, setSelectedTypes] = useState<EntityType[]>([]);
    const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
    const [showFilters, setShowFilters] = useState(false);

    const handleSearch = useCallback(() => {
        onSearch(keyword, selectedTypes, selectedPlatforms);
    }, [keyword, selectedTypes, selectedPlatforms, onSearch]);

    const removeTypeFilter = (type: EntityType) => {
        const updated = selectedTypes.filter((t) => t !== type);
        setSelectedTypes(updated);
        onSearch(keyword, updated, selectedPlatforms);
    };

    const removePlatformFilter = (platform: string) => {
        const updated = selectedPlatforms.filter((p) => p !== platform);
        setSelectedPlatforms(updated);
        onSearch(keyword, selectedTypes, updated);
    };

    const clearAll = () => {
        setKeyword('');
        setSelectedTypes([]);
        setSelectedPlatforms([]);
        onSearch('', [], []);
    };

    const hasActiveFilters = selectedTypes.length > 0 || selectedPlatforms.length > 0;

    return (
        <SearchWrapper>
            <SearchTitle>
                <SearchOutlined />
                Tìm kiếm Metadata
            </SearchTitle>

            <SearchInputRow>
                <StyledInput
                    placeholder="Nhập từ khoá tìm kiếm (tên bảng, mô tả, tag...)"
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    onSearch={handleSearch}
                    onPressEnter={handleSearch}
                    loading={loading}
                    enterButton={
                        <Space>
                            <SearchOutlined />
                            Tìm kiếm
                        </Space>
                    }
                    size="large"
                    allowClear
                />

                <Tooltip title={showFilters ? 'Ẩn bộ lọc' : 'Hiện bộ lọc nâng cao'}>
                    <Button
                        icon={<FilterOutlined />}
                        onClick={() => setShowFilters(!showFilters)}
                        type={showFilters ? 'primary' : 'default'}
                        size="large"
                        style={
                            showFilters
                                ? { background: '#ee0033', borderColor: '#ee0033' }
                                : {}
                        }
                    >
                        Bộ lọc
                    </Button>
                </Tooltip>
            </SearchInputRow>

            {showFilters && (
                <FilterRow>
                    <FilterLabel>Loại đối tượng:</FilterLabel>
                    <Select
                        mode="multiple"
                        placeholder="Chọn loại đối tượng"
                        value={selectedTypes}
                        onChange={setSelectedTypes}
                        style={{ minWidth: 220 }}
                        maxTagCount={2}
                    >
                        {Object.entries(ENTITY_TYPE_LABELS).map(([key, label]) => (
                            <Option key={key} value={key}>
                                {label}
                            </Option>
                        ))}
                    </Select>

                    <FilterLabel>Nền tảng:</FilterLabel>
                    <Select
                        mode="multiple"
                        placeholder="Chọn nền tảng"
                        value={selectedPlatforms}
                        onChange={setSelectedPlatforms}
                        style={{ minWidth: 200 }}
                        maxTagCount={2}
                    >
                        {PLATFORM_OPTIONS.map((p) => (
                            <Option key={p} value={p}>
                                {p.toUpperCase()}
                            </Option>
                        ))}
                    </Select>

                    <Button type="primary" onClick={handleSearch} style={{ background: '#ee0033', borderColor: '#ee0033' }}>
                        Áp dụng
                    </Button>
                </FilterRow>
            )}

            {hasActiveFilters && (
                <ActiveFilters>
                    <FilterLabel>Đang lọc:</FilterLabel>
                    {selectedTypes.map((t) => (
                        <Tag
                            key={t}
                            closable
                            onClose={() => removeTypeFilter(t)}
                            color="red"
                            style={{ borderRadius: 4 }}
                        >
                            {ENTITY_TYPE_LABELS[t]}
                        </Tag>
                    ))}
                    {selectedPlatforms.map((p) => (
                        <Tag
                            key={p}
                            closable
                            onClose={() => removePlatformFilter(p)}
                            color="volcano"
                            style={{ borderRadius: 4 }}
                        >
                            {p.toUpperCase()}
                        </Tag>
                    ))}
                    <Button
                        type="link"
                        size="small"
                        icon={<CloseCircleOutlined />}
                        onClick={clearAll}
                        style={{ color: '#ee0033', padding: '0 4px' }}
                    >
                        Xoá tất cả
                    </Button>
                </ActiveFilters>
            )}
        </SearchWrapper>
    );
}
