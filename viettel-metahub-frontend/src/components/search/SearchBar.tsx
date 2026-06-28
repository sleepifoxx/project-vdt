import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Input, Select, Button, Space, Tag, Tooltip, DatePicker, Spin } from 'antd';
import {
    SearchOutlined,
    FilterOutlined,
    CloseCircleOutlined,
    DatabaseOutlined,
    DashboardOutlined,
    BarChartOutlined,
    NodeIndexOutlined,
    UserOutlined,
    TeamOutlined,
    ArrowRightOutlined,
} from '@ant-design/icons';
import styled from 'styled-components';
import type { Dayjs } from 'dayjs';
import type { EntityType, MetadataEntity } from '../../types';
import { listDomains, getTagAggregations, getPlatformAggregations, getPlatformNameMap, searchEntities, getFilterOptions } from '../../api/datahubApi';
import type { FilterOptions } from '../../api/datahubApi';
import { buildSmartQuery, vietnameseIndexOf, vietnameseIncludes } from '../../utils/vietnamese';

const { RangePicker } = DatePicker;

export type SearchBarOutput = {
    keyword: string;
    entityTypes: EntityType[];
    platforms: string[];
    domainUrns: string[];
    tagUrns: string[];
    startDate?: number;
    endDate?: number;
};

type Props = {
    onSearch: (params: SearchBarOutput) => void;
    loading?: boolean;
};

// ── Styled components ──────────────────────────────────────────────────────────

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

const InputRow = styled.div`
    position: relative;
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

const FilterGrid = styled.div`
    display: flex;
    flex-wrap: nowrap;
    gap: 8px;
    margin-top: 14px;
    padding-top: 14px;
    border-top: 1px solid #f5f5f5;
    align-items: flex-end;
    overflow-x: auto;
`;

const FilterItem = styled.div`
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
    min-width: 140px;
`;

const FilterLabel = styled.span`
    font-size: 11px;
    font-weight: 600;
    color: #757575;
    text-transform: uppercase;
    letter-spacing: 0.4px;
`;

const FilterActions = styled.div`
    display: flex;
    gap: 8px;
    margin-top: 14px;
    align-items: center;
`;

const ActiveFilters = styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 12px;
    padding-top: 10px;
    border-top: 1px dashed #f0f0f0;
    align-items: center;
`;

const ActiveFiltersLabel = styled.span`
    font-size: 12px;
    color: #757575;
    font-weight: 500;
`;

// ── Preview dropdown ───────────────────────────────────────────────────────────

const PreviewDropdown = styled.div`
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    background: white;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    box-shadow: 0 6px 24px rgba(0, 0, 0, 0.12);
    z-index: 1050;
    overflow: hidden;
`;

const PreviewRow = styled.div`
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 10px 14px;
    cursor: pointer;
    border-bottom: 1px solid #f5f5f5;
    transition: background 0.12s;

    &:last-of-type {
        border-bottom: none;
    }

    &:hover {
        background: #fff5f6;
    }
`;

const PreviewIconCell = styled.div`
    margin-top: 2px;
    font-size: 16px;
    flex-shrink: 0;
`;

const PreviewContent = styled.div`
    flex: 1;
    min-width: 0;
`;

const PreviewName = styled.div`
    font-size: 13px;
    font-weight: 600;
    color: #212121;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;

    mark {
        background: #fff3cd;
        color: inherit;
        padding: 0;
        border-radius: 2px;
    }
`;

const PreviewMeta = styled.div`
    display: flex;
    gap: 6px;
    margin-top: 2px;
    align-items: center;
    flex-wrap: wrap;
`;

const PreviewPlatform = styled.span`
    display: inline-block;
    padding: 1px 6px;
    border-radius: 3px;
    background: #f5f5f5;
    border: 1px solid #e0e0e0;
    font-size: 10px;
    font-weight: 600;
    color: #424242;
    text-transform: uppercase;
    letter-spacing: 0.4px;
`;

const PreviewDesc = styled.div`
    font-size: 11px;
    color: #757575;
    margin-top: 2px;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 1;
    -webkit-box-orient: vertical;

    mark {
        background: #fff3cd;
        color: inherit;
        padding: 0;
        border-radius: 2px;
    }
`;

const PreviewDomain = styled.span`
    font-size: 10px;
    color: #9c27b0;
    font-weight: 500;
`;

// ── Quick filter suggestions ───────────────────────────────────────────────────

const QuickFilterSection = styled.div`
    border-bottom: 1px solid #f0f0f0;
    padding: 8px 14px 6px;
    background: #fafafa;
`;

const QuickFilterLabel = styled.div`
    font-size: 10px;
    font-weight: 700;
    color: #9e9e9e;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 6px;
`;

const QuickFilterChip = styled.button`
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 10px;
    border-radius: 12px;
    border: 1px solid #e0e0e0;
    background: white;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    color: #424242;
    margin: 0 4px 4px 0;
    transition: all 0.12s;

    &:hover {
        border-color: #ee0033;
        color: #ee0033;
        background: #fff5f6;
    }
`;

const ChipTypeLabel = styled.span`
    font-size: 10px;
    color: #9e9e9e;
    font-weight: 400;
`;

const PreviewFooter = styled.div`
    padding: 8px 14px;
    font-size: 12px;
    color: #ee0033;
    cursor: pointer;
    background: #fafafa;
    border-top: 1px solid #f0f0f0;
    display: flex;
    align-items: center;
    gap: 6px;
    font-weight: 500;

    &:hover {
        background: #fff5f6;
    }
`;

const PreviewStatusRow = styled.div`
    padding: 16px 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    color: #9e9e9e;
    font-size: 13px;
`;

const HighlightMark = styled.mark`
    background: #fff3cd;
    color: inherit;
    padding: 0;
    border-radius: 2px;
`;

// ── Constants ──────────────────────────────────────────────────────────────────

const ENTITY_TYPE_LABELS: Record<EntityType, string> = {
    DATASET: 'Bộ dữ liệu',
    DASHBOARD: 'Dashboard',
    CHART: 'Biểu đồ',
    DATA_FLOW: 'Luồng dữ liệu',
    DATA_JOB: 'Công việc',
    CORP_USER: 'Người dùng',
    CORP_GROUP: 'Nhóm',
};

const ENTITY_ICONS: Record<EntityType, React.ReactNode> = {
    DATASET: <DatabaseOutlined style={{ color: '#1677ff' }} />,
    DASHBOARD: <DashboardOutlined style={{ color: '#722ed1' }} />,
    CHART: <BarChartOutlined style={{ color: '#13c2c2' }} />,
    DATA_FLOW: <NodeIndexOutlined style={{ color: '#fa8c16' }} />,
    DATA_JOB: <NodeIndexOutlined style={{ color: '#52c41a' }} />,
    CORP_USER: <UserOutlined style={{ color: '#eb2f96' }} />,
    CORP_GROUP: <TeamOutlined style={{ color: '#faad14' }} />,
};

type DomainOption = { urn: string; name: string };
type TagOption = { urn: string; name: string };

// ── Highlight helper ───────────────────────────────────────────────────────────

function highlightText(text: string, query: string): React.ReactNode {
    if (!query || !text) return text;
    const idx = vietnameseIndexOf(query.trim(), text);
    if (idx === -1) return text;
    const end = idx + query.trim().length;
    return (
        <>
            {text.slice(0, idx)}
            <HighlightMark>{text.slice(idx, end)}</HighlightMark>
            {text.slice(end)}
        </>
    );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SearchBar({ onSearch, loading }: Props) {
    const [keyword, setKeyword] = useState('');
    const [selectedTypes, setSelectedTypes] = useState<EntityType[]>([]);
    const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
    const [selectedDomains, setSelectedDomains] = useState<DomainOption[]>([]);
    const [selectedTags, setSelectedTags] = useState<TagOption[]>([]);
    const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
    const [showFilters, setShowFilters] = useState(false);

    const [platformOptions, setPlatformOptions] = useState<Array<{ value: string; label: string }>>([]);
    const [platformNameMap, setPlatformNameMap] = useState<Record<string, string>>({});
    const [domainOptions, setDomainOptions] = useState<DomainOption[]>([]);
    const [tagOptions, setTagOptions] = useState<TagOption[]>([]);
    const [loadingOptions, setLoadingOptions] = useState(false);

    // Preview state
    const [previewResults, setPreviewResults] = useState<MetadataEntity[]>([]);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [showPreview, setShowPreview] = useState(false);
    const cancelRef = useRef(0);
    const wrapperRef = useRef<HTMLDivElement>(null);

    // Filter options for quick-filter suggestions in the preview
    const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null);
    const filterOptionsLoadedRef = useRef(false);

    // Load filter options lazily when panel opens
    useEffect(() => {
        if (!showFilters) return;
        setLoadingOptions(true);
        Promise.all([
            Promise.all([getPlatformAggregations(), getPlatformNameMap()]).then(([aggs, nameMap]) => {
                setPlatformNameMap(nameMap);
                setPlatformOptions(
                    aggs.map((p) => ({
                        value: p.name,
                        label: nameMap[p.name] ?? p.name.toUpperCase(),
                    })),
                );
            }),
            listDomains().then((data) => setDomainOptions(data.map((d) => ({ urn: d.id, name: d.name })))),
            getTagAggregations().then((data) => setTagOptions(data.map((t) => ({ urn: t.id, name: t.name })))),
        ]).finally(() => setLoadingOptions(false));
    }, [showFilters]);

    // Debounced preview search — triggers whenever keyword changes
    useEffect(() => {
        const trimmed = keyword.trim();
        if (trimmed.length < 2) {
            setShowPreview(false);
            setPreviewResults([]);
            return;
        }

        setShowPreview(true);
        setPreviewLoading(true);

        const token = ++cancelRef.current;
        const timer = setTimeout(async () => {
            try {
                // Load filter options lazily on first preview (needed for quick-filter suggestions)
                if (!filterOptionsLoadedRef.current) {
                    filterOptionsLoadedRef.current = true;
                    getFilterOptions()
                        .then(setFilterOptions)
                        .catch(() => { });
                }

                const result = await searchEntities({
                    query: buildSmartQuery(trimmed),
                    types: selectedTypes.length > 0 ? selectedTypes : undefined,
                    platforms: selectedPlatforms.length > 0 ? selectedPlatforms : undefined,
                    domainUrns: selectedDomains.length > 0 ? selectedDomains.map((d) => d.urn) : undefined,
                    tagUrns: selectedTags.length > 0 ? selectedTags.map((t) => t.urn) : undefined,
                    start: 0,
                    count: 5,
                });
                if (token === cancelRef.current) {
                    setPreviewResults(result.entities);
                    setPreviewLoading(false);
                }
            } catch {
                if (token === cancelRef.current) {
                    setPreviewResults([]);
                    setPreviewLoading(false);
                }
            }
        }, 350);

        return () => clearTimeout(timer);
        // selectedTypes/Platforms/Domains/Tags intentionally omitted — preview reflects
        // the keyword change; filters are applied on explicit search.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [keyword]);

    // Close preview when clicking outside the input row
    useEffect(() => {
        const handleMouseDown = (e: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
                setShowPreview(false);
            }
        };
        document.addEventListener('mousedown', handleMouseDown);
        return () => document.removeEventListener('mousedown', handleMouseDown);
    }, []);

    const buildOutput = useCallback(
        (
            overrides: Partial<{
                kw: string;
                types: EntityType[];
                platforms: string[];
                domains: DomainOption[];
                tags: TagOption[];
                range: [Dayjs | null, Dayjs | null] | null;
            }> = {},
        ): SearchBarOutput => {
            const kw = overrides.kw ?? keyword;
            const types = overrides.types ?? selectedTypes;
            const platforms = overrides.platforms ?? selectedPlatforms;
            const domains = overrides.domains ?? selectedDomains;
            const tags = overrides.tags ?? selectedTags;
            const range = overrides.range !== undefined ? overrides.range : dateRange;
            return {
                keyword: kw,
                entityTypes: types,
                platforms,
                domainUrns: domains.map((d) => d.urn),
                tagUrns: tags.map((t) => t.urn),
                startDate: range?.[0]?.startOf('day').valueOf(),
                endDate: range?.[1]?.endOf('day').valueOf(),
            };
        },
        [keyword, selectedTypes, selectedPlatforms, selectedDomains, selectedTags, dateRange],
    );

    const handleSearch = useCallback(() => {
        setShowPreview(false);
        onSearch(buildOutput());
    }, [onSearch, buildOutput]);

    const handlePreviewClick = (entity: MetadataEntity) => {
        setKeyword(entity.name);
        setShowPreview(false);
        onSearch(buildOutput({ kw: entity.name }));
    };

    // Apply a quick-filter suggestion from the preview dropdown.
    // Keyword is cleared so DataHub runs a pure filter search (query = '*') rather than
    // AND-ing the text keyword with the filter — which would hide entities whose
    // name/description don't contain the keyword (e.g. "orders" on MySQL platform).
    const applyQuickPlatform = (platformName: string) => {
        const updated = selectedPlatforms.includes(platformName)
            ? selectedPlatforms
            : [...selectedPlatforms, platformName];
        setSelectedPlatforms(updated);
        setKeyword('');
        setShowPreview(false);
        onSearch(buildOutput({ kw: '', platforms: updated }));
    };

    const applyQuickDomain = (domain: { urn: string; name: string }) => {
        const alreadySelected = selectedDomains.some((d) => d.urn === domain.urn);
        const updated = alreadySelected ? selectedDomains : [...selectedDomains, domain];
        setSelectedDomains(updated);
        setKeyword('');
        setShowPreview(false);
        onSearch(buildOutput({ kw: '', domains: updated }));
    };

    const applyQuickTag = (tag: { urn: string; name: string }) => {
        const alreadySelected = selectedTags.some((t) => t.urn === tag.urn);
        const updated = alreadySelected ? selectedTags : [...selectedTags, tag];
        setSelectedTags(updated);
        setKeyword('');
        setShowPreview(false);
        onSearch(buildOutput({ kw: '', tags: updated }));
    };

    const removeType = (type: EntityType) => {
        const updated = selectedTypes.filter((t) => t !== type);
        setSelectedTypes(updated);
        onSearch(buildOutput({ types: updated }));
    };

    const removePlatform = (p: string) => {
        const updated = selectedPlatforms.filter((x) => x !== p);
        setSelectedPlatforms(updated);
        onSearch(buildOutput({ platforms: updated }));
    };

    const removeDomain = (urn: string) => {
        const updated = selectedDomains.filter((d) => d.urn !== urn);
        setSelectedDomains(updated);
        onSearch(buildOutput({ domains: updated }));
    };

    const removeTag = (urn: string) => {
        const updated = selectedTags.filter((t) => t.urn !== urn);
        setSelectedTags(updated);
        onSearch(buildOutput({ tags: updated }));
    };

    const removeDate = () => {
        setDateRange(null);
        onSearch(buildOutput({ range: null }));
    };

    const clearAll = () => {
        setKeyword('');
        setSelectedTypes([]);
        setSelectedPlatforms([]);
        setSelectedDomains([]);
        setSelectedTags([]);
        setDateRange(null);
        setShowPreview(false);
        onSearch({
            keyword: '',
            entityTypes: [],
            platforms: [],
            domainUrns: [],
            tagUrns: [],
        });
    };

    const hasActiveFilters =
        selectedTypes.length > 0 ||
        selectedPlatforms.length > 0 ||
        selectedDomains.length > 0 ||
        selectedTags.length > 0 ||
        dateRange !== null;

    return (
        <SearchWrapper>
            <SearchTitle>
                <SearchOutlined />
                Tìm kiếm Metadata
            </SearchTitle>

            <InputRow ref={wrapperRef}>
                <SearchInputRow>
                    <StyledInput
                        placeholder="Nhập từ khoá (tên bảng, mô tả, tag, cột...)"
                        value={keyword}
                        onChange={(e) => setKeyword(e.target.value)}
                        onSearch={handleSearch}
                        onPressEnter={handleSearch}
                        onFocus={() => keyword.trim().length >= 2 && setShowPreview(true)}
                        onKeyDown={(e) => {
                            if (e.key === 'Escape') setShowPreview(false);
                        }}
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
                            style={showFilters ? { background: '#ee0033', borderColor: '#ee0033' } : {}}
                        >
                            Bộ lọc{' '}
                            {hasActiveFilters &&
                                `(${selectedTypes.length + selectedPlatforms.length + selectedDomains.length + selectedTags.length + (dateRange ? 1 : 0)})`}
                        </Button>
                    </Tooltip>
                </SearchInputRow>

                {/* ── Preview dropdown ── */}
                {showPreview && keyword.trim().length >= 2 && (
                    <PreviewDropdown>
                        {/* Quick filter suggestions: matching domains / tags / platforms */}
                        {filterOptions && (() => {
                            const kw = keyword.trim();
                            const matchedPlatforms = filterOptions.platforms.filter(
                                (p) =>
                                    vietnameseIncludes(kw, p.displayName) ||
                                    vietnameseIncludes(kw, p.name),
                            );
                            const matchedDomains = filterOptions.domains.filter((d) =>
                                vietnameseIncludes(kw, d.name),
                            );
                            const matchedTags = filterOptions.tags.filter((t) =>
                                vietnameseIncludes(kw, t.name),
                            );
                            const hasQuickFilters =
                                matchedPlatforms.length > 0 ||
                                matchedDomains.length > 0 ||
                                matchedTags.length > 0;

                            if (!hasQuickFilters) return null;

                            return (
                                <QuickFilterSection>
                                    <QuickFilterLabel>Bộ lọc nhanh</QuickFilterLabel>
                                    {matchedPlatforms.map((p) => (
                                        <QuickFilterChip
                                            key={p.name}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                applyQuickPlatform(p.name);
                                            }}
                                        >
                                            <ChipTypeLabel>Nền tảng:</ChipTypeLabel>
                                            {p.displayName}
                                        </QuickFilterChip>
                                    ))}
                                    {matchedDomains.map((d) => (
                                        <QuickFilterChip
                                            key={d.urn}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                applyQuickDomain(d);
                                            }}
                                        >
                                            <ChipTypeLabel>Domain:</ChipTypeLabel>
                                            {d.name}
                                        </QuickFilterChip>
                                    ))}
                                    {matchedTags.map((t) => (
                                        <QuickFilterChip
                                            key={t.urn}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                applyQuickTag(t);
                                            }}
                                        >
                                            <ChipTypeLabel>Tag:</ChipTypeLabel>
                                            {t.name}
                                        </QuickFilterChip>
                                    ))}
                                </QuickFilterSection>
                            );
                        })()}

                        {/* Entity results */}
                        {previewLoading ? (
                            <PreviewStatusRow>
                                <Spin size="small" />
                                Đang tìm kiếm…
                            </PreviewStatusRow>
                        ) : previewResults.length === 0 ? (
                            <PreviewStatusRow>Không tìm thấy kết quả phù hợp</PreviewStatusRow>
                        ) : (
                            <>
                                {previewResults.map((entity) => (
                                    <PreviewRow key={entity.urn} onClick={() => handlePreviewClick(entity)}>
                                        <PreviewIconCell>{ENTITY_ICONS[entity.type]}</PreviewIconCell>
                                        <PreviewContent>
                                            <PreviewName>
                                                {highlightText(entity.name, keyword.trim())}
                                            </PreviewName>
                                            <PreviewMeta>
                                                <span style={{ fontSize: 10, color: '#9e9e9e' }}>
                                                    {ENTITY_TYPE_LABELS[entity.type]}
                                                </span>
                                                {entity.platform && (
                                                    <PreviewPlatform>
                                                        {platformNameMap[entity.platform] ?? entity.platform.toUpperCase()}
                                                    </PreviewPlatform>
                                                )}
                                                {entity.domains?.[0] && (
                                                    <PreviewDomain>{entity.domains[0].name}</PreviewDomain>
                                                )}
                                            </PreviewMeta>
                                            {entity.description && (
                                                <PreviewDesc>
                                                    {highlightText(entity.description, keyword.trim())}
                                                </PreviewDesc>
                                            )}
                                        </PreviewContent>
                                    </PreviewRow>
                                ))}
                                <PreviewFooter onClick={handleSearch}>
                                    <ArrowRightOutlined />
                                    Xem tất cả kết quả cho &ldquo;{keyword}&rdquo;
                                </PreviewFooter>
                            </>
                        )}
                    </PreviewDropdown>
                )}
            </InputRow>

            {showFilters && (
                <>
                    <FilterGrid>
                        <FilterItem>
                            <FilterLabel>Loại đối tượng</FilterLabel>
                            <Select
                                mode="multiple"
                                placeholder="Tất cả loại"
                                value={selectedTypes}
                                onChange={setSelectedTypes}
                                maxTagCount={1}
                                options={Object.entries(ENTITY_TYPE_LABELS).map(([k, v]) => ({
                                    value: k,
                                    label: v,
                                }))}
                            />
                        </FilterItem>

                        <FilterItem>
                            <FilterLabel>Nền tảng</FilterLabel>
                            <Select
                                mode="multiple"
                                placeholder="Tất cả nền tảng"
                                value={selectedPlatforms}
                                onChange={setSelectedPlatforms}
                                loading={loadingOptions}
                                maxTagCount={1}
                                showSearch
                                options={platformOptions}
                                notFoundContent={loadingOptions ? 'Đang tải...' : 'Không có dữ liệu'}
                            />
                        </FilterItem>

                        <FilterItem>
                            <FilterLabel>Domain</FilterLabel>
                            <Select
                                mode="multiple"
                                placeholder="Tất cả domain"
                                value={selectedDomains.map((d) => d.urn)}
                                onChange={(urns: string[]) =>
                                    setSelectedDomains(
                                        urns
                                            .map((urn) => domainOptions.find((d) => d.urn === urn)!)
                                            .filter(Boolean),
                                    )
                                }
                                loading={loadingOptions}
                                maxTagCount={1}
                                showSearch
                                filterOption={(input, opt) =>
                                    String(opt?.label ?? '')
                                        .toLowerCase()
                                        .includes(input.toLowerCase())
                                }
                                options={domainOptions.map((d) => ({ value: d.urn, label: d.name }))}
                                notFoundContent={loadingOptions ? 'Đang tải...' : 'Không có domain'}
                            />
                        </FilterItem>

                        <FilterItem>
                            <FilterLabel>Tags</FilterLabel>
                            <Select
                                mode="multiple"
                                placeholder="Tất cả tags"
                                value={selectedTags.map((t) => t.urn)}
                                onChange={(urns: string[]) =>
                                    setSelectedTags(
                                        urns
                                            .map((urn) => tagOptions.find((t) => t.urn === urn)!)
                                            .filter(Boolean),
                                    )
                                }
                                loading={loadingOptions}
                                maxTagCount={1}
                                showSearch
                                filterOption={(input, opt) =>
                                    String(opt?.label ?? '')
                                        .toLowerCase()
                                        .includes(input.toLowerCase())
                                }
                                options={tagOptions.map((t) => ({ value: t.urn, label: t.name }))}
                                notFoundContent={loadingOptions ? 'Đang tải...' : 'Không có tag'}
                            />
                        </FilterItem>

                        <FilterItem style={{ minWidth: 200 }}>
                            <FilterLabel>Ngày cập nhật</FilterLabel>
                            <RangePicker
                                value={dateRange}
                                onChange={(val) =>
                                    setDateRange(val as [Dayjs | null, Dayjs | null] | null)
                                }
                                format="DD/MM/YYYY"
                                placeholder={['Từ ngày', 'Đến ngày']}
                                style={{ width: '100%' }}
                            />
                        </FilterItem>
                    </FilterGrid>

                    <FilterActions>
                        <Button
                            type="primary"
                            onClick={handleSearch}
                            style={{ background: '#ee0033', borderColor: '#ee0033' }}
                        >
                            Áp dụng bộ lọc
                        </Button>
                        {hasActiveFilters && (
                            <Button
                                type="link"
                                onClick={clearAll}
                                style={{ color: '#ee0033', padding: 0 }}
                            >
                                Xoá tất cả
                            </Button>
                        )}
                    </FilterActions>
                </>
            )}

            {hasActiveFilters && (
                <ActiveFilters>
                    <ActiveFiltersLabel>Đang lọc:</ActiveFiltersLabel>
                    {selectedTypes.map((t) => (
                        <Tag
                            key={t}
                            closable
                            onClose={() => removeType(t)}
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
                            onClose={() => removePlatform(p)}
                            color="volcano"
                            style={{ borderRadius: 4 }}
                        >
                            {platformNameMap[p] ?? p.toUpperCase()}
                        </Tag>
                    ))}
                    {selectedDomains.map((d) => (
                        <Tag
                            key={d.urn}
                            closable
                            onClose={() => removeDomain(d.urn)}
                            color="purple"
                            style={{ borderRadius: 4 }}
                        >
                            {d.name}
                        </Tag>
                    ))}
                    {selectedTags.map((t) => (
                        <Tag
                            key={t.urn}
                            closable
                            onClose={() => removeTag(t.urn)}
                            color="blue"
                            style={{ borderRadius: 4 }}
                        >
                            {t.name}
                        </Tag>
                    ))}
                    {dateRange && (
                        <Tag
                            closable
                            onClose={removeDate}
                            color="cyan"
                            style={{ borderRadius: 4 }}
                        >
                            {dateRange[0]?.format('DD/MM/YYYY')} – {dateRange[1]?.format('DD/MM/YYYY')}
                        </Tag>
                    )}
                    {!showFilters && (
                        <Button
                            type="link"
                            size="small"
                            icon={<CloseCircleOutlined />}
                            onClick={clearAll}
                            style={{ color: '#ee0033', padding: '0 4px' }}
                        >
                            Xoá tất cả
                        </Button>
                    )}
                </ActiveFilters>
            )}
        </SearchWrapper>
    );
}
