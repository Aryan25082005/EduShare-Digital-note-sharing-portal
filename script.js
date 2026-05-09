import {
    auth, db,
    createUserWithEmailAndPassword, signInWithEmailAndPassword,
    signOut, onAuthStateChanged, sendPasswordResetEmail, sendEmailVerification,
    collection, addDoc, getDocs, query, where,
    updateDoc, doc, deleteDoc, setDoc, serverTimestamp
} from './firebase-config.js';

// ===== BACK TO TOP =====
const btt = document.createElement('button');
btt.id = 'backToTop'; btt.className = 'back-to-top'; btt.innerHTML = '<i class="fas fa-arrow-up"></i>';
document.addEventListener('DOMContentLoaded', () => document.body.appendChild(btt));
btt.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
window.addEventListener('scroll', () => btt.classList.toggle('visible', window.scrollY > 300));

// ===== DEBOUNCE =====
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

// ===== TOAST =====
function showToast(message, type = 'success') {
    let c = document.getElementById('toastContainer');
    if (!c) { c = document.createElement('div'); c.id = 'toastContainer'; c.className = 'toast-container'; document.body.appendChild(c); }
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.innerHTML = `<i class="fas fa-${({success:'check-circle',error:'times-circle',info:'info-circle'})[type]||'info-circle'}"></i><span>${message}</span>`;
    c.appendChild(t);
    setTimeout(() => t.classList.add('show'), 10);
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, 3500);
}

const branchColors = { it:'#4cc9f0', ce:'#7209b7', me:'#f72585', ee:'#ff9e00' };

// ===== SUBJECTS DATA =====
let subjectsData = {
    it:{1:["Mathematics-1","Physics","Basic Electrical Engineering"],2:["Mathematics-2","Programming for Problem Solving","Environmental Science"],3:["Data Structures","Digital Electronics","Discrete Mathematics"],4:["Operating Systems","Web Technology","DAA"],5:["Machine Learning","Cloud Computing","Information Security"],6:["AI","Mobile App Dev","Big Data"],7:["Deep Learning","DevOps","Blockchain"],8:["IoT","Cyber Security","Project"]},
    ce:{1:["Mathematics-1","Physics","BEE"],2:["Mathematics-2","PPS","Environmental Science"],3:["Data Structures","Digital Electronics","Discrete Mathematics"],4:["OS","DBMS","COA"],5:["Software Engineering","Computer Networks","TOC"],6:["Machine Learning","Web Technology","Compiler Design"],7:["AI","Cloud Computing","Cyber Security"],8:["Big Data","Blockchain","Project"]},
    me:{1:["Mathematics-1","Physics","Basic Mechanical"],2:["Mathematics-2","Engineering Mechanics","EVS"],3:["Thermodynamics","Fluid Mechanics","Material Science"],4:["Heat Transfer","TOM","Manufacturing"],5:["Machine Design","IE","Automobile"],6:["CAD","Power Plant","RAC"],7:["Robotics","FEA","Renewable Energy"],8:["Advanced Manufacturing","OR","Project"]},
    ee:{1:["Mathematics-1","Physics","BEE"],2:["Mathematics-2","Circuits","EVS"],3:["EMT","Electrical Machines","Control Systems"],4:["Power Systems","Signals","Power Electronics"],5:["Microprocessors","DSP","Instrumentation"],6:["Electric Drives","High Voltage","PS-II"],7:["Smart Grid","Renewable","Advanced Control"],8:["EV","Automation","Project"]},
};

// Deep copy kept separately — used ONLY for admin "Reset to Defaults" button
const DEFAULT_SUBJECTS = JSON.parse(JSON.stringify(subjectsData));

// On load, apply any admin overrides saved in Firestore on top of the above
async function loadSubjectsConfig() {
    try {
        const snap = await getDocs(collection(db, 'subjects'));
        snap.forEach(d => {
            const { branch, semester, list } = d.data();
            if (branch && semester && Array.isArray(list)) {
                if (!subjectsData[branch]) subjectsData[branch] = {};
                subjectsData[branch][semester] = list;
            }
        });
    } catch(e) { /* use hardcoded defaults */ }
}
loadSubjectsConfig();


// ===== AUTH STATE =====
onAuthStateChanged(auth, async (user) => {
    const isAdminPage = location.pathname.endsWith('admin.html');
    if (!user) { if (isAdminPage) location.href = "login.html"; return; }

    let role = "student";
    try {
        const snap = await getDocs(query(collection(db,'users'), where('uid','==',user.uid)));
        snap.forEach(d => { role = d.data().role; });
        localStorage.setItem("role", role);
    } catch(e) {}

    const authButtons = document.querySelector('.auth-buttons');
    if (authButtons) {
        authButtons.innerHTML = `
            <span class="welcome-user">
                <i class="fas fa-user-circle"></i> ${user.email.split('@')[0]}
                ${role==='admin'?'<span class="admin-badge"><i class="fas fa-shield-alt"></i> Admin</span>':''}
            </span>
            <a href="#" id="logoutBtn" class="btn btn-outline">Logout</a>`;
        document.getElementById('logoutBtn').onclick = async () => {
            await signOut(auth); localStorage.removeItem("role");
            showToast("Logged out!", "success");
            setTimeout(() => location.href="index.html", 1200);
        };
    }

    if (role === 'admin') {
        const nav = document.querySelector('nav ul');
        if (nav && !document.getElementById('adminNavLink')) {
            const li = document.createElement('li');
            li.innerHTML = '<a href="admin.html" id="adminNavLink" class="admin-nav-link"><i class="fas fa-shield-alt"></i> Admin Panel</a>';
            nav.appendChild(li);
        }
    }

    if (isAdminPage) {
        if (role !== 'admin') { showToast("Access denied! Admins only.", "error"); setTimeout(() => location.href="index.html", 1500); }
        else initAdminPage();
    }
});

// ===== REGISTER =====
const registerForm = document.getElementById('registerForm');
if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name=document.getElementById('registerName').value.trim(), email=document.getElementById('registerEmail').value.trim();
        const password=document.getElementById('registerPassword').value, confirmPassword=document.getElementById('confirmPassword').value;
        const branch=document.getElementById('registerBranch').value, semester=document.getElementById('registerSemester').value;
        if (password!==confirmPassword) { showToast("Passwords do not match!","error"); return; }
        if (password.length<6) { showToast("Password must be at least 6 characters!","error"); return; }
        const btn=registerForm.querySelector('button[type="submit"]');
        btn.disabled=true; btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> Creating...';
        try {
            const uc=await createUserWithEmailAndPassword(auth,email,password);
            await addDoc(collection(db,'users'),{uid:uc.user.uid,email:uc.user.email,name,branch,semester:parseInt(semester),role:"student",createdAt:serverTimestamp()});
            await sendEmailVerification(uc.user);
            showToast("Account created! Verification email sent. Please check your inbox.","success");
            setTimeout(()=>location.href="login.html",2000);
        } catch(err) { showToast(err.message,"error"); btn.disabled=false; btn.innerHTML='Create Account'; }
    });
}

// ===== LOGIN =====
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email=document.getElementById('loginEmail').value, password=document.getElementById('loginPassword').value;
        const btn=loginForm.querySelector('button[type="submit"]');
        btn.disabled=true; btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> Logging in...';
        try {
            const uc=await signInWithEmailAndPassword(auth,email,password);
            const snap=await getDocs(query(collection(db,'users'),where('uid','==',uc.user.uid)));
            let role="student"; snap.forEach(d=>{role=d.data().role;});
            localStorage.setItem("role",role);
            showToast("Login successful!","success");
            setTimeout(()=>location.href=role==='admin'?"admin.html":"index.html",1200);
        } catch(err) { showToast(err.message,"error"); btn.disabled=false; btn.innerHTML='Login'; }
    });
}

// ===== FORGOT PASSWORD =====
const forgotLink = document.querySelector('.forgot-password');
const forgotSection = document.getElementById('forgotPasswordSection');
if (forgotLink && forgotSection) {
    forgotLink.addEventListener('click', (e) => {
        e.preventDefault();
        forgotSection.style.display = forgotSection.style.display === 'none' ? 'block' : 'none';
    });
    document.getElementById('sendResetBtn')?.addEventListener('click', async () => {
        const email = document.getElementById('resetEmail').value.trim();
        if (!email) { showToast('Enter your email address first!', 'error'); return; }
        try {
            await sendPasswordResetEmail(auth, email);
            showToast('Password reset email sent! Check your inbox.', 'success');
            forgotSection.style.display = 'none';
        } catch(err) { showToast(err.message, 'error'); }
    });
}

// ===== SUBJECT DROPDOWNS (Upload Page) =====
function updateSubjects() {
    const branchEl = document.getElementById('branch');
    const semEl    = document.getElementById('semester');
    const subjectEl= document.getElementById('subject');
    if (!subjectEl) return;

    const branch = branchEl?.value;
    const sem    = parseInt(semEl?.value); // parse to int for reliable key lookup

    subjectEl.innerHTML = '<option value="">Select Subject</option>';

    if (branch && sem && subjectsData[branch]?.[sem]) {
        subjectsData[branch][sem].forEach(s => {
            subjectEl.innerHTML += `<option value="${s}">${s}</option>`;
        });
    } else if (branch && !sem) {
        subjectEl.innerHTML = '<option value="">Select Semester first</option>';
    }
}
document.getElementById('branch')?.addEventListener('change', updateSubjects);
document.getElementById('semester')?.addEventListener('change', updateSubjects);

// ===== SUBJECT FILTER (notes.html) =====
function updateSubjectFilter() {
    const branch = document.getElementById('branchFilter')?.value;
    const sem    = document.getElementById('semesterFilter')?.value;
    const el     = document.getElementById('subjectFilter');
    if (!el) return;

    el.innerHTML = '<option value="all">All Subjects</option>';

    if (!branch || branch === 'all') return;

    if (sem && sem !== 'all') {
        // Branch + Semester selected → show subjects for that sem only
        const semInt = parseInt(sem);
        if (subjectsData[branch]?.[semInt]) {
            subjectsData[branch][semInt].forEach(s => {
                el.innerHTML += `<option value="${s}">${s}</option>`;
            });
        }
    } else {
        // Only branch selected → show ALL subjects for that branch (deduplicated)
        const allSubjects = new Set();
        Object.values(subjectsData[branch] || {}).forEach(semSubjects => {
            semSubjects.forEach(s => allSubjects.add(s));
        });
        allSubjects.forEach(s => {
            el.innerHTML += `<option value="${s}">${s}</option>`;
        });
    }
}

// ===== UPLOAD =====
const uploadForm = document.getElementById('uploadForm');
if (uploadForm) {
    uploadForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!auth.currentUser) { showToast('Please login first!', 'error'); setTimeout(() => location.href = 'login.html', 1500); return; }
        const b  = document.getElementById('branch');
        const s  = document.getElementById('semester');
        const sb = document.getElementById('subject');
        const t  = document.getElementById('noteTitle');
        const d  = document.getElementById('noteDescription');
        const p  = document.getElementById('pdfLink');
        if (!b.value || !s.value || !sb.value || !t.value || !p.value) { showToast('Please fill all required fields!', 'error'); return; }
        const btn = uploadForm.querySelector('button[type="submit"]');
        btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Checking...';
        try {
            // Duplicate check
            const dupSnap = await getDocs(query(collection(db,'notes'),
                where('branch','==',b.value), where('semester','==',parseInt(s.value)),
                where('subject','==',sb.value), where('title','==',t.value.trim())));
            if (!dupSnap.empty) {
                showToast('A note with this title already exists for this subject!', 'error');
                btn.disabled = false; btn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> Upload Notes';
                return;
            }
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';
            await addDoc(collection(db, 'notes'), {
                branch: b.value, semester: parseInt(s.value), subject: sb.value,
                title: t.value.trim(), description: d.value.trim(),
                pdfLink: p.value.trim(),
                uploaderEmail: auth.currentUser.email,
                createdAt: serverTimestamp(),
                downloads: 0, rating: 0, reviewCount: 0, featured: false
            });
            showToast('Notes uploaded successfully!', 'success');
            uploadForm.reset();
        } catch(err) { showToast('Upload failed: ' + err.message, 'error'); }
        finally { btn.disabled = false; btn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> Upload Notes'; }
    });
}

// ===== SEARCH =====
const searchBtn=document.querySelector('.search-btn'), searchInput=document.querySelector('.search-bar input');
function performSearch(){const v=searchInput?.value?.trim();if(!v)return;location.href=`notes.html?search=${encodeURIComponent(v)}`;}
searchBtn?.addEventListener('click',performSearch);
searchInput?.addEventListener('keypress',e=>{if(e.key==='Enter')performSearch();});

// ===== LOAD NOTES =====
const notesGrid=document.getElementById('notesGrid');
async function getVerifiedRole(){
    const user=auth.currentUser; if(!user)return"guest";
    try{const snap=await getDocs(query(collection(db,'users'),where('uid','==',user.uid)));let r="student";snap.forEach(d=>{r=d.data().role;});localStorage.setItem("role",r);return r;}catch(e){return"student";}
}
// Skeleton loading
function showSkeletons(){
    notesGrid.innerHTML=Array(6).fill(`<div class="skeleton-card"><div class="skel skel-header"></div><div class="skel skel-line"></div><div class="skel skel-line skel-short"></div><div class="skel skel-line"></div><div class="skel skel-footer"></div></div>`).join('');
}
async function loadNotes(){
    if(!notesGrid)return;
    showSkeletons();
    const verifiedRole=await getVerifiedRole();
    const urlParams=new URLSearchParams(location.search), urlBranch=urlParams.get('branch'), urlSearch=urlParams.get('search')?.toLowerCase();
    const branchEl=document.getElementById('branchFilter'), semEl=document.getElementById('semesterFilter');
    if(urlBranch&&branchEl){branchEl.value=urlBranch;updateSubjectFilter();}
    const liveSearch=document.getElementById('noteSearch')?.value?.toLowerCase()||'';
    const branch=branchEl?.value, sem=semEl?.value, subject=document.getElementById('subjectFilter')?.value, sortBy=document.getElementById('sortFilter')?.value||'recent';
    let notes=[];
    (await getDocs(collection(db,'notes'))).forEach(d=>notes.push({id:d.id,data:d.data()}));
    const searchTerm=liveSearch||urlSearch||'';
    if(searchTerm)notes=notes.filter(n=>n.data.title?.toLowerCase().includes(searchTerm)||n.data.subject?.toLowerCase().includes(searchTerm)||n.data.description?.toLowerCase().includes(searchTerm));
    if(branch&&branch!=="all")notes=notes.filter(n=>n.data.branch===branch);
    if(sem&&sem!=="all")notes=notes.filter(n=>n.data.semester===parseInt(sem));
    if(subject&&subject!=="all")notes=notes.filter(n=>n.data.subject===subject);
    // Featured notes always first
    notes.sort((a,b)=>(b.data.featured?1:0)-(a.data.featured?1:0));
    if(sortBy==='rating')notes.sort((a,b)=>a.data.featured===b.data.featured?(b.data.rating||0)-(a.data.rating||0):0);
    else if(sortBy==='downloads')notes.sort((a,b)=>a.data.featured===b.data.featured?(b.data.downloads||0)-(a.data.downloads||0):0);
    notesGrid.innerHTML="";
    if(!notes.length){notesGrid.innerHTML='<div class="empty-state"><i class="fas fa-folder-open"></i><h3>No notes found</h3><p>Try adjusting your filters or be the first to upload!</p><a href="upload.html" class="btn btn-primary" style="margin-top:1rem;">Upload Notes</a></div>';return;}
    notes.forEach(n=>notesGrid.appendChild(createNoteCard(n.data,n.id,verifiedRole)));
}
document.getElementById('branchFilter')?.addEventListener('change',()=>{updateSubjectFilter();loadNotes();});
document.getElementById('semesterFilter')?.addEventListener('change',()=>{updateSubjectFilter();loadNotes();});
document.getElementById('subjectFilter')?.addEventListener('change',loadNotes);
document.getElementById('sortFilter')?.addEventListener('change',loadNotes);
document.getElementById('noteSearch')?.addEventListener('input',debounce(loadNotes,300));
loadNotes();

// ===== NOTE CARD =====
function createNoteCard(note,noteId,role){
    const card=document.createElement('div'); card.className='note-card';
    const rating=note.rating||0, reviewCount=note.reviewCount||0, color=branchColors[note.branch]||'#4361ee';
    card.innerHTML=`
        <div class="note-header">
            <h3>${note.title}</h3>
            <span class="note-branch" style="background:${color}">${note.branch?.toUpperCase()}</span>
        </div>
        <div class="note-body">
            <div class="note-meta"><span><i class="fas fa-book"></i> ${note.subject}</span><span><i class="fas fa-layer-group"></i> Sem ${note.semester}</span></div>
            <p class="note-desc">${note.description||'No description available.'}</p>
            <div class="rating-section">
                <div class="stars" data-id="${noteId}" data-rating="${rating}">
                    ${[1,2,3,4,5].map(i=>`<i class="fa${i<=Math.round(rating)?'s':'r'} fa-star star-icon" data-value="${i}"></i>`).join('')}
                </div>
                <small class="rating-text">${rating.toFixed(1)} ⭐ (${reviewCount} reviews)</small>
            </div>
            <div class="note-footer">
                <div class="uploader"><i class="fas fa-user-circle"></i><span>${note.uploaderEmail?.split('@')[0]||'Anonymous'}</span></div>
                <div class="note-actions">
                    <button class="btn btn-primary btn-sm view-btn"><i class="fas fa-eye"></i> View</button>
                    <button class="btn btn-sm btn-share share-btn" title="Copy link"><i class="fas fa-share-alt"></i></button>
                    ${role==='admin'?`<button class="btn btn-danger btn-sm delete-btn"><i class="fas fa-trash"></i></button>`:''}
                </div>
            </div>
            ${note.featured?'<div class="featured-badge"><i class="fas fa-star"></i> Featured</div>':''}
        </div>`;
    card.querySelector('.view-btn').addEventListener('click',async()=>{
        try{await updateDoc(doc(db,'notes',noteId),{downloads:(note.downloads||0)+1});}catch(e){}
        window.open(note.pdfLink,'_blank');
    });
    // Share button
    card.querySelector('.share-btn').addEventListener('click',()=>{
        const url=`${location.origin}${location.pathname.includes('notes')? location.pathname : location.pathname.replace(/[^/]*$/,'')}notes.html?id=${noteId}`;
        navigator.clipboard.writeText(url).then(()=>showToast('Link copied to clipboard!','info')).catch(()=>showToast('Copy failed','error'));
    });
    const delBtn=card.querySelector('.delete-btn');
    if(delBtn)delBtn.onclick=async()=>{if(confirm("Delete this note permanently?")){await deleteDoc(doc(db,'notes',noteId));showToast("Note deleted!","success");loadNotes();}}
    const starsEl=card.querySelector('.stars'), ratingText=card.querySelector('.rating-text');
    starsEl.querySelectorAll('.star-icon').forEach(star=>{
        star.addEventListener('mouseover',()=>{const v=parseInt(star.dataset.value);starsEl.querySelectorAll('.star-icon').forEach((s,i)=>{s.className=`fa${i<v?'s':'r'} fa-star star-icon`;});});
        star.addEventListener('mouseout',()=>{const cur=Math.round(parseFloat(starsEl.dataset.rating));starsEl.querySelectorAll('.star-icon').forEach((s,i)=>{s.className=`fa${i<cur?'s':'r'} fa-star star-icon`;});});
        star.addEventListener('click',async()=>{
            if(!auth.currentUser){showToast("Please login to rate!","error");return;}
            const nv=parseInt(star.dataset.value),cr=note.rating||0,cc=note.reviewCount||0,ur=((cr*cc)+nv)/(cc+1);
            try{await updateDoc(doc(db,'notes',noteId),{rating:ur,reviewCount:cc+1});note.rating=ur;note.reviewCount=cc+1;starsEl.dataset.rating=ur;ratingText.textContent=`${ur.toFixed(1)} ⭐ (${cc+1} reviews)`;showToast("Thanks for rating!","success");}
            catch(err){showToast("Rating failed!","error");}
        });
    });
    return card;
}

// ===== ADMIN DASHBOARD =====
function initAdminPage(){
    loadAdminStats(); loadAdminUsers(); loadAdminNotes();
    document.querySelectorAll('.admin-tab-btn').forEach(btn=>{
        btn.addEventListener('click',()=>{
            document.querySelectorAll('.admin-tab-btn').forEach(b=>b.classList.remove('active'));
            document.querySelectorAll('.admin-tab-pane').forEach(p=>p.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(btn.dataset.tab).classList.add('active');
        });
    });
}
async function loadAdminStats(){
    try{
        const ns=await getDocs(collection(db,'notes')), us=await getDocs(collection(db,'users'));
        let dl=0; ns.forEach(d=>{dl+=(d.data().downloads||0);});
        document.getElementById('statNotes').textContent=ns.size;
        document.getElementById('statUsers').textContent=us.size;
        document.getElementById('statDownloads').textContent=dl;
    }catch(e){}
}
async function loadAdminUsers(){
    const tbody=document.getElementById('usersTableBody'); if(!tbody)return;
    tbody.innerHTML='<tr><td colspan="5" class="table-loading"><div class="spinner"></div></td></tr>';
    try{
        const snap=await getDocs(collection(db,'users'));
        tbody.innerHTML='';
        if(snap.empty){tbody.innerHTML='<tr><td colspan="5" class="table-empty">No users found.</td></tr>';return;}
        const currentUid = auth.currentUser?.uid;
        snap.forEach(d=>{
            const u=d.data(), tr=document.createElement('tr');
            const isSelf = u.uid === currentUid;
            tr.innerHTML=`<td><strong>${u.name||'—'}</strong>${isSelf?' <span class="you-badge">You</span>':''}</td><td>${u.email}</td><td>${u.branch?.toUpperCase()||'—'}${u.semester?' / Sem '+u.semester:''}</td>
                <td><span class="role-badge role-${u.role}">${u.role==='admin'?'<i class="fas fa-shield-alt"></i> Admin':'<i class="fas fa-user-graduate"></i> Student'}</span></td>
                <td>${isSelf?'<span style="color:var(--gray);font-size:0.85rem;"><i class="fas fa-lock"></i> Protected</span>':`<button class="btn btn-sm ${u.role==='admin'?'btn-warning':'btn-promote'} toggle-role-btn" data-docid="${d.id}" data-role="${u.role}">${u.role==='admin'?'<i class="fas fa-user-minus"></i> Demote':'<i class="fas fa-user-shield"></i> Make Admin'}</button>`}</td>`;
            tr.querySelector('.toggle-role-btn')?.addEventListener('click',async(e)=>{
                const btn=e.currentTarget, newRole=btn.dataset.role==='admin'?'student':'admin';
                btn.disabled=true; btn.innerHTML='<i class="fas fa-spinner fa-spin"></i>';
                try{await updateDoc(doc(db,'users',btn.dataset.docid),{role:newRole});showToast(`Role changed to ${newRole}!`,'success');loadAdminUsers();}
                catch(err){showToast('Failed to update role!','error');btn.disabled=false;}
            });
            tbody.appendChild(tr);
        });
    }catch(e){tbody.innerHTML='<tr><td colspan="5" class="table-empty">Error loading users.</td></tr>';}
}
async function loadAdminNotes(){
    const tbody=document.getElementById('notesTableBody'); if(!tbody)return;
    tbody.innerHTML='<tr><td colspan="7" class="table-loading"><div class="spinner"></div></td></tr>';
    try{
        const snap=await getDocs(collection(db,'notes'));
        tbody.innerHTML='';
        if(snap.empty){tbody.innerHTML='<tr><td colspan="7" class="table-empty">No notes uploaded yet.</td></tr>';return;}
        snap.forEach(d=>{
            const note=d.data(), color=branchColors[note.branch]||'#4361ee', tr=document.createElement('tr');
            tr.innerHTML=`<td><strong>${note.title}</strong></td>
                <td><span style="background:${color};font-size:.75rem;padding:2px 8px;border-radius:12px;color:white;">${note.branch?.toUpperCase()}</span></td>
                <td>Sem ${note.semester}</td><td>${note.subject}</td>
                <td>${note.uploaderEmail?.split('@')[0]||'—'}</td>
                <td>⬇️${note.downloads||0} &nbsp; ⭐${(note.rating||0).toFixed(1)}</td>
                <td>
                    <a href="${note.pdfLink}" target="_blank" class="btn btn-sm btn-primary"><i class="fas fa-eye"></i></a>
                    <button class="btn btn-sm ${note.featured?'btn-warning':'btn-promote'} feat-note-btn" data-id="${d.id}" data-featured="${!!note.featured}" title="${note.featured?'Unfeature':'Feature'}">
                        <i class="fas fa-${note.featured?'star-half-alt':'star'}"></i>
                    </button>
                    <button class="btn btn-sm btn-danger del-note-btn" data-id="${d.id}"><i class="fas fa-trash"></i></button>
                </td>`;
            tr.querySelector('.feat-note-btn').addEventListener('click',async(e)=>{
                const btn=e.currentTarget, id=btn.dataset.id, isFeatured=btn.dataset.featured==='true';
                btn.disabled=true;
                try{
                    await updateDoc(doc(db,'notes',id),{featured:!isFeatured});
                    showToast(isFeatured?'Note unfeatured!':'Note featured! It will appear at the top.','success');
                    loadAdminNotes();
                }catch(err){showToast('Failed!','error');btn.disabled=false;}
            });
            tr.querySelector('.del-note-btn').addEventListener('click',async(e)=>{
                if(confirm('Delete this note permanently?')){
                    await deleteDoc(doc(db,'notes',e.currentTarget.dataset.id));
                    showToast('Note deleted!','success'); loadAdminNotes(); loadAdminStats();
                }
            });
            tbody.appendChild(tr);
        });
    }catch(e){tbody.innerHTML='<tr><td colspan="7" class="table-empty">Error loading notes.</td></tr>';}
}

// ===== ADMIN SUBJECT MANAGER =====
let _editBranch = '', _editSem = 0;

window.loadSubjectEditor = async function() {
    const branch = document.getElementById('adminBranchSel')?.value;
    const sem    = parseInt(document.getElementById('adminSemSel')?.value);
    if (!branch || !sem) { showToast('Please select both branch and semester!', 'error'); return; }
    _editBranch = branch; _editSem = sem;
    const area = document.getElementById('subjectEditorArea');
    area.innerHTML = '<div style="text-align:center;padding:2rem"><div class="spinner" style="margin:0 auto"></div></div>';
    // Firestore override check
    let subjects = [...(subjectsData[branch]?.[sem] || [])];
    try {
        const snap = await getDocs(query(collection(db,'subjects'), where('branch','==',branch), where('semester','==',sem)));
        if (!snap.empty) subjects = snap.docs[0].data().list || [];
    } catch(e) {}
    _renderSubjectEditor(branch, sem, subjects);
};

function _renderSubjectEditor(branch, sem, subjects) {
    const NAMES = {it:'Information Technology',ce:'Computer Engineering',me:'Mechanical Engineering',ee:'Electrical Engineering'};
    const area = document.getElementById('subjectEditorArea');
    area.innerHTML = `
        <div class="subject-editor">
            <div class="subject-editor-header">
                <h4><i class="fas fa-graduation-cap"></i> ${NAMES[branch]} — Semester ${sem}</h4>
                <button class="btn btn-sm btn-warning" onclick="resetSubjectsToDefault()"><i class="fas fa-undo"></i> Reset to Defaults</button>
            </div>
            <div class="subject-list" id="_subjectList">
                ${subjects.length
                    ? subjects.map((s,i)=>`
                        <div class="subject-item" id="_sItem_${i}">
                            <span class="subject-name-text"><i class="fas fa-book-open" style="color:var(--primary);margin-right:6px;font-size:0.85rem;"></i>${s}</span>
                            <div class="subject-item-actions">
                                <button class="btn btn-sm btn-promote" onclick="editSubjectInline(${i},'${s.replace(/'/g,"&apos;")}')"><i class="fas fa-edit"></i></button>
                                <button class="btn btn-sm btn-danger" onclick="deleteSubject(${i})"><i class="fas fa-trash"></i></button>
                            </div>
                        </div>`).join('')
                    : '<p style="color:var(--gray);padding:0.5rem 0;">No subjects yet. Add one below.</p>'}
            </div>
            <div class="add-subject-row">
                <input type="text" id="_newSubjectInput" class="form-control" placeholder="Enter new subject name..." onkeydown="if(event.key==='Enter')addSubject()">
                <button class="btn btn-primary" onclick="addSubject()"><i class="fas fa-plus"></i> Add Subject</button>
            </div>
            <p style="font-size:0.8rem;color:var(--gray);margin-top:0.75rem;"><i class="fas fa-info-circle"></i> Changes are saved to Firestore and take effect for all users immediately.</p>
        </div>`;
}

async function _saveSubjects(subjects) {
    const snap = await getDocs(query(collection(db,'subjects'),where('branch','==',_editBranch),where('semester','==',_editSem)));
    if (!snap.empty) {
        await updateDoc(doc(db,'subjects',snap.docs[0].id),{list:subjects,updatedAt:serverTimestamp()});
    } else {
        await addDoc(collection(db,'subjects'),{branch:_editBranch,semester:_editSem,list:subjects,createdAt:serverTimestamp()});
    }
    if (!subjectsData[_editBranch]) subjectsData[_editBranch] = {};
    subjectsData[_editBranch][_editSem] = subjects;
}

window.addSubject = async function() {
    const input = document.getElementById('_newSubjectInput');
    const name  = input?.value?.trim();
    if (!name) { showToast('Enter a subject name!','error'); return; }
    const subjects = [...(subjectsData[_editBranch]?.[_editSem] || [])];
    if (subjects.includes(name)) { showToast('Subject already exists!','error'); return; }
    subjects.push(name);
    try { await _saveSubjects(subjects); showToast('Subject added!','success'); _renderSubjectEditor(_editBranch,_editSem,subjects); }
    catch(e){ showToast('Failed: '+e.message,'error'); }
};

window.deleteSubject = async function(index) {
    if (!confirm('Remove this subject from the list?')) return;
    const subjects = [...(subjectsData[_editBranch]?.[_editSem] || [])];
    subjects.splice(index,1);
    try { await _saveSubjects(subjects); showToast('Subject removed!','success'); _renderSubjectEditor(_editBranch,_editSem,subjects); }
    catch(e){ showToast('Failed: '+e.message,'error'); }
};

window.editSubjectInline = function(index, currentName) {
    const item = document.getElementById(`_sItem_${index}`);
    if (!item) return;
    item.innerHTML = `
        <input type="text" class="form-control" id="_editIn_${index}" value="${currentName}" style="flex:1" onkeydown="if(event.key==='Enter')saveEditedSubject(${index},'${currentName.replace(/'/g,"&apos;")}');if(event.key==='Escape')cancelEdit(${index},'${currentName.replace(/'/g,"&apos;")}')"
        <div class="subject-item-actions">
            <button class="btn btn-sm btn-primary" onclick="saveEditedSubject(${index},'${currentName.replace(/'/g,"&apos;")}')"><i class="fas fa-check"></i></button>
            <button class="btn btn-sm" style="background:#e9ecef;color:#555" onclick="cancelEdit(${index},'${currentName.replace(/'/g,"&apos;")}')"><i class="fas fa-times"></i></button>
        </div>`;
    document.getElementById(`_editIn_${index}`)?.focus();
};

window.saveEditedSubject = async function(index, oldName) {
    const newName = document.getElementById(`_editIn_${index}`)?.value?.trim();
    if (!newName) { showToast('Name cannot be empty!','error'); return; }
    if (newName === oldName) { cancelEdit(index, oldName); return; }
    const subjects = [...(subjectsData[_editBranch]?.[_editSem] || [])];
    subjects[index] = newName;
    try { await _saveSubjects(subjects); showToast('Subject renamed!','success'); _renderSubjectEditor(_editBranch,_editSem,subjects); }
    catch(e){ showToast('Failed: '+e.message,'error'); }
};

window.cancelEdit = function(index, originalName) {
    _renderSubjectEditor(_editBranch, _editSem, subjectsData[_editBranch]?.[_editSem] || []);
};

window.resetSubjectsToDefault = async function() {
    const NAMES = {it:'IT',ce:'CE',me:'ME',ee:'EE'};
    if (!confirm(`Reset ${NAMES[_editBranch]} Semester ${_editSem} subjects to factory defaults?`)) return;
    const defaults = DEFAULT_SUBJECTS[_editBranch]?.[_editSem];
    if (!defaults) { showToast('No defaults available!','error'); return; }
    try { await _saveSubjects([...defaults]); showToast('Reset to defaults!','success'); _renderSubjectEditor(_editBranch,_editSem,[...defaults]); }
    catch(e){ showToast('Failed: '+e.message,'error'); }
};