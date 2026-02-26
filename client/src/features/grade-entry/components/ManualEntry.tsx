import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useGradeStore } from '../../../store/useGradeStore';
import { GradeSelector } from '../../../components/grade/GradeSelector';
import type { LetterGrade } from '../../../types/grade';
import { GRADE_POINT_MAP } from '../../../types/grade';

interface FormData {
  courseName: string;
  courseCode: string;
  credits: number;
  letterGrade: LetterGrade;
  semester: string;
}

const initialFormData: FormData = {
  courseName: '',
  courseCode: '',
  credits: 3,
  letterGrade: 'A',
  semester: '',
};

export function ManualEntry() {
  const { addGrade } = useGradeStore();
  const [formData, setFormData] = useState<FormData>(initialFormData);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.courseName.trim()) {
      alert('请输入课程名称');
      return;
    }

    addGrade({
      id: uuidv4(),
      courseName: formData.courseName.trim(),
      courseCode: formData.courseCode.trim() || undefined,
      credits: formData.credits,
      letterGrade: formData.letterGrade,
      gradePoint: GRADE_POINT_MAP[formData.letterGrade],
      semester: formData.semester.trim() || undefined,
    });

    setFormData(initialFormData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            课程名称 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.courseName}
            onChange={(e) =>
              setFormData({ ...formData, courseName: e.target.value })
            }
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            placeholder="如：微积分"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            课程代码
          </label>
          <input
            type="text"
            value={formData.courseCode}
            onChange={(e) =>
              setFormData({ ...formData, courseCode: e.target.value })
            }
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            placeholder="如：MATH101"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            学分 <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            min="0.5"
            max="10"
            step="0.5"
            value={formData.credits}
            onChange={(e) =>
              setFormData({ ...formData, credits: parseFloat(e.target.value) })
            }
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            成绩等级 <span className="text-red-500">*</span>
          </label>
          <GradeSelector
            value={formData.letterGrade}
            onChange={(grade) => setFormData({ ...formData, letterGrade: grade })}
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            学期
          </label>
          <input
            type="text"
            value={formData.semester}
            onChange={(e) =>
              setFormData({ ...formData, semester: e.target.value })
            }
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            placeholder="如：2024年秋季"
          />
        </div>
      </div>

      <button
        type="submit"
        className="w-full bg-primary-600 text-white py-2.5 rounded-lg font-medium hover:bg-primary-700 transition-colors"
      >
        添加课程
      </button>
    </form>
  );
}
