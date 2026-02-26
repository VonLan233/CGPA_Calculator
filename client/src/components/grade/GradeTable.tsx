import { useGradeStore } from '../../store/useGradeStore';
import type { LetterGrade } from '../../types/grade';
import { GRADE_POINT_MAP, ALL_GRADES } from '../../types/grade';

export function GradeTable() {
  const { grades, removeGrade, updateGrade } = useGradeStore();

  if (grades.length === 0) {
    return null;
  }

  const getGradeStyle = (gp: number) => {
    if (gp >= 3.7) return 'bg-emerald-50 text-emerald-700';
    if (gp >= 3.0) return 'bg-blue-50 text-blue-700';
    if (gp >= 2.0) return 'bg-amber-50 text-amber-700';
    return 'bg-red-50 text-red-700';
  };

  const handleGradeChange = (id: string, newGrade: LetterGrade) => {
    updateGrade(id, {
      letterGrade: newGrade,
      gradePoint: GRADE_POINT_MAP[newGrade],
    });
  };

  // Group grades by semester
  const grouped = grades.reduce<Record<string, typeof grades>>((acc, g) => {
    const sem = g.semester || '未分类';
    (acc[sem] ||= []).push(g);
    return acc;
  }, {});

  const semesters = Object.keys(grouped);
  const showSemesterHeaders = semesters.length > 1 || semesters[0] !== '未分类';

  return (
    <div className="rounded-2xl bg-white border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-gray-900">成绩列表</h3>
          <p className="text-xs text-gray-400 mt-0.5">{grades.length} 门课程 · 点击成绩可修改</p>
        </div>
      </div>

      <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-gray-50/95 backdrop-blur-sm z-10">
            <tr>
              <th className="px-5 py-2.5 text-left text-xs font-medium text-gray-500">课程</th>
              <th className="px-5 py-2.5 text-center text-xs font-medium text-gray-500">学分</th>
              <th className="px-5 py-2.5 text-center text-xs font-medium text-gray-500">成绩</th>
              <th className="px-5 py-2.5 text-center text-xs font-medium text-gray-500">绩点</th>
              <th className="px-5 py-2.5 w-12"></th>
            </tr>
          </thead>
          <tbody>
            {semesters.map((sem) => (
              <>{/* Fragment with key on the semester header row */}
                {showSemesterHeaders && (
                  <tr key={`sem-${sem}`}>
                    <td colSpan={5} className="px-5 py-2 bg-slate-50 border-y border-gray-100">
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{sem}</span>
                    </td>
                  </tr>
                )}
                {grouped[sem].map((grade) => (
                  <tr key={grade.id} className="group hover:bg-primary-50/30 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1.5">
                        <p className="font-medium text-gray-900 text-sm leading-tight">{grade.courseName}</p>
                        {grade.isRetake && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-50 text-purple-600 flex-shrink-0">
                            重修
                          </span>
                        )}
                      </div>
                      {grade.courseCode && (
                        <p className="text-[11px] text-gray-400 font-mono mt-0.5">{grade.courseCode}</p>
                      )}
                    </td>
                    <td className="px-5 py-3 text-center text-gray-600">{grade.credits}</td>
                    <td className="px-5 py-3 text-center">
                      <select
                        value={grade.letterGrade}
                        onChange={(e) => handleGradeChange(grade.id, e.target.value as LetterGrade)}
                        className={`px-2 py-0.5 rounded-md text-xs font-semibold border-0 cursor-pointer focus:ring-2 focus:ring-primary-300 ${getGradeStyle(grade.gradePoint)}`}
                      >
                        {ALL_GRADES.map((g) => (
                          <option key={g} value={g}>{g}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-5 py-3 text-center font-medium text-gray-700">{grade.gradePoint.toFixed(1)}</td>
                    <td className="px-5 py-3 text-center">
                      <button
                        onClick={() => removeGrade(grade.id)}
                        className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
