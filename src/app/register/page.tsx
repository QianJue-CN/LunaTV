/* eslint-disable @typescript-eslint/no-explicit-any */

'use client';

import { AlertCircle, CheckCircle, Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { CURRENT_VERSION } from '@/lib/version';
import {
  validateUsername,
  validateEmail,
  checkPasswordStrength
} from '@/lib/validation';
import { checkForUpdates, UpdateStatus } from '@/lib/version_check';

import { useSite } from '@/components/SiteProvider';
import { ThemeToggle } from '@/components/ThemeToggle';

// 版本显示组件
function VersionDisplay() {
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkUpdate = async () => {
      try {
        const status = await checkForUpdates();
        setUpdateStatus(status);
      } catch (_) {
        // do nothing
      } finally {
        setIsChecking(false);
      }
    };

    checkUpdate();
  }, []);

  return (
    <button
      onClick={() =>
        window.open('https://github.com/MoonTechLab/LunaTV', '_blank')
      }
      className='absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 transition-colors cursor-pointer'
    >
      <span className='font-mono'>v{CURRENT_VERSION}</span>
      {!isChecking && updateStatus !== UpdateStatus.FETCH_FAILED && (
        <div
          className={`flex items-center gap-1.5 ${updateStatus === UpdateStatus.HAS_UPDATE
            ? 'text-yellow-600 dark:text-yellow-400'
            : updateStatus === UpdateStatus.NO_UPDATE
              ? 'text-green-600 dark:text-green-400'
              : ''
            }`}
        >
          {updateStatus === UpdateStatus.HAS_UPDATE && (
            <>
              <AlertCircle className='w-3.5 h-3.5' />
              <span className='font-semibold text-xs'>有新版本</span>
            </>
          )}
          {updateStatus === UpdateStatus.NO_UPDATE && (
            <>
              <CheckCircle className='w-3.5 h-3.5' />
              <span className='font-semibold text-xs'>已是最新</span>
            </>
          )}
        </div>
      )}
    </button>
  );
}

interface RegisterConfig {
  enabled: boolean;
  storageType: string;
  requirements: {
    username: {
      minLength: number;
      maxLength: number;
      pattern: string;
      description: string;
    };
    email: {
      maxLength: number;
      description: string;
    };
    password: {
      minLength: number;
      maxLength: number;
      pattern: string;
      description: string;
    };
  };
}

interface FormErrors {
  username?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  general?: string;
}

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [registerConfig, setRegisterConfig] = useState<RegisterConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);

  const { siteName } = useSite();

  // 获取注册配置
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await fetch('/api/register');
        if (res.ok) {
          const config = await res.json();
          setRegisterConfig(config);
          if (!config.enabled) {
            router.replace('/login');
          }
        } else {
          router.replace('/login');
        }
      } catch (error) {
        console.error('获取注册配置失败:', error);
        router.replace('/login');
      } finally {
        setConfigLoading(false);
      }
    };

    fetchConfig();
  }, [router]);

  // 实时验证
  const validateField = (field: string, value: string) => {
    const newErrors = { ...errors };

    switch (field) {
      case 'username': {
        const validation = validateUsername(value);
        if (!validation.isValid) {
          newErrors.username = validation.errors[0];
        } else {
          delete newErrors.username;
        }
        break;
      }

      case 'email': {
        const validation = validateEmail(value);
        if (!validation.isValid) {
          newErrors.email = validation.errors[0];
        } else {
          delete newErrors.email;
        }
        break;
      }

      case 'password': {
        if (!value) {
          newErrors.password = '密码不能为空';
        } else {
          const strength = checkPasswordStrength(value);
          if (!strength.isStrong) {
            newErrors.password = strength.feedback[0] || '密码强度不足';
          } else {
            delete newErrors.password;
          }
        }
        break;
      }

      case 'confirmPassword': {
        if (!value) {
          newErrors.confirmPassword = '请确认密码';
        } else if (value !== password) {
          newErrors.confirmPassword = '两次输入的密码不一致';
        } else {
          delete newErrors.confirmPassword;
        }
        break;
      }
    }

    setErrors(newErrors);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrors({});

    // 验证所有字段
    validateField('username', username);
    validateField('email', email);
    validateField('password', password);
    validateField('confirmPassword', confirmPassword);

    // 检查是否有错误
    if (Object.keys(errors).length > 0) {
      return;
    }

    if (!username || !email || !password || !confirmPassword) {
      setErrors({ general: '请填写所有必填字段' });
      return;
    }

    try {
      setLoading(true);
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          email,
          password,
          confirmPassword,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        // 注册成功，跳转到登录页面
        router.push('/login?message=注册成功，请登录');
      } else {
        if (data.details && Array.isArray(data.details)) {
          // 处理字段验证错误
          const fieldErrors: FormErrors = {};
          data.details.forEach((detail: any) => {
            fieldErrors[detail.field as keyof FormErrors] = detail.message;
          });
          setErrors(fieldErrors);
        } else {
          setErrors({ general: data.error || '注册失败' });
        }
      }
    } catch (error) {
      setErrors({ general: '网络错误，请稍后重试' });
    } finally {
      setLoading(false);
    }
  };

  if (configLoading) {
    return (
      <div className='min-h-screen flex items-center justify-center'>
        <div className='text-center'>
          <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto'></div>
          <p className='mt-2 text-gray-600 dark:text-gray-400'>加载中...</p>
        </div>
      </div>
    );
  }

  if (!registerConfig?.enabled) {
    return null;
  }

  return (
    <div className='relative min-h-screen flex items-center justify-center px-4 overflow-hidden'>
      <div className='absolute top-4 right-4'>
        <ThemeToggle />
      </div>
      <div className='relative z-10 w-full max-w-md rounded-3xl bg-gradient-to-b from-white/90 via-white/70 to-white/40 dark:from-zinc-900/90 dark:via-zinc-900/70 dark:to-zinc-900/40 backdrop-blur-xl shadow-2xl p-10 dark:border dark:border-zinc-800'>
        <h1 className='text-green-600 tracking-tight text-center text-3xl font-extrabold mb-2 bg-clip-text drop-shadow-sm'>
          {siteName}
        </h1>
        <p className='text-center text-gray-600 dark:text-gray-400 mb-8'>创建新账户</p>

        <form onSubmit={handleSubmit} className='space-y-6'>
          {/* 用户名 */}
          <div>
            <label htmlFor='username' className='sr-only'>
              用户名
            </label>
            <input
              id='username'
              type='text'
              autoComplete='username'
              className={`block w-full rounded-lg border-0 py-3 px-4 text-gray-900 dark:text-gray-100 shadow-sm ring-1 ${errors.username
                ? 'ring-red-500 focus:ring-red-500'
                : 'ring-white/60 dark:ring-white/20 focus:ring-green-500'
                } placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:ring-2 focus:outline-none sm:text-base bg-white/60 dark:bg-zinc-800/60 backdrop-blur`}
              placeholder='输入用户名'
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                validateField('username', e.target.value);
              }}
            />
            {errors.username && (
              <p className='mt-1 text-sm text-red-600 dark:text-red-400'>{errors.username}</p>
            )}
          </div>

          {/* 邮箱 */}
          <div>
            <label htmlFor='email' className='sr-only'>
              邮箱
            </label>
            <input
              id='email'
              type='email'
              autoComplete='email'
              className={`block w-full rounded-lg border-0 py-3 px-4 text-gray-900 dark:text-gray-100 shadow-sm ring-1 ${errors.email
                ? 'ring-red-500 focus:ring-red-500'
                : 'ring-white/60 dark:ring-white/20 focus:ring-green-500'
                } placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:ring-2 focus:outline-none sm:text-base bg-white/60 dark:bg-zinc-800/60 backdrop-blur`}
              placeholder='输入邮箱地址'
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                validateField('email', e.target.value);
              }}
            />
            {errors.email && (
              <p className='mt-1 text-sm text-red-600 dark:text-red-400'>{errors.email}</p>
            )}
          </div>

          {/* 密码 */}
          <div>
            <label htmlFor='password' className='sr-only'>
              密码
            </label>
            <div className='relative'>
              <input
                id='password'
                type={showPassword ? 'text' : 'password'}
                autoComplete='new-password'
                className={`block w-full rounded-lg border-0 py-3 px-4 pr-12 text-gray-900 dark:text-gray-100 shadow-sm ring-1 ${errors.password
                  ? 'ring-red-500 focus:ring-red-500'
                  : 'ring-white/60 dark:ring-white/20 focus:ring-green-500'
                  } placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:ring-2 focus:outline-none sm:text-base bg-white/60 dark:bg-zinc-800/60 backdrop-blur`}
                placeholder='输入密码'
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  validateField('password', e.target.value);
                  if (confirmPassword) {
                    validateField('confirmPassword', confirmPassword);
                  }
                }}
              />
              <button
                type='button'
                className='absolute inset-y-0 right-0 pr-3 flex items-center'
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff className='h-5 w-5 text-gray-400' />
                ) : (
                  <Eye className='h-5 w-5 text-gray-400' />
                )}
              </button>
            </div>
            {errors.password && (
              <p className='mt-1 text-sm text-red-600 dark:text-red-400'>{errors.password}</p>
            )}
          </div>

          {/* 确认密码 */}
          <div>
            <label htmlFor='confirmPassword' className='sr-only'>
              确认密码
            </label>
            <div className='relative'>
              <input
                id='confirmPassword'
                type={showConfirmPassword ? 'text' : 'password'}
                autoComplete='new-password'
                className={`block w-full rounded-lg border-0 py-3 px-4 pr-12 text-gray-900 dark:text-gray-100 shadow-sm ring-1 ${errors.confirmPassword
                  ? 'ring-red-500 focus:ring-red-500'
                  : 'ring-white/60 dark:ring-white/20 focus:ring-green-500'
                  } placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:ring-2 focus:outline-none sm:text-base bg-white/60 dark:bg-zinc-800/60 backdrop-blur`}
                placeholder='再次输入密码'
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  validateField('confirmPassword', e.target.value);
                }}
              />
              <button
                type='button'
                className='absolute inset-y-0 right-0 pr-3 flex items-center'
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ? (
                  <EyeOff className='h-5 w-5 text-gray-400' />
                ) : (
                  <Eye className='h-5 w-5 text-gray-400' />
                )}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className='mt-1 text-sm text-red-600 dark:text-red-400'>{errors.confirmPassword}</p>
            )}
          </div>

          {/* 通用错误信息 */}
          {errors.general && (
            <p className='text-sm text-red-600 dark:text-red-400 text-center'>{errors.general}</p>
          )}

          {/* 注册按钮 */}
          <button
            type='submit'
            disabled={
              !username || !email || !password || !confirmPassword || loading || Object.keys(errors).length > 0
            }
            className='inline-flex w-full justify-center rounded-lg bg-green-600 py-3 text-base font-semibold text-white shadow-lg transition-all duration-200 hover:from-green-600 hover:to-blue-600 disabled:cursor-not-allowed disabled:opacity-50'
          >
            {loading ? '注册中...' : '注册'}
          </button>

          {/* 登录链接 */}
          <div className='text-center'>
            <p className='text-sm text-gray-600 dark:text-gray-400'>
              已有账户？{' '}
              <Link
                href='/login'
                className='font-medium text-green-600 hover:text-green-500 transition-colors'
              >
                立即登录
              </Link>
            </p>
          </div>
        </form>
      </div>

      {/* 版本信息显示 */}
      <VersionDisplay />
    </div>
  );
}
