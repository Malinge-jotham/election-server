const express = require('express');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken')

const mysql = require('mysql2');
const cors = require("cors")
const app = express();
const port = 3000;

// MySQL Connection
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'Malinge?1',
    database: 'voting_system'
});

db.connect((err) => {
    if (err) throw err;
    console.log('Connected to MySQL database');
});

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());

// User Registration
app.post('/register', (req, res) => {
    const { username, password } = req.body;
    const sql = 'INSERT INTO users (username, password) VALUES (?, ?)';
    db.query(sql, [username, password], (err, result) => {
        if (err) {
            res.status(500).send('Error registering user');
            return;
        }
        res.status(200).send('User registered successfully');
    });
});

// Candidate Registration
app.post('/candidates', (req, res) => {
    const { name, post, state } = req.body;
    const sql = 'INSERT INTO candidates (name, post, state) VALUES (?, ?, ?)';
    db.query(sql, [name, post, state], (err, result) => {
        if (err) {
            res.status(500).send('Error registering candidate');
            console.log(err)
            return;
        }
        res.status(200).send('Candidate registered successfully');
    });
});

// GET request to fetch candidate details
app.get('/candidates', (req, res) => {
    const sql = 'SELECT * FROM candidates'; // SQL query to fetch all candidates
    db.query(sql, (err, result) => {
        if (err) {
            res.status(500).send('Error fetching candidates');
            return;
        }
        res.status(200).json(result); // Send the fetched candidates as JSON response
    });
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const sql = 'SELECT id, username FROM users WHERE username = ? AND password = ?';
    db.query(sql, [username, password], (err, results) => {
        if (err) {
            res.status(500).send('Error logging in');
            return;
        }
        if (results.length === 0) {
            res.status(401).send('Invalid username or password');
            return;
        }
        // Authentication successful, generate JWT token
        const user = results[0];
        const token = jwt.sign({ userId: user.id, username: user.username }, 'secret_key');
        res.status(200).json({ token });
    });
});
// Middleware for login authentication
// Middleware for login authentication
function authenticate(req, res, next) {
    // Extract the JWT token from the Authorization header
    const authToken = req.headers.authorization;
    console.log(authToken)


    // Check if the token exists
    if (!authToken) {
        console.log('No token found in request headers');
        return res.status(401).send('Unauthorized');
    }

    try {
        // Verify the JWT token
        const decoded = jwt.verify(authToken, 'secret_key');
        console.log('Token decoded successfully:', decoded);

        // Attach the decoded token data to the request object
        req.user = decoded;

        // Proceed with the next middleware or route handler
        next();
    } catch (error) {
        console.error('Error verifying token:', error);
        // If the token is invalid, return an unauthorized error
        return res.status(401).send('Unauthorized');
    }
}


// Voting endpoint
app.post('/vote', authenticate, (req, res) => {
    
    const  voter_id  = req.user.userId; // Retrieve voter ID from the authenticated user
    const { candidate_id, post } = req.body;

    // Check if the voter has already voted for the given post
    const checkVoteQuery = 'SELECT * FROM votes WHERE voter_id = ? AND post = ?';
    db.query(checkVoteQuery, [voter_id, post], (err, results) => {
        if (err) {
            res.status(500).send('Error checking previous vote');
            return;
        }
        if (results.length > 0) {
            res.status(400).send('You have already voted for this post');
            return;
        }
        
        // Check if the candidate exists
        const checkCandidateQuery = 'SELECT * FROM candidates WHERE id = ? AND post = ?';
        db.query(checkCandidateQuery, [candidate_id, post], (err, results) => {
            if (err) {
                res.status(500).send('Error checking candidate');
                return;
            }
            if (results.length === 0) {
                res.status(404).send('Candidate not found for the specified post');
                return;
            }

            // Insert the vote
            const insertVoteQuery = 'INSERT INTO votes (voter_id, candidate_id, post) VALUES (?, ?, ?)';
            db.query(insertVoteQuery, [voter_id, candidate_id, post], (err, result) => {
                if (err) {
                    console.log(err)

                    res.status(500).send('Error voting');
                    return;
                }
                res.status(200).send('Vote submitted successfully');
            });
        });
    });
});


// Result Analysis
app.get('/results', (req, res) => {
    const sql = 'SELECT candidates.post, candidates.name, COUNT(*) AS votes_count FROM candidates JOIN votes ON candidates.id = votes.candidate_id GROUP BY candidates.post, candidates.name';
    db.query(sql, (err, result) => {
        if (err) {
            console.error('Error fetching results:', err);
            res.status(500).send('Error fetching results');
            return;
        }
        res.status(200).json(result);
    });
});


// Start server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
