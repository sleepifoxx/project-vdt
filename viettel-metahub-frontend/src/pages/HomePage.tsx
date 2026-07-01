import React, { useEffect, useState } from 'react';
import { Row, Col, Card, Statistic, Typography, Space, Tag, Progress, List, Avatar, Button } from 'antd';
import {
    DatabaseOutlined, DashboardOutlined, TeamOutlined, ApiOutlined,
    RiseOutlined, CheckCircleOutlined, SyncOutlined, WarningOutlined,
    FileTextOutlined, SearchOutlined, ApartmentOutlined,
    SettingOutlined, ClockCircleOutlined, ArrowRightOutlined,
} from '@ant-design/icons';
import styled, { keyframes } from 'styled-components';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/vi';
import AppLayout from '../components/layout/AppLayout';
import type { EntityType, MetadataEntity } from '../types';
import { getEntityCount, getPlatformAggregations, searchEntities } from '../api/datahubApi';

dayjs.extend(relativeTime);
dayjs.locale('vi');

const { Title, Text } = Typography;

// ─── Animations ───────────────────────────────────────────────────────────────

const fadeUp = keyframes`
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.6; }
`;

// ─── Page Wrapper ─────────────────────────────────────────────────────────────

const PageWrapper = styled.div`
    padding: 28px 28px 32px;
    animation: ${fadeUp} 0.4s ease;
`;

// ─── Welcome Banner ───────────────────────────────────────────────────────────

const WelcomeBanner = styled.div`
    background: linear-gradient(135deg, #ee0033 0%, #c8002b 55%, #9a0020 100%);
    border-radius: 16px;
    padding: 36px 40px;
    margin-bottom: 28px;
    color: white;
    position: relative;
    overflow: hidden;
    box-shadow: 0 8px 32px rgba(238, 0, 51, 0.28);

    /* Large decorative circle — top right */
    &::before {
        content: '';
        position: absolute;
        right: -60px;
        top: -60px;
        width: 260px;
        height: 260px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.06);
        pointer-events: none;
    }

    /* Medium circle — bottom right */
    &::after {
        content: '';
        position: absolute;
        right: 100px;
        bottom: -80px;
        width: 200px;
        height: 200px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.04);
        pointer-events: none;
    }
`;

const BannerGrid = styled.div`
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 24px;
    position: relative;
    z-index: 1;

    @media (max-width: 768px) {
        flex-direction: column;
    }
`;

const BannerLeft = styled.div`
    flex: 1;
`;

const BannerRight = styled.div`
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 10px;
    flex-shrink: 0;
`;

const BannerDate = styled(Text)`
    color: rgba(255, 255, 255, 0.6) !important;
    font-size: 12px;
    letter-spacing: 0.5px;
    text-transform: uppercase;
`;

const BannerTitle = styled(Title)`
    color: white !important;
    margin: 4px 0 8px !important;
    font-size: 28px !important;
    line-height: 1.25 !important;
`;

const BannerSub = styled(Text)`
    color: rgba(255, 255, 255, 0.78);
    font-size: 14px;
    line-height: 1.6;
    display: block;
    max-width: 520px;
`;

const BannerBadge = styled.div`
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: rgba(255, 255, 255, 0.12);
    border: 1px solid rgba(255, 255, 255, 0.25);
    border-radius: 20px;
    padding: 4px 12px;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.9);
    backdrop-filter: blur(4px);
`;

const LiveDot = styled.span`
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #4ade80;
    display: inline-block;
    animation: ${pulse} 1.8s ease-in-out infinite;
`;


const BannerBtnPrimary = styled(Button)`
    background: white !important;
    border: none !important;
    color: #ee0033 !important;
    border-radius: 8px !important;
    font-size: 13px !important;
    font-weight: 600 !important;
    height: 36px !important;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15) !important;

    &:hover {
        background: #fff5f7 !important;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18) !important;
    }
`;

// ─── Stat Cards ───────────────────────────────────────────────────────────────

const StatCard = styled(Card) <{ $accentColor: string }>`
    border-radius: 12px;
    border: 1px solid #f0f0f0;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
    transition: transform 0.2s, box-shadow 0.2s;
    cursor: pointer;
    overflow: hidden;
    position: relative;

    &::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 3px;
        background: ${({ $accentColor }) => $accentColor};
        border-radius: 12px 12px 0 0;
    }

    &:hover {
        transform: translateY(-3px);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
    }

    .ant-card-body {
        padding: 20px;
    }

    .ant-statistic-title {
        font-size: 12px;
        color: #9e9e9e;
        font-weight: 500;
        margin-bottom: 4px;
    }

    .ant-statistic-content-value {
        font-size: 30px;
        font-weight: 700;
        color: #1a1a2e;
        line-height: 1.1;
    }
`;

const StatIconWrap = styled.div<{ $bg: string; $color: string }>`
    width: 48px;
    height: 48px;
    border-radius: 12px;
    background: ${({ $bg }) => $bg};
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22px;
    color: ${({ $color }) => $color};
    margin-bottom: 14px;
    flex-shrink: 0;
`;

const StatTrend = styled.div<{ $up: boolean }>`
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: 11px;
    color: ${({ $up }) => ($up ? '#16a34a' : '#dc2626')};
    background: ${({ $up }) => ($up ? '#f0fdf4' : '#fef2f2')};
    border-radius: 4px;
    padding: 2px 6px;
    margin-top: 6px;
`;

// ─── Quick Actions ────────────────────────────────────────────────────────────

const QuickActionCard = styled(Card)`
    border-radius: 12px;
    border: 1px solid #f0f0f0;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
        border-color: #ee0033;
        box-shadow: 0 4px 16px rgba(238, 0, 51, 0.1);
        transform: translateY(-2px);
    }

    .ant-card-body {
        padding: 18px 20px;
        display: flex;
        align-items: center;
        gap: 14px;
    }
`;

const QAIcon = styled.div<{ $bg: string; $color: string }>`
    width: 42px;
    height: 42px;
    border-radius: 10px;
    background: ${({ $bg }) => $bg};
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    color: ${({ $color }) => $color};
    flex-shrink: 0;
`;

const QAContent = styled.div`
    flex: 1;
    min-width: 0;
`;

// ─── Section Cards ────────────────────────────────────────────────────────────

const SectionCard = styled(Card)`
    border-radius: 12px;
    border: 1px solid #f0f0f0;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);

    .ant-card-head {
        border-bottom: 1px solid #f5f5f5;
        min-height: 52px;
        padding: 0 20px;

        .ant-card-head-title {
            font-size: 14px;
            font-weight: 600;
            color: #1a1a2e;
        }
    }

    .ant-card-body {
        padding: 16px 20px;
    }
`;

const PlatformRow = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 4px;
`;

const PlatformBar = styled.div<{ $percent: number; $color: string }>`
    height: 8px;
    border-radius: 4px;
    background: linear-gradient(90deg, ${({ $color }) => $color} ${({ $percent }) => $percent}%, #f0f0f0 ${({ $percent }) => $percent}%);
    margin-bottom: 14px;
`;

const ActivityDot = styled.div<{ $type: 'success' | 'info' | 'error' }>`
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: ${({ $type }) =>
        $type === 'success' ? '#22c55e' : $type === 'error' ? '#ef4444' : '#3b82f6'};
    flex-shrink: 0;
    margin-top: 5px;
`;

const TimelineLine = styled.div`
    position: relative;

    &::before {
        content: '';
        position: absolute;
        left: 3px;
        top: 14px;
        bottom: 14px;
        width: 2px;
        background: #f0f0f0;
        border-radius: 1px;
    }
`;

const TimelineItem = styled.div`
    display: flex;
    gap: 12px;
    padding: 8px 0;
    position: relative;
    z-index: 1;
`;

// ─── Data definitions ─────────────────────────────────────────────────────────

const STAT_DEFS: Array<{
    title: string;
    types: EntityType[];
    icon: React.ReactNode;
    bg: string;
    color: string;
    accent: string;
    trendLabel: string;
}> = [
        {
            title: 'Tổng Metadata',
            types: ['DATASET', 'DASHBOARD', 'CHART', 'DATA_FLOW', 'DATA_JOB'],
            icon: <DatabaseOutlined />,
            bg: '#fff0f3',
            color: '#ee0033',
            accent: '#ee0033',
            trendLabel: 'Tất cả loại',
        },
        {
            title: 'Dashboard',
            types: ['DASHBOARD'],
            icon: <DashboardOutlined />,
            bg: '#eff6ff',
            color: '#2563eb',
            accent: '#2563eb',
            trendLabel: 'Biểu đồ & báo cáo',
        },
        {
            title: 'Datasets',
            types: ['DATASET'],
            icon: <ApiOutlined />,
            bg: '#f0fdf4',
            color: '#16a34a',
            accent: '#16a34a',
            trendLabel: 'Bộ dữ liệu',
        },
        {
            title: 'Người dùng',
            types: ['CORP_USER'],
            icon: <TeamOutlined />,
            bg: '#fff7ed',
            color: '#ea580c',
            accent: '#ea580c',
            trendLabel: 'Tài khoản hệ thống',
        },
    ];

const PLATFORM_COLORS = ['#ee0033', '#2563eb', '#16a34a', '#ea580c', '#7c3aed', '#0891b2'];

const QUICK_ACTIONS = [
    {
        icon: <SearchOutlined />,
        bg: '#fff0f3',
        color: '#ee0033',
        title: 'Tìm kiếm metadata',
        desc: 'Khám phá toàn bộ tài sản dữ liệu',
        path: '/search',
    },
    {
        icon: <ApartmentOutlined />,
        bg: '#eff6ff',
        color: '#2563eb',
        title: 'Phân loại dữ liệu',
        desc: 'Quản lý phòng ban & dự án',
        path: '/classification',
    },
    {
        icon: <SettingOutlined />,
        bg: '#fff7ed',
        color: '#ea580c',
        title: 'Kết nối & Cập nhật',
        desc: 'Cấu hình nguồn dữ liệu',
        path: '/settings',
    },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

type PlatformStat = { name: string; count: number; percent: number };

function entityToActivity(entity: MetadataEntity): {
    text: string;
    time: string;
    type: 'success' | 'info' | 'error';
} {
    const name = entity.name || entity.urn;
    const timeAgo = dayjs(entity.lastUpdated).fromNow();
    return {
        text: `${name} được cập nhật metadata`,
        time: timeAgo,
        type: 'success',
    };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function HomePage() {
    const navigate = useNavigate();
    const [statValues, setStatValues] = useState<number[]>(STAT_DEFS.map(() => 0));
    const [platformStats, setPlatformStats] = useState<PlatformStat[]>([]);
    const [recentEntities, setRecentEntities] = useState<MetadataEntity[]>([]);
    const [platformTotal, setPlatformTotal] = useState(0);

    useEffect(() => {
        STAT_DEFS.forEach((def, idx) => {
            getEntityCount(def.types)
                .then((count) => {
                    setStatValues((prev) => {
                        const next = [...prev];
                        next[idx] = count;
                        return next;
                    });
                })
                .catch(() => { });
        });

        getPlatformAggregations()
            .then((stats) => {
                setPlatformStats(stats);
                setPlatformTotal(stats.reduce((s, p) => s + p.count, 0));
            })
            .catch(() => { });

        searchEntities({ query: '*', types: ['DATASET', 'DASHBOARD', 'CHART'], count: 5 })
            .then((result) => setRecentEntities(result.entities))
            .catch(() => { });
    }, []);

    const stats = STAT_DEFS.map((def, idx) => ({ ...def, value: statValues[idx] }));
    const activities = recentEntities.map(entityToActivity);

    const today = dayjs().locale('vi').format('dddd, D MMMM YYYY');

    return (
        <AppLayout pageTitle="Tổng quan">
            <PageWrapper>
                {/* ── Welcome Banner ── */}
                <WelcomeBanner>
                    <BannerGrid>
                        <BannerLeft>
                            <BannerDate>{today}</BannerDate>
                            <BannerTitle level={2}>
                                Chào mừng đến với<br />Viettel MetaHub
                            </BannerTitle>
                            <BannerSub>
                                Nền tảng quản lý và khám phá metadata tập trung
                            </BannerSub>
                            <Space style={{ marginTop: 22 }} size={10}>
                                <BannerBtnPrimary
                                    icon={<SearchOutlined />}
                                    onClick={() => navigate('/search')}
                                >
                                    Khám phá dữ liệu
                                </BannerBtnPrimary>
                            </Space>
                        </BannerLeft>

                        <BannerRight>
                            <BannerBadge>
                                <LiveDot />
                                Dữ liệu thời gian thực
                            </BannerBadge>
                            <BannerBadge>
                                <SyncOutlined style={{ fontSize: 11 }} />
                                Đồng bộ liên tục
                            </BannerBadge>
                            <BannerBadge>
                                <CheckCircleOutlined style={{ fontSize: 11 }} />
                                Hệ thống hoạt động tốt
                            </BannerBadge>
                        </BannerRight>
                    </BannerGrid>
                </WelcomeBanner>

                {/* ── Stat Cards ── */}
                <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                    {stats.map((stat, idx) => (
                        <Col xs={24} sm={12} lg={6} key={idx}>
                            <StatCard
                                $accentColor={stat.accent}
                                onClick={() => navigate('/search')}
                            >
                                <StatIconWrap $bg={stat.bg} $color={stat.color}>
                                    {stat.icon}
                                </StatIconWrap>
                                <Statistic
                                    title={stat.title}
                                    value={stat.value}
                                />
                                <StatTrend $up>
                                    <RiseOutlined style={{ fontSize: 10 }} />
                                    {stat.trendLabel}
                                </StatTrend>
                            </StatCard>
                        </Col>
                    ))}
                </Row>

                {/* ── Quick Actions ── */}
                <div style={{ marginBottom: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
                        <Text style={{ fontSize: 14, fontWeight: 600, color: '#1a1a2e' }}>
                            Thao tác nhanh
                        </Text>
                    </div>
                    <Row gutter={[12, 12]}>
                        {QUICK_ACTIONS.map((action) => (
                            <Col xs={24} sm={12} lg={8} key={action.path}>
                                <QuickActionCard onClick={() => navigate(action.path)}>
                                    <QAIcon $bg={action.bg} $color={action.color}>
                                        {action.icon}
                                    </QAIcon>
                                    <QAContent>
                                        <Text
                                            style={{
                                                fontSize: 13,
                                                fontWeight: 600,
                                                color: '#1a1a2e',
                                                display: 'block',
                                                marginBottom: 2,
                                            }}
                                        >
                                            {action.title}
                                        </Text>
                                        <Text
                                            type="secondary"
                                            style={{ fontSize: 11, lineHeight: 1.4 }}
                                        >
                                            {action.desc}
                                        </Text>
                                    </QAContent>
                                    <ArrowRightOutlined
                                        style={{ color: '#d1d5db', fontSize: 13, flexShrink: 0 }}
                                    />
                                </QuickActionCard>
                            </Col>
                        ))}
                    </Row>
                </div>

                {/* ── Platform + Activity ── */}
                <Row gutter={[16, 16]}>
                    <Col xs={24} lg={14}>
                        <SectionCard
                            title="Phân bổ theo nền tảng"
                            extra={
                                platformTotal > 0 ? (
                                    <Tag color="default" style={{ borderRadius: 6, fontWeight: 500 }}>
                                        {platformTotal.toLocaleString('vi-VN')} đối tượng
                                    </Tag>
                                ) : null
                            }
                        >
                            {platformStats.length === 0 ? (
                                <div
                                    style={{
                                        textAlign: 'center',
                                        padding: '32px 0',
                                        color: '#9e9e9e',
                                        fontSize: 13,
                                    }}
                                >
                                    Chưa có dữ liệu nền tảng
                                </div>
                            ) : (
                                <Space direction="vertical" style={{ width: '100%' }} size={6}>
                                    {platformStats.map((platform, i) => (
                                        <div key={platform.name}>
                                            <PlatformRow>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <div
                                                        style={{
                                                            width: 8,
                                                            height: 8,
                                                            borderRadius: 2,
                                                            background:
                                                                PLATFORM_COLORS[i % PLATFORM_COLORS.length],
                                                            flexShrink: 0,
                                                        }}
                                                    />
                                                    <Text style={{ fontSize: 13, fontWeight: 500, color: '#374151' }}>
                                                        {platform.name}
                                                    </Text>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                    <Text
                                                        type="secondary"
                                                        style={{ fontSize: 12 }}
                                                    >
                                                        {platform.count.toLocaleString('vi-VN')}
                                                    </Text>
                                                    <Text
                                                        style={{
                                                            fontSize: 11,
                                                            fontWeight: 600,
                                                            color: PLATFORM_COLORS[i % PLATFORM_COLORS.length],
                                                            background: `${PLATFORM_COLORS[i % PLATFORM_COLORS.length]}14`,
                                                            borderRadius: 4,
                                                            padding: '1px 6px',
                                                        }}
                                                    >
                                                        {platform.percent}%
                                                    </Text>
                                                </div>
                                            </PlatformRow>
                                            <PlatformBar
                                                $percent={platform.percent}
                                                $color={PLATFORM_COLORS[i % PLATFORM_COLORS.length]}
                                            />
                                        </div>
                                    ))}
                                </Space>
                            )}
                        </SectionCard>
                    </Col>

                    <Col xs={24} lg={10}>
                        <SectionCard
                            title="Hoạt động gần đây"
                            extra={
                                <Button
                                    type="link"
                                    size="small"
                                    style={{ color: '#ee0033', fontSize: 12, padding: 0 }}
                                    onClick={() => navigate('/search')}
                                >
                                    Xem thêm
                                </Button>
                            }
                            style={{ height: '100%' }}
                        >
                            {activities.length === 0 ? (
                                <div
                                    style={{
                                        textAlign: 'center',
                                        padding: '32px 0',
                                        color: '#9e9e9e',
                                        fontSize: 13,
                                    }}
                                >
                                    Chưa có hoạt động gần đây
                                </div>
                            ) : (
                                <TimelineLine>
                                    {activities.map((item, idx) => (
                                        <TimelineItem key={idx}>
                                            <ActivityDot $type={item.type} />
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <Text
                                                    style={{
                                                        fontSize: 12,
                                                        fontWeight: 500,
                                                        color: '#374151',
                                                        display: 'block',
                                                        marginBottom: 2,
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        whiteSpace: 'nowrap',
                                                    }}
                                                    title={item.text}
                                                >
                                                    {item.text}
                                                </Text>
                                                <div
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: 4,
                                                    }}
                                                >
                                                    <ClockCircleOutlined
                                                        style={{ color: '#9e9e9e', fontSize: 10 }}
                                                    />
                                                    <Text
                                                        type="secondary"
                                                        style={{ fontSize: 11 }}
                                                    >
                                                        {item.time}
                                                    </Text>
                                                </div>
                                            </div>
                                        </TimelineItem>
                                    ))}
                                </TimelineLine>
                            )}
                        </SectionCard>
                    </Col>
                </Row>
            </PageWrapper>
        </AppLayout>
    );
}
