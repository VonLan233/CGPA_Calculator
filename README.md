# CGPA Calculator

厦门大学马来西亚分校 CGPA 计算器，支持从教务系统自动抓取成绩、当前学期课程一键导入、图片 OCR 识别和手动录入，并提供智能重修规划、未来规划与实时成绩模拟。

## Features

### 成绩录入
- **教务系统成绩导入** — 输入学号密码，自动登录 `ac.xmu.edu.my` 抓取单学期或全部学期成绩
- **教务系统本学期课程导入** — 一键拉取本学期已选课程列表（含 Lab + Lecture 合并、`(Group N)` 等冗余文本清洗），自动按 `courseCode` 识别重修课
- **图片 OCR** — 上传成绩截图，Tesseract.js 自动识别课程、学分与绩点
- **手动录入** — 表单逐条添加，绩点下拉选择
- **绩点直显** — 所有界面统一使用绩点（4.0 / 3.7 / 3.3 …），不再显示 letter grade，更直观

### CGPA 计算
- **实时计算** — 修改任意成绩立即重算
- **重修覆盖** — 同一课程多次修读时取较优成绩（option B 语义，重修不会拉低原成绩）
- **重修自动识别** — 本学期课程导入时按 `courseCode` 比对已有成绩，自动打重修标记

### 重修规划
- **性价比排序** — 综合 CGPA 提升量、学分权重、提升难度等因子打分
- **目标可达性判定** — 检查所有可重修课全部拿 A 时能否达成目标
- **个性化推荐理由** — 每条建议附带文字说明

### 未来规划
- **四种规划场景**
  - **冲刺目标** — 全部新课程拿 A
  - **均衡目标** — A / A- / B+ 循环分布
  - **保持现有 CGPA** — 计算维持当前 CGPA 不下滑所需的新课平均绩点（可展开查看示例分配）
  - **达到目标 CGPA** — 计算达成 `targetCGPA` 所需的新课平均绩点（可展开查看示例分配；不可达成时给出明确提示）
- **本学期成绩模拟器** — 为每门课调整预期绩点，实时显示本学期结束后的 CGPA 与变化量（▲/▼），支持「全部重置为 4.0 / 3.0」快捷操作
- **重修与新课分流** — 重修课不增加分母，按 `max(原, 新)` 替换原绩点贡献；新课正常累加

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
git clone https://github.com/VonLan233/CGPA_Calculator.git
cd CGPA_Calculator
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
CGPA_Calculator/
├── client/                     # React 前端
│   └── src/
│       ├── components/         # 通用组件 (CGPADisplay, GradeTable, GradeSelector, Header)
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
│       │   ├── scrapingService.ts         # 教务系统爬虫（成绩 + 本学期课程）
│       │   ├── ocrService.ts              # 图片/PDF OCR
│       │   ├── retakePlanningService.ts   # 重修规划算法
│       │   └── futurePlanningService.ts   # 未来规划算法
│       └── shared/             # 前后端共享类型与工具
├── shared/                     # 顶层共享层（与 client/server 内副本同源）
└── package.json                # 根级脚本
```

## API Endpoints

| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/scrape/grades` | 登录教务系统并抓取成绩（单学期或全部） |
| POST | `/api/v1/scrape/current-semester` | 登录教务系统并抓取本学期已选课程 |
| POST | `/api/v1/grades/calculate` | 计算 CGPA |
| POST | `/api/v1/ocr/image` | 图片 OCR 识别成绩 |
| POST | `/api/v1/planning/retake` | 获取重修建议 |
| POST | `/api/v1/planning/future` | 未来课程规划（含四种场景） |
| GET | `/api/health` | 健康检查 |

## Grade Scale

厦门大学马来西亚分校 4.0 绩点制（无 A+）：

| Grade | GP | Grade | GP | Grade | GP |
|---|---|---|---|---|---|
| A | 4.0 | B+ | 3.3 | C+ | 2.3 |
| A- | 3.7 | B  | 3.0 | C  | 2.0 |
|   |     | B- | 2.7 | C- | 1.7 |
|   |     | D+ | 1.3 | D  | 1.0 |
|   |     | D- | 0.7 | F  | 0   |

爬虫与 OCR 在解析阶段会防御性地把识别到的 `A+` 归一化为 `A`，避免门户或图片识别偶发返回 A+ 导致流程中断。

## Privacy

- 用户凭据仅用于单次请求，**不会被存储或记录**
- 所有数据保存在浏览器本地 (localStorage)，不上传至任何第三方服务器
- 后端仅作为代理转发请求至教务系统，不持久化任何用户数据

## License

[MIT](LICENSE)
