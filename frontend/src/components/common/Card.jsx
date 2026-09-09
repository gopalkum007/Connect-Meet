import React from 'react';
import { motion } from 'framer-motion';

const Card = ({ children, className = '', hover = false, onClick, ...props }) => {
  const Component = onClick ? motion.div : 'div';
  const motionProps = onClick ? {
    whileHover: { y: -4, boxShadow: 'var(--shadow-lg)' },
    whileTap: { scale: 0.99 },
    transition: { duration: 0.2 }
  } : {};

  return (
    <Component
      onClick={onClick}
      className={`card ${hover ? 'card-hover' : ''} ${className}`}
      {...motionProps}
      {...props}
    >
      {children}
    </Component>
  );
};

export default Card;
