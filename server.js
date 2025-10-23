import express from "express";
import { WebSocketServer } from "ws";
import puppeteer from "puppeteer";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

// 存储任务状态的 Map
const taskMap = new Map();

// 1. 普通 HTTP 接口：接收任务
app.post("/api/snapshot", async (req, res) => {
  const { url, width = 1280, height = 720, waitUntil = "networkidle0", fullPage = true } = req.body;
  if (!url) return res.status(400).json({ msg: "url required" });

  // 生成一个任务 id 并立即返回，前端用 ws 监听结果
  const taskId = Date.now().toString();
  taskMap.set(taskId, { status: "pending", url });
  
  console.log(`📸 开始截图任务 ${taskId}: ${url}`);
  res.json({ taskId });

  // 2. 异步截图
  (async () => {
    let browser;
    try {
      // 更新任务状态为进行中
      taskMap.set(taskId, { status: "processing", url });
      broadcastToClients({ taskId, status: "processing", msg: "正在启动浏览器..." });

      // 启动浏览器实例，配置启动参数
      browser = await puppeteer.launch({
        headless: true, // 无头模式
        executablePath: undefined, // 让 Puppeteer 自动查找 Chrome
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--allow-running-insecure-content',
          '--ignore-certificate-errors',
          '--ignore-ssl-errors',
          '--ignore-certificate-errors-spki-list'
        ]
      });
      
      const page = await browser.newPage();
      // 设置初始视窗大小
      await page.setViewport({ width, height });
      
      broadcastToClients({ taskId, status: "processing", msg: "正在加载页面..." });
      await page.goto(url, { waitUntil, timeout: 30000 });

      // 等待页面完全渲染
      // await page.waitForTimeout(1000);
      
      // 动态获取 page-create-message-img 元素的高度
      const elementHeight = await page.evaluate(() => {
        const element = document.querySelector('.page-create-message-img');
        if (element) {
          const rect = element.getBoundingClientRect();
          return Math.ceil(rect.height);
        }
        return null;
      });
      
      // 如果找到了元素，使用固定宽度和动态高度重新设置视窗
      if (elementHeight) {
        await page.setViewport({ width, height: elementHeight });
        broadcastToClients({ taskId, status: "processing", msg: `已调整视窗大小为 ${width}x${elementHeight}...` });
      } else {
        broadcastToClients({ taskId, status: "processing", msg: "未找到 page-create-message-img 元素，使用默认尺寸..." });
      }
      
      broadcastToClients({ taskId, status: "processing", msg: "正在生成截图..." });
      const screenshot = await page.screenshot({ 
        type: "png", 
        fullPage,
      });

      // 3. 推送给前端
      const payload = {
        taskId,
        status: "done",
        img: `data:image/png;base64,${screenshot.toString("base64")}`,
      };
      
      taskMap.set(taskId, { status: "done", url, result: payload });
      broadcastToClients(payload);
      
      console.log(`✅ 截图任务 ${taskId} 完成`);
    } catch (e) {
      console.error(`❌ 截图任务 ${taskId} 失败:`, e.message);
      const errorPayload = { taskId, status: "error", msg: e.message };
      taskMap.set(taskId, { status: "error", url, error: e.message });
      broadcastToClients(errorPayload);
    } finally {
      if (browser) await browser.close();
    }
  })();
});

// 广播消息给所有 WebSocket 客户端
function broadcastToClients(payload) {
  wss.clients.forEach((ws) => {
    if (ws.readyState === 1) {
      ws.send(JSON.stringify(payload));
    }
  });
}

const server = app.listen(3001, () => console.log("🚀 截图服务已启动: http://localhost:3001"));
const wss = new WebSocketServer({ server });

// WebSocket 连接处理
wss.on('connection', (ws) => {
  console.log('🔗 新的 WebSocket 连接已建立');
  
  ws.on('close', () => {
    console.log('🔌 WebSocket 连接已断开');
  });
  
  ws.on('error', (error) => {
    console.error('❌ WebSocket 错误:', error);
  });
});

console.log('📡 WebSocket 服务器已启动，等待连接...');
