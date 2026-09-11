import { useState, useMemo, type FC } from 'react';
import {
  Printer,
  X,
  Layers,
  LayoutGrid,
  FileSpreadsheet,
  Info,
} from 'lucide-react';
import type {
  AcademicYear,
  Program,
  Section,
  Professor,
  Room,
  Course,
  StandardPeriod,
  ScheduleWithDetails,
} from '../../db/schema';
import { PrintTimetableSheet } from './PrintTimetableSheet';
import './PrintTimetable.css';

export interface PrintTimetableModalProps {
  isOpen: boolean;
  onClose: () => void;
  years: AcademicYear[];
  programs: Program[];
  sections: Section[];
  professors: Professor[];
  rooms: Room[];
  courses: Course[];
  standardPeriods: StandardPeriod[];
  schedules: ScheduleWithDetails[];
  initialYearId?: number | 'ALL';
}

const WEEK_DAYS = [
  { id: 0, name: 'Sunday', short: 'SUN' },
  { id: 1, name: 'Monday', short: 'MON' },
  { id: 2, name: 'Tuesday', short: 'TUE' },
  { id: 3, name: 'Wednesday', short: 'WED' },
  { id: 4, name: 'Thursday', short: 'THU' },
];

export const PrintTimetableModal: FC<PrintTimetableModalProps> = ({
  isOpen,
  onClose,
  years,
  programs,
  sections,
  professors: _professors,
  rooms: _rooms,
  courses,
  standardPeriods,
  schedules,
  initialYearId = 1,
}) => {
  const [selectedYearId, setSelectedYearId] = useState<number>(() => {
    if (typeof initialYearId === 'number') return initialYearId;
    return years[0]?.id || 1;
  });

  const [selectedProgramId, setSelectedProgramId] = useState<number | 'ALL'>('ALL');
  const [includeSaturday, setIncludeSaturday] = useState<boolean>(false);
  const [printLayout, setPrintLayout] = useState<'MASTER_GRID' | 'PROGRAM_SHEETS' | 'SECTION_ROWS'>('PROGRAM_SHEETS');
  const [density, setDensity] = useState<'STANDARD' | 'COMPACT'>('STANDARD');

  // Active days (Sun-Thu, or Sat-Thu)
  const activeDays = useMemo(() => {
    if (includeSaturday) {
      return [{ id: 6, name: 'Saturday', short: 'SAT' }, ...WEEK_DAYS];
    }
    return WEEK_DAYS;
  }, [includeSaturday]);

  const activeYear = useMemo(() => {
    return years.find((y) => y.id === selectedYearId) || years[0];
  }, [years, selectedYearId]);

  const selectedProgramObj = useMemo(() => {
    if (selectedProgramId === 'ALL') return null;
    return programs.find((p) => p.id === selectedProgramId) || null;
  }, [programs, selectedProgramId]);

  // Sections for the selected year (filtered by program if selected)
  const relevantSections = useMemo(() => {
    const yearSecs = sections.filter((s) => s.yearId === selectedYearId);
    if (selectedProgramId === 'ALL') return yearSecs;
    return yearSecs.filter((s) => s.programId === selectedProgramId);
  }, [sections, selectedYearId, selectedProgramId]);

  // Schedules matching selected year and program filter
  const relevantSchedules = useMemo(() => {
    return schedules.filter((s) => {
      if (s.academicYearId !== selectedYearId) return false;
      // Lectures belong to whole cohort
      if (s.sectionId === null) return true;
      // Section check
      if (selectedProgramId === 'ALL') return true;
      const sec = sections.find((x) => x.id === s.sectionId);
      return sec?.programId === selectedProgramId;
    });
  }, [schedules, selectedYearId, selectedProgramId, sections]);

  // Programs that have sections or courses in this year
  const programsInThisYear = useMemo(() => {
    return programs.map((p) => ({
      ...p,
      yearSections: sections.filter((s) => s.yearId === selectedYearId && s.programId === p.id),
    }));
  }, [programs, sections, selectedYearId]);

  // For PROGRAM_SHEETS layout: if a specific program is selected, only print that program's sheet
  const sheetsPrograms = useMemo(() => {
    const activeProgs = programsInThisYear.filter((p) => p.yearSections.length > 0);
    if (activeProgs.length === 0) {
      // General year (e.g. Preparatory Year) with no program tracks
      const generalSecs = sections.filter((s) => s.yearId === selectedYearId);
      return [
        {
          id: 0,
          code: 'PREP',
          name: activeYear?.name || 'Preparatory Year',
          department: 'Basic Sciences & General Engineering',
          yearSections: generalSecs,
        },
      ];
    }
    if (selectedProgramId === 'ALL') {
      return activeProgs;
    }
    return activeProgs.filter((p) => p.id === selectedProgramId);
  }, [programsInThisYear, selectedProgramId, sections, selectedYearId, activeYear]);

  const handlePrint = () => {
    window.print();
  };

  const currentDateFormatted = useMemo(() => {
    return new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }, []);

  if (!isOpen) return null;

  return (
    <div className="print-modal-overlay" onClick={onClose}>
      <div
        className="print-modal-container"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* ================= MODAL HEADER (HIDDEN IN PRINT) ================= */}
        <div className="print-modal-header no-print">
          <div className="print-header-left">
            <div className="print-header-icon">
              <Printer size={20} className="text-primary-400" />
            </div>
            <div>
              <h2 className="print-header-title">Official Timetable Print Preview</h2>
              <p className="print-header-subtitle">
                Accredited academic document layout with official headers, signature endorsements, and zero collision verification.
              </p>
            </div>
          </div>

          <div className="print-header-actions">
            <button
              onClick={handlePrint}
              className="btn btn-primary btn-print-launch"
              title="Open System Print Dialog (Ctrl/Cmd + P)"
            >
              <Printer size={16} />
              <span>Print Timetable</span>
            </button>
            <button
              onClick={onClose}
              className="btn-print-close"
              title="Close Print Preview"
              aria-label="Close Print Preview"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ================= CONTROLS TOOLBAR (HIDDEN IN PRINT) ================= */}
        <div className="print-controls-toolbar no-print">
          <div className="print-controls-group">
            {/* Academic Year Selection */}
            <div className="print-control-item">
              <label htmlFor="print-year-select" className="print-control-label">
                Academic Year
              </label>
              <select
                id="print-year-select"
                className="print-control-select"
                value={selectedYearId}
                onChange={(e) => setSelectedYearId(Number(e.target.value))}
              >
                {years.map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.name} ({y.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Degree Program Filter */}
            <div className="print-control-item">
              <label htmlFor="print-prog-select" className="print-control-label">
                Degree Program Filter
              </label>
              {programsInThisYear.some((p) => p.yearSections.length > 0) ? (
                <select
                  id="print-prog-select"
                  className="print-control-select"
                  value={selectedProgramId}
                  onChange={(e) =>
                    setSelectedProgramId(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))
                  }
                >
                  <option value="ALL">All Programs (Complete Cohort)</option>
                  {programsInThisYear
                    .filter((p) => p.yearSections.length > 0)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.code})
                      </option>
                    ))}
                </select>
              ) : (
                <select id="print-prog-select" className="print-control-select" disabled>
                  <option value="ALL">General Cohort (No Specific Programs)</option>
                </select>
              )}
            </div>

            {/* Saturday Toggle */}
            <div className="print-control-item print-checkbox-item">
              <label className="print-checkbox-label">
                <input
                  type="checkbox"
                  checked={includeSaturday}
                  onChange={(e) => setIncludeSaturday(e.target.checked)}
                  className="print-checkbox-input"
                />
                <span>Include Saturday</span>
              </label>
            </div>
          </div>

          <div className="print-controls-group">
            {/* Print Layout Selector */}
            <div className="print-control-item">
              <label className="print-control-label">Document Layout</label>
              <div className="print-layout-pill-group">
                <button
                  type="button"
                  className={`layout-pill-btn ${printLayout === 'PROGRAM_SHEETS' ? 'active' : ''}`}
                  onClick={() => setPrintLayout('PROGRAM_SHEETS')}
                  title="Individual accredited timetable sheet per degree program (Recommended)"
                >
                  <FileSpreadsheet size={14} />
                  <span>By Program</span>
                </button>
                <button
                  type="button"
                  className={`layout-pill-btn ${printLayout === 'MASTER_GRID' ? 'active' : ''}`}
                  onClick={() => setPrintLayout('MASTER_GRID')}
                  title="Unified 5-day cohort master grid"
                >
                  <LayoutGrid size={14} />
                  <span>Master Grid</span>
                </button>
                <button
                  type="button"
                  className={`layout-pill-btn ${printLayout === 'SECTION_ROWS' ? 'active' : ''}`}
                  onClick={() => setPrintLayout('SECTION_ROWS')}
                  title="Section-by-section rows grouped by day"
                >
                  <Layers size={14} />
                  <span>Section Rows</span>
                </button>
              </div>
            </div>

            {/* Density Selector */}
            <div className="print-control-item">
              <label className="print-control-label">Paper Density</label>
              <div className="print-layout-pill-group">
                <button
                  type="button"
                  className={`layout-pill-btn ${density === 'STANDARD' ? 'active' : ''}`}
                  onClick={() => setDensity('STANDARD')}
                >
                  <span>Standard</span>
                </button>
                <button
                  type="button"
                  className={`layout-pill-btn ${density === 'COMPACT' ? 'active' : ''}`}
                  onClick={() => setDensity('COMPACT')}
                  title="Compact font and spacing for fitting more content"
                >
                  <span>Compact</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Document Tips Ribbon (Hidden in Print) */}
        <div className="print-advice-bar no-print">
          <Info size={14} className="text-primary-400 shrink-0" />
          <span>
            <strong>Optimal Print Settings:</strong> In your browser print dialog, choose{' '}
            <strong>Landscape</strong> orientation, paper size <strong>A4</strong> or{' '}
            <strong>Letter</strong>, and ensure <strong>"Background Graphics"</strong> is enabled.
          </span>
        </div>

        {/* ================= PRINTABLE CANVAS CONTAINER ================= */}
        <div
          id="printable-timetable-canvas"
          className={`printable-timetable-canvas ${density === 'COMPACT' ? 'density-compact' : ''}`}
        >
          <PrintTimetableSheet
            activeYear={activeYear}
            selectedYearId={selectedYearId}
            selectedProgramObj={selectedProgramObj}
            programsInThisYear={programsInThisYear}
            sheetsPrograms={sheetsPrograms}
            relevantSections={relevantSections}
            sections={sections}
            courses={courses}
            standardPeriods={standardPeriods}
            relevantSchedules={relevantSchedules}
            schedules={schedules}
            activeDays={activeDays}
            printLayout={printLayout}
            density={density}
            currentDateFormatted={currentDateFormatted}
          />
        </div>
      </div>
    </div>
  );
};
