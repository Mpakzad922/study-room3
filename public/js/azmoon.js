const API_URL = "https://chamran-api2.liara.run"; 
const EXAM_STATE_KEY = "chamran_exam_active_session_v8"; 

let currentUser = null;
let examsMap = {};
let currentExamId = null;
let currentQuestions = [];
let currentQIndex = 0;
let userAnswers = {};
let timerInterval;
let timeRemaining = 0;

function init() {
    const savedUser = localStorage.getItem('chamran_db_vfinal_creds');
    if(!savedUser) { window.location.href = 'index.html'; return; }
    try {
        currentUser = JSON.parse(savedUser);
        document.getElementById('welcomeText').innerText = `سلام ${currentUser.displayName}`;
        
        if(currentUser.jsonData) RankSystem.init(currentUser.jsonData);
        SyncManager.init(currentUser.username, currentUser.password);
        
        const urlParams = new URLSearchParams(window.location.search);
        if(urlParams.get('mode') === 'history_review') {
            prepareReviewMode(urlParams.get('target'));
        } else {
            performFullSync();
        }
    } catch(e) { window.location.href = 'index.html'; }
}

async function performFullSync() {
    try {
        const resExams = await fetch(`${API_URL}?t=${Date.now()}`, { method: 'POST', headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: 'get_exams' }) });
        const examData = await resExams.json();

        if(examData.status === 'success') {
            processExams(examData.data || []);
            checkActiveSession();
            
            fetch(API_URL, { method: 'POST', headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: 'login', username: currentUser.username, password: currentUser.password }) })
            .then(r=>r.json()).then(d=>{
                    if(d.status==='success') {
                        RankSystem.init(d.jsonData);
                        updateLocalCreds(d.jsonData);
                        processExams(examData.data || []); 
                    }
            });
        }
    } catch(e) { document.getElementById('loading').innerHTML = `<span style="color:red">❌ خطا در اتصال</span>`; }
}

function updateLocalCreds(jsonData) {
    if(currentUser) {
        currentUser.jsonData = jsonData;
        localStorage.setItem('chamran_db_vfinal_creds', JSON.stringify(currentUser));
    }
}

function processExams(list) {
    examsMap = {};
    const container = document.getElementById('examList');
    container.innerHTML = '';
    document.getElementById('loading').style.display = 'none';

    if(list.length === 0) { container.innerHTML = "<p>آزمونی یافت نشد.</p>"; return; }

    list.reverse().forEach(ex => {
        examsMap[ex.id] = ex;
        const sId = String(ex.id);
        const userExams = RankSystem.data.exams || {};
        const score = userExams[sId]; 
        const isTaken = (score !== undefined);

        const div = document.createElement('div');
        div.className = `exam-item ${isTaken ? 'locked' : ''}`;
        
        if(isTaken) {
            let quality = "";
            if(score >= 20) quality = "💎 فوق‌العاده";
            else if(score >= 17) quality = "🥇 خیلی خوب";
            else if(score >= 12) quality = "🙂 خوب";
            else if(score >= 8) quality = "⚠️ قابل قبول";
            else quality = "⛔ نیاز به تلاش";

            const color = score >= 15 ? '#27ae60' : (score < 10 ? '#c0392b' : '#f39c12');
            
            div.innerHTML = `
                <div style="text-align:right">
                    <h4>${ex.title}</h4>
                    <small>انجام شده</small>
                </div>
                <div style="text-align:left">
                    <span style="font-weight:bold; color:${color}; font-size:0.9rem;">${quality}</span><br>
                    <button onclick="goToReview('${sId}')" style="background:none; border:none; color:#2980b9; cursor:pointer; font-size:0.8rem; padding:0; margin-top:5px;">🔍 مرور پاسخ‌ها</button>
                </div>`;
        } else {
            const newBadge = ex.is_new ? '<div class="new-badge">جدید 🔥</div>' : '';
            div.innerHTML = `
                ${newBadge}
                <div><h4>${ex.title}</h4><small>${ex.time} دقیقه</small></div>
                <button class="btn-start" style="padding:5px 15px; border-radius:8px; border:none; cursor:pointer;" onclick="showIntro('${ex.id}')">شروع</button>`;
        }
        container.appendChild(div);
    });
}

// --- منطق راهنما (Intro) ---
function showIntro(id) {
    const ex = examsMap[id];
    if(!ex) return;
    if(ex.pass && prompt("رمز:") !== ex.pass) return alert("رمز اشتباه");
    
    document.getElementById('lobby').style.display = 'none';
    document.getElementById('introCard').style.display = 'block';
    
    document.getElementById('introTitle').innerText = ex.title;
    document.getElementById('introQCount').innerText = toPersianNum(ex.questions.length);
    document.getElementById('introTime').innerText = toPersianNum(ex.time);
    
    const r = ex.rewards || { excellent: 300, good: 100, normal: 20 };
    document.getElementById('rewEx').innerText = `${r.excellent} XP`;
    document.getElementById('rewVg').innerText = `${r.good} XP`;
    document.getElementById('rewNr').innerText = `${r.normal} XP`;
    
    currentExamId = id;
}

function startExamNow() {
    startExam(currentExamId);
}

function startExam(id) {
    const ex = examsMap[id];
    currentExamId = id;
    currentQuestions = ex.questions;
    userAnswers = {};
    currentQIndex = 0;
    localStorage.setItem(EXAM_STATE_KEY, JSON.stringify({ id, start: Date.now(), end: Date.now() + ex.time*60000 }));
    showExamUI(ex.time * 60);
    SyncManager.addToQueue('report', { lesson: `آزمون: ${ex.title}`, status: 'شروع' });
}

function checkActiveSession() {
    const saved = localStorage.getItem(EXAM_STATE_KEY);
    if(saved) {
        const sess = JSON.parse(saved);
        if(examsMap[sess.id]) {
            const remaining = Math.floor((sess.end - Date.now())/1000);
            if(remaining > 0) {
                if(confirm("یک آزمون ناتمام دارید. ادامه می‌دهید؟")) {
                    currentExamId = sess.id;
                    const ex = examsMap[sess.id];
                    currentQuestions = ex.questions;
                    userAnswers = {}; 
                    currentQIndex = 0;
                    showExamUI(remaining);
                } else { localStorage.removeItem(EXAM_STATE_KEY); }
            } else { localStorage.removeItem(EXAM_STATE_KEY); }
        }
    }
}

function showExamUI(time) {
    document.getElementById('lobby').style.display = 'none';
    document.getElementById('introCard').style.display = 'none';
    document.getElementById('examArea').style.display = 'block';
    let t = time;
    timerInterval = setInterval(() => {
        t--;
        const m = Math.floor(t/60), s = t%60;
        document.getElementById('timer').innerText = `${m}:${s<10?'0'+s:s}`;
        if(t<=0) { clearInterval(timerInterval); alert("زمان تمام شد!"); finishExam(true); }
    }, 1000);
    loadQuestion();
}

function loadQuestion() {
    const q = currentQuestions[currentQIndex];
    document.getElementById('qProgress').innerText = `سوال ${currentQIndex+1} از ${currentQuestions.length}`;
    document.getElementById('questionText').innerText = q.q;
    
    const imgEl = document.getElementById('questionImage');
    if(q.img) { imgEl.src = q.img; imgEl.style.display = 'block'; } else imgEl.style.display = 'none';
    
    const cont = document.getElementById('optionsContainer');
    cont.innerHTML = '';
    q.options.forEach((opt, i) => {
        const val = i+1;
        const div = document.createElement('div');
        div.className = `option ${userAnswers[currentQIndex]==val ? 'selected' : ''}`;
        
        let content = opt;
        if(opt.startsWith('http') || opt.startsWith('/uploads')) content = `<img src="${opt}" onclick="event.stopPropagation(); openLightbox(this.src)">`;
        
        div.innerHTML = `<b>${val})</b> ${content}`;
        div.onclick = () => { userAnswers[currentQIndex] = val; loadQuestion(); }; 
        cont.appendChild(div);
    });

    document.getElementById('btnNext').style.display = currentQIndex < currentQuestions.length-1 ? 'block' : 'none';
    document.getElementById('btnFinish').style.display = currentQIndex === currentQuestions.length-1 ? 'block' : 'none';
}

function nextQuestion() { currentQIndex++; loadQuestion(); }

function finishExam(forced = false) {
    clearInterval(timerInterval);
    localStorage.removeItem(EXAM_STATE_KEY);

    let correct = 0, wrong = 0, empty = 0;
    let wrongIndices = [];

    currentQuestions.forEach((q, i) => {
        if(!userAnswers[i]) empty++;
        else if(userAnswers[i] == q.correct) correct++;
        else { wrong++; wrongIndices.push(i+1); }
    });

    const score = parseFloat(((correct / currentQuestions.length) * 20).toFixed(1));

    const sId = String(currentExamId);
    if(!RankSystem.data.exams) RankSystem.data.exams = {};
    if(!RankSystem.data.exam_details) RankSystem.data.exam_details = {};
    
    RankSystem.data.exams[sId] = score;
    RankSystem.data.exam_details[sId] = {
        score: score, wrong: wrongIndices, answers: userAnswers, date: new Date().toLocaleDateString('fa-IR')
    };
    RankSystem.saveToLocal(); 

    SyncManager.addToQueue('claim_reward', {
        reward_type: 'exam', reward_id: currentExamId, exam_score: score,
        wrong_list: wrongIndices, user_answers: userAnswers
    });
    
    updateLocalCreds(JSON.stringify(RankSystem.data));

    showReportCard(score, correct, wrong, empty);
}

function showReportCard(score, correct, wrong, empty) {
    document.getElementById('examArea').style.display = 'none';
    document.getElementById('reportCard').style.display = 'block';

    document.getElementById('resCorrect').innerText = correct;
    document.getElementById('resWrong').innerText = wrong;
    document.getElementById('resEmpty').innerText = empty;

    setTimeout(() => { document.getElementById('scorePointer').style.left = ((score/20)*100) + '%'; }, 200);

    // 🔧 فیکس باگ سه نقطه: استفاده از شرط‌های دقیق و پارس فلوت
    let qText = "نیاز به تلاش"; 
    let color = "#c0392b";
    
    const numScore = parseFloat(score);

    if(numScore >= 20) { qText = "💎 فوق‌العاده"; color="#8e44ad"; launchConfetti(); }
    else if(numScore >= 17) { qText = "🥇 خیلی خوب"; color="#2ecc71"; launchConfetti(); }
    else if(numScore >= 12) { qText = "🙂 خوب"; color="#2980b9"; }
    else if(numScore >= 8) { qText = "⚠️ قابل قبول"; color="#f1c40f"; }
    
    const qEl = document.getElementById('qualitativeScore');
    qEl.innerText = qText; 
    qEl.style.color = color;
    
    document.getElementById('btnReview').style.display = 'block';
    document.getElementById('xpMsg').style.display = 'block';
}

function startReviewMode() {
    document.getElementById('reportCard').style.display = 'none';
    document.getElementById('reviewArea').style.display = 'block';
    renderReview(currentQuestions, userAnswers);
}

function goToReview(id) {
    window.location.href = `azmoon.html?mode=history_review&target=${id}`;
}

async function prepareReviewMode(targetId) {
    if(!targetId) return;
    document.getElementById('loading').innerText = "بازیابی پاسخ‌برگ...";
    document.getElementById('loading').style.display = 'block';

    const sTargetId = String(targetId);
    let myData = (RankSystem.data.exam_details || {})[sTargetId];
    
    let examList = [];
    try {
        const resEx = await fetch(`${API_URL}?t=${Date.now()}`, { method: 'POST', headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: 'get_exams' }) });
        const eData = await resEx.json();
        examList = eData.data || [];
    } catch(e) {}

    const exam = examList.find(e => String(e.id) === sTargetId);

    if(!myData) {
        try {
             const resUser = await fetch(`${API_URL}?t=${Date.now()}`, { method: 'POST', headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: 'login', username: currentUser.username, password: currentUser.password }) });
             const userData = await resUser.json();
             if(userData.status === 'success') {
                 RankSystem.init(userData.jsonData);
                 myData = (RankSystem.data.exam_details || {})[sTargetId];
             }
        } catch(e) {}
    }

    if(exam && myData) {
        document.getElementById('lobby').style.display = 'none';
        document.getElementById('reviewArea').style.display = 'block';
        renderReview(exam.questions, myData.answers || {});
    } else { 
        alert("اطلاعات آزمون یافت نشد (احتمالاً حذف شده است)."); 
        window.location.href = 'azmoon.html'; 
    }
}

function renderReview(questions, answers) {
    const c = document.getElementById('reviewContent');
    c.innerHTML = '';
    questions.forEach((q, i) => {
        const uAns = answers[i];
        const isCorrect = (uAns == q.correct);
        let html = `<div class="review-q"><b>سوال ${i+1}:</b> ${q.q}`;
        if(q.img) html += `<br><img src="${q.img}" onclick="openLightbox(this.src)">`;
        
        q.options.forEach((op, idx) => {
            const val = idx+1;
            let color = "#fff", border = "#eee";
            if(val == q.correct) { color = "#d4edda"; border = "#c3e6cb"; } 
            else if(val == uAns) { color = "#f8d7da"; border = "#f5c6cb"; } 
            
            let content = optIsImage(op) ? `<img src="${op}" style="max-height:100px; vertical-align:middle">` : op;
            html += `<div style="background:${color}; border:1px solid ${border}; padding:10px; margin:5px 0; border-radius:10px;">${val}) ${content}</div>`;
        });
        
        // 🔧 فیکس باگ عکس تشریحی (Explanatory Image Fix)
        if(q.desc || q.desc_img) {
            html += `<div style="background:#fff3cd; padding:10px; margin-top:10px; border-radius:8px; font-size:0.9rem;">💡 <b>توضیح:</b> ${q.desc || ''}`;
            if(q.desc_img) html += `<br><img src="${q.desc_img}" onclick="openLightbox(this.src)" style="max-width:100%; border-radius:8px; margin-top:5px;">`;
            html += `</div>`;
        }
        
        html += `</div>`;
        c.innerHTML += html;
    });
}

function optIsImage(s) { return s.startsWith('http') || s.startsWith('/uploads'); }
function openLightbox(src) { document.getElementById('lightboxImg').src = src; document.getElementById('lightbox').style.display = 'flex'; }

// تابع جشن مستقل (کانفتی) با z-index بالا
function launchConfetti() {
    const c = document.getElementById('confetti-canvas');
    const ctx = c.getContext('2d');
    c.style.display = 'block';
    c.width = window.innerWidth;
    c.height = window.innerHeight;
    
    const pieces = [];
    for(let i=0; i<300; i++) {
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
    setTimeout(() => {
        cancelAnimationFrame(animationId);
        c.style.display = 'none';
    }, 6000);
}

function toPersianNum(n) { return n.toString().replace(/\d/g, x => ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹'][x]); }


window.onload = init;


