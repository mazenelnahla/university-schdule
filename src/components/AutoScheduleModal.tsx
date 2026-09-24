import { useState, useMemo, useEffect, type FC } from 'react';
import { createPortal } from 'react-dom';
import {
  Sparkles,
  X,
  Calendar,
  CheckCircle,
  AlertCircle,
  Loader2,
  Clock,
  GraduationCap,
  ShieldCheck,
  Check,
  Zap,
} from 'lucide-react';
import type { AcademicYear, Course } from '../db/schema';
import {
  autoGenerateTimetableBySemester,
  type AutoScheduleResult,
} from '../db/autoScheduleService';

export interface AutoScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  years: AcademicYear[];
  courses: Course[];
  initialYearId?: number | 'ALL';
  onSuccess: () => void;
}

export const AutoScheduleModal: FC<AutoScheduleModalProps> = ({
  isOpen,
  onClose,
  years,
  courses,
  initialYearId = 'ALL',
  onSuccess,
}) => {
  const [selectedSemester, setSelectedSemester] = useState<1 | 2>(1);
  const [selectedScope, setSelectedScope] = useState<number | 'ALL'>(initialYearId);
  const [clearExisting, setClearExisting] = useState<boolean>(true);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generationResult, setGenerationResult] = useState<AutoScheduleResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isGenerating) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isGenerating, onClose]);

  // Preview courses matching this semester
  const matchingCourses = useMemo(() => {
    return courses.filter((c) => {
      const semMatch = c.semester === selectedSemester || !c.semester;
      if (!semMatch) return false;
      if (selectedScope !== 'ALL' && c.yearId !== selectedScope) return false;
      return true;
    });
  }, [courses, selectedSemester, selectedScope]);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    setIsGenerating(true);
    setErrorMessage(null);
    setGenerationResult(null);

    try {
      const result = await autoGenerateTimetableBySemester({
        semester: selectedSemester,
        academicYearId: selectedScope,
        clearExisting,
      });

      setGenerationResult(result);
      onSuccess();
    } catch (err) {
      console.error('Auto-scheduling error:', err);
      setErrorMessage((err as Error).message || 'Failed to auto-generate timetables');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleResetAndClose = () => {
    setGenerationResult(null);
    setErrorMessage(null);
    onClose();
  };

  return createPortal(
    <div className="modal-overlay auto-schedule-overlay" onClick={handleResetAndClose}>
      <div
        className="modal-card auto-schedule-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auto-schedule-title"
      >
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title-wrap">
            <div className="modal-title-icon highlight-glow">
              <Sparkles size={22} className="text-amber-400" />
            </div>
            <div>
              <h2 id="auto-schedule-title" className="modal-title">
                Auto-Generate Timetables
              </h2>
              <p className="modal-subtitle">
                AI Constraint-Satisfaction Engine • Intelligent Conflict-Free Scheduling by Semester
              </p>
            </div>
          </div>
          <button
            onClick={handleResetAndClose}
            className="modal-close-btn"
            disabled={isGenerating}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="modal-body auto-schedule-body">
          {generationResult ? (
            /* SUCCESS STATE */
            <div className="auto-gen-success-card">
              <div className={`success-icon-badge ${generationResult.conflicts.length > 0 ? 'conflict-icon-badge' : ''}`}>
              {generationResult.conflicts.length > 0
                ? <AlertCircle size={44} className="text-amber-400" />
                : <CheckCircle size={44} className="text-emerald-400" />}
              </div>
              <h3 className="success-title">
                {generationResult.conflicts.length > 0 ? 'Timetable Generated With Conflicts' : 'Timetable Generated Successfully!'}
              </h3>
              <p className="success-desc">
                {generationResult.message}
              </p>

              <div className="success-stats-grid">
                <div className="stat-pill">
                  <span className="stat-label">Semester:</span>
                  <span className="stat-val highlight">{generationResult.semesterLabel}</span>
                </div>
                <div className="stat-pill">
                  <span className="stat-label">Total Sessions:</span>
                  <span className="stat-val font-bold">{generationResult.totalSessions}</span>
                </div>
                <div className="stat-pill">
                  <span className="stat-label">Lectures:</span>
                  <span className="stat-val">{generationResult.lectureCount}</span>
                </div>
                <div className="stat-pill">
                  <span className="stat-label">Sections & Labs:</span>
                  <span className="stat-val">{generationResult.sectionCount}</span>
                </div>
                <div className="stat-pill">
                  <span className="stat-label">Levels Scheduled:</span>
                  <span className="stat-val">{generationResult.yearsScheduled}</span>
                </div>
                <div className="stat-pill">
                  <span className="stat-label">Conflicts:</span>
                  <span className={`stat-val font-bold ${generationResult.conflicts.length > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {generationResult.conflicts.length > 0 ? generationResult.conflicts.length : '0 (Clean)'}
                  </span>
                </div>
              </div>

              {generationResult.conflicts.length > 0 && (
                <div className="alert-banner alert-warning auto-generation-conflicts">
                  <AlertCircle size={18} />
                  <div>
                    <strong>Placement conflicts detected</strong>
                    <ul>
                      {generationResult.conflicts.map((conflict) => <li key={conflict}>{conflict}</li>)}
                    </ul>
                  </div>
                </div>
              )}

              <div className="success-action-bar">
                <button
                  type="button"
                  className="action-btn primary-btn w-full"
                  onClick={handleResetAndClose}
                  style={{ justifyContent: 'center', padding: '0.75rem 1.5rem', fontSize: '1rem' }}
                >
                  <Calendar size={18} />
                  <span>View Updated Timetable Calendar</span>
                </button>
              </div>
            </div>
          ) : (
            /* CONFIGURATION FORM */
            <div className="auto-gen-form-content">
              {errorMessage && (
                <div className="error-alert">
                  <AlertCircle size={18} />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Step 1: Semester Selection Cards */}
              <div className="form-section">
                <label className="section-step-label">
                  <span className="step-num">1</span>
                  <span>Select Target Semester</span>
                </label>
                <div className="semester-cards-grid">
                  <button
                    type="button"
                    className={`semester-card ${selectedSemester === 1 ? 'selected' : ''}`}
                    onClick={() => setSelectedSemester(1)}
                    disabled={isGenerating}
                  >
                    <div className="semester-card-header">
                      <div className="semester-tag">Semester 1 (Fall)</div>
                      {selectedSemester === 1 && (
                        <div className="check-indicator">
                          <Check size={14} />
                        </div>
                      )}
                    </div>
                    <div className="semester-card-title">Fall Semester 2026</div>
                    <div className="semester-card-desc">
                      Level 0 to Level 4 autumn curriculum (Mathematics I, Physics I, Programming, Database Systems, Machine Learning, Graduation Project I)
                    </div>
                    <div className="semester-card-badge">
                      <Zap size={12} className="text-amber-400" />
                      <span>Standard Autumn Term</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    className={`semester-card ${selectedSemester === 2 ? 'selected' : ''}`}
                    onClick={() => setSelectedSemester(2)}
                    disabled={isGenerating}
                  >
                    <div className="semester-card-header">
                      <div className="semester-tag">Semester 2 (Spring)</div>
                      {selectedSemester === 2 && (
                        <div className="check-indicator">
                          <Check size={14} />
                        </div>
                      )}
                    </div>
                    <div className="semester-card-title">Spring Semester 2027</div>
                    <div className="semester-card-desc">
                      Level 0 to Level 4 spring curriculum (Mathematics II, Physics II, OOP, Software Engineering, NLP, Deep Learning, Graduation Project II)
                    </div>
                    <div className="semester-card-badge">
                      <Zap size={12} className="text-sky-400" />
                      <span>Standard Spring Term</span>
                    </div>
                  </button>
                </div>
              </div>

              {/* Step 2: Academic Year Scope */}
              <div className="form-section">
                <label className="section-step-label" htmlFor="auto-scope-select">
                  <span className="step-num">2</span>
                  <span>Select Target Academic Level / Cohort</span>
                </label>
                <select
                  id="auto-scope-select"
                  className="form-select w-full"
                  value={selectedScope}
                  onChange={(e) =>
                    setSelectedScope(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))
                  }
                  disabled={isGenerating}
                >
                  <option value="ALL">
                    All Academic Years (Preparatory Year + Level 1 to 4) • Complete Campus Schedule
                  </option>
                  {years.map((y) => (
                    <option key={y.id} value={y.id}>
                      {y.name} ({y.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Step 3: Replacement Mode */}
              <div className="form-section">
                <label className="section-step-label">
                  <span className="step-num">3</span>
                  <span>Schedule Options</span>
                </label>
                <div className="option-toggle-box">
                  <label className="toggle-label-row">
                    <input
                      type="checkbox"
                      checked={clearExisting}
                      onChange={(e) => setClearExisting(e.target.checked)}
                      disabled={isGenerating}
                      className="custom-checkbox"
                    />
                    <div className="toggle-text-block">
                      <span className="toggle-title">Clear &amp; replace existing schedule for selected scope</span>
                      <span className="toggle-desc">
                        Recommended to guarantee a completely balanced, zero-conflict timetable for the selected semester.
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Preview Banner */}
              <div className="scope-preview-banner">
                <div className="preview-meta-item">
                  <Clock size={15} className="text-secondary" />
                  <span>
                    <strong>Schedule Days:</strong> Sunday – Thursday (5 Working Days)
                  </span>
                </div>
                <div className="preview-meta-item">
                  <GraduationCap size={15} className="text-secondary" />
                  <span>
                    <strong>Active Courses in Scope:</strong> {matchingCourses.length} Subjects
                  </span>
                </div>
                <div className="preview-meta-item">
                  <ShieldCheck size={15} className="text-emerald-400" />
                  <span>
                    <strong>Constraints:</strong> Room Capacity, Faculty Attendance, GPA Prerequisites, Alternating Groups
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        {!generationResult && (
          <div className="modal-footer auto-schedule-footer">
            <button
              type="button"
              className="action-btn secondary-btn"
              onClick={handleResetAndClose}
              disabled={isGenerating}
            >
              Cancel
            </button>
            <button
              type="button"
              className="action-btn primary-btn highlight-glow auto-gen-submit-btn"
              onClick={handleGenerate}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Solving Constraints &amp; Generating...</span>
                </>
              ) : (
                <>
                  <Sparkles size={16} className="text-amber-400" />
                  <span>Auto-Generate Timetable</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
