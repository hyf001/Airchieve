"use client";

import { motion } from "framer-motion";
import { Globe } from "lucide-react";

export default function Loading() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0a0a0c]">
      <motion.div
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.5, 1, 0.5]
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut"
        }}
        className="flex flex-col items-center gap-4"
      >
        <Globe size={48} className="text-blue-500/50" />
        <p className="text-white/20 font-mono text-xs uppercase tracking-[0.2em]">Synchronizing Time</p>
      </motion.div>
    </div>
  );
}
