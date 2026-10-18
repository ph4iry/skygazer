import { motion } from 'motion/react';

// shown in place of the results while a search loads: "now loading" between two lines
export default function LoadingDivider() {
  return (
    <motion.div
      role="status"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="w-full max-w-3xl mx-auto my-8 flex items-center gap-4 font-body text-sm text-blue-200"
    >
      <motion.span
        aria-hidden
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="h-px flex-1 origin-right bg-gradient-to-l from-blue-200/60 to-transparent"
      />
      <motion.span
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
        className="tracking-widest lowercase"
      >
        now loading
      </motion.span>
      <motion.span
        aria-hidden
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="h-px flex-1 origin-left bg-gradient-to-r from-blue-200/60 to-transparent"
      />
    </motion.div>
  );
}
