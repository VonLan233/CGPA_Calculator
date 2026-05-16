import { Router, Request, Response } from 'express';
import { ScrapingService, ScrapingError } from '../services/scrapingService.js';

const router = Router();
const scrapingService = new ScrapingService();

/**
 * POST /api/v1/scrape/grades
 * 使用账号密码登录教务系统并抓取成绩
 */
router.post('/grades', async (req: Request, res: Response) => {
  try {
    const { username, password, semesterId } = req.body;

    if (!username || !password) {
      res.status(400).json({
        success: false,
        error: '请输入用户名和密码',
      });
      return;
    }

    if (!semesterId) {
      res.status(400).json({
        success: false,
        error: '请选择学期',
      });
      return;
    }

    const result = await scrapingService.loginAndScrape({
      username,
      password,
      semesterId,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    if (error instanceof ScrapingError) {
      const statusMap: Record<ScrapingError['code'], number> = {
        AUTH_FAILED: 401,
        AUTH_EXPIRED: 401,
        NETWORK_ERROR: 502,
        TIMEOUT: 504,
        PARSE_ERROR: 422,
        NO_DATA: 404,
      };
      res.status(statusMap[error.code]).json({
        success: false,
        error: error.message,
        code: error.code,
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '抓取成绩失败',
    });
  }
});

/**
 * POST /api/v1/scrape/current-semester
 * 使用账号密码登录教务系统并抓取「当前学期已选课程」
 * 用于在「未来规划」中快速导入课程列表（无成绩）。
 */
router.post('/current-semester', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({
        success: false,
        error: '请输入用户名和密码',
      });
      return;
    }

    const result = await scrapingService.loginAndScrapeCurrentSemester({
      username,
      password,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    if (error instanceof ScrapingError) {
      const statusMap: Record<ScrapingError['code'], number> = {
        AUTH_FAILED: 401,
        AUTH_EXPIRED: 401,
        NETWORK_ERROR: 502,
        TIMEOUT: 504,
        PARSE_ERROR: 422,
        NO_DATA: 404,
      };
      res.status(statusMap[error.code]).json({
        success: false,
        error: error.message,
        code: error.code,
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '抓取课程失败',
    });
  }
});

export default router;
