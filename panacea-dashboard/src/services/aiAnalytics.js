import { GoogleGenerativeAI } from '@google/generative-ai';

let genAI = null;
let ollamaEndpoint = null;

export const initializeAI = (apiKey, endpoint) => {
  if (apiKey) {
    genAI = new GoogleGenerativeAI(apiKey);
  }
  if (endpoint) {
    ollamaEndpoint = endpoint;
  }
};

// Helper function to call Ollama API
const callOllama = async (prompt, model = 'mistral') => {
  if (!ollamaEndpoint) throw new Error('Ollama endpoint not configured');
  
  try {
    const response = await fetch(`${ollamaEndpoint}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.response || '';
  } catch (error) {
    console.error('Ollama Error:', error);
    throw error;
  }
};

export const generateAnalytics = async (sensorData, weatherData, historicalStats) => {
  if (!genAI && !ollamaEndpoint) {
    return {
      insights: 'AI service not initialized. Please configure Gemini API key or Ollama endpoint.',
      recommendations: [],
      predictive: [],
      prescriptive: []
    };
  }

  try {
    let responseText = '';

    const prompt = `Analyze the following IoT sensor data and provide comprehensive insights:

Current Sensor Data:
${Object.entries(sensorData).map(([node, data]) => `
Node: ${node}
- Temperature: ${data.temperature}°C
- Humidity: ${data.humidity}%
- Light Level: ${data.light_level} lux
- Status: ${data.online ? 'Online' : 'Offline'}
`).join('')}

Weather Data:
- Outdoor Temperature: ${weatherData?.temperature || 'N/A'}°C
- Condition: ${weatherData?.condition || 'N/A'}
- Humidity: ${weatherData?.humidity || 'N/A'}%

Historical Statistics:
${Object.entries(historicalStats).map(([node, stats]) => `
Node: ${node}
- Avg Temp: ${stats.temperature?.avg?.toFixed(1) || 'N/A'}°C
- Avg Humidity: ${stats.humidity?.avg?.toFixed(1) || 'N/A'}%
- Trend: ${stats.temperature?.trend || 'stable'}
`).join('')}

Please provide:
1. KEY INSIGHTS: Identify 2-3 notable patterns, anomalies, or observations
2. RECOMMENDATIONS: Suggest 2-3 actionable steps to optimize conditions
3. PREDICTIVE ANALYSIS: Forecast potential issues in the next 24 hours
4. PRESCRIPTIVE ACTIONS: Recommend specific corrective actions

Format your response as JSON with keys: insights, recommendations, predictive, prescriptive (each should be an array of strings).`;

    // Try Gemini first
    if (genAI) {
      try {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const result = await model.generateContent(prompt);
        responseText = result.response.text();
      } catch (geminiError) {
        console.warn('Gemini API failed, trying Ollama:', geminiError.message);
        if (ollamaEndpoint) {
          responseText = await callOllama(prompt);
        } else {
          throw geminiError;
        }
      }
    } else if (ollamaEndpoint) {
      // Use Ollama if Gemini not available
      responseText = await callOllama(prompt);
    }

    // Try to parse JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    // Fallback parsing
    return {
      insights: [responseText.substring(0, 200)],
      recommendations: ['Please review AI response for recommendations'],
      predictive: ['Monitor sensor trends'],
      prescriptive: ['Adjust environmental controls as needed']
    };
  } catch (error) {
    console.error('AI Analytics Error:', error);
    return {
      insights: [`Error generating insights: ${error.message}`],
      recommendations: ['Verify API key or Ollama configuration'],
      predictive: ['Check system status'],
      prescriptive: ['Troubleshoot AI service connection']
    };
  }
};

export const generateNodeInsight = async (nodeName, nodeData, historicalData) => {
  if (!genAI && !ollamaEndpoint) return 'AI service not initialized';

  try {
    let responseText = '';

    const prompt = `Provide a brief 1-2 sentence insight about this sensor node:
    
Node: ${nodeName}
Current Temp: ${nodeData.temperature}°C
Current Humidity: ${nodeData.humidity}%
Light Level: ${nodeData.light_level} lux
Recent Trend: ${historicalData?.temperature?.trend || 'stable'}
Average Temp: ${historicalData?.temperature?.avg?.toFixed(1) || 'N/A'}°C
Status: ${nodeData.online ? 'Online' : 'Offline'}

Provide actionable, concise insight in simple language.`;

    if (genAI) {
      try {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const result = await model.generateContent(prompt);
        responseText = result.response.text();
      } catch (geminiError) {
        console.warn('Gemini failed, trying Ollama:', geminiError.message);
        if (ollamaEndpoint) {
          responseText = await callOllama(prompt);
        } else {
          throw geminiError;
        }
      }
    } else if (ollamaEndpoint) {
      responseText = await callOllama(prompt);
    }

    return responseText;
  } catch (error) {
    return `Node status nominal`;
  }
};

export const predictAnomaly = async (nodeData, historicalData) => {
  if (!genAI && !ollamaEndpoint) return { risk: 'low', reason: 'AI not initialized' };

  try {
    let responseText = '';

    const prompt = `Assess anomaly risk for this sensor reading on a scale of low/medium/high:

Current Values:
- Temperature: ${nodeData.temperature}°C
- Humidity: ${nodeData.humidity}%
- Light Level: ${nodeData.light_level}

Historical Average:
- Avg Temp: ${historicalData?.temperature?.avg?.toFixed(1) || 'N/A'}°C
- Avg Humidity: ${historicalData?.humidity?.avg?.toFixed(1) || 'N/A'}%
- Std Dev: ${historicalData?.temperature?.stdDev?.toFixed(2) || 'N/A'}

Respond with JSON: {"risk": "low|medium|high", "reason": "explanation"}`;

    if (genAI) {
      try {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const result = await model.generateContent(prompt);
        responseText = result.response.text();
      } catch (geminiError) {
        console.warn('Gemini failed, trying Ollama:', geminiError.message);
        if (ollamaEndpoint) {
          responseText = await callOllama(prompt);
        } else {
          throw geminiError;
        }
      }
    } else if (ollamaEndpoint) {
      responseText = await callOllama(prompt);
    }

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    return { risk: 'low', reason: 'Analysis complete' };
  } catch (error) {
    return { risk: 'low', reason: 'Check AI service' };
  }
};
