let recognition;
const conversation = document.getElementById("conversation");

const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;

let selectedSource = "ID";
let selectedTarget = "EN";
let selectedSpeechLang = "id-ID";

let activeBlock = null; 
let silenceTimer = null; 

// Menyimpan akumulasi teks final untuk paragraf/blok aktif saat ini
let finalTranscriptAccumulator = ""; 

function initSpeechRecognition() {
  if (!SpeechRecognition) {
    conversation.innerHTML = `
      <div class="empty-state">
        Browser tidak mendukung Speech Recognition
      </div>
    `;
    return;
  }

  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true; 
  recognition.lang = selectedSpeechLang;

  recognition.onresult = async function (event) {
    let interimTranscript = "";
    let currentFinalThisSession = "";

    // Loop hasil dari browser untuk memisahkan mana yang 'final' dan mana yang 'interim'
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        currentFinalThisSession += event.results[i][0].transcript + " ";
      } else {
        interimTranscript += event.results[i][0].transcript;
      }
    }

    // Jika ada bagian baru yang sudah final dari browser, gabungkan ke akumulator permanen
    if (currentFinalThisSession) {
      finalTranscriptAccumulator += currentFinalThisSession;
    }

    // Teks yang ditampilkan di layar adalah: Akumulasi Final + Teks Interim saat ini
    const fullTextToShow = (finalTranscriptAccumulator + interimTranscript).trim();
    if (!fullTextToShow) return;

    // Terjemahkan teks secara live
    const translated = await translateText(fullTextToShow, selectedSource, selectedTarget);

    // Update tampilan di layar
    updateLiveResult(fullTextToShow, translated);

    // Reset timer jeda diam (5 detik)
    clearTimeout(silenceTimer);
    silenceTimer = setTimeout(() => {
      if (activeBlock) {
        activeBlock = null; // Kunci blok ini
        finalTranscriptAccumulator = ""; // Reset akumulator untuk paragraf berikutnya
      }
    }, 5000); 
  };

  recognition.onerror = function (event) {
    console.error("Speech error:", event.error);
  };

  recognition.onend = function () {
    activeBlock = null;
    finalTranscriptAccumulator = "";
    clearTimeout(silenceTimer);
  };
}

initSpeechRecognition();

/* START */
document.getElementById("startBtn").addEventListener("click", () => {
  if (!recognition) return;
  recognition.lang = selectedSpeechLang;
  activeBlock = null;
  finalTranscriptAccumulator = "";
  try {
    recognition.start();
  } catch (e) {
    console.log("Recognition sudah aktif");
  }
});

/* STOP */
document.getElementById("stopBtn").addEventListener("click", () => {
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