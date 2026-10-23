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

let translateTimer = null;

/* ===========================
   START SPEECH RECOGNITION
=========================== */
function startRecognitionInstance() {
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

  recognition.onstart = () => {
    console.log("Speech Started");
  };

  recognition.onresult = function (event) {
    let interimTranscript = "";
    let finalTranscript = "";

    for (
      let i = event.resultIndex;
      i < event.results.length;
      i++
    ) {
      const text = event.results[i][0].transcript;

      if (event.results[i].isFinal) {
        finalTranscript += text + " ";
      } else {
        interimTranscript += text;
      }
    }

    // Simpan hanya hasil FINAL
    if (finalTranscript.trim()) {
      const cleanText = finalTranscript.trim();

      // Hindari duplikasi
      if (!fullAccumulatedText.includes(cleanText)) {
        fullAccumulatedText += cleanText + " ";
      }
    }

    const currentText =
      fullAccumulatedText + interimTranscript;

    if (!currentText.trim()) return;

    clearTimeout(translateTimer);

    translateTimer = setTimeout(async () => {
      const translated = await translateText(
        currentText,
        selectedSource,
        selectedTarget
      );

      updateLiveResult(
        currentText.trim(),
        translated
      );
    }, 300);
  };

  recognition.onerror = function (event) {
    console.log("Speech Error:", event.error);

    if (
      event.error === "no-speech" ||
      event.error === "aborted"
    ) {
      return;
    }
  };

  recognition.onend = function () {
    console.log("Speech Ended");

    if (!isRunning) return;

    // Android sering memutus sendiri.
    // Reconnect otomatis.
    setTimeout(() => {
      if (!isRunning) return;

      try {
        recognition.start();
      } catch (e) {
        console.log("Restart failed", e);

        try {
          startRecognitionInstance();
        } catch (err) {
          console.log(err);
        }
      }
    }, 500);
  };

  try {
    recognition.start();
  } catch (e) {
    console.log(e);
  }
}

/* ===========================
   START BUTTON
=========================== */
document
  .getElementById("startBtn")
  .addEventListener("click", () => {
    if (isRunning) return;

    isRunning = true;

    activeBlock = null;
    fullAccumulatedText = "";

    startRecognitionInstance();
  });

/* ===========================
   STOP BUTTON
=========================== */
document
  .getElementById("stopBtn")
  .addEventListener("click", () => {
    isRunning = false;

    if (recognition) {
      recognition.onend = null;

      try {
        recognition.stop();
      } catch (e) {}
    }
  });

/* ===========================
   UPDATE TEXT
=========================== */
function updateLiveResult(source, translated) {
  const empty =
    conversation.querySelector(".empty-state");

  if (empty) empty.remove();

  const now = new Date();

  const time = now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
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
    activeBlock.querySelector(".source").innerText =
      source;

    activeBlock.querySelector(".translate").innerText =
      translated;
  }

  conversation.scrollTop =
    conversation.scrollHeight;
}

/* ===========================
   TRANSLATE
=========================== */
async function translateText(
  text,
  fromLang,
  toLang
) {
  try {
    const targetElement = document.querySelector(
      `.target-lang[data-code="${toLang}"]`
    );

    const apiTarget =
      targetElement?.dataset.api ||
      toLang.toLowerCase();

    const url =
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(
        text
      )}&langpair=${fromLang.toLowerCase()}|${apiTarget}`;

    const response = await fetch(url);

    const data = await response.json();

    return (
      data?.responseData?.translatedText ||
      "Terjemahan gagal"
    );
  } catch (e) {
    console.error(e);
    return "Gagal terhubung ke server";
  }
}
