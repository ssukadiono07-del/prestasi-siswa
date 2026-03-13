import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import multer from "multer";
import cors from "cors";
import path from "path";
import fs from "fs";
import xlsx from "xlsx";

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Database setup
const dbDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir);
}
const dbPath = path.join(dbDir, "database.sqlite");
const db = new Database(dbPath);

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT
  );

  CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nis TEXT UNIQUE,
    name TEXT,
    class TEXT
  );

  CREATE TABLE IF NOT EXISTS homeroom_teachers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE
  );

  CREATE TABLE IF NOT EXISTS counseling_teachers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE
  );

  CREATE TABLE IF NOT EXISTS achievements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER,
    date TEXT,
    achievement_type TEXT, -- 'Akademik' or 'Non Akademik'
    competition_name TEXT,
    rank TEXT,
    certificate_path TEXT,
    homeroom_teacher TEXT,
    counseling_teacher TEXT,
    follow_up TEXT,
    FOREIGN KEY (student_id) REFERENCES students(id)
  );
`);

// Insert default admin if not exists
const checkAdmin = db.prepare("SELECT * FROM users WHERE username = 'admin'").get();
if (!checkAdmin) {
  db.prepare("INSERT INTO users (username, password) VALUES (?, ?)").run("admin", "admin123");
}

// Multer setup for file uploads
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});
const upload = multer({ storage });

// API Routes

// Serve uploaded files
app.use("/uploads", express.static(uploadDir));

// Auth
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare("SELECT * FROM users WHERE username = ? AND password = ?").get(username, password);
  if (user) {
    res.json({ success: true, message: "Login successful" });
  } else {
    res.status(401).json({ success: false, message: "Invalid credentials" });
  }
});

app.post("/api/change-password", (req, res) => {
  const { username, oldPassword, newPassword } = req.body;
  const user = db.prepare("SELECT * FROM users WHERE username = ? AND password = ?").get(username, oldPassword);
  if (user) {
    db.prepare("UPDATE users SET password = ? WHERE username = ?").run(newPassword, username);
    res.json({ success: true, message: "Password updated successfully" });
  } else {
    res.status(401).json({ success: false, message: "Invalid old password" });
  }
});

// Dashboard Stats
app.get("/api/dashboard", (req, res) => {
  const totalStudents = db.prepare("SELECT COUNT(*) as count FROM students").get() as { count: number };
  const totalAchievements = db.prepare("SELECT COUNT(*) as count FROM achievements").get() as { count: number };
  
  const academicCount = db.prepare("SELECT COUNT(*) as count FROM achievements WHERE achievement_type = 'Akademik'").get() as { count: number };
  const nonAcademicCount = db.prepare("SELECT COUNT(*) as count FROM achievements WHERE achievement_type = 'Non Akademik'").get() as { count: number };

  const topStudents = db.prepare(`
    SELECT s.name, s.class, COUNT(a.id) as achievement_count
    FROM students s
    JOIN achievements a ON s.id = a.student_id
    GROUP BY s.id
    ORDER BY achievement_count DESC
    LIMIT 5
  `).all();

  res.json({
    totalStudents: totalStudents.count,
    totalAchievements: totalAchievements.count,
    academicCount: academicCount.count,
    nonAcademicCount: nonAcademicCount.count,
    topStudents
  });
});

// Master Data - Students
app.get("/api/students", (req, res) => {
  const students = db.prepare("SELECT * FROM students").all();
  res.json(students);
});

app.post("/api/students", (req, res) => {
  const { nis, name, studentClass } = req.body;
  try {
    db.prepare("INSERT INTO students (nis, name, class) VALUES (?, ?, ?)").run(nis, name, studentClass);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

app.post("/api/students/upload", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: "No file uploaded" });
  }
  
  try {
    const fileBuffer = fs.readFileSync(req.file.path);
    const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
    
    let count = 0;
    const insert = db.prepare("INSERT INTO students (name, class) VALUES (?, ?)");
    const insertMany = db.transaction((rows: any[]) => {
      for (const row of rows) {
        let name = '';
        let studentClass = '-';
        
        // Direct key matching for common formats
        if (row.Nama) name = row.Nama;
        else if (row.nama) name = row.nama;
        else if (row.Name) name = row.Name;
        else if (row.name) name = row.name;
        
        if (row.Kelas) studentClass = row.Kelas;
        else if (row.kelas) studentClass = row.kelas;
        else if (row.Class) studentClass = row.Class;
        else if (row.class) studentClass = row.class;

        // Fallback to searching keys
        if (!name) {
          const nameKey = Object.keys(row).find(k => k.toLowerCase().includes('nama') || k.toLowerCase().includes('name'));
          if (nameKey) name = row[nameKey];
        }
        
        if (studentClass === '-') {
          const classKey = Object.keys(row).find(k => k.toLowerCase().includes('kelas') || k.toLowerCase().includes('class'));
          if (classKey) studentClass = row[classKey];
        }
        
        if (name) {
          insert.run(String(name).trim(), String(studentClass).trim());
          count++;
        }
      }
    });
    
    insertMany(data);
    try { fs.unlinkSync(req.file.path); } catch (e) {}
    res.json({ success: true, message: `Berhasil mengupload ${count} data siswa` });
  } catch (error: any) {
    try { if (req.file) fs.unlinkSync(req.file.path); } catch (e) {}
    console.error("Student upload error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Master Data - Teachers
app.get("/api/homeroom-teachers", (req, res) => {
  res.json(db.prepare("SELECT * FROM homeroom_teachers").all());
});

app.post("/api/homeroom-teachers/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: "No file uploaded" });
  try {
    const fileBuffer = fs.readFileSync(req.file.path);
    const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
    const data = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
    
    let count = 0;
    const insert = db.prepare("INSERT OR IGNORE INTO homeroom_teachers (name) VALUES (?)");
    db.transaction((rows: any[]) => {
      for (const row of rows) {
        let name = '';
        
        if (row.Nama) name = row.Nama;
        else if (row.nama) name = row.nama;
        else if (row.Name) name = row.Name;
        else if (row.name) name = row.name;
        
        if (!name) {
          const nameKey = Object.keys(row).find(k => k.toLowerCase().includes('nama') || k.toLowerCase().includes('name') || k.toLowerCase().includes('guru') || k.toLowerCase().includes('wali'));
          if (nameKey) name = row[nameKey];
        }
        
        if (name) {
          const result = insert.run(String(name).trim());
          if (result.changes > 0) count++;
        }
      }
    })(data);
    try { fs.unlinkSync(req.file.path); } catch (e) {}
    res.json({ success: true, message: `Berhasil mengupload ${count} data wali kelas` });
  } catch (error: any) {
    try { if (req.file) fs.unlinkSync(req.file.path); } catch (e) {}
    console.error("Homeroom teacher upload error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get("/api/counseling-teachers", (req, res) => {
  res.json(db.prepare("SELECT * FROM counseling_teachers").all());
});

app.post("/api/counseling-teachers/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: "No file uploaded" });
  try {
    const fileBuffer = fs.readFileSync(req.file.path);
    const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
    const data = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
    
    let count = 0;
    const insert = db.prepare("INSERT OR IGNORE INTO counseling_teachers (name) VALUES (?)");
    db.transaction((rows: any[]) => {
      for (const row of rows) {
        let name = '';
        
        if (row.Nama) name = row.Nama;
        else if (row.nama) name = row.nama;
        else if (row.Name) name = row.Name;
        else if (row.name) name = row.name;
        
        if (!name) {
          const nameKey = Object.keys(row).find(k => k.toLowerCase().includes('nama') || k.toLowerCase().includes('name') || k.toLowerCase().includes('guru') || k.toLowerCase().includes('bk'));
          if (nameKey) name = row[nameKey];
        }
        
        if (name) {
          const result = insert.run(String(name).trim());
          if (result.changes > 0) count++;
        }
      }
    })(data);
    try { fs.unlinkSync(req.file.path); } catch (e) {}
    res.json({ success: true, message: `Berhasil mengupload ${count} data guru BK` });
  } catch (error: any) {
    try { if (req.file) fs.unlinkSync(req.file.path); } catch (e) {}
    console.error("Counseling teacher upload error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Transactions - Achievements
app.get("/api/achievements", (req, res) => {
  const achievements = db.prepare(`
    SELECT a.*, s.name as student_name, s.class as student_class, s.nis
    FROM achievements a
    JOIN students s ON a.student_id = s.id
    ORDER BY a.date DESC
  `).all();
  res.json(achievements);
});

app.post("/api/achievements", upload.single("certificate"), (req, res) => {
  const { student_id, date, achievement_type, competition_name, rank, homeroom_teacher, counseling_teacher, follow_up } = req.body;
  const certificate_path = req.file ? `/uploads/${req.file.filename}` : null;

  try {
    db.prepare(`
      INSERT INTO achievements 
      (student_id, date, achievement_type, competition_name, rank, certificate_path, homeroom_teacher, counseling_teacher, follow_up)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(student_id, date, achievement_type, competition_name, rank, certificate_path, homeroom_teacher, counseling_teacher, follow_up);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Database Backup & Restore
app.get("/api/backup", (req, res) => {
  res.download(dbPath, "database_backup.sqlite");
});

app.post("/api/restore", upload.single("database"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: "No file uploaded" });
  }
  
  try {
    db.close();
    fs.copyFileSync(req.file.path, dbPath);
    fs.unlinkSync(req.file.path);
    // Re-open db
    // Note: in a real app, we'd need to handle this more gracefully or restart the server
    res.json({ success: true, message: "Database restored successfully. Please restart the server." });
    setTimeout(() => process.exit(0), 1000); // Force restart
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
