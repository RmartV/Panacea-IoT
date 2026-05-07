import React, { useState, useEffect, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Settings, Activity, Thermometer, Droplets, Sun, Power, Database, Key, Cpu } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function App() {
  // 1. Dynamic Configuration State (Persisted in Local Storage)
  const [config, setConfig] = useState({
    url: localStorage.getItem('sb_url') || '',
    key: localStorage.getItem('sb_key') || '',
  });
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  
  // 2. Sensor Data State (Matches your Supabase Columns)
  const [data, setData] = useState({ 
    node_name: 'Awaiting Data...', 
    temperature: 0, 
    humidity: 0, 
    light_level: 0, 
    led_status: false 
  });
  const [logs, setLogs] = useState([]);

  // Helper function to push logs to the UI
  function addLog(msg) {
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 6));
  }

  // 3. Initialize Supabase Client whenever keys change
  const supabase = useMemo(() => {
    if (config.url && config.key) {
      addLog(`System: Connecting to database...`);
      return createClient(config.url, config.key);
    }
    return null;
  }, [config]);

  // 4. Listen for Real-Time Updates from Supabase
  useEffect(() => {
    if (!supabase) return;

    // Fetch the absolute latest row first so you aren't waiting for the 10-second Arduino delay
    const fetchInitialData = async () => {
      const { data: initialData, error } = await supabase
        .from('sensor_data')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (initialData) {
        setData(initialData);
        addLog(`System: Fetched latest state for ${initialData.node_name}`);
      }
    };
    
    fetchInitialData();

    // Subscribe to new rows being inserted by n8n
    const subscription = supabase
      .channel('sensor-updates')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sensor_data' }, (payload) => {
        setData(payload.new);
        addLog(`Data: Received telemetry from ${payload.new.node_name} (Temp: ${payload.new.temperature}°C)`);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') addLog(`Status: Real-time telemetry connection ACTIVE.`);
      });

    return () => { supabase.removeChannel(subscription); };
  }, [supabase]);

  // Save Keys to Browser Storage
  const saveConfig = (e) => {
    e.preventDefault();
    localStorage.setItem('sb_url', config.url);
    localStorage.setItem('sb_key', config.key);
    setIsConfigOpen(false);
    addLog("Config: New Supabase credentials applied.");
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 p-6 md:p-12 font-sans">
      <div className="max-w-5xl mx-auto">
        
        {/* Header */}
        <header className="flex justify-between items-center mb-10 border-b border-slate-200 pb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-800 mb-1">Panacea Edge Dashboard</h1>
            <p className="text-slate-500 text-sm flex items-center gap-2">
              <Cpu size={14} className="text-blue-500" /> Active Node: <span className="font-semibold text-slate-700">{data.node_name}</span>
            </p>
          </div>
          <button 
            onClick={() => setIsConfigOpen(!isConfigOpen)}
            className={`p-3 rounded-full transition-all ${isConfigOpen ? 'bg-slate-800 text-white shadow-md' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm'}`}
          >
            <Settings size={22} />
          </button>
        </header>

        {/* Dynamic Config Drawer */}
        <AnimatePresence>
          {isConfigOpen && (
            <motion.div 
              initial={{ height: 0, opacity: 0, y: -10 }}
              animate={{ height: 'auto', opacity: 1, y: 0 }}
              exit={{ height: 0, opacity: 0, y: -10 }}
              className="overflow-hidden bg-white border border-slate-200 rounded-2xl mb-8 shadow-sm"
            >
              <form onSubmit={saveConfig} className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase text-slate-400 flex items-center gap-2">
                    <Database size={12} /> Supabase Project URL
                  </label>
                  <input 
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 ring-blue-500/20 focus:border-blue-500 transition-all"
                    value={config.url}
                    onChange={(e) => setConfig({...config, url: e.target.value})}
                    placeholder="https://xyz.supabase.co"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase text-slate-400 flex items-center gap-2">
                    <Key size={12} /> Supabase Anon Key
                  </label>
                  <input 
                    type="password"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 ring-blue-500/20 focus:border-blue-500 transition-all"
                    value={config.key}
                    onChange={(e) => setConfig({...config, key: e.target.value})}
                    placeholder="eyJhbG..."
                    required
                  />
                </div>
                <button type="submit" className="md:col-span-2 bg-slate-900 text-white text-sm py-3 font-medium rounded-lg hover:bg-slate-800 transition-colors shadow-sm">
                  Initialize Connection
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <StatCard icon={<Thermometer />} label="Temperature" value={`${data.temperature}°C`} color="text-orange-500" bg="bg-orange-50" />
          <StatCard icon={<Droplets />} label="Humidity" value={`${data.humidity}%`} color="text-blue-500" bg="bg-blue-50" />
          <StatCard icon={<Sun />} label="Light Level" value={data.light_level} color="text-yellow-500" bg="bg-yellow-50" />
        </div>

        {/* Console / Control Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Logs Terminal */}
          <div className="lg:col-span-2 bg-[#0F172A] rounded-2xl p-6 shadow-xl border border-slate-800 flex flex-col h-64">
            <h3 className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-4 flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              Live System Logs
            </h3>
            <div className="space-y-2 font-mono text-xs overflow-y-auto flex-1">
              {logs.length > 0 ? logs.map((log, i) => (
                <div key={i} className="text-slate-300 border-l-2 border-slate-700 pl-3 py-1 bg-slate-800/30 rounded-r-sm">{log}</div>
              )) : <div className="text-slate-500 italic">Awaiting API configuration... Click the settings icon above.</div>}
            </div>
          </div>

          {/* Actuator Panel */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between h-64">
            <div>
              <div className="flex justify-between items-start mb-1">
                <h3 className="font-bold text-slate-800 text-lg">Physical Actuator</h3>
                <div className={`p-2 rounded-md ${data.led_status ? 'bg-yellow-100 text-yellow-600' : 'bg-slate-100 text-slate-400'}`}>
                  <Power size={18} />
                </div>
              </div>
              <p className="text-slate-400 text-xs mb-6 leading-relaxed">Sends override command via webhook to n8n, targeting edge device.</p>
            </div>
            
            <button className={`w-full p-4 rounded-xl flex items-center justify-center gap-2 transition-all font-semibold shadow-sm border ${
              data.led_status 
              ? 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700' 
              : 'bg-slate-900 hover:bg-slate-800 border-slate-900 text-white'
            }`}>
              {data.led_status ? 'Turn Off LED' : 'Turn On LED'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Reusable UI Component for the Cards
function StatCard({ icon, label, value, color, bg }) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-5 hover:border-slate-300 transition-colors">
      <div className={`${bg} ${color} p-4 rounded-xl`}>
        {React.cloneElement(icon, { size: 28, strokeWidth: 2 })}
      </div>
      <div>
        <div className="text-3xl font-bold text-slate-800 tracking-tight">{value}</div>
        <div className="text-slate-400 text-xs font-semibold uppercase mt-1 tracking-wider">{label}</div>
      </div>
    </div>
  );
}