import { useState, useMemo, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useGradeStore } from '../../../store/useGradeStore';
import type { Grade, LetterGrade, RetakeRecommendation } from '../../../types/grade';
import { GRADE_POINT_MAP, ALL_GRADES } from '../../../types/grade';

interface ScrapedCourse {
  courseCode: string;
  courseName: string;
  credits: number;
  letterGrade: LetterGrade;
  gradePoint: number;
  semester?: string;
  isRetake?: boolean;
}

interface SemesterOption {
  value: string;
  label: string;
}

const DEFAULT_SEMESTERS: SemesterOption[] = [
  { value: 'all', label: '全部学期' },
  { value: '202509', label: '2025/09' },
  { value: '202504', label: '2025/04' },
  { value: '202502', label: '2025/02' },
  { value: '202409', label: '2024/09' },
  { value: '202404', label: '2024/04' },
  { value: '202402', label: '2024/02' },
  { value: '202309', label: '2023/09' },
];

export function WebImport() {
  const { addGrades } = useGradeStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [semesterId, setSemesterId] = useState('all');
  const [availableSemesters, setAvailableSemesters] = useState<SemesterOption[]>(DEFAULT_SEMESTERS);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scrapedCourses, setScrapedCourses] = useState<ScrapedCourse[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);

  // Retake planning state
  const [targetCGPA, setTargetCGPA] = useState(3.5);
  const [recommendations, setRecommendations] = useState<RetakeRecommendation[]>([]);
  const [isRetakeLoading, setIsRetakeLoading] = useState(false);
  const [retakeAchievable, setRetakeAchievable] = useState(true);

  const isAllSemesters = semesterId === 'all';

  const previewStats = useMemo(() => {
    if (scrapedCourses.length === 0) return null;
    const totalCredits = scrapedCourses.reduce((sum, c) => sum + c.credits, 0);
    const totalWeighted = scrapedCourses.reduce((sum, c) => sum + c.credits * c.gradePoint, 0);
    const gpa = totalCredits > 0 ? totalWeighted / totalCredits : 0;
    return { gpa, totalCredits, totalWeighted };
  }, [scrapedCourses]);

  // Fetch retake recommendations when scraped courses change
  useEffect(() => {
    if (scrapedCourses.length === 0) {
      setRecommendations([]);
      return;
    }
    const grades: Grade[] = scrapedCourses.map((c, i) => ({
      id: `temp-${i}`,
      courseName: c.courseName,
      courseCode: c.courseCode,
      credits: c.credits,
      letterGrade: c.letterGrade,
      gradePoint: c.gradePoint,
      semester: c.semester,
    }));
    fetchRetake(grades);
  }, [scrapedCourses, targetCGPA]);

  const fetchRetake = async (grades: Grade[]) => {
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

  const handleScrape = async () => {
    if (!username.trim()) { setError('请输入学号'); return; }
    if (!password.trim()) { setError('请输入密码'); return; }

    setIsLoading(true);
    setError(null);
    setScrapedCourses([]);
    setWarnings([]);

    try {
      const response = await fetch('http://localhost:3001/api/v1/scrape/grades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password: password.trim(), semesterId }),
      });
      const result = await response.json();
      if (result.success) {
        setScrapedCourses(result.data.courses);
        setWarnings(result.data.warnings || []);
        if (result.data.semesters?.length > 0) {
          setAvailableSemesters([{ value: 'all', label: '全部学期' }, ...result.data.semesters]);
        }
      } else {
        setError(result.error || '抓取失败');
      }
    } catch {
      setError('无法连接到后端服务，请确保服务已启动');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGradeChange = (index: number, newGrade: LetterGrade) => {
    setScrapedCourses((prev) =>
      prev.map((c, i) => i === index ? { ...c, letterGrade: newGrade, gradePoint: GRADE_POINT_MAP[newGrade] } : c)
    );
  };

  const handleConfirm = () => {
    const grades: Grade[] = scrapedCourses.map((c) => ({
      id: uuidv4(),
      courseName: c.courseName,
      courseCode: c.courseCode,
      credits: c.credits,
      letterGrade: c.letterGrade,
      gradePoint: GRADE_POINT_MAP[c.letterGrade],
      semester: c.semester || semesterId,
    }));
    addGrades(grades);
    setScrapedCourses([]);
    setWarnings([]);
  };

  const handleCancel = () => {
    setScrapedCourses([]);
    setWarnings([]);
    setError(null);
    setRecommendations([]);
  };

  const gpaColor = (gpa: number) => {
    if (gpa >= 3.7) return 'from-emerald-500 to-green-600';
    if (gpa >= 3.0) return 'from-blue-500 to-indigo-600';
    if (gpa >= 2.0) return 'from-amber-500 to-orange-600';
    return 'from-red-500 to-rose-600';
  };

  const getGradeStyle = (gp: number) => {
    if (gp >= 3.7) return 'bg-emerald-50 text-emerald-700';
    if (gp >= 3.0) return 'bg-blue-50 text-blue-700';
    if (gp >= 2.0) return 'bg-amber-50 text-amber-700';
    return 'bg-red-50 text-red-700';
  };

  // ─── RESULTS DASHBOARD ───
  if (scrapedCourses.length > 0 && previewStats) {
    const showSemesterCol = scrapedCourses.some((c) => c.semester);

    return (
      <div className="space-y-5">
        {/* Top row: GPA card + Target */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* GPA Card */}
          <div className={`md:col-span-2 rounded-2xl bg-gradient-to-br ${gpaColor(previewStats.gpa)} p-5 text-white shadow-lg`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/60 text-xs font-medium uppercase tracking-wider">
                  {isAllSemesters ? 'CGPA' : 'Semester GPA'}
                </p>
                <p className="text-4xl font-extrabold tracking-tight mt-1">{previewStats.gpa.toFixed(2)}</p>
              </div>
              <div className="text-right space-y-1">
                <div className="bg-white/15 rounded-lg px-3 py-1 backdrop-blur-sm text-sm">
                  {scrapedCourses.length} 门课程
                </div>
                <div className="bg-white/15 rounded-lg px-3 py-1 backdrop-blur-sm text-sm">
                  {previewStats.totalCredits} 学分
                </div>
              </div>
            </div>
            <p className="text-white/40 text-xs mt-3">修改成绩后实时更新 · 重修建议同步刷新</p>
          </div>

          {/* Target CGPA */}
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
            {previewStats.gpa < targetCGPA ? (
              <p className="text-xs text-orange-500 mt-2 font-medium">
                差距 +{(targetCGPA - previewStats.gpa).toFixed(2)}
              </p>
            ) : (
              <p className="text-xs text-emerald-500 mt-2 font-medium">已达成目标</p>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 justify-end">
          <button onClick={handleCancel} className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">
            取消
          </button>
          <button onClick={handleConfirm} className="px-5 py-2 text-sm font-medium text-white bg-primary-600 rounded-xl hover:bg-primary-700 shadow-sm transition-colors">
            确认导入到成绩表
          </button>
        </div>

        {/* Warnings */}
        {warnings.length > 0 && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
            {warnings.map((w, i) => <p key={i} className="text-xs text-amber-700">{w}</p>)}
          </div>
        )}

        {/* Two-column: Grade table + Retake recommendations */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          {/* Grade table — 3/5 */}
          <div className="lg:col-span-3 rounded-2xl bg-white border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900">成绩明细</h3>
              <p className="text-[11px] text-gray-400">点击成绩列可修改等级</p>
            </div>
            <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-50/95 backdrop-blur-sm z-10">
                  <tr>
                    {showSemesterCol && <th className="px-4 py-2 text-left text-[11px] font-medium text-gray-400">学期</th>}
                    <th className="px-4 py-2 text-left text-[11px] font-medium text-gray-400">课程</th>
                    <th className="px-4 py-2 text-center text-[11px] font-medium text-gray-400">学分</th>
                    <th className="px-4 py-2 text-center text-[11px] font-medium text-gray-400">成绩</th>
                    <th className="px-4 py-2 text-center text-[11px] font-medium text-gray-400">绩点</th>
                  </tr>
                </thead>
                <tbody>
                  {scrapedCourses.map((course, index) => (
                    <tr key={index} className="border-t border-gray-50 hover:bg-primary-50/20 transition-colors">
                      {showSemesterCol && (
                        <td className="px-4 py-2 text-[11px] text-gray-400 whitespace-nowrap">{course.semester}</td>
                      )}
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-1.5">
                          <p className="font-medium text-gray-900 text-sm leading-tight">{course.courseName}</p>
                          {course.isRetake && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-50 text-purple-600 flex-shrink-0">
                              重修
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-gray-400 font-mono">{course.courseCode}</p>
                      </td>
                      <td className="px-4 py-2 text-center text-gray-500">{course.credits}</td>
                      <td className="px-4 py-2 text-center">
                        <select
                          value={course.letterGrade}
                          onChange={(e) => handleGradeChange(index, e.target.value as LetterGrade)}
                          className={`px-2 py-0.5 rounded-md text-xs font-semibold border-0 cursor-pointer focus:ring-2 focus:ring-primary-300 ${getGradeStyle(course.gradePoint)}`}
                        >
                          {ALL_GRADES.map((g) => (
                            <option key={g} value={g}>{g}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-2 text-center font-medium text-gray-600">{course.gradePoint.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Retake recommendations — 2/5 */}
          <div className="lg:col-span-2 rounded-2xl bg-white border border-gray-200 shadow-sm overflow-hidden">
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
                    {previewStats.gpa >= targetCGPA ? '已达到目标，无需重修' : '没有可重修的课程'}
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
    );
  }

  // ─── LOGIN FORM ───
  return (
    <div className="max-w-sm mx-auto space-y-4">
      <div className="text-center mb-2">
        <p className="text-sm text-gray-500">
          登录 <span className="font-mono text-primary-600">ac.xmu.edu.my</span> 自动抓取成绩
        </p>
        <p className="text-[11px] text-gray-400 mt-1">账号密码仅用于本次请求，不会被存储</p>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">学号</label>
        <input
          type="text"
          value={username}
          onChange={(e) => { setUsername(e.target.value); setError(null); }}
          placeholder="输入学号"
          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-colors"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">密码</label>
        <input
          type="password"
          value={password}
          onChange={(e) => { setPassword(e.target.value); setError(null); }}
          placeholder="输入密码"
          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-colors"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">学期</label>
        <select
          value={semesterId}
          onChange={(e) => setSemesterId(e.target.value)}
          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-colors"
        >
          {availableSemesters.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {error && (
        <div className="px-3 py-2.5 bg-red-50 border border-red-200 rounded-xl">
          <p className="text-xs text-red-600">{error}</p>
        </div>
      )}

      <button
        onClick={handleScrape}
        disabled={isLoading}
        className="w-full py-2.5 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl font-medium text-sm hover:from-primary-700 hover:to-primary-800 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all"
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            {isAllSemesters ? '抓取所有学期中...' : '登录并抓取...'}
          </span>
        ) : (
          isAllSemesters ? '抓取全部成绩' : '抓取成绩'
        )}
      </button>
    </div>
  );
}
