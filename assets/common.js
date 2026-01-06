// 공용 유틸 (정적 호스팅용)
window.HAEY = window.HAEY || {};

HAEY.store = {
  get(key, fallback){
    try{
      const raw = localStorage.getItem(key);
      if(!raw) return fallback;
      return JSON.parse(raw);
    }catch(e){
      return fallback;
    }
  },
  set(key, value){
    localStorage.setItem(key, JSON.stringify(value));
  },
  downloadJSON(filename, data){
    const blob = new Blob([JSON.stringify(data, null, 2)], {type:"application/json"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(a.href), 500);
  },
  readJSONFile(file){
    return new Promise((resolve, reject)=>{
      const reader = new FileReader();
      reader.onload = () => {
        try{ resolve(JSON.parse(reader.result)); }
        catch(e){ reject(e); }
      };
      reader.onerror = reject;
      reader.readAsText(file);
    });
  },
  uid(){
    return "id_" + Math.random().toString(16).slice(2) + "_" + Date.now();
  },
  toTagArray(tagText){
    if(!tagText) return [];
    return tagText
      .split(",")
      .map(s=>s.trim())
      .filter(Boolean)
      .slice(0, 20);
  }
};

// 기본 날짜 입력 자동 세팅
document.addEventListener("DOMContentLoaded", ()=>{
  const dateInputs = document.querySelectorAll('input[type="date"]');
  dateInputs.forEach(inp=>{
    if(!inp.value){
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth()+1).padStart(2,"0");
      const dd = String(now.getDate()).padStart(2,"0");
      inp.value = `${yyyy}-${mm}-${dd}`;
    }
  });
});