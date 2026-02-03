/* ============================================================
   Baustellenplaner – Demo (v3.6)
   iOS-FIX: kein ES-Module-Import mehr (three + OrbitControls via Loader)
   ============================================================ */
(function(){
  "use strict";

  // ===== UI helpers / Error visible =====
  const errToast = document.getElementById("errToast");
  const jsOk = document.getElementById("jsOk");
  function showErr(msg){
    console.error(msg);
    if(jsOk) jsOk.style.display = "none";
    if(errToast){
      errToast.textContent = String(msg);
      errToast.style.display = "block";
    }
  }
  window.addEventListener("error", (e)=> showErr(e.message || "Script error"));
  window.addEventListener("unhandledrejection", (e)=> showErr(e.reason?.message || e.reason || "Promise error"));
  if(jsOk) jsOk.style.display = "block";

  // ===== Guard: THREE + OrbitControls muss da sein (Loader lädt das vorher) =====
  if(!window.THREE){
    showErr("THREE ist nicht geladen. Prüfe, ob three.min.js im Network geladen wurde.");
    return;
  }
  if(!window.THREE.OrbitControls){
    showErr("OrbitControls ist nicht geladen. Prüfe, ob OrbitControls.js im Network geladen wurde.");
    return;
  }

  // ===== Safe storage =====
  const SafeStorage = {
    get(key){ try{ return localStorage.getItem(key); }catch(_){ return null; } },
    set(key,val){ try{ localStorage.setItem(key,val); return true; }catch(_){ return false; } }
  };

  /* ============================================================
     PARAMETER: Stahlträgerhalle
     ============================================================ */
  const HALL = {
    length: 60,
    width: 30,
    bay: 15,
    eaveH: 6.0,
    ridgeAdd: 1.5,
    steel: { col: 0.25, beam: 0.18 },
    cladding: { t: 0.08 },
    doors: [
      { side: "front", xCenter: -6, w: 6, h: 5 },
      { side: "front", xCenter:  6, w: 6, h: 5 },
    ]
  };
  const M = (v)=>v;

  /* ============================================================
     HUD MENU + MODE
     ============================================================ */
  const HUD = { mode:"navigate" };
  const hudMenuBtn  = document.getElementById("hudMenuBtn");
  const hudMenu     = document.getElementById("hudMenu");
  const hudModeText = document.getElementById("hudModeText");
  const hudItems    = Array.from(document.querySelectorAll(".hudItem"));

  if(!hudMenuBtn || !hudMenu || !hudModeText){
    showErr("HUD-Elemente fehlen (hudMenuBtn/hudMenu/hudModeText). Prüfe index.html IDs.");
    return;
  }

  function setMode(mode){
    HUD.mode = mode;
    const label = ({navigate:"Navigieren", issue:"Mangel anlegen", task:"Aufgabe anlegen"})[mode] || mode;
    hudModeText.textContent = `Modus: ${label}`;
    hudItems.forEach(b => b.classList.toggle("active", b.dataset.mode === mode));
    hudMenu.classList.add("hidden");
  }
  hudMenuBtn.addEventListener("click", ()=> hudMenu.classList.toggle("hidden"));

  /* ============================================================
     PROJECTS
     ============================================================ */
  const LS_KEY_PROJECTS = "vbplanner.projects.v1";
  const LS_KEY_ACTIVE   = "vbplanner.projects.activeId.v1";

  function loadProjects(){
    try{
      const raw = SafeStorage.get(LS_KEY_PROJECTS);
      const arr = raw ? JSON.parse(raw) : null;
      if(Array.isArray(arr) && arr.length) return arr;
    }catch(_){}
    return [{ id:"p_"+Date.now(), name:"Stahlträgerhalle Demo", location:"", createdAt:new Date().toISOString() }];
  }
  function saveProjects(list){ SafeStorage.set(LS_KEY_PROJECTS, JSON.stringify(list)); }
  function getActiveProjectId(projects){
    const saved = SafeStorage.get(LS_KEY_ACTIVE);
    if(saved && projects.some(p=>p.id===saved)) return saved;
    return projects[0]?.id;
  }
  function setActiveProjectId(id){ SafeStorage.set(LS_KEY_ACTIVE, id); }

  let projects = loadProjects(); saveProjects(projects);
  let activeProjectId = getActiveProjectId(projects); setActiveProjectId(activeProjectId);

  const projectSelect = document.getElementById("projectSelect");
  const projectAddBtn = document.getElementById("projectAddBtn");
  const hudTitleTop   = document.querySelector("#hudTitle .t1");

  // Project modal
  const projectModal       = document.getElementById("projectModal");
  const projectModalClose  = document.getElementById("projectModalClose");
  const projectModalCancel = document.getElementById("projectModalCancel");
  const projectModalCreate = document.getElementById("projectModalCreate");
  const projectName        = document.getElementById("projectName");
  const projectLocation    = document.getElementById("projectLocation");

  function renderProjectSelect(){
    if(!projectSelect) return;
    projectSelect.innerHTML="";
    projects.forEach(p=>{
      const opt=document.createElement("option");
      opt.value=p.id;
      opt.textContent = p.location ? `${p.name} · ${p.location}` : p.name;
      projectSelect.appendChild(opt);
    });
    projectSelect.value = activeProjectId;
    const active = projects.find(p=>p.id===activeProjectId);
    if(active && hudTitleTop) hudTitleTop.textContent = active.name || "Projekt";
  }

  function openProjectModal(){
    if(!projectModal) return;
    projectName.value=""; projectLocation.value="";
    projectModal.classList.remove("hidden");
    setTimeout(()=> projectName.focus(), 30);
  }
  function closeProjectModal(){ projectModal && projectModal.classList.add("hidden"); }

  projectAddBtn && projectAddBtn.addEventListener("click", openProjectModal);
  projectModalClose && projectModalClose.addEventListener("click", closeProjectModal);
  projectModalCancel && projectModalCancel.addEventListener("click", closeProjectModal);
  projectModal && projectModal.addEventListener("click", (e)=>{ if(e.target===projectModal) closeProjectModal(); });
  projectModalCreate && projectModalCreate.addEventListener("click", ()=>{
    const name=(projectName.value||"").trim();
    const loc =(projectLocation.value||"").trim();
    if(!name){ alert("Bitte einen Projektnamen eingeben."); return; }
    const p={ id:"p_"+Date.now(), name, location:loc, createdAt:new Date().toISOString() };
    projects=[p, ...projects]; saveProjects(projects);
    activeProjectId=p.id; setActiveProjectId(activeProjectId);
    renderProjectSelect(); closeProjectModal();
    refreshAllCountsAndLists();
    rebuildMarkers();
  });

  projectSelect && projectSelect.addEventListener("change", ()=>{
    activeProjectId = projectSelect.value;
    setActiveProjectId(activeProjectId);
    renderProjectSelect();
    refreshAllCountsAndLists();
    rebuildMarkers();
  });

  /* ============================================================
     STORAGE: ISSUES + TASKS
     ============================================================ */
  const LS_KEY_ISSUES = "vbplanner.issues.v2";
  const LS_KEY_TASKS  = "vbplanner.tasks.v2";
  function loadList(key){
    try{
      const raw = SafeStorage.get(key);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    }catch(_){ return []; }
  }
  function saveList(key, list){ SafeStorage.set(key, JSON.stringify(list)); }

  let issues = loadList(LS_KEY_ISSUES);
  let tasks  = loadList(LS_KEY_TASKS);

  function issuesForActive(){ return issues.filter(i=>i.projectId===activeProjectId); }
  function tasksForActive(){ return tasks.filter(t=>t.projectId===activeProjectId); }

  const issueBadge = document.getElementById("issueBadge");
  const taskBadge  = document.getElementById("taskBadge");

  /* ============================================================
     LIST OVERLAYS
     ============================================================ */
  const issuesOverlay = document.getElementById("issuesOverlay");
  const issuesClose   = document.getElementById("issuesClose");
  const issuesFilters = document.getElementById("issuesFilters");
  const issuesList    = document.getElementById("issuesList");

  const tasksOverlay  = document.getElementById("tasksOverlay");
  const tasksClose    = document.getElementById("tasksClose");
  const tasksFilters  = document.getElementById("tasksFilters");
  const tasksList     = document.getElementById("tasksList");

  issuesClose && issuesClose.addEventListener("click", ()=> issuesOverlay.classList.add("hidden"));
  tasksClose  && tasksClose.addEventListener("click", ()=> tasksOverlay.classList.add("hidden"));
  issuesOverlay && issuesOverlay.addEventListener("click", (e)=>{ if(e.target===issuesOverlay) issuesOverlay.classList.add("hidden"); });
  tasksOverlay  && tasksOverlay.addEventListener("click", (e)=>{ if(e.target===tasksOverlay) tasksOverlay.classList.add("hidden"); });

  let issuesFilterState = "Alle";
  let tasksFilterState  = "Alle";

  function mkChip(label, active, onClick){
    const b=document.createElement("button");
    b.className="chip"+(active?" active":"");
    b.textContent=label;
    b.addEventListener("click", onClick);
    return b;
  }

  function escapeHtml(s){
    return String(s??"")
      .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
      .replaceAll('"',"&quot;");
  }

  function renderIssuesOverlay(){
    const list = issuesForActive();
    const filters = ["Alle","Neu","In Arbeit","Erledigt"];
    issuesFilters.innerHTML="";
    filters.forEach(f=>{
      issuesFilters.appendChild(mkChip(f, issuesFilterState===f, ()=>{ issuesFilterState=f; renderIssuesOverlay(); }));
    });
    const shown = list.filter(i => issuesFilterState==="Alle" ? true : (i.status===issuesFilterState));
    issuesList.innerHTML="";
    if(!shown.length){
      issuesList.innerHTML='<div style="opacity:0.7;padding:10px 6px;">Keine Mängel.</div>';
      return;
    }
    shown.forEach(i=>{
      const div=document.createElement("div");
      div.className="rowItem";
      div.innerHTML=`
        <div class="left">
          <div class="t">${escapeHtml(i.text||"(ohne Text)")}</div>
          <div class="s">${escapeHtml(i.status||"")} · ${escapeHtml(i.elementLabel||"-")} · ${escapeHtml(i.loc||"")}</div>
          <div class="s">Fällig: ${escapeHtml(i.due||"-")} · Verantwortlich: ${escapeHtml(i.assignee||"-")}</div>
        </div>
        <div class="right"><button class="miniBtn" data-edit="1">Bearbeiten</button></div>
      `;
      div.querySelector('[data-edit="1"]').addEventListener("click", ()=> openIssueEdit(i));
      issuesList.appendChild(div);
    });
  }

  function renderTasksOverlay(){
    const list = tasksForActive();
    const filters = ["Alle","Offen","In Arbeit","Erledigt"];
    tasksFilters.innerHTML="";
    filters.forEach(f=>{
      tasksFilters.appendChild(mkChip(f, tasksFilterState===f, ()=>{ tasksFilterState=f; renderTasksOverlay(); }));
    });
    const shown = list.filter(t => tasksFilterState==="Alle" ? true : (t.status===tasksFilterState));
    tasksList.innerHTML="";
    if(!shown.length){
      tasksList.innerHTML='<div style="opacity:0.7;padding:10px 6px;">Keine Aufgaben.</div>';
      return;
    }
    shown.forEach(t=>{
      const div=document.createElement("div");
      div.className="rowItem";
      div.innerHTML=`
        <div class="left">
          <div class="t">${escapeHtml(t.text||"(ohne Text)")}</div>
          <div class="s">${escapeHtml(t.status||"")} · ${escapeHtml(t.elementLabel||"-")} · ${escapeHtml(t.loc||"")}</div>
          <div class="s">Fällig: ${escapeHtml(t.due||"-")} · Verantwortlich: ${escapeHtml(t.assignee||"-")}</div>
        </div>
        <div class="right"><button class="miniBtn" data-edit="1">Bearbeiten</button></div>
      `;
      div.querySelector('[data-edit="1"]').addEventListener("click", ()=> openTaskEdit(t));
      tasksList.appendChild(div);
    });
  }

  function refreshAllCountsAndLists(){
    const ic = issuesForActive().length;
    const tc = tasksForActive().length;
    if(issueBadge) issueBadge.textContent=String(ic);
    if(taskBadge)  taskBadge.textContent=String(tc);
    if(issuesOverlay && !issuesOverlay.classList.contains("hidden")) renderIssuesOverlay();
    if(tasksOverlay  && !tasksOverlay.classList.contains("hidden")) renderTasksOverlay();
  }

  /* ============================================================
     MODALS: ISSUE + TASK
     ============================================================ */
  const issueModal = document.getElementById("issueModal");
  const issueModalTitle = document.getElementById("issueModalTitle");
  const issueModalClose = document.getElementById("issueModalClose");
  const issueCancel = document.getElementById("issueCancel");
  const issueSave = document.getElementById("issueSave");
  const issueDelete = document.getElementById("issueDelete");
  const issueStatus = document.getElementById("issueStatus");
  const issueDue = document.getElementById("issueDue");
  const issueText = document.getElementById("issueText");
  const issueAssignee = document.getElementById("issueAssignee");
  const issuePhoto = document.getElementById("issuePhoto");
  const issuePhotoPreview = document.getElementById("issuePhotoPreview");
  const issuePhotoClear = document.getElementById("issuePhotoClear");
  const issueElementInfo = document.getElementById("issueElementInfo");

  const taskModal = document.getElementById("taskModal");
  const taskModalTitle = document.getElementById("taskModalTitle");
  const taskModalClose = document.getElementById("taskModalClose");
  const taskCancel = document.getElementById("taskCancel");
  const taskSave = document.getElementById("taskSave");
  const taskDelete = document.getElementById("taskDelete");
  const taskStatus = document.getElementById("taskStatus");
  const taskDue = document.getElementById("taskDue");
  const taskText = document.getElementById("taskText");
  const taskAssignee = document.getElementById("taskAssignee");
  const taskElementInfo = document.getElementById("taskElementInfo");

  function openModal(m){ m && m.classList.remove("hidden"); }
  function closeModal(m){ m && m.classList.add("hidden"); }

  issueModalClose && issueModalClose.addEventListener("click", ()=> closeModal(issueModal));
  issueCancel && issueCancel.addEventListener("click", ()=> closeModal(issueModal));
  issueModal && issueModal.addEventListener("click", (e)=>{ if(e.target===issueModal) closeModal(issueModal); });

  taskModalClose && taskModalClose.addEventListener("click", ()=> closeModal(taskModal));
  taskCancel && taskCancel.addEventListener("click", ()=> closeModal(taskModal));
  taskModal && taskModal.addEventListener("click", (e)=>{ if(e.target===taskModal) closeModal(taskModal); });

  let issueEditId=null, issuePendingElement=null, issuePhotoDataUrl="";
  let taskEditId=null, taskPendingElement=null;

  function resetIssueModal(){
    issueEditId=null; issuePendingElement=null;
    issueStatus.value="Neu"; issueDue.value=""; issueText.value=""; issueAssignee.value="";
    issuePhotoDataUrl=""; issuePhoto.value="";
    issuePhotoPreview.style.display="none"; issuePhotoPreview.src="";
    issueElementInfo.textContent="-";
    issueDelete.style.display="none";
  }
  function resetTaskModal(){
    taskEditId=null; taskPendingElement=null;
    taskStatus.value="Offen"; taskDue.value=""; taskText.value=""; taskAssignee.value="";
    taskElementInfo.textContent="-";
    taskDelete.style.display="none";
  }

  function fileToDataUrl(file){
    return new Promise((resolve,reject)=>{
      const r=new FileReader();
      r.onload=()=>resolve(r.result);
      r.onerror=()=>reject(r.error);
      r.readAsDataURL(file);
    });
  }

  issuePhoto && issuePhoto.addEventListener("change", async ()=>{
    const f = issuePhoto.files && issuePhoto.files[0];
    if(!f) return;
    const data = await fileToDataUrl(f);
    issuePhotoDataUrl = data;
    issuePhotoPreview.src=data;
    issuePhotoPreview.style.display="block";
  });
  issuePhotoClear && issuePhotoClear.addEventListener("click", ()=>{
    issuePhoto.value=""; issuePhotoDataUrl="";
    issuePhotoPreview.style.display="none"; issuePhotoPreview.src="";
  });

  function openIssueCreateForElement(meta){
    resetIssueModal();
    issuePendingElement=meta;
    issueModalTitle.textContent="Neuer Mangel";
    issueElementInfo.textContent = `${meta.label||"Bauteil"} (${meta.id||"-"})`;
    openModal(issueModal);
  }
  function openIssueEdit(issue){
    resetIssueModal();
    issueEditId=issue.id;
    issueModalTitle.textContent="Mangel bearbeiten";
    issueStatus.value=issue.status||"Neu";
    issueDue.value=issue.due||"";
    issueText.value=issue.text||"";
    issueAssignee.value=issue.assignee||"";
    issuePhotoDataUrl=issue.photo||"";
    if(issuePhotoDataUrl){ issuePhotoPreview.src=issuePhotoDataUrl; issuePhotoPreview.style.display="block"; }
    issueElementInfo.textContent = `${issue.elementLabel||"Bauteil"} (${issue.elementId||"-"})`;
    issueDelete.style.display="inline-block";
    openModal(issueModal);
  }

  function openTaskCreateForElement(meta){
    resetTaskModal();
    taskPendingElement=meta;
    taskModalTitle.textContent="Neue Aufgabe";
    taskElementInfo.textContent = `${meta.label||"Bauteil"} (${meta.id||"-"})`;
    openModal(taskModal);
  }
  function openTaskEdit(task){
    resetTaskModal();
    taskEditId=task.id;
    taskModalTitle.textContent="Aufgabe bearbeiten";
    taskStatus.value=task.status||"Offen";
    taskDue.value=task.due||"";
    taskText.value=task.text||"";
    taskAssignee.value=task.assignee||"";
    taskElementInfo.textContent = `${task.elementLabel||"Bauteil"} (${task.elementId||"-"})`;
    taskDelete.style.display="inline-block";
    openModal(taskModal);
  }

  issueSave && issueSave.addEventListener("click", ()=>{
    const data={
      status: issueStatus.value,
      due: issueDue.value,
      text: (issueText.value||"").trim(),
      assignee: (issueAssignee.value||"").trim(),
      photo: issuePhotoDataUrl||""
    };
    if(!data.text){ alert("Bitte einen Text eingeben."); return; }

    if(issueEditId){
      const idx=issues.findIndex(i=>i.id===issueEditId);
      if(idx>=0) issues[idx]={...issues[idx],...data,updatedAt:new Date().toISOString()};
    }else{
      const el=issuePendingElement||{};
      const issue={
        id:"i_"+Date.now(),
        projectId: activeProjectId,
        createdAt:new Date().toISOString(),
        elementId: el.id||"",
        elementLabel: el.label||"",
        elementType: el.type||"",
        loc: el.loc||"",
        ...data
      };
      issues=[issue,...issues];
    }
    saveList(LS_KEY_ISSUES, issues);
    closeModal(issueModal);
    refreshAllCountsAndLists();
    rebuildMarkers();
  });

  issueDelete && issueDelete.addEventListener("click", ()=>{
    if(!issueEditId) return;
    if(!confirm("Mangel wirklich löschen?")) return;
    issues = issues.filter(i=>i.id!==issueEditId);
    saveList(LS_KEY_ISSUES, issues);
    closeModal(issueModal);
    refreshAllCountsAndLists();
    rebuildMarkers();
  });

  taskSave && taskSave.addEventListener("click", ()=>{
    const data={
      status: taskStatus.value,
      due: taskDue.value,
      text: (taskText.value||"").trim(),
      assignee: (taskAssignee.value||"").trim()
    };
    if(!data.text){ alert("Bitte einen Text eingeben."); return; }

    if(taskEditId){
      const idx=tasks.findIndex(t=>t.id===taskEditId);
      if(idx>=0) tasks[idx]={...tasks[idx],...data,updatedAt:new Date().toISOString()};
    }else{
      const el=taskPendingElement||{};
      const task={
        id:"t_"+Date.now(),
        projectId: activeProjectId,
        createdAt:new Date().toISOString(),
        elementId: el.id||"",
        elementLabel: el.label||"",
        elementType: el.type||"",
        loc: el.loc||"",
        ...data
      };
      tasks=[task,...tasks];
    }
    saveList(LS_KEY_TASKS, tasks);
    closeModal(taskModal);
    refreshAllCountsAndLists();
    rebuildMarkers();
  });

  taskDelete && taskDelete.addEventListener("click", ()=>{
    if(!taskEditId) return;
    if(!confirm("Aufgabe wirklich löschen?")) return;
    tasks = tasks.filter(t=>t.id!==taskEditId);
    saveList(LS_KEY_TASKS, tasks);
    closeModal(taskModal);
    refreshAllCountsAndLists();
    rebuildMarkers();
  });

  /* ============================================================
     EXPORT
     ============================================================ */
  function downloadText(filename, text, mime){
    const blob=new Blob([text],{type:mime||"text/plain"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url; a.download=filename;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }
  function toCsv(rows, cols){
    const esc=(v)=>`"${String(v??"").replaceAll('"','""')}"`;
    const head=cols.map(esc).join(",");
    const body=rows.map(r=>cols.map(c=>esc(r[c])).join(",")).join("\n");
    return head+"\n"+body;
  }
  function doExport(){
    const p=projects.find(x=>x.id===activeProjectId);
    const pName=(p?.name||"projekt").replaceAll(" ","_");
    const i=issuesForActive(), t=tasksForActive();
    const choice=prompt("Export: 1=Issues JSON, 2=Issues CSV, 3=Tasks JSON, 4=Tasks CSV","1");
    if(!choice) return;
    if(choice==="1") downloadText(`${pName}_maengel.json`, JSON.stringify(i,null,2), "application/json");
    else if(choice==="2"){
      const cols=["id","status","due","assignee","text","elementId","elementLabel","loc","createdAt"];
      downloadText(`${pName}_maengel.csv`, toCsv(i,cols), "text/csv");
    }else if(choice==="3") downloadText(`${pName}_aufgaben.json`, JSON.stringify(t,null,2), "application/json");
    else if(choice==="4"){
      const cols=["id","status","due","assignee","text","elementId","elementLabel","loc","createdAt"];
      downloadText(`${pName}_aufgaben.csv`, toCsv(t,cols), "text/csv");
    }
  }

  /* ============================================================
     MENU ACTIONS
     ============================================================ */
  hudItems.forEach(btn=>{
    btn.addEventListener("click", ()=>{
      if(btn.dataset.mode){ setMode(btn.dataset.mode); return; }
      const act=btn.dataset.action;
      if(act==="showIssues"){ issuesOverlay.classList.remove("hidden"); renderIssuesOverlay(); hudMenu.classList.add("hidden"); }
      else if(act==="showTasks"){ tasksOverlay.classList.remove("hidden"); renderTasksOverlay(); hudMenu.classList.add("hidden"); }
      else if(act==="exportMenu"){ hudMenu.classList.add("hidden"); doExport(); }
    });
  });

  /* ============================================================
     3D: Szene, Kamera, Renderer, Controls (global THREE)
     ============================================================ */
  const THREE = window.THREE;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xe9eef3);

  const camera = new THREE.PerspectiveCamera(55, window.innerWidth/window.innerHeight, 0.05, 500);
  camera.position.set(M(55), M(28), M(55));

  const renderer = new THREE.WebGLRenderer({ antialias:true, alpha:false });
  renderer.setClearColor(0xe9eef3, 1);
  renderer.domElement.style.position="fixed";
  renderer.domElement.style.inset="0";
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
  renderer.shadowMap.enabled=true;
  document.body.appendChild(renderer.domElement);

  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping=true;
  controls.target.set(0, M(3), 0);

  // Licht
  scene.add(new THREE.HemisphereLight(0xffffff, 0x6a7680, 1.0));
  const sun = new THREE.DirectionalLight(0xffffff, 1.0);
  sun.position.set(M(80), M(60), M(40));
  sun.castShadow=true;
  sun.shadow.mapSize.set(2048,2048);
  scene.add(sun);

  // Boden + Grid
  const floorGeo = new THREE.PlaneGeometry(M(140), M(140));
  const floorMat = new THREE.MeshStandardMaterial({ color:0xd6dde6, roughness:0.9, metalness:0.0 });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x=-Math.PI/2;
  floor.receiveShadow=true;
  scene.add(floor);

  const grid = new THREE.GridHelper(M(140), 140, 0x9aa6b2, 0xc0c9d3);
  grid.position.y=0.01;
  scene.add(grid);

  // Materialien
  const matSteel = new THREE.MeshStandardMaterial({ color:0x6f7a86, metalness:0.6, roughness:0.35 });
  const matPanel = new THREE.MeshStandardMaterial({ color:0xf2f4f7, metalness:0.05, roughness:0.85 });
  const matRoof  = new THREE.MeshStandardMaterial({ color:0xdfe3e8, metalness:0.08, roughness:0.9 });
  const matDoor  = new THREE.MeshStandardMaterial({ color:0xbac2cc, metalness:0.12, roughness:0.75 });

  const L=M(HALL.length), W=M(HALL.width), bay=M(HALL.bay);
  const eaveH=M(HALL.eaveH), ridgeH=eaveH+M(HALL.ridgeAdd);
  const halfL=L/2, halfW=W/2;

  const hallGroup = new THREE.Group();
  scene.add(hallGroup);

  function addBox(w,h,d,x,y,z,mat,cast=true,receive=false,meta=null){
    const geo=new THREE.BoxGeometry(w,h,d);
    const mesh=new THREE.Mesh(geo,mat);
    mesh.position.set(x,y,z);
    mesh.castShadow=cast; mesh.receiveShadow=receive;
    if(meta) mesh.userData = meta;
    hallGroup.add(mesh);
    return mesh;
  }

  const nz = Math.round(L/bay);

  // Stützen (mit Meta -> anklickbar)
  for(let iz=0; iz<=nz; iz++){
    const z = -halfL + iz*bay;
    addBox(M(HALL.steel.col), eaveH, M(HALL.steel.col), -halfW, eaveH/2, z, matSteel, true, false, {
      type:"Stütze", id:`COL-L-Z${iz}`, loc:`Raster Z${iz} links`, label:`Stütze links Z${iz}`
    });
    addBox(M(HALL.steel.col), eaveH, M(HALL.steel.col),  halfW, eaveH/2, z, matSteel, true, false, {
      type:"Stütze", id:`COL-R-Z${iz}`, loc:`Raster Z${iz} rechts`, label:`Stütze rechts Z${iz}`
    });
  }

  // Querrahmen + Sparren
  for(let iz=0; iz<=nz; iz++){
    const z = -halfL + iz*bay;
    addBox(W + M(HALL.steel.col), M(HALL.steel.beam), M(HALL.steel.beam), 0, eaveH, z, matSteel);

    const rise = ridgeH-eaveH;
    const slopeLen = Math.sqrt(halfW*halfW + rise*rise);
    const slopeT = M(HALL.steel.beam);

    const leftSlope = addBox(slopeLen, slopeT, slopeT, -halfW/2, eaveH + rise/2, z, matSteel);
    leftSlope.rotation.z = Math.atan2(rise, halfW);

    const rightSlope = addBox(slopeLen, slopeT, slopeT,  halfW/2, eaveH + rise/2, z, matSteel);
    rightSlope.rotation.z = -Math.atan2(rise, halfW);
  }

  // Dachflächen
  {
    const rise=ridgeH-eaveH;
    const slopeLen = Math.sqrt(halfW*halfW + rise*rise);
    const roofT=M(0.12);
    const roofL = addBox(slopeLen, roofT, L, -halfW/2, eaveH + rise/2, 0, matRoof, false, false);
    roofL.rotation.z=Math.atan2(rise, halfW);
    const roofR = addBox(slopeLen, roofT, L,  halfW/2, eaveH + rise/2, 0, matRoof, false, false);
    roofR.rotation.z=-Math.atan2(rise, halfW);
  }

  // Wände + Stirnseiten mit Toren
  const panelT=M(HALL.cladding.t);
  addBox(panelT, eaveH, L, -halfW, eaveH/2, 0, matPanel, false, false);
  addBox(panelT, eaveH, L,  halfW, eaveH/2, 0, matPanel, false, false);

  function doorCutsForSide(side){ return HALL.doors.filter(d=>d.side===side); }
  function addEndWallWithDoors(zPos, side){
    const doors=doorCutsForSide(side);
    if(!doors.length){
      addBox(W,eaveH,panelT,0,eaveH/2,zPos,matPanel,false,false);
      addBox(W*0.70,(ridgeH-eaveH),panelT,0,eaveH+(ridgeH-eaveH)/2,zPos,matPanel,false,false);
      return;
    }
    doors.sort((a,b)=>a.xCenter-b.xCenter);
    let xLeft=-halfW;
    for(const d of doors){
      const halfDoorW=M(d.w)/2;
      const cutL=M(d.xCenter)-halfDoorW;
      const cutR=M(d.xCenter)+halfDoorW;
      const segW1=cutL-xLeft;
      if(segW1>0.05) addBox(segW1,eaveH,panelT,xLeft+segW1/2,eaveH/2,zPos,matPanel,false,false);
      const overH=eaveH-M(d.h);
      if(overH>0.05){
        addBox(M(d.w),overH,panelT,M(d.xCenter),M(d.h)+overH/2,zPos,matPanel,false,false);
        addBox(M(d.w)*0.96,M(d.h)*0.96,panelT*0.8,
          M(d.xCenter),M(d.h)/2,
          zPos + (panelT*0.2)*(side==="front"?-1:1),
          matDoor,false,false,
          { type:"Rolltor", id:`DOOR-${side}-${d.xCenter}`, loc:`Stirnwand ${side}`, label:`Rolltor ${side} X${d.xCenter}` }
        );
      }
      xLeft=cutR;
    }
    const segW2=halfW-xLeft;
    if(segW2>0.05) addBox(segW2,eaveH,panelT,xLeft+segW2/2,eaveH/2,zPos,matPanel,false,false);
    addBox(W*0.70,(ridgeH-eaveH),panelT,0,eaveH+(ridgeH-eaveH)/2,zPos,matPanel,false,false);
  }
  addEndWallWithDoors(-halfL,"front");
  addEndWallWithDoors( halfL,"back");

  // Sockel
  addBox(W+panelT*2,M(0.12),L+panelT*2,0,M(0.06),0,
    new THREE.MeshStandardMaterial({ color:0xc7cfd9, roughness:0.95, metalness:0.0 }),
    false,true
  );

  /* ============================================================
     MARKERS
     ============================================================ */
  const markerGroup=new THREE.Group();
  scene.add(markerGroup);

  function statusColorIssue(status){
    if(status==="Erledigt") return 0x2f9e44;
    if(status==="In Arbeit") return 0xf2c94c;
    return 0xd64747;
  }
  function statusColorTask(status){
    if(status==="Erledigt") return 0x2f9e44;
    if(status==="In Arbeit") return 0xf2c94c;
    return 0x2b6cb0;
  }

  function rebuildMarkers(){
    markerGroup.clear();

    const byElIssue=new Map();
    for(const it of issuesForActive()){
      if(!it.elementId) continue;
      const prev=byElIssue.get(it.elementId);
      const prio=(s)=> (s==="Neu"?3 : s==="In Arbeit"?2 : 1);
      if(!prev || prio(it.status)>prio(prev.status)) byElIssue.set(it.elementId,it);
    }

    const byElTask=new Map();
    for(const t of tasksForActive()){
      if(!t.elementId) continue;
      const prev=byElTask.get(t.elementId);
      const prio=(s)=> (s==="Offen"?3 : s==="In Arbeit"?2 : 1);
      if(!prev || prio(t.status)>prio(prev.status)) byElTask.set(t.elementId,t);
    }

    const sphereGeo=new THREE.SphereGeometry(0.35,14,14);

    function addMarkerForObject(obj,color,yOffset){
      const mat=new THREE.MeshStandardMaterial({ color, metalness:0.0, roughness:0.4, emissive:color, emissiveIntensity:0.12 });
      const m=new THREE.Mesh(sphereGeo,mat);
      const box=new THREE.Box3().setFromObject(obj);
      const topY=box.max.y;
      const center=new THREE.Vector3();
      box.getCenter(center);
      m.position.set(center.x, topY + (yOffset||0.4), center.z);
      markerGroup.add(m);
    }

    hallGroup.traverse((obj)=>{
      if(!obj.isMesh) return;
      const id=obj.userData && obj.userData.id;
      if(!id) return;
      const iss=byElIssue.get(id);
      const tsk=byElTask.get(id);
      if(iss) addMarkerForObject(obj,statusColorIssue(iss.status),0.45);
      if(tsk) addMarkerForObject(obj,statusColorTask(tsk.status),1.05);
    });
  }

  /* ============================================================
     PICKING
     ============================================================ */
  const raycaster=new THREE.Raycaster();
  const pointer=new THREE.Vector2();

  function pickAt(clientX, clientY){
    const rect=renderer.domElement.getBoundingClientRect();
    pointer.x=((clientX-rect.left)/rect.width)*2-1;
    pointer.y=-(((clientY-rect.top)/rect.height)*2-1);
    raycaster.setFromCamera(pointer,camera);
    const hits=raycaster.intersectObjects(hallGroup.children,true);
    if(!hits.length) return null;
    for(const h of hits){
      const o=h.object;
      if(o && o.userData && o.userData.id) return o;
    }
    return hits[0].object;
  }

  renderer.domElement.addEventListener("pointerdown",(e)=>{
    hudMenu.classList.add("hidden");
    const obj=pickAt(e.clientX,e.clientY);
    if(!obj) return;
    const meta=obj.userData||{};
    if(HUD.mode==="issue") openIssueCreateForElement(meta);
    else if(HUD.mode==="task") openTaskCreateForElement(meta);
  });

  /* ============================================================
     Startzustand
     ============================================================ */
  setMode("navigate");
  renderProjectSelect();
  refreshAllCountsAndLists();
  rebuildMarkers();

  /* ============================================================
     Resize + Loop
     ============================================================ */
  function onResize(){
    camera.aspect=window.innerWidth/window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener("resize", onResize);

  function animate(){
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene,camera);
  }
  animate();

})();
