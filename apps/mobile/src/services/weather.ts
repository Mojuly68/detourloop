import { xfetch } from './http';
// Current weather from Open-Meteo (free, no key, CC BY 4.0).
export interface Weather {
  tempC: number;
  code: number;
  label: string;
  icon: string;
  windKmh: number;
  isDay: boolean;
  sunset?: string;
}

const LABEL: [number[], string, string][] = [
  [[0], 'Clear', 'sunny-outline'],
  [[1, 2], 'Partly cloudy', 'partly-sunny-outline'],
  [[3], 'Overcast', 'cloudy-outline'],
  [[45, 48], 'Fog', 'cloudy-outline'],
  [[51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82], 'Rain', 'rainy-outline'],
  [[71, 73, 75, 77, 85, 86], 'Snow', 'snow-outline'],
  [[95, 96, 99], 'Thunderstorm', 'thunderstorm-outline'],
];

export async function getWeather(lat: number, lng: number): Promise<Weather> {
  const r = await xfetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code,wind_speed_10m,is_day&daily=sunset&timezone=auto&forecast_days=1`,
  );
  if (!r.ok) throw new Error('Weather unavailable');
  const j = await r.json();
  const code = j.current.weather_code as number;
  const hit = LABEL.find(([codes]) => codes.includes(code));
  return {
    tempC: Math.round(j.current.temperature_2m),
    code,
    label: hit?.[1] ?? 'Weather',
    icon: hit?.[2] ?? 'partly-sunny-outline',
    windKmh: Math.round(j.current.wind_speed_10m),
    isDay: j.current.is_day === 1,
    sunset: j.daily?.sunset?.[0]?.slice(11, 16),
  };
}
