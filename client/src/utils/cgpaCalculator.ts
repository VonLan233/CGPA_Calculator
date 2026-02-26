import type { Grade, CGPAResult, LetterGrade } from '../types/grade';
import { GRADE_POINT_MAP } from '../types/grade';

/**
 * 创建空的成绩分布对象
 */
function createEmptyDistribution(): Record<LetterGrade, number> {
  return {
    'A+': 0, 'A': 0, 'A-': 0,
    'B+': 0, 'B': 0, 'B-': 0,
    'C+': 0, 'C': 0, 'C-': 0,
    'D+': 0, 'D': 0, 'D-': 0,
    'F': 0,
  };
}

/**
 * 获取有效成绩（处理重修覆盖）
 * 同一课程多次修读时，后出现的成绩覆盖前者（重修以新成绩为准）
 */
function getEffectiveGrades(grades: Grade[]): Grade[] {
  const courseMap = new Map<string, Grade>();

  for (const grade of grades) {
    const key = grade.courseCode || grade.courseName;
    // 后出现的覆盖前者，重修成绩替换原成绩
    courseMap.set(key, grade);
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
    const gradePoint = grade.gradePoint ?? GRADE_POINT_MAP[grade.letterGrade];
    const weightedPoint = grade.credits * gradePoint;

    totalCredits += grade.credits;
    totalGradePoints += weightedPoint;
    gradeDistribution[grade.letterGrade]++;
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
