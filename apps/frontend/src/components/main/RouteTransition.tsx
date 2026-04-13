import { motion } from "framer-motion";
import { type ReactNode } from "react";

interface RouteTransitionProps {
  children: ReactNode;
}

/**
 * Professional route transition wrapper to provide a smooth
 * page transition effect during navigation.
 */
export function RouteTransition({ children }: RouteTransitionProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      transition={{ 
        duration: 0.3,
        ease: [0.23, 1, 0.32, 1] // Professional ease-out quint
      }}
      className="w-full h-full"
    >
      {children}
    </motion.div>
  );
}
