"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { AlertCircle, RotateCcw } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0a0a0c] p-6 text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-card p-12 rounded-[2rem] max-w-md w-full"
      >
        <div className="bg-red-500/10 p-4 rounded-full w-fit mx-auto mb-6">
          <AlertCircle size={32} className="text-red-500" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Something went wrong</h2>
        <p className="text-white/40 text-sm mb-8">
          The clock synchronization was interrupted. Please try again.
        </p>
        <button
          onClick={() => reset()}
          className="inline-flex items-center gap-2 px-6 py-3 bg-white text-black rounded-full font-medium hover:bg-white/90 transition-colors"
        >
          <RotateCcw size={18} />
          Try Again
        </button>
      </motion.div>
    </div>
  );
}
