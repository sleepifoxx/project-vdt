import React, { useEffect, useState } from 'react';
import { Spin, Empty, Tag, Typography } from 'antd';
import {
    DatabaseOutlined,
    DashboardOutlined,
    BarChartOutlined,
    NodeIndexOutlined,
    UserOutlined,
    TeamOutlined,
} from '@ant-design/icons';
import styled from 'styled-components';
import type { MetadataEntity, EntityType } from '../../types';
import { fetchEntityLineage } from '../../api/datahubApi';
import type { LineageEntity } from '../../api/datahubApi';

const { Text } = Typography;

// Layout constants
const NODE_W = 170;
const NODE_H = 70;
const V_GAP = 16;
const COL_GAP = 100;
const PADDING = 20;

const TYPE_COLOR: Record<EntityType, string> = {
    DATASET: '#1677ff',
    DASHBOARD: '#722ed1',
    CHART: '#13c2c2',
    DATA_FLOW: '#fa8c16',
    DATA_JOB: '#52c41a',
    CORP_USER: '#eb2f96',
    CORP_GROUP: '#faad14',
};

const TYPE_LABEL: Record<EntityType, string> = {
    DATASET: 'Bộ dữ liệu',
    DASHBOARD: 'Dashboard',
    CHART: 'Biểu đồ',
    DATA_FLOW: 'Luồng dữ liệu',
    DATA_JOB: 'Công việc',
    CORP_USER: 'Người dùng',
    CORP_GROUP: 'Nhóm',
};

const TYPE_ICON: Record<EntityType, React.ReactNode> = {
    DATASET: <DatabaseOutlined />,
    DASHBOARD: <DashboardOutlined />,
    CHART: <BarChartOutlined />,
    DATA_FLOW: <NodeIndexOutlined />,
    DATA_JOB: <NodeIndexOutlined />,
    CORP_USER: <UserOutlined />,
    CORP_GROUP: <TeamOutlined />,
};

const Wrapper = styled.div`
    position: relative;
    overflow: auto;
    background: #fafafa;
    border: 1px solid #f0f0f0;
    border-radius: 10px;
    min-height: 200px;
`;

const EdgeSvg = styled.svg`
    position: absolute;
    top: 0;
    left: 0;
    pointer-events: none;
    overflow: visible;
`;

const NodeBox = styled.div<{ $color: string; $isCurrent?: boolean }>`
    position: absolute;
    width: ${NODE_W}px;
    height: ${NODE_H}px;
    background: #fff;
    border: 2px solid ${(p) => p.$color};
    border-radius: 10px;
    padding: 8px 12px;
    box-shadow: ${(p) =>
        p.$isCurrent
            ? `0 0 0 4px ${p.$color}22, 0 4px 16px rgba(0,0,0,0.12)`
            : '0 2px 8px rgba(0,0,0,0.08)'};
    cursor: default;
    transition: box-shadow 0.2s;
    &:hover {
        box-shadow: ${(p) =>
            p.$isCurrent
                ? `0 0 0 4px ${p.$color}33, 0 6px 20px rgba(0,0,0,0.15)`
                : `0 4px 16px rgba(0,0,0,0.14)`};
    }
`;

const NodeName = styled.div`
    font-size: 12px;
    font-weight: 700;
    color: #212121;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-bottom: 6px;
    max-width: 100%;
`;

const NodeMeta = styled.div`
    display: flex;
    align-items: center;
    gap: 5px;
`;

const IconWrap = styled.span<{ $color: string }>`
    color: ${(p) => p.$color};
    font-size: 12px;
    flex-shrink: 0;
`;

const Legend = styled.div`
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 24px;
    padding: 10px 16px 0;
    font-size: 12px;
    color: #9e9e9e;
`;


type Props = {
    entity: MetadataEntity;
    active: boolean;
};

type LineageData = {
    upstreams: LineageEntity[];
    downstreams: LineageEntity[];
} | null;

function truncate(s: string, max: number): string {
    return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

function calcNodePositions(
    upstreams: LineageEntity[],
    downstreams: LineageEntity[],
): {
    upPos: Array<{ x: number; y: number }>;
    curPos: { x: number; y: number };
    downPos: Array<{ x: number; y: number }>;
    svgW: number;
    svgH: number;
} {
    const upCount = Math.max(upstreams.length, 0);
    const downCount = Math.max(downstreams.length, 0);
    const maxRows = Math.max(upCount, 1, downCount);

    const colCount = (upCount > 0 ? 1 : 0) + 1 + (downCount > 0 ? 1 : 0);
    const svgW = colCount * NODE_W + (colCount - 1) * COL_GAP + PADDING * 2;
    const svgH = maxRows * NODE_H + (maxRows - 1) * V_GAP + PADDING * 2;

    const hasUpstream = upCount > 0;
    const hasDownstream = downCount > 0;

    const upColX = PADDING;
    const curColX = hasUpstream ? PADDING + NODE_W + COL_GAP : PADDING;
    const downColX = curColX + NODE_W + COL_GAP;

    const centerY = (svgH - NODE_H) / 2;

    const upTotal = upCount * NODE_H + (upCount - 1) * V_GAP;
    const upStartY = (svgH - upTotal) / 2;
    const upPos = upstreams.map((_, i) => ({
        x: upColX,
        y: upStartY + i * (NODE_H + V_GAP),
    }));

    const curPos = { x: curColX, y: centerY };

    const downTotal = downCount * NODE_H + (downCount - 1) * V_GAP;
    const downStartY = (svgH - downTotal) / 2;
    const downPos = downstreams.map((_, i) => ({
        x: hasDownstream ? downColX : curColX + NODE_W + COL_GAP,
        y: downStartY + i * (NODE_H + V_GAP),
    }));

    return { upPos, curPos, downPos, svgW, svgH };
}

function bezierPath(x1: number, y1: number, x2: number, y2: number): string {
    const cpx = (x1 + x2) / 2;
    return `M ${x1} ${y1} C ${cpx} ${y1}, ${cpx} ${y2}, ${x2} ${y2}`;
}

export default function LineageTab({ entity, active }: Props) {
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<LineageData>(null);

    useEffect(() => {
        setData(null);
    }, [entity.urn]);

    useEffect(() => {
        if (!active || data !== null) return;
        setLoading(true);
        fetchEntityLineage(entity.urn)
            .then((result) => setData(result))
            .catch(() => setData({ upstreams: [], downstreams: [] }))
            .finally(() => setLoading(false));
    }, [active, entity.urn, data]);

    if (loading || (!data && active)) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 48 }}>
                <Spin tip="Đang tải sơ đồ luồng..." />
            </div>
        );
    }

    if (!data || (data.upstreams.length === 0 && data.downstreams.length === 0)) {
        return (
            <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="Không có thông tin sơ đồ luồng cho đối tượng này"
                style={{ padding: '32px 0' }}
            />
        );
    }

    const { upstreams, downstreams } = data;
    const { upPos, curPos, downPos, svgW, svgH } = calcNodePositions(upstreams, downstreams);

    const curColor = '#EE0033';
    const curCenterY = curPos.y + NODE_H / 2;
    const curLeftX = curPos.x;
    const curRightX = curPos.x + NODE_W;

    return (
        <>
            <Legend>
                <Text type="secondary" style={{ fontSize: 11 }}>
                    ← Luồng vào ({upstreams.length})
                </Text>
                <Tag color="red" style={{ margin: 0, fontSize: 11, fontWeight: 600 }}>
                    {truncate(entity.name, 20)}
                </Tag>
                <Text type="secondary" style={{ fontSize: 11 }}>
                    Luồng ra ({downstreams.length}) →
                </Text>
            </Legend>

            <div style={{ padding: '12px 8px 8px' }}>
                <Wrapper style={{ height: svgH + 16, minWidth: svgW }}>
                    {/* SVG edges layer */}
                    <EdgeSvg width={svgW} height={svgH + 16} style={{ top: 8 }}>
                        <defs>
                            <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                                <polygon points="0 0, 8 3, 0 6" fill="#bdbdbd" />
                            </marker>
                            <marker id="arrowhead-cur" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                                <polygon points="0 0, 8 3, 0 6" fill="#EE0033" opacity="0.5" />
                            </marker>
                        </defs>

                        {/* Upstream edges */}
                        {upPos.map((pos, i) => {
                            const sx = pos.x + NODE_W;
                            const sy = pos.y + NODE_H / 2;
                            return (
                                <path
                                    key={upstreams[i].urn}
                                    d={bezierPath(sx, sy, curLeftX, curCenterY)}
                                    fill="none"
                                    stroke="#bdbdbd"
                                    strokeWidth={1.5}
                                    markerEnd="url(#arrowhead)"
                                />
                            );
                        })}

                        {/* Downstream edges */}
                        {downPos.map((pos, i) => {
                            const tx = pos.x;
                            const ty = pos.y + NODE_H / 2;
                            return (
                                <path
                                    key={downstreams[i].urn}
                                    d={bezierPath(curRightX, curCenterY, tx, ty)}
                                    fill="none"
                                    stroke="#bdbdbd"
                                    strokeWidth={1.5}
                                    markerEnd="url(#arrowhead)"
                                />
                            );
                        })}
                    </EdgeSvg>

                    {/* Upstream nodes */}
                    {upstreams.map((node, i) => {
                        const color = TYPE_COLOR[node.type] ?? '#888';
                        const pos = upPos[i];
                        return (
                            <NodeBox
                                key={node.urn}
                                $color={color}
                                style={{ left: pos.x, top: pos.y + 8 }}
                                title={node.name}
                            >
                                <NodeName>{truncate(node.name, 18)}</NodeName>
                                <NodeMeta>
                                    <IconWrap $color={color}>{TYPE_ICON[node.type]}</IconWrap>
                                    <Tag
                                        style={{
                                            fontSize: 10,
                                            margin: 0,
                                            padding: '0 4px',
                                            lineHeight: '16px',
                                            borderColor: color,
                                            color,
                                            background: `${color}14`,
                                        }}
                                    >
                                        {TYPE_LABEL[node.type]}
                                    </Tag>
                                    {node.platform && (
                                        <Text style={{ fontSize: 10, color: '#9e9e9e' }}>
                                            {truncate(node.platform, 8)}
                                        </Text>
                                    )}
                                </NodeMeta>
                            </NodeBox>
                        );
                    })}

                    {/* Current node */}
                    <NodeBox
                        $color={curColor}
                        $isCurrent
                        style={{ left: curPos.x, top: curPos.y + 8 }}
                        title={entity.name}
                    >
                        <NodeName style={{ color: curColor }}>{truncate(entity.name, 18)}</NodeName>
                        <NodeMeta>
                            <IconWrap $color={curColor}>{TYPE_ICON[entity.type]}</IconWrap>
                            <Tag
                                style={{
                                    fontSize: 10,
                                    margin: 0,
                                    padding: '0 4px',
                                    lineHeight: '16px',
                                    borderColor: curColor,
                                    color: curColor,
                                    background: `${curColor}14`,
                                }}
                            >
                                {TYPE_LABEL[entity.type]}
                            </Tag>
                            {entity.platform && (
                                <Text style={{ fontSize: 10, color: '#9e9e9e' }}>
                                    {truncate(entity.platform, 8)}
                                </Text>
                            )}
                        </NodeMeta>
                    </NodeBox>

                    {/* Downstream nodes */}
                    {downstreams.map((node, i) => {
                        const color = TYPE_COLOR[node.type] ?? '#888';
                        const pos = downPos[i];
                        return (
                            <NodeBox
                                key={node.urn}
                                $color={color}
                                style={{ left: pos.x, top: pos.y + 8 }}
                                title={node.name}
                            >
                                <NodeName>{truncate(node.name, 18)}</NodeName>
                                <NodeMeta>
                                    <IconWrap $color={color}>{TYPE_ICON[node.type]}</IconWrap>
                                    <Tag
                                        style={{
                                            fontSize: 10,
                                            margin: 0,
                                            padding: '0 4px',
                                            lineHeight: '16px',
                                            borderColor: color,
                                            color,
                                            background: `${color}14`,
                                        }}
                                    >
                                        {TYPE_LABEL[node.type]}
                                    </Tag>
                                    {node.platform && (
                                        <Text style={{ fontSize: 10, color: '#9e9e9e' }}>
                                            {truncate(node.platform, 8)}
                                        </Text>
                                    )}
                                </NodeMeta>
                            </NodeBox>
                        );
                    })}
                </Wrapper>
            </div>
        </>
    );
}
