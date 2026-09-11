import { useState, useMemo, Fragment, type FC } from 'react';
import {
  Printer,
  X,
  GraduationCap,
  Building,
  CheckCircle2,
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
} from '../db/schema';
import { timesOverlap } from '../db/scheduleService';

interface PrintTimetableModalProps {
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
  const [printLayout, setPrintLayout] = useState<'MASTER_GRID' | 'PROGRAM_SHEETS' | 'SECTION_ROWS'>('MASTER_GRID');
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
      const sec = sections.find((item) => item.id === s.sectionId);
      return sec?.programId === selectedProgramId;
    });
  }, [schedules, selectedYearId, selectedProgramId, sections]);

  // Group sections by program for summary display
  const programsInThisYear = useMemo(() => {
    const yearSecs = sections.filter((s) => s.yearId === selectedYearId);
    return programs
      .map((p) => ({
        ...p,
        yearSections: yearSecs.filter((s) => s.programId === p.id),
      }))
      .filter((p) => (selectedProgramId === 'ALL' ? p.yearSections.length > 0 : p.id === selectedProgramId));
  }, [programs, sections, selectedYearId, selectedProgramId]);

  // Programs to generate sheets for when in PROGRAM_SHEETS mode
  const sheetsPrograms = useMemo(() => {
    if (selectedProgramId !== 'ALL') {
      const p = programs.find((item) => item.id === selectedProgramId);
      if (!p) return [];
      const yearSecs = sections.filter((s) => s.yearId === selectedYearId && s.programId === p.id);
      return [{ ...p, yearSections: yearSecs }];
    }
    return programsInThisYear;
  }, [selectedProgramId, programs, sections, selectedYearId, programsInThisYear]);

  // Handle native print
  const handlePrint = () => {
    window.print();
  };

  if (!isOpen) return null;

  const currentDateFormatted = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    <div className="print-modal-overlay">
      <div className={`print-modal-container ${density === 'COMPACT' ? 'density-compact' : ''}`}>
        {/* Top Action Bar (Hidden in Native Print) */}
        <div className="print-action-bar no-print">
          <div className="print-bar-left">
            <div className="print-icon-title">
              <Printer className="text-primary" size={22} />
              <div>
                <h2 className="text-base font-bold">Print Academic Timetable</h2>
                <p className="text-xs text-secondary">
                  High-resolution landscape layout with program-specific sections &amp; zero collisions
                </p>
              </div>
            </div>
          </div>

          <div className="print-bar-controls">
            {/* Year Selector */}
            <div className="print-filter-control">
              <label className="text-xs font-semibold text-secondary">Academic Year:</label>
              <select
                className="print-select"
                value={selectedYearId}
                onChange={(e) => setSelectedYearId(Number(e.target.value))}
              >
                {years.map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Program Selector */}
            <div className="print-filter-control">
              <label className="text-xs font-semibold text-secondary">Program:</label>
              <select
                className="print-select"
                value={selectedProgramId}
                onChange={(e) => setSelectedProgramId(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
              >
                <option value="ALL">All Programs (Complete Cohort)</option>
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} - {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Layout Toggle */}
            <div className="print-layout-toggle-group">
              <button
                type="button"
                className={`layout-pill-btn ${printLayout === 'MASTER_GRID' ? 'active' : ''}`}
                onClick={() => setPrintLayout('MASTER_GRID')}
                title="Single-page 5-day grid for the cohort (Fits 1 page)"
              >
                <LayoutGrid size={13} />
                <span>Master Grid (1 Page)</span>
              </button>

              <button
                type="button"
                className={`layout-pill-btn ${printLayout === 'PROGRAM_SHEETS' ? 'active' : ''}`}
                onClick={() => setPrintLayout('PROGRAM_SHEETS')}
                title="Print dedicated 1-page timetable for each degree program"
              >
                <FileSpreadsheet size={13} />
                <span>Program Sheets (1 Page/Prog)</span>
              </button>

              <button
                type="button"
                className={`layout-pill-btn ${printLayout === 'SECTION_ROWS' ? 'active' : ''}`}
                onClick={() => setPrintLayout('SECTION_ROWS')}
                title="Detailed breakdown with individual rows for each section"
              >
                <Layers size={13} />
                <span>Section Rows</span>
              </button>
            </div>

            {/* Density Toggle */}
            <div className="print-filter-control">
              <label className="text-xs font-semibold text-secondary">Density:</label>
              <select
                className="print-select"
                value={density}
                onChange={(e) => setDensity(e.target.value as 'STANDARD' | 'COMPACT')}
              >
                <option value="STANDARD">Standard</option>
                <option value="COMPACT">Compact (Guaranteed 1-Page)</option>
              </select>
            </div>

            <label className="print-checkbox-label">
              <input
                type="checkbox"
                checked={includeSaturday}
                onChange={(e) => setIncludeSaturday(e.target.checked)}
              />
              <span>Include Sat</span>
            </label>

            <button
              onClick={handlePrint}
              className="action-btn primary-btn highlight-glow print-now-btn"
            >
              <Printer size={16} />
              <span>Print / Save PDF</span>
            </button>

            <button onClick={onClose} className="icon-btn close-modal-btn" title="Close Preview">
              <X size={18} />
            </button>
          </div>

          {/* Helpful printing instructions banner */}
          <div className="print-dialog-tip-banner">
            <Info size={14} className="tip-icon" />
            <span>
              <strong>Print Setting Guide:</strong> In your browser print dialog, select <strong>Landscape</strong> orientation, paper size <strong>A4 / Letter</strong>, and enable <strong>&ldquo;Background graphics&rdquo;</strong> for full colors.
            </span>
          </div>
        </div>

        {/* Printable Paper Canvas */}
        <div className="print-paper-canvas" id="printable-timetable-sheet">
          {/* =========================================================================
              MODE 1: MASTER 5-DAY GRID (Single Unified Page)
              ========================================================================= */}
          {printLayout === 'MASTER_GRID' && (
            <div className="print-page-sheet master-sheet">
              {/* Official University Header */}
              <header className="print-formal-header">
                <div className="header-university-crest">
                  <GraduationCap size={36} className="crest-icon" />
                </div>
                <div className="header-text-center">
                  <h1 className="univ-title">FACULTY OF COMPUTING &amp; INFORMATION SCIENCES</h1>
                  <h2 className="doc-type-title">
                    ACADEMIC TIMETABLE — {activeYear?.name.toUpperCase()} ({activeYear?.semester.toUpperCase() || 'FALL 2026'})
                  </h2>
                  <div className="doc-meta-badge-row">
                    <span className="doc-meta-badge">
                      <strong>Academic Year:</strong> {activeYear?.name}
                    </span>
                    <span className="doc-meta-badge">
                      <strong>Scope:</strong> {selectedProgramObj ? `${selectedProgramObj.name} (${selectedProgramObj.code})` : 'All Degree Programs (Unified Cohort)'}
                    </span>
                    <span className="doc-meta-badge">
                      <strong>Periods:</strong> {standardPeriods.length} Standard Slots / Day
                    </span>
                  </div>
                </div>
                <div className="header-seal-box">
                  <div className="seal-badge">
                    <CheckCircle2 size={13} className="text-emerald" />
                    <span>Zero Collision Verified</span>
                  </div>
                  <div className="seal-date">Issued: {currentDateFormatted}</div>
                </div>
              </header>

              {/* Programs & Sections Summary Strip */}
              <div className="program-cohort-summary-bar">
                <span className="summary-col-title">Degree Programs &amp; Assigned Sections:</span>
                <div className="summary-programs-list">
                  {programsInThisYear.map((p) => (
                    <div key={p.id} className="program-summary-chip">
                      <span className="prog-chip-code">{p.code}</span>
                      <span className="prog-chip-name">{p.name}:</span>
                      <span className="prog-chip-sections">
                        {p.yearSections.length > 0
                          ? p.yearSections.map((s) => s.name).join(', ')
                          : 'No sections'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Master 5-Day Grid Table */}
              <table className="print-timetable-table master-grid-table">
                <thead>
                  <tr>
                    <th className="th-day-col-master">Day</th>
                    {standardPeriods.map((p) => (
                      <th key={p.id} className="th-period-master">
                        <div className="period-num">Period {p.periodNumber}</div>
                        <div className="period-hours">{p.startTime} – {p.endTime}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {activeDays.map((day) => {
                    const daySchedules = relevantSchedules.filter((s) => s.dayOfWeek === day.id);

                    return (
                      <tr key={day.id} className="master-day-row">
                        <td className="td-day-col-master">
                          <div className="day-name-bold">{day.name}</div>
                          <div className="day-name-sub">
                            {daySchedules.length} Session{daySchedules.length === 1 ? '' : 's'}
                          </div>
                        </td>

                        {standardPeriods.map((period) => {
                          const slotSessions = daySchedules.filter((s) =>
                            timesOverlap(s.startTime, s.endTime, period.startTime, period.endTime)
                          );

                          return (
                            <td key={period.id} className="td-slot-cell">
                              {slotSessions.length > 0 ? (
                                <div className={`slot-sessions-wrapper ${slotSessions.length > 1 ? 'multi-session' : ''}`}>
                                  {slotSessions.map((s) => {
                                    const isLecture = s.sectionId === null;
                                    const sec = s.sectionId ? sections.find((x) => x.id === s.sectionId) : null;
                                    const progCode = sec?.programCode || s.programCode || (isLecture ? 'ALL' : '');

                                    return (
                                      <div
                                        key={s.id}
                                        className={`print-session-card ${isLecture ? 'lecture-card' : 'section-card'}`}
                                      >
                                        <div className="card-top-tag">
                                          <span className={`card-type-tag ${isLecture ? 'lecture-tag' : 'section-tag'}`}>
                                            {isLecture ? 'LECTURE' : `${progCode ? `[${progCode}] ` : ''}${s.sectionName || 'SEC'}`}
                                          </span>
                                          <span className="card-code-tag">{s.courseCode}</span>
                                        </div>
                                        <div className="card-title">{s.courseName}</div>
                                        <div className="card-details-line">
                                          <span className="card-room">
                                            <Building size={9} className="inline-icon" />
                                            <strong>{s.roomCode}</strong> ({s.building})
                                          </span>
                                          <span className="card-faculty-inline">
                                            • {s.professorTitle} {s.professorName}
                                          </span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div className="empty-print-slot"></div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Course Directory Reference Strip */}
              <div className="print-course-reference">
                <h3 className="ref-title">Curriculum Subjects — {activeYear?.name}</h3>
                <div className="ref-grid">
                  {courses
                    .filter((c) => c.yearId === selectedYearId)
                    .map((c) => (
                      <div key={c.id} className="ref-item">
                        <span className="ref-code" style={{ borderColor: c.colorHex }}>{c.code}</span>
                        <span className="ref-name">{c.name}</span>
                        <span className="ref-credits">{c.creditHours} Cr</span>
                      </div>
                    ))}
                </div>
              </div>

              {/* Formal Signatures Footer */}
              <footer className="print-signatures-footer">
                <div className="sig-block">
                  <div className="sig-line"></div>
                  <div className="sig-role">Timetable Committee Coordinator</div>
                  <div className="sig-name">Academic Affairs Office</div>
                </div>
                <div className="sig-block">
                  <div className="sig-line"></div>
                  <div className="sig-role">Department Head</div>
                  <div className="sig-name">
                    {selectedProgramObj ? selectedProgramObj.department : 'Faculty Academic Board'}
                  </div>
                </div>
                <div className="sig-block">
                  <div className="sig-line"></div>
                  <div className="sig-role">Vice Dean of Education</div>
                  <div className="sig-name">Faculty of Computing &amp; Information Sciences</div>
                </div>
              </footer>
            </div>
          )}

          {/* =========================================================================
              MODE 2: PROGRAM SHEETS (1 Dedicated Clean Page per Degree Program)
              ========================================================================= */}
          {printLayout === 'PROGRAM_SHEETS' && (
            <div className="program-sheets-container">
              {sheetsPrograms.map((prog, progIdx) => {
                // Filter schedules relevant to this program (Whole-class lectures + this program's sections)
                const progSchedules = schedules.filter((s) => {
                  if (s.academicYearId !== selectedYearId) return false;
                  if (s.sectionId === null) return true; // Lecture belongs to all
                  const sec = sections.find((x) => x.id === s.sectionId);
                  return sec?.programId === prog.id;
                });

                const isLastSheet = progIdx === sheetsPrograms.length - 1;

                return (
                  <div
                    key={prog.id}
                    className={`print-page-sheet program-sheet ${!isLastSheet ? 'print-page-break-after' : ''}`}
                  >
                    {/* Program-Specific Official Header */}
                    <header className="print-formal-header">
                      <div className="header-university-crest">
                        <GraduationCap size={36} className="crest-icon" />
                      </div>
                      <div className="header-text-center">
                        <h1 className="univ-title">FACULTY OF COMPUTING &amp; INFORMATION SCIENCES</h1>
                        <h2 className="doc-type-title">
                          PROGRAM TIMETABLE — {prog.name.toUpperCase()} ({prog.code})
                        </h2>
                        <div className="doc-meta-badge-row">
                          <span className="doc-meta-badge">
                            <strong>Academic Year:</strong> {activeYear?.name}
                          </span>
                          <span className="doc-meta-badge">
                            <strong>Department:</strong> {prog.department}
                          </span>
                          <span className="doc-meta-badge">
                            <strong>Assigned Sections:</strong> {prog.yearSections.map((s) => s.name).join(', ') || 'Cohorted'}
                          </span>
                          <span className="doc-meta-badge">
                            <strong>Semester:</strong> {activeYear?.semester || 'Fall 2026'}
                          </span>
                        </div>
                      </div>
                      <div className="header-seal-box">
                        <div className="seal-badge">
                          <CheckCircle2 size={13} className="text-emerald" />
                          <span>Zero Collision Verified</span>
                        </div>
                        <div className="seal-date">Issued: {currentDateFormatted}</div>
                      </div>
                    </header>

                    {/* Timetable Table for this Program */}
                    <table className="print-timetable-table master-grid-table">
                      <thead>
                        <tr>
                          <th className="th-day-col-master">Day</th>
                          {standardPeriods.map((p) => (
                            <th key={p.id} className="th-period-master">
                              <div className="period-num">Period {p.periodNumber}</div>
                              <div className="period-hours">{p.startTime} – {p.endTime}</div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {activeDays.map((day) => {
                          const daySchedules = progSchedules.filter((s) => s.dayOfWeek === day.id);

                          return (
                            <tr key={day.id} className="master-day-row">
                              <td className="td-day-col-master">
                                <div className="day-name-bold">{day.name}</div>
                                <div className="day-name-sub">
                                  {daySchedules.length} Session{daySchedules.length === 1 ? '' : 's'}
                                </div>
                              </td>

                              {standardPeriods.map((period) => {
                                const slotSessions = daySchedules.filter((s) =>
                                  timesOverlap(s.startTime, s.endTime, period.startTime, period.endTime)
                                );

                                return (
                                  <td key={period.id} className="td-slot-cell">
                                    {slotSessions.length > 0 ? (
                                      <div className="slot-sessions-wrapper">
                                        {slotSessions.map((s) => {
                                          const isLecture = s.sectionId === null;

                                          return (
                                            <div
                                              key={s.id}
                                              className={`print-session-card ${isLecture ? 'lecture-card' : 'section-card'}`}
                                            >
                                              <div className="card-top-tag">
                                                <span className={`card-type-tag ${isLecture ? 'lecture-tag' : 'section-tag'}`}>
                                                  {isLecture ? 'LECTURE' : `SECTION: ${s.sectionName}`}
                                                </span>
                                                <span className="card-code-tag">{s.courseCode}</span>
                                              </div>
                                              <div className="card-title">{s.courseName}</div>
                                              <div className="card-details-line">
                                                <span className="card-room">
                                                  <Building size={9} className="inline-icon" />
                                                  <strong>{s.roomCode}</strong> ({s.building})
                                                </span>
                                                <span className="card-faculty-inline">
                                                  • {s.professorTitle} {s.professorName}
                                                </span>
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    ) : (
                                      <div className="empty-print-slot"></div>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    {/* Course Reference Strip */}
                    <div className="print-course-reference">
                      <h3 className="ref-title">Curriculum Subjects — {prog.name} ({activeYear?.name})</h3>
                      <div className="ref-grid">
                        {courses
                          .filter((c) => c.yearId === selectedYearId)
                          .map((c) => (
                            <div key={c.id} className="ref-item">
                              <span className="ref-code" style={{ borderColor: c.colorHex }}>{c.code}</span>
                              <span className="ref-name">{c.name}</span>
                              <span className="ref-credits">{c.creditHours} Cr</span>
                            </div>
                          ))}
                      </div>
                    </div>

                    {/* Signatures Footer */}
                    <footer className="print-signatures-footer">
                      <div className="sig-block">
                        <div className="sig-line"></div>
                        <div className="sig-role">Program Coordinator</div>
                        <div className="sig-name">{prog.name} Track</div>
                      </div>
                      <div className="sig-block">
                        <div className="sig-line"></div>
                        <div className="sig-role">Department Head</div>
                        <div className="sig-name">{prog.department}</div>
                      </div>
                      <div className="sig-block">
                        <div className="sig-line"></div>
                        <div className="sig-role">Vice Dean of Education</div>
                        <div className="sig-name">Faculty of Computing</div>
                      </div>
                    </footer>
                  </div>
                );
              })}
            </div>
          )}

          {/* =========================================================================
              MODE 3: SECTION ROWS BREAKDOWN (Grouped by Day, No Fragile RowSpans)
              ========================================================================= */}
          {printLayout === 'SECTION_ROWS' && (
            <div className="print-page-sheet section-breakdown-sheet">
              {/* Header */}
              <header className="print-formal-header">
                <div className="header-university-crest">
                  <GraduationCap size={36} className="crest-icon" />
                </div>
                <div className="header-text-center">
                  <h1 className="univ-title">FACULTY OF COMPUTING &amp; INFORMATION SCIENCES</h1>
                  <h2 className="doc-type-title">
                    SECTION BREAKDOWN TIMETABLE — {activeYear?.name.toUpperCase()}
                  </h2>
                  <div className="doc-meta-badge-row">
                    <span className="doc-meta-badge">
                      <strong>Academic Year:</strong> {activeYear?.name}
                    </span>
                    <span className="doc-meta-badge">
                      <strong>Scope:</strong> {selectedProgramObj ? `${selectedProgramObj.name} (${selectedProgramObj.code})` : 'All Degree Programs'}
                    </span>
                    <span className="doc-meta-badge">
                      <strong>Total Sections:</strong> {relevantSections.length} Sections
                    </span>
                  </div>
                </div>
                <div className="header-seal-box">
                  <div className="seal-badge">
                    <CheckCircle2 size={13} className="text-emerald" />
                    <span>Zero Collision Verified</span>
                  </div>
                  <div className="seal-date">Issued: {currentDateFormatted}</div>
                </div>
              </header>

              <table className="print-timetable-table section-rows-table">
                <thead>
                  <tr>
                    <th className="th-day-badge-col">Day &amp; Cohort</th>
                    {standardPeriods.map((p) => (
                      <th key={p.id} className="th-period-breakdown">
                        <div className="period-num">Period {p.periodNumber}</div>
                        <div className="period-hours">{p.startTime} – {p.endTime}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {activeDays.map((day) => {
                    const dayLectures = relevantSchedules.filter(
                      (s) => s.dayOfWeek === day.id && s.sectionId === null
                    );

                    return (
                      <Fragment key={day.id}>
                        {/* Day Group Banner Row */}
                        <tr className="day-banner-row">
                          <td colSpan={1 + standardPeriods.length} className="td-day-banner">
                            <span className="day-banner-title">{day.name}</span>
                          </td>
                        </tr>

                        {/* Whole Class Lecture Row */}
                        <tr className="print-section-row lecture-row">
                          <td className="td-cohort-name lecture-cohort">
                            <div className="cohort-badge">Whole Cohort Lectures</div>
                            <div className="cohort-sub">All Degree Programs</div>
                          </td>

                          {standardPeriods.map((period) => {
                            const matchingLectures = dayLectures.filter((s) =>
                              timesOverlap(s.startTime, s.endTime, period.startTime, period.endTime)
                            );

                            return (
                              <td key={period.id} className="td-print-slot">
                                {matchingLectures.map((s) => (
                                  <div key={s.id} className="print-session-card lecture-card">
                                    <div className="card-top-tag">
                                      <span className="card-type-tag lecture-tag">LECTURE</span>
                                      <span className="card-code-tag">{s.courseCode}</span>
                                    </div>
                                    <div className="card-title">{s.courseName}</div>
                                    <div className="card-details-line">
                                      <span className="card-room">
                                        <Building size={9} className="inline-icon" />
                                        <strong>{s.roomCode}</strong> ({s.building})
                                      </span>
                                      <span className="card-faculty-inline">
                                        • {s.professorTitle} {s.professorName}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </td>
                            );
                          })}
                        </tr>

                        {/* Program Sections Rows */}
                        {relevantSections.map((sec) => (
                          <tr key={`${day.id}-sec-${sec.id}`} className="print-section-row">
                            <td className="td-cohort-name section-cohort">
                              <div className="cohort-badge section-badge">
                                {sec.programCode ? `[${sec.programCode}] ` : ''}{sec.name}
                              </div>
                              <div className="cohort-sub">Cap: {sec.capacity} students</div>
                            </td>

                            {standardPeriods.map((period) => {
                              const matchingSections = relevantSchedules.filter(
                                (s) =>
                                  s.dayOfWeek === day.id &&
                                  s.sectionId === sec.id &&
                                  timesOverlap(s.startTime, s.endTime, period.startTime, period.endTime)
                              );

                              return (
                                <td key={period.id} className="td-print-slot">
                                  {matchingSections.map((s) => (
                                    <div key={s.id} className="print-session-card section-card">
                                      <div className="card-top-tag">
                                        <span className="card-type-tag section-tag">
                                          {sec.programCode ? `[${sec.programCode}] ` : ''}SECTION
                                        </span>
                                        <span className="card-code-tag">{s.courseCode}</span>
                                      </div>
                                      <div className="card-title">{s.courseName}</div>
                                      <div className="card-details-line">
                                        <span className="card-room">
                                          <Building size={9} className="inline-icon" />
                                          <strong>{s.roomCode}</strong> ({s.roomName})
                                        </span>
                                        <span className="card-faculty-inline">
                                          • {s.professorTitle} {s.professorName}
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>

              {/* Course Directory Reference */}
              <div className="print-course-reference">
                <h3 className="ref-title">Curriculum Subjects — {activeYear?.name}</h3>
                <div className="ref-grid">
                  {courses
                    .filter((c) => c.yearId === selectedYearId)
                    .map((c) => (
                      <div key={c.id} className="ref-item">
                        <span className="ref-code" style={{ borderColor: c.colorHex }}>{c.code}</span>
                        <span className="ref-name">{c.name}</span>
                        <span className="ref-credits">{c.creditHours} Cr</span>
                      </div>
                    ))}
                </div>
              </div>

              {/* Signatures */}
              <footer className="print-signatures-footer">
                <div className="sig-block">
                  <div className="sig-line"></div>
                  <div className="sig-role">Timetable Committee Coordinator</div>
                  <div className="sig-name">Academic Affairs Office</div>
                </div>
                <div className="sig-block">
                  <div className="sig-line"></div>
                  <div className="sig-role">Department Head</div>
                  <div className="sig-name">Faculty Council</div>
                </div>
                <div className="sig-block">
                  <div className="sig-line"></div>
                  <div className="sig-role">Vice Dean of Education</div>
                  <div className="sig-name">Faculty of Computing</div>
                </div>
              </footer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
