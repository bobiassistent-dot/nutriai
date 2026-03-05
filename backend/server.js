import express from 'express';
import cors from 'cors';
import initSqlJs from 'sql.js';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const DB_PATH = path.join(__dirname, 'nutriai.db');

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10mb' }));

// Preflight
app.options('*', cors());

// Database setup
let db;

async function initDB() {
  const SQL = await initSqlJs();
  
  // Load existing database or create new one
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
    console.log('✅ Database loaded from file');
  } else {
    db = new SQL.Database();
    console.log('✅ New database created');
  }
  
  // Initialize tables
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT,
      email TEXT,
      goals_calories INTEGER DEFAULT 2000,
      goals_protein INTEGER DEFAULT 120,
      goals_carbs INTEGER DEFAULT 250,
      goals_fat INTEGER DEFAULT 65,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS meals (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      name TEXT NOT NULL,
      type TEXT CHECK(type IN ('breakfast', 'lunch', 'dinner', 'snack')),
      calories INTEGER DEFAULT 0,
      protein INTEGER DEFAULT 0,
      carbs INTEGER DEFAULT 0,
      fat INTEGER DEFAULT 0,
      time TEXT,
      date TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      role TEXT CHECK(role IN ('user', 'assistant')),
      content TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);
  
  // Ensure default user exists
  const userExists = db.exec("SELECT id FROM users WHERE id = 'demo-user'");
  if (userExists.length === 0 || userExists[0].values.length === 0) {
    db.run(`INSERT INTO users (id, name, goals_calories, goals_protein, goals_carbs, goals_fat) VALUES (?, ?, ?, ?, ?, ?)`,
      ['demo-user', 'Demo User', 2000, 120, 250, 65]);
    console.log('✅ Default user created');
  }
  
  saveDB();
  console.log('✅ Database initialized');
}

function saveDB() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

// Helper to run queries
function query(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

function run(sql, params = []) {
  db.run(sql, params);
  saveDB();
}

// Default user ID
const DEFAULT_USER = 'demo-user';

// ==================== ROUTES ====================

// Get user goals
app.get('/api/user/goals', (req, res) => {
  try {
    const user = query('SELECT goals_calories, goals_protein, goals_carbs, goals_fat FROM users WHERE id = ?', [DEFAULT_USER])[0];
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update user goals
app.put('/api/user/goals', (req, res) => {
  try {
    const { calories, protein, carbs, fat } = req.body;
    run('UPDATE users SET goals_calories = ?, goals_protein = ?, goals_carbs = ?, goals_fat = ? WHERE id = ?',
      [calories, protein, carbs, fat, DEFAULT_USER]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get meals for today
app.get('/api/meals', (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const meals = query('SELECT * FROM meals WHERE user_id = ? AND date = ? ORDER BY time DESC', [DEFAULT_USER, today]);
    res.json(meals);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get meals for date range
app.get('/api/meals/range', (req, res) => {
  try {
    const { start, end } = req.query;
    const meals = query('SELECT * FROM meals WHERE user_id = ? AND date >= ? AND date <= ? ORDER BY date DESC, time DESC',
      [DEFAULT_USER, start, end]);
    res.json(meals);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add meal
app.post('/api/meals', (req, res) => {
  try {
    const { name, type, calories, protein, carbs, fat, time } = req.body;
    const id = uuidv4();
    const date = new Date().toISOString().split('T')[0];
    
    run(`INSERT INTO meals (id, user_id, name, type, calories, protein, carbs, fat, time, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, DEFAULT_USER, name, type, calories || 0, protein || 0, carbs || 0, fat || 0, time, date]);
    
    const meal = query('SELECT * FROM meals WHERE id = ?', [id])[0];
    res.json(meal);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete meal
app.delete('/api/meals/:id', (req, res) => {
  try {
    const { id } = req.params;
    run('DELETE FROM meals WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update meal
app.put('/api/meals/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, type, calories, protein, carbs, fat } = req.body;
    
    run('UPDATE meals SET name = ?, type = ?, calories = ?, protein = ?, carbs = ?, fat = ? WHERE id = ?',
      [name, type, calories, protein, carbs, fat, id]);
    
    const meal = query('SELECT * FROM meals WHERE id = ?', [id])[0];
    res.json(meal);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Chat messages
app.get('/api/chat', (req, res) => {
  try {
    const messages = query('SELECT * FROM chat_messages WHERE user_id = ? ORDER BY created_at ASC LIMIT 50', [DEFAULT_USER]);
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Save chat message
app.post('/api/chat', (req, res) => {
  try {
    const { role, content } = req.body;
    const id = uuidv4();
    
    run('INSERT INTO chat_messages (id, user_id, role, content) VALUES (?, ?, ?, ?)',
      [id, DEFAULT_USER, role, content]);
    
    const message = query('SELECT * FROM chat_messages WHERE id = ?', [id])[0];
    res.json(message);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get stats
app.get('/api/stats', (req, res) => {
  try {
    const { days = 7 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));
    
    const meals = query(`
      SELECT date, 
             SUM(calories) as total_calories,
             SUM(protein) as total_protein,
             SUM(carbs) as total_carbs,
             SUM(fat) as total_fat
      FROM meals 
      WHERE user_id = ? AND date >= ?
      GROUP BY date
      ORDER BY date ASC
    `, [DEFAULT_USER, startDate.toISOString().split('T')[0]]);
    
    res.json(meals);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== AI ENDPOINTS ====================

// AI Analyze Meal
app.post('/api/ai/analyze', async (req, res) => {
  try {
    const { mealName, imageBase64 } = req.body;
    const estimates = estimateNutrition(mealName || '');
    
    res.json({
      success: true,
      ...estimates,
      source: 'keyword-ai'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// AI Chat
app.post('/api/ai/chat', async (req, res) => {
  try {
    const { message } = req.body;
    const response = generateAIResponse(message || '');
    
    res.json({
      success: true,
      response,
      source: 'mock-ai'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Helper: Estimate nutrition from meal name
function estimateNutrition(mealName) {
  const name = (mealName || '').toLowerCase();
  
  // Default values
  let calories = 300;
  let protein = 15;
  let carbs = 30;
  let fat = 12;
  
  // Check keywords in order - more specific first
  if (name.includes('hähnchen') || name.includes('chicken') || name.includes('huhn') || name.includes('pute')) {
    protein = 40; calories = 450; fat = 15; carbs = 5;
  } else if (name.includes('rind') || name.includes('steak') || name.includes('fleisch') || name.includes('burger')) {
    protein = 45; calories = 550; fat = 30; carbs = 10;
  } else if (name.includes('fisch') || name.includes('lachs') || name.includes('forelle') || name.includes('thunfisch')) {
    protein = 35; calories = 400; fat = 18; carbs = 0;
  } else if (name.includes('ei') || name.includes('rührei') || name.includes('omelett')) {
    protein = 25; calories = 300; fat = 20; carbs = 2;
  } else if (name.includes('toast') || name.includes('brot') || name.includes('broetchen') || name.includes('semmel')) {
    carbs = 40; calories = 300; protein = 8; fat = 8;
  } else if (name.includes('avocado')) {
    fat = 25; calories = 350; carbs = 15; protein = 4;
  } else if (name.includes('smoothie') || name.includes('shake')) {
    calories = 320; carbs = 50; protein = 8; fat = 5;
  } else if (name.includes('joghurt') || name.includes('quark') || name.includes('Skyr')) {
    protein = 18; calories = 180; carbs = 12; fat = 3;
  } else if (name.includes('hafer') || name.includes('müesli') || name.includes('muesli')) {
    carbs = 45; calories = 350; protein = 10; fat = 6;
  } else if (name.includes('salat') || name.includes('gemuese') || name.includes('gemüse')) {
    calories = 150; carbs = 10; protein = 5; fat = 8;
  } else if (name.includes('reis')) {
    carbs = 50; calories = 350; protein = 8; fat = 2;
  } else if (name.includes('nudel') || name.includes('pasta') || name.includes('spaghetti')) {
    carbs = 60; calories = 400; protein = 12; fat = 10;
  } else if (name.includes('kartoffel') || name.includes('pommes') || name.includes('chips')) {
    carbs = 45; calories = 380; protein = 5; fat = 18;
  } else if (name.includes('banane')) {
    carbs = 35; calories = 200; protein = 3; fat = 1;
  } else if (name.includes('beere') || name.includes('obst') || name.includes('apfel') || name.includes('orange')) {
    carbs = 20; calories = 120; protein = 2; fat = 0;
  } else if (name.includes('nuss') || name.includes('mandel') || name.includes('walnuss') || name.includes('erdnuss')) {
    fat = 20; protein = 8; calories = 250; carbs = 8;
  } else if (name.includes('käse') || name.includes('kaese') || name.includes('käse')) {
    protein = 25; fat = 20; calories = 350; carbs = 2;
  } else if (name.includes('milch') || name.includes('kaffe')) {
    protein = 8; carbs = 12; calories = 150; fat = 8;
  } else if (name.includes('pizza')) {
    carbs = 50; protein = 20; fat = 25; calories = 550;
  } else if (name.includes('burger')) {
    protein = 30; carbs = 40; fat = 35; calories = 650;
  } else if (name.includes('schnitzel') || name.includes('fried')) {
    protein = 35; fat = 30; carbs = 20; calories = 500;
  } else if (name.includes('sushi')) {
    protein = 20; carbs = 60; fat = 5; calories = 400;
  } else if (name.includes('suppe')) {
    calories = 150; protein = 10; carbs = 15; fat = 5;
  } else if (name.includes('sosse') || name.includes('sauce')) {
    fat = 15; calories = 200; carbs = 10; protein = 2;
  } else if (name.includes('schokolade') || name.includes('cuisine') || name.includes('süss')) {
    carbs = 30; fat = 20; calories = 350; protein = 5;
  }
  
  // Small variance for natural feel
  const variance = () => Math.floor(Math.random() * 20) - 10;
  
  return {
    calories: Math.max(50, calories + variance()),
    protein: Math.max(0, protein + variance()),
    carbs: Math.max(0, carbs + variance()),
    fat: Math.max(0, fat + variance())
  };
}

// Helper: Generate AI response
function generateAIResponse(message) {
  const msg = (message || '').toLowerCase();
  
  const responses = {
    'kochen': '🍳 Wie wär\'s mit einem Gemüse-Pfanne? Nimm Zucchini, Paprika, Brokkoli und Hähnchenbrust. Das gibt dir ca. 35g Protein und nur 400 kcal. Perfekt für deine Ziele!',
    'frühstück': '🥣 Probier mal griechischen Joghurt mit Beeren und Nüssen! Das hält dich satt und liefert 20g Protein. Alternativ: Haferflocken mit Banane und Mandeln.',
    'protein': '💪 Für deine Ziele empfehle ich 1.6-2g Protein pro kg Körpergewicht. Bei 75kg wären das ca. 120-150g täglich. Reich an Protein: Hähnchen, Fisch, Eier, griechischer Joghurt, Hülsenfrüchte.',
    'energie': '🌟 1) Trink genug Wasser (2-3L)\n2) Vermeide Zucker-Peaks\n3) Iss alle 3-4h Protein\n4) Beweg dich regelmäßig\n5) Schlaf 7-9h pro Nacht',
    'abnehmen': '🎯 Für Abnehmen: Kaloriendefizit von 300-500kcal. Iss viel Protein (2g/kg), Gemüse, gesunde Fette. Vermeide Zucker und Weißmehl.',
    'muskel': '💪 Muskelaufbau: 1.6-2g Protein/kg, komplexe Kohlenhydrate vor/nach Training, genug Schlaf (7-9h), progressive Belastung.',
    'wasser': '💧 Trink 2-3 Liter täglich. Vor Mahlzeiten ein Glas hilft beim Sattwerden. Kaffee und Tee zählen auch!',
    'snack': '🥜 Gesunde Snacks: Nüsse, Obst, griechischer Joghurt, Gemüsesticks mit Hummus, dunkle Schokolade (70%+).',
    'vegan': '🌱 Vegane Proteinquellen: Tofu, Tempeh, Hülsenfrüchte, Seitan, Nüsse, Samen. Kombiniere verschiedene Pflanzenproteine für alle Aminosäuren!',
    'keto': '🥑 Keto: 70-75% Fett, 20-25% Protein, 5-10% Kohlenhydrate. Iss Avocados, Eier, Fleisch, Fisch, Butter, Nüsse.',
    'süss': '🍬 Weniger Zucker: Ersetze Süßigkeiten mit Obst, dunkler Schokolade (85%+), Datteln oder frozen berries.',
    'müde': '😴 Bist du müde? trink Wasser, iss Eisen-reich (Fleisch, Hülsenfrüchte, Spinat), beweg dich kurz, schlaf genug.'
  };
  
  for (const [key, response] of Object.entries(responses)) {
    if (msg.includes(key)) return response;
  }
  
  return 'Das ist eine gute Frage! 🤔 Ich helfe dir gerne bei Ernährungsfragen. Was möchtest du noch wissen?';
}

// Start server
await initDB();

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 NutriAI Backend running on http://localhost:${PORT}`);
  console.log(`📊 API Ready:`);
  console.log(`   GET/POST /api/meals`);
  console.log(`   GET/PUT   /api/user/goals`);
  console.log(`   GET       /api/stats`);
  console.log(`   POST      /api/ai/analyze`);
  console.log(`   POST      /api/ai/chat`);
});