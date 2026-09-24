import { useState, useMemo, Fragment, type FC } from 'react';
import {
  Building,
  User,
  Edit2,
  Trash2,
  Plus,
  Info,
  Layers,
  Users,
  Search,
  Printer,
  CalendarX,
  Calendar,
  GraduationCap,
  Sparkles,
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
  AdminUser,
} from '../db/schema';
import { timesOverlap } from '../db/scheduleService';

const DAYS = [
  { id: 0, name: 'Sunday', short: 'Sun' },
  { id: 1, name: 'Monday', short: 'Mon' },
  { id: 2, name: 'Tuesday', short: 'Tue' },
  { id: 3, name: 'Wednesday', short: 'Wed' },
  { id: 4, name: 'Thursday', short: 'Thu' },
  { id: 5, name: 'Friday', short: 'Fri' },
  { id: 6, name: 'Saturday', short: 'Sat' },
];

interface TimetableCalendarProps {
  schedules: ScheduleWithDetails[];
  years: AcademicYear[];
  programs?: Program[];
  sections: Section[];
  professors: Professor[];
  rooms: Room[];
  courses?: Course[];
  standardPeriods: StandardPeriod[];
  selectedYearId: number | 'ALL';
  viewMode: 'YEAR' | 'PROGRAM' | 'ROOM' | 'PROFESSOR';
  adminUser: AdminUser | null;
  onEditSchedule: (schedule: ScheduleWithDetails) => void;
  onDeleteSchedule: (id: number) => void;
  onAddNewSlot: (dayOfWeek: number, periodId?: number, extra?: { roomId?: number; yearId?: number; sectionId?: number; programId?: number | 'ALL' }) => void;
  onOpenPrint?: () => void;
  onClearTimetable?: () => void;
  onOpenAutoSchedule?: () => void;
}

export const TimetableCalendar: FC<TimetableCalendarProps> = ({
  schedules,
  years,
  programs = [],
  sections,
  professors,
  rooms,
  courses: _courses,
  standardPeriods,
  selectedYearId,
  viewMode,
  adminUser,
  onEditSchedule,
  onDeleteSchedule,
  onAddNewSlot,
  onOpenPrint,
  onClearTimetable,
  onOpenAutoSchedule,
}) => {
  const [selectedDay, setSelectedDay] = useState<number>(0); // 0 = Sunday
  const [isFullWeekView, setIsFullWeekView] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedProgramFilter, setSelectedProgramFilter] = useState<number | 'ALL'>('ALL');
  const [selectedSectionFilter, setSelectedSectionFilter] = useState<number | 'ALL'>('ALL');

  const [prevYearId, setPrevYearId] = useState(selectedYearId);
  if (prevYearId !== selectedYearId) {
    setPrevYearId(selectedYearId);
    setSelectedSectionFilter('ALL');
    setSelectedProgramFilter('ALL');
  }

  const requiresProgramSelection = selectedYearId !== 'ALL' && selectedYearId !== 5;

  // Helper to trigger adding a slot with the active program and section filter pre-populated
  const handleSlotAdd = (
    dayOfWeek: number,
    periodId?: number,
    extra?: { roomId?: number; yearId?: number; sectionId?: number; programId?: number | 'ALL' }
  ) => {
    const progId =
      extra?.programId !== undefined
        ? extra.programId
        : selectedProgramFilter !== 'ALL'
        ? selectedProgramFilter
        : undefined;
    const secId =
      extra?.sectionId !== undefined
        ? extra.sectionId
        : selectedSectionFilter !== 'ALL'
        ? selectedSectionFilter
        : undefined;
    onAddNewSlot(dayOfWeek, periodId, { ...extra, programId: progId, sectionId: secId });
  };

  // Filter schedules based on search term and optional room/prof/program/section filters
  const filteredSchedules = useMemo(() => {
    return schedules.filter((s) => {
      if (requiresProgramSelection && selectedProgramFilter === 'ALL') return false;
      // Search term
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matches =
          s.courseCode.toLowerCase().includes(term) ||
          s.courseName.toLowerCase().includes(term) ||
          s.professorName.toLowerCase().includes(term) ||
          s.roomCode.toLowerCase().includes(term) ||
          (s.sectionName && s.sectionName.toLowerCase().includes(term)) ||
          (s.programName && s.programName.toLowerCase().includes(term)) ||
          (s.programCode && s.programCode.toLowerCase().includes(term));
        if (!matches) return false;
      }

      // Year filter (if in YEAR or PROGRAM mode)
      if ((viewMode === 'YEAR' || viewMode === 'PROGRAM') && selectedYearId !== 'ALL') {
        if (s.academicYearId !== selectedYearId) return false;
      }

      // Program filter (applies to sections and program-specific lectures)
      if (selectedProgramFilter !== 'ALL') {
        if (s.sectionId !== null) {
          const sec = sections.find((secItem) => secItem.id === s.sectionId);
          if (sec && sec.programId && sec.programId !== selectedProgramFilter) {
            return false;
          }
        } else {
          // Lecture: if the course belongs to a specific program, check match
          if (s.courseProgramIds?.length
            ? !s.courseProgramIds.includes(selectedProgramFilter)
            : s.courseProgramId && s.courseProgramId !== selectedProgramFilter) {
            return false;
          }
        }
      }

      // Section / Group filter (e.g. Preparatory Year Group A vs Group B tables)
      if (selectedSectionFilter !== 'ALL') {
        // Show sessions matching this section or general whole-batch lectures
        if (s.sectionId !== null && s.sectionId !== selectedSectionFilter) {
          return false;
        }
      }

      return true;
    });
  }, [schedules, searchTerm, viewMode, selectedYearId, selectedProgramFilter, selectedSectionFilter, sections]);

  // Find matching items for a given cell (day, period, and category row)
  const getSchedulesForSlot = (dayId: number, period: StandardPeriod, rowContext?: { yearId?: number; sectionId?: number; roomId?: number; professorId?: number }) => {
    return filteredSchedules.filter((s) => {
      if (s.dayOfWeek !== dayId) return false;

      // Time overlap check with this standard period
      const overlaps = timesOverlap(s.startTime, s.endTime, period.startTime, period.endTime);
      if (!overlaps) return false;

      if (rowContext?.roomId !== undefined) {
        return s.roomId === rowContext.roomId;
      }
      if (rowContext?.professorId !== undefined) {
        return s.professorId === rowContext.professorId;
      }
      if (rowContext?.yearId !== undefined) {
        if (s.academicYearId !== rowContext.yearId) return false;
        if (rowContext.sectionId !== undefined) {
          // If this row is for a specific section, match either that section OR whole-year lectures
          return s.sectionId === rowContext.sectionId || s.sectionId === null;
        }
        return true;
      }

      return true;
    });
  };

  // Determine current active academic year object
  const activeYearObj = years.find((y) => y.id === selectedYearId);
  const activeSections = sections.filter((sec) => selectedYearId === 'ALL' || sec.yearId === selectedYearId);

  // Summary Metrics
  const totalSessionsDay = filteredSchedules.filter((s) => s.dayOfWeek === selectedDay).length;
  const uniqueRoomsInUse = new Set(filteredSchedules.filter((s) => s.dayOfWeek === selectedDay).map((s) => s.roomId)).size;

  return (
    <div className="timetable-wrapper">
      {/* Calendar Header Controls */}
      <div className="calendar-controls-bar">
        {/* Day Selector Pills */}
        <div className="day-tabs-group">
          {!requiresProgramSelection && <button
            className={`day-tab-pill ${!isFullWeekView ? 'active' : ''}`}
            onClick={() => setIsFullWeekView(false)}
          >
            Day View
          </button>}
          <button
            className={`day-tab-pill ${isFullWeekView ? 'active' : ''}`}
            onClick={() => setIsFullWeekView(true)}
          >
            Full Week Grid
          </button>

          {!isFullWeekView && (
            <div className="days-list">
              {DAYS.map((d) => (
                <button
                  key={d.id}
                  className={`day-btn ${selectedDay === d.id ? 'active' : ''}`}
                  onClick={() => setSelectedDay(d.id)}
                >
                  <span className="day-name">{d.name}</span>
                  <span className="day-count">
                    {filteredSchedules.filter((s) => s.dayOfWeek === d.id).length}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Search and Quick Filters */}
        <div className="calendar-filter-group">
          <div className="search-box">
            <Search size={15} className="search-icon" />
            <input
              type="text"
              className="search-input"
              placeholder="Search course, prof, room..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Auto Gen Tables by Semester Button */}
          {onOpenAutoSchedule && (
            <button
              onClick={onOpenAutoSchedule}
              className="action-btn primary-btn auto-gen-trigger-btn highlight-glow"
              title="Auto-Generate complete conflict-free timetables by semester (Fall / Spring)"
            >
              <Sparkles size={15} className="text-amber-400" />
              <span>Auto Gen Tables</span>
            </button>
          )}

          {/* Print Timetable Trigger Button */}
          {onOpenPrint && (
            <button
              onClick={onOpenPrint}
              className="action-btn primary-subtle print-trigger-btn"
              title="Print official academic timetable for this year & programs"
            >
              <Printer size={15} />
              <span>Print Timetable</span>
            </button>
          )}

          {/* Clear Timetable Trigger Button */}
          {onClearTimetable && adminUser && schedules.length > 0 && (
            <button
              onClick={onClearTimetable}
              className="action-btn secondary-btn clear-timetable-btn"
              title="Clear all scheduled classes (keeps faculty, rooms, courses & programs)"
            >
              <CalendarX size={15} className="text-amber-400" />
              <span>Clear Timetable</span>
            </button>
          )}
        </div>
      </div>

      {/* Metric summary banner */}
      <div className="metrics-banner">
        <div className="metric-item">
          <span className="metric-label">Active View:</span>
          <span className="metric-value highlight">
            {viewMode === 'YEAR'
              ? selectedYearId === 'ALL'
                ? 'All Academic Years'
                : activeYearObj?.name || 'Year Schedule'
              : viewMode === 'PROGRAM'
              ? selectedProgramFilter === 'ALL'
                ? 'All Degree Programs'
                : `${programs.find((p) => p.id === selectedProgramFilter)?.name || 'Program'} (${programs.find((p) => p.id === selectedProgramFilter)?.code || ''})`
              : viewMode === 'ROOM'
              ? 'Room Utilization Matrix'
              : 'Faculty Timetables'}
          </span>
        </div>
        <div className="metric-item">
          <span className="metric-label">{isFullWeekView ? 'Total Week Sessions:' : 'Sessions Today:'}</span>
          <span className="metric-value font-semibold">
            {isFullWeekView ? filteredSchedules.length : totalSessionsDay}
          </span>
        </div>
        <div className="metric-item">
          <span className="metric-label">Rooms Engaged:</span>
          <span className="metric-value">
            {uniqueRoomsInUse} / {rooms.length}
          </span>
        </div>
      </div>

      {/* Program Selection Strip when in YEAR or PROGRAM view */}
      {(viewMode === 'YEAR' || viewMode === 'PROGRAM') && (
        selectedYearId !== 5 && selectedYearId !== 'ALL' || activeSections.some((s) => s.programId !== null) ? (
          <div className="program-selection-strip">
            <div className="program-strip-label">
              <GraduationCap size={16} className="text-primary" />
              <span className="font-semibold text-xs text-secondary">Department View:</span>
            </div>
            <div className="program-pills-row">
              {!requiresProgramSelection && <button
                className={`program-filter-pill ${selectedProgramFilter === 'ALL' ? 'active' : ''}`}
                onClick={() => setSelectedProgramFilter('ALL')}
              >
                All Departments ({programs.length})
              </button>}
              {programs
                .filter((p) =>
                  selectedYearId !== 5 ||
                  activeSections.some((s) => s.programId === p.id) ||
                  schedules.some((s) =>
                    s.academicYearId === selectedYearId &&
                    (s.courseProgramIds?.includes(p.id) || s.courseProgramId === p.id)
                  )
                )
                .map((p) => (
                  <button
                    key={p.id}
                    className={`program-filter-pill ${selectedProgramFilter === p.id ? 'active' : ''}`}
                    onClick={() => setSelectedProgramFilter(p.id)}
                  >
                    <span className="prog-pill-code">{p.code}</span>
                    <span>{p.name}</span>
                  </button>
                ))}
            </div>
          </div>
        ) : (
          <div className="program-selection-strip">
            <div className="program-strip-label">
              <Users size={16} className="text-primary" />
              <span className="font-semibold text-xs text-secondary">
                {selectedYearId === 5 ? 'Prep Cohort Groups:' : 'Cohort Groups:'}
              </span>
            </div>
            <div className="program-pills-row">
              <button
                className={`program-filter-pill ${selectedSectionFilter === 'ALL' ? 'active' : ''}`}
                onClick={() => setSelectedSectionFilter('ALL')}
              >
                All Groups (Both Tables)
              </button>
              {activeSections.map((sec) => (
                <button
                  key={sec.id}
                  className={`program-filter-pill ${selectedSectionFilter === sec.id ? 'active' : ''}`}
                  onClick={() => setSelectedSectionFilter(sec.id)}
                >
                  <span className="prog-pill-code">{sec.name}</span>
                  <span>{sec.name} Table</span>
                </button>
              ))}
            </div>
          </div>
        )
      )}

      {/* Main Timetable View */}
      {isFullWeekView ? (
        /* Full Week Grid View: Days on Left, Periods on Top */
        <div className="timetable-grid-card">
          <div className="table-responsive">
            <table className="timetable-table">
              <thead>
                <tr>
                  <th className="th-day-col">Day / Time</th>
                  {standardPeriods.map((p) => (
                    <th key={p.id} className="th-period-col">
                      <div className="period-title">Period {p.periodNumber}</div>
                      <div className="period-time">{p.startTime} - {p.endTime}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DAYS.map((d) => (
                  <tr key={d.id} className="grid-row">
                    <td className="td-day-header">
                      <div className="day-row-title">{d.name}</div>
                    </td>
                    {standardPeriods.map((p) => {
                      const items = getSchedulesForSlot(d.id, p);
                      return (
                        <td key={p.id} className="td-slot">
                          <div className="slot-container">
                            {items.map((item) => (
                              <ScheduleCard
                                key={item.id}
                                schedule={item}
                                adminUser={adminUser}
                                onEdit={() => onEditSchedule(item)}
                                onDelete={() => onDeleteSchedule(item.id)}
                              />
                            ))}

                            {items.length === 0 && adminUser && (
                              <button
                                className="add-slot-btn"
                                onClick={() => handleSlotAdd(d.id, p.id)}
                                title={`Schedule session on ${d.name} at ${p.startTime}`}
                              >
                                <Plus size={14} />
                                <span>Schedule</span>
                              </button>
                            )}

                            {items.length === 0 && !adminUser && (
                              <div className="empty-slot-label">Available</div>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Day View: Rows based on active viewMode */
        <div className="timetable-grid-card">
          <div className="table-responsive">
            <table className="timetable-table">
              <thead>
                <tr>
                  <th className="th-entity-col">
                    {viewMode === 'YEAR'
                      ? 'Cohort / Section'
                      : viewMode === 'PROGRAM'
                      ? 'Program Track / Section'
                      : viewMode === 'ROOM'
                      ? 'Room / Facility'
                      : 'Professor'}
                  </th>
                  {standardPeriods.map((p) => (
                    <th key={p.id} className="th-period-col">
                      <div className="period-title">Period {p.periodNumber}</div>
                      <div className="period-time">{p.startTime} - {p.endTime}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* 1. VIEW MODE: YEAR OR PROGRAM */}
                {(viewMode === 'YEAR' || viewMode === 'PROGRAM') && (
                  <>
                    {/* Entire Year Row for Lectures */}
                    <tr className="grid-row highlight-row">
                      <td className="td-entity-header">
                        <div className="entity-title font-bold flex-center-gap">
                          <Users size={16} className="text-primary" />
                          <span>Whole Cohort (Lectures)</span>
                        </div>
                        <div className="entity-subtitle">
                          {selectedProgramFilter === 'ALL'
                            ? 'All sections combined'
                            : `Lectures applicable to ${programs.find((p) => p.id === selectedProgramFilter)?.code || 'Program'}`}
                        </div>
                      </td>
                      {standardPeriods.map((p) => {
                        const items = filteredSchedules.filter(
                          (s) =>
                            s.dayOfWeek === selectedDay &&
                            s.sectionId === null &&
                            timesOverlap(s.startTime, s.endTime, p.startTime, p.endTime)
                        );
                        return (
                          <td key={p.id} className="td-slot">
                            <div className="slot-container">
                              {items.map((item) => (
                                <ScheduleCard
                                  key={item.id}
                                  schedule={item}
                                  adminUser={adminUser}
                                  onEdit={() => onEditSchedule(item)}
                                  onDelete={() => onDeleteSchedule(item.id)}
                                />
                              ))}
                              {items.length === 0 && adminUser && (
                                <button
                                  className="add-slot-btn"
                                  onClick={() =>
                                    handleSlotAdd(
                                      selectedDay,
                                      p.id,
                                      { yearId: typeof selectedYearId === 'number' ? selectedYearId : years[0]?.id }
                                    )
                                  }
                                >
                                  <Plus size={14} />
                                  <span>Lecture</span>
                                </button>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>

                    {/* Section Rows Grouped By Degree Program */}
                    {programs && programs.length > 0 ? (
                      <>
                        {programs
                          .filter((prog) => selectedProgramFilter === 'ALL' || selectedProgramFilter === prog.id)
                          .map((prog) => {
                          const progSections = activeSections.filter((s) => s.programId === prog.id);
                          if (progSections.length === 0) return null;
                          return (
                            <Fragment key={prog.id}>
                              <tr className="program-divider-row">
                                <td colSpan={1 + standardPeriods.length} className="td-program-divider">
                                  <div className="program-divider-content">
                                    <GraduationCap size={16} className="prog-div-icon" />
                                    <span className="program-divider-title">Department: {prog.name} ({prog.code})</span>
                                    <span className="program-sec-count">
                                      {progSections.length} Department Section{progSections.length === 1 ? '' : 's'}
                                    </span>
                                  </div>
                                </td>
                              </tr>
                              {progSections.map((sec) => (
                                <tr key={sec.id} className="grid-row">
                                  <td className="td-entity-header">
                                    <div className="entity-title font-semibold flex-center-gap">
                                      <Layers size={15} className="text-emerald" />
                                      <span>{sec.name}</span>
                                    </div>
                                    <div className="entity-subtitle">
                                      {prog.code} • {years.find((y) => y.id === sec.yearId)?.name} • Cap: {sec.capacity}
                                    </div>
                                  </td>
                                  {standardPeriods.map((p) => {
                                    const items = filteredSchedules.filter(
                                      (s) =>
                                        s.dayOfWeek === selectedDay &&
                                        s.sectionId === sec.id &&
                                        timesOverlap(s.startTime, s.endTime, p.startTime, p.endTime)
                                    );
                                    return (
                                      <td key={p.id} className="td-slot">
                                        <div className="slot-container">
                                          {items.map((item) => (
                                            <ScheduleCard
                                              key={item.id}
                                              schedule={item}
                                              adminUser={adminUser}
                                              onEdit={() => onEditSchedule(item)}
                                              onDelete={() => onDeleteSchedule(item.id)}
                                            />
                                          ))}
                                          {items.length === 0 && adminUser && (
                                            <button
                                              className="add-slot-btn"
                                              onClick={() =>
                                                handleSlotAdd(selectedDay, p.id, {
                                                  yearId: sec.yearId,
                                                  sectionId: sec.id,
                                                })
                                              }
                                            >
                                              <Plus size={14} />
                                              <span>Section</span>
                                            </button>
                                          )}
                                        </div>
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                            </Fragment>
                          );
                        })}

                        {/* Any unassigned / general sections */}
                        {activeSections.filter((s) => !s.programId && (selectedSectionFilter === 'ALL' || s.id === selectedSectionFilter)).length > 0 && (
                          <Fragment key="general-cohort-sections">
                            <tr className="program-divider-row">
                              <td colSpan={1 + standardPeriods.length} className="td-program-divider">
                                <div className="program-divider-content">
                                  <Layers size={15} className="prog-div-icon" />
                                  <span className="program-divider-title">
                                    {selectedYearId === 5
                                      ? selectedSectionFilter === 'ALL'
                                        ? 'Preparatory Year Parallel Tables (Group A & Group B)'
                                        : `${activeSections.find((s) => s.id === selectedSectionFilter)?.name || ''} Timetable Table`
                                      : 'General Cohort Sections'}
                                  </span>
                                </div>
                              </td>
                            </tr>
                            {activeSections
                              .filter((s) => !s.programId && (selectedSectionFilter === 'ALL' || s.id === selectedSectionFilter))
                              .map((sec) => (
                                <tr key={sec.id} className="grid-row">
                                  <td className="td-entity-header">
                                    <div className="entity-title font-semibold flex-center-gap">
                                      <Layers size={15} className="text-emerald" />
                                      <span>{sec.name}</span>
                                    </div>
                                    <div className="entity-subtitle">
                                      {years.find((y) => y.id === sec.yearId)?.name} • Cap: {sec.capacity}
                                    </div>
                                  </td>
                                  {standardPeriods.map((p) => {
                                    const items = filteredSchedules.filter(
                                      (s) =>
                                        s.dayOfWeek === selectedDay &&
                                        s.sectionId === sec.id &&
                                        timesOverlap(s.startTime, s.endTime, p.startTime, p.endTime)
                                    );
                                    return (
                                      <td key={p.id} className="td-slot">
                                        <div className="slot-container">
                                          {items.map((item) => (
                                            <ScheduleCard
                                              key={item.id}
                                              schedule={item}
                                              adminUser={adminUser}
                                              onEdit={() => onEditSchedule(item)}
                                              onDelete={() => onDeleteSchedule(item.id)}
                                            />
                                          ))}
                                          {items.length === 0 && adminUser && (
                                            <button
                                              className="add-slot-btn"
                                              onClick={() =>
                                                handleSlotAdd(selectedDay, p.id, {
                                                  yearId: sec.yearId,
                                                  sectionId: sec.id,
                                                })
                                              }
                                            >
                                              <Plus size={14} />
                                              <span>Section</span>
                                            </button>
                                          )}
                                        </div>
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                          </Fragment>
                        )}
                      </>
                    ) : (
                      activeSections.map((sec) => (
                        <tr key={sec.id} className="grid-row">
                          <td className="td-entity-header">
                            <div className="entity-title font-semibold flex-center-gap">
                              <Layers size={15} className="text-emerald" />
                              <span>{sec.name}</span>
                            </div>
                            <div className="entity-subtitle">
                              {years.find((y) => y.id === sec.yearId)?.name} • Cap: {sec.capacity}
                            </div>
                          </td>
                          {standardPeriods.map((p) => {
                            const items = filteredSchedules.filter(
                              (s) =>
                                s.dayOfWeek === selectedDay &&
                                s.sectionId === sec.id &&
                                timesOverlap(s.startTime, s.endTime, p.startTime, p.endTime)
                            );
                            return (
                              <td key={p.id} className="td-slot">
                                <div className="slot-container">
                                  {items.map((item) => (
                                    <ScheduleCard
                                      key={item.id}
                                      schedule={item}
                                      adminUser={adminUser}
                                      onEdit={() => onEditSchedule(item)}
                                      onDelete={() => onDeleteSchedule(item.id)}
                                    />
                                  ))}
                                  {items.length === 0 && adminUser && (
                                    <button
                                      className="add-slot-btn"
                                      onClick={() =>
                                        handleSlotAdd(selectedDay, p.id, {
                                          yearId: sec.yearId,
                                          sectionId: sec.id,
                                        })
                                      }
                                    >
                                      <Plus size={14} />
                                      <span>Section</span>
                                    </button>
                                  )}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))
                    )}
                  </>
                )}

                {/* 2. VIEW MODE: ROOM */}
                {viewMode === 'ROOM' &&
                  (rooms.length === 0 ? (
                    <tr className="grid-row">
                      <td colSpan={1 + standardPeriods.length} className="td-empty-table-notice">
                        No rooms registered yet. Navigate to Admin Hub to register lecture halls and computer labs.
                      </td>
                    </tr>
                  ) : (
                    rooms.map((room) => (
                      <tr key={room.id} className="grid-row">
                        <td className="td-entity-header">
                          <div className="entity-title font-bold flex-center-gap">
                            <Building size={16} className="text-sky" />
                            <span>{room.code}</span>
                          </div>
                          <div className="entity-subtitle">
                            {room.name} • {room.building}{room.floor !== undefined ? ` • Floor ${room.floor}` : ''} (Cap: {room.capacity})
                          </div>
                        </td>
                        {standardPeriods.map((p) => {
                          const items = filteredSchedules.filter(
                            (s) =>
                              s.dayOfWeek === selectedDay &&
                              s.roomId === room.id &&
                              timesOverlap(s.startTime, s.endTime, p.startTime, p.endTime)
                          );
                          return (
                            <td key={p.id} className="td-slot">
                              <div className="slot-container">
                                {items.map((item) => (
                                  <ScheduleCard
                                    key={item.id}
                                    schedule={item}
                                    adminUser={adminUser}
                                    onEdit={() => onEditSchedule(item)}
                                    onDelete={() => onDeleteSchedule(item.id)}
                                  />
                                ))}
                                {items.length === 0 && adminUser && (
                                  <button
                                    className="add-slot-btn"
                                    onClick={() =>
                                      handleSlotAdd(selectedDay, p.id, { roomId: room.id })
                                    }
                                  >
                                    <Plus size={14} />
                                    <span>Assign</span>
                                  </button>
                                )}
                                {items.length === 0 && !adminUser && (
                                  <div className="empty-slot-label free-room">Free Room</div>
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  ))}

                {/* 3. VIEW MODE: PROFESSOR */}
                {viewMode === 'PROFESSOR' &&
                  (professors.length === 0 ? (
                    <tr className="grid-row">
                      <td colSpan={1 + standardPeriods.length} className="td-empty-table-notice">
                        No faculty members registered yet. Navigate to Admin Hub to register professors and teaching assistants.
                      </td>
                    </tr>
                  ) : (
                    professors.map((prof) => {
                      const isOffCampus = Boolean(
                        prof.availableDays &&
                        prof.availableDays.length > 0 &&
                        !prof.availableDays.includes(selectedDay)
                      );
                      const allowedDaysStr = prof.availableDays
                        ? prof.availableDays.map((d) => DAYS.find((x) => x.id === d)?.short || d).join(', ')
                        : '';

                      return (
                        <tr key={prof.id} className={`grid-row ${isOffCampus ? 'row-off-campus' : ''}`}>
                          <td className="td-entity-header">
                            <div className="entity-title font-bold flex-center-gap">
                              <User size={16} className={isOffCampus ? 'text-muted' : 'text-indigo'} />
                              <span>{prof.title} {prof.name}</span>
                              {isOffCampus && (
                                <span className="off-campus-badge" title={`Off-Campus: Attends ${allowedDaysStr} only`}>
                                  Off-Campus
                                </span>
                              )}
                            </div>
                            <div className="entity-subtitle">
                              {prof.department} • {prof.office || 'Campus'}
                              {prof.availableDays && prof.availableDays.length > 0 && prof.availableDays.length < 7 && (
                                <span className="prof-row-days-note" title="Assigned campus attendance days">
                                  <Calendar size={11} style={{ display: 'inline', marginRight: '3px', verticalAlign: 'middle' }} />
                                  <span>Days: {allowedDaysStr}</span>
                                </span>
                              )}
                            </div>
                          </td>
                          {standardPeriods.map((p) => {
                            const items = filteredSchedules.filter(
                              (s) =>
                                s.dayOfWeek === selectedDay &&
                                s.professorId === prof.id &&
                                timesOverlap(s.startTime, s.endTime, p.startTime, p.endTime)
                            );
                            return (
                              <td key={p.id} className={`td-slot ${isOffCampus ? 'td-slot-off-campus' : ''}`}>
                                <div className="slot-container">
                                  {items.map((item) => (
                                    <ScheduleCard
                                      key={item.id}
                                      schedule={item}
                                      adminUser={adminUser}
                                      onEdit={() => onEditSchedule(item)}
                                      onDelete={() => onDeleteSchedule(item.id)}
                                    />
                                  ))}
                                  {items.length === 0 && (
                                    isOffCampus ? (
                                      <div className="slot-off-campus-cell">
                                        <span>Not Attending</span>
                                        {adminUser && (
                                          <button
                                            className="add-slot-btn-subtle"
                                            title="Try scheduling (will prompt attendance restriction)"
                                            onClick={() => handleSlotAdd(selectedDay, p.id)}
                                          >
                                            <Plus size={12} />
                                          </button>
                                        )}
                                      </div>
                                    ) : adminUser ? (
                                      <button
                                        className="add-slot-btn"
                                        onClick={() => handleSlotAdd(selectedDay, p.id)}
                                      >
                                        <Plus size={14} />
                                        <span>Assign</span>
                                      </button>
                                    ) : null
                                  )}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

// Subcomponent: Individual Schedule Card
interface ScheduleCardProps {
  schedule: ScheduleWithDetails;
  adminUser: AdminUser | null;
  onEdit: () => void;
  onDelete: () => void;
}

const ScheduleCard: FC<ScheduleCardProps> = ({ schedule, adminUser, onEdit, onDelete }) => {
  const isLecture = schedule.sessionType === 'LECTURE';

  return (
    <div
      className={`schedule-card ${isLecture ? 'card-lecture' : 'card-section'}`}
      style={{ borderLeftColor: schedule.courseColor || '#3b82f6' }}
    >
      <div className="card-top-row">
        <span className={`session-badge ${isLecture ? 'badge-lecture' : 'badge-section'}`}>
          {isLecture
            ? schedule.sectionName
              ? `Lec (${schedule.sectionName})`
              : 'Lecture'
            : schedule.sectionName || 'Section'}
        </span>
        <span className="card-time">
          {schedule.startTime} - {schedule.endTime}
        </span>
      </div>

      <div className="card-course-code">{schedule.courseCode}</div>
      <div className="card-course-name" title={schedule.courseName}>
        {schedule.courseName}
      </div>

      <div className="card-meta">
        <div
          className="meta-pill room-pill"
          title={`Capacity: ${schedule.roomCapacity} • ${schedule.building}${
            schedule.roomFloor !== undefined || schedule.floor !== undefined
              ? ` • Floor ${schedule.roomFloor ?? schedule.floor}`
              : ''
          }`}
        >
          <Building size={12} />
          <span>{schedule.roomCode}</span>
          {(schedule.roomFloor !== undefined || schedule.floor !== undefined) && (
            <span className="room-floor-pill">
              {(schedule.roomFloor ?? schedule.floor) === 0
                ? 'G'
                : `Fl. ${schedule.roomFloor ?? schedule.floor}`}
            </span>
          )}
        </div>
        <div className="meta-pill prof-pill" title={schedule.professorName}>
          <User size={12} />
          <span>{schedule.professorTitle} {schedule.professorName.split(' ').slice(-1)[0]}</span>
        </div>
      </div>

      {schedule.notes && (
        <div className="card-notes" title={schedule.notes}>
          <Info size={11} className="shrink-0" />
          <span>{schedule.notes}</span>
        </div>
      )}

      {adminUser && (
        <div className="card-actions">
          <button className="card-action-btn edit-btn" onClick={onEdit} title="Edit Session">
            <Edit2 size={12} />
          </button>
          <button
            className="card-action-btn delete-btn"
            onClick={() => {
              if (window.confirm(`Delete ${schedule.courseCode} (${schedule.sessionType}) from room ${schedule.roomCode}?`)) {
                onDelete();
              }
            }}
            title="Delete Session"
          >
            <Trash2 size={12} />
          </button>
        </div>
      )}
    </div>
  );
};
