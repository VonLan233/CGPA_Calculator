import { useState, useEffect, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useGradeStore } from '../store/useGradeStore';
import { CGPADisplay } from '../components/grade/CGPADisplay';
import type { CoursePlanSuggestion, PlanningScenario, FutureCourse, LetterGrade, Grade } from '../types/grade';
import { GRADE_POINT_MAP, ALL_GRADE_POINTS, gradePointToLetterGrade } from '../types/grade';
import { calculateCGPA } from '../utils/cgpaCalculator';

interface ScrapedCurrentCourse {
  courseCode: string;
  courseName: string;
  credits: number;
}

export function FuturePlanningPage() {
  const {
    grades,
    targetCGPA,
    setTargetCGPA,
    futureCourses,
    addFutureCourse,
    addFutureCourses,
    removeFutureCourse,
    clearFutureCourses,
  } = useGradeStore();

  const [newCourse, setNewCourse] = useState({
    courseName: '',
    credits: 3,
    difficulty: 'medium' as 'easy' | 'medium' | 'hard',
  });

  // ─── 教务系统导入「本学期课程」状态 ───
  const [showImport, setShowImport] = useState(false);
  const [importUsername, setImportUsername] = useState('');
  const [importPassword, setImportPassword] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [importWarnings, setImportWarnings] = useState<string[]>([]);

  const handleImportCurrentSemester = async () => {
    if (!importUsername.trim() || !importPassword.trim()) {
      setImportError('请输入学号和密码');
      return;
    }
    setImportLoading(true);
    setImportError(null);
    setImportMessage(null);
    setImportWarnings([]);

    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_BASE_URL || ''}/api/v1/scrape/current-semester`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: importUsername.trim(),
            password: importPassword.trim(),
          }),
        }
      );

      const data = await res.json();
      if (!data.success) {
        setImportError(data.error || '抓取失败');
        return;
      }

      const scraped: ScrapedCurrentCourse[] = data.data.courses;
      setImportWarnings(data.data.warnings || []);

      // 按 courseCode 比对已有成绩，识别重修
      const gradeByCode = new Map(
        grades.filter((g) => g.courseCode).map((g) => [g.courseCode!, g])
      );

      const toAdd: FutureCourse[] = scraped.map((c) => {
        const orig = gradeByCode.get(c.courseCode);
        return {
          id: uuidv4(),
          courseName: c.courseName,
          credits: c.credits,
          courseCode: c.courseCode,
          estimatedDifficulty: 'medium' as const,
          ...(orig
            ? { isRetake: true, originalGradeId: orig.id }
            : {}),
        };
      });

      const { added, skipped } = addFutureCourses(toAdd);
      // 重修数从「实际加入」的子集统计，避免被去重跳过的课程计入
      const retakeCount = added.filter((c) => c.isRetake).length;

      const parts: string[] = [];
      parts.push(`成功导入 ${added.length} 门课程`);
      if (retakeCount > 0) parts.push(`其中 ${retakeCount} 门为重修`);
      if (skipped > 0) parts.push(`跳过 ${skipped} 门已存在`);
      setImportMessage(parts.join('，'));

      // 清空密码（凭据不久留）
      setImportPassword('');
    } catch {
      setImportError('无法连接到后端服务，请确保服务已启动');
    } finally {
      setImportLoading(false);
    }
  };

  const [planResult, setPlanResult] = useState<{
    isAchievable: boolean;
    requiredAverageGPA: number;
    suggestions: CoursePlanSuggestion[];
    scenarios: PlanningScenario[];
  } | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 场景卡片的展开状态——同一时刻只展开一个分配视图
  const [expandedScenario, setExpandedScenario] = useState<'maintain' | 'target' | null>(null);

  // ─── 本学期成绩模拟（实时预览） ───
  // 每门未来课程的模拟成绩（letter），默认 'A'
  const [simGrades, setSimGrades] = useState<Record<string, LetterGrade>>({});

  // futureCourses 变化时，为新课设默认值，移除已删除课程的记录
  useEffect(() => {
    setSimGrades((prev) => {
      const next: Record<string, LetterGrade> = {};
      for (const c of futureCourses) {
        next[c.id] = prev[c.id] || 'A';
      }
      return next;
    });
  }, [futureCourses]);

  // 模拟结果：依赖 grades / futureCourses / simGrades
  const simulationResult = useMemo(() => {
    const currentCGPA = grades.length > 0 ? calculateCGPA(grades).cgpa : 0;
    if (futureCourses.length === 0) {
      return { simulatedCGPA: currentCGPA, currentCGPA, delta: 0 };
    }

    // 用 'sim-' 前缀避免 id 与 grades 冲突；以 courseCode/Name 落到 getEffectiveGrades 的去重 key 上
    // 重修：当 future course 的 courseCode 与 grades 中某条相同时，calculateCGPA 内部会按
    // max(原, 新) 取较优（选项 B 语义），不需要在这里额外处理
    const simulatedFutureGrades: Grade[] = futureCourses.map((fc) => {
      const letter = simGrades[fc.id] || 'A';
      return {
        id: 'sim-' + fc.id,
        courseName: fc.courseName,
        courseCode: fc.courseCode,
        credits: fc.credits,
        letterGrade: letter,
        gradePoint: GRADE_POINT_MAP[letter],
      };
    });

    const result = calculateCGPA([...grades, ...simulatedFutureGrades]);
    return {
      simulatedCGPA: result.cgpa,
      currentCGPA,
      delta: result.cgpa - currentCGPA,
    };
  }, [grades, futureCourses, simGrades]);

  const handleSimGradeChange = (courseId: string, newGP: number) => {
    setSimGrades((prev) => ({
      ...prev,
      [courseId]: gradePointToLetterGrade(newGP),
    }));
  };

  const handleSimReset = (toGrade: LetterGrade) => {
    const next: Record<string, LetterGrade> = {};
    for (const c of futureCourses) next[c.id] = toGrade;
    setSimGrades(next);
  };

  const getGradeStyle = (gp: number) => {
    if (gp >= 3.7) return 'bg-emerald-50 text-emerald-700';
    if (gp >= 3.0) return 'bg-blue-50 text-blue-700';
    if (gp >= 2.0) return 'bg-amber-50 text-amber-700';
    return 'bg-red-50 text-red-700';
  };

  useEffect(() => {
    if (grades.length > 0 && futureCourses.length > 0) {
      fetchPlanSuggestions();
    } else {
      setPlanResult(null);
    }
  }, [grades, targetCGPA, futureCourses]);

  const fetchPlanSuggestions = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/v1/planning/future`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentGrades: grades,
          targetCGPA,
          futureCourses,
        }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();
      if (result.success) {
        setPlanResult({
          isAchievable: result.data.isAchievable,
          requiredAverageGPA: result.data.requiredAverageGPA,
          suggestions: result.data.suggestedDistribution,
          scenarios: result.data.scenarios,
        });
      }
    } catch {
      setError('获取规划建议失败，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddCourse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCourse.courseName.trim()) return;

    addFutureCourse({
      id: uuidv4(),
      courseName: newCourse.courseName.trim(),
      credits: newCourse.credits,
      estimatedDifficulty: newCourse.difficulty,
    });

    setNewCourse({ courseName: '', credits: 3, difficulty: 'medium' });
  };

  const getFlexibilityColor = (flex: string) => {
    switch (flex) {
      case 'flexible':
        return 'bg-green-100 text-green-800';
      case 'moderate':
        return 'bg-yellow-100 text-yellow-800';
      case 'strict':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getFlexibilityText = (flex: string) => {
    switch (flex) {
      case 'flexible':
        return '灵活';
      case 'moderate':
        return '中等';
      case 'strict':
        return '严格';
      default:
        return flex;
    }
  };

  if (grades.length === 0) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">暂无成绩数据</h2>
        <p className="text-gray-500">请先在"成绩录入"页面添加成绩</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">未来课程规划</h1>
        <p className="text-gray-500 mt-1">
          计算达到目标CGPA需要的未来课程成绩
        </p>
      </div>

      {/* CGPA和目标设置 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <CGPADisplay />

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">目标设置</h3>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              目标 CGPA
            </label>
            <input
              type="number"
              min="0"
              max="4"
              step="0.1"
              value={targetCGPA}
              onChange={(e) => setTargetCGPA(parseFloat(e.target.value))}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-lg font-medium focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          {planResult && (
            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">需要平均绩点</span>
                <span
                  className={`font-medium ${
                    planResult.requiredAverageGPA > 4.0
                      ? 'text-red-600'
                      : planResult.requiredAverageGPA > 3.5
                      ? 'text-orange-600'
                      : 'text-green-600'
                  }`}
                >
                  {planResult.requiredAverageGPA.toFixed(2)}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 从教务系统导入本学期课程 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              从教务系统导入本学期课程
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              一键登录 <span className="font-mono">ac.xmu.edu.my</span> 抓取已选课程，自动识别重修
            </p>
          </div>
          <button
            onClick={() => {
              setShowImport((v) => !v);
              setImportError(null);
              setImportMessage(null);
            }}
            className="px-4 py-2 text-sm font-medium text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors"
          >
            {showImport ? '收起' : '展开'}
          </button>
        </div>

        {showImport && (
          <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">学号</label>
                <input
                  type="text"
                  value={importUsername}
                  onChange={(e) => {
                    setImportUsername(e.target.value);
                    setImportError(null);
                  }}
                  placeholder="输入学号"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">密码</label>
                <input
                  type="password"
                  value={importPassword}
                  onChange={(e) => {
                    setImportPassword(e.target.value);
                    setImportError(null);
                  }}
                  placeholder="输入密码"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-colors"
                />
              </div>
            </div>

            <p className="text-[11px] text-gray-400">
              凭据仅用于本次请求，不会被存储。导入后会按课程代码自动识别重修课。
            </p>

            {importError && (
              <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-xs text-red-600">{importError}</p>
              </div>
            )}

            {importMessage && (
              <div className="px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg">
                <p className="text-xs text-emerald-700">{importMessage}</p>
              </div>
            )}

            {importWarnings.length > 0 && (
              <div className="px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg space-y-0.5">
                {importWarnings.map((w, i) => (
                  <p key={i} className="text-[11px] text-amber-700">{w}</p>
                ))}
              </div>
            )}

            <button
              onClick={handleImportCurrentSemester}
              disabled={importLoading}
              className="w-full md:w-auto px-5 py-2 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-lg font-medium text-sm hover:from-primary-700 hover:to-primary-800 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all"
            >
              {importLoading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  抓取中...
                </span>
              ) : (
                '登录并导入本学期课程'
              )}
            </button>
          </div>
        )}
      </div>

      {/* 添加未来课程 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">手动添加未来课程</h3>
          {futureCourses.length > 0 && (
            <button
              onClick={clearFutureCourses}
              className="text-sm text-red-600 hover:text-red-800"
            >
              清空课程
            </button>
          )}
        </div>

        <form onSubmit={handleAddCourse} className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="课程名称"
              value={newCourse.courseName}
              onChange={(e) =>
                setNewCourse({ ...newCourse, courseName: e.target.value })
              }
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          <div className="w-24">
            <input
              type="number"
              min="0.5"
              max="10"
              step="0.5"
              value={newCourse.credits}
              onChange={(e) =>
                setNewCourse({ ...newCourse, credits: parseFloat(e.target.value) })
              }
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="学分"
            />
          </div>
          <div className="w-32">
            <select
              value={newCourse.difficulty}
              onChange={(e) =>
                setNewCourse({
                  ...newCourse,
                  difficulty: e.target.value as 'easy' | 'medium' | 'hard',
                })
              }
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="easy">简单</option>
              <option value="medium">中等</option>
              <option value="hard">困难</option>
            </select>
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            添加
          </button>
        </form>

        {/* 已添加的课程列表 */}
        {futureCourses.length > 0 && (
          <div className="mt-4 space-y-2">
            {futureCourses.map((course) => (
              <div
                key={course.id}
                className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-2"
              >
                <div className="flex items-center space-x-3 flex-wrap">
                  <span className="font-medium text-gray-900">
                    {course.courseName}
                  </span>
                  {course.courseCode && (
                    <span className="text-[11px] text-gray-400 font-mono">
                      {course.courseCode}
                    </span>
                  )}
                  <span className="text-sm text-gray-500">
                    {course.credits} 学分
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded bg-gray-200 text-gray-600">
                    {course.estimatedDifficulty === 'easy'
                      ? '简单'
                      : course.estimatedDifficulty === 'hard'
                      ? '困难'
                      : '中等'}
                  </span>
                  {course.isRetake && (
                    <span className="text-xs px-2 py-0.5 rounded bg-purple-100 text-purple-700 font-medium">
                      重修（覆盖原成绩）
                    </span>
                  )}
                </div>
                <button
                  onClick={() => removeFutureCourse(course.id)}
                  className="text-red-600 hover:text-red-800 text-sm"
                >
                  移除
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 本学期成绩模拟 — 实时预览 */}
      {futureCourses.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                本学期成绩模拟
              </h3>
              <p className="text-sm text-gray-500 mt-0.5">
                调整每门课的预期绩点，实时查看本学期结束后的 CGPA
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleSimReset('A')}
                className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                全部重置为 4.0
              </button>
              <button
                onClick={() => handleSimReset('B')}
                className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                全部重置为 3.0
              </button>
            </div>
          </div>

          {/* CGPA 对比横幅 */}
          <div className="px-6 py-5 bg-gradient-to-br from-primary-50/40 via-white to-white border-b border-gray-100">
            <div className="grid grid-cols-3 gap-4 items-center">
              <div className="text-center">
                <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">
                  当前 CGPA
                </p>
                <p className="text-3xl font-bold text-gray-700 mt-1">
                  {simulationResult.currentCGPA.toFixed(2)}
                </p>
              </div>
              <div className="text-center">
                <svg
                  className="mx-auto w-6 h-6 text-gray-300"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M17 8l4 4m0 0l-4 4m4-4H3"
                  />
                </svg>
                <p
                  className={`text-xs font-semibold mt-1 ${
                    simulationResult.delta > 0
                      ? 'text-emerald-600'
                      : simulationResult.delta < 0
                      ? 'text-red-500'
                      : 'text-gray-400'
                  }`}
                >
                  {simulationResult.delta > 0
                    ? `+${simulationResult.delta.toFixed(2)}`
                    : simulationResult.delta.toFixed(2)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-[11px] font-medium text-primary-500 uppercase tracking-wider">
                  本学期结束后
                </p>
                <p className="text-4xl font-extrabold text-primary-700 mt-1">
                  {simulationResult.simulatedCGPA.toFixed(2)}
                </p>
              </div>
            </div>
          </div>

          {/* 每门课的绩点选择 */}
          <div className="divide-y divide-gray-100">
            {futureCourses.map((course) => {
              const letter = simGrades[course.id] || 'A';
              const gp = GRADE_POINT_MAP[letter];
              return (
                <div
                  key={course.id}
                  className="px-6 py-3 flex items-center justify-between hover:bg-gray-50/50 transition-colors"
                >
                  <div className="min-w-0 flex-1 mr-4">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {course.courseName}
                      </p>
                      {course.isRetake && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-50 text-purple-600 flex-shrink-0">
                          重修
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {course.courseCode && (
                        <span className="font-mono mr-2">{course.courseCode}</span>
                      )}
                      {course.credits} 学分
                    </p>
                  </div>
                  <select
                    value={gp}
                    onChange={(e) =>
                      handleSimGradeChange(course.id, parseFloat(e.target.value))
                    }
                    className={`px-3 py-1 rounded-md text-sm font-semibold border-0 cursor-pointer focus:ring-2 focus:ring-primary-300 ${getGradeStyle(
                      gp
                    )}`}
                  >
                    {ALL_GRADE_POINTS.map((p) => (
                      <option key={p} value={p}>
                        {p.toFixed(1)}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="text-center py-8 text-gray-400 text-sm">分析中...</div>
      )}

      {/* Error */}
      {error && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-2xl">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* 规划建议 */}
      {planResult && (
        <>
          {/* 可行性提示 */}
          {!planResult.isAchievable && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="flex">
                <svg
                  className="h-5 w-5 text-red-400"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">
                    目标无法达成
                  </h3>
                  <p className="mt-1 text-sm text-red-700">
                    即使所有新课程都拿A，也无法达到目标CGPA。请考虑降低目标或增加更多高学分课程。
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 成绩分配建议 */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                建议成绩分配
              </h3>
              <p className="text-sm text-gray-500">
                根据课程难度和目标CGPA计算的建议成绩
              </p>
            </div>

            <div className="divide-y divide-gray-200">
              {planResult.suggestions.map((suggestion, index) => (
                <div
                  key={index}
                  className="p-4 flex items-center justify-between"
                >
                  <div>
                    <h4 className="font-medium text-gray-900">
                      {suggestion.courseName}
                    </h4>
                    <p className="text-sm text-gray-500">
                      {suggestion.credits} 学分 · 最低可接受绩点:{' '}
                      {GRADE_POINT_MAP[suggestion.minAcceptableGrade].toFixed(1)}
                    </p>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${getFlexibilityColor(
                        suggestion.flexibility
                      )}`}
                    >
                      {getFlexibilityText(suggestion.flexibility)}
                    </span>
                    <div className="text-center">
                      <p className="text-xs text-gray-500">建议绩点</p>
                      <p className="text-xl font-bold text-primary-600">
                        {suggestion.suggestedGradePoint.toFixed(1)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 场景分析 */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">场景分析</h3>
              <p className="text-sm text-gray-500">不同努力程度下的预期结果</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-gray-200">
              {planResult.scenarios.map((scenario, index) => {
                const isToggleable =
                  scenario.kind === 'maintain' || scenario.kind === 'target';
                const isExpanded =
                  isToggleable && expandedScenario === scenario.kind;

                return (
                  <div key={index} className="p-6 flex flex-col items-center text-center">
                    <h4 className="font-medium text-gray-900">{scenario.name}</h4>
                    <p className="text-sm text-gray-500 mt-1 min-h-[40px]">
                      {scenario.description}
                    </p>

                    {/* maintain / target：突出显示「需要平均绩点」 */}
                    {isToggleable && scenario.requiredAvgGPA !== undefined ? (
                      <>
                        <p
                          className={`text-3xl font-bold mt-4 ${
                            !scenario.isAchievable
                              ? 'text-red-500'
                              : scenario.requiredAvgGPA > 3.7
                              ? 'text-orange-500'
                              : scenario.requiredAvgGPA > 3.0
                              ? 'text-amber-500'
                              : 'text-emerald-600'
                          }`}
                        >
                          {scenario.isAchievable
                            ? scenario.requiredAvgGPA.toFixed(2)
                            : '—'}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {scenario.isAchievable
                            ? '本学期新课需平均绩点'
                            : '即使全 A 也无法达成'}
                        </p>

                        {scenario.isAchievable && (
                          <p className="text-[11px] text-gray-400 mt-2">
                            预期 CGPA{' '}
                            <span className="font-medium text-gray-600">
                              {scenario.resultingCGPA.toFixed(2)}
                            </span>
                          </p>
                        )}

                        <button
                          onClick={() =>
                            setExpandedScenario((prev) =>
                              prev === scenario.kind
                                ? null
                                : (scenario.kind as 'maintain' | 'target')
                            )
                          }
                          className="mt-4 px-3 py-1.5 text-xs font-medium text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors"
                        >
                          {isExpanded ? '收起建议分配' : '查看建议分配'}
                        </button>
                      </>
                    ) : (
                      <>
                        <p className="text-3xl font-bold text-primary-600 mt-4">
                          {scenario.resultingCGPA.toFixed(2)}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">预期 CGPA</p>
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            {/* 展开的建议分配面板 */}
            {expandedScenario &&
              (() => {
                const scn = planResult.scenarios.find(
                  (s) => s.kind === expandedScenario
                );
                if (!scn) return null;

                return (
                  <div className="border-t border-gray-200 bg-gray-50/40 p-6">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900">
                          {scn.name} · 建议成绩分配
                        </h4>
                        <p className="text-[12px] text-gray-500 mt-0.5">
                          {scn.isAchievable === false
                            ? '该场景下即使全 A 也无法达成，以下为最大化分配示例'
                            : `按课程难度分摊到平均 ${scn.requiredAvgGPA?.toFixed(2)} 的一种分配方式`}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setExpandedScenario(null)}
                        aria-label="关闭建议分配"
                        title="关闭建议分配"
                        className="text-xs text-gray-400 hover:text-gray-600"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {futureCourses.map((course) => {
                        const grade = scn.gradeDistribution[course.courseName];
                        if (!grade) return null;
                        return (
                          <div
                            key={course.id}
                            className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-3 py-2"
                          >
                            <div className="min-w-0 flex-1 mr-3">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {course.courseName}
                              </p>
                              <p className="text-[11px] text-gray-400">
                                {course.credits} 学分
                                {course.isRetake && ' · 重修'}
                              </p>
                            </div>
                            <span className="text-base font-bold text-primary-600 px-2 py-0.5 bg-primary-50 rounded">
                              {GRADE_POINT_MAP[grade].toFixed(1)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
          </div>
        </>
      )}
    </div>
  );
}
