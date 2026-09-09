import React from 'react';
import { motion } from 'framer-motion';

const Button = ({
  children,
  onClick,
  type = 'button',
  variant = 'primary', // 'primary', 'secondary', 'outline', 'danger', 'icon'
  disabled = false,
  loading = false,
  className = '',
  width,
  iconLeft,
  iconRight,
  ...props
}) => {
  const buttonStyle = width ? { '--btn-width': width } : {};

  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`btn btn-${variant} ${className}`}
      style={buttonStyle}
      whileHover={!disabled && !loading ? { scale: 1.02 } : {}}
      whileTap={!disabled && !loading ? { scale: 0.98 } : {}}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      {...props}
    >
      {loading ? (
        <span className="spinner"></span>
      ) : (
        <>
          {iconLeft && <span className="btn-icon-left">{iconLeft}</span>}
          {children}
          {iconRight && <span className="btn-icon-right">{iconRight}</span>}
        </>
      )}
    </motion.button>
  );
};

export default Button;
