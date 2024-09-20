const fs = require("fs").promises;
const { read, utils } = require("xlsx");
const path = require("path");

const checkFileErrorHandler = async (basePath, data) => {
  const error = [];

  // 파일이 존재하는지 비동기적으로 체크
  const checkFileExists = async (filePath) => {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  };

  const checkFiles = async (files, author, grade, unit, id, basePath) => {
    const idPath = path.join(
      basePath,
      author,
      grade.toString(),
      unit.toString(),
      id
    );
    const imagePath = path.join(idPath, "images");
    const mediaPath = path.join(idPath, "media");

    if (!files) return;

    const { images = [], media = [] } = files;

    // 이미지 파일 체크
    const imageChecks = images.map(async (image) => {
      const imagePathToFile = path.join(imagePath, image);
      const imageExists = await checkFileExists(imagePathToFile);
      if (!imageExists) {
        error.push(
          `${id}:Image file not found ${author}-${grade}-${unit}-${image}`
        );
      }
    });

    // 미디어 파일 체크
    const mediaChecks = media.map(async (mediaFile) => {
      const mediaPathToFile = path.join(mediaPath, mediaFile);
      const mediaExists = await checkFileExists(mediaPathToFile);
      if (!mediaExists) {
        error.push(
          `${id}:Media file not found ${author}-${grade}-${unit}-${mediaFile}`
        );
      }
    });

    // 모든 비동기 체크가 완료될 때까지 기다림
    await Promise.all([...imageChecks, ...mediaChecks]);
  };

  // 기존의 forEach 사용
  const promises = [];
  // Object.keys(data).forEach((author) => {
  //   Object.keys(data[author]).forEach((grade) => {
  //     Object.keys(data[author][grade]).forEach((unit) => {
  //       const items = data[author][grade][unit] || {};
  //       const keys = Object.keys(items);
  //       const values = Object.values(items);

  //       keys.forEach((key, i) => {
  //         promises.push(
  //           checkFiles(values[i], author, grade, unit, key, basePath)
  //         );
  //       });
  //     });
  //   });
  // });
  if (data && typeof data === "object") {
    Object.keys(data).forEach((author) => {
      if (data[author] && typeof data[author] === "object") {
        Object.keys(data[author]).forEach((grade) => {
          if (data[author][grade] && typeof data[author][grade] === "object") {
            Object.keys(data[author][grade]).forEach((unit) => {
              const items = data[author][grade][unit] || {};
              const keys = Object.keys(items);
              const values = Object.values(items);

              keys.forEach((key, i) => {
                promises.push(
                  checkFiles(values[i], author, grade, unit, key, basePath)
                );
              });
            });
          }
        });
      }
    });
  }

  // 모든 비동기 작업이 완료될 때까지 기다림
  await Promise.all(promises);

  console.log(`complete check local file: ${error.length}`);
  return error;
};

const checkErrorHandler = async (list) => {
  const error = [];

  list.map((transData) => {
    //  검수 로직
    //  idx 확인 파트
    // if (!baseNumMapping?.[transData?.writer]) {
    //   error.push(
    //     `${transData.id}:${transData?.writer}와 매칭되는 Number가 없습니다.`
    //   );
    // } else if (
    //   transData.id.split("-")[0] !==
    //   `${baseNumMapping?.[transData?.writer]}${
    //     transData?.grade
    //   }${transData?.chapter.toString().padStart(2, "0")}${
    //     transData.type.length > 2 ? transData.type.slice(0, 2) : transData.type
    //   }`
    // ) {
    //   error.push(
    //     `${transData.id}:${transData.id}와 ${transData?.writer}, ${
    //       transData?.chapter
    //     }, ${transData?.chapter.toString().padStart(2, "0")}${
    //       transData.type.length > 2
    //         ? transData.type.slice(0, 2)
    //         : transData.type
    //     }등의 구성이 맞지않습니다.`
    //   );
    // }

    //  엔터 확인 파트
    if (transData.choice) {
      const keys = Object.keys(transData);
      Object.values(transData).map((value, i) => {
        if (
          (String(value).includes("\n") || String(value).includes("\r")) &&
          keys[i] !== "choice"
        ) {
          error.push(`${transData.id}:${keys[i]}에 엔터포함`);
        } else if (keys[i] === "choice") {
          transData?.choice.map((list) => {
            Object.values(list).map((value, i) => {
              if (
                String(value).includes("\n") ||
                String(value).includes("\r")
              ) {
                error.push(`${transData.id}:${keys[i]}에 엔터포함`);
              }
            });
          });
        }
      });
    } else {
      const keys = Object.keys(transData);
      Object.values(transData).map((value, i) => {
        if (String(value).includes("\n") || String(value).includes("\r")) {
          error.push(`${transData.id}:${keys[i]}에 엔터포함`);
        }
      });
    }

    // 파일 확인 파트
    if (
      transData.choice &&
      transData.choice?.length > 0 &&
      !transData.type?.includes("L4") &&
      !transData.type?.includes("R5")
    ) {
      for (let i = 0; i < transData.choice.length; i++) {
        if (
          !transData.choice[i]?.image &&
          !transData.choice[i]?.audio &&
          !transData.choice[i]?.text
        ) {
          error.push(
            `${transData.id}: ${transData.id}/보기 ${i + 1}번 데이터가 없음`
          );
        }
      }
    }

    if (
      transData.type.includes("S") &&
      transData.type.includes("P3") &&
      transData.type.includes("A2")
    ) {
      if (transData.sttCheck === null) {
        error.push(`${transData.id}:stt_check 값 필요`);
      }

      if (transData.answerStt === null) {
        error.push(`${transData.id}:answer_stt 값 필요`);
      }

      if (transData.answerVoice === null) {
        error.push(`${transData.id}:answer_voice 값 필요`);
      }
    }
  });

  return error;
};

const convertValue = (value) => {
  // "0" 또는 "false"인 경우 null을 반환합니다.
  if (value && (value === "0" || value === "FALSE")) {
    return null;
  }
  let numberValue = Number(value);

  if (!value) {
    return null;
  } else if (typeof value === "string" && value.includes("_")) {
    const convertValue = value.replace(/_/g, "-");
    return convertValue;
  } else if (
    typeof value === "number" ||
    (!isNaN(numberValue) &&
      typeof numberValue === "number" &&
      !value.includes(":"))
  ) {
    return numberValue;
  } else {
    return value;
  }
};

const exlToJsonFileChk = async (fileBuffer, basePath, errorMessages) => {
  try {
    const xlsxFile = read(fileBuffer, { type: "buffer" });
    let data = [];
    let error = [];

    // 엑셀 파일의 시트들을 처리
    for (const sheet in xlsxFile.Sheets) {
      if (xlsxFile.Sheets.hasOwnProperty(sheet)) {
        const sheetTable = utils.sheet_to_json(xlsxFile.Sheets[sheet], {
          range: 0,
        });

        const resultTable = sheetTable.map((row) => {
          let tmp = {};

          Object.entries(row).map((arr, i) => {
            if (!arr[0].includes("#") && !arr[0].includes("검사"))
              tmp[arr[0]] = arr[1];
          });

          return tmp;
        });

        const matchWriterFolders = { l: "lee", h: "ham", k: "kim" };
        const matchWriterTheme = {
          l: {
            3: {
              L: "theme2",
              R: "theme4",
              S: "theme10",
              P: "theme3",
              W: "theme7",
              A: "theme8",
            },
            4: {
              L: "theme11",
              R: "theme12",
              S: "theme14",
              P: "theme13",
              W: "theme15",
            },
          },
          h: {
            3: {
              L: "theme8",
              R: "theme2",
              S: "theme1",
              P: "theme10",
              W: "theme5",
              A: "theme6",
            },
            4: {
              L: "theme20",
              R: "theme17",
              S: "theme14",
              P: "theme19",
              W: "theme15",
            },
          },
          k: {
            3: {
              L: "theme9",
              R: "theme1",
              S: "theme5",
              P: "theme8",
              W: "theme3",
              A: "theme7",
            },
            4: {
              L: "theme16",
              R: "theme13",
              S: "theme20",
              P: "theme18",
              W: "theme19",
            },
          },
        };

        const body = resultTable.slice(0);

        // 퀴즈 데이터를 처리
        const quize = body.map((quize, idx) => {
          const transData = {
            title: quize?.idx,
            id: quize?.idx,
            page: Number(quize?.idx_page),
            originType: quize?.type?.toUpperCase(),
            type:
              (quize?.type?.toUpperCase().includes("W") ||
                quize?.type?.toUpperCase().includes("P")) &&
              String(quize?.level) !== "1"
                ? quize?.type?.toUpperCase() + quize?.level
                : quize?.type?.toUpperCase(),
            writer: matchWriterFolders[quize?.writer],
            theme:
              matchWriterTheme?.[quize?.writer]?.[quize?.grade]?.[
                quize?.type?.toUpperCase()?.[0]
              ],
            grade: Number(quize?.grade),
            chapter: Number(quize?.chapter),
            level: Number(quize?.level),
            question: quize?.question,
            questionTxt:
              quize?.question_text === "0" || !quize?.question_text
                ? null
                : quize?.question_text,
            questionImg:
              quize?.question_img === "FALSE" || !quize?.question_img
                ? null
                : "images/q1.png",
            questionVoice:
              quize?.question_voice === "FALSE" || !quize?.question_voice
                ? null
                : "media/q1.mp3",
            card: quize?.card === "0" || !quize?.card ? null : quize?.card,
            cardSpace:
              quize?.card_space === "0" || !quize?.card_space
                ? null
                : quize?.card_space,
            exampleTxt:
              quize?.example_text === "0" || !quize?.example_text
                ? null
                : quize?.example_text,
            txtSpace:
              quize?.text_space === "0" || !quize?.text_space
                ? null
                : quize?.text_space,
            answerVoice:
              quize.answer_voice === "0" || !quize.answer_voice
                ? null
                : "media/a.mp3",
            answer: convertValue(quize?.answer),
            answerStt:
              quize.answer_stt === "0" || !quize.answer_stt
                ? null
                : quize.answer_stt,
            sttCheck:
              quize.stt_check === "0" || !quize.stt_check
                ? null
                : quize.stt_check,
            endpoint:
              quize?.endpoint === "0" || !quize?.endpoint
                ? null
                : quize?.endpoint,
            hint: quize?.hint === "0" || !quize?.hint ? null : quize?.hint,
          };

          // 파일 구조
          const file = {
            [transData.id]: {
              images: [],
              media: [],
            },
          };

          if (transData?.questionImg) file[transData.id].images.push(`q1.png`);
          if (transData?.questionVoice) file[transData.id].media.push(`q1.mp3`);
          if (
            (transData.type?.includes("L4") ||
              transData.type?.includes("R5")) &&
            quize?.idx_c > 0
          ) {
            transData.choice = [];
            for (let i = 1; i <= quize.idx_c; i++) {
              transData.choice[i - 1] = {
                image:
                  quize?.[`select_img_${i}`] === "FALSE" ||
                  !quize?.[`select_img_${i}`]
                    ? null
                    : `images/c${i}.png`,
                audio:
                  quize?.[`select_voice_${i}`] === "FALSE" ||
                  !quize?.[`select_voice_${i}`]
                    ? null
                    : `media/c${i}.mp3`,
                value: i === 1 ? "O" : "X",
                text:
                  quize?.[`select_${i}`] === "0" || !quize?.[`select_${i}`]
                    ? null
                    : quize?.[`select_${i}`],
              };
            }
          } else if (quize?.idx_c) {
            transData.choice = [];

            for (let i = 1; i <= quize.idx_c; i++) {
              transData.choice[i - 1] = {
                image:
                  quize?.[`select_img_${i}`] === "FALSE" ||
                  !quize?.[`select_img_${i}`]
                    ? null
                    : `images/c${i}.png`,
                audio:
                  quize?.[`select_voice_${i}`] === "FALSE" ||
                  !quize?.[`select_voice_${i}`]
                    ? null
                    : `media/c${i}.mp3`,
                value: i,
                text:
                  quize?.[`select_${i}`] === "0" || !quize?.[`select_${i}`]
                    ? null
                    : quize?.[`select_${i}`],
              };
            }
          }

          return transData;
        });

        data.push(...quize);
      }
    }

    // 에러 처리
    error = await checkErrorHandler(data);
    const checkFileError = await checkFileErrorHandler(basePath, data);
    if (checkFileError && checkFileError.length > 0) {
      error = [...error, ...checkFileError];
    }

    if (error.length > 0) {
      const test = error.map((err) => {
        const key = err.split(":")[0];
        const desc = err.split(":")[1];
        return { key, desc };
      });

      const worksheet = utils.json_to_sheet(test);
      const workbook = utils.book_new();
      utils.book_append_sheet(workbook, worksheet, "Errors");
      const csv = utils.sheet_to_csv(worksheet);

      // CSV 파일을 서버 파일 시스템에 저장
      const csvFilePath = path.join(basePath, "error.csv");
      await fs.writeFile(csvFilePath, csv, "utf8");

      console.log("에러 CSV 파일이 성공적으로 저장되었습니다:", csvFilePath);

      errorMessages.push(...error);
    } else {
      // JSON 파일 저장
      const jsonFilePath = path.join(basePath, "output.json");
      await fs.writeFile(jsonFilePath, JSON.stringify(data, null, 2));
      console.log("JSON 파일이 성공적으로 저장되었습니다:", jsonFilePath);
    }
  } catch (err) {
    errorMessages.push(`파일 처리 중 오류 발생: ${err.message}`);
  }
};

const processQuiz = async (basePath, fileBuffer) => {
  const errorMessages = [];

  try {
    await exlToJsonFileChk(fileBuffer, basePath, errorMessages);
  } catch (err) {
    console.error("Error processing json:", err);
    errorMessages.push("Error processing json:", err);
  }

  return errorMessages;
};

module.exports = { processQuiz };
