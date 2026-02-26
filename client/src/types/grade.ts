/**
 * 成绩等级类型
 */
export type LetterGrade =
  | 'A+' | 'A' | 'A-'
  | 'B+' | 'B' | 'B-'
  | 'C+' | 'C' | 'C-'
  | 'D+' | 'D' | 'D-'
  | 'F';

/**
 * 绩点映射表 - 厦门大学马来西亚分校 4.0制
 */
export const GRADE_POINT_MAP: Record<LetterGrade, number> = {
  'A+': 4.0,
  'A':  4.0,
  'A-': 3.7,
  'B+': 3.3,
  'B':  3.0,
  'B-': 2.7,
  'C+': 2.3,
  'C':  2.0,
  'C-': 1.7,
  'D+': 1.3,
  'D':  1.0,
  'D-': 0.7,
  'F':  0,
};

/**
 * 所有等级（按绩点降序排列）
 */
export const ALL_GRADES: LetterGrade[] = [
  'A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'F'
];

/**
 * 课程成绩记录
 */
export interface Grade {
  id: string;
  courseName: string;
  courseCode?: string;
  credits: number;
  letterGrade: LetterGrade;
  gradePoint: number;
  semester?: string;
  isRetake?: boolean;
}

/**
 * CGPA计算结果
 */
export interface CGPAResult {
  cgpa: number;
  totalCredits: number;
  totalGradePoints: number;
  courseCount: number;
  gradeDistribution: Record<LetterGrade, number>;
}

/**
 * 重修建议
 */
export interface RetakeRecommendation {
  courseId: string;
  courseName: string;
  credits: number;
  currentGrade: LetterGrade;
  currentGradePoint: number;
  requiredGrade: LetterGrade;
  cgpaImpact: number;
  priorityScore: number;
  difficultyScore: number;
  reasoning: string;
}

/**
 * 未来课程
 */
export interface FutureCourse {
  id: string;
  courseName: string;
  credits: number;
  estimatedDifficulty?: 'easy' | 'medium' | 'hard';
}

/**
 * 课程规划建议
 */
export interface CoursePlanSuggestion {
  courseName: string;
  credits: number;
  suggestedGrade: LetterGrade;
  suggestedGradePoint: number;
  flexibility: 'strict' | 'moderate' | 'flexible';
  minAcceptableGrade: LetterGrade;
}

/**
 * 规划场景
 */
export interface PlanningScenario {
  name: string;
  description: string;
  gradeDistribution: Record<string, LetterGrade>;
  resultingCGPA: number;
  feasibility: 'easy' | 'moderate' | 'challenging' | 'very_hard';
}
