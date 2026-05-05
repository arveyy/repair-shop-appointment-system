// ══════════════════════════════════════════
//  FAKE BACKEND — Mock API
//  Replaces all fetch() calls to localhost:3000
//  Data persists in localStorage
// ══════════════════════════════════════════

export interface MockService {
    id: number;
    service_name: string;
    duration: number;
    price: number;
    category: string | null;
    is_active: number;
}

export interface MockBooking {
    id: number;
    reference_number: string;
    branch_id: number;
    branch_name: string;
    customer_id: number;
    customer_name: string;
    phone: string;
    email: string;
    appointment_date: string;
    appointment_time: string;
    total_price: number;
    special_request: string | null;
    status: string;
    technician_id: number | null;
    technician_name: string | null;
    service_names: string;
    created_at: string;
}

export interface MockQueueItem {
    id: number;
    customer_id: number;
    customer_name: string;
    service: string;
    technician_id: number | null;
    technician_name: string | null;
    branch_id: number;
    queue_number: number;
    status: string;
    booking_id: number | null;
    time: string;
}

export interface MockStaff {
    id: number;
    full_name: string;
    username: string;
    password: string;
    role: string;
    branch_id: number | null;
    branch_name: string | null;
    is_active: number;
}

// ── STORAGE KEYS ──
const KEYS = {
    bookings: 'mock_bookings',
    queue: 'mock_queue',
    staff: 'mock_staff',
    customers: 'mock_customers',
    nextId: 'mock_next_id',
};

// ── HELPERS ──
function getNextId(): number {
    const current = Number(localStorage.getItem(KEYS.nextId) || '100');
    localStorage.setItem(KEYS.nextId, String(current + 1));
    return current;
}

function generateRef(): string {
    const ts = Date.now().toString().slice(-6);
    const rand = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `QT-${ts}${rand}`;
}

function getBookings(): MockBooking[] {
    return JSON.parse(localStorage.getItem(KEYS.bookings) || '[]');
}

function saveBookings(b: MockBooking[]): void {
    localStorage.setItem(KEYS.bookings, JSON.stringify(b));
}

function getQueue(): MockQueueItem[] {
    return JSON.parse(localStorage.getItem(KEYS.queue) || '[]');
}

function saveQueue(q: MockQueueItem[]): void {
    localStorage.setItem(KEYS.queue, JSON.stringify(q));
}

function getStaff(): MockStaff[] {
    const stored = localStorage.getItem(KEYS.staff);
    if (stored) return JSON.parse(stored);
    // Default staff
    const defaults: MockStaff[] = [
        { id: 1, full_name: 'Alber Torrepalma', username: 'admin',    password: 'password', role: 'owner',      branch_id: null, branch_name: null,          is_active: 1 },
        { id: 2, full_name: 'Maria Santos',      username: 'cashier1', password: 'password', role: 'cashier',    branch_id: 1,    branch_name: 'Tisa Location', is_active: 1 },
        { id: 3, full_name: 'Juan Reyes',         username: 'tech1',    password: 'password', role: 'technician', branch_id: 1,    branch_name: 'Tisa Location', is_active: 1 },
        { id: 4, full_name: 'JR',                 username: 'jr',       password: 'password', role: 'technician', branch_id: 1,    branch_name: 'Tisa Location', is_active: 1 },
    ];
    localStorage.setItem(KEYS.staff, JSON.stringify(defaults));
    return defaults;
}

function saveStaff(s: MockStaff[]): void {
    localStorage.setItem(KEYS.staff, JSON.stringify(s));
}

function getCustomers(): any[] {
    return JSON.parse(localStorage.getItem(KEYS.customers) || '[]');
}

function saveCustomers(c: any[]): void {
    localStorage.setItem(KEYS.customers, JSON.stringify(c));
}

function getOrCreateCustomer(data: any): number {
    const customers = getCustomers();
    const existing = customers.find((c: any) => c.email === data.email || c.phone === data.phone);
    if (existing) return existing.id;
    const newCust = { id: getNextId(), ...data };
    customers.push(newCust);
    saveCustomers(customers);
    return newCust.id;
}

function getBranchName(id: number): string {
    return id === 1 ? 'Tisa Location' : 'SM J Mall';
}

function getTechName(id: number | null): string | null {
    if (!id) return null;
    const staff = getStaff();
    return staff.find(s => s.id === id)?.full_name || null;
}

function formatTime(): string {
    return new Date().toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
}

// ══════════════════════════════════════════
//  MOCK API FUNCTIONS
// ══════════════════════════════════════════

// GET /api/services
export function mockGetServices(): MockService[] {
    return SERVICES;
}

// GET /api/branches
export function mockGetBranches(): any[] {
    return [
        { id: 1, name: 'Tisa Location', address: '127 Francisco Llamas St, Cebu City', is_active: 1 },
        { id: 2, name: 'SM J Mall', address: '3rd Floor Cyber Zone BSD International, SM J Mall, Mandaue', is_active: 1 },
    ];
}

// GET /api/bookings/slots
export function mockGetSlots(branchId: number, date: string): string[] {
    const bookings = getBookings();
    return bookings
        .filter(b => b.branch_id === branchId && b.appointment_date === date && b.status !== 'cancelled')
        .map(b => b.appointment_time);
}

// POST /api/bookings
export function mockCreateBooking(payload: any): { success: boolean; reference_number: string; booking_id: number } {
    const { branch_id, appointment_date, appointment_time, customer, services } = payload;

    // Check double booking
    const booked = mockGetSlots(branch_id, appointment_date);
    if (booked.includes(appointment_time)) {
        throw new Error('This time slot is already booked.');
    }

    const customerId = getOrCreateCustomer(customer);
    const totalPrice = services.reduce((sum: number, s: any) => sum + (s.price * s.quantity), 0);
    const ref = generateRef();
    const id = getNextId();

    const serviceNames = services
        .map((s: any) => s.custom_name || s.service_name || 'Custom Service')
        .join(', ');

    const booking: MockBooking = {
        id,
        reference_number: ref,
        branch_id,
        branch_name: getBranchName(branch_id),
        customer_id: customerId,
        customer_name: customer.full_name,
        phone: customer.phone,
        email: customer.email,
        appointment_date,
        appointment_time,
        total_price: totalPrice,
        special_request: customer.special_request || null,
        status: 'confirmed',
        technician_id: null,
        technician_name: null,
        service_names: serviceNames,
        created_at: new Date().toISOString(),
    };

    const bookings = getBookings();
    bookings.push(booking);
    saveBookings(bookings);

    return { success: true, reference_number: ref, booking_id: id };
}

// GET /api/bookings/:ref
export function mockGetBookingByRef(ref: string): MockBooking | null {
    const bookings = getBookings();
    return bookings.find(b => b.reference_number === ref) || null;
}

// ── ADMIN ──

// POST /api/admin/login
export function mockAdminLogin(username: string, password: string): { token: string; user: any } | null {
    const staff = getStaff();
    const found = staff.find(s => s.username === username && s.password === password && s.is_active === 1);
    if (!found) return null;
    const token = btoa(JSON.stringify({ id: found.id, role: found.role, exp: Date.now() + 8 * 60 * 60 * 1000 }));
    return {
        token,
        user: { id: found.id, name: found.full_name, username: found.username, role: found.role, branch_id: found.branch_id }
    };
}

// GET /api/admin/dashboard
export function mockGetDashboard(): any {
    const bookings = getBookings();
    const today = new Date().toISOString().split('T')[0];

    const todayBookings = bookings.filter(b => b.created_at.startsWith(today) && b.status !== 'cancelled');
    const todaySales = todayBookings.reduce((sum, b) => sum + b.total_price, 0);

    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekBookings = bookings.filter(b => new Date(b.created_at) >= weekStart && b.status !== 'cancelled');
    const weekSales = weekBookings.reduce((sum, b) => sum + b.total_price, 0);

    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const monthBookings = bookings.filter(b => new Date(b.created_at) >= monthStart && b.status !== 'cancelled');
    const monthSales = monthBookings.reduce((sum, b) => sum + b.total_price, 0);

    const recent = [...bookings].reverse().slice(0, 10).map(b => ({
        reference_number: b.reference_number,
        time: new Date(b.created_at).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }),
        customer_name: b.customer_name,
        payment_method: 'Cash',
        status: b.status,
        total_price: b.total_price,
    }));

    return {
        today_sales: todaySales,
        transactions: todayBookings.length,
        week_sales: weekSales,
        month_sales: monthSales,
        recent_transactions: recent,
    };
}

// GET /api/admin/appointments
export function mockGetAppointments(): any[] {
    return [...getBookings()].reverse().map(b => ({
        id: b.id,
        reference_number: b.reference_number,
        customer_name: b.customer_name,
        service_names: b.service_names,
        branch_name: b.branch_name,
        appointment_date: b.appointment_date,
        appointment_time: b.appointment_time,
        technician_name: b.technician_name || 'Unassigned',
        status: b.status,
    }));
}

// PATCH /api/admin/appointments/:id/status
export function mockUpdateApptStatus(id: number, status: string): void {
    const bookings = getBookings();
    const idx = bookings.findIndex(b => b.id === id);
    if (idx >= 0) {
        bookings[idx].status = status;
        saveBookings(bookings);
    }
}

// POST /api/admin/appointments/:id/assign
export function mockAssignAppointment(id: number, technicianId: number): void {
    const bookings = getBookings();
    const idx = bookings.findIndex(b => b.id === id);
    if (idx < 0) return;

    const techName = getTechName(technicianId);
    bookings[idx].technician_id = technicianId;
    bookings[idx].technician_name = techName;
    bookings[idx].status = 'confirmed';
    saveBookings(bookings);

    // Add to queue
    const queue = getQueue();
    const today = new Date().toISOString().split('T')[0];
    const existing = queue.find(q => q.booking_id === id);

    if (!existing) {
        const todayQueue = queue.filter(q => q.branch_id === bookings[idx].branch_id);
        const nextNum = todayQueue.length + 1;

        queue.push({
            id: getNextId(),
            customer_id: bookings[idx].customer_id,
            customer_name: bookings[idx].customer_name,
            service: bookings[idx].service_names,
            technician_id: technicianId,
            technician_name: techName,
            branch_id: bookings[idx].branch_id,
            queue_number: nextNum,
            status: 'waiting',
            booking_id: id,
            time: new Date(bookings[idx].appointment_date).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }),
        });
        saveQueue(queue);
    } else {
        const qIdx = queue.findIndex(q => q.booking_id === id);
        queue[qIdx].technician_id = technicianId;
        queue[qIdx].technician_name = techName;
        saveQueue(queue);
    }
}

// GET /api/admin/queue
export function mockGetQueue(filters: { technician_id?: number; branch_id?: number } = {}): MockQueueItem[] {
    let queue = getQueue();
    if (filters.technician_id) {
        queue = queue.filter(q => q.technician_id === filters.technician_id);
    }
    if (filters.branch_id) {
        queue = queue.filter(q => q.branch_id === filters.branch_id);
    }
    return queue;
}

// POST /api/admin/queue
export function mockAddToQueue(data: any): { id: number; queue_number: number } {
    const queue = getQueue();
    const customers = getCustomers();

    let customerId: number;
    const existing = customers.find((c: any) => c.phone === data.phone);
    if (existing) {
        customerId = existing.id;
    } else {
        customerId = getNextId();
        customers.push({ id: customerId, full_name: data.customer_name, phone: data.phone });
        saveCustomers(customers);
    }

    const branchQueue = queue.filter(q => q.branch_id === Number(data.branch_id));
    const nextNum = branchQueue.length + 1;
    const id = getNextId();
    const techName = data.technician_id ? getTechName(Number(data.technician_id)) : null;

    const item: MockQueueItem = {
        id,
        customer_id: customerId,
        customer_name: data.customer_name,
        service: data.service,
        technician_id: data.technician_id ? Number(data.technician_id) : null,
        technician_name: techName,
        branch_id: Number(data.branch_id),
        queue_number: nextNum,
        status: 'waiting',
        booking_id: null,
        time: formatTime(),
    };

    queue.push(item);
    saveQueue(queue);
    return { id, queue_number: nextNum };
}

// POST /api/admin/queue/:id/advance
export function mockAdvanceQueue(id: number): { status: string } {
    const queue = getQueue();
    const idx = queue.findIndex(q => q.id === id);
    if (idx < 0) throw new Error('Not found');
    const next = queue[idx].status === 'waiting' ? 'in_progress' : 'done';
    queue[idx].status = next;
    saveQueue(queue);
    return { status: next };
}

// POST /api/admin/queue/:id/assign
export function mockAssignQueue(id: number, technicianId: number): void {
    const queue = getQueue();
    const idx = queue.findIndex(q => q.id === id);
    if (idx >= 0) {
        queue[idx].technician_id = technicianId;
        queue[idx].technician_name = getTechName(technicianId);
        saveQueue(queue);
    }
}

// GET /api/admin/staff
export function mockGetStaff(roleFilter?: string): any[] {
    let staff = getStaff();
    if (roleFilter) staff = staff.filter(s => s.role === roleFilter);
    return staff.filter(s => s.is_active === 1);
}

// POST /api/admin/staff
export function mockAddStaff(data: any): { id: number } {
    const staff = getStaff();
    const id = getNextId();
    staff.push({ id, ...data, is_active: 1, branch_name: data.branch_id ? getBranchName(Number(data.branch_id)) : null });
    saveStaff(staff);
    return { id };
}

// DELETE /api/admin/staff/:id
export function mockRemoveStaff(id: number): void {
    const staff = getStaff();
    const idx = staff.findIndex(s => s.id === id);
    if (idx >= 0) { staff[idx].is_active = 0; saveStaff(staff); }
}

// GET /api/admin/customers
export function mockGetCustomers(): any[] {
    const customers = getCustomers();
    const bookings = getBookings();
    return customers.map(c => ({
        ...c,
        total_visits: bookings.filter(b => b.customer_id === c.id).length,
        last_visit: bookings.filter(b => b.customer_id === c.id).slice(-1)[0]?.appointment_date || '—',
    }));
}

// POST /api/admin/customers
export function mockAddCustomer(data: any): { id: number } {
    const id = getNextId();
    const customers = getCustomers();
    customers.push({ id, ...data });
    saveCustomers(customers);
    return { id };
}

// GET /api/admin/services
export function mockGetAdminServices(): MockService[] {
    return SERVICES;
}

// POST /api/admin/services
export function mockAddService(data: any): { id: number } {
    const id = getNextId();
    SERVICES.push({ id, ...data, is_active: 1, category: data.category || null });
    return { id };
}

// DELETE /api/admin/services/:id
export function mockDeleteService(id: number): void {
    const idx = SERVICES.findIndex(s => s.id === id);
    if (idx >= 0) SERVICES[idx].is_active = 0;
}

// GET /api/admin/sales
export function mockGetSales(): any[] {
    return [...getBookings()].reverse().map(b => ({
        reference_number: b.reference_number,
        customer_name: b.customer_name,
        payment_method: 'Cash',
        created_at: new Date(b.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }),
        status: b.status,
        total_price: b.total_price,
    }));
}

// GET /api/admin/commissions
export function mockGetCommissions(technicianId?: number): any[] {
    return [];
}

// GET /api/admin/backjobs
export function mockGetBackJobs(technicianId?: number): any[] {
    return [];
}

// ══════════════════════════════════════════
//  SERVICES DATA
// ══════════════════════════════════════════
const SERVICES: MockService[] = [
    { id: 1,  service_name: 'Acer Swift 3 Laptop RE-INSTALL',     duration: 60,  price: 1200, category: 'Laptop',  is_active: 1 },
    { id: 2,  service_name: 'Android Button',                       duration: 60,  price: 700,  category: 'Android', is_active: 1 },
    { id: 3,  service_name: 'Android Glue',                         duration: 60,  price: 200,  category: 'Android', is_active: 1 },
    { id: 4,  service_name: 'Android Micro Charging Pin',           duration: 60,  price: 700,  category: 'Android', is_active: 1 },
    { id: 5,  service_name: 'Android Service',                      duration: 60,  price: 500,  category: 'Android', is_active: 1 },
    { id: 6,  service_name: 'Android Service Glue Only',            duration: 60,  price: 200,  category: 'Android', is_active: 1 },
    { id: 7,  service_name: 'Android/Apple Check up',               duration: 60,  price: 0,    category: 'General', is_active: 1 },
    { id: 8,  service_name: 'Asus Laptop Restart / Deep Clean',     duration: 60,  price: 2000, category: 'Laptop',  is_active: 1 },
    { id: 9,  service_name: 'Battery Fuse',                         duration: 60,  price: 700,  category: 'General', is_active: 1 },
    { id: 10, service_name: 'Charging Port Type-C',                 duration: 60,  price: 1200, category: 'General', is_active: 1 },
    { id: 11, service_name: 'Dell Inspiro P143G LCD',               duration: 60,  price: 5900, category: 'Laptop',  is_active: 1 },
    { id: 12, service_name: 'Dell Laptop P89F Hinges',              duration: 60,  price: 4000, category: 'Laptop',  is_active: 1 },
    { id: 13, service_name: 'HP Laptop 250 G7 LCD',                 duration: 60,  price: 5900, category: 'Laptop',  is_active: 1 },
    { id: 14, service_name: 'HP Laptop OS Install',                 duration: 60,  price: 1500, category: 'Laptop',  is_active: 1 },
    { id: 15, service_name: 'Huawei Laptop C-PIN Replace',          duration: 60,  price: 3500, category: 'Laptop',  is_active: 1 },
    { id: 16, service_name: 'Huawei Y9 LCD',                        duration: 60,  price: 1500, category: 'Android', is_active: 1 },
    { id: 17, service_name: 'Huawei Nova 5 Battery',                duration: 60,  price: 1750, category: 'Android', is_active: 1 },
    { id: 18, service_name: 'Huawei MatePad Battery + Button',      duration: 60,  price: 3400, category: 'Android', is_active: 1 },
    { id: 19, service_name: 'Infinix Hot 50 Pro LCD',               duration: 60,  price: 1850, category: 'Android', is_active: 1 },
    { id: 20, service_name: 'Infinix Note 10 Pro Charging Pin',     duration: 60,  price: 1200, category: 'Android', is_active: 1 },
    { id: 21, service_name: 'Infinix Note 30 5G CPU Issue',         duration: 60,  price: 4000, category: 'Android', is_active: 1 },
    { id: 22, service_name: 'Infinix Smart 10 LCD',                 duration: 60,  price: 1600, category: 'Android', is_active: 1 },
    { id: 23, service_name: 'Infinix Smart 8 LCD',                  duration: 180, price: 1500, category: 'Android', is_active: 1 },
    { id: 24, service_name: 'iPad 6th Gen iCloud Bypass',           duration: 60,  price: 2000, category: 'Apple',   is_active: 1 },
    { id: 25, service_name: 'iPad A228 Motherboard',                duration: 60,  price: 6500, category: 'Apple',   is_active: 1 },
    { id: 26, service_name: 'iPhone 11 Back Camera Repair',         duration: 60,  price: 1500, category: 'Apple',   is_active: 1 },
    { id: 27, service_name: 'iPhone 11 Back Camera Replace',        duration: 60,  price: 4450, category: 'Apple',   is_active: 1 },
    { id: 28, service_name: 'iPhone 11 Battery',                    duration: 60,  price: 2500, category: 'Apple',   is_active: 1 },
    { id: 29, service_name: 'iPhone 11 LCD OLED',                   duration: 60,  price: 4450, category: 'Apple',   is_active: 1 },
    { id: 30, service_name: 'iPhone 12 Battery',                    duration: 60,  price: 2950, category: 'Apple',   is_active: 1 },
    { id: 31, service_name: 'iPhone 12 LCD',                        duration: 60,  price: 4900, category: 'Apple',   is_active: 1 },
    { id: 32, service_name: 'iPhone 13 Battery',                    duration: 60,  price: 4950, category: 'Apple',   is_active: 1 },
    { id: 33, service_name: 'iPhone 13 LCD',                        duration: 60,  price: 6800, category: 'Apple',   is_active: 1 },
    { id: 34, service_name: 'iPhone 14 Battery',                    duration: 60,  price: 4950, category: 'Apple',   is_active: 1 },
    { id: 35, service_name: 'iPhone 14 LCD',                        duration: 60,  price: 6950, category: 'Apple',   is_active: 1 },
    { id: 36, service_name: 'Samsung A30s LCD',                     duration: 60,  price: 1500, category: 'Android', is_active: 1 },
    { id: 37, service_name: 'Samsung Note 9 Battery',               duration: 60,  price: 1500, category: 'Android', is_active: 1 },
    { id: 38, service_name: 'Redmi Note 12 Charging Pin',           duration: 60,  price: 1200, category: 'Android', is_active: 1 },
    { id: 39, service_name: 'Tecno Spark Bootloop Restart',         duration: 60,  price: 1000, category: 'Android', is_active: 1 },
    { id: 40, service_name: 'Vivo Y21 Charging Pin',                duration: 60,  price: 800,  category: 'Android', is_active: 1 },
    { id: 41, service_name: 'Xiaomi Poco F5 Battery',               duration: 60,  price: 1850, category: 'Android', is_active: 1 },
    { id: 42, service_name: 'ZTE Nubia V60 LCD',                    duration: 60,  price: 1500, category: 'Android', is_active: 1 },
];