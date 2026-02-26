import { Grade, LetterGrade, RetakeRecommendation, GRADE_POINT_MAP } from '../shared/types/grade.js';
import { calculateCGPA, gradePointToLetter } from '../shared/utils/cgpaCalculator.js';

interface RetakeAnalysis {
  isAchievable: boolean;
  currentCGPA: number;
  targetCGPA: number;
  gapToTarget: number;
  recommendations: RetakeRecommendation[];
}

export class RetakePlanningService {
  /**
   * 生成重修建议
   */
  generateRecommendations(params: {
    grades: Grade[];
    targetCGPA: number;
    maxRetakeCourses?: number;
    excludeCourses?: string[];
  }): RetakeAnalysis {
    const { grades, targetCGPA, maxRetakeCourses = 10, excludeCourses = [] } = params;

    // 计算当前CGPA
    const currentResult = calculateCGPA(grades);
    const currentCGPA = currentResult.cgpa;
    const gapToTarget = targetCGPA - currentCGPA;

    // 如果已达标
    if (gapToTarget <= 0) {
      return {
        isAchievable: true,
        currentCGPA,
        targetCGPA,
        gapToTarget: 0,
        recommendations: [],
      };
    }

    // 找出所有可重修的课程（非A+/A的课程）
    const retakeCandidates = grades
      .filter(g => !excludeCourses.includes(g.courseName))
      .filter(g => g.letterGrade !== 'A+' && g.letterGrade !== 'A')
      .map(g => this.analyzeRetakeImpact(g, grades, targetCGPA));

    // 按性价比排序
    const sortedRecommendations = retakeCandidates
      .sort((a, b) => b.priorityScore - a.priorityScore)
      .slice(0, maxRetakeCourses);

    // 检查是否可达成（假设所有可重修课程都拿A）
    const maxPossibleCGPA = this.calculateMaxPossibleCGPA(grades);
    const isAchievable = maxPossibleCGPA >= targetCGPA;

    return {
      isAchievable,
      currentCGPA,
      targetCGPA,
      gapToTarget: Math.round(gapToTarget * 100) / 100,
      recommendations: sortedRecommendations,
    };
  }

  /**
   * 分析单门课程重修影响
   */
  private analyzeRetakeImpact(
    course: Grade,
    allGrades: Grade[],
    targetCGPA: number
  ): RetakeRecommendation {
    const currentGradePoint = course.gradePoint;
    const credits = course.credits;

    // 计算当前总学分和总绩点
    const currentResult = calculateCGPA(allGrades);
    const totalCredits = currentResult.totalCredits;

    // 计算重修到A后的CGPA提升
    const newGradePointIfA = 4.0;
    const improvement = (credits * (newGradePointIfA - currentGradePoint)) / totalCredits;

    // 计算达到目标需要的最低等级
    const requiredGradePoint = this.calculateRequiredGradePoint(
      course,
      allGrades,
      targetCGPA
    );
    const requiredGrade = gradePointToLetter(requiredGradePoint);

    // 计算难度分数（基于当前成绩的提升幅度）
    const gradeGap = newGradePointIfA - currentGradePoint;
    const difficultyScore = Math.min(5, Math.ceil(gradeGap / 0.6));

    // 计算性价比分数
    const priorityScore = this.calculatePriorityScore(
      improvement,
      credits,
      difficultyScore,
      currentGradePoint
    );

    return {
      courseId: course.id,
      courseName: course.courseName,
      credits: course.credits,
      currentGrade: course.letterGrade,
      currentGradePoint: course.gradePoint,
      requiredGrade,
      cgpaImpact: Math.round(improvement * 1000) / 1000,
      priorityScore: Math.round(priorityScore),
      difficultyScore,
      reasoning: this.generateReasoning(course, improvement, difficultyScore, credits),
    };
  }

  /**
   * 计算达到目标CGPA需要的最低绩点
   */
  private calculateRequiredGradePoint(
    course: Grade,
    allGrades: Grade[],
    targetCGPA: number
  ): number {
    const currentResult = calculateCGPA(allGrades);
    const totalCredits = currentResult.totalCredits;
    const totalGradePoints = currentResult.totalGradePoints;

    // 目标总绩点 = 目标CGPA × 总学分
    const targetTotalPoints = targetCGPA * totalCredits;

    // 需要的额外绩点
    const neededExtraPoints = targetTotalPoints - totalGradePoints;

    // 这门课需要提供的绩点贡献
    const currentContribution = course.credits * course.gradePoint;
    const requiredContribution = currentContribution + neededExtraPoints;

    // 需要的绩点
    const requiredGradePoint = requiredContribution / course.credits;

    return Math.min(4.0, Math.max(0, requiredGradePoint));
  }

  /**
   * 计算性价比分数
   */
  private calculatePriorityScore(
    cgpaImpact: number,
    credits: number,
    difficulty: number,
    currentGradePoint: number
  ): number {
    // 基础分 = CGPA提升 × 1000
    const baseScore = cgpaImpact * 1000;

    // 学分加权（高学分课程更值得重修）
    const creditMultiplier = 1 + (credits - 3) * 0.1;

    // 难度惩罚
    const difficultyPenalty = 1 - (difficulty - 1) * 0.1;

    // 提升空间加权
    const improvementPotential = (4.0 - currentGradePoint) / 4.0;

    const score = baseScore * creditMultiplier * difficultyPenalty * (1 + improvementPotential * 0.5);

    return Math.min(100, Math.max(0, score));
  }

  /**
   * 计算所有课程都拿A时的最大可能CGPA
   */
  private calculateMaxPossibleCGPA(grades: Grade[]): number {
    const simulatedGrades = grades.map(g => ({
      ...g,
      letterGrade: 'A' as LetterGrade,
      gradePoint: 4.0,
    }));
    return calculateCGPA(simulatedGrades).cgpa;
  }

  /**
   * 生成推荐理由
   */
  private generateReasoning(
    course: Grade,
    improvement: number,
    difficulty: number,
    credits: number
  ): string {
    const reasons: string[] = [];

    if (improvement > 0.1) {
      reasons.push(`重修可显著提升CGPA约${(improvement * 100).toFixed(1)}%`);
    } else if (improvement > 0.05) {
      reasons.push(`重修可提升CGPA约${(improvement * 100).toFixed(1)}%`);
    }

    if (credits >= 4) {
      reasons.push(`高学分课程(${credits}学分)，重修性价比高`);
    }

    if (difficulty <= 2) {
      reasons.push('提升难度较低，容易取得好成绩');
    } else if (difficulty >= 4) {
      reasons.push('提升难度较高，需要充分准备');
    }

    if (course.gradePoint < 2.0) {
      reasons.push('当前成绩较低，有较大提升空间');
    }

    return reasons.join('；') || '建议考虑重修以提升CGPA';
  }
}
