"use client";

import { motion } from "framer-motion";

interface Props {
  label?: string;
  className?: string;
}

export default function GoldDivider({ label, className = "" }: Props) {
  return (
    <motion.div
      className={`gold-divider ${className}`}
      initial={{ opacity: 0, scaleX: 0 }}
      whileInView={{ opacity: 1, scaleX: 1 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
    >
      {label && (
        <span className="museum-label whitespace-nowrap">{label}</span>
      )}
    </motion.div>
  );
}
