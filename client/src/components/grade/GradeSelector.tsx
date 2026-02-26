import type { LetterGrade } from '../../types/grade';
import { ALL_GRADES, GRADE_POINT_MAP } from '../../types/grade';

interface Props {
  value: LetterGrade;
  onChange: (grade: LetterGrade) => void;
  className?: string;
}

export function GradeSelector({ value, onChange, className = '' }: Props) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as LetterGrade)}
      className={`w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${className}`}
    >
      {ALL_GRADES.map((grade) => (
        <option key={grade} value={grade}>
          {grade} ({GRADE_POINT_MAP[grade].toFixed(1)})
        </option>
      ))}
    </select>
  );
}
