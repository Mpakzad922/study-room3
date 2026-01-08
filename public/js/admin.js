// 🔴 آدرس سرور (لیارا)
const API_URL = "https://chamran-api.liara.run";

let ADMIN_TOKEN = ""; 
let ALL_USERS = [];
let META_EXAMS = {};      
let META_LESSONS = {}; 
let NOTIFICATIONS = [];

function doLogin() {
    const pass = document.getElementById('adminPass').value.trim();
    if(pass.length > 0) {
        // ذخیره موقت رمز
        ADMIN_TOKEN = pass;
        fetchData();
    } else { alert("❌ لطفاً رمز عبور را وارد کنید"); }
}

async function fetchData() {
    document.getElementById('loadingBox').style.display = 'flex';
    try {
        const res = await fetch(API_URL, {
            method: 'POST', headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: 'get_all_users', admin_token: ADMIN_TOKEN })
        });
        const data = await res.json();
        
        if(data.status === 'success') {
            document.getElementById('loginScreen').style.display = 'none';
            document.getElementById('mainApp').style.display = 'block';
            
            ALL_USERS = data.users.map(u => {
                try { u.parsedData = JSON.parse(u.json); } catch(e) { u.parsedData = {}; }
                return u;
            });
            if(data.meta) {
                META_EXAMS = data.meta.exams || {};
                META_LESSONS = data.meta.lessons || {};
            }
            NOTIFICATIONS = data.notifications || [];
            
            processData();
            document.getElementById('lastUpdate').innerText = 'بروزرسانی: ' + new Date().toLocaleTimeString('fa-IR');
        } else { 
            alert("⛔ " + data.message); 
            if(document.getElementById('mainApp').style.display === 'block') location.reload();
        }
    } catch(e) { console.error(e); alert("❌ خطای ارتباط با سرور"); }
    document.getElementById('loadingBox').style.display = 'none';
}

function processData() {
    renderUsersList(ALL_USERS);
    renderLessonsStats();
    renderExamsStats();
    renderRanking();
    renderManageTable();
    renderNotifications();
}

function switchTab(tabId) {
    document.querySelectorAll('.section').forEach(el => el.classList.remove('active'));
    document.getElementById('tab-'+tabId).classList.add('active');
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    event.currentTarget.classList.add('active');
}

function downloadBackup() {
    if(!ALL_USERS || ALL_USERS.length === 0) return alert("داده‌ای برای ذخیره وجود ندارد.");
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(ALL_USERS, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "chamran_backup_" + new Date().toLocaleDateString('fa-IR').replace(/\//g,'-') + ".json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
}

// --- (1) لیست کاربران (با وضعیت آنلاین) ---
function renderUsersList(users) {
    const container = document.getElementById('usersList');
    container.innerHTML = '';
    if(users.length === 0) { container.innerHTML = '<p style="text-align:center;color:#777">کاربری یافت نشد.</p>'; return; }
    
    const now = Date.now();

    users.forEach(u => {
        const div = document.createElement('div');
        div.className = 'card user-card';
        div.onclick = () => showUserDetail(u);
        
        const role = u.parsedData.rank || 'نوآموز';
        const xp = u.parsedData.xp || 0;
        const gem = u.parsedData.gem || 0;
        
        // محاسبه وضعیت آنلاین
        const lastTs = u.ts || 0;
        const diff = (now - lastTs) / 1000 / 60; // دقیقه
        let statusHtml = '';
        
        if(diff < 10) statusHtml = '<span class="status-dot st-online"></span> <span style="font-size:0.7rem; color:#2ecc71">آنلاین</span>';
        else if(diff < 60) statusHtml = '<span class="status-dot st-recent"></span> <span style="font-size:0.7rem; color:#f39c12">همین الان</span>';
        else statusHtml = `<span class="status-dot st-offline"></span> <span style="font-size:0.7rem; color:#95a5a6">${u.last || 'قدیمی'}</span>`;

        div.innerHTML = `
            <div>
                <div style="font-weight:bold; color:#2c3e50;">${u.n} ${statusHtml}</div>
                <div style="font-size:0.8rem; color:#7f8c8d;">${u.u}</div>
            </div>
            <div style="text-align:left;">
                <span class="badge bg-gem">${gem} 💎</span>
                <span class="badge bg-blue">${xp} XP</span>
                <div style="font-size:0.7rem; color:#95a5a6; margin-top:5px;">${role}</div>
            </div>`;
        container.appendChild(div);
    });
}

function filterUsers() {
    const q = document.getElementById('searchBox').value.toLowerCase();
    renderUsersList(ALL_USERS.filter(u => u.n.includes(q) || u.u.toLowerCase().includes(q)));
}

// --- (2) پروفایل و جزئیات (با نمایش گزارش غلط) ---
function showUserDetail(user) {
    document.getElementById('modalTitle').innerText = user.n;
    const d = user.parsedData;
    const body = document.getElementById('modalBody');
    
    // جدول آزمون‌ها
    let examsHtml = '<table><tr><th>نام آزمون</th><th>وضعیت/غلط‌ها</th><th>عملیات</th></tr>';
    Object.keys(META_EXAMS).forEach(eid => {
        const info = META_EXAMS[eid]; const title = info.title || info;
        let statusHtml = '<span style="color:red; font-size:0.8rem;">❌ غایب</span>';
        let opHtml = '-';
        
        if(d.exams && d.exams[eid] !== undefined) {
            const score = d.exams[eid];
            const color = score >= 17 ? 'green' : (score < 10 ? 'red' : 'black');
            
            // 🆕 بررسی جزئیات غلط
            let detailText = "";
            if(d.exam_details && d.exam_details[eid] && d.exam_details[eid].wrong) {
                const wrongs = d.exam_details[eid].wrong;
                detailText = wrongs.length > 0 ? `<br><small style="color:red">غلط‌ها: سوال ${wrongs.join('، ')}</small>` : `<br><small style="color:green">✨ بدون غلط</small>`;
            } else {
                detailText = `<br><small style="color:#aaa">جزئیات موجود نیست</small>`;
            }

            statusHtml = `<span style="font-weight:bold; color:${color}; font-size:1.1rem;">${score}</span>${detailText}`;
            opHtml = `<button class="op-btn" onclick="performAdminOp('reset_exam', '${user.u}', '${eid}')">♻️ ریست</button>`;
        }
        examsHtml += `<tr><td style="text-align:right;">${title}</td><td>${statusHtml}</td><td>${opHtml}</td></tr>`;
    });
    examsHtml += '</table>';

    // جدول درس‌ها (مثل قبل)
    let lessonsHtml = '<table><tr><th>نام درس</th><th>وضعیت</th><th>عملیات</th></tr>';
    Object.keys(META_LESSONS).forEach(lid => {
        const title = META_LESSONS[lid];
        const sLid = lid.toString();
        const isCompleted = d.completed && d.completed.includes(sLid);
        const playTime = (d.playback && d.playback[sLid]) ? parseInt(d.playback[sLid]) : 0;
        
        let statusHtml = '';
        let barWidth = '0%';
        let barColor = '#eee';

        if (isCompleted) {
            statusHtml = '<span style="color:#27ae60; font-weight:bold; font-size:0.85rem;">✅ کامل</span>';
            barWidth = '100%'; barColor = '#27ae60';
        } else if (playTime > 0) {
            const mins = Math.floor(playTime / 60);
            statusHtml = `<span style="color:#e67e22; font-weight:bold; font-size:0.85rem;">⏸ دقیقه‌ ${mins}</span>`;
            barWidth = '50%'; barColor = '#e67e22';
        } else {
            statusHtml = '<span style="color:#95a5a6; font-size:0.8rem;">⚪ شروع نشده</span>';
        }
        
        const barHtml = `<div style="width:100%; background:#f1f1f1; height:6px; border-radius:3px; margin-top:5px;"><div style="width:${barWidth}; background:${barColor}; height:100%; border-radius:3px;"></div></div>`;
        const displayCell = `<div>${statusHtml}${barHtml}</div>`;
        let opHtml = (isCompleted || playTime > 0) ? `<button class="op-btn" onclick="performAdminOp('reset_video', '${user.u}', '${lid}')">♻️ ریست</button>` : '-';
        lessonsHtml += `<tr><td style="text-align:right;">${title}</td><td>${displayCell}</td><td>${opHtml}</td></tr>`;
    });
    lessonsHtml += '</table>';

    // هدر مدال با دکمه‌های الماس
    body.innerHTML = `
        <div class="detail-header">
            <div style="display:flex; justify-content:center; gap:20px; margin-bottom:15px;">
                <div><div style="font-size:1.5rem; font-weight:bold; color:#f39c12;">${d.xp || 0}</div><small>XP</small></div>
                <div><div style="font-size:1.5rem; font-weight:bold; color:#9b59b6;">${d.gem || 0}</div><small>الماس</small></div>
            </div>
            <div style="display:flex; justify-content:center; gap:5px; flex-wrap:wrap;">
                <button onclick="performAdminOp('give_xp', '${user.u}')" style="background:#3498db; color:white; border:none; padding:6px 10px; border-radius:8px; cursor:pointer; font-size:0.8rem;">+XP</button>
                <button onclick="performAdminOp('take_xp', '${user.u}')" style="background:#e74c3c; color:white; border:none; padding:6px 10px; border-radius:8px; cursor:pointer; font-size:0.8rem;">-XP</button>
                <button onclick="performAdminOp('give_gem', '${user.u}')" style="background:#9b59b6; color:white; border:none; padding:6px 10px; border-radius:8px; cursor:pointer; font-size:0.8rem;">+💎</button>
                <button onclick="performAdminOp('take_gem', '${user.u}')" style="background:#8e44ad; color:white; border:none; padding:6px 10px; border-radius:8px; cursor:pointer; font-size:0.8rem;">-💎</button>
                <button onclick="performAdminOp('ban_user', '${user.u}')" style="background:#34495e; color:white; border:none; padding:6px 10px; border-radius:8px; cursor:pointer; font-size:0.8rem;">🚫 مسدود</button>
            </div>
        </div>
        <h4 style="color:#8e44ad;">📝 وضعیت آزمون‌ها</h4>${examsHtml}
        <h4 style="color:#27ae60; margin-top:30px;">🎬 وضعیت درس‌ها</h4>${lessonsHtml}
    `;
    document.getElementById('detailModal').style.display = 'flex';
}
function closeModal() { document.getElementById('detailModal').style.display = 'none'; }

async function performAdminOp(type, username, itemId) {
    let body = { action: 'admin_op', admin_token: ADMIN_TOKEN, target_user: username, op_type: type };
    
    if(type === 'give_xp' || type === 'give_gem') { 
        const amt = prompt("مقدار را وارد کنید:"); 
        if(!amt) return; body.amount = amt; 
    } 
    else if(type === 'take_xp' || type === 'take_gem') { 
        const amt = prompt("مقدار کسر را وارد کنید:"); 
        if(!amt) return; 
        body.amount = -1 * Math.abs(parseInt(amt)); 
        body.op_type = (type === 'take_xp') ? 'give_xp' : 'give_gem'; 
    }
    else if(type.includes('reset') || type === 'ban_user') { 
        if(!confirm("آیا مطمئن هستید؟")) return; 
        if(type.includes('reset')) body[type === 'reset_exam' ? 'exam_id' : 'video_id'] = itemId; 
    }

    try {
        const res = await fetch(API_URL, { method: 'POST', headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        const d = await res.json();
        if(d.status === 'success') { alert("✅ انجام شد."); fetchData(); closeModal(); } else { alert("❌ " + d.message); }
    } catch(e) { alert("خطا"); }
}

// --- (3) آمار کلی ---
function renderExamsStats() {
    const container = document.getElementById('examsStats'); container.innerHTML = '';
    Object.keys(META_EXAMS).forEach(eid => {
        const info = META_EXAMS[eid]; const title = info.title || info; const pass = info.pass || '-';
        let count = 0; let sum = 0; let participants = []; let absents = [];

        ALL_USERS.forEach(u => {
            const d = u.parsedData;
            if(d.exams && d.exams[eid] !== undefined) { 
                count++; 
                sum += parseFloat(d.exams[eid]); 
                const score = d.exams[eid];
                const color = score >= 17 ? 'green' : (score < 10 ? 'red' : 'black');
                participants.push(`<div class="st-row"><span>${u.n}</span><span class="st-score" style="color:${color}">${score}</span></div>`); 
            }
            else { absents.push(`<div class="st-row"><span>${u.n}</span><span style="color:#aaa">غایب</span></div>`); }
        });
        const avg = count > 0 ? (sum / count).toFixed(1) : 0;

        const div = document.createElement('div');
        div.className = 'card lesson-card';
        div.style.borderRightColor = '#8e44ad';
        div.onclick = function(e) { 
            if(!e.target.classList.contains('del-btn-exam')) { 
                const lc=this.querySelector('.student-list-container'); 
                lc.style.display=(lc.style.display==='none'||!lc.style.display)?'block':'none'; 
            } 
        };
        
        div.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div style="display:flex; align-items:center; gap:10px;">
                    <button class="del-btn-exam" onclick="deleteExam('${eid}', '${title}')" style="background:#fee; color:red; border:1px solid red; border-radius:5px; cursor:pointer;">🗑️</button>
                    <div><strong>${title}</strong><br><span style="font-size:0.8rem; background:#eee; padding:2px 5px; border-radius:4px;">رمز: ${pass}</span></div>
                </div>
                <span class="badge" style="background:#8e44ad">${count} نفر</span>
            </div>
            <div style="margin-top:5px; font-size:0.9rem;">میانگین نمرات: <b>${avg}</b></div>
            <div class="student-list-container">
                <div style="color:#27ae60; font-weight:bold; margin-bottom:5px;">✅ شرکت‌کنندگان:</div>
                ${participants.length ? participants.join('') : '<small>هیچکس</small>'}
                <div style="color:#c0392b; font-weight:bold; margin-top:15px; margin-bottom:5px;">❌ غایبین:</div>
                ${absents.length ? absents.join('') : '<small>همه شرکت کردند</small>'}
            </div>`;
        container.appendChild(div);
    });
}

function renderLessonsStats() {
    const container = document.getElementById('lessonsStats'); container.innerHTML = '';
    Object.keys(META_LESSONS).forEach(lid => {
        const title = META_LESSONS[lid]; let count = 0; let seen = []; let notSeen = [];
        ALL_USERS.forEach(u => {
            if(u.parsedData.completed && u.parsedData.completed.includes(lid.toString())) { 
                count++; 
                seen.push(`<div class="st-row"><span>${u.n}</span><span style="color:green">✔</span></div>`); 
            } else { 
                notSeen.push(`<div class="st-row"><span>${u.n}</span><span style="color:red">✖</span></div>`); 
            }
        });
        const percent = Math.round((count/ALL_USERS.length)*100)||0;
        const div = document.createElement('div');
        div.className = 'card lesson-card';
        div.style.borderRightColor = '#e67e22';
        div.onclick = function(e) { 
            if(!e.target.classList.contains('del-btn-lesson')) { 
                const lc=this.querySelector('.student-list-container'); 
                lc.style.display=(lc.style.display==='none'||!lc.style.display)?'block':'none'; 
            } 
        };
        
        div.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div style="display:flex; align-items:center; gap:10px;">
                    <button class="del-btn-lesson" onclick="deleteLesson('${lid}', '${title}')" style="background:#fee; color:red; border:1px solid red; border-radius:5px; cursor:pointer;">🗑️</button>
                    <strong>${title}</strong>
                </div>
                <span class="badge" style="background:#e67e22">${count}/${ALL_USERS.length}</span>
            </div>
            <div style="background:#eee; height:8px; border-radius:4px; margin-top:10px;"><div style="background:#e67e22; width:${percent}%; height:100%;"></div></div>
            <div class="student-list-container">
                <div style="color:#27ae60; font-weight:bold;">✅ مشاهده کامل:</div>
                ${seen.length ? seen.join('') : '<small>هیچکس</small>'}
                <div style="color:#c0392b; font-weight:bold; margin-top:15px;">❌ مشاهده نشده:</div>
                ${notSeen.length ? notSeen.join('') : '<small>همه دیده‌اند</small>'}
            </div>`;
        container.appendChild(div);
    });
}

async function deleteLesson(lid, title) { if(!confirm(`حذف درس "${title}"؟\n⛔ سوابق همه پاک می‌شود!`)) return; callDeleteApi('delete_lesson_global', { lesson_id: lid }); }
async function deleteExam(eid, title) { if(!confirm(`حذف آزمون "${title}"؟\n⛔ نمرات همه پاک می‌شود!`)) return; callDeleteApi('delete_exam_global', { exam_id: eid }); }
async function callDeleteApi(actionName, payload) {
    document.getElementById('loadingBox').style.display = 'flex';
    try {
        payload.action = actionName; payload.admin_token = ADMIN_TOKEN;
        const res = await fetch(API_URL, { method: 'POST', headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        if((await res.json()).status === 'success') { alert("✅ حذف شد."); fetchData(); } else alert("خطا");
    } catch(e) { alert("خطا"); }
    document.getElementById('loadingBox').style.display = 'none';
}

function renderRanking() {
    const container = document.getElementById('rankingList'); container.innerHTML = '';
    [...ALL_USERS].sort((a,b)=>(b.parsedData.xp||0)-(a.parsedData.xp||0)).slice(0,10).forEach((u,i)=>{
        container.innerHTML += `<div class="card" style="display:flex;justify-content:space-between;"><div>#${i+1} <b>${u.n}</b></div><span class="badge bg-gold">${u.parsedData.xp||0} XP</span></div>`;
    });
}

// --- (4) مدیریت جدول (همراه با دکمه حذف جدید) ---
function renderManageTable() {
    const tbody = document.getElementById('manageTableBody');
    tbody.innerHTML = '';
    ALL_USERS.forEach(u => {
        const tr = document.createElement('tr');
        const uid = u.u.replace(/[^a-zA-Z0-9]/g, '_'); 
        tr.innerHTML = `
            <td><input id="nm_${uid}" value="${u.n}" class="manage-input"></td>
            <td><input id="usr_${uid}" value="${u.u}" class="manage-input" style="direction:ltr"></td>
            <td><input id="pwd_${uid}" value="${u.p}" class="manage-input" style="direction:ltr"></td>
            <td><input id="xp_${uid}" type="number" value="${u.parsedData.xp || 0}" class="manage-input" style="direction:ltr"></td>
            <td style="display:flex; justify-content:center; gap:5px;">
                <button class="save-row-btn" onclick="saveUserRow('${u.u}', '${uid}')" title="ذخیره">💾</button>
                <button class="del-row-btn" onclick="deleteUser('${u.u}')" title="حذف">🗑️</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function saveUserRow(originalUsername, uid) {
    const newName = document.getElementById('nm_' + uid).value;
    const newUser = document.getElementById('usr_' + uid).value;
    const newPass = document.getElementById('pwd_' + uid).value;
    const newXP = document.getElementById('xp_' + uid).value;

    if(!newName || !newUser || !newPass) return alert("نام، نام‌کاربری و رمز نمی‌توانند خالی باشند.");
    if(!confirm(`آیا تغییرات برای "${newName}" ذخیره شود؟`)) return;

    document.getElementById('loadingBox').style.display = 'flex';
    try {
        const res = await fetch(API_URL, {
            method: 'POST', headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                action: 'update_user', 
                admin_token: ADMIN_TOKEN, 
                target_user: originalUsername, 
                new_n: newName,
                new_u: newUser, 
                new_p: newPass,
                new_xp: newXP
            })
        });
        const d = await res.json();
        if(d.status === 'success') { 
            alert("✅ تغییرات با موفقیت ذخیره شد."); 
            fetchData(); 
        } else { alert("❌ خطا: " + d.message); }
    } catch(e) { alert("خطای شبکه"); }
    document.getElementById('loadingBox').style.display = 'none';
}

// --- تابع جدید: حذف کاربر ---
async function deleteUser(username) {
    if(!confirm(`⚠️ هشدار بسیار مهم!\n\nآیا مطمئن هستید که می‌خواهید کاربر "${username}" را حذف کنید؟\n❌ تمام سوابق، نمرات و اکانت این دانش‌آموز پاک می‌شود و قابل برگشت نیست!`)) return;

    document.getElementById('loadingBox').style.display = 'flex';
    try {
        const res = await fetch(API_URL, {
            method: 'POST', headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: 'delete_user', admin_token: ADMIN_TOKEN, target_user: username })
        });
        const d = await res.json();
        if(d.status === 'success') { 
            alert("✅ کاربر با موفقیت حذف شد."); 
            fetchData(); 
        } else { 
            alert("❌ خطا: " + d.message); 
        }
    } catch(e) { alert("خطا در ارتباط با سرور"); }
    document.getElementById('loadingBox').style.display = 'none';
}

function toggleNewUserBox() {
    const box = document.getElementById('newUserBox');
    box.style.display = (box.style.display === 'block') ? 'none' : 'block';
}

async function createUser() {
    const n = document.getElementById('new_n').value;
    const u = document.getElementById('new_u').value;
    const p = document.getElementById('new_p').value;
    if(!n || !u || !p) return alert("همه فیلدها را پر کنید");

    document.getElementById('loadingBox').style.display = 'flex';
    try {
        const res = await fetch(API_URL, {
            method: 'POST', headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: 'create_user', admin_token: ADMIN_TOKEN, new_u: u, new_p: p, new_n: n })
        });
        const d = await res.json();
        if(d.status === 'success') { 
            alert("✅ کاربر جدید ساخته شد"); 
            document.getElementById('newUserBox').style.display = 'none';
            document.getElementById('new_n').value=''; document.getElementById('new_u').value=''; document.getElementById('new_p').value='';
            fetchData(); 
        }
        else alert("❌ " + d.message);
    } catch(e) { alert("خطا"); }
    document.getElementById('loadingBox').style.display = 'none';
}

// --- (5) بخش اعلانات ---
function renderNotifications() {
    const list = document.getElementById('notifHistoryList');
    list.innerHTML = '';
    if(NOTIFICATIONS.length === 0) list.innerHTML = '<p style="color:#aaa">هیچ پیامی ارسال نشده.</p>';
    NOTIFICATIONS.forEach(n => {
        const typeColor = n.type === 'alert' ? 'red' : (n.type === 'success' ? 'green' : 'blue');
        list.innerHTML += `
            <div class="notif-list-item" style="border-right-color:${typeColor}">
                <div>${n.text} <small style="color:#aaa">(${n.date})</small></div>
                <button onclick="deleteNotif('${n.id}')" style="background:#fee; color:red; border:none; padding:5px 10px; border-radius:5px; cursor:pointer;">حذف</button>
            </div>`;
    });
}

async function sendNotification() {
    const txt = document.getElementById('notifTxt').value;
    const type = document.getElementById('notifType').value;
    if(!txt) return alert("متن پیام خالی است");
    
    await fetch(API_URL, {
        method: 'POST', headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: 'save_notification', admin_token: ADMIN_TOKEN, notif_text: txt, notif_type: type })
    });
    document.getElementById('notifTxt').value = '';
    fetchData();
    alert("پیام ارسال شد 🔔");
}

async function deleteNotif(id) {
    if(!confirm("حذف شود؟")) return;
    await fetch(API_URL, {
        method: 'POST', headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: 'delete_notification', admin_token: ADMIN_TOKEN, id: id })
    });
    fetchData();
}