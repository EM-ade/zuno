"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface LoadingOverlayProps {
  isVisible: boolean;
  title?: string;
  subtitle?: string;
  progress?: number;
  preventClose?: boolean;
  variant?: "default" | "mint" | "upload" | "create";
}

export default function LoadingOverlay({
  isVisible,
  title = "Processing...",
  subtitle,
  progress,
  preventClose = true,
  variant = "default",
}: LoadingOverlayProps) {
  const [dots, setDots] = useState("");

  useEffect(() => {
    if (!isVisible) return;

    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? "" : prev + "."));
    }, 500);

    return () => clearInterval(interval);
  }, [isVisible]);

  const getVariantStyles = () => {
    switch (variant) {
      case "mint":
        return {
          gradient: "from-green-900/95 via-emerald-900/95 to-teal-900/95",
          accent: "text-green-400",
          spinner: "border-green-400",
          glow: "shadow-green-500/20",
        };
      case "upload":
        return {
          gradient: "from-purple-900/95 via-violet-900/95 to-indigo-900/95",
          accent: "text-purple-400",
          spinner: "border-purple-400",
          glow: "shadow-purple-500/20",
        };
      case "create":
        return {
          gradient: "from-blue-900/95 via-cyan-900/95 to-sky-900/95",
          accent: "text-blue-400",
          spinner: "border-blue-400",
          glow: "shadow-blue-500/20",
        };
      default:
        return {
          gradient: "from-gray-900/95 via-slate-900/95 to-zinc-900/95",
          accent: "text-white",
          spinner: "border-white",
          glow: "shadow-white/20",
        };
    }
  };

  const styles = getVariantStyles();

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className={`fixed inset-0 z-[9999] flex items-center justify-center bg-gradient-to-br ${styles.gradient} backdrop-blur-sm`}
          style={{ pointerEvents: preventClose ? "all" : "none" }}
        >
          {/* Background Pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.1),transparent_50%)]" />
            <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.05)_50%,transparent_75%)] bg-[length:20px_20px]" />
          </div>

          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="relative flex flex-col items-center p-8 rounded-2xl bg-black/20 backdrop-blur-md border border-white/10 shadow-2xl"
          >
            {/* Animated Spinner */}
            <div className="relative mb-6">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className={`w-16 h-16 border-4 ${styles.spinner} border-t-transparent rounded-full ${styles.glow} shadow-2xl`}
              />
              <motion.div
                animate={{ rotate: -360 }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                className={`absolute inset-2 border-2 ${styles.spinner} border-b-transparent rounded-full opacity-60`}
              />
            </div>

            {/* Title */}
            <motion.h2
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className={`text-2xl font-bold ${styles.accent} mb-2 text-center`}
            >
              {title}
              {dots}
            </motion.h2>

            {/* Subtitle */}
            {subtitle && (
              <motion.p
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.3 }}
                className="text-gray-300 text-center max-w-md mb-4"
              >
                {subtitle}
              </motion.p>
            )}

            {/* Progress Bar */}
            {progress !== undefined && (
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: "auto", opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.4 }}
                className="w-64 bg-gray-700 rounded-full h-2 mb-4 overflow-hidden"
              >
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.5 }}
                  className={`h-full bg-gradient-to-r ${
                    styles.accent === "text-green-400"
                      ? "from-green-400 to-emerald-500"
                      : styles.accent === "text-purple-400"
                      ? "from-purple-400 to-violet-500"
                      : styles.accent === "text-blue-400"
                      ? "from-blue-400 to-cyan-500"
                      : "from-white to-gray-300"
                  } rounded-full shadow-lg`}
                />
              </motion.div>
            )}

            {/* Progress Text */}
            {progress !== undefined && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.5 }}
                className="text-sm text-gray-400"
              >
                {Math.round(progress)}% Complete
              </motion.span>
            )}

            {/* Pulsing Dots */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.6 }}
              className="flex space-x-2 mt-4"
            >
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  animate={{
                    scale: [1, 1.2, 1],
                    opacity: [0.5, 1, 0.5],
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    delay: i * 0.2,
                  }}
                  className={`w-2 h-2 ${styles.spinner.replace(
                    "border-",
                    "bg-"
                  )} rounded-full`}
                />
              ))}
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
