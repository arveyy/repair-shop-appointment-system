// ── TYPES ──
export {};
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
    currentStep: number;
}

const API = 'http://localhost:3000/api';

const state: BookingState = {
    branchId: null,
    branchName: '',
    selectedServices: [],
    date: '',
    time: '',
    currentStep: 1,
};

// ── HELPERS ──
function formatPrice(p: number): string {
    return p === 0 ? 'FREE' : `₱${p.toLocaleString()}`;
}

function getTotalPrice(): number {
    return state.selectedServices.reduce((sum, s) => sum + s.price * s.qty, 0);
}

// ── PROGRESS ──
function updateProgress(step: number): void {
    document.querySelectorAll<HTMLElement>('.progress-step').forEach((el, i) => {
        const s = i + 1;
        el.classList.remove('active', 'done');
        if (s < step) el.classList.add('done');
        if (s === step) el.classList.add('active');
    });
    document.querySelectorAll<HTMLElement>('.progress-line').forEach((el, i) => {
        el.classList.toggle('done', i + 1 < step);
    });
}

function goToStep(step: number): void {
    document.querySelectorAll<HTMLElement>('.booking-step').forEach(el => el.classList.remove('active'));
    const target = document.getElementById(`step-${step}`);
    if (target) target.classList.add('active');
    state.currentStep = step;
    updateProgress(step);
    const backWrap = document.getElementById('backBtnWrap');
    if (backWrap) backWrap.style.display = step > 1 && step < 5 ? 'block' : 'none';
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── STEP 1: BRANCH ──
document.querySelectorAll<HTMLElement>('.select-branch-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const card = btn.closest<HTMLElement>('.branch-card-booking');
        if (!card) return;
        state.branchId = Number(card.dataset.branch);
        const nameEl = card.querySelector<HTMLElement>('.branch-name');
        state.branchName = nameEl?.textContent || `Branch ${state.branchId}`;
        goToStep(2);
        loadServices();
    });
});

// ── STEP 2: SERVICES ──
let allServices: Service[] = [];

async function loadServices(): Promise<void> {
    try {
        const res = await fetch(`${API}/services`);
        allServices = await res.json();
        renderServicesList(allServices);
    } catch {
        // Fallback if API not connected
        allServices = FALLBACK_SERVICES;
        renderServicesList(allServices);
    }
}

function renderServicesList(services: Service[]): void {
    const list = document.getElementById('servicesList')!;
    if (services.length === 0) {
        list.innerHTML = `<div class="service-no-results">No services found.</div>`;
        return;
    }
    list.innerHTML = services.map(s => {
        const isSelected = state.selectedServices.some(sel => sel.id === s.id);
        return `
        <div class="service-item ${isSelected ? 'selected' : ''}" data-id="${s.id}">
            <div class="service-item-left">
                <div class="service-item-name">${s.service_name}</div>
                <div class="service-item-meta">
                    <span>⏱ ${s.duration} min</span>
                </div>
            </div>
            <div class="service-item-price">${formatPrice(s.price)}</div>
            <button class="service-add-btn" data-id="${s.id}">${isSelected ? '✓' : '+'}</button>
        </div>`;
    }).join('');

    list.querySelectorAll<HTMLElement>('.service-item').forEach(item => {
        item.addEventListener('click', () => {
            const id = Number(item.dataset.id);
            toggleService(id);
        });
    });
}

function toggleService(id: number): void {
    const service = allServices.find(s => s.id === id);
    if (!service) return;
    const idx = state.selectedServices.findIndex(s => s.id === id);
    if (idx >= 0) {
        state.selectedServices.splice(idx, 1);
    } else {
        state.selectedServices.push({ ...service, qty: 1 });
    }
    renderServicesList(allServices);
    renderSelectedList();
    updateStep2Next();
}

function renderSelectedList(): void {
    const list = document.getElementById('selectedList')!;
    const empty = document.getElementById('selectedEmpty')!;
    const count = document.getElementById('selectedCount')!;
    const total = document.getElementById('totalAmount')!;

    count.textContent = `${state.selectedServices.length} selected`;
    total.textContent = formatPrice(getTotalPrice());

    if (state.selectedServices.length === 0) {
        empty.style.display = 'flex';
        list.innerHTML = '';
        list.appendChild(empty);
        return;
    }

    empty.style.display = 'none';

    const rows = state.selectedServices.map((s, i) => `
        <div class="selected-service-row" data-index="${i}">
            <span class="sel-name">
                ${s.service_name}
                ${s.isCustom ? '<span class="sel-custom-tag">Custom</span>' : ''}
            </span>
            <div class="qty-controls">
                <button class="qty-btn dec-btn" data-index="${i}">−</button>
                <span class="qty-num">${s.qty}</span>
                <button class="qty-btn inc-btn" data-index="${i}">+</button>
            </div>
            <span class="sel-price">${formatPrice(s.price * s.qty)}</span>
            <button class="remove-btn" data-index="${i}">✕</button>
        </div>
    `).join('');

    list.innerHTML = rows;

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
            updateStep2Next();
        });
    });

    list.querySelectorAll<HTMLElement>('.inc-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = Number(btn.dataset.index);
            state.selectedServices[idx].qty++;
            renderSelectedList();
            updateStep2Next();
        });
    });

    list.querySelectorAll<HTMLElement>('.remove-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = Number(btn.dataset.index);
            const removed = state.selectedServices.splice(idx, 1)[0];
            renderServicesList(allServices);
            renderSelectedList();
            updateStep2Next();
        });
    });
}

function updateStep2Next(): void {
    const btn = document.getElementById('step2Next') as HTMLButtonElement;
    btn.disabled = state.selectedServices.length === 0;
}

// Search
document.getElementById('serviceSearch')?.addEventListener('input', (e) => {
    const q = (e.target as HTMLInputElement).value.toLowerCase();
    const filtered = allServices.filter(s => s.service_name.toLowerCase().includes(q));
    renderServicesList(filtered);
});

// Custom service toggle
const customToggle = document.getElementById('customServiceToggle')!;
const customForm = document.getElementById('customServiceForm')!;
const customArrow = document.getElementById('customArrow')!;

customToggle.addEventListener('click', () => {
    customForm.classList.toggle('open');
    customArrow.classList.toggle('open');
});

document.getElementById('addCustomBtn')?.addEventListener('click', () => {
    const nameInput = document.getElementById('customName') as HTMLInputElement;
    const descInput = document.getElementById('customDesc') as HTMLTextAreaElement;
    const name = nameInput.value.trim();
    if (!name) { nameInput.focus(); return; }

    const custom: SelectedService = {
        id: Date.now(),
        service_name: name,
        duration: 60,
        price: 0,
        qty: 1,
        isCustom: true,
        customDesc: descInput.value.trim(),
    };
    state.selectedServices.push(custom);
    nameInput.value = '';
    descInput.value = '';
    customForm.classList.remove('open');
    customArrow.classList.remove('open');
    renderSelectedList();
    updateStep2Next();
});

document.getElementById('step2Next')?.addEventListener('click', () => {
    goToStep(3);
    initCalendar();
});

// ── STEP 3: DATE & TIME ──
const TIME_SLOTS = [
    '9:00 AM','9:30 AM','10:00 AM','10:30 AM','11:00 AM','11:30 AM',
    '12:00 PM','12:30 PM','1:00 PM','1:30 PM','2:00 PM','2:30 PM',
    '3:00 PM','3:30 PM','4:00 PM'
];

let calYear: number, calMonth: number;

function initCalendar(): void {
    const now = new Date();
    calYear = now.getFullYear();
    calMonth = now.getMonth();
    renderCalendar();
}

function renderCalendar(): void {
    const label = document.getElementById('calMonthLabel')!;
    const grid = document.getElementById('calendarGrid')!;
    const months = ['January','February','March','April','May','June',
                    'July','August','September','October','November','December'];
    label.textContent = `${months[calMonth]} ${calYear}`;

    const firstDay = new Date(calYear, calMonth, 1).getDay();
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const today = new Date();

    let html = '';
    for (let i = 0; i < firstDay; i++) html += `<div class="cal-day empty"></div>`;
    for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(calYear, calMonth, d);
        const isPast = date < new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const isSunday = date.getDay() === 0;
        const isToday = date.toDateString() === today.toDateString();
        const dateStr = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        const isSelected = state.date === dateStr;
        const disabled = isPast || isSunday;
        html += `<div class="cal-day ${disabled ? 'disabled' : ''} ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}"
                    data-date="${dateStr}" ${disabled ? '' : 'role="button"'}>${d}</div>`;
    }
    grid.innerHTML = html;

    grid.querySelectorAll<HTMLElement>('.cal-day:not(.disabled):not(.empty)').forEach(day => {
        day.addEventListener('click', () => {
            state.date = day.dataset.date!;
            state.time = '';
            renderCalendar();
            loadTimeslots(state.date);
        });
    });
}

document.getElementById('calPrev')?.addEventListener('click', () => {
    calMonth--;
    if (calMonth < 0) { calMonth = 11; calYear--; }
    renderCalendar();
});

document.getElementById('calNext')?.addEventListener('click', () => {
    calMonth++;
    if (calMonth > 11) { calMonth = 0; calYear++; }
    renderCalendar();
});

async function loadTimeslots(date: string): Promise<void> {
    const sub = document.getElementById('timeslotsSub')!;
    const grid = document.getElementById('timeslotsGrid')!;
    sub.textContent = 'Loading availability...';

    let bookedSlots: string[] = [];
    try {
        const res = await fetch(`${API}/bookings/slots?branch_id=${state.branchId}&date=${date}`);
        const data = await res.json();
        bookedSlots = data.booked || [];
    } catch {
        bookedSlots = [];
    }

    const d = new Date(date + 'T00:00:00');
    const formatted = d.toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    sub.textContent = formatted;

    grid.innerHTML = TIME_SLOTS.map(slot => {
        const isBooked = bookedSlots.includes(slot);
        const isSelected = state.time === slot;
        return `<button class="timeslot-btn ${isBooked ? 'booked' : ''} ${isSelected ? 'selected' : ''}"
                    data-time="${slot}" ${isBooked ? 'disabled' : ''}>${slot}</button>`;
    }).join('');

    grid.querySelectorAll<HTMLButtonElement>('.timeslot-btn:not(.booked)').forEach(btn => {
        btn.addEventListener('click', () => {
            state.time = btn.dataset.time!;
            grid.querySelectorAll('.timeslot-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            updateStep3Next();
        });
    });
}

function updateStep3Next(): void {
    const btn = document.getElementById('step3Next') as HTMLButtonElement;
    btn.disabled = !state.date || !state.time;
}

document.getElementById('step3Next')?.addEventListener('click', () => {
    goToStep(4);
    populateSummary();
});

// ── STEP 4: CUSTOMER DETAILS ──
function populateSummary(): void {
    const branch = document.getElementById('summaryBranch')!;
    const date = document.getElementById('summaryDate')!;
    const time = document.getElementById('summaryTime')!;
    const servicesList = document.getElementById('summaryServicesList')!;
    const total = document.getElementById('summaryTotal')!;

    branch.textContent = state.branchName;

    const d = new Date(state.date + 'T00:00:00');
    date.textContent = d.toLocaleDateString('en-PH', { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric' });
    time.textContent = state.time;

    servicesList.innerHTML = state.selectedServices.map(s => `
        <div class="summary-service-item">
            <span class="summary-service-name">${s.service_name}${s.isCustom ? ' <span style="font-size:11px;color:#92400e;">(Custom)</span>' : ''}</span>
            <span class="summary-service-qty">x${s.qty}</span>
            <span class="summary-service-price">${formatPrice(s.price * s.qty)}</span>
        </div>
    `).join('');

    total.textContent = formatPrice(getTotalPrice());
}

function validateForm(): boolean {
    const name = (document.getElementById('custName') as HTMLInputElement).value.trim();
    const phone = (document.getElementById('custPhone') as HTMLInputElement).value.trim();
    const email = (document.getElementById('custEmail') as HTMLInputElement).value.trim();
    const errorEl = document.getElementById('formError')!;

    if (!name) { errorEl.textContent = 'Full name is required.'; return false; }
    if (!phone) { errorEl.textContent = 'Phone number is required.'; return false; }
    if (!email || !email.includes('@')) { errorEl.textContent = 'A valid email address is required.'; return false; }

    errorEl.textContent = '';
    return true;
}

document.getElementById('confirmBtn')?.addEventListener('click', async () => {
    if (!validateForm()) return;

    const btn = document.getElementById('confirmBtn') as HTMLButtonElement;
    btn.textContent = 'Confirming...';
    btn.disabled = true;

    const payload = {
        branch_id: state.branchId,
        appointment_date: state.date,
        appointment_time: state.time,
        customer: {
            full_name: (document.getElementById('custName') as HTMLInputElement).value.trim(),
            phone: (document.getElementById('custPhone') as HTMLInputElement).value.trim(),
            email: (document.getElementById('custEmail') as HTMLInputElement).value.trim(),
            social_facebook: (document.getElementById('socFb') as HTMLInputElement).value.trim(),
            social_instagram: (document.getElementById('socIg') as HTMLInputElement).value.trim(),
            social_tiktok: (document.getElementById('socTt') as HTMLInputElement).value.trim(),
            social_twitter: (document.getElementById('socTw') as HTMLInputElement).value.trim(),
            social_viber: (document.getElementById('socVb') as HTMLInputElement).value.trim(),
            social_whatsapp: (document.getElementById('socWa') as HTMLInputElement).value.trim(),
            social_others: (document.getElementById('socOther') as HTMLInputElement).value.trim(),
            special_request: (document.getElementById('specialReq') as HTMLTextAreaElement).value.trim(),
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

    try {
        const res = await fetch(`${API}/bookings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!res.ok) throw new Error('Booking failed');

        const data = await res.json();
        showSuccess(data.reference_number || `QT-${Date.now()}`);
    } catch {
        btn.textContent = 'Confirm Booking ✓';
        btn.disabled = false;
        const errorEl = document.getElementById('formError')!;
        errorEl.textContent = 'Something went wrong. Please try again.';
    }
});

function showSuccess(ref: string): void {
    document.querySelectorAll<HTMLElement>('.booking-step').forEach(el => el.classList.remove('active'));
    document.getElementById('step-success')!.classList.add('active');

    document.getElementById('successRef')!.textContent = `#${ref}`;

    const d = new Date(state.date + 'T00:00:00');
    document.getElementById('successDetails')!.innerHTML = `
        <div>📍 ${state.branchName}</div>
        <div>📅 ${d.toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
        <div>⏰ ${state.time}</div>
        <div>🔧 ${state.selectedServices.length} service(s) — ${formatPrice(getTotalPrice())}</div>
    `;

    const backWrap = document.getElementById('backBtnWrap');
    if (backWrap) backWrap.style.display = 'none';
    updateProgress(5);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── BACK BUTTON ──
document.getElementById('backBtn')?.addEventListener('click', () => {
    if (state.currentStep > 1) goToStep(state.currentStep - 1);
});

// ── FALLBACK SERVICES (when API not connected) ──
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