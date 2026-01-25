"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Home, Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0a0a0c] p-6 text-center">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-12 rounded-[2rem] max-w-md w-full relative z-10"
      >
        <div className="bg-blue-500/10 p-4 rounded-full w-fit mx-auto mb-6">
          <Compass size={32} className="text-blue-400 animate-spin-slow" />
        </div>
        <h2 className="text-4xl font-bold mb-2 bg-gradient-to-b from-white to-white/50 bg-clip-text text-transparent">
          404
        </h2>
        <p className="text-xl font-medium mb-2">Lost in Time?</p>
        <p className="text-white/40 text-sm mb-8">
          The page you're looking for doesn't exist in this timezone.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 bg-white text-black rounded-full font-medium hover:bg-white/90 transition-colors w-full justify-center"
        >
          <Home size={18} />
          Return to Dashboard
        </Link>
      </motion.div>
    </div>
  );
}
