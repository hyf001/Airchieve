"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, Globe, MapPin, Calendar, Search, Sun, Moon, X, Copy, Check } from "lucide-react";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";

const CITIES = [
  { name: "Beijing", zone: "Asia/Shanghai", icon: "🏮" },
  { name: "London", zone: "Europe/London", icon: "🎡" },
  { name: "New York", zone: "America/New_York", icon: "🏙️" },
  { name: "Tokyo", zone: "Asia/Tokyo", icon: "🗼" },
  { name: "Dubai", zone: "Asia/Dubai", icon: "🏗️" },
  { name: "Paris", zone: "Europe/Paris", icon: "🗼" },
  { name: "Sydney", zone: "Australia/Sydney", icon: "🇦🇺" },
  { name: "Singapore", zone: "Asia/Singapore", icon: "🦁" },
  { name: "Los Angeles", zone: "America/Los_Angeles", icon: "🌴" },
  { name: "Berlin", zone: "Europe/Berlin", icon: "🥨" },
  { name: "Seoul", zone: "Asia/Seoul", icon: "🍱" },
  { name: "Mumbai", zone: "Asia/Kolkata", icon: "🍛" },
  { name: "São Paulo", zone: "America/Sao_Paulo", icon: "🇧🇷" },
  { name: "Cairo", zone: "Africa/Cairo", icon: "🏺" },
  { name: "Moscow", zone: "Europe/Moscow", icon: "🏰" },
  { name: "Vancouver", zone: "America/Vancouver", icon: "🌲" },
  { name: "Nairobi", zone: "Africa/Nairobi", icon: "🦁" },
  { name: "Mexico City", zone: "America/Mexico_City", icon: "🌮" },
  { name: "Hong Kong", zone: "Asia/Hong_Kong", icon: "🇭🇰" },
  { name: "Rome", zone: "Europe/Rome", icon: "🏛️" },
  { name: "Madrid", zone: "Europe/Madrid", icon: "🥘" },
  { name: "Istanbul", zone: "Europe/Istanbul", icon: "🕌" },
];

function ClockCard({ city, time, is24Hour, isLocal = false }: { city: typeof CITIES[0], time: Date, is24Hour: boolean, isLocal?: boolean }) {
  const [copied, setCopied] = useState(false);
  const zonedTime = toZonedTime(time, city.zone);
  const hour = zonedTime.getHours();
  const isDay = hour >= 6 && hour < 18;

  const timeStr = format(zonedTime, is24Hour ? "HH:mm:ss" : "hh:mm:ss aa");
  const dateStr = format(zonedTime, "EEE, MMM do");

  const copyToClipboard = () => {
    navigator.clipboard.writeText(`${city.name}: ${timeStr} (${dateStr})`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      whileHover={{ scale: 1.02, backgroundColor: "rgba(255, 255, 255, 0.05)" }}
      className={`glass-card p-6 rounded-3xl flex flex-col justify-between h-56 transition-colors group relative overflow-hidden ${isLocal ? 'ring-2 ring-blue-500/20 bg-blue-500/5' : ''}`}
    >
      {/* Dynamic Background Gradient based on Day/Night */}
      <div className={`absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-500 pointer-events-none ${isDay ? 'bg-orange-400' : 'bg-blue-600'}`} />

      <div className="flex justify-between items-start relative z-10">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">{city.icon}</span>
            <h3 className="text-lg font-medium text-white/70">
              {city.name}
              {isLocal && <span className="ml-2 text-[10px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full uppercase tracking-widest">Local</span>}
            </h3>
          </div>
          <p className="text-xs text-white/40 font-mono uppercase tracking-wider">
            {city.zone.split('/')[1]?.replace('_', ' ') || city.zone}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="p-2 rounded-full bg-white/5">
            {isDay ? (
              <Sun size={16} className="text-orange-400 animate-spin-slow" />
            ) : (
              <Moon size={16} className="text-blue-400" />
            )}
          </div>
          <button
            onClick={copyToClipboard}
            className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 transition-colors text-white/40 hover:text-white"
            title="Copy time"
          >
            {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
          </button>
        </div>
      </div>

      <div className="mt-auto relative z-10">
        <div className={`font-light tracking-tighter clock-glow mb-1 ${is24Hour ? 'text-4xl' : 'text-3xl'}`}>
          {timeStr}
        </div>
        <div className="flex items-center gap-2 text-white/40 text-sm">
          <Calendar size={14} />
          <span>{dateStr}</span>
        </div>
      </div>
    </motion.div>
  );
}

export default function WorldClock() {
  const [time, setTime] = useState(new Date());
  const [is24Hour, setIs24Hour] = useState(true);
  const [search, setSearch] = useState("");
  const [localCity, setLocalCity] = useState<typeof CITIES[0] | null>(null);

  useEffect(() => {
    // Restore settings
    const savedFormat = localStorage.getItem("clock-format");
    if (savedFormat) setIs24Hour(savedFormat === "24h");

    // Detect local timezone
    try {
      const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      setLocalCity({
        name: "Your Location",
        zone: zone,
        icon: "📍"
      });
    } catch (e) {
      console.error("Timezone detection failed", e);
    }

    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const toggleFormat = () => {
    const newFormat = !is24Hour;
    setIs24Hour(newFormat);
    localStorage.setItem("clock-format", newFormat ? "24h" : "12h");
  };

  const allCities = localCity
    ? [localCity, ...CITIES.filter(c => c.zone !== localCity.zone)]
    : CITIES;

  const filteredCities = allCities.filter(city =>
    city.name.toLowerCase().includes(search.toLowerCase()) ||
    city.zone.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <main className="min-h-screen relative overflow-hidden flex flex-col items-center px-4 py-12 md:py-24">
      {/* Background Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 rounded-full blur-[120px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="z-10 text-center mb-12"
      >
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-6">
          <Globe size={16} className="text-blue-400 animate-pulse" />
          <span className="text-xs font-medium tracking-widest uppercase text-white/60">Global Time Interface</span>
        </div>
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-4 bg-gradient-to-b from-white to-white/50 bg-clip-text text-transparent">
          World Clock
        </h1>
        <div className="flex items-center justify-center gap-3 text-white/30 font-mono text-sm mb-8">
          <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 tracking-widest">UTC {format(toZonedTime(time, "UTC"), "HH:mm:ss")}</span>
          <span className="opacity-50">•</span>
          <span>{CITIES.length} GLOBAL CITIES</span>
        </div>
        <p className="text-white/40 max-w-md mx-auto mb-8">
          Synchronize with the world. Precise time tracking across major global hubs in a minimalist interface.
        </p>

        <div className="flex flex-col md:flex-row items-center justify-center gap-4 max-w-2xl mx-auto w-full">
          <div className="relative w-full md:w-80 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-blue-400 transition-colors" size={18} />
            <input
              type="text"
              placeholder="Search city or zone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-white/20"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            )}
          </div>

          <button
            onClick={toggleFormat}
            className="flex items-center gap-2 px-6 py-3 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all w-full md:w-auto justify-center"
          >
            <Clock size={18} className="text-blue-400" />
            <span className="text-sm font-medium whitespace-nowrap">{is24Hour ? "24h Format" : "12h Format"}</span>
          </button>
        </div>
      </motion.div>

      <div className="z-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-6xl">
        <AnimatePresence mode="popLayout">
          {filteredCities.map((city) => (
            <ClockCard
              key={city.name}
              city={city}
              time={time}
              is24Hour={is24Hour}
              isLocal={city.name === "Your Location"}
            />
          ))}
        </AnimatePresence>
      </div>

      {filteredCities.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="z-10 py-20 text-white/20 text-center"
        >
          <p>No cities found matching your search.</p>
        </motion.div>
      )}

      <footer className="z-10 mt-20 pb-12 text-white/20 text-xs flex flex-col items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <span>Real-time Sync Active</span>
          </div>
          <span>•</span>
          <div className="flex items-center gap-1">
            <Globe size={12} />
            <span>{CITIES.length} Cities Monitored</span>
          </div>
        </div>
        <div className="flex flex-col items-center gap-1 opacity-50">
          <p>© {new Date().getFullYear()} Global Time Interface</p>
          <p className="font-mono uppercase tracking-[0.2em] text-[10px]">Synchronized Precision</p>
        </div>
      </footer>
    </main>
  );
}
