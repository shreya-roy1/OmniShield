'use client';

import React, { useState } from 'react';
import { Globe, Send, Loader } from 'lucide-react';

export default function SimulatorPage() {
  const [txSender, setTxSender] = useState('ACC_001');
  const [txReceiver, setTxReceiver] = useState('ACC_002');
  const [txAmount, setTxAmount] = useState('250.00');
  const [txIp, setTxIp] = useState('192.168.1.100');
  const [txFingerprint, setTxFingerprint] = useState('fingerprint_desktop_chrome');
  const [txLoginDelay, setTxLoginDelay] = useState('1.5');
  const [txSubmitting, setTxSubmitting] = useState(false);
  const [txResult, setTxResult] = useState<any>(null);

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

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold uppercase tracking-wide text-white mb-6">Simulate Ingestion Feed</h1>
      
      <div className="bg-card p-6 border border-border max-w-2xl">
        <div className="space-y-1 mb-6">
          <h3 className="text-sm font-bold text-white uppercase tracking-wide flex items-center space-x-2">
            <Globe className="w-4 h-4 text-neutral-500" />
            <span>Transaction Parameters</span>
          </h3>
          <p className="text-xs text-neutral-500 font-sans">
            Inject custom transaction streams to instantly test IP Velocity or Emulator flags.
          </p>
        </div>

        <form onSubmit={handleSimulateTransaction} className="space-y-5">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col space-y-1">
                <label className="text-[10px] uppercase font-mono font-bold text-neutral-400">Sender Account ID</label>
                <input
                  type="text"
                  value={txSender}
                  onChange={(e) => setTxSender(e.target.value)}
                  required
                  className="w-full bg-secondary border-b border-transparent focus:border-primary focus:outline-none px-3 py-2 text-sm font-mono text-white transition"
                />
              </div>
              <div className="flex flex-col space-y-1">
                <label className="text-[10px] uppercase font-mono font-bold text-neutral-400">Receiver Account ID</label>
                <input
                  type="text"
                  value={txReceiver}
                  onChange={(e) => setTxReceiver(e.target.value)}
                  required
                  className="w-full bg-secondary border-b border-transparent focus:border-primary focus:outline-none px-3 py-2 text-sm font-mono text-white transition"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="flex flex-col space-y-1">
                <label className="text-[10px] uppercase font-mono font-bold text-neutral-400">Amount (USD)</label>
                <input
                  type="number"
                  step="0.01"
                  value={txAmount}
                  onChange={(e) => setTxAmount(e.target.value)}
                  required
                  className="w-full bg-secondary border-b border-transparent focus:border-primary focus:outline-none px-3 py-2 text-sm text-white transition"
                />
              </div>
              <div className="flex flex-col space-y-1">
                <label className="text-[10px] uppercase font-mono font-bold text-neutral-400">IP Address</label>
                <input
                  type="text"
                  value={txIp}
                  onChange={(e) => setTxIp(e.target.value)}
                  required
                  className="w-full bg-secondary border-b border-transparent focus:border-primary focus:outline-none px-3 py-2 text-sm font-mono text-white transition"
                />
              </div>
              <div className="flex flex-col space-y-1">
                <label className="text-[10px] uppercase font-mono font-bold text-neutral-400">Fingerprint</label>
                <input
                  type="text"
                  value={txFingerprint}
                  onChange={(e) => setTxFingerprint(e.target.value)}
                  required
                  className="w-full bg-secondary border-b border-transparent focus:border-primary focus:outline-none px-3 py-2 text-sm font-mono text-white transition"
                />
              </div>
            </div>

            <div className="space-y-2 bg-black p-4 border border-border">
              <div className="flex justify-between items-center text-[10px] font-mono">
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
                className="w-full accent-primary bg-secondary h-1.5 appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-[8px] text-neutral-500 font-mono uppercase mt-2">
                <span>EMULATOR DETECT (&lt; 2s)</span>
                <span>HUMAN TOLERANCE (&gt; 2s)</span>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={txSubmitting}
            className="w-full py-3 bg-primary hover:bg-primary/90 text-xs font-bold text-black transition flex items-center justify-center space-x-2 cursor-pointer mt-4"
          >
            {txSubmitting ? (
              <Loader className="w-4 h-4 animate-spin text-black" />
            ) : (
              <Send className="w-4 h-4 text-black" />
            )}
            <span>TRANSMIT TEST FEED</span>
          </button>
        </form>

        {txResult && (
          <div className={`mt-6 p-4 border text-xs font-mono ${txResult.success
            ? txResult.data.is_device_farm_suspected
              ? 'bg-black border-destructive text-destructive'
              : 'bg-black border-primary text-primary'
            : 'bg-black border-destructive text-destructive'
            }`}>
            {txResult.success ? (
              <div className="space-y-1">
                <p className="font-bold uppercase text-sm mb-2">INGESTION COMPLETE:</p>
                <p>STATUS: {txResult.data.is_device_farm_suspected ? '🔴 SUSPECTED DEVICE FARM FLAG' : '🟢 APPROVED'}</p>
                {txResult.data.device_farm_reason && (
                  <p className="mt-2 text-[10px] text-neutral-400">DETAIL: {txResult.data.device_farm_reason}</p>
                )}
              </div>
            ) : (
              <p>SYS_ERROR: {txResult.error}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
