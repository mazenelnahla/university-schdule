import { useState, useEffect, useCallback } from "react";
import { Navbar } from "./components/Navbar";
import { TimetableCalendar } from "./components/TimetableCalendar";
import { ScheduleDialog } from "./components/ScheduleDialog";
import { LoginModal } from "./components/LoginModal";
import { AdminHubPage } from "./components/AdminHubPage";
import { PrintTimetableModal } from "./components/PrintTimetableModal";
import { AutoScheduleModal } from "./components/AutoScheduleModal";
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
  TeachingAssistant,
  TeachingAssignment,
} from "./db/schema";
import {
  getAcademicYears,
  getPrograms,
  getSections,
  getProfessors,
  getTeachingAssistants,
  getTeachingAssignments,
  getRooms,
  getCourses,
  getStandardPeriods,
  getAllSchedulesWithDetails,
  deleteSchedule,
  clearAllSchedules,
} from "./db/scheduleService";
import { resetDatabaseToEmpty } from "./db/sqlite";
import { GraduationCap, Loader2 } from "lucide-react";

const ADMIN_STORAGE_KEY = "unischedule_admin_user";

export function App() {
  const [adminUser, setAdminUser] = useState<AdminUser | null>(() => {
    const saved = localStorage.getItem(ADMIN_STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
  });

  const [currentPage, setCurrentPage] = useState<"TIMETABLE" | "ADMIN_HUB">(
    "TIMETABLE",
  );
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [professors, setProfessors] = useState<Professor[]>([]);
  const [teachingAssistants, setTeachingAssistants] = useState<TeachingAssistant[]>([]);
  const [teachingAssignments, setTeachingAssignments] = useState<TeachingAssignment[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [standardPeriods, setStandardPeriods] = useState<StandardPeriod[]>([]);
  const [schedules, setSchedules] = useState<ScheduleWithDetails[]>([]);

  const [selectedYearId, setSelectedYearId] = useState<number | "ALL">(1);
  const [viewMode, setViewMode] = useState<
    "YEAR" | "PROGRAM" | "ROOM" | "PROFESSOR"
  >("YEAR");

  // Modals state
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isAutoScheduleModalOpen, setIsAutoScheduleModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] =
    useState<ScheduleWithDetails | null>(null);
  const [dialogSlotProps, setDialogSlotProps] = useState<{
    dayOfWeek?: number;
    periodId?: number;
    yearId?: number;
    sectionId?: number;
    roomId?: number;
    programId?: number | "ALL";
  }>({});

  // Load all data from SQLite
  const loadData = useCallback(async () => {
    try {
      const [
        fetchedYears,
        fetchedPrograms,
        fetchedSections,
        fetchedProfs,
        fetchedTeachingAssistants,
        fetchedTeachingAssignments,
        fetchedRooms,
        fetchedCourses,
        fetchedPeriods,
        fetchedSchedules,
      ] = await Promise.all([
        getAcademicYears(),
        getPrograms(),
        getSections(),
        getProfessors(),
        getTeachingAssistants(),
        getTeachingAssignments(),
        getRooms(),
        getCourses(),
        getStandardPeriods(),
        getAllSchedulesWithDetails(),
      ]);

      setYears(fetchedYears);
      setPrograms(fetchedPrograms);
      setSections(fetchedSections);
      setProfessors(fetchedProfs);
      setTeachingAssistants(fetchedTeachingAssistants);
      setTeachingAssignments(fetchedTeachingAssignments);
      setRooms(fetchedRooms);
      setCourses(fetchedCourses);
      setStandardPeriods(fetchedPeriods);
      setSchedules(fetchedSchedules);

      if (
        fetchedYears.length > 0 &&
        selectedYearId === 1 &&
        !fetchedYears.some((y) => y.id === 1)
      ) {
        setSelectedYearId(fetchedYears[0].id);
      }
    } catch (err) {
      console.error("Error loading data from SQLite:", err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedYearId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Intercept browser print (Cmd+P / Ctrl+P or File -> Print) to show print modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "p") {
        e.preventDefault();
        setIsPrintModalOpen(true);
      }
    };
    const handleBeforePrint = () => {
      setIsPrintModalOpen(true);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("beforeprint", handleBeforePrint);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("beforeprint", handleBeforePrint);
    };
  }, []);

  // Auth Handlers
  const handleLoginSuccess = (user: AdminUser) => {
    setAdminUser(user);
    localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(user));
  };

  const handleLogout = () => {
    setAdminUser(null);
    localStorage.removeItem(ADMIN_STORAGE_KEY);
    setCurrentPage("TIMETABLE");
  };

  // Reset database to completely empty state (removes all schedules & sample data)
  const handleResetDb = async () => {
    if (
      window.confirm(
        "Are you sure you want to reset and clear everything? All schedules, courses, sections, rooms, professors, and programs will be permanently deleted, leaving an empty database.",
      )
    ) {
      setIsLoading(true);
      await resetDatabaseToEmpty();
      await loadData();
    }
  };

  // Clear only scheduled timetable sessions (preserves faculty, rooms, courses, programs, sections)
  const handleClearTimetable = async () => {
    if (
      window.confirm(
        "Clear all scheduled sessions from the timetable? Your faculty members, degree programs, courses, sections, and halls/rooms will NOT be deleted.",
      )
    ) {
      setIsLoading(true);
      await clearAllSchedules();
      await loadData();
    }
  };

  // Optional: Load sample demo timetable data
  const handleLoadSampleDb = async () => {
    if (
      window.confirm(
        "Restore sample university demo curriculum, rooms, and schedule?",
      )
    ) {
      setIsLoading(true);
      await loadData();
    }
  };

  // Schedule Actions
  const handleOpenNewSchedule = (
    dayOfWeek: number = 0,
    periodId?: number,
    extra?: {
      roomId?: number;
      yearId?: number;
      sectionId?: number;
      programId?: number | "ALL";
    },
  ) => {
    setEditingSchedule(null);
    setDialogSlotProps({
      dayOfWeek,
      periodId,
      yearId:
        extra?.yearId ||
        (typeof selectedYearId === "number" ? selectedYearId : years[0]?.id),
      sectionId: extra?.sectionId,
      roomId: extra?.roomId,
      programId: extra?.programId,
    });
    setIsScheduleDialogOpen(true);
  };

  const handleEditSchedule = (item: ScheduleWithDetails) => {
    setEditingSchedule(item);
    setDialogSlotProps({});
    setIsScheduleDialogOpen(true);
  };

  const handleDeleteSchedule = async (id: number) => {
    try {
      await deleteSchedule(id);
      loadData();
    } catch (err) {
      alert("Failed to delete schedule: " + (err as Error).message);
    }
  };

  if (isLoading) {
    return (
      <div className="app-loading-screen">
        <div className="loading-card">
          <div className="loading-spinner-wrap">
            <GraduationCap className="loading-brand-icon" size={40} />
            <Loader2 className="spinner-icon animate-spin" size={64} />
          </div>
          <h2>Initializing SQLite WASM Database...</h2>
          <p>Loading offline university timetable &amp; conflict engine</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`app-container ${isPrintModalOpen ? "print-modal-active" : ""}`}
    >
      {/* Navigation & Header */}
      <Navbar
        years={years}
        selectedYearId={selectedYearId}
        onSelectYear={setSelectedYearId}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        currentPage={currentPage}
        onNavigate={(p) => {
          if (p === "ADMIN_HUB" && !adminUser) {
            setIsLoginModalOpen(true);
          } else {
            setCurrentPage(p);
          }
        }}
        adminUser={adminUser}
        onOpenLogin={() => setIsLoginModalOpen(true)}
        onLogout={handleLogout}
        onOpenNewSchedule={() => handleOpenNewSchedule()}
        onResetDb={handleResetDb}
        onClearTimetable={handleClearTimetable}
        onLoadSampleDb={handleLoadSampleDb}
        onRefreshData={loadData}
        onOpenAutoSchedule={() => {
          if (!adminUser) {
            setIsLoginModalOpen(true);
          } else {
            setIsAutoScheduleModalOpen(true);
          }
        }}
      />

      {/* Main Page: Timetable or Admin Hub Page */}
      {currentPage === "TIMETABLE" ? (
        <main className="main-content">
          <TimetableCalendar
            schedules={schedules}
            years={years}
            programs={programs}
            sections={sections}
            professors={professors}
            rooms={rooms}
            courses={courses}
            standardPeriods={standardPeriods}
            selectedYearId={selectedYearId}
            viewMode={viewMode}
            adminUser={adminUser}
            onEditSchedule={handleEditSchedule}
            onDeleteSchedule={handleDeleteSchedule}
            onAddNewSlot={handleOpenNewSchedule}
            onClearTimetable={handleClearTimetable}
            onOpenPrint={() => setIsPrintModalOpen(true)}
            onOpenAutoSchedule={() => {
              if (!adminUser) {
                setIsLoginModalOpen(true);
              } else {
                setIsAutoScheduleModalOpen(true);
              }
            }}
          />
        </main>
      ) : (
        <main className="main-content admin-hub-view-container">
          <AdminHubPage
            professors={professors}
            teachingAssistants={teachingAssistants}
            teachingAssignments={teachingAssignments}
            rooms={rooms}
            courses={courses}
            years={years}
            sections={sections}
            programs={programs}
            onDataChanged={loadData}
            onBackToTimetable={() => setCurrentPage("TIMETABLE")}
            onOpenAutoSchedule={() => setIsAutoScheduleModalOpen(true)}
          />
        </main>
      )}

      {/* Schedule Dialog (Add / Edit) */}
      <ScheduleDialog
        isOpen={isScheduleDialogOpen}
        onClose={() => setIsScheduleDialogOpen(false)}
        onSuccess={loadData}
        years={years}
        programs={programs}
        sections={sections}
        professors={professors}
        rooms={rooms}
        courses={courses}
        standardPeriods={standardPeriods}
        initialDayOfWeek={dialogSlotProps.dayOfWeek}
        initialPeriodId={dialogSlotProps.periodId}
        initialYearId={dialogSlotProps.yearId}
        initialProgramId={dialogSlotProps.programId}
        editingSchedule={editingSchedule}
      />

      {/* Print Timetable Modal */}
      <PrintTimetableModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        years={years}
        programs={programs}
        sections={sections}
        professors={professors}
        rooms={rooms}
        courses={courses}
        standardPeriods={standardPeriods}
        schedules={schedules}
        initialYearId={selectedYearId}
      />

      {/* Auto-Schedule Timetable Modal */}
      <AutoScheduleModal
        isOpen={isAutoScheduleModalOpen}
        onClose={() => setIsAutoScheduleModalOpen(false)}
        years={years}
        courses={courses}
        initialYearId={selectedYearId}
        onSuccess={loadData}
      />

      {/* Admin Login Modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onLoginSuccess={(user) => {
          handleLoginSuccess(user);
          setCurrentPage("ADMIN_HUB");
        }}
      />
    </div>
  );
}

export default App;
