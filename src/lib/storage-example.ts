/* eslint-disable no-console */

/**
 * 存储系统使用示例
 * 
 * 本文件展示了如何使用不同的存储实现：
 * 1. PostgreSQL 存储 - 用于持久化数据
 * 2. Redis 存储 - 用于缓存和高频数据
 * 3. 混合存储 - 结合两者的优势
 */

import { HybridStorage } from './hybrid.db';
import { PostgresConnectionConfig,PostgresStorage } from './postgres.db';
import { BaseRedisStorage, RedisConnectionConfig } from './redis-base.db';
import { UpstashRedisStorage } from './upstash.db';

// 存储配置示例
const postgresConfig: PostgresConnectionConfig = {
  connectionString: process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/lunatv',
  ssl: process.env.NODE_ENV === 'production'
};

const redisConfig: RedisConnectionConfig = {
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  clientName: 'LunaTV-Redis'
};

// 创建具体的Redis存储实现
class RedisStorage extends BaseRedisStorage {
  constructor(config: RedisConnectionConfig) {
    super(config, Symbol.for('__LUNATV_REDIS_CLIENT__'));
  }
}

/**
 * PostgreSQL 存储使用示例
 */
export async function postgresExample() {
  console.log('=== PostgreSQL 存储示例 ===');

  const storage = new PostgresStorage(postgresConfig);

  try {
    // 连接数据库
    await storage.connect();

    // 注册用户
    await storage.registerUser('testuser', 'password123', 'test@example.com');
    console.log('用户注册成功');

    // 验证用户
    const isValid = await storage.verifyUser('testuser', 'password123');
    console.log('用户验证结果:', isValid);

    // 获取用户信息
    const userInfo = await storage.getUserInfo('testuser');
    console.log('用户信息:', userInfo);

    // 设置收藏
    await storage.setFavorite('testuser', 'movie+123', {
      source_name: 'TestSource',
      total_episodes: 24,
      title: '测试电影',
      year: '2024',
      cover: 'https://example.com/cover.jpg',
      save_time: Date.now(),
      search_title: '测试电影'
    });
    console.log('收藏设置成功');

    // 获取所有收藏
    const favorites = await storage.getAllFavorites('testuser');
    console.log('用户收藏:', favorites);

  } catch (error) {
    console.error('PostgreSQL 示例错误:', error);
  } finally {
    await storage.disconnect();
  }
}

/**
 * Redis 存储使用示例
 */
export async function redisExample() {
  console.log('=== Redis 存储示例 ===');

  const storage = new RedisStorage(redisConfig);

  try {
    // 设置播放记录
    await storage.setPlayRecord('testuser', 'movie+123', {
      title: '测试电影',
      source_name: 'TestSource',
      cover: 'https://example.com/cover.jpg',
      year: '2024',
      index: 5,
      total_episodes: 24,
      play_time: 1800, // 30分钟
      total_time: 2700, // 45分钟
      save_time: Date.now(),
      search_title: '测试电影'
    });
    console.log('播放记录设置成功');

    // 获取播放记录
    const playRecord = await storage.getPlayRecord('testuser', 'movie+123');
    console.log('播放记录:', playRecord);

    // 添加搜索历史
    await storage.addSearchHistory('testuser', '测试搜索');
    await storage.addSearchHistory('testuser', '另一个搜索');

    // 获取搜索历史
    const searchHistory = await storage.getSearchHistory('testuser');
    console.log('搜索历史:', searchHistory);

    // 设置跳过配置
    await storage.setSkipConfig('testuser', 'movie', '123', {
      enable: true,
      intro_time: 90, // 跳过90秒片头
      outro_time: 120 // 跳过120秒片尾
    });
    console.log('跳过配置设置成功');

  } catch (error) {
    console.error('Redis 示例错误:', error);
  }
}

/**
 * 混合存储使用示例
 */
export async function hybridExample() {
  console.log('=== 混合存储示例 ===');

  const storage = new HybridStorage(postgresConfig, redisConfig);

  try {
    // 连接存储
    await storage.connect();

    // 注册用户（存储在PostgreSQL）
    await storage.registerUser('hybriduser', 'password123', 'hybrid@example.com');
    console.log('用户注册成功（PostgreSQL）');

    // 设置播放记录（存储在Redis）
    await storage.setPlayRecord('hybriduser', 'series+456', {
      title: '测试剧集',
      source_name: 'TestSource',
      cover: 'https://example.com/series.jpg',
      year: '2024',
      index: 3,
      total_episodes: 12,
      play_time: 900,
      total_time: 1800,
      save_time: Date.now(),
      search_title: '测试剧集'
    });
    console.log('播放记录设置成功（Redis）');

    // 获取用户信息（从PostgreSQL，带缓存）
    const userInfo = await storage.getUserInfo('hybriduser');
    console.log('用户信息（带缓存）:', userInfo);

    // 再次获取用户信息（从缓存）
    const cachedUserInfo = await storage.getUserInfo('hybriduser');
    console.log('缓存的用户信息:', cachedUserInfo);

    // 获取缓存统计
    const cacheStats = await storage.getCacheStats();
    console.log('缓存统计:', cacheStats);

    // 清除用户缓存
    await storage.clearUserCache('hybriduser');
    console.log('用户缓存已清除');

  } catch (error) {
    console.error('混合存储示例错误:', error);
  } finally {
    await storage.disconnect();
  }
}

/**
 * Upstash Redis 存储使用示例
 */
export async function upstashExample() {
  console.log('=== Upstash Redis 存储示例 ===');

  // 确保环境变量已设置
  if (!process.env.UPSTASH_URL || !process.env.UPSTASH_TOKEN) {
    console.log('跳过 Upstash 示例：需要设置 UPSTASH_URL 和 UPSTASH_TOKEN 环境变量');
    return;
  }

  const storage = new UpstashRedisStorage();

  try {
    // 注册用户
    await storage.registerUser('upstashuser', 'password123', 'upstash@example.com');
    console.log('Upstash 用户注册成功');

    // 验证用户
    const isValid = await storage.verifyUser('upstashuser', 'password123');
    console.log('Upstash 用户验证结果:', isValid);

    // 设置管理员配置
    await storage.setAdminConfig({
      ConfigSubscribtion: {
        URL: '',
        AutoUpdate: false,
        LastCheck: new Date().toISOString()
      },
      ConfigFile: 'upstash-config.json',
      SiteConfig: {
        SiteName: 'LunaTV',
        Announcement: '测试公告',
        SearchDownstreamMaxPage: 10,
        SiteInterfaceCacheTime: 300,
        DoubanProxyType: 'none',
        DoubanProxy: '',
        DoubanImageProxyType: 'none',
        DoubanImageProxy: '',
        DisableYellowFilter: false,
        FluidSearch: true
      },
      UserConfig: {
        Users: []
      },
      SourceConfig: [],
      CustomCategories: []
    });
    console.log('Upstash 管理员配置设置成功');

    // 获取管理员配置
    const adminConfig = await storage.getAdminConfig();
    console.log('Upstash 管理员配置:', adminConfig);

  } catch (error) {
    console.error('Upstash 示例错误:', error);
  }
}

/**
 * 运行所有示例
 */
export async function runAllExamples() {
  console.log('开始运行存储系统示例...\n');

  try {
    await postgresExample();
    console.log('\n');

    await redisExample();
    console.log('\n');

    await hybridExample();
    console.log('\n');

    await upstashExample();
    console.log('\n');

    console.log('所有示例运行完成！');
  } catch (error) {
    console.error('运行示例时出错:', error);
  }
}

// 如果直接运行此文件，则执行所有示例
if (require.main === module) {
  runAllExamples().catch(console.error);
}
