import React, { useEffect, useState } from 'react';
import { Row, Col, Card, Statistic, Typography, Space, Tag, Progress, List, Avatar } from 'antd';
import {
    DatabaseOutlined, DashboardOutlined, TeamOutlined, ApiOutlined,
    RiseOutlined, CheckCircleOutlined, SyncOutlined, WarningOutlined,
    FileTextOutlined,
} from '@ant-design/icons';
import styled from 'styled-components';
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

const PageWrapper = styled.div`
    padding: 24px;
`;

const WelcomeBanner = styled.div`
    background: linear-gradient(135deg, #ee0033 0%, #cc0029 60%, #aa0022 100%);
    border-radius: 14px;
    padding: 32px 36px;
    margin-bottom: 24px;
    color: white;
    position: relative;
    overflow: hidden;

    &::before {
        content: '';
        position: absolute;
        right: -40px;
        top: -40px;
        width: 200px;
        height: 200px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.07);
    }

    &::after {
        content: '';
        position: absolute;
        right: 60px;
        bottom: -60px;
        width: 160px;
        height: 160px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.05);
    }
`;

const WelcomeTitle = styled(Title)`
    color: white !important;
    margin: 0 0 6px !important;
    font-size: 26px !important;
`;

const WelcomeSub = styled(Text)`
    color: rgba(255, 255, 255, 0.85);
    font-size: 14px;
`;

const StatCard = styled(Card)`
    border-radius: 10px;
    border: 1px solid #f0f0f0;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
    transition: transform 0.2s, box-shadow 0.2s;
    cursor: pointer;

    &:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.1);
    }

    .ant-statistic-title {
        font-size: 12px;
        color: #9e9e9e;
        font-weight: 500;
    }

    .ant-statistic-content-value {
        font-size: 28px;
        font-weight: 700;
        color: #212121;
    }
`;

const IconWrapper = styled.div<{ $color: string }>`
    width: 44px;
    height: 44px;
    border-radius: 10px;
    background: ${({ $color }) => $color};
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    margin-bottom: 12px;
`;

const SectionCard = styled(Card)`
    border-radius: 10px;
    border: 1px solid #f0f0f0;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);

    .ant-card-head {
        border-bottom: 1px solid #f5f5f5;
        min-height: 48px;

        .ant-card-head-title {
            font-size: 14px;
            font-weight: 600;
            color: #212121;
        }
    }
`;

const STAT_DEFS: Array<{
    title: string;
    types: EntityType[];
    icon: React.ReactNode;
    color: string;
    iconColor: string;
}> = [
    {
        title: 'Tổng Metadata',
        types: ['DATASET', 'DASHBOARD', 'CHART', 'DATA_FLOW', 'DATA_JOB'],
        icon: <DatabaseOutlined />,
        color: '#fff0f3',
        iconColor: '#ee0033',
    },
    {
        title: 'Dashboard',
        types: ['DASHBOARD'],
        icon: <DashboardOutlined />,
        color: '#f0f5ff',
        iconColor: '#1677ff',
    },
    {
        title: 'Datasets',
        types: ['DATASET'],
        icon: <ApiOutlined />,
        color: '#f6ffed',
        iconColor: '#52c41a',
    },
    {
        title: 'Người dùng',
        types: ['CORP_USER'],
        icon: <TeamOutlined />,
        color: '#fff7e6',
        iconColor: '#fa8c16',
    },
];

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

export default function HomePage() {
    const navigate = useNavigate();
    const [statValues, setStatValues] = useState<number[]>(STAT_DEFS.map(() => 0));
    const [platformStats, setPlatformStats] = useState<PlatformStat[]>([]);
    const [recentEntities, setRecentEntities] = useState<MetadataEntity[]>([]);
    const [platformTotal, setPlatformTotal] = useState(0);

    useEffect(() => {
        // Load entity counts
        STAT_DEFS.forEach((def, idx) => {
            getEntityCount(def.types)
                .then((count) => {
                    setStatValues((prev) => {
                        const next = [...prev];
                        next[idx] = count;
                        return next;
                    });
                })
                .catch(() => {/* keep 0 on error */});
        });

        // Load platform aggregations
        getPlatformAggregations()
            .then((stats) => {
                setPlatformStats(stats);
                setPlatformTotal(stats.reduce((s, p) => s + p.count, 0));
            })
            .catch(() => {/* keep empty on error */});

        // Load recently updated entities (top 5)
        searchEntities({ query: '*', types: ['DATASET', 'DASHBOARD', 'CHART'], count: 5 })
            .then((result) => setRecentEntities(result.entities))
            .catch(() => {/* keep empty on error */});
    }, []);

    const stats = STAT_DEFS.map((def, idx) => ({
        ...def,
        value: statValues[idx],
    }));

    const activities = recentEntities.map(entityToActivity);

    return (
        <AppLayout pageTitle="Tổng quan">
            <PageWrapper>
                <WelcomeBanner>
                    <WelcomeTitle level={2}>Chào mừng đến với Viettel MetaHub</WelcomeTitle>
                    <WelcomeSub>
                        Nền tảng quản lý và khám phá metadata tập trung — Hỗ trợ quản trị dữ liệu toàn Tổng Công ty
                    </WelcomeSub>
                    <Space style={{ marginTop: 20 }} size={16}>
                        <Tag
                            color="rgba(255,255,255,0.25)"
                            style={{
                                color: 'white',
                                border: '1px solid rgba(255,255,255,0.4)',
                                borderRadius: 6,
                            }}
                        >
                            <CheckCircleOutlined /> Dữ liệu thời gian thực
                        </Tag>
                        <Tag
                            color="rgba(255,255,255,0.25)"
                            style={{
                                color: 'white',
                                border: '1px solid rgba(255,255,255,0.4)',
                                borderRadius: 6,
                            }}
                        >
                            <SyncOutlined spin /> Đồng bộ hoạt động
                        </Tag>
                    </Space>
                </WelcomeBanner>

                <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                    {stats.map((stat, idx) => (
                        <Col xs={24} sm={12} lg={6} key={idx}>
                            <StatCard
                                onClick={() => idx === 0 && navigate('/search')}
                                hoverable={idx === 0}
                            >
                                <IconWrapper $color={stat.color}>
                                    <span style={{ color: stat.iconColor }}>{stat.icon}</span>
                                </IconWrapper>
                                <Statistic
                                    title={stat.title}
                                    value={stat.value}
                                    prefix={
                                        idx === 0 ? (
                                            <RiseOutlined
                                                style={{ color: '#52c41a', fontSize: 14, marginRight: 4 }}
                                            />
                                        ) : undefined
                                    }
                                />
                            </StatCard>
                        </Col>
                    ))}
                </Row>

                <Row gutter={[16, 16]}>
                    <Col xs={24} lg={14}>
                        <SectionCard
                            title="Phân bổ theo nền tảng"
                            extra={
                                platformTotal > 0 ? (
                                    <Text type="secondary" style={{ fontSize: 12 }}>
                                        Tổng {platformTotal.toLocaleString('vi-VN')} đối tượng
                                    </Text>
                                ) : null
                            }
                        >
                            {platformStats.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '24px 0', color: '#9e9e9e', fontSize: 13 }}>
                                    Chưa có dữ liệu nền tảng
                                </div>
                            ) : (
                                <Space direction="vertical" style={{ width: '100%' }} size={14}>
                                    {platformStats.map((platform) => (
                                        <div key={platform.name}>
                                            <div
                                                style={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    marginBottom: 4,
                                                }}
                                            >
                                                <Text style={{ fontSize: 13, fontWeight: 500 }}>
                                                    {platform.name}
                                                </Text>
                                                <Text type="secondary" style={{ fontSize: 12 }}>
                                                    {platform.count.toLocaleString('vi-VN')} ({platform.percent}%)
                                                </Text>
                                            </div>
                                            <Progress
                                                percent={platform.percent}
                                                strokeColor="#ee0033"
                                                trailColor="#f5f5f5"
                                                showInfo={false}
                                                size="small"
                                            />
                                        </div>
                                    ))}
                                </Space>
                            )}
                        </SectionCard>
                    </Col>

                    <Col xs={24} lg={10}>
                        <SectionCard title="Hoạt động gần đây">
                            {activities.length === 0 ? (
                                <div
                                    style={{
                                        textAlign: 'center',
                                        padding: '24px 0',
                                        color: '#9e9e9e',
                                        fontSize: 13,
                                    }}
                                >
                                    Chưa có hoạt động gần đây
                                </div>
                            ) : (
                                <List
                                    size="small"
                                    dataSource={activities}
                                    renderItem={(item) => (
                                        <List.Item
                                            style={{
                                                padding: '8px 0',
                                                borderBottom: '1px solid #f9f9f9',
                                            }}
                                        >
                                            <List.Item.Meta
                                                avatar={
                                                    <Avatar
                                                        size={28}
                                                        style={{
                                                            background:
                                                                item.type === 'success'
                                                                    ? '#f6ffed'
                                                                    : item.type === 'error'
                                                                      ? '#fff2f0'
                                                                      : '#e6f4ff',
                                                            fontSize: 14,
                                                        }}
                                                    >
                                                        {item.type === 'success' ? (
                                                            <CheckCircleOutlined
                                                                style={{ color: '#52c41a' }}
                                                            />
                                                        ) : item.type === 'error' ? (
                                                            <WarningOutlined
                                                                style={{ color: '#ff4d4f' }}
                                                            />
                                                        ) : (
                                                            <FileTextOutlined
                                                                style={{ color: '#1677ff' }}
                                                            />
                                                        )}
                                                    </Avatar>
                                                }
                                                title={
                                                    <Text style={{ fontSize: 12, fontWeight: 500 }}>
                                                        {item.text}
                                                    </Text>
                                                }
                                                description={
                                                    <Text type="secondary" style={{ fontSize: 11 }}>
                                                        {item.time}
                                                    </Text>
                                                }
                                            />
                                        </List.Item>
                                    )}
                                />
                            )}
                        </SectionCard>
                    </Col>
                </Row>
            </PageWrapper>
        </AppLayout>
    );
}
