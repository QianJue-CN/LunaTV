/* eslint-disable no-console,@typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';

import { clearConfigCache } from '@/lib/config';
import { db } from '@/lib/db';
import {
  formatValidationErrors,
  registerFormSchema,
  validateSecurityRequirements,
} from '@/lib/validation';

export const runtime = 'nodejs';

// 读取存储类型环境变量，默认 localstorage
const STORAGE_TYPE =
  (process.env.STORAGE_TYPE as
    | 'localstorage'
    | 'redis'
    | 'upstash'
    | 'kvrocks'
    | 'postgres'
    | 'hybrid'
    | undefined) ||
  (process.env.NEXT_PUBLIC_STORAGE_TYPE as
    | 'localstorage'
    | 'redis'
    | 'upstash'
    | 'kvrocks'
    | undefined) || 'localstorage';

// 使用统一的验证schema

export async function POST(req: NextRequest) {
  try {
    // 检查是否支持注册功能
    if (STORAGE_TYPE === 'localstorage') {
      return NextResponse.json(
        { error: '当前配置不支持用户注册功能' },
        { status: 400 }
      );
    }

    // 解析请求数据
    let body;
    try {
      body = await req.json();
    } catch (error) {
      console.error('JSON解析错误:', error);
      return NextResponse.json({ error: '请求数据格式错误' }, { status: 400 });
    }

    // 验证输入数据
    const validationResult = registerFormSchema.safeParse(body);
    if (!validationResult.success) {
      const errors = formatValidationErrors(validationResult.error);
      return NextResponse.json(
        { error: '输入数据验证失败', details: errors },
        { status: 400 }
      );
    }

    const { username, email, password } = validationResult.data;

    // 安全性检查
    const securityCheck = validateSecurityRequirements({
      username,
      email,
      password,
    });
    if (!securityCheck.isSecure) {
      return NextResponse.json(
        {
          error: '密码安全性不足',
          details: securityCheck.warnings.map((warning) => ({
            field: 'password',
            message: warning,
          })),
        },
        { status: 400 }
      );
    }

    // 检查用户名是否已存在
    const userExists = await db.checkUserExist(username);
    if (userExists) {
      return NextResponse.json({ error: '用户名已存在' }, { status: 409 });
    }

    // 检查邮箱是否已被使用
    const emailExists = await db.checkEmailExist(email);
    if (emailExists) {
      return NextResponse.json({ error: '邮箱已被使用' }, { status: 409 });
    }

    // 创建用户
    try {
      await db.registerUser(username, password, email);

      // 清除配置缓存，确保新用户出现在用户列表中
      clearConfigCache();

      console.log(`新用户注册成功: ${username} (${email})`);

      return NextResponse.json({
        success: true,
        message: '注册成功',
        data: {
          username,
          email,
        },
      });
    } catch (dbError) {
      console.error('用户注册失败:', dbError);
      return NextResponse.json(
        { error: '注册失败，请稍后重试' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('注册接口异常:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// 获取注册配置信息
export async function GET() {
  return NextResponse.json({
    enabled: STORAGE_TYPE !== 'localstorage',
    storageType: STORAGE_TYPE,
    requirements: {
      username: {
        minLength: 3,
        maxLength: 20,
        pattern: '^[a-zA-Z0-9_]+$',
        description: '用户名只能包含字母、数字和下划线',
      },
      email: {
        maxLength: 100,
        description: '有效的邮箱地址',
      },
      password: {
        minLength: 6,
        maxLength: 50,
        pattern: '^(?=.*[a-zA-Z])(?=.*\\d)',
        description: '密码至少6个字符，必须包含字母和数字',
      },
    },
  });
}
