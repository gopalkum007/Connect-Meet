import React from 'react';

const Switch = ({ checked, onChange, label, className = '' }) => {
  return (
    <div className={`switch-container ${className}`} onClick={() => onChange(!checked)}>
      <div className={`switch-track ${checked ? 'active' : ''}`}>
        <div className="switch-thumb" />
      </div>
      {label && <span className="switch-label">{label}</span>}
    </div>
  );
};

export default Switch;
