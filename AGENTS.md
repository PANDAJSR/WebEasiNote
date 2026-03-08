# AGENTS.md - 希沃白板课件查看器

## 项目概述
React + TypeScript + Vite 项目，用于查看希沃白板（Seewo Whiteboard）ENBX 文件。

## 构建/开发命令

```bash
# 安装依赖
pnpm install

# 开发服务器（端口 5173）
pnpm dev

# 生产构建
pnpm build

# 预览生产构建
pnpm preview
```

**注意**: 本项目没有配置测试框架、ESLint 或 Prettier。

## 技术栈
- **框架**: React 18
- **语言**: TypeScript 5.x（严格模式）
- **构建工具**: Vite 5
- **包管理**: pnpm
- **依赖**: jszip（ZIP 文件解析）

## 代码风格规范

### 格式化
- 使用单引号
- 2空格缩进
- 语句末尾**不加分号**
- 最大行宽：自然换行

### 命名规范
- **组件**: PascalCase（如 `Viewer`, `SlideRenderer`）
- **函数/变量**: camelCase（如 `handleFileSelect`, `parseXML`）
- **类型/接口**: PascalCase（如 `CoursewareMetadata`, `SlideData`）
- **文件**: 与默认导出同名（组件）或 camelCase（工具函数）

### 导入规范
- 使用 ES 模块导入
- 类型导入使用 `import type` 语法
- 第三方库在前，本地模块在后
- 示例：
```typescript
import JSZip from 'jszip'
import type { CoursewareMetadata } from './types'
import { parseXML } from './xml-utils'
```

### 类型定义
- 优先使用 `interface` 定义对象类型
- Props 类型定义为 `{ComponentName}Props`
- 类型定义集中在 `types.ts`

### 组件规范
- 使用函数组件
- Props 解构接收
- 默认导出组件使用 `export default`，具名导出使用 `export function`
```typescript
interface ViewerProps {
  metadata: CoursewareMetadata
}

export function Viewer({ metadata }: ViewerProps) {
  // ...
}
```

### 样式规范
- 使用 CSS-in-JS 方式，样式对象定义在 `styles.ts`
- 样式类型：`CSSProperties` from 'react'
- 颜色使用 hex 格式（如 `#667eea`）

### 错误处理
- 使用 try-catch 处理异步操作
- 错误信息使用中文（面向中文用户）
- console 日志使用 `[Component] 描述` 格式

### 注释规范
- 使用中文注释
- 函数使用 JSDoc 格式说明用途
- 复杂逻辑添加行内注释

### 模块化规范
- **单个文件不超过 400 行**
- 逻辑复杂时拆分为多个小组件
- 工具函数按功能拆分
- 样式定义集中放在 `styles.ts`
- 每个模块职责单一，便于维护

### React 规范
- 使用 hooks（useState, useRef, useEffect）
- 事件处理函数以 `handle` 前缀命名
- 条件渲染使用 && 运算符

## 项目结构
```
src/
├── components/     # React 组件
├── types.ts       # TypeScript 类型定义
├── parser.ts      # ENBX 文件解析
├── xml-utils.ts   # XML 处理工具
├── pictures.ts    # 图片解析
├── shapes.ts      # 形状解析
├── text-parser.ts # 文本解析
├── styles.ts      # 样式对象
└── main.tsx       # 应用入口
```

## TypeScript 配置
- 严格模式：启用
- 目标：ES2020
- JSX：react-jsx
- 模块：ESNext
- 路径别名：无（使用相对路径）

## 浏览器支持
- 现代浏览器（Chrome, Edge）
- 依赖 File System Access API 进行文件夹选择
