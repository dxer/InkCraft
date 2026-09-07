"use client";

import {
  GitFork,
  Maximize2,
  Minimize2,
  Minus,
  Plus,
  RotateCcw,
  Sparkles,
  Tag as TagIcon,
  Zap,
} from "lucide-react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatCardDate, type ParsedCardItem } from "./card-utils";
import {
  CardsGraphDrawer,
  type ConnectedNeighbor,
} from "./cards-graph-drawer";

export type EdgeRelationType = "source_derived" | "tag_concept" | "hint_link";

export interface GraphNode {
  id: string;
  type: "card";
  label: string;
  subLabel?: string;
  card: ParsedCardItem;
  color: string;
  radius: number;
  degree: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  isDragging?: boolean;
}

export interface GraphLink {
  source: string;
  target: string;
  type: EdgeRelationType;
  label: string;
  strength: number;
}

interface CardsGraphViewProps {
  cards: ParsedCardItem[];
  onSelectCard: (card: ParsedCardItem) => void;
  onWriteWithCard: (card: ParsedCardItem) => void;
  onSelectTag?: (tag: string) => void;
  selectedTag?: string | null;
  pearlChain?: ParsedCardItem[];
  onTogglePearlChain?: (card: ParsedCardItem) => void;
}

// 现代化明亮宝石调色板（高饱和度、高对比、纯净高级）
const VIBRANT_PALETTE = [
  "#2563eb", // blue
  "#059669", // emerald
  "#d97706", // amber
  "#7c3aed", // purple
  "#db2777", // pink
  "#0891b2", // cyan
  "#ea580c", // orange
  "#0d9488", // teal
];

function getNodeColor(tag: string) {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = (hash << 5) - hash + tag.charCodeAt(i);
    hash |= 0;
  }
  return VIBRANT_PALETTE[Math.abs(hash) % VIBRANT_PALETTE.length];
}

export function CardsGraphView({
  cards,
  onSelectCard,
  onWriteWithCard,
  onSelectTag,
  pearlChain = [],
  onTogglePearlChain,
}: CardsGraphViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 全屏沉浸模式
  const [isFullscreen, setIsFullscreen] = useState(false);

  // 视口平移与缩放 (Transform State)
  const transformRef = useRef({ x: 0, y: 0, scale: 1.0 });
  const [currentScale, setCurrentScale] = useState(1.0);

  // 交互选中的节点（激活聚光灯与右侧抽屉）
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // 悬停状态
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  // 统计指标
  const [stats, setStats] = useState({
    cardsCount: 0,
    tagsCount: 0,
    linksCount: 0,
    islandsCount: 0,
  });

  // 节点与连线引用
  const nodesRef = useRef<GraphNode[]>([]);
  const linksRef = useRef<GraphLink[]>([]);
  const animationFrameRef = useRef<number | null>(null);

  // 力导向仿真温度
  const alphaRef = useRef(1.0);

  // 平滑动画目标 (Fly-to interpolation)
  const flyTargetRef = useRef<{
    startX: number;
    startY: number;
    startScale: number;
    targetX: number;
    targetY: number;
    targetScale: number;
    startTime: number;
    duration: number;
  } | null>(null);

  // 1. 构建拓扑网络与紧凑度数计算
  useEffect(() => {
    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];
    const tagSet = new Set<string>();
    const degreeMap = new Map<string, number>();

    cards.forEach((c) => c.tags.forEach((t) => tagSet.add(t)));

    // 计算两两卡片之间的拓扑关系
    for (let i = 0; i < cards.length; i++) {
      const a = cards[i];
      const aId = `card-${a.id}`;

      for (let j = i + 1; j < cards.length; j++) {
        const b = cards[j];
        const bId = `card-${b.id}`;

        // 1. 同源派生连线
        if (a.documentId === b.documentId) {
          links.push({
            source: aId,
            target: bId,
            type: "source_derived",
            label: "同源派生",
            strength: 0.25,
          });
          degreeMap.set(aId, (degreeMap.get(aId) || 0) + 1);
          degreeMap.set(bId, (degreeMap.get(bId) || 0) + 1);
          continue;
        }

        // 2. 共享标签连线
        const commonTags = a.tags.filter((t) => b.tags.includes(t));
        if (commonTags.length > 0) {
          const label =
            commonTags.length === 1
              ? `#${commonTags[0]} 共有`
              : `#${commonTags[0]} 等${commonTags.length}标签共有`;
          links.push({
            source: aId,
            target: bId,
            type: "tag_concept",
            label,
            strength: Math.min(0.1 * commonTags.length, 0.22),
          });
          degreeMap.set(aId, (degreeMap.get(aId) || 0) + 1);
          degreeMap.set(bId, (degreeMap.get(bId) || 0) + 1);
          continue;
        }

        // 3. 启发联想连线
        const aHasBHint = a.connectionHints.some((h) => b.title.includes(h) || b.tags.some((t) => h.includes(t)));
        const bHasAHint = b.connectionHints.some((h) => a.title.includes(h) || a.tags.some((t) => h.includes(t)));
        if (aHasBHint || bHasAHint) {
          links.push({
            source: aId,
            target: bId,
            type: "hint_link",
            label: "启发联想",
            strength: 0.12,
          });
          degreeMap.set(aId, (degreeMap.get(aId) || 0) + 1);
          degreeMap.set(bId, (degreeMap.get(bId) || 0) + 1);
        }
      }
    }

    // 初始位置：紧凑小巧的中央分布 (半径 35px ~ 65px)
    let islands = 0;
    const count = cards.length;
    const baseRadius = Math.min(30 + count * 5, 65);

    cards.forEach((card, idx) => {
      const nodeId = `card-${card.id}`;
      const deg = degreeMap.get(nodeId) || 0;
      if (deg === 0) islands++;

      const angle = (idx / Math.max(count, 1)) * 2 * Math.PI;
      const primaryTag = card.tags[0] || "通用";
      const color = getNodeColor(primaryTag);
      // 精巧通透的圆点半径 (6px ~ 11px)
      const radius = Math.min(6 + deg * 1.4, 11);

      const node: GraphNode = {
        id: nodeId,
        type: "card",
        label: card.title.length > 15 ? `${card.title.slice(0, 14)}…` : card.title,
        subLabel: card.noteTitle,
        card,
        color,
        radius,
        degree: deg,
        x: Math.cos(angle) * baseRadius,
        y: Math.sin(angle) * baseRadius,
        vx: 0,
        vy: 0,
      };
      nodes.push(node);
    });

    nodesRef.current = nodes;
    linksRef.current = links;
    alphaRef.current = 1.0;

    setStats({
      cardsCount: cards.length,
      tagsCount: tagSet.size,
      linksCount: links.length,
      islandsCount: islands,
    });
  }, [cards]);

  // 获取当前选中的卡片
  const selectedCard = useMemo(() => {
    if (!selectedNodeId) return null;
    const matched = nodesRef.current.find((n) => n.id === selectedNodeId);
    return matched?.card || null;
  }, [selectedNodeId]);

  // 计算当前选中节点的一度关联邻居 (1-Hop)
  const connectedNeighbors = useMemo((): ConnectedNeighbor[] => {
    if (!selectedNodeId) return [];
    const results: ConnectedNeighbor[] = [];
    const nodeMap = new Map(nodesRef.current.map((n) => [n.id, n]));

    linksRef.current.forEach((link) => {
      let otherId: string | null = null;
      if (link.source === selectedNodeId) otherId = link.target;
      else if (link.target === selectedNodeId) otherId = link.source;

      if (otherId) {
        const otherNode = nodeMap.get(otherId);
        if (otherNode && otherNode.card) {
          results.push({
            card: otherNode.card,
            relationType: link.type,
            relationLabel: link.label,
          });
        }
      }
    });

    return results;
  }, [selectedNodeId]);

  // 平滑飞向指定卡片 (Fly to Node)
  const flyToNode = useCallback((targetCard: ParsedCardItem) => {
    const targetNodeId = `card-${targetCard.id}`;
    const targetNode = nodesRef.current.find((n) => n.id === targetNodeId);
    if (!targetNode || !canvasRef.current) {
      setSelectedNodeId(targetNodeId);
      return;
    }

    const width = canvasRef.current.clientWidth;
    const offsetX = width > 768 ? -140 : 0;
    const targetScale = Math.max(transformRef.current.scale, 1.15);

    const targetX = -targetNode.x * targetScale + offsetX;
    const targetY = -targetNode.y * targetScale;

    flyTargetRef.current = {
      startX: transformRef.current.x,
      startY: transformRef.current.y,
      startScale: transformRef.current.scale,
      targetX,
      targetY,
      targetScale,
      startTime: performance.now(),
      duration: 450,
    };

    setSelectedNodeId(targetNodeId);
  }, []);

  // 全屏模式切换
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!isFullscreen) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen().catch(() => {});
      }
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  // Canvas 2D 渲染循环
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let isRunning = true;

    const render = (time: number) => {
      if (!isRunning) return;

      // 1. 处理平滑漫游飞跃过渡
      if (flyTargetRef.current) {
        const { startX, startY, startScale, targetX, targetY, targetScale, startTime, duration } =
          flyTargetRef.current;
        const elapsed = time - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const ease =
          progress < 0.5
            ? 4 * progress * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 3) / 2;

        transformRef.current.x = startX + (targetX - startX) * ease;
        transformRef.current.y = startY + (targetY - startY) * ease;
        transformRef.current.scale = startScale + (targetScale - startScale) * ease;

        if (progress >= 1) {
          flyTargetRef.current = null;
        }
      }

      const dpr = window.devicePixelRatio || 1;
      const width = canvas.clientWidth || 800;
      const height = canvas.clientHeight || 600;

      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);

      // A. 绘制纯净白底
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);

      // B. 绘制轻微的点阵网格
      const { x: tx, y: ty, scale } = transformRef.current;
      const gridSize = 24 * scale;
      const startGridX = ((tx + width / 2) % gridSize + gridSize) % gridSize;
      const startGridY = ((ty + height / 2) % gridSize + gridSize) % gridSize;

      ctx.fillStyle = "rgba(148, 163, 184, 0.18)";
      for (let gx = startGridX; gx < width; gx += gridSize) {
        for (let gy = startGridY; gy < height; gy += gridSize) {
          ctx.beginPath();
          ctx.arc(gx, gy, 0.85, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 视口变换
      ctx.translate(tx + width / 2, ty + height / 2);
      ctx.scale(scale, scale);

      const nodes = nodesRef.current;
      const links = linksRef.current;
      const nodeMap = new Map(nodes.map((n) => [n.id, n]));

      // 2. 物理力导向计算 (带软核的无奇点防爆炸算法)
      const alpha = alphaRef.current;
      if (alpha > 0.003 && nodes.length > 1) {
        // A. 库仑斥力
        for (let i = 0; i < nodes.length; i++) {
          const n1 = nodes[i];
          for (let j = i + 1; j < nodes.length; j++) {
            const n2 = nodes[j];
            const dx = n2.x - n1.x;
            const dy = n2.y - n1.y;
            const distSq = dx * dx + dy * dy;
            const softDistSq = distSq + 600;
            const force = (1800 / softDistSq) * alpha;
            const dist = Math.sqrt(distSq) || 1;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;

            if (!n1.isDragging) {
              n1.vx -= fx;
              n1.vy -= fy;
            }
            if (!n2.isDragging) {
              n2.vx += fx;
              n2.vy += fy;
            }
          }
        }

        // B. 紧凑弹簧引力
        for (const link of links) {
          const n1 = nodeMap.get(link.source);
          const n2 = nodeMap.get(link.target);
          if (!n1 || !n2) continue;

          const dx = n2.x - n1.x;
          const dy = n2.y - n1.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const targetDist = link.type === "source_derived" ? 38 : 52;
          const delta = dist - targetDist;
          const force = Math.max(Math.min(delta * 0.04 * link.strength, 3.5), -3.5) * alpha;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;

          if (!n1.isDragging) {
            n1.vx += fx;
            n1.vy += fy;
          }
          if (!n2.isDragging) {
            n2.vx += fx;
            n2.vy += fy;
          }
        }

        // C. 轻柔向心引力与边界硬约束
        for (const n of nodes) {
          if (!n.isDragging) {
            n.vx += (0 - n.x) * 0.002 * alpha;
            n.vy += (0 - n.y) * 0.002 * alpha;
            n.vx *= 0.82;
            n.vy *= 0.82;
            n.x += n.vx;
            n.y += n.vy;

            n.x = Math.max(Math.min(n.x, 260), -260);
            n.y = Math.max(Math.min(n.y, 200), -200);
          }
        }

        // D. 强制质心居中归零
        let sumX = 0;
        let sumY = 0;
        let nonDragCount = 0;
        for (const n of nodes) {
          if (!n.isDragging) {
            sumX += n.x;
            sumY += n.y;
            nonDragCount++;
          }
        }
        if (nonDragCount > 0) {
          const avgX = sumX / nonDragCount;
          const avgY = sumY / nonDragCount;
          for (const n of nodes) {
            if (!n.isDragging) {
              n.x -= avgX;
              n.y -= avgY;
            }
          }
        }

        alphaRef.current *= 0.96;
      }

      // 3. 确定聚光灯模式 (Spotlight)
      const activeSpotlightId = selectedNodeId || hoveredNode?.id;
      const spotlightNeighbors = new Set<string>();

      if (activeSpotlightId) {
        spotlightNeighbors.add(activeSpotlightId);
        links.forEach((l) => {
          if (l.source === activeSpotlightId) spotlightNeighbors.add(l.target);
          if (l.target === activeSpotlightId) spotlightNeighbors.add(l.source);
        });
      }

      // 4. 绘制连线 (清晰柔和的石板灰与品牌蓝连线)
      for (const link of links) {
        const n1 = nodeMap.get(link.source);
        const n2 = nodeMap.get(link.target);
        if (!n1 || !n2) continue;

        const isHighlighted =
          activeSpotlightId &&
          (link.source === activeSpotlightId || link.target === activeSpotlightId);
        const isDimmed = activeSpotlightId && !isHighlighted;

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(n1.x, n1.y);
        ctx.lineTo(n2.x, n2.y);

        if (link.type === "source_derived") {
          ctx.setLineDash([]);
        } else if (link.type === "tag_concept") {
          ctx.setLineDash([3, 3]);
        } else {
          ctx.setLineDash([1.5, 2.5]);
        }

        if (isHighlighted) {
          ctx.strokeStyle = "#2563eb";
          ctx.lineWidth = 2.0;
          ctx.globalAlpha = 1.0;
        } else if (isDimmed) {
          ctx.strokeStyle = "rgba(203, 213, 225, 0.4)";
          ctx.lineWidth = 0.8;
          ctx.globalAlpha = 0.15;
        } else {
          ctx.strokeStyle =
            link.type === "source_derived"
              ? "rgba(37, 99, 235, 0.5)"
              : "rgba(148, 163, 184, 0.5)";
          ctx.lineWidth = link.type === "source_derived" ? 1.2 : 0.9;
          ctx.globalAlpha = 0.8;
        }
        ctx.stroke();

        // 连线悬停药丸
        if (isHighlighted && scale >= 0.75) {
          const midX = (n1.x + n2.x) / 2;
          const midY = (n1.y + n2.y) / 2;
          ctx.setLineDash([]);
          ctx.font = "bold 9px sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";

          const textWidth = ctx.measureText(link.label).width;
          ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
          ctx.beginPath();
          ctx.roundRect(midX - textWidth / 2 - 5, midY - 7, textWidth + 10, 14, 4);
          ctx.fill();

          ctx.fillStyle = "#ffffff";
          ctx.fillText(link.label, midX, midY);
        }

        ctx.restore();
      }

      // 5. 绘制卡片星体节点 (精致宝石圆点 + 无框防遮挡光晕浮动文字)
      for (const node of nodes) {
        const isSelected = selectedNodeId === node.id;
        const isHovered = hoveredNode?.id === node.id;
        const isSpotlight = isSelected || isHovered;
        const isConnected = spotlightNeighbors.has(node.id);
        const isDimmed = activeSpotlightId && !isConnected;

        ctx.save();
        ctx.globalAlpha = isDimmed ? 0.12 : 1.0;

        // A. 柔和半透明彩色发光光晕
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius + (isSpotlight ? 6 : 3.5), 0, Math.PI * 2);
        ctx.fillStyle = node.color;
        ctx.globalAlpha = isSpotlight ? 0.32 : 0.14;
        ctx.fill();
        ctx.globalAlpha = isDimmed ? 0.12 : 1.0;

        // B. 主星体实体圆
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fillStyle = node.color;
        ctx.fill();

        // C. 外环反光边框
        ctx.strokeStyle = isSpotlight ? "#ffffff" : "rgba(255, 255, 255, 0.9)";
        ctx.lineWidth = isSpotlight ? 2.2 : 1.2;
        ctx.stroke();

        // D. 珍珠链金色虚线外环
        const isInPearl = pearlChain.some((p) => p.id === node.card.id);
        if (isInPearl) {
          ctx.beginPath();
          ctx.arc(node.x, node.y, node.radius + 4.5, 0, Math.PI * 2);
          ctx.strokeStyle = "#d97706";
          ctx.lineWidth = 2.0;
          ctx.setLineDash([2.5, 2.5]);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // E. 核心超亮微小白点
        ctx.beginPath();
        ctx.arc(node.x, node.y, Math.max(1.8, node.radius * 0.28), 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff";
        ctx.fill();

        // F. 无方块底板的纯净悬浮文字（带双层白色光晕描边，杜绝遮挡且绝对清晰）
        const shouldShowLabel =
          isSpotlight ||
          isConnected ||
          scale >= 1.0 ||
          (scale >= 0.75 && node.degree >= 1) ||
          (scale < 0.75 && node.degree >= 3);

        if (shouldShowLabel) {
          ctx.font = isSpotlight
            ? "bold 10.5px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
            : "10px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";

          // 依据节点在空间上的垂直方位自动调整文字位置，避免总是压住下部连线
          const labelY = node.y < -35 ? node.y - node.radius - 8 : node.y + node.radius + 10;

          // 1. 先绘制 3px 白色微描边光晕（文字光晕层，避免连线穿过时看不清）
          ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
          ctx.lineWidth = 3.5;
          ctx.lineJoin = "round";
          ctx.strokeText(node.label, node.x, labelY);

          // 2. 再填充清晰文字（高亮时品牌蓝，常态下高级深石板灰）
          ctx.fillStyle = isSpotlight ? "#1d4ed8" : "#334155";
          ctx.fillText(node.label, node.x, labelY);
        }

        ctx.restore();
      }

      ctx.restore();
      animationFrameRef.current = requestAnimationFrame(render);
    };

    animationFrameRef.current = requestAnimationFrame(render);

    return () => {
      isRunning = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [selectedNodeId, hoveredNode, pearlChain]);

  // 坐标反算
  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0, rawX: 0, rawY: 0 };
    const rect = canvas.getBoundingClientRect();
    const rawX = e.clientX - rect.left;
    const rawY = e.clientY - rect.top;

    const width = canvas.clientWidth || 800;
    const height = canvas.clientHeight || 600;
    const { x: tx, y: ty, scale } = transformRef.current;

    const x = (rawX - (tx + width / 2)) / scale;
    const y = (rawY - (ty + height / 2)) / scale;

    return { x, y, rawX, rawY };
  };

  // 鼠标拖拽平移与节点拖动
  const dragRef = useRef<{
    node: GraphNode | null;
    isPanning: boolean;
    startX: number;
    startY: number;
    startTx: number;
    startTy: number;
  }>({
    node: null,
    isPanning: false,
    startX: 0,
    startY: 0,
    startTx: 0,
    startTy: 0,
  });

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y, rawX, rawY } = getCanvasCoords(e);
    const nodes = nodesRef.current;

    let hitNode: GraphNode | null = null;
    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i];
      const dist = Math.hypot(n.x - x, n.y - y);
      if (dist <= n.radius + 6) {
        hitNode = n;
        break;
      }
    }

    if (hitNode) {
      hitNode.isDragging = true;
      dragRef.current = {
        node: hitNode,
        isPanning: false,
        startX: rawX,
        startY: rawY,
        startTx: transformRef.current.x,
        startTy: transformRef.current.y,
      };
      alphaRef.current = 0.3;
    } else {
      dragRef.current = {
        node: null,
        isPanning: true,
        startX: rawX,
        startY: rawY,
        startTx: transformRef.current.x,
        startTy: transformRef.current.y,
      };
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y, rawX, rawY } = getCanvasCoords(e);
    const { node, isPanning, startX, startY, startTx, startTy } = dragRef.current;

    if (node) {
      node.x = x;
      node.y = y;
      node.vx = 0;
      node.vy = 0;
    } else if (isPanning) {
      transformRef.current.x = startTx + (rawX - startX);
      transformRef.current.y = startTy + (rawY - startY);
    } else {
      let hit: GraphNode | null = null;
      for (let i = nodesRef.current.length - 1; i >= 0; i--) {
        const n = nodesRef.current[i];
        const dist = Math.hypot(n.x - x, n.y - y);
        if (dist <= n.radius + 6) {
          hit = n;
          break;
        }
      }

      setHoveredNode(hit);
      if (hit) {
        setTooltipPos({ x: rawX, y: rawY });
      } else {
        setTooltipPos(null);
      }
    }
  };

  const handleMouseUp = () => {
    if (dragRef.current.node) {
      dragRef.current.node.isDragging = false;
    }
    dragRef.current = {
      node: null,
      isPanning: false,
      startX: 0,
      startY: 0,
      startTx: 0,
      startTy: 0,
    };
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getCanvasCoords(e);
    const isShift = e.shiftKey;

    let hitNode: GraphNode | null = null;
    for (let i = nodesRef.current.length - 1; i >= 0; i--) {
      const n = nodesRef.current[i];
      const dist = Math.hypot(n.x - x, n.y - y);
      if (dist <= n.radius + 6) {
        hitNode = n;
        break;
      }
    }

    if (hitNode) {
      if (isShift && onTogglePearlChain) {
        onTogglePearlChain(hitNode.card);
      } else {
        setSelectedNodeId(hitNode.id);
      }
    } else {
      setSelectedNodeId(null);
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.12 : 0.88;
    const newScale = Math.min(Math.max(transformRef.current.scale * zoomFactor, 0.4), 2.8);
    transformRef.current.scale = newScale;
    setCurrentScale(newScale);
  };

  const handleZoom = (delta: number) => {
    const newScale = Math.min(Math.max(transformRef.current.scale + delta, 0.4), 2.8);
    transformRef.current.scale = newScale;
    setCurrentScale(newScale);
  };

  const handleReset = () => {
    transformRef.current = { x: 0, y: 0, scale: 1.0 };
    setCurrentScale(1.0);
    setSelectedNodeId(null);
    alphaRef.current = 0.5;
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative flex w-full select-none overflow-hidden rounded-2xl border border-border/80 bg-card shadow-xs transition-all duration-300",
        isFullscreen ? "fixed inset-0 z-50 h-screen rounded-none border-none" : "h-[680px]"
      )}
    >
      {/* 左侧画布区 */}
      <div className="relative flex-1 h-full overflow-hidden">
        <canvas
          ref={canvasRef}
          className="h-full w-full cursor-grab active:cursor-grabbing"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onClick={handleClick}
          onWheel={handleWheel}
        />

        {/* 左上角 HUD 统计 */}
        <div className="absolute top-4 left-4 flex flex-wrap items-center gap-2 rounded-xl border border-border/70 bg-background/90 px-3 py-2 text-xs text-foreground shadow-sm backdrop-blur-md">
          <div className="flex items-center gap-1.5 font-medium text-primary">
            <GitFork className="size-3.5" />
            <span>拓扑网络</span>
          </div>
          <div className="h-3 w-px bg-border" />
          <span className="text-muted-foreground">
            卡片 <strong className="text-foreground">{stats.cardsCount}</strong>
          </span>
          <span className="text-muted-foreground">
            连接 <strong className="text-foreground">{stats.linksCount}</strong>
          </span>
          {stats.islandsCount > 0 && (
            <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
              孤岛 {stats.islandsCount}
            </span>
          )}
        </div>

        {/* 右上角快捷控制 HUD 岛 */}
        <div className="absolute top-4 right-4 flex items-center gap-1 rounded-xl border border-border/70 bg-background/90 p-1 shadow-sm backdrop-blur-md">
          <Button
            variant="ghost"
            size="sm"
            title="放大"
            onClick={() => handleZoom(0.2)}
            className="size-7 p-0 rounded-lg cursor-pointer"
          >
            <Plus className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            title="缩小"
            onClick={() => handleZoom(-0.2)}
            className="size-7 p-0 rounded-lg cursor-pointer"
          >
            <Minus className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            title="重置中心"
            onClick={handleReset}
            className="size-7 p-0 rounded-lg cursor-pointer"
          >
            <RotateCcw className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            title={isFullscreen ? "退出全屏" : "全屏沉浸"}
            onClick={toggleFullscreen}
            className="size-7 p-0 rounded-lg cursor-pointer"
          >
            {isFullscreen ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
          </Button>
        </div>

        {/* 悬停轻量 Preview Popover */}
        {hoveredNode && hoveredNode.card && tooltipPos && !selectedNodeId && (
          <div
            style={{
              left: `${Math.min(tooltipPos.x + 16, (containerRef.current?.clientWidth || 800) - 280)}px`,
              top: `${Math.min(tooltipPos.y + 16, (containerRef.current?.clientHeight || 600) - 180)}px`,
            }}
            className="pointer-events-none absolute z-30 w-64 rounded-xl border border-border/80 bg-background/95 p-3.5 shadow-xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
              <span className="truncate max-w-[150px] font-medium text-foreground/80">
                《{hoveredNode.card.noteTitle}》
              </span>
              <span>{formatCardDate(hoveredNode.card.updatedAt)}</span>
            </div>

            <h4 className="text-xs font-semibold leading-snug text-foreground line-clamp-2">
              {hoveredNode.card.title}
            </h4>

            {hoveredNode.card.hook && (
              <div className="mt-2 rounded-lg bg-amber-500/10 border border-amber-500/20 p-1.5 text-[11px] text-amber-900 dark:text-amber-200">
                <span className="font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <Zap className="size-2.5" /> Hook
                </span>
                <p className="line-clamp-2 mt-0.5">{hoveredNode.card.hook}</p>
              </div>
            )}

            <p className="mt-2 text-[10px] font-medium text-primary flex items-center gap-1">
              <Sparkles className="size-2.5" /> 单击展开抽屉 · Shift+点击串珍珠
            </p>
          </div>
        )}

        {/* 底部交互指引 */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-border/40 bg-background/80 px-3.5 py-1 text-[11px] text-muted-foreground backdrop-blur-md">
          💡 滚轮缩放 · 拖拽漫游 · 单击节点展开右侧抽屉精读
        </div>
      </div>

      {/* 右侧卡片精读抽屉 (Clean Light Glass Drawer) */}
      {selectedCard && (
        <div className="w-[380px] lg:w-[420px] h-full shrink-0 animate-in slide-in-from-right duration-250">
          <CardsGraphDrawer
            card={selectedCard}
            neighbors={connectedNeighbors}
            onClose={() => setSelectedNodeId(null)}
            onNavigateToCard={flyToNode}
            onWriteWithCard={onWriteWithCard}
            isInPearlChain={pearlChain.some((p) => p.id === selectedCard.id)}
            onTogglePearlChain={onTogglePearlChain}
          />
        </div>
      )}
    </div>
  );
}
