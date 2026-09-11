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
} from 'lucide-react';
import type {
  Professor,
  Room,
  Course,
  AcademicYear,
  Section,
  Program,
  RoomType,
} from '../db/schema';
import {
  addProfessor,
  updateProfessor,
  deleteProfessor,
  addRoom,
  updateRoom,
  deleteRoom,
  addCourse,
  deleteCourse,
  addSection,
  deleteSection,
  addProgram,
  deleteProgram,
} from '../db/scheduleService';

interface AdminHubPageProps {
  professors: Professor[];
  rooms: Room[];
  courses: Course[];
  years: AcademicYear[];
  sections: Section[];
  programs: Program[];
  onDataChanged: () => void;
  onBackToTimetable: () => void;
}

export const AdminHubPage: FC<AdminHubPageProps> = ({
  professors,
  rooms,
  courses,
  years,
  sections,
  programs,
  onDataChanged,
  onBackToTimetable,
}) => {
  const [activeTab, setActiveTab] = useState<'ROOMS' | 'PROFESSORS' | 'COURSES' | 'SECTIONS' | 'PROGRAMS'>('ROOMS');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Professors Form State
  const [profName, setProfName] = useState('');
  const [profTitle, setProfTitle] = useState('Prof.');
  const [profDept, setProfDept] = useState('Computer Science');
  const [profEmail, setProfEmail] = useState('');
  const [profPhone, setProfPhone] = useState('');
  const [profOffice, setProfOffice] = useState('');
  const [editingProfId, setEditingProfId] = useState<number | null>(null);

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
  const [courseDept, setCourseDept] = useState('Computer Science');
  const [courseYearId, setCourseYearId] = useState<number>(years[0]?.id || 1);
  const [courseColor, setCourseColor] = useState('#3b82f6');

  // Sections Form State
  const [secYearId, setSecYearId] = useState<number>(years[0]?.id || 1);
  const [secProgramId, setSecProgramId] = useState<number>(programs[0]?.id || 1);
  const [secName, setSecName] = useState('');
  const [secCapacity, setSecCapacity] = useState(30);

  // Programs Form State
  const [progCode, setProgCode] = useState('');
  const [progName, setProgName] = useState('');
  const [progDept, setProgDept] = useState('Department of Computer Science');

  const showStatus = (text: string, type: 'success' | 'error' = 'success') => {
    setStatusMessage({ type, text });
    setTimeout(() => setStatusMessage(null), 3500);
  };

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

  const filteredCourses = useMemo(() => {
    if (!searchQuery) return courses;
    const q = searchQuery.toLowerCase();
    return courses.filter((c) => c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q) || c.department.toLowerCase().includes(q));
  }, [courses, searchQuery]);

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

  // PROGRAM HANDLERS
  const handleSaveProgram = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await addProgram({
        code: progCode.trim().toUpperCase(),
        name: progName.trim(),
        department: progDept.trim(),
      });
      showStatus('Academic program added successfully!');
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
      if (editingProfId) {
        await updateProfessor(editingProfId, {
          name: profName.trim(),
          title: profTitle,
          department: profDept.trim(),
          email: profEmail.trim(),
          phone: profPhone.trim() || undefined,
          office: profOffice.trim() || undefined,
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
        });
        showStatus('Professor added successfully!');
      }
      setEditingProfId(null);
      setProfName('');
      setProfEmail('');
      setProfPhone('');
      setProfOffice('');
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
      await addCourse({
        code: courseCode.trim().toUpperCase(),
        name: courseName.trim(),
        creditHours: Number(courseCredits),
        department: courseDept.trim(),
        yearId: Number(courseYearId),
        colorHex: courseColor,
      });
      showStatus('Course added successfully!');
      setCourseCode('');
      setCourseName('');
      onDataChanged();
    } catch (err) {
      showStatus((err as Error).message, 'error');
    }
  };

  const handleDeleteCourse = async (id: number) => {
    if (!window.confirm('Delete this course?')) return;
    try {
      await deleteCourse(id);
      showStatus('Course deleted.');
      onDataChanged();
    } catch (err) {
      showStatus((err as Error).message, 'error');
    }
  };

  // SECTION HANDLERS
  const handleSaveSection = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await addSection({
        yearId: Number(secYearId),
        programId: Number(secProgramId),
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
          <button onClick={onBackToTimetable} className="action-btn secondary-btn back-btn">
            <ArrowLeft size={16} />
            <span>Back to Timetable</span>
          </button>
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
            <span>Degree Programs ({programs.length})</span>
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
                      className="action-btn secondary-btn"
                      onClick={() => {
                        setEditingRoomId(null);
                        setRoomCode('');
                        setRoomName('');
                      }}
                    >
                      Cancel
                    </button>
                  )}
                  <button type="submit" className="action-btn primary-btn highlight-glow">
                    {editingRoomId ? 'Update Room Details' : 'Add Room to System'}
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
                {filteredRooms.map((r) => (
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
                ))}
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
                  <label className="form-label">Department *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Computer Science"
                    value={profDept}
                    onChange={(e) => setProfDept(e.target.value)}
                    required
                  />
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
                <div className="form-actions-row">
                  {editingProfId && (
                    <button
                      type="button"
                      className="action-btn secondary-btn"
                      onClick={() => {
                        setEditingProfId(null);
                        setProfName('');
                        setProfEmail('');
                      }}
                    >
                      Cancel
                    </button>
                  )}
                  <button type="submit" className="action-btn primary-btn highlight-glow">
                    {editingProfId ? 'Update Faculty Details' : 'Add Faculty Member'}
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
                {filteredProfessors.map((p) => (
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
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 3. COURSES MANAGEMENT */}
        {activeTab === 'COURSES' && (
          <div className="admin-grid-layout">
            <div className="admin-panel card-glow">
              <div className="panel-header">
                <div className="panel-title-group">
                  <BookOpen size={18} className="text-emerald" />
                  <h2 className="panel-title-text">Add Course to Curriculum</h2>
                </div>
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
                    <label className="form-label">Color Identifier</label>
                    <input
                      type="color"
                      className="form-color-input"
                      value={courseColor}
                      onChange={(e) => setCourseColor(e.target.value)}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Department</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Computer Science"
                    value={courseDept}
                    onChange={(e) => setCourseDept(e.target.value)}
                    required
                  />
                </div>
                <button type="submit" className="action-btn primary-btn highlight-glow">
                  Add Course to System
                </button>
              </form>
            </div>

            <div className="admin-panel">
              <div className="panel-header">
                <div className="panel-title-group">
                  <Filter size={16} className="text-secondary" />
                  <h2 className="panel-title-text">Active Courses ({filteredCourses.length})</h2>
                </div>
              </div>

              <div className="admin-page-list">
                {filteredCourses.map((c) => {
                  const yr = years.find((y) => y.id === c.yearId);
                  return (
                    <div key={c.id} className="admin-entry-card">
                      <div className="entry-details">
                        <div className="entry-title-line">
                          <span className="color-indicator" style={{ backgroundColor: c.colorHex }}></span>
                          <span className="code-pill">{c.code}</span>
                          <span className="entry-name">{c.name}</span>
                        </div>
                        <div className="entry-sub-line">
                          <span>{yr?.name || 'All Years'}</span>
                          <span>• {c.creditHours} Credits</span>
                          <span>• {c.department}</span>
                        </div>
                      </div>
                      <div className="entry-buttons">
                        <button className="icon-btn danger" onClick={() => handleDeleteCourse(c.id)} title="Delete Course">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* 4. ACADEMIC PROGRAMS */}
        {activeTab === 'PROGRAMS' && (
          <div className="admin-grid-layout">
            <div className="admin-panel card-glow">
              <div className="panel-header">
                <div className="panel-title-group">
                  <GraduationCap size={18} className="text-amber" />
                  <h2 className="panel-title-text">Register Degree Program</h2>
                </div>
              </div>

              <form onSubmit={handleSaveProgram} className="admin-panel-form">
                <div className="form-group">
                  <label className="form-label">Program Code (Short Identifier) *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. AI, SE, CS, CYBER"
                    value={progCode}
                    onChange={(e) => setProgCode(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Program Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Artificial Intelligence & Data Science"
                    value={progName}
                    onChange={(e) => setProgName(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Academic Department *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Department of Computer Science"
                    value={progDept}
                    onChange={(e) => setProgDept(e.target.value)}
                    required
                  />
                </div>
                <button type="submit" className="action-btn primary-btn highlight-glow">
                  Register Degree Program
                </button>
              </form>
            </div>

            <div className="admin-panel">
              <div className="panel-header">
                <div className="panel-title-group">
                  <Filter size={16} className="text-secondary" />
                  <h2 className="panel-title-text">Academic Degree Programs ({filteredPrograms.length})</h2>
                </div>
              </div>

              <div className="admin-page-list">
                {filteredPrograms.map((p) => {
                  const progSecs = sections.filter((s) => s.programId === p.id);
                  return (
                    <div key={p.id} className="admin-entry-card">
                      <div className="entry-details">
                        <div className="entry-title-line">
                          <span className="code-pill highlight-pill">{p.code}</span>
                          <span className="entry-name">{p.name}</span>
                        </div>
                        <div className="entry-sub-line">
                          <span>{p.department}</span>
                          <span>• {progSecs.length} Active Section{progSecs.length === 1 ? '' : 's'}</span>
                        </div>
                      </div>
                      <div className="entry-buttons">
                        <button className="icon-btn danger" onClick={() => handleDeleteProgram(p.id)} title="Delete Program">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  );
                })}
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
                  <label className="form-label">Degree Program (Program Specific Section) *</label>
                  <select
                    className="form-select"
                    value={secProgramId}
                    onChange={(e) => setSecProgramId(Number(e.target.value))}
                  >
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
                <button type="submit" className="action-btn primary-btn highlight-glow">
                  Create Section Group
                </button>
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
                {filteredSections.map((s) => {
                  const yr = years.find((y) => y.id === s.yearId);
                  const prog = programs.find((p) => p.id === s.programId);
                  return (
                    <div key={s.id} className="admin-entry-card">
                      <div className="entry-details">
                        <div className="entry-title-line">
                          {prog && (
                            <span className="code-pill highlight-pill" style={{ background: 'rgba(99, 102, 241, 0.18)', color: '#818cf8' }}>
                              {prog.code}
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
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
