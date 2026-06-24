import React, { useState, useCallback } from 'react';
import styled from 'styled-components';
import { message } from 'antd';
import AppLayout from '../components/layout/AppLayout';
import SearchBar from '../components/search/SearchBar';
import SearchResults from '../components/search/SearchResults';
import type { EntityType, MetadataEntity } from '../types';
import { searchEntities } from '../api/datahubApi';

const PageWrapper = styled.div`
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 16px;
`;

const PAGE_SIZE = 10;

export default function SearchPage() {
    const [entities, setEntities] = useState<MetadataEntity[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [hasSearched, setHasSearched] = useState(false);

    // Current search params — kept in refs so handlePageChange can reuse them.
    const [lastQuery, setLastQuery] = useState('');
    const [lastTypes, setLastTypes] = useState<EntityType[]>([]);
    const [lastPlatforms, setLastPlatforms] = useState<string[]>([]);

    const doSearch = useCallback(
        async (query: string, types: EntityType[], platforms: string[], currentPage: number) => {
            setLoading(true);
            try {
                const result = await searchEntities({
                    query: query || '*',
                    types,
                    platforms,
                    start: (currentPage - 1) * PAGE_SIZE,
                    count: PAGE_SIZE,
                });
                setEntities(result.entities);
                setTotal(result.total);
                setHasSearched(true);
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                message.error(`Lỗi tìm kiếm: ${msg}`);
                console.error('[SearchPage] search error:', err);
            } finally {
                setLoading(false);
            }
        },
        [],
    );

    const handleSearch = useCallback(
        (keyword: string, entityTypes: EntityType[], platforms: string[]) => {
            setPage(1);
            setLastQuery(keyword);
            setLastTypes(entityTypes);
            setLastPlatforms(platforms);
            doSearch(keyword, entityTypes, platforms, 1);
        },
        [doSearch],
    );

    const handlePageChange = (newPage: number, _pageSize: number) => {
        setPage(newPage);
        doSearch(lastQuery, lastTypes, lastPlatforms, newPage);
    };

    return (
        <AppLayout pageTitle="Tìm kiếm Metadata">
            <PageWrapper>
                <SearchBar onSearch={handleSearch} loading={loading} />

                {hasSearched && (
                    <SearchResults
                        entities={entities}
                        total={total}
                        loading={loading}
                        page={page}
                        pageSize={PAGE_SIZE}
                        onPageChange={handlePageChange}
                        onEntitiesChange={setEntities}
                    />
                )}
            </PageWrapper>
        </AppLayout>
    );
}
