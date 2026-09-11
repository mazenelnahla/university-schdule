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

interface ScheduleDialogProps {
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
  editingSchedule,
}) => {
  const [dayOfWeek, setDayOfWeek] = useState<number>(initialDayOfWeek);
  const [selectedPeriodId, setSelectedPeriodId] = useState<number | 'CUSTOM'>(
    initialPeriodId || (standardPeriods[0]?.id ?? 1)
  );
  const [startTime, setStartTime] = useState<string>(standardPeriods[0]?.startTime || '08:30');
  const [endTime, setEndTime] = useState<string>(standardPeriods[0]?.endTime || '10:00');
  const [sessionType, setSessionType] = useState<SessionType>('LECTURE');
  const [academicYearId, setAcademicYearId] = useState<number>(initialYearId || years[0]?.id || 1);
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
          if (occMap.has(roomId)) {
            const firstAvailableRoom = rooms.find((r) => !occMap.has(r.id));
            if (firstAvailableRoom) {
              setRoomId(firstAvailableRoom.id);
            }
          }

          // If currently selected professorId is busy, auto-select first available professor
          if (busyMap.has(professorId)) {
            const firstAvailableProf = professors.find((p) => !busyMap.has(p.id));
            if (firstAvailableProf) {
              setProfessorId(firstAvailableProf.id);
            }
          }
        }
      } catch (err) {
        console.error('Error fetching occupancy', err);
      }
    };

    loadOccupancy();
    return () => {
      isMounted = false;
    };
  }, [isOpen, dayOfWeek, startTime, endTime, editingSchedule, rooms, professors]);

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

      // Check if matches standard period
      const matchedPeriod = standardPeriods.find(
        (p) => p.startTime === editingSchedule.startTime && p.endTime === editingSchedule.endTime
      );
      setSelectedPeriodId(matchedPeriod ? matchedPeriod.id : 'CUSTOM');
    } else {
      if (initialDayOfWeek !== undefined) setDayOfWeek(initialDayOfWeek);
      if (initialYearId) setAcademicYearId(initialYearId);
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
  }, [editingSchedule, initialDayOfWeek, initialPeriodId, initialYearId, standardPeriods]);

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

  // Filter sections for currently selected year
  const availableSections = useMemo(() => {
    return sections.filter((s) => s.yearId === academicYearId);
  }, [sections, academicYearId]);

  // Filter courses for currently selected year
  const availableCourses = useMemo(() => {
    const matched = courses.filter((c) => c.yearId === academicYearId);
    return matched.length > 0 ? matched : courses;
  }, [courses, academicYearId]);

  // Auto-select first available course when year changes
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
          sectionId: sessionType === 'SECTION' && sectionId !== '' ? Number(sectionId) : null,
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
        sectionId: sessionType === 'SECTION' && sectionId !== '' ? Number(sectionId) : null,
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

          {/* Section (Only if Section type) */}
          <div className="form-group">
            <label className="form-label">
              Section / Group {sessionType === 'LECTURE' ? '(Disabled for Lectures)' : '*'}
            </label>
            <select
              className="form-select"
              value={sectionId}
              disabled={sessionType === 'LECTURE'}
              onChange={(e) => setSectionId(e.target.value ? Number(e.target.value) : '')}
              required={sessionType === 'SECTION'}
            >
              <option value="">
                {sessionType === 'LECTURE' ? 'All Sections (Whole Batch)' : '-- Select Section --'}
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
              className="form-select"
              value={courseId}
              onChange={(e) => setCourseId(Number(e.target.value))}
            >
              {availableCourses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} - {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Professor / TA */}
          <div className="form-group">
            <label className="form-label">
              <User size={14} />
              <span>Professor / Instructor</span>
            </label>
            <select
              className="form-select"
              value={professorId}
              onChange={(e) => setProfessorId(Number(e.target.value))}
            >
              <optgroup label="Available Faculty">
                {professors
                  .filter((p) => !busyProfessors.has(p.id))
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title} {p.name} ({p.department})
                    </option>
                  ))}
              </optgroup>
              {professors.some((p) => busyProfessors.has(p.id)) && (
                <optgroup label="⛔ Busy Instructors (Double-Booking Prevented)">
                  {professors
                    .filter((p) => busyProfessors.has(p.id))
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
