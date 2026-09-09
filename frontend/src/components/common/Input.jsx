import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

const Input = React.forwardRef(({
  label,
  type = 'text',
  error,
  iconLeft,
  placeholder,
  className = '',
  id,
  ...props
}, ref) => {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';

  const handleTogglePassword = () => {
    setShowPassword(!showPassword);
  };

  const inputType = isPassword && showPassword ? 'text' : type;

  return (
    <div className={`input-wrapper ${className}`}>
      {label && <label htmlFor={id} className="input-label">{label}</label>}
      <div className="input-field-container">
        {iconLeft && <span className="input-icon-left">{iconLeft}</span>}
        <input
          ref={ref}
          id={id}
          type={inputType}
          placeholder={placeholder}
          className={`input-field ${iconLeft ? 'input-field-has-icon' : ''} ${error ? 'input-error' : ''}`}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            className="input-icon-right"
            onClick={handleTogglePassword}
            tabIndex={-1}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </div>
      {error && <span className="input-error-msg">{error}</span>}
    </div>
  );
});

Input.displayName = 'Input';

export default Input;
