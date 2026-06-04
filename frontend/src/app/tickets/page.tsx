'use client';

import React, { useRef, useState } from 'react';
import { Upload, Loader } from 'lucide-react';

export default function TicketsPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [csvUploading, setCsvUploading] = useState(false);
  const [csvMessage, setCsvMessage] = useState('');

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

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold uppercase tracking-wide text-white mb-6">Government Tickets</h1>

      <div className="bg-card p-6 border border-border max-w-2xl">
        <div className="space-y-4 mb-6">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-white uppercase tracking-wide flex items-center space-x-2">
              <Upload className="w-4 h-4 text-neutral-500" />
              <span>Upload CSV Data</span>
            </h3>
            <p className="text-xs text-neutral-500 font-sans leading-relaxed">
              Upload static CSV files containing cyber fraud records reported by local authorities.
            </p>
          </div>

          <div className="bg-black border border-border p-4 text-[10px] text-primary font-mono space-y-2">
            <div className="text-neutral-500 uppercase text-[9px] font-bold border-b border-border pb-2 mb-2 flex justify-between">
              <span>CSV_SCHEMA_DEFINITION</span>
              <span>STD_INPUT</span>
            </div>
            <code className="block select-all bg-black p-2 border border-border text-primary font-mono font-bold overflow-x-auto whitespace-nowrap">
              ticket_id,reported_account,scam_type,report_date,details
            </code>
            <p className="text-[10px] text-neutral-500 pt-2">
              Example: TKT-99,ACC_005,CryptoPhishing,2026-06-03T12:00,Targeted phishing...
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
            className="w-full py-10 border-2 border-dashed border-border hover:border-primary/50 bg-secondary/35 text-xs font-mono text-neutral-400 hover:text-white transition flex flex-col items-center justify-center space-y-3 cursor-pointer"
          >
            {csvUploading ? (
              <Loader className="w-6 h-6 text-destructive animate-spin" />
            ) : (
              <Upload className="w-6 h-6 text-neutral-500" />
            )}
            <span className="font-bold text-sm tracking-wide">
              {csvUploading ? 'PROCESSING_CSV...' : 'LOAD COMPLAINTS CSV FILE'}
            </span>
            <span className="text-[10px] text-neutral-550">FORMAT: RFC_4180 COMPLIANT</span>
          </button>

          {csvMessage && (
            <div className={`mt-4 p-4 border text-xs text-center font-mono ${csvMessage.includes('Successfully')
              ? 'border-primary text-primary bg-black'
              : 'border-destructive text-destructive bg-black'
            }`}>
              {csvMessage}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
