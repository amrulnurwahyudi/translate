let recognition;
const conversation = document.getElementById("conversation");

const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;

let selectedSource = "ID";
let selectedTarget = "EN";
let selectedSpeechLang = "id-ID";

let activeBlock = null; 
let silenceTimer = null; 
let finalTranscriptAccumulator = ""; 

// Status untuk melacak apakah user sengaja menekan tombol Stop atau belum
let isUserStopped = false; 

function initSpeechRecognition() {
  if (!SpeechRecognition) {
    conversation.innerHTML = `
      <div class="empty-state">
        Browser tidak mendukung Speech Recognition
      </div>
    `;
    return;
  }

  // Jika sudah ada instance sebelumnya, hentikan dulu untuk mencegah double
  if (recognition) {
    try { recognition.stop(); } catch(e) {}
  }

  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true; 
  recognition.lang = selectedSpeechLang;

  recognition.onresult = async function (event) {
    let interimTranscript = "";
    let currentFinalThisSession = "";

    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        currentFinalThisSession += event.results[i][0].transcript + " ";
      } else {
        interimTranscript += event.results[i][0].transcript;
      }
    }

    if (currentFinalThisSession) {
      finalTranscriptAccumulator += currentFinalThisSession;
    }

    const fullTextToShow = (finalTranscriptAccumulator + interimTranscript).trim();
    if (!fullTextToShow) return;

    const translated = await translateText(fullTextToShow, selectedSource, selectedTarget);
    updateLiveResult(fullTextToShow, translated);

    clearTimeout(silenceTimer);
    silenceTimer = setTimeout(() => {
      if (activeBlock) {
        activeBlock = null; 
        finalTranscriptAccumulator = ""; 
      }
    }, 5000); 
  };

  recognition.onerror = function (event) {
    console.error("Speech error:", event.error);
  };

  // FITUR ANTI STOP SENDIRI DI HP
  recognition.onend = function () {
    // Jika user TIDAK sengaja menolak/mengklik stop, tapi HP menutupnya otomatis, nyalakan lagi secara diam-diam
    if (!isUserStopped) {
      try {
        recognition.start();
      } catch (e) {
        console.log("Gagal auto-restart:", e);
      }
    } else {
      activeBlock = null;
      finalTranscriptAccumulator = "";
      clearTimeout(silenceTimer);
    }
  };
}

initSpeechRecognition();

/* START */
document.getElementById("startBtn").addEventListener("click", () => {
  isUserStopped = false; // Tandai bahwa user ingin merekam
  
  if (!recognition) {
    initSpeechRecognition();
  }

  recognition.lang = selectedSpeechLang;
  activeBlock = null;
  finalTranscriptAccumulator = "";

  try {
    recognition.start();
  } catch (e) {
    console.log("Recognition sudah aktif:", e);
  }
});

/* STOP */
document.getElementById("stopBtn").addEventListener("click", () => {
  isUserStopped = true; // Tandai bahwa user sengaja berhenti
  if (!recognition) return;
  
  recognition.stop();
  activeBlock = null;
  finalTranscriptAccumulator = "";
  clearTimeout(silenceTimer);
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
  if (recognition) {
    recognition.lang = selectedSpeechLang;
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
