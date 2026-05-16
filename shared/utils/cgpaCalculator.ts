import { Grade, CGPAResult, LetterGrade, GRADE_POINT_MAP, normalizeLetterGrade } from '../types/grade.js';

/**
 * 创建空的成绩分布对象
 */
function createEmptyDistribution(): Record<LetterGrade, number> {
  return {
    'A': 0, 'A-': 0,
    'B+': 0, 'B': 0, 'B-': 0,
    'C+': 0, 'C': 0, 'C-': 0,
    'D+': 0, 'D': 0, 'D-': 0,
    'F': 0,
  };
}

/**
 * 安全获取一条 Grade 的绩点（处理 gradePoint 缺失 / NaN / A+ 历史值的情况）
 */
function resolveGradePoint(grade: Grade): number {
  if (grade.gradePoint != null && !Number.isNaN(grade.gradePoint)) {
    return grade.gradePoint;
  }
  const letter = normalizeLetterGrade(grade.letterGrade);
  return GRADE_POINT_MAP[letter];
}

/**
 * 获取有效成绩（处理重修覆盖）
 * 选项 B：同一课程多次修读时取较优绩点，重修不会拉低原成绩
 *
 * 注意：直接比较 grade.gradePoint 在 NaN/undefined 时会返回 false，
 * 可能导致选错有效记录。这里用 resolveGradePoint 兜底。
 */
function getEffectiveGrades(grades: Grade[]): Grade[] {
  const courseMap = new Map<string, Grade>();

  for (const grade of grades) {
    const key = grade.courseCode || grade.courseName;
    const existing = courseMap.get(key);
    if (!existing || resolveGradePoint(grade) > resolveGradePoint(existing)) {
      courseMap.set(key, grade);
    }
  }

  return Array.from(courseMap.values());
}

/**
 * 计算CGPA
 * 公式: CGPA = Σ(学分 × 绩点) / Σ(学分)
 */
export function calculateCGPA(grades: Grade[]): CGPAResult {
  if (grades.length === 0) {
    return {
      cgpa: 0,
      totalCredits: 0,
      totalGradePoints: 0,
      courseCount: 0,
      gradeDistribution: createEmptyDistribution(),
    };
  }

  // 处理重修：只计算最新成绩
  const effectiveGrades = getEffectiveGrades(grades);

  let totalCredits = 0;
  let totalGradePoints = 0;
  const gradeDistribution = createEmptyDistribution();

  for (const grade of effectiveGrades) {
    // 防御性归一化：历史持久化数据可能仍是 'A+'，统一映射为 'A'
    const letter = normalizeLetterGrade(grade.letterGrade);
    const gradePoint =
      grade.gradePoint != null && !Number.isNaN(grade.gradePoint)
        ? grade.gradePoint
        : GRADE_POINT_MAP[letter];
    const weightedPoint = grade.credits * gradePoint;

    totalCredits += grade.credits;
    totalGradePoints += weightedPoint;
    gradeDistribution[letter]++;
  }

  const cgpa = totalCredits > 0 ? totalGradePoints / totalCredits : 0;

  return {
    cgpa: Math.round(cgpa * 100) / 100,
    totalCredits,
    totalGradePoints: Math.round(totalGradePoints * 100) / 100,
    courseCount: effectiveGrades.length,
    gradeDistribution,
  };
}

/**
 * 绩点转换为等级
 */
export function gradePointToLetter(gradePoint: number): LetterGrade {
  if (gradePoint >= 4.0) return 'A';
  if (gradePoint >= 3.7) return 'A-';
  if (gradePoint >= 3.3) return 'B+';
  if (gradePoint >= 3.0) return 'B';
  if (gradePoint >= 2.7) return 'B-';
  if (gradePoint >= 2.3) return 'C+';
  if (gradePoint >= 2.0) return 'C';
  if (gradePoint >= 1.7) return 'C-';
  if (gradePoint >= 1.3) return 'D+';
  if (gradePoint >= 1.0) return 'D';
  if (gradePoint >= 0.7) return 'D-';
  return 'F';
}

/**
 * 计算如果某门课重修后的CGPA
 */
export function simulateRetakeCGPA(
  grades: Grade[],
  courseId: string,
  newGrade: LetterGrade
): number {
  const simulatedGrades = grades.map(g => {
    if (g.id === courseId) {
      return {
        ...g,
        letterGrade: newGrade,
        gradePoint: GRADE_POINT_MAP[newGrade],
      };
    }
    return g;
  });

  return calculateCGPA(simulatedGrades).cgpa;
}

/**
 * 计算达到目标CGPA需要的未来课程平均绩点
 */
export function calculateRequiredAverageGPA(
  currentGrades: Grade[],
  targetCGPA: number,
  futureCredits: number
): number {
  const current = calculateCGPA(currentGrades);
  const totalCredits = current.totalCredits + futureCredits;
  const targetTotalPoints = targetCGPA * totalCredits;
  const requiredFuturePoints = targetTotalPoints - current.totalGradePoints;

  return futureCredits > 0 ? requiredFuturePoints / futureCredits : 0;
}
