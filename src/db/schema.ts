export type SessionType = 'LECTURE' | 'SECTION';

export interface AdminUser {
  id: number;
  username: string;
  displayName: string;
}

export interface AcademicYear {
  id: number;
  code: string; // e.g., 'YEAR_1', 'YEAR_2'
  name: string; // e.g., 'Year 1 - Freshman'
  semester: string; // e.g., 'Fall 2026'
}

export interface Program {
  id: number;
  code: string; // e.g., 'CS', 'SE', 'AI', 'CYBER'
  name: string; // e.g., 'Computer Science', 'Software Engineering'
  department: string;
}

export interface Section {
  id: number;
  yearId: number;
  programId: number | null;
  name: string; // e.g., 'Section 1', 'Section 2', 'Lab A'
  capacity: number;
  programName?: string;
  programCode?: string;
}

export interface Professor {
  id: number;
  name: string;
  title: string; // e.g., 'Prof.', 'Dr.', 'Eng.', 'TA'
  department: string;
  email: string;
  phone?: string;
  office?: string;
  availableDays?: number[]; // [0,1,2,3,4] where 0=Sun, 1=Mon, ..., 6=Sat. undefined/empty = available all days
}

export type RoomType = 'LECTURE_HALL' | 'COMPUTER_LAB' | 'TUTORIAL_ROOM' | 'WORKSHOP';

export interface Room {
  id: number;
  code: string; // e.g., 'Hall A', 'Lab 204', 'Room 102'
  name: string;
  type: RoomType;
  capacity: number;
  building: string;
  floor: number;
}

export type TargetGroup = 'ALL' | 'GROUP_A' | 'GROUP_B';

export interface Course {
  id: number;
  code: string; // e.g., 'CS101'
  name: string; // e.g., 'Introduction to Computer Science'
  creditHours: number;
  department: string;
  yearId: number;
  programId?: number | null; // null = Common Core / All Programs in this Year
  programCode?: string;
  programName?: string;
  colorHex?: string;
  prerequisiteIds?: number[]; // IDs of courses this course depends on (GPA system prerequisites)
  semester?: number; // 1 or 2
  targetGroup?: TargetGroup; // 'ALL' = both groups / all cohorts; 'GROUP_A' = Group A only; 'GROUP_B' = Group B only
  hasSections?: boolean; // true = has practical sections/labs (default); false = lecture only (no sections)
}

export interface StandardPeriod {
  id: number;
  periodNumber: number;
  startTime: string; // '10:00'
  endTime: string; // '11:15'
  label: string; // 'Period 1 (10:00 - 11:15)'
}

export interface ScheduleItem {
  id: number;
  academicYearId: number;
  courseId: number;
  sectionId: number | null; // null = entire year (e.g. for Lectures)
  professorId: number;
  roomId: number;
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, 2 = Tuesday, 3 = Wednesday, 4 = Thursday, 5 = Friday, 6 = Saturday
  periodId: number | null; // optional reference to standard period
  startTime: string; // '10:00'
  endTime: string; // '11:15'
  sessionType: SessionType;
  notes?: string;
}

export interface ScheduleWithDetails extends ScheduleItem {
  yearName: string;
  yearCode: string;
  sectionName?: string;
  programId?: number | null;
  programName?: string;
  programCode?: string;
  courseProgramId?: number | null;
  courseProgramCode?: string;
  courseProgramName?: string;
  courseCode: string;
  courseName: string;
  courseColor?: string;
  professorName: string;
  professorTitle: string;
  roomCode: string;
  roomName: string;
  roomType: RoomType;
  roomCapacity: number;
  building: string;
  roomFloor?: number;
  floor?: number;
}

export interface ConflictCheckResult {
  hasConflict: boolean;
  conflictType?: 'ROOM' | 'PROFESSOR' | 'SECTION' | 'PROFESSOR_AVAILABILITY' | 'COURSE_DEPENDENCY';
  message?: string;
  conflictingSchedule?: ScheduleWithDetails;
}
