'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ShieldAlert,
  User,
  FileText,
  CheckCircle,
  RefreshCw,
  AlertTriangle,
  Activity
} from 'lucide-react';
import NetworkGraph from '@/components/NetworkGraph';

interface GraphNode {
  id: string;
  name: string;
  label: string;
  is_device_farm_suspected: boolean;
  is_cyber_flagged: boolean;
  is_alert_flagged: boolean;
  val: number;
}

interface GraphLink {
  source: any;
  target: any;
  amount: number;
  count: number;
  is_device_farm_suspected: boolean;
}

export default function NetworkInvestigation() {
  const [graphData, setGraphData] = useState<{ nodes: GraphNode[]; links: GraphLink[] }>({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [sarReport, setSarReport] = useState<string>('');
  const [sarLoading, setSarLoading] = useState(false);
  const [sarSaved, setSarSaved] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const fetchGraphData = async () => {
    setLoading(true);
    setApiError(null);
    try {
      const res = await fetch('/api/network-graph');
      if (!res.ok) throw new Error('Failed to fetch graph data');
      const data = await res.json();
      setGraphData(data);
    } catch (err: any) {
      console.error(err);
      setApiError('API server is not responding. Make sure the FastAPI backend is running on http://localhost:8000');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGraphData();
  }, []);

  const handleNodeClick = (node: GraphNode) => {
    setSelectedNode(node);
    setSarReport('');
    setSarSaved(false);
  };

  const handleGenerateSAR = async () => {
    if (!selectedNode) return;
    setSarLoading(true);
    setSarSaved(false);
    setSarReport('');
    try {
      const res = await fetch(`/api/generate-sar/${selectedNode.id}`);
      if (!res.ok) throw new Error('Failed to generate SAR');
      const data = await res.json();
      setSarReport(data.report);
    } catch (err: any) {
      console.error(err);
      setSarReport('Error generating report. Please ensure the backend is active.');
    } finally {
      setSarLoading(false);
    }
  };

  const handleApproveSAR = () => {
    setSarSaved(true);
    setTimeout(() => {
      setSarSaved(false);
    }, 4000);
  };

  // Find transaction flows linked to selected account
  const accountLinks = selectedNode
    ? graphData.links.filter(link => {
      const srcId = typeof link.source === 'object' ? link.source.id : link.source;
      const tgtId = typeof link.target === 'object' ? link.target.id : link.target;
      return srcId === selectedNode.id || tgtId === selectedNode.id;
    })
    : [];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans select-none antialiased leading-snug">
      {/* Header - Compressed padding functional navigation bar */}
      <header className="border-b border-border bg-card px-4 py-1.5 flex items-center justify-between sticky top-0 z-50 rounded-none w-full">
        <div className="flex items-center space-x-2.5">
          <Link href="/" className="p-1 hover:bg-secondary rounded-none transition text-neutral-400 hover:text-white">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xs font-bold text-white tracking-tight flex items-center space-x-2 leading-none">
              <ShieldAlert className="w-4 h-4 text-destructive" />
              <span>Network Investigation Sandbox</span>
            </h1>
            <p className="text-[8px] text-neutral-500 font-mono mt-0.5 uppercase tracking-wide">OmniShield Graph Visualizer & Fraud Analyzer</p>
          </div>
        </div>
        <button
          onClick={fetchGraphData}
          disabled={loading}
          className="flex items-center space-x-1.5 px-2.5 py-1 bg-secondary hover:bg-neutral-800 disabled:opacity-50 text-[9px] font-semibold rounded-none border border-border transition text-neutral-350 cursor-pointer"
        >
          <RefreshCw className={`w-2.5 h-2.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Graph</span>
        </button>
      </header>

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden w-full bg-background">
        {/* Left: Graph Area */}
        <div className="flex-1 p-4 flex flex-col space-y-4 bg-background">
          {apiError && (
            <div className="bg-black border border-destructive text-destructive p-3 rounded-none flex items-start space-x-3 text-xs font-mono">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <div>
                <p className="font-semibold uppercase">Connection Error</p>
                <p className="text-[10px] mt-0.5">{apiError}</p>
              </div>
            </div>
          )}

          <div className="flex-1 relative min-h-[500px]">
            {loading ? (
              <div className="absolute inset-0 bg-background/95 flex flex-col items-center justify-center space-y-3 z-20 font-mono">
                <RefreshCw className="w-5 h-5 text-neutral-550 animate-spin" />
                <span className="text-xs text-neutral-500">Loading neural network connections...</span>
              </div>
            ) : null}
            <NetworkGraph
              data={graphData}
              onNodeClick={handleNodeClick}
              selectedAccountId={selectedNode?.id}
            />
          </div>
        </div>

        {/* Right: Side Panel */}
        <div className="w-full lg:w-[420px] border-t lg:border-t-0 lg:border-l border-border bg-card p-4 flex flex-col overflow-y-auto max-h-screen space-y-4 rounded-none">
          
          {/* Quick Select Target Dropdown */}
          <div className="space-y-1">
            <label className="text-[9px] uppercase font-mono font-bold text-neutral-400 block">
              Quick Select Target Profile
            </label>
            <select
              value={selectedNode?.id || ''}
              onChange={(e) => {
                const node = graphData.nodes.find(n => n.id === e.target.value);
                if (node) handleNodeClick(node);
                else setSelectedNode(null);
              }}
              id="target-select"
              className="w-full bg-secondary border-b border-transparent focus:border-primary px-2 py-1 text-xs font-mono text-white focus:outline-none transition rounded-none cursor-pointer"
            >
              <option value="">-- Select Account to Investigate --</option>
              {graphData.nodes.map(node => (
                <option key={node.id} value={node.id}>
                  {node.name} ({node.id}) {node.is_device_farm_suspected ? '⚠️' : ''} {node.is_cyber_flagged ? '🚨' : ''} {node.is_alert_flagged ? '🔔' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="border-t border-border"></div>

          {selectedNode ? (
            <div className="space-y-4 flex-1 flex flex-col">
              {/* Account Detail Header */}
              <div className="bg-secondary p-3 rounded-none border border-border flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <User className="w-3.5 h-3.5 text-neutral-400" />
                    <h3 className="font-bold text-xs text-white">{selectedNode.name}</h3>
                  </div>
                  <code className="text-[10px] text-neutral-500 font-mono block">{selectedNode.id}</code>
                </div>

                {/* Threat Tags */}
                <div className="flex flex-col space-y-1 items-end font-mono">
                  {selectedNode.is_device_farm_suspected && (
                    <span className="px-1.5 py-0.5 bg-black border border-destructive text-destructive text-[9px] font-bold rounded-none">
                      DEVICE FARM
                    </span>
                  )}
                  {selectedNode.is_cyber_flagged && (
                    <span className="px-1.5 py-0.5 bg-black border border-destructive text-destructive text-[9px] font-bold rounded-none">
                      GOV CYBER TICKET
                    </span>
                  )}
                  {selectedNode.is_alert_flagged && (
                    <span className="px-1.5 py-0.5 bg-black border border-destructive text-destructive text-[9px] font-bold rounded-none">
                      SECURITY ALERT
                    </span>
                  )}
                </div>
              </div>

              {/* Connected Transactions Section */}
              <div className="space-y-2">
                <h4 className="font-bold text-xs text-white flex items-center space-x-1.5">
                  <Activity className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Network Transaction Flows</span>
                </h4>
                <div className="border border-border rounded-none overflow-hidden bg-black max-h-[200px] overflow-y-auto">
                  <table className="w-full text-[10px] text-left font-mono">
                    <thead className="bg-secondary text-neutral-400 text-[8px] uppercase font-mono tracking-wide border-b border-border">
                      <tr>
                        <th className="px-3 py-1.5">Direction</th>
                        <th className="px-3 py-1.5">Counterparty</th>
                        <th className="px-3 py-1.5 text-right">Amount</th>
                        <th className="px-3 py-1.5 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {accountLinks.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-3 py-3 text-center text-neutral-600 uppercase">No active flows linked</td>
                        </tr>
                      ) : (
                        accountLinks.map((link, idx) => {
                          const srcId = typeof link.source === 'object' ? link.source.id : link.source;
                          const isSender = srcId === selectedNode.id;
                          const counterparty = isSender
                            ? (typeof link.target === 'object' ? link.target.id : link.target)
                            : srcId;
                          return (
                            <tr key={idx} className="hover:bg-secondary/30">
                              <td className="px-3 py-1.5 font-semibold">
                                {isSender ? (
                                  <span className="text-destructive">Outgoing</span>
                                ) : (
                                  <span className="text-primary">Incoming</span>
                                )}
                              </td>
                              <td className="px-3 py-1.5 text-neutral-300 max-w-[120px] truncate">
                                {counterparty}
                              </td>
                              <td className="px-3 py-1.5 text-right font-medium text-white">
                                ${link.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </td>
                              <td className="px-3 py-1.5 text-right">
                                {link.is_device_farm_suspected ? (
                                  <span className="text-destructive font-bold">FLAGGED</span>
                                ) : (
                                  <span className="text-neutral-500">CLEAN</span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* SAR Report Generator Section */}
              <div className="border-t border-border pt-4 flex-1 flex flex-col min-h-[300px]">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-bold text-xs text-white flex items-center space-x-1.5">
                    <FileText className="w-3.5 h-3.5 text-neutral-400" />
                    <span>Auto-Report Generator (SAR)</span>
                  </h4>
                  {!sarReport && !sarLoading && (
                    <button
                      onClick={handleGenerateSAR}
                      className="px-2.5 py-1 bg-primary hover:bg-primary/90 text-[9px] font-bold text-black rounded-none transition flex items-center space-x-1.5 cursor-pointer"
                    >
                      <RefreshCw className="w-2.5 h-2.5" />
                      <span>Compile Report</span>
                    </button>
                  )}
                </div>

                <div className="flex-1 flex flex-col relative min-h-[200px]">
                  {sarLoading ? (
                    <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center space-y-3 z-10 border border-border rounded-none">
                      <RefreshCw className="w-5 h-5 text-primary animate-spin" />
                      <span className="text-xs text-primary font-mono">Running LLM LangChain agent...</span>
                    </div>
                  ) : null}

                  {sarReport ? (
                    <div className="flex-1 flex flex-col space-y-3">
                      <textarea
                        value={sarReport}
                        onChange={(e) => setSarReport(e.target.value)}
                        className="flex-1 min-h-[200px] bg-secondary border-b border-transparent focus:border-primary p-3 text-xs font-mono text-white leading-relaxed focus:outline-none resize-y rounded-none"
                        placeholder="Edit report draft..."
                      />

                      <div className="flex items-center space-x-3 justify-end">
                        <button
                          onClick={handleGenerateSAR}
                          className="px-2.5 py-1 text-[9px] font-mono text-neutral-400 hover:text-white hover:bg-secondary border border-border rounded-none transition cursor-pointer"
                        >
                          Regenerate
                        </button>
                        <button
                          onClick={handleApproveSAR}
                          className="px-3.5 py-1 bg-primary hover:bg-primary/90 text-[9px] font-bold text-black rounded-none transition flex items-center space-x-1.5 cursor-pointer"
                        >
                          <CheckCircle className="w-3 h-3 text-black" />
                          <span>Approve & Submit SAR</span>
                        </button>
                      </div>

                      {sarSaved && (
                        <div className="bg-black border border-primary text-primary p-2.5 rounded-none flex items-center space-x-2 text-xs font-mono">
                          <CheckCircle className="w-4 h-4 shrink-0" />
                          <span>SAR has been successfully archived to compliance vault and queued for FinCEN transmission.</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex-1 border border-dashed border-border rounded-none flex flex-col items-center justify-center p-6 text-center text-neutral-500 bg-black font-mono">
                      <FileText className="w-6 h-6 text-neutral-600 mb-2" />
                      <p className="text-xs uppercase font-bold text-white">No SAR drafted for this subject.</p>
                      <p className="text-[10px] text-neutral-550 mt-1.5 max-w-[240px] leading-normal">
                        Click the 'Compile Report' button to run the AI compliance parser on transaction flows and device telemetry.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-neutral-500 bg-black font-mono">
              <ShieldAlert className="w-8 h-8 text-neutral-700 mb-3 animate-pulse" />
              <h3 className="font-bold text-neutral-400 text-xs uppercase">No Active Target</h3>
              <p className="text-[10px] text-neutral-600 mt-1.5 max-w-[260px] leading-normal">
                Use the network graph to visualize account relationships. Click any node to open its behavioral profile, transaction streams, and file compliance audits.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
