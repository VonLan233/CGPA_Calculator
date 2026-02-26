import { useState, useEffect } from 'react';
import { ManualEntry } from '../features/grade-entry/components/ManualEntry';
import { ImageUpload } from '../features/grade-entry/components/ImageUpload';
import { WebImport } from '../features/grade-entry/components/WebImport';
import { GradeTable } from '../components/grade/GradeTable';
import { CGPADisplay } from '../components/grade/CGPADisplay';
import { useGradeStore } from '../store/useGradeStore';
import type { RetakeRecommendation } from '../types/grade';

type EntryMode = 'web' | 'manual' | 'image';

const tabs: { key: EntryMode; label: string; icon: string }[] = [
  { key: 'web', label: '网页导入', icon: 'M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418' },
  { key: 'manual', label: '手动输入', icon: 'M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10' },
  { key: 'image', label: '图片识别', icon: 'M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z' },
];

export function GradeEntryPage() {
  const [entryMode, setEntryMode] = useState<EntryMode>('web');
  const { clearAllGrades, grades, targetCGPA, setTargetCGPA, cgpaResult } = useGradeStore();

  // Retake recommendation state
  const [recommendations, setRecommendations] = useState<RetakeRecommendation[]>([]);
  const [isRetakeLoading, setIsRetakeLoading] = useState(false);
  const [retakeAchievable, setRetakeAchievable] = useState(true);

  // Fetch retake recommendations whenever grades or target changes
  useEffect(() => {
    if (grades.length === 0) {
      setRecommendations([]);
      return;
    }
    const timer = setTimeout(() => {
      fetchRetake();
    }, 300);
    return () => clearTimeout(timer);
  }, [grades, targetCGPA]);

  const fetchRetake = async () => {
    setIsRetakeLoading(true);
    try {
      const res = await fetch('http://localhost:3001/api/v1/planning/retake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grades, targetCGPA }),
      });
      const data = await res.json();
      if (data.success) {
        setRecommendations(data.data.recommendations);
        setRetakeAchievable(data.data.isAchievable);
      }
    } catch { /* ignore */ }
    finally { setIsRetakeLoading(false); }
  };

  return (
    <div className="space-y-6">
      {/* Top bar */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">成绩录入</h1>
          <p className="text-sm text-gray-400 mt-0.5">导入或手动添加课程成绩</p>
        </div>
        {grades.length > 0 && (
          <button
            onClick={() => { if (confirm('确定要清空所有成绩吗？')) clearAllGrades(); }}
            className="text-xs font-medium text-red-500 hover:text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
          >
            清空全部
          </button>
        )}
      </div>

      {/* CGPA card */}
      <CGPADisplay />

      {/* Entry card */}
      <div className="rounded-2xl bg-white border border-gray-200 shadow-sm overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-gray-100">
          {tabs.map((tab) => {
            const active = entryMode === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setEntryMode(tab.key)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium transition-all border-b-2 -mb-[1px]
                  ${active
                    ? 'border-primary-500 text-primary-700 bg-primary-50/40'
                    : 'border-transparent text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                  }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={tab.icon} />
                </svg>
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="p-5">
          {entryMode === 'web' && <WebImport />}
          {entryMode === 'manual' && <ManualEntry />}
          {entryMode === 'image' && <ImageUpload />}
        </div>
      </div>

      {/* Grade list + Retake recommendations (side by side when grades exist) */}
      {grades.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          {/* Grade table — 3/5 */}
          <div className="lg:col-span-3">
            <GradeTable />
          </div>

          {/* Retake recommendations — 2/5 */}
          <div className="lg:col-span-2 space-y-4">
            {/* Target CGPA input */}
            <div className="rounded-2xl bg-white border border-gray-200 p-5 shadow-sm">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">目标 CGPA</p>
              <input
                type="number"
                min="0"
                max="4"
                step="0.1"
                value={targetCGPA}
                onChange={(e) => setTargetCGPA(parseFloat(e.target.value) || 0)}
                className="w-full text-3xl font-extrabold text-gray-900 border-0 p-0 focus:ring-0 bg-transparent"
              />
              {cgpaResult && cgpaResult.courseCount > 0 && (
                <div className="mt-2">
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

            {/* Retake recommendations list */}
            <div className="rounded-2xl bg-white border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-900">重修建议</h3>
                <p className="text-[11px] text-gray-400">按性价比排序，修改成绩后自动更新</p>
              </div>

              {!retakeAchievable && (
                <div className="mx-4 mt-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-[11px] text-amber-700 font-medium">仅靠重修可能无法达到目标 CGPA</p>
                </div>
              )}

              <div className="overflow-y-auto max-h-[480px]">
                {isRetakeLoading ? (
                  <div className="p-8 text-center text-gray-400 text-sm">分析中...</div>
                ) : recommendations.length === 0 ? (
                  <div className="p-8 text-center">
                    <p className="text-gray-400 text-sm">
                      {cgpaResult && targetCGPA <= cgpaResult.cgpa ? '已达到目标，无需重修' : '没有可重修的课程'}
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {recommendations.map((rec, i) => (
                      <div key={rec.courseId} className="px-4 py-3 hover:bg-gray-50/50 transition-colors">
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-bold mt-0.5">
                            {i + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 leading-tight">{rec.courseName}</p>
                            <p className="text-[11px] text-gray-400 mt-0.5">
                              {rec.credits} 学分 · {rec.currentGrade} → {rec.requiredGrade}
                            </p>
                            <div className="flex items-center gap-2 mt-1.5">
                              <span className="text-xs font-semibold text-emerald-600">
                                +{(rec.cgpaImpact * 100).toFixed(1)}%
                              </span>
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                rec.difficultyScore <= 2 ? 'bg-emerald-50 text-emerald-600' :
                                rec.difficultyScore <= 3 ? 'bg-amber-50 text-amber-600' :
                                'bg-red-50 text-red-600'
                              }`}>
                                {rec.difficultyScore <= 2 ? '容易' : rec.difficultyScore <= 3 ? '中等' : '较难'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
