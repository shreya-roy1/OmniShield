"use client";

import { useState } from "react";
import { Brain, RefreshCw, AlertTriangle, CheckCircle, BarChart3 } from "lucide-react";

export default function MLAnalysisPage() {
  const [loading, setLoading] = useState(false);
  const [sampleData, setSampleData] = useState<any>(null);
  const [prediction, setPrediction] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchSampleAndPredict = async () => {
    setLoading(true);
    setError(null);
    setSampleData(null);
    setPrediction(null);
    
    try {
      // 1. Fetch random sample from dataset
      const sampleRes = await fetch("http://localhost:8000/api/ml-sample");
      if (!sampleRes.ok) throw new Error("Failed to fetch ML sample. Make sure DataSet.csv exists and backend is running.");
      
      const sample = await sampleRes.json();
      setSampleData(sample);

      // 2. Predict using the features
      const predictRes = await fetch("http://localhost:8000/api/ml-classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sample.features)
      });
      
      if (!predictRes.ok) throw new Error("Prediction failed. Model may not be loaded.");
      const result = await predictRes.json();
      setPrediction(result);
      
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-white flex items-center gap-3">
            <Brain className="w-10 h-10 text-purple-400" />
            AI/ML Mule Classification
          </h1>
          <p className="text-zinc-400 mt-2 text-lg">
            Detect suspicious accounts using high-dimensional feature engineering and predictive risk scoring.
          </p>
        </div>
        <button
          onClick={fetchSampleAndPredict}
          disabled={loading}
          className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2 transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Analyzing..." : "Load Random Test Sample"}
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-4 rounded-lg flex items-start gap-3">
          <AlertTriangle className="w-6 h-6 flex-shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {prediction && sampleData && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* Risk Score Card */}
          <div className="md:col-span-1 bg-zinc-900 border border-zinc-800 rounded-xl p-8 flex flex-col items-center justify-center text-center shadow-xl">
            <h2 className="text-xl font-semibold text-zinc-300 mb-6">Mule Probability Score</h2>
            
            <div className="relative w-48 h-48 mb-6">
              {/* Simple CSS Gauge */}
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="45" fill="none" stroke="#27272a" strokeWidth="10" />
                <circle 
                  cx="50" cy="50" r="45" fill="none" 
                  stroke={prediction.is_suspicious ? "#ef4444" : "#22c55e"} 
                  strokeWidth="10" 
                  strokeDasharray={`${prediction.mule_probability * 283} 283`}
                  className="transition-all duration-1000 ease-out"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-5xl font-bold text-white">
                  {(prediction.mule_probability * 100).toFixed(1)}%
                </span>
                <span className="text-zinc-500 text-sm mt-1">Confidence</span>
              </div>
            </div>

            {prediction.is_suspicious ? (
              <div className="bg-red-500/20 text-red-400 px-4 py-2 rounded-full font-bold flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" /> SUSPICIOUS MULE
              </div>
            ) : (
              <div className="bg-green-500/20 text-green-400 px-4 py-2 rounded-full font-bold flex items-center gap-2">
                <CheckCircle className="w-5 h-5" /> LEGITIMATE
              </div>
            )}
            
            {sampleData.actual_target !== null && (
              <div className="mt-4 text-sm text-zinc-400">
                Actual Ground Truth: <span className="font-mono text-white">{sampleData.actual_target === 1 ? "MULE (1)" : "NORMAL (0)"}</span>
              </div>
            )}
          </div>

          {/* Feature Importance XAI Chart */}
          <div className="md:col-span-2 bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-xl">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-zinc-800">
              <BarChart3 className="w-6 h-6 text-purple-400" />
              <h2 className="text-xl font-semibold text-white">Explainable AI: Key Contributors</h2>
            </div>
            
            <div className="space-y-4">
              {prediction.top_contributing_features.map((feat: any, idx: number) => {
                const importancePercent = feat.importance * 100;
                // Highlight specific hackathon features if they appear
                const isKeyHackathonFeature = ['F115', 'F321', 'F527', 'F531', 'F670', 'F1692', 'F2082', 'F2122', 'F2582', 'F2678', 'F2737', 'F2956', 'F3043', 'F3836', 'F3887', 'F3889', 'F3891', 'F3894'].includes(feat.feature);
                
                return (
                  <div key={idx} className="relative">
                    <div className="flex justify-between text-sm mb-1">
                      <span className={`font-mono font-medium ${isKeyHackathonFeature ? 'text-purple-400' : 'text-zinc-300'}`}>
                        {feat.feature} {isKeyHackathonFeature && '★'}
                      </span>
                      <span className="text-zinc-500">
                        Value: {feat.value !== null ? feat.value.toFixed(4) : "NaN"}
                      </span>
                    </div>
                    <div className="w-full bg-zinc-800 rounded-full h-3 overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${isKeyHackathonFeature ? 'bg-purple-500' : 'bg-zinc-600'}`}
                        style={{ width: `${Math.max(importancePercent, 2)}%` }} // At least 2% for visibility
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-zinc-500 mt-6 text-center">
              Features denoted with <span className="text-purple-400 font-bold">★</span> are key indicators flagged by banking consortiums.
            </p>
          </div>
          
        </div>
      )}

      {!prediction && !loading && !error && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-16 text-center flex flex-col items-center shadow-xl">
          <Brain className="w-20 h-20 text-zinc-700 mb-6" />
          <h3 className="text-2xl font-semibold text-zinc-300 mb-2">Ready for Machine Learning Analysis</h3>
          <p className="text-zinc-500 max-w-lg">
            Click the button above to load an anonymous 3,924-dimensional feature vector from the dataset and evaluate it through the trained AI/ML classifier.
          </p>
        </div>
      )}
    </div>
  );
}
