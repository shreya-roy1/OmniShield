'use client';

import React, { useState, useEffect } from 'react';
import { AlertOctagon, Plus } from 'lucide-react';

interface BlocklistEntry {
  id: number;
  value: string;
  type: string;
  reason: string;
}

export default function BlocklistPage() {
  const [blocklist, setBlocklist] = useState<BlocklistEntry[]>([]);
  const [newBlockValue, setNewBlockValue] = useState('');
  const [newBlockType, setNewBlockType] = useState('ip');
  const [newBlockReason, setNewBlockReason] = useState('Identified anomaly pattern');
  const [blockSubmitting, setBlockSubmitting] = useState(false);
  const [blockMessage, setBlockMessage] = useState('');

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
    fetchBlocklist();
    const interval = setInterval(() => {
      fetchBlocklist();
    }, 4000);
    return () => clearInterval(interval);
  }, []);

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

  return (
    <div className="p-6 h-full flex flex-col">
      <h1 className="text-xl font-bold uppercase tracking-wide text-white mb-6">Blocklist Registry</h1>

      <div className="bg-card p-6 border border-border flex-1 flex flex-col min-h-0">
        <div className="mb-6 space-y-2">
          <h3 className="text-sm font-bold text-white uppercase tracking-wide flex items-center space-x-2">
            <AlertOctagon className="w-4 h-4 text-neutral-500" />
            <span>Blocked Telemetry</span>
          </h3>
          <p className="text-xs text-neutral-500 font-sans leading-relaxed">
            Manage blocklisted IPs and device fingerprints to reject automated connections.
          </p>
        </div>

        <form onSubmit={handleAddBlocklist} className="flex space-x-3 mb-6">
          <select
            value={newBlockType}
            onChange={(e) => setNewBlockType(e.target.value)}
            className="bg-secondary text-xs text-white font-mono px-3 py-2 border border-transparent focus:outline-none focus:border-primary cursor-pointer"
          >
            <option value="ip">IP</option>
            <option value="fingerprint">FPR</option>
          </select>
          <input
            type="text"
            placeholder="Value..."
            value={newBlockValue}
            onChange={(e) => setNewBlockValue(e.target.value)}
            className="flex-1 bg-secondary border border-transparent focus:border-primary text-xs font-mono text-white px-4 py-2 focus:outline-none"
          />
          <button
            type="submit"
            disabled={blockSubmitting}
            className="bg-secondary border border-border px-4 py-2 text-primary hover:bg-neutral-800 disabled:opacity-50 flex items-center justify-center space-x-2 cursor-pointer transition"
          >
            <Plus className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wide">Add Block</span>
          </button>
        </form>

        {blockMessage && (
          <div className="mb-4 p-3 bg-black border border-primary text-primary text-xs font-mono">
            {blockMessage}
          </div>
        )}

        <div className="flex-1 overflow-y-auto border border-border bg-black min-h-0">
          <table className="w-full text-xs text-left font-mono">
            <thead className="sticky top-0 bg-secondary z-10">
              <tr className="border-b border-border text-neutral-400 text-[10px] uppercase tracking-wide">
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="px-4 py-3 font-semibold">Value</th>
                <th className="px-4 py-3 font-semibold">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {blocklist.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-neutral-600 uppercase tracking-widest text-[10px]">
                    NO BLOCKED ENTRIES
                  </td>
                </tr>
              ) : (
                blocklist.map((item, idx) => (
                  <tr key={idx} className="hover:bg-secondary/30 text-white transition-colors">
                    <td className="px-4 py-3 uppercase font-bold text-neutral-500 w-24">{item.type}</td>
                    <td className="px-4 py-3 text-neutral-300">{item.value}</td>
                    <td className="px-4 py-3 text-neutral-400">{item.reason}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
