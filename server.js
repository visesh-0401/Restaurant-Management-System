require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const app = express();

app.use(cors());
app.use(bodyParser.json());

// ✅ Serve static files from 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// MySQL Connection
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'Visesh@4104', // Update your password accordingly
    database: 'restaurant_db'
});

db.connect(err => {
    if (err) {
        console.error("❌ MySQL Connection Failed:", err.message);
        process.exit(1); // Stop the server if DB connection fails
    }
    console.log('✅ MySQL Connected!');
});

// Mock user credentials (replace this with a database check in a real scenario)
const validUser = {
    username: 'admin',
    password: 'password123'
};

// Handle login
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    if (username === validUser.username && password === validUser.password) {
        // Authentication successful
        res.json({ success: true });
    } else {
        // Authentication failed
        res.json({ success: false });
    }
});

// Serve the home page
app.get('/home.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'home.html'));
});

// Serve login page as the default page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

// Fetch Menu Items
app.get('/menu', (req, res) => {
    const query = 'SELECT * FROM menu';
    
    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// ✅ Place Order
app.post('/add-order', (req, res) => {
    const { tableNo, itemName } = req.body;
    if (!tableNo || !itemName) {
        return res.status(400).json({ error: "Missing tableNo or itemName" });
    }

    const query = "INSERT INTO orders (table_no, item_name, status) VALUES (?, ?, 'In Queue')";
    db.query(query, [tableNo, itemName], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, message: `Order added for Table ${tableNo}` });
    });
});

// ✅ Fetch Kitchen Orders
app.get('/get-orders', (req, res) => {
    const query = "SELECT table_no, item_name, status FROM orders"; // Ensure status is fetched
    
    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// ✅ Update Order Status
app.post('/update-order', (req, res) => {
    const { status, tableNo, item } = req.body;

    // Check if data is correctly received
    console.log('Received data:', { status, tableNo, item });

    // If the received data is correct, proceed with your database update query here
    // For example:
    db.query(
        'UPDATE orders SET status = ? WHERE table_no = ? AND item_name = ?',
        [status, tableNo, item],
        (err, result) => {
            if (err) {
                console.error("Database update error:", err);
                return res.status(500).json({ message: 'Error updating order status.' });
            }

            // Successfully updated
            res.status(200).json({ message: 'Order status updated successfully' });
        }
    );
});

// ✅ Fetch Ready Orders
app.get('/get-ready-orders', (req, res) => {
    const query = "SELECT table_no, item_name FROM orders WHERE status = 'Ready'";
    
    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// Start Server
const PORT = 5000;
app.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
});
