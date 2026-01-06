const CAL_KEY = "haey_work_calendar_events_v1";

function getEvents(){
  return HAEY.store.get(CAL_KEY, []);
}
function setEvents(arr){
  HAEY.store.set(CAL_KEY, arr);
}

function openModal(){
  document.getElementById("eventModal").classList.add("is-open");
  document.getElementById("eventModal").setAttribute("aria-hidden", "false");
}
function closeModal(){
  document.getElementById("eventModal").classList.remove("is-open");
  document.getElementById("eventModal").setAttribute("aria-hidden", "true");
}

function toLocalDT(dt){
  // FullCalendar Date -> datetime-local 문자열
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
  // 종료 없으면 30분
  const s = new Date(startStr);
  const e = new Date(s.getTime() + 30*60*1000);
  return toLocalDT(e);
}

document.addEventListener("DOMContentLoaded", ()=>{
  const calendarEl = document.getElementById("calendar");
  const modal = document.getElementById("eventModal");

  // 모달 닫기 핸들러
  modal.addEventListener("click", (e)=>{
    if(e.target?.dataset?.close) closeModal();
  });

  const events = getEvents();

  // FullCalendar 초기화
  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: "dayGridMonth",
    height: "auto",
    locale: "ko",
    firstDay: 1, // 월요일 시작
    selectable: true,
    nowIndicator: true,

    headerToolbar: {
      left: "prev,next today",
      center: "title",
      right: "dayGridMonth,timeGridWeek,twoDay"
    },

    views: {
      twoDay: {
        type: "timeGrid",
        duration: { days: 2 },
        buttonText: "오늘/내일(2일)"
      }
    },

    // 데이터 주입
    events: events,

    // 드래그 선택으로 일정 생성
    select: (info)=>{
      const start = info.start;
      const end = info.end;

      document.getElementById("modalTitle").textContent = "일정 추가";
      document.getElementById("evtId").value = "";
      document.getElementById("evtTitle").value = "";
      document.getElementById("evtStart").value = toLocalDT(start);
      document.getElementById("evtEnd").value = toLocalDT(end);
      document.getElementById("evtMemo").value = "";
      document.getElementById("btnDeleteEvent").style.display = "none";

      openModal();
    },

    // 일정 클릭 => 수정/삭제
    eventClick: (info)=>{
      const ev = info.event;

      document.getElementById("modalTitle").textContent = "일정 수정";
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

  // 상단 '일정 추가' 버튼
  document.getElementById("btnNewEvent").addEventListener("click", ()=>{
    const now = new Date();
    const start = toLocalDT(now);
    const end = normalizeEnd(start, "");

    document.getElementById("modalTitle").textContent = "일정 추가";
    document.getElementById("evtId").value = "";
    document.getElementById("evtTitle").value = "";
    document.getElementById("evtStart").value = start;
    document.getElementById("evtEnd").value = end;
    document.getElementById("evtMemo").value = "";
    document.getElementById("btnDeleteEvent").style.display = "none";
    openModal();
  });

  // 저장(추가/수정)
  document.getElementById("eventForm").addEventListener("submit", (e)=>{
    e.preventDefault();

    const id = document.getElementById("evtId").value || HAEY.store.uid();
    const title = document.getElementById("evtTitle").value.trim();
    const start = document.getElementById("evtStart").value;
    const endRaw = document.getElementById("evtEnd").value;
    const end = normalizeEnd(start, endRaw);
    const memo = document.getElementById("evtMemo").value || "";

    // 기존 삭제 후 재등록 (단순/안정)
    const current = getEvents().filter(x => x.id !== id);
    const newEv = { id, title, start, end, memo };

    current.push(newEv);
    setEvents(current);

    // 달력 반영
    const exist = calendar.getEventById(id);
    if(exist) exist.remove();
    calendar.addEvent(newEv);

    closeModal();
  });

  // 삭제
  document.getElementById("btnDeleteEvent").addEventListener("click", ()=>{
    const id = document.getElementById("evtId").value;
    if(!id) return;
    if(!confirm("해당 일정을 삭제할까요?")) return;

    const next = getEvents().filter(x => x.id !== id);
    setEvents(next);

    const ev = calendar.getEventById(id);
    if(ev) ev.remove();

    closeModal();
  });

  // 내보내기/가져오기/전체삭제
  document.getElementById("btnCalExport").addEventListener("click", ()=>{
    HAEY.store.downloadJSON("work-calendar-events.json", getEvents());
  });

  document.getElementById("fileCalImport").addEventListener("change", async (e)=>{
    const file = e.target.files?.[0];
    if(!file) return;
    try{
      const data = await HAEY.store.readJSONFile(file);
      if(!Array.isArray(data)) throw new Error("형식 오류: 배열이 아닙니다.");

      // 형태 보정
      const merged = data.map(x=>({
        id: x.id || HAEY.store.uid(),
        title: x.title || "",
        start: x.start || "",
        end: x.end || "",
        memo: x.memo || ""
      }));

      setEvents(merged);

      // 달력 리프레시
      calendar.getEvents().forEach(ev=>ev.remove());
      merged.forEach(ev=>calendar.addEvent(ev));

      e.target.value = "";
      alert("가져오기 완료");
    }catch(err){
      console.error(err);
      alert("가져오기 실패: JSON 형식을 확인하세요.");
    }
  });

  document.getElementById("btnCalClear").addEventListener("click", ()=>{
    if(!confirm("달력 전체 일정을 삭제할까요? (되돌릴 수 없음)")) return;
    setEvents([]);
    calendar.getEvents().forEach(ev=>ev.remove());
  });
});