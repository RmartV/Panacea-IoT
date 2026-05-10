import axios from 'axios';

// Default coordinates for PH NCR (Manila area)
const DEFAULT_LATITUDE = 14.5995;
const DEFAULT_LONGITUDE = 120.9842;

// Support both Open-Meteo (free) and OpenWeather (with API key)
const OPEN_METEO_BASE = 'https://api.open-meteo.com/v1/forecast';
const OPENWEATHER_BASE = 'https://api.openweathermap.org/data/2.5/weather';

export const fetchWeatherData = async (latitude = DEFAULT_LATITUDE, longitude = DEFAULT_LONGITUDE, apiKey = null) => {
  try {
    // Use OpenWeather if API key is provided, otherwise use Open-Meteo
    if (apiKey) {
      const response = await axios.get(OPENWEATHER_BASE, {
        params: {
          lat: latitude,
          lon: longitude,
          units: 'metric',
          appid: apiKey
        },
        timeout: 5000
      });

      const data = response.data;
      const weather = data.weather[0];
      
      return {
        temperature: data.main.temp,
        humidity: data.main.humidity,
        condition: weather.main,
        windSpeed: data.wind.speed,
        timestamp: new Date().toISOString(),
        location: data.name || `${latitude}, ${longitude}`,
        weather_code: getOpenWeatherCode(weather.id)
      };
    } else {
      // Fallback to Open-Meteo (free)
      const response = await axios.get(OPEN_METEO_BASE, {
        params: {
          latitude,
          longitude,
          current: 'temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m',
          temperature_unit: 'celsius',
          wind_speed_unit: 'kmh',
          forecast_days: 1
        },
        timeout: 5000
      });

      const current = response.data.current;
      
      return {
        temperature: current.temperature_2m,
        humidity: current.relative_humidity_2m,
        condition: getWeatherDescription(current.weather_code),
        windSpeed: current.wind_speed_10m,
        timestamp: new Date(current.time).toISOString(),
        location: `PH NCR (${latitude.toFixed(2)}°N, ${longitude.toFixed(2)}°E)`,
        weather_code: current.weather_code
      };
    }
  } catch (error) {
    console.error('Weather API Error:', error);
    return {
      temperature: null,
      humidity: null,
      condition: 'Unable to fetch',
      windSpeed: null,
      timestamp: new Date().toISOString(),
      error: error.message
    };
  }
};

// Map OpenWeather ID to WMO code for icon compatibility
export const getOpenWeatherCode = (id) => {
  if (id >= 200 && id < 300) return 95; // Thunderstorm
  if (id >= 300 && id < 400) return 51; // Drizzle
  if (id >= 500 && id < 600) return 61; // Rain
  if (id >= 600 && id < 700) return 71; // Snow
  if (id >= 700 && id < 800) return 45; // Fog
  if (id === 800) return 0;   // Clear
  if (id === 801) return 1;   // Few clouds
  if (id === 802) return 2;   // Scattered clouds
  if (id === 803 || id === 804) return 3; // Overcast
  return 3; // Default overcast
};

export const getWeatherDescription = (code) => {
  const weatherCodes = {
    0: 'Clear sky',
    1: 'Mainly clear',
    2: 'Partly cloudy',
    3: 'Overcast',
    45: 'Foggy',
    48: 'Foggy/Rime',
    51: 'Light drizzle',
    53: 'Moderate drizzle',
    55: 'Dense drizzle',
    61: 'Slight rain',
    63: 'Moderate rain',
    65: 'Heavy rain',
    71: 'Slight snow',
    73: 'Moderate snow',
    75: 'Heavy snow',
    77: 'Snow grains',
    80: 'Slight rain showers',
    81: 'Moderate rain showers',
    82: 'Violent rain showers',
    85: 'Slight snow showers',
    86: 'Heavy snow showers',
    95: 'Thunderstorm',
    96: 'Thunderstorm with hail',
    99: 'Thunderstorm with hail'
  };
  return weatherCodes[code] || 'Unknown';
};

export const getWeatherIcon = (code) => {
  if (code === 0) return '☀️';
  if (code === 1 || code === 2) return '🌤️';
  if (code === 3) return '☁️';
  if (code === 45 || code === 48) return '🌫️';
  if (code >= 51 && code <= 67) return '🌧️';
  if (code >= 71 && code <= 86) return '❄️';
  if (code >= 80 && code <= 82) return '⛈️';
  if (code >= 95) return '⚡';
  return '🌤️';
};

export const correlateWeatherWithSensors = (weatherData, sensorData) => {
  // Analyze relationship between outdoor and indoor conditions
  const analysis = [];

  if (weatherData?.temperature && weatherData?.temperature > 25) {
    analysis.push('High outdoor temperature detected - monitor indoor cooling');
  }
  
  if (weatherData?.humidity && weatherData?.humidity > 70) {
    analysis.push('High outdoor humidity - check dehumidification systems');
  }

  Object.entries(sensorData).forEach(([nodeName, data]) => {
    if (weatherData?.temperature && data.temperature) {
      const diff = data.temperature - weatherData.temperature;
      if (diff > 5) {
        analysis.push(`${nodeName}: Indoor temp is ${diff.toFixed(1)}°C higher than outdoor`);
      }
    }
  });

  return analysis;
};
