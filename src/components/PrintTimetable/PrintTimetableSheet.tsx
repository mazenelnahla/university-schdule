import { Fragment, type FC } from 'react';
import { Building } from 'lucide-react';
import type {
  AcademicYear,
  Program,
  Section,
  Professor,
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
  printLayout: 'MASTER_GRID' | 'PROGRAM_SHEETS' | 'SECTION_ROWS' | 'TA_SHEETS';
  density?: 'STANDARD' | 'COMPACT';
  currentDateFormatted: string;
  teachingAssistants?: Professor[];
  selectedTaId?: number | 'ALL';
  selectedTaYearId?: number | 'ALL';
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
  facultyName = 'Faculty of Engineering',
  docTitle,
  badges,
  issuedDate,
}) => (
  <header className="print-formal-header">
    <div className="header-university-crest header-crest-left">
      <img
        src={`${import.meta.env.BASE_URL}Ficon.jpg`}
        alt="Faculty of Engineering"
        className="header-crest-img"
      />
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
      <div className="header-university-crest header-crest-right">
        <img
          src={`${import.meta.env.BASE_URL}Pasted%202026-09-21%20at%201.29.12%20PM.png`}
          alt="East Port Said National University"
          className="header-crest-img"
        />
      </div>
      <div className="seal-date">Issued: {issuedDate}</div>
    </div>
  </header>
);

export interface PrintSignaturesFooterProps {
  deptHeadName?: string;
  facultyName?: string;
  customSigneeRole?: string;
  customSigneeName?: string;
}

export const PrintSignaturesFooter: FC<PrintSignaturesFooterProps> = ({
  deptHeadName = 'Faculty Council',
  facultyName = 'Faculty of Engineering',
  customSigneeRole,
  customSigneeName,
}) => (
  <footer className="print-signatures-footer">
    <div className="sig-block">
      <div className="sig-line"></div>
      <div className="sig-role">{customSigneeRole || 'Timetable Committee Coordinator'}</div>
      <div className="sig-name">{customSigneeName || 'Academic Affairs Office'}</div>
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

const formatFloor = (floor?: number | null): string => {
  if (floor === undefined || floor === null) return '';
  if (floor === 0) return 'Ground Fl.';
  if (floor === 1) return '1st Fl.';
  if (floor === 2) return '2nd Fl.';
  if (floor === 3) return '3rd Fl.';
  return `Fl. ${floor}`;
};

export interface PrintSessionCardProps {
  schedule: ScheduleWithDetails;
  sections?: Section[];
}

export const PrintSessionCard: FC<PrintSessionCardProps> = ({ schedule, sections }) => {
  const isLecture = schedule.sessionType === 'LECTURE';
  const sec = schedule.sectionId && sections ? sections.find((x) => x.id === schedule.sectionId) : null;
  const progCode = sec?.programCode || schedule.programCode || (isLecture && !schedule.sectionId ? 'ALL' : '');
  const tagText = isLecture
    ? (schedule.sectionName ? `LEC (${schedule.sectionName})` : 'LECTURE')
    : `${progCode ? `[${progCode}] ` : ''}${schedule.sectionName || 'SEC'}`;

  const floorStr = formatFloor(schedule.roomFloor ?? schedule.floor);
  const locationParts = [
    schedule.building || schedule.roomName || '',
    floorStr,
  ].filter(Boolean).join(' • ');

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
        <span className="card-room" title={locationParts ? `${schedule.roomCode} — ${locationParts}` : schedule.roomCode}>
          <Building size={9} className="inline-icon" />
          <strong>{schedule.roomCode}</strong>{locationParts ? ` (${locationParts})` : ''}
        </span>
        <span className="card-faculty-inline">
          • {schedule.professorTitle} {schedule.professorName}
        </span>
      </div>
    </div>
  );
};

export interface PrintTaSessionCardProps {
  schedule: ScheduleWithDetails;
  sections?: Section[];
}

export const PrintTaSessionCard: FC<PrintTaSessionCardProps> = ({ schedule, sections }) => {
  const isLecture = schedule.sessionType === 'LECTURE';
  const sec = schedule.sectionId && sections ? sections.find((x) => x.id === schedule.sectionId) : null;
  const progCode = sec?.programCode || schedule.programCode || '';

  const tagText = isLecture
    ? (schedule.sectionName ? `LEC (${schedule.sectionName})` : 'LECTURE')
    : `${progCode ? `[${progCode}] ` : ''}${schedule.sectionName || 'PRACTICAL LAB'}`;

  const cohortBadge = schedule.yearName || schedule.yearCode || '';
  const floorStr = formatFloor(schedule.roomFloor ?? schedule.floor);
  const locationParts = [
    schedule.building || schedule.roomName || '',
    floorStr,
  ].filter(Boolean).join(' • ');

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
        <span className="card-room" title={locationParts ? `${schedule.roomCode} — ${locationParts}` : schedule.roomCode}>
          <Building size={9} className="inline-icon" />
          <strong>{schedule.roomCode}</strong>{locationParts ? ` (${locationParts})` : ''}
        </span>
        {cohortBadge && (
          <span className="card-cohort-inline">
            • {cohortBadge}
          </span>
        )}
      </div>
      {schedule.notes && <div className="card-notes-tiny">{schedule.notes}</div>}
    </div>
  );
};

export const TaWorkloadSummaryBar: FC<{
  schedules: ScheduleWithDetails[];
}> = ({ schedules }) => {
  const courseMap = new Map<number, { code: string; name: string; sections: Set<string>; yearNames: Set<string> }>();
  for (const s of schedules) {
    if (!courseMap.has(s.courseId)) {
      courseMap.set(s.courseId, {
        code: s.courseCode,
        name: s.courseName,
        sections: new Set<string>(),
        yearNames: new Set<string>(),
      });
    }
    const entry = courseMap.get(s.courseId)!;
    if (s.sectionName) entry.sections.add(s.sectionName);
    if (s.yearName) entry.yearNames.add(s.yearName);
  }

  const coursesList = Array.from(courseMap.values());

  return (
    <div className="program-cohort-summary-bar ta-summary-bar">
      <span className="summary-col-title">Assigned Labs &amp; Courses:</span>
      <div className="summary-programs-list">
        {coursesList.length > 0 ? (
          coursesList.map((c) => (
            <div key={c.code} className="program-summary-chip">
              <span className="prog-chip-code">{c.code}</span>
              <span className="prog-chip-name">{c.name}:</span>
              <span className="prog-chip-sections">
                {c.sections.size > 0 ? Array.from(c.sections).join(', ') : 'All Cohorts'}
                {c.yearNames.size > 0 ? ` (${Array.from(c.yearNames).join(' / ')})` : ''}
              </span>
            </div>
          ))
        ) : (
          <span className="ta-empty-workload" style={{ fontSize: '0.75rem', color: '#64748b', fontStyle: 'italic' }}>
            No sessions currently scheduled for this teaching assistant.
          </span>
        )}
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
  teachingAssistants = [],
  selectedTaId = 'ALL',
  selectedTaYearId = 'ALL',
}) => {
  const activeTeachingAssistants = (
    selectedTaId && selectedTaId !== 'ALL'
      ? teachingAssistants.filter((t) => t.id === selectedTaId)
      : teachingAssistants
  );
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
              if (prog.yearSections && prog.yearSections.some((ys) => ys.id === s.sectionId)) {
                return true;
              }
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
                  docTitle={`PROGRAM TIMETABLE — ${prog.name.toUpperCase()}${prog.code ? ` (${prog.code})` : ''}`}
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

      {/* =========================================================================
          MODE 4: TEACHING ASSISTANTS SHEETS (1 Dedicated Accredited Page per TA)
          ========================================================================= */}
      {printLayout === 'TA_SHEETS' && (
        <div className="ta-sheets-container">
          {activeTeachingAssistants.length === 0 ? (
            <div className="print-page-sheet ta-sheet">
              <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                <p style={{ fontWeight: 600, fontSize: '1rem', marginBottom: '0.5rem' }}>
                  No teaching assistants found.
                </p>
                <p style={{ fontSize: '0.85rem' }}>
                  Add faculty members with title <strong>"TA"</strong> or <strong>"Eng."</strong> in Admin Hub to generate their timetables.
                </p>
              </div>
            </div>
          ) : (
            activeTeachingAssistants.map((ta, taIdx) => {
              const taSchedules = schedules.filter((s) => {
                if (s.professorId !== ta.id) return false;
                if (selectedTaYearId !== 'ALL' && s.academicYearId !== selectedTaYearId) {
                  return false;
                }
                return true;
              });

              const isLastSheet = taIdx === activeTeachingAssistants.length - 1;
              const totalHours = (taSchedules.length * 1.25).toFixed(1);

              return (
                <div
                  key={ta.id}
                  className={`print-page-sheet ta-sheet ${!isLastSheet ? 'print-page-break-after' : ''}`}
                >
                  <PrintFormalHeader
                    docTitle={`TEACHING ASSISTANT TIMETABLE — ${ta.name.toUpperCase()}`}
                    badges={[
                      { label: 'Staff Member', value: `${ta.title} ${ta.name}` },
                      { label: 'Department', value: ta.department || 'Faculty Staff' },
                      {
                        label: 'Weekly Load',
                        value: `${taSchedules.length} Session${taSchedules.length === 1 ? '' : 's'} (${totalHours} Teaching Hrs)`,
                      },
                      { label: 'Campus Office', value: ta.office || 'Faculty Campus' },
                      { label: 'Email', value: ta.email || 'N/A' },
                      { label: 'Semester', value: activeYear?.semester || 'Fall Semester 2026' },
                    ]}
                    issuedDate={currentDateFormatted}
                  />

                  <TaWorkloadSummaryBar schedules={taSchedules} />

                  <table className="print-timetable-table master-grid-table">
                    <PeriodTableHeaders periods={standardPeriods} />
                    <tbody>
                      {activeDays.map((day) => {
                        const daySchedules = taSchedules.filter((s) => s.dayOfWeek === day.id);

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
                                        <PrintTaSessionCard key={s.id} schedule={s} sections={sections} />
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
                    customSigneeRole="Teaching Assistant Signature"
                    customSigneeName={ta.name}
                    deptHeadName={ta.department ? `${ta.department} Department` : 'Department Head'}
                  />
                </div>
              );
            })
          )}
        </div>
      )}
    </>
  );
};
