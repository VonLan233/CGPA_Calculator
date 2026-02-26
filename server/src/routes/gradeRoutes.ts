import { Router, Request, Response } from 'express';
import { calculateCGPA } from '../shared/utils/cgpaCalculator.js';
import { Grade } from '../shared/types/grade.js';

const router = Router();

/**
 * POST /api/v1/grades/calculate
 * 计算CGPA
 */
router.post('/calculate', (req: Request, res: Response) => {
  try {
    const { grades } = req.body as { grades: Grade[] };

    if (!grades || !Array.isArray(grades)) {
      res.status(400).json({
        success: false,
        error: '请提供成绩数据'
      });
      return;
    }

    const result = calculateCGPA(grades);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '计算失败'
    });
  }
});

export default router;
