const API_URL = "https://chamran-api.liara.run";
const DB_KEY = "chamran_db_vfinal_";
const CHECK_INTERVAL = 300; 

let currentUser = null;
let playlist = [];
let allExamsList = []; 
let activeVid = null;
let maxTime = 0;
let isDone = false;
let nextCheckTime = CHECK_INTERVAL;
let timerInterval = null;
let lastActivityTime = Date.now();
let isDragging = false;

const vid = document.getElementById('myVideo');
const container = document.getElementById('playerContainer');
const pBar = document.getElementById('progressBar');
const pThumb = document.getElementById('progressThumb');
const pContainer = document.getElementById('progressBarContainer');

// --- 1. شروع برنامه ---
window.addEventListener('load', () => {
    setTimeout(() => {
        document.getElementById('intro-overlay').classList.add('move-down');
        document.querySelectorAll('.card').forEach(c => c.classList.add('show-content'));
        document.getElementById('loginFooterSig').classList.add('show');
        setTimeout(() => {
            document.getElementById('intro-overlay').style.display = 'none';
            checkAuth();
        }, 1200);
    }, 2500);
});

function toPersianNum(n) { return n.toString().replace(/\d/g, x => ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹'][x]); }
function getDeviceInfo() { return /Mobile|Android/i.test(navigator.userAgent) ? "📱 Mobile" : "💻 PC"; }

// --- 2. سیستم احراز هویت (با قابلیت لود آنی) ---
async function checkAuth() {
    const savedUser = localStorage.getItem(DB_KEY + 'creds');
    
    if(savedUser) {
        // 🚀 FIX: لود آنی از حافظه قبل از درخواست سرور (حل مشکل تاخیر)
        try {
            const userData = JSON.parse(savedUser);
            currentUser = userData;
            if(userData.jsonData) {
                RankSystem.init(userData.jsonData); // هسته را با دیتای لوکال آپدیت کن
                document.getElementById('displayName').innerText = userData.displayName;
                showScreen('screen-library');
            }
        } catch(e) {}
        
        // حالا درخواست بروزرسانی به سرور می‌دهیم (در پس‌زمینه)
        try {
            const creds = JSON.parse(savedUser);
            if(typeof SyncManager !== 'undefined') SyncManager.init(creds.username, creds.password);

            const res = await fetch(`${API_URL}?t=${Date.now()}`, { // جلوگیری از کش
                method: 'POST', headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: 'login', username: creds.username, password: creds.password })
            });
            const data = await res.json();
            
            if(data.status === 'success') {
                // ذخیره جدیدترین دیتا
                const updatedUser = { username: creds.username, password: creds.password, displayName: data.displayName, jsonData: data.jsonData };
                localStorage.setItem(DB_KEY + 'creds', JSON.stringify(updatedUser));
                
                currentUser = updatedUser;
                RankSystem.init(data.jsonData);
                RankSystem.updateNotifications(data.notifications); 
                
                document.getElementById('displayName').innerText = data.displayName;
                // اگر هنوز صفحه لاگین بود (یعنی بار اول)، برو داخل
                if(document.getElementById('screen-login').classList.contains('active')) showScreen('screen-library');
                
                fetchPlaylist(); 
                fetchExamsForHistory(); 
                RankSystem.loadWallOfFame();

            } else { throw new Error("Login failed"); }
        } catch(e) {
            // اگر نت نبود، با همان دیتای لوکال ادامه بده (آفلاین مود)
            if(!currentUser) showScreen('screen-login');
        }
    } else { showScreen('screen-login'); }
}

async function performLogin() {
    const u = document.getElementById('inpUser').value.trim();
    const p = document.getElementById('inpPass').value.trim();
    const btn = document.getElementById('btnLogin');
    const msg = document.getElementById('loginMsg');
    
    if(!u || !p) return msg.innerText = "لطفا نام کاربری و رمز را وارد کنید";
    
    btn.classList.add('btn-loading'); btn.innerText = "درحال بررسی..."; msg.innerText = "";

    try {
        const res = await fetch(API_URL, {
            method: 'POST', headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: 'login', username: u, password: p })
        });
        const data = await res.json();
        
        if(data.status === 'success') {
            const userData = { username: u, password: p, displayName: data.displayName, jsonData: data.jsonData };
            localStorage.setItem(DB_KEY + 'creds', JSON.stringify(userData));
            currentUser = userData;
            
            if(typeof SyncManager !== 'undefined') SyncManager.init(u, p);
            RankSystem.init(data.jsonData);
            RankSystem.updateNotifications(data.notifications);
            
            document.getElementById('displayName').innerText = data.displayName;
            showScreen('screen-library');
            fetchPlaylist();
            fetchExamsForHistory();
            RankSystem.loadWallOfFame();

        } else { msg.innerText = data.message || "خطا در ورود"; }
    } catch(e) { msg.innerText = "خطا در اتصال به سرور."; }
    btn.classList.remove('btn-loading'); btn.innerText = "ورود امن 🔐";
}

function logout() {
    if(confirm("خروج از حساب کاربری؟")) {
        localStorage.removeItem(DB_KEY + 'creds');
        location.reload();
    }
}

function showScreen(id) {
    document.querySelectorAll('.card').forEach(c => c.classList.remove('active'));
    const target = document.getElementById(id);
    target.classList.add('active');
    setTimeout(() => target.classList.add('show-content'), 50);
}

// --- 3. مدیریت محتوا ---
async function fetchPlaylist() {
    const listContainer = document.getElementById('video-list-container');
    // اگر لیست خالی بود لودینگ نشان بده
    if(!playlist.length) listContainer.innerHTML = `<div style="text-align:center; padding:20px;"><div class="spinner" style="margin:0 auto;"></div><p style="color:#7f8c8d; margin-top:10px;">در حال دریافت درس‌ها...</p></div>`;
    try {
        const res = await fetch(`${API_URL}?t=${Date.now()}`, { method: 'POST', headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: 'get_lessons' }) });
        const result = await res.json();
        if(result.status === 'success') {
            playlist = result.data.reverse(); 
            renderList();
        } 
    } catch (err) { 
        if(!playlist.length) listContainer.innerHTML = `<div style="text-align:center; padding:20px; color:#c0392b;"><p>⚠️ عدم دسترسی به اینترنت</p></div>`;
    }
}

function renderList() {
    const list = document.getElementById('video-list-container');
    list.innerHTML = "";
    if(!playlist || playlist.length === 0) { list.innerHTML = "<p style='text-align:center;'>📭 درسی یافت نشد.</p>"; return; }
    playlist.forEach(item => {
        const isCompleted = RankSystem.data.completed.includes(item.id.toString());
        const icon = isCompleted ? '✅' : '▶️';
        const hasFile = (item.attach && item.attach.length > 3);
        // تیک جدید
        const newTag = item.is_new ? `<div class="new-badge">🆕 جدید</div>` : '';
        
        const el = document.createElement('div');
        el.className = `video-item ${isCompleted ? 'done' : ''}`;
        el.onclick = () => playVideo(item);
        el.innerHTML = `${newTag}<div class="video-icon">${icon}</div><div class="video-info"><h4>${item.title}</h4><div style="font-size:0.8rem; color:#7f8c8d;">${isCompleted ? 'تکمیل شد' : 'برای مشاهده کلیک کنید'}${hasFile ? ' | 📎 فایل ضمیمه' : ''}</div></div>`;
        list.appendChild(el);
    });
}

// --- 🌟 بخش تاریخچه و پرونده (اصلاح شده) ---
async function fetchExamsForHistory() {
    try {
        const res = await fetch(`${API_URL}?t=${Date.now()}`, { method: 'POST', headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: 'get_exams' }) });
        const result = await res.json();
        if(result.status === 'success') { allExamsList = result.data; }
    } catch(e) {}
}

function openHistory() {
    document.getElementById('historyModal').style.display = 'flex';
    const container = document.getElementById('historyListContainer');
    container.innerHTML = '';
    
    // 🚀 FIX: خواندن مستقیم از حافظه (حل مشکل تاخیر نمایش بعد از آزمون)
    const details = RankSystem.data.exam_details || {};
    const takenIds = Object.keys(details);
    
    if(takenIds.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:#999; margin-top:20px;">هنوز در آزمونی شرکت نکرده‌اید.</p>';
        return;
    }

    takenIds.reverse(); 

    takenIds.forEach(eid => {
        // 🚀 حذف آزمون‌های پاک شده (اگر در لیست سرور نباشد)
        const examInfo = allExamsList.find(e => String(e.id) === String(eid));
        if (!examInfo) return; // اگر آزمون توسط مدیر پاک شده، اینجا هم نشان نده

        const examDetail = details[eid];
        const title = examInfo.title;
        const date = examDetail.date || "تاریخ نامشخص";
        const score = parseFloat(examDetail.score || 0);
        
        // 📊 تبدیل نمره به توصیفی
        let quality = "نیاز به تلاش";
        let badgeColor = "#e74c3c";
        
        if(score >= 20) { quality = "خیلی خوب (فوق‌العاده)"; badgeColor = "#8e44ad"; }
        else if(score >= 17) { quality = "خیلی خوب"; badgeColor = "#2ecc71"; }
        else if(score >= 12) { quality = "خوب"; badgeColor = "#2980b9"; }
        else if(score >= 8) { quality = "قابل قبول"; badgeColor = "#f1c40f"; }

        const div = document.createElement('div');
        div.style.background = "white";
        div.style.border = "1px solid #eee";
        div.style.borderRadius = "12px";
        div.style.padding = "15px";
        div.style.display = "flex";
        div.style.justifyContent = "space-between";
        div.style.alignItems = "center";
        div.style.boxShadow = "0 2px 5px rgba(0,0,0,0.05)";
        div.style.borderRight = `5px solid ${badgeColor}`;
        div.style.marginBottom = "10px";
        
        div.innerHTML = `
            <div class="h-info">
                <div style="font-weight: bold; color: #2c3e50; font-size: 0.95rem; margin-bottom: 3px;">${title}</div>
                <div style="font-size: 0.75rem; color: #95a5a6;">${date}</div>
            </div>
            <div style="display:flex; align-items:center;">
                <button onclick="goToReview('${eid}')" style="background: #ecf0f1; border: none; padding: 5px 10px; border-radius: 8px; cursor: pointer; font-size: 0.8rem; margin-left: 10px; color: #2c3e50;">🔍 مرور</button>
                <div style="font-weight: bold; padding: 5px 10px; border-radius: 8px; font-size: 0.8rem; text-align: center; background:${badgeColor}; color:white;">${quality}</div>
            </div>
        `;
        container.appendChild(div);
    });
}

function goToReview(examId) {
    // ذخیره برای مرور
    window.location.href = `azmoon.html?mode=history_review&target=${examId}`;
}

// --- 4. نمایش اعلانات ---
function showNotifications() {
    document.getElementById('notifModal').style.display = 'flex';
    document.getElementById('notifDot').style.display = 'none'; 
    if(typeof RankSystem !== 'undefined') RankSystem.markNotifsAsRead();
    
    const container = document.getElementById('notifListContainer');
    container.innerHTML = '';
    const list = RankSystem.notifications || [];
    
    if(list.length === 0) {
        container.innerHTML = '<p style="color:#999; text-align:center;">پیام جدیدی نیست.</p>';
    } else {
        list.forEach(n => {
            const content = n.text.replace(/(https?:\/\/[^\s]+)/g, (url) => {
                if(url.match(/\.(jpeg|jpg|gif|png)$/) != null) return `<img src="${url}" onclick="openLightbox('${url}')" style="max-width:100%; border-radius:8px; margin-top:5px; cursor:zoom-in;">`;
                return `<a href="${url}" target="_blank">${url}</a>`;
            });

            const div = document.createElement('div');
            div.className = `notif-item type-${n.type}`;
            div.innerHTML = `<div>${content}</div><div style="font-size:0.7rem; color:#ccc; margin-top:4px;">${n.date}</div>`;
            container.appendChild(div);
        });
    }
}

// --- 5. منطق پلیر (فیکس دکمه بازگشت موبایل) ---

// 🚀 FIX: هندل کردن دکمه Back گوشی
window.addEventListener('popstate', (event) => {
    if (document.getElementById('screen-player').classList.contains('active')) {
        closePlayer(); // فقط پلیر را ببند
    }
});

function playVideo(item) {
    // اضافه کردن State به مرورگر تا دکمه Back کار کند
    history.pushState({ page: 'player' }, "Player", "#player");
    
    activeVid = item;
    document.getElementById('videoTitle').innerText = item.title;
    isDone = RankSystem.data.completed.includes(item.id.toString());
    vid.src = item.link;
    lastActivityTime = Date.now();
    
    const dlContainer = document.getElementById('downloadContainer');
    dlContainer.innerHTML = ""; 
    if(item.attach && item.attach.length > 3) {
        item.attach.split(',').forEach((f, idx) => {
            const parts = f.split('|');
            const name = parts[0] || `فایل ${idx+1}`;
            const link = parts[1] || f;
            if(link.length > 5) dlContainer.innerHTML += `<a href="${link}" target="_blank" class="download-btn"><div style="display:flex;align-items:center;"><span class="dl-icon">📥</span><span class="dl-text">${name}</span></div><span class="dl-arrow">دریافت</span></a>`;
        });
    }
    
    const serverLastTime = RankSystem.getLastPosition(item.id);
    maxTime = isDone ? 999999 : serverLastTime;
    
    nextCheckTime = (isDone ? 999999 : (maxTime + CHECK_INTERVAL));
    showScreen('screen-player');
    
    if(isDone) { updateProgressUI(100); document.getElementById('viewStatus').innerText = "تکمیل شد! ✅"; document.getElementById('viewPercent').innerText = "۱۰۰٪"; } 
    else { document.getElementById('viewStatus').innerText = "در حال تماشا..."; updateProgressUI(0); }
    
    if(serverLastTime > 5 && !isDone) { 
        if(confirm("ادامه پخش از جای قبلی؟")) vid.currentTime = serverLastTime; else vid.currentTime = 0; 
    } else vid.currentTime = 0;
    
    SyncManager.addToQueue('report', { lesson: item.title, status: 'شروع درس', details: 'ورود به پلیر', device: getDeviceInfo() });
}

function closePlayer() {
    vid.pause();
    if(document.fullscreenElement) document.exitFullscreen();
    SyncManager.addToQueue('report', { lesson: activeVid ? activeVid.title : '?', status: 'خروج', details: `تا دقیقه ${Math.floor(vid.currentTime/60)}`, device: getDeviceInfo() });
    renderList(); 
    showScreen('screen-library');
    
    // اگر در URL هشتگ #player مانده بود پاکش کن (بدون رفرش)
    if(window.location.hash === '#player') {
        history.replaceState(null, null, ' ');
    }
}

function togglePlay() {
    if(vid.paused) vid.play(); else vid.pause();
    updatePlayBtn();
}
function updatePlayBtn() { document.getElementById('playBtn').innerText = vid.paused ? '▶️' : '⏸️'; }
vid.addEventListener('play', updatePlayBtn);
vid.addEventListener('pause', updatePlayBtn);
vid.addEventListener('click', togglePlay);

function toggleFullScreen() {
    if (!document.fullscreenElement) {
        if(container.requestFullscreen) container.requestFullscreen();
        else if(container.webkitRequestFullscreen) container.webkitRequestFullscreen();
    } else { if(document.exitFullscreen) document.exitFullscreen(); }
}

pContainer.addEventListener('mousedown', startDrag);
pContainer.addEventListener('touchstart', startDrag, {passive: false});
document.addEventListener('mousemove', doDrag);
document.addEventListener('touchmove', doDrag, {passive: false});
document.addEventListener('mouseup', endDrag);
document.addEventListener('touchend', endDrag);

function startDrag(e) { isDragging = true; vid.pause(); doDrag(e); }
function doDrag(e) {
    if (!isDragging) return;
    e.preventDefault();
    const rect = pContainer.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    let percent = (clientX - rect.left) / rect.width;
    if (percent < 0) percent = 0; if (percent > 1) percent = 1;
    let targetTime = percent * vid.duration;
    if (targetTime > maxTime + 2 && !isDone) { targetTime = maxTime; percent = maxTime / vid.duration; document.getElementById('cheatAlert').style.display = 'block'; setTimeout(() => document.getElementById('cheatAlert').style.display = 'none', 1000); }
    updateProgressUI(percent * 100);
    const m = Math.floor(targetTime / 60); const s = Math.floor(targetTime % 60);
    document.getElementById('timeDisplay').innerText = `${m}:${s < 10 ? '0'+s : s}`;
    pContainer.dataset.targetTime = targetTime;
}
function endDrag(e) {
    if (!isDragging) return;
    isDragging = false;
    const targetTime = parseFloat(pContainer.dataset.targetTime || vid.currentTime);
    vid.currentTime = targetTime;
    vid.play();
}
function updateProgressUI(percent) { pBar.style.width = percent + "%"; pThumb.style.left = percent + "%"; }

vid.addEventListener('timeupdate', () => {
    if (isDragging) return;
    const percent = (vid.currentTime / vid.duration) * 100;
    if(!isNaN(percent)) { updateProgressUI(percent); document.getElementById('viewPercent').innerText = toPersianNum(Math.floor(percent)) + "٪"; }
    const m = Math.floor(vid.currentTime / 60); const s = Math.floor(vid.currentTime % 60);
    document.getElementById('timeDisplay').innerText = `${m}:${s < 10 ? '0'+s : s}`;
    
    if(!vid.seeking && vid.currentTime > maxTime) { 
        maxTime = vid.currentTime; 
        RankSystem.savePosition(activeVid.id, vid.currentTime); 
    }
    
    if(!isDone && vid.currentTime > nextCheckTime) triggerSecurityCheck();
    if(vid.duration && percent >= 98 && !isDone) finishLesson();
});

function triggerSecurityCheck() {
    vid.pause();
    const n1 = Math.floor(Math.random()*10)+1; const n2 = Math.floor(Math.random()*10)+1;
    window.securityResult = n1 + n2; 
    document.getElementById('mathQ').innerText = `${toPersianNum(n1)} + ${toPersianNum(n2)} = ؟`;
    document.getElementById('mathAns').value = "";
    document.getElementById('securityModal').style.display = 'flex';
    let timeLeft = 60;
    document.getElementById('timerDisplay').innerText = toPersianNum(timeLeft);
    if(timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        timeLeft--;
        document.getElementById('timerDisplay').innerText = toPersianNum(timeLeft);
        if(timeLeft <= 0) { clearInterval(timerInterval); punishUser(); }
    }, 1000);
}

function checkSecurityAnswer() {
    function toEn(s) { return s.replace(/[۰-۹]/g, d => "۰۱۲۳۴۵۶۷۸۹".indexOf(d)); }
    if(parseInt(toEn(document.getElementById('mathAns').value)) === window.securityResult) {
        clearInterval(timerInterval); document.getElementById('securityModal').style.display = 'none'; nextCheckTime = vid.currentTime + CHECK_INTERVAL; vid.play();
    } else { document.getElementById('mathAns').style.borderColor = 'red'; }
}

function punishUser() {
    document.getElementById('securityModal').style.display = 'none'; 
    alert("⏰ زمان تمام شد! بازگشت به عقب."); 
    let penaltyTime = Math.max(0, vid.currentTime - 400); 
    vid.currentTime = penaltyTime; 
    maxTime = penaltyTime; 
    RankSystem.savePosition(activeVid.id, penaltyTime, true); 
}

// 🟢 تابع اصلاح شده و صحیح پایان درس
function finishLesson() {
    if (isDone) return;
    isDone = true;
    vid.pause();

    // Exit fullscreen first
    if (document.fullscreenElement) document.exitFullscreen();
    if (document.webkitExitFullscreen) document.webkitExitFullscreen();

    document.getElementById('viewStatus').innerText = "تکمیل شد! ✅";

    // Queue reward (Server now gives 0 gems for lessons, handled by backend)
    SyncManager.addToQueue('claim_reward', { reward_type: 'lesson', reward_id: activeVid.id });

    // Launch Confetti
    setTimeout(() => {
        launchConfetti();
    }, 300);
}

function openLightbox(src) {
    document.getElementById('lightboxImg').src = src;
    document.getElementById('lightbox').style.display = 'flex';
}

let fadeTimer;
container.addEventListener('mousemove', () => {
    document.getElementById('controlsBar').classList.remove('fade-out'); clearTimeout(fadeTimer); fadeTimer = setTimeout(() => { if(!vid.paused && !isDragging) document.getElementById('controlsBar').classList.add('fade-out'); }, 3000);
});

// 🌟 تابع جشن مستقل (کانفتی) - کپی شده از فایل آزمون
function launchConfetti() {
    const c = document.getElementById('confetti-canvas');
    if (!c) return;
    
    const ctx = c.getContext('2d');
    c.style.display = 'block';
    c.width = window.innerWidth;
    c.height = window.innerHeight;
    
    const pieces = [];
    for(let i=0; i<300; i++) { // تعداد ذرات مثل آزمون
        pieces.push({
            x: Math.random() * c.width,
            y: Math.random() * c.height - c.height,
            rotation: Math.random() * 360,
            color: `hsl(${Math.random() * 360}, 100%, 50%)`,
            speed: Math.random() * 4 + 2
        });
    }

    let animationId;
    function draw() {
        ctx.clearRect(0, 0, c.width, c.height);
        pieces.forEach(p => {
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
            ctx.fill();
            p.y += p.speed;
            p.rotation += 2;
            if(p.y > c.height) p.y = -10;
        });
        animationId = requestAnimationFrame(draw);
    }
    draw();
    
    // توقف بعد از ۶ ثانیه
    setTimeout(() => {
        cancelAnimationFrame(animationId);
        c.style.display = 'none';
    }, 6000);
}
// 🛑 توقف خودکار فیلم هنگام خروج از صفحه
document.addEventListener("visibilitychange", function() {
    if (document.hidden) {
        vid.pause(); // فیلم را نگه دار
        updatePlayBtn(); // آیکون دکمه را به حالت Play تغییر بده
    }
});