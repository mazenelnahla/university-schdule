import { useState, useEffect, useMemo, type FormEvent, type FC } from 'react';
import {
  X,
  Clock,
  Calendar,
  Building,
  User,
  BookOpen,
  AlertTriangle,
  CheckCircle,
  Users,
  Layers,
  Lock,
  Check,
  GraduationCap,
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
  SessionType,
  ConflictCheckResult,
} from '../db/schema';
import {
  checkScheduleConflicts,
  addSchedule,
  updateSchedule,
  getOccupiedRooms,
  getBusyProfessors,
  getUnavailableProfessorsOnDay,
} from '../db/scheduleService';

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

export interface ScheduleDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  years: AcademicYear[];
  programs?: Program[];
  sections: Section[];
  professors: Professor[];
  rooms: Room[];
  courses: Course[];
  standardPeriods: StandardPeriod[];
  initialDayOfWeek?: number;
  initialPeriodId?: number;
  initialYearId?: number;
  initialProgramId?: number | 'ALL';
  editingSchedule?: ScheduleWithDetails | null;
}

export const ScheduleDialog: FC<ScheduleDialogProps> = ({
  isOpen,
  onClose,
  onSuccess,
  years,
  programs = [],
  sections,
  professors,
  rooms,
  courses,
  standardPeriods,
  initialDayOfWeek = 0,
  initialPeriodId,
  initialYearId,
  initialProgramId,
  editingSchedule,
}) => {
  const [dayOfWeek, setDayOfWeek] = useState<number>(initialDayOfWeek);
  const [selectedPeriodId, setSelectedPeriodId] = useState<number | 'CUSTOM'>(
    initialPeriodId || (standardPeriods[0]?.id ?? 1)
  );
  const [startTime, setStartTime] = useState<string>(standardPeriods[0]?.startTime || '10:00');
  const [endTime, setEndTime] = useState<string>(standardPeriods[0]?.endTime || '11:15');
  const [sessionType, setSessionType] = useState<SessionType>('LECTURE');
  const [academicYearId, setAcademicYearId] = useState<number>(initialYearId || years[0]?.id || 1);
  const [selectedProgramId, setSelectedProgramId] = useState<number | 'ALL'>(
    initialProgramId ?? (editingSchedule?.programId || editingSchedule?.courseProgramId || 'ALL')
  );
  const [sectionId, setSectionId] = useState<number | ''>('');
  const [courseId, setCourseId] = useState<number>(courses[0]?.id || 1);
  const [professorId, setProfessorId] = useState<number>(professors[0]?.id || 1);
  const [roomId, setRoomId] = useState<number>(rooms[0]?.id || 1);
  const [notes, setNotes] = useState<string>('');

  const [conflictResult, setConflictResult] = useState<ConflictCheckResult>({ hasConflict: false });
  const [occupiedRooms, setOccupiedRooms] = useState<Map<number, ScheduleWithDetails>>(new Map());
  const [busyProfessors, setBusyProfessors] = useState<Map<number, ScheduleWithDetails>>(new Map());
  const [isCheckingConflict, setIsCheckingConflict] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Professors who do not attend campus on this day
  const unavailableProfessors = useMemo(() => {
    return getUnavailableProfessorsOnDay(dayOfWeek, professors);
  }, [dayOfWeek, professors]);

  // Dynamically load occupied rooms and busy professors whenever day, time, or editing id changes
  useEffect(() => {
    if (!isOpen || !startTime || !endTime) return;
    let isMounted = true;

    const loadOccupancy = async () => {
      try {
        const [occMap, busyMap] = await Promise.all([
          getOccupiedRooms(dayOfWeek, startTime, endTime, editingSchedule?.id),
          getBusyProfessors(dayOfWeek, startTime, endTime, editingSchedule?.id),
        ]);

        if (isMounted) {
          setOccupiedRooms(occMap);
          setBusyProfessors(busyMap);

          // If the currently selected roomId is in occupiedRooms, auto-select first available room
          setRoomId((prevRoomId) => {
            if (occMap.has(prevRoomId)) {
              const firstAvailable = rooms.find((r) => !occMap.has(r.id));
              return firstAvailable ? firstAvailable.id : prevRoomId;
            }
            return prevRoomId;
          });

          // If currently selected professorId is busy or not attending today, auto-select first available professor
          setProfessorId((prevProfId) => {
            if (busyMap.has(prevProfId) || unavailableProfessors.has(prevProfId)) {
              const firstAvailable = professors.find(
                (p) => !busyMap.has(p.id) && !unavailableProfessors.has(p.id)
              );
              return firstAvailable ? firstAvailable.id : prevProfId;
            }
            return prevProfId;
          });
        }
      } catch (err) {
        console.error('Error fetching occupancy', err);
      }
    };

    loadOccupancy();
    return () => {
      isMounted = false;
    };
  }, [isOpen, dayOfWeek, startTime, endTime, editingSchedule, rooms, professors, unavailableProfessors]);

  // Sync with editing item or initial props
  useEffect(() => {
    if (editingSchedule) {
      setDayOfWeek(editingSchedule.dayOfWeek);
      setSessionType(editingSchedule.sessionType);
      setAcademicYearId(editingSchedule.academicYearId);
      setSectionId(editingSchedule.sectionId ?? '');
      setCourseId(editingSchedule.courseId);
      setProfessorId(editingSchedule.professorId);
      setRoomId(editingSchedule.roomId);
      setStartTime(editingSchedule.startTime);
      setEndTime(editingSchedule.endTime);
      setNotes(editingSchedule.notes || '');
      setSelectedProgramId(editingSchedule.programId || editingSchedule.courseProgramId || 'ALL');

      // Check if matches standard period
      const matchedPeriod = standardPeriods.find(
        (p) => p.startTime === editingSchedule.startTime && p.endTime === editingSchedule.endTime
      );
      setSelectedPeriodId(matchedPeriod ? matchedPeriod.id : 'CUSTOM');
    } else {
      if (initialDayOfWeek !== undefined) setDayOfWeek(initialDayOfWeek);
      if (initialYearId) setAcademicYearId(initialYearId);
      if (initialProgramId !== undefined) setSelectedProgramId(initialProgramId);
      if (initialPeriodId) {
        const p = standardPeriods.find((x) => x.id === initialPeriodId);
        if (p) {
          setSelectedPeriodId(p.id);
          setStartTime(p.startTime);
          setEndTime(p.endTime);
        }
      }
      setNotes('');
    }
  }, [editingSchedule, initialDayOfWeek, initialPeriodId, initialYearId, initialProgramId, standardPeriods]);

  // When standard period changes, update start/end times
  const handlePeriodChange = (val: string) => {
    if (val === 'CUSTOM') {
      setSelectedPeriodId('CUSTOM');
    } else {
      const pid = Number(val);
      setSelectedPeriodId(pid);
      const found = standardPeriods.find((p) => p.id === pid);
      if (found) {
        setStartTime(found.startTime);
        setEndTime(found.endTime);
      }
    }
  };

  const handleProgramChange = (progId: number | 'ALL') => {
    setSelectedProgramId(progId);
    if (progId !== 'ALL' && sectionId) {
      const curSec = sections.find((s) => s.id === sectionId);
      if (curSec && curSec.programId && curSec.programId !== progId) {
        setSectionId('');
      }
    }
  };

  const handleSectionChange = (val: string) => {
    const newSecId = val ? Number(val) : '';
    setSectionId(newSecId);
    if (newSecId) {
      const curSec = sections.find((s) => s.id === newSecId);
      if (curSec?.programId) {
        setSelectedProgramId(curSec.programId);
      }
    }
  };

  // Filter sections for currently selected year and program
  const availableSections = useMemo(() => {
    const yearSecs = sections.filter((s) => s.yearId === academicYearId);
    if (selectedProgramId === 'ALL') return yearSecs;
    return yearSecs.filter((s) => s.programId === selectedProgramId || !s.programId);
  }, [sections, academicYearId, selectedProgramId]);

  // Filter courses for currently selected year and program
  const availableCourses = useMemo(() => {
    let matched = courses.filter((c) => c.yearId === academicYearId);
    if (matched.length === 0) matched = courses;

    if (selectedProgramId !== 'ALL') {
      // Only show subjects related to this program (assigned to this program OR common to all programs)
      const progMatched = matched.filter((c) => c.programId === selectedProgramId || !c.programId);
      return progMatched.length > 0 ? progMatched : matched;
    }
    return matched;
  }, [courses, academicYearId, selectedProgramId]);

  // Auto-select first available course when year or program changes
  useEffect(() => {
    if (availableCourses.length > 0 && !availableCourses.some((c) => c.id === courseId)) {
      setCourseId(availableCourses[0].id);
    }
  }, [availableCourses, courseId]);

  // Auto-select first available professor if current is invalid
  useEffect(() => {
    if (professors.length > 0 && !professors.some((p) => p.id === professorId)) {
      setProfessorId(professors[0].id);
    }
  }, [professors, professorId]);

  // Auto-select first available room if current is invalid
  useEffect(() => {
    if (rooms.length > 0 && !rooms.some((r) => r.id === roomId)) {
      setRoomId(rooms[0].id);
    }
  }, [rooms, roomId]);

  // Live Conflict Detection whenever room, time, day, prof, or year changes
  useEffect(() => {
    if (!isOpen || !roomId || !startTime || !endTime) return;

    let isMounted = true;
    setIsCheckingConflict(true);

    const check = async () => {
      try {
        const res = await checkScheduleConflicts({
          scheduleId: editingSchedule?.id,
          academicYearId,
          sectionId: sectionId !== '' ? Number(sectionId) : null,
          courseId,
          professorId,
          roomId,
          dayOfWeek,
          startTime,
          endTime,
          sessionType,
        });

        if (isMounted) {
          setConflictResult(res);
          setIsCheckingConflict(false);
        }
      } catch (err) {
        console.error('Conflict check failed', err);
        if (isMounted) setIsCheckingConflict(false);
      }
    };

    const timer = setTimeout(check, 150);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [
    isOpen,
    roomId,
    startTime,
    endTime,
    dayOfWeek,
    professorId,
    academicYearId,
    sectionId,
    sessionType,
    courseId,
    editingSchedule,
  ]);

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!courses.length || !professors.length || !rooms.length) {
      setErrorMessage('Please register courses, professors, and rooms in the Admin Hub before scheduling.');
      return;
    }

    if (conflictResult.hasConflict) {
      setErrorMessage(conflictResult.message || 'Cannot schedule due to room conflict!');
      return;
    }

    if (sessionType === 'SECTION' && (sectionId === '' || sectionId === null)) {
      setErrorMessage('Please select a specific section for section sessions.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        academicYearId,
        sectionId: sectionId !== '' ? Number(sectionId) : null,
        courseId,
        professorId,
        roomId,
        dayOfWeek,
        periodId: typeof selectedPeriodId === 'number' ? selectedPeriodId : null,
        startTime,
        endTime,
        sessionType,
        notes: notes.trim() || undefined,
      };

      if (editingSchedule) {
        const res = await updateSchedule(editingSchedule.id, payload);
        if (!res.success) {
          setErrorMessage(res.conflict?.message || 'Conflict detected');
          setIsSubmitting(false);
          return;
        }
      } else {
        const res = await addSchedule(payload);
        if (!res.success) {
          setErrorMessage(res.conflict?.message || 'Conflict detected');
          setIsSubmitting(false);
          return;
        }
      }

      onSuccess();
      onClose();
    } catch (err) {
      setErrorMessage((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedRoom = rooms.find((r) => r.id === roomId);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card schedule-dialog-card" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-title-wrap">
            <div className="modal-title-icon highlight-glow">
              <Calendar size={20} />
            </div>
            <div>
              <h2 className="modal-title">
                {editingSchedule ? 'Edit Scheduled Session' : 'Schedule Lecture or Section'}
              </h2>
              <p className="modal-subtitle">
                Assign room, professor, and time with real-time conflict prevention
              </p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Live Conflict Alert Banner */}
        {conflictResult.hasConflict && (
          <div className="alert-banner alert-danger conflict-sticky-banner">
            <AlertTriangle size={20} className="shrink-0" />
            <div>
              <div className="font-semibold">
                {conflictResult.conflictType === 'ROOM'
                  ? '⛔ Room Restriction Collision'
                  : conflictResult.conflictType === 'PROFESSOR'
                  ? '⚠️ Professor Double-Booking Conflict'
                  : conflictResult.conflictType === 'PROFESSOR_AVAILABILITY'
                  ? '📅 Professor Attendance Day Restriction'
                  : conflictResult.conflictType === 'COURSE_DEPENDENCY'
                  ? '🔗 Subject Dependency Conflict (GPA System Clash)'
                  : '⚠️ Student Cohort Conflict'}
              </div>
              <div className="text-sm mt-0.5">{conflictResult.message}</div>
            </div>
          </div>
        )}

        {(!courses.length || !professors.length || !rooms.length) ? (
          <div className="alert-banner alert-danger">
            <AlertTriangle size={18} className="shrink-0" />
            <div>
              <div className="font-semibold">Setup Required in Admin Hub</div>
              <div className="text-xs mt-0.5">
                The database is empty. Please register at least one{' '}
                {[
                  !courses.length && 'Course',
                  !professors.length && 'Professor / TA',
                  !rooms.length && 'Room / Hall',
                ]
                  .filter(Boolean)
                  .join(', ')}{' '}
                in the Admin Hub before scheduling sessions.
              </div>
            </div>
          </div>
        ) : !conflictResult.hasConflict && !isCheckingConflict ? (
          <div className="alert-banner alert-success">
            <CheckCircle size={18} className="shrink-0" />
            <span className="text-sm font-medium">
              Room {selectedRoom?.code || ''} and time slot are fully available!
            </span>
          </div>
        ) : null}

        {errorMessage && (
          <div className="alert-banner alert-danger">
            <AlertTriangle size={18} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="modal-body dialog-grid">
          {/* Day of the week */}
          <div className="form-group col-span-2">
            <label className="form-label">Day of the Week</label>
            <div className="day-pill-selector">
              {DAYS_OF_WEEK.map((d) => (
                <button
                  type="button"
                  key={d.value}
                  className={`day-pill ${dayOfWeek === d.value ? 'active' : ''}`}
                  onClick={() => setDayOfWeek(d.value)}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* Period Selector */}
          <div className="form-group">
            <label className="form-label">
              <Clock size={14} />
              <span>Standard University Period</span>
            </label>
            <select
              className="form-select"
              value={selectedPeriodId}
              onChange={(e) => handlePeriodChange(e.target.value)}
            >
              {standardPeriods.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
              <option value="CUSTOM">Custom Time Slot...</option>
            </select>
          </div>

          {/* Time Slot Range */}
          <div className="form-group">
            <label className="form-label">Period Time Slot</label>
            <div className="time-range-inputs">
              <input
                type="time"
                className="form-input"
                value={startTime}
                onChange={(e) => {
                  setStartTime(e.target.value);
                  setSelectedPeriodId('CUSTOM');
                }}
                required
              />
              <span className="time-sep">to</span>
              <input
                type="time"
                className="form-input"
                value={endTime}
                onChange={(e) => {
                  setEndTime(e.target.value);
                  setSelectedPeriodId('CUSTOM');
                }}
                required
              />
            </div>
          </div>

          {/* Session Type */}
          <div className="form-group col-span-2">
            <label className="form-label">Session Type</label>
            <div className="session-type-toggle">
              <button
                type="button"
                className={`type-toggle-btn ${sessionType === 'LECTURE' ? 'active-lecture' : ''}`}
                onClick={() => {
                  setSessionType('LECTURE');
                  setSectionId('');
                }}
              >
                <Users size={16} />
                <div className="text-left">
                  <div className="font-semibold">Lecture (Full Batch)</div>
                  <div className="text-xs opacity-75">All sections of the academic year</div>
                </div>
              </button>

              <button
                type="button"
                className={`type-toggle-btn ${sessionType === 'SECTION' ? 'active-section' : ''}`}
                onClick={() => setSessionType('SECTION')}
              >
                <Layers size={16} />
                <div className="text-left">
                  <div className="font-semibold">Section / Lab (Tutorial)</div>
                  <div className="text-xs opacity-75">Specific lab or discussion group</div>
                </div>
              </button>
            </div>
          </div>

          {/* Academic Year */}
          <div className="form-group">
            <label className="form-label">Academic Year</label>
            <select
              className="form-select"
              value={academicYearId}
              onChange={(e) => setAcademicYearId(Number(e.target.value))}
            >
              {years.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.name}
                </option>
              ))}
            </select>
          </div>

          {/* Academic Department (Program) */}
          {programs && programs.length > 0 && (
            <div className="form-group">
              <div className="flex-between-center mb-1">
                <label className="form-label mb-0 flex-center-gap">
                  <GraduationCap size={14} className="text-amber" />
                  <span>Academic Department (Program)</span>
                </label>
                {selectedProgramId !== 'ALL' && (
                  <button
                    type="button"
                    className="text-btn-subtle"
                    onClick={() => handleProgramChange('ALL')}
                  >
                    Reset (Show All Departments)
                  </button>
                )}
              </div>
              <select
                className="form-select"
                value={selectedProgramId}
                onChange={(e) => handleProgramChange(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
              >
                <option value="ALL">-- All Departments (Common Core & All Programs) --</option>
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} - {p.name}
                  </option>
                ))}
              </select>
              {selectedProgramId !== 'ALL' && (
                <div className="text-xs text-muted mt-1">
                  Filtering subjects: showing only subjects belonging to{' '}
                  <strong>{programs.find((p) => p.id === selectedProgramId)?.name || 'this department'}</strong>{' '}
                  ({availableCourses.length} available)
                </div>
              )}
            </div>
          )}

          {/* Section / Group selector */}
          <div className="form-group">
            <label className="form-label">
              Cohort Group / Section {sessionType === 'LECTURE' ? '(Optional: Leave blank for Whole Cohort)' : '*'}
            </label>
            <select
              className="form-select"
              value={sectionId}
              onChange={(e) => handleSectionChange(e.target.value)}
              required={sessionType === 'SECTION'}
            >
              <option value="">
                {sessionType === 'LECTURE' ? 'Whole Cohort (All Groups Combined)' : '-- Select Section / Group --'}
              </option>
              {programs && programs.length > 0 ? (
                <>
                  {programs.map((prog) => {
                    const progSections = availableSections.filter((s) => s.programId === prog.id);
                    if (progSections.length === 0) return null;
                    return (
                      <optgroup key={prog.id} label={`Program: ${prog.code} - ${prog.name}`}>
                        {progSections.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} (Cap: {s.capacity})
                          </option>
                        ))}
                      </optgroup>
                    );
                  })}
                  {availableSections.some((s) => !s.programId) && (
                    <optgroup label="General / Other Sections">
                      {availableSections
                        .filter((s) => !s.programId)
                        .map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} (Cap: {s.capacity})
                          </option>
                        ))}
                    </optgroup>
                  )}
                </>
              ) : (
                availableSections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} (Cap: {s.capacity})
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Course */}
          <div className="form-group">
            <label className="form-label">
              <BookOpen size={14} />
              <span>Course / Subject</span>
            </label>
            <select
              className={`form-select ${
                conflictResult.conflictType === 'COURSE_DEPENDENCY' ? 'border-danger' : ''
              }`}
              value={courseId}
              onChange={(e) => setCourseId(Number(e.target.value))}
            >
              {availableCourses.map((c) => {
                const prereqCodes =
                  c.prerequisiteIds && c.prerequisiteIds.length > 0
                    ? c.prerequisiteIds.map((pid) => courses.find((x) => x.id === pid)?.code || pid).join(', ')
                    : null;
                const progTag = c.programCode ? `[${c.programCode}]` : '[Common]';
                const secTag = c.hasSections === false ? ' [Lecture Only]' : '';
                return (
                  <option key={c.id} value={c.id}>
                    {c.code} - {c.name} {progTag}{secTag} {prereqCodes ? `[Prereq: ${prereqCodes}]` : ''}
                  </option>
                );
              })}
            </select>
            {(() => {
              const currentCourse = courses.find((c) => c.id === courseId);
              if (currentCourse?.hasSections === false && sessionType === 'SECTION') {
                return (
                  <div className="text-xs text-amber mt-1 flex-center-gap">
                    <AlertTriangle size={12} className="shrink-0 text-amber" />
                    <span>
                      Notice: <strong>{currentCourse.code}</strong> is configured as <strong>Lecture Only</strong> (no tutorial/lab sections).
                    </span>
                  </div>
                );
              }
              if (currentCourse?.prerequisiteIds && currentCourse.prerequisiteIds.length > 0) {
                const prereqNames = currentCourse.prerequisiteIds
                  .map((pid) => courses.find((x) => x.id === pid)?.code || pid)
                  .join(', ');
                return (
                  <div className="text-xs text-secondary mt-1 flex-center-gap">
                    <BookOpen size={12} className="text-emerald shrink-0" />
                    <span>
                      GPA Prerequisites: <strong>{prereqNames}</strong> (Timing overlap restricted)
                    </span>
                  </div>
                );
              }
              return null;
            })()}
          </div>

          {/* Professor / TA */}
          <div className="form-group">
            <label className="form-label">
              <User size={14} />
              <span>Professor / Instructor</span>
            </label>
            <select
              className={`form-select ${
                conflictResult.conflictType === 'PROFESSOR' ||
                conflictResult.conflictType === 'PROFESSOR_AVAILABILITY'
                  ? 'border-danger'
                  : ''
              }`}
              value={professorId}
              onChange={(e) => setProfessorId(Number(e.target.value))}
            >
              <optgroup label="Available Faculty">
                {professors
                  .filter((p) => !busyProfessors.has(p.id) && !unavailableProfessors.has(p.id))
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title} {p.name} ({p.department})
                    </option>
                  ))}
              </optgroup>
              {professors.some((p) => unavailableProfessors.has(p.id)) && (
                <optgroup label={`📅 Off-Campus on ${DAYS_OF_WEEK.find((d) => d.value === dayOfWeek)?.label} (Attendance Restriction)`}>
                  {professors
                    .filter((p) => unavailableProfessors.has(p.id))
                    .map((p) => {
                      const avail = unavailableProfessors.get(p.id);
                      const allowed = avail?.availableDays
                        .map((d) => DAYS_OF_WEEK.find((x) => x.value === d)?.label.slice(0, 3) || d)
                        .join(', ');
                      return (
                        <option key={p.id} value={p.id} disabled={true}>
                          📅 {p.title} {p.name} [OFF-CAMPUS: Attends {allowed} only]
                        </option>
                      );
                    })}
                </optgroup>
              )}
              {professors.some((p) => busyProfessors.has(p.id) && !unavailableProfessors.has(p.id)) && (
                <optgroup label="⛔ Busy Instructors (Double-Booking Prevented)">
                  {professors
                    .filter((p) => busyProfessors.has(p.id) && !unavailableProfessors.has(p.id))
                    .map((p) => {
                      const occ = busyProfessors.get(p.id);
                      return (
                        <option key={p.id} value={p.id} disabled={true}>
                          ⚠️ {p.title} {p.name} [BUSY in {occ?.roomCode} ({occ?.startTime}-{occ?.endTime})]
                        </option>
                      );
                    })}
                </optgroup>
              )}
            </select>
            {unavailableProfessors.has(professorId) && (
              <div className="text-xs text-amber mt-1 flex-center-gap">
                <AlertTriangle size={12} />
                <span>
                  {professors.find((p) => p.id === professorId)?.title}{' '}
                  {professors.find((p) => p.id === professorId)?.name} is not on campus on{' '}
                  {DAYS_OF_WEEK.find((d) => d.value === dayOfWeek)?.label}.
                </span>
              </div>
            )}
          </div>

          {/* Room Selection with Disabled Conflict Rooms */}
          <div className="form-group col-span-2">
            <div className="room-label-row">
              <label className="form-label">
                <Building size={14} />
                <span>Room Assignment (Collision Prevention Restricted)</span>
              </label>
              <div className="room-occupancy-status">
                <span className="occupancy-free-count">
                  {rooms.filter((r) => !occupiedRooms.has(r.id)).length} Available
                </span>
                {occupiedRooms.size > 0 && (
                  <span className="occupancy-busy-count">
                    • {occupiedRooms.size} Occupied (Disabled)
                  </span>
                )}
              </div>
            </div>

            <select
              className={`form-select room-select ${conflictResult.conflictType === 'ROOM' ? 'border-danger' : ''}`}
              value={roomId}
              onChange={(e) => setRoomId(Number(e.target.value))}
            >
              <optgroup label={`✓ Available Rooms (${rooms.filter((r) => !occupiedRooms.has(r.id)).length})`}>
                {rooms
                  .filter((r) => !occupiedRooms.has(r.id))
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.code} - {r.name} [{r.type.replace('_', ' ')}] (Capacity: {r.capacity}, {r.building})
                    </option>
                  ))}
              </optgroup>

              {occupiedRooms.size > 0 && (
                <optgroup label={`⛔ Conflict / Occupied Rooms (${occupiedRooms.size}) — Selection Disabled`}>
                  {rooms
                    .filter((r) => occupiedRooms.has(r.id))
                    .map((r) => {
                      const occ = occupiedRooms.get(r.id);
                      return (
                        <option key={r.id} value={r.id} disabled={true} className="option-disabled-conflict">
                          🚫 {r.code} — [OCCUPIED: {occ?.courseCode} ({occ?.startTime}-{occ?.endTime}) with {occ?.professorTitle} {occ?.professorName}]
                        </option>
                      );
                    })}
                </optgroup>
              )}
            </select>

            {/* Visual Interactive Room Grid Picker */}
            <div className="room-pills-grid-container">
              <div className="room-pills-grid-title">Click room to assign (conflicting rooms disabled):</div>
              <div className="room-pills-grid">
                {rooms.map((r) => {
                  const isOccupied = occupiedRooms.has(r.id);
                  const isSelected = roomId === r.id;
                  const occ = occupiedRooms.get(r.id);

                  return (
                    <button
                      key={r.id}
                      type="button"
                      disabled={isOccupied}
                      onClick={() => setRoomId(r.id)}
                      className={`room-picker-card ${isSelected ? 'selected' : ''} ${
                        isOccupied ? 'disabled-conflict' : 'available'
                      }`}
                      title={
                        isOccupied
                          ? `Disabled: Booked for ${occ?.courseCode} (${occ?.startTime} - ${occ?.endTime})`
                          : `Available: ${r.name} (Cap: ${r.capacity})`
                      }
                    >
                      <div className="room-card-header">
                        <span className="room-card-code">{r.code}</span>
                        {isOccupied ? (
                          <span className="status-badge-occupied">
                            <Lock size={10} />
                            <span>Occupied</span>
                          </span>
                        ) : isSelected ? (
                          <span className="status-badge-selected">
                            <Check size={11} />
                            <span>Selected</span>
                          </span>
                        ) : (
                          <span className="status-badge-free">Available</span>
                        )}
                      </div>
                      <div className="room-card-details">
                        <span className="room-card-name">{r.name}</span>
                        <span className="room-card-cap">Cap: {r.capacity}</span>
                      </div>
                      {isOccupied && occ && (
                        <div className="room-card-conflict-info">
                          <span>{occ.courseCode} ({occ.startTime}-{occ.endTime})</span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="form-group col-span-2">
            <label className="form-label">Session Notes / Instructions (Optional)</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Bring laptops, Quiz scheduled, Practical coding"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Modal Footer */}
          <div className="modal-footer col-span-2">
            <button type="button" className="action-btn secondary-btn" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="action-btn primary-btn highlight-glow"
              disabled={
                conflictResult.hasConflict ||
                isSubmitting ||
                !courses.length ||
                !professors.length ||
                !rooms.length
              }
            >
              {isSubmitting
                ? 'Saving...'
                : editingSchedule
                ? 'Update Schedule'
                : 'Confirm & Schedule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
