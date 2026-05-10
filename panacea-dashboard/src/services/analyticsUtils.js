// Calculate statistics from historical data
export const calculateStats = (dataPoints) => {
  if (!dataPoints || dataPoints.length === 0) {
    return {
      avg: 0,
      min: 0,
      max: 0,
      stdDev: 0,
      trend: 'insufficient data'
    };
  }

  const values = dataPoints.map(p => p.y);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const min = Math.min(...values);
  const max = Math.max(...values);
  
  // Standard deviation
  const squaredDiffs = values.map(value => Math.pow(value - avg, 2));
  const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  const stdDev = Math.sqrt(avgSquaredDiff);

  // Trend analysis (compare first half to second half)
  const midpoint = Math.floor(dataPoints.length / 2);
  const firstHalf = values.slice(0, midpoint).reduce((a, b) => a + b, 0) / midpoint;
  const secondHalf = values.slice(midpoint).reduce((a, b) => a + b, 0) / (values.length - midpoint);
  
  let trend = 'stable';
  if (secondHalf > firstHalf * 1.05) trend = 'increasing';
  if (secondHalf < firstHalf * 0.95) trend = 'decreasing';

  return {
    avg: parseFloat(avg.toFixed(2)),
    min: parseFloat(min.toFixed(2)),
    max: parseFloat(max.toFixed(2)),
    stdDev: parseFloat(stdDev.toFixed(2)),
    trend,
    count: dataPoints.length
  };
};

// Comprehensive statistics for a node
export const getNodeStatistics = (nodeHistory) => {
  return {
    temperature: calculateStats(nodeHistory.temperature || []),
    humidity: calculateStats(nodeHistory.humidity || []),
    light_level: calculateStats(nodeHistory.light_level || [])
  };
};

// Detect anomalies
export const detectAnomalies = (value, stats, threshold = 2) => {
  // Anomaly if value is more than `threshold` standard deviations from mean
  const deviation = Math.abs(value - stats.avg) / (stats.stdDev || 1);
  return {
    isAnomaly: deviation > threshold,
    severity: deviation > threshold * 1.5 ? 'high' : deviation > threshold ? 'medium' : 'low',
    deviation: parseFloat(deviation.toFixed(2))
  };
};

// Predict next value using linear regression
export const predictNextValue = (dataPoints, hoursAhead = 1) => {
  if (!dataPoints || dataPoints.length < 2) return null;

  const n = dataPoints.length;
  const points = dataPoints.map((p, i) => ({ x: i, y: p.y }));

  // Linear regression
  const sumX = points.reduce((s, p) => s + p.x, 0);
  const sumY = points.reduce((s, p) => s + p.y, 0);
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
  const sumXX = points.reduce((s, p) => s + p.x * p.x, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  const nextX = n + (hoursAhead - 1);
  const predictedValue = slope * nextX + intercept;

  return {
    predicted: parseFloat(predictedValue.toFixed(2)),
    slope: parseFloat(slope.toFixed(4)),
    confidence: 0.7 // Simplified confidence metric
  };
};

// Health score for a node (0-100)
export const calculateHealthScore = (data, stats, weatherCorrelation) => {
  let score = 100;

  // Check for offline status
  if (!data.online) score -= 30;

  // Check for out-of-range values
  if (data.temperature < -10 || data.temperature > 50) score -= 15;
  if (data.humidity < 0 || data.humidity > 100) score -= 15;

  // Check for anomalies
  const tempAnomaly = detectAnomalies(data.temperature, stats.temperature);
  const humidityAnomaly = detectAnomalies(data.humidity, stats.humidity);
  
  if (tempAnomaly.isAnomaly) score -= tempAnomaly.severity === 'high' ? 10 : 5;
  if (humidityAnomaly.isAnomaly) score -= humidityAnomaly.severity === 'high' ? 10 : 5;

  // Weather correlation issues
  if (weatherCorrelation) {
    if (weatherCorrelation.length > 2) score -= 10;
  }

  return Math.max(0, Math.min(100, score));
};

// Recommend actions based on current conditions
export const recommendActions = (nodeName, data, stats, weatherData) => {
  const actions = [];

  // Temperature recommendations
  if (data.temperature > stats.temperature.max * 1.1) {
    actions.push(`↓ ${nodeName}: Temperature elevated. Consider cooling or ventilation.`);
  }
  if (data.temperature < stats.temperature.min * 0.9) {
    actions.push(`↑ ${nodeName}: Temperature low. Check heating systems.`);
  }

  // Humidity recommendations
  if (data.humidity > 75) {
    actions.push(`💧 ${nodeName}: High humidity. Enable dehumidification.`);
  }
  if (data.humidity < 30) {
    actions.push(`🏜️ ${nodeName}: Low humidity. Consider adding moisture.`);
  }

  // Light level recommendations
  if (data.light_level < 100) {
    actions.push(`💡 ${nodeName}: Low light. Check lighting systems.`);
  }

  return actions;
};

// Get summary insights
export const getSummaryInsights = (allNodes, allStats) => {
  const insights = [];

  const avgTemp = Object.values(allStats).reduce((sum, s) => sum + (s.temperature?.avg || 0), 0) / Object.keys(allStats).length;
  const avgHumidity = Object.values(allStats).reduce((sum, s) => sum + (s.humidity?.avg || 0), 0) / Object.keys(allStats).length;

  if (avgTemp > 25) insights.push('System-wide high temperature detected');
  if (avgHumidity > 70) insights.push('System-wide humidity is elevated');

  return insights;
};
