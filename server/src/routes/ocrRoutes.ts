import { Router, Request, Response } from 'express';
import multer from 'multer';
import { OCRService } from '../services/ocrService.js';

const router = Router();

const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('不支持的文件类型，仅支持 PNG、JPEG、WebP 和 PDF'));
    }
  },
});

export const ocrService = new OCRService();

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
