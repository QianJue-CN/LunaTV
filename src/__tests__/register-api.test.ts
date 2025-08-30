/**
 * 注册API集成测试
 * 注意：这些测试需要在支持数据库存储的环境中运行
 */

import { NextRequest } from 'next/server';

import { GET, POST } from '@/app/api/register/route';

import { createInvalidTestUser, createValidTestUser } from './validation.test';

// Mock环境变量
const originalEnv = process.env;

beforeEach(() => {
  jest.resetModules();
  process.env = {
    ...originalEnv,
    NEXT_PUBLIC_STORAGE_TYPE: 'redis', // 模拟Redis存储
  };
});

afterEach(() => {
  process.env = originalEnv;
});

// Mock数据库
const mockDb = {
  checkUserExist: jest.fn(),
  checkEmailExist: jest.fn(),
  registerUser: jest.fn(),
};

jest.mock('@/lib/db', () => ({
  db: mockDb,
}));

describe('注册API - GET /api/register', () => {
  test('应该返回注册配置信息', async () => {
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('enabled', true);
    expect(data).toHaveProperty('storageType', 'redis');
    expect(data).toHaveProperty('requirements');
    expect(data.requirements).toHaveProperty('username');
    expect(data.requirements).toHaveProperty('email');
    expect(data.requirements).toHaveProperty('password');
  });

  test('localStorage模式应该禁用注册', async () => {
    process.env.NEXT_PUBLIC_STORAGE_TYPE = 'localstorage';

    const response = await GET();
    const data = await response.json();

    expect(data.enabled).toBe(false);
    expect(data.storageType).toBe('localstorage');
  });
});

describe('注册API - POST /api/register', () => {
  beforeEach(() => {
    // 重置所有mock
    mockDb.checkUserExist.mockReset();
    mockDb.checkEmailExist.mockReset();
    mockDb.registerUser.mockReset();
  });

  test('有效数据应该成功注册', async () => {
    const testUser = createValidTestUser();

    // Mock数据库响应
    mockDb.checkUserExist.mockResolvedValue(false);
    mockDb.checkEmailExist.mockResolvedValue(false);
    mockDb.registerUser.mockResolvedValue(undefined);

    const request = new NextRequest('http://localhost/api/register', {
      method: 'POST',
      body: JSON.stringify(testUser),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toBe('注册成功');
    expect(data.data.username).toBe(testUser.username);
    expect(data.data.email).toBe(testUser.email);

    // 验证数据库调用
    expect(mockDb.checkUserExist).toHaveBeenCalledWith(testUser.username);
    expect(mockDb.checkEmailExist).toHaveBeenCalledWith(testUser.email);
    expect(mockDb.registerUser).toHaveBeenCalledWith(
      testUser.username,
      testUser.password,
      testUser.email
    );
  });

  test('localStorage模式应该拒绝注册', async () => {
    process.env.NEXT_PUBLIC_STORAGE_TYPE = 'localstorage';

    const testUser = createValidTestUser();
    const request = new NextRequest('http://localhost/api/register', {
      method: 'POST',
      body: JSON.stringify(testUser),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('当前配置不支持用户注册功能');
  });

  test('无效用户名应该被拒绝', async () => {
    const testUser = createInvalidTestUser('username');

    const request = new NextRequest('http://localhost/api/register', {
      method: 'POST',
      body: JSON.stringify(testUser),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('输入数据验证失败');
    expect(data.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'username',
          message: expect.stringContaining('用户名'),
        }),
      ])
    );
  });

  test('无效邮箱应该被拒绝', async () => {
    const testUser = createInvalidTestUser('email');

    const request = new NextRequest('http://localhost/api/register', {
      method: 'POST',
      body: JSON.stringify(testUser),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('输入数据验证失败');
    expect(data.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'email',
          message: expect.stringContaining('邮箱'),
        }),
      ])
    );
  });

  test('弱密码应该被拒绝', async () => {
    const testUser = createInvalidTestUser('password');

    const request = new NextRequest('http://localhost/api/register', {
      method: 'POST',
      body: JSON.stringify(testUser),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('输入数据验证失败');
    expect(data.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'password',
          message: expect.stringContaining('密码'),
        }),
      ])
    );
  });

  test('已存在的用户名应该被拒绝', async () => {
    const testUser = createValidTestUser();

    // Mock用户名已存在
    mockDb.checkUserExist.mockResolvedValue(true);
    mockDb.checkEmailExist.mockResolvedValue(false);

    const request = new NextRequest('http://localhost/api/register', {
      method: 'POST',
      body: JSON.stringify(testUser),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.error).toBe('用户名已存在');
  });

  test('已存在的邮箱应该被拒绝', async () => {
    const testUser = createValidTestUser();

    // Mock邮箱已存在
    mockDb.checkUserExist.mockResolvedValue(false);
    mockDb.checkEmailExist.mockResolvedValue(true);

    const request = new NextRequest('http://localhost/api/register', {
      method: 'POST',
      body: JSON.stringify(testUser),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.error).toBe('邮箱已被使用');
  });

  test('数据库错误应该返回500', async () => {
    const testUser = createValidTestUser();

    // Mock数据库错误
    mockDb.checkUserExist.mockResolvedValue(false);
    mockDb.checkEmailExist.mockResolvedValue(false);
    mockDb.registerUser.mockRejectedValue(new Error('数据库连接失败'));

    const request = new NextRequest('http://localhost/api/register', {
      method: 'POST',
      body: JSON.stringify(testUser),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('注册失败，请稍后重试');
  });

  test('安全性检查应该拒绝不安全的密码', async () => {
    const testUser = {
      username: 'testuser',
      email: 'test@example.com',
      password: 'testuser123', // 包含用户名
      confirmPassword: 'testuser123',
    };

    const request = new NextRequest('http://localhost/api/register', {
      method: 'POST',
      body: JSON.stringify(testUser),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('密码安全性不足');
    expect(data.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'password',
          message: '密码不应包含用户名',
        }),
      ])
    );
  });

  test('缺少必填字段应该返回验证错误', async () => {
    const incompleteUser = {
      username: 'testuser',
      // 缺少email和password
    };

    const request = new NextRequest('http://localhost/api/register', {
      method: 'POST',
      body: JSON.stringify(incompleteUser),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('输入数据验证失败');
    expect(data.details.length).toBeGreaterThan(0);
  });

  test('无效JSON应该返回500错误', async () => {
    const request = new NextRequest('http://localhost/api/register', {
      method: 'POST',
      body: 'invalid json',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('服务器错误');
  });
});
