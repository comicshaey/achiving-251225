const KEY = "haey_archive_records_v1";

function getRecords(){
  return HAEY.store.get(KEY, []);
}
function setRecords(arr){
  HAEY.store.set(KEY, arr);
}

function render(records){
  const listEl = document.getElementById("recordList");
  const tagCloudEl = document.getElementById("tagCloud");
  const tagFilter = (document.getElementById("tagFilter").value || "").trim();
  const sortMode = document.getElementById("sortMode").value;

  // 태그 클라우드 생성
  const tagCount = new Map();
  records.forEach(r=>{
    (r.tags||[]).forEach(t=>{
      tagCount.set(t, (tagCount.get(t)||0)+1);
    });
  });

  tagCloudEl.innerHTML = "";
  const tagsSorted = [...tagCount.entries()].sort((a,b)=>b[1]-a[1]);
  tagsSorted.forEach(([tag, cnt])=>{
    const btn = document.createElement("button");
    btn.className = "tag" + (tagFilter === tag ? " is-active" : "");
    btn.type = "button";
    btn.textContent = `${tag} (${cnt})`;
    btn.addEventListener("click", ()=>{
      document.getElementById("tagFilter").value = (tagFilter === tag) ? "" : tag;
      render(getRecords());
    });
    tagCloudEl.appendChild(btn);
  });

  // 필터/정렬
  let filtered = records.slice();
  if(tagFilter){
    filtered = filtered.filter(r => (r.tags||[]).includes(tagFilter));
  }
  filtered.sort((a,b)=>{
    const da = a.date || "";
    const db = b.date || "";
    return sortMode === "asc" ? da.localeCompare(db) : db.localeCompare(da);
  });

  // 리스트 렌더
  listEl.innerHTML = "";
  if(filtered.length === 0){
    const empty = document.createElement("div");
    empty.className = "muted";
    empty.textContent = "표시할 기록이 없습니다.";
    listEl.appendChild(empty);
    return;
  }

  filtered.forEach(r=>{
    const item = document.createElement("div");
    item.className = "item";

    const top = document.createElement("div");
    top.className = "item__top";

    const title = document.createElement("div");
    title.className = "item__title";
    title.textContent = r.title || "(제목 없음)";

    const date = document.createElement("div");
    date.className = "item__date";
    date.textContent = r.date || "";

    top.appendChild(title);
    top.appendChild(date);

    const tags = document.createElement("div");
    tags.className = "item__tags";
    (r.tags||[]).forEach(t=>{
      const span = document.createElement("span");
      span.className = "tag";
      span.textContent = t;
      span.addEventListener("click", ()=>{
        document.getElementById("tagFilter").value = t;
        render(getRecords());
      });
      tags.appendChild(span);
    });

    const body = document.createElement("div");
    body.className = "item__body";
    body.textContent = r.body || "";

    const actions = document.createElement("div");
    actions.style.display = "flex";
    actions.style.gap = "8px";
    actions.style.marginTop = "10px";

    const btnEdit = document.createElement("button");
    btnEdit.className = "btn";
    btnEdit.type = "button";
    btnEdit.textContent = "수정";
    btnEdit.addEventListener("click", ()=>{
      // 폼에 주입 (단순 수정)
      document.getElementById("recDate").value = r.date || "";
      document.getElementById("recTitle").value = r.title || "";
      document.getElementById("recTags").value = (r.tags||[]).join(",");
      document.getElementById("recBody").value = r.body || "";
      // 수정모드: 기존 id 저장
      document.getElementById("recordForm").dataset.editId = r.id;
      window.scrollTo({top:0, behavior:"smooth"});
    });

    const btnDel = document.createElement("button");
    btnDel.className = "btn btn--danger";
    btnDel.type = "button";
    btnDel.textContent = "삭제";
    btnDel.addEventListener("click", ()=>{
      if(!confirm("해당 기록을 삭제할까요?")) return;
      const next = getRecords().filter(x=>x.id !== r.id);
      setRecords(next);
      render(next);
    });

    actions.appendChild(btnEdit);
    actions.appendChild(btnDel);

    item.appendChild(top);
    item.appendChild(tags);
    item.appendChild(body);
    item.appendChild(actions);
    listEl.appendChild(item);
  });
}

document.addEventListener("DOMContentLoaded", ()=>{
  const form = document.getElementById("recordForm");

  form.addEventListener("submit", (e)=>{
    e.preventDefault();

    const date = document.getElementById("recDate").value;
    const title = document.getElementById("recTitle").value.trim();
    const tags = HAEY.store.toTagArray(document.getElementById("recTags").value);
    const body = document.getElementById("recBody").value;

    const editId = form.dataset.editId || "";
    const records = getRecords();

    if(editId){
      const idx = records.findIndex(r=>r.id === editId);
      if(idx >= 0){
        records[idx] = { ...records[idx], date, title, tags, body, updatedAt: Date.now() };
      }
      delete form.dataset.editId;
    }else{
      records.push({
        id: HAEY.store.uid(),
        date, title, tags, body,
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
    }

    setRecords(records);
    form.reset();
    // 날짜는 다시 오늘로 채움(common.js)
    render(records);
  });

  document.getElementById("tagFilter").addEventListener("input", ()=>render(getRecords()));
  document.getElementById("sortMode").addEventListener("change", ()=>render(getRecords()));

  document.getElementById("btnExport").addEventListener("click", ()=>{
    HAEY.store.downloadJSON("archive-records.json", getRecords());
  });

  document.getElementById("fileImport").addEventListener("change", async (e)=>{
    const file = e.target.files?.[0];
    if(!file) return;
    try{
      const data = await HAEY.store.readJSONFile(file);
      if(!Array.isArray(data)) throw new Error("형식 오류: 배열이 아닙니다.");
      // 최소한의 형태 보정
      const merged = data.map(x=>({
        id: x.id || HAEY.store.uid(),
        date: x.date || "",
        title: x.title || "",
        tags: Array.isArray(x.tags) ? x.tags : [],
        body: x.body || "",
        createdAt: x.createdAt || Date.now(),
        updatedAt: x.updatedAt || Date.now()
      }));
      setRecords(merged);
      render(merged);
      e.target.value = "";
      alert("가져오기 완료");
    }catch(err){
      console.error(err);
      alert("가져오기 실패: JSON 형식을 확인하세요.");
    }
  });

  document.getElementById("btnClear").addEventListener("click", ()=>{
    if(!confirm("기록관 전체 데이터를 삭제할까요? (되돌릴 수 없음)")) return;
    setRecords([]);
    render([]);
  });

  render(getRecords());
});