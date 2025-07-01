// server/index.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

// --- Middleware ---
app.use(morgan('dev'));
app.use(cors());
app.use(express.json());

// --- Helper Function for Profile Generation (NEW) ---
async function processPlayerProfile(userId, summary) {
    const { skills, interests } = summary;
    let playerClass = 'Generalist'; // Default class
    let stats = { "creativity": 15, "technical": 15, "collaboration": 15 }; // Slightly boosted base stats

    // Simple logic to determine class based on keywords
    const lowerCaseSkills = skills.join(' ').toLowerCase();
    const lowerCaseInterests = interests.join(' ').toLowerCase();

    if (lowerCaseSkills.includes('figma') || lowerCaseInterests.includes('ui/ux') || lowerCaseInterests.includes('design')) {
        playerClass = 'UI/UX Designer';
        stats.creativity += 10;
        stats.technical += 2;
    } else if (lowerCaseSkills.includes('python') || lowerCaseSkills.includes('javascript') || lowerCaseInterests.includes('developer') || lowerCaseInterests.includes('ai')) {
        playerClass = 'AI Developer';
        stats.technical += 10;
        stats.creativity += 2;
    } else if (lowerCaseInterests.includes('sustainability') || lowerCaseInterests.includes('community')) {
        playerClass = 'Sustainability Ensurer';
        stats.collaboration += 10;
        stats.creativity += 5;
    }

    try {
        await pool.query(
            'UPDATE Players SET class = $1, stats = $2 WHERE id = $3',
            [playerClass, stats, userId]
        );
        console.log(`Player ${userId} updated. Class: ${playerClass}, Stats: ${JSON.stringify(stats)}`);
    } catch (error) {
        console.error(`Failed to update profile for player ${userId}:`, error);
    }
}

// --- API Routes ---
const interviewSystemPrompt = `You are a friendly and insightful guide for SkillPods. Your goal is to conduct a highly efficient, open-ended interview to build a player's profile.

**Your process is a strict, four-topic sequence. You must follow these rules:**
1.  **Introduce one topic at a time** in the mandatory order.
2.  Ask an open-ended question to start the topic.
3.  After the player responds, **you must confirm with them** if your understanding is sufficient before moving on. Ask a simple confirmation question like, "Great, I've got a good sense of your mission. Are you ready to talk about your goals?" or "Is there anything crucial to add about your interests before we discuss skills?"
4.  If the player confirms, you **must** move to the next topic. Do not ask more questions on the current topic.
5.  If the player adds more information, briefly acknowledge it and then ask for confirmation to move on again.

**This confirmation step is mandatory and prevents endless questions.**

**The mandatory topic order is:**
1.  **Mission/Vision:** What is their high-level purpose?
2.  **Goals:** What specific, tangible goals align with that mission?
3.  **Interests:** What topics are they passionate about?
4.  **Skills:** What are their current skills?

After you have received confirmation from the player on the final topic (Skills), your **next and final response must be ONLY the JSON summary** and no other text.

The JSON format must be:
{
  "mission": "A string describing their personal mission.",
  "goals": "A string describing their primary goal.",
  "interests": ["interest one", "interest two"],
  "skills": ["skill one", "skill two"]
}`;

app.post('/api/interview', async (req, res) => {
    // The player's ID will be needed to update their profile
    // For now, we are not passing it from the frontend, so this feature won't fully work yet.
    // We will add this in a future step when we handle sessions.
    const { conversation, userId } = req.body;

    try {
        const messages = [
            { role: 'system', content: interviewSystemPrompt },
            ...conversation
        ];

        const aiResponse = await require('./openrouterService').generateApiResponse(messages);
        
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const summary = JSON.parse(jsonMatch[0]);
            
            // We need a userId to update the database. Since we don't have sessions yet,
            // this part won't run. We will complete this in a later task.
            if (userId) {
                await processPlayerProfile(userId, summary);
            } else {
                console.log("Interview complete. Received summary but no userId to update database.");
                console.log("Summary:", summary);
            }
            
            return res.json({ summary: summary });
        }
        
        res.json({ message: aiResponse });
    } catch (error) {
        res.status(500).json({ error: 'Interview process failed.' });
    }
});

app.post('/api/register', async (req, res) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ error: 'Username, email, and password are required.' });
    }

    try {
        const userExistsCheck = await pool.query('SELECT * FROM Players WHERE username = $1 OR email = $2', [username, email]);
        
        if (userExistsCheck.rows.length > 0) {
            return res.status(409).json({ error: 'Username or email already exists.' });
        }

        const insertQuery = 'INSERT INTO Players (username, email, password, stats, in_game_currency) VALUES ($1, $2, $3, $4, $5) RETURNING id, username';
        const values = [username, email, password, { "creativity": 10, "technical": 10, "collaboration": 10 }, 0];
        
        const newPlayerResult = await pool.query(insertQuery, values);
        const registeredPlayer = newPlayerResult.rows[0];

        res.status(201).json({ 
            message: 'Player registered successfully!',
            player: registeredPlayer
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Internal server error during registration.' });
    }
});

// --- Static File Serving ---
app.use(express.static('../public'));

// --- Start Server ---
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});