import React, { useState, useEffect } from 'react';
import { 
  Trophy, Users, FileText, Settings, LogOut, 
  Upload, Download, Plus, Search, Menu, X, Save,
  BarChart3, Database, Shield, Trash2
} from 'lucide-react';
import { 
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, 
  CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import * as xlsx from 'xlsx';
import { db, auth } from './firebase';
import { collection, onSnapshot, addDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged, updatePassword, createUserWithEmailAndPassword } from 'firebase/auth';

// Types
interface Student {
  id: string;
  nis?: string;
  name: string;
  class: string;
}

interface Teacher {
  id: string;
  name: string;
}

interface Achievement {
  id: string;
  student_id: string;
  student_name: string;
  student_class: string;
  nis: string;
  date: string;
  achievement_type: string;
  competition_name: string;
  rank: string;
  certificate_path: string;
  homeroom_teacher: string;
  counseling_teacher: string;
  follow_up: string;
}

interface DashboardStats {
  totalStudents: number;
  totalAchievements: number;
  academicCount: number;
  nonAcademicCount: number;
  topStudents: { name: string; class: string; achievement_count: number }[];
}

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);

  // Login State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // Data State
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [homeroomTeachers, setHomeroomTeachers] = useState<Teacher[]>([]);
  const [counselingTeachers, setCounselingTeachers] = useState<Teacher[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsLoggedIn(!!user);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // Fetch Data
  useEffect(() => {
    if (!isAuthReady) return;

    const unsubStudents = onSnapshot(collection(db, 'students'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student));
      setStudents(data);
    });

    const unsubHomeroom = onSnapshot(collection(db, 'homeroom_teachers'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Teacher));
      setHomeroomTeachers(data);
    });

    const unsubCounseling = onSnapshot(collection(db, 'counseling_teachers'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Teacher));
      setCounselingTeachers(data);
    });

    const unsubAchievements = onSnapshot(collection(db, 'achievements'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Achievement));
      // sort by date descending
      data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setAchievements(data);
    });

    return () => {
      unsubStudents();
      unsubHomeroom();
      unsubCounseling();
      unsubAchievements();
    };
  }, [isAuthReady]);

  // Compute Stats
  useEffect(() => {
    const totalStudents = students.length;
    const totalAchievements = achievements.length;
    const academicCount = achievements.filter(a => a.achievement_type === 'Akademik').length;
    const nonAcademicCount = achievements.filter(a => a.achievement_type === 'Non Akademik').length;
    
    // Calculate top students
    const studentCounts: Record<string, { name: string, class: string, count: number }> = {};
    achievements.forEach(a => {
      if (!studentCounts[a.student_id]) {
        studentCounts[a.student_id] = { name: a.student_name, class: a.student_class, count: 0 };
      }
      studentCounts[a.student_id].count++;
    });
    
    const topStudents = Object.values(studentCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map(s => ({ name: s.name, class: s.class, achievement_count: s.count }));

    setStats({
      totalStudents,
      totalAchievements,
      academicCount,
      nonAcademicCount,
      topStudents
    });
  }, [students, achievements]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    
    // Shortcut for admin
    const loginEmail = email.toLowerCase() === 'admin' ? 'admin@sekolah.com' : email;
    
    try {
      await signInWithEmailAndPassword(auth, loginEmail, password);
    } catch (error: any) {
      if ((error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found') && loginEmail === 'admin@sekolah.com') {
        // Try creating the admin account if it's the first time
        try {
          await createUserWithEmailAndPassword(auth, loginEmail, password);
        } catch (createError: any) {
          if (createError.code === 'auth/email-already-in-use') {
            setLoginError('Password salah.');
          } else {
            setLoginError('Gagal login: ' + createError.message);
          }
        }
      } else {
        if (error.code === 'auth/invalid-credential') {
          setLoginError('Email atau password salah.');
        } else {
          setLoginError('Gagal login: ' + error.message);
        }
      }
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setEmail('');
    setPassword('');
  };

  if (!isAuthReady) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!isLoggedIn && activeTab !== 'dashboard') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="bg-indigo-600 p-8 text-center">
            <div className="flex justify-center mb-4">
              <img src="https://iili.io/KDFk4fI.png" alt="Logo" className="h-16 object-contain bg-white p-2 rounded-lg shadow-sm" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">PRESTASI SISWA</h1>
            <p className="text-indigo-100 mt-2 text-sm">Sistem Informasi Manajemen Prestasi</p>
          </div>
          <div className="p-8">
            <form onSubmit={handleLogin} className="space-y-6">
              {loginError && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm text-center border border-red-100">
                  {loginError}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                  placeholder="Masukkan email"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Password</label>
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                  placeholder="Masukkan password"
                  required
                />
              </div>
              <div className="space-y-3">
                <button 
                  type="submit"
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 rounded-xl transition-colors shadow-sm"
                >
                  Masuk ke Sistem
                </button>
                <button 
                  type="button"
                  onClick={() => setActiveTab('dashboard')}
                  className="w-full bg-white text-indigo-600 border border-indigo-200 hover:bg-indigo-50 font-medium py-3 rounded-xl transition-colors shadow-sm"
                >
                  Kembali ke Dashboard
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-white border-r border-slate-200 transition-all duration-300 flex flex-col fixed h-full z-20`}>
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-200">
          {sidebarOpen && (
            <div className="flex items-center gap-2 overflow-hidden">
              <img src="https://iili.io/KDFk4fI.png" alt="Logo" className="h-8 object-contain" />
              <span className="font-bold text-slate-800 truncate">PRESTASI SISWA</span>
            </div>
          )}
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 mx-auto">
            <Menu size={20} />
          </button>
        </div>
        
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          <NavItem icon={<BarChart3 />} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} isOpen={sidebarOpen} />
          <NavItem icon={<Database />} label="Master Data" active={activeTab === 'master'} onClick={() => setActiveTab('master')} isOpen={sidebarOpen} />
          <NavItem icon={<Plus />} label="Transaksi" active={activeTab === 'transaksi'} onClick={() => setActiveTab('transaksi')} isOpen={sidebarOpen} />
          <NavItem icon={<FileText />} label="Laporan" active={activeTab === 'laporan'} onClick={() => setActiveTab('laporan')} isOpen={sidebarOpen} />
          <NavItem icon={<Settings />} label="Pengaturan" active={activeTab === 'pengaturan'} onClick={() => setActiveTab('pengaturan')} isOpen={sidebarOpen} />
        </nav>

        <div className="p-4 border-t border-slate-200">
          {isLoggedIn ? (
            <button 
              onClick={handleLogout}
              className={`flex items-center gap-3 text-red-600 hover:bg-red-50 w-full p-2 rounded-lg transition-colors ${!sidebarOpen && 'justify-center'}`}
            >
              <LogOut size={20} />
              {sidebarOpen && <span className="font-medium">Keluar</span>}
            </button>
          ) : (
            <button 
              onClick={() => setActiveTab('master')}
              className={`flex items-center gap-3 text-indigo-600 hover:bg-indigo-50 w-full p-2 rounded-lg transition-colors ${!sidebarOpen && 'justify-center'}`}
            >
              <LogOut size={20} className="rotate-180" />
              {sidebarOpen && <span className="font-medium">Masuk</span>}
            </button>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className={`flex-1 transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-20'}`}>
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 sticky top-0 z-10">
          <h2 className="text-xl font-semibold text-slate-800 capitalize">
            {activeTab.replace('-', ' ')}
          </h2>
          <div className="flex items-center gap-4">
            {isLoggedIn ? (
              <div className="flex items-center gap-3 bg-slate-100 py-1.5 px-3 rounded-full">
                <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-sm">
                  A
                </div>
                <span className="text-sm font-medium text-slate-700 pr-2">Admin</span>
              </div>
            ) : (
              <button 
                onClick={() => setActiveTab('master')}
                className="text-sm font-medium text-indigo-600 bg-indigo-50 px-4 py-2 rounded-full hover:bg-indigo-100 transition-colors"
              >
                Login
              </button>
            )}
          </div>
        </header>

        <div className="p-8">
          {activeTab === 'dashboard' && <DashboardView stats={stats} />}
          {activeTab === 'master' && <MasterView students={students} homeroomTeachers={homeroomTeachers} counselingTeachers={counselingTeachers} onRefresh={() => {}} />}
          {activeTab === 'transaksi' && <TransactionView students={students} homeroomTeachers={homeroomTeachers} counselingTeachers={counselingTeachers} onRefresh={() => {}} setActiveTab={setActiveTab} />}
          {activeTab === 'laporan' && <ReportView achievements={achievements} />}
          {activeTab === 'pengaturan' && <SettingsView students={students} homeroomTeachers={homeroomTeachers} counselingTeachers={counselingTeachers} achievements={achievements} />}
        </div>
      </main>
    </div>
  );
}

// Components

function NavItem({ icon, label, active, onClick, isOpen }: any) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 w-full p-3 rounded-xl transition-all ${
        active 
          ? 'bg-indigo-50 text-indigo-700 font-medium' 
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
      } ${!isOpen && 'justify-center'}`}
      title={label}
    >
      <div className={`${active ? 'text-indigo-600' : 'text-slate-400'}`}>
        {icon}
      </div>
      {isOpen && <span>{label}</span>}
    </button>
  );
}

function DashboardView({ stats }: { stats: DashboardStats | null }) {
  if (!stats) return <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>;

  const pieData = [
    { name: 'Akademik', value: stats.academicCount, color: '#4f46e5' },
    { name: 'Non Akademik', value: stats.nonAcademicCount, color: '#0ea5e9' },
  ];

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total Siswa" value={stats.totalStudents} icon={<Users size={24} />} color="bg-indigo-50 text-indigo-600" />
        <StatCard title="Total Prestasi" value={stats.totalAchievements} icon={<Trophy size={24} />} color="bg-amber-50 text-amber-600" />
        <StatCard title="Prestasi Akademik" value={stats.academicCount} icon={<FileText size={24} />} color="bg-emerald-50 text-emerald-600" />
        <StatCard title="Prestasi Non Akademik" value={stats.nonAcademicCount} icon={<Trophy size={24} />} color="bg-sky-50 text-sky-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm lg:col-span-2">
          <h3 className="text-lg font-semibold text-slate-800 mb-6">Persentase Jenis Prestasi</h3>
          <div className="h-72 flex items-center justify-center">
            {stats.totalAchievements > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`${value} Prestasi`, 'Jumlah']} />
                  <Legend verticalAlign="bottom" height={36}/>
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-slate-400 flex flex-col items-center">
                <BarChart3 size={48} className="mb-2 opacity-20" />
                <p>Belum ada data prestasi</p>
              </div>
            )}
          </div>
        </div>

        {/* Top Students */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-800 mb-6">Siswa Berprestasi Terbanyak</h3>
          <div className="space-y-4">
            {stats.topStudents.length > 0 ? (
              stats.topStudents.map((s, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                      i === 0 ? 'bg-amber-100 text-amber-600' : 
                      i === 1 ? 'bg-slate-200 text-slate-600' : 
                      i === 2 ? 'bg-orange-100 text-orange-600' : 
                      'bg-indigo-50 text-indigo-600'
                    }`}>
                      {i + 1}
                    </div>
                    <div>
                      <p className="font-medium text-slate-800 text-sm">{s.name}</p>
                      <p className="text-xs text-slate-500">Kelas {s.class}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 bg-indigo-100 text-indigo-700 px-2 py-1 rounded-md text-xs font-bold">
                    <Trophy size={12} />
                    {s.achievement_count}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500 text-center py-8">Belum ada data</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, color }: any) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
      <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-sm font-medium text-slate-500 mb-1">{title}</p>
        <h4 className="text-2xl font-bold text-slate-800">{value}</h4>
      </div>
    </div>
  );
}

function MasterView({ students, homeroomTeachers, counselingTeachers, onRefresh }: { students: Student[], homeroomTeachers: Teacher[], counselingTeachers: Teacher[], onRefresh: () => void }) {
  const [uploading, setUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('siswa'); // siswa, walikelas, gurubk

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: string) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    setUploading(true);
    const file = e.target.files[0];
    const reader = new FileReader();

    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = xlsx.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = xlsx.utils.sheet_to_json(ws);

        let collectionName = 'students';
        if (type === 'walikelas') collectionName = 'homeroom_teachers';
        if (type === 'gurubk') collectionName = 'counseling_teachers';

        const colRef = collection(db, collectionName);

        // Delete existing data (optional, but usually upload replaces or appends. Let's just append for now, or maybe we should clear first? The original backend probably just inserted.)
        // For simplicity, we'll just add them.
        let addedCount = 0;
        for (const row of data as any[]) {
          if (type === 'siswa' && row.Nama && row.Kelas) {
            await addDoc(colRef, { name: row.Nama, class: row.Kelas, nis: row.NIS || '' });
            addedCount++;
          } else if ((type === 'walikelas' || type === 'gurubk') && row.Nama) {
            await addDoc(colRef, { name: row.Nama });
            addedCount++;
          }
        }

        alert(`Berhasil mengupload ${addedCount} data!`);
        onRefresh();
      } catch (error) {
        console.error(error);
        alert('Terjadi kesalahan saat memproses file Excel');
      } finally {
        setUploading(false);
        e.target.value = ''; // Reset input
      }
    };
    reader.readAsBinaryString(file);
  };

  const filteredStudents = students.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.class.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredHomeroom = homeroomTeachers.filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredCounseling = counselingTeachers.filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="border-b border-slate-200">
        <div className="flex px-6 pt-4 gap-6">
          <button 
            className={`pb-3 font-medium text-sm border-b-2 transition-colors ${activeTab === 'siswa' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            onClick={() => setActiveTab('siswa')}
          >
            Data Siswa
          </button>
          <button 
            className={`pb-3 font-medium text-sm border-b-2 transition-colors ${activeTab === 'walikelas' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            onClick={() => setActiveTab('walikelas')}
          >
            Wali Kelas
          </button>
          <button 
            className={`pb-3 font-medium text-sm border-b-2 transition-colors ${activeTab === 'gurubk' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            onClick={() => setActiveTab('gurubk')}
          >
            Guru BK
          </button>
        </div>
      </div>

      <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-800">
            {activeTab === 'siswa' ? 'Data Master Siswa' : activeTab === 'walikelas' ? 'Data Master Wali Kelas' : 'Data Master Guru BK'}
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            {activeTab === 'siswa' ? 'Kelola data siswa (Nama, Kelas)' : 'Kelola data guru (Nama)'}
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Cari data..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 w-full sm:w-64"
            />
          </div>
          
          <label className="cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
            {uploading ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> : <Upload size={18} />}
            Upload Excel
            <input type="file" accept=".xlsx, .xls" className="hidden" onChange={(e) => handleFileUpload(e, activeTab)} disabled={uploading} />
          </label>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="py-3 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider w-20">No</th>
              <th className="py-3 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Nama</th>
              {activeTab === 'siswa' && <th className="py-3 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Kelas</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {activeTab === 'siswa' && (
              filteredStudents.length > 0 ? (
                filteredStudents.map((student, index) => (
                  <tr key={student.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-6 text-sm text-slate-600">{index + 1}</td>
                    <td className="py-3 px-6 text-sm font-medium text-slate-800">{student.name}</td>
                    <td className="py-3 px-6 text-sm text-slate-600">
                      <span className="bg-slate-100 text-slate-700 px-2 py-1 rounded-md text-xs font-medium">
                        {student.class}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="py-8 text-center text-slate-500 text-sm">
                    Tidak ada data siswa. Silakan upload dari Excel.
                    <br />
                    <span className="text-xs text-slate-400 mt-2 block">Format Excel: Kolom Nama, Kelas</span>
                  </td>
                </tr>
              )
            )}

            {activeTab === 'walikelas' && (
              filteredHomeroom.length > 0 ? (
                filteredHomeroom.map((teacher, index) => (
                  <tr key={teacher.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-6 text-sm text-slate-600">{index + 1}</td>
                    <td className="py-3 px-6 text-sm font-medium text-slate-800">{teacher.name}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={2} className="py-8 text-center text-slate-500 text-sm">
                    Tidak ada data Wali Kelas. Silakan upload dari Excel.
                    <br />
                    <span className="text-xs text-slate-400 mt-2 block">Format Excel: Kolom Nama</span>
                  </td>
                </tr>
              )
            )}

            {activeTab === 'gurubk' && (
              filteredCounseling.length > 0 ? (
                filteredCounseling.map((teacher, index) => (
                  <tr key={teacher.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-6 text-sm text-slate-600">{index + 1}</td>
                    <td className="py-3 px-6 text-sm font-medium text-slate-800">{teacher.name}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={2} className="py-8 text-center text-slate-500 text-sm">
                    Tidak ada data Guru BK. Silakan upload dari Excel.
                    <br />
                    <span className="text-xs text-slate-400 mt-2 block">Format Excel: Kolom Nama</span>
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TransactionView({ students, homeroomTeachers, counselingTeachers, onRefresh, setActiveTab }: { students: Student[], homeroomTeachers: Teacher[], counselingTeachers: Teacher[], onRefresh: () => void, setActiveTab: (tab: string) => void }) {
  const [selectedClass, setSelectedClass] = useState('');
  const [formData, setFormData] = useState({
    student_id: '',
    date: new Date().toISOString().split('T')[0],
    achievement_type: 'Akademik',
    competition_name: '',
    rank: '',
    homeroom_teacher: '',
    counseling_teacher: '',
    follow_up: ''
  });
  const [certificate, setCertificate] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const uniqueClasses = Array.from(new Set(students.map(s => s.class))).sort();
  const filteredStudents = selectedClass 
    ? students.filter(s => s.class === selectedClass)
    : students;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.student_id) {
      alert('Pilih siswa terlebih dahulu!');
      return;
    }

    setSubmitting(true);
    
    try {
      const student = students.find(s => s.id === formData.student_id);
      if (!student) throw new Error("Student not found");

      const achievementData = {
        ...formData,
        student_name: student.name,
        student_class: student.class,
        nis: student.nis || '',
        certificate_path: certificate ? certificate.name : '' // Just store name for now
      };

      await addDoc(collection(db, 'achievements'), achievementData);
      
      alert('Data prestasi berhasil disimpan!');
      onRefresh();
      setActiveTab('laporan');
    } catch (error: any) {
      alert('Terjadi kesalahan saat menyimpan data: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-slate-200 bg-indigo-50/50">
        <h3 className="text-lg font-semibold text-indigo-900 flex items-center gap-2">
          <Trophy size={20} className="text-indigo-600" />
          Input Prestasi Baru
        </h3>
        <p className="text-sm text-indigo-600/70 mt-1">Catat pencapaian siswa secara detail</p>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tanggal Prestasi</label>
              <input 
                type="date" 
                required
                value={formData.date}
                onChange={(e) => setFormData({...formData, date: e.target.value})}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Kelas</label>
              <select 
                value={selectedClass}
                onChange={(e) => {
                  setSelectedClass(e.target.value);
                  setFormData({...formData, student_id: ''});
                }}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="">-- Pilih Kelas --</option>
                {uniqueClasses.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Siswa</label>
              <select 
                required
                value={formData.student_id}
                onChange={(e) => setFormData({...formData, student_id: e.target.value})}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                disabled={!selectedClass && uniqueClasses.length > 0}
              >
                <option value="">-- Pilih Siswa --</option>
                {filteredStudents.map(s => (
                  <option key={s.id} value={s.id}>{s.name} {selectedClass ? '' : `(${s.class})`}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Jenis Prestasi</label>
              <select 
                value={formData.achievement_type}
                onChange={(e) => setFormData({...formData, achievement_type: e.target.value})}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="Akademik">Akademik</option>
                <option value="Non Akademik">Non Akademik</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nama Lomba / Kejuaraan</label>
              <input 
                type="text" 
                required
                placeholder="Contoh: Olimpiade Sains Nasional"
                value={formData.competition_name}
                onChange={(e) => setFormData({...formData, competition_name: e.target.value})}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Juara / Peringkat</label>
              <input 
                type="text" 
                required
                placeholder="Contoh: Juara 1 Tingkat Provinsi"
                value={formData.rank}
                onChange={(e) => setFormData({...formData, rank: e.target.value})}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nama Wali Kelas</label>
              <select 
                value={formData.homeroom_teacher}
                onChange={(e) => setFormData({...formData, homeroom_teacher: e.target.value})}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="">-- Pilih Wali Kelas --</option>
                {homeroomTeachers.map(t => (
                  <option key={t.id} value={t.name}>{t.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nama Guru BK</label>
              <select 
                value={formData.counseling_teacher}
                onChange={(e) => setFormData({...formData, counseling_teacher: e.target.value})}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="">-- Pilih Guru BK --</option>
                {counselingTeachers.map(t => (
                  <option key={t.id} value={t.name}>{t.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tindak Lanjut / Reward</label>
              <textarea 
                rows={3}
                placeholder="Contoh: Diberikan beasiswa sekolah"
                value={formData.follow_up}
                onChange={(e) => setFormData({...formData, follow_up: e.target.value})}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Bukti Sertifikat (Gambar/PDF)</label>
              <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-300 border-dashed rounded-lg hover:bg-slate-50 transition-colors">
                <div className="space-y-1 text-center">
                  <Upload className="mx-auto h-12 w-12 text-slate-400" />
                  <div className="flex text-sm text-slate-600 justify-center">
                    <label className="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500">
                      <span>Upload a file</span>
                      <input 
                        type="file" 
                        className="sr-only" 
                        accept="image/*,.pdf"
                        onChange={(e) => setCertificate(e.target.files ? e.target.files[0] : null)}
                      />
                    </label>
                  </div>
                  <p className="text-xs text-slate-500">
                    {certificate ? certificate.name : 'PNG, JPG, PDF up to 5MB'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-200 flex justify-end">
          <button 
            type="submit" 
            disabled={submitting}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-lg font-medium flex items-center gap-2 transition-colors disabled:opacity-70"
          >
            {submitting ? 'Menyimpan...' : (
              <>
                <Save size={18} />
                Simpan Data Prestasi
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

function ReportView({ achievements }: { achievements: Achievement[] }) {
  const [searchTerm, setSearchTerm] = useState('');

  const handleDownloadExcel = () => {
    const dataToExport = achievements.map((a, i) => ({
      'No': i + 1,
      'Tanggal': a.date,
      'Nama Siswa': a.student_name,
      'Kelas': a.student_class,
      'Jenis Prestasi': a.achievement_type,
      'Nama Lomba': a.competition_name,
      'Juara/Peringkat': a.rank,
      'Wali Kelas': a.homeroom_teacher,
      'Guru BK': a.counseling_teacher,
      'Tindak Lanjut': a.follow_up
    }));

    const ws = xlsx.utils.json_to_sheet(dataToExport);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, "Laporan Prestasi");
    xlsx.writeFile(wb, `Laporan_Prestasi_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const filtered = achievements.filter(a => 
    a.student_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.competition_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.achievement_type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-800">Laporan Prestasi Siswa</h3>
          <p className="text-sm text-slate-500 mt-1">Daftar seluruh pencapaian siswa</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Cari laporan..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 w-full sm:w-64"
            />
          </div>
          
          <button 
            onClick={handleDownloadExcel}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
          >
            <Download size={18} />
            Export Excel
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[1000px]">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tanggal</th>
              <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Siswa</th>
              <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Jenis</th>
              <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Lomba / Kejuaraan</th>
              <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Peringkat</th>
              <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Sertifikat</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {filtered.length > 0 ? (
              filtered.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-4 text-sm text-slate-600 whitespace-nowrap">{a.date}</td>
                  <td className="py-3 px-4">
                    <p className="text-sm font-medium text-slate-800">{a.student_name}</p>
                    <p className="text-xs text-slate-500">Kelas {a.student_class}</p>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-1 rounded-md text-xs font-medium ${
                      a.achievement_type === 'Akademik' ? 'bg-emerald-100 text-emerald-700' : 'bg-sky-100 text-sky-700'
                    }`}>
                      {a.achievement_type}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-sm text-slate-700">{a.competition_name}</td>
                  <td className="py-3 px-4 text-sm font-medium text-amber-600">{a.rank}</td>
                  <td className="py-3 px-4 text-sm">
                    {a.certificate_path ? (
                      <a href={a.certificate_path} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline flex items-center gap-1">
                        <FileText size={14} /> Lihat
                      </a>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-500 text-sm">
                  Tidak ada data laporan.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SettingsView({ students, homeroomTeachers, counselingTeachers, achievements }: any) {
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState({ text: '', type: '' });

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (auth.currentUser) {
        await updatePassword(auth.currentUser, newPassword);
        setMessage({ text: 'Password berhasil diubah', type: 'success' });
        setNewPassword('');
      } else {
        setMessage({ text: 'Anda belum login', type: 'error' });
      }
    } catch (error: any) {
      setMessage({ text: 'Terjadi kesalahan: ' + error.message, type: 'error' });
    }
  };

  const handleBackup = () => {
    const data = {
      students,
      homeroomTeachers,
      counselingTeachers,
      achievements
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_prestasi_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    alert('Fitur restore dinonaktifkan pada versi cloud untuk keamanan data.');
    e.target.value = '';
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
      {/* Ubah Password */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-200 flex items-center gap-3">
          <Shield className="text-indigo-600" size={24} />
          <h3 className="text-lg font-semibold text-slate-800">Ubah Password Admin</h3>
        </div>
        <form onSubmit={handleChangePassword} className="p-6 space-y-4">
          {message.text && (
            <div className={`p-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
              {message.text}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password Baru</label>
            <input 
              type="password" 
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <button 
            type="submit"
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 rounded-lg transition-colors mt-4"
          >
            Simpan Password
          </button>
        </form>
      </div>

      {/* Backup & Restore */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-200 flex items-center gap-3">
          <Database className="text-indigo-600" size={24} />
          <h3 className="text-lg font-semibold text-slate-800">Backup & Restore Database</h3>
        </div>
        <div className="p-6 space-y-6">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
            <h4 className="font-medium text-slate-800 mb-2">Backup Data</h4>
            <p className="text-sm text-slate-500 mb-4">Download seluruh data (siswa, prestasi, pengaturan) ke dalam file JSON untuk mengamankan data.</p>
            <button 
              onClick={handleBackup}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
            >
              <Download size={18} /> Download Backup
            </button>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
            <h4 className="font-medium text-slate-800 mb-2">Restore Data</h4>
            <p className="text-sm text-slate-500 mb-4">Kembalikan data dari file backup JSON. <strong className="text-red-500">Peringatan: Data saat ini akan ditimpa!</strong></p>
            <label className="cursor-pointer bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-medium inline-flex items-center gap-2 transition-colors">
              <Upload size={18} /> Upload File Backup
              <input type="file" accept=".json" className="hidden" onChange={handleRestore} />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

