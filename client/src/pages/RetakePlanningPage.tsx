import { useState, useEffect } from 'react';
import { useGradeStore } from '../store/useGradeStore';
import { CGPADisplay } from '../components/grade/CGPADisplay';
import type { RetakeRecommendation } from '../types/grade';

export function RetakePlanningPage() {
  const { grades, targetCGPA, setTargetCGPA, cgpaResult } = useGradeStore();
  const [recommendations, setRecommendations] = useState<RetakeRecommendation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAchievable, setIsAchievable] = useState(true);

  useEffect(() => {
    if (grades.length > 0) fetchRecommendations();
  }, [grades, targetCGPA]);

  const fetchRecommendations = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('http://localhost:3001/api/v1/planning/retake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grades, targetCGPA }),
      });
      const result = await response.json();
      if (result.success) {
        setRecommendations(result.data.recommendations);
        setIsAchievable(result.data.isAchievable);
      }
    } catch (error) {
      console.error('获取重修建议失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (grades.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">暂无成绩数据</h2>
        <p className="text-sm text-gray-400">请先在"成绩录入"页面添加成绩</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">重修规划</h1>
        <p className="text-sm text-gray-400 mt-0.5">根据目标 CGPA 智能推荐最值得重修的课程</p>
      </div>

      {/* CGPA + Target */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <CGPADisplay />

        <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">目标设置</p>
          <input
            type="number"
            min="0"
            max="4"
            step="0.1"
            value={targetCGPA}
            onChange={(e) => setTargetCGPA(parseFloat(e.target.value))}
            className="w-full text-4xl font-extrabold text-gray-900 border-0 p-0 focus:ring-0 bg-transparent"
          />
          {cgpaResult && (
            <div className="mt-3 flex items-center gap-2">
              {targetCGPA > cgpaResult.cgpa ? (
                <span className="text-xs font-medium px-2 py-1 rounded-lg bg-orange-50 text-orange-600">
                  差距 +{(targetCGPA - cgpaResult.cgpa).toFixed(2)}
                </span>
              ) : (
                <span className="text-xs font-medium px-2 py-1 rounded-lg bg-emerald-50 text-emerald-600">
                  已达成
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Warning */}
      {!isAchievable && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
          <svg className="w-5 h-5 text-amber-500 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <div>
            <p className="text-sm font-medium text-amber-800">仅靠重修可能无法达到目标</p>
            <p className="text-xs text-amber-600 mt-0.5">建议结合未来课程规划，或适当调低目标</p>
          </div>
        </div>
      )}

      {/* Recommendations */}
      <div className="rounded-2xl bg-white border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-900">推荐重修顺序</h3>
          <p className="text-xs text-gray-400 mt-0.5">按性价比从高到低排列</p>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-gray-400 text-sm">分析中...</div>
        ) : recommendations.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-sm">
            {cgpaResult && targetCGPA <= cgpaResult.cgpa ? '已达到目标，无需重修' : '没有可重修的课程'}
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {recommendations.map((rec, index) => (
              <div key={rec.courseId} className="px-5 py-4 hover:bg-gray-50/50 transition-colors">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-sm">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-gray-900">{rec.courseName}</h4>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {rec.credits} 学分 · 当前 {rec.currentGrade} → 建议达到 {rec.requiredGrade}
                    </p>
                    <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">{rec.reasoning}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <span className="text-lg font-bold text-emerald-600">
                      +{(rec.cgpaImpact * 100).toFixed(1)}%
                    </span>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-medium ${
                      rec.difficultyScore <= 2 ? 'bg-emerald-50 text-emerald-600' :
                      rec.difficultyScore <= 3 ? 'bg-amber-50 text-amber-600' :
                      'bg-red-50 text-red-600'
                    }`}>
                      {rec.difficultyScore <= 2 ? '容易' : rec.difficultyScore <= 3 ? '中等' : '较难'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
