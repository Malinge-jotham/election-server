/*

CREATE DATABASE IF NOT EXISTS voting_system;

USE voting_system;

-- Table for users (voters)
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255) NOT NULL,
    password VARCHAR(255) NOT NULL,
    email VARCHAR(255), -- Nullable field for email
    full_name VARCHAR(255), -- Nullable field for full name
    age INT, -- Nullable field for age
    gender ENUM('Male', 'Female', 'Other'), -- Nullable field for gender
    address TEXT, -- Nullable field for address
    UNIQUE KEY(username)
);

CREATE TABLE IF NOT EXISTS candidates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    post VARCHAR(255) NOT NULL,
    state VARCHAR(255),
    image_url VARCHAR(255), -- Nullable field for image URL
    party VARCHAR(255), -- Nullable field for candidate's party affiliation
    experience TEXT, -- Nullable field for candidate's experience
    achievements TEXT, -- Nullable field for candidate's achievements
    UNIQUE KEY(name, post)
);


-- Table for votes
CREATE TABLE IF NOT EXISTS votes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    voter_id INT NOT NULL,
    candidate_id INT NOT NULL,
    post VARCHAR(255) NOT NULL,
    FOREIGN KEY (voter_id) REFERENCES users(id),
    FOREIGN KEY (candidate_id) REFERENCES candidates(id)
);
