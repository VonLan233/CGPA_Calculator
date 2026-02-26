import { Router, Request, Response } from 'express';
import { RetakePlanningService } from '../services/retakePlanningService.js';
import { FuturePlanningService } from '../services/futurePlanningService.js';
import { Grade, FutureCourse } from '../shared/types/grade.js';

const router = Router();
const retakePlanningService = new RetakePlanningService();
const futurePlanningService = new FuturePlanningService();

/**
 * POST /api/v1/planning/retake
 * 生成重修建议
 */
router.post('/retake', (req: Request, res: Response) => {
  try {
    const { grades, targetCGPA, maxRetakeCourses, excludeCourses } = req.body as {
      grades: Grade[];
      targetCGPA: number;
      maxRetakeCourses?: number;
      excludeCourses?: string[];
    };

    if (!grades || grades.length === 0) {
      res.status(400).json({
        success: false,
        error: '请先录入成绩'
      });
      return;
    }

    if (targetCGPA < 0 || targetCGPA > 4.0) {
      res.status(400).json({
        success: false,
        error: '目标CGPA必须在0-4.0之间'
      });
      return;
    }

    const result = retakePlanningService.generateRecommendations({
      grades,
      targetCGPA,
      maxRetakeCourses,
      excludeCourses
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '生成重修建议失败'
    });
  }
});

/**
 * POST /api/v1/planning/future
 * 未来课程规划
 */
router.post('/future', (req: Request, res: Response) => {
  try {
    const { currentGrades, targetCGPA, futureCourses } = req.body as {
      currentGrades: Grade[];
      targetCGPA: number;
      futureCourses: FutureCourse[];
    };

    if (!currentGrades || currentGrades.length === 0) {
      res.status(400).json({
        success: false,
        error: '请先录入当前成绩'
      });
      return;
    }

    if (!futureCourses || futureCourses.length === 0) {
      res.status(400).json({
        success: false,
        error: '请添加未来课程'
      });
      return;
    }

    const result = futurePlanningService.calculateRequirements({
      currentGrades,
      targetCGPA,
      futureCourses
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '规划计算失败'
    });
  }
});

export default router;
