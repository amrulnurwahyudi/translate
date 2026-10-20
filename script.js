let recognition = null;
const conversation = document.getElementById("conversation");

const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;

let selectedSource = "ID";
let selectedTarget = "EN";
let selectedSpeechLang = "id-ID";

let activeBlock = null; 
let fullAccumulatedText = ""; 
let isRunning = false; 

function startRecognitionInstance() {
  if (!SpeechRecognition) {
    conversation.innerHTML = `
      <div class="empty-state">
        Browser tidak mendukung Speech Recognition
      </div>
    `;
    return;
  }

  // Bersihkan instance lama
  if (recognition) {
    try { 
      recognition.onend = null; 
      recognition.stop(); 
    } catch(e) {}
  }

  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true; 
  recognition.lang = selectedSpeechLang;

  recognition.onresult = async function (event) {
    let interimTranscript = "";
    let finalThisSession = "";

    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        finalThisSession += event.results[i][0].transcript + " ";
      } else {
        interimTranscript += event.results[i][0].transcript;
      }
    }

    if (finalThisSession) {
      fullAccumulatedText += finalThisSession;
    }

    const currentLiveText = (fullAccumulatedText + interimTranscript).trim();
    if (!currentLiveText) return;

    const translated = await translateText(currentLiveText, selectedSource, selectedTarget);
    updateLiveResult(currentLiveText, translated);
  };

  recognition.onerror = function (event) {
    console.log("Speech error:", event.error);
  };

  // KUNCI UTAMA: Ketika browser HP memutus sesi (baik karena timeout 30 detik maupun hening),
  // langsung sambungkan lagi instance baru seketika tanpa kehilangan teks yang sudah ada.
  recognition.onend = function () {
    if (isRunning) {
      // Pindahkan teks live saat ini ke akumulator permanen agar tidak ada yang hilang saat restart sesi
      if (activeBlock) {
        fullAccumulatedText = activeBlock.querySelector(".source").innerText + " ";
      }

      setTimeout(() => {
        if (isRunning) {
          try {
            startRecognitionInstance();
          } catch (e) {
            console.log("Restart sesi gagal:", e);
          }
        }
      }, 100); // Jeda sangat singkat (0.1 detik) agar perpindahan sesi tidak terasa
    }
  };

  try {
    recognition.start();
  } catch (e) {
    console.log("Start error:", e);
  }
}

/* TOMBOL START */
document.getElementById("startBtn").addEventListener("click", () => {
  if (isRunning) return;

  isRunning = true;
  activeBlock = null;
  fullAccumulatedText = "";

  startRecognitionInstance();
});

/* TOMBOL STOP */
document.getElementById("stopBtn").addEventListener("click", () => {
  isRunning = false; // Matikan total
  
  if (recognition) {
    try {
      recognition.onend = null;
      recognition.stop();
    } catch (e) {}
  }

  activeBlock = null;
  fullAccumulatedText = "";
});

/* FUNGSI UPDATE LIVE */
function updateLiveResult(source, translated) {
  const empty = conversation.querySelector(".empty-state");
  if (empty) empty.remove();

  const now = new Date();
  const time = now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });

  if (!activeBlock) {
    const block = document.createElement("div");
    block.className = "block";
    block.innerHTML = `
      <div class="time">${time}</div>
      <div class="source">${source}</div>
      <div class="translate">${translated}</div>
    `;
    conversation.appendChild(block);
    activeBlock = block; 
  } else {
    activeBlock.querySelector(".source").innerText = source;
    activeBlock.querySelector(".translate").innerText = translated;
  }

  conversation.scrollTop = conversation.scrollHeight;
}

/* MODAL LANGUAGE & TRANSLATE */
const langBtn = document.getElementById("langBtn");
const modal = document.getElementById("languageModal");
const confirmBtn = document.getElementById("confirmLang");

langBtn.addEventListener("click", () => {
  modal.style.display = "block";
});

window.addEventListener("click", (e) => {
  if (e.target === modal) {
    modal.style.display = "none";
  }
});

document.querySelectorAll(".source-lang").forEach(item => {
  item.addEventListener("click", () => {
    selectedSource = item.dataset.code;
    selectedSpeechLang = item.dataset.speech || "id-ID";
    document.querySelectorAll(".source-lang").forEach(x => x.classList.remove("selected"));
    item.classList.add("selected");
  });
});

document.querySelectorAll(".target-lang").forEach(item => {
  item.addEventListener("click", () => {
    selectedTarget = item.dataset.code;
    document.querySelectorAll(".target-lang").forEach(x => x.classList.remove("selected"));
    item.classList.add("selected");
  });
});

confirmBtn.addEventListener("click", () => {
  document.getElementById("langBtn").innerHTML = `${selectedSource} ⇄ ${selectedTarget} ▼`;
  modal.style.display = "none";
  if (recognition && isRunning) {
    startRecognitionInstance();
  }
});

async function translateText(text, fromLang, toLang) {
  try {
    const targetElement = document.querySelector(`.target-lang[data-code="${toLang}"]`);
    const apiTarget = targetElement ? targetElement.dataset.api : toLang.toLowerCase();

    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${fromLang.toLowerCase()}|${apiTarget}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data && data.responseData && data.responseData.translatedText) {
      return data.responseData.translatedText;
    }
    return "Terjemahan gagal";
  } catch (error) {
    console.error(error);
    return "Gagal terhubung ke server";
  }
}
