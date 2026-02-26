import { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useGradeStore } from '../store/useGradeStore';
import { CGPADisplay } from '../components/grade/CGPADisplay';
import type { CoursePlanSuggestion, PlanningScenario } from '../types/grade';

export function FuturePlanningPage() {
  const {
    grades,
    targetCGPA,
    setTargetCGPA,
    futureCourses,
    addFutureCourse,
    removeFutureCourse,
    clearFutureCourses,
  } = useGradeStore();

  const [newCourse, setNewCourse] = useState({
    courseName: '',
    credits: 3,
    difficulty: 'medium' as 'easy' | 'medium' | 'hard',
  });

  const [planResult, setPlanResult] = useState<{
    isAchievable: boolean;
    requiredAverageGPA: number;
    suggestions: CoursePlanSuggestion[];
    scenarios: PlanningScenario[];
  } | null>(null);

  const [_isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (grades.length > 0 && futureCourses.length > 0) {
      fetchPlanSuggestions();
    } else {
      setPlanResult(null);
    }
  }, [grades, targetCGPA, futureCourses]);

  const fetchPlanSuggestions = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('http://localhost:3001/api/v1/planning/future', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentGrades: grades,
          targetCGPA,
          futureCourses,
        }),
      });

      const result = await response.json();
      if (result.success) {
        setPlanResult({
          isAchievable: result.data.isAchievable,
          requiredAverageGPA: result.data.requiredAverageGPA,
          suggestions: result.data.suggestedDistribution,
          scenarios: result.data.scenarios,
        });
      }
    } catch (error) {
      console.error('获取规划建议失败:', error);
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

      {/* 添加未来课程 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">添加未来课程</h3>
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
                <div className="flex items-center space-x-4">
                  <span className="font-medium text-gray-900">
                    {course.courseName}
                  </span>
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
                      {suggestion.credits} 学分 · 最低可接受:{' '}
                      {suggestion.minAcceptableGrade}
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
                      <p className="text-xs text-gray-500">建议</p>
                      <p className="text-xl font-bold text-primary-600">
                        {suggestion.suggestedGrade}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 场景对比 */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">场景分析</h3>
              <p className="text-sm text-gray-500">不同努力程度下的预期结果</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-200">
              {planResult.scenarios.map((scenario, index) => (
                <div key={index} className="p-6 text-center">
                  <h4 className="font-medium text-gray-900">{scenario.name}</h4>
                  <p className="text-sm text-gray-500 mt-1">
                    {scenario.description}
                  </p>
                  <p className="text-3xl font-bold text-primary-600 mt-4">
                    {scenario.resultingCGPA.toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">预期CGPA</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
