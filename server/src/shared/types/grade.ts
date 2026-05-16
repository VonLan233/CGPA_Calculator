/**
 * 成绩等级类型（厦大马来西亚分校无 A+）
 */
export type LetterGrade =
  | 'A' | 'A-'
  | 'B+' | 'B' | 'B-'
  | 'C+' | 'C' | 'C-'
  | 'D+' | 'D' | 'D-'
  | 'F';

/**
 * 绩点映射表 - 厦门大学马来西亚分校 4.0 制
 */
export const GRADE_POINT_MAP: Record<LetterGrade, number> = {
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
  'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'F'
];

/**
 * 所有有效绩点（按降序排列）— 用于绩点下拉选择器
 */
export const ALL_GRADE_POINTS: number[] = ALL_GRADES.map(g => GRADE_POINT_MAP[g]);

/**
 * 从绩点反查等级。容差 0.01，找不到时返回 'F'。
 */
export function gradePointToLetterGrade(gp: number): LetterGrade {
  for (const letter of ALL_GRADES) {
    if (Math.abs(GRADE_POINT_MAP[letter] - gp) < 0.01) return letter;
  }
  return 'F';
}

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
  originalGradeId?: string;
  createdAt?: Date;
  updatedAt?: Date;
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
  /** 课程代码，用于和已有成绩匹配（识别重修） */
  courseCode?: string;
  /** 是否为重修课程（已经修过的课重新选修） */
  isRetake?: boolean;
  /** 原成绩在 grades 列表中的 id（重修时用于覆盖计算） */
  originalGradeId?: string;
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
  /** 场景类型，前端用于决定是否显示"查看分配"按钮 */
  kind?: 'sprint' | 'balanced' | 'maintain' | 'target';
  /** 该场景下未来课程需要的平均绩点（仅 maintain/target 类型有意义） */
  requiredAvgGPA?: number;
  /** 该场景是否可达成（maintain/target 类型） */
  isAchievable?: boolean;
}
