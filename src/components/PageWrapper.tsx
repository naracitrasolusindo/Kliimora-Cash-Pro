import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

const pageVariants = {
  initial: { opacity: 0, y: 15 },
  in: { opacity: 1, y: 0 },
  out: { opacity: 0, y: -15 }
};

const pageTransition = {
  type: 'tween',
  ease: 'easeOut',
  duration: 0.3
};

interface Props {
  children: ReactNode;
}

export default function PageWrapper({ children }: Props) {
  return (
    <motion.div
      initial="initial"
      animate="in"
      exit="out"
      variants={pageVariants}
      transition={pageTransition}
      style={{ height: '100%' }}
    >
      {children}
    </motion.div>
  );
}
