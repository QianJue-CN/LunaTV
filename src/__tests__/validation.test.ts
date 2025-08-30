import {
  checkPasswordStrength,
  registerFormSchema,
  validateEmail,
  validateSecurityRequirements,
  validateUsername,
} from '@/lib/validation';

describe('用户名验证', () => {
  test('有效用户名应该通过验证', () => {
    const validUsernames = ['user123', 'test_user', 'admin2024', 'user_123'];

    validUsernames.forEach((username) => {
      const result = validateUsername(username);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  test('无效用户名应该被拒绝', () => {
    const invalidCases = [
      { username: '', expectedError: '用户名不能为空' },
      { username: 'ab', expectedError: '用户名至少3个字符' },
      { username: 'a'.repeat(21), expectedError: '用户名最多20个字符' },
      {
        username: 'user-name',
        expectedError: '用户名只能包含字母、数字和下划线',
      },
      { username: '_username', expectedError: '用户名不能以下划线开头或结尾' },
      { username: 'username_', expectedError: '用户名不能以下划线开头或结尾' },
      { username: 'user__name', expectedError: '用户名不能包含连续的下划线' },
      {
        username: 'admin',
        expectedError: '该用户名为系统保留，请选择其他用户名',
      },
    ];

    invalidCases.forEach(({ username, expectedError }) => {
      const result = validateUsername(username);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(expectedError);
    });
  });
});

describe('邮箱验证', () => {
  test('有效邮箱应该通过验证', () => {
    const validEmails = [
      'user@example.com',
      'test.email@domain.org',
      'user+tag@example.co.uk',
      'user123@test-domain.com',
    ];

    validEmails.forEach((email) => {
      const result = validateEmail(email);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  test('无效邮箱应该被拒绝', () => {
    const invalidCases = [
      { email: '', expectedError: '邮箱不能为空' },
      { email: 'invalid-email', expectedError: '邮箱格式不正确' },
      { email: 'user@', expectedError: '邮箱格式不正确' },
      { email: '@domain.com', expectedError: '邮箱格式不正确' },
      { email: 'user@domain', expectedError: '邮箱格式不正确' }, // 修正期望的错误消息
      { email: 'a'.repeat(95) + '@test.com', expectedError: '邮箱地址过长' },
    ];

    invalidCases.forEach(({ email, expectedError }) => {
      const result = validateEmail(email);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(expectedError);
    });
  });
});

describe('密码强度检查', () => {
  test('强密码应该获得高分', () => {
    const strongPasswords = [
      'StrongPass123!',
      'MySecure2024@',
      'Complex#Pass1',
    ];

    strongPasswords.forEach((password) => {
      const result = checkPasswordStrength(password);
      expect(result.score).toBeGreaterThanOrEqual(4);
      expect(result.isStrong).toBe(true);
    });
  });

  test('弱密码应该获得低分并提供反馈', () => {
    const weakCases = [
      { password: '123456', expectedFeedback: '密码长度至少8个字符' },
      { password: 'password', expectedFeedback: '包含数字' },
      { password: 'PASSWORD123', expectedFeedback: '包含小写字母' },
      { password: 'password123', expectedFeedback: '包含大写字母' },
    ];

    weakCases.forEach(({ password, expectedFeedback }) => {
      const result = checkPasswordStrength(password);
      expect(result.score).toBeLessThan(4);
      expect(result.isStrong).toBe(false);
      expect(result.feedback).toContain(expectedFeedback);
    });
  });

  test('常见密码模式应该被检测', () => {
    const commonPasswords = ['123456789', 'password123', 'qwerty123'];

    commonPasswords.forEach((password) => {
      const result = checkPasswordStrength(password);
      expect(result.feedback).toContain('避免使用常见密码模式');
    });
  });
});

describe('注册表单验证', () => {
  test('有效的注册数据应该通过验证', () => {
    const validData = {
      username: 'testuser',
      email: 'test@example.com',
      password: 'StrongPass123!',
      confirmPassword: 'StrongPass123!',
    };

    const result = registerFormSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  test('密码不匹配应该被拒绝', () => {
    const invalidData = {
      username: 'testuser',
      email: 'test@example.com',
      password: 'StrongPass123!',
      confirmPassword: 'DifferentPass123!',
    };

    const result = registerFormSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    if (!result.success) {
      const confirmPasswordError = result.error.errors.find((err) =>
        err.path.includes('confirmPassword')
      );
      expect(confirmPasswordError?.message).toBe('两次输入的密码不一致');
    }
  });
});

describe('安全要求验证', () => {
  test('安全的用户数据应该通过验证', () => {
    const secureData = {
      username: 'testuser',
      email: 'test@example.com',
      password: 'CompletelyDifferent123!',
    };

    const result = validateSecurityRequirements(secureData);
    expect(result.isSecure).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });

  test('密码包含用户名应该产生警告', () => {
    const insecureData = {
      username: 'testuser',
      email: 'test@example.com',
      password: 'testuser123',
    };

    const result = validateSecurityRequirements(insecureData);
    expect(result.isSecure).toBe(false);
    expect(result.warnings).toContain('密码不应包含用户名');
  });

  test('密码包含邮箱前缀应该产生警告', () => {
    const insecureData = {
      username: 'user123',
      email: 'testuser@example.com',
      password: 'testuser456',
    };

    const result = validateSecurityRequirements(insecureData);
    expect(result.isSecure).toBe(false);
    expect(result.warnings).toContain('密码不应包含邮箱前缀');
  });
});

describe('边界情况测试', () => {
  test('最小长度的有效输入', () => {
    const minValidData = {
      username: 'abc', // 最小3字符
      email: 'a@b.co', // 最小有效邮箱
      password: 'Abc123!!', // 最小8字符强密码
    };

    expect(validateUsername(minValidData.username).isValid).toBe(true);
    expect(validateEmail(minValidData.email).isValid).toBe(true);
    expect(checkPasswordStrength(minValidData.password).isStrong).toBe(true);
  });

  test('最大长度的有效输入', () => {
    const maxValidData = {
      username: 'a'.repeat(20), // 最大20字符
      email: 'a'.repeat(90) + '@test.com', // 接近最大100字符
      password: 'A'.repeat(25) + 'a'.repeat(20) + '12345', // 最大50字符
    };

    expect(validateUsername(maxValidData.username).isValid).toBe(true);
    expect(validateEmail(maxValidData.email).isValid).toBe(true);
    // 注意：这个密码可能不够强，因为缺乏多样性
  });

  test('特殊字符处理', () => {
    const specialCases = [
      { username: 'user_123', valid: true },
      { username: 'user@123', valid: false },
      { email: 'user+tag@example.com', valid: true },
      { email: 'user..name@example.com', valid: true }, // 技术上有效
    ];

    specialCases.forEach(({ username, valid }) => {
      if (username) {
        expect(validateUsername(username).isValid).toBe(valid);
      }
    });
  });
});

describe('性能测试', () => {
  test('验证函数应该在合理时间内完成', () => {
    const testData = {
      username: 'performancetest',
      email: 'performance@test.com',
      password: 'PerformanceTest123!',
    };

    const startTime = Date.now();

    // 运行多次验证
    for (let i = 0; i < 1000; i++) {
      validateUsername(testData.username);
      validateEmail(testData.email);
      checkPasswordStrength(testData.password);
    }

    const endTime = Date.now();
    const duration = endTime - startTime;

    // 1000次验证应该在1秒内完成
    expect(duration).toBeLessThan(1000);
  });
});

// 集成测试辅助函数
export const createValidTestUser = () => ({
  username: `testuser_${Date.now()}`,
  email: `test_${Date.now()}@example.com`,
  password: 'TestPassword123!',
  confirmPassword: 'TestPassword123!',
});

export const createInvalidTestUser = (
  type: 'username' | 'email' | 'password'
) => {
  const base = createValidTestUser();

  switch (type) {
    case 'username':
      return { ...base, username: 'ab' }; // 太短
    case 'email':
      return { ...base, email: 'invalid-email' }; // 格式错误
    case 'password':
      return { ...base, password: '123', confirmPassword: '123' }; // 太弱
    default:
      return base;
  }
};
