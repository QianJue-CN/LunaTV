# 更新日志

## [v100.0.1] - 2025-01-30

### 🐛 Bug 修复

#### 修复混合模式下站长登录管理面板问题
- **问题**：在混合模式下，站长登录后无法访问管理面板，被重定向到登录页面
- **原因**：Windows系统中的 `USERNAME` 环境变量与应用配置冲突
- **解决方案**：
  - 新增 `LUNATV_USERNAME` 环境变量，优先级高于 `USERNAME`
  - 创建统一的环境变量获取工具 `src/lib/env.ts`
  - 更新所有相关API文件使用新的环境变量获取逻辑
  - 确保Docker部署和开发环境的兼容性

#### 修复Docker部署混合模式登录页面显示问题
- **问题**：Docker部署的混合模式下，登录页面只显示访问密码输入框，没有用户名/密码登录选项
- **原因**：新旧存储系统的环境变量不一致，前后端存储类型识别不匹配
- **解决方案**：
  - 统一存储类型检测逻辑，优先使用新的 `STORAGE_TYPE` 环境变量
  - 更新运行时配置生成逻辑
  - 确保前端正确识别混合存储模式

### ✨ 功能改进

#### 降低用户注册密码限制
- **密码长度要求**：从8个字符降低到6个字符
- **个人信息检查**：简化验证逻辑，只检查密码是否与用户名或邮箱完全相同
- **常见密码模式**：只禁止极其简单的密码（如"123456"、"password"、"admin"等）
- **用户体验**：大大降低了用户注册的门槛，同时保持基本安全性

### 📚 文档更新

#### README.md
- 新增环境变量冲突解决方案说明
- 更新所有Docker配置示例，推荐使用 `LUNATV_USERNAME`
- 新增用户注册密码要求说明
- 新增常见问题解决方案章节

#### .env.local.example
- 新增 `LUNATV_USERNAME` 环境变量示例
- 新增密码要求说明
- 新增环境变量冲突解决方案说明

### 🔧 技术改进

#### 环境变量管理
- 新增 `src/lib/env.ts` 工具文件
- 统一管理管理员用户名和密码的获取逻辑
- 支持 `LUNATV_USERNAME` 和 `USERNAME` 两种配置方式
- 向后兼容，自动回退机制

#### 存储类型检测
- 统一前后端存储类型获取逻辑
- 优先使用 `STORAGE_TYPE` 环境变量
- 保持对 `NEXT_PUBLIC_STORAGE_TYPE` 的向后兼容

### 🧪 测试验证

#### 功能测试
- ✅ 站长登录和管理面板访问
- ✅ 用户注册和登录流程
- ✅ 混合模式存储系统
- ✅ Docker部署兼容性
- ✅ 环境变量冲突解决

#### 兼容性测试
- ✅ Windows开发环境
- ✅ Docker部署环境
- ✅ 新旧环境变量配置
- ✅ 不同存储模式切换

### 📋 部署建议

#### Docker部署推荐配置
```yml
environment:
  - LUNATV_USERNAME=admin  # 推荐使用，避免环境变量冲突
  - PASSWORD=your_password  # 至少6个字符，包含字母和数字
  - STORAGE_TYPE=hybrid
  - DATABASE_URL=postgresql://user:pass@host:port/db
  - REDIS_URL=redis://:password@host:port
```

#### 开发环境配置
```env
USERNAME=admin
PASSWORD=your_password
STORAGE_TYPE=hybrid
DATABASE_URL=postgresql://user:pass@localhost:5432/lunatv
REDIS_URL=redis://:password@localhost:6379
```

---

## [v100.0.0] - 2025-01-29

### 🎉 初始版本发布
- 基础功能实现
- 多存储系统支持
- Docker部署支持
