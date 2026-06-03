'use client';

import React, { useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';

// Dynamically import ForceGraph2D with ssr disabled to prevent hydration errors (since it uses canvas/window)
const ForceGraph2D = dynamic(
  () => import('react-force-graph-2d').then((mod) => mod.default),
  { ssr: false }
);

interface GraphNode {
  id: string;
  name: string;
  label: string;
  is_device_farm_suspected: boolean;
  is_cyber_flagged: boolean;
  is_alert_flagged: boolean;
  val: number;
  x?: number;
  y?: number;
}

interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  amount: number;
  count: number;
  is_device_farm_suspected: boolean;
}

interface NetworkGraphProps {
  data: {
    nodes: GraphNode[];
    links: GraphLink[];
  };
  onNodeClick: (node: GraphNode) => void;
  selectedAccountId?: string | null;
}

export default function NetworkGraph({ data, onNodeClick, selectedAccountId }: NetworkGraphProps) {
  const fgRef = useRef<any>(null);

  // Zoom to fit graph contents on data change
  useEffect(() => {
    if (fgRef.current && data.nodes.length > 0) {
      fgRef.current.zoomToFit(400, 50);
    }
  }, [data]);

  const getNodeColor = (node: GraphNode) => {
    const isSelected = selectedAccountId === node.id;
    if (isSelected) return '#EC4899'; // Pink for selected account
    if (node.is_device_farm_suspected) return '#EF4444'; // Bright Red
    if (node.is_cyber_flagged) return '#F59E0B'; // Amber
    if (node.is_alert_flagged) return '#3B82F6'; // Blue
    return '#10B981'; // Teal/Green for normal
  };

  return (
    <div className="w-full h-full bg-slate-950 rounded-xl overflow-hidden border border-slate-800 relative">
      <div className="absolute top-4 left-4 z-10 bg-slate-900/90 backdrop-blur-sm p-4 rounded-lg border border-slate-800 text-xs text-slate-300 space-y-2 pointer-events-none">
        <h4 className="font-semibold text-slate-100 mb-1">Network Legend</h4>
        <div className="flex items-center space-x-2">
          <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block"></span>
          <span>Normal Account</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="w-3 h-3 rounded-full bg-red-500 inline-block"></span>
          <span>Suspected Device Farm</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="w-3 h-3 rounded-full bg-amber-500 inline-block"></span>
          <span>Government Cyber Ticket</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="w-3 h-3 rounded-full bg-blue-500 inline-block"></span>
          <span>Cross-Channel Alert</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="w-3 h-3 rounded-full bg-pink-500 inline-block animate-pulse"></span>
          <span>Selected Account</span>
        </div>
      </div>

      <div className="absolute bottom-4 right-4 z-10 bg-slate-900/80 backdrop-blur-sm px-3 py-1.5 rounded border border-slate-800 text-[10px] text-slate-400 pointer-events-none">
        Drag to pan | Scroll to zoom | Click node to investigate
      </div>

      <div className="w-full h-full min-h-[600px] flex items-center justify-center">
        {data.nodes.length === 0 ? (
          <div className="text-slate-400 text-sm">No transaction network data loaded</div>
        ) : (
          <ForceGraph2D
            ref={fgRef}
            graphData={data}
            nodeLabel="label"
            nodeColor={getNodeColor as any}
            nodeVal={(node: any) => node.val || 2}
            nodeRelSize={4}
            linkWidth={(link: any) => (link.is_device_farm_suspected ? 2.5 : 1.2)}
            linkColor={(link: any) => (link.is_device_farm_suspected ? '#EF4444' : '#475569')}
            linkDirectionalArrowLength={4.5}
            linkDirectionalArrowRelPos={0.95}
            linkDirectionalParticles={(link: any) => (link.is_device_farm_suspected ? 4 : 1)}
            linkDirectionalParticleSpeed={(link: any) => (link.is_device_farm_suspected ? 0.015 : 0.005)}
            linkDirectionalParticleWidth={2}
            onNodeClick={(node: any) => onNodeClick(node as GraphNode)}
            cooldownTicks={100}
            nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
              const label = node.name;
              const fontSize = 12 / globalScale;
              ctx.font = `${fontSize}px sans-serif`;
              
              // Draw node circle outline
              const color = getNodeColor(node);
              const isSelected = selectedAccountId === node.id;
              
              ctx.beginPath();
              ctx.arc(node.x, node.y, (node.val || 2) * 2, 0, 2 * Math.PI, false);
              ctx.fillStyle = color;
              ctx.fill();
              
              if (isSelected) {
                ctx.lineWidth = 2 / globalScale;
                ctx.strokeStyle = '#FFFFFF';
                ctx.stroke();
              }

              // Draw node text label when zoomed in sufficiently
              if (globalScale > 1.2) {
                const textWidth = ctx.measureText(label).width;
                const bckgDimensions = [textWidth, fontSize].map(n => n + fontSize * 0.2); // some padding
                
                ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
                ctx.fillRect(
                  node.x - bckgDimensions[0] / 2,
                  node.y - bckgDimensions[1] / 2 - 12,
                  bckgDimensions[0],
                  bckgDimensions[1]
                );

                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = '#E2E8F0';
                ctx.fillText(label, node.x, node.y - 12);
              }
            }}
          />
        )}
      </div>
    </div>
  );
}
