import { z } from 'zod';

// 用户名验证规则
export const usernameSchema = z
  .string()
  .min(3, '用户名至少3个字符')
  .max(20, '用户名最多20个字符')
  .regex(/^[a-zA-Z0-9_]+$/, '用户名只能包含字母、数字和下划线')
  .refine((val) => !val.startsWith('_') && !val.endsWith('_'), {
    message: '用户名不能以下划线开头或结尾',
  })
  .refine((val) => !/_{2,}/.test(val), {
    message: '用户名不能包含连续的下划线',
  });

// 邮箱验证规则
export const emailSchema = z
  .string()
  .email('邮箱格式不正确')
  .max(100, '邮箱地址过长')
  .refine(
    (val) => {
      // 检查邮箱域名是否合法
      const domain = val.split('@')[1];
      return domain && domain.includes('.') && domain.length >= 4;
    },
    {
      message: '邮箱域名格式不正确',
    }
  );

// 密码验证规则（降低要求）
export const passwordSchema = z
  .string()
  .min(6, '密码至少6个字符')  // 降低最小长度要求
  .max(50, '密码最多50个字符')
  .regex(/^(?=.*[a-zA-Z])(?=.*\d)/, '密码必须包含字母和数字')
  .refine(
    (val) => {
      // 使用更宽松的密码强度检查
      const hasLetter = /[a-zA-Z]/.test(val);
      const hasNumber = /\d/.test(val);
      const isNotTooSimple = !/^(123456|password|admin)$/i.test(val);

      return hasLetter && hasNumber && isNotTooSimple;
    },
    {
      message: '密码需要包含字母和数字，不能是常见的简单密码',
    }
  );

// 完整的注册表单验证
export const registerFormSchema = z
  .object({
    username: usernameSchema,
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: '两次输入的密码不一致',
    path: ['confirmPassword'],
  });

// 登录表单验证
export const loginFormSchema = z.object({
  username: z.string().optional(),
  password: z.string().min(1, '密码不能为空'),
});

// 密码强度检查函数
export function checkPasswordStrength(password: string): {
  score: number;
  feedback: string[];
  isStrong: boolean;
} {
  const feedback: string[] = [];
  let score = 0;

  // 基本长度要求
  if (password.length < 8) {
    feedback.push('密码长度至少8个字符');
  } else {
    score += 2; // 长度符合要求给更高分
  }

  // 检查是否包含字母（大小写都算）
  const hasLetter = /[a-zA-Z]/.test(password);
  if (!hasLetter) {
    feedback.push('包含字母');
  } else {
    score += 2; // 包含字母是基本要求
  }

  // 检查是否包含数字
  if (!/\d/.test(password)) {
    feedback.push('包含数字');
  } else {
    score += 2; // 包含数字是基本要求
  }

  // 以下是加分项，不是必需的
  if (/[a-z]/.test(password)) {
    score += 1; // 包含小写字母加分
  }

  if (/[A-Z]/.test(password)) {
    score += 1; // 包含大写字母加分
  }

  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    score += 1; // 包含特殊字符加分
  }

  // 检查极其简单的弱密码模式（更宽松的检查）
  const commonPatterns = [
    /^123456$/,       // 完全是123456
    /^password$/i,    // 完全是password
    /^admin$/i,       // 完全是admin
    /^(.)\1{7,}$/,    // 8个或以上相同字符
  ];

  if (commonPatterns.some((pattern) => pattern.test(password))) {
    feedback.push('避免使用过于简单的密码');
    score = Math.max(0, score - 1);
  }

  // 检查重复字符
  if (/(.)\1{2,}/.test(password)) {
    feedback.push('避免连续重复字符');
    score = Math.max(0, score - 1);
  }

  // 大幅降低强度要求：只要包含字母+数字且长度足够就算强密码
  const hasBasicRequirements = password.length >= 8 && hasLetter && /\d/.test(password);
  const hasSimplePattern = commonPatterns.some((pattern) => pattern.test(password));

  return {
    score,
    feedback,
    isStrong: hasBasicRequirements && !hasSimplePattern,
  };
}

// 用户名可用性检查（客户端辅助函数）
export function validateUsername(username: string): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!username) {
    errors.push('用户名不能为空');
    return { isValid: false, errors };
  }

  if (username.length < 3) {
    errors.push('用户名至少3个字符');
  }

  if (username.length > 20) {
    errors.push('用户名最多20个字符');
  }

  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    errors.push('用户名只能包含字母、数字和下划线');
  }

  if (username.startsWith('_') || username.endsWith('_')) {
    errors.push('用户名不能以下划线开头或结尾');
  }

  if (/_{2,}/.test(username)) {
    errors.push('用户名不能包含连续的下划线');
  }

  // 检查保留用户名
  const reservedNames = [
    'admin',
    'administrator',
    'root',
    'system',
    'api',
    'www',
    'mail',
    'email',
    'support',
    'help',
    'info',
    'contact',
    'user',
    'users',
    'guest',
    'public',
    'private',
    'test',
    'demo',
    'example',
    'null',
    'undefined',
    'true',
    'false',
  ];

  if (reservedNames.includes(username.toLowerCase())) {
    errors.push('该用户名为系统保留，请选择其他用户名');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

// 邮箱格式验证（客户端辅助函数）
export function validateEmail(email: string): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!email) {
    errors.push('邮箱不能为空');
    return { isValid: false, errors };
  }

  if (email.length > 100) {
    errors.push('邮箱地址过长');
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push('邮箱格式不正确');
  } else {
    const domain = email.split('@')[1];
    if (!domain || !domain.includes('.') || domain.length < 4) {
      errors.push('邮箱域名格式不正确');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

// 通用表单验证错误处理
export interface ValidationError {
  field: string;
  message: string;
}

export function formatValidationErrors(error: z.ZodError): ValidationError[] {
  return error.errors.map((err) => ({
    field: err.path.join('.'),
    message: err.message,
  }));
}

// 安全相关的验证
export function validateSecurityRequirements(data: {
  username: string;
  email: string;
  password: string;
}): {
  isSecure: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];

  // 只检查密码是否与用户名完全相同（大小写不敏感）
  if (data.password.toLowerCase() === data.username.toLowerCase()) {
    warnings.push('密码不能与用户名相同');
  }

  // 只检查密码是否与邮箱完全相同
  if (data.password.toLowerCase() === data.email.toLowerCase()) {
    warnings.push('密码不能与邮箱相同');
  }

  // 移除了过于严格的个人信息检查

  return {
    isSecure: warnings.length === 0,
    warnings,
  };
}
