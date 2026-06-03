'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  ShieldAlert,
  Database,
  Activity,
  Upload,
  Send,
  ArrowRight,
  AlertOctagon,
  Globe,
  Loader,
  Plus
} from 'lucide-react';

interface Stats {
  total_transactions: number;
  suspected_transactions: number;
  government_tickets: number;
  cross_channel_alerts: number;
  total_fraud_volume: number;
  suspected_devices: number;
}

interface BlocklistEntry {
  id: number;
  value: string;
  type: string;
  reason: string;
}

// Live Canvas Telemetry Background (Subtle Enterprise Style)
const FraudCanvas = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = canvas.offsetWidth || 800);
    let height = (canvas.height = canvas.offsetHeight || 250);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.offsetWidth;
      height = canvas.height = canvas.offsetHeight;
    };
    window.addEventListener('resize', handleResize);

    // Generate account nodes
    const numNodes = 15;
    const nodes: any[] = [];
    for (let i = 0; i < numNodes; i++) {
      nodes.push({
        id: i,
        x: Math.random() * (width - 80) + 40,
        y: Math.random() * (height - 60) + 30,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        radius: Math.random() * 2 + 1.2,
        isFraud: false,
        fraudIntensity: 0,
      });
    }

    // Generate connections between nodes
    const connections: { from: number; to: number }[] = [];
    for (let i = 0; i < numNodes; i++) {
      const targets = [...nodes]
        .map((n, idx) => ({ idx, dist: Math.hypot(n.x - nodes[i].x, n.y - nodes[i].y) }))
        .filter((t) => t.idx !== i)
        .sort((a, b) => a.dist - b.dist)
        .slice(0, Math.random() > 0.5 ? 2 : 1);

      targets.forEach((t) => {
        if (!connections.some((c) => (c.from === i && c.to === t.idx) || (c.from === t.idx && c.to === i))) {
          connections.push({ from: i, to: t.idx });
        }
      });
    }

    // Data pulses traveling along connections
    const pulses: any[] = [];
    const maxPulses = 8;
    for (let i = 0; i < maxPulses; i++) {
      if (connections.length > 0) {
        const conn = connections[Math.floor(Math.random() * connections.length)];
        pulses.push({
          from: conn.from,
          to: conn.to,
          t: Math.random(),
          speed: Math.random() * 0.003 + 0.0015,
        });
      }
    }

    // Fraud catch state
    let lastFraudCatch = Date.now();
    let fraudNodeIdx = -1;
    let rippleRadius = 0;
    let rippleOpacity = 0;

    const animate = () => {
      ctx.clearRect(0, 0, width, height);

      // 1. Update node positions
      nodes.forEach((node) => {
        node.x += node.vx;
        node.y += node.vy;
        if (node.x < 15 || node.x > width - 15) node.vx *= -1;
        if (node.y < 15 || node.y > height - 15) node.vy *= -1;
      });

      // 2. Trigger periodic Fraud Catch
      const now = Date.now();
      if (now - lastFraudCatch > 4500) {
        fraudNodeIdx = Math.floor(Math.random() * nodes.length);
        nodes[fraudNodeIdx].isFraud = true;
        nodes[fraudNodeIdx].fraudIntensity = 1.0;
        rippleRadius = 0;
        rippleOpacity = 0.7;
        lastFraudCatch = now;
      }

      // Fade out fraud intensities
      nodes.forEach((node) => {
        if (node.isFraud) {
          node.fraudIntensity -= 0.015;
          if (node.fraudIntensity <= 0) {
            node.isFraud = false;
            node.fraudIntensity = 0;
          }
        }
      });

      if (fraudNodeIdx !== -1 && rippleOpacity > 0) {
        rippleRadius += 1.5;
        rippleOpacity -= 0.008;
        if (rippleOpacity <= 0) {
          fraudNodeIdx = -1;
        }
      }

      // 3. Draw connections
      connections.forEach((conn) => {
        const fromNode = nodes[conn.from];
        const toNode = nodes[conn.to];
        ctx.beginPath();
        ctx.moveTo(fromNode.x, fromNode.y);
        ctx.lineTo(toNode.x, toNode.y);

        if (fromNode.isFraud || toNode.isFraud) {
          const intensity = Math.max(fromNode.fraudIntensity, toNode.fraudIntensity);
          ctx.strokeStyle = `rgba(245, 61, 61, ${0.1 + intensity * 0.4})`;
          ctx.lineWidth = 1 + intensity * 0.5;
        } else {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)'; // Barely visible grey lines
          ctx.lineWidth = 0.5;
        }
        ctx.stroke();
      });

      // 4. Draw ripple effect
      if (fraudNodeIdx !== -1 && fraudNodeIdx < nodes.length) {
        const fn = nodes[fraudNodeIdx];
        ctx.beginPath();
        ctx.arc(fn.x, fn.y, rippleRadius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(245, 61, 61, ${rippleOpacity})`;
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }

      // 5. Draw data pulses
      pulses.forEach((pulse) => {
        pulse.t += pulse.speed;
        if (pulse.t >= 1) {
          pulse.t = 0;
          const conn = connections[Math.floor(Math.random() * connections.length)];
          pulse.from = conn.from;
          pulse.to = conn.to;
        }

        const fromNode = nodes[pulse.from];
        const toNode = nodes[pulse.to];
        const px = fromNode.x + (toNode.x - fromNode.x) * pulse.t;
        const py = fromNode.y + (toNode.y - fromNode.y) * pulse.t;

        ctx.beginPath();
        ctx.arc(px, py, 1.0, 0, Math.PI * 2);
        if (fromNode.isFraud || toNode.isFraud) {
          ctx.fillStyle = '#FF3333'; // alert red
        } else {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.25)'; // Stark light grey instead of green
        }
        ctx.fill();
      });

      // 6. Draw nodes
      nodes.forEach((node) => {
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius + (node.isFraud ? 1.5 : 0), 0, Math.PI * 2);
        if (node.isFraud) {
          ctx.fillStyle = `rgba(245, 61, 61, ${node.fraudIntensity})`;
          ctx.strokeStyle = '#FF3333';
          ctx.lineWidth = 0.5;
          ctx.stroke();
        } else {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
        }
        ctx.fill();
      });

      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none opacity-30 z-0 bg-transparent" />;
};

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
  const [txLoginDelay, setTxLoginDelay] = useState('1.5'); // seconds between login and transfer
  const [txSubmitting, setTxSubmitting] = useState(false);
  const [txResult, setTxResult] = useState<any>(null);

  // CSV file state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [csvUploading, setCsvUploading] = useState(false);
  const [csvMessage, setCsvMessage] = useState('');

  // Live feed and Blocklist states
  const [transactions, setTransactions] = useState<any[]>([]);
  const [blocklist, setBlocklist] = useState<BlocklistEntry[]>([]);

  // Blocklist Form state
  const [newBlockValue, setNewBlockValue] = useState('');
  const [newBlockType, setNewBlockType] = useState('ip');
  const [newBlockReason, setNewBlockReason] = useState('Identified anomaly pattern');
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
      fetchBlocklist();
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
        fetchBlocklist();
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
        error: 'API offline.'
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
        setCsvMessage(`Successfully imported ${data.records_imported} government tickets.`);
        fetchStats();
        fetchTransactions();
      } else {
        setCsvMessage(data.detail || 'Failed to process CSV.');
      }
    } catch (err) {
      console.error(err);
      setCsvMessage('Upload connection error.');
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
        setBlockMessage(`Blocked ${newBlockType} successfully.`);
        setNewBlockValue('');
        fetchBlocklist();
        fetchStats();
      } else {
        setBlockMessage('Failed to save block.');
      }
    } catch (err) {
      console.error(err);
      setBlockMessage('API connection error.');
    } finally {
      setBlockSubmitting(false);
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
        setBlockMessage(`Blocked ${type} successfully.`);
        fetchBlocklist();
        fetchStats();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col font-sans select-none antialiased leading-snug">
      
      {/* Header - Compressed padding functional navigation bar */}
      <header className="border-b border-border bg-card px-4 py-1.5 flex items-center justify-between sticky top-0 z-50 rounded-none w-full">
        <div className="flex items-center space-x-2.5">
          <div className="w-6 h-6 bg-black border border-border flex items-center justify-center rounded-none">
            <ShieldAlert className="w-4 h-4 text-destructive fill-destructive/10" />
          </div>
          <div>
            <h1 className="text-xs font-bold text-white tracking-tight flex items-center space-x-2 leading-none">
              <span>OMNISHIELD HUB</span>
              <span className="text-[7px] px-1.5 py-0.5 bg-black border border-border text-primary font-mono font-semibold rounded-none uppercase">
                SECURE_GATEWAY
              </span>
            </h1>
            <p className="text-[8px] text-neutral-500 font-mono mt-0.5 uppercase tracking-wide">Multi-Channel Behavioral Risk & Intelligence Terminal</p>
          </div>
        </div>

        <div className="flex items-center space-x-2 font-mono">
          <button
            onClick={handleSeedData}
            disabled={seeding}
            className="px-2.5 py-1 bg-secondary hover:bg-neutral-850 disabled:opacity-50 text-[9px] font-bold text-neutral-300 border border-border rounded-none transition flex items-center space-x-1.5 cursor-pointer"
          >
            {seeding ? (
              <Loader className="w-2.5 h-2.5 animate-spin text-primary" />
            ) : (
              <Database className="w-2.5 h-2.5 text-neutral-450" />
            )}
            <span>SEED DB</span>
          </button>

          <Link
            href="/network-investigation"
            className="px-2.5 py-1 bg-primary hover:bg-primary/90 text-[9px] font-bold text-black rounded-none transition flex items-center space-x-1.5 cursor-pointer"
          >
            <span>LAUNCH GRAPH WORKSPACE</span>
            <ArrowRight className="w-3 h-3 text-black" />
          </Link>
        </div>
      </header>

      {/* Main Container - Full-Width Flush Grid */}
      <div className="flex-grow w-full flex flex-col bg-background">

        {/* Status Notification banner */}
        {(seedMessage || blockMessage || csvMessage) && (
          <div className="bg-card border-b border-border px-4 py-1.5 text-[9px] font-mono flex items-center justify-between rounded-none w-full">
            <div className="flex items-center space-x-2 text-neutral-400">
              <span className="w-1 h-1 bg-primary inline-block animate-pulse"></span>
              <span>SYSTEM EVENT: {seedMessage || blockMessage || csvMessage}</span>
            </div>
            <button 
              onClick={() => { setSeedMessage(''); setBlockMessage(''); setCsvMessage(''); }} 
              className="text-[8px] text-neutral-500 hover:text-neutral-300 uppercase underline cursor-pointer"
            >
              [Dismiss]
            </button>
          </div>
        )}

        {/* Hero Banner - Visual Graph Explainability Engine */}
        <div className="relative bg-card border-b border-border px-4 py-5 rounded-none w-full overflow-hidden min-h-[140px] flex flex-col justify-center">
          
          {/* Subtle Canvas Telemetry */}
          <FraudCanvas />

          {/* Foreground Text */}
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

        {/* Statistics Grid - Divided by 1px Neutral border */}
        <div className="grid grid-cols-2 md:grid-cols-4 bg-card border-b border-border divide-x divide-border rounded-none w-full">
          
          <div className="px-4 py-2.5 flex flex-col justify-between h-18">
            <span className="text-[9px] uppercase tracking-wide text-neutral-500 font-bold leading-none">SUSPECTED TRANSFERS</span>
            <div className="flex items-baseline space-x-1.5">
              <span className="text-3xl font-medium tracking-tight text-destructive font-mono leading-none">
                {stats.suspected_transactions || 4}
              </span>
              <span className="text-[9px] text-neutral-500 font-mono">/ {stats.total_transactions || 7} total</span>
            </div>
          </div>

          <div className="px-4 py-2.5 flex flex-col justify-between h-18">
            <span className="text-[9px] uppercase tracking-wide text-neutral-500 font-bold leading-none">FRAUD VOLUME</span>
            <div className="flex items-baseline space-x-0.5">
              <span className="text-3xl font-mono font-medium tracking-tight text-primary leading-none">
                ${(stats.total_fraud_volume || 4100).toLocaleString()}
              </span>
              <span className="text-[9px] text-primary font-mono uppercase ml-0.5">USD</span>
            </div>
          </div>

          <div className="px-4 py-2.5 flex flex-col justify-between h-18">
            <span className="text-[9px] uppercase tracking-wide text-neutral-500 font-bold leading-none">CYBER TICKETS</span>
            <div className="flex items-baseline space-x-1.5">
              <span className="text-3xl font-medium tracking-tight text-white font-mono leading-none">
                {stats.government_tickets || 1}
              </span>
              <span className="text-[9px] text-neutral-500 font-mono">ACTIVE_COMPLAINTS</span>
            </div>
          </div>

          <div className="px-4 py-2.5 flex flex-col justify-between h-18">
            <span className="text-[9px] uppercase tracking-wide text-neutral-500 font-bold leading-none">CROSS-CHANNEL ALERTS</span>
            <div className="flex items-baseline space-x-1.5">
              <span className="text-3xl font-medium tracking-tight text-white font-mono leading-none">
                {stats.cross_channel_alerts || 2}
              </span>
              <span className="text-[9px] text-neutral-500 font-mono">TRIGGERS</span>
            </div>
          </div>

        </div>

        {/* Action Panel Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-border border-b border-border bg-card w-full">
          
          {/* Form: Simulate Transactions */}
          <div className="bg-card p-4 space-y-3 flex flex-col justify-between rounded-none">
            <div className="space-y-0.5">
              <h3 className="text-xs font-bold text-white uppercase tracking-wide flex items-center space-x-1.5">
                <Globe className="w-3.5 h-3.5 text-neutral-550" />
                <span>Simulate Ingestion Feed</span>
              </h3>
              <p className="text-[10px] text-neutral-500 font-sans">
                Inject custom transaction streams to instantly test IP Velocity or Emulator flags.
              </p>
            </div>

            <form onSubmit={handleSimulateTransaction} className="space-y-3.5 flex-1 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col space-y-0.5">
                    <label className="text-[9px] uppercase font-mono font-bold text-neutral-400">Sender Account ID</label>
                    <input
                      type="text"
                      value={txSender}
                      onChange={(e) => setTxSender(e.target.value)}
                      required
                      className="w-full bg-secondary border-b border-transparent focus:border-primary focus:outline-none px-2 py-1 text-xs font-mono text-white rounded-none transition"
                    />
                  </div>
                  <div className="flex flex-col space-y-0.5">
                    <label className="text-[9px] uppercase font-mono font-bold text-neutral-400">Receiver Account ID</label>
                    <input
                      type="text"
                      value={txReceiver}
                      onChange={(e) => setTxReceiver(e.target.value)}
                      required
                      className="w-full bg-secondary border-b border-transparent focus:border-primary focus:outline-none px-2 py-1 text-xs font-mono text-white rounded-none transition"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="flex flex-col space-y-0.5">
                    <label className="text-[9px] uppercase font-mono font-bold text-neutral-400">Amount (USD)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={txAmount}
                      onChange={(e) => setTxAmount(e.target.value)}
                      required
                      className="w-full bg-secondary border-b border-transparent focus:border-primary focus:outline-none px-2 py-1 text-xs text-white rounded-none transition"
                    />
                  </div>
                  <div className="flex flex-col space-y-0.5">
                    <label className="text-[9px] uppercase font-mono font-bold text-neutral-400">IP Address</label>
                    <input
                      type="text"
                      value={txIp}
                      onChange={(e) => setTxIp(e.target.value)}
                      required
                      className="w-full bg-secondary border-b border-transparent focus:border-primary focus:outline-none px-2 py-1 text-xs font-mono text-white rounded-none transition"
                    />
                  </div>
                  <div className="flex flex-col space-y-0.5">
                    <label className="text-[9px] uppercase font-mono font-bold text-neutral-400">Fingerprint</label>
                    <input
                      type="text"
                      value={txFingerprint}
                      onChange={(e) => setTxFingerprint(e.target.value)}
                      required
                      className="w-full bg-secondary border-b border-transparent focus:border-primary focus:outline-none px-2 py-1 text-xs font-mono text-white rounded-none transition"
                    />
                  </div>
                </div>

                <div className="space-y-1 bg-black p-2 border border-border">
                  <div className="flex justify-between items-center text-[8px] font-mono">
                    <span className="font-bold text-neutral-500 uppercase">TIME-TO-TRANSFER</span>
                    <span className="text-primary font-bold">{txLoginDelay} SECONDS</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="10"
                    step="0.1"
                    value={txLoginDelay}
                    onChange={(e) => setTxLoginDelay(e.target.value)}
                    className="w-full accent-primary bg-secondary h-1 rounded-none appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-[7px] text-neutral-500 font-mono uppercase">
                    <span>EMULATOR DETECT (&lt; 2s)</span>
                    <span>HUMAN TOLERANCE (&gt; 2s)</span>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={txSubmitting}
                className="w-full py-2 bg-primary hover:bg-primary/90 text-[9px] font-bold text-black rounded-none transition flex items-center justify-center space-x-2 mt-2 cursor-pointer"
              >
                {txSubmitting ? (
                  <Loader className="w-3 animate-spin text-black" />
                ) : (
                  <Send className="w-3 h-3 text-black" />
                )}
                <span>TRANSMIT TEST FEED</span>
              </button>
            </form>

            {txResult && (
              <div className={`p-2.5 border text-[10px] font-mono rounded-none ${txResult.success
                ? txResult.data.is_device_farm_suspected
                  ? 'bg-black border-destructive text-destructive'
                  : 'bg-black border-primary text-primary'
                : 'bg-black border-destructive text-destructive'
                }`}>
                {txResult.success ? (
                  <div className="space-y-0.5">
                    <p className="font-bold uppercase">INGESTION COMPLETE:</p>
                    <p>STATUS: {txResult.data.is_device_farm_suspected ? '🔴 SUSPECTED DEVICE FARM FLAG' : '🟢 APPROVED'}</p>
                    {txResult.data.device_farm_reason && (
                      <p className="mt-1 text-[9px] text-neutral-400">DETAIL: {txResult.data.device_farm_reason}</p>
                    )}
                  </div>
                ) : (
                  <p>SYS_ERROR: {txResult.error}</p>
                )}
              </div>
            )}
          </div>

          {/* Sidebar Action: CSV Import */}
          <div className="bg-card p-4 flex flex-col justify-between space-y-3 rounded-none">
            <div className="space-y-3 flex-1 flex flex-col justify-between">
              <div className="space-y-0.5">
                <h3 className="text-xs font-bold text-white uppercase tracking-wide flex items-center space-x-1.5">
                  <Upload className="w-3.5 h-3.5 text-neutral-500" />
                  <span>Government Tickets CSV</span>
                </h3>
                <p className="text-[10px] text-neutral-500 font-sans leading-normal">
                  Upload static CSV files containing cyber fraud records reported by local authorities.
                </p>
              </div>

              {/* Monospace Code Terminal for CSV Schema */}
              <div className="bg-black border border-border p-2 rounded-none text-[9px] text-primary font-mono space-y-1">
                <div className="text-neutral-500 uppercase text-[7px] font-bold border-b border-border pb-1 mb-1 flex justify-between">
                  <span>CSV_SCHEMA_DEFINITION</span>
                  <span>STD_INPUT</span>
                </div>
                <code className="block select-all bg-black p-1 border border-border text-primary font-mono font-bold overflow-x-auto whitespace-nowrap">
                  ticket_id,reported_account,scam_type,report_date,details
                </code>
                <p className="text-[8px] text-neutral-500 pt-0.5">
                  Example: TKT-99,ACC_005,CryptoPhishing,2026-06-03T12:00,Targeted phishing...
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleCsvUpload}
                accept=".csv"
                className="hidden"
              />
              
              {/* Technical Dashed Dropzone */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={csvUploading}
                className="w-full py-6 border border-dashed border-border hover:border-primary/50 bg-secondary/35 text-[10px] font-mono text-neutral-400 hover:text-white transition flex flex-col items-center justify-center space-y-1.5 rounded-none cursor-pointer"
              >
                {csvUploading ? (
                  <Loader className="w-4 h-4 text-destructive animate-spin" />
                ) : (
                  <Upload className="w-4 h-4 text-neutral-500" />
                )}
                <span className="font-bold">{csvUploading ? 'PROCESSING_CSV...' : 'LOAD COMPLAINTS CSV FILE'}</span>
                <span className="text-[8px] text-neutral-550">FORMAT: RFC_4180 COMPLIANT</span>
              </button>

              {csvMessage && (
                <div className={`p-2 border text-[10px] text-center font-mono rounded-none ${csvMessage.includes('Successfully')
                  ? 'border-primary text-primary bg-black'
                  : 'border-destructive text-destructive bg-black'
                }`}>
                  {csvMessage}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar Action: Blocklist Registry */}
          <div className="bg-card p-4 flex flex-col justify-between space-y-3 rounded-none">
            <div className="space-y-2.5">
              <h3 className="text-xs font-bold text-white uppercase tracking-wide flex items-center space-x-1.5">
                <AlertOctagon className="w-3.5 h-3.5 text-neutral-500" />
                <span>Blocked Telemetry</span>
              </h3>
              <p className="text-[10px] text-neutral-500 font-sans leading-normal">
                Manage blocklisted IPs and device fingerprints to reject automated connections.
              </p>

              {/* Compact Block Form */}
              <form onSubmit={handleAddBlocklist} className="flex space-x-2">
                <select
                  value={newBlockType}
                  onChange={(e) => setNewBlockType(e.target.value)}
                  className="bg-secondary text-[10px] text-white font-mono px-1.5 py-1 border-none focus:outline-none focus:border-b focus:border-primary rounded-none cursor-pointer"
                >
                  <option value="ip">IP</option>
                  <option value="fingerprint">FPR</option>
                </select>
                <input
                  type="text"
                  placeholder="Value..."
                  value={newBlockValue}
                  onChange={(e) => setNewBlockValue(e.target.value)}
                  className="flex-1 bg-secondary border-none border-b border-transparent focus:border-b focus:border-primary text-[10px] font-mono text-white px-2 py-1 focus:outline-none rounded-none"
                />
                <button
                  type="submit"
                  disabled={blockSubmitting}
                  className="bg-secondary border border-border p-1 text-primary hover:bg-neutral-800 disabled:opacity-50 rounded-none flex items-center justify-center w-6 h-6 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>

            {/* Blocklist table */}
            <div className="flex-1 overflow-y-auto max-h-[120px] border border-border bg-black">
              <table className="w-full text-[9px] text-left font-mono">
                <thead>
                  <tr className="bg-secondary border-b border-border text-neutral-455 text-[8px] uppercase">
                    <th className="px-2 py-1">Type</th>
                    <th className="px-2 py-1">Value</th>
                    <th className="px-2 py-1 text-right">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {blocklist.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-2 py-3 text-center text-neutral-600 uppercase">NO BLOCKED ENTRIES</td>
                    </tr>
                  ) : (
                    blocklist.map((item, idx) => (
                      <tr key={idx} className="hover:bg-secondary/30 text-white">
                        <td className="px-2 py-1 uppercase font-bold text-neutral-500">{item.type}</td>
                        <td className="px-2 py-1 text-neutral-300 max-w-[80px] truncate">{item.value}</td>
                        <td className="px-2 py-1 text-right text-neutral-400 max-w-[100px] truncate">{item.reason}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* Condensed Data Table (Bottom Section) with Zebra Striping */}
        <div className="bg-card p-4 space-y-2 rounded-none w-full border-t border-border">
          <div className="flex items-center justify-between border-b border-border pb-1.5">
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

          <div className="overflow-x-auto">
            <table className="w-full text-[10px] text-left font-mono">
              <thead>
                <tr className="border-b border-border text-neutral-500 uppercase text-[8px] tracking-wide">
                  <th className="py-1 px-2.5">Flow</th>
                  <th className="py-1 px-2.5">Sender ID</th>
                  <th className="py-1 px-2.5">Receiver ID</th>
                  <th className="py-1 px-2.5 text-right">Volume</th>
                  <th className="py-1 px-2.5">Telemetry</th>
                  <th className="py-1 px-2.5 text-right">Audit Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-4 text-center text-neutral-600 uppercase">NO TRANSACTIONS IN FEED</td>
                  </tr>
                ) : (
                  transactions.map((tx, idx) => (
                    <tr key={idx} className="hover:bg-neutral-800/30 text-white even:bg-secondary/25">
                      <td className="py-1 px-2.5 font-semibold">
                        {tx.is_device_farm_suspected ? (
                          <span className="text-destructive font-mono">🔴 FLAGGED</span>
                        ) : (
                          <span className="text-primary font-mono">🟢 APPROVED</span>
                        )}
                      </td>
                      <td className="py-1 px-2.5 text-neutral-200">{tx.sender_account}</td>
                      <td className="py-1 px-2.5 text-neutral-200">{tx.receiver_account}</td>
                      <td className="py-1 px-2.5 text-right font-medium text-white">
                        ${tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-1 px-2.5 text-neutral-400 font-mono text-[9px] truncate max-w-[200px]">
                        IP: {tx.ip_address} | FP: {tx.device_fingerprint}
                      </td>
                      <td className="py-1 px-2.5 text-right">
                        {tx.is_device_farm_suspected ? (
                          <button
                            onClick={() => handleQuickBlock(tx.ip_address, 'ip', 'Linked to suspected device farm')}
                            className="text-[9px] bg-secondary border border-border text-destructive hover:bg-destructive hover:text-white px-2 py-0.5 transition font-semibold rounded-none cursor-pointer"
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
