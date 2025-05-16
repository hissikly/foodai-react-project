// components/Login.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { register, loginWithGoogle } from '../services/firebase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [lockoutTime, setLockoutTime] = useState(null);
  const { login } = useAuth();
  const navigate = useNavigate();

  // Очистка блокировки при размонтировании
  useEffect(() => {
    return () => {
      if (lockoutTime) {
        clearTimeout(lockoutTime);
      }
    };
  }, [lockoutTime]);

  const validateInputs = () => {
    if (!email || !password) {
      setError('Пожалуйста, заполните все поля');
      return false;
    }

    // Валидация email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Пожалуйста, введите корректный email');
      return false;
    }

    // Валидация пароля
    if (isRegistering && password.length < 8) {
      setError('Пароль должен содержать минимум 8 символов');
      return false;
    }

    if (isRegistering && !/[A-Z]/.test(password)) {
      setError('Пароль должен содержать хотя бы одну заглавную букву');
      return false;
    }

    if (isRegistering && !/[0-9]/.test(password)) {
      setError('Пароль должен содержать хотя бы одну цифру');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Проверка блокировки
    if (lockoutTime) {
      setError('Слишком много попыток входа. Пожалуйста, подождите 15 минут');
      return;
    }

    if (!validateInputs()) {
      return;
    }

    try {
      if (isRegistering) {
        await register(email, password);
      }
      await login(email, password);
      setLoginAttempts(0);
      navigate('/');
    } catch (err) {
      console.error('Ошибка аутентификации:', err);
      setLoginAttempts(prev => prev + 1);
      
      if (loginAttempts >= 4) {
        setLockoutTime(setTimeout(() => {
          setLoginAttempts(0);
          setLockoutTime(null);
        }, 15 * 60 * 1000)); // 15 минут блокировки
        setError('Слишком много попыток входа. Пожалуйста, подождите 15 минут');
      } else {
        setError(isRegistering 
          ? 'Ошибка при регистрации. Возможно, такой email уже существует.' 
          : 'Ошибка входа. Проверьте логин или пароль.');
      }
    }
  };

  const handleGoogleLogin = async () => {
    if (lockoutTime) {
      setError('Слишком много попыток входа. Пожалуйста, подождите 15 минут');
      return;
    }

    try {
      await loginWithGoogle();
      setLoginAttempts(0);
      navigate('/');
    } catch (err) {
      console.error('Ошибка входа через Google:', err);
      setError('Ошибка при входе через Google');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f4fff6]">
      <div className="bg-white rounded-xl shadow-md p-8 w-full max-w-md flex flex-col items-center">
        <h2 className="text-xl font-bold mb-6 text-center">{isRegistering ? 'Регистрация' : 'Вход'}</h2>
        {error && <div className="text-red-500 text-sm mb-3 w-full text-center">{error}</div>}
        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-3">
          <input
            type="email"
            placeholder="some@gmail.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-green-200 bg-gray-50"
            autoComplete="email"
            required
          />
          <input
            type="password"
            placeholder="•••••"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-green-200 bg-gray-50"
            autoComplete={isRegistering ? "new-password" : "current-password"}
            required
          />
          <button
            type="submit"
            className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-2 rounded transition-colors"
          >
            {isRegistering ? 'Зарегистрироваться' : 'Войти'}
          </button>
        </form>
        <div className="w-full flex items-center my-4">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="mx-2 text-gray-400 text-sm">или</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>
        <button
          onClick={handleGoogleLogin}
          className="w-full flex items-center justify-center gap-2 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 py-2 rounded transition-colors font-medium"
          type="button"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Войти через Google
        </button>
        <div className="mt-4 text-center w-full">
          <button
            type="button"
            onClick={() => setIsRegistering(!isRegistering)}
            className="text-green-600 hover:underline text-sm"
          >
            {isRegistering ? 'Уже есть аккаунт? Войти' : 'Нет аккаунта? Зарегистрироваться'}
          </button>
        </div>
      </div>
    </div>
  );
}