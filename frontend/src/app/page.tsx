'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  ShieldAlert,
  Database,
  Activity,
  FileText,
  Upload,
  Users,
  Laptop,
  DollarSign,
  Send,
  ArrowRight,
  TrendingUp,
  AlertOctagon,
  Globe,
  Loader
} from 'lucide-react';

interface Stats {
  total_transactions: number;
  suspected_transactions: number;
  government_tickets: number;
  cross_channel_alerts: number;
  total_fraud_volume: number;
  suspected_devices: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({
    total_transactions: 0,
    suspected_transactions: 0,
    government_tickets: 0,
    cross_channel_alerts: 0,
    total_fraud_volume: 0,
    suspected_devices: 0
  });

  const [seeding, setSeeding] = useState(false);
  const [seedMessage, setSeedMessage] = useState('');

  // Transaction Simulator Form State
  const [txSender, setTxSender] = useState('ACC_001');
  const [txReceiver, setTxReceiver] = useState('ACC_002');
  const [txAmount, setTxAmount] = useState('250.00');
  const [txIp, setTxIp] = useState('192.168.1.100');
  const [txFingerprint, setTxFingerprint] = useState('fingerprint_desktop_chrome');
  const [txLoginDelay, setTxLoginDelay] = useState('10'); // seconds between login and transfer
  const [txSubmitting, setTxSubmitting] = useState(false);
  const [txResult, setTxResult] = useState<any>(null);

  // CSV file state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [csvUploading, setCsvUploading] = useState(false);
  const [csvMessage, setCsvMessage] = useState('');

  // Live feed and Blocklist states
  const [transactions, setTransactions] = useState<any[]>([]);
  const [blocklist, setBlocklist] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'simulate' | 'csv' | 'blocklist'>('simulate');

  // Blocklist Form state
  const [newBlockValue, setNewBlockValue] = useState('');
  const [newBlockType, setNewBlockType] = useState('ip');
  const [newBlockReason, setNewBlockReason] = useState('Flagged during compliance check');
  const [blockSubmitting, setBlockSubmitting] = useState(false);
  const [blockMessage, setBlockMessage] = useState('');

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/statistics');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Error fetching statistics', err);
    }
  };

  const fetchTransactions = async () => {
    try {
      const res = await fetch('/api/transactions');
      if (res.ok) {
        const data = await res.json();
        setTransactions(data);
      }
    } catch (err) {
      console.error('Error fetching transactions', err);
    }
  };

  const fetchBlocklist = async () => {
    try {
      const res = await fetch('/api/blocklist');
      if (res.ok) {
        const data = await res.json();
        setBlocklist(data);
      }
    } catch (err) {
      console.error('Error fetching blocklist', err);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchTransactions();
    fetchBlocklist();

    const interval = setInterval(() => {
      fetchStats();
      fetchTransactions();
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleSeedData = async () => {
    setSeeding(true);
    setSeedMessage('');
    try {
      const res = await fetch('/api/seed-mock-data', { method: 'POST' });
      if (res.ok) {
        setSeedMessage('Mock database re-seeded successfully!');
        fetchStats();
        fetchTransactions();
        fetchBlocklist();
      } else {
        setSeedMessage('Failed to seed mock data.');
      }
    } catch (err) {
      console.error(err);
      setSeedMessage('Error contacting API server.');
    } finally {
      setSeeding(false);
    }
  };

  const handleSimulateTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    setTxSubmitting(true);
    setTxResult(null);

    const now = new Date();
    const delaySecs = parseFloat(txLoginDelay) || 0.0;
    const loginTime = new Date(now.getTime() - (delaySecs * 1000));

    const payload = {
      sender_account: txSender,
      receiver_account: txReceiver,
      amount: parseFloat(txAmount),
      timestamp: now.toISOString(),
      device_metadata: {
        ip_address: txIp,
        device_fingerprint: txFingerprint,
        login_time: loginTime.toISOString()
      }
    };

    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok) {
        setTxResult({
          success: true,
          data: data
        });
        fetchStats();
        fetchTransactions();
      } else {
        setTxResult({
          success: false,
          error: data.detail || 'Failed to process transaction'
        });
      }
    } catch (err: any) {
      setTxResult({
        success: false,
        error: 'Backend API offline or unreachable.'
      });
    } finally {
      setTxSubmitting(false);
    }
  };

  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvUploading(true);
    setCsvMessage('');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload-government-tickets', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        setCsvMessage(`Successfully imported ${data.records_imported} government tickets!`);
        fetchStats();
        fetchTransactions();
      } else {
        setCsvMessage(data.detail || 'Failed to process CSV file.');
      }
    } catch (err) {
      console.error(err);
      setCsvMessage('Error uploading file. Verify backend connectivity.');
    } finally {
      setCsvUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleAddBlocklist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBlockValue.trim()) return;
    setBlockSubmitting(true);
    setBlockMessage('');
    try {
      const res = await fetch('/api/blocklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          value: newBlockValue,
          type: newBlockType,
          reason: newBlockReason
        })
      });
      if (res.ok) {
        setBlockMessage(`Blocked ${newBlockType} successfully!`);
        setNewBlockValue('');
        fetchBlocklist();
        fetchStats();
      } else {
        setBlockMessage('Failed to save to blocklist.');
      }
    } catch (err) {
      console.error(err);
      setBlockMessage('Error calling blocklist API.');
    } finally {
      setBlockSubmitting(false);
    }
  };

  const handleQuickBlock = async (value: string, type: 'ip' | 'fingerprint', reason: string) => {
    try {
      const res = await fetch('/api/blocklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value, type, reason })
      });
      if (res.ok) {
        setSeedMessage(`Quick-blocked ${type}: ${value}`);
        fetchBlocklist();
        fetchTransactions();
        fetchStats();
      }
    } catch (err) {
      console.error('Quick block error', err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Header */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md px-8 py-5 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-red-600/10 border border-red-500/20 flex items-center justify-center">
            <ShieldAlert className="w-6 h-6 text-red-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center space-x-2">
              <span>OmniShield Hub</span>
              <span className="text-[10px] px-2 py-0.5 bg-red-500/10 border border-red-500/20 text-red-400 font-semibold rounded-full">
                HACKATHON MVP
              </span>
            </h1>
            <p className="text-xs text-slate-400">Multi-Channel Banking Fraud Fingerprinting & Explainability</p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <button
            onClick={handleSeedData}
            disabled={seeding}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-xs font-semibold rounded-lg border border-slate-800 transition flex items-center space-x-2 text-slate-200"
          >
            {seeding ? (
              <Loader className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Database className="w-3.5 h-3.5 text-blue-500" />
            )}
            <span>Seed Demo Data</span>
          </button>

          <Link
            href="/network-investigation"
            className="px-4 py-2 bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-xs font-semibold rounded-lg shadow-lg hover:shadow-red-500/10 transition flex items-center space-x-2 text-white"
          >
            <span>Network Visualizer</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 p-8 max-w-7xl mx-auto w-full space-y-8">

        {/* Status Messages */}
        {seedMessage && (
          <div className="bg-blue-500/10 border border-blue-500/20 text-blue-400 p-4 rounded-xl text-sm flex items-center justify-between">
            <span>{seedMessage}</span>
            <button onClick={() => setSeedMessage('')} className="text-xs text-slate-500 hover:text-slate-300">Dismiss</button>
          </div>
        )}

        {/* Hero Banner / Quick Link */}
        <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-900/20 p-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <h2 className="text-xl font-bold text-white">Visual Graph Explainability Engine</h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              Analyze money flow vectors in real-time. OmniShield traces device telemetry, login timing gaps, and government-flagged CSV inputs to map fraudulent clusters in interactive 2D node graphs.
            </p>
          </div>
          <Link
            href="/network-investigation"
            className="shrink-0 px-5 py-3 bg-red-600 hover:bg-red-500 text-xs font-bold rounded-xl shadow-lg transition flex items-center space-x-2 text-white"
          >
            <span>Launch Network Investigation</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Statistics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

          <div className="bg-slate-900/30 border border-slate-900 rounded-2xl p-6 space-y-3 hover:border-slate-800/80 transition">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 font-medium">Suspected Transfers</span>
              <AlertOctagon className="w-5 h-5 text-red-500" />
            </div>
            <div className="flex items-baseline space-x-2">
              <span className="text-3xl font-extrabold tracking-tight text-white">{stats.suspected_transactions}</span>
              <span className="text-xs text-slate-500">out of {stats.total_transactions} txs</span>
            </div>
            <div className="text-[10px] text-red-400 font-medium flex items-center space-x-1">
              <span>Velocity & Emulator triggers</span>
            </div>
          </div>

          <div className="bg-slate-900/30 border border-slate-900 rounded-2xl p-6 space-y-3 hover:border-slate-800/80 transition">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 font-medium">Suspected Fraud Volume</span>
              <DollarSign className="w-5 h-5 text-emerald-500" />
            </div>
            <div className="flex items-baseline space-x-1">
              <span className="text-3xl font-extrabold tracking-tight text-white">
                ${stats.total_fraud_volume.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="text-[10px] text-slate-500 font-medium">
              Total transaction sum of flagged accounts
            </div>
          </div>

          <div className="bg-slate-900/30 border border-slate-900 rounded-2xl p-6 space-y-3 hover:border-slate-800/80 transition">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 font-medium">Gov Cyber Tickets</span>
              <FileText className="w-5 h-5 text-amber-500" />
            </div>
            <div className="flex items-baseline space-x-1">
              <span className="text-3xl font-extrabold tracking-tight text-white">{stats.government_tickets}</span>
            </div>
            <div className="text-[10px] text-slate-500 font-medium">
              Static CSV reports from local agencies
            </div>
          </div>

          <div className="bg-slate-900/30 border border-slate-900 rounded-2xl p-6 space-y-3 hover:border-slate-800/80 transition">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 font-medium">Cross-Channel Alerts</span>
              <Activity className="w-5 h-5 text-blue-500" />
            </div>
            <div className="flex items-baseline space-x-1">
              <span className="text-3xl font-extrabold tracking-tight text-white">{stats.cross_channel_alerts}</span>
            </div>
            <div className="text-[10px] text-slate-500 font-medium">
              Multi-factor & geolocation exceptions
            </div>
          </div>

        </div>

        {/* Action Panel Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Form: Simulate Transactions */}
          <div className="lg:col-span-2 bg-slate-900/20 border border-slate-900 rounded-2xl p-6 space-y-6">
            <div>
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <Globe className="w-5 h-5 text-blue-500" />
                <span>Simulate Ingestion Feed (Transaction)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Inject custom transaction streams to instantly test IP Velocity or Automated Emulator flags.
              </p>
            </div>

            <form onSubmit={handleSimulateTransaction} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-mono font-bold text-slate-400">Sender Account ID</label>
                  <input
                    type="text"
                    value={txSender}
                    onChange={(e) => setTxSender(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-900 focus:border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-300 focus:outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-mono font-bold text-slate-400">Receiver Account ID</label>
                  <input
                    type="text"
                    value={txReceiver}
                    onChange={(e) => setTxReceiver(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-900 focus:border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-300 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-mono font-bold text-slate-400">Amount (USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={txAmount}
                    onChange={(e) => setTxAmount(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-900 focus:border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-mono font-bold text-slate-400">IP Address</label>
                  <input
                    type="text"
                    value={txIp}
                    onChange={(e) => setTxIp(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-900 focus:border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-300 focus:outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-mono font-bold text-slate-400">Device Fingerprint</label>
                  <input
                    type="text"
                    value={txFingerprint}
                    onChange={(e) => setTxFingerprint(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-900 focus:border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-300 focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] uppercase font-mono font-bold text-slate-400">
                    Login Delay (Time-to-Transfer)
                  </label>
                  <span className="text-[10px] text-slate-500">{txLoginDelay}s latency</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="10"
                  step="0.1"
                  value={txLoginDelay}
                  onChange={(e) => setTxLoginDelay(e.target.value)}
                  className="w-full accent-red-600 bg-slate-950 h-1.5 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-[8px] text-slate-500 font-mono">
                  <span>BOT/EMULATOR CHECK (&lt; 2s)</span>
                  <span>NORMAL HUMAN BEHAVIOR (&gt; 2s)</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={txSubmitting}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-xs font-bold rounded-lg border border-slate-800 transition flex items-center justify-center space-x-2 text-white"
              >
                {txSubmitting ? (
                  <Loader className="w-4 h-4 animate-spin text-blue-500" />
                ) : (
                  <Send className="w-4 h-4 text-emerald-500" />
                )}
                <span>Simulate Real-time Transaction</span>
              </button>
            </form>

            {/* Ingestion results */}
            {txResult && (
              <div className={`p-4 rounded-xl border text-xs font-mono ${txResult.success
                ? txResult.data.is_device_farm_suspected
                  ? 'bg-red-500/10 border-red-500/20 text-red-400'
                  : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                : 'bg-red-500/10 border-red-500/20 text-red-400'
                }`}>
                {txResult.success ? (
                  <div className="space-y-1">
                    <p className="font-semibold">Transaction processed successfully.</p>
                    <p>Status: {txResult.data.is_device_farm_suspected ? '🔴 SUSPECTED FRAUD FLAG TRIGGERED' : '🟢 APPROVED'}</p>
                    {txResult.data.device_farm_reason && (
                      <p className="mt-1 text-[11px] leading-relaxed">Reason: {txResult.data.device_farm_reason}</p>
                    )}
                  </div>
                ) : (
                  <p>Error processing simulation: {txResult.error}</p>
                )}
              </div>
            )}
          </div>

          {/* Sidebar Action: CSV Import */}
          <div className="bg-slate-900/20 border border-slate-900 rounded-2xl p-6 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center space-x-2">
                  <Upload className="w-5 h-5 text-amber-500" />
                  <span>Government Cyber CSV Import</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Upload static CSV files containing cyber fraud records reported by local authorities. Account matches will link automatically.
                </p>
              </div>

              {/* CSV Schema Info */}
              <div className="bg-slate-950 border border-slate-900 p-4 rounded-xl space-y-2 text-[10px] text-slate-400">
                <p className="font-bold text-slate-300 uppercase font-mono text-[8px] tracking-wider">Required CSV Schema:</p>
                <code className="block bg-slate-900 p-1.5 rounded font-mono text-[9px] text-slate-300 select-all overflow-x-auto whitespace-nowrap">
                  ticket_id,reported_account,scam_type,report_date,details
                </code>
                <p className="text-[8px] leading-tight">
                  Example: <br />
                  <span className="font-mono text-slate-500">TKT-001,ACC_005,Phishing,2026-06-01T12:00:00,User report...</span>
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleCsvUpload}
                accept=".csv"
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={csvUploading}
                className="w-full py-3 border border-dashed border-slate-800 hover:border-slate-700 bg-slate-950 text-xs font-semibold rounded-xl text-slate-300 hover:text-slate-100 transition flex flex-col items-center justify-center space-y-2"
              >
                {csvUploading ? (
                  <Loader className="w-5 h-5 text-amber-500 animate-spin" />
                ) : (
                  <Upload className="w-5 h-5 text-slate-500 hover:text-slate-300" />
                )}
                <span>{csvUploading ? 'Importing CSV...' : 'Click to select CSV File'}</span>
              </button>

              {csvMessage && (
                <div className={`p-3 rounded-lg text-[11px] text-center font-semibold ${csvMessage.includes('Successfully')
                  ? 'bg-amber-500/10 border border-amber-500/20 text-amber-400'
                  : 'bg-red-500/10 border border-red-500/20 text-red-400'
                  }`}>
                  {csvMessage}
                </div>
              )}
            </div>
          </div>

        </div>

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-5 text-center text-[10px] text-slate-500">
        OmniShield Full-Stack Fraud Fingerprinting System &copy; 2026. Banking Hackathon MVP.
      </footer>
    </div>
  );
}
