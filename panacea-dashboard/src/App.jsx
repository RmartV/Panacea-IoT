import React, { useState, useEffect, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Settings, Database, Key } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Chart } from 'chart.js/auto';

export default function App() {
  // 1. Dynamic Configuration State (Persisted in Local Storage)
  const [config, setConfig] = useState({
    url: localStorage.getItem('sb_url') || '',
    key: localStorage.getItem('sb_key') || '',
  });
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  
  // 2. Multi-node Data State
  const [nodes, setNodes] = useState({});
  const [nodeHistory, setNodeHistory] = useState({});
  const [activeChartTab, setActiveChartTab] = useState({});
  const [logs, setLogs] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  
  // Helper function to push logs to the UI
  function addLog(type, nodeName, msg, val) {
    const ts = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLogs(prev => [{ ts, type, nodeName, msg, val }, ...prev].slice(0, 20));
  }

  // 3. Initialize Supabase Client whenever keys change
  const supabase = useMemo(() => {
    if (config.url && config.key) {
      addLog('SYS', 'SYSTEM', 'Connecting to database', '');
      return createClient(config.url, config.key);
    }
    return null;
  }, [config]);

  // 4. Listen for Real-Time Updates from Supabase
  useEffect(() => {
    if (!supabase) return;

    const fetchInitialData = async () => {
      const { data: allData, error } = await supabase
        .from('sensor_logs')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        addLog('ERROR', 'SYSTEM', 'Failed to fetch data', error.message);
        return;
      }
      
      if (allData && allData.length > 0) {
        const uniqueNodes = {};
        const newHistory = {};
        
        // Group by node_name and take the latest for each
        allData.forEach(row => {
          // Skip unknown_node
          if (row.node_name === 'unknown_node') return;
          
          if (!uniqueNodes[row.node_name]) {
            const timestamp = new Date(row.created_at).getTime();
            uniqueNodes[row.node_name] = row;
            newHistory[row.node_name] = {
              temperature: row.temperature ? [{ x: timestamp, y: parseFloat(row.temperature) || 0 }] : [],
              humidity: row.humidity ? [{ x: timestamp, y: parseFloat(row.humidity) || 0 }] : [],
              light_level: row.light_level ? [{ x: timestamp, y: parseFloat(row.light_level) || 0 }] : []
            };
          }
        });
        
        setNodes(uniqueNodes);
        setNodeHistory(newHistory);
        
        // Initialize active chart tabs
        const tabs = {};
        Object.keys(uniqueNodes).forEach(nodeName => {
          tabs[nodeName] = 'temperature';
        });
        setActiveChartTab(tabs);
        
        addLog('SYS', 'SYSTEM', `Loaded ${Object.keys(uniqueNodes).length} unique node(s)`, '');
      } else {
        addLog('SYS', 'SYSTEM', 'No data found in sensor_logs table', '');
      }
    };
    
    fetchInitialData();

    // Subscribe to new rows being inserted
    const subscription = supabase
      .channel('sensor-updates')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sensor_logs' }, (payload) => {
        const newData = payload.new;
        
        // IGNORE "unknown_node" to keep the dashboard clean
        if (newData.node_name === 'unknown_node') return;

        setNodes(prev => ({
          ...prev,
          [newData.node_name]: { ...newData, lastUpdate: new Date().getTime() }
        }));

        // Initialize or update history
        setNodeHistory(prev => {
          const nodeHist = prev[newData.node_name] || {
            temperature: [],
            humidity: [],
            light_level: []
          };
          
          const now = new Date(newData.created_at).getTime();
          nodeHist.temperature.push({ x: now, y: parseFloat(newData.temperature) || 0 });
          nodeHist.humidity.push({ x: now, y: parseFloat(newData.humidity) || 0 });
          nodeHist.light_level.push({ x: now, y: parseFloat(newData.light_level) || 0 });
          
          // Keep only last 40 points
          ['temperature', 'humidity', 'light_level'].forEach(metric => {
            if (nodeHist[metric].length > 40) {
              nodeHist[metric] = nodeHist[metric].slice(-40);
            }
          });
          
          return {
            ...prev,
            [newData.node_name]: nodeHist
          };
        });

        // Initialize chart tab if needed
        setActiveChartTab(prev => {
          if (!prev[newData.node_name]) {
            return { ...prev, [newData.node_name]: 'temperature' };
          }
          return prev;
        });

        addLog('DATA', newData.node_name, `→ temp ${newData.temperature}°C · RH ${newData.humidity}% · lux ${newData.light_level}`, '');
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
          addLog('SYS', 'SYSTEM', 'Real-time telemetry connection ACTIVE', '');
        }
      });

    return () => { supabase.removeChannel(subscription); };
  }, [supabase]);

  // Save Keys to Browser Storage
  const saveConfig = (e) => {
    e.preventDefault();
    localStorage.setItem('sb_url', config.url);
    localStorage.setItem('sb_key', config.key);
    setIsConfigOpen(false);
    addLog("CFG", "SYSTEM", "credentials updated", config.url.split('/').pop() || 'local');
  };

  const onlineNodes = Object.values(nodes).filter(n => n.online).length;
  const totalNodes = Object.keys(nodes).length;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6 md:p-8">
      <div className="max-w-full mx-auto">
        
        {/* Header */}
        <div className="flex justify-between items-end mb-6 pb-4 border-b border-slate-700">
          <div>
            <h1 className="text-2xl font-bold tracking-tight mb-1">Panacea Edge</h1>
            <div className="flex items-center gap-3">
              <p className="text-sm text-slate-400 font-mono">LIVE · {onlineNodes}/{totalNodes} NODES · LAST SYNC 0s AGO</p>
              <span className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full font-mono ${
                isConnected 
                  ? 'bg-emerald-900/30 text-emerald-300' 
                  : 'bg-slate-700 text-slate-400'
              }`}>
                <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`}></span>
                {isConnected ? 'CONNECTED' : 'DISCONNECTED'}
              </span>
            </div>
          </div>
          <button 
            onClick={() => setIsConfigOpen(!isConfigOpen)}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-slate-600 rounded-md hover:bg-slate-800 transition-colors"
          >
            <Settings size={16} />
            Configure
          </button>
        </div>

        {/* Dynamic Config Drawer */}
        <AnimatePresence>
          {isConfigOpen && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden grid grid-cols-1 md:grid-cols-2 gap-3 p-4 mb-6 bg-slate-800 border border-slate-700 rounded-lg"
            >
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-2">Supabase URL</label>
                <input 
                  className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-slate-400"
                  value={config.url}
                  onChange={(e) => setConfig({...config, url: e.target.value})}
                  placeholder="https://xyz.supabase.co"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase text-slate-400 mb-2 block">Anon Key</label>
                <input 
                  type="password"
                  className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-slate-400"
                  value={config.key}
                  onChange={(e) => setConfig({...config, key: e.target.value})}
                  placeholder="eyJhbG..."
                  required
                />
              </div>
              <button 
                onClick={saveConfig}
                className="md:col-span-2 bg-slate-600 hover:bg-slate-500 text-white text-sm py-2 font-medium rounded transition-colors"
              >
                Initialize connection →
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Nodes Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {Object.entries(nodes).length > 0 ? (
            Object.entries(nodes).map(([nodeName, data]) => (
              <NodeCard 
                key={nodeName}
                nodeName={nodeName}
                data={data}
                history={nodeHistory[nodeName] || { temperature: [], humidity: [], light_level: [] }}
                activeTab={activeChartTab[nodeName] || 'temperature'}
                onTabChange={(tab) => setActiveChartTab(prev => ({ ...prev, [nodeName]: tab }))}
              />
            ))
          ) : (
            <div className="col-span-full py-16 text-center text-slate-400">
              <p className="text-sm mb-2">
                {isConnected ? '✓ Connected to database · Awaiting sensor data...' : 'Configure Supabase to start receiving data'}
              </p>
              <p className="text-xs text-slate-500">Nodes will appear here when data is received from IoT devices</p>
            </div>
          )}
        </div>

        {/* System Log */}
        <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-slate-700">
            <span className="text-xs font-semibold uppercase text-slate-400">System log</span>
            <span className="text-xs bg-slate-700 rounded-full px-2 py-1 text-slate-300">{logs.length} events</span>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {logs.length > 0 ? logs.map((log, i) => (
              <div key={i} className="px-4 py-2 text-xs font-mono text-slate-300 border-b border-slate-700/50 hover:bg-slate-700/50 last:border-b-0">
                <span className="text-slate-500">{log.ts}</span>
                {' '}
                <span className="text-slate-100 font-semibold">{log.nodeName}</span>
                {' '}
                <span className="text-slate-400">{log.msg}</span>
                {log.val && <span className="text-emerald-400"> {log.val}</span>}
              </div>
            )) : (
              <div className="px-4 py-3 text-xs text-slate-500">Awaiting API configuration…</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Node Card Component
function NodeCard({ nodeName, data, history, activeTab, onTabChange }) {
  const chartRef = React.useRef({});

  React.useEffect(() => {
    // Build/update chart when data or active tab changes
    if (!history[activeTab] || history[activeTab].length === 0) return;

    const canvasId = `chart-${nodeName.replace(/\s/g, '-')}`;
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const metrics = {
      temperature: { label: 'Temp', unit: '°C', color: '#D85A30', fill: 'rgba(216,90,48,0.1)' },
      humidity: { label: 'RH', unit: '%', color: '#1D9E75', fill: 'rgba(29,158,117,0.1)' },
      light_level: { label: 'Lux', unit: '', color: '#BA7517', fill: 'rgba(186,117,23,0.1)' }
    };

    const cfg = metrics[activeTab];
    
    if (chartRef.current[nodeName]) {
      chartRef.current[nodeName].destroy();
    }

    const ctx = canvas.getContext('2d');
    chartRef.current[nodeName] = new Chart(ctx, {
      type: 'line',
      data: {
        datasets: [{
          data: history[activeTab],
          borderColor: cfg.color,
          backgroundColor: cfg.fill,
          borderWidth: 1.5,
          pointRadius: 0,
          fill: true,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            mode: 'nearest',
            intersect: false,
            backgroundColor: 'rgba(0,0,0,0.75)',
            padding: 6,
            cornerRadius: 4,
            titleFont: { size: 10 },
            bodyFont: { size: 11, family: 'IBM Plex Mono' },
            callbacks: { label: c => c.parsed.y.toFixed(1) + cfg.unit }
          }
        },
        scales: {
          x: { type: 'linear', display: false },
          y: {
            display: true,
            position: 'right',
            grid: { color: 'rgba(128,128,128,0.1)', lineWidth: 0.5 },
            border: { display: false },
            ticks: {
              font: { size: 9 },
              color: 'rgba(128,128,128,0.6)',
              maxTicksLimit: 3,
              callback: v => v.toFixed(0) + cfg.unit
            }
          }
        }
      }
    });
  }, [history, activeTab, nodeName]);

  const isOnline = data.online !== false; // Default to true if not specified
  const powerStatus = data.power_status || 'OFF';
  const ledStatus = data.led_status ? 'ON' : 'OFF';
  const statusDot = isOnline ? 'bg-emerald-500' : 'bg-red-500';

  return (
    <div className="border border-slate-700 rounded-lg overflow-hidden bg-slate-800">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-slate-700">
        <span className="font-mono text-sm font-semibold text-slate-100">{nodeName}</span>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-1 rounded-full font-mono ${
            powerStatus === 'ON' ? 'bg-emerald-900/30 text-emerald-300' : 'bg-slate-700 text-slate-400'
          }`}>
            {powerStatus === 'ON' ? '● PWR ON' : '○ PWR OFF'}
          </span>
          <span className={`text-xs px-2 py-1 rounded-full font-mono ${
            ledStatus === 'ON' ? 'bg-yellow-900/30 text-yellow-300' : 'bg-slate-700 text-slate-400'
          }`}>
            {ledStatus === 'ON' ? '💡 LED ON' : '💡 LED OFF'}
          </span>
          <div className={`w-2 h-2 rounded-full ${statusDot} ${isOnline ? 'animate-pulse' : ''}`}></div>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-3 gap-2 p-3 border-b border-slate-700 text-center">
        <div>
          <div className="font-mono text-lg font-semibold text-slate-100">{data.temperature?.toFixed(1) || '—'}</div>
          <div className="text-xs text-slate-500 uppercase">Temp <span className="text-slate-600">°C</span></div>
        </div>
        <div>
          <div className="font-mono text-lg font-semibold text-slate-100">{data.humidity?.toFixed(0) || '—'}</div>
          <div className="text-xs text-slate-500 uppercase">Humidity <span className="text-slate-600">%</span></div>
        </div>
        <div>
          <div className="font-mono text-lg font-semibold text-slate-100">{data.light_level || '—'}</div>
          <div className="text-xs text-slate-500 uppercase">Light <span className="text-slate-600">lux</span></div>
        </div>
      </div>

      {/* Chart */}
      <div className="p-3">
        <div className="flex gap-2 mb-2 border-b border-slate-700 pb-2">
          {['temperature', 'humidity', 'light_level'].map(tab => (
            <button
              key={tab}
              onClick={() => onTabChange(tab)}
              className={`text-xs px-2 py-1 uppercase font-medium transition-colors ${
                activeTab === tab
                  ? 'text-slate-100 border-b border-slate-100'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {tab === 'temperature' ? 'Temp' : tab === 'humidity' ? 'RH' : 'Light'}
            </button>
          ))}
        </div>
        <div className="h-20 relative">
          <canvas 
            id={`chart-${nodeName.replace(/\s/g, '-')}`}
            role="img"
            aria-label={`Sensor history for ${nodeName}`}
            className="w-full"
          ></canvas>
        </div>
      </div>
    </div>
  );
}