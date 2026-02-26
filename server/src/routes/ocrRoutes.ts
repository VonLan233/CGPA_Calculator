import { Router, Request, Response } from 'express';
import multer from 'multer';
import { OCRService } from '../services/ocrService.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });
const ocrService = new OCRService();

/**
 * POST /api/v1/ocr/image
 * 图片OCR识别成绩单
 */
router.post('/image', upload.single('image'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({
        success: false,
        error: '请上传图片文件'
      });
      return;
    }

    const result = await ocrService.recognizeImage(req.file.buffer);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'OCR识别失败'
    });
  }
});

/**
 * POST /api/v1/ocr/pdf
 * PDF成绩单解析
 */
router.post('/pdf', upload.single('pdf'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({
        success: false,
        error: '请上传PDF文件'
      });
      return;
    }

    const result = await ocrService.parsePDF(req.file.buffer);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'PDF解析失败'
    });
  }
});

export default router;
