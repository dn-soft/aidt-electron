const path = require("path");
const fs = require("fs-extra");
const xlsx = require("xlsx");

// 엑셀 파일 로드 함수
function loadExcelFile(dataFile) {
  const workbook = xlsx.readFile(dataFile);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  return xlsx.utils.sheet_to_json(sheet, { defval: "" });
}

// 파일 복사 함수
function copyImageFiles(data, sourceFolder, destinationRoot, columnMapping) {
  let missingFiles = [];

  data.forEach((row) => {
    const chapterFolder = path.join(destinationRoot, String(row.chapter));
    const idxFolder = path.join(chapterFolder, row.idx, "images");
    fs.ensureDirSync(idxFolder);

    for (let [col, newName] of Object.entries(columnMapping)) {
      const codeValue = row[col];
      if (codeValue && codeValue !== "0") {
        const oldFilename = path.join(sourceFolder, `${codeValue}.png`);
        const newFilename = path.join(idxFolder, `${newName}.png`);
        if (fs.existsSync(oldFilename)) {
          fs.copySync(oldFilename, newFilename);
        } else {
          missingFiles.push(oldFilename);
        }
      }
    }
  });

  return missingFiles;
}

// 누락 파일 보고서 생성 함수
function createMissingFilesReport(missingFiles, baseDir) {
  const outputFile = path.join(baseDir, "missing_files_report.xlsx");
  const missingFilesWorkbook = xlsx.utils.book_new();
  const missingFilesSheet = xlsx.utils.json_to_sheet(
    missingFiles.map((file) => ({ "Missing Files": file }))
  );
  xlsx.utils.book_append_sheet(
    missingFilesWorkbook,
    missingFilesSheet,
    "Missing Files"
  );
  xlsx.writeFile(missingFilesWorkbook, outputFile);
  return outputFile;
}

// 메인 처리 함수
function processImageSplit(baseDir, author, grade, columnMapping) {
  const dataFile = path.join(
    baseDir,
    `imageSplitData`,
    `image_${author}${grade}.xlsx`
  );
  const sourceFolder = path.join(
    baseDir,
    "resource",
    author,
    `g${grade}_art_scaleup`
  );
  const destinationRoot = path.join(baseDir, `${author}${grade}`);

  // 엑셀 파일이 존재하는지 확인
  if (!fs.existsSync(dataFile)) {
    return {
      success: false,
      message: `Error: Excel file does not exist: ${dataFile}`,
    };
  }

  const data = loadExcelFile(dataFile);
  const missingFiles = copyImageFiles(
    data,
    sourceFolder,
    destinationRoot,
    columnMapping
  );
  const outputFile = createMissingFilesReport(missingFiles, baseDir);

  return {
    success: true,
    message: `작업이 완료되었습니다. \n변환저장경로: ${baseDir} => ${author}${grade} 폴더\n누락된 파일 목록은 '${outputFile}'에 저장되었습니다.`,
    outputFile,
  };
}

module.exports = {
  processImageSplit,
};
