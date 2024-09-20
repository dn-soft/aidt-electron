const { readFile, utils } = require("xlsx");
const path = require("path");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");
// const ffprobePath = require("ffprobe-static").path;
const fs = require("fs");
const { decode_range, encode_cell } = utils;
let isDev;
try {
  isDev = require("electron-is-dev");
} catch (err) {
  isDev = false;
}

/**
 * @type {string} 합칠 오디오 원본로컬경로 (from aidt-contents)
 * repository: https://github.com/dn-soft/aidt-contents
 */
let basePath = "";
/**
 * @type {string} 생성파일 임시 저장 경로
 */
let inputDir = "";
/**
 * @type {string} 저장할 폴더 경로
 */
let destDir = "";
/**
 * @type {number} 합치는 audio사이 공백시간
 */
const duration = 0.6;

/**
 * @description fuction: 해당 경로에 폴더가 있는지 검사
 * @param {string} filePath 폴더 경로
 */
const ensureDirectoryExistence = (filePath) => {
  if (!fs.existsSync(filePath)) {
    fs.mkdirSync(filePath, { recursive: true });
  }
};

/**
 * @description fuction: 공백 오디오 파일 임시 생성
 * @param {number} duration 저자
 * @param {(err: string | null, filePath: string) => void} callback
 */
const createSilence = (duration, callback) => {
  const silenceFilePath = path.join(destDir, `silence_${Date.now()}.mp3`);
  ffmpeg()
    .input("anullsrc=r=44100:cl=stereo")
    .inputFormat("lavfi")
    .duration(duration)
    .output(silenceFilePath)
    .on("end", () => callback(null, silenceFilePath))
    .on("error", (err) => callback(`Error creating silence: ${err}`))
    .run();
};

/**
 * @description fuction: 공백 오디오 파일 임시 생성
 * @param {string[]} inputFiles 합칠 오디오 파일 리스트
 * @param {string} outputFile 결과 파일 저장 경로
 * @param {(err: string | null) => void} callback
 */
const concatenateMP3Files = (inputFiles, outputFile, callback) => {
  const command = ffmpeg();

  inputFiles.forEach((file) => {
    command.input(file);
  });

  command
    .on("error", (err) => {
      // console.log("inputFiles:", inputFiles);
      // console.log("outputFile:", outputFile);
      console.log("Error:", err.message);
      callback(err);
    })
    .on("end", () => {
      // console.log("Concatenation finished!");
      callback(null);
    })
    .mergeToFile(outputFile, path.join(inputDir, "tempDir"));
};

/**
 * @description fuction: 파일 이름변경 및 복사
 * @param {string} source 파일 원본 경로
 * @param {string} destination 저장할 경로
 */
const copyAndRenameFile = (source, destination) => {
  fs.promises
    .copyFile(source, destination)
    .then()
    .catch((err) => console.error(`Error copying file: ${err}`));
};

/**
 * @description fuction: 임시 생성한 공백 오디오 파일 제거
 */
const cleanUpSilenceFile = async () => {
  try {
    const silenceFiles = fs
      .readdirSync(destDir)
      .filter((file) => file.startsWith("silence_"));
    await Promise.all(
      silenceFiles.map((file) => fs.promises.unlink(path.join(destDir, file)))
    );
    console.log("Silence files cleaned up");
  } catch (err) {
    console.error(`Error cleaning up silence files: ${err}`);
  }
};

/**
 * @description fuction: 오디오 병합 함수.
 *              원본 파일명.split("_")[2] 에 합치는 순서가 알파벳으로 존재 = A, B, C, D, E.
 *              순서대로 합본 필요
 * @param {"lee" | "kim" | "ham"} writer 저자
 * @param {3 | 4} grade 학년
 * @param {group} group 학년
 */
const generateAudioFolder = async (writer, grade, group) => {
  /**
   * @type {(PromiseConstructor[] | [])} 오디오 병합 및 복사 stack
   */
  const tasks = [];
  /**
   * @type {string[]} 결과 파일 목록
   */
  const mediaPaths = [];

  try {
    Object.entries(group[writer][grade]).forEach((arr) => {
      const chapter = arr[0];
      const quizeData = arr[1];

      Object.entries(quizeData).forEach((quizSource) => {
        const id = quizSource[0];
        const audioArr = quizSource[1];
        const quizeType = id.split("-")[0].slice(4);
        const mediaBasePath = `${destDir}\\${writer}\\${grade}\\${Number(
          chapter
        )}\\${id}\\media`;

        ensureDirectoryExistence(mediaBasePath);

        Object.entries(audioArr).forEach((audioSource) => {
          const audioType = audioSource[0];
          const audioFileList = audioSource[1];

          /**
           * q === 문제음원
           * c === 선택지 음원
           * a === 정답음원
           */
          if (audioType === "q") {
            const mediaSavePath = `${mediaBasePath}\\${audioType}1.mp3`;

            if (audioFileList.length === 4) {
              let aNum = 0;
              let bNum = 0;
              let cNum = 0;
              let dNum = 0;
              let firstAudio;
              let secondAudio;
              let thirdAudio;
              let forthAudio;

              audioFileList.map((file, idx) => {
                const abs = file.split("_")[2];

                if (abs === "A") {
                  firstAudio = file;
                  aNum += 1;
                } else if (abs === "B") {
                  secondAudio = file;
                  bNum += 1;
                } else if (abs === "C") {
                  thirdAudio = file;
                  cNum += 1;
                } else if (abs === "D") {
                  forthAudio = file;
                  dNum += 1;
                } else {
                  console.log(`${id} media ${file} ABC Type conflict`);
                }
              });

              if (aNum === 1 && bNum === 1 && cNum === 1 && dNum === 1) {
                mediaPaths.push(mediaSavePath);
                tasks.push(
                  new Promise((resolve, reject) => {
                    createSilence(duration, (err, silenceFilePath) => {
                      if (err) {
                        console.error("Failed to create silence file:", err);
                        reject(err);
                        return;
                      }

                      const mp3OriginFilePath1 = `${basePath}\\${writer}\\g${grade}_voice\\${quizeType}\\${firstAudio}.mp3`;
                      const mp3OriginFilePath2 = `${basePath}\\${writer}\\g${grade}_voice\\${quizeType}\\${secondAudio}.mp3`;
                      const mp3OriginFilePath3 = `${basePath}\\${writer}\\g${grade}_voice\\${quizeType}\\${thirdAudio}.mp3`;
                      const mp3OriginFilePath4 = `${basePath}\\${writer}\\g${grade}_voice\\${quizeType}\\${forthAudio}.mp3`;

                      concatenateMP3Files(
                        [
                          mp3OriginFilePath1,
                          silenceFilePath,
                          mp3OriginFilePath2,
                          silenceFilePath,
                          mp3OriginFilePath3,
                          silenceFilePath,
                          mp3OriginFilePath4,
                        ],
                        mediaSavePath,
                        (err) => {
                          if (err) {
                            console.error("Failed to concatenate files:", err);
                            reject(err);
                          } else {
                            resolve();
                          }
                        }
                      );
                    });
                  })
                );
              } else {
                console.log(
                  `${id} media ${audioType} ABCD Type conflict: aNum = ${aNum}, bNum = ${bNum}, cNum = ${cNum}, dNum = ${dNum}, file: ${audioFileList}`
                );
                reject(
                  `${id} media ${audioType} ABCD Type conflict: aNum = ${aNum}, bNum = ${bNum}, cNum = ${cNum}, dNum = ${dNum}, file: ${audioFileList}`
                );
              }
            } else if (audioFileList.length === 3) {
              let aNum = 0;
              let bNum = 0;
              let cNum = 0;
              let firstAudio;
              let secondAudio;
              let thirdAudio;

              audioFileList.map((file, idx) => {
                const abs = file.split("_")[2];

                if (abs === "A") {
                  firstAudio = file;
                  aNum += 1;
                } else if (abs === "B") {
                  secondAudio = file;
                  bNum += 1;
                } else if (abs === "C") {
                  thirdAudio = file;
                  cNum += 1;
                } else {
                  console.log(`${id} media ${file} ABC Type conflict`);
                  reject(`${id} media ${file} ABC Type conflict`);
                }
              });

              if (aNum === 1 && bNum === 1 && cNum === 1) {
                mediaPaths.push(mediaSavePath);
                tasks.push(
                  new Promise((resolve, reject) => {
                    createSilence(duration, (err, silenceFilePath) => {
                      if (err) {
                        console.error("Failed to create silence file:", err);
                        reject(err);
                        return;
                      }

                      const mp3OriginFilePath1 = `${basePath}\\${writer}\\g${grade}_voice\\${quizeType}\\${firstAudio}.mp3`;
                      const mp3OriginFilePath2 = `${basePath}\\${writer}\\g${grade}_voice\\${quizeType}\\${secondAudio}.mp3`;
                      const mp3OriginFilePath3 = `${basePath}\\${writer}\\g${grade}_voice\\${quizeType}\\${thirdAudio}.mp3`;

                      concatenateMP3Files(
                        [
                          mp3OriginFilePath1,
                          silenceFilePath,
                          mp3OriginFilePath2,
                          silenceFilePath,
                          mp3OriginFilePath3,
                        ],
                        mediaSavePath,
                        (err) => {
                          if (err) {
                            console.error("Failed to concatenate files:", err);
                            reject(err);
                          } else {
                            resolve();
                          }
                        }
                      );
                    });
                  })
                );
              } else {
                console.log(
                  `${id} media ${audioType} ABC Type conflict: aNum = ${aNum}, bNum = ${bNum}, cNum = ${cNum}, file: ${audioFileList}`
                );
                reject(
                  `${id} media ${audioType} ABC Type conflict: aNum = ${aNum}, bNum = ${bNum}, cNum = ${cNum}, file: ${audioFileList}`
                );
              }
            } else if (audioFileList.length === 2) {
              let aNum = 0;
              let bNum = 0;
              let firstAudio;
              let secondAudio;

              audioFileList.map((file) => {
                const abs = file.split("_")[2];

                if (abs === "A") {
                  firstAudio = file;
                  aNum += 1;
                } else if (abs === "B") {
                  secondAudio = file;
                  bNum += 1;
                } else {
                  console.log(`${id} media ${file} ABC Type conflict`);
                  reject(`${id} media ${file} ABC Type conflict`);
                }
              });

              if (aNum === 1 && bNum === 1) {
                mediaPaths.push(mediaSavePath);
                tasks.push(
                  new Promise((resolve, reject) => {
                    createSilence(duration, (err, silenceFilePath) => {
                      if (err) {
                        console.error("Failed to create silence file:", err);
                        reject(err);
                        return;
                      }

                      const mp3OriginFilePath1 = `${basePath}\\${writer}\\g${grade}_voice\\${quizeType}\\${firstAudio}.mp3`;
                      const mp3OriginFilePath2 = `${basePath}\\${writer}\\g${grade}_voice\\${quizeType}\\${secondAudio}.mp3`;

                      concatenateMP3Files(
                        [
                          mp3OriginFilePath1,
                          silenceFilePath,
                          mp3OriginFilePath2,
                        ],
                        mediaSavePath,
                        (err) => {
                          if (err) {
                            console.error("Failed to concatenate files:", err);
                            reject(err);
                          } else {
                            resolve();
                          }
                        }
                      );
                    });
                  })
                );
              } else {
                console.log(
                  `${id} media ${audioType} length conflict: aNum = ${aNum}, bNum = ${bNum}`
                );
                reject(
                  `${id} media ${audioType} length conflict: aNum = ${aNum}, bNum = ${bNum}`
                );
              }
            } else if (audioFileList.length === 1) {
              const mp3OriginFilePath = `${basePath}\\${writer}\\g${grade}_voice\\${quizeType}\\${audioFileList[0]}.mp3`;
              tasks.push(
                new Promise((resolve) => {
                  copyAndRenameFile(mp3OriginFilePath, mediaSavePath);
                  resolve();
                })
              );
            } else {
              console.log(`${id} media ${audioType} length over 4`);
              reject(`${id} media ${audioType} length over 4`);
            }
          } else if (audioType === "c") {
            let choiceList = {};
            let mergeBaseFile = "";

            audioFileList.forEach((file) => {
              const split = file.split("_");
              if (split.length !== 4) {
                console.log(`Error: media name is strange: ${file}`);
                reject(`Error: media name is strange: ${file}`);
              } else {
                const choiceNum = split[1];
                const article = split[2];

                if (choiceNum === "01" && article === "A") {
                  if (mergeBaseFile) {
                    console.log(`Error: already exist file: ${file}`);
                    reject(`Error: already exist file: ${file}`);
                  } else {
                    mergeBaseFile = file;
                  }
                }

                if (choiceList[choiceNum]) {
                  choiceList[choiceNum].push(file);
                } else {
                  choiceList = {
                    ...choiceList,
                    [choiceNum]: [file],
                  };
                }
              }
            });

            Object.entries(choiceList).forEach((data, i) => {
              const choiceNum = data[0];
              const files = data[1];
              let Afile = null;
              let Bfile = null;
              let Cfile = null;
              let Dfile = null;

              files.forEach((file) => {
                const abc = file.split("_")[2];
                if (abc === "A") {
                  if (Afile) {
                    console.log(`Error: already exist Afile: ${file}`);
                    reject(`Error: already exist Afile: ${file}`);
                  } else {
                    Afile = file;
                  }
                } else if (abc === "B") {
                  if (Bfile) {
                    console.log(`Error: already exist Bfile: ${file}`);
                    reject(`Error: already exist Bfile: ${file}`);
                  } else {
                    Bfile = file;
                  }
                } else if (abc === "C") {
                  if (Cfile) {
                    console.log(`Error: already exist Cfile: ${file}`);
                    reject(`Error: already exist Cfile: ${file}`);
                  } else {
                    Cfile = file;
                  }
                } else if (abc === "D") {
                  if (Dfile) {
                    console.log(`Error: already exist Dfile: ${file}`);
                    reject(`Error: already exist Dfile: ${file}`);
                  } else {
                    Dfile = file;
                  }
                } else {
                  console.log(`media ${file} is not ABCD Type conflict`);
                  reject(`media ${file} is not ABCD Type conflict`);
                }
              });

              const mediaSavePath = `${mediaBasePath}\\${audioType}${Number(
                choiceNum
              )}.mp3`;

              if (Afile && Bfile && Cfile && Dfile) {
                mediaPaths.push(mediaSavePath);
                tasks.push(
                  new Promise((resolve, reject) => {
                    createSilence(duration, (err, silenceFilePath) => {
                      if (err) {
                        console.error("Failed to create silence file:", err);
                        reject(err);
                        return;
                      }
                      const mp3OriginFilePath1 = `${basePath}\\${writer}\\g${grade}_voice\\${quizeType}\\${Afile}.mp3`;
                      const mp3OriginFilePath2 = `${basePath}\\${writer}\\g${grade}_voice\\${quizeType}\\${Bfile}.mp3`;
                      const mp3OriginFilePath3 = `${basePath}\\${writer}\\g${grade}_voice\\${quizeType}\\${Cfile}.mp3`;
                      const mp3OriginFilePath4 = `${basePath}\\${writer}\\g${grade}_voice\\${quizeType}\\${Dfile}.mp3`;

                      concatenateMP3Files(
                        [
                          mp3OriginFilePath1,
                          silenceFilePath,
                          mp3OriginFilePath2,
                          silenceFilePath,
                          mp3OriginFilePath3,
                          silenceFilePath,
                          mp3OriginFilePath4,
                        ],
                        mediaSavePath,
                        (err) => {
                          if (err) {
                            console.error("Failed to concatenate files:", err);
                            reject(err);
                          } else {
                            resolve();
                          }
                        }
                      );
                    });
                  })
                );
              } else if (Afile && Bfile && Cfile) {
                mediaPaths.push(mediaSavePath);
                tasks.push(
                  new Promise((resolve, reject) => {
                    createSilence(duration, (err, silenceFilePath) => {
                      if (err) {
                        console.error("Failed to create silence file:", err);
                        reject(err);
                        return;
                      }
                      const mp3OriginFilePath1 = `${basePath}\\${writer}\\g${grade}_voice\\${quizeType}\\${Afile}.mp3`;
                      const mp3OriginFilePath2 = `${basePath}\\${writer}\\g${grade}_voice\\${quizeType}\\${Bfile}.mp3`;
                      const mp3OriginFilePath3 = `${basePath}\\${writer}\\g${grade}_voice\\${quizeType}\\${Cfile}.mp3`;

                      concatenateMP3Files(
                        [
                          mp3OriginFilePath1,
                          silenceFilePath,
                          mp3OriginFilePath2,
                          silenceFilePath,
                          mp3OriginFilePath3,
                        ],
                        mediaSavePath,
                        (err) => {
                          if (err) {
                            console.error("Failed to concatenate files:", err);
                            reject(err);
                          } else {
                            resolve();
                          }
                        }
                      );
                    });
                  })
                );
              } else if (!Afile && Bfile && Cfile) {
                if (!mergeBaseFile) {
                  console.log(`Error: No Base file: ${id}`);
                  reject(`Error: No Base file: ${id}`);
                  return;
                }

                mediaPaths.push(mediaSavePath);
                tasks.push(
                  new Promise((resolve, reject) => {
                    createSilence(duration, (err, silenceFilePath) => {
                      if (err) {
                        console.error("Failed to create silence file:", err);
                        reject(err);
                        return;
                      }
                      const mp3OriginFilePath1 = `${basePath}\\${writer}\\g${grade}_voice\\${quizeType}\\${mergeBaseFile}.mp3`;
                      const mp3OriginFilePath2 = `${basePath}\\${writer}\\g${grade}_voice\\${quizeType}\\${Bfile}.mp3`;
                      const mp3OriginFilePath3 = `${basePath}\\${writer}\\g${grade}_voice\\${quizeType}\\${Cfile}.mp3`;

                      concatenateMP3Files(
                        [
                          mp3OriginFilePath1,
                          silenceFilePath,
                          mp3OriginFilePath2,
                          silenceFilePath,
                          mp3OriginFilePath3,
                        ],
                        mediaSavePath,
                        (err) => {
                          if (err) {
                            console.error("Failed to concatenate files:", err);
                            reject(err);
                          } else {
                            resolve();
                          }
                        }
                      );
                    });
                  })
                );
              } else if (!Afile && Bfile && !Cfile) {
                if (!mergeBaseFile) {
                  console.log(`Error: No Base file: ${id}`);
                  reject(`Error: No Base file: ${id}`);
                  return;
                }

                mediaPaths.push(mediaSavePath);
                tasks.push(
                  new Promise((resolve, reject) => {
                    createSilence(duration, (err, silenceFilePath) => {
                      if (err) {
                        console.error("Failed to create silence file:", err);
                        reject(err);
                        return;
                      }
                      const mp3OriginFilePath1 = `${basePath}\\${writer}\\g${grade}_voice\\${quizeType}\\${mergeBaseFile}.mp3`;
                      const mp3OriginFilePath2 = `${basePath}\\${writer}\\g${grade}_voice\\${quizeType}\\${Bfile}.mp3`;

                      concatenateMP3Files(
                        [
                          mp3OriginFilePath1,
                          silenceFilePath,
                          mp3OriginFilePath2,
                        ],
                        mediaSavePath,
                        (err) => {
                          if (err) {
                            console.error("Failed to concatenate files:", err);
                            reject(err);
                          } else {
                            resolve();
                          }
                        }
                      );
                    });
                  })
                );
              } else if (Afile && Bfile) {
                mediaPaths.push(mediaSavePath);
                tasks.push(
                  new Promise((resolve, reject) => {
                    createSilence(duration, (err, silenceFilePath) => {
                      if (err) {
                        console.error("Failed to create silence file:", err);
                        reject(err);
                        return;
                      }
                      const mp3OriginFilePath1 = `${basePath}\\${writer}\\g${grade}_voice\\${quizeType}\\${Afile}.mp3`;
                      const mp3OriginFilePath2 = `${basePath}\\${writer}\\g${grade}_voice\\${quizeType}\\${Bfile}.mp3`;

                      concatenateMP3Files(
                        [
                          mp3OriginFilePath1,
                          silenceFilePath,
                          mp3OriginFilePath2,
                        ],
                        mediaSavePath,
                        (err) => {
                          if (err) {
                            console.error("Failed to concatenate files:", err);
                            reject(err);
                          } else {
                            resolve();
                          }
                        }
                      );
                    });
                  })
                );
              } else if (Afile) {
                const mp3OriginFilePath = `${basePath}\\${writer}\\g${grade}_voice\\${quizeType}\\${Afile}.mp3`;
                tasks.push(
                  new Promise((resolve) => {
                    copyAndRenameFile(mp3OriginFilePath, mediaSavePath);
                    resolve();
                  })
                );
              } else {
                console.log(`Error: Strange fileList : ${files}`);
                reject(`Error: Strange fileList : ${files}`);
                return;
              }
            });
          } else if (audioType === "a") {
            const mediaSavePath = `${mediaBasePath}\\${audioType}.mp3`;
            let aNum = 0;
            let bNum = 0;
            let firstAudio;
            let secondAudio;

            audioFileList.map((file) => {
              const abs = file.split("_")[2];

              if (abs === "A") {
                firstAudio = file;
                aNum += 1;
              } else if (abs === "B") {
                secondAudio = file;
                bNum += 1;
              } else {
                console.log(`${id} media ${file} ABC Type conflict`);
                reject(`${id} media ${file} ABC Type conflict`);
              }
            });

            if (audioFileList.length > 2) {
              console.log(`${id} Answer media ${audioFileList} over 2`);
              reject(`${id} Answer media ${audioFileList} over 2`);
            } else if (audioFileList.length === 2) {
              mediaPaths.push(mediaSavePath);
              tasks.push(
                new Promise((resolve, reject) => {
                  createSilence(duration, (err, silenceFilePath) => {
                    if (err) {
                      console.error("Failed to create silence file:", err);
                      reject(err);
                      return;
                    }

                    const mp3OriginFilePath1 = `${basePath}\\${writer}\\g${grade}_voice\\${quizeType}\\${firstAudio}.mp3`;
                    const mp3OriginFilePath2 = `${basePath}\\${writer}\\g${grade}_voice\\${quizeType}\\${secondAudio}.mp3`;

                    concatenateMP3Files(
                      [mp3OriginFilePath1, silenceFilePath, mp3OriginFilePath2],
                      mediaSavePath,
                      (err) => {
                        if (err) {
                          console.error("Failed to concatenate files:", err);
                          reject(err);
                        } else {
                          resolve();
                        }
                      }
                    );
                  });
                })
              );
            } else {
              const mp3OriginFilePath = `${basePath}\\${writer}\\g${grade}_voice\\${quizeType}\\${audioFileList[0]}.mp3`;
              tasks.push(
                new Promise((resolve) => {
                  copyAndRenameFile(mp3OriginFilePath, mediaSavePath);
                  resolve();
                })
              );
            }
          } else {
            console.log(
              `Error: no media Type Data: ${audioSource[0]}, ${audioSource[1]}`
            );
            reject(
              `Error: no media Type Data: ${audioSource[0]}, ${audioSource[1]}`
            );
          }
        });
      });
    });

    await Promise.all(tasks); // 모든 비동기 작업이 완료될 때까지 기다림

    // CSV 파일로 저장
    const csvContent = mediaPaths.join("\n");
    const csvPath = path.join(destDir, `mediaPaths_${writer}_${grade}.csv`);
    fs.writeFileSync(csvPath, csvContent);
  } catch (err) {
    throw err;
  }
};

/**
 * @description fuction: Exel import 및 분류
 * @param {"lee" | "kim" | "ham"} writer 저자
 * @param {3 | 4} grade 학년
 */
/**
 * @description fuction: Exel import 및 분류
 * @param {"lee" | "kim" | "ham"} writer 저자
 * @param {3 | 4} grade 학년
 */
const importExel = async (writer, grade, errorMessages) => {
  const startTime = new Date();
  console.log(
    `Start Time: ${startTime.toLocaleTimeString("en-US", { hour12: false })}`
  );
  const filePath = path.join(
    basePath,
    `${writer}\\g${grade}_voice\\voice.xlsx`
  ); // Exel 리소스 경로
  const workbook = readFile(filePath);
  const sheet = workbook.Sheets["Sheet1"];
  const range = decode_range(sheet["!ref"]);
  const thirdColumn = 2;
  const baseNumMapping = { 2: "lee", 1: "ham", 3: "kim" };
  const fileNamesInColumn = [];
  const fileList = [];
  const group = {
    [writer]: {
      [grade]: {},
    },
  };

  //  엑셀에서 파일명 리스트 추출
  for (let R = range.s.r; R <= range.e.r; ++R) {
    const cellAddress = encode_cell({ r: R, c: thirdColumn });
    const cell = sheet[cellAddress];
    if (cell) {
      fileNamesInColumn.push(cell.v);
    }
  }

  fileList.push(...fileNamesInColumn);

  /**
   * 1. group으로 분류
   * 2. audioType == "00"은 문제 오디오 파일
   * 3. Number(audioType) 최대값 === 4, 그 외 값은 무시
   *
   * type group = {
   *    [writer: "kim" | "lee" | "ham"]: {
   *      [grade: 3 | 4]: {
   *        [chapter: number]: {
   *          [id: string]: {
   *            q?: <string>[]  // 문제음원 filename insert
   *            c?: <string>[]  // 선택지음원 filename insert
   *            a?: <string>[]  // 정답음원 filename insert
   *          }
   *        }
   *      }
   *    }
   * }
   */
  fileList.map((fileName) => {
    const split = fileName.split("_");

    if (split.length === 4) {
      const id = split[0];
      const audioType = split[1];
      const ab = split[2];
      const writer = baseNumMapping[id[0]];
      const grade = id[1];
      const chapter = Number(id.slice(2, 4));

      //  Number(audioType) === 9 => 정답음원
      //  Number(audioType) > 4 => 불필요한 음원
      if (
        Number(audioType) === 9 &&
        (id?.includes("S") || id?.includes("A2") || id?.includes("P3"))
      ) {
        if (group[writer][grade]?.[chapter]?.[id]) {
          group[writer][grade][chapter][id].a = group[writer][grade]?.[
            chapter
          ]?.[id].a
            ? [...group[writer][grade]?.[chapter]?.[id].a, fileName]
            : [fileName];
        } else if (group[writer][grade]?.[chapter]) {
          group[writer][grade][chapter] = {
            ...group[writer][grade][chapter],
            [id]: {
              a: [fileName],
            },
          };
        } else {
          group[writer][grade][chapter] = {
            [id]: {
              a: [fileName],
            },
          };
        }
      } else if (Number(audioType) > 4) {
        return;
      } else if (group[writer][grade]?.[chapter]?.[id]) {
        if (audioType == "00") {
          group[writer][grade][chapter][id].q = group[writer][grade]?.[
            chapter
          ]?.[id].q
            ? [...group[writer][grade]?.[chapter]?.[id].q, fileName]
            : [fileName];
        } else {
          group[writer][grade][chapter][id].c = group[writer][grade]?.[
            chapter
          ]?.[id].c
            ? [...group[writer][grade]?.[chapter]?.[id].c, fileName]
            : [fileName];
        }
      } else if (group[writer][grade]?.[chapter]) {
        group[writer][grade][chapter] = {
          ...group[writer][grade][chapter],
          [id]:
            audioType == "00"
              ? {
                  q: [fileName],
                }
              : {
                  c: [fileName],
                },
        };
      } else {
        group[writer][grade][chapter] = {
          [id]:
            audioType == "00"
              ? {
                  q: [fileName],
                }
              : {
                  c: [fileName],
                },
        };
      }
    } else {
      console.log(`Error Data: ${fileName}`);
      errorMessages.push(`Error Data: ${fileName}`);
    }
  });

  Object.entries(group?.[writer]?.[grade]).map((data) => {
    const chpData = data[1];

    Object.entries(chpData).map((chpD) => {
      const id = chpD[0];
      const keys = Object.keys(chpD[1]);

      if (id.includes("S") || id.includes("A2") || id.includes("P3")) {
        if (!keys.includes("a")) console.log(`${id}: no Answer MP3`);
      }
    });
  });

  try {
    await generateAudioFolder(writer, grade, group);
    await cleanUpSilenceFile();

    const endTime = new Date();
    const totalTime = new Date(endTime - startTime).toISOString().slice(11, 19);

    console.log("Complete");
    console.log(
      `Complete Time: ${endTime.toLocaleTimeString("en-US", { hour12: false })}`
    );
    console.log(`Total Time: ${totalTime}`);
  } catch (err) {
    await cleanUpSilenceFile();

    const endTime = new Date();
    const totalTime = new Date(endTime - startTime).toISOString().slice(11, 19);

    console.log(
      `Error Time: ${endTime.toLocaleTimeString("en-US", { hour12: false })}`
    );
    console.log(`Total Time: ${totalTime}`);
    console.error("Error generating audio folder:", err);
    errorMessages.push(`Error generating audio folder: ${err}`);
  }
};

let ffmpegExecutablePath = ffmpegPath;
if (!isDev) {
  ffmpegExecutablePath = path.join(
    process.resourcesPath,
    "app.asar.unpacked",
    "node_modules",
    "ffmpeg-static",
    "ffmpeg.exe"
  );
}

ffmpeg.setFfmpegPath(ffmpegExecutablePath);

let ffprobePath;
if (!isDev) {
  ffprobePath = path.join(
    process.resourcesPath,
    "app.asar.unpacked",
    "node_modules",
    "ffprobe-static",
    "bin",
    "win32",
    "x64",
    "ffprobe.exe"
  );
} else {
  ffprobePath = require("ffprobe-static").path;
}

ffmpeg.setFfprobePath(ffprobePath);

const processAudio = async (newBasePath, newDestPath, author, grade) => {
  const errorMessages = [];
  basePath = path.join(newBasePath, "resource"); // 전역 변수 basePath 설정
  inputDir = newDestPath; // 전역 변수 inputDir 설정
  destDir = newDestPath; // 전역 변수 destDir 설정

  try {
    await importExel(author, grade, errorMessages);
  } catch (err) {
    console.error("Error processing audio:", err);
    errorMessages.push("Error processing audio:", err);
  }

  return errorMessages;
};

module.exports = { processAudio };
