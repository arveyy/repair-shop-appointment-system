export {};

const API = 'http://localhost:3000/api';

// ══════════════════════════════
//  NAVBAR SCROLL
// ══════════════════════════════
const navbar = document.querySelector<HTMLElement>('.navbar');

window.addEventListener('scroll', (): void => {
    if (!navbar) return;
    if (window.scrollY > 50) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }
});

// ══════════════════════════════
//  TYPES
// ══════════════════════════════
interface Service {
    id: number;
    service_name: string;
    duration: number;
    price: number;
}

interface SelectedService extends Service {
    qty: number;
    isCustom?: boolean;
    customDesc?: string;
}

interface BookingState {
    branchId: number | null;
    branchName: string;
    selectedServices: SelectedService[];
    date: string;
    time: string;
}

// ══════════════════════════════
//  STATE
// ══════════════════════════════
const state: BookingState = {
    branchId: null,
    branchName: '',
    selectedServices: [],
    date: '',
    time: '',
};

let allServices: Service[] = [];
let calYear: number = new Date().getFullYear();
let calMonth: number = new Date().getMonth();

// ══════════════════════════════
//  HELPERS
// ══════════════════════════════
function formatPrice(p: number): string {
    return p === 0 ? 'FREE' : `₱${p.toLocaleString()}`;
}

function getTotal(): number {
    return state.selectedServices.reduce((sum, s) => sum + s.price * s.qty, 0);
}

// ══════════════════════════════
//  MODAL OPEN / CLOSE
// ══════════════════════════════
const overlay = document.getElementById('bookingOverlay')!;

function openBookingModal(branchId: number, branchName: string): void {
    state.branchId = branchId;
    state.branchName = branchName;
    state.selectedServices = [];
    state.date = '';
    state.time = '';

    const branchLabel = document.getElementById('bkBranchName');
    if (branchLabel) branchLabel.textContent = branchName;

    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';

    goToStep(1);
    loadServices();
}

function closeBookingModal(): void {
    overlay.classList.remove('open');
    document.body.style.overflow = '';
}

document.getElementById('bookingClose')?.addEventListener('click', closeBookingModal);

overlay.addEventListener('click', (e: MouseEvent): void => {
    if (e.target === overlay) closeBookingModal();
});

// Close on Escape key
document.addEventListener('keydown', (e: KeyboardEvent): void => {
    if (e.key === 'Escape') closeBookingModal();
});

// ══════════════════════════════
//  BRANCH CARDS
// ══════════════════════════════
document.querySelectorAll<HTMLElement>('.branch-card').forEach(card => {
    card.addEventListener('click', (e: Event): void => {
        e.preventDefault();
        e.stopPropagation();
        const branchId = Number(card.getAttribute('data-branch'));
        const branchName = card.getAttribute('data-branch-name') || `Branch ${branchId}`;
        openBookingModal(branchId, branchName);
    });
});

// Nav "Book Appointment" link
document.getElementById('navBookBtn')?.addEventListener('click', (e: Event): void => {
    e.preventDefault();
    const firstCard = document.querySelector<HTMLElement>('.branch-card');
    if (firstCard) {
        firstCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
});

// ══════════════════════════════
//  PROGRESS STEPS
// ══════════════════════════════
function goToStep(step: number): void {
    // Pages
    document.querySelectorAll<HTMLElement>('.bk-page').forEach(p => p.classList.remove('active'));
    const target = step === 4
        ? document.getElementById('bk-step-success')
        : document.getElementById(`bk-step-${step}`);
    if (target) target.classList.add('active');

    // Steps
    document.querySelectorAll<HTMLElement>('.bk-step').forEach(el => {
        const s = Number(el.dataset.step);
        el.classList.remove('active', 'done');
        if (s < step) el.classList.add('done');
        if (s === step) el.classList.add('active');
    });

    // Lines
    document.querySelectorAll<HTMLElement>('.bk-line').forEach((line, i) => {
        line.classList.toggle('done', i + 1 < step);
    });

    // Scroll glass to top
    const glass = document.querySelector<HTMLElement>('.booking-glass');
    if (glass) glass.scrollTop = 0;
}

// ══════════════════════════════
//  STEP 1: SERVICES
// ══════════════════════════════
async function loadServices(): Promise<void> {
    try {
        const res = await fetch(`${API}/services`);
        allServices = await res.json();
    } catch {
        allServices = FALLBACK_SERVICES;
    }
    renderServicesList(allServices);
}

function renderServicesList(services: Service[]): void {
    const list = document.getElementById('bkServicesList')!;
    if (!services.length) {
        list.innerHTML = `<div class="bk-no-results">No services found.</div>`;
        return;
    }
    list.innerHTML = services.map(s => {
        const selected = state.selectedServices.some(sel => sel.id === s.id);
        return `
        <div class="bk-service-item ${selected ? 'selected' : ''}" data-id="${s.id}">
            <div class="bk-svc-left">
                <div class="bk-svc-name">${s.service_name}</div>
                <div class="bk-svc-meta">${s.duration} min</div>
            </div>
            <div class="bk-svc-price">${formatPrice(s.price)}</div>
            <button class="bk-svc-add" data-id="${s.id}">${selected ? '&#10003;' : '+'}</button>
        </div>`;
    }).join('');

    list.querySelectorAll<HTMLElement>('.bk-service-item').forEach(item => {
        item.addEventListener('click', () => toggleService(Number(item.dataset.id)));
    });
}

function toggleService(id: number): void {
    const svc = allServices.find(s => s.id === id);
    if (!svc) return;
    const idx = state.selectedServices.findIndex(s => s.id === id);
    if (idx >= 0) {
        state.selectedServices.splice(idx, 1);
    } else {
        state.selectedServices.push({ ...svc, qty: 1 });
    }
    renderServicesList(allServices);
    renderSelectedList();
    updateStep1Btn();
}

function renderSelectedList(): void {
    const list = document.getElementById('bkSelectedList')!;
    const count = document.getElementById('bkSelectedCount')!;
    const total = document.getElementById('bkTotal')!;

    count.textContent = String(state.selectedServices.length);
    total.textContent = formatPrice(getTotal());

    if (!state.selectedServices.length) {
        list.innerHTML = `<div class="bk-empty-sel">No services selected yet.</div>`;
        return;
    }

    list.innerHTML = state.selectedServices.map((s, i) => `
        <div class="bk-sel-row" data-index="${i}">
            <span class="bk-sel-name">
                ${s.service_name}
                ${s.isCustom ? '<span class="bk-custom-tag">Custom</span>' : ''}
            </span>
            <div class="bk-qty-ctrl">
                <button class="bk-qty-btn dec-btn" data-index="${i}">&#8722;</button>
                <span class="bk-qty-num">${s.qty}</span>
                <button class="bk-qty-btn inc-btn" data-index="${i}">+</button>
            </div>
            <span class="bk-sel-price">${formatPrice(s.price * s.qty)}</span>
            <button class="bk-remove-btn" data-index="${i}">&#10005;</button>
        </div>`).join('');

    list.querySelectorAll<HTMLElement>('.dec-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = Number(btn.dataset.index);
            if (state.selectedServices[idx].qty > 1) {
                state.selectedServices[idx].qty--;
            } else {
                state.selectedServices.splice(idx, 1);
                renderServicesList(allServices);
            }
            renderSelectedList();
            updateStep1Btn();
        });
    });

    list.querySelectorAll<HTMLElement>('.inc-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = Number(btn.dataset.index);
            state.selectedServices[idx].qty++;
            renderSelectedList();
            updateStep1Btn();
        });
    });

    list.querySelectorAll<HTMLElement>('.bk-remove-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = Number(btn.dataset.index);
            state.selectedServices.splice(idx, 1);
            renderServicesList(allServices);
            renderSelectedList();
            updateStep1Btn();
        });
    });
}

function updateStep1Btn(): void {
    const btn = document.getElementById('bkStep1Next') as HTMLButtonElement;
    btn.disabled = state.selectedServices.length === 0;
}

// Search
document.getElementById('bkServiceSearch')?.addEventListener('input', (e) => {
    const q = (e.target as HTMLInputElement).value.toLowerCase();
    renderServicesList(allServices.filter(s => s.service_name.toLowerCase().includes(q)));
});

// Custom service toggle
const customToggle = document.getElementById('bkCustomToggle')!;
const customForm = document.getElementById('bkCustomForm')!;

customToggle.addEventListener('click', () => {
    customForm.classList.toggle('open');
});

document.getElementById('bkAddCustom')?.addEventListener('click', () => {
    const nameEl = document.getElementById('bkCustomName') as HTMLInputElement;
    const descEl = document.getElementById('bkCustomDesc') as HTMLTextAreaElement;
    const name = nameEl.value.trim();
    if (!name) { nameEl.focus(); return; }

    state.selectedServices.push({
        id: Date.now(),
        service_name: name,
        duration: 60,
        price: 0,
        qty: 1,
        isCustom: true,
        customDesc: descEl.value.trim(),
    });

    nameEl.value = '';
    descEl.value = '';
    customForm.classList.remove('open');
    renderSelectedList();
    updateStep1Btn();
});

// Step 1 Next
document.getElementById('bkStep1Next')?.addEventListener('click', () => {
    goToStep(2);
    renderCalendar();
});

// ══════════════════════════════
//  STEP 2: DATE & TIME
// ══════════════════════════════
const TIME_SLOTS = [
    '9:00 AM','9:30 AM','10:00 AM','10:30 AM','11:00 AM','11:30 AM',
    '12:00 PM','12:30 PM','1:00 PM','1:30 PM','2:00 PM','2:30 PM',
    '3:00 PM','3:30 PM','4:00 PM'
];

const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];

function renderCalendar(): void {
    const label = document.getElementById('bkCalLabel')!;
    const grid = document.getElementById('bkCalGrid')!;
    label.textContent = `${MONTHS[calMonth]} ${calYear}`;

    const firstDay = new Date(calYear, calMonth, 1).getDay();
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const today = new Date();

    let html = '';
    for (let i = 0; i < firstDay; i++) html += `<div class="bk-cal-day empty"></div>`;

    for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(calYear, calMonth, d);
        const isPast = date < new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const isSunday = date.getDay() === 0;
        const isToday = date.toDateString() === today.toDateString();
        const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const isSelected = state.date === dateStr;
        const disabled = isPast || isSunday;

        html += `<div class="bk-cal-day ${disabled ? 'disabled' : ''} ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}"
                    data-date="${dateStr}">${d}</div>`;
    }
    grid.innerHTML = html;

    grid.querySelectorAll<HTMLElement>('.bk-cal-day:not(.disabled):not(.empty)').forEach(day => {
        day.addEventListener('click', () => {
            state.date = day.dataset.date!;
            state.time = '';
            renderCalendar();
            loadTimeSlots(state.date);
        });
    });
}

document.getElementById('bkCalPrev')?.addEventListener('click', () => {
    calMonth--;
    if (calMonth < 0) { calMonth = 11; calYear--; }
    renderCalendar();
});

document.getElementById('bkCalNext')?.addEventListener('click', () => {
    calMonth++;
    if (calMonth > 11) { calMonth = 0; calYear++; }
    renderCalendar();
});

async function loadTimeSlots(date: string): Promise<void> {
    const sub = document.getElementById('bkSlotsSub')!;
    const grid = document.getElementById('bkSlotsGrid')!;

    const d = new Date(date + 'T00:00:00');
    sub.textContent = d.toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    let booked: string[] = [];
    try {
        const res = await fetch(`${API}/bookings/slots?branch_id=${state.branchId}&date=${date}`);
        const data = await res.json();
        booked = data.booked || [];
    } catch {
        booked = [];
    }

    grid.innerHTML = TIME_SLOTS.map(slot => {
        const isBooked = booked.includes(slot);
        const isSelected = state.time === slot;
        return `<button class="bk-slot-btn ${isBooked ? 'booked' : ''} ${isSelected ? 'selected' : ''}"
                    data-time="${slot}" ${isBooked ? 'disabled' : ''}>${slot}</button>`;
    }).join('');

    grid.querySelectorAll<HTMLButtonElement>('.bk-slot-btn:not(.booked)').forEach(btn => {
        btn.addEventListener('click', () => {
            state.time = btn.dataset.time!;
            grid.querySelectorAll('.bk-slot-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            updateStep2Btn();
        });
    });
}

function updateStep2Btn(): void {
    const btn = document.getElementById('bkStep2Next') as HTMLButtonElement;
    btn.disabled = !state.date || !state.time;
}

document.getElementById('bkStep2Next')?.addEventListener('click', () => {
    goToStep(3);
    populateSummary();
});

document.getElementById('bkBack2')?.addEventListener('click', () => goToStep(1));

// ══════════════════════════════
//  STEP 3: CUSTOMER DETAILS
// ══════════════════════════════
function populateSummary(): void {
    const branch = document.getElementById('sumBranch')!;
    const date = document.getElementById('sumDate')!;
    const time = document.getElementById('sumTime')!;
    const services = document.getElementById('sumServices')!;
    const total = document.getElementById('sumTotal')!;

    branch.textContent = state.branchName;

    const d = new Date(state.date + 'T00:00:00');
    date.textContent = d.toLocaleDateString('en-PH', { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric' });
    time.textContent = state.time;

    services.innerHTML = state.selectedServices.map(s => `
        <div class="bk-sum-svc-item">
            <span class="bk-sum-svc-name">${s.service_name}${s.isCustom ? ' <small style="color:#92400e">(Custom)</small>' : ''}</span>
            <span class="bk-sum-svc-qty">x${s.qty}</span>
            <span class="bk-sum-svc-price">${formatPrice(s.price * s.qty)}</span>
        </div>`).join('');

    total.textContent = formatPrice(getTotal());
}

document.getElementById('bkBack3')?.addEventListener('click', () => goToStep(2));

function getVal(id: string): string {
    return (document.getElementById(id) as HTMLInputElement)?.value.trim() || '';
}

document.getElementById('bkConfirm')?.addEventListener('click', async () => {
    const name = getVal('bkName');
    const phone = getVal('bkPhone');
    const email = getVal('bkEmail');
    const errorEl = document.getElementById('bkError')!;

    errorEl.textContent = '';

    if (!name) { errorEl.textContent = 'Full name is required.'; return; }
    if (!phone) { errorEl.textContent = 'Phone number is required.'; return; }
    if (!email || !email.includes('@')) { errorEl.textContent = 'A valid email address is required.'; return; }

    const btn = document.getElementById('bkConfirm') as HTMLButtonElement;
    btn.textContent = 'Confirming...';
    btn.disabled = true;

    const payload = {
        branch_id: Number(state.branchId),
        appointment_date: state.date,
        appointment_time: state.time,
        customer: {
            full_name: name,
            phone,
            email,
            social_facebook: getVal('bkFb') || null,
            social_instagram: getVal('bkIg') || null,
            social_tiktok: getVal('bkTt') || null,
            social_twitter: getVal('bkTw') || null,
            social_viber: getVal('bkVb') || null,
            social_whatsapp: getVal('bkWa') || null,
            social_others: getVal('bkOther') || null,
            special_request: getVal('bkSpecial') || null,
        },
        services: state.selectedServices.map(s => ({
            service_id: s.isCustom ? null : s.id,
            quantity: s.qty,
            price: s.price,
            is_custom: s.isCustom || false,
            custom_name: s.isCustom ? s.service_name : null,
            custom_desc: s.isCustom ? s.customDesc : null,
        })),
    };

console.log('Sending payload:', JSON.stringify(payload));

    try {
        const res = await fetch(`${API}/bookings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || 'Booking failed');
        }

        const data = await res.json();
        showSuccess(data.reference_number || `QT-${Date.now()}`);

    } catch (err: any) {
        errorEl.textContent = err.message || 'Something went wrong. Please try again.';
        btn.textContent = 'Confirm Booking';
        btn.disabled = false;
    }
});

function showSuccess(ref: string): void {
    goToStep(4);

    const refEl = document.getElementById('bkRefNum')!;
    const detailsEl = document.getElementById('bkSuccessDetails')!;

    refEl.textContent = `#${ref}`;

    const d = new Date(state.date + 'T00:00:00');
    detailsEl.innerHTML = `
        <div>Branch: ${state.branchName}</div>
        <div>Date: ${d.toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
        <div>Time: ${state.time}</div>
        <div>Services: ${state.selectedServices.length} item(s)</div>
        <div>Total: ${formatPrice(getTotal())}</div>
    `;
}

document.getElementById('bkDone')?.addEventListener('click', () => {
    closeBookingModal();
});

// ══════════════════════════════
//  TRACK REPAIR
// ══════════════════════════════
document.getElementById('trackBtn')?.addEventListener('click', trackRepair);

document.getElementById('trackInput')?.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter') trackRepair();
});

async function trackRepair(): Promise<void> {
    const input = document.getElementById('trackInput') as HTMLInputElement;
    const resultEl = document.getElementById('trackResult')!;
    const ref = input.value.trim();

    if (!ref) return;

    resultEl.innerHTML = `<p style="font-family:'DM Sans',sans-serif;color:#9ca3af;font-size:14px;">Searching...</p>`;

    try {
        const res = await fetch(`${API}/bookings/${ref}`);
        if (!res.ok) throw new Error('Not found');
        const data = await res.json();

        const statusColors: Record<string, string> = {
            pending: '#d97706',
            confirmed: '#059669',
            in_progress: '#2563eb',
            completed: '#059669',
            cancelled: '#dc2626',
        };

        const color = statusColors[data.status] || '#111';

        resultEl.innerHTML = `
            <div class="track-result-card">
                <h3>Booking Found</h3>
                <div class="track-result-row">
                    <span class="track-result-label">Reference</span>
                    <span style="font-weight:700">${data.reference_number}</span>
                </div>
                <div class="track-result-row">
                    <span class="track-result-label">Status</span>
                    <span style="font-weight:700;color:${color};text-transform:capitalize">${data.status?.replace('_', ' ')}</span>
                </div>
                <div class="track-result-row">
                    <span class="track-result-label">Branch</span>
                    <span>${data.branch_name}</span>
                </div>
                <div class="track-result-row">
                    <span class="track-result-label">Date</span>
                    <span>${data.appointment_date}</span>
                </div>
                <div class="track-result-row">
                    <span class="track-result-label">Time</span>
                    <span>${data.appointment_time}</span>
                </div>
                <div class="track-result-row">
                    <span class="track-result-label">Customer</span>
                    <span>${data.full_name}</span>
                </div>
                <div class="track-result-row">
                    <span class="track-result-label">Total</span>
                    <span style="font-weight:700;color:#01428E">₱${Number(data.total_price).toLocaleString()}</span>
                </div>
            </div>`;
    } catch {
        resultEl.innerHTML = `
            <div class="track-result-card" style="text-align:center;color:#ef4444">
                <p style="font-family:'DM Sans',sans-serif;font-size:14px;">
                    No booking found with reference <strong>${ref}</strong>.<br>
                    Please check your reference number and try again.
                </p>
            </div>`;
    }
}

// ══════════════════════════════
//  FALLBACK SERVICES
// ══════════════════════════════
const FALLBACK_SERVICES: Service[] = [
    { id: 1,  service_name: 'Acer Swift 3 Laptop RE-INSTALL',     duration: 60,  price: 1200 },
    { id: 2,  service_name: 'Android Button',                       duration: 60,  price: 700  },
    { id: 3,  service_name: 'Android Glue',                         duration: 60,  price: 200  },
    { id: 4,  service_name: 'Android Micro Charging Pin',           duration: 60,  price: 700  },
    { id: 5,  service_name: 'Android Service',                      duration: 60,  price: 500  },
    { id: 6,  service_name: 'Android Service Glue Only',            duration: 60,  price: 200  },
    { id: 7,  service_name: 'Android/Apple Check up',               duration: 60,  price: 0    },
    { id: 8,  service_name: 'Asus Laptop Restart / Deep Clean',     duration: 60,  price: 2000 },
    { id: 9,  service_name: 'Battery Fuse',                         duration: 60,  price: 700  },
    { id: 10, service_name: 'Charging Port Type-C',                 duration: 60,  price: 1200 },
    { id: 11, service_name: 'Dell Inspiro P143G LCD',               duration: 60,  price: 5900 },
    { id: 12, service_name: 'Dell Laptop P89F Hinges',              duration: 60,  price: 4000 },
    { id: 13, service_name: 'HP Laptop 250 G7 LCD',                 duration: 60,  price: 5900 },
    { id: 14, service_name: 'HP Laptop OS Install',                 duration: 60,  price: 1500 },
    { id: 15, service_name: 'Huawei Laptop C-PIN Replace',          duration: 60,  price: 3500 },
    { id: 16, service_name: 'Huawei Y9 LCD',                        duration: 60,  price: 1500 },
    { id: 17, service_name: 'Huawei Nova 5 Battery',                duration: 60,  price: 1750 },
    { id: 18, service_name: 'Huawei MatePad Battery + Button',      duration: 60,  price: 3400 },
    { id: 19, service_name: 'Infinix Hot 50 Pro LCD',               duration: 60,  price: 1850 },
    { id: 20, service_name: 'Infinix Note 10 Pro Charging Pin',     duration: 60,  price: 1200 },
    { id: 21, service_name: 'Infinix Note 30 5G CPU Issue',         duration: 60,  price: 4000 },
    { id: 22, service_name: 'Infinix Smart 10 LCD',                 duration: 60,  price: 1600 },
    { id: 23, service_name: 'Infinix Smart 8 LCD',                  duration: 180, price: 1500 },
    { id: 24, service_name: 'iPad 6th Gen iCloud Bypass',           duration: 60,  price: 2000 },
    { id: 25, service_name: 'iPad A228 Motherboard',                duration: 60,  price: 6500 },
    { id: 26, service_name: 'iPhone 11 Back Camera Repair',         duration: 60,  price: 1500 },
    { id: 27, service_name: 'iPhone 11 Back Camera Replace',        duration: 60,  price: 4450 },
    { id: 28, service_name: 'iPhone 11 Battery',                    duration: 60,  price: 2500 },
    { id: 29, service_name: 'iPhone 11 LCD OLED',                   duration: 60,  price: 4450 },
    { id: 30, service_name: 'iPhone 12 Battery',                    duration: 60,  price: 2950 },
    { id: 31, service_name: 'iPhone 12 LCD',                        duration: 60,  price: 4900 },
    { id: 32, service_name: 'iPhone 13 Battery',                    duration: 60,  price: 4950 },
    { id: 33, service_name: 'iPhone 13 LCD',                        duration: 60,  price: 6800 },
    { id: 34, service_name: 'iPhone 14 Battery',                    duration: 60,  price: 4950 },
    { id: 35, service_name: 'iPhone 14 LCD',                        duration: 60,  price: 6950 },
    { id: 36, service_name: 'Samsung A30s LCD',                     duration: 60,  price: 1500 },
    { id: 37, service_name: 'Samsung Note 9 Battery',               duration: 60,  price: 1500 },
    { id: 38, service_name: 'Redmi Note 12 Charging Pin',           duration: 60,  price: 1200 },
    { id: 39, service_name: 'Tecno Spark Bootloop Restart',         duration: 60,  price: 1000 },
    { id: 40, service_name: 'Vivo Y21 Charging Pin',                duration: 60,  price: 800  },
    { id: 41, service_name: 'Xiaomi Poco F5 Battery',               duration: 60,  price: 1850 },
    { id: 42, service_name: 'ZTE Nubia V60 LCD',                    duration: 60,  price: 1500 },
];

(window as any).openModal = openBookingModal;