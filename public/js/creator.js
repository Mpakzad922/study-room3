// 🔴 آدرس سرور (لیارا)
const API_URL = "https://chamran-api.liara.run";

let ADMIN_TOKEN = "";
let ALL_DATA = { lessons: [], exams: [] };
let UPLOAD_TARGET_ID = null; 

// متغیرهای حالت ویرایش
let EDIT_MODE = false;
let EDIT_ID = null;

// --- 1. ورود ---
function checkLogin() {
    const t = document.getElementById('adminTokenInput').value.trim();
    if(t) {
        ADMIN_TOKEN = t;
        document.getElementById('loginOverlay').style.display = 'none';
        document.getElementById('mainContainer').style.display = 'block';
        fetchHistory(); // دریافت فوری لیست از سرور
    } else { alert("رمز عبور را وارد کنید"); }
}

// --- 2. مدیریت تب‌ها ---
function switchTab(t) {
    document.querySelectorAll('.section').forEach(e => e.classList.remove('active'));
    document.getElementById('tab-'+t).classList.add('active');
    document.querySelectorAll('.tab-btn').forEach(e => e.classList.remove('active'));
    event.currentTarget.classList.add('active');
}

function toggleForm() {
    const type = document.getElementById('contentType').value;
    document.getElementById('lessonForm').style.display = type === 'lesson' ? 'block' : 'none';
    document.getElementById('examForm').style.display = type === 'exam' ? 'block' : 'none';
}

// --- 3. سیستم آپلود عکس ---
const fileInput = document.getElementById('globalFileInput');
function triggerUpload(targetId) { UPLOAD_TARGET_ID = targetId; fileInput.click(); }

fileInput.addEventListener('change', function() {
    if (this.files && this.files[0]) {
        const file = this.files[0];
        const btn = document.querySelector(`button[onclick="triggerUpload('${UPLOAD_TARGET_ID}')"]`);
        const originalText = btn.innerHTML;
        btn.innerHTML = "⏳...";
        btn.classList.add('upload-loading');

        const reader = new FileReader();
        reader.onload = function(e) {
            fetch(API_URL, {
                method: 'POST', headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: 'upload_file', admin_token: ADMIN_TOKEN, file_data: e.target.result, file_name: file.name })
            })
            .then(res => res.json())
            .then(data => {
                if(data.status === 'success') {
                    document.getElementById(UPLOAD_TARGET_ID).value = API_URL + data.url;
                    btn.innerHTML = "✅"; setTimeout(() => btn.innerHTML = originalText, 2000);
                } else { alert("خطا: " + data.message); btn.innerHTML = "❌"; }
            })
            .catch(err => { alert("خطای شبکه"); btn.innerHTML = originalText; })
            .finally(() => btn.classList.remove('upload-loading'));
        };
        reader.readAsDataURL(file);
    }
    this.value = '';
});

// --- 4. فرم درس ---
function addAttachRow(name='', link='') {
    const div = document.createElement('div');
    div.className = 'row';
    div.innerHTML = `<input class="att-name" placeholder="نام فایل" value="${name}" style="flex:1"><input class="att-link" placeholder="لینک دانلود" value="${link}" dir="ltr" style="flex:2"><button class="btn-del btn-action" onclick="this.parentElement.remove()">🗑️</button>`;
    document.getElementById('attach_container').appendChild(div);
}

async function saveLesson() {
    const title = document.getElementById('l_title').value;
    const link = document.getElementById('l_link').value;
    const isNew = document.getElementById('isNewContent').checked;
    
    const attachRows = document.querySelectorAll('#attach_container .row');
    let attachList = [];
    attachRows.forEach(row => {
        const n = row.querySelector('.att-name').value.trim();
        const l = row.querySelector('.att-link').value.trim();
        if(n && l) attachList.push(`${n}|${l}`);
    });

    if(!title || !link) return alert("❌ عنوان و لینک الزامی است!");

    // تشخیص حالت ویرایش یا جدید
    const action = EDIT_MODE ? 'edit_lesson' : 'save_lesson';
    const payload = { 
        action: action, admin_token: ADMIN_TOKEN, 
        title: title, link: link, attach: attachList.join(','), is_new: isNew 
    };
    if(EDIT_MODE) payload.lesson_id = EDIT_ID;

    const res = await sendReq(payload);
    if(res.status === 'success') { 
        alert(EDIT_MODE ? "✅ درس ویرایش شد!" : "✅ درس ذخیره شد!"); 
        if(EDIT_MODE) cancelEdit(); else { 
            document.getElementById('l_title').value=''; 
            document.getElementById('l_link').value=''; 
            document.getElementById('attach_container').innerHTML=''; 
            document.getElementById('isNewContent').checked = false; 
        }
        fetchHistory();
    } else { alert("❌ خطا: " + res.message); }
}

// --- 5. فرم آزمون (با امتیازهای متغیر) ---
let qCount = 0;
function addQuestion(data = null) {
    qCount++;
    const div = document.createElement('div');
    div.className = 'q-box';
    const qId = `q_${Date.now()}_${Math.random()}`; 

    // مقادیر پیش‌فرض یا مقادیر ویرایش
    const qTxt = data ? data.q : '';
    const qImg = data ? data.img : '';
    const ops = data ? data.options : ['', '', '', ''];
    const correct = data ? (data.correct || data.c) : '1';
    const desc = data ? data.desc : '';
    const descImg = data ? data.desc_img : '';

    const opVals = ops.map(op => {
        const isUrl = op.startsWith('http') || op.startsWith('/uploads');
        return { txt: isUrl ? '' : op, img: isUrl ? op : '' };
    });

    div.innerHTML = `
        <span class="q-num">سوال</span>
        <span class="del-q" onclick="if(confirm('حذف شود؟')) this.parentElement.remove()">حذف</span>
        
        <label>متن و تصویر سوال:</label>
        <div class="upload-group">
            <input class="q-txt" placeholder="صورت سوال..." value="${qTxt}" style="flex:2">
            <input id="${qId}_img" class="q-img" placeholder="لینک عکس" value="${qImg}" dir="ltr" style="flex:1; font-size:0.8rem;">
            <button class="btn-upload" onclick="triggerUpload('${qId}_img')">📤</button>
        </div>

        <label style="margin-top:15px;">گزینه‌ها:</label>
        ${[0, 1, 2, 3].map(i => `
            <div class="opt-row">
                <span class="opt-label">گزینه ${i+1}:</span>
                <div class="upload-group">
                    <input class="op${i+1}" placeholder="متن" value="${opVals[i].txt}">
                    <input id="${qId}_op${i+1}_img" class="op${i+1}-img" placeholder="لینک عکس" value="${opVals[i].img}" dir="ltr" style="width:100px; font-size:0.7rem;">
                    <button class="btn-upload" onclick="triggerUpload('${qId}_op${i+1}_img')">📷</button>
                </div>
            </div>`).join('')}
        
        <div class="row" style="margin-top:10px;">
            <div style="flex:1">
                <label>پاسخ صحیح:</label>
                <select class="correct-ans" style="background:#e8f8f5;">
                    <option value="1" ${correct=='1'?'selected':''}>گزینه ۱</option>
                    <option value="2" ${correct=='2'?'selected':''}>گزینه ۲</option>
                    <option value="3" ${correct=='3'?'selected':''}>گزینه ۳</option>
                    <option value="4" ${correct=='4'?'selected':''}>گزینه ۴</option>
                </select>
            </div>
        </div>

        <div class="explain-box">
            <div class="explain-title">💡 تحلیل و پاسخ تشریحی</div>
            <div class="upload-group">
                <textarea class="exp-txt" rows="2" placeholder="توضیح دهید...">${desc||''}</textarea>
            </div>
            <div class="upload-group" style="margin-top:5px;">
                <input id="${qId}_exp_img" class="exp-img" placeholder="لینک عکس راه‌حل" value="${descImg||''}" dir="ltr">
                <button class="btn-upload" onclick="triggerUpload('${qId}_exp_img')">📤</button>
            </div>
        </div>
    `;
    document.getElementById('questions_area').appendChild(div);
}

async function saveExam() {
    const title = document.getElementById('e_title').value;
    const time = document.getElementById('e_time').value;
    const pass = document.getElementById('e_pass').value;
    const isNew = document.getElementById('isNewContent').checked;
    
    const rEx = document.getElementById('r_excellent').value;
    const rGd = document.getElementById('r_good').value;
    const rNm = document.getElementById('r_normal').value;
    
    const qElements = document.querySelectorAll('.q-box');
    if(!title || qElements.length === 0) return alert("❌ عنوان و حداقل یک سوال الزامی است!");

    const questions = [];
    qElements.forEach(el => {
        questions.push({
            q: el.querySelector('.q-txt').value,
            img: el.querySelector('.q-img').value,
            options: [
                el.querySelector(`.op1-img`).value || el.querySelector('.op1').value,
                el.querySelector(`.op2-img`).value || el.querySelector('.op2').value,
                el.querySelector(`.op3-img`).value || el.querySelector('.op3').value,
                el.querySelector(`.op4-img`).value || el.querySelector('.op4').value
            ],
            correct: el.querySelector('.correct-ans').value,
            desc: el.querySelector('.exp-txt').value,
            desc_img: el.querySelector('.exp-img').value
        });
    });

    const action = EDIT_MODE ? 'edit_exam' : 'save_exam';
    const payload = { 
        action: action, admin_token: ADMIN_TOKEN, 
        title: title, time: time, pass: pass, questions: questions, is_new: isNew,
        rewards: { excellent: rEx, good: rGd, normal: rNm }
    };
    if(EDIT_MODE) payload.exam_id = EDIT_ID;

    const res = await sendReq(payload);
    if(res.status === 'success') { 
        alert(EDIT_MODE ? "✅ آزمون ویرایش شد!" : "✅ آزمون ذخیره شد!"); 
        if(EDIT_MODE) cancelEdit(); else { 
            document.getElementById('questions_area').innerHTML=''; 
            qCount=0; addQuestion(); 
            document.getElementById('e_title').value=''; 
            document.getElementById('isNewContent').checked = false;
        }
        fetchHistory();
    } else { alert("❌ خطا: " + res.message); }
}

// --- 6. مدیریت، تاریخچه و ویرایش (اصلاح شده برای جابجایی بدون ریست) ---
async function fetchHistory() {
    try {
        const r1 = await fetch(API_URL, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({action:'get_lessons'}) });
        const r2 = await fetch(API_URL, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({action:'get_exams'}) });
        const d1 = await r1.json();
        const d2 = await r2.json();
        
        // 🟢 اینجا دیگر .reverse() نداریم تا ترتیب سرور حفظ شود
        if(d1.status === 'success') ALL_DATA.lessons = d1.data;
        if(d2.status === 'success') ALL_DATA.exams = d2.data;
        
        renderHistory();
    } catch(e) {}
}

function renderHistory() {
    const list = document.getElementById('contentList');
    list.innerHTML = '';
    const q = document.getElementById('searchBox').value.toLowerCase();

    // رندر درس‌ها (همراه با دکمه جابجایی)
    ALL_DATA.lessons.forEach((l) => { 
        if(l.title.toLowerCase().includes(q)) {
            list.innerHTML += `
                <div class="history-card" style="border-right-color: var(--accent);">
                    <div class="history-info">
                        <strong>🎬 ${l.title}</strong> ${l.is_new ? '<span class="tag-new">جدید 🔥</span>':''}
                        <br><span style="font-size:0.8rem; color:#777;">${l.date}</span>
                    </div>
                    <div>
                        <button class="btn-move" onclick="moveItem('lesson', '${l.id}', -1)" title="بالا">⬆️</button>
                        <button class="btn-move" onclick="moveItem('lesson', '${l.id}', 1)" title="پایین">⬇️</button>
                        
                        <button class="btn-edit btn-action" onclick='loadForEdit("lesson", ${JSON.stringify(l)})'>✏️ ویرایش</button>
                        <button class="btn-del btn-action" onclick="deleteItem('lesson','${l.id}')">🗑️ حذف</button>
                    </div>
                </div>`;
        }
    });

    // رندر آزمون‌ها (با دکمه‌های جابجایی)
    ALL_DATA.exams.forEach((e) => {
        if(e.title.toLowerCase().includes(q)) {
            const safeData = JSON.stringify(e).replace(/'/g, "&#39;");
            list.innerHTML += `
                <div class="history-card" style="border-right-color: #8e44ad;">
                    <div class="history-info">
                        <strong>📝 ${e.title}</strong> ${e.is_new ? '<span class="tag-new">جدید 🔥</span>':''}
                        <br><span style="font-size:0.8rem; color:#777;">${e.date}</span>
                    </div>
                    <div>
                        <button class="btn-move" onclick="moveItem('exam', '${e.id}', -1)" title="بالا">⬆️</button>
                        <button class="btn-move" onclick="moveItem('exam', '${e.id}', 1)" title="پایین">⬇️</button>

                        <button class="btn-edit btn-action" onclick='loadForEdit("exam", ${safeData})'>✏️ ویرایش</button>
                        <button class="btn-del btn-action" onclick="deleteItem('exam','${e.id}')">🗑️ حذف</button>
                    </div>
                </div>`;
        }
    });
}

// 🔄 تابع جابجایی هوشمند (برای هر دو نوع)
async function moveItem(type, id, direction) {
    // تشخیص آرایه هدف
    const list = type === 'lesson' ? ALL_DATA.lessons : ALL_DATA.exams;
    const index = list.findIndex(i => String(i.id) === String(id));
    
    if (index === -1) return;
    if (direction === -1 && index === 0) return; 
    if (direction === 1 && index === list.length - 1) return;

    // جابجایی
    const temp = list[index];
    list[index] = list[index + direction];
    list[index + direction] = temp;

    renderHistory();
    
    // ارسال به سرور
    await saveOrderToServer(type, list);
}

async function saveOrderToServer(type, list) {
    const action = type === 'lesson' ? 'reorder_lessons' : 'reorder_exams';
    const res = await fetch(API_URL, {
        method: 'POST', headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
            action: action, 
            admin_token: ADMIN_TOKEN, 
            new_list: list 
        })
    });
}

// 🌟 تابع لود کردن برای ویرایش
function loadForEdit(type, item) {
    EDIT_MODE = true;
    EDIT_ID = item.id;
    
    document.getElementById('editModeBadge').style.display = 'block';
    document.getElementById('editTargetName').innerText = item.title;
    
    switchTab('create');
    document.getElementById('contentType').value = type;
    toggleForm();

    document.getElementById('isNewContent').checked = item.is_new || false;

    if(type === 'lesson') {
        document.getElementById('l_title').value = item.title;
        document.getElementById('l_link').value = item.link;
        document.getElementById('attach_container').innerHTML = '';
        if(item.attach && item.attach.length > 0) {
            item.attach.split(',').forEach(att => {
                const parts = att.split('|');
                addAttachRow(parts[0], parts[1]);
            });
        }
        document.getElementById('btnSaveLesson').innerText = "🔄 بروزرسانی درس";
    } else {
        document.getElementById('e_title').value = item.title;
        document.getElementById('e_time').value = item.time;
        document.getElementById('e_pass').value = item.pass || '';
        
        if(item.rewards) {
            document.getElementById('r_excellent').value = item.rewards.excellent || 300;
            document.getElementById('r_good').value = item.rewards.good || 100;
            document.getElementById('r_normal').value = item.rewards.normal || 20;
        }

        document.getElementById('questions_area').innerHTML = '';
        qCount = 0;
        item.questions.forEach(q => addQuestion(q)); 
        document.getElementById('btnSaveExam').innerText = "🔄 بروزرسانی آزمون";
    }
}

function cancelEdit() {
    EDIT_MODE = false;
    EDIT_ID = null;
    document.getElementById('editModeBadge').style.display = 'none';
    document.getElementById('l_title').value = '';
    document.getElementById('l_link').value = '';
    document.getElementById('attach_container').innerHTML = '';
    document.getElementById('e_title').value = '';
    document.getElementById('e_pass').value = '';
    document.getElementById('questions_area').innerHTML = '';
    document.getElementById('btnSaveLesson').innerText = "💾 ذخیره درس";
    document.getElementById('btnSaveExam').innerText = "💾 ذخیره آزمون";
    document.getElementById('isNewContent').checked = false;
    qCount = 0; addQuestion();
}

async function deleteItem(type, id) {
    if(!confirm("آیا حذف شود؟ این عمل غیرقابل بازگشت است.")) return;
    const action = type === 'lesson' ? 'delete_lesson_global' : 'delete_exam_global';
    const payload = { action: action, admin_token: ADMIN_TOKEN };
    if(type === 'lesson') payload.lesson_id = id; else payload.exam_id = id;
    await sendReq(payload);
    if(EDIT_ID == id) cancelEdit(); 
    fetchHistory();
}

async function sendReq(body) {
    const r = await fetch(API_URL, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
    return await r.json();
}

addQuestion(); // شروع با یک سوال خالی