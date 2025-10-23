# Node Puppeteer 网页截图服务

基于 Puppeteer 的高性能网页截图服务，支持异步任务处理和 WebSocket 实时状态推送。

## ✨ 功能特性

- 🚀 **异步截图处理** - 支持大量并发截图任务
- 📡 **WebSocket 实时推送** - 实时获取任务状态和进度
- 🎯 **智能元素适配** - 自动检测 `.page-create-message-img` 元素并调整视窗大小
- 🔧 **灵活配置** - 支持自定义视窗大小、等待策略等参数
- 🛡️ **稳定可靠** - 完善的错误处理和浏览器资源管理
- 🌐 **跨域支持** - 内置 CORS 支持，方便前端调用

## 🛠️ 技术栈

- **Node.js** - 运行环境
- **Express** - Web 框架
- **Puppeteer** - 无头浏览器控制
- **WebSocket** - 实时通信
- **ES Modules** - 现代 JavaScript 模块系统

## 📦 安装依赖

```bash
# 使用 pnpm（推荐）
pnpm install

# 或使用 npm
npm install

# 或使用 yarn
yarn install
```

## 🚀 启动服务

```bash
# 生产环境启动
pnpm start

# 开发环境启动（支持热重载）
pnpm dev
```

服务启动后将在 `http://localhost:3001` 监听请求。

## 📖 API 文档

### 创建截图任务

**POST** `/api/snapshot`

创建一个异步截图任务，立即返回任务 ID，通过 WebSocket 获取实时状态。

#### 请求参数

```json
{
  "url": "https://example.com",        // 必需：要截图的网页 URL
  "width": 1280,                       // 可选：视窗宽度，默认 1280
  "height": 720,                       // 可选：视窗高度，默认 720
  "waitUntil": "networkidle0",         // 可选：等待策略，默认 "networkidle0"
  "fullPage": true                     // 可选：是否全页截图，默认 true
}
```

#### 响应示例

```json
{
  "taskId": "1703123456789"
}
```

#### 等待策略说明

- `load` - 等待 load 事件触发
- `domcontentloaded` - 等待 DOMContentLoaded 事件
- `networkidle0` - 等待网络空闲（500ms 内无网络请求）
- `networkidle2` - 等待网络几乎空闲（500ms 内最多 2 个网络请求）

## 🔌 WebSocket 连接

连接到 `ws://localhost:3001` 接收实时任务状态推送。

### 消息格式

#### 任务进行中
```json
{
  "taskId": "1703123456789",
  "status": "processing",
  "msg": "正在启动浏览器..."
}
```

#### 任务完成
```json
{
  "taskId": "1703123456789",
  "status": "done",
  "img": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
}
```

#### 任务失败
```json
{
  "taskId": "1703123456789",
  "status": "error",
  "msg": "Navigation timeout of 30000 ms exceeded"
}
```

## 💡 使用示例

### JavaScript 客户端示例

```javascript
// 创建截图任务
async function createScreenshot(url) {
  const response = await fetch('http://localhost:3001/api/snapshot', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url: url,
      width: 1920,
      height: 1080,
      fullPage: true
    })
  });
  
  const { taskId } = await response.json();
  
  // 建立 WebSocket 连接监听结果
  const ws = new WebSocket('ws://localhost:3001');
  
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    
    if (data.taskId === taskId) {
      switch (data.status) {
        case 'processing':
          console.log('进度:', data.msg);
          break;
        case 'done':
          console.log('截图完成!');
          // data.img 包含 base64 格式的图片数据
          displayImage(data.img);
          ws.close();
          break;
        case 'error':
          console.error('截图失败:', data.msg);
          ws.close();
          break;
      }
    }
  };
  
  return taskId;
}

function displayImage(base64Data) {
  const img = document.createElement('img');
  img.src = base64Data;
  document.body.appendChild(img);
}
```

### cURL 示例

```bash
curl -X POST http://localhost:3001/api/snapshot \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://github.com",
    "width": 1280,
    "height": 720,
    "fullPage": true
  }'
```

## 🎯 特殊功能

### 智能元素适配

服务会自动检测页面中的 `.page-create-message-img` 元素，如果找到该元素，会：

1. 获取元素的实际高度
2. 重新设置浏览器视窗大小为 `width × 元素高度`
3. 确保截图完整包含目标元素

这个功能特别适用于需要截取特定内容区域的场景。

## ⚙️ 配置说明

### 浏览器启动参数

服务使用了以下 Chromium 启动参数来确保稳定性：

```javascript
[
  '--no-sandbox',                    // 禁用沙盒模式
  '--disable-setuid-sandbox',        // 禁用 setuid 沙盒
  '--disable-dev-shm-usage',         // 禁用 /dev/shm 使用
  '--disable-accelerated-2d-canvas', // 禁用 2D 画布加速
  '--no-first-run',                  // 跳过首次运行设置
  '--no-zygote',                     // 禁用 zygote 进程
  '--disable-gpu',                   // 禁用 GPU 加速
  '--disable-web-security',          // 禁用 Web 安全策略
  '--allow-running-insecure-content', // 允许不安全内容
  '--ignore-certificate-errors'      // 忽略证书错误
]
```

## 🐛 故障排除

### 常见问题

1. **Puppeteer 安装失败**
   ```bash
   # 设置 Puppeteer 下载镜像
   npm config set puppeteer_download_host=https://npm.taobao.org/mirrors
   ```

2. **Chrome 未找到**
   - 确保系统已安装 Chrome 或 Chromium
   - 或者在代码中指定 `executablePath`

3. **内存不足**
   - 增加系统内存
   - 或者减少并发任务数量

4. **网络超时**
   - 检查目标网站是否可访问
   - 调整 `timeout` 参数
   - 使用合适的 `waitUntil` 策略

## 📝 开发说明

### 项目结构

```
node-puppeteer/
├── package.json          # 项目配置和依赖
├── server.js            # 主服务文件
├── pnpm-lock.yaml       # 依赖锁定文件
└── README.md           # 项目文档
```

### 核心流程

1. **接收请求** - Express 接收 POST 请求，生成任务 ID
2. **异步处理** - 启动 Puppeteer 浏览器实例
3. **状态推送** - 通过 WebSocket 实时推送任务状态
4. **截图生成** - 完成截图并转换为 base64 格式
5. **资源清理** - 关闭浏览器实例，释放资源

**注意**: 本服务主要用于开发和测试环境，生产环境使用时请考虑安全性、性能和资源限制。
