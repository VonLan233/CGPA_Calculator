import { useGradeStore } from '../../store/useGradeStore';

export function CGPADisplay() {
  const { cgpaResult } = useGradeStore();

  if (!cgpaResult || cgpaResult.courseCount === 0) {
    return (
      <div className="rounded-2xl bg-gray-50 border border-gray-200 p-8 text-center">
        <p className="text-gray-400 text-sm">暂无成绩数据</p>
      </div>
    );
  }

  const getCGPAColor = (cgpa: number) => {
    if (cgpa >= 3.7) return 'from-emerald-500 to-green-600';
    if (cgpa >= 3.0) return 'from-blue-500 to-indigo-600';
    if (cgpa >= 2.0) return 'from-amber-500 to-orange-600';
    return 'from-red-500 to-rose-600';
  };

  return (
    <div className={`rounded-2xl bg-gradient-to-br ${getCGPAColor(cgpaResult.cgpa)} p-6 text-white shadow-lg`}>
      <div className="text-center">
        <p className="text-white/70 text-sm font-medium mb-1">CGPA</p>
        <p className="text-5xl font-extrabold tracking-tight">
          {cgpaResult.cgpa.toFixed(2)}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3 mt-5">
        {[
          { value: cgpaResult.courseCount, label: '课程' },
          { value: cgpaResult.totalCredits, label: '学分' },
          { value: cgpaResult.totalGradePoints.toFixed(1), label: '绩点' },
        ].map((item) => (
          <div key={item.label} className="bg-white/15 rounded-xl p-2.5 text-center backdrop-blur-sm">
            <p className="text-xl font-bold">{item.value}</p>
            <p className="text-[11px] text-white/70">{item.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
