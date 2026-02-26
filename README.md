# CGPA Calculator

厦门大学马来西亚分校 CGPA 计算器，支持从教务系统自动抓取成绩、图片 OCR 识别和手动录入，并提供智能重修规划建议。

## Features

- **教务系统导入** — 输入学号密码，自动登录 `ac.xmu.edu.my` 抓取全部学期成绩
- **图片 OCR** — 上传成绩截图，Tesseract.js 自动识别课程与成绩
- **手动录入** — 表单逐条添加课程成绩
- **实时 CGPA 计算** — 修改任意成绩即时重算，支持重修覆盖逻辑
- **重修规划** — 根据目标 CGPA 按性价比推荐最值得重修的课程
- **未来规划** — 模拟未来课程成绩，预估可达 CGPA

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 19, TypeScript, Vite 7, Tailwind CSS 4, Zustand 5, React Router 7 |
| Backend | Express 4, TypeScript, Cheerio, Tesseract.js, Axios |
| Monorepo | npm workspaces + concurrently |

## Getting Started

### Prerequisites

- Node.js >= 18
- npm >= 9

### Install

```bash
git clone https://github.com/your-username/CGPACalculator.git
cd CGPACalculator
npm run install:all
```

### Development

```bash
npm run dev
```

同时启动前端 (`http://localhost:5173`) 和后端 (`http://localhost:3001`)。

也可以分别启动：

```bash
npm run dev:client   # 仅前端
npm run dev:server   # 仅后端
```

### Build

```bash
npm run build
```

产物分别输出到 `client/dist/` 和 `server/dist/`。

## Project Structure

```
CGPACalculator/
├── client/                     # React 前端
│   └── src/
│       ├── components/         # 通用组件 (CGPADisplay, GradeTable, Header)
│       ├── features/           # 功能模块
│       │   └── grade-entry/    # 成绩录入 (WebImport, ImageUpload, ManualEntry)
│       ├── pages/              # 页面 (GradeEntry, RetakePlanning, FuturePlanning)
│       ├── store/              # Zustand 状态管理
│       ├── types/              # TypeScript 类型定义
│       └── utils/              # CGPA 计算逻辑
├── server/                     # Express 后端
│   └── src/
│       ├── routes/             # API 路由
│       ├── services/           # 核心服务
│       │   ├── scrapingService.ts      # 教务系统爬虫
│       │   ├── ocrService.ts           # 图片/PDF OCR
│       │   ├── retakePlanningService.ts # 重修规划算法
│       │   └── futurePlanningService.ts # 未来规划算法
│       └── shared/             # 前后端共享类型与工具
└── package.json                # 根级脚本
```

## API Endpoints

| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/scrape/grades` | 登录教务系统并抓取成绩 |
| POST | `/api/v1/grades/calculate` | 计算 CGPA |
| POST | `/api/v1/ocr/image` | 图片 OCR 识别成绩 |
| POST | `/api/v1/planning/retake` | 获取重修建议 |
| POST | `/api/v1/planning/future` | 未来课程规划 |
| GET | `/api/health` | 健康检查 |

## Grade Scale

厦门大学马来西亚分校 4.0 绩点制：

| Grade | GP | Grade | GP | Grade | GP |
|---|---|---|---|---|---|
| A+ | 4.0 | B+ | 3.3 | C+ | 2.3 |
| A | 4.0 | B | 3.0 | C | 2.0 |
| A- | 3.7 | B- | 2.7 | C- | 1.7 |
| | | D+ | 1.3 | D | 1.0 |
| | | D- | 0.7 | F | 0 |

## Privacy

- 用户凭据仅用于单次请求，**不会被存储或记录**
- 所有数据保存在浏览器本地 (localStorage)，不上传至任何第三方服务器
- 后端仅作为代理转发请求至教务系统，不持久化任何用户数据

## License

[MIT](LICENSE)
