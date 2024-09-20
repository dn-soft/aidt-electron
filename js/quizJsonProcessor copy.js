const fs = require("fs").promises;
const path = require("path");
const { read, utils } = require("xlsx");

const checkFileErrorHandler = async (basePath, data) => {
  const error = [];
  console.log(`Import Data:${data}`);

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

    if (images.length > 0) {
      images.forEach((image) => {
        const imagePathToFile = path.join(imagePath, image);
        if (!fs.existsSync(imagePathToFile)) {
          error.push(
            `${id}:Image file not found ${author}-${grade}-${unit}-${image}`
          );
        }
      });
    }

    if (media.length > 0) {
      media.forEach((mediaFile) => {
        const mediaPathToFile = path.join(mediaPath, mediaFile);
        if (!fs.existsSync(mediaPathToFile)) {
          error.push(
            `${id}:Media file not found ${author}-${grade}-${unit}-${mediaFile}`
          );
        }
      });
    }
  };

  Object.keys(data).forEach((author) => {
    Object.keys(data[author]).forEach((grade) => {
      Object.keys(data[author][grade]).forEach((unit) => {
        const items = data[author][grade][unit] || [];
        const key = Object.keys(items);
        const value = Object.values(items);
        key.forEach((key, i) => {
          checkFiles(value[i], author, grade, unit, key, basePath);
        });
      });
    });
  });

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

const exlToJsonFileChk = async (e, basePath, errorMessages) => {
  const { files } = e.target;
  const fileExtension = files[0]?.name?.split(".").at(-1);
  const fileName = files[0]?.name;

  if (!files || files.length === 0) {
    console.log("Not Import File");
    return;
  } else if (fileExtension === "xlsx" || fileExtension === "csv") {
    return await new Promise((resolve, reject) => {
      const fileReader = new FileReader();
      fileReader.readAsBinaryString(files[0]);
      fileReader.onload = async (e) => {
        let data = [];
        let error = [];

        try {
          if (!e.target) {
            console.log("Target not found");
            errorMessages.push("Target not found");
            throw Error;
          }

          const { result } = e.target;
          const xlsxFile = read(result, { type: "binary" });
          const fileList = {
            kim: {
              3: {},
              4: {},
            },
            lee: {
              3: {},
              4: {},
            },
            ham: {
              3: {},
              4: {},
            },
          };
          for (const sheet in xlsxFile.Sheets) {
            if (xlsxFile.Sheets.hasOwnProperty(sheet)) {
              const sheetTable = sheet_to_json(xlsxFile.Sheets[sheet], {
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
                    L: "theme2", // 마술쇼
                    R: "theme4", //  로봇
                    S: "theme10", //  패스트푸드
                    P: "theme3", // 하늘놀이공원
                    W: "theme7", //  민속촌
                    A: "theme8", // 사막
                  },
                  4: {
                    L: "theme11", //  베이커리
                    R: "theme12", //  동굴
                    S: "theme14", //  운동장
                    P: "theme13", //  수영장
                    W: "theme15", //  서커스
                  },
                },
                h: {
                  3: {
                    L: "theme8", //  사막
                    R: "theme2", //  마술쇼
                    S: "theme1", //  겨울
                    P: "theme10", //  패스트푸드
                    W: "theme5", //  농사
                    A: "theme6", //  하늘
                  },
                  4: {
                    L: "theme20", //  사탕가게
                    R: "theme17", //  목장
                    S: "theme14", //  운동장
                    P: "theme19", //  학교
                    W: "theme15", //  서커스
                  },
                },
                k: {
                  3: {
                    L: "theme9", //  우주
                    R: "theme1", //  겨울
                    S: "theme5", //  농사
                    P: "theme8", //  사막
                    W: "theme3", //  하늘놀이공원
                    A: "theme7", //  민속촌
                  },
                  4: {
                    L: "theme16", //  고고학
                    R: "theme13", //  수영장
                    S: "theme20", //  사탕가게
                    P: "theme18", //  크리스마스
                    W: "theme19", //  학교
                  },
                },
              };
              const body = resultTable.slice(0);

              const quize = body.map((quize, idx) => {
                const transData = {
                  title: quize?.idx,
                  id: quize?.idx,
                  page: Number(quize?.idx_page),
                  originType: quize?.type?.toUpperCase(),
                  type:
                    (quize?.type?.toUpperCase().includes("W") ||
                      quize?.type?.toUpperCase().includes("P")) &&
                    quize?.level !== "1" &&
                    quize?.level !== 1
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
                  card:
                    quize?.card === "0" || !quize?.card ? null : quize?.card,
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
                  hint:
                    quize?.hint === "0" || !quize?.hint ? null : quize?.hint,
                };

                if (!transData?.theme) {
                  console.log(body);
                  console.log(idx);
                  console.log(quize);
                  console.log(quize.id);
                  console.log(quize.writer);
                  console.log(quize.grade);
                  console.log(quize.type);
                }

                const file = {
                  [transData.id]: {
                    images: [],
                    media: [],
                  },
                };

                if (transData?.questionImg)
                  file[transData.id].images.push(`q1.png`);
                if (transData?.questionVoice)
                  file[transData.id].media.push(`q1.mp3`);
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
                        quize?.[`select_${i}`] === "0" ||
                        !quize?.[`select_${i}`]
                          ? null
                          : quize?.[`select_${i}`],
                    };

                    if (transData.choice && transData.choice[i - 1].image)
                      file[transData.id].images.push(`c${i}.png`);
                    if (transData.choice && transData.choice[i - 1].audio)
                      file[transData.id].media.push(`c${i}.mp3`);
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
                        quize?.[`select_${i}`] === "0" ||
                        !quize?.[`select_${i}`]
                          ? null
                          : quize?.[`select_${i}`],
                    };

                    if (transData.choice && transData.choice[i - 1].image)
                      file[transData.id].images.push(`c${i}.png`);
                    if (transData.choice && transData.choice[i - 1].audio)
                      file[transData.id].media.push(`c${i}.mp3`);
                  }
                }
                if (
                  fileList[transData.writer][transData.grade]?.[
                    String(transData.chapter)
                  ]
                ) {
                  fileList[transData.writer][transData.grade][
                    String(transData.chapter)
                  ][transData.id] = file[transData.id];
                } else if (fileList[transData.writer][transData.grade]) {
                  fileList[transData.writer][transData.grade] = {
                    ...fileList[transData.writer][transData.grade],
                    [String(transData.chapter)]: {
                      [transData.id]: file[transData.id],
                    },
                  };
                } else {
                  fileList[transData.writer][transData.grade] = {
                    [String(transData.chapter)]: {
                      [transData.id]: file[transData.id],
                    },
                  };
                }

                return transData;
              });

              data.push(...quize);
            }
          }
          error = await checkErrorHandler(data);
          console.log("csvCheck", error);
          console.log("fileList", fileList);
          const checkFileError = await checkFileErrorHandler(basePath, data);

          console.log("checkFileError", checkFileError?.data);

          if (checkFileError?.data && checkFileError?.data.length > 0) {
            error = [...error, ...checkFileError?.data];
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
            const csvWithBOM = new Blob(
              [new Uint8Array([0xef, 0xbb, 0xbf]), csv],
              { type: "text/csv;charset=utf-8;" }
            );

            const xlsxUrl = URL.createObjectURL(csvWithBOM);
            const xlsxLink = document.createElement("a");
            xlsxLink.href = xlsxUrl;
            xlsxLink.download = `error.csv`;
            xlsxLink.click();
            URL.revokeObjectURL(xlsxUrl);
            errorMessages = [...errorMessages, ...error];
          } else {
            // JSON 파일 다운로드
            const blob = new Blob([JSON.stringify(data, null, 2)], {
              type: "application/json",
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `quize.json`;
            a.click();
            URL.revokeObjectURL(url);
            resolve({
              data: data,
              fileName: fileName,
            });
          }
        } catch (e) {
          if (e.length && e.length > 0) {
            const test = e.map((err) => {
              const key = err.split(":")[0];
              const desc = err.split(":")[1];
              return { key, desc };
            });

            const worksheet = utils.json_to_sheet(test);
            const workbook = utils.book_new();
            utils.book_append_sheet(workbook, worksheet, "Errors");

            const csv = utils.sheet_to_csv(worksheet);
            const csvWithBOM = new Blob(
              [new Uint8Array([0xef, 0xbb, 0xbf]), csv],
              { type: "text/csv;charset=utf-8;" }
            );

            const xlsxUrl = URL.createObjectURL(csvWithBOM);
            const xlsxLink = document.createElement("a");
            xlsxLink.href = xlsxUrl;
            xlsxLink.download = `error.csv`;
            xlsxLink.click();
            URL.revokeObjectURL(xlsxUrl);
          } else reject(e);
        }
      };
    });
  } else {
    alert(`\nfile Extension is not .xlsx\n`);
  }

  return;
};

const processQuiz = async (basePath, filePath) => {
  const errorMessages = [];

  try {
    await exlToJsonFileChk(filePath, basePath, errorMessages);
  } catch (err) {
    console.error("Error processing json:", err);
    errorMessages.push("Error processing json:", err);
  }

  return errorMessages;
};

module.exports = { processQuiz };
