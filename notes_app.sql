CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL
);

CREATE TABLE notes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    pinned BOOLEAN DEFAULT FALSE,
    is_archived BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL,
    FOREIGN KEY (user_id)
        REFERENCES users (id)
        ON DELETE CASCADE
);

CREATE TABLE categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    category_name VARCHAR(100) NOT NULL,
    FOREIGN KEY (user_id)
        REFERENCES users (id)
        ON DELETE CASCADE
);

CREATE TABLE note_categories (
    note_id INT NOT NULL,
    category_id INT NOT NULL,
    PRIMARY KEY (note_id , category_id),
    FOREIGN KEY (note_id)
        REFERENCES notes (id)
        ON DELETE CASCADE,
    FOREIGN KEY (category_id)
        REFERENCES categories (id)
        ON DELETE CASCADE
);

CREATE TABLE todos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    task VARCHAR(250) NOT NULL,
    is_completed BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (user_id)
        REFERENCES users (id)
        ON DELETE CASCADE
);

CREATE VIEW active_notes AS
    SELECT 
        *
    FROM
        notes
    WHERE
        is_deleted = FALSE
            AND is_archived = FALSE;

CREATE VIEW archived_notes AS
    SELECT 
        *
    FROM
        notes
    WHERE
        is_archived = TRUE;

CREATE VIEW deleted_notes AS
    SELECT 
        *
    FROM
        notes
    WHERE
        is_deleted = TRUE;

CREATE 
    TRIGGER  before_note_update
 BEFORE UPDATE ON notes FOR EACH ROW 
    SET NEW . updated_at = NOW();