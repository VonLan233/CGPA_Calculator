import { Grade, LetterGrade, FutureCourse, CoursePlanSuggestion, PlanningScenario, GRADE_POINT_MAP } from '../shared/types/grade.js';
import { calculateCGPA, gradePointToLetter } from '../shared/utils/cgpaCalculator.js';

interface FuturePlanningResult {
  isAchievable: boolean;
  requiredAverageGPA: number;
  /** 当为 true 时表示在最优重修假设下，目标已经达成，新课没有下限要求 */
  reachableByRetakesAlone?: boolean;
  suggestedDistribution: CoursePlanSuggestion[];
  scenarios: PlanningScenario[];
}

export class FuturePlanningService {
  /**
   * 找到 retake 课程对应的「原成绩」
   * 优先用 originalGradeId 精确匹配；否则按 courseCode 匹配。
   * 若 courseCode 有多条记录（例如同一课多次修读），取最高 gradePoint 那条，
   * 与 calculateCGPA / option B 的去重语义一致。
   */
  private findOriginalGrade(
    course: FutureCourse,
    currentGrades: Grade[]
  ): Grade | undefined {
    if (!course.isRetake) return undefined;
    if (course.originalGradeId) {
      const byId = currentGrades.find(g => g.id === course.originalGradeId);
      if (byId) return byId;
    }
    if (course.courseCode) {
      const matches = currentGrades.filter(g => g.courseCode === course.courseCode);
      if (matches.length === 0) return undefined;
      return matches.reduce((best, cur) =>
        cur.gradePoint > best.gradePoint ? cur : best
      );
    }
    return undefined;
  }

  /**
   * 计算未来课程需求
   *
   * 区分两类未来课程：
   *  - 非重修课（新课）：增加分母（学分）与分子（绩点）
   *  - 重修课：分母不变（学分已在已修中），分子按 max(原, 新) 替换
   *
   * requiredAverageGPA 含义：假设所有重修都能取得 A（最大化收益）时，
   * 新课需要达到的平均绩点。
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

    // 分流：重修（能找到原成绩）vs 新课（含「找不到原成绩」的伪重修）
    // 与 simulateFutureCGPA 的降级逻辑保持一致
    const retakeCourses: { course: FutureCourse; orig: Grade }[] = [];
    const newCourses: FutureCourse[] = [];
    for (const c of futureCourses) {
      if (c.isRetake) {
        const orig = this.findOriginalGrade(c, currentGrades);
        if (orig) {
          retakeCourses.push({ course: c, orig });
          continue;
        }
        // 找不到原成绩 → 当作新课处理
      }
      newCourses.push(c);
    }

    // 新课总学分（这是分母里真正新增的部分）
    const newCredits = newCourses.reduce((sum, c) => sum + c.credits, 0);

    // 最佳情况：所有重修都拿 A（4.0），累计可获得的额外绩点 delta
    // 取 max(0, ...) 是因为选项 B 语义：重修不会拉低原成绩
    // 注意：分母锚定在原课程的 credits 上（重修不改变 totalCredits），
    // 所以新贡献也按 orig.credits 计算，避免学分不一致导致替换失衡。
    let bestRetakeDelta = 0;
    for (const { course, orig } of retakeCourses) {
      if (course.credits !== orig.credits) {
        console.warn(
          `[future-planning] retake credit mismatch: ${course.courseName} ` +
          `course=${course.credits} vs orig=${orig.credits}, using orig`
        );
      }
      const newBest = orig.credits * 4.0;
      const oldPoints = orig.credits * orig.gradePoint;
      bestRetakeDelta += Math.max(0, newBest - oldPoints);
    }

    // 计算达到目标CGPA需要的总绩点
    const totalCredits = currentCredits + newCredits;
    const targetTotalPoints = targetCGPA * totalCredits;

    // 新课需要的绩点（扣除当前已有 + 重修最大收益）
    const requiredFromNew = targetTotalPoints - currentGradePoints - bestRetakeDelta;

    // 原始需求（可能为负——表示"在最优重修假设下，目标已经达成，新课无下限"）
    const rawRequiredAverageGPA =
      newCredits > 0 ? requiredFromNew / newCredits : 0;

    // 对外输出统一 clamp 到 [0, +∞)，负数对消费者无意义
    const requiredAverageGPA = Math.max(0, rawRequiredAverageGPA);

    // 当 raw 为负时，标记"在最优重修后已超目标"
    const reachableByRetakesAlone = newCredits > 0 && rawRequiredAverageGPA <= 0;

    // 判断是否可行
    // - 有新课时：原始需求 ≤ 4.0（≤ 0 也算可行）
    // - 全是重修：检查最佳重修后的 CGPA 是否能达到 target
    // - 无任何未来课程：检查当前 CGPA 是否已达 target
    let isAchievable: boolean;
    if (newCredits > 0) {
      isAchievable = rawRequiredAverageGPA <= 4.0;
    } else if (retakeCourses.length > 0) {
      const bestCGPA = currentCredits > 0
        ? (currentGradePoints + bestRetakeDelta) / currentCredits
        : 0;
      isAchievable = bestCGPA >= targetCGPA;
    } else {
      const currentCGPA = currentCredits > 0
        ? currentGradePoints / currentCredits
        : 0;
      isAchievable = currentCGPA >= targetCGPA;
    }

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
      reachableByRetakesAlone,
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
   * 根据「未来课程需要的平均绩点」给每门课分配一个建议成绩
   * （内部 helper：generateDistribution 关心建议元数据，这里只输出 letter grade map）
   */
  private buildGradeDistribution(
    courses: FutureCourse[],
    requiredAvgGPA: number
  ): Record<string, LetterGrade> {
    const result: Record<string, LetterGrade> = {};
    for (const course of courses) {
      const difficulty = course.estimatedDifficulty || 'medium';
      let gp: number;
      if (difficulty === 'easy') gp = Math.min(4.0, requiredAvgGPA + 0.3);
      else if (difficulty === 'hard') gp = Math.max(2.0, requiredAvgGPA - 0.3);
      else gp = requiredAvgGPA;
      gp = Math.min(4.0, Math.max(0, gp));
      result[course.courseName] = gradePointToLetter(gp);
    }
    return result;
  }

  /**
   * 根据「未来课程需要的平均绩点」推算难度档位（用于场景卡片着色）
   */
  private feasibilityFromRequired(
    requiredAvg: number,
    achievable: boolean
  ): PlanningScenario['feasibility'] {
    if (!achievable) return 'very_hard';
    if (requiredAvg <= 2.0) return 'easy';
    if (requiredAvg <= 3.0) return 'moderate';
    if (requiredAvg <= 3.7) return 'challenging';
    return 'very_hard';
  }

  /**
   * 生成多种规划场景（固定四张卡片，按业务顺序排列）：
   *  1. 冲刺目标       — 全 A（最乐观）
   *  2. 均衡目标       — A / A- / B+ 循环
   *  3. 保持现有 CGPA  — 维持当前 CGPA 不下滑所需的新课平均绩点
   *  4. 达到目标 CGPA  — 达到 targetCGPA 所需的新课平均绩点
   */
  private generateScenarios(
    currentGrades: Grade[],
    futureCourses: FutureCourse[],
    targetCGPA: number
  ): PlanningScenario[] {
    const currentResult = calculateCGPA(currentGrades);
    const currentCGPA = currentResult.cgpa;

    // 分流重修 vs 新课（与 calculateRequirements 一致）
    const retakeMatched: { course: FutureCourse; orig: Grade }[] = [];
    const newCourses: FutureCourse[] = [];
    for (const c of futureCourses) {
      if (c.isRetake) {
        const orig = this.findOriginalGrade(c, currentGrades);
        if (orig) {
          retakeMatched.push({ course: c, orig });
          continue;
        }
      }
      newCourses.push(c);
    }
    const newCredits = newCourses.reduce((s, c) => s + c.credits, 0);

    // 最佳重修收益（用于计算「新课平均绩点最低需求」）
    // 分母锚定在原课程的 credits 上，新贡献也按 orig.credits 计算，
    // 与 calculateRequirements / simulateFutureCGPA 保持一致
    let bestRetakeDelta = 0;
    for (const { course, orig } of retakeMatched) {
      if (course.credits !== orig.credits) {
        console.warn(
          `[future-planning] retake credit mismatch in scenarios: ${course.courseName} ` +
          `course=${course.credits} vs orig=${orig.credits}, using orig`
        );
      }
      const newBest = orig.credits * 4.0;
      const oldPoints = orig.credits * orig.gradePoint;
      bestRetakeDelta += Math.max(0, newBest - oldPoints);
    }

    // 给定目标 CGPA，反算新课需要的平均绩点
    const computeRequiredAvg = (target: number): number => {
      if (newCredits <= 0) return 0;
      const totalCredits = currentResult.totalCredits + newCredits;
      const targetPoints = target * totalCredits;
      return (
        (targetPoints - currentResult.totalGradePoints - bestRetakeDelta) / newCredits
      );
    };

    // 给定目标 CGPA，判断是否可达
    const isAchievableFor = (target: number, requiredAvg: number): boolean => {
      if (newCredits > 0) {
        return requiredAvg <= 4.0;
      }
      // 全是重修：检查最佳重修后的 CGPA
      const bestCGPA = currentResult.totalCredits > 0
        ? (currentResult.totalGradePoints + bestRetakeDelta) / currentResult.totalCredits
        : 0;
      return bestCGPA >= target;
    };

    const scenarios: PlanningScenario[] = [];

    // ── 场景1：冲刺目标（全 A）
    const sprintDist: Record<string, LetterGrade> = {};
    futureCourses.forEach((c) => { sprintDist[c.courseName] = 'A'; });
    scenarios.push({
      name: '冲刺目标',
      description: '所有新课程都拿 A',
      gradeDistribution: sprintDist,
      resultingCGPA: this.simulateFutureCGPA(currentGrades, futureCourses, sprintDist),
      feasibility: 'challenging',
      kind: 'sprint',
    });

    // ── 场景2：均衡目标（A / A- / B+ 循环）
    const balancedGrades: LetterGrade[] = ['A', 'A-', 'B+'];
    const balancedDist: Record<string, LetterGrade> = {};
    futureCourses.forEach((c, i) => {
      balancedDist[c.courseName] = balancedGrades[i % 3];
    });
    scenarios.push({
      name: '均衡目标',
      description: 'A / A- / B+ 均衡分布',
      gradeDistribution: balancedDist,
      resultingCGPA: this.simulateFutureCGPA(currentGrades, futureCourses, balancedDist),
      feasibility: 'moderate',
      kind: 'balanced',
    });

    // ── 场景3：保持现有 CGPA
    const maintainRequiredAvg = computeRequiredAvg(currentCGPA);
    const maintainAchievable = isAchievableFor(currentCGPA, maintainRequiredAvg);
    // 分配基准：有新课时用算出的需求，全是重修时用 currentCGPA 兜底
    // （避免 requiredAvg=0 导致所有课程都被建议 F）
    const maintainDistAvg = newCredits > 0
      ? Math.max(0, maintainRequiredAvg)
      : currentCGPA;
    const maintainDist = this.buildGradeDistribution(futureCourses, maintainDistAvg);
    scenarios.push({
      name: '保持现有 CGPA',
      description: `维持在 ${currentCGPA.toFixed(2)} 不下滑`,
      gradeDistribution: maintainDist,
      resultingCGPA: this.simulateFutureCGPA(currentGrades, futureCourses, maintainDist),
      feasibility: this.feasibilityFromRequired(maintainRequiredAvg, maintainAchievable),
      kind: 'maintain',
      requiredAvgGPA: Math.round(Math.max(0, maintainRequiredAvg) * 100) / 100,
      isAchievable: maintainAchievable,
    });

    // ── 场景4：达到目标 CGPA
    const targetRequiredAvg = computeRequiredAvg(targetCGPA);
    const targetAchievable = isAchievableFor(targetCGPA, targetRequiredAvg);
    const targetDistAvg = newCredits > 0
      ? Math.max(0, targetRequiredAvg)
      : targetCGPA;
    const targetDist = this.buildGradeDistribution(futureCourses, targetDistAvg);
    scenarios.push({
      name: '达到目标 CGPA',
      description: `本学期结束达到 ${targetCGPA.toFixed(2)}`,
      gradeDistribution: targetDist,
      resultingCGPA: this.simulateFutureCGPA(currentGrades, futureCourses, targetDist),
      feasibility: this.feasibilityFromRequired(targetRequiredAvg, targetAchievable),
      kind: 'target',
      requiredAvgGPA: Math.round(Math.max(0, targetRequiredAvg) * 100) / 100,
      isAchievable: targetAchievable,
    });

    // 固定顺序，不再按 CGPA 排序
    return scenarios;
  }

  /**
   * 模拟未来CGPA
   *
   * 对于 isRetake=true 的课程：
   *   - 分母（学分）不变：原课程的学分已在 currentGrades 中
   *   - 分子（绩点）按 max(原, 新) 替换原贡献（选项 B 语义）
   * 对于普通新课：
   *   - 分母 += credits
   *   - 分子 += credits × newGP
   */
  private simulateFutureCGPA(
    currentGrades: Grade[],
    futureCourses: FutureCourse[],
    distribution: Record<string, LetterGrade>
  ): number {
    const currentResult = calculateCGPA(currentGrades);
    let totalCredits = currentResult.totalCredits;
    let totalPoints = currentResult.totalGradePoints;

    for (const course of futureCourses) {
      const grade = distribution[course.courseName];
      if (!grade) continue;
      const newGP = GRADE_POINT_MAP[grade];

      if (course.isRetake) {
        const orig = this.findOriginalGrade(course, currentGrades);
        if (orig) {
          // 分母锚定在 orig.credits 上（totalCredits 未变），所以新贡献也按 orig.credits 计算
          const oldPoints = orig.credits * orig.gradePoint;
          const newPoints = orig.credits * newGP;
          // 选项 B：取较优。新成绩劣于原成绩时不变动
          if (newPoints > oldPoints) {
            totalPoints += newPoints - oldPoints;
          }
          // 学分不变，跳过累加
          continue;
        }
        // 找不到原成绩：降级为新课处理
      }

      totalPoints += course.credits * newGP;
      totalCredits += course.credits;
    }

    if (totalCredits <= 0) return 0;
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
