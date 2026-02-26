import Tesseract from 'tesseract.js';
import pdf from 'pdf-parse';
import { LetterGrade, GRADE_POINT_MAP } from '../shared/types/grade.js';

interface RecognizedGrade {
  courseCode?: string;
  courseName: string;
  credits: number;
  letterGrade: LetterGrade;
  confidence: number;
  rawText: string;
}

interface OCRResult {
  grades: RecognizedGrade[];
  rawText: string;
  warnings: string[];
}

export class OCRService {
  private worker: Tesseract.Worker | null = null;

  /**
   * 初始化Tesseract Worker
   */
  private async initWorker(): Promise<Tesseract.Worker> {
    if (!this.worker) {
      this.worker = await Tesseract.createWorker('chi_sim+eng');
    }
    return this.worker;
  }

  /**
   * 图片OCR识别
   */
  async recognizeImage(imageBuffer: Buffer): Promise<OCRResult> {
    const worker = await this.initWorker();

    const result = await worker.recognize(imageBuffer);
    return this.parseTranscriptText(result.data.text);
  }

  /**
   * PDF文本提取
   */
  async parsePDF(pdfBuffer: Buffer): Promise<OCRResult> {
    const data = await pdf(pdfBuffer);
    return this.parseTranscriptText(data.text);
  }

  /**
   * 解析成绩单文本
   */
  private parseTranscriptText(text: string): OCRResult {
    const lines = text.split('\n').filter(line => line.trim());
    const grades: RecognizedGrade[] = [];
    const warnings: string[] = [];

    // 成绩单格式正则表达式
    const gradePatterns = [
      // 格式1: 课程代码 课程名 学分 等级 (如: CS101 计算机导论 3 A)
      /([A-Z]{2,4}\d{3,4})\s+(.+?)\s+(\d+\.?\d*)\s+([A-F][+-]?)/i,
      // 格式2: 课程名 学分 等级 (如: 计算机导论 3 A)
      /^(.+?)\s+(\d+\.?\d*)\s+([A-F][+-]?)\s*$/i,
      // 格式3: 等级 学分 课程名 (如: A 3 计算机导论)
      /^([A-F][+-]?)\s+(\d+\.?\d*)\s+(.+)$/i,
    ];

    for (const line of lines) {
      for (const pattern of gradePatterns) {
        const match = pattern.exec(line.trim());
        if (match) {
          let courseCode = '';
          let courseName = '';
          let credits = 0;
          let letterGrade: LetterGrade = 'F';

          if (pattern === gradePatterns[0]) {
            // 格式1
            courseCode = match[1];
            courseName = match[2].trim();
            credits = parseFloat(match[3]);
            letterGrade = this.normalizeGrade(match[4]);
          } else if (pattern === gradePatterns[1]) {
            // 格式2
            courseName = match[1].trim();
            credits = parseFloat(match[2]);
            letterGrade = this.normalizeGrade(match[3]);
          } else if (pattern === gradePatterns[2]) {
            // 格式3
            letterGrade = this.normalizeGrade(match[1]);
            credits = parseFloat(match[2]);
            courseName = match[3].trim();
          }

          if (courseName && credits > 0 && credits <= 10) {
            grades.push({
              courseCode: courseCode || undefined,
              courseName,
              credits,
              letterGrade,
              confidence: 0.8,
              rawText: line,
            });
          }
          break;
        }
      }
    }

    if (grades.length === 0) {
      warnings.push('未能识别任何成绩，请检查图片质量或尝试手动输入');
    }

    return {
      grades,
      rawText: text,
      warnings,
    };
  }

  /**
   * 标准化成绩等级
   */
  private normalizeGrade(grade: string): LetterGrade {
    const normalized = grade.toUpperCase().trim();
    const validGrades: LetterGrade[] = [
      'A+', 'A', 'A-', 'B+', 'B', 'B-',
      'C+', 'C', 'C-', 'D+', 'D', 'D-', 'F'
    ];

    if (validGrades.includes(normalized as LetterGrade)) {
      return normalized as LetterGrade;
    }

    // 处理常见OCR错误
    const corrections: Record<string, LetterGrade> = {
      'A十': 'A+',
      'A一': 'A-',
      'B十': 'B+',
      'B一': 'B-',
      '8+': 'B+',
      '8': 'B',
      '8-': 'B-',
    };

    return corrections[normalized] || 'F';
  }

  /**
   * 清理资源
   */
  async terminate(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
    }
  }
}
