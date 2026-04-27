// ══════════════════════════════════════════
//  QueueTech Admin — Full TypeScript Logic
// ══════════════════════════════════════════
export {};
const API = 'http://localhost:3000/api';

// ── TYPES ──
type Role = 'owner' | 'cashier' | 'technician';

interface AdminUser {
    id: number;
    name: string;
    username: string;
    role: Role;
    branch_id: number | null;
}

interface NavItem {
    page: string;
    icon: string;
    label: string;
    roles: Role[];
    group?: string;
}

// ── NAV CONFIG ──
const NAV_ITEMS: NavItem[] = [
    // No group — Overview
    { page: 'dashboard',    icon: '⊞', label: 'Overview',         roles: ['owner','cashier','technician'] },
    { page: 'analytics',    icon: '↗', label: 'Analytics',        roles: ['owner'] },
    // Operations
    { page: 'queue',        icon: '≡', label: 'Queue',            roles: ['owner','cashier'], group: 'Operations' },
    { page: 'myqueue',      icon: '≡', label: 'My Queue',         roles: ['technician'],      group: 'Operations' },
    { page: 'appointments', icon: '▦', label: 'Appointments',     roles: ['owner','cashier'], group: 'Operations' },
    { page: 'sales',        icon: '₱', label: 'Sales',            roles: ['owner','cashier'], group: 'Operations' },
    // My Stuff
    { page: 'commissions',  icon: '◎', label: 'Commissions',      roles: ['owner','technician'], group: 'My Stuff' },
    { page: 'backjobs',     icon: '↺', label: 'Back Jobs',        roles: ['owner','technician'], group: 'My Stuff' },
    // Catalog
    { page: 'services',     icon: '✦', label: 'Services',         roles: ['owner'], group: 'Catalog' },
    { page: 'categories',   icon: '⊟', label: 'Categories',       roles: ['owner'], group: 'Catalog' },
    { page: 'supplies',     icon: '◈', label: 'Supplies',         roles: ['owner'], group: 'Catalog' },
    // People
    { page: 'staff',        icon: '◉', label: 'Staff',            roles: ['owner'], group: 'People' },
    { page: 'customers',    icon: '◍', label: 'Customers',        roles: ['owner','cashier'], group: 'People' },
    { page: 'loyalty',      icon: '♦', label: 'Loyalty Programs', roles: ['owner'], group: 'People' },
];

const PAGE_META: Record<string, { title: string; icon: string }> = {
    dashboard:    { title: 'Dashboard',         icon: '⊞' },
    analytics:    { title: 'Analytics',         icon: '↗' },
    queue:        { title: 'Queue',             icon: '≡' },
    myqueue:      { title: 'My Queue',          icon: '≡' },
    appointments: { title: 'Appointments',      icon: '▦' },
    sales:        { title: 'Sales',             icon: '₱' },
    commissions:  { title: 'Commissions',       icon: '◎' },
    backjobs:     { title: 'Back Jobs',         icon: '↺' },
    services:     { title: 'Services',          icon: '✦' },
    categories:   { title: 'Categories',        icon: '⊟' },
    supplies:     { title: 'Supplies',          icon: '◈' },
    staff:        { title: 'Staff',             icon: '◉' },
    customers:    { title: 'Customers',         icon: '◍' },
    loyalty:      { title: 'Loyalty Programs',  icon: '♦' },
    pos:          { title: 'Open POS',          icon: '⊟' },
};

// ── STATE ──
let currentUser: AdminUser | null = null;
let currentPage: string = 'dashboard';
let isDark: boolean = false;

// ── INIT ──
document.addEventListener('DOMContentLoaded', () => {
    loadSession();
    initTheme();
    initSidebarToggle();
    initModals();
    initThemeToggle();
    initLogout();
    initSearch();
});

// ── SESSION ──
function loadSession(): void {
    const raw = sessionStorage.getItem('adminUser') || localStorage.getItem('adminUser');
    if (!raw) {
        window.location.href = 'admin-login.html';
        return;
    }
    try {
        const parsed = JSON.parse(raw);
        // Handle both {user: {...}} and direct user object
        currentUser = parsed.user || parsed;
        if (!currentUser || !currentUser.role) {
            window.location.href = 'admin-login.html';
            return;
        }
        applyRole(currentUser.role);
        renderSidebar(currentUser.role);
        updateUserInfo(currentUser);
        navigateTo('dashboard');
    } catch {
        window.location.href = 'admin-login.html';
    }
}

function applyRole(role: Role): void {
    document.body.classList.remove('role-owner', 'role-cashier', 'role-technician');
    document.body.classList.add(`role-${role}`);
}

// ── SIDEBAR RENDER ──
function renderSidebar(role: Role): void {
    const nav = document.getElementById('sidebarNav')!;
    let html = '';
    let lastGroup = '';

    NAV_ITEMS.forEach(item => {
        if (!item.roles.includes(role)) return;

        if (item.group && item.group !== lastGroup) {
            html += `<div class="nav-group-label">${item.group}</div>`;
            lastGroup = item.group;
        } else if (!item.group && lastGroup !== '') {
            lastGroup = '';
        }

        html += `
            <div class="nav-item" data-page="${item.page}" onclick="navigateTo('${item.page}')">
                <span class="nav-icon">${item.icon}</span>
                ${item.label}
            </div>`;
    });

    nav.innerHTML = html;
}

// ── USER INFO ──
function updateUserInfo(user: AdminUser): void {
    const initials = user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
    const roleLabel: Record<Role, string> = { owner: 'Super Admin', cashier: 'Cashier', technician: 'Technician' };

    const avatarEl = document.getElementById('userAvatar');
    const nameEl = document.getElementById('userName');
    const roleEl = document.getElementById('userRoleBadge');

    if (avatarEl) avatarEl.textContent = initials;
    if (nameEl) nameEl.textContent = user.name;
    if (roleEl) roleEl.textContent = roleLabel[user.role];
}

// ── NAVIGATION ──
function navigateTo(page: string): void {
    if (!currentUser) return;

    const meta = NAV_ITEMS.find(n => n.page === page);
    if (meta && !meta.roles.includes(currentUser.role)) {
        showToast('Access denied.', 'error');
        return;
    }

    // Hide all pages
    document.querySelectorAll<HTMLElement>('.page').forEach(p => p.classList.remove('active'));

    // Show target page
    const target = document.getElementById(`page-${page}`);
    if (target) target.classList.add('active');

    // Update nav
    document.querySelectorAll<HTMLElement>('.nav-item').forEach(n => {
        n.classList.toggle('active', n.dataset.page === page);
    });

    // Update topbar
    const pageMeta = PAGE_META[page];
    if (pageMeta) {
        const titleEl = document.getElementById('topbarTitle');
        const iconEl = document.getElementById('topbarIcon');
        if (titleEl) titleEl.textContent = pageMeta.title;
        if (iconEl) iconEl.textContent = pageMeta.icon;
    }

    currentPage = page;

    // Load page data
    loadPageData(page);

    // Mobile: close sidebar
    if (window.innerWidth <= 768) {
        const sidebar = document.getElementById('sidebar');
        sidebar?.classList.remove('open');
    }
}

// Make navigateTo globally accessible (called from onclick in HTML)
(window as any).navigateTo = navigateTo;

// ── LOAD PAGE DATA ──
async function loadPageData(page: string): Promise<void> {
    switch (page) {
        case 'dashboard': await loadDashboard(); break;
        case 'queue': await loadQueue(); break;
        case 'myqueue': await loadMyQueue(); break;
        case 'appointments': await loadAppointments(); break;
        case 'sales': await loadSales(); break;
        case 'services': await loadServices(); break;
        case 'staff': await loadStaff(); break;
        case 'customers': await loadCustomers(); break;
        case 'commissions': await loadCommissions(); break;
        case 'backjobs': await loadBackJobs(); break;
    }
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T | null> {
    try {
        const raw = sessionStorage.getItem('adminUser') || localStorage.getItem('adminUser');
        const parsed = raw ? JSON.parse(raw) : null;
        const token = parsed?.token || parsed?.user?.token;

        const res = await fetch(`${API}${path}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
                ...options?.headers,
            },
        });
        if (!res.ok) throw new Error(await res.text());
        return await res.json() as T;
    } catch (err) {
        console.warn(`API error [${path}]:`, err);
        return null;
    }
}

// ── DASHBOARD ──
async function loadDashboard(): Promise<void> {
    const data = await apiFetch<any>('/admin/dashboard');
    if (!data) return;

    const todaySales = document.getElementById('statTodaySales');
    const transactions = document.getElementById('statTransactions');
    const week = document.getElementById('statWeek');
    const month = document.getElementById('statMonth');

    if (todaySales) todaySales.textContent = formatPeso(data.today_sales ?? 0);
    if (transactions) transactions.textContent = data.transactions ?? '0';
    if (week) week.textContent = formatPeso(data.week_sales ?? 0);
    if (month) month.textContent = formatPeso(data.month_sales ?? 0);

    const body = document.getElementById('recentTxnBody');
    if (body && data.recent_transactions?.length) {
        body.innerHTML = data.recent_transactions.map((t: any) => `
            <tr>
                <td style="font-family:'JetBrains Mono',monospace;font-size:13px;color:var(--accent-dark)">${t.reference_number}</td>
                <td>${t.time}</td>
                <td>${t.customer_name}</td>
                <td>${t.payment_method || '—'}</td>
                <td>${badge(t.status)}</td>
                <td style="font-weight:700;color:var(--accent-dark)">${formatPeso(t.total_price)}</td>
            </tr>`).join('');
    }
}

// ── QUEUE ──
async function loadQueue(): Promise<void> {
    const data = await apiFetch<any[]>('/admin/queue');
    renderQueueColumns(data || [], currentUser?.role);
}

function renderQueueColumns(items: any[], role?: Role): void {
    const waiting = items.filter(i => i.status === 'waiting');
    const inProgress = items.filter(i => i.status === 'in_progress');
    const done = items.filter(i => i.status === 'done');

    renderQueueCol('queueWaiting', waiting, role);
    renderQueueCol('queueInProgress', inProgress, role);
    renderQueueCol('queueDone', done, role);
}

function renderQueueCol(elId: string, items: any[], role?: Role): void {
    const el = document.getElementById(elId);
    if (!el) return;
    if (!items.length) {
        el.innerHTML = '<div class="empty-col">Empty</div>';
        return;
    }
    el.innerHTML = items.map(item => `
        <div class="queue-card">
            <div class="queue-card-num">#${String(item.queue_number).padStart(3,'0')}</div>
            <div class="queue-card-name">${item.customer_name}</div>
            <div class="queue-card-service">${item.service || item.device || '—'}</div>
            <div class="queue-card-footer">
                <span class="queue-card-time">${item.time || ''}</span>
                <div class="queue-card-actions">
                    ${role === 'cashier' || role === 'owner' ? `
                        <button class="action-btn primary" onclick="openAssignModal(${item.id})">Assign</button>
                        <button class="action-btn" onclick="advanceQueue(${item.id})">${item.status === 'waiting' ? '▶ Start' : '✓ Done'}</button>
                    ` : ''}
                </div>
            </div>
            ${item.technician_name ? `<div style="font-size:11px;color:var(--text-3);margin-top:4px;">👨‍🔧 ${item.technician_name}</div>` : ''}
        </div>`).join('');
}

async function advanceQueue(id: number): Promise<void> {
    const res = await apiFetch(`/admin/queue/${id}/advance`, { method: 'POST' });
    if (res) { showToast('Queue updated!', 'success'); loadQueue(); }
    else showToast('Failed to update queue.', 'error');
}

(window as any).advanceQueue = advanceQueue;

function openAssignModal(queueId: number): void {
    const input = document.getElementById('assignQueueId') as HTMLInputElement;
    if (input) input.value = String(queueId);
    loadTechnicianOptions('assignTechSelect');
    openModal('assignModal');
}

(window as any).openAssignModal = openAssignModal;

// ── MY QUEUE (Technician) ──
async function loadMyQueue(): Promise<void> {
    if (!currentUser) return;
    const data = await apiFetch<any[]>(`/admin/queue?technician_id=${currentUser.id}`);
    const items = data || [];

    const assigned = items.filter(i => i.status === 'waiting');
    const inProg = items.filter(i => i.status === 'in_progress');
    const done = items.filter(i => i.status === 'done');

    renderQueueCol('myQueueAssigned', assigned, 'technician');
    renderQueueCol('myQueueInProgress', inProg, 'technician');
    renderQueueCol('myQueueDone', done, 'technician');
}

// ── APPOINTMENTS ──
async function loadAppointments(): Promise<void> {
    const data = await apiFetch<any[]>('/admin/appointments');
    const body = document.getElementById('apptBody');
    if (!body) return;
    if (!data?.length) {
        body.innerHTML = '<tr class="empty-row"><td colspan="8"><div class="empty-state"><span class="empty-icon">▦</span><span>No appointments yet</span></div></td></tr>';
        return;
    }
    body.innerHTML = data.map(a => `
        <tr>
            <td style="font-family:'JetBrains Mono',monospace;font-size:13px;color:var(--accent-dark)">${a.reference_number}</td>
            <td>${a.customer_name}</td>
            <td>${a.service_names || '—'}</td>
            <td>${a.branch_name}</td>
            <td>${a.appointment_date}<br><small style="color:var(--text-3)">${a.appointment_time}</small></td>
            <td>${a.technician_name || '<span style="color:var(--text-3)">Unassigned</span>'}</td>
            <td>${badge(a.status)}</td>
            <td class="role-cashier role-owner"><div class="action-btns">
                <button class="action-btn primary" onclick="assignAppt(${a.id})">Assign</button>
                <button class="action-btn" onclick="updateApptStatus(${a.id},'confirmed')">Confirm</button>
                <button class="action-btn danger" onclick="updateApptStatus(${a.id},'cancelled')">Cancel</button>
            </div></td>
        </tr>`).join('');
}

async function updateApptStatus(id: number, status: string): Promise<void> {
    const res = await apiFetch(`/admin/appointments/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
    });
    if (res) { showToast(`Appointment ${status}.`, 'success'); loadAppointments(); }
    else showToast('Failed to update.', 'error');
}

async function assignAppt(id: number): Promise<void> {
    const input = document.getElementById('assignQueueId') as HTMLInputElement;
    if (input) input.value = String(id);
    loadTechnicianOptions('assignTechSelect');
    openModal('assignModal');
}

(window as any).assignAppt = assignAppt;
(window as any).updateApptStatus = updateApptStatus;

// ── SALES ──
async function loadSales(): Promise<void> {
    const data = await apiFetch<any[]>('/admin/sales');
    const body = document.getElementById('salesBody');
    if (!body) return;
    if (!data?.length) {
        body.innerHTML = '<tr class="empty-row"><td colspan="6"><div class="empty-state"><span class="empty-icon">₱</span><span>No sales yet</span></div></td></tr>';
        return;
    }
    body.innerHTML = data.map(s => `
        <tr>
            <td style="font-family:'JetBrains Mono',monospace;font-size:13px;color:var(--accent-dark)">${s.reference_number}</td>
            <td>${s.customer_name}</td>
            <td>${s.payment_method || '—'}</td>
            <td>${s.created_at}</td>
            <td>${badge(s.status)}</td>
            <td style="font-weight:700;color:var(--accent-dark)">${formatPeso(s.total_price)}</td>
        </tr>`).join('');
}

// ── SERVICES ──
async function loadServices(): Promise<void> {
    const data = await apiFetch<any[]>('/admin/services');
    const body = document.getElementById('servicesBody');
    if (!body) return;
    if (!data?.length) {
        body.innerHTML = '<tr class="empty-row"><td colspan="6"><div class="empty-state"><span class="empty-icon">✦</span><span>No services added yet</span></div></td></tr>';
        return;
    }
    body.innerHTML = data.map(s => `
        <tr>
            <td style="font-weight:600">${s.service_name}</td>
            <td>${s.category || '—'}</td>
            <td>${s.duration} min</td>
            <td style="font-weight:700;color:var(--accent-dark)">${s.price === 0 ? 'FREE' : formatPeso(s.price)}</td>
            <td>${badge(s.is_active ? 'confirmed' : 'cancelled')}</td>
            <td><div class="action-btns">
                <button class="action-btn primary" onclick="editService(${s.id})">Edit</button>
                <button class="action-btn danger" onclick="deleteService(${s.id})">Delete</button>
            </div></td>
        </tr>`).join('');
}

async function deleteService(id: number): Promise<void> {
    if (!confirm('Delete this service?')) return;
    const res = await apiFetch(`/admin/services/${id}`, { method: 'DELETE' });
    if (res) { showToast('Service deleted.', 'success'); loadServices(); }
    else showToast('Failed to delete.', 'error');
}

function editService(id: number): void {
    showToast('Edit functionality — connect to backend.', 'success');
}

(window as any).editService = editService;
(window as any).deleteService = deleteService;

// ── STAFF ──
async function loadStaff(): Promise<void> {
    const data = await apiFetch<any[]>('/admin/staff');
    const grid = document.getElementById('staffGrid');
    if (!grid) return;
    if (!data?.length) {
        grid.innerHTML = '<div class="empty-page"><span class="ep-icon">◉</span><span class="ep-title">No staff yet</span><span class="ep-sub">Add your first staff member.</span></div>';
        return;
    }
    const roleLabel: Record<string,string> = { owner: 'Super Admin', cashier: 'Cashier', technician: 'Technician' };
    grid.innerHTML = data.map(s => {
        const initials = s.full_name.split(' ').map((n:string)=>n[0]).join('').slice(0,2).toUpperCase();
        return `
        <div class="staff-card">
            <div class="staff-avatar-lg">${initials}</div>
            <span class="staff-card-name">${s.full_name}</span>
            <span class="staff-card-role">${roleLabel[s.role] || s.role}</span>
            <span class="staff-card-branch">${s.branch_name || 'Both Branches'}</span>
            ${badge(s.is_active ? 'confirmed' : 'cancelled')}
            <div class="staff-card-actions">
                <button class="action-btn danger" onclick="removeStaff(${s.id})">Remove</button>
            </div>
        </div>`;
    }).join('');
}

async function removeStaff(id: number): Promise<void> {
    if (!confirm('Remove this staff member?')) return;
    const res = await apiFetch(`/admin/staff/${id}`, { method: 'DELETE' });
    if (res) { showToast('Staff removed.', 'success'); loadStaff(); }
    else showToast('Failed to remove.', 'error');
}

(window as any).removeStaff = removeStaff;

// ── CUSTOMERS ──
async function loadCustomers(): Promise<void> {
    const data = await apiFetch<any[]>('/admin/customers');
    const body = document.getElementById('customersBody');
    if (!body) return;
    if (!data?.length) {
        body.innerHTML = '<tr class="empty-row"><td colspan="6"><div class="empty-state"><span class="empty-icon">◍</span><span>No customers yet</span></div></td></tr>';
        return;
    }
    body.innerHTML = data.map(c => `
        <tr>
            <td style="font-weight:600">${c.full_name}</td>
            <td>${c.phone || '—'}</td>
            <td>${c.email || '—'}</td>
            <td>${c.total_visits ?? 0}</td>
            <td>${c.last_visit || '—'}</td>
            <td><div class="action-btns">
                <button class="action-btn primary" onclick="viewCustomer(${c.id})">View</button>
            </div></td>
        </tr>`).join('');
}

function viewCustomer(id: number): void {
    showToast(`View customer #${id} — connect to backend.`);
}

(window as any).viewCustomer = viewCustomer;

// ── COMMISSIONS ──
async function loadCommissions(): Promise<void> {
    const url = currentUser?.role === 'technician'
        ? `/admin/commissions?technician_id=${currentUser.id}`
        : '/admin/commissions';
    const data = await apiFetch<any[]>(url);
    const body = document.getElementById('commissionsBody');
    if (!body) return;
    if (!data?.length) {
        body.innerHTML = '<tr class="empty-row"><td colspan="5"><div class="empty-state"><span class="empty-icon">◎</span><span>No commissions yet</span></div></td></tr>';
        return;
    }
    body.innerHTML = data.map(c => `
        <tr>
            <td>${c.technician_name}</td>
            <td>${c.service_name}</td>
            <td>${c.created_at}</td>
            <td style="font-weight:700;color:var(--accent-dark)">${formatPeso(c.amount)}</td>
            <td>${badge(c.status || 'pending')}</td>
        </tr>`).join('');
}

// ── BACK JOBS ──
async function loadBackJobs(): Promise<void> {
    const url = currentUser?.role === 'technician'
        ? `/admin/backjobs?technician_id=${currentUser.id}`
        : '/admin/backjobs';
    const data = await apiFetch<any[]>(url);
    const body = document.getElementById('backJobsBody');
    if (!body) return;
    if (!data?.length) {
        body.innerHTML = '<tr class="empty-row"><td colspan="6"><div class="empty-state"><span class="empty-icon">↺</span><span>No back jobs</span></div></td></tr>';
        return;
    }
    body.innerHTML = data.map(j => `
        <tr>
            <td style="font-family:'JetBrains Mono',monospace;font-size:13px;color:var(--accent-dark)">${j.reference_number}</td>
            <td>${j.customer_name}</td>
            <td>${j.device || '—'}</td>
            <td>${j.issue || '—'}</td>
            <td>${j.technician_name || '<span style="color:var(--text-3)">Unassigned</span>'}</td>
            <td>${badge(j.status)}</td>
        </tr>`).join('');
}

// ── TECHNICIAN OPTIONS ──
async function loadTechnicianOptions(selectId: string): Promise<void> {
    const select = document.getElementById(selectId) as HTMLSelectElement;
    if (!select) return;
    const data = await apiFetch<any[]>('/admin/staff?role=technician');
    if (!data) return;
    const opts = data.map(t => `<option value="${t.id}">${t.full_name}</option>`).join('');
    select.innerHTML = `<option value="">— Select Technician —</option>${opts}`;
}

// ── MODALS ──
function openModal(id: string): void {
    document.getElementById(id)?.classList.add('open');
}

function closeModal(id: string): void {
    document.getElementById(id)?.classList.remove('open');
}

function initModals(): void {
    // Close on overlay click
    document.querySelectorAll<HTMLElement>('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.classList.remove('open');
        });
    });

    // Close buttons
    document.querySelectorAll<HTMLElement>('[data-modal]').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.modal!;
            closeModal(id);
        });
    });

    // Add to Queue
    document.getElementById('addQueueBtn')?.addEventListener('click', () => {
        loadTechnicianOptions('qTechnician');
        openModal('queueModal');
    });

    document.getElementById('queueConfirmBtn')?.addEventListener('click', async () => {
        const customer = (document.getElementById('qCustomer') as HTMLInputElement).value.trim();
        const phone = (document.getElementById('qPhone') as HTMLInputElement).value.trim();
        const device = (document.getElementById('qDevice') as HTMLInputElement).value.trim();
        const tech = (document.getElementById('qTechnician') as HTMLSelectElement).value;
        const branch = (document.getElementById('qBranch') as HTMLSelectElement).value;

        if (!customer || !device) { showToast('Customer and device are required.', 'error'); return; }

        const res = await apiFetch('/admin/queue', {
            method: 'POST',
            body: JSON.stringify({ customer_name: customer, phone, service: device, technician_id: tech || null, branch_id: branch }),
        });

        if (res) { showToast('Added to queue!', 'success'); closeModal('queueModal'); loadQueue(); }
        else showToast('Failed to add.', 'error');
    });

    // Add Staff
    document.getElementById('addStaffBtn')?.addEventListener('click', () => openModal('staffModal'));

    document.getElementById('staffConfirmBtn')?.addEventListener('click', async () => {
        const name = (document.getElementById('staffName') as HTMLInputElement).value.trim();
        const username = (document.getElementById('staffUsername') as HTMLInputElement).value.trim();
        const password = (document.getElementById('staffPassword') as HTMLInputElement).value.trim();
        const role = (document.getElementById('staffRole') as HTMLSelectElement).value;
        const branch = (document.getElementById('staffBranch') as HTMLSelectElement).value;

        if (!name || !username || !password) { showToast('All fields required.', 'error'); return; }

        const res = await apiFetch('/admin/staff', {
            method: 'POST',
            body: JSON.stringify({ full_name: name, username, password, role, branch_id: branch === 'both' ? null : branch }),
        });

        if (res) { showToast('Staff added!', 'success'); closeModal('staffModal'); loadStaff(); }
        else showToast('Failed to add staff.', 'error');
    });

    // Add Service
    document.getElementById('addServiceBtn')?.addEventListener('click', () => {
        document.getElementById('serviceModalTitle')!.textContent = 'Add Service';
        openModal('serviceModal');
    });

    document.getElementById('serviceConfirmBtn')?.addEventListener('click', async () => {
        const name = (document.getElementById('svcName') as HTMLInputElement).value.trim();
        const category = (document.getElementById('svcCategory') as HTMLInputElement).value.trim();
        const duration = Number((document.getElementById('svcDuration') as HTMLInputElement).value);
        const price = Number((document.getElementById('svcPrice') as HTMLInputElement).value);
        const desc = (document.getElementById('svcDesc') as HTMLTextAreaElement).value.trim();

        if (!name) { showToast('Service name required.', 'error'); return; }

        const res = await apiFetch('/admin/services', {
            method: 'POST',
            body: JSON.stringify({ service_name: name, category, duration: duration || 60, price: price || 0, description: desc }),
        });

        if (res) { showToast('Service added!', 'success'); closeModal('serviceModal'); loadServices(); }
        else showToast('Failed to add service.', 'error');
    });

    // Add Customer
    document.getElementById('addCustomerBtn')?.addEventListener('click', () => openModal('customerModal'));

    document.getElementById('customerConfirmBtn')?.addEventListener('click', async () => {
        const name = (document.getElementById('custFullName') as HTMLInputElement).value.trim();
        const phone = (document.getElementById('custPhoneAdmin') as HTMLInputElement).value.trim();
        const email = (document.getElementById('custEmailAdmin') as HTMLInputElement).value.trim();
        const req = (document.getElementById('custRequest') as HTMLTextAreaElement).value.trim();

        if (!name) { showToast('Full name required.', 'error'); return; }

        const res = await apiFetch('/admin/customers', {
            method: 'POST',
            body: JSON.stringify({ full_name: name, phone, email, special_request: req }),
        });

        if (res) { showToast('Customer added!', 'success'); closeModal('customerModal'); loadCustomers(); }
        else showToast('Failed to add customer.', 'error');
    });

    // Assign Technician
    document.getElementById('assignConfirmBtn')?.addEventListener('click', async () => {
        const queueId = (document.getElementById('assignQueueId') as HTMLInputElement).value;
        const techId = (document.getElementById('assignTechSelect') as HTMLSelectElement).value;

        if (!techId) { showToast('Select a technician.', 'error'); return; }

        const res = await apiFetch(`/admin/queue/${queueId}/assign`, {
            method: 'POST',
            body: JSON.stringify({ technician_id: techId }),
        });

        if (res) { showToast('Technician assigned!', 'success'); closeModal('assignModal'); loadQueue(); loadAppointments(); }
        else showToast('Failed to assign.', 'error');
    });
}

// ── THEME ──
function initTheme(): void {
    const saved = localStorage.getItem('adminTheme');
    if (saved === 'dark') {
        isDark = true;
        document.documentElement.setAttribute('data-theme', 'dark');
        const iconEl = document.getElementById('toggleIcon');
        const textEl = document.getElementById('toggleText');
        if (iconEl) iconEl.textContent = '☀';
        if (textEl) textEl.textContent = 'Light';
    }
}

function initThemeToggle(): void {
    document.getElementById('themeToggle')?.addEventListener('click', () => {
        isDark = !isDark;
        document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
        const iconEl = document.getElementById('toggleIcon');
        const textEl = document.getElementById('toggleText');
        if (iconEl) iconEl.textContent = isDark ? '☀' : '⚡';
        if (textEl) textEl.textContent = isDark ? 'Light' : 'Neon';
        localStorage.setItem('adminTheme', isDark ? 'dark' : 'light');
    });
}

// ── SIDEBAR TOGGLE ──
function initSidebarToggle(): void {
    document.getElementById('sidebarToggle')?.addEventListener('click', () => {
        const sidebar = document.getElementById('sidebar');
        const main = document.getElementById('mainContent');

        if (window.innerWidth <= 768) {
            sidebar?.classList.toggle('open');
        } else {
            sidebar?.classList.toggle('collapsed');
            main?.classList.toggle('expanded');
        }
    });
}

// ── LOGOUT ──
function initLogout(): void {
    document.getElementById('logoutBtn')?.addEventListener('click', () => {
        sessionStorage.removeItem('adminUser');
        localStorage.removeItem('adminUser');
        window.location.href = 'admin-login.html';
    });
}

// ── SEARCH ──
function initSearch(): void {
    document.getElementById('sidebarSearch')?.addEventListener('input', (e) => {
        const q = (e.target as HTMLInputElement).value.toLowerCase();
        document.querySelectorAll<HTMLElement>('.nav-item').forEach(item => {
            const label = item.textContent?.toLowerCase() || '';
            item.style.display = label.includes(q) ? '' : 'none';
        });
    });
}

// ── HELPERS ──
function formatPeso(amount: number): string {
    return `₱${Number(amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
}

function badge(status: string): string {
    const map: Record<string, string> = {
        completed: 'Completed', confirmed: 'Confirmed', pending: 'Pending',
        cancelled: 'Cancelled', in_progress: 'In Progress',
    };
    return `<span class="badge badge-${status.replace(' ','_')}">${map[status] || status}</span>`;
}

function showToast(msg: string, type: 'success' | 'error' | '' = ''): void {
    const toast = document.getElementById('toast')!;
    toast.textContent = msg;
    toast.className = `toast${type ? ' ' + type : ''} show`;
    setTimeout(() => toast.classList.remove('show'), 3000);
}