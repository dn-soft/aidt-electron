const { ipcRenderer } = require("electron");

document.getElementById("form-img-split").addEventListener("submit", (e) => {
  e.preventDefault();

  const baseDir = document.querySelector("#form-img-split #baseDir").value;
  const author = document.querySelector("#form-img-split #author").value;
  const grade = document.querySelector("#form-img-split #grade").value;

  document.getElementById("spinner-overlay").style.display = "flex";
  document.getElementById("message").innerText = "Processing...";
  ipcRenderer.send("submit-form-img-split", baseDir, author, grade);
});

document.getElementById("form-quiz").addEventListener("submit", (e) => {
  e.preventDefault();

  const basePath = document.querySelector("#form-quiz #basePath").value;
  const fileInput = document.querySelector("#form-quiz #file");
  const file = fileInput.files[0];

  if (!file) {
    alert("파일을 선택해 주세요.");
    return;
  }

  const reader = new FileReader();
  reader.onload = function (event) {
    const fileBuffer = event.target.result;

    document.getElementById("spinner-overlay").style.display = "flex";
    document.getElementById("message").innerText = "Processing...";

    ipcRenderer.send("submit-form-quiz", basePath, fileBuffer);
  };

  reader.readAsArrayBuffer(file);
});

document.getElementById("form-audio-maker").addEventListener("submit", (e) => {
  e.preventDefault();

  const basePath = document.querySelector("#form-audio-maker #basePath").value;
  const destPath = document.querySelector("#form-audio-maker #destPath").value;
  const author = document.querySelector("#form-audio-maker #author").value;
  const grade = document.querySelector("#form-audio-maker #grade").value;

  document.getElementById("spinner-overlay").style.display = "flex";
  document.getElementById("message").innerText = "Processing...";
  ipcRenderer.send("submit-audio-maker", basePath, destPath, author, grade);
});

ipcRenderer.on("form-reply", (event, message) => {
  document.getElementById("spinner-overlay").style.display = "none";
  document.getElementById("message").innerText = message;
});
