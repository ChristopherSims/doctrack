import React, { useMemo, useRef, useState, useCallback } from 'react';
import { ZoomIn, ZoomOut, Maximize, Move } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface GraphNode {
  id: string;
  label: string;
  level: string;
  status: string;
  x: number;
  y: number;
}

interface GraphEdge {
  source: string;
  target: string;
  linkType: string;
}

interface TraceabilityGraphProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  onNodeClick?: (nodeId: string) => void;
  selectedNodeId?: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  draft: '#94a3b8',
  review: '#f59e0b',
  approved: '#22c55e',
  rejected: '#ef4444',
};

const LINK_TYPE_COLORS: Record<string, string> = {
  implements: '#3b82f6',
  verifies: '#22c55e',
  traces_to: '#0ea5e9',
  derives_from: '#f59e0b',
  satisfies: '#a855f7',
};

const TraceabilityGraph: React.FC<TraceabilityGraphProps> = ({
  nodes,
  edges,
  onNodeClick,
  selectedNodeId,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const panStart = useRef({ x: 0, y: 0 });

  const bounds = useMemo(() => {
    if (nodes.length === 0) return { minX: 0, minY: 0, maxX: 800, maxY: 600 };
    const xs = nodes.map((n) => n.x);
    const ys = nodes.map((n) => n.y);
    const padding = 80;
    return {
      minX: Math.min(...xs) - padding,
      minY: Math.min(...ys) - padding,
      maxX: Math.max(...xs) + padding,
      maxY: Math.max(...ys) + padding,
    };
  }, [nodes]);

  const viewBox = `${bounds.minX} ${bounds.minY} ${bounds.maxX - bounds.minX} ${bounds.maxY - bounds.minY}`;

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
    panStart.current = { ...pan };
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = (e.clientX - dragStart.current.x) / zoom;
    const dy = (e.clientY - dragStart.current.y) / zoom;
    setPan({ x: panStart.current.x + dx, y: panStart.current.y + dy });
  }, [isDragging, zoom]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom((z) => Math.min(Math.max(z * delta, 0.2), 4));
  }, []);

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  if (nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        No requirements to display.
      </div>
    );
  }

  return (
    <div className="relative w-full h-[600px] border rounded-lg bg-card overflow-hidden select-none">
      {/* Controls */}
      <div className="absolute top-3 right-3 z-10 flex flex-col gap-1">
        <Button variant="outline" size="icon-sm" onClick={() => setZoom((z) => Math.min(z * 1.2, 4))} title="Zoom in">
          <ZoomIn className="h-3.5 w-3.5" />
        </Button>
        <Button variant="outline" size="icon-sm" onClick={() => setZoom((z) => Math.max(z * 0.8, 0.2))} title="Zoom out">
          <ZoomOut className="h-3.5 w-3.5" />
        </Button>
        <Button variant="outline" size="icon-sm" onClick={resetView} title="Reset view">
          <Maximize className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Legend */}
      <div className="absolute top-3 left-3 z-10 bg-card/90 border rounded-md px-3 py-2 text-xs space-y-1 shadow-sm">
        <p className="font-semibold mb-1">Status</p>
        {Object.entries(STATUS_COLORS).map(([status, color]) => (
          <div key={status} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
            <span className="capitalize">{status}</span>
          </div>
        ))}
        <p className="font-semibold mt-2 mb-1">Link Type</p>
        {Object.entries(LINK_TYPE_COLORS).map(([type, color]) => (
          <div key={type} className="flex items-center gap-1.5">
            <span className="w-4 h-0.5" style={{ backgroundColor: color }} />
            <span className="capitalize">{type.replace(/_/g, ' ')}</span>
          </div>
        ))}
      </div>

      {/* Hint */}
      <div className="absolute bottom-3 left-3 z-10 text-[10px] text-muted-foreground flex items-center gap-1">
        <Move className="h-3 w-3" />
        Drag to pan · Scroll to zoom · Click nodes
      </div>

      <div
        ref={containerRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        <svg
          width="100%"
          height="100%"
          viewBox={viewBox}
          preserveAspectRatio="xMidYMid meet"
        >
          <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
            {/* Edges */}
            {edges.map((edge, i) => {
              const src = nodes.find((n) => n.id === edge.source);
              const tgt = nodes.find((n) => n.id === edge.target);
              if (!src || !tgt) return null;
              const color = LINK_TYPE_COLORS[edge.linkType] || '#94a3b8';
              return (
                <line
                  key={`${edge.source}-${edge.target}-${i}`}
                  x1={src.x}
                  y1={src.y}
                  x2={tgt.x}
                  y2={tgt.y}
                  stroke={color}
                  strokeWidth={1.5}
                  strokeOpacity={0.6}
                  markerEnd="url(#arrowhead)"
                />
              );
            })}

            {/* Arrow marker */}
            <defs>
              <marker
                id="arrowhead"
                markerWidth="8"
                markerHeight="6"
                refX="22"
                refY="3"
                orient="auto"
              >
                <polygon points="0 0, 8 3, 0 6" fill="#94a3b8" opacity="0.7" />
              </marker>
            </defs>

            {/* Nodes */}
            {nodes.map((node) => {
              const color = STATUS_COLORS[node.status] || '#94a3b8';
              const isSelected = selectedNodeId === node.id;
              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x}, ${node.y})`}
                  className="cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    onNodeClick?.(node.id);
                  }}
                >
                  <circle
                    r={isSelected ? 28 : 22}
                    fill={color}
                    stroke={isSelected ? '#000' : '#fff'}
                    strokeWidth={isSelected ? 3 : 2}
                    opacity={0.9}
                  />
                  <text
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="#fff"
                    fontSize={10}
                    fontWeight={600}
                    pointerEvents="none"
                  >
                    {node.level}
                  </text>
                  <text
                    textAnchor="middle"
                    dominantBaseline="middle"
                    y={36}
                    fill="currentColor"
                    fontSize={9}
                    fontWeight={500}
                    className="fill-foreground"
                    pointerEvents="none"
                  >
                    {node.label.length > 18 ? node.label.slice(0, 18) + '...' : node.label}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>
    </div>
  );
};

export default TraceabilityGraph;
