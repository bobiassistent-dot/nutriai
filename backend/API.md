# NutriAI API Documentation

Base URL: `http://localhost:3001/api`

## Endpoints

### User

#### GET /api/user/goals
Get user's daily nutrition goals.

**Response:**
```json
{
  "goals_calories": 2000,
  "goals_protein": 120,
  "goals_carbs": 250,
  "goals_fat": 65
}
```

#### PUT /api/user/goals
Update user's daily nutrition goals.

**Body:**
```json
{
  "calories": 2000,
  "protein": 120,
  "carbs": 250,
  "fat": 65
}
```

---

### Meals

#### GET /api/meals
Get meals for today.

**Response:**
```json
[
  {
    "id": "uuid",
    "name": "Haferflocken",
    "type": "breakfast",
    "calories": 350,
    "protein": 12,
    "carbs": 45,
    "fat": 8,
    "time": "08:30",
    "date": "2026-03-05"
  }
]
```

#### GET /api/meals?date=2026-03-05
Get meals for specific date.

#### GET /api/meals/range?start=2026-01-01&end=2026-03-05
Get meals for date range.

#### POST /api/meals
Add a new meal.

**Body:**
```json
{
  "name": "Hähnchenbrust mit Reis",
  "type": "lunch",
  "calories": 450,
  "protein": 40,
  "carbs": 50,
  "fat": 15,
  "time": "12:30"
}
```

#### PUT /api/meals/:id
Update a meal.

#### DELETE /api/meals/:id
Delete a meal.

---

### Statistics

#### GET /api/stats?days=7
Get nutrition statistics for last N days.

**Response:**
```json
[
  {
    "date": "2026-03-05",
    "total_calories": 1850,
    "total_protein": 95,
    "total_carbs": 200,
    "total_fat": 55
  }
]
```

---

### AI Features

#### POST /api/ai/analyze
Analyze meal name and estimate nutrition values.

**Body:**
```json
{
  "mealName": "Hähnchenbrust mit Reis"
}
```

**Response:**
```json
{
  "success": true,
  "calories": 450,
  "protein": 40,
  "carbs": 50,
  "fat": 15,
  "source": "keyword-ai"
}
```

#### POST /api/ai/chat
Chat with AI nutrition assistant.

**Body:**
```json
{
  "message": "Was kann ich heute gesund kochen?"
}
```

**Response:**
```json
{
  "success": true,
  "response": "🍳 Wie wär's mit...",
  "source": "mock-ai"
}
```

---

## Mobile App Integration

### Authentication
Currently using a simple demo user. For production, add JWT authentication:

```javascript
// Example header for authenticated requests
headers: {
  'Authorization': 'Bearer YOUR_JWT_TOKEN',
  'Content-Type': 'application/json'
}
```

### Cross-Origin (CORS)
CORS is enabled for all origins. 

For production, restrict in `server.js`:
```javascript
app.use(cors({
  origin: ['https://your-app.com', 'myapp://']
}));
```

### Offline Support
Mobile app should cache meals locally and sync when online.

### Push Notifications (Future)
- Reminder to log meals
- Goal achievement notifications
- Weekly summary

## Error Handling

All errors return:
```json
{
  "error": "Error message description"
}
```

Status codes:
- 200: Success
- 400: Bad Request
- 404: Not Found
- 500: Server Error
