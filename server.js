require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const session = require('express-session');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
    secret: '12345678', // Change this to a strong secret
    resave: false,
    saveUninitialized: true
}));

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
app.get("/menu-items", (req, res) => {
    db.query("SELECT item_id, item_name, price FROM menu", (err, results) => {
        if (err) return res.status(500).json({ error: "Database error" });
        res.json(results);
    });
});

// ✅ Place Order
app.post("/add-order", (req, res) => {
    const { tableNo, itemName, waiterId, quantity, comment } = req.body;
    const status = "In Queue";
  
    const getItemRateQuery = `SELECT price FROM menu WHERE item_name = ?`;
  
    db.query(getItemRateQuery, [itemName], (err, result) => {
      if (err) {
        console.error("Error fetching item price:", err);
        return res.status(500).json({ message: "Error retrieving item price" });
      }
  
      if (result.length === 0) {
        return res.status(404).json({ message: "Item not found in menu" });
      }
  
      const rate = result[0].price;
      const amount = rate * quantity;
  
      const insertOrderQuery = `
        INSERT INTO orders (table_no, item_name, status, waiter_id, quantity, comment)
        VALUES (?, ?, ?, ?, ?, ?)
      `;
  
      const orderValues = [tableNo, itemName, status, waiterId, quantity, comment];
  
      db.query(insertOrderQuery, orderValues, (err, orderResult) => {
        if (err) {
          console.error("Error inserting order:", err);
          return res.status(500).json({ message: "Error saving order" });
        }
  
        // Insert into bill table (without item_id and comment)
        const insertBillQuery = `
          INSERT INTO bill (table_no, item_name, quantity, rate, amount)
          VALUES (?, ?, ?, ?, ?)
        `;
  
        const billValues = [tableNo, itemName, quantity, rate, amount];
  
        db.query(insertBillQuery, billValues, (err, billResult) => {
          if (err) {
            console.error("Error inserting into bill:", err);
            return res.status(500).json({ message: "Order saved, but failed to save bill" });
          }
  
          res.status(200).json({ message: "Order and bill added successfully!" });
        });
      });
    });
  });
  
  

// Route to handle adding a new waiter
app.post('/add-waiter', (req, res) => {
    const { username, password } = req.body;
  
    if (!username || !password) {
      return res.status(400).json({ message: 'Username and Password are required.' });
    }
  
    // Insert into the 'users' table
    const query = 'INSERT INTO users (id, password) VALUES (?, ?)';
    db.query(query, [username, password], (err, results) => {
      if (err) {
        console.error('Error inserting waiter:', err);
        return res.status(500).json({ message: 'Server error' });
      }
  
      console.log('Waiter added with ID:', results.insertId);
      res.status(201).json({ message: 'Waiter added successfully!' });
    });
  });
  

// ✅ Serve Order
app.post("/serve-order", async (req, res) => {
    const { tableNo, item } = req.body;
    const waiterId = req.session.waiterId; // ✅ Get Waiter ID from session

    if (!waiterId) {
        return res.status(401).json({ message: "Unauthorized: Waiter not logged in" });
    }

    try {
        // Check if the order exists and belongs to the logged-in waiter
        const [order] = await db.promise().query(
            "SELECT * FROM orders WHERE table_no = ? AND item_name = ? AND waiter_id = ?", 
            [tableNo, item, waiterId]
        );

        if (order.length === 0) {
            return res.status(403).json({ message: "You are not authorized to serve this order" });
        }

        // Delete the order from the database after serving
        await db.promise().query(
            "DELETE FROM orders WHERE table_no = ? AND item_name = ? AND waiter_id = ?", 
            [tableNo, item, waiterId]
        );

        res.json({ message: "Order served successfully" });

    } catch (error) {
        console.error("Error serving order:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

// ✅ Fetch Kitchen Orders
app.get('/get-orders', (req, res) => {
    const query = "SELECT table_no, item_name, quantity, comment, status FROM orders";

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

    db.query(
        'UPDATE orders SET status = ? WHERE table_no = ? AND item_name = ?',
        [status, tableNo, item],
        (err, result) => {
            if (err) {
                console.error("Database update error:", err);
                return res.status(500).json({ message: 'Error updating order status.' });
            }

            res.status(200).json({ message: 'Order status updated successfully' });
        }
    );
});

// ✅ Fetch Ready Orders
app.get('/get-ready-orders', (req, res) => {
    const query = `
        SELECT table_no, item_name, quantity, waiter_id, comment 
        FROM orders 
        WHERE status = 'Ready'
    `;

    db.query(query, (err, results) => {
        if (err) {
            console.error("❌ Error fetching ready orders:", err);
            return res.status(500).json({ error: "Internal Server Error" });
        }

        res.json(results);
    });
});



// Waiter Login Route
app.post("/waiter_login", (req, res) => {
    const { id, password } = req.body;
    const query = "SELECT * FROM users WHERE id = ? AND password = ?";

    db.query(query, [id, password], (err, results) => {
        if (err) {
            console.error("❌ Login Error:", err.message);
            return res.status(500).json({ success: false, message: "Internal Server Error" });
        }

        if (results.length > 0) {
            req.session.waiterId = id; // ✅ Store Waiter ID in session
            res.json({ success: true, waiter_id: id }); // ✅ JSON response for fetch
        } else {
            res.status(401).json({ success: false, message: "Invalid Waiter ID or Password" });
        }
    });
});


// Kitchen Login Route
app.post("/kitchen_login", (req, res) => {
    const { id, password } = req.body;
    const query = "SELECT * FROM kitchen WHERE id = ? AND password = ?";
    db.query(query, [id, password], (err, results) => {
        if (err) throw err;
        if (results.length > 0) {
            res.redirect("/kitchen.html"); // Redirect to kitchen home page
        } else {
            res.send("Invalid Kitchen ID or Password");
        }
    });
});

// Get-waiter 
// ✅ Get Waiter Info (used on home.html to personalize UI)
app.get('/get-waiter', (req, res) => {
    const waiterId = req.session.waiterId;

    if (!waiterId) {
        return res.status(401).json({ message: "Unauthorized: Waiter not logged in" });
    }

    res.json({ waiter_id: waiterId });
});

app.get("/generate-bill/:tableNo", (req, res) => {
    const tableNo = req.params.tableNo;
  
    const query = `
      SELECT item_name, quantity, rate
      FROM bill
      WHERE table_no = ?
    `;
  
    db.query(query, [tableNo], (err, result) => {
      if (err) {
        console.error("Error fetching bill:", err);
        return res.status(500).json({ message: "Internal Server Error" });
      }
  
      if (result.length === 0) {
        return res.json({ orders: [], total: 0 });
      }
  
      // Ensure all numbers are treated as actual numbers
      const orders = result.map(row => ({
        item_name: row.item_name,
        quantity: parseFloat(row.quantity),
        rate: parseFloat(row.rate)
      }));
  
      const total = orders.reduce((sum, item) => {
        return sum + (item.quantity * item.rate);
      }, 0);
  
      res.json({
        orders,
        total: parseFloat(total.toFixed(2)) // ensures it's a proper number, not a string
      });
    });
  });
  

  app.post('/save-bill', (req, res) => {
    const { table_no, total_amount } = req.body;
    const timestamp = new Date();

    const insertQuery = `
        INSERT INTO bill_records (table_no, total_amount)
        VALUES (?, ?)
    `;

    db.query(insertQuery, [table_no, total_amount], (err, result) => {
        if (err) {
            console.error("Error saving bill record:", err);
            return res.status(500).json({ message: "Failed to save bill record" });
        }

        res.json({ success: true });
    });
});


  // Example using Node.js (Express)
  app.delete("/pay-bill/:tableNo", (req, res) => {
    const tableNo = req.params.tableNo;
  
    // Step 1: Get the total bill amount
    const getAmountQuery = `SELECT SUM(quantity * rate) AS totalAmount FROM bill WHERE table_no = ?`;
  
    db.query(getAmountQuery, [tableNo], (err, result) => {
      if (err) {
        console.error("Error calculating total amount:", err);
        return res.status(500).json({ message: "Internal Server Error" });
      }
  
      const totalAmount = result[0].totalAmount || 0;
  
      if (totalAmount === 0) {
        return res.status(400).json({ message: "No bill found for this table." });
      }
  
      // Step 2: Insert into bill_records
      const insertQuery = `INSERT INTO bill_records (table_no, amount) VALUES (?, ?)`;
  
      db.query(insertQuery, [tableNo, totalAmount], (err, result) => {
        if (err) {
          console.error("Error inserting into bill_records:", err);
          return res.status(500).json({ message: "Internal Server Error" });
        }
  
        // Step 3: Delete from bill table
        const deleteQuery = `DELETE FROM bill WHERE table_no = ?`;
  
        db.query(deleteQuery, [tableNo], (err, result) => {
          if (err) {
            console.error("Error deleting from bill:", err);
            return res.status(500).json({ message: "Internal Server Error" });
          }
  
          res.json({ message: `Bill paid. Total ₹${totalAmount} recorded and cleared for Table ${tableNo}.` });
        });
      });
    });
  });
  
  // get waiter_id
  app.get("/api/waiters", (req, res) => {
    const sql = "SELECT id FROM users";
    db.query(sql, (err, result) => {
      if (err) {
        console.error("Error fetching users:", err);
        return res.status(500).json({ error: "Internal Server Error" });
      }
  
      res.json(result);
    });
  });
  

  // delete waiter
  app.delete("/api/waiters/:name", (req, res) => {
    const name = req.params.name;
  
    const sql = "DELETE FROM users WHERE id = ?";
    db.query(sql, [name], (err, result) => {
      if (err) {
        console.error("Error deleting user:", err);
        return res.status(500).json({ error: "Internal Server Error" });
      }
  
      if (result.affectedRows === 0) {
        return res.status(404).json({ error: "User not found" });
      }
  
      res.json({ message: "User deleted successfully." });
    });
  });
  
  
// Get sales Data
// 📊 API route to fetch sales data
function formatSales(rows, labelField) {
  const sales = {};
  rows.forEach(row => {
    sales[row[labelField]] = row.total_sales;
  });
  return sales;
}

app.get('/sales-data', (req, res) => {
  const period = req.query.period;

  let groupBy = '';
  let labelFormat = '';

  if (period === 'daily') {
    labelFormat = 'DATE(bill_date)';
    groupBy = 'DATE(bill_date)';
  } else if (period === 'weekly') {
    labelFormat = 'CONCAT(YEAR(bill_date), "-W", WEEK(bill_date))';
    groupBy = 'CONCAT(YEAR(bill_date), "-W", WEEK(bill_date))';
  } else if (period === 'monthly') {
    labelFormat = 'DATE_FORMAT(bill_date, "%Y-%m")';
    groupBy = 'DATE_FORMAT(bill_date, "%Y-%m")';
  } else if (period === 'yearly') {
    labelFormat = 'YEAR(bill_date)';
    groupBy = 'YEAR(bill_date)';
  } else {
    return res.status(400).json({ error: 'Invalid period specified' });
  }

  const sql = `
    SELECT ${labelFormat} AS label, SUM(amount) AS total
    FROM bill_records
    GROUP BY ${groupBy}
    ORDER BY label;
  `;

  db.query(sql, (err, results) => {
    if (err) {
      console.error("MySQL query error:", err);
      return res.status(500).json({ error: 'Database error' });
    }

    res.json(results);
  });
});


// Start Server
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
});
