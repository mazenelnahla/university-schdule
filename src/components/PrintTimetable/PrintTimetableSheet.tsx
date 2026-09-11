import { Fragment, type FC } from 'react';
import { GraduationCap, Building } from 'lucide-react';
import type {
  AcademicYear,
  Program,
  Section,
  Course,
  StandardPeriod,
  ScheduleWithDetails,
} from '../../db/schema';
import { timesOverlap } from '../../db/scheduleService';

export interface PrintDay {
  id: number;
  name: string;
  short: string;
}

export interface ProgramWithSections extends Program {
  yearSections: Section[];
}

export interface PrintTimetableSheetProps {
  activeYear?: AcademicYear;
  selectedYearId: number;
  selectedProgramObj: Program | null;
  programsInThisYear: ProgramWithSections[];
  sheetsPrograms: ProgramWithSections[];
  relevantSections: Section[];
  sections: Section[];
  courses?: Course[];
  standardPeriods: StandardPeriod[];
  relevantSchedules: ScheduleWithDetails[];
  schedules: ScheduleWithDetails[];
  activeDays: PrintDay[];
  printLayout: 'MASTER_GRID' | 'PROGRAM_SHEETS' | 'SECTION_ROWS';
  density?: 'STANDARD' | 'COMPACT';
  currentDateFormatted: string;
}

// =========================================================================
// REUSABLE SUB-COMPONENTS (Single place to edit across all 3 print layouts)
// =========================================================================

export interface PrintFormalHeaderProps {
  facultyName?: string;
  docTitle: string;
  badges: { label: string; value: string }[];
  issuedDate: string;
}

export const PrintFormalHeader: FC<PrintFormalHeaderProps> = ({
  facultyName = 'FACULTY OF Engineering',
  docTitle,
  badges,
  issuedDate,
}) => (
  <header className="print-formal-header">
    <div className="header-university-crest">
      <GraduationCap size={36} className="crest-icon" />
    </div>
    <div className="header-text-center">
      <h1 className="univ-title">{facultyName}</h1>
      <h2 className="doc-type-title">{docTitle}</h2>
      <div className="doc-meta-badge-row">
        {badges.map((b, idx) => (
          <span key={idx} className="doc-meta-badge">
            <strong>{b.label}:</strong> {b.value}
          </span>
        ))}
      </div>
    </div>
    <div className="header-seal-box">
      <div className="seal-date">Issued: {issuedDate}</div>
    </div>
  </header>
);

export interface PrintSignaturesFooterProps {
  deptHeadName?: string;
  facultyName?: string;
}

export const PrintSignaturesFooter: FC<PrintSignaturesFooterProps> = ({
  deptHeadName = 'Faculty Council',
  facultyName = 'Faculty of Engineering',
}) => (
  <footer className="print-signatures-footer">
    <div className="sig-block">
      <div className="sig-line"></div>
      <div className="sig-role">Timetable Committee Coordinator</div>
      <div className="sig-name">Academic Affairs Office</div>
    </div>
    <div className="sig-block">
      <div className="sig-line"></div>
      <div className="sig-role">Department Head</div>
      <div className="sig-name">{deptHeadName}</div>
    </div>
    <div className="sig-block">
      <div className="sig-line"></div>
      <div className="sig-role">Vice Dean of Education</div>
      <div className="sig-name">{facultyName}</div>
    </div>
  </footer>
);

export interface PrintSessionCardProps {
  schedule: ScheduleWithDetails;
  sections?: Section[];
}

export const PrintSessionCard: FC<PrintSessionCardProps> = ({ schedule, sections }) => {
  const isLecture = schedule.sectionId === null;
  const sec = schedule.sectionId && sections ? sections.find((x) => x.id === schedule.sectionId) : null;
  const progCode = sec?.programCode || schedule.programCode || (isLecture ? 'ALL' : '');
  const tagText = isLecture
    ? 'LECTURE'
    : `${progCode ? `[${progCode}] ` : ''}${schedule.sectionName || 'SEC'}`;

  return (
    <div className={`print-session-card ${isLecture ? 'lecture-card' : 'section-card'}`}>
      <div className="card-top-tag">
        <span className={`card-type-tag ${isLecture ? 'lecture-tag' : 'section-tag'}`}>
          {tagText}
        </span>
        <span className="card-code-tag">{schedule.courseCode}</span>
      </div>
      <div className="card-title">{schedule.courseName}</div>
      <div className="card-details-line">
        <span className="card-room">
          <Building size={9} className="inline-icon" />
          <strong>{schedule.roomCode}</strong> ({schedule.building || schedule.roomName || ''})
        </span>
        <span className="card-faculty-inline">
          • {schedule.professorTitle} {schedule.professorName}
        </span>
      </div>
    </div>
  );
};

export interface PeriodTableHeadersProps {
  periods: StandardPeriod[];
  dayColLabel?: string;
  dayColClass?: string;
}

export const PeriodTableHeaders: FC<PeriodTableHeadersProps> = ({
  periods,
  dayColLabel = 'Day',
  dayColClass = 'th-day-col-master',
}) => (
  <thead>
    <tr>
      <th className={dayColClass}>{dayColLabel}</th>
      {periods.map((p) => (
        <th key={p.id} className="th-period-master">
          <div className="period-num">Period {p.periodNumber}</div>
          <div className="period-hours">{p.startTime} – {p.endTime}</div>
        </th>
      ))}
    </tr>
  </thead>
);

export const ProgramSummaryBar: FC<{
  programs: ProgramWithSections[];
  generalSections?: Section[];
}> = ({ programs, generalSections = [] }) => {
  const hasPrograms = programs.some((p) => p.yearSections.length > 0);
  if (!hasPrograms) {
    return (
      <div className="program-cohort-summary-bar">
        <span className="summary-col-title">Preparatory General Cohort Sections:</span>
        <div className="summary-programs-list">
          <div className="program-summary-chip">
            <span className="prog-chip-code">PREP</span>
            <span className="prog-chip-name">General Engineering:</span>
            <span className="prog-chip-sections">
              {generalSections.length > 0
                ? generalSections.map((s) => s.name).join(', ')
                : 'General Cohort'}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="program-cohort-summary-bar">
      <span className="summary-col-title">Degree Programs &amp; Assigned Sections:</span>
      <div className="summary-programs-list">
        {programs.map((p) => (
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
  );
};

// =========================================================================
// MAIN PRINT TIMETABLE SHEET
// =========================================================================

export const PrintTimetableSheet: FC<PrintTimetableSheetProps> = ({
  activeYear,
  selectedProgramObj,
  programsInThisYear,
  sheetsPrograms,
  relevantSections,
  sections,
  standardPeriods,
  relevantSchedules,
  schedules,
  activeDays,
  printLayout,
  currentDateFormatted,
}) => {
  return (
    <>
      {/* =========================================================================
          MODE 1: MASTER 5-DAY GRID (Single Unified Page)
          ========================================================================= */}
      {printLayout === 'MASTER_GRID' && (
        <div className="print-page-sheet master-sheet">
          <PrintFormalHeader
            docTitle={`ACADEMIC TIMETABLE — ${activeYear?.name.toUpperCase()} (${activeYear?.semester.toUpperCase() || 'FALL 2026'})`}
            badges={[
              { label: 'Academic Year', value: activeYear?.name || '' },
              {
                label: 'Scope',
                value: selectedProgramObj
                  ? `${selectedProgramObj.name} (${selectedProgramObj.code})`
                  : (activeYear?.code === 'YEAR_PREP' || activeYear?.name.toLowerCase().includes('prep')
                      ? 'General Preparatory Year (Common Engineering Cohort)'
                      : 'All Degree Programs (Unified Cohort)'),
              },
              { label: 'Periods', value: `${standardPeriods.length} Standard Slots / Day` },
            ]}
            issuedDate={currentDateFormatted}
          />

          <ProgramSummaryBar programs={programsInThisYear} generalSections={relevantSections} />

          <table className="print-timetable-table master-grid-table">
            <PeriodTableHeaders periods={standardPeriods} />
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
                              {slotSessions.map((s) => (
                                <PrintSessionCard key={s.id} schedule={s} sections={sections} />
                              ))}
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

          <PrintSignaturesFooter
            deptHeadName={selectedProgramObj ? selectedProgramObj.department : 'Faculty Academic Board'}
          />
        </div>
      )}

      {/* =========================================================================
          MODE 2: PROGRAM SHEETS (1 Dedicated Clean Page per Degree Program)
          ========================================================================= */}
      {printLayout === 'PROGRAM_SHEETS' && (
        <div className="program-sheets-container">
          {sheetsPrograms.map((prog, progIdx) => {
            const progSchedules = schedules.filter((s) => {
              if (s.academicYearId !== activeYear?.id) return false;
              if (s.sectionId === null) return true;
              const sec = sections.find((x) => x.id === s.sectionId);
              return sec?.programId === prog.id;
            });

            const isLastSheet = progIdx === sheetsPrograms.length - 1;

            return (
              <div
                key={prog.id}
                className={`print-page-sheet program-sheet ${!isLastSheet ? 'print-page-break-after' : ''}`}
              >
                <PrintFormalHeader
                  docTitle={`PROGRAM TIMETABLE — ${prog.name.toUpperCase()} (${prog.code})`}
                  badges={[
                    { label: 'Academic Year', value: activeYear?.name || '' },
                    { label: 'Department', value: prog.department },
                    {
                      label: 'Assigned Sections',
                      value: prog.yearSections.map((s) => s.name).join(', ') || 'Cohorted',
                    },
                    { label: 'Semester', value: activeYear?.semester || 'Fall 2026' },
                  ]}
                  issuedDate={currentDateFormatted}
                />

                <table className="print-timetable-table master-grid-table">
                  <PeriodTableHeaders periods={standardPeriods} />
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
                                    {slotSessions.map((s) => (
                                      <PrintSessionCard key={s.id} schedule={s} sections={sections} />
                                    ))}
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

                <PrintSignaturesFooter deptHeadName={prog.department} />
              </div>
            );
          })}
        </div>
      )}

      {/* =========================================================================
          MODE 3: SECTION ROWS BREAKDOWN (Grouped by Day)
          ========================================================================= */}
      {printLayout === 'SECTION_ROWS' && (
        <div className="print-page-sheet section-breakdown-sheet">
          <PrintFormalHeader
            docTitle={`SECTION BREAKDOWN TIMETABLE — ${activeYear?.name.toUpperCase()}`}
            badges={[
              { label: 'Academic Year', value: activeYear?.name || '' },
              {
                label: 'Scope',
                value: selectedProgramObj
                  ? `${selectedProgramObj.name} (${selectedProgramObj.code})`
                  : (activeYear?.code === 'YEAR_PREP' || activeYear?.name.toLowerCase().includes('prep')
                      ? 'General Preparatory Cohort'
                      : 'All Degree Programs'),
              },
              { label: 'Total Sections', value: `${relevantSections.length} Sections` },
            ]}
            issuedDate={currentDateFormatted}
          />

          <table className="print-timetable-table section-rows-table">
            <PeriodTableHeaders
              periods={standardPeriods}
              dayColLabel="Day & Cohort"
              dayColClass="th-day-badge-col"
            />
            <tbody>
              {activeDays.map((day) => {
                const dayLectures = relevantSchedules.filter(
                  (s) => s.dayOfWeek === day.id && s.sectionId === null
                );

                return (
                  <Fragment key={day.id}>
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
                              <PrintSessionCard key={s.id} schedule={s} sections={sections} />
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
                                <PrintSessionCard key={s.id} schedule={s} sections={sections} />
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

          <PrintSignaturesFooter />
        </div>
      )}
    </>
  );
};
