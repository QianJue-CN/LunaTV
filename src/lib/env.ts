/**
 * 环境变量获取工具
 * 
 * 解决Windows系统中USERNAME环境变量冲突的问题
 */

/**
 * 获取管理员用户名
 * 优先使用 LUNATV_USERNAME（Docker环境），如果没有则回退到 USERNAME（开发环境）
 * 这样可以避免Windows系统中USERNAME环境变量冲突的问题
 */
export function getAdminUsername(): string | undefined {
  return process.env.LUNATV_USERNAME || process.env.USERNAME;
}

/**
 * 获取管理员密码
 */
export function getAdminPassword(): string | undefined {
  return process.env.PASSWORD;
}
