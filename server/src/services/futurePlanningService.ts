import { Grade, LetterGrade, FutureCourse, CoursePlanSuggestion, PlanningScenario, GRADE_POINT_MAP } from '../shared/types/grade.js';
import { calculateCGPA, gradePointToLetter } from '../shared/utils/cgpaCalculator.js';

interface FuturePlanningResult {
  isAchievable: boolean;
  requiredAverageGPA: number;
  suggestedDistribution: CoursePlanSuggestion[];
  scenarios: PlanningScenario[];
}

export class FuturePlanningService {
  /**
   * 计算未来课程需求
   */
  calculateRequirements(params: {
    currentGrades: Grade[];
    targetCGPA: number;
    futureCourses: FutureCourse[];
  }): FuturePlanningResult {
    const { currentGrades, targetCGPA, futureCourses } = params;

    // 当前成绩汇总
    const currentResult = calculateCGPA(currentGrades);
    const currentCredits = currentResult.totalCredits;
    const currentGradePoints = currentResult.totalGradePoints;

    // 未来课程总学分
    const futureCredits = futureCourses.reduce((sum, c) => sum + c.credits, 0);

    // 计算达到目标CGPA需要的总绩点
    const totalCredits = currentCredits + futureCredits;
    const targetTotalPoints = targetCGPA * totalCredits;

    // 未来课程需要的绩点
    const requiredFuturePoints = targetTotalPoints - currentGradePoints;

    // 计算需要的平均GPA
    const requiredAverageGPA = futureCredits > 0
      ? requiredFuturePoints / futureCredits
      : 0;

    // 判断是否可行
    const isAchievable = requiredAverageGPA <= 4.0 && requiredAverageGPA >= 0;

    // 生成成绩分配建议
    const suggestedDistribution = this.generateDistribution(
      futureCourses,
      requiredAverageGPA
    );

    // 生成多种场景
    const scenarios = this.generateScenarios(
      currentGrades,
      futureCourses,
      targetCGPA
    );

    return {
      isAchievable,
      requiredAverageGPA: Math.round(requiredAverageGPA * 100) / 100,
      suggestedDistribution,
      scenarios,
    };
  }

  /**
   * 生成成绩分配建议
   */
  private generateDistribution(
    courses: FutureCourse[],
    requiredAvgGPA: number
  ): CoursePlanSuggestion[] {
    // 按难度排序：简单课程应该拿更高分
    const sortedCourses = [...courses].sort((a, b) => {
      const difficultyOrder = { easy: 0, medium: 1, hard: 2 };
      const diffA = difficultyOrder[a.estimatedDifficulty || 'medium'];
      const diffB = difficultyOrder[b.estimatedDifficulty || 'medium'];
      return diffA - diffB;
    });

    const result: CoursePlanSuggestion[] = [];
    let remainingCredits = courses.reduce((sum, c) => sum + c.credits, 0);

    for (const course of sortedCourses) {
      const difficulty = course.estimatedDifficulty || 'medium';
      let suggestedGradePoint: number;

      if (difficulty === 'easy') {
        suggestedGradePoint = Math.min(4.0, requiredAvgGPA + 0.3);
      } else if (difficulty === 'hard') {
        suggestedGradePoint = Math.max(2.0, requiredAvgGPA - 0.3);
      } else {
        suggestedGradePoint = requiredAvgGPA;
      }

      suggestedGradePoint = Math.min(4.0, Math.max(0, suggestedGradePoint));

      const suggestedGrade = gradePointToLetter(suggestedGradePoint);
      const actualGradePoint = GRADE_POINT_MAP[suggestedGrade];

      const flexibility = this.calculateFlexibility(
        actualGradePoint,
        requiredAvgGPA,
        course.credits,
        remainingCredits
      );

      const minGradePoint = Math.max(0, requiredAvgGPA - 0.5);
      const minAcceptableGrade = gradePointToLetter(minGradePoint);

      result.push({
        courseName: course.courseName,
        credits: course.credits,
        suggestedGrade,
        suggestedGradePoint: actualGradePoint,
        flexibility,
        minAcceptableGrade,
      });

      remainingCredits -= course.credits;
    }

    return result;
  }

  /**
   * 生成多种规划场景
   */
  private generateScenarios(
    currentGrades: Grade[],
    futureCourses: FutureCourse[],
    targetCGPA: number
  ): PlanningScenario[] {
    const scenarios: PlanningScenario[] = [];

    // 场景1：全A目标
    const allADistribution: Record<string, LetterGrade> = {};
    futureCourses.forEach(c => { allADistribution[c.courseName] = 'A'; });
    const allACGPA = this.simulateFutureCGPA(currentGrades, futureCourses, allADistribution);

    scenarios.push({
      name: '冲刺目标',
      description: '所有新课程都拿A',
      gradeDistribution: allADistribution,
      resultingCGPA: allACGPA,
      feasibility: 'challenging',
    });

    // 场景2：混合目标
    const mixedDistribution: Record<string, LetterGrade> = {};
    futureCourses.forEach((c, i) => {
      if (i % 3 === 0) mixedDistribution[c.courseName] = 'A';
      else if (i % 3 === 1) mixedDistribution[c.courseName] = 'B+';
      else mixedDistribution[c.courseName] = 'B';
    });
    const mixedCGPA = this.simulateFutureCGPA(currentGrades, futureCourses, mixedDistribution);

    scenarios.push({
      name: '均衡目标',
      description: 'A/B+/B混合分布',
      gradeDistribution: mixedDistribution,
      resultingCGPA: mixedCGPA,
      feasibility: 'moderate',
    });

    // 场景3：保守目标
    const conservativeDistribution: Record<string, LetterGrade> = {};
    futureCourses.forEach(c => { conservativeDistribution[c.courseName] = 'B+'; });
    const conservativeCGPA = this.simulateFutureCGPA(
      currentGrades, futureCourses, conservativeDistribution
    );

    scenarios.push({
      name: '保守目标',
      description: '所有新课程都拿B+',
      gradeDistribution: conservativeDistribution,
      resultingCGPA: conservativeCGPA,
      feasibility: 'easy',
    });

    return scenarios.sort((a, b) => b.resultingCGPA - a.resultingCGPA);
  }

  /**
   * 模拟未来CGPA
   */
  private simulateFutureCGPA(
    currentGrades: Grade[],
    futureCourses: FutureCourse[],
    distribution: Record<string, LetterGrade>
  ): number {
    const currentResult = calculateCGPA(currentGrades);

    let futurePoints = 0;
    let futureCredits = 0;

    for (const course of futureCourses) {
      const grade = distribution[course.courseName];
      const gradePoint = GRADE_POINT_MAP[grade];
      futurePoints += course.credits * gradePoint;
      futureCredits += course.credits;
    }

    const totalCredits = currentResult.totalCredits + futureCredits;
    const totalPoints = currentResult.totalGradePoints + futurePoints;

    return Math.round((totalPoints / totalCredits) * 100) / 100;
  }

  /**
   * 计算灵活度
   */
  private calculateFlexibility(
    suggestedGradePoint: number,
    requiredAvgGPA: number,
    courseCredits: number,
    remainingCredits: number
  ): 'strict' | 'moderate' | 'flexible' {
    const buffer = suggestedGradePoint - requiredAvgGPA;
    const creditRatio = courseCredits / remainingCredits;

    if (buffer < 0.3 && creditRatio > 0.3) return 'strict';
    if (buffer < 0.5) return 'moderate';
    return 'flexible';
  }
}
