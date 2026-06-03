'use client';

import React, { useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';

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

  useEffect(() => {
    if (fgRef.current && data.nodes.length > 0) {
      fgRef.current.zoomToFit(400, 50);
    }
  }, [data]);

  const getNodeColor = (node: GraphNode) => {
    const isSelected = selectedAccountId === node.id;
    if (isSelected) return '#FFFFFF'; // White for selected account
    if (node.is_device_farm_suspected || node.is_cyber_flagged || node.is_alert_flagged) {
      return '#FF3333'; // Harsh Red strictly for anomalies/threat alerts
    }
    return '#737373'; // Neutral grey for standard data nodes
  };

  return (
    <div className="w-full h-full bg-card rounded-none overflow-hidden border border-border relative">
      
      {/* Legend */}
      <div className="absolute top-4 left-4 z-10 bg-background/95 p-4 rounded-none border border-border text-xs text-foreground space-y-2 pointer-events-none font-mono">
        <h4 className="font-bold text-white mb-1 uppercase tracking-wide text-[9px] text-neutral-400">Network Legend</h4>
        <div className="flex items-center space-x-2">
          <span className="w-2.5 h-2.5 bg-neutral-500 inline-block"></span>
          <span className="text-neutral-300">Normal Account</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="w-2.5 h-2.5 bg-destructive inline-block"></span>
          <span className="text-neutral-300">Anomaly Flagged (Threat)</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="w-2.5 h-2.5 bg-white inline-block border border-neutral-600"></span>
          <span className="text-neutral-300">Selected Account</span>
        </div>
      </div>

      <div className="absolute bottom-4 right-4 z-10 bg-background/95 px-3 py-1.5 rounded-none border border-border text-[9px] text-neutral-400 pointer-events-none font-mono">
        DRAG TO PAN | SCROLL TO ZOOM | CLICK NODE TO PROFILE
      </div>

      <div className="w-full h-full min-h-[600px] flex items-center justify-center">
        {data.nodes.length === 0 ? (
          <div className="text-neutral-500 text-sm font-mono uppercase">No transaction network data loaded</div>
        ) : (
          <ForceGraph2D
            ref={fgRef}
            graphData={data}
            nodeLabel="label"
            nodeColor={getNodeColor as any}
            nodeVal={(node: any) => node.val || 2}
            nodeRelSize={4}
            linkWidth={(link: any) => (link.is_device_farm_suspected ? 2.5 : 1.2)}
            linkColor={(link: any) => (link.is_device_farm_suspected ? '#FF3333' : '#262626')}
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
              ctx.font = `${fontSize}px monospace`;
              
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

              if (globalScale > 1.2) {
                const textWidth = ctx.measureText(label).width;
                const bckgDimensions = [textWidth, fontSize].map(n => n + fontSize * 0.2);
                
                ctx.fillStyle = 'rgba(11, 14, 20, 0.9)';
                ctx.fillRect(
                  node.x - bckgDimensions[0] / 2,
                  node.y - bckgDimensions[1] / 2 - 12,
                  bckgDimensions[0],
                  bckgDimensions[1]
                );

                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = '#FFFFFF';
                ctx.fillText(label, node.x, node.y - 12);
              }
            }}
          />
        )}
      </div>
    </div>
  );
}
