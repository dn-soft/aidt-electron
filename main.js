const { app, BrowserWindow, Tray, ipcMain, Menu } = require("electron");
const { processAudio } = require("./js/audioProcessor");
const { processImageSplit } = require("./js/imageSplitter");
const { processQuiz } = require("./js/quizJsonProcessor");
const path = require("path");
const fs = require("fs-extra");
const xlsx = require("xlsx");
let isDev;
let mainWindow;
let tray = null;
try {
  isDev = require("electron-is-dev");
} catch (err) {
  isDev = false;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    title: "DN-AIDT",
    width: 1000,
    height: 800,
    resizable: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: true,
      contextIsolation: false,
    },
    icon: path.join(__dirname, "assets/logo.png"),
  });

  mainWindow.loadFile("index.html");
  mainWindow.on("close", (e) => {
    if (!app.isQuiting) {
      e.preventDefault();
      mainWindow.hide();
    } else {
      mainWindow = null;
    }
  });

  // 개발자 도구를 자동으로 오픈
  if (isDev) {
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.webContents.closeDevTools();
  }
}

app.whenReady().then(() => {
  createWindow();

  tray = new Tray(path.join(__dirname, "assets/logo.png"));
  tray.setToolTip("DN-AIDT-Controller");

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Show App",
      click: () => {
        if (mainWindow) {
          mainWindow.show();
        }
      },
    },
    {
      label: "Exit",
      click: () => {
        app.isQuiting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
  tray.on("double-click", () => {
    if (mainWindow) {
      mainWindow.show();
    }
  });
});

ipcMain.on("quit-app", () => {
  app.isQuiting = true;
  app.quit();
});

app.on("before-quit", () => {
  app.isQuiting = true;
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

const columnMapping = {
  "#code_img": "q1",
  "#code_cimg_1": "c1",
  "#code_cimg_2": "c2",
  "#code_cimg_3": "c3",
  "#code_cimg_4": "c4",
};

ipcMain.on("submit-form-img-split", (event, baseDir, author, grade) => {
  const result = processImageSplit(baseDir, author, grade, columnMapping);

  if (result.success) {
    event.reply("form-reply", result.message);
  } else {
    event.reply("form-reply", `Error: ${result.message}`);
  }
});

// ipcMain.on("submit-form-quiz", async (event, baseDir, filePath) => {
//   console.log("파일 경로:", filePath);

//   if (!filePath) {
//     event.reply("form-reply", "파일 경로가 유효하지 않습니다.");
//     return;
//   }

//   try {
//     const errorMessages = await processQuiz(baseDir, filePath);

//     if (errorMessages.length > 0) {
//       event.reply(
//         "form-reply",
//         `작업이 완료되었습니다. \n다음과 같은 오류가 발생했습니다:\n${errorMessages.join(
//           "\n"
//         )}`
//       );
//     } else {
//       event.reply("form-reply", "작업이 완료되었습니다.");
//     }
//   } catch (err) {
//     event.reply("form-reply", `오류 발생: ${err.message}`);
//   }
// });
ipcMain.on("submit-form-quiz", async (event, baseDir, fileBuffer) => {
  try {
    const errorMessages = await processQuiz(baseDir, fileBuffer);

    if (errorMessages.length > 0) {
      event.reply(
        "form-reply",
        `작업이 완료되었습니다. \n다음과 같은 오류가 발생했습니다:\n${errorMessages.join(
          "\n"
        )}`
      );
    } else {
      event.reply("form-reply", `작업이 완료되었습니다. ${baseDir}`);
    }
  } catch (err) {
    event.reply("form-reply", `오류 발생: ${err.message}`);
  }
});

ipcMain.on(
  "submit-audio-maker",
  async (event, basePath, destPath, author, grade) => {
    try {
      const errorMessages = await processAudio(
        basePath,
        destPath,
        author,
        grade
      ); // 분리된 로직 호출

      if (errorMessages.length > 0) {
        // 에러가 있는 경우, 에러 메시지 목록을 포함하여 응답
        event.reply(
          "form-reply",
          `작업이 완료되었습니다. \n변환저장경로: ${destPath} => ${author}/${grade} 폴더에 저장되었습니다.\n다음과 같은 오류가 발생했습니다:\n${errorMessages.join(
            "\n"
          )}`
        );
      } else {
        // 에러가 없는 경우
        event.reply(
          "form-reply",
          `작업이 완료되었습니다. \n변환저장경로: ${destPath} => ${author}/${grade} 폴더에 저장되었습니다.`
        );
      }
    } catch (err) {
      event.reply("form-reply", `오류 발생: ${err.message}`);
    }
  }
);
