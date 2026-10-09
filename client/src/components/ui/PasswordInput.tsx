import React, { useState } from 'react';
import { Input, InputProps } from './Input';
import { Eye, EyeOff, Lock } from 'lucide-react';

export const PasswordInput: React.FC<InputProps> = (props) => {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <Input
      type={showPassword ? 'text' : 'password'}
      leftIcon={<Lock className="w-4 h-4" />}
      rightIcon={
        <button
          type="button"
          onClick={() => setShowPassword((prev) => !prev)}
          className="p-1 text-slate-400 hover:text-slate-200 focus:outline-none"
          tabIndex={-1}
          aria-label={showPassword ? 'Hide password' : 'Show password'}
        >
          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      }
      {...props}
    />
  );
};
