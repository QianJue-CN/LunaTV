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
  .refine((val) => {
    // 检查邮箱域名是否合法
    const domain = val.split('@')[1];
    return domain && domain.includes('.') && domain.length >= 4;
  }, {
    message: '邮箱域名格式不正确',
  });

// 密码验证规则
export const passwordSchema = z
  .string()
  .min(8, '密码至少8个字符')
  .max(50, '密码最多50个字符')
  .regex(/^(?=.*[a-zA-Z])(?=.*\d)/, '密码必须包含字母和数字')
  .refine((val) => {
    // 检查密码强度
    const hasLowerCase = /[a-z]/.test(val);
    const hasUpperCase = /[A-Z]/.test(val);
    const hasNumbers = /\d/.test(val);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(val);
    
    let strength = 0;
    if (hasLowerCase) strength++;
    if (hasUpperCase) strength++;
    if (hasNumbers) strength++;
    if (hasSpecialChar) strength++;
    
    return strength >= 2; // 至少包含2种类型的字符
  }, {
    message: '密码强度不足，建议包含大小写字母、数字或特殊字符',
  });

// 完整的注册表单验证
export const registerFormSchema = z.object({
  username: usernameSchema,
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
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

  if (password.length < 8) {
    feedback.push('密码长度至少8个字符');
  } else {
    score += 1;
  }

  if (!/[a-z]/.test(password)) {
    feedback.push('包含小写字母');
  } else {
    score += 1;
  }

  if (!/[A-Z]/.test(password)) {
    feedback.push('包含大写字母');
  } else {
    score += 1;
  }

  if (!/\d/.test(password)) {
    feedback.push('包含数字');
  } else {
    score += 1;
  }

  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    feedback.push('包含特殊字符');
  } else {
    score += 1;
  }

  // 检查常见弱密码模式
  const commonPatterns = [
    /123456/,
    /password/i,
    /qwerty/i,
    /abc123/i,
    /admin/i,
  ];

  if (commonPatterns.some(pattern => pattern.test(password))) {
    feedback.push('避免使用常见密码模式');
    score = Math.max(0, score - 2);
  }

  // 检查重复字符
  if (/(.)\1{2,}/.test(password)) {
    feedback.push('避免连续重复字符');
    score = Math.max(0, score - 1);
  }

  return {
    score,
    feedback,
    isStrong: score >= 3 && feedback.length <= 2,
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
    'admin', 'administrator', 'root', 'system', 'api', 'www',
    'mail', 'email', 'support', 'help', 'info', 'contact',
    'user', 'users', 'guest', 'public', 'private', 'test',
    'demo', 'example', 'null', 'undefined', 'true', 'false',
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
  return error.errors.map(err => ({
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

  // 检查用户名和密码是否过于相似
  if (data.password.toLowerCase().includes(data.username.toLowerCase())) {
    warnings.push('密码不应包含用户名');
  }

  // 检查邮箱和密码是否过于相似
  const emailLocal = data.email.split('@')[0];
  if (data.password.toLowerCase().includes(emailLocal.toLowerCase())) {
    warnings.push('密码不应包含邮箱前缀');
  }

  // 检查密码是否包含个人信息
  const personalInfo = [data.username, emailLocal, data.email.split('@')[1]];
  for (const info of personalInfo) {
    if (info.length >= 3 && data.password.toLowerCase().includes(info.toLowerCase())) {
      warnings.push('密码不应包含个人信息');
      break;
    }
  }

  return {
    isSecure: warnings.length === 0,
    warnings,
  };
}
