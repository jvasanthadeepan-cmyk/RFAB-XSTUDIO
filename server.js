const express = require("express");
const path = require("path");
const cors = require("cors");
const pool = require("./backend/db");
const ExcelJS = require("exceljs");
const setupDatabase = require(path.join(__dirname, "backend", "setup_db.js"));

const app = express();

// Middleware
app.use(cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true
}));

app.use(express.json());

// Serve static files from the root directory
app.use(express.static(__dirname));

// Request logging middleware
app.use((req, res, next) => {
    console.log(`📍 ${req.method} ${req.path}`);
    next();
});

// ============================================
// HEALTH CHECK
// ============================================
app.get("/health", (req, res) => {
    res.json({ status: "✓ Server online", timestamp: new Date() });
});

app.get("/test", (req, res) => {
    res.json({ message: "✓ Server running" });
});

// ============================================
// LOGIN - WORKS WITH USERNAME AND MAIL ✅
// Uses 'mail' column (not 'email')
// ============================================
app.post("/login", async (req, res) => {
    try {
        // Accept both username and mail (email address in mail column)
        const { username, mail, password } = req.body;

        // If frontend sends 'email', accept it and treat as 'mail'
        const emailOrMail = mail || req.body.email;

        // Require either username or mail/email
        if (!username && !emailOrMail) {
            console.log("❌ No credentials provided");
            return res.status(400).json({ message: "Username or email required" });
        }

        if (!password) {
            console.log("❌ No password provided");
            return res.status(400).json({ message: "Password required" });
        }

        console.log(`🔐 Login attempt - Username: ${username}, Mail/Email: ${emailOrMail}`);

        let userQuery;

        // Search by MAIL column (email address) if provided
        if (emailOrMail) {
            console.log(`📧 Searching by mail column: ${emailOrMail}`);
            userQuery = await pool.query(
                "SELECT * FROM users WHERE mail=$1 AND password=$2",
                [emailOrMail, password]
            );
        }
        // Search by USERNAME if provided
        else if (username) {
            console.log(`👤 Searching by username: ${username}`);
            userQuery = await pool.query(
                "SELECT * FROM users WHERE username=$1 AND password=$2",
                [username, password]
            );
        }

        // Check if user found
        if (userQuery.rows.length === 0) {
            console.log("❌ Invalid username/email or password");
            return res.status(401).json({ message: "Invalid login" });
        }

        const user = userQuery.rows[0];
        console.log(`✅ Login successful for: ${user.username}`);
        res.json(user);
    } catch (err) {
        console.error("❌ Login error:", err);
        res.status(500).json({ message: "Server error" });
    }
});

// ============================================
// REGISTER
// ============================================
app.post("/register", async (req, res) => {
    try {
        const { username, password, fullname, mail, rollno, department } = req.body;

        if (!username || !password || !fullname || !mail || !rollno || !department) {
            return res.status(400).json({ message: "All fields are required" });
        }

        const existingUser = await pool.query(
            "SELECT * FROM users WHERE username=$1",
            [username]
        );

        if (existingUser.rows.length > 0) {
            return res.status(400).json({ message: "Username already exists" });
        }

        const result = await pool.query(
            "INSERT INTO users (username, password, fullname, mail, rollno, department) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, username, fullname, mail, rollno, department",
            [username, password, fullname, mail, rollno, department]
        );

        res.status(200).json({ message: "User registered successfully", user: result.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Registration error: " + err.message });
    }
});

// ============================================
// UPLOAD USERS (BULK REGISTRATION)
// ============================================
app.post("/upload-users", async (req, res) => {
    console.log("\n========== POST /upload-users ==========");

    try {
        const { users } = req.body;

        // Validation
        if (!users) {
            console.log("❌ No users provided");
            return res.status(400).json({ message: "No users provided" });
        }

        if (!Array.isArray(users)) {
            console.log("❌ Users is not an array");
            return res.status(400).json({ message: "Users must be an array" });
        }

        if (users.length === 0) {
            console.log("❌ Users array is empty");
            return res.status(400).json({ message: "Users array is empty" });
        }

        console.log(`📥 Processing ${users.length} users...`);

        let uploadedCount = 0;
        let failedCount = 0;
        const errors = [];

        // Process each user
        for (let index = 0; index < users.length; index++) {
            const user = users[index];
            const rowNum = index + 1; // Row number for error messages

            console.log(`\n📝 Processing user ${rowNum}:`, {
                username: user.username,
                mail: user.mail,
                fullname: user.full_name,
                rollno: user.roll_no,
                department: user.department,
                role: user.role
            });

            try {
                // Validate required fields
                if (!user.username || !user.password) {
                    const error = `Row ${rowNum}: Missing required fields (username or password)`;
                    console.warn(`⚠️ ${error}`);
                    errors.push(error);
                    failedCount++;
                    continue;
                }

                const username = String(user.username).trim();
                const password = String(user.password).trim();
                const mail = user.mail ? String(user.mail).trim() : '';
                const fullname = user.full_name ? String(user.full_name).trim() : '';
                const rollno = user.roll_no ? String(user.roll_no).trim() : '';
                const department = user.department ? String(user.department).trim() : '';

                console.log(`  Username: ${username}`);
                console.log(`  Mail: ${mail}`);
                console.log(`  Full Name: ${fullname}`);
                console.log(`  Roll No: ${rollno}`);
                console.log(`  Department: ${department}`);

                // Check if user already exists
                const existing = await pool.query(
                    "SELECT * FROM users WHERE username=$1",
                    [username]
                );

                if (existing.rows.length > 0) {
                    const error = `Row ${rowNum}: Username already exists: ${username}`;
                    console.warn(`⚠️ ${error}`);
                    errors.push(error);
                    failedCount++;
                    continue;
                }

                // INSERT new user
                console.log(`  ✨ Creating new user...`);
                await pool.query(
                    "INSERT INTO users (username, password, fullname, mail, rollno, department) VALUES ($1,$2,$3,$4,$5,$6)",
                    [username, password, fullname, mail, rollno, department]
                );

                uploadedCount++;
                console.log(`  ✅ User created successfully`);

            } catch (error) {
                failedCount++;
                const errorMsg = `Row ${rowNum}: ${error.message}`;
                console.error(`❌ ${errorMsg}`);
                errors.push(errorMsg);
            }
        }

        const summary = `Created: ${uploadedCount}, Failed: ${failedCount}`;

        console.log("\n========== Upload Summary ==========");
        console.log(`✅ Total Success: ${uploadedCount}/${users.length}`);
        console.log(summary);

        if (errors.length > 0) {
            console.log(`⚠️ Errors encountered:`);
            errors.forEach(err => console.log(`   - ${err}`));
        }

        // Return response based on success/failure
        if (uploadedCount === 0) {
            return res.status(400).json({
                message: "No users were uploaded",
                summary: summary,
                errors: errors
            });
        }

        res.status(200).json({
            message: `${uploadedCount} user(s) uploaded successfully (${summary})`,
            created: uploadedCount,
            failed: failedCount,
            errors: errors.length > 0 ? errors : undefined
        });

    } catch (err) {
        console.error("❌ Upload error:", err);
        res.status(500).json({
            message: "Upload processing error",
            error: err.message
        });
    }
});

// ============================================
// LAB INVENTORY ENDPOINTS (Stock Book) ✅ ONLY ADDED THIS SECTION
// ============================================

// GET all lab_inventory records
app.get("/lab-inventory", async (req, res) => {
    console.log("📚 GET /lab-inventory");
    try {
        const result = await pool.query("SELECT * FROM lab_inventory ORDER BY id ASC");
        console.log(`✓ Found ${result.rows.length} records`);
        res.json(result.rows);
    } catch (err) {
        console.error("❌ Error:", err.message);
        res.status(500).json({ message: "Error fetching inventory: " + err.message });
    }
});

// UPDATE lab_inventory record
app.put("/lab-inventory/:id", async (req, res) => {
    console.log("\n========== PUT /lab-inventory/:id ==========");
    try {
        const { id } = req.params;
        const {
            material_code,
            material_name,
            material_type,
            supplier_address,
            bill_no_invoice,
            opening_balance,
            quantity_received,
            quantity_issued,
            balance
        } = req.body;

        console.log(`📝 Updating record ID: ${id}`);
        console.log(`  Code: ${material_code}`);
        console.log(`  Name: ${material_name}`);

        // Validate
        if (!material_code || !material_name) {
            console.log("❌ Validation failed");
            return res.status(400).json({ message: "Material Code and Name are required" });
        }

        // Check if exists
        const check = await pool.query("SELECT id FROM lab_inventory WHERE id = $1", [id]);
        if (check.rows.length === 0) {
            console.log("❌ Record not found");
            return res.status(404).json({ message: "Record not found" });
        }

        // Update with EXACT column names from lab_inventory table
        const result = await pool.query(
            `UPDATE lab_inventory 
       SET material_code = $1, 
           material_name = $2, 
           material_type = $3, 
           supplier_address = $4, 
           bill_no_invoice = $5, 
           opening_balance = $6, 
           quantity_received = $7, 
           quantity_issued = $8, 
           balance = $9
       WHERE id = $10
       RETURNING *`,
            [
                material_code,
                material_name,
                material_type || null,
                supplier_address || null,
                bill_no_invoice || null,
                parseInt(opening_balance) || 0,
                parseInt(quantity_received) || 0,
                parseInt(quantity_issued) || 0,
                parseInt(balance) || 0,
                id
            ]
        );

        console.log(`✅ Record updated successfully!`);
        res.json({
            message: 'Record updated successfully',
            record: result.rows[0]
        });
    } catch (err) {
        console.error("❌ Error:", err.message);
        res.status(500).json({ message: "Error updating record: " + err.message });
    }
});

// DELETE lab_inventory record
app.delete("/lab-inventory/:id", async (req, res) => {
    console.log("\n========== DELETE /lab-inventory/:id ==========");
    try {
        const { id } = req.params;

        console.log(`🗑️ Deleting record ID: ${id}`);

        // Check if exists
        const check = await pool.query("SELECT material_code FROM lab_inventory WHERE id = $1", [id]);
        if (check.rows.length === 0) {
            console.log("❌ Record not found");
            return res.status(404).json({ message: "Record not found" });
        }

        const materialCode = check.rows[0].material_code;

        // Delete
        await pool.query("DELETE FROM lab_inventory WHERE id = $1", [id]);

        console.log(`✅ Record deleted: ${materialCode}`);
        res.json({ message: "Record deleted successfully", material_code: materialCode });
    } catch (err) {
        console.error("❌ Error:", err.message);
        res.status(500).json({ message: "Error deleting record: " + err.message });
    }
});

// ============================================
// MATERIALS
// ============================================
app.get("/materials", async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM materials ORDER BY id ASC");
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: "Error fetching materials" });
    }
});

app.get("/materials/:code", async (req, res) => {
    try {
        const code = req.params.code;

        // Try to find by code first
        let result = await pool.query(
            "SELECT * FROM materials WHERE material_code=$1",
            [code]
        );

        // If not found and code is numeric, try as ID
        if (result.rows.length === 0 && !isNaN(code)) {
            result = await pool.query(
                "SELECT * FROM materials WHERE id=$1",
                [parseInt(code)]
            );
        }

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Material not found" });
        }

        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ message: "Error fetching material" });
    }
});

app.get("/materials/search", async (req, res) => {
    try {
        const q = req.query.q;
        const result = await pool.query(
            "SELECT * FROM materials WHERE material_name ILIKE $1 OR material_code ILIKE $1 LIMIT 10",
            [`%${q}%`]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: "Error searching materials" });
    }
});

// ============================================
// UPDATE MATERIAL (PUT) - FOR STOCK BOOK
// ============================================
app.put("/materials/:id", async (req, res) => {
    console.log("\n========== PUT /materials/:id ==========");

    try {
        const { id } = req.params;
        const {
            material_code,
            material_name,
            material_type,
            category,
            supplier_address,
            bill_no_invoice,
            opening_balance,
            quantity_received,
            quantity_issued,
            balance,
            available_qty
        } = req.body;

        console.log(`📝 Updating material ID: ${id}`);
        console.log(`  Code: ${material_code}`);
        console.log(`  Name: ${material_name}`);
        console.log(`  Type: ${material_type}`);
        console.log(`  Category: ${category}`);
        console.log(`  Supplier: ${supplier_address}`);
        console.log(`  Bill No: ${bill_no_invoice}`);
        console.log(`  Opening Balance: ${opening_balance}`);
        console.log(`  Qty Received: ${quantity_received}`);
        console.log(`  Qty Issued: ${quantity_issued}`);
        console.log(`  Balance: ${balance}`);

        // Validate required fields
        if (!material_code || !material_name) {
            console.log("❌ Validation failed: Material Code and Name are required");
            return res.status(400).json({
                message: 'Material Code and Name are required'
            });
        }

        // Check if material exists
        const checkQuery = 'SELECT * FROM materials WHERE id = $1';
        const checkResult = await pool.query(checkQuery, [id]);

        if (checkResult.rows.length === 0) {
            console.log(`❌ Material not found: ${id}`);
            return res.status(404).json({
                message: 'Material not found'
            });
        }

        console.log("✓ Material exists, proceeding with update");

        // Update material with correct column names
        const updateQuery = `
      UPDATE materials 
      SET 
        material_code = $1,
        material_name = $2,
        material_type = $3,
        supplier_address = $4,
        bill_no_invoice = $5,
        opening_balance = $6,
        quantity_received = $7,
        quantity_issued = $8,
        balance = $9,
        available_quantity = $10
      WHERE id = $11
      RETURNING *
    `;

        const values = [
            material_code,
            material_name,
            material_type || null,
            supplier_address || null,
            bill_no_invoice || null,
            parseInt(opening_balance) || 0,
            parseInt(quantity_received) || 0,
            parseInt(quantity_issued) || 0,
            parseInt(balance) || 0,
            parseInt(available_qty) || 0,
            id
        ];

        console.log("⚙️ Executing update query...");
        const result = await pool.query(updateQuery, values);

        if (result.rows.length === 0) {
            console.log("❌ Update returned no rows");
            return res.status(400).json({
                message: 'Failed to update material'
            });
        }

        const updatedMaterial = result.rows[0];
        console.log('✅ Material updated successfully!');
        console.log(`  ID: ${updatedMaterial.id}`);
        console.log(`  Code: ${updatedMaterial.material_code}`);
        console.log(`  Name: ${updatedMaterial.material_name}`);

        res.json({
            message: 'Material updated successfully',
            id: updatedMaterial.id,
            material_code: updatedMaterial.material_code,
            material_name: updatedMaterial.material_name,
            available_quantity: updatedMaterial.available_quantity
        });

    } catch (error) {
        console.error('❌ Update error:', error.message);
        console.error('Error code:', error.code);
        res.status(500).json({
            message: 'Server error: ' + error.message
        });
    }
});

// ============================================
// DELETE MATERIAL (DELETE) - FOR STOCK BOOK
// ============================================
app.delete("/materials/:id", async (req, res) => {
    console.log("\n========== DELETE /materials/:id ==========");

    try {
        const { id } = req.params;

        console.log(`🗑️ Deleting material ID: ${id}`);

        // Check if material exists
        const checkQuery = 'SELECT material_code FROM materials WHERE id = $1';
        const checkResult = await pool.query(checkQuery, [id]);

        if (checkResult.rows.length === 0) {
            console.log(`❌ Material not found: ${id}`);
            return res.status(404).json({
                message: 'Material not found'
            });
        }

        const materialCode = checkResult.rows[0].material_code;
        console.log(`✓ Material found: ${materialCode}`);

        // Delete material
        const deleteQuery = 'DELETE FROM materials WHERE id = $1 RETURNING id';
        console.log("⚙️ Executing delete query...");
        const result = await pool.query(deleteQuery, [id]);

        if (result.rows.length === 0) {
            console.log("❌ Delete returned no rows");
            return res.status(400).json({
                message: 'Failed to delete material'
            });
        }

        console.log(`✅ Material deleted successfully!`);
        console.log(`  Code: ${materialCode}`);
        console.log(`  ID: ${id}`);

        res.json({
            message: 'Material deleted successfully',
            material_code: materialCode,
            id: id
        });

    } catch (error) {
        console.error('❌ Delete error:', error.message);
        console.error('Error code:', error.code);
        res.status(500).json({
            message: 'Server error: ' + error.message
        });
    }
});

// ============================================
// UPLOAD MATERIALS - IMPROVED
// ============================================
app.post("/upload-materials", async (req, res) => {
    console.log("\n========== POST /upload-materials ==========");

    try {
        const { materials } = req.body;

        // Validation
        if (!materials) {
            console.log("❌ No materials provided");
            return res.status(400).json({ message: "No materials provided" });
        }

        if (!Array.isArray(materials)) {
            console.log("❌ Materials is not an array");
            return res.status(400).json({ message: "Materials must be an array" });
        }

        if (materials.length === 0) {
            console.log("❌ Materials array is empty");
            return res.status(400).json({ message: "Materials array is empty" });
        }

        console.log(`📥 Processing ${materials.length} materials...`);

        let uploadedCount = 0;
        let updatedCount = 0;
        let failedCount = 0;
        const errors = [];

        // Process each material
        for (let index = 0; index < materials.length; index++) {
            const material = materials[index];
            const rowNum = index + 2; // Row number in Excel (starting from row 2)

            console.log(`\n📝 Processing row ${rowNum}:`, material);

            try {
                // Validate required fields
                if (!material.material_code || !material.material_name) {
                    const error = `Row ${rowNum}: Missing required fields (material_code or material_name)`;
                    console.warn(`⚠️ ${error}`);
                    errors.push(error);
                    failedCount++;
                    continue;
                }

                const materialCode = String(material.material_code).trim();
                const materialName = String(material.material_name).trim();
                const totalQty = parseInt(material.total_qty) || 0;
                const availableQty = parseInt(material.available_qty) || 0;

                console.log(`  Material Code: ${materialCode}`);
                console.log(`  Material Name: ${materialName}`);
                console.log(`  Total Qty: ${totalQty}`);
                console.log(`  Available Qty: ${availableQty}`);

                // Validate quantities
                if (availableQty > totalQty) {
                    const error = `Row ${rowNum}: Available quantity (${availableQty}) exceeds total quantity (${totalQty})`;
                    console.warn(`⚠️ ${error}`);
                    errors.push(error);
                    failedCount++;
                    continue;
                }

                // Check if material already exists
                const existing = await pool.query(
                    "SELECT * FROM materials WHERE material_code=$1",
                    [materialCode]
                );

                if (existing.rows.length > 0) {
                    // UPDATE existing material
                    console.log(`  ♻️ Material exists, updating...`);
                    await pool.query(
                        "UPDATE materials SET material_name=$1, total_qty=$2, available_qty=$3 WHERE material_code=$4",
                        [materialName, totalQty, availableQty, materialCode]
                    );
                    updatedCount++;
                    console.log(`  ✅ Updated successfully`);
                } else {
                    // CREATE new material
                    console.log(`  ✨ Material is new, creating...`);
                    await pool.query(
                        "INSERT INTO materials (material_name, material_code, total_qty, available_qty) VALUES ($1,$2,$3,$4)",
                        [materialName, materialCode, totalQty, available_qty]
                    );
                    uploadedCount++;
                    console.log(`  ✅ Created successfully`);
                }
            } catch (error) {
                failedCount++;
                const errorMsg = `Row ${rowNum}: ${error.message}`;
                console.error(`❌ ${errorMsg}`);
                errors.push(errorMsg);
            }
        }

        const totalSuccess = uploadedCount + updatedCount;
        const summary = `Created: ${uploadedCount}, Updated: ${updatedCount}, Failed: ${failedCount}`;

        console.log("\n========== Upload Summary ==========");
        console.log(`✅ Total Success: ${totalSuccess}/${materials.length}`);
        console.log(summary);

        if (errors.length > 0) {
            console.log(`⚠️ Errors encountered:`);
            errors.forEach(err => console.log(`   - ${err}`));
        }

        // Return response based on success/failure
        if (totalSuccess === 0) {
            return res.status(400).json({
                message: "No materials were uploaded",
                summary: summary,
                errors: errors
            });
        }

        res.status(200).json({
            message: `${totalSuccess} material(s) processed successfully (${summary})`,
            created: uploadedCount,
            updated: updatedCount,
            failed: failedCount,
            errors: errors.length > 0 ? errors : undefined
        });

    } catch (err) {
        console.error("❌ Upload error:", err);
        res.status(500).json({
            message: "Upload processing error",
            error: err.message
        });
    }
});

// ============================================
// TRANSACTIONS
// ============================================
app.get("/transactions", async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM transactions ORDER BY scan_time DESC LIMIT 1000");
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: "Error fetching transactions" });
    }
});

app.post("/checkout", async (req, res) => {
    try {
        const { username, material_code, quantity } = req.body;
        const qty = quantity || 1;

        // Use material_code from request (frontend sends this) but query item_code column
        const mat = await pool.query("SELECT * FROM materials WHERE item_code=$1", [material_code]);

        if (mat.rows.length === 0) {
            return res.status(404).json({ message: "Material not found" });
        }

        const material = mat.rows[0];

        // Use available_qty from DB
        if (material.available_qty < qty) {
            return res.status(400).json({ message: "Insufficient stock available" });
        }

        await pool.query(
            "UPDATE materials SET available_qty = available_qty - $1 WHERE item_code=$2",
            [qty, material_code]
        );

        await pool.query(
            "INSERT INTO transactions (username, item_code, item_name, action) VALUES ($1,$2,$3,$4)",
            [username, material_code, material.item_name, "checkout"]
        );

        res.json({ message: "Checkout successful" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Checkout error: " + err.message });
    }
});

// ============================================
// START SERVER
// ============================================
const PORT = process.env.PORT || 5000;

// Initialize Database then Start Server
setupDatabase()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`\n🚀 Server running on port ${PORT}`);
            console.log(`👉 http://localhost:${PORT}`);
        });
    })
    .catch((err) => {
        console.error("❌ Failed to start server due to database error:");
        console.error(err);
        // Don't exit process, lety Render keep trying or user fix DB
    });

// ============================================
// 404 HANDLER - Serve login.html for unknown routes
// ============================================
app.get("*", (req, res) => {
    if (req.accepts("html")) {
        const loginPath = path.join(__dirname, "login.html");
        const cwdPath = path.join(process.cwd(), "login.html");

        res.sendFile(loginPath, (err) => {
            if (err) {
                console.error("❌ Error sending login.html from:", loginPath);
                console.error("Error details:", err);
                console.log("__dirname:", __dirname);
                console.log("process.cwd():", process.cwd());

                if (loginPath !== cwdPath) {
                    console.log("🔄 Trying fallback path:", cwdPath);
                    res.sendFile(cwdPath, (err2) => {
                        if (err2) {
                            console.error("❌ Fallback failed also:", err2);
                            res.status(404).json({ message: "Login page not found", error: err.message });
                        }
                    });
                } else {
                    res.status(404).json({ message: "Login page not found", error: err.message });
                }
            }
        });
    } else {
        console.log("❌ 404 - Route not found:", req.path);
        res.setHeader("Content-Type", "application/json");
        res.status(404).json({ message: "Route not found" });
    }
});
