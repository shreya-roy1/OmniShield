'use client';

import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Database,
  Activity,
  Loader
} from 'lucide-react';
import FraudCanvas from '@/components/FraudCanvas';

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

  const [transactions, setTransactions] = useState<any[]>([]);

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
      const res = await fetch('/api/network-graph');
      if (res.ok) {
        const graphData = await res.json();
        const rawTxs = graphData.links.map((link: any, idx: number) => ({
          id: idx,
          sender_account: link.source,
          receiver_account: link.target,
          amount: link.amount,
          timestamp: new Date().toISOString(),
          is_device_farm_suspected: link.is_device_farm_suspected,
          ip_address: '192.168.1.99',
          device_fingerprint: 'shared_farm_hash'
        }));
        setTransactions(rawTxs.slice(0, 15));
      }
    } catch (err) {
      console.error('Error fetching transactions', err);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchTransactions();

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
        setSeedMessage('Database successfully re-seeded.');
        fetchStats();
        fetchTransactions();
      } else {
        setSeedMessage('Seeding failed.');
      }
    } catch (err) {
      console.error(err);
      setSeedMessage('API connection error.');
    } finally {
      setSeeding(false);
    }
  };

  const handleQuickBlock = async (value: string, type: string, reason: string) => {
    try {
      const res = await fetch('/api/blocklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          value,
          type,
          reason
        })
      });
      if (res.ok) {
        setSeedMessage(`Blocked ${type} successfully.`);
        fetchStats();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <main className="min-h-screen flex flex-col font-sans select-none antialiased leading-snug bg-background text-foreground">
      
      {/* Header - Compressed padding functional navigation bar */}
      <header className="border-b border-border bg-card px-4 py-2 flex items-center justify-between sticky top-0 z-50 rounded-none w-full">
        <div className="flex items-center space-x-2.5">
          <div className="w-6 h-6 bg-black border border-border flex items-center justify-center rounded-none">
            <ShieldAlert className="w-4 h-4 text-destructive fill-destructive/10" />
          </div>
          <div>
            <h1 className="text-xs font-bold text-white tracking-tight flex items-center space-x-2 leading-none">
              <span>OVERVIEW DASHBOARD</span>
            </h1>
            <p className="text-[8px] text-neutral-500 font-mono mt-0.5 uppercase tracking-wide">Real-time telemetry and statistics</p>
          </div>
        </div>

        <div className="flex items-center space-x-2 font-mono">
          <button
            onClick={handleSeedData}
            disabled={seeding}
            className="px-2.5 py-1.5 bg-secondary hover:bg-neutral-850 disabled:opacity-50 text-[9px] font-bold text-neutral-300 border border-border rounded-none transition flex items-center space-x-1.5 cursor-pointer"
          >
            {seeding ? (
              <Loader className="w-3 h-3 animate-spin text-primary" />
            ) : (
              <Database className="w-3 h-3 text-neutral-450" />
            )}
            <span>SEED DB</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-grow w-full flex flex-col bg-background">

        {/* Status Notification banner */}
        {seedMessage && (
          <div className="bg-card border-b border-border px-4 py-1.5 text-[9px] font-mono flex items-center justify-between rounded-none w-full">
            <div className="flex items-center space-x-2 text-neutral-400">
              <span className="w-1 h-1 bg-primary inline-block animate-pulse"></span>
              <span>SYSTEM EVENT: {seedMessage}</span>
            </div>
            <button 
              onClick={() => { setSeedMessage(''); }} 
              className="text-[8px] text-neutral-500 hover:text-neutral-300 uppercase underline cursor-pointer"
            >
              [Dismiss]
            </button>
          </div>
        )}

        {/* Hero Banner - Visual Graph Explainability Engine */}
        <div className="relative bg-card border-b border-border px-4 py-5 rounded-none w-full overflow-hidden min-h-[140px] flex flex-col justify-center">
          
          <FraudCanvas />

          <div className="relative z-10 space-y-1 max-w-3xl pointer-events-auto">
            <div className="flex items-center space-x-2">
              <span className="w-1 h-1 bg-neutral-500 inline-block"></span>
              <span className="text-[9px] font-mono text-neutral-500 uppercase tracking-wide font-bold">Visual Graph Explainability Engine</span>
            </div>
            <h2 className="text-base font-bold text-white tracking-tight uppercase leading-none">Neural Money-Flow Telemetry</h2>
            <p className="text-xs text-neutral-400 leading-relaxed font-sans max-w-xl">
              Analyze transactional vectors in real-time. OmniShield traces device velocity anomalies, automated timing gaps, and external cyber tickets to map suspected fraudulent patterns immediately in the 2D sandbox.
            </p>
          </div>
        </div>

        {/* Statistics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 bg-card border-b border-border divide-x divide-y md:divide-y-0 divide-border rounded-none w-full">
          
          <div className="px-4 py-3 flex flex-col justify-between h-20">
            <span className="text-[9px] uppercase tracking-wide text-neutral-500 font-bold leading-none">SUSPECTED TRANSFERS</span>
            <div className="flex items-baseline space-x-1.5">
              <span className="text-3xl font-medium tracking-tight text-destructive font-mono leading-none">
                {stats.suspected_transactions || 4}
              </span>
              <span className="text-[9px] text-neutral-500 font-mono">/ {stats.total_transactions || 7} total</span>
            </div>
          </div>

          <div className="px-4 py-3 flex flex-col justify-between h-20">
            <span className="text-[9px] uppercase tracking-wide text-neutral-500 font-bold leading-none">FRAUD VOLUME</span>
            <div className="flex items-baseline space-x-0.5">
              <span className="text-3xl font-mono font-medium tracking-tight text-primary leading-none">
                ${(stats.total_fraud_volume || 4100).toLocaleString()}
              </span>
              <span className="text-[9px] text-primary font-mono uppercase ml-0.5">USD</span>
            </div>
          </div>

          <div className="px-4 py-3 flex flex-col justify-between h-20">
            <span className="text-[9px] uppercase tracking-wide text-neutral-500 font-bold leading-none">CYBER TICKETS</span>
            <div className="flex items-baseline space-x-1.5">
              <span className="text-3xl font-medium tracking-tight text-white font-mono leading-none">
                {stats.government_tickets || 1}
              </span>
              <span className="text-[9px] text-neutral-500 font-mono">ACTIVE_COMPLAINTS</span>
            </div>
          </div>

          <div className="px-4 py-3 flex flex-col justify-between h-20">
            <span className="text-[9px] uppercase tracking-wide text-neutral-500 font-bold leading-none">CROSS-CHANNEL ALERTS</span>
            <div className="flex items-baseline space-x-1.5">
              <span className="text-3xl font-medium tracking-tight text-white font-mono leading-none">
                {stats.cross_channel_alerts || 2}
              </span>
              <span className="text-[9px] text-neutral-500 font-mono">TRIGGERS</span>
            </div>
          </div>

        </div>

        {/* Condensed Data Table */}
        <div className="bg-card p-4 space-y-2 rounded-none w-full flex-grow">
          <div className="flex items-center justify-between border-b border-border pb-1.5 mb-2">
            <h3 className="text-xs font-bold text-white uppercase tracking-wide flex items-center space-x-1.5">
              <Activity className="w-3.5 h-3.5 text-neutral-500" />
              <span>Network Ingestion Real-time Feed</span>
            </h3>
            <div className="flex items-center space-x-3 text-[9px] font-mono text-neutral-500">
              <span className="flex items-center space-x-1">
                <span className="w-1.5 h-1.5 bg-primary inline-block rounded-full"></span>
                <span>SYS_HEALTH: ACTIVE</span>
              </span>
              <span>POLL_INTERVAL: 4.0s</span>
            </div>
          </div>

          <div className="overflow-x-auto border border-border">
            <table className="w-full text-[10px] text-left font-mono">
              <thead className="bg-secondary">
                <tr className="border-b border-border text-neutral-400 uppercase text-[9px] tracking-wide">
                  <th className="py-2 px-3">Flow</th>
                  <th className="py-2 px-3">Sender ID</th>
                  <th className="py-2 px-3">Receiver ID</th>
                  <th className="py-2 px-3 text-right">Volume</th>
                  <th className="py-2 px-3">Telemetry</th>
                  <th className="py-2 px-3 text-right">Audit Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 bg-black">
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-neutral-600 uppercase tracking-widest text-[9px]">
                      NO TRANSACTIONS IN FEED
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx, idx) => (
                    <tr key={idx} className="hover:bg-neutral-800/50 text-white transition-colors">
                      <td className="py-2 px-3 font-semibold">
                        {tx.is_device_farm_suspected ? (
                          <span className="text-destructive font-mono">🔴 FLAGGED</span>
                        ) : (
                          <span className="text-primary font-mono">🟢 APPROVED</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-neutral-200">{tx.sender_account}</td>
                      <td className="py-2 px-3 text-neutral-200">{tx.receiver_account}</td>
                      <td className="py-2 px-3 text-right font-medium text-white">
                        ${tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-2 px-3 text-neutral-400 font-mono text-[9px] truncate max-w-[200px]">
                        IP: {tx.ip_address} | FP: {tx.device_fingerprint}
                      </td>
                      <td className="py-2 px-3 text-right">
                        {tx.is_device_farm_suspected ? (
                          <button
                            onClick={() => handleQuickBlock(tx.ip_address, 'ip', 'Linked to suspected device farm')}
                            className="text-[9px] bg-secondary border border-border text-destructive hover:bg-destructive hover:text-white px-2 py-1 transition font-semibold rounded-none cursor-pointer"
                          >
                            QUICK_BLOCK_IP
                          </button>
                        ) : (
                          <span className="text-neutral-500">UNRESTRICTED</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Footer */}
      <footer className="border-t border-border bg-card py-2 text-center text-[8px] text-neutral-500 font-mono uppercase tracking-wide">
        OmniShield Full-Stack Fraud Fingerprinting System &copy; 2026. Banking Hackathon MVP.
      </footer>
    </main>
  );
}
