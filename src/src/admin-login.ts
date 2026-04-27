// ══════════════════════════════════════════
//  QueueTech Admin Login
// ══════════════════════════════════════════
export {};
const API = 'http://localhost:3000/api';

// ── CANVAS ANIMATION ──
const canvas = document.getElementById('bgCanvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
let W: number, H: number;

function resize(): void { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; }
resize();
window.addEventListener('resize', resize);

interface Bubble { x: number; y: number; r: number; vx: number; vy: number; alpha: number; alphaDir: number; color: string; pulse: number; pulseDir: number; }

const COLORS = ['#00f0ff','#0070ff','#00b8ff','#40e0ff','#0050cc'];
const bubbles: Bubble[] = Array.from({ length: 50 }, () => ({
    x: Math.random() * window.innerWidth,
    y: Math.random() * window.innerHeight,
    r: Math.random() * 16 + 4,
    vx: (Math.random() - 0.5) * 0.5,
    vy: (Math.random() - 0.5) * 0.5,
    alpha: Math.random() * 0.5 + 0.1,
    alphaDir: Math.random() > 0.5 ? 1 : -1,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    pulse: Math.random() * 16 + 4,
    pulseDir: Math.random() > 0.5 ? 1 : -1,
}));

function hexToRgb(hex: string): string {
    const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
    return `${r},${g},${b}`;
}

function drawBubble(b: Bubble): void {
    const rgb = hexToRgb(b.color);
    const grd = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.pulse * 2.5);
    grd.addColorStop(0, `rgba(${rgb},${b.alpha * 0.5})`);
    grd.addColorStop(1, `rgba(${rgb},0)`);
    ctx.beginPath(); ctx.arc(b.x, b.y, b.pulse * 2.5, 0, Math.PI * 2); ctx.fillStyle = grd; ctx.fill();
    ctx.beginPath(); ctx.arc(b.x, b.y, b.pulse, 0, Math.PI * 2); ctx.strokeStyle = `rgba(${rgb},${b.alpha})`; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.beginPath(); ctx.arc(b.x - b.pulse * 0.25, b.y - b.pulse * 0.25, b.pulse * 0.35, 0, Math.PI * 2); ctx.fillStyle = `rgba(255,255,255,${b.alpha * 0.25})`; ctx.fill();
}

function drawConnections(): void {
    for (let i = 0; i < bubbles.length; i++) {
        for (let j = i + 1; j < bubbles.length; j++) {
            const a = bubbles[i], b = bubbles[j];
            const dx = a.x - b.x, dy = a.y - b.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist < 130) {
                const alpha = (1 - dist / 130) * 0.2;
                ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
                ctx.strokeStyle = `rgba(0,200,255,${alpha})`; ctx.lineWidth = 0.8; ctx.stroke();
            }
        }
    }
}

function animate(): void {
    ctx.clearRect(0, 0, W, H);
    const bg = ctx.createRadialGradient(W*0.5, H*0.5, 0, W*0.5, H*0.5, Math.max(W,H)*0.8);
    bg.addColorStop(0, 'rgba(5,15,30,1)'); bg.addColorStop(1, 'rgba(3,8,16,1)');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    drawConnections();

    bubbles.forEach(b => {
        b.x += b.vx; b.y += b.vy;
        if (b.x < -50) b.x = W+50; if (b.x > W+50) b.x = -50;
        if (b.y < -50) b.y = H+50; if (b.y > H+50) b.y = -50;
        b.alpha += b.alphaDir * 0.003;
        if (b.alpha > 0.65 || b.alpha < 0.05) b.alphaDir *= -1;
        b.pulse += b.pulseDir * 0.04;
        if (b.pulse > b.r * 1.3 || b.pulse < b.r * 0.7) b.pulseDir *= -1;
        drawBubble(b);
    });
    requestAnimationFrame(animate);
}
animate();

// ── FORM ──
const usernameInput  = document.querySelector<HTMLInputElement>('.input-field[type="text"]');
const passwordInput  = document.querySelector<HTMLInputElement>('.input-field[type="password"]');
const loginBtn       = document.querySelector<HTMLButtonElement>('.login-btn');
const rememberCheck  = document.querySelector<HTMLInputElement>('.remember-check');

// Restore remembered username
const savedUser = localStorage.getItem('adminRememberUser');
if (savedUser && usernameInput) {
    usernameInput.value = savedUser;
    if (rememberCheck) rememberCheck.checked = true;
}

// Enter key
document.querySelectorAll<HTMLInputElement>('.input-field').forEach(input => {
    input.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Enter') handleLogin();
    });
});

loginBtn?.addEventListener('click', handleLogin);

function setLoading(state: boolean): void {
    if (!loginBtn) return;
    if (state) {
        loginBtn.classList.add('loading');
    } else {
        loginBtn.classList.remove('loading');
        const btnText = loginBtn.querySelector<HTMLElement>('.btn-text');
        if (btnText) btnText.textContent = 'Sign In';
    }
}

async function handleLogin(): Promise<void> {
    const username = usernameInput?.value.trim() || '';
    const password = passwordInput?.value.trim() || '';

    // Clear previous errors
    clearErrors();

    if (!username) { showError('username', 'Username is required.'); return; }
    if (!password) { showError('password', 'Password is required.'); return; }

    setLoading(true);

    try {
        const res = await fetch(`${API}/admin/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });

        const data = await res.json();

        if (!res.ok) {
            setLoading(false);
            showError('password', data.error || 'Invalid username or password.');
            return;
        }

        // Save session
        const sessionData = JSON.stringify({ user: data.user, token: data.token });
        const storage = (rememberCheck?.checked) ? localStorage : sessionStorage;
        storage.setItem('adminUser', sessionData);

        if (rememberCheck?.checked) {
            localStorage.setItem('adminRememberUser', username);
        } else {
            localStorage.removeItem('adminRememberUser');
        }

        // Redirect to admin dashboard
        window.location.replace('admin.html');

    } catch {
        setLoading(false);
        showError('password', 'Cannot connect to server. Please try again.');
    }
}

function showError(field: string, msg: string): void {
    const groups = document.querySelectorAll<HTMLElement>('.input-group');
    groups.forEach(group => {
        const label = group.querySelector<HTMLElement>('.input-label');
        if (label && label.textContent?.toLowerCase().includes(field)) {
            group.classList.add('error');
            let errEl = group.querySelector<HTMLElement>('.input-error');
            if (!errEl) {
                errEl = document.createElement('span');
                errEl.className = 'input-error';
                group.appendChild(errEl);
            }
            errEl.textContent = msg;
        }
    });
}

function clearErrors(): void {
    document.querySelectorAll<HTMLElement>('.input-group').forEach(g => {
        g.classList.remove('error');
        const err = g.querySelector<HTMLElement>('.input-error');
        if (err) err.textContent = '';
    });
}