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
  FileSpreadsheet,
  Activity,
  Send
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Header */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center space-x-4">
          <Link href="/" className="p-2 hover:bg-slate-900 rounded-lg transition text-slate-400 hover:text-slate-100">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center space-x-2">
              <ShieldAlert className="w-6 h-6 text-red-500" />
              <span>Network Investigation Sandbox</span>
            </h1>
            <p className="text-xs text-slate-400">OmniShield Graph Visualizer & Fraud Analyzer</p>
          </div>
        </div>
        <button
          onClick={fetchGraphData}
          disabled={loading}
          className="flex items-center space-x-2 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-xs font-semibold rounded-lg border border-slate-800 transition text-slate-200"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Graph</span>
        </button>
      </header>

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left: Graph Area */}
        <div className="flex-1 p-6 flex flex-col space-y-4">
          {apiError && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex items-start space-x-3 text-sm">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <div>
                <p className="font-semibold">Connection Error</p>
                <p className="text-xs mt-0.5">{apiError}</p>
              </div>
            </div>
          )}

          <div className="flex-1 relative min-h-[500px]">
            {loading ? (
              <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center space-y-3 z-20">
                <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
                <span className="text-sm text-slate-400">Loading neural network connections...</span>
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
        <div className="w-full lg:w-[480px] border-t lg:border-t-0 lg:border-l border-slate-900 bg-slate-950 p-6 flex flex-col overflow-y-auto max-h-screen space-y-6">
          
          {/* Quick Select Target Dropdown */}
          <div className="space-y-2">
            <label className="text-[10px] uppercase font-mono font-bold text-slate-400 block">
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
              className="w-full bg-slate-900/60 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-300 font-semibold focus:outline-none focus:border-slate-700 transition"
            >
              <option value="">-- Select Account to Investigate --</option>
              {graphData.nodes.map(node => (
                <option key={node.id} value={node.id}>
                  {node.name} ({node.id}) {node.is_device_farm_suspected ? '⚠️' : ''} {node.is_cyber_flagged ? '🚨' : ''} {node.is_alert_flagged ? '🔔' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="border-t border-slate-900"></div>

          {selectedNode ? (
            <div className="space-y-6 flex-1 flex flex-col">
              {/* Account Detail Header */}
              <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-900 flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <User className="w-5 h-5 text-slate-400" />
                    <h3 className="font-bold text-lg text-white">{selectedNode.name}</h3>
                  </div>
                  <code className="text-xs text-slate-500 font-mono block">{selectedNode.id}</code>
                </div>

                {/* Threat Tags */}
                <div className="flex flex-col space-y-1.5 items-end">
                  {selectedNode.is_device_farm_suspected && (
                    <span className="px-2 py-0.5 bg-red-500/10 border border-red-500/30 text-red-400 text-[10px] font-bold rounded">
                      DEVICE FARM
                    </span>
                  )}
                  {selectedNode.is_cyber_flagged && (
                    <span className="px-2 py-0.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-bold rounded">
                      GOV CYBER TICKET
                    </span>
                  )}
                  {selectedNode.is_alert_flagged && (
                    <span className="px-2 py-0.5 bg-blue-500/10 border border-blue-500/30 text-blue-400 text-[10px] font-bold rounded">
                      SECURITY ALERT
                    </span>
                  )}
                </div>
              </div>

              {/* Connected Transactions Section */}
              <div className="space-y-3">
                <h4 className="font-bold text-sm text-slate-300 flex items-center space-x-1.5">
                  <Activity className="w-4 h-4 text-emerald-500" />
                  <span>Network Transaction Flows</span>
                </h4>
                <div className="border border-slate-900 rounded-xl overflow-hidden bg-slate-900/20 max-h-[220px] overflow-y-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-900/60 text-slate-400 text-[10px] uppercase font-mono tracking-wider">
                      <tr>
                        <th className="px-3 py-2">Direction</th>
                        <th className="px-3 py-2">Counterparty</th>
                        <th className="px-3 py-2 text-right">Amount</th>
                        <th className="px-3 py-2 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-900">
                      {accountLinks.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-3 py-4 text-center text-slate-500">No active flows linked</td>
                        </tr>
                      ) : (
                        accountLinks.map((link, idx) => {
                          const srcId = typeof link.source === 'object' ? link.source.id : link.source;
                          const isSender = srcId === selectedNode.id;
                          const counterparty = isSender
                            ? (typeof link.target === 'object' ? link.target.id : link.target)
                            : srcId;
                          return (
                            <tr key={idx} className="hover:bg-slate-900/30">
                              <td className="px-3 py-2.5 font-semibold">
                                {isSender ? (
                                  <span className="text-red-400 flex items-center">Outgoing</span>
                                ) : (
                                  <span className="text-emerald-400 flex items-center">Incoming</span>
                                )}
                              </td>
                              <td className="px-3 py-2.5 font-mono text-[11px] text-slate-400 max-w-[120px] truncate">
                                {counterparty}
                              </td>
                              <td className="px-3 py-2.5 text-right font-semibold text-slate-200">
                                ${link.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </td>
                              <td className="px-3 py-2.5 text-right">
                                {link.is_device_farm_suspected ? (
                                  <span className="text-red-500 font-bold">FLAGGED</span>
                                ) : (
                                  <span className="text-slate-500">CLEAN</span>
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
              <div className="border-t border-slate-900 pt-6 flex-1 flex flex-col min-h-[300px]">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-bold text-sm text-slate-300 flex items-center space-x-1.5">
                    <FileText className="w-4 h-4 text-blue-500" />
                    <span>Auto-Report Generator (SAR)</span>
                  </h4>
                  {!sarReport && !sarLoading && (
                    <button
                      onClick={handleGenerateSAR}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-xs font-semibold rounded-lg shadow-lg hover:shadow-blue-500/20 transition flex items-center space-x-1 text-white"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Compile Report</span>
                    </button>
                  )}
                </div>

                <div className="flex-1 flex flex-col relative min-h-[200px]">
                  {sarLoading ? (
                    <div className="absolute inset-0 bg-slate-950/80 flex flex-col items-center justify-center space-y-3 z-10 border border-slate-900 rounded-xl">
                      <RefreshCw className="w-6 h-6 text-blue-500 animate-spin" />
                      <span className="text-xs text-slate-400 font-mono">Running LLM LangChain agent...</span>
                    </div>
                  ) : null}

                  {sarReport ? (
                    <div className="flex-1 flex flex-col space-y-4">
                      <textarea
                        value={sarReport}
                        onChange={(e) => setSarReport(e.target.value)}
                        className="flex-1 min-h-[220px] bg-slate-900/40 border border-slate-900 rounded-xl p-4 text-xs font-mono text-slate-300 leading-relaxed focus:outline-none focus:border-slate-800 resize-y"
                        placeholder="Edit report draft..."
                      />

                      <div className="flex items-center space-x-3 justify-end">
                        <button
                          onClick={handleGenerateSAR}
                          className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-100 hover:bg-slate-900 border border-slate-900 rounded-lg transition"
                        >
                          Regenerate
                        </button>
                        <button
                          onClick={handleApproveSAR}
                          className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold rounded-lg shadow-lg hover:shadow-emerald-500/20 transition flex items-center space-x-1.5 text-white"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>Approve & Submit SAR</span>
                        </button>
                      </div>

                      {sarSaved && (
                        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-3 rounded-lg flex items-center space-x-2 text-xs">
                          <CheckCircle className="w-4 h-4 shrink-0" />
                          <span>SAR has been successfully archived to compliance vault and queued for FinCEN transmission.</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex-1 border border-dashed border-slate-900 rounded-xl flex flex-col items-center justify-center p-6 text-center text-slate-500">
                      <FileText className="w-8 h-8 text-slate-800 mb-2" />
                      <p className="text-xs">No SAR drafted for this subject.</p>
                      <p className="text-[10px] text-slate-600 mt-1 max-w-[240px]">
                        Click the 'Compile Report' button to run the AI compliance parser on transaction flows and device telemetry.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-500">
              <ShieldAlert className="w-12 h-12 text-slate-800 mb-3" />
              <h3 className="font-bold text-slate-400 text-sm">No Active Target</h3>
              <p className="text-xs text-slate-600 mt-1 max-w-[260px] leading-relaxed">
                Use the network graph to visualize account relationships. Click any node to open its behavioral profile, transaction streams, and file compliance audits.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
