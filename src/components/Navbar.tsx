import { useRef, type ChangeEvent, type FC } from 'react';
import {
  Download,
  Upload,
  RotateCcw,
  ShieldCheck,
  User,
  LogOut,
  Building,
  GraduationCap,
  PlusCircle,
  Settings,
  Calendar,
} from 'lucide-react';
import type { AcademicYear, AdminUser } from '../db/schema';
import { exportDatabaseFile, importDatabaseFile } from '../db/sqlite';

interface NavbarProps {
  years: AcademicYear[];
  selectedYearId: number | 'ALL';
  onSelectYear: (yearId: number | 'ALL') => void;
  viewMode: 'YEAR' | 'PROGRAM' | 'ROOM' | 'PROFESSOR';
  onViewModeChange: (mode: 'YEAR' | 'PROGRAM' | 'ROOM' | 'PROFESSOR') => void;
  currentPage: 'TIMETABLE' | 'ADMIN_HUB';
  onNavigate: (page: 'TIMETABLE' | 'ADMIN_HUB') => void;
  adminUser: AdminUser | null;
  onOpenLogin: () => void;
  onLogout: () => void;
  onOpenNewSchedule: () => void;
  onResetDb: () => void;
  onRefreshData: () => void;
}

export const Navbar: FC<NavbarProps> = ({
  years,
  selectedYearId,
  onSelectYear,
  viewMode,
  onViewModeChange,
  currentPage,
  onNavigate,
  adminUser,
  onOpenLogin,
  onLogout,
  onOpenNewSchedule,
  onResetDb,
  onRefreshData,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    try {
      await exportDatabaseFile();
    } catch (err) {
      alert('Failed to export SQLite database: ' + err);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await importDatabaseFile(file);
      onRefreshData();
      alert('SQLite database imported successfully!');
    } catch (err) {
      alert('Import failed: ' + (err as Error).message);
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  return (
    <header className="navbar-container">
      {/* Top Banner & University Branding */}
      <div className="navbar-top">
        <div className="brand-group brand-interactive" onClick={() => onNavigate('TIMETABLE')} title="Return to Timetable">
          <div className="brand-icon">
            <GraduationCap className="icon-glow" size={28} />
          </div>
          <div>
            <h1 className="brand-title">UniSchedule Pro</h1>
            <p className="brand-subtitle">Faculty of Engineering | East Port Said University Academic Timetable</p>
          </div>
        </div>

        {/* Database & Admin Actions */}
        <div className="header-actions">
          {/* SQLite DB Controls */}
          <div className="sqlite-badge-group">
            <span className="sqlite-indicator" title="Connected to offline SQLite WebAssembly database">
              <span className="pulse-dot"></span>
              SQLite Active
            </span>

            <button
              onClick={handleExport}
              className="action-btn text-btn"
              title="Export offline SQLite database file (.sqlite)"
            >
              <Download size={15} />
              <span>Export DB</span>
            </button>

            <button
              onClick={handleImportClick}
              className="action-btn text-btn"
              title="Import an existing SQLite database file"
            >
              <Upload size={15} />
              <span>Import DB</span>
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".sqlite,.db,.sqlite3"
              style={{ display: 'none' }}
            />

            <button
              onClick={onResetDb}
              className="action-btn text-btn danger-hover"
              title="Reset database to default sample university schedule"
            >
              <RotateCcw size={15} />
              <span>Reset</span>
            </button>
          </div>

          {/* Admin Authentication & Management */}
          {adminUser ? (
            <div className="admin-status-group">
              {currentPage === 'ADMIN_HUB' ? (
                <button
                  onClick={() => onNavigate('TIMETABLE')}
                  className="action-btn primary-subtle nav-page-switch-btn active-page-btn"
                  title="Return to Timetable Schedule"
                >
                  <Calendar size={16} />
                  <span>Timetable View</span>
                </button>
              ) : (
                <button
                  onClick={() => onNavigate('ADMIN_HUB')}
                  className="action-btn primary-subtle nav-page-switch-btn"
                  title="Open University Administration Hub Page"
                >
                  <Settings size={16} />
                  <span>Admin Hub Page</span>
                </button>
              )}

              <button
                onClick={onOpenNewSchedule}
                className="action-btn primary-btn highlight-glow"
              >
                <PlusCircle size={16} />
                <span>Schedule Session</span>
              </button>

              <div className="admin-user-pill">
                <ShieldCheck size={16} className="text-emerald" />
                <span className="admin-name">{adminUser.displayName}</span>
                <button
                  onClick={onLogout}
                  className="logout-icon-btn"
                  title="Log out of Admin"
                >
                  <LogOut size={14} />
                </button>
              </div>
            </div>
          ) : (
            <div className="login-group">
              <button onClick={onOpenLogin} className="action-btn login-btn">
                <ShieldCheck size={16} />
                <span>Admin Login</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Sub-bar: Academic Years & View Mode Switches (Visible on Timetable page) */}
      {currentPage === 'TIMETABLE' ? (
        <div className="navbar-bottom">
          {/* Academic Year Tabs */}
          <div className="year-tabs-container">
            <span className="tab-label">Academic Year:</span>
            <div className="year-tabs">
              {years.map((y) => (
                <button
                  key={y.id}
                  className={`year-tab ${selectedYearId === y.id ? 'active' : ''}`}
                  onClick={() => onSelectYear(y.id)}
                >
                  {y.name}
                </button>
              ))}
              <button
                className={`year-tab ${selectedYearId === 'ALL' ? 'active' : ''}`}
                onClick={() => onSelectYear('ALL')}
              >
                All Years (Master)
              </button>
            </div>
          </div>

          {/* View Mode Filters */}
          <div className="view-mode-tabs">
            <button
              className={`view-mode-btn ${viewMode === 'YEAR' ? 'active' : ''}`}
              onClick={() => onViewModeChange('YEAR')}
            >
              <Calendar size={15} />
              <span>By Year & Cohort</span>
            </button>
            <button
              className={`view-mode-btn ${viewMode === 'PROGRAM' ? 'active' : ''}`}
              onClick={() => onViewModeChange('PROGRAM')}
              title="Show each degree program independently"
            >
              <GraduationCap size={15} />
              <span>By Program</span>
            </button>
            <button
              className={`view-mode-btn ${viewMode === 'ROOM' ? 'active' : ''}`}
              onClick={() => onViewModeChange('ROOM')}
            >
              <Building size={15} />
              <span>By Room Occupancy</span>
            </button>
            <button
              className={`view-mode-btn ${viewMode === 'PROFESSOR' ? 'active' : ''}`}
              onClick={() => onViewModeChange('PROFESSOR')}
            >
              <User size={15} />
              <span>By Professor</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="navbar-bottom admin-hub-subbar">
          <div className="admin-page-crumb">
            <Settings size={15} className="text-sky" />
            <span className="font-semibold">Administration Workspace</span>
            <span className="text-muted">• Manage campus facilities, professors, curriculum & cohorts</span>
          </div>
          <button
            onClick={() => onNavigate('TIMETABLE')}
            className="action-btn text-btn text-xs"
          >
            ← Back to Timetable
          </button>
        </div>
      )}
    </header>
  );
};
