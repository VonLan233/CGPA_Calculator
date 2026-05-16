import type { LetterGrade } from '../../types/grade';
import { ALL_GRADE_POINTS, GRADE_POINT_MAP, gradePointToLetterGrade } from '../../types/grade';

interface Props {
  value: LetterGrade;
  onChange: (grade: LetterGrade) => void;
  className?: string;
}

export function GradeSelector({ value, onChange, className = '' }: Props) {
  return (
    <select
      value={GRADE_POINT_MAP[value]}
      onChange={(e) => onChange(gradePointToLetterGrade(parseFloat(e.target.value)))}
      className={`w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${className}`}
    >
      {ALL_GRADE_POINTS.map((gp) => (
        <option key={gp} value={gp}>
          {gp.toFixed(1)}
        </option>
      ))}
    </select>
  );
}
