// ✅ 공용(JSON) 일정: 모든 기기 동일 표시
// - 원본: /data/work-calendar-events.json
// - 정적 호스팅이라 브라우저에서 GitHub 파일을 "직접 저장"은 불가
//   => 편집 후 내보내기(JSON) -> GitHub에서 JSON 파일에 반영(커밋)하면 동기화됨

const DATA_URL = "./data/work-calendar-events.json";
const LOCAL_DRAFT_KEY = "haey_work_calendar_draft_v1"; // 임시 편집(선택)

function cacheBusted(url){
  // GitHub Pages 캐시 회피용(필수급)
  return `${url}?v=${Date.now()}`;
}

async function loadSharedEvents(){
  const res = await fetch(cacheBusted(DATA_URL), { cache: "no-store" });
  if(!res.ok) throw new Error(`일정 JSON 로드 실패: ${res.status}`);
  const data = await res.json();
  if(!Array.isArray(data)) throw new Error("일정 JSON 형식 오류: 배열이 아님");
  return data.map(x => ({
    id: String(x.id || HAEY.store.uid()),
    title: x.title || "",
    start: x.start || "",
    end: x.end || "",
    memo: x.memo || ""
  }));
}

function loadDraft(){
  return HAEY.store.get(LOCAL_DRAFT_KEY, []);
}

function saveDraft(arr){
  HAEY.store.set(LOCAL_DRAFT_KEY, arr);
}

function clearDraft(){
  HAEY.store.set(LOCAL_DRAFT_KEY, []);
}

function toLocalDT(dt){
  const d = new Date(dt);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const dd = String(d.getDate()).padStart(2,"0");
  const hh = String(d.getHours()).padStart(2,"0");
  const mi = String(d.getMinutes()).padStart(2,"0");
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function normalizeEnd(startStr, endStr){
  if(endStr) return endStr;
  const s = new Date(startStr);
  const e = new Date(s.getTime() + 30*60*1000);
  return toLocalDT(e);
}

function openModal(){
  document.getElementById("eventModal").classList.add("is-open");
  document.getElementById("eventModal").setAttribute("aria-hidden", "false");
}
function closeModal(){
  document.getElementById("eventModal").classList.remove("is-open");
  document.getElementById("eventModal").setAttribute("aria-hidden", "true");
}

function mergeSharedAndDraft(shared, draft){
  // draft가 같은 id면 draft 우선
  const m = new Map();
  shared.forEach(ev => m.set(ev.id, ev));
  draft.forEach(ev => m.set(ev.id, ev));
  return [...m.values()];
}

document.addEventListener("DOMContentLoaded", async ()=>{
  const calendarEl = document.getElementById("calendar");
  const modal = document.getElementById("eventModal");

  modal.addEventListener("click", (e)=>{
    if(e.target?.dataset?.close) closeModal();
  });

  let sharedEvents = [];
  let draftEvents = loadDraft();
  let allEvents = [];

  try{
    sharedEvents = await loadSharedEvents();
  }catch(err){
    console.error(err);
    alert("공용 일정(JSON)을 불러오지 못했습니다. /data/work-calendar-events.json 경로와 JSON 형식을 확인하세요.");
    sharedEvents = [];
  }

  allEvents = mergeSharedAndDraft(sharedEvents, draftEvents);

  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: "dayGridMonth",
    height: "auto",
    locale: "ko",
    firstDay: 1,
    selectable: true,
    nowIndicator: true,

    headerToolbar: {
      left: "prev,next today reloadShared",
      center: "title",
      right: "dayGridMonth,timeGridWeek,twoDay"
    },

    customButtons: {
      reloadShared: {
        text: "공용 JSON 새로고침",
        click: async ()=>{
          try{
            sharedEvents = await loadSharedEvents();
            allEvents = mergeSharedAndDraft(sharedEvents, loadDraft());
            calendar.getEvents().forEach(ev=>ev.remove());
            allEvents.forEach(ev=>calendar.addEvent(ev));
            alert("공용 JSON 새로고침 완료");
          }catch(err){
            console.error(err);
            alert("새로고침 실패: 공용 JSON 로드 오류");
          }
        }
      }
    },

    views: {
      twoDay: { type:"timeGrid", duration:{days:2}, buttonText:"오늘/내일(2일)" }
    },

    events: allEvents,

    select: (info)=>{
      // ✅ 임시 편집(draft)로 저장 (공용 JSON은 직접 수정 불가)
      document.getElementById("modalTitle").textContent = "일정 추가(임시)";
      document.getElementById("evtId").value = "";
      document.getElementById("evtTitle").value = "";
      document.getElementById("evtStart").value = toLocalDT(info.start);
      document.getElementById("evtEnd").value = toLocalDT(info.end);
      document.getElementById("evtMemo").value = "";
      document.getElementById("btnDeleteEvent").style.display = "none";
      openModal();
    },

    eventClick: (info)=>{
      const ev = info.event;
      document.getElementById("modalTitle").textContent = "일정 수정(임시)";
      document.getElementById("evtId").value = ev.id;
      document.getElementById("evtTitle").value = ev.title || "";
      document.getElementById("evtStart").value = toLocalDT(ev.start);
      document.getElementById("evtEnd").value = ev.end ? toLocalDT(ev.end) : "";
      document.getElementById("evtMemo").value = ev.extendedProps?.memo || "";
      document.getElementById("btnDeleteEvent").style.display = "inline-block";
      openModal();
    }
  });

  calendar.render();

  // 상단 버튼들
  document.getElementById("btnNewEvent").addEventListener("click", ()=>{
    const now = new Date();
    const start = toLocalDT(now);
    const end = normalizeEnd(start, "");

    document.getElementById("modalTitle").textContent = "일정 추가(임시)";
    document.getElementById("evtId").value = "";
    document.getElementById("evtTitle").value = "";
    document.getElementById("evtStart").value = start;
    document.getElementById("evtEnd").value = end;
    document.getElementById("evtMemo").value = "";
    document.getElementById("btnDeleteEvent").style.display = "none";
    openModal();
  });

  // 저장: draft에 저장
  document.getElementById("eventForm").addEventListener("submit", (e)=>{
    e.preventDefault();

    const id = document.getElementById("evtId").value || HAEY.store.uid();
    const title = document.getElementById("evtTitle").value.trim();
    const start = document.getElementById("evtStart").value;
    const endRaw = document.getElementById("evtEnd").value;
    const end = normalizeEnd(start, endRaw);
    const memo = document.getElementById("evtMemo").value || "";

    const newEv = { id, title, start, end, memo };

    const draft = loadDraft().filter(x => x.id !== id);
    draft.push(newEv);
    saveDraft(draft);

    const exist = calendar.getEventById(id);
    if(exist) exist.remove();
    calendar.addEvent(newEv);

    closeModal();
  });

  // 삭제: draft에서 삭제(공용에 있던 이벤트를 숨기고 싶으면 같은 id로 빈 이벤트를 넣는 방식도 가능하지만 여기선 단순 삭제만)
  document.getElementById("btnDeleteEvent").addEventListener("click", ()=>{
    const id = document.getElementById("evtId").value;
    if(!id) return;
    if(!confirm("해당 일정을 (임시) 삭제할까요?")) return;

    const draft = loadDraft().filter(x => x.id !== id);
    saveDraft(draft);

    const ev = calendar.getEventById(id);
    if(ev) ev.remove();

    closeModal();
  });

  // ✅ 내보내기: "공용 JSON에 반영할 최종본"을 뽑아준다
  document.getElementById("btnCalExport").addEventListener("click", ()=>{
    const latestShared = sharedEvents;       // 마지막으로 읽은 공용
    const latestDraft = loadDraft();         // 내 기기에서 편집한 임시
    const merged = mergeSharedAndDraft(latestShared, latestDraft)
      .sort((a,b)=> (a.start||"").localeCompare(b.start||""));

    HAEY.store.downloadJSON("work-calendar-events.merged.json", merged);
    alert("내보내기 완료. GitHub에서 /data/work-calendar-events.json 파일을 열고, 이 JSON 내용으로 교체 후 커밋하면 전 기기 동기화됩니다.");
  });

  // 가져오기: draft로만 넣는다(공용 원본을 덮어쓰는 느낌 방지)
  document.getElementById("fileCalImport").addEventListener("change", async (e)=>{
    const file = e.target.files?.[0];
    if(!file) return;
    try{
      const data = await HAEY.store.readJSONFile(file);
      if(!Array.isArray(data)) throw new Error("형식 오류: 배열이 아님");

      const imported = data.map(x=>({
        id: String(x.id || HAEY.store.uid()),
        title: x.title || "",
        start: x.start || "",
        end: x.end || "",
        memo: x.memo || ""
      }));

      // draft 저장 후 화면 재구성
      saveDraft(imported);

      allEvents = mergeSharedAndDraft(sharedEvents, imported);
      calendar.getEvents().forEach(ev=>ev.remove());
      allEvents.forEach(ev=>calendar.addEvent(ev));

      e.target.value = "";
      alert("가져오기 완료(임시 편집 데이터로 반영됨)");
    }catch(err){
      console.error(err);
      alert("가져오기 실패: JSON 형식을 확인하세요.");
    }
  });

  // draft 전체 삭제(기기 로컬만)
  document.getElementById("btnCalClear").addEventListener("click", ()=>{
    if(!confirm("이 기기의 '임시 편집'만 전체 삭제할까요? (공용 JSON은 그대로)")) return;
    clearDraft();

    // 공용만 다시 표시
    calendar.getEvents().forEach(ev=>ev.remove());
    sharedEvents.forEach(ev=>calendar.addEvent(ev));
  });
});