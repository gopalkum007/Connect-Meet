import React from 'react';

const Avatar = ({ name = '', src, size = 40, className = '' }) => {
  const getInitials = (fullName) => {
    if (!fullName) return '?';
    const parts = fullName.split(' ');
    if (parts.length > 1) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return fullName.slice(0, 2).toUpperCase();
  };

  const style = {
    width: size,
    height: size,
    fontSize: size * 0.4,
  };

  return (
    <div className={`avatar ${className}`} style={style}>
      {src ? (
        <img src={src} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <span>{getInitials(name)}</span>
      )}
    </div>
  );
};

export default Avatar;
