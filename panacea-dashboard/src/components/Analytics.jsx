import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Cloud, TrendingUp, AlertCircle, CheckCircle, BarChart3, AlertTriangle } from 'lucide-react';
import { generateAnalytics } from '../services/aiAnalytics';
import { fetchWeatherData, getWeatherIcon, correlateWeatherWithSensors } from '../services/weatherService';
import { getNodeStatistics, calculateHealthScore, recommendActions, getSummaryInsights, predictNextValue } from '../services/analyticsUtils';

// Error Boundary for Analytics
class AnalyticsErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Analytics Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-4 flex items-start gap-3"
        >
          <AlertTriangle className="text-yellow-500 flex-shrink-0 mt-0.5" size={20} />
          <div>
            <p className="text-sm text-yellow-300 font-semibold mb-1">Analytics Error</p>
            <p className="text-xs text-yellow-200">{this.state.error?.message}</p>
            <button 
              onClick={() => this.setState({ hasError: false })}
              className="text-xs text-yellow-400 hover:text-yellow-300 mt-2 underline"
            >
              Dismiss
            </button>
          </div>
        </motion.div>
      );
    }

    return this.props.children;
  }
}

function AnalyticsContent({ nodes, nodeHistory, geminiApiKey, weatherApiKey }) {
  const [analytics, setAnalytics] = useState(null);
  const [weatherData, setWeatherData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [nodeStats, setNodeStats] = useState({});
  const [allActions, setAllActions] = useState([]);

  // Default stats object structure
  const defaultStats = {
    temperature: { avg: 0, min: 0, max: 0, stdDev: 0, trend: 'insufficient data', count: 0 },
    humidity: { avg: 0, min: 0, max: 0, stdDev: 0, trend: 'insufficient data', count: 0 },
    light_level: { avg: 0, min: 0, max: 0, stdDev: 0, trend: 'insufficient data', count: 0 }
  };

  // Fetch weather data
  useEffect(() => {
    const fetchWeather = async () => {
      try {
        // PH NCR coordinates: 14.5995°N, 120.9842°E
        const weather = await fetchWeatherData(14.5995, 120.9842, weatherApiKey);
        setWeatherData(weather);
      } catch (err) {
        console.error('Weather fetch error:', err);
      }
    };
    fetchWeather();
    const interval = setInterval(fetchWeather, 600000); // Every 10 minutes
    return () => clearInterval(interval);
  }, [weatherApiKey]);

  // Calculate statistics for all nodes
  useEffect(() => {
    try {
      const stats = {};
      const actions = [];

      Object.entries(nodeHistory).forEach(([nodeName, history]) => {
        const nodeStats = getNodeStatistics(history);
        stats[nodeName] = nodeStats;
        
        if (nodes[nodeName]) {
          const nodeActions = recommendActions(nodeName, nodes[nodeName], nodeStats, weatherData);
          actions.push(...nodeActions);
        }
      });

      setNodeStats(stats);
      setAllActions(actions);
    } catch (err) {
      console.error('Stats calculation error:', err);
      setNodeStats({});
      setAllActions([]);
    }
  }, [nodeHistory, nodes, weatherData]);

  // Generate AI analytics
  useEffect(() => {
    const generateInsights = async () => {
      try {
        setLoading(true);
        if (geminiApiKey && Object.keys(nodes).length > 0) {
          const insights = await generateAnalytics(nodes, weatherData, nodeStats);
          setAnalytics(insights);
        } else {
          setAnalytics({
            insights: ['Configure Gemini API key to enable AI analytics'],
            recommendations: ['Set API key in configuration'],
            predictive: ['Waiting for AI initialization'],
            prescriptive: ['Waiting for AI initialization']
          });
        }
      } catch (err) {
        console.error('Analytics generation error:', err);
        setAnalytics({
          insights: ['Error generating insights'],
          recommendations: ['Check API configuration'],
          predictive: ['Unable to generate predictions'],
          prescriptive: ['Unable to generate prescriptions']
        });
      } finally {
        setLoading(false);
      }
    };

    if (Object.keys(nodes).length > 0) {
      generateInsights();
    }
  }, [geminiApiKey, Object.keys(nodes).length, weatherData, nodeStats]);

  // Calculate health scores with defensive checks
  const healthScores = {};
  try {
    Object.entries(nodes).forEach(([nodeName, data]) => {
      const weatherCorr = weatherData ? correlateWeatherWithSensors(weatherData, { [nodeName]: data }) : [];
      const stats = nodeStats[nodeName] || defaultStats;
      healthScores[nodeName] = calculateHealthScore(data, stats, weatherCorr);
    });
  } catch (err) {
    console.error('Health score calculation error:', err);
  }

  const avgHealthScore = Object.values(healthScores).length > 0
    ? Math.round(Object.values(healthScores).reduce((a, b) => a + b, 0) / Object.values(healthScores).length)
    : 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-blue-900/30 to-blue-800/10 border border-blue-700/30 rounded-lg p-4"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase text-slate-400 mb-1">System Health</p>
              <p className="text-2xl font-bold text-blue-300">{avgHealthScore}%</p>
            </div>
            <BarChart3 size={24} className="text-blue-400" />
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-purple-900/30 to-purple-800/10 border border-purple-700/30 rounded-lg p-4"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase text-slate-400 mb-1">Active Nodes</p>
              <p className="text-2xl font-bold text-purple-300">{Object.keys(nodes).length}</p>
            </div>
            <Zap size={24} className="text-purple-400" />
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gradient-to-br from-green-900/30 to-green-800/10 border border-green-700/30 rounded-lg p-4"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase text-slate-400 mb-1">Weather</p>
              <p className="text-lg font-bold text-green-300">
                {weatherData?.temperature ? `${weatherData.temperature}°C` : 'Loading...'}
              </p>
            </div>
            <span className="text-2xl">{getWeatherIcon(weatherData?.weather_code)}</span>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-gradient-to-br from-orange-900/30 to-orange-800/10 border border-orange-700/30 rounded-lg p-4"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase text-slate-400 mb-1">Actions Needed</p>
              <p className="text-2xl font-bold text-orange-300">{allActions.length}</p>
            </div>
            <AlertCircle size={24} className="text-orange-400" />
          </div>
        </motion.div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-slate-700 pb-4">
        {['overview', 'insights', 'recommendations', 'predictive', 'prescriptive', 'nodes'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium uppercase transition-all ${
              activeTab === tab
                ? 'text-slate-100 border-b-2 border-slate-100'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {tab === 'overview' ? '📊 Overview' : 
             tab === 'insights' ? '💡 Insights' :
             tab === 'recommendations' ? '⚡ Recommend' :
             tab === 'predictive' ? '🔮 Predict' :
             tab === 'prescriptive' ? '🎯 Prescribe' :
             '📋 Nodes'}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'overview' && (
            <AnalyticsOverview 
              nodes={nodes}
              weatherData={weatherData}
              healthScores={healthScores}
              actions={allActions}
              stats={nodeStats}
            />
          )}

          {activeTab === 'insights' && (
            <AnalyticsSection
              title="AI-Generated Insights"
              content={analytics?.insights || []}
              icon={<Zap size={20} />}
              loading={loading}
            />
          )}

          {activeTab === 'recommendations' && (
            <AnalyticsSection
              title="Recommendations"
              content={analytics?.recommendations || allActions}
              icon={<CheckCircle size={20} />}
              loading={loading}
            />
          )}

          {activeTab === 'predictive' && (
            <AnalyticsSection
              title="Predictive Analysis"
              content={analytics?.predictive || ['Analyzing trends...']}
              icon={<TrendingUp size={20} />}
              loading={loading}
            />
          )}

          {activeTab === 'prescriptive' && (
            <AnalyticsSection
              title="Prescriptive Actions"
              content={analytics?.prescriptive || ['Optimizing system...']}
              icon={<AlertCircle size={20} />}
              loading={loading}
            />
          )}

          {activeTab === 'nodes' && (
            <NodeDetailsGrid 
              nodes={nodes}
              stats={nodeStats}
              healthScores={healthScores}
              nodeHistory={nodeHistory}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// Overview Section
function AnalyticsOverview({ nodes, weatherData, healthScores, actions, stats = {} }) {
  const [expandedActions, setExpandedActions] = useState(false);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Weather Impact */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-slate-800/50 border border-slate-700 rounded-lg p-4"
        >
          <h3 className="text-sm font-semibold text-slate-100 mb-3">🌦️ Weather Status</h3>
          <div className="space-y-2">
            <p className="text-xs text-slate-400">
              <span className="font-semibold">Outdoor Temp:</span> {weatherData?.temperature?.toFixed(1) ?? 'N/A'}°C
            </p>
            <p className="text-xs text-slate-400">
              <span className="font-semibold">Condition:</span> {weatherData?.condition ?? 'N/A'}
            </p>
            <p className="text-xs text-slate-400">
              <span className="font-semibold">Humidity:</span> {weatherData?.humidity ?? 'N/A'}%
            </p>
            <p className="text-xs text-slate-400">
              <span className="font-semibold">Wind Speed:</span> {weatherData?.windSpeed?.toFixed(1) ?? 'N/A'} km/h
            </p>
          </div>
        </motion.div>

        {/* System Summary */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-slate-800/50 border border-slate-700 rounded-lg p-4"
        >
          <h3 className="text-sm font-semibold text-slate-100 mb-3">📊 System Summary</h3>
          <div className="space-y-2">
            <p className="text-xs text-slate-400">
              <span className="font-semibold">Total Nodes:</span> {Object.keys(nodes).length}
            </p>
            <p className="text-xs text-slate-400">
              <span className="font-semibold">Online:</span> {Object.values(nodes).filter(n => n.online).length}
            </p>
            <p className="text-xs text-slate-400">
              <span className="font-semibold">Avg Health:</span> {
                Object.values(healthScores).length > 0 ?
                  Math.round(Object.values(healthScores).reduce((a, b) => a + b, 0) / Object.values(healthScores).length)
                  : 0
              }%
            </p>
            <p className="text-xs text-slate-400">
              <span className="font-semibold">Actions:</span> {actions.length} needed
            </p>
          </div>
        </motion.div>
      </div>

      {/* Recommended Actions */}
      {actions.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-800/50 border border-orange-700/30 rounded-lg p-4"
        >
          <h3 className="text-sm font-semibold text-orange-300 mb-3">⚠️ Recommended Actions</h3>
          <div className="space-y-2">
            {(expandedActions ? actions : actions.slice(0, 5)).map((action, i) => (
              <div key={i} className="text-xs text-slate-300 flex items-start gap-2">
                <span className="text-orange-400">▪</span>
                <span>{action}</span>
              </div>
            ))}
            {actions.length > 5 && (
              <button
                onClick={() => setExpandedActions(!expandedActions)}
                className="text-xs text-orange-400 hover:text-orange-300 pt-2 underline cursor-pointer transition-colors"
              >
                {expandedActions ? `Show less` : `+ ${actions.length - 5} more actions`}
              </button>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}

// Generic Analytics Section
function AnalyticsSection({ title, content, icon, loading }) {
  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-4">
        {icon}
        <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
      </div>
      
      {loading ? (
        <div className="text-xs text-slate-400 animate-pulse">Analyzing data...</div>
      ) : (
        <div className="space-y-2">
          {Array.isArray(content) ? content.map((item, i) => (
            <div key={i} className="text-xs text-slate-300 flex items-start gap-2 p-2 bg-slate-700/30 rounded">
              <span className="text-slate-500 mt-0.5">▸</span>
              <span>{item}</span>
            </div>
          )) : (
            <div className="text-xs text-slate-300 p-2">{content}</div>
          )}
        </div>
      )}
    </div>
  );
}

// Node Details Grid
function NodeDetailsGrid({ nodes, stats = {}, healthScores = {}, nodeHistory = {} }) {
  const defaultStats = {
    temperature: { avg: 0, min: 0, max: 0, stdDev: 0, trend: 'insufficient data', count: 0 },
    humidity: { avg: 0, min: 0, max: 0, stdDev: 0, trend: 'insufficient data', count: 0 },
    light_level: { avg: 0, min: 0, max: 0, stdDev: 0, trend: 'insufficient data', count: 0 }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Object.entries(nodes).map(([nodeName, data]) => {
        try {
          const nodeStats = stats[nodeName] || defaultStats;
          const predictions = nodeHistory[nodeName]?.temperature ? 
            {
              temp: predictNextValue(nodeHistory[nodeName].temperature),
              humidity: predictNextValue(nodeHistory[nodeName].humidity)
            } : null;

          return (
            <motion.div
              key={nodeName}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-slate-800 border border-slate-700 rounded-lg p-4"
            >
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-slate-100 text-sm">{nodeName}</h4>
                <div className={`w-2 h-2 rounded-full ${data.online ? 'bg-emerald-500' : 'bg-red-500'}`} />
              </div>

              {/* Current Values */}
              <div className="space-y-2 mb-3 pb-3 border-b border-slate-700">
                <p className="text-xs text-slate-400">
                  Temp: <span className="text-slate-200">{data.temperature?.toFixed(1) ?? '—'}°C</span>
                </p>
                <p className="text-xs text-slate-400">
                  Humidity: <span className="text-slate-200">{data.humidity?.toFixed(0) ?? '—'}%</span>
                </p>
                <p className="text-xs text-slate-400">
                  Light: <span className="text-slate-200">{data.light_level ?? '—'} lux</span>
                </p>
              </div>

              {/* Statistics */}
              {nodeStats && (
                <div className="space-y-2 mb-3 pb-3 border-b border-slate-700">
                  <p className="text-xs text-slate-500">
                    Avg Temp: <span className="text-slate-300">{nodeStats.temperature?.avg?.toFixed(1) ?? '—'}°C</span>
                  </p>
                  <p className="text-xs text-slate-500">
                    Trend: <span className="text-slate-300 capitalize">{nodeStats.temperature?.trend ?? '—'}</span>
                  </p>
                </div>
              )}

              {/* Predictions */}
              {predictions?.temp && (
                <div className="text-xs text-slate-400 mb-3 p-2 bg-slate-700/30 rounded">
                  <p className="text-slate-300 font-semibold">24h Forecast:</p>
                  <p>Temp: {predictions.temp.predicted?.toFixed(1) ?? '—'}°C</p>
                </div>
              )}

              {/* Health Score */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Health</span>
                <div className="w-12 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${
                      (healthScores[nodeName] ?? 0) >= 80 ? 'bg-emerald-500' : 
                      (healthScores[nodeName] ?? 0) >= 60 ? 'bg-yellow-500' : 
                      'bg-red-500'
                    }`}
                    style={{ width: `${healthScores[nodeName] ?? 0}%` }}
                  />
                </div>
                <span className="text-xs font-semibold text-slate-300">{healthScores[nodeName] ?? 0}%</span>
              </div>
            </motion.div>
          );
        } catch (err) {
          console.error(`Error rendering node ${nodeName}:`, err);
          return (
            <motion.div
              key={nodeName}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-slate-800 border border-red-700/30 rounded-lg p-4"
            >
              <h4 className="font-semibold text-slate-100 text-sm mb-2">{nodeName}</h4>
              <p className="text-xs text-red-400">Error loading node data</p>
            </motion.div>
          );
        }
      })}
    </div>
  );
}
export default function Analytics({ nodes, nodeHistory, geminiApiKey, weatherApiKey }) {
  return (
    <AnalyticsErrorBoundary>
      <AnalyticsContent 
        nodes={nodes}
        nodeHistory={nodeHistory}
        geminiApiKey={geminiApiKey}
        weatherApiKey={weatherApiKey}
      />
    </AnalyticsErrorBoundary>
  );
}