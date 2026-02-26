import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { v4 as uuidv4 } from 'uuid';
import { useGradeStore } from '../../../store/useGradeStore';
import type { Grade, LetterGrade } from '../../../types/grade';
import { GRADE_POINT_MAP } from '../../../types/grade';

interface RecognizedGrade {
  courseName: string;
  courseCode?: string;
  credits: number;
  letterGrade: LetterGrade;
  confidence: number;
}

export function ImageUpload() {
  const { addGrades } = useGradeStore();
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [recognizedGrades, setRecognizedGrades] = useState<RecognizedGrade[]>([]);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    // 显示预览
    const reader = new FileReader();
    reader.onload = () => setPreviewImage(reader.result as string);
    reader.readAsDataURL(file);

    // 开始OCR识别
    setIsProcessing(true);
    setProgress(0);

    try {
      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch('http://localhost:3001/api/v1/ocr/image', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (result.success && result.data.grades) {
        setRecognizedGrades(result.data.grades);
      } else {
        alert('识别失败：' + (result.error || '未知错误'));
      }
    } catch (error) {
      console.error('OCR识别失败:', error);
      alert('OCR服务连接失败，请确保后端服务已启动');
    } finally {
      setIsProcessing(false);
      setProgress(100);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp'] },
    maxFiles: 1,
  });

  const handleConfirm = () => {
    const grades: Grade[] = recognizedGrades.map((g) => ({
      id: uuidv4(),
      courseName: g.courseName,
      courseCode: g.courseCode,
      credits: g.credits,
      letterGrade: g.letterGrade,
      gradePoint: GRADE_POINT_MAP[g.letterGrade],
    }));

    addGrades(grades);
    setRecognizedGrades([]);
    setPreviewImage(null);
  };

  const handleCancel = () => {
    setRecognizedGrades([]);
    setPreviewImage(null);
  };

  return (
    <div className="space-y-4">
      {/* 上传区域 */}
      {recognizedGrades.length === 0 && (
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors
            ${isDragActive
              ? 'border-primary-500 bg-primary-50'
              : 'border-gray-300 hover:border-primary-400'
            }`}
        >
          <input {...getInputProps()} />
          <div className="text-gray-600">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              stroke="currentColor"
              fill="none"
              viewBox="0 0 48 48"
            >
              <path
                d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <p className="mt-2 text-sm">拖拽成绩单图片到此处</p>
            <p className="mt-1 text-xs text-gray-500">
              或点击选择文件（支持 PNG、JPG、JPEG）
            </p>
          </div>
        </div>
      )}

      {/* 处理进度 */}
      {isProcessing && (
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">正在识别成绩单...</span>
            <span className="text-sm font-medium text-primary-600">{progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-primary-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* 识别结果预览 */}
      {recognizedGrades.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">识别结果</h3>
              <p className="text-sm text-gray-500">
                共识别到 {recognizedGrades.length} 门课程，请确认后添加
              </p>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={handleCancel}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleConfirm}
                className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700"
              >
                确认添加
              </button>
            </div>
          </div>

          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            {previewImage && (
              <div className="rounded-lg overflow-hidden border border-gray-200">
                <img
                  src={previewImage}
                  alt="成绩单预览"
                  className="w-full h-auto"
                />
              </div>
            )}
            <div className="space-y-2">
              {recognizedGrades.map((grade, index) => (
                <div
                  key={index}
                  className="bg-gray-50 rounded-lg p-3 flex justify-between items-center"
                >
                  <div>
                    <p className="font-medium text-gray-900">{grade.courseName}</p>
                    <p className="text-sm text-gray-500">
                      {grade.credits} 学分
                    </p>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                    {grade.letterGrade}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
