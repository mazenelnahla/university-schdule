import { useState, useMemo, type FormEvent, type FC } from 'react';
import {
  User,
  Building,
  BookOpen,
  Layers,
  GraduationCap,
  Trash2,
  Edit2,
  CheckCircle,
  AlertCircle,
  ShieldCheck,
  ArrowLeft,
  Search,
  Filter,
  Calendar,
  RefreshCw,
  Sparkles,
  Users,
  Plus,
  Check,
  X,
} from 'lucide-react';
import type {
  Professor,
  Room,
  Course,
  AcademicYear,
  Section,
  Program,
  RoomType,
  TargetGroup,
  TeachingAssistant,
  TeachingAssignment,
} from '../db/schema';
import {
  addProfessor,
  updateProfessor,
  deleteProfessor,
  addRoom,
  updateRoom,
  deleteRoom,
  addCourse,
  updateCourse,
  deleteCourse,
  updateCourseTargetGroup,
  updateCourseHasSections,
  addSection,
  deleteSection,
  addProgram,
  deleteProgram,
  syncAiCurriculumFromTemplate,
  addTeachingAssistant,
  updateTeachingAssistant,
  deleteTeachingAssistant,
  addTeachingAssignment,
  deleteTeachingAssignment,
} from '../db/scheduleService';

interface AdminHubPageProps {
  professors: Professor[];
  teachingAssistants: TeachingAssistant[];
  teachingAssignments: TeachingAssignment[];
  rooms: Room[];
  courses: Course[];
  years: AcademicYear[];
  sections: Section[];
  programs: Program[];
  onDataChanged: () => void;
  onBackToTimetable: () => void;
  onOpenAutoSchedule?: () => void;
}

export const AdminHubPage: FC<AdminHubPageProps> = ({
  professors,
  teachingAssistants,
  teachingAssignments,
  rooms,
  courses,
  years,
  sections,
  programs,
  onDataChanged,
  onBackToTimetable,
  onOpenAutoSchedule,
}) => {
  const [activeTab, setActiveTab] = useState<'ROOMS' | 'PROFESSORS' | 'TEACHING_ASSISTANTS' | 'ASSIGNMENTS' | 'COURSES' | 'SECTIONS' | 'PROGRAMS'>('ROOMS');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Professors Form State
  const [profName, setProfName] = useState('');
  const [profTitle, setProfTitle] = useState('Prof.');
  const [profDept, setProfDept] = useState('Computer Science');
  const [profEmail, setProfEmail] = useState('');
  const [profPhone, setProfPhone] = useState('');
  const [profOffice, setProfOffice] = useState('');
  const [profAvailableDays, setProfAvailableDays] = useState<number[]>([]);
  const [editingProfId, setEditingProfId] = useState<number | null>(null);
  const [taName, setTaName] = useState('');
  const [taDept, setTaDept] = useState('Computer Science');
  const [taEmail, setTaEmail] = useState('');
  const [taPhone, setTaPhone] = useState('');
  const [taOffice, setTaOffice] = useState('');
  const [taAvailableDays, setTaAvailableDays] = useState<number[]>([]);
  const [editingTaId, setEditingTaId] = useState<number | null>(null);
  const [assignmentFacultyType, setAssignmentFacultyType] = useState<'PROFESSOR' | 'TA'>('PROFESSOR');
  const [assignmentFacultyId, setAssignmentFacultyId] = useState<number | ''>('');
  const [assignmentCourseIds, setAssignmentCourseIds] = useState<number[]>([]);

  // Rooms Form State
  const [roomCode, setRoomCode] = useState('');
  const [roomName, setRoomName] = useState('');
  const [roomType, setRoomType] = useState<RoomType>('LECTURE_HALL');
  const [roomCapacity, setRoomCapacity] = useState(100);
  const [roomBuilding, setRoomBuilding] = useState('Building A - Engineering');
  const [roomFloor, setRoomFloor] = useState(1);
  const [editingRoomId, setEditingRoomId] = useState<number | null>(null);

  // Courses Form State
  const [courseCode, setCourseCode] = useState('');
  const [courseName, setCourseName] = useState('');
  const [courseCredits, setCourseCredits] = useState(3);
  const [courseYearId, setCourseYearId] = useState<number>(years[0]?.id || 1);
  const [courseProgramIds, setCourseProgramIds] = useState<number[]>([]);
  const [courseColor, setCourseColor] = useState('#3b82f6');
  const [coursePrerequisites, setCoursePrerequisites] = useState<number[]>([]);
  const [courseSemester, setCourseSemester] = useState<1 | 2>(1);
  const [courseTargetGroup, setCourseTargetGroup] = useState<TargetGroup>('ALL');
  const [courseHasSections, setCourseHasSections] = useState<boolean>(true);
  const [editingCourseId, setEditingCourseId] = useState<number | null>(null);
  const [courseProgramFilter, setCourseProgramFilter] = useState<number | 'ALL' | 'BASIC_SCIENCES'>('ALL');
  const [courseSemesterFilter, setCourseSemesterFilter] = useState<'ALL' | 1 | 2>('ALL');
  const [courseTargetGroupFilter, setCourseTargetGroupFilter] = useState<'ALL' | 'GROUP_A' | 'GROUP_B'>('ALL');
  const [courseSectionsFilter, setCourseSectionsFilter] = useState<'ALL' | 'HAS_SECTIONS' | 'NO_SECTIONS'>('ALL');
  const [courseSortBy, setCourseSortBy] = useState<'YEAR_SEM' | 'PROGRAM' | 'CODE' | 'NAME'>('YEAR_SEM');

  // Sections Form State
  const [secYearId, setSecYearId] = useState<number>(years[0]?.id || 1);
  const [secProgramId, setSecProgramId] = useState<number | ''>(programs[0]?.id || '');
  const [secName, setSecName] = useState('');
  const [secCapacity, setSecCapacity] = useState(30);

  // Programs Form State
  const [progCode, setProgCode] = useState('');
  const [progName, setProgName] = useState('');

  const showStatus = (text: string, type: 'success' | 'error' = 'success') => {
    setStatusMessage({ type, text });
    setTimeout(() => setStatusMessage(null), 3500);
  };

  const isBasicSciencesCourse = (c: Course) =>
    !c.programId ||
    c.department === 'Basic Sciences' ||
    c.yearId === 5 ||
    (c.code && c.code.startsWith('BSC'));
  const isPreparatoryYear = (yearId: number) =>
    yearId === 5 || /prep/i.test(years.find((year) => year.id === yearId)?.name || '');

  // Filtered lists
  const filteredRooms = useMemo(() => {
    if (!searchQuery) return rooms;
    const q = searchQuery.toLowerCase();
    return rooms.filter((r) => r.code.toLowerCase().includes(q) || r.name.toLowerCase().includes(q) || r.building.toLowerCase().includes(q));
  }, [rooms, searchQuery]);

  const filteredProfessors = useMemo(() => {
    if (!searchQuery) return professors;
    const q = searchQuery.toLowerCase();
    return professors.filter((p) => p.name.toLowerCase().includes(q) || p.department.toLowerCase().includes(q) || p.email.toLowerCase().includes(q));
  }, [professors, searchQuery]);

  const filteredTeachingAssistants = useMemo(() => {
    if (!searchQuery) return teachingAssistants;
    const q = searchQuery.toLowerCase();
    return teachingAssistants.filter((assistant) =>
      assistant.name.toLowerCase().includes(q) ||
      assistant.department.toLowerCase().includes(q) ||
      assistant.email.toLowerCase().includes(q)
    );
  }, [teachingAssistants, searchQuery]);

  const filteredCourses = useMemo(() => {
    let result = [...courses];
    if (courseProgramFilter === 'BASIC_SCIENCES') {
      result = result.filter(isBasicSciencesCourse);
    } else if (courseProgramFilter !== 'ALL') {
      result = result.filter((c) => c.programIds?.includes(courseProgramFilter) || c.programId === courseProgramFilter);
    }
    if (courseSemesterFilter !== 'ALL') {
      result = result.filter((c) => (c.semester || 1) === courseSemesterFilter);
    }
    if (courseTargetGroupFilter !== 'ALL') {
      result = result.filter((c) => (c.targetGroup || 'ALL') === courseTargetGroupFilter);
    }
    if (courseSectionsFilter === 'HAS_SECTIONS') {
      result = result.filter((c) => c.hasSections !== false);
    } else if (courseSectionsFilter === 'NO_SECTIONS') {
      result = result.filter((c) => c.hasSections === false);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.code.toLowerCase().includes(q) ||
          c.name.toLowerCase().includes(q) ||
          c.department.toLowerCase().includes(q) ||
          (c.programCode && c.programCode.toLowerCase().includes(q))
      );
    }

    // Apply Sorting
    return result.sort((a, b) => {
      if (courseSortBy === 'PROGRAM') {
        const progA = isBasicSciencesCourse(a) ? '0_Basic Sciences' : a.programCode || a.department;
        const progB = isBasicSciencesCourse(b) ? '0_Basic Sciences' : b.programCode || b.department;
        const comp = progA.localeCompare(progB);
        if (comp !== 0) return comp;
        return (a.semester || 1) - (b.semester || 1) || a.code.localeCompare(b.code);
      }
      if (courseSortBy === 'CODE') {
        return a.code.localeCompare(b.code);
      }
      if (courseSortBy === 'NAME') {
        return a.name.localeCompare(b.name);
      }
      // Default 'YEAR_SEM': Prep Year 5 (Level 0) first, then Year 1..4, then Semester 1 & 2, then Code
      const rankYear = (yId: number | undefined) => (yId === 5 ? 0 : (yId || 99));
      const diffYear = rankYear(a.yearId) - rankYear(b.yearId);
      if (diffYear !== 0) return diffYear;
      const diffSem = (a.semester || 1) - (b.semester || 1);
      if (diffSem !== 0) return diffSem;
      return a.code.localeCompare(b.code);
    });
  }, [
    courses,
    searchQuery,
    courseProgramFilter,
    courseSemesterFilter,
    courseTargetGroupFilter,
    courseSectionsFilter,
    courseSortBy,
  ]);

  const visibleAssignments = useMemo(() => {
    if (!searchQuery) return teachingAssignments;
    const query = searchQuery.toLowerCase();
    return teachingAssignments.filter((assignment) =>
      assignment.courseCode.toLowerCase().includes(query) ||
      assignment.courseName.toLowerCase().includes(query) ||
      (assignment.professorName || assignment.teachingAssistantName || '').toLowerCase().includes(query)
    );
  }, [teachingAssignments, searchQuery]);

  const filteredSections = useMemo(() => {
    if (!searchQuery) return sections;
    const q = searchQuery.toLowerCase();
    return sections.filter((s) => s.name.toLowerCase().includes(q) || (s.programName && s.programName.toLowerCase().includes(q)));
  }, [sections, searchQuery]);

  const filteredPrograms = useMemo(() => {
    if (!searchQuery) return programs;
    const q = searchQuery.toLowerCase();
    return programs.filter((p) => p.code.toLowerCase().includes(q) || p.name.toLowerCase().includes(q) || p.department.toLowerCase().includes(q));
  }, [programs, searchQuery]);

  // PROGRAM / DEPARTMENT HANDLERS
  const handleSaveProgram = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const deptName = progName.trim();
      await addProgram({
        code: progCode.trim().toUpperCase(),
        name: deptName,
        department: deptName, // In this system, the Academic Department name is the program name
      });
      showStatus('Academic Department / Program added successfully!');
      setProgCode('');
      setProgName('');
      onDataChanged();
    } catch (err) {
      showStatus((err as Error).message, 'error');
    }
  };

  const handleDeleteProgram = async (id: number) => {
    if (!window.confirm('Delete this degree program? Sections linked to it will become unassigned.')) return;
    try {
      await deleteProgram(id);
      showStatus('Program deleted.');
      onDataChanged();
    } catch (err) {
      showStatus((err as Error).message, 'error');
    }
  };

  // PROFESSOR HANDLERS
  const handleSaveProfessor = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const daysToSave =
        profAvailableDays.length > 0 && profAvailableDays.length < 7
          ? [...profAvailableDays].sort((a, b) => a - b)
          : undefined;

      if (editingProfId) {
        await updateProfessor(editingProfId, {
          name: profName.trim(),
          title: profTitle,
          department: profDept.trim(),
          email: profEmail.trim(),
          phone: profPhone.trim() || undefined,
          office: profOffice.trim() || undefined,
          availableDays: daysToSave,
        });
        showStatus('Professor updated successfully!');
      } else {
        await addProfessor({
          name: profName.trim(),
          title: profTitle,
          department: profDept.trim(),
          email: profEmail.trim(),
          phone: profPhone.trim() || undefined,
          office: profOffice.trim() || undefined,
          availableDays: daysToSave,
        });
        showStatus('Professor added successfully!');
      }
      setEditingProfId(null);
      setProfName('');
      setProfEmail('');
      setProfPhone('');
      setProfOffice('');
      setProfAvailableDays([]);
      onDataChanged();
    } catch (err) {
      showStatus((err as Error).message, 'error');
    }
  };

  const handleEditProf = (p: Professor) => {
    setEditingProfId(p.id);
    setProfName(p.name);
    setProfTitle(p.title);
    setProfDept(p.department);
    setProfEmail(p.email);
    setProfPhone(p.phone || '');
    setProfOffice(p.office || '');
    setProfAvailableDays(p.availableDays && p.availableDays.length > 0 ? [...p.availableDays] : []);
  };

  const handleDeleteProf = async (id: number) => {
    if (!window.confirm('Delete this faculty member? Their scheduled lectures will also be deleted.')) return;
    try {
      await deleteProfessor(id);
      showStatus('Professor deleted.');
      onDataChanged();
    } catch (err) {
      showStatus((err as Error).message, 'error');
    }
  };

  const handleSaveTeachingAssistant = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const availableDays = taAvailableDays.length > 0 && taAvailableDays.length < 7
        ? [...taAvailableDays].sort((a, b) => a - b)
        : undefined;
      const assistant = {
        name: taName.trim(),
        department: taDept.trim(),
        email: taEmail.trim(),
        phone: taPhone.trim() || undefined,
        office: taOffice.trim() || undefined,
        availableDays,
      };
      if (editingTaId) {
        await updateTeachingAssistant(editingTaId, assistant);
        showStatus('Teaching assistant updated successfully!');
      } else {
        await addTeachingAssistant(assistant);
        showStatus('Teaching assistant added successfully!');
      }
      setEditingTaId(null);
      setTaName('');
      setTaEmail('');
      setTaPhone('');
      setTaOffice('');
      setTaAvailableDays([]);
      onDataChanged();
    } catch (err) {
      showStatus((err as Error).message, 'error');
    }
  };

  const handleEditTeachingAssistant = (assistant: TeachingAssistant) => {
    setEditingTaId(assistant.id);
    setTaName(assistant.name);
    setTaDept(assistant.department);
    setTaEmail(assistant.email);
    setTaPhone(assistant.phone || '');
    setTaOffice(assistant.office || '');
    setTaAvailableDays(assistant.availableDays || []);
  };

  const handleDeleteTeachingAssistant = async (id: number) => {
    if (!window.confirm('Delete this teaching assistant?')) return;
    try {
      await deleteTeachingAssistant(id);
      showStatus('Teaching assistant deleted.');
      onDataChanged();
    } catch (err) {
      showStatus((err as Error).message, 'error');
    }
  };

  const handleAssignCourses = async (e: FormEvent) => {
    e.preventDefault();
    if (!assignmentFacultyId || assignmentCourseIds.length === 0) {
      showStatus('Select one faculty member and at least one subject.', 'error');
      return;
    }
    try {
      const existing = new Set(
        teachingAssignments
          .filter((assignment) =>
            assignmentFacultyType === 'PROFESSOR'
              ? assignment.professorId === assignmentFacultyId
              : assignment.teachingAssistantId === assignmentFacultyId
          )
          .map((assignment) => assignment.courseId)
      );
      let added = 0;
      for (const courseId of assignmentCourseIds) {
        if (existing.has(courseId)) continue;
        await addTeachingAssignment({
          courseId,
          ...(assignmentFacultyType === 'PROFESSOR'
            ? { professorId: Number(assignmentFacultyId) }
            : { teachingAssistantId: Number(assignmentFacultyId) }),
        });
        added += 1;
      }
      setAssignmentCourseIds([]);
      showStatus(added ? `${added} subject assignment${added === 1 ? '' : 's'} added.` : 'All selected subjects were already assigned.');
      onDataChanged();
    } catch (err) {
      showStatus((err as Error).message, 'error');
    }
  };

  const handleDeleteAssignment = async (id: number) => {
    if (!window.confirm('Remove this subject assignment?')) return;
    try {
      await deleteTeachingAssignment(id);
      showStatus('Subject assignment removed.');
      onDataChanged();
    } catch (err) {
      showStatus((err as Error).message, 'error');
    }
  };

  // ROOM HANDLERS
  const handleSaveRoom = async (e: FormEvent) => {
    e.preventDefault();
    try {
      if (editingRoomId) {
        await updateRoom(editingRoomId, {
          code: roomCode.trim().toUpperCase(),
          name: roomName.trim(),
          type: roomType,
          capacity: Number(roomCapacity),
          building: roomBuilding.trim(),
          floor: Number(roomFloor),
        });
        showStatus('Room updated successfully!');
      } else {
        await addRoom({
          code: roomCode.trim().toUpperCase(),
          name: roomName.trim(),
          type: roomType,
          capacity: Number(roomCapacity),
          building: roomBuilding.trim(),
          floor: Number(roomFloor),
        });
        showStatus('Room added successfully!');
      }
      setEditingRoomId(null);
      setRoomCode('');
      setRoomName('');
      setRoomCapacity(100);
      onDataChanged();
    } catch (err) {
      showStatus((err as Error).message, 'error');
    }
  };

  const handleEditRoom = (r: Room) => {
    setEditingRoomId(r.id);
    setRoomCode(r.code);
    setRoomName(r.name);
    setRoomType(r.type);
    setRoomCapacity(r.capacity);
    setRoomBuilding(r.building);
    setRoomFloor(r.floor);
  };

  const handleDeleteRoom = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this room?')) return;
    try {
      await deleteRoom(id);
      showStatus('Room deleted.');
      onDataChanged();
    } catch (err) {
      showStatus((err as Error).message, 'error');
    }
  };

  // COURSE HANDLERS
  const handleSaveCourse = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const selectedProgramIds = Array.from(new Set(courseProgramIds));
      const progIdToSave = selectedProgramIds[0] ?? null;
      const targetGroupToSave = isPreparatoryYear(Number(courseYearId)) ? courseTargetGroup : 'ALL';
      const chosenProg = progIdToSave ? programs.find((p) => p.id === progIdToSave) : null;
      const deptToSave = chosenProg ? chosenProg.name : 'Common Core';

      if (editingCourseId) {
        await updateCourse(editingCourseId, {
          code: courseCode.trim().toUpperCase(),
          name: courseName.trim(),
          creditHours: Number(courseCredits),
          department: deptToSave,
          yearId: Number(courseYearId),
          programId: progIdToSave,
          programIds: selectedProgramIds,
          colorHex: courseColor,
          prerequisiteIds: coursePrerequisites.length > 0 ? coursePrerequisites : undefined,
          semester: courseSemester,
          targetGroup: targetGroupToSave,
          hasSections: courseHasSections,
        });
        showStatus('Course updated successfully!');
      } else {
        await addCourse({
          code: courseCode.trim().toUpperCase(),
          name: courseName.trim(),
          creditHours: Number(courseCredits),
          department: deptToSave,
          yearId: Number(courseYearId),
          programId: progIdToSave,
          programIds: selectedProgramIds,
          colorHex: courseColor,
          prerequisiteIds: coursePrerequisites.length > 0 ? coursePrerequisites : undefined,
          semester: courseSemester,
          targetGroup: targetGroupToSave,
          hasSections: courseHasSections,
        });
        showStatus('Course added successfully!');
      }
      setEditingCourseId(null);
      setCourseCode('');
      setCourseName('');
      setCourseProgramIds([]);
      setCoursePrerequisites([]);
      setCourseSemester(1);
      setCourseTargetGroup('ALL');
      setCourseHasSections(true);
      onDataChanged();
    } catch (err) {
      showStatus((err as Error).message, 'error');
    }
  };

  const handleEditCourse = (c: Course) => {
    setEditingCourseId(c.id);
    setCourseCode(c.code);
    setCourseName(c.name);
    setCourseCredits(c.creditHours);
    setCourseYearId(c.yearId);
    setCourseProgramIds(c.programIds?.length ? c.programIds : (c.programId ? [c.programId] : []));
    setCourseColor(c.colorHex || '#3b82f6');
    setCoursePrerequisites(c.prerequisiteIds || []);
    setCourseSemester((c.semester === 2 ? 2 : 1) as 1 | 2);
    setCourseTargetGroup(isPreparatoryYear(c.yearId) ? (c.targetGroup || 'ALL') : 'ALL');
    setCourseHasSections(c.hasSections !== false);
  };

  const handleQuickToggleTargetGroup = async (c: Course) => {
    if (!isPreparatoryYear(c.yearId)) return;
    try {
      const current = c.targetGroup || 'ALL';
      const nextGroup: TargetGroup = current === 'ALL' ? 'GROUP_A' : current === 'GROUP_A' ? 'GROUP_B' : 'ALL';
      await updateCourseTargetGroup(c.id, nextGroup);
      const label = nextGroup === 'ALL' ? 'Both Groups (A & B)' : nextGroup === 'GROUP_A' ? 'Group A Only' : 'Group B Only';
      showStatus(`Updated ${c.code} cohort: ${label}`);
      onDataChanged();
    } catch (err) {
      showStatus((err as Error).message, 'error');
    }
  };

  const handleQuickToggleHasSections = async (c: Course) => {
    try {
      const nextVal = c.hasSections === false;
      await updateCourseHasSections(c.id, nextVal);
      showStatus(
        `Updated ${c.code}: ${nextVal ? 'Has Practical Sections & Labs' : 'Lecture Only (No Sections)'}`
      );
      onDataChanged();
    } catch (err) {
      showStatus((err as Error).message, 'error');
    }
  };

  const handleDeleteCourse = async (id: number) => {
    if (!window.confirm('Delete this course? Its scheduled classes will also be deleted.')) return;
    try {
      await deleteCourse(id);
      showStatus('Course deleted.');
      onDataChanged();
    } catch (err) {
      showStatus((err as Error).message, 'error');
    }
  };

  const [isSyncingAi, setIsSyncingAi] = useState(false);
  const handleSyncAiCurriculum = async () => {
    setIsSyncingAi(true);
    try {
      const res = await syncAiCurriculumFromTemplate();
      showStatus(
        `AI Curriculum synced from template.xlsx: ${res.insertedCount} added, ${res.updatedCount} updated, ${res.prereqsLinked} prerequisites connected!`,
        'success'
      );
      onDataChanged();
    } catch (err) {
      showStatus((err as Error).message, 'error');
    } finally {
      setIsSyncingAi(false);
    }
  };

  // SECTION HANDLERS
  const handleSaveSection = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await addSection({
        yearId: Number(secYearId),
        programId: secProgramId ? Number(secProgramId) : null,
        name: secName.trim(),
        capacity: Number(secCapacity),
      });
      showStatus('Section added successfully!');
      setSecName('');
      onDataChanged();
    } catch (err) {
      showStatus((err as Error).message, 'error');
    }
  };

  const handleDeleteSection = async (id: number) => {
    if (!window.confirm('Delete this section group?')) return;
    try {
      await deleteSection(id);
      showStatus('Section deleted.');
      onDataChanged();
    } catch (err) {
      showStatus((err as Error).message, 'error');
    }
  };

  return (
    <div className="admin-page-container">
      {/* Top Banner Navigation & Quick Stats */}
      <div className="admin-page-header">
        <div className="admin-header-main">
          <div className="admin-header-title-wrap">
            <div className="admin-badge-icon">
              <ShieldCheck size={26} />
            </div>
            <div>
              <h1 className="admin-page-title">University Administration Hub</h1>
              <p className="admin-page-subtitle">
                Configure rooms & halls, faculty members, curriculum courses, and cohort sections
              </p>
            </div>
          </div>
          <button onClick={onBackToTimetable} className="action-btn secondary-btn back-btn">
            <ArrowLeft size={16} />
            <span>Back to Timetable</span>
          </button>
        </div>

        {/* Quick Stats Grid */}
        <div className="admin-stats-strip">
          <div className="admin-stat-card">
            <Building size={18} className="stat-icon text-sky" />
            <div className="stat-info">
              <span className="stat-number">{rooms.length}</span>
              <span className="stat-label">Rooms & Halls</span>
            </div>
          </div>
          <div className="admin-stat-card">
            <User size={18} className="stat-icon text-indigo" />
            <div className="stat-info">
              <span className="stat-number">{professors.length}</span>
              <span className="stat-label">Faculty Members</span>
            </div>
          </div>
          <div className="admin-stat-card">
            <Users size={18} className="stat-icon text-purple" />
            <div className="stat-info">
              <span className="stat-number">{teachingAssistants.length}</span>
              <span className="stat-label">Teaching Assistants</span>
            </div>
          </div>
          <div className="admin-stat-card">
            <BookOpen size={18} className="stat-icon text-emerald" />
            <div className="stat-info">
              <span className="stat-number">{courses.length}</span>
              <span className="stat-label">Active Courses</span>
            </div>
          </div>
          <div className="admin-stat-card">
            <GraduationCap size={18} className="stat-icon text-amber" />
            <div className="stat-info">
              <span className="stat-number">{programs.length}</span>
              <span className="stat-label">Degree Programs</span>
            </div>
          </div>
          <div className="admin-stat-card">
            <Layers size={18} className="stat-icon text-purple" />
            <div className="stat-info">
              <span className="stat-number">{sections.length}</span>
              <span className="stat-label">Section Groups</span>
            </div>
          </div>
        </div>
      </div>

      {/* Status Message Notification */}
      {statusMessage && (
        <div className={`alert-banner ${statusMessage.type === 'success' ? 'alert-success' : 'alert-danger'}`}>
          {statusMessage.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          <span className="font-medium">{statusMessage.text}</span>
        </div>
      )}

      {/* Main Tabs Navigation Bar */}
      <div className="admin-nav-bar">
        <div className="admin-tabs-list">
          <button
            className={`admin-main-tab ${activeTab === 'ROOMS' ? 'active' : ''}`}
            onClick={() => setActiveTab('ROOMS')}
          >
            <Building size={17} />
            <span>Rooms & Halls ({rooms.length})</span>
          </button>
          <button
            className={`admin-main-tab ${activeTab === 'PROFESSORS' ? 'active' : ''}`}
            onClick={() => setActiveTab('PROFESSORS')}
          >
            <User size={17} />
            <span>Faculty Members ({professors.length})</span>
          </button>
          <button
            className={`admin-main-tab ${activeTab === 'TEACHING_ASSISTANTS' ? 'active' : ''}`}
            onClick={() => setActiveTab('TEACHING_ASSISTANTS')}
          >
            <Users size={17} />
            <span>Teaching Assistants ({teachingAssistants.length})</span>
          </button>
          <button
            className={`admin-main-tab ${activeTab === 'ASSIGNMENTS' ? 'active' : ''}`}
            onClick={() => setActiveTab('ASSIGNMENTS')}
          >
            <BookOpen size={17} />
            <span>Subject Assignments ({teachingAssignments.length})</span>
          </button>
          <button
            className={`admin-main-tab ${activeTab === 'COURSES' ? 'active' : ''}`}
            onClick={() => setActiveTab('COURSES')}
          >
            <BookOpen size={17} />
            <span>Curriculum Courses ({courses.length})</span>
          </button>
          <button
            className={`admin-main-tab ${activeTab === 'PROGRAMS' ? 'active' : ''}`}
            onClick={() => setActiveTab('PROGRAMS')}
          >
            <GraduationCap size={17} />
            <span>Academic Departments ({programs.length})</span>
          </button>
          <button
            className={`admin-main-tab ${activeTab === 'SECTIONS' ? 'active' : ''}`}
            onClick={() => setActiveTab('SECTIONS')}
          >
            <Layers size={17} />
            <span>Sections & Groups ({sections.length})</span>
          </button>
        </div>

        {/* Search filter for list items */}
        <div className="admin-search-wrapper">
          <Search size={15} className="admin-search-icon" />
          <input
            type="text"
            className="admin-search-input"
            placeholder={`Search ${activeTab.toLowerCase()}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Tab Content Panel */}
      <div className="admin-page-body">
        {/* 1. ROOMS MANAGEMENT */}
        {activeTab === 'ROOMS' && (
          <div className="admin-grid-layout">
            {/* Form */}
            <div className="admin-panel card-glow">
              <div className="panel-header">
                <div className="panel-title-group">
                  <Building size={18} className="text-sky" />
                  <h2 className="panel-title-text">{editingRoomId ? 'Edit Room' : 'Add New Room / Hall'}</h2>
                </div>
                <span className="panel-badge">
                  {editingRoomId ? 'Editing Mode' : 'New Entry'}
                </span>
              </div>

              <form onSubmit={handleSaveRoom} className="admin-panel-form">
                <div className="form-group">
                  <label className="form-label">Room Code *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. HALL-D or LAB-302"
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Room / Hall Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Multimedia Amphitheater"
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                    required
                  />
                </div>
                <div className="form-row-2">
                  <div className="form-group">
                    <label className="form-label">Facility Type</label>
                    <select
                      className="form-select"
                      value={roomType}
                      onChange={(e) => setRoomType(e.target.value as RoomType)}
                    >
                      <option value="LECTURE_HALL">Lecture Hall (Auditorium)</option>
                      <option value="COMPUTER_LAB">Computer Lab</option>
                      <option value="TUTORIAL_ROOM">Tutorial Room</option>
                      <option value="WORKSHOP">Workshop</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Capacity (Seats) *</label>
                    <input
                      type="number"
                      className="form-input"
                      min="10"
                      max="500"
                      value={roomCapacity}
                      onChange={(e) => setRoomCapacity(Number(e.target.value))}
                      required
                    />
                  </div>
                </div>
                <div className="form-row-2">
                  <div className="form-group">
                    <label className="form-label">Building / Wing</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Building A - Engineering"
                      value={roomBuilding}
                      onChange={(e) => setRoomBuilding(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Floor Number</label>
                    <input
                      type="number"
                      className="form-input"
                      min="0"
                      max="10"
                      value={roomFloor}
                      onChange={(e) => setRoomFloor(Number(e.target.value))}
                      required
                    />
                  </div>
                </div>
                <div className="form-actions-row">
                  {editingRoomId && (
                    <button
                      type="button"
                      className="admin-cancel-btn"
                      onClick={() => {
                        setEditingRoomId(null);
                        setRoomCode('');
                        setRoomName('');
                      }}
                    >
                      <X size={16} />
                      <span>Cancel</span>
                    </button>
                  )}
                  <button type="submit" className="admin-submit-btn">
                    {editingRoomId ? <Check size={16} /> : <Plus size={16} />}
                    <span>{editingRoomId ? 'Update Room Details' : 'Add Room to System'}</span>
                  </button>
                </div>
              </form>
            </div>

            {/* List */}
            <div className="admin-panel">
              <div className="panel-header">
                <div className="panel-title-group">
                  <Filter size={16} className="text-secondary" />
                  <h2 className="panel-title-text">Registered Rooms ({filteredRooms.length})</h2>
                </div>
              </div>

              <div className="admin-page-list">
                {filteredRooms.length === 0 ? (
                  <div className="admin-empty-state">
                    <p>No rooms registered yet. Use the form to add lecture halls, labs, or classrooms.</p>
                  </div>
                ) : (
                  filteredRooms.map((r) => (
                    <div key={r.id} className="admin-entry-card">
                      <div className="entry-details">
                        <div className="entry-title-line">
                          <span className="code-pill">{r.code}</span>
                          <span className="entry-name">{r.name}</span>
                        </div>
                        <div className="entry-sub-line">
                          <span className="type-tag">{r.type.replace('_', ' ')}</span>
                          <span>• Capacity: {r.capacity} seats</span>
                          <span>• {r.building} (Floor {r.floor})</span>
                        </div>
                      </div>
                      <div className="entry-buttons">
                        <button className="icon-btn" onClick={() => handleEditRoom(r)} title="Edit Room">
                          <Edit2 size={15} />
                        </button>
                        <button className="icon-btn danger" onClick={() => handleDeleteRoom(r.id)} title="Delete Room">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* 2. PROFESSORS MANAGEMENT */}
        {activeTab === 'PROFESSORS' && (
          <div className="admin-grid-layout">
            {/* Form */}
            <div className="admin-panel card-glow">
              <div className="panel-header">
                <div className="panel-title-group">
                  <User size={18} className="text-indigo" />
                  <h2 className="panel-title-text">
                    {editingProfId ? 'Edit Faculty Member' : 'Register Faculty Member'}
                  </h2>
                </div>
                <span className="panel-badge">
                  {editingProfId ? 'Editing Mode' : 'New Member'}
                </span>
              </div>

              <form onSubmit={handleSaveProfessor} className="admin-panel-form">
                <div className="form-row-2">
                  <div className="form-group">
                    <label className="form-label">Academic Title</label>
                    <select
                      className="form-select"
                      value={profTitle}
                      onChange={(e) => setProfTitle(e.target.value)}
                    >
                      <option value="Prof.">Prof.</option>
                      <option value="Dr.">Dr.</option>
                      <option value="Eng.">Eng.</option>
                      <option value="TA">TA</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Full Name *</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Alan Turing"
                      value={profName}
                      onChange={(e) => setProfName(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Academic Department *</label>
                  {programs.length > 0 ? (
                    <select
                      className="form-select"
                      value={profDept}
                      onChange={(e) => setProfDept(e.target.value)}
                      required
                    >
                      <option value="">-- Select Academic Department --</option>
                      {programs.map((p) => (
                        <option key={p.id} value={p.name}>
                          {p.code} - {p.name}
                        </option>
                      ))}
                      <option value="Basic Sciences">Basic Sciences (Preparatory)</option>
                      <option value="General Engineering">General Engineering</option>
                    </select>
                  ) : (
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Computer Science"
                      value={profDept}
                      onChange={(e) => setProfDept(e.target.value)}
                      required
                    />
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label">Official Email *</label>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="faculty@univ.edu"
                    value={profEmail}
                    onChange={(e) => setProfEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="form-row-2">
                  <div className="form-group">
                    <label className="form-label">Phone</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="+1-555-0199"
                      value={profPhone}
                      onChange={(e) => setProfPhone(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Office Location</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Hall 305"
                      value={profOffice}
                      onChange={(e) => setProfOffice(e.target.value)}
                    />
                  </div>
                </div>

                {/* Specific Attendance Days */}
                <div className="form-group prof-days-group">
                  <div className="flex-between-center mb-1">
                    <label className="form-label mb-0 flex-center-gap">
                      <Calendar size={14} className="text-indigo" />
                      <span>Campus Attendance Days</span>
                    </label>
                    <button
                      type="button"
                      className="text-btn-subtle"
                      onClick={() => {
                        if (profAvailableDays.length === 0 || profAvailableDays.length === 7) {
                          setProfAvailableDays([0, 1, 2, 3, 4]);
                        } else {
                          setProfAvailableDays([]);
                        }
                      }}
                    >
                      {profAvailableDays.length === 0 || profAvailableDays.length === 7
                        ? 'Quick: Workdays (Sun-Thu)'
                        : 'Reset to All Days'}
                    </button>
                  </div>
                  <div className="day-chips-grid">
                    {[
                      { id: 0, label: 'Sun', name: 'Sunday' },
                      { id: 1, label: 'Mon', name: 'Monday' },
                      { id: 2, label: 'Tue', name: 'Tuesday' },
                      { id: 3, label: 'Wed', name: 'Wednesday' },
                      { id: 4, label: 'Thu', name: 'Thursday' },
                      { id: 5, label: 'Fri', name: 'Friday' },
                      { id: 6, label: 'Sat', name: 'Saturday' },
                    ].map((d) => {
                      const isSelected =
                        profAvailableDays.length === 0 ||
                        profAvailableDays.length === 7 ||
                        profAvailableDays.includes(d.id);
                      return (
                        <button
                          key={d.id}
                          type="button"
                          className={`day-chip-btn ${isSelected ? 'active' : 'inactive'}`}
                          title={`${d.name} (${isSelected ? 'Attends Campus' : 'Off-Campus / Conflict'})`}
                          onClick={() => {
                            if (profAvailableDays.length === 0 || profAvailableDays.length === 7) {
                              const remaining = [0, 1, 2, 3, 4, 5, 6].filter((id) => id !== d.id);
                              setProfAvailableDays(remaining);
                            } else {
                              if (profAvailableDays.includes(d.id)) {
                                const next = profAvailableDays.filter((id) => id !== d.id);
                                setProfAvailableDays(next);
                              } else {
                                const next = [...profAvailableDays, d.id].sort((a, b) => a - b);
                                if (next.length === 7) {
                                  setProfAvailableDays([]);
                                } else {
                                  setProfAvailableDays(next);
                                }
                              }
                            }
                          }}
                        >
                          {d.label}
                        </button>
                      );
                    })}
                  </div>
                  <div className="attendance-hint-text">
                    {profAvailableDays.length === 0 || profAvailableDays.length === 7 ? (
                      <span className="text-emerald">✓ Available on campus all days. No attendance day restrictions.</span>
                    ) : (
                      <span className="text-amber">
                        ⚠️ Only available on:{' '}
                        <strong>
                          {profAvailableDays
                            .map((id) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][id])
                            .join(', ')}
                        </strong>
                        . Scheduling on other days will trigger a conflict restriction.
                      </span>
                    )}
                  </div>
                </div>

                <div className="form-actions-row">
                  {editingProfId && (
                    <button
                      type="button"
                      className="admin-cancel-btn"
                      onClick={() => {
                        setEditingProfId(null);
                        setProfName('');
                        setProfEmail('');
                        setProfPhone('');
                        setProfOffice('');
                        setProfAvailableDays([]);
                      }}
                    >
                      <X size={16} />
                      <span>Cancel</span>
                    </button>
                  )}
                  <button type="submit" className="admin-submit-btn">
                    {editingProfId ? <Check size={16} /> : <Plus size={16} />}
                    <span>{editingProfId ? 'Update Faculty Details' : 'Add Faculty Member'}</span>
                  </button>
                </div>
              </form>
            </div>

            {/* List */}
            <div className="admin-panel">
              <div className="panel-header">
                <div className="panel-title-group">
                  <Filter size={16} className="text-secondary" />
                  <h2 className="panel-title-text">Faculty Roster ({filteredProfessors.length})</h2>
                </div>
              </div>

              <div className="admin-page-list">
                {filteredProfessors.length === 0 ? (
                  <div className="admin-empty-state">
                    <p>No faculty members registered yet. Use the form to add professors and teaching assistants.</p>
                  </div>
                ) : (
                  filteredProfessors.map((p) => (
                    <div key={p.id} className="admin-entry-card">
                      <div className="entry-details">
                        <div className="entry-title-line">
                          <span className="title-pill">{p.title}</span>
                          <span className="entry-name">{p.name}</span>
                        </div>
                        <div className="entry-sub-line">
                          <span>{p.department}</span>
                          <span>• {p.email}</span>
                          {p.office && <span>• Office: {p.office}</span>}
                        </div>
                        <div className="entry-attendance-line">
                          {p.availableDays && p.availableDays.length > 0 && p.availableDays.length < 7 ? (
                            <span className="attendance-pill restricted" title="Attendance limited to specific days">
                              <Calendar size={12} />
                              <span>Attends: {p.availableDays.map((d) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(', ')}</span>
                            </span>
                          ) : (
                            <span className="attendance-pill all-days" title="Attends all campus days">
                              <Calendar size={12} />
                              <span>Attends: All Days</span>
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="entry-buttons">
                        <button className="icon-btn" onClick={() => handleEditProf(p)} title="Edit">
                          <Edit2 size={15} />
                        </button>
                        <button className="icon-btn danger" onClick={() => handleDeleteProf(p.id)} title="Delete">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* 3. TEACHING ASSISTANTS MANAGEMENT */}
        {activeTab === 'TEACHING_ASSISTANTS' && (
          <div className="admin-grid-layout">
            <div className="admin-panel card-glow">
              <div className="panel-header">
                <div className="panel-title-group">
                  <Users size={18} className="text-purple" />
                  <h2 className="panel-title-text">{editingTaId ? 'Edit Teaching Assistant' : 'Register Teaching Assistant'}</h2>
                </div>
                <span className="panel-badge">{editingTaId ? 'Editing Mode' : 'New Entry'}</span>
              </div>
              <form onSubmit={handleSaveTeachingAssistant} className="admin-panel-form">
                <div className="form-group">
                  <label className="form-label">Full Name *</label>
                  <input className="form-input" value={taName} onChange={(e) => setTaName(e.target.value)} placeholder="e.g. Eng. David Patterson" required />
                </div>
                <div className="form-group">
                  <label className="form-label">Academic Department *</label>
                  {programs.length > 0 ? (
                    <select className="form-select" value={taDept} onChange={(e) => setTaDept(e.target.value)} required>
                      <option value="">-- Select Academic Department --</option>
                      {programs.map((p) => <option key={p.id} value={p.name}>{p.code} - {p.name}</option>)}
                      <option value="Basic Sciences">Basic Sciences (Preparatory)</option>
                      <option value="General Engineering">General Engineering</option>
                    </select>
                  ) : (
                    <input className="form-input" value={taDept} onChange={(e) => setTaDept(e.target.value)} required />
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label">Official Email *</label>
                  <input type="email" className="form-input" value={taEmail} onChange={(e) => setTaEmail(e.target.value)} placeholder="assistant@univ.edu" required />
                </div>
                <div className="form-row-2">
                  <div className="form-group">
                    <label className="form-label">Phone</label>
                    <input className="form-input" value={taPhone} onChange={(e) => setTaPhone(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Office Location</label>
                    <input className="form-input" value={taOffice} onChange={(e) => setTaOffice(e.target.value)} />
                  </div>
                </div>
                <div className="form-group prof-days-group">
                  <label className="form-label flex-center-gap"><Calendar size={14} className="text-purple" /> Campus Attendance Days</label>
                  <div className="day-chips-grid">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label, day) => {
                      const selected = taAvailableDays.length === 0 || taAvailableDays.length === 7 || taAvailableDays.includes(day);
                      return (
                        <button
                          key={label}
                          type="button"
                          className={`day-chip-btn ${selected ? 'active' : 'inactive'}`}
                          onClick={() => {
                            const current = taAvailableDays.length === 0 || taAvailableDays.length === 7 ? [0, 1, 2, 3, 4, 5, 6] : taAvailableDays;
                            const next = current.includes(day) ? current.filter((value) => value !== day) : [...current, day];
                            setTaAvailableDays(next.length === 7 ? [] : next.sort((a, b) => a - b));
                          }}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="form-actions-row">
                  {editingTaId && (
                    <button type="button" className="admin-cancel-btn" onClick={() => {
                      setEditingTaId(null);
                      setTaName('');
                      setTaEmail('');
                      setTaPhone('');
                      setTaOffice('');
                      setTaAvailableDays([]);
                    }}>
                      <X size={16} /><span>Cancel</span>
                    </button>
                  )}
                  <button type="submit" className="admin-submit-btn">
                    {editingTaId ? <Check size={16} /> : <Plus size={16} />}
                    <span>{editingTaId ? 'Update Assistant' : 'Add Teaching Assistant'}</span>
                  </button>
                </div>
              </form>
            </div>
            <div className="admin-panel">
              <div className="panel-header">
                <div className="panel-title-group">
                  <Filter size={16} className="text-secondary" />
                  <h2 className="panel-title-text">Teaching Assistant Roster ({filteredTeachingAssistants.length})</h2>
                </div>
              </div>
              <div className="admin-page-list">
                {filteredTeachingAssistants.length === 0 ? (
                  <div className="admin-empty-state"><p>No teaching assistants registered yet.</p></div>
                ) : filteredTeachingAssistants.map((assistant) => (
                  <div key={assistant.id} className="admin-entry-card">
                    <div className="entry-details">
                      <div className="entry-title-line">
                        <span className="title-pill">TA</span>
                        <span className="entry-name">{assistant.name}</span>
                      </div>
                      <div className="entry-sub-line">
                        <span>{assistant.department}</span><span>• {assistant.email}</span>
                        {assistant.office && <span>• Office: {assistant.office}</span>}
                      </div>
                      <div className="entry-attendance-line">
                        <span className="attendance-pill all-days"><Calendar size={12} /><span>
                          {assistant.availableDays?.length ? `Attends: ${assistant.availableDays.map((day) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day]).join(', ')}` : 'Attends: All Days'}
                        </span></span>
                      </div>
                    </div>
                    <div className="entry-buttons">
                      <button className="icon-btn" onClick={() => handleEditTeachingAssistant(assistant)} title="Edit"><Edit2 size={15} /></button>
                      <button className="icon-btn danger" onClick={() => handleDeleteTeachingAssistant(assistant.id)} title="Delete"><Trash2 size={15} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 4. SUBJECT ASSIGNMENTS */}
        {activeTab === 'ASSIGNMENTS' && (
          <div className="admin-grid-layout">
            <div className="admin-panel card-glow">
              <div className="panel-header">
                <div className="panel-title-group">
                  <BookOpen size={18} className="text-emerald" />
                  <h2 className="panel-title-text">Assign Multiple Subjects</h2>
                </div>
                <span className="panel-badge">Many-to-Many</span>
              </div>
              <form onSubmit={handleAssignCourses} className="admin-panel-form">
                <div className="form-group">
                  <label className="form-label">Faculty Type</label>
                  <select
                    className="form-select"
                    value={assignmentFacultyType}
                    onChange={(e) => {
                      setAssignmentFacultyType(e.target.value as 'PROFESSOR' | 'TA');
                      setAssignmentFacultyId('');
                    }}
                  >
                    <option value="PROFESSOR">Professor</option>
                    <option value="TA">Teaching Assistant</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Faculty Member *</label>
                  <select
                    className="form-select"
                    value={assignmentFacultyId}
                    onChange={(e) => setAssignmentFacultyId(e.target.value ? Number(e.target.value) : '')}
                    required
                  >
                    <option value="">-- Select Faculty Member --</option>
                    {(assignmentFacultyType === 'PROFESSOR' ? professors : teachingAssistants).map((member) => (
                      <option key={member.id} value={member.id}>{member.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <div className="flex-between-center mb-1">
                    <label className="form-label mb-0">Subjects * <span className="text-muted">(select one or more)</span></label>
                    <span className="panel-badge">{assignmentCourseIds.length} selected</span>
                  </div>
                  <div className="assignment-course-grid">
                    {courses.map((course) => (
                      <button
                        key={course.id}
                        type="button"
                        className={`assignment-course-card ${assignmentCourseIds.includes(course.id) ? 'selected' : ''}`}
                        onClick={() => setAssignmentCourseIds((current) =>
                          current.includes(course.id)
                            ? current.filter((id) => id !== course.id)
                            : [...current, course.id]
                        )}
                      >
                        <span className="assignment-course-check">
                          {assignmentCourseIds.includes(course.id) ? <Check size={13} /> : <Plus size={13} />}
                        </span>
                        <span className="assignment-course-content">
                          <strong>{course.code}</strong>
                          <span>{course.name}</span>
                        </span>
                        <span className="assignment-course-semester">S{course.semester || 1}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <button type="submit" className="admin-submit-btn">
                  <Plus size={16} />
                  <span>Assign Selected Subjects</span>
                </button>
              </form>
            </div>
            <div className="admin-panel">
              <div className="panel-header">
                <div className="panel-title-group">
                  <Filter size={16} className="text-secondary" />
                  <h2 className="panel-title-text">Current Subject Assignments ({visibleAssignments.length})</h2>
                </div>
              </div>
              <div className="admin-page-list">
                {visibleAssignments.length === 0 ? (
                  <div className="admin-empty-state"><p>No subject assignments registered yet.</p></div>
                ) : visibleAssignments.map((assignment) => (
                  <div key={assignment.id} className="admin-entry-card">
                    <div className="entry-details">
                      <div className="entry-title-line">
                        <span className="title-pill">{assignment.professorName ? 'Professor' : 'TA'}</span>
                        <span className="entry-name">{assignment.professorName || assignment.teachingAssistantName}</span>
                      </div>
                      <div className="entry-sub-line">
                        <span>{assignment.courseCode} — {assignment.courseName}</span>
                      </div>
                    </div>
                    <div className="entry-buttons">
                      <button className="icon-btn danger" onClick={() => handleDeleteAssignment(assignment.id)} title="Remove assignment">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 5. COURSES MANAGEMENT */}
        {activeTab === 'COURSES' && (
          <div className="admin-grid-layout">
            <div className="admin-panel card-glow">
              <div className="panel-header">
                <div className="panel-title-group">
                  <BookOpen size={18} className="text-emerald" />
                  <h2 className="panel-title-text">
                    {editingCourseId ? 'Edit Course Details' : 'Add Course to Curriculum'}
                  </h2>
                </div>
                <span className="panel-badge">
                  {editingCourseId ? 'Editing Mode' : 'New Course'}
                </span>
              </div>

              <form onSubmit={handleSaveCourse} className="admin-panel-form">
                <div className="form-row-2">
                  <div className="form-group">
                    <label className="form-label">Course Code *</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. CS205"
                      value={courseCode}
                      onChange={(e) => setCourseCode(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Credit Hours</label>
                    <input
                      type="number"
                      className="form-input"
                      min="1"
                      max="6"
                      value={courseCredits}
                      onChange={(e) => setCourseCredits(Number(e.target.value))}
                      required
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Course Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Advanced Operating Systems"
                    value={courseName}
                    onChange={(e) => setCourseName(e.target.value)}
                    required
                  />
                </div>
                <div className="form-row-2">
                  <div className="form-group">
                    <label className="form-label">Academic Year</label>
                    <select
                      className="form-select"
                      value={courseYearId}
                      onChange={(e) => setCourseYearId(Number(e.target.value))}
                    >
                      {years.map((y) => (
                        <option key={y.id} value={y.id}>
                          {y.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Academic Semester *</label>
                    <select
                      className="form-select"
                      value={courseSemester}
                      onChange={(e) => setCourseSemester(Number(e.target.value) as 1 | 2)}
                    >
                      <option value={1}>Semester 1 (Fall Term)</option>
                      <option value={2}>Semester 2 (Spring Term)</option>
                    </select>
                  </div>
                </div>

                <div className="form-row-dept-color">
                  <div className="form-group">
                    <label className="form-label">Academic Department (Program)</label>
                    <div className="program-selector-heading">
                      <span className="form-help-text">Choose every program that uses this subject. The subject code is stored only once.</span>
                      <span className="selection-count">{courseProgramIds.length ? `${courseProgramIds.length} selected` : 'Common subject'}</span>
                    </div>
                    <div className="subject-card-grid shared-program-grid modern-program-selector">
                      <button
                        type="button"
                        className={`subject-select-card common-program-card ${courseProgramIds.length === 0 ? 'selected' : ''}`}
                        onClick={() => {
                          setCourseProgramIds([]);
                        }}
                      >
                        <span className="subject-select-icon"><Layers size={14} /></span>
                        <span><strong>Common</strong><small>Basic Sciences / All Programs</small></span>
                        {courseProgramIds.length === 0 && <Check size={15} className="program-selected-mark" />}
                      </button>
                      {programs.map((program) => {
                        const selected = courseProgramIds.includes(program.id);
                        return (
                          <button
                            key={program.id}
                            type="button"
                            className={`subject-select-card ${selected ? 'selected' : ''}`}
                            onClick={() => {
                              const nextIds = selected
                                ? courseProgramIds.filter((id) => id !== program.id)
                                : [...courseProgramIds, program.id];
                              setCourseProgramIds(nextIds);
                            }}
                          >
                            <span className="subject-select-icon">{selected ? <Check size={14} /> : <Plus size={14} />}</span>
                            <span><strong>{program.code}</strong><small>{program.name}</small></span>
                            {selected && <Check size={15} className="program-selected-mark" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Color</label>
                    <input
                      type="color"
                      className="form-color-input"
                      title="Select Course Color Identifier"
                      value={courseColor}
                      onChange={(e) => setCourseColor(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <div className="flex-between-center mb-1">
                    <label className="form-label mb-0">Practical Sections / Labs *</label>
                    <span className="text-xs text-muted">Tutorial / lab sections needed?</span>
                  </div>
                  <select
                    className={`form-select ${courseHasSections ? 'border-emerald' : 'border-amber'}`}
                    value={courseHasSections ? 'YES' : 'NO'}
                    onChange={(e) => setCourseHasSections(e.target.value === 'YES')}
                  >
                    <option value="YES">✅ Has Sections &amp; Labs (Tutorials)</option>
                    <option value="NO">🚫 Lecture Only (No Sections)</option>
                  </select>
                </div>

                {isPreparatoryYear(Number(courseYearId)) && <div className="form-group">
                  <label className="form-label flex-between-center">
                    <span>Cohort / Group Assignment</span>
                    <span className="text-xs text-muted">Prep Year Group A / B</span>
                  </label>
                  <select
                    className={`form-select ${courseTargetGroup === 'GROUP_A' ? 'border-emerald' : courseTargetGroup === 'GROUP_B' ? 'border-purple' : ''}`}
                    value={courseTargetGroup}
                    onChange={(e) => setCourseTargetGroup(e.target.value as TargetGroup)}
                  >
                    <option value="ALL">Both Groups (All Cohorts: Group A & B)</option>
                    <option value="GROUP_A">Group A Only (Prep Cohort A)</option>
                    <option value="GROUP_B">Group B Only (Prep Cohort B)</option>
                  </select>
                </div>}

                {!courseHasSections && (
                  <div className="target-group-callout text-xs" style={{ borderColor: '#f59e0b', background: 'rgba(245, 158, 11, 0.08)' }}>
                    📖 <strong>Lecture Only Subject:</strong> This subject does not require section / lab / tutorial slots. Only whole-class lectures will be scheduled.
                  </div>
                )}

                {isPreparatoryYear(Number(courseYearId)) && courseTargetGroup !== 'ALL' && (
                  <div className="target-group-callout text-xs">
                    💡 <strong>Cohort Alternation Active:</strong> This course will be scheduled for{' '}
                    <strong className={courseTargetGroup === 'GROUP_A' ? 'text-emerald' : 'text-purple'}>
                      {courseTargetGroup === 'GROUP_A' ? 'Group A Only' : 'Group B Only'}
                    </strong>{' '}
                    in Semester {courseSemester}. Prep Group A and B both complete all subjects across the year, with 2 alternating subjects per semester (e.g. Drawing & Chemistry in S1 for Group A, swapped with Production & CS for Group B).
                  </div>
                )}

                {/* Prerequisite / Dependent Subjects (GPA System) */}
                <div className="form-group course-prereq-group">
                  <div className="flex-between-center mb-1">
                    <label className="form-label mb-0 flex-center-gap">
                      <BookOpen size={14} className="text-emerald" />
                      <span>Prerequisites / Dependent Subjects (GPA System)</span>
                    </label>
                    {coursePrerequisites.length > 0 && (
                      <button
                        type="button"
                        className="text-btn-subtle"
                        onClick={() => setCoursePrerequisites([])}
                      >
                        Clear All ({coursePrerequisites.length})
                      </button>
                    )}
                  </div>
                  <div className="prereq-chips-container">
                    {courses
                      .filter((other) => other.id !== editingCourseId)
                      .map((other) => {
                        const isSelected = coursePrerequisites.includes(other.id);
                        return (
                          <button
                            key={other.id}
                            type="button"
                            className={`prereq-chip-btn ${isSelected ? 'active' : 'inactive'}`}
                            onClick={() => {
                              if (isSelected) {
                                setCoursePrerequisites(coursePrerequisites.filter((id) => id !== other.id));
                              } else {
                                setCoursePrerequisites([...coursePrerequisites, other.id]);
                              }
                            }}
                            title={`${other.code} - ${other.name}`}
                          >
                            <span className="prereq-code-text">{other.code}</span>
                            <span className="prereq-name-text">{other.name}</span>
                          </button>
                        );
                      })}
                    {courses.filter((other) => other.id !== editingCourseId).length === 0 && (
                      <span className="text-xs text-muted">No other courses registered yet.</span>
                    )}
                  </div>
                  <div className="prereq-hint-text">
                    {coursePrerequisites.length > 0 ? (
                      <span className="text-amber">
                        🔗 <strong>GPA Conflict Guard:</strong> This course depends on{' '}
                        {coursePrerequisites
                          .map((pid) => courses.find((x) => x.id === pid)?.code || pid)
                          .join(', ')}
                        . The schedule engine will strictly prevent timing conflicts so students retaking or carrying over prerequisites (e.g. summer courses) can attend both.
                      </span>
                    ) : (
                      <span className="text-muted text-xs">
                        No prerequisites selected (standalone / introductory subject).
                      </span>
                    )}
                  </div>
                </div>

                <div className="form-actions-row">
                  {editingCourseId && (
                    <button
                      type="button"
                      className="admin-cancel-btn"
                      onClick={() => {
                        setEditingCourseId(null);
                        setCourseCode('');
                        setCourseName('');
                        setCourseProgramIds([]);
                        setCoursePrerequisites([]);
                        setCourseSemester(1);
                        setCourseTargetGroup('ALL');
                        setCourseHasSections(true);
                      }}
                    >
                      <X size={16} />
                      <span>Cancel</span>
                    </button>
                  )}
                  <button type="submit" className="admin-submit-btn">
                    {editingCourseId ? <Check size={16} /> : <Plus size={16} />}
                    <span>{editingCourseId ? 'Update Course Details' : 'Add Course to Curriculum'}</span>
                  </button>
                </div>
              </form>
            </div>

            <div className="admin-panel">
              <div className="panel-header panel-header-stacked">
                <div className="flex-between-center w-full flex-wrap gap-2">
                  <div className="panel-title-group">
                    <Filter size={16} className="text-secondary" />
                    <h2 className="panel-title-text">Active Courses ({filteredCourses.length})</h2>
                  </div>
                  <div className="flex-row-center gap-2">
                    {onOpenAutoSchedule && (
                      <button
                        type="button"
                        className="action-btn primary-btn highlight-glow"
                        title="Auto-generate conflict-free timetables by semester"
                        onClick={onOpenAutoSchedule}
                        style={{ padding: '0.4rem 0.75rem', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                      >
                        <Sparkles size={13} className="text-amber-400" />
                        <span>Auto Gen Tables</span>
                      </button>
                    )}
                    <button
                      type="button"
                      className="action-btn secondary-btn"
                      title="Synchronize all 58 courses and 26 prerequisite dependencies from official template.xlsx"
                      onClick={handleSyncAiCurriculum}
                      disabled={isSyncingAi}
                      style={{ padding: '0.4rem 0.75rem', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                    >
                      <RefreshCw size={13} className={isSyncingAi ? 'animate-spin' : ''} />
                      <span>{isSyncingAi ? 'Syncing...' : 'Sync AI Curriculum (Excel)'}</span>
                    </button>
                  </div>
                </div>

                <div className="course-filters-wrapper">
                  <div className="filter-chip-row">
                    <span className="filter-chip-label">Program:</span>
                    <div className="filter-chip-items">
                      <button
                        type="button"
                        className={`filter-badge-btn ${courseProgramFilter === 'ALL' ? 'active' : ''}`}
                        onClick={() => setCourseProgramFilter('ALL')}
                      >
                        All Programs ({courses.length})
                      </button>
                      <button
                        type="button"
                        className={`filter-badge-btn highlight-program ${courseProgramFilter === 'BASIC_SCIENCES' ? 'active' : ''}`}
                        onClick={() => setCourseProgramFilter('BASIC_SCIENCES')}
                        title="Basic Sciences foundation subjects (Preparatory Year)"
                      >
                        Basic Sciences (Prep) ({courses.filter(isBasicSciencesCourse).length})
                      </button>
                      {programs.map((prog) => {
                                        const count = courses.filter((c) => c.programIds?.includes(prog.id) || c.programId === prog.id).length;
                        return (
                          <button
                            key={prog.id}
                            type="button"
                            className={`filter-badge-btn ${courseProgramFilter === prog.id ? 'active' : ''}`}
                            onClick={() => setCourseProgramFilter(prog.id)}
                          >
                            {prog.code} ({count})
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="filter-chip-row multi-filter-row">
                    <div className="filter-subgroup prep-cohort-filter">
                      <span className="filter-chip-label">Semester:</span>
                      <button
                        type="button"
                        className={`filter-badge-btn ${courseSemesterFilter === 'ALL' ? 'active' : ''}`}
                        onClick={() => setCourseSemesterFilter('ALL')}
                      >
                        All
                      </button>
                      <button
                        type="button"
                        className={`filter-badge-btn ${courseSemesterFilter === 1 ? 'active' : ''}`}
                        onClick={() => setCourseSemesterFilter(1)}
                      >
                        Sem 1
                      </button>
                      <button
                        type="button"
                        className={`filter-badge-btn ${courseSemesterFilter === 2 ? 'active' : ''}`}
                        onClick={() => setCourseSemesterFilter(2)}
                      >
                        Sem 2
                      </button>
                    </div>

                    {courses.some((course) => isPreparatoryYear(course.yearId)) && <div className="filter-subgroup">
                      <span className="filter-chip-label">Cohort:</span>
                      <button
                        type="button"
                        className={`filter-badge-btn ${courseTargetGroupFilter === 'ALL' ? 'active' : ''}`}
                        onClick={() => setCourseTargetGroupFilter('ALL')}
                      >
                        All
                      </button>
                      <button
                        type="button"
                        className={`filter-badge-btn highlight-group-a ${courseTargetGroupFilter === 'GROUP_A' ? 'active' : ''}`}
                        onClick={() => setCourseTargetGroupFilter('GROUP_A')}
                      >
                        Group A
                      </button>
                      <button
                        type="button"
                        className={`filter-badge-btn highlight-group-b ${courseTargetGroupFilter === 'GROUP_B' ? 'active' : ''}`}
                        onClick={() => setCourseTargetGroupFilter('GROUP_B')}
                      >
                        Group B
                      </button>
                    </div>}

                    <div className="filter-subgroup">
                      <span className="filter-chip-label">Sections:</span>
                      <button
                        type="button"
                        className={`filter-badge-btn ${courseSectionsFilter === 'ALL' ? 'active' : ''}`}
                        onClick={() => setCourseSectionsFilter('ALL')}
                      >
                        All
                      </button>
                      <button
                        type="button"
                        className={`filter-badge-btn ${courseSectionsFilter === 'HAS_SECTIONS' ? 'active' : ''}`}
                        onClick={() => setCourseSectionsFilter('HAS_SECTIONS')}
                      >
                        Has Sections
                      </button>
                      <button
                        type="button"
                        className={`filter-badge-btn highlight-warning ${courseSectionsFilter === 'NO_SECTIONS' ? 'active' : ''}`}
                        onClick={() => setCourseSectionsFilter('NO_SECTIONS')}
                      >
                        Lecture Only
                      </button>
                    </div>

                    <div className="filter-subgroup">
                      <span className="filter-chip-label">Sort:</span>
                      <button
                        type="button"
                        className={`filter-badge-btn ${courseSortBy === 'YEAR_SEM' ? 'active' : ''}`}
                        onClick={() => setCourseSortBy('YEAR_SEM')}
                        title="Sort by Academic Level / Year (Prep Year first) and Semester"
                      >
                        Year &amp; Sem
                      </button>
                      <button
                        type="button"
                        className={`filter-badge-btn ${courseSortBy === 'PROGRAM' ? 'active' : ''}`}
                        onClick={() => setCourseSortBy('PROGRAM')}
                        title="Sort by Program (Basic Sciences prep subjects first, then departments)"
                      >
                        By Program
                      </button>
                      <button
                        type="button"
                        className={`filter-badge-btn ${courseSortBy === 'CODE' ? 'active' : ''}`}
                        onClick={() => setCourseSortBy('CODE')}
                        title="Sort alphabetically by Course Code"
                      >
                        Code
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="admin-page-list">
                {filteredCourses.length === 0 ? (
                  <div className="admin-empty-state">
                    <p>No courses registered yet. Use the form to add academic courses.</p>
                  </div>
                ) : (
                  filteredCourses.map((c) => {
                    const yr = years.find((y) => y.id === c.yearId);
                    return (
                      <div key={c.id} className="admin-entry-card">
                        <div className="entry-details">
                          <div className="entry-title-line">
                            <span className="color-indicator" style={{ backgroundColor: c.colorHex }}></span>
                            <span className="code-pill">{c.code}</span>
                            <span className="entry-name">{c.name}</span>
                          </div>
                          <div className="entry-badges-row">
                            <span className="code-pill sem-pill" title={`Semester ${c.semester || 1}`}>
                              Sem {c.semester || 1}
                            </span>
                            {c.programCode ? (
                              <span className="code-pill highlight-program" title={`Program: ${c.programName || c.programCode}`}>
                                {c.programCode}
                              </span>
                            ) : (
                              <span className="code-pill highlight-program" style={{ background: 'rgba(14, 165, 233, 0.16)', color: '#38bdf8', borderColor: 'rgba(56, 189, 248, 0.35)' }} title="Basic Sciences (Preparatory Year Foundation)">
                                Basic Sciences (Prep)
                              </span>
                            )}
                            {(c.programIds?.length || 0) > 1 && (
                              <span className="code-pill subtle" title="This subject is shared across multiple programs">
                                Shared: {c.programIds!.map((id) => programs.find((p) => p.id === id)?.code).filter(Boolean).join(', ')}
                              </span>
                            )}
                            {isPreparatoryYear(c.yearId) && c.targetGroup === 'GROUP_A' && (
                              <span className="code-pill highlight-group-a" title="Prep Group A Only in this semester">
                                Group A Only
                              </span>
                            )}
                            {isPreparatoryYear(c.yearId) && c.targetGroup === 'GROUP_B' && (
                              <span className="code-pill highlight-group-b" title="Prep Group B Only in this semester">
                                Group B Only
                              </span>
                            )}
                            {isPreparatoryYear(c.yearId) && (c.targetGroup === 'ALL' || !c.targetGroup) && (
                              <span className="code-pill subtle" title="Assigned to Both Groups (A & B)">
                                Group A & B
                              </span>
                            )}
                            {c.hasSections === false ? (
                              <span className="code-pill pill-warning" title="Lecture Only: No practical sections or tutorials">
                                Lecture Only
                              </span>
                            ) : (
                              <span className="code-pill pill-success" title="Has Lectures and Practical Sections/Labs">
                                Has Sections
                              </span>
                            )}
                          </div>
                          <div className="entry-sub-line">
                            <span>{yr?.name || 'All Years'}</span>
                            <span>• {c.creditHours} Credits</span>
                            <span>• {c.department}</span>
                          </div>
                          {c.prerequisiteIds && c.prerequisiteIds.length > 0 && (
                            <div className="entry-prereq-line">
                              <span className="prereq-pill" title="Prerequisites for GPA system">
                                🔗 Depends on: {c.prerequisiteIds.map((pid) => courses.find((x) => x.id === pid)?.code || pid).join(', ')}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="entry-buttons">
                          {isPreparatoryYear(c.yearId) && <button
                            className={`icon-btn group-toggle-btn ${c.hasSections === false ? 'active-group-b' : ''}`}
                            onClick={() => handleQuickToggleHasSections(c)}
                            title={`Sections: ${c.hasSections === false ? 'Lecture Only (No Sections)' : 'Has Sections & Labs'}. Click to toggle.`}
                          >
                            <Layers size={15} />
                          </button>}
                          <button
                            className={`icon-btn group-toggle-btn ${c.targetGroup === 'GROUP_A' ? 'active-group-a' : c.targetGroup === 'GROUP_B' ? 'active-group-b' : ''}`}
                            onClick={() => handleQuickToggleTargetGroup(c)}
                            title={`Cohort: ${c.targetGroup === 'GROUP_A' ? 'Group A Only' : c.targetGroup === 'GROUP_B' ? 'Group B Only' : 'Both Groups (A & B)'}. Click to cycle cohort.`}
                          >
                            <Users size={15} />
                          </button>
                          <button className="icon-btn" onClick={() => handleEditCourse(c)} title="Edit Course">
                            <Edit2 size={15} />
                          </button>
                          <button className="icon-btn danger" onClick={() => handleDeleteCourse(c.id)} title="Delete Course">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* 4. ACADEMIC DEPARTMENTS / PROGRAMS */}
        {activeTab === 'PROGRAMS' && (
          <div className="admin-grid-layout">
            <div className="admin-panel card-glow">
              <div className="panel-header">
                <div className="panel-title-group">
                  <GraduationCap size={18} className="text-amber" />
                  <h2 className="panel-title-text">Register Academic Department (Program)</h2>
                </div>
              </div>

              <form onSubmit={handleSaveProgram} className="admin-panel-form">
                <div className="form-group">
                  <label className="form-label">Department / Program Code (Short Identifier) *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. CS, SE, AI, CYBER"
                    value={progCode}
                    onChange={(e) => setProgCode(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Academic Department Name (Program Name) *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Computer Science, Software Engineering"
                    value={progName}
                    onChange={(e) => setProgName(e.target.value)}
                    required
                  />
                </div>
                <div className="text-xs text-muted mb-2">
                  💡 In this institution, the Academic Department name and Degree Program name are the same.
                </div>
                <div className="form-actions-row">
                  <button type="submit" className="admin-submit-btn">
                    <Plus size={16} />
                    <span>Register Academic Department</span>
                  </button>
                </div>
              </form>
            </div>

            <div className="admin-panel">
              <div className="panel-header">
                <div className="panel-title-group">
                  <Filter size={16} className="text-secondary" />
                  <h2 className="panel-title-text">Academic Departments ({filteredPrograms.length})</h2>
                </div>
              </div>

              <div className="admin-page-list">
                {filteredPrograms.length === 0 ? (
                  <div className="admin-empty-state">
                    <p>No academic departments registered yet. Use the form to add departments.</p>
                  </div>
                ) : (
                  filteredPrograms.map((p) => {
                    const progSecs = sections.filter((s) => s.programId === p.id);
                    const progCourses = courses.filter((c) => c.programIds?.includes(p.id) || c.programId === p.id);
                    return (
                      <div key={p.id} className="admin-entry-card">
                        <div className="entry-details">
                          <div className="entry-title-line">
                            <span className="code-pill highlight-pill">{p.code}</span>
                            <span className="entry-name">{p.name}</span>
                          </div>
                          <div className="entry-sub-line">
                            <span>{progCourses.length} Course{progCourses.length === 1 ? '' : 's'}</span>
                            <span>• {progSecs.length} Active Section{progSecs.length === 1 ? '' : 's'}</span>
                          </div>
                        </div>
                        <div className="entry-buttons">
                          <button className="icon-btn danger" onClick={() => handleDeleteProgram(p.id)} title="Delete Department">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* 5. SECTIONS MANAGEMENT */}
        {activeTab === 'SECTIONS' && (
          <div className="admin-grid-layout">
            <div className="admin-panel card-glow">
              <div className="panel-header">
                <div className="panel-title-group">
                  <Layers size={18} className="text-purple" />
                  <h2 className="panel-title-text">Create Section / Lab Cohort</h2>
                </div>
              </div>

              <form onSubmit={handleSaveSection} className="admin-panel-form">
                <div className="form-group">
                  <label className="form-label">Academic Year</label>
                  <select
                    className="form-select"
                    value={secYearId}
                    onChange={(e) => setSecYearId(Number(e.target.value))}
                  >
                    {years.map((y) => (
                      <option key={y.id} value={y.id}>
                        {y.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Degree Program (Program Specific Section)</label>
                  <select
                    className="form-select"
                    value={secProgramId}
                    onChange={(e) => setSecProgramId(e.target.value ? Number(e.target.value) : '')}
                  >
                    <option value="">None / General Cohort (Prep Year)</option>
                    {programs.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.code} - {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Section Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Section 1 (Lab Group A)"
                    value={secName}
                    onChange={(e) => setSecName(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Cohort Capacity (Max Students)</label>
                  <input
                    type="number"
                    className="form-input"
                    min="5"
                    max="100"
                    value={secCapacity}
                    onChange={(e) => setSecCapacity(Number(e.target.value))}
                    required
                  />
                </div>
                <div className="form-actions-row">
                  <button type="submit" className="admin-submit-btn">
                    <Plus size={16} />
                    <span>Create Section Group</span>
                  </button>
                </div>
              </form>
            </div>

            <div className="admin-panel">
              <div className="panel-header">
                <div className="panel-title-group">
                  <Filter size={16} className="text-secondary" />
                  <h2 className="panel-title-text">Section Groups ({filteredSections.length})</h2>
                </div>
              </div>

              <div className="admin-page-list">
                {filteredSections.length === 0 ? (
                  <div className="admin-empty-state">
                    <p>No sections registered yet. Use the form to add student tutorial or lab sections.</p>
                  </div>
                ) : (
                  filteredSections.map((s) => {
                    const yr = years.find((y) => y.id === s.yearId);
                    const prog = programs.find((p) => p.id === s.programId);
                    return (
                      <div key={s.id} className="admin-entry-card">
                        <div className="entry-details">
                          <div className="entry-title-line">
                            {prog ? (
                              <span className="code-pill highlight-pill" style={{ background: 'rgba(99, 102, 241, 0.18)', color: '#818cf8' }}>
                                {prog.code}
                              </span>
                            ) : (
                              <span className="code-pill" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
                                General Prep
                              </span>
                            )}
                            <span className="code-pill">{s.name}</span>
                            <span className="entry-name">{yr?.name}</span>
                          </div>
                          <div className="entry-sub-line">
                            <span>{prog ? prog.name : 'General Cohort'}</span>
                            <span>• Max Capacity: {s.capacity} students</span>
                          </div>
                        </div>
                        <div className="entry-buttons">
                          <button className="icon-btn danger" onClick={() => handleDeleteSection(s.id)} title="Delete Section">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
