const express = require('express');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken')
const PDFDocument = require('pdfkit');


const mysql = require('mysql2');
const cors = require("cors")
const app = express();
  const port = process.env.PORT || 3001;

// MySQL Connection
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
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
function authenticate(req, res, next) {
    // Extract the JWT token from the Authorization header
    const authToken = req.headers.authorization;
    console.log(authToken); // Log the received token

    // Check if the token exists
    if (!authToken) {
        console.log('No token found in request headers');
        return res.status(401).send('Unauthorized');
    }

    try {
        // Verify the JWT token
        const decoded = jwt.verify(authToken.split(' ')[1], 'secret_key'); // Extract the token part after "Bearer"
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
// Route to fetch list of posts
app.get('/posts', (req, res) => {
    const sql = 'SELECT DISTINCT post FROM candidates';
    db.query(sql, (err, result) => {
      if (err) {
        console.error('Error fetching posts:', err);
        res.status(500).send('Error fetching posts');
        return;
      }
      const posts = result.map((row) => row.post);
      res.status(200).json(posts);
    });
  });
  
  // Route to fetch candidates' reports sorted by post
  app.get('/candidates-reports/:post', (req, res) => {
    const { post } = req.params;
    const sql = `
      SELECT candidates.*, COUNT(votes.id) AS votes_count
      FROM candidates
      LEFT JOIN votes ON candidates.id = votes.candidate_id
      WHERE candidates.post = ?
      GROUP BY candidates.id
      ORDER BY votes_count DESC
    `;
    db.query(sql, [post], (err, result) => {
      if (err) {
        console.error('Error fetching candidates:', err);
        res.status(500).send('Error fetching candidates');
        return;
      }
      res.status(200).json(result);
    });
  });


app.get('/generate-candidate-report', (req, res) => {
    const doc = new PDFDocument();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="candidate_report.pdf"');
    doc.pipe(res);

    const sql = 'SELECT * FROM candidates';
    db.query(sql, (err, results) => {
        if (err) {
            console.error('Error fetching candidates:', err);
            res.status(500).send('Error fetching candidates');
            return;
        }
        
        doc.fontSize(24).text('Candidate Details Report', { align: 'center' });
        doc.moveDown();
        results.forEach((candidate, index) => {
            doc.fontSize(16).text(`Candidate ${index + 1}: ${candidate.name}`, { align: 'left' });
            doc.fontSize(12).text(`Post: ${candidate.post}`, { align: 'left' });
            doc.fontSize(12).text(`State: ${candidate.state}`, { align: 'left' });
            doc.moveDown();
        });

        doc.end();
    });
});

// Route to generate voting results report
app.get('/generate-voting-results-report', (req, res) => {
    const doc = new PDFDocument();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="voting_results_report.pdf"');
    doc.pipe(res);

    const sql = 'SELECT candidates.post, candidates.name, COUNT(*) AS votes_count FROM candidates JOIN votes ON candidates.id = votes.candidate_id GROUP BY candidates.post, candidates.name';
    db.query(sql, (err, results) => {
        if (err) {
            console.error('Error fetching voting results:', err);
            res.status(500).send('Error fetching voting results');
            return;
        }

        doc.fontSize(24).text('Voting Results Report', { align: 'center' });
        doc.moveDown();
        results.forEach((result, index) => {
            doc.fontSize(16).text(`Post: ${result.post}`, { align: 'left' });
            doc.fontSize(12).text(`Candidate: ${result.name}`, { align: 'left' });
            doc.fontSize(12).text(`Votes Count: ${result.votes_count}`, { align: 'left' });
            doc.moveDown();
        });

        doc.end();
    });
});


// Start server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
