import React, { useState, useCallback } from 'react';
import styled from 'styled-components';
import { message, Tag } from 'antd';
import AppLayout from '../components/layout/AppLayout';
import SearchBar from '../components/search/SearchBar';
import type { SearchBarOutput } from '../components/search/SearchBar';
import SearchResults from '../components/search/SearchResults';
import type { MetadataEntity } from '../types';
import { semanticSearchEntities, getFilterOptions } from '../api/datahubApi';
import { vietnameseIncludes } from '../utils/vietnamese';

const PageWrapper = styled.div`
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 16px;
`;

const TranslationHint = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    font-size: 12px;
    color: #888;
`;

const PAGE_SIZE = 10;

const DEFAULT_FILTERS: SearchBarOutput = {
    keyword: '',
    entityTypes: [],
    platforms: [],
    domainUrns: [],
    tagUrns: [],
};

function mergeEntities(firstList: MetadataEntity[], secondList: MetadataEntity[]): MetadataEntity[] {
    const seen = new Set(firstList.map((e) => e.urn));
    const extras = secondList.filter((e) => !seen.has(e.urn));
    return [...firstList, ...extras];
}

export default function SearchPage() {
    const [entities, setEntities] = useState<MetadataEntity[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [hasSearched, setHasSearched] = useState(false);
    const [lastFilters, setLastFilters] = useState<SearchBarOutput>(DEFAULT_FILTERS);
    const [aiSearch, setAiSearch] = useState(false);

    const doSearch = useCallback(async (filters: SearchBarOutput, currentPage: number, useAiSearch = false) => {
        setLoading(true);
        try {
            // Main search via backend (keyword + semantic combined, or vector if AI mode)
            const mainSearchPromise = semanticSearchEntities({
                query: filters.keyword || '*',
                types: filters.entityTypes,
                platforms: filters.platforms,
                domainUrns: filters.domainUrns,
                tagUrns: filters.tagUrns,
                startDate: filters.startDate,
                endDate: filters.endDate,
                start: (currentPage - 1) * PAGE_SIZE,
                count: PAGE_SIZE,
                aiSearch: useAiSearch,
            });

            // On page 1 with keyword but no explicit filters: auto-detect domain/tag/platform
            const shouldAutoDetect =
                currentPage === 1 &&
                !!filters.keyword.trim() &&
                filters.platforms.length === 0 &&
                filters.domainUrns.length === 0 &&
                filters.tagUrns.length === 0;

            const autoFilterPromise: Promise<MetadataEntity[]> = shouldAutoDetect
                ? getFilterOptions().then(async (opts) => {
                      const kw = filters.keyword.trim();

                      const matchedDomainUrns = opts.domains
                          .filter((d) => vietnameseIncludes(kw, d.name))
                          .map((d) => d.urn);
                      const matchedTagUrns = opts.tags
                          .filter((t) => vietnameseIncludes(kw, t.name))
                          .map((t) => t.urn);
                      const matchedPlatforms = opts.platforms
                          .filter((p) => vietnameseIncludes(kw, p.displayName) || vietnameseIncludes(kw, p.name))
                          .map((p) => p.name);

                      if (!matchedDomainUrns.length && !matchedTagUrns.length && !matchedPlatforms.length) {
                          return [];
                      }

                      const filterSearches = [
                          matchedDomainUrns.length > 0
                              ? semanticSearchEntities({ query: '*', types: filters.entityTypes, domainUrns: matchedDomainUrns, count: 20 })
                              : null,
                          matchedTagUrns.length > 0
                              ? semanticSearchEntities({ query: '*', types: filters.entityTypes, tagUrns: matchedTagUrns, count: 20 })
                              : null,
                          matchedPlatforms.length > 0
                              ? semanticSearchEntities({ query: '*', types: filters.entityTypes, platforms: matchedPlatforms, count: 20 })
                              : null,
                      ].filter(Boolean) as Promise<{ entities: MetadataEntity[]; total: number; translatedTerms: string[] }>[];

                      const results = await Promise.allSettled(filterSearches);
                      const seen = new Set<string>();
                      const combined: MetadataEntity[] = [];
                      for (const r of results) {
                          if (r.status === 'fulfilled') {
                              for (const e of r.value.entities) {
                                  if (!seen.has(e.urn)) {
                                      seen.add(e.urn);
                                      combined.push(e);
                                  }
                              }
                          }
                      }
                      return combined;
                  })
                : Promise.resolve([]);

            const [mainResult, autoEntities] = await Promise.all([mainSearchPromise, autoFilterPromise]);

            const merged = mergeEntities(mainResult.entities, autoEntities);
            const extraCount = autoEntities.filter(
                (e) => !mainResult.entities.some((t) => t.urn === e.urn),
            ).length;

            setEntities(merged);
            setTotal(mainResult.total + extraCount);
            setHasSearched(true);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            message.error(`Lỗi tìm kiếm: ${msg}`);
            console.error('[SearchPage] search error:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    const handleSearch = useCallback(
        (filters: SearchBarOutput) => {
            setPage(1);
            setLastFilters(filters);
            doSearch(filters, 1, aiSearch);
        },
        [doSearch, aiSearch],
    );

    const handlePageChange = (newPage: number, _pageSize: number) => {
        setPage(newPage);
        doSearch(lastFilters, newPage, aiSearch);
    };

    return (
        <AppLayout pageTitle="Tìm kiếm Metadata">
            <PageWrapper>
                <SearchBar onSearch={handleSearch} loading={loading} aiSearch={aiSearch} onAiSearchChange={setAiSearch} />

                {hasSearched && aiSearch && (
                    <TranslationHint>
                        <Tag color="red" style={{ margin: 0, fontWeight: 600 }}>🤖 AI Search</Tag>
                        <span>Tìm kiếm theo ngữ nghĩa đa ngôn ngữ (vector embedding)</span>
                    </TranslationHint>
                )}

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
