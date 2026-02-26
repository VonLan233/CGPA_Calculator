import axios from 'axios';
import * as cheerio from 'cheerio';
import type { LetterGrade } from '../shared/types/grade.js';
import { GRADE_POINT_MAP, ALL_GRADES } from '../shared/types/grade.js';

export class ScrapingError extends Error {
  code: 'AUTH_FAILED' | 'AUTH_EXPIRED' | 'NETWORK_ERROR' | 'TIMEOUT' | 'PARSE_ERROR' | 'NO_DATA';

  constructor(message: string, code: ScrapingError['code']) {
    super(message);
    this.name = 'ScrapingError';
    this.code = code;
  }
}

interface ScrapedCourse {
  courseCode: string;
  courseName: string;
  credits: number;
  letterGrade: LetterGrade;
  gradePoint: number;
  semester?: string;
  isRetake?: boolean;
}

interface SemesterOption {
  value: string;
  label: string;
}

export interface ScrapeResult {
  courses: ScrapedCourse[];
  semester: string;
  semesters: SemesterOption[];
  warnings: string[];
}

function isLetterGrade(value: string): value is LetterGrade {
  return ALL_GRADES.includes(value as LetterGrade);
}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export class ScrapingService {
  private readonly baseUrl = 'https://ac.xmu.edu.my';
  private readonly timeout = 15000;

  /**
   * Login with username/password and return session cookie
   */
  async login(username: string, password: string): Promise<string> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/index.php?c=Login&a=login`,
        new URLSearchParams({ username, password, user_lb: 'Student' }).toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': UA,
          },
          timeout: this.timeout,
          maxRedirects: 0,
          validateStatus: () => true,
        }
      );

      const html = typeof response.data === 'string' ? response.data : '';

      // Portal returns 200 with error-msg span on failed login
      if (html.includes('error-msg') || html.includes('password error') || html.includes('Access denied')) {
        throw new ScrapingError('学号或密码错误', 'AUTH_FAILED');
      }

      // Extract Set-Cookie headers
      const setCookieHeaders = response.headers['set-cookie'];
      if (!setCookieHeaders || setCookieHeaders.length === 0) {
        throw new ScrapingError('登录失败，无法获取会话', 'AUTH_FAILED');
      }

      const cookies = setCookieHeaders
        .map((c: string) => c.split(';')[0])
        .join('; ');

      return cookies;
    } catch (error) {
      if (error instanceof ScrapingError) throw error;
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED') {
          throw new ScrapingError('请求超时，请检查网络连接', 'TIMEOUT');
        }
        throw new ScrapingError(`网络请求失败: ${error.message}`, 'NETWORK_ERROR');
      }
      throw new ScrapingError('登录失败', 'NETWORK_ERROR');
    }
  }

  /**
   * Scrape grades for a specific semester using session cookie
   */
  async scrapeGrades(params: {
    sessionCookie: string;
    semesterId: string;
  }): Promise<ScrapeResult> {
    const { sessionCookie, semesterId } = params;
    const warnings: string[] = [];

    const url = `${this.baseUrl}/student/index.php?c=Search&a=Cj&tm_id=${encodeURIComponent(semesterId)}`;

    let html: string;
    try {
      const response = await axios.get(url, {
        headers: {
          Cookie: sessionCookie,
          'User-Agent': UA,
        },
        timeout: this.timeout,
        maxRedirects: 5,
        validateStatus: () => true,
      });

      if (response.status === 403) {
        throw new ScrapingError('会话已过期，请重新登录', 'AUTH_EXPIRED');
      }

      html = response.data;
    } catch (error) {
      if (error instanceof ScrapingError) throw error;
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED') {
          throw new ScrapingError('请求超时，请检查网络连接', 'TIMEOUT');
        }
        throw new ScrapingError(`网络请求失败: ${error.message}`, 'NETWORK_ERROR');
      }
      throw new ScrapingError('未知网络错误', 'NETWORK_ERROR');
    }

    if (html.includes('拒绝访问')) {
      throw new ScrapingError('会话已过期，请重新登录', 'AUTH_EXPIRED');
    }

    const $ = cheerio.load(html);

    // Extract available semesters from the <select> dropdown
    const semesters: SemesterOption[] = [];
    $('#tm_id option').each((_: number, el: unknown) => {
      const opt = $(el as cheerio.Element);
      const value = opt.attr('value');
      const label = opt.text().trim();
      if (value) {
        semesters.push({ value, label });
      }
    });

    // Parse grades from #data_table
    const courses = this.parseDataTable($, warnings);

    if (courses.length === 0) {
      throw new ScrapingError(
        '未找到成绩数据，请检查学期是否正确',
        'NO_DATA'
      );
    }

    return { courses, semester: semesterId, semesters, warnings };
  }

  /**
   * Scrape grades from ALL available semesters
   */
  async scrapeAllGrades(sessionCookie: string): Promise<ScrapeResult> {
    const warnings: string[] = [];

    // First fetch the page without tm_id to get the semester list
    const indexUrl = `${this.baseUrl}/student/index.php?c=Search&a=Cj`;
    const indexResponse = await axios.get(indexUrl, {
      headers: { Cookie: sessionCookie, 'User-Agent': UA },
      timeout: this.timeout,
      maxRedirects: 5,
      validateStatus: () => true,
    });

    if (indexResponse.status === 403 || (typeof indexResponse.data === 'string' && indexResponse.data.includes('拒绝访问'))) {
      throw new ScrapingError('会话已过期，请重新登录', 'AUTH_EXPIRED');
    }

    const $index = cheerio.load(indexResponse.data);
    const semesters: SemesterOption[] = [];
    $index('#tm_id option').each((_: number, el: unknown) => {
      const opt = $index(el as cheerio.Element);
      const value = opt.attr('value');
      const label = opt.text().trim();
      if (value) semesters.push({ value, label });
    });

    if (semesters.length === 0) {
      throw new ScrapingError('未找到可用学期', 'NO_DATA');
    }

    // Scrape each semester sequentially
    const allCourses: ScrapedCourse[] = [];
    for (const sem of semesters) {
      const url = `${this.baseUrl}/student/index.php?c=Search&a=Cj&tm_id=${encodeURIComponent(sem.value)}`;
      try {
        const response = await axios.get(url, {
          headers: { Cookie: sessionCookie, 'User-Agent': UA },
          timeout: this.timeout,
          maxRedirects: 5,
          validateStatus: () => true,
        });

        if (response.status === 403) continue;

        const $ = cheerio.load(response.data);
        const courses = this.parseDataTable($, warnings);
        // Tag each course with its semester label
        for (const c of courses) {
          c.semester = sem.label;
        }
        allCourses.push(...courses);
      } catch {
        warnings.push(`学期 ${sem.label} 抓取失败，已跳过`);
      }
    }

    if (allCourses.length === 0) {
      throw new ScrapingError('所有学期均未找到成绩数据', 'NO_DATA');
    }

    // Deduplicate: for the same course code, a retake replaces the original.
    // Semesters are in reverse-chronological order (newest first), so we
    // iterate in order and keep the first (newest) entry per course code.
    const seen = new Map<string, number>();
    const deduped: ScrapedCourse[] = [];
    for (const course of allCourses) {
      const key = course.courseCode.replace(/\*$/, ''); // strip trailing * for matching
      if (!key) {
        deduped.push(course);
        continue;
      }
      const existingIdx = seen.get(key);
      if (existingIdx === undefined) {
        seen.set(key, deduped.length);
        deduped.push(course);
      } else {
        // Newer entry (current) appeared first in the list, so the existing
        // one is already the newest. Mark the duplicate (older) as superseded.
        // But if the current one is explicitly a retake, it overrides.
        if (course.isRetake) {
          deduped[existingIdx] = course;
          warnings.push(`课程 "${course.courseName}" (${key}) 检测到重修，使用重修成绩`);
        } else {
          // The existing entry (appeared earlier = newer semester) already wins.
          // Mark it as having a retake history.
          warnings.push(`课程 "${course.courseName}" (${key}) 出现多次，使用最新学期成绩`);
        }
      }
    }

    return {
      courses: deduped,
      semester: 'all',
      semesters,
      warnings,
    };
  }

  /**
   * Full flow: login + scrape grades (single semester or all)
   */
  async loginAndScrape(params: {
    username: string;
    password: string;
    semesterId: string;
  }): Promise<ScrapeResult> {
    const sessionCookie = await this.login(params.username, params.password);

    if (params.semesterId === 'all') {
      return this.scrapeAllGrades(sessionCookie);
    }

    return this.scrapeGrades({ sessionCookie, semesterId: params.semesterId });
  }

  /**
   * Parse the known #data_table structure from the portal.
   *
   * Headers: No. | Course Code | Course Name | Credit | Grade | Grade Point | Registration Type | Final Examination Status
   * Indices:  0  |     1       |      2      |   3    |   4   |      5      |        6          |          7
   *
   * The last 2 rows are GPA / CGPA summary rows (use colspan).
   */
  private parseDataTable(
    $: ReturnType<typeof cheerio.load>,
    warnings: string[]
  ): ScrapedCourse[] {
    const courses: ScrapedCourse[] = [];
    const dataTable = $('#data_table');

    if (dataTable.length === 0) {
      // Fallback: try any table with thead
      const tables = $('table');
      for (let t = 0; t < tables.length; t++) {
        const result = this.parseGenericTable($, tables.eq(t), warnings);
        if (result.length > 0) return result;
      }
      throw new ScrapingError('页面中未找到成绩表格', 'PARSE_ERROR');
    }

    const rows = dataTable.find('tbody tr');
    rows.each((_: number, el: unknown) => {
      const row = $(el as cheerio.Element);
      const cells = row.find('td');

      // Skip summary rows (GPA/CGPA) which use colspan
      if (cells.length < 5) return;
      const firstCellColspan = cells.first().attr('colspan');
      if (firstCellColspan) return;

      const courseCode = cells.eq(1).text().trim();
      const courseName = cells.eq(2).text().trim();
      const creditsText = cells.eq(3).text().trim();
      const gradeText = cells.eq(4).text().trim();
      const regType = cells.length > 6 ? cells.eq(6).text().trim() : '';

      if (!courseName) return;

      const credits = parseFloat(creditsText);
      if (isNaN(credits) || credits <= 0) {
        warnings.push(`跳过课程 "${courseName}": 学分无效 (${creditsText})`);
        return;
      }

      const normalizedGrade = gradeText.replace(/\s+/g, '').toUpperCase()
        .replace('＋', '+').replace('－', '-');

      if (!isLetterGrade(normalizedGrade)) {
        warnings.push(`跳过课程 "${courseName}": 无法识别成绩 "${gradeText}"`);
        return;
      }

      const isRetake = /retake|重修|re-take|re-sit/i.test(regType);

      courses.push({
        courseCode,
        courseName,
        credits,
        letterGrade: normalizedGrade,
        gradePoint: GRADE_POINT_MAP[normalizedGrade],
        isRetake,
      });
    });

    return courses;
  }

  /**
   * Fallback: parse a generic table by detecting columns from header keywords
   */
  private parseGenericTable(
    $: ReturnType<typeof cheerio.load>,
    table: ReturnType<ReturnType<typeof cheerio.load>>,
    warnings: string[]
  ): ScrapedCourse[] {
    const courses: ScrapedCourse[] = [];
    const headerRow = table.find('thead tr, tr').first();
    const headerCells = headerRow.find('th, td');
    if (headerCells.length < 4) return courses;

    const KEYWORDS: Record<string, string[]> = {
      courseCode: ['Course Code', '课程代码', '课程编号'],
      courseName: ['Course Name', '课程名', '课程名称'],
      credits: ['Credit', '学分'],
      grade: ['Grade', '成绩', '等级'],
    };

    const columnMap: Record<string, number> = {};
    headerCells.each((index: number, cell: unknown) => {
      const text = $(cell as cheerio.Element).text().trim();
      for (const [field, keywords] of Object.entries(KEYWORDS)) {
        if (columnMap[field] !== undefined) continue;
        // Use exact match first, then partial
        if (keywords.some((kw) => text === kw || text.startsWith(kw))) {
          columnMap[field] = index;
        }
      }
    });

    if (!columnMap.courseName || !columnMap.credits || !columnMap.grade) return courses;

    const dataRows = table.find('tbody tr').length > 0
      ? table.find('tbody tr')
      : table.find('tr').slice(1);

    dataRows.each((_: number, el: unknown) => {
      const cells = $(el as cheerio.Element).find('td');
      if (cells.length < 4) return;
      if (cells.first().attr('colspan')) return;

      const courseCode = columnMap.courseCode !== undefined ? cells.eq(columnMap.courseCode).text().trim() : '';
      const courseName = cells.eq(columnMap.courseName).text().trim();
      const creditsText = cells.eq(columnMap.credits).text().trim();
      const gradeText = cells.eq(columnMap.grade).text().trim();

      if (!courseName) return;

      const credits = parseFloat(creditsText);
      if (isNaN(credits) || credits <= 0) {
        warnings.push(`跳过课程 "${courseName}": 学分无效 (${creditsText})`);
        return;
      }

      const normalizedGrade = gradeText.replace(/\s+/g, '').toUpperCase()
        .replace('＋', '+').replace('－', '-');

      if (!isLetterGrade(normalizedGrade)) {
        warnings.push(`跳过课程 "${courseName}": 无法识别成绩 "${gradeText}"`);
        return;
      }

      courses.push({
        courseCode,
        courseName,
        credits,
        letterGrade: normalizedGrade,
        gradePoint: GRADE_POINT_MAP[normalizedGrade],
      });
    });

    return courses;
  }
}
