import express, { Request, Response } from 'express';
import mysql from 'mysql2/promise';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

dotenv.config();

const app = express();
const JWT_SECRET = process.env.JWT_SECRET || 'queuetech_secret_change_this';

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ── DATABASE CONNECTION ──
const pool = mysql.createPool({
    host:     process.env.DB_HOST     || 'localhost',
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME     || 'queuetech',
    waitForConnections: true,
    connectionLimit: 10,
});

// ── HELPERS ──
function generateRef(): string {
    const ts = Date.now().toString().slice(-6);
    const rand = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `QT-${ts}${rand}`;
}

// ── AUTH MIDDLEWARE ──
function authMiddleware(req: any, res: any, next: any): void {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) { res.status(401).json({ error: 'Unauthorized' }); return; }
    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch {
        res.status(401).json({ error: 'Invalid token' });
    }
}

function requireRole(...roles: string[]) {
    return (req: any, res: any, next: any) => {
        if (!roles.includes(req.user?.role)) { res.status(403).json({ error: 'Forbidden' }); return; }
        next();
    };
}

// ══════════════════════════════════════════
//  CUSTOMER BOOKING ROUTES
// ══════════════════════════════════════════

// GET /api/branches
app.get('/api/branches', async (_req: Request, res: Response) => {
    try {
        const [rows] = await pool.query('SELECT * FROM branches WHERE is_active = 1');
        res.json(rows);
    } catch { res.status(500).json({ error: 'Failed to fetch branches' }); }
});

// GET /api/services
app.get('/api/services', async (_req: Request, res: Response) => {
    try {
        const [rows] = await pool.query('SELECT * FROM services WHERE is_active = 1 ORDER BY service_name ASC');
        res.json(rows);
    } catch { res.status(500).json({ error: 'Failed to fetch services' }); }
});

// GET /api/bookings/slots
app.get('/api/bookings/slots', async (req: Request, res: Response) => {
    const { branch_id, date } = req.query;
    if (!branch_id || !date) { res.status(400).json({ error: 'branch_id and date are required' }); return; }
    try {
        const [rows] = await pool.query<any[]>(
            `SELECT appointment_time FROM bookings
             WHERE branch_id = ? AND appointment_date = ? AND status != 'cancelled'`,
            [branch_id, date]
        );
        res.json({ booked: rows.map((r: any) => r.appointment_time) });
    } catch { res.status(500).json({ error: 'Failed to fetch slots' }); }
});

// POST /api/bookings
app.post('/api/bookings', async (req: Request, res: Response) => {
    const { branch_id, appointment_date, appointment_time, customer, services } = req.body;
    if (!branch_id || !appointment_date || !appointment_time || !customer || !services?.length) {
        res.status(400).json({ error: 'Missing required fields' }); return;
    }

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const [existing] = await conn.query<any[]>(
            `SELECT id FROM bookings WHERE branch_id = ? AND appointment_date = ? AND appointment_time = ? AND status != 'cancelled'`,
            [branch_id, appointment_date, appointment_time]
        );
        if (existing.length > 0) {
            await conn.rollback();
            res.status(409).json({ error: 'This time slot is already booked.' }); return;
        }

        const [existingCust] = await conn.query<any[]>(
            'SELECT id FROM customers WHERE email = ? OR phone = ?',
            [customer.email, customer.phone]
        );

        let customerId: number;
        if (existingCust.length > 0) {
            customerId = existingCust[0].id;
        } else {
            const [custResult]: any = await conn.query(
                `INSERT INTO customers (full_name, phone, email, social_facebook, social_instagram,
                  social_tiktok, social_twitter, social_viber, social_whatsapp, social_others)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [customer.full_name, customer.phone, customer.email,
                 customer.social_facebook || null, customer.social_instagram || null,
                 customer.social_tiktok || null, customer.social_twitter || null,
                 customer.social_viber || null, customer.social_whatsapp || null,
                 customer.social_others || null]
            );
            customerId = custResult.insertId;
        }

        const totalPrice = services.reduce((sum: number, s: any) => sum + (s.price * s.quantity), 0);
        const ref = generateRef();

        const [bookingResult]: any = await conn.query(
            `INSERT INTO bookings (reference_number, branch_id, customer_id, appointment_date,
              appointment_time, total_price, special_request, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
            [ref, branch_id, customerId, appointment_date, appointment_time,
             totalPrice, customer.special_request || null]
        );
        const bookingId = bookingResult.insertId;

        for (const svc of services) {
            if (svc.is_custom) {
                const [csResult]: any = await conn.query(
                    'INSERT INTO custom_services (booking_id, service_name, description) VALUES (?, ?, ?)',
                    [bookingId, svc.custom_name, svc.custom_desc || null]
                );
                await conn.query(
                    `INSERT INTO booking_services (booking_id, service_id, custom_service_id, quantity, unit_price, subtotal)
                     VALUES (?, NULL, ?, ?, 0, 0)`,
                    [bookingId, csResult.insertId, svc.quantity]
                );
            } else {
                await conn.query(
                    `INSERT INTO booking_services (booking_id, service_id, custom_service_id, quantity, unit_price, subtotal)
                     VALUES (?, ?, NULL, ?, ?, ?)`,
                    [bookingId, svc.service_id, svc.quantity, svc.price, svc.price * svc.quantity]
                );
            }
        }

        await conn.commit();
        res.status(201).json({ success: true, reference_number: ref, booking_id: bookingId });

    } catch (err: any) {
        await conn.rollback();
        console.error(err);
        res.status(500).json({ error: 'Booking failed. Please try again.' });
    } finally { conn.release(); }
});

// GET /api/bookings/:ref
app.get('/api/bookings/:ref', async (req: Request, res: Response) => {
    const { ref } = req.params;
    try {
        const [rows] = await pool.query<any[]>(
            `SELECT b.*, br.name as branch_name, c.full_name, c.phone, c.email
             FROM bookings b
             JOIN branches br ON b.branch_id = br.id
             JOIN customers c ON b.customer_id = c.id
             WHERE b.reference_number = ?`, [ref]
        );
        if (!rows.length) { res.status(404).json({ error: 'Booking not found' }); return; }
        const booking = rows[0];
        const [svcs] = await pool.query<any[]>(
            `SELECT bs.*, s.service_name, cs.service_name as custom_name
             FROM booking_services bs
             LEFT JOIN services s ON bs.service_id = s.id
             LEFT JOIN custom_services cs ON bs.custom_service_id = cs.id
             WHERE bs.booking_id = ?`, [booking.id]
        );
        booking.services = svcs;
        res.json(booking);
    } catch { res.status(500).json({ error: 'Failed to fetch booking' }); }
});

// ══════════════════════════════════════════
//  ADMIN ROUTES
// ══════════════════════════════════════════

// POST /api/admin/login
app.post('/api/admin/login', async (req: Request, res: Response) => {
    const { username, password } = req.body;
    if (!username || !password) { res.status(400).json({ error: 'Username and password required.' }); return; }
    try {
        const [rows] = await pool.query<any[]>(
            'SELECT * FROM staff WHERE username = ? AND is_active = 1', [username]
        );
        if (!rows.length) { res.status(401).json({ error: 'Invalid username or password.' }); return; }
        const staff = rows[0];
        const match = await bcrypt.compare(password, staff.password_hash);
        if (!match) { res.status(401).json({ error: 'Invalid username or password.' }); return; }
        const token = jwt.sign(
            { id: staff.id, name: staff.full_name, username: staff.username, role: staff.role, branch_id: staff.branch_id },
            JWT_SECRET, { expiresIn: '8h' }
        );
        res.json({ token, user: { id: staff.id, name: staff.full_name, username: staff.username, role: staff.role, branch_id: staff.branch_id } });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Login failed.' }); }
});

// GET /api/admin/dashboard
app.get('/api/admin/dashboard', authMiddleware, async (_req, res) => {
    try {
        const [[todayRow]] = await pool.query<any[]>(
            `SELECT COALESCE(SUM(total_price),0) as today_sales, COUNT(*) as transactions
             FROM bookings WHERE DATE(created_at) = CURDATE() AND status != 'cancelled'`
        );
        const [[weekRow]] = await pool.query<any[]>(
            `SELECT COALESCE(SUM(total_price),0) as week_sales FROM bookings
             WHERE YEARWEEK(created_at) = YEARWEEK(NOW()) AND status != 'cancelled'`
        );
        const [[monthRow]] = await pool.query<any[]>(
            `SELECT COALESCE(SUM(total_price),0) as month_sales FROM bookings
             WHERE MONTH(created_at) = MONTH(NOW()) AND YEAR(created_at) = YEAR(NOW()) AND status != 'cancelled'`
        );
        const [recent] = await pool.query<any[]>(
            `SELECT b.reference_number, TIME_FORMAT(b.created_at,'%h:%i %p') as time,
             c.full_name as customer_name, b.status, b.total_price
             FROM bookings b JOIN customers c ON b.customer_id = c.id
             ORDER BY b.created_at DESC LIMIT 10`
        );
        res.json({ today_sales: todayRow.today_sales, transactions: todayRow.transactions, week_sales: weekRow.week_sales, month_sales: monthRow.month_sales, recent_transactions: recent });
    } catch { res.status(500).json({ error: 'Failed to load dashboard.' }); }
});

// GET /api/admin/queue
app.get('/api/admin/queue', authMiddleware, async (req, res) => {
    const { technician_id, branch_id } = req.query;
    let where = 'WHERE 1=1';
    const params: any[] = [];
    if (technician_id) { where += ' AND q.technician_id = ?'; params.push(technician_id); }
    if (branch_id) { where += ' AND q.branch_id = ?'; params.push(branch_id); }
    try {
        const [rows] = await pool.query<any[]>(
            `SELECT q.*, c.full_name as customer_name, s.full_name as technician_name,
             TIME_FORMAT(q.created_at,'%h:%i %p') as time FROM queue q
             LEFT JOIN customers c ON q.customer_id = c.id
             LEFT JOIN staff s ON q.technician_id = s.id
             ${where} AND DATE(q.created_at) = CURDATE()
             ORDER BY q.queue_number ASC`, params
        );
        res.json(rows);
    } catch { res.status(500).json({ error: 'Failed to load queue.' }); }
});

// POST /api/admin/queue
app.post('/api/admin/queue', authMiddleware, async (req, res) => {
    const { customer_name, phone, service, technician_id, branch_id } = req.body;
    if (!customer_name || !service) { res.status(400).json({ error: 'Required fields missing.' }); return; }
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        let customerId: number;
        const [existing] = await conn.query<any[]>('SELECT id FROM customers WHERE phone = ?', [phone]);
        if (existing.length) { customerId = existing[0].id; }
        else { const [r]: any = await conn.query('INSERT INTO customers (full_name, phone) VALUES (?,?)', [customer_name, phone]); customerId = r.insertId; }
        const [[numRow]] = await conn.query<any[]>(`SELECT COALESCE(MAX(queue_number),0)+1 as next_num FROM queue WHERE DATE(created_at) = CURDATE() AND branch_id = ?`, [branch_id]);
        const [result]: any = await conn.query(`INSERT INTO queue (customer_id, service, technician_id, branch_id, queue_number, status) VALUES (?,?,?,?,?,'waiting')`, [customerId, service, technician_id || null, branch_id, numRow.next_num]);
        await conn.commit();
        res.status(201).json({ id: result.insertId, queue_number: numRow.next_num });
    } catch { await conn.rollback(); res.status(500).json({ error: 'Failed to add to queue.' }); }
    finally { conn.release(); }
});

// POST /api/admin/queue/:id/advance
app.post('/api/admin/queue/:id/advance', authMiddleware, async (req, res) => {
    const { id } = req.params;
    try {
        const [[item]] = await pool.query<any[]>('SELECT status FROM queue WHERE id = ?', [id]);
        if (!item) { res.status(404).json({ error: 'Not found.' }); return; }
        const next = item.status === 'waiting' ? 'in_progress' : 'done';
        await pool.query('UPDATE queue SET status = ? WHERE id = ?', [next, id]);
        res.json({ success: true, status: next });
    } catch { res.status(500).json({ error: 'Failed to update.' }); }
});

// POST /api/admin/queue/:id/assign
app.post('/api/admin/queue/:id/assign', authMiddleware, requireRole('owner', 'cashier'), async (req, res) => {
    const { id } = req.params;
    const { technician_id } = req.body;
    try {
        await pool.query('UPDATE queue SET technician_id = ? WHERE id = ?', [technician_id, id]);
        res.json({ success: true });
    } catch { res.status(500).json({ error: 'Failed to assign.' }); }
});

// GET /api/admin/appointments
app.get('/api/admin/appointments', authMiddleware, async (_req, res) => {
    try {
        const [rows] = await pool.query<any[]>(
            `SELECT b.id, b.reference_number, b.appointment_date, b.appointment_time, b.status,
             c.full_name as customer_name, br.name as branch_name, s.full_name as technician_name,
             GROUP_CONCAT(svc.service_name SEPARATOR ', ') as service_names
             FROM bookings b JOIN customers c ON b.customer_id = c.id
             JOIN branches br ON b.branch_id = br.id
             LEFT JOIN staff s ON b.technician_id = s.id
             LEFT JOIN booking_services bs ON b.id = bs.booking_id
             LEFT JOIN services svc ON bs.service_id = svc.id
             GROUP BY b.id ORDER BY b.appointment_date DESC, b.appointment_time DESC`
        );
        res.json(rows);
    } catch { res.status(500).json({ error: 'Failed to load appointments.' }); }
});

// PATCH /api/admin/appointments/:id/status
app.patch('/api/admin/appointments/:id/status', authMiddleware, requireRole('owner', 'cashier'), async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    try {
        await pool.query('UPDATE bookings SET status = ? WHERE id = ?', [status, id]);
        res.json({ success: true });
    } catch { res.status(500).json({ error: 'Failed to update.' }); }
});

// GET /api/admin/sales
app.get('/api/admin/sales', authMiddleware, requireRole('owner', 'cashier'), async (_req, res) => {
    try {
        const [rows] = await pool.query<any[]>(
            `SELECT b.reference_number, c.full_name as customer_name, b.status, b.total_price,
             DATE_FORMAT(b.created_at,'%b %d, %Y') as created_at
             FROM bookings b JOIN customers c ON b.customer_id = c.id
             ORDER BY b.created_at DESC LIMIT 100`
        );
        res.json(rows);
    } catch { res.status(500).json({ error: 'Failed to load sales.' }); }
});

// GET /api/admin/services
app.get('/api/admin/services', authMiddleware, async (_req, res) => {
    try {
        const [rows] = await pool.query<any[]>('SELECT * FROM services ORDER BY service_name ASC');
        res.json(rows);
    } catch { res.status(500).json({ error: 'Failed to load services.' }); }
});

// POST /api/admin/services
app.post('/api/admin/services', authMiddleware, requireRole('owner'), async (req, res) => {
    const { service_name, category, duration, price, description } = req.body;
    if (!service_name) { res.status(400).json({ error: 'Service name required.' }); return; }
    try {
        const [r]: any = await pool.query('INSERT INTO services (service_name, category, duration, price, description) VALUES (?,?,?,?,?)', [service_name, category || null, duration || 60, price || 0, description || null]);
        res.status(201).json({ id: r.insertId });
    } catch { res.status(500).json({ error: 'Failed to add service.' }); }
});

// DELETE /api/admin/services/:id
app.delete('/api/admin/services/:id', authMiddleware, requireRole('owner'), async (req, res) => {
    try {
        await pool.query('UPDATE services SET is_active = 0 WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch { res.status(500).json({ error: 'Failed to delete.' }); }
});

// GET /api/admin/staff
app.get('/api/admin/staff', authMiddleware, async (req, res) => {
    const { role } = req.query;
    let where = 'WHERE s.is_active = 1';
    const params: any[] = [];
    if (role) { where += ' AND s.role = ?'; params.push(role); }
    try {
        const [rows] = await pool.query<any[]>(
            `SELECT s.id, s.full_name, s.username, s.role, s.is_active, b.name as branch_name
             FROM staff s LEFT JOIN branches b ON s.branch_id = b.id
             ${where} ORDER BY s.full_name ASC`, params
        );
        res.json(rows);
    } catch { res.status(500).json({ error: 'Failed to load staff.' }); }
});

// POST /api/admin/staff
app.post('/api/admin/staff', authMiddleware, requireRole('owner'), async (req, res) => {
    const { full_name, username, password, role, branch_id } = req.body;
    if (!full_name || !username || !password || !role) { res.status(400).json({ error: 'All fields required.' }); return; }
    try {
        const hash = await bcrypt.hash(password, 10);
        const [r]: any = await pool.query('INSERT INTO staff (full_name, username, password_hash, role, branch_id) VALUES (?,?,?,?,?)', [full_name, username, hash, role, branch_id || null]);
        res.status(201).json({ id: r.insertId });
    } catch (err: any) {
        if (err.code === 'ER_DUP_ENTRY') { res.status(409).json({ error: 'Username already exists.' }); return; }
        res.status(500).json({ error: 'Failed to add staff.' });
    }
});

// DELETE /api/admin/staff/:id
app.delete('/api/admin/staff/:id', authMiddleware, requireRole('owner'), async (req, res) => {
    try {
        await pool.query('UPDATE staff SET is_active = 0 WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch { res.status(500).json({ error: 'Failed to remove staff.' }); }
});

// GET /api/admin/customers
app.get('/api/admin/customers', authMiddleware, async (_req, res) => {
    try {
        const [rows] = await pool.query<any[]>(
            `SELECT c.*, COUNT(b.id) as total_visits, MAX(DATE_FORMAT(b.created_at,'%b %d, %Y')) as last_visit
             FROM customers c LEFT JOIN bookings b ON c.id = b.customer_id
             GROUP BY c.id ORDER BY c.full_name ASC`
        );
        res.json(rows);
    } catch { res.status(500).json({ error: 'Failed to load customers.' }); }
});

// POST /api/admin/customers
app.post('/api/admin/customers', authMiddleware, requireRole('owner', 'cashier'), async (req, res) => {
    const { full_name, phone, email } = req.body;
    if (!full_name) { res.status(400).json({ error: 'Full name required.' }); return; }
    try {
        const [r]: any = await pool.query('INSERT INTO customers (full_name, phone, email) VALUES (?,?,?)', [full_name, phone || null, email || null]);
        res.status(201).json({ id: r.insertId });
    } catch { res.status(500).json({ error: 'Failed to add customer.' }); }
});

// GET /api/admin/commissions
app.get('/api/admin/commissions', authMiddleware, async (req, res) => {
    const { technician_id } = req.query;
    let where = 'WHERE 1=1';
    const params: any[] = [];
    if (technician_id) { where += ' AND cm.technician_id = ?'; params.push(technician_id); }
    try {
        const [rows] = await pool.query<any[]>(
            `SELECT cm.*, s.full_name as technician_name, svc.service_name,
             DATE_FORMAT(cm.created_at,'%b %d, %Y') as created_at
             FROM commissions cm JOIN staff s ON cm.technician_id = s.id
             JOIN services svc ON cm.service_id = svc.id
             ${where} ORDER BY cm.created_at DESC`, params
        );
        res.json(rows);
    } catch { res.status(500).json({ error: 'Failed to load commissions.' }); }
});

// GET /api/admin/backjobs
app.get('/api/admin/backjobs', authMiddleware, async (req, res) => {
    const { technician_id } = req.query;
    let where = 'WHERE 1=1';
    const params: any[] = [];
    if (technician_id) { where += ' AND bj.technician_id = ?'; params.push(technician_id); }
    try {
        const [rows] = await pool.query<any[]>(
            `SELECT bj.*, c.full_name as customer_name, s.full_name as technician_name
             FROM back_jobs bj JOIN customers c ON bj.customer_id = c.id
             LEFT JOIN staff s ON bj.technician_id = s.id
             ${where} ORDER BY bj.created_at DESC`, params
        );
        res.json(rows);
    } catch { res.status(500).json({ error: 'Failed to load back jobs.' }); }
});

// ══════════════════════════════════════════
//  START SERVER
// ══════════════════════════════════════════
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ QueueTech API running on http://localhost:${PORT}`));